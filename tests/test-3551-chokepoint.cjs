#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 02 Task 1 (AMB-01) -- the one-SQL-door sweep. Proves that
 * no 355.1 file outside lib/core/navigation/room-delta-facts.cjs ever opens
 * a second SQL door (node:sqlite, DatabaseSync, .prepare(, .exec( with SQL,
 * or a SELECT / INSERT INTO literal on an executable line), and that
 * room-delta-facts.cjs itself, once it exists, carries SELECT literals (its
 * whole job) but never node:sqlite, DatabaseSync or INSERT.
 *
 * scanForSql(files) is the one scan function both legs below reuse (the
 * run-all-3551.sh strip_comments idiom, via hygiene-355's own
 * nonCommentLines). A negative control (a planted `db.prepare('SELECT id
 * FROM nodes')` line in a scratch file under os.tmpdir()) proves the scan
 * actually catches a real violation rather than passing vacuously.
 *
 * Two of the six target files (scripts/auto-explore-fire.cjs,
 * scripts/scout-cadence-guard.cjs) already exist on disk and already
 * legitimately read room.db directly for pre-355.1 reasons outside this
 * plan's <files> list (scout-cadence-guard.cjs's own throttle read, e.g.)
 * -- so, mirroring tests/run-all-3551.sh's own established split (355.1-01
 * SUMMARY, deviation 2), those two are swept on ADDED LINES ONLY (git diff
 * against BASE_3551); every genuinely new-to-355.1 target is swept WHOLE.
 * This keeps the check's real intent (355.1 never ADDS a second SQL door)
 * honest without false-failing on inherited, out-of-scope content.
 *
 * hygiene-355 preamble runs BEFORE any repo require; attempts() === 0 is
 * the LAST check.
 *
 * Run: node tests/test-3551-chokepoint.cjs
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const path = require('node:path');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

let checks = 0;
let passed = 0;
function check(label, cond, detail) {
  checks += 1;
  if (cond) {
    passed += 1;
    process.stdout.write('PASS: ' + label + '\n');
  } else {
    process.stdout.write('FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
  return cond;
}

const REPO_ROOT = path.join(__dirname, '..');
const BASE_3551 = '6e0401525';

// The 355.1 file list this sweep governs (the PLAN's own list). Each is
// checked only if it exists on disk today.
const TARGET_LIST = [
  'lib/core/sensors/sensor-room-delta.cjs',
  'lib/core/ambient-trigger.cjs',
  'lib/core/ambient-run.cjs',
  'lib/core/ambient-framing.cjs',
  'scripts/ambient-stop.cjs',
  'scripts/scout-cadence-guard.cjs',
];

// The two pre-existing EXTEND targets (355.1-01 SUMMARY deviation 2 /
// run-all-3551.sh's own PART8_PREEXISTING_TARGETS): swept on added lines
// only, since 355.1 EXTENDS them rather than authoring them fresh.
const PREEXISTING_TARGETS = [
  'scripts/auto-explore-fire.cjs',
  'scripts/scout-cadence-guard.cjs',
];

// ---------------------------------------------------------------------
// FORBIDDEN_TOKENS -- the six forbidden shapes the plan names. Kept as
// named entries so a subset can be selected (room-delta-facts.cjs
// legitimately carries SELECT literals and .prepare(, since it IS the
// statement home; only 'node:sqlite', 'DatabaseSync' and 'INSERT INTO
// literal' apply there).
// ---------------------------------------------------------------------
const FORBIDDEN_TOKENS = [
  { name: 'node:sqlite', re: /require\(\s*['"]node:sqlite['"]\s*\)/ },
  { name: 'DatabaseSync', re: /\bDatabaseSync\b/ },
  { name: '.prepare(', re: /\.prepare\(/ },
  { name: '.exec( with SQL', re: /\.exec\(\s*[`'"][^`'"]*\b(SELECT|INSERT|UPDATE|DELETE)\b/i },
  { name: 'SELECT literal', re: /[`'"][^`'"]*\bSELECT\b[^`'"]*[`'"]/i },
  { name: 'INSERT INTO literal', re: /[`'"][^`'"]*\bINSERT\s+INTO\b[^`'"]*[`'"]/i },
];

function tokensByName(names) {
  if (!Array.isArray(names)) return FORBIDDEN_TOKENS;
  return FORBIDDEN_TOKENS.filter(function (t) { return names.indexOf(t.name) !== -1; });
}

function addedLinesSince(baseRef, fileAbs) {
  const rel = path.relative(REPO_ROOT, fileAbs);
  const r = spawnSync('git', ['diff', baseRef, '--', rel], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.status !== 0 && r.status !== null && typeof r.stdout !== 'string') return [];
  const out = typeof r.stdout === 'string' ? r.stdout : '';
  const lines = [];
  for (const raw of out.split(/\r?\n/)) {
    if (raw.indexOf('+++') === 0) continue;
    if (raw.indexOf('+') === 0) {
      const code = raw.slice(1);
      if (!hygiene.isPureLineComment(code)) lines.push(code);
    }
  }
  return lines;
}

/*
 * scanForSql(files, opts) -> Array<{file, line, token}>.
 * files: array of repo-relative or absolute paths (missing files are
 * silently skipped -- the plan's own "each only if it exists" rule).
 * opts.tokenNames: optional subset of FORBIDDEN_TOKENS to check.
 * opts.addedLinesOnlyFor: optional array of repo-relative paths that, when
 * matched, are scanned on git-diff-added lines against BASE_3551 instead of
 * the whole file.
 */
function scanForSql(files, opts) {
  const options = opts || {};
  const tokens = tokensByName(options.tokenNames);
  const addedOnlyFor = Array.isArray(options.addedLinesOnlyFor) ? options.addedLinesOnlyFor : [];
  const violations = [];
  for (const fileEntry of files) {
    const fileAbs = path.isAbsolute(fileEntry) ? fileEntry : path.join(REPO_ROOT, fileEntry);
    if (!fs.existsSync(fileAbs)) continue;
    const rel = path.relative(REPO_ROOT, fileAbs);
    const lines = addedOnlyFor.indexOf(rel) !== -1
      ? addedLinesSince(BASE_3551, fileAbs)
      : hygiene.nonCommentLines(fileAbs);
    lines.forEach(function (line, idx) {
      for (const tok of tokens) {
        if (tok.re.test(line)) {
          violations.push({ file: rel, line: idx + 1, token: tok.name, text: line.trim() });
        }
      }
    });
  }
  return violations;
}

function main() {
  // -----------------------------------------------------------------
  // Leg 1: the 355.1 file list carries no second SQL door.
  // -----------------------------------------------------------------
  const existingTargets = TARGET_LIST.filter(function (f) { return fs.existsSync(path.join(REPO_ROOT, f)); });
  if (existingTargets.length === 0) {
    process.stdout.write('SKIP-VACUOUS: none of the target files exist yet on this tree; '
      + 'the chokepoint scan over the 355.1 file list has nothing to check.\n');
  }
  const targetViolations = scanForSql(TARGET_LIST, { addedLinesOnlyFor: PREEXISTING_TARGETS });
  check(
    '355.1 file list carries no node:sqlite / DatabaseSync / .prepare( / .exec( SQL / SELECT / INSERT INTO '
      + '(' + existingTargets.length + '/' + TARGET_LIST.length + ' targets exist on disk; '
      + (existingTargets.length === 0 ? 'vacuously true' : 'scanned') + ')',
    targetViolations.length === 0,
    JSON.stringify(targetViolations)
  );

  // -----------------------------------------------------------------
  // Leg 2: room-delta-facts.cjs, once it exists, carries no node:sqlite,
  // DatabaseSync or INSERT (SELECT literals and .prepare( are its job and
  // are deliberately NOT checked here).
  // -----------------------------------------------------------------
  const readerRel = 'lib/core/navigation/room-delta-facts.cjs';
  const readerAbs = path.join(REPO_ROOT, readerRel);
  if (!fs.existsSync(readerAbs)) {
    process.stdout.write('SKIP-VACUOUS: ' + readerRel + ' does not exist yet on this tree; '
      + 'the statement-home leg has nothing to check.\n');
  }
  const readerViolations = scanForSql([readerRel], {
    tokenNames: ['node:sqlite', 'DatabaseSync', 'INSERT INTO literal'],
  });
  check(
    readerRel + ' carries no node:sqlite / DatabaseSync / INSERT INTO'
      + (fs.existsSync(readerAbs) ? ' (present, scanned)' : ' (absent, vacuously true)'),
    readerViolations.length === 0,
    JSON.stringify(readerViolations)
  );

  // -----------------------------------------------------------------
  // Negative control: a scratch file under os.tmpdir() planting a raw SQL
  // reader must be caught by the SAME scan function when its path is added
  // to the list.
  // -----------------------------------------------------------------
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-chokepoint-negctrl-'));
  const scratchFile = path.join(scratchDir, 'planted-sql-reader.cjs');
  fs.writeFileSync(
    scratchFile,
    "'use strict';\nfunction readIt(db) {\n  return db.prepare('SELECT id FROM nodes').all();\n}\nmodule.exports = { readIt };\n",
    'utf8'
  );
  let negControlPassed = false;
  try {
    const negViolations = scanForSql([scratchFile]);
    negControlPassed = negViolations.length > 0
      && negViolations.some(function (v) { return v.token === '.prepare(' || v.token === 'SELECT literal'; });
    check(
      'negative control: the planted SQL reader in a scratch file is flagged by scanForSql -- reported as PASS when caught',
      negControlPassed,
      JSON.stringify(negViolations)
    );
  } finally {
    try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
  check('negative control: the scratch file was removed after the check', !fs.existsSync(scratchFile));

  // -----------------------------------------------------------------
  // Sub-assertion: node scripts/check-substrate.cjs --diff exits 0 on this
  // tree (the wider structural chokepoint guard agrees).
  // -----------------------------------------------------------------
  const substrate = spawnSync(process.execPath, ['scripts/check-substrate.cjs', '--diff'], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  check(
    'node scripts/check-substrate.cjs --diff exits 0',
    substrate.status === 0,
    'exit ' + substrate.status + ' -- ' + (substrate.stdout || '') + (substrate.stderr || '')
  );

  check('no network attempts (installNetGuard)', netGuard.attempts() === 0);

  process.stdout.write('PASS: ' + passed + ' FAIL: ' + (checks - passed) + '\n');
  process.exitCode = (checks === passed) ? 0 : 1;
}

main();
