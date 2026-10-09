'use strict';
// Tests for rs-thesis-generator.cjs. Compares against the pristine original
// (copied from _baseline/orig into the temp stage) for regression, and checks
// the new record API. Inputs are HAND-MADE.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, PKG } = require('./_harness.cjs');

const root = stage(['rs-thesis/lib/core/rs-thesis-generator.cjs']);
fs.copyFileSync(path.join(PKG, '..', '_baseline', 'orig', 'rs', 'rs-thesis', 'lib', 'core', 'rs-thesis-generator.cjs'),
  path.join(root, 'lib', 'core', 'rs-thesis-generator-orig.cjs'));
const gen = require(path.join(root, 'lib/core/rs-thesis-generator.cjs'));
const orig = require(path.join(root, 'lib/core/rs-thesis-generator-orig.cjs'));

const PAIR = { query_concept: 'thermal batteries', doc_concept: 'grid storage', classification: 'structural_transfer', bridge_concept: 'phase-change buffering' };

test('regression: thesis text identical to the original for every valid combination', () => {
  const dims = [undefined, 'feasibility', 'market', 'magnitude', 'advantage', 'impact', 'nonsense'];
  let n = 0;
  for (const cls of ['structural_transfer', 'semantic_implementation', 'hybrid']) {
    for (const dim of dims) {
      for (const bridge of ['b', '', null, undefined]) {
        const pair = Object.assign({}, PAIR, { classification: cls, bridge_concept: bridge });
        const bt = dim === undefined ? null : { dominant_dimension: dim };
        assert.equal(gen.generateThesis(pair, bt), orig.generateThesis(pair, bt)); n += 1;
      }
    }
  }
  assert.equal(n, 84);
  assert.deepEqual(gen.generateThesis(null, null), orig.generateThesis(null, null));
  assert.deepEqual(gen.generateThesis({ query_concept: '', doc_concept: 'x', classification: 'hybrid' }), { error: 'invalid_input', reason: 'missing_concepts' });
  assert.deepEqual(gen.generateThesis(Object.assign({}, PAIR, { classification: 'none' })), { error: 'invalid_input', reason: 'invalid_classification' });
});

test('BUG in original: inherited property names pass the "in" check; fixed in 2026 version', () => {
  for (const evil of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
    const pair = Object.assign({}, PAIR, { classification: evil });
    const o = orig.generateThesis(pair, null);
    assert.equal(typeof o, 'string', 'original accepted ' + evil);
    assert.match(o, /native code|function|\[object/, 'original leaked a function/object into the sentence: ' + o);
    assert.deepEqual(gen.generateThesis(pair, null), { error: 'invalid_input', reason: 'invalid_classification' });
  }
  const o2 = orig.generateThesis(PAIR, { dominant_dimension: 'constructor' });
  assert.match(o2, /native code/);
  const g2 = gen.generateThesis(PAIR, { dominant_dimension: 'constructor' });
  assert.match(g2, /achieve novel insight because/);
});

test('record: no evidence -> capped, unsupported, fallbacks reported', () => {
  const r = gen.generateThesisRecord({ query_concept: 'a', doc_concept: 'b', classification: 'hybrid' }, null, { now: () => 0 });
  assert.equal(r.thesis, 'By applying a to b, achieve novel insight because both structural and semantic alignment supports domain analogy.');
  assert.deepEqual(r.fallbacks_used, ['dominant_dimension', 'bridge_concept']);
  assert.equal(r.confidence, 0.05); // 0.20 - 0.10 - 0.05
  assert.equal(r.confidence_label, 'unsupported');
  assert.ok(r.confidence_basis.includes('no_evidence_cap_0.35'));
  assert.equal(r.novelty_check_status, 'not_run');
  assert.equal(r.provenance.computed_at, '1970-01-01T00:00:00.000Z');
  assert.equal(r.provenance.deterministic, true);
});

test('record: full evidence, second signal and novelty raise confidence by the documented rules', () => {
  const pair = Object.assign({}, PAIR, {
    evidence: [
      { source_id: 'openalex:W1', url: 'https://openalex.org/W1', retrieved_at: '2026-02-01', side: 'problem', sentence: 'Grid storage loses 30% of energy in conversion.' },
      { source_id: 'uspto:US7654321', url: 'https://patents.google.com/patent/US7654321', retrieved_at: '2026-02-01', side: 'method', sentence: 'A phase-change buffer smooths thermal output.' },
    ],
    second_signal: { confirmed: true, method: 'bm25_overlap' },
    novelty_check_status: 'passed',
  });
  const r = gen.generateThesisRecord(pair, { dominant_dimension: 'market' }, { now: () => 0 });
  // 0.20 + 0.15 + 0.15 + 0.10 + 0.15 + 0.15 = 0.90
  assert.equal(r.confidence, 0.9); assert.equal(r.confidence_label, 'strong');
  assert.equal(r.evidence_count, 2); assert.deepEqual(r.source_ids, ['openalex:W1', 'uspto:US7654321']);
  assert.equal(r.components.Z, 'market-ready innovation');
  assert.deepEqual(r.fallbacks_used, []);
  assert.equal(r.second_signal.confirmed, true);
  // a failed novelty check lowers it
  const bad = gen.generateThesisRecord(Object.assign({}, pair, { novelty_check_status: 'possible_prior_art' }), { dominant_dimension: 'market' });
  assert.equal(bad.confidence, 0.6); assert.equal(bad.confidence_label, 'moderate');
});

test('record: determinism, invalid input envelope, evidence audit, bad novelty value', () => {
  const a = gen.generateThesisRecord(PAIR, { dominant_dimension: 'impact' }, { now: () => 5 });
  const b = gen.generateThesisRecord(PAIR, { dominant_dimension: 'impact' }, { now: () => 5 });
  assert.deepEqual(a, b);
  const inv = gen.generateThesisRecord({ query_concept: 'a' }, null);
  assert.equal(inv.error, 'invalid_input'); assert.equal(inv.thesis, null); assert.equal(inv.confidence, 0);
  assert.throws(() => gen.generateThesisRecord(Object.assign({}, PAIR, { evidence: [{ sentence: 'see meeting_transcript', side: 'problem' }] }), null), (e) => e.name === 'ExternalEgressViolation');
  assert.throws(() => gen.generateThesisRecord(Object.assign({}, PAIR, { query_concept: 'call 555-123-4567' }), null), (e) => e.name === 'ExternalEgressViolation');
  assert.equal(gen.generateThesisRecord(Object.assign({}, PAIR, { novelty_check_status: 'maybe' }), null).novelty_check_status, 'not_run');
  const many = gen.generateThesisRecord(Object.assign({}, PAIR, { evidence: Array.from({ length: 20 }, (_, i) => ({ source_id: 's' + i, sentence: 'x' + i, side: 'problem' })) }), null);
  assert.equal(many.evidence_count, 8);
});
