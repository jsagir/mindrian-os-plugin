'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 166-03 Task 2 -- graceful-partial test (EXEC-05 / D-166-01)
 * ================================================================
 * Deterministic, no Math.random, no real network. A fault-injecting stub onStep
 * over a tmp room journal (pipeline-state.cjs) drives every assertion.
 *
 * Behaviors asserted (the plan's <behavior> block):
 *   T1  step 3 of 4 ALWAYS throws a transient error -> after retry exhaustion
 *       runChain returns { completed:false, partial:true, haltedAt: step3 } with
 *       the trace PRESERVING steps 1 and 2 (upstream intact, never dropped) and a
 *       failure marker for step 3.
 *   T2  the failure marker names the transient code + the step; upstream
 *       chain_outputs are still readable in the trace (graceful, not a throw).
 *   T3  resume -- after a graceful partial journaled to pipeline-state.cjs,
 *       re-entering runChain resumes at the journaled position (step 3) and
 *       steps 1 and 2 are NOT re-run (reuses the Wave-1 isNext hard gate +
 *       recordStep journal, D-166-02).
 *   T4  a NON-transient error at a step fails fast (no retry) and STILL returns a
 *       graceful partial preserving upstream (a hard failure must not silently
 *       drop the chain either).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const exec = require(path.join(__dirname, '..', 'lib', 'core', 'chain-executor.cjs'));
const pipelineState = require(path.join(__dirname, '..', 'lib', 'mcp', 'pipeline-state.cjs'));
const { runChain } = exec;

let passed = 0;
function ok(label) { passed += 1; console.log('  ok - ' + label); }

function mkTmpRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-166-03-'));
}

// A transient-status error helper.
function transientErr(code) {
  const e = new Error('upstream ' + code + ' transient');
  e.status = code;
  return e;
}

// Four steps: a, b, c, d. autonomous_safe posture so the gate greenlights each.
function fourSteps() {
  return [
    { step: 1, command: 'research' },
    { step: 2, command: 'validate' },
    { step: 3, command: 'synthesize' },
    { step: 4, command: 'consolidate' },
  ];
}

// A posture authority stub: everything is push_forward / autonomous_safe and
// reversible, so the gate never halts on its own -- the ONLY stop is the
// injected fault (so we isolate the graceful-partial behavior).
function allRunPostureFn(command) {
  return { command: command, autonomous_safe: true, posture: 'run' };
}

// No real next-step engine; decideFn returns a null trace handle.
function nullDecideFn() { return { decision_trace: null }; }

// ---------------------------------------------------------------------------
// T1 + T2: step 3 always transient -> exhaustion -> graceful partial preserving
// upstream + a failure marker naming the code and step.
// ---------------------------------------------------------------------------
(async function t1t2() {
  const room = mkTmpRoom();
  const onStep = function (step) {
    if (step.step === 3) throw transientErr(529);
    return { chain_output: { from: step.command, value: 'out-' + step.step }, quality: 'high' };
  };
  const result = await runChain(fourSteps(), {
    postureFn: allRunPostureFn,
    decideFn: nullDecideFn,
    onStep: onStep,
    sleep: function () {}, // instant retries
    retries: 2,
    roomDir: room,
    journal: true,
  });

  // graceful partial, never a throw, never null
  assert.ok(result, 'runChain returns a result (never null)');
  assert.strictEqual(result.completed, false, 'completed:false');
  assert.strictEqual(result.partial, true, 'partial:true (graceful partial flag)');
  assert.ok(result.haltedAt, 'haltedAt present');
  assert.strictEqual(result.haltedAt.step.step, 3, 'haltedAt names step 3');

  // upstream PRESERVED: steps 1 and 2 chain_outputs are intact in the trace
  const upstream = result.trace.filter(function (t) { return t.chain_output; });
  assert.strictEqual(upstream.length, 2, 'steps 1 and 2 preserved in the trace');
  assert.strictEqual(result.trace[0].chain_output.value, 'out-1', 'step 1 output intact');
  assert.strictEqual(result.trace[1].chain_output.value, 'out-2', 'step 2 output intact');

  // a failure marker for step 3 folded into the ONE trace
  const failureEntry = result.trace.find(function (t) { return t.failure; });
  assert.ok(failureEntry, 'a failure marker entry is folded into the trace');
  assert.strictEqual(failureEntry.step.step, 3, 'failure marker names step 3');
  assert.strictEqual(failureEntry.failure.code, 529, 'failure marker names the transient code 529');
  assert.ok(/exhaust/i.test(failureEntry.failure.reason), 'failure reason mentions exhaustion');
  ok('T1+T2 transient exhaustion -> graceful partial: upstream preserved + failure marker (code+step)');
})();

// ---------------------------------------------------------------------------
// T3: resume from the journal. After a graceful partial journaled steps 1+2 to
// pipeline-state, re-entering runChain resumes at step 3 -- steps 1 and 2 NOT
// re-run.
// ---------------------------------------------------------------------------
(async function t3() {
  const room = mkTmpRoom();
  // Seed the chain journal so the Wave-1 isNext hard gate has a chain to resume.
  pipelineState.initChain(room, ['research', 'validate', 'synthesize', 'consolidate'], 'manual');

  const firstRunCalls = [];
  const onStepFail = function (step) {
    firstRunCalls.push(step.command);
    if (step.step === 3) throw transientErr(500);
    return { chain_output: { value: 'out-' + step.step }, quality: 'high' };
  };
  const first = await runChain(fourSteps(), {
    postureFn: allRunPostureFn,
    decideFn: nullDecideFn,
    onStep: onStepFail,
    sleep: function () {},
    retries: 1,
    roomDir: room,
    journal: true,
  });
  assert.strictEqual(first.partial, true, 'first run is a graceful partial');
  // steps 1 and 2 were journaled via recordStep
  const afterFirst = pipelineState.read(room);
  assert.ok(afterFirst, 'journal exists after first run');
  const journaledTools = afterFirst.history.map(function (h) { return h.tool; });
  assert.ok(journaledTools.indexOf('research') !== -1, 'step 1 journaled');
  assert.ok(journaledTools.indexOf('validate') !== -1, 'step 2 journaled');

  // RE-ENTER: the second run reuses the journal. Steps 1 and 2 are already at
  // the journaled position, so the resume re-enters at step 3 and does NOT
  // re-run 1 and 2.
  const secondRunCalls = [];
  const onStepOk = function (step) {
    secondRunCalls.push(step.command);
    return { chain_output: { value: 'out-' + step.step }, quality: 'high' };
  };
  const second = await runChain(fourSteps(), {
    postureFn: allRunPostureFn,
    decideFn: nullDecideFn,
    onStep: onStepOk,
    sleep: function () {},
    retries: 1,
    roomDir: room,
    journal: true,
    resume: true,
  });
  assert.ok(second, 'second run returns a result');
  assert.strictEqual(secondRunCalls.indexOf('research'), -1, 'step 1 NOT re-run on resume');
  assert.strictEqual(secondRunCalls.indexOf('validate'), -1, 'step 2 NOT re-run on resume');
  assert.ok(secondRunCalls.indexOf('synthesize') !== -1, 'step 3 IS run on resume (the failed step)');
  ok('T3 resume re-enters at the journaled failed step; upstream steps NOT re-run (D-166-02)');
})();

// ---------------------------------------------------------------------------
// T4: a NON-transient error at a step fails fast (no retry) but STILL returns a
// graceful partial preserving upstream.
// ---------------------------------------------------------------------------
(async function t4() {
  const room = mkTmpRoom();
  let step3Attempts = 0;
  const onStep = function (step) {
    if (step.step === 3) {
      step3Attempts += 1;
      const e = new Error('validation: malformed input');
      e.status = 422; // non-transient
      throw e;
    }
    return { chain_output: { value: 'out-' + step.step }, quality: 'high' };
  };
  const result = await runChain(fourSteps(), {
    postureFn: allRunPostureFn,
    decideFn: nullDecideFn,
    onStep: onStep,
    sleep: function () {},
    retries: 3,
    roomDir: room,
    journal: true,
  });
  assert.ok(result, 'returns a result (never null) on a hard failure too');
  assert.strictEqual(result.completed, false, 'completed:false');
  assert.strictEqual(result.partial, true, 'partial:true even on a non-transient hard failure');
  assert.strictEqual(step3Attempts, 1, 'non-transient failed fast: step 3 tried exactly once (no retry)');
  // upstream preserved
  assert.strictEqual(result.trace[0].chain_output.value, 'out-1', 'step 1 output intact');
  assert.strictEqual(result.trace[1].chain_output.value, 'out-2', 'step 2 output intact');
  const failureEntry = result.trace.find(function (t) { return t.failure; });
  assert.ok(failureEntry, 'a failure marker entry is folded in');
  assert.strictEqual(failureEntry.step.step, 3, 'failure marker names step 3');
  assert.ok(/non.?transient|hard|fail/i.test(failureEntry.failure.reason), 'failure reason marks the hard failure');
  ok('T4 non-transient fails fast (no retry) and STILL returns a graceful partial preserving upstream');
})();

setTimeout(function () {
  console.log('PARTIAL_OK ' + passed + '/4');
  if (passed !== 4) process.exit(1);
}, 80);
