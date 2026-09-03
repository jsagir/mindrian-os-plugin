#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-05 -- /mos:operator command-line entry point test suite.
 *
 * Covers: OPERATOR-99-05-A through OPERATOR-99-05-F.
 *
 * 20 tests across 4 subcommands + UI Ruling System self-compliance + Canon
 * Part 8 audit + frame budget + frontmatter scan. Each test runs the
 * scripts/operator-command.cjs entry point in a child process via spawnSync
 * with MINDRIAN_ROOMS_HOME pointing at a scratch directory so no test can
 * leak into the user's real active room.
 *
 * Test 14 dog-fooding self-compliance: the test itself uses Unicode-escape
 * regexes for the forbidden character set so the test file's source contains
 * zero literal forbidden chars. Same dog-food invariant as
 * scripts/doctor.cjs Class F detector regex.
 *
 * IIFE harness pattern from tests/test-doctor-class-f.cjs.
 * Registered in lib/memory/run-feynman-tests.cjs.
 *
 * Dependency: this test loads lib/conversation/operator.cjs (99-01 deliverable).
 * When 99-01 has not yet landed, the integration tests will fail. Plan 99-05
 * is in wave-2 and merges after 99-01; these tests pass in the merged tree.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'operator-command.cjs');
const COMMAND_MD = path.join(REPO, 'commands', 'operator.md');
const OPERATOR_MODULE = path.join(REPO, 'lib', 'conversation', 'operator.cjs');

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) {
  passed += 1;
  process.stdout.write('[pass] ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  failures.push({ name, error: err && err.message ? err.message : String(err) });
  process.stdout.write('[FAIL] ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Sandbox helpers ----------

function makeScratchDir(suffix) {
  const base = path.join(os.tmpdir(), 'mos-99-05-' + Date.now().toString(36) + '-' + suffix);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// Build a synthetic registry under <scratch>/.rooms/registry.json + a room dir
// at <scratch>/test-room with the operator state pre-seeded. The room dir
// also gets a .room-root sentinel so other helpers don't false-positive.
function setupSyntheticRegistry(scratch, opts) {
  const o = opts || {};
  const slug = o.slug || 'test-room';
  const roomDir = path.join(scratch, slug);
  const mindrianDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(mindrianDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# ' + slug + '\n');

  if (o.state) {
    const state = Object.assign({
      schema_version: '1.0.0',
      current: 'JUST_TALK',
      previous: null,
      entered_at: new Date().toISOString(),
      context: {
        active_room: slug,
        active_section: null,
        methodology_in_flight: null,
        decision_gate_pending: null,
      },
      history: [],
    }, o.state);
    fs.writeFileSync(
      path.join(mindrianDir, 'conversation-operator.json'),
      JSON.stringify(state, null, 2)
    );
  }

  const roomsDir = path.join(scratch, '.rooms');
  fs.mkdirSync(roomsDir, { recursive: true });
  const registry = {
    active_room: slug,
    rooms: [
      { slug: slug, name: slug, abs_path: roomDir, status: 'active' },
    ],
  };
  fs.writeFileSync(
    path.join(roomsDir, 'registry.json'),
    JSON.stringify(registry, null, 2)
  );

  return { scratch, slug, roomDir, mindrianDir };
}

function readState(roomDir) {
  const p = path.join(roomDir, '.mindrian', 'conversation-operator.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (_e) { return null; }
}

function writeState(roomDir, state) {
  const dir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'conversation-operator.json'),
    JSON.stringify(state, null, 2)
  );
}

function runCmd(args, env) {
  const opts = {
    encoding: 'utf8',
    timeout: 5000,
    env: Object.assign({}, process.env, env || {}),
  };
  assert.equal(typeof opts.env.MINDRIAN_ROOMS_HOME, 'string',
    'every test must set MINDRIAN_ROOMS_HOME to scratch dir to avoid leaking into real room');
  const res = spawnSync('node', [SCRIPT].concat(args), opts);
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

// ---------- Test 1 ----------

(function test_01_default_show_subcommand() {
  const label = 'Test 1: default show subcommand renders Shape E';
  const scratch = makeScratchDir('t01');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: {
        current: 'BUILD_ROOM',
        previous: 'EXPLORE_CAPTURE',
        history: [
          { op: 'JUST_TALK', from: null, to: 'JUST_TALK', trigger: 'session_start', ts: '2026-05-01T10:30:00Z' },
          { op: 'EXPLORE_CAPTURE', from: 'JUST_TALK', to: 'EXPLORE_CAPTURE', trigger: 'user_message', ts: '2026-05-01T10:35:00Z' },
          { op: 'BUILD_ROOM', from: 'EXPLORE_CAPTURE', to: 'BUILD_ROOM', trigger: 'mos_command', ts: '2026-05-01T10:42:00Z' },
        ],
      },
    });
    const res = runCmd([], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, 'default show: exit 0; got ' + res.status + ' stderr=' + res.stderr);
    assert.ok(res.stdout.indexOf('-- ' + reg.slug + ' -- operator -- BUILD_ROOM --') !== -1,
      'default show: Zone 1 header missing in stdout');
    assert.ok(res.stdout.indexOf('Current') !== -1, 'default show: must contain Current label');
    // Filled square U+25A0 must be in output.
    assert.ok(res.stdout.indexOf('■') !== -1, 'default show: must contain filled-square glyph (U+25A0)');
    assert.ok(res.stdout.indexOf('/mos:operator history') !== -1, 'default show: Zone 4 must include history footer');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 2 ----------

(function test_02_history_subcommand_full() {
  const label = 'Test 2: history subcommand renders full history';
  const scratch = makeScratchDir('t02');
  try {
    setupSyntheticRegistry(scratch, {
      state: {
        current: 'BUILD_ROOM',
        previous: 'EXPLORE_CAPTURE',
        history: [
          { op: 'JUST_TALK', from: null, to: 'JUST_TALK', trigger: 'session_start', ts: '2026-05-01T10:30:00Z' },
          { op: 'EXPLORE_CAPTURE', from: 'JUST_TALK', to: 'EXPLORE_CAPTURE', trigger: 'user_message', ts: '2026-05-01T10:35:00Z' },
          { op: 'BUILD_ROOM', from: 'EXPLORE_CAPTURE', to: 'BUILD_ROOM', trigger: 'mos_command', ts: '2026-05-01T10:42:00Z' },
        ],
      },
    });
    const res = runCmd(['history'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, 'history: exit 0; got ' + res.status + ' stderr=' + res.stderr);
    assert.ok(res.stdout.indexOf('Full history') !== -1, 'history: must contain Full history label');
    assert.ok(res.stdout.indexOf('from=') !== -1, 'history: full mode must include from= column');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 3 ----------

(function test_03_set_no_op_renders_picker() {
  const label = 'Test 3: set without opArg renders Shape F.1 picker';
  const scratch = makeScratchDir('t03');
  try {
    setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: 'EXPLORE_CAPTURE', history: [] },
    });
    const res = runCmd(['set'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, 'set picker: exit 0; got ' + res.status + ' stderr=' + res.stderr);
    assert.ok(res.stdout.indexOf('[F.1 Next Move]') !== -1, 'set picker: F.1 marker block missing');
    for (const op of ['JUST_TALK', 'EXPLORE_CAPTURE', 'BUILD_ROOM', 'METHODOLOGY', 'DECISION_GATE']) {
      assert.ok(res.stdout.indexOf(op) !== -1, 'set picker: missing operator option ' + op);
    }
    assert.ok(res.stdout.indexOf('Free-Text') !== -1, 'set picker: Free-Text option missing');
    assert.ok(res.stdout.indexOf('BUILD_ROOM') !== -1 && res.stdout.indexOf('(current') !== -1,
      'set picker: current operator must be marked as no-op');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 4 ----------

(function test_04_set_op_performs_transition() {
  const label = 'Test 4: set <op> performs transition + re-renders Shape E';
  const scratch = makeScratchDir('t04');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: { current: 'EXPLORE_CAPTURE', previous: 'JUST_TALK', history: [] },
    });
    const res = runCmd(['set', 'BUILD_ROOM'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, 'set BUILD_ROOM: exit 0; got ' + res.status + ' stderr=' + res.stderr);
    assert.ok(res.stdout.indexOf('Transitioned EXPLORE_CAPTURE') !== -1,
      'set: success banner missing previous operator name');
    assert.ok(res.stdout.indexOf('BUILD_ROOM') !== -1, 'set: success banner missing target operator');
    const newState = readState(reg.roomDir);
    assert.ok(newState !== null, 'set: state file must exist after transition');
    assert.equal(newState.current, 'BUILD_ROOM', 'set: state.current must be BUILD_ROOM');
    assert.equal(newState.previous, 'EXPLORE_CAPTURE', 'set: state.previous must be EXPLORE_CAPTURE');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 5 ----------

(function test_05_set_invalid_op_rejects() {
  const label = 'Test 5: set <invalid_op> rejects with non-zero exit';
  const scratch = makeScratchDir('t05');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: 'EXPLORE_CAPTURE', history: [] },
    });
    const before = readState(reg.roomDir);
    const res = runCmd(['set', 'NOT_REAL'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 1, 'set NOT_REAL: exit 1; got ' + res.status);
    assert.ok(res.stderr.toLowerCase().indexOf('unknown operator') !== -1,
      'set NOT_REAL: stderr must mention unknown operator');
    const after = readState(reg.roomDir);
    assert.deepEqual(after, before, 'set NOT_REAL: state file must be unchanged');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 6 ----------

(function test_06_set_current_op_is_noop() {
  const label = 'Test 6: set <current_op> is a no-op';
  const scratch = makeScratchDir('t06');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: {
        current: 'BUILD_ROOM',
        previous: 'EXPLORE_CAPTURE',
        history: [
          { op: 'BUILD_ROOM', from: 'EXPLORE_CAPTURE', to: 'BUILD_ROOM', trigger: 'mos_command', ts: '2026-05-01T10:42:00Z' },
        ],
      },
    });
    const before = readState(reg.roomDir);
    const res = runCmd(['set', 'BUILD_ROOM'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, 'set BUILD_ROOM (current): exit 0 (warn, not error); got ' + res.status);
    const after = readState(reg.roomDir);
    assert.equal(after.current, before.current, 'no-op: current unchanged');
    assert.equal(after.history.length, before.history.length, 'no-op: no new history entry');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 7 ----------

(function test_07_set_invalid_transition_rejected() {
  const label = 'Test 7: set <op> rejected by validate() prints error + non-zero exit';
  const scratch = makeScratchDir('t07');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: null, history: [] },
    });
    const before = readState(reg.roomDir);
    // BUILD_ROOM -> EXPLORE_CAPTURE is not in any rule (rule 2 only permits
    // JUST_TALK as the source). Wave-1 integration expanded the schema to 9
    // rules incl. 2 ANY-source overrides (ANY -> BUILD_ROOM, ANY -> METHODOLOGY)
    // so most "set" targets are reachable from JUST_TALK; this is the surviving
    // invalid-transition case under manual_set.
    const res = runCmd(['set', 'EXPLORE_CAPTURE'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 1, 'invalid transition: exit 1; got ' + res.status);
    assert.ok(
      res.stderr.toLowerCase().indexOf('rejected') !== -1
        || res.stderr.toLowerCase().indexOf('failed') !== -1
        || res.stderr.toLowerCase().indexOf('invalid') !== -1,
      'invalid transition: stderr must mention rejection / failure'
    );
    const after = readState(reg.roomDir);
    assert.deepEqual(after, before, 'invalid transition: state unchanged');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 8 ----------

(function test_08_reset_no_confirm_renders_f4() {
  const label = 'Test 8: reset (no --confirm) renders Shape F.4';
  const scratch = makeScratchDir('t08');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: 'EXPLORE_CAPTURE', history: [] },
    });
    const before = readState(reg.roomDir);
    const res = runCmd(['reset'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, 'reset (no confirm): exit 0; got ' + res.status);
    assert.ok(res.stdout.indexOf('[F.4 Confirm Reset]') !== -1, 'reset: F.4 marker missing');
    assert.ok(res.stdout.indexOf('Confirm reset to JUST_TALK') !== -1, 'reset: confirm prompt missing');
    const after = readState(reg.roomDir);
    assert.deepEqual(after, before, 'reset (no confirm): state must be unchanged');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 9 ----------

(function test_09_reset_confirm_transitions_to_just_talk() {
  const label = 'Test 9: reset --confirm transitions to JUST_TALK';
  const scratch = makeScratchDir('t09');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: {
        current: 'BUILD_ROOM',
        previous: 'EXPLORE_CAPTURE',
        history: [],
        context: {
          active_room: 'test-room',
          active_section: 'research',
          methodology_in_flight: null,
          decision_gate_pending: null,
        },
      },
    });
    const res = runCmd(['reset', '--confirm'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, 'reset --confirm: exit 0; got ' + res.status + ' stderr=' + res.stderr);
    assert.ok(res.stdout.indexOf('Transitioned BUILD_ROOM') !== -1, 'reset --confirm: success banner missing');
    assert.ok(res.stdout.indexOf('JUST_TALK') !== -1, 'reset --confirm: target JUST_TALK missing in output');
    const after = readState(reg.roomDir);
    assert.equal(after.current, 'JUST_TALK', 'reset --confirm: state.current must be JUST_TALK');
    assert.equal(after.previous, 'BUILD_ROOM', 'reset --confirm: state.previous must be BUILD_ROOM');
    assert.equal(after.context.active_section, null, 'reset --confirm: active_section cleared');
    assert.equal(after.context.methodology_in_flight, null, 'reset --confirm: methodology_in_flight cleared');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 10 ----------

(function test_10_json_show_returns_state() {
  const label = 'Test 10: --json show returns parseable JSON with state';
  const scratch = makeScratchDir('t10');
  try {
    setupSyntheticRegistry(scratch, {
      state: { current: 'METHODOLOGY', previous: 'BUILD_ROOM', history: [] },
    });
    const res = runCmd(['--json'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, '--json show: exit 0; got ' + res.status);
    let j;
    try { j = JSON.parse(res.stdout); } catch (e) {
      throw new Error('--json show: stdout not valid JSON: ' + e.message + '\nstdout=' + res.stdout);
    }
    assert.equal(j.subcommand, 'show', '--json show: subcommand field');
    assert.ok(j.state, '--json show: state field missing');
    assert.equal(j.state.current, 'METHODOLOGY', '--json show: state.current');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 11 ----------

(function test_11_json_set_returns_transition_result() {
  const label = 'Test 11: --json set <op> returns transition result';
  const scratch = makeScratchDir('t11');
  try {
    setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: 'EXPLORE_CAPTURE', history: [] },
    });
    const res = runCmd(['--json', 'set', 'JUST_TALK'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, '--json set: exit 0; got ' + res.status + ' stderr=' + res.stderr);
    let j;
    try { j = JSON.parse(res.stdout); } catch (e) {
      throw new Error('--json set: stdout not valid JSON: ' + e.message + '\nstdout=' + res.stdout);
    }
    assert.ok(j.transition, '--json set: transition field missing');
    assert.equal(j.transition.success, true, '--json set: transition.success must be true');
    assert.equal(j.state.current, 'JUST_TALK', '--json set: state.current must be JUST_TALK');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 12 ----------

(function test_12_tier_0_no_registry() {
  const label = 'Test 12: Tier 0 fallback (no registry)';
  const scratch = makeScratchDir('t12');
  try {
    const res = runCmd([], { MINDRIAN_ROOMS_HOME: path.join(scratch, 'does-not-exist') });
    assert.equal(res.status, 0, 'tier 0: exit 0 (graceful); got ' + res.status);
    assert.ok(res.stdout.indexOf('no-room') !== -1, 'tier 0: stdout must contain no-room marker');
    assert.ok(res.stdout.indexOf('/mos:rooms') !== -1, 'tier 0: Zone 4 must suggest /mos:rooms');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 13 ----------

(function test_13_tier_0_json() {
  const label = 'Test 13: Tier 0 --json fallback';
  const scratch = makeScratchDir('t13');
  try {
    const res = runCmd(['--json'], { MINDRIAN_ROOMS_HOME: path.join(scratch, 'does-not-exist') });
    assert.equal(res.status, 0, 'tier 0 --json: exit 0; got ' + res.status);
    let j;
    try { j = JSON.parse(res.stdout); } catch (e) {
      throw new Error('tier 0 --json: stdout not valid JSON: ' + e.message);
    }
    assert.equal(j.error, 'no_active_room', 'tier 0 --json: error must be no_active_room');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 14: UI Ruling System self-compliance scan (DOG-FOOD) ----------

// FORBIDDEN_BOX matches U+250C..U+2570 box-drawing range that the Phase 95.1
// class F detector flags. We construct the regex via Unicode escape sequences
// so this test source contains zero literal forbidden chars.
const FORBIDDEN_BOX = new RegExp('[\u256D\u256E\u256F\u2570\u250C\u2510\u2514\u2518\u2502\u2500\u2501]', 'g');
// FORBIDDEN_GLYPHS matches the failed-x family that is not in the 12-glyph
// approved vocabulary.
const FORBIDDEN_GLYPHS = new RegExp('[\u2715\u2717\u2718]|\u274C|\u2753|\u2755|\u2757', 'g');
// VS16_WARNING: warning sign forced into emoji presentation via U+FE0F.
const VS16_WARNING = new RegExp('\u26A0\uFE0F', 'g');

(function test_14_ui_self_compliance_scan() {
  const label = 'Test 14: UI Ruling System self-compliance scan (12-glyph dog-food)';
  try {
    const cmdSrc = fs.readFileSync(SCRIPT, 'utf8');
    const cmdDoc = fs.readFileSync(COMMAND_MD, 'utf8');
    // SCRIPT must be clean (it is the renderer; class F detector scans scripts/*.cjs).
    assert.equal(cmdSrc.match(FORBIDDEN_BOX), null,
      'box chars in scripts/operator-command.cjs: ' + JSON.stringify(cmdSrc.match(FORBIDDEN_BOX)));
    assert.equal(cmdSrc.match(FORBIDDEN_GLYPHS), null,
      'forbidden glyphs in scripts/operator-command.cjs');
    assert.equal(cmdSrc.match(VS16_WARNING), null,
      'VS16 warning emoji in scripts/operator-command.cjs');
    // commands/operator.md must be free of failed-x glyphs and VS16 emoji.
    // (Box chars in markdown EXAMPLES are tolerated because the class F
    // detector scans .md files only for body_shape frontmatter, not for
    // glyph compliance in code-fence example blocks.)
    assert.equal(cmdDoc.match(FORBIDDEN_GLYPHS), null,
      'forbidden glyphs in commands/operator.md');
    assert.equal(cmdDoc.match(VS16_WARNING), null,
      'VS16 warning emoji in commands/operator.md');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 15 ----------

(function test_15_zone_1_header_pattern_runtime() {
  const label = 'Test 15: UI Ruling System Zone 1 header literal scan (runtime)';
  const scratch = makeScratchDir('t15');
  try {
    setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: 'EXPLORE_CAPTURE', history: [] },
    });
    const samples = [];
    samples.push(runCmd([], { MINDRIAN_ROOMS_HOME: scratch }));
    samples.push(runCmd(['history'], { MINDRIAN_ROOMS_HOME: scratch }));
    samples.push(runCmd(['set'], { MINDRIAN_ROOMS_HOME: scratch }));
    samples.push(runCmd(['reset'], { MINDRIAN_ROOMS_HOME: scratch }));
    const Zone1 = /-- [a-zA-Z0-9_-]+ -- operator -- [A-Za-z0-9_.-]+ --/;
    for (let i = 0; i < samples.length; i++) {
      const lines = samples[i].stdout.split('\n');
      const matched = lines.some((ln) => Zone1.test(ln));
      assert.ok(matched, 'sample ' + i + ' must contain Zone 1 header pattern; stdout=' + samples[i].stdout.slice(0, 200));
    }
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 16 ----------

(function test_16_zone_4_footer_pattern_runtime() {
  const label = 'Test 16: UI Ruling System Zone 4 footer literal scan (runtime)';
  const scratch = makeScratchDir('t16');
  try {
    setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: 'EXPLORE_CAPTURE', history: [] },
    });
    // Zone 4 primary action glyph is U+25B6 (right-triangle-filled) followed by ' /mos:'.
    const Zone4 = new RegExp('▶ \\/mos:');
    const samples = [
      runCmd([], { MINDRIAN_ROOMS_HOME: scratch }),
      runCmd(['history'], { MINDRIAN_ROOMS_HOME: scratch }),
      runCmd(['set'], { MINDRIAN_ROOMS_HOME: scratch }),
      runCmd(['reset'], { MINDRIAN_ROOMS_HOME: scratch }),
    ];
    for (let i = 0; i < samples.length; i++) {
      assert.ok(Zone4.test(samples[i].stdout),
        'sample ' + i + ' must contain Zone 4 primary action glyph + /mos: marker');
    }
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 17 ----------

(function test_17_frame_budget() {
  const label = 'Test 17: frame budget (50 invocations < 500ms mean wall-clock)';
  const scratch = makeScratchDir('t17');
  try {
    setupSyntheticRegistry(scratch, {
      state: { current: 'JUST_TALK', previous: null, history: [] },
    });
    const N = 50;
    const start = process.hrtime.bigint();
    for (let i = 0; i < N; i++) {
      const res = runCmd([], { MINDRIAN_ROOMS_HOME: scratch });
      assert.equal(res.status, 0, 'frame budget invocation ' + i + ' must exit 0');
    }
    const end = process.hrtime.bigint();
    const totalMs = Number(end - start) / 1e6;
    const meanMs = totalMs / N;
    // 50ms target + spawnSync overhead. Allow generous 500ms mean for CI variance.
    assert.ok(meanMs < 500, 'frame budget: mean ' + meanMs.toFixed(2) + 'ms must be < 500ms');
    ok(label + ' (mean=' + meanMs.toFixed(1) + 'ms)');
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 18 ----------

(function test_18_canon_part_8_audit() {
  const label = 'Test 18: Canon Part 8 source audit (zero Brain queries)';
  try {
    const cmdSrc = fs.readFileSync(SCRIPT, 'utf8');
    // Forbidden runtime-call patterns. Test source itself contains the
    // regex literal (string), which is OK -- it's source-code audit data
    // not an actual call. Test output below acknowledges this is a
    // forbidden-pattern regex literal, not a Brain call.
    const FORBIDDEN_BRAIN = /brain\.mindrian\.ai|brainQuery|pinecone|embedQuery/;
    const m = cmdSrc.match(FORBIDDEN_BRAIN);
    assert.equal(m, null, 'Canon Part 8 violation in scripts/operator-command.cjs: ' + (m ? m[0] : ''));
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 19 ----------

(function test_19_invalid_transition_no_mtime_change() {
  const label = 'Test 19: sticky-state regression (rejected set does not bump mtime)';
  const scratch = makeScratchDir('t19');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: null, history: [] },
    });
    const statePath = path.join(reg.roomDir, '.mindrian', 'conversation-operator.json');
    const beforeStat = fs.statSync(statePath);
    const beforeMtime = beforeStat.mtimeMs;
    // Invalid transition: BUILD_ROOM -> EXPLORE_CAPTURE with manual_set
    // (rule 2 only permits JUST_TALK as the source; surviving invalid case
    // under the post-integration 9-rule schema).
    const res = runCmd(['set', 'EXPLORE_CAPTURE'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 1, 'invalid transition: exit 1');
    const afterStat = fs.statSync(statePath);
    const afterMtime = afterStat.mtimeMs;
    // mtime must be unchanged because operator.cjs.transition() does NOT
    // open the file for write when validate() rejects.
    assert.equal(afterMtime, beforeMtime,
      'sticky-state: state file mtime must be unchanged on rejected transition');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 20 ----------

(function test_20_command_md_frontmatter() {
  const label = 'Test 20: commands/operator.md frontmatter scan';
  try {
    assert.ok(fs.existsSync(COMMAND_MD), 'commands/operator.md must exist');
    const md = fs.readFileSync(COMMAND_MD, 'utf8');
    const fmMatch = md.match(/^---\s*\n([\s\S]*?)\n---/m);
    assert.ok(fmMatch, 'frontmatter block missing');
    const fm = fmMatch[1];
    const lines = fm.split('\n');
    const fields = {};
    for (const ln of lines) {
      const i = ln.indexOf(':');
      if (i === -1) continue;
      const k = ln.slice(0, i).trim();
      const v = ln.slice(i + 1).trim();
      fields[k] = v;
    }
    assert.equal(fields['body_shape'], 'E (Action Report)', 'frontmatter body_shape must be exact form');
    const hint = fields['argument-hint'] || '';
    for (const kw of ['history', 'set', 'reset', '--json']) {
      assert.ok(hint.indexOf(kw) !== -1, 'argument-hint must include ' + kw);
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 21 ----------

(function test_21_gate_round_trip_is_real() {
  const label = 'Test 21: set <op> --json carries a real gate round trip';
  const scratch = makeScratchDir('t21');
  try {
    setupSyntheticRegistry(scratch, {
      state: { current: 'EXPLORE_CAPTURE', previous: 'JUST_TALK', history: [] },
    });
    const res = runCmd(['--json', 'set', 'BUILD_ROOM'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(res.status, 0, 'set BUILD_ROOM --json: exit 0; got ' + res.status + ' stderr=' + res.stderr);
    let j;
    try { j = JSON.parse(res.stdout); } catch (e) {
      throw new Error('set BUILD_ROOM --json: stdout not valid JSON: ' + e.message + '\nstdout=' + res.stdout);
    }
    assert.ok(j.gate, 'set BUILD_ROOM --json: gate field missing');
    assert.equal(typeof j.gate.gate_id, 'string', 'gate.gate_id must be a string');
    assert.ok(j.gate.gate_id.length > 0, 'gate.gate_id must be non-empty');
    assert.equal(j.gate.verdict, 'approve', 'gate.verdict must be approve');
    assert.deepEqual(j.gate.chosen, ['BUILD_ROOM'], 'gate.chosen must be the resolved option id, not a raw label');
    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 22 ----------

(function test_22_out_of_card_choice_fails_closed() {
  const label = 'Test 22: out-of-card choice fails closed (FREE-TEXT and free-text)';
  const scratch = makeScratchDir('t22');
  try {
    const reg = setupSyntheticRegistry(scratch, {
      state: { current: 'BUILD_ROOM', previous: 'EXPLORE_CAPTURE', history: [] },
    });
    const before = readState(reg.roomDir);

    const resUpper = runCmd(['set', 'FREE-TEXT'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(resUpper.status, 1, 'set FREE-TEXT: exit 1; got ' + resUpper.status);
    assert.ok(resUpper.stderr.toLowerCase().indexOf('unknown operator') !== -1,
      'set FREE-TEXT: stderr must name the rejection');
    const afterUpper = readState(reg.roomDir);
    assert.deepEqual(afterUpper, before, 'set FREE-TEXT: state file must be unchanged');

    const resLower = runCmd(['set', 'free-text'], { MINDRIAN_ROOMS_HOME: scratch });
    assert.equal(resLower.status, 1, 'set free-text: exit 1; got ' + resLower.status);
    assert.ok(resLower.stderr.toLowerCase().indexOf('unknown operator') !== -1,
      'set free-text: stderr must name the rejection');
    const afterLower = readState(reg.roomDir);
    assert.deepEqual(afterLower, before, 'set free-text: state file must be unchanged');

    ok(label);
  } catch (e) { fail(label, e); } finally { rmrf(scratch); }
})();

// ---------- Test 23 ----------

(function test_23_gate_single_use_in_process() {
  const label = 'Test 23: gate-ledger.cjs single-use property (in-process)';
  try {
    const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
    const gateId = 'gate-test-23-' + Date.now().toString(36);
    const sessionId = 'test-23-session';
    gateLedger.mintGate(gateId, { card: { gate_id: gateId, options: [] }, sessionId: sessionId, kind: 'general' });
    const first = gateLedger.consumeGate(gateId, sessionId);
    assert.ok(first, 'first consume must return the minted entry (truthy)');
    const second = gateLedger.consumeGate(gateId, sessionId);
    assert.equal(second, null, 'second consume of the same gate_id must return null (single-use)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 24 ----------

(function test_24_source_reaches_gate_machinery() {
  const label = 'Test 24: source-level proof scripts/operator-command.cjs requires the gate machinery';
  try {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const stripped = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
    assert.ok(/gate-ledger\.cjs/.test(stripped),
      'comment-stripped source must reference gate-ledger.cjs (a comment alone does not satisfy this)');
    assert.ok(/gate-render\.cjs/.test(stripped),
      'comment-stripped source must reference gate-render.cjs (a comment alone does not satisfy this)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Summary ----------

const total = passed + failed;
process.stdout.write('\n');
process.stdout.write('Phase 99-05 operator command: ' + passed + '/' + total + ' GREEN\n');
if (failed > 0) {
  process.stdout.write('\nFailures:\n');
  for (const f of failures) {
    process.stdout.write('  - ' + f.name + ': ' + f.error + '\n');
  }
  process.exit(1);
}
process.exit(0);
