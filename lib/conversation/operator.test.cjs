/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-05 Plan 05 -- operator helper tests for transitionViaMVAOption.
 *
 * This is the FIRST test file for lib/conversation/operator.cjs. Plan 118-05
 * Task 1 adds the transitionViaMVAOption(roomDir, optionId) helper -- a thin
 * additive wrapper around the existing transition() function. The helper is
 * called by lib/core/mva-option-router.cjs when the user picks 1, 2, or 3
 * from the 30-second MVA brief footer.
 *
 * The 9 existing transition rules are NOT modified. The OPERATORS array is
 * NOT modified. This is a small additive surface.
 *
 * Option 1 -> JUST_TALK (via 'manual_reset' trigger; existing ANY rule)
 * Option 2 -> NO transition (stub per binding decision B6 OPTION A; Phase 119
 *             will wire the BUILD_ROOM path)
 * Option 3 -> METHODOLOGY (via 'mos_command' trigger; existing ANY rule)
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const operator = require('./operator.cjs');

// Hermetic temp roomDir per test (so we never pollute real rooms).
function makeTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'op-mva-option-'));
  return dir;
}

function cleanupTempRoom(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ---------- Task 1: transitionViaMVAOption helper ----------

test('Test 1: transitionViaMVAOption(roomDir, 1) -> JUST_TALK', () => {
  const roomDir = makeTempRoom();
  try {
    // Move to a non-JUST_TALK state first so the transition is meaningful.
    // From the default JUST_TALK, step to EXPLORE_CAPTURE.
    const pre = operator.transition(roomDir, 'EXPLORE_CAPTURE', 'user_message');
    assert.equal(pre.success, true);
    assert.equal(operator.getCurrent(roomDir).current, 'EXPLORE_CAPTURE');

    const result = operator.transitionViaMVAOption(roomDir, 1);
    assert.equal(result.ok, true, 'option 1 should succeed');
    assert.equal(result.new_state, 'JUST_TALK', 'option 1 must end in JUST_TALK');
    assert.equal(result.from, 'EXPLORE_CAPTURE', 'from must be the previous state');
    assert.equal(operator.getCurrent(roomDir).current, 'JUST_TALK');
  } finally {
    cleanupTempRoom(roomDir);
  }
});

test('Test 2: transitionViaMVAOption(roomDir, 2) -> no transition (stub)', () => {
  const roomDir = makeTempRoom();
  try {
    // Move to METHODOLOGY first so we can verify "no transition" preserves it.
    const pre = operator.transition(roomDir, 'METHODOLOGY', 'mos_command');
    assert.equal(pre.success, true);
    assert.equal(operator.getCurrent(roomDir).current, 'METHODOLOGY');

    const result = operator.transitionViaMVAOption(roomDir, 2);
    assert.equal(result.ok, true, 'option 2 returns ok:true (stub but valid)');
    assert.equal(result.no_transition, true, 'option 2 must flag no_transition');
    assert.equal(result.reason, 'option_2_stub', 'reason must be option_2_stub');
    assert.equal(result.new_state, 'METHODOLOGY', 'state unchanged after stub option');
    assert.equal(operator.getCurrent(roomDir).current, 'METHODOLOGY');
  } finally {
    cleanupTempRoom(roomDir);
  }
});

test('Test 3: transitionViaMVAOption(roomDir, 3) -> METHODOLOGY', () => {
  const roomDir = makeTempRoom();
  try {
    // From JUST_TALK default, option 3 should jump straight to METHODOLOGY
    // via the ANY -> METHODOLOGY 'mos_command' rule.
    assert.equal(operator.getCurrent(roomDir).current, 'JUST_TALK');

    const result = operator.transitionViaMVAOption(roomDir, 3);
    assert.equal(result.ok, true, 'option 3 should succeed');
    assert.equal(result.new_state, 'METHODOLOGY', 'option 3 must end in METHODOLOGY');
    assert.equal(result.from, 'JUST_TALK', 'from must be the previous state');
    assert.equal(operator.getCurrent(roomDir).current, 'METHODOLOGY');
  } finally {
    cleanupTempRoom(roomDir);
  }
});

test('Test 4: transitionViaMVAOption(roomDir, 99) -> invalid_option error', () => {
  const roomDir = makeTempRoom();
  try {
    const before = operator.getCurrent(roomDir).current;
    const result = operator.transitionViaMVAOption(roomDir, 99);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'invalid_option');
    assert.deepEqual(result.valid_options, [1, 2, 3]);
    // State unchanged
    assert.equal(operator.getCurrent(roomDir).current, before);
  } finally {
    cleanupTempRoom(roomDir);
  }
});

test('Test 4b: transitionViaMVAOption rejects non-integer optionId', () => {
  const roomDir = makeTempRoom();
  try {
    const r1 = operator.transitionViaMVAOption(roomDir, '1');
    assert.equal(r1.ok, false, 'string "1" is rejected (strict int check)');
    assert.equal(r1.error, 'invalid_option');

    const r2 = operator.transitionViaMVAOption(roomDir, 0);
    assert.equal(r2.ok, false, '0 is rejected');

    const r3 = operator.transitionViaMVAOption(roomDir, null);
    assert.equal(r3.ok, false, 'null is rejected');
  } finally {
    cleanupTempRoom(roomDir);
  }
});

// ---------- Task 1 Test 5: no regression on OPERATORS or rules ----------

test('Test 5a: OPERATORS array is unchanged (5 entries; canonical order)', () => {
  assert.deepEqual(operator.OPERATORS, [
    'JUST_TALK',
    'EXPLORE_CAPTURE',
    'BUILD_ROOM',
    'METHODOLOGY',
    'DECISION_GATE',
  ]);
});

test('Test 5b: TRANSITION_RULES has 9 entries (Phase 99 D-08 invariant preserved)', () => {
  assert.equal(operator.TRANSITION_RULES.length, 9);
});

test('Test 5c: existing transition rules still work (JUST_TALK -> EXPLORE_CAPTURE on user_message)', () => {
  const roomDir = makeTempRoom();
  try {
    const r = operator.transition(roomDir, 'EXPLORE_CAPTURE', 'user_message');
    assert.equal(r.success, true);
    assert.equal(r.current, 'EXPLORE_CAPTURE');
  } finally {
    cleanupTempRoom(roomDir);
  }
});

test('Test 5d: transitionViaMVAOption exported as top-level function', () => {
  assert.equal(typeof operator.transitionViaMVAOption, 'function');
});
