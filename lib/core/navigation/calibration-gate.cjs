'use strict';
// Phase 177-08 (BCH-15 / BCH-CAL) -- the calibration gate that CAN FAIL.
//
// BCH-CAL is a HARNESS proven on SYNTHETIC datasets. Its headline is the FAIL
// path: a flat reliability dataset (per-cue_type ROC-AUC ~0.5) makes the Step-0
// DISCRIMINATION GATE fail BEFORE any curve-fit runs, so no floor/ceiling is
// pinned, no isotonic/Platt fit is attempted, the Wave-4 arming flag stays
// LOCKED, and a rework signal is emitted. A complementary discriminating dataset
// proves the gate also PASSES -- it is not a gate that always fails. A gate that
// cannot fail is not a gate.
//
// CHANGE-CONTROL RULE (D-9 / BCH-15): AUC_MIN and SLOPE_MIN are JUDGMENT-SET
// constants. They are NEVER derived from the dataset (no percentile, no sweep, no
// computed statistic). They may NEVER be lowered to unblock a wave. The
// change-control test asserts they are byte-identical even when run against a
// sub-threshold dataset, so the gate cannot lower its own bar to pass weak data.
//
// DEFERRED + HONEST: the LIVE calibration -- pinning the real behavioral-channel
// floor/ceiling from accumulated shadow usage via a real isotonic/Platt fit -- is
// DEFERRED until real shadow data and a ground-truth-labeling mechanism exist. The
// shipped calibration_observations table (Phase 177-05) carries no
// ground_truth_label column today, so the harness operates on EXPLICIT synthetic
// observation arrays (label + confidence supplied). We do NOT fabricate a pass on
// empty or synthetic data for the live thresholds. The gate must be ALLOWED to
// fail, never faked to pass.
//
// Canon Part 8: this module reads ONLY the LOCAL engine constants and a passed-in
// observation array. It opens NO Brain wire, mints no reach, and leaves
// routing_source legacy (this wave still fires nothing semantic). Frozen sets
// (the 6 reaches, the 3 postures, ALLOWED_EDGE_TYPES) are untouched.

// The engine-owned floor/ceiling, read from their home rather than re-typed --
// mirroring the calibration-log.cjs require idiom exactly so the gate can never
// drift from the ranker's notion of FLOOR / CEILING (NO threshold literal lands
// in a prompt; BCH-05). A PASS verdict PROPOSES pinning these; the harness reports
// them but does NOT itself rewrite the ranker (live threshold-pinning is deferred).
const {
  BEHAVIORAL_CHANNEL_FLOOR,
  BEHAVIORAL_CHANNEL_CEILING,
} = require('../../workflow/f-selector-ranker.cjs');

// JUDGMENT-SET constants. Hand-set by judgment, NEVER swept from data. See the
// CHANGE-CONTROL RULE at the top of this file. Lowering either to unblock a wave
// is forbidden.
const AUC_MIN = 0.65;
const SLOPE_MIN = 0.15;

// The Wave-4 arming flag, default LOCKED. The harness NEVER mutates this constant
// to true; a PASS verdict only RETURNS the permission to arm (armed_allowed:true).
// Locked-by-default means Waves 4-5 stay blocked until the gate honestly PASSES.
const BEHAVIORAL_CHANNEL_ARMED = false;

/**
 * ROC-AUC of raw_confidence vs ground_truth_label via the Mann-Whitney U rank-sum
 * identity:  AUC = (sumRanksPos - nPos*(nPos+1)/2) / (nPos*nNeg), averaging the
 * ranks of tied scores. Returns 0.5 (chance) when there are zero positives or zero
 * negatives -- no discrimination is possible, so a flat/degenerate dataset reads as
 * chance and FAILS the gate.
 *
 * @param {Array<{raw_confidence:number, ground_truth_label:0|1}>} observations
 * @returns {number} AUC in [0,1]
 */
function rocAuc(observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return 0.5;
  }

  // Sort by score ascending, then assign average ranks (1-based), tie-averaged.
  const rows = observations
    .map((o) => ({
      score: typeof o.raw_confidence === 'number' ? o.raw_confidence : 0,
      label: o.ground_truth_label === 1 ? 1 : 0,
    }))
    .sort((a, b) => a.score - b.score);

  const n = rows.length;
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && rows[j + 1].score === rows[i].score) {
      j++;
    }
    // ranks are 1-based; average rank for the tie block [i..j].
    const avgRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) {
      ranks[k] = avgRank;
    }
    i = j + 1;
  }

  let nPos = 0;
  let nNeg = 0;
  let sumRanksPos = 0;
  for (let k = 0; k < n; k++) {
    if (rows[k].label === 1) {
      nPos++;
      sumRanksPos += ranks[k];
    } else {
      nNeg++;
    }
  }

  if (nPos === 0 || nNeg === 0) {
    return 0.5; // no discrimination possible -- chance.
  }

  return (sumRanksPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/**
 * Reliability-diagram slope: bin observations by raw_confidence (default 10
 * equal-width bins on [0,1]), compute per-bin mean predicted confidence (x) and
 * observed positive frequency (y), then the least-squares slope of y on x over
 * non-empty bins. A flat reliability curve (observed frequency does not track
 * predicted confidence) yields slope ~0, which FAILS SLOPE_MIN.
 *
 * @param {Array<{raw_confidence:number, ground_truth_label:0|1}>} observations
 * @param {number} [bins=10]
 * @returns {number} least-squares slope
 */
function reliabilitySlope(observations, bins) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return 0;
  }
  const nBins = Number.isInteger(bins) && bins > 0 ? bins : 10;

  const sumX = new Array(nBins).fill(0); // sum of predicted confidence per bin
  const sumY = new Array(nBins).fill(0); // sum of labels (positive count) per bin
  const cnt = new Array(nBins).fill(0);

  for (const o of observations) {
    const c = typeof o.raw_confidence === 'number' ? o.raw_confidence : 0;
    const label = o.ground_truth_label === 1 ? 1 : 0;
    let b = Math.floor(c * nBins);
    if (b < 0) b = 0;
    if (b >= nBins) b = nBins - 1; // confidence == 1.0 lands in the top bin
    sumX[b] += c;
    sumY[b] += label;
    cnt[b] += 1;
  }

  // Per non-empty bin: x = mean predicted confidence, y = observed positive freq.
  const xs = [];
  const ys = [];
  for (let b = 0; b < nBins; b++) {
    if (cnt[b] > 0) {
      xs.push(sumX[b] / cnt[b]);
      ys.push(sumY[b] / cnt[b]);
    }
  }

  const m = xs.length;
  if (m < 2) {
    return 0; // a single populated bin cannot express a slope.
  }

  let meanX = 0;
  let meanY = 0;
  for (let k = 0; k < m; k++) {
    meanX += xs[k];
    meanY += ys[k];
  }
  meanX /= m;
  meanY /= m;

  let num = 0;
  let den = 0;
  for (let k = 0; k < m; k++) {
    const dx = xs[k] - meanX;
    num += dx * (ys[k] - meanY);
    den += dx * dx;
  }

  if (den === 0) {
    return 0; // all bins share one predicted-confidence value -- no slope.
  }

  return num / den;
}

/**
 * Step-0 DISCRIMINATION GATE. Input is a map of cue_type -> observation array. For
 * each cue_type compute auc = rocAuc(rows) and slope = reliabilitySlope(rows). A
 * cue_type PASSES iff auc >= AUC_MIN AND slope >= SLOPE_MIN. Overall pass is true
 * iff EVERY cue_type passes.
 *
 * @param {Object<string, Array>} observationsByCueType
 * @returns {{pass:boolean, perCueType:Object, failingCueTypes:string[]}}
 */
function runDiscriminationGate(observationsByCueType) {
  const perCueType = {};
  const failingCueTypes = [];

  const map = observationsByCueType && typeof observationsByCueType === 'object'
    ? observationsByCueType
    : {};
  const cueTypes = Object.keys(map);

  // An empty map cannot demonstrate discrimination -- it FAILS (never fakes a pass
  // on no data). Each present cue_type is graded against the judgment-set bars.
  let overallPass = cueTypes.length > 0;

  for (const cueType of cueTypes) {
    const rows = Array.isArray(map[cueType]) ? map[cueType] : [];
    const auc = rocAuc(rows);
    const slope = reliabilitySlope(rows);
    const pass = auc >= AUC_MIN && slope >= SLOPE_MIN;
    perCueType[cueType] = { auc, slope, pass };
    if (!pass) {
      failingCueTypes.push(cueType);
      overallPass = false;
    }
  }

  return { pass: overallPass, perCueType, failingCueTypes };
}

/**
 * BCH-CAL entry point. MUST run runDiscriminationGate FIRST, before any curve-fit.
 *
 * On Step-0 FAIL: returns immediately with no fit attempted and no thresholds
 * pinned -- { pass:false, stage:'discrimination', floor:null, ceiling:null,
 * fit:null, armed_allowed:false, rework_signal:{...} }.
 *
 * On Step-0 PASS: returns { pass:true, stage:'calibrated', floor, ceiling,
 * fit:{method:'deferred', ...}, armed_allowed:true, rework_signal:null }. The
 * fit.method:'deferred' is deliberate and honest -- the LIVE isotonic/Platt fit on
 * real accumulated shadow data is DEFERRED until that data and a
 * ground-truth-labeling mechanism exist. The harness proves the GATE DIRECTION
 * (fail vs pass) on synthetic data; it does NOT fabricate a real fit.
 *
 * @param {Object<string, Array>} observationsByCueType
 */
function runCalibrationGate(observationsByCueType) {
  const discrimination = runDiscriminationGate(observationsByCueType);

  if (!discrimination.pass) {
    // FAIL: no isotonic/Platt fit, no floor/ceiling pinned, flag stays LOCKED.
    return {
      pass: false,
      stage: 'discrimination',
      floor: null,
      ceiling: null,
      fit: null,
      armed_allowed: false,
      discrimination,
      rework_signal: {
        reason: 'discrimination_gate_failed',
        failing_cue_types: discrimination.failingCueTypes,
        per_cue_type: discrimination.perCueType,
      },
    };
  }

  // PASS: the Step-0 gate cleared. The harness REPORTS the engine-owned
  // floor/ceiling a live fit would PROPOSE pinning, but the live fit itself is
  // DEFERRED (see fit.method) -- the harness does not rewrite the ranker.
  return {
    pass: true,
    stage: 'calibrated',
    floor: BEHAVIORAL_CHANNEL_FLOOR,
    ceiling: BEHAVIORAL_CHANNEL_CEILING,
    fit: {
      method: 'deferred',
      note: 'Live isotonic/Platt fit on real accumulated shadow data is DEFERRED '
        + 'until ground-truth-labeled shadow observations exist; the harness proves '
        + 'the gate direction on synthetic data, it does not fabricate a real fit.',
    },
    armed_allowed: true,
    discrimination,
    rework_signal: null,
  };
}

module.exports = {
  AUC_MIN,
  SLOPE_MIN,
  BEHAVIORAL_CHANNEL_ARMED,
  rocAuc,
  reliabilitySlope,
  runDiscriminationGate,
  runCalibrationGate,
};
