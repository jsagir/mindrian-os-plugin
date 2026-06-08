'use strict';
// Phase 149-02 (GAM-07) -- idempotent backfill = sync.
// ========================================================================
// Asserts:
//   (1) reconcilePlanningArtifacts over a fixture .planning/ tree with N
//       artifacts across 2 phases lands the expected planning_artifact node
//       count AND lineage edge count.
//   (2) Running reconcile AGAIN over the UNCHANGED tree leaves the node count
//       AND the edge count identical -- backfill and sync are the same
//       idempotent code path (D-02). This is the load-bearing invariant: every
//       write is an upsert keyed on a stable node/edge id (Plan 01 contract), so
//       a second pass changes no counts (threat T-149-06).
//
// The reconcile reads the .planning markdown LOCALLY to classify artifacts and
// parse requirement ids, then writes ONLY via navigation.cjs.
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
  process.stdout.write('SKIP test-149-backfill.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'planning', 'reconcile-runner.cjs');

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

// Build a fixture .planning/ tree with artifacts across 2 phases.
// Phase A: SPEC + CONTEXT + PLAN + VERIFICATION (4 artifacts, 2 requirements).
// Phase B: SPEC + PLAN (2 artifacts, 1 requirement).
function buildFixture() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-149-backfill-'));

  const aDir = path.join(roomDir, '.planning', 'phases', '777-alpha');
  fs.mkdirSync(aDir, { recursive: true });
  fs.writeFileSync(
    path.join(aDir, '777-SPEC.md'),
    '# Alpha Spec\n\n## Requirements\n\n1. **ALP-01**: one\n2. **ALP-02**: two\n',
    'utf8'
  );
  fs.writeFileSync(path.join(aDir, '777-CONTEXT.md'), '# Alpha Context\n\nBody.\n', 'utf8');
  fs.writeFileSync(
    path.join(aDir, '777-01-PLAN.md'),
    '---\nphase: 777-alpha\nplan: 01\nrequirements: [ALP-01]\n---\n\n# Alpha Plan\n',
    'utf8'
  );
  fs.writeFileSync(path.join(aDir, '777-VERIFICATION.md'), '# Alpha Verification\n\nBody.\n', 'utf8');

  const bDir = path.join(roomDir, '.planning', 'phases', '888-beta');
  fs.mkdirSync(bDir, { recursive: true });
  fs.writeFileSync(
    path.join(bDir, '888-SPEC.md'),
    '# Beta Spec\n\n## Requirements\n\n1. **BET-01**: one\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(bDir, '888-01-PLAN.md'),
    '---\nphase: 888-beta\nplan: 01\nrequirements: [BET-01]\n---\n\n# Beta Plan\n',
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

function counts(db) {
  const nodes = db.prepare("SELECT COUNT(*) AS c FROM nodes").get().c;
  const artifacts = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'planning_artifact'").get().c;
  const reqs = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'requirement'").get().c;
  const edges = db.prepare("SELECT COUNT(*) AS c FROM edges").get().c;
  return { nodes, artifacts, reqs, edges };
}

// --- Test 1: first run backfills the expected node + edge counts ---
check('first reconcile backfills the expected artifact + requirement nodes', () => {
  const roomDir = buildFixture();
  try {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    runner.reconcilePlanningArtifacts(roomDir, { db: db });
    const c = counts(db);
    // 6 planning_artifact nodes: phase A (SPEC,CONTEXT,PLAN,VERIFICATION) + phase B (SPEC,PLAN).
    assert.equal(c.artifacts, 6, 'expected 6 planning_artifact nodes; got ' + c.artifacts);
    // 3 requirement nodes: ALP-01, ALP-02, BET-01.
    assert.equal(c.reqs, 3, 'expected 3 requirement nodes; got ' + c.reqs);
    // Some lineage edges must exist (FEEDS_INTO + INFORMS + VALIDATES).
    assert.ok(c.edges > 0, 'expected lineage edges to be written; got ' + c.edges);
    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 2: second run over the unchanged tree changes no counts ---
check('second reconcile over unchanged tree leaves node AND edge counts identical', () => {
  const roomDir = buildFixture();
  try {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    runner.reconcilePlanningArtifacts(roomDir, { db: db });
    const first = counts(db);
    runner.reconcilePlanningArtifacts(roomDir, { db: db });
    const second = counts(db);
    assert.deepEqual(second, first, 'idempotence: second pass must not change counts. first=' +
      JSON.stringify(first) + ' second=' + JSON.stringify(second));
    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
  }
});

if (failures > 0) {
  process.stdout.write('\ntest-149-backfill.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-149-backfill.cjs: all assertions passed\n');
process.exit(0);
