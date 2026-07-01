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

module.exports = { DEGENERATE_SIGNATURE, isDegeneratePair, isDegeneratePairSet };
