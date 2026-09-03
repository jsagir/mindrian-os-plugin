#!/usr/bin/env node
'use strict';

/**
 * Phase 257 Plan 02, Task 2 (LOCUS-02, D-04) -- pin the wrapDirective()
 * egress_disclosure/refusal pass-through in both directions.
 * ==========================================================================
 * Task 1 made wrapDirective() attach two additive, named fields
 * (egress_disclosure, refusal) when present and object-shaped, and made
 * absence of both fields leave the envelope byte-identical to its
 * pre-change seven-key form. This suite proves six properties:
 *
 *   Arm 1 - disclosure survives: the exact egress_disclosure shape
 *           _attachEgressDisclosure produces (verdict, egress_class,
 *           reason, tool, disposition) survives with all five fields.
 *   Arm 2 - refusal survives: a REAL refusalResponse('unreachable', ...)
 *           object (not a hand-written literal) survives with its status,
 *           kind, reason, command_context, next_moves.
 *   Arm 3 - absence is byte-identical: the exact seven-key array including
 *           order for a payload carrying neither field, plus the Tier-0
 *           sentinel's mode_rationale and directive.guided.stage.
 *   Arm 4 - no laundering: a canary planted on an unknown top-level key
 *           (question, cypher, raw_answer) never reaches the envelope. This
 *           is the arm that fails if Task 1 is rewritten as a generic
 *           top-level-field copy instead of two named fields.
 *   Arm 5 - copy-on-attach: mutating the source objects after the call does
 *           not mutate the envelope's copies.
 *   Arm 6 - type guard: a string, an array, and null in either field
 *           position are not attached; the envelope keeps exactly seven
 *           keys.
 *
 * node --test, CJS, node:assert/strict only (the tests/test-257-refusal-
 * egress-kind.cjs harness style, this same phase's own Plan 01 precedent).
 * No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENVELOPE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'directive-envelope.cjs');

const { wrapDirective } = require(ENVELOPE_PATH);
const { refusalResponse } = require('../lib/core/refusal-messaging.cjs');

// Declared once, reused everywhere below (plan's explicit instruction: do
// not freeze this list in more than one place inside this file).
const SEVEN_KEYS = Object.freeze([
  'packet_version',
  'packet_type',
  'mode',
  'mode_rationale',
  'directive',
  'user_override',
  'next_gate',
]);

function baseDirective() {
  return { guided: { questions: [], framework: null, stage: null } };
}

// ---------------------------------------------------------------------------
// Arm 1: disclosure survives.
// ---------------------------------------------------------------------------
test('Arm 1: egress_disclosure survives wrapDirective with all five fields intact', () => {
  const disclosure = {
    verdict: 'ambiguous',
    egress_class: 'freeform_unmatched',
    reason: 'no methodology vocabulary match',
    tool: 'brain_ask',
    disposition: 'proceeded',
  };
  const env = wrapDirective({ directive: baseDirective(), egress_disclosure: disclosure }, {});

  assert.ok(env.egress_disclosure, 'egress_disclosure must be present');
  assert.equal(env.egress_disclosure.verdict, 'ambiguous');
  assert.equal(env.egress_disclosure.egress_class, 'freeform_unmatched');
  assert.equal(env.egress_disclosure.reason, 'no methodology vocabulary match');
  assert.equal(env.egress_disclosure.tool, 'brain_ask');
  assert.equal(env.egress_disclosure.disposition, 'proceeded');
});

// ---------------------------------------------------------------------------
// Arm 2: refusal survives, built via refusalResponse(), not a literal.
// ---------------------------------------------------------------------------
test('Arm 2: a real refusalResponse() object survives wrapDirective with status/kind/reason/command_context/next_moves', () => {
  const refusal = refusalResponse('unreachable', { tool: 'brain_ask' });
  const env = wrapDirective(
    {
      directive: { guided: { questions: [], framework: null, stage: 'tier_0_' + refusal.kind } },
      next_gate: { sub_shape: 'F.1', options: refusal.next_moves.slice() },
      refusal: refusal,
    },
    {}
  );

  assert.ok(env.refusal, 'refusal must be present');
  assert.equal(env.refusal.status, refusal.status);
  assert.equal(env.refusal.kind, 'unreachable');
  assert.equal(env.refusal.reason, refusal.reason);
  assert.equal(env.refusal.command_context, refusal.command_context);
  assert.deepStrictEqual(env.refusal.next_moves, refusal.next_moves);
});

// ---------------------------------------------------------------------------
// Arm 3: absence is byte-identical, key order included.
// ---------------------------------------------------------------------------
test('Arm 3: absence of both fields keeps the exact seven-key array in order; Tier-0 sentinel is unchanged', () => {
  const env = wrapDirective({ directive: baseDirective() }, {});
  assert.deepStrictEqual(Object.keys(env), SEVEN_KEYS.slice());
  assert.ok(!Object.prototype.hasOwnProperty.call(env, 'egress_disclosure'));
  assert.ok(!Object.prototype.hasOwnProperty.call(env, 'refusal'));

  const sentinel = wrapDirective(null, {});
  assert.equal(sentinel.mode_rationale, 'brain_unreachable');
  assert.equal(sentinel.directive.guided.stage, 'tier_0_brain_unreachable');
  assert.deepStrictEqual(Object.keys(sentinel), SEVEN_KEYS.slice());
});

// ---------------------------------------------------------------------------
// Arm 4: no laundering. A canary on an unknown top-level key never reaches
// the envelope. Fails if Task 1 is rewritten as a generic field copy.
// ---------------------------------------------------------------------------
test('Arm 4: a canary on an unknown top-level key never reaches the envelope (no generic pass-through)', () => {
  const CANARY = 'CANARY7F3A2B dana@acme.io';
  const env = wrapDirective(
    {
      directive: baseDirective(),
      question: CANARY,
      cypher: CANARY,
      raw_answer: CANARY,
    },
    {}
  );

  const serialized = JSON.stringify(env);
  assert.ok(
    !serialized.includes(CANARY),
    'canary planted on an unknown top-level key must never reach the envelope'
  );
  assert.deepStrictEqual(Object.keys(env), SEVEN_KEYS.slice());
});

// ---------------------------------------------------------------------------
// Arm 5: copy-on-attach. Mutating the source after the call does not
// mutate the envelope's copies.
// ---------------------------------------------------------------------------
test('Arm 5: mutating the source egress_disclosure/refusal after the call does not change the envelope copies', () => {
  const disclosure = { verdict: 'ambiguous', egress_class: 'freeform_unmatched', reason: 'x', tool: 'brain_ask', disposition: 'proceeded' };
  const refusal = refusalResponse('unreachable', { tool: 'brain_ask' });

  const env = wrapDirective(
    { directive: baseDirective(), egress_disclosure: disclosure, refusal: refusal },
    {}
  );

  disclosure.verdict = 'MUTATED';
  refusal.status = 'MUTATED';

  assert.equal(env.egress_disclosure.verdict, 'ambiguous', 'envelope copy must not see the post-call mutation');
  assert.notEqual(env.refusal.status, 'MUTATED');
});

// ---------------------------------------------------------------------------
// Arm 6: type guard. A string, an array, and null are not attached.
// ---------------------------------------------------------------------------
test('Arm 6: non-object egress_disclosure/refusal values (string, array, null) are not attached', () => {
  const cases = ['a string', ['an', 'array'], null];

  for (const value of cases) {
    const env = wrapDirective(
      { directive: baseDirective(), egress_disclosure: value, refusal: value },
      {}
    );
    assert.ok(!Object.prototype.hasOwnProperty.call(env, 'egress_disclosure'), `egress_disclosure must not attach for ${JSON.stringify(value)}`);
    assert.ok(!Object.prototype.hasOwnProperty.call(env, 'refusal'), `refusal must not attach for ${JSON.stringify(value)}`);
    assert.deepStrictEqual(Object.keys(env), SEVEN_KEYS.slice());
  }
});
