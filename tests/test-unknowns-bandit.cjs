'use strict';
/*
 * Phase 165 Wave-3 GREEN test -- test-unknowns-bandit (D-165-02 + D-165-09).
 *
 * GREEN assertion (sourced from 165-VALIDATION.md + 165-RESEARCH section 1.1 UUB /
 * Algorithm 2, section 1.5):
 *   initialize(partitions) seeds one arm per partition; selectNextInstance(...,
 *   oracleFn, budget) produces pull records { time, arm, instance, utility,
 *   isUnknownUnknown, cumulativeUtility } and RESPECTS the bounded budget =
 *   floor(N * config.budget). First K pulls try each arm once in stable priority
 *   order (ties by partition id); thereafter UCB-with-custom-discount arm
 *   selection (Eq.3 currentArmSize/sizeAtPull). Within-arm instance pick is
 *   index-deterministic over a stable-sorted cursor (ascending claimId) -- ZERO
 *   Math.random.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bandit = require('../lib/core/unknowns/bandit.cjs');

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

// Two arms (partitions), 3 instances each. A deterministic proxy oracle: the
// b-cluster claims are "blind spots" (trueLabel 1), the a-cluster are clean.
function partitions() {
  return [
    {
      id: 'pA', meanConfidence: 0.95,
      pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'biotech' }] },
      instances: [{ claimId: 'claim:a3' }, { claimId: 'claim:a1' }, { claimId: 'claim:a2' }],
    },
    {
      id: 'pB', meanConfidence: 0.5,
      pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'software' }] },
      instances: [{ claimId: 'claim:b2' }, { claimId: 'claim:b1' }, { claimId: 'claim:b3' }],
    },
  ];
}

function oracle(claimId) {
  return { trueLabel: claimId.startsWith('claim:b') ? 1 : 0, cost: 0.0 };
}

check('initialize seeds one arm per partition with the documented fields', () => {
  const state = bandit.initialize(partitions(), { roomDir: '/tmp/room', corpusHash: 'abc' });
  assert.strictEqual(state.arms.length, 2, 'expected one arm per partition');
  for (const a of state.arms) {
    assert('partitionId' in a && 'effectiveCount' in a && 'discountedMean' in a, 'arm missing UCB fields');
    assert('currentArmSize' in a && 'sizeAtPull' in a, 'arm missing discount fields');
    assert(Array.isArray(a.unprobedInstanceIds), 'arm missing unprobed list');
  }
  // Within-arm instance list is ascending-claimId sorted (index-deterministic).
  const armA = state.arms.find((a) => a.partitionId === 'pA');
  assert.deepStrictEqual(armA.unprobedInstanceIds, ['claim:a1', 'claim:a2', 'claim:a3'], 'within-arm pick is not ascending-claimId sorted');
});

check('selectNextInstance produces pull records of the documented shape', () => {
  const res = bandit.selectNextInstance(partitions(), oracle, 4);
  assert(Array.isArray(res.records), 'no records array');
  assert(res.records.length > 0, 'no pull records produced');
  for (const r of res.records) {
    assert(typeof r.time === 'number', 'record.time must be a number (the pull counter)');
    assert(typeof r.arm === 'string', 'record.arm must be the partition id');
    assert(typeof r.instance === 'string', 'record.instance must be the claimId');
    assert(typeof r.utility === 'number', 'record.utility must be a number');
    assert(typeof r.isUnknownUnknown === 'boolean', 'record.isUnknownUnknown must be a boolean');
    assert(typeof r.cumulativeUtility === 'number', 'record.cumulativeUtility must be a number');
  }
});

check('budget = floor(N * config.budget) is respected', () => {
  // N = 6, budget fraction 0.5 -> floor(3) = 3 pulls.
  const res = bandit.selectNextInstance(partitions(), oracle, { budget: 0.5, roomDir: '/tmp/r', corpusHash: 'h' });
  assert.strictEqual(res.budget, 3, 'budget = floor(6*0.5) should be 3, got ' + res.budget);
  assert(res.records.length <= 3, 'more pulls than the budget allowed');
});

check('first-K tries each arm once in stable priority order (pA before pB)', () => {
  const res = bandit.selectNextInstance(partitions(), oracle, 2);
  // pA has higher meanConfidence (0.95 > 0.5) so it is probed first (priority desc).
  assert.strictEqual(res.records[0].arm, 'pA', 'highest-priority arm must be tried first');
  assert.strictEqual(res.records[1].arm, 'pB', 'second pull must try the other arm once');
});

check('utility = (isUU?1:0) - gamma*cost (Eq.1); proxyCost 0 => utility == isUU', () => {
  const res = bandit.selectNextInstance(partitions(), oracle, 6);
  for (const r of res.records) {
    const expected = r.isUnknownUnknown ? 1 : 0; // cost 0 so gamma term vanishes
    assert.strictEqual(r.utility, expected, 'utility does not match Eq.1 with cost 0');
  }
});

check('determinism (D-165-09): two full scans are byte-identical', () => {
  const a = JSON.stringify(bandit.selectNextInstance(partitions(), oracle, 6).records);
  const b = JSON.stringify(bandit.selectNextInstance(partitions(), oracle, 6).records);
  assert.strictEqual(a, b, 'the bandit scan is not deterministic');
});

check('grep: zero Math.random in bandit.cjs', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'core', 'unknowns', 'bandit.cjs'), 'utf8');
  // Strip comment lines so a doc-comment mention of the banned API is not a hit.
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert(code.indexOf('Math.random') === -1, 'Math.random present in bandit.cjs code path');
  assert(code.indexOf('Date.now') === -1, 'Date.now present in bandit.cjs code path');
});

if (failures > 0) {
  console.error('test-unknowns-bandit: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-unknowns-bandit: GREEN (Eq.1 utility + budget + stable arm order + zero Math.random)');
process.exit(0);
