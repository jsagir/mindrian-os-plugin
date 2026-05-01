#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-04 -- operator hooks integration test (12 scenarios)
 * =============================================================
 * Spawns scripts/operator-update.cjs as a child via spawnSync with
 * crafted stdin payloads. Each test sets MINDRIAN_ROOMS_HOME to a
 * synthetic registry pointing at a synthetic active room. Verifies:
 *
 *   1.  SessionStart cold-start: no resume hint (no state file)
 *   2.  SessionStart with BUILD_ROOM + active_section: resume hint
 *   3.  UserPromptSubmit "let's file this" -> BUILD_ROOM transition
 *   4.  UserPromptSubmit "hello" (low confidence) -> no transition
 *   5.  UserPromptSubmit "/mos:explore-domains" -> METHODOLOGY
 *   6.  PostToolUse AskUserQuestion -> DECISION_GATE
 *   7.  Active-room guard: PostToolUse outside active room is silent
 *   8.  No active room (missing registry): hook is no-op
 *   9.  Sealed room: hook is no-op
 *  10.  Envelope schema strict (Phase 95 BASH-95-01)
 *  11.  Frame budget: 50 invocations mean wall-clock < 250ms
 *  12.  Hook never blocks (catch-all defensive: malformed stdin, empty
 *       stdin, missing hook_event_name)
 *
 * Self-contained: each test creates its own tmp directory under
 * os.tmpdir() and tears it down via fs.rmSync in finally.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HOOK_SCRIPT = path.join(REPO, 'scripts', 'operator-update.cjs');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  PASS  Test ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL  Test ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

// ---------- helpers ----------

function setupSyntheticRegistry(opts) {
  opts = opts || {};
  const sealed = !!opts.sealed;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'op-hooks-'));
  const roomsHome = path.join(tmp, 'rooms');
  const roomDir = path.join(roomsHome, 'test-room');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nfixture: phase-99-04\n---\n');
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify(
      {
        active_room: 'test-room',
        rooms: [
          {
            slug: 'test-room',
            venture_name: 'Test Room',
            abs_path: roomDir,
            sealed: sealed,
          },
        ],
      },
      null,
      2
    )
  );
  return { tmp: tmp, roomsHome: roomsHome, roomDir: roomDir };
}

function setupTmpNoRegistry() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'op-hooks-noreg-'));
  return { tmp: tmp, roomsHome: path.join(tmp, 'rooms') };
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) {
    /* best-effort */
  }
}

function writeState(roomDir, state) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, '.mindrian', 'conversation-operator.json'),
    JSON.stringify(state, null, 2),
    'utf8'
  );
}

function readState(roomDir) {
  const p = path.join(roomDir, '.mindrian', 'conversation-operator.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function runHook(stdin, env) {
  const r = spawnSync('node', [HOOK_SCRIPT], {
    input: typeof stdin === 'string' ? stdin : JSON.stringify(stdin || {}),
    env: Object.assign({}, process.env, env || {}),
    encoding: 'utf8',
    timeout: 8000,
  });
  return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status };
}

const ALLOWED_KEYS = new Set([
  'decision',
  'reason',
  'continue',
  'stopReason',
  'suppressOutput',
  'systemMessage',
  'hookSpecificOutput',
]);

function assertEnvelopeShape(obj) {
  for (const k of Object.keys(obj)) {
    assert.ok(ALLOWED_KEYS.has(k), 'top-level key must be allowed: ' + k);
  }
  // additionalContext MUST NOT appear at top level
  assert.equal(obj.additionalContext, undefined, 'additionalContext must not be a top-level key');
}

function buildBuildRoomState(roomDir, activeSection) {
  return {
    schema_version: '1.0.0',
    current: 'BUILD_ROOM',
    previous: 'EXPLORE_CAPTURE',
    entered_at: new Date().toISOString(),
    context: {
      active_room: path.basename(roomDir),
      active_section: activeSection || null,
      methodology_in_flight: null,
      decision_gate_pending: null,
    },
    history: [],
  };
}

function buildExploreCaptureState(roomDir) {
  return {
    schema_version: '1.0.0',
    current: 'EXPLORE_CAPTURE',
    previous: 'JUST_TALK',
    entered_at: new Date().toISOString(),
    context: {
      active_room: path.basename(roomDir),
      active_section: null,
      methodology_in_flight: null,
      decision_gate_pending: null,
    },
    history: [],
  };
}

function buildJustTalkState(roomDir) {
  return {
    schema_version: '1.0.0',
    current: 'JUST_TALK',
    previous: null,
    entered_at: new Date().toISOString(),
    context: {
      active_room: path.basename(roomDir),
      active_section: null,
      methodology_in_flight: null,
      decision_gate_pending: null,
    },
    history: [],
  };
}

// ---------- tests ----------

function test1_session_start_cold() {
  const ctx = setupSyntheticRegistry();
  try {
    const r = runHook(
      { hook_event_name: 'SessionStart' },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const env = JSON.parse(r.stdout);
    assertEnvelopeShape(env);
    assert.equal(env.continue, true);
    assert.equal(env.suppressOutput, true);
    assert.equal(env.hookSpecificOutput, undefined, 'no resume hint on cold start');
    ok('1: SessionStart cold-start surfaces no hint');
  } catch (e) {
    fail('1: SessionStart cold-start surfaces no hint', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test2_session_start_resume_hint() {
  const ctx = setupSyntheticRegistry();
  try {
    writeState(ctx.roomDir, buildBuildRoomState(ctx.roomDir, 'market-analysis'));
    const r = runHook(
      { hook_event_name: 'SessionStart' },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const env = JSON.parse(r.stdout);
    assertEnvelopeShape(env);
    assert.equal(env.continue, true);
    assert.ok(env.hookSpecificOutput, 'hookSpecificOutput present');
    assert.equal(env.hookSpecificOutput.hookEventName, 'SessionStart');
    const ac = env.hookSpecificOutput.additionalContext || '';
    assert.ok(ac.indexOf('market-analysis') >= 0, 'mentions section');
    assert.ok(/resume\?/i.test(ac), 'mentions "resume?"');
    ok('2: SessionStart with BUILD_ROOM surfaces resume hint');
  } catch (e) {
    fail('2: SessionStart with BUILD_ROOM surfaces resume hint', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test3_user_prompt_file_this_transitions() {
  const ctx = setupSyntheticRegistry();
  try {
    writeState(ctx.roomDir, buildExploreCaptureState(ctx.roomDir));
    const r = runHook(
      { hook_event_name: 'UserPromptSubmit', prompt: "let's file this" },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const state = readState(ctx.roomDir);
    assert.ok(state, 'state file persists');
    assert.equal(state.current, 'BUILD_ROOM', 'transitioned to BUILD_ROOM');
    assert.equal(state.previous, 'EXPLORE_CAPTURE', 'previous is EXPLORE_CAPTURE');
    assert.ok(Array.isArray(state.history) && state.history.length >= 1, 'history records transition');
    ok('3: UserPromptSubmit "let\'s file this" -> BUILD_ROOM');
  } catch (e) {
    fail('3: UserPromptSubmit "let\'s file this" -> BUILD_ROOM', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test4_user_prompt_low_confidence_no_transition() {
  const ctx = setupSyntheticRegistry();
  try {
    writeState(ctx.roomDir, buildJustTalkState(ctx.roomDir));
    const r = runHook(
      { hook_event_name: 'UserPromptSubmit', prompt: 'hello' },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const state = readState(ctx.roomDir);
    assert.ok(state, 'state file present');
    assert.equal(state.current, 'JUST_TALK', 'unchanged below threshold');
    assert.equal(state.history.length, 0, 'no transition recorded');
    ok('4: UserPromptSubmit "hello" stays in JUST_TALK (below threshold)');
  } catch (e) {
    fail('4: UserPromptSubmit "hello" stays in JUST_TALK (below threshold)', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test5_user_prompt_mos_command_to_methodology() {
  const ctx = setupSyntheticRegistry();
  try {
    writeState(ctx.roomDir, buildBuildRoomState(ctx.roomDir, 'problem-definition'));
    const r = runHook(
      { hook_event_name: 'UserPromptSubmit', prompt: '/mos:explore-domains' },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const state = readState(ctx.roomDir);
    assert.equal(state.current, 'METHODOLOGY', 'transitioned to METHODOLOGY');
    assert.ok(state.history.length >= 1, 'history recorded');
    ok('5: UserPromptSubmit /mos:explore-domains -> METHODOLOGY');
  } catch (e) {
    fail('5: UserPromptSubmit /mos:explore-domains -> METHODOLOGY', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test6_post_tool_ask_user_question_to_decision_gate() {
  const ctx = setupSyntheticRegistry();
  try {
    writeState(ctx.roomDir, buildBuildRoomState(ctx.roomDir, 'market-analysis'));
    const r = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'AskUserQuestion',
        tool_input: { question_id: 'q-001' },
      },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const state = readState(ctx.roomDir);
    assert.equal(state.current, 'DECISION_GATE', 'transitioned to DECISION_GATE');
    assert.equal(
      state.context.decision_gate_pending,
      'q-001',
      'decision_gate_pending captured'
    );
    ok('6: PostToolUse AskUserQuestion -> DECISION_GATE');
  } catch (e) {
    fail('6: PostToolUse AskUserQuestion -> DECISION_GATE', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test7_active_room_guard_silent_outside() {
  const ctx = setupSyntheticRegistry();
  try {
    writeState(ctx.roomDir, buildBuildRoomState(ctx.roomDir, 'market-analysis'));
    // Build a path that is OUTSIDE the active room
    const outsidePath = path.join(os.tmpdir(), 'some-other-room', 'file.md');
    const r = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: outsidePath },
      },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const state = readState(ctx.roomDir);
    assert.equal(state.current, 'BUILD_ROOM', 'state unchanged when guard fires');
    assert.equal(state.history.length, 0, 'no transition recorded');
    ok('7: Active-room guard: PostToolUse outside active room is silent');
  } catch (e) {
    fail('7: Active-room guard: PostToolUse outside active room is silent', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test8_no_registry_no_op() {
  const ctx = setupTmpNoRegistry();
  try {
    const r = runHook(
      { hook_event_name: 'UserPromptSubmit', prompt: "let's file this" },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const env = JSON.parse(r.stdout);
    assertEnvelopeShape(env);
    assert.equal(env.continue, true);
    assert.equal(env.suppressOutput, true, 'silent success');
    ok('8: No active room (missing registry) -> hook is no-op');
  } catch (e) {
    fail('8: No active room (missing registry) -> hook is no-op', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test9_sealed_room_no_op() {
  const ctx = setupSyntheticRegistry({ sealed: true });
  try {
    writeState(ctx.roomDir, buildBuildRoomState(ctx.roomDir, 'market-analysis'));
    const r = runHook(
      { hook_event_name: 'UserPromptSubmit', prompt: "let's file this" },
      { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
    );
    assert.equal(r.status, 0, 'exit code 0');
    const state = readState(ctx.roomDir);
    assert.equal(state.current, 'BUILD_ROOM', 'sealed: state unchanged');
    assert.equal(state.history.length, 0, 'sealed: no transition');
    ok('9: Sealed room -> hook is no-op');
  } catch (e) {
    fail('9: Sealed room -> hook is no-op', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test10_envelope_schema_strict() {
  const ctx = setupSyntheticRegistry();
  try {
    // Run all 4 hook events and assert envelope shape on each
    const events = [
      { hook_event_name: 'SessionStart' },
      { hook_event_name: 'Stop' },
      { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {} },
      { hook_event_name: 'UserPromptSubmit', prompt: 'hello' },
    ];
    for (const evt of events) {
      const r = runHook(evt, { MINDRIAN_ROOMS_HOME: ctx.roomsHome });
      assert.equal(r.status, 0, 'exit 0 for ' + evt.hook_event_name);
      const env = JSON.parse(r.stdout);
      assertEnvelopeShape(env);
    }
    ok('10: Envelope schema strict (BASH-95-01) across all 4 events');
  } catch (e) {
    fail('10: Envelope schema strict (BASH-95-01) across all 4 events', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test11_frame_budget() {
  const ctx = setupSyntheticRegistry();
  try {
    writeState(ctx.roomDir, buildJustTalkState(ctx.roomDir));
    const N = 50;
    const start = Date.now();
    for (let i = 0; i < N; i++) {
      const r = runHook(
        { hook_event_name: 'UserPromptSubmit', prompt: "let's file this" },
        { MINDRIAN_ROOMS_HOME: ctx.roomsHome }
      );
      assert.equal(r.status, 0, 'exit 0');
    }
    const elapsed = Date.now() - start;
    const mean = elapsed / N;
    assert.ok(
      mean < 250,
      'mean wall-clock per spawnSync < 250ms (got ' + mean.toFixed(2) + 'ms)'
    );
    ok('11: Frame budget: 50 invocations mean = ' + mean.toFixed(2) + 'ms (< 250ms)');
  } catch (e) {
    fail('11: Frame budget', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

function test12_hook_never_blocks() {
  // Three sub-cases: malformed JSON, empty stdin, missing hook_event_name.
  const ctx = setupSyntheticRegistry();
  try {
    // Malformed JSON
    let r = runHook('{not valid json', { MINDRIAN_ROOMS_HOME: ctx.roomsHome });
    assert.equal(r.status, 0, 'malformed stdin: exit 0');
    let env = JSON.parse(r.stdout);
    assertEnvelopeShape(env);

    // Empty stdin
    r = runHook('', { MINDRIAN_ROOMS_HOME: ctx.roomsHome });
    assert.equal(r.status, 0, 'empty stdin: exit 0');
    env = JSON.parse(r.stdout);
    assertEnvelopeShape(env);

    // Missing hook_event_name
    r = runHook({ prompt: 'whatever' }, { MINDRIAN_ROOMS_HOME: ctx.roomsHome });
    assert.equal(r.status, 0, 'no hook_event_name: exit 0');
    env = JSON.parse(r.stdout);
    assertEnvelopeShape(env);

    ok('12: Hook never blocks (malformed/empty/no-event-name)');
  } catch (e) {
    fail('12: Hook never blocks (malformed/empty/no-event-name)', e);
  } finally {
    rmrf(ctx.tmp);
  }
}

// ---------- runner ----------

process.stdout.write('Phase 99-04 operator hooks: 12 scenarios\n');

test1_session_start_cold();
test2_session_start_resume_hint();
test3_user_prompt_file_this_transitions();
test4_user_prompt_low_confidence_no_transition();
test5_user_prompt_mos_command_to_methodology();
test6_post_tool_ask_user_question_to_decision_gate();
test7_active_room_guard_silent_outside();
test8_no_registry_no_op();
test9_sealed_room_no_op();
test10_envelope_schema_strict();
test11_frame_budget();
test12_hook_never_blocks();

process.stdout.write(
  '\nPhase 99-04 operator hooks: ' + passed + '/12 GREEN\n'
);

if (failed > 0) {
  process.stdout.write('FAILED: ' + failed + '\n');
  process.exit(1);
}
process.exit(0);
