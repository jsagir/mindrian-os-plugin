'use strict';
// Phase 116-00 Wave 0 stub for AC-4 + AC-5 (state machine + 3-strikes decay).
// Production assertions land in Wave 3 (116-03) when the queued -> surfaced -> resolved
// state machine + JSONL persistence at ~/.mindrian/pending-tensions/<slug>.jsonl ships.
// This stub verifies only that the EVENT_TYPES substrate has the decay event registered
// so Wave-3 transitions cannot return invalid_event_type.

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('116-00 substrate: EVENT_TYPES has tension_decayed', () => {
  assert.equal(EVENT_TYPES.has('tension_decayed'), true);
});

test('116-00 substrate: EVENT_TYPES has tension_skipped', () => {
  assert.equal(EVENT_TYPES.has('tension_skipped'), true);
});

test('116-00 substrate: state-machine event vocabulary complete', () => {
  // Decay state machine needs both terminal (decayed) and re-queue (skipped) events.
  const decay_events = ['tension_decayed', 'tension_skipped'];
  for (const e of decay_events) {
    assert.equal(EVENT_TYPES.has(e), true, 'missing decay event: ' + e);
  }
});
