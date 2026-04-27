#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.4 Plan 01 -- Canon Part 3 closed-vocabulary fixture suite.
 *
 * 8 scenarios covering the Wave-1 foundation module:
 *   lib/core/rs-canon-violations.cjs
 *
 * Test 1 (10 valid verbs pass): every CANONICAL_VERBS entry round-trips
 *                               through validateVerb verbatim.
 * Test 2 (invalid verb throws): 'Cancel' throws CanonVerbViolation;
 *                               err.name + err.meta.attempted_verb verified.
 * Test 3 (empty string throws CanonVerbViolation): NOT TypeError;
 *                                                  err.meta.attempted_verb === ''.
 * Test 4 (non-string number throws TypeError): with message containing
 *                                              'must be a string'.
 * Test 5 (null + undefined throw TypeError): both inputs raise TypeError.
 * Test 6 (CANONICAL_VERBS frozen): Object.isFrozen + length === 10
 *                                  + mutation throws in strict mode.
 * Test 7 (canonical order verified): 10 strings exact-match in
 *                                    canon-mandated order.
 * Test 8 (surface tag propagation): err.meta.surface populated when caller
 *                                   supplies; defaults to 'unknown' otherwise.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert).
 */

const assert = require('node:assert/strict');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];

function record(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('PASS ' + name + '\n');
  } catch (err) {
    failed++;
    failures.push({ name, message: err && err.message ? err.message : String(err) });
    process.stdout.write('FAIL ' + name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
  }
}

// Helper: assert a function throws CanonVerbViolation with expected attempted_verb.
function assertThrowsCanonVerbViolation(fn, expectedAttemptedVerb) {
  let caught = null;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  assert.ok(caught !== null, 'expected throw, got none');
  assert.equal(caught.name, 'CanonVerbViolation', 'expected err.name CanonVerbViolation, got ' + caught.name);
  assert.ok(caught.meta && typeof caught.meta === 'object', 'expected err.meta to be object');
  assert.equal(caught.meta.attempted_verb, expectedAttemptedVerb,
    'expected err.meta.attempted_verb=' + JSON.stringify(expectedAttemptedVerb)
    + ', got ' + JSON.stringify(caught.meta.attempted_verb));
  return caught;
}

// Helper: assert a function throws TypeError.
function assertThrowsTypeError(fn, messageSubstring) {
  let caught = null;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  assert.ok(caught !== null, 'expected throw, got none');
  assert.ok(caught instanceof TypeError, 'expected TypeError, got ' + (caught && caught.name));
  if (messageSubstring) {
    assert.ok(
      caught.message.indexOf(messageSubstring) !== -1,
      'expected TypeError message to contain ' + JSON.stringify(messageSubstring)
        + ', got ' + JSON.stringify(caught.message)
    );
  }
  return caught;
}

// ---------- Module under test ----------

const mod = require('../core/rs-canon-violations.cjs');
const { CanonVerbViolation, CANONICAL_VERBS, validateVerb } = mod;

// ---------- Canonical 10-verb authoritative source ----------
// (per docs/MINDRIAN-CANON.md Part 3 lines 153-162)
const EXPECTED_VERBS = [
  'Run Methodology',
  'Reformulate',
  'Spawn Sub-Agent',
  'Navigate Graph',
  "Devil's Advocate",
  'Scenario Plan',
  'Synthesize',
  'Bank Opportunity',
  'Defer',
  'Free-Text',
];

// ---------- Tests ----------

record('T1 all 10 valid verbs pass validateVerb (returns input verbatim)', function () {
  assert.ok(Array.isArray(CANONICAL_VERBS), 'CANONICAL_VERBS must be array');
  assert.equal(CANONICAL_VERBS.length, 10, 'CANONICAL_VERBS.length must be 10');
  for (const verb of CANONICAL_VERBS) {
    const result = validateVerb(verb);
    assert.equal(result, verb, 'validateVerb(' + JSON.stringify(verb) + ') must return input verbatim');
  }
});

record('T2 invalid verb Cancel throws CanonVerbViolation with meta.attempted_verb', function () {
  const err = assertThrowsCanonVerbViolation(function () {
    validateVerb('Cancel');
  }, 'Cancel');
  assert.ok(err instanceof CanonVerbViolation, 'err must be instanceof CanonVerbViolation');
  assert.ok(err instanceof Error, 'err must also be instanceof Error');
});

record('T3 empty string throws CanonVerbViolation (NOT TypeError)', function () {
  const err = assertThrowsCanonVerbViolation(function () {
    validateVerb('');
  }, '');
  assert.ok(err instanceof CanonVerbViolation, 'empty string must produce CanonVerbViolation, not TypeError');
});

record('T4 non-string number 42 throws TypeError with must be a string', function () {
  assertThrowsTypeError(function () {
    validateVerb(42);
  }, 'must be a string');
});

record('T5 null and undefined throw TypeError', function () {
  assertThrowsTypeError(function () {
    validateVerb(null);
  }, 'must be a string');
  assertThrowsTypeError(function () {
    validateVerb(undefined);
  }, 'must be a string');
});

record('T6 CANONICAL_VERBS frozen + length 10 + mutation throws in strict mode', function () {
  assert.equal(Object.isFrozen(CANONICAL_VERBS), true, 'CANONICAL_VERBS must be frozen');
  assert.equal(CANONICAL_VERBS.length, 10, 'CANONICAL_VERBS.length must equal 10');
  // Test file is in strict mode; mutation must throw.
  let mutationThrew = false;
  try {
    CANONICAL_VERBS[0] = 'Hijacked';
  } catch (e) {
    mutationThrew = true;
  }
  assert.ok(mutationThrew, 'mutation of frozen array must throw in strict mode');
  assert.equal(CANONICAL_VERBS[0], 'Run Methodology', 'CANONICAL_VERBS[0] must remain Run Methodology');
});

record('T7 CANONICAL_VERBS contains exact required strings in canonical order', function () {
  for (let i = 0; i < EXPECTED_VERBS.length; i++) {
    assert.equal(
      CANONICAL_VERBS[i],
      EXPECTED_VERBS[i],
      'CANONICAL_VERBS[' + i + '] must equal ' + JSON.stringify(EXPECTED_VERBS[i])
        + ', got ' + JSON.stringify(CANONICAL_VERBS[i])
    );
  }
});

record('T8 surface tag propagation: provided populates meta.surface; omitted defaults to unknown', function () {
  // With surface provided
  let withSurfaceErr = null;
  try {
    validateVerb('NotAVerb', 'navigation-engine');
  } catch (e) {
    withSurfaceErr = e;
  }
  assert.ok(withSurfaceErr !== null, 'expected throw');
  assert.equal(withSurfaceErr.name, 'CanonVerbViolation');
  assert.equal(
    withSurfaceErr.meta.surface,
    'navigation-engine',
    'err.meta.surface must equal supplied surface tag'
  );

  // Without surface (omitted)
  let omittedErr = null;
  try {
    validateVerb('NotAVerb');
  } catch (e) {
    omittedErr = e;
  }
  assert.ok(omittedErr !== null, 'expected throw');
  assert.equal(omittedErr.name, 'CanonVerbViolation');
  assert.equal(
    omittedErr.meta.surface,
    'unknown',
    'err.meta.surface must default to unknown when surface omitted'
  );
});

// ---------- Suite report ----------

const total = passed + failed;
process.stdout.write('\n');
if (failed === 0) {
  process.stdout.write('=== 89.4-01 rs-canon-violations suite: ' + passed + '/' + total + ' passed ===\n');
  process.exit(0);
} else {
  process.stdout.write('=== 89.4-01 rs-canon-violations suite: ' + passed + '/' + total + ' passed (' + failed + ' failed) ===\n');
  for (const f of failures) {
    process.stdout.write('  FAIL ' + f.name + ': ' + f.message + '\n');
  }
  process.exit(1);
}
