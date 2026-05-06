'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-18 (Brain §8.6 brain_canon_drift_observed event).
// Per RESEARCH §8.6: emit brain_canon_drift_observed once per session when Brain returns
// FourLenses but Canon expects FiveLenses. Axis = "lens_count"; brain_count=4 vs canon_count=5.
// Use Canon FiveLenses; do NOT write back to Brain (Canon Part 8 LOCAL-only edge).
// Production assertions in Wave 3 (117-05) when emitBrainCanonDrift helper lands:
//   - event emits with axis="lens_count"
//   - payload includes brain_count=4 and canon_count=5
//   - event written to JSONL telemetry
//   - no Brain write-back attempted (Part 8)

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: brain_canon_drift_observed event registered (axis=lens_count)', () => {
  assert.equal(EVENT_TYPES.has('brain_canon_drift_observed'), true);
});

test('117-00 substrate: auto_explore_fired registered alongside drift event', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
});
