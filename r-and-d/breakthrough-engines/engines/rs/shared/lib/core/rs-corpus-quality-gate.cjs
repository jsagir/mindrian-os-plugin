'use strict';
/*
 * rs-corpus-quality-gate.cjs -- local, deterministic RS corpus-quality detector.
 * =========================================================================
 * Phase 200-03. The runtime-safe half of the corpus-quality eval gate: it
 * reproduces the Plurai judge's degenerate/calibrated verdict OFFLINE, so the RS
 * pipeline can flag degenerate output (the SEED-018 signature) WITHOUT ever
 * calling Plurai at runtime (Canon Part 8: Plurai is build/CI only).
 *
 * The "degenerate" signature is the SEED-018 collapse: a differential pair pinned
 * at the max-lsa / min-semantic corner (semantic ~0, lsa ~1, signed_diff ~-1),
 * meaning the two spaces are measuring noise against noise. A pair-set is
 * degenerate when NEARLY ALL of its pairs sit at that corner.
 *
 * The threshold is HARDCODED, never data-swept and never overridable by an options
 * object -- "a gate that cannot fail is not a gate" (the calibration-gate.cjs
 * precedent, AUC_MIN). Pure + offline: zero network, zero Brain, node built-ins only.
 * No em-dashes.
 */

// A single pair is "degenerate-shaped" when it sits in the boundary band: semantic
// similarity at the floor, lsa at the ceiling, signed_diff at the negative extreme.
// The small tolerances absorb rounding (0.0/1.0/-1.0 is the exact corner; a pair
// within a few hundredths of it is the same collapse).
const DEGENERATE_SIGNATURE = Object.freeze({
  semantic_max: 0.05,   // semantic_score <= this
  lsa_min: 0.95,        // lsa_score >= this
  signed_diff_max: -0.9, // signed_diff <= this
  // A SET is degenerate when at least this fraction of its pairs are boundary-shaped.
  set_fraction: 0.9,
});

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
}

// Is one pair at the SEED-018 boundary corner?
function isDegeneratePair(pair) {
  if (!pair || typeof pair !== 'object') return false;
  const s = num(pair.semantic_score);
  const l = num(pair.lsa_score);
  const d = num(pair.signed_diff);
  if (Number.isNaN(s) || Number.isNaN(l) || Number.isNaN(d)) return false;
  return s <= DEGENERATE_SIGNATURE.semantic_max &&
         l >= DEGENERATE_SIGNATURE.lsa_min &&
         d <= DEGENERATE_SIGNATURE.signed_diff_max;
}

// isDegeneratePairSet(pairs) -> boolean. True when >= set_fraction of the pairs are
// boundary-shaped. The second arg is ACCEPTED (so callers can pass context) but
// DELIBERATELY IGNORED for the verdict -- the signature is the law, not a knob. A
// single boundary pair among discriminating ones is normal, not degenerate.
function isDegeneratePairSet(pairs, _optsIgnored) {
  if (!Array.isArray(pairs) || pairs.length === 0) return false;
  let degenerate = 0;
  for (const p of pairs) {
    if (isDegeneratePair(p)) degenerate += 1;
  }
  return (degenerate / pairs.length) >= DEGENERATE_SIGNATURE.set_fraction;
}

// ---------------------------------------------------------------------------
// 2026 addition: assessPairSetQuality(pairs)
// ---------------------------------------------------------------------------
// isDegeneratePairSet only recognises ONE collapse (the SEED-018 corner:
// semantic ~0, lsa ~1). Other ways a pair set carries no information pass it
// untouched: every pair sharing one score (constant output), a score column with
// no spread, or a set so small that a ranking means nothing. This function reports
// those WITHOUT altering the frozen verdict above: `degenerate` is exactly
// isDegeneratePairSet(pairs); `flags` adds reasons. Deterministic, offline, and
// like the original it takes no knobs, so the checks cannot be tuned away.
const MIN_PAIRS_FOR_RANKING = 10;
const MIN_SPREAD = 1e-6; // population standard deviation below this is "no spread"

function stdev(xs) {
  if (xs.length === 0) return 0;
  let m = 0;
  for (const x of xs) m += x;
  m /= xs.length;
  let ss = 0;
  for (const x of xs) ss += (x - m) * (x - m);
  return Math.sqrt(ss / xs.length);
}

function assessPairSetQuality(pairs) {
  const list = Array.isArray(pairs) ? pairs : [];
  const flags = [];
  const stats = { n: list.length, finite: 0, corner_fraction: 0 };
  if (list.length === 0) {
    return { degenerate: false, ok: false, flags: ['empty_pair_set'], stats };
  }
  const sem = []; const lsa = []; const diff = [];
  let corner = 0;
  for (const p of list) {
    if (isDegeneratePair(p)) corner += 1;
    const s = num(p && p.semantic_score); const l = num(p && p.lsa_score); const d = num(p && p.signed_diff);
    if (!Number.isNaN(s) && !Number.isNaN(l) && !Number.isNaN(d)) {
      stats.finite += 1; sem.push(s); lsa.push(l); diff.push(d);
    }
  }
  stats.corner_fraction = corner / list.length;
  const degenerate = isDegeneratePairSet(list);
  if (degenerate) flags.push('seed018_corner_collapse');
  if (stats.finite < list.length) flags.push('non_finite_scores');
  if (stats.finite === 0) {
    flags.push('no_scored_pairs');
  } else {
    if (stats.finite < MIN_PAIRS_FOR_RANKING) flags.push('too_few_pairs_for_ranking');
    if (stats.finite >= 3) {
      if (stdev(diff) < MIN_SPREAD) flags.push('signed_diff_constant');
      if (stdev(sem) < MIN_SPREAD) flags.push('semantic_constant');
      if (stdev(lsa) < MIN_SPREAD) flags.push('lsa_constant');
    }
  }
  return { degenerate, ok: flags.length === 0, flags, stats };
}

module.exports = { DEGENERATE_SIGNATURE, isDegeneratePair, isDegeneratePairSet, assessPairSetQuality };
