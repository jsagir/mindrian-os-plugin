'use strict';
// Phase 149-01 (GAM-03) -- typed lineage-edge contract.
// ========================================================================
// Asserts:
//   (1) writeLineageEdge(db, {source_id, target_id, edge_type:'FEEDS_INTO'})
//       lands the edge row (delegating to edges.writeEdge / ALLOWED_EDGE_TYPES).
//   (2) writeLineageEdge rejects a non-taxonomy edge_type ('BOGUS_LINK') with
//       ok:false -- no bespoke edge type can bypass the taxonomy gate (T-149-01).
//   (3) A SPEC -> CONTEXT -> PLAN FEEDS_INTO chain is traversable.
//   (4) VALIDATES is a supported lineage edge type (VERIFICATION VALIDATES req).
//   (5) writeLineageEdge rejects an edge_type that is a real ALLOWED_EDGE_TYPES
//       member but NOT a lineage type (e.g. 'DEFERRED') -- the lineage writer
//       constrains to its LINEAGE subset, it does not widen the taxonomy.
//   (6) NO em-dash / en-dash codepoints anywhere in the writer source. The
//       em-dash (0x2014) and en-dash (0x2013) are referenced via
//       String.fromCharCode so THIS file stays greppably clean.
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) and the
// applySchema(db) in-memory fixture from
// tests/test-feynman-timeline-canon-part-9-invariant.cjs.
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-149-lineage-edges.cjs (node:sqlite unavailable)\n');
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

// Seed two planning_artifact nodes so edges have real endpoints.
function seedArtifact(db, phase, artifactType, p) {
  return writer.writePlanningArtifactNode(db, {
    phase: phase,
    artifactType: artifactType,
    path: p,
    status: 'active',
  });
}

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

// --- Test 1: FEEDS_INTO edge writes ---
check('writeLineageEdge writes a FEEDS_INTO edge', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const spec = seedArtifact(db, '149', 'SPEC', '.planning/phases/149-x/149-SPEC.md');
  const ctx = seedArtifact(db, '149', 'CONTEXT', '.planning/phases/149-x/149-CONTEXT.md');
  const res = writer.writeLineageEdge(db, {
    source_id: spec.node_id,
    target_id: ctx.node_id,
    edge_type: 'FEEDS_INTO',
  });
  assert.equal(res.ok, true, 'FEEDS_INTO should write: ' + JSON.stringify(res));
  const row = db.prepare(
    "SELECT * FROM edges WHERE source = ? AND target = ? AND type = 'FEEDS_INTO'"
  ).get(spec.node_id, ctx.node_id);
  assert.ok(row, 'FEEDS_INTO edge row should exist');
  db.close();
});

// --- Test 2: a non-taxonomy edge_type is rejected ---
check('writeLineageEdge rejects a non-taxonomy edge_type (BOGUS_LINK)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const spec = seedArtifact(db, '149', 'SPEC', '.planning/phases/149-x/149-SPEC.md');
  const ctx = seedArtifact(db, '149', 'CONTEXT', '.planning/phases/149-x/149-CONTEXT.md');
  const res = writer.writeLineageEdge(db, {
    source_id: spec.node_id,
    target_id: ctx.node_id,
    edge_type: 'BOGUS_LINK',
  });
  assert.equal(res.ok, false, 'BOGUS_LINK must be rejected');
  const rows = db.prepare("SELECT * FROM edges WHERE type = 'BOGUS_LINK'").all();
  assert.equal(rows.length, 0, 'no BOGUS_LINK edge written');
  db.close();
});

// --- Test 3: SPEC -> CONTEXT -> PLAN chain is traversable ---
check('SPEC -> CONTEXT -> PLAN FEEDS_INTO chain is traversable', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const spec = seedArtifact(db, '149', 'SPEC', '.planning/phases/149-x/149-SPEC.md');
  const ctx = seedArtifact(db, '149', 'CONTEXT', '.planning/phases/149-x/149-CONTEXT.md');
  const plan = seedArtifact(db, '149', 'PLAN', '.planning/phases/149-x/149-01-PLAN.md');
  writer.writeLineageEdge(db, { source_id: spec.node_id, target_id: ctx.node_id, edge_type: 'FEEDS_INTO' });
  writer.writeLineageEdge(db, { source_id: ctx.node_id, target_id: plan.node_id, edge_type: 'FEEDS_INTO' });

  // Hop 1: SPEC -> ?
  const hop1 = db.prepare(
    "SELECT target FROM edges WHERE source = ? AND type = 'FEEDS_INTO'"
  ).get(spec.node_id);
  assert.equal(hop1.target, ctx.node_id, 'SPEC feeds CONTEXT');
  // Hop 2: CONTEXT -> ?
  const hop2 = db.prepare(
    "SELECT target FROM edges WHERE source = ? AND type = 'FEEDS_INTO'"
  ).get(hop1.target);
  assert.equal(hop2.target, plan.node_id, 'CONTEXT feeds PLAN');
  db.close();
});

// --- Test 4: VALIDATES is a supported lineage type ---
check('writeLineageEdge writes a VALIDATES edge', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const ver = seedArtifact(db, '149', 'VERIFICATION', '.planning/phases/149-x/149-VERIFICATION.md');
  // The VALIDATES target can be any node id; seed a second artifact as a stand-in.
  const plan = seedArtifact(db, '149', 'PLAN', '.planning/phases/149-x/149-01-PLAN.md');
  const res = writer.writeLineageEdge(db, {
    source_id: ver.node_id,
    target_id: plan.node_id,
    edge_type: 'VALIDATES',
  });
  assert.equal(res.ok, true, 'VALIDATES should write: ' + JSON.stringify(res));
  db.close();
});

// --- Test 5: a real-but-non-lineage edge type is rejected by the lineage writer ---
check('writeLineageEdge rejects a real-but-non-lineage edge type (DEFERRED)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const spec = seedArtifact(db, '149', 'SPEC', '.planning/phases/149-x/149-SPEC.md');
  const ctx = seedArtifact(db, '149', 'CONTEXT', '.planning/phases/149-x/149-CONTEXT.md');
  const res = writer.writeLineageEdge(db, {
    source_id: spec.node_id,
    target_id: ctx.node_id,
    edge_type: 'DEFERRED',
  });
  assert.equal(res.ok, false, 'DEFERRED is a real edge type but NOT a lineage type; the lineage writer must constrain to its subset');
  db.close();
});

// --- Test 6: no em-dash / en-dash codepoints in the writer source ---
check('writer source contains zero em-dash / en-dash codepoints', () => {
  const src = fs.readFileSync(WRITER_PATH, 'utf8');
  const EM_DASH = String.fromCharCode(0x2014);
  const EN_DASH = String.fromCharCode(0x2013);
  assert.ok(src.indexOf(EM_DASH) === -1, 'writer must contain no em-dash (0x2014)');
  assert.ok(src.indexOf(EN_DASH) === -1, 'writer must contain no en-dash (0x2013)');
});

if (failures > 0) {
  process.stdout.write('\ntest-149-lineage-edges.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-149-lineage-edges.cjs: all assertions passed\n');
process.exit(0);
