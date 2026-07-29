#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260729-pnw (GRAPHDB-02 follow-up) -- the runGraphRefine CALL SITE.
 * ============================================================================
 *
 * WHAT THIS FILE GATES
 * --------------------
 * Exactly ONE call site: the room.db open inside runGraphRefine
 * (lib/core/graph-refine-loop.cjs, the pre-fix line 112). That site is the last
 * Tier A entry of .planning/phases/236-room-db-data-loss-fixes/
 * 236-openroomdb-callsite-census.md, which described it as byte-identical to the
 * defect Phase 236 had just fixed in graph-derivation.cjs and as the strongest
 * candidate for the next phase. This is that follow-up.
 *
 * The pre-fix code was a bare `catch (_e) { db = null; }`. It collapsed three
 * genuinely different states into one indistinguishable null:
 *   - the room is LOCKED by another session (transient, retryable),
 *   - the room is BROKEN and its migration chain cannot be reconciled (fatal),
 *   - the room is ABSENT (a legitimate cold start).
 * A refine run against a momentarily contended room therefore walked a null
 * neighborhood and returned a clean-looking {proposed, verified, written,
 * rounds} exactly as if the room had never held any history. That false-success
 * shape is the whole reason GRAPHDB-02 exists.
 *
 * WHY THE SUBJECT IS runGraphRefine AND NOT openRoomDb
 * ---------------------------------------------------
 * The chokepoint itself is already gated by tests/test-236-open-busy-detected.cjs
 * and tests/test-236-open-broken-detected.cjs: openRoomDb classifies, and it
 * throws RoomDbBusyError or RoomDbBrokenError. What was never gated is whether
 * THIS CALLER propagates that classification or quietly eats it. A classifier
 * whose every caller swallows the result is a classifier that changed nothing.
 * So every assertion below calls runGraphRefine, never openRoomDb (openRoomDb is
 * used only to build fixtures).
 *
 * ERROR SHAPES ARE NOT RE-PROBED HERE
 * -----------------------------------
 * tests/test-236-open-busy-detected.cjs recorded the real thrown shapes on this
 * runtime verbatim (v22.23.1: busy errcode 5, mid-migration 1, notadb 26,
 * truncated 11) and re-verifies them on every run. Duplicating that probe would
 * create a second place for the evidence to drift. Read that file for the shape
 * record; this file only asks whether the caller passes the classification on.
 *
 * CALLING CONVENTION, THE TWO WAYS THIS TEST COULD GO VACUOUS
 * ----------------------------------------------------------
 * 1. roomDir is the FIRST POSITIONAL argument of runGraphRefine, not a key in
 *    opts. Written as runGraphRefine({ roomDir, ... }) the object lands in the
 *    roomDir slot, fails the `typeof roomDir === 'string'` guard, and the room is
 *    never opened at all. Every call below passes roomDir positionally.
 * 2. focusNodeId and proposeFn are validated by EARLY RETURNS that run BEFORE the
 *    open. Omit either and the function returns an error object without ever
 *    touching the room. Every call below supplies both.
 * An inert getNeighborhoodFn is injected everywhere so the only variable across
 * scenarios is the state of the room, never the navigation layer.
 *
 * WHY THE PENDING MIGRATION IS LOAD-BEARING
 * -----------------------------------------
 * room.db runs in WAL mode, where an already-migrated database opens fine even
 * while another process holds an exclusive write lock. Without genuine pending
 * write work the busy leg would pass for the wrong reason (236-RESEARCH.md
 * Pitfall 1). makeMigrationPending removes one migration sentinel so the next
 * opener has real work to do, and only then does contention bite.
 *
 * MUTATION THAT TURNS THIS RED
 * ----------------------------
 * Reinstate the bare pre-fix swallow in lib/core/graph-refine-loop.cjs:
 *
 *     try {
 *       db = _roomDb().openRoomDb(roomDir);
 *       owned = true;
 *     } catch (_e) { db = null; }
 *
 * Scenario 1 fails, by name, on the busy-throws assertion. Scenario 0 and the
 * absent no-regression scenario 7 stay green under that mutation, which is what
 * localizes the red to this call site rather than to the harness or to the
 * chokepoint. Reverting lib/core/room-db.cjs instead fails scenario 0 first, by
 * name, rather than as a bare "TypeError: Right-hand side of 'instanceof' is not
 * an object".
 *
 * OBSERVED RED OUTPUT: pasted in below by the mutation run itself, verbatim.
 * Nothing is predicted here; the mutation is actually executed, and whatever it
 * printed is what appears.
 *
 *   (pending, filled by the executed mutation)
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
const REFINE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'graph-refine-loop.cjs');
const LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');

// openRoomDb / closeRoomDb are FIXTURE tools here. The subject is runGraphRefine.
const { openRoomDb, closeRoomDb, RoomDbBusyError, RoomDbBrokenError } = require(ROOM_DB_PATH);
const { runGraphRefine } = require(REFINE_PATH);

// ---------------------------------------------------------------------------
// Discriminating tokens, each in a named const so a rename breaks loudly instead
// of silently passing (the same discipline as test-236-open-busy-detected.cjs).
// ---------------------------------------------------------------------------

// The identity-table sentinel whose removal gives the next opener REAL write
// work. See "WHY THE PENDING MIGRATION IS LOAD-BEARING" above.
const PENDING_MIGRATION_SENTINEL = 'phase_109_session_focus_v1';

const BUSY_CLASS_NAME = 'RoomDbBusyError';
const BROKEN_CLASS_NAME = 'RoomDbBrokenError';

// The focus node the loop refines around. Any non-empty string clears the early
// return; the node need not exist, because the inert getNeighborhoodFn means the
// graph is never actually read.
const FOCUS_NODE_ID = 'refine-focus-236';

// Canon Part 8. Seeded into the room's OWN rows by seedRoom, then asserted absent
// from both the thrown message and the serialized meta. Deliberately distinct
// from the sibling file's canary so a cross-file copy/paste cannot mask a leak.
const ROOM_CONTENT_CANARY = 'CANARY-refine-loop-room-bytes-must-not-egress';

// The healthy return shape. Scenario 3 asserts a contended call does NOT produce
// it; scenario 7 asserts an absent room still does.
const RESULT_KEYS = ['proposed', 'verified', 'written', 'rounds'];

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

// Returns { err, res }, never rethrows, so a scenario that WRONGLY succeeds
// reports a clean named assertion failure instead of a raw stack.
function callAndCatch(fn) {
  try {
    return { err: null, res: fn() };
  } catch (e) {
    return { err: e, res: null };
  }
}

function hasResultShape(res) {
  if (!res || typeof res !== 'object') return false;
  return RESULT_KEYS.every((k) => Object.prototype.hasOwnProperty.call(res, k));
}

// ---------------------------------------------------------------------------
// Fixtures. Copied from tests/test-236-open-busy-detected.cjs with the names kept
// identical so the kinship is obvious to a reader: they are local functions
// there, not exports, so copying is the only option and a shared-helper
// extraction would mean editing that out-of-scope file.
// ---------------------------------------------------------------------------

const scratchRoots = [];

function makeScratchRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-pnw-' + label + '-'));
  scratchRoots.push(root);
  return root;
}

// A real, fully-migrated room.db carrying the Part 8 canary in its own rows.
function seedRoom(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    db.prepare(
      'INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)'
    ).run('pnw_refine_canary', ROOM_CONTENT_CANARY, new Date().toISOString());
  } catch (_e) { /* identity shape drift is not this test's subject */ }
  try {
    db.prepare(
      'INSERT OR REPLACE INTO nodes (id, type, props) VALUES (?, ?, ?)'
    ).run('canary-pnw-node', 'Artifact', JSON.stringify({ body: ROOM_CONTENT_CANARY }));
  } catch (_e) { /* wide-schema variant, not the subject */ }
  closeRoomDb(db);
}

// Remove one migration sentinel so the NEXT open has genuine write work.
function makeMigrationPending(roomDir) {
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const raw = new DatabaseSync(dbPath, { timeout: 0 });
  raw.prepare('DELETE FROM identity WHERE key = ?').run(PENDING_MIGRATION_SENTINEL);
  raw.close();
}

// Deterministic mid-migration failure: take set_at off the EXISTING session_focus
// table so the phase-109 CREATE INDEX cannot be reconciled (observed errcode 1,
// classified BROKEN). Deliberately an ALTER, never a DROP-and-recreate, because
// the Phase 108 D-05 schema-drift guard reads a table-declaring statement in a
// staged file as a parallel schema being invented.
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

// Fork the EXISTING Phase 236 lock holder (reused, never duplicated) and resolve
// once it reports the write lock is materially HELD.
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
// Scenarios
// ---------------------------------------------------------------------------

async function scenarios() {
  console.log('scenarios (the runGraphRefine call-site collapse gate):');

  // 0. Precondition FIRST, so a room-db.cjs reversion fails here by name rather
  // than later as a bare "TypeError: Right-hand side of 'instanceof' is not an
  // object".
  check('0. lib/core/room-db.cjs still exports both typed classes',
    typeof RoomDbBusyError === 'function' && typeof RoomDbBrokenError === 'function'
    && RoomDbBusyError.name === BUSY_CLASS_NAME && RoomDbBrokenError.name === BROKEN_CLASS_NAME);

  // ---- BUSY -------------------------------------------------------------
  // One room carries scenarios 1 to 5: seeded with the canary, put into a
  // pending-migration state so the next open has real write work, then contended
  // by a foreign write lock.
  const room = makeScratchRoom('refine-busy');
  seedRoom(room);
  makeMigrationPending(room);

  const holder = await startLockHolder(room);
  const contended = callAndCatch(() => runGraphRefine(room, {
    focusNodeId: FOCUS_NODE_ID,
    proposeFn: () => [],
    getNeighborhoodFn: () => [],
  }));

  check('1. a CONTENDED room makes runGraphRefine throw RoomDbBusyError instead of '
    + 'returning a normal-looking result built on db = null',
    contended.err instanceof RoomDbBusyError);

  // 2. Not merely "typed": busy and broken must be TELLABLE APART, or the caller
  // is no better off than it was with a single null. The .name check is belt and
  // braces for a duplicated-module-instance boundary where instanceof can fail.
  check('2. that error is NOT a RoomDbBrokenError, and its name is ' + BUSY_CLASS_NAME,
    !(contended.err instanceof RoomDbBrokenError)
    && contended.err.name === BUSY_CLASS_NAME
    && contended.err.name !== BROKEN_CLASS_NAME);

  // 3. The collapse SHAPE is provably absent.
  // Pre-fix behavior, observed and not assumed: with db = null the injected
  // getNeighborhoodFn returned [], proposeFn returned [], fresh.length === 0 broke
  // the loop on round 1, and runGraphRefine returned
  //   { proposed: [], verified: [], written: [], rounds: 1 }
  // which is indistinguishable from a healthy refine over an empty room. That is
  // the false success this gate exists to make impossible.
  check('3. no {proposed, verified, written, rounds} object came back from the contended '
    + 'call (the pre-fix collapse returned exactly that shape with rounds: 1)',
    contended.res === null && !hasResultShape(contended.res) && !hasResultShape(contended.err));

  // 4. Canon Part 8. The canary lives in the room's OWN rows; an error that
  // escapes this call site and lands in a caller's log must not carry the room
  // with it. This plan adds no meta fields, so the chokepoint's guarantee is
  // inherited here and re-asserted at the boundary where it actually escapes.
  const serializedMeta = JSON.stringify(contended.err.meta);
  check('4. Part 8: the seeded room content leaks into NEITHER the message NOR the meta',
    String(contended.err.message).indexOf(ROOM_CONTENT_CANARY) === -1
    && String(serializedMeta).indexOf(ROOM_CONTENT_CANARY) === -1);

  await stopLockHolder(holder);

  // 5. CONTROL. Same room, same pending migration, the ONLY difference is that
  // the lock holder is gone. Without this, scenario 1 could be passing because
  // the room is broken in some unrelated way rather than because it is contended.
  const uncontended = callAndCatch(() => runGraphRefine(room, {
    focusNodeId: FOCUS_NODE_ID,
    proposeFn: () => [],
    getNeighborhoodFn: () => [],
  }));
  check('5. control: with the lock holder gone the SAME room refines normally and returns '
    + 'its full result shape (so the busy result came from contention, not from damage)',
    uncontended.err === null
    && hasResultShape(uncontended.res)
    && uncontended.res.rounds >= 1);

  // ---- BROKEN -----------------------------------------------------------
  // 6. A separate room whose migration chain cannot be reconciled. No lock
  // holder: the failure is structural, not contention.
  const brokenRoom = makeScratchRoom('refine-broken');
  seedRoom(brokenRoom);
  injectMidMigrationThrow(brokenRoom);
  const broken = callAndCatch(() => runGraphRefine(brokenRoom, {
    focusNodeId: FOCUS_NODE_ID,
    proposeFn: () => [],
    getNeighborhoodFn: () => [],
  }));
  check('6. a BROKEN room makes runGraphRefine throw RoomDbBrokenError, and that error is '
    + 'NOT a RoomDbBusyError',
    broken.err instanceof RoomDbBrokenError
    && !(broken.err instanceof RoomDbBusyError)
    && broken.err.name === BROKEN_CLASS_NAME
    && broken.res === null);

  // ---- ABSENT (NO REGRESSION) -------------------------------------------
  // 7. Absence is NOT an open-failure mode on this runtime: openRoomDb runs
  // fs.mkdirSync(dbDir, {recursive: true}) before the SQLite construction, so an
  // absent room.db is CREATED and the open SUCCEEDS. That path must stay
  // byte-for-byte unchanged by this fix, and it is asserted rather than assumed.
  // The existsSync leg is the load-bearing one: it proves the open really ran and
  // succeeded rather than being skipped, which is what makes this a real
  // no-regression check instead of a tautology.
  const absentRoom = makeScratchRoom('refine-absent');
  const absent = callAndCatch(() => runGraphRefine(absentRoom, {
    focusNodeId: FOCUS_NODE_ID,
    proposeFn: () => [],
    getNeighborhoodFn: () => [],
  }));
  check('7. an ABSENT room does not throw, returns all four result keys with rounds >= 1, '
    + 'and the successful open actually created .mindrian/room.db on disk',
    absent.err === null
    && hasResultShape(absent.res)
    && absent.res.rounds >= 1
    && fs.existsSync(path.join(absentRoom, '.mindrian', 'room.db')) === true);
}

async function main() {
  console.log('test-236-refine-loop-open-detected '
    + '(GRAPHDB-02 follow-up: the runGraphRefine call site)');
  await scenarios();
  console.log('\nPASS (' + pass + '/' + pass + ') -- runGraphRefine propagates busy and broken, '
    + 'and an absent room still refines');
}

main()
  .then(() => { cleanup(); })
  .catch((e) => {
    cleanup();
    console.error('FAIL', e && e.stack ? e.stack : e);
    process.exit(1);
  });
