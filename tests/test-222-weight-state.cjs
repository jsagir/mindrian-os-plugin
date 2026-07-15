'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-01 -- the REAL-CALL weight-state substrate proof (D-02).
 * =================================================================
 * NO mocks. This suite opens a throwaway room through the SHIPPED openRoomDb
 * (which runs the real 3-migration chain, creating ranker_weights) and drives the
 * SHIPPED navigation.cjs accessors -- readHedgeWeightState / upsertHedgeWeightState
 * / logMemoryEvent / findRecentChanges. A green run means the production read path
 * round-trips weight state, honors the cold-start (null, no throw) contract, and
 * accepts + reads back the Req 7 reach_weight_state_unavailable degrade event.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-222-weight-state.cjs: real openRoomDb + real navigation accessors (D-02)');

const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-weight-'));
let db = null;
try {
  db = openRoomDb(roomDir);

  check('(1) ranker_weights table exists after the real migration chain', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ranker_weights'"
    ).get();
    assert.ok(row && row.name === 'ranker_weights', 'ranker_weights table missing after openRoomDb');
  });

  check('(2) readHedgeWeightState returns null on a fresh (zero-row) table -- cold start, no throw', () => {
    const state = navigation.readHedgeWeightState(db);
    assert.strictEqual(state, null, 'cold start must read back null, got ' + JSON.stringify(state));
  });

  check('(3) upsert then read round-trips the exact weights + updateCount', () => {
    navigation.upsertHedgeWeightState(db, { d4_blend: 0.7, registry_order: 0.3 }, { updateCount: 1 });
    const state = navigation.readHedgeWeightState(db);
    assert.ok(state, 'state must be non-null after upsert');
    assert.strictEqual(state.weights.d4_blend, 0.7, 'd4_blend weight mismatch');
    assert.strictEqual(state.weights.registry_order, 0.3, 'registry_order weight mismatch');
    assert.strictEqual(state.updateCount, 1, 'updateCount mismatch');
  });

  check('(4) upserting again overwrites; row count stays 2', () => {
    navigation.upsertHedgeWeightState(db, { d4_blend: 0.6, registry_order: 0.4 }, { updateCount: 2 });
    const n = db.prepare('SELECT COUNT(*) AS c FROM ranker_weights').get().c;
    assert.strictEqual(n, 2, 'row count must stay 2 after overwrite, got ' + n);
    const state = navigation.readHedgeWeightState(db);
    assert.strictEqual(state.weights.d4_blend, 0.6, 'overwrite did not take for d4_blend');
    assert.strictEqual(state.updateCount, 2, 'updateCount did not advance');
  });

  check('(5) upsertHedgeWeightState throws on a non-finite weight (write-side validation)', () => {
    assert.throws(
      () => navigation.upsertHedgeWeightState(db, { d4_blend: NaN }, { updateCount: 3 }),
      /finite, non-negative number/,
      'NaN weight must be rejected at the write boundary'
    );
  });

  check('(5b) WR-02: upsertHedgeWeightState throws on a negative weight (write-side must match the read side\'s corruption definition)', () => {
    // readHedgeWeights in reach-hedge-ranker.cjs treats a stored v < 0 as a
    // corrupt_scalar degrade condition. Write-side validation must reject a
    // negative weight at the SAME boundary, not silently persist it only to
    // surface as a confusing corrupt_scalar event on a later, unrelated read.
    assert.throws(
      () => navigation.upsertHedgeWeightState(db, { d4_blend: -0.1, registry_order: 0.5 }, { updateCount: 3 }),
      /finite, non-negative number/,
      'a negative weight must be rejected at the write boundary'
    );
    // Confirm the rejected write did not partially land: state must be
    // unchanged from whatever check (4) left it at (all-or-nothing write).
    const state = navigation.readHedgeWeightState(db);
    assert.ok(state, 'state must still exist after the rejected write attempt');
    assert.strictEqual(state.weights.d4_blend, 0.6, 'a rejected negative-weight write must not have partially landed');
  });

  check('(6) reach_weight_state_unavailable is an accepted + readable memory_event (Req 7)', () => {
    const res = navigation.logMemoryEvent(db, 'reach_weight_state_unavailable', {
      fault_kind: 'read_fault',
      source: 'test',
    });
    assert.ok(res && res.ok, 'logMemoryEvent must accept reach_weight_state_unavailable, got ' + JSON.stringify(res));
    const rows = navigation.findRecentChanges(db, 0, { eventType: 'reach_weight_state_unavailable' });
    assert.strictEqual(rows.length, 1, 'exactly 1 degrade event must read back, got ' + rows.length);
    assert.strictEqual(rows[0].eventType, 'reach_weight_state_unavailable', 'wrong event type read back');
  });

  check('(7) re-opening the same room dir is a no-op (sentinel-idempotent migration)', () => {
    closeRoomDb(db);
    const db2 = openRoomDb(roomDir);
    try {
      // The previously-written weights survive the re-open (migration did not wipe them).
      const state = navigation.readHedgeWeightState(db2);
      assert.ok(state, 'weights must survive a re-open');
      assert.strictEqual(state.weights.d4_blend, 0.6, 'weights corrupted by re-open');
      const n = db2.prepare('SELECT COUNT(*) AS c FROM ranker_weights').get().c;
      assert.strictEqual(n, 2, 'row count changed across re-open (migration was not idempotent)');
    } finally {
      closeRoomDb(db2);
      db = null; // already closed above
    }
  });

  check('(8) CR-01 regression: upsertHedgeWeightState mid-transaction does NOT roll back the caller\'s own pending transaction', () => {
    // Reproduces the review's empirical repro against a REAL room db: open an
    // outer transaction on the SAME handle the ranker would be threaded (e.g.
    // ctx.roomDb through decide()), write something unrelated inside it, THEN
    // call upsertHedgeWeightState mid-transaction. Pre-fix this issued a nested
    // db.exec('BEGIN'), which throws on node:sqlite's DatabaseSync, and the
    // catch's unconditional ROLLBACK silently wiped the outer INSERT below. Post-
    // fix, db.isTransaction gates BEGIN/COMMIT/ROLLBACK: the upsert runs AS PART
    // OF the caller's already-open transaction and never issues its own ROLLBACK.
    const crRoomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-weight-crtx-'));
    let crDb = null;
    try {
      crDb = openRoomDb(crRoomDir);
      crDb.exec('CREATE TABLE caller_scratch (id INTEGER)');

      crDb.exec('BEGIN');
      assert.strictEqual(crDb.isTransaction, true, 'setup: the outer transaction must be open before the call under test');
      crDb.prepare('INSERT INTO caller_scratch (id) VALUES (?)').run(1);

      // The call under test: must NOT throw, and must NOT touch the caller's
      // transaction boundary (no BEGIN/COMMIT/ROLLBACK of its own).
      navigation.upsertHedgeWeightState(crDb, { d4_blend: 0.55, registry_order: 0.45 }, { updateCount: 9 });

      assert.strictEqual(crDb.isTransaction, true, 'the caller\'s transaction must still be open after the mid-transaction upsert');
      crDb.exec('COMMIT');

      const scratchCount = crDb.prepare('SELECT COUNT(*) AS c FROM caller_scratch').get().c;
      assert.strictEqual(scratchCount, 1, 'the caller\'s own pending INSERT must survive -- it must NOT be silently rolled back');

      const state = navigation.readHedgeWeightState(crDb);
      assert.ok(state, 'the mid-transaction upsert must still have persisted once the outer transaction committed');
      assert.strictEqual(state.weights.d4_blend, 0.55, 'the mid-transaction upsert value must persist correctly');
    } finally {
      if (crDb) { try { closeRoomDb(crDb); } catch (_e) { /* ignore */ } }
      try { fs.rmSync(crRoomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });

  console.log('');
  console.log('PASS test-222-weight-state.cjs (' + passed + ' checks)');
} finally {
  if (db) {
    try { closeRoomDb(db); } catch (_e) { /* already closed */ }
  }
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}
