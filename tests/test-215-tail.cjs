#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-02 -- tail-quadrant offline contract tests (Task 2).
 *
 * All assertions run OFFLINE (Canon Part 8: pure math over caller-supplied
 * arrays, no Brain, no network, no file access). classifyTail flags the
 * low-attention / high-growth weak-signal quadrant as a DISTINCT category with
 * honest degeneracy guards and the optional Burt brokerage seam (DG-1).
 *
 *   Test 1: a 40-item cohort with exactly 3 items in the quadrant -> tail is
 *           those 3, both guards clear, composition attention-growth-only.
 *   Test 2: a 10-item cohort (< MIN_COHORT) -> tail [], insufficient_structure.
 *   Test 3: a pathological cohort (60% in-quadrant) -> suspect_noise, list kept.
 *   Test 4: brokerage composition re-ranks and stamps attention-growth-brokerage.
 *   Test 5: a malformed axis value throws TAIL_AXIS_RANGE.
 */
'use strict';

const assert = require('node:assert/strict');

const tail = require('../lib/core/eureka/tail-quadrant.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// A 40-item cohort with anti-correlated axes so ONLY the 3 hand-placed gems sit
// in the low-attention / high-growth quadrant. Ramp item k has rising attention
// and rising growth in lockstep, so low-attention items have low growth and
// high-growth items have high attention - neither ramp side enters the quadrant.
function buildRampCohort() {
  const items = [];
  for (let k = 0; k <= 36; k += 1) {
    items.push({ id: 'r' + k, attention: 0.3 + 0.6 * (k / 36), growth: 0.5 * (k / 36) });
  }
  items.push({ id: 'gem-0', attention: 0.0, growth: 1.0 });
  items.push({ id: 'gem-1', attention: 0.0, growth: 1.0 });
  items.push({ id: 'gem-2', attention: 0.0, growth: 1.0 });
  return items;
}

// ---------- Test 1: exactly three gems in the quadrant ----------
{
  const r = tail.classifyTail(buildRampCohort());
  const ids = r.tail.map(function (x) { return x.id; }).sort();
  assert.deepEqual(ids, ['gem-0', 'gem-1', 'gem-2'], 'Test 1: tail is exactly the 3 gems');
  assert.equal(r.insufficient_structure, false, 'Test 1: insufficient_structure false');
  assert.equal(r.suspect_noise, false, 'Test 1: suspect_noise false');
  assert.equal(r.composition, 'attention-growth-only', 'Test 1: attention-growth-only');
  assert.equal(r.growth_proxy, 'cnumber-recency', 'Test 1: growth proxy stamped');
  assert.ok(r.thresholds && typeof r.thresholds.attnCut === 'number', 'Test 1: thresholds carried');
  ok('Test 1: 40-item cohort, exactly 3 gems flagged, both guards clear');
}

// ---------- Test 2: sparse cohort degrades honestly ----------
{
  const items = [];
  for (let i = 0; i < 10; i += 1) {
    items.push({ id: 's' + i, attention: 0.1 * i, growth: 1 - 0.1 * i });
  }
  const r = tail.classifyTail(items);
  assert.deepEqual(r.tail, [], 'Test 2: no fabricated tail');
  assert.equal(r.insufficient_structure, true, 'Test 2: insufficient_structure true');
  assert.equal(r.suspect_noise, false, 'Test 2: suspect_noise false');
  ok('Test 2: cohort < MIN_COHORT -> insufficient_structure, empty tail');
}

// ---------- Test 3: pathological cohort is stamped suspect_noise ----------
{
  const items = [];
  for (let i = 0; i < 24; i += 1) items.push({ id: 'lo' + i, attention: 0.1, growth: 0.9 });
  for (let i = 0; i < 16; i += 1) items.push({ id: 'hi' + i, attention: 0.2, growth: 0.8 });
  const r = tail.classifyTail(items);
  assert.equal(r.suspect_noise, true, 'Test 3: suspect_noise true');
  assert.equal(r.insufficient_structure, false, 'Test 3: insufficient_structure false');
  assert.equal(r.tail.length, 24, 'Test 3: the list is still returned honestly');
  ok('Test 3: 60% in-quadrant -> suspect_noise stamped, list kept');
}

// ---------- Test 4: brokerage composition re-ranks ----------
{
  const brokerage = new Map([
    ['gem-0', 0.9],
    ['gem-1', 0.1],
    ['gem-2', 0.5],
  ]);
  const r = tail.classifyTail(buildRampCohort(), { brokerage: brokerage });
  assert.equal(r.composition, 'attention-growth-brokerage', 'Test 4: composition stamped');
  assert.equal(r.tail.length, 3, 'Test 4: still the 3 gems');
  r.tail.forEach(function (x) {
    assert.equal(typeof x.brokerage, 'number', 'Test 4: each tail item carries brokerage');
  });
  // gems tie on (growth - attention) = 1.0, so brokerage breaks the tie desc.
  assert.equal(r.tail[0].id, 'gem-0', 'Test 4: highest brokerage ranks first');
  assert.equal(r.tail[2].id, 'gem-1', 'Test 4: lowest brokerage ranks last');
  ok('Test 4: brokerage seam re-ranks the tail and stamps the composition');
}

// ---------- Test 5: malformed axis fails loud ----------
{
  const items = buildRampCohort();
  items[0] = { id: 'bad', attention: 1.5, growth: 0.5 };
  assert.throws(
    function () { tail.classifyTail(items); },
    function (e) { return /TAIL_AXIS_RANGE/.test(e.message); },
    'Test 5: out-of-range axis throws TAIL_AXIS_RANGE'
  );
  const missing = buildRampCohort();
  missing[1] = { id: 'nogrowth', attention: 0.2 };
  assert.throws(
    function () { tail.classifyTail(missing); },
    function (e) { return /TAIL_AXIS_RANGE/.test(e.message); },
    'Test 5: missing axis throws TAIL_AXIS_RANGE'
  );
  ok('Test 5: malformed / out-of-range axis throws TAIL_AXIS_RANGE');
}

console.log('\ntest-215-tail: ' + passed + ' assertions passed');
