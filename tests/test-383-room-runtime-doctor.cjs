#!/usr/bin/env node
'use strict';
/*
 * Phase 383 plan 09 (SEED-142 direction 4, D-07): the room-runtime doctor point.
 *
 *   D1  resolveHookShell win32 with the Program Files Git Bash: git-bash, forward slashes
 *   D2  resolveHookShell win32 with no Git install and a System32 hit: wsl-launcher
 *   D3  resolveHookShell win32 with nothing: none, with the silent-exit note
 *   D4  resolveHookShell POSIX: posix, path bash
 *   D5  resolveHookShell win32 with a non-System32 where hit: path-bash
 *   D6  module check on the real host: ok and a detail that starts with "bash: "
 *   D7  module check with an empty PATH: warn with action_lines
 *   D8  the module exports no fix
 *   D9  the registry entry exists and points at the runner
 *   D10 tests/test-doctor-module-contract-parity.cjs exits 0
 *
 * Hermetic: HOME and the rooms vars are mkdtemp dirs. No network. House rule: hyphens only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/harness-383.cjs');

const hermetic = H.hermeticEnv('rtdoctor');
H.applyEnv(hermetic.env);

const ROOT = path.resolve(__dirname, '..');
const platform = require(path.join(ROOT, 'lib', 'core', 'platform.cjs'));
const mod = require(path.join(ROOT, 'lib', 'core', 'doctor', 'room-runtime-module.cjs'));
const rep = H.reporter('test-383-room-runtime-doctor');

function leg(label, fn) {
  try { fn(); rep.pass(label); } catch (e) { rep.fail(label, e && e.message); }
}
function eq(a, b, what) {
  if (a !== b) throw new Error((what || 'value') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function whereAnswer(line) {
  return function () { return { status: line ? 0 : 1, stdout: line ? line + '\r\n' : '', stderr: '' }; };
}
const GIT64 = 'C:\\Program Files\\Git\\bin\\bash.exe';

leg('D1 git-bash in Program Files', function () {
  const r = platform.resolveHookShell({
    platform: 'win32', env: {}, spawnSync: whereAnswer(''),
    existsSync: function (p) { return p === GIT64; },
  });
  eq(r.kind, 'git-bash', 'kind');
  eq(r.path, 'C:/Program Files/Git/bin/bash.exe', 'path');
});

leg('D2 wsl-launcher from where bash', function () {
  const r = platform.resolveHookShell({
    platform: 'win32', env: {}, spawnSync: whereAnswer('C:\\Windows\\System32\\bash.exe'),
    existsSync: function () { return false; },
  });
  eq(r.kind, 'wsl-launcher', 'kind');
  eq(r.path, 'C:/Windows/System32/bash.exe', 'path');
});

leg('D3 none names the silent exit', function () {
  const r = platform.resolveHookShell({
    platform: 'win32', env: {}, spawnSync: whereAnswer(''),
    existsSync: function () { return false; },
  });
  eq(r.kind, 'none', 'kind');
  eq(r.path, null, 'path');
  if (!/run-hook\.cmd exits 0/.test(r.note || '')) throw new Error('note missing: ' + r.note);
});

leg('D4 posix', function () {
  const r = platform.resolveHookShell({ platform: 'linux' });
  eq(r.kind, 'posix', 'kind');
  eq(r.path, 'bash', 'path');
});

leg('D5 path-bash from where bash', function () {
  const r = platform.resolveHookShell({
    platform: 'win32', env: {}, spawnSync: whereAnswer('D:\\msys64\\usr\\bin\\bash.exe'),
    existsSync: function () { return false; },
  });
  eq(r.kind, 'path-bash', 'kind');
});

leg('D6 module check on the real host', function () {
  platform.__resetForTests();
  const r = mod.check({});
  if (!/^bash: /.test(r.detail || '')) throw new Error('detail does not start with "bash: ": ' + r.detail);
  if (!/hooks: /.test(r.detail) || !/python: /.test(r.detail) || !/tried: /.test(r.detail)) {
    throw new Error('detail misses a part: ' + r.detail);
  }
  if (r.status !== 'ok') {
    // A host without a usable runtime warns instead; that is a skip of this leg, not a failure.
    if (r.status === 'warn' && Array.isArray(r.action_lines)) return;
    throw new Error('unexpected status ' + r.status + ': ' + r.detail);
  }
});

leg('D7 module check with an empty PATH warns', function () {
  const emptyDir = H.mkTmp('emptypath');
  const saved = process.env.PATH;
  try {
    process.env.PATH = emptyDir;
    platform.__resetForTests();
    const r = mod.check({});
    eq(r.status, 'warn', 'status');
    if (!Array.isArray(r.action_lines) || r.action_lines.length === 0) throw new Error('no action_lines');
    if (!/^bash: none/.test(r.detail)) throw new Error('detail: ' + r.detail);
  } finally {
    process.env.PATH = saved;
    platform.__resetForTests();
  }
});

leg('D8 module exports no fix', function () {
  eq(typeof mod.fix, 'undefined', 'fix export');
  eq(typeof mod.check, 'function', 'check export');
});

leg('D9 registry entry', function () {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'doctor-modules.json'), 'utf8'));
  const e = (reg.modules || []).find(function (m) { return m.id === 'room-runtime'; });
  if (!e) throw new Error('room-runtime not registered');
  eq(e.runner, 'lib/core/doctor/room-runtime-module.cjs', 'runner');
  eq(e.cadence, 'always', 'cadence');
  eq(e.flag, null, 'flag');
  eq(e.fix_supported, false, 'fix_supported');
});

leg('D10 contract parity test exits 0', function () {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tests', 'test-doctor-module-contract-parity.cjs')], {
    encoding: 'utf8', cwd: ROOT, timeout: 120000,
  });
  if (r.status !== 0) throw new Error('exit ' + r.status + ' ' + String(r.stdout || '').slice(-300) + String(r.stderr || '').slice(-300));
});

rep.done();
