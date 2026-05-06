'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-15 (Brain §8.4 HSIAnalysis schema extension).
// Per RESEARCH §8.4: finding shape extends HSIAnalysis with:
//   - top_differential
//   - semantic_surprise
//   - category_errors_identified
//   - top_differential_score
// F.1 RECOMMENDED gate at >= 0.7 mirrors Phase 88.2 invariant.
// Production assertions in Wave 2 (117-03) when finding shape lands:
//   - top_differential field present
//   - semantic_surprise field present
//   - category_errors_identified array
//   - top_differential_score numeric in [0,1]
//   - F.1 RECOMMENDED at >= 0.7
//   - HSIAnalysis-shape lint passes
//   - extension fields documented
//   - backward-compat with §5 finding shape

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: AUTOEXPLORE-117-15 HSI-schema Wave 0 placeholder', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_finding_surfaced'), true);
});
