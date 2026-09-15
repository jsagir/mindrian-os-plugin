'use strict';
// Phase 346-05 -- make the arbitration decision auditable: one logged row per
// turn, written through the navigation chokepoint, carrying enum tokens only,
// deduped, and recording whether the posture flipped (ARB-07/ARB-08).
//
// Three tasks land in this one file, in order:
//   Task 1: 'arbitration_decided' joins the frozen EVENT_TYPES Set.
//   Task 2: lib/core/navigation/arbitration-log.cjs -- the enum-only payload,
//     the dedupe key, the flip comparison.
//   Task 3: the one thin additive re-export on lib/core/navigation.cjs.
//
// Hermetic isolation (mirrors tests/test-209-incident-replay.cjs's own stated
// discipline): every test in this file opens its OWN fs.mkdtempSync temp
// room, via lib/core/room-db.cjs::openRoomDb, and closes + removes it in a
// finally block. This file NEVER touches a real room and NEVER touches
// ~/.mindrian/.
//
// House idiom: node:assert/strict, `let n = 0; function ok(desc, fn)`, final
// line '>>> test-346-arbitration-event.cjs: PASSED'.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const memoryEvents = require(path.join(REPO, 'lib', 'core', 'navigation', 'memory-events.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

/**
 * Open a hermetic temp room.db, run fn(db), always clean up. Never touches a
 * real room and never touches ~/.mindrian/ (tests/test-209-incident-replay.cjs
 * discipline).
 * @param {(db: object) => void} fn
 */
function withHermeticRoom(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-346-arb-log-'));
  const handle = roomDb.openRoomDb(tmp);
  try {
    fn(handle.db || handle);
  } finally {
    roomDb.closeRoomDb(handle);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('test-346-arbitration-event');

// ---------------------------------------------------------------------------
// Task 1: 'arbitration_decided' joins the frozen EVENT_TYPES Set.
// ---------------------------------------------------------------------------

ok('EVENT_TYPES is frozen and has arbitration_decided', function () {
  assert.ok(Object.isFrozen(memoryEvents.EVENT_TYPES));
  assert.ok(memoryEvents.EVENT_TYPES.has('arbitration_decided'));
});

ok('every event type that existed before this plan is still a member (named floor, not a count)', function () {
  const floor = [
    'node_created', 'edge_added', 'focus_changed', 'brain_suggestion_received',
    'tension_detected', 'auto_explore_fired', 'brain_cmdmap_divergence',
    'strategy_proposed', 'strategy_throttled',
  ];
  floor.forEach(function (t) {
    assert.ok(memoryEvents.EVENT_TYPES.has(t), 'missing pre-existing event type: ' + t);
  });
});

ok('logEvent(db, "arbitration_decided", {...}) returns ok:true against a real temp room.db', function () {
  withHermeticRoom(function (db) {
    const r = memoryEvents.logEvent(db, 'arbitration_decided', { foo: 'bar' });
    assert.equal(r.ok, true);
    assert.equal(typeof r.eventId, 'string');
  });
});

ok('logEvent rejects a near-miss typo ("arbitration_decide") -- the closed Set still rejects', function () {
  withHermeticRoom(function (db) {
    const r = memoryEvents.logEvent(db, 'arbitration_decide', { foo: 'bar' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_event_type');
  });
});

console.log(n + ' assertions passed');
console.log('>>> test-346-arbitration-event.cjs: PASSED');
process.exit(0);
