'use strict';
/*
 * Phase 120-01 Wave 2 Task 3 -- the 5-component breakthrough scoring formula +
 * rankBreakthroughs + pickTopWithAffordance + getUserEngagementPrior +
 * isThrottledKind. Per CONTEXT.md D-11..D-12 + D-19 verbatim:
 *
 *   score = (confidence x 0.4)
 *         + (recency_decay x 0.2)        // half-life ~3 days
 *         + (differential x 0.2)
 *         + (artifact_count_log x 0.1)   // clamped [0, 1]
 *         + (user_engagement_prior x 0.1) // per-detector-type Laplace-smoothed prior
 *
 * Tunable via config.json; the weights are the documented defaults (NOT magic
 * numbers). Sum of weights MUST equal 1.0 (verified by SCORING_WEIGHTS unit test).
 *
 * Canon Part 8: ALL reads from breakthrough_confirmed / breakthrough_dismissed
 *   / breakthrough_surfaced events stay LOCAL to the room.db. NO cross-room
 *   aggregation. NO Brain coupling. NO require of brain-client. NO fetch to
 *   brain.mindrian.* domain.
 *
 * Canon Part 9: ALL reads route through navigation.findRecentChanges chokepoint.
 *   No direct sqlite reads in scoring.cjs (defense in depth on top of room-db.cjs
 *   allow-list). Test 12 source-greps this invariant.
 *
 * Canon Part 10 sub-claim 5: variable reward fires automatically; the score IS
 *   the math. The 5 components are deterministic functions of room state -- no
 *   stochastic surfacing, no engagement-optimizer drift.
 *
 * Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): use "--" not the U+2014
 *   character anywhere in this file (comments, log lines, strings).
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant). Reads route
 * through ../navigation.cjs::findRecentChanges (the only Canon Part 9-compliant
 * door for memory_event queries).
 */

const navigation = require('../navigation.cjs');

// CONTEXT.md D-12 verbatim lock. Object.freeze prevents accidental mutation of
// the canonical weight map; if a downstream caller needs a mutable copy they
// must clone explicitly. The 5 weights MUST sum to exactly 1.0 (Test 1 asserts
// this within 1e-9 floating-point tolerance).
const SCORING_WEIGHTS = Object.freeze({
  confidence: 0.4,
  recency: 0.2,
  differential: 0.2,
  artifact_count_log: 0.1,
  user_engagement_prior: 0.1,
});

// CONTEXT.md D-12 verbatim: recency half-life ~3 days. The exponential-decay
// kernel is exp(-ageDays / RECENCY_HALF_LIFE_DAYS); 3-day-old fires decay to
// exp(-1) ~= 0.368, 6-day-old fires decay to exp(-2) ~= 0.135.
const RECENCY_HALF_LIFE_DAYS = 3;

// Neutral-prior return value when getUserEngagementPrior has no history to
// learn from (or graceful degradation path on chokepoint failure). The +0.5
// Laplace smoothing pivots around this midpoint.
const ENGAGEMENT_NEUTRAL_PRIOR = 0.5;

// CONTEXT.md D-19 verbatim: per-detector dismissal-rate canary. If a detector's
// dismiss rate over the rolling D19_FIRE_WINDOW most-recent fires exceeds
// D19_DISMISSAL_THRESHOLD, isThrottledKind returns true (Plan 120-02 scanner
// then auto-throttles that detector to soft-fire-only until manually reviewed).
//
// D19_MIN_SAMPLE prevents premature throttling on small populations: a 1-of-2
// dismiss = 50% would otherwise trip the canary on essentially noise. The
// floor of 10 ensures statistical adequacy before throttling kicks in.
const D19_DISMISSAL_THRESHOLD = 0.30;
const D19_FIRE_WINDOW = 100;
const D19_MIN_SAMPLE = 10;

// Per-kind engagement-prior + canary window. Reads memory_event rows from the
// trailing 90 days; older history is considered stale and excluded from the
// learning signal.
const PRIOR_WINDOW_DAYS = 90;
const PRIOR_QUERY_LIMIT = 500;

const DAY_MS = 24 * 3600 * 1000;

// ---------------------------------------------------------------------------
// recencyDecay -- exp(-ageDays / RECENCY_HALF_LIFE_DAYS). Clamped to [0, 1].
// Future-dated candidates (ageMs < 0) clamp to age=0 (decay=1.0); they never
// produce a decay > 1.0 even on clock skew.
// ---------------------------------------------------------------------------
function recencyDecay(detected_at, nowMs) {
  const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
  const ts = (typeof detected_at === 'number' && Number.isFinite(detected_at)) ? detected_at : now;
  const ageMs = Math.max(0, now - ts);
  const ageDays = ageMs / DAY_MS;
  const decay = Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS);
  // Defense in depth: clamp to [0, 1] in case of floating-point edge cases.
  return Math.min(1, Math.max(0, decay));
}

// ---------------------------------------------------------------------------
// artifactCountLog -- log10(N) clamped to [0, 1]. CONTEXT.md D-12 specifies
// the component is bounded so a 100-artifact convergence can't dominate the
// score. log10(1)=0, log10(10)=1.0 (the ceiling), log10(100)=2.0 -> clamped 1.
// ---------------------------------------------------------------------------
function artifactCountLog(artifact_ids) {
  if (!Array.isArray(artifact_ids)) return 0;
  const n = artifact_ids.length;
  if (n <= 0) return 0;
  const raw = Math.log10(n);
  return Math.min(1, Math.max(0, raw));
}

// ---------------------------------------------------------------------------
// getUserEngagementPrior -- per-detector-kind Laplace-smoothed prior in [0, 1].
//
// Reads via navigation.findRecentChanges (Canon Part 9 chokepoint). Filters
// the recent breakthrough_confirmed + breakthrough_dismissed events by kind
// (extracted from properties.kind on each memory_event row).
//
// Smoothing formula: (confirmed + 0.5) / (confirmed + dismissed + 1)
//   - empty history (0 confirmed + 0 dismissed): 0.5/1 = 0.5 (neutral)
//   - 3 confirmed + 0 dismissed: 3.5/4 = 0.875 (pushed up)
//   - 1 confirmed + 4 dismissed: 1.5/6 = 0.25  (pushed down)
//
// The +0.5 / +1 form pivots around the neutral midpoint and avoids the
// division-by-zero failure mode of a naive ratio.
//
// Graceful degradation: missing/invalid roomState -> neutral 0.5. Chokepoint
// throw (e.g., db handle closed) -> neutral 0.5. The prior must NEVER throw
// from scoreBreakthrough's hot path.
// ---------------------------------------------------------------------------
function getUserEngagementPrior(kind, roomState) {
  try {
    if (!roomState || !roomState.db) return ENGAGEMENT_NEUTRAL_PRIOR;
    const since = Date.now() - (PRIOR_WINDOW_DAYS * DAY_MS);
    const confirmed = navigation.findRecentChanges(roomState.db, since, {
      eventType: 'breakthrough_confirmed',
      limit: PRIOR_QUERY_LIMIT,
    }) || [];
    const dismissed = navigation.findRecentChanges(roomState.db, since, {
      eventType: 'breakthrough_dismissed',
      limit: PRIOR_QUERY_LIMIT,
    }) || [];
    const cConfirmed = confirmed.filter((e) => e.properties && e.properties.kind === kind).length;
    const cDismissed = dismissed.filter((e) => e.properties && e.properties.kind === kind).length;
    return (cConfirmed + 0.5) / (cConfirmed + cDismissed + 1);
  } catch (_e) {
    return ENGAGEMENT_NEUTRAL_PRIOR;
  }
}

// ---------------------------------------------------------------------------
// isThrottledKind -- CONTEXT.md D-19 dismissal-rate canary.
//
// Returns true if the per-kind dismissal rate over the rolling D19_FIRE_WINDOW
// most-recent fires exceeds D19_DISMISSAL_THRESHOLD (with D19_MIN_SAMPLE floor
// to avoid throttling on small populations).
//
// Implementation:
//   1. Read breakthrough_surfaced + breakthrough_dismissed events for the kind
//      via navigation.findRecentChanges (Canon Part 9 chokepoint).
//   2. Take the most-recent D19_FIRE_WINDOW surfaces for the kind.
//   3. Match dismisses against the surfaced breakthrough_ids (only dismisses
//      that targeted a fire in the window count).
//   4. If fired.length < D19_MIN_SAMPLE, return false (statistical floor).
//   5. Compute rate = dismissed_in_window / fired.length. Return rate > D19_DISMISSAL_THRESHOLD.
//
// Graceful degradation: missing/invalid roomState -> false (not throttled).
// Chokepoint throw -> false (fail-open; never lock out a detector on infra hiccup).
// ---------------------------------------------------------------------------
function isThrottledKind(kind, roomState) {
  try {
    if (!roomState || !roomState.db) return false;
    const since = Date.now() - (PRIOR_WINDOW_DAYS * DAY_MS);
    const surfaced = navigation.findRecentChanges(roomState.db, since, {
      eventType: 'breakthrough_surfaced',
      limit: PRIOR_QUERY_LIMIT,
    }) || [];
    const dismissed = navigation.findRecentChanges(roomState.db, since, {
      eventType: 'breakthrough_dismissed',
      limit: PRIOR_QUERY_LIMIT,
    }) || [];
    // Filter by kind and take most-recent D19_FIRE_WINDOW fires (findRecentChanges
    // already returns rows ORDER BY created_at DESC).
    const fired = surfaced
      .filter((e) => e.properties && e.properties.kind === kind)
      .slice(0, D19_FIRE_WINDOW);
    if (fired.length < D19_MIN_SAMPLE) return false;
    // Match dismisses against the in-window fire ids. Only dismisses that target
    // a fire in the window count; a dismiss for an out-of-window fire is noise.
    const fireIds = new Set(
      fired
        .map((e) => e.properties && e.properties.breakthrough_id)
        .filter((id) => typeof id === 'string' && id.length > 0)
    );
    const dismissedInWindow = dismissed.filter(
      (e) => e.properties && e.properties.kind === kind &&
             typeof e.properties.breakthrough_id === 'string' &&
             fireIds.has(e.properties.breakthrough_id)
    ).length;
    const rate = dismissedInWindow / fired.length;
    return rate > D19_DISMISSAL_THRESHOLD;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// scoreBreakthrough -- the 5-component formula (CONTEXT.md D-12 verbatim).
//
// score = W.confidence * candidate.confidence
//       + W.recency * recencyDecay(candidate.detected_at, nowMs)
//       + W.differential * candidate.differential
//       + W.artifact_count_log * artifactCountLog(candidate.artifact_ids)
//       + W.user_engagement_prior * getUserEngagementPrior(candidate.kind, roomState)
//
// Each component is independently bounded; the weighted sum is bounded in [0, 1]
// (assuming candidate.confidence and candidate.differential are themselves in
// [0, 1] -- the detectors enforce this via the buildCandidate clip in Plan 120-00).
//
// Graceful degradation: null/non-object candidate -> 0. Missing fields default
// to 0 (or to nowMs for detected_at -> decay=1.0). The function must NEVER throw.
// ---------------------------------------------------------------------------
function scoreBreakthrough(candidate, roomState, nowMs) {
  if (!candidate || typeof candidate !== 'object') return 0;
  const conf = (typeof candidate.confidence === 'number') ? candidate.confidence : 0;
  const diff = (typeof candidate.differential === 'number') ? candidate.differential : 0;
  const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
  const recency = recencyDecay(
    (typeof candidate.detected_at === 'number') ? candidate.detected_at : now,
    now
  );
  const acLog = artifactCountLog(candidate.artifact_ids);
  const engagement = getUserEngagementPrior(candidate.kind, roomState);
  const W = SCORING_WEIGHTS;
  return (W.confidence * conf)
    + (W.recency * recency)
    + (W.differential * diff)
    + (W.artifact_count_log * acLog)
    + (W.user_engagement_prior * engagement);
}

// ---------------------------------------------------------------------------
// rankBreakthroughs -- stable sort by score descending; ties broken by
// detected_at descending (newer wins). Each ranked item is shallow-cloned with
// a numeric `score` property attached.
// ---------------------------------------------------------------------------
function rankBreakthroughs(candidates, roomState, nowMs) {
  if (!Array.isArray(candidates)) return [];
  const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
  const scored = candidates.map(function (c) {
    return { candidate: c, score: scoreBreakthrough(c, roomState, now) };
  });
  scored.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: newer detected_at wins (descending). Missing detected_at sorts
    // last (treat as 0).
    const aTs = (a.candidate && typeof a.candidate.detected_at === 'number') ? a.candidate.detected_at : 0;
    const bTs = (b.candidate && typeof b.candidate.detected_at === 'number') ? b.candidate.detected_at : 0;
    return bTs - aTs;
  });
  return scored.map(function (s) {
    return Object.assign({}, s.candidate, { score: s.score });
  });
}

// ---------------------------------------------------------------------------
// pickTopWithAffordance -- CONTEXT.md D-11 verbatim: surface the top-1; expose
// the rest as a "More breakthroughs (N)" affordance count + the queued list.
//
// Returns { top: <highest-scoring | null>, more_count: <N | 0>, queued: <[]> }.
// ---------------------------------------------------------------------------
function pickTopWithAffordance(candidates, roomState, nowMs) {
  const ranked = rankBreakthroughs(candidates, roomState, nowMs);
  if (ranked.length === 0) return { top: null, more_count: 0, queued: [] };
  return {
    top: ranked[0],
    more_count: ranked.length - 1,
    queued: ranked.slice(1),
  };
}

module.exports = {
  scoreBreakthrough: scoreBreakthrough,
  rankBreakthroughs: rankBreakthroughs,
  pickTopWithAffordance: pickTopWithAffordance,
  getUserEngagementPrior: getUserEngagementPrior,
  isThrottledKind: isThrottledKind,
  recencyDecay: recencyDecay,
  artifactCountLog: artifactCountLog,
  SCORING_WEIGHTS: SCORING_WEIGHTS,
  RECENCY_HALF_LIFE_DAYS: RECENCY_HALF_LIFE_DAYS,
  ENGAGEMENT_NEUTRAL_PRIOR: ENGAGEMENT_NEUTRAL_PRIOR,
  D19_DISMISSAL_THRESHOLD: D19_DISMISSAL_THRESHOLD,
  D19_FIRE_WINDOW: D19_FIRE_WINDOW,
  D19_MIN_SAMPLE: D19_MIN_SAMPLE,
};
