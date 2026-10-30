'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261030-a2s win 2 (S-3, threat T-1): cache directory selection and fallback for
 * lib/core/hook-compile-cache.cjs, and the hook behaviour with an unusable cache.
 *
 *   A  HOME=temp, no XDG_CACHE_HOME: <home>/.cache/mindrian-os/node-compile-cache/<version>,
 *      every created component has (mode & 0o077) === 0
 *   B  an absolute XDG_CACHE_HOME is used; a relative one is ignored and A applies
 *   C  a leaf that exists with mode 0o777 gives null, reason 'mode'; the leaf is not chmod'ed
 *   D  a component that is a symlink gives null, reason 'symlink'
 *   E  an injected getuid that returns another uid gives null, reason 'owner'
 *   F  a read-only HOME (0o500) gives null, reason 'mkdir', no throw
 *   G  an empty HOME and no XDG gives null
 *   H  a child that calls enableHookCompileCache gets ENABLED and the dir holds files after
 *      exit; with NODE_DISABLE_COMPILE_CACHE=1 the call does not throw and is not enabled
 *   I  the hook through the wrapper on parity case C02 with a read-only HOME and a read-only
 *      XDG_CACHE_HOME: exit 0, stdout and stderr equal to a run with a writable HOME and XDG
 *      (stderr after the "(node:<pid>)" normalisation: the hook prints the node:sqlite
 *      ExperimentalWarning at base), and empty stderr when NODE_NO_WARNINGS=1; the writable run
 *      must fill the cache, or the compare proves nothing
 *   J  require() of scripts/intent-classifier.cjs from a child (require.main is not the module,
 *      stdin '') creates no <home>/.cache/mindrian-os (control: a main-module run creates it)
 *   K  with NODE_COMPILE_CACHE set by the caller, the hook exits 0 with the same stdout
 *
 * Temp dirs only (os.tmpdir()), removed in finally. Hyphens only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HELPER = path.join(REPO, 'lib', 'core', 'hook-compile-cache.cjs');
const { resolveCompileCacheDir } = require(HELPER);
const parity = require(path.join(REPO, 'tests', 'test-261030-a2s-classifier-parity.cjs'));

const TMP = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'a2s-cc-' + label + '-'));
  TMP.push(d);
  return d;
}
function chmodTree(d, mode) {
  try { fs.chmodSync(d, mode); } catch (_e) { /* best effort */ }
}

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (e) {
    failed += 1;
    console.log('  not ok - ' + name + ': ' + (e && e.message ? e.message : String(e)));
  }
}

const V = process.version;
const tail = (base) => path.join(base, 'mindrian-os', 'node-compile-cache', V);

check('A default dir under <home>/.cache, every created component 0700', () => {
  const home = mkTmp('a');
  const r = resolveCompileCacheDir({ env: { HOME: home } });
  assert.strictEqual(r.dir, tail(path.join(home, '.cache')));
  assert.strictEqual(r.reason, null);
  [path.join(home, '.cache'), path.join(home, '.cache', 'mindrian-os'), path.join(home, '.cache', 'mindrian-os', 'node-compile-cache'), r.dir]
    .forEach((p) => assert.strictEqual(fs.statSync(p).mode & 0o077, 0, p + ' mode ' + (fs.statSync(p).mode & 0o777).toString(8)));
});

check('B absolute XDG_CACHE_HOME is used, a relative one is ignored', () => {
  const home = mkTmp('b');
  const xdg = mkTmp('bx');
  const r1 = resolveCompileCacheDir({ env: { HOME: home, XDG_CACHE_HOME: xdg } });
  assert.strictEqual(r1.dir, tail(xdg));
  const r2 = resolveCompileCacheDir({ env: { HOME: home, XDG_CACHE_HOME: 'relative/cache' } });
  assert.strictEqual(r2.dir, tail(path.join(home, '.cache')));
});

check("C an existing 0777 leaf gives null, reason 'mode', and is not chmod'ed", () => {
  const xdg = mkTmp('c');
  const leaf = tail(xdg);
  fs.mkdirSync(leaf, { recursive: true, mode: 0o700 });
  fs.chmodSync(leaf, 0o777);
  const r = resolveCompileCacheDir({ env: { XDG_CACHE_HOME: xdg } });
  assert.strictEqual(r.dir, null);
  assert.strictEqual(r.reason, 'mode');
  assert.strictEqual(fs.statSync(leaf).mode & 0o777, 0o777);
});

check("D a symlinked component gives null, reason 'symlink'", () => {
  const xdg = mkTmp('d');
  const real = mkTmp('dr');
  fs.chmodSync(real, 0o700);
  fs.symlinkSync(real, path.join(xdg, 'mindrian-os'), 'dir');
  const r = resolveCompileCacheDir({ env: { XDG_CACHE_HOME: xdg } });
  assert.strictEqual(r.dir, null);
  assert.strictEqual(r.reason, 'symlink');
});

check("E another uid gives null, reason 'owner'", () => {
  const xdg = mkTmp('e');
  const other = (process.getuid() + 4242) >>> 0;
  const r = resolveCompileCacheDir({ env: { XDG_CACHE_HOME: xdg }, getuid: () => other });
  assert.strictEqual(r.dir, null);
  assert.strictEqual(r.reason, 'owner');
});

check("F a read-only HOME gives null, reason 'mkdir', no throw", () => {
  const home = mkTmp('f');
  fs.chmodSync(home, 0o500);
  try {
    const r = resolveCompileCacheDir({ env: { HOME: home } });
    assert.strictEqual(r.dir, null);
    assert.strictEqual(r.reason, 'mkdir');
  } finally {
    chmodTree(home, 0o700);
  }
});

check('G an empty HOME and no XDG gives null', () => {
  const r = resolveCompileCacheDir({ env: { HOME: '' } });
  assert.strictEqual(r.dir, null);
  const r2 = resolveCompileCacheDir({ env: {}, homedir: '' });
  assert.strictEqual(r2.dir, null);
});

function childEnable(env) {
  const code = 'const r = require(' + JSON.stringify(HELPER) + ').enableHookCompileCache();'
    + 'require(' + JSON.stringify(path.join(REPO, 'lib', 'core', 'rooms-home-env.cjs')) + ');'
    + 'process.stdout.write(JSON.stringify(r));';
  return spawnSync(process.execPath, ['-e', code], { env, encoding: 'utf8', timeout: 30000 });
}
function countFiles(d) {
  let n = 0;
  (function walk(x) {
    let ents = [];
    try { ents = fs.readdirSync(x, { withFileTypes: true }); } catch (_e) { return; }
    ents.forEach((e) => { if (e.isDirectory()) walk(path.join(x, e.name)); else n += 1; });
  })(d);
  return n;
}

check('H a child gets ENABLED and the dir holds files after exit; NODE_DISABLE_COMPILE_CACHE=1 is not enabled', () => {
  const home = mkTmp('h');
  const base = { PATH: process.env.PATH, HOME: home };
  const r = childEnable(base);
  assert.strictEqual(r.status, 0, 'child exit ' + r.status + ' stderr=' + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.enabled, true, JSON.stringify(out));
  assert.strictEqual(out.status, require('node:module').constants.compileCacheStatus.ENABLED);
  assert.ok(countFiles(out.dir) >= 1, 'no cache file after exit');
  assert.strictEqual(r.stderr, '');
  const home2 = mkTmp('h2');
  const r2 = childEnable({ PATH: process.env.PATH, HOME: home2, NODE_DISABLE_COMPILE_CACHE: '1' });
  assert.strictEqual(r2.status, 0, 'child exit ' + r2.status + ' stderr=' + r2.stderr);
  const out2 = JSON.parse(r2.stdout);
  assert.strictEqual(out2.enabled, false, JSON.stringify(out2));
});

// Run parity case C02 through the wrapper with the parity env; returns the 3 channels.
function hookRun(kase, run, template, over) {
  parity.restoreRun(run, template);
  const scratch = path.dirname(run);
  const env = parity.sideEnv(kase, { netLog: path.join(scratch, 'net.log'), xdg: over.xdg });
  if (over.home) env.HOME = over.home;
  Object.keys(over.env || {}).forEach((k) => { env[k] = over.env[k]; });
  const r = spawnSync('bash', [path.join(REPO, 'scripts', 'intent-classifier')], {
    input: kase.turns[0].input(kase.fx), cwd: kase.cwd, env, timeout: 30000,
  });
  return {
    status: r.status,
    stdout: String(r.stdout || ''),
    stderr: String(r.stderr || '').replace(/\(node:\d+\)/g, '(node:<PID>)'),
  };
}

// The hook has 200 ms budgets: a pair that differs runs up to 2 more times.
function samePair(a, b, tries) {
  for (let i = 0; i < tries; i += 1) {
    const x = a();
    const y = b();
    if (x.status === y.status && x.stdout === y.stdout && x.stderr === y.stderr) return { ok: true, x, y };
    if (i === tries - 1) return { ok: false, x, y };
  }
  return { ok: false };
}

function withC02(fn) {
  const base = mkTmp('c02');
  const run = path.join(base, 'run');
  const template = path.join(base, 'template');
  const kase = parity.buildCase('C02', { at: run });
  const c = spawnSync('cp', ['-a', run, template]);
  assert.strictEqual(c.status, 0, 'cp -a failed');
  fn(kase, run, template, base);
}

check('I an unusable cache (read-only HOME and XDG) leaves exit, stdout and stderr unchanged', () => {
  withC02((kase, run, template, base) => {
    const roHome = path.join(base, 'ro-home');
    const roXdg = path.join(base, 'ro-xdg');
    const rwXdg = path.join(base, 'rw-xdg');
    [roHome, roXdg, rwXdg].forEach((d) => fs.mkdirSync(d, { recursive: true }));
    fs.chmodSync(roHome, 0o500);
    fs.chmodSync(roXdg, 0o500);
    try {
      const res = samePair(
        () => hookRun(kase, run, template, { xdg: rwXdg }),
        () => hookRun(kase, run, template, { xdg: roXdg, home: roHome }),
        3
      );
      assert.ok(res.ok, 'read-only run differs: ' + JSON.stringify({ a: res.x, b: res.y }).slice(0, 600));
      assert.strictEqual(res.y.status, 0);
      const quiet = hookRun(kase, run, template, { xdg: roXdg, home: roHome, env: { NODE_NO_WARNINGS: '1' } });
      assert.strictEqual(quiet.status, 0);
      assert.strictEqual(quiet.stderr, '', 'stderr with NODE_NO_WARNINGS=1: ' + quiet.stderr.slice(0, 300));
      assert.strictEqual(countFiles(roXdg), 0);
      assert.ok(countFiles(path.join(rwXdg, 'mindrian-os')) >= 1, 'the writable run did not fill the cache, so the compare proves nothing');
    } finally {
      chmodTree(roHome, 0o700);
      chmodTree(roXdg, 0o700);
    }
  });
});

check('J require() of the classifier from a child creates no <home>/.cache/mindrian-os', () => {
  const home = mkTmp('j');
  const code = 'require(' + JSON.stringify(path.join(REPO, 'scripts', 'intent-classifier.cjs')) + ');';
  const r = spawnSync(process.execPath, ['-e', code], {
    input: '', env: { PATH: process.env.PATH, HOME: home, MINDRIAN_ROOMS_HOME: path.join(home, 'rooms') }, encoding: 'utf8', timeout: 30000,
  });
  assert.strictEqual(r.status, 0, 'child exit ' + r.status + ' stderr=' + String(r.stderr).slice(0, 300));
  assert.strictEqual(fs.existsSync(path.join(home, '.cache', 'mindrian-os')), false);
  // Control: run as the main module, the same child does create the cache dir.
  const home2 = mkTmp('j2');
  const r2 = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'intent-classifier.cjs')], {
    input: '', env: { PATH: process.env.PATH, HOME: home2, MINDRIAN_ROOMS_HOME: path.join(home2, 'rooms') }, encoding: 'utf8', timeout: 30000,
  });
  assert.strictEqual(r2.status, 0, 'main-module child exit ' + r2.status);
  assert.strictEqual(fs.existsSync(path.join(home2, '.cache', 'mindrian-os')), true, 'control: the main-module run made no cache dir');
});

check('K NODE_COMPILE_CACHE set by the caller: exit 0 and the same stdout', () => {
  withC02((kase, run, template, base) => {
    const xdg = path.join(base, 'xdg-k');
    const ncc = path.join(base, 'ncc');
    fs.mkdirSync(xdg, { recursive: true });
    fs.mkdirSync(ncc, { recursive: true, mode: 0o700 });
    const res = samePair(
      () => hookRun(kase, run, template, { xdg }),
      () => hookRun(kase, run, template, { xdg, env: { NODE_COMPILE_CACHE: ncc } }),
      3
    );
    assert.ok(res.ok, 'NODE_COMPILE_CACHE run differs: ' + JSON.stringify({ a: res.x, b: res.y }).slice(0, 600));
    assert.strictEqual(res.y.status, 0);
  });
});

for (const d of TMP) {
  chmodTree(d, 0o700);
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}
console.log('compile-cache: ' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed === 0 ? 0 : 1;
