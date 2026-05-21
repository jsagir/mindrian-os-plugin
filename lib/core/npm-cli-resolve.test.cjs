#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Regression tests for lib/core/npm-cli-resolve.cjs -- portable npm CLI
 * resolution (debug session mcp-servers-cache-missing-node-modules, escalated
 * mandate 2026-05-21).
 *
 * The prior Option D fix (commit f6cafe74) ran a bare `spawnSync('npm', ...)`
 * that was DEAD on Windows (npm is npm.cmd) and FRAGILE on Mac (PATH gap for
 * GUI-launched Claude Code). These tests lock the cross-platform contract:
 *
 *   Test 1: resolveNpmCli on the test host returns the 'node-npm-cli' strategy
 *           and the resolved npm-cli.js actually exists.
 *   Test 2: the resolved command equals process.execPath (the current node
 *           binary) -- NOT the literal string 'npm'. This is what makes it
 *           PATH-independent.
 *   Test 3: WINDOWS layout -- npmCliCandidates for a win32-style execPath puts
 *           `<nodeBinDir>/node_modules/npm/bin/npm-cli.js` first (where the
 *           Windows node installer ships npm). No `.cmd` anywhere in the argv.
 *   Test 4: buildInstallArgs produces `[<npm-cli.js>] install --no-audit
 *           --no-fund --silent` for the node-npm-cli strategy.
 *   Test 5: the fallback descriptor (path-npm) sets shell:true ONLY on win32,
 *           so even the fallback carries Windows .cmd handling.
 *   Test 6: no em-dashes in npm-cli-resolve.cjs (HARD RULE).
 *   Test 7: the argv never contains the bare token 'npm' as command on the
 *           node-npm-cli strategy -- proves PATH is not relied upon.
 *
 * HARD RULE: no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'npm-cli-resolve.cjs');
const { resolveNpmCli, buildInstallArgs, npmCliCandidates } = require(MODULE_PATH);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  process.stdout.write('    ' + (err && err.message ? err.message : String(err)) + '\n');
}
function test(name, fn) {
  try { fn(); ok(name); } catch (err) { fail(name, err); }
}

// Test 1 -- node-npm-cli strategy on the test host, npm-cli.js exists.
test('resolveNpmCli returns node-npm-cli strategy with a real npm-cli.js', () => {
  const r = resolveNpmCli();
  assert.equal(r.strategy, 'node-npm-cli', 'expected node-npm-cli strategy on a normal node install');
  assert.ok(r.npmCli, 'npmCli path should be set');
  assert.ok(fs.existsSync(r.npmCli), 'resolved npm-cli.js must exist on disk: ' + r.npmCli);
});

// Test 2 -- command is the node binary, not the literal 'npm'.
test('resolveNpmCli command is process.execPath (PATH-independent)', () => {
  const r = resolveNpmCli();
  assert.equal(r.command, process.execPath, 'command must be the current node binary');
  assert.notEqual(r.command, 'npm', 'command must NOT be the bare PATH-dependent string npm');
  assert.equal(r.shell, false, 'node-npm-cli strategy needs no shell');
});

// Test 3 -- Windows layout: npm-cli.js beside node.exe is the first candidate.
test('npmCliCandidates puts the Windows-layout path first', () => {
  // path.win32 mirrors what require('path') resolves to on a real Windows host.
  const winExec = 'C:\\Program Files\\nodejs\\node.exe';
  const cands = npmCliCandidates(winExec);
  assert.ok(Array.isArray(cands) && cands.length >= 3, 'expected >= 3 candidates');
  // The first candidate is the <nodeBinDir>/node_modules/npm/bin/npm-cli.js
  // layout -- exactly where the Windows node installer ships npm.
  assert.ok(
    cands[0].indexOf('node_modules') !== -1 && cands[0].indexOf('npm-cli.js') !== -1,
    'first candidate must target node_modules/npm/bin/npm-cli.js'
  );
  // No candidate is a .cmd file -- we always run the JS entry point directly.
  for (const c of cands) {
    assert.ok(c.indexOf('.cmd') === -1, 'no candidate may be a .cmd batch file: ' + c);
  }
});

// Test 4 -- buildInstallArgs argv shape for the node-npm-cli strategy.
test('buildInstallArgs produces [npm-cli.js] install ...quiet-flags', () => {
  const r = resolveNpmCli();
  const argv = buildInstallArgs(r);
  assert.equal(argv[0], r.npmCli, 'first arg must be the npm-cli.js path');
  assert.equal(argv[1], 'install', 'second arg must be install');
  assert.deepEqual(
    argv.slice(2),
    ['--no-audit', '--no-fund', '--silent'],
    'default install args must be the quiet production set'
  );
  // A custom install-args override is honored.
  const custom = buildInstallArgs(r, ['--omit=dev']);
  assert.deepEqual(custom.slice(1), ['install', '--omit=dev']);
});

// Test 5 -- fallback descriptor: shell:true only on Windows.
test('path-npm fallback sets shell:true only on win32', () => {
  // Force the fallback by pointing execPath at a freshly-created EMPTY temp
  // directory tree deep enough that none of the candidate paths (including the
  // `../lib/node_modules/...` POSIX-layout candidate) can escape onto a real
  // system npm. The temp dir is isolated and known to contain no node_modules.
  const os = require('node:os');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-npm-resolve-test-'));
  try {
    // <tmpRoot>/x/y/z/bin/node -- candidates resolve under <tmpRoot>/x/y/z,
    // which is empty, so resolveNpmCli must fall through to path-npm.
    const fakeBin = path.join(tmpRoot, 'x', 'y', 'z', 'bin');
    fs.mkdirSync(fakeBin, { recursive: true });
    const r = resolveNpmCli({ execPath: path.join(fakeBin, 'node') });
    assert.equal(r.strategy, 'path-npm', 'expected the path-npm fallback in an isolated empty tree');
    assert.equal(r.command, 'npm', 'fallback command is the bare npm');
    assert.equal(r.npmCli, null, 'fallback has no npmCli path');
    assert.equal(
      r.shell,
      process.platform === 'win32',
      'fallback shell must be true on Windows (npm.cmd handling) and false elsewhere'
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// Test 6 -- HARD RULE: no em-dashes. The em-dash is referenced via its Unicode
// code point (U+2014) so this test file itself stays em-dash-clean.
test('npm-cli-resolve.cjs has no em-dashes', () => {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const EM_DASH = String.fromCharCode(0x2014);
  assert.ok(src.indexOf(EM_DASH) === -1, 'em-dash found in npm-cli-resolve.cjs');
});

// Test 7 -- the node-npm-cli argv never relies on a bare 'npm' token.
test('node-npm-cli argv does not depend on PATH resolution of npm', () => {
  const r = resolveNpmCli();
  const fullArgv = [r.command].concat(buildInstallArgs(r));
  assert.notEqual(fullArgv[0], 'npm', 'command position must not be the bare npm token');
  // The npm-cli.js path is absolute -- not resolved against PATH or cwd.
  assert.ok(path.isAbsolute(r.npmCli), 'npm-cli.js path must be absolute');
});

process.stdout.write('\nnpm-cli-resolve: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
