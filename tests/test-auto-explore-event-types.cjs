'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-01 (EVENT_TYPES extension).
// Production assertions land in Wave 3 (117-05) when 6 emit helpers
// (emitFired/emitFindingSurfaced/emitUserResponse/emitSkipped/emitSanitizerHit/emitBrainCanonDrift)
// ship in lib/agents/auto-explore-agent.cjs. This stub verifies only that
// the EVENT_TYPES substrate is in place so Wave-1+ telemetry calls cannot
// return invalid_event_type.

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: EVENT_TYPES has all 5 auto_explore extension events', () => {
  const expected = ['auto_explore_fired', 'auto_explore_finding_surfaced', 'auto_explore_user_response', 'auto_explore_skipped', 'brain_canon_drift_observed'];
  for (const e of expected) {
    assert.equal(EVENT_TYPES.has(e), true, 'missing event_type: ' + e);
  }
});

test('117-00 substrate: EVENT_TYPES size is 31 (26 baseline + 5 new)', () => {
  assert.equal(EVENT_TYPES.size, 31);
});

test('117-00 substrate: Phase 116 + 89-07 strings preserved (no regression)', () => {
  assert.equal(EVENT_TYPES.has('tension_detected'), true);
  assert.equal(EVENT_TYPES.has('reverse_salient_detected'), true);
});
