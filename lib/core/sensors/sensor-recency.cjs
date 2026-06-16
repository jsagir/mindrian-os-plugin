'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-03 Task 2 (R6) -- SENS-RECENCY recency-as-reach-signal detector.
 *
 * A net-new STATE-PATTERN detector that makes RECENCY a reach signal in Engine 1
 * (Canon Part 2). When the projected cortex shows a recently-touched node (its
 * recency score, computed by the SHIPPED recency-decay blend, sits inside a recent
 * window), this sensor SURFACES the context_block candidate reach so recently
 * touched context can fire a reach. A recently-touched node yields a higher reach
 * score than an identical stale node (R6 acceptance) because the reach evidence
 * carries the SAME 0.995^(delta-h) recency score Leg D ranks by.
 *
 * REUSE BEFORE BUILD (Canon Part 7): the recency capability is SHIPPED in this
 * very phase -- lib/core/temporal/recency-decay.cjs (recencyScore / rankByRecency)
 * + the Phase 150-04 / 160-03 Leg D cortex projection. This sensor does NOT re-run
 * Leg D and does NOT read room.db. It CONSUMES the LOCAL recency scalars threaded
 * on ctx by the Leg D producer and surfaces the DISPATCH HANDLE only; the navigator
 * approves at the Decision Gate (Canon Part 3) before the orchestrator reads the
 * cortex. It reuses recencyScore so the sensor score and the Leg D ranking agree.
 *
 * FROZEN CONTRACTS (honoring the 148/150.8 lockstep): this sensor mints NO new
 * reach_id and NO new EVENT_TYPE. It reuses the existing 'context_block' reach
 * (the LOCAL in-process context surface, the same reach sensorFirstMaterial and
 * sensorLaggingComponent fire) and the existing reach_presented event. The frozen
 * 6-reach bank and the EVENT_TYPES set are UNCHANGED.
 *
 * The LOCAL recency scalars it reads from ctx (all LOCAL scalars, produced by the
 * Leg D / 160-03 producer; never user content):
 *   - ctx.recencyScore           : number in (0, 1] -- the top cortex node's
 *                                  0.995^(delta-h) decay score (preferred input).
 *   - ctx.mostRecentAgeHours     : number -- age in hours of the most recently
 *                                  touched cortex node (fallback when no score).
 *   - ctx.recentCortexCount      : number -- how many cortex nodes fall inside the
 *                                  recent window (optional LOCAL evidence count).
 * A score at/above RECENT_SCORE_THRESHOLD (equivalently an age at/below the recent
 * window) fires the reach. Neither a node id, a node type, nor any prose ever
 * rides the reach -- only the recency scalar.
 *
 * Reach: context_block (the LOCAL in-process context reach -- recency is a LOCAL
 * signal, never a Brain or web surface). Posture push_forward: a fresh cortex
 * signal is forward momentum -- bring the recently-touched context forward to the
 * Decision Gate, then push through with the navigator's call.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide(). The routing fence over
 * lib/core/sensors/ asserts this. It soft-fails to null on a malformed/empty ctx
 * (never throws -- one bad sensor cannot poison dispatchSensors).
 *
 * Canon Part 8: the sensor reads ONLY enum/scalar ctx signals and emits only a
 * recency score + a count scalar; it carries no cortex prose, no node id, no claim
 * body. The Part-8 sensor sweep auto-covers every lib/core/sensors/*.cjs.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');
const { recencyScore } = require('../temporal/recency-decay.cjs');

// The recent-window threshold on the recency score. 0.90 corresponds to roughly
// 21 hours of 0.995^(delta-h) decay -- a node touched within about a day is
// "recent" enough to fire the reach. A higher score means a more-recent node, so
// the comparison is score >= threshold (recent fires; stale does not).
const RECENT_SCORE_THRESHOLD = 0.90;

// The equivalent recent-window in hours, used by the age fallback when ctx carries
// mostRecentAgeHours but no precomputed recencyScore.
const RECENT_WINDOW_HOURS = 21;

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Resolve the recency score from ctx. Prefers an explicit ctx.recencyScore; else
 * derives one from ctx.mostRecentAgeHours via the SHIPPED recencyScore blend (so
 * the sensor score and the Leg D ranking use the identical 0.995^(delta-h) math).
 * Returns null when neither LOCAL scalar is present.
 */
function resolveRecencyScore(ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  if (isFiniteNumber(ctx.recencyScore)) {
    // Clamp into (0, 1] defensively -- a malformed > 1 score is treated as 1.
    if (ctx.recencyScore > 1) return 1;
    if (ctx.recencyScore < 0) return 0;
    return ctx.recencyScore;
  }
  if (isFiniteNumber(ctx.mostRecentAgeHours)) {
    const ageH = ctx.mostRecentAgeHours < 0 ? 0 : ctx.mostRecentAgeHours;
    // Reuse recencyScore by anchoring an age in hours against a zero reference.
    const HOUR_MS = 3600000;
    return recencyScore(-ageH * HOUR_MS, 0);
  }
  return null;
}

/**
 * SENS-RECENCY -- recency -> the LOCAL context_block reach (R6).
 *
 * Fires when the resolved recency score is at/above RECENT_SCORE_THRESHOLD (the
 * most recently touched cortex node is inside the recent window). The reach
 * evidence carries the recency score, so a recently-touched node yields a higher
 * reach score than an identical stale node (R6 acceptance). Soft-fails to null
 * when no recency scalar is present or the node is stale; never throws.
 *
 * @param {object} _turn  -- the turn signal bag (unused; recency is state-driven,
 *                           threaded on ctx by the Leg D producer)
 * @param {object} _tuple -- the /mos:diagnose tuple (unused for detection)
 * @param {object} ctx    -- LOCAL context carrying the recency scalars
 * @returns {Readonly<object>|null}
 */
function sensorRecency(_turn, _tuple, ctx) {
  const score = resolveRecencyScore(ctx);
  if (score == null) return null;
  if (score < RECENT_SCORE_THRESHOLD) return null; // stale node -> no reach

  // Optional LOCAL evidence count: how many cortex nodes are inside the recent
  // window. LOCAL scalar only -- never a node id, type, or body.
  let recentCount = 0;
  if (ctx && isFiniteNumber(ctx.recentCortexCount) && ctx.recentCortexCount > 0) {
    recentCount = ctx.recentCortexCount;
  }

  return makeReach({
    // FROZEN: reuses the existing context_block reach (the LOCAL in-process
    // context surface). Mints NO new reach_id and NO new EVENT_TYPE.
    reach_id: 'context_block',
    posture: 'push_forward',
    // Dispatch names the SHIPPED Leg D cortex-context surface. A handle, not user
    // content -- the recently-touched context is surfaced through the same reach.
    dispatch: 'context-block (recency-ranked cortex)',
    companions: [],
    signal: 'recency',
    // LOCAL scalars only: the recency score (so a recent node outranks a stale
    // one in reach ordering) + the recent-window count. The WHICH never rides.
    evidence: {
      recency_score: score,
      recent_cortex_count: recentCount,
      source: 'recency-decay-160-03',
    },
  });
}

module.exports = {
  sensorRecency: sensorRecency,
  // Exported for the R6 unit assertion (recent outranks stale) + threshold tests.
  RECENT_SCORE_THRESHOLD: RECENT_SCORE_THRESHOLD,
  RECENT_WINDOW_HOURS: RECENT_WINDOW_HOURS,
};
