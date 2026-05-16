'use strict';
/*
 * Phase 119-02 Task 1 -- test suite for larry-thinness-acknowledgment.cjs.
 *
 * Verifies (per CONTEXT.md D-05 verbatim copy lock + the 11 behavior tests in
 * .planning/phases/119-room-as-receipt-invariant/119-02-PLAN.md Task 1):
 *   1. THINNESS_VOICE_LINE returns exact verbatim string.
 *   2. voiceLine() returns the same string as THINNESS_VOICE_LINE.
 *   3. shouldAcknowledgeThinness(null) -> true.
 *   4. shouldAcknowledgeThinness({findings:[]}) -> true.
 *   5. shouldAcknowledgeThinness({findings:[a,b]}) -> false (substantive).
 *   6. shouldAcknowledgeThinness({findings:[a]}) -> true (D-05 threshold 2+).
 *   7-10. Template files exist + valid frontmatter (verified by Task 2 + bash gate).
 *   11. No smart quotes / em-dashes in the verbatim string (ASCII only).
 */

const assert = require('node:assert');
const test = require('node:test');

const {
  THINNESS_VOICE_LINE,
  shouldAcknowledgeThinness,
  voiceLine,
} = require('./larry-thinness-acknowledgment.cjs');

const EXPECTED =
  "I made a room around this -- it's mostly empty until we have more to work with. " +
  "Want to keep going and see what fills in?";

test('Test 1: THINNESS_VOICE_LINE is the verbatim D-05 string', () => {
  assert.strictEqual(THINNESS_VOICE_LINE, EXPECTED);
});

test('Test 2: voiceLine() returns same string as THINNESS_VOICE_LINE (single source of truth)', () => {
  assert.strictEqual(voiceLine(), THINNESS_VOICE_LINE);
});

test('Test 3: shouldAcknowledgeThinness(null) returns true', () => {
  assert.strictEqual(shouldAcknowledgeThinness(null), true);
});

test('Test 4: shouldAcknowledgeThinness(undefined) returns true', () => {
  assert.strictEqual(shouldAcknowledgeThinness(undefined), true);
});

test('Test 5: shouldAcknowledgeThinness({findings: []}) returns true (empty findings)', () => {
  assert.strictEqual(shouldAcknowledgeThinness({ findings: [] }), true);
});

test('Test 6: shouldAcknowledgeThinness({findings: [a, b]}) returns false (substantive, 2+ findings)', () => {
  const finding = {
    findings: [
      { source_pipeline: 'whitespace', hsi_score: 0.7 },
      { source_pipeline: 'cross-domain', hsi_score: 0.6 },
    ],
  };
  assert.strictEqual(shouldAcknowledgeThinness(finding), false);
});

test('Test 7: shouldAcknowledgeThinness({findings: [a]}) returns true (1-finding edge case, D-05 threshold)', () => {
  const finding = {
    findings: [{ source_pipeline: 'whitespace', hsi_score: 0.3 }],
  };
  assert.strictEqual(shouldAcknowledgeThinness(finding), true);
});

test('Test 8: shouldAcknowledgeThinness on non-object returns true (defensive)', () => {
  assert.strictEqual(shouldAcknowledgeThinness('not an object'), true);
  assert.strictEqual(shouldAcknowledgeThinness(42), true);
});

test('Test 9: shouldAcknowledgeThinness on object without findings array returns true', () => {
  assert.strictEqual(shouldAcknowledgeThinness({}), true);
  assert.strictEqual(shouldAcknowledgeThinness({ findings: null }), true);
});

test('Test 10: THINNESS_VOICE_LINE has no em-dash (em-dash HARD RULE)', () => {
  assert.strictEqual(THINNESS_VOICE_LINE.indexOf('—'), -1, 'em-dash U+2014 present');
});

test('Test 11: THINNESS_VOICE_LINE has no smart-quote characters (ASCII only)', () => {
  // Right single quote U+2019, left single quote U+2018, right double U+201D, left double U+201C
  assert.strictEqual(THINNESS_VOICE_LINE.indexOf('’'), -1, 'right single quote U+2019 present');
  assert.strictEqual(THINNESS_VOICE_LINE.indexOf('‘'), -1, 'left single quote U+2018 present');
  assert.strictEqual(THINNESS_VOICE_LINE.indexOf('”'), -1, 'right double quote U+201D present');
  assert.strictEqual(THINNESS_VOICE_LINE.indexOf('“'), -1, 'left double quote U+201C present');
});

test('Test 12: THINNESS_VOICE_LINE contains the locked phrase fragments', () => {
  assert.ok(THINNESS_VOICE_LINE.includes('I made a room around this'), 'opener missing');
  assert.ok(THINNESS_VOICE_LINE.includes("it's mostly empty"), 'middle (ASCII apostrophe) missing');
  assert.ok(THINNESS_VOICE_LINE.includes('Want to keep going'), 'continuation invite missing');
  assert.ok(THINNESS_VOICE_LINE.includes('see what fills in?'), 'closing question missing');
});
