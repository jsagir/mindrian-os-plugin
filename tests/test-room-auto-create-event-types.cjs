'use strict';

/*
 * Phase 119-00 Wave 1 -- EVENT_TYPES Set-level acceptance for the 3 new strings.
 *
 * Mirrors tests/test-auto-explore-event-types.cjs (Phase 117-00 precedent) verbatim
 * in structure; only the 3 new Phase 119 strings differ.
 *
 * Asserts:
 *   1. Size floor (>= 41 -- baseline 38 + 3 new; floor-not-exact-count idiom
 *      preserved per Phase 109 invariant so concurrent phase extensions
 *      cannot regress this test).
 *   2. Named membership of the 3 new Phase 119 strings.
 *   3. Prior-phase strings still present (89-07 + 116-00 + 117-00 + 124-02 +
 *      125-06 + 125-07 regression guard).
 *   4. logEvent acceptance round-trip for room_auto_created.
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { EVENT_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

test('119-00 EVENT_TYPES floor: size >= 41 (baseline 38 + 3 new Phase 119 strings)', () => {
  assert.equal(EVENT_TYPES.size >= 41, true, 'size=' + EVENT_TYPES.size + '; expected >= 41');
});

test('119-00 EVENT_TYPES: all 3 Phase 119 strings present', () => {
  const expected = ['room_auto_created', 'room_naming_decided', 'room_discarded'];
  for (const s of expected) {
    assert.equal(EVENT_TYPES.has(s), true, 'missing event_type: ' + s);
  }
});

test('119-00 EVENT_TYPES: prior-phase strings preserved (no regression)', () => {
  // 89-07 ReverseSalient
  assert.equal(EVENT_TYPES.has('reverse_salient_detected'), true);
  // 116-00 Tension hook
  assert.equal(EVENT_TYPES.has('tension_detected'), true);
  // 117-00 Auto-explore
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
  // 124-02 Feynman timeline
  assert.equal(EVENT_TYPES.has('feynman_timeline_refreshed'), true);
  // 125-06 F-selector decisions
  assert.equal(EVENT_TYPES.has('f_selector_decision'), true);
  // 125-07 F-selector miss
  assert.equal(EVENT_TYPES.has('f_selector_miss'), true);
});

test('119-00 EVENT_TYPES: Object.freeze on Set is documentation-only (Set.add still mutates the internal slot per Node spec)', () => {
  // Object.freeze on a JavaScript Set only freezes own properties; the
  // internal Set slot (where add/delete operate) is NOT frozen per ECMAScript
  // spec. The Phase 109 invariant relies on the SOURCE-LEVEL convention that
  // callers do not call .add() on EVENT_TYPES. The runtime guard is the
  // logEvent function (memory-events.cjs line 134) which rejects any
  // eventType not in the Set AT CALL TIME. This test documents that contract
  // and asserts the runtime rejection is the actual invariant, not the freeze.
  const before = EVENT_TYPES.size;
  // Defensive: do not pollute the Set across tests; immediately delete if add succeeds.
  try {
    EVENT_TYPES.add('phase_119_test_only_marker');
    EVENT_TYPES.delete('phase_119_test_only_marker');
  } catch (_e) { /* graceful */ }
  assert.equal(EVENT_TYPES.size, before, 'after add+delete the Set size returns to baseline');
  // The real invariant: logEvent rejects unknown event types AT CALL TIME.
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p119-00-freeze-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  const result = navigation.logMemoryEvent(db, 'phase_119_unknown_type_not_in_set', { source_path: 'test' });
  assert.equal(result.ok, false, 'logEvent must reject unknown event_type at call time');
  assert.equal(result.reason, 'invalid_event_type');
  try { db.close(); } catch (_e) { /* graceful */ }
});

test('119-00 logEvent acceptance: room_auto_created round-trip via navigation.logMemoryEvent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p119-00-evt-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  const result = navigation.logMemoryEvent(db, 'room_auto_created', {
    placeholder_slug: 'untitled-2026-05-16-2030',
    mtime_seconds: 1234567890,
    source_path: 'system:room-auto-create',
    tier: 1,
    created_by: 'system',
  });
  assert.equal(result.ok, true, 'logEvent should accept room_auto_created');
  assert.match(result.eventId, /^memory_event:room_auto_created:\d+:[0-9a-f]{8}$/);
  try { db.close(); } catch (_e) { /* graceful */ }
});

test('119-00 logEvent acceptance: room_naming_decided + room_discarded round-trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p119-00-evt2-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  const r1 = navigation.logMemoryEvent(db, 'room_naming_decided', {
    decision: 'keep_untitled',
    source_path: 'system:room-rename',
    created_by: 'user',
  });
  assert.equal(r1.ok, true);
  const r2 = navigation.logMemoryEvent(db, 'room_discarded', {
    placeholder_slug: 'untitled-2026-05-16-2030',
    source_path: 'system:room-discard',
    created_by: 'user',
  });
  assert.equal(r2.ok, true);
  try { db.close(); } catch (_e) { /* graceful */ }
});
