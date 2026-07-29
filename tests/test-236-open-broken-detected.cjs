#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236-03 (GRAPHDB-02) -- typed BROKEN open detection at the openRoomDb chokepoint.
 * =====================================================================================
 *
 * The sibling of tests/test-236-open-busy-detected.cjs. That file proves a
 * CONTENDED room throws RoomDbBusyError; this one proves an UNUSABLE room throws
 * RoomDbBrokenError, and that the two are not the same result wearing two names.
 *
 * WHICH RECORDED OBSERVATIONS THIS FILE IS BUILT ON
 * -------------------------------------------------
 * The behavioral probe lives in the busy file (Task 1 ran it there, side by side,
 * so the shapes could be compared rather than each guessed in isolation). Read
 * its header for the verbatim record. The findings this file depends on, all
 * OBSERVED on process.version v22.23.1, none copied from a result-code table:
 *
 *   - A mid-migration failure throws errcode 1 ("SQL logic error"), from
 *     INSIDE the migration chain.
 *   - Garbage bytes throw errcode 26 ("file is not a database"), and NOT from
 *     the DatabaseSync construction: constructing a garbage file SUCCEEDS, and
 *     the failure surfaces at the `PRAGMA journal_mode = WAL` exec.
 *   - A truncated file throws errcode 11 ("database disk image is malformed").
 *     Garbage bytes and a torn file are DIFFERENT result codes, so both are
 *     asserted explicitly here rather than assumed to collapse into one.
 *   - A busy open throws errcode 5 from the SAME site as the mid-migration
 *     failure, which is why errcode, not throw site, is the discriminator.
 *   - "Genuinely absent" does NOT throw. fs.mkdirSync runs before the
 *     construction, so SQLite creates the file, the migrations run clean, and
 *     openRoomDb returns a usable handle.
 *
 * WHERE CORRUPTION LANDS, AND WHY THAT IS AN ASSERTION AND NOT A GUESS
 * --------------------------------------------------------------------
 * 236-03-PLAN.md asks this file to record which class corruption lands in, and
 * to say so plainly if the evidence cannot support an assertion. The evidence
 * DOES support one: corruption (26) and truncation (11) are distinct from busy
 * (5) on this runtime, so both are classified RoomDbBrokenError and scenario 3
 * asserts it. There was no need to weaken any assertion for want of evidence.
 *
 * MUTATION THAT TURNS THIS RED
 * ----------------------------
 * Two INDEPENDENT reversions each turn this file red. Both were actually run
 * during Task 3, then reverted; the red output below is what was observed, not
 * what was predicted.
 *
 *   (a) Revert lib/core/room-db.cjs to the bare pre-236 construction (delete
 *       classifyOpenFailure, both classes, and the two try/catch wrappers).
 *       Scenario 0 fails first, by name:
 *         FAIL AssertionError [ERR_ASSERTION]: 0. lib/core/room-db.cjs exports
 *         both typed classes
 *
 *   (b) Delete ONLY the `closeRoomDb(db)` line from the migration-chain catch
 *       in room-db.cjs, leaving classification fully intact. Scenario 6 fails on
 *       its own, independently of every other scenario:
 *         FAIL AssertionError [ERR_ASSERTION]: 6. no handle leak: the broken
 *         open threw AND left no extra open descriptor on the db file
 *         (before=0, after=3), proving Task 2 closed the handle before throwing
 *       The three leaked descriptors are room.db plus its -wal and -shm
 *       sidecars.
 *
 * NOT a mutation for this file: reinstating `catch (_e) { db = null; }` at
 * graph-derivation.cjs. That call site is exercised by the BUSY file's scenario
 * 5, not here. Said plainly rather than claimed loosely, because an unverified
 * mutation claim in a header is worse than none.
 *
 * A THIRD probe was tried for scenario 6 and REJECTED, recorded because the
 * rejection is the useful finding: asserting that a fresh connection can take a
 * write lock with timeout 0 stayed GREEN under mutation (b). A leaked handle
 * whose transaction already rolled back holds no write lock, so the leak was
 * real and that probe could not see it. See countOpenFds below.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOM_DB_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs');

const roomDbMod = require(ROOM_DB_PATH);
const { openRoomDb, closeRoomDb, RoomDbBusyError, RoomDbBrokenError } = roomDbMod;

// ---------------------------------------------------------------------------
// Discriminating tokens, each in a named const so a rename breaks loudly instead
// of silently passing. Every value below was OBSERVED by the busy file's probe
// on v22.23.1 and is quoted verbatim in that file's recorded-observation header.
// ---------------------------------------------------------------------------

// The identity-table sentinel whose removal gives the next opener real write
// work to do, so the migration chain is genuinely re-entered.
const PENDING_MIGRATION_SENTINEL = 'phase_109_session_focus_v1';

const SQLITE_BUSY = 5;        // observed: "database is locked"
const SQLITE_CORRUPT = 11;    // observed: "database disk image is malformed"
const SQLITE_NOTADB = 26;     // observed: "file is not a database"
const SQLITE_GENERIC = 1;     // observed: "SQL logic error" (mid-migration)

const BUSY_CLASS_NAME = 'RoomDbBusyError';
const BROKEN_CLASS_NAME = 'RoomDbBrokenError';

// The classification scalar Task 2 stamps on meta.
const CLASSIFICATION_BROKEN = 'broken';

// Canary seeded into the room's own content. Canon Part 8: this string must
// appear in NEITHER the thrown message NOR the serialized meta.
const ROOM_CONTENT_CANARY = 'CANARY-236-03-room-bytes-must-not-egress';

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

// try/catch harness: returns { err, res }. Never rethrows, so a scenario that
// WRONGLY succeeds reports a clean assertion failure instead of a stack.
function callAndCatch(fn) {
  try {
    return { err: null, res: fn() };
  } catch (e) {
    return { err: e, res: null };
  }
}

// The SQLite PRIMARY result code, read through the typed wrapper. The 0xff mask
// matches lib/core/room-db.cjs SQLITE_RESULT_CODE_MASK: node:sqlite can surface
// EXTENDED result codes whose low byte is the primary code.
function resultCodeOf(err) {
  if (!err) return null;
  if (typeof err.errcode === 'number') return err.errcode & 0xff;
  if (err.meta && typeof err.meta.errcode === 'number') return err.meta.errcode & 0xff;
  return null;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const scratchRoots = [];

function makeScratchRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-236-03-broken-' + label + '-'));
  scratchRoots.push(root);
  return root;
}

function dbPathOf(roomDir) {
  return path.join(roomDir, '.mindrian', 'room.db');
}

// Build a real, fully-migrated room.db and seed the Part 8 canary as room
// content so the leak assertions have something concrete to look for.
function seedRoom(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    db.prepare(
      'INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)'
    ).run('phase_236_canary', ROOM_CONTENT_CANARY, new Date().toISOString());
  } catch (_e) { /* identity shape drift is not this test's subject */ }
  try {
    db.prepare(
      'INSERT OR REPLACE INTO nodes (id, type, props) VALUES (?, ?, ?)'
    ).run('canary-236-node', 'Artifact', JSON.stringify({ body: ROOM_CONTENT_CANARY }));
  } catch (_e) { /* wide-schema variant */ }
  closeRoomDb(db);
}

// Inject a mid-migration throw: take the set_at column off the EXISTING
// session_focus table so phase-109-session-focus's CREATE INDEX cannot be
// reconciled. Deterministic, and it exercises the chained-migration path rather
// than the construction path.
//
// Deliberately an ALTER on the canonical table, never a DROP-and-recreate: the
// Phase 108 D-05 schema-drift guard reads a table-declaring statement in any
// staged file as a parallel schema being invented, and a test fixture has no
// business declaring a second shape for a canonical table even temporarily.
function injectMidMigrationThrow(roomDir) {
  const raw = new DatabaseSync(dbPathOf(roomDir), { timeout: 0 });
  raw.exec('DROP INDEX IF EXISTS idx_session_focus_set_at');
  raw.exec('ALTER TABLE session_focus DROP COLUMN set_at');
  raw.prepare('DELETE FROM identity WHERE key = ?').run(PENDING_MIGRATION_SENTINEL);
  raw.close();
}

// Drop the WAL sidecars so the main file is the only truth. Without this, SQLite
// can recover from -wal and the corruption never surfaces.
function dropSidecars(roomDir) {
  for (const suffix of ['-wal', '-shm']) {
    try { fs.unlinkSync(dbPathOf(roomDir) + suffix); } catch (_e) { /* absent */ }
  }
}

// Count THIS process's open file descriptors pointing at a room's db file (or
// its -wal / -shm sidecars).
//
// WHY fd counting and not a lock probe: a lock probe was tried first and proved
// NOTHING. Deleting the `closeRoomDb(db)` line from room-db.cjs's migration-chain
// catch left scenario 6 GREEN, because a leaked handle whose transaction already
// rolled back holds no write lock, so a fresh BEGIN IMMEDIATE still succeeds. The
// leak was real and the probe could not see it. Counting descriptors detects the
// leak directly instead of inferring it from a side effect it does not have.
//
// Linux-only (/proc/self/fd). Returns null where that is unavailable, and the
// scenario says so out loud rather than silently asserting nothing.
function countOpenFds(roomDir) {
  const target = dbPathOf(roomDir);
  let entries;
  try {
    entries = fs.readdirSync('/proc/self/fd');
  } catch (_e) {
    return null;
  }
  let n = 0;
  for (const entry of entries) {
    let link;
    try {
      link = fs.readlinkSync(path.join('/proc/self/fd', entry));
    } catch (_e) {
      continue; // the fd closed under us while scanning
    }
    if (link.indexOf(target) === 0) n += 1;
  }
  return n;
}

function cleanup() {
  for (const root of scratchRoots) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Scenarios (the typed-broken gate)
// ---------------------------------------------------------------------------

function scenarios() {
  console.log('scenarios (the typed-broken gate):');

  // Precondition, checked before anything else so reverting the classifier fails
  // HERE by name instead of blowing up later as a bare
  // "TypeError: Right-hand side of 'instanceof' is not an object".
  check('0. lib/core/room-db.cjs exports both typed classes',
    typeof RoomDbBusyError === 'function' && typeof RoomDbBrokenError === 'function'
    && RoomDbBusyError.name === BUSY_CLASS_NAME && RoomDbBrokenError.name === BROKEN_CLASS_NAME);

  // --- 1 and 2: a mid-migration throw is BROKEN, and is not busy. -----------
  const midRoom = makeScratchRoom('midmig');
  seedRoom(midRoom);
  injectMidMigrationThrow(midRoom);
  const mid = callAndCatch(() => openRoomDb(midRoom));
  if (mid.res) closeRoomDb(mid.res);

  check('1. a mid-migration throw produces a RoomDbBrokenError',
    mid.err instanceof RoomDbBrokenError
    && mid.err.meta.classification === CLASSIFICATION_BROKEN
    && resultCodeOf(mid.err) === SQLITE_GENERIC);

  // The mirror of the busy file's scenario 2. Both files assert the pair so the
  // distinguishability is proven from BOTH directions, not just one.
  check('2. that error is NOT a RoomDbBusyError (broken and busy are distinguishable)',
    !(mid.err instanceof RoomDbBusyError)
    && mid.err.name === BROKEN_CLASS_NAME
    && mid.err.name !== BUSY_CLASS_NAME
    && resultCodeOf(mid.err) !== SQLITE_BUSY);

  // --- 3: a corrupted file is typed too, not a bare error. ------------------
  // Two separate corruptions, because the probe observed they are DIFFERENT
  // SQLite result codes (26 vs 11) and the classifier must key both explicitly.
  const garbageRoom = makeScratchRoom('garbage');
  seedRoom(garbageRoom);
  dropSidecars(garbageRoom);
  fs.writeFileSync(dbPathOf(garbageRoom), Buffer.alloc(8192, 0x5a));
  const garbage = callAndCatch(() => openRoomDb(garbageRoom));
  if (garbage.res) closeRoomDb(garbage.res);

  const truncRoom = makeScratchRoom('trunc');
  seedRoom(truncRoom);
  dropSidecars(truncRoom);
  const whole = fs.readFileSync(dbPathOf(truncRoom));
  fs.writeFileSync(dbPathOf(truncRoom), whole.subarray(0, 100));
  const trunc = callAndCatch(() => openRoomDb(truncRoom));
  if (trunc.res) closeRoomDb(trunc.res);

  check('3. BOTH corruptions are RoomDbBrokenError and neither is busy: '
    + 'garbage bytes (SQLITE_NOTADB) and a truncated file (SQLITE_CORRUPT)',
    garbage.err instanceof RoomDbBrokenError
    && resultCodeOf(garbage.err) === SQLITE_NOTADB
    && !(garbage.err instanceof RoomDbBusyError)
    && trunc.err instanceof RoomDbBrokenError
    && resultCodeOf(trunc.err) === SQLITE_CORRUPT
    && !(trunc.err instanceof RoomDbBusyError));

  // --- 4: "no room db" is distinct from both typed classes. -----------------
  // ROADMAP criterion 3's third leg. Matching what the probe RECORDED rather
  // than what 236-RESEARCH.md's three-way framing assumed: absence does not
  // produce a distinct error, it produces NO error. The room opens. That is a
  // stronger separation than a third error class would have been, because a
  // caller does not even have to classify it.
  const absentRoom = makeScratchRoom('absent');
  const absent = callAndCatch(() => openRoomDb(absentRoom));
  check('4. a genuinely absent room.db is confusable with NEITHER typed class: '
    + 'it does not throw at all, it opens and returns a usable handle',
    absent.err === null
    && absent.res
    && !(absent.err instanceof RoomDbBrokenError)
    && !(absent.err instanceof RoomDbBusyError)
    && fs.existsSync(dbPathOf(absentRoom))
    && absent.res.prepare('SELECT count(*) AS n FROM identity').get().n >= 0);
  if (absent.res) closeRoomDb(absent.res);

  // --- 5: Canon Part 8 canary (T-236-08). ----------------------------------
  // Checked on the mid-migration error specifically, because that is the one
  // whose meta.causeMessage carries a real SQLite message from inside the room's
  // own schema, so it is the likeliest leak path of the three.
  const midMeta = JSON.stringify(mid.err.meta);
  const garbageMeta = JSON.stringify(garbage.err.meta);
  check('5. Part 8: the seeded room content leaks into NEITHER message NOR meta, '
    + 'for the mid-migration error or the corruption error',
    String(mid.err.message).indexOf(ROOM_CONTENT_CANARY) === -1
    && midMeta.indexOf(ROOM_CONTENT_CANARY) === -1
    && String(garbage.err.message).indexOf(ROOM_CONTENT_CANARY) === -1
    && garbageMeta.indexOf(ROOM_CONTENT_CANARY) === -1);

  // --- 6: no handle leak (T-236-10). ---------------------------------------
  // A DatabaseSync leaked by a throwing open holds an OS file descriptor and,
  // in the worst case, a lock that makes the NEXT open spuriously busy: one
  // broken room cascading into a jammed one. Task 2 closes the handle before
  // throwing, and this measures that directly.
  //
  // A fresh room is used rather than midRoom, so the before-count is taken on a
  // process that holds nothing against this file at all.
  const leakRoom = makeScratchRoom('leak');
  seedRoom(leakRoom);
  injectMidMigrationThrow(leakRoom);

  const fdsBefore = countOpenFds(leakRoom);
  const leaky = callAndCatch(() => openRoomDb(leakRoom));
  if (leaky.res) closeRoomDb(leaky.res);
  const fdsAfter = countOpenFds(leakRoom);

  if (fdsBefore === null || fdsAfter === null) {
    // Stated out loud instead of asserted vacuously. On a platform without
    // /proc/self/fd this leg is unproven, and pretending otherwise would be
    // exactly the false-green this phase exists to eliminate.
    check('6. no handle leak: UNPROVEN on this platform (/proc/self/fd unavailable), '
      + 'the broken open at least still threw the typed error',
      leaky.err instanceof RoomDbBrokenError);
  } else {
    check('6. no handle leak: the broken open threw AND left no extra open descriptor '
      + 'on the db file (before=' + fdsBefore + ', after=' + fdsAfter + '), '
      + 'proving Task 2 closed the handle before throwing',
      leaky.err instanceof RoomDbBrokenError && fdsAfter === fdsBefore);
  }
}

function main() {
  console.log('test-236-open-broken-detected (GRAPHDB-02: typed broken open)');
  console.log('  observed on ' + process.version + '\n');
  scenarios();
  console.log('\nPASS (' + pass + '/' + pass + ') -- the typed-broken gate holds');
}

try {
  main();
  cleanup();
} catch (e) {
  cleanup();
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
}
