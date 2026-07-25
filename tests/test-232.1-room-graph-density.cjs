#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 232.1 -- room-graph density read (D-01/D-02/D-03/D-04/D-05/D-06/D-08).
 *
 * Behavior asserted:
 *   Door scenarios (Plan 01 Task 1, D-04 corrected):
 *     1. absent room.db -> openRoomDbReadOnlyForCaller returns null, no throw.
 *     2. THE PITFALL-1 REGRESSION PIN: an open+query+close cycle through the
 *        read-only door leaves sqlite_master (name, sql) AND the file mtimeMs
 *        byte-identical. This is the proof that the whole D-04 decision holds:
 *        the pre-existing openRoomDbForCaller runs 13 CREATE TABLE IF NOT
 *        EXISTS statements plus 5 migrations on every open, so a census through
 *        it would silently migrate every registered room. Seeded via
 *        seedMidMigrationRoom (deliberately BEHIND the migration chain, the
 *        real state of 30 of 38 live rooms), not a fully-migrated fixture --
 *        a room already at head schema would pass this pin even with the
 *        wrong door wired in, since there is nothing left to migrate either
 *        way. Mutation-verified: swapping the door in this scenario fails it.
 *     3. a room path containing #, % and ? still opens (the _fileUriPath
 *        escaper, not just the happy-path filename case).
 *   Doctor-module scenarios (Plan 01 Task 2, D-01/D-02/D-03/D-05/D-06/D-08):
 *     4. two rooms (one populated, one with no room.db) -> status ok, per-room
 *        counts and totals correct.
 *     5. no registry -> status skip.
 *     6. a corrupt registry entry soft-fails that ONE room only; the sweep
 *        completes and the healthy room's counts are unaffected (T-232.1-02 /
 *        T-217-01).
 *     7. a schema-less room.db reports 0 / 0 and never throws (D-05).
 *     8. the rendered detail carries no D-06 forbidden word.
 *     9. a room registered via `abs_path` only (no `path` key) is counted,
 *        not silently skipped (232.1-REVIEW.md WR-01 fix).
 *
 * Spawns: `node scripts/doctor.cjs --json` (bare run, since the module is
 * registered with flag: null) with MINDRIAN_ROOMS_HOME=<scratch> so the census
 * operates against the hermetic scratch registry, not the user's real
 * ~/MindrianRooms/. stdout is parsed ALONE, never stdout + stderr: node:sqlite
 * prints an ExperimentalWarning to stderr on first load.
 *
 * Two deliberate fixture-seeding paths, both test SETUP only, never the code
 * under test: (1) the MUTATING door (room-db.cjs::openRoomDb) via
 * seedRealSchema, used ONLY by scenario 3 (URI-path escaping) to get a
 * realistic, fully-migrated multi-table schema; (2) a raw node:sqlite fixture
 * via seedMidMigrationRoom, used by scenario 2 (the actual mutation-avoidance
 * pin) to reproduce the pre-migration schema state most live rooms are
 * actually in -- using seedRealSchema there would make the pin pass
 * regardless of which door is wired in. tests/ is on the check-substrate.cjs
 * ALLOWED_DIRECT_IMPORT list, so both node:sqlite and room-db.cjs are
 * sanctioned here.
 *
 * IIFE harness pattern from tests/test-doctor-class-b.cjs.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

const spineEvents = require(path.join(REPO, 'lib', 'core', 'navigation', 'spine-events.cjs'));
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-232-1-' + suffix + '-'));
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

function roomDbPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'room.db');
}

// Seed a scratch room with the REAL migrated schema. Uses the mutating door on
// purpose (setup only) so scenario 3 (URI-path escaping) exercises a realistic
// multi-table state, not a hand-rolled fixture. NOT used for scenario 2 (see
// seedMidMigrationRoom below) -- a room already at head schema makes the
// byte-identical pin pass even if the wrong (mutating) door is wired in, since
// every CREATE TABLE IF NOT EXISTS is already a no-op against it.
function seedRealSchema(roomDir) {
  const handle = roomDb.openRoomDb(roomDir);
  roomDb.closeRoomDb(handle);
}

// Seed a room.db that is BEHIND the migration chain: only the pre-migration
// `nodes` (bare id/type/properties triple) and `edges` tables, none of the
// other 11 tables and none of the phase-109 / phase-160 node columns. This is
// the real-world state of most live registered rooms (232.1-RESEARCH.md: 30 of
// 38), and it is what makes scenario 2 a REAL regression pin. A room seeded
// through openRoomDb (seedRealSchema above) is already at head schema, so a
// second mutating open would be an unobservable no-op and the byte-identical
// assertion would pass even if the wiring reached the WRONG door. Against this
// fixture, a mutating open adds tables and columns, so sqlite_master visibly
// changes -- verified by mutation test: swapping openRoomDbReadOnlyForCaller
// for openRoomDbForCaller in scenario 2 fails this scenario.
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

function schemaSnapshot(db) {
  return db.prepare('SELECT name, sql FROM sqlite_master ORDER BY name').all();
}

// Build a scratch registry with N rooms. Copied from tests/test-doctor-class-b.cjs
// and reduced to what this phase needs (no sentinel map). Returns the absolute
// path of the scratch ROOMS_HOME.
function makeScratchRegistry(scratch, rooms) {
  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registry = { active: rooms[0] || null, rooms: {} };
  for (const roomName of rooms) {
    fs.mkdirSync(path.join(scratch, roomName), { recursive: true });
    registry.rooms[roomName] = { path: roomName };
  }
  fs.writeFileSync(
    path.join(registryDir, 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
  return scratch;
}

function writeRegistry(scratch, registry) {
  fs.writeFileSync(
    path.join(scratch, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
}

// Seed a scratch room with a real schema plus nodeCount node rows and edgeCount
// edge rows. Setup only, via the mutating door on purpose.
function seedRows(roomDir, nodeCount, edgeCount) {
  const db = roomDb.openRoomDb(roomDir);
  const now = Date.now();
  try {
    for (let i = 0; i < nodeCount; i += 1) {
      // The post-migration nodes table carries NOT NULL source_path /
      // created_by / created_at / last_seen_at (phase-109 + phase-160), so the
      // bare (id, type, properties) triple is not insertable.
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

// Build a hermetic scratch HOME carrying a minimal plugin install + marketplace
// cache stamped with THIS repo's version, so doctor's class A install/cache
// checks resolve cleanly (exit 0) and the accumulative engine's running version
// of record is the version this code actually ships in.
function makeScratchPluginHome(scratch) {
  const version = JSON.parse(
    fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')
  ).version;
  const home = path.join(scratch, '.scratch-home');
  const stamp = JSON.stringify({ name: 'mindrian-os', version });
  const installDir = path.join(home, '.claude', 'plugins', 'mindrian-os', '.claude-plugin');
  const cacheDir = path.join(
    home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version, '.claude-plugin'
  );
  fs.mkdirSync(installDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(installDir, 'plugin.json'), stamp);
  fs.writeFileSync(path.join(cacheDir, 'plugin.json'), stamp);
  return home;
}

function runDoctorJson(scratch, args) {
  // Defensive tripwire (232.1-RESEARCH.md Pitfall 2, carried from
  // test-doctor-class-b.cjs): shared.cjs::readRegistry ignores ctx.home and
  // honors ONLY MINDRIAN_ROOMS_HOME, so every spawn MUST set it or the census
  // sweeps the developer's real rooms instead of the scratch registry.
  //
  // HOME is ALSO overridden, onto a scratch plugin home stamped with the repo's
  // OWN version (see makeScratchPluginHome). Two reasons. (1) Hermeticity: the
  // engine's watermark write (~/.mindrian/doctor-applied.json) and every
  // ~/.claude read land inside the scratch tree, never the developer's real
  // home. (2) Version resolution (232.1-RESEARCH.md Pitfall 5): the module's
  // introduced_version is the version this code ships in, while the plugin
  // cache INSTALLED on a dev box lags it by design (the last released tag).
  // Under the real HOME the deferred-guard would therefore park the module and
  // no row would ever appear -- a silent no-op that looks like success. The
  // scratch plugin home makes the running version the version this code ships
  // in, which is the configuration real users are on once it ships.
  const scratchHome = makeScratchPluginHome(scratch);
  const opts = {
    encoding: 'utf8',
    timeout: 20000,
    env: Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: scratch,
      HOME: scratchHome,
    }),
  };
  assert.equal(typeof opts.env.MINDRIAN_ROOMS_HOME, 'string',
    'Test must set MINDRIAN_ROOMS_HOME to scratch dir to avoid leaking into real active room');
  const res = spawnSync('node', [DOCTOR].concat(args), opts);
  // stdout ONLY. node:sqlite prints an ExperimentalWarning to stderr on first
  // load, so stdout + stderr would not parse as JSON.
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

function densityCheck(stdout, label) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch (e) {
    throw new Error(label + ': stdout must be valid JSON. Got: ' + stdout);
  }
  assert.equal(typeof report.checks, 'object', label + ': report.checks must be an object');
  const rd = report.checks['room-graph-density'];
  assert.equal(typeof rd, 'object',
    label + ': report.checks["room-graph-density"] must exist');
  return rd;
}

function roomEntry(rd, name, label) {
  const hit = (rd.rooms || []).find((r) => r && r.room === name);
  assert.equal(typeof hit, 'object', label + ': rooms[] must carry an entry for ' + name);
  return hit;
}

// Captured by scenario 4, asserted by scenario 8 (the D-06 copy guard).
let scenario4Detail = null;

// ---------- Scenarios ----------

(function test1_absentRoomDbReturnsNull() {
  const label = 'door: absent room.db -> openRoomDbReadOnlyForCaller returns null, no throw';
  const scratch = makeScratchDir('absent');
  try {
    assert.equal(fs.existsSync(roomDbPath(scratch)), false,
      label + ': precondition -- scratch room must have no room.db');
    const db = spineEvents.openRoomDbReadOnlyForCaller(scratch);
    assert.equal(db, null,
      label + ': must return exactly null when <roomDir>/.mindrian/room.db is absent');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test2_readOnlyOpenNeverMutates() {
  // THE regression pin for 232.1-RESEARCH.md Pitfall 1 / CONTEXT.md D-04.
  // Uses seedMidMigrationRoom (NOT seedRealSchema): a room already at head
  // schema makes this pin pass even with the wrong door wired in, since every
  // CREATE TABLE IF NOT EXISTS is already a no-op. Only a genuinely
  // pre-migration fixture makes a mutating open visibly change sqlite_master.
  const label = 'door: byte-identical regression -- read-only open never mutates room.db';
  const scratch = makeScratchDir('nomutate');
  try {
    seedMidMigrationRoom(scratch, 2, 1);
    const dbPath = roomDbPath(scratch);
    assert.equal(fs.existsSync(dbPath), true,
      label + ': precondition -- seeded room.db must exist');

    const beforeMtime = fs.statSync(dbPath).mtimeMs;

    const first = spineEvents.openRoomDbReadOnlyForCaller(scratch);
    assert.notEqual(first, null, label + ': read-only door must return a handle');
    const before = schemaSnapshot(first);
    // sqlite_master also carries an autoindex row per TEXT/composite PRIMARY
    // KEY (empirically 4 rows total for this 2-table fixture: 2 tables + 2
    // sqlite_autoindex_* entries) -- count type='table' specifically rather
    // than raw row length, so this precondition tracks "how many real tables"
    // and stays correct regardless of autoindex-naming behavior.
    const tableCountBefore = first.prepare(
      "SELECT count(*) AS c FROM sqlite_master WHERE type = 'table'"
    ).get().c;
    assert.equal(tableCountBefore, 2,
      label + ': precondition -- fixture must carry EXACTLY the 2 pre-migration tables (nodes, edges), '
      + 'not the full head-schema table set; if this fires, seedMidMigrationRoom has drifted to head '
      + 'schema and no longer makes this scenario a real regression pin');
    spineEvents.closeRoomDbForCaller(first);

    const afterMtime = fs.statSync(dbPath).mtimeMs;

    const second = spineEvents.openRoomDbReadOnlyForCaller(scratch);
    assert.notEqual(second, null, label + ': second read-only open must also return a handle');
    const after = schemaSnapshot(second);
    spineEvents.closeRoomDbForCaller(second);

    assert.deepEqual(before, after,
      label + ': sqlite_master (name, sql) must be identical before and after the read-only cycle');
    assert.equal(beforeMtime, afterMtime,
      label + ': room.db mtimeMs must be unchanged by an open+query+close through the read-only door');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test3_uriEscapingRoomPath() {
  const label = 'door: URI escaping -- a room path containing #, % and ? still opens';
  const scratch = makeScratchDir('uri');
  try {
    // Literal #, % and ? in the directory name: all three are URI-significant to
    // SQLite's file: parser and would mis-resolve without _fileUriPath.
    const weird = path.join(scratch, 'room#weird%50?dir');
    fs.mkdirSync(weird, { recursive: true });
    seedRealSchema(weird);

    const db = spineEvents.openRoomDbReadOnlyForCaller(weird);
    assert.notEqual(db, null,
      label + ': read-only door must return a handle for a URI-significant room path');
    try {
      const rows = schemaSnapshot(db);
      assert.equal(rows.length > 0, true,
        label + ': sqlite_master query must succeed on the escaped-path handle');
    } finally {
      spineEvents.closeRoomDbForCaller(db);
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test4_twoRoomsPopulatedAndEmpty() {
  const label = 'module: 2 rooms (1 populated, 1 without room.db) -> ok, counts + totals correct';
  const scratch = makeScratchDir('two-rooms');
  try {
    makeScratchRegistry(scratch, ['populated-room', 'cold-room']);
    seedRows(path.join(scratch, 'populated-room'), 2, 1);

    const { stdout, status } = runDoctorJson(scratch, ['--json']);
    assert.equal(status, 0, label + ': doctor must exit 0 (graceful degradation)');
    const rd = densityCheck(stdout, label);
    assert.equal(rd.status, 'ok', label + ': status must be "ok" when the sweep completes');

    const populated = roomEntry(rd, 'populated-room', label);
    assert.equal(populated.node_count, 2, label + ': populated room must report 2 node rows');
    assert.equal(populated.edge_count, 1, label + ': populated room must report 1 edge row');
    assert.equal(populated.has_db, true, label + ': populated room must report has_db true');

    const cold = roomEntry(rd, 'cold-room', label);
    assert.equal(cold.node_count, 0, label + ': room with no room.db must report 0 node rows');
    assert.equal(cold.edge_count, 0, label + ': room with no room.db must report 0 edge rows');
    assert.equal(cold.has_db, false, label + ': room with no room.db must report has_db false');

    assert.equal(rd.totals.rooms, 2, label + ': totals.rooms must count both rooms');
    assert.equal(rd.totals.nodes, 2, label + ': totals.nodes must sum to 2');
    assert.equal(rd.totals.edges, 1, label + ': totals.edges must sum to 1');

    scenario4Detail = rd.detail;
    assert.equal(typeof rd.detail === 'string' && rd.detail.length > 0, true,
      label + ': detail must be a non-empty string (contract-parity rule 9)');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test5_noRegistrySkips() {
  const label = 'module: no registry -> status skip';
  const scratch = makeScratchDir('no-registry');
  try {
    // Intentionally do NOT call makeScratchRegistry.
    const { stdout, status } = runDoctorJson(scratch, ['--json']);
    assert.equal(status, 0, label + ': doctor must exit 0 (graceful degradation)');
    const rd = densityCheck(stdout, label);
    assert.equal(rd.status, 'skip', label + ': status must be "skip" when no registry exists');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test6_corruptRegistryEntrySoftFailsOneRoom() {
  // T-232.1-02 / T-217-01 proof: the per-room try wraps resolveRoomPath itself.
  const label = 'module: corrupt registry entry soft-fails that room only';
  const scratch = makeScratchDir('corrupt-entry');
  try {
    makeScratchRegistry(scratch, ['healthy-room', 'corrupt-room']);
    seedRows(path.join(scratch, 'healthy-room'), 3, 2);
    // Hand-write a non-string path for one entry: path.isAbsolute(5) throws.
    writeRegistry(scratch, {
      active: 'healthy-room',
      rooms: {
        'healthy-room': { path: 'healthy-room' },
        'corrupt-room': { path: 5 },
      },
    });

    const { stdout, status } = runDoctorJson(scratch, ['--json']);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const rd = densityCheck(stdout, label);
    assert.equal(rd.status, 'ok', label + ': the sweep must still complete with status "ok"');

    const corrupt = roomEntry(rd, 'corrupt-room', label);
    assert.equal(corrupt.unreadable, true, label + ': corrupt room must be marked unreadable');
    assert.equal(corrupt.has_db, false, label + ': corrupt room must report has_db false');
    assert.equal(corrupt.node_count, 0, label + ': corrupt room must report 0 node rows');
    assert.equal(corrupt.edge_count, 0, label + ': corrupt room must report 0 edge rows');

    const healthy = roomEntry(rd, 'healthy-room', label);
    assert.equal(healthy.node_count, 3, label + ': healthy room counts must be unaffected');
    assert.equal(healthy.edge_count, 2, label + ': healthy room counts must be unaffected');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test7_schemaLessRoomDb() {
  // D-05's literal case. openRoomDb ALWAYS runs initSchema, so a schema-less
  // room.db cannot be produced through it: create the file directly with zero
  // CREATE TABLE statements executed.
  const label = 'module: schema-less room.db -> 0 / 0, no throw';
  const scratch = makeScratchDir('schema-less');
  try {
    makeScratchRegistry(scratch, ['bare-db-room']);
    const dbDir = path.join(scratch, 'bare-db-room', '.mindrian');
    fs.mkdirSync(dbDir, { recursive: true });
    const { DatabaseSync } = require('node:sqlite');
    const bare = new DatabaseSync(path.join(dbDir, 'room.db'));
    bare.close();
    assert.equal(fs.existsSync(path.join(dbDir, 'room.db')), true,
      label + ': precondition -- a schema-less room.db file must exist on disk');

    const { stdout, status } = runDoctorJson(scratch, ['--json']);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const rd = densityCheck(stdout, label);
    assert.equal(rd.status, 'ok', label + ': the sweep must still return status "ok"');
    const bareRoom = roomEntry(rd, 'bare-db-room', label);
    assert.equal(bareRoom.node_count, 0, label + ': schema-less room must report 0 node rows');
    assert.equal(bareRoom.edge_count, 0, label + ': schema-less room must report 0 edge rows');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test8_forbiddenWordGuard() {
  // D-06: a count is a measurement, never a health judgment. SEED-074's hard
  // guard on downstream claims, made machine-checkable.
  const label = 'module: D-06 forbidden-word guard on the rendered detail';
  const forbidden = ['dense', 'sparse', 'density', 'risk', 'healthy', 'low', 'high'];
  try {
    assert.equal(typeof scenario4Detail === 'string' && scenario4Detail.length > 0, true,
      label + ': scenario 4 must have captured a non-empty detail string');
    const haystack = scenario4Detail.toLowerCase();
    for (const word of forbidden) {
      assert.equal(haystack.includes(word), false,
        label + ': detail must not contain "' + word + '". Got: ' + scenario4Detail);
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test9_absPathRegisteredRoomIsCounted() {
  // 232.1-REVIEW.md WR-01: resolveRoomPath must honor `abs_path` (the
  // canonical registry precedence field per resolve-active-room.cjs, used by
  // this same phase's own room_state integration), not just `path`. A room
  // registered abs_path-only is a real, common registry shape -- silently
  // skipping it would under-count the census this phase exists to make
  // trustworthy.
  const label = 'module: abs_path-registered room (no path key) is counted, not silently skipped';
  const scratch = makeScratchDir('abs-path-room');
  try {
    fs.mkdirSync(path.join(scratch, '.rooms'), { recursive: true });
    const absRoomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-232-1-absroom-'));
    seedRows(absRoomDir, 3, 2);
    writeRegistry(scratch, {
      active: 'abs-room',
      rooms: { 'abs-room': { abs_path: absRoomDir } },
    });

    try {
      const { stdout, status } = runDoctorJson(scratch, ['--json']);
      assert.equal(status, 0, label + ': doctor must exit 0 (graceful degradation)');
      const rd = densityCheck(stdout, label);
      assert.equal(rd.status, 'ok', label + ': status must be "ok" when the sweep completes');

      const absRoom = roomEntry(rd, 'abs-room', label);
      assert.equal(absRoom.node_count, 3,
        label + ': abs_path-registered room must report its 3 node rows, not be skipped');
      assert.equal(absRoom.edge_count, 2,
        label + ': abs_path-registered room must report its 2 edge rows, not be skipped');
      assert.equal(absRoom.has_db, true, label + ': abs_path-registered room must report has_db true');
      assert.equal(rd.totals.rooms, 1,
        label + ': totals.rooms must count the abs_path-only room (would be 0 before the WR-01 fix)');
      ok(label);
    } finally {
      rmrf(absRoomDir);
    }
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'Phase 232.1 room-graph density: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
