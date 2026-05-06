'use strict';
// Phase 116-00 Wave 0 stub for AC-8 (three-surface render determinism).
// Production assertions land in Wave 2 (116-02) when the Larry-voice rendering helper
// ships and CLI/Desktop/Cowork all surface identical output given the same JSONL state.
// This stub verifies the surfaced-event substrate is in place so Wave-2 renderer code
// cannot return invalid_event_type when emitting tension_surfaced.

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('116-00 substrate: EVENT_TYPES has tension_surfaced (renderer emit path)', () => {
  assert.equal(EVENT_TYPES.has('tension_surfaced'), true);
});

test('116-00 substrate: EVENT_TYPES size invariant (26 = 21 + 5)', () => {
  // Three-surface determinism requires a single source of truth for event vocabulary.
  // If size drifts, CLI/Desktop/Cowork can disagree on what is renderable.
  assert.equal(EVENT_TYPES.size, 26);
});

test('116-00 substrate: 88.2-05 F-shape selector vocabulary preserved (regression)', () => {
  // Phase 88.2 F-shape selectors are load-bearing for the Phase 116 F.1 surface render.
  assert.equal(EVENT_TYPES.has('selector_presentation'), true);
  assert.equal(EVENT_TYPES.has('selector_response'), true);
});
