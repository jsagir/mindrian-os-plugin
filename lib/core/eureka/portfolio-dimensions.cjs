/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-02 -- portfolio-dimensions: the 3-dimension signal map (215-R2).
 *
 * A pure deterministic CLASSIFIER over already-measured local signals, NOT an
 * engine (215-RESEARCH.md "Net-new" table): it maps the idea-graph node fields
 * and the shipped rs-differential-scorer output into three independent, bounded
 * sub-scores per technology and per pair. It mints no new retrieval path, opens
 * no database, and performs no network I/O. Node built-ins only. No em-dashes.
 *
 * --------------------------------------------------------------------------
 * WHY THREE DIMENSIONS, NEVER ONE FLAT NUMBER (SEED-048 line 32 anti-pattern):
 * --------------------------------------------------------------------------
 * Every candidate carries strategic_fit / validated_demand /
 * tech_econ_feasibility as SEPARATE numbers in [0,1] so the downstream combine
 * logic can reason about WHICH dimension was weak. Collapsing to a single flat
 * score destroys the "three low into one high" reasoning the seed exists to
 * enable. The three keys BYTE-MATCH the ahp-weights.cjs CRITERIA vocabulary (we
 * do NOT import the module - Part 7 keeps this a leaf classifier - we only
 * mirror its key names) so Plan 04 can call composeScore(dims, weights) with
 * exactly these keys.
 *
 * --------------------------------------------------------------------------
 * FUSION POSTURE (SEED-048 line 44 - reuse the reach, do NOT re-derive combine):
 * --------------------------------------------------------------------------
 * The "combine three low into one high" reasoning at BATCH scale IS the
 * complementary() annotation over weak-dimension sets, computed here cheaply for
 * every pair. lib/core/fusion-router.cjs (the runFusion entry) remains the
 * deep-dive engine for a SINGLE candidate the navigator elects to pursue - it is
 * session/reach-oriented and is NOT called in the 919-pair batch loop. This
 * module ANNOTATES and lets Plan 04 ROUTE to the existing FUSION reach
 * (recommend, never trigger); it does not spam the deep engine and does not
 * re-implement its combine math.
 *
 * --------------------------------------------------------------------------
 * CANON PART 8 (Graph Boundary): N/A by construction.
 * --------------------------------------------------------------------------
 * Pure local arithmetic over caller-supplied numbers. Zero network, zero Brain,
 * zero room-byte egress.
 *
 * Interface contract (consumed by Plan 04's runner):
 *   scoreTechDimensions(tech, cohort) -> { strategic_fit, validated_demand,
 *     tech_econ_feasibility }   (all in [0,1])
 *   scorePairDimensions(pairSignals) -> same 3-key shape for a PAIR
 *   weakDimensions(dims, floor?)      -> dimension names strictly below the floor
 *   complementary(dimsA, dimsB, floor?) -> boolean (disjoint non-empty weak sets)
 *   percentileRank(value, sortedValues) -> [0,1]  (tail-quadrant reuses this)
 */
'use strict';

// The frozen, order-bearing dimension vocabulary. These keys BYTE-MATCH
// ahp-weights.cjs CRITERIA on purpose (Plan 04 does composeScore(dims, weights)
// keyed by exactly these names); we mirror the names, never import the module.
const DIMS = Object.freeze([
  'strategic_fit',
  'validated_demand',
  'tech_econ_feasibility',
]);

// strategic_fit from primary_tier: 1/tier. Tier 1 -> 1.0, tier 2 -> 0.5, tier 3
// -> 1/3. A missing or invalid tier takes the honest below-tier-3 default floor
// (0.25 sits strictly below 1/3, so an unknown tech never out-ranks a real
// tier-3 one). Provenance: SEED-048 "defensible, not a vibe number".
const DEFAULT_TIER_SCORE = 0.25;

// The real-bridge band for pair feasibility. Provenance: the s11 finding, real
// bridges measured at abs_diff 0.16-0.25 (scripts/eureka-room-report.cjs
// fire-rate prose). A structural transfer whose abs_diff lands inside this band
// is the strongest feasibility signal we have.
const BRIDGE_BAND_LO = 0.16;
const BRIDGE_BAND_HI = 0.25;

// Feasibility piecewise values over the rs-differential-scorer output. Frozen so
// a future edit is a visible provenance change, never a silent recalibration.
const FEASIBILITY = Object.freeze({
  bridge: 1.0,   // structural_transfer INSIDE the real-bridge band, passes true
  transfer: 0.7, // structural_transfer OUTSIDE the band, passes true
  semantic: 0.4, // semantic_implementation, passes true (paraphrase risk)
  fail: 0.1,     // passes false (the differential floor was not cleared)
});

// A dimension strictly below this is "weak" - the gap side of the three-low map.
const WEAK_FLOOR = 0.4;

// ---------- helpers ----------

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// A missing or malformed numeric field takes 0 rather than throwing: this module
// scores thousands of real rows and one malformed row must not abort the batch
// (mirror the runner's skip-and-count posture).
function finiteOr0(v) {
  return Number.isFinite(v) ? v : 0;
}

function num(v) {
  return Number.isFinite(v) ? v : 0;
}

// tier -> [0,1] via 1/tier, honest floor for missing/invalid.
function tierScore(tier) {
  if (typeof tier === 'number' && Number.isInteger(tier) && tier >= 1) {
    return clamp01(1 / tier);
  }
  return DEFAULT_TIER_SCORE;
}

// Percentile rank of value within an ASCENDING-sorted array, in [0,1]. Ties share
// the mean 1-based rank (so two equal pair_counts get the same demand score). The
// minimum maps to 0.0 and the maximum to 1.0. A degenerate 0/1-element cohort
// returns a neutral 0.5 (no ordering information exists).
function percentileRank(value, sortedValues) {
  const n = sortedValues.length;
  if (n <= 1) return 0.5;

  let firstEq = -1;
  let countEq = 0;
  for (let i = 0; i < n; i += 1) {
    if (Math.abs(sortedValues[i] - value) < 1e-12) {
      if (firstEq === -1) firstEq = i;
      countEq += 1;
    }
  }

  let meanRank;
  if (countEq > 0) {
    // 0-based positions firstEq .. firstEq+countEq-1; mean of their 1-based ranks.
    const first1 = firstEq + 1;
    const last1 = firstEq + countEq;
    meanRank = (first1 + last1) / 2;
  } else {
    // value not present in the cohort: use its insertion rank (count strictly below).
    let below = 0;
    for (let i = 0; i < n; i += 1) if (sortedValues[i] < value) below += 1;
    meanRank = below + 1;
  }
  return clamp01((meanRank - 1) / (n - 1));
}

// ---------- per-technology dimensions ----------

// tech = { id, cnumber, primary_tier, pair_count, degree } (idea-graph node.data);
// cohort = every tech in the run (for scale-free percentile ranks).
//   strategic_fit       = tier score (1/tier, honest floor).
//   validated_demand    = pair_count percentile within the cohort (how many
//                         cross-domain candidate pairs cite this tech - attention).
//   tech_econ_feasibility = degree percentile within the cohort (a well-connected
//                         node has more concrete bridge partners; a per-tech
//                         baseline, refined to the measured rs value at PAIR scale).
function scoreTechDimensions(tech, cohort) {
  const t = tech || {};
  const cohortArr = (Array.isArray(cohort) && cohort.length) ? cohort : [t];

  const pairCounts = cohortArr
    .map(function (x) { return finiteOr0(x && x.pair_count); })
    .sort(function (a, b) { return a - b; });
  const degrees = cohortArr
    .map(function (x) { return finiteOr0(x && x.degree); })
    .sort(function (a, b) { return a - b; });

  return {
    strategic_fit: clamp01(tierScore(t.primary_tier)),
    validated_demand: clamp01(percentileRank(finiteOr0(t.pair_count), pairCounts)),
    tech_econ_feasibility: clamp01(percentileRank(finiteOr0(t.degree), degrees)),
  };
}

// ---------- pair feasibility from the rs measured fields ----------

// rs = the scoreMeasured output for the pair: { direction, abs_diff, passes }.
function feasibilityFromRs(rs) {
  const r = rs || {};
  if (!r.passes) return FEASIBILITY.fail;
  const ad = Number(r.abs_diff);
  if (r.direction === 'structural_transfer') {
    if (Number.isFinite(ad) && ad >= BRIDGE_BAND_LO && ad <= BRIDGE_BAND_HI) {
      return FEASIBILITY.bridge;
    }
    return FEASIBILITY.transfer;
  }
  if (r.direction === 'semantic_implementation') return FEASIBILITY.semantic;
  // Unknown direction but passes true: the paraphrase-risk floor, never the bridge.
  return FEASIBILITY.semantic;
}

// ---------- per-pair dimensions ----------

// pairSignals = { a: techDims, b: techDims, rs: { direction, abs_diff, passes } }.
//   strategic_fit    = max(a, b)  (the pair inherits its STRONGEST district).
//   validated_demand = mean(a, b) (both sides must have attention to matter).
//   tech_econ_feasibility = the rs piecewise value (the measured bridge quality).
function scorePairDimensions(pairSignals) {
  const ps = pairSignals || {};
  const a = ps.a || {};
  const b = ps.b || {};
  return {
    strategic_fit: clamp01(Math.max(num(a.strategic_fit), num(b.strategic_fit))),
    validated_demand: clamp01((num(a.validated_demand) + num(b.validated_demand)) / 2),
    tech_econ_feasibility: clamp01(feasibilityFromRs(ps.rs)),
  };
}

// ---------- weakness + complementarity annotations ----------

// The dimension names strictly below the weak floor, in DIMS order (deterministic).
function weakDimensions(dims, floor) {
  const f = typeof floor === 'number' ? floor : WEAK_FLOOR;
  const d = dims || {};
  const out = [];
  for (let i = 0; i < DIMS.length; i += 1) {
    const key = DIMS[i];
    const v = d[key];
    if (typeof v === 'number' && Number.isFinite(v) && v < f) out.push(key);
  }
  return out;
}

// The "three low into one high" precondition: each side is weak exactly where the
// other is strong. True iff both weak sets are non-empty AND disjoint (they cover
// each other's gaps without sharing a gap).
function complementary(dimsA, dimsB, floor) {
  const wa = weakDimensions(dimsA, floor);
  const wb = weakDimensions(dimsB, floor);
  if (wa.length === 0 || wb.length === 0) return false;
  const setB = new Set(wb);
  for (let i = 0; i < wa.length; i += 1) {
    if (setB.has(wa[i])) return false; // shared gap -> not complementary
  }
  return true;
}

// ---------- exports ----------

module.exports = {
  scoreTechDimensions: scoreTechDimensions,
  scorePairDimensions: scorePairDimensions,
  weakDimensions: weakDimensions,
  complementary: complementary,
  percentileRank: percentileRank,
  _test: {
    DIMS: DIMS,
    DEFAULT_TIER_SCORE: DEFAULT_TIER_SCORE,
    BRIDGE_BAND_LO: BRIDGE_BAND_LO,
    BRIDGE_BAND_HI: BRIDGE_BAND_HI,
    FEASIBILITY: FEASIBILITY,
    WEAK_FLOOR: WEAK_FLOOR,
    tierScore: tierScore,
    feasibilityFromRs: feasibilityFromRs,
  },
};
