#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 07 -- pins the Eureka engine readiness doctor point
 * (lib/core/doctor/eureka-engine-readiness-module.cjs and its data/doctor-modules.json row).
 *
 * Arms D1 to D13. Every arm uses a fixture engine folder in os.tmpdir(), an isolated HOME and a fake spawn
 * that answers by argv shape. The real engine is never started, no uv sync and no uv run runs, no network.
 * D13 runs the real doctor with a temp HOME and no engine variable, so the point reports skip and spawns
 * nothing. Synthetic strings only. Node built-ins only.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MODULE = path.join(REPO, 'lib', 'core', 'doctor', 'eureka-engine-readiness-module.cjs');
const REGISTRY = path.join(REPO, 'data', 'doctor-modules.json');
const ROW_ID = 'eureka-engine-readiness';
const { mkIsolatedHome } = require('./helpers/isolated-home-36925.cjs');
const resolver = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-resolver.cjs'));

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '387-07-' + prefix + '-'));
  TO_REMOVE.push(dir);
  return dir;
}
process.on('exit', () => { for (const d of TO_REMOVE) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } } });

function mkEngine(opts) {
  const o = opts || {};
  const root = tmp(o.tag || 'engine');
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\nrequires-python = ">=3.11"\n\n[project.scripts]\neureka-mcp = "x:y"\n');
  if (o.venv) {
    const site = path.join(root, '.venv', 'lib', 'python3.12', 'site-packages');
    fs.mkdirSync(site, { recursive: true });
    for (const n of o.packages || []) fs.mkdirSync(path.join(site, n), { recursive: true });
  }
  if (o.cfgOnly) {
    fs.mkdirSync(path.join(root, '.venv'), { recursive: true });
    fs.writeFileSync(path.join(root, '.venv', 'pyvenv.cfg'), 'home = /usr/bin\n');
  }
  return root;
}

function enoent(cmd) {
  return { error: Object.assign(new Error('spawn ' + cmd + ' ENOENT'), { code: 'ENOENT' }), status: null, stdout: '', stderr: '' };
}

function fakeSpawn(cfg) {
  const c = cfg || {};
  const calls = [];
  function spawnSync(command, args) {
    const a = Array.isArray(args) ? args : [];
    const call = { command, args: a, kind: 'unknown' };
    calls.push(call);
    if (command === 'node' && a.length === 1 && a[0] === '--version') { call.kind = 'node-version'; return { status: 0, stdout: (c.node || 'v22.1.0') + '\n', stderr: '' }; }
    if (a.length === 1 && a[0] === '--version') { call.kind = 'uv-version'; return c.uv === 'missing' ? enoent(command) : { status: 0, stdout: 'uv 0.5.1\n', stderr: '' }; }
    if (a[0] === 'python' && a[1] === 'find' && a[2] === '--no-project' && a.length === 4) {
      call.kind = 'python-find';
      return c.python === 'none' ? { status: 2, stdout: '', stderr: 'No interpreter found\n' } : { status: 0, stdout: '/usr/bin/python3.12\n', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unknown shape' };
  }
  return { spawnSync, calls };
}

function loadModule() { return require(MODULE); }

function envOf(iso, extra) {
  return Object.assign({ HOME: iso.home, USERPROFILE: iso.home, PATH: process.env.PATH || '' }, extra || {});
}

function point(iso, spawnCfg, setup) {
  const fake = fakeSpawn(spawnCfg);
  const env = envOf(iso);
  if (setup) setup(env);
  const result = loadModule().check({ home: iso.home }, { env, spawnSync: fake.spawnSync });
  return { result, fake };
}

function lines(result) { return Array.isArray(result.action_lines) ? result.action_lines : []; }

console.log('Phase 387 plan 07 -- Eureka engine readiness doctor point');

arm('D1 no engine: skip, optional wording, the absent fix, no spawn', () => {
  const iso = mkIsolatedHome('d1');
  const { result, fake } = point(iso);
  assert.strictEqual(result.status, 'skip');
  assert.ok(result.detail.indexOf('Eureka engine: not set up (optional).') === 0, result.detail);
  assert.ok(/runs without the engine/.test(result.detail), result.detail);
  assert.ok(lines(result).indexOf('/mos:eureka enable engine --path <folder>') !== -1, JSON.stringify(result.action_lines));
  assert.strictEqual(fake.calls.length, 0);
});

arm('D2 graph ready: ok, names the routes that are not ready, with the exact fix lines', () => {
  const iso = mkIsolatedHome('d2');
  const root = mkEngine({ tag: 'd2', venv: true, packages: ['mcp-2.3.0.dist-info'] });
  resolver.writePointer(root, { HOME: iso.home });
  const { result } = point(iso);
  assert.strictEqual(result.status, 'ok', result.detail);
  assert.ok(result.detail.indexOf('ready for the graph tools') !== -1, result.detail);
  assert.ok(/source pointer/.test(result.detail), result.detail);
  assert.ok(result.detail.indexOf('uv 0.5.1') !== -1, result.detail);
  const notReady = result.detail.slice(result.detail.indexOf('Not ready:'));
  assert.ok(result.detail.indexOf('Not ready:') !== -1 && /pairs-and-scout/.test(notReady) && /modern-encoder/.test(notReady), result.detail);
  assert.ok(/decision/.test(notReady) && /hmm/.test(notReady), result.detail);
  assert.ok(result.detail.indexOf('Model folder: not found') !== -1, result.detail);
  assert.ok(lines(result).some((l) => l.indexOf('/mos:eureka enable engine --sync --extras modern-encoder') !== -1), JSON.stringify(result.action_lines));
});

arm('D3 a saved folder that is gone: warn with the folder sentence and the fix', () => {
  const iso = mkIsolatedHome('d3');
  resolver.writePointer(path.join(os.tmpdir(), '387-07-no-such-folder-' + process.pid), { HOME: iso.home });
  const { result } = point(iso);
  assert.strictEqual(result.status, 'warn');
  assert.ok(result.detail.indexOf('The saved Eureka engine folder is missing.') !== -1, result.detail);
  assert.ok(lines(result).indexOf('/mos:eureka enable engine --path <folder>') !== -1);
});

arm('D4 uv missing: warn with the uv sentence and the install page', () => {
  const iso = mkIsolatedHome('d4');
  resolver.writePointer(mkEngine({ tag: 'd4', venv: true, packages: ['mcp-2.3.0.dist-info'] }), { HOME: iso.home });
  const { result } = point(iso, { uv: 'missing' });
  assert.strictEqual(result.status, 'warn');
  assert.ok(result.detail.indexOf('The tool uv is not installed or is not on the PATH, so the engine cannot start.') !== -1, result.detail);
  assert.ok(lines(result).some((l) => l.indexOf('https://docs.astral.sh/uv/getting-started/installation/') !== -1));
});

arm('D5 Python not found: warn with the Python sentence', () => {
  const iso = mkIsolatedHome('d5');
  resolver.writePointer(mkEngine({ tag: 'd5', venv: true, packages: ['mcp-2.3.0.dist-info'] }), { HOME: iso.home });
  const { result } = point(iso, { python: 'none' });
  assert.strictEqual(result.status, 'warn');
  assert.ok(result.detail.indexOf('No Python that meets the engine requirement was found.') !== -1, result.detail);
});

arm('D6 no environment folder: warn with the env_not_synced sentence and the sync fix', () => {
  const iso = mkIsolatedHome('d6');
  resolver.writePointer(mkEngine({ tag: 'd6' }), { HOME: iso.home });
  const { result } = point(iso);
  assert.strictEqual(result.status, 'warn');
  assert.ok(result.detail.indexOf('The engine folder has no prepared Python environment yet.') !== -1, result.detail);
  assert.ok(lines(result).indexOf('/mos:eureka enable engine --sync') !== -1, JSON.stringify(result.action_lines));
});

arm('D7 environment found but no mcp package: warn naming mcp-server, never ok', () => {
  const iso = mkIsolatedHome('d7');
  resolver.writePointer(mkEngine({ tag: 'd7', venv: true, packages: ['numpy-1.26.0.dist-info'] }), { HOME: iso.home });
  const { result } = point(iso);
  assert.strictEqual(result.status, 'warn', result.detail);
  assert.ok(result.detail.indexOf('The engine package group mcp-server is not installed.') !== -1, result.detail);
});

arm('D8 environment layout cannot be read: warn "not verified", never ok', () => {
  const iso = mkIsolatedHome('d8');
  resolver.writePointer(mkEngine({ tag: 'd8', cfgOnly: true }), { HOME: iso.home });
  const { result } = point(iso);
  assert.strictEqual(result.status, 'warn', result.detail);
  assert.ok(result.detail.indexOf('not verified') !== -1, result.detail);
});

arm('D9 Node 20: ok for the graph tools, Node.js older than 22 named, node-workers not ready', () => {
  const iso = mkIsolatedHome('d9');
  resolver.writePointer(mkEngine({ tag: 'd9', venv: true, packages: ['mcp-2.3.0.dist-info'] }), { HOME: iso.home });
  const { result } = point(iso, { node: 'v20.11.0' });
  assert.strictEqual(result.status, 'ok', result.detail);
  assert.ok(result.detail.indexOf('Node.js') !== -1 && result.detail.indexOf('older than version 22') !== -1, result.detail);
  assert.ok(/Not ready:[\s\S]*node-workers/.test(result.detail), result.detail);
  assert.ok(lines(result).some((l) => /Install Node\.js 22 or newer/.test(l)), JSON.stringify(result.action_lines));
});

arm('D10 only 3 argv shapes spawn; the source holds no network, no engine spawn, no pyvenv.cfg read', () => {
  const iso = mkIsolatedHome('d10');
  resolver.writePointer(mkEngine({ tag: 'd10', venv: true, packages: ['mcp-2.3.0.dist-info'] }), { HOME: iso.home });
  const { fake } = point(iso);
  assert.ok(fake.calls.length >= 3);
  for (const c of fake.calls) assert.ok(['uv-version', 'python-find', 'node-version'].indexOf(c.kind) !== -1, 'unexpected spawn: ' + c.command + ' ' + c.args.join(' '));
  const python = fake.calls.find((c) => c.kind === 'python-find');
  assert.ok(python.args.indexOf('>=3.11') !== -1, 'python find must carry the requires-python value');
  const src = fs.readFileSync(MODULE, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\w])\/\/.*$/gm, '$1');
  assert.ok(!/\bfetch\s*\(/.test(code), 'fetch call');
  assert.ok(!/node:(http|https|net|dns)/.test(code) && !/require\(\s*['"](http|https|net|dns)['"]/.test(code), 'network module');
  assert.ok(!/eureka-mcp|eureka doctor/.test(code), 'an engine entry point is named in code');
  assert.ok(!/pyvenv\.cfg/.test(code), 'pyvenv.cfg is read');
  assert.ok(!/child_process|spawnSync\s*\(|spawn\s*\(/.test(code), 'the module itself must not spawn (checkEngine owns the probes)');
});

arm('D11 registry row: id, fix_supported false, cadence always, version not above the repo, runner resolves, check only', () => {
  const rows = (JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).modules || []).filter((m) => m.id === ROW_ID);
  assert.strictEqual(rows.length, 1, 'expected 1 row, found ' + rows.length);
  const row = rows[0];
  assert.strictEqual(row.fix_supported, false);
  assert.strictEqual(row.cadence, 'always');
  assert.ok(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(row.introduced_version), row.introduced_version);
  const repoVersion = childProcess.spawnSync(process.execPath, [path.join(REPO, 'lib', 'core', 'repo-version.cjs')], { encoding: 'utf8' }).stdout.trim();
  const semver = require('semver');
  assert.ok(semver.lte(row.introduced_version, repoVersion), row.introduced_version + ' is above ' + repoVersion);
  assert.ok(fs.existsSync(path.join(REPO, row.runner)), 'runner path does not resolve');
  const mod = require(path.join(REPO, row.runner));
  assert.strictEqual(typeof mod.check, 'function');
  assert.ok(!('fix' in mod), 'a check-only module must not export fix');
});

arm('D12 check never throws and always returns a status and a detail', () => {
  const iso = mkIsolatedHome('d12');
  const mod = loadModule();
  const deps = () => ({ env: envOf(iso), spawnSync: fakeSpawn().spawnSync });
  for (const ctx of [undefined, {}, { home: path.join(os.tmpdir(), '387-07-no-home-' + process.pid) }]) {
    const result = mod.check(ctx, deps());
    assert.ok(['ok', 'warn', 'error', 'skip'].indexOf(result.status) !== -1, String(result.status));
    assert.ok(typeof result.detail === 'string' && result.detail.length > 0);
    if ('action_lines' in result) assert.ok(Array.isArray(result.action_lines) && result.action_lines.every((l) => typeof l === 'string'));
  }
});

arm('D13 the real doctor with a temp HOME shows the row as skip', () => {
  const iso = mkIsolatedHome('d13');
  const env = Object.assign({}, process.env, { HOME: iso.home, USERPROFILE: iso.home, MINDRIAN_ROOMS_HOME: iso.roomsHome, DOCTOR_TEST_MODE: '1' });
  delete env.MINDRIAN_EUREKA_ROOT;
  const res = childProcess.spawnSync(process.execPath, [path.join(REPO, 'scripts', 'doctor.cjs'), '--json'], { env, encoding: 'utf8', timeout: 120000, input: '' });
  let report;
  try { report = JSON.parse(res.stdout); } catch (_e) { throw new Error('doctor did not print JSON: ' + String(res.stdout).slice(0, 120)); }
  const row = report.checks && report.checks[ROW_ID];
  assert.ok(row, 'the doctor report has no ' + ROW_ID + ' row');
  assert.strictEqual(row.status, 'skip', JSON.stringify(row).slice(0, 200));
});

console.log('\ntest-387-eureka-doctor-point: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
