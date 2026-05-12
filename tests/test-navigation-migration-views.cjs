'use strict';
// Phase 109-01 regression test (bug: phase-109-migration-view-drop-collision).
//
// The nodes-provenance migration rebuilds the `nodes` table via the
// rename-out-of-existence pattern (DROP TABLE nodes; ALTER TABLE nodes_new
// RENAME TO nodes). SQLite re-validates the whole schema during that rename.
// If a VIEW (or TRIGGER) that SELECTs FROM nodes still exists, it is dangling
// mid-rebuild and the rename throws:
//   error in view <name>: no such table: main.nodes
//
// In production, lib/core/lazygraph-ops.cjs initSchema() runs BEFORE this
// migration inside openRoomDb() and creates the `rs_discoveries` view (Phase 89
// RS-discoveries bridge: CREATE VIEW IF NOT EXISTS rs_discoveries AS SELECT ...
// FROM nodes WHERE type = 'RSDiscovery'). So every real room that has been
// opened post-Phase-89 hits this crash.
//
// The fix: tightenSchemaWithCheckConstraints() enumerates every view/trigger
// that references `nodes` from sqlite_master, captures its sql, drops it before
// the rebuild, and recreates it after -- the canonical SQLite 12-step recipe.
//
// This test seeds a room.db WITH a rs_discoveries-style view AND a second view
// AND a trigger referencing nodes, runs the migration, and asserts:
//   (a) the migration does NOT throw,
//   (b) the views/trigger still exist and still work after,
//   (c) re-running the migration is idempotent (no throw, no schema drift).

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const { runMigration } = require(path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-109-nodes-provenance.cjs'));

// The exact rs_discoveries view body from lib/core/lazygraph-ops.cjs initSchema.
const RS_DISCOVERIES_VIEW_SQL =
  "CREATE VIEW IF NOT EXISTS rs_discoveries AS " +
  "SELECT " +
  "  id, " +
  "  json_extract(properties, '$.thesis')             AS thesis, " +
  "  json_extract(properties, '$.classification')     AS rs_type, " +
  "  json_extract(properties, '$.breakthrough_score') AS breakthrough_score, " +
  "  json_extract(properties, '$.room_id')            AS room_slug, " +
  "  json_extract(properties, '$.created_at')         AS created_at, " +
  "  json_extract(properties, '$.bridge_concept')     AS bridge_concept, " +
  "  json_extract(properties, '$.dominant_dimension') AS dominant_dimension, " +
  "  json_extract(properties, '$.diff')               AS diff, " +
  "  json_extract(properties, '$.lsa')                AS lsa, " +
  "  json_extract(properties, '$.bert')               AS bert, " +
  "  json_extract(properties, '$.domain')             AS domain, " +
  "  properties                                       AS properties_json " +
  "FROM nodes " +
  "WHERE type = 'RSDiscovery';";

// A second view (no IF NOT EXISTS) to prove the recreate path handles bare
// CREATE VIEW statements too.
const NODE_TYPE_COUNTS_VIEW_SQL =
  "CREATE VIEW node_type_counts AS SELECT type, COUNT(*) AS n FROM nodes GROUP BY type;";

// A trigger that references nodes (AFTER INSERT). Recreated verbatim.
const NODES_AUDIT_TRIGGER_SQL =
  "CREATE TRIGGER nodes_audit_ins AFTER INSERT ON nodes BEGIN " +
  "  INSERT INTO nodes_audit (node_id) VALUES (NEW.id); " +
  "END;";

function setupRoomWithViews() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-mig-views-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const dbPath = path.join(tmp, '.mindrian', 'room.db');
  const db = new DatabaseSync(dbPath);
  // Legacy 3-column nodes schema + the dependent tables real openRoomDb makes.
  db.exec(
    "CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}'); " +
    "CREATE INDEX idx_nodes_type ON nodes(type); " +
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type)); " +
    "CREATE TABLE identity (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL); " +
    "CREATE TABLE assumptions (id INTEGER PRIMARY KEY AUTOINCREMENT, claim TEXT NOT NULL, section TEXT, validity TEXT NOT NULL DEFAULT 'untested' CHECK(validity IN ('untested','supported','contradicted','stale')), evidence_for TEXT DEFAULT '[]', evidence_against TEXT DEFAULT '[]', created_at TEXT NOT NULL, last_tested TEXT, invalidated_at TEXT); " +
    "CREATE TABLE nodes_audit (node_id TEXT NOT NULL);"
  );
  // The dependent schema objects -- the thing that used to crash the migration.
  db.exec(RS_DISCOVERIES_VIEW_SQL);
  db.exec(NODE_TYPE_COUNTS_VIEW_SQL);
  db.exec(NODES_AUDIT_TRIGGER_SQL);
  // Seed an RSDiscovery node so the view returns a row pre- and post-migration.
  db.prepare("INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)").run(
    'rsdiscovery:abc',
    'RSDiscovery',
    JSON.stringify({
      thesis: 'cross-domain bridge thesis',
      classification: 'breakthrough',
      breakthrough_score: 0.82,
      room_id: 'demo-room',
      created_at: '2026-05-01T00:00:00Z',
      bridge_concept: 'thermal-budget-as-attention',
      dominant_dimension: 'lsa',
      diff: 0.41,
      lsa: 0.7,
      bert: 0.6,
      domain: 'neuromorphic',
    })
  );
  // And a plain claim node so node_type_counts has >1 row.
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

function schemaObjects(db) {
  return db.prepare(
    "SELECT type, name FROM sqlite_master WHERE type IN ('view','trigger') ORDER BY type, name"
  ).all();
}

function run() {
  const { tmp, db } = setupRoomWithViews();
  let passed = 0;
  const fail = (msg, err) => {
    process.stderr.write('test-navigation-migration-views: FAIL: ' + msg +
      (err ? ': ' + err.message + '\n' + err.stack : '') + '\n');
    process.exit(1);
  };
  try {
    // (a) migration does not throw, even though rs_discoveries (+2 more) exist.
    let r1;
    try {
      r1 = runMigration(db);
    } catch (err) {
      return fail('migration threw on a room.db with views referencing nodes', err);
    }
    ok(r1.applied === true, 'migration applied on first run');
    passed++;

    // Schema migrated to 12 columns (the rebuild actually happened).
    const cols = db.prepare("PRAGMA table_info(nodes)").all().map((c) => c.name).sort();
    const expectedCols = [
      'confidence', 'confirmed_at', 'confirmed_by', 'created_at', 'created_by',
      'id', 'last_seen_at', 'properties', 'review_status', 'source_path',
      'source_section', 'type',
    ];
    deepEqual(cols, expectedCols, 'nodes rebuilt with 12-column provenance schema');
    passed++;

    // (b) all three dependent schema objects still exist after the migration.
    const objs = schemaObjects(db);
    const names = objs.map((o) => o.name);
    ok(names.includes('rs_discoveries'), 'rs_discoveries view survived the rebuild');
    ok(names.includes('node_type_counts'), 'node_type_counts view survived the rebuild');
    ok(names.includes('nodes_audit_ins'), 'nodes_audit_ins trigger survived the rebuild');
    passed++;

    // (b) the rs_discoveries view still WORKS (queryable, json_extract intact).
    const rsRow = db.prepare(
      "SELECT id, thesis, rs_type, breakthrough_score, room_slug FROM rs_discoveries WHERE id = 'rsdiscovery:abc'"
    ).get();
    ok(rsRow, 'rs_discoveries view returns the seeded RSDiscovery row');
    equal(rsRow.thesis, 'cross-domain bridge thesis', 'view json_extract still maps thesis');
    equal(rsRow.rs_type, 'breakthrough', 'view renames classification -> rs_type');
    equal(rsRow.room_slug, 'demo-room', 'view renames room_id -> room_slug');
    passed++;

    // (b) the second view still works.
    const counts = db.prepare("SELECT type, n FROM node_type_counts ORDER BY type").all();
    ok(counts.length >= 2, 'node_type_counts view returns rows for >=2 node types');
    const claimCount = counts.find((c) => c.type === 'claim');
    ok(claimCount && claimCount.n === 1, 'node_type_counts reports 1 claim node');
    passed++;

    // (b) the trigger still works -- inserting a node logs to nodes_audit.
    const auditBefore = db.prepare("SELECT COUNT(*) AS n FROM nodes_audit").get().n;
    db.prepare(
      "INSERT INTO nodes (id, type, source_path, created_by, review_status, created_at, last_seen_at) " +
      "VALUES (?, 'claim', 'unknown:claim:002', 'system', 'proposed', 0, 0)"
    ).run('claim:002');
    const auditAfter = db.prepare("SELECT COUNT(*) AS n FROM nodes_audit").get().n;
    equal(auditAfter, auditBefore + 1, 'nodes_audit_ins trigger fired on post-migration insert');
    const auditedId = db.prepare("SELECT node_id FROM nodes_audit ORDER BY rowid DESC LIMIT 1").get().node_id;
    equal(auditedId, 'claim:002', 'trigger recorded the right node id');
    passed++;

    // (c) re-running the migration is idempotent: no throw, sentinel short-circuit,
    // schema objects unchanged.
    const objsBefore = schemaObjects(db);
    let r2;
    try {
      r2 = runMigration(db);
    } catch (err) {
      return fail('second migration run threw (idempotency broken)', err);
    }
    ok(r2.applied === false, 'second run short-circuits via sentinel (applied=false)');
    const objsAfter = schemaObjects(db);
    deepEqual(objsAfter, objsBefore, 'view/trigger set unchanged after idempotent re-run');
    // rs_discoveries still works after the re-run.
    const rsRow2 = db.prepare("SELECT id FROM rs_discoveries WHERE id = 'rsdiscovery:abc'").get();
    ok(rsRow2 && rsRow2.id === 'rsdiscovery:abc', 'rs_discoveries still queryable after idempotent re-run');
    passed++;

    db.close();
    process.stdout.write('test-navigation-migration-views: ' + passed + '/' + passed + ' passed (PASS)\n');
    process.exit(0);
  } catch (err) {
    fail('unexpected error', err);
  } finally {
    cleanup(tmp);
  }
}

run();
