'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-02 -- disclosed-degrade honesty (Req 7), against a REAL room.db.
 * =========================================================================
 * NO mocks. Each arm opens a throwaway room through the SHIPPED openRoomDb (real
 * 3-migration chain, real ranker_weights table) and drives the SHIPPED
 * rankFiredCandidates. SPEC Req 7 acceptance, implemented literally:
 *   (a) HEALTHY  -- valid weights -> a valid ranked result AND zero degrade events.
 *   (b) COLD     -- a fresh zero-row table -> valid ranked result, still zero events
 *                   (Pitfall 5: cold start stays silent).
 *   (c) CORRUPT  -- a negative weight scalar -> a valid D4-only ranked result AND
 *                   exactly one reach_weight_state_unavailable event, fault_kind
 *                   'corrupt_scalar'.
 *   (d) MISSING  -- the dropped table -> a valid ranked result AND exactly one
 *                   event, fault_kind 'read_fault'.
 *   (e) PAYLOAD  -- the emitted event carries enum/scalar tokens only (no value
 *                   longer than 64 chars, no property named reason -- Part 8).
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

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

const rooms = [];
const dbs = [];
function newRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-degrade-'));
  rooms.push(dir);
  const db = openRoomDb(dir);
  dbs.push(db);
  return db;
}

function fired() {
  return [
    { reach_id: 'context_block', posture: 'suggest' },
    { reach_id: 'contradiction', posture: 'suggest' },
  ];
}

function degradeEvents(db) {
  return navigation.findRecentChanges(db, 0, { eventType: 'reach_weight_state_unavailable' });
}

function assertValidRanking(out) {
  assert.ok(Array.isArray(out) && out.length === 2, 'a valid ranked result must be a 2-element array');
  const ids = out.map((r) => r.reach_id).sort();
  assert.deepStrictEqual(ids, ['context_block', 'contradiction'],
    'the ranking must be a permutation of the input candidates');
}

console.log('test-222-degrade.cjs: disclosed-degrade honesty against a real room.db (Req 7)');

try {
  // -------------------------------------------------------------------------
  // (a) HEALTHY -- valid weights, no event.
  // -------------------------------------------------------------------------
  check('(a) healthy weights -> valid ranking AND zero degrade events (the signal is honest)', () => {
    const db = newRoom();
    navigation.upsertHedgeWeightState(db, { d4_blend: 0.7, registry_order: 0.3 }, { updateCount: 1 });
    const out = ranker.rankFiredCandidates(fired(), { db: db, reachScores: { context_block: 0.9 } });
    assertValidRanking(out);
    assert.strictEqual(degradeEvents(db).length, 0, 'a healthy table must emit NO degrade event');
  });

  // -------------------------------------------------------------------------
  // (b) COLD START -- zero rows, no event.
  // -------------------------------------------------------------------------
  check('(b) cold start (zero rows) -> valid ranking AND zero degrade events (Pitfall 5)', () => {
    const db = newRoom();
    const out = ranker.rankFiredCandidates(fired(), { db: db });
    assertValidRanking(out);
    assert.strictEqual(degradeEvents(db).length, 0, 'cold start must stay silent');
  });

  // -------------------------------------------------------------------------
  // (c) CORRUPT SCALAR -- negative weight, one corrupt_scalar event.
  // -------------------------------------------------------------------------
  check('(c) corrupt scalar -> valid D4-only ranking AND exactly one corrupt_scalar event', () => {
    const db = newRoom();
    navigation.upsertHedgeWeightState(db, { d4_blend: 0.7, registry_order: 0.3 }, { updateCount: 1 });
    // Test-side direct SQL is the sanctioned fixture-corruption seam.
    db.prepare('UPDATE ranker_weights SET weight = -1').run();
    const out = ranker.rankFiredCandidates(fired(), { db: db, reachScores: { context_block: 0.9 } });
    assertValidRanking(out);
    const events = degradeEvents(db);
    assert.strictEqual(events.length, 1, 'a corrupt scalar must emit exactly one event, got ' + events.length);
    assert.strictEqual(events[0].properties.fault_kind, 'corrupt_scalar', 'wrong fault_kind for a corrupt scalar');
  });

  // -------------------------------------------------------------------------
  // (d) MISSING TABLE -- dropped table, one read_fault event.
  // -------------------------------------------------------------------------
  check('(d) missing table -> valid ranking AND exactly one read_fault event', () => {
    const db = newRoom();
    db.exec('DROP TABLE ranker_weights');
    const out = ranker.rankFiredCandidates(fired(), { db: db, reachScores: { context_block: 0.9 } });
    assertValidRanking(out);
    const events = degradeEvents(db);
    assert.strictEqual(events.length, 1, 'a missing table must emit exactly one event, got ' + events.length);
    assert.strictEqual(events[0].properties.fault_kind, 'read_fault', 'wrong fault_kind for a read fault');
  });

  // -------------------------------------------------------------------------
  // (e) PAYLOAD -- enum/scalar tokens only.
  // -------------------------------------------------------------------------
  check('(e) degrade payload carries enum/scalar tokens only (no long value, no reason field)', () => {
    const db = newRoom();
    db.exec('DROP TABLE ranker_weights');
    ranker.rankFiredCandidates(fired(), { db: db });
    const events = degradeEvents(db);
    assert.ok(events.length >= 1, 'the arm must have emitted a degrade event to inspect');
    const props = events[0].properties;
    for (const key of Object.keys(props)) {
      assert.notStrictEqual(key, 'reason', 'the payload must never carry a property named reason (Part 8)');
      const val = props[key];
      const isScalar = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean';
      assert.ok(isScalar, 'every payload value must be a scalar; ' + key + ' was ' + typeof val);
      if (typeof val === 'string') {
        assert.ok(val.length <= 64, 'no payload value may exceed 64 chars; ' + key + ' = ' + val);
      }
    }
  });

  console.log('');
  console.log('PASS test-222-degrade.cjs (' + passed + ' checks)');
} finally {
  for (const db of dbs) {
    try { closeRoomDb(db); } catch (_e) { /* best effort */ }
  }
  for (const dir of rooms) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}
