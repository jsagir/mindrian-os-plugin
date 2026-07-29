/**
 * Phase 236 / GRAPHDB-03: the engines.node floor says the real number.
 *
 * GRAPHDB-03 is LOG-ONLY per ROADMAP.md and REQUIREMENTS.md. No phase-blocking
 * behavioral gate is required of it. This file exists to stop the corrected
 * floor SILENTLY REGRESSING, not to block the phase, which is why it is cheap:
 * four assertions, no fixtures, no database, no network.
 *
 * WHY 22.16.0 AND NOT 22.13.0. Two different Node versions matter here and they
 * are easy to confuse, which is exactly how the original >=22.5.0 survived:
 *
 *   v22.13.0  node:sqlite stopped needing --experimental-sqlite (PR 55890).
 *             This is the AVAILABILITY floor. Below it, the unguarded
 *             require('node:sqlite') at lib/core/room-db.cjs throws outright.
 *             It is NOT sufficient for GRAPHDB-03.
 *   v22.16.0  the `timeout` constructor option was ADDED. This is the floor
 *             GRAPHDB-03 actually names, because Phase 218-02's write-safety
 *             fix passes `timeout: 5000` to DatabaseSync. node:sqlite accepts
 *             constructor options it does not recognise WITHOUT throwing, so on
 *             22.13 through 22.15 the option is silently dropped, contended
 *             writes still fail at 0ms with SQLITE_BUSY, and nothing warns.
 *
 * SOURCE OF THE 22.16.0 FIGURE: Context7 against the Node.js v22.x API docs,
 * specifically the `timeout` option's own version-history entry in the
 * DatabaseSync options table (nodejs.org/docs/latest-v22.x/api/sqlite.html),
 * NOT the module's separate --experimental-sqlite unflagging entry. Confirmed
 * live by a PRAGMA busy_timeout readback: 0 with an unrecognised option name,
 * 5000 with the real one. See 236-RESEARCH.md Evidence E and Pitfall 5.
 *
 * Run: node tests/test-236-engines-floor.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const REPO = path.resolve(__dirname, '..');

// Pinned by name so a future INTENTIONAL change to the floor breaks here loudly
// and visibly, forcing the person making it to restate the reason, rather than
// letting the number drift silently on one surface.
const EXPECTED_FLOOR = '>=22.16.0';
const FLOOR_MAJOR = 22;
const FLOOR_MINOR = 16;
const FLOOR_PATCH = 0;

// ---------- harness (the repo convention: plain counters, nonzero exit tail) ----------

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

// ---------- helpers ----------

// Drop whole-line comments BEFORE matching, so header prose in a source file can
// neither satisfy an assertion nor trip one. Same rule the phase runner uses.
function stripComments(src) {
  return src
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

function readRepoFile(rel) {
  const abs = path.join(REPO, rel);
  assert.ok(fs.existsSync(abs), rel + ' is missing from the repo');
  return fs.readFileSync(abs, 'utf8');
}

function listFilesRecursive(relDir) {
  const abs = path.join(REPO, relDir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

// ---------- scenarios ----------

process.stdout.write('test-236-engines-floor\n');

scenario('1. package.json engines.node is exactly ' + EXPECTED_FLOOR, () => {
  const pkg = require(path.join(REPO, 'package.json'));
  assert.ok(pkg.engines, 'package.json has no engines block at all');
  assert.equal(
    pkg.engines.node,
    EXPECTED_FLOOR,
    'engines.node is "' + pkg.engines.node + '" but the timeout-option floor is ' + EXPECTED_FLOOR +
    '. If this change was deliberate, update EXPECTED_FLOOR here AND restate the reason in ' +
    'CLAUDE.md and CHANGELOG.md, because a floor with no cited reason goes stale the same way ' +
    'the original >=22.5.0 did.'
  );
});

scenario('2. the runtime running this test satisfies the declared floor', () => {
  const parts = process.versions.node.split('.').map(Number);
  const [major, minor, patch] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  const satisfies =
    major > FLOOR_MAJOR ||
    (major === FLOOR_MAJOR && minor > FLOOR_MINOR) ||
    (major === FLOOR_MAJOR && minor === FLOOR_MINOR && patch >= FLOOR_PATCH);
  assert.ok(
    satisfies,
    'this test is running on Node ' + process.versions.node + ', below the declared floor ' +
    EXPECTED_FLOOR + '. That is a real signal, not a test bug: the development runtime and the ' +
    'manifest disagree, so `timeout: 5000` in lib/core/room-db.cjs is being silently dropped ' +
    'right now and every write-contention test on this machine is measuring the wrong thing.'
  );
});

scenario('3. CLAUDE.md states the same floor (the lockstep held)', () => {
  const claudeMd = readRepoFile('CLAUDE.md');
  assert.ok(
    claudeMd.includes('22.16.0'),
    'CLAUDE.md does not mention 22.16.0. package.json and CLAUDE.md are the two surfaces a ' +
    'reader trusts for the floor; if only one moved they now disagree.'
  );
  assert.ok(
    !claudeMd.includes('22.5.0'),
    'CLAUDE.md still carries the old 22.5.0 floor somewhere. One surface regressed while the ' +
    'other held, which is the exact drift shape 236-RESEARCH.md Pitfall 9 names.'
  );
});

scenario('4. the two reasons the 22.16.0 floor exists are both still true', () => {
  const roomDbSrc = stripComments(readRepoFile('lib/core/room-db.cjs'));

  // Reason one: the require is UNGUARDED. No try/catch, no feature detection.
  // If node:sqlite is not available the process dies at load, which is why the
  // module must be unflagged (the v22.13.0 availability floor).
  assert.ok(
    /require\(['"]node:sqlite['"]\)/.test(roomDbSrc),
    'lib/core/room-db.cjs no longer requires node:sqlite on an executable line. If the require ' +
    'moved behind a guard or a different module, the availability half of the floor rationale ' +
    'changed and the floor needs re-deriving rather than inheriting.'
  );

  // Reason two: a `timeout` option actually reaches the DatabaseSync
  // construction. This is the half that 22.13.0 does NOT satisfy. node:sqlite
  // swallows unknown options without throwing, so nothing at runtime would tell
  // us if this were dropped (Pitfall 5). This assertion is that signal.
  const constructionLines = roomDbSrc
    .split('\n')
    .filter((line) => /new\s+DatabaseSync\s*\(/.test(line));
  assert.ok(
    constructionLines.length > 0,
    'no `new DatabaseSync(` construction found on an executable line in lib/core/room-db.cjs'
  );
  const withTimeout = constructionLines.filter((line) => /\btimeout\s*:/.test(line));
  assert.ok(
    withTimeout.length > 0,
    'no DatabaseSync construction in lib/core/room-db.cjs passes a `timeout` option. The Phase ' +
    '218-02 write-safety fix is the ONLY reason the floor is 22.16.0 rather than the lower ' +
    '22.13.0 availability floor. If the option is genuinely gone, the floor can drop, but that ' +
    'is a conversation to have on purpose. Constructions seen: ' + constructionLines.length
  );
  assert.equal(
    withTimeout.length,
    constructionLines.length,
    'some DatabaseSync constructions in lib/core/room-db.cjs pass `timeout` and some do not. A ' +
    'construction without it has no busy-wait window at all, which is the pre-218-02 behavior ' +
    'the floor exists to make real. Lines missing it: ' +
    constructionLines.filter((l) => !/\btimeout\s*:/.test(l)).map((l) => l.trim()).join(' | ')
  );

  // The inverse check. If anything ever passes --experimental-sqlite, the
  // availability floor is no longer 22.13.0 and this whole rationale shifts.
  // Two places it could hide: an entry point under bin/, or a NODE_OPTIONS
  // assignment anywhere in the launch surfaces.
  const binFiles = listFilesRecursive('bin');
  assert.ok(binFiles.length > 0, 'bin/ is empty or missing, so this check would pass vacuously');
  for (const rel of binFiles) {
    const src = readRepoFile(rel);
    assert.ok(
      !src.includes('--experimental-sqlite'),
      rel + ' passes --experimental-sqlite. That changes the floor rationale: with the flag the ' +
      'module loads below 22.13.0, so the availability half of this floor no longer applies and ' +
      'the number needs re-deriving.'
    );
  }

  const optionSurfaces = ['package.json'].concat(
    listFilesRecursive('bin'),
    listFilesRecursive('scripts').filter((f) => !/\/node_modules\//.test(f))
  );
  for (const rel of optionSurfaces) {
    let src;
    try { src = readRepoFile(rel); } catch (_) { continue; }
    const offending = src
      .split('\n')
      .filter((line) => /NODE_OPTIONS/.test(line) && /experimental-sqlite/.test(line));
    assert.equal(
      offending.length,
      0,
      rel + ' sets --experimental-sqlite through NODE_OPTIONS: ' + offending.join(' | ')
    );
  }
});

// ---------- tail ----------

process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
