'use strict';
// Phase 166-02 Task 2 -- the posture x evidence-quality gate + forced-material + budget (EXEC-03 / EXEC-06).
//
// The default gateFn (makeGateFn) is the SPEC's single leverage point. It returns 'run'
// ONLY when the step is autonomous_safe (posture push_forward -> 'run') AND the inbound
// priorOutput.quality is NOT 'low' AND the step is NOT irreversible. Otherwise 'halt'.
// An irreversible step is FORCED-MATERIAL and halts regardless of an autonomous_safe tag
// (HARD RULE + D-166-05). EXEC-06 caps the run via maxSteps and a quality early-stop, each
// recording a haltedAt reason.
//
// Four behaviors:
//   Test 1 (EXEC-03 base): the default gate returns 'run' for push_forward + not-low;
//           a 'hold' / 'pull_back' posture returns 'halt'.
//   Test 2 (EXEC-02 -> EXEC-03 quality halt): an autonomous_safe step whose inbound
//           priorOutput.quality === 'low' returns 'halt'.
//   Test 3 (EXEC-03 forced-material): an irreversible step (email / deploy / publish /
//           external write) returns 'halt' REGARDLESS of an autonomous_safe tag.
//   Test 4 (EXEC-06 budget): runChain with maxSteps:2 over a 5-step chain halts after 2
//           steps naming the budget brake; a quality early-stop also terminates with a
//           recorded reason.
//
// Plain node assert harness. NO em-dashes. node built-ins only. Stub postureFn / onStep.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXECUTOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs');
const { runChain, makeGateFn } = require(EXECUTOR_PATH);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-chain-executor-gate');

// A stub posture authority: maps a command to a posture verdict object shaped like
// recipe-maps.postureForCommand returns ({ command, autonomous_safe, posture }).
function makePostureFn(table) {
  return function postureFn(command) {
    const v = table[command];
    if (v) return Object.assign({ command: command }, v);
    return { command: command || null, autonomous_safe: false, posture: 'halt' };
  };
}

// (1) EXEC-03 base: push_forward + not-low -> 'run'; hold / pull_back -> 'halt'.
check('default gate runs only push_forward (autonomous_safe); hold / pull_back halt', () => {
  const postureFn = makePostureFn({
    '/mos:safe': { autonomous_safe: true, posture: 'run' },   // push_forward
    '/mos:hold': { autonomous_safe: false, posture: 'halt' }, // hold
    '/mos:pull': { autonomous_safe: false, posture: 'halt' }, // pull_back
  });
  const gate = makeGateFn({ postureFn: postureFn });

  const high = { quality: 'high' };
  assert.equal(gate({ step: 1, command: '/mos:safe' }, null, high), 'run', 'autonomous_safe + high -> run');
  assert.equal(gate({ step: 2, command: '/mos:hold' }, null, high), 'halt', 'hold posture -> halt');
  assert.equal(gate({ step: 3, command: '/mos:pull' }, null, high), 'halt', 'pull_back posture -> halt');
});

// (2) EXEC-02 -> EXEC-03 quality halt: autonomous_safe + inbound quality:low -> 'halt'.
check('an autonomous_safe step with inbound priorOutput.quality === low halts (no garbage propagation)', () => {
  const postureFn = makePostureFn({
    '/mos:safe': { autonomous_safe: true, posture: 'run' },
  });
  const gate = makeGateFn({ postureFn: postureFn });

  const low = { quality: 'low' };
  const high = { quality: 'high' };
  assert.equal(gate({ step: 1, command: '/mos:safe' }, null, low), 'halt', 'low inbound quality halts an autonomous_safe step');
  assert.equal(gate({ step: 1, command: '/mos:safe' }, null, high), 'run', 'high inbound quality runs the same step');
});

// (3) EXEC-03 forced-material: an irreversible step halts regardless of autonomous_safe.
check('an irreversible step is forced-material and halts regardless of an autonomous_safe tag', () => {
  // Tag every command autonomous_safe so ONLY the irreversibility can cause a halt.
  const postureFn = function () { return { autonomous_safe: true, posture: 'run' }; };
  const gate = makeGateFn({ postureFn: postureFn });
  const high = { quality: 'high' };

  // explicit flag
  assert.equal(gate({ step: 1, command: '/mos:anything', irreversible: true }, null, high), 'halt',
    'explicit step.irreversible forces a halt even when autonomous_safe');
  // keyword class: email / deploy / publish / external write
  assert.equal(gate({ step: 2, command: '/mos:send-email' }, null, high), 'halt', 'an email command is forced-material');
  assert.equal(gate({ step: 3, command: '/mos:deploy' }, null, high), 'halt', 'a deploy command is forced-material');
  assert.equal(gate({ step: 4, command: '/mos:publish' }, null, high), 'halt', 'a publish command is forced-material');
  // a reversible autonomous_safe command still runs (control)
  assert.equal(gate({ step: 5, command: '/mos:lean-canvas' }, null, high), 'run', 'a reversible autonomous_safe command runs');
});

// (4) EXEC-06 budget: maxSteps cap + quality early-stop, each with a recorded reason.
check('maxSteps caps the run and a quality early-stop terminates with a recorded reason', () => {
  const fiveSteps = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b' },
    { step: 3, command: '/mos:c' },
    { step: 4, command: '/mos:d' },
    { step: 5, command: '/mos:e' },
  ];
  // Everything autonomous_safe + run so ONLY the budget brake stops the chain.
  const postureFn = function () { return { autonomous_safe: true, posture: 'run' }; };
  const onStepHigh = function (step) { return { chain_output: 'out-' + step.step, quality: 'high' }; };

  const capped = runChain(fiveSteps, {
    decideFn: function () { return { decision_trace: {} }; },
    postureFn: postureFn,
    onStep: onStepHigh,
    onHalt: function () { return 'defer'; },
    maxSteps: 2,
  });
  assert.equal(capped.completed, false, 'a budget-capped chain is not completed');
  assert.equal(capped.trace.length, 2, 'exactly maxSteps steps ran');
  assert.ok(capped.haltedAt, 'haltedAt is set');
  assert.equal(capped.haltedAt.reason, 'budget_brake', 'haltedAt names the budget brake');
  assert.equal(capped.haltedAt.maxSteps, 2, 'the budget brake records the cap');

  // Quality early-stop: step 2 returns quality:low on a gate-passed path -> terminate.
  let dispatched = 0;
  const onStepLowAt2 = function (step) {
    dispatched += 1;
    return { chain_output: 'out-' + step.step, quality: step.step === 2 ? 'low' : 'high' };
  };
  const early = runChain(fiveSteps, {
    decideFn: function () { return { decision_trace: {} }; },
    postureFn: postureFn,
    onStep: onStepLowAt2,
    onHalt: function () { return 'defer'; },
    maxSteps: 10,
  });
  assert.equal(early.completed, false, 'a quality early-stopped chain is not completed');
  assert.equal(early.haltedAt.reason, 'quality_early_stop', 'haltedAt names the quality early-stop');
  assert.equal(early.haltedAt.quality, 'low', 'the early-stop records the low quality');
  // step 1 (high) + step 2 (low, which terminates after it lands in the trace).
  assert.equal(early.trace.length, 2, 'the low-quality step lands in the trace, then the chain stops');
  assert.equal(dispatched, 2, 'no step beyond the low-quality one is dispatched');
});

console.log('');
console.log('GATE_OK', pass + '/4');
