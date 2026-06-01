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
 * LOCKED CONTRACT OF RECORD (Phase 131 close-out packet, 2026-06-01)
 * ==================================================================
 *   correlation_id = sha256( utf8( name + '|' + primary_label ) ).hex().slice(0,16)
 *
 * RAW inputs (NO trim, NO case-fold, NO internal-whitespace collapse), literal
 * '|' delimiter, raw primary_label, utf8 encoding, lowercase hex, FIRST 16
 * chars, NO version prefix. The live teaching graph already carries 721
 * backfilled correlation_ids under THIS exact scheme; the code MUST match it
 * byte-for-byte. The anchor is computeCorrelationId('The Other Way Round',
 * 'Technique') === '4210289a0ca1596b'.
 *
 * This suite was CORRECTED on 2026-06-01: the original pinned a non-conformant
 * 'c1:'-prefixed full-sha256 scheme that hashed name.trim() + ' ' + label.trim().
 * That scheme forked from the 721 ids already on the live Brain. The golden pin,
 * the trim-normalization vectors, and the version-prefix assumption are all
 * removed; the locked-contract anchor + no-trim vectors + the
 * embedding-independence invariant replace them.
 *
 * Behaviors (direct-CJS, node:assert/strict, zero new deps):
 *   1. determinism            -- same (name,label) twice -> identical string
 *   2. embedding-independence -- arity is EXACTLY 2; a hypothetical embedding
 *                                context (extra arg / global) cannot change the
 *                                output. THIS is the key_invariant the CONTEXT
 *                                requires asserting (safe under Phase 134 / 127.1
 *                                vector-substrate swaps).
 *   3. label-sensitivity      -- same name under two labels -> two ids
 *   4. NO-trim raw-input rule  -- leading/trailing/internal whitespace and case
 *                                are PRESERVED (the id reflects the node AS
 *                                STORED; dedup is Phase 132's job, not the hash's)
 *   5. shape                  -- 16-char lowercase hex, NO 'c1:'/version prefix
 *   6. anchor (golden)        -- the locked anchor 4210289a0ca1596b pins the
 *                                exact hash-input construction; an accidental
 *                                hash-input change fails loudly
 *   7. collision-resistance   -- over the real REVIEW_REQUIRED name set, all
 *                                ids are distinct
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
  // purity (below) proves the id is a function of (name,label) alone.
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

// ---------- Test 4: NO-trim raw-input rule (locked contract) ----------

test('no-trim: leading/trailing whitespace on the NAME is PRESERVED (raw hash)', function () {
  // LOCKED contract: the name is hashed EXACTLY AS STORED. A padded name is a
  // DISTINCT id, not a silently-merged one. Merging whitespace-padded names is a
  // Phase 132 curation/dedup decision, NOT the hash's job. A hash that trimmed
  // would fork from the 721 ids already on the live Brain.
  const tight = c.computeCorrelationId('Lean Canvas', 'Framework');
  const padded = c.computeCorrelationId('  Lean Canvas  ', 'Framework');
  assert.notEqual(padded, tight, 'surrounding whitespace on the name must NOT be trimmed away');
});

test('no-trim: leading/trailing whitespace on the LABEL is PRESERVED (raw hash)', function () {
  const tight = c.computeCorrelationId('Lean Canvas', 'Framework');
  const paddedLabel = c.computeCorrelationId('Lean Canvas', '  Framework  ');
  assert.notEqual(paddedLabel, tight, 'surrounding whitespace on the label must NOT be trimmed away');
});

test('no-case-fold: case is PRESERVED deliberately (distinct names stay distinct)', function () {
  // 'HEART Framework' and 'Heart framework' are intentionally distinct ids --
  // the id reflects the node AS STORED; dedup is Phase 132's job, not the hash's.
  const upper = c.computeCorrelationId('HEART Framework', 'Framework');
  const lower = c.computeCorrelationId('Heart framework', 'Framework');
  assert.notEqual(upper, lower, 'case must NOT be silently collapsed');
});

test('no-collapse: internal whitespace is PRESERVED deliberately', function () {
  const single = c.computeCorrelationId('Lean Canvas', 'Framework');
  const doubled = c.computeCorrelationId('Lean  Canvas', 'Framework');
  assert.notEqual(single, doubled, 'internal whitespace differences must stay distinct');
});

test('fixed-delimiter input avoids boundary collisions (AB+C vs A+BC)', function () {
  const abC = c.computeCorrelationId('AB', 'C');
  const aBC = c.computeCorrelationId('A', 'BC');
  assert.notEqual(abC, aBC, 'the literal | delimiter must prevent boundary collisions');
});

// ---------- Test 5: shape (16-char lowercase hex, NO version prefix) ----------

test('shape: id is exactly 16 lowercase hex chars with NO version prefix', function () {
  const id = c.computeCorrelationId('Beautiful Question Framework', 'Framework');
  assert.match(id, /^[0-9a-f]{16}$/, 'id must be 16 lowercase hex chars, bare (no c1: prefix)');
  assert.equal(id.length, c.CORRELATION_ID_LENGTH, 'id length matches CORRELATION_ID_LENGTH');
  assert.equal(c.CORRELATION_ID_LENGTH, 16, 'CORRELATION_ID_LENGTH is locked to 16');
  assert.ok(!/^c\d+:/.test(id), 'id must NOT carry a c<version>: prefix (locked contract is bare hex)');
});

// ---------- Test 6: anchor (golden) ----------

test('anchor: locked vector The Other Way Round|Technique == 4210289a0ca1596b', function () {
  // The LOCKED contract anchor. The live teaching graph carries this exact id.
  assert.equal(
    c.computeCorrelationId('The Other Way Round', 'Technique'),
    '4210289a0ca1596b',
    'the locked anchor must hold byte-for-byte (fork from the live Brain otherwise)'
  );
});

test('anchor: independently re-derived sha256(name|label).slice(0,16) matches the module', function () {
  // Re-derive the expected digest the SAME way the locked contract specifies,
  // independently, so this test pins the exact hash-input construction:
  //   sha256( utf8( name + '|' + label ) ).hex().slice(0,16)
  // RAW inputs (no trim), literal '|', utf8, lowercase hex, first 16 chars. If
  // the module's input shape ever drifts from the contract, this breaks loudly.
  const name = 'The Other Way Round';
  const label = 'Technique';
  const expected = crypto
    .createHash('sha256')
    .update(name + '|' + label, 'utf8')
    .digest('hex')
    .slice(0, 16);
  const actual = c.computeCorrelationId(name, label);
  assert.equal(actual, expected, 'module must hash raw name + | + label, utf8, first 16 hex');
  assert.equal(expected, '4210289a0ca1596b', 'independent re-derivation also equals the anchor');
});

// ---------- Test 7: collision-resistance over the real name set ----------

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

// ---------- metadata export (version is metadata only, NOT part of the id) ----------

test('metadata: CORRELATION_VERSION + CORRELATION_ALGO exported (version is NOT in the id)', function () {
  assert.equal(typeof c.CORRELATION_VERSION, 'number', 'CORRELATION_VERSION must be an integer');
  assert.ok(Number.isInteger(c.CORRELATION_VERSION), 'CORRELATION_VERSION must be an integer');
  assert.ok(c.CORRELATION_VERSION >= 1, 'CORRELATION_VERSION starts at 1');
  assert.equal(c.CORRELATION_ALGO, 'sha256', 'CORRELATION_ALGO must be sha256');
  // The version is metadata ONLY -- it must NOT appear in the id (locked: bare hex).
  const id = c.computeCorrelationId('Beautiful Question Framework', 'Framework');
  assert.ok(id.indexOf(String(c.CORRELATION_VERSION) + ':') === -1, 'version must not leak into the id');
});

// ---------- fail-loud on non-string ----------

test('fail-loud: non-string name throws TypeError (never silently hashes undefined)', function () {
  assert.throws(function () { c.computeCorrelationId(undefined, 'Framework'); }, TypeError);
  assert.throws(function () { c.computeCorrelationId(42, 'Framework'); }, TypeError);
  assert.throws(function () { c.computeCorrelationId('X', null); }, TypeError);
});

process.stdout.write('\ncorrelation.test.cjs: ' + passed + ' passed\n');
