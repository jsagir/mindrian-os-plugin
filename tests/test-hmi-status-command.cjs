#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 105-02 -- /mos:hmi-status command behavioral test suite.
 *
 * Covers: HMI-105-02 (the user-facing /mos:hmi-status command).
 *
 * 9 assertion classes covering all rendering branches + UI self-compliance +
 * read-only invariant. Each test runs scripts/hmi-status-command.cjs in a
 * child process via spawnSync with MINDRIAN_ROOMS_HOME pointing at a scratch
 * directory so no test leaks into the user's real active room.
 *
 * Test classes:
 *   1. Module shape (top-level + _internal exports complete)
 *   2. No active room -- graceful Shape E pointing at /mos:setup
 *   3. No side-channel -- "no poll yet" Shape E pointing at /mos:doctor
 *   4. Status === 'ok' with violations -- full Shape E + priorities + mismatches
 *   5. Status === 'tier-0-skip' -- minimal Shape E pointing at /mos:setup graph
 *   6. Status === 'doctor-error' -- graceful error Shape E with manual retry
 *   7. --json passthrough -- raw envelope JSON for hooks
 *   8. UI self-compliance -- source files pass /mos:doctor --ui-compliance scan
 *   9. Read-only invariant -- zero write calls in source (comments stripped)
 *
 * IIFE harness pattern from tests/test-jtbd-command.cjs.
 * Mirrors tests/test-jtbd-ui-self-compliant.cjs for the self-compliance test.
 *
 * Self-dog-food: this test file uses Unicode escape sequences for the
 * forbidden character set so the test source itself contains zero literal
 * forbidden chars. The test file is NOT scanned by /mos:doctor --ui-compliance
 * (the scan is scoped to commands/*.md + scripts/*.cjs; tests/ is excluded);
 * the conservative escape choice is for safety against future scope changes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const child_process = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HMI_STATUS_CJS = path.join(REPO_ROOT, 'scripts', 'hmi-status-command.cjs');
const DOCTOR_CJS = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

// ---------- Sandbox helpers ----------

function setupRoomWithSideChannel(envelope) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hmi-status-'));
  const roomsHome = path.join(tmp, 'rooms');
  const roomDir = path.join(roomsHome, 'test-room');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify({
      active_room: 'test-room',
      rooms: [{
        slug: 'test-room',
        venture_name: 'Test Room',
        abs_path: roomDir,
        sealed: false,
      }],
    }, null, 2)
  );
  if (envelope) {
    fs.writeFileSync(
      path.join(roomDir, '.mindrian', 'last-hmi-poll.json'),
      JSON.stringify(envelope, null, 2)
    );
  }
  return { tmp: tmp, roomsHome: roomsHome, roomDir: roomDir };
}

function runCommand(roomsHome, argv) {
  const r = child_process.spawnSync('node', [HMI_STATUS_CJS].concat(argv || []), {
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome || '' }),
    encoding: 'utf8',
    timeout: 10000,
  });
  return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status };
}

function loadModuleFresh() {
  delete require.cache[HMI_STATUS_CJS];
  return require(HMI_STATUS_CJS);
}

// Strip ANSI escape sequences so substring assertions don't fight color codes.
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// ---------- Test 1: module shape ----------

function test_01_module_shape() {
  const m = loadModuleFresh();
  const top = ['render', 'readSideChannel', 'resolveActiveRoom',
    'renderShapeE', 'renderTier0', 'renderNoPoll',
    'renderDoctorError', 'renderNoActiveRoom'];
  for (const k of top) {
    if (typeof m[k] !== 'function') {
      throw new Error('missing top-level export: ' + k);
    }
  }
  if (!m._internal || typeof m._internal !== 'object') {
    throw new Error('missing _internal namespace');
  }
  const internal = ['renderZone1', 'renderZone2Status', 'renderZone2Priorities',
    'renderZone2Mismatches', 'renderZone4', 'renderProvenance',
    'formatPriorityRow', 'formatMismatchRow'];
  for (const k of internal) {
    if (typeof m._internal[k] !== 'function') {
      throw new Error('missing _internal.' + k);
    }
  }
}

// ---------- Test 2: no active room ----------

function test_02_no_active_room() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hmi-no-room-'));
  try {
    // No registry at all.
    const result = runCommand(path.join(tmp, 'rooms'), []);
    if (result.status !== 0) {
      throw new Error('exit !== 0: ' + result.status + '; stderr=' + result.stderr);
    }
    const out = stripAnsi(result.stdout);
    if (out.indexOf('-- (no-room) -- hmi-status -- tier-0 --') < 0) {
      throw new Error('missing no-room Zone 1 header; got:\n' + out);
    }
    if (out.indexOf('/mos:setup') < 0) {
      throw new Error('missing /mos:setup in Zone 4; got:\n' + out);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------- Test 3: no side-channel ----------

function test_03_no_side_channel() {
  // Setup with a registered room but no last-hmi-poll.json.
  const env = setupRoomWithSideChannel(null);
  try {
    const result = runCommand(env.roomsHome, []);
    if (result.status !== 0) {
      throw new Error('exit !== 0: ' + result.status);
    }
    const out = stripAnsi(result.stdout);
    if (out.indexOf('no-poll-yet') < 0) {
      throw new Error('missing no-poll-yet stage; got:\n' + out);
    }
    if (out.indexOf('/mos:doctor --ui-compliance') < 0) {
      throw new Error('missing /mos:doctor --ui-compliance action; got:\n' + out);
    }
    if (out.indexOf('hmi-compliance-poll.cjs --once') < 0) {
      throw new Error('missing fresh-poll alt action; got:\n' + out);
    }
  } finally {
    fs.rmSync(env.tmp, { recursive: true, force: true });
  }
}

// ---------- Test 4: status === 'ok' with violations ----------

function test_04_status_ok_full_render() {
  const envelope = {
    schema_version: 1,
    status: 'ok',
    polled_at: '2026-05-01T15:50:47.000Z',
    operator: 'BUILD_ROOM',
    jtbd: 'find-bottleneck',
    tier: 1,
    mode: 'B',
    doctor: {
      status: 'warn',
      totalViolations: 47,
      counts: {
        missingBodyShape: 47,
        unauthorizedBoxChar: 0,
        unauthorizedGlyph: 0,
        rendererMissingZone1: 0,
        rendererMissingZone4: 0,
      },
    },
    operator_shape_mismatches: [{
      file: 'commands/foo.md',
      declared: 'B',
      expected_family: ['E'],
      operator: 'BUILD_ROOM',
    }],
    priorities: [{
      file: 'commands/find-bottlenecks.md',
      kind: 'missing-body-shape',
      weight: 1.0,
      matched_jtbd: 'find-bottleneck',
      via: 'methodology_hooks',
    }, {
      file: 'commands/whitespace.md',
      kind: 'missing-body-shape',
      weight: 0.3,
      matched_jtbd: null,
      via: null,
    }],
    elapsed_ms: 187,
    _provenance: {
      phase: '105-01',
      doctor_version: 'doc',
      skill_ref: 'skills/ui-system/SKILL.md',
    },
  };
  const env = setupRoomWithSideChannel(envelope);
  try {
    const result = runCommand(env.roomsHome, []);
    if (result.status !== 0) {
      throw new Error('exit !== 0: ' + result.status + '; stderr=' + result.stderr);
    }
    const out = stripAnsi(result.stdout);
    const expects = [
      '-- test-room -- hmi-status -- BUILD_ROOM/find-bottleneck --',
      'Doctor status: warn (47 violations)',
      'Top 5 priorities',
      'commands/find-bottlenecks.md',
      'weight 1.0',
      'matched: find-bottleneck',
      'Operator shape mismatches',
      'commands/foo.md',
      'declared: B',
      'expects: E',
      '/mos:doctor --ui-compliance --fix',
      '/mos:hmi-status --json',
      'polled 2026-05-01T15:50:47',
      'mode B',
    ];
    for (const e of expects) {
      if (out.indexOf(e) < 0) {
        throw new Error('missing expected substring: ' + JSON.stringify(e) + '\nGot:\n' + out);
      }
    }
  } finally {
    fs.rmSync(env.tmp, { recursive: true, force: true });
  }
}

// ---------- Test 5: status === 'tier-0-skip' ----------

function test_05_status_tier_0_skip() {
  const envelope = {
    schema_version: 1,
    status: 'tier-0-skip',
    polled_at: '2026-05-01T15:55:00.000Z',
    operator: null,
    jtbd: null,
    tier: 0,
    mode: '0',
    doctor: { status: 'unknown', totalViolations: 0, counts: {} },
    operator_shape_mismatches: [],
    priorities: [],
    elapsed_ms: 12,
    _provenance: { phase: '105-01' },
  };
  const env = setupRoomWithSideChannel(envelope);
  try {
    const result = runCommand(env.roomsHome, []);
    if (result.status !== 0) {
      throw new Error('exit !== 0: ' + result.status);
    }
    const out = stripAnsi(result.stdout);
    if (out.indexOf('tier-0') < 0) {
      throw new Error('missing tier-0 stage; got:\n' + out);
    }
    if (out.indexOf('/mos:setup graph') < 0) {
      throw new Error('missing /mos:setup graph action; got:\n' + out);
    }
  } finally {
    fs.rmSync(env.tmp, { recursive: true, force: true });
  }
}

// ---------- Test 6: status === 'doctor-error' ----------

function test_06_status_doctor_error() {
  const envelope = {
    schema_version: 1,
    status: 'doctor-error',
    error: 'doctor JSON parse failed',
    polled_at: '2026-05-01T15:56:00.000Z',
    operator: 'JUST_TALK',
    jtbd: null,
    tier: 1,
    mode: 'B',
    doctor: { status: 'error', totalViolations: 0, counts: {} },
    operator_shape_mismatches: [],
    priorities: [],
    elapsed_ms: 250,
    _provenance: { phase: '105-01' },
  };
  const env = setupRoomWithSideChannel(envelope);
  try {
    const result = runCommand(env.roomsHome, []);
    if (result.status !== 0) {
      throw new Error('exit !== 0: ' + result.status);
    }
    const out = stripAnsi(result.stdout);
    if (out.indexOf('doctor-error') < 0) {
      throw new Error('missing doctor-error stage; got:\n' + out);
    }
    if (out.indexOf('/mos:doctor --ui-compliance') < 0) {
      throw new Error('missing manual retry action; got:\n' + out);
    }
  } finally {
    fs.rmSync(env.tmp, { recursive: true, force: true });
  }
}

// ---------- Test 7: --json passthrough ----------

function test_07_json_passthrough() {
  const envelope = {
    schema_version: 1,
    status: 'ok',
    polled_at: '2026-05-01T15:50:47.000Z',
    operator: 'BUILD_ROOM',
    jtbd: 'find-bottleneck',
    tier: 1,
    mode: 'B',
    doctor: {
      status: 'warn',
      totalViolations: 47,
      counts: { missingBodyShape: 47 },
    },
    operator_shape_mismatches: [],
    priorities: [],
    elapsed_ms: 187,
    _provenance: { phase: '105-01' },
  };
  const env = setupRoomWithSideChannel(envelope);
  try {
    const result = runCommand(env.roomsHome, ['--json']);
    if (result.status !== 0) {
      throw new Error('exit !== 0: ' + result.status);
    }
    let parsed;
    try { parsed = JSON.parse(result.stdout); }
    catch (e) {
      throw new Error('JSON.parse failed: ' + e.message + '\nstdout=' + result.stdout);
    }
    if (parsed.status !== 'ok') throw new Error('status: ' + parsed.status);
    if (parsed.operator !== 'BUILD_ROOM') throw new Error('operator: ' + parsed.operator);
    if (parsed.jtbd !== 'find-bottleneck') throw new Error('jtbd: ' + parsed.jtbd);
    if (!parsed.doctor || parsed.doctor.totalViolations !== 47) {
      throw new Error('doctor.totalViolations: ' + (parsed.doctor && parsed.doctor.totalViolations));
    }
  } finally {
    fs.rmSync(env.tmp, { recursive: true, force: true });
  }
}

// ---------- Test 8: UI self-compliance ----------

function test_08_ui_self_compliance() {
  const r = child_process.spawnSync('node', [
    DOCTOR_CJS,
    '--ui-compliance',
    '--scan-commands=commands',
    '--scan-scripts=scripts',
    '--json',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 15000,
  });
  if (r.status !== 0 && r.status !== 1) {
    throw new Error('doctor exit unexpected: ' + r.status + '; stderr=' + r.stderr);
  }
  let parsed;
  try { parsed = JSON.parse(r.stdout); }
  catch (e) {
    throw new Error('doctor JSON parse failed: ' + e.message);
  }
  const ui = parsed.checks && parsed.checks['ui-compliance'];
  if (!ui || !Array.isArray(ui.violations)) {
    throw new Error('doctor JSON missing checks.ui-compliance.violations');
  }
  const ourViolations = ui.violations.filter(function (v) {
    return v && (
      v.file === 'commands/hmi-status.md' ||
      v.file === 'scripts/hmi-status-command.cjs' ||
      v.file === './commands/hmi-status.md' ||
      v.file === './scripts/hmi-status-command.cjs'
    );
  });
  if (ourViolations.length !== 0) {
    throw new Error('Phase 105-02 files self-violate: '
      + JSON.stringify(ourViolations, null, 2));
  }
}

// ---------- Test 9: read-only invariant ----------

function test_09_read_only_invariant() {
  const src = fs.readFileSync(HMI_STATUS_CJS, 'utf8');
  // Strip line + block comments before scanning. Scaffolding talks ABOUT
  // writes ('NEVER writes side-channel') -- those are documentation, not
  // executable side effects.
  const scrubbed = src
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const writePatterns = ['writeFileSync', 'fs.write', 'writeStateAtomic',
    'setCurrent(', 'appendFile'];
  for (const tok of writePatterns) {
    if (scrubbed.indexOf(tok) >= 0) {
      throw new Error('write call detected in non-comment code: ' + tok);
    }
  }
}

// ---------- Runner ----------

const tests = [
  ['01 module shape', test_01_module_shape],
  ['02 no active room graceful', test_02_no_active_room],
  ['03 no side-channel graceful', test_03_no_side_channel],
  ['04 status ok full Shape E', test_04_status_ok_full_render],
  ['05 status tier-0-skip', test_05_status_tier_0_skip],
  ['06 status doctor-error', test_06_status_doctor_error],
  ['07 --json passthrough', test_07_json_passthrough],
  ['08 UI self-compliance', test_08_ui_self_compliance],
  ['09 read-only invariant', test_09_read_only_invariant],
];

let pass = 0;
let fail = 0;
const PASS_GLYPH = '✓'; // U+2713 CHECK MARK
const FAIL_GLYPH = '✗'; // U+2717 BALLOT X (test runner only; tests/ is out of scan scope)
for (const t of tests) {
  try {
    t[1]();
    console.log(PASS_GLYPH + ' ' + t[0]);
    pass += 1;
  } catch (e) {
    console.error(FAIL_GLYPH + ' ' + t[0] + ': ' + (e && e.message ? e.message : String(e)));
    fail += 1;
  }
}
console.log('\nPhase 105-02 hmi-status command: ' + pass + '/' + tests.length + ' GREEN');
process.exit(fail > 0 ? 1 : 0);
