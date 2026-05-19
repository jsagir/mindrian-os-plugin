#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-00 -- emit-time validator acceptance tests.
 *
 * Verifies validator.cjs is the Canon Part 8 constitutional gate that
 * rejects events containing Brain query bodies, room artifact strings,
 * personal identifiers (emails, phone numbers, raw hex), absolute filesystem
 * paths, brain.mindrian.ai references, and free-text prose. Mirrors the
 * Phase 110-05 seed-pattern adversarial fixture approach.
 *
 * Test map (7 cases, one-to-one with the PLAN <behavior> block for Task 1):
 *   3.  validateEventPayload('unknown_event', {}) returns { ok: false, error: /unknown_event/ }
 *   4.  validateEventPayload('selector_pick', {valid payload}) returns { ok: true }
 *   5.  validateEventPayload('selector_pick', { rogue_field: 'x' }) returns { ok: false, error: /unknown_field/ }
 *   6.  7 adversarial forbidden-pattern rejections (Canon Part 8):
 *         (a) Cypher query body  "MATCH (n:Framework) RETURN n"
 *         (b) Free-text prose    > 120 chars with 3+ spaces and >40% lowercase
 *         (c) Email              "user@example.com"
 *         (d) Raw hex >32 chars  in non-sha256 field
 *         (e) Absolute path      "/home/jsagi/MindrianRooms/foo/bar/baz.md"
 *         (f) Phone              "555-123-4567"
 *         (g) Brain URL          "https://brain.mindrian.ai/v1/query"
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const VALIDATOR_PATH = path.join(REPO, 'lib/core/telemetry/validator.cjs');

try { delete require.cache[require.resolve(VALIDATOR_PATH)]; } catch (_) {}
const validator = require(VALIDATOR_PATH);

assert.equal(typeof validator.validateEventPayload, 'function',
  'validator must export validateEventPayload()');

// ---------- Test 3: unknown_event rejection ----------

(function test3UnknownEvent() {
  const result = validator.validateEventPayload('not_a_real_event', {});
  assert.equal(result.ok, false,
    'unknown event must return ok:false');
  assert.match(result.error, /unknown_event/,
    'error must mention unknown_event, got: ' + result.error);
  console.log('PASS test 3: unknown_event -> ok:false');
})();

// ---------- Test 4: valid selector_pick payload ----------

(function test4ValidSelectorPick() {
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    mode: 'A',
    ranker_confidence: 0.73,
    recommended_rendered: true,
    options_count: 4,
    room_slug_sha256: 'a'.repeat(64),
    verb_chosen: 'Run Methodology',
  });
  assert.equal(result.ok, true,
    'valid selector_pick payload must validate; got: ' + JSON.stringify(result));
  console.log('PASS test 4: valid selector_pick payload -> ok:true');
})();

// ---------- Test 5: unknown field rejection ----------

(function test5UnknownField() {
  const result = validator.validateEventPayload('selector_pick', { rogue_field: 'x' });
  assert.equal(result.ok, false,
    'unknown field must return ok:false');
  assert.match(result.error, /unknown_field/,
    'error must mention unknown_field, got: ' + result.error);
  console.log('PASS test 5: unknown_field -> ok:false');
})();

// ---------- Test 6 (a-g): Canon Part 8 adversarial forbidden patterns ----------

(function test6aCypherQueryBody() {
  // Cypher body must be rejected even when injected into an allowed field
  // (verb_chosen has length cap, but the Cypher detector should fire FIRST).
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    verb_chosen: 'MATCH (n:Framework) RETURN n',
  });
  assert.equal(result.ok, false,
    'Cypher fragment must be rejected; got: ' + JSON.stringify(result));
  assert.match(result.error, /forbidden_pattern.*cypher/i,
    'error must mention forbidden_pattern + cypher, got: ' + result.error);
  console.log('PASS test 6a: Cypher query body rejected');
})();

(function test6bFreeTextProse() {
  // 130+ char string with many spaces and high lowercase ratio.
  const prose = 'the navigator walked into the room and the team began discussing the long history of the venture together with a beautiful question framework that everyone could understand';
  assert.ok(prose.length > 120, 'fixture must be > 120 chars');
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    verb_chosen: prose,
  });
  assert.equal(result.ok, false,
    'free-text prose must be rejected; got: ' + JSON.stringify(result));
  // Either prose heuristic OR length cap fires; both signal Part 8 enforcement.
  assert.match(result.error, /free_text_prose_suspected|string_too_long|forbidden_pattern/,
    'error must indicate prose rejection, got: ' + result.error);
  console.log('PASS test 6b: free-text prose >120 chars rejected');
})();

(function test6cEmail() {
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    verb_chosen: 'user@example.com',
  });
  assert.equal(result.ok, false,
    'email must be rejected; got: ' + JSON.stringify(result));
  assert.match(result.error, /forbidden_pattern.*email/i,
    'error must mention forbidden_pattern + email, got: ' + result.error);
  console.log('PASS test 6c: email rejected');
})();

(function test6dRawHex() {
  // 40-char hex in verb_chosen (a non-hash field).
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    verb_chosen: 'deadbeefcafebabe1234567890abcdef0123456789abcdef',
  });
  assert.equal(result.ok, false,
    'raw hex >32 chars in non-sha256 field must be rejected; got: ' + JSON.stringify(result));
  assert.match(result.error, /forbidden_pattern.*hex|string_too_long/i,
    'error must mention forbidden_pattern + hex (or string_too_long fallback), got: ' + result.error);
  console.log('PASS test 6d: raw hex >32 chars in non-sha256 field rejected');
})();

(function test6eAbsolutePath() {
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    verb_chosen: '/home/jsagi/MindrianRooms/foo/bar/baz.md',
  });
  assert.equal(result.ok, false,
    'absolute path must be rejected; got: ' + JSON.stringify(result));
  assert.match(result.error, /forbidden_pattern.*(path|absolute)/i,
    'error must mention forbidden_pattern + path, got: ' + result.error);
  console.log('PASS test 6e: absolute path rejected');
})();

(function test6fPhone() {
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    verb_chosen: '555-123-4567',
  });
  assert.equal(result.ok, false,
    'phone number must be rejected; got: ' + JSON.stringify(result));
  assert.match(result.error, /forbidden_pattern.*phone/i,
    'error must mention forbidden_pattern + phone, got: ' + result.error);
  console.log('PASS test 6f: phone number rejected');
})();

(function test6gBrainURL() {
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    verb_chosen: 'https://brain.mindrian.ai/v1',
  });
  assert.equal(result.ok, false,
    'brain.mindrian.ai URL must be rejected; got: ' + JSON.stringify(result));
  assert.match(result.error, /forbidden_pattern.*(brain|url)/i,
    'error must mention forbidden_pattern + brain/url, got: ' + result.error);
  console.log('PASS test 6g: brain.mindrian.ai URL rejected');
})();

// ---------- Sanity: sha256 hash field (room_slug_sha256) NOT flagged as raw hex ----------

(function test7Sha256NotFlagged() {
  // 64-char hex is the valid sha256 length; must NOT trigger hex detector.
  const result = validator.validateEventPayload('selector_pick', {
    sub_shape: 'F.1',
    room_slug_sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  });
  assert.equal(result.ok, true,
    'sha256 hash in dedicated field must validate; got: ' + JSON.stringify(result));
  console.log('PASS test 7: sha256 hash in room_slug_sha256 NOT flagged as raw hex');
})();

console.log('\nvalidator.test.cjs: 7/7 tests passed');
