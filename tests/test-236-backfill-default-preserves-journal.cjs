#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236 Plan 02 Task 1 -- the DEFAULT-PATH leg of the GRAPHDB-01 survival
 * gate. This is RCA Test 2, and it closes the gap RCA CLAIM-09 names.
 *
 * WHY A SECOND SURVIVAL TEST EXISTS AT ALL. 236-01's
 * tests/test-236-rebuild-preserves-journal.cjs calls rebuildGraph DIRECTLY. That
 * is not the shape a caller reaches. A caller reaches runDeriveBackfill, which
 * runs its OWN internal structural rebuild unless the caller happens to know to
 * pass skipRebuild:true. Phase 233-03 added that opt-out as a correctness fix
 * AFTER the pipeline had already lost edges to the internal rebuild, which means
 * the dangerous path is precisely the one a caller gets by DEFAULT, by knowing
 * nothing. So this file pins the default: no skipRebuild key at all.
 *
 * WHAT THIS MEASURES VERSUS ASSUMES. Every number below is read out of a REAL
 * .mindrian/room.db seeded through the repo's own production writers
 * (tests/helpers/fixture-room-236.cjs) and re-read off disk after the REAL
 * runDeriveBackfill has run. Neither runDeriveBackfill nor rebuildGraph is
 * stubbed, mocked, or monkey-patched anywhere in this file. A mocked backfill
 * would make this test vacuous, which is the exact failure shape the phase
 * exists to close.
 *
 * MUTATION THAT TURNS THIS RED. Reverting 236-01's scoped DELETE in rebuildGraph
 * to `conn.exec('DELETE FROM edges; DELETE FROM nodes;')` turns scenarios 1 and 2
 * red (the default path reaches that statement through its internal rebuild).
 * Scenarios 4 and 5 stay green under that mutation, because skipRebuild:true
 * never reaches the DELETE at all. That split is the whole point: it is what
 * proves scenario 1 is measuring the rebuild rather than measuring nothing.
 *
 * WHY AN INERT deriveFn IS INJECTED, AND WHY THAT DOES NOT WEAKEN THE TEST. The
 * "default" under test here is the default of skipRebuild, not the default of
 * deriveFn. Two independent reasons force an injected deriveFn:
 *
 *   1. On the NO-deriveFn path, _runBackfillAsync probes the local semantic
 *      encoder BEFORE the target loop and RETURNS EARLY with
 *      skipped:'encoder_unavailable' when the encoder is missing
 *      (graph-backfill.cjs:388-397). The early return happens before any
 *      rebuild. On a machine without the encoder this test would pass while
 *      never reaching the code it claims to guard: vacuous by construction.
 *   2. An injected SYNC deriveFn routes to _runBackfillSync, which fires
 *      _rebuildRoom(t) WITHOUT await (graph-backfill.cjs:353, the KNOWN,
 *      ACCEPTED RACE comment at :343-348, and 236-RESEARCH.md Pitfall 8). The
 *      assertions would then race the rebuild.
 *
 * An injected ASYNC deriveFn avoids both: _isPromiseReturning routes it to
 * _runBackfillAsync (where the rebuild is AWAITED and correctly sequenced), and
 * injected===true suppresses the encoder probe so the early return can never
 * fire. The deriveFn returns an empty candidate list, so it contributes no
 * writes of its own and cannot mask a deletion.
 *
 * Scenarios:
 *   1. DEFAULT path (no skipRebuild key): the three irreplaceable populations
 *      (memory_event, the confirmed claim, the opportunity) have UNCHANGED
 *      counts, and the opportunity's D-17 stage_history has UNCHANGED length
 *      and entries.
 *   2. DEFAULT path NON-VACUITY: an artifact file deleted from disk before the
 *      call has its Artifact node GONE afterward. This is the proof that the
 *      internal rebuild actually ran. Without it, scenario 1 could pass because
 *      nothing happened at all.
 *   3. The options object handed to the default-path call carries NO skipRebuild
 *      key, asserted with hasOwnProperty on the very object that was passed. A
 *      test that meant to exercise the default and quietly passed
 *      skipRebuild:false would be testing a different thing than the one that
 *      burns callers.
 *   4. CONTROL, skipRebuild:true: the same three populations are also unchanged.
 *   5. CONTROL NON-VACUITY: with skipRebuild:true the deleted file's Artifact
 *      node is STILL PRESENT, and the two paths therefore behave DIFFERENTLY.
 *      If they behaved identically the default path never reached the rebuild.
 *
 * Both paths run once, against their own fresh scratch room via fs.mkdtempSync,
 * during setup; the scenarios then assert over the recorded observations. A
 * setup failure is reported as a failed setup scenario, never as a stack trace
 * and never as a silent green.
 *
 * tests/ is on the scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT list, so
 * requiring room-db.cjs here is sanctioned. Harness: the plain ok/fail/scenario
 * pass-counter from tests/test-236-rebuild-preserves-journal.cjs, exiting
 * nonzero when failed > 0. No jest, no vitest. No em-dashes (CLAUDE.md hard
 * rule). CJS only, zero new deps, zero network reach.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { runDeriveBackfill } = require(path.join(REPO, 'lib', 'core', 'graph-backfill.cjs'));

const {
  buildFixtureRoom236,
  countPopulations,
  readStageHistory,
} = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-236.cjs'));

const ARTIFACT_COUNT = 4;

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

async function scenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-236-bf-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function withOpenRoom(roomDir, fn) {
  const db = roomDb.openRoomDb(roomDir);
  try { return fn(db); } finally { roomDb.closeRoomDb(db); }
}

function artifactIds(db) {
  return db.prepare("SELECT id FROM nodes WHERE type = 'Artifact' ORDER BY id")
    .all().map((r) => r.id);
}

// The inert injected producer. ASYNC on purpose (see the header): async routes
// runDeriveBackfill to _runBackfillAsync, where the internal rebuild is AWAITED
// rather than fire-and-forget, and injected===true suppresses the encoder probe
// whose early return would otherwise skip the rebuild entirely. It returns an
// empty candidate list, so it writes nothing and cannot mask a deletion.
async function inertDeriveFn() {
  return [];
}

// Read everything a scenario needs in ONE open, so before/after comparisons can
// never straddle two different views of the room.
function snapshot(roomDir, opportunityId) {
  return withOpenRoom(roomDir, (db) => ({
    counts: countPopulations(db),
    history: readStageHistory(db, opportunityId),
    artifacts: artifactIds(db),
  }));
}

/**
 * Seed a fresh room, delete ONE artifact file from disk, run the REAL
 * runDeriveBackfill against it, and record before/after. `extraOpts` is spread
 * onto the options object; passing null means the options object carries only
 * roomDir and the inert deriveFn, which is exactly the default-path shape under
 * test. The options object itself is returned so a scenario can assert on which
 * keys were actually present.
 */
async function observeBackfill(suffix, extraOpts) {
  const scratch = makeScratchDir(suffix);
  const fx = await buildFixtureRoom236(scratch, { artifactCount: ARTIFACT_COUNT });

  const before = snapshot(fx.roomDir, fx.opportunityId);
  assert.equal(
    before.artifacts.length, ARTIFACT_COUNT,
    'fixture must pre-index ' + ARTIFACT_COUNT + ' Artifact nodes, got '
      + before.artifacts.length
  );

  // The reclamation probe: this file is gone from disk before the call, so a run
  // that actually rebuilds must reclaim its Artifact node, and a run that skips
  // the rebuild must leave it standing.
  const doomed = fx.artifactFiles[0];
  fs.rmSync(doomed);
  assert.equal(fs.existsSync(doomed), false, 'the doomed artifact file must be gone from disk');

  const opts = { roomDir: fx.roomDir, deriveFn: inertDeriveFn };
  if (extraOpts) {
    for (const k of Object.keys(extraOpts)) opts[k] = extraOpts[k];
  }

  const result = await runDeriveBackfill(opts);
  const after = snapshot(fx.roomDir, fx.opportunityId);

  return {
    scratch: scratch,
    fx: fx,
    opts: opts,
    result: result,
    before: before,
    after: after,
  };
}

// ---------- Shared observations, taken once during setup ----------

const observed = { def: null, ctl: null };
let setupError = null;

function requireSetup() {
  assert.equal(setupError, null, 'setup must have succeeded: ' + (setupError && setupError.message));
  assert.ok(observed.def && observed.ctl, 'both observations must exist');
}

// Assert the three IRREPLACEABLE populations are byte-for-byte unchanged.
function assertIrreplaceableUnchanged(label, obs) {
  for (const type of ['memory_event', 'claim', 'opportunity']) {
    assert.ok(
      obs.before.counts[type] > 0,
      label + ': fixture must have seeded at least one ' + type + ' row, got '
        + JSON.stringify(obs.before.counts)
    );
    assert.equal(
      obs.after.counts[type], obs.before.counts[type],
      label + ': ' + type + ' count must be UNCHANGED across runDeriveBackfill '
        + '(this population cannot be re-derived from anything on disk): before '
        + obs.before.counts[type] + ', after ' + obs.after.counts[type]
    );
  }
  assert.ok(
    Array.isArray(obs.before.history) && obs.before.history.length >= 2,
    label + ': fixture must have seeded a stage_history of length >= 2, got '
      + JSON.stringify(obs.before.history)
  );
  assert.ok(
    Array.isArray(obs.after.history),
    label + ': the opportunity or its D-17 stage_history was DESTROYED by '
      + 'runDeriveBackfill (the append-only ledger is unrecoverable)'
  );
  assert.equal(
    obs.after.history.length, obs.before.history.length,
    label + ': stage_history LENGTH must be unchanged: before '
      + obs.before.history.length + ', after ' + obs.after.history.length
  );
  assert.deepEqual(
    obs.after.history, obs.before.history,
    label + ': stage_history entries must be unchanged'
  );
}

// ---------- Scenario 1: the default path preserves all three populations ----------

async function scenario1() {
  requireSetup();
  assertIrreplaceableUnchanged('DEFAULT path', observed.def);
}

// ---------- Scenario 2: the default path actually reached the rebuild ----------

async function scenario2() {
  requireSetup();
  const obs = observed.def;
  assert.equal(
    obs.after.artifacts.length, ARTIFACT_COUNT - 1,
    'DEFAULT path NON-VACUITY: the internal rebuild must have RECLAIMED the '
      + 'Artifact node of the file deleted from disk. Expected '
      + (ARTIFACT_COUNT - 1) + ' Artifact nodes, got ' + obs.after.artifacts.length
      + '. If this is still ' + ARTIFACT_COUNT + ' the rebuild never ran and '
      + 'scenario 1 proved nothing.'
  );
  const reclaimed = obs.before.artifacts.filter((id) => obs.after.artifacts.indexOf(id) === -1);
  assert.equal(
    reclaimed.length, 1,
    'DEFAULT path: EXACTLY one Artifact node must have been reclaimed, got '
      + JSON.stringify(reclaimed)
  );
}

// ---------- Scenario 3: the default call really passed no skipRebuild key ----------

async function scenario3() {
  requireSetup();
  const keys = Object.keys(observed.def.opts).sort();
  assert.deepEqual(
    keys, ['deriveFn', 'roomDir'],
    'the DEFAULT-path options object must contain ONLY roomDir and the injected '
      + 'deriveFn, got ' + JSON.stringify(keys)
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(observed.def.opts, 'skipRebuild'), false,
    'the DEFAULT-path options object must not carry a skipRebuild key at all. '
      + 'Passing skipRebuild:false explicitly would test a different thing than '
      + 'the default a caller gets by knowing nothing.'
  );
  assert.equal(
    observed.ctl.opts.skipRebuild, true,
    'the CONTROL options object must carry skipRebuild:true'
  );
}

// ---------- Scenario 4: the control path preserves the same populations ----------

async function scenario4() {
  requireSetup();
  assertIrreplaceableUnchanged('CONTROL skipRebuild:true', observed.ctl);
}

// ---------- Scenario 5: the two paths behave DIFFERENTLY ----------

async function scenario5() {
  requireSetup();
  const ctl = observed.ctl;
  assert.equal(
    ctl.after.artifacts.length, ARTIFACT_COUNT,
    'CONTROL NON-VACUITY: with skipRebuild:true no rebuild runs, so the Artifact '
      + 'node of the deleted file must STILL be present. Expected '
      + ARTIFACT_COUNT + ' Artifact nodes, got ' + ctl.after.artifacts.length
  );
  assert.deepEqual(
    ctl.after.artifacts, ctl.before.artifacts,
    'CONTROL: the Artifact node set must be untouched by a skipRebuild:true run'
  );
  assert.notEqual(
    observed.def.after.artifacts.length, ctl.after.artifacts.length,
    'the DEFAULT and CONTROL paths must NOT behave identically. Identical '
      + 'behavior means the default path never reached the rebuild and this '
      + 'whole file is vacuous.'
  );
}

// ---------- Runner ----------

(async () => {
  process.stdout.write(
    '\nPhase 236-02 Task 1: runDeriveBackfill DEFAULT-path journal-survival gate (RCA Test 2)\n\n'
  );

  try {
    observed.def = await observeBackfill('default', null);
    observed.ctl = await observeBackfill('control', { skipRebuild: true });
    ok('0. setup: both the DEFAULT and CONTROL backfills ran against real rooms');
  } catch (e) {
    setupError = e;
    fail('0. setup: both the DEFAULT and CONTROL backfills ran against real rooms', e);
  }

  await scenario('1. DEFAULT path preserves memory_event, confirmed claim, opportunity and stage_history', scenario1);
  await scenario('2. DEFAULT path NON-VACUITY: the rebuild ran and reclaimed the deleted file Artifact node', scenario2);
  await scenario('3. the DEFAULT call passed NO skipRebuild key, the CONTROL passed skipRebuild:true', scenario3);
  await scenario('4. CONTROL skipRebuild:true also preserves all three populations', scenario4);
  await scenario('5. CONTROL NON-VACUITY: the Artifact node survives, so the two paths differ', scenario5);

  for (const obs of [observed.def, observed.ctl]) {
    if (obs && obs.scratch) rmrf(obs.scratch);
  }

  process.stdout.write('\n  passed: ' + passed + '  failed: ' + failed + '\n\n');
  if (failed > 0) process.exit(1);
})();
