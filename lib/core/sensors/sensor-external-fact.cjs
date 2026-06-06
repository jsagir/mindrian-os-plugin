'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143-03 Task 1 -- SENS-04 external-fact detector (the gate-relevant web sensor).
 *
 * When the navigator references an external fact (competitor / market /
 * state-of-the-art), this detector surfaces a HAT-SCOPED WebSearch candidate
 * reach. The hat-scope comes from hat-scoping-table.cjs (Canon Part 2): White =
 * data/arxiv, Green = patents + arxiv + deep-research, Black = failure-cases,
 * Yellow = success-cases, Red = intuition-only (no web tool), Blue = synthesis.
 *
 * REUSE BEFORE BUILD (Canon Part 7): the underlying capability is shipped --
 * /mos:research + WebSearch (commands/research.md). This detector does NOT run a
 * search inline. It surfaces the DISPATCH HANDLE + the hat-scoped tool set; the
 * navigator approves at the Decision Gate before any web call fires.
 *
 * THE MCP-STACK-ASK RULE (CLAUDE.md feedback_mcp_stack_awareness + 00c Section
 * 3a): when the web trigger fires, the reach surfaces a Decision-Gate tool choice
 * (Tavily / Firecrawl / Exa) UNLESS the active hat is pre-configured. It NEVER
 * marks a silent WebSearch dispatch. The tool_choice_gate evidence flag and the
 * tool-choice companions encode this.
 *
 * CANON PART 8 -- THE WEB QUERY IS PUBLIC SIGNAL: SIGNAL -> LOCAL is allowed (the
 * sourced artifact files locally); SIGNAL -> Brain is forbidden. The reach's
 * web-query payload carries ONLY a generic public topic handle (the matched
 * external-fact category enum), NEVER the user's turn text or artifact bytes. The
 * detector classifies WHICH category of external fact was named; it never copies
 * the proprietary content into the reach. The inherited Part-8 sweep over
 * lib/core/sensors/ spans this file -- it constructs the topic handle as a plain
 * generic enum string, never via a hashing or egress-projection path.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide(). The routing fence over
 * lib/core/sensors/ asserts this.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');
const { hatScopeFor } = require('./hat-scoping-table.cjs');

/**
 * External-fact reference patterns. Each maps a STRUCTURAL phrasing to a generic
 * public TOPIC HANDLE (a category enum). The detector reports only WHICH category
 * of external fact was named -- never the user's specific content. The handle is
 * the public SIGNAL that may flow to LOCAL/web; it is generic by construction.
 */
const EXTERNAL_FACT_PATTERNS = [
  { rx: /\bstate[- ]of[- ]the[- ]art\b/i, handle: 'state-of-the-art' },
  { rx: /\bcompetitor(?:s|'s)?\b/i, handle: 'competitor' },
  { rx: /\bcompeting\b/i, handle: 'competitor' },
  { rx: /\bmarket (?:leader|leaders|landscape|analysis|size|share)\b/i, handle: 'market' },
  { rx: /\bthe market\b/i, handle: 'market' },
  { rx: /\bindustry benchmark\b/i, handle: 'benchmark' },
  { rx: /\bbenchmark\b/i, handle: 'benchmark' },
  { rx: /\bprior art\b/i, handle: 'prior-art' },
  { rx: /\bpatent landscape\b/i, handle: 'prior-art' },
  { rx: /\bwhat (?:is|are) (?:others|other teams|incumbents) (?:doing|building)\b/i, handle: 'incumbents' },
];

/**
 * Pull the turn text as a string. Tolerant of { text } or { utterance }. Returns
 * '' when absent/non-string so the caller soft-fails to null rather than throwing.
 */
function turnText(turn) {
  if (!turn || typeof turn !== 'object') return '';
  if (typeof turn.text === 'string') return turn.text;
  if (typeof turn.utterance === 'string') return turn.utterance;
  return '';
}

/**
 * Pull the active hat off the turn (or ctx). Returns '' when absent. Defensive.
 */
function activeHat(turn, ctx) {
  if (turn && typeof turn === 'object' && typeof turn.active_hat === 'string') return turn.active_hat;
  if (ctx && typeof ctx === 'object' && typeof ctx.active_hat === 'string') return ctx.active_hat;
  return '';
}

/**
 * Classify the external-fact category from the turn text. Returns the generic
 * public topic handle (a category enum) or '' when no external-fact pattern
 * matches. This is the ONLY thing about the turn that ever rides the reach --
 * the WHICH category, never the user's specific content.
 */
function classifyExternalFact(text) {
  for (const p of EXTERNAL_FACT_PATTERNS) {
    if (p.rx.test(text)) return p.handle;
  }
  return '';
}

/**
 * True if the active hat is pre-configured to a single web tool, so the
 * MCP-stack-ask Decision Gate is skipped. ctx.hat_tool_preconfigured is an
 * optional LOCAL map { <Hat>: '<tool>' }.
 */
function preconfiguredTool(ctx, hat) {
  if (!ctx || typeof ctx !== 'object') return '';
  const map = ctx.hat_tool_preconfigured;
  if (!map || typeof map !== 'object') return '';
  const v = map[hat];
  return (typeof v === 'string' && v.length > 0) ? v : '';
}

/**
 * SENS-04 -- external-fact reference -> hat-scoped WebSearch reach.
 *
 * @param {object} turn  -- the turn signal bag (reads turn.text + turn.active_hat)
 * @param {object} _tuple -- the /mos:diagnose tuple (unused for detection)
 * @param {object} ctx   -- LOCAL context (optional active_hat + hat_tool_preconfigured map)
 * @returns {Readonly<object>|null}
 */
function sensorExternalFact(turn, _tuple, ctx) {
  const text = turnText(turn);
  if (!text) return null;

  // Classify WHICH external-fact category was named -> the generic public topic
  // handle. Never the user's specific content.
  const topicHandle = classifyExternalFact(text);
  if (!topicHandle) return null;

  // Hat-scope the reach per Canon Part 2. Red Hat (and any web_enabled=false
  // scope) returns null: intuition only, no external tool.
  const hat = activeHat(turn, ctx);
  const scope = hatScopeFor(hat);
  if (!scope.web_enabled) return null;

  // Green's deep-research lane folds in here as a non-gate-blocking escalation
  // lane: a Green-hat external-fact reach uses reach_id 'deep_research'; every
  // other hat uses the shallow 'context_block' external-fact lookup.
  const reach_id = scope.deep_research ? 'deep_research' : 'context_block';

  // THE MCP-STACK-ASK GATE. If the hat is pre-configured to a single tool, skip
  // the Decision Gate (no ask). Otherwise surface a tool-choice Decision Gate
  // (Tavily / Firecrawl / Exa) -- NEVER a silent WebSearch dispatch.
  const preTool = preconfiguredTool(ctx, hat);
  const toolChoiceGate = preTool === '';

  // Companions carry ONLY generic handles: the hat's scoped tool set, plus the
  // tool-choice offer when the gate is active. No user content.
  const companions = [];
  // The hat-scoped tool set (generic tool-name handles).
  for (const t of scope.tools) {
    companions.push('web_tool:' + t);
  }
  if (toolChoiceGate) {
    // The MCP-stack-ask Decision Gate offer. The closed tool-choice set.
    companions.push('tool_choice:Tavily/Firecrawl/Exa');
  } else {
    // Pre-configured: the chosen tool rides as a generic handle (no gate).
    companions.push('tool_preconfigured:' + preTool);
  }

  return makeReach({
    reach_id: reach_id,
    // 'push_forward' posture: an external-fact reference is a signal to push
    // outward for public evidence (Part 3 SIGNAL context), not to pull back.
    posture: 'push_forward',
    // Dispatch names the SHIPPED /mos:research + WebSearch surface (a handle, not
    // a call). It is explicitly NOT a silent dispatch -- the tool choice routes
    // through the Decision Gate when the gate is active.
    dispatch: 'mos:research (hat-scoped WebSearch)',
    companions: companions,
    signal: 'external_fact',
    // LOCAL/SIGNAL scalars only: the generic public topic handle (category enum),
    // the active hat, the search focus tag, and the gate flag. NO turn text, NO
    // artifact body -- the WHICH never rides the reach.
    evidence: {
      topic_handle: topicHandle,
      hat: hat || 'unspecified',
      focus: scope.focus,
      tool_choice_gate: toolChoiceGate,
      deep_research_lane: scope.deep_research === true,
    },
  });
}

module.exports = {
  sensorExternalFact: sensorExternalFact,
};
