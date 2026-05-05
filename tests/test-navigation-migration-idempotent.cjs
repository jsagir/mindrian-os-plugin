'use strict';
// Phase 109-01 test: migration runs idempotently. Sentinel row in identity
// table prevents re-application. Verifies the canonical SQLite 12-step
// recipe respects the IF NOT EXISTS plus INSERT OR IGNORE plus
// sentinel-detect pattern.
//
// Schema notes (verified 2026-05-05 against lib/core/memory-ops.cjs):
//   identity (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)
//   assumptions (id INTEGER PRIMARY KEY AUTOINCREMENT, claim TEXT NOT NULL,
//                section TEXT, validity TEXT NOT NULL DEFAULT 'untested'
//                CHECK(validity IN ('untested','supported','contradicted','stale')),
//                evidence_for TEXT DEFAULT '[]', evidence_against TEXT DEFAULT '[]',
//                created_at TEXT NOT NULL, last_tested TEXT, invalidated_at TEXT)

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const { runMigration } = require(path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-109-nodes-provenance.cjs'));

function setupLegacyRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-mig-idem-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const dbPath = path.join(tmp, '.mindrian', 'room.db');
  const db = new DatabaseSync(dbPath);
  // Legacy 3-column nodes schema (matches lazygraph-ops.cjs initSchema pre-Phase-109).
  // Plus the 3 dependent tables that real openRoomDb composition creates.
  db.exec(
    "CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}'); " +
    "CREATE INDEX idx_nodes_type ON nodes(type); " +
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type)); " +
    "CREATE TABLE identity (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL); " +
    "CREATE TABLE assumptions (id INTEGER PRIMARY KEY AUTOINCREMENT, claim TEXT NOT NULL, section TEXT, validity TEXT NOT NULL DEFAULT 'untested' CHECK(validity IN ('untested','supported','contradicted','stale')), evidence_for TEXT DEFAULT '[]', evidence_against TEXT DEFAULT '[]', created_at TEXT NOT NULL, last_tested TEXT, invalidated_at TEXT);"
  );
  db.prepare("INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)").run(
    'claim:001',
    'claim',
    JSON.stringify({ summary: 'sample claim', confidence: 'high' })
  );
  return { tmp, db, dbPath };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function run() {
  const { tmp, db } = setupLegacyRoom();
  try {
    // First migration run: applied=true; sentinel inserted.
    const r1 = runMigration(db);
    ok(r1.applied === true, 'first run reports applied=true');
    ok(r1.sentinelInserted === true, 'first run inserts sentinel');

    // Verify schema migrated to 12 columns.
    const cols = db.prepare("PRAGMA table_info(nodes)").all().map((c) => c.name).sort();
    const expected = [
      'confidence', 'confirmed_at', 'confirmed_by', 'created_at', 'created_by',
      'id', 'last_seen_at', 'properties', 'review_status', 'source_path',
      'source_section', 'type',
    ];
    deepEqual(cols, expected, 'nodes table has 12 columns post-migration');

    // Sentinel row exists.
    const sentinel = db.prepare("SELECT value FROM identity WHERE key = 'phase_109_migration_v1'").get();
    ok(sentinel && sentinel.value, 'sentinel row exists in identity');

    // Snapshot row count + checksum BEFORE second run.
    const beforeCount = db.prepare("SELECT COUNT(*) AS n FROM nodes").get().n;
    const beforeRow = db.prepare("SELECT * FROM nodes WHERE id = 'claim:001'").get();

    // Second run: applied=false (sentinel detected).
    const r2 = runMigration(db);
    ok(r2.applied === false, 'second run reports applied=false');
    ok(r2.sentinelInserted === false, 'second run does not re-insert sentinel');

    // No data changes.
    const afterCount = db.prepare("SELECT COUNT(*) AS n FROM nodes").get().n;
    const afterRow = db.prepare("SELECT * FROM nodes WHERE id = 'claim:001'").get();
    equal(afterCount, beforeCount, 'second run leaves row count unchanged');
    deepEqual(afterRow, beforeRow, 'second run leaves row state unchanged');

    db.close();
    process.stdout.write('test-navigation-migration-idempotent: PASS\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write('test-navigation-migration-idempotent: FAIL: ' + err.message + '\n' + err.stack + '\n');
    process.exit(1);
  } finally {
    cleanup(tmp);
  }
}

run();
