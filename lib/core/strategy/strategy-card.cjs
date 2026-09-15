'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-06 Task 3 -- strategy-card: buildStrategyCard, the four-option
 * proposal card carrying a real subject_node_id and a filtered, capped
 * evidence_node_ids list. layer: graph
 *
 * WHY THE MINT RUNS FIRST, AND WHY A FAILED MINT IS FATAL, NOT DEGRADED
 * (345-ICM-CONSULT Card (b), R2, T-345-29). `edges.writeEdge` never probes
 * whether either endpoint has a node row (the foreign key was deliberately
 * removed in Phase 169 D-169-11). So a card assembled around an id that was
 * never inserted still lets the downstream gate approve branch "succeed": it
 * writes a SOURCED_FROM edge to a node that does not exist and returns
 * `ok: true, edges_written: 1`. That is not the deliverable met -- that is
 * this phase manufacturing one of the 2,657 dangling edges Phase 343 exists
 * to count. A card without a real subject is therefore worse than no card:
 * `buildStrategyCard` returns `null` on a failed mint rather than a
 * best-effort card pointing at nothing.
 *
 * WHY THE CANDIDATE FILTER DOES NOT TRUST "BY CONSTRUCTION" (T-345-29/T2).
 * `evidence_node_ids` candidates arrive from `navigation.findRecentChanges`
 * (via the ctx producer block, plan 345-05), so they are real node ids by
 * construction today. "By construction" is exactly the kind of claim that
 * stops being true one refactor later, so every candidate id is re-checked
 * against a real `nodes` row here, unconditionally.
 *
 * WHAT NEVER REACHES THE WIRE, THE HEADER, THE OPTIONS, OR THE PAYLOAD
 * (Canon Part 8, T-345-28). The goal's rung-source question field is LOCAL
 * venture prose. It is handed to `taxonomyClimb.climb(...)` and to NOTHING
 * ELSE in this file -- not the header, not any option label or description,
 * not the evidence list. `climb()` itself is pure, local and zero-network
 * (see taxonomy-climb.cjs's own header).
 *
 * THE CARD SHAPE MATCHES `gate_render`'S PARAMETERS WITH NO GATE-TOOL
 * CHANGE. `gate.cjs:123-127` already accepts `subject_node_id` and
 * `evidence_node_ids` as optional model-supplied parameters that normalize
 * to `null`/`[]` when absent (`gate-render.cjs:174-177`) -- "Nothing in this
 * task READS these fields" is precisely the starvation this phase's
 * objective names. This builder is the write half: a plain object, snake_case
 * keys on the wire fields, ready for a caller (plan 07) to spread straight
 * into a `gate_render` call. No gate tool file is touched by this plan.
 *
 * WHY `defer` IS A FOURTH OPTION, NOT A THIRD. A navigator can say "not now"
 * without it counting as a REJECT, which matters because
 * `rejectCountInWindow` deliberately excludes DEFER from its own count.
 *
 * Voice: `skills/larry-personality/SKILL.md` Part 12 -- one De Stijl glyph
 * per turn; the header opens with the yellow square (contradiction
 * surfaced), reusing `lib/hmi/voice-color-mark.cjs::glyphForColor` rather
 * than hand-typing the emoji a second time (Canon Part 7).
 *
 * PLAN 07 ADDITIVE EDIT (deviation Rule 2, documented in 345-07-SUMMARY.md).
 * `_buildOptions`'s `rewrite-jtbd` and `change-rung` entries now carry a
 * `preview` field holding a small JSON payload (`{"jtbd":...}` or
 * `{"jtbd":...,"rung":...}`). This is the ONLY field on a gate option that
 * survives `lib/mcp/gate-render.cjs::_normalizeOption` unchanged end to end
 * from `gate_render` through the live-gate ledger to `gate_answer`
 * (`_normalizeOption` returns exactly `{id, label, description, rank,
 * preview}`; `preview` was already part of the SUPERSET_SCHEMA, unused by
 * every card builder until now -- no schema change anywhere). Plan 07's
 * `lib/core/strategy/goal-gate.cjs::ratifyGoalProposal` reads this payload
 * at answer time so `jtbdState.setGoal` is called with the SAME job/rung
 * the navigator saw in the option description, never a value re-derived
 * from live room state at answer time (which could have drifted since the
 * card was rendered -- see goal-gate.cjs's own header for why re-derivation
 * is explicitly forbidden). `keep` and `defer` carry no preview (`null`,
 * unchanged): neither option ever calls `setGoal`.
 *
 * Canon Part 9: node reads/writes go only through the caller-owned `db`
 * handle and the `navigation.cjs` chokepoint (`mintGoalAnchor`); this file
 * never opens room.db itself.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const navigation = require('../navigation.cjs');
const jtbdState = require('../../hmi/jtbd-state.cjs');
const taxonomyClimb = require('./taxonomy-climb.cjs');
const { glyphForColor } = require('../../hmi/voice-color-mark.cjs');

const STRATEGY_CARD_KIND = 'strategy_goal';

// Mirrors gate-render.cjs's own MAX_EVIDENCE_NODE_IDS (64). Neither cap is
// raised; a caller-controlled candidate list is caller-controlled retained
// memory (same reasoning gate-render.cjs's own comment states).
const MAX_EVIDENCE_NODE_IDS = 64;

const STRATEGY_OPTION_IDS = Object.freeze(['keep', 'rewrite-jtbd', 'change-rung', 'defer']);

const YELLOW_GLYPH = glyphForColor('yellow');

/**
 * _filterRealNodeIds(db, candidates) -> string[] (fresh array, never throws)
 *
 * Every returned id resolves to a real row in `nodes` on THIS db handle,
 * de-duplicated first-wins, truncated to MAX_EVIDENCE_NODE_IDS. A stale id
 * (no matching row) is silently dropped, never substituted.
 */
function _filterRealNodeIds(db, candidates) {
  if (!db || typeof db.prepare !== 'function') return [];
  if (!Array.isArray(candidates)) return [];

  let stmt;
  try {
    stmt = db.prepare('SELECT id FROM nodes WHERE id = ?');
  } catch (_e) {
    return [];
  }

  const out = [];
  const seen = new Set();
  for (const id of candidates) {
    if (typeof id !== 'string' || id.length === 0) continue;
    if (seen.has(id)) continue;
    let row;
    try {
      row = stmt.get(id);
    } catch (_e) {
      continue;
    }
    if (!row) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_EVIDENCE_NODE_IDS) break;
  }
  return out;
}

/**
 * _resolveLadderText(rung, jtbdSlug) -> string
 *
 * Attempts the Brain render; falls back to the local one-liner whenever the
 * render is unavailable (null) OR returns a shape this module does not
 * recognize as a genuine successful render (never embed an unvalidated
 * Brain-returned object verbatim into a rendered card -- the same
 * discipline `lib/mcp/no-instructions.test.cjs` polices for the envelope
 * surface).
 *
 * WHY ONLY `.ladder` IS TRUSTED, NOT A BARE `.text` FIELD (live-verified
 * this task, WD-3 probe session). brain-client.cjs's own callTool docblock
 * states plainly that a non-JSON tool response is wrapped as `{ text:
 * rawText }` (brain-client.cjs:823-829) and its query() helper treats ANY
 * `result.text` presence as an "error / message passthrough"
 * (brain-client.cjs:996) -- the SAME shape carries a genuine JSON-RPC
 * validation-error string on a real failed call as carries legitimate
 * prose on a degraded-but-successful one, and nothing at this layer
 * disambiguates them. A live call against the deployed origin this session
 * (sending the lowercase ladder-vocabulary rung this module's own
 * behavior contract requires) returned exactly that ambiguous shape:
 * `{ text: "MCP error -32602: ... Invalid option: expected one of
 * \"UnDefined\"|\"IllDefined\"|\"WellDefined\"|\"Wicked\" at rung" }` --
 * the deployed tool's actual `rung` schema wants the THEO-cased rung id,
 * not the lowercase form. Trusting `.text` here would have put a raw
 * wire-level error string into a navigator-facing card option. A second
 * live call sending the Theo-cased form instead confirmed the REAL success
 * envelope carries a `.ladder` string (a ready-to-read multi-line ladder
 * rendering) alongside a structured `.rungs` array -- `.ladder` is the only
 * field this function trusts. This is a live finding for Plan 08 (which
 * owns 345-ICM-CONSULT R6, the rung-vocabulary contradiction), recorded in
 * 345-06-SUMMARY.md; it is NOT fixed in this file, because doing so would
 * contradict this module's own literal, plan-specified wire contract
 * (lowercase ladder rung on the call args). Whichever vocabulary the wire
 * call ultimately sends, this function degrades safely either way.
 */
async function _resolveLadderText(rung, jtbdSlug) {
  let rendered = null;
  try {
    rendered = await taxonomyClimb.renderLadder(rung, jtbdSlug);
  } catch (_e) {
    rendered = null;
  }
  if (rendered && typeof rendered === 'object' && typeof rendered.ladder === 'string' && rendered.ladder.length > 0) {
    return rendered.ladder;
  }
  return taxonomyClimb.localLadderLine(rung);
}

/**
 * _buildHeader(goal, reach) -> single-line string, no em-dash, under 300
 * chars, naming the ratified job, the inferred job (when it differs), the
 * rung, and the reach's own counts. Never reads the goal's rung-source
 * question field (Canon Part 8 -- see this module's own header).
 */
function _buildHeader(goal, reach) {
  const evidence = (reach && typeof reach === 'object' && reach.evidence && typeof reach.evidence === 'object')
    ? reach.evidence : {};
  const ratifiedJob = (typeof goal.jtbd === 'string' && goal.jtbd) ? goal.jtbd : 'unset';
  const inferredJob = (typeof evidence.current_jtbd === 'string' && evidence.current_jtbd) ? evidence.current_jtbd : '';
  const rung = (typeof goal.rung === 'string' && goal.rung) ? goal.rung : 'unrated';
  const reachesSince = (typeof evidence.reaches_since === 'number') ? evidence.reaches_since : 0;
  const contradictions = (typeof evidence.unresolved_contradictions === 'number') ? evidence.unresolved_contradictions : 0;

  let line = YELLOW_GLYPH + ' The ratified job is "' + ratifiedJob + '"';
  if (inferredJob && inferredJob !== ratifiedJob) {
    line += ', but the room has been reading as "' + inferredJob + '"';
  }
  line += ' at rung ' + rung + ', ' + reachesSince + ' reaches and ' + contradictions + ' unresolved contradictions since the last proposal.';

  if (line.length >= 300) {
    line = line.slice(0, 296) + '...';
  }
  return line;
}

/**
 * _buildOptions(goal, reach, ladderText, rung) -> the frozen four-entry
 * option array, in STRATEGY_OPTION_IDS order, each with a non-empty label.
 *
 * `rung` (added plan 07): the freshly-climbed local rung
 * (`taxonomyClimb.climb(goal.parent_question)`), a Theo-cased rung id.
 * Carried, JSON-encoded, on the `change-rung` option's `preview` field (see
 * this file's own PLAN 07 ADDITIVE EDIT header note) so
 * `goal-gate.cjs::ratifyGoalProposal` can call `setGoal` with the SAME rung
 * value the navigator saw rendered, at answer time, with no re-derivation.
 */
function _buildOptions(goal, reach, ladderText, rung) {
  const evidence = (reach && typeof reach === 'object' && reach.evidence && typeof reach.evidence === 'object')
    ? reach.evidence : {};
  const ratifiedJob = (typeof goal.jtbd === 'string' && goal.jtbd) ? goal.jtbd : 'unset';
  const inferredJob = (typeof evidence.current_jtbd === 'string' && evidence.current_jtbd) ? evidence.current_jtbd : ratifiedJob;

  // JSON.stringify never throws on plain string inputs; wrapped anyway
  // (Canon Part 3 graceful-fallback discipline) so a pathological input can
  // never break card assembly. A stringify fault degrades the preview to
  // null, which goal-gate.cjs's own JSON.parse already treats as
  // goal_write_failed (never a throw).
  function safePreview(obj) {
    try {
      return JSON.stringify(obj);
    } catch (_e) {
      return null;
    }
  }

  return [
    {
      id: 'keep',
      label: 'Keep the ratified job',
      description: 'Stay with "' + ratifiedJob + '" as ratified; the drift is noted, not acted on.',
    },
    {
      id: 'rewrite-jtbd',
      label: 'Rewrite the job',
      description: 'Ratify "' + inferredJob + '" as the new job, matching what the room has actually been doing.',
      preview: safePreview({ jtbd: inferredJob }),
    },
    {
      id: 'change-rung',
      label: 'Climb the ladder',
      description: ladderText,
      preview: safePreview({ jtbd: ratifiedJob, rung: rung }),
    },
    {
      id: 'defer',
      label: 'Defer',
      description: 'Not now. A defer here is not a reject; rejectCountInWindow deliberately excludes it.',
    },
  ];
}

/**
 * buildStrategyCard({ db, roomDir, roomSlug, reach, candidates }) -> card|null
 *
 * Async. In order, because the order is the deliverable:
 *   1. Read the goal record (jtbdState.getGoal). null when absent.
 *   2. Mint the anchor (navigation.mintGoalAnchor). null on a failed mint.
 *   3. Filter candidates to real node rows, dedupe first-wins, cap 64.
 *   4. Climb: the local rung, then the optional render, falling back to the
 *      local one-liner.
 *   5. Assemble the plain-object card.
 *
 * @param {object} opts
 * @param {{prepare: Function}} opts.db - caller-owned room.db handle
 * @param {string} opts.roomDir
 * @param {string} opts.roomSlug
 * @param {object} [opts.reach] - the fired SENS-20 candidate reach, if any
 * @param {string[]} [opts.candidates]
 * @returns {Promise<object|null>}
 */
async function buildStrategyCard(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const db = o.db;
  const roomDir = o.roomDir;
  const roomSlug = o.roomSlug;
  const reach = o.reach;
  const candidates = o.candidates;

  // 1. The goal record.
  const goal = (typeof roomDir === 'string' && roomDir) ? jtbdState.getGoal(roomDir) : null;
  if (!goal || typeof goal !== 'object') return null;

  // 2. Mint the anchor BEFORE anything else is assembled. A failed mint is
  // fatal to the card, not degraded (see header).
  const mintResult = navigation.mintGoalAnchor(db, roomSlug);
  if (!mintResult || mintResult.ok !== true) return null;
  const subjectNodeId = mintResult.node_id;

  // 3. Filter, dedupe, cap.
  const evidenceNodeIds = _filterRealNodeIds(db, candidates);

  // 4. Climb.
  const rung = taxonomyClimb.climb(goal.parent_question);
  const ladderText = await _resolveLadderText(rung, goal.jtbd);

  // 5. Assemble.
  return {
    kind: STRATEGY_CARD_KIND,
    header: _buildHeader(goal, reach),
    options: _buildOptions(goal, reach, ladderText, rung),
    subject_node_id: subjectNodeId,
    evidence_node_ids: evidenceNodeIds,
  };
}

module.exports = { buildStrategyCard, STRATEGY_CARD_KIND, STRATEGY_OPTION_IDS };
