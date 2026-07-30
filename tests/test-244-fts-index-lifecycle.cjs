'use strict';
/*
 * Phase 244 Plan 02 -- tests/test-244-fts-index-lifecycle.cjs
 *
 * Proves the absent-to-built eureka_fts round trip end to end: a room whose
 * eureka_fts does not exist can be classified (ftsIndexState), a build can be
 * requested (requestFtsBuild), the request can be drained by the expensive
 * half (scripts/fts-index-drain.cjs), and the SAME room then classifies as
 * healthy with real lexical hits it did not have before. Also pins the
 * dedupe, suppression, keep-on-failure, and max-attempts-drop contracts, and
 * the anti-vacuity leg that proves the round trip is not a green test against
 * an already-built index.
 *
 * Every leg here runs OFFLINE and DETERMINISTIC: temp fixture rooms, a
 * deterministic stub encoder (no model download, no network), and
 * MOS_NO_DETACHED_FTS_BUILD=1 set BEFORE any require of the lifecycle/drain
 * modules, so no leg of this file can spawn a detached process. The drain is
 * always invoked IN-PROCESS (drainRoom, imported directly), never spawned.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

// Hermeticity: flip transformers.js allowRemoteModels=false so nothing here
// can reach the network when run standalone.
require('./eureka-offline-preload.cjs');

// MANDATORY: suppress any detached spawn for the WHOLE file, set before the
// lifecycle/drain modules are required, restored in a finally at the end.
const ENV_SUPPRESS_AT_START = process.env.MOS_NO_DETACHED_FTS_BUILD;
process.env.MOS_NO_DETACHED_FTS_BUILD = '1';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const tri = require('../lib/core/eureka/tri-modal-index.cjs');
const lc = require('../lib/core/eureka/fts-index-lifecycle.cjs');
const drain = require('../scripts/fts-index-drain.cjs');
const { buildFixtureRoom } = require('./helpers/fixture-room-219.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

function restoreEnv() {
  if (ENV_SUPPRESS_AT_START === undefined) {
    delete process.env.MOS_NO_DETACHED_FTS_BUILD;
  } else {
    process.env.MOS_NO_DETACHED_FTS_BUILD = ENV_SUPPRESS_AT_START;
  }
}

// ---------- Deterministic stub encoder (offline, no model) ----------
// Copied verbatim in shape from tests/test-219-fts5-degrade.cjs:69-80.
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

// ---------- Plain fixture db (test-219 makeFixtureDb shape, :84-97) ----------
// Plain DatabaseSync, no allowExtension -> cjs cosine fallback. Used for the
// pure ftsIndexState classification legs, where a full room-db schema is
// unnecessary (ftsIndexState only ever touches `nodes` and `eureka_fts`).
function makeFixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fts-lifecycle-244-'));
  const dbPath = path.join(dir, 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  ins.run('n1', 'claim', JSON.stringify({ text: 'the reverse salient in the graph derivation pipeline' }));
  ins.run('n2', 'claim', JSON.stringify({ text: 'opportunity bank agentic reasoning environment' }));
  return { db: db, dir: dir, dbPath: dbPath };
}

function cleanupDb(fixture) {
  try { fixture.db.close(); } catch (_e) { /* ignore */ }
  try { fs.rmSync(fixture.dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
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

async function main() {
  console.log('Phase 244-02 fts-index-lifecycle round trip (offline)');

  // ===== ftsIndexState classification =====

  await test('ftsIndexState: db with nodes and no eureka_fts returns index_absent', function () {
    const f = makeFixtureDb();
    try {
      const s = lc.ftsIndexState(f.db);
      assert.deepStrictEqual(s, {
        present: false,
        reason: 'index_absent',
        node_rows: 2,
        fts_rows: 0,
        orphan_rows: 0,
        healthy: false,
      });
    } finally {
      cleanupDb(f);
    }
  });

  await test('ftsIndexState: after openIndex but before indexNodes returns index_empty', function () {
    const f = makeFixtureDb();
    try {
      tri.openIndex(f.db);
      const s = lc.ftsIndexState(f.db);
      assert.strictEqual(s.present, true);
      assert.strictEqual(s.reason, 'index_empty');
      assert.strictEqual(s.fts_rows, 0);
      assert.strictEqual(s.healthy, false);
    } finally {
      cleanupDb(f);
    }
  });

  await test('ftsIndexState: after a real indexNodes over a populated nodes table returns ok', async function () {
    const f = makeFixtureDb();
    try {
      await tri.indexNodes(f.db, { encodeFn: stubEncode });
      const s = lc.ftsIndexState(f.db);
      assert.strictEqual(s.present, true);
      assert.strictEqual(s.reason, 'ok');
      assert.ok(s.fts_rows > 0, 'fts_rows > 0');
      assert.strictEqual(s.orphan_rows, 0);
      assert.strictEqual(s.healthy, true);
    } finally {
      cleanupDb(f);
    }
  });

  await test('ftsIndexState: an orphan node_id in eureka_fts classifies as index_stale', async function () {
    const f = makeFixtureDb();
    try {
      await tri.indexNodes(f.db, { encodeFn: stubEncode });
      // Construct the stale case DIRECTLY (not by deleting from nodes inside a
      // rebuild -- that is Plan 03's fence and must stay independently
      // provable): insert an eureka_fts row whose node_id has no matching
      // nodes.id.
      f.db.exec("INSERT INTO eureka_fts(node_id, text) VALUES ('ghost-node-244', 'ghost orphan text')");
      const s = lc.ftsIndexState(f.db);
      assert.strictEqual(s.present, true);
      assert.strictEqual(s.reason, 'index_stale');
      assert.ok(s.orphan_rows > 0, 'orphan_rows > 0');
      assert.strictEqual(s.healthy, false);
    } finally {
      cleanupDb(f);
    }
  });

  await test('ftsIndexState: null, {} and a closed handle return unavailable and never throw', function () {
    assert.deepStrictEqual(lc.ftsIndexState(null), {
      present: false, reason: 'unavailable', node_rows: 0, fts_rows: 0, orphan_rows: 0, healthy: false,
    });
    assert.deepStrictEqual(lc.ftsIndexState({}), {
      present: false, reason: 'unavailable', node_rows: 0, fts_rows: 0, orphan_rows: 0, healthy: false,
    });
    const f = makeFixtureDb();
    f.db.close();
    let result;
    assert.doesNotThrow(function () {
      result = lc.ftsIndexState(f.db);
    }, 'ftsIndexState never throws on a closed handle');
    assert.strictEqual(result.reason, 'unavailable');
    assert.strictEqual(result.healthy, false);
    cleanupDir(f.dir);
  });

  // ===== requestFtsBuild =====

  await test('requestFtsBuild: first call queues, second identical call dedupes (no duplicate entry)', function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fts-lifecycle-244-req-'));
    try {
      const r1 = lc.requestFtsBuild(dir, { reason: 'index_absent' });
      assert.strictEqual(r1.ok, true);
      assert.strictEqual(r1.queued, true);
      assert.ok(fs.existsSync(r1.queuePath), 'queue file written');

      const r2 = lc.requestFtsBuild(dir, { reason: 'index_absent' });
      assert.strictEqual(r2.ok, true);
      assert.strictEqual(r2.queued, false, 'second identical call does not queue again');

      const q = lc.readQueue(dir);
      assert.strictEqual(q.entries.length, 1, 'no duplicate entry was appended');
    } finally {
      cleanupDir(dir);
    }
  });

  await test('requestFtsBuild: an unwritable/nonexistent path returns write_failed, never throws', function () {
    let result;
    assert.doesNotThrow(function () {
      result = lc.requestFtsBuild('/nonexistent-root-244-unwritable-path-xyz');
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'write_failed');
  });

  // ===== spawnFtsBuildDrain =====

  await test('spawnFtsBuildDrain: MOS_NO_DETACHED_FTS_BUILD=1 suppresses the spawn', function () {
    // The env is already '1' for this whole file; assert the suppression
    // explicitly rather than relying on it silently.
    assert.strictEqual(process.env.MOS_NO_DETACHED_FTS_BUILD, '1');
    const r = lc.spawnFtsBuildDrain('/tmp/does-not-matter-244', { queued: true });
    assert.deepStrictEqual(r, { spawned: false, reason: 'suppressed' });
  });

  await test('spawnFtsBuildDrain: queued:false is a no-op (already_pending), no spawn attempted', function () {
    const savedEnv = process.env.MOS_NO_DETACHED_FTS_BUILD;
    delete process.env.MOS_NO_DETACHED_FTS_BUILD; // prove the queued:false gate fires FIRST
    try {
      const r = lc.spawnFtsBuildDrain('/tmp/does-not-matter-244', { queued: false });
      assert.deepStrictEqual(r, { spawned: false, reason: 'already_pending' });
    } finally {
      if (savedEnv === undefined) delete process.env.MOS_NO_DETACHED_FTS_BUILD;
      else process.env.MOS_NO_DETACHED_FTS_BUILD = savedEnv;
    }
  });

  // ===== The full round trip, with an anti-vacuity pre-assertion =====

  await test('round trip: absent -> queued -> drained -> ok (anti-vacuity: no hits before the drain)', async function () {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fts-lifecycle-244-roundtrip-'));
    try {
      const fixture = buildFixtureRoom(tmpRoot);
      const roomDir = fixture.roomDir;

      // A memory_artifact hub node carries NO title in its properties (only
      // section/kind/path/hash); its indexed text comes ENTIRELY from the
      // roomDir path-body fallback reading "Section hub artifact for the
      // competitive-analysis section." off disk. This is a genuinely
      // relevant query with zero title-derived shortcut.
      const RELEVANT_QUERY = 'hub artifact competitive analysis';

      // ----- BEFORE the drain: index_absent, and the anti-vacuity leg -----
      let dbBefore = openRoomDb(roomDir);
      const stateBefore = lc.ftsIndexState(dbBefore);
      assert.strictEqual(stateBefore.reason, 'index_absent', 'no eureka_fts table yet');
      assert.ok(stateBefore.node_rows > 0, 'the fixture room has real nodes');
      // Anti-vacuity: WITHOUT this assertion the round trip could pass
      // against an index that was already built.
      const preHits = tri.lexicalSearch(dbBefore, RELEVANT_QUERY, 5);
      assert.deepStrictEqual(preHits, [], 'no hits before the index is built (anti-vacuity)');
      closeRoomDb(dbBefore);

      // ----- Request the build -----
      const req = lc.requestFtsBuild(roomDir, { reason: stateBefore.reason });
      assert.strictEqual(req.ok, true);
      assert.strictEqual(req.queued, true);

      // ----- Drain, IN-PROCESS (deterministic; no detached process) -----
      await drain.drainRoom(path.resolve(roomDir));

      // ----- AFTER the drain: ok, real hits, empty queue -----
      const dbAfter = openRoomDb(roomDir);
      const stateAfter = lc.ftsIndexState(dbAfter);
      assert.strictEqual(stateAfter.reason, 'ok', 'index is healthy after the drain');
      assert.ok(stateAfter.fts_rows > 0, 'fts_rows > 0 after the drain');
      assert.strictEqual(stateAfter.orphan_rows, 0);

      const postHits = tri.lexicalSearch(dbAfter, RELEVANT_QUERY, 5);
      assert.ok(postHits.length >= 1, 'the same query now returns at least one hit');
      closeRoomDb(dbAfter);

      const q = lc.readQueue(roomDir);
      assert.deepStrictEqual(q.entries, [], 'the queue is empty after a successful drain');
    } finally {
      cleanupDir(tmpRoot);
    }
  });

  // ===== Keep-on-failure and max-attempts drop =====

  await test('drain keep-on-failure: a failing build keeps its entry with attempts incremented', async function () {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fts-lifecycle-244-fail-'));
    try {
      // A roomDir with NO room.db: openRoomDbForCaller (the navigation door)
      // returns null for a room whose .mindrian/room.db does not exist, so
      // the drain's per-entry build throws and the entry must be KEPT.
      const roomDir = path.join(tmpRoot, 'room');
      fs.mkdirSync(roomDir, { recursive: true });

      const req = lc.requestFtsBuild(roomDir, { reason: 'index_absent' });
      assert.strictEqual(req.queued, true);

      await drain.drainRoom(path.resolve(roomDir));

      const q = lc.readQueue(roomDir);
      assert.strictEqual(q.entries.length, 1, 'the failing entry is KEPT, not silently cleared');
      assert.strictEqual(q.entries[0].attempts, 1, 'attempts incremented exactly once');
    } finally {
      cleanupDir(tmpRoot);
    }
  });

  await test('drain max-attempts drop: after FTS_BUILD_MAX_ATTEMPTS the entry drops with a failure record', async function () {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fts-lifecycle-244-maxfail-'));
    try {
      const roomDir = path.join(tmpRoot, 'room');
      fs.mkdirSync(roomDir, { recursive: true });

      lc.requestFtsBuild(roomDir, { reason: 'index_absent' });

      for (let i = 0; i < lc.FTS_BUILD_MAX_ATTEMPTS; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await drain.drainRoom(path.resolve(roomDir));
      }

      const q = lc.readQueue(roomDir);
      assert.deepStrictEqual(q.entries, [], 'the entry is dropped after FTS_BUILD_MAX_ATTEMPTS');

      const failuresPath = drain.failuresLogPath(path.resolve(roomDir));
      assert.ok(fs.existsSync(failuresPath), 'a permanent-failure record was written, never a silent drop');
      const log = JSON.parse(fs.readFileSync(failuresPath, 'utf8'));
      assert.ok(Array.isArray(log.failures) && log.failures.length >= 1);
      assert.strictEqual(log.failures[log.failures.length - 1].attempts, lc.FTS_BUILD_MAX_ATTEMPTS);

      // One more drain pass over the now-empty queue must be a no-op
      // (idempotent): no further mutation, no throw.
      await drain.drainRoom(path.resolve(roomDir));
      const q2 = lc.readQueue(roomDir);
      assert.deepStrictEqual(q2.entries, []);
    } finally {
      cleanupDir(tmpRoot);
    }
  });

  // ===== No orphan process survives this file =====

  await test('no orphan fts-index-drain process survives this file', function () {
    // Anchored on the interpreter, not the bare script name: a bare
    // pgrep -f fts-index-drain matches the invoking shell's own command line
    // and reports a phantom PID (observed in Phase 236-02).
    try {
      const out = execFileSync('pgrep', ['-af', '^[^ ]*node .*fts-index-drain'], { encoding: 'utf8' });
      assert.fail('unexpected orphan fts-index-drain process(es):\n' + out);
    } catch (err) {
      // pgrep exits 1 when nothing matches -- that IS the passing case.
      if (err.status !== 1) throw err;
    }
  });

  restoreEnv();

  console.log('\nPhase 244-02 fts-index-lifecycle: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

main().catch(function (err) {
  restoreEnv();
  console.error('FATAL: ' + (err && err.stack));
  process.exit(1);
});
