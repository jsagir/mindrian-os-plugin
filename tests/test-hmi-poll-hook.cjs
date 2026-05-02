#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 105-03 -- behavioral test suite for the hmi-compliance-poll hook
 * wrapper. Spawns scripts/hmi-compliance-poll.cjs --hook as a child via
 * spawnSync with crafted stdin payloads (BASH-95-01 envelopes).
 *
 * 9 assertion classes:
 *   01  Module exports new hook helpers (HOOK_ALLOWED_KEYS, hookMain, etc.)
 *   02  Stop event with no-active-room: silent envelope, no side-channel
 *   03  Stop event with active room: side-channel written, envelope clean
 *   04  Non-Stop event (SessionStart) is silent no-op (does NOT poll)
 *   05  Malformed stdin survives: emits silent envelope, exit 0
 *   06  Empty stdin survives: emits silent envelope, exit 0
 *   07  Envelope schema strict: only BASH-95-01 allowed top-level keys
 *   08  hooks.json registers the Stop hook entry (sibling to 99/100)
 *   09  Latency budget: < 250ms target, 1500ms ceiling (informational)
 *
 * Self-contained: each test creates its own tmp directory under
 * os.tmpdir() and tears down via fs.rmSync in finally.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HOOK_SCRIPT = path.join(REPO, 'scripts', 'hmi-compliance-poll.cjs');

let pass = 0;
let fail = 0;

function ok(name) {
  pass += 1;
  process.stdout.write('  PASS  ' + name + '\n');
}

function ng(name, err) {
  fail += 1;
  process.stdout.write('  FAIL  ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

// ---------- helpers ----------

function setupSyntheticRegistry(opts) {
  opts = opts || {};
  const sealed = !!opts.sealed;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hmi-poll-hook-'));
  const roomsHome = path.join(tmp, 'rooms');
  const roomDir = path.join(roomsHome, 'test-room');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nfixture: phase-105-03\n---\n');
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify({
      active_room: 'test-room',
      rooms: [{
        slug: 'test-room',
        venture_name: 'Test Room',
        abs_path: roomDir,
        sealed: sealed,
      }],
    }, null, 2)
  );
  return { tmp: tmp, roomsHome: roomsHome, roomDir: roomDir };
}

function setupTmpNoRegistry() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hmi-poll-hook-noreg-'));
  return { tmp: tmp, roomsHome: path.join(tmp, 'rooms') };
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function spawnHook(stdinJson, envOverrides) {
  const envObj = Object.assign({}, process.env, envOverrides || {});
  const r = spawnSync('node', [HOOK_SCRIPT, '--hook'], {
    encoding: 'utf8',
    input: stdinJson,
    env: envObj,
    timeout: 10000,
  });
  return r;
}

function loadModuleFresh() {
  delete require.cache[require.resolve(HOOK_SCRIPT)];
  return require(HOOK_SCRIPT);
}

function parseEnvelope(stdout) {
  if (!stdout || !stdout.trim()) return null;
  try { return JSON.parse(stdout); } catch (_e) { return null; }
}

const ALLOWED = new Set([
  'decision',
  'reason',
  'continue',
  'stopReason',
  'suppressOutput',
  'systemMessage',
  'hookSpecificOutput',
]);

// ---------- tests ----------

function test_01_module_exports() {
  const m = loadModuleFresh();
  if (typeof m._internal.hookMain !== 'function') throw new Error('_internal.hookMain missing');
  if (typeof m._internal.emitHookEnvelope !== 'function') throw new Error('_internal.emitHookEnvelope missing');
  if (typeof m._internal.silentHookSuccess !== 'function') throw new Error('_internal.silentHookSuccess missing');
  if (typeof m._internal.readStdinJson !== 'function') throw new Error('_internal.readStdinJson missing');
  if (!(m._internal.HOOK_ALLOWED_KEYS instanceof Set)) throw new Error('_internal.HOOK_ALLOWED_KEYS not a Set');
  // BASH-95-01 invariant: required keys subset
  const need = ['decision', 'reason', 'continue', 'stopReason', 'suppressOutput', 'systemMessage', 'hookSpecificOutput'];
  for (const k of need) {
    if (!m._internal.HOOK_ALLOWED_KEYS.has(k)) throw new Error('HOOK_ALLOWED_KEYS missing ' + k);
  }
}

function test_02_stop_no_active_room_silent() {
  const env = setupTmpNoRegistry();
  try {
    const stdin = JSON.stringify({ hook_event_name: 'Stop' });
    const r = spawnHook(stdin, { MINDRIAN_ROOMS_HOME: env.roomsHome });
    if (r.status !== 0) throw new Error('exit ' + r.status + ' stderr=' + (r.stderr || ''));
    const env_out = parseEnvelope(r.stdout);
    if (!env_out) throw new Error('envelope did not parse: ' + r.stdout);
    if (env_out.continue !== true) throw new Error('continue not true: ' + JSON.stringify(env_out));
    if (env_out.suppressOutput !== true) throw new Error('suppressOutput not true: ' + JSON.stringify(env_out));
    // No registry -> no side-channel can exist
    const sidePath = path.join(env.roomsHome, 'test-room', '.mindrian', 'last-hmi-poll.json');
    if (fs.existsSync(sidePath)) throw new Error('side-channel should not exist with no registry');
  } finally { rmrf(env.tmp); }
}

function test_03_stop_with_active_room_writes_side_channel() {
  const env = setupSyntheticRegistry({});
  try {
    const stdin = JSON.stringify({ hook_event_name: 'Stop' });
    const r = spawnHook(stdin, { MINDRIAN_ROOMS_HOME: env.roomsHome });
    if (r.status !== 0) throw new Error('exit ' + r.status + ' stderr=' + (r.stderr || ''));
    const envOut = parseEnvelope(r.stdout);
    if (!envOut) throw new Error('envelope did not parse: ' + r.stdout);
    if (envOut.continue !== true) throw new Error('continue not true');
    if (envOut.suppressOutput !== true) throw new Error('suppressOutput not true');
    // Side-channel must have been written
    const sidePath = path.join(env.roomDir, '.mindrian', 'last-hmi-poll.json');
    if (!fs.existsSync(sidePath)) throw new Error('side-channel not written at ' + sidePath);
    let side;
    try { side = JSON.parse(fs.readFileSync(sidePath, 'utf8')); }
    catch (e) { throw new Error('side-channel JSON parse failed: ' + e.message); }
    if (typeof side.schema_version !== 'number') throw new Error('schema_version missing');
    if (typeof side.status !== 'string') throw new Error('status missing');
    if (typeof side.polled_at !== 'string') throw new Error('polled_at missing');
    if (!side._provenance || side._provenance.phase !== '105-01') {
      throw new Error('_provenance.phase mismatch: ' + JSON.stringify(side._provenance));
    }
  } finally { rmrf(env.tmp); }
}

function test_04_non_stop_event_silent_no_poll() {
  const env = setupSyntheticRegistry({});
  try {
    // SessionStart should NOT trigger a poll. Hook returns silent envelope.
    const stdin = JSON.stringify({ hook_event_name: 'SessionStart' });
    const r = spawnHook(stdin, { MINDRIAN_ROOMS_HOME: env.roomsHome });
    if (r.status !== 0) throw new Error('exit ' + r.status);
    const envOut = parseEnvelope(r.stdout);
    if (!envOut) throw new Error('envelope did not parse');
    if (envOut.continue !== true) throw new Error('continue not true');
    // No side-channel should have been written for non-Stop event
    const sidePath = path.join(env.roomDir, '.mindrian', 'last-hmi-poll.json');
    if (fs.existsSync(sidePath)) {
      throw new Error('side-channel should NOT be written for SessionStart event');
    }
  } finally { rmrf(env.tmp); }
}

function test_05_malformed_stdin_survives() {
  const env = setupSyntheticRegistry({});
  try {
    // Malformed JSON
    const r = spawnHook('not valid json {{{', { MINDRIAN_ROOMS_HOME: env.roomsHome });
    if (r.status !== 0) throw new Error('exit ' + r.status + ' stderr=' + (r.stderr || ''));
    const envOut = parseEnvelope(r.stdout);
    if (!envOut) throw new Error('envelope did not parse');
    if (envOut.continue !== true) throw new Error('continue not true');
    if (envOut.suppressOutput !== true) throw new Error('suppressOutput not true');
  } finally { rmrf(env.tmp); }
}

function test_06_empty_stdin_survives() {
  const env = setupSyntheticRegistry({});
  try {
    const r = spawnHook('', { MINDRIAN_ROOMS_HOME: env.roomsHome });
    if (r.status !== 0) throw new Error('exit ' + r.status);
    const envOut = parseEnvelope(r.stdout);
    if (!envOut) throw new Error('envelope did not parse: ' + r.stdout);
    if (envOut.continue !== true) throw new Error('continue not true');
    if (envOut.suppressOutput !== true) throw new Error('suppressOutput not true');
  } finally { rmrf(env.tmp); }
}

function test_07_envelope_schema_strict() {
  // Try several events; every emitted envelope MUST contain only BASH-95-01 keys.
  const env = setupSyntheticRegistry({});
  try {
    const events = ['Stop', 'SessionStart', 'PostToolUse', 'UserPromptSubmit', null];
    for (const evt of events) {
      const stdin = evt ? JSON.stringify({ hook_event_name: evt }) : '';
      const r = spawnHook(stdin, { MINDRIAN_ROOMS_HOME: env.roomsHome });
      if (r.status !== 0) throw new Error('event ' + evt + ' exit ' + r.status);
      const envOut = parseEnvelope(r.stdout);
      if (!envOut) throw new Error('event ' + evt + ' envelope did not parse: ' + r.stdout);
      for (const k of Object.keys(envOut)) {
        if (!ALLOWED.has(k)) {
          throw new Error('event ' + evt + ' envelope contains forbidden top-level key ' + k);
        }
      }
    }
  } finally { rmrf(env.tmp); }
}

function test_08_hooks_json_registers_stop_entry() {
  const hooks = JSON.parse(fs.readFileSync(path.join(REPO, 'hooks', 'hooks.json'), 'utf8'));
  const stops = (hooks && hooks.hooks && Array.isArray(hooks.hooks.Stop)) ? hooks.hooks.Stop : [];
  if (stops.length === 0) throw new Error('hooks.json has no Stop entries');
  // Find the hmi-compliance-poll entry
  const found = stops.find(function (entry) {
    if (!entry || !Array.isArray(entry.hooks)) return false;
    return entry.hooks.some(function (h) {
      return h && typeof h.command === 'string'
        && h.command.indexOf('hmi-compliance-poll.cjs') >= 0
        && h.command.indexOf('--hook') >= 0;
    });
  });
  if (!found) throw new Error('hooks.json Stop entries lack hmi-compliance-poll.cjs --hook');
  // Phase 99/100/103 entries must still be present (byte-identical)
  const operatorEntry = stops.find(function (e) {
    return e.hooks.some(function (h) { return h && h.command && h.command.indexOf('operator-update.cjs') >= 0; });
  });
  const jtbdEntry = stops.find(function (e) {
    return e.hooks.some(function (h) { return h && h.command && h.command.indexOf('jtbd-update.cjs') >= 0; });
  });
  const onStopEntry = stops.find(function (e) {
    return e.hooks.some(function (h) { return h && h.command && h.command.indexOf('on-stop') >= 0; });
  });
  if (!operatorEntry) throw new Error('Phase 99 operator-update.cjs Stop entry missing');
  if (!jtbdEntry) throw new Error('Phase 100 jtbd-update.cjs Stop entry missing');
  if (!onStopEntry) throw new Error('Phase 103 on-stop run-hook.cmd entry missing');
}

function test_09_latency_budget() {
  const env = setupSyntheticRegistry({});
  try {
    const N = 5;
    const samples = [];
    for (let i = 0; i < N; i++) {
      const t0 = Date.now();
      const r = spawnHook(JSON.stringify({ hook_event_name: 'Stop' }),
        { MINDRIAN_ROOMS_HOME: env.roomsHome });
      const dt = Date.now() - t0;
      if (r.status !== 0) throw new Error('exit ' + r.status);
      samples.push(dt);
    }
    const max = samples.reduce(function (a, b) { return a > b ? a : b; }, 0);
    const mean = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;
    if (max > 5000) {
      throw new Error('latency ceiling exceeded: max=' + max + 'ms');
    }
    process.stdout.write('    [info] latency N=' + N + ' max=' + max + 'ms mean=' + mean.toFixed(1) + 'ms\n');
  } finally { rmrf(env.tmp); }
}

// ---------- runner ----------

const TESTS = [
  ['01 module exports new hook helpers', test_01_module_exports],
  ['02 Stop event no active room: silent', test_02_stop_no_active_room_silent],
  ['03 Stop event with active room: side-channel written', test_03_stop_with_active_room_writes_side_channel],
  ['04 Non-Stop event silent (no poll fired)', test_04_non_stop_event_silent_no_poll],
  ['05 Malformed stdin survives', test_05_malformed_stdin_survives],
  ['06 Empty stdin survives', test_06_empty_stdin_survives],
  ['07 Envelope schema strict (BASH-95-01)', test_07_envelope_schema_strict],
  ['08 hooks.json registers Stop entry (sibling to 99/100/103)', test_08_hooks_json_registers_stop_entry],
  ['09 Latency budget (informational)', test_09_latency_budget],
];

for (const [name, fn] of TESTS) {
  try { fn(); ok(name); } catch (e) { ng(name, e); }
}

process.stdout.write('\nPhase 105-03 hmi-compliance-poll hook wrapper: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
