#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 09 -- pins the /mos:eureka enable engine command core
 * (lib/core/eureka/eureka-engine-enable.cjs): check, path, forget, data, the grant-gated sync, the deep check.
 *
 * Arms E1 to E15. Every arm uses a fixture engine folder in os.tmpdir(), an isolated HOME and a fake spawn
 * that answers by argv shape. The real engine is never started, no uv sync and no uv run runs, no network.
 * Synthetic strings only. Node built-ins only.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MODULE = path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-enable.cjs');
const { mkIsolatedHome } = require('./helpers/isolated-home-36925.cjs');

let passed = 0;
let failed = 0;
function arm(label, fn) {
  try {
    fn();
    console.log('ok - ' + label);
    passed += 1;
  } catch (error) {
    console.log('FAIL - ' + label + ' :: ' + (error && error.message ? String(error.message).split('\n')[0] : String(error)));
    failed += 1;
  }
}

const TO_REMOVE = [];
function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '387-09-' + prefix + '-'));
  TO_REMOVE.push(dir);
  return dir;
}
process.on('exit', () => { for (const d of TO_REMOVE) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } } });

const PYPROJECT_OK = '[project]\nname = "mindrian-eureka"\nrequires-python = ">=3.11"\n\n[project.scripts]\neureka-mcp = "mindrian_eureka.mcp_server:main"\n';

function mkEngine(opts) {
  const o = opts || {};
  const root = tmp(o.tag || 'engine');
  const name = o.name || 'mindrian-eureka';
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "' + name + '"\nrequires-python = ">=3.11"\n\n[project.scripts]\neureka-mcp = "x:y"\n');
  if (o.venv) {
    const site = path.join(root, '.venv', 'lib', 'python3.12', 'site-packages');
    fs.mkdirSync(site, { recursive: true });
    if (o.mcp) fs.mkdirSync(path.join(site, 'mcp-2.3.0.dist-info'));
  }
  return root;
}

function addPackages(root, names) {
  const site = path.join(root, '.venv', 'lib', 'python3.12', 'site-packages');
  fs.mkdirSync(site, { recursive: true });
  for (const n of names) fs.mkdirSync(path.join(site, n + '-1.0.0.dist-info'), { recursive: true });
}

function enoent(cmd) {
  return { error: Object.assign(new Error('spawn ' + cmd + ' ENOENT'), { code: 'ENOENT' }), status: null, stdout: '', stderr: '' };
}

// A fake spawn that records every call and answers by argv shape. Any other shape is recorded as unknown.
function fakeSpawn(cfg) {
  const c = cfg || {};
  const calls = [];
  function spawnSync(command, args, options) {
    const a = Array.isArray(args) ? args : [];
    const call = { command, args: a, options: options || {}, kind: 'unknown' };
    calls.push(call);
    if (command === 'node' && a.length === 1 && a[0] === '--version') {
      call.kind = 'node-version';
      return { status: 0, stdout: (c.node || 'v22.1.0') + '\n', stderr: '' };
    }
    if (a.length === 1 && a[0] === '--version') {
      call.kind = 'uv-version';
      if (c.uv === 'missing') return enoent(command);
      return { status: 0, stdout: 'uv 0.5.1\n', stderr: '' };
    }
    if (a[0] === 'python' && a[1] === 'find' && a[2] === '--no-project' && a.length === 4) {
      call.kind = 'python-find';
      if (c.python === 'none') return { status: 2, stdout: '', stderr: 'No interpreter found\n' };
      return { status: 0, stdout: '/usr/bin/python3.12\n', stderr: '' };
    }
    if (a[0] === 'sync') {
      call.kind = 'sync';
      if (typeof c.onSync === 'function') return c.onSync(call);
      return { status: 0, stdout: 'synced\n', stderr: '' };
    }
    if (a[0] === 'run') {
      call.kind = 'doctor';
      if (typeof c.onDoctor === 'function') return c.onDoctor(call);
      return { status: 0, stdout: '{}', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unknown shape' };
  }
  return { spawnSync, calls };
}

function loadModule() { return require(MODULE); }

function out(result) { return String(result.stdout || '') + '\n' + String(result.stderr || ''); }

function baseEnv(iso, extra) {
  const env = Object.assign({}, iso.env, extra || {});
  delete env.MINDRIAN_EUREKA_ROOT;
  delete env.MINDRIAN_EUREKA_UV;
  return env;
}

function pointerFile(iso) { return path.join(iso.home, '.mindrian', 'eureka-engine.json'); }

const THREE_PARTS = ['1 Python packages: ', '2 Model folder (you place it; the engine never downloads one): ', '3 Node.js 22 or newer for some workers: '];

function onlyAllowedShapes(calls) {
  for (const c of calls) {
    assert.ok(['uv-version', 'python-find', 'node-version'].indexOf(c.kind) !== -1, 'unexpected spawn: ' + c.command + ' ' + c.args.join(' '));
  }
}

console.log('Phase 387 plan 09 -- Eureka engine enable command');

arm('E1 check with no engine: state absent, exit 0, no spawn', () => {
  const iso = mkIsolatedHome('e1');
  const fake = fakeSpawn();
  const result = loadModule().run(['--check', '--json'], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 0);
  const json = JSON.parse(result.stdout);
  assert.strictEqual(json.state, 'absent');
  assert.strictEqual(fake.calls.length, 0);
});

arm('E2 --path saves the setting (mode 0600), prints the three setup parts, spawns only the 3 probes', () => {
  const iso = mkIsolatedHome('e2');
  const root = mkEngine({ tag: 'e2', venv: true, mcp: true });
  const fake = fakeSpawn();
  const result = loadModule().run(['--path', root], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 0, out(result));
  const file = pointerFile(iso);
  assert.ok(fs.existsSync(file), 'setting file not written');
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).root, path.resolve(root));
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  const text = out(result);
  for (const part of THREE_PARTS) assert.ok(text.indexOf(part) !== -1, 'missing setup part: ' + part);
  onlyAllowedShapes(fake.calls);
  assert.ok(fake.calls.length >= 1);
});

arm('E3 --path with another project name exits 1, writes nothing, prints the 3-line pattern', () => {
  const iso = mkIsolatedHome('e3');
  const root = mkEngine({ tag: 'e3', name: 'other-project', venv: true, mcp: true });
  const fake = fakeSpawn();
  const result = loadModule().run(['--path', root], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 1);
  assert.ok(!fs.existsSync(pointerFile(iso)), 'setting must not be written');
  const lines = out(result).split('\n');
  assert.ok(lines.some((l) => /^x /.test(l)), 'no line starting with x');
  assert.ok(lines.some((l) => /^ {2}Why: /.test(l)), 'no Why line');
  assert.ok(lines.some((l) => /^ {2}Fix: /.test(l)), 'no Fix line');
});

arm('E4 --path with a relative path or a NUL character exits 1 and writes nothing', () => {
  const iso = mkIsolatedHome('e4');
  const fake = fakeSpawn();
  const mod = loadModule();
  const rel = mod.run(['--path', 'relative/folder'], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(rel.exitCode, 1);
  const root = mkEngine({ tag: 'e4', venv: true, mcp: true });
  const nul = mod.run(['--path', root + '\u0000x'], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(nul.exitCode, 1);
  const missing = mod.run(['--path', path.join(os.tmpdir(), '387-09-no-such-folder-xyz')], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(missing.exitCode, 1);
  assert.ok(!fs.existsSync(pointerFile(iso)), 'setting must not be written');
  assert.strictEqual(fake.calls.length, 0, 'a refused path must spawn nothing');
});

arm('E5 uv missing: setting kept, exit 1, uv_missing sentence and the uv install page', () => {
  const iso = mkIsolatedHome('e5');
  const root = mkEngine({ tag: 'e5', venv: true, mcp: true });
  const fake = fakeSpawn({ uv: 'missing' });
  const result = loadModule().run(['--path', root], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 1);
  assert.ok(fs.existsSync(pointerFile(iso)), 'setting must stay saved');
  const text = out(result);
  assert.ok(text.indexOf('The tool uv is not installed or is not on the PATH, so the engine cannot start.') !== -1, text);
  assert.ok(text.indexOf('https://docs.astral.sh/uv/getting-started/installation/') !== -1, text);
});

arm('E6 Python not found: setting kept, exit 1, python_missing sentence with the requires-python value', () => {
  const iso = mkIsolatedHome('e6');
  const root = mkEngine({ tag: 'e6', venv: true, mcp: true });
  const fake = fakeSpawn({ python: 'none' });
  const result = loadModule().run(['--path', root], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 1);
  assert.ok(fs.existsSync(pointerFile(iso)));
  const text = out(result);
  assert.ok(text.indexOf('No Python that meets the engine requirement was found.') !== -1, text);
  assert.ok(text.indexOf('>=3.11') !== -1, 'requires-python value missing');
});

arm('E7 no .venv: env_not_synced and the sync fix; --forget removes the setting, twice is fine, data stays', () => {
  const iso = mkIsolatedHome('e7');
  const root = mkEngine({ tag: 'e7' });
  const fake = fakeSpawn();
  const mod = loadModule();
  const result = mod.run(['--path', root], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 1);
  assert.ok(fs.existsSync(pointerFile(iso)));
  const text = out(result);
  assert.ok(text.indexOf('The engine folder has no prepared Python environment yet.') !== -1, text);
  assert.ok(text.indexOf('/mos:eureka enable engine --sync') !== -1, text);
  const first = mod.run(['--forget'], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(first.exitCode, 0);
  assert.ok(!fs.existsSync(pointerFile(iso)), 'setting must be gone');
  const second = mod.run(['--forget'], { env: baseEnv(iso), spawnSync: fake.spawnSync });
  assert.strictEqual(second.exitCode, 0);
  const t = out(first);
  assert.ok(/data and cache folders/.test(t) && /stay/.test(t), t);
  assert.ok(fs.existsSync(root), 'the engine folder must stay');
});

arm('E8 --data lists the 4 places with sizes, deletes nothing, spawns nothing', () => {
  const iso = mkIsolatedHome('e8');
  const root = mkEngine({ tag: 'e8', venv: true, mcp: true });
  const dataDir = tmp('e8-data');
  const cacheDir = tmp('e8-cache');
  fs.writeFileSync(path.join(dataDir, 'jobs.sqlite3'), Buffer.alloc(1234));
  fs.writeFileSync(path.join(cacheDir, 'embeddings.sqlite3'), Buffer.alloc(77));
  const fake = fakeSpawn();
  const env = baseEnv(iso, { MINDRIAN_EUREKA_ROOT: root, MINDRIAN_EUREKA_DATA_DIR: dataDir, MINDRIAN_EUREKA_CACHE_DIR: cacheDir });
  const result = loadModule().run(['--data'], { env, spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 0, out(result));
  const text = out(result);
  for (const kind of ['environment', 'data', 'cache', 'huggingface']) assert.ok(text.indexOf(kind) !== -1, 'missing place: ' + kind);
  assert.ok(text.indexOf('1234 bytes') !== -1, 'data size missing: ' + text);
  assert.ok(text.indexOf('77 bytes') !== -1, 'cache size missing');
  assert.ok(text.indexOf('This command deletes none of them') !== -1);
  assert.strictEqual(fake.calls.length, 0);
  assert.ok(fs.existsSync(path.join(dataDir, 'jobs.sqlite3')) && fs.existsSync(path.join(cacheDir, 'embeddings.sqlite3')));
});

arm('E9 --sync without approval prints the grant card, exits 2 and runs no sync', () => {
  const iso = mkIsolatedHome('e9');
  const root = mkEngine({ tag: 'e9', venv: true, mcp: true });
  const fake = fakeSpawn();
  const env = baseEnv(iso, { MINDRIAN_EUREKA_ROOT: root });
  const mod = loadModule();
  const result = mod.run(['--sync'], { env, spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 2, out(result));
  onlyAllowedShapes(fake.calls);
  const card = JSON.parse(result.stdout);
  assert.strictEqual(card.kind, 'engine_sync_grant');
  assert.deepStrictEqual(card.command, ['uv', 'sync', '--locked', '--no-python-downloads', '--extra', 'mcp-server']);
  assert.deepStrictEqual(card.hosts, ['pypi.org', 'files.pythonhosted.org']);
  assert.strictEqual(card.python_downloads, 'off');
  assert.deepStrictEqual(card.builds_from_source, []);
  assert.ok(Array.isArray(card.writes) && card.writes.length >= 3);
  assert.ok(/not fetched by this plugin/.test(card.model));
  assert.ok(/not installed by this plugin/.test(card.node));
  assert.strictEqual(card.then_offline, true);
  assert.ok(typeof card.size_note === 'string' && card.size_note.length > 0);
  const fake2 = fakeSpawn();
  const result2 = mod.run(['--sync', '--extras', 'modern-encoder,hmm'], { env, spawnSync: fake2.spawnSync });
  assert.strictEqual(result2.exitCode, 2);
  assert.ok(fake2.calls.every((c) => c.kind !== 'sync'));
  const card2 = JSON.parse(result2.stdout);
  assert.ok(card2.hosts.indexOf('download.pytorch.org') !== -1);
  assert.deepStrictEqual(card2.builds_from_source, ['pomegranate']);
  assert.deepStrictEqual(card2.extras, ['mcp-server', 'modern-encoder', 'hmm']);
});

arm('E10 --sync --approved-via cli: locked argv, allowlist env, reports from the disk', () => {
  const iso = mkIsolatedHome('e10');
  const root = mkEngine({ tag: 'e10' });
  const envExtra = {
    MINDRIAN_EUREKA_ROOT: root,
    CLAUDE_PLUGIN_ROOT: '/synthetic/plugin',
    MINDRIAN_BRAIN_KEY: 'synthetic-key',
    UV_CACHE_DIR: '/synthetic/uv-cache',
    UV_PYTHON_INSTALL_DIR: '/synthetic/uv-python',
    UV_PROJECT_ENVIRONMENT: '.venv',
  };
  const env = baseEnv(iso, envExtra);
  const mod = loadModule();
  // the fake creates the package marker, so the groups are installed
  const good = fakeSpawn({ onSync: () => { addPackages(root, ['mcp']); return { status: 0, stdout: 'ok\n', stderr: '' }; } });
  const result = mod.run(['--sync', '--approved-via', 'cli'], { env, spawnSync: good.spawnSync });
  assert.strictEqual(result.exitCode, 0, out(result));
  const syncs = good.calls.filter((c) => c.kind === 'sync');
  assert.strictEqual(syncs.length, 1);
  assert.deepStrictEqual(syncs[0].args, ['sync', '--locked', '--no-python-downloads', '--extra', 'mcp-server']);
  assert.strictEqual(syncs[0].options.shell, false);
  assert.strictEqual(syncs[0].options.cwd, root);
  assert.strictEqual(syncs[0].options.timeout, 20 * 60 * 1000);
  const keys = Object.keys(syncs[0].options.env);
  assert.ok(keys.every((k) => !/^(CLAUDE_|MINDRIAN_)/.test(k)), 'leaked: ' + keys.filter((k) => /^(CLAUDE_|MINDRIAN_)/.test(k)).join(','));
  for (const k of ['UV_CACHE_DIR', 'UV_PYTHON_INSTALL_DIR', 'UV_PROJECT_ENVIRONMENT']) assert.strictEqual(syncs[0].options.env[k], envExtra[k], k + ' missing');
  assert.ok(/mcp-server/.test(out(result)) && /installed/i.test(out(result)));
  for (const part of THREE_PARTS) assert.ok(out(result).indexOf(part) !== -1, 'missing setup part: ' + part);
  // exit 0 but nothing on disk: a failure, never ok from the exit code
  const root2 = mkEngine({ tag: 'e10b' });
  const env2 = baseEnv(iso, { MINDRIAN_EUREKA_ROOT: root2 });
  const bad = fakeSpawn({ onSync: () => ({ status: 0, stdout: 'ok\n', stderr: '' }) });
  const result2 = mod.run(['--sync', '--approved-via', 'gate', '--extras', 'modern-encoder'], { env: env2, spawnSync: bad.spawnSync });
  assert.strictEqual(result2.exitCode, 1, out(result2));
  const text2 = out(result2);
  assert.ok(text2.indexOf('extra_missing') !== -1 || /package group/.test(text2), text2);
  assert.ok(text2.indexOf('mcp-server') !== -1 && text2.indexOf('modern-encoder') !== -1, text2);
});

arm('E11 --sync refusals: unknown extra, no engine, uv missing (no card)', () => {
  const iso = mkIsolatedHome('e11');
  const root = mkEngine({ tag: 'e11', venv: true, mcp: true });
  const mod = loadModule();
  for (const bad of ['hub-gate', 'x;y']) {
    const fake = fakeSpawn();
    const result = mod.run(['--sync', '--extras', bad, '--approved-via', 'cli'], { env: baseEnv(iso, { MINDRIAN_EUREKA_ROOT: root }), spawnSync: fake.spawnSync });
    assert.strictEqual(result.exitCode, 1, bad);
    assert.strictEqual(fake.calls.length, 0, 'unknown extra must spawn nothing');
  }
  const f2 = fakeSpawn();
  const absent = mod.run(['--sync', '--approved-via', 'cli'], { env: baseEnv(iso), spawnSync: f2.spawnSync });
  assert.strictEqual(absent.exitCode, 1);
  assert.ok(out(absent).indexOf('The Eureka engine is not set up on this machine.') !== -1, out(absent));
  assert.strictEqual(f2.calls.length, 0);
  const f3 = fakeSpawn({ uv: 'missing' });
  const noUv = mod.run(['--sync'], { env: baseEnv(iso, { MINDRIAN_EUREKA_ROOT: root }), spawnSync: f3.spawnSync });
  assert.strictEqual(noUv.exitCode, 1);
  assert.ok(out(noUv).indexOf('The tool uv is not installed or is not on the PATH, so the engine cannot start.') !== -1);
  assert.ok(out(noUv).indexOf('engine_sync_grant') === -1, 'no grant card when uv is missing');
  assert.ok(f3.calls.every((c) => c.kind !== 'sync'));
});

arm('E12 --check --deep runs the engine doctor offline, prints the engine lines, only with --deep', () => {
  const iso = mkIsolatedHome('e12');
  const root = mkEngine({ tag: 'e12', venv: true, mcp: true });
  const long = 'Library sentence_transformers is missing ' + 'x'.repeat(400);
  const doc = {
    schema_version: 1, ok: false,
    checks: [
      { id: 'D1', name: 'Python', status: 'PASS', message: 'Python 3.12', fix: null },
      { id: 'D3', name: 'Libraries', status: 'WARN', message: long + '\nsecond line ' + root + '/lib', fix: 'uv sync --extra modern-encoder' },
    ],
  };
  const env = baseEnv(iso, { MINDRIAN_EUREKA_ROOT: root, CLAUDE_PLUGIN_ROOT: '/synthetic/plugin', MINDRIAN_BRAIN_KEY: 'k' });
  const mod = loadModule();
  const fake = fakeSpawn({ onDoctor: () => ({ status: 1, stdout: JSON.stringify(doc), stderr: '' }) });
  const result = mod.run(['--check', '--deep'], { env, spawnSync: fake.spawnSync });
  assert.strictEqual(result.exitCode, 0, out(result));
  const runs = fake.calls.filter((c) => c.kind === 'doctor');
  assert.strictEqual(runs.length, 1);
  assert.deepStrictEqual(runs[0].args, ['run', '--no-sync', '--offline', '--locked', '--no-python-downloads', '--project', root, '--extra', 'mcp-server', 'eureka', 'doctor', '--json']);
  assert.strictEqual(runs[0].options.shell, false);
  assert.strictEqual(runs[0].options.cwd, root);
  assert.strictEqual(runs[0].options.timeout, 60000);
  const keys = Object.keys(runs[0].options.env);
  assert.ok(keys.every((k) => !/^(CLAUDE_|MINDRIAN_)/.test(k)));
  for (const k of ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE']) assert.strictEqual(runs[0].options.env[k], '1', k);
  const lines = out(result).split('\n');
  const engineLines = lines.filter((l) => /Library sentence_transformers is missing|second line/.test(l));
  assert.ok(engineLines.length >= 2, 'engine lines not shown');
  for (const l of engineLines) assert.ok(l.length <= 200, 'line longer than 200: ' + l.length);
  assert.ok(out(result).indexOf(root) === -1 || out(result).indexOf('<MINDRIAN_EUREKA_ROOT>') !== -1);
  assert.ok(!lines.some((l) => /Python 3\.12/.test(l) && /D1/.test(l)), 'an OK check must not be printed');
  assert.ok(/Engine exit code: 1/.test(out(result)), 'engine exit code line missing');
  const plain = fakeSpawn();
  mod.run(['--check'], { env, spawnSync: plain.spawnSync });
  assert.ok(plain.calls.every((c) => c.kind !== 'doctor'), 'the doctor must not run without --deep');
});

arm('E13 static: no network module, no brain path, no fetch; spawns only in runEngineSync and runEngineDoctor', () => {
  const src = fs.readFileSync(MODULE, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\w])\/\/.*$/gm, '$1');
  assert.ok(!/require\(\s*['"]node:(http|https|net|dns)['"]\s*\)/.test(code), 'network module required');
  assert.ok(!/require\(\s*['"](http|https|net|dns)['"]\s*\)/.test(code), 'network module required');
  assert.ok(!/brain-client|mindrian-brain/.test(code), 'brain path referenced');
  assert.ok(!/\bfetch\s*\(/.test(code), 'fetch call');
  const re = /\b(?:spawn|spawnSync)\s*\(/g;
  let m;
  let count = 0;
  while ((m = re.exec(code)) !== null) {
    count += 1;
    const before = code.slice(0, m.index);
    const fns = before.match(/\bfunction\s+(\w+)/g) || [];
    const last = fns.length ? fns[fns.length - 1].replace(/function\s+/, '') : '';
    assert.ok(last === 'runEngineSync' || last === 'runEngineDoctor', 'spawn call in ' + last);
  }
  assert.ok(count >= 2, 'expected spawn call sites in the two functions');
  const mod = loadModule();
  for (const name of ['run', 'main', 'runEngineSync', 'runEngineDoctor']) assert.strictEqual(typeof mod[name], 'function', name);
});

arm('E14 --help prints usage and exits 0', () => {
  const result = loadModule().run(['--help'], { env: {}, spawnSync: fakeSpawn().spawnSync });
  assert.strictEqual(result.exitCode, 0);
  assert.ok(/enable engine/.test(out(result)) && /--sync/.test(out(result)));
});

arm('E15 the encoder installer test still passes', () => {
  const res = childProcess.spawnSync(process.execPath, [path.join(REPO, 'tests', 'test-341-eureka-enable-argv.cjs')], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, String(res.stdout).slice(-300));
});

console.log('\ntest-387-eureka-engine-enable: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
