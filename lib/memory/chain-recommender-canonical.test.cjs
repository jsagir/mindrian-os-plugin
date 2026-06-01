#!/usr/bin/env node
'use strict';

/**
 * Phase 130.7-02 Task 1 -- chain-recommender recommendCanonicalTargets tests.
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] and appended to
 * tests/run-all-130.7.sh. Run: node lib/memory/chain-recommender-canonical.test.cjs
 * Exit 0 on pass; throws (node:assert) on any fail.
 *
 * The contract Phase 136's LazyGraph slot consumes: recommendCanonicalTargets
 * returns EXACTLY ONE canonical {correlation_id, canonical_name, primary_label}
 * tuple per logical work -- no cross-label-duplicate fork. The no-fork pick
 * reads primary_label + edge_degree from the REAL Plan 01 correlation_labels
 * index (roomState.brainSections.correlation_labels, parsed by
 * lib/core/correlation-label-index.cjs), NOT an invented roomState.labelIndex.
 *
 * Six behaviors (per 130.7-02-PLAN.md Task 1 <behavior>):
 *   1. tuple shape -- every element is exactly {correlation_id, canonical_name,
 *      primary_label} (three string keys).
 *   2. no cross-label fork -- a name under two labels (HEART Framework :Framework
 *      deg 8 AND :Product deg 2) yields exactly ONE target, primary_label-preferred
 *      (Framework over Product), tie-break most-edged.
 *   3. correlation_id matches the chosen canonical -- equals
 *      computeCorrelationId(canonical_name, primary_label).
 *   4. back-compat -- recommendFrameworkChain stays byte-stable (re-run its suite).
 *   5. degrade (no index) -- absent correlation_labels: label-default 'Framework',
 *      seed-as-canonical single tuple; never throws, never null, never empty fork.
 *   6. no duplicate correlation_id -- no two elements share a correlation_id.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RECOMMENDER_PATH = path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs');

const recommender = require('../brain/chain-recommender.cjs');
const correlation = require('../core/correlation.cjs');
const labelIndex = require('../core/correlation-label-index.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// Build a REAL serialized correlation_labels index body via the Plan 01
// serializer (NOT a synthetic labelIndex field). It includes:
//   - a chain of FEEDS_INTO targets, each with a single Framework label,
//   - one cross-label-duplicate name ('Beautiful Question Framework') that
//     exists under :Framework (deg 8) AND :Product (deg 2), so the no-fork
//     pick must choose the Framework canonical.
function buildIndexBody() {
  return labelIndex.serializeLabelIndex([
    { canonical_name: 'Beautiful Question Framework', primary_label: 'Framework', edge_degree: 8 },
    { canonical_name: 'Beautiful Question Framework', primary_label: 'Product', edge_degree: 2 },
    { canonical_name: 'Domain Selection', primary_label: 'Framework', edge_degree: 5 },
    { canonical_name: 'Jobs to Be Done (JTBD)', primary_label: 'Framework', edge_degree: 7 },
  ]);
}

// A pre-parsed FEEDS_INTO edge array (the shape parseFrameworkChainSection
// returns) so the underlying framework-name walk produces a multi-element chain.
const FEEDS_EDGES = [
  { from: 'Beautiful Question Framework', to: 'Domain Selection', confidence: 0.9, phase_indicator: null },
  { from: 'Domain Selection', to: 'Jobs to Be Done (JTBD)', confidence: 0.85, phase_indicator: null },
];

function roomStateWithIndex() {
  return {
    feedsIntoEdges: FEEDS_EDGES,
    brainSections: { correlation_labels: buildIndexBody() },
  };
}

// ---------------------------------------------------------------------------
// 1. tuple shape
// ---------------------------------------------------------------------------
test('recommendCanonicalTargets -> array of {correlation_id, canonical_name, primary_label} tuples', function () {
  assert.strictEqual(typeof recommender.recommendCanonicalTargets, 'function', 'recommendCanonicalTargets is exported');
  const out = recommender.recommendCanonicalTargets({
    currentFramework: 'Beautiful Question Framework',
    roomState: roomStateWithIndex(),
  });
  assert.ok(Array.isArray(out), 'returns an array');
  assert.ok(out.length >= 1, 'non-empty');
  for (const el of out) {
    assert.ok(el && typeof el === 'object' && !Array.isArray(el), 'each element is a plain object');
    const keys = Object.keys(el).sort();
    assert.deepStrictEqual(keys, ['canonical_name', 'correlation_id', 'primary_label'], 'exactly three keys');
    assert.strictEqual(typeof el.correlation_id, 'string', 'correlation_id is a string');
    assert.strictEqual(typeof el.canonical_name, 'string', 'canonical_name is a string');
    assert.strictEqual(typeof el.primary_label, 'string', 'primary_label is a string');
    assert.ok(el.correlation_id.length > 0 && el.canonical_name.length > 0 && el.primary_label.length > 0, 'no empties');
  }
});

// ---------------------------------------------------------------------------
// 2. no cross-label fork -- THE contract
// ---------------------------------------------------------------------------
test('no cross-label fork: a name under two labels yields exactly ONE target, Framework-preferred', function () {
  const out = recommender.recommendCanonicalTargets({
    currentFramework: 'Beautiful Question Framework',
    roomState: roomStateWithIndex(),
  });
  const forName = out.filter(function (el) { return el.canonical_name === 'Beautiful Question Framework'; });
  assert.strictEqual(forName.length, 1, 'exactly one target for the cross-label-duplicate name (no fork)');
  assert.strictEqual(forName[0].primary_label, 'Framework', 'the methodology label (Framework) is preferred over Product');
});

// ---------------------------------------------------------------------------
// 3. correlation_id matches the chosen canonical
// ---------------------------------------------------------------------------
test('correlation_id equals computeCorrelationId(canonical_name, primary_label) for the chosen canonical', function () {
  const out = recommender.recommendCanonicalTargets({
    currentFramework: 'Beautiful Question Framework',
    roomState: roomStateWithIndex(),
  });
  for (const el of out) {
    const expected = correlation.computeCorrelationId(el.canonical_name, el.primary_label);
    assert.strictEqual(el.correlation_id, expected, 'correlation_id agrees with the chokepoint for ' + el.canonical_name);
  }
  // And specifically the cross-label-duplicate name resolves to the Framework id,
  // never the Product id.
  const heart = out.find(function (el) { return el.canonical_name === 'Beautiful Question Framework'; });
  assert.strictEqual(
    heart.correlation_id,
    correlation.computeCorrelationId('Beautiful Question Framework', 'Framework'),
    'chosen id is the Framework canonical, not the Product one'
  );
  assert.notStrictEqual(
    heart.correlation_id,
    correlation.computeCorrelationId('Beautiful Question Framework', 'Product'),
    'chosen id is NOT the Product canonical'
  );
});

// ---------------------------------------------------------------------------
// 4. back-compat -- recommendFrameworkChain byte-stable (the function still exists
//    and behaves; the full byte-stability suite runs as chain-recommender.test.cjs
//    in the aggregator -- here we re-assert the additive function did not perturb it)
// ---------------------------------------------------------------------------
test('back-compat: recommendFrameworkChain is intact and byte-stable for a known input', function () {
  assert.strictEqual(typeof recommender.recommendFrameworkChain, 'function', 'recommendFrameworkChain still exported');
  const chain = recommender.recommendFrameworkChain({
    currentFramework: 'Beautiful Question Framework',
    roomState: { feedsIntoEdges: FEEDS_EDGES },
  });
  assert.deepStrictEqual(chain, ['Beautiful Question Framework', 'Domain Selection', 'Jobs to Be Done (JTBD)'],
    'the FEEDS_INTO walk is unchanged by the additive canonical API');
});

// ---------------------------------------------------------------------------
// 5. degrade -- no index -> label-default 'Framework', seed-as-canonical, one tuple, no throw
// ---------------------------------------------------------------------------
test('degrade (no correlation_labels index): label-default Framework, single seed tuple, never empty fork', function () {
  // Tier-0-ish room: no brainSections.correlation_labels at all, no edges.
  const out = recommender.recommendCanonicalTargets({
    currentFramework: 'Some Unindexed Framework',
    roomState: {},
  });
  assert.ok(Array.isArray(out) && out.length === 1, 'exactly one target when there is no chain and no index');
  assert.strictEqual(out[0].canonical_name, 'Some Unindexed Framework', 'seed name is its own canonical');
  assert.strictEqual(out[0].primary_label, 'Framework', 'label defaults to Framework when the index is absent');
  assert.strictEqual(
    out[0].correlation_id,
    correlation.computeCorrelationId('Some Unindexed Framework', 'Framework'),
    'degraded id still agrees with the chokepoint'
  );

  // No roomState at all -> still one tuple, never throws, never null.
  const def = recommender.recommendCanonicalTargets();
  assert.ok(Array.isArray(def) && def.length >= 1, 'default call returns a non-empty array');
  assert.notStrictEqual(def, null);
  for (const el of def) {
    assert.strictEqual(el.primary_label, 'Framework', 'default label is Framework');
  }
});

// ---------------------------------------------------------------------------
// 6. no duplicate correlation_id
// ---------------------------------------------------------------------------
test('no two output elements share a correlation_id', function () {
  const out = recommender.recommendCanonicalTargets({
    currentFramework: 'Beautiful Question Framework',
    roomState: roomStateWithIndex(),
  });
  const ids = out.map(function (el) { return el.correlation_id; });
  const uniq = new Set(ids);
  assert.strictEqual(uniq.size, ids.length, 'all correlation_ids are distinct');
});

// ---------------------------------------------------------------------------
// 7. source hygiene: real index, no invented field, no command literal
// ---------------------------------------------------------------------------
test('source uses the real correlation_labels index (parseLabelIndex), not an invented roomState.labelIndex', function () {
  const src = fs.readFileSync(RECOMMENDER_PATH, 'utf8');
  assert.ok(/correlation_labels|parseLabelIndex/.test(src), 'reads the real index');
  assert.ok(!/labelIndex/.test(src), 'no invented roomState.labelIndex field');
  assert.ok(/correlation/.test(src), 'tags via lib/core/correlation.cjs');
  assert.ok(!/\/mos:/.test(src), 'no command literal');
});

process.stdout.write('\nchain-recommender-canonical.test.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
