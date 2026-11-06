#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 03: the engine requirements map, probes, uv argument builders and text
 * classifier (arms Q1 to Q13).
 *
 * Fixture folders and a fake spawn only. The real engine is never started, uv never runs, and no
 * network is used. Synthetic strings only. The engine here is the NEW mindrian-eureka engine; Q8
 * also refuses a folder whose pyproject.toml names another project or has no eureka-mcp script.
 * Hyphens only.
 *
 * Each arm loads the module itself, so a missing module prints FAIL for every arm.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mkIsolatedHome } = require('./helpers/isolated-home-36925.cjs');

const MOD = path.join(__dirname, '..', 'lib', 'core', 'eureka', 'eureka-engine-requirements.cjs');
const load = () => require(MOD);

let failed = 0;
let passed = 0;
function arm(label, fn) {
  try { fn(); passed += 1; process.stdout.write('ok - ' + label + '\n'); } catch (e) {
    failed += 1; process.stdout.write('FAIL - ' + label + '\n    ' + String(e && e.message || e).split('\n').join('\n    ') + '\n');
  }
}

const iso = mkIsolatedHome('q387');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-387-requirements-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

const ROOT = '/fixture/engine-root';
const PYPROJECT = (name, scripts) => '[project]\nname = "' + name + '"\nrequires-python = ">=3.11"\n\n[project.optional-dependencies]\nmcp-server = ["mcp>=2.0,<3"]\n' +
  (scripts === false ? '' : '\n[project.scripts]\neureka = "a.b:main"\neureka-mcp = "a.b.c:main"\n');

let counter = 0;
function engine(opts) {
  const o = opts || {};
  counter += 1;
  const dir = path.join(TMP, 'engine-' + counter);
  fs.mkdirSync(dir, { recursive: true });
  if (o.pyproject !== false) fs.writeFileSync(path.join(dir, 'pyproject.toml'), o.pyproject || PYPROJECT('mindrian-eureka'));
  if (o.venv) {
    const sp = path.join(dir, '.venv', o.windows ? path.join('Lib', 'site-packages') : path.join('lib', 'python3.12', 'site-packages'));
    if (o.venv === 'cfg-only') { fs.mkdirSync(path.join(dir, '.venv'), { recursive: true }); fs.writeFileSync(path.join(dir, '.venv', 'pyvenv.cfg'), 'home = /x\n'); } else {
      fs.mkdirSync(sp, { recursive: true });
      fs.writeFileSync(path.join(dir, '.venv', 'pyvenv.cfg'), 'home = /x\n');
      for (const e of o.venv) fs.mkdirSync(path.join(sp, e), { recursive: true });
    }
  }
  return dir;
}

function fakeSpawn(opts) {
  const o = opts || {};
  const calls = [];
  const fn = (cmd, args) => {
    calls.push([cmd].concat(args));
    const a = args.join(' ');
    if (args.length === 1 && args[0] === '--version' && cmd === 'node') {
      if (o.node === 'enoent') return { error: { code: 'ENOENT' }, status: null, stdout: '', stderr: '' };
      return { status: 0, stdout: (o.node || 'v22.1.0') + '\n', stderr: '' };
    }
    if (args.length === 1 && args[0] === '--version') {
      if (o.uv === 'enoent') return { error: { code: 'ENOENT' }, status: null, stdout: '', stderr: '' };
      return { status: 0, stdout: 'uv 0.9.4\n', stderr: '' };
    }
    if (args[0] === 'python' && args[1] === 'find' && args[2] === '--no-project') {
      if (o.python === 'missing') return { status: 2, stdout: '', stderr: 'error: No interpreter found' };
      return { status: 0, stdout: '/usr/bin/python3.12\n', stderr: '' };
    }
    throw new Error('unexpected spawn: ' + cmd + ' ' + a);
  };
  fn.calls = calls;
  return fn;
}

const SAFETY = ['--no-sync', '--offline', '--locked', '--no-python-downloads'];

arm('Q1 uvRunArgs carries the 4 safety flags in the arguments', () => {
  const m = load();
  assert.deepEqual(m.uvRunArgs(ROOT, ['mcp-server'], {}), ['run', '--no-sync', '--offline', '--locked', '--no-python-downloads', '--project', ROOT, '--extra', 'mcp-server', 'eureka-mcp']);
  assert.deepEqual(m.uvRunArgs(ROOT, ['mcp-server', 'hmm']), ['run', '--no-sync', '--offline', '--locked', '--no-python-downloads', '--project', ROOT, '--extra', 'mcp-server', '--extra', 'hmm', 'eureka-mcp']);
  assert.deepEqual(m.uvRunArgs(ROOT, ['mcp-server'], { entry: ['eureka', 'doctor', '--json'] }), ['run', '--no-sync', '--offline', '--locked', '--no-python-downloads', '--project', ROOT, '--extra', 'mcp-server', 'eureka', 'doctor', '--json']);
});

arm('Q2 uvRunArgs with allowNetwork drops three flags; bad extras and bad entries throw TypeError', () => {
  const m = load();
  assert.deepEqual(m.uvRunArgs(ROOT, ['mcp-server'], { allowNetwork: true }), ['run', '--locked', '--project', ROOT, '--extra', 'mcp-server', 'eureka-mcp']);
  for (const bad of ['hub-gate', 'neo4j', 'x;rm', '', 'mcp-server --foo']) {
    assert.throws(() => m.uvRunArgs(ROOT, ['mcp-server', bad], {}), TypeError, bad);
  }
  assert.throws(() => m.uvRunArgs(ROOT, ['mcp-server'], { entry: ['eureka', 'run'] }), TypeError);
  assert.throws(() => m.uvRunArgs(ROOT, ['mcp-server'], { entry: ['sh', '-c', 'x'] }), TypeError);
});

arm('Q3 uvSyncArgs: locked, no python downloads, mcp-server first and once, allowed names only', () => {
  const m = load();
  assert.deepEqual(m.uvSyncArgs(['modern-encoder']), ['sync', '--locked', '--no-python-downloads', '--extra', 'mcp-server', '--extra', 'modern-encoder']);
  assert.deepEqual(m.uvSyncArgs(['mcp-server', 'hmm', 'mcp-server']), ['sync', '--locked', '--no-python-downloads', '--extra', 'mcp-server', '--extra', 'hmm']);
  assert.deepEqual(m.uvSyncArgs([]), ['sync', '--locked', '--no-python-downloads', '--extra', 'mcp-server']);
  assert.throws(() => m.uvSyncArgs(['neo4j']), TypeError);
  assert.throws(() => m.uvSyncArgs(['hub-gate']), TypeError);
});

arm('Q4 needsForCall follows the contract table, every cell labeled', () => {
  const m = load();
  const labels = new Set(['plugin-code', 'engine-read', 'audit-hypothesis']);
  const g = m.needsForCall('eureka_graph_analyze', {}, {});
  assert.deepEqual(g.extras, ['mcp-server']);
  const scout = m.needsForCall('eureka_graph_opportunity_scout', {}, {});
  assert.deepEqual(scout.extras, ['mcp-server', 'modern-encoder']); assert.equal(scout.model, 'yes');
  assert.deepEqual(m.needsForCall('eureka_graph_opportunity_scout', {}, { MINDRIAN_EUREKA_RS_ENCODER: 'reference-bert' }).extras, ['mcp-server', 'reference-encoder']);
  const dec = m.needsForCall('eureka_capability_run', { capability_id: 'decision.fit_sequence_patterns' }, {});
  assert.deepEqual(dec.extras, ['mcp-server', 'hmm']);
  assert.deepEqual(m.needsForCall('eureka_capability_start', { capability_id: 'decision.compare_sequence_patterns' }, {}).extras, ['mcp-server', 'hmm']);
  const pairs = m.needsForCall('eureka_capability_run', { capability_id: 'opportunity.find_cross_domain_pairs' }, {});
  assert.deepEqual(pairs.extras, ['mcp-server', 'modern-encoder']); assert.equal(pairs.model, 'yes');
  const disc = m.needsForCall('eureka_capability_start', { capability_id: 'opportunity.synthesize_discovery_signals' }, { MINDRIAN_EUREKA_RS_ENCODER: 'reference-bert' });
  assert.deepEqual(disc.extras, ['mcp-server', 'reference-encoder']); assert.equal(disc.model, 'yes');
  const other = m.needsForCall('eureka_capability_run', { capability_id: 'analysis.compare_text_differences' }, {});
  assert.deepEqual(other.extras, ['mcp-server']);
  const unknown = m.needsForCall('eureka_not_a_tool', {}, {});
  assert.deepEqual(unknown.extras, ['mcp-server']); assert.equal(unknown.model, 'unknown'); assert.equal(unknown.node, 'unknown');
  for (const n of [g, scout, dec, pairs, disc, other, unknown]) {
    assert.ok(['yes', 'no', 'unknown'].includes(n.model) && ['yes', 'no', 'unknown'].includes(n.node));
    assert.equal(n.evidence.extras, 'plugin-code');
    for (const k of ['extras', 'model', 'node']) assert.ok(labels.has(n.evidence[k]), k + ' label ' + n.evidence[k]);
  }
  // Cells settled from the engine files (names only): graph tools need no model and no Node;
  // the Genesis plan needs Node; the scout needs a model and no Node.
  assert.equal(g.model, 'no'); assert.equal(g.node, 'no'); assert.equal(g.evidence.model, 'engine-read');
  const gen = m.needsForCall('eureka_graph_genesis_plan', {}, {});
  assert.equal(gen.node, 'yes'); assert.equal(gen.evidence.node, 'engine-read');
  assert.equal(scout.node, 'no');
  const expert = m.needsForCall('eureka_capability_run', { capability_id: 'research.extract_experts_from_papers' }, {});
  assert.equal(expert.node, 'yes');
});

arm('Q5 extrasInstalled reads site-packages names and spawns nothing', () => {
  const m = load();
  const posix = engine({ venv: ['mcp-2.3.0.dist-info', 'sentence_transformers-5.0.0.dist-info'] });
  const r = m.extrasInstalled(posix, {}, {});
  assert.equal(r.venv_present, true); assert.equal(r.located, true);
  assert.deepEqual(r.installed, { 'mcp-server': true, 'modern-encoder': true, hmm: false, 'reference-encoder': false });
  const win = engine({ venv: ['mcp', 'Sentence-Transformers-5.0.0.dist-info'], windows: true });
  const w = m.extrasInstalled(win, {}, {});
  assert.equal(w.installed['mcp-server'], true); assert.equal(w.installed['modern-encoder'], true);
  // a relative UV_PROJECT_ENVIRONMENT is read from the root
  const rel = engine({ pyproject: PYPROJECT('mindrian-eureka') });
  const spRel = path.join(rel, 'custom-env', 'lib', 'python3.11', 'site-packages');
  fs.mkdirSync(path.join(spRel, 'mcp-2.0.0.dist-info'), { recursive: true });
  fs.writeFileSync(path.join(rel, 'custom-env', 'pyvenv.cfg'), 'x');
  const rr = m.extrasInstalled(rel, { UV_PROJECT_ENVIRONMENT: 'custom-env' }, {});
  assert.equal(rr.venv_present, true); assert.equal(rr.installed['mcp-server'], true);
  // reference-encoder needs both torch and transformers
  const ref = engine({ venv: ['torch-2.1.0+cpu.dist-info'] });
  assert.equal(m.extrasInstalled(ref, {}, {}).installed['reference-encoder'], false);
  const ref2 = engine({ venv: ['torch-2.1.0+cpu.dist-info', 'transformers-4.5.0.dist-info'] });
  assert.equal(m.extrasInstalled(ref2, {}, {}).installed['reference-encoder'], true);
  // a name that only starts like the marker does not count
  const near = engine({ venv: ['mcp_extra-1.0.dist-info'] });
  assert.equal(m.extrasInstalled(near, {}, {}).installed['mcp-server'], false);
  const none = engine({});
  assert.equal(m.extrasInstalled(none, {}, {}).venv_present, false);
  const cfg = engine({ venv: 'cfg-only' });
  const c = m.extrasInstalled(cfg, {}, {});
  assert.equal(c.venv_present, true); assert.equal(c.located, false);
  assert.deepEqual(Object.values(c.installed), [null, null, null, null]);
});

arm('Q6 nodeStatus: 22 ok, 20 too old, spawn error missing, unreadable missing', () => {
  const m = load();
  const spawn = (v) => ({ spawnSync: (c, a) => v === 'enoent' ? { error: { code: 'ENOENT' }, status: null, stdout: '' } : { status: 0, stdout: v } });
  assert.deepEqual(Object.assign({}, m.nodeStatus({}, spawn('v22.1.0'))), { ok: true, version: 'v22.1.0', cause: null });
  const old = m.nodeStatus({}, spawn('v20.11.0\n'));
  assert.equal(old.ok, false); assert.equal(old.cause, 'node_too_old'); assert.equal(old.version, 'v20.11.0');
  assert.equal(m.nodeStatus({}, spawn('enoent')).cause, 'node_missing');
  assert.equal(m.nodeStatus({}, spawn('garbage output')).cause, 'node_missing');
  assert.equal(m.nodeStatus({}, spawn('')).cause, 'node_missing');
  assert.equal(m.nodeStatus({}, spawn('v24.0.0')).ok, true);
});

arm('Q7 modelHint: env path folder, then Hugging Face hub entry, else not found', () => {
  const m = load();
  const model = path.join(TMP, 'model-folder'); fs.mkdirSync(model, { recursive: true });
  const home = path.join(iso.home, 'q7'); fs.mkdirSync(home, { recursive: true });
  assert.deepEqual(m.modelHint({ HOME: home, MINDRIAN_EUREKA_RS_MODEL_PATH: model }), { found: true, via: 'env-path' });
  assert.equal(m.modelHint({ HOME: home, MINDRIAN_EUREKA_HSI_MODEL_PATH: path.join(TMP, 'nope') }).found, false);
  const hub = path.join(TMP, 'hf-hub'); fs.mkdirSync(path.join(hub, 'models--org--name'), { recursive: true });
  assert.deepEqual(m.modelHint({ HOME: home, HF_HUB_CACHE: hub }), { found: true, via: 'hf-cache' });
  const hfHome = path.join(TMP, 'hf-home'); fs.mkdirSync(path.join(hfHome, 'hub', 'models--x'), { recursive: true });
  assert.deepEqual(m.modelHint({ HOME: home, HF_HOME: hfHome }), { found: true, via: 'hf-cache' });
  const home2 = path.join(iso.home, 'q7b'); fs.mkdirSync(path.join(home2, '.cache', 'huggingface', 'hub', 'models--y'), { recursive: true });
  assert.deepEqual(m.modelHint({ HOME: home2 }), { found: true, via: 'hf-cache' });
  const emptyHub = path.join(TMP, 'hf-empty'); fs.mkdirSync(emptyHub, { recursive: true });
  assert.equal(m.modelHint({ HOME: home, HF_HUB_CACHE: emptyHub }).found, false);
  assert.equal(m.modelHint({}).found, false);
});

arm('Q8 checkEngine names the cause, reads package groups, never reports ready from pyvenv.cfg alone', () => {
  const m = load();
  const env = { HOME: path.join(iso.home, 'q8') };
  const good = engine({ venv: ['mcp-2.3.0.dist-info'] });
  const sp = fakeSpawn();
  const r = m.checkEngine(good, { spawnSync: sp, env });
  assert.equal(r.ok, true); assert.equal(r.cause, null);
  assert.deepEqual(r.checks.map((c) => c.id), ['checkout', 'project_name', 'uv', 'python', 'node', 'extras', 'model', 'env_prepared']);
  const fam = Object.fromEntries(r.families.map((f) => [f.family, f]));
  assert.equal(fam.graph.status, 'ready');
  assert.equal(fam['pairs-and-scout'].status, 'needs_extra'); assert.equal(fam['pairs-and-scout'].cause, 'extra_missing');
  assert.equal(fam.decision.status, 'needs_extra');
  assert.equal(fam['node-workers'].status, 'ready');
  const allowed = [['uv', '--version'].join(' '), 'uv python find --no-project >=3.11', 'node --version'];
  for (const c of sp.calls) assert.ok(allowed.includes(c.join(' ')), 'argv shape: ' + c.join(' '));
  // everything installed
  const all = engine({ venv: ['mcp-2.3.0.dist-info', 'sentence_transformers-5.0.0.dist-info', 'pomegranate-1.1.2.dist-info'] });
  const full = m.checkEngine(all, { spawnSync: fakeSpawn(), env });
  assert.equal(full.ok, true);
  assert.equal(Object.fromEntries(full.families.map((f) => [f.family, f])).decision.status, 'ready');
  const pairs = Object.fromEntries(full.families.map((f) => [f.family, f]))['pairs-and-scout'];
  assert.equal(pairs.status, 'ready'); assert.equal(pairs.model_hint, false);
  // uv missing
  let x = m.checkEngine(good, { spawnSync: fakeSpawn({ uv: 'enoent' }), env });
  assert.equal(x.ok, false); assert.equal(x.cause, 'uv_missing');
  // python missing
  x = m.checkEngine(good, { spawnSync: fakeSpawn({ python: 'missing' }), env });
  assert.equal(x.ok, false); assert.equal(x.cause, 'python_missing');
  // no .venv
  x = m.checkEngine(engine({}), { spawnSync: fakeSpawn(), env });
  assert.equal(x.ok, false); assert.equal(x.cause, 'env_not_synced');
  // site-packages located but mcp missing
  x = m.checkEngine(engine({ venv: ['numpy-2.0.0.dist-info'] }), { spawnSync: fakeSpawn(), env });
  assert.equal(x.ok, false); assert.equal(x.cause, 'extra_missing');
  // Node 20 keeps ok true and flags the node workers
  x = m.checkEngine(good, { spawnSync: fakeSpawn({ node: 'v20.11.0' }), env });
  assert.equal(x.ok, true);
  const nw = x.families.find((f) => f.family === 'node-workers');
  assert.equal(nw.status, 'needs_node'); assert.equal(nw.cause, 'node_too_old');
  x = m.checkEngine(good, { spawnSync: fakeSpawn({ node: 'enoent' }), env });
  assert.equal(x.families.find((f) => f.family === 'node-workers').cause, 'node_missing');
  // pyvenv.cfg alone: ok is null, never true
  x = m.checkEngine(engine({ venv: 'cfg-only' }), { spawnSync: fakeSpawn(), env });
  assert.equal(x.ok, null);
  // a folder that is not the engine
  x = m.checkEngine(engine({ pyproject: PYPROJECT('other-project') }), { spawnSync: fakeSpawn(), env });
  assert.equal(x.ok, false); assert.equal(x.cause, 'project_name_mismatch');
  x = m.checkEngine(engine({ pyproject: PYPROJECT('mindrian-eureka', false) }), { spawnSync: fakeSpawn(), env });
  assert.equal(x.ok, false); assert.equal(x.cause, 'project_name_mismatch');
  x = m.checkEngine(engine({ pyproject: false }), { spawnSync: fakeSpawn(), env });
  assert.equal(x.ok, false); assert.equal(x.cause, 'pyproject_missing');
  x = m.checkEngine(path.join(TMP, 'no-such-folder'), { spawnSync: fakeSpawn(), env });
  assert.equal(x.cause, 'checkout_missing');
  // the uv override variable is the command
  const sp2 = fakeSpawn();
  m.checkEngine(good, { spawnSync: sp2, env: Object.assign({ MINDRIAN_EUREKA_UV: '/fixture/uv-binary' }, env) });
  assert.ok(sp2.calls.some((c) => c[0] === '/fixture/uv-binary' && c[1] === '--version'));
});

arm('Q9 engineWrites lists the environment, data, cache and Hugging Face folders', () => {
  const m = load();
  const home = path.join(iso.home, 'q9');
  const base = m.engineWrites({ HOME: home, MINDRIAN_EUREKA_ROOT: ROOT });
  const byKind = Object.fromEntries(base.map((e) => [e.kind, e]));
  assert.deepEqual(Object.keys(byKind).sort(), ['cache', 'data', 'environment', 'huggingface']);
  assert.equal(byKind.environment.path, path.join(path.resolve(ROOT), '.venv'));
  assert.equal(byKind.data.path, path.join(home, '.local', 'share', 'mindrian-eureka'));
  assert.equal(byKind.cache.path, path.join(home, '.cache', 'mindrian-eureka'));
  assert.equal(byKind.huggingface.path, path.join(home, '.cache', 'huggingface', 'hub'));
  assert.equal(byKind.huggingface.access, 'read');
  for (const e of base) assert.ok(e.kind && e.path && e.access);
  const over = Object.fromEntries(m.engineWrites({ HOME: home, MINDRIAN_EUREKA_ROOT: ROOT, UV_PROJECT_ENVIRONMENT: '/fixture/venv', MINDRIAN_EUREKA_DATA_DIR: '/fixture/data', MINDRIAN_EUREKA_CACHE_DIR: '/fixture/cache' }).map((e) => [e.kind, e]));
  assert.equal(over.environment.path, path.resolve('/fixture/venv')); assert.equal(over.data.path, path.resolve('/fixture/data')); assert.equal(over.cache.path, path.resolve('/fixture/cache'));
});

arm('Q10 syncHosts names the hosts, python downloads off, and the source build', () => {
  const m = load();
  assert.deepEqual(m.syncHosts(['mcp-server']), { hosts: ['pypi.org', 'files.pythonhosted.org'], python_downloads: 'off', builds_from_source: [] });
  assert.deepEqual(m.syncHosts(['mcp-server', 'modern-encoder']).hosts, ['pypi.org', 'files.pythonhosted.org', 'download.pytorch.org']);
  assert.deepEqual(m.syncHosts(['mcp-server', 'reference-encoder']).hosts.includes('download.pytorch.org'), true);
  assert.deepEqual(m.syncHosts(['mcp-server', 'hmm']).builds_from_source, ['pomegranate']);
  assert.equal(m.syncHosts(['mcp-server', 'hmm']).hosts.includes('github.com'), false);
  assert.equal(m.syncHosts([]).python_downloads, 'off');
});

arm('Q11 classifyEngineText maps engine and uv texts to causes; startLine cleans one line', () => {
  const m = load();
  const c = m.classifyEngineText;
  assert.deepEqual(c("Install the optional extra: pip install 'mindrian-eureka[modern-encoder]'"), { cause: 'extra_missing', extras: ['modern-encoder'] });
  assert.deepEqual(c("ModuleNotFoundError: No module named 'mcp'"), { cause: 'extra_missing', extras: ['mcp-server'] });
  assert.deepEqual(c("No module named 'sentence_transformers'"), { cause: 'extra_missing', extras: ['modern-encoder'] });
  assert.deepEqual(c("No module named 'pomegranate'"), { cause: 'extra_missing', extras: ['hmm'] });
  assert.deepEqual(c("No module named 'torch'"), { cause: 'extra_missing', extras: ['reference-encoder'] });
  assert.deepEqual(c("No module named 'transformers'"), { cause: 'extra_missing', extras: ['reference-encoder'] });
  assert.equal(c('No local model found. Searched: x').cause, 'model_missing');
  assert.equal(c('status: local_model_unavailable').cause, 'model_missing');
  assert.equal(c('A local sentence-transformer model is required; set X').cause, 'model_missing');
  assert.equal(c('RS expert extraction requires Node.js 22 or newer').cause, 'node_too_old');
  assert.equal(c('Genesis runtime unavailable: Node.js was not found, install Node.js 22 or newer').cause, 'node_missing');
  assert.equal(c('error: No interpreter found for Python >=3.11 in managed installations or search path').cause, 'python_missing');
  assert.equal(c('error: The lockfile at `uv.lock` needs to be updated').cause, 'lock_stale');
  assert.equal(c('spawn uv ENOENT').cause, 'uv_missing');
  assert.equal(c('bash: uv: command not found').cause, 'uv_missing');
  assert.equal(c('uv was not found on PATH.').cause, 'uv_missing');
  assert.equal(c('error: No virtual environment found').cause, 'env_not_synced');
  assert.equal(c('something unrelated happened'), null);
  assert.equal(c(''), null);
  assert.equal(c(null), null);
  const s = m.startLine;
  assert.equal(s('', {}), '');
  assert.equal(s(null, {}), '');
  assert.equal(s('\n\n  first line at /fixture/engine-root/x and /fixture/home/y\nsecond', { root: '/fixture/engine-root', home: '/fixture/home' }), 'first line at <MINDRIAN_EUREKA_ROOT>/x and ~/y');
  assert.equal(s('bad\u0007char é', {}), 'badchar ?');
  assert.equal(s('x'.repeat(400), {}).length, 160);
});

arm('Q12 static: the modules open no network, name no retired folder, and spawn only in checkEngine and nodeStatus', () => {
  load();
  for (const file of [MOD, path.join(__dirname, '..', 'lib', 'core', 'eureka', 'eureka-engine-resolver.cjs')]) {
    const raw = fs.readFileSync(file, 'utf8');
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/node:https?|require\(['"]https?['"]\)|node:net\b|node:dns|brain-client|mindrian-brain/.test(src), path.basename(file) + ' network or Brain require');
    assert.ok(!/\bfetch\s*\(/.test(src), path.basename(file) + ' fetch call');
    assert.ok(!/research\/eureka|mos-workspace-runtime/.test(src), path.basename(file) + ' retired folder name');
    assert.ok(!/\bexec\w*\s*\(|child_process\.exec/.test(src.replace(/\.spawnSync/g, '')), path.basename(file) + ' exec call');
  }
  const src = fs.readFileSync(MOD, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const bodies = [];
  for (const name of ['checkEngine', 'nodeStatus']) {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start >= 0, 'function ' + name + ' not found');
    let depth = 0; let i = src.indexOf('{', start); const begin = i;
    for (; i < src.length; i += 1) { if (src[i] === '{') depth += 1; else if (src[i] === '}') { depth -= 1; if (depth === 0) break; } }
    bodies.push([begin, i]);
  }
  const re = /\bspawnSync\s*\(|\bspawn\s*\(|\bexecFileSync\s*\(|\bexecSync\s*\(/g;
  let hit;
  while ((hit = re.exec(src)) !== null) {
    assert.ok(bodies.some(([b, e]) => hit.index > b && hit.index < e), 'a spawn call outside checkEngine and nodeStatus at offset ' + hit.index);
  }
});

arm('Q13 the requirements module reuses the resolver (describeEngineState, reasonForCause)', () => {
  const src = fs.readFileSync(MOD, 'utf8');
  assert.ok(/eureka-engine-resolver/.test(src));
  const m = load();
  assert.equal(typeof m.EXTRA_MARKERS, 'object'); assert.ok(Object.isFrozen(m.EXTRA_MARKERS));
  assert.deepEqual(m.SYNC_EXTRAS_ALLOWED, ['mcp-server', 'modern-encoder', 'reference-encoder', 'hmm']);
});

process.stdout.write('\ntest-387-eureka-engine-requirements: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
