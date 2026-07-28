#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236 Plan 01 Task 2 -- the GRAPHDB-01 survival gate for
 * lib/core/lazygraph-ops.cjs rebuildGraph. This is RCA Test 1.
 *
 * WHAT THIS MEASURES VERSUS ASSUMES. Every assertion below reads REAL state out
 * of a REAL .mindrian/room.db seeded through the repo's own production writers
 * (tests/helpers/fixture-room-236.cjs), then runs the REAL rebuildGraph against
 * it and re-reads the same rows off disk. There is not one mocked return value.
 * A "the rebuild preserved the journal" claim can never mask an emptied table,
 * because the assertions compare the properties blob BYTE-FOR-BYTE and the
 * stage_history array ELEMENT-FOR-ELEMENT, not merely row existence.
 *
 * MUTATION THAT TURNS THIS RED. Reverting the DELETE in rebuildGraph to
 * `conn.exec('DELETE FROM edges; DELETE FROM nodes;')` turns scenarios 1
 * through 3 red. That is the exact statement this phase exists to eliminate, and
 * observing these three scenarios fail against the unmodified source IS the bug
 * reproducing under test.
 *
 * NOTE ON WHAT DOES *NOT* TURN THIS RED, because 236-RESEARCH.md proved it by
 * live crash injection: removing the BEGIN/COMMIT/ROLLBACK wrap does NOT turn
 * scenarios 1-3 red. The wrap at lazygraph-ops.cjs:542 / :614-618 already exists
 * and already works. The loss does not happen on the crash path; it happens on
 * the HAPPY path, atomically, every single time. A plan that implemented the
 * roadmap criterion literally ("removing the transaction turns this red") would
 * ship green with the data loss fully intact. This file therefore pins DELETE
 * SCOPE, not atomicity.
 *
 * Scenarios:
 *   1. The seeded memory_event node survives with its original id and its
 *      properties blob byte-identical before and after the rebuild.
 *   2. The seeded truth-claim node survives with review_status still 'confirmed'.
 *   3. The seeded opportunity survives and its parsed D-17 stage_history array
 *      has the SAME LENGTH and the same entries (the append-only contract:
 *      assert the array, not merely that the row exists).
 *   4. The rebuild still WORKS: Artifact and Section counts after the rebuild
 *      are greater than zero and the returned {success:true, artifacts} matches
 *      the fixture's artifactCount. This scenario is what stops a lazy "fix"
 *      that simply deletes nothing from passing, and its passing against the
 *      UNMODIFIED source is the evidence that the harness itself is sound and
 *      the red legs are the defect rather than a broken test.
 *   5. Stale-artifact reclamation still works: an artifact file deleted from
 *      disk before the rebuild has its Artifact node GONE afterward. Artifact is
 *      in the allowlist precisely so the indexer can still reclaim its own rows;
 *      a fix that scoped the DELETE too narrowly leaves this row orphaned and
 *      this scenario catches it.
 *
 * Each scenario runs against its OWN fresh scratch room via fs.mkdtempSync and
 * cleans up with the best-effort rmrf idiom. tests/ is on the
 * scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT list, so requiring
 * room-db.cjs here is sanctioned.
 *
 * Harness: the plain ok/fail/scenario pass-counter from
 * tests/test-233-graph-derive-health.cjs:60-73, exiting nonzero when failed > 0.
 * No jest, no vitest. No em-dashes (CLAUDE.md hard rule).
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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-236-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Read every Artifact node id as a sorted array, so a scenario can diff the set
// before and after a rebuild without needing the non-exported getArtifactId.
function artifactIds(db) {
  return db.prepare("SELECT id FROM nodes WHERE type = 'Artifact' ORDER BY id")
    .all().map((r) => r.id);
}

// Open the room, run the REAL rebuildGraph, close. rebuildGraph is
// `async function rebuildGraph(conn, roomDir, _visited)` and takes an OPEN
// DatabaseSync conn as its FIRST argument (lazygraph-ops.cjs:517). It returns a
// Promise, so it must be awaited. Do NOT call it as rebuildGraph(roomDir): that
// is lib/core/graph-ops.cjs:83's wrapper signature, not this one.
async function runRebuild(roomDir) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    return await lazygraph.rebuildGraph(db, roomDir);
  } finally {
    roomDb.closeRoomDb(db);
  }
}

function withOpenRoom(roomDir, fn) {
  const db = roomDb.openRoomDb(roomDir);
  try { return fn(db); } finally { roomDb.closeRoomDb(db); }
}

// ---------- Scenario 1: the append-only memory_event journal survives ----------

async function scenario1() {
  const scratch = makeScratchDir('s1');
  try {
    const fx = await buildFixtureRoom236(scratch);

    const before = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.memoryEventId));
    assert.ok(before, 'fixture must have seeded a memory_event row before the rebuild');
    assert.equal(before.type, 'memory_event', 'seeded row must be type memory_event');

    await runRebuild(fx.roomDir);

    const after = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.memoryEventId));
    assert.ok(
      after,
      'memory_event ' + fx.memoryEventId + ' was DESTROYED by the rebuild '
        + '(the GRAPHDB-01 data-loss defect: the append-only audit journal exists '
        + 'nowhere else and cannot be re-derived)'
    );
    assert.equal(after.id, before.id, 'memory_event id must be unchanged');
    assert.equal(
      after.properties, before.properties,
      'memory_event properties blob must be BYTE-IDENTICAL across the rebuild'
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 2: the human-confirmed truth-claim survives ----------

async function scenario2() {
  const scratch = makeScratchDir('s2');
  try {
    const fx = await buildFixtureRoom236(scratch);

    const before = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.claimId));
    assert.ok(before, 'fixture must have seeded a claim row before the rebuild');
    assert.equal(
      before.review_status, 'confirmed',
      'fixture claim must be CONFIRMED before the rebuild (confirmNode ran)'
    );

    await runRebuild(fx.roomDir);

    const after = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.claimId));
    assert.ok(
      after,
      'confirmed truth-claim ' + fx.claimId + ' was DESTROYED by the rebuild '
        + '(Canon Part 9 role 5: a human confirmed it and nothing can re-confirm it)'
    );
    assert.equal(
      after.review_status, 'confirmed',
      'truth-claim review_status must still be confirmed after the rebuild, got '
        + after.review_status
    );
    assert.equal(
      after.properties, before.properties,
      'truth-claim properties blob must be BYTE-IDENTICAL across the rebuild'
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 3: the D-17 append-only stage_history survives ----------

async function scenario3() {
  const scratch = makeScratchDir('s3');
  try {
    const fx = await buildFixtureRoom236(scratch);

    const before = withOpenRoom(fx.roomDir, (db) => readStageHistory(db, fx.opportunityId));
    assert.ok(
      Array.isArray(before) && before.length >= 2,
      'fixture must have seeded a stage_history of length >= 2, got ' + JSON.stringify(before)
    );

    await runRebuild(fx.roomDir);

    const after = withOpenRoom(fx.roomDir, (db) => readStageHistory(db, fx.opportunityId));
    assert.ok(
      Array.isArray(after),
      'opportunity ' + fx.opportunityId + ' or its stage_history was DESTROYED by the '
        + 'rebuild (D-17 append-only ledger: every prior entry is immutable and '
        + 'unrecoverable)'
    );
    assert.equal(
      after.length, before.length,
      'stage_history LENGTH must be unchanged across the rebuild: before '
        + before.length + ', after ' + after.length
    );
    assert.deepEqual(
      after, before,
      'stage_history entries must be unchanged across the rebuild'
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 4: the rebuild still WORKS ----------

async function scenario4() {
  const scratch = makeScratchDir('s4');
  try {
    const artifactCount = 4;
    const fx = await buildFixtureRoom236(scratch, { artifactCount: artifactCount });

    const res = await runRebuild(fx.roomDir);
    assert.equal(res.success, true, 'rebuildGraph must report success:true');
    assert.equal(
      res.artifacts, artifactCount,
      'rebuildGraph must report artifacts === the fixture artifactCount ('
        + artifactCount + '), got ' + res.artifacts
    );

    const counts = withOpenRoom(fx.roomDir, (db) => countPopulations(db));
    assert.ok(
      counts.Artifact > 0,
      'Artifact node count must be > 0 after the rebuild (a fix that simply '
        + 'deletes nothing would also regenerate nothing), got ' + JSON.stringify(counts)
    );
    assert.ok(
      counts.Section > 0,
      'Section node count must be > 0 after the rebuild, got ' + JSON.stringify(counts)
    );
    assert.equal(
      counts.Artifact, artifactCount,
      'Artifact node count must equal the artifactCount after the rebuild, got '
        + JSON.stringify(counts)
    );
    assert.ok(
      counts._edges.BELONGS_TO > 0,
      'BELONGS_TO edges must be regenerated by the rebuild, got '
        + JSON.stringify(counts._edges)
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 5: stale-artifact reclamation still works ----------

async function scenario5() {
  const scratch = makeScratchDir('s5');
  try {
    const artifactCount = 4;
    const fx = await buildFixtureRoom236(scratch, { artifactCount: artifactCount });

    const before = withOpenRoom(fx.roomDir, (db) => artifactIds(db));
    assert.equal(
      before.length, artifactCount,
      'fixture must have pre-indexed ' + artifactCount + ' Artifact nodes, got '
        + before.length
    );

    // Delete ONE artifact file from disk. The rebuild must reclaim its node.
    const doomed = fx.artifactFiles[0];
    fs.rmSync(doomed);
    assert.equal(fs.existsSync(doomed), false, 'the doomed artifact file must be gone from disk');

    await runRebuild(fx.roomDir);

    const after = withOpenRoom(fx.roomDir, (db) => artifactIds(db));
    assert.equal(
      after.length, artifactCount - 1,
      'the rebuild must RECLAIM the Artifact node of the deleted file: expected '
        + (artifactCount - 1) + ' Artifact nodes, got ' + after.length
        + ' (an allowlist too NARROW to include Artifact leaves this row orphaned)'
    );
    const orphaned = after.filter((id) => before.indexOf(id) === -1);
    assert.deepEqual(
      orphaned, [],
      'the rebuild must not invent Artifact ids that did not exist before'
    );
    const reclaimed = before.filter((id) => after.indexOf(id) === -1);
    assert.equal(
      reclaimed.length, 1,
      'EXACTLY one Artifact node must have been reclaimed, got '
        + JSON.stringify(reclaimed)
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Runner ----------

(async () => {
  process.stdout.write('\nPhase 236-01 Task 2: rebuildGraph journal-survival gate (RCA Test 1)\n\n');

  await scenario('1. memory_event survives the rebuild with a byte-identical properties blob', scenario1);
  await scenario('2. confirmed truth-claim survives the rebuild with review_status confirmed', scenario2);
  await scenario('3. opportunity stage_history survives the rebuild unchanged in length and entries', scenario3);
  await scenario('4. rebuild still regenerates Artifact/Section nodes and BELONGS_TO edges', scenario4);
  await scenario('5. rebuild still reclaims the Artifact node of a file deleted from disk', scenario5);

  process.stdout.write('\n  passed: ' + passed + '  failed: ' + failed + '\n\n');
  if (failed > 0) process.exit(1);
})();
