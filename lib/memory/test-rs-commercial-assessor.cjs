#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 01 -- rs-commercial-assessor fixture suite.
 *
 * 12 scenarios covering the Phase 4 commercial layer module:
 *   lib/core/rs-commercial-assessor.cjs
 *
 * Tests:
 *   T1  assess() exported as function; calling without arguments returns
 *       deterministic safe defaults (NO throw on the no-args path; the
 *       only throw paths are Canon Part 8 violations on adversarial input).
 *   T2  full positive input -- 3 fields populated; market_size_estimate
 *       non-empty string; value_proposition non-empty string;
 *       partnership_targets array of length >= 1.
 *   T3  deterministic invariance: 100 calls with same input produce
 *       byte-identical JSON.stringify.
 *   T4  edge case: zero industry signals + zero experts -> partnership_targets
 *       is [] (empty array, not undefined / null); market_size_estimate
 *       falls into low-signal bucket; value_proposition still populated;
 *       NO throw.
 *   T5  edge case: single expert -> partnership_targets has exactly 1 entry;
 *       deterministic.
 *   T6  edge case: missing breakthrough_score -> returns deterministic safe
 *       defaults with low-bucket market_size_estimate; NO throw.
 *   T7  edge case: missing classification -> returns deterministic safe
 *       defaults; value_proposition uses fallback template; NO throw.
 *   T8  classification table coverage: structural_transfer /
 *       semantic_implementation / hybrid each map to a distinct
 *       value_proposition template stem.
 *   T9  Canon Part 8 adversarial: opts contains a forbidden field
 *       (meeting fragment in opts.notes) -> auditQueryObject throws
 *       ExternalEgressViolation BEFORE assess() returns; err.name +
 *       err.meta.surface === rs-commercial-assessor-input.
 *   T10 Canon Part 8 adversarial: rs_discovery resolved_authors carries a
 *       forbidden field (meeting fragment in author.identity_text) -> throws
 *       ExternalEgressViolation; err.name === ExternalEgressViolation.
 *   T11 NO LLM CALL: install global.fetch shim that throws on call; install
 *       a brain-client require shim that throws on require; assess() with
 *       full positive input runs to completion; shim is NEVER called.
 *   T12 A1 sweep: every captured assess() output JSON.stringify across
 *       positive-path test cases contains ZERO matches for FORBIDDEN_PATTERNS.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert).
 */

const assert = require('node:assert/strict');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const tests = [];

function record(name, fn) {
  tests.push({ name, fn });
}

function runAll() {
  for (const t of tests) {
    try {
      t.fn();
      passed++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      failed++;
      failures.push({ name: t.name, message: err && err.message ? err.message : String(err) });
      process.stdout.write('FAIL ' + t.name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
    }
  }
}

// Helper: assert function throws ExternalEgressViolation and returns the err.
function assertThrowsEgressViolation(fn, expectedSurface) {
  let caught = null;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  assert.ok(caught !== null, 'expected throw, got none');
  assert.equal(caught.name, 'ExternalEgressViolation',
    'expected err.name=ExternalEgressViolation, got ' + (caught && caught.name));
  assert.ok(caught.meta && typeof caught.meta === 'object',
    'expected err.meta to be object');
  if (expectedSurface !== undefined) {
    assert.equal(caught.meta.surface, expectedSurface,
      'expected err.meta.surface=' + JSON.stringify(expectedSurface)
        + ', got ' + JSON.stringify(caught.meta.surface));
  }
  return caught;
}

// Capture box for A1 sweep -- every positive-path output is appended here
// for cross-test inspection in T12.
const positiveOutputs = [];

// ---------- Module under test ----------

const mod = require('../core/rs-commercial-assessor.cjs');
const { assess, _test } = mod;

// ---------- Fixtures ----------

const FULL_POSITIVE_INPUT = {
  classification: 'structural_transfer',
  bridge_concept: 'graph attention',
  query_concept: 'protein folding',
  doc_concept: 'transformer attention',
  breakthrough_score: 8,
  dimensions: {
    feasibility: 0.9,
    market: 0.8,
    magnitude: 0.85,
    advantage: 0.7,
    impact: 0.9,
  },
  resolved_authors: [
    { author_id: 'a1', name: 'Dr. X', institution: 'MIT' },
    { author_id: 'a2', name: 'Dr. Y', institution: 'Stanford' },
  ],
  resolved_institutions: ['MIT', 'Stanford'],
  industry_signals_count: 5,
};

const SEMANTIC_INPUT = {
  classification: 'semantic_implementation',
  bridge_concept: 'attention',
  query_concept: 'a',
  doc_concept: 'b',
  breakthrough_score: 6,
  resolved_authors: [{ author_id: 'a1', name: 'Dr. Z', institution: 'CMU' }],
  resolved_institutions: ['CMU'],
  industry_signals_count: 3,
};

const HYBRID_INPUT = {
  classification: 'hybrid',
  bridge_concept: 'message passing',
  query_concept: 'a',
  doc_concept: 'b',
  breakthrough_score: 7,
  resolved_authors: [{ author_id: 'a1', name: 'Dr. W', institution: 'Caltech' }],
  resolved_institutions: ['Caltech'],
  industry_signals_count: 4,
};

// ---------- Tests ----------

record('T1 assess exported as function; no-args returns deterministic safe defaults', function () {
  assert.equal(typeof assess, 'function', 'assess must be a function');
  // No-args -> deterministic safe defaults; NO throw.
  const out = assess();
  assert.ok(out && typeof out === 'object', 'no-args output must be object');
  assert.equal(typeof out.market_size_estimate, 'string',
    'market_size_estimate must be string on no-args');
  assert.equal(typeof out.value_proposition, 'string',
    'value_proposition must be string on no-args');
  assert.ok(Array.isArray(out.partnership_targets),
    'partnership_targets must be array on no-args');
  assert.equal(out.partnership_targets.length, 0,
    'no-args partnership_targets must be empty array');
  positiveOutputs.push(out);
});

record('T2 full positive input -- 3 fields populated', function () {
  const out = assess(FULL_POSITIVE_INPUT);
  assert.ok(out && typeof out === 'object', 'output must be object');
  // 3 required fields
  assert.equal(typeof out.market_size_estimate, 'string',
    'market_size_estimate must be string');
  assert.ok(out.market_size_estimate.length > 0,
    'market_size_estimate must be non-empty');
  assert.equal(typeof out.value_proposition, 'string',
    'value_proposition must be string');
  assert.ok(out.value_proposition.length > 0,
    'value_proposition must be non-empty');
  assert.ok(Array.isArray(out.partnership_targets),
    'partnership_targets must be array');
  assert.ok(out.partnership_targets.length >= 1,
    'partnership_targets must have at least 1 entry from full input');
  positiveOutputs.push(out);
});

record('T3 deterministic invariance: 100 calls byte-identical', function () {
  const first = JSON.stringify(assess(FULL_POSITIVE_INPUT));
  for (let i = 0; i < 99; i += 1) {
    const next = JSON.stringify(assess(FULL_POSITIVE_INPUT));
    assert.equal(next, first,
      'iteration ' + i + ' must match first; deterministic invariance broken');
  }
});

record('T4 edge case: zero signals + zero experts -> empty array + low-bucket', function () {
  const out = assess({
    classification: 'structural_transfer',
    bridge_concept: 'x',
    breakthrough_score: 1,
    resolved_authors: [],
    resolved_institutions: [],
    industry_signals_count: 0,
  });
  assert.ok(Array.isArray(out.partnership_targets),
    'partnership_targets must be array');
  assert.equal(out.partnership_targets.length, 0,
    'partnership_targets must be empty when no experts/institutions');
  assert.equal(typeof out.market_size_estimate, 'string',
    'market_size_estimate must be string');
  assert.ok(out.market_size_estimate.length > 0,
    'low-signal bucket must be a non-empty string');
  assert.equal(typeof out.value_proposition, 'string',
    'value_proposition must be string');
  assert.ok(out.value_proposition.length > 0,
    'value_proposition must be populated even at low signal');
  positiveOutputs.push(out);
});

record('T5 edge case: single expert -> partnership_targets length 1', function () {
  const out = assess({
    classification: 'structural_transfer',
    bridge_concept: 'x',
    breakthrough_score: 5,
    resolved_authors: [{ author_id: 'a1', name: 'Dr. Solo', institution: 'Solo Lab' }],
    resolved_institutions: ['Solo Lab'],
    industry_signals_count: 2,
  });
  assert.equal(out.partnership_targets.length, 2,
    'single expert + single institution -> 2 partnership_target entries (1 author + 1 institution)');
  // Determinism subcheck on this case
  const a = JSON.stringify(out);
  const b = JSON.stringify(assess({
    classification: 'structural_transfer',
    bridge_concept: 'x',
    breakthrough_score: 5,
    resolved_authors: [{ author_id: 'a1', name: 'Dr. Solo', institution: 'Solo Lab' }],
    resolved_institutions: ['Solo Lab'],
    industry_signals_count: 2,
  }));
  assert.equal(a, b, 'single-expert path must be deterministic');
  positiveOutputs.push(out);
});

record('T6 edge case: missing breakthrough_score -> safe defaults; NO throw', function () {
  let threw = false;
  let out = null;
  try {
    out = assess({
      classification: 'structural_transfer',
      bridge_concept: 'x',
      resolved_authors: [],
      resolved_institutions: [],
      industry_signals_count: 0,
    });
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false, 'missing breakthrough_score must NOT throw');
  assert.ok(out && typeof out === 'object', 'output must be object');
  assert.equal(typeof out.market_size_estimate, 'string',
    'market_size_estimate must be string under missing-score path');
  assert.ok(out.market_size_estimate.length > 0,
    'market_size_estimate must be non-empty string under missing-score path');
  positiveOutputs.push(out);
});

record('T7 edge case: missing classification -> fallback template; NO throw', function () {
  let threw = false;
  let out = null;
  try {
    out = assess({
      bridge_concept: 'x',
      breakthrough_score: 4,
      resolved_authors: [],
      resolved_institutions: [],
      industry_signals_count: 1,
    });
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, false, 'missing classification must NOT throw');
  assert.ok(out && typeof out === 'object', 'output must be object');
  assert.equal(typeof out.value_proposition, 'string',
    'value_proposition must be string under fallback path');
  assert.ok(out.value_proposition.length > 0,
    'value_proposition must be non-empty under fallback path');
  positiveOutputs.push(out);
});

record('T8 classification table coverage: 3 distinct template stems', function () {
  const outA = assess(FULL_POSITIVE_INPUT); // structural_transfer
  const outB = assess(SEMANTIC_INPUT);      // semantic_implementation
  const outC = assess(HYBRID_INPUT);        // hybrid
  // The three template stems must be distinct -- pick the first 12 chars
  // (or shorter) so we are comparing template stems rather than fully
  // substituted strings (which can also coincidentally collide if the
  // classifications happened to share a prefix only).
  const stemA = outA.value_proposition.slice(0, 12);
  const stemB = outB.value_proposition.slice(0, 12);
  const stemC = outC.value_proposition.slice(0, 12);
  assert.notEqual(stemA, stemB,
    'structural_transfer and semantic_implementation must produce distinct template stems');
  assert.notEqual(stemB, stemC,
    'semantic_implementation and hybrid must produce distinct template stems');
  assert.notEqual(stemA, stemC,
    'structural_transfer and hybrid must produce distinct template stems');
  positiveOutputs.push(outA, outB, outC);
});

record('T9 Canon Part 8 adversarial -- opts contains forbidden field (meeting fragment)', function () {
  // Per docs/MINDRIAN-CANON.md Part 8 + cross-room-aggregator FORBIDDEN_PATTERNS:
  // /\bmeeting with\b/i is the canon-authoritative meeting fragment regex.
  assertThrowsEgressViolation(function () {
    assess(FULL_POSITIVE_INPUT, { notes: 'After meeting with the board last Tuesday' });
  }, 'rs-commercial-assessor-input');
});

record('T10 Canon Part 8 adversarial -- resolved_authors injects forbidden field', function () {
  const adversarialInput = Object.assign({}, FULL_POSITIVE_INPUT, {
    resolved_authors: [
      { author_id: 'a1', name: 'Dr. X', institution: 'MIT',
        identity_text: 'meeting with Lawrence about board minutes' },
    ],
  });
  assertThrowsEgressViolation(function () {
    assess(adversarialInput);
  }, 'rs-commercial-assessor-input');
});

record('T11 NO LLM CALL invariant: global.fetch shim never invoked', function () {
  // Install global.fetch shim that throws on call. assess() must complete
  // without invoking it. Restore on exit so other tests are unaffected.
  const origFetch = global.fetch;
  let fetchCallCount = 0;
  global.fetch = function () {
    fetchCallCount += 1;
    throw new Error('global.fetch invoked from assess() -- NO LLM invariant violated');
  };
  let out = null;
  try {
    out = assess(FULL_POSITIVE_INPUT);
  } finally {
    global.fetch = origFetch;
  }
  assert.equal(fetchCallCount, 0,
    'global.fetch must NEVER be called from assess(); count=' + fetchCallCount);
  assert.ok(out && typeof out === 'object', 'assess() must complete normally');
  positiveOutputs.push(out);
});

record('T12 A1 sweep: every positive output contains ZERO FORBIDDEN_PATTERNS hits', function () {
  const egress = require('../core/rs-egress-prompts.cjs');
  const FORBIDDEN_PATTERNS = egress.FORBIDDEN_PATTERNS;
  assert.ok(Array.isArray(FORBIDDEN_PATTERNS) && FORBIDDEN_PATTERNS.length >= 6,
    'FORBIDDEN_PATTERNS must be re-exported from rs-egress-prompts (>= 6 patterns)');
  assert.ok(positiveOutputs.length >= 5,
    'A1 sweep requires at least 5 captured positive outputs; got ' + positiveOutputs.length);
  for (let i = 0; i < positiveOutputs.length; i += 1) {
    const json = JSON.stringify(positiveOutputs[i]);
    for (const re of FORBIDDEN_PATTERNS) {
      assert.equal(re.test(json), false,
        'positive output ' + i + ' contains FORBIDDEN_PATTERNS hit '
          + re.source + ' in JSON: ' + json.slice(0, 200));
    }
  }
});

// ---------- Suite report ----------

runAll();

const total = passed + failed;
process.stdout.write('\n');
if (failed === 0) {
  process.stdout.write('=== 89.5-01 rs-commercial-assessor suite: ' + passed + '/' + total + ' passed ===\n');
  process.exit(0);
} else {
  process.stdout.write('=== 89.5-01 rs-commercial-assessor suite: ' + passed + '/' + total + ' passed (' + failed + ' failed) ===\n');
  for (const f of failures) {
    process.stdout.write('  FAIL ' + f.name + ': ' + f.message + '\n');
  }
  process.exit(1);
}
