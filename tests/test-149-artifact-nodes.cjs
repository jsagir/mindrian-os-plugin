'use strict';
// Phase 149-01 (GAM-01) -- planning_artifact node-write contract.
// ========================================================================
// Asserts:
//   (1) writePlanningArtifactNode(db, {phase, artifactType, path, status})
//       lands EXACTLY ONE row of type 'planning_artifact'.
//   (2) That row carries properties.{phase, artifact_type, path, status}
//       with the correct values.
//   (3) The node is a SYSTEM-BOOKKEEPING node (Canon Part 9 v1.5 audit-node
//       carve-out): created_by='system', review_status='confirmed'.
//   (4) Substrate-guard FLOOR: a grep of the writer source matches NO direct
//       room.db open (no require of room-db.cjs, no node:sqlite, no openRoomDb).
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) and the
// applySchema(db) in-memory fixture from
// tests/test-feynman-timeline-canon-part-9-invariant.cjs. The schema mirrors
// the production nodes column set (lib/core/migrations/phase-109-nodes-provenance.cjs
// lines 293-307: created_by CHECK includes 'system'; review_status enum includes
// 'confirmed') so the in-memory fixture matches production.
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-149-artifact-nodes.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const WRITER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'planning-artifacts.cjs');

// Mirror the production nodes + edges schema (phase-109-nodes-provenance.cjs +
// lazygraph-ops.cjs initSchema). The edges PRIMARY KEY (source, target, type)
// is what makes the ON CONFLICT upsert idempotent (used by sibling suites).
function applySchema(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS nodes (" +
    "  id TEXT PRIMARY KEY, " +
    "  type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, " +
    "  last_seen_at INTEGER NOT NULL" +
    ");"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS edges (" +
    "  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type)" +
    ");"
  );
}

const writer = require(WRITER_PATH);

let failures = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failures++;
    process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n');
  }
}

// --- Test 1: a SPEC artifact lands exactly one planning_artifact node ---
check('writePlanningArtifactNode lands exactly one planning_artifact node', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const res = writer.writePlanningArtifactNode(db, {
    phase: '149',
    artifactType: 'SPEC',
    path: '.planning/phases/149-x/149-SPEC.md',
    status: 'active',
  });
  assert.equal(res.ok, true, 'write should succeed: ' + JSON.stringify(res));
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'planning_artifact'").all();
  assert.equal(rows.length, 1, 'expected exactly one planning_artifact node');
  db.close();
});

// --- Test 2: properties carry the correct fields ---
check('planning_artifact node carries {phase, artifact_type, path, status}', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  writer.writePlanningArtifactNode(db, {
    phase: '149',
    artifactType: 'SPEC',
    path: '.planning/phases/149-x/149-SPEC.md',
    status: 'active',
  });
  const row = db.prepare("SELECT properties FROM nodes WHERE type = 'planning_artifact'").get();
  const props = JSON.parse(row.properties);
  assert.equal(props.phase, '149', 'phase');
  assert.equal(props.artifact_type, 'SPEC', 'artifact_type');
  assert.equal(props.path, '.planning/phases/149-x/149-SPEC.md', 'path');
  assert.equal(props.status, 'active', 'status');
  db.close();
});

// --- Test 3: it is a system-bookkeeping node (Part 9 carve-out) ---
check('planning_artifact is a system-bookkeeping node (created_by=system, confirmed)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  writer.writePlanningArtifactNode(db, {
    phase: '149',
    artifactType: 'CONTEXT',
    path: '.planning/phases/149-x/149-CONTEXT.md',
    status: 'active',
  });
  const row = db.prepare("SELECT created_by, review_status FROM nodes WHERE type = 'planning_artifact'").get();
  assert.equal(row.created_by, 'system', 'created_by must be system');
  assert.equal(row.review_status, 'confirmed', 'review_status must be confirmed (carve-out write-completed marker)');
  db.close();
});

// --- Test 4: invalid artifactType is rejected ---
check('invalid artifactType is rejected (no node written)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const res = writer.writePlanningArtifactNode(db, {
    phase: '149',
    artifactType: 'NOT-A-REAL-TYPE',
    path: '.planning/x.md',
    status: 'active',
  });
  assert.equal(res.ok, false, 'should reject unknown artifactType');
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'planning_artifact'").all();
  assert.equal(rows.length, 0, 'no node written for invalid type');
  db.close();
});

// --- Test 5: substrate-guard FLOOR -- writer source has zero direct room.db open ---
check('writer source has NO direct room.db open (substrate-guard floor)', () => {
  const src = fs.readFileSync(WRITER_PATH, 'utf8');
  // No require of room-db.cjs (the direct-open door).
  assert.ok(
    !/require\s*\(\s*['"][^'"]*room-db[^'"]*['"]\s*\)/.test(src),
    'writer must NOT require room-db.cjs'
  );
  // No require of node:sqlite (the writer takes a caller-owned db handle).
  assert.ok(
    !/require\s*\(\s*['"]node:sqlite['"]\s*\)/.test(src),
    'writer must NOT require node:sqlite'
  );
  // No openRoomDb / openGraph call site.
  assert.ok(!/openRoomDb\s*\(/.test(src), 'writer must NOT call openRoomDb');
  assert.ok(!/openGraph\s*\(/.test(src), 'writer must NOT call openGraph');
});

if (failures > 0) {
  process.stdout.write('\ntest-149-artifact-nodes.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-149-artifact-nodes.cjs: all assertions passed\n');
process.exit(0);
