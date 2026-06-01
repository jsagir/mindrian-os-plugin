#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-01 Task 2 -- correlation-label-index.test.cjs
 * ========================================================
 * Asserts the serialize/parse round-trip of the LOCAL correlation_labels index
 * (the named data source Plan 02's no-fork canonical pick reads). Direct-CJS
 * node:assert/strict, zero new deps. Mirrors the lib/memory/*.test.cjs idiom.
 *
 * Behaviors:
 *   1. round-trip preserves a unique (single-label) name with its degree.
 *   2. round-trip preserves a CROSS-LABEL-DUPLICATE name (one entry per label,
 *      each with its own degree) -- the disambiguation data Plan 02 needs.
 *   3. parseLabelIndex on empty / null / undefined / malformed returns {}
 *      without throwing (total + pure tolerance contract).
 *   4. LABEL_INDEX_SECTION_KEY is the stable literal 'correlation_labels'.
 *   5. serialize output is deterministic (byte-identical on repeat + on
 *      shuffled input) -- idempotency at the artifact level.
 *   6. pipe-bearing names round-trip losslessly (escape/unescape).
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const idx = require('../core/correlation-label-index.cjs');

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + label);
}

// ---- 4. section key is the stable literal ----
check('section key is the stable literal correlation_labels', function () {
  assert.equal(idx.LABEL_INDEX_SECTION_KEY, 'correlation_labels');
});

// ---- 1. unique-name round-trip ----
check('round-trip preserves a unique single-label name + degree', function () {
  const rows = [{ canonical_name: 'Beautiful Question Framework', primary_label: 'Framework', edge_degree: 11 }];
  const body = idx.serializeLabelIndex(rows);
  const parsed = idx.parseLabelIndex(body);
  assert.deepEqual(parsed['Beautiful Question Framework'], [{ primary_label: 'Framework', edge_degree: 11 }]);
});

// ---- 2. cross-label-duplicate round-trip (the Plan 02 disambiguation case) ----
check('round-trip preserves a cross-label-duplicate name with per-label degree', function () {
  const rows = [
    { canonical_name: 'HEART Framework', primary_label: 'Framework', edge_degree: 8 },
    { canonical_name: 'HEART Framework', primary_label: 'Product', edge_degree: 2 },
    { canonical_name: 'Jobs-to-be-Done', primary_label: 'Framework', edge_degree: 14 },
  ];
  const body = idx.serializeLabelIndex(rows);
  const parsed = idx.parseLabelIndex(body);
  // The cross-label name carries one entry per label, each with its own degree.
  const heart = parsed['HEART Framework'];
  assert.equal(heart.length, 2);
  const byLabel = {};
  for (const e of heart) byLabel[e.primary_label] = e.edge_degree;
  assert.equal(byLabel.Framework, 8);
  assert.equal(byLabel.Product, 2);
  // The unique name still round-trips alongside it.
  assert.deepEqual(parsed['Jobs-to-be-Done'], [{ primary_label: 'Framework', edge_degree: 14 }]);
});

// ---- 3. empty / null / malformed -> {} without throwing ----
check('parseLabelIndex on empty string returns {} without throwing', function () {
  assert.deepEqual(idx.parseLabelIndex(''), {});
});
check('parseLabelIndex on null returns {} without throwing', function () {
  assert.deepEqual(idx.parseLabelIndex(null), {});
});
check('parseLabelIndex on undefined returns {} without throwing', function () {
  assert.deepEqual(idx.parseLabelIndex(undefined), {});
});
check('parseLabelIndex on (no signal) returns {} without throwing', function () {
  assert.deepEqual(idx.parseLabelIndex('(no signal)'), {});
});
check('parseLabelIndex on a malformed body returns {} without throwing', function () {
  // A line with fewer than 3 fields is skipped; an all-garbage body yields {}.
  assert.deepEqual(idx.parseLabelIndex('garbage with no delimiters\nanother bad line'), {});
});
check('serializeLabelIndex on non-array / empty returns empty string', function () {
  assert.equal(idx.serializeLabelIndex(null), '');
  assert.equal(idx.serializeLabelIndex([]), '');
  assert.equal(idx.serializeLabelIndex([{ primary_label: 'Framework' }]), ''); // missing name -> skipped
});

// ---- 5. determinism: byte-identical on repeat + on shuffled input ----
check('serializeLabelIndex is deterministic (byte-identical on repeat + shuffle)', function () {
  const rowsA = [
    { canonical_name: 'Zebra Framework', primary_label: 'Framework', edge_degree: 3 },
    { canonical_name: 'Alpha Framework', primary_label: 'Concept', edge_degree: 1 },
    { canonical_name: 'Alpha Framework', primary_label: 'Framework', edge_degree: 9 },
  ];
  const rowsB = [
    { canonical_name: 'Alpha Framework', primary_label: 'Framework', edge_degree: 9 },
    { canonical_name: 'Zebra Framework', primary_label: 'Framework', edge_degree: 3 },
    { canonical_name: 'Alpha Framework', primary_label: 'Concept', edge_degree: 1 },
  ];
  const a = idx.serializeLabelIndex(rowsA);
  const b = idx.serializeLabelIndex(rowsB);
  assert.equal(a, b, 'shuffled input must serialize byte-identically');
  assert.equal(a, idx.serializeLabelIndex(rowsA), 'repeat run must be byte-identical');
});

// ---- 6. pipe-bearing names round-trip losslessly ----
check('pipe-bearing names round-trip losslessly via escape', function () {
  const rows = [{ canonical_name: 'A | B Framework', primary_label: 'Framework', edge_degree: 5 }];
  const body = idx.serializeLabelIndex(rows);
  const parsed = idx.parseLabelIndex(body);
  assert.deepEqual(parsed['A | B Framework'], [{ primary_label: 'Framework', edge_degree: 5 }]);
});

console.log('\ncorrelation-label-index.test.cjs: ' + passed + ' passed');
