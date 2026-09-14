#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-fanout-delegation.cjs -- Phase 347-07 Task 3.
 *
 * Proves fan-out and fan-in are DECLARED shapes on the resolved chain and
 * EXECUTED by the one fan-out engine that already ships
 * (lib/core/bono/cell-fanout.cjs), through a lazy, injectable seam, so
 * D-164-S2 (that module must never require the sequential chain executor)
 * stays unreversed and exactly one fan-out implementation ships.
 *
 * Seven behaviors, matching 347-07-PLAN.md Task 3.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const EXECUTOR_PATH = path.join(REPO, 'lib', 'core', 'chain-executor.cjs');
const CELL_FANOUT_PATH = path.join(REPO, 'lib', 'core', 'bono', 'cell-fanout.cjs');
const { runChain } = require(EXECUTOR_PATH);

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

// ---- Test 1 + 2: exactly one delegated call, three cell declarations, ----
// ---- the same shared input record id on each, via the injectable seam. ----
async function test1And2SpyDelegation() {
  const calls = [];
  const fanOutFn = function (callParams) {
    calls.push(callParams);
    return Promise.resolve({
      cells: callParams.subdomains.map(function (s) {
        return { subdomain: s, hat: callParams.hats[0], stance: 'supports', evidence: [], confidence: 1 };
      }),
      dropped: [],
      plan: { requested: callParams.subdomains.length, dispatched: callParams.subdomains.length, capped: false },
    });
  };

  const steps = [
    { step: 1, command: '/mos:fan', fan_out: ['a', 'b', 'c'] },
  ];
  const result = await runChain(steps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    fanOutFn: fanOutFn,
    // onStep is REQUIRED by the loop's own precondition but must never be
    // called for a fan_out step -- its execution is delegated, not
    // dispatched through the normal per-step brick.
    onStep: function () { throw new Error('onStep must not be called for a fan_out step'); },
  });

  assert.strictEqual(calls.length, 1, 'the delegated fan-out runner is called exactly once');
  assert.strictEqual(calls[0].subdomains.length, 3, 'three declared step ids become three cell declarations');
  assert.deepStrictEqual(calls[0].subdomains, ['a', 'b', 'c']);

  const fanEntries = result.trace.filter(function (t) { return t.step && t.step.fan_out_of === 1; });
  assert.strictEqual(fanEntries.length, 3, 'three fan-out trace entries are mapped back, one per declared step id');
  const recordIds = fanEntries.map(function (t) { return t.chain_output.input_record_id; });
  assert.strictEqual(new Set(recordIds).size, 1, 'every fanned cell carries the SAME shared input record id');
  ok('Test 1: three declared step ids produce three cell declarations sharing one input record id, one delegated call');
  ok('Test 2: the delegation target is reached through the injectable opts.fanOutFn seam (a spy observed the call)');
}

// ---- Test 3: cell-fanout.cjs has no require of chain-executor (D-164-S2). ----
function test3NoReverseDependency() {
  const source = fs.readFileSync(CELL_FANOUT_PATH, 'utf8');
  assert.strictEqual(source.indexOf('chain-executor'), -1, 'cell-fanout.cjs must never require or mention chain-executor');
  ok('Test 3: cell-fanout.cjs contains no require of chain-executor -- D-164-S2 unreversed');
}

// ---- Test 4: no top-level require of cell-fanout in chain-executor.cjs. ----
function test4LazyRequireOnly() {
  const source = fs.readFileSync(EXECUTOR_PATH, 'utf8');
  const lines = source.split('\n');
  const hits = [];
  lines.forEach(function (line, idx) {
    if (line.indexOf('bono/cell-fanout') !== -1) hits.push({ line: idx + 1, text: line });
  });
  assert.strictEqual(hits.length, 1, 'exactly one line mentions bono/cell-fanout: ' + JSON.stringify(hits));
  assert.ok(/^\s+\S/.test(hits[0].text), 'that line is indented -- the require sits inside a function body, not at module scope');
  assert.strictEqual(hits[0].text.trim().indexOf('require(') === 0 || hits[0].text.indexOf('require(') !== -1, true,
    'the one line is itself the require() call');
  ok('Test 4: chain-executor.cjs has no top-level require of cell-fanout -- the one mention is a lazy, indented require');
}

// ---- Test 5: fan_in collects declared from-ids and applies the named ----
// ---- reducer; an unknown reducer halts with a named reason. ----
async function test5FanIn() {
  const steps = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b', fan_in: { from: [1], reducer: 'first' } },
  ];
  const result = await runChain(steps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    fanOutFn: function () { throw new Error('must not be called -- no fan_out declared'); },
    onStep: function (step, previousOutput) {
      if (step.step === 1) return { chain_output: { marker: 'from-step-1' }, quality: 'high' };
      return { chain_output: { received: previousOutput }, quality: 'high' };
    },
  });
  assert.strictEqual(result.completed, true);
  const step2Entry = result.trace.find(function (t) { return t.step.step === 2; });
  assert.deepStrictEqual(step2Entry.chain_output.received, { marker: 'from-step-1' },
    'fan_in collected step 1s chain_output via the first reducer');
  ok('Test 5a: fan_in collects the declared from step ids and applies the named reducer enum');

  const badSteps = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b', fan_in: { from: [1], reducer: 'no_such_reducer' } },
  ];
  const badResult = await runChain(badSteps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    onStep: function (step) { return { chain_output: { step: step.step }, quality: 'high' }; },
  });
  assert.strictEqual(badResult.completed, false, 'an unknown reducer handle halts the chain');
  assert.strictEqual(badResult.haltedAt.reason, 'unknown_fan_in_reducer', 'the halt names the reason rather than silently picking a default');
  ok('Test 5b: an unknown fan_in reducer handle is refused with a named reason and the chain halts');
}

// ---- Test 6: no second cap authority -- no fan-out cap literal in the file. ----
function test6NoSecondCapAuthority() {
  const source = fs.readFileSync(EXECUTOR_PATH, 'utf8');
  assert.strictEqual(/FANOUT_CAP|fanoutCap|FAN_OUT_CAP/.test(source), false,
    'chain-executor.cjs must contain no fan-out cap literal of its own -- the engine is the one cap authority');
  ok('Test 6: the fan-out declaration is clamped only by the delegated engine; chain-executor introduces no second cap authority');
}

// ---- Test 7: no fan_out declaration never loads cell-fanout at all. ----
async function test7NoLoadWithoutDeclaration() {
  let spyCalled = false;
  const steps = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b' },
  ];
  await runChain(steps, {
    postureFn: function () { return { autonomous_safe: true, posture: 'run' }; },
    fanOutFn: function () { spyCalled = true; return Promise.resolve({ cells: [] }); },
    onStep: function (step) { return { chain_output: { step: step.step }, quality: 'high' }; },
  });
  assert.strictEqual(spyCalled, false, 'the injected fan-out spy is never called when no step declares fan_out');

  // Prove the REAL default path also never touches the module's require.cache
  // when nothing declares fan_out (run this in a fresh child process so this
  // test's own earlier requires cannot contaminate the cache check).
  const script = `
    const { runChain } = require(${JSON.stringify(EXECUTOR_PATH)});
    (async () => {
      const steps = [{ step: 1, command: '/mos:a' }, { step: 2, command: '/mos:b' }];
      await runChain(steps, {
        postureFn: () => ({ autonomous_safe: true, posture: 'run' }),
        onStep: (step) => ({ chain_output: { step: step.step }, quality: 'high' }),
      });
      const loaded = Object.keys(require.cache).some((k) => k.indexOf('cell-fanout.cjs') !== -1);
      process.stdout.write(loaded ? 'LOADED' : 'NOT_LOADED');
    })();
  `;
  const out = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.strictEqual(out.trim(), 'NOT_LOADED', 'a run with the real default fanOutFn never pulls cell-fanout.cjs into require.cache absent a fan_out declaration');
  ok('Test 7: a chain with no fan_out declaration never loads cell-fanout.cjs at all -- spy uncalled, module absent from require.cache');
}

async function main() {
  await test1And2SpyDelegation();
  test3NoReverseDependency();
  test4LazyRequireOnly();
  await test5FanIn();
  test6NoSecondCapAuthority();
  await test7NoLoadWithoutDeclaration();

  console.log(checks + ' checks passed.');
  process.exit(0);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
