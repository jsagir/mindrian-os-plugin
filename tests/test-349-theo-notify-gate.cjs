'use strict';
/*
 * tests/test-349-theo-notify-gate.cjs -- Phase 349 Plan 02 (NOTIFY-07).
 *
 * Proves scripts/release-lib/theo-notify-gate.sh's mos_theo_notify_gate
 * hermetically: no network call, ever. Every dispatch is driven through
 * MINDRIAN_THEO_NOTIFY_CMD, the write-direction sibling of Phase 343's
 * MINDRIAN_THEO_STAMP_CMD -- the real default dispatch command (a `gh`
 * invocation against the GitHub REST API) is never exercised by this file.
 * The audit-log path is driven through the second seam, MINDRIAN_THEO_
 * NOTIFY_LOG, so no arm ever writes to a real HOME.
 *
 * WHY THIS FILE IS AUTHORED RED (Phase 349 Plan 02): the library this file
 * sources, scripts/release-lib/theo-notify-gate.sh, does not exist yet. It
 * lands in Plan 03, behind a blocking navigator checkpoint. This file fixes
 * mos_theo_notify_gate's contract in writing, as executable assertions,
 * BEFORE any implementation exists, so Plan 03 implements against a fixed
 * target instead of inventing one at integration time. It is registered as
 * a run_red_until tripwire in tests/run-all-349.sh, so today's failure is
 * the honest, expected state, not a defect in this file.
 *
 * THE FIXED SIGNATURE (349-02-PLAN.md, unamended without re-opening this
 * plan): mos_theo_notify_gate plugin_dir release_sha new_version dry_run
 * no_theo_notify. Returns 0 on a successful dispatch, an audited
 * --no-theo-notify skip, or any outcome while dry_run=1. Returns 1 on a
 * send failure on a real release with the opt-out not set.
 *
 * THE SEAM CONTRACT this file fixes (a design decision this plan makes so
 * the contract is testable, not left to Plan 03 to invent silently): the
 * dispatch command held in MINDRIAN_THEO_NOTIFY_CMD is invoked with exactly
 * four positional arguments, one per client_payload field, each the literal
 * string "<key>=<value>", in this fixed order:
 *   $1 = "version=<the argument passed as new_version>"
 *   $2 = "commit=<the argument passed as release_sha>"
 *   $3 = "registryHash=<a SHA-256 hex digest the gate computes internally>"
 *   $4 = "command_registry_path=data/command-registry.json"
 * This lets a hermetic test recover the payload's KEY SET (not just its
 * values) from the recorded argv, which is what tests/test-349-payload-
 * boundary.cjs's closed-four-key-set arm needs. In production the gate's
 * own default dispatch builds a real request from these same four values
 * (a `gh` call against GitHub's REST API); that default path is never
 * reached by any arm in this file except where an arm deliberately targets
 * it (none do here -- see tests/test-349-payload-boundary.cjs arm 7 for the
 * one source-scan-based arm that touches the default path's own text).
 *
 * Arms:
 *   1. Real-mode success: exit 0, stdout names SENT/version/theo-resync/
 *      jsagir-theo, argv recorded is exactly four values.
 *   2. Real-mode send failure: exit non-zero, stdout names SEND FAILURE,
 *      a recovery instruction, and the --no-theo-notify escape.
 *   3. Dry-run never sends: exit 0, stdout names DRY RUN, the dispatch
 *      command's sentinel side effect never happens.
 *   4. The audited opt-out: exit 0, stdout names SKIPPED, the flag, the
 *      version, and a consequence clause; the sentinel never happens.
 *   5. The two failure classes never conflate, asserted in both directions.
 *   6. No timeout binary fails closed: exit non-zero, SEND FAILURE, no
 *      sentinel, returns promptly.
 *   7. Shell-metacharacter safety: a plugin_dir with a quote and a space,
 *      a version with a shell metacharacter, neither breaks out.
 *   8. The local audit log: written on success and on failure, never
 *      under dry-run.
 *   9. Token non-disclosure: GH_TOKEN/GITHUB_TOKEN sentinels never surface
 *      in the gate's own stdout or stderr.
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
const GATE_LIB = path.join(REPO, 'scripts', 'release-lib', 'theo-notify-gate.sh');

console.log('test-349-theo-notify-gate:');

if (!fs.existsSync(GATE_LIB)) {
  console.error(
    '  x RED (expected): scripts/release-lib/theo-notify-gate.sh does not exist yet.'
  );
  console.error(
    '    Lands in Phase 349 Plan 03, behind a blocking navigator checkpoint. This'
  );
  console.error(
    '    tripwire is registered as run_red_until in tests/run-all-349.sh and reads'
  );
  console.error(
    '    EXPECTED-RED until then. This is the honest state, not a failure.'
  );
  process.exit(1);
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

const REPO_SHA = cp
  .spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' })
  .stdout.trim();
const FIXTURE_VERSION = '9.9.9-notify-test';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-theo-notify-'));

function runGate(opts) {
  const env = Object.assign({}, process.env);
  if (opts.notifyCmd !== undefined) {
    env.MINDRIAN_THEO_NOTIFY_CMD = opts.notifyCmd;
  } else {
    delete env.MINDRIAN_THEO_NOTIFY_CMD;
  }
  if (opts.notifyLog !== undefined) {
    env.MINDRIAN_THEO_NOTIFY_LOG = opts.notifyLog;
  } else {
    delete env.MINDRIAN_THEO_NOTIFY_LOG;
  }
  if (opts.envExtra) {
    Object.assign(env, opts.envExtra);
  }
  const pluginDir = opts.pluginDir || REPO;
  const releaseSha = opts.releaseSha || REPO_SHA;
  const newVersion = opts.newVersion !== undefined ? opts.newVersion : FIXTURE_VERSION;
  const dryRun = opts.dryRun ? '1' : '0';
  const noNotify = opts.noNotify ? '1' : '0';
  const script =
    '. "' + GATE_LIB + '"; mos_theo_notify_gate "' + pluginDir + '" "' + releaseSha +
    '" "' + newVersion + '" "' + dryRun + '" "' + noNotify + '"';
  const r = cp.spawnSync('bash', ['-c', script], { encoding: 'utf8', env: env, timeout: 15000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// The argv-recording fake: appends its own arguments, one per line, to
// argvFile, then exits with exitCode. A single-line command so it can live
// whole in an environment variable.
function makeArgvRecorderCmd(argvFile, exitCode) {
  return 'for a in "$@"; do printf \'%s\\n\' "$a" >> "' + argvFile + '"; done; exit ' + exitCode;
}

function readArgvLines(argvFile) {
  if (!fs.existsSync(argvFile)) return [];
  return fs.readFileSync(argvFile, 'utf8').split('\n').filter(Boolean);
}

let arm2Result;
let arm4Result;

// ---------------------------------------------------------------------------
// Arm 1: real-mode success.
// ---------------------------------------------------------------------------
{
  const argvFile = path.join(tmpRoot, 'arm1-argv.txt');
  const r = runGate({ notifyCmd: makeArgvRecorderCmd(argvFile, 0) });
  assert.strictEqual(r.status, 0, 'a successful dispatch must exit 0; got ' + r.status + ' stdout=' + r.stdout);
  assert.match(r.stdout, /SENT/, 'a successful dispatch must print a SENT line');
  assert.ok(r.stdout.indexOf(FIXTURE_VERSION) !== -1, 'the SENT line must name the version');
  assert.match(r.stdout, /theo-resync/, 'the SENT line must name the theo-resync event');
  assert.match(r.stdout, /jsagir\/theo/, 'the SENT line must name jsagir/theo');
  const argvLines = readArgvLines(argvFile);
  assert.strictEqual(argvLines.length, 4, 'the recorded dispatch argv must be exactly four values; got ' + JSON.stringify(argvLines));
  ok('arm 1: real-mode success exits 0, prints SENT naming the version, theo-resync and jsagir/theo, and dispatches exactly four values');
}

// ---------------------------------------------------------------------------
// Arm 2: real-mode send failure.
// ---------------------------------------------------------------------------
{
  const r = runGate({ notifyCmd: 'exit 1' });
  arm2Result = r;
  assert.notStrictEqual(r.status, 0, 'a send failure must exit non-zero; got ' + r.status);
  assert.match(r.stdout, /SEND FAILURE/, 'a send failure must be a named SEND FAILURE');
  assert.match(r.stdout.toLowerCase(), /recovery/, 'a send failure must name a recovery instruction');
  assert.match(r.stdout, /--no-theo-notify/, 'a send failure must name the audited opt-out as the escape');
  ok('arm 2: real-mode send failure exits non-zero and names SEND FAILURE, a recovery instruction, and --no-theo-notify');
}

// ---------------------------------------------------------------------------
// Arm 3: dry-run never sends.
// ---------------------------------------------------------------------------
{
  const sentinel = path.join(tmpRoot, 'arm3-sentinel');
  const r = runGate({ dryRun: true, notifyCmd: 'touch "' + sentinel + '"; exit 0' });
  assert.strictEqual(r.status, 0, 'dry-run must exit 0; got ' + r.status + ' stdout=' + r.stdout);
  assert.match(r.stdout, /DRY RUN/, 'dry-run output must be named DRY RUN');
  assert.ok(
    !fs.existsSync(sentinel),
    'the dispatch sentinel must NOT exist under dry-run -- asserting only the exit code would pass against Pitfall 2'
  );
  ok('arm 3: dry-run exits 0, prints DRY RUN, and the dispatch command is proven never invoked (sentinel absent)');
}

// ---------------------------------------------------------------------------
// Arm 4: the audited opt-out.
// ---------------------------------------------------------------------------
{
  const sentinel = path.join(tmpRoot, 'arm4-sentinel');
  const r = runGate({ noNotify: true, notifyCmd: 'touch "' + sentinel + '"; exit 0' });
  arm4Result = r;
  assert.strictEqual(r.status, 0, 'an audited opt-out must exit 0; got ' + r.status);
  assert.match(r.stdout, /SKIPPED/, 'an audited opt-out must be visible as SKIPPED');
  assert.match(r.stdout, /--no-theo-notify/, 'an audited opt-out must name the literal flag');
  assert.ok(r.stdout.indexOf(FIXTURE_VERSION) !== -1, 'an audited opt-out must name the version passed in');
  assert.match(r.stdout, /Theo was NOT told/, 'an audited opt-out must state its consequence in a distinctive token');
  assert.ok(!fs.existsSync(sentinel), 'an opt-out must not send either -- the sentinel must not exist');
  ok('arm 4: the audited --no-theo-notify opt-out exits 0, names the flag, the version and a consequence, and never sends');
}

// ---------------------------------------------------------------------------
// Arm 5: the two failure classes never conflate, asserted in both directions.
// ---------------------------------------------------------------------------
{
  assert.ok(!/SKIPPED/.test(arm2Result.stdout), 'a SEND FAILURE arm must never contain SKIPPED');
  assert.ok(!/SEND FAILURE/.test(arm4Result.stdout), 'a SKIPPED arm must never contain SEND FAILURE');
  assert.ok(!/\bSENT\b/.test(arm4Result.stdout), 'a SKIPPED arm must never contain SENT');
  ok('arm 5: SEND FAILURE and SKIPPED are proven distinct in both directions, never appearing in each other\'s output');
}

// ---------------------------------------------------------------------------
// Arm 6: no timeout binary fails closed. Restricts the CHILD process's PATH
// to node's own bin directory only, resolving bash by absolute path so
// spawnSync does not need PATH to find the shell it launches (copied from
// tests/test-343-theo-stamp-gate.cjs arm 7 / WR-02).
// ---------------------------------------------------------------------------
{
  const nodeBinDir = path.dirname(process.execPath);
  const bashPath = (function () {
    for (const candidate of ['/usr/bin/bash', '/bin/bash']) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return 'bash';
  })();
  const sentinel = path.join(tmpRoot, 'arm6-sentinel');
  const env = Object.assign({}, process.env, { PATH: nodeBinDir });
  env.MINDRIAN_THEO_NOTIFY_CMD = 'touch "' + sentinel + '"; exit 0';
  delete env.MINDRIAN_THEO_NOTIFY_LOG;
  const script =
    '. "' + GATE_LIB + '"; mos_theo_notify_gate "' + REPO + '" "' + REPO_SHA + '" "' +
    FIXTURE_VERSION + '" "0" "0"';
  const start = Date.now();
  const r = cp.spawnSync(bashPath, ['-c', script], { encoding: 'utf8', env: env, timeout: 15000 });
  const elapsedMs = Date.now() - start;
  assert.notStrictEqual(
    r.status, 0,
    'with no timeout binary on PATH the gate must fail closed, never silently succeed; got ' +
      r.status + ' stdout=' + r.stdout + ' stderr=' + r.stderr
  );
  assert.match(r.stdout, /SEND FAILURE/, 'a missing timeout binary must be reported as a SEND FAILURE');
  assert.ok(!fs.existsSync(sentinel), 'a missing hang guard must never degrade to an unbounded send');
  assert.ok(elapsedMs < 5000, 'a missing timeout binary must return promptly; took ' + elapsedMs + 'ms');
  ok('arm 6: a missing timeout binary fails closed as a SEND FAILURE, never sends, and returns promptly');
}

// ---------------------------------------------------------------------------
// Arm 7: shell-metacharacter safety. A plugin_dir containing a single quote
// AND a space, and a new_version containing a shell metacharacter, neither
// of which may break out of the gate's own command construction.
// ---------------------------------------------------------------------------
{
  const fakePluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "mos-theo-notify-it's a room "));
  try {
    fs.mkdirSync(path.join(fakePluginDir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(fakePluginDir, 'data', 'command-registry.json'), '{"fixture":true}\n');
    function runFixtureGit(args) {
      const res = cp.spawnSync('git', args, { cwd: fakePluginDir, encoding: 'utf8' });
      assert.strictEqual(res.status, 0, 'git ' + args.join(' ') + ' failed in arm 7 fixture: ' + res.stderr);
      return res;
    }
    runFixtureGit(['init', '-q']);
    runFixtureGit(['config', 'user.email', 'test-349@example.invalid']);
    runFixtureGit(['config', 'user.name', 'Phase 349 Fixture']);
    runFixtureGit(['add', '-A']);
    runFixtureGit(['commit', '-q', '-m', 'fixture']);
    const fixtureSha = runFixtureGit(['rev-parse', 'HEAD']).stdout.trim();

    const pwnedVersion = '9.9.9-beta.0;echo PWNED';
    const argvFile = path.join(tmpRoot, 'arm7-argv.txt');
    const env = Object.assign({}, process.env);
    env.MINDRIAN_THEO_NOTIFY_CMD = makeArgvRecorderCmd(argvFile, 0);
    delete env.MINDRIAN_THEO_NOTIFY_LOG;
    const script =
      '. "' + GATE_LIB + '"; mos_theo_notify_gate "' + fakePluginDir + '" "' + fixtureSha +
      '" "' + pwnedVersion + '" "0" "0"';
    const r = cp.spawnSync('bash', ['-c', script], { encoding: 'utf8', env: env, timeout: 15000 });

    assert.ok(
      r.stdout.indexOf('PWNED') === -1 && r.stderr.indexOf('PWNED') === -1,
      'PWNED must never appear -- the metacharacter must never be executed; stdout=' + r.stdout + ' stderr=' + r.stderr
    );
    const argvLines = readArgvLines(argvFile);
    const versionArg = argvLines.filter(function (l) { return l.indexOf('version=') === 0; })[0];
    assert.ok(versionArg !== undefined, 'the recorded argv must contain a version= entry');
    assert.strictEqual(
      versionArg, 'version=' + pwnedVersion,
      'the recorded version must be the literal argument, byte for byte, semicolon intact and unexecuted'
    );
    ok('arm 7: a plugin_dir with a quote and a space, and a version with a shell metacharacter, neither break out nor get mangled');
  } finally {
    fs.rmSync(fakePluginDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Arm 8: the local audit log.
// ---------------------------------------------------------------------------
{
  const logPath = path.join(tmpRoot, 'arm8-log.txt');

  const argvSuccess = path.join(tmpRoot, 'arm8-argv-success.txt');
  const rSuccess = runGate({ notifyCmd: makeArgvRecorderCmd(argvSuccess, 0), notifyLog: logPath });
  assert.strictEqual(rSuccess.status, 0, 'arm 8 success leg must exit 0; got ' + rSuccess.status);
  assert.ok(fs.existsSync(logPath), 'the audit log must be created on a real-mode success');
  let lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
  let lastLine = lines[lines.length - 1];
  assert.ok(lastLine.indexOf(FIXTURE_VERSION) !== -1, 'the success log line must contain the version');
  assert.ok(lastLine.indexOf(REPO_SHA) !== -1, 'the success log line must contain the sha');
  assert.match(lastLine, /SENT/, 'the success log line must contain an outcome token');

  const rFailure = runGate({ notifyCmd: 'exit 1', notifyLog: logPath });
  assert.notStrictEqual(rFailure.status, 0, 'arm 8 failure leg must exit non-zero; got ' + rFailure.status);
  lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
  assert.ok(lines.length >= 2, 'a send failure must APPEND to the log, not overwrite it');
  lastLine = lines[lines.length - 1];
  assert.match(lastLine, /SEND FAILURE/, 'the failure log line must carry a failure outcome token');

  const dryRunLogPath = path.join(tmpRoot, 'arm8-log-dry-run.txt');
  const argvDry = path.join(tmpRoot, 'arm8-argv-dry-run.txt');
  const rDry = runGate({ dryRun: true, notifyCmd: makeArgvRecorderCmd(argvDry, 0), notifyLog: dryRunLogPath });
  assert.strictEqual(rDry.status, 0, 'arm 8 dry-run leg must exit 0; got ' + rDry.status);
  assert.ok(!fs.existsSync(dryRunLogPath), 'dry-run must NOT create the audit log');

  ok('arm 8: the local audit log is appended on success and on send failure, naming version/sha/outcome, and is never created under dry-run');
}

// ---------------------------------------------------------------------------
// Arm 9: token non-disclosure.
// ---------------------------------------------------------------------------
{
  const secretGh = 'SENTINEL-GH-TOKEN-' + Math.random().toString(36).slice(2);
  const secretGithub = 'SENTINEL-GITHUB-TOKEN-' + Math.random().toString(36).slice(2);
  const r = runGate({
    envExtra: { GH_TOKEN: secretGh, GITHUB_TOKEN: secretGithub },
    notifyCmd: 'echo "verbose body token=$GH_TOKEN alt=$GITHUB_TOKEN"; exit 0',
  });
  assert.ok(
    r.stdout.indexOf(secretGh) === -1 && r.stderr.indexOf(secretGh) === -1,
    'the GH_TOKEN sentinel must never appear in the gate\'s own stdout or stderr'
  );
  assert.ok(
    r.stdout.indexOf(secretGithub) === -1 && r.stderr.indexOf(secretGithub) === -1,
    'the GITHUB_TOKEN sentinel must never appear in the gate\'s own stdout or stderr'
  );
  ok('arm 9: GH_TOKEN and GITHUB_TOKEN sentinel values never surface in the gate\'s own stdout or stderr');
}

fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log('');
console.log(checks + ' checks passed.');
process.exit(0);
