'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-03 -- closeReach(): the unified 4-outcome dial-commit transaction.
 * ============================================================================
 * DIALTUI-06 / 07 / 08 / 09 + FILEVAL-01. The render-time dial (D3, Phase 143.1)
 * shows the navigator the ranked capability reaches; closeReach() is the single
 * door that turns the navigator's commit (or pivot, or defer, or none-fit) into
 * graph data. It wraps the SHIPPED recorders (Phase 125 selector-decisions) and
 * routes EVERY write through the lib/core/navigation.cjs chokepoint -- never
 * opens room.db directly, never requires a navigation submodule directly.
 *
 * The four outcomes (UI-SPEC Section 8):
 *
 *   1. sync       (resting-detent commit, no rotate) ->
 *        writeEdge SELECTED_REACH FROM active focus TO cmd:<command> with props
 *        {jtbd, framework, recommended, decision_id}
 *        + logMemoryEvent f_selector_sync_confirmed (the positive in-sync signal,
 *          DIALTUI-07: the resting detent IS the in-sync signal)
 *        + Layer-3 next-action (STATE.md Decisions row / TodoWrite) via the
 *          injected recordNextAction seam (Part 3 Layer-3 gap closed).
 *
 *   2. pivot      (rotate-to-pivot commit) ->
 *        writeEdge PIVOTED FROM chosen TO declined-recommended with ENUM-ONLY
 *          props {declined_recommended:'cmd:...', margin, decision_id}
 *        + logMemoryEvent f_selector_pivot (mirrors the PIVOTED edge; carries the
 *          investment-scaled pivot_penalty the ranker decay/penalty reader
 *          consumes, so one early pivot does not permanently bury a reach)
 *        + ALSO the SELECTED_REACH edge (the chosen reach is still a committed
 *          reach)
 *        + Layer-3 next-action.
 *
 *   3. defer / reject ->
 *        delegate to selector-decisions.recordSelectorDecision (a DEFERRED +30d
 *        or REJECTED cascade edge lands). NO SELECTED_REACH (not a committed
 *        reach). NO next-action.
 *
 *   4. free-text / none-fit overflow ->
 *        delegate to selector-decisions.recordSelectorMiss({top_k_offered,
 *        user_intent}). NO cascade edge, NO SELECTED_REACH, and NEVER a 4th
 *        explicit Free-Text option row (AP5).
 *
 * Canon binding:
 *   Part 4: every choice is graph data; PIVOTED makes "why not" graph data.
 *   Part 7: reuse before build; thin glue over the SHIPPED recordSelectorDecision
 *           + recordSelectorMiss + the navigation.writeEdge / logMemoryEvent /
 *           getActiveFocus chokepoint -- zero re-implemented recorders.
 *   Part 8: PIVOTED props are ENUM-only; no user content; no Brain calls.
 *   Part 9: SELECTED_REACH is SYSTEM BOOKKEEPING (created_by=system, exempt from
 *           human-confirm), kept DISTINCT from any confirmNode truth-claim
 *           promotion. closeReach NEVER folds a truth-claim promotion into the
 *           SELECTED_REACH write -- a truth-claim promotion stays on the separate
 *           navigation.confirmNode human-byUser path. All writes via the
 *           navigation chokepoint; this module carries zero direct room.db open.
 *
 * License: BSL 1.1.
 */

const navigation = require('../core/navigation.cjs');
const selectorDecisions = require('./selector-decisions.cjs');

// Pivot-penalty base. The penalty the ranker's decay/penalty reader consumes is
// investment-scaled: penalty = PIVOT_PENALTY_FLOOR + (1 - floor) * investment.
// At investment_level=0 (fresh room) the penalty is the FLOOR (small) so one
// early pivot does NOT permanently bury the declined reach; as the room
// accumulates investment the penalty grows toward 1 (a late, well-informed pivot
// carries more weight). Clamped to (0, 1].
const PIVOT_PENALTY_FLOOR = 0.2;

function _clamp01(x) {
  if (typeof x !== 'number' || !isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// Investment-scaled pivot penalty in (0, 1]. Reads roomState.investment_level
// (0..1); defaults to 0 (fresh room -> floor penalty).
function _pivotPenalty(roomState) {
  const inv = _clamp01(roomState && typeof roomState.investment_level === 'number'
    ? roomState.investment_level : 0);
  const penalty = PIVOT_PENALTY_FLOOR + (1 - PIVOT_PENALTY_FLOOR) * inv;
  // Guard the open-lower-bound contract: never return exactly 0.
  return Math.max(PIVOT_PENALTY_FLOOR, Math.min(1, penalty));
}

// Resolve the active focus node id for the SELECTED_REACH FROM-side. Routes
// through the navigation chokepoint (getActiveFocus); returns null when no
// focus is set (Tier 0 cold room).
function _activeFocusId(db, sessionId) {
  const focus = navigation.getActiveFocus(db, sessionId);
  return focus && typeof focus.focusNodeId === 'string' ? focus.focusNodeId : null;
}

// Write the SELECTED_REACH bookkeeping edge FROM active focus TO cmd:<command>.
// Canon Part 9: SELECTED_REACH is system bookkeeping (NOT a truth-claim) -- it is
// distinct from any confirmNode promotion and never carries a human byUser. The
// props are the dial-decision scalars only.
function _writeSelectedReach(db, focusId, reach) {
  return navigation.writeEdge(db, {
    source_id: focusId,
    target_id: 'cmd:' + reach.command,
    edge_type: 'SELECTED_REACH',
    properties: {
      jtbd: reach.jtbd,
      framework: reach.framework,
      recommended: reach.recommended === true,
      decision_id: reach.decision_id,
    },
  });
}

// Layer-3 next-action (Part 3 Layer-3 gap). The caller injects a recordNextAction
// seam (the STATE.md Decisions-row / TodoWrite wikilink injector) so this module
// stays surface-agnostic (CLI master + Desktop/Cowork mappings per DIALTUI-10)
// and the transaction test can assert the next-action write is invoked. When no
// seam is injected the commit still succeeds (the edge IS the durable record);
// the next-action is a convenience surface, not the source of truth.
function _recordNextAction(recordNextAction, reach, outcome) {
  if (typeof recordNextAction !== 'function') return { ok: true, skipped: true };
  try {
    const res = recordNextAction({ reach, outcome });
    return (res && typeof res === 'object') ? res : { ok: true };
  } catch (_e) {
    // A next-action surface failure must never roll back the durable edge write.
    return { ok: false, reason: 'next_action_failed' };
  }
}

// ---------------------------------------------------------------------------
// closeReach -- the unified 4-outcome transaction.
//
// Signature:
//   closeReach({
//     outcome: 'sync' | 'pivot' | 'defer' | 'reject' | 'free-text',
//     reach,                 // {command, jtbd, framework, recommended, decision_id} (outcomes 1-3)
//     declinedRecommended?,  // 'cmd:...' (outcome 2 only)
//     margin?,               // number (outcome 2 only)
//     reason?,               // string (outcome 3 only)
//     topKOffered?,          // [{command, score}, ...] (outcome 4 only)
//     userIntent?,           // verbatim user text (outcome 4 only)
//     sessionId,             // for getActiveFocus
//     roomState,             // {db, investment_level?}
//     recordNextAction?,     // Layer-3 seam (outcomes 1+2)
//   })
//
// Returns {ok: true, ...} on success, or {ok: false, reason, detail?} on
// validation / write failure. Defensive -- never throws on caller input.
// ---------------------------------------------------------------------------
function closeReach(args) {
  const o = args || {};
  const outcome = o.outcome;
  const roomState = (o.roomState && typeof o.roomState === 'object') ? o.roomState : {};
  const db = roomState.db;

  if (!db) {
    return { ok: false, reason: 'invalid_db' };
  }

  // -------------------------------------------------------------------------
  // Outcome 3: defer / reject -> delegate to the SHIPPED recordSelectorDecision.
  // No SELECTED_REACH (not a committed reach); no next-action.
  // -------------------------------------------------------------------------
  if (outcome === 'defer' || outcome === 'reject') {
    const reach = (o.reach && typeof o.reach === 'object') ? o.reach : {};
    const decision = (outcome === 'defer') ? 'defer' : 'reject';
    const res = selectorDecisions.recordSelectorDecision({
      decision,
      command: reach.command,
      framework: reach.framework,
      reason: o.reason,
      roomState,
    });
    if (!res || !res.ok) {
      return { ok: false, reason: 'decision_failed', detail: res ? res.reason : 'unknown' };
    }
    return { ok: true, outcome, decision_id: res.decision_id, edge_id: res.edge_id };
  }

  // -------------------------------------------------------------------------
  // Outcome 4: free-text / none-fit overflow -> delegate to recordSelectorMiss.
  // No cascade edge, no SELECTED_REACH, and NEVER a 4th explicit Free-Text row.
  // -------------------------------------------------------------------------
  if (outcome === 'free-text' || outcome === 'miss' || outcome === 'none-fit') {
    const res = selectorDecisions.recordSelectorMiss({
      top_k_offered: o.topKOffered,
      user_intent: o.userIntent,
      roomState,
    });
    if (!res || !res.ok) {
      return { ok: false, reason: 'miss_failed', detail: res ? res.reason : 'unknown' };
    }
    return { ok: true, outcome: 'free-text', miss_id: res.miss_id };
  }

  // -------------------------------------------------------------------------
  // Outcomes 1 + 2 are COMMITTED reaches. Both need a valid reach + active focus.
  // -------------------------------------------------------------------------
  if (outcome !== 'sync' && outcome !== 'pivot') {
    return { ok: false, reason: 'invalid_outcome', detail: String(outcome).slice(0, 40) };
  }
  const reach = (o.reach && typeof o.reach === 'object') ? o.reach : null;
  if (!reach || typeof reach.command !== 'string' || reach.command.length === 0) {
    return { ok: false, reason: 'invalid_reach' };
  }
  const focusId = _activeFocusId(db, o.sessionId);
  if (!focusId) {
    return { ok: false, reason: 'no_active_focus' };
  }

  // -------------------------------------------------------------------------
  // Outcome 2: rotate-to-pivot. Write the PIVOTED edge FIRST (the "why not"
  // graph data), then the f_selector_pivot event (with the investment-scaled
  // pivot_penalty the ranker consumes), then fall through to the shared
  // SELECTED_REACH + sync/pivot event + next-action commit.
  // -------------------------------------------------------------------------
  let pivotResult = null;
  if (outcome === 'pivot') {
    const declined = o.declinedRecommended;
    if (typeof declined !== 'string' || declined.length === 0) {
      return { ok: false, reason: 'invalid_declined_recommended' };
    }
    const margin = (typeof o.margin === 'number' && isFinite(o.margin)) ? o.margin : null;
    // PIVOTED props are ENUM/scalar ONLY (Part 8): declined_recommended (a
    // 'cmd:...' handle), margin (numeric scalar), decision_id (generated handle).
    // No freeform user content.
    const pivEdge = navigation.writeEdge(db, {
      source_id: 'cmd:' + reach.command,
      target_id: declined,
      edge_type: 'PIVOTED',
      properties: {
        declined_recommended: declined,
        margin,
        decision_id: reach.decision_id,
      },
    });
    if (!pivEdge || !pivEdge.ok) {
      return { ok: false, reason: 'pivot_edge_failed', detail: pivEdge ? pivEdge.reason : 'unknown' };
    }
    // f_selector_pivot event mirrors the PIVOTED edge and carries the
    // investment-scaled pivot-penalty signal the ranker's decay/penalty reader
    // consumes (findRecentChanges over f_selector_pivot). A low investment_level
    // yields a smaller penalty so one early pivot does not permanently bury the
    // declined reach.
    const investment = _clamp01(typeof roomState.investment_level === 'number'
      ? roomState.investment_level : 0);
    const pivEvent = navigation.logMemoryEvent(db, 'f_selector_pivot', {
      chosen: 'cmd:' + reach.command,
      declined_recommended: declined,
      framework: reach.framework,
      margin,
      decision_id: reach.decision_id,
      pivot_penalty: _pivotPenalty(roomState),
      investment_level_at_pivot: investment,
      source_path: 'dial:pivot:' + reach.command,
      created_by: 'user',
    });
    if (!pivEvent || !pivEvent.ok) {
      return { ok: false, reason: 'pivot_event_failed', detail: pivEvent ? pivEvent.reason : 'unknown' };
    }
    pivotResult = { pivot_edge_id: pivEdge.edge_id, pivot_event_id: pivEvent.eventId };
  }

  // -------------------------------------------------------------------------
  // Shared committed-reach commit (outcomes 1 + 2): the SELECTED_REACH edge +
  // the in-sync OR pivot was already logged, then the Layer-3 next-action.
  //
  // Canon Part 9: SELECTED_REACH is system bookkeeping, written via writeEdge
  // (the chokepoint), DISTINCT from any confirmNode truth-claim promotion. We
  // do NOT call confirmNode here -- if the reach also promotes a truth-claim
  // node, that promotion is a SEPARATE navigation.confirmNode call on the
  // human-byUser path, never folded into this bookkeeping write.
  // -------------------------------------------------------------------------
  const selEdge = _writeSelectedReach(db, focusId, reach);
  if (!selEdge || !selEdge.ok) {
    return { ok: false, reason: 'selected_reach_failed', detail: selEdge ? selEdge.reason : 'unknown' };
  }

  // Outcome 1: the positive resting-detent in-sync signal.
  if (outcome === 'sync') {
    const syncEvent = navigation.logMemoryEvent(db, 'f_selector_sync_confirmed', {
      command: 'cmd:' + reach.command,
      framework: reach.framework,
      decision_id: reach.decision_id,
      source_path: 'dial:sync:' + reach.command,
      created_by: 'user',
    });
    if (!syncEvent || !syncEvent.ok) {
      return { ok: false, reason: 'sync_event_failed', detail: syncEvent ? syncEvent.reason : 'unknown' };
    }
  }

  // Layer-3 next-action (Part 3 Layer-3 gap) for every committed reach.
  _recordNextAction(o.recordNextAction, reach, outcome);

  const out = {
    ok: true,
    outcome,
    selected_reach_edge_id: selEdge.edge_id,
    decision_id: reach.decision_id,
  };
  if (pivotResult) Object.assign(out, pivotResult);
  return out;
}

module.exports = {
  closeReach,
  // Exposed for the ranker / debug tooling so the pivot-penalty curve can be
  // referenced symbolically rather than re-derived.
  PIVOT_PENALTY_FLOOR,
  _test: { _pivotPenalty },
};
