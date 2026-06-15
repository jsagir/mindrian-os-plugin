'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-03 -- carried frozen-148 guard (SC-05 / RJP-08).
 * ============================================================================
 * Mirrors tests/test-148-frozen-contracts.cjs:53-75 (the frozen constitutional
 * constants) and asserts they hold AFTER a discount + a hard-suppress drop has
 * been exercised through computeReachPenalties -> buildReachList. This proves the
 * Phase 158 penalty / suppression touched only the RUNTIME reaches array, never
 * the frozen bank: the bank is still 6, MAX_K is still 3, the 0.70/0.15 gate is
 * unchanged, and REACH_IDS is still length 6.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const reader = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-158-reach-frozen-148-guard.cjs (SC-05/RJP-08): frozen constants hold after discount + drop');

const FIXED_SCORES = {
  deep_research: 0.9,
  hats: 0.8,
  context_block: 0.7,
  brain_consult: 0.6,
  contradiction: 0.5,
  cross_room: 0.4,
};

// Exercise a discount + a hard-suppress drop FIRST, so the frozen assertions
// below run AFTER the Phase 158 machinery has done its work this turn.
const roomState = {
  reachScores: Object.assign({}, FIXED_SCORES),
  rejectCountInWindow: {
    deep_research: reader.REJECT_SUPPRESS_THRESHOLD, // >= N -> dropped
    hats: reader.REJECT_SUPPRESS_THRESHOLD - 1,      // < N -> discounted
  },
  presentationsCount: { deep_research: 4, hats: 4 }, // M met, not parole
};
const pen = reader.computeReachPenalties(null, roomState);
const folded = Object.assign({}, FIXED_SCORES, pen.discountedScores);
const list = orchestrator.buildReachList({
  tierMode: 'mode_a',
  reachScores: folded,
  suppressedReachIds: pen.suppressedReachIds,
});

// Sanity: the discount + drop actually happened (so the guard is meaningful).
check('the discount + drop were exercised (deep_research dropped, hats discounted)', () => {
  assert.ok(pen.suppressedReachIds.indexOf('deep_research') !== -1,
    'deep_research must be hard-suppressed in this fixture');
  assert.strictEqual(list.reaches.some((r) => r.reach_id === 'deep_research'), false,
    'deep_research must be absent from the rendered set');
  assert.ok(folded.hats < FIXED_SCORES.hats, 'hats must be discounted below its base');
});

// ---------------------------------------------------------------------------
// The frozen constitutional constants (mirror test-148-frozen-contracts.cjs).
// ---------------------------------------------------------------------------
check('ranker.MAX_K === 3 (the chooser-row budget is FROZEN)', () => {
  assert.strictEqual(ranker.MAX_K, 3, 'MAX_K must stay 3; got ' + ranker.MAX_K);
});

check('orchestrator.RECOMMEND_FLOOR === 0.70 (the recommend gate is FROZEN)', () => {
  assert.strictEqual(orchestrator.RECOMMEND_FLOOR, 0.70,
    'RECOMMEND_FLOOR must stay 0.70; got ' + orchestrator.RECOMMEND_FLOOR);
});

check('orchestrator.MARGIN_THRESHOLD === 0.15 (the margin gate is FROZEN)', () => {
  assert.strictEqual(orchestrator.MARGIN_THRESHOLD, 0.15,
    'MARGIN_THRESHOLD must stay 0.15; got ' + orchestrator.MARGIN_THRESHOLD);
});

check('orchestrator.DIAL_REACH_K === 6 (the bank is still 6 after the drop)', () => {
  assert.strictEqual(orchestrator.DIAL_REACH_K, 6,
    'DIAL_REACH_K must stay 6; got ' + orchestrator.DIAL_REACH_K);
});

check('orchestrator.REACH_IDS length === 6 (the 6-bank is frozen)', () => {
  assert.ok(Array.isArray(orchestrator.REACH_IDS), 'REACH_IDS must be an array');
  assert.strictEqual(orchestrator.REACH_IDS.length, 6,
    'REACH_IDS must be length 6; got ' + orchestrator.REACH_IDS.length);
});

check('the two caps stay DISTINCT (DIAL_REACH_K=6 != MAX_K=3)', () => {
  assert.notStrictEqual(orchestrator.DIAL_REACH_K, ranker.MAX_K,
    'the dial-preview cap and the chooser cap must remain distinct');
});

// The frozen-6 contract asserts the BANK is 6, not that 6 always render: after a
// drop the rendered set is 5 but the bank (REACH_IDS / DIAL_REACH_K) stays 6.
check('the frozen-6 contract is about the BANK, not the rendered count', () => {
  assert.strictEqual(list.total_count, 5, 'this turn renders 5 (one dropped); got ' + list.total_count);
  assert.strictEqual(orchestrator.REACH_IDS.length, 6, 'the bank stays 6 despite the drop');
});

console.log('');
console.log('PASS test-158-reach-frozen-148-guard.cjs (' + passed + ' checks)');
process.exit(0);
