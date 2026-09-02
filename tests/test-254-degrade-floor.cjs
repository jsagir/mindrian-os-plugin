#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 254 Plan 01 Task 1 -- WIRE-02 coverage for the projection-first blend
 * seam's disclosed registry floor (lib/workflow/chain-source.cjs).
 *
 * WIRE-02: when the projection has no chain edge for the seed, the surface
 * degrades to today's registry-composed answer with a disclosed source,
 * never to empty (D-03, blend-never-replace -- not negotiable scope, a
 * correctness requirement reproduced live in 254-RESEARCH.md Section 2.4).
 *
 * Arms:
 *   1. ill-defined -> Beautiful Question Framework -> registry-floor.
 *   2. no problem type at all (the DEFAULT_SEED path) -> registry-floor.
 *      Arms 1 and 2 are the two MOST COMMON real invocations; a straight
 *      replace was proven live to turn both into empty -- this pair pins
 *      D-03.
 *   3. well-defined -> PWS Triple Validation Compass -> registry-floor (no
 *      outbound chain edge in the projection).
 *   4. (NEVER empty) all four inputs return a non-empty frameworks array and
 *      a source that is always one of the two legal literals.
 *   5. (fixture-injected empty projection) an explicitly empty projection
 *      flips a seed that otherwise HAS an edge to registry-floor -- proves
 *      the floor fires on an empty projection, not only on a seed with no
 *      edge.
 *   6. describeSource() on a floor result names the source and the seed in
 *      double quotes.
 *
 * The require is guarded: before Task 2 lands, lib/workflow/chain-source.cjs
 * does not exist, so this suite is expected to FAIL with a legible "module
 * loads" arm rather than an uncaught MODULE_NOT_FOUND stack trace. That is
 * the honest RED baseline (Phases 272 / 273 / 274 convention).
 *
 * Run: node tests/test-254-degrade-floor.cjs
 * Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');

let mod = null;
let loadError = null;
try {
  mod = require('../lib/workflow/chain-source.cjs');
} catch (e) {
  loadError = e;
}

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok    ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('  FAIL  ' + name + ' -- ' + (e && e.message ? e.message : String(e)) + '\n');
    fail += 1;
  }
}

test('module loads', function () {
  if (loadError) throw loadError;
  assert.ok(mod, 'lib/workflow/chain-source.cjs loaded');
  assert.strictEqual(typeof mod.resolveChainSource, 'function', 'resolveChainSource is exported');
  assert.strictEqual(typeof mod.describeSource, 'function', 'describeSource is exported');
});

test('Arm 1: registry-floor for ill-defined (Beautiful Question Framework has no outbound chain edge)', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.resolveChainSource({ problemType: 'ill-defined' });
  assert.strictEqual(result.seed, 'Beautiful Question Framework', 'seed is Beautiful Question Framework');
  assert.strictEqual(result.source, 'registry-floor', 'source is registry-floor');
  assert.ok(result.frameworks.length >= 1, 'frameworks non-empty');
  assert.strictEqual(result.frameworks[0], 'Beautiful Question Framework', 'frameworks[0] is the seed');
});

test('Arm 2: registry-floor for no problem type at all (the DEFAULT_SEED path)', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.resolveChainSource({});
  assert.strictEqual(result.seed, 'Beautiful Question Framework', 'seed is the DEFAULT_SEED, Beautiful Question Framework');
  assert.strictEqual(result.source, 'registry-floor', 'source is registry-floor');
  assert.ok(result.frameworks.length >= 1, 'frameworks non-empty');
});

test('Arm 3: registry-floor for well-defined (PWS Triple Validation Compass has no outbound chain edge)', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.resolveChainSource({ problemType: 'well-defined' });
  assert.strictEqual(result.seed, 'PWS Triple Validation Compass', 'seed is PWS Triple Validation Compass');
  assert.strictEqual(result.source, 'registry-floor', 'source is registry-floor');
});

test('Arm 4 (NEVER empty): all four real-world inputs return a non-empty frameworks array and a legal source', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const inputs = [
    { problemType: 'ill-defined' },
    { problemType: 'undefined' },
    { problemType: 'well-defined' },
    {},
  ];
  for (const input of inputs) {
    const result = mod.resolveChainSource(input);
    assert.ok(Array.isArray(result.frameworks) && result.frameworks.length >= 1,
      'frameworks is a non-empty array for ' + JSON.stringify(input));
    for (const f of result.frameworks) {
      assert.strictEqual(typeof f, 'string', 'each framework element is a string');
      assert.ok(f.length > 0, 'each framework element is non-empty');
    }
    assert.ok(result.source === 'projection' || result.source === 'registry-floor',
      'source is one of the two legal literals for ' + JSON.stringify(input) + ', got ' + String(result.source));
  }
});

test('Arm 5 (fixture-injected empty projection): the floor fires on an EMPTY projection, not only on a seed with no edge', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.resolveChainSource({
    currentFramework: 'S-Curve Analysis',
    projection: { nodes: [], edges: [] },
    curatedChains: [],
  });
  assert.strictEqual(result.source, 'registry-floor', 'source flips to registry-floor on an explicitly empty projection');
  assert.ok(Array.isArray(result.frameworks) && result.frameworks.length >= 1, 'frameworks non-empty');
});

test('Arm 6: describeSource discloses the registry-floor source and names the seed in double quotes', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.resolveChainSource({ problemType: 'ill-defined' });
  const desc = mod.describeSource(result);
  assert.ok(desc.startsWith('Chain source: registry floor'), 'starts with the literal disclosure prefix');
  assert.ok(desc.indexOf('"' + result.seed + '"') >= 0, 'names the seed inside double quotes');
});

process.stdout.write('\ntest-254-degrade-floor.cjs: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
