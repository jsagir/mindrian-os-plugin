/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260903-hod -- R18 revised: epistemic-level cap on the 5-state
 * conversation operator (lib/conversation/operator.cjs), navigator-approved
 * 2026-09-03, reversing the first R18 which had attached the cap to
 * conversation-mode's 3-lane system.
 *
 * This file is table-driven coverage for:
 *   - epistemicCapForOperator(operatorState) -> { operator, cap, render_lock, unknown_operator }
 *   - isWithinCap(level, cap) -> boolean
 *   - EPISTEMIC_LEVELS, OPERATOR_EPISTEMIC_CAP (frozen constants)
 *
 * Standalone quick-task test file, run directly with `node --test`. NOT
 * registered into tests/run-all-118.sh or lib/memory/run-feynman-tests.cjs --
 * this is not Phase 118 work (naming/scope precedent:
 * lib/core/node-insert-epistemic.test.cjs).
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const operator = require('./operator.cjs');

const {
  OPERATORS,
  EPISTEMIC_LEVELS,
  OPERATOR_EPISTEMIC_CAP,
  epistemicCapForOperator,
  isWithinCap,
} = operator;

// ---------- Test A: table-driven declared mapping ----------

test('Test A: epistemicCapForOperator returns the exact declared cap for each of the 5 operators', () => {
  const table = [
    ['JUST_TALK', 'Information'],
    ['EXPLORE_CAPTURE', 'Information'],
    ['BUILD_ROOM', 'Knowledge'],
    ['METHODOLOGY', 'Understanding'],
    ['DECISION_GATE', null],
  ];
  for (const [op, expectedCap] of table) {
    const result = epistemicCapForOperator(op);
    assert.equal(result.cap, expectedCap, `${op} should cap at ${expectedCap}`);
    assert.equal(result.operator, op);
    assert.equal(result.unknown_operator, false);
  }
});

// ---------- Test B: DECISION_GATE render-lock ----------

test('Test B: DECISION_GATE is render_lock with a null cap; every other operator is render_lock:false', () => {
  const decisionGate = epistemicCapForOperator('DECISION_GATE');
  assert.equal(decisionGate.cap, null);
  assert.equal(decisionGate.render_lock, true);

  const others = ['JUST_TALK', 'EXPLORE_CAPTURE', 'BUILD_ROOM', 'METHODOLOGY'];
  for (const op of others) {
    const result = epistemicCapForOperator(op);
    assert.equal(result.render_lock, false, `${op} must not be render_lock`);
  }
});

// ---------- Test C: fail-closed on unrecognized input ----------

test('Test C: unrecognized, null, or non-string operator fails closed to the Information floor', () => {
  const badInputs = [undefined, null, '', 'BUILD-ROOM', 'just_talk', 42, {}];
  for (const bad of badInputs) {
    const result = epistemicCapForOperator(bad);
    assert.equal(result.cap, 'Information', `${JSON.stringify(bad)} should fail closed to Information`);
    assert.equal(result.unknown_operator, true, `${JSON.stringify(bad)} should be flagged unknown_operator`);
    assert.equal(result.operator, null);
  }
});

test('Test C-2: epistemicCapForOperator never throws on unrecognized input', () => {
  const badInputs = [undefined, null, '', 'BUILD-ROOM', 'just_talk', 42, {}, [], () => {}];
  for (const bad of badInputs) {
    assert.doesNotThrow(() => epistemicCapForOperator(bad));
  }
});

// ---------- Test D: drift fence ----------

test('Test D: OPERATOR_EPISTEMIC_CAP keys are set-equal to OPERATORS, exactly 5 keys', () => {
  const capKeys = Object.keys(OPERATOR_EPISTEMIC_CAP).slice().sort();
  const operatorKeys = OPERATORS.slice().sort();
  assert.deepEqual(capKeys, operatorKeys, 'cap table must not drift from OPERATORS');
  assert.equal(Object.keys(OPERATOR_EPISTEMIC_CAP).length, 5);
});

// ---------- Test E: every non-null cap value is a real rung ----------

test('Test E: every non-null OPERATOR_EPISTEMIC_CAP value is a member of EPISTEMIC_LEVELS', () => {
  for (const [op, cap] of Object.entries(OPERATOR_EPISTEMIC_CAP)) {
    if (cap === null) continue;
    assert.ok(EPISTEMIC_LEVELS.includes(cap), `${op}'s cap "${cap}" must be a real DIKW rung`);
  }
});

// ---------- Test F: ladder shape + frozen constants ----------

test('Test F: EPISTEMIC_LEVELS is frozen and in ascending DIKW order', () => {
  assert.deepEqual(EPISTEMIC_LEVELS, ['Data', 'Information', 'Knowledge', 'Understanding', 'Wisdom']);
  assert.equal(Object.isFrozen(EPISTEMIC_LEVELS), true);
});

test('Test F-2: OPERATOR_EPISTEMIC_CAP is frozen', () => {
  assert.equal(Object.isFrozen(OPERATOR_EPISTEMIC_CAP), true);
});

// ---------- Test G: isWithinCap ordering ----------

test('Test G: isWithinCap enforces ascending DIKW ordering, equal is within', () => {
  assert.equal(isWithinCap('Information', 'Knowledge'), true);
  assert.equal(isWithinCap('Knowledge', 'Knowledge'), true);
  assert.equal(isWithinCap('Wisdom', 'Understanding'), false);
  assert.equal(isWithinCap('Understanding', 'Information'), false);
});

// ---------- Test H: isWithinCap fails closed ----------

test('Test H: isWithinCap fails closed on null cap, unknown level, or unknown cap; never throws', () => {
  assert.equal(isWithinCap('Information', null), false, 'a null cap (render-lock) is never within');
  assert.equal(isWithinCap('NotARung', 'Knowledge'), false, 'unknown level fails closed');
  assert.equal(isWithinCap('Information', 'NotARung'), false, 'unknown cap fails closed');
  assert.doesNotThrow(() => isWithinCap(undefined, undefined));
  assert.doesNotThrow(() => isWithinCap(null, null));
  assert.equal(isWithinCap(undefined, undefined), false);
});

// ---------- Test I: regression fence -- Task 1 is additive only ----------

test('Test I: existing operator.cjs public API is unchanged in shape (additive-only proof)', () => {
  assert.equal(typeof operator.getCurrent, 'function');
  assert.equal(typeof operator.transition, 'function');
  assert.equal(typeof operator.validate, 'function');
  assert.equal(typeof operator.transitionViaMVAOption, 'function');
  assert.deepEqual(operator.OPERATORS, [
    'JUST_TALK',
    'EXPLORE_CAPTURE',
    'BUILD_ROOM',
    'METHODOLOGY',
    'DECISION_GATE',
  ]);
  assert.equal(Array.isArray(operator.TRIGGERS), true);
  assert.equal(Array.isArray(operator.TRANSITION_RULES), true);
  assert.equal(operator.TRANSITION_RULES.length, 9);
  assert.equal(typeof operator.SCHEMA_VERSION, 'string');
  assert.equal(typeof operator.HISTORY_MAX, 'number');
  assert.equal(typeof operator._internal, 'object');
});
