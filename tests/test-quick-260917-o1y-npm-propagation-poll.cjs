#!/usr/bin/env node
'use strict';

/*
 * Quick task 260917-o1y -- unit suite for scripts/release-lib/npm-
 * propagation-poll.sh's `mos_wait_for_npm_propagation`, the errexit-safe
 * extraction of release.sh Step 9.7's registry-propagation poll.
 *
 * Every case spawns `bash -c` on a small driver that sources the library, a
 * stub `npm` executable prepended onto PATH (no real npm, no network,
 * anywhere in this file), calls the function or (Case 2 only) the OLD
 * unguarded inline form it replaces, and echoes `rc=$?`.
 *
 * Case 2 is the bug tripwire: it proves the stub genuinely reproduces the
 * beta.43/beta.45 errexit abort, so Case 1 cannot be green for the wrong
 * reason (a stub that never actually exercises the failure mode).
 *
 * Registered in tests/run-all-310.sh (leg 11).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const LIB = path.join(REPO_ROOT, 'scripts', 'release-lib', 'npm-propagation-poll.sh');

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

function countLines(str, needle) {
  return str.split('\n').filter(function (l) { return l.indexOf(needle) !== -1; }).length;
}

// Creates a stub `npm` executable in a fresh temp dir. `bodyLines` is the
// bash script body (no shebang) run for every invocation, regardless of
// argv -- the poll only ever calls `npm view <pkg>@<version> version`, so a
// generic call-count-driven stub is sufficient and keeps every case's stub
// self-contained (its own dir, its own call-counter file).
function mkNpmStub(bodyLines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-o1y-npmstub-'));
  const npmPath = path.join(dir, 'npm');
  const script = ['#!/usr/bin/env bash'].concat(bodyLines).join('\n') + '\n';
  fs.writeFileSync(npmPath, script, { mode: 0o755 });
  return dir;
}

// Runs a bash driver: PATH is prepended with the stub npm's dir (if given),
// sources the library under `set -euo pipefail`, defines empty
// GREEN/YELLOW/RED/NC (unused by this library, kept for parity with the
// Phase 310 harness shape), and executes `script`.
function runDriver(script, opts) {
  opts = opts || {};
  const env = Object.assign({}, process.env);
  if (opts.stubDir) {
    env.PATH = opts.stubDir + path.delimiter + env.PATH;
  }
  const full = [
    'set -euo pipefail',
    'GREEN=""; YELLOW=""; RED=""; NC=""',
    '. "' + LIB + '"',
    script,
  ].join('\n');
  const r = spawnSync('bash', ['-c', full], { encoding: 'utf8', timeout: 30000, env });
  return { status: r.status, stdout: (r.stdout || '') + (r.stderr || '') };
}

// Fails twice (no stdout, exit 1) then prints the version on call 3. Shared
// by Case 1 (proves the guarded form iterates and completes) and Case 2
// (proves the SAME stub kills the OLD unguarded form -- the tripwire).
const FAILS_TWICE_THEN_VERSION = [
  'DIR="$(cd "$(dirname "$0")" && pwd)"',
  'COUNT_FILE="$DIR/calls"',
  'n=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)',
  'n=$((n+1))',
  'echo "$n" > "$COUNT_FILE"',
  'if [ "$n" -le 2 ]; then exit 1; fi',
  'echo "2.0.0-beta.99"',
  'exit 0',
];

// Always exits 1, no stdout.
const ALWAYS_FAILS = [
  'DIR="$(cd "$(dirname "$0")" && pwd)"',
  'COUNT_FILE="$DIR/calls"',
  'n=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)',
  'n=$((n+1))',
  'echo "$n" > "$COUNT_FILE"',
  'exit 1',
];

// --------------------- Case 1: iterates and completes, R1 -----------------

run('Case 1 (fails twice under set -euo pipefail, succeeds attempt 3 -> rc=0, 2 waiting lines, MOS_NPM_PROP_SEEN set)', function () {
  const stubDir = mkNpmStub(FAILS_TWICE_THEN_VERSION);
  try {
    const script = [
      'mos_wait_for_npm_propagation "@mindrian_os/cli" "2.0.0-beta.99" 5 0',
      'echo "rc=$?"',
      'echo "seen=${MOS_NPM_PROP_SEEN:-}"',
    ].join('\n');
    const r = runDriver(script, { stubDir });
    if (r.status !== 0) throw new Error('expected driver status 0 (not aborted by errexit), got ' + r.status + ':\n' + r.stdout);
    const waitLines = countLines(r.stdout, 'waiting for npm registry to propagate');
    if (waitLines !== 2) throw new Error('expected exactly 2 waiting lines, got ' + waitLines + ':\n' + r.stdout);
    if (countLines(r.stdout, 'registry propagated @mindrian_os/cli@2.0.0-beta.99 (attempt 3)') !== 1) {
      throw new Error('expected one "registry propagated ... (attempt 3)" line, got:\n' + r.stdout);
    }
    if (r.stdout.indexOf('rc=0') === -1) throw new Error('expected rc=0, got:\n' + r.stdout);
    if (r.stdout.indexOf('seen=2.0.0-beta.99') === -1) throw new Error('expected seen=2.0.0-beta.99, got:\n' + r.stdout);
  } finally { fs.rmSync(stubDir, { recursive: true, force: true }); }
});

// --------------------- Case 2: the bug tripwire ----------------------------

run('Case 2 (bug tripwire: the SAME stub kills the OLD unguarded form under set -euo pipefail)', function () {
  const stubDir = mkNpmStub(FAILS_TWICE_THEN_VERSION);
  try {
    const script = [
      `X="$(npm view "@mindrian_os/cli@2.0.0-beta.99" version 2>/dev/null | tr -d '[:space:]')"`,
      'echo reached',
    ].join('\n');
    const r = runDriver(script, { stubDir });
    if (r.status === 0) throw new Error('expected the OLD unguarded form to abort (non-zero status), got 0:\n' + r.stdout);
    if (r.stdout.indexOf('reached') !== -1) throw new Error('expected "reached" to NEVER print -- errexit should have killed the driver first:\n' + r.stdout);
  } finally { fs.rmSync(stubDir, { recursive: true, force: true }); }
});

// --------------------- Case 3: budget exhausted, R2 ------------------------

run('Case 3 (budget exhausted: stub always fails, retries=2 backoff=0 -> rc=10, 2 waiting lines, single timeout line, no "abort")', function () {
  const stubDir = mkNpmStub(ALWAYS_FAILS);
  try {
    const script = [
      'rc=0',
      'mos_wait_for_npm_propagation "@mindrian_os/cli" "2.0.0-beta.99" 2 0 || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, { stubDir });
    if (r.status !== 0) throw new Error('expected driver status 0 (rc captured via || rc=$?), got ' + r.status + ':\n' + r.stdout);
    if (r.stdout.indexOf('rc=10') === -1) throw new Error('expected rc=10, got:\n' + r.stdout);
    const waitLines = countLines(r.stdout, 'waiting for npm registry to propagate');
    if (waitLines !== 2) throw new Error('expected exactly 2 waiting lines, got ' + waitLines + ':\n' + r.stdout);
    const timeoutLines = countLines(r.stdout, 'budget exhausted');
    if (timeoutLines !== 1) throw new Error('expected exactly one timeout line, got ' + timeoutLines + ':\n' + r.stdout);
    ['2 attempts', 'x 0s', '0s budget', 'proceeding'].forEach(function (needle) {
      if (r.stdout.indexOf(needle) === -1) throw new Error('expected the timeout line to contain "' + needle + '", got:\n' + r.stdout);
    });
    if (r.stdout.toLowerCase().indexOf('abort') !== -1) {
      throw new Error('the timeout line must never say "abort" -- timeout behavior is unchanged: proceed, got:\n' + r.stdout);
    }
  } finally { fs.rmSync(stubDir, { recursive: true, force: true }); }
});

// --------------------- Case 4: bad args (too few) --------------------------

run('Case 4 (bad args: only 2 args -> rc=1, 0 npm calls)', function () {
  const stubDir = mkNpmStub(ALWAYS_FAILS);
  try {
    const script = [
      'rc=0',
      'mos_wait_for_npm_propagation "@mindrian_os/cli" "2.0.0-beta.99" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, { stubDir });
    if (r.status !== 0) throw new Error('expected driver status 0, got ' + r.status + ':\n' + r.stdout);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (fs.existsSync(path.join(stubDir, 'calls'))) {
      throw new Error('expected 0 npm calls (no calls-counter file), but the stub was invoked:\n' + r.stdout);
    }
  } finally { fs.rmSync(stubDir, { recursive: true, force: true }); }
});

// --------------------- Case 5: non-numeric retries --------------------------

run('Case 5 (non-numeric retries -> rc=1, 0 npm calls, arithmetic guard proven under set -u)', function () {
  const stubDir = mkNpmStub(ALWAYS_FAILS);
  try {
    const script = [
      'rc=0',
      'mos_wait_for_npm_propagation "@mindrian_os/cli" "2.0.0-beta.99" abc 5 || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script, { stubDir });
    if (r.status !== 0) throw new Error('expected driver status 0, got ' + r.status + ':\n' + r.stdout);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (fs.existsSync(path.join(stubDir, 'calls'))) {
      throw new Error('expected 0 npm calls with non-numeric retries, but the stub was invoked:\n' + r.stdout);
    }
  } finally { fs.rmSync(stubDir, { recursive: true, force: true }); }
});

// --------------------- Case 6: release.sh wiring (Task 2) -----------------
//
// Reads scripts/release.sh directly (no bash driver -- these are static
// wiring assertions) and proves the Step 9.7 call site was actually
// rewired, not just that the library works in isolation.

const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');

function readReleaseSh() {
  return fs.readFileSync(RELEASE_SH, 'utf8');
}

// Splits on `^# --- Step` headers (multiline mode) and returns the text of
// the Step 9.7 block, header through the line before the next header.
function extractStep97Block(src) {
  const lines = src.split('\n');
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && /^# --- Step 9\.7/.test(lines[i])) {
      start = i;
      continue;
    }
    if (start !== -1 && i > start && /^# --- Step/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (start === -1) throw new Error('Step 9.7 header not found in scripts/release.sh');
  return lines.slice(start, end).join('\n');
}

run('Case 6a (release.sh sources npm-propagation-poll.sh behind a missing-file guard)', function () {
  const src = readReleaseSh();
  const guardRe = /if \[ ! -f "\$RELEASE_LIB_DIR\/npm-propagation-poll\.sh" \]; then[\s\S]*?exit 1[\s\S]*?fi\n\. "\$RELEASE_LIB_DIR\/npm-propagation-poll\.sh"/;
  if (!guardRe.test(src)) throw new Error('expected a missing-file guard + dot-source for npm-propagation-poll.sh, matching the shape of the other release-lib guards');
});

run('Case 6b (the source line sits BEFORE the first "# --- Step" header)', function () {
  const src = readReleaseSh();
  const sourceIdx = src.indexOf('. "$RELEASE_LIB_DIR/npm-propagation-poll.sh"');
  const firstStepIdx = src.indexOf('\n# --- Step');
  if (sourceIdx === -1) throw new Error('source line not found');
  if (firstStepIdx === -1) throw new Error('no "# --- Step" header found');
  if (!(sourceIdx < firstStepIdx)) {
    throw new Error('source line must precede the first Step header; sourceIdx=' + sourceIdx + ' firstStepIdx=' + firstStepIdx);
  }
});

run('Case 6c (Step 9.7 block calls mos_wait_for_npm_propagation with the package + $NEW_VERSION)', function () {
  const block = extractStep97Block(readReleaseSh());
  if (block.indexOf('mos_wait_for_npm_propagation "@mindrian_os/cli" "$NEW_VERSION"') === -1) {
    throw new Error('expected the call literal in the Step 9.7 block, got:\n' + block);
  }
});

run('Case 6d (Step 9.7 block defaults NPX_PROP_RETRIES to 48)', function () {
  const block = extractStep97Block(readReleaseSh());
  if (block.indexOf('NPX_PROP_RETRIES:-48') === -1) throw new Error('expected NPX_PROP_RETRIES:-48 in the block, got:\n' + block);
});

run('Case 6e (Step 9.7 block defaults NPX_PROP_BACKOFF_S to 15)', function () {
  const block = extractStep97Block(readReleaseSh());
  if (block.indexOf('NPX_PROP_BACKOFF_S:-15') === -1) throw new Error('expected NPX_PROP_BACKOFF_S:-15 in the block, got:\n' + block);
});

run('Case 6f (Step 9.7 block no longer contains the old unguarded "npm view" literal)', function () {
  const block = extractStep97Block(readReleaseSh());
  if (block.indexOf('npm view') !== -1) throw new Error('the Step 9.7 block must no longer call npm view directly, got:\n' + block);
});

run('Case 6g (the dry-run preview literal "npx --yes @mindrian_os/cli@" survives)', function () {
  const src = readReleaseSh();
  if (src.indexOf('npx --yes @mindrian_os/cli@') === -1) {
    throw new Error('expected the npx --yes @mindrian_os/cli@ literal to survive somewhere in release.sh');
  }
});

run('Case 6h (at least one exit 1 gate remains inside the Step 9.7 block)', function () {
  const block = extractStep97Block(readReleaseSh());
  if (!/exit 1/.test(block)) throw new Error('expected at least one exit 1 gate inside the Step 9.7 block, got:\n' + block);
});

// ------------------------ Summary ----------------------------------------

process.on('exit', function () {
  process.stdout.write('\n');
  process.stdout.write('Total: ' + total + '  Passed: ' + (total - failures) + '  Failed: ' + failures + '\n');
  if (failures > 0) process.exitCode = 1;
});
