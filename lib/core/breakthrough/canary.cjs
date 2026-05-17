'use strict';
/*
 * Phase 120-02 Wave 2 Task 1 -- D-19 per-detector dismissal-rate canary. Per
 * CONTEXT.md D-19 verbatim:
 *
 *   Track per-detector dismissal rate over a 100-fire rolling window. If the
 *   rate crosses 30%, auto-throttle that detector to soft-fire-only until
 *   manually reviewed. This is the user-telling-us-with-the-dismiss-button
 *   signal -- catches drift before it shows up in any other metric.
 *
 * STATIC thresholds for v1.13.0 (ML-tuned weights deferred to v1.14.0 per
 * CONTEXT.md OUT OF SCOPE). The auto-throttle recovery surface (the user-facing
 * "this detector needs review" affordance) is deferred to Phase 121
 * housekeeping per CONTEXT.md Deferred Ideas. v1.13.0 only emits the
 * `breakthrough_throttled` event for /mos:doctor to find.
 *
 * Canon Part 8 + Part 9: ALL reads via navigation.cjs::findRecentChanges
 *   chokepoint (Canon Part 9 D-06); pure LOCAL; no Brain coupling.
 *
 * Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): use "--" not U+2014.
 *
 * Pure CJS, node built-ins only, zero deps.
 *
 * Coordination note: scoring.cjs (Plan 120-01 Task 3) also exports the D-19
 * canary constants + isThrottledKind. canary.cjs is the PRIMARY ownership for
 * v1.13.0+ -- scoring.cjs's copy is kept byte-stable for backwards compat with
 * Plan 120-01 acceptance; downstream code should import from canary.cjs going
 * forward. The two surfaces share the same threshold values verbatim.
 */

const navigation = require('../navigation.cjs');

// CONTEXT.md D-19 verbatim lock. Object.freeze is not strictly required for
// primitive numbers (they are immutable by value) but the named exports +
// scaffold-harness shell grep + unit test (Test 15) form the three-layer
// invariant defense.
const D19_DISMISSAL_THRESHOLD = 0.30;
const D19_FIRE_WINDOW = 100;
const D19_MIN_SAMPLE = 10;

// 90-day search window for canary lookups. Older events stay in log but the
// canary considers them stale (mirrors the scoring.cjs PRIOR_WINDOW_DAYS=90).
const CANARY_WINDOW_MS = 90 * 24 * 3600 * 1000;
const CANARY_QUERY_LIMIT = 500;

// computeDismissalRate -- D-19 canary computation for a single detector kind.
//
// Returns { rate, sample_size, throttled }:
//   - rate: dismissed_in_window / sample_size (or 0 if sample_size = 0).
//   - sample_size: number of recent surfaces for kind, capped at D19_FIRE_WINDOW.
//   - throttled: true IFF sample_size >= D19_MIN_SAMPLE AND rate > D19_DISMISSAL_THRESHOLD.
//
// Implementation:
//   1. Read recent breakthrough_surfaced events for the kind (most-recent first).
//   2. Take the top D19_FIRE_WINDOW (the rolling window).
//   3. Read recent breakthrough_dismissed events; match against the in-window
//      surfaced ids (a dismiss for an out-of-window fire is noise).
//   4. Apply the D19_MIN_SAMPLE floor before throttling kicks in (1-of-2 = 50%
//      would otherwise trip the 30% canary on essentially noise).
//
// Graceful degradation: missing/invalid kind or db -> returns the zero-state
// object. Chokepoint throw -> same. Fail-open: never lock out a detector on
// infra hiccup.
function computeDismissalRate(kind, db) {
  try {
    if (!kind || !db) return { rate: 0, sample_size: 0, throttled: false };
    const since = Date.now() - CANARY_WINDOW_MS;
    const surfaced = navigation.findRecentChanges(db, since, {
      eventType: 'breakthrough_surfaced',
      limit: CANARY_QUERY_LIMIT,
    }) || [];
    const dismissed = navigation.findRecentChanges(db, since, {
      eventType: 'breakthrough_dismissed',
      limit: CANARY_QUERY_LIMIT,
    }) || [];
    const kindSurfaced = surfaced
      .filter(function (e) { return e && e.properties && e.properties.kind === kind; })
      .slice(0, D19_FIRE_WINDOW);
    const sample = kindSurfaced.length;
    const fireIds = new Set(
      kindSurfaced
        .map(function (e) { return e.properties && e.properties.breakthrough_id; })
        .filter(function (id) { return typeof id === 'string' && id.length > 0; })
    );
    const dismissedInWindow = dismissed.filter(function (e) {
      return e && e.properties && e.properties.kind === kind &&
             typeof e.properties.breakthrough_id === 'string' &&
             fireIds.has(e.properties.breakthrough_id);
    }).length;
    const rate = sample > 0 ? dismissedInWindow / sample : 0;
    const throttled = sample >= D19_MIN_SAMPLE && rate > D19_DISMISSAL_THRESHOLD;
    return { rate: rate, sample_size: sample, throttled: throttled };
  } catch (_e) {
    return { rate: 0, sample_size: 0, throttled: false };
  }
}

// isThrottled -- thin convenience wrapper. Use computeDismissalRate when the
// caller also needs the rate + sample_size scalars (e.g., for breakthrough_throttled
// event payload). Per-kind isolation is enforced by the kind filter inside
// computeDismissalRate -- one drifting detector cannot throttle siblings.
function isThrottled(kind, db) {
  return computeDismissalRate(kind, db).throttled;
}

// emitThrottleEvent -- writes a breakthrough_throttled memory_event via the
// navigation.cjs chokepoint. Payload carries the canary scalars + a wall-clock
// timestamp + a source_path so /mos:doctor can find throttled detectors at
// session-start.
//
// The auto-throttle recovery surface (the user-facing affordance for unthrottling)
// is DEFERRED to Phase 121 housekeeping. v1.13.0 just persists the signal.
function emitThrottleEvent(kind, db, result) {
  const safeResult = (result && typeof result === 'object') ? result : { rate: 0, sample_size: 0 };
  const payload = {
    kind: kind,
    rate: typeof safeResult.rate === 'number' ? safeResult.rate : 0,
    sample_size: typeof safeResult.sample_size === 'number' ? safeResult.sample_size : 0,
    threshold: D19_DISMISSAL_THRESHOLD,
    throttled_at: Date.now(),
    source_path: 'system:breakthrough-canary',
    created_by: 'system',
  };
  return navigation.logMemoryEvent(db, 'breakthrough_throttled', payload);
}

module.exports = {
  computeDismissalRate: computeDismissalRate,
  isThrottled: isThrottled,
  emitThrottleEvent: emitThrottleEvent,
  D19_DISMISSAL_THRESHOLD: D19_DISMISSAL_THRESHOLD,
  D19_FIRE_WINDOW: D19_FIRE_WINDOW,
  D19_MIN_SAMPLE: D19_MIN_SAMPLE,
};
