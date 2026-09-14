#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-reconstructible.cjs -- Phase 347-02 Task 3.
 *
 * The phase's load-bearing proof, authored BEFORE the writer it tests
 * (docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md SHARED-02;
 * 347-RESEARCH.md Finding 2's six-step reconstructibility test). It proves
 * that every chain step's input is reconstructible from room.db ALONE, with
 * no trace object and no closure, plus its two negative legs.
 *
 * The require below throws a module-resolution error until BOTH plan 347-03
 * (lib/core/navigation/chain-state.cjs, the writer + reader) and plan
 * 347-04 have landed. This is the EXPECTED-RED state tests/run-all-347.sh's
 * run_red_until helper reports for SHARED-02; it is deliberately NOT
 * wrapped in a try-catch, since a pin that passes before its subject exists
 * proves nothing.
 *
 * Both runChain paths are exercised: the synchronous path (no roomDir, no
 * journal, no resume, no retries, no sleep -- lib/core/chain-executor.cjs
 * lines 437-520) and the asynchronous resilient path (roomDir supplied --
 * lines 860-915), since EXEC-05 forks on the presence of ANY reliability
 * opt and both paths must persist and reconstruct identically.
 *
 * The rebuild function below is declared ABOVE the chain run and takes
 * ONLY (db, runId): it has no access to the in-memory trace or closure at
 * all, so it cannot cheat by reading them. Function.prototype.toString is
 * used to prove that structurally, not just by convention.
 *
 * Negative legs cite 343-ICM-CONSULT.md:502's catch-returns-0 rule ("the
 * single highest-value correctness rule"): a rebuild that returns an empty
 * success for a hole in the chain is the same defect wearing different
 * clothes. Phase 169 D-169-11 removed the edges->nodes foreign key, so a
 * dangling edge (an edge whose endpoint has no node row) is a PERMITTED
 * state (2,657 dangling edge rows measured across 30 rooms,
 * lib/core/navigation/CONTEXT.md "Why a dangling endpoint is legal"); the
 * rebuild must verify endpoints explicitly rather than trust the edge.
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes (CLAUDE.md HARD
 * RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const { buildChainFixtureRoom, closeChainFixtureRoom } =
  require(path.join(REPO, 'tests', 'helpers', 'fixture-room-347.cjs'));
const { runChain } = require(path.join(REPO, 'lib', 'core', 'chain-executor.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

// The writer + reader under test. Deliberately UNGUARDED (see header):
// while plan 347-03 has not landed lib/core/navigation/chain-state.cjs,
// this require throws and the file exits non-zero.
const chainState = require(path.join(REPO, 'lib', 'core', 'navigation', 'chain-state.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-347-recon-' + suffix + '-'));
}

// The rebuild function this proof cannot cheat with: it takes ONLY (db,
// runId), never the in-memory trace, never a closure over previousOutput.
// It forwards to chain-state.cjs's own reader entry points, so its source
// (asserted below via toString()) never names the two forbidden
// identifiers.
function rebuildInputsFromGraphAlone(db, runId) {
  const records = chainState.readChainState(db, runId);
  const rebuilt = [];
  for (let i = 0; i < records.length; i += 1) {
    rebuilt.push(chainState.reconstructStepInput(db, runId, i));
  }
  return rebuilt;
}

const THREE_STEPS = Object.freeze([
  { step: 1, command: '/mos:a' },
  { step: 2, command: '/mos:b' },
  { step: 3, command: '/mos:c' },
]);

// A stub onStep that persists each step's chain_output as a chain_state
// record THROUGH the writer under test (kind:'draft'), then returns the
// SAME chain_output to runChain so the loop folds it forward normally
// (EXEC-02). This is how a real chain-state consumer (347-04's dispatcher
// wiring) will call the writer: from inside onStep, not from runChain
// itself, since runChain stays substrate-agnostic.
function makeWritingOnStep(db, runId, subjectNodeId) {
  let stepIndex = 0;
  function onStep(step, _previousOutput) {
    const idx = stepIndex;
    stepIndex += 1;
    const chainOutput = { marker: 'output-of-' + step.command, idx: idx };
    const write = chainState.writeChainStateRecord(db, {
      run_id: runId,
      step_index: idx,
      kind: 'draft',
      command: step.command,
      body: chainOutput,
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: subjectNodeId,
    });
    if (!write.ok) {
      throw new Error('test setup failure: writeChainStateRecord refused step ' + idx + ': ' + write.reason);
    }
    return { chain_output: chainOutput, quality: 'high' };
  }
  return onStep;
}

async function main() {
  // ---- Rebuild self-inspection: the proof cannot read the trace it is
  // supposed to be rebuilding. ----
  const rebuildSource = rebuildInputsFromGraphAlone.toString();
  assert.ok(!/\btrace\b/.test(rebuildSource), 'rebuildInputsFromGraphAlone must not reference "trace"');
  assert.ok(!/\bpreviousOutput\b/.test(rebuildSource), 'rebuildInputsFromGraphAlone must not reference "previousOutput"');
  ok('the rebuild function takes only (db, runId) and its own source names neither trace nor previousOutput');

  // ---- Test 1 (the proof, sync path): rebuild every step's input from
  // room.db alone and deep-equal it against a deep copy of the trace
  // runChain returned. ----
  {
    const tmpDir = makeScratchDir('sync');
    const fixture = buildChainFixtureRoom(tmpDir, 'wide');
    const runId = 'run-347-sync-proof';
    const onStep = makeWritingOnStep(fixture.db, runId, fixture.subjectNodeId);

    const result = runChain(THREE_STEPS, {
      gateFn: function () { return 'run'; },
      onHalt: function () { return 'approve'; },
      onStep: onStep,
      maxSteps: 10,
    });
    assert.strictEqual(result.completed, true, 'the 3-step stub chain must complete on the sync path');
    assert.strictEqual(result.trace.length, 3, 'the sync trace must carry exactly 3 entries');

    // Keep a DEEP COPY for comparison; the trace object itself is discarded
    // (never handed to the rebuild function).
    const traceCopy = JSON.parse(JSON.stringify(result.trace));

    // Close every handle, then reopen room.db FRESH through the same door a
    // real caller uses (navigation.openRoomDbForCaller), given only run_id.
    fixture.db.close();
    const freshDb = navigation.openRoomDbForCaller(fixture.roomDir);
    assert.ok(freshDb, 'navigation.openRoomDbForCaller must reopen the fixture room');

    const rebuilt = rebuildInputsFromGraphAlone(freshDb, runId);
    assert.strictEqual(rebuilt.length, 3, 'the rebuild must recover exactly 3 records for this run_id');

    const rebuiltInputs = rebuilt.map((r) => (r && r.ok) ? r.input : undefined);
    const expectedInputs = [null, traceCopy[0].chain_output, traceCopy[1].chain_output];
    assert.deepStrictEqual(rebuiltInputs, expectedInputs, 'the graph-only rebuild must equal the trace-derived expectation, step for step');
    ok('sync path: every step input is reconstructible from room.db alone and deep-equals the trace copy');

    closeChainFixtureRoom({ db: freshDb, roomDir: fixture.roomDir });
  }

  // ---- Test 2 (both paths): the same proof on the asynchronous resilient
  // path (roomDir supplied, no journal, no resume, so no pipeline-state
  // file is ever written -- this proof is scoped to the graph substrate
  // alone). ----
  {
    const tmpDir = makeScratchDir('async');
    const fixture = buildChainFixtureRoom(tmpDir, 'wide');
    const runId = 'run-347-async-proof';
    const onStep = makeWritingOnStep(fixture.db, runId, fixture.subjectNodeId);

    const result = await runChain(THREE_STEPS, {
      gateFn: function () { return 'run'; },
      onHalt: function () { return 'approve'; },
      onStep: onStep,
      maxSteps: 10,
      roomDir: fixture.roomDir,
    });
    assert.strictEqual(result.completed, true, 'the 3-step stub chain must complete on the async resilient path');
    assert.strictEqual(result.trace.length, 3, 'the async trace must carry exactly 3 entries');

    const traceCopy = JSON.parse(JSON.stringify(result.trace));
    fixture.db.close();
    const freshDb = navigation.openRoomDbForCaller(fixture.roomDir);
    assert.ok(freshDb, 'navigation.openRoomDbForCaller must reopen the fixture room (async path)');

    const rebuilt = rebuildInputsFromGraphAlone(freshDb, runId);
    const rebuiltInputs = rebuilt.map((r) => (r && r.ok) ? r.input : undefined);
    const expectedInputs = [null, traceCopy[0].chain_output, traceCopy[1].chain_output];
    assert.deepStrictEqual(rebuiltInputs, expectedInputs, 'the async path rebuild must equal the sync path shape, step for step');
    ok('async resilient path (roomDir supplied): the rebuild is identical in shape to the sync path');

    closeChainFixtureRoom({ db: freshDb, roomDir: fixture.roomDir });
  }

  // ---- Test 3 (negative leg, deleted mid-chain record): deleting the
  // step-index-1 chain_state node must make step 2's reconstruction report
  // unreconstructible with missing_step:1, never an empty success. ----
  {
    const tmpDir = makeScratchDir('deleted');
    const fixture = buildChainFixtureRoom(tmpDir, 'wide');
    const runId = 'run-347-deleted-record';
    const onStep = makeWritingOnStep(fixture.db, runId, fixture.subjectNodeId);

    const result = runChain(THREE_STEPS, {
      gateFn: function () { return 'run'; },
      onHalt: function () { return 'approve'; },
      onStep: onStep,
      maxSteps: 10,
    });
    assert.strictEqual(result.completed, true, 'the setup chain for the deleted-record leg must complete');

    // Delete the step-index-1 chain_state node row (test SETUP only: the
    // writer under test never issues a raw DELETE; this simulates data loss
    // to prove the reader's honesty, mirroring the 343-ICM-CONSULT.md:502
    // catch-returns-0 rule this negative leg exists to guard against).
    const records = chainState.readChainState(fixture.db, runId);
    const step1Record = records.find((r) => r.step_index === 1);
    assert.ok(step1Record, 'the step-index-1 record must exist before deletion');
    fixture.db.prepare('DELETE FROM nodes WHERE id = ?').run(step1Record.node_id);

    const rebuild2 = chainState.reconstructStepInput(fixture.db, runId, 2);
    assert.strictEqual(rebuild2.ok, false, 'step 2 reconstruction must fail once step 1 is deleted');
    assert.strictEqual(rebuild2.reason, 'unreconstructible', 'the refusal reason must be unreconstructible');
    assert.strictEqual(rebuild2.missing_step, 1, 'the refusal must name the missing step index');
    assert.notDeepStrictEqual(rebuild2, {}, 'the refusal must never be a silent empty object');
    ok('deleting a mid-chain record makes a later step unreconstructible with the missing step index named, never an empty success');

    closeChainFixtureRoom(fixture);
  }

  // ---- Test 4 (negative leg, dangling endpoint): the FEEDS_INTO edge into
  // the deleted node is left in place (Phase 169 D-169-11's permitted
  // dangling state); the rebuild must verify the endpoint explicitly and
  // still report unreconstructible, never follow the edge into a hole. ----
  {
    const tmpDir = makeScratchDir('dangling');
    const fixture = buildChainFixtureRoom(tmpDir, 'wide');
    const runId = 'run-347-dangling-endpoint';
    const onStep = makeWritingOnStep(fixture.db, runId, fixture.subjectNodeId);

    const result = runChain(THREE_STEPS, {
      gateFn: function () { return 'run'; },
      onHalt: function () { return 'approve'; },
      onStep: onStep,
      maxSteps: 10,
    });
    assert.strictEqual(result.completed, true, 'the setup chain for the dangling-endpoint leg must complete');

    const records = chainState.readChainState(fixture.db, runId);
    const step1Record = records.find((r) => r.step_index === 1);
    assert.ok(step1Record, 'the step-index-1 record must exist before deletion');

    // Delete ONLY the node row; the FEEDS_INTO edges naming it as an
    // endpoint are left untouched, reproducing the permitted dangling state.
    fixture.db.prepare('DELETE FROM nodes WHERE id = ?').run(step1Record.node_id);
    const danglingEdges = fixture.db.prepare(
      'SELECT source, target FROM edges WHERE type = ? AND (source = ? OR target = ?)'
    ).all('FEEDS_INTO', step1Record.node_id, step1Record.node_id);
    assert.ok(danglingEdges.length > 0, 'the FEEDS_INTO edges naming the deleted node must still be present (the permitted dangling state)');

    const rebuild2 = chainState.reconstructStepInput(fixture.db, runId, 2);
    assert.strictEqual(rebuild2.ok, false, 'step 2 reconstruction must fail when its predecessor endpoint is dangling');
    assert.strictEqual(rebuild2.reason, 'unreconstructible', 'the refusal reason must be unreconstructible, never a value read through the dangling edge');
    assert.strictEqual(rebuild2.missing_step, 1, 'the refusal must name the missing step index even though the edge itself still exists');
    ok('a dangling FEEDS_INTO endpoint is verified explicitly, never followed into a hole');

    closeChainFixtureRoom(fixture);
  }

  // ---- Test 5 (schema honesty): on the legacy 3-column fixture, anything
  // the schema cannot answer is reported as null with a schema_variant
  // marker, never as a fabricated zero. Read directly off the fixture's own
  // raw handle (never reopened through navigation.openRoomDbForCaller,
  // which would migrate the schema away from legacy). ----
  {
    const tmpDir = makeScratchDir('legacy-honesty');
    const fixture = buildChainFixtureRoom(tmpDir, 'legacy');
    const runId = 'run-347-legacy-honesty';
    const write = chainState.writeChainStateRecord(fixture.db, {
      run_id: runId,
      step_index: 0,
      kind: 'task',
      command: '/mos:a',
      body: { text: 'legacy step 0' },
      quality: 'high',
      tier: 'executable',
      produced_by: 'worker',
      subject_node_id: fixture.subjectNodeId,
    });
    assert.strictEqual(write.ok, true, 'the writer must still succeed on the legacy 3-column schema');

    const legacyRecords = chainState.readChainState(fixture.db, runId);
    assert.ok(legacyRecords.length >= 1, 'readChainState must recover the record on the legacy schema');
    assert.strictEqual(legacyRecords[0].schema_variant, 'legacy', 'the reader must honestly name the legacy schema variant');

    const legacyRebuild = chainState.reconstructStepInput(fixture.db, runId, 0);
    assert.strictEqual(legacyRebuild.schema_variant, 'legacy', 'reconstructStepInput must also carry the schema_variant marker on the legacy schema');
    ok('the legacy 3-column fixture reports ok:true with an honest schema_variant marker, never a fabricated count');

    closeChainFixtureRoom(fixture);
  }

  console.log(checks + ' checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
