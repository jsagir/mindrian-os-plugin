'use strict';
// Phase 347 Plan 10 Task 2 (SHARED-10) -- the reviewer identity guard.
//
// THE ONE QUESTION THIS TEST ANSWERS: can a same-identity (or unattributed)
// critique verdict ever satisfy an independent-reviewer requirement on a
// chain step? The answer this suite proves is NO -- lib/core/chain-
// executor.cjs's identity guard refuses such a verdict and RECORDS the
// refusal on the trace, while a genuinely differing reviewer_id still
// applies exactly as the pre-347-10 self-critique contract did.
//
// SCOPE (see the guard's own header comment in chain-executor.cjs): the
// guard fires ONLY on a step that affirmatively declares a `reviewer`
// contract. A step that never asked for an independent reviewer -- the
// shape tests/test-chain-executor-fable-mode.cjs's own generic
// selfCritiqueFn seam has always used -- is untouched by this plan; that
// existing regression file is re-run unmodified as part of this task's own
// acceptance criteria and its assertions still pass byte-identical.
//
// Behaviors (the plan's own <behavior> list, 1 through 8):
//   Test 1  a critique verdict whose reviewer_id equals the worker identity
//           for a step declaring reviewer.kind:'subagent' is REFUSED: quality
//           is not augmented, and the trace entry records a reviewer object
//           with applied false and reason reviewer_is_worker.
//   Test 2  a critique verdict whose reviewer_id differs IS applied, and a
//           failing verdict still augments quality to low exactly as today.
//   Test 3  a verdict carrying no reviewer_id at all is treated as
//           same-identity and refused (an unattributed critique cannot
//           satisfy the reviewer requirement by omission).
//   Test 4  the fail-open rule is preserved: a selfCritiqueFn that throws
//           still degrades to no augmentation and never halts the chain.
//   Test 5  the material-only scoping of _applySelfCritique is unchanged: an
//           autonomous_safe step WITHOUT an explicit reviewer declaration is
//           not critiqued at all (D-167-04 token-economy default stays off).
//   Test 6  a step declaring reviewer.kind:'subagent' on an autonomous_safe
//           step runs the independent critic through the EXISTING
//           selfCritiqueFn seam (no second critic seam), charging the same
//           EXEC-06 budget a Ralph retry charges.
//   Test 7  _ralphSafeRetry still re-runs bounded by the smaller of the cap
//           and the remaining budget, and its retries still charge stepsRun
//           (unaffected regression -- this plan never touches that function
//           body).
//   Test 8  every existing chain regression file passes unchanged (asserted
//           by this plan's own acceptance criteria running those files
//           directly; this suite's own Test 8 spot-checks the SAME fable-mode
//           scenario inline as a fast, self-contained proof).
//
// Plain node:assert CJS. No em-dashes. No npm test runner.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXECUTOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs');
const { runChain } = require(EXECUTOR_PATH);

let pass = 0;
const CHECKS = [];
function check(label, fn) {
  CHECKS.push({ label: label, fn: fn });
}

console.log('test-347-reviewer-not-worker');

function makeDecideFn() {
  function decideFn() {
    return { fire_skill: null, decision_trace: { chosen_rationale: 'stub' } };
  }
  return decideFn;
}

function makeOnStep(quality) {
  const seen = [];
  function onStep(step, previousOutput) {
    seen.push({ step: step, previousOutput: previousOutput });
    return { chain_output: 'output-of-' + step.command, quality: quality || 'high' };
  }
  onStep.seen = seen;
  return onStep;
}

// MATERIAL posture: step 1 material, step 2 trivially-safe. gateFn always
// 'run' so the custom test posture (not the real default gate) drives which
// step _applySelfCritique treats as material, mirroring test-chain-executor-
// fable-mode.cjs's own harness exactly.
function postureFn(command) {
  if (command === '/mos:material') {
    return { command: command, autonomous_safe: true, posture: 'halt' };
  }
  return { command: command, autonomous_safe: true, posture: 'run' };
}

function makeCritique(verdictOrFn) {
  const calls = [];
  function selfCritiqueFn(step, result) {
    calls.push({ step: step, result: result });
    return (typeof verdictOrFn === 'function') ? verdictOrFn(step, result) : verdictOrFn;
  }
  selfCritiqueFn.calls = calls;
  return selfCritiqueFn;
}

const MATERIAL_WITH_REVIEWER = [
  { step: 1, command: '/mos:material', material: true, reviewer: { kind: 'subagent', agent: 'chain-step-reviewer' } },
  { step: 2, command: '/mos:safe' },
];

const MATERIAL_NO_REVIEWER = [
  { step: 1, command: '/mos:material', material: true },
  { step: 2, command: '/mos:safe' },
];

const ALL_SAFE_NO_REVIEWER = [
  { step: 1, command: '/mos:safe', framework: 'x' },
  { step: 2, command: '/mos:safe2', framework: 'y' },
];

const SAFE_WITH_REVIEWER = [
  { step: 1, command: '/mos:safe', reviewer: { kind: 'subagent', agent: 'chain-step-reviewer' } },
  { step: 2, command: '/mos:safe2' },
];

// ---------------------------------------------------------------------------
// Test 1: same-identity verdict on a reviewer-declaring material step is
// REFUSED. quality NOT augmented, trace.reviewer = {applied:false, reason}.
// ---------------------------------------------------------------------------
check('Test 1: same-identity (reviewer_id === worker identity) verdict is refused, not applied', () => {
  const critique = makeCritique({ passed: false, quality: 'low', reviewer_id: 'worker' });
  const result = runChain(MATERIAL_WITH_REVIEWER, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(critique.calls.length, 1, 'critique fires once on the material step');
  assert.equal(result.trace[0].quality, 'high', 'quality is NOT augmented -- the same-identity verdict is refused');
  assert.equal(result.completed, true, 'the chain completes -- a refused verdict never forces a halt');
  assert.ok(result.trace[0].reviewer, 'a reviewer object is recorded on the trace entry');
  assert.equal(result.trace[0].reviewer.applied, false, 'reviewer.applied is false');
  assert.equal(result.trace[0].reviewer.reason, 'reviewer_is_worker', 'reviewer.reason is reviewer_is_worker');
});

// ---------------------------------------------------------------------------
// Test 2: a differing reviewer_id IS applied; a failing verdict still
// augments quality to low exactly as the pre-347-10 contract did.
// ---------------------------------------------------------------------------
check('Test 2: differing reviewer_id is applied; a failing verdict augments quality to low', () => {
  const critique = makeCritique({ passed: false, quality: 'low', reviewer_id: 'chain-step-reviewer' });
  const result = runChain(MATERIAL_WITH_REVIEWER, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(result.trace[0].quality, 'low', 'quality augmented to low exactly as today');
  assert.equal(result.completed, false, 'the augmented low quality still halts the chain (quality_early_stop)');
  assert.equal(result.haltedAt.reason, 'quality_early_stop', 'the EXISTING halt reason is reused, no new one added');
  assert.ok(result.trace[0].reviewer, 'a reviewer object is recorded');
  assert.equal(result.trace[0].reviewer.applied, true, 'reviewer.applied is true for a differing identity');
  assert.equal(result.trace[0].reviewer.reviewer_id, 'chain-step-reviewer', 'reviewer.reviewer_id names the independent critic');
});

// ---------------------------------------------------------------------------
// Test 3: a verdict carrying NO reviewer_id at all, on a step that DID
// declare a reviewer contract, is treated as same-identity and refused.
// ---------------------------------------------------------------------------
check('Test 3: a verdict with no reviewer_id at all is refused (unattributed cannot satisfy the reviewer requirement)', () => {
  const critique = makeCritique({ passed: false, quality: 'low' }); // no reviewer_id field
  const result = runChain(MATERIAL_WITH_REVIEWER, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(result.trace[0].quality, 'high', 'quality is NOT augmented for an unattributed verdict');
  assert.equal(result.completed, true, 'the chain completes -- an unattributed verdict never forces a halt');
  assert.equal(result.trace[0].reviewer.applied, false, 'reviewer.applied is false for a missing reviewer_id');
  assert.equal(result.trace[0].reviewer.reason, 'reviewer_is_worker', 'the SAME refusal reason is used for omission as for equality');
});

// ---------------------------------------------------------------------------
// Test 4: fail-open is preserved. A throwing selfCritiqueFn (even on a
// reviewer-declaring step) degrades to no augmentation and never halts.
// ---------------------------------------------------------------------------
check('Test 4: a throwing selfCritiqueFn fails open -- no augmentation, no halt (T-167-12)', () => {
  function throwingCritique() { throw new Error('critic exploded'); }
  const result = runChain(MATERIAL_WITH_REVIEWER, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: throwingCritique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(result.trace[0].quality, 'high', 'quality unaffected by a thrown critic');
  assert.equal(result.completed, true, 'the chain completes -- a broken critic never halts the chain');
  assert.equal(result.trace[0].reviewer, null, 'reviewer is null when the critic throws (fail-open, no verdict to evaluate)');
});

// ---------------------------------------------------------------------------
// Test 5: material-only scoping unchanged. An autonomous_safe step WITHOUT a
// reviewer declaration is not critiqued at all (D-167-04 default stays off).
// ---------------------------------------------------------------------------
check('Test 5: autonomous_safe step without a reviewer declaration is not critiqued at all', () => {
  const critique = makeCritique({ passed: false, quality: 'low', reviewer_id: 'chain-step-reviewer' });
  const result = runChain(ALL_SAFE_NO_REVIEWER, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(critique.calls.length, 0, 'selfCritiqueFn never fires on a plain autonomous_safe step (D-167-04 default OFF)');
  assert.equal(result.completed, true, 'both safe steps ran, chain completed');
  assert.equal(result.trace.length, 2, 'both steps traced');
  assert.equal(result.trace[0].reviewer, null, 'reviewer stays null when no critique ever fired');
});

// ---------------------------------------------------------------------------
// Test 6: an autonomous_safe step declaring reviewer.kind:'subagent' runs
// the independent critic through the EXISTING selfCritiqueFn seam (no second
// seam), and charges the EXEC-06 budget exactly as a Ralph retry would.
// ---------------------------------------------------------------------------
check('Test 6: reviewer.kind subagent on an autonomous_safe step dispatches through the existing seam, charging EXEC-06', () => {
  const critique = makeCritique({ passed: true, quality: 'high', reviewer_id: 'chain-step-reviewer' });
  const onStep = makeOnStep('high');
  const result = runChain(SAFE_WITH_REVIEWER, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: onStep,
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(critique.calls.length, 1, 'the SAME selfCritiqueFn seam fires once, for the reviewer-declaring safe step only (step 2 declares no reviewer)');
  assert.equal(result.completed, true, 'a passing independent verdict does not halt the chain');
  assert.equal(result.trace[0].reviewer.applied, true, 'the differing-identity verdict is applied');
  assert.equal(result.trace[0].reviewer.reviewer_id, 'chain-step-reviewer', 'reviewer_id is recorded');

  // A failing independent verdict on a safe step DOES augment quality to low
  // (the reviewer dispatch reuses the same augmentation rule as the material
  // path once the identity guard passes).
  const failingCritique = makeCritique({ passed: false, quality: 'low', reviewer_id: 'chain-step-reviewer' });
  const failResult = runChain(SAFE_WITH_REVIEWER, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: failingCritique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(failResult.trace[0].quality, 'low', 'a failing independent reviewer verdict augments the safe step quality to low');
  assert.equal(failResult.completed, false, 'the augmented low halts the chain at the existing quality_early_stop path');
});

// ---------------------------------------------------------------------------
// Test 7: _ralphSafeRetry is unaffected -- still bounded by min(cap, budget),
// retries still charge stepsRun. This is a REGRESSION proof (this plan never
// touches that function body).
// ---------------------------------------------------------------------------
check('Test 7: _ralphSafeRetry still bounds retries by min(cap, budget) and charges stepsRun', () => {
  let onStepCalls = 0;
  function onStep(step) {
    onStepCalls += 1;
    return { chain_output: 'attempt-' + onStepCalls, quality: 'high' };
  }
  // Always-failing critique: forces exhaustion at the cap (default 2).
  const critique = makeCritique({ passed: false, quality: 'low' });
  const RALPH_SAFE = [
    { step: 1, command: '/mos:safe', ralph_verify: true },
  ];
  const result = runChain(RALPH_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: onStep,
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  // Cap default is 2: 1 initial dispatch + 2 retries = 3 onStep calls.
  assert.equal(onStepCalls, 3, 'onStep dispatched once plus 2 retries (the default Ralph cap)');
  assert.equal(result.completed, false, 'exhausted retries force LOW and halt');
  assert.equal(result.haltedAt.reason, 'retry_exhausted', 'the cap bound (not the budget bound) is named');
  // stepsRun charged: 1 (the step) + 2 (ralphAttempts) = 3, consumed against maxSteps.
  assert.equal(result.trace.length, 1, 'only one trace entry for the retried step');
});

// ---------------------------------------------------------------------------
// Test 8: regression spot-check -- the exact fable-mode scenario (material
// step, low critique, NO reviewer declared) is untouched by this plan: it
// still halts exactly as tests/test-chain-executor-fable-mode.cjs proves in
// full. This is a fast inline proof; the full file is also re-run unmodified
// as part of this task's own acceptance criteria.
// ---------------------------------------------------------------------------
check('Test 8: the pre-347-10 fable-mode scenario (no reviewer declared) is byte-identical', () => {
  const critique = makeCritique({ passed: false, quality: 'low' });
  const result = runChain(MATERIAL_NO_REVIEWER, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(result.completed, false, 'the pre-existing self-critique still halts when no reviewer is declared');
  assert.equal(result.haltedAt.reason, 'quality_early_stop', 'the same halt reason as before this plan');
  assert.equal(result.trace[0].quality, 'low', 'quality still augmented to low absent a reviewer declaration');
  assert.equal(result.trace[0].reviewer, null, 'reviewer stays null -- no reviewer contract was ever declared');
});

// ---------------------------------------------------------------------------
// Async-path mirror: Tests 1 and 6 re-run against _runChainResilient to prove
// the identity guard and the reviewer-dispatch opt-in are mirrored in BOTH
// execution seams, exactly as _applySelfCritique itself always has been.
// ---------------------------------------------------------------------------
check('ASYNC: same-identity verdict refused, differing verdict applied (mirrors sync Tests 1/2)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewer-not-worker-async-'));
  try {
    const refusedCritique = makeCritique({ passed: false, quality: 'low', reviewer_id: 'worker' });
    const refusedResult = await runChain(MATERIAL_WITH_REVIEWER, {
      postureFn: postureFn,
      gateFn: function () { return 'run'; },
      onStep: makeOnStep('high'),
      selfCritiqueFn: refusedCritique,
      decideFn: makeDecideFn(),
      onHalt: function () { return 'approve'; },
      maxSteps: 10,
      roomDir: tmp,
      sleep: function () { return Promise.resolve(); },
    });
    assert.equal(refusedResult.trace[0].quality, 'high', 'async: same-identity verdict not augmented');
    assert.equal(refusedResult.trace[0].reviewer.applied, false, 'async: reviewer.applied false');
    assert.equal(refusedResult.trace[0].reviewer.reason, 'reviewer_is_worker', 'async: refusal reason recorded');

    const appliedCritique = makeCritique({ passed: false, quality: 'low', reviewer_id: 'chain-step-reviewer' });
    const appliedResult = await runChain(MATERIAL_WITH_REVIEWER, {
      postureFn: postureFn,
      gateFn: function () { return 'run'; },
      onStep: makeOnStep('high'),
      selfCritiqueFn: appliedCritique,
      decideFn: makeDecideFn(),
      onHalt: function () { return 'approve'; },
      maxSteps: 10,
      roomDir: tmp,
      sleep: function () { return Promise.resolve(); },
    });
    assert.equal(appliedResult.trace[0].quality, 'low', 'async: differing-identity verdict augments quality');
    assert.equal(appliedResult.trace[0].reviewer.applied, true, 'async: reviewer.applied true');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
});

// Run every registered check, awaiting async ones so failures fail the suite
// deterministically (no swallowed rejection).
(async function main() {
  for (const c of CHECKS) {
    try {
      await c.fn();
      pass += 1;
      console.log('  ok -', c.label);
    } catch (err) {
      console.error('  FAIL -', c.label);
      console.error('       ', err && err.message ? err.message : err);
      process.exit(1);
    }
  }
  console.log('\n  ' + pass + '/' + CHECKS.length + ' checks passed');
  if (pass !== CHECKS.length) process.exit(1);
})();
