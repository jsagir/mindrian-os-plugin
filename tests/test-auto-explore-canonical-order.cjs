'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-13 (Brain §8.1 canonical chain order).
// Per RESEARCH §8.1: the Stage "Opportunity Discovery" canonizes the order
//   Define Domain -> Identify Trends -> Identify Reverse Salients -> (cross-domain value-add)
// Production assertions in Wave 1 (117-02) when composeAutoExploreFinding lands:
//   - Composer emits results in canonical order as primary axis
//   - HSI score is secondary axis
//   - Mismatched order fails assertion
//   - Missing pipeline fills with empty-array placeholder
//   - Citation comment "Stage HAS_STEP" present in compose docstring
//   - Deterministic across runs

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: AUTOEXPLORE-117-13 canonical-order Wave 0 placeholder', () => {
  // Real assertion lands 117-02; here we only confirm substrate is in place.
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
});
