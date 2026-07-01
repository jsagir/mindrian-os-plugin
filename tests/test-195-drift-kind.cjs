'use strict';
/*
 * Phase 195-02 Wave 1 -- FCM-07 DRIFT.md as the 7th memory kind (CODE only).
 * =========================================================================
 * DRIFT lands in code now so the navigator-gated canon 6->7 amendment (FCM-08,
 * Wave 5) ratifies an already-wired basename. This suite asserts:
 *
 *   (1) classifyMemoryFile('DRIFT.md') === 'DRIFT' -- DRIFT is a member of
 *       BASENAME_TO_KIND (classifyMemoryFile reads the map generically).
 *   (2) A DRIFT.md in a section folder projects a memory_artifact node (born
 *       wired: the writer's accepted-kind set includes DRIFT, Part 11 R1/R2).
 *   (3) readSextuple returns the five prior readQuintuple fields BYTE-IDENTICAL
 *       plus a sixth `drift` field (purely additive), sync and async in parity.
 *   (4) No memory_artifact node is ever sourced from a `.planning/...DRIFT.md`
 *       path -- the per-folder memory-kind DRIFT.md is DISTINCT from the
 *       Phase-150.9 .planning/DRIFT.md audit baseline (Pitfall 5 / HARD).
 *   (5) NO canon bytes this wave: docs/MINDRIAN-CANON.md still carries no
 *       'DRIFT.md' (the amendment is GATED, Wave 5).
 *
 * node:sqlite SKIP-on-unavailable guard (exit 77) mirrors test-150-reconcile.cjs.
 * House rule: hyphens only, no em-dashes (asserted forbidden dash codepoints are
 * referenced via String.fromCharCode so THIS file stays greppably clean).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-195-drift-kind.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'memory', 'reconcile-memory-runner.cjs');
const SYNC_PATH = path.join(REPO_ROOT, 'lib', 'core', 'folder-memory.cjs');
const ASYNC_PATH = path.join(REPO_ROOT, 'lib', 'core', 'folder-memory-async.cjs');
const MEMART_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-artifacts.cjs');
const CANON_PATH = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');

const runner = require(RUNNER_PATH);
const sync = require(SYNC_PATH);
const asyncMod = require(ASYNC_PATH);

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

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('  ok   ' + name + '\n'); }
  catch (e) { failures++; process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n'); }
}

// --- Test 1: classifyMemoryFile maps DRIFT.md -> DRIFT ---
check('classifyMemoryFile("DRIFT.md") === "DRIFT" (DRIFT is a BASENAME_TO_KIND member)', () => {
  assert.equal(runner.classifyMemoryFile('DRIFT.md'), 'DRIFT');
  // basename match holds through a path prefix, and stays case-exact.
  assert.equal(runner.classifyMemoryFile('/x/problem-definition/DRIFT.md'), 'DRIFT');
  assert.equal(runner.classifyMemoryFile('drift.md'), null, 'classification is case-exact');
  // The prior six kinds are untouched (additive).
  for (const b of ['ROOM.md', 'STATE.md', 'MINTO.md', 'BRAIN.md', 'FEYNMAN.md', 'USER.md']) {
    assert.ok(runner.classifyMemoryFile(b), b + ' still classifies');
  }
  // Source-level proof of the registration line.
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.match(src, /['"]DRIFT\.md['"]\s*:\s*['"]DRIFT['"]/, 'BASENAME_TO_KIND carries the DRIFT.md entry');
});

// --- Test 2: a DRIFT.md in a section folder projects a memory_artifact node ---
check('a DRIFT.md in a section folder projects a memory_artifact node (born wired)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-195-drift-'));
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-195-driftdb-'));
  const dbPath = path.join(dbDir, 'room.db');
  let db;
  try {
    // A room with one section carrying a DRIFT.md (plus a ROOM.md identity file).
    fs.writeFileSync(path.join(root, 'ROOM.md'), '# Root\n\nIdentity.\n', 'utf8');
    const sec = path.join(root, 'problem-definition');
    fs.mkdirSync(sec, { recursive: true });
    fs.writeFileSync(path.join(sec, 'ROOM.md'), '# Problem Definition\n\nIdentity.\n', 'utf8');
    fs.writeFileSync(path.join(sec, 'DRIFT.md'), '# Drift Ledger\n\nintent: X\nactual: Y\n', 'utf8');

    db = new DatabaseSync(dbPath);
    applySchema(db);
    runner.reconcileMemoryArtifacts(root, { db: db });

    const nodeId = 'memory_artifact:problem-definition:DRIFT';
    const row = db.prepare('SELECT id, properties FROM nodes WHERE id = ?').get(nodeId);
    assert.ok(row, 'DRIFT memory_artifact node projected: ' + nodeId);
    const props = JSON.parse(row.properties);
    assert.equal(props.kind, 'DRIFT', 'node kind is DRIFT');
    db.close();
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 3: readSextuple is additive over readQuintuple (sync) ---
check('readSextuple returns the five readQuintuple fields byte-identical + a drift field (sync)', () => {
  const sec = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-195-sextuple-'));
  try {
    fs.writeFileSync(path.join(sec, 'ROOM.md'), '# Room\n\nprose\n', 'utf8');
    fs.writeFileSync(path.join(sec, 'STATE.md'), '---\nstatus: active\n---\n\nstate\n', 'utf8');
    fs.writeFileSync(path.join(sec, 'MINTO.md'), '---\ngoverning_thought: "gt"\n---\n\n## Governing Thought\n\ngt.\n', 'utf8');
    fs.writeFileSync(path.join(sec, 'BRAIN.md'), '---\nbrain_offline: false\n---\n\n## Derivation\n\nSWOT.\n', 'utf8');
    fs.writeFileSync(path.join(sec, 'FEYNMAN.md'), '# Feynman\n\nhuman body\n', 'utf8');
    const driftBody = '# Drift\n\nintent vs actual\n';
    fs.writeFileSync(path.join(sec, 'DRIFT.md'), driftBody, 'utf8');

    const quint = sync.readQuintuple(sec);
    const sext = sync.readSextuple(sec);
    // The five prior fields are byte-identical (additive contract).
    assert.deepEqual(
      { room: sext.room, state: sext.state, reasoning: sext.reasoning, brain: sext.brain, feynman: sext.feynman },
      { room: quint.room, state: quint.state, reasoning: quint.reasoning, brain: quint.brain, feynman: quint.feynman },
      'the first five fields must equal readQuintuple byte-for-byte'
    );
    // The sixth field carries the LOCAL DRIFT.md body.
    assert.ok(Object.prototype.hasOwnProperty.call(sext, 'drift'), 'sextuple carries a drift key');
    assert.equal(sext.drift, driftBody.trim(), 'drift field is the trimmed DRIFT.md body');

    // Absent DRIFT.md degrades to empty string (graceful).
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-195-nodrift-'));
    try {
      fs.writeFileSync(path.join(bare, 'ROOM.md'), '# Room\n', 'utf8');
      assert.equal(sync.readSextuple(bare).drift, '', 'absent DRIFT.md -> empty drift');
    } finally { try { fs.rmSync(bare, { recursive: true, force: true }); } catch (_) {} }
  } finally {
    try { fs.rmSync(sec, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 5: NO node is ever sourced from a .planning/...DRIFT.md path ---
check('the reconciler never sources a memory_artifact node from a .planning/...DRIFT.md path (Pitfall 5)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-195-planning-'));
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-195-planningdb-'));
  const dbPath = path.join(dbDir, 'room.db');
  let db;
  try {
    fs.writeFileSync(path.join(root, 'ROOM.md'), '# Root\n', 'utf8');
    // A .planning/ tree with its OWN DRIFT.md audit baseline -- must NEVER be a
    // memory source. discoverSections skips hidden dirs; the reconciler adds a
    // belt-and-suspenders dot guard.
    const planning = path.join(root, '.planning');
    fs.mkdirSync(path.join(planning, 'phases', '99'), { recursive: true });
    fs.writeFileSync(path.join(planning, 'DRIFT.md'), '# planning audit drift\n', 'utf8');
    fs.writeFileSync(path.join(planning, 'phases', '99', 'DRIFT.md'), '# per-phase audit drift\n', 'utf8');

    // discoverMemoryFiles must not surface any .planning path.
    const found = runner.discoverMemoryFiles(root);
    assert.ok(!found.some((f) => f.path.indexOf('.planning') !== -1), 'no .planning file discovered');

    db = new DatabaseSync(dbPath);
    applySchema(db);
    runner.reconcileMemoryArtifacts(root, { db: db });
    // No memory_artifact node may carry a .planning path in its properties, nor a
    // .planning section key in its id.
    const rows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'memory_artifact'").all();
    for (const row of rows) {
      assert.ok(row.id.indexOf('.planning') === -1, 'no node id references .planning: ' + row.id);
      assert.ok(String(row.properties).indexOf('.planning') === -1, 'no node props reference .planning');
    }
    db.close();
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 6: NO canon bytes written this wave ---
check('docs/MINDRIAN-CANON.md still carries NO DRIFT.md (canon 6->7 amendment is GATED, Wave 5)', () => {
  const canon = fs.readFileSync(CANON_PATH, 'utf8');
  assert.equal(canon.indexOf('DRIFT.md'), -1, 'no canon byte written for DRIFT this wave');
});

// --- Test 7: no em-dash / en-dash in the modified code files ---
check('modified code files contain no em-dash or en-dash codepoint', () => {
  const EM = String.fromCharCode(0x2014);
  const EN = String.fromCharCode(0x2013);
  for (const p of [RUNNER_PATH, SYNC_PATH, ASYNC_PATH, MEMART_PATH]) {
    const src = fs.readFileSync(p, 'utf8');
    assert.equal(src.indexOf(EM), -1, 'no em-dash in ' + path.basename(p));
    assert.equal(src.indexOf(EN), -1, 'no en-dash in ' + path.basename(p));
  }
});

// --- Test 4 (async): sync/async readSextuple parity -- awaited explicitly ---
async function checkAsyncParity() {
  try {
    assert.equal(typeof sync.readSextuple, 'function', 'sync readSextuple exported');
    assert.equal(typeof asyncMod.readSextuple, 'function', 'async readSextuple exported');
    assert.equal(asyncMod.readSextuple.constructor.name, 'AsyncFunction', 'async readSextuple is an AsyncFunction');
    const sextKeys = ['room', 'state', 'reasoning', 'brain', 'feynman', 'drift'].slice().sort();
    const s = sync.readSextuple(REPO_ROOT); // any dir; shape is stable even when empty
    assert.deepEqual(Object.keys(s).sort(), sextKeys, 'sync sextuple key-set');
    const a = await asyncMod.readSextuple(REPO_ROOT);
    assert.deepEqual(Object.keys(a).sort(), Object.keys(s).sort(), 'sync/async key-set parity');
    process.stdout.write('  ok   readSextuple sync and async are in key-set parity (async twin is AsyncFunction)\n');
  } catch (e) {
    failures++;
    process.stdout.write('  FAIL readSextuple sync/async parity\n       ' + String(e && e.message) + '\n');
  }
}

checkAsyncParity().then(() => {
  if (failures > 0) {
    process.stdout.write('\ntest-195-drift-kind.cjs: ' + failures + ' failure(s)\n');
    process.exit(1);
  }
  process.stdout.write('\ntest-195-drift-kind.cjs: all assertions passed\n');
  process.stdout.write('>>> test-195-drift-kind.cjs: PASSED\n');
  process.exit(0);
});
