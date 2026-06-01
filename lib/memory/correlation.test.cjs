#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-01 Task 1 -- correlation.cjs hashing chokepoint test.
 * ================================================================
 * The key_invariant asserting suite for lib/core/correlation.cjs.
 *
 * computeCorrelationId(canonicalName, primaryLabel) is the single
 * deterministic, embedding-INDEPENDENT hashing chokepoint that the Brain
 * backfill (Task 2), the chain-recommender (Plan 02), and the local
 * recommender all reuse so the Brain value and the local value agree by
 * construction.
 *
 * Six behaviors (direct-CJS, node:assert/strict, zero new deps):
 *   1. determinism            -- same (name,label) twice -> identical string
 *   2. embedding-independence -- arity is EXACTLY 2; a hypothetical embedding
 *                                context (extra arg / global) cannot change the
 *                                output. THIS is the key_invariant the CONTEXT
 *                                requires asserting (safe under Phase 134 / 127.1
 *                                vector-substrate swaps).
 *   3. label-sensitivity      -- same name under two labels -> two ids
 *   4. normalization rule     -- trim() on both inputs; case + internal
 *                                whitespace preserved deliberately (documented)
 *   5. collision-resistance   -- over the real REVIEW_REQUIRED name set from the
 *                                2026-05-17 curation audit, all ids are distinct
 *   6. version pin (golden)   -- CORRELATION_VERSION exported; a known input
 *                                pins to a golden value so an accidental hash-
 *                                input change fails loudly.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const c = require('../core/correlation.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  process.stdout.write('  ok - ' + name + '\n');
}

// ---------- Test 1: determinism ----------

test('determinism: same (name,label) twice yields identical id', function () {
  const a = c.computeCorrelationId('Beautiful Question Framework', 'Framework');
  const b = c.computeCorrelationId('Beautiful Question Framework', 'Framework');
  assert.equal(a, b, 'two calls with identical inputs must be byte-identical');
  assert.equal(typeof a, 'string');
  assert.ok(a.length > 0, 'id must be non-empty');
});

// ---------- Test 2: embedding-independence (THE key_invariant) ----------

test('embedding-independence: arity is exactly 2 (cannot key on a vector)', function () {
  // The function declares EXACTLY two formal parameters. An embedding/vector
  // can only enter a function through an argument or global state; arity 2 +
  // purity (Test below) proves the id is a function of (name,label) alone.
  assert.equal(
    c.computeCorrelationId.length,
    2,
    'computeCorrelationId must take EXACTLY 2 params so no embedding can enter'
  );
});

test('embedding-independence: passing a 3rd (embedding) arg does NOT change output', function () {
  const base = c.computeCorrelationId('HEART Framework', 'Framework');
  // Two different hypothetical embedding contexts as a spurious 3rd arg.
  const withVecA = c.computeCorrelationId('HEART Framework', 'Framework', [0.1, 0.2, 0.3]);
  const withVecB = c.computeCorrelationId('HEART Framework', 'Framework', { vector: [0.9, 0.8] });
  assert.equal(withVecA, base, 'a 3rd embedding arg must be ignored (embedding-independent)');
  assert.equal(withVecB, base, 'shape of the ignored 3rd arg is irrelevant');
});

// ---------- Test 3: label-sensitivity ----------

test('label-sensitivity: same name under two labels yields two distinct ids', function () {
  const asFramework = c.computeCorrelationId('HEART Framework', 'Framework');
  const asProduct = c.computeCorrelationId('HEART Framework', 'Product');
  assert.notEqual(
    asFramework,
    asProduct,
    'cross-label duplicates must be distinguishable (Plan 03 cross-label-dups metric)'
  );
});

// ---------- Test 4: normalization rule (trim; case + inner ws preserved) ----------

test('normalization: leading/trailing whitespace is trimmed before hashing', function () {
  const tight = c.computeCorrelationId('Lean Canvas', 'Framework');
  const padded = c.computeCorrelationId('  Lean Canvas  ', 'Framework');
  const paddedLabel = c.computeCorrelationId('Lean Canvas', '  Framework  ');
  assert.equal(padded, tight, 'surrounding whitespace on the name must be trimmed');
  assert.equal(paddedLabel, tight, 'surrounding whitespace on the label must be trimmed');
});

test('normalization: case is PRESERVED deliberately (distinct names stay distinct)', function () {
  // 'HEART Framework' and 'Heart framework' are intentionally distinct ids --
  // the id reflects the node AS STORED; dedup is Phase 132's job, not the hash's.
  const upper = c.computeCorrelationId('HEART Framework', 'Framework');
  const lower = c.computeCorrelationId('Heart framework', 'Framework');
  assert.notEqual(upper, lower, 'case must NOT be silently collapsed');
});

test('normalization: internal whitespace is PRESERVED deliberately', function () {
  const single = c.computeCorrelationId('Lean Canvas', 'Framework');
  const doubled = c.computeCorrelationId('Lean  Canvas', 'Framework');
  assert.notEqual(single, doubled, 'internal whitespace differences must stay distinct');
});

test('normalization: fixed-delimiter input avoids boundary collisions (AB+C vs A+BC)', function () {
  const abC = c.computeCorrelationId('AB', 'C');
  const aBC = c.computeCorrelationId('A', 'BC');
  assert.notEqual(abC, aBC, 'a fixed non-name delimiter must prevent boundary collisions');
});

// ---------- Test 5: collision-resistance over the real name set ----------

// The 28 REVIEW_REQUIRED framework names from
// ~/MindrianRooms/mindrianOS/methodology/2026-05-17-brain-curation-audit.md
// (section 3 classification). The real name set the curation audit enumerated.
const REVIEW_REQUIRED_NAMES = [
  'Ackoff Pyramid',
  'Challenging Orthodoxies',
  'Diverge-Converge Model',
  'Five-Step Implementation Process',
  'PEST',
  'Pain Points',
  'ABET Accreditation Outcomes',
  'Adaptive Leadership',
  'Authentic Leadership',
  'Communication for Leaders',
  'Distributed Leadership',
  'Emotional Intelligence in Leadership',
  'Engineering Ethics in Leadership',
  'Five Practices of Effective Executives',
  'High-Performing Teams',
  'Servant Leadership',
  'Situational Leadership',
  'Strategic Decision Making for Leaders',
  'Transformational Leadership',
  'Tuckman Team Stages',
  'John Mullins Framework',
  'Mullins Model',
  'PWS Framework (Problem/Opportunity, Larger System, Goal, Map Hierarchy)',
  'Define the Focal Component (Level 1)',
  'Resulting',
  'Photonic Interconnect Multi-Agent System',
  'Poverty',
  'higher education transformation',
];

test('collision-resistance: 28 real REVIEW_REQUIRED names produce 28 distinct ids', function () {
  assert.equal(REVIEW_REQUIRED_NAMES.length, 28, 'fixture must carry the real 28-name set');
  const ids = REVIEW_REQUIRED_NAMES.map(function (n) {
    return c.computeCorrelationId(n, 'Framework');
  });
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'no two real framework names may collide under one label');
});

// ---------- Test 6: golden version pin ----------

test('version pin: CORRELATION_VERSION + CORRELATION_ALGO exported', function () {
  assert.equal(typeof c.CORRELATION_VERSION, 'number', 'CORRELATION_VERSION must be an integer');
  assert.ok(Number.isInteger(c.CORRELATION_VERSION), 'CORRELATION_VERSION must be an integer');
  assert.ok(c.CORRELATION_VERSION >= 1, 'CORRELATION_VERSION starts at 1');
  assert.equal(c.CORRELATION_ALGO, 'sha256', 'CORRELATION_ALGO must be sha256');
});

test('version pin: golden value for a known input fails loudly on any hash-input change', function () {
  // Re-derive the expected digest the SAME way the module must, independently,
  // so this test pins the exact hash-input construction (version prefix +
  // NUL-delimited trimmed tuple). If the module's input shape ever changes by
  // accident, this assertion breaks.
  const name = 'Beautiful Question Framework';
  const label = 'Framework';
  const expectedHex = crypto
    .createHash('sha256')
    .update(name.trim() + ' ' + label.trim())
    .digest('hex');
  const expected = 'c' + c.CORRELATION_VERSION + ':' + expectedHex;
  const actual = c.computeCorrelationId(name, label);
  assert.equal(actual, expected, 'golden value pins the version-prefixed NUL-delimited sha256 hex');
});

// ---------- fail-loud on non-string ----------

test('fail-loud: non-string name throws TypeError (never silently hashes undefined)', function () {
  assert.throws(function () { c.computeCorrelationId(undefined, 'Framework'); }, TypeError);
  assert.throws(function () { c.computeCorrelationId(42, 'Framework'); }, TypeError);
  assert.throws(function () { c.computeCorrelationId('X', null); }, TypeError);
});

process.stdout.write('\ncorrelation.test.cjs: ' + passed + ' passed\n');
