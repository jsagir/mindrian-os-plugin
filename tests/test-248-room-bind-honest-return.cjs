#!/usr/bin/env node
'use strict';

/*
 * Phase 248-02 Task 1 -- the honest room_bind return (the return half of
 * CTX-02).
 * =============================================================================
 * After 248-01, the binding actually applies on the READ side, but room_bind
 * itself still returns an unconditional {ok:true, bound:true} even when the
 * bound slug has no directory on disk (writeSessionBinding accepts any
 * traversal-safe slug; the core registryRoomPath existsSync gate then fails
 * leg A and reads fall through to reg.active). This test proves the fix: a
 * post-write round-trip through the SAME shared resolver
 * (lib/mcp/session-room.cjs resolveMcpSessionRoom), reported honestly.
 *
 * Hermetic fixture, cloned from tests/test-248-room-bind-session-authoritative.cjs
 * (tmp MINDRIAN_ROOMS_HOME; MINDRIAN_MCP_FIRST + CLAUDE_ACTIVE_ROOM cleared;
 * registry.json {active: 'room-c', rooms: {room-c, room-x, room-y}}; room-c/
 * room-x/room-y real dirs on disk). Drives room_bind through the same
 * in-process fake-server seam tests/test-room-bind-stdio-session-fallback.cjs
 * uses -- sessionId is passed EXPLICITLY as a call argument (the handler's
 * own top precedence tier), so no env-var juggling is needed per test.
 *
 * Test 1 (honest success): bind room-x with s1 -> ok:true, bound:true,
 *   primary:'room-x', effective:true, resolved_dir === room-x abs path,
 *   resolved_source:'session.primary', no reason field.
 * Test 2 (the lie is dead): bind 'no-such-room' (safe slug, no dir on disk)
 *   with s2 -> ok:true, bound:true (the write DID happen) BUT effective:false,
 *   reason:'room_not_on_disk', resolved_dir === room-c (what reads will
 *   actually use, via reg.active), resolved_source:'reg.active'.
 * Test 3 (two-bind sequence, the 2026-07-29 repro): s3 binds room-x then
 *   room-y -> second response effective:true with resolved_dir === room-y;
 *   a subsequent read through session-room.cjs with s3 resolves room-y, not
 *   the first bind's remnant.
 * Test 4 (two-session isolation): s4 binds room-x, s5 binds room-y -> each
 *   session's round-trip AND subsequent reads resolve its OWN room.
 * Test 5 (rejected write-through cannot regress in): after all binds,
 *   registry.json `active` still equals 'room-c' byte-identically.
 * Test 6 (ambiguity branch untouched): no room arg, no .room-root above cwd,
 *   sessionId s6 -> {ok:true, bound:false, needs_binding_card:true} EXACTLY
 *   as before (no new fields on this branch).
 *
 * Node built-in assert only. No test framework. CJS only. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('  ok -', label);
  } else {
    fail += 1;
    console.log('  FAIL -', label, detail !== undefined ? '(' + detail + ')' : '');
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
// tests/test-room-bind-stdio-session-fallback.cjs's makeFakeServer).
function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _desc, _schema, handler) { tools[name] = handler; },
  };
}

const SAVED = {
  MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME,
  MINDRIAN_MCP_FIRST: process.env.MINDRIAN_MCP_FIRST,
  CLAUDE_ACTIVE_ROOM: process.env.CLAUDE_ACTIVE_ROOM,
  CLAUDE_CODE_SESSION_ID: process.env.CLAUDE_CODE_SESSION_ID,
};
function restoreEnv() {
  for (const k of Object.keys(SAVED)) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
}

async function main() {
  console.log('test-248-room-bind-honest-return (CTX-02 honest room_bind return)');

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sr248-honest-'));
  const roomC = path.join(home, 'room-c');
  const roomX = path.join(home, 'room-x');
  const roomY = path.join(home, 'room-y');
  fs.mkdirSync(roomC, { recursive: true });
  fs.mkdirSync(roomX, { recursive: true });
  fs.mkdirSync(roomY, { recursive: true });
  const registryDir = path.join(home, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registryPath = path.join(registryDir, 'registry.json');
  const registryContentsOriginal = JSON.stringify({
    active: 'room-c',
    rooms: {
      'room-c': { slug: 'room-c', abs_path: roomC },
      'room-x': { slug: 'room-x', abs_path: roomX },
      'room-y': { slug: 'room-y', abs_path: roomY },
    },
  }, null, 2);
  fs.writeFileSync(registryPath, registryContentsOriginal);
  const fallback = path.join(home, 'boot-fallback-dir');
  fs.mkdirSync(fallback, { recursive: true });

  delete process.env.MINDRIAN_MCP_FIRST;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  process.env.MINDRIAN_ROOMS_HOME = home;

  try {
    delete require.cache[require.resolve(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'))];
    delete require.cache[require.resolve(path.join(REPO_ROOT, 'lib', 'mcp', 'session-room.cjs'))];
    const toolRouter = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
    const sessionRoom = require(path.join(REPO_ROOT, 'lib', 'mcp', 'session-room.cjs'));

    const server = makeFakeServer();
    toolRouter.registerRouterTools(server, fallback, REPO_ROOT, { compact: '' }, 'cli');
    assert.strictEqual(typeof server.tools.room_bind, 'function', 'room_bind handler must be registered');

    // -------------------------------------------------------------------
    // Test 1: honest success -- bind room-x with s1.
    // -------------------------------------------------------------------
    {
      const res = await server.tools.room_bind({ room: 'room-x', sessionId: 's1' }, {});
      const parsed = parseResponseJson(res);
      check('Test 1: ok:true', parsed.ok === true, JSON.stringify(parsed));
      check('Test 1: bound:true', parsed.bound === true, JSON.stringify(parsed));
      check('Test 1: primary:room-x', parsed.primary === 'room-x', JSON.stringify(parsed));
      check('Test 1: effective:true', parsed.effective === true, JSON.stringify(parsed));
      check('Test 1: resolved_dir === room-x abs path', parsed.resolved_dir === roomX, 'got ' + parsed.resolved_dir);
      check('Test 1: resolved_source === session.primary', parsed.resolved_source === 'session.primary', 'got ' + parsed.resolved_source);
      check('Test 1: no reason field', !Object.prototype.hasOwnProperty.call(parsed, 'reason'), JSON.stringify(parsed));
    }

    // -------------------------------------------------------------------
    // Test 2: the lie is dead -- bind 'no-such-room' (safe slug, no dir on
    // disk) with s2.
    // -------------------------------------------------------------------
    {
      const res = await server.tools.room_bind({ room: 'no-such-room', sessionId: 's2' }, {});
      const parsed = parseResponseJson(res);
      check('Test 2: ok:true (write attempted)', parsed.ok === true, JSON.stringify(parsed));
      check('Test 2: bound:true (the write DID happen)', parsed.bound === true, JSON.stringify(parsed));
      check('Test 2: effective:false', parsed.effective === false, JSON.stringify(parsed));
      check('Test 2: reason:room_not_on_disk', parsed.reason === 'room_not_on_disk', JSON.stringify(parsed));
      check('Test 2: resolved_dir === room-c (reg.active, what reads will actually use)', parsed.resolved_dir === roomC, 'got ' + parsed.resolved_dir);
      check('Test 2: resolved_source === reg.active', parsed.resolved_source === 'reg.active', 'got ' + parsed.resolved_source);
    }

    // -------------------------------------------------------------------
    // Test 3: two-bind sequence (the 2026-07-29 first-bind-remnant repro).
    // -------------------------------------------------------------------
    {
      const res1 = await server.tools.room_bind({ room: 'room-x', sessionId: 's3' }, {});
      const parsed1 = parseResponseJson(res1);
      check('Test 3a: first bind (room-x) effective:true', parsed1.effective === true, JSON.stringify(parsed1));

      const res2 = await server.tools.room_bind({ room: 'room-y', sessionId: 's3' }, {});
      const parsed2 = parseResponseJson(res2);
      check('Test 3b: second bind (room-y) effective:true', parsed2.effective === true, JSON.stringify(parsed2));
      check('Test 3c: second bind resolved_dir === room-y', parsed2.resolved_dir === roomY, 'got ' + parsed2.resolved_dir);

      const read = sessionRoom.resolveMcpSessionRoom({ sessionId: 's3', ctx: { fallbackRoomDir: fallback, surface: 'cli' } });
      check('Test 3d: subsequent read resolves room-y, not the first bind remnant', read.dir === roomY, 'got ' + read.dir);
    }

    // -------------------------------------------------------------------
    // Test 4: two-session isolation.
    // -------------------------------------------------------------------
    {
      const resS4 = await server.tools.room_bind({ room: 'room-x', sessionId: 's4' }, {});
      const parsedS4 = parseResponseJson(resS4);
      const resS5 = await server.tools.room_bind({ room: 'room-y', sessionId: 's5' }, {});
      const parsedS5 = parseResponseJson(resS5);

      check('Test 4a: s4 round-trip resolves room-x', parsedS4.resolved_dir === roomX, 'got ' + parsedS4.resolved_dir);
      check('Test 4b: s5 round-trip resolves room-y', parsedS5.resolved_dir === roomY, 'got ' + parsedS5.resolved_dir);

      const readS4 = sessionRoom.resolveMcpSessionRoom({ sessionId: 's4', ctx: { fallbackRoomDir: fallback, surface: 'cli' } });
      const readS5 = sessionRoom.resolveMcpSessionRoom({ sessionId: 's5', ctx: { fallbackRoomDir: fallback, surface: 'cli' } });
      check('Test 4c: s4 subsequent read resolves its OWN room (room-x)', readS4.dir === roomX, 'got ' + readS4.dir);
      check('Test 4d: s5 subsequent read resolves its OWN room (room-y)', readS5.dir === roomY, 'got ' + readS5.dir);
    }

    // -------------------------------------------------------------------
    // Test 5: the rejected write-through cannot regress in -- registry.json
    // `active` still equals 'room-c' byte-identically after all binds above.
    // -------------------------------------------------------------------
    {
      const registryContentsAfter = fs.readFileSync(registryPath, 'utf8');
      check('Test 5: registry.json byte-identical after all binds (no write-through)', registryContentsAfter === registryContentsOriginal, 'registry.json was modified by room_bind');
      const parsedRegistry = JSON.parse(registryContentsAfter);
      check('Test 5b: registry active still room-c', parsedRegistry.active === 'room-c', 'got ' + parsedRegistry.active);
    }

    // -------------------------------------------------------------------
    // Test 6: ambiguity branch untouched -- no room arg, no .room-root above
    // cwd (confirmed at plan time: no .room-root sentinel in this repo's
    // ancestor chain).
    // -------------------------------------------------------------------
    {
      const res = await server.tools.room_bind({ sessionId: 's6' }, {});
      const parsed = parseResponseJson(res);
      check('Test 6a: ok:true', parsed.ok === true, JSON.stringify(parsed));
      check('Test 6b: bound:false', parsed.bound === false, JSON.stringify(parsed));
      check('Test 6c: needs_binding_card:true', parsed.needs_binding_card === true, JSON.stringify(parsed));
      const keys = Object.keys(parsed).sort();
      check('Test 6d: exactly the pre-existing shape, no new fields', keys.length === 3
        && keys.indexOf('ok') !== -1 && keys.indexOf('bound') !== -1 && keys.indexOf('needs_binding_card') !== -1,
        'got keys ' + JSON.stringify(keys));
    }

    console.log('');
    console.log('---');
    console.log(pass + '/' + (pass + fail) + ' green');
    process.exitCode = fail === 0 ? 0 : 1;
  } finally {
    restoreEnv();
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

main();
