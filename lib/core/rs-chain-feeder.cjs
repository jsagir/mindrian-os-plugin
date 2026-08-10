/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.4 Plan 02 -- engine-choreography codification (core).
 * Phase 89.4 Plan 03 -- skill-spawn rule table wired in place.
 *
 * Codifies upstream + downstream chain wiring for the RS Discovery
 * Engine per kickoff section 6 (USER LOAD-BEARING INTENT 7).
 *
 *   lookupUpstream(problem_type, stage, opts?)
 *     -- queries Brain FEEDS_INTO topology via the EXISTING brain-client
 *        chokepoint (Canon Part 7); returns {state: 'ready'} OR
 *        {state: 'pause', missing_upstream, suggested_action}.
 *
 *   emitChainMetadata(rs_type, breakthrough_score, active_context)
 *     -- returns the chain metadata block consumed by RS output
 *        layer; recommended_verb validated via Canon Part 3 closed-
 *        vocabulary checker (89.4-01) BEFORE the block is returned.
 *        Plan 89.4-03 wires the internal recommendSkillSpawn call so the
 *        chain metadata block carries spawn_skill + confidence + reasoning
 *        derived from the SKILL_SPAWN_RULES table.
 *
 *   recommendSkillSpawn(rs_type, breakthrough_score, opts)
 *     -- Plan 89.4-03 swap: first-match-wins iteration over the locked
 *        SKILL_SPAWN_RULES table per kickoff section 6.4. Returns the
 *        recommendation; NEVER auto-invokes a skill (the user picks via
 *        the Canon Part 3 verb at the Decision Gate; 89.5 / 91 concern).
 *
 *   SKILL_SPAWN_RULES (frozen)
 *     -- 5 rules per kickoff section 6.4 in declared order. Object.freeze'd
 *        at module scope AND each rule entry is independently frozen so
 *        the table cannot mutate at runtime.
 *
 * Reuses (Canon Part 7):
 *   brain-client.cjs::query / isAvailable           (89.1a chokepoint)
 *   rs-egress-prompts.cjs::auditQueryObject         (89.2-01 chokepoint)
 *   rs-canon-violations.cjs::validateVerb           (89.4-01)
 *   rs-canon-violations.cjs::CanonVerbViolation     (89.4-01)
 *   rs-egress-violations.cjs::ExternalEgressViolation (89.2-01)
 *
 * Brain query graceful-degradation order (mirrors Phase 90 Mode B/C/Tier-0):
 *   1. brainClient.isAvailable() === false -> {state: 'ready'} + warn
 *   2. brainClient.query() throws or returns null -> {state: 'ready'} + warn
 *   3. response.records absent or wrong shape -> {state: 'ready'} + warn
 *   4. Cross-reference returned framework names against
 *      opts.upstreamFreshness Map<name, boolean>; absent key = fresh.
 *
 * Canon Part 8 defense-in-depth:
 *   - lookupUpstream input ({problem_type, stage}) is audited via
 *     auditQueryObject BEFORE any Brain query is dispatched. If the
 *     audit trips, no Brain RPC is made and ExternalEgressViolation
 *     bubbles to the caller.
 *   - emitChainMetadata input (active_context) is audited via
 *     auditQueryObject so adversarial bytes nested in active_context.meta
 *     cannot smuggle into the returned metadata block.
 *   - recommendSkillSpawn opts (when non-empty) is audited as well.
 *   - The module never reaches the network directly; the only outbound
 *     surface is brainClient.query, which inherits 89.1a's allow-list.
 *
 * Pure CJS, zero npm deps, no Node built-ins beyond core require.
 */
'use strict';

const brainClientDefault = require('./brain-client.cjs');
const { auditQueryObject } = require('./rs-egress-prompts.cjs');
const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const {
  validateVerb,
  CanonVerbViolation,
  CANONICAL_VERBS,
} = require('./rs-canon-violations.cjs');

// ---------- Skill-spawn rule table (Plan 89.4-03; LOCKED per kickoff section 6.4) ----------

// Rules are evaluated in declared order via first-match-wins semantics.
// Confidence values match the kickoff section 6.4 specification verbatim;
// the 0.7 RECOMMENDED threshold is enforced by the CALLER (Plan 89.5
// Decision Gate UI) per Phase 88.2 Navigation Engine Brain interface
// contract. recommendSkillSpawn returns the raw confidence so callers can
// choose whether to surface a RECOMMENDED chip.
//
// Each rule entry is independently Object.freeze'd so the table cannot be
// mutated at runtime even if a caller obtains a reference to a rule. The
// match() functions are pure (no side effects, no I/O) and tolerate
// missing opts keys via `(opts.X || 0)` / `(opts.X || []).length` guards.
const SKILL_SPAWN_RULES = Object.freeze([
  Object.freeze({
    match: function (rs, score, opts) {
      return score >= 7 && rs === 'structural_transfer';
    },
    spawn: '/mos:find-analogies',
    confidence: 0.85,
    reasoning: 'high breakthrough + structural transfer -> SAPPhIRE/TRIZ deepening',
  }),
  Object.freeze({
    match: function (rs, score, opts) {
      return score >= 7 && (opts.industry_signals_count || 0) > 0;
    },
    spawn: '/mos:lean-canvas',
    confidence: 0.80,
    reasoning: 'high breakthrough + market signal -> business model exploration',
  }),
  Object.freeze({
    match: function (rs, score, opts) {
      return (opts.cross_methodology_substrates || []).length > 1;
    },
    spawn: '/mos:pipeline',
    confidence: 0.75,
    reasoning: 'cross-methodology discovery -> chained pipeline (RS -> JTBD -> Persona)',
  }),
  Object.freeze({
    match: function (rs, score, opts) {
      return (opts.resolved_experts_count || 0) > 5
        && (opts.resolved_institutions_count || 0) > 1;
    },
    spawn: '/mos:persona',
    confidence: 0.70,
    reasoning: 'expert network dense -> team composition',
  }),
  Object.freeze({
    match: function (rs, score, opts) {
      return score < 5 && opts.cynefin === 'complex';
    },
    spawn: '/mos:think-hats',
    confidence: 0.65,
    reasoning: 'low breakthrough + Cynefin complex -> perspective diversity',
  }),
]);

// ---------- Internal helpers ----------

// Sanitize a string to a safe generic handle suitable for embedding in a
// NL question sent to brain_ask. Mirrors the whitelist from brain-client.cjs
// ([a-zA-Z0-9 ._-]) so only generic methodology handles pass through.
// Canon Part 8: no user content ever flows into the NL question.
function _sanitizeHandle(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  return s.replace(/[^a-zA-Z0-9 ._-]/g, '');
}

// Build the NL question for brain_ask asking for upstream FEEDS_INTO
// frameworks for the reverse-salient engine.
// BUG 2 fix: replaced the former admin-gated raw-Cypher brain_query path
// with a brain_ask question (ungated -- valid for all API keys).
// Canon Part 8: the question carries only sanitized generic enum handles,
// never user content, never artifact text.
function _buildUpstreamQuestion(problem_type, stage) {
  const safeProblem = _sanitizeHandle(problem_type);
  const safeStage = _sanitizeHandle(stage);
  // Generic NL question: asks for frameworks that feed into the
  // reverse-salient framework for the given problem type and stage.
  let q = 'what frameworks feed into the reverse salient framework';
  if (safeProblem) q += ' for a ' + safeProblem + ' problem';
  if (safeStage) q += ' at the ' + safeStage + ' stage';
  q += '?';
  return q;
}

// Defensively pull the framework name from a Brain record. Brain
// returns either {name: '...'} (driver-mode) or [n0, n1, ...] (raw
// columns). We support both.
function _recordName(rec) {
  if (!rec || typeof rec !== 'object') return null;
  if (typeof rec.name === 'string') return rec.name;
  if (Array.isArray(rec) && typeof rec[0] === 'string') return rec[0];
  return null;
}

// ---------- Public surface: lookupUpstream ----------

async function lookupUpstream(problem_type, stage, opts) {
  opts = opts || {};
  const brainClient = opts.brainClient || brainClientDefault;

  // Canon Part 8: pre-flight audit on the input strings before they
  // can reach Brain. ExternalEgressViolation bubbles to the caller.
  auditQueryObject(
    { problem_type: problem_type, stage: stage },
    'rs-chain-feeder-lookup-upstream'
  );

  if (!brainClient.isAvailable()) {
    // Phase 252-01 (SWEEP-01): KEEP ruling -- this fail-open stays (it gates
    // a workflow step, not methodology content), but the stderr warn
    // upgrades to a visible line naming the refusal kind. "Brain
    // unreachable" stays a literal substring here (lib/memory/test-rs-
    // chain-feeder-core.cjs Test 1 asserts it verbatim, outside this task's
    // file scope); the kind name is additive.
    process.stderr.write('chain-feeder: Brain unreachable (refusal kind: no_key); assuming upstream ready (fail-open, not methodology content)\n');
    return { state: 'ready' };
  }

  // BUG 2 fix: use brain_ask (ungated) instead of brain_query (admin-gated).
  // brain.ask() returns a DirectiveEnvelope; we read next_gate.options[].framework
  // for the upstream framework names, mirroring the old record.name extraction.
  if (typeof brainClient.ask !== 'function') {
    process.stderr.write('chain-feeder: brainClient.ask not available; assuming upstream ready (fail-open, not methodology content)\n');
    return { state: 'ready' };
  }

  let askResult;
  try {
    const nlQuestion = _buildUpstreamQuestion(problem_type, stage);
    askResult = await brainClient.ask(nlQuestion);
  } catch (_err) {
    process.stderr.write('chain-feeder: Brain ask threw (refusal kind: unreachable); assuming upstream ready (fail-open, not methodology content)\n');
    return { state: 'ready' };
  }

  if (!askResult) {
    process.stderr.write(
      'chain-feeder: Brain ask returned null; assuming upstream ready\n'
    );
    return { state: 'ready' };
  }

  // Translate the brain_ask response into the framework-name list shape
  // the upstream-freshness check expects. next_gate.options[].framework
  // carries the framework names; fall back to directive.guided.framework.
  // Build a synthetic result.records array for the existing freshness loop.
  const frameworkNames = [];
  if (askResult.next_gate && Array.isArray(askResult.next_gate.options)) {
    for (const opt of askResult.next_gate.options) {
      if (opt && typeof opt.framework === 'string' && opt.framework.length > 0) {
        frameworkNames.push(opt.framework);
      }
    }
  }
  if (askResult.directive && askResult.directive.guided && askResult.directive.guided.framework) {
    const anchor = askResult.directive.guided.framework;
    if (!frameworkNames.includes(anchor)) frameworkNames.unshift(anchor);
  }

  // Wrap in the shape the downstream freshness loop already handles.
  const result = { records: frameworkNames.map(function (n) { return { name: n }; }) };

  if (!Array.isArray(result.records)) {
    process.stderr.write(
      'chain-feeder: Brain ask returned unexpected shape; assuming upstream ready\n'
    );
    return { state: 'ready' };
  }

  // Cross-reference upstream framework names against active room state
  // freshness. Plan 89.4-02 ships a minimal in-memory check: if
  // opts.upstreamFreshness is provided (Map<framework_name, boolean>),
  // use it. Absent key = fresh by default (Phase 89.5 will integrate
  // folder-memory.cjs for real freshness reads against BRAIN.md
  // quadruples per Phase 90).
  const freshness = opts.upstreamFreshness instanceof Map
    ? opts.upstreamFreshness
    : new Map();

  const missing = [];
  for (const rec of result.records) {
    const name = _recordName(rec);
    if (typeof name !== 'string' || name.length === 0) continue;
    if (freshness.has(name) && freshness.get(name) === false) {
      missing.push(name);
    }
  }

  if (missing.length === 0) return { state: 'ready' };
  return {
    state: 'pause',
    missing_upstream: missing,
    suggested_action: 'Run Methodology',
  };
}

// ---------- Public surface: emitChainMetadata ----------

function emitChainMetadata(rs_type, breakthrough_score, active_context) {
  active_context = active_context || {};

  // Canon Part 8: scan active_context for FORBIDDEN_PATTERNS via the
  // existing chokepoint. Adversarial bytes nested in any field
  // (e.g., active_context.meta.contact) get caught here.
  auditQueryObject(active_context, 'rs-chain-feeder-emit-metadata');

  // feeds_into mapping (deterministic per rs_type).
  let feeds_into;
  if (rs_type === 'structural_transfer') feeds_into = 'PWS VP';
  else if (rs_type === 'semantic_implementation') feeds_into = 'Causal Loop';
  else if (rs_type === 'hybrid') feeds_into = 'Navigation Engine';
  else feeds_into = 'JTBD'; // fallback for unknown rs_type

  // recommended_verb selection (deterministic per breakthrough_score).
  // Plan 89.4-03 may refine via skill rules; this module ships the
  // baseline heuristic.
  const score = Number(breakthrough_score);
  const safeScore = Number.isFinite(score) ? score : 0;
  let recommended_verb;
  if (safeScore >= 7) recommended_verb = 'Bank Opportunity';
  else if (safeScore >= 5) recommended_verb = 'Synthesize';
  else recommended_verb = 'Reformulate';

  // Canon Part 3: validate before returning. Defensive against future
  // edits to the heuristic introducing out-of-set verbs.
  validateVerb(recommended_verb, 'rs-chain-feeder-emit-metadata');

  // Plan 89.4-03 wiring: the chain metadata block now carries the rule
  // recommendation. active_context is reused as opts for the rule-table
  // evaluation. recommendSkillSpawn re-runs auditQueryObject under its
  // own surface tag; this is intentional double-defense and matches the
  // sibling pattern in lookupUpstream (audit before any consequential
  // computation, even if the caller already audited).
  const skill = recommendSkillSpawn(rs_type, safeScore, active_context);

  return {
    recommended_verb: recommended_verb,
    feeds_into: feeds_into,
    spawn_skill: skill.spawn_skill,
    confidence: skill.confidence,
    reasoning: skill.reasoning,
  };
}

// ---------- Public surface: recommendSkillSpawn (Plan 89.4-03 rule-table wired) ----------

function recommendSkillSpawn(rs_type, breakthrough_score, opts) {
  opts = opts || {};
  // Canon Part 8 defense-in-depth (TIGHTENED in Plan 89.4-03): always run
  // auditQueryObject when opts is a non-null object. The Plan 89.4-02 stub
  // had a `Object.keys().length > 0` guard which, while sufficient for the
  // stub, allowed adversarial single-key payloads to slip through if a
  // caller post-mutated opts after the gate. The unconditional audit
  // closes that window. Empty `{}` opts pass JSON.stringify('{}') trivially
  // (zero forbidden-pattern hits).
  auditQueryObject(opts, 'rs-chain-feeder-recommend-skill-spawn');

  const score = Number(breakthrough_score);
  const safeScore = Number.isFinite(score) ? score : 0;

  // First-match-wins: iterate SKILL_SPAWN_RULES in declared order; the
  // first rule whose match() returns true wins; subsequent rules are NOT
  // evaluated. If no rule matches, return the no-rule fallback shape.
  for (let i = 0; i < SKILL_SPAWN_RULES.length; i++) {
    const rule = SKILL_SPAWN_RULES[i];
    let matched = false;
    try {
      matched = !!rule.match(rs_type, safeScore, opts);
    } catch (_e) {
      // Defensive: a rule predicate that throws on unexpected opts shape
      // never crashes the loop. Treated as a non-match so the iteration
      // continues. This preserves first-match-wins semantics even under
      // malformed input.
      matched = false;
    }
    if (matched) {
      return {
        spawn_skill: rule.spawn,
        confidence: rule.confidence,
        reasoning: rule.reasoning,
      };
    }
  }

  return {
    spawn_skill: null,
    confidence: 0,
    reasoning: 'no rule matched',
  };
}

// ---------- Module exports ----------

module.exports = {
  lookupUpstream,
  emitChainMetadata,
  recommendSkillSpawn,
  // Plan 89.4-03 export (additive). Frozen array; callers may iterate
  // for introspection (e.g., 89.5 NL-Graph Surface UI listing
  // recommended skills) but cannot mutate.
  SKILL_SPAWN_RULES,
  // Re-export so Canon-aware caller wrappers can catch by err.name
  // without re-requiring the upstream modules themselves.
  ExternalEgressViolation,
  CanonVerbViolation,
  CANONICAL_VERBS,
};
