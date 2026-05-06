'use strict';
// Phase 116-00 Wave 0 stub for AC-1 (Phase 109 navigation query integration).
// Production assertions land in Wave 1 (116-01) when scripts/preflight-tension-surface.cjs +
// lib/memory/pending-tension-store.cjs ship. This stub verifies only that the EVENT_TYPES
// substrate is in place so Wave-1 telemetry calls cannot return invalid_event_type.
//
// Mirrors 89-07-00 Wave 0 stub pattern. Scaffold-only: tests pass today, new assertions
// added in 116-01 once the detection module exists.

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('116-00 substrate: EVENT_TYPES has tension_detected', () => {
  assert.equal(EVENT_TYPES.has('tension_detected'), true);
});

test('116-00 substrate: EVENT_TYPES size is 26 (21 baseline + 5 new)', () => {
  assert.equal(EVENT_TYPES.size, 26);
});

test('116-00 substrate: Phase 109 substrate preserved (regression check)', () => {
  // node_created is the original Phase 109 string; if it disappears, Wave 0 is broken.
  assert.equal(EVENT_TYPES.has('node_created'), true);
});
