'use strict';
/*
 * tests/test-349-dry-run-never-sends.cjs -- Phase 349 Plan 04 (NOTIFY-02/04/05).
 *
 * SHELLS THE REAL scripts/release.sh IN --dry-run MODE. This is safe by
 * construction: the dry-run block is text-only and `exit 0`s before any
 * mutation (release.sh:316), and this is exactly what scripts/doctor.cjs's
 * own `release-dry-run-output` blocker already does on every acceptance
 * run. This file proves, through the REAL script rather than a unit fake,
 * that a dry-run prints the Step 5.6 preview line, never invokes the real
 * dispatch command, never writes an audit log, exits 0, and leaves the
 * working tree byte-identical -- the phase's strongest single assertion
 * that `doctor --acceptance` cannot fire a dispatch at Theo.
 *
 * Also proves scripts/doctor.cjs's `expectedSteps` array and release.sh's
 * dry-run preview agree, from the direction the doctor blocker actually
 * asserts it: every member of the EXTRACTED array (never re-typed, so the
 * two files cannot drift apart silently) must appear in the real dry-run
 * stdout.
 *
 * Bare node script: assert, an ok(label) counter, no framework, non-zero
 * exit on any assertion failure (uncaught throw), self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO, 'scripts', 'release.sh');
const DOCTOR_CJS = path.join(REPO, 'scripts', 'doctor.cjs');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-349-dry-run-never-sends:');

// ---------------------------------------------------------------------------
// Extract expectedSteps from the doctor source rather than re-typing it.
// A re-typed literal would let the two files drift apart silently -- the
// exact class of defect this pairing exists to prevent.
// ---------------------------------------------------------------------------
const doctorSrc = fs.readFileSync(DOCTOR_CJS, 'utf8');
const arrayMatch = doctorSrc.match(/const expectedSteps = \[([^\]]*)\]/);
assert.ok(arrayMatch, 'scripts/doctor.cjs must define an expectedSteps array literal');
const expectedSteps = JSON.parse('[' + arrayMatch[1].replace(/'/g, '"') + ']');
assert.ok(Array.isArray(expectedSteps) && expectedSteps.length > 0, 'expectedSteps must be a non-empty array');

// ---------------------------------------------------------------------------
// The array knows the step (E6).
// ---------------------------------------------------------------------------
{
  assert.ok(expectedSteps.indexOf('Step 5.6') !== -1, "doctor.cjs's expectedSteps array must contain the literal 'Step 5.6'");
  ok("expectedSteps array (extracted from doctor.cjs) contains 'Step 5.6'");
}

function tmpEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-349-notify-dryrun-'));
  return {
    dir: dir,
    sentinel: path.join(dir, 'dispatch-sentinel'),
    log: path.join(dir, 'theo-notify-log.txt'),
  };
}

function runDryRun(extraArgs, tmp) {
  const env = Object.assign({}, process.env);
  // Always set BOTH seam env vars to temp paths, per the plan's own
  // instruction, so this test can never touch the real HOME and can never
  // reach the network even if the dry-run branch regressed.
  env.MINDRIAN_THEO_NOTIFY_CMD = 'touch "' + tmp.sentinel + '"; exit 0';
  env.MINDRIAN_THEO_NOTIFY_LOG = tmp.log;
  const args = [RELEASE_SH, 'patch', '--dry-run'].concat(extraArgs || []);
  const start = Date.now();
  const r = cp.spawnSync('bash', args, { encoding: 'utf8', timeout: 60000, env: env, cwd: REPO });
  const elapsedMs = Date.now() - start;
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', elapsedMs: elapsedMs };
}

function gitPorcelain() {
  const r = cp.spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: REPO });
  return r.stdout || '';
}

let tmp1;
try {
  tmp1 = tmpEnv();

  // -------------------------------------------------------------------------
  // The preview satisfies the array, proven from the direction the doctor
  // blocker actually asserts it.
  // -------------------------------------------------------------------------
  const before = gitPorcelain();
  const run1 = runDryRun([], tmp1);
  const after = gitPorcelain();

  assert.equal(run1.status, 0, 'bash scripts/release.sh patch --dry-run must exit 0: ' + run1.stderr.slice(-500));
  ok('dry-run exits 0');

  const missing = expectedSteps.filter(function (s) { return run1.stdout.indexOf(s) === -1; });
  assert.deepStrictEqual(missing, [], 'every expectedSteps member must appear in the real dry-run stdout, missing: ' + missing.join(', '));
  ok('every member of the extracted expectedSteps array (including Step 5.6) appears in the real dry-run stdout');

  // -------------------------------------------------------------------------
  // The dry-run sends nothing, proven live: the sentinel file must not
  // exist after the run.
  // -------------------------------------------------------------------------
  assert.equal(fs.existsSync(tmp1.sentinel), false, 'the dispatch sentinel must NOT exist after a --dry-run: MINDRIAN_THEO_NOTIFY_CMD must never be invoked');
  ok('dry-run never invokes the dispatch command (sentinel file does not exist)');

  // -------------------------------------------------------------------------
  // The dry-run writes no audit log.
  // -------------------------------------------------------------------------
  assert.equal(fs.existsSync(tmp1.log), false, 'the audit log must NOT be written under --dry-run');
  ok('dry-run writes no audit log');

  // -------------------------------------------------------------------------
  // The dry-run mutates nothing: git status --porcelain byte-identical
  // before and after.
  // -------------------------------------------------------------------------
  assert.equal(after, before, 'git status --porcelain must be byte-identical before and after a --dry-run run');
  ok('working tree is byte-identical before and after the dry-run (git status --porcelain)');

  // -------------------------------------------------------------------------
  // Bounded runtime: under the 30s doctor.cjs timeout budget, measured
  // under 25000ms.
  // -------------------------------------------------------------------------
  assert.ok(run1.elapsedMs < 25000, 'the shelled dry-run must complete in under 25000ms (measured: ' + run1.elapsedMs + 'ms)');
  ok('dry-run completes within the bounded-runtime budget (' + run1.elapsedMs + 'ms < 25000ms)');
} finally {
  if (tmp1 && tmp1.dir) {
    fs.rmSync(tmp1.dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// The opt-out is visible in the preview: --no-theo-notify names the
// engaged opt-out before an operator commits to the cut.
// ---------------------------------------------------------------------------
let tmp2;
try {
  tmp2 = tmpEnv();
  const run2 = runDryRun(['--no-theo-notify'], tmp2);
  assert.equal(run2.status, 0, '--dry-run --no-theo-notify must still exit 0');
  assert.ok(/--no-theo-notify opt-out engaged/.test(run2.stdout), 'the preview must name the --no-theo-notify opt-out when engaged');
  ok('the --no-theo-notify opt-out is visible, named, in the dry-run preview when engaged');
  assert.equal(fs.existsSync(tmp2.sentinel), false, 'the dispatch sentinel must NOT exist even with --no-theo-notify under --dry-run');
} finally {
  if (tmp2 && tmp2.dir) {
    fs.rmSync(tmp2.dir, { recursive: true, force: true });
  }
}

console.log(checks + ' checks passed.');
process.exit(0);
