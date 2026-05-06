'use strict';
// Phase 117-00 substrate stub PROMOTED in Phase 117-05 Wave 3.
// Production assertions for the 6 emit helpers (emitFired / emitFindingSurfaced /
// emitUserResponse / emitSkipped / emitSanitizerHit / emitBrainCanonDrift) and
// their EVENT_TYPES registration. Phase 117-05 added auto_explore_sanitizer_hit
// to the Set (was missing from Wave 0; required for dual-surface mirror to
// room.db memory_event log).

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117 substrate: EVENT_TYPES has all 6 Phase 117 extension events', () => {
  const expected = [
    'auto_explore_fired',
    'auto_explore_finding_surfaced',
    'auto_explore_user_response',
    'auto_explore_skipped',
    'auto_explore_sanitizer_hit',
    'brain_canon_drift_observed',
  ];
  for (const e of expected) {
    assert.equal(EVENT_TYPES.has(e), true, 'missing event_type: ' + e);
  }
});

test('117 substrate: EVENT_TYPES size is 32 (26 baseline + 6 new)', () => {
  assert.equal(EVENT_TYPES.size, 32);
});

test('117 substrate: Phase 116 + 89-07 strings preserved (no regression)', () => {
  assert.equal(EVENT_TYPES.has('tension_detected'), true);
  assert.equal(EVENT_TYPES.has('reverse_salient_detected'), true);
});
