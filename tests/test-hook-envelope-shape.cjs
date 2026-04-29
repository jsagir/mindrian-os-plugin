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

// ---------- Drive all scenarios ----------

runFrontmatterValidatorScenarios();
runAsyncAutoCommitScenarios();
runQueryEfficiencyTelemetryFence();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write('PostToolUse hook envelope shape: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
