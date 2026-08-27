#!/usr/bin/env node
'use strict';

/*
 * RCA phase-134-python-elimination-false-complete, Test 1 (guards Change 1).
 *
 * Given: a simulated environment with no Python ML deps installed
 *   (tests/fixtures/check-rs-engine-fake-python/fake-python.cjs stands in for
 *   `python3` via MINDRIAN_PYTHON, and reports every dep as missing until a
 *   fake `pip install` marks it "installed").
 * When: `/mos:doctor --check-rs-engine` (the pre-flight check gating
 *   /mos:find-bottlenecks et al., per scripts/doctor.cjs's runCheckRsEngine)
 *   runs, with and without `--fix`.
 * Then:
 *   - without --fix: probe-only, reports missing deps, does NOT remediate
 *     (remediation.attempted === false) -- unchanged legacy behavior.
 *   - with --fix: attempts in-session remediation (spawns the fake pip
 *     install), re-probes, and reports ready -- no manual step, no leaving
 *     the session. This is the behavior Change 1 added; before the fix this
 *     file guards, `--fix` did not exist for --check-rs-engine and this test
 *     would fail on remediation.attempted alone.
 *
 * Registered ad hoc (new test file, run directly via `node
 * tests/test-hsi-preflight-remediation.cjs`); add to a phase's
 * run-all-<phase>.sh or lib/memory/run-feynman-tests.cjs roster if/when this
 * RCA lands under a numbered phase.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const FAKE_PYTHON = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'check-rs-engine-fake-python', 'fake-python.cjs'
);

function freshStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), '134-hsi-preflight-fake-py-'));
}

function runCheckRsEngine(stateDir, extraArgs) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_PYTHON: FAKE_PYTHON,
    FAKE_PY_STATE_DIR: stateDir,
  });
  const args = [DOCTOR, '--check-rs-engine', '--json'].concat(extraArgs || []);
  const r = spawnSync('node', args, { env, encoding: 'utf8' });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null, asserted below */ }
  return { r, report };
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// Test 1a: no Python deps present, no --fix -> probe-only, reports missing,
// does NOT attempt remediation (legacy behavior preserved when --fix absent).
try {
  const stateDir = freshStateDir();
  const { r, report } = runCheckRsEngine(stateDir);
  assert.ok(report, 'JSON parses; stdout was: ' + r.stdout + ' stderr: ' + r.stderr);
  assert.strictEqual(report.ok, false, 'ok is false when deps missing');
  assert.strictEqual(report.python, FAKE_PYTHON, 'resolved python is the fake interpreter');
  assert.deepStrictEqual(
    report.missing_critical.slice().sort(), ['numpy', 'requests'],
    'both critical deps reported missing; got ' + JSON.stringify(report.missing_critical)
  );
  assert.strictEqual(r.status, 1, 'exit code 1 on missing critical deps');
  assert.ok(report.remediation && report.remediation.attempted === false,
    'remediation.attempted is false without --fix; got ' + JSON.stringify(report.remediation));
  rmTmp(stateDir);
  pass('Test 1a (no deps + no --fix -> probe-only, missing reported, no remediation attempted)');
} catch (err) { failTest('Test 1a (no deps + no --fix)', err); }

// Test 1b: no Python deps present, WITH --fix -> in-session remediation:
// fake pip install runs, deps re-probe as present, command succeeds without
// the user leaving the session to run a manual pip install.
try {
  const stateDir = freshStateDir();
  const { r, report } = runCheckRsEngine(stateDir, ['--fix']);
  assert.ok(report, 'JSON parses; stdout was: ' + r.stdout + ' stderr: ' + r.stderr);
  assert.ok(report.remediation && report.remediation.attempted === true,
    'remediation.attempted is true with --fix; got ' + JSON.stringify(report.remediation));
  assert.strictEqual(report.remediation.resolved, true,
    'remediation resolved all missing deps; got ' + JSON.stringify(report.remediation));
  assert.deepStrictEqual(report.missing_critical, [], 'no critical deps missing after remediation');
  assert.strictEqual(report.ok, true, 'ok is true after successful in-session remediation');
  assert.strictEqual(r.status, 0, 'exit code 0 after successful remediation');
  // Prove the fake pip install actually ran (not just faked in doctor.cjs):
  // marker files exist on disk for both critical deps.
  assert.ok(fs.existsSync(path.join(stateDir, 'numpy.installed')), 'numpy marker written by fake pip install');
  assert.ok(fs.existsSync(path.join(stateDir, 'requests.installed')), 'requests marker written by fake pip install');
  rmTmp(stateDir);
  pass('Test 1b (no deps + --fix -> in-session remediation succeeds, command ready, no manual step)');
} catch (err) { failTest('Test 1b (no deps + --fix -> in-session remediation)', err); }

// Test 1c: deps already present -> --fix is a safe no-op (no remediation
// needed, remediation stays null, ok stays true). Guards against --fix
// accidentally re-installing or misreporting on an already-healthy machine.
try {
  const stateDir = freshStateDir();
  fs.mkdirSync(stateDir, { recursive: true });
  for (const dep of ['requests', 'numpy', 'sentence_transformers', 'sklearn']) {
    fs.writeFileSync(path.join(stateDir, dep + '.installed'), 'pre-installed\n');
  }
  const { report } = runCheckRsEngine(stateDir, ['--fix']);
  assert.ok(report, 'JSON parses');
  assert.strictEqual(report.ok, true, 'ok is true when deps already present');
  assert.strictEqual(report.remediation, null, 'no remediation attempted when nothing is missing');
  rmTmp(stateDir);
  pass('Test 1c (deps already present + --fix -> safe no-op, no spurious remediation)');
} catch (err) { failTest('Test 1c (deps already present + --fix -> no-op)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
