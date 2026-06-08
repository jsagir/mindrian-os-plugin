'use strict';
// Phase 149-02 (Canon Part 9 invariant) -- the reconcile reads room DATA ONLY
// via navigation.cjs.
// ========================================================================
// Adversarial structural sweep over lib/core/planning/reconcile-runner.cjs.
// Asserts:
//   (1) No brain-client / http / https require anywhere -- the reconcile is
//       LOCAL-only per Canon Part 8 + Part 9 (GAM-06 / Part-8 floor).
//   (2) No fetch( / http.request( / https.request( / http.get( call sites --
//       network surface is structurally absent.
//   (3) The reconcile requires lib/core/navigation.cjs (proves the sweep scans
//       the right file AND that node/edge writes route through the chokepoint).
//   (4) The reconcile does NOT require node:sqlite and does NOT open room.db
//       directly (it takes a caller-owned db handle, like the writers it calls).
//   (5) Under an fs instrument, EVERY fs read the reconcile performs is on the
//       allow-list: the .planning/ markdown it is ALLOWED to read for
//       classification + requirement-id parsing (the SOURCE-OF-MEANING read --
//       NOT a room-data bypass), plus the room.db family. Room DATA still flows
//       ONLY through navigation.cjs; the markdown read derives generic handles
//       (phase id, artifact_type, requirement id, path), never room state.
//
// THE KEY DISTINCTION (documented per the plan): the reconcile legitimately
// reads the planning markdown to classify artifacts and parse requirement ids.
// That is the source-of-meaning read (Canon Part 9 role 1: Files preserve
// meaning), NOT a room-data read. Room DATA (nodes, edges, the graph) is read
// and written ONLY through navigation.cjs (Canon Part 9 role 2: SQL remembers
// and navigates). The allow-list below therefore permits the fixture .planning/
// dir AND the room.db family, and asserts zero reads outside that union.
//
// Mirrors tests/test-feynman-timeline-canon-part-9-invariant.cjs (the FILES_TO_SCAN
// forbidden grep sweep) and tests/helpers/fs-instrument.cjs (the install/calls/
// uninstall allow-list helper; reimplemented here with the .planning/ allow-list
// extension the reconcile legitimately needs).
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
  process.stdout.write('SKIP test-149-navigation-only-invariant.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_REL = 'lib/core/planning/reconcile-runner.cjs';
const RUNNER_PATH = path.join(REPO_ROOT, RUNNER_REL);

// ---------- Forbidden patterns (mirror the Phase 124 invariant sweep) ----------

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

// ---------- Schema fixture (full production nodes column set) ----------

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
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-149-navonly-'));
  const phaseDir = path.join(roomDir, '.planning', 'phases', '333-inv');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(
    path.join(phaseDir, '333-SPEC.md'),
    '# Inv Spec\n\n## Requirements\n\n1. **INV-01**: one\n',
    'utf8'
  );
  fs.writeFileSync(path.join(phaseDir, '333-CONTEXT.md'), '# Inv Context\n\nBody.\n', 'utf8');
  fs.writeFileSync(
    path.join(phaseDir, '333-01-PLAN.md'),
    '---\nphase: 333-inv\nplan: 01\nrequirements: [INV-01]\n---\n\n# Inv Plan\n',
    'utf8'
  );
  return roomDir;
}

// ---------- fs instrument (mirror of tests/helpers/fs-instrument.cjs with an
//            extended allow-list: room.db family + the fixture .planning/ dir) ----------

const WRAPPED_METHODS = [
  'readFile', 'readFileSync', 'open', 'openSync', 'createReadStream',
  'readdir', 'readdirSync', 'stat', 'statSync', 'lstat', 'lstatSync',
];

function makeInstrument(planningRoot) {
  const ROOM_DB_PATTERNS = [
    /\.mindrian\/room\.db$/,
    /\.mindrian\/room\.db-wal$/,
    /\.mindrian\/room\.db-shm$/,
    /\.mindrian\/room\.db-journal$/,
  ];
  const planningAbs = path.resolve(planningRoot);
  const state = { calls: [], originals: {}, installed: false };

  function isAllowed(target) {
    if (typeof target !== 'string') return false;
    const abs = path.resolve(target);
    if (ROOM_DB_PATTERNS.some((rx) => rx.test(abs))) return true;
    // The source-of-meaning read: anything under the fixture .planning/ tree.
    if (abs === planningAbs) return true;
    if (abs.indexOf(planningAbs + path.sep) === 0) return true;
    return false;
  }

  function install() {
    if (state.installed) throw new Error('install called twice');
    state.calls.length = 0;
    WRAPPED_METHODS.forEach((name) => {
      const original = fs[name];
      state.originals[name] = original;
      fs[name] = function instrumented(...args) {
        const target = args[0];
        if (!isAllowed(target)) {
          state.calls.push({
            method: name,
            target: typeof target === 'string' ? target : String(target),
          });
        }
        return original.apply(fs, args);
      };
    });
    state.installed = true;
  }

  function uninstall() {
    if (!state.installed) return;
    WRAPPED_METHODS.forEach((name) => {
      if (state.originals[name]) {
        fs[name] = state.originals[name];
        delete state.originals[name];
      }
    });
    state.installed = false;
  }

  return { install, uninstall, calls: () => state.calls.slice(), isAllowed };
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

// --- Test 1 + 2: forbidden require + call grep sweep over the reconcile source ---
check('reconcile-runner.cjs has no forbidden require (brain-client / http / https / sqlite / room-db)', () => {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  for (const rx of FORBIDDEN_REQUIRES) {
    assert.equal(rx.test(src), false, RUNNER_REL + ' must not match forbidden require: ' + rx);
  }
});

check('reconcile-runner.cjs has no forbidden call (fetch / http.* / openRoomDb / openGraph)', () => {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  for (const rx of FORBIDDEN_CALLS) {
    assert.equal(rx.test(src), false, RUNNER_REL + ' must not match forbidden call: ' + rx);
  }
});

// --- Test 3: the reconcile requires navigation.cjs (the chokepoint) ---
check('reconcile-runner.cjs requires lib/core/navigation.cjs (the Phase 109 chokepoint)', () => {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.match(
    src,
    /require\s*\(\s*['"][^'"]*navigation\.cjs['"]\s*\)/,
    'reconcile must require navigation.cjs (route node/edge writes through the chokepoint)'
  );
});

// --- Test 4: under the fs instrument, every read is allow-listed ---
check('every fs read during reconcile is allow-listed (.planning/ markdown + room.db family)', () => {
  const roomDir = buildFixture();
  const instrument = makeInstrument(path.join(roomDir, '.planning'));
  try {
    const db = new DatabaseSync(':memory:');
    applySchema(db);
    const runner = require(RUNNER_PATH);

    instrument.install();
    let disallowed = [];
    try {
      runner.reconcilePlanningArtifacts(roomDir, { db: db });
      disallowed = instrument.calls();
    } finally {
      instrument.uninstall();
    }

    // The fixture roomDir itself + any descendant under .planning is allowed; the
    // reconcile may also stat the roomDir to resolve the planning dir, so permit
    // the roomDir path and the .planning subtree. Reads outside that union are a
    // room-data bypass and must be zero.
    const planningAbs = path.resolve(path.join(roomDir, '.planning'));
    const roomAbs = path.resolve(roomDir);
    const realDisallowed = disallowed.filter((c) => {
      const abs = path.resolve(c.target);
      if (abs === roomAbs) return false;            // resolving the planning dir root
      if (abs === planningAbs) return false;
      if (abs.indexOf(planningAbs + path.sep) === 0) return false;
      return true;
    });
    assert.equal(
      realDisallowed.length, 0,
      'reconcile must read room DATA only via navigation.cjs; disallowed reads: ' +
        JSON.stringify(realDisallowed.slice(0, 8))
    );

    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
  }
});

if (failures > 0) {
  process.stdout.write('\ntest-149-navigation-only-invariant.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-149-navigation-only-invariant.cjs: all assertions passed\n');
process.exit(0);
