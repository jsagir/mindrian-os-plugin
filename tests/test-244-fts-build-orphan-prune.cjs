#!/usr/bin/env node
'use strict';

/*
 * Phase 244 -- tests/test-244-fts-build-orphan-prune.cjs
 *
 * THE DEFECT THIS PINS (RCA: .planning/debug/eureka-fts-orphan-rows-block-release-gate.md).
 *
 * `ftsIndexState` DEFINES index_stale as orphan_rows >= FTS_STALE_ORPHAN_FLOOR,
 * where an orphan is an eureka_fts row whose node_id is no longer in `nodes`.
 * `lib/core/doctor/eureka-fts-health-module.cjs` ships with fix_supported:false
 * and its header points every repair at Plan 02's lazy build-on-first-miss
 * (requestFtsBuild -> scripts/fts-index-drain.cjs -> tri-modal-index.indexNodes).
 *
 * But `indexNodes` reconciled eureka_fts ONLY per live node: its single lexical
 * DELETE was `DELETE FROM eureka_fts WHERE node_id = ?`, run once per entry of
 * `items`, and `items` is built from `SELECT id ... FROM nodes`. Every node_id
 * it deleted was therefore by construction a node_id that STILL EXISTS. A row
 * whose node was deleted was never named by any DELETE, so it was immortal, and
 * the sanctioned repair path structurally could not clear the one condition the
 * doctor gate flags. Observed live on the real room
 * `motj-ecosystem/sub-rooms/jonathan-contractor-motj`: a drain that provably did
 * real work (245 fresh vectors, an eureka_meta model row, an emptied queue, no
 * failure log) left orphan_rows at exactly 451, byte-identical before and after.
 *
 * The orphan reconcile already existed, but only on the FULL GRAPH REBUILD path
 * (lib/core/lazygraph-ops.cjs::rebuildGraph, pinned by
 * tests/test-244-fts-rebuild-reconcile.cjs). This file pins the BUILD path, the
 * other half that Plan 02's drain actually calls. The two files are siblings:
 * the rebuild-reconcile file proves a rebuild reconciles, this one proves an
 * index build reconciles.
 *
 * FIVE SCENARIOS:
 *   1. The prune: indexNodes clears BOTH a naturally orphaned row (its node was
 *      deleted from `nodes`) and a pre-seeded sentinel orphan that never
 *      corresponded to any node, and reports how many rows it pruned.
 *   2. The anti-vacuity control: a SURVIVING node keeps its row and keeps
 *      MATCHing. Without this an unconditional `DELETE FROM eureka_fts` would
 *      pass scenario 1 while destroying the whole lexical index.
 *   3. Idempotence: a second and third indexNodes pass leave orphan_rows at 0
 *      and the live row count stable (the prune never duplicates or re-deletes).
 *   4. Capability-absent no-op: with MINDRIAN_FORCE_FTS_ABSENT forced and the
 *      memoized probe reset, indexNodes must not throw and must skip the whole
 *      lexical leg, so an orphan SURVIVES (proving the prune is inside the
 *      capability gate, not outside it).
 *   5. The reported bug, end to end through the SANCTIONED repair path: a real
 *      fixture room classified index_stale is repaired to ok by
 *      requestFtsBuild + drainRoom, with the queue emptied and no permanent
 *      failure record. This is the leg that was red in production.
 *
 * Every leg runs OFFLINE and DETERMINISTIC: temp fixture rooms, a deterministic
 * stub encoder, and MOS_NO_DETACHED_FTS_BUILD=1 set BEFORE the lifecycle/drain
 * modules are required, so nothing here can spawn a detached process. The drain
 * is invoked IN-PROCESS (drainRoom, imported directly), never spawned.
 *
 * tests/ is on scripts/check-substrate.cjs's ALLOWED_DIRECT_IMPORT list, so the
 * raw eureka_fts seeding and room-db.cjs require here are sanctioned (the same
 * reach tests/test-244-fts-rebuild-reconcile.cjs already makes).
 *
 * CJS only, zero new deps, zero network reach. No em-dashes (CLAUDE.md HARD RULE).
 */

// Hermeticity: flip transformers.js allowRemoteModels=false so nothing here can
// reach the network when run standalone.
require('./eureka-offline-preload.cjs');

// MANDATORY: suppress any detached spawn for the WHOLE file, set before the
// lifecycle/drain modules are required, restored in a finally at the end.
const ENV_SUPPRESS_AT_START = process.env.MOS_NO_DETACHED_FTS_BUILD;
process.env.MOS_NO_DETACHED_FTS_BUILD = '1';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO = path.resolve(__dirname, '..');
const tri = require(path.join(REPO, 'lib', 'core', 'eureka', 'tri-modal-index.cjs'));
const lc = require(path.join(REPO, 'lib', 'core', 'eureka', 'fts-index-lifecycle.cjs'));
const drain = require(path.join(REPO, 'scripts', 'fts-index-drain.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { buildFixtureRoom } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-219.cjs'));

function restoreSuppressEnv() {
  if (ENV_SUPPRESS_AT_START === undefined) {
    delete process.env.MOS_NO_DETACHED_FTS_BUILD;
  } else {
    process.env.MOS_NO_DETACHED_FTS_BUILD = ENV_SUPPRESS_AT_START;
  }
}

// ---------- Deterministic stub encoder (offline, no model) ----------
// Same shape as tests/test-244-fts-index-lifecycle.cjs:55-66.
function stubEncode(texts) {
  return texts.map(function (t) {
    const v = new Array(16).fill(0);
    const s = String(t);
    for (let i = 0; i < s.length; i += 1) {
      v[s.charCodeAt(i) % 16] += 1;
    }
    let norm = Math.sqrt(v.reduce(function (a, x) { return a + x * x; }, 0));
    if (norm === 0) norm = 1;
    return v.map(function (x) { return x / norm; });
  });
}

// ---------- Tiny test runner (test-219 PASS/FAIL/FAILURES shape) ----------

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-244-prune-' + suffix + '-'));
  scratchDirs.push(dir);
  return dir;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// A plain DatabaseSync carrying only `nodes` (the makeFixtureDb shape from
// tests/test-244-fts-index-lifecycle.cjs:72-81). ftsIndexState and the lexical
// leg of indexNodes touch only `nodes` and `eureka_fts`, so a full room-db
// schema is unnecessary for the unit legs.
function makeFixtureDb(suffix) {
  const dir = makeScratchDir(suffix);
  const db = new DatabaseSync(path.join(dir, 'room.db'));
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  ins.run('n-live-1', 'claim', JSON.stringify({ text: 'kwarnothil reverse salient in the derivation pipeline' }));
  ins.run('n-live-2', 'claim', JSON.stringify({ text: 'opportunity bank agentic reasoning environment' }));
  ins.run('n-doomed', 'claim', JSON.stringify({ text: 'zelbrantic doomed node scheduled for deletion' }));
  return { db: db, dir: dir };
}

function closeQuietly(db) {
  try { db.close(); } catch (_e) { /* ignore */ }
}

function orphanRowCount(db) {
  return db.prepare(
    'SELECT count(*) AS c FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)'
  ).get().c;
}

function ftsRowCount(db) {
  return db.prepare('SELECT count(*) AS c FROM eureka_fts').get().c;
}

function ftsRowExists(db, nodeId) {
  return !!db.prepare('SELECT node_id FROM eureka_fts WHERE node_id = ?').get(nodeId);
}

// Seed a row directly into eureka_fts, bypassing indexNodes: an orphan that
// never corresponded to any real node, modelling the accumulated backlog the
// live room carried (its 451 orphans predated every drain run).
function seedSentinelOrphan(db, nodeId) {
  db.prepare('INSERT INTO eureka_fts(node_id, text) VALUES (?, ?)')
    .run(nodeId, 'preexisting orphan row that never had a node');
}

// ---------- Scenario 1: the prune ----------

async function scenario1() {
  const f = makeFixtureDb('s1');
  const SENTINEL = 'fixture:244-prune:sentinel-orphan-never-a-real-node';
  try {
    tri.openIndex(f.db);
    const first = await tri.indexNodes(f.db, { encodeFn: stubEncode });
    assert.equal(first.fts_backend, 'fts5', 'precondition: FTS5 must be live for this run');
    assert.equal(first.indexed, 3, 'precondition: all three seeded nodes carry indexable text');
    assert.equal(ftsRowCount(f.db), 3, 'precondition: three live rows after the first build');
    assert.equal(orphanRowCount(f.db), 0, 'precondition: a fresh build has no orphans');

    // Manufacture BOTH orphan shapes.
    // (a) The natural orphan: a node that was indexed and is then deleted.
    f.db.prepare('DELETE FROM nodes WHERE id = ?').run('n-doomed');
    // (b) The sentinel orphan: a row that never had a node at all.
    seedSentinelOrphan(f.db, SENTINEL);

    const stale = lc.ftsIndexState(f.db);
    assert.equal(stale.reason, 'index_stale', 'precondition: the index must now classify stale');
    assert.equal(stale.orphan_rows, 2, 'precondition: exactly two orphans, got ' + stale.orphan_rows);

    // THE DEFECT: this second build is exactly what the sanctioned repair path
    // runs. Before the fix it left both orphans untouched.
    const second = await tri.indexNodes(f.db, { encodeFn: stubEncode });

    assert.equal(
      orphanRowCount(f.db), 0,
      'indexNodes must prune EVERY eureka_fts row whose node_id is no longer in nodes; '
        + 'orphan_rows is still ' + orphanRowCount(f.db)
    );
    assert.equal(
      ftsRowExists(f.db, 'n-doomed'), false,
      'the deleted node n-doomed must not keep an eureka_fts row (the resurrection hazard)'
    );
    assert.equal(
      ftsRowExists(f.db, SENTINEL), false,
      'a pre-existing orphan that never had a node must ALSO be pruned; this is the exact '
        + 'shape of the 451 accumulated rows on the live room'
    );

    const after = lc.ftsIndexState(f.db);
    assert.equal(after.reason, 'ok', 'the index must classify ok after the rebuild, got ' + after.reason);
    assert.equal(after.healthy, true, 'the index must be healthy after the rebuild');

    // Honest provenance: the prune reports what it removed rather than being a
    // silent write (the false-success class this RCA belongs to).
    assert.equal(
      second.fts_pruned, 2,
      'indexNodes must REPORT the orphan rows it pruned, got ' + JSON.stringify(second)
    );
  } finally {
    closeQuietly(f.db);
  }
}

// ---------- Scenario 2: the anti-vacuity control ----------

async function scenario2() {
  const f = makeFixtureDb('s2');
  try {
    tri.openIndex(f.db);
    await tri.indexNodes(f.db, { encodeFn: stubEncode });

    const beforeHits = tri.lexicalSearch(f.db, 'kwarnothil', 5);
    assert.ok(
      beforeHits.some(function (h) { return h.node_id === 'n-live-1'; }),
      'precondition: the survivor must be lexically findable before the reindex, got '
        + JSON.stringify(beforeHits)
    );

    // Orphan only the doomed node. The two live nodes are untouched.
    f.db.prepare('DELETE FROM nodes WHERE id = ?').run('n-doomed');
    await tri.indexNodes(f.db, { encodeFn: stubEncode });

    assert.equal(
      ftsRowExists(f.db, 'n-live-1'), true,
      'a SURVIVING node must keep its eureka_fts row (an unconditional DELETE FROM eureka_fts '
        + 'would pass scenario 1 while destroying the whole index)'
    );
    assert.equal(ftsRowExists(f.db, 'n-live-2'), true, 'the second surviving node must keep its row too');
    assert.equal(ftsRowCount(f.db), 2, 'exactly the two surviving nodes remain indexed');

    const afterHits = tri.lexicalSearch(f.db, 'kwarnothil', 5);
    assert.ok(
      afterHits.some(function (h) { return h.node_id === 'n-live-1'; }),
      'a SURVIVING node must keep MATCHing after the reindex, got ' + JSON.stringify(afterHits)
    );
  } finally {
    closeQuietly(f.db);
  }
}

// ---------- Scenario 3: idempotence ----------

async function scenario3() {
  const f = makeFixtureDb('s3');
  try {
    tri.openIndex(f.db);
    await tri.indexNodes(f.db, { encodeFn: stubEncode });
    f.db.prepare('DELETE FROM nodes WHERE id = ?').run('n-doomed');
    seedSentinelOrphan(f.db, 'fixture:244-prune:s3-sentinel');

    const r1 = await tri.indexNodes(f.db, { encodeFn: stubEncode });
    const rows1 = ftsRowCount(f.db);
    assert.equal(orphanRowCount(f.db), 0, 'pass 1 clears the orphans');
    assert.equal(r1.fts_pruned, 2, 'pass 1 reports two pruned rows, got ' + r1.fts_pruned);

    const r2 = await tri.indexNodes(f.db, { encodeFn: stubEncode });
    assert.equal(orphanRowCount(f.db), 0, 'pass 2 keeps orphan_rows at 0');
    assert.equal(ftsRowCount(f.db), rows1, 'pass 2 must not duplicate rows, got ' + ftsRowCount(f.db));
    assert.equal(r2.fts_pruned, 0, 'pass 2 has nothing left to prune, got ' + r2.fts_pruned);

    const r3 = await tri.indexNodes(f.db, { encodeFn: stubEncode });
    assert.equal(orphanRowCount(f.db), 0, 'pass 3 keeps orphan_rows at 0');
    assert.equal(ftsRowCount(f.db), rows1, 'pass 3 must not duplicate rows either');
    assert.equal(r3.fts_pruned, 0, 'pass 3 has nothing left to prune');
    assert.equal(lc.ftsIndexState(f.db).reason, 'ok', 'the index stays ok across repeated passes');
  } finally {
    closeQuietly(f.db);
  }
}

// ---------- Scenario 4: capability-absent no-op ----------

async function scenario4() {
  const ENV_FORCED_AT_START = typeof process.env.MINDRIAN_FORCE_FTS_ABSENT === 'string'
    && process.env.MINDRIAN_FORCE_FTS_ABSENT !== '';

  function setForced(on) {
    if (on) process.env.MINDRIAN_FORCE_FTS_ABSENT = '1';
    else delete process.env.MINDRIAN_FORCE_FTS_ABSENT;
  }

  const f = makeFixtureDb('s4');
  try {
    // Build with the REAL capability available (forced off), mandatory
    // resetFtsProbe per the memoization contract.
    setForced(false);
    tri._test.resetFtsProbe();
    tri.openIndex(f.db);
    await tri.indexNodes(f.db, { encodeFn: stubEncode });
    assert.equal(ftsRowExists(f.db, 'n-doomed'), true, 'precondition: the doomed node has a row');

    f.db.prepare('DELETE FROM nodes WHERE id = ?').run('n-doomed');
    assert.equal(orphanRowCount(f.db), 1, 'precondition: exactly one orphan before the forced run');

    // Force FTS5 absence for THIS build only.
    setForced(true);
    tri._test.resetFtsProbe();
    let thrown = null;
    let result = null;
    try {
      result = await tri.indexNodes(f.db, { encodeFn: stubEncode });
    } catch (e) {
      thrown = e;
    } finally {
      setForced(ENV_FORCED_AT_START);
      tri._test.resetFtsProbe();
    }

    assert.equal(
      thrown, null,
      'indexNodes with FTS5 capability forced absent must not throw, got: ' + (thrown && thrown.stack)
    );
    assert.equal(
      result.fts_backend, 'absent (bi-modal degrade)',
      'the run must report the honest bi-modal degrade provenance, got ' + result.fts_backend
    );
    assert.equal(
      orphanRowCount(f.db), 1,
      'the prune must sit INSIDE the FTS5 capability gate: with the capability absent the whole '
        + 'lexical leg is skipped, so the orphan survives unreconciled'
    );
    assert.equal(
      result.fts_pruned, 0,
      'a skipped lexical leg must report zero pruned rows, got ' + result.fts_pruned
    );
  } finally {
    setForced(ENV_FORCED_AT_START);
    tri._test.resetFtsProbe();
    closeQuietly(f.db);
  }
}

// ---------- Scenario 5: the reported bug, end to end ----------

async function scenario5() {
  const tmpRoot = makeScratchDir('s5');
  const SENTINEL = 'fixture:244-prune:s5-accumulated-orphan';
  const fixture = buildFixtureRoom(tmpRoot);
  const roomDir = fixture.roomDir;

  // ----- Build the index once, then manufacture the stale condition -----
  let db = openRoomDb(roomDir);
  try {
    tri.openIndex(db);
    await tri.indexNodes(db, { encodeFn: stubEncode, roomDir: roomDir });
    assert.ok(ftsRowCount(db) > 0, 'precondition: the fixture room indexed real rows');
    seedSentinelOrphan(db, SENTINEL);
  } finally {
    closeRoomDb(db);
  }

  db = openRoomDb(roomDir);
  let stateBefore;
  try {
    stateBefore = lc.ftsIndexState(db);
  } finally {
    closeRoomDb(db);
  }
  assert.equal(
    stateBefore.reason, 'index_stale',
    'precondition: the room must classify index_stale, exactly as the doctor gate reported for '
      + 'jonathan-contractor-motj, got ' + stateBefore.reason
  );
  assert.ok(stateBefore.orphan_rows > 0, 'precondition: orphan_rows > 0');

  // ----- Drive the SANCTIONED repair path, in process -----
  const req = lc.requestFtsBuild(roomDir, { reason: stateBefore.reason });
  assert.equal(req.ok, true, 'requestFtsBuild must succeed');
  assert.equal(req.queued, true, 'requestFtsBuild must queue the build');

  await drain.drainRoom(roomDir);

  // ----- The drain must have SUCCEEDED, not merely not-thrown -----
  const queueAfter = lc.readQueue(roomDir);
  assert.equal(
    queueAfter.entries.length, 0,
    'the drain clears a queue entry ONLY on success, so an emptied queue is the success proof'
  );
  assert.equal(
    fs.existsSync(drain.failuresLogPath(roomDir)), false,
    'no permanent-failure record must exist: ' + drain.failuresLogPath(roomDir)
  );

  // ----- And the repair must have actually repaired -----
  db = openRoomDb(roomDir);
  let stateAfter;
  let sentinelSurvived;
  try {
    stateAfter = lc.ftsIndexState(db);
    sentinelSurvived = ftsRowExists(db, SENTINEL);
  } finally {
    closeRoomDb(db);
  }

  assert.equal(
    sentinelSurvived, false,
    'the accumulated orphan row must be gone after the sanctioned repair path runs'
  );
  assert.equal(
    stateAfter.orphan_rows, 0,
    'THE REPORTED BUG: requestFtsBuild + drain must drive orphan_rows to 0. It reported success '
      + 'and left orphan_rows at ' + stateAfter.orphan_rows
      + ' (live symptom: 451 before and after, byte identical)'
  );
  assert.equal(
    stateAfter.reason, 'ok',
    'the room must no longer classify index_stale, so doctor --acceptance --pre-tag stops '
      + 'hard-aborting on eureka-fts-index-visible, got ' + stateAfter.reason
  );
  assert.ok(
    stateAfter.fts_rows > 0,
    'anti-vacuity: the repair must not have emptied the index to reach zero orphans, fts_rows='
      + stateAfter.fts_rows
  );
}

// ---------- Runner ----------

async function main() {
  console.log('\nPhase 244: eureka_fts BUILD-path orphan prune (RCA eureka-fts-orphan-rows-block-release-gate)\n');

  try {
    await test('1. the prune: indexNodes clears a deleted node row AND a pre-existing sentinel orphan', scenario1);
    await test('2. anti-vacuity: a surviving node keeps its row and keeps matching', scenario2);
    await test('3. idempotence: repeated passes hold orphan_rows at 0 with no duplicate rows', scenario3);
    await test('4. capability-absent no-op: MINDRIAN_FORCE_FTS_ABSENT skips the prune without throwing', scenario4);
    await test('5. reported bug: requestFtsBuild + drain repairs index_stale to ok on a real room', scenario5);
  } finally {
    scratchDirs.forEach(rmrf);
    restoreSuppressEnv();
  }

  console.log('\nPhase 244 fts build-path orphan prune: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

main();
