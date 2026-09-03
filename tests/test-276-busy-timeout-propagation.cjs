#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 276-02 (TOOLHON-09, C4) -- busy-timeout propagation, the elapsed-time-floor proof.
 * =========================================================================================
 *
 * WAVE 0 IS RED BY DESIGN. Every elapsed-time assertion below is EXPECTED TO FAIL at the
 * end of this plan, because none of the census-A/B openers under test yet carry
 * `timeout: 5000`. The Node 22.16 busy-timeout fix lives at exactly one production opener
 * (lib/core/room-db.cjs:259-260). Bolting `{timeout:5000}` onto every constructor and
 * grepping for the literal would be a cosmetic pass (276-RESEARCH.md's own warning); the
 * honest measure is whether a contended write ACTUALLY WAITS, which is why every assertion
 * below pairs an outcome check with a measured `process.hrtime.bigint()` floor. On Node
 * 22.13-22.15 the `timeout` option is silently ignored while the module still loads, so a
 * return-value-only assertion would pass vacuously on such a runtime -- see the RUNTIME
 * FLOOR section.
 *
 * REUSE, NOT REINVENT: this file forks the SHIPPED Phase 236-03 lock holder
 * (tests/helpers/room-db-lock-holder-236.cjs, 121 lines) to create a genuine foreign write
 * lock. Do NOT author tests/helpers/held-write-lock.cjs; a second lock fixture would
 * reproduce, inside this phase's own suite, exactly the propagation gap the phase exists to
 * close (276-PATTERNS.md Shared Pattern 4). Its distinct exit codes are preserved verbatim:
 * exit 2 = could not open, exit 3 = could not acquire the write lock, so a child that never
 * actually locked the file can never be mistaken for one that did.
 *
 * TWO FIXTURE ROOMS, NOT ONE, AND WHY (empirically verified, not assumed):
 *
 *   1. `roomBare` -- a room whose .mindrian/room.db carries ONLY the `identity` table (the
 *      one the lock holder needs for its own INSERT), with NO lazygraph nodes/edges tables
 *      yet created. This is the ONLY fixture shape that makes A1
 *      (lazygraph-ops.cjs::openGraph -> initSchema) genuinely contend. Verified live before
 *      writing this file: a schema-init exec (CREATE, then TABLE, then IF NOT EXISTS) on a
 *      table that ALREADY EXISTS does NOT request the write lock and succeeds in ~0.1ms even
 *      while a foreign BEGIN IMMEDIATE is held (an already-migrated room needs no write lock,
 *      matching the room-db-lock-holder-236.cjs header's own stated Pitfall 1 reasoning); the
 *      SAME statement genuinely defining a brand-new table under the identical contention
 *      DOES throw "database is locked" (errcode 5). If `roomBare` were instead fully
 *      migrated first (so nodes/edges already exist), A1's assertion would pass vacuously
 *      today -- exactly the false-success shape this phase exists to eliminate. So the bare
 *      fixture is not an accident of convenience; it is the only fixture that keeps A1 an
 *      honest test.
 *   2. `roomFull` -- a fully migrated room (built via the real `openRoomDb`, so `identity`,
 *      the lazygraph `nodes`/`edges` tables, and the memory_event schema all already exist).
 *      A2-A5 write a FRESH event row via `logEvent`'s `INSERT INTO nodes (...)`, which is a
 *      genuinely new row every time and therefore genuinely requires the write lock
 *      regardless of schema state. Verified live: an `INSERT` on an existing table under an
 *      identical held lock throws "database is locked" in ~0.1ms, so this fixture is the
 *      correct one for A2-A5's assertions.
 *
 * A6 IS A SOURCE-LEVEL PIN, NOT A BEHAVIORAL ASSERTION, AND THE PLAN'S OWN CENSUS SAYS WHY.
 * 276-RESEARCH.md:940 classifies A6 (lib/core/venture-shape-nudge.cjs:97) as
 * "room.db (read-intent, opened read-write)" and its own recommendation is "propagate the
 * option, OR switch to the read-only door". This file's own read confirms
 * shouldSurfaceNudge() never writes -- it only opens a plain (non-`?mode=ro`) handle and
 * calls findRecentChanges (a SELECT). Verified live, before writing this assertion: a plain
 * `new DatabaseSync(dbPath)` open followed by a SELECT SUCCEEDS in under 1ms even while a
 * foreign connection holds BEGIN IMMEDIATE with an uncommitted write -- WAL readers never
 * block writers, and writers never block readers, which is the exact sentence
 * room-db.cjs:251 uses to justify NOT adding a busy timeout to a read-only path. An
 * elapsed-floor assertion on A6 would therefore never demonstrate anything: it would pass
 * with ~0ms elapsed BOTH before and after any timeout option is added, because the option
 * would never be exercised by a read. Forcing a behavioral assertion here would be the
 * inverse dishonesty this phase exists to close (a green check that proves nothing). A6 is
 * therefore pinned at the SOURCE level (the constructor line does not yet carry
 * `timeout: 5000`), exactly as the plan's own escape valve allows for "a module [whose
 * exercised path] has no exported entry that reaches its opener" under genuine contention.
 * Recorded as a deviation in 276-02-SUMMARY.md.
 *
 * B1-B3 ARE SOURCE-LEVEL PINS FOR A DIFFERENT, DOCUMENTED REASON. The plan's own action text
 * already flags B1 as "against a temp roomsHome, NOT a room.db" -- lib/core/cross-room-store.cjs,
 * lib/workflow/cross-room-umbilical-closer.cjs and lib/core/breakthrough/review-queue.cjs each
 * open a DIFFERENT sqlite file under <roomsHome>/.rooms/ (cross-room.db,
 * cross-room-rejections.db, breakthrough-review-queue.db respectively), none of which is
 * <roomDir>/.mindrian/room.db. The shipped room-db-lock-holder-236.cjs hardcodes the
 * <roomDir>/.mindrian/room.db path and expects an `identity` table matching room.db's schema;
 * it cannot target these three sibling databases without being extended, and extending or
 * forking it is exactly the second-lock-helper move this file is forbidden from making within
 * this plan's declared file scope (files_modified: the two test files only). So B1-B3 are
 * pinned at the source level, same mechanism as A6, recorded as a deviation in the SUMMARY.
 *
 * Every value below was OBSERVED on this repo, this machine, before being asserted:
 *   process.version at authoring time: v22.23.1 (>= the 22.16.0 floor).
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const lazygraphOps = require(path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
const selectorTelemetry = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-telemetry.cjs'));
const shapeF0 = require(path.join(REPO_ROOT, 'lib', 'hmi', 'shape-f0-renderer.cjs'));
const shapeF6 = require(path.join(REPO_ROOT, 'lib', 'hmi', 'shape-f6-plan-review-renderer.cjs'));

// Node 22.13-22.15 accept `timeout` and silently ignore it (module still loads); 22.16.0 is
// where node:sqlite's DatabaseSync `timeout` constructor option starts actually working
// (CLAUDE.md's own stated Node floor rationale). See RUNTIME FLOOR below.
const NODE_FLOOR = { major: 22, minor: 16, patch: 0 };

// Chosen per the plan's own justification: without a busy timeout, node:sqlite fails a
// contended write in roughly 0ms, so any figure comfortably above the noise floor and far
// below the 5000ms window proves the wait actually happened. 250 stays robust on a loaded
// machine while remaining impossible for a genuinely 0ms fast-fail (measured live above:
// unfixed contention throws in ~0.1-0.3ms).
const ELAPSED_FLOOR_MS = 250;

let pass = 0;
let fail = 0;
const failMessages = [];

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    pass += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (_e) {
    fail += 1;
    failMessages.push(label + (detail ? ' :: ' + detail : ''));
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

function finish() {
  process.stdout.write('\n  ' + pass + ' passed, ' + fail + ' failed\n');
  if (fail > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(fail === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const scratchRoots = [];
function makeScratchRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '276-busy-' + label + '-'));
  scratchRoots.push(root);
  return root;
}
function cleanup() {
  for (const root of scratchRoots) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

// The bare A1 fixture: ONLY the identity table (matching the lock holder's own INSERT OR
// REPLACE), deliberately WITHOUT the lazygraph nodes/edges schema so openGraph's
// initSchema() has genuine new-table write work to contend over.
function seedBareIdentityRoom(roomDir) {
  const dbDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'room.db');
  const raw = new DatabaseSync(dbPath, { timeout: 0 });
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec(
    'CREATE TABLE IF NOT EXISTS identity (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)'
  );
  raw.close();
}

// The full A2-A5 fixture: a genuinely, fully migrated room via the real openRoomDb, so every
// write below is a fresh-row INSERT against pre-existing tables (the shape that genuinely
// contends, verified live above).
function seedFullRoom(roomDir) {
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
}

// ---------------------------------------------------------------------------
// Lock holder plumbing (reused verbatim from tests/test-236-open-busy-detected.cjs)
// ---------------------------------------------------------------------------

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
        // HARD FAIL wording is deliberate and grepped by this plan's own acceptance
        // criteria: a child that exits with code 2 (could not open) or 3 (could not
        // acquire) before signalling ready means the lock was never held, so any busy
        // result observed during this run cannot be trusted. "The child started" must
        // never be read as "the lock is held".
        reject(new Error(
          'room-db-lock-holder-236 exited with code ' + code + ' before signalling ready: '
          + 'the lock was never held, so a busy result observed during this run cannot be trusted.'
        ));
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

// Times fn(), returning { result, err, ms }. Never rethrows: a genuinely thrown/rejected
// call is data for the assertion, not a crash of this harness.
async function elapsedCall(fn) {
  const t0 = process.hrtime.bigint();
  let result;
  let err = null;
  try {
    result = await fn();
  } catch (e) {
    err = e;
  }
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  return { result: result, err: err, ms: ms };
}

// ---------------------------------------------------------------------------
// Source-level pin helper (for A6, B1-B3, and the exclusion census Groups C/D)
// ---------------------------------------------------------------------------

function readSrc(relFile) {
  return fs.readFileSync(path.join(REPO_ROOT, relFile), 'utf8');
}

function pinNoTimeout(censusId, relFile, exactSnippet, reasonLabel) {
  const src = readSrc(relFile);
  const idx = src.indexOf(exactSnippet);
  check(
    censusId + ' (source-level pin, not behavioral) ' + relFile
    + ' opener does not yet carry timeout:5000 -- ' + reasonLabel,
    idx !== -1 && src.slice(idx, idx + 400).split('\n')[0].indexOf('timeout') === -1,
    'found at ' + relFile + ':offset ' + idx + (idx === -1 ? ' (snippet NOT FOUND, source drifted)' : '')
  );
}

// Presence counterpart of pinNoTimeout, for sites Phase 276-09 fixed at the option level
// without a behavioral elapsed-floor proof being reachable (a genuine read, or a sibling
// db file the shared lock helper cannot target). Checks the opener's constructor call
// itself (not merely anywhere in the file) carries `timeout: 5000`.
function pinHasTimeout(censusId, relFile, exactSnippet, reasonLabel) {
  const src = readSrc(relFile);
  const idx = src.indexOf(exactSnippet);
  check(
    censusId + ' (source-level pin, not behavioral) ' + relFile
    + ' opener carries timeout:5000 -- ' + reasonLabel,
    idx !== -1 && src.slice(idx, idx + 400).split('\n')[0].indexOf('timeout: 5000') !== -1,
    'found at ' + relFile + ':offset ' + idx + (idx === -1 ? ' (snippet NOT FOUND, source drifted)' : '')
  );
}

// ---------------------------------------------------------------------------
// RUNTIME FLOOR (Assertion group C)
// ---------------------------------------------------------------------------

function parseNodeVersion() {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(process.version);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function atLeast(v, floor) {
  if (v.major !== floor.major) return v.major > floor.major;
  if (v.minor !== floor.minor) return v.minor > floor.minor;
  return v.patch >= floor.patch;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('test-276-busy-timeout-propagation (TOOLHON-09, C4)');
  console.log('node --version: ' + process.version + ' (floor: v22.16.0)');

  const parsed = parseNodeVersion();
  const floorSatisfied = !!parsed && atLeast(parsed, NODE_FLOOR);
  check(
    'RUNTIME FLOOR: process.versions.node parses to at least v22.16.0 (measured '
    + process.version + '); below this floor node:sqlite silently IGNORES the timeout '
    + 'option while the module still loads, so a return-value-only assertion would pass '
    + 'vacuously',
    floorSatisfied,
    'parsed=' + JSON.stringify(parsed)
  );

  if (!floorSatisfied) {
    console.log('\n*** LOUD SKIP: runtime is below the v22.16.0 floor. Elapsed-time '
      + 'assertions are meaningless on this runtime and are SKIPPED, never reported green. ***\n');
    finish();
    return;
  }

  // ---------------------------------------------------------------------
  // Assertion group A: census A1-A6, elapsed-time floor per opener
  // ---------------------------------------------------------------------
  console.log('\n-- Assertion group A: census sites A1-A6 (elapsed-time floor) --');

  const roomBare = makeScratchRoom('bare-a1');
  seedBareIdentityRoom(roomBare);

  let holderBare = null;
  try {
    holderBare = await startLockHolder(roomBare);
  } catch (e) {
    check('A1 fixture: ' + e.message, false);
  }

  if (holderBare) {
    // A1: lazygraph-ops.cjs::openGraph -- async, returns {db, conn}. No graceful catch
    // around initSchema, so a contended schema-defining statement surfaces as a rejected promise.
    const { result, err, ms } = await elapsedCall(() => lazygraphOps.openGraph(roomBare));
    check(
      'A1 lazygraph-ops.cjs::openGraph(roomDir) under a held foreign write lock (a genuinely '
      + 'NEW table, not a no-op schema-init statement) rejects only after waiting at '
      + 'least ' + ELAPSED_FLOOR_MS + 'ms (measured ' + ms.toFixed(2) + 'ms)',
      !!err && ms >= ELAPSED_FLOOR_MS,
      'threw=' + (err ? err.message : 'NO, resolved instead: ' + JSON.stringify(!!result))
    );
    if (result && result.db) {
      try { await lazygraphOps.closeGraph(result.db); } catch (_e) { /* best effort */ }
    }
    await stopLockHolder(holderBare);
  }

  const roomFull = makeScratchRoom('full-a2a5');
  seedFullRoom(roomFull);

  let holderFull = null;
  try {
    holderFull = await startLockHolder(roomFull);
  } catch (e) {
    check('A2-A5 fixture: ' + e.message, false);
  }

  if (holderFull) {
    // A2: lib/hmi/selector-telemetry.cjs::recordSelectorMirror -- graceful envelope,
    // returns {ok:false, reason} rather than throwing. logEvent's own internal INSERT is
    // what contends.
    {
      const { result, ms } = await elapsedCall(() => Promise.resolve(
        selectorTelemetry.recordSelectorMirror(roomFull, 'selector_presentation', { sub_shape: 'F.1' })
      ));
      check(
        'A2 lib/hmi/selector-telemetry.cjs::recordSelectorMirror write path under a held lock '
        + 'reports failure only after waiting at least ' + ELAPSED_FLOOR_MS + 'ms (measured '
        + ms.toFixed(2) + 'ms)',
        !!result && result.ok === false && ms >= ELAPSED_FLOOR_MS,
        'result=' + JSON.stringify(result) + ' ms=' + ms.toFixed(2)
      );
    }

    // A3: lib/hmi/shape-f0-renderer.cjs::buildRejectedBecauseEdge.
    {
      const { result, ms } = await elapsedCall(() => Promise.resolve(
        shapeF0.buildRejectedBecauseEdge({
          roomDir: roomFull, reason: '276 contention probe', parent_decision_id: 'pd-276-a3',
        })
      ));
      check(
        'A3 lib/hmi/shape-f0-renderer.cjs::buildRejectedBecauseEdge write path under a held '
        + 'lock reports failure only after waiting at least ' + ELAPSED_FLOOR_MS + 'ms '
        + '(measured ' + ms.toFixed(2) + 'ms)',
        !!result && result.ok === false && ms >= ELAPSED_FLOOR_MS,
        'result=' + JSON.stringify(result) + ' ms=' + ms.toFixed(2)
      );
    }

    // A4: lib/hmi/shape-f6-plan-review-renderer.cjs::buildReviewedEdge.
    {
      const { result, ms } = await elapsedCall(() => Promise.resolve(
        shapeF6.buildReviewedEdge({
          roomDir: roomFull, round_id: 'r-276-a4', position: 1, was_decoy: false, response: 'confirm',
        })
      ));
      check(
        'A4 lib/hmi/shape-f6-plan-review-renderer.cjs::buildReviewedEdge write path under a '
        + 'held lock reports failure only after waiting at least ' + ELAPSED_FLOOR_MS + 'ms '
        + '(measured ' + ms.toFixed(2) + 'ms)',
        !!result && result.ok === false && ms >= ELAPSED_FLOOR_MS,
        'result=' + JSON.stringify(result) + ' ms=' + ms.toFixed(2)
      );
    }

    // A5: lib/hmi/shape-f6-plan-review-renderer.cjs::emitRoundCompleted.
    {
      const { result, ms } = await elapsedCall(() => Promise.resolve(
        shapeF6.emitRoundCompleted({
          roomDir: roomFull, round_id: 'r-276-a5', real_count: 1, decoy_count: 0, tier: 'x',
        })
      ));
      check(
        'A5 lib/hmi/shape-f6-plan-review-renderer.cjs::emitRoundCompleted write path under a '
        + 'held lock reports failure only after waiting at least ' + ELAPSED_FLOOR_MS + 'ms '
        + '(measured ' + ms.toFixed(2) + 'ms)',
        !!result && result.ok === false && ms >= ELAPSED_FLOOR_MS,
        'result=' + JSON.stringify(result) + ' ms=' + ms.toFixed(2)
      );
    }

    await stopLockHolder(holderFull);
  }

  // A6: source-level pin. See header for the empirically-verified WAL-reader-never-blocks
  // finding that makes a behavioral assertion here meaningless (RESEARCH:940 census entry).
  // Phase 276-09 added the option here for correctness (the site is opened read-write, not
  // via the read-only door) even though this read-intent path never measurably waits on it;
  // the pin is therefore a PRESENCE check post-fix, not an absence check.
  pinHasTimeout(
    'A6', 'lib/core/venture-shape-nudge.cjs', 'db = new DatabaseSync(dbPath, { timeout: 5000 });',
    'read-intent opener; verified live that a plain read succeeds in <1ms under a held '
    + 'foreign write lock (WAL readers never block writers), so an elapsed-floor assertion '
    + 'would pass vacuously both before and after the timeout option is present; the option '
    + 'is added for correctness on the read-write door regardless'
  );

  // ---------------------------------------------------------------------
  // Assertion group A (continued): B1-B3 source-level pins.
  // ---------------------------------------------------------------------
  console.log('\n-- census sites B1-B3 (source-level pin: different db file than room.db) --');

  pinNoTimeout(
    'B1', 'lib/core/cross-room-store.cjs', 'db = new DatabaseSync(storeDbPath(roomsHome));',
    'opens <roomsHome>/.rooms/cross-room.db, NOT room.db; the shipped '
    + 'room-db-lock-holder-236.cjs hardcodes the room.db path and cannot target this sibling '
    + 'database without being extended, which this plan\'s declared file scope forbids'
  );
  pinNoTimeout(
    'B2', 'lib/workflow/cross-room-umbilical-closer.cjs',
    'db = new DatabaseSync(rejectionDbPath(roomsHome));',
    'opens <roomsHome>/.rooms/cross-room-rejections.db, NOT room.db; same reasoning as B1'
  );
  pinNoTimeout(
    'B3', 'lib/core/breakthrough/review-queue.cjs', 'const db = new DatabaseSync(dbPath);',
    'opens <roomsHome>/.rooms/breakthrough-review-queue.db, NOT room.db; same reasoning as B1'
  );

  // ---------------------------------------------------------------------
  // Assertion group B: the exclusion census (census Groups C and D)
  // ---------------------------------------------------------------------
  console.log('\n-- Assertion group B: exclusion census, Groups C and D --');

  const REASON_READONLY = 'WAL readers never block writers, so a busy timeout on a '
    + 'read-only handle buys nothing (room-db.cjs:251\'s own stated reason)';
  const REASON_INMEMORY = 'an in-memory :memory: database has no file-level lock to contend '
    + 'over, so a busy timeout is meaningless here';

  // Group C: read-only openers.
  pinNoTimeout('C', 'lib/core/session-presence.cjs', "conn = new DatabaseSync('file:' + dbPath + '?mode=ro');", REASON_READONLY);
  pinNoTimeout('C', 'lib/core/coverage-rollup.cjs', "conn = new DatabaseSync('file:' + dbPath + '?mode=ro');", REASON_READONLY);
  pinNoTimeout('C', 'lib/core/graph-derivation.cjs', "parentConn = new DatabaseSync('file:' + _fileUriPath(parentDbPath) + '?mode=ro');", REASON_READONLY);
  pinNoTimeout('C', 'lib/core/navigation/spine-events.cjs', "return new DatabaseSync('file:' + _fileUriPath(dbPath) + '?mode=ro');", REASON_READONLY);
  pinNoTimeout('C', 'lib/core/chat-context-builder.cjs', 'const db = new DatabaseSync(dbPath, { readOnly: true });', REASON_READONLY);
  pinNoTimeout('C', 'lib/core/proactive-intelligence.cjs', 'const db = new DatabaseSync(dbPath, { open: true, readOnly: true });', REASON_READONLY);

  // Group D: in-memory openers.
  pinNoTimeout('D', 'lib/core/eureka/tri-modal-index.cjs', "return new DatabaseSync(':memory:');", REASON_INMEMORY);
  pinNoTimeout('D', 'lib/core/doctor/class-s-eureka-smoke.cjs', "db = new DatabaseSync(':memory:', { allowExtension: true });", REASON_INMEMORY);
  pinNoTimeout('D', 'lib/core/doctor/class-s-eureka-smoke.cjs', "try { db = new DatabaseSync(':memory:'); } catch (e2) {", REASON_INMEMORY);
  pinNoTimeout('D', 'scripts/doctor.cjs', "version = new DatabaseSync(':memory:').prepare('select sqlite_version() as v').get().v;", REASON_INMEMORY);

  cleanup();
  finish();
}

main().catch((e) => {
  cleanup();
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
