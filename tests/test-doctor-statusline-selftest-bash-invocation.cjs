#!/usr/bin/env node
'use strict';

/*
 * F-A (windows-install-and-field-qa-sweep-2026-08-10, Test 1).
 *
 * lib/core/doctor/statusline-visibility-module.cjs's Step 3 isolated-execution
 * probe used to spawnSync() the resolved statusline-mos FILE PATH directly.
 * When the effective target is the plugin's bash script (settings.json ships
 * statusLine.command = 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"'),
 * Windows has no direct-exec association for an extensionless shebang script,
 * so the probe reports a false 'error' even though the real runtime (which
 * always execs through `bash`) renders the statusline fine (T1, Joe: "It's
 * calling the script directly instead of through Bash").
 *
 * This is the Windows-repro-by-proxy per the sweep's Test 1 spec: POSIX
 * suites cannot exec-fail a bash script, so this test asserts the INVOCATION
 * SHAPE instead of the platform -- a fake `bash` shim is placed first on
 * PATH, and it records every invocation before delegating to the real bash.
 * Given the effective statusline target is the plugin bash script, when the
 * class-G isolated-execution step runs, then the child MUST be spawned via
 * `bash` (argv[0] === 'bash', not the script path) and the probe returns
 * 'ok' on this POSIX runner.
 *
 * Pass/failTest counter style mirrors tests/test-check-version-latest-resolution.cjs.
 * Canon Part 8: zero network; local spawn only, mirroring existing behavior.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

const MODULE_PATH = path.join(__dirname, '..', 'lib', 'core', 'doctor', 'statusline-visibility-module.cjs');

// Locate the real bash so the shim can delegate to it after recording the call.
let REAL_BASH;
try {
  REAL_BASH = execFileSync('command', ['-v', 'bash'], { shell: '/bin/sh', encoding: 'utf8' }).trim();
} catch (_e) {
  REAL_BASH = '/bin/bash';
}

function buildSandbox() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-statusline-selftest-'));
  const fakeRoot = path.join(base, 'plugin-root');
  const fakeHome = path.join(base, 'home');
  const fakeBin = path.join(base, 'bin');
  fs.mkdirSync(path.join(fakeRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(fakeHome, { recursive: true });
  fs.mkdirSync(fakeBin, { recursive: true });

  // The plugin's own settings.json, shaped exactly like the checked-in one:
  // bash-wrapped statusLine.command.
  fs.writeFileSync(path.join(fakeRoot, 'settings.json'), JSON.stringify({
    agent: 'larry-extended',
    statusLine: {
      type: 'command',
      command: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"',
    },
  }, null, 2));

  // A real bash script standing in for scripts/statusline-mos: reads the
  // SYNTHETIC stdin JSON, exits 0, emits the brand-hexagon prefix.
  const statuslineMos = path.join(fakeRoot, 'scripts', 'statusline-mos');
  fs.writeFileSync(statuslineMos, '#!/usr/bin/env bash\ncat >/dev/null\nprintf "\\xe2\\xac\\xa1 larry"\n');
  fs.chmodSync(statuslineMos, 0o644); // deliberately NOT executable -- direct spawnSync
  // would EACCES/ENOENT-class fail here (the Windows-analog failure mode);
  // only invocation through `bash` (which reads+execs non-executable files)
  // succeeds. This is the POSIX proxy for the Windows direct-exec failure.

  const logFile = path.join(base, 'bash-invocations.log');
  const shim = path.join(fakeBin, 'bash');
  fs.writeFileSync(shim,
    '#!/usr/bin/env bash\n' +
    'echo "argv0=bash args=$*" >> ' + JSON.stringify(logFile) + '\n' +
    'exec ' + JSON.stringify(REAL_BASH) + ' "$@"\n'
  );
  fs.chmodSync(shim, 0o755);

  return { base, fakeRoot, fakeHome, fakeBin, logFile, statuslineMos };
}

(function testBashInvocationShape() {
  const sb = buildSandbox();
  const savedEnv = {
    CLAUDE_PLUGIN_ROOT: process.env.CLAUDE_PLUGIN_ROOT,
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    MINDRIAN_STATUSLINE_SURFACE: process.env.MINDRIAN_STATUSLINE_SURFACE,
  };
  try {
    process.env.CLAUDE_PLUGIN_ROOT = sb.fakeRoot;
    process.env.HOME = sb.fakeHome;
    process.env.PATH = sb.fakeBin + path.delimiter + process.env.PATH;
    process.env.MINDRIAN_STATUSLINE_SURFACE = 'CLI'; // force CLI surface deterministically

    delete require.cache[require.resolve(MODULE_PATH)];
    const mod = require(MODULE_PATH);

    const result = mod.check({});

    assert.ok(fs.existsSync(sb.logFile),
      'the bash shim was invoked at all (argv[0] === "bash"); log file missing means the ' +
      'probe still direct-execs the script path instead of routing through bash');
    const logContents = fs.readFileSync(sb.logFile, 'utf8');
    assert.ok(logContents.indexOf(sb.statuslineMos) !== -1,
      'the bash invocation carries the statusline-mos script path as an argument; got: ' + logContents);
    pass('Test 1a (child is spawned via bash, not direct -- argv[0] is bash)');

    assert.strictEqual(result.status, 'ok',
      'on a POSIX runner, routing through bash resolves the non-executable script and the ' +
      'probe returns ok; got: ' + JSON.stringify(result));
    pass('Test 1b (probe returns ok when routed through bash on POSIX)');
  } catch (err) {
    failTest('Test 1 (F-A bash invocation shape)', err);
  } finally {
    for (const k of Object.keys(savedEnv)) {
      if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
    }
    delete require.cache[require.resolve(MODULE_PATH)];
  }
}());

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
