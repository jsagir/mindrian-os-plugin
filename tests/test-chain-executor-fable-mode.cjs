'use strict';
// Phase 167-03 Task 1 -- chain-executor fable-mode self-critique seam
// (HARN-02 / D-167-04, MEDIUM-3 both-paths reconciliation).
//
// fable-mode is a POSTURE-SCOPED selfCritiqueFn(step, result) seam in
// lib/core/chain-executor.cjs, MIRRORED in BOTH the sync runChain path and the
// async _runChainResilient path. On a MATERIAL step a failed self-critique
// verdict AUGMENTS result.quality to LOW_QUALITY, feeding the EXISTING
// quality_early_stop / makeGateFn LOW_QUALITY halt -- so a failed self-critique
// maps autonomous_safe -> halt at the next hop in WHICHEVER path ran. There is
// NO new loop and NO auto-retry-to-convergence (166 B3); fable-mode is naming
// over the shipped quality machinery and invents NO fable model tier.
//
// Behaviors:
//   Test 1  (SYNC material critiqued -> halt): a material step + a low verdict
//           augments quality to LOW_QUALITY; the chain halts at the EXISTING
//           quality_early_stop path (no new halt reason).
//   Test 1b (ASYNC material critiqued -> SAME halt): the async _runChainResilient
//           path (driven via roomDir + injected no-op sleep) augments the same
//           material step to LOW_QUALITY and halts at the IDENTICAL
//           quality_early_stop / LOW_QUALITY path (MEDIUM-3).
//   Test 2  (trivially-safe NOT critiqued, both paths): a push_forward +
//           reversible step does NOT invoke selfCritiqueFn in either path; its
//           quality carries through unchanged (D-167-04 token-cost scoping).
//   Test 3  (default no-op, both paths): with NO selfCritiqueFn, both paths are
//           byte-identical to the Wave-166 contract (regression guard).
//   Test 4  (no new loop / no convergence): grep-assert chain-executor.cjs has no
//           autonomous-convergence stop branch added by this seam (166 B3),
//           comment-filtered.
//   Test 5  (no fable model tier): grep-assert no 'fable' model alias/tier in
//           model-profiles or the executor.
//   Test 6  (B2 unchanged, both paths): decide()'s decision_trace handle is
//           recorded by reference and unchanged by the self-critique hook.
//
// Plain node assert harness. NO em-dashes. node built-ins only. Stub callbacks.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXECUTOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs');
const { runChain } = require(EXECUTOR_PATH);

let pass = 0;
// Collect checks so sync and async cases run in declared order and async
// failures are AWAITED (not swallowed as unhandled rejections).
const CHECKS = [];
function check(label, fn) {
  CHECKS.push({ label: label, fn: fn });
}

console.log('test-chain-executor-fable-mode');

// A stub decideFn that returns a fresh decision_trace each call (the loop MUST
// record it UNCHANGED -- B2).
function makeDecideFn() {
  const calls = [];
  function decideFn(turn, context) {
    const decision = {
      fire_skill: null,
      decision_trace: { chosen_rationale: 'stub decide call ' + (calls.length + 1) },
    };
    calls.push({ returned: decision });
    return decision;
  }
  decideFn.calls = calls;
  return decideFn;
}

// A stub onStep returning a chain_output + a high quality (the critique, not the
// runner, is what drives the augmentation in these tests).
function makeOnStep(quality) {
  const seen = [];
  function onStep(step, previousOutput) {
    seen.push({ step: step, previousOutput: previousOutput });
    return { chain_output: 'output-of-' + step.command, quality: quality || 'high' };
  }
  onStep.seen = seen;
  return onStep;
}

// Posture authority: step 1 MATERIAL (posture verb !== 'run'), step 2 trivially
// safe (push_forward + reversible). gateFn returns 'run' for both so the gate
// itself never halts -- only the self-critique augmentation can.
function postureFn(command) {
  if (command === '/mos:material') {
    return { command: command, autonomous_safe: true, posture: 'halt' };
  }
  return { command: command, autonomous_safe: true, posture: 'run' };
}

// A low-verdict self-critique: returns { passed:false } so the material step's
// quality augments to LOW_QUALITY.
function makeLowCritique() {
  const calls = [];
  function selfCritiqueFn(step, result) {
    calls.push({ step: step, result: result });
    return { passed: false, quality: 'low' };
  }
  selfCritiqueFn.calls = calls;
  return selfCritiqueFn;
}

const MATERIAL_THEN_SAFE = [
  { step: 1, command: '/mos:material', material: true },
  { step: 2, command: '/mos:safe' },
];

// A reversible push_forward chain (no material step) for the trivially-safe test.
const ALL_SAFE = [
  { step: 1, command: '/mos:safe', framework: 'x' },
  { step: 2, command: '/mos:safe2', framework: 'y' },
];

// ---------------------------------------------------------------------------
// Test 1 (SYNC material step critiqued -> halt next hop)
// ---------------------------------------------------------------------------
check('SYNC: material step + low self-critique augments quality -> existing LOW_QUALITY halt', () => {
  const onStep = makeOnStep('high');
  const critique = makeLowCritique();
  const result = runChain(MATERIAL_THEN_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: onStep,
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  // The material step was critiqued.
  assert.equal(critique.calls.length, 1, 'self-critique fires once (material step 1)');
  // Quality augmented to LOW_QUALITY -> existing quality_early_stop halt.
  assert.equal(result.completed, false, 'chain did not complete (halted on augmented quality)');
  assert.ok(result.haltedAt, 'haltedAt is set');
  assert.equal(result.haltedAt.reason, 'quality_early_stop', 'reuses the EXISTING quality_early_stop reason (no new halt reason)');
  assert.equal(result.haltedAt.quality, 'low', 'the augmented quality is recorded as low');
  // The trace recorded the augmented quality on step 1.
  assert.equal(result.trace.length, 1, 'only step 1 ran; step 2 never dispatched');
  assert.equal(result.trace[0].quality, 'low', 'trace records the augmented quality');
  // Step 2 never dispatched (onStep saw only step 1).
  assert.equal(onStep.seen.length, 1, 'step 2 onStep never invoked');
});

// ---------------------------------------------------------------------------
// Test 1b (ASYNC material step critiqued -> SAME LOW_QUALITY halt)
// ---------------------------------------------------------------------------
check('ASYNC: _runChainResilient material step + low critique -> SAME quality_early_stop / LOW_QUALITY halt', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fable-async-'));
  const onStep = makeOnStep('high');
  const critique = makeLowCritique();
  const sleepCalls = [];
  // Supplying roomDir + a no-op sleep selects the ASYNC _runChainResilient path.
  const result = await runChain(MATERIAL_THEN_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: onStep,
    selfCritiqueFn: critique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
    roomDir: tmp,
    sleep: function () { sleepCalls.push(1); return Promise.resolve(); },
  });
  assert.equal(critique.calls.length, 1, 'async: self-critique fires once on the material step');
  assert.equal(result.completed, false, 'async: chain halted on augmented quality');
  assert.ok(result.haltedAt, 'async: haltedAt is set');
  assert.equal(result.haltedAt.reason, 'quality_early_stop', 'async: IDENTICAL quality_early_stop reason (seam mirrored, MEDIUM-3)');
  assert.equal(result.haltedAt.quality, 'low', 'async: augmented quality recorded as low');
  assert.equal(result.partial, false, 'async: this is a quality halt, NOT a graceful-partial (dispatchError path untouched)');
  assert.equal(result.trace.length, 1, 'async: only step 1 ran');
  assert.equal(result.trace[0].quality, 'low', 'async: trace records the augmented quality');
  assert.equal(onStep.seen.length, 1, 'async: step 2 onStep never invoked');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
});

// ---------------------------------------------------------------------------
// Test 2 (trivially-safe step NOT critiqued, both paths)
// ---------------------------------------------------------------------------
check('SYNC + ASYNC: trivially-safe push_forward reversible step does NOT invoke selfCritiqueFn', async () => {
  // SYNC drive.
  const syncCritique = makeLowCritique();
  const syncResult = runChain(ALL_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: syncCritique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(syncCritique.calls.length, 0, 'SYNC: critique skipped on all trivially-safe steps (D-167-04 token scoping)');
  assert.equal(syncResult.completed, true, 'SYNC: chain completed (no augmentation)');
  assert.equal(syncResult.trace.length, 2, 'SYNC: both safe steps ran');
  assert.equal(syncResult.trace[1].quality, 'high', 'SYNC: quality carried through unchanged');

  // ASYNC drive.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fable-async2-'));
  const asyncCritique = makeLowCritique();
  const asyncResult = await runChain(ALL_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: asyncCritique,
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
    roomDir: tmp,
    sleep: function () { return Promise.resolve(); },
  });
  assert.equal(asyncCritique.calls.length, 0, 'ASYNC: critique skipped on all trivially-safe steps');
  assert.equal(asyncResult.completed, true, 'ASYNC: chain completed (no augmentation)');
  assert.equal(asyncResult.trace.length, 2, 'ASYNC: both safe steps ran');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
});

// ---------------------------------------------------------------------------
// Test 3 (default no-op, both paths byte-identical to Wave-166)
// ---------------------------------------------------------------------------
check('SYNC + ASYNC: absent selfCritiqueFn is byte-identical to Wave-166 (no-op pass-through)', async () => {
  // SYNC: no selfCritiqueFn opt at all. Material step runs without augmentation.
  const syncResult = runChain(MATERIAL_THEN_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  assert.equal(syncResult.completed, true, 'SYNC: no critique -> both steps run, chain completes');
  assert.equal(syncResult.trace.length, 2, 'SYNC: both steps ran (no augmentation)');
  assert.equal(syncResult.trace[0].quality, 'high', 'SYNC: step 1 quality untouched without a critique');

  // ASYNC: no selfCritiqueFn opt; roomDir/sleep select the resilient path.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fable-async3-'));
  const asyncResult = await runChain(MATERIAL_THEN_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    decideFn: makeDecideFn(),
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
    roomDir: tmp,
    sleep: function () { return Promise.resolve(); },
  });
  assert.equal(asyncResult.completed, true, 'ASYNC: no critique -> both steps run, chain completes');
  assert.equal(asyncResult.trace.length, 2, 'ASYNC: both steps ran (no augmentation)');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
});

// ---------------------------------------------------------------------------
// Test 4 (no new loop / no convergence stop branch -- 166 B3 negative grep)
// ---------------------------------------------------------------------------
check('chain-executor.cjs has NO convergence-stop branch added by the seam (166 B3, comment-filtered)', () => {
  const src = fs.readFileSync(EXECUTOR_PATH, 'utf8');
  // Strip comment lines so prose that NAMES the rejected pattern does not
  // self-trip (mirror the 166-08 B3 negative grep).
  const codeLines = src.split('\n').filter(function (line) {
    const t = line.trim();
    return t.length > 0 && t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
  });
  const code = codeLines.join('\n');
  // No auto-retry-to-convergence / loop-until-passing stop condition.
  assert.ok(!/loop\s+until/i.test(code), 'no "loop until" convergence branch in code');
  assert.ok(!/until.*converge/i.test(code), 'no "until converge" branch in code');
  assert.ok(!/all[._]?passing/i.test(code), 'no "all passing" convergence stop in code');
  // Positive proof the seam is a gate INPUT only: it folds into the EXISTING
  // quality_early_stop / LOW_QUALITY path, never a new stop branch.
  assert.ok(/quality_early_stop/.test(code), 'the existing quality_early_stop halt is still present (the seam reuses it)');
});

// ---------------------------------------------------------------------------
// Test 5 (no fable model tier introduced)
// ---------------------------------------------------------------------------
check('no "fable" model alias / tier in model-profiles or the executor', () => {
  const execSrc = fs.readFileSync(EXECUTOR_PATH, 'utf8');
  const execCode = execSrc.split('\n').filter(function (line) {
    const t = line.trim();
    return t.length > 0 && t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
  }).join('\n');
  // The executor code (comments stripped) must not mint a 'fable' model alias.
  assert.ok(!/['"]fable['"]\s*:/.test(execCode), 'no fable model alias key in executor code');

  const mpPath = path.join(REPO_ROOT, 'lib', 'core', 'model-profiles.cjs');
  if (fs.existsSync(mpPath)) {
    const mp = fs.readFileSync(mpPath, 'utf8');
    assert.ok(!/fable/i.test(mp), 'model-profiles.cjs contains no fable tier (stays opus/sonnet/haiku)');
    assert.ok(/opus|sonnet|haiku/i.test(mp), 'model-profiles.cjs still names the shipped tiers');
  }
});

// ---------------------------------------------------------------------------
// Test 6 (B2 unchanged, both paths: decision_trace recorded by reference)
// ---------------------------------------------------------------------------
check('SYNC + ASYNC: decide() decision_trace handle is recorded UNCHANGED by the self-critique hook (B2)', async () => {
  // SYNC.
  const syncDecide = makeDecideFn();
  const syncResult = runChain(ALL_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: makeLowCritique(),
    decideFn: syncDecide,
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
  });
  // The recorded decision_trace is reference-equal to what decideFn returned.
  assert.equal(
    syncResult.trace[0].decision_trace,
    syncDecide.calls[0].returned.decision_trace,
    'SYNC: decision_trace recorded by reference (never reshaped by the seam)'
  );

  // ASYNC.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fable-async6-'));
  const asyncDecide = makeDecideFn();
  const asyncResult = await runChain(ALL_SAFE, {
    postureFn: postureFn,
    gateFn: function () { return 'run'; },
    onStep: makeOnStep('high'),
    selfCritiqueFn: makeLowCritique(),
    decideFn: asyncDecide,
    onHalt: function () { return 'approve'; },
    maxSteps: 10,
    roomDir: tmp,
    sleep: function () { return Promise.resolve(); },
  });
  assert.equal(
    asyncResult.trace[0].decision_trace,
    asyncDecide.calls[0].returned.decision_trace,
    'ASYNC: decision_trace recorded by reference (B2 in the resilient path too)'
  );
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
});

// Run every registered check in declared order, AWAITING async ones so their
// assertion failures fail the suite deterministically (no swallowed rejection).
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
