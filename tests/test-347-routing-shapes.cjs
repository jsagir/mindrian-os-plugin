#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-routing-shapes.cjs -- Phase 347-07 Task 2.
 *
 * Proves resolveSuccessor is the ONE named, pure function driving both
 * chain-executor.cjs loops: a declared on_pass/on_fail routes as declared,
 * an undeclared step still resolves to index + 1 (the byte-identical
 * floor), and a stale/tampered successor id completes the chain rather than
 * looping or throwing.
 *
 * Covers Task 2 behaviors 1, 2, 4, 5 and 6 (behavior 3, the termination
 * proof, is tests/test-347-backedge-bound.cjs).
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const EXECUTOR_PATH = path.join(REPO, 'lib', 'core', 'chain-executor.cjs');
const { runChain, resolveSuccessor } = require(EXECUTOR_PATH);

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

const HIGH = { chain_output: null, quality: 'high' };
const LOW = { chain_output: null, quality: 'low' };

// ---- Test 1: on_pass naming step 3 skips step 2. ----
function test1OnPass() {
  const dispatched = [];
  const steps = [
    { step: 1, command: '/mos:a', on_pass: 3 },
    { step: 2, command: '/mos:b' },
    { step: 3, command: '/mos:c' },
  ];
  const result = runChain(steps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    onStep: function (step) {
      dispatched.push(step.step);
      return { chain_output: { ran: step.step }, quality: 'high' };
    },
  });
  assert.deepStrictEqual(dispatched, [1, 3], 'step 1 then step 3; step 2 never dispatches');
  assert.strictEqual(result.completed, true, 'the chain completes normally after step 3');
  assert.strictEqual(result.trace.length, 2, 'exactly two trace entries, one per dispatched step');
  ok('Test 1: on_pass naming step 3 runs steps 1 then 3, step 2 never dispatches');
}

// ---- Test 2: on_fail naming step 1 re-runs it after a low-quality verdict. ----
function test2OnFail() {
  const dispatched = [];
  let step1Calls = 0;
  const steps = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b', on_fail: 1 },
  ];
  const result = runChain(steps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    maxSteps: 4,
    onStep: function (step) {
      dispatched.push(step.step);
      if (step.step === 1) {
        step1Calls += 1;
        return { chain_output: { visit: step1Calls }, quality: 'high' };
      }
      // step 2 always reports low quality, so the on_fail back-edge fires
      // on every visit; the maxSteps:4 budget bounds it to one round trip.
      return { chain_output: { at: 'step2' }, quality: 'low' };
    },
  });
  assert.deepStrictEqual(dispatched, [1, 2, 1, 2], 'step 1 re-runs after step 2s low-quality on_fail back-edge');
  const visitsToStep1 = result.trace.filter(function (t) { return t.step.step === 1; });
  assert.strictEqual(visitsToStep1.length, 2, 'the trace records BOTH visits to step 1');
  assert.strictEqual(result.completed, false, 'the chain halts once the budget brake catches the repeating back-edge');
  assert.strictEqual(result.haltedAt.reason, 'budget_brake');
  ok('Test 2: on_fail naming step 1 re-runs step 1 after a low-quality verdict, both visits recorded');
}

// ---- Test 4: no declarations -> index + 1, byte-identical to the pre-change path. ----
function test4Undeclared() {
  const decideFn = function () { return { decision_trace: { handle: 'x' } }; };
  const steps = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b' },
    { step: 3, command: '/mos:c' },
  ];
  const onStep = function (step, previousOutput) {
    return { chain_output: { step: step.step, previousOutput: previousOutput }, quality: 'high' };
  };
  const result = runChain(steps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    decideFn: decideFn,
    onStep: onStep,
  });
  assert.strictEqual(result.completed, true);
  assert.strictEqual(result.trace.length, 3, 'all three steps ran, in order, on the default i + 1 floor');
  assert.deepStrictEqual(result.trace.map(function (t) { return t.step.step; }), [1, 2, 3]);
  // resolveSuccessor called directly: absent on_pass/on_fail, it returns the
  // literal id of the step at currentIndex + 1.
  assert.strictEqual(resolveSuccessor(steps[0], 'high', steps, 0), 2);
  assert.strictEqual(resolveSuccessor(steps[1], 'high', steps, 1), 3);
  assert.strictEqual(resolveSuccessor(steps[2], 'high', steps, 2), null, 'past the end of the list resolves to null');
  ok('Test 4: a step declaring neither on_pass nor on_fail resolves to index + 1, byte-identical to the pre-change path');
}

// ---- Test 5: resolveSuccessor exported, pure, and the sole successor authority. ----
function test5PureAndSole() {
  assert.strictEqual(typeof resolveSuccessor, 'function', 'resolveSuccessor is exported');
  const list = [{ step: 1 }, { step: 2 }];
  // Pure: same inputs, same output, no observable side effect (calling it
  // twice with identical args never mutates step/list).
  const before = JSON.stringify(list);
  const r1 = resolveSuccessor(list[0], 'high', list, 0);
  const r2 = resolveSuccessor(list[0], 'high', list, 0);
  assert.strictEqual(r1, r2);
  assert.strictEqual(JSON.stringify(list), before, 'resolveSuccessor mutates neither step nor list');

  // Source scan: the two MAIN chain loops (sync runChain + async
  // _runChainResilient) no longer auto-increment `i` in their own
  // for-statement -- the successor is driven by resolveSuccessor's return,
  // mapped to an index, and assigned explicitly (`i = nextIndex`) inside the
  // loop body. `_stepIndexById`'s own small linear-scan helper loop keeps
  // its own `i += 1` (an unrelated, ordinary array scan, not chain
  // successor arithmetic) -- this scan asserts EXACTLY two bare
  // `for (let i = 0; i < list.length;)` main-loop statements exist, which is
  // the two chain loops and nothing else.
  const source = fs.readFileSync(EXECUTOR_PATH, 'utf8');
  const mainLoopStatements = source.match(/for \(let i = 0; i < list\.length;\) \{/g) || [];
  assert.strictEqual(mainLoopStatements.length, 2, 'exactly the two main chain loops no longer auto-increment i');
  ok('Test 5: resolveSuccessor is exported, pure, and the sole successor authority (no bare i + 1 for-loop increment remains in either main loop)');
}

// ---- Test 6: a successor id naming a step outside the list completes cleanly. ----
function test6UnknownSuccessor() {
  const dispatched = [];
  const steps = [
    { step: 1, command: '/mos:a', on_pass: 'ghost-step' },
    { step: 2, command: '/mos:b' },
  ];
  const result = runChain(steps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    onStep: function (step) {
      dispatched.push(step.step);
      return { chain_output: null, quality: 'high' };
    },
  });
  assert.deepStrictEqual(dispatched, [1], 'only step 1 dispatches; the phantom on_pass target never resolves');
  assert.strictEqual(result.completed, true, 'the chain completes rather than looping or throwing');
  assert.strictEqual(result.haltedAt, null);
  ok('Test 6: a successor id naming a step outside the list returns null and the chain completes');
}

function main() {
  test1OnPass();
  test2OnFail();
  test4Undeclared();
  test5PureAndSole();
  test6UnknownSuccessor();

  console.log(checks + ' checks passed.');
  process.exit(0);
}

main();
