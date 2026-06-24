#!/usr/bin/env node
'use strict';
/*
 * Phase 177-04 Task 1 -- BCH-S5 turn-stage reach-eligibility.
 * ==========================================================
 *
 * THE PROOF this suite makes: the brain_consult and deep_research reaches are
 * SUPPRESSED in early turns (turns 1-2, turn_count < 3), they UNLOCK at turn 5
 * (turn_count >= 5), and EVERY other reach (context_block, contradiction,
 * cross_room, hats) is always eligible. An ABSENT turn_count is a no-op
 * (everything eligible) so every legacy caller stays byte-stable. The
 * dispatchSensors chokepoint FILTERS a turn-stage-ineligible sensor out of its
 * result this turn WITHOUT touching trace.routing_source (the Phase 144 fence).
 *
 * Deterministic engine math over the runtime turn_count that BCH-S1 established
 * (lib/core/navigation/projections.cjs computeInvestmentLevel). NO new reach is
 * minted (the frozen 6 hold); NO new hook is added (this runs inside the
 * existing dispatchSensors the UserPromptSubmit hook already calls).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const sensors = require(path.join(ROOT, 'lib', 'core', 'insight-sensors.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok   ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}
function check(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

console.log('--- test-bch-s5-turn-stage-eligibility ---');

const isReachEligibleForTurn = sensors.isReachEligibleForTurn;

check('isReachEligibleForTurn is exported', () => {
  assert.equal(typeof isReachEligibleForTurn, 'function', 'isReachEligibleForTurn must be a function');
});

// Early-turn suppression of the two deep reaches (turns 1-2 == turn_count < 3).
check('brain_consult ineligible at turn_count 1', () => {
  assert.equal(isReachEligibleForTurn('brain_consult', 1), false);
});
check('brain_consult ineligible at turn_count 2', () => {
  assert.equal(isReachEligibleForTurn('brain_consult', 2), false);
});
check('deep_research ineligible at turn_count 1', () => {
  assert.equal(isReachEligibleForTurn('deep_research', 1), false);
});
check('deep_research ineligible at turn_count 2', () => {
  assert.equal(isReachEligibleForTurn('deep_research', 2), false);
});

// Unlock at turn 5.
check('brain_consult eligible at turn_count 5', () => {
  assert.equal(isReachEligibleForTurn('brain_consult', 5), true);
});
check('deep_research eligible at turn_count 5', () => {
  assert.equal(isReachEligibleForTurn('deep_research', 5), true);
});

// The 3-4 transition band is documented in the helper; pin the inclusive
// boundary the implementation chose: < 3 suppressed, >= 3 eligible (turns 3-4
// are already past framing, so the two deep reaches unlock at turn 3).
check('brain_consult eligible at turn_count 3 (transition band boundary)', () => {
  assert.equal(isReachEligibleForTurn('brain_consult', 3), true);
});
check('deep_research eligible at turn_count 4 (transition band)', () => {
  assert.equal(isReachEligibleForTurn('deep_research', 4), true);
});

// Other reaches are NEVER suppressed by turn stage.
check('context_block eligible at turn_count 1', () => {
  assert.equal(isReachEligibleForTurn('context_block', 1), true);
});
check('contradiction eligible at turn_count 1', () => {
  assert.equal(isReachEligibleForTurn('contradiction', 1), true);
});
check('cross_room eligible at turn_count 1', () => {
  assert.equal(isReachEligibleForTurn('cross_room', 1), true);
});
check('hats eligible at turn_count 1', () => {
  assert.equal(isReachEligibleForTurn('hats', 1), true);
});

// Absent turn_count is a no-op (everything eligible) -- legacy callers stable.
check('deep_research eligible when turn_count is undefined (no-op)', () => {
  assert.equal(isReachEligibleForTurn('deep_research', undefined), true);
});
check('brain_consult eligible when turn_count is undefined (no-op)', () => {
  assert.equal(isReachEligibleForTurn('brain_consult', undefined), true);
});
check('deep_research eligible when turn_count is non-number (no-op)', () => {
  assert.equal(isReachEligibleForTurn('deep_research', 'x'), true);
});

// dispatchSensors filters an early-turn deep-reach emission. We drive the real
// chokepoint with a turn that fires the diffusion-adoption sensor (SENS-09 ->
// brain_consult). At turn_count 1 the brain_consult reach must be filtered out;
// at turn_count 5 it must be present. trace.routing_source is never touched.
function dispatchWithTurnCount(turnCount) {
  const turn = {
    userText: 'we need to think about adoption capacity and diffusion of this dual-use technology',
    signals: ['diffusion_detected'],
    turn_count: turnCount,
  };
  const tuple = { problem_type: 'adoption' };
  const trace = { routing_source: 'legacy' };
  const ctx = { roomDir: '', trace: trace, turn_count: turnCount };
  const reaches = sensors.dispatchSensors(turn, tuple, ctx);
  return { reaches, trace };
}

check('dispatchSensors suppresses brain_consult at early turn (turn_count 1)', () => {
  const { reaches } = dispatchWithTurnCount(1);
  const ids = reaches.map((r) => r.reach_id);
  assert.equal(ids.indexOf('brain_consult'), -1, 'brain_consult must be filtered out in turn 1; got ' + JSON.stringify(ids));
});

check('dispatchSensors unlocks brain_consult at turn_count 5', () => {
  const { reaches } = dispatchWithTurnCount(5);
  const ids = reaches.map((r) => r.reach_id);
  assert.notEqual(ids.indexOf('brain_consult'), -1, 'brain_consult must be present at turn 5; got ' + JSON.stringify(ids));
});

check('dispatchSensors never touches trace.routing_source (Phase 144 fence)', () => {
  const { trace } = dispatchWithTurnCount(1);
  assert.equal(trace.routing_source, 'legacy', 'routing_source must be unchanged by the eligibility filter');
});

console.log('');
console.log('  passed: ' + passed + '   failed: ' + failed);
if (failed > 0) process.exit(1);
console.log('PASS test-bch-s5-turn-stage-eligibility');
process.exit(0);
