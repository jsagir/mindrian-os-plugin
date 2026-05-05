'use strict';
// Phase 109-01 test: migration backfills typed columns from properties JSON;
// promotes assumptions table rows to graph nodes via status_aliases mapping;
// logs one state_alias_migration memory_event per migrated assumption.

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const { runMigration } = require(path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-109-nodes-provenance.cjs'));

function setupLegacyRoomWithSeedData() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-mig-bf-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(path.join(tmp, '.mindrian', 'room.db'));
  db.exec(
    "CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}'); " +
    "CREATE INDEX idx_nodes_type ON nodes(type); " +
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type)); " +
    "CREATE TABLE identity (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL); " +
    "CREATE TABLE assumptions (id INTEGER PRIMARY KEY AUTOINCREMENT, claim TEXT NOT NULL, section TEXT, validity TEXT NOT NULL DEFAULT 'untested' CHECK(validity IN ('untested','supported','contradicted','stale')), evidence_for TEXT DEFAULT '[]', evidence_against TEXT DEFAULT '[]', created_at TEXT NOT NULL, last_tested TEXT, invalidated_at TEXT);"
  );

  // Seed nodes with properties JSON values that backfill should extract.
  const ins = db.prepare("INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)");
  ins.run('claim:hi', 'claim', JSON.stringify({
    summary: 'high conf',
    confidence: 'high',
    section: 'market-analysis',
    source_path: 'market-analysis/claim-hi.md',
    created: '2026-04-01',
  }));
  ins.run('claim:med', 'claim', JSON.stringify({
    summary: 'medium', confidence: 'medium', section: 'business-model',
  }));
  ins.run('claim:lo', 'claim', JSON.stringify({
    summary: 'low', confidence: 'low',
  }));
  ins.run('claim:real', 'CausalClaim', JSON.stringify({
    cause: 'A', effect: 'B', confidence: 0.78, source_artifact: 'evidence/causal-1.md',
  }));

  // Seed assumptions: one per validity value. Use ISO created_at strings
  // (the real assumptions schema has DEFAULT CURRENT_TIMESTAMP but we set
  // explicit values for deterministic testing).
  const insA = db.prepare("INSERT INTO assumptions (claim, section, validity, created_at) VALUES (?, ?, ?, ?)");
  insA.run('Users want X', 'problem-definition', 'untested', '2026-04-01 00:00:00');
  insA.run('Market is Y', 'market-analysis', 'supported', '2026-04-02 00:00:00');
  insA.run('Approach Z works', 'solution-design', 'contradicted', '2026-04-03 00:00:00');
  insA.run('We have skill W', 'team', 'stale', '2026-04-04 00:00:00');

  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function run() {
  const { tmp, db } = setupLegacyRoomWithSeedData();
  try {
    const r = runMigration(db);
    ok(r.applied === true, 'migration applied');
    equal(r.backfilledAssumptions, 4, 'backfilled exactly 4 assumption rows');

    // confidence string-enum mapped to REAL: high=0.8, medium=0.5, low=0.3.
    const hi = db.prepare("SELECT confidence FROM nodes WHERE id = 'claim:hi'").get();
    const med = db.prepare("SELECT confidence FROM nodes WHERE id = 'claim:med'").get();
    const lo = db.prepare("SELECT confidence FROM nodes WHERE id = 'claim:lo'").get();
    equal(hi.confidence, 0.8, 'high confidence string mapped to 0.8');
    equal(med.confidence, 0.5, 'medium mapped to 0.5');
    equal(lo.confidence, 0.3, 'low mapped to 0.3');

    // Real-valued confidence preserved.
    const real = db.prepare("SELECT confidence FROM nodes WHERE id = 'claim:real'").get();
    ok(Math.abs(real.confidence - 0.78) < 1e-6, 'real-valued confidence preserved');

    // source_path backfill from properties.source_path then properties.source_artifact.
    equal(
      db.prepare("SELECT source_path FROM nodes WHERE id = 'claim:hi'").get().source_path,
      'market-analysis/claim-hi.md',
      'source_path from properties.source_path'
    );
    equal(
      db.prepare("SELECT source_path FROM nodes WHERE id = 'claim:real'").get().source_path,
      'evidence/causal-1.md',
      'source_path from properties.source_artifact for CausalClaim'
    );

    // source_section backfill from properties.section.
    equal(
      db.prepare("SELECT source_section FROM nodes WHERE id = 'claim:hi'").get().source_section,
      'market-analysis',
      'source_section backfilled'
    );

    // Provenance defaults populated for legacy rows.
    const hiFull = db.prepare("SELECT created_by, review_status, created_at, last_seen_at FROM nodes WHERE id = 'claim:hi'").get();
    equal(hiFull.created_by, 'system', 'created_by defaults to system for legacy rows');
    equal(hiFull.review_status, 'proposed', 'review_status defaults to proposed for legacy rows');
    ok(typeof hiFull.created_at === 'number' || typeof hiFull.created_at === 'bigint', 'created_at populated as integer');
    ok(typeof hiFull.last_seen_at === 'number' || typeof hiFull.last_seen_at === 'bigint', 'last_seen_at populated as integer');

    // assumptions promoted to graph nodes with status_aliases mapping.
    // Assumption ids are INTEGER, so node ids are 'assumption:1' .. 'assumption:4'.
    const a1 = db.prepare("SELECT review_status, type FROM nodes WHERE id = 'assumption:1'").get();
    const a2 = db.prepare("SELECT review_status, type FROM nodes WHERE id = 'assumption:2'").get();
    const a3 = db.prepare("SELECT review_status, type FROM nodes WHERE id = 'assumption:3'").get();
    const a4 = db.prepare("SELECT review_status, type FROM nodes WHERE id = 'assumption:4'").get();
    ok(a1, 'assumption:1 promoted to graph node');
    ok(a2, 'assumption:2 promoted');
    ok(a3, 'assumption:3 promoted');
    ok(a4, 'assumption:4 promoted');
    equal(a1.review_status, 'proposed', 'untested -> proposed');
    equal(a2.review_status, 'validated', 'supported -> validated');
    equal(a3.review_status, 'invalidated', 'contradicted -> invalidated');
    equal(a4.review_status, 'stale', 'stale -> stale');
    equal(a1.type, 'assumption', 'assumption type preserved');

    // Exactly 4 state_alias_migration memory_events logged.
    const events = db.prepare(
      "SELECT id, json_extract(properties, '$.event_type') AS event_type FROM nodes " +
      "WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'state_alias_migration'"
    ).all();
    equal(events.length, 4, 'one state_alias_migration memory_event per migrated assumption');

    // Indices exist (mandatory + recommended per PROVENANCE.md L97-104).
    const indices = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_nodes_%'"
    ).all().map((r) => r.name).sort();
    const required = [
      'idx_nodes_confirmed_by',
      'idx_nodes_created_at',
      'idx_nodes_created_by',
      'idx_nodes_last_seen_at',
      'idx_nodes_review_status',
      'idx_nodes_source_path',
      'idx_nodes_type',
    ];
    for (const idx of required) {
      ok(indices.includes(idx), 'index exists: ' + idx);
    }

    db.close();
    process.stdout.write('test-navigation-migration-backfill: PASS\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write('test-navigation-migration-backfill: FAIL: ' + err.message + '\n' + err.stack + '\n');
    process.exit(1);
  } finally {
    cleanup(tmp);
  }
}

run();
