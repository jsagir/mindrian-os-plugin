'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-02 -- the synthetic-outcome Hedge convergence proof (Req 3, D-03).
 * ============================================================================
 * Six behaviors pin the Hedge/MWU layer end to end:
 *   1. PURE convergence: folding a consistently-lopsided loss vector through
 *      hedgeUpdate leaves the low-loss expert strictly heavier (SPEC Req 3).
 *   2. HELD-OUT argmax: with the converged weights, a fixture turn where the two
 *      experts disagree resolves to the low-loss expert's pick.
 *   3. ROW-DRIVEN fold: maybeUpdateHedgeWeights against a REAL temp room.db
 *      (no mocks: real openRoomDb + real navigation accessors) advances the
 *      weights AND the updateCount when >= N qualifying outcome rows exist.
 *   4. DEBOUNCE boundary (D-03): N-1 qualifying rows writes nothing.
 *   5. LOSS SKIP rules: deriveExpertLosses returns null for defer / missing /
 *      off-set reach_id rows (the caller drops them).
 *   6. hedgeUpdate GUARDS: a zero / non-finite weight sum returns equal weights.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-hedge-ranker.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

// Deterministic N: prove the SHIPPED default boundary (50), not an ambient env.
delete process.env.MINDRIAN_HEDGE_UPDATE_N;
delete process.env.MINDRIAN_HEDGE_ETA;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-222-hedge-update.cjs: synthetic-outcome Hedge convergence (Req 3, D-03)');

const N = ranker.HEDGE_UPDATE_N_DEFAULT;
const EXPERT_IDS = ranker.EXPERT_IDS;
const REACH_IDS = ranker.REACH_IDS;

// ---------------------------------------------------------------------------
// (1) PURE convergence: the consistently-right expert ends strictly heavier.
// ---------------------------------------------------------------------------
check('(1) fold 50 lopsided losses -> d4_blend strictly > registry_order, sum ~1', () => {
  let w = { d4_blend: 0.5, registry_order: 0.5 };
  for (let i = 0; i < 50; i += 1) {
    w = ranker.hedgeUpdate(w, { d4_blend: 0.1, registry_order: 0.9 }, ranker.HEDGE_ETA_DEFAULT);
  }
  assert.ok(w.d4_blend > w.registry_order,
    'the low-loss expert must dominate; got ' + JSON.stringify(w));
  const sum = w.d4_blend + w.registry_order;
  assert.ok(Math.abs(sum - 1) < 1e-9, 'weights must renormalize to 1, got ' + sum);
});

// ---------------------------------------------------------------------------
// (2) HELD-OUT argmax: converged weights pick the D4-preferred candidate.
// ---------------------------------------------------------------------------
check('(2) converged weights -> combined argmax matches the D4 expert pick (B)', () => {
  let w = { d4_blend: 0.5, registry_order: 0.5 };
  for (let i = 0; i < 50; i += 1) {
    w = ranker.hedgeUpdate(w, { d4_blend: 0.1, registry_order: 0.9 }, ranker.HEDGE_ETA_DEFAULT);
  }
  // A at index 0 (registry favors it, reg = 1), d4 = 0.4.
  // B at index 1 (reg = 0.5), d4 = 0.9. The D4 expert prefers B.
  const combinedA = w.d4_blend * 0.4 + w.registry_order * (1 / 1);
  const combinedB = w.d4_blend * 0.9 + w.registry_order * (1 / 2);
  assert.ok(combinedB > combinedA,
    'the D4-preferred candidate B must win under converged weights; A=' +
    combinedA + ' B=' + combinedB);
});

// ---------------------------------------------------------------------------
// (5) LOSS SKIP rules (pure, no db).
// ---------------------------------------------------------------------------
check('(5) deriveExpertLosses returns null for defer / missing / off-set reach_id', () => {
  assert.strictEqual(
    ranker.deriveExpertLosses({ reach_id: REACH_IDS[0], decision: 'defer' }, {}),
    null, 'defer must be skipped');
  assert.strictEqual(
    ranker.deriveExpertLosses({ decision: 'reject' }, {}),
    null, 'missing reach_id must be skipped');
  assert.strictEqual(
    ranker.deriveExpertLosses({ reach_id: 'not_a_reach', decision: 'reject' }, {}),
    null, 'off-set reach_id must be skipped');
  assert.strictEqual(
    ranker.deriveExpertLosses({ reach_id: REACH_IDS[0] }, {}),
    null, 'no decision must be skipped');
  // A valid reject row DOES produce a loss vector keyed by both experts.
  const losses = ranker.deriveExpertLosses({ reach_id: REACH_IDS[0], decision: 'reject' }, {});
  assert.ok(losses && typeof losses.d4_blend === 'number' && typeof losses.registry_order === 'number',
    'a valid reject row must yield finite losses for both experts');
});

// ---------------------------------------------------------------------------
// (6) hedgeUpdate GUARDS.
// ---------------------------------------------------------------------------
check('(6) hedgeUpdate with a zero-sum weight set returns equal weights over the keys', () => {
  const w = ranker.hedgeUpdate({ d4_blend: 0, registry_order: 0 },
    { d4_blend: 0.5, registry_order: 0.5 }, ranker.HEDGE_ETA_DEFAULT);
  assert.strictEqual(w.d4_blend, 0.5, 'zero-sum must fall back to equal weights');
  assert.strictEqual(w.registry_order, 0.5, 'zero-sum must fall back to equal weights');
});

// ---------------------------------------------------------------------------
// (3) ROW-DRIVEN fold against a REAL temp room.db (the no-mock leg).
// ---------------------------------------------------------------------------
check('(3) maybeUpdateHedgeWeights folds >= N reject rows -> registry_order < d4_blend, updateCount 1', () => {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hedge-fold-'));
  let db = null;
  try {
    db = openRoomDb(roomDir);
    // Seed N f_selector_decision rows: the registry expert is consistently WRONG
    // (it fully endorses REACH_IDS[0], which is always rejected).
    for (let i = 0; i < N; i += 1) {
      const res = navigation.logMemoryEvent(db, 'f_selector_decision', {
        reach_id: REACH_IDS[0],
        decision: 'reject',
      });
      assert.ok(res && res.ok, 'seed row must log, got ' + JSON.stringify(res));
    }
    const out = ranker.maybeUpdateHedgeWeights(db, {});
    assert.ok(out && out.updated === true, 'a >= N fold must report updated:true, got ' + JSON.stringify(out));
    const state = navigation.readHedgeWeightState(db);
    assert.ok(state, 'weight state must exist after the fold');
    assert.ok(state.weights.registry_order < state.weights.d4_blend,
      'the consistently-wrong registry expert must lose weight; got ' + JSON.stringify(state.weights));
    assert.strictEqual(state.updateCount, 1, 'updateCount must advance to 1, got ' + state.updateCount);
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------------------------------------------------------------------------
// (4) DEBOUNCE boundary: N-1 qualifying rows writes nothing (D-03).
// ---------------------------------------------------------------------------
check('(4) maybeUpdateHedgeWeights with N-1 rows returns updated:false and writes nothing', () => {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hedge-debounce-'));
  let db = null;
  try {
    db = openRoomDb(roomDir);
    for (let i = 0; i < N - 1; i += 1) {
      navigation.logMemoryEvent(db, 'f_selector_decision', {
        reach_id: REACH_IDS[0],
        decision: 'reject',
      });
    }
    const out = ranker.maybeUpdateHedgeWeights(db, {});
    assert.ok(out && out.updated === false, 'below N must report updated:false, got ' + JSON.stringify(out));
    const state = navigation.readHedgeWeightState(db);
    assert.strictEqual(state, null, 'nothing must be written below the N boundary, got ' + JSON.stringify(state));
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

console.log('');
console.log('PASS test-222-hedge-update.cjs (' + passed + ' checks)');
