#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * v1.11.2 (2026-04-29) -- regression fence for PostToolUse hook envelope shape.
 *
 * Background:
 *   Claude Code 2.x added `additionalProperties: false` to the PostToolUse
 *   output schema. Top-level `additionalContext` and `systemMessage` keys
 *   alongside other root keys (or with values like `null`) are rejected with
 *   "Hook JSON output validation failed -- (root): Invalid input".
 *
 *   Allowed top-level keys (per docs.claude.com/docs/en/hooks):
 *     continue, stopReason, suppressOutput, systemMessage, decision, reason,
 *     hookSpecificOutput.
 *
 *   For PostToolUse, the canonical advisory shape is:
 *     { "hookSpecificOutput": { "hookEventName": "PostToolUse",
 *                               "additionalContext": "<one-line string>" } }
 *
 * Scope (v1.11.2):
 *   This test gates the two .cjs PostToolUse hooks patched in v1.11.2:
 *     - scripts/frontmatter-schema-validator.cjs
 *     - scripts/async-artifact-auto-commit.cjs
 *   Plus a fence over the already-fixed v1.10.19 reference:
 *     - scripts/query-efficiency-telemetry.cjs
 *   The bash post-write hook (scripts/post-write) is intentionally NOT gated
 *   here. Its envelope-shape fix is deferred to a follow-up patch (see Follow-
 *   Ups in .planning/debug/post-write-hook-envelope-invalid-input.md).
 *
 * For each hook, two paths are tested:
 *   1. Silent path: file outside a .room-root subtree -> stdout is empty.
 *   2. Message path: file inside a .room-root subtree that triggers an
 *      advisory message -> stdout parses as JSON; only allowed top-level keys
 *      appear; if hookSpecificOutput is present, hookEventName === 'PostToolUse'
 *      and additionalContext is a string; `additionalContext` is NOT a top-
 *      level key.
 *
 * Always exits 0 even when the hook does not fire its message path -- soft-
 * fail is a hook invariant; we only assert that what IS emitted conforms.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

// Allowed top-level keys per Claude Code 2.x PostToolUse schema.
const ALLOWED_TOP_LEVEL = new Set([
  'continue',
  'stopReason',
  'suppressOutput',
  'systemMessage',
  'decision',
  'reason',
  'hookSpecificOutput',
]);

// ----------------------------------------------------------------------------
// Phase 95-04 (v1.11.3+): per-lifecycle-event allowed top-level key Sets.
// Source: 95-RESEARCH.md Section 2 "Per-Event Hook Schema Reference"
// (verified against authoritative Claude Code 2.x docs 2026-04-29).
//
// Master rule: additionalProperties: false. Any key not in the per-event Set
// is invalid. PostCompact, FileChanged, CwdChanged, TaskCompleted do NOT
// accept hookSpecificOutput at all; the per-event scenarios below assert
// that absence in addition to the allowed-key subset check.
// ----------------------------------------------------------------------------
const ALLOWED_PRE_COMPACT = new Set([
  'continue', 'stopReason', 'suppressOutput', 'systemMessage',
  'decision', 'reason', 'hookSpecificOutput',
]);
const ALLOWED_POST_COMPACT = new Set([
  'continue', 'stopReason', 'suppressOutput', 'systemMessage',
]); // NO hookSpecificOutput
const ALLOWED_FILE_CHANGED = new Set([
  'continue', 'stopReason', 'suppressOutput', 'systemMessage',
]); // NO hookSpecificOutput
const ALLOWED_CWD_CHANGED = new Set([
  'continue', 'stopReason', 'suppressOutput', 'systemMessage',
]); // NO hookSpecificOutput
const ALLOWED_SUBAGENT_STOP = new Set([
  'continue', 'stopReason', 'suppressOutput', 'systemMessage',
  'decision', 'reason', 'hookSpecificOutput',
]);
const ALLOWED_TASK_COMPLETED = new Set([
  'continue', 'stopReason', 'suppressOutput', 'systemMessage',
  'decision', 'reason',
]); // NO hookSpecificOutput

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Sandbox helpers ----------

function makeScratchDir(suffix) {
  const base = path.join(os.tmpdir(), 'mos-hook-envelope-' + Date.now().toString(36) + '-' + suffix);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function makeRoomRoot(scratch) {
  const roomDir = path.join(scratch, 'room');
  const sectionDir = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(sectionDir, { recursive: true });
  // .room-root sentinel marks this as a Mindrian room (Phase 87-01a).
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  return { roomDir, sectionDir };
}

function makeOutsideRoom(scratch) {
  // No .room-root sentinel anywhere up the tree.
  const dir = path.join(scratch, 'noroom');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

// Run a hook with a synthetic PostToolUse envelope on stdin. Returns
// { stdout, status }. Captures only stdout because hooks are advisory and
// soft-fail to stderr.
function runHook(scriptPath, envelope, opts) {
  const o = opts || {};
  const res = spawnSync('node', [scriptPath], {
    encoding: 'utf8',
    input: JSON.stringify(envelope),
    timeout: o.timeoutMs || 5000,
    cwd: o.cwd || process.cwd(),
    env: Object.assign({}, process.env, o.env || {}),
  });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

// Phase 95-04: bash-hook variant. Spawns `bash <scriptPath>` instead of
// `node <scriptPath>`. Mirrors tests/test-cascade-side-channel.cjs's
// runBashHook helper byte-identically so the per-event scenarios stay
// independent of node-script vs bash-script path differences.
function runBashHook(scriptPath, envelope, opts) {
  const o = opts || {};
  const res = spawnSync('bash', [scriptPath], {
    encoding: 'utf8',
    input: JSON.stringify(envelope),
    timeout: o.timeoutMs || 5000,
    cwd: o.cwd || process.cwd(),
    env: Object.assign({}, process.env, o.env || {}),
  });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

// Assert that stdout is either empty (silent) or a single JSON line that
// satisfies the Claude Code 2.x PostToolUse contract.
function assertEnvelopeShape(stdout, label) {
  // Must always exit 0 (caller verifies status separately). Empty stdout =
  // silent path = always valid.
  const trimmed = stdout.trim();
  if (trimmed === '') return; // silent path -- nothing more to assert

  // Otherwise the emitted bytes must be a single JSON object on one line.
  let payload;
  try {
    payload = JSON.parse(trimmed);
  } catch (e) {
    throw new Error(label + ': stdout is not valid JSON: ' + trimmed);
  }
  assert.equal(typeof payload, 'object',
    label + ': stdout JSON must be an object');
  assert.notEqual(payload, null,
    label + ': stdout JSON must not be null');

  // Every top-level key must be in the allowed set.
  for (const k of Object.keys(payload)) {
    if (!ALLOWED_TOP_LEVEL.has(k)) {
      throw new Error(label + ': disallowed top-level key "' + k + '". stdout=' + trimmed);
    }
  }

  // additionalContext MUST NOT appear at root.
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'additionalContext'), false,
    label + ': "additionalContext" must NOT be a top-level key (must live inside hookSpecificOutput)');

  // If hookSpecificOutput is present, validate its inner shape.
  if (Object.prototype.hasOwnProperty.call(payload, 'hookSpecificOutput')) {
    const hso = payload.hookSpecificOutput;
    assert.equal(typeof hso, 'object',
      label + ': hookSpecificOutput must be an object');
    assert.notEqual(hso, null,
      label + ': hookSpecificOutput must not be null');
    assert.equal(hso.hookEventName, 'PostToolUse',
      label + ': hookSpecificOutput.hookEventName must equal "PostToolUse"');
    if (Object.prototype.hasOwnProperty.call(hso, 'additionalContext')) {
      assert.equal(typeof hso.additionalContext, 'string',
        label + ': hookSpecificOutput.additionalContext must be a string');
    }
  }
}

// Phase 95-04: per-event envelope-shape assertion. Mirrors
// assertEnvelopeShape but takes a per-event allowed-key Set and an expected
// hookEventName. If hookEventName is null, the function additionally asserts
// that `hookSpecificOutput` is NOT a top-level key (events like PostCompact,
// FileChanged, CwdChanged, TaskCompleted that do NOT accept hSO per the
// Claude Code 2.x schema).
function assertEnvelopeShapePerEvent(stdout, label, allowedKeys, hookEventName) {
  const trimmed = stdout.trim();
  if (trimmed === '') return; // silent path -- nothing more to assert

  let payload;
  try {
    payload = JSON.parse(trimmed);
  } catch (e) {
    throw new Error(label + ': stdout is not valid JSON: ' + trimmed);
  }
  assert.equal(typeof payload, 'object',
    label + ': stdout JSON must be an object');
  assert.notEqual(payload, null,
    label + ': stdout JSON must not be null');

  // Every top-level key must be in the per-event allowed Set.
  for (const k of Object.keys(payload)) {
    if (!allowedKeys.has(k)) {
      throw new Error(
        label + ': disallowed top-level key "' + k + '". stdout=' + trimmed
      );
    }
  }

  // additionalContext NEVER at root (universal rule).
  assert.equal(
    Object.prototype.hasOwnProperty.call(payload, 'additionalContext'),
    false,
    label + ': "additionalContext" must NOT be a top-level key'
  );

  // If hookEventName is null, the event does not accept hookSpecificOutput.
  if (hookEventName === null) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(payload, 'hookSpecificOutput'),
      false,
      label + ': this event does NOT accept hookSpecificOutput at root'
    );
  } else if (Object.prototype.hasOwnProperty.call(payload, 'hookSpecificOutput')) {
    const hso = payload.hookSpecificOutput;
    assert.equal(typeof hso, 'object',
      label + ': hookSpecificOutput must be an object');
    assert.notEqual(hso, null,
      label + ': hookSpecificOutput must not be null');
    assert.equal(hso.hookEventName, hookEventName,
      label + ': hookSpecificOutput.hookEventName must equal "' + hookEventName + '"');
    if (Object.prototype.hasOwnProperty.call(hso, 'additionalContext')) {
      assert.equal(typeof hso.additionalContext, 'string',
        label + ': hookSpecificOutput.additionalContext must be a string');
    }
  }
}

// Phase 95-04: makeRoomRoot variant matching tests/test-cascade-side-channel.cjs
// Strategy 0 layout (registry + .room-root + STATE.md + section dir). Caller
// passes env.MINDRIAN_ROOMS_HOME = scratch so scripts/resolve-room locates
// the synthetic room as active. Without this, hooks resolve the user's real
// active room and the active-room guards skip the cascade -- breaking the
// message-path scenarios.
function makeStrategy0Room(scratch) {
  const roomName = 'test-room';
  const roomDir = path.join(scratch, roomName);
  const sectionDir = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# Test room state\n');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });

  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  fs.writeFileSync(
    path.join(registryDir, 'registry.json'),
    JSON.stringify({
      active: roomName,
      rooms: { [roomName]: { path: roomName } },
    }, null, 2)
  );
  return { scratch, roomDir, sectionDir };
}

// Phase 95-04: emit a uniquely-named FAIL line on assertion failure so the
// RED gate can count the named scenarios via grep -cE on the enumerated set.
function failNamed(scenarioName, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + scenarioName + '\n');
  process.stderr.write('FAIL: ' + scenarioName + ' - ' + (err && err.message ? err.message : String(err)) + '\n');
}

// ---------- Per-hook scenario runners ----------

function runFrontmatterValidatorScenarios() {
  const script = path.join(REPO, 'scripts', 'frontmatter-schema-validator.cjs');

  // Scenario A: silent path -- file outside any room (no .room-root walk hit).
  (function silentOutsideRoom() {
    const label = 'frontmatter-schema-validator: silent path (outside room)';
    const scratch = makeScratchDir('fm-silent');
    try {
      const outsideDir = makeOutsideRoom(scratch);
      const target = path.join(outsideDir, 'plain.md');
      fs.writeFileSync(target,
        '---\n' +
        'name: example\n' +
        '---\n' +
        '# Plain\n');
      const envelope = {
        tool_name: 'Write',
        tool_input: { file_path: target },
      };
      const { stdout, status } = runHook(script, envelope);
      assert.equal(status, 0, label + ': hook must exit 0');
      assert.equal(stdout, '',
        label + ': silent path must emit zero stdout bytes; got ' + JSON.stringify(stdout));
      assertEnvelopeShape(stdout, label);
      ok(label);
    } catch (e) {
      fail(label, e);
    } finally {
      rmrf(scratch);
    }
  })();

  // Scenario B: message path -- file inside a room with malformed frontmatter
  // forces the validator to emit an advisory.
  (function messagePathInsideRoom() {
    const label = 'frontmatter-schema-validator: message path (inside room, schema violation)';
    const scratch = makeScratchDir('fm-msg');
    try {
      const { sectionDir } = makeRoomRoot(scratch);
      const target = path.join(sectionDir, 'broken-artifact.md');
      // Empty frontmatter triggers "all required missing" critical violation.
      fs.writeFileSync(target,
        '---\n' +
        '---\n' +
        '# Body without required fields\n');
      const envelope = {
        tool_name: 'Write',
        tool_input: { file_path: target },
      };
      // CLAUDE_PLUGIN_DATA points at a scratch dir to avoid polluting the
      // user's real ~/.mindrian on test runs.
      const dataDir = path.join(scratch, 'plugin-data');
      fs.mkdirSync(dataDir, { recursive: true });
      const { stdout, status } = runHook(script, envelope, {
        env: { CLAUDE_PLUGIN_DATA: dataDir },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      // Either silent (if schemas module unavailable / file rejected) or
      // valid envelope. Both cases pass shape gating; we only assert
      // conformance for whatever was emitted.
      assertEnvelopeShape(stdout, label);
      ok(label);
    } catch (e) {
      fail(label, e);
    } finally {
      rmrf(scratch);
    }
  })();
}

function runAsyncAutoCommitScenarios() {
  const script = path.join(REPO, 'scripts', 'async-artifact-auto-commit.cjs');

  // Scenario A: silent path -- file outside any room.
  (function silentOutsideRoom() {
    const label = 'async-artifact-auto-commit: silent path (outside room)';
    const scratch = makeScratchDir('ac-silent');
    try {
      const outsideDir = makeOutsideRoom(scratch);
      const target = path.join(outsideDir, 'note.md');
      fs.writeFileSync(target, '# nope\n');
      const envelope = {
        tool_name: 'Write',
        tool_input: { file_path: target },
      };
      const { stdout, status } = runHook(script, envelope);
      assert.equal(status, 0, label + ': hook must exit 0');
      assert.equal(stdout, '',
        label + ': silent path must emit zero stdout bytes; got ' + JSON.stringify(stdout));
      assertEnvelopeShape(stdout, label);
      ok(label);
    } catch (e) {
      fail(label, e);
    } finally {
      rmrf(scratch);
    }
  })();

  // Scenario B: message path -- file inside a real git-initialized room.
  // The hook spawns a detached worker; we only assert envelope shape on
  // the synchronous foreground emission.
  (function messagePathInsideGitRoom() {
    const label = 'async-artifact-auto-commit: message path (inside git-initialized room)';
    const scratch = makeScratchDir('ac-msg');
    try {
      const { roomDir, sectionDir } = makeRoomRoot(scratch);

      // Initialize git inside the room and create a baseline commit so
      // ensureAutocommitBranch() can create the branch at HEAD.
      const gitInit = spawnSync('git', ['-C', roomDir, 'init', '-q', '-b', 'main'], { encoding: 'utf8' });
      if (gitInit.status !== 0) {
        // git unavailable -> skip with no failure. Hook will silent-exit.
        ok(label + ' (skipped: git unavailable)');
        return;
      }
      spawnSync('git', ['-C', roomDir, 'config', 'user.email', 'test@example.com'], { encoding: 'utf8' });
      spawnSync('git', ['-C', roomDir, 'config', 'user.name', 'Test'], { encoding: 'utf8' });
      const seedFile = path.join(roomDir, 'README.md');
      fs.writeFileSync(seedFile, 'seed\n');
      spawnSync('git', ['-C', roomDir, 'add', 'README.md'], { encoding: 'utf8' });
      spawnSync('git', ['-C', roomDir, 'commit', '-q', '-m', 'seed'], { encoding: 'utf8' });

      const target = path.join(sectionDir, 'artifact.md');
      fs.writeFileSync(target, '---\nname: artifact\n---\n# Body\n');

      const envelope = {
        tool_name: 'Write',
        tool_input: { file_path: target },
      };
      const { stdout, status } = runHook(script, envelope);
      assert.equal(status, 0, label + ': hook must exit 0');
      // Either silent (throttle hit, spawn fail) or valid envelope.
      assertEnvelopeShape(stdout, label);
      ok(label);
    } catch (e) {
      fail(label, e);
    } finally {
      rmrf(scratch);
    }
  })();
}

function runQueryEfficiencyTelemetryFence() {
  // Fence over the v1.10.19 reference fix to detect any future regression.
  const script = path.join(REPO, 'scripts', 'query-efficiency-telemetry.cjs');

  (function silentNonMatcher() {
    const label = 'query-efficiency-telemetry: silent path (Write tool name -> non-matcher)';
    try {
      // Hook only acts on Read|Grep|Glob; Write -> silent.
      const envelope = {
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/nonexistent.md' },
      };
      const { stdout, status } = runHook(script, envelope);
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShape(stdout, label);
      ok(label);
    } catch (e) {
      fail(label, e);
    }
  })();
}

// ============================================================================
// Phase 95-04: per-event bash hook envelope scenarios
// ============================================================================
//
// 6 scenario runners, one per fixed bash hook. Each uses runBashHook +
// assertEnvelopeShapePerEvent against the per-event allowed-key Set defined
// near the top of this file.
//
// RED gate (B3 fix): scenarios that find a violation emit a uniquely-named
// "FAIL: <scenario-name>" line on stderr. The verify gate counts >=6 named
// FAIL lines from the enumerated set:
//   1. pre-compact silent-path
//   2. pre-compact message-path
//   3. post-compact
//   4. on-cwd-changed success-path
//   5. on-agent-complete cascade-path
//   6. on-task-complete summary-path
// (on-file-changed is NOT in the floor; its diagnostic paths may already
// exit silent when the synthetic envelope shape skips them.)
//
// After Plan 95-04 Task 2 GREEN, all scenarios pass and zero FAIL lines
// remain.

const PRE_COMPACT = path.join(REPO, 'scripts', 'pre-compact');
const POST_COMPACT = path.join(REPO, 'scripts', 'post-compact');
const ON_FILE_CHANGED = path.join(REPO, 'scripts', 'on-file-changed');
const ON_CWD_CHANGED = path.join(REPO, 'scripts', 'on-cwd-changed');
const ON_AGENT_COMPLETE = path.join(REPO, 'scripts', 'on-agent-complete');
const ON_TASK_COMPLETE = path.join(REPO, 'scripts', 'on-task-complete');

function runPreCompactScenarios() {
  // ----- silent path (no active room) -----
  (function silentNoRoom() {
    const scenarioName = 'pre-compact silent-path';
    const label = 'pre-compact: silent path (no active room)';
    const scratch = makeScratchDir('pc-silent');
    try {
      // No registry, no room -- resolve-room returns nothing, hook hits
      // the no-room emission line.
      const { stdout, status } = runBashHook(PRE_COMPACT, {}, {
        cwd: scratch,
        env: { MINDRIAN_ROOMS_HOME: scratch },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_PRE_COMPACT, 'PreCompact');
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();

  // ----- message path (active room with STATE.md) -----
  (function messagePathActiveRoom() {
    const scenarioName = 'pre-compact message-path';
    const label = 'pre-compact: message path (active room)';
    const scratch = makeScratchDir('pc-msg');
    try {
      const { roomDir } = makeStrategy0Room(scratch);
      const { stdout, status } = runBashHook(PRE_COMPACT, {}, {
        cwd: roomDir,
        env: { MINDRIAN_ROOMS_HOME: scratch, HOME: scratch },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_PRE_COMPACT, 'PreCompact');
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();
}

function runPostCompactScenarios() {
  // PostCompact: NO hookSpecificOutput at root; allowed keys subset of
  // {continue, stopReason, suppressOutput, systemMessage}.
  (function envelopeShape() {
    const scenarioName = 'post-compact';
    const label = 'post-compact: envelope-shape valid';
    const scratch = makeScratchDir('pcompact');
    try {
      const { roomDir } = makeStrategy0Room(scratch);
      // Seed the bridge save file so post-compact takes the restore path
      // (otherwise it execs session-start, which is out of scope).
      const bridgeDir = path.join(scratch, '.mindrian', 'bridge');
      fs.mkdirSync(bridgeDir, { recursive: true });
      const saveFile = path.join(bridgeDir, 'pre-compact-state.json');
      fs.writeFileSync(saveFile,
        'TIMESTAMP=2026-04-29T00:00:00Z\n' +
        'ROOM_DIR=' + roomDir + '\n' +
        'VENTURE_STAGE=Pre-Opportunity\n' +
        'TOTAL_ENTRIES=0\n' +
        '---STATE_MD_START---\n# state\n---STATE_MD_END---\n' +
        '---LAST_ARTIFACTS_START---\n---LAST_ARTIFACTS_END---\n' +
        '---MINTO_CONFIDENCE_START---\n---MINTO_CONFIDENCE_END---\n' +
        '---PIPELINE_STATE_START---\n---PIPELINE_STATE_END---\n' +
        '---USER_CONTEXT_START---\n---USER_CONTEXT_END---\n');
      const { stdout, status } = runBashHook(POST_COMPACT, {}, {
        cwd: roomDir,
        env: {
          MINDRIAN_ROOMS_HOME: scratch,
          HOME: scratch,
          CLAUDE_PLUGIN_ROOT: REPO, // force the Claude branch (not Cursor)
        },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      // PostCompact: no hookSpecificOutput. Pass null as hookEventName to
      // assert hSO is NOT at root.
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_POST_COMPACT, null);
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();
}

function runOnFileChangedScenarios() {
  // FileChanged: emit nothing on diagnostic paths (after fix). Allowed
  // keys subset of {continue, stopReason, suppressOutput, systemMessage};
  // NO hookSpecificOutput. Note: NOT in the RED floor (B3 fix).
  (function silentDiagnostic() {
    const scenarioName = 'on-file-changed silent-diagnostic';
    const label = 'on-file-changed: silent on diagnostic paths';
    try {
      // Empty file path -> hook hits "no_file" path. Should emit silent
      // (after fix) or {"status": "no_file"} (before fix -> RED).
      const { stdout, status } = runBashHook(ON_FILE_CHANGED, {}, {});
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_FILE_CHANGED, null);
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    }
  })();
}

function runOnCwdChangedScenarios() {
  // CwdChanged: NO hookSpecificOutput. Allowed keys subset of
  // {continue, stopReason, suppressOutput, systemMessage}.

  // ----- silent path (no room) -----
  (function silentNoRoom() {
    const scenarioName = 'on-cwd-changed silent-no-room';
    const label = 'on-cwd-changed: silent on no-room';
    const scratch = makeScratchDir('cwd-silent');
    try {
      const { stdout, status } = runBashHook(ON_CWD_CHANGED, {}, {
        cwd: scratch,
        env: { MINDRIAN_ROOMS_HOME: scratch },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_CWD_CHANGED, null);
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();

  // ----- success path (active room resolved) -----
  (function successPath() {
    const scenarioName = 'on-cwd-changed success-path';
    const label = 'on-cwd-changed: success path (active room resolved)';
    const scratch = makeScratchDir('cwd-success');
    try {
      const { roomDir } = makeStrategy0Room(scratch);
      // Seed an OLD active room different from roomDir so the same-room
      // short-circuit at line 45 doesn't fire. We do this by passing an
      // alternate cwd that resolves to a different room ... but easier:
      // pass the section dir as NEW_DIR (arg $1) since the hook's walk-up
      // logic finds STATE.md and the OLD_ROOM resolves via PWD which is
      // outside the room.
      const { stdout, status } = runBashHook(ON_CWD_CHANGED, {}, {
        cwd: scratch, // PWD outside any room -> OLD_ROOM = ""
        env: { MINDRIAN_ROOMS_HOME: scratch, CLAUDE_PLUGIN_ROOT: REPO },
        // Note: the hook uses $1 OR $PWD as NEW_DIR; bash with stdin
        // input but no positional arg defaults to $PWD which is scratch.
        // The walk-up from scratch/test-room/problem-definition won't fire
        // because cwd is scratch (above the room). To force success, we
        // need to pass the room as NEW_DIR. spawnSync bash + arg:
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_CWD_CHANGED, null);
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();

  // ----- success path (forced via positional arg = roomDir) -----
  (function successPathArg() {
    const scenarioName = 'on-cwd-changed success-path';
    const label = 'on-cwd-changed: success path with NEW_DIR arg';
    const scratch = makeScratchDir('cwd-arg');
    try {
      const { roomDir } = makeStrategy0Room(scratch);
      const res = spawnSync('bash', [ON_CWD_CHANGED, roomDir], {
        encoding: 'utf8',
        input: '',
        timeout: 5000,
        cwd: scratch,
        env: Object.assign({}, process.env, {
          MINDRIAN_ROOMS_HOME: scratch,
          CLAUDE_PLUGIN_ROOT: REPO,
        }),
      });
      const stdout = res.stdout || '';
      const status = typeof res.status === 'number' ? res.status : -1;
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_CWD_CHANGED, null);
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();
}

function runOnAgentCompleteScenarios() {
  // SubagentStop: accepts hookSpecificOutput.additionalContext. Allowed keys
  // include hookSpecificOutput.

  // ----- silent path (no room) -----
  (function silentNoRoom() {
    const scenarioName = 'on-agent-complete silent-no-room';
    const label = 'on-agent-complete: silent on no-room';
    const scratch = makeScratchDir('ac-silent');
    try {
      const { stdout, status } = runBashHook(ON_AGENT_COMPLETE, {}, {
        cwd: scratch,
        env: { MINDRIAN_ROOMS_HOME: scratch },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_SUBAGENT_STOP, 'SubagentStop');
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();

  // ----- cascade path (recently modified files) -----
  (function cascadePath() {
    const scenarioName = 'on-agent-complete cascade-path';
    const label = 'on-agent-complete: cascade path (recently modified files)';
    const scratch = makeScratchDir('ac-cascade');
    try {
      const { roomDir, sectionDir } = makeStrategy0Room(scratch);
      // Drop a recently modified .md file inside the section so the
      // 30-second cutoff sees it.
      const artifactDir = path.join(sectionDir, 'fresh-artifact');
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, 'fresh-artifact.md'),
        '---\nname: fresh-artifact\n---\n# Body\n');
      const { stdout, status } = runBashHook(ON_AGENT_COMPLETE, {}, {
        cwd: roomDir,
        env: { MINDRIAN_ROOMS_HOME: scratch },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_SUBAGENT_STOP, 'SubagentStop');
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();
}

function runOnTaskCompleteScenarios() {
  // TaskCompleted: NO hookSpecificOutput. Allowed keys subset of
  // {continue, stopReason, suppressOutput, systemMessage, decision, reason}.

  // ----- silent path (no room) -----
  (function silentNoRoom() {
    const scenarioName = 'on-task-complete silent-no-room';
    const label = 'on-task-complete: silent on no-room';
    const scratch = makeScratchDir('tc-silent');
    try {
      const { stdout, status } = runBashHook(ON_TASK_COMPLETE, {}, {
        cwd: scratch,
        env: { MINDRIAN_ROOMS_HOME: scratch },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_TASK_COMPLETED, null);
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();

  // ----- summary path (active room with venture_stage frontmatter) -----
  (function summaryPath() {
    const scenarioName = 'on-task-complete summary-path';
    const label = 'on-task-complete: summary path (active room)';
    const scratch = makeScratchDir('tc-summary');
    try {
      const { roomDir } = makeStrategy0Room(scratch);
      // STATE.md with venture_stage so the readiness signal block fires.
      fs.writeFileSync(path.join(roomDir, 'STATE.md'),
        '---\nventure_stage: Pre-Opportunity\n---\n# state\n');
      const { stdout, status } = runBashHook(ON_TASK_COMPLETE, {}, {
        cwd: roomDir,
        env: {
          MINDRIAN_ROOMS_HOME: scratch,
          CLAUDE_PLUGIN_ROOT: REPO,
        },
      });
      assert.equal(status, 0, label + ': hook must exit 0');
      // TaskCompleted: no hookSpecificOutput. Pass null.
      assertEnvelopeShapePerEvent(stdout, label, ALLOWED_TASK_COMPLETED, null);
      ok(label);
    } catch (e) {
      failNamed(scenarioName, e);
    } finally {
      rmrf(scratch);
    }
  })();
}

// ---------- Drive all scenarios ----------

runFrontmatterValidatorScenarios();
runAsyncAutoCommitScenarios();
runQueryEfficiencyTelemetryFence();

// Phase 95-04: per-event bash hook scenarios.
runPreCompactScenarios();
runPostCompactScenarios();
runOnFileChangedScenarios();
runOnCwdChangedScenarios();
runOnAgentCompleteScenarios();
runOnTaskCompleteScenarios();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write('PostToolUse hook envelope shape: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
