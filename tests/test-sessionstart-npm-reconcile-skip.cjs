#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261029-nhu: the operator switch MINDRIAN_NPM_RECONCILE_SKIP of the SessionStart hook
 * scripts/sessionstart-npm-reconcile.cjs.
 * =========================================================================================
 *   T1   switch on: exit 0, stdout is exactly {"continue":true}, stderr empty, under 2000 ms
 *   T1b  switch on: no node_modules, copy listing unchanged, temp HOME unchanged, npm never started
 *   T2   control, switch unset: the same broken copy starts the fake npm in the copy root (T1 is not vacuous)
 *   T3   the values 0, true, yes and the empty string do not engage the switch
 *   T4   no switch, healthy copy: exit 0, envelope, npm never started, copy listing unchanged
 *   T5   source order: one switch expression, after the uncaughtException handler, before the first
 *        fs require, the root resolution, the spawn and the guarded install
 *   T6   no em dash or en dash in this test file or in the hook under test
 *   T7   temp-dir cleanup: the temp directory is removed and absent
 *
 * Hermetic (Canon Part 8): the hook runs only from a temp copy of the plugin root under os.tmpdir().
 * HOME, USERPROFILE, TMPDIR and the rooms home are temp. npm is a FAKE run through MINDRIAN_TEST_NPM_CLI
 * (honoured only under MINDRIAN_TEST_MODE=1). The registry is unreachable and npm is offline. The real
 * plugin root node_modules, the real HOME and any room folder are never read or written.
 *
 * MOS_RECONCILE_SKIP_HOOK: path of the hook source the test copies into its temp roots. Default is the
 * repo scripts/sessionstart-npm-reconcile.cjs. Point it at the pre-change hook for the RED proof.
 *
 * Output: one PASS or FAIL line per check, then RESULT: PASS=n FAIL=n. Exit 1 on any FAIL, else 0.
 * House rule: hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HOOK_SRC = process.env.MOS_RECONCILE_SKIP_HOOK
  ? path.resolve(process.env.MOS_RECONCILE_SKIP_HOOK)
  : path.join(REPO, 'scripts', 'sessionstart-npm-reconcile.cjs');
const LIB_FILES = [
  'mcp-dep-heal.cjs', 'npm-install-lock.cjs', 'npm-cli-resolve.cjs',
  'dep-install-status.cjs', 'mcp-install-responder.cjs', 'dep-install-detached.cjs',
];
const SWITCH = 'MINDRIAN_NPM_RECONCILE_SKIP';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tnrs-'));
process.on('exit', () => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
});


// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
function reasonOf(e) {
  if (e && e.name === 'AssertionError' && e.generatedMessage && 'actual' in e) {
    const j = (v) => JSON.stringify(v);
    return 'actual=' + String(j(e.actual)).slice(0, 200) + ' expected=' + String(j(e.expected)).slice(0, 200);
  }
  return e && e.message ? String(e.message).split('\n')[0].slice(0, 400) : String(e);
}
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' - ' + reasonOf(e));
  }
}

// ---------------------------------------------------------------------------
// Fake npm, env, temp plugin roots
// ---------------------------------------------------------------------------
let counter = 0;
function mkTemp(label) {
  counter += 1;
  const d = path.join(TMP, label + '-' + counter);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const FAKE_NPM = path.join(TMP, 'fake-npm.cjs');
fs.writeFileSync(FAKE_NPM, [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  'const args = process.argv.slice(2);',
  'if (process.env.FAKE_NPM_LOG) {',
  "  try { fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify({ args, cwd: process.cwd() }) + '\\n'); } catch (e) { /* ignore */ }",
  '}',
  'let deps = {};',
  "try { deps = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).dependencies || {}; } catch (e) { /* none */ }",
  'Object.keys(deps).forEach((d) => {',
  "  const dir = path.join(process.cwd(), 'node_modules', ...d.split('/'));",
  '  fs.mkdirSync(dir, { recursive: true });',
  "  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: d }));",
  '});',
  "fs.mkdirSync(path.join(process.cwd(), 'node_modules'), { recursive: true });",
  "fs.writeFileSync(path.join(process.cwd(), 'node_modules', '.package-lock.json'), '{}');",
  'process.exit(0);',
  '',
].join('\n'));

const SCRUB = [
  'CLAUDE_PLUGIN_ROOT', 'MINDRIAN_OS_ROOT', SWITCH, 'MINDRIAN_TEST_MODE', 'MINDRIAN_TEST_NPM_CLI',
  'MINDRIAN_TEST_CONNECT_BUDGET_MS', 'MINDRIAN_TEST_DETACHED_TIMEOUT_MS', 'MINDRIAN_ROOM',
  'CLAUDE_ACTIVE_ROOM', 'NODE_OPTIONS', 'NODE_COMPILE_CACHE', 'FAKE_NPM_LOG',
];
function envFor(home, log, extra) {
  const env = Object.assign({}, process.env);
  for (const k of SCRUB) delete env[k];
  env.HOME = home;
  env.USERPROFILE = home;
  env.TMPDIR = mkTemp('tmpdir');
  env.MINDRIAN_ROOMS_HOME = mkTemp('rooms');
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  env.npm_config_registry = 'http://127.0.0.1:9/';
  env.npm_config_offline = 'true';
  env.npm_config_cache = mkTemp('npmcache');
  env.npm_config_update_notifier = 'false';
  env.MINDRIAN_TEST_MODE = '1';
  env.MINDRIAN_TEST_NPM_CLI = FAKE_NPM;
  env.FAKE_NPM_LOG = log;
  return Object.assign(env, extra || {});
}

function depNames(pkgPath) {
  return Object.keys(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).dependencies || {});
}

// A copy of the plugin root with only the files the hook reads. The hook resolves its root from its
// own __dirname, so it works on this copy and never on the repo.
function makeCopy(label, healthy) {
  const copy = mkTemp(label);
  fs.copyFileSync(path.join(REPO, 'package.json'), path.join(copy, 'package.json'));
  const shrink = path.join(REPO, 'npm-shrinkwrap.json');
  if (fs.existsSync(shrink)) fs.copyFileSync(shrink, path.join(copy, 'npm-shrinkwrap.json'));
  fs.mkdirSync(path.join(copy, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(copy, 'lib', 'core'), { recursive: true });
  fs.copyFileSync(HOOK_SRC, path.join(copy, 'scripts', 'sessionstart-npm-reconcile.cjs'));
  for (const f of LIB_FILES) {
    const src = path.join(REPO, 'lib', 'core', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(copy, 'lib', 'core', f));
  }
  fs.rmSync(path.join(copy, 'node_modules'), { recursive: true, force: true });
  assert.equal(fs.existsSync(path.join(copy, 'node_modules')), false, 'the copy must start without node_modules');
  if (healthy) {
    for (const d of depNames(path.join(copy, 'package.json'))) {
      const dir = path.join(copy, 'node_modules', ...d.split('/'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: d }));
    }
    fs.writeFileSync(path.join(copy, 'node_modules', '.package-lock.json'), '{}');
  }
  return copy;
}

function listing(dir) {
  const out = [];
  function walk(d) {
    let names = [];
    try { names = fs.readdirSync(d); } catch (_e) { return; }
    for (const n of names) {
      const full = path.join(d, n);
      const st = fs.lstatSync(full);
      const rel = path.relative(dir, full);
      out.push(rel + '|' + (st.isDirectory() ? 'd' : 'f') + '|' + st.size + '|' + st.mtimeMs);
      if (st.isDirectory()) walk(full);
    }
  }
  walk(dir);
  return out.sort();
}

function runHook(copy, env) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(copy, 'scripts', 'sessionstart-npm-reconcile.cjs')], {
    env, cwd: TMP, encoding: 'utf8', timeout: 60000,
  });
  return { status: r.status, stdout: String(r.stdout || ''), stderr: String(r.stderr || ''), error: r.error, ms: Date.now() - t0 };
}

function readLog(logPath) {
  try {
    return fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (_e) {
    return [];
  }
}

function lastLineJson(stdout) {
  return JSON.parse(stdout.trim().split('\n').pop());
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
let t1 = null;

check('T1 switch on: exit 0, stdout is exactly {"continue":true}, stderr empty, under 2000 ms', () => {
  const copy = makeCopy('t1-copy', false);
  const home = mkTemp('t1-home');
  const log = path.join(TMP, 't1.log');
  const env = envFor(home, log, { [SWITCH]: '1' });
  const copyBefore = listing(copy);
  const homeBefore = listing(home);
  const r = runHook(copy, env);
  t1 = { copy, home, log, copyBefore, homeBefore };
  assert.equal(r.error, undefined, 'spawn error');
  assert.equal(r.status, 0, 'exit status');
  assert.equal(r.stdout, '{"continue":true}');
  assert.equal(r.stderr, '');
  assert.ok(r.ms < 2000, 'took ' + r.ms + ' ms');
});

check('T1b switch on: no node_modules, copy listing unchanged, temp HOME unchanged, npm never started', () => {
  assert.ok(t1, 'T1 did not run');
  assert.equal(fs.existsSync(path.join(t1.copy, 'node_modules')), false, 'node_modules appeared');
  assert.deepEqual(listing(t1.copy), t1.copyBefore, 'the copy root changed');
  assert.deepEqual(listing(t1.home), t1.homeBefore, 'the temp HOME changed');
  assert.deepEqual(t1.homeBefore, [], 'the temp HOME was not empty at the start');
  assert.equal(fs.existsSync(t1.log), false, 'the fake npm ran');
});

check('T2 control, switch unset: the same broken copy starts the fake npm in the copy root, exit 0, envelope', () => {
  const copy = makeCopy('t2-copy', false);
  const home = mkTemp('t2-home');
  const log = path.join(TMP, 't2.log');
  const r = runHook(copy, envFor(home, log));
  assert.equal(r.status, 0, 'exit status');
  assert.deepEqual(lastLineJson(r.stdout), { continue: true });
  const calls = readLog(log);
  assert.ok(calls.length >= 1, 'the fake npm did not run');
  const want = fs.realpathSync(copy);
  for (const c of calls) assert.equal(fs.realpathSync(c.cwd), want, 'npm ran outside the copy root');
});

check('T3 values 0, true, yes and empty do not engage the switch', () => {
  ['0', 'true', 'yes', ''].forEach((value, i) => {
    const copy = makeCopy('t3-copy', false);
    const home = mkTemp('t3-home');
    const log = path.join(TMP, 't3-' + i + '.log');
    const r = runHook(copy, envFor(home, log, { [SWITCH]: value }));
    assert.equal(r.status, 0, 'exit status for ' + JSON.stringify(value));
    assert.deepEqual(lastLineJson(r.stdout), { continue: true });
    assert.ok(readLog(log).length >= 1, 'the fake npm did not run for ' + JSON.stringify(value));
  });
});

check('T4 no switch, healthy copy: exit 0, envelope, npm never started, copy listing unchanged', () => {
  const copy = makeCopy('t4-copy', true);
  const home = mkTemp('t4-home');
  const log = path.join(TMP, 't4.log');
  const before = listing(copy);
  const r = runHook(copy, envFor(home, log));
  assert.equal(r.status, 0, 'exit status');
  assert.deepEqual(lastLineJson(r.stdout), { continue: true });
  assert.equal(fs.existsSync(log), false, 'the fake npm ran on a healthy tree');
  assert.deepEqual(listing(copy), before, 'the copy root changed');
});

check('T5 source order: one switch expression, after the uncaughtException handler, before the first fs require, root resolution, spawn and guarded install', () => {
  const s = fs.readFileSync(HOOK_SRC, 'utf8');
  const q = String.fromCharCode(39);
  const key = 'process.env.' + SWITCH + ' === ' + q + '1' + q;
  const i = s.indexOf(key);
  const handler = s.indexOf('process.on(' + q + 'uncaughtException' + q);
  const fsReq = s.indexOf('require(' + q + 'node:fs' + q + ')');
  const root = s.indexOf('sameDirectory(ENV_ROOT');
  const spawn = s.indexOf('spawnSync(');
  const guarded = s.indexOf('runGuardedInstall(');
  assert.equal(s.split(key).length, 2, 'the switch expression must occur exactly once');
  assert.equal(s.indexOf(key + ') return emit();'), i, 'the switch must end in return emit()');
  assert.ok(handler >= 0 && handler < i, 'the switch must follow the uncaughtException handler');
  assert.ok(i < fsReq && i < root && i < spawn && i < guarded, 'the switch must precede the fs require, root resolution, spawn and guarded install');
  assert.ok(s.slice(0, handler).includes(SWITCH + '=1'), 'the header must name ' + SWITCH + '=1');
});

check('T6 no em dash or en dash in this test file or in the hook under test', () => {
  const bad = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
  assert.equal(bad.test(fs.readFileSync(__filename, 'utf8')), false, 'dash in the test file');
  assert.equal(bad.test(fs.readFileSync(HOOK_SRC, 'utf8')), false, 'dash in the hook');
});

check('T7 temp-dir cleanup: the temp directory is removed and absent', () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  assert.equal(fs.existsSync(TMP), false, 'the temp dir is still present');
});

console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
process.exit(failed > 0 ? 1 : 0);
