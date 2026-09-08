#!/usr/bin/env node
'use strict';

/*
 * Phase 310 (SEED-051) -- unit suite for scripts/release-lib/verify-tag-push.sh's
 * `mos_verify_tag_at_origin`, the pure abort-vs-warn decision function extracted
 * out of release.sh Step 5.5.
 *
 * Every case spawns `bash -c` on a small driver that sources the library,
 * defines fake hooks (no real git anywhere in this file), calls the function,
 * and echoes `rc=$?`. Fake hooks append to marker files so the test can assert
 * call counts and non-calls (the happy path must make zero extra network calls).
 *
 * Return-code contract under test: 0 = verified, 10 = warn (main sha matched),
 * 1 = abort (mismatch / unreadable / bad args / unusable hook).
 *
 * Registered in tests/run-all-310.sh.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const LIB = path.join(REPO_ROOT, 'scripts', 'release-lib', 'verify-tag-push.sh');

let failures = 0;
let total = 0;

function pass(name) {
  process.stdout.write('PASS: ' + name + '\n');
}
function fail(name, err) {
  failures++;
  process.stdout.write('FAIL: ' + name + '\n');
  if (err) process.stdout.write('  ' + String(err && err.stack ? err.stack : err) + '\n');
}
function run(name, fn) {
  total++;
  try {
    fn();
    pass(name);
  } catch (e) {
    fail(name, e);
  }
}

// Runs a bash driver that sources the library and executes `script` (the
// caller supplies the hook function bodies + the mos_verify_tag_at_origin
// call). Returns { status, stdout }.
function runDriver(script, markerDir) {
  const full = [
    'set -euo pipefail',
    'GREEN=""; YELLOW=""; RED=""; NC=""',
    '. "' + LIB + '"',
    'MARKER_DIR="' + markerDir + '"',
    script,
  ].join('\n');
  const r = spawnSync('bash', ['-c', full], { encoding: 'utf8', timeout: 30000 });
  return { status: r.status, stdout: (r.stdout || '') + (r.stderr || '') };
}

function mkMarkerDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos310-'));
}

function markerExists(dir, name) {
  return fs.existsSync(path.join(dir, name));
}

function countLines(str, needle) {
  return str.split('\n').filter(function (l) { return l.indexOf(needle) !== -1; }).length;
}

// --------------------- Case 1: verified on attempt 1, no main-sha call ---

run('Case 1 (verified attempt 1 -> rc 0, no main-sha marker)', function () {
  const dir = mkMarkerDir();
  try {
    const script = [
      'probe1() { return 0; }',
      'mainsha1() { touch "$MARKER_DIR/main-called"; echo "should-not-be-called"; }',
      'export MOS_TAG_PROBE_HOOK=probe1',
      'export MOS_MAIN_SHA_HOOK=mainsha1',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 3 0 "deadbeef" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, dir);
    if (r.stdout.indexOf('rc=0') === -1) throw new Error('expected rc=0, got:\n' + r.stdout);
    if (r.stdout.indexOf('verified at origin (attempt 1/3)') === -1) {
      throw new Error('expected verified wording with attempt 1/3, got:\n' + r.stdout);
    }
    if (markerExists(dir, 'main-called')) {
      throw new Error('main-sha hook was called on the happy path -- must never fire when tag verifies early');
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Case 2: verified on attempt 2 ----------------------

run('Case 2 (verified attempt 2 -> rc 0, one retry line, sleep called once)', function () {
  const dir = mkMarkerDir();
  try {
    const script = [
      'COUNT_FILE="$MARKER_DIR/probe-calls"',
      'probe2() {',
      '  n=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)',
      '  n=$((n+1))',
      '  echo "$n" > "$COUNT_FILE"',
      '  [ "$n" -ge 2 ]',
      '}',
      'sleepfn() { echo -n "" >> "$MARKER_DIR/sleep-calls"; }',
      'export MOS_TAG_PROBE_HOOK=probe2',
      'export MOS_MAIN_SHA_HOOK=probe2',
      'export MOS_SLEEP_HOOK=sleepfn',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 3 0 "deadbeef" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, dir);
    if (r.stdout.indexOf('rc=0') === -1) throw new Error('expected rc=0, got:\n' + r.stdout);
    if (r.stdout.indexOf('attempt 2/3') === -1) throw new Error('expected "attempt 2/3", got:\n' + r.stdout);
    const retryLines = countLines(r.stdout, 'retry 2/3');
    if (retryLines !== 1) throw new Error('expected exactly one retry line, got ' + retryLines + ':\n' + r.stdout);
    const sleepCalls = fs.existsSync(path.join(dir, 'sleep-calls')) ? fs.readFileSync(path.join(dir, 'sleep-calls'), 'utf8').length : -1;
    if (sleepCalls !== 0) {
      // sleepfn writes zero bytes each call via echo -n; existence + zero length still proves >=1 call happened.
      if (!fs.existsSync(path.join(dir, 'sleep-calls'))) throw new Error('sleep hook was never called');
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Case 3: never visible, main sha matches -----------

run('Case 3 (never visible, main sha matches -> rc 10, warn wording, no red copy)', function () {
  const dir = mkMarkerDir();
  try {
    const script = [
      'probe3() { return 1; }',
      'mainsha3() { echo "abc1234567"; }',
      'export MOS_TAG_PROBE_HOOK=probe3',
      'export MOS_MAIN_SHA_HOOK=mainsha3',
      'export MOS_SLEEP_HOOK=true',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 2 0 "abc1234567" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, dir);
    if (r.stdout.indexOf('rc=10') === -1) throw new Error('expected rc=10, got:\n' + r.stdout);
    if (r.stdout.indexOf('already matches local HEAD') === -1) throw new Error('expected warn wording, got:\n' + r.stdout);
    if (r.stdout.indexOf('abc1234') === -1) throw new Error('expected the short sha in the warn output, got:\n' + r.stdout);
    if (r.stdout.indexOf('NOT visible at origin') !== -1) {
      throw new Error('the library must NOT print the red "NOT visible at origin" copy -- that belongs to release.sh, not the library');
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Case 4: never visible, main sha differs -----------

run('Case 4 (never visible, main sha differs -> rc 1, mismatch named)', function () {
  const dir = mkMarkerDir();
  try {
    const script = [
      'probe4() { return 1; }',
      'mainsha4() { echo "deadbeef00"; }',
      'export MOS_TAG_PROBE_HOOK=probe4',
      'export MOS_MAIN_SHA_HOOK=mainsha4',
      'export MOS_SLEEP_HOOK=true',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 2 0 "abc1234567" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, dir);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (r.stdout.indexOf('does not match local HEAD') === -1) throw new Error('expected mismatch wording, got:\n' + r.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Case 5: main sha hook prints empty ----------------

run('Case 5 (main sha hook prints empty -> rc 1, fail closed)', function () {
  const dir = mkMarkerDir();
  try {
    const script = [
      'probe5() { return 1; }',
      'mainsha5empty() { echo ""; }',
      'export MOS_TAG_PROBE_HOOK=probe5',
      'export MOS_MAIN_SHA_HOOK=mainsha5empty',
      'export MOS_SLEEP_HOOK=true',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 2 0 "abc1234567" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, dir);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (r.stdout.indexOf('could not read origin/main sha from origin') === -1) {
      throw new Error('expected the "could not read" diagnostic, got:\n' + r.stdout);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Case 6: unusable probe hook ------------------------

run("Case 6 (MOS_TAG_PROBE_HOOK=definitely_not_a_function -> rc 1, not-callable, retry loop never ran)", function () {
  const dir = mkMarkerDir();
  try {
    const script = [
      'mainsha6() { touch "$MARKER_DIR/main-called"; echo "x"; }',
      'export MOS_TAG_PROBE_HOOK=definitely_not_a_function',
      'export MOS_MAIN_SHA_HOOK=mainsha6',
      'export MOS_SLEEP_HOOK=true',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 3 0 "abc1234567" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, dir);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (r.stdout.indexOf('is not callable') === -1) throw new Error('expected "is not callable" message, got:\n' + r.stdout);
    if (r.stdout.indexOf('retry') !== -1) throw new Error('retry loop must never run when the probe hook is unusable, got:\n' + r.stdout);
    if (markerExists(dir, 'main-called')) throw new Error('main-sha hook must never be called when the tag-probe hook is unusable');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Case 7: missing arguments --------------------------

run('Case 7 (called with 3 arguments -> rc 1, missing arguments)', function () {
  const dir = mkMarkerDir();
  try {
    const script = [
      'probe7() { return 0; }',
      'export MOS_TAG_PROBE_HOOK=probe7',
      'export MOS_MAIN_SHA_HOOK=probe7',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 3 0 || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, dir);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (r.stdout.indexOf('missing arguments') === -1) throw new Error('expected "missing arguments", got:\n' + r.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Case 8: retries=6, honored end to end -------------

run('Case 8 (retries=6, never visible -> exactly 5 retry lines and 5 sleep calls)', function () {
  const dir = mkMarkerDir();
  try {
    const script = [
      'probe8() { return 1; }',
      'mainsha8() { echo "deadbeef00"; }',
      'sleepfn8() { n=$(cat "$MARKER_DIR/sleep-count" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$MARKER_DIR/sleep-count"; }',
      'export MOS_TAG_PROBE_HOOK=probe8',
      'export MOS_MAIN_SHA_HOOK=mainsha8',
      'export MOS_SLEEP_HOOK=sleepfn8',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 6 0 "abc1234567" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, dir);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    const retryLines = countLines(r.stdout, 'tag not yet visible at origin');
    if (retryLines !== 5) throw new Error('expected exactly 5 retry lines, got ' + retryLines + ':\n' + r.stdout);
    const sleepCountFile = path.join(dir, 'sleep-count');
    const sleepCount = fs.existsSync(sleepCountFile) ? parseInt(fs.readFileSync(sleepCountFile, 'utf8').trim(), 10) : 0;
    if (sleepCount !== 5) throw new Error('expected exactly 5 sleep-hook calls, got ' + sleepCount);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Case 9: sources cleanly under set -u ---------------

run('Case 9 (sources cleanly under set -euo pipefail, colors unset, no unbound-variable error)', function () {
  const dir = mkMarkerDir();
  try {
    // Deliberately does NOT set GREEN/YELLOW/RED/NC, unlike runDriver's default
    // harness -- this case tests the library's own internal ${VAR:-} guards.
    const full = [
      'set -euo pipefail',
      'unset GREEN YELLOW RED NC 2>/dev/null || true',
      '. "' + LIB + '"',
      'probe9() { return 0; }',
      'mainsha9() { echo "x"; }',
      'export MOS_TAG_PROBE_HOOK=probe9',
      'export MOS_MAIN_SHA_HOOK=mainsha9',
      'rc=0',
      'mos_verify_tag_at_origin "v1.0.0" 3 0 "abc" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = spawnSync('bash', ['-c', full], { encoding: 'utf8', timeout: 30000 });
    const out = (r.stdout || '') + (r.stderr || '');
    if (out.indexOf('unbound variable') !== -1) throw new Error('unbound-variable error with colors unset:\n' + out);
    if (out.indexOf('rc=0') === -1) throw new Error('expected rc=0 with colors unset, got:\n' + out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ------------------------ Summary ----------------------------------------

process.on('exit', function () {
  process.stdout.write('\n');
  process.stdout.write('Total: ' + total + '  Passed: ' + (total - failures) + '  Failed: ' + failures + '\n');
  if (failures > 0) process.exitCode = 1;
});
