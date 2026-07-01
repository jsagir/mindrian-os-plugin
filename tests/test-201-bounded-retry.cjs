'use strict';
// Phase 201-02 -- SEED-033 L1: opt-in bounded Ralph verify+retry on autonomous_safe steps.
//
// Default is OFF (token economy, D-167-04): safe steps are NOT critiqued unless a
// step opts in via ralph_verify:true AND a selfCritiqueFn is supplied. When opted in,
// a failed critique RE-RUNS the safe step up to a cap (bounded by the EXEC-06 budget)
// before forcing LOW_QUALITY. Material steps are NEVER retried (B3 intact); the
// existing _applySelfCritique-as-halt-input path is untouched. Irreversible steps never
// retry. All within the SYNC runChain path (the default path).

const assert = require('node:assert/strict');
const path = require('node:path');
const { runChain } = require(path.join(__dirname, '..', 'lib', 'core', 'chain-executor.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

// Posture authorities.
const safePosture = function () { return { command: 'c', autonomous_safe: true, posture: 'run' }; };
const materialPosture = function () { return { command: 'c', autonomous_safe: false, posture: 'halt' }; };

// onStep whose quality improves across attempts (fails until attemptPassAt).
function makeOnStep(passAt) {
  let attempt = 0;
  const fn = function () {
    attempt += 1;
    return { chain_output: 'out#' + attempt, quality: attempt >= passAt ? 'ok' : 'low', attempt: attempt };
  };
  fn.count = function () { return attempt; };
  return fn;
}
// A critic that fails while the step's quality is low.
const critic = function (_step, result) { return { passed: result && result.quality !== 'low' }; };

console.log('test-201-bounded-retry');

ok('opted-in safe step retries until the critique passes, then proceeds', function () {
  const onStep = makeOnStep(2); // passes on the 2nd attempt
  const res = runChain(
    [{ step: 1, command: 'c', ralph_verify: true }],
    { onStep, postureFn: safePosture, selfCritiqueFn: critic, onHalt: () => 'defer' }
  );
  assert.equal(res.completed, true, 'chain completes after the retry passes');
  assert.equal(onStep.count() >= 2, true, 'onStep was re-run at least once');
  assert.equal(res.trace[0].quality, 'ok', 'the passing retry output is recorded');
});

ok('opted-in safe step that never passes forces LOW after the cap (quality_early_stop)', function () {
  const onStep = makeOnStep(99); // never passes
  const res = runChain(
    [{ step: 1, command: 'c', ralph_verify: true }],
    { onStep, postureFn: safePosture, selfCritiqueFn: critic, onHalt: () => 'defer', ralphRetryCap: 2 }
  );
  assert.equal(res.completed, false);
  assert.equal(res.haltedAt.reason, 'quality_early_stop', 'exhausted retries force LOW -> early stop');
  // 1 initial + 2 retries = 3 onStep calls (cap honored).
  assert.equal(onStep.count(), 3, 'exactly cap+1 onStep runs, got ' + onStep.count());
});

ok('DEFAULT (no ralph_verify): safe step is NOT critiqued or retried (token economy)', function () {
  const onStep = makeOnStep(99); // always low quality
  const res = runChain(
    [{ step: 1, command: 'c' }], // no ralph_verify
    { onStep, postureFn: safePosture, selfCritiqueFn: critic, onHalt: () => 'defer' }
  );
  // With no opt-in, the safe step is not critiqued; low quality still early-stops via
  // the EXISTING quality-carry (result.quality==='low'), but onStep ran exactly ONCE.
  assert.equal(onStep.count(), 1, 'no retry without opt-in');
});

ok('MATERIAL step with ralph_verify is NOT retried (B3 intact)', function () {
  const onStep = makeOnStep(99);
  const res = runChain(
    [{ step: 1, command: 'c', ralph_verify: true, material: true }],
    { onStep, postureFn: materialPosture, selfCritiqueFn: critic, onHalt: () => 'defer' }
  );
  // Material step: gate halts it BEFORE onStep (material posture -> gate 'halt').
  assert.equal(res.completed, false);
  assert.equal(onStep.count(), 0, 'material step halts at the gate, never retried');
});

ok('IRREVERSIBLE step with ralph_verify never retries (forced-material halt)', function () {
  const onStep = makeOnStep(99);
  const res = runChain(
    [{ step: 1, command: 'deploy-thing', ralph_verify: true }],
    { onStep, postureFn: safePosture, selfCritiqueFn: critic, onHalt: () => 'defer' }
  );
  assert.equal(res.haltedAt.reason, 'forced_material');
  assert.equal(onStep.count(), 0, 'irreversible step halts, never runs onStep');
});

ok('retries are bounded by the EXEC-06 budget (maxSteps), not just the cap', function () {
  const onStep = makeOnStep(99);
  const res = runChain(
    [{ step: 1, command: 'c', ralph_verify: true }],
    { onStep, postureFn: safePosture, selfCritiqueFn: critic, onHalt: () => 'defer', ralphRetryCap: 10, maxSteps: 2 }
  );
  // maxSteps 2 caps total onStep runs to <= 2 despite a cap of 10.
  assert.equal(onStep.count() <= 2, true, 'budget bounds retries, got ' + onStep.count());
});

console.log('\nPASS test-201-bounded-retry (' + n + ' assertions)');
