'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-16 (Brain §8.5 BQ-anchored Larry voice).
// Per RESEARCH §8.5: F.1 line uses BQ template registry hitting GUIDED_BY/GENERATES_MATRIX
// BQ patterns. Sample: "weather_algorithm x synthetic_inertia" should produce
//   "What if the deepest pattern here isn't 'wind power' but ..."
// Production assertions in Wave 2 (117-03) when BQ template registry lands:
//   - F.1 line uses BQ template registry
//   - line is BQ-anchored not raw match
//   - sample input produces BQ-shaped output
//   - template hits at least 1 of GUIDED_BY/GENERATES_MATRIX BQ patterns
//   - suppression paths still emit BQ-anchored Larry-voice
//   - non-BQ raw render fails lint
//   - persona-blend BQ selection
//   - three-surface BQ parity (CLI + Desktop + Cowork)

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: AUTOEXPLORE-117-16 BQ-template Wave 0 placeholder', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_finding_surfaced'), true);
});
