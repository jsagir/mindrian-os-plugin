'use strict';
// Phase 149-02 (GAM-02) -- requirement nodes + which-artifacts-touch query.
// ========================================================================
// Asserts:
//   (1) reconcilePlanningArtifacts over a fixture .planning/ tree (a SPEC with a
//       numbered Requirements list IRW-01..IRW-08 + a PLAN whose frontmatter
//       requirements field cites a subset) lands a requirement node per id.
//   (2) The query "which artifacts touch <reqId>" -- a navigation.cjs traversal
//       (getNeighborhood) over the INFORMS / VALIDATES lineage edges from the
//       requirement node -- returns the SPEC node AND the owning PLAN node.
//
// The reconcile reads the .planning markdown LOCALLY to derive generic handles
// (requirement ids), then writes ONLY via navigation.cjs. Room DATA flows only
// through navigation.cjs; the markdown is the source-of-meaning read, not a
// room-data bypass (see test-149-navigation-only-invariant.cjs for the
// structural proof).
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) and the
// applySchema(db) in-memory fixture from tests/test-149-artifact-nodes.cjs. The
// schema mirrors the production nodes column set (phase-109-nodes-provenance.cjs
// lines 292-307) including source_section so getNeighborhood's recursive CTE
// resolves.
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
  process.stdout.write('SKIP test-149-requirement-nodes.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'planning', 'reconcile-runner.cjs');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

// Full production nodes + edges schema (phase-109-nodes-provenance.cjs +
// lazygraph-ops.cjs). source_section is required by getNeighborhood's CTE.
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

// Build a fixture .planning/ tree under a temp dir. Returns the temp room dir.
function buildFixture() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-149-reqnodes-'));
  const phaseDir = path.join(roomDir, '.planning', 'phases', '999-irw-fixture');
  fs.mkdirSync(phaseDir, { recursive: true });

  // SPEC with a numbered Requirements list (the SPEC bolds the ids).
  const spec = [
    '# Phase 999: IRW Fixture Specification',
    '',
    '## Requirements',
    '',
    '1. **IRW-01**: first requirement',
    '2. **IRW-02**: second requirement',
    '3. **IRW-03**: third requirement',
    '4. **IRW-04**: fourth requirement',
    '5. **IRW-05**: fifth requirement',
    '6. **IRW-06**: sixth requirement',
    '7. **IRW-07**: seventh requirement',
    '8. **IRW-08**: eighth requirement',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(phaseDir, '999-SPEC.md'), spec, 'utf8');

  // CONTEXT (no requirements, but part of the lineage chain).
  fs.writeFileSync(
    path.join(phaseDir, '999-CONTEXT.md'),
    '# Phase 999 Context\n\nContext body.\n',
    'utf8'
  );

  // PLAN whose frontmatter requirements field cites a subset including IRW-06.
  const plan = [
    '---',
    'phase: 999-irw-fixture',
    'plan: 01',
    'requirements: [IRW-01, IRW-06]',
    '---',
    '',
    '# Phase 999 Plan 01',
    '',
    'Plan body.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(phaseDir, '999-01-PLAN.md'), plan, 'utf8');

  // VERIFICATION (VALIDATES the requirements).
  fs.writeFileSync(
    path.join(phaseDir, '999-VERIFICATION.md'),
    '# Phase 999 Verification\n\nVerification body.\n',
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

// --- Test 1: a requirement node lands for every id in the SPEC list ---
check('reconcile lands a requirement node per IRW id (IRW-01..IRW-08)', () => {
  const roomDir = buildFixture();
  try {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    runner.reconcilePlanningArtifacts(roomDir, { db: db });
    for (let i = 1; i <= 8; i++) {
      const reqId = 'IRW-0' + i;
      const nodeId = navigation.REQUIREMENT_NODE_ID(reqId);
      const row = db.prepare("SELECT id, type FROM nodes WHERE id = ?").get(nodeId);
      assert.ok(row, 'requirement node missing for ' + reqId);
      assert.equal(row.type, 'requirement', 'node type for ' + reqId);
    }
    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 2: which-artifacts-touch IRW-06 returns the SPEC + owning PLAN ---
check('which-artifacts-touch IRW-06 returns the SPEC and the owning PLAN', () => {
  const roomDir = buildFixture();
  try {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    runner.reconcilePlanningArtifacts(roomDir, { db: db });

    const reqNodeId = navigation.REQUIREMENT_NODE_ID('IRW-06');
    // Traverse the neighborhood of the requirement node via navigation.cjs.
    const neighborhood = navigation.getNeighborhood(db, reqNodeId, { maxDepth: 2 });
    const ids = new Set(neighborhood.map((n) => n.id));

    const specNodeId = navigation.ARTIFACT_NODE_ID('999-irw-fixture', 'SPEC');
    const planNodeId = navigation.ARTIFACT_NODE_ID('999-irw-fixture', 'PLAN');

    assert.ok(
      ids.has(specNodeId),
      'IRW-06 neighborhood must include the SPEC node; got: ' + JSON.stringify([...ids])
    );
    assert.ok(
      ids.has(planNodeId),
      'IRW-06 neighborhood must include the owning PLAN node; got: ' + JSON.stringify([...ids])
    );
    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
  }
});

if (failures > 0) {
  process.stdout.write('\ntest-149-requirement-nodes.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-149-requirement-nodes.cjs: all assertions passed\n');
process.exit(0);
