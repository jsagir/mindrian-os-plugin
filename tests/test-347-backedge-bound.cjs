#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-backedge-bound.cjs -- Phase 347-07 Task 2, behavior 3.
 *
 * Proves the bounded conditional back-edge terminates at the EXISTING
 * EXEC-06 maxSteps brake -- no second counter, no hang. A ping-pong
 * on_fail/on_pass pair given a low maxSteps must halt with
 * haltedAt.reason === 'budget_brake' and a bounded trace length, and it
 * must do so fast: the test itself sets a hard wall-clock ceiling so a
 * regression that removes the bound shows up as an assertion/timeout
 * failure within the test's own step budget, never a silent hang.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const { runChain } = require(path.join(REPO, 'lib', 'core', 'chain-executor.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function testBudgetBrakeTerminatesTheBackEdge() {
  const startedAt = Date.now();
  const dispatched = [];
  // A 2-step ping-pong: step 1 always passes and routes to step 2 via
  // on_pass; step 2 always fails and routes BACK to step 1 via on_fail.
  // With no bound this ping-pongs forever. maxSteps: 5 must stop it.
  const steps = [
    { step: 1, command: '/mos:a', on_pass: 2 },
    { step: 2, command: '/mos:b', on_fail: 1 },
  ];
  const result = runChain(steps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    maxSteps: 5,
    onStep: function (step) {
      dispatched.push(step.step);
      if (step.step === 1) return { chain_output: null, quality: 'high' };
      return { chain_output: null, quality: 'low' };
    },
  });
  const elapsedMs = Date.now() - startedAt;

  assert.strictEqual(result.completed, false, 'the back-edge chain never completes -- it is bounded, not converged');
  assert.ok(result.haltedAt, 'haltedAt is set');
  assert.strictEqual(result.haltedAt.reason, 'budget_brake', 'the EXEC-06 budget brake is the bound, no second counter');
  assert.strictEqual(result.haltedAt.maxSteps, 5, 'the recorded brake names the caller-supplied maxSteps');
  assert.strictEqual(result.trace.length, 5, 'exactly maxSteps trace entries -- the back-edge charges stepsRun like a Ralph retry');
  assert.strictEqual(dispatched.length, 5, 'exactly maxSteps dispatches -- the ping-pong never runs past the bound');
  assert.deepStrictEqual(dispatched, [1, 2, 1, 2, 1], 'the ping-pong pattern itself is the back-edge actually firing, not a stall');
  assert.ok(elapsedMs < 5000, 'the whole test resolves in well under its own wall-clock ceiling -- a regression that removes the bound would hang or blow this');
  ok('Test 3: a back-edge chain with maxSteps 5 halts with budget_brake, exactly 5 trace entries, well inside a 5s ceiling');
}

function main() {
  testBudgetBrakeTerminatesTheBackEdge();
  console.log(checks + ' checks passed.');
  process.exit(0);
}

main();
