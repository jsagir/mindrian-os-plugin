/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 213-01 -- the Arrival grader (SEED-050 Judge 1), verdict-by-code.
 *
 * gradeArrival({ subClaimsReached, subClaimsTotal, luredDistractor }) ->
 *   { verdict, credit }
 *
 * THE SPLIT (the 212 D2 idiom, mirrored not imported): the verdict enum is
 * computed BY CODE from boolean/scalar item inputs. Any LLM pass (the session
 * judge that reads a transcript and decides how many sub-claims were reached and
 * whether the run fell for a seeded distractor) happens OUTSIDE this module; its
 * per-item outputs are the INPUTS here. Raw transcript text never enters this file
 * (T-213-01: judged scalars cross, transcript does not).
 *
 * Judge 1 (SEED-050):
 *   - Full    : every sub-claim of the destination reached (credit 1).
 *   - Partial : some reached; credit = sub-claims reached / total.
 *   - Missed  : none reached (credit 0).
 *   - Lured   : fell for a seeded distractor. This DOMINATES the sub-claim count
 *               (a run that reaches sub-claims but takes the lure is Lured, not
 *               Full). The Lured verdict is NEGATIVE downstream: its consumer is
 *               lib/core/eureka/compression-meter.cjs, whose compressionScore turns
 *               a Lured arrival into a strictly-negative score (SEED-050:
 *               "Lured = negative, not zero"). This module carries no meter math;
 *               it only names the verdict the meter penalizes.
 *
 * HOME (flagged Decision-Gate recommendation, RESEARCH Open Question 1): this is
 * the EVAL-SIDE home under lab/eureka-graders/ (mirroring the 202 lab/apo
 * precedent). MCP-servable packaging of the judge family (SEED-050:102-105) is a
 * FUTURE lift for the consolidation arc's critic-MCP step, not built here.
 *
 * Calibration anchor: evals/eureka/ is the gold baseline (211-04).
 *
 * Pure, sync, zero-I/O, never throws. Node built-ins only, CJS, hyphens only.
 */
'use strict';

// Frozen closed enum: the only four arrival verdicts. Order is load-bearing
// (Full/Partial/Missed/Lured); tests pin it exactly.
const ARRIVAL_VERDICTS = Object.freeze(['Full', 'Partial', 'Missed', 'Lured']);

// ---------------------------------------------------------------------------
// toCount -- defensive non-negative integer coercion. Non-finite / negative /
// non-numeric -> 0. Never throws.
// ---------------------------------------------------------------------------

function toCount(x) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) return 0;
  return Math.floor(x);
}

// ---------------------------------------------------------------------------
// gradeArrival(item) -> { verdict, credit }
//
// credit = sub-claims reached / total, clamped to [0,1] (0 when total <= 0).
// verdict:
//   - luredDistractor truthy            -> 'Lured'  (dominates the count)
//   - total > 0 and reached >= total    -> 'Full'   (credit 1)
//   - reached > 0                        -> 'Partial'
//   - otherwise                          -> 'Missed' (credit 0)
// ---------------------------------------------------------------------------

function gradeArrival(item) {
  const spec = (item && typeof item === 'object') ? item : {};
  const total = toCount(spec.subClaimsTotal);
  const reachedRaw = toCount(spec.subClaimsReached);
  // A run cannot reach more sub-claims than exist.
  const reached = total > 0 ? Math.min(reachedRaw, total) : 0;
  const credit = total > 0 ? reached / total : 0;

  // Falling for a seeded distractor dominates the outcome (SEED-050 Judge 1).
  if (spec.luredDistractor) {
    return { verdict: 'Lured', credit: credit };
  }
  if (total > 0 && reached >= total) {
    return { verdict: 'Full', credit: 1 };
  }
  if (reached > 0) {
    return { verdict: 'Partial', credit: credit };
  }
  return { verdict: 'Missed', credit: 0 };
}

module.exports = {
  ARRIVAL_VERDICTS: ARRIVAL_VERDICTS,
  gradeArrival: gradeArrival,
};
