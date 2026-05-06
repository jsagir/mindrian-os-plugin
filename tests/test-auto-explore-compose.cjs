'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-05 (triple-filter compose).
// Production assertions in Wave 1 (117-02) when composeAutoExploreFinding lands:
//   - 3-source dedup (whitespace + reverse-salient + cross-domain)
//   - max-score selection across sources
//   - deterministic finding.id (sha256 of inputs)
//   - empty-input null return (no fabrication)
//   - score normalization to [0,1]
//   - candidate_count accuracy
//   - weight calibration per source
//   - single-source fallback path
//   - source-pipeline tag preservation
//   - deterministic across runs (same inputs -> same id)

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: all 5 extension event strings registered', () => {
  const expected = ['auto_explore_fired', 'auto_explore_finding_surfaced', 'auto_explore_user_response', 'auto_explore_skipped', 'brain_canon_drift_observed'];
  for (const e of expected) {
    assert.equal(EVENT_TYPES.has(e), true, 'missing event_type: ' + e);
  }
});

test('117-00 substrate: deterministic-id assertion placeholder (Wave 1 117-02 fills)', () => {
  // Real assertion lands when composeAutoExploreFinding ships; substrate-only here.
  assert.equal(EVENT_TYPES.has('auto_explore_finding_surfaced'), true);
});
