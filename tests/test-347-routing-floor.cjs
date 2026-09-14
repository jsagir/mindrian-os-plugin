#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-routing-floor.cjs -- Phase 347-07 Task 1.
 *
 * Proves lib/workflow/command-resolver.cjs::composeWorkflow carries six
 * OPTIONAL routing keys additively, without forking the resolver or
 * breaking the byte-identical floor for a chain that declares nothing.
 *
 * Five behaviors:
 *   1. No routing declarations -> today's exact four-key shape, in order.
 *   2. Per-step routing declarations -> on_pass, on_fail, fan_out, fan_in,
 *      reviewer, context all carried alongside the four existing keys.
 *   3. A malformed routing value is dropped, never thrown, and reported on
 *      an additive routing_warnings array; the step still resolves.
 *   4. validateChainAutonomy returns the same verdict with or without
 *      routing keys (posture and routing are orthogonal axes).
 *   5. The existing consumers of composeWorkflow's shape still pass (run as
 *      their own test files, never re-derived here).
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const resolver = require(path.join(REPO, 'lib', 'workflow', 'command-resolver.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

// ---- Behavior 1: the additive floor. ----
function test1Floor() {
  const wf = resolver.composeWorkflow(['lean-canvas', 'Red Teaming']);
  assert.strictEqual(wf.length, 2, 'two steps in, two steps out');
  for (const step of wf) {
    const keys = Object.keys(step).sort();
    assert.deepStrictEqual(keys, ['command', 'framework', 'optional', 'step'],
      'an undeclared step carries exactly the four keys it carries today');
  }
  assert.strictEqual(wf[0].step, 1);
  assert.strictEqual(wf[0].framework, 'lean-canvas');
  assert.strictEqual(wf[1].step, 2);
  assert.strictEqual(wf[1].framework, 'Red Teaming');
  // No declaration anywhere in the chain -> no routing_warnings property at
  // all (never an empty array either) -- the array stays a plain array, so
  // an existing caller's whole-array deepStrictEqual against a bare literal
  // is untouched (Node's assert.deepStrictEqual compares own enumerable
  // properties of an array, not only its indices).
  assert.strictEqual(Object.prototype.hasOwnProperty.call(wf, 'routing_warnings'), false,
    'an undeclared chain must not carry routing_warnings at all -- true byte-identical floor');
  ok('Test 1: no routing declarations -> the exact four-key shape, in order, no extra array property');
}

// ---- Behavior 2: declared routing keys ride alongside the four. ----
function test2Shapes() {
  const wf = resolver.composeWorkflow([
    {
      framework: 'lean-canvas',
      on_pass: 'step-3',
      on_fail: null,
      fan_out: ['step-a', 'step-b'],
      fan_in: { from: ['step-a', 'step-b'], reducer: 'merge' },
      reviewer: { kind: 'navigator', agent: 'navigator-default' },
      context: { focus_node_id: 'node:1', budget: { max_tokens: 500 } },
    },
  ]);
  const step = wf[0];
  const keys = Object.keys(step).sort();
  assert.deepStrictEqual(
    keys,
    ['command', 'context', 'fan_in', 'fan_out', 'framework', 'on_fail', 'on_pass', 'optional', 'reviewer', 'step'],
    'a declared step carries all four existing keys plus all six routing keys'
  );
  assert.strictEqual(step.on_pass, 'step-3');
  assert.strictEqual(step.on_fail, null);
  assert.deepStrictEqual(step.fan_out, ['step-a', 'step-b']);
  assert.deepStrictEqual(step.fan_in, { from: ['step-a', 'step-b'], reducer: 'merge' });
  assert.deepStrictEqual(step.reviewer, { kind: 'navigator', agent: 'navigator-default' });
  assert.deepStrictEqual(step.context, { focus_node_id: 'node:1', budget: { max_tokens: 500 } });
  ok('Test 2: on_pass, on_fail, fan_out, fan_in, reviewer, context all carried, shape unchanged otherwise');
}

// ---- Behavior 3: a malformed value is dropped, never thrown, and reported. ----
function test3Malformed() {
  const wf = resolver.composeWorkflow([
    { framework: 'lean-canvas', fan_out: 'not-an-array', on_pass: 42.5, fan_in: { reducer: 'merge' } },
  ]);
  const step = wf[0];
  assert.strictEqual(step.framework, 'lean-canvas', 'the step still resolves despite malformed routing');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(step, 'fan_out'), false, 'a non-array fan_out is dropped');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(step, 'fan_in'), false, 'a fan_in missing `from` is dropped');
  // on_pass: 42.5 is a number, and the validator accepts any number as a
  // step id -- so this one is NOT malformed; assert it is kept to prove the
  // validator is exercised correctly (a deliberate non-malformed case
  // alongside the two malformed ones above).
  assert.strictEqual(step.on_pass, 42.5, 'a numeric step id is a valid on_pass value, not malformed');
  assert.ok(Array.isArray(wf.routing_warnings), 'routing_warnings is attached once any step declares routing');
  const reasons = wf.routing_warnings.map(function (w) { return w.key; }).sort();
  assert.deepStrictEqual(reasons, ['fan_in', 'fan_out'], 'both malformed keys are named on routing_warnings');
  for (const w of wf.routing_warnings) {
    assert.strictEqual(w.step, 1);
    assert.strictEqual(w.reason, 'malformed_routing_value');
  }
  ok('Test 3: a malformed routing value is dropped, never thrown, the step still resolves, and the drop is reported');
}

// ---- Behavior 4: posture and routing are orthogonal axes. ----
function test4Orthogonal() {
  const bare = resolver.composeWorkflow(['lean-canvas']);
  const routed = resolver.composeWorkflow([
    { framework: 'lean-canvas', on_pass: 'step-2', fan_out: ['a', 'b'] },
  ]);
  const verdictBare = resolver.validateChainAutonomy(bare);
  const verdictRouted = resolver.validateChainAutonomy(routed);
  assert.deepStrictEqual(verdictRouted, verdictBare,
    'validateChainAutonomy returns the same verdict with or without routing keys');
  ok('Test 4: validateChainAutonomy is unaffected by routing keys -- posture and routing are orthogonal');
}

// ---- Behavior 5: the existing consumers still pass, run as their own files. ----
function test5ExistingConsumers() {
  const files = [
    'tests/test-264-sensor-to-chain-resolve.cjs',
    'tests/test-act-on-runchain.cjs',
    'tests/test-pipeline-on-runchain.cjs',
  ];
  for (const f of files) {
    execFileSync(process.execPath, [path.join(REPO, f)], { cwd: REPO, stdio: 'pipe' });
  }
  ok('Test 5: the existing composeWorkflow consumers (chain_resolve, act, pipeline) still pass unchanged');
}

function main() {
  test1Floor();
  test2Shapes();
  test3Malformed();
  test4Orthogonal();
  test5ExistingConsumers();

  console.log(checks + ' checks passed.');
  process.exit(0);
}

main();
