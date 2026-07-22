#!/usr/bin/env node
'use strict';

/**
 * RCA Change 1 (registry-active-room-concurrent-session-collision):
 *
 * room_bind's handler (lib/mcp/tool-router.cjs) computed
 * `effectiveSessionId = sessionId || extra.sessionId || null` and hard-failed
 * with { ok:false, reason:'no_session_id' } whenever both were absent. On
 * stdio (the local Claude Code CLI transport), extra.sessionId is NEVER
 * populated, so writeSessionBinding -- the only function that ever sets
 * session.primary -- was architecturally unreachable for every CLI session.
 * Every CLI write-target resolution therefore fell through to the single,
 * unlocked, machine-wide registry.json `active` field, which concurrent CLI
 * sessions on the same machine then raced to overwrite.
 *
 * The fix adds process.env.CLAUDE_CODE_SESSION_ID as a THIRD-priority
 * fallback (mirroring the F-01 precedent in scripts/write-scope-check.cjs,
 * commit 0bec81b9): explicit sessionId param > extra.sessionId (SDK,
 * non-stdio) > CLAUDE_CODE_SESSION_ID env (stdio) > no_session_id.
 *
 * Legs:
 *   1. FIX: no explicit sessionId, extra.sessionId undefined (the stdio
 *      shape), CLAUDE_CODE_SESSION_ID set -> room_bind does NOT return
 *      no_session_id and DOES write a session.primary binding, keyed by the
 *      env-derived id (confirmed by reading the binding back via
 *      readSessionBinding, not just trusting the JSON response).
 *   2. REGRESSION GUARD: a fully-empty environment (no explicit sessionId, no
 *      extra.sessionId, no CLAUDE_CODE_SESSION_ID at all) must still return
 *      no_session_id -- the env fallback must not turn into a silent
 *      always-succeed.
 *   3. PRECEDENCE: when both extra.sessionId AND CLAUDE_CODE_SESSION_ID are
 *      present, extra.sessionId (the SDK-supplied id) wins -- the env
 *      fallback must not shadow a real SDK-populated session id.
 *   4. F.8 NON-REGRESSION: the ambiguity signal (needs_binding_card:true) is
 *      untouched by this change -- it still fires when no explicit room and
 *      no cwd `.room-root` are present, even when the session id was
 *      resolved via the new env fallback.
 *
 * Node built-in assert only. No test framework. CJS only. No em-dashes.
 * process.env.CLAUDE_CODE_SESSION_ID is saved/restored around every leg that
 * touches it (mirrors tests/test-226-session-binding-key-alignment.cjs style).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const router = require(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
const { readSessionBinding } = require(
  path.join(PLUGIN_ROOT, 'lib', 'core', 'session-binding.cjs')
);

let failed = 0;
async function checkAsync(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}

// room_bind's success responses append a "## Suggested Next" block after the
// JSON payload (formatSuggestedNext). Parse only the leading JSON object.
function parseResponseJson(res) {
  const text = res && res.content && res.content[0] && res.content[0].text;
  assert.ok(text, 'room_bind must return a text response');
  const marker = text.indexOf('\n\n## Suggested Next');
  const jsonText = marker === -1 ? text : text.slice(0, marker);
  return JSON.parse(jsonText);
}

// A fake McpServer that captures each registered tool handler by name so the
// test can invoke room_bind directly (mirrors
// tests/test-tool-router-active-room-misroute.cjs's makeFakeServer).
function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _desc, _schema, handler) { tools[name] = handler; },
  };
}

async function run() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-bind-fallback-'));
  const roomDir = path.join(tmpHome, 'a-room');
  fs.mkdirSync(roomDir, { recursive: true });

  // Save/restore the env vars this test touches, so it never leaks state into
  // any other test process run in the same suite. MINDRIAN_ROOMS_HOME is
  // pinned to tmpHome because writeSessionBinding/readSessionBinding resolve
  // their home from this env var (or os.homedir()/MindrianRooms) when no
  // explicit opts.home is passed -- exactly how room_bind's handler calls it.
  const savedEnv = process.env.CLAUDE_CODE_SESSION_ID;
  const savedHome = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = tmpHome;

  const server = makeFakeServer();
  router.registerRouterTools(server, roomDir, PLUGIN_ROOT, { compact: '' });
  assert.strictEqual(typeof server.tools.room_bind, 'function',
    'room_bind handler must be registered');

  try {
    // -------------------------------------------------------------------
    // Leg 1 FIX: stdio shape (no explicit sessionId, extra.sessionId
    // undefined) + CLAUDE_CODE_SESSION_ID set -> NOT no_session_id, and the
    // binding actually lands on disk.
    // -------------------------------------------------------------------
    await checkAsync('stdio fallback: CLAUDE_CODE_SESSION_ID is used when extra.sessionId is absent', async () => {
      delete process.env.CLAUDE_CODE_SESSION_ID;
      const envSessionId = 'env-fallback-session-11112222';
      process.env.CLAUDE_CODE_SESSION_ID = envSessionId;

      const res = await server.tools.room_bind({ room: 'a-room' }, {});
      const parsed = parseResponseJson(res);

      assert.notStrictEqual(parsed.reason, 'no_session_id',
        'must NOT fail with no_session_id when CLAUDE_CODE_SESSION_ID is set');
      assert.strictEqual(parsed.ok, true, 'expected ok:true');
      assert.strictEqual(parsed.bound, true, 'expected bound:true for an explicit room');

      // Confirm the binding actually landed, keyed by the env-derived id --
      // not just trusting the JSON response shape.
      const binding = readSessionBinding(envSessionId, { home: tmpHome });
      assert.strictEqual(binding.primary, 'a-room',
        'session.primary must be written under the CLAUDE_CODE_SESSION_ID-derived key');
      assert.ok(binding.bound.indexOf('a-room') !== -1,
        'the bound set must include the room');
    });

    // -------------------------------------------------------------------
    // Leg 2 REGRESSION GUARD: fully-empty environment must still fail
    // closed with no_session_id (no explicit sessionId, no extra.sessionId,
    // no CLAUDE_CODE_SESSION_ID at all).
    // -------------------------------------------------------------------
    await checkAsync('fully-empty environment still returns no_session_id', async () => {
      delete process.env.CLAUDE_CODE_SESSION_ID;
      const res = await server.tools.room_bind({ room: 'a-room' }, {});
      const parsed = parseResponseJson(res);
      assert.strictEqual(parsed.ok, false, 'expected ok:false');
      assert.strictEqual(parsed.reason, 'no_session_id',
        'a fully-empty environment must still fail closed with no_session_id');
    });

    // -------------------------------------------------------------------
    // Leg 3 PRECEDENCE: extra.sessionId (SDK) wins over the env fallback
    // when both are present.
    // -------------------------------------------------------------------
    await checkAsync('extra.sessionId (SDK) wins over CLAUDE_CODE_SESSION_ID when both are present', async () => {
      const envSessionId = 'env-should-lose-33334444';
      const sdkSessionId = 'sdk-should-win-55556666';
      process.env.CLAUDE_CODE_SESSION_ID = envSessionId;

      const res = await server.tools.room_bind({ room: 'a-room' }, { sessionId: sdkSessionId });
      const parsed = parseResponseJson(res);
      assert.strictEqual(parsed.ok, true, 'expected ok:true');

      const sdkBinding = readSessionBinding(sdkSessionId, { home: tmpHome });
      assert.strictEqual(sdkBinding.primary, 'a-room',
        'the SDK-supplied sessionId must be the one bound, not the env fallback');

      const envBinding = readSessionBinding(envSessionId, { home: tmpHome });
      assert.strictEqual(envBinding.primary, null,
        'the env-derived id must NOT receive a binding when extra.sessionId was present');

      delete process.env.CLAUDE_CODE_SESSION_ID;
    });

    // -------------------------------------------------------------------
    // Leg 4 F.8 NON-REGRESSION: the ambiguity signal still fires (no
    // explicit room, no cwd .room-root) even when the session id came from
    // the new env fallback -- this change must not touch that logic.
    // -------------------------------------------------------------------
    await checkAsync('needs_binding_card still fires on genuine ambiguity, env-resolved session id or not', async () => {
      const envSessionId = 'env-ambiguous-77778888';
      process.env.CLAUDE_CODE_SESSION_ID = envSessionId;

      // No `room` arg. cwd (process.cwd() at test-run time) is not expected to
      // carry a .room-root sentinel above it, so this should fall through to
      // the ambiguity signal exactly as before.
      const res = await server.tools.room_bind({}, {});
      const parsed = parseResponseJson(res);

      assert.notStrictEqual(parsed.reason, 'no_session_id',
        'the env fallback must still resolve a session id here (this is NOT the no_session_id case)');
      // Either the ambiguity signal fires, or (if this checkout happens to sit
      // under a .room-root sentinel) a cwd auto-bind succeeds -- both are
      // valid pre-existing behaviors this change must not disturb. Only
      // no_session_id or an exception would indicate a regression.
      assert.ok(parsed.needs_binding_card === true || parsed.source === 'cwd',
        'expected either needs_binding_card:true or a cwd auto-bind, got: ' + JSON.stringify(parsed));

      delete process.env.CLAUDE_CODE_SESSION_ID;
    });
  } finally {
    if (savedEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = savedEnv;
    if (savedHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = savedHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }

  process.stdout.write('\nroom-bind-stdio-session-fallback: ' +
    (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
