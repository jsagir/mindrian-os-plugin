'use strict';
// Phase 116-00 Wave 0 stub for AC-3 + AC-7 (memory_event mirror + Canon Part 8 substring audit).
// Production assertions land in Wave 4 (116-04) when emitDetected/emitActedOn helpers ship,
// mirroring the 89-07 dual-surface pattern. This stub verifies all 5 new strings are
// registered so Wave-4 telemetry calls cannot return invalid_event_type.
//
// Canon Part 8 substring audit (real assertion in Wave 4): every memory_event payload
// must contain ZERO user-content strings (no artifact bodies, no quoted text, no proper
// nouns of customers). Only enum scalars + sha256 hashes + integers + booleans.

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('116-00 substrate: all 5 tension event strings registered', () => {
  const expected = ['tension_detected', 'tension_surfaced', 'tension_resolved', 'tension_decayed', 'tension_skipped'];
  for (const e of expected) {
    assert.equal(EVENT_TYPES.has(e), true, 'missing event_type: ' + e);
  }
});

test('116-00 substrate: 89-07 dual-surface telemetry pattern preserved (regression)', () => {
  // 89-07 invariants must remain registered; Wave 4 telemetry uses the same emit shape.
  assert.equal(EVENT_TYPES.has('reverse_salient_detected'), true);
  assert.equal(EVENT_TYPES.has('reverse_salient_acted_on'), true);
});

test('116-00 substrate: Canon Part 8 audit placeholder', () => {
  // Wave 4 fills this with real substring scan over emitted payloads. At Wave 0,
  // assert that the new event strings themselves contain no user-content (they are
  // generic enum tokens, not user data).
  const tension_strings = ['tension_detected', 'tension_surfaced', 'tension_resolved', 'tension_decayed', 'tension_skipped'];
  for (const s of tension_strings) {
    assert.match(s, /^tension_[a-z]+$/, 'event string is not a clean enum token: ' + s);
  }
});
