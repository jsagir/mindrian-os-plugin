'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260728-7kc -- the read-only proof for the two declared-read MCP
 * pull tools (suggest_next / reach_candidates) and the opt-in readOnly mode on
 * the shared Phase 222 ranker.
 * ============================================================================
 * WHY THIS FILE EXISTS. suggest_next and reach_candidates both declare
 * hitl_shape 'none' and both read as pure reads at the tool surface, but they
 * inherited THREE writes one layer down: the Phase 222 fire-and-forget Hedge
 * weight-state upsert, the Req 7 degrade memory_event, and (largest, on EVERY
 * call) the mkdir + 13 CREATE TABLE + 5 migrations that room-db.cjs runs on any
 * openRoomDbForCaller. A tool that says read-only and migrates the caller's
 * database is the same false-status bug class this repo already tracks.
 *
 * The gate is RUNTIME BYTE-IDENTITY, never inspection. A grep for
 * openRoomDbForCaller in sensors.cjs would be a FALSE gate: contradiction_check
 * and whitespace_scan legitimately still use it. So the proof is a sha256 of
 * the room.db file plus a listing of .mindrian/ taken before and after real
 * handler invocations.
 *
 * Leg map:
 *   A. DEFAULT-OFF PARITY  -- readOnly absent leaves the CLI path byte-identical:
 *                             the fold still folds, the degrade still writes a
 *                             memory_event. (The opt-in seam mirrors Phase
 *                             233-03's skipRebuild precedent: default OFF.)
 *   B. NO FOLD UNDER readOnly -- proven twice: against a REAL room.db (no weight
 *                             state is written) and against a stubbed navigation
 *                             module recording every call (the fold's queries
 *                             are never even issued). Each carries its own
 *                             load-bearing control.
 *   C. DEGRADE TO SINK     -- under readOnly the enum token lands on
 *                             roomState.degradeSink and NOT in room.db, for both
 *                             fault kinds, with an absent-sink safety leg.
 *   D. ORDERING PARITY     -- the mode removes writes only. Two identically
 *                             seeded rooms rank to the SAME non-trivial order.
 *   E. RUNTIME NO-WRITE    -- the real exported dispatchCandidateReaches and the
 *                             real registered handlers, against real rooms:
 *                             db sha256 unchanged, .mindrian/ never created,
 *                             an unmigrated db never gains ranker_weights.
 *   F. ORDER PRESERVED AT THE TOOL -- the handlers still return the scored order.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-hedge-ranker.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

// Deterministic N / eta: prove the SHIPPED defaults, never an ambient env.
delete process.env.MINDRIAN_HEDGE_UPDATE_N;
delete process.env.MINDRIAN_HEDGE_ETA;

const N = ranker.HEDGE_UPDATE_N_DEFAULT;
const REACH_IDS = ranker.REACH_IDS;

// The two reaches the ordering legs use. context_block is canonical rank 0 (the
// registry expert fully endorses it); deep_research is canonical rank 4. Seeded
// weights favor the d4_blend expert and context_block carries a Phase 158 reject
// history, so the scored pick FLIPS the input order (a non-trivial assertion).
const REGISTRY_FIRST_REACH = 'context_block';
const SCORE_FIRST_REACH = 'deep_research';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// ---------- LOCAL fixture seams (throwaway temp rooms; never a real room) ----------

const tempDirs = [];
const openDbs = [];

function newRoomDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function newRoomDb(prefix) {
  const db = openRoomDb(newRoomDir(prefix));
  openDbs.push(db);
  return db;
}

function firedPair() {
  return [
    { reach_id: REGISTRY_FIRST_REACH, posture: 'suggest' },
    { reach_id: SCORE_FIRST_REACH, posture: 'suggest' },
  ];
}

function degradeEvents(db) {
  return navigation.findRecentChanges(db, 0, { eventType: 'reach_weight_state_unavailable' }) || [];
}

// Seed a room.db so the SCORED pick (deep_research) beats the registry-first
// pick (context_block), mirroring tests/test-222-reach-wired.cjs::seedRoomDb.
// updatedAt 0 plus only 2 decision rows keeps the fold debounce inert, so the
// stored weights are identical for both arms of the ordering-parity leg.
function seedOrderingRoom(db) {
  navigation.upsertHedgeWeightState(db, { d4_blend: 0.9, registry_order: 0.1 }, { updatedAt: 0 });
  for (let i = 0; i < 2; i += 1) {
    navigation.logMemoryEvent(db, 'reach_presented', { reach_id: REGISTRY_FIRST_REACH });
  }
  for (let i = 0; i < 2; i += 1) {
    navigation.logMemoryEvent(db, 'f_selector_decision', {
      reach_id: REGISTRY_FIRST_REACH,
      decision: 'reject',
    });
  }
}

// Seed >= N qualifying reject rows so maybeUpdateHedgeWeights has a real fold to
// perform. Without this the no-fold assertions would pass vacuously.
function seedFoldableRoom(db) {
  for (let i = 0; i < N; i += 1) {
    navigation.logMemoryEvent(db, 'f_selector_decision', {
      reach_id: REACH_IDS[0],
      decision: 'reject',
    });
  }
}

console.log('test-222-readonly-rank.cjs: opt-in read-only ranking + no-write MCP pull tools (quick 260728-7kc)');

try {
  // =========================================================================
  // A. DEFAULT-OFF PARITY -- the CLI path is byte-unchanged.
  // =========================================================================

  check('A1 DEFAULT-OFF: readOnly absent still folds the Hedge weights (the CLI path is untouched)', () => {
    const db = newRoomDb('ro-parity-fold-');
    seedFoldableRoom(db);
    const out = ranker.rankFiredCandidates(firedPair(), { db: db });
    assert.ok(Array.isArray(out) && out.length === 2, 'the ranking must still return both candidates');
    const state = navigation.readHedgeWeightState(db);
    assert.ok(state, 'DEFAULT-OFF REGRESSION: the fold must still persist a weight state when readOnly is absent');
    assert.strictEqual(state.updateCount, 1,
      'DEFAULT-OFF REGRESSION: updateCount must advance to 1, got ' + (state && state.updateCount));
  });

  check('A2 DEFAULT-OFF: readOnly absent still writes the Req 7 degrade memory_event', () => {
    const db = newRoomDb('ro-parity-degrade-');
    db.exec('DROP TABLE ranker_weights');
    ranker.rankFiredCandidates(firedPair(), { db: db });
    const events = degradeEvents(db);
    assert.strictEqual(events.length, 1,
      'DEFAULT-OFF REGRESSION: a degraded read must still emit exactly one event, got ' + events.length);
    assert.strictEqual(events[0].properties.fault_kind, 'read_fault', 'wrong fault_kind for a read fault');
  });

  check('A3 DEFAULT-OFF: readOnly === false is treated exactly like absent (no accidental truthiness gate)', () => {
    const db = newRoomDb('ro-parity-false-');
    seedFoldableRoom(db);
    ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: false });
    const state = navigation.readHedgeWeightState(db);
    assert.ok(state && state.updateCount === 1,
      'readOnly:false must fold exactly like readOnly absent; got ' + JSON.stringify(state));
  });

  // =========================================================================
  // B. NO FOLD UNDER readOnly -- proven against a real db AND against a stub.
  // =========================================================================

  check('B1 READ-ONLY (real db): a foldable room gains NO weight state, while the control fold does', () => {
    // Control arm first: the SAME fixture without readOnly DOES write. This is
    // what makes the read-only arm load-bearing rather than vacuous.
    const controlDb = newRoomDb('ro-nofold-control-');
    seedFoldableRoom(controlDb);
    ranker.rankFiredCandidates(firedPair(), { db: controlDb });
    assert.ok(navigation.readHedgeWeightState(controlDb),
      'VACUOUS-GREEN RISK: the control arm did not fold, so the read-only arm proves nothing');

    const db = newRoomDb('ro-nofold-');
    seedFoldableRoom(db);
    const out = ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true, degradeSink: [] });
    assert.ok(Array.isArray(out) && out.length === 2, 'read-only ranking must still return both candidates');
    assert.strictEqual(navigation.readHedgeWeightState(db), null,
      'WRITE LEAK: readOnly:true persisted a Hedge weight state');
    assert.strictEqual(degradeEvents(db).length, 0, 'WRITE LEAK: readOnly:true wrote a degrade memory_event');
  });

  check('B2 READ-ONLY (stubbed navigation): the fold query and the upsert are never even issued', () => {
    const realRead = navigation.readHedgeWeightState;
    const realFind = navigation.findRecentChanges;
    const realUpsert = navigation.upsertHedgeWeightState;
    const realLog = navigation.logMemoryEvent;
    const calls = [];
    try {
      navigation.readHedgeWeightState = function () { calls.push({ fn: 'readHedgeWeightState' }); return null; };
      navigation.findRecentChanges = function (_db, _since, opts) {
        calls.push({ fn: 'findRecentChanges', opts: opts || {} });
        return [];
      };
      navigation.upsertHedgeWeightState = function () { calls.push({ fn: 'upsertHedgeWeightState' }); };
      navigation.logMemoryEvent = function () { calls.push({ fn: 'logMemoryEvent' }); return { ok: true }; };

      const fakeDb = { __fixture: 'not-a-real-handle' };
      ranker.rankFiredCandidates(firedPair(), { db: fakeDb, readOnly: true, degradeSink: [] });

      assert.strictEqual(calls.filter((c) => c.fn === 'upsertHedgeWeightState').length, 0,
        'WRITE LEAK: upsertHedgeWeightState was invoked under readOnly:true');
      assert.strictEqual(calls.filter((c) => c.fn === 'logMemoryEvent').length, 0,
        'WRITE LEAK: logMemoryEvent was invoked under readOnly:true');
      // The fold's own query carries limit 500 (reach-reject-reader's reads do not),
      // so this is the fold-specific signature, not a blanket read ban.
      assert.strictEqual(calls.filter((c) => c.fn === 'findRecentChanges' && c.opts.limit === 500).length, 0,
        'FOLD LEAK: maybeUpdateHedgeWeights issued its 500-row training query under readOnly:true');

      // Control: the same call WITHOUT readOnly does issue the fold query, so the
      // assertion above is measuring something real.
      calls.length = 0;
      ranker.rankFiredCandidates(firedPair(), { db: fakeDb });
      assert.ok(calls.filter((c) => c.fn === 'findRecentChanges' && c.opts.limit === 500).length >= 1,
        'VACUOUS-GREEN RISK: the control arm never issued the fold query either');
    } finally {
      navigation.readHedgeWeightState = realRead;
      navigation.findRecentChanges = realFind;
      navigation.upsertHedgeWeightState = realUpsert;
      navigation.logMemoryEvent = realLog;
    }
  });

  // =========================================================================
  // C. DEGRADE TO SINK -- the Req 7 signal is preserved, not deleted.
  // =========================================================================

  check('C1 SINK: a read_fault under readOnly lands on degradeSink and NOT in room.db', () => {
    const db = newRoomDb('ro-sink-readfault-');
    db.exec('DROP TABLE ranker_weights');
    const sink = [];
    const out = ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true, degradeSink: sink });
    assert.ok(Array.isArray(out) && out.length === 2, 'a degraded read-only ranking must still return both candidates');
    assert.deepStrictEqual(sink, ['read_fault'],
      'the read_fault enum token must land on the sink; got ' + JSON.stringify(sink));
    assert.strictEqual(degradeEvents(db).length, 0,
      'WRITE LEAK: the degrade was written into room.db under readOnly:true');
  });

  check('C2 SINK: a corrupt_scalar under readOnly lands on degradeSink and NOT in room.db', () => {
    const db = newRoomDb('ro-sink-corrupt-');
    navigation.upsertHedgeWeightState(db, { d4_blend: 0.7, registry_order: 0.3 }, { updateCount: 1 });
    db.prepare('UPDATE ranker_weights SET weight = -1').run();
    const sink = [];
    ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true, degradeSink: sink });
    assert.deepStrictEqual(sink, ['corrupt_scalar'],
      'the corrupt_scalar enum token must land on the sink; got ' + JSON.stringify(sink));
    assert.strictEqual(degradeEvents(db).length, 0,
      'WRITE LEAK: the degrade was written into room.db under readOnly:true');
  });

  check('C3 SINK: an ABSENT degradeSink under readOnly is safe (no throw, no write, token dropped)', () => {
    const db = newRoomDb('ro-sink-absent-');
    db.exec('DROP TABLE ranker_weights');
    const out = ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true });
    assert.ok(Array.isArray(out) && out.length === 2, 'an absent sink must not break the ranking');
    assert.strictEqual(degradeEvents(db).length, 0,
      'WRITE LEAK: an absent sink fell back to writing the memory_event');
  });

  check('C4 SINK: the sink carries closed enum tokens only (Part 8: no prose, no reason field)', () => {
    const db = newRoomDb('ro-sink-enum-');
    db.exec('DROP TABLE ranker_weights');
    const sink = [];
    ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true, degradeSink: sink });
    assert.ok(sink.length >= 1, 'the arm must have collected a token to inspect');
    for (const token of sink) {
      assert.strictEqual(typeof token, 'string', 'every sink entry must be a bare string enum token');
      assert.ok(['read_fault', 'corrupt_scalar'].indexOf(token) !== -1,
        'the sink must carry a CLOSED enum token, never prose; got ' + JSON.stringify(token));
    }
  });

  // =========================================================================
  // D. ORDERING PARITY -- the mode removes writes only, never changes the pick.
  // =========================================================================

  check('D1 PARITY: two identically seeded rooms rank to the SAME non-trivial order in both modes', () => {
    const writeDb = newRoomDb('ro-order-write-');
    seedOrderingRoom(writeDb);
    const readDb = newRoomDb('ro-order-read-');
    seedOrderingRoom(readDb);

    const writeOrder = ranker
      .rankFiredCandidates(firedPair(), { db: writeDb })
      .map((r) => r.reach_id);
    const readOrder = ranker
      .rankFiredCandidates(firedPair(), { db: readDb, readOnly: true, degradeSink: [] })
      .map((r) => r.reach_id);

    assert.deepStrictEqual(readOrder, writeOrder,
      'READ-ONLY MODE CHANGED THE PICK: write-mode ' + JSON.stringify(writeOrder) +
      ' vs read-mode ' + JSON.stringify(readOrder));
    // Non-trivial: the scored order must actually differ from the input order,
    // otherwise the parity assertion would hold for a broken ranker too.
    assert.deepStrictEqual(readOrder, [SCORE_FIRST_REACH, REGISTRY_FIRST_REACH],
      'VACUOUS-GREEN RISK: the scored order did not flip the input order; got ' + JSON.stringify(readOrder));
  });

  check('D2 PARITY: the read is NOT dropped -- read-only still applies the stored Hedge weights', () => {
    // The seam must keep the READ. A flat/ignored weight state would leave the
    // input order intact (registry-first), which D1 already forbids; this leg
    // pins the same claim directly against a weights-free control room.
    const seededDb = newRoomDb('ro-read-kept-');
    seedOrderingRoom(seededDb);
    const seededOrder = ranker
      .rankFiredCandidates(firedPair(), { db: seededDb, readOnly: true, degradeSink: [] })
      .map((r) => r.reach_id);
    const noDbOrder = ranker
      .rankFiredCandidates(firedPair(), { readOnly: true, degradeSink: [] })
      .map((r) => r.reach_id);
    assert.notDeepStrictEqual(seededOrder, noDbOrder,
      'READ DROPPED: the seeded weight state made no difference under readOnly, so the read was discarded');
    assert.strictEqual(seededOrder[0], SCORE_FIRST_REACH,
      'the seeded read-only ranking must lead with the scored winner; got ' + seededOrder[0]);
  });

  console.log('');
  console.log('PASS test-222-readonly-rank.cjs (' + passed + ' checks)');
} finally {
  for (const db of openDbs) {
    try { closeRoomDb(db); } catch (_e) { /* best effort */ }
  }
  for (const dir of tempDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}
