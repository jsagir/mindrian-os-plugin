#!/usr/bin/env node
'use strict';

/**
 * Phase 232.1 Plan 02 (D-07): the room_state density-line regression suite.
 *
 * What is under test: roomDensityLine(activeRoomDir) and its wiring into the
 * room_state MCP tool's `status` and `get-state` read branches.
 *
 *   1. seeded room.db -> status response carries the exact node/edge counts.
 *   2. no room.db yet -> 0 nodes / 0 edges, response never throws (D-05).
 *   3. THE LOAD-BEARING ONE: a mid-session active-room switch reroutes the
 *      density line too. Boot-time roomDir = room A (no room.db at all), the
 *      registry's active room = room B (seeded 3/2). The response MUST report
 *      room B. This is the intern-w1-room-state-false-empty bug class applied
 *      to this new line: reading the frozen boot-time `roomDir` closure instead
 *      of the per-call `activeRoomDir` would report room A's emptiness as if it
 *      were the bound room's truth (T-232.1-07). Mirrors Contract 1 of
 *      tests/test-tool-router-active-room-misroute.cjs.
 *   4. get-state carries the same line as status (both read branches wired).
 *   5. D-06 forbidden-word guard: the rendered line never says dense, sparse,
 *      density, risk, healthy, low or high. A count is a measurement, never a
 *      health claim.
 *   6. THE OTHER LOAD-BEARING ONE: a byte-identical non-mutation pin around an
 *      ACTUAL server.tools.room_state({command:'status'}) call. sqlite_master
 *      (name, sql) plus the file's mtimeMs must be unchanged (T-232.1-06). Plan
 *      232.1-01 pinned this for the door in isolation; this pins the real
 *      MCP-facing code path, which is what a user actually triggers.
 *
 * Fully hermetic: every room lives under mkdtemp, MINDRIAN_ROOMS_HOME and
 * CLAUDE_ACTIVE_ROOM are saved and restored, and nothing reaches the network or
 * the developer's real ~/MindrianRooms/.
 *
 * The one deliberate use of the MUTATING door (room-db.cjs::openRoomDb) is test
 * SETUP only: it is how a scratch room gets a realistic, fully migrated schema
 * to then be measured read-only. tests/ is on the check-substrate.cjs
 * ALLOWED_DIRECT_IMPORT list, so requiring room-db.cjs here is sanctioned.
 *
 * Harness pattern from tests/test-tool-router-active-room-misroute.cjs.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const router = require(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
const roomDb = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'room-db.cjs'));
const spineEvents = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));

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

// A fake McpServer capturing each registered tool handler by name, so the test
// can invoke room_state directly (mirrors how the SDK would dispatch).
function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _desc, _schema, handler) { tools[name] = handler; },
  };
}

// Seed a scratch room with the REAL migrated schema plus nodeCount node rows
// and edgeCount edge rows. Setup only, via the mutating door on purpose.
// The post-migration nodes table carries NOT NULL source_path / created_by /
// created_at / last_seen_at (phase-109 + phase-160) and a CHECK on created_by,
// so the bare (id, type, properties) triple is not insertable.
function seedRows(roomDir, nodeCount, edgeCount) {
  const db = roomDb.openRoomDb(roomDir);
  const now = Date.now();
  try {
    for (let i = 0; i < nodeCount; i += 1) {
      db.prepare(
        'INSERT INTO nodes (id, type, properties, source_path, created_by, created_at, last_seen_at) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('n' + i, 'claim', '{}', 'test/seed.md', 'system', now, now);
    }
    for (let i = 0; i < edgeCount; i += 1) {
      db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
        .run('n' + i, 'n' + (i + 1), 'INFORMS', '{}');
    }
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// Seed a room.db that is BEHIND the migration chain: only the pre-migration
// `nodes` (the bare id/type/properties triple) and `edges` tables, none of the
// other 11 tables and none of the phase-109 / phase-160 node columns. This is
// the real-world state of most live registered rooms (232.1-RESEARCH.md: 30 of
// 38), and it is what makes scenario 6 a REAL regression pin. A room seeded
// through openRoomDb is already at head schema, so a second mutating open would
// be an unobservable no-op and the byte-identical assertion would pass even if
// the wiring reached the WRONG door. Against this fixture, a mutating open adds
// tables and columns, so sqlite_master visibly changes. Verified by mutation
// test: swapping the door in roomDensityLine fails this scenario.
// tests/ is on the check-substrate.cjs ALLOWED_DIRECT_IMPORT list, so touching
// node:sqlite here is sanctioned.
function seedMidMigrationRoom(roomDir, nodeCount, edgeCount) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'));
  try {
    db.exec(
      'CREATE TABLE IF NOT EXISTS nodes ('
      + ' id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\''
      + ');'
      + 'CREATE TABLE IF NOT EXISTS edges ('
      + ' source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL,'
      + ' properties TEXT DEFAULT \'{}\', PRIMARY KEY (source, target, type)'
      + ');'
    );
    for (let i = 0; i < nodeCount; i += 1) {
      db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
        .run('n' + i, 'claim', '{}');
    }
    for (let i = 0; i < edgeCount; i += 1) {
      db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
        .run('n' + i, 'n' + (i + 1), 'INFORMS', '{}');
    }
  } finally {
    db.close();
  }
}

// Pull the flat text out of an MCP textResponse envelope.
function responseText(res) {
  assert.ok(res && Array.isArray(res.content), 'response must carry a content array');
  return res.content.map((c) => (c && c.text) || '').join('\n');
}

function schemaSnapshot(db) {
  return db.prepare('SELECT name, sql FROM sqlite_master ORDER BY name').all();
}

// Register the router against a boot-time roomDir and hand back room_state.
function roomStateHandler(bootRoomDir) {
  const server = makeFakeServer();
  router.registerRouterTools(server, bootRoomDir, PLUGIN_ROOT, { compact: '' });
  assert.strictEqual(typeof server.tools.room_state, 'function',
    'room_state handler must be registered');
  return server.tools.room_state;
}

const FORBIDDEN = ['dense', 'sparse', 'density', 'risk', 'healthy', 'low', 'high'];

async function run() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-232-1-rsd-'));

  // The seeded room reused by scenarios 1, 4, 5 and 6: 3 nodes / 2 edges.
  const seededRoom = path.join(tmpHome, 'seeded-room');
  fs.mkdirSync(seededRoom, { recursive: true });
  seedRows(seededRoom, 3, 2);

  // The cold room reused by scenarios 2 and 5: no .mindrian/room.db at all.
  const coldRoom = path.join(tmpHome, 'cold-room');
  fs.mkdirSync(coldRoom, { recursive: true });

  // Scenario 6's room: same 3/2 counts, but a room.db deliberately BEHIND the
  // migration chain, so a mutating open would visibly change sqlite_master.
  const midMigrationRoom = path.join(tmpHome, 'mid-migration-room');
  fs.mkdirSync(midMigrationRoom, { recursive: true });
  seedMidMigrationRoom(midMigrationRoom, 3, 2);

  // Env seams resolveActiveRoom honors. Saved once, restored once, so a scratch
  // registry in scenario 3 can never leak into the other scenarios or the box.
  const savedHome = process.env.MINDRIAN_ROOMS_HOME;
  const savedActive = process.env.CLAUDE_ACTIVE_ROOM;

  try {
    // -------------------------------------------------------------------------
    // 1. Seeded room -> status response carries the exact counts.
    // -------------------------------------------------------------------------
    // No registry: resolveWriteTargetDir falls back to the passed boot-time
    // roomDir on a registry miss (its documented behavior, pinned by
    // tests/test-tool-router-active-room-misroute.cjs), so activeRoomDir here
    // legitimately resolves to seededRoom.
    process.env.MINDRIAN_ROOMS_HOME = path.join(tmpHome, 'no-registry-home');
    delete process.env.CLAUDE_ACTIVE_ROOM;

    await checkAsync('1. status response reports the bound room\'s seeded node/edge counts', async () => {
      const roomState = roomStateHandler(seededRoom);
      const text = responseText(await roomState({ command: 'status' }));
      assert.match(text, /Local graph: 3 nodes, 2 edges\./,
        'status must carry the seeded 3/2 counts, got: ' + JSON.stringify(text.slice(-200)));
    });

    // -------------------------------------------------------------------------
    // 2. No room.db yet -> 0/0, never throws (D-05).
    // -------------------------------------------------------------------------
    await checkAsync('2. a bound room with no room.db reports 0 nodes / 0 edges without throwing', async () => {
      const roomState = roomStateHandler(coldRoom);
      const text = responseText(await roomState({ command: 'status' }));
      assert.match(text, /Local graph: 0 nodes, 0 edges \(no room\.db yet\)\./,
        'a cold room must report the explicit no-room.db-yet form, got: ' + JSON.stringify(text.slice(-200)));
    });

    // -------------------------------------------------------------------------
    // 3. Mid-session active-room switch reroutes the density line too.
    // -------------------------------------------------------------------------
    await checkAsync('3. mid-session active-room switch reroutes the density line (activeRoomDir, not boot roomDir)', async () => {
      const switchHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-232-1-switch-'));
      const roomA = path.join(switchHome, 'room-a'); // boot-time (spawn) room
      const roomB = path.join(switchHome, 'room-b'); // mid-session active room
      fs.mkdirSync(roomA, { recursive: true });
      fs.mkdirSync(roomB, { recursive: true });
      // Room A gets NO room.db at all, so a wrong-room read is unambiguous: it
      // would render the 0/0 no-room.db-yet form instead of room B's counts.
      seedRows(roomB, 3, 2);

      const roomsDir = path.join(switchHome, '.rooms');
      fs.mkdirSync(roomsDir, { recursive: true });
      fs.writeFileSync(path.join(roomsDir, 'registry.json'), JSON.stringify({
        active: 'room-b',
        rooms: { 'room-b': { slug: 'room-b', abs_path: roomB } },
      }), 'utf8');

      const prevHome = process.env.MINDRIAN_ROOMS_HOME;
      process.env.MINDRIAN_ROOMS_HOME = switchHome;
      delete process.env.CLAUDE_ACTIVE_ROOM; // the registry leg must win
      try {
        const roomState = roomStateHandler(roomA);
        const text = responseText(await roomState({ command: 'status' }));
        assert.match(text, /Local graph: 3 nodes, 2 edges\./,
          'the density line must report the ACTIVE room B, got: ' + JSON.stringify(text.slice(-200)));
        assert.ok(!/no room\.db yet/.test(text),
          'reporting the no-room.db-yet form here means the line read the frozen boot-time roomDir (room A)');
      } finally {
        process.env.MINDRIAN_ROOMS_HOME = prevHome;
        fs.rmSync(switchHome, { recursive: true, force: true });
      }
    });

    // -------------------------------------------------------------------------
    // 4. get-state carries the same line (both read branches wired).
    // -------------------------------------------------------------------------
    await checkAsync('4. get-state also carries the density line', async () => {
      const roomState = roomStateHandler(seededRoom);
      const text = responseText(await roomState({ command: 'get-state' }));
      assert.match(text, /Local graph: 3 nodes, 2 edges\./,
        'get-state must carry the same 3/2 counts as status, got: ' + JSON.stringify(text.slice(-200)));
    });

    // -------------------------------------------------------------------------
    // 5. D-06 forbidden-word guard on the rendered line itself.
    // -------------------------------------------------------------------------
    check('5. the density line never claims dense / sparse / density / risk / healthy / low / high (D-06)', () => {
      const lines = [
        router._test.roomDensityLine(seededRoom),
        router._test.roomDensityLine(coldRoom),
      ];
      for (const line of lines) {
        assert.ok(line.length > 0, 'the density line must not be empty for a resolvable room');
        const lower = line.toLowerCase();
        for (const word of FORBIDDEN) {
          assert.ok(!lower.includes(word),
            'forbidden D-06 word "' + word + '" appears in the rendered line: ' + JSON.stringify(line));
        }
      }
    });

    // -------------------------------------------------------------------------
    // 6. Byte-identical: room_state status never mutates the bound room.db.
    // -------------------------------------------------------------------------
    await checkAsync('6. room_state status leaves the bound room.db sqlite_master and mtimeMs byte-identical', async () => {
      const dbPath = path.join(midMigrationRoom, '.mindrian', 'room.db');
      assert.strictEqual(fs.existsSync(dbPath), true,
        'precondition: the mid-migration room.db must exist');

      const beforeMtime = fs.statSync(dbPath).mtimeMs;
      const firstHandle = spineEvents.openRoomDbReadOnlyForCaller(midMigrationRoom);
      assert.notStrictEqual(firstHandle, null, 'the read-only door must return a handle');
      const before = schemaSnapshot(firstHandle);
      assert.ok(before.length > 0,
        'the room.db must carry a non-empty schema to make this test meaningful');
      // Precondition that keeps this pin honest: the fixture must be BEHIND head
      // schema. If a future change makes seedMidMigrationRoom produce a fully
      // migrated db, a mutating open becomes an unobservable no-op and this
      // scenario would silently stop biting.
      assert.ok(before.length < 13,
        'precondition: the fixture must be behind the migration chain (got '
        + before.length + ' schema objects), else a mutating open is unobservable');

      spineEvents.closeRoomDbForCaller(firstHandle);

      const roomState = roomStateHandler(midMigrationRoom);
      await roomState({ command: 'status' });

      const afterHandle = spineEvents.openRoomDbReadOnlyForCaller(midMigrationRoom);
      assert.notStrictEqual(afterHandle, null, 'the read-only door must still return a handle');
      const after = schemaSnapshot(afterHandle);
      spineEvents.closeRoomDbForCaller(afterHandle);
      const afterMtime = fs.statSync(dbPath).mtimeMs;

      assert.deepStrictEqual(after, before,
        'room_state status mutated sqlite_master - the density line reached a migrating door');
      assert.strictEqual(afterMtime, beforeMtime,
        'room_state status changed the room.db mtimeMs - something wrote to the measured room');
    });
  } finally {
    if (savedHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = savedHome;
    if (savedActive === undefined) delete process.env.CLAUDE_ACTIVE_ROOM;
    else process.env.CLAUDE_ACTIVE_ROOM = savedActive;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }

  process.stdout.write('\n232.1-room-state-density: ' +
    (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
