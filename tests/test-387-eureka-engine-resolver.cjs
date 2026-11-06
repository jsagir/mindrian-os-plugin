#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 03: the engine resolver (arms R1 to R12).
 *
 * The resolver is the one place that decides where the Eureka engine is: the environment override,
 * then the saved setting file ~/.mindrian/eureka-engine.json, then the default folder
 * ~/.mindrian/eureka-engine. It answers absent, present or broken with a typed cause and never
 * throws or spawns.
 *
 * Fixture folders only, in an isolated HOME. The engine here is the NEW mindrian-eureka engine; a
 * folder that lacks the engine pyproject.toml (for example a plugin-style folder) is refused
 * as engine_checkout_unavailable (arm R11). No real engine, no network. Hyphens only.
 *
 * Each arm loads the module itself, so a missing module prints FAIL for every arm and does not
 * crash before printing.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mkIsolatedHome } = require('./helpers/isolated-home-36925.cjs');

const MOD = path.join(__dirname, '..', 'lib', 'core', 'eureka', 'eureka-engine-resolver.cjs');
const load = () => require(MOD);

let failed = 0;
let passed = 0;
function arm(label, fn) {
  try { fn(); passed += 1; process.stdout.write('ok - ' + label + '\n'); } catch (e) {
    failed += 1; process.stdout.write('FAIL - ' + label + '\n    ' + String(e && e.message || e).split('\n').join('\n    ') + '\n');
  }
}

const iso = mkIsolatedHome('r387');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-387-resolver-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

function engineFolder(name, projectName) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname = "' + (projectName || 'mindrian-eureka') + '"\nrequires-python = ">=3.11"\n\n[project.scripts]\neureka-mcp = "x.y:main"\n');
  return dir;
}
function homeEnv(home, extra) { return Object.assign({ HOME: home }, extra || {}); }
function freshHome(name) {
  const home = path.join(iso.home, name);
  fs.mkdirSync(path.join(home, '.mindrian'), { recursive: true });
  return home;
}
function writeSetting(home, content) {
  fs.writeFileSync(path.join(home, '.mindrian', 'eureka-engine.json'), content);
}

const ENGINE_A = engineFolder('engine-a');
const ENGINE_B = engineFolder('engine-b');

arm('R1 the variable names a folder with pyproject.toml: present, source env', () => {
  const r = load().resolveEngine(homeEnv(freshHome('h1'), { MINDRIAN_EUREKA_ROOT: ENGINE_A }));
  assert.equal(r.state, 'present'); assert.equal(r.source, 'env'); assert.equal(r.root, path.resolve(ENGINE_A));
  assert.equal(r.cause, null); assert.equal(r.reason, null);
});

arm('R2 no variable, a saved setting names a valid folder: present, source pointer', () => {
  const home = freshHome('h2');
  writeSetting(home, JSON.stringify({ schema: 1, root: ENGINE_A, set_at: '2026-11-06T00:00:00Z', source: 'adopted' }));
  const r = load().resolveEngine(homeEnv(home));
  assert.equal(r.state, 'present'); assert.equal(r.source, 'pointer'); assert.equal(r.root, path.resolve(ENGINE_A));
});

arm('R3 the variable wins over the saved setting', () => {
  const home = freshHome('h3');
  writeSetting(home, JSON.stringify({ schema: 1, root: ENGINE_A }));
  const r = load().resolveEngine(homeEnv(home, { MINDRIAN_EUREKA_ROOT: ENGINE_B }));
  assert.equal(r.source, 'env'); assert.equal(r.root, path.resolve(ENGINE_B));
});

arm('R4 default folder: present with source default; folder missing: absent, engine_not_configured', () => {
  const home = freshHome('h4');
  const absent = load().resolveEngine(homeEnv(home));
  assert.equal(absent.state, 'absent'); assert.equal(absent.source, null); assert.equal(absent.root, null);
  assert.equal(absent.cause, null); assert.equal(absent.reason, 'engine_not_configured');
  const def = path.join(home, '.mindrian', 'eureka-engine');
  fs.mkdirSync(def, { recursive: true });
  fs.copyFileSync(path.join(ENGINE_A, 'pyproject.toml'), path.join(def, 'pyproject.toml'));
  const r = load().resolveEngine(homeEnv(home));
  assert.equal(r.state, 'present'); assert.equal(r.source, 'default'); assert.equal(r.root, path.resolve(def));
});

arm('R5 a missing folder is checkout_missing; a folder with no pyproject.toml is pyproject_missing', () => {
  const home = freshHome('h5');
  const missing = load().resolveEngine(homeEnv(home, { MINDRIAN_EUREKA_ROOT: path.join(TMP, 'does-not-exist') }));
  assert.equal(missing.state, 'broken'); assert.equal(missing.cause, 'checkout_missing'); assert.equal(missing.reason, 'engine_checkout_unavailable');
  const empty = path.join(TMP, 'empty-folder'); fs.mkdirSync(empty, { recursive: true });
  const noPy = load().resolveEngine(homeEnv(home, { MINDRIAN_EUREKA_ROOT: empty }));
  assert.equal(noPy.state, 'broken'); assert.equal(noPy.cause, 'pyproject_missing'); assert.equal(noPy.reason, 'engine_checkout_unavailable');
});

arm('R6 a saved setting that is not JSON, or has no root string, is broken pointer_unreadable', () => {
  const home = freshHome('h6');
  writeSetting(home, '{not json');
  const a = load().resolveEngine(homeEnv(home));
  assert.equal(a.state, 'broken'); assert.equal(a.cause, 'pointer_unreadable'); assert.equal(a.source, 'pointer');
  writeSetting(home, JSON.stringify({ schema: 1 }));
  const b = load().resolveEngine(homeEnv(home));
  assert.equal(b.state, 'broken'); assert.equal(b.cause, 'pointer_unreadable');
  writeSetting(home, JSON.stringify({ schema: 1, root: 42 }));
  assert.equal(load().resolveEngine(homeEnv(home)).cause, 'pointer_unreadable');
});

arm('R7 an environment object with no HOME and no USERPROFILE reads no setting and no default folder', () => {
  const home = freshHome('h7');
  writeSetting(home, JSON.stringify({ schema: 1, root: ENGINE_A }));
  const def = path.join(home, '.mindrian', 'eureka-engine');
  fs.mkdirSync(def, { recursive: true });
  fs.copyFileSync(path.join(ENGINE_A, 'pyproject.toml'), path.join(def, 'pyproject.toml'));
  const r = load().resolveEngine({});
  assert.equal(r.state, 'absent'); assert.equal(r.reason, 'engine_not_configured');
  assert.equal(load().readPointer({}).ok, false);
});

arm('R8 resolveEngine never throws (null, undefined, a NUL character, a root that is a file)', () => {
  const m = load();
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, ROOT: process.env.MINDRIAN_EUREKA_ROOT };
  try {
    // undefined means process.env: point it at the isolated home so the real home is never read.
    process.env.HOME = freshHome('h8'); process.env.USERPROFILE = process.env.HOME; delete process.env.MINDRIAN_EUREKA_ROOT;
    assert.doesNotThrow(() => m.resolveEngine(undefined));
    assert.equal(m.resolveEngine(undefined).state, 'absent');
  } finally {
    for (const [k, v] of [['HOME', saved.HOME], ['USERPROFILE', saved.USERPROFILE], ['MINDRIAN_EUREKA_ROOT', saved.ROOT]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
  assert.doesNotThrow(() => m.resolveEngine(null));
  assert.equal(m.resolveEngine(null).state, 'absent');
  const nul = m.resolveEngine({ MINDRIAN_EUREKA_ROOT: 'a\u0000b' });
  assert.equal(nul.state, 'broken');
  const file = path.join(TMP, 'a-plain-file.txt'); fs.writeFileSync(file, 'x');
  const f = m.resolveEngine({ MINDRIAN_EUREKA_ROOT: file });
  assert.equal(f.state, 'broken'); assert.equal(f.reason, 'engine_checkout_unavailable');
  assert.equal(m.resolveEngine({ MINDRIAN_EUREKA_ROOT: '   ' }).state, 'absent');
});

const SENTENCES = {
  absent: ['The Eureka engine is not set up on this machine.', '/mos:eureka enable engine --path <folder>'],
  present: ['The Eureka engine is set up.', ''],
  checkout_missing: ['The saved Eureka engine folder is missing.', '/mos:eureka enable engine --path <folder>'],
  pyproject_missing: ['The Eureka engine folder has no pyproject.toml, so it is not an engine checkout.', '/mos:eureka enable engine --path <folder>'],
  pointer_unreadable: ['The saved Eureka engine setting cannot be read.', '/mos:eureka enable engine --path <folder>'],
  project_name_mismatch: ['The folder is not the Mindrian Eureka engine. Its project name is not mindrian-eureka.', '/mos:eureka enable engine --path <folder>'],
  uv_missing: ['The tool uv is not installed or is not on the PATH, so the engine cannot start.', 'Install uv (https://docs.astral.sh/uv/getting-started/installation/), then run /mos:eureka enable engine --check'],
  python_missing: ['No Python that meets the engine requirement was found.', 'Install a Python that meets the engine requirement, then run /mos:eureka enable engine --check'],
  env_not_synced: ['The engine folder has no prepared Python environment yet.', '/mos:eureka enable engine --sync'],
  lock_stale: ['The engine uv.lock does not match its pyproject.toml, so the offline start was refused.', 'Update the engine checkout, then run /mos:eureka enable engine --sync'],
  model_missing: ['No local embedding model was found. The engine never downloads one.', "Put a model folder on this machine and set MINDRIAN_EUREKA_RS_MODEL_PATH to it (the engine's docs/offline-install.md explains how), then run /mos:eureka enable engine --check"],
  node_missing: ['Node.js was not found on the PATH. Some Eureka workers need Node.js 22 or newer.', 'Install Node.js 22 or newer, then run /mos:eureka enable engine --check'],
  node_too_old: ['Node.js is older than version 22. Some Eureka workers need Node.js 22 or newer.', 'Install Node.js 22 or newer, then run /mos:eureka enable engine --check'],
  engine_start_failed: ['The engine did not start.', '/mos:eureka enable engine --check --deep'],
};

arm('R9 describeEngineState gives the exact sentence and fix for all 15 cases, with no absolute path', () => {
  const m = load();
  const seen = new Set();
  for (const [key, [sentence, fix]] of Object.entries(SENTENCES)) {
    const input = key === 'absent' ? { state: 'absent', cause: null } : key === 'present' ? { state: 'present', cause: null } : { state: 'broken', cause: key };
    const d = m.describeEngineState(input);
    assert.equal(d.sentence, sentence, key + ' sentence');
    assert.equal(d.fix, fix, key + ' fix');
    assert.ok(!/(^|[\s(])\/[A-Za-z]/.test(d.sentence.replace(/\/mos:/g, '')), key + ' sentence holds an absolute path');
    assert.ok(/^[\x20-\x7e]*$/.test(d.sentence + d.fix), key + ' is ASCII');
    seen.add(key);
  }
  const ex = m.describeEngineState({ state: 'broken', cause: 'extra_missing', detail: { extras: ['modern-encoder', 'hmm'] } });
  assert.equal(ex.sentence, 'The engine package group modern-encoder, hmm is not installed.');
  assert.equal(ex.fix, '/mos:eureka enable engine --sync --extras modern-encoder,hmm');
  assert.equal(ex.reason, 'engine_extra_missing');
  assert.equal(seen.size, 14);
});

arm('R10 reasonForCause gives the typed reason for all 13 causes and for null', () => {
  const m = load();
  const want = {
    checkout_missing: 'engine_checkout_unavailable', pyproject_missing: 'engine_checkout_unavailable',
    pointer_unreadable: 'engine_checkout_unavailable', project_name_mismatch: 'engine_checkout_unavailable',
    extra_missing: 'engine_extra_missing', model_missing: 'engine_model_missing',
    node_missing: 'engine_node_missing', node_too_old: 'engine_node_missing',
    uv_missing: 'engine_unavailable', python_missing: 'engine_unavailable', env_not_synced: 'engine_unavailable',
    lock_stale: 'engine_unavailable', engine_start_failed: 'engine_unavailable',
  };
  assert.deepEqual(Object.keys(m.ENGINE_CAUSES).sort(), Object.keys(want).sort());
  assert.ok(Object.isFrozen(m.ENGINE_CAUSES));
  for (const [cause, reason] of Object.entries(want)) assert.equal(m.reasonForCause(cause), reason, cause);
  assert.equal(m.reasonForCause(null), 'engine_not_configured');
});

arm('R11 a folder that is not the engine (plugin-style, no pyproject.toml) is refused as engine_checkout_unavailable', () => {
  const m = load();
  // A synthetic plugin-style folder: a plugin manifest and a package.json, no engine pyproject.toml.
  const pluginStyle = path.join(TMP, 'plugin-style-folder');
  fs.mkdirSync(path.join(pluginStyle, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(pluginStyle, '.claude-plugin', 'plugin.json'), '{"name":"not-an-engine"}');
  fs.writeFileSync(path.join(pluginStyle, 'package.json'), '{"name":"not-an-engine"}');
  const viaEnv = m.resolveEngine(homeEnv(freshHome('h11a'), { MINDRIAN_EUREKA_ROOT: pluginStyle }));
  assert.equal(viaEnv.state, 'broken'); assert.equal(viaEnv.reason, 'engine_checkout_unavailable'); assert.equal(viaEnv.cause, 'pyproject_missing');
  const home = freshHome('h11b');
  writeSetting(home, JSON.stringify({ schema: 1, root: pluginStyle }));
  const viaPointer = m.resolveEngine(homeEnv(home));
  assert.equal(viaPointer.reason, 'engine_checkout_unavailable');
  const def = path.join(freshHome('h11c'), '.mindrian', 'eureka-engine');
  fs.mkdirSync(def, { recursive: true });
  fs.writeFileSync(path.join(def, 'package.json'), '{}');
  assert.equal(m.resolveEngine({ HOME: path.dirname(path.dirname(def)) }).reason, 'engine_checkout_unavailable');
  // The resolver never searches any other folder: with nothing set it is absent, whatever else exists.
  assert.equal(m.resolveEngine(homeEnv(freshHome('h11d'))).state, 'absent');
});

arm('R12 the saved setting round trip, and the module names no retired folder and spawns nothing', () => {
  const m = load();
  const home = freshHome('h12');
  const env = homeEnv(home);
  assert.equal(path.basename(m.enginePointerPath(env)), 'eureka-engine.json');
  assert.ok(m.enginePointerPath(env).startsWith(home));
  const w = m.writePointer(ENGINE_A, env);
  assert.equal(w.ok, true);
  if (process.platform !== 'win32') assert.equal(fs.statSync(w.path).mode & 0o777, 0o600);
  const content = JSON.parse(fs.readFileSync(w.path, 'utf8'));
  assert.equal(content.schema, 1); assert.equal(content.source, 'adopted'); assert.equal(content.root, path.resolve(ENGINE_A));
  assert.deepEqual(Object.keys(content).sort(), ['root', 'schema', 'set_at', 'source']);
  assert.deepEqual(m.readPointer(env), { ok: true, root: path.resolve(ENGINE_A) });
  assert.equal(m.resolveEngine(env).source, 'pointer');
  assert.deepEqual(fs.readdirSync(path.join(home, '.mindrian')), ['eureka-engine.json']);
  assert.deepEqual(m.clearPointer(env), { ok: true, removed: true });
  assert.deepEqual(m.clearPointer(env), { ok: true, removed: false });
  assert.equal(m.readPointer(env).ok, false);
  assert.equal(m.writePointer('', env).ok, false);
  assert.equal(m.writePointer(ENGINE_A, {}).ok, false);
  const src = fs.readFileSync(MOD, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/child_process|\bspawn|\bexec(File)?(Sync)?\s*\(|node:https?|node:net|node:dns|\bfetch\s*\(/.test(src), 'the resolver must not spawn or reach a network');
  assert.ok(!/research\/eureka|mos-workspace-runtime/.test(src), 'the resolver must not name the retired Eureka folder');
});

process.stdout.write('\ntest-387-eureka-engine-resolver: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
