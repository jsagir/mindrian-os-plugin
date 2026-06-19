'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-dsp-goodness (interPartitionDistance).
 *
 * GREEN assertion (Wave 2 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 1.4, the discretion-item deliverable):
 *   interPartitionFeatureDistance(P_i, partitions) and
 *   interPartitionConfidenceDistance(P_i, partitions) compute the REAL distance,
 *   NOT the reference stub `return 1.0`. Two differently-centroided partitions
 *   yield distinct, NON-1.0 distances (the metric DISCRIMINATES). A LONE partition
 *   (no siblings) returns 0.0 -- the correct edge value, NOT the stub 1.0 (this is
 *   the stub-leak regression guard, Pitfall 2). NUMERIC features use normalized
 *   |a-b|/corpusRange; CATEGORICAL (section/domain) use Hamming mismatch;
 *   confidence distance is mean |meanConfidence_i - meanConfidence_j|. Pure +
 *   deterministic (sibling iteration in stable id-sorted order; no Math.random,
 *   no Date.now).
 *
 * The module lib/core/unknowns/dsp.cjs (exporting the two distance functions) does
 * not exist yet. RED until Wave 2.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/dsp.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/dsp.cjs interPartition distances not yet implemented (plan 02)');
  process.exit(1);
}
console.error('RED: dsp-goodness loaded but the discriminate / lone-0.0 assertions are not wired yet (plan 02)');
process.exit(1);
