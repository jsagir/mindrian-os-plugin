#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-02 -- portfolio-dimensions offline contract tests (Task 1).
 *
 * All assertions run OFFLINE (Canon Part 8: no Brain, no network, no model,
 * no file egress). portfolio-dimensions is a pure deterministic classifier
 * over already-measured local signals, so every path is exercised with plain
 * node:assert/strict and fixed synthetic inputs.
 *
 *   Test 1: tier -> strategic_fit map (1 -> 1.0, 2 -> 0.5, 3 -> 1/3,
 *           missing/invalid -> 0.25 honest below-tier-3 floor).
 *   Test 2: validated_demand is the pair_count percentile within the cohort
 *           (top pair_count -> 1.0, bottom -> 0.0, ties share the mean rank).
 *   Test 3: pair feasibility piecewise map from the rs measured fields
 *           (in-band structural bridge -> 1.0, out-of-band transfer -> 0.7,
 *           semantic_implementation -> 0.4, passes false -> 0.1).
 *   Test 4: scorePairDimensions aggregates sides (strategic_fit = max,
 *           validated_demand = mean, tech_econ_feasibility = the rs value).
 *   Test 5: weakDimensions + complementary (three low into one high precond).
 */
'use strict';

const assert = require('node:assert/strict');

const dim = require('../lib/core/eureka/portfolio-dimensions.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// ---------- Test 1: tier -> strategic_fit map ----------
{
  const cohort = [
    { id: 't1', primary_tier: 1, pair_count: 3, degree: 2 },
    { id: 't2', primary_tier: 2, pair_count: 1, degree: 1 },
  ];
  const s1 = dim.scoreTechDimensions({ id: 't1', primary_tier: 1, pair_count: 3, degree: 2 }, cohort);
  const s2 = dim.scoreTechDimensions({ id: 't2', primary_tier: 2, pair_count: 1, degree: 1 }, cohort);
  const s3 = dim.scoreTechDimensions({ id: 't3', primary_tier: 3, pair_count: 1, degree: 1 }, cohort);
  const sMiss = dim.scoreTechDimensions({ id: 't4', pair_count: 1, degree: 1 }, cohort);
  const sBad = dim.scoreTechDimensions({ id: 't5', primary_tier: 0, pair_count: 1, degree: 1 }, cohort);
  assert.equal(s1.strategic_fit, 1.0, 'Test 1: tier 1 -> 1.0');
  assert.equal(s2.strategic_fit, 0.5, 'Test 1: tier 2 -> 0.5');
  assert.ok(Math.abs(s3.strategic_fit - 1 / 3) < 1e-9, 'Test 1: tier 3 -> 1/3');
  assert.equal(sMiss.strategic_fit, 0.25, 'Test 1: missing tier -> 0.25');
  assert.equal(sBad.strategic_fit, 0.25, 'Test 1: invalid tier -> 0.25');
  ok('Test 1: tier -> strategic_fit map (1/0.5/0.333/0.25 honest floor)');
}

// ---------- Test 2: validated_demand pair_count percentile ----------
{
  const cohort = [
    { id: 'a', primary_tier: 2, pair_count: 0, degree: 1 },
    { id: 'b', primary_tier: 2, pair_count: 1, degree: 1 },
    { id: 'c', primary_tier: 2, pair_count: 2, degree: 1 },
    { id: 'd', primary_tier: 2, pair_count: 5, degree: 1 },
    { id: 'e', primary_tier: 2, pair_count: 9, degree: 1 },
  ];
  const top = dim.scoreTechDimensions(cohort[4], cohort);
  const bottom = dim.scoreTechDimensions(cohort[0], cohort);
  assert.equal(top.validated_demand, 1.0, 'Test 2: pair_count 9 -> 1.0');
  assert.equal(bottom.validated_demand, 0.0, 'Test 2: pair_count 0 -> 0.0');
  // ties share the mean rank
  const tied = [
    { id: 'a', primary_tier: 2, pair_count: 0, degree: 1 },
    { id: 'b', primary_tier: 2, pair_count: 2, degree: 1 },
    { id: 'c', primary_tier: 2, pair_count: 2, degree: 1 },
    { id: 'd', primary_tier: 2, pair_count: 9, degree: 1 },
  ];
  const t1 = dim.scoreTechDimensions(tied[1], tied);
  const t2 = dim.scoreTechDimensions(tied[2], tied);
  assert.equal(t1.validated_demand, t2.validated_demand, 'Test 2: ties share the mean rank');
  ok('Test 2: validated_demand is the cohort pair_count percentile, ties averaged');
}

// ---------- Test 3: pair feasibility piecewise map ----------
{
  const bridge = dim.scorePairDimensions({
    a: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 },
    b: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 },
    rs: { direction: 'structural_transfer', abs_diff: 0.20, passes: true },
  });
  const transfer = dim.scorePairDimensions({
    a: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 },
    b: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 },
    rs: { direction: 'structural_transfer', abs_diff: 0.30, passes: true },
  });
  const semantic = dim.scorePairDimensions({
    a: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 },
    b: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 },
    rs: { direction: 'semantic_implementation', abs_diff: 0.30, passes: true },
  });
  const failing = dim.scorePairDimensions({
    a: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 },
    b: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 },
    rs: { direction: 'structural_transfer', abs_diff: 0.05, passes: false },
  });
  assert.equal(bridge.tech_econ_feasibility, 1.0, 'Test 3: in-band structural bridge -> 1.0');
  assert.equal(transfer.tech_econ_feasibility, 0.7, 'Test 3: out-of-band transfer -> 0.7');
  assert.equal(semantic.tech_econ_feasibility, 0.4, 'Test 3: semantic_implementation -> 0.4');
  assert.equal(failing.tech_econ_feasibility, 0.1, 'Test 3: passes false -> 0.1');
  ok('Test 3: pair feasibility piecewise map (1.0/0.7/0.4/0.1) over the rs fields');
}

// ---------- Test 4: scorePairDimensions aggregation ----------
{
  const pair = dim.scorePairDimensions({
    a: { strategic_fit: 1.0, validated_demand: 0.2, tech_econ_feasibility: 0.9 },
    b: { strategic_fit: 0.5, validated_demand: 0.8, tech_econ_feasibility: 0.1 },
    rs: { direction: 'structural_transfer', abs_diff: 0.20, passes: true },
  });
  assert.equal(pair.strategic_fit, 1.0, 'Test 4: strategic_fit = max(a,b)');
  assert.ok(Math.abs(pair.validated_demand - 0.5) < 1e-9, 'Test 4: validated_demand = mean(a,b)');
  assert.equal(pair.tech_econ_feasibility, 1.0, 'Test 4: feasibility = the rs piecewise value');
  ok('Test 4: scorePairDimensions inherits max fit + mean demand + rs feasibility');
}

// ---------- Test 5: weakDimensions + complementary ----------
{
  const weak = dim.weakDimensions({ strategic_fit: 0.3, validated_demand: 0.9, tech_econ_feasibility: 0.2 });
  assert.deepEqual(weak, ['strategic_fit', 'tech_econ_feasibility'], 'Test 5: exactly the two keys below WEAK_FLOOR');

  // true: each side is weak where the other is strong, disjoint non-empty
  const trueCase = dim.complementary(
    { strategic_fit: 0.2, validated_demand: 0.9, tech_econ_feasibility: 0.9 },
    { strategic_fit: 0.9, validated_demand: 0.2, tech_econ_feasibility: 0.9 }
  );
  assert.equal(trueCase, true, 'Test 5: disjoint non-empty weak sets -> complementary');

  // false: overlapping weakness (both weak in strategic_fit)
  const overlap = dim.complementary(
    { strategic_fit: 0.2, validated_demand: 0.9, tech_econ_feasibility: 0.9 },
    { strategic_fit: 0.2, validated_demand: 0.2, tech_econ_feasibility: 0.9 }
  );
  assert.equal(overlap, false, 'Test 5: overlapping weakness -> not complementary');

  // false: one side has no weakness at all
  const noWeak = dim.complementary(
    { strategic_fit: 0.9, validated_demand: 0.9, tech_econ_feasibility: 0.9 },
    { strategic_fit: 0.2, validated_demand: 0.9, tech_econ_feasibility: 0.9 }
  );
  assert.equal(noWeak, false, 'Test 5: an empty weak set -> not complementary');
  ok('Test 5: weakDimensions + complementary encode the three-low-into-one-high precond');
}

console.log('\ntest-215-score: ' + passed + ' assertions passed');
