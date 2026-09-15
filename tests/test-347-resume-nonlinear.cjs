#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-resume-nonlinear.cjs -- Phase 347-08 (SHARED-07).
 *
 * Kills the second linear assumption: chain_run's resume path used to
 * compute the remainder with `list.findIndex((s) => s === haltedStep)`
 * followed by `list.slice(idx + 1)` (lib/mcp/tools/chain.cjs:321-322,
 * pre-347-08). That is a raw array-position guess -- correct only when the
 * chain has no routing declarations at all. 347-07 taught
 * lib/core/chain-executor.cjs's own loop to branch (on_pass / on_fail /
 * fan_out) through one named resolveSuccessor function; without this plan,
 * the first halt inside a declared route would resume the wrong remainder
 * through chain.cjs's OWN separate (and now stale) arithmetic, silently.
 *
 * RED-PROOF (the single-line mutation that turns this file red): revert
 * lib/mcp/tools/chain.cjs's `_buildResumeRemainder` body to the old shape --
 * `const idx = list.findIndex((s) => s === haltedStep); return { restSteps:
 * idx >= 0 ? list.slice(idx + 1) : [], reason: null };` -- and re-run. Test
 * 2 (on_pass reroute) turns red first (remainder would start at step 3, not
 * step 4); Test 3 (fan_out) turns red next (remainder would be the flat
 * array slice, not the declared fan-out targets); Test 7 (the fallback
 * lookup) turns red last (a haltedStep object that -- by construction -- is
 * never `===` any `list` element resolves `idx === -1`, so the remainder
 * would wrongly come back empty instead of resolving via declared id).
 * Test 1 and Test 4 stay green under the old arithmetic -- they are the
 * floor this plan must not disturb.
 *
 * Behaviors covered (plan 347-08, Task 1):
 *   1. Linear 4-step chain, halt at step 2 -> remainder is steps 3, 4
 *      (the unchanged floor).
 *   2. Step 2 declares on_pass naming step 4, halt at step 2 -> remainder
 *      starts at step 4, not step 3. Proven both as a direct unit call on
 *      _buildResumeRemainder AND end to end through a real chainRun halt +
 *      gate_answer approve resume.
 *   3. The halted step declares fan_out -> remainder is every declared
 *      fan-out target, not the array slice after the coordinator.
 *   4. Halted step not found in the list -> empty remainder, a named
 *      reason, no throw.
 *   5. The ledger entry still carries every field it carries today, checked
 *      by named membership.
 *   6. gate_answer with verdict approve still resumes through the identical
 *      path; consumeGate is still called with exactly two positional
 *      arguments; a second consume of the same gate_id is still refused.
 *   7. Two "identical" step objects (same declared id, but the halted
 *      reference is NEVER `===` any `list` element -- the exact shape the
 *      fan-out engine's own synthetic cell trace entries have,
 *      `{step: fan_out_step_id, fan_out_of: coordinator_id}`, per
 *      lib/core/chain-executor.cjs's fan-out dispatch) resolve to the
 *      correct occurrence via declared id, because the lookup falls back to
 *      id identity rather than staying stuck on failed object identity.
 *
 * Plain-Node harness (tests/test-347-backedge-bound.cjs shape): assert, a
 * local ok(desc) counter, a leading log of the test name, a trailing PASS
 * line. No framework. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const chainTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'chain.cjs'));
const chainExecutor = require(path.join(REPO, 'lib', 'core', 'chain-executor.cjs'));
const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));

const { _buildResumeRemainder } = chainTool._internal;

console.log('test-347-resume-nonlinear');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function stepIds(steps) {
  return steps.map(function (s) { return s.step; });
}

// -----------------------------------------------------------------------
// Test 1: the linear floor. No routing declared -- the change must be
// invisible.
// -----------------------------------------------------------------------
function testLinearFloor() {
  const list = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b' },
    { step: 3, command: '/mos:c' },
    { step: 4, command: '/mos:d' },
  ];
  const haltedStep = list[1]; // step 2, the exact list element (reference match)
  const result = _buildResumeRemainder(list, haltedStep);
  assert.equal(result.reason, null, 'no failure reason for a found halted step');
  assert.deepStrictEqual(stepIds(result.restSteps), [3, 4], 'remainder is steps 3 and 4, exactly the old slice(idx + 1) floor');
  ok('Test 1: linear 4-step chain halted at step 2 -> remainder is steps 3, 4 (byte-identical floor)');
}

// -----------------------------------------------------------------------
// Test 2a: on_pass reroute, direct unit call.
// -----------------------------------------------------------------------
function testOnPassRerouteDirect() {
  const list = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b', on_pass: 4 },
    { step: 3, command: '/mos:c' },
    { step: 4, command: '/mos:d' },
  ];
  const haltedStep = list[1]; // step 2
  const result = _buildResumeRemainder(list, haltedStep);
  assert.equal(result.reason, null);
  assert.deepStrictEqual(stepIds(result.restSteps), [4], 'remainder starts at step 4, step 3 is skipped entirely');
  ok('Test 2a: step 2 declares on_pass:4, halt at step 2 -> remainder starts at step 4, not step 3 (direct unit call)');
}

// -----------------------------------------------------------------------
// Test 2b: the SAME behavior proven end to end through a real chainRun halt
// and a gate_answer approve resume -- not just the isolated helper.
// -----------------------------------------------------------------------
async function testOnPassRerouteEndToEnd() {
  const executed = [];
  async function onStep(step) {
    executed.push(step.step);
    return { chain_output: { ran: step.step }, quality: 'high' };
  }
  // step 2 is the ONLY material (halting) step; 1, 3, 4 are autonomous_safe.
  function postureFn(command) {
    return (command === '/mos:material')
      ? { autonomous_safe: false, posture: 'halt' }
      : { autonomous_safe: true, posture: 'run' };
  }
  const steps = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:material', on_pass: 4 },
    { step: 3, command: '/mos:c' },
    { step: 4, command: '/mos:d' },
  ];

  const halted = await chainTool.chainRun(steps, {
    roomDir: __dirname,
    sessionId: 'sess-347-08-onpass',
    onStep: onStep,
    postureFn: postureFn,
  });
  assert.equal(halted.halted, true, 'FIXTURE: chainRun halted at the material step (step 2)');
  assert.deepStrictEqual(executed, [1], 'FIXTURE: only step 1 ran before the halt');

  const resumed = await chainTool.chainRun(null, {
    gateAnswer: { gate_id: halted.gate.gate_id, chosen: ['approve'], verdict: 'approve' },
    sessionId: 'sess-347-08-onpass',
  });
  assert.equal(resumed.executed, true, 'the approved material step (2) executed');
  assert.equal(resumed.completed, true, 'the chain completed after the routed remainder ran out');
  assert.deepStrictEqual(executed, [1, 2, 4], 'step 3 is NEVER dispatched -- the resume path routed through on_pass to step 4, skipping step 3 entirely');
  ok('Test 2b: end to end through chainRun + gate_answer, the resumed chain visits [1, 2, 4] and never dispatches step 3');
}

// -----------------------------------------------------------------------
// Test 3: fan_out declared on the halted (coordinator) step -- the
// remainder is every declared target, not the flat array slice.
// -----------------------------------------------------------------------
function testFanOutRemainder() {
  const list = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:coordinator', fan_out: [4, 5] },
    { step: 3, command: '/mos:c' }, // deliberately NOT a fan-out target -- proves the plain array slice is NOT what is returned
    { step: 4, command: '/mos:d' },
    { step: 5, command: '/mos:e' },
  ];
  const haltedStep = list[1]; // step 2, the coordinator
  const result = _buildResumeRemainder(list, haltedStep);
  assert.equal(result.reason, null);
  assert.deepStrictEqual(stepIds(result.restSteps), [4, 5], 'remainder is the declared fan-out targets (4, 5), never the array slice after the coordinator (which would have included step 3)');
  ok('Test 3: halted step declares fan_out:[4,5] -> remainder is every declared fan-out target, not the array slice after the coordinator');
}

// -----------------------------------------------------------------------
// Test 4: the halted step is not present in the list at all -- empty
// remainder, a named reason, no throw. Preserves today's idx >= 0 guard.
// -----------------------------------------------------------------------
function testHaltedStepNotFound() {
  const list = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b' },
  ];
  const foreignStep = { step: 999, command: '/mos:ghost' };
  let threw = false;
  let result = null;
  try {
    result = _buildResumeRemainder(list, foreignStep);
  } catch (_e) {
    threw = true;
  }
  assert.equal(threw, false, 'a halted step absent from the list never throws');
  assert.deepStrictEqual(result.restSteps, [], 'the remainder is empty when the halted step cannot be located');
  assert.equal(result.reason, 'halted_step_not_found', 'a named reason is produced, not a silent empty array');
  ok('Test 4: halted step not found in the list -> empty remainder, named reason "halted_step_not_found", no throw');
}

// -----------------------------------------------------------------------
// Test 5: the ledger entry still carries every field it carries today,
// checked by named membership (a future addition must not break this).
// -----------------------------------------------------------------------
async function testLedgerEntryFieldMembership() {
  async function onStep(step) {
    return { chain_output: { ran: step.step }, quality: 'high' };
  }
  const steps = [{ step: 1, command: '/mos:material' }];
  function alwaysHalt() { return { autonomous_safe: false, posture: 'halt' }; }

  const halted = await chainTool.chainRun(steps, {
    roomDir: __dirname,
    sessionId: 'sess-347-08-fields',
    onStep: onStep,
    postureFn: alwaysHalt,
    subjectNodeId: 'node-347-08',
    evidenceNodeIds: ['node-347-08-ev'],
  });
  assert.equal(halted.halted, true, 'FIXTURE: chainRun halted');

  const peeked = chainTool._internal._resumeLedger.get(halted.gate.gate_id);
  assert.ok(peeked, 'FIXTURE: the ledger entry is present (non-destructive peek, Map.get never deletes)');

  const requiredFields = [
    'haltedStep', 'restSteps', 'previousOutput', 'roomDir', 'sessionId',
    'onStepFn', 'postureFn', 'maxSteps', 'gateRenderCtx', 'subjectNodeId',
    'evidenceNodeIds', 'card', 'kind', 'resumeFn',
  ];
  requiredFields.forEach(function (field) {
    assert.ok(Object.prototype.hasOwnProperty.call(peeked, field), 'ledger entry carries "' + field + '"');
  });
  ok('Test 5: the ledger entry still carries every field it carries today (' + requiredFields.length + ' named fields), checked by membership not exact shape');

  // Drain the gate so it does not linger consumable across the rest of this
  // file's ledger-shape assertions.
  gateLedger.consumeGate(halted.gate.gate_id, 'sess-347-08-fields');
}

// -----------------------------------------------------------------------
// Test 6: gate_answer with verdict approve still resumes through the
// identical path; consumeGate keeps its exact two-positional-argument
// contract; a second consume of the same gate_id is still refused.
// -----------------------------------------------------------------------
async function testGateAnswerResumeUnaffected() {
  assert.equal(gateLedger.consumeGate.length, 2, 'consumeGate keeps its exact two-positional-parameter arity (gate-ledger.cjs:77-82)');

  const executed = [];
  async function onStep(step) {
    executed.push(step.step);
    return { chain_output: { ran: step.step }, quality: 'high' };
  }
  function alwaysHalt() { return { autonomous_safe: false, posture: 'halt' }; }
  const steps = [{ step: 1, command: '/mos:material' }];

  const halted = await chainTool.chainRun(steps, {
    roomDir: __dirname,
    sessionId: 'sess-347-08-gateanswer',
    onStep: onStep,
    postureFn: alwaysHalt,
  });
  assert.equal(halted.halted, true, 'FIXTURE: chainRun halted');

  const resumed = await chainTool.chainRun(null, {
    gateAnswer: { gate_id: halted.gate.gate_id, chosen: ['approve'], verdict: 'approve' },
    sessionId: 'sess-347-08-gateanswer',
  });
  assert.equal(resumed.executed, true, 'an approve verdict resumes and executes the halted step');
  assert.equal(resumed.completed, true, 'a single-step chain with no remainder completes on approval');
  assert.deepStrictEqual(executed, [1], 'the halted step ran exactly once');

  const replay = await chainTool.chainRun(null, {
    gateAnswer: { gate_id: halted.gate.gate_id, chosen: ['approve'], verdict: 'approve' },
    sessionId: 'sess-347-08-gateanswer',
  });
  assert.equal(replay.ok, false, 'a second consume of the same gate_id is refused');
  assert.equal(replay.reason, 'unknown_or_expired_gate', 'the single-use ledger discipline is untouched (T-198-12)');

  ok('Test 6: gate_answer approve resumes through the identical path, consumeGate keeps arity 2, and a replayed gate_id is refused');
}

// -----------------------------------------------------------------------
// Test 7: the object-identity fallback. `haltedStep` here is a FRESH object
// literal that shares its declared id (3) with `list[2]` but is NEVER
// `===` any `list` element -- exactly the shape the fan-out engine's own
// synthetic cell trace entries have
// ({step: entry.fan_out_step, fan_out_of: _stepIdOf(step)},
// lib/core/chain-executor.cjs's fan-out dispatch). Under the OLD reference-
// only lookup this resolves to idx === -1 (never found) and the remainder
// wrongly comes back empty. The fix falls back to declared-id identity and
// resolves the correct occurrence.
// -----------------------------------------------------------------------
function testDuplicateObjectFallbackResolvesByDeclaredId() {
  const list = [
    { step: 1, command: '/mos:a' },
    { step: 2, command: '/mos:b' },
    { step: 3, command: '/mos:c' }, // this is the list's OWN instance of step 3
    { step: 4, command: '/mos:d' },
  ];
  // A distinct object, never inserted into `list`, naming the SAME declared
  // id (3) that list[2] carries -- mirrors a fan-out cell's synthetic
  // {step, fan_out_of} wrapper without needing to stand up the cell-fanout
  // engine for this unit-level proof.
  const syntheticHaltedStep = { step: 3, fan_out_of: 2 };
  assert.notStrictEqual(syntheticHaltedStep, list[2], 'FIXTURE: the halted step object is NOT the same reference as list[2]');

  const result = _buildResumeRemainder(list, syntheticHaltedStep);
  assert.equal(result.reason, null, 'the declared-id fallback finds the halted step -- no "not found" reason');
  assert.deepStrictEqual(stepIds(result.restSteps), [4], 'remainder resolves to step 4 (the successor of the REAL list[2], found by declared id), not an empty array');
  ok('Test 7: a halted step object that is never `===` any list element (the fan-out synthetic-cell shape) resolves the correct occurrence by declared id, not object identity');
}

(async () => {
  testLinearFloor();
  testOnPassRerouteDirect();
  await testOnPassRerouteEndToEnd();
  testFanOutRemainder();
  testHaltedStepNotFound();
  await testLedgerEntryFieldMembership();
  await testGateAnswerResumeUnaffected();
  testDuplicateObjectFallbackResolvesByDeclaredId();

  // Sanity: chain-executor.cjs's resolveSuccessor is the SAME function this
  // file's fixtures exercise indirectly through chain.cjs -- assert it is
  // actually exported and callable, so a future refactor that renames or
  // removes it fails this file loudly instead of the assertions above
  // quietly stopping proving anything.
  assert.equal(typeof chainExecutor.resolveSuccessor, 'function', 'chainExecutor.resolveSuccessor is exported and callable');

  console.log('\nPASS: test-347-resume-nonlinear (' + checks + ' checks -- linear floor, on_pass reroute (unit + end to end), fan_out remainder, not-found guard, ledger field membership, gate_answer/consumeGate arity untouched, declared-id fallback)');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: test-347-resume-nonlinear -- ' + (e && e.stack || e));
  process.exit(1);
});
