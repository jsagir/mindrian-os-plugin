#!/usr/bin/env node
'use strict';

/**
 * RCA statusline-room-health-chip-never-updates.
 *
 * The statusline health chip reads ~/.mindrian/room-health.json via
 * lib/statusline/cockpit-signals.readHealthStatus(). That file is written ONLY by
 * lib/statusline/room-health-cache.persistRoomHealth(), which before this fix had
 * exactly ONE caller in the whole tree: scripts/doctor.cjs's `--bind-check <roomDir>`
 * CLI flag branch. Nothing in the shipped product ever invoked that flag, so the
 * chip froze at whatever the last manual shell run wrote (or stayed absent), and a
 * stale "run /mos:doctor --fix" warning could never clear.
 *
 * room_bind (lib/mcp/tool-router.cjs) is the D-03 binding front door - the live path
 * every session actually takes. This test asserts that completing a bind through it
 * produces a FRESH, HONEST room-health write, derived from a real in-process health
 * read (session-presence.runBindCheck), not from a constant and not from a
 * child_process spawn of doctor.cjs.
 *
 * Legs:
 *   1. FIX: an explicit-room bind writes HOME/.mindrian/room-health.json with a valid
 *      status enum and a timestamp from THIS run (not a stale one).
 *   2. DERIVED FROM A REAL READ: a structurally sound room yields 'sound' and a
 *      structurally broken room yields 'drift' through the SAME bind path. Two
 *      different room states producing two different statuses is what separates a
 *      real health read from a hardcoded write.
 *   3. cwd auto-bind (the `.room-root` sentinel path) also writes the signal.
 *   4. NO FALSE SIGNAL: the needs_binding_card ambiguity path did NOT bind anything,
 *      so it must not write a health status.
 *   5. FAIL SOFT: a throwing health check NEVER breaks or blocks a successful bind.
 *   6. NO SPAWN: the room_bind handler reaches the health check in-process; the
 *      tool-router source carries no child_process spawn of doctor.cjs.
 *
 * Canon Part 8: LOCAL only. HOME and MINDRIAN_ROOMS_HOME are both isolated to temp
 * dirs so this test never touches the real ~/.mindrian/ or ~/MindrianRooms/, and the
 * whole path makes zero Brain / network call.
 *
 * Node built-in assert only. No test framework. CJS only. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const HEALTH_CACHE_PATH = path.join(PLUGIN_ROOT, 'lib', 'statusline', 'room-health-cache.cjs');

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

// room_bind's success responses append a "## Suggested Next" block after the JSON
// payload (formatSuggestedNext). Parse only the leading JSON object.
function parseResponseJson(res) {
  const text = res && res.content && res.content[0] && res.content[0].text;
  assert.ok(text, 'room_bind must return a text response');
  const marker = text.indexOf('\n\n## Suggested Next');
  const jsonText = marker === -1 ? text : text.slice(0, marker);
  return JSON.parse(jsonText);
}

// A fake McpServer that captures each registered tool handler by name so the test
// can invoke room_bind directly (mirrors tests/test-room-bind-stdio-session-fallback.cjs).
function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _desc, _schema, handler) { tools[name] = handler; },
  };
}

// A structurally SOUND room per lib/core/session-presence.checkRoomStructure:
// a `.room-root` sentinel plus a `.mindrian/room.db` carrying nodes + edges tables.
function makeSoundRoom(roomsHome, slug) {
  const dir = path.join(roomsHome, slug);
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.room-root'), slug + '\n', 'utf8');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(dir, '.mindrian', 'room.db'));
  try {
    db.exec('CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY)');
    db.exec('CREATE TABLE IF NOT EXISTS edges (id TEXT PRIMARY KEY)');
  } finally {
    db.close();
  }
  return dir;
}

// A structurally BROKEN room: the directory exists (so it is bindable) but carries
// neither the `.room-root` sentinel nor a room.db.
function makeBrokenRoom(roomsHome, slug) {
  const dir = path.join(roomsHome, slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readHealthRecord(home) {
  const p = path.join(home, '.mindrian', 'room-health.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function clearHealthRecord(home) {
  try { fs.rmSync(path.join(home, '.mindrian', 'room-health.json'), { force: true }); } catch (_e) {}
}

async function run() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-bind-health-home-'));
  const tmpRooms = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-bind-health-rooms-'));

  const savedHome = process.env.HOME;
  const savedRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
  const savedRoomsRoot = process.env.MINDRIAN_ROOMS_ROOT;
  const savedSession = process.env.CLAUDE_CODE_SESSION_ID;

  // HOME drives the ~/.mindrian/room-health.json path (the reader's path);
  // MINDRIAN_ROOMS_HOME drives the session-binding store and the slug -> room dir
  // derivation. Isolate BOTH so the real user state is never touched.
  process.env.HOME = tmpHome;
  process.env.MINDRIAN_ROOMS_HOME = tmpRooms;
  delete process.env.MINDRIAN_ROOMS_ROOT;

  const soundDir = makeSoundRoom(tmpRooms, 'sound-room');
  makeBrokenRoom(tmpRooms, 'broken-room');

  const server = makeFakeServer();
  const router = require(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
  router.registerRouterTools(server, soundDir, PLUGIN_ROOT, { compact: '' });
  assert.strictEqual(typeof server.tools.room_bind, 'function',
    'room_bind handler must be registered');

  try {
    // -------------------------------------------------------------------
    // Leg 1 FIX: an explicit-room bind writes a FRESH room-health record.
    // This is the leg that fails before the fix: nothing on the room_bind
    // path ever called persistRoomHealth, so the file was never created.
    // -------------------------------------------------------------------
    await checkAsync('explicit-room bind writes a fresh room-health.json', async () => {
      clearHealthRecord(tmpHome);
      const startedAt = Date.now();
      process.env.CLAUDE_CODE_SESSION_ID = 'bind-health-sess-1';

      const res = await server.tools.room_bind({ room: 'sound-room' }, {});
      const parsed = parseResponseJson(res);
      assert.strictEqual(parsed.ok, true, 'expected ok:true');
      assert.strictEqual(parsed.bound, true, 'expected bound:true');

      const p = path.join(tmpHome, '.mindrian', 'room-health.json');
      assert.ok(fs.existsSync(p),
        'room_bind must write the room-health cache the statusline reads (' + p + ')');

      const rec = readHealthRecord(tmpHome);
      assert.ok(['sound', 'drift', 'broken'].indexOf(rec.status) !== -1,
        'status must be a valid health enum, got: ' + JSON.stringify(rec.status));
      assert.ok(Date.parse(rec.at) >= startedAt - 2000,
        'the health record must carry a timestamp from THIS bind, not a stale one');
    });

    // -------------------------------------------------------------------
    // Leg 2 DERIVED FROM A REAL READ: the SAME bind path yields a DIFFERENT
    // status for a structurally sound room vs a structurally broken one.
    // A hardcoded or constant write cannot satisfy this leg.
    // -------------------------------------------------------------------
    await checkAsync('the persisted status is derived from a real health read (sound vs drift)', async () => {
      clearHealthRecord(tmpHome);
      process.env.CLAUDE_CODE_SESSION_ID = 'bind-health-sess-2';
      await server.tools.room_bind({ room: 'sound-room' }, {});
      assert.strictEqual(readHealthRecord(tmpHome).status, 'sound',
        'a room with .room-root + a nodes/edges room.db is sound');

      clearHealthRecord(tmpHome);
      process.env.CLAUDE_CODE_SESSION_ID = 'bind-health-sess-3';
      await server.tools.room_bind({ room: 'broken-room' }, {});
      assert.strictEqual(readHealthRecord(tmpHome).status, 'drift',
        'a room missing .room-root and room.db is drift, not sound');
    });

    // -------------------------------------------------------------------
    // Leg 3: the cwd auto-bind path (a `.room-root` sentinel at/above cwd)
    // is a successful bind too, so it must produce the signal as well.
    // -------------------------------------------------------------------
    await checkAsync('cwd auto-bind also writes the health signal', async () => {
      clearHealthRecord(tmpHome);
      process.env.CLAUDE_CODE_SESSION_ID = 'bind-health-sess-4';
      const savedCwd = process.cwd();
      try {
        process.chdir(soundDir);
        const res = await server.tools.room_bind({}, {});
        const parsed = parseResponseJson(res);
        assert.strictEqual(parsed.source, 'cwd', 'expected a cwd auto-bind, got: ' + JSON.stringify(parsed));
        assert.strictEqual(readHealthRecord(tmpHome).status, 'sound',
          'the cwd auto-bind path must write the health signal too');
      } finally {
        process.chdir(savedCwd);
      }
    });

    // -------------------------------------------------------------------
    // Leg 4 NO FALSE SIGNAL: the needs_binding_card ambiguity path binds
    // NOTHING, so it must not fabricate a health status.
    // -------------------------------------------------------------------
    await checkAsync('the needs_binding_card path writes no health status', async () => {
      clearHealthRecord(tmpHome);
      process.env.CLAUDE_CODE_SESSION_ID = 'bind-health-sess-5';
      const savedCwd = process.cwd();
      try {
        // os.tmpdir() carries no `.room-root` sentinel above it, so this is the
        // genuine-ambiguity path.
        process.chdir(os.tmpdir());
        const res = await server.tools.room_bind({}, {});
        const parsed = parseResponseJson(res);
        assert.strictEqual(parsed.needs_binding_card, true,
          'expected the ambiguity signal, got: ' + JSON.stringify(parsed));
        assert.ok(!fs.existsSync(path.join(tmpHome, '.mindrian', 'room-health.json')),
          'no bind happened, so no health status may be written');
      } finally {
        process.chdir(savedCwd);
      }
    });

    // -------------------------------------------------------------------
    // Leg 5 FAIL SOFT: a throwing health check NEVER breaks the bind. The
    // bind is the load-bearing operation; health is an advisory side-effect.
    // -------------------------------------------------------------------
    await checkAsync('a throwing health check never breaks a successful bind', async () => {
      clearHealthRecord(tmpHome);
      process.env.CLAUDE_CODE_SESSION_ID = 'bind-health-sess-6';
      const cached = require.cache[require.resolve(HEALTH_CACHE_PATH)];
      assert.ok(cached, 'the room-health-cache module must be loaded by the bind path');
      const original = cached.exports.runBindHealthCheck;
      cached.exports.runBindHealthCheck = function () { throw new Error('injected health fault'); };
      try {
        const res = await server.tools.room_bind({ room: 'sound-room' }, {});
        const parsed = parseResponseJson(res);
        assert.strictEqual(parsed.ok, true, 'the bind must still succeed');
        assert.strictEqual(parsed.bound, true, 'the bind must still report bound:true');
        assert.strictEqual(parsed.primary, 'sound-room', 'the bind must still name the room');
      } finally {
        cached.exports.runBindHealthCheck = original;
      }

      // And the binding itself actually landed on disk.
      const { readSessionBinding } = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'session-binding.cjs'));
      const binding = readSessionBinding('bind-health-sess-6', { home: tmpRooms });
      assert.strictEqual(binding.primary, 'sound-room',
        'a health fault must not prevent the session binding write');
    });

    // -------------------------------------------------------------------
    // Leg 6 NO SPAWN: the health check runs IN-PROCESS. An MCP tool handler
    // must never shell out to doctor.cjs for a synchronous tool call.
    // -------------------------------------------------------------------
    await checkAsync('the room_bind health path spawns no doctor.cjs subprocess', async () => {
      const src = fs.readFileSync(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');
      assert.strictEqual(src.indexOf('doctor.cjs'), -1,
        'tool-router.cjs must not reference doctor.cjs (no subprocess spawn from a tool handler)');
      const cacheSrc = fs.readFileSync(HEALTH_CACHE_PATH, 'utf8');
      assert.strictEqual(cacheSrc.indexOf('child_process'), -1,
        'room-health-cache.cjs must not spawn a child process');
    });

    await checkAsync('this test file is em-dash-free', async () => {
      const self = fs.readFileSync(__filename, 'utf8');
      assert.strictEqual(self.indexOf(String.fromCharCode(0x2014)), -1, 'no em-dash in the test file');
    });
  } finally {
    if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
    if (savedRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = savedRoomsHome;
    if (savedRoomsRoot === undefined) delete process.env.MINDRIAN_ROOMS_ROOT; else process.env.MINDRIAN_ROOMS_ROOT = savedRoomsRoot;
    if (savedSession === undefined) delete process.env.CLAUDE_CODE_SESSION_ID; else process.env.CLAUDE_CODE_SESSION_ID = savedSession;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(tmpRooms, { recursive: true, force: true });
  }

  process.stdout.write('\nroom-bind-health-signal: ' +
    (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
