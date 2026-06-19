'use strict';
/*
 * Phase 165 Wave-2 GREEN test -- test-unknowns-dsp (D-165-02).
 *
 * GREEN assertion (sourced from 165-VALIDATION.md + 165-RESEARCH section 1.1 DSP /
 * Algorithm 1):
 *   partition(instances, confidenceScores, patterns) returns an array of
 *   partitions, each carrying { pattern, instances, centroid, meanConfidence }.
 *   The greedy set-cover picks the pattern maximizing coveredUncovered.size /
 *   goodness until the instance space is covered; the centroid is the per-feature
 *   mean over the partition's instances (the INSTANCE_FEATURES schema in the
 *   shared iface) and meanConfidence is the scalar mean of the partition's
 *   confidence values. Determinism (D-165-09): no Math.random in selection; a
 *   re-run is byte-identical.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('assert');
const dsp = require('../lib/core/unknowns/dsp.cjs');
const { minePatterns } = require('../lib/core/unknowns/pattern-miner.cjs');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL - ' + name + ': ' + e.message);
  }
}

// A small deterministic corpus over the INSTANCE_FEATURES schema. Two well-formed
// clusters: high-confidence Academic market-analysis claims and lower-confidence
// Operational solution-design claims.
function corpus() {
  return [
    { claimId: 'claim:a1', section: 'market-analysis', domain: 'biotech', evidenceTier: 'Academic', confidence: 1.0, governingHash: 'h1', ageDays: 5 },
    { claimId: 'claim:a2', section: 'market-analysis', domain: 'biotech', evidenceTier: 'Academic', confidence: 0.95, governingHash: 'h1', ageDays: 7 },
    { claimId: 'claim:a3', section: 'market-analysis', domain: 'biotech', evidenceTier: 'Academic', confidence: 0.9, governingHash: 'h1', ageDays: 9 },
    { claimId: 'claim:b1', section: 'solution-design', domain: 'software', evidenceTier: 'Operational', confidence: 0.6, governingHash: 'h2', ageDays: 40 },
    { claimId: 'claim:b2', section: 'solution-design', domain: 'software', evidenceTier: 'Operational', confidence: 0.55, governingHash: 'h2', ageDays: 50 },
    { claimId: 'claim:b3', section: 'solution-design', domain: 'software', evidenceTier: 'Operational', confidence: 0.5, governingHash: 'h2', ageDays: 60 },
  ];
}

check('partition returns the {pattern, instances, centroid, meanConfidence} shape', () => {
  const insts = corpus();
  const patterns = minePatterns(insts);
  assert(patterns.length > 0, 'pattern-miner produced no patterns');
  const parts = dsp.partition(insts, null, patterns);
  assert(Array.isArray(parts), 'partition did not return an array');
  assert(parts.length >= 1, 'partition returned no partitions');
  for (const p of parts) {
    assert('pattern' in p && p.pattern && Array.isArray(p.pattern.conditions), 'partition missing pattern.conditions');
    assert(Array.isArray(p.instances), 'partition missing instances array');
    assert(p.centroid && typeof p.centroid === 'object', 'partition missing centroid object');
    assert(typeof p.meanConfidence === 'number', 'partition missing numeric meanConfidence');
    assert(p.meanConfidence >= 0 && p.meanConfidence <= 1, 'meanConfidence out of [0,1]');
  }
});

check('greedy set-cover covers the instance space (no instance double-counted)', () => {
  const insts = corpus();
  const patterns = minePatterns(insts);
  const parts = dsp.partition(insts, null, patterns);
  const seen = new Set();
  for (const p of parts) {
    for (const inst of p.instances) {
      assert(!seen.has(inst.claimId), 'instance ' + inst.claimId + ' covered by two partitions (set-cover violated)');
      seen.add(inst.claimId);
    }
  }
  // Every corpus instance landed in some partition (the space is covered).
  for (const inst of insts) {
    assert(seen.has(inst.claimId), 'instance ' + inst.claimId + ' was never covered');
  }
});

check('centroid is the per-feature mean over the partition members', () => {
  const insts = corpus();
  const patterns = minePatterns(insts);
  const parts = dsp.partition(insts, null, patterns);
  for (const p of parts) {
    // confidence centroid equals the arithmetic mean of member confidences.
    const mean = p.instances.reduce((s, i) => s + i.confidence, 0) / p.instances.length;
    assert(Math.abs(p.centroid.confidence - mean) < 1e-9, 'centroid.confidence is not the member mean');
  }
});

check('determinism (D-165-09): two runs are byte-identical', () => {
  const insts = corpus();
  const patterns = minePatterns(insts);
  const a = JSON.stringify(dsp.partition(insts, null, patterns));
  const b = JSON.stringify(dsp.partition(insts, null, patterns));
  assert.strictEqual(a, b, 'partition is not deterministic across runs');
});

check('confidenceScores map overrides inst.confidence', () => {
  const insts = corpus();
  const patterns = minePatterns(insts);
  const scores = {};
  for (const i of insts) scores[i.claimId] = 0.42;
  const parts = dsp.partition(insts, scores, patterns);
  for (const p of parts) {
    assert(Math.abs(p.meanConfidence - 0.42) < 1e-9, 'confidenceScores override not honored');
  }
});

if (failures > 0) {
  console.error('test-unknowns-dsp: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-unknowns-dsp: GREEN (DSP partition shape + set-cover + determinism)');
process.exit(0);
