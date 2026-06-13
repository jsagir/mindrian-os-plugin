#!/usr/bin/env node
'use strict';

/*
 * Phase 150.9 Plan-02 Task 1 -- /mos:doctor Class P (prose-vs-code,
 * report-only) hermetic test fixtures.
 *
 * Class P wraps the two shipped drift checkers into the doctor lettered-class
 * roster (Canon Part 7 reuse):
 *   - check-skill-vs-code-drift.cjs  (require().check(), no process.exit)
 *   - check-first-touch-drift.cjs    (CLI-only self-exit -> spawned as a
 *                                     SUBPROCESS, Pitfall 1; never require()d)
 *
 * Behaviors verified:
 *   P-1 (wrap, no reimplement): with injected first-touch drift (an em-dash
 *       fixture surface), report.checks['prose-vs-code'].status === 'warn' and
 *       it carries a first_touch_hits count > 0.
 *   P-2 (report-only, D-03): the mtimes of all fixture .md files are UNCHANGED
 *       after `doctor --drift` AND after `doctor --drift --fix` (Class P never
 *       edits prose).
 *   P-3 (first-touch subprocess, Pitfall 1): Class P captures first-touch via a
 *       subprocess -- a clean (no-drift) fixture yields status 'ok' and the
 *       run exits 0 (proving the require()-self-exit hazard is avoided; a
 *       require would have killed doctor before it printed JSON).
 *   P-5 (opt-in, D-04): a BARE `doctor` (no --drift) run produces NO
 *       prose-vs-code key in report.checks.
 *
 * Hermetic envelope: the first-touch checker honors MOS_TEST_SCAN_DIR (an env
 * the shipped scanner already reads) so we inject fixture surfaces without
 * touching the real repo. No em-dashes in this source (hyphens only); the
 * em-dash fixture is written via String.fromCharCode(0x2014).
 *
 * RED until Plan-02 Task 2 lands Class P + --drift in doctor.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const EMDASH = String.fromCharCode(0x2014);

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

function mkScanDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), '150.9-p-' + suffix + '-'));
}
function rmTmp(t) { try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ } }

// Run doctor with a fixture scan dir injected for the first-touch checker.
function runDoctor(extraArgs, scanDir) {
  const env = Object.assign({}, process.env, { MINDRIAN_STATUSLINE_SURFACE: 'CLI' });
  if (scanDir) env.MOS_TEST_SCAN_DIR = scanDir;
  else delete env.MOS_TEST_SCAN_DIR;
  const args = [DOCTOR].concat(extraArgs || []).concat(['--json']);
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 60000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// Lay down a fixture with an em-dashed first-touch surface (Pattern 1 drift).
function makeDriftyFixture(dir) {
  fs.writeFileSync(path.join(dir, 'greeting.md'),
    '# Welcome\n\nLarry is here ' + EMDASH + ' your venture guide.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'notes.md'), '# Notes\n\nNo drift here.\n', 'utf8');
}
// Lay down a clean fixture (no drift patterns).
function makeCleanFixture(dir) {
  fs.writeFileSync(path.join(dir, 'greeting.md'),
    '# Welcome\n\nLarry is here - your venture guide.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'notes.md'), '# Notes\n\nAll clean.\n', 'utf8');
}

function mtimesOf(dir) {
  const out = {};
  for (const ent of fs.readdirSync(dir)) {
    const abs = path.join(dir, ent);
    out[ent] = fs.statSync(abs).mtimeMs;
  }
  return out;
}

// -- P-1: wrap both checkers; injected drift -> status 'warn' --------------
try {
  const scan = mkScanDir('p1');
  makeDriftyFixture(scan);
  const { r, report } = runDoctor(['--drift'], scan);
  assert.strictEqual(r.status, 0, 'class-flag invariant: exit 0; got ' + r.status);
  assert.ok(report && report.checks, 'JSON parses + checks key present');
  const c = report.checks['prose-vs-code'];
  assert.ok(c, 'prose-vs-code check key present in report.checks');
  assert.strictEqual(c.class, 'P', "class tag is 'P'");
  assert.strictEqual(c.status, 'warn', 'injected drift -> warn; got ' + c.status);
  assert.ok(typeof c.first_touch_hits === 'number' && c.first_touch_hits > 0,
    'first_touch_hits > 0; got ' + c.first_touch_hits);
  rmTmp(scan);
  pass('Test P-1 (wrap both checkers; injected drift -> warn)');
} catch (err) { failTest('Test P-1 (wrap both checkers; injected drift -> warn)', err); }

// -- P-2: report-only -- NO fixture .md mtime changes, even under --fix ----
try {
  const scan = mkScanDir('p2');
  makeDriftyFixture(scan);
  const before = mtimesOf(scan);
  // Small delay so any accidental write would produce a DIFFERENT mtime.
  const t0 = Date.now(); while (Date.now() - t0 < 15) { /* spin ~15ms */ }
  runDoctor(['--drift'], scan);
  const afterDrift = mtimesOf(scan);
  assert.deepStrictEqual(afterDrift, before, 'no prose mtime change after --drift');
  runDoctor(['--drift', '--fix'], scan);
  const afterFix = mtimesOf(scan);
  assert.deepStrictEqual(afterFix, before, 'no prose mtime change after --drift --fix (D-03 report-only)');
  rmTmp(scan);
  pass('Test P-2 (report-only -- no prose edit, even under --fix)');
} catch (err) { failTest('Test P-2 (report-only -- no prose edit, even under --fix)', err); }

// -- P-3: first-touch via subprocess (Pitfall 1) -- clean -> ok, exit 0 ----
try {
  const scan = mkScanDir('p3');
  makeCleanFixture(scan);
  const { r, report } = runDoctor(['--drift'], scan);
  // If Class P had require()'d check-first-touch-drift.cjs it would have
  // self-exited mid-run; doctor would not have printed parseable JSON.
  assert.ok(report && report.checks, 'doctor survived (printed JSON) -- no self-exit');
  assert.strictEqual(r.status, 0, 'exit 0 on clean fixture; got ' + r.status);
  const c = report.checks['prose-vs-code'];
  assert.ok(c, 'prose-vs-code present');
  assert.strictEqual(c.first_touch_hits, 0, 'clean fixture -> 0 first-touch hits; got ' + c.first_touch_hits);
  rmTmp(scan);
  pass('Test P-3 (first-touch subprocess; clean -> ok, no self-exit)');
} catch (err) { failTest('Test P-3 (first-touch subprocess; clean -> ok, no self-exit)', err); }

// -- P-5: opt-in -- bare doctor has NO prose-vs-code key (D-04) ------------
try {
  const { report } = runDoctor([], null);
  assert.ok(report && report.checks, 'bare doctor printed JSON');
  assert.strictEqual(report.checks['prose-vs-code'], undefined,
    'D-04: bare doctor must NOT run Class P');
  pass('Test P-5 (opt-in -- bare doctor skips Class P) [D-04]');
} catch (err) { failTest('Test P-5 (opt-in -- bare doctor skips Class P) [D-04]', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
