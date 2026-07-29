#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236 Plan 02 Task 2 -- the CRASH-ATOMICITY gate, ROADMAP success
 * criterion 1 for GRAPHDB-01.
 *
 * WHAT THIS FILE PINS, AND WHY IT DOES NOT DRIVE A CODE CHANGE. rebuildGraph's
 * BEGIN/COMMIT/ROLLBACK wrap ALREADY exists and is ALREADY correct
 * (lib/core/lazygraph-ops.cjs:668 for the BEGIN, :743 for the COMMIT, :744-747
 * for the ROLLBACK-on-throw). The Phase 236 defect was never atomicity, it was
 * DELETE scope, and 236-01 fixed that. So this file adds no behavior: it pins
 * behavior the repo currently gets right but has never asserted, so a future
 * edit cannot silently remove it. The repo has already been burned once by this
 * exact statement (Phase 233-03, RCA CLAIM-12). Pinning is what stops a third
 * time.
 *
 * THE MODELLING DECISION, STATED RATHER THAN LEFT IMPLICIT. A real SIGKILL
 * landing between the DELETE and the COMMIT cannot be scripted from inside the
 * same process: there is no point in the synchronous rebuild where this test
 * could reach in and kill it, and a kill from outside cannot be timed against a
 * loop that never yields. This test therefore injects a forced EXCEPTION
 * mid-rebuild and asserts no partial commit.
 *
 * THOSE TWO REACH THE SAME END STATE, and the reason is written down rather
 * than assumed. See `.planning/debug/graph-rebuild-truncates-memory-journal.md`,
 * section "SQLite Transaction and Concurrency Analysis", item 2: an uncommitted
 * SQLite transaction is discarded the next time the database is opened, whether
 * the process died before reaching COMMIT (WAL-frame discard, no JS catch ever
 * runs) or a JS exception fired the explicit ROLLBACK. Both converge on the
 * pre-rebuild rows.
 *
 * BE PRECISE ABOUT THE CLAIM. This test does NOT prove SIGKILL behavior. It
 * proves that a failure raised inside the transaction leaves the room
 * byte-equivalent on REOPEN, which is the JS-exception half of the pair the RCA
 * analyses. The SIGKILL half rests on SQLite's own durability contract, cited
 * above, not on anything measured here.
 *
 * THE INJECTION SEAM, CHOSEN BY OBSERVATION. The failure is injected through the
 * FILESYSTEM, so no production source is edited or monkey-patched by this file.
 * One seeded `artifact-NN.md` is replaced by a DIRECTORY of the same name. Two
 * facts make that work, both verified before this file was written:
 *
 *   1. rebuildGraph's section walk is `fs.readdirSync(sectionDir)` with NO
 *      withFileTypes (lazygraph-ops.cjs:680), so it yields plain NAME strings
 *      and a directory called `artifact-01.md` passes _isIndexableArtifactFile
 *      exactly as a file would.
 *   2. _indexArtifactBody's first act is _readArtifactContent, whose .md branch
 *      is a bare `fs.readFileSync(filePath, 'utf-8')` with no try
 *      (lazygraph-ops.cjs:499). Reading a directory throws EISDIR.
 *
 * THE THROW MUST COME FROM THE PER-FILE CALL, NOT THE SECTION READ. rebuildGraph
 * wraps its per-section readdirSync in `try { } catch { continue; }`
 * (lazygraph-ops.cjs:679-683), so a SECTION-level failure is skipped and never
 * reaches the outer catch: an injection there would produce a clean, successful
 * rebuild and this file would assert nothing. The chosen seam bites at the
 * per-FILE _indexArtifactBody call, which sits directly inside the outer try,
 * AFTER clearIndexerOwnedRows has already deleted the indexer-owned rows. That
 * is the state that must not survive.
 *
 * The seam is PRE-VERIFIED in process, before anything is asserted about
 * rebuildGraph: scenario 0 confirms fs.readFileSync actually throws on the
 * prepared path. A seam that stopped biting reports as an explicit seam failure,
 * never as a false green.
 *
 * MUTATION THAT TURNS THIS RED. Removing the BEGIN/COMMIT/ROLLBACK wrap from
 * rebuildGraph (running clearIndexerOwnedRows and the reindex as bare autocommit
 * statements) turns scenarios 2 and 3 red: the scoped DELETE commits on its own,
 * the throw arrives with nothing to roll back, and the reopened room is missing
 * every Artifact and Section row. This is the ONLY test in Phase 236 whose
 * mutation targets the transaction wrap rather than the DELETE scope, and it is
 * the reason ROADMAP criterion 1's wording is satisfiable at all. The observed
 * red output is quoted in this file's commit message.
 *
 * Scenarios:
 *   0. The seam actually bites: fs.readFileSync throws on the prepared path.
 *      Without this, a no-op injection would let every later scenario pass
 *      vacuously.
 *   1. rebuildGraph THREW. Captured with the callAndCatch idiom from
 *      tests/test-233-derivation-default-gate.cjs:82-90, so a rebuild that
 *      wrongly SUCCEEDS reports as a clean assertion failure rather than a
 *      stack trace.
 *   2. After the throw, with the failed handle CLOSED and the room REOPENED
 *      through openRoomDb, every seeded row is present: the memory_event, the
 *      confirmed claim, the opportunity with its full D-17 stage_history, AND
 *      every Artifact and Section node that existed before the call. The reopen
 *      is load-bearing: asserting on the same handle that just rolled back
 *      would test that handle's view rather than what survived on disk.
 *   3. Node and edge counts after the failed rebuild are EXACTLY EQUAL to the
 *      counts before it. Not "greater than zero": equal. A partial commit shows
 *      up as a count delta and nothing else would catch it.
 *
 * tests/ is on the scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT list, so
 * requiring room-db.cjs here is sanctioned. Harness: the plain ok/fail/scenario
 * pass-counter from tests/test-236-rebuild-preserves-journal.cjs, exiting
 * nonzero when failed > 0. No em-dashes (CLAUDE.md hard rule). CJS only, zero
 * new deps, zero network reach. No file under lib/ or scripts/ is modified by
 * this test.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));

const {
  buildFixtureRoom236,
  countPopulations,
  readStageHistory,
  readNodeRow,
} = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-236.cjs'));

// Four artifacts, and the seam is planted on index 1 rather than index 0 so at
// least one artifact is successfully indexed INSIDE the transaction before the
// throw arrives. That guarantees there is a genuine partial in-transaction
// state for the rollback to discard, rather than an empty one.
const ARTIFACT_COUNT = 4;
const SEAM_INDEX = 1;

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-236-crash-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function withOpenRoom(roomDir, fn) {
  const db = roomDb.openRoomDb(roomDir);
  try { return fn(db); } finally { roomDb.closeRoomDb(db); }
}

function nodeIdsOfType(db, type) {
  return db.prepare('SELECT id FROM nodes WHERE type = ? ORDER BY id').all(type).map((r) => r.id);
}

// Everything a scenario needs, read in ONE open so before/after comparisons can
// never straddle two different views of the room.
function snapshot(roomDir, fx) {
  return withOpenRoom(roomDir, (db) => ({
    counts: countPopulations(db),
    memoryEvent: readNodeRow(db, fx.memoryEventId),
    claim: readNodeRow(db, fx.claimId),
    opportunity: readNodeRow(db, fx.opportunityId),
    history: readStageHistory(db, fx.opportunityId),
    artifacts: nodeIdsOfType(db, 'Artifact'),
    sections: nodeIdsOfType(db, 'Section'),
  }));
}

/**
 * Open the room, run the REAL rebuildGraph, close the handle, and return the
 * thrown Error or null. This is the callAndCatch idiom: it NEVER rethrows, so a
 * rebuild that wrongly succeeds surfaces as a clean assertion failure in
 * scenario 1 instead of an unhandled stack trace that hides scenarios 2 and 3.
 *
 * The close in the finally is what makes scenario 2's reopen meaningful.
 */
async function rebuildAndCatch(roomDir) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    const res = await lazygraph.rebuildGraph(db, roomDir);
    return { err: null, res: res };
  } catch (e) {
    return { err: e, res: null };
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// ---------- Shared observation, taken once during setup ----------

const observed = {
  scratch: null,
  fx: null,
  seamPath: null,
  seamProbe: null,
  before: null,
  after: null,
  thrown: null,
};
let setupError = null;

function requireSetup() {
  assert.equal(setupError, null, 'setup must have succeeded: ' + (setupError && setupError.message));
}

async function setup() {
  const scratch = makeScratchDir('run');
  observed.scratch = scratch;

  const fx = await buildFixtureRoom236(scratch, { artifactCount: ARTIFACT_COUNT });
  observed.fx = fx;

  observed.before = snapshot(fx.roomDir, fx);
  assert.equal(
    observed.before.artifacts.length, ARTIFACT_COUNT,
    'fixture must pre-index ' + ARTIFACT_COUNT + ' Artifact nodes, got '
      + observed.before.artifacts.length
  );

  // Plant the seam: replace one seeded .md FILE with a DIRECTORY of the same
  // name. The section walk still lists it (plain readdirSync yields names), the
  // extension filter still accepts it, and _readArtifactContent's readFileSync
  // throws EISDIR from inside the transaction.
  const seamPath = fx.artifactFiles[SEAM_INDEX];
  fs.rmSync(seamPath);
  fs.mkdirSync(seamPath);
  observed.seamPath = seamPath;

  // PRE-VERIFY the seam in process, before rebuildGraph is asked to do anything.
  try {
    fs.readFileSync(seamPath, 'utf-8');
    observed.seamProbe = { throws: false, code: null, message: 'readFileSync returned without throwing' };
  } catch (e) {
    observed.seamProbe = { throws: true, code: e && e.code, message: e && e.message };
  }

  observed.thrown = await rebuildAndCatch(fx.roomDir);
  observed.after = snapshot(fx.roomDir, fx);
}

// ---------- Scenario 0: the seam actually bites ----------

async function scenario0() {
  requireSetup();
  assert.ok(
    fs.existsSync(observed.seamPath) && fs.statSync(observed.seamPath).isDirectory(),
    'the seam path must be a DIRECTORY named like an artifact file: ' + observed.seamPath
  );
  assert.equal(
    observed.seamProbe.throws, true,
    'SEAM FAILURE: fs.readFileSync must throw on the prepared path, otherwise no '
      + 'failure was injected and every later scenario would pass vacuously. Probe '
      + 'said: ' + JSON.stringify(observed.seamProbe)
  );
  assert.equal(
    observed.seamProbe.code, 'EISDIR',
    'the seam must throw EISDIR (reading a directory), got '
      + JSON.stringify(observed.seamProbe)
  );
}

// ---------- Scenario 1: the rebuild actually threw ----------

async function scenario1() {
  requireSetup();
  assert.ok(
    observed.thrown.err instanceof Error,
    'rebuildGraph must have THROWN. It returned '
      + JSON.stringify(observed.thrown.res) + ' instead, which means the injected '
      + 'failure never reached the transaction and this file proves nothing about '
      + 'atomicity.'
  );
  assert.equal(
    observed.thrown.res, null,
    'a throwing rebuild must not also return a result'
  );
  assert.equal(
    observed.thrown.err.code, 'EISDIR',
    'the escaping error must be the injected EISDIR, not some unrelated failure, got '
      + (observed.thrown.err && observed.thrown.err.code) + ': '
      + (observed.thrown.err && observed.thrown.err.message)
  );
}

// ---------- Scenario 2: every seeded row survives on REOPEN ----------

async function scenario2() {
  requireSetup();
  const b = observed.before;
  const a = observed.after;

  assert.ok(
    a.memoryEvent,
    'memory_event ' + observed.fx.memoryEventId + ' did NOT survive the failed '
      + 'rebuild. The transaction wrap is the only thing standing between a '
      + 'mid-rebuild failure and permanent loss of the append-only audit journal.'
  );
  assert.equal(
    a.memoryEvent.properties, b.memoryEvent.properties,
    'memory_event properties blob must be BYTE-IDENTICAL after the failed rebuild'
  );

  assert.ok(
    a.claim,
    'the confirmed truth-claim ' + observed.fx.claimId + ' did NOT survive the '
      + 'failed rebuild (Canon Part 9 role 5: nothing can re-confirm it)'
  );
  assert.equal(
    a.claim.review_status, 'confirmed',
    'the truth-claim must still be confirmed after the failed rebuild, got '
      + a.claim.review_status
  );
  assert.equal(
    a.claim.properties, b.claim.properties,
    'truth-claim properties blob must be BYTE-IDENTICAL after the failed rebuild'
  );

  assert.ok(
    a.opportunity,
    'the opportunity ' + observed.fx.opportunityId + ' did NOT survive the failed rebuild'
  );
  assert.ok(
    Array.isArray(a.history),
    'the opportunity D-17 stage_history did NOT survive the failed rebuild'
  );
  assert.equal(
    a.history.length, b.history.length,
    'stage_history LENGTH must be unchanged after the failed rebuild: before '
      + b.history.length + ', after ' + a.history.length
  );
  assert.deepEqual(
    a.history, b.history,
    'stage_history entries must be unchanged after the failed rebuild'
  );

  // The regenerable population matters here too, and for a different reason than
  // in 236-01's survival test. A rollback restores EVERYTHING the transaction
  // touched, so a failed rebuild must leave the indexer-owned rows exactly as
  // they were, including the rows clearIndexerOwnedRows deleted inside the
  // transaction. If these are missing, the DELETE committed and the reindex did
  // not: the precise torn state the wrap exists to prevent.
  assert.deepEqual(
    a.artifacts, b.artifacts,
    'every Artifact node present before the failed rebuild must be present after '
      + 'it. Missing rows here mean the scoped DELETE committed while the reindex '
      + 'did not, which is a torn, half-rebuilt room.'
  );
  assert.deepEqual(
    a.sections, b.sections,
    'every Section node present before the failed rebuild must be present after it'
  );
}

// ---------- Scenario 3: counts are EXACTLY equal, not merely nonzero ----------

async function scenario3() {
  requireSetup();
  const b = observed.before.counts;
  const a = observed.after.counts;

  assert.equal(
    a._nodesTotal, b._nodesTotal,
    'ATOMICITY VIOLATION: total node count must be EXACTLY EQUAL after a failed '
      + 'rebuild.\n    before: ' + JSON.stringify(b) + '\n    after:  ' + JSON.stringify(a)
  );
  assert.equal(
    a._edgesTotal, b._edgesTotal,
    'ATOMICITY VIOLATION: total edge count must be EXACTLY EQUAL after a failed '
      + 'rebuild.\n    before: ' + JSON.stringify(b) + '\n    after:  ' + JSON.stringify(a)
  );
  assert.deepEqual(
    a, b,
    'ATOMICITY VIOLATION: the per-type node and edge rollup must be EXACTLY EQUAL '
      + 'after a failed rebuild. Not "greater than zero": equal. A partial commit '
      + 'shows up here as a count delta and nowhere else.'
  );
  // Non-vacuity for this scenario specifically: equality over two empty rollups
  // would also "pass". There must be real rows on both sides.
  assert.ok(
    b._nodesTotal > 0 && b._edgesTotal > 0,
    'the before-counts must be nonzero, otherwise the equality above compares '
      + 'nothing against nothing: ' + JSON.stringify(b)
  );
}

// ---------- Runner ----------

(async () => {
  process.stdout.write(
    '\nPhase 236-02 Task 2: rebuildGraph crash-atomicity gate (ROADMAP criterion 1)\n\n'
  );

  try {
    await setup();
  } catch (e) {
    setupError = e;
    fail('setup: seed the room, plant the seam, run the rebuild', e);
  }

  await scenario('0. the injection seam actually bites (readFileSync throws EISDIR)', scenario0);
  await scenario('1. rebuildGraph THREW, so the failure really was injected mid-transaction', scenario1);
  await scenario('2. on REOPEN every seeded row survives, irreplaceable and regenerable alike', scenario2);
  await scenario('3. node and edge counts are EXACTLY equal before and after the failed rebuild', scenario3);

  if (observed.scratch) rmrf(observed.scratch);

  process.stdout.write('\n  passed: ' + passed + '  failed: ' + failed + '\n\n');
  if (failed > 0) process.exit(1);
})();
