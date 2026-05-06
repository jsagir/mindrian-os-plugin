'use strict';

/*
 * Phase 89-07 Wave 2 -- Task 1 RED then GREEN.
 *
 * Tests for lib/core/reverse-salient-persona-suffix.cjs:
 *   - 7 canonical role keys -> persona suffix template
 *   - 2 alias keys (researcher_ind, founder_grant) documented behavior
 *   - default fallback (cold-start, empty, all-zero weights, unknown keys)
 *   - lex tie-break per Phase 115 D-AMEND-04 (agents/larry-extended.md lines 78-100)
 *   - reliability fence (any error -> default)
 *
 * Suffix wording per 89-07-RESEARCH.md SCOPE B Section 6 (RESEARCH-derived,
 * confidence: LOW on editorial copy; tunable post-empathy-audit).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const m = require('../lib/core/reverse-salient-persona-suffix.cjs');

test('persona-suffix: 3 expected exports', () => {
  assert.equal(typeof m.suffixFor, 'function');
  assert.equal(typeof m.PERSONA_SUFFIX, 'object');
  assert.ok(Array.isArray(m.CANONICAL_KEYS));
});

test('persona-suffix: PERSONA_SUFFIX is frozen', () => {
  assert.ok(Object.isFrozen(m.PERSONA_SUFFIX));
});

test('persona-suffix: CANONICAL_KEYS is frozen', () => {
  assert.ok(Object.isFrozen(m.CANONICAL_KEYS));
});

test('persona-suffix: founder -> shipping risk', () => {
  assert.equal(m.suffixFor({ founder: 0.7, researcher: 0.3 }), 'shipping risk');
});

test('persona-suffix: researcher -> evidence gap', () => {
  assert.equal(m.suffixFor({ researcher: 0.6, investor: 0.4 }), 'evidence gap');
});

test('persona-suffix: investor -> thesis fragility', () => {
  assert.equal(m.suffixFor({ investor: 0.6, operator: 0.4 }), 'thesis fragility');
});

test('persona-suffix: operator -> execution gap', () => {
  assert.equal(m.suffixFor({ operator: 0.6 }), 'execution gap');
});

test('persona-suffix: mentor -> coaching wedge', () => {
  assert.equal(m.suffixFor({ mentor: 0.5 }), 'coaching wedge');
});

test('persona-suffix: domain_expert -> physical-reality friction', () => {
  assert.equal(m.suffixFor({ domain_expert: 0.5 }), 'physical-reality friction');
});

test('persona-suffix: student -> understanding gap', () => {
  assert.equal(m.suffixFor({ student: 0.5 }), 'understanding gap');
});

test('persona-suffix: cold-start (null) -> lagging component', () => {
  assert.equal(m.suffixFor(null), 'lagging component');
});

test('persona-suffix: cold-start (undefined) -> lagging component', () => {
  assert.equal(m.suffixFor(undefined), 'lagging component');
});

test('persona-suffix: empty object -> lagging component', () => {
  assert.equal(m.suffixFor({}), 'lagging component');
});

test('persona-suffix: all-zero weights -> lagging component', () => {
  assert.equal(m.suffixFor({ founder: 0, researcher: 0 }), 'lagging component');
});

test('persona-suffix: lex tie-break (founder vs researcher both 0.5) -> founder wins', () => {
  // alphabetical: 'founder' < 'researcher'
  assert.equal(m.suffixFor({ founder: 0.5, researcher: 0.5 }), 'shipping risk');
});

test('persona-suffix: lex tie-break (investor vs mentor both 0.5) -> investor wins', () => {
  // alphabetical: 'investor' < 'mentor'
  assert.equal(m.suffixFor({ investor: 0.5, mentor: 0.5 }), 'thesis fragility');
});

test('persona-suffix: lex tie-break (domain_expert vs student both 0.5) -> domain_expert wins', () => {
  // alphabetical: 'domain_expert' < 'student'
  assert.equal(m.suffixFor({ domain_expert: 0.5, student: 0.5 }), 'physical-reality friction');
});

test('persona-suffix: researcher_ind alias -> evidence gap (functionally a researcher persona)', () => {
  // Documented alias choice: researcher_ind aliases to 'evidence gap' since researcher_ind
  // is functionally a researcher persona (FDA/IRB scope, but research methodology applies).
  assert.equal(m.suffixFor({ researcher_ind: 0.7 }), 'evidence gap');
});

test('persona-suffix: founder_grant alias -> submission risk (grant-specific founder)', () => {
  // Documented alias choice: founder_grant aliases to 'submission risk' since grant
  // submissions have unique deadline/eligibility risk shape distinct from product shipping.
  assert.equal(m.suffixFor({ founder_grant: 0.7 }), 'submission risk');
});

test('persona-suffix: reliability fence -- unknown key falls back to default', () => {
  assert.equal(m.suffixFor({ unknown_key: 0.9 }), 'lagging component');
});

test('persona-suffix: reliability fence -- mixed unknown + canonical with positive weight picks canonical', () => {
  // unknown_key ignored; researcher (0.3) is the only canonical with positive weight
  assert.equal(m.suffixFor({ unknown_key: 0.9, researcher: 0.3 }), 'evidence gap');
});

test('persona-suffix: reliability fence -- non-numeric weight ignored', () => {
  assert.equal(m.suffixFor({ founder: 'high', researcher: 0.3 }), 'evidence gap');
});

test('persona-suffix: reliability fence -- non-object input -> default', () => {
  assert.equal(m.suffixFor('founder'), 'lagging component');
  assert.equal(m.suffixFor(42), 'lagging component');
  assert.equal(m.suffixFor(true), 'lagging component');
});

test('persona-suffix: reliability fence -- array input -> default (arrays are objects but Object.keys returns indices)', () => {
  // Arrays pass typeof === 'object'; numeric index keys are not in CANONICAL_KEYS,
  // so they get filtered out, leaving no candidates -> default.
  assert.equal(m.suffixFor(['founder']), 'lagging component');
});

test('persona-suffix: PERSONA_SUFFIX has all 9 documented keys', () => {
  const expected = ['founder', 'researcher', 'researcher_ind', 'founder_grant',
                    'investor', 'operator', 'mentor', 'domain_expert', 'student', 'default'];
  for (const k of expected) {
    assert.equal(typeof m.PERSONA_SUFFIX[k], 'string', 'PERSONA_SUFFIX.' + k + ' must be a string');
    assert.ok(m.PERSONA_SUFFIX[k].length > 0, 'PERSONA_SUFFIX.' + k + ' must be non-empty');
  }
});

test('persona-suffix: CANONICAL_KEYS lists all 10 keys', () => {
  const expected = ['founder', 'researcher', 'researcher_ind', 'founder_grant',
                    'investor', 'operator', 'mentor', 'domain_expert', 'student', 'default'];
  for (const k of expected) {
    assert.ok(m.CANONICAL_KEYS.indexOf(k) !== -1, 'CANONICAL_KEYS must contain ' + k);
  }
});

test('persona-suffix: 0 em-dashes in module body', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'core', 'reverse-salient-persona-suffix.cjs'),
    'utf8'
  );
  assert.equal(src.indexOf('—'), -1, 'em-dash forbidden in module source (feedback_no_emdashes)');
});
