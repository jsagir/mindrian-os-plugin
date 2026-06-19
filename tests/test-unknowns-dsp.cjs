'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-dsp (D-165-02).
 *
 * GREEN assertion (Wave 2 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 1.1 DSP / Algorithm 1):
 *   partition(instances, confidenceScores, patterns) returns an array of
 *   partitions, each carrying { pattern, instances, centroid, meanConfidence }.
 *   The greedy set-cover picks the pattern maximizing coveredUncovered.size /
 *   goodness until the instance space is covered; the centroid is the per-feature
 *   mean over the partition's instances (the INSTANCE_FEATURES schema in the
 *   shared iface) and meanConfidence is the scalar mean of the partition's
 *   confidence values. Determinism (D-165-09): no Math.random in selection.
 *
 * The module lib/core/unknowns/dsp.cjs does not exist yet. RED until Wave 2.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/dsp.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/dsp.cjs not yet implemented (plan 02)');
  process.exit(1);
}
console.error('RED: dsp loaded but the GREEN assertions are not wired yet (plan 02)');
process.exit(1);
