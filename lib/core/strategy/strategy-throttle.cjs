'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-03 Task 3 -- the three-mechanism cool-down that keeps the
 * strategy node from becoming the nagging loop it exists to replace
 * (345-RESEARCH Pitfall 3; the live WATCH item
 * feedback_1_15_enforcement_regression_watch.md, 2026-07-02).
 * layer: graph
 *
 * THE THREE MECHANISMS, in the fixed order isThrottled evaluates them, and
 * why that order is load-bearing:
 *
 *   1. THE HARD MINIMUM INTERVAL (reason 'min_interval'). No proposal inside
 *      STRATEGY_MIN_INTERVAL_REACHES (lib/core/strategy/goal-cadence.cjs) of
 *      the last one, for any reason. Cheapest to check and most certain, so
 *      it runs first and wins over every other signal.
 *   2. THE DISMISSAL-RATE THROTTLE (reason 'dismissal_rate'). Modelled
 *      structurally on lib/core/breakthrough/canary.cjs:85-124: over a
 *      trailing window of STRATEGY_FIRE_WINDOW strategy_proposed fires, if
 *      more than STRATEGY_DISMISSAL_THRESHOLD were dismissed and the sample
 *      is at least STRATEGY_MIN_SAMPLE, stop firing. This is the
 *      self-correcting mechanism: a wrong cadence default recovers on its
 *      own instead of nagging forever.
 *   3. REJECT-KEYED SUPPRESSION (reason 'reject_suppression'), LAST.
 *      lib/workflow/reach-reject-reader.cjs::rejectCountInWindow already
 *      answers "the navigator has said no to this reach N times recently"
 *      for the 'contradiction' reach id (WD-4), correctly excluding DEFER
 *      and PIVOT (reach-reject-reader.cjs:14-17). It is called AS-IS here,
 *      never reimplemented. It runs last because f_selector_decision is not
 *      yet written from the dial in production
 *      (lib/core/meter/transfer-reader.cjs:41-44), so this leg reads 0 on
 *      day one on most rooms -- that is HONEST, not broken, and it is
 *      exactly why this mechanism is not the primary one.
 *
 * REUSE BEFORE BUILD (Canon Part 7): rejectCountInWindow is called through
 * its own module, never re-derived. The dismissal-rate SHAPE (per-fire-kind
 * rate over a window, a minimum-sample floor, a named threshold) is copied
 * from canary.cjs; this module does not re-derive that shape either, it
 * composes it against strategy_proposed / f_selector_decision instead of
 * breakthrough_surfaced / breakthrough_dismissed.
 *
 * THE CORRELATION KEY for computeDismissalRate. canary.cjs correlates a
 * dismissal to its fire by breakthrough_id. A strategy proposal has no such
 * single id; its own payload (memory-events.cjs's strategy_proposed block)
 * carries anchor_node_id (the LOCAL goal-anchor node) and goal_version. The
 * pair together identifies one specific proposal, so a dismissal is matched
 * to a fire when a f_selector_decision row's properties carry the SAME
 * anchor_node_id + goal_version pair. This is a narrower, more specific
 * correlation than the reach-level rejectCountInWindow leg (mechanism 3),
 * which counts every reject against the 'contradiction' reach id regardless
 * of which specific proposal it answered -- the two mechanisms read
 * different granularities of the same underlying reject signal on purpose.
 *
 * INJECTION SEAMS (so every pure leg runs with db = null):
 *   - computeDismissalRate prefers roomState.dismissalRate =
 *     { rate, sample_size } when present.
 *   - the reject-suppression leg calls rejectCountInWindow(db, 'contradiction',
 *     roomState), which has its own roomState.rejectCountInWindow.contradiction
 *     seam (reach-reject-reader.cjs:123-132); this module adds no second seam
 *     for it.
 *   - the hard-interval leg reads counts.reaches_since directly, a plain
 *     caller-supplied parameter needing no seam.
 *
 * Canon Part 8: this module reads enums and scalars only. It NEVER reads the
 * reject-row reason FIELD (the free-text explanation a reject can carry) --
 * reach-reject-reader.cjs reads only the PRESENCE of that field, never the
 * string, and that is inherited here by calling the reader as-is rather than
 * re-reading the row itself.
 * Canon Part 9: emitThrottleEvent writes exactly one row via
 * navigation.logMemoryEvent, never opens a database itself (the caller's
 * handle, the writeEdge / getRoomContext contract).
 *
 * Pure CJS, node built-ins plus require('../navigation.cjs') and
 * require('../../workflow/reach-reject-reader.cjs') only.
 * House rule: hyphens only, no em-dashes.
 */

const navigation = require('../navigation.cjs');
const reachRejectReader = require('../../workflow/reach-reject-reader.cjs');
const goalCadence = require('./goal-cadence.cjs');

// ---------------------------------------------------------------------------
// Named constants (WD-1, reversible by editing this block alone).
// ---------------------------------------------------------------------------

// More than half the recent proposals dismissed means the watcher is wrong
// about this room, not that the room is wrong.
const STRATEGY_DISMISSAL_THRESHOLD = 0.5;

// The trailing proposal count the dismissal rate is computed over.
const STRATEGY_FIRE_WINDOW = 6;

// Below this, a rate is noise; three dismissals is the smallest honest
// sample.
const STRATEGY_MIN_SAMPLE = 3;

// The navigator has said REJECT to this reach twice in the window; stop
// offering it.
const STRATEGY_REJECT_SUPPRESS_AT = 2;

// The reach id this module's reject-suppression leg watches (WD-4).
const STRATEGY_REACH_ID = 'contradiction';

// The per-event-type row bound for the dismissal-rate reads, matching
// canary.cjs's own CANARY_QUERY_LIMIT idiom.
const STRATEGY_FIRE_QUERY_LIMIT = 500;

// ---------------------------------------------------------------------------
// computeDismissalRate(db, roomState) -> { rate, sample_size, throttled }
//
// Counts strategy_proposed rows in the trailing STRATEGY_FIRE_WINDOW, and the
// subset whose corresponding f_selector_decision row (correlated on the
// anchor_node_id + goal_version pair) was a REJECT. Never throws; returns the
// zeroed object on any fault or a null db with no injection.
// ---------------------------------------------------------------------------
function computeDismissalRate(db, roomState) {
  if (roomState && roomState.dismissalRate && typeof roomState.dismissalRate === 'object') {
    const injected = roomState.dismissalRate;
    if (typeof injected.rate === 'number' && typeof injected.sample_size === 'number') {
      return {
        rate: injected.rate,
        sample_size: injected.sample_size,
        throttled: injected.sample_size >= STRATEGY_MIN_SAMPLE && injected.rate > STRATEGY_DISMISSAL_THRESHOLD,
      };
    }
  }
  if (!db) return { rate: 0, sample_size: 0, throttled: false };
  try {
    const proposed = navigation.findRecentChanges(db, 0, {
      eventType: 'strategy_proposed', limit: STRATEGY_FIRE_QUERY_LIMIT,
    }) || [];
    const windowFires = proposed.slice(0, STRATEGY_FIRE_WINDOW);
    const sample = windowFires.length;
    const fireKeys = new Set();
    windowFires.forEach(function (e) {
      const p = e && e.properties;
      if (p && typeof p.anchor_node_id === 'string' && typeof p.goal_version === 'number') {
        fireKeys.add(p.anchor_node_id + ':' + p.goal_version);
      }
    });
    const decisions = navigation.findRecentChanges(db, 0, {
      eventType: 'f_selector_decision', limit: STRATEGY_FIRE_QUERY_LIMIT,
    }) || [];
    let dismissedInWindow = 0;
    decisions.forEach(function (e) {
      const p = e && e.properties;
      if (!p || typeof p.anchor_node_id !== 'string' || typeof p.goal_version !== 'number') return;
      const key = p.anchor_node_id + ':' + p.goal_version;
      const isReject = p.decision === 'reject' || p.edge_semantic === 'REJECTED';
      if (isReject && fireKeys.has(key)) dismissedInWindow += 1;
    });
    const rate = sample > 0 ? dismissedInWindow / sample : 0;
    const throttled = sample >= STRATEGY_MIN_SAMPLE && rate > STRATEGY_DISMISSAL_THRESHOLD;
    return { rate: rate, sample_size: sample, throttled: throttled };
  } catch (_err) {
    return { rate: 0, sample_size: 0, throttled: false };
  }
}

// ---------------------------------------------------------------------------
// isThrottled(db, roomState, counts) -> { throttled, reason, rate, sample_size }
//
// Evaluates the three mechanisms in a FIXED order (see module header) and
// returns the FIRST that trips. counts is the flat scalar bag
// goal-cadence.cjs::computeStrategyCounts returns (or an equivalent hand-built
// one, for a db-free unit test); counts.reaches_since absent or non-numeric
// means "no reliable reaches-since-last-proposal reading" and the hard-floor
// mechanism is skipped rather than assumed tripped (absence is not a signal,
// mirroring readStallSignal's own null-default contract).
// ---------------------------------------------------------------------------
function isThrottled(db, roomState, counts) {
  try {
    const c = (counts && typeof counts === 'object') ? counts : {};
    const reachesSinceLastProposal = typeof c.reaches_since === 'number' ? c.reaches_since : null;

    if (reachesSinceLastProposal !== null && reachesSinceLastProposal < goalCadence.STRATEGY_MIN_INTERVAL_REACHES) {
      return { throttled: true, reason: 'min_interval', rate: 0, sample_size: 0 };
    }

    const dismissal = computeDismissalRate(db, roomState);
    if (dismissal.sample_size >= STRATEGY_MIN_SAMPLE && dismissal.rate > STRATEGY_DISMISSAL_THRESHOLD) {
      return { throttled: true, reason: 'dismissal_rate', rate: dismissal.rate, sample_size: dismissal.sample_size };
    }

    const rejectCount = reachRejectReader.rejectCountInWindow(db, STRATEGY_REACH_ID, roomState);
    if (rejectCount >= STRATEGY_REJECT_SUPPRESS_AT) {
      return { throttled: true, reason: 'reject_suppression', rate: 0, sample_size: rejectCount };
    }

    return { throttled: false, reason: null, rate: dismissal.rate, sample_size: dismissal.sample_size };
  } catch (_err) {
    return { throttled: false, reason: null, rate: 0, sample_size: 0 };
  }
}

// _thresholdForReason -- the threshold constant matching a given reason enum,
// so emitThrottleEvent's payload states the actual number the mechanism
// tripped against, never a hardcoded stand-in.
function _thresholdForReason(reason) {
  if (reason === 'min_interval') return goalCadence.STRATEGY_MIN_INTERVAL_REACHES;
  if (reason === 'dismissal_rate') return STRATEGY_DISMISSAL_THRESHOLD;
  if (reason === 'reject_suppression') return STRATEGY_REJECT_SUPPRESS_AT;
  return null;
}

// ---------------------------------------------------------------------------
// emitThrottleEvent(db, result) -- writes exactly one strategy_throttled
// memory_event via the navigation.cjs chokepoint. Never opens a database
// itself (the caller's handle). Payload shape fixed by memory-events.cjs's
// own additive-extension comment.
// ---------------------------------------------------------------------------
function emitThrottleEvent(db, result) {
  const safeResult = (result && typeof result === 'object') ? result : {};
  const reason = typeof safeResult.reason === 'string' ? safeResult.reason : null;
  const payload = {
    reason: reason,
    rate: typeof safeResult.rate === 'number' ? safeResult.rate : 0,
    sample_size: typeof safeResult.sample_size === 'number' ? safeResult.sample_size : 0,
    threshold: _thresholdForReason(reason),
    throttled_at: Date.now(),
    source_path: 'system:strategy-throttle',
    created_by: 'system',
  };
  return navigation.logMemoryEvent(db, 'strategy_throttled', payload);
}

module.exports = {
  computeDismissalRate: computeDismissalRate,
  isThrottled: isThrottled,
  emitThrottleEvent: emitThrottleEvent,
  STRATEGY_DISMISSAL_THRESHOLD: STRATEGY_DISMISSAL_THRESHOLD,
  STRATEGY_FIRE_WINDOW: STRATEGY_FIRE_WINDOW,
  STRATEGY_MIN_SAMPLE: STRATEGY_MIN_SAMPLE,
  STRATEGY_REJECT_SUPPRESS_AT: STRATEGY_REJECT_SUPPRESS_AT,
};
