#!/usr/bin/env node
'use strict';

/*
 * Phase 310 (SEED-051) -- wiring suite for the REAL Step 5.5 block text in
 * scripts/release.sh.
 *
 * This suite does NOT copy Step 5.5's logic. It reads scripts/release.sh,
 * slices out the block from the line starting `# --- Step 5.5` up to (not
 * including) the line starting `# --- Step 9.8`, splices that EXACT text
 * into a generated bash driver, and runs it under `set -euo pipefail`. If
 * control flow survives the block, the driver reaches `echo AFTER_STEP_5_5`;
 * if the block calls `exit 1`, it does not.
 *
 * A `git` shim is placed first on PATH: it forwards every subcommand to the
 * REAL git binary except `ls-remote`, which it hard-fails (writes a marker
 * and exits 1) -- proving no real network call slips through, while still
 * letting the block's own `git rev-parse HEAD` work locally.
 *
 * Zero real git push, zero real remote, zero npm publish anywhere in this
 * file.
 *
 * Registered in tests/run-all-310.sh.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');
const REAL_GIT = execSync('command -v git', { encoding: 'utf8' }).trim();

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

// --------------------- slice the REAL Step 5.5 block ----------------------

function sliceStep55Block(src) {
  const lines = src.split('\n');
  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startIdx === -1 && lines[i].indexOf('# --- Step 5.5') === 0) {
      startIdx = i;
      continue;
    }
    if (startIdx !== -1 && lines[i].indexOf('# --- Step 9.8') === 0) {
      endIdx = i;
      break;
    }
  }
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('could not locate Step 5.5 / Step 9.8 boundaries in release.sh');
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

// --------------------- driver builder --------------------------------------

// Builds and runs a bash driver in a fresh sandbox dir. `extra` is a bash
// snippet inserted BEFORE the spliced block (env vars, fake hook defs, hook
// var assignment). Returns { status, stdout, stderr, markerDir }.
function runWiringDriver(step55Block, extra) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mos310-wire-'));
  const markerDir = path.join(sandbox, 'markers');
  const shimDir = path.join(sandbox, 'bin');
  fs.mkdirSync(markerDir, { recursive: true });
  fs.mkdirSync(shimDir, { recursive: true });

  const shimScript = [
    '#!/usr/bin/env bash',
    'if [ "$1" = "ls-remote" ]; then',
    '  touch "$MARKER_DIR/ls-remote-called"',
    '  exit 1',
    'fi',
    'exec "$REAL_GIT" "$@"',
    '',
  ].join('\n');
  const gitShimPath = path.join(shimDir, 'git');
  fs.writeFileSync(gitShimPath, shimScript, { mode: 0o755 });

  const driverLines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'GREEN=""; YELLOW=""; RED=""; NC=""',
    'NEW_VERSION="9.99.98-test"',
    'PLUGIN_DIR="' + REPO_ROOT + '"',
    'RELEASE_TAG_PUSH_RETRIES=3',
    'RELEASE_TAG_PUSH_BACKOFF_S=0',
    'MARKER_DIR="' + markerDir + '"',
    'REAL_GIT="' + REAL_GIT + '"',
    'export MARKER_DIR REAL_GIT',
    'PATH="' + shimDir + ':$PATH"',
    'export PATH',
    '. "' + path.join(REPO_ROOT, 'scripts', 'release-lib', 'verify-tag-push.sh') + '"',
    '',
    extra,
    '',
    step55Block,
    '',
    'echo AFTER_STEP_5_5',
    '',
  ].join('\n');
  const driverPath = path.join(sandbox, 'driver.sh');
  fs.writeFileSync(driverPath, driverLines, { mode: 0o755 });

  const r = spawnSync('bash', [driverPath], { encoding: 'utf8', timeout: 30000 });
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    markerDir,
    sandbox,
  };
}

// Records whether the git shim's ls-remote hard-fail fired, THEN removes the
// sandbox. Must run before rmSandbox deletes the marker dir, or the check
// would always read false-negative (directory already gone).
function checkLsRemoteThenRemove(r, lsRemoteHits) {
  lsRemoteHits.push(fs.existsSync(path.join(r.markerDir, 'ls-remote-called')));
  try { fs.rmSync(r.sandbox, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

const src = fs.readFileSync(RELEASE_SH, 'utf8');
const STEP_55_BLOCK = sliceStep55Block(src);

const lsRemoteHits = []; // one boolean per case, recorded BEFORE its sandbox is removed

// --------------------- Case 1: warn, the SEED-051 case --------------------

run('Case 1 (warn -- tag never found, main sha matches real HEAD -> continues to AFTER_STEP_5_5)', function () {
  const extra = [
    'fake_tag_probe() { return 1; }',
    'fake_main_sha() { touch "$MARKER_DIR/main-sha-called"; "$REAL_GIT" rev-parse HEAD; }',
    'MOS_TAG_PROBE_HOOK=fake_tag_probe',
    'MOS_MAIN_SHA_HOOK=fake_main_sha',
  ].join('\n');
  const r = runWiringDriver(STEP_55_BLOCK, extra);
  try {
    if (r.status !== 0) throw new Error('expected exit 0, got ' + r.status + '\nstdout:\n' + r.stdout + '\nstderr:\n' + r.stderr);
    if (r.stdout.indexOf('AFTER_STEP_5_5') === -1) throw new Error('sentinel missing, control flow did not survive:\n' + r.stdout);
    if (r.stdout.indexOf('already matches local HEAD') === -1) throw new Error('warn wording missing:\n' + r.stdout);
    if (r.stdout.indexOf('NOT visible at origin') !== -1) throw new Error('red abort copy must not print on the warn path:\n' + r.stdout);
  } finally { checkLsRemoteThenRemove(r, lsRemoteHits); }
});

// --------------------- Case 2: abort preserved -----------------------------

run('Case 2 (abort preserved -- tag never found, main sha does not match -> hard abort, sentinel absent)', function () {
  const extra = [
    'fake_tag_probe() { return 1; }',
    'fake_main_sha() { touch "$MARKER_DIR/main-sha-called"; echo "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"; }',
    'MOS_TAG_PROBE_HOOK=fake_tag_probe',
    'MOS_MAIN_SHA_HOOK=fake_main_sha',
  ].join('\n');
  const r = runWiringDriver(STEP_55_BLOCK, extra);
  try {
    if (r.status === 0) throw new Error('expected nonzero exit, got 0\nstdout:\n' + r.stdout);
    if (r.stdout.indexOf('AFTER_STEP_5_5') !== -1) throw new Error('sentinel must NOT print on the abort path:\n' + r.stdout);
    if (r.stdout.indexOf('NOT visible at origin after') === -1) throw new Error('expected the abort message, got:\n' + r.stdout);
    if (r.stdout.indexOf('Recovery: git push origin v') === -1) throw new Error('expected the recovery line, got:\n' + r.stdout);
  } finally { checkLsRemoteThenRemove(r, lsRemoteHits); }
});

// --------------------- Case 3: success unchanged ---------------------------

run('Case 3 (success unchanged -- tag found on attempt 2 -> AFTER_STEP_5_5, main-sha hook never called)', function () {
  const extra = [
    'PROBE_COUNT_FILE="$MARKER_DIR/probe-count"',
    'fake_tag_probe() {',
    '  n=$(cat "$PROBE_COUNT_FILE" 2>/dev/null || echo 0)',
    '  n=$((n+1))',
    '  echo "$n" > "$PROBE_COUNT_FILE"',
    '  [ "$n" -ge 2 ]',
    '}',
    'fake_main_sha() { touch "$MARKER_DIR/main-sha-called"; echo "should-not-be-called"; }',
    'fake_sleep() { :; }',
    'MOS_TAG_PROBE_HOOK=fake_tag_probe',
    'MOS_MAIN_SHA_HOOK=fake_main_sha',
    'MOS_SLEEP_HOOK=fake_sleep',
  ].join('\n');
  const r = runWiringDriver(STEP_55_BLOCK, extra);
  try {
    if (r.status !== 0) throw new Error('expected exit 0, got ' + r.status + '\nstdout:\n' + r.stdout + '\nstderr:\n' + r.stderr);
    if (r.stdout.indexOf('AFTER_STEP_5_5') === -1) throw new Error('sentinel missing:\n' + r.stdout);
    if (r.stdout.indexOf('verified at origin (attempt 2/3)') === -1) throw new Error('expected attempt 2/3 verified wording, got:\n' + r.stdout);
    if (fs.existsSync(path.join(r.markerDir, 'main-sha-called'))) {
      throw new Error('main-sha hook must never be called on the happy (tag-found) path');
    }
  } finally { checkLsRemoteThenRemove(r, lsRemoteHits); }
});

// --------------------- Case 4: SKIP_TAG_VERIFY unchanged -------------------

run('Case 4 (SKIP_TAG_VERIFY=1 unchanged -- bypasses entirely, neither hook called)', function () {
  const extra = [
    'SKIP_TAG_VERIFY=1',
    'fake_tag_probe() { touch "$MARKER_DIR/tag-probe-called"; return 1; }',
    'fake_main_sha() { touch "$MARKER_DIR/main-sha-called"; echo "x"; }',
    'MOS_TAG_PROBE_HOOK=fake_tag_probe',
    'MOS_MAIN_SHA_HOOK=fake_main_sha',
  ].join('\n');
  const r = runWiringDriver(STEP_55_BLOCK, extra);
  try {
    if (r.status !== 0) throw new Error('expected exit 0, got ' + r.status + '\nstdout:\n' + r.stdout + '\nstderr:\n' + r.stderr);
    if (r.stdout.indexOf('AFTER_STEP_5_5') === -1) throw new Error('sentinel missing:\n' + r.stdout);
    if (r.stderr.indexOf('SKIP_TAG_VERIFY=1') === -1) throw new Error('expected SKIP_TAG_VERIFY=1 audit line on stderr, got:\n' + r.stderr);
    if (fs.existsSync(path.join(r.markerDir, 'tag-probe-called'))) throw new Error('tag-probe hook must not be called when SKIP_TAG_VERIFY=1');
    if (fs.existsSync(path.join(r.markerDir, 'main-sha-called'))) throw new Error('main-sha hook must not be called when SKIP_TAG_VERIFY=1');
  } finally { checkLsRemoteThenRemove(r, lsRemoteHits); }
});

// --------------------- Case 5: constraint C1 literals -----------------------

run('Case 5 (constraint C1 -- all seven source-text literals still present)', function () {
  const literals = [
    'Step 5.5',
    'git ls-remote --tags origin',
    'git push origin v',
    'RELEASE_TAG_PUSH_RETRIES',
    'RELEASE_TAG_PUSH_BACKOFF_S',
    'RELEASE_TAG_PUSH_RETRIES:-3',
    'SKIP_TAG_VERIFY',
  ];
  const missing = literals.filter(function (l) { return src.indexOf(l) === -1; });
  if (missing.length) throw new Error('missing literal(s): ' + missing.join(', '));
});

// --------------------- Case 6: ordering -------------------------------------

run('Case 6 (ordering -- # --- Step 9.8 comes after # --- Step 5.5)', function () {
  const off55 = src.indexOf('# --- Step 5.5');
  const off98 = src.indexOf('# --- Step 9.8');
  if (off55 === -1 || off98 === -1) throw new Error('could not find both headers');
  if (!(off98 > off55)) throw new Error('Step 9.8 must come after Step 5.5; got off55=' + off55 + ' off98=' + off98);
});

// --------------------- Case 7: fail-closed preamble -------------------------

run('Case 7 (fail-closed preamble -- library source line precedes # --- Step 0:)', function () {
  const libLineOffset = src.indexOf('release-lib/verify-tag-push.sh');
  const step0Offset = src.indexOf('# --- Step 0:');
  if (libLineOffset === -1) throw new Error('release.sh does not reference release-lib/verify-tag-push.sh');
  if (step0Offset === -1) throw new Error('could not find # --- Step 0: header');
  if (!(libLineOffset < step0Offset)) {
    throw new Error('library source line must precede Step 0 (constraint C5); got libLineOffset=' + libLineOffset + ' step0Offset=' + step0Offset);
  }
});

// --------------------- Case 8: no real network reachable --------------------

run('Case 8 (no real network -- ls-remote marker absent across every prior case)', function () {
  if (lsRemoteHits.length === 0) throw new Error('no ls-remote checks recorded -- earlier cases must run first');
  const hitCount = lsRemoteHits.filter(Boolean).length;
  if (hitCount) throw new Error('the git shim\'s ls-remote hard-fail fired in ' + hitCount + ' case(s) -- a real network path was reachable');
});

// ------------------------ Summary ----------------------------------------

process.on('exit', function () {
  process.stdout.write('\n');
  process.stdout.write('Total: ' + total + '  Passed: ' + (total - failures) + '  Failed: ' + failures + '\n');
  if (failures > 0) process.exitCode = 1;
});
