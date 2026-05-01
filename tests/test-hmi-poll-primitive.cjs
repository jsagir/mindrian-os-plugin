#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 105-01 -- behavioral test suite for scripts/hmi-compliance-poll.cjs.
 *
 * 12 assertion classes covering: module shape, no-active-room guard, sealed
 * room, operator-aware shape selector (BUILD_ROOM mismatch + JUST_TALK
 * accepts), JTBD priority weighting (match/non-match/null), side-channel
 * atomic write + envelope fields, latency budget (informational), doctor-
 * error graceful path, Canon Part 8 source audit.
 *
 * Replaces the Phase 105 Wave-0 stub registered in run-feynman-tests.cjs
 * by Plan 105-00.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const POLL_MODULE = path.join(REPO_ROOT, 'scripts', 'hmi-compliance-poll.cjs');
const TAXONOMY = require(path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json'));

let pass = 0, fail = 0;
const FAIL_LOG = [];

function ok(name) { pass++; console.log('PASS ' + name); }
function ng(name, e) {
  fail++;
  const msg = (e && e.message) ? e.message : String(e);
  FAIL_LOG.push(name + ': ' + msg);
  console.error('FAIL ' + name + ': ' + msg);
}

function setupSyntheticRegistry(input) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hmi-poll-'));
  const roomsHome = path.join(tmp, 'rooms');
  const roomDir = path.join(roomsHome, 'test-room');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nfixture: phase-105-01\n---\n');
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify({
      active_room: 'test-room',
      rooms: [{
        slug: 'test-room',
        venture_name: 'Test Room',
        abs_path: roomDir,
        sealed: input && input.sealed === true,
      }],
    }, null, 2)
  );
  if (input && input.operator) {
    fs.writeFileSync(
      path.join(roomDir, '.mindrian', 'conversation-operator.json'),
      JSON.stringify({
        schema_version: '1.0.0',
        current: input.operator,
        previous: null,
        entered_at: new Date().toISOString(),
        context: {
          active_room: 'test-room',
          active_section: null,
          methodology_in_flight: null,
          decision_gate_pending: null,
        },
        history: [],
      }, null, 2)
    );
  }
  if (input && input.jtbd) {
    fs.writeFileSync(
      path.join(roomDir, '.mindrian', 'jtbd-state.json'),
      JSON.stringify({
        version: 1,
        current: {
          jtbd: input.jtbd,
          confidence: 0.8,
          entered_at: new Date().toISOString(),
          evidence: ['fixture'],
          expires_at: null,
        },
        history: [],
      }, null, 2)
    );
  }
  return { tmp: tmp, roomsHome: roomsHome, roomDir: roomDir };
}

function seedScratchDirs() {
  const cdir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmi-poll-cmd-'));
  const sdir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmi-poll-scr-'));
  return { cdir: cdir, sdir: sdir };
}

function writeCommand(cdir, name, bodyShape) {
  const fm = bodyShape
    ? '---\nbody_shape: ' + bodyShape + '\n---\n# ' + name + '\n'
    : '---\nname: ' + name + '\n---\n# ' + name + '\n';
  fs.writeFileSync(path.join(cdir, name + '.md'), fm);
}

function pickTaxonomyMatchPair() {
  // Find a taxonomy entry with at least one methodology_hook; pick a
  // matchable basename. Returns { jtbdId, basename } or null.
  if (!TAXONOMY || !Array.isArray(TAXONOMY.entries)) return null;
  for (const e of TAXONOMY.entries) {
    if (!e || !Array.isArray(e.methodology_hooks)) continue;
    for (const hook of e.methodology_hooks) {
      if (typeof hook !== 'string' || !hook) continue;
      const m = hook.match(/[a-z][a-z0-9-]+/i);
      if (m) return { jtbdId: e.id, basename: m[0].toLowerCase() };
    }
  }
  return null;
}

function withEnv(env, fn) {
  const before = {};
  for (const k of Object.keys(env)) {
    before[k] = process.env[k];
    process.env[k] = env[k];
  }
  try { return fn(); } finally {
    for (const k of Object.keys(env)) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
}

function loadModuleFresh() {
  delete require.cache[require.resolve(POLL_MODULE)];
  return require(POLL_MODULE);
}

function safeRm(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// ----- Tests -----

function test_01_module_shape() {
  const m = loadModuleFresh();
  if (typeof m.pollOnce !== 'function') throw new Error('pollOnce missing');
  const need = [
    'resolveActiveRoom', 'expectedShapeFamily', 'extractBodyShapeLetter',
    'weightViolation', 'computePriorities', 'computeOperatorShapeMismatches',
    'atomicWriteSideChannel',
  ];
  for (const k of need) {
    if (typeof m._internal[k] !== 'function') throw new Error('_internal.' + k + ' missing');
  }
}

function test_02_no_active_room_no_op() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hmi-poll-noroom-'));
  try {
    withEnv({ MINDRIAN_ROOMS_HOME: tmp }, function () {
      const m = loadModuleFresh();
      const r = m.pollOnce();
      if (r.status !== 'no-active-room') {
        throw new Error('expected no-active-room got ' + JSON.stringify(r));
      }
    });
  } finally { safeRm(tmp); }
}

function test_03_sealed_room_no_op() {
  const env = setupSyntheticRegistry({ sealed: true });
  try {
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      const r = m.pollOnce();
      if (r.status !== 'no-active-room') {
        throw new Error('sealed room must short-circuit; got ' + JSON.stringify(r));
      }
    });
  } finally { safeRm(env.tmp); }
}

function test_04_operator_shape_selector_build_room_mismatch() {
  const env = setupSyntheticRegistry({ operator: 'BUILD_ROOM' });
  const scratch = seedScratchDirs();
  try {
    writeCommand(scratch.cdir, 'foo', 'B (Tree)');         // mismatch: BUILD_ROOM wants E
    writeCommand(scratch.cdir, 'bar', 'E (Action Report)'); // match
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      const r = m.pollOnce({ scanCommandsDir: scratch.cdir, scanScriptsDir: scratch.sdir });
      if (r.status !== 'ok' && r.status !== 'doctor-error') {
        throw new Error('unexpected status ' + r.status);
      }
      if (r.status === 'ok') {
        const files = (r.operator_shape_mismatches || []).map(function (x) { return x.file; });
        const fooHit = files.some(function (f) { return /foo\.md$/.test(f); });
        const barHit = files.some(function (f) { return /bar\.md$/.test(f); });
        if (!fooHit) {
          throw new Error('expected foo.md in operator_shape_mismatches; got ' + JSON.stringify(files));
        }
        if (barHit) {
          throw new Error('bar.md should NOT be a mismatch (declared E, BUILD_ROOM accepts E); got ' + JSON.stringify(files));
        }
      }
    });
  } finally {
    safeRm(env.tmp);
    safeRm(scratch.cdir);
    safeRm(scratch.sdir);
  }
}

function test_05_operator_shape_selector_just_talk_accepts_b() {
  const env = setupSyntheticRegistry({ operator: 'JUST_TALK' });
  const scratch = seedScratchDirs();
  try {
    writeCommand(scratch.cdir, 'foo', 'B (Tree)');
    writeCommand(scratch.cdir, 'bar', 'E (Action Report)');
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      const r = m.pollOnce({ scanCommandsDir: scratch.cdir, scanScriptsDir: scratch.sdir });
      if (r.status === 'ok') {
        // JUST_TALK accepts A, B. E mismatches JUST_TALK -> bar.md becomes a mismatch.
        // foo.md (B) matches -> not a mismatch. We assert foo NOT present (B is allowed).
        const files = (r.operator_shape_mismatches || []).map(function (x) { return x.file; });
        const fooHit = files.some(function (f) { return /foo\.md$/.test(f); });
        if (fooHit) {
          throw new Error('JUST_TALK accepts B; foo.md should NOT be a mismatch; got ' + JSON.stringify(files));
        }
      }
    });
  } finally {
    safeRm(env.tmp);
    safeRm(scratch.cdir);
    safeRm(scratch.sdir);
  }
}

function test_06_jtbd_match_boosts_weight() {
  const pair = pickTaxonomyMatchPair();
  if (!pair) {
    console.error('  skip: taxonomy has no methodology_hooks');
    return;
  }
  const env = setupSyntheticRegistry({ jtbd: pair.jtbdId });
  const scratch = seedScratchDirs();
  try {
    // Create a command file whose BASENAME appears as a substring in
    // pair.jtbdId's methodology_hooks. Null body_shape -> doctor flags
    // missing-body-shape.
    writeCommand(scratch.cdir, pair.basename, null);
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      const r = m.pollOnce({ scanCommandsDir: scratch.cdir, scanScriptsDir: scratch.sdir });
      if (r.status === 'ok') {
        const top = r.priorities && r.priorities[0];
        if (!top) throw new Error('expected at least one priority');
        if (top.weight !== 1.0) {
          throw new Error('expected weight 1.0 for matched jtbd (basename=' + pair.basename + ' jtbd=' + pair.jtbdId + '); got ' + top.weight + ' file=' + top.file);
        }
        if (top.matched_jtbd !== pair.jtbdId) {
          throw new Error('expected matched_jtbd ' + pair.jtbdId + '; got ' + top.matched_jtbd);
        }
      }
    });
  } finally {
    safeRm(env.tmp);
    safeRm(scratch.cdir);
    safeRm(scratch.sdir);
  }
}

function test_07_jtbd_non_match_keeps_base_weight() {
  const pair = pickTaxonomyMatchPair();
  if (!pair) {
    console.error('  skip: taxonomy has no methodology_hooks');
    return;
  }
  const env = setupSyntheticRegistry({ jtbd: pair.jtbdId });
  const scratch = seedScratchDirs();
  try {
    // 'zzznomatch-...' is unlikely to be a substring of any methodology_hook.
    writeCommand(scratch.cdir, 'zzznomatch-' + Date.now(), null);
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      const r = m.pollOnce({ scanCommandsDir: scratch.cdir, scanScriptsDir: scratch.sdir });
      if (r.status === 'ok' && r.priorities.length > 0) {
        // Find the entry referencing our zzznomatch file.
        const ours = r.priorities.find(function (p) {
          return typeof p.file === 'string' && p.file.indexOf('zzznomatch-') >= 0;
        });
        if (!ours) {
          throw new Error('expected zzznomatch entry in priorities; got ' + JSON.stringify(r.priorities.map(function (p) { return p.file; })));
        }
        if (ours.weight !== 0.3) {
          throw new Error('expected weight 0.3 for non-match; got ' + ours.weight + ' file=' + ours.file);
        }
        if (ours.matched_jtbd !== null) {
          throw new Error('expected matched_jtbd null; got ' + ours.matched_jtbd);
        }
      }
    });
  } finally {
    safeRm(env.tmp);
    safeRm(scratch.cdir);
    safeRm(scratch.sdir);
  }
}

function test_08_jtbd_null_uniform_weight() {
  const env = setupSyntheticRegistry({}); // no jtbd state file written
  const scratch = seedScratchDirs();
  try {
    writeCommand(scratch.cdir, 'whatever', null);
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      const r = m.pollOnce({ scanCommandsDir: scratch.cdir, scanScriptsDir: scratch.sdir });
      if (r.status === 'ok' && r.priorities.length > 0) {
        for (const p of r.priorities) {
          if (p.weight !== 0.5) {
            throw new Error('expected weight 0.5 (jtbd null); got ' + p.weight + ' file=' + p.file);
          }
          if (p.matched_jtbd !== null) {
            throw new Error('expected matched_jtbd null; got ' + p.matched_jtbd);
          }
        }
      }
    });
  } finally {
    safeRm(env.tmp);
    safeRm(scratch.cdir);
    safeRm(scratch.sdir);
  }
}

function test_09_side_channel_atomic_write() {
  const env = setupSyntheticRegistry({ operator: 'BUILD_ROOM' });
  const scratch = seedScratchDirs();
  try {
    writeCommand(scratch.cdir, 'foo', 'E (Action Report)');
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      m.pollOnce({ scanCommandsDir: scratch.cdir, scanScriptsDir: scratch.sdir });
    });
    const sc = path.join(env.roomDir, '.mindrian', 'last-hmi-poll.json');
    if (!fs.existsSync(sc)) throw new Error('side-channel not written at ' + sc);
    const parsed = JSON.parse(fs.readFileSync(sc, 'utf8'));
    const required = ['schema_version', 'polled_at', 'operator', 'tier', 'mode', 'elapsed_ms', '_provenance'];
    for (const k of required) {
      if (!(k in parsed)) throw new Error('missing field ' + k);
    }
    if (parsed._provenance.phase !== '105-01') {
      throw new Error('_provenance.phase != 105-01; got ' + parsed._provenance.phase);
    }
    // No orphan tmp files left behind.
    const orphans = fs.readdirSync(path.join(env.roomDir, '.mindrian'))
      .filter(function (f) { return f.indexOf('.last-hmi-poll.json.') === 0; });
    if (orphans.length > 0) {
      throw new Error('orphan tmp files: ' + JSON.stringify(orphans));
    }
  } finally {
    safeRm(env.tmp);
    safeRm(scratch.cdir);
    safeRm(scratch.sdir);
  }
}

function test_10_latency_informational() {
  const env = setupSyntheticRegistry({ operator: 'BUILD_ROOM' });
  const scratch = seedScratchDirs();
  try {
    writeCommand(scratch.cdir, 'foo', 'E (Action Report)');
    const samples = [];
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      for (let i = 0; i < 5; i++) {
        const t0 = Date.now();
        m.pollOnce({ scanCommandsDir: scratch.cdir, scanScriptsDir: scratch.sdir });
        samples.push(Date.now() - t0);
      }
    });
    const mean = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;
    if (mean > 1500) {
      throw new Error('latency >> ceiling: mean ' + mean.toFixed(0) + 'ms (samples: ' + samples.join(',') + ')');
    }
    if (mean > 250) {
      console.error('  warn: latency mean ' + mean.toFixed(0) + 'ms exceeds 250ms target (informational)');
    }
  } finally {
    safeRm(env.tmp);
    safeRm(scratch.cdir);
    safeRm(scratch.sdir);
  }
}

function test_11_doctor_error_graceful() {
  const env = setupSyntheticRegistry({ operator: 'BUILD_ROOM' });
  const scratch = seedScratchDirs();
  try {
    writeCommand(scratch.cdir, 'foo', 'E (Action Report)');
    let result;
    withEnv({ MINDRIAN_ROOMS_HOME: env.roomsHome }, function () {
      const m = loadModuleFresh();
      // Force timeout to 1ms; doctor.cjs CANNOT spawn + finish in 1ms.
      result = m.pollOnce({
        scanCommandsDir: scratch.cdir,
        scanScriptsDir: scratch.sdir,
        doctorTimeout: 1,
      });
    });
    if (result.status !== 'doctor-error') {
      throw new Error('expected doctor-error; got ' + result.status);
    }
    if (typeof result.error !== 'string' || result.error.length === 0) {
      throw new Error('expected non-empty error string');
    }
    // Side-channel still written.
    const sc = path.join(env.roomDir, '.mindrian', 'last-hmi-poll.json');
    if (!fs.existsSync(sc)) {
      throw new Error('side-channel must be written even on doctor-error');
    }
    const parsed = JSON.parse(fs.readFileSync(sc, 'utf8'));
    if (parsed.status !== 'doctor-error') {
      throw new Error('side-channel status mismatch: ' + parsed.status);
    }
  } finally {
    safeRm(env.tmp);
    safeRm(scratch.cdir);
    safeRm(scratch.sdir);
  }
}

function test_12_canon_part_8_source_audit() {
  const src = fs.readFileSync(POLL_MODULE, 'utf8');
  const forbidden = [
    'brain.mindrian.ai', 'brainQuery', 'pinecone', 'embedQuery',
    'brain-client.cjs', 'brain-mcp',
  ];
  for (const tok of forbidden) {
    if (src.indexOf(tok) >= 0) {
      throw new Error('forbidden token in source: ' + tok);
    }
  }
  // Zero non-relative non-builtin require() calls.
  const requireRe = /require\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = requireRe.exec(src)) !== null) {
    const dep = m[1];
    if (dep.indexOf('node:') === 0) continue;
    if (dep.indexOf('.') === 0) continue;
    if (dep.indexOf('/') === 0) continue; // absolute paths are runtime-resolved, not literal package names
    throw new Error('non-relative non-builtin require: ' + dep);
  }
}

// ----- Runner -----

const tests = [
  ['01 module shape', test_01_module_shape],
  ['02 no active room no-op', test_02_no_active_room_no_op],
  ['03 sealed room no-op', test_03_sealed_room_no_op],
  ['04 op shape selector BUILD_ROOM mismatch', test_04_operator_shape_selector_build_room_mismatch],
  ['05 op shape selector JUST_TALK accepts B', test_05_operator_shape_selector_just_talk_accepts_b],
  ['06 jtbd match boosts weight', test_06_jtbd_match_boosts_weight],
  ['07 jtbd non-match keeps base', test_07_jtbd_non_match_keeps_base_weight],
  ['08 jtbd null uniform weight', test_08_jtbd_null_uniform_weight],
  ['09 side-channel atomic write', test_09_side_channel_atomic_write],
  ['10 latency (informational)', test_10_latency_informational],
  ['11 doctor-error graceful', test_11_doctor_error_graceful],
  ['12 Canon Part 8 source audit', test_12_canon_part_8_source_audit],
];

for (const [name, fn] of tests) {
  try { fn(); ok(name); } catch (e) { ng(name, e); }
}

console.log('\nPhase 105-01 hmi-compliance-poll primitive: ' + pass + '/' + tests.length + ' GREEN');
if (fail > 0) {
  console.error('\nFAILURES:\n' + FAIL_LOG.map(function (l) { return '  - ' + l; }).join('\n'));
  process.exit(1);
}
process.exit(0);
