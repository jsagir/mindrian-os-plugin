/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-02 -- conversation operator NL classifier
 * ===================================================
 * Heuristic, deterministic classifier. NO LLM round-trip
 * (Phase 99 D-10). Same confidence threshold (transition_min_confidence
 * sourced from classifier-rules.json) as Phase 100's JTBD classifier
 * (D-12) -- single source of truth for "confident enough to act."
 *
 * Three input strata in order of weight (D-11):
 *   1. Tool / command markers  (weight 0.95-1.0; short-circuit)
 *   2. User-message intent patterns  (weight 0.3-0.7; accumulate per op)
 *   3. Entity-introduction signals  (weight 0.3 each; boost EXPLORE_CAPTURE)
 *
 * Public API:
 *   classify(input, currentState) -> { candidate_op, confidence, evidence, suggested_trigger }
 *
 * Rules externalized to lib/conversation/classifier-rules.json so the
 * lexicon can be tuned without code edits. Schema documented in
 * 99-02-PLAN.md task 1.
 *
 * Frame budget (Phase 99 D-23 corollary):  classify() < 5ms target.
 * Regexes pre-compiled at module load.
 *
 * Canon Part 8 (LOCAL ONLY):
 *   This module never queries Brain. Pure local string matching.
 *
 * Tier 0 fallback (Decision #8):
 *   If classifier-rules.json is missing or corrupt, classify() returns
 *   a null result with stratum='tier0' evidence. Never throws -- this
 *   is hot-path code consumed by Phase 99-04 hooks.
 *
 * Pure CJS, node built-ins only, zero npm dependencies (Phase 87 invariant).
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { OPERATORS, TRIGGERS } = require('./operator.cjs');

const RULES_PATH = path.join(__dirname, 'classifier-rules.json');
const HOOK_EVENT_TO_TRIGGER = {
  PostToolUse: 'hook_post_tool_use',
  Stop: 'hook_stop',
  SessionStart: 'session_start',
  UserPromptSubmit: 'user_message',
  AskUserQuestion: 'hook_post_tool_use',
};

let RULES = null;
let COMPILED = null; // { tool_markers: [{rule, matcher}], intent_patterns: [...], entity_signals: [...], thresholds }

function loadRules() {
  try {
    const raw = fs.readFileSync(RULES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.schema_version !== '1.0.0') {
      process.stderr.write('[classifier] schema_version mismatch in ' + RULES_PATH + '\n');
      process.stderr.write('[classifier] got ' + parsed.schema_version + ', expected 1.0.0\n');
      process.stderr.write('[classifier] tier-0 fallback engaged\n');
      return null;
    }
    return parsed;
  } catch (e) {
    process.stderr.write('[classifier] cannot load rules at ' + RULES_PATH + '\n');
    process.stderr.write('[classifier] ' + e.message + '\n');
    process.stderr.write('[classifier] tier-0 fallback engaged\n');
    return null;
  }
}

function compileRule(rule) {
  const pt = rule.pattern_type;
  if (pt === 'regex') return new RegExp(rule.pattern);
  if (pt === 'regex_ci') return new RegExp(rule.pattern, 'i');
  if (pt === 'literal') return rule.pattern; // string for indexOf
  if (pt === 'literal_ci') return rule.pattern.toLowerCase(); // lowercase for indexOf on lowercased input
  throw new Error('unknown pattern_type: ' + pt);
}

function compileRules(rules) {
  if (!rules) return null;
  const compile = (arr) => arr.map((r) => ({ rule: r, matcher: compileRule(r) }));
  return {
    tool_markers: compile(rules.tool_markers),
    intent_patterns: compile(rules.intent_patterns),
    entity_signals: compile(rules.entity_signals),
    thresholds: rules.thresholds,
  };
}

RULES = loadRules();
COMPILED = compileRules(RULES);

function matches(text, rule, matcher) {
  if (!text) return null;
  const pt = rule.pattern_type;
  if (pt === 'regex' || pt === 'regex_ci') {
    const m = matcher.exec(text);
    return m ? m[0] : null;
  }
  if (pt === 'literal') {
    return text.indexOf(matcher) !== -1 ? matcher : null;
  }
  if (pt === 'literal_ci') {
    return text.toLowerCase().indexOf(matcher) !== -1 ? matcher : null;
  }
  return null;
}

function exceptionFires(text, rule) {
  if (!rule.exceptions || !Array.isArray(rule.exceptions)) return false;
  for (const ex of rule.exceptions) {
    if (text && text.indexOf(ex) === 0) return true;
  }
  return false;
}

function tier0Result() {
  return {
    candidate_op: null,
    confidence: 0,
    evidence: [{ stratum: 'tier0', match: 'rules_unavailable', weight: 0 }],
    suggested_trigger: null,
  };
}

function classify(input, currentState) {
  if (!COMPILED) return tier0Result();
  if (!input || typeof input !== 'object') return tier0Result();

  const userMessage = input.user_message || '';
  const toolInvocation = input.tool_invocation || '';
  const hookEvent = input.hook_event || null;
  const currentOp = (currentState && currentState.current) || 'JUST_TALK';

  // --- Programmatic DECISION_GATE shortcut ---
  if (hookEvent === 'AskUserQuestion') {
    return {
      candidate_op: 'DECISION_GATE',
      confidence: 1.0,
      evidence: [{ stratum: 'programmatic', match: 'AskUserQuestion', weight: 1.0 }],
      suggested_trigger: 'hook_post_tool_use',
    };
  }

  // --- Stratum 1: Tool / command markers (short-circuit on match) ---
  // Check tool_invocation first, then user_message starting at position 0.
  const sourcesForMarkers = [];
  if (toolInvocation) sourcesForMarkers.push(toolInvocation);
  if (userMessage) sourcesForMarkers.push(userMessage);

  for (const src of sourcesForMarkers) {
    for (const item of COMPILED.tool_markers) {
      const rule = item.rule;
      const matcher = item.matcher;
      const m = matches(src, rule, matcher);
      if (!m) continue;
      if (exceptionFires(src, rule)) continue;
      if (rule.from_required && rule.from_required !== currentOp) continue;
      // target_op === null means "matched a /mos: command but no operator change" (e.g., /mos:status, /mos:operator)
      if (rule.target_op === null) {
        // Stop scanning more general /mos: markers below this one (e.g. /mos:operator should
        // NOT then match the general /mos:[a-z-]+ METHODOLOGY rule). Return a no-transition result.
        return {
          candidate_op: null,
          confidence: 0,
          evidence: [{ stratum: 'tool_marker', match: m, weight: 0, target_op: null, comment: rule.comment || 'no-op tool marker' }],
          suggested_trigger: null,
        };
      }
      const trigger = rule.trigger || (hookEvent ? HOOK_EVENT_TO_TRIGGER[hookEvent] : 'user_message');
      return {
        candidate_op: rule.target_op,
        confidence: rule.weight,
        evidence: [{ stratum: 'tool_marker', match: m, weight: rule.weight, target_op: rule.target_op }],
        suggested_trigger: trigger,
      };
    }
  }

  // --- Stratum 2: Intent patterns (accumulate per op) ---
  const scores = {}; // { JUST_TALK: 0.7, BUILD_ROOM: 0.0, ... }
  const evidence = [];
  for (const op of OPERATORS) scores[op] = 0;

  for (const item of COMPILED.intent_patterns) {
    const rule = item.rule;
    const matcher = item.matcher;
    const m = matches(userMessage, rule, matcher);
    if (!m) continue;
    if (rule.from_required && rule.from_required !== currentOp) continue;
    scores[rule.target_op] = Math.min(0.95, scores[rule.target_op] + rule.weight);
    evidence.push({
      stratum: 'intent_pattern',
      match: rule.pattern,
      weight: rule.weight,
      target_op: rule.target_op,
    });
  }

  // --- Stratum 3: Entity signals (boost EXPLORE_CAPTURE / boost_op) ---
  for (const item of COMPILED.entity_signals) {
    const rule = item.rule;
    const matcher = item.matcher;
    const m = matches(userMessage, rule, matcher);
    if (!m) continue;
    scores[rule.boost_op] = Math.min(1.0, scores[rule.boost_op] + rule.weight);
    evidence.push({
      stratum: 'entity_signal',
      match: m,
      weight: rule.weight,
      target_op: rule.boost_op,
      name: rule.name,
    });
  }

  // --- Resolve candidate ---
  let bestOp = null;
  let bestScore = 0;
  for (const op of OPERATORS) {
    if (scores[op] > bestScore) {
      bestScore = scores[op];
      bestOp = op;
    }
  }

  // Same op as current -> no transition (operator.validate rejects same->same anyway).
  if (bestOp === currentOp) {
    return {
      candidate_op: null,
      confidence: bestScore,
      evidence: evidence.sort((a, b) => b.weight - a.weight),
      suggested_trigger: null,
    };
  }

  if (bestScore < COMPILED.thresholds.transition_min_confidence) {
    return {
      candidate_op: null,
      confidence: bestScore,
      evidence: evidence.sort((a, b) => b.weight - a.weight),
      suggested_trigger: null,
    };
  }

  const trigger = hookEvent ? HOOK_EVENT_TO_TRIGGER[hookEvent] || 'user_message' : 'user_message';
  return {
    candidate_op: bestOp,
    confidence: bestScore,
    evidence: evidence.sort((a, b) => b.weight - a.weight),
    suggested_trigger: trigger,
  };
}

module.exports = {
  classify,
  // Internal helpers exported for testability ONLY.
  _internal: { loadRules, compileRules, RULES_PATH, HOOK_EVENT_TO_TRIGGER },
};
