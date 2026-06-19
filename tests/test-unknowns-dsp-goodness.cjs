'use strict';
/*
 * Phase 165 Wave-2 GREEN test -- test-unknowns-dsp-goodness (interPartitionDistance).
 *
 * GREEN assertion (sourced from 165-VALIDATION.md + 165-RESEARCH section 1.4, the
 * discretion-item deliverable):
 *   interPartitionFeatureDistance(P_i, partitions, corpusRanges) and
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

// Two clearly-separated clusters: a high-confidence Academic biotech cluster and a
// low-confidence None-tier software cluster. The centroids differ on every
// dimension so the real distance must be clearly NON-1.0 and NON-0.
function corpus() {
  return [
    { claimId: 'claim:a1', section: 'market-analysis', domain: 'biotech', evidenceTier: 'Academic', confidence: 1.0, governingHash: 'h1', ageDays: 1 },
    { claimId: 'claim:a2', section: 'market-analysis', domain: 'biotech', evidenceTier: 'Academic', confidence: 0.98, governingHash: 'h1', ageDays: 2 },
    { claimId: 'claim:b1', section: 'solution-design', domain: 'software', evidenceTier: 'None', confidence: 0.3, governingHash: 'h2', ageDays: 80 },
    { claimId: 'claim:b2', section: 'solution-design', domain: 'software', evidenceTier: 'None', confidence: 0.25, governingHash: 'h2', ageDays: 90 },
  ];
}

check('a LONE partition returns 0.0 (NOT the stub 1.0) -- the stub-leak guard', () => {
  const lone = {
    id: 'p-lone',
    pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'biotech' }] },
    instances: corpus().slice(0, 2),
    centroid: { confidence: 1.0, ageDays: 1.5, evidenceTier: 4, section: 'market-analysis', domain: 'biotech' },
    meanConfidence: 0.99,
  };
  const fd = dsp.interPartitionFeatureDistance(lone, [lone], { confidence: 1, ageDays: 100, evidenceTier: 3 });
  const cd = dsp.interPartitionConfidenceDistance(lone, [lone]);
  assert.strictEqual(fd, 0.0, 'lone-partition feature distance must be 0.0, got ' + fd);
  assert.strictEqual(cd, 0.0, 'lone-partition confidence distance must be 0.0, got ' + cd);
});

check('the real inter-partition distances DISCRIMINATE (distinct, non-1.0)', () => {
  const pA = {
    id: 'pA',
    pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'biotech' }] },
    instances: corpus().slice(0, 2),
    centroid: { confidence: 0.99, ageDays: 1.5, evidenceTier: 4, section: 'market-analysis', domain: 'biotech' },
    meanConfidence: 0.99,
  };
  const pB = {
    id: 'pB',
    pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'software' }] },
    instances: corpus().slice(2, 4),
    centroid: { confidence: 0.275, ageDays: 85, evidenceTier: 1, section: 'solution-design', domain: 'software' },
    meanConfidence: 0.275,
  };
  const ranges = { confidence: 1.0, ageDays: 100, evidenceTier: 3 };
  const fd = dsp.interPartitionFeatureDistance(pA, [pA, pB], ranges);
  const cd = dsp.interPartitionConfidenceDistance(pA, [pA, pB]);
  // The metric must produce a real value, strictly inside (0,1), NOT the stub 1.0.
  assert(fd > 0, 'feature distance should be > 0 for separated centroids, got ' + fd);
  assert(fd !== 1.0, 'feature distance must not be the stub 1.0');
  assert(fd < 1.0, 'feature distance should be < 1.0 (not all dims maximally apart), got ' + fd);
  assert(cd > 0, 'confidence distance should be > 0 for separated means, got ' + cd);
  assert(cd !== 1.0, 'confidence distance must not be the stub 1.0');
  // The confidence distance is exactly |0.99 - 0.275| = 0.715.
  assert(Math.abs(cd - Math.abs(0.99 - 0.275)) < 1e-9, 'confidence distance is not the mean abs diff');
});

check('the metric distinguishes near vs far partitions (monotone separation)', () => {
  const ranges = { confidence: 1.0, ageDays: 100, evidenceTier: 3 };
  const base = {
    id: 'base', pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'biotech' }] },
    instances: [], centroid: { confidence: 1.0, ageDays: 0, evidenceTier: 4, section: 'm', domain: 'biotech' }, meanConfidence: 1.0,
  };
  const near = {
    id: 'near', pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'biotech' }] },
    instances: [], centroid: { confidence: 0.95, ageDays: 5, evidenceTier: 4, section: 'm', domain: 'biotech' }, meanConfidence: 0.95,
  };
  const far = {
    id: 'far', pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'software' }] },
    instances: [], centroid: { confidence: 0.1, ageDays: 100, evidenceTier: 1, section: 's', domain: 'software' }, meanConfidence: 0.1,
  };
  const dNear = dsp.interPartitionFeatureDistance(base, [base, near], ranges);
  const dFar = dsp.interPartitionFeatureDistance(base, [base, far], ranges);
  assert(dFar > dNear, 'a farther-centroid sibling must yield a larger distance (got far=' + dFar + ' near=' + dNear + ')');
});

check('goodness uses the real g2/g4 (differs from a stubbed-1.0 score)', () => {
  const insts = corpus();
  const patterns = minePatterns(insts);
  const parts = dsp.partition(insts, null, patterns);
  assert(parts.length >= 1, 'need at least one partition');
  const ranges = dsp.computeCorpusRanges(insts);
  const real = dsp.goodness(parts[0], parts, ranges);
  // Recompute the score with g2 and g4 forced to the stub 1.0 and confirm it differs
  // (proves the real distances are wired into goodness, not stubbed).
  const w = { l1: 1, l2: 1, l3: 1, l4: 1, l5: 0.1 };
  const g1 = dsp.intraFeatureDistance(parts[0], ranges);
  const g3 = dsp.intraConfidenceDistance(parts[0]);
  const g5 = parts[0].pattern.conditions.length;
  const stubbed = w.l1 * g1 - w.l2 * 1.0 + w.l3 * g3 - w.l4 * 1.0 + w.l5 * g5;
  if (parts.length > 1) {
    assert(Math.abs(real - stubbed) > 1e-9, 'goodness is identical to the stubbed-1.0 score (the stub leaked)');
  } else {
    // A lone partition has g2=g4=0, so real != stubbed-1.0 by 2.0 exactly.
    assert(Math.abs(real - stubbed) > 1e-9, 'lone-partition goodness should differ from stubbed-1.0');
  }
});

check('determinism (D-165-09): the distances are byte-identical across runs', () => {
  const insts = corpus();
  const patterns = minePatterns(insts);
  const parts = dsp.partition(insts, null, patterns);
  const ranges = dsp.computeCorpusRanges(insts);
  const a = parts.map((p) => dsp.interPartitionFeatureDistance(p, parts, ranges)).join(',');
  const b = parts.map((p) => dsp.interPartitionFeatureDistance(p, parts, ranges)).join(',');
  assert.strictEqual(a, b, 'inter-partition distances are not deterministic');
});

if (failures > 0) {
  console.error('test-unknowns-dsp-goodness: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-unknowns-dsp-goodness: GREEN (real inter-partition distance discriminates; lone=0.0)');
process.exit(0);
