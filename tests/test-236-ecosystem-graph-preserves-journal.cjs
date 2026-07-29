#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236 Plan 01 Task 4 -- the GRAPHDB-01 survival gate for SITE 2,
 * scripts/build-ecosystem-graph.cjs. Sibling of
 * tests/test-236-rebuild-preserves-journal.cjs (same harness, same numbering
 * convention, same measure-do-not-assume discipline).
 *
 * WHY A SECOND SITE EXISTS. Site 1 (rebuildGraph) is the site the RCA names.
 * Site 2 was found by adversarial verification and appears in neither the RCA
 * nor 236-RESEARCH.md: scripts/build-ecosystem-graph.cjs resolves the SAME
 * <roomDir>/.mindrian/room.db, opens it through lazygraph-ops openGraph, and
 * runs the byte-identical unscoped statement. It carries the same data-loss
 * defect AND, unlike rebuildGraph, has no transaction at all: the wipe and the
 * whole rewrite were bare autocommit statements, so a crash mid-run left a
 * permanently emptied room.
 *
 * WHAT THIS MEASURES VERSUS ASSUMES. The script is driven the way a USER drives
 * it, via child_process.spawnSync(process.execPath, [scriptPath, roomDir]), and
 * every assertion re-reads real rows out of the real room.db afterward. The
 * success scenarios assert status === 0 so a script that CRASHED cannot pass by
 * leaving the room untouched.
 *
 * MUTATION THAT TURNS THIS RED. Reverting this script's delete sequence to
 * `conn.exec('DELETE FROM edges; DELETE FROM nodes;')` turns scenarios 1
 * through 3 red. Widening the derived-edge delete to a type-only predicate
 * (dropping the endpoint-ownership subqueries) turns scenario 6 red. Removing
 * the new BEGIN/COMMIT/ROLLBACK wrap turns scenario 7 red.
 *
 * Scenarios:
 *   1. The seeded memory_event survives with its properties blob byte-identical.
 *   2. The seeded confirmed truth-claim survives with review_status 'confirmed'.
 *   3. The seeded opportunity survives with its D-17 stage_history array the
 *      same length and the same entries.
 *   4. The script still WORKS: Artifact and Section counts after the run are
 *      greater than zero. This stops a "fix" that simply deletes nothing.
 *   5. Stale reclamation still works: an artifact file deleted from disk before
 *      the run has its Artifact node GONE afterward.
 *   6. Derivation-authored cascade edges survive: an INFORMS edge written
 *      through navigation.writeEdge between two NON-artifact nodes (the seeded
 *      claim and the seeded opportunity) is still present after the run. This
 *      is the scenario that proves the endpoint-ownership scoping is real and
 *      not decorative. navigation.writeEdge has been the SOLE writer of INFORMS
 *      and CONTRADICTS since Phase 169 D-169-08 and it writes them between
 *      claims, memory events and decisions too, so a blanket
 *      `WHERE type IN ('INFORMS','CONTRADICTS','CONVERGES')` predicate looks
 *      correctly scoped while still destroying edges this script cannot rebuild.
 *   7. Atomicity: a mid-run failure is injected, the process must exit NONZERO,
 *      and on REOPEN the node and edge counts must be EXACTLY equal to their
 *      pre-run values.
 *
 * THE SCENARIO 7 FAILURE SEAM, and why it is confirmed by observation rather
 * than assumed. The seam is chmod 000 on one seeded .md artifact, so the
 * script's own `fs.readFileSync` throws EACCES from inside Phase 1, which is
 * inside the wrapped region. Two seams were tried and REJECTED first, because
 * walkDir swallows both before any read happens: replacing the .md with a
 * DIRECTORY of the same name (walkDir recurses into it instead of listing it as
 * a file) and replacing it with a dangling SYMLINK (walkDir statSyncs it,
 * throws, and `continue`s). The scenario therefore PRE-VERIFIES in-process that
 * readFileSync actually throws on the prepared seam before it asserts anything
 * about the script, so a seam that silently stopped biting (for example under
 * uid 0, where chmod 000 does not block a read) reports as an explicit seam
 * failure and never as a false green.
 *
 * Each scenario runs against its OWN fresh scratch room. tests/ is on the
 * scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT list.
 *
 * Harness: the ok/fail/scenario pass-counter from
 * tests/test-233-graph-derive-health.cjs:60-73, exiting nonzero when failed > 0.
 * No jest, no vitest. No em-dashes (CLAUDE.md hard rule).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'build-ecosystem-graph.cjs');

const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-236-eco-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Drive the script exactly the way a user does: a real child process over argv.
function runScript(roomDir) {
  const res = spawnSync(process.execPath, [SCRIPT, roomDir], {
    encoding: 'utf8',
    timeout: 60000,
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function withOpenRoom(roomDir, fn) {
  const db = roomDb.openRoomDb(roomDir);
  try { return fn(db); } finally { roomDb.closeRoomDb(db); }
}

function artifactIds(db) {
  return db.prepare("SELECT id FROM nodes WHERE type = 'Artifact' ORDER BY id")
    .all().map((r) => r.id);
}

function edgeExists(db, source, target, type) {
  const row = db.prepare(
    'SELECT 1 AS hit FROM edges WHERE source = ? AND target = ? AND type = ?'
  ).get(source, target, type);
  return !!row;
}

function assertScriptOk(res, what) {
  assert.equal(
    res.status, 0,
    what + ': build-ecosystem-graph.cjs must exit 0, got ' + res.status
      + '\n--- stderr ---\n' + res.stderr.slice(0, 1200)
  );
}

// ---------- Scenario 1 ----------

async function scenario1() {
  const scratch = makeScratchDir('s1');
  try {
    const fx = await buildFixtureRoom236(scratch);
    const before = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.memoryEventId));
    assert.ok(before, 'fixture must have seeded a memory_event row before the run');

    const res = runScript(fx.roomDir);
    assertScriptOk(res, 'scenario 1');

    const after = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.memoryEventId));
    assert.ok(
      after,
      'memory_event ' + fx.memoryEventId + ' was DESTROYED by build-ecosystem-graph.cjs '
        + '(site 2 of the GRAPHDB-01 unscoped wipe)'
    );
    assert.equal(
      after.properties, before.properties,
      'memory_event properties blob must be BYTE-IDENTICAL across the ecosystem build'
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 2 ----------

async function scenario2() {
  const scratch = makeScratchDir('s2');
  try {
    const fx = await buildFixtureRoom236(scratch);
    const before = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.claimId));
    assert.equal(before.review_status, 'confirmed', 'fixture claim must start confirmed');

    const res = runScript(fx.roomDir);
    assertScriptOk(res, 'scenario 2');

    const after = withOpenRoom(fx.roomDir, (db) => readNodeRow(db, fx.claimId));
    assert.ok(
      after,
      'confirmed truth-claim ' + fx.claimId + ' was DESTROYED by build-ecosystem-graph.cjs'
    );
    assert.equal(
      after.review_status, 'confirmed',
      'truth-claim review_status must still be confirmed, got ' + after.review_status
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 3 ----------

async function scenario3() {
  const scratch = makeScratchDir('s3');
  try {
    const fx = await buildFixtureRoom236(scratch);
    const before = withOpenRoom(fx.roomDir, (db) => readStageHistory(db, fx.opportunityId));
    assert.ok(Array.isArray(before) && before.length >= 2, 'fixture stage_history must be seeded');

    const res = runScript(fx.roomDir);
    assertScriptOk(res, 'scenario 3');

    const after = withOpenRoom(fx.roomDir, (db) => readStageHistory(db, fx.opportunityId));
    assert.ok(
      Array.isArray(after),
      'opportunity ' + fx.opportunityId + ' or its stage_history was DESTROYED by '
        + 'build-ecosystem-graph.cjs (D-17 append-only ledger, unrecoverable)'
    );
    assert.equal(
      after.length, before.length,
      'stage_history LENGTH must be unchanged: before ' + before.length + ', after ' + after.length
    );
    assert.deepEqual(after, before, 'stage_history entries must be unchanged');
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 4 ----------

async function scenario4() {
  const scratch = makeScratchDir('s4');
  try {
    const artifactCount = 4;
    const fx = await buildFixtureRoom236(scratch, { artifactCount: artifactCount });

    const res = runScript(fx.roomDir);
    assertScriptOk(res, 'scenario 4');

    const counts = withOpenRoom(fx.roomDir, (db) => countPopulations(db));
    assert.ok(
      counts.Artifact > 0,
      'Artifact node count must be > 0 after the ecosystem build (a fix that deletes '
        + 'nothing would also regenerate nothing), got ' + JSON.stringify(counts)
    );
    assert.ok(
      counts.Section > 0,
      'Section node count must be > 0 after the ecosystem build, got ' + JSON.stringify(counts)
    );
    assert.equal(
      counts.Artifact, artifactCount,
      'Artifact node count must equal the artifactCount, got ' + JSON.stringify(counts)
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 5 ----------

async function scenario5() {
  const scratch = makeScratchDir('s5');
  try {
    const artifactCount = 4;
    const fx = await buildFixtureRoom236(scratch, { artifactCount: artifactCount });

    const before = withOpenRoom(fx.roomDir, (db) => artifactIds(db));
    assert.equal(before.length, artifactCount, 'fixture must pre-index ' + artifactCount);

    fs.rmSync(fx.artifactFiles[0]);

    const res = runScript(fx.roomDir);
    assertScriptOk(res, 'scenario 5');

    const after = withOpenRoom(fx.roomDir, (db) => artifactIds(db));
    assert.equal(
      after.length, artifactCount - 1,
      'the ecosystem build must RECLAIM the Artifact node of the deleted file: expected '
        + (artifactCount - 1) + ', got ' + after.length
        + ' (an allowlist too NARROW to include Artifact leaves this row orphaned)'
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 6: derivation-authored cascade edges survive ----------

async function scenario6() {
  const scratch = makeScratchDir('s6');
  try {
    const fx = await buildFixtureRoom236(scratch);

    // A cascade edge between two NON-artifact nodes, written through the Part 9
    // chokepoint exactly as runDerivation writes it. Neither endpoint is
    // indexer-owned, so an endpoint-ownership-scoped delete must leave it alone
    // while a type-only predicate destroys it.
    withOpenRoom(fx.roomDir, (db) => {
      const r = navigation.writeEdge(db, {
        source_id: fx.claimId,
        target_id: fx.opportunityId,
        edge_type: 'INFORMS',
        properties: { seeded_by: 'test-236-ecosystem-graph-preserves-journal' },
      });
      assert.equal(r.ok, true, 'seed writeEdge(INFORMS) must succeed: ' + JSON.stringify(r));
    });

    const seeded = withOpenRoom(fx.roomDir, (db) =>
      edgeExists(db, fx.claimId, fx.opportunityId, 'INFORMS'));
    assert.equal(seeded, true, 'the seeded non-artifact INFORMS edge must exist before the run');

    const res = runScript(fx.roomDir);
    assertScriptOk(res, 'scenario 6');

    const survived = withOpenRoom(fx.roomDir, (db) =>
      edgeExists(db, fx.claimId, fx.opportunityId, 'INFORMS'));
    assert.equal(
      survived, true,
      'the derivation-authored INFORMS edge between two NON-artifact nodes ('
        + fx.claimId + ' -> ' + fx.opportunityId + ') was DESTROYED. The derived-edge '
        + 'delete must be scoped by BOTH endpoints being indexer-owned node ids, not '
        + 'by edge type alone: navigation.writeEdge is the sole writer of INFORMS and '
        + 'this script cannot regenerate a claim-to-opportunity edge.'
    );
  } finally {
    rmrf(scratch);
  }
}

// ---------- Scenario 7: atomicity ----------

async function scenario7() {
  const scratch = makeScratchDir('s7');
  let doomed = null;
  try {
    const artifactCount = 4;
    const fx = await buildFixtureRoom236(scratch, { artifactCount: artifactCount });

    const before = withOpenRoom(fx.roomDir, (db) => countPopulations(db));

    // Inject the mid-run failure seam and CONFIRM BY OBSERVATION that it throws
    // from a plain readFileSync, which is what the script's Phase 1 does from
    // inside the region that must be wrapped.
    doomed = fx.artifactFiles[1];
    fs.chmodSync(doomed, 0o000);
    let seamThrew = false;
    try { fs.readFileSync(doomed, 'utf-8'); } catch (_e) { seamThrew = true; }
    assert.equal(
      seamThrew, true,
      'the injected seam did NOT throw on readFileSync, so scenario 7 would assert '
        + 'nothing. chmod 000 does not block a read under uid 0; run this test as a '
        + 'non-root user or pick a different seam.'
    );

    const res = runScript(fx.roomDir);
    assert.notEqual(
      res.status, 0,
      'the ecosystem build must FAIL when a seeded artifact cannot be read, got exit 0'
    );

    // Restore permissions BEFORE reading back, so cleanup and the reopen are clean.
    fs.chmodSync(doomed, 0o644);
    doomed = null;

    const after = withOpenRoom(fx.roomDir, (db) => countPopulations(db));
    assert.deepEqual(
      after, before,
      'ATOMICITY VIOLATION: node and edge counts must be EXACTLY equal after a failed '
        + 'run. Without a BEGIN/COMMIT/ROLLBACK wrap the wipe commits as a bare '
        + 'autocommit statement and the crash leaves a permanently emptied room.\n'
        + '  before: ' + JSON.stringify(before) + '\n'
        + '  after:  ' + JSON.stringify(after)
    );
  } finally {
    if (doomed) { try { fs.chmodSync(doomed, 0o644); } catch (_) { /* best-effort */ } }
    rmrf(scratch);
  }
}

// ---------- Runner ----------

(async () => {
  process.stdout.write(
    '\nPhase 236-01 Task 4: build-ecosystem-graph.cjs journal-survival gate (site 2)\n\n'
  );

  await scenario('1. memory_event survives the ecosystem build with a byte-identical properties blob', scenario1);
  await scenario('2. confirmed truth-claim survives the ecosystem build with review_status confirmed', scenario2);
  await scenario('3. opportunity stage_history survives the ecosystem build unchanged', scenario3);
  await scenario('4. ecosystem build still regenerates Artifact and Section nodes', scenario4);
  await scenario('5. ecosystem build still reclaims the Artifact node of a file deleted from disk', scenario5);
  await scenario('6. derivation-authored INFORMS edge between two non-artifact nodes survives', scenario6);
  await scenario('7. a mid-run failure rolls back: node and edge counts exactly unchanged', scenario7);

  process.stdout.write('\n  passed: ' + passed + '  failed: ' + failed + '\n\n');
  if (failed > 0) process.exit(1);
})();
