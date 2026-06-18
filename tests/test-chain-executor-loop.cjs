'use strict';
// Phase 166-02 Task 1 -- chain-executor runChain loop test (EXEC-01 / EXEC-02 / EXEC-04, B2).
//
// runChain is the ONE shared gated loop in lib/core (CLI + MCP). This suite covers the
// loop runner, output-passing with the quality enum carried forward, the single chain
// trace built from the unchanged decide() decision_trace plus each chain_output, and the
// [stop] kill switch that flushes (returns the trace built so far) and ends cleanly.
//
// Four behaviors:
//   Test 1 (EXEC-01 + EXEC-02): 3 autonomous_safe stub steps run end to end; each onStep
//           receives the PRIOR step's chain_output as previousOutput (output passed each
//           hop); result { completed:true, haltedAt:null } and all 3 ran.
//   Test 2 (EXEC-04 single trace + B2): the trace is ONE ordered array; each entry carries
//           the step + its chain_output + the per-loop decide() decision_trace handle, and
//           the recorded handle is reference-equal to what decideFn returned (the loop never
//           reshapes decide()'s return -- B2).
//   Test 3 (EXEC-04 kill switch): a [stop] verb from onHalt ends with completed:false,
//           haltedAt set to the stop step, and the trace contains every step that ran above
//           the stop (flush, not drop).
//   Test 4 (EXEC-01): runChain re-calls the injected decideFn ONCE PER LOOP (call count ===
//           steps run), proving the next reach is re-derived per step from decide(), not
//           precomputed and not read from rankedNextReach.
//
// Plain node assert harness. NO em-dashes. node built-ins only. Stub callbacks only
// (no real agent dispatch).

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXECUTOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs');
const { runChain } = require(EXECUTOR_PATH);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-chain-executor-loop');

// A stub decideFn that returns a fresh decision_trace-bearing decision each call, and
// counts its calls. The returned object is what the loop MUST record UNCHANGED (B2).
function makeDecideFn() {
  const calls = [];
  function decideFn(turn, context) {
    const decision = {
      fire_skill: null,
      decision_trace: { chosen_rationale: 'stub decide call ' + (calls.length + 1) },
    };
    calls.push({ turn: turn, context: context, returned: decision });
    return decision;
  }
  decideFn.calls = calls;
  return decideFn;
}

// A stub onStep that records the previousOutput it was handed and returns a
// chain_output carrying the quality enum. Each step's chain_output is unique so the
// next hop's previousOutput can be asserted equal to it.
function makeOnStep(quality) {
  const seen = [];
  function onStep(step, previousOutput) {
    seen.push({ step: step, previousOutput: previousOutput });
    return {
      chain_output: 'output-of-' + step.command,
      quality: quality || 'high',
    };
  }
  onStep.seen = seen;
  return onStep;
}

const STEPS = [
  { step: 1, command: '/mos:a' },
  { step: 2, command: '/mos:b' },
  { step: 3, command: '/mos:c' },
];

// (1) EXEC-01 + EXEC-02: 3 autonomous_safe steps run end to end; output passed each hop.
check('runChain runs 3 autonomous_safe steps end to end and passes chain_output each hop', () => {
  const onStep = makeOnStep('high');
  const decideFn = makeDecideFn();
  const result = runChain(STEPS, {
    decideFn: decideFn,
    gateFn: function () { return 'run'; },
    onStep: onStep,
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });

  assert.equal(result.completed, true, 'expected completed:true for an all-run chain');
  assert.equal(result.haltedAt, null, 'expected haltedAt null when nothing halted');
  assert.equal(result.trace.length, 3, 'expected one trace entry per step run');

  // Step 1 saw no previousOutput; step 2 saw step 1 output; step 3 saw step 2 output.
  assert.equal(onStep.seen.length, 3, 'expected onStep called once per step');
  assert.equal(onStep.seen[0].previousOutput, null, 'first step has no previousOutput');
  assert.equal(onStep.seen[1].previousOutput, 'output-of-/mos:a', 'step 2 receives step 1 chain_output');
  assert.equal(onStep.seen[2].previousOutput, 'output-of-/mos:b', 'step 3 receives step 2 chain_output');
});

// (2) EXEC-04 single trace + B2: trace entries carry step + chain_output + the UNCHANGED
//     decide() decision_trace handle (reference-equal to what decideFn returned).
check('the trace is ONE ordered array carrying step + chain_output + the unchanged decide() handle (B2)', () => {
  const onStep = makeOnStep('high');
  const decideFn = makeDecideFn();
  const result = runChain(STEPS, {
    decideFn: decideFn,
    gateFn: function () { return 'run'; },
    onStep: onStep,
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });

  assert.ok(Array.isArray(result.trace), 'trace must be an array');
  assert.equal(result.trace.length, 3, 'one entry per run step');
  for (let i = 0; i < 3; i += 1) {
    const entry = result.trace[i];
    assert.equal(entry.step, STEPS[i], 'trace entry carries the step in order');
    assert.equal(entry.chain_output, 'output-of-' + STEPS[i].command, 'trace entry carries the chain_output');
    // B2: the recorded decision_trace MUST be the SAME object decideFn returned, never reshaped.
    assert.strictEqual(
      entry.decision_trace,
      decideFn.calls[i].returned.decision_trace,
      'B2: trace records the decide() decision_trace handle UNCHANGED (reference-equal)'
    );
  }
});

// (3) EXEC-04 kill switch: [stop] from onHalt flushes the trace and ends cleanly.
check('a [stop] verb flushes the trace built so far and ends with completed:false + haltedAt set', () => {
  const onStep = makeOnStep('high');
  const decideFn = makeDecideFn();
  // gateFn halts at step 2; onHalt returns the [stop] verb.
  const result = runChain(STEPS, {
    decideFn: decideFn,
    gateFn: function (step) { return step.step === 2 ? 'halt' : 'run'; },
    onStep: onStep,
    onHalt: function () { return 'stop'; },
    maxSteps: 10,
  });

  assert.equal(result.completed, false, 'a [stop] chain is not completed');
  assert.ok(result.haltedAt, 'haltedAt must be set on a stop');
  assert.equal(result.haltedAt.step.step, 2, 'haltedAt names the stop step (the step object)');
  assert.equal(result.haltedAt.stopped, true, 'a [stop] verb marks haltedAt.stopped true');
  // Flush, not drop: step 1 ran and IS in the trace.
  assert.equal(result.trace.length, 1, 'the step that ran above the stop is flushed into the trace');
  assert.equal(result.trace[0].step.step, 1, 'step 1 ran and is preserved in the trace');
  // step 2 did NOT dispatch onStep (it halted before running).
  assert.equal(onStep.seen.length, 1, 'onStep dispatched only for the step that ran');
});

// (4) EXEC-01: decideFn re-called ONCE PER LOOP (call count === steps run).
check('runChain re-calls decideFn once per loop (next reach re-derived per step, not precomputed)', () => {
  const onStep = makeOnStep('high');
  const decideFn = makeDecideFn();
  const result = runChain(STEPS, {
    decideFn: decideFn,
    gateFn: function () { return 'run'; },
    onStep: onStep,
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(result.trace.length, 3, 'all 3 steps ran');
  assert.equal(decideFn.calls.length, 3, 'decideFn called exactly once per step run');
});

console.log('');
console.log('LOOP_OK', pass + '/4');
