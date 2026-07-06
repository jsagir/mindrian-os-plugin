#!/usr/bin/env node
'use strict';

/**
 * Regression (todo 2026-07-06-room-content-file-opportunity-misroutes-active-room):
 *
 * The MCP server resolves its write target ONCE at boot
 * (bin/mindrian-mcp-server.cjs captures `roomDir` and freezes it into the
 * tool-router closure via registerRouterTools). Every room_content WRITE
 * handler used that frozen closure, so a mid-session `room-registry set-active X`
 * never reached the long-lived server and writes kept landing in the spawn-time
 * room. The fix re-resolves the live active room per call through the ONE
 * canonical resolver (lib/core/resolve-active-room.cjs), falling back to the
 * boot-time roomDir on a miss.
 *
 * Two contracts under test:
 *   1. Misroute: boot roomDir = A, registry active = B mid-run; the
 *      file-opportunity handler MUST write under B/opportunity-bank, NOT A.
 *   2. Schema alignment: opportunitySchema now matches the op it guards -- a
 *      payload keyed on `program` with no `title` passes, and a stringified
 *      numeric score passes (coerced), because fileOpportunity would file both.
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
// test can invoke room_content directly (mirrors how the SDK would dispatch).
function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _desc, _schema, handler) { tools[name] = handler; },
  };
}

// Count *.md opportunity files under <room>/opportunity-bank (excludes STATE.md).
function opportunityFiles(roomDir) {
  const oppDir = path.join(roomDir, 'opportunity-bank');
  if (!fs.existsSync(oppDir)) return [];
  return fs.readdirSync(oppDir).filter((f) => f.endsWith('.md') && f !== 'STATE.md');
}

async function run() {
  // ---------------------------------------------------------------------------
  // Contract 1: mid-session active-room switch reroutes the write.
  // ---------------------------------------------------------------------------
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-misroute-'));
  const roomA = path.join(tmpHome, 'room-a'); // boot-time (spawn) room
  const roomB = path.join(tmpHome, 'room-b'); // mid-session active room
  fs.mkdirSync(roomA, { recursive: true });
  fs.mkdirSync(roomB, { recursive: true });

  // Registry with active = room-b (the shape resolveActiveRoom reads: current
  // `active` field + Object `rooms` map + abs_path entry).
  const roomsDir = path.join(tmpHome, '.rooms');
  fs.mkdirSync(roomsDir, { recursive: true });
  fs.writeFileSync(path.join(roomsDir, 'registry.json'), JSON.stringify({
    active: 'room-b',
    rooms: { 'room-b': { slug: 'room-b', abs_path: roomB } },
  }), 'utf8');

  // Save/restore the env seams resolveActiveRoom honors.
  const savedHome = process.env.MINDRIAN_ROOMS_HOME;
  const savedActive = process.env.CLAUDE_ACTIVE_ROOM;
  process.env.MINDRIAN_ROOMS_HOME = tmpHome;
  delete process.env.CLAUDE_ACTIVE_ROOM; // registry leg must win, not the env override

  try {
    // Register the router with roomA as the FROZEN boot-time roomDir.
    const server = makeFakeServer();
    router.registerRouterTools(server, roomA, PLUGIN_ROOT, { compact: '' });
    assert.strictEqual(typeof server.tools.room_content, 'function',
      'room_content handler must be registered');

    await checkAsync('file-opportunity writes to the mid-session active room (B), not boot room (A)', async () => {
      await server.tools.room_content({
        command: 'file-opportunity',
        section: JSON.stringify({ program: 'Reroute Test Program', source: 'test' }),
      });
      const aFiles = opportunityFiles(roomA);
      const bFiles = opportunityFiles(roomB);
      assert.strictEqual(aFiles.length, 0,
        'boot room A must receive NO opportunity file (got: ' + aFiles.join(', ') + ')');
      assert.strictEqual(bFiles.length, 1,
        'active room B must receive exactly one opportunity file (got: ' + bFiles.join(', ') + ')');
    });

    await checkAsync('resolveWriteTargetDir falls back to boot roomDir on registry miss', async () => {
      // Point HOME at an empty dir with no registry -> resolveActiveRoom returns
      // null -> helper must fall back to the boot-time roomDir passed in.
      const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-empty-'));
      const prev = process.env.MINDRIAN_ROOMS_HOME;
      process.env.MINDRIAN_ROOMS_HOME = emptyHome;
      try {
        const target = router._test.resolveWriteTargetDir(roomA);
        assert.strictEqual(target, roomA, 'miss must fall back to boot roomDir');
      } finally {
        process.env.MINDRIAN_ROOMS_HOME = prev;
        fs.rmSync(emptyHome, { recursive: true, force: true });
      }
    });
  } finally {
    if (savedHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = savedHome;
    if (savedActive === undefined) delete process.env.CLAUDE_ACTIVE_ROOM;
    else process.env.CLAUDE_ACTIVE_ROOM = savedActive;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }

  // ---------------------------------------------------------------------------
  // Contract 2: schema aligned to the op (title optional; numerics coerced).
  // ---------------------------------------------------------------------------
  const schema = router._test.opportunitySchema;

  check('payload with program and NO title passes validation', () => {
    const parsed = schema.parse({ program: 'Program Only', source: 'test' });
    assert.strictEqual(parsed.program, 'Program Only');
  });

  check('payload with title and no program still passes', () => {
    const parsed = schema.parse({ title: 'Title Only' });
    assert.strictEqual(parsed.title, 'Title Only');
  });

  check('stringified relevance_score is coerced to a number', () => {
    const parsed = schema.parse({ program: 'Coerce Test', relevance_score: '0.8' });
    assert.strictEqual(parsed.relevance_score, 0.8);
    assert.strictEqual(typeof parsed.relevance_score, 'number');
  });

  check('stringified amount is coerced to a number', () => {
    const parsed = schema.parse({ program: 'Amount Test', amount: '50000' });
    assert.strictEqual(parsed.amount, 50000);
  });

  check('empty payload (no title AND no program) is rejected', () => {
    assert.throws(() => schema.parse({ source: 'test' }),
      /title or program required/,
      'a payload with neither title nor program must be rejected');
  });

  process.stdout.write('\ntool-router-active-room-misroute: ' +
    (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
