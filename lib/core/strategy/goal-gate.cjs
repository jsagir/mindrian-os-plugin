'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-07 Task 1 -- goal-gate: ratifyGoalProposal, the single writer of
 * a ratified goal change, plus the anchor promotion. layer: graph
 *
 * THREE THINGS THIS HEADER STATES (the constitutional position, three
 * sentences, per this task's own instruction):
 *
 * 1. This module is the ONLY caller of `jtbdState.setGoal` in the repository
 *    (a source grep for that call site, excluding its own definition file,
 *    returns exactly one line, and that line is inside this file). A room's
 *    ratified goal is never rewritten silently -- only at a
 *    Decision Gate the navigator actually answered (Canon Part 9 role 5, and
 *    the langtalks consult's binding rule that the strategy node PROPOSES
 *    and never rewrites).
 *
 * 2. This whole module runs inside the CALLER's try/catch (`lib/mcp/tools/
 *    gate.cjs`'s existing approve branch, `gate.cjs:238-242` and
 *    `:307-309`), so no write fault this module produces can ever flip the
 *    gate response's `ok` to false.
 *
 * 3. This module does NOT write the decision node and does NOT write its
 *    provenance edges -- `gate_answer`'s existing approve branch already
 *    does both, correctly, through the shared reasoning writer (quick task
 *    260903-i2x), feeding it the card's `subjectNodeId`/`evidenceNodeIds`;
 *    `lib/core/navigation/reasoning-write.cjs` is the ONLY provenance-edge
 *    writer in the repository. This module FEEDS that writer (by existing
 *    on the card, minted in 345-06) rather than duplicating it. Do not add
 *    a second writer here.
 *
 * WHERE "THE NEW JOB" AND "THE NEW RUNG" COME FROM (deviation Rule 2, see
 * strategy-card.cjs's own PLAN 07 ADDITIVE EDIT header note).
 * `ratifyGoalProposal` reads the chosen option's `preview` field (a small
 * JSON payload `strategy-card.cjs::_buildOptions` now writes) rather than
 * re-deriving the job/rung from live room state at answer time. Re-deriving
 * would let the system quietly ratify something different from what the
 * navigator actually saw and approved on screen -- the exact failure mode
 * this design forbids. `preview` was chosen because it is the ONLY per-
 * option field `lib/mcp/gate-render.cjs::_normalizeOption` carries through
 * gate_render -> the live-gate ledger -> gate_answer unchanged that this
 * plan's own scope permits touching (touching `gate-render.cjs` itself, or
 * widening its SUPERSET_SCHEMA, would be an architectural change this task
 * does not authorize; `preview` was already part of that schema, unused by
 * every card builder until this plan).
 *
 * REJECT vs DEFER (both write nothing, but are NOT the same signal).
 * `rejectCountInWindow` (lib/workflow/reach-reject-reader.cjs) deliberately
 * EXCLUDES defer from its own count, and the cool-down throttle in plan 03
 * depends on that distinction. This module never collapses the two verdicts
 * into one "not approved" branch.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 * `db` handle and the filesystem-backed `jtbdState` module; this file never
 * opens room.db itself and never sends `card`/`goal` prose anywhere.
 * Canon Part 9: the single node-promotion chokepoint is `navigation.
 * confirmNode`; this file issues no raw node-table SQL.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const navigation = require('../navigation.cjs');
const jtbdState = require('../../hmi/jtbd-state.cjs');
const { STRATEGY_CARD_KIND, STRATEGY_OPTION_IDS } = require('./strategy-card.cjs');

/**
 * isStrategyCard(card) -> boolean. `true` only when `card.kind ===
 * 'strategy_goal'`. `false` for `null`, `undefined`, and every other kind.
 * Never throws.
 *
 * @param {*} card
 * @returns {boolean}
 */
function isStrategyCard(card) {
  return !!(card && typeof card === 'object' && card.kind === STRATEGY_CARD_KIND);
}

/**
 * _readOptionPreview(card, chosenId) -> parsed payload object, or {}.
 *
 * Finds the chosen option on `card.options` (by `id`, the RESOLVED id
 * `gate_answer` already validated before calling this module) and JSON-
 * parses its `preview` field. Never throws: a missing option, a missing
 * preview, or a malformed JSON string all degrade to an empty object, which
 * `_deriveSetGoalArgs` below then reports as a validation failure rather
 * than calling `setGoal` with fabricated values.
 */
function _readOptionPreview(card, chosenId) {
  const options = (card && Array.isArray(card.options)) ? card.options : [];
  const option = options.find((o) => o && (o.id === chosenId));
  if (!option || typeof option.preview !== 'string' || option.preview.length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(option.preview);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (_e) {
    return {};
  }
}

/**
 * ratifyGoalProposal(db, roomDir, params) -> the ratification result.
 *
 * params = { card, chosen, verdict, decisionNodeId }
 *
 * Returns:
 *   { ok: false, reason: 'chosen_not_in_strategy_options' } -- chosen[0] is
 *     not a member of STRATEGY_OPTION_IDS. Writes nothing. Checked FIRST,
 *     before any write, mirroring the validateChosenAgainstCard discipline
 *     that runs before any db open in gate.cjs.
 *   { ok: true, goal_written: false, anchor_confirmed: false } -- verdict is
 *     'reject' or 'defer'. Writes nothing.
 *   { ok: true, goal_written: false, anchor_confirmed: boolean } -- verdict
 *     is 'approve' and chosen is 'keep'. The anchor is promoted (or a
 *     promotion failure is recorded, never thrown); the goal is unchanged.
 *   { ok: true, goal_written: true, goal_version: number, anchor_confirmed:
 *     boolean } -- verdict is 'approve' and chosen is 'rewrite-jtbd' or
 *     'change-rung'. setGoal was called exactly once.
 *   { ok: true, goal_written: false, anchor_confirmed: boolean, reason:
 *     'goal_write_failed' } -- verdict is 'approve' and chosen is
 *     'rewrite-jtbd'/'change-rung', but setGoal failed (a file-write fault,
 *     or the chosen option carried no valid preview payload). Never throws:
 *     a file-write failure must not un-ratify a decision the navigator
 *     already made.
 *
 * @param {{prepare: Function}} db - caller-owned room.db handle
 * @param {string} roomDir
 * @param {{card?: object, chosen?: string[], verdict?: string,
 *   decisionNodeId?: string}} params
 * @returns {{ok: boolean, goal_written?: boolean, goal_version?: number,
 *   anchor_confirmed?: boolean, reason?: string}}
 */
function ratifyGoalProposal(db, roomDir, params) {
  const p = (params && typeof params === 'object') ? params : {};
  const card = p.card;
  const chosen = p.chosen;
  const verdict = p.verdict;

  const chosenId = (Array.isArray(chosen) && chosen.length > 0 && typeof chosen[0] === 'string')
    ? chosen[0] : null;
  if (STRATEGY_OPTION_IDS.indexOf(chosenId) === -1) {
    return { ok: false, reason: 'chosen_not_in_strategy_options' };
  }

  // reject / defer: no write, and deliberately NOT the same branch (see this
  // file's own header -- rejectCountInWindow excludes defer by design).
  if (verdict === 'reject' || verdict === 'defer') {
    return { ok: true, goal_written: false, anchor_confirmed: false };
  }

  if (verdict !== 'approve') {
    return { ok: false, reason: 'unknown_verdict' };
  }

  // approve: promote the anchor first. `writeEdge` never probes whether an
  // endpoint has a node row (Phase 169 D-169-11), and the anchor was minted
  // at review_status='proposed' in 345-06 -- a room must never carry a
  // permanently-proposed anchor under a confirmed decision, which reads
  // backwards. Wrapped: a promotion failure is recorded, never thrown.
  let anchorConfirmed = false;
  try {
    const subjectNodeId = (card && typeof card.subjectNodeId === 'string' && card.subjectNodeId)
      ? card.subjectNodeId
      : ((card && typeof card.subject_node_id === 'string') ? card.subject_node_id : null);
    if (subjectNodeId) {
      const confirmResult = navigation.confirmNode(
        db, subjectNodeId, navigation.resolveByUser(roomDir), 'strategy gate approve'
      );
      anchorConfirmed = !!(confirmResult && confirmResult.ok === true);
    }
  } catch (_e) {
    anchorConfirmed = false;
  }

  // 'keep' and 'defer' never reach setGoal (defer already returned above;
  // 'keep' falls through this if with goalWritten staying false).
  let goalWritten = false;
  let goalVersion;
  let writeReason = null;
  if (chosenId === 'rewrite-jtbd' || chosenId === 'change-rung') {
    const payload = _readOptionPreview(card, chosenId);
    const jtbd = (typeof payload.jtbd === 'string' && payload.jtbd.length > 0) ? payload.jtbd : null;
    const rung = (payload.rung !== undefined) ? payload.rung : undefined;
    if (jtbd === null) {
      writeReason = 'goal_write_failed';
    } else {
      try {
        const setGoalOpts = { jtbd: jtbd, set_by: 'gate_answer' };
        if (rung !== undefined) setGoalOpts.rung = rung;
        const result = jtbdState.setGoal(roomDir, setGoalOpts);
        if (result && typeof result.goal_version === 'number') {
          goalWritten = true;
          goalVersion = result.goal_version;
        } else {
          writeReason = 'goal_write_failed';
        }
      } catch (_e) {
        writeReason = 'goal_write_failed';
      }
    }
  }

  const out = { ok: true, goal_written: goalWritten, anchor_confirmed: anchorConfirmed };
  if (goalWritten) out.goal_version = goalVersion;
  if (writeReason) out.reason = writeReason;
  return out;
}

module.exports = { isStrategyCard, ratifyGoalProposal };
