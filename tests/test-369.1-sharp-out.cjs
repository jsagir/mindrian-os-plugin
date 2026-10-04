#!/usr/bin/env node
'use strict';
/**
 * tests/test-369.1-sharp-out.cjs  (Phase 369.1, plan 08, DPI-13, D-16 / D-16a)
 *
 * The release payload ceiling is red on one finding: next's optional sharp declares an install script,
 * and every supported installer (the Claude Code loader, documented, and the plugin's own self-install)
 * runs `npm ci --ignore-scripts`, so that script would never run and sharp would be silently broken.
 * The navigator ruled "prune" (2026-10-04): scripts/release-lib/prune-shrinkwrap.cjs removes the optional
 * sharp subtree from the lockfile by reachability at release Step 6.7, with NO exemption in the gate.
 *
 * Arms (--arm <name>, repeatable; no flag runs every arm except install):
 *   shrinkwrap    the committed npm-shrinkwrap.json has no sharp, no @img/*, no hasInstallScript entry,
 *                 next records no sharp edge, root dependencies equal package.json, no `overrides` key
 *   prune-fn      the prune script on a copy of the PRE-PHASE shrinkwrap (git 45563da11): removes the 26
 *                 sharp entries and next's sharp edge, only removes (never adds or edits), is idempotent
 *                 and byte-stable, --check exits 1 unpruned and 0 pruned, refuses a surviving install script
 *   gate          the ceiling gate and its harness-policy test exit 0, the policy JSON equals 45563da11,
 *                 and the gate's code names no package (no exemption)
 *   text          gate comment and finding text and RULE 8 say one true thing about --ignore-scripts
 *   release-step  mos_generate_shrinkwrap (sandbox git repo, injected hooks) prunes, and refuses a
 *                 remaining install-script package by name
 *   install       (live, only when named) the packed repo installs with `npm ci --ignore-scripts` twice
 *                 with the same package list, sharp absent, next resolvable (exit 77 on a registry failure)
 *
 * Exit 0 all pass; 1 any FAIL; 77 only for the install arm's ENV GAP. Hermetic: temp sandboxes under one
 * mkdtemp root removed on exit; no install in the repo root; the repo is never written.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PRE_PHASE = '45563da11';
const PRUNE = path.join(ROOT, 'scripts', 'release-lib', 'prune-shrinkwrap.cjs');
const GATE_SH = path.join(ROOT, 'scripts', 'release-lib', 'shrinkwrap-gate.sh');
const CEILING = path.join(ROOT, 'scripts', 'check-release-payload-ceiling.cjs');
const RULE_DOC = path.join(ROOT, 'docs', 'RELEASE-CEREMONY-RULING-SYSTEM.md');

const ALL_ARMS = ['shrinkwrap', 'prune-fn', 'gate', 'text', 'release-step', 'install'];
const DEFAULT_ARMS = ALL_ARMS.filter(function (a) { return a !== 'install'; });

const wanted = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--arm') {
    const v = process.argv[++i];
    if (ALL_ARMS.indexOf(v) === -1) {
      process.stderr.write('unknown arm ' + v + '; arms: ' + ALL_ARMS.join(', ') + '\n');
      process.exit(2);
    }
    wanted.push(v);
  }
}
const arms = wanted.length ? wanted : DEFAULT_ARMS;

const sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos3691-sharp-'));
process.on('exit', function () { try { fs.rmSync(sandboxRoot, { recursive: true, force: true }); } catch (e) { /* best effort */ } });

const WATCHED = ['npm-shrinkwrap.json', 'package.json', 'package-lock.json', 'scripts', 'docs', 'data'];
function porcelain() {
  const r = spawnSync('git', ['status', '--porcelain', '--'].concat(WATCHED), { cwd: ROOT, encoding: 'utf8' });
  return r.stdout || '';
}
const before = porcelain();

let failures = 0;
let skipped = 0;
function check(name, fn) {
  try {
    const detail = fn();
    process.stdout.write('PASS: ' + name + (detail ? ' (' + detail + ')' : '') + '\n');
  } catch (e) {
    if (e && e.envGap) {
      skipped++;
      process.stdout.write('ENV GAP: ' + name + ': ' + e.message + '\n');
      return;
    }
    failures++;
    process.stdout.write('FAIL: ' + name + '\n  ' + String(e && e.message ? e.message : e).split('\n').join('\n  ') + '\n');
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + (r.stderr || ''));
  return r.stdout;
}
function node(args, opts) {
  return spawnSync(process.execPath, args, Object.assign({ cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts || {}));
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function unpruned() { return git(['show', PRE_PHASE + ':npm-shrinkwrap.json']); }

function sharpKeys(packages) {
  return Object.keys(packages).filter(function (k) { return k === 'node_modules/sharp' || k.indexOf('node_modules/@img/') === 0; });
}
function edgeMaps(entry) {
  return ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta'].filter(function (m) {
    return entry[m] && Object.prototype.hasOwnProperty.call(entry[m], 'sharp');
  });
}

function normalizeComments(src) {
  return src.replace(/\s*\n\s*(\/\/|\*)?\s*/g, ' ').replace(/'\s*\+\s*'/g, '');
}

// ---------------------------------------------------------------------------------------------------
if (arms.indexOf('shrinkwrap') !== -1) {
  check('shrinkwrap: committed lockfile carries no sharp, no @img/*, no install script', function () {
    const lock = readJson(path.join(ROOT, 'npm-shrinkwrap.json'));
    const pk = lock.packages;
    const bad = sharpKeys(pk);
    assert(bad.length === 0, bad.length + ' sharp entries remain: ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? ', ...' : ''));
    const scripted = Object.keys(pk).filter(function (k) { return pk[k] && pk[k].hasInstallScript === true; });
    assert(scripted.length === 0, 'hasInstallScript entries remain: ' + scripted.join(', '));
    const edges = Object.keys(pk).filter(function (k) { return pk[k] && edgeMaps(pk[k]).length; });
    assert(edges.length === 0, 'entries still record a sharp edge: ' + edges.join(', '));
    return Object.keys(pk).length + ' entries';
  });

  check('shrinkwrap: root dependencies equal package.json and package.json has no overrides', function () {
    const lock = readJson(path.join(ROOT, 'npm-shrinkwrap.json'));
    const pkg = readJson(path.join(ROOT, 'package.json'));
    assert(JSON.stringify(lock.packages[''].dependencies || {}) === JSON.stringify(pkg.dependencies || {}),
      'root dependencies of the lockfile differ from package.json dependencies');
    assert(!Object.prototype.hasOwnProperty.call(pkg, 'overrides'), 'package.json has an "overrides" key (the loader would skip the dependency install)');
  });
}

// ---------------------------------------------------------------------------------------------------
if (arms.indexOf('prune-fn') !== -1) {
  check('prune-fn: script exists', function () {
    assert(fs.existsSync(PRUNE), 'scripts/release-lib/prune-shrinkwrap.cjs does not exist');
  });

  check('prune-fn: removes the sharp subtree only, idempotent, byte-stable', function () {
    assert(fs.existsSync(PRUNE), 'prune script missing');
    const dir = fs.mkdtempSync(path.join(sandboxRoot, 'prune-'));
    const file = path.join(dir, 'npm-shrinkwrap.json');
    const original = unpruned();
    fs.writeFileSync(file, original);
    const orig = JSON.parse(original);
    const expectGone = sharpKeys(orig.packages);
    assert(expectGone.length === 26, 'fixture should carry 26 sharp entries, found ' + expectGone.length);

    const r1 = node([PRUNE, file]);
    assert(r1.status === 0, 'first prune exit ' + r1.status + ': ' + (r1.stdout || '') + (r1.stderr || ''));
    const after1 = fs.readFileSync(file, 'utf8');
    const lock = JSON.parse(after1);
    assert(sharpKeys(lock.packages).length === 0, 'sharp entries remain after the prune');
    assert(!Object.keys(lock.packages).some(function (k) { return lock.packages[k].hasInstallScript === true; }), 'an install script remains');
    assert('sharp' in orig.packages['node_modules/next'].optionalDependencies, 'fixture next should record sharp');
    assert(!('sharp' in (lock.packages['node_modules/next'].optionalDependencies || {})), 'next still records the sharp edge');
    // only removals: every kept entry is deep-equal to its original, except entries that lost a sharp edge
    Object.keys(lock.packages).forEach(function (k) {
      const a = JSON.stringify(lock.packages[k]);
      const copy = JSON.parse(JSON.stringify(orig.packages[k]));
      ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta'].forEach(function (m) {
        if (copy[m]) { delete copy[m].sharp; if (!Object.keys(copy[m]).length) delete copy[m]; }
      });
      assert(a === JSON.stringify(copy), 'entry ' + k + ' was edited beyond removing the sharp edge');
    });
    // the 26 are all gone, and nothing else that is still referenced was lost: dry-run proof is in the install arm
    expectGone.forEach(function (k) { assert(!(k in lock.packages), k + ' survived'); });
    // idempotent and byte-stable
    const r2 = node([PRUNE, file]);
    assert(r2.status === 0, 'second prune exit ' + r2.status);
    assert(/nothing to prune/.test(r2.stdout), 'second run should print "nothing to prune", got: ' + r2.stdout);
    assert(fs.readFileSync(file, 'utf8') === after1, 'second run changed the bytes');
    return (Object.keys(orig.packages).length - Object.keys(lock.packages).length) + ' entries removed';
  });

  check('prune-fn: --check exits 1 on the unpruned copy and 0 on the pruned one, writing nothing', function () {
    assert(fs.existsSync(PRUNE), 'prune script missing');
    const dir = fs.mkdtempSync(path.join(sandboxRoot, 'prunecheck-'));
    const file = path.join(dir, 'npm-shrinkwrap.json');
    const original = unpruned();
    fs.writeFileSync(file, original);
    const c1 = node([PRUNE, file, '--check']);
    assert(c1.status === 1, '--check on the unpruned copy should exit 1, got ' + c1.status);
    assert(fs.readFileSync(file, 'utf8') === original, '--check wrote to the file');
    assert(node([PRUNE, file]).status === 0, 'prune failed');
    const c2 = node([PRUNE, file, '--check']);
    assert(c2.status === 0, '--check on the pruned copy should exit 0, got ' + c2.status + ': ' + c2.stdout + c2.stderr);
  });

  check('prune-fn: reachability drops what only sharp needed and keeps shared packages (synthetic)', function () {
    assert(fs.existsSync(PRUNE), 'prune script missing');
    const dir = fs.mkdtempSync(path.join(sandboxRoot, 'prunesyn-'));
    const file = path.join(dir, 'lock.json');
    const lock = {
      name: 'syn', lockfileVersion: 3, requires: true,
      packages: {
        '': { name: 'syn', dependencies: { host: '1.0.0', shared: '1.0.0' } },
        'node_modules/host': { version: '1.0.0', optionalDependencies: { sharp: '^1' } },
        'node_modules/shared': { version: '1.0.0' },
        'node_modules/sharp': { version: '1.0.0', hasInstallScript: true, dependencies: { colour: '1', shared: '1.0.0' }, optionalDependencies: { 'sharp-linux': '1' } },
        'node_modules/colour': { version: '1.0.0' },
        'node_modules/sharp-linux': { version: '1.0.0', optional: true },
        'node_modules/orphan': { version: '1.0.0' },
      },
    };
    fs.writeFileSync(file, JSON.stringify(lock, null, 2) + '\n');
    const r = node([PRUNE, file]);
    assert(r.status === 0, 'exit ' + r.status + ': ' + r.stdout + r.stderr);
    const out = readJson(file).packages;
    assert(Object.keys(out).join(',') === ['', 'node_modules/host', 'node_modules/shared'].join(','),
      'unexpected survivors: ' + Object.keys(out).join(','));
    assert(!out['node_modules/host'].optionalDependencies, 'host kept an empty optionalDependencies map');
  });

  check('prune-fn: a surviving install-script package fails the run naming it (exit 1)', function () {
    assert(fs.existsSync(PRUNE), 'prune script missing');
    const dir = fs.mkdtempSync(path.join(sandboxRoot, 'prunefail-'));
    const file = path.join(dir, 'lock.json');
    fs.writeFileSync(file, JSON.stringify({
      name: 'syn', lockfileVersion: 3, requires: true,
      packages: {
        '': { name: 'syn', dependencies: { 'fake-native': '1.0.0' } },
        'node_modules/fake-native': { version: '1.0.0', hasInstallScript: true },
      },
    }, null, 2) + '\n');
    const r = node([PRUNE, file]);
    assert(r.status === 1, 'expected exit 1, got ' + r.status);
    assert((r.stdout + r.stderr).indexOf('node_modules/fake-native') !== -1, 'the offending key is not named');
  });
}

// ---------------------------------------------------------------------------------------------------
if (arms.indexOf('gate') !== -1) {
  check('gate: check-release-payload-ceiling.cjs --check exits 0', function () {
    const r = node([CEILING, '--check'], { timeout: 300000 });
    assert(r.status === 0, 'exit ' + r.status + ':\n' + (r.stdout || '') + (r.stderr || ''));
  });

  check('gate: tests/test-341-payload-ceiling.cjs (harness policy) exits 0', function () {
    const r = node([path.join(ROOT, 'tests', 'test-341-payload-ceiling.cjs')], { timeout: 300000 });
    assert(r.status === 0, 'exit ' + r.status + ':\n' + String(r.stdout || '').split('\n').slice(-15).join('\n') + (r.stderr || ''));
  });

  check('gate: the release-payload-ceiling policy is byte-identical to the pre-phase commit', function () {
    const rel = 'data/harness-policies/release-payload-ceiling.json';
    assert(fs.readFileSync(path.join(ROOT, rel), 'utf8') === git(['show', PRE_PHASE + ':' + rel]), rel + ' differs from ' + PRE_PHASE);
  });

  check('gate: the gate code exempts no package (no "sharp" in non-comment lines)', function () {
    const code = fs.readFileSync(CEILING, 'utf8').split('\n').filter(function (l) {
      const t = l.trim();
      return !(t.indexOf('//') === 0 || t.indexOf('*') === 0 || t.indexOf('/*') === 0);
    }).join('\n');
    assert(!/sharp/i.test(code), 'the ceiling gate names sharp in code');
  });
}

// ---------------------------------------------------------------------------------------------------
if (arms.indexOf('text') !== -1) {
  check('text: the ceiling gate no longer claims an install without --ignore-scripts, and says every installer runs it', function () {
    const raw = fs.readFileSync(CEILING, 'utf8');
    const flat = normalizeComments(raw);
    assert(!/passes no --ignore-scripts/i.test(flat), 'still says "passes no --ignore-scripts"');
    assert(!/has no --ignore-scripts/i.test(flat), 'still says "has no --ignore-scripts"');
    assert(raw.indexOf('npm-shrinkwrap.json declares hasInstallScript:true for:') !== -1, 'the finding prefix changed');
    assert(/every supported installer runs --ignore-scripts/i.test(flat), 'the gate does not state that every supported installer runs --ignore-scripts');
    assert(flat.indexOf('prune-shrinkwrap.cjs') !== -1, 'the finding does not point at prune-shrinkwrap.cjs');
  });

  check('text: RULE 8 states the same --ignore-scripts fact and the prune', function () {
    const doc = fs.readFileSync(RULE_DOC, 'utf8');
    const a = doc.indexOf('## RULE 8');
    const b = doc.indexOf('## RULE 9');
    assert(a !== -1 && b > a, 'RULE 8 section not found');
    const rule8 = doc.slice(a, b);
    assert(rule8.indexOf('--ignore-scripts') !== -1, 'RULE 8 has no --ignore-scripts');
    assert(rule8.indexOf('prune-shrinkwrap.cjs') !== -1, 'RULE 8 does not name prune-shrinkwrap.cjs');
    assert(/sharp/.test(rule8), 'RULE 8 does not name sharp');
    assert(/Every supported installer runs with --ignore-scripts/.test(rule8), 'RULE 8 lacks the "Every supported installer runs with --ignore-scripts" bullet');
  });

  check('text: the self-install really passes --ignore-scripts (the code the statement is about)', function () {
    const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'mcp-dep-heal.cjs'), 'utf8');
    assert(/npm ci --ignore-scripts|'--ignore-scripts'/.test(src), 'mcp-dep-heal.cjs does not pass --ignore-scripts');
  });
}

// ---------------------------------------------------------------------------------------------------
if (arms.indexOf('release-step') !== -1) {
  function sandboxRepo(tag) {
    const dir = fs.mkdtempSync(path.join(sandboxRoot, 'rel-' + tag + '-'));
    spawnSync('git', ['init', '-q'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'sandbox', version: '0.0.0' }) + '\n');
    return dir;
  }
  function hook(dir, name, body) {
    const p = path.join(dir, name);
    fs.writeFileSync(p, '#!/usr/bin/env bash\n' + body + '\n', { mode: 0o755 });
    return p;
  }
  function runGate(dir, shrinkHook, packHook) {
    const script = ['set -uo pipefail', '. "' + GATE_SH + '"',
      'export MOS_SHRINKWRAP_HOOK="' + shrinkHook + '"', 'export MOS_PACK_PROBE_HOOK="' + packHook + '"',
      'rc=0', 'mos_generate_shrinkwrap "' + dir + '" || rc=$?', 'echo "rc=$rc"'].join('\n');
    const env = Object.assign({}, process.env, { PATH: path.dirname(process.execPath) + path.delimiter + (process.env.PATH || '') });
    const r = spawnSync('bash', ['-c', script], { encoding: 'utf8', timeout: 60000, env });
    return { out: (r.stdout || '') + (r.stderr || '') };
  }
  const PACK_OK = 'printf \'[{"files":[{"path":"npm-shrinkwrap.json"}]}]\'';

  check('release-step: mos_generate_shrinkwrap prunes the generated shrinkwrap and returns 0', function () {
    const dir = sandboxRepo('ok');
    const fixture = path.join(dir, 'fixture.json');
    fs.writeFileSync(fixture, unpruned());
    const sh = hook(dir, 'shrink-hook.sh', 'cp "' + fixture + '" npm-shrinkwrap.json');
    const pk = hook(dir, 'pack-hook.sh', PACK_OK);
    const r = runGate(dir, sh, pk);
    assert(/rc=0/.test(r.out), 'expected rc=0, got:\n' + r.out);
    const lock = readJson(path.join(dir, 'npm-shrinkwrap.json'));
    assert(sharpKeys(lock.packages).length === 0, 'the shrinkwrap left by mos_generate_shrinkwrap still carries sharp');
  });

  check('release-step: an install-script package makes it return 1 naming the package', function () {
    const dir = sandboxRepo('bad');
    const fixture = path.join(dir, 'fixture.json');
    fs.writeFileSync(fixture, JSON.stringify({
      name: 'sandbox', lockfileVersion: 3, requires: true,
      packages: {
        '': { name: 'sandbox', dependencies: { 'fake-native': '1.0.0' } },
        'node_modules/fake-native': { version: '1.0.0', hasInstallScript: true },
      },
    }, null, 2) + '\n');
    const sh = hook(dir, 'shrink-hook.sh', 'cp "' + fixture + '" npm-shrinkwrap.json');
    const pk = hook(dir, 'pack-hook.sh', PACK_OK);
    const r = runGate(dir, sh, pk);
    assert(/rc=1/.test(r.out), 'expected rc=1, got:\n' + r.out);
    assert(r.out.indexOf('node_modules/fake-native') !== -1, 'the package is not named:\n' + r.out);
  });
}

// ---------------------------------------------------------------------------------------------------
if (arms.indexOf('install') !== -1) {
  check('install: the packed repo installs with npm ci --ignore-scripts twice, same package list, no sharp', function () {
    const work = fs.mkdtempSync(path.join(sandboxRoot, 'install-'));
    const cache = path.join(work, 'cache');
    const env = Object.assign({}, process.env, { PATH: path.dirname(process.execPath) + path.delimiter + (process.env.PATH || ''), npm_config_cache: cache });
    const pack = spawnSync('npm', ['pack', '--silent', '--pack-destination', work, '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8', env, timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
    if (pack.error && pack.error.code === 'ENOENT') { const e = new Error('npm is not on PATH'); e.envGap = true; throw e; }
    assert(pack.status === 0, 'npm pack failed: ' + pack.stderr);
    const tgz = fs.readdirSync(work).filter(function (f) { return /\.tgz$/.test(f); })[0];
    assert(tgz, 'npm pack produced no tarball');
    const dest = path.join(work, 'copy');
    fs.mkdirSync(dest);
    const tar = spawnSync('tar', ['-xzf', path.join(work, tgz), '-C', dest, '--strip-components=1'], { encoding: 'utf8' });
    assert(tar.status === 0, 'tar failed: ' + tar.stderr);

    function listPackages() {
      const out = [];
      (function walk(dir, rel) {
        let names = [];
        try { names = fs.readdirSync(dir); } catch (e) { return; }
        names.forEach(function (n) {
          const p = path.join(dir, n);
          if (n === '.bin' || n === '.package-lock.json') return;
          if (n.charAt(0) === '@') { walk(p, rel + n + '/'); return; }
          if (fs.existsSync(path.join(p, 'package.json'))) {
            out.push(rel + n);
            walk(path.join(p, 'node_modules'), rel + n + '/node_modules/');
          }
        });
      })(path.join(dest, 'node_modules'), '');
      return out.sort();
    }
    function ci() {
      const r = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dest, encoding: 'utf8', env, timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
      if (r.status !== 0) {
        const text = (r.stdout || '') + (r.stderr || '');
        if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ECONNREFUSED|network/i.test(text)) { const e = new Error('registry unreachable'); e.envGap = true; throw e; }
        throw new Error('npm ci exit ' + r.status + ':\n' + text.split('\n').slice(-20).join('\n'));
      }
    }
    ci();
    const first = listPackages();
    fs.rmSync(path.join(dest, 'node_modules'), { recursive: true, force: true });
    ci();
    const second = listPackages();
    assert(JSON.stringify(first) === JSON.stringify(second), 'the two installs produced different package lists');
    assert(first.indexOf('sharp') === -1, 'sharp was installed');
    assert(!first.some(function (n) { return n.indexOf('@img/') === 0; }), '@img/* was installed');
    const res = spawnSync(process.execPath, ['-e', 'console.log(require.resolve("next"))'], { cwd: dest, encoding: 'utf8' });
    assert(res.status === 0, 'require.resolve("next") failed: ' + res.stderr);
    return first.length + ' packages';
  });
}

const after = porcelain();
check('repo untouched: git status of the watched paths is unchanged by this test', function () {
  assert(before === after, 'status changed:\nbefore:\n' + before + '\nafter:\n' + after);
});

process.stdout.write('RESULT: ' + (failures === 0 ? (skipped ? 'PASS with ' + skipped + ' ENV GAP' : 'ALL PASS') : failures + ' FAIL') + '\n');
process.exit(failures ? 1 : (skipped && arms.length === 1 && arms[0] === 'install' ? 77 : 0));
