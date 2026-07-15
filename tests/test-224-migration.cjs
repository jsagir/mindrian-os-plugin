'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 224-01 Task 1 -- D-05 edges.review_status migration proof.
 * ===============================================================
 * Zero-deps node:assert/strict script (repo convention, mirrors
 * test-222-weight-state.cjs). Six behaviors, all against REAL throwaway dbs:
 *
 *   1. openRoomDb(tmpRoom) -> PRAGMA table_info(edges) lists review_status.
 *   2. runMigration(db) a second time returns { applied: false }, no drift.
 *   3. a legacy pre-224 edges schema + one row, migrated, keeps that row with
 *      review_status NULL (backward-safe, never demoted).
 *   4. writeEdge with review_status 'proposed' -> column reads 'proposed';
 *      without it -> NULL; with 'bogus' -> { ok:false, invalid_review_status }.
 *   5. an edge manually UPDATEd to 'confirmed', re-written via writeEdge with
 *      'proposed', still reads 'confirmed' (upsert never touches review_status).
 *   6. runDerivation with a stub deriveFn emitting one CONVERGES candidate lands
 *      an edges row review_status 'proposed' AND a claim node review_status
 *      'proposed'.
 *
 * PASS line + non-zero exit on failure. NO em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { runMigration, SENTINEL_KEY } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-224-edge-review-status.cjs')
);
const { runDerivation } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function edgeCols(db) {
  return db.prepare('PRAGMA table_info(edges)').all().map((c) => c.name);
}

console.log('test-224-migration.cjs: D-05 edges.review_status migration (real openRoomDb)');

const tmpDirs = [];
function freshRoom() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-224-mig-'));
  tmpDirs.push(d);
  return path.join(d, 'room');
}

try {
  // ---- Test 1: fresh room carries the column via the migration chain ----
  const roomDir1 = freshRoom();
  let db1 = openRoomDb(roomDir1);
  try {
    check('(1) fresh room.db edges table has a review_status column (chain ran)', () => {
      assert.ok(edgeCols(db1).includes('review_status'), 'review_status column missing on fresh db');
    });

    // ---- Test 2: second migration run is a no-op ----
    check('(2) re-running the migration returns applied:false and changes nothing', () => {
      const sentinelBefore = db1.prepare('SELECT value FROM identity WHERE key = ?').get(SENTINEL_KEY);
      assert.ok(sentinelBefore && sentinelBefore.value, 'sentinel must exist after the first chain run');
      const res = runMigration(db1);
      assert.strictEqual(res.applied, false, 'second run must be a no-op (applied:false)');
      // column set unchanged
      const cols = edgeCols(db1);
      assert.strictEqual(cols.filter((c) => c === 'review_status').length, 1, 'exactly one review_status column');
    });
  } finally {
    closeRoomDb(db1);
    db1 = null;
  }

  // ---- Test 3: legacy pre-224 edges schema + row, migrated, stays NULL ----
  check('(3) a legacy 4-column edges row survives migration with review_status NULL', () => {
    const legacyDir = freshRoom();
    fs.mkdirSync(path.join(legacyDir, '.mindrian'), { recursive: true });
    const legacyDbPath = path.join(legacyDir, '.mindrian', 'legacy.db');
    const raw = new DatabaseSync(legacyDbPath, { timeout: 5000 });
    try {
      // The pre-224 edges schema copied from lazygraph-ops.cjs (no review_status).
      raw.exec(
        'CREATE TABLE edges (' +
        ' source TEXT NOT NULL,' +
        ' target TEXT NOT NULL,' +
        ' type TEXT NOT NULL,' +
        " properties TEXT DEFAULT '{}'," +
        ' PRIMARY KEY (source, target, type)' +
        ')'
      );
      // The identity table the sentinel writes to.
      raw.exec(
        'CREATE TABLE identity (' +
        ' key TEXT PRIMARY KEY,' +
        ' value TEXT NOT NULL,' +
        ' updated_at TEXT NOT NULL' +
        ')'
      );
      raw.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
        .run('artifact:a', 'artifact:b', 'INFORMS', '{}');

      const res = runMigration(raw);
      assert.strictEqual(res.applied, true, 'migration must apply on a legacy db');
      assert.ok(
        edgeCols(raw).includes('review_status'),
        'review_status column must be added to the legacy edges table'
      );
      const row = raw.prepare('SELECT review_status FROM edges WHERE source = ?').get('artifact:a');
      assert.ok(row, 'the pre-existing edge row must survive the migration');
      assert.strictEqual(row.review_status, null, 'a legacy row must be review_status NULL, never demoted to a proposal');
    } finally {
      raw.close();
    }
  });

  // ---- Test 4: writeEdge review_status contract ----
  const roomDir4 = freshRoom();
  let db4 = openRoomDb(roomDir4);
  try {
    check('(4) writeEdge review_status: proposed lands proposed, absent stays NULL, bogus rejected', () => {
      const okProposed = navigation.writeEdge(db4, {
        source_id: 'n:p1', target_id: 'n:p2', edge_type: 'CONVERGES',
        properties: { relation: 'derived' }, review_status: 'proposed',
      });
      assert.ok(okProposed && okProposed.ok, 'proposed writeEdge must succeed: ' + JSON.stringify(okProposed));
      const rP = db4.prepare('SELECT review_status FROM edges WHERE source = ? AND target = ? AND type = ?')
        .get('n:p1', 'n:p2', 'CONVERGES');
      assert.strictEqual(rP.review_status, 'proposed', 'review_status column must read proposed');

      const okBare = navigation.writeEdge(db4, {
        source_id: 'n:b1', target_id: 'n:b2', edge_type: 'INFORMS',
        properties: { relation: 'derived' },
      });
      assert.ok(okBare && okBare.ok, 'bare writeEdge must succeed');
      const rB = db4.prepare('SELECT review_status FROM edges WHERE source = ? AND target = ? AND type = ?')
        .get('n:b1', 'n:b2', 'INFORMS');
      assert.strictEqual(rB.review_status, null, 'omitting review_status must leave the column NULL');

      const bogus = navigation.writeEdge(db4, {
        source_id: 'n:x1', target_id: 'n:x2', edge_type: 'CONVERGES',
        properties: {}, review_status: 'bogus',
      });
      assert.ok(bogus && bogus.ok === false, 'a bogus review_status must be rejected');
      assert.strictEqual(bogus.reason, 'invalid_review_status', 'reason must be invalid_review_status');
      // The rejected write must not have landed.
      const rX = db4.prepare('SELECT COUNT(*) AS c FROM edges WHERE source = ?').get('n:x1');
      assert.strictEqual(rX.c, 0, 'a rejected review_status write must not partially land');
    });

    // ---- Test 5: confirmed edge is never downgraded by a proposed re-write ----
    check('(5) an edge UPDATEd to confirmed stays confirmed after a proposed re-write (upsert never touches it)', () => {
      navigation.writeEdge(db4, {
        source_id: 'n:c1', target_id: 'n:c2', edge_type: 'CONVERGES',
        properties: { relation: 'derived' }, review_status: 'proposed',
      });
      db4.prepare('UPDATE edges SET review_status = ? WHERE source = ? AND target = ? AND type = ?')
        .run('confirmed', 'n:c1', 'n:c2', 'CONVERGES');
      // Re-derive the same edge as proposed: upsert must NOT downgrade it.
      const re = navigation.writeEdge(db4, {
        source_id: 'n:c1', target_id: 'n:c2', edge_type: 'CONVERGES',
        properties: { relation: 'derived', reason: 'high semantic similarity' }, review_status: 'proposed',
      });
      assert.ok(re && re.ok, 're-write must succeed');
      const rC = db4.prepare('SELECT review_status, properties FROM edges WHERE source = ? AND target = ? AND type = ?')
        .get('n:c1', 'n:c2', 'CONVERGES');
      assert.strictEqual(rC.review_status, 'confirmed', 'a confirmed edge must NEVER be downgraded on re-write');
      // properties DO update on conflict (the existing contract).
      assert.ok(rC.properties.includes('high semantic similarity'), 'properties should update on conflict');
    });
  } finally {
    closeRoomDb(db4);
    db4 = null;
  }

  // ---- Test 6: runDerivation lands proposed edge + proposed claim node ----
  check('(6) runDerivation with a stub CONVERGES deriveFn lands a proposed edge AND a proposed claim node', () => {
    const roomDir6 = freshRoom();
    // Seed the room so openRoomDb has a place to write.
    fs.mkdirSync(roomDir6, { recursive: true });
    fs.writeFileSync(path.join(roomDir6, 'ROOM.md'), '# room 6\n', 'utf8');

    const stubDeriveFn = () => ([
      { source: 'artifact:six-a', target: 'artifact:six-b', edge_type: 'CONVERGES', reason: 'high semantic similarity' },
    ]);
    const result = runDerivation({ roomDir: roomDir6, deriveFn: stubDeriveFn });
    assert.ok(result && Array.isArray(result.edges), 'runDerivation must return an edges array');
    assert.strictEqual(result.edges.length, 1, 'exactly one derived edge expected');

    const db6 = openRoomDb(roomDir6);
    try {
      const edgeRow = db6.prepare(
        'SELECT review_status FROM edges WHERE source = ? AND target = ? AND type = ?'
      ).get('artifact:six-a', 'artifact:six-b', 'CONVERGES');
      assert.ok(edgeRow, 'the derived edge row must exist');
      assert.strictEqual(edgeRow.review_status, 'proposed', 'the derived edge must carry review_status proposed');

      const nodeRow = db6.prepare(
        "SELECT COUNT(*) AS c FROM nodes WHERE review_status = 'proposed'"
      ).get();
      assert.ok(nodeRow.c >= 1, 'at least one proposed claim node must exist');
    } finally {
      closeRoomDb(db6);
    }
  });

  console.log('');
  console.log('PASS test-224-migration.cjs (' + passed + ' checks)');
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}
