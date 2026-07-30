#!/usr/bin/env node
'use strict';

/*
 * Phase 244 Plan 03 Task 2 -- the ghost-trigger fence for the eureka_fts
 * reconcile landed in lib/core/lazygraph-ops.cjs rebuildGraph (Task 1).
 *
 * THE HAZARD THIS PINS. clearIndexerOwnedRows scoped-deletes Artifact/Section
 * nodes on a rebuild; eureka_fts is a DERIVED fts5 table that is NOT covered
 * by that wipe, so without the reconcile a stale row keeps MATCHing and points
 * a would-be content-tier trigger at a dead node_id (244-RESEARCH.md Q2,
 * Pitfall 4). The hazard is RESURRECTION, not loss.
 *
 * Five scenarios, four live mutation proofs (each executed against the real
 * source, observed red, reverted, confirmed green):
 *   1. The ghost: a deleted artifact's stale FTS row is gone after a rebuild,
 *      and zero orphan rows remain.
 *   2. The anti-vacuity control: a SURVIVING artifact keeps its FTS row and
 *      keeps matching. Without this, an unconditional DELETE would pass
 *      scenario 1 while destroying the whole index.
 *   3. Absent-table no-op: a room whose eureka_fts was never built rebuilds to
 *      the same populations as an FTS-free control run, and throws nothing.
 *   4. Capability-absent no-op: with MINDRIAN_FORCE_FTS_ABSENT=1 and
 *      resetFtsProbe() called, the rebuild completes and the reconcile is
 *      skipped (a stale row that WOULD have been reconciled survives).
 *   5. Atomicity: a crash injected mid-transaction (the Phase 236-02 seam)
 *      rolls back BOTH the node-table changes AND the reconcile's FTS delete
 *      together, because they share one BEGIN.
 *
 * REBUILDGRAPH SIGNATURE TRAP (test-236-rebuild-preserves-journal.cjs's own
 * warning, repeated here because it bites this file too): rebuildGraph is
 * `async function rebuildGraph(conn, roomDir, _visited)` and takes an OPEN
 * DatabaseSync conn as its FIRST argument. Do NOT call rebuildGraph(roomDir).
 *
 * WHY THE CRASH SEAM IS THE PER-FILE READ, NOT THE PER-SECTION READDIR.
 * rebuildGraph wraps its per-section readdirSync in a try/catch that
 * `continue`s past a broken section (lazygraph-ops.cjs's section-walk loop),
 * so an injection THERE is silently absorbed and never reaches the outer
 * catch -- the rebuild would complete cleanly and this file would prove
 * nothing about atomicity. The chosen seam (replace one seeded .md FILE with
 * a DIRECTORY of the same name, copied verbatim from
 * tests/test-236-rebuild-crash-mid-transaction.cjs) bites at the per-FILE
 * _indexArtifactBody -> _readArtifactContent -> fs.readFileSync call, which
 * sits directly inside the outer try, AFTER clearIndexerOwnedRows and the
 * reconcile have already run in this same attempt. That is the exact state
 * that must not survive.
 *
 * SCENARIO 5's SENTINEL ORPHAN, AND WHY IT EXISTS. A crash-atomicity test
 * built around ONLY the deleted ghost artifact does NOT discriminate reconcile
 * placement: clearIndexerOwnedRows always deletes the ghost's node INSIDE the
 * crashing transaction, and the ROLLBACK always restores it regardless of
 * where the reconcile statement sits, so the ghost's FTS row is untouched
 * either way (it was never orphaned at the moment ANY reconcile call runs,
 * whether inside or outside BEGIN, because the node-delete that orphans it
 * has not happened yet outside a transaction, and gets undone if it happens
 * inside one). To make Mutation Proof 4 (move the reconcile before BEGIN)
 * actually turn red, scenario 5 also seeds a SENTINEL row directly into
 * eureka_fts whose node_id never corresponds to any real node -- an orphan
 * that pre-exists BEFORE rebuildGraph is ever called. With the reconcile
 * correctly inside BEGIN, a crashing attempt's reconcile-delete of that
 * sentinel is part of the same transaction and gets rolled back with
 * everything else, so the sentinel survives. With the reconcile moved before
 * BEGIN (the mutation), the sentinel is deleted by an AUTOCOMMITTED statement
 * before the transaction even opens, so no later rollback can restore it, and
 * it is GONE after the crash. That asymmetry is the discriminator.
 *
 * Harness: the PASS/FAIL/FAILURES async runner from
 * tests/test-219-fts5-degrade.cjs:110-125 (this file's FTS-probe legs are the
 * closer analog than the plain ok/fail counter test-236 uses).
 *
 * tests/ is on the scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT list, so
 * requiring room-db.cjs here is sanctioned. No em-dashes anywhere (CLAUDE.md
 * HARD RULE). CJS only, zero new deps, zero network reach.
 */

// Hermeticity: flip transformers.js allowRemoteModels=false so nothing here
// can reach the network when run standalone.
require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const tri = require(path.join(REPO, 'lib', 'core', 'eureka', 'tri-modal-index.cjs'));

const {
  buildFixtureRoom236,
  countPopulations,
} = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-236.cjs'));

// ---------- Tiny test runner (PASS/FAIL/FAILURES, test-219-fts5-degrade.cjs idiom) ----------

let PASS = 0;
let FAIL = 0;
const FAILURES = [];

async function test(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('  PASS: ' + name);
  } catch (err) {
    FAIL += 1;
    FAILURES.push({ name: name, err: err });
    console.log('  FAIL: ' + name + ' -- ' + (err && err.message));
  }
}

// ---------- Shared helpers ----------

const scratchDirs = [];

function makeScratchDir(suffix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-244-03-' + suffix + '-'));
  scratchDirs.push(dir);
  return dir;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

function withOpenRoom(roomDir, fn) {
  const db = roomDb.openRoomDb(roomDir);
  try { return fn(db); } finally { roomDb.closeRoomDb(db); }
}

// Open the room, run the REAL rebuildGraph, close. See the header note above:
// rebuildGraph takes an OPEN conn as its FIRST argument, never a roomDir alone.
async function runRebuild(roomDir) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    return await lazygraph.rebuildGraph(db, roomDir);
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// Mirrors lazygraph-ops.cjs's private getArtifactId (path-relative, extension
// stripped). Not exported, so a test that needs to predict an artifact's node
// id independently of the indexer replicates the same 2-line rule rather than
// reaching into a private function.
function nodeIdForArtifact(roomDir, absPath) {
  const rel = path.relative(path.resolve(roomDir), path.resolve(absPath));
  return rel.replace(/\.(md|docx|html|htm)$/i, '').replace(/\\/g, '/');
}

function orphanRowCount(db) {
  return db.prepare(
    'SELECT count(*) AS c FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)'
  ).get().c;
}

function ftsRowExists(db, nodeId) {
  return !!db.prepare('SELECT node_id FROM eureka_fts WHERE node_id = ?').get(nodeId);
}

// Build the FTS index directly (openIndex then indexNodes), independent of
// Plan 02's drain, per the plan's Task 2 action.
async function buildFtsIndex(roomDir) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    tri.openIndex(db);
    await tri.indexNodes(db, { roomDir: roomDir });
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// Write one extra distinctive-token artifact into the fixture's section dir
// and index it through the real production writer, returning its node id.
async function addDistinctiveArtifact(fx, slug, token) {
  const rel = path.join(fx.section, slug + '.md');
  const abs = path.join(fx.roomDir, rel);
  fs.writeFileSync(
    abs,
    '# ' + token + '\n\nThis is the ' + slug + ' fixture artifact for the '
      + 'eureka_fts reconcile fence.\n',
    'utf8'
  );
  const db = roomDb.openRoomDb(fx.roomDir);
  let result;
  try {
    result = await lazygraph.indexArtifact(db, fx.roomDir, abs);
  } finally {
    roomDb.closeRoomDb(db);
  }
  return { path: abs, nodeId: result.id };
}

// ---------- Scenario 1: the ghost ----------

async function scenario1() {
  const scratch = makeScratchDir('s1');
  const fx = await buildFixtureRoom236(scratch, { artifactCount: 2 });
  const ghost = await addDistinctiveArtifact(fx, 'ghost-scenario1', 'QuorvexnimbralGhostArtifact');

  await buildFtsIndex(fx.roomDir);

  const beforeHits = withOpenRoom(fx.roomDir, (db) => tri.lexicalSearch(db, 'quorvexnimbralghostartifact', 5));
  assert.ok(
    beforeHits.some((h) => h.node_id === ghost.nodeId),
    'the ghost artifact must be lexically findable BEFORE it is deleted, got '
      + JSON.stringify(beforeHits)
  );

  fs.rmSync(ghost.path);
  assert.equal(fs.existsSync(ghost.path), false, 'the ghost artifact file must be gone from disk');

  await runRebuild(fx.roomDir);

  const afterHits = withOpenRoom(fx.roomDir, (db) => tri.lexicalSearch(db, 'quorvexnimbralghostartifact', 5));
  assert.deepEqual(
    afterHits, [],
    'a content-tier trigger must NOT be able to match the deleted ghost artifact '
      + 'after a rebuild (the resurrection hazard), got ' + JSON.stringify(afterHits)
      + ' (dead node_id: ' + ghost.nodeId + ')'
  );

  const orphans = withOpenRoom(fx.roomDir, (db) => orphanRowCount(db));
  assert.equal(orphans, 0, 'orphan_rows must be 0 after the rebuild, got ' + orphans);

  const nodeStillThere = withOpenRoom(
    fx.roomDir,
    (db) => !!db.prepare('SELECT id FROM nodes WHERE id = ?').get(ghost.nodeId)
  );
  assert.equal(
    nodeStillThere, false,
    'sanity: the ghost artifact node itself must also be reclaimed (stale-artifact '
      + 'reclamation, Phase 236), otherwise this scenario proves nothing new'
  );
}

// ---------- Scenario 2: the anti-vacuity control ----------

async function scenario2() {
  const scratch = makeScratchDir('s2');
  const fx = await buildFixtureRoom236(scratch, { artifactCount: 1 });
  const survivor = await addDistinctiveArtifact(fx, 'survivor-scenario2', 'FendralozomiteSurvivorArtifact');

  await buildFtsIndex(fx.roomDir);

  const beforeHits = withOpenRoom(fx.roomDir, (db) => tri.lexicalSearch(db, 'fendralozomitesurvivorartifact', 5));
  assert.ok(
    beforeHits.some((h) => h.node_id === survivor.nodeId),
    'the survivor artifact must be lexically findable before the rebuild, got '
      + JSON.stringify(beforeHits)
  );

  // The survivor file is deliberately NOT deleted.
  await runRebuild(fx.roomDir);

  const nodeStillThere = withOpenRoom(
    fx.roomDir,
    (db) => !!db.prepare('SELECT id FROM nodes WHERE id = ?').get(survivor.nodeId)
  );
  assert.equal(
    nodeStillThere, true,
    'the survivor artifact node must still exist after the rebuild (its file was '
      + 'never deleted, and node ids are path-derived and stable)'
  );

  const afterHits = withOpenRoom(fx.roomDir, (db) => tri.lexicalSearch(db, 'fendralozomitesurvivorartifact', 5));
  assert.ok(
    afterHits.some((h) => h.node_id === survivor.nodeId),
    'a SURVIVING node must keep its FTS row and keep matching after the rebuild '
      + '(an unconditional DELETE would fail this while passing scenario 1), got '
      + JSON.stringify(afterHits)
  );
}

// ---------- Scenario 3: absent-table no-op ----------

async function scenario3() {
  const controlScratch = makeScratchDir('s3-control');
  const testScratch = makeScratchDir('s3-test');
  const artifactCount = 3;

  // The control room: eureka_fts is NEVER built (no buildFtsIndex call). Its
  // rebuild result and post-rebuild populations are captured live, in this
  // same process, rather than hardcoded, per the plan's Task 2 action.
  const fxControl = await buildFixtureRoom236(controlScratch, { artifactCount: artifactCount });
  const controlHasTable = withOpenRoom(fxControl.roomDir, (db) => tri.tableExists(db, 'eureka_fts'));
  assert.equal(controlHasTable, false, 'precondition: the control room must never have built eureka_fts');
  const controlRes = await runRebuild(fxControl.roomDir);
  assert.equal(controlRes.success, true, 'the FTS-free control rebuild must report success:true');
  const controlCounts = withOpenRoom(fxControl.roomDir, (db) => countPopulations(db));

  // The test room: same shape, same artifactCount, also never builds
  // eureka_fts. The guard in the reconcile (tableExists) must make the
  // reconcile a true no-op, not merely a caught exception.
  const fxTest = await buildFixtureRoom236(testScratch, { artifactCount: artifactCount });
  const testHasTableBefore = withOpenRoom(fxTest.roomDir, (db) => tri.tableExists(db, 'eureka_fts'));
  assert.equal(testHasTableBefore, false, 'precondition: the test room must never have built eureka_fts either');

  let thrown = null;
  let testRes = null;
  try {
    testRes = await runRebuild(fxTest.roomDir);
  } catch (e) {
    thrown = e;
  }
  assert.equal(
    thrown, null,
    'rebuildGraph must not throw when eureka_fts was never built, got: '
      + (thrown && thrown.stack)
  );
  assert.equal(testRes.success, true, 'the rebuild must still report success:true');
  assert.equal(
    testRes.artifacts, controlRes.artifacts,
    'artifact count must match the FTS-free control run: control='
      + controlRes.artifacts + ' test=' + testRes.artifacts
  );

  const testCounts = withOpenRoom(fxTest.roomDir, (db) => countPopulations(db));
  assert.deepEqual(
    testCounts, controlCounts,
    'node/edge populations must match the FTS-free control run byte for byte'
  );
}

// ---------- Scenario 4: capability-absent no-op ----------

async function scenario4() {
  const ENV_FORCED_AT_START = typeof process.env.MINDRIAN_FORCE_FTS_ABSENT === 'string'
    && process.env.MINDRIAN_FORCE_FTS_ABSENT !== '';

  function setForced(on) {
    if (on) {
      process.env.MINDRIAN_FORCE_FTS_ABSENT = '1';
    } else {
      delete process.env.MINDRIAN_FORCE_FTS_ABSENT;
    }
  }
  function restoreEnv() {
    setForced(ENV_FORCED_AT_START);
  }

  const scratch = makeScratchDir('s4');
  try {
    const fx = await buildFixtureRoom236(scratch, { artifactCount: 2 });
    const ghost = await addDistinctiveArtifact(fx, 'ghost-scenario4', 'ZibrothaneGhostArtifact');

    // Build the FTS index with the REAL capability available (forced off).
    setForced(false);
    tri._test.resetFtsProbe();
    await buildFtsIndex(fx.roomDir);
    restoreEnv();

    const hadRow = withOpenRoom(fx.roomDir, (db) => ftsRowExists(db, ghost.nodeId));
    assert.equal(hadRow, true, 'precondition: the ghost artifact must have an eureka_fts row before forcing absence');

    fs.rmSync(ghost.path);

    // Force FTS5 absence for THIS rebuild only, mandatory resetFtsProbe()
    // per the memoization contract (ensureFtsAvailable caches once per process).
    setForced(true);
    tri._test.resetFtsProbe();
    let thrown = null;
    try {
      await runRebuild(fx.roomDir);
    } catch (e) {
      thrown = e;
    } finally {
      restoreEnv();
      tri._test.resetFtsProbe();
    }
    assert.equal(
      thrown, null,
      'a rebuild with FTS5 capability forced absent must not throw, got: '
        + (thrown && thrown.stack)
    );

    // The reconcile must have been SKIPPED: the ghost's now-orphaned row is
    // still present, because ensureFtsAvailable().ok was false for the whole
    // guarded block.
    const stillThere = withOpenRoom(fx.roomDir, (db) => ftsRowExists(db, ghost.nodeId));
    assert.equal(
      stillThere, true,
      'the reconcile must be a no-op when FTS5 capability is forced absent, so the '
        + 'ghost eureka_fts row must still be present (unreconciled) after the rebuild'
    );
  } finally {
    restoreEnv();
    tri._test.resetFtsProbe();
  }
}

// ---------- Scenario 5: atomicity ----------

async function scenario5() {
  const scratch = makeScratchDir('s5');
  const ARTIFACT_COUNT = 4;
  const GHOST_INDEX = 0;
  const SEAM_INDEX = 1; // not index 0: at least one file indexes successfully
  // inside the transaction before the throw arrives (test-236-02 precedent).
  const SENTINEL_NODE_ID = 'fixture:244-03:sentinel-orphan-never-a-real-node';

  const fx = await buildFixtureRoom236(scratch, { artifactCount: ARTIFACT_COUNT });
  const ghostPath = fx.artifactFiles[GHOST_INDEX];
  const ghostNodeId = nodeIdForArtifact(fx.roomDir, ghostPath);

  await buildFtsIndex(fx.roomDir);

  // Seed the sentinel orphan directly, bypassing indexNodes: a row whose
  // node_id predates and outlives this test, never corresponding to any real
  // node. See the file header for why this is the discriminator Mutation
  // Proof 4 needs.
  withOpenRoom(fx.roomDir, (db) => {
    db.prepare('INSERT INTO eureka_fts(node_id, text) VALUES (?, ?)')
      .run(SENTINEL_NODE_ID, 'preexisting orphan row for mutation-4 discrimination');
  });

  const before = withOpenRoom(fx.roomDir, (db) => ({
    counts: countPopulations(db),
    ghostNodeExists: !!db.prepare('SELECT id FROM nodes WHERE id = ?').get(ghostNodeId),
    ghostFtsExists: ftsRowExists(db, ghostNodeId),
    sentinelExists: ftsRowExists(db, SENTINEL_NODE_ID),
  }));
  assert.equal(before.ghostNodeExists, true, 'precondition: the ghost artifact node must exist before the crash run');
  assert.equal(before.ghostFtsExists, true, 'precondition: the ghost artifact must have an eureka_fts row before the crash run');
  assert.equal(before.sentinelExists, true, 'precondition: the sentinel orphan row must exist before the crash run');

  // Delete the ghost artifact file (so clearIndexerOwnedRows + the reconcile
  // both act on it INSIDE this same crashing attempt), and plant the Phase
  // 236-02 crash seam on a DIFFERENT artifact: replace one seeded .md FILE
  // with a DIRECTORY of the same name.
  fs.rmSync(ghostPath);
  const seamPath = fx.artifactFiles[SEAM_INDEX];
  fs.rmSync(seamPath);
  fs.mkdirSync(seamPath);

  // Pre-verify the seam actually bites, before anything is asserted about
  // rebuildGraph (the test-236-02 discipline: a seam that stopped biting
  // must report as an explicit seam failure, never a false green).
  let seamThrows = false;
  let seamCode = null;
  try {
    fs.readFileSync(seamPath, 'utf-8');
  } catch (e) {
    seamThrows = true;
    seamCode = e.code;
  }
  assert.equal(
    seamThrows, true,
    'SEAM FAILURE: fs.readFileSync must throw on the prepared path, otherwise no '
      + 'failure was injected and this scenario proves nothing about atomicity'
  );
  assert.equal(seamCode, 'EISDIR', 'the seam must throw EISDIR (reading a directory), got ' + seamCode);

  let thrown = null;
  const db = roomDb.openRoomDb(fx.roomDir);
  try {
    await lazygraph.rebuildGraph(db, fx.roomDir);
  } catch (e) {
    thrown = e;
  } finally {
    roomDb.closeRoomDb(db);
  }
  assert.ok(
    thrown instanceof Error,
    'rebuildGraph must have THROWN (the injected EISDIR failure); it did not, so '
      + 'this scenario proves nothing about atomicity'
  );
  assert.equal(thrown.code, 'EISDIR', 'the escaping error must be the injected EISDIR, got ' + thrown.code);

  const after = withOpenRoom(fx.roomDir, (dbh) => ({
    counts: countPopulations(dbh),
    ghostNodeExists: !!dbh.prepare('SELECT id FROM nodes WHERE id = ?').get(ghostNodeId),
    ghostFtsExists: ftsRowExists(dbh, ghostNodeId),
    sentinelExists: ftsRowExists(dbh, SENTINEL_NODE_ID),
  }));

  assert.deepEqual(
    after.counts, before.counts,
    'ATOMICITY VIOLATION: node/edge counts must be EXACTLY equal after a failed '
      + 'rebuild.\n    before: ' + JSON.stringify(before.counts)
      + '\n    after:  ' + JSON.stringify(after.counts)
  );
  assert.equal(
    after.ghostNodeExists, true,
    'the ROLLBACK must restore the ghost node row deleted by clearIndexerOwnedRows '
      + 'inside this same failed attempt'
  );
  assert.equal(
    after.ghostFtsExists, true,
    'the ROLLBACK must ALSO restore the ghost eureka_fts row: the reconcile rides '
      + 'the SAME BEGIN as clearIndexerOwnedRows, so a mid-transaction failure must '
      + 'undo both together'
  );
  assert.equal(
    after.sentinelExists, true,
    'ATOMICITY VIOLATION: the pre-existing sentinel orphan row must ALSO survive a '
      + 'failed rebuild. If the reconcile is not inside the same BEGIN as '
      + 'clearIndexerOwnedRows, its DELETE would have already committed BEFORE the '
      + 'transaction opened, and no ROLLBACK could restore it (this is exactly what '
      + 'Mutation Proof 4 flips red)'
  );
}

// ---------- Runner ----------

async function main() {
  console.log('\nPhase 244-03 Task 2: eureka_fts rebuild-reconcile ghost-trigger fence\n');

  try {
    await test('1. the ghost: a deleted artifact stale FTS row is gone after a rebuild, orphan_rows is 0', scenario1);
    await test('2. the anti-vacuity control: a surviving artifact keeps its FTS row and keeps matching', scenario2);
    await test('3. absent-table no-op: a room with no eureka_fts rebuilds like an FTS-free control run', scenario3);
    await test('4. capability-absent no-op: MINDRIAN_FORCE_FTS_ABSENT skips the reconcile without throwing', scenario4);
    await test('5. atomicity: a crash mid-transaction rolls back both node writes and the FTS reconcile', scenario5);
  } finally {
    scratchDirs.forEach(rmrf);
  }

  console.log('\nPhase 244-03 ghost-trigger fence: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

main();
