#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 254 Plan 01 Task 1 -- WIRE-01 coverage for the projection-first blend
 * seam (lib/workflow/chain-source.cjs).
 *
 * WIRE-01: /mos:suggest-next produces a multi-step chain sourced from the
 * projection when the projection has edges for the seed. This suite proves
 * that live -- the two anchor seeds (S-Curve Analysis, Domain Selection) are
 * the 254-RESEARCH.md Section 1.3 live-verified numbers, re-confirmed against
 * the committed artifact 2026-09-02, not derived here.
 *
 * Arms:
 *   1. resolveChainSource({ currentFramework: 'S-Curve Analysis' }) resolves
 *      the projection's 1-hop successor with its earned confidence.
 *   2. resolveChainSource({ problemType: 'undefined' }) proves the blend is
 *      per-seed, not a global switch (a different seed, still projection).
 *   3. (R6 no-second-ranker proof) the returned frameworks array is the
 *      shipped local-chain-recommender ordering, element for element -- the
 *      seam never re-sorts.
 *   4. describeSource() on a projection result names the source and the
 *      composed confidence, trimmed (0.82, not 0.8200).
 *   5. (module purity) the module opens no wire of its own -- zero
 *      brain-client / fetch / http / child_process tokens.
 *   6. (no hardcoded census) no frozen numeric node-count comparison can
 *      creep in (Pitfall 8 -- a frozen 207 / 249 / 380 / 384 count).
 *
 * The require is guarded: before Task 2 lands, lib/workflow/chain-source.cjs
 * does not exist, so this suite is expected to FAIL with a legible "module
 * loads" arm rather than an uncaught MODULE_NOT_FOUND stack trace. That is
 * the honest RED baseline (Phases 272 / 273 / 274 convention).
 *
 * Run: node tests/test-254-projection-chain-source.cjs
 * Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'chain-source.cjs');

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

// strip full-line comments so a header that NAMES a forbidden token in prose
// cannot self-trip the sweep (the grep-gate-hygiene rule, mirrors
// tests/test-reader-r4-structural-184.cjs::codeOf).
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
}

test('module loads', function () {
  if (loadError) throw loadError;
  assert.ok(mod, 'lib/workflow/chain-source.cjs loaded');
  assert.strictEqual(typeof mod.resolveChainSource, 'function', 'resolveChainSource is exported');
  assert.strictEqual(typeof mod.describeSource, 'function', 'describeSource is exported');
  assert.strictEqual(typeof mod.MAX_HOPS, 'number', 'MAX_HOPS is exported');
});

test('Arm 1: projection-sourced chain for a seed with an outbound edge (S-Curve Analysis)', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.resolveChainSource({ currentFramework: 'S-Curve Analysis' });
  assert.strictEqual(result.source, 'projection', 'source is projection');
  assert.strictEqual(result.frameworks[0], 'S-Curve Analysis', 'frameworks[0] is the seed');
  assert.strictEqual(result.frameworks[1], 'Adoption-Capacity Theory', 'frameworks[1] is the projection successor');
  assert.ok(result.frameworks.length >= 2, 'frameworks carries at least 2 elements');
  assert.strictEqual(result.hops, 1, 'hops is 1');
  assert.ok(Math.abs(result.confidence - 0.82) < 1e-9, 'composed confidence is 0.82');
});

test('Arm 2: the blend is per-seed, not a global switch (Domain Selection via problemType)', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.resolveChainSource({ problemType: 'undefined' });
  assert.strictEqual(result.seed, 'Domain Selection', 'seed is Domain Selection');
  assert.strictEqual(result.source, 'projection', 'source is projection');
  assert.strictEqual(result.frameworks[1], 'Scenario Planning', 'frameworks[1] is Scenario Planning');
  assert.strictEqual(result.confidence, 0.68, 'composed confidence is 0.68');
});

test('Arm 3 (R6 no-second-ranker proof): frameworks matches local-chain-recommender ordering exactly', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const localChainRecommender = require('../lib/workflow/local-chain-recommender.cjs');
  const result = mod.resolveChainSource({ currentFramework: 'S-Curve Analysis' });
  const top = localChainRecommender.recommendMultiHopChains({ from: 'S-Curve Analysis', maxHops: 3 })[0];
  assert.ok(top, 'the shipped recommender still produces a top candidate for the anchor seed');
  assert.deepStrictEqual(result.frameworks, top.path, 'the seam takes the shipped ordering as given and never re-sorts');
});

test('Arm 4: describeSource discloses the source and the trimmed composed confidence', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const result = mod.resolveChainSource({ currentFramework: 'S-Curve Analysis' });
  const desc = mod.describeSource(result);
  assert.ok(desc.startsWith('Chain source: projection'), 'starts with the literal disclosure prefix');
  const rendered = String(Number(result.confidence.toFixed(4)));
  assert.ok(desc.indexOf(rendered) >= 0, 'contains the composed confidence rendered as "' + rendered + '" (0.82, not 0.8200)');
});

test('Arm 5 (module purity): the module opens no wire of its own', function () {
  const src = codeOf(MODULE_PATH);
  const forbidden = ['brain-client', 'fetch(', 'node:http', 'node:https', "require('http", 'child_process'];
  for (const token of forbidden) {
    assert.ok(src.indexOf(token) === -1, 'source carries zero occurrences of "' + token + '"');
  }
});

test('Arm 6 (no hardcoded census): no frozen numeric-count comparison beyond a zero-comparison', function () {
  const src = codeOf(MODULE_PATH);
  const re = /\.length\s*[=!<>]==?\s*(\d+)/g;
  const violations = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1] !== '0') violations.push(m[0]);
  }
  assert.deepStrictEqual(violations, [], 'no frozen node-count comparison beyond zero (Pitfall 8): ' + violations.join(', '));
});

process.stdout.write('\ntest-254-projection-chain-source.cjs: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
