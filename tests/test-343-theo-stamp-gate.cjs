'use strict';
/*
 * tests/test-343-theo-stamp-gate.cjs -- Phase 343 Plan 07 (CENSUS-13).
 *
 * Proves scripts/release-lib/theo-stamp-gate.sh's mos_theo_stamp_gate
 * hermetically: no network call, ever. Every stamp read is driven through
 * MINDRIAN_THEO_STAMP_CMD (WD-21), the test seam the gate exists to make
 * testable -- the default `node -e` reader against lib/core/brain-client.cjs
 * is never exercised by this file.
 *
 * Arms:
 *   1. Matching stamp, real release mode -> exit 0, pass line naming both
 *      values.
 *   2. Older-version stamp, real release mode -> exit non-zero, output
 *      names the found value, the expected value, and a recovery command.
 *   3. A reader that fails (non-zero exit, no stdout) -> exit non-zero,
 *      output names it a READ FAILURE, never a mismatch.
 *   4. DRY_RUN=1 + a mismatching stamp -> exit 0, verdict still printed
 *      (WD-20's carve-out, pinned rather than assumed).
 *   5. (bonus) --no-theo-check with a mismatching stamp -> exit 0, the
 *      skip is visible in the log and names the flag (T-343-06).
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
const GATE_LIB = path.join(REPO, 'scripts', 'release-lib', 'theo-stamp-gate.sh');
const CURRENT_VERSION = require(path.join(REPO, 'lib', 'core', 'repo-version.cjs')).readRepoVersion().version;
const CURRENT_VERSION_RE = CURRENT_VERSION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-343-theo-stamp-gate:');
console.log('  (repo version under test: ' + CURRENT_VERSION + ')');

function runGate({ stampCmd, dryRun, noTheoCheck }) {
  const env = Object.assign({}, process.env);
  if (stampCmd !== undefined) {
    env.MINDRIAN_THEO_STAMP_CMD = stampCmd;
  } else {
    delete env.MINDRIAN_THEO_STAMP_CMD;
  }
  const script = '. "' + GATE_LIB + '"; mos_theo_stamp_gate "' + REPO + '" "' + (dryRun ? '1' : '0') + '" "' + (noTheoCheck ? '1' : '0') + '"';
  const r = cp.spawnSync('bash', ['-c', script], { encoding: 'utf8', env: env, timeout: 15000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ---------------------------------------------------------------------------
// Arm 1: matching stamp, real release mode.
// ---------------------------------------------------------------------------
{
  const r = runGate({ stampCmd: 'echo command-registry@' + CURRENT_VERSION, dryRun: false, noTheoCheck: false });
  assert.strictEqual(r.status, 0, 'a matching stamp must exit 0; got ' + r.status + ' stdout=' + r.stdout);
  assert.match(r.stdout, /PASS/, 'a matching stamp must print a pass line');
  assert.match(r.stdout, new RegExp(CURRENT_VERSION_RE), 'the pass line must name the current version');
  ok('arm 1: a matching stamp exits 0 and prints a pass line naming both values');
}

// ---------------------------------------------------------------------------
// Arm 2: older-version stamp, real release mode.
// ---------------------------------------------------------------------------
{
  const r = runGate({ stampCmd: 'echo command-registry@0.0.1', dryRun: false, noTheoCheck: false });
  assert.notStrictEqual(r.status, 0, 'a mismatching stamp must exit non-zero; got ' + r.status);
  assert.match(r.stdout, /command-registry@0\.0\.1/, 'output must name the found stamp');
  assert.match(r.stdout, new RegExp('command-registry@' + CURRENT_VERSION_RE), 'output must name the expected stamp');
  assert.match(r.stdout.toLowerCase(), /recovery/, 'output must name a recovery command');
  ok('arm 2: a mismatching stamp exits non-zero and names found, expected and a recovery command');
}

// ---------------------------------------------------------------------------
// Arm 3: unreadable / failing reader, real release mode.
// ---------------------------------------------------------------------------
{
  const r = runGate({ stampCmd: 'exit 1', dryRun: false, noTheoCheck: false });
  assert.notStrictEqual(r.status, 0, 'an unreadable stamp must exit non-zero; got ' + r.status);
  assert.match(r.stdout, /READ FAILURE/, 'an unreadable stamp must be named a read failure');
  assert.ok(!/MISMATCH/.test(r.stdout), 'a read failure must never be reported as a mismatch');
  ok('arm 3: a failing reader is a named READ FAILURE, never a mismatch');
}

// ---------------------------------------------------------------------------
// Arm 4: DRY_RUN=1, mismatching stamp -- WD-20's carve-out.
// ---------------------------------------------------------------------------
{
  const r = runGate({ stampCmd: 'echo command-registry@0.0.1', dryRun: true, noTheoCheck: false });
  assert.strictEqual(r.status, 0, 'under dry-run a mismatch must NOT abort; got ' + r.status + ' stdout=' + r.stdout);
  assert.match(r.stdout, /DRY RUN/, 'the dry-run output must be distinct from a real pass');
  assert.match(r.stdout, /MISMATCH/, 'the dry-run output must still name the mismatch verdict');
  ok('arm 4: under DRY_RUN=1 a mismatch prints the verdict and exits 0 (WD-20)');
}

// ---------------------------------------------------------------------------
// Arm 5 (bonus): --no-theo-check is audited, never silent (T-343-06).
// ---------------------------------------------------------------------------
{
  const r = runGate({ stampCmd: 'echo command-registry@0.0.1', dryRun: false, noTheoCheck: true });
  assert.strictEqual(r.status, 0, 'an audited --no-theo-check skip must exit 0 even with a mismatching stamp; got ' + r.status);
  assert.match(r.stdout, /SKIPPED/, 'the skip must be visible in the log');
  assert.match(r.stdout, /no-theo-check/, 'the skip must name the flag');
  ok('arm 5 (bonus): --no-theo-check is audited -- visible, names the flag, and never touches the reader');
}

// ---------------------------------------------------------------------------
// Arm 6 (WR-01): a plugin_dir containing a single quote AND a space must not
// break the DEFAULT reader's generated JS (the seam this arm deliberately
// bypasses is MINDRIAN_THEO_STAMP_CMD -- every other arm above uses it so
// the default `node -e` reader is never exercised; this arm targets exactly
// that default reader, since that is where plugin_dir used to be
// interpolated unescaped into a JS string literal).
// ---------------------------------------------------------------------------
{
  const quoteVersion = '9.9.9-quote-test';
  const fakePluginDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "mos-theo-gate-it's a room ")
  );
  try {
    const libCoreDir = path.join(fakePluginDir, 'lib', 'core');
    fs.mkdirSync(libCoreDir, { recursive: true });

    // Minimal stand-in for lib/core/repo-version.cjs's CLI mode (the gate
    // shells `node "$plugin_dir/lib/core/repo-version.cjs"` and reads
    // stdout as the bare version string).
    fs.writeFileSync(
      path.join(libCoreDir, 'repo-version.cjs'),
      'process.stdout.write(' + JSON.stringify(quoteVersion) + ');\n'
    );

    // Minimal stand-in for lib/core/brain-client.cjs's callTool shape,
    // exercised by the DEFAULT reader's own generated JS (never by
    // MINDRIAN_THEO_STAMP_CMD, which is intentionally left unset below).
    fs.writeFileSync(
      path.join(libCoreDir, 'brain-client.cjs'),
      'module.exports = { callTool: function () { return Promise.resolve('
        + '{ rows: [ { mappedBy: ' + JSON.stringify('command-registry@' + quoteVersion) + ' } ] }'
        + '); } };\n'
    );

    const env = Object.assign({}, process.env);
    delete env.MINDRIAN_THEO_STAMP_CMD;
    const script = '. "' + GATE_LIB + '"; mos_theo_stamp_gate "' + fakePluginDir + '" "0" "0"';
    const r = cp.spawnSync('bash', ['-c', script], { encoding: 'utf8', env: env, timeout: 15000 });

    assert.strictEqual(
      r.status, 0,
      'a plugin_dir with a quote and a space must still PASS via the default reader; got '
        + r.status + ' stdout=' + r.stdout + ' stderr=' + r.stderr
    );
    assert.match(r.stdout, /PASS/, 'the default reader must still print a pass line');
    assert.match(
      r.stdout, new RegExp(quoteVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'the pass line must name the matching version, proving the JS was not corrupted'
    );
    ok('arm 6 (WR-01): a plugin_dir with a single quote and a space does not break the default reader');
  } finally {
    fs.rmSync(fakePluginDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Arm 7 (WR-02): the hang guard must be enforced (fail closed) even when the
// `timeout` binary is not on PATH. Exercised hermetically by restricting the
// CHILD process's PATH to node's own bin directory only (no coreutils
// `timeout` there), while resolving `bash` itself via an absolute path so
// spawnSync does not need PATH to find the shell it launches.
// ---------------------------------------------------------------------------
{
  const nodeBinDir = path.dirname(process.execPath);
  const bashPath = (function () {
    for (const candidate of ['/usr/bin/bash', '/bin/bash']) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return 'bash';
  })();

  const env = Object.assign({}, process.env, { PATH: nodeBinDir });
  delete env.MINDRIAN_THEO_STAMP_CMD;
  const script = '. "' + GATE_LIB + '"; mos_theo_stamp_gate "' + REPO + '" "0" "0"';
  const start = Date.now();
  const r = cp.spawnSync(bashPath, ['-c', script], { encoding: 'utf8', env: env, timeout: 15000 });
  const elapsedMs = Date.now() - start;

  assert.notStrictEqual(
    r.status, 0,
    'with no timeout binary on PATH the gate must fail closed (READ FAILURE), never silently pass; got '
      + r.status + ' stdout=' + r.stdout + ' stderr=' + r.stderr
  );
  assert.match(
    r.stdout, /READ FAILURE/,
    'a missing timeout binary must be reported as a READ FAILURE, the same class as any other unreadable stamp'
  );
  assert.ok(
    elapsedMs < 5000,
    'a missing timeout binary must return promptly (fail closed), not attempt an unbounded call; took ' + elapsedMs + 'ms'
  );
  ok('arm 7 (WR-02): a missing timeout binary fails closed as a READ FAILURE instead of running unbounded');
}

console.log('');
console.log(checks + ' checks passed.');
process.exit(0);
