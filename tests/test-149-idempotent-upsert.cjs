'use strict';
// Phase 149-01 (GAM-04) -- idempotent upsert contract.
// ========================================================================
// Asserts:
//   (1) Calling writePlanningArtifactNode TWICE for the same artifact yields
//       EXACTLY ONE node row after the second write (stable id + ON CONFLICT(id)
//       DO UPDATE upsert is the dedup mechanism).
//   (2) The second write UPDATES in place (status change reflected, last_seen_at
//       advanced) without creating a duplicate.
//   (3) Calling writeLineageEdge TWICE for the same (source, target, type) triple
//       yields EXACTLY ONE edge row (ON CONFLICT(source,target,type) DO UPDATE).
//   (4) writeRequirementNode is idempotent on the same reqId.
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) and the
// applySchema(db) in-memory fixture from
// tests/test-feynman-timeline-canon-part-9-invariant.cjs. The edges PRIMARY KEY
// (source, target, type) is why the edge ON CONFLICT upsert is idempotent
// (lib/core/lazygraph-ops.cjs lines 39-53 in production).
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-149-idempotent-upsert.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const WRITER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'planning-artifacts.cjs');

function applySchema(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS nodes (" +
    "  id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL" +
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

// --- Test 1: second write of same artifact does not duplicate the node ---
check('writePlanningArtifactNode twice -> exactly one node', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const payload = {
    phase: '149',
    artifactType: 'SPEC',
    path: '.planning/phases/149-x/149-SPEC.md',
    status: 'active',
  };
  const a = writer.writePlanningArtifactNode(db, payload);
  const b = writer.writePlanningArtifactNode(db, payload);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.node_id, b.node_id, 'stable id across writes');
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'planning_artifact'").all();
  assert.equal(rows.length, 1, 'expected exactly one node after second write');
  db.close();
});

// --- Test 2: second write updates in place (status reflected) ---
check('writePlanningArtifactNode second write updates properties in place', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  writer.writePlanningArtifactNode(db, {
    phase: '149', artifactType: 'PLAN', path: '.planning/phases/149-x/149-01-PLAN.md', status: 'active',
  });
  writer.writePlanningArtifactNode(db, {
    phase: '149', artifactType: 'PLAN', path: '.planning/phases/149-x/149-01-PLAN.md', status: 'complete',
  });
  const rows = db.prepare("SELECT properties FROM nodes WHERE type = 'planning_artifact'").all();
  assert.equal(rows.length, 1, 'still exactly one node');
  const props = JSON.parse(rows[0].properties);
  assert.equal(props.status, 'complete', 'status updated to complete on second write');
  db.close();
});

// --- Test 3: second write of same edge triple does not duplicate ---
check('writeLineageEdge twice for same triple -> exactly one edge', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const spec = writer.writePlanningArtifactNode(db, {
    phase: '149', artifactType: 'SPEC', path: '.planning/phases/149-x/149-SPEC.md', status: 'active',
  });
  const ctx = writer.writePlanningArtifactNode(db, {
    phase: '149', artifactType: 'CONTEXT', path: '.planning/phases/149-x/149-CONTEXT.md', status: 'active',
  });
  const triple = { source_id: spec.node_id, target_id: ctx.node_id, edge_type: 'FEEDS_INTO' };
  const e1 = writer.writeLineageEdge(db, triple);
  const e2 = writer.writeLineageEdge(db, triple);
  assert.equal(e1.ok, true);
  assert.equal(e2.ok, true);
  const rows = db.prepare(
    "SELECT * FROM edges WHERE source = ? AND target = ? AND type = 'FEEDS_INTO'"
  ).all(spec.node_id, ctx.node_id);
  assert.equal(rows.length, 1, 'expected exactly one edge after second write');
  db.close();
});

// --- Test 4: requirement node upsert is idempotent ---
check('writeRequirementNode twice -> exactly one requirement node', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const a = writer.writeRequirementNode(db, { reqId: 'GAM-01', phase: '149' });
  const b = writer.writeRequirementNode(db, { reqId: 'GAM-01', phase: '149' });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(b.ok, true);
  assert.equal(a.node_id, b.node_id, 'stable requirement id');
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'requirement'").all();
  assert.equal(rows.length, 1, 'expected exactly one requirement node');
  db.close();
});

if (failures > 0) {
  process.stdout.write('\ntest-149-idempotent-upsert.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-149-idempotent-upsert.cjs: all assertions passed\n');
process.exit(0);
