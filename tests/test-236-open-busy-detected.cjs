#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236-03 (GRAPHDB-02) -- typed BUSY open detection at the openRoomDb chokepoint.
 * ===================================================================================
 *
 * RECORDED OBSERVATIONS (Task 1 behavioral probe)
 * -----------------------------------------------
 * 236-RESEARCH.md rates the exact thrown-error shape LOW confidence and states
 * plainly that the fetched node:sqlite API pages do not enumerate the error
 * object thrown when a busy timeout is exceeded or a file is corrupt. So this
 * file OBSERVED the real shapes on this repo's actual runtime before any
 * classifier was written against them. The verbatim record lives below and is
 * the ONLY basis for lib/core/room-db.cjs's classifier.
 *
 * OBSERVED ON process.version v22.23.1 (this repo, this machine, 2026-07-29).
 * Verbatim JSON emitted by the probe() function below:
 *
 *   {
 *     "node": "v22.23.1",
 *     "lockMode": "BEGIN IMMEDIATE + write",
 *     "busy": {
 *       "constructor_name": "Error",
 *       "name": "Error",
 *       "code": "ERR_SQLITE_ERROR",
 *       "errcode": 5,
 *       "errstr": "database is locked",
 *       "message": "database is locked",
 *       "ownEnumerable": [ "code", "errcode", "errstr" ],
 *       "ownAll": [ "stack", "message", "code", "errcode", "errstr" ],
 *       "roomDbFrame": "at openRoomDb (.../lib/core/room-db.cjs:134:3)"
 *     },
 *     "busyThrew": true,
 *     "midMigration": {
 *       "constructor_name": "Error",
 *       "name": "Error",
 *       "code": "ERR_SQLITE_ERROR",
 *       "errcode": 1,
 *       "errstr": "SQL logic error",
 *       "message": "no such column: set_at",
 *       "ownEnumerable": [ "code", "errcode", "errstr" ],
 *       "ownAll": [ "stack", "message", "code", "errcode", "errstr" ],
 *       "roomDbFrame": "at openRoomDb (.../lib/core/room-db.cjs:134:3)"
 *     },
 *     "midMigrationThrew": true,
 *     "absentThrew": false,
 *     "absent": null,
 *     "absentReturnedHandle": true,
 *     "absentCreatedFile": true,
 *     "corrupt": {
 *       "constructor_name": "Error",
 *       "name": "Error",
 *       "code": "ERR_SQLITE_ERROR",
 *       "errcode": 26,
 *       "errstr": "file is not a database",
 *       "message": "file is not a database",
 *       "ownEnumerable": [ "code", "errcode", "errstr" ],
 *       "ownAll": [ "stack", "message", "code", "errcode", "errstr" ],
 *       "roomDbFrame": "at openRoomDb (.../lib/core/room-db.cjs:119:6)"
 *     },
 *     "corruptThrew": true,
 *     "truncated": {
 *       "constructor_name": "Error",
 *       "name": "Error",
 *       "code": "ERR_SQLITE_ERROR",
 *       "errcode": 11,
 *       "errstr": "database disk image is malformed",
 *       "message": "database disk image is malformed",
 *       "ownEnumerable": [ "code", "errcode", "errstr" ],
 *       "ownAll": [ "stack", "message", "code", "errcode", "errstr" ],
 *       "roomDbFrame": "at openRoomDb (.../lib/core/room-db.cjs:119:6)"
 *     },
 *     "truncatedThrew": true
 *   }
 *
 * (The roomDbFrame paths are abbreviated here with "..." for line width only.
 * Everything else is byte-verbatim. Run this file to re-emit the full record.)
 *
 * WHAT THE OBSERVATION SETTLES
 * ----------------------------
 * 1. THE THROWN OBJECT IS A PLAIN `Error`. constructor.name and name are both
 *    "Error" for all three failure cases, so NEITHER can discriminate. There is
 *    no node:sqlite-specific error subclass on this runtime.
 * 2. `code` IS USELESS FOR DISCRIMINATION. It is the constant string
 *    ERR_SQLITE_ERROR for busy, mid-migration and corrupt alike.
 * 3. `errcode` IS THE ONLY STABLE DISCRIMINATOR, and it is present as an own
 *    enumerable number on every case: busy=5, mid-migration=1, corrupt=26.
 *    `errstr` mirrors it in prose and is used only as a secondary, never as the
 *    primary key (SQLite prose strings are not a stable contract).
 * 4. THE THROW SITES ARE NOT WHERE 236-03-PLAN.md ASSUMED.
 *      - busy           -> room-db.cjs:134, INSIDE the migration chain, NOT at
 *                          the DatabaseSync construction. This confirms
 *                          236-RESEARCH.md Evidence F: an already-migrated
 *                          room.db needs no write lock, so busy only surfaces
 *                          once a migration actually needs to write.
 *      - mid-migration  -> room-db.cjs:134, the SAME site as busy. Busy and
 *                          broken are therefore NOT separable by throw site.
 *                          Only `errcode` separates them.
 *      - corrupt        -> room-db.cjs:119, the `PRAGMA journal_mode = WAL`
 *                          exec, NOT the construction and NOT the migrations.
 *                          Construction of a garbage-bytes file SUCCEEDS.
 *      - truncated      -> room-db.cjs:119 as well, errcode 11
 *                          ("database disk image is malformed"). Garbage bytes
 *                          and a torn file are DIFFERENT result codes (26 vs
 *                          11), so both are keyed explicitly rather than
 *                          assumed to collapse into one.
 *    CONSEQUENCE FOR THE CLASSIFIER (this is what Task 2 was built against):
 *    wrapping only the construction would catch NOTHING. The classifier must
 *    cover (a) construction plus the PRAGMA block, and (b) the migration chain,
 *    and the migration-chain catch must check busy BEFORE defaulting to broken.
 * 5. "GENUINELY ABSENT" IS NOT A REAL OPEN-FAILURE MODE AT room-db.cjs:117.
 *    Observed, not inherited from 236-RESEARCH.md's three-way framing:
 *    `absentThrew: false`, `absentReturnedHandle: true`,
 *    `absentCreatedFile: true`. Because `fs.mkdirSync(dbDir, {recursive:true})`
 *    at room-db.cjs:107 runs BEFORE the construction, SQLite creates the file
 *    and the migrations run clean. An absent room.db opens SUCCESSFULLY and
 *    returns a usable handle. It can therefore never be confused with busy or
 *    broken: those two THROW, absence does not. That is the whole of ROADMAP
 *    criterion 3's "distinguishable from no room db" leg on this runtime.
 * 6. A REAL WRITE LOCK IS REQUIRED, AND `BEGIN IMMEDIATE + write` WAS ENOUGH.
 *    No escalation to `PRAGMA locking_mode = EXCLUSIVE` was needed. Recorded
 *    because a plain open would NOT have produced contention under WAL.
 * 7. THE BUSY FAILURE IS FAST, NOT ~5 SECONDS. `timeout: 5000` at
 *    room-db.cjs:117-118 protects autocommit writes; SQLite skips the busy
 *    handler when invoking it could deadlock, which is exactly the
 *    deferred-BEGIN-then-write shape the migrations use. Assert on the typed
 *    class, never on elapsed time.
 *
 * POST-TASK-2 NOTE (added by Task 3, the record above is UNCHANGED)
 * -----------------------------------------------------------------
 * Everything above was observed BEFORE lib/core/room-db.cjs had a classifier,
 * which is the whole point: the classifier was built from it, not the other way
 * round. Two consequences for reading this file today:
 *
 *   a) openRoomDb now throws RoomDbBusyError / RoomDbBrokenError, so the raw
 *      `errcode` / `code` / `message` fields recorded above are no longer on the
 *      thrown object itself. Task 2 preserves the underlying discriminators as
 *      Part 8 safe scalars on `err.meta` (`errcode`, `causeName`,
 *      `causeMessage`), so the probe below still re-verifies every recorded
 *      finding on each run by reading through the wrapper. Nothing was weakened:
 *      the same numbers are still asserted, one indirection deeper.
 *   b) The `roomDbFrame` line numbers recorded above are PRE-FIX. Task 2 added
 *      the two try/catch wrappers, so those lines have shifted. The line numbers
 *      are historical evidence of WHERE the throws originated (which is what
 *      forced the two-wrapper design), not a live assertion.
 *
 * MUTATION THAT TURNS THIS RED
 * ----------------------------
 * Two INDEPENDENT reversions each turn this file red, and they hit DIFFERENT
 * scenarios. Both were actually run during Task 3, then reverted; the red output
 * below is what was observed, not what was predicted.
 *
 *   (a) Revert lib/core/room-db.cjs to the bare pre-236 construction (delete
 *       classifyOpenFailure, both classes, and the two try/catch wrappers).
 *       Scenario 0 fails first, by name:
 *         FAIL AssertionError [ERR_ASSERTION]: 0. lib/core/room-db.cjs exports
 *         both typed classes
 *       Scenario 0 exists precisely so this reversion reports a named assertion
 *       rather than the bare "TypeError: Right-hand side of 'instanceof' is not
 *       an object" it produced before that precondition was added.
 *
 *   (b) Reinstate `catch (_e) { db = null; }` at
 *       lib/core/graph-derivation.cjs:254-257. This does NOT touch the
 *       chokepoint, so scenarios 1 to 4 stay green; only the call-site scenario
 *       fails:
 *         FAIL AssertionError [ERR_ASSERTION]: 5. the demonstrated collapse site
 *         no longer swallows: runDerivation on a CONTENDED room propagates
 *         RoomDbBusyError instead of cold-starting with db = null
 *       Scenario 5 was added for exactly this reason. Without it, reversion (b)
 *       left every assertion in this file green while the originally reported
 *       defect walked straight back in, which is the failure mode this phase
 *       exists to eliminate.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOM_DB_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs');
const LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');

const roomDbMod = require(ROOM_DB_PATH);
const { openRoomDb, closeRoomDb, RoomDbBusyError, RoomDbBrokenError } = roomDbMod;

// The one demonstrated collapse site (graph-derivation.cjs:254-257), exercised
// directly by scenario 6 so a reinstated `catch (_e) { db = null; }` cannot pass
// this file.
const { runDerivation } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));

// ---------------------------------------------------------------------------
// Discriminating tokens, each in a named const so a rename breaks loudly
// instead of silently passing. Every one of these also appears verbatim in the
// recorded-observation block above.
// ---------------------------------------------------------------------------

// The identity-table sentinel whose removal gives a second opener REAL write
// work to do. Without pending write work an already-migrated room.db opens
// fine under an exclusive lock and the busy leg proves nothing
// (236-RESEARCH.md Pitfall 1).
const PENDING_MIGRATION_SENTINEL = 'phase_109_session_focus_v1';

// node:sqlite surfaces the SQLite result code on err.errcode. err.code is the
// constant string ERR_SQLITE_ERROR for every SQLite failure and cannot
// discriminate. The 0xff mask is mandatory: node:sqlite surfaces EXTENDED
// result codes (236-RESEARCH.md Evidence D observed 1299 and 275 elsewhere).
// Every value below was OBSERVED by this file's probe on v22.23.1, never
// copied from a table.
const SQLITE_ERROR_CODE = 'ERR_SQLITE_ERROR';
const SQLITE_BUSY = 5;        // observed: "database is locked"
const SQLITE_CORRUPT = 11;    // observed: "database disk image is malformed"
const SQLITE_NOTADB = 26;     // observed: "file is not a database"
const SQLITE_GENERIC = 1;     // observed: "SQL logic error" (mid-migration)

// The two typed classes this phase adds. Named here so a rename in
// lib/core/room-db.cjs breaks this file loudly instead of silently passing.
const BUSY_CLASS_NAME = 'RoomDbBusyError';
const BROKEN_CLASS_NAME = 'RoomDbBrokenError';

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

// Full own-enumerable-property census plus the fields a classifier could key on.
function describeError(err) {
  if (!err) return null;
  const meta = (err && err.meta && typeof err.meta === 'object') ? err.meta : null;
  return {
    constructor_name: err.constructor && err.constructor.name,
    name: err.name,
    code: err.code,
    errcode: err.errcode,
    errstr: err.errstr,
    message: err.message,
    ownEnumerable: Object.keys(err),
    ownAll: Object.getOwnPropertyNames(err),
    // WHERE inside openRoomDb the throw originated. This is what decides
    // whether the classifier must wrap the construction, the PRAGMA block, the
    // migration chain, or all three.
    roomDbFrame: firstRoomDbFrame(err),
    // Post-Task-2 read-through. openRoomDb now throws the typed wrapper, so the
    // raw SQLite discriminators live on meta as Part 8 safe scalars. Recorded
    // separately from the top-level fields so a reader can see plainly which
    // layer each value came from.
    meta: meta ? {
      classification: meta.classification,
      stage: meta.stage,
      errcode: meta.errcode,
      causeName: meta.causeName,
      causeMessage: meta.causeMessage,
    } : null,
  };
}

// The SQLite PRIMARY result code, wherever it currently lives: on the raw error
// (pre-Task-2 shape) or preserved on the typed wrapper's meta (post-Task-2).
// The 0xff mask matches lib/core/room-db.cjs SQLITE_RESULT_CODE_MASK: node:sqlite
// can surface EXTENDED result codes whose low byte is the primary code.
function sqliteResultCodeOf(described) {
  if (!described) return null;
  if (typeof described.errcode === 'number') return described.errcode & 0xff;
  if (described.meta && typeof described.meta.errcode === 'number') {
    return described.meta.errcode & 0xff;
  }
  return null;
}

// The UNDERLYING error's name and message, wherever they currently live. Used to
// keep asserting the original finding (the raw error cannot discriminate by
// name) now that a typed wrapper sits in front of it.
function causeNameOf(described) {
  if (!described) return null;
  if (described.meta && described.meta.causeName) return described.meta.causeName;
  return described.name;
}

function causeMessageOf(described) {
  if (!described) return null;
  if (described.meta && described.meta.causeMessage) return described.meta.causeMessage;
  return described.message;
}

function firstRoomDbFrame(err) {
  const stack = (err && err.stack) ? String(err.stack).split('\n') : [];
  for (const line of stack) {
    if (line.indexOf('room-db.cjs') !== -1) return line.trim();
  }
  for (const line of stack) {
    if (line.indexOf('/lib/core/') !== -1) return line.trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const scratchRoots = [];

function makeScratchRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-236-03-' + label + '-'));
  scratchRoots.push(root);
  return root;
}

// Build a real, fully-migrated room.db and seed the Part 8 canary as node
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
  } catch (_e) { /* wide-schema variant handled below */ }
  closeRoomDb(db);
}

// Remove one migration sentinel so the NEXT openRoomDb has genuine write work.
function makeMigrationPending(roomDir) {
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const raw = new DatabaseSync(dbPath, { timeout: 0 });
  raw.prepare('DELETE FROM identity WHERE key = ?').run(PENDING_MIGRATION_SENTINEL);
  raw.close();
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
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const raw = new DatabaseSync(dbPath, { timeout: 0 });
  raw.exec('DROP INDEX IF EXISTS idx_session_focus_set_at');
  raw.exec('ALTER TABLE session_focus DROP COLUMN set_at');
  raw.prepare('DELETE FROM identity WHERE key = ?').run(PENDING_MIGRATION_SENTINEL);
  raw.close();
}

function cleanup() {
  for (const root of scratchRoots) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

// Fork the lock holder and resolve once it reports the write lock is HELD.
function startLockHolder(roomDir) {
  return new Promise((resolve, reject) => {
    const child = fork(LOCK_HOLDER, [roomDir], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    child.on('message', (msg) => {
      if (msg && msg.ready && !settled) {
        settled = true;
        resolve({ child: child, mode: msg.mode });
      }
    });
    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        reject(new Error('lock holder exited before signalling ready, code=' + code));
      }
    });
  });
}

function stopLockHolder(handle) {
  return new Promise((resolve) => {
    if (!handle || !handle.child) return resolve();
    handle.child.on('exit', () => resolve());
    try { handle.child.send('release'); } catch (_e) { handle.child.kill(); }
  });
}

// ---------------------------------------------------------------------------
// PROBE: observe the three real shapes side by side. Runs on every execution so
// the record above can be re-verified when the Node version moves.
// ---------------------------------------------------------------------------

async function probe() {
  const observed = { node: process.version };

  // (a) BUSY: pending migration + a foreign write lock.
  const busyRoom = makeScratchRoom('probe-busy');
  seedRoom(busyRoom);
  makeMigrationPending(busyRoom);
  const holder = await startLockHolder(busyRoom);
  observed.lockMode = holder.mode;
  const busy = callAndCatch(() => openRoomDb(busyRoom));
  if (busy.res) closeRoomDb(busy.res);
  observed.busy = describeError(busy.err);
  observed.busyThrew = Boolean(busy.err);
  await stopLockHolder(holder);

  // (b) MID-MIGRATION throw.
  const brokenRoom = makeScratchRoom('probe-midmig');
  seedRoom(brokenRoom);
  injectMidMigrationThrow(brokenRoom);
  const mid = callAndCatch(() => openRoomDb(brokenRoom));
  if (mid.res) closeRoomDb(mid.res);
  observed.midMigration = describeError(mid.err);
  observed.midMigrationThrew = Boolean(mid.err);

  // (c) GENUINELY ABSENT: a room path with no .mindrian and no room.db.
  const absentRoom = makeScratchRoom('probe-absent');
  const absent = callAndCatch(() => openRoomDb(absentRoom));
  observed.absentThrew = Boolean(absent.err);
  observed.absent = describeError(absent.err);
  observed.absentReturnedHandle = Boolean(absent.res);
  observed.absentCreatedFile = fs.existsSync(path.join(absentRoom, '.mindrian', 'room.db'));
  if (absent.res) closeRoomDb(absent.res);

  // (d) CORRUPT: garbage bytes where a database should be.
  const corruptRoom = makeScratchRoom('probe-corrupt');
  seedRoom(corruptRoom);
  const corruptDbPath = path.join(corruptRoom, '.mindrian', 'room.db');
  for (const suffix of ['-wal', '-shm']) {
    try { fs.unlinkSync(corruptDbPath + suffix); } catch (_e) { /* absent */ }
  }
  fs.writeFileSync(corruptDbPath, Buffer.alloc(8192, 0x5a));
  const corrupt = callAndCatch(() => openRoomDb(corruptRoom));
  if (corrupt.res) closeRoomDb(corrupt.res);
  observed.corrupt = describeError(corrupt.err);
  observed.corruptThrew = Boolean(corrupt.err);

  // (e) TRUNCATED: a real SQLite header followed by nothing. Probed separately
  // from (d) because garbage bytes and a torn file are different SQLite result
  // codes, and the classifier must not assume they collapse into one.
  const truncRoom = makeScratchRoom('probe-trunc');
  seedRoom(truncRoom);
  const truncDbPath = path.join(truncRoom, '.mindrian', 'room.db');
  for (const suffix of ['-wal', '-shm']) {
    try { fs.unlinkSync(truncDbPath + suffix); } catch (_e) { /* absent */ }
  }
  const whole = fs.readFileSync(truncDbPath);
  fs.writeFileSync(truncDbPath, whole.subarray(0, 100));
  const trunc = callAndCatch(() => openRoomDb(truncRoom));
  if (trunc.res) closeRoomDb(trunc.res);
  observed.truncated = describeError(trunc.err);
  observed.truncatedThrew = Boolean(trunc.err);

  console.log('\n--- PHASE 236-03 PROBE RECORD (process.version ' + process.version + ') ---');
  console.log(JSON.stringify(observed, null, 2));
  console.log('--- END PROBE RECORD ---\n');

  // Pin every observed shape against its named constant. This is NOT a scenario
  // assertion: it is the guard that stops the recorded header drifting away
  // from what this runtime actually does. If node:sqlite changes an errcode,
  // this breaks loudly here instead of silently changing the classifier's
  // meaning in lib/core/room-db.cjs (threat T-236-09, misclassification).
  console.log('probe self-check (recorded shapes still hold on ' + process.version + '):');
  check('probe: busy is SQLITE_BUSY and the underlying message is "database is locked"',
    observed.busyThrew
    && sqliteResultCodeOf(observed.busy) === SQLITE_BUSY
    && causeMessageOf(observed.busy) === 'database is locked');
  check('probe: mid-migration is SQLITE_GENERIC, a DIFFERENT result code from busy',
    observed.midMigrationThrew
    && sqliteResultCodeOf(observed.midMigration) === SQLITE_GENERIC
    && sqliteResultCodeOf(observed.midMigration) !== sqliteResultCodeOf(observed.busy));
  check('probe: garbage bytes are SQLITE_NOTADB, truncation is SQLITE_CORRUPT',
    observed.corruptThrew && sqliteResultCodeOf(observed.corrupt) === SQLITE_NOTADB
    && observed.truncatedThrew && sqliteResultCodeOf(observed.truncated) === SQLITE_CORRUPT);
  check('probe: the UNDERLYING error still cannot discriminate by name (all are Error), '
    + 'which is why the classifier keys on errcode and not on a name or a code string',
    causeNameOf(observed.busy) === 'Error'
    && causeNameOf(observed.midMigration) === 'Error'
    && causeNameOf(observed.corrupt) === 'Error');
  // The evidence trail must stay attached to the code it justifies. Every value
  // the classifier keys on has to remain quoted VERBATIM in the recorded-
  // observation header above, so a reader can always find the observation a
  // given branch was built from (threat T-236-09, misclassification).
  check('probe: every discriminating token is still quoted verbatim in the recorded header',
    (function () {
      const self = fs.readFileSync(__filename, 'utf8');
      const header = self.slice(0, self.indexOf('MUTATION THAT TURNS THIS RED'));
      return [SQLITE_ERROR_CODE, String(SQLITE_BUSY), String(SQLITE_CORRUPT),
        String(SQLITE_NOTADB), String(SQLITE_GENERIC)]
        .every((token) => header.indexOf(token) !== -1);
    })());
  check('probe: genuinely absent is NOT an open-failure mode (mkdirSync at :107 creates it)',
    observed.absentThrew === false
    && observed.absentReturnedHandle === true
    && observed.absentCreatedFile === true);
  check('probe: the lock holder took a REAL write lock, not merely an open handle',
    typeof observed.lockMode === 'string' && observed.lockMode.indexOf('BEGIN IMMEDIATE') !== -1);
  console.log('');

  return observed;
}

// ---------------------------------------------------------------------------
// Scenarios (Task 3 completes these once the typed classes exist)
// ---------------------------------------------------------------------------

async function scenarios() {
  console.log('scenarios (the typed-busy gate):');

  // Precondition, checked before anything else so reverting the classifier fails
  // HERE by name instead of blowing up later as a bare
  // "TypeError: Right-hand side of 'instanceof' is not an object".
  check('0. lib/core/room-db.cjs exports both typed classes',
    typeof RoomDbBusyError === 'function' && typeof RoomDbBrokenError === 'function'
    && RoomDbBusyError.name === BUSY_CLASS_NAME && RoomDbBrokenError.name === BROKEN_CLASS_NAME);

  // One room carries the whole file: seeded with the Part 8 canary, put into a
  // pending-migration state so the next open has real write work, then contended.
  const room = makeScratchRoom('gate-busy');
  seedRoom(room);
  makeMigrationPending(room);

  const holder = await startLockHolder(room);
  const contended = callAndCatch(() => openRoomDb(room));
  if (contended.res) closeRoomDb(contended.res);

  check('1. a contended open throws RoomDbBusyError',
    contended.err instanceof RoomDbBusyError);

  // Not merely "both are typed": busy and broken must be TELLABLE APART, or the
  // caller is no better off than it was with a single null.
  check('2. that error is NOT a RoomDbBrokenError (busy and broken are distinguishable)',
    !(contended.err instanceof RoomDbBrokenError)
    && contended.err.name === BUSY_CLASS_NAME
    && contended.err.name !== BROKEN_CLASS_NAME);

  check('3. err.meta.roomDir is present and is the scratch room path',
    contended.err.meta && contended.err.meta.roomDir === path.resolve(room));

  // Canon Part 8 (T-236-08). The canary was seeded INTO the room's own rows by
  // seedRoom. An error that escapes into a log must not carry the room with it.
  const serializedMeta = JSON.stringify(contended.err.meta);
  check('4. Part 8: the seeded room content leaks into NEITHER the message NOR the meta',
    String(contended.err.message).indexOf(ROOM_CONTENT_CANARY) === -1
    && serializedMeta.indexOf(ROOM_CONTENT_CANARY) === -1);

  // --- 6: the DEMONSTRATED collapse site itself. ---------------------------
  // ROADMAP criterion 3: "the old cold-start collapse cannot be reproduced".
  // Scenarios 1 to 5 prove the chokepoint classifies; this one proves the one
  // call site that was demonstrably swallowing has stopped. Without this
  // scenario, reinstating `catch (_e) { db = null; }` at
  // graph-derivation.cjs:254-257 would leave every assertion in this file green
  // while the actual reported defect walked straight back in.
  //
  // Before Phase 236 this call returned a normal-looking trace with db = null,
  // and the composer proceeded as if a room with history had none. It must now
  // refuse loudly instead.
  const derivation = callAndCatch(() => runDerivation({
    roomDir: room,
    // Injected so the Phase 233-02 default-deriveFn gate is not what is being
    // measured here. The subject is the room OPEN, not the producer.
    deriveFn: () => [],
    artifactPairs: [],
  }));
  check('5. the demonstrated collapse site no longer swallows: runDerivation on a CONTENDED '
    + 'room propagates RoomDbBusyError instead of cold-starting with db = null',
    derivation.err instanceof RoomDbBusyError && derivation.res === null);

  await stopLockHolder(holder);

  // CONTROL. Without this, scenario 1 could be passing because the room is
  // broken in some unrelated way rather than because it is contended. The same
  // room, the same pending migration, the only difference is the lock holder.
  const uncontended = callAndCatch(() => openRoomDb(room));
  check('6. control: with the lock holder gone, the SAME room opens and returns a usable handle '
    + '(so the busy result was caused by contention, not by a broken room)',
    uncontended.err === null
    && uncontended.res
    && uncontended.res.prepare('SELECT count(*) AS n FROM identity').get().n >= 0);
  if (uncontended.res) closeRoomDb(uncontended.res);
}

async function main() {
  console.log('test-236-open-busy-detected (GRAPHDB-02: typed busy open)');
  await probe();
  await scenarios();
  console.log('\nPASS (' + pass + '/' + pass + ') -- PROBE-RECORDED and the typed-busy gate holds');
}

main()
  .then(() => { cleanup(); })
  .catch((e) => {
    cleanup();
    console.error('FAIL', e && e.stack ? e.stack : e);
    process.exit(1);
  });
