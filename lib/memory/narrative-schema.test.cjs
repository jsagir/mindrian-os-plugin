#!/usr/bin/env node
'use strict';

/**
 * Tests for lib/memory/narrative-schema.cjs.
 * Node built-in assert only.
 */

const assert = require('node:assert');
const { validateNarrative, SCHEMA_BOUNDS } = require('./narrative-schema.cjs');

function validFixture() {
  return {
    section: 'problem-definition',
    essence:
      'The venture reduces time between insight and validated decision across every dimension simultaneously.',
    plain_language:
      'Founders waste weeks turning a new insight into a confirmed decision. This tool collapses that loop into hours by filing, scanning, and surfacing contradictions automatically.',
    governing_thought:
      'A structured Data Room compresses time-to-decision in venture innovation by making hidden relationships between subsystems visible as the artifacts arrive.',
    mental_model: {
      analogy: 'It is like an air traffic control tower for your venture.',
      mapping:
        'Each artifact is an incoming aircraft. Each section is a runway. The cross-relationship scan is radar that spots collisions before they happen. The user is the controller who clears approvals.',
      limits: 'Unlike real ATC, mistakes here are recoverable and reversible.',
    },
    sweet_spot:
      'The folder structure IS the reasoning. Filing an artifact is a claim. Claims connect across sections as a graph. When the graph finds a contradiction you did not see, the venture is better for it. The work you already do becomes the intelligence itself.',
    key_claims: [
      'Every artifact in a section becomes a checkable claim with a validity status.',
      'Cross-section scans find contradictions before humans notice them.',
      'Decisions captured with reasons become training data for the next scan.',
    ],
  };
}

// 1. Accept valid.
{
  const r = validateNarrative(validFixture());
  assert.deepStrictEqual(
    r,
    { valid: true, errors: [] },
    'valid fixture rejected: ' + JSON.stringify(r)
  );
}

// 2. Reject non-object root.
for (const bad of [null, undefined, 42, 'string', [1, 2]]) {
  const r = validateNarrative(bad);
  assert.strictEqual(r.valid, false, 'should reject: ' + JSON.stringify(bad));
}

// 3. Missing-required-field cases (one per required field).
const REQUIRED_TOP_LEVEL = [
  'section',
  'essence',
  'plain_language',
  'governing_thought',
  'sweet_spot',
  'key_claims',
];
for (const field of REQUIRED_TOP_LEVEL) {
  const f = validFixture();
  delete f[field];
  const r = validateNarrative(f);
  assert.strictEqual(
    r.valid,
    false,
    'should reject missing field: ' + field
  );
  assert.ok(
    r.errors.some(function (e) {
      return e.indexOf(field) !== -1;
    }),
    'error should mention ' + field + ': ' + JSON.stringify(r.errors)
  );
}

// Missing mental_model whole sub-object.
{
  const f = validFixture();
  delete f.mental_model;
  const r = validateNarrative(f);
  assert.strictEqual(r.valid, false);
}

// Missing mental_model.analogy / mapping / limits individually.
for (const sub of ['analogy', 'mapping', 'limits']) {
  const f = validFixture();
  delete f.mental_model[sub];
  const r = validateNarrative(f);
  assert.strictEqual(r.valid, false, 'mental_model.' + sub);
}

// 4. Em-dash rejection in every string field.
const STRING_PATHS = [
  ['section'],
  ['essence'],
  ['plain_language'],
  ['governing_thought'],
  ['mental_model', 'analogy'],
  ['mental_model', 'mapping'],
  ['mental_model', 'limits'],
  ['sweet_spot'],
];
const EM = String.fromCodePoint(8212);
const EN = String.fromCodePoint(8211);
for (const dash of [EM, EN]) {
  for (const p of STRING_PATHS) {
    const f = validFixture();
    let cur = f;
    for (let i = 0; i < p.length - 1; i++) cur = cur[p[i]];
    cur[p[p.length - 1]] = 'ok ' + dash + ' not ok';
    const r = validateNarrative(f);
    assert.strictEqual(
      r.valid,
      false,
      'should reject dash in ' + p.join('.')
    );
    assert.ok(
      r.errors.some(function (e) {
        return e.indexOf('forbidden-dash') !== -1;
      }),
      'error should mention forbidden-dash for ' + p.join('.')
    );
  }
  // Also in key_claims items.
  const f = validFixture();
  f.key_claims[1] = 'bad ' + dash + ' claim';
  const r = validateNarrative(f);
  assert.strictEqual(r.valid, false);
}

// 5. Over-long string rejection for each bounded field.
const BOUND_PATHS = {
  essence: ['essence'],
  plain_language: ['plain_language'],
  governing_thought: ['governing_thought'],
  'mental_model.analogy': ['mental_model', 'analogy'],
  'mental_model.mapping': ['mental_model', 'mapping'],
  'mental_model.limits': ['mental_model', 'limits'],
  sweet_spot: ['sweet_spot'],
};
for (const dotted of Object.keys(BOUND_PATHS)) {
  const p = BOUND_PATHS[dotted];
  const spec = SCHEMA_BOUNDS[dotted];
  const over = 'a'.repeat(spec.maxLen + 1);
  const f = validFixture();
  let cur = f;
  for (let i = 0; i < p.length - 1; i++) cur = cur[p[i]];
  cur[p[p.length - 1]] = over;
  const r = validateNarrative(f);
  assert.strictEqual(
    r.valid,
    false,
    'should reject over-long ' + dotted
  );
  assert.ok(
    r.errors.some(function (e) {
      return e.indexOf('too-long') !== -1 && e.indexOf(dotted) !== -1;
    }),
    'error should flag too-long for ' + dotted
  );
}

// Also over-long key_claims item.
{
  const f = validFixture();
  f.key_claims[0] = 'a'.repeat(SCHEMA_BOUNDS.key_claims.itemMaxLen + 1);
  const r = validateNarrative(f);
  assert.strictEqual(r.valid, false);
}

// 6. key_claims length bounds.
for (const badLen of [0, 1, 2, 6, 7]) {
  const f = validFixture();
  f.key_claims = [];
  for (let i = 0; i < badLen; i++) f.key_claims.push('claim ' + i);
  const r = validateNarrative(f);
  assert.strictEqual(
    r.valid,
    false,
    'should reject key_claims length ' + badLen
  );
}
for (const goodLen of [3, 4, 5]) {
  const f = validFixture();
  f.key_claims = [];
  for (let i = 0; i < goodLen; i++) f.key_claims.push('claim number ' + i);
  const r = validateNarrative(f);
  assert.strictEqual(
    r.valid,
    true,
    'should accept key_claims length ' +
      goodLen +
      ': ' +
      JSON.stringify(r.errors)
  );
}

// 7. Empty string rejected as too-short.
{
  const f = validFixture();
  f.essence = '';
  const r = validateNarrative(f);
  assert.strictEqual(r.valid, false);
}

process.stdout.write('narrative-schema.test.cjs: all assertions passed\n');
