'use strict';
// Phase 149-02 (GAM-05) -- planning_artifact nodes are navigable.
// ========================================================================
// Asserts:
//   (1) After a reconcile, a /mos:graph-style read returns the
//       planning_artifact nodes -- proving they are reachable from the
//       navigable surface in the active room's room.db.
//   (2) The navigable read goes through navigation.cjs (getNeighborhood, the
//       same graph-ranking read path /mos:graph uses), not a folder scan.
//
// /mos:graph reads the active room's room.db via navigation.cjs. This test
// reconciles a fixture .planning/ tree into an in-memory room.db, then traverses
// from the SPEC artifact node via navigation.getNeighborhood and asserts the
// downstream planning_artifact nodes (CONTEXT, PLAN) are returned. This is the
// /mos:graph reachability proof (the nodes live in room.db and are navigable).
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) and the
// applySchema(db) in-memory fixture from tests/test-149-artifact-nodes.cjs.
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-149-navigable.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'planning', 'reconcile-runner.cjs');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

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
    "  last_seen_at INTEGER NOT NULL, " +
    "  source_section TEXT, " +
    "  confirmed_by TEXT, " +
    "  confirmed_at INTEGER" +
    ");"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS edges (" +
    "  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type)" +
    ");"
  );
}

function buildFixture() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-149-navigable-'));
  const phaseDir = path.join(roomDir, '.planning', 'phases', '555-nav');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(
    path.join(phaseDir, '555-SPEC.md'),
    '# Nav Spec\n\n## Requirements\n\n1. **NAV-01**: one\n',
    'utf8'
  );
  fs.writeFileSync(path.join(phaseDir, '555-CONTEXT.md'), '# Nav Context\n\nBody.\n', 'utf8');
  fs.writeFileSync(
    path.join(phaseDir, '555-01-PLAN.md'),
    '---\nphase: 555-nav\nplan: 01\nrequirements: [NAV-01]\n---\n\n# Nav Plan\n',
    'utf8'
  );
  return roomDir;
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

const runner = require(RUNNER_PATH);

// --- Test 1: planning_artifact nodes exist in room.db after reconcile ---
check('reconcile lands planning_artifact nodes in the active room room.db', () => {
  const roomDir = buildFixture();
  try {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    runner.reconcilePlanningArtifacts(roomDir, { db: db });
    const rows = db.prepare("SELECT type FROM nodes WHERE type = 'planning_artifact'").all();
    assert.equal(rows.length, 3, 'expected 3 planning_artifact nodes (SPEC, CONTEXT, PLAN)');
    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 2: a /mos:graph-style navigation read returns the artifact nodes ---
check('navigation.getNeighborhood (the /mos:graph read path) returns planning_artifact nodes', () => {
  const roomDir = buildFixture();
  try {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    runner.reconcilePlanningArtifacts(roomDir, { db: db });

    const specNodeId = navigation.ARTIFACT_NODE_ID('555-nav', 'SPEC');
    const neighborhood = navigation.getNeighborhood(db, specNodeId, { maxDepth: 3 });
    const types = new Set(neighborhood.map((n) => n.type));
    const ids = new Set(neighborhood.map((n) => n.id));

    // The SPEC FEEDS_INTO CONTEXT FEEDS_INTO PLAN lineage must be navigable.
    assert.ok(
      types.has('planning_artifact'),
      'the /mos:graph read path must return planning_artifact nodes; got types ' + JSON.stringify([...types])
    );
    const ctxNodeId = navigation.ARTIFACT_NODE_ID('555-nav', 'CONTEXT');
    const planNodeId = navigation.ARTIFACT_NODE_ID('555-nav', 'PLAN');
    assert.ok(ids.has(ctxNodeId), 'CONTEXT must be navigable from SPEC');
    assert.ok(ids.has(planNodeId), 'PLAN must be navigable from SPEC');
    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
  }
});

if (failures > 0) {
  process.stdout.write('\ntest-149-navigable.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-149-navigable.cjs: all assertions passed\n');
process.exit(0);
