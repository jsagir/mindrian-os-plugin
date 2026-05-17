'use strict';

/*
 * Phase 120-00 Wave 1 -- EVENT_TYPES Set-level acceptance for the 6 new strings.
 *
 * Mirrors tests/test-room-auto-create-event-types.cjs (Phase 119-00 precedent)
 * verbatim in structure; only the 6 new Phase 120 strings differ.
 *
 * Asserts:
 *   1. Size floor (>= 48 -- baseline 42 after Phase 119-01 + 6 new Phase 120
 *      strings; floor-not-exact-count idiom preserved per Phase 109 invariant so
 *      concurrent phase extensions cannot regress this test).
 *   2. Named membership of the 6 new Phase 120 strings.
 *   3. Prior-phase strings still present (89-07 + 116-00 + 117-00 + 119-00 +
 *      124-02 + 125-06 + 125-07 regression guard).
 *   4. logEvent acceptance round-trip for each of the 6 new event_types.
 *   5. Object.freeze-on-Set behavior: source-level convention preserved; logEvent
 *      runtime rejection is the actual enforcement.
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { EVENT_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

const PHASE_120_STRINGS = [
  'breakthrough_detected_soft',
  'breakthrough_surfaced',
  'breakthrough_confirmed',
  'breakthrough_dismissed',
  'breakthrough_filed_as_decision',
  'breakthrough_throttled',
];

test('120-00 EVENT_TYPES floor: size >= 48 (baseline 42 + 6 new Phase 120 strings)', () => {
  assert.equal(EVENT_TYPES.size >= 48, true, 'size=' + EVENT_TYPES.size + '; expected >= 48');
});

test('120-00 EVENT_TYPES: all 6 Phase 120 strings present', () => {
  for (const s of PHASE_120_STRINGS) {
    assert.equal(EVENT_TYPES.has(s), true, 'missing event_type: ' + s);
  }
});

test('120-00 EVENT_TYPES: prior-phase strings preserved (no regression)', () => {
  // 89-07 ReverseSalient
  assert.equal(EVENT_TYPES.has('reverse_salient_detected'), true);
  // 116-00 Tension hook
  assert.equal(EVENT_TYPES.has('tension_detected'), true);
  // 117-00 Auto-explore
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
  // 119-00 Room-as-receipt
  assert.equal(EVENT_TYPES.has('room_auto_created'), true);
  // 119-01 Discard cascade
  assert.equal(EVENT_TYPES.has('room_discard_partial_failure'), true);
  // 124-02 Feynman timeline
  assert.equal(EVENT_TYPES.has('feynman_timeline_refreshed'), true);
  // 125-06 F-selector decisions
  assert.equal(EVENT_TYPES.has('f_selector_decision'), true);
  // 125-07 F-selector miss
  assert.equal(EVENT_TYPES.has('f_selector_miss'), true);
});

test('120-00 EVENT_TYPES: Object.freeze on Set is documentation-only; runtime guard is logEvent rejection', () => {
  // Object.freeze on a JavaScript Set only freezes own properties; the
  // internal Set slot (where add/delete operate) is NOT frozen per ECMAScript
  // spec. The Phase 109 invariant relies on the SOURCE-LEVEL convention that
  // callers do not call .add() on EVENT_TYPES. The runtime guard is logEvent.
  const before = EVENT_TYPES.size;
  try {
    EVENT_TYPES.add('phase_120_test_only_marker');
    EVENT_TYPES.delete('phase_120_test_only_marker');
  } catch (_e) { /* graceful */ }
  assert.equal(EVENT_TYPES.size, before, 'after add+delete the Set size returns to baseline');

  // The real invariant: logEvent rejects unknown event types AT CALL TIME.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-00-freeze-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  const result = navigation.logMemoryEvent(db, 'phase_120_unknown_type_not_in_set', { source_path: 'test' });
  assert.equal(result.ok, false, 'logEvent must reject unknown event_type at call time');
  assert.equal(result.reason, 'invalid_event_type');
  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 logEvent acceptance: breakthrough_detected_soft round-trip via navigation.logMemoryEvent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-00-soft-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  const result = navigation.logMemoryEvent(db, 'breakthrough_detected_soft', {
    breakthrough_id: 'breakthrough:convergence:abc1234567890def',
    kind: 'convergence',
    confidence: 0.28,
    source_path: 'system:breakthrough-detector',
    created_by: 'system',
  });
  assert.equal(result.ok, true, 'logEvent should accept breakthrough_detected_soft');
  assert.match(result.eventId, /^memory_event:breakthrough_detected_soft:\d+:[0-9a-f]{8}$/);
  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 logEvent acceptance: all 6 Phase 120 strings round-trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-00-all-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  for (const evtType of PHASE_120_STRINGS) {
    const result = navigation.logMemoryEvent(db, evtType, {
      breakthrough_id: 'breakthrough:test:' + evtType,
      kind: 'convergence',
      confidence: 0.55,
      source_path: 'system:breakthrough-detector',
      created_by: 'system',
    });
    assert.equal(result.ok, true, 'logEvent should accept ' + evtType);
    const expected = new RegExp('^memory_event:' + evtType + ':\\d+:[0-9a-f]{8}$');
    assert.match(result.eventId, expected, 'eventId shape mismatch for ' + evtType);
  }
  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});

test('120-00 logEvent payload landed in nodes table with type=memory_event', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-00-row-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  const r = navigation.logMemoryEvent(db, 'breakthrough_surfaced', {
    breakthrough_id: 'breakthrough:convergence:row-test',
    kind: 'convergence',
    confidence: 0.55,
    theme: 'test-theme',
    source_path: 'system:breakthrough-scanner',
    created_by: 'system',
  });
  assert.equal(r.ok, true);
  const row = db.prepare("SELECT id, type FROM nodes WHERE id = ?").get(r.eventId);
  assert.equal(row.type, 'memory_event', 'row landed with type=memory_event');
  assert.equal(row.id, r.eventId, 'row id matches returned eventId');
  try { closeRoomDb(db); } catch (_e) { /* graceful */ }
});
