'use strict';
// Phase 150-03 (MEM-01) -- the idempotent cortex reconcile.
// ========================================================================
// Asserts:
//   (1) reconcileMemoryArtifacts over a fixture room tree with several section
//       folders -- each carrying one or more per-folder memory MD files
//       (ROOM.md / STATE.md / MINTO.md / BRAIN.md / FEYNMAN.md / USER.md) --
//       projects EVERY discovered memory MD as a typed memory_artifact node,
//       classifies the kinds correctly, and lands the governing_thought /
//       navigator_persona / decision projection nodes where the content
//       warrants (MINTO governing-thought, USER role_blend x journey_stage,
//       MINTO/decisions decision_log).
//   (2) Running reconcileMemoryArtifacts AGAIN over the UNCHANGED tree leaves
//       the node count AND the edge count byte-identical to the first pass --
//       backfill and sync are the same idempotent code path (D-02 / MEM-01).
//       This is the load-bearing invariant: every write is an upsert keyed on
//       a stable node/edge id (the 150-01 contract), so a second pass changes
//       no counts (threat T-150-03-03).
//   (3) NAVIGATION-ONLY ARM: a forbidden-require + forbidden-call grep sweep
//       over lib/core/memory/reconcile-memory-runner.cjs asserts no
//       brain-client / http / https require and no fetch / http.request /
//       https.request call. The memory MD prose read for classification is the
//       source-of-meaning LOCAL read (allow-listed); room DATA writes flow only
//       through navigation.cjs (threat T-150-03-01 / Canon Part 8 + Part 9).
//
// The reconcile reads the memory MD prose LOCALLY to classify + derive generic
// handles (kind, section, governing-thought sha256, persona enum, decision id),
// then writes ONLY via navigation.cjs (the 150-01 writers).
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) and the
// applySchema(db) fixture from tests/test-149-backfill.cjs +
// tests/test-149-navigation-only-invariant.cjs. Per the plan this suite uses a
// temp-FILE DatabaseSync (not :memory:) so the two-pass idempotence assertion
// exercises the on-disk upsert path.
//
// RED-by-design until Task 2 lands lib/core/memory/reconcile-memory-runner.cjs.
//
// Any asserted forbidden dash codepoint is referenced via String.fromCharCode so
// THIS file stays greppably clean. NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-150-reconcile.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_REL = 'lib/core/memory/reconcile-memory-runner.cjs';
const RUNNER_PATH = path.join(REPO_ROOT, RUNNER_REL);

// ---------- Schema fixture (full production nodes + edges column set) ----------

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

// ---------- Fixture room tree ----------
//
// Three section folders, each carrying a different mix of the six memory MD
// kinds:
//   problem-definition/  ROOM.md + STATE.md + MINTO.md (governing thought) + USER.md (role_blend + journey_stage)
//   market-analysis/     MINTO.md (governing thought + decision_log) + BRAIN.md (derivation)
//   solution-design/     FEYNMAN.md + ROOM.md
//
// Total memory MD files: 9. classifyMemoryFile must map each to its kind; any
// other file (notes.md, an artifact folder file) must classify to null and NOT
// produce a node.
function buildFixture() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-reconcile-'));

  const pd = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(pd, { recursive: true });
  fs.writeFileSync(path.join(pd, 'ROOM.md'), '# Problem Definition\n\nIdentity prose.\n', 'utf8');
  fs.writeFileSync(path.join(pd, 'STATE.md'), '---\nstatus: active\n---\n\n## Decisions\n\n(none yet)\n', 'utf8');
  fs.writeFileSync(
    path.join(pd, 'MINTO.md'),
    '---\ngoverning_thought: "The wicked navigator needs a map not a solver"\n---\n\n## Governing Thought\n\nThe wicked navigator needs a map not a solver.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(pd, 'USER.md'),
    '---\ncanonical_role: founder\njourney_stage: crossing-the-threshold\nrole_blend:\n  founder: 0.6\n  researcher: 0.4\n  operator: 0\n---\n\nPersona prose.\n',
    'utf8'
  );
  // A non-memory file in the same folder -- must NOT produce a node.
  fs.writeFileSync(path.join(pd, 'notes.md'), '# Scratch notes\n', 'utf8');

  const ma = path.join(roomDir, 'market-analysis');
  fs.mkdirSync(ma, { recursive: true });
  fs.writeFileSync(
    path.join(ma, 'MINTO.md'),
    '---\ngoverning_thought: "The TAM is large but fragmented"\n---\n\n## Decisions\n\n- DEC-001: pursue the enterprise wedge first\n- DEC-002: defer the SMB tier\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(ma, 'BRAIN.md'),
    '---\nbrain_offline: false\n---\n\n## Derivation\n\nFramework chain: SWOT then Porter.\n',
    'utf8'
  );

  const sd = path.join(roomDir, 'solution-design');
  fs.mkdirSync(sd, { recursive: true });
  fs.writeFileSync(path.join(sd, 'FEYNMAN.md'), '# Solution Design\n\nFeynman prose.\n', 'utf8');
  fs.writeFileSync(path.join(sd, 'ROOM.md'), '# Solution Design\n\nIdentity prose.\n', 'utf8');

  return roomDir;
}

// ---------- Count helpers ----------

function counts(db) {
  const nodes = db.prepare("SELECT COUNT(*) AS c FROM nodes").get().c;
  const memory = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_artifact'").get().c;
  const govt = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'governing_thought'").get().c;
  const persona = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'navigator_persona'").get().c;
  const decisions = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'decision'").get().c;
  const edges = db.prepare("SELECT COUNT(*) AS c FROM edges").get().c;
  return { nodes, memory, govt, persona, decisions, edges };
}

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-recdb-')), 'room.db');
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

let runner = null;
try {
  runner = require(RUNNER_PATH);
} catch (_e) {
  runner = null;
}

// --- Test 0: the runner module exists (RED until Task 2) ---
check('reconcile-memory-runner.cjs is requireable and exports reconcileMemoryArtifacts', () => {
  assert.ok(runner, RUNNER_REL + ' must be requireable (RED until Task 2 lands it)');
  assert.equal(typeof runner.reconcileMemoryArtifacts, 'function', 'reconcileMemoryArtifacts must be a function');
  assert.equal(typeof runner.classifyMemoryFile, 'function', 'classifyMemoryFile must be a function');
  assert.equal(typeof runner.discoverMemoryFiles, 'function', 'discoverMemoryFiles must be a function');
});

// --- Test 1: classifyMemoryFile maps the six basenames, null otherwise ---
check('classifyMemoryFile maps the six memory basenames and returns null for others', () => {
  assert.ok(runner, 'runner required');
  assert.equal(runner.classifyMemoryFile('ROOM.md'), 'ROOM');
  assert.equal(runner.classifyMemoryFile('STATE.md'), 'STATE');
  assert.equal(runner.classifyMemoryFile('MINTO.md'), 'MINTO');
  assert.equal(runner.classifyMemoryFile('BRAIN.md'), 'BRAIN');
  assert.equal(runner.classifyMemoryFile('FEYNMAN.md'), 'FEYNMAN');
  assert.equal(runner.classifyMemoryFile('USER.md'), 'USER');
  // Path-prefixed basename still classifies on basename.
  assert.equal(runner.classifyMemoryFile('/x/problem-definition/STATE.md'), 'STATE');
  // Non-memory files classify to null.
  assert.equal(runner.classifyMemoryFile('notes.md'), null);
  assert.equal(runner.classifyMemoryFile('ROADMAP.md'), null);
  assert.equal(runner.classifyMemoryFile(''), null);
  assert.equal(runner.classifyMemoryFile('state.md'), null, 'classification is case-exact');
});

// --- Test 2: discoverMemoryFiles finds every classified memory MD ---
check('discoverMemoryFiles returns one entry per classified memory MD across section folders', () => {
  assert.ok(runner, 'runner required');
  const roomDir = buildFixture();
  try {
    const found = runner.discoverMemoryFiles(roomDir);
    assert.ok(Array.isArray(found), 'discoverMemoryFiles returns an array');
    // 9 memory MD files across the three section folders (notes.md excluded).
    assert.equal(found.length, 9, 'expected 9 discovered memory files; got ' + found.length);
    // Every entry carries section + kind + path.
    for (const f of found) {
      assert.equal(typeof f.section, 'string');
      assert.ok(f.section.length > 0);
      assert.ok(['ROOM', 'STATE', 'MINTO', 'BRAIN', 'FEYNMAN', 'USER'].indexOf(f.kind) !== -1, 'bad kind ' + f.kind);
      assert.equal(typeof f.path, 'string');
    }
    // No notes.md leaked in.
    assert.ok(!found.some((f) => path.basename(f.path) === 'notes.md'), 'notes.md must not be discovered');
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 3: first reconcile projects every memory MD + the typed projections ---
check('first reconcile projects every memory MD as a memory_artifact node + governing/persona/decision projections', () => {
  assert.ok(runner, 'runner required');
  const roomDir = buildFixture();
  const dbPath = tempDbPath();
  let db;
  try {
    db = new DatabaseSync(dbPath);
    applySchema(db);
    const report = runner.reconcileMemoryArtifacts(roomDir, { db: db });
    assert.ok(report && typeof report === 'object', 'reconcile returns a report');

    const c = counts(db);
    // 9 memory_artifact nodes -- one per discovered memory MD.
    assert.equal(c.memory, 9, 'expected 9 memory_artifact nodes; got ' + c.memory);
    // 2 governing_thought nodes -- problem-definition MINTO + market-analysis MINTO.
    assert.equal(c.govt, 2, 'expected 2 governing_thought nodes; got ' + c.govt);
    // 1 navigator_persona node -- USER.md is one file (one persona per room).
    assert.equal(c.persona, 1, 'expected 1 navigator_persona node; got ' + c.persona);
    // 2 decision nodes -- DEC-001, DEC-002 from the market-analysis MINTO decision_log.
    assert.equal(c.decisions, 2, 'expected 2 decision nodes; got ' + c.decisions);

    // Decision nodes are TRUTH-CLAIM nodes -- never auto-confirmed (Canon Part 9 role 5).
    const confirmedDecisions = db.prepare(
      "SELECT COUNT(*) AS c FROM nodes WHERE type = 'decision' AND review_status = 'confirmed'"
    ).get().c;
    assert.equal(confirmedDecisions, 0, 'decision nodes must mint at proposed, never confirmed');
    const proposedDecisions = db.prepare(
      "SELECT COUNT(*) AS c FROM nodes WHERE type = 'decision' AND review_status = 'proposed'"
    ).get().c;
    assert.equal(proposedDecisions, 2, 'both decision nodes must be proposed');

    // The system-bookkeeping projections are confirmed (audit-node carve-out).
    const confirmedBookkeeping = db.prepare(
      "SELECT COUNT(*) AS c FROM nodes WHERE type IN ('memory_artifact','governing_thought','navigator_persona') AND review_status = 'confirmed'"
    ).get().c;
    assert.equal(confirmedBookkeeping, 12, 'memory_artifact + governing_thought + persona are system-confirmed; got ' + confirmedBookkeeping);

    // Lineage edges land (governing_thought STATES section, decision INFORMS section, persona DESCRIBES room).
    assert.ok(c.edges > 0, 'expected cortex lineage edges; got ' + c.edges);

    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 4: second reconcile over the unchanged tree changes no counts ---
check('second reconcile over the unchanged room leaves node AND edge counts identical (idempotent)', () => {
  assert.ok(runner, 'runner required');
  const roomDir = buildFixture();
  const dbPath = tempDbPath();
  let db;
  try {
    db = new DatabaseSync(dbPath);
    applySchema(db);
    runner.reconcileMemoryArtifacts(roomDir, { db: db });
    const first = counts(db);
    runner.reconcileMemoryArtifacts(roomDir, { db: db });
    const second = counts(db);
    assert.deepEqual(second, first, 'idempotence: second pass must not change counts. first=' +
      JSON.stringify(first) + ' second=' + JSON.stringify(second));
    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch (_) {}
  }
});

// --- Test 5 (navigation-only arm): no forbidden require / call in the runner ---
const FORBIDDEN_REQUIRES = [
  /require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/,
  /require\s*\(\s*['"]node:http['"]\s*\)/,
  /require\s*\(\s*['"]node:https['"]\s*\)/,
  /require\s*\(\s*['"]http['"]\s*\)/,
  /require\s*\(\s*['"]https['"]\s*\)/,
  /require\s*\(\s*['"]node:sqlite['"]\s*\)/,
  /require\s*\(\s*['"][^'"]*room-db[^'"]*['"]\s*\)/,
];
const FORBIDDEN_CALLS = [
  /\bfetch\s*\(/,
  /\bhttp\.request\s*\(/,
  /\bhttps\.request\s*\(/,
  /\bhttp\.get\s*\(/,
  /\bhttps\.get\s*\(/,
  /\bopenRoomDb\s*\(/,
  /\bopenGraph\s*\(/,
];

check('reconcile-memory-runner.cjs has no forbidden require (brain-client / http / https / sqlite / room-db)', () => {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  for (const rx of FORBIDDEN_REQUIRES) {
    assert.equal(rx.test(src), false, RUNNER_REL + ' must not match forbidden require: ' + rx);
  }
});

check('reconcile-memory-runner.cjs has no forbidden call (fetch / http.* / openRoomDb / openGraph)', () => {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  for (const rx of FORBIDDEN_CALLS) {
    assert.equal(rx.test(src), false, RUNNER_REL + ' must not match forbidden call: ' + rx);
  }
});

check('reconcile-memory-runner.cjs requires lib/core/navigation.cjs (the Phase 109 chokepoint)', () => {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.match(
    src,
    /require\s*\(\s*['"][^'"]*navigation\.cjs['"]\s*\)/,
    'reconcile must require navigation.cjs (route node/edge writes through the chokepoint)'
  );
});

check('reconcile-memory-runner.cjs contains no em-dash or en-dash codepoint', () => {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  const EM_DASH = String.fromCharCode(0x2014);
  const EN_DASH = String.fromCharCode(0x2013);
  assert.equal(src.indexOf(EM_DASH), -1, 'runner must contain no em-dash');
  assert.equal(src.indexOf(EN_DASH), -1, 'runner must contain no en-dash');
});

if (failures > 0) {
  process.stdout.write('\ntest-150-reconcile.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-150-reconcile.cjs: all assertions passed\n');
process.exit(0);
