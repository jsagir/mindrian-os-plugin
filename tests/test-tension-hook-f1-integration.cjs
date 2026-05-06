'use strict';
// Phase 116-00 Wave 0 stub for AC-2 + AC-3 (F.1 dispatch + Larry-voice render +
// user-response paths). Production assertions land in Wave 2 (116-02) when the F.1
// selector dispatch wiring ships via lib/hmi/selector-dispatcher.cjs::pickShape.
// This stub verifies the F.1 result-event substrate (resolved/skipped/surfaced) is
// in place so Wave-2 user-response handlers cannot return invalid_event_type.

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('116-00 substrate: EVENT_TYPES has tension_surfaced (F.1 render path)', () => {
  assert.equal(EVENT_TYPES.has('tension_surfaced'), true);
});

test('116-00 substrate: EVENT_TYPES has tension_resolved (F.1 [1] Resolve path)', () => {
  assert.equal(EVENT_TYPES.has('tension_resolved'), true);
});

test('116-00 substrate: EVENT_TYPES has tension_skipped (F.1 [3] Skip path)', () => {
  assert.equal(EVENT_TYPES.has('tension_skipped'), true);
});

test('116-00 substrate: F.1 result-event triple complete', () => {
  // F.1 selector emits one of three terminal user-response events per D-06.
  const f1_results = ['tension_resolved', 'tension_skipped', 'tension_surfaced'];
  for (const e of f1_results) {
    assert.equal(EVENT_TYPES.has(e), true, 'missing F.1 result event: ' + e);
  }
});
