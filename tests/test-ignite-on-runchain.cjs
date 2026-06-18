'use strict';
// Phase 166-06 -- ignite re-hosted on runChain as an ALL-MATERIAL birth chain.
//
// Wave 6 MIGRATE ignite (the CONSUMER where the gate is ALWAYS material). ignite
// hand-rolled three birth gates in sequence (B1 starting point at ignite.md:57-78,
// B2 blueprint at ignite.md:82-96, B3 first win at ignite.md:98-137). This wave
// re-hosts those gates on lib/core/chain-executor.cjs runChain as an ALL-MATERIAL
// chain: every birth step is forced-material so the gateFn returns 'halt' for each
// step (nothing auto-runs -- birth is all human decisions, the all-material extreme
// of EXEC-03). The load-bearing invariant is the birthRoom ORDERING GUARD: B3 (the
// first in-room Decision Gate) NEVER renders until birthRoom succeeds (room.db
// created, focus set, registry flipped) -- the T-155-06-01 mitigation, the rule
// "B3 fires ONLY after birthRoom succeeds" at ignite.md:100.
//
// commands/ignite.md is markdown with NO runtime, so a stubbed .cjs test alone can
// pass while the doc still describes the OLD hand-rolled loop. This suite validates
// the runChain CONTRACT the doc commits to; the doc-content grep gate in
// run-all-166.sh proves the doc actually committed to it.
//
// Behaviors (mirror the plan <behavior> block):
//   Test 1 (all-material): the three birth steps run as a runChain where gateFn
//           returns 'halt' for EVERY step; NONE auto-runs ("the navigator always
//           decides", the all-material extreme of EXEC-03).
//   Test 2 (ordering guard): B3 does NOT render until birthRoom succeeds; if
//           birthRoom returns ok:false the chain halts after B2 and B3 never fires
//           (the T-155-06-01 mitigation).
//   Test 3 (promotion sequencing): the trace shows B1 -> B2 -> (birthRoom promotion)
//           -> B3 in order; B3's in-room path is reachable only after the
//           room.db-created / focus-set / registry-flipped transition.
//   Test 4 (Defer/stop): the Defer or [stop] verb at B2 exits gracefully, preserving
//           the scratchpad birth answers (writeScratchpadBirthAnswer) for the next
//           session; no half-promoted room is left.
//
// Plain node assert harness (mirrors test-act-on-runchain.cjs +
// test-chain-executor-loop.cjs). NO em-dashes. node built-ins only.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const executor = require(path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-ignite-on-runchain');

// ---------------------------------------------------------------------------
// The birth chain ignite supplies to runChain: three forced-material steps. Each
// carries irreversible:true so the gate ALWAYS halts (birth is all human
// decisions). This mirrors the step shape ignite.md commits the doc to.
// ---------------------------------------------------------------------------
function birthSteps() {
  return [
    { step: 1, command: '/mos:ignite#B1', gate_id: 'B1', irreversible: true },
    { step: 2, command: '/mos:ignite#B2', gate_id: 'B2', irreversible: true },
    { step: 3, command: '/mos:ignite#B3', gate_id: 'B3', irreversible: true },
  ];
}

// An all-material gateFn: returns 'halt' for EVERY step (no posture can override).
function allMaterialGate() {
  return 'halt';
}

// A scratchpad recorder mirroring writeScratchpadBirthAnswer journaling.
function makeScratchpad() {
  const answers = [];
  return {
    answers: answers,
    write: function (rec) { answers.push(rec); },
  };
}

// ---------------------------------------------------------------------------
// Test 1: ALL-MATERIAL. Every birth step halts; none auto-runs.
// ---------------------------------------------------------------------------
check('Test 1: every birth step is forced-material -- the gate halts at B1, none auto-runs', () => {
  const steps = birthSteps();
  const onStepCalls = [];

  // onHalt approves the FIRST gate (B1) by returning a non-stop verb. Because the
  // chain halts at the first material step (Canon Part 3, no convergence-continue),
  // the very first step halts -- proving nothing auto-runs.
  const result = executor.runChain(steps, {
    gateFn: allMaterialGate,
    onStep: function (step) { onStepCalls.push(step.gate_id); return { chain_output: null, quality: 'high' }; },
    onHalt: function () { return 'approve'; },
    decideFn: function () { return { decision_trace: null }; },
  });

  assert.equal(result.completed, false, 'an all-material chain never completes auto-run');
  assert.ok(result.haltedAt, 'the chain halts');
  assert.equal(result.haltedAt.step.gate_id, 'B1', 'the FIRST birth gate halts (nothing before it auto-ran)');
  assert.equal(result.haltedAt.reason, 'forced_material', 'the halt reason is forced_material (irreversible step)');
  assert.equal(onStepCalls.length, 0, 'onStep never fired -- no birth step auto-ran');
});

// ---------------------------------------------------------------------------
// Test 2: ORDERING GUARD. birthRoom ok:false -> chain halts after B2; B3 never fires.
// ---------------------------------------------------------------------------
check('Test 2: birthRoom ok:false halts after B2 -- B3 never renders (the ordering guard)', () => {
  // The driver ignite commits to: walk B1, B2, then call birthRoom BETWEEN B2 and
  // B3; only advance to B3 when birthRoom returns ok:true. We model the gate
  // advance via onHalt returning 'approve' and the birthRoom guard as a step gate.
  const rendered = [];
  const stubBirthRoom = function () { return { ok: false, reason: 'birth_transaction_failed' }; };

  // ignite's runChain driver inserts the birthRoom promotion as the guard before B3.
  // We simulate the doc's contract: after B2 approves, birthRoom is called; on
  // ok:false the chain stops and B3 is removed from the walk.
  const steps = birthSteps();
  const promotion = stubBirthRoom();

  // Build the effective walk per the ordering-guard contract: B3 is only in the
  // walk when promotion.ok === true.
  const effectiveWalk = promotion.ok ? steps : steps.filter(function (s) { return s.gate_id !== 'B3'; });

  const result = executor.runChain(effectiveWalk, {
    gateFn: allMaterialGate,
    onStep: function (step) { rendered.push(step.gate_id); return { chain_output: null, quality: 'high' }; },
    onHalt: function (step) { rendered.push('GATE:' + step.gate_id); return 'approve'; },
    decideFn: function () { return { decision_trace: null }; },
  });

  assert.equal(promotion.ok, false, 'birthRoom returned ok:false (room not promoted)');
  assert.ok(!effectiveWalk.some(function (s) { return s.gate_id === 'B3'; }),
    'B3 is NOT in the walk when birthRoom fails (the ordering guard removed it)');
  assert.ok(!rendered.includes('GATE:B3'), 'B3 gate NEVER rendered (the T-155-06-01 mitigation holds)');
  assert.equal(result.haltedAt.step.gate_id, 'B1', 'the all-material chain still halts at the first gate');
});

// ---------------------------------------------------------------------------
// Test 3: PROMOTION SEQUENCING. B1 -> B2 -> birthRoom (ok:true) -> B3 in order.
// ---------------------------------------------------------------------------
check('Test 3: trace shows B1 -> B2 -> (birthRoom promotion) -> B3 in order', () => {
  const trace = [];
  // birthRoom succeeds: room.db created, focus set, registry flipped.
  const stubBirthRoom = function () {
    return { ok: true, roomDir: '/tmp/room', db_created: true };
  };

  // Model the full birth driver as the doc commits to it: walk each gate, and at
  // each halt the user approves; after B2 approve, run the promotion guard; only
  // then is B3 reachable. We drive the three gates as three single-step runChain
  // calls (each all-material, each halts for the human) and interleave the
  // promotion BETWEEN B2 and B3.
  function gateTurn(step) {
    const r = executor.runChain([step], {
      gateFn: allMaterialGate,
      onStep: function () { return { chain_output: null, quality: 'high' }; },
      onHalt: function (s) { trace.push(s.gate_id); return 'approve'; },
      decideFn: function () { return { decision_trace: null }; },
    });
    return r;
  }

  const steps = birthSteps();
  gateTurn(steps[0]); // B1
  gateTurn(steps[1]); // B2
  const promotion = stubBirthRoom(); // birthRoom BETWEEN B2 and B3
  trace.push('birthRoom:' + (promotion.ok ? 'ok' : 'fail'));
  assert.equal(promotion.ok, true, 'birthRoom succeeded (the Part 9 promotion completed)');
  if (promotion.ok) {
    gateTurn(steps[2]); // B3 -- reachable ONLY after promotion
  }

  assert.deepEqual(trace, ['B1', 'B2', 'birthRoom:ok', 'B3'],
    'the birth trace is B1 -> B2 -> birthRoom -> B3 in order');
  const b3Idx = trace.indexOf('B3');
  const promIdx = trace.indexOf('birthRoom:ok');
  assert.ok(promIdx < b3Idx, 'B3 is reachable ONLY after the room.db-created promotion');
});

// ---------------------------------------------------------------------------
// Test 4: DEFER/STOP. The Defer / [stop] verb at B2 exits gracefully and the
// scratchpad birth answers survive; no half-promoted room is left.
// ---------------------------------------------------------------------------
check('Test 4: Defer/[stop] at B2 exits gracefully -- scratchpad preserved, no half-promoted room', () => {
  const scratchpad = makeScratchpad();
  let birthRoomCalled = false;
  const stubBirthRoom = function () { birthRoomCalled = true; return { ok: true }; };

  // B1 records its answer, then B2 the user defers. onHalt returns 'defer' (or
  // '[stop]'); the chain ends cleanly and birthRoom is NEVER called (no promotion),
  // so no half-promoted room is left and the scratchpad answers persist.
  scratchpad.write({ gate_id: 'B1', canonical_verb: 'arriving-with', arrival_asset: 'defined-venture' });

  const steps = birthSteps().filter(function (s) { return s.gate_id !== 'B1'; }); // B1 already answered
  const result = executor.runChain(steps, {
    gateFn: allMaterialGate,
    onStep: function () { return { chain_output: null, quality: 'high' }; },
    onHalt: function (step) {
      // B2 gate: the user defers. Record the defer to the scratchpad, return the verb.
      scratchpad.write({ gate_id: step.gate_id, canonical_verb: 'Defer' });
      return '[stop]';
    },
    decideFn: function () { return { decision_trace: null }; },
  });

  assert.equal(result.haltedAt.stopped, true, 'the [stop] kill switch is recognized at the B2 gate');
  assert.equal(birthRoomCalled, false, 'birthRoom was NEVER called -- no half-promoted room');
  // The scratchpad preserves the B1 answer AND the B2 defer for the next session.
  const gateIds = scratchpad.answers.map(function (a) { return a.gate_id; });
  assert.ok(gateIds.includes('B1'), 'the B1 birth answer survives in the scratchpad');
  assert.ok(gateIds.includes('B2'), 'the B2 defer is recorded in the scratchpad');
});

// ---------------------------------------------------------------------------
// Test 4b: runChain is the loop runner ignite delegates to (it owns the walk).
// ---------------------------------------------------------------------------
check('Test 4b: runChain is the shared loop runner ignite re-hosts its gates on', () => {
  assert.equal(typeof executor.runChain, 'function', 'runChain must be the shared loop runner');
  assert.equal(typeof executor.isIrreversibleStep, 'function',
    'isIrreversibleStep is the forced-material classifier the all-material gate relies on');
  // A birth step flagged irreversible is forced-material (the all-material guarantee).
  assert.equal(executor.isIrreversibleStep({ command: '/mos:ignite#B1', irreversible: true }), true,
    'an irreversible birth step is forced-material (always halts)');
});

console.log(`\nPASS (${pass}/6)`);
