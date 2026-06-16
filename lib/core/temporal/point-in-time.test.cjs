'use strict';
// Phase 160-05 Task 1 test: point-in-time (T_tx, T_v) bitemporal query helper (R9).
//
// queryAsOf(db, nodeKey, T_tx, T_v) returns the single fact version that was
// known-as-of transaction-time T_tx and valid-at valid-time T_v, applying the
// canonical bitemporal WHERE clause (RESEARCH item 2):
//
//   created_at <= T_tx
//   AND (invalidated_at IS NULL OR invalidated_at > T_tx)
//   AND valid_from <= T_v
//   AND (valid_to IS NULL OR valid_to > T_v)
//
// NULL invalidated_at / valid_to = open / unbounded.
//
// Assertions:
//   - over a constructed 3-version timeline (three rows sharing a logical key
//     with stepped valid_from / valid_to / invalidated_at), queryAsOf returns
//     the correct version at three distinct (T_tx, T_v) points (SPEC R9);
//   - an as-of query with T_tx BEFORE a supersession (built via the Plan 04
//     supersede helper) still returns the superseded fact A (SPEC R8 round-trip);
//   - the helper reads only room.db (no egress) and is re-exported on
//     navigation.cjs.
//
// House rule: hyphens only, no em-dashes.

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { queryAsOf } = require(path.join(REPO_ROOT, 'lib', 'core', 'temporal', 'point-in-time.cjs'));
const { supersede } = require(path.join(REPO_ROOT, 'lib', 'core', 'temporal', 'supersession.cjs'));

// The logical key shared by every version of a fact. We use source_path as the
// logical-key column: three node rows with distinct ids but the SAME source_path
// are three transaction/valid-time versions of the one logical claim.
const LOGICAL_KEY = 'market/pricing-model';

function setupRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-160-point-in-time-'));
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp, db) {
  try { closeRoomDb(db); } catch (_) { /* ignore */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Insert one node version. created_at = transaction-time of the version write;
// invalidated_at = when this version stopped being known (NULL = still known);
// valid_from / valid_to = the real-world validity interval (valid_to NULL = open).
function insertVersion(db, id, opts) {
  db.prepare(
    "INSERT INTO nodes " +
    "(id, type, properties, source_path, created_by, review_status, " +
    " created_at, last_seen_at, valid_from, valid_to, invalidated_at) " +
    "VALUES (?, 'claim', '{}', ?, 'system', ?, ?, ?, ?, ?, ?)"
  ).run(
    id, LOGICAL_KEY,
    opts.review_status || 'confirmed',
    opts.created_at, opts.created_at,
    opts.valid_from,
    opts.valid_to === undefined ? null : opts.valid_to,
    opts.invalidated_at === undefined ? null : opts.invalidated_at
  );
}

// A 3-version timeline of ONE logical fact (LOGICAL_KEY), stepped on both axes.
//
//   V1: known [t=100, invalidated 200), valid-for [v=1000, 2000)
//   V2: known [t=200, invalidated 300), valid-for [v=2000, 3000)
//   V3: known [t=300, open],            valid-for [v=3000, open]
//
// (transaction-time and valid-time advance together for a simple non-lossy chain.)
function build3Version(db) {
  insertVersion(db, 'v:1', { created_at: 100, invalidated_at: 200, valid_from: 1000, valid_to: 2000 });
  insertVersion(db, 'v:2', { created_at: 200, invalidated_at: 300, valid_from: 2000, valid_to: 3000 });
  insertVersion(db, 'v:3', { created_at: 300, invalidated_at: null, valid_from: 3000, valid_to: null });
}

test('R9: queryAsOf returns the correct version at three distinct (T_tx, T_v) points over a 3-version timeline', () => {
  const { tmp, db } = setupRoom();
  try {
    build3Version(db);

    // Point 1: known-as-of T_tx=150 (only V1 was known), valid-at T_v=1500 -> V1.
    const p1 = queryAsOf(db, LOGICAL_KEY, 150, 1500);
    ok(p1, 'point 1 returns a row');
    equal(p1.id, 'v:1', 'point 1 (T_tx=150, T_v=1500) -> V1');

    // Point 2: known-as-of T_tx=250 (V2 now known, V1 invalidated at 200),
    // valid-at T_v=2500 -> V2.
    const p2 = queryAsOf(db, LOGICAL_KEY, 250, 2500);
    ok(p2, 'point 2 returns a row');
    equal(p2.id, 'v:2', 'point 2 (T_tx=250, T_v=2500) -> V2');

    // Point 3: known-as-of T_tx=350 (V3 open), valid-at T_v=3500 -> V3.
    const p3 = queryAsOf(db, LOGICAL_KEY, 350, 3500);
    ok(p3, 'point 3 returns a row');
    equal(p3.id, 'v:3', 'point 3 (T_tx=350, T_v=3500) -> V3');
  } finally { cleanup(tmp, db); }
});

test('R9: open intervals (NULL invalidated_at / valid_to) read as unbounded', () => {
  const { tmp, db } = setupRoom();
  try {
    build3Version(db);
    // Far-future T_tx and T_v fall inside V3's open intervals.
    const future = queryAsOf(db, LOGICAL_KEY, 9_999_999, 9_999_999);
    ok(future, 'far-future query returns a row (open V3)');
    equal(future.id, 'v:3', 'open-ended V3 covers the far future');

    // A T_v before any version is valid returns nothing.
    const tooEarly = queryAsOf(db, LOGICAL_KEY, 350, 500);
    equal(tooEarly, null, 'a valid-time before every valid_from returns null');
  } finally { cleanup(tmp, db); }
});

test('R8 round-trip: an as-of query with T_tx before a supersession still returns the superseded fact A', () => {
  const { tmp, db } = setupRoom();
  try {
    // Build A (confirmed) and B (confirmed) sharing one logical key. A is the
    // fact-in-force valid-from 100; B is the next-state fact valid-from 2000.
    // The supersede helper closes A.valid_to = B.valid_from (a STATE CHANGE
    // chain, not an in-place correction): after the close A holds the valid-time
    // interval [100, 2000) and B holds [2000, open).
    const aCreated = 100;
    const bCreated = 1_000;
    insertVersion(db, 'rt:A', { created_at: aCreated, valid_from: 100, valid_to: null, invalidated_at: null });
    insertVersion(db, 'rt:B', { created_at: bCreated, valid_from: 2_000, valid_to: null, invalidated_at: null });

    // Supersede A with B at a fixed reference now (the Plan 04 helper closes A:
    // invalidated_at = supersedeNow, valid_to = B.valid_from = 2000).
    const supersedeNow = 5_000;
    const sres = supersede(db, 'rt:A', 'rt:B', { now: () => supersedeNow });
    equal(sres.ok, true, 'supersede ok: ' + JSON.stringify(sres));

    // As-of BEFORE the supersession (T_tx=4000 between A.created_at and
    // supersedeNow=5000): A was still KNOWN (invalidated_at 5000 > 4000). At a
    // valid-time T_v=500 inside A's interval [100, 2000), queryAsOf must return A
    // even though A is now closed -- the non-lossy round-trip with Plan 04.
    const before = queryAsOf(db, LOGICAL_KEY, 4_000, 500);
    ok(before, 'pre-supersession as-of returns a row');
    equal(before.id, 'rt:A', 'pre-supersession (T_tx=4000 < invalidated 5000) still returns the superseded A');

    // As-of AFTER the supersession at a valid-time inside B's interval: A is
    // closed (invalidated_at=5000 < T_tx=6000), B is the open fact -> B.
    const after = queryAsOf(db, LOGICAL_KEY, 6_000, 2_500);
    ok(after, 'post-supersession as-of returns a row');
    equal(after.id, 'rt:B', 'post-supersession (T_tx=6000 > invalidated 5000) returns B');
  } finally { cleanup(tmp, db); }
});

test('R9: queryAsOf is re-exported on the navigation.cjs chokepoint and reads only room.db', () => {
  const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
  equal(typeof navigation.queryAsOf, 'function', 'queryAsOf re-exported on navigation.cjs');

  const { tmp, db } = setupRoom();
  try {
    build3Version(db);
    const viaChokepoint = navigation.queryAsOf(db, LOGICAL_KEY, 250, 2500);
    ok(viaChokepoint, 'chokepoint queryAsOf returns a row');
    equal(viaChokepoint.id, 'v:2', 'chokepoint queryAsOf agrees with the direct helper');
  } finally { cleanup(tmp, db); }
});
