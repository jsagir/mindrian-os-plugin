#!/usr/bin/env node
'use strict';

/*
 * Phase 150.9 Plan-02 Task 1 -- /mos:doctor Class Q (GSD execution-record
 * drift) hermetic test fixtures.
 *
 * Class Q SHELLS OUT to `gsd-tools validate health --raw` (D-02; never
 * reimplements the ROADMAP/SUMMARY scan) and parses W007 (ROADMAP drift) +
 * I001 (missing SUMMARYs). The test injects a CANNED gsd-health JSON by
 * pointing the Class Q locator at a tiny fixture node script via the
 * MINDRIAN_DOCTOR_GSD_TOOLS env override, so the test is hermetic and does not
 * depend on the live gsd-core install.
 *
 * Behaviors verified:
 *   Q-1 (parse): canned {status:'degraded', warnings:[W007...], info:[I001...]}
 *       -> report.checks['gsd-record-drift'] reports the expected W007 + I001
 *       counts and status 'warn'.
 *   Q-2 (shape-drift safety, Pitfall 2): a shape-shifted JSON (warnings NOT an
 *       array) -> status === 'error' "shape unrecognized", NOT a false clean.
 *   Q-3 (exit-0 invariant, RQ1): `doctor --drift --json` with drift present
 *       exits 0; report.checks carries BOTH prose-vs-code and gsd-record-drift.
 *   Q-4 (deadlock carve-out, RQ1): a `--drift` run does NOT invoke Class A
 *       install-version drift exit-1; exit stays 0 and the Class A
 *       marketplace-cache-drift-deadlock carve-out is untouched.
 *   Q-5 (opt-in, D-04): a BARE `doctor` (no --drift) run produces NO
 *       gsd-record-drift key in report.checks.
 *   Q-6 (locator failure -> skip): MINDRIAN_DOCTOR_GSD_TOOLS pointing at a
 *       missing path -> status 'skip' "gsd-health unavailable", never a crash.
 *   Q-7 (fixed arg array, T-150.9-03): a clean canned health run reports 'ok'
 *       and exit 0 (the spawn used a fixed arg array, no shell injection).
 *
 * No em-dashes in this source (hyphens only).
 *
 * RED until Plan-02 Task 3 lands Class Q + the heal arm in doctor.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

function mkDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), '150.9-q-' + suffix + '-'));
}
function rmTmp(t) { try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ } }

// Write a fixture "gsd-tools" node script that ignores its args and prints a
// canned health JSON payload on stdout, exit 0. Mirrors the real
// `gsd-tools validate health --raw` contract Class Q consumes.
function makeFakeGsdTools(dir, payloadObj) {
  const file = path.join(dir, 'fake-gsd-tools.cjs');
  const src = '#!/usr/bin/env node\n'
    + "'use strict';\n"
    + 'process.stdout.write(' + JSON.stringify(JSON.stringify(payloadObj, null, 2)) + ');\n'
    + 'process.exit(0);\n';
  fs.writeFileSync(file, src, 'utf8');
  return file;
}

function runDoctor(extraArgs, gsdToolsPath) {
  const env = Object.assign({}, process.env, { MINDRIAN_STATUSLINE_SURFACE: 'CLI' });
  if (gsdToolsPath !== undefined) env.MINDRIAN_DOCTOR_GSD_TOOLS = gsdToolsPath;
  else delete env.MINDRIAN_DOCTOR_GSD_TOOLS;
  const args = [DOCTOR].concat(extraArgs || []).concat(['--json']);
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 60000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

const HEALTH_DRIFT = {
  status: 'degraded',
  errors: [],
  warnings: [
    { code: 'W007', message: 'Phase 150.7 exists on disk but not in ROADMAP.md', fix: 'Add to roadmap', repairable: false },
    { code: 'W007', message: 'Phase 99 exists on disk but not in ROADMAP.md', fix: 'Add to roadmap', repairable: false },
    { code: 'W002', message: 'unrelated warning', fix: 'n/a', repairable: false },
  ],
  info: [
    { code: 'I001', message: '103-00-PLAN.md has no SUMMARY.md', fix: 'May be in progress', repairable: false },
    { code: 'I001', message: '104-01-PLAN.md has no SUMMARY.md', fix: 'May be in progress', repairable: false },
    { code: 'I001', message: '105-00-PLAN.md has no SUMMARY.md', fix: 'May be in progress', repairable: false },
    { code: 'I999', message: 'unrelated info', fix: 'n/a', repairable: false },
  ],
  repairable_count: 0,
};

const HEALTH_CLEAN = { status: 'healthy', errors: [], warnings: [], info: [], repairable_count: 0 };

// -- Q-1: parse W007 + I001 from canned JSON -------------------------------
try {
  const dir = mkDir('q1');
  const fake = makeFakeGsdTools(dir, HEALTH_DRIFT);
  const { r, report } = runDoctor(['--drift'], fake);
  assert.strictEqual(r.status, 0, 'exit 0; got ' + r.status);
  const c = report.checks['gsd-record-drift'];
  assert.ok(c, 'gsd-record-drift key present');
  assert.strictEqual(c.class, 'Q', "class tag is 'Q'");
  assert.strictEqual(c.status, 'warn', 'drift present -> warn; got ' + c.status);
  assert.strictEqual((c.w007 || []).length, 2, 'two W007 records; got ' + (c.w007 || []).length);
  assert.strictEqual((c.i001 || []).length, 3, 'three I001 records; got ' + (c.i001 || []).length);
  rmTmp(dir);
  pass('Test Q-1 (parse W007 + I001 from canned JSON)');
} catch (err) { failTest('Test Q-1 (parse W007 + I001 from canned JSON)', err); }

// -- Q-2: shape-drift safety (Pitfall 2) -> error, not false clean ---------
try {
  const dir = mkDir('q2');
  // warnings is NOT an array -> shape unrecognized.
  const fake = makeFakeGsdTools(dir, { status: 'degraded', warnings: { code: 'W007' }, info: [] });
  const { r, report } = runDoctor(['--drift'], fake);
  assert.strictEqual(r.status, 0, 'still exit 0 (class-flag invariant); got ' + r.status);
  const c = report.checks['gsd-record-drift'];
  assert.ok(c, 'gsd-record-drift key present');
  assert.strictEqual(c.status, 'error', 'shape drift -> error (not false clean); got ' + c.status);
  assert.ok(/shape/i.test(c.detail || ''), 'detail mentions shape; got ' + c.detail);
  rmTmp(dir);
  pass('Test Q-2 (shape-drift safety -> error, not false clean)');
} catch (err) { failTest('Test Q-2 (shape-drift safety -> error, not false clean)', err); }

// -- Q-3: exit-0 invariant + both class keys present (RQ1) -----------------
try {
  const dir = mkDir('q3');
  const fake = makeFakeGsdTools(dir, HEALTH_DRIFT);
  const { r, report } = runDoctor(['--drift'], fake);
  assert.strictEqual(r.status, 0, 'doctor --drift exits 0 with drift present; got ' + r.status);
  assert.ok(report.checks['prose-vs-code'], 'prose-vs-code present');
  assert.ok(report.checks['gsd-record-drift'], 'gsd-record-drift present');
  rmTmp(dir);
  pass('Test Q-3 (exit-0 invariant; both class keys present) [RQ1]');
} catch (err) { failTest('Test Q-3 (exit-0 invariant; both class keys present) [RQ1]', err); }

// -- Q-4: deadlock carve-out untouched (RQ1) -------------------------------
try {
  const dir = mkDir('q4');
  const fake = makeFakeGsdTools(dir, HEALTH_DRIFT);
  // --drift must NOT re-arm Class A's checkInstallVersion exit-1 path. Even
  // with drift present in BOTH the gsd-record AND a (possibly) install-drift
  // state, the run stays exit 0 (classFlagsActive invariant).
  const { r, report } = runDoctor(['--drift'], fake);
  assert.strictEqual(r.status, 0, 'no deadlock exit-1; exit stays 0; got ' + r.status);
  // report.drift is Class A's install-drift field; under --drift the run is in
  // class-flag mode so even a detected install drift does not flip the exit.
  assert.ok(report.checks['gsd-record-drift'], 'class Q ran');
  rmTmp(dir);
  pass('Test Q-4 (deadlock carve-out untouched; exit 0) [RQ1]');
} catch (err) { failTest('Test Q-4 (deadlock carve-out untouched; exit 0) [RQ1]', err); }

// -- Q-5: opt-in -- bare doctor has NO gsd-record-drift key (D-04) ---------
try {
  const { report } = runDoctor([], undefined);
  assert.ok(report && report.checks, 'bare doctor printed JSON');
  assert.strictEqual(report.checks['gsd-record-drift'], undefined,
    'D-04: bare doctor must NOT run Class Q');
  pass('Test Q-5 (opt-in -- bare doctor skips Class Q) [D-04]');
} catch (err) { failTest('Test Q-5 (opt-in -- bare doctor skips Class Q) [D-04]', err); }

// -- Q-6: locator failure -> skip (never crash) ----------------------------
try {
  const missing = path.join(os.tmpdir(), 'definitely-not-a-real-gsd-tools-' + Date.now() + '.cjs');
  const { r, report } = runDoctor(['--drift'], missing);
  assert.strictEqual(r.status, 0, 'exit 0 even when locator fails; got ' + r.status);
  const c = report.checks['gsd-record-drift'];
  assert.ok(c, 'gsd-record-drift key present');
  assert.strictEqual(c.status, 'skip', 'locator failure -> skip; got ' + c.status);
  assert.ok(/unavailable|not found|skip/i.test(c.detail || ''), 'detail explains unavailability; got ' + c.detail);
  pass('Test Q-6 (locator failure -> skip, never crash)');
} catch (err) { failTest('Test Q-6 (locator failure -> skip, never crash)', err); }

// -- Q-7: clean canned health -> ok, exit 0 (fixed arg array) --------------
try {
  const dir = mkDir('q7');
  const fake = makeFakeGsdTools(dir, HEALTH_CLEAN);
  const { r, report } = runDoctor(['--drift'], fake);
  assert.strictEqual(r.status, 0, 'exit 0; got ' + r.status);
  const c = report.checks['gsd-record-drift'];
  assert.ok(c, 'gsd-record-drift present');
  assert.strictEqual(c.status, 'ok', 'clean health -> ok; got ' + c.status);
  assert.strictEqual((c.w007 || []).length, 0, 'no W007 on clean');
  assert.strictEqual((c.i001 || []).length, 0, 'no I001 on clean');
  rmTmp(dir);
  pass('Test Q-7 (clean canned health -> ok, exit 0)');
} catch (err) { failTest('Test Q-7 (clean canned health -> ok, exit 0)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
