#!/usr/bin/env node
'use strict';

/*
 * Phase 354 Plan 13 (SYS-07) -- acceptance-runner diagnostics regression.
 *
 * Failing-first (RED before GREEN): as of the commit that adds this file,
 * scripts/doctor.cjs's --acceptance path has no per-point timing, no stderr
 * progress lines, no bounded-child-with-hang-detection, and no test-mode
 * point filter/hang-injection hooks. This test asserts all of that at once
 * so a single hermetic run proves "diagnosable" per 354-13-PLAN.md's
 * must_haves.truths.
 *
 * Test-mode env hooks exercised (honored only under DOCTOR_TEST_MODE=1):
 *   DOCTOR_TEST_ONLY_POINTS=<comma list>   filters the checklist to exactly
 *                                          the named point ids (after the
 *                                          tier filter)
 *   DOCTOR_TEST_HANG_POINT=<id>            replaces that point's run() with
 *                                          a genuinely hanging child bounded
 *                                          by DOCTOR_ACCEPTANCE_CHILD_TIMEOUT_MS
 *   DOCTOR_ACCEPTANCE_CHILD_TIMEOUT_MS     the bound every acceptance-point
 *                                          child spawn is held to
 *   MINDRIAN_ACCEPTANCE_PROGRESS           1 (default) = emit
 *                                          '[acceptance] <id> start'/'done'
 *                                          lines to stderr; 0 = silent
 *
 * The test bounds its OWN child (the doctor.cjs invocation) with an outer
 * spawnSync timeout + SIGKILL so a genuinely-broken instrumentation attempt
 * cannot hang this test itself.
 */

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.stack || err)); }

// Two cheap points that both apply to the 'pre-tag' tier per
// buildAcceptanceChecklist's applies_to arrays (scripts/doctor.cjs:825,
// :879). install-state does a local file read; version-of-record-repo
// reads 3 local files. Neither spawns a child process normally -- that is
// exactly why the hang is INJECTED onto version-of-record-repo rather than
// relying on its own (nonexistent) child spawn.
const ONLY_POINTS = ['install-state', 'version-of-record-repo'];
const HANG_POINT = 'version-of-record-repo';
const CHILD_TIMEOUT_MS = 800;

function runDoctorAcceptance(extraEnv) {
  const env = Object.assign({}, process.env, {
    DOCTOR_TEST_MODE: '1',
    DOCTOR_TEST_ONLY_POINTS: ONLY_POINTS.join(','),
    DOCTOR_TEST_HANG_POINT: HANG_POINT,
    DOCTOR_ACCEPTANCE_CHILD_TIMEOUT_MS: String(CHILD_TIMEOUT_MS),
    MINDRIAN_ACCEPTANCE_PROGRESS: '1',
  }, extraEnv || {});
  // Outer bound on the test's own child: this test must never hang even if
  // the instrumentation under test is broken. SIGKILL, not SIGTERM -- a
  // stuck doctor.cjs must not be able to ignore the signal.
  const r = spawnSync('node', [DOCTOR, '--acceptance', '--pre-tag', '--json'], {
    env: env,
    encoding: 'utf8',
    timeout: 120000,
    killSignal: 'SIGKILL',
  });
  let json = null;
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start !== -1) {
      try { json = JSON.parse(r.stdout.slice(start)); } catch (_) { /* leave null */ }
    }
  }
  return { exitCode: r.status, signal: r.signal, json: json, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function entry(json, id) {
  const pts = json && json.points;
  if (!Array.isArray(pts)) return null;
  return pts.find(function (x) { return x.id === id; });
}

// -- Run 1: MINDRIAN_ACCEPTANCE_PROGRESS=1 (default), exercises timing +
//    filter + hang + progress-lines + no-orphan in one pass. -------------
let run1 = null;
try {
  run1 = runDoctorAcceptance();
} catch (err) {
  failTest('Run 1 (spawn doctor --acceptance --pre-tag --json)', err);
}

if (run1) {
  // (1) exits within the outer bound with status 1 (the hung point fails
  // its own point, which fails the whole --acceptance run per its
  // documented exit-code contract).
  try {
    assert.notStrictEqual(run1.signal, 'SIGKILL',
      'doctor --acceptance must complete within the outer 120000ms bound (own child timeout should fire first); got killed by the outer bound instead');
    assert.strictEqual(run1.exitCode, 1,
      'doctor --acceptance must exit 1 when the hung point times out; got exit=' + run1.exitCode + ' signal=' + run1.signal + ' stderr-tail=' + run1.stderr.slice(-500));
    pass('(1) process exits within the outer bound with status 1');
  } catch (err) { failTest('(1) bounded exit status', err); }

  // (2) stdout parses as JSON; exactly the two filtered points appear; each
  // has a numeric duration_ms; summary.duration_ms is a number;
  // summary.slowest.id is one of the two ids.
  try {
    assert.ok(run1.json, 'stdout must parse as JSON; stdout-tail=' + run1.stdout.slice(-500) + ' stderr-tail=' + run1.stderr.slice(-500));
    const ids = (run1.json.points || []).map(function (p) { return p.id; });
    assert.deepStrictEqual(ids.slice().sort(), ONLY_POINTS.slice().sort(),
      'DOCTOR_TEST_ONLY_POINTS must filter the checklist to exactly the two named points; got: ' + JSON.stringify(ids));
    for (const id of ONLY_POINTS) {
      const e = entry(run1.json, id);
      assert.ok(e, 'point ' + id + ' missing from results');
      assert.strictEqual(typeof e.duration_ms, 'number', 'point ' + id + '.duration_ms must be a number; got: ' + JSON.stringify(e.duration_ms));
      assert.ok(e.duration_ms >= 0, 'point ' + id + '.duration_ms must be >= 0');
    }
    assert.strictEqual(typeof (run1.json.summary && run1.json.summary.duration_ms), 'number',
      'summary.duration_ms must be a number; got summary=' + JSON.stringify(run1.json.summary));
    assert.ok(run1.json.summary.slowest && ONLY_POINTS.indexOf(run1.json.summary.slowest.id) !== -1,
      'summary.slowest.id must be one of ' + JSON.stringify(ONLY_POINTS) + '; got: ' + JSON.stringify(run1.json.summary.slowest));
    pass('(2) stdout JSON carries duration_ms per point + summary.duration_ms + summary.slowest, filtered to exactly the two points');
  } catch (err) { failTest('(2) timing fields + point filter', err); }

  // (3) the hung point reports ok:false, detail.child.timed_out === true,
  // detail.child.pid a number, and its finding contains 'timed out'.
  let hungPid = null;
  try {
    const e = entry(run1.json, HANG_POINT);
    assert.ok(e, HANG_POINT + ' entry missing from results');
    assert.strictEqual(e.ok, false, HANG_POINT + '.ok must be false when its child hangs; got ok=' + e.ok);
    assert.ok(e.detail && e.detail.child, HANG_POINT + '.detail.child must be present; got detail=' + JSON.stringify(e.detail));
    assert.strictEqual(e.detail.child.timed_out, true, HANG_POINT + '.detail.child.timed_out must be true; got: ' + JSON.stringify(e.detail.child));
    assert.strictEqual(typeof e.detail.child.pid, 'number', HANG_POINT + '.detail.child.pid must be a number; got: ' + JSON.stringify(e.detail.child.pid));
    assert.match(e.finding || '', /timed out/i, HANG_POINT + '.finding must contain "timed out"; got: ' + e.finding);
    hungPid = e.detail.child.pid;
    pass('(3) hung point reports ok=false, detail.child.timed_out=true, a numeric pid, and a "timed out" finding');
  } catch (err) { failTest('(3) hung-point classification', err); }

  // (4) stderr carries start/done progress lines for both points.
  try {
    for (const id of ONLY_POINTS) {
      assert.ok(run1.stderr.indexOf('[acceptance] ' + id + ' start') !== -1,
        'stderr missing "[acceptance] ' + id + ' start"; stderr=' + run1.stderr.slice(-1000));
      assert.match(run1.stderr, new RegExp('\\[acceptance\\] ' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' done'),
        'stderr missing a "[acceptance] ' + id + ' done" line; stderr=' + run1.stderr.slice(-1000));
    }
    pass('(4) stderr carries [acceptance] start/done progress lines for both points');
  } catch (err) { failTest('(4) stderr progress lines', err); }

  // (5) no orphan: after the parent process has exited, the hung child pid
  // must not be signalable (ESRCH on kill(pid, 0) means it is gone).
  try {
    assert.ok(typeof hungPid === 'number' && hungPid > 0, 'no pid captured from step (3); cannot check for orphan');
    let stillAlive = true;
    try {
      process.kill(hungPid, 0);
    } catch (killErr) {
      stillAlive = killErr.code !== 'ESRCH' ? true : false;
    }
    assert.strictEqual(stillAlive, false,
      'child pid ' + hungPid + ' must not still be signalable after doctor --acceptance exited (orphan process left behind)');
    pass('(5) hung child pid ' + hungPid + ' is not an orphan after the parent exited');
  } catch (err) { failTest('(5) no orphan process', err); }
}

// -- Run 2: MINDRIAN_ACCEPTANCE_PROGRESS=0 -> stderr carries NO
//    '[acceptance]' lines. --------------------------------------------
try {
  const run2 = runDoctorAcceptance({ MINDRIAN_ACCEPTANCE_PROGRESS: '0' });
  assert.strictEqual(run2.stderr.indexOf('[acceptance]'), -1,
    'MINDRIAN_ACCEPTANCE_PROGRESS=0 must suppress all "[acceptance]" stderr lines; stderr=' + run2.stderr.slice(-1000));
  pass('(6) MINDRIAN_ACCEPTANCE_PROGRESS=0 suppresses all [acceptance] stderr lines');
} catch (err) { failTest('(6) progress suppression', err); }

// -- Summary --------------------------------------------------------
console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
