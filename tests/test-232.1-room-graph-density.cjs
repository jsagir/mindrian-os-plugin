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
 *        it would silently migrate every registered room.
 *     3. a room path containing #, % and ? still opens (the _fileUriPath
 *        escaper, not just the happy-path filename case).
 *
 * The one deliberate use of the MUTATING door (room-db.cjs::openRoomDb) is test
 * SETUP only: it is how a scratch room gets a realistic, fully migrated schema
 * to then be measured read-only. tests/ is on the check-substrate.cjs
 * ALLOWED_DIRECT_IMPORT list, so requiring room-db.cjs here is sanctioned.
 *
 * IIFE harness pattern from tests/test-doctor-class-b.cjs.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

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
// purpose (setup only) so the read-only assertions below run against realistic
// multi-table state, not a hand-rolled fixture.
function seedRealSchema(roomDir) {
  const handle = roomDb.openRoomDb(roomDir);
  roomDb.closeRoomDb(handle);
}

function schemaSnapshot(db) {
  return db.prepare('SELECT name, sql FROM sqlite_master ORDER BY name').all();
}

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
  const label = 'door: byte-identical regression -- read-only open never mutates room.db';
  const scratch = makeScratchDir('nomutate');
  try {
    seedRealSchema(scratch);
    const dbPath = roomDbPath(scratch);
    assert.equal(fs.existsSync(dbPath), true,
      label + ': precondition -- seeded room.db must exist');

    const beforeMtime = fs.statSync(dbPath).mtimeMs;

    const first = spineEvents.openRoomDbReadOnlyForCaller(scratch);
    assert.notEqual(first, null, label + ': read-only door must return a handle');
    const before = schemaSnapshot(first);
    assert.equal(before.length > 0, true,
      label + ': seeded room.db must carry a non-empty schema to make this test meaningful');
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

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'Phase 232.1 room-graph density: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
