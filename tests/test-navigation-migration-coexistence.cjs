'use strict';
// Phase 109-01 test: post-migration, the legacy assumptions table is NOT
// dropped. Old reads (SELECT * FROM assumptions) keep working byte-identically.
// New graph node reads (SELECT * FROM nodes WHERE type='assumption') work
// alongside. Backward compat invariant per CONTEXT.md L353-358.

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const { runMigration } = require(path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-109-nodes-provenance.cjs'));

function setupRoomWithAssumptions() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-mig-coex-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(path.join(tmp, '.mindrian', 'room.db'));
  db.exec(
    "CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}'); " +
    "CREATE INDEX idx_nodes_type ON nodes(type); " +
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type)); " +
    "CREATE TABLE identity (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL); " +
    "CREATE TABLE assumptions (id INTEGER PRIMARY KEY AUTOINCREMENT, claim TEXT NOT NULL, section TEXT, validity TEXT NOT NULL DEFAULT 'untested' CHECK(validity IN ('untested','supported','contradicted','stale')), evidence_for TEXT DEFAULT '[]', evidence_against TEXT DEFAULT '[]', created_at TEXT NOT NULL, last_tested TEXT, invalidated_at TEXT);"
  );
  db.prepare(
    "INSERT INTO assumptions (claim, section, validity, created_at) VALUES (?, ?, ?, ?)"
  ).run('Coexistence claim', 'market-analysis', 'supported', '2026-04-15 12:00:00');
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function run() {
  const { tmp, db } = setupRoomWithAssumptions();
  try {
    runMigration(db);

    // Old read path still works.
    const old = db.prepare(
      "SELECT id, claim, validity FROM assumptions WHERE id = 1"
    ).get();
    ok(old, 'legacy assumptions row still readable');
    equal(old.validity, 'supported', 'legacy validity unchanged');
    equal(old.claim, 'Coexistence claim', 'legacy claim text unchanged');

    // New read path works.
    const newNode = db.prepare(
      "SELECT id, type, review_status, properties FROM nodes WHERE id = 'assumption:1'"
    ).get();
    ok(newNode, 'new graph node row created');
    equal(newNode.type, 'assumption', 'new node has type assumption');
    equal(newNode.review_status, 'validated', 'supported -> validated mapping');

    // Same claim text in both views (consistency).
    const props = JSON.parse(newNode.properties);
    equal(props.claim, 'Coexistence claim', 'graph node properties preserve claim text');
    equal(props.legacy_validity, 'supported', 'graph node carries legacy_validity for audit trail');

    // No row count drift in legacy table.
    const cnt = db.prepare("SELECT COUNT(*) AS n FROM assumptions").get().n;
    equal(cnt, 1, 'legacy assumptions table row count unchanged');

    // Schema of assumptions table unchanged (byte-identical column set).
    const assumptionsCols = db.prepare("PRAGMA table_info(assumptions)").all().map((c) => c.name).sort();
    const expectedAssumptionsCols = [
      'claim', 'created_at', 'evidence_against', 'evidence_for',
      'id', 'invalidated_at', 'last_tested', 'section', 'validity',
    ];
    for (const col of expectedAssumptionsCols) {
      ok(assumptionsCols.includes(col), 'assumptions column preserved: ' + col);
    }

    db.close();
    process.stdout.write('test-navigation-migration-coexistence: PASS\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write('test-navigation-migration-coexistence: FAIL: ' + err.message + '\n' + err.stack + '\n');
    process.exit(1);
  } finally {
    cleanup(tmp);
  }
}

run();
