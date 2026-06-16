'use strict';
// Phase 160-04 Task 1 test: bitemporal node migration (R7).
//
// Mirrors the Phase 109 migration test idiom (tests/test-navigation-migration-*.cjs):
//   - build a legacy room.db with the Phase-109 tightened nodes schema,
//   - run the bitemporal migration,
//   - assert: additive columns present, idempotent run-twice identical result,
//     backfill valid_from=created_at others NULL, and last_modified_at
//     write-only discipline (read does not touch it; write does).
//
// Canon Part 7: the migration is the phase-109 analog (additive / idempotent /
// backfilled). Canon Part 8: writes only to room.db, zero Brain queries.
// House rule: hyphens only, no em-dashes.

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const {
  runMigration,
  SENTINEL_KEY,
} = require(path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-160-nodes-bitemporal.cjs'));
const { promoteNodeStatus } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'transitions.cjs'));

// Build a room.db with the post-Phase-109 tightened nodes schema (the production
// shape the bitemporal migration runs against). Insert one confirmed claim row
// with a fixed created_at so backfill assertions are deterministic.
function setupRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-160-bitemporal-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const dbPath = path.join(tmp, '.mindrian', 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec(
    "CREATE TABLE nodes (" +
    "  id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, " +
    "  source_section TEXT, confirmed_by TEXT, confirmed_at INTEGER); " +
    "CREATE INDEX idx_nodes_type ON nodes(type); " +
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type)); " +
    "CREATE TABLE identity (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);"
  );
  const createdAt = 1700000000000;
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'claim', '{}', 'unknown:claim:001', 'system', 'confirmed', ?, ?)"
  ).run('claim:001', createdAt, createdAt);
  return { tmp, db, createdAt };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function bitemporalColumns(db) {
  return new Set(db.prepare('PRAGMA table_info(nodes)').all().map((c) => c.name));
}

test('R7: adds the four bitemporal columns additively', () => {
  const { tmp, db } = setupRoom();
  try {
    const r = runMigration(db);
    equal(r.applied, true, 'first run applies');
    const cols = bitemporalColumns(db);
    for (const c of ['valid_from', 'valid_to', 'invalidated_at', 'last_modified_at']) {
      ok(cols.has(c), 'column present: ' + c);
    }
  } finally { cleanup(tmp); }
});

test('R7: backfill valid_from=created_at, others NULL', () => {
  const { tmp, db, createdAt } = setupRoom();
  try {
    runMigration(db);
    const row = db.prepare(
      'SELECT valid_from, valid_to, invalidated_at, last_modified_at FROM nodes WHERE id = ?'
    ).get('claim:001');
    equal(row.valid_from, createdAt, 'valid_from backfilled to created_at');
    equal(row.valid_to, null, 'valid_to stays NULL');
    equal(row.invalidated_at, null, 'invalidated_at stays NULL');
    equal(row.last_modified_at, null, 'last_modified_at stays NULL on backfill');
  } finally { cleanup(tmp); }
});

test('R7: idempotent - run twice yields identical schema + data, no error', () => {
  const { tmp, db } = setupRoom();
  try {
    const r1 = runMigration(db);
    const colsAfter1 = [...bitemporalColumns(db)].sort();
    const dataAfter1 = db.prepare(
      'SELECT id, valid_from, valid_to, invalidated_at, last_modified_at FROM nodes ORDER BY id'
    ).all();

    const r2 = runMigration(db);
    const colsAfter2 = [...bitemporalColumns(db)].sort();
    const dataAfter2 = db.prepare(
      'SELECT id, valid_from, valid_to, invalidated_at, last_modified_at FROM nodes ORDER BY id'
    ).all();

    equal(r1.applied, true, 'first run applied');
    equal(r2.applied, false, 'second run short-circuits via sentinel');
    equal(JSON.stringify(colsAfter1), JSON.stringify(colsAfter2), 'schema identical across runs');
    equal(JSON.stringify(dataAfter1), JSON.stringify(dataAfter2), 'data identical across runs');

    // Sentinel row present.
    const sentinel = db.prepare('SELECT value FROM identity WHERE key = ?').get(SENTINEL_KEY);
    ok(sentinel && sentinel.value, 'sentinel row present after migration');
  } finally { cleanup(tmp); }
});

test('R7: reading a node does NOT touch last_modified_at; writing does', () => {
  const { tmp, db } = setupRoom();
  try {
    runMigration(db);
    // Baseline: last_modified_at NULL.
    const before = db.prepare('SELECT last_modified_at FROM nodes WHERE id = ?').get('claim:001');
    equal(before.last_modified_at, null, 'starts NULL');

    // A READ: SELECT through the navigation read shape. Must NOT bump last_modified_at.
    db.prepare('SELECT id, type, review_status FROM nodes WHERE id = ?').get('claim:001');
    const afterRead = db.prepare('SELECT last_modified_at FROM nodes WHERE id = ?').get('claim:001');
    equal(afterRead.last_modified_at, null, 'read leaves last_modified_at NULL');

    // A WRITE: promoteNodeStatus confirmed->validated is a node write path; it MUST
    // set last_modified_at to the reference now via the options.now seam.
    const fixedNow = 1750000000000;
    const res = promoteNodeStatus(db, 'claim:001', 'confirmed', 'validated', 'navigator', null, { now: () => fixedNow });
    equal(res.ok, true, 'transition ok');
    const afterWrite = db.prepare('SELECT last_modified_at FROM nodes WHERE id = ?').get('claim:001');
    equal(afterWrite.last_modified_at, fixedNow, 'write sets last_modified_at to reference now');
  } finally { cleanup(tmp); }
});
