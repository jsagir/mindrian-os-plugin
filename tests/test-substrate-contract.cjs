'use strict';
// Phase 128-02 Task 1: the Substrate Contract regression fence (T-128-01).
// Five hermetic cases that assert the ADR's M1-M4 mandates plus the openGraph
// bypass class. Written RED-first (the guard scripts/check-substrate.cjs does
// not exist when this file lands in Task 1; Task 2 turns it GREEN).
//
// Pattern: direct-CJS (node:assert/strict, node:fs, node:os, node:path), zero
// npm deps, mirroring tests/test-navigation-acceptance.cjs structure.
//
// All cases are hermetic: no real git, no real room.db, no network. Each case
// writes a fixture module body to a tmp content dir via fs.mkdtempSync, sets
// process.env.MINDRIAN_HOOK_STAGED_FILES + MINDRIAN_HOOK_STAGED_CONTENT_DIR,
// invokes the guard's exported scan function (NOT a child process, so we can
// assert on the returned violation array), then restores env.
//
// Canon Part 6 (the plugin dog-foods its own substrate contract).
// Canon Part 8 (the guard is LOCAL-only; the Cypher-interpolation case is the breach pattern).
// Canon Part 9 (navigation.cjs is the only door; every bypass is a violation).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs');

// The programmatic scan API the guard MUST export (Task 2 implements it):
//   scanStaged() -> Array<{file, line, rule, match}>
// It reads the MINDRIAN_HOOK_STAGED_FILES + MINDRIAN_HOOK_STAGED_CONTENT_DIR
// seams, so the tests drive it hermetically with fixture bodies.
const guard = require(GUARD_PATH);

let passed = 0;
let failed = 0;
const failures = [];

// runCase: write { relPath: body, ... } fixture files into a fresh tmp content
// dir, point the staged-files + content-dir seams at them, run the guard's
// scanStaged(), return the violation array. Restores env afterwards.
function runCase(files) {
  const prevFiles = process.env.MINDRIAN_HOOK_STAGED_FILES;
  const prevDir = process.env.MINDRIAN_HOOK_STAGED_CONTENT_DIR;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'substrate-case-'));
  try {
    const relPaths = Object.keys(files);
    for (const rel of relPaths) {
      const abs = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, files[rel], 'utf8');
    }
    process.env.MINDRIAN_HOOK_STAGED_FILES = relPaths.join('\n');
    process.env.MINDRIAN_HOOK_STAGED_CONTENT_DIR = tmp;
    return guard.scanStaged();
  } finally {
    if (prevFiles === undefined) delete process.env.MINDRIAN_HOOK_STAGED_FILES;
    else process.env.MINDRIAN_HOOK_STAGED_FILES = prevFiles;
    if (prevDir === undefined) delete process.env.MINDRIAN_HOOK_STAGED_CONTENT_DIR;
    else process.env.MINDRIAN_HOOK_STAGED_CONTENT_DIR = prevDir;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failed++;
    failures.push({ name, message: e && e.message ? e.message : String(e) });
    process.stdout.write('  FAIL ' + name + '\n');
  }
}

function violationsFor(viols, file) {
  return viols.filter((v) => v.file === file);
}

// ---------------------------------------------------------------------------
// Case 1 (known-good): a module body that requires lib/core/navigation.cjs and
// calls writeEdge / logMemoryEvent -> ZERO violations for that file.
// ---------------------------------------------------------------------------
test('Case 1 known-good: navigation.cjs use produces zero violations', () => {
  const body = [
    "'use strict';",
    "const nav = require('../core/navigation.cjs');",
    'async function run(db) {',
    "  await nav.writeEdge(db, 'a', 'b', 'INFORMS', {});",
    "  await nav.logMemoryEvent(db, { type: 'note', detail: 'ok' });",
    '}',
    'module.exports = { run };',
    '',
  ].join('\n');
  const viols = runCase({ 'lib/feature/good-consumer.cjs': body });
  equal(violationsFor(viols, 'lib/feature/good-consumer.cjs').length, 0,
    'compliant navigation.cjs consumer must report zero violations, got ' + JSON.stringify(viols));
});

// ---------------------------------------------------------------------------
// Case 2 (known-bad): a module OUTSIDE navigation.cjs with a direct
// require('node:sqlite') / better-sqlite3 -> violation with file + matched token (M3).
// ---------------------------------------------------------------------------
test('Case 2 known-bad: direct sqlite require flagged (M3)', () => {
  const body = [
    "'use strict';",
    "const { DatabaseSync } = require('node:sqlite');",
    'module.exports = { DatabaseSync };',
    '',
  ].join('\n');
  const file = 'lib/feature/bad-sqlite.cjs';
  const viols = violationsFor(runCase({ [file]: body }), file);
  ok(viols.length >= 1, 'direct node:sqlite require must be flagged, got ' + JSON.stringify(viols));
  ok(viols.some((v) => /sqlite/i.test(v.match)),
    'the matched token must name the sqlite require, got ' + JSON.stringify(viols.map((v) => v.match)));

  // better-sqlite3 variant must also flag.
  const body2 = "'use strict';\nconst db = require('better-sqlite3');\n";
  const file2 = 'scripts/bad-better-sqlite.cjs';
  const viols2 = violationsFor(runCase({ [file2]: body2 }), file2);
  ok(viols2.some((v) => /sqlite/i.test(v.match)),
    'better-sqlite3 require must be flagged, got ' + JSON.stringify(viols2));
});

// ---------------------------------------------------------------------------
// Case 3 (known-bad): a raw fs.readFileSync/readFile of a room.db path OUTSIDE
// navigation.cjs -> violation (M2).
// ---------------------------------------------------------------------------
test('Case 3 known-bad: raw fs read of room.db flagged (M2)', () => {
  const body = [
    "'use strict';",
    "const fs = require('fs');",
    'function loadRaw(roomDir) {',
    "  return fs.readFileSync(roomDir + '/.mindrian/room.db');",
    '}',
    'module.exports = { loadRaw };',
    '',
  ].join('\n');
  const file = 'lib/feature/bad-fs-read.cjs';
  const viols = violationsFor(runCase({ [file]: body }), file);
  ok(viols.length >= 1, 'raw fs read of room.db must be flagged, got ' + JSON.stringify(viols));
  ok(viols.some((v) => /room\.db/i.test(v.match)),
    'the matched token must reference room.db, got ' + JSON.stringify(viols.map((v) => v.match)));
});

// ---------------------------------------------------------------------------
// Case 4 (known-bad): a Cypher MATCH with user-content template-literal
// interpolation -> violation (M4 / Canon Part 8 breach).
// ---------------------------------------------------------------------------
test('Case 4 known-bad: Cypher MATCH with interpolation flagged (M4)', () => {
  const body = [
    "'use strict';",
    'function buildQuery(userBody) {',
    '  return `MATCH (a:Author) WHERE a.note = "${userBody}" RETURN a`;',
    '}',
    'module.exports = { buildQuery };',
    '',
  ].join('\n');
  const file = 'lib/feature/bad-cypher.cjs';
  const viols = violationsFor(runCase({ [file]: body }), file);
  ok(viols.length >= 1, 'Cypher MATCH with ${...} interpolation must be flagged, got ' + JSON.stringify(viols));
  ok(viols.some((v) => /MATCH/i.test(v.match)),
    'the matched token must name the MATCH clause, got ' + JSON.stringify(viols.map((v) => v.match)));
});

// ---------------------------------------------------------------------------
// Case 5 (known-good): an Aura read using PARAMETERIZED binding
// (MATCH ... WHERE x = $param, params object) -> ZERO violations.
// ---------------------------------------------------------------------------
test('Case 5 known-good: parameterized Cypher produces zero violations', () => {
  const body = [
    "'use strict';",
    'async function readAuthor(session, frameworkName) {',
    "  const q = 'MATCH (a:Author) WHERE a.name = $name RETURN a';",
    '  return session.run(q, { name: frameworkName });',
    '}',
    'module.exports = { readAuthor };',
    '',
  ].join('\n');
  const file = 'lib/feature/good-cypher.cjs';
  const viols = violationsFor(runCase({ [file]: body }), file);
  equal(viols.length, 0,
    'parameterized Cypher ($param) must report zero violations, got ' + JSON.stringify(viols));
});

// ---------------------------------------------------------------------------
// Case 5b (m4 precision, Phase 128 dog-food fix 2026-05-31): plain prose /
// version strings that contain the substring "match"/"Match" plus a ${...}
// but NO Cypher node pattern must NOT be flagged. These were the recurring
// false-positives that blocked legit commits and forced executors to reword.
// ---------------------------------------------------------------------------
test('Case 5b m4 precision: non-Cypher "match"+${...} strings are NOT flagged', () => {
  const body = [
    "'use strict';",
    'function report(after, latest) {',
    '  const a = `match: install version is ${after.version} expected ${latest}`;',
    "  const b = Match ? null : ('version mismatch: plugin=' + pjVer);",
    '  return [a, b];',
    '}',
    'module.exports = { report };',
    '',
  ].join('\n');
  const file = 'lib/feature/version-strings.cjs';
  const viols = violationsFor(runCase({ [file]: body }), file);
  equal(viols.filter((v) => v.rule === 'm4-cypher-interpolation').length, 0,
    'non-Cypher match+interpolation prose must report zero m4 violations, got ' + JSON.stringify(viols));
});

// ---------------------------------------------------------------------------
// Bonus superset assertion A: a raw `INSERT INTO nodes (id, type, properties)`
// outside navigation.cjs -> violation (catches the lazygraph-ops bypass class).
// ---------------------------------------------------------------------------
test('Bonus A superset: raw INSERT INTO nodes flagged (un-provenanced write class)', () => {
  const body = [
    "'use strict';",
    'function writeNode(db, id, type, props) {',
    "  return db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run(id, type, props);",
    '}',
    'module.exports = { writeNode };',
    '',
  ].join('\n');
  const file = 'lib/feature/bad-raw-insert.cjs';
  const viols = violationsFor(runCase({ [file]: body }), file);
  ok(viols.length >= 1, 'raw INSERT INTO nodes must be flagged, got ' + JSON.stringify(viols));
  ok(viols.some((v) => /INSERT/i.test(v.match) && /nodes/i.test(v.match)),
    'the matched token must name the INSERT INTO nodes write, got ' + JSON.stringify(viols.map((v) => v.match)));
});

// ---------------------------------------------------------------------------
// Bonus superset assertion B: a require of lib/core/lazygraph-ops.cjs from a
// non-allowlisted path -> violation (the old --check-chokepoint require-pattern
// the guard must still catch, proving the strict superset claim from Plan 01).
// ---------------------------------------------------------------------------
test('Bonus B superset: require of lazygraph-ops from non-allowlisted path flagged (chokepoint carry-forward)', () => {
  const body = [
    "'use strict';",
    "const lazy = require('../core/lazygraph-ops.cjs');",
    'module.exports = { lazy };',
    '',
  ].join('\n');
  const file = 'lib/feature/bad-lazy-require.cjs';
  const viols = violationsFor(runCase({ [file]: body }), file);
  ok(viols.length >= 1, 'require of lazygraph-ops outside the allow-list must be flagged, got ' + JSON.stringify(viols));
  ok(viols.some((v) => /lazygraph-ops/.test(v.match)),
    'the matched token must name the lazygraph-ops require, got ' + JSON.stringify(viols.map((v) => v.match)));
});

// ---------------------------------------------------------------------------
// Net-new regression cases (Phase 128 dog-food fix 2026-05-30): runDiff via
// scanStagedDiff must flag ONLY lines the staged diff ADDS, never pre-existing
// lines in a touched file. Drives the MINDRIAN_HOOK_STAGED_DIFF seam.
// ---------------------------------------------------------------------------
function runDiffCase(diff) {
  const prev = process.env.MINDRIAN_HOOK_STAGED_DIFF;
  try {
    process.env.MINDRIAN_HOOK_STAGED_DIFF = diff;
    return guard.scanStagedDiff();
  } finally {
    if (prev === undefined) delete process.env.MINDRIAN_HOOK_STAGED_DIFF;
    else process.env.MINDRIAN_HOOK_STAGED_DIFF = prev;
  }
}

test('Net-new C: an unrelated edit to a file with a pre-existing bypass is NOT flagged', () => {
  const diff = [
    'diff --git a/lib/feature/touches-violating.cjs b/lib/feature/touches-violating.cjs',
    '--- a/lib/feature/touches-violating.cjs',
    '+++ b/lib/feature/touches-violating.cjs',
    '@@ -10,1 +10,1 @@',
    '-  const x = 1;',
    '+  const x = 2;',
    '',
  ].join('\n');
  const viols = runDiffCase(diff);
  ok(viols.length === 0, 'unrelated edit must add zero net-new violations, got ' + JSON.stringify(viols));
});

test('Net-new D: a diff that ADDS an openGraph bypass IS flagged at the added line', () => {
  const diff = [
    'diff --git a/lib/feature/adds-bypass.cjs b/lib/feature/adds-bypass.cjs',
    '--- a/lib/feature/adds-bypass.cjs',
    '+++ b/lib/feature/adds-bypass.cjs',
    '@@ -5,0 +6,1 @@',
    '+  const db = openGraph(roomPath);',
    '',
  ].join('\n');
  const viols = runDiffCase(diff);
  ok(viols.some((v) => v.rule === 'opengraph-bypass' && v.line === 6),
    'a net-new openGraph bypass must be flagged at the added line, got ' + JSON.stringify(viols));
});

// ---------------------------------------------------------------------------
// Summary + exit code (exit 0 only when all 5 cases + 2 bonus assertions pass).
// ---------------------------------------------------------------------------
process.stdout.write('\n');
process.stdout.write('Substrate Contract suite: ' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) {
  for (const f of failures) {
    process.stdout.write('  - ' + f.name + ': ' + f.message + '\n');
  }
  process.exit(1);
}
process.exit(0);
