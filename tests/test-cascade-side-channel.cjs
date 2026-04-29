#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95-02 -- regression fence for bash post-write envelope shape +
 * cascade side-channel atomic write. Tests against scripts/post-write
 * (bash). Soft-fail invariant: hook always exits 0.
 *
 * Background:
 *   v1.11.2 (Phase 94) patched the two .cjs PostToolUse hooks. The bash
 *   post-write hook was intentionally deferred to Phase 95. This test
 *   gates the bash equivalent: stdout MUST be a Claude Code 2.x compliant
 *   PostToolUse envelope, and the cascade payload MUST move to a LOCAL
 *   side-channel file at <roomDir>/.mindrian/last-cascade.json (atomic
 *   mktemp + mv pattern; same-filesystem rename(2) invariant).
 *
 *   Allowed PostToolUse top-level keys (per docs.claude.com/docs/en/hooks):
 *     continue, stopReason, suppressOutput, systemMessage, decision, reason,
 *     hookSpecificOutput.
 *
 *   Canonical advisory shape:
 *     { "hookSpecificOutput": { "hookEventName": "PostToolUse",
 *                               "additionalContext": "<one-line string>" } }
 *
 *   Trigger format invariant: if hookSpecificOutput.additionalContext is
 *   present, it MUST start with one of the two recognized prefixes
 *   ("post-write: cascade complete " or "queued MINTO regen for ") so the
 *   skills/room-proactive/SKILL.md trigger contract (Plan 95-03) keys
 *   reliably off these strings.
 *
 * Scenarios (5):
 *   1. silent path (file outside any room) -- stdout empty OR valid envelope.
 *   2. message path inside room -- envelope-shape valid (top-level keys
 *      subset; additionalContext NOT at root; hookSpecificOutput.hookEventName
 *      === "PostToolUse"; additionalContext matches recognized prefix).
 *   3. side-channel file written atomically -- <roomDir>/.mindrian/last-
 *      cascade.json exists, parses, contains required keys (timestamp,
 *      file_path, section, cascade_status, classification, git_commit,
 *      graph_index, proactive_intelligence), timestamp matches ISO 8601.
 *   4. trigger string format invariant -- additionalContext (if present)
 *      MUST start with one of the two recognized prefixes.
 *   5. silent path emits zero or valid bytes -- file path with no room walk
 *      hit; assert exit 0 + envelope-shape passes.
 *
 * All scenarios use helpers cloned from tests/test-hook-envelope-shape.cjs
 * so the tests stay independent of changes elsewhere. The runHook variant
 * here uses spawnSync('bash', [scriptPath]) instead of node.
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

// Recognized additionalContext prefixes that the SKILL.md trigger contract
// (Plan 95-03) keys off. Either prefix is acceptable.
const TRIGGER_PREFIXES = [
  'post-write: cascade complete ',
  'queued MINTO regen for ',
];

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
  const base = path.join(
    os.tmpdir(),
    'mos-cascade-side-channel-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function makeRoomRoot(scratch) {
  // Phase 95-02 contract: room must have BOTH the .room-root sentinel
  // (Phase 87-01a) for detect_room_section() AND a STATE.md at the room
  // root for the cascade walk-up at scripts/post-write lines 152-159.
  // Section directory is required by Decision #16 (nested structure) so
  // the post-write 88-04 triple-fire detects a real section.
  //
  // Scratch layout (matches Strategy 0 of scripts/resolve-room):
  //
  //   <scratch>/                    <- ROOMS_HOME
  //     .rooms/registry.json        <- declares "test-room" as active
  //     test-room/                  <- the room (= roomDir)
  //       .room-root
  //       STATE.md
  //       problem-definition/      <- the section (= sectionDir)
  //
  // The runBashHook caller sets env.MINDRIAN_ROOMS_HOME = scratch so
  // scripts/resolve-room resolves to roomDir and the post-write active-
  // room guard at lines 132-138 lets the cascade through.
  const roomName = 'test-room';
  const roomDir = path.join(scratch, roomName);
  const sectionDir = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# Test room state\n');

  // Central registry (Strategy 0 in scripts/resolve-room). The path is a
  // relative slug under ROOMS_HOME; resolve-room joins it and verifies
  // it is a directory before returning the absolute path.
  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registry = {
    active: roomName,
    rooms: {
      [roomName]: { path: roomName },
    },
  };
  fs.writeFileSync(
    path.join(registryDir, 'registry.json'),
    JSON.stringify(registry, null, 2)
  );

  return { scratch, roomDir, sectionDir };
}

function makeOutsideRoom(scratch) {
  // No .room-root sentinel anywhere up the tree. No STATE.md walk hit.
  const dir = path.join(scratch, 'noroom');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

// Run the bash post-write hook with a synthetic PostToolUse envelope on
// stdin. Returns { stdout, stderr, status }. Captures only stdout because
// hooks are advisory and soft-fail to stderr.
//
// Note: MINDRIAN_ROOMS_HOME is honored by scripts/resolve-room. When we
// point it at the scratch dir, the post-write active-room guard sees our
// synthetic room as the active room and fires the cascade. Without this,
// resolve-room returns the user's real active room and the active-room
// guard silently exits before the cascade block, breaking the side-
// channel scenarios.
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
  const trimmed = stdout.trim();
  if (trimmed === '') return; // silent path

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

  for (const k of Object.keys(payload)) {
    if (!ALLOWED_TOP_LEVEL.has(k)) {
      throw new Error(
        label + ': disallowed top-level key "' + k + '". stdout=' + trimmed
      );
    }
  }

  assert.equal(
    Object.prototype.hasOwnProperty.call(payload, 'additionalContext'),
    false,
    label + ': "additionalContext" must NOT be a top-level key (must live inside hookSpecificOutput)'
  );

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

// Assert that if hookSpecificOutput.additionalContext is present, it
// matches one of the two recognized trigger prefixes.
function assertTriggerPrefix(stdout, label) {
  const trimmed = stdout.trim();
  if (trimmed === '') return; // silent path -- nothing to assert
  let payload;
  try {
    payload = JSON.parse(trimmed);
  } catch (_e) {
    return; // shape errors caught by assertEnvelopeShape
  }
  if (!payload || typeof payload !== 'object') return;
  const hso = payload.hookSpecificOutput;
  if (!hso || typeof hso !== 'object') return;
  const ctx = hso.additionalContext;
  if (typeof ctx !== 'string') return;
  const matched = TRIGGER_PREFIXES.some((p) => ctx.startsWith(p));
  if (!matched) {
    throw new Error(
      label + ': hookSpecificOutput.additionalContext must start with one of [' +
        TRIGGER_PREFIXES.map(JSON.stringify).join(', ') +
        ']. Got: ' + JSON.stringify(ctx)
    );
  }
}

// ---------- Scenarios ----------

const POST_WRITE = path.join(REPO, 'scripts', 'post-write');

(function test1_silentPathOutsideRoom() {
  const label = 'post-write: silent path (file outside room)';
  const scratch = makeScratchDir('silent-outside');
  try {
    const outsideDir = makeOutsideRoom(scratch);
    const target = path.join(outsideDir, 'plain.md');
    fs.writeFileSync(target, '# Plain\n');
    const envelope = {
      tool_name: 'Write',
      tool_input: { file_path: target },
    };
    const { stdout, status } = runBashHook(POST_WRITE, envelope);
    assert.equal(status, 0, label + ': hook must exit 0');
    // Tolerate empty OR valid envelope (post-write may emit cascade-status
    // for system-file writes outside room sections per 88-04 logic).
    assertEnvelopeShape(stdout, label);
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test2_messagePathInsideRoomEnvelopeShape() {
  const label = 'post-write: message path inside room - envelope-shape valid';
  const scratch = makeScratchDir('msg-shape');
  try {
    const { sectionDir } = makeRoomRoot(scratch);
    // Decision #16 nested-structure rule: artifact lives inside its own
    // named folder under the section.
    const artifactDir = path.join(sectionDir, 'test-artifact');
    fs.mkdirSync(artifactDir, { recursive: true });
    const target = path.join(artifactDir, 'test-artifact.md');
    fs.writeFileSync(target, '---\nname: test-artifact\n---\n# Body\n');

    const envelope = {
      tool_name: 'Write',
      tool_input: { file_path: target },
    };
    const { stdout, status } = runBashHook(POST_WRITE, envelope, {
      env: { MINDRIAN_ROOMS_HOME: scratch },
    });
    assert.equal(status, 0, label + ': hook must exit 0');
    // After Plan 95-02 GREEN: the message path emits a JSON object with
    // allowed top-level keys only. The cascade fires (active-room guard
    // honored MINDRIAN_ROOMS_HOME -> scratch) so stdout MUST be non-empty
    // and MUST be a valid envelope.
    const trimmed = stdout.trim();
    assert.notEqual(trimmed, '',
      label + ': cascade fired -> stdout must be non-empty. Got: ' + JSON.stringify(stdout));
    assertEnvelopeShape(stdout, label);
    const payload = JSON.parse(trimmed);
    assert.equal(
      Object.prototype.hasOwnProperty.call(payload, 'hookSpecificOutput'),
      true,
      label + ': message path must emit hookSpecificOutput'
    );
    const hso = payload.hookSpecificOutput;
    assert.equal(hso.hookEventName, 'PostToolUse',
      label + ': hookEventName must equal "PostToolUse"');
    assert.equal(typeof hso.additionalContext, 'string',
      label + ': additionalContext must be a string');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test3_sideChannelFileWrittenAtomically() {
  const label = 'post-write: side-channel file written atomically';
  const scratch = makeScratchDir('side-channel');
  try {
    const { roomDir, sectionDir } = makeRoomRoot(scratch);
    const artifactDir = path.join(sectionDir, 'side-channel-artifact');
    fs.mkdirSync(artifactDir, { recursive: true });
    const target = path.join(artifactDir, 'side-channel-artifact.md');
    fs.writeFileSync(target, '---\nname: side-channel-artifact\n---\n# Body\n');

    const envelope = {
      tool_name: 'Write',
      tool_input: { file_path: target },
    };
    const { status } = runBashHook(POST_WRITE, envelope, {
      env: { MINDRIAN_ROOMS_HOME: scratch },
    });
    assert.equal(status, 0, label + ': hook must exit 0');

    // After Plan 95-02 GREEN: <roomDir>/.mindrian/last-cascade.json exists.
    const sideChannel = path.join(roomDir, '.mindrian', 'last-cascade.json');
    assert.equal(fs.existsSync(sideChannel), true,
      label + ': side-channel file must exist at ' + sideChannel);

    const raw = fs.readFileSync(sideChannel, 'utf8');
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      throw new Error(label + ': side-channel file must be valid JSON. Got: ' + raw);
    }
    assert.equal(typeof payload, 'object',
      label + ': side-channel JSON must be an object');
    assert.notEqual(payload, null,
      label + ': side-channel JSON must not be null');

    // Required keys per 95-02 contract.
    const requiredKeys = [
      'timestamp',
      'file_path',
      'section',
      'cascade_status',
      'classification',
      'git_commit',
      'graph_index',
      'proactive_intelligence',
    ];
    for (const k of requiredKeys) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(payload, k),
        true,
        label + ': side-channel JSON missing required key "' + k + '"'
      );
    }

    // cascade_status === "complete"
    assert.equal(payload.cascade_status, 'complete',
      label + ': cascade_status must be "complete"');

    // ISO 8601 timestamp shape.
    const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    assert.equal(isoRe.test(payload.timestamp), true,
      label + ': timestamp must match ISO 8601 (YYYY-MM-DDTHH:MM:SSZ). Got: ' +
        JSON.stringify(payload.timestamp));

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test4_triggerStringFormatInvariant() {
  const label = 'post-write: trigger string format invariant';
  const scratch = makeScratchDir('trigger-prefix');
  try {
    const { sectionDir } = makeRoomRoot(scratch);
    const artifactDir = path.join(sectionDir, 'trigger-artifact');
    fs.mkdirSync(artifactDir, { recursive: true });
    const target = path.join(artifactDir, 'trigger-artifact.md');
    fs.writeFileSync(target, '---\nname: trigger-artifact\n---\n# Body\n');

    const envelope = {
      tool_name: 'Write',
      tool_input: { file_path: target },
    };
    const { stdout, status } = runBashHook(POST_WRITE, envelope, {
      env: { MINDRIAN_ROOMS_HOME: scratch },
    });
    assert.equal(status, 0, label + ': hook must exit 0');
    // Cascade fires -> stdout MUST carry an envelope. Envelope shape AND
    // trigger prefix must both be valid.
    const trimmed = stdout.trim();
    assert.notEqual(trimmed, '',
      label + ': cascade fired -> stdout must be non-empty');
    assertEnvelopeShape(stdout, label);
    assertTriggerPrefix(stdout, label);
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test5_silentPathEmitsZeroOrValidBytes() {
  const label = 'post-write: silent path emits zero or valid bytes';
  try {
    // file_path is /tmp/nonexistent-<ts>.md. No .room-root walk hit, no
    // STATE.md walk hit. The hook should silent-exit OR emit an envelope.
    const ts = Date.now().toString(36);
    const target = path.join(os.tmpdir(), 'nonexistent-' + ts + '.md');
    const envelope = {
      tool_name: 'Write',
      tool_input: { file_path: target },
    };
    const { stdout, status } = runBashHook(POST_WRITE, envelope);
    assert.equal(status, 0, label + ': hook must exit 0');
    assertEnvelopeShape(stdout, label);
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'bash post-write envelope + side-channel: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
