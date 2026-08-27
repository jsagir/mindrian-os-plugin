#!/usr/bin/env node
'use strict';
/*
 * Phase 265 Plan 18 (RADAR-26) -- probe-first cost guard + concurrent tail.
 *
 * This plan is the build authorized by 265-04 Task 3's `build-now-in-265`
 * decision: the four explore-chain analysis legs run probe-first and
 * concurrently instead of sequentially, WITHOUT dropping the cost property
 * chain-executor.cjs's quality_early_stop provided (a cold deep_research leg
 * spends only itself, never the other three).
 *
 * Task 1 arms (this commit): resolveExploreCostPolicy and probeClears, both
 * pure functions -- no fs, no network, no clock, no room, no chain dispatch.
 * Task 2 arms (added in the follow-on commit, same file): the runtime
 * concurrency, order, cost-guard, all-legs, fallback, engine-absent and
 * zero-diff arms.
 *
 * Pure Node.js built-ins only. NO em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const exploreChain = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'explore-chain.cjs'));

const { resolveExploreCostPolicy, probeClears, FRAMEWORK_LEGS } = exploreChain;

let pass = 0;
let total = 0;
const failures = [];

function check(label, fn) {
  total += 1;
  try {
    fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push(label + ': ' + (e && e.message));
    console.log('  FAIL -', label, '::', e && e.message);
  }
}

const OTHER_THREE_LEGS = FRAMEWORK_LEGS.filter((f) => f.leg !== 'deep_research').map((f) => f.leg);
const ALL_FOUR_LEGS = FRAMEWORK_LEGS.map((f) => f.leg);

// ---------------------------------------------------------------------------
// Task 1: resolveExploreCostPolicy + probeClears (pure, no room, no network).
// ---------------------------------------------------------------------------

check('policy: no env and no opts defaults to cost-conscious probe-first', () => {
  const policy = resolveExploreCostPolicy({}, {});
  assert.equal(policy.mode, 'cost-conscious');
  assert.equal(policy.parallel, true);
  assert.equal(policy.probeLeg, 'deep_research');
  assert.deepEqual(policy.fanLegs, OTHER_THREE_LEGS);
  assert.equal(typeof policy.reason, 'string');
  assert.ok(policy.reason.length > 0);
});

check('policy: EXPLORE_COST_MODE=all-legs fans all four with no probe', () => {
  const policy = resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'all-legs' }, {});
  assert.equal(policy.mode, 'all-legs');
  assert.equal(policy.probeLeg, null);
  assert.deepEqual(policy.fanLegs, ALL_FOUR_LEGS);
});

check('policy: opts.costMode beats the env var', () => {
  const policy = resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'all-legs' }, { costMode: 'cost-conscious' });
  assert.equal(policy.mode, 'cost-conscious');
  assert.equal(policy.probeLeg, 'deep_research');
});

check('policy: an unrecognized EXPLORE_COST_MODE falls back to cost-conscious and says so', () => {
  const policy = resolveExploreCostPolicy({ EXPLORE_COST_MODE: 'nonsense' }, {});
  assert.equal(policy.mode, 'cost-conscious');
  assert.match(policy.reason, /not recognized/i);
});

check('policy: EXPLORE_PARALLEL=0 forces parallel:false regardless of mode', () => {
  const p1 = resolveExploreCostPolicy({ EXPLORE_PARALLEL: '0' }, {});
  assert.equal(p1.parallel, false);
  const p2 = resolveExploreCostPolicy({ EXPLORE_PARALLEL: '0', EXPLORE_COST_MODE: 'all-legs' }, {});
  assert.equal(p2.parallel, false);
});

check('probeClears: false for the cold-corpus quality:low shape, true for medium', () => {
  // The exact shape wrappedOnStep produces for a cold corpus (explore-chain.cjs,
  // the forceOffline branch: `quality: corpus.results.length > 0 ? 'medium' : 'low'`).
  assert.equal(probeClears({ chain_output: { results: [] }, quality: 'low' }), false);
  assert.equal(probeClears({ chain_output: { results: [{ path: 'x' }] }, quality: 'medium' }), true);
  // Defensive: a missing/non-string quality does not spuriously match 'low'.
  assert.equal(probeClears({}), true);
  assert.equal(probeClears(null), true);
});

console.log('');
console.log(`${pass}/${total} passed`);
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
process.exit(0);
