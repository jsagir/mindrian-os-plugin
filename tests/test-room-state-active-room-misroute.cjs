#!/usr/bin/env node
'use strict';

/**
 * Regression (intern-w1-room-state-false-empty):
 *
 * room_state's read branches (status/analyze/compute-state/get-state/
 * suggest-next) used to read the boot-time closure roomDir directly instead
 * of re-resolving the live active room per call, so a mid-session
 * `room-registry set-active` (or a room created after the MCP daemon
 * booted) never reached them and they reported a false "No room
 * initialized" against the boot-time room even when the real active room
 * had verifiable content on disk. The fix reuses resolveWriteTargetDir (the
 * same per-call resolver already proven for room_content WRITES by
 * test-tool-router-active-room-misroute.cjs) for these READS too.
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
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}

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

// A fake McpServer that captures each registered tool handler by name so the
// test can invoke room_state directly (mirrors how the SDK would dispatch).
function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _desc, _schema, handler) { tools[name] = handler; },
  };
}

async function run() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-room-state-'));
  const roomA = path.join(tmpHome, 'room-a'); // boot-time (spawn) room, no content
  const roomB = path.join(tmpHome, 'room-b'); // mid-session active room, real content
  fs.mkdirSync(roomA, { recursive: true });
  fs.mkdirSync(roomB, { recursive: true });

  // Room A: no STATE.md at all -- mirrors the reported symptom (boot-time
  // room with nothing in it). Room B: a real STATE.md with distinguishing
  // content, standing in for "a room directory that has real, verifiable
  // content on disk" per the Problem Statement.
  fs.writeFileSync(
    path.join(roomB, 'STATE.md'),
    '# Data Room State\n\ntotal_entries: 7\nmarker: ROOM-B-REAL-CONTENT\n'
  );

  const roomsDir = path.join(tmpHome, '.rooms');
  fs.mkdirSync(roomsDir, { recursive: true });
  fs.writeFileSync(path.join(roomsDir, 'registry.json'), JSON.stringify({
    active: 'room-b',
    rooms: { 'room-b': { slug: 'room-b', abs_path: roomB } },
  }), 'utf8');

  const savedHome = process.env.MINDRIAN_ROOMS_HOME;
  const savedActive = process.env.CLAUDE_ACTIVE_ROOM;
  process.env.MINDRIAN_ROOMS_HOME = tmpHome;
  delete process.env.CLAUDE_ACTIVE_ROOM; // registry leg must win, not the env override

  try {
    // Register the router with roomA as the FROZEN boot-time roomDir.
    const server = makeFakeServer();
    router.registerRouterTools(server, roomA, PLUGIN_ROOT, { compact: '' });
    assert.strictEqual(typeof server.tools.room_state, 'function',
      'room_state handler must be registered');

    await checkAsync('status reads the mid-session active room (B), not a false-empty boot room (A)', async () => {
      const res = await server.tools.room_state({ command: 'status' });
      const text = res.content[0].text;
      assert.ok(text.includes('ROOM-B-REAL-CONTENT'),
        'status must surface room B content (got: ' + text.slice(0, 200) + ')');
      assert.ok(!text.includes('No room initialized'),
        'status must NOT report false "No room initialized" when the active room has content');
    });

    await checkAsync('get-state reads the mid-session active room (B), not boot room (A)', async () => {
      const res = await server.tools.room_state({ command: 'get-state' });
      const text = res.content[0].text;
      assert.ok(text.includes('ROOM-B-REAL-CONTENT'),
        'get-state must surface room B content (got: ' + text.slice(0, 200) + ')');
    });
  } finally {
    if (savedHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = savedHome;
    if (savedActive === undefined) delete process.env.CLAUDE_ACTIVE_ROOM;
    else process.env.CLAUDE_ACTIVE_ROOM = savedActive;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }

  process.stdout.write('\nroom-state-active-room-misroute: ' +
    (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
