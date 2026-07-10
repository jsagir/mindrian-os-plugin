#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-01 -- AHP criterion-weight module offline contract tests.
 *
 * All assertions run OFFLINE (Canon Part 8: no Brain, no network, no model,
 * no file egress). The module is pure deterministic math over 9 numbers plus
 * one committed local JSON read, so every path is exercised with plain
 * node:assert/strict and fixed inputs.
 *
 *   Test 1: identity-consistent all-equal 3x3 -> weights [1/3,1/3,1/3], cr 0.
 *   Test 2: Saaty textbook matrix -> descending weights, sum 1, cr <= 0.1.
 *   Test 3: wildly inconsistent matrix -> consistent false, cr > 0.1.
 *   Test 4: non-reciprocal matrix -> throws AHP_RECIPROCITY.
 *   Test 5: wrong shape / non-positive entry -> AHP_MATRIX_SHAPE / POSITIVE.
 *   Test 6: composeScore dot product with a one-hot dimension vector.
 *   Test 7 (Task 2): loadAhpConfig() with no arg loads the committed default
 *           matrix and returns equal weights + cr 0.
 */
'use strict';

const assert = require('node:assert/strict');

const ahp = require('../lib/core/eureka/ahp-weights.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// ---------- Test 1: identity-consistent all-equal matrix ----------
{
  const m = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
  const r = ahp.computeAhpWeights(m);
  assert.ok(Math.abs(r.weights[0] - 1 / 3) < 1e-9, 'Test 1: w0 = 1/3');
  assert.ok(Math.abs(r.weights[1] - 1 / 3) < 1e-9, 'Test 1: w1 = 1/3');
  assert.ok(Math.abs(r.weights[2] - 1 / 3) < 1e-9, 'Test 1: w2 = 1/3');
  assert.equal(r.cr, 0, 'Test 1: cr exactly 0');
  assert.equal(r.consistent, true, 'Test 1: consistent true');
  ok('Test 1: all-equal matrix -> weights 1/3 each, cr 0, consistent');
}

// ---------- Test 2: Saaty textbook matrix ----------
{
  const m = [[1, 3, 5], [1 / 3, 1, 3], [1 / 5, 1 / 3, 1]];
  const r = ahp.computeAhpWeights(m);
  assert.ok(r.weights[0] > r.weights[1], 'Test 2: w0 > w1');
  assert.ok(r.weights[1] > r.weights[2], 'Test 2: w1 > w2');
  const sum = r.weights[0] + r.weights[1] + r.weights[2];
  assert.ok(Math.abs(sum - 1) < 1e-9, 'Test 2: weights sum to 1');
  assert.ok(r.cr <= 0.1, 'Test 2: cr <= 0.1');
  assert.equal(r.consistent, true, 'Test 2: consistent true');
  ok('Test 2: Saaty matrix -> descending weights, sum 1, cr <= 0.1');
}

// ---------- Test 3: wildly inconsistent matrix ----------
{
  const m = [[1, 9, 1 / 9], [1 / 9, 1, 9], [9, 1 / 9, 1]];
  const r = ahp.computeAhpWeights(m);
  assert.equal(r.consistent, false, 'Test 3: consistent false');
  assert.ok(r.cr > 0.1, 'Test 3: cr > 0.1');
  ok('Test 3: cyclic matrix -> inconsistent, cr > 0.1');
}

// ---------- Test 4: non-reciprocal matrix throws AHP_RECIPROCITY ----------
{
  const m = [[1, 3, 1], [3, 1, 1], [1, 1, 1]]; // m[0][1]=3 AND m[1][0]=3
  assert.throws(
    function () { ahp.computeAhpWeights(m); },
    function (e) { return /AHP_RECIPROCITY/.test(e.message); },
    'Test 4: throws AHP_RECIPROCITY'
  );
  ok('Test 4: non-reciprocal matrix throws AHP_RECIPROCITY');
}

// ---------- Test 5: bad shape / non-positive entry ----------
{
  assert.throws(
    function () { ahp.computeAhpWeights([[1, 2], [1 / 2, 1]]); },
    function (e) { return /AHP_MATRIX_SHAPE/.test(e.message); },
    'Test 5a: 2x2 throws AHP_MATRIX_SHAPE'
  );
  assert.throws(
    function () { ahp.computeAhpWeights([[1, 0, 1], [1, 1, 1], [1, 1, 1]]); },
    function (e) { return /AHP_MATRIX_POSITIVE/.test(e.message); },
    'Test 5b: zero entry throws AHP_MATRIX_POSITIVE'
  );
  ok('Test 5: bad shape -> AHP_MATRIX_SHAPE, non-positive -> AHP_MATRIX_POSITIVE');
}

// ---------- Test 6: composeScore dot product ----------
{
  const s = ahp.composeScore(
    { strategic_fit: 1, validated_demand: 0, tech_econ_feasibility: 0 },
    [0.5, 0.3, 0.2]
  );
  assert.equal(s, 0.5, 'Test 6: dot product picks w0');
  assert.throws(
    function () {
      ahp.composeScore(
        { strategic_fit: 1.5, validated_demand: 0, tech_econ_feasibility: 0 },
        [0.5, 0.3, 0.2]
      );
    },
    function (e) { return /DIM_RANGE/.test(e.message); },
    'Test 6: out-of-range dimension throws DIM_RANGE'
  );
  ok('Test 6: composeScore is the weighted dot product, DIM_RANGE guarded');
}

// ---------- Test 7 (Task 2): committed default matrix loads equal ----------
{
  const c = ahp.loadAhpConfig();
  assert.deepEqual(c.criteria, ahp.CRITERIA, 'Test 7: criteria order matches CRITERIA');
  assert.ok(Math.abs(c.weights[0] - 1 / 3) < 1e-9, 'Test 7: default w0 = 1/3');
  assert.ok(Math.abs(c.weights[1] - 1 / 3) < 1e-9, 'Test 7: default w1 = 1/3');
  assert.ok(Math.abs(c.weights[2] - 1 / 3) < 1e-9, 'Test 7: default w2 = 1/3');
  assert.equal(c.cr, 0, 'Test 7: default cr 0');
  ok('Test 7: loadAhpConfig() loads the committed default -> equal weights, cr 0');
}

console.log('\ntest-215-ahp-weights: ' + passed + ' assertions passed');
