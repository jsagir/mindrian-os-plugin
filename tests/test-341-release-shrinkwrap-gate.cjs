#!/usr/bin/env node
'use strict';

/*
 * Phase 341 Plan 05 -- unit suite for scripts/release-lib/shrinkwrap-gate.sh's
 * `mos_generate_shrinkwrap`, the injectable shrinkwrap-generation-plus-
 * assertion function that replaces release.sh Step 6.7's retired vendoring.
 *
 * Every case spawns `bash -c` on a small driver that sources the library,
 * defines fake hooks (no real npm anywhere in this file), calls the
 * function, and echoes `rc=$?`. Zero network, zero real npm shrinkwrap,
 * zero real npm pack.
 *
 * Return-code contract under test: 0 = shrinkwrap generated + all three
 * assertions passed; 1 = fail closed (no warn code -- a missing lockfile in
 * the tarball is not a warning).
 *
 * Registered in tests/run-all-341.sh.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const LIB = path.join(REPO_ROOT, 'scripts', 'release-lib', 'shrinkwrap-gate.sh');

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

function mkPluginDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos341-shrinkwrap-'));
}

// Runs a bash driver that sources the library and executes `script`.
function runDriver(script) {
  const full = ['set -uo pipefail', '. "' + LIB + '"', script].join('\n');
  const r = spawnSync('bash', ['-c', full], { encoding: 'utf8', timeout: 30000 });
  return { status: r.status, stdout: (r.stdout || '') + (r.stderr || '') };
}

// --------------------- Arm 1: shrinkwrap hook fails -----------------------

run('Arm 1 (shrinkwrap hook returns non-zero -> rc 1, "npm shrinkwrap failed")', function () {
  const dir = mkPluginDir();
  try {
    const script = [
      'shrinkwrap_fail() { return 1; }',
      'export MOS_SHRINKWRAP_HOOK=shrinkwrap_fail',
      'export MOS_PACK_PROBE_HOOK=pack_unused',
      'pack_unused() { echo "[]"; }',
      'export -f pack_unused',
      'rc=0',
      'mos_generate_shrinkwrap "' + dir + '" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (r.stdout.indexOf('npm shrinkwrap failed') === -1) throw new Error('expected "npm shrinkwrap failed", got:\n' + r.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Arm 2: dev-only entry present -----------------------

run('Arm 2 (planted npm-shrinkwrap.json has a dev:true entry -> rc 1, "dev-only packages")', function () {
  const dir = mkPluginDir();
  try {
    fs.writeFileSync(
      path.join(dir, 'npm-shrinkwrap.json'),
      JSON.stringify({ packages: { 'node_modules/some-dev-pkg': { dev: true } } }, null, 2)
    );
    const script = [
      'shrinkwrap_ok() { return 0; }',
      'export MOS_SHRINKWRAP_HOOK=shrinkwrap_ok',
      'rc=0',
      'mos_generate_shrinkwrap "' + dir + '" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (r.stdout.indexOf('dev-only packages') === -1) throw new Error('expected "dev-only packages", got:\n' + r.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Arm 3: lockfile missing from pack payload -----------

run('Arm 3 (pack probe reports no npm-shrinkwrap.json -> rc 1, "NOT in the pack payload")', function () {
  const dir = mkPluginDir();
  try {
    fs.writeFileSync(
      path.join(dir, 'npm-shrinkwrap.json'),
      JSON.stringify({ packages: { 'node_modules/clean-pkg': { dev: false } } }, null, 2)
    );
    const script = [
      'shrinkwrap_ok() { return 0; }',
      'pack_no_lockfile() { echo \'[{"files":[{"path":"package.json"}]}]\'; }',
      'export MOS_SHRINKWRAP_HOOK=shrinkwrap_ok',
      'export MOS_PACK_PROBE_HOOK=pack_no_lockfile',
      'rc=0',
      'mos_generate_shrinkwrap "' + dir + '" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script);
    if (r.stdout.indexOf('rc=1') === -1) throw new Error('expected rc=1, got:\n' + r.stdout);
    if (r.stdout.indexOf('NOT in the pack payload') === -1) throw new Error('expected "NOT in the pack payload", got:\n' + r.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Arm 4: all three pass --------------------------------

run('Arm 4 (all three assertions pass -> rc 0, npm-shrinkwrap.json staged)', function () {
  const dir = mkPluginDir();
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    spawnSync('git', ['config', 'user.email', 'test@test.invalid'], { cwd: dir });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    fs.writeFileSync(
      path.join(dir, 'npm-shrinkwrap.json'),
      JSON.stringify({ packages: { 'node_modules/clean-pkg': { dev: false } } }, null, 2)
    );
    const script = [
      'shrinkwrap_ok() { return 0; }',
      'pack_with_lockfile() { echo \'[{"files":[{"path":"package.json"},{"path":"npm-shrinkwrap.json"}]}]\'; }',
      'export MOS_SHRINKWRAP_HOOK=shrinkwrap_ok',
      'export MOS_PACK_PROBE_HOOK=pack_with_lockfile',
      'rc=0',
      'mos_generate_shrinkwrap "' + dir + '" || rc=$?',
      'echo "rc=$rc"',
    ].join('\n');
    const r = runDriver(script);
    if (r.stdout.indexOf('rc=0') === -1) throw new Error('expected rc=0, got:\n' + r.stdout);
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: dir, encoding: 'utf8' });
    if ((staged.stdout || '').indexOf('npm-shrinkwrap.json') === -1) {
      throw new Error('expected npm-shrinkwrap.json to be staged, got:\n' + staged.stdout);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --------------------- Arm 5: safe to source twice, safe under set -u ------

run('Arm 5 (safe to source twice, safe under set -u, no unbound-variable error)', function () {
  const full = [
    'set -uo pipefail',
    '. "' + LIB + '"',
    '. "' + LIB + '"',
    'shrinkwrap_ok5() { return 0; }',
    'pack_ok5() { echo \'[{"files":[{"path":"npm-shrinkwrap.json"}]}]\'; }',
    'export MOS_SHRINKWRAP_HOOK=shrinkwrap_ok5',
    'export MOS_PACK_PROBE_HOOK=pack_ok5',
    'DIR="' + fs.mkdtempSync(path.join(os.tmpdir(), 'mos341-shrinkwrap-src2-')) + '"',
    'echo \'{"packages":{}}\' > "$DIR/npm-shrinkwrap.json"',
    'git init -q "$DIR"',
    'git -C "$DIR" config user.email test@test.invalid',
    'git -C "$DIR" config user.name Test',
    'rc=0',
    'mos_generate_shrinkwrap "$DIR" || rc=$?',
    'echo "rc=$rc"',
  ].join('\n');
  const r = spawnSync('bash', ['-c', full], { encoding: 'utf8', timeout: 30000 });
  const out = (r.stdout || '') + (r.stderr || '');
  if (out.indexOf('unbound variable') !== -1) throw new Error('unbound-variable error sourcing twice:\n' + out);
  if (out.indexOf('rc=0') === -1) throw new Error('expected rc=0, got:\n' + out);
});

// ------------------------ Summary ----------------------------------------

process.on('exit', function () {
  process.stdout.write('\n');
  process.stdout.write('Total: ' + total + '  Passed: ' + (total - failures) + '  Failed: ' + failures + '\n');
  if (failures > 0) process.exitCode = 1;
});
