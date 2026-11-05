#!/usr/bin/env node
'use strict';
/*
 * Phase 383 plan 01 (QA383-01, D-03): the room-runtime resolver contract.
 *
 * lib/core/platform.cjs resolveRoomRuntime(opts) finds a working bash and a working Python 3.9 or
 * newer, rejects the WSL launcher and the Microsoft Store stub, and says so in plain words when it
 * finds none. spawnRoomRegistry(args, opts) is the one helper that spawns scripts/room-registry.
 * Platform, env, spawnSync and existsSync are injected, so the Windows logic runs on any host.
 *
 *   R0  the three functions exist
 *   R1  win32: a Git install wins over the System32 launcher
 *   R2  win32: the WSL launcher and the WindowsApps shim are rejected with no spawn
 *   R3  win32: MINDRIAN_BASH that answers a non-msys ostype is rejected, the next candidate is tried
 *   R4  win32 python: the Store stub is rejected, the next python is accepted, sys.executable is used
 *   R5  win32 python: py -3 is accepted when python3 and python fail
 *   R6  python below 3.9 is below_floor
 *   R7  every not-ok plain text has 3 lines (what, Why, Fix) and no path
 *   R8  POSIX: bash and python3 are accepted by name, no sys.executable probe
 *   R9  memo: an ok default call is cached; refresh re-probes; a failure is dropped when PATH changes
 *   R10 the platform banner path does not call the resolver
 *   R11 toBashPath
 *   R12 spawnRoomRegistry with a not-ok runtime spawns nothing
 *   R13 spawnRoomRegistry on win32 passes forward-slash paths, MINDRIAN_PYTHON, no shell
 *   R14 CLI: room-runtime exits 1 with the plain text when nothing works
 *   R15 review WR-01: a UNC rooms home and a UNC room dir reach bash with forward slashes only
 *   R16 review WR-02: a failed resolution is cached for a short window, refresh re-probes, the window ends
 *
 * Hermetic: HOME and the rooms vars are mkdtemp dirs before any repo require. No network.
 * House rule: hyphens only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/harness-383.cjs');

const hermetic = H.hermeticEnv('resolver');
H.applyEnv(hermetic.env);

const ROOT = path.resolve(__dirname, '..');
const PLATFORM_PATH = path.join(ROOT, 'lib', 'core', 'platform.cjs');
const platform = require(PLATFORM_PATH);
const rep = H.reporter('test-383-runtime-resolver');

const PLAIN_NO_BASH_WIN32 = 'Room creation cannot start on this computer yet.\n  Why: it needs Git Bash, and no working Git Bash was found.\n  Fix: install Git for Windows from git-scm.com, then ask for the room again.';
const PLAIN_NO_BASH_POSIX = 'Room creation cannot start on this computer yet.\n  Why: it needs bash, and no working bash was found.\n  Fix: install bash, then ask for the room again.';
const PLAIN_NO_PYTHON = 'Room creation cannot start on this computer yet.\n  Why: it needs Python 3.9 or newer, and no working Python was found.\n  Fix: install Python 3 from python.org, then ask for the room again.';

const BASH_WIN = 'C:/Program Files/Git/bin/bash.exe';
const STORE_TEXT = 'Python was not found; run without arguments to install from the Microsoft Store';

function norm(s) { return String(s).replace(/\\/g, '/'); }
function out(stdout, status, stderr) { return { status: status === undefined ? 0 : status, stdout: stdout || '', stderr: stderr || '' }; }
const ENOENT = function () { return { error: { code: 'ENOENT' }, status: null, stdout: '', stderr: '' }; };

// A fake spawnSync from a table keyed by "cmd argv-joined". The cmd is compared with slashes
// normalized, so a table key written with forward slashes matches either spelling.
function fakeSpawn(table) {
  const calls = [];
  const fn = function (cmd, argv) {
    const key = norm(cmd) + ' ' + (argv || []).join(' ');
    calls.push(key);
    if (Object.prototype.hasOwnProperty.call(table, key)) {
      const v = table[key];
      return typeof v === 'function' ? v() : v;
    }
    return ENOENT();
  };
  fn.calls = calls;
  return fn;
}
function fakeExists(list) {
  const set = new Set(list.map(function (p) { return norm(p).toLowerCase(); }));
  return function (p) { return set.has(norm(p).toLowerCase()); };
}
function winEnv(extra) {
  return Object.assign({
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local',
  }, extra || {});
}
// Table rows that make one python command work on win32.
function pyRows(cmd, pre, ver, exe) {
  const p = pre && pre.length ? pre.join(' ') + ' ' : '';
  const t = {};
  t[cmd + ' ' + p + '--version'] = out('Python ' + ver + '\n');
  t[cmd + ' ' + p + '-c import sys;print(sys.executable)'] = out(exe + '\r\n');
  return t;
}
function bashRows(candidate, ostype) {
  const t = {};
  t[norm(candidate) + ' -c echo $OSTYPE'] = out(ostype + '\n');
  return t;
}
function merge() { return Object.assign.apply(null, [{}].concat([].slice.call(arguments))); }
function resetPlatform() { if (typeof platform.__resetForTests === 'function') platform.__resetForTests(); }
function need(name) {
  if (typeof platform[name] !== 'function') throw new Error('lib/core/platform.cjs does not export ' + name + ' (D-03 not implemented yet)');
  return platform[name];
}
function eq(actual, expected, what) {
  if (actual !== expected) throw new Error(what + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
function ok(cond, what) { if (!cond) throw new Error(what); }
function find(tried, kind, re) {
  return (tried || []).filter(function (t) { return t.kind === kind && re.test(String(t.cmd)); })[0];
}

const legs = [];
function leg(label, fn) { legs.push({ label: label, fn: fn }); }

leg('R0 platform exports resolveRoomRuntime, spawnRoomRegistry and toBashPath', function () {
  for (const n of ['resolveRoomRuntime', 'spawnRoomRegistry', 'toBashPath']) {
    ok(typeof platform[n] === 'function', n + ' is ' + typeof platform[n]);
  }
});

leg('R1 win32: a Git install wins over the System32 launcher', function () {
  const resolve = need('resolveRoomRuntime');
  const spawnSync = fakeSpawn(merge(
    { 'where bash': out('C:\\Windows\\System32\\bash.exe\r\n') },
    bashRows(BASH_WIN, 'msys'),
    pyRows('python3', [], '3.12.3', 'C:\\Python312\\python.exe')));
  const r = resolve({ platform: 'win32', env: winEnv(), spawnSync: spawnSync, existsSync: fakeExists(['C:\\Program Files\\Git\\bin\\bash.exe']) });
  eq(r.ok, true, 'ok');
  eq(r.bash && r.bash.path, BASH_WIN, 'bash.path');
  eq(r.bash && r.bash.ostype, 'msys', 'bash.ostype');
});

leg('R2 win32: the WSL launcher and the WindowsApps shim are rejected with no spawn', function () {
  const resolve = need('resolveRoomRuntime');
  const spawnSync = fakeSpawn(merge(
    { 'where bash': out('C:\\Windows\\System32\\bash.exe\r\nC:\\Users\\u\\AppData\\Local\\Microsoft\\WindowsApps\\bash.exe\r\n') },
    pyRows('python3', [], '3.12.3', 'C:\\Python312\\python.exe')));
  const r = resolve({ platform: 'win32', env: winEnv(), spawnSync: spawnSync, existsSync: fakeExists([]) });
  eq(r.ok, false, 'ok');
  eq(r.reason, 'no_bash', 'reason');
  const sys32 = find(r.tried, 'bash', /System32/i);
  const apps = find(r.tried, 'bash', /WindowsApps/i);
  ok(sys32 && sys32.result === 'rejected_wsl', 'System32 launcher in tried as rejected_wsl: ' + JSON.stringify(r.tried));
  ok(apps && apps.result === 'rejected_wsl', 'WindowsApps shim in tried as rejected_wsl: ' + JSON.stringify(r.tried));
  const probes = spawnSync.calls.filter(function (k) { return /System32|WindowsApps/i.test(k) && /-c echo/.test(k); });
  eq(probes.length, 0, 'probe spawns for rejected launchers');
  eq(r.plain, PLAIN_NO_BASH_WIN32, 'plain');
});

leg('R3 win32: MINDRIAN_BASH that answers a non-msys ostype is rejected, the next candidate is tried', function () {
  const resolve = need('resolveRoomRuntime');
  const spawnSync = fakeSpawn(merge(
    bashRows('D:/tools/bash.exe', 'linux-gnu'),
    bashRows(BASH_WIN, 'msys'),
    pyRows('python3', [], '3.12.3', 'C:\\Python312\\python.exe')));
  const r = resolve({
    platform: 'win32', env: winEnv({ MINDRIAN_BASH: 'D:\\tools\\bash.exe' }), spawnSync: spawnSync,
    existsSync: fakeExists(['D:\\tools\\bash.exe', 'C:\\Program Files\\Git\\bin\\bash.exe']),
  });
  const first = find(r.tried, 'bash', /^D:[\\/]tools[\\/]bash\.exe$/i);
  ok(first && first.result === 'rejected_wsl', 'MINDRIAN_BASH entry is rejected_wsl: ' + JSON.stringify(r.tried));
  eq(r.ok, true, 'ok');
  eq(r.bash && r.bash.path, BASH_WIN, 'bash.path after the rejection');
});

leg('R4 win32 python: the Store stub is rejected, python is accepted, sys.executable is the path', function () {
  const resolve = need('resolveRoomRuntime');
  const spawnSync = fakeSpawn(merge(
    bashRows(BASH_WIN, 'msys'),
    { 'python3 --version': out('', 9009, STORE_TEXT) },
    pyRows('python', [], '3.13.6', 'C:\\Python313\\python.exe')));
  const r = resolve({ platform: 'win32', env: winEnv(), spawnSync: spawnSync, existsSync: fakeExists(['C:\\Program Files\\Git\\bin\\bash.exe']) });
  const stub = find(r.tried, 'python', /^python3$/);
  ok(stub && stub.result === 'rejected_store_stub', 'python3 is rejected_store_stub: ' + JSON.stringify(r.tried));
  eq(r.ok, true, 'ok');
  eq(r.python && r.python.path, 'C:/Python313/python.exe', 'python.path');
  eq(r.python && r.python.version, '3.13', 'python.version');
  eq(r.python && r.python.version_line, 'Python 3.13.6', 'python.version_line');
});

leg('R5 win32 python: py -3 is accepted when python3 and python fail', function () {
  const resolve = need('resolveRoomRuntime');
  const spawnSync = fakeSpawn(merge(
    bashRows(BASH_WIN, 'msys'),
    { 'python3 --version': out('', 9009, STORE_TEXT) },
    pyRows('py', ['-3'], '3.12.1', 'C:\\Python312\\python.exe')));
  const r = resolve({ platform: 'win32', env: winEnv(), spawnSync: spawnSync, existsSync: fakeExists(['C:\\Program Files\\Git\\bin\\bash.exe']) });
  eq(r.ok, true, 'ok');
  eq(r.python && r.python.cmd, 'py', 'python.cmd');
  eq(JSON.stringify(r.python && r.python.pre), JSON.stringify(['-3']), 'python.pre');
  eq(r.python && r.python.path, 'C:/Python312/python.exe', 'python.path');
});

leg('R6 python below 3.9 is below_floor, reason no_python, exact plain text', function () {
  const resolve = need('resolveRoomRuntime');
  const spawnSync = fakeSpawn(merge(
    bashRows('bash', 'linux-gnu'),
    { 'python3 --version': out('Python 3.8.10\n') }));
  const r = resolve({ platform: 'linux', env: {}, spawnSync: spawnSync, existsSync: fakeExists([]) });
  const low = find(r.tried, 'python', /^python3$/);
  ok(low && low.result === 'below_floor', 'python3 is below_floor: ' + JSON.stringify(r.tried));
  eq(r.ok, false, 'ok');
  eq(r.reason, 'no_python', 'reason');
  eq(r.plain, PLAIN_NO_PYTHON, 'plain');
});

leg('R7 every not-ok plain text has 3 lines (what, Why, Fix) and no path', function () {
  const resolve = need('resolveRoomRuntime');
  const noBashWin = resolve({
    platform: 'win32', env: winEnv(), existsSync: fakeExists([]),
    spawnSync: fakeSpawn(merge({ 'where bash': out('C:\\Windows\\System32\\bash.exe\r\n') }, pyRows('python3', [], '3.12.3', 'C:\\Python312\\python.exe'))),
  });
  const noBashPosix = resolve({
    platform: 'linux', env: {}, existsSync: fakeExists([]),
    spawnSync: fakeSpawn({ 'python3 --version': out('Python 3.12.3\n') }),
  });
  const noPython = resolve({
    platform: 'linux', env: {}, existsSync: fakeExists([]),
    spawnSync: fakeSpawn(bashRows('bash', 'linux-gnu')),
  });
  eq(noBashPosix.reason, 'no_bash', 'posix reason');
  eq(noBashPosix.plain, PLAIN_NO_BASH_POSIX, 'posix plain');
  eq(noPython.reason, 'no_python', 'no python reason');
  for (const c of [noBashWin, noBashPosix, noPython]) {
    const lines = String(c.plain).split('\n');
    eq(lines.length, 3, 'plain line count of ' + JSON.stringify(c.plain));
    ok(/^ {2}Why:/.test(lines[1]), 'line 2 starts with "  Why:": ' + JSON.stringify(lines[1]));
    ok(/^ {2}Fix:/.test(lines[2]), 'line 3 starts with "  Fix:": ' + JSON.stringify(lines[2]));
    ok(!/[A-Za-z]:[\\/]|\\|\/[^\s/]+\//.test(c.plain), 'plain holds a path: ' + JSON.stringify(c.plain));
  }
});

leg('R8 POSIX: bash and python3 are accepted by name, no sys.executable probe', function () {
  const resolve = need('resolveRoomRuntime');
  const spawnSync = fakeSpawn(merge(bashRows('bash', 'linux-gnu'), { 'python3 --version': out('Python 3.12.3\n') }));
  const r = resolve({ platform: 'linux', env: {}, spawnSync: spawnSync, existsSync: fakeExists([]) });
  eq(r.ok, true, 'ok');
  eq(r.bash && r.bash.path, 'bash', 'bash.path');
  eq(r.python && r.python.path, 'python3', 'python.path');
  eq(spawnSync.calls.filter(function (k) { return /sys\.executable/.test(k); }).length, 0, 'sys.executable probes on POSIX');
});

leg('R9 memo: an ok default call is cached; refresh re-probes; a failure is dropped when PATH changes', function () {
  const resolve = need('resolveRoomRuntime');
  resetPlatform();
  const saved = process.env.PATH;
  const emptyDir = H.mkTmp('emptypath');
  let first;
  try {
    process.env.PATH = emptyDir;
    const failing = resolve();
    eq(failing.ok, false, 'a default call with an empty PATH is not ok');
  } finally { process.env.PATH = saved; }
  first = resolve();
  if (first.ok !== true) throw new Error('PENDING host has no bash plus python 3.9 or newer, so the ok memo cannot be shown: ' + first.plain);
  ok(first.ok === true, 'default call after a failure is ok (the failure was not cached)');
  const second = resolve();
  ok(first === second, 'a second default call returns the same object');
  const third = resolve({ refresh: true });
  ok(third !== first, 'refresh: true returns a new object');
  const injected = resolve({ platform: 'linux', env: {}, spawnSync: fakeSpawn({}), existsSync: fakeExists([]) });
  eq(injected.ok, false, 'injected failing call');
  ok(resolve() !== injected, 'an injected result is never the cached one');
});

leg('R10 the platform banner path does not call the resolver (D-03)', function () {
  const src = fs.readFileSync(PLATFORM_PATH, 'utf8');
  const a = src.indexOf('function detectPlatform');
  const b = src.indexOf('function readPluginJson');
  ok(a >= 0 && b > a, 'detectPlatform and readPluginJson found in platform.cjs');
  ok(src.slice(a, b).indexOf('resolveRoomRuntime') === -1, 'detectPlatform calls resolveRoomRuntime');
});

leg('R11 toBashPath turns backslashes into forward slashes', function () {
  const toBashPath = need('toBashPath');
  eq(toBashPath('C:\\Users\\a b\\x'), 'C:/Users/a b/x', 'windows path');
  eq(toBashPath('/home/u/x'), '/home/u/x', 'posix path');
});

leg('R12 spawnRoomRegistry with a not-ok runtime spawns nothing', function () {
  const spawnRoomRegistry = need('spawnRoomRegistry');
  const spawnSync = fakeSpawn({});
  const r = spawnRoomRegistry(['list'], {
    roomsHome: hermetic.roomsHome, spawnSync: spawnSync,
    runtime: { ok: false, reason: 'no_bash', plain: 'p', tried: [] },
  });
  eq(r.reason, 'environment_not_ready', 'reason');
  eq(r.ok, false, 'ok');
  eq(r.status, null, 'status');
  eq(spawnSync.calls.length, 0, 'spawn count');
});

leg('R13 spawnRoomRegistry on win32 passes forward-slash paths, MINDRIAN_PYTHON, and no shell', function () {
  const spawnRoomRegistry = need('spawnRoomRegistry');
  const seen = [];
  const spawnSync = function (cmd, argv, options) { seen.push({ cmd: cmd, argv: argv, options: options }); return out('{}'); };
  const runtime = {
    ok: true,
    bash: { path: BASH_WIN, ostype: 'msys' },
    python: { path: 'C:/Python312/python.exe', cmd: 'python3', pre: [], version: '3.12', version_line: 'Python 3.12.1' },
    tried: [],
  };
  spawnRoomRegistry(['C:\\Rooms', 'create', 'x', 'C:\\Rooms\\x'], {
    roomsHome: 'C:\\Rooms', cwd: ROOT, timeout: 1000, env: {}, runtime: runtime, spawnSync: spawnSync,
    platform: 'win32', script: 'C:\\repo\\scripts\\room-registry',
  });
  eq(seen.length, 1, 'spawn count');
  eq(seen[0].cmd, BASH_WIN, 'command');
  eq(JSON.stringify(seen[0].argv), JSON.stringify(['C:/repo/scripts/room-registry', 'C:/Rooms', 'create', 'x', 'C:/Rooms/x']), 'argv');
  eq(seen[0].options.env.MINDRIAN_PYTHON, 'C:/Python312/python.exe', 'MINDRIAN_PYTHON');
  eq(seen[0].options.env.MINDRIAN_ROOMS_HOME, 'C:/Rooms', 'MINDRIAN_ROOMS_HOME');
  ok(!Object.prototype.hasOwnProperty.call(seen[0].options, 'shell'), 'options carry a shell key');
});

leg('R14 CLI: room-runtime exits 1 with the plain text when nothing works', function () {
  const emptyDir = H.mkTmp('cliempty');
  const env = Object.assign({}, hermetic.env, { PATH: emptyDir });
  const r = cp.spawnSync(process.execPath, [PLATFORM_PATH, 'room-runtime', '--json'], { env: env, cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  eq(r.status, 1, 'exit code');
  ok(String(r.stderr).indexOf('Room creation cannot start on this computer yet.') !== -1, 'stderr: ' + JSON.stringify(String(r.stderr).slice(0, 200)));
});

leg('R15 review WR-01: a UNC rooms home and a UNC room dir reach bash with forward slashes only', function () {
  const spawnRoomRegistry = need('spawnRoomRegistry');
  const seen = [];
  const spawnSync = function (cmd, argv, options) { seen.push({ cmd: cmd, argv: argv, options: options }); return out('{}'); };
  const runtime = {
    ok: true,
    bash: { path: BASH_WIN, ostype: 'msys' },
    python: { path: 'C:/Python312/python.exe', cmd: 'python3', pre: [], version: '3.12', version_line: 'Python 3.12.1' },
    tried: [],
  };
  spawnRoomRegistry(['\\\\srv\\share\\rooms', 'create', 'x', '\\\\srv\\share\\rooms\\x'], {
    roomsHome: '\\\\srv\\share\\rooms', cwd: ROOT, timeout: 1000, env: {}, runtime: runtime, spawnSync: spawnSync,
    platform: 'win32', script: 'C:\\repo\\scripts\\room-registry',
  });
  eq(seen.length, 1, 'spawn count');
  eq(JSON.stringify(seen[0].argv), JSON.stringify(['C:/repo/scripts/room-registry', '//srv/share/rooms', 'create', 'x', '//srv/share/rooms/x']), 'argv');
  eq(seen[0].options.env.MINDRIAN_ROOMS_HOME, '//srv/share/rooms', 'MINDRIAN_ROOMS_HOME');
  eq(need('toBashPath')('\\\\srv\\share\\rooms'), '//srv/share/rooms', 'toBashPath of a UNC path');
});

leg('R16 review WR-02: a failed resolution is cached for a short window, refresh re-probes, the window ends', function () {
  const resolve = need('resolveRoomRuntime');
  resetPlatform();
  const saved = process.env.PATH;
  const emptyDir = H.mkTmp('negcache');
  try {
    process.env.PATH = emptyDir;
    const t0 = 1000000;
    const a = resolve({ now: t0 });
    eq(a.ok, false, 'first call on an empty PATH is not ok');
    const b = resolve({ now: t0 + platform.NEGATIVE_CACHE_MS - 1 });
    ok(a === b, 'a retry inside the window returns the cached failure');
    const c = resolve({ now: t0 + 1, refresh: true });
    ok(c !== a, 'refresh: true probes again');
    const d = resolve({ now: t0 + 2 });
    ok(d === c, 'the refreshed failure is the one cached now');
    const e = resolve({ now: t0 + 1 + platform.NEGATIVE_CACHE_MS + 1 });
    ok(e !== c, 'after the window a new probe runs');
    process.env.PATH = emptyDir + path.delimiter + emptyDir;
    const f = resolve({ now: t0 + 1 + platform.NEGATIVE_CACHE_MS + 2 });
    ok(f !== e, 'a changed PATH drops the cached failure');
    eq(platform.PROBE_TIMEOUT_MS, 2000, 'per-candidate probe timeout');
    resetPlatform();
    const g = resolve({ now: t0 });
    resetPlatform();
    const h = resolve({ now: t0 });
    ok(g !== h, '__resetForTests clears the failure cache');
  } finally { process.env.PATH = saved; }
});

for (const l of legs) {
  resetPlatform();
  try {
    l.fn();
    rep.pass(l.label);
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/^PENDING /.test(msg)) rep.pending(l.label, msg.slice('PENDING '.length));
    else rep.fail(l.label, msg);
  }
}
rep.done();
