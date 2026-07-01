'use strict';
/*
 * Phase 195-02 Wave 1 -- FCM-01/02 recursive reconciler.
 * =========================================================================
 * The fractal was certified "closed" while reconcileMemoryArtifacts walked only
 * the room root + one layer of sections (the shipped 1-level walk). This suite
 * asserts the enforced depth-3 fractal invariant:
 *
 *   (1) discoverMemoryFiles recurses ROOM.md-bearing sub-rooms to DEPTH_CAP (3),
 *       inclusive -- it reaches the shared fixture's depth-3 sub-sub-room.
 *   (2) A depth-4 ROOM.md-bearing dir is discovered by its parent but NOT scanned
 *       and NOT projected (bounded at the frozen coverage-rollup DEPTH_CAP; a
 *       second depth constant is never minted).
 *   (3) Pass-2 over an unchanged fractal returns {upserted:0} and a byte-identical
 *       node AND edge count (idempotence is FREE: every write is an upsert on a
 *       stable, now depth-qualified, node id).
 *   (4) distinct memory-file count === memory_artifact node count -- depth-
 *       qualified node ids never collide, even when two sub-rooms share a bare
 *       section slug (Pitfall 2 / threat T-195-05).
 *   (5) Entry-23 boundary: the memory_artifact node count equals the discovered
 *       file count exactly, so nothing extra is aggregated from a cross-room
 *       NESTED_WITHIN edge read (Appendix D entry 23, Pitfall 3 / threat
 *       T-195-03). The runner never reads a child room.db.
 *
 * node:sqlite SKIP-on-unavailable guard (exit 77) mirrors test-150-reconcile.cjs.
 * A temp-FILE DatabaseSync exercises the on-disk upsert path for idempotence.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-195-recursive-reconcile.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'memory', 'reconcile-memory-runner.cjs');
const SHARED_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', '195-nested-room-tree', 'root-room');
const runner = require(RUNNER_PATH);

// ---------- Schema fixture (production nodes + edges column set) ----------

function applySchema(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS nodes (" +
    "  id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, " +
    "  source_section TEXT, confirmed_by TEXT, confirmed_at INTEGER);"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS edges (" +
    "  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type));"
  );
}

// A minimal room dir: ROOM.md (identity marker, Decision #15) + STATE.md. Two
// memory files per dir keeps counts trivial (ROOM/STATE trigger no richer
// projection branch, so only memory_artifact nodes land, no edges).
function writeRoomDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + path.basename(dir) + '\n\nIdentity prose.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'STATE.md'), '---\nstatus: active\n---\n\n## Room State\n\nState prose.\n', 'utf8');
}

// A controlled fractal:
//   root/                          depth 0
//     alpha/                       depth 1
//       subA/                      depth 2
//         subA1/                   depth 3   (INCLUDED, inclusive cap)
//           subA1x/                depth 4   (NOT projected)
//     beta/                        depth 1
//       shared/                    depth 2   (bare slug 'shared')
//     gamma/                       depth 1
//       shared/                    depth 2   (SAME bare slug 'shared' -> collision test)
//
// Projected dirs (8): root, alpha, alpha/subA, alpha/subA/subA1, beta,
// beta/shared, gamma, gamma/shared. subA1x (depth 4) is excluded.
// 8 dirs x 2 memory files = 16 memory_artifact nodes.
function buildFractal() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-195-fractal-'));
  writeRoomDir(root);
  writeRoomDir(path.join(root, 'alpha'));
  writeRoomDir(path.join(root, 'alpha', 'subA'));
  writeRoomDir(path.join(root, 'alpha', 'subA', 'subA1'));
  writeRoomDir(path.join(root, 'alpha', 'subA', 'subA1', 'subA1x')); // depth 4
  writeRoomDir(path.join(root, 'beta'));
  writeRoomDir(path.join(root, 'beta', 'shared'));
  writeRoomDir(path.join(root, 'gamma'));
  writeRoomDir(path.join(root, 'gamma', 'shared'));
  return root;
}

function counts(db) {
  const nodes = db.prepare("SELECT COUNT(*) AS c FROM nodes").get().c;
  const memory = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_artifact'").get().c;
  const edges = db.prepare("SELECT COUNT(*) AS c FROM edges").get().c;
  return { nodes, memory, edges };
}

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'phase-195-recdb-')), 'room.db');
}

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('  ok   ' + name + '\n'); }
  catch (e) { failures++; process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n'); }
}

// --- Test 0: module exports ---
check('reconcile-memory-runner exports the reconcile + discovery seam', () => {
  assert.equal(typeof runner.reconcileMemoryArtifacts, 'function');
  assert.equal(typeof runner.discoverMemoryFiles, 'function');
});

// --- Test 1: the shared depth-3 fixture is walked to depth 3 inclusive ---
check('discoverMemoryFiles recurses the shared fixture to depth-3 (section-alpha/sub-room/sub-sub-room)', () => {
  assert.ok(fs.existsSync(SHARED_FIXTURE), 'shared fixture present: ' + SHARED_FIXTURE);
  const found = runner.discoverMemoryFiles(SHARED_FIXTURE);
  const sections = new Set(found.map((f) => f.section));
  // depth 1, 2, 3 sub-rooms all appear, with depth-qualified path keys.
  assert.ok(sections.has('section-alpha'), 'depth-1 section-alpha discovered');
  assert.ok(sections.has('section-alpha/sub-room'), 'depth-2 sub-room discovered (path-qualified)');
  assert.ok(sections.has('section-alpha/sub-room/sub-sub-room'), 'depth-3 sub-sub-room discovered (path-qualified)');
  // Every discovered entry is a real memory kind at a real path.
  for (const f of found) {
    assert.ok(['ROOM', 'STATE', 'MINTO', 'BRAIN', 'FEYNMAN', 'USER', 'DRIFT'].indexOf(f.kind) !== -1, 'kind ' + f.kind);
    assert.ok(f.path.indexOf(String.fromCharCode(0)) === -1);
  }
});

// --- Test 2: a depth-4 dir is discovered by its parent but NOT projected ---
check('a depth-4 ROOM.md-bearing dir is NOT scanned and NOT projected (DEPTH_CAP inclusive at 3)', () => {
  const root = buildFractal();
  try {
    const found = runner.discoverMemoryFiles(root);
    const sections = new Set(found.map((f) => f.section));
    assert.ok(sections.has('alpha/subA/subA1'), 'depth-3 subA1 IS projected (inclusive cap)');
    assert.ok(!sections.has('alpha/subA/subA1/subA1x'), 'depth-4 subA1x must NOT be projected');
    // No discovered file path may reach into the depth-4 dir.
    assert.ok(!found.some((f) => f.path.indexOf('subA1x') !== -1), 'no depth-4 file discovered');
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 3: pass-1 projects every file; pass-2 is idempotent ({upserted:0}) ---
check('pass-1 projects N memory_artifact nodes; pass-2 returns {upserted:0} and identical node+edge counts', () => {
  const root = buildFractal();
  const dbPath = tempDbPath();
  let db;
  try {
    db = new DatabaseSync(dbPath);
    applySchema(db);

    const files = runner.discoverMemoryFiles(root);
    const distinctFiles = new Set(files.map((f) => f.section + '::' + f.kind)).size;
    assert.equal(files.length, 16, 'expected 16 discovered memory files (8 dirs x 2); got ' + files.length);
    assert.equal(distinctFiles, 16, 'each (section,kind) is distinct; got ' + distinctFiles);

    const r1 = runner.reconcileMemoryArtifacts(root, { db: db });
    const c1 = counts(db);
    assert.equal(c1.memory, 16, 'pass-1 projects 16 memory_artifact nodes; got ' + c1.memory);
    // Test 4/5: distinct-file count === node count (no id collision, no cross-room
    // NESTED_WITHIN aggregation adding phantom nodes).
    assert.equal(c1.memory, files.length, 'node count === discovered file count (no collision, entry-23 clean)');
    assert.ok(r1.upserted >= 16, 'pass-1 upserted the new nodes; got ' + r1.upserted);

    const r2 = runner.reconcileMemoryArtifacts(root, { db: db });
    const c2 = counts(db);
    assert.equal(r2.upserted, 0, 'pass-2 must upsert nothing (idempotent); got ' + r2.upserted);
    assert.deepEqual(c2, c1, 'pass-2 leaves node AND edge counts byte-identical. c1=' +
      JSON.stringify(c1) + ' c2=' + JSON.stringify(c2));

    db.close();
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 4: two sub-rooms sharing a bare slug get DISTINCT depth-qualified ids ---
check('two sub-rooms sharing the bare slug "shared" project to DISTINCT node ids (Pitfall 2)', () => {
  const root = buildFractal();
  const dbPath = tempDbPath();
  let db;
  try {
    db = new DatabaseSync(dbPath);
    applySchema(db);
    runner.reconcileMemoryArtifacts(root, { db: db });

    const betaShared = 'memory_artifact:beta/shared:ROOM';
    const gammaShared = 'memory_artifact:gamma/shared:ROOM';
    const b = db.prepare('SELECT id FROM nodes WHERE id = ?').get(betaShared);
    const g = db.prepare('SELECT id FROM nodes WHERE id = ?').get(gammaShared);
    assert.ok(b, 'beta/shared ROOM node exists: ' + betaShared);
    assert.ok(g, 'gamma/shared ROOM node exists: ' + gammaShared);
    assert.notEqual(b.id, g.id, 'the two "shared" sub-rooms must not collide on a node id');

    db.close();
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 5: no em-dash / en-dash in the runner (CLAUDE.md HARD RULE) ---
check('reconcile-memory-runner.cjs contains no em-dash or en-dash codepoint', () => {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.equal(src.indexOf(String.fromCharCode(0x2014)), -1, 'no em-dash');
  assert.equal(src.indexOf(String.fromCharCode(0x2013)), -1, 'no en-dash');
});

if (failures > 0) {
  process.stdout.write('\ntest-195-recursive-reconcile.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-195-recursive-reconcile.cjs: all assertions passed\n');
process.stdout.write('>>> test-195-recursive-reconcile.cjs: PASSED\n');
process.exit(0);
