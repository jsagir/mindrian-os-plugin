#!/usr/bin/env node
'use strict';

/**
 * Merge-time regression (intern-w1-room-state-false-empty, merge-time finding
 * 2026-07-11/12):
 *
 * The intern-w1-room-state-false-empty fix's original call site passed only
 * `roomDir` to resolveWriteTargetDir -- the resolver's pre-Phase-198-02 1-arg
 * form. Main's signature had already changed to (sessionId, fallbackRoomDir,
 * surface) by the time this fix merged, so the positional roomDir silently
 * landed in the `sessionId` parameter, leaving `fallbackRoomDir` undefined.
 *
 * test-room-state-active-room-misroute.cjs (the fix's OWN test) always seeds
 * a `.rooms/registry.json` with an active room, so resolveActiveRoom() never
 * returns null there and the missing fallback argument never gets exercised.
 * This test covers the other, more common branch: NO registry file at all
 * (Tier-0 / single-room default, "no dependencies" per this repo's own
 * Decision #8). In that shape resolveActiveRoom() returns null and
 * resolveWriteTargetDir falls through to `fallbackRoomDir` -- which must be
 * the real boot-time roomDir, not `undefined`, or path.resolve(undefined)
 * throws an uncaught TypeError inside state-ops.cjs.
 *
 * Zero test frameworks. Node built-in assert only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const router = require(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'tool-router.cjs'));

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

function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _desc, _schema, handler) { tools[name] = handler; },
  };
}

async function run() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-state-noreg-'));
  const roomOnly = path.join(tmpHome, 'room');
  fs.mkdirSync(roomOnly, { recursive: true });
  fs.writeFileSync(
    path.join(roomOnly, 'STATE.md'),
    '# Data Room State\n\ntotal_entries: 3\nmarker: NO-REGISTRY-REAL-CONTENT\n'
  );

  // Deliberately NO .rooms/ directory, NO registry.json -- the Tier-0 default
  // this repo's own Decision #8 promises stays fully functional with zero
  // dependencies. resolveActiveRoom() must return null here, never throw.
  const savedHome = process.env.MINDRIAN_ROOMS_HOME;
  const savedActive = process.env.CLAUDE_ACTIVE_ROOM;
  const savedMcpFirst = process.env.MINDRIAN_MCP_FIRST;
  process.env.MINDRIAN_ROOMS_HOME = tmpHome;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.MINDRIAN_MCP_FIRST;

  try {
    const server = makeFakeServer();
    router.registerRouterTools(server, roomOnly, PLUGIN_ROOT, { compact: '' });
    assert.strictEqual(typeof server.tools.room_state, 'function',
      'room_state handler must be registered');

    await checkAsync('status against a no-registry install falls back to the boot-time room, never throws', async () => {
      // No `extra` second argument either (stdio/legacy shape) -- sessionId
      // must default safely to undefined, not throw on destructuring.
      const res = await server.tools.room_state({ command: 'status' });
      assert.ok(res && res.content && res.content[0] && typeof res.content[0].text === 'string',
        'status must return a normal text response, not throw or return undefined');
      const text = res.content[0].text;
      assert.ok(text.includes('NO-REGISTRY-REAL-CONTENT'),
        'status must surface the real boot-time room content (got: ' + text.slice(0, 200) + ')');
      assert.ok(!text.includes('No room initialized'),
        'status must NOT report false "No room initialized" when the boot-time room has content');
    });

    await checkAsync('get-state against a no-registry install falls back to the boot-time room, never throws', async () => {
      const res = await server.tools.room_state({ command: 'get-state' });
      const text = res.content[0].text;
      assert.ok(text.includes('NO-REGISTRY-REAL-CONTENT'),
        'get-state must surface the real boot-time room content (got: ' + text.slice(0, 200) + ')');
    });

    await checkAsync('status still works with an explicit extra={} (HTTP-shaped call, no sessionId)', async () => {
      const res = await server.tools.room_state({ command: 'status' }, {});
      const text = res.content[0].text;
      assert.ok(text.includes('NO-REGISTRY-REAL-CONTENT'),
        'status must surface real content even when extra is an empty object');
    });
  } finally {
    if (savedHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = savedHome;
    if (savedActive === undefined) delete process.env.CLAUDE_ACTIVE_ROOM;
    else process.env.CLAUDE_ACTIVE_ROOM = savedActive;
    if (savedMcpFirst === undefined) delete process.env.MINDRIAN_MCP_FIRST;
    else process.env.MINDRIAN_MCP_FIRST = savedMcpFirst;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }

  process.stdout.write('\nroom-state-no-registry-regression: ' +
    (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
