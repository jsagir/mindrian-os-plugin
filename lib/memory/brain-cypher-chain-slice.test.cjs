#!/usr/bin/env node
'use strict';

/**
 * Phase 125-02 -- Brain Cypher chain slice (framework_chain_hint) tests.
 *
 * Run: node --test lib/memory/brain-cypher-chain-slice.test.cjs
 * Exit 0 on pass. Uses node:test + node:assert/strict.
 *
 * Coverage maps 1:1 to 125-02-PLAN.md Task 1 <behavior> Tests 1-10:
 *   1. Happy-path: 3 rows -> 3 edges, slice_scope=2, snapshot_id non-null.
 *   2. LIMIT 50 verbatim in the Cypher template constant.
 *   3. Sanitization called on each framework name; bound value is sanitized.
 *   4. max_hops bound to 1..3 enum (0 and 4 degrade; 1, 2, 3 valid).
 *   5. Empty active_frameworks short-circuits (no Brain call).
 *   6. Brain unreachable (isAvailable=false) degrades.
 *   7. Brain throws degrades (slice_rationale carries brain_query_failed).
 *   8. Result mapping: 5 fields propagate verbatim.
 *   9. Null tolerance (G-05): null confidence + null transform_description preserved.
 *  10. brain_snapshot_id is sha256 hash of the JSON-stringified raw rows.
 *
 * Plus Canon Part 8 grep audit: the Cypher template contains zero user-content
 * tokens (no roomDir, no artifact, no body, no transcript token).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const {
  fetchFrameworkChainSlice,
  FRAMEWORK_CHAIN_SLICE_CYPHER,
  _test,
} = require('/home/jsagi/MindrianOS-Plugin/lib/brain/framework-chain-slice.cjs');

// Build a mock brainClient with stubbed isAvailable + query + _test seam.
// sanitizationCalls records every arg passed to sanitizeCypherInput so the
// test can assert call counts + bound-value equivalence.
function makeMockClient(opts) {
  const o = opts || {};
  const sanitizationCalls = [];
  const queryInvocations = [];
  const sanitizer = function (v) {
    sanitizationCalls.push(v);
    // Match the shipped whitelist exactly: [a-zA-Z0-9 ._-]
    return String(v == null ? '' : v).replace(/[^a-zA-Z0-9 ._-]/g, '');
  };
  const isAvailable = (typeof o.available === 'boolean') ? o.available : true;
  const queryFn = (typeof o.queryFn === 'function')
    ? o.queryFn
    : (async function () { return []; });
  return {
    isAvailable: function () { return isAvailable; },
    query: async function (cypher, params) {
      queryInvocations.push({ cypher: cypher, params: params });
      return queryFn(cypher, params);
    },
    _test: {
      sanitizeCypherInput: sanitizer,
    },
    // Exposed on the mock for the test to inspect (not on real brain-client).
    _sanitizationCalls: sanitizationCalls,
    _queryInvocations: queryInvocations,
  };
}

// ---------------------------------------------------------------- Test 2 (FIRST,
// pure-constant check; runs without any async).

test('Test 2: Cypher template constant contains LIMIT 50 verbatim', function () {
  assert.ok(
    typeof FRAMEWORK_CHAIN_SLICE_CYPHER === 'string'
      && FRAMEWORK_CHAIN_SLICE_CYPHER.length > 0,
    'FRAMEWORK_CHAIN_SLICE_CYPHER must be a non-empty string'
  );
  assert.ok(
    FRAMEWORK_CHAIN_SLICE_CYPHER.includes('LIMIT 50'),
    'FRAMEWORK_CHAIN_SLICE_CYPHER must contain literal "LIMIT 50"'
  );
  // Bonus: the parameterized hop range marker.
  assert.ok(
    FRAMEWORK_CHAIN_SLICE_CYPHER.includes('FEEDS_INTO*1..$max_hops'),
    'Cypher must include parameterized hop range "FEEDS_INTO*1..$max_hops"'
  );
  // Canon Part 8 grep: no user-content tokens in the template.
  const forbidden = ['roomDir', 'artifact', 'body', 'transcript', 'roomSlug'];
  for (const tok of forbidden) {
    assert.ok(
      !FRAMEWORK_CHAIN_SLICE_CYPHER.includes(tok),
      'Cypher must not contain user-content token "' + tok + '"'
    );
  }
  // Read-only: no write keywords in the Cypher template.
  const writeKeywords = ['MERGE', 'CREATE', 'DELETE', 'SET ', 'REMOVE'];
  for (const kw of writeKeywords) {
    assert.ok(
      !FRAMEWORK_CHAIN_SLICE_CYPHER.includes(kw),
      'Cypher must be read-only (no "' + kw + '")'
    );
  }
});

// ---------------------------------------------------------------- Test 1

test('Test 1: happy-path returns 3 mapped edges + slice_scope=2 + non-null snapshot_id', async function () {
  const rows = [
    { from: 'A', to: 'B', confidence: 0.9, transform_description: 'a->b', hop_distance: 1 },
    { from: 'A', to: 'C', confidence: 0.7, transform_description: 'a->c', hop_distance: 2 },
    { from: 'B', to: 'D', confidence: 0.8, transform_description: 'b->d', hop_distance: 2 },
  ];
  const mock = makeMockClient({ queryFn: async function () { return rows; } });
  const result = await fetchFrameworkChainSlice({
    active_frameworks: ['Beautiful Question Framework'],
    max_hops: 2,
    brainClient: mock,
  });
  assert.equal(Array.isArray(result.edges), true);
  assert.equal(result.edges.length, 3);
  assert.equal(result.slice_scope, 2);
  assert.equal(typeof result.brain_snapshot_id, 'string');
  assert.equal(result.brain_snapshot_id.length, 64); // sha256 hex
  assert.ok(result.slice_rationale.includes('brain_reachable'));
  assert.equal(typeof result.fetched_at, 'string');
  // ISO 8601 sanity check.
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(result.fetched_at));
});

// ---------------------------------------------------------------- Test 3

test('Test 3: sanitization called for every framework name; bound value is sanitized', async function () {
  const mock = makeMockClient({ queryFn: async function () { return []; } });
  const dangerous = "SWOT; DROP TABLE x";
  await fetchFrameworkChainSlice({
    active_frameworks: [dangerous, 'Beautiful Question Framework'],
    max_hops: 1,
    brainClient: mock,
  });
  // Sanitizer was called on each name.
  assert.equal(mock._sanitizationCalls.length, 2);
  assert.equal(mock._sanitizationCalls[0], dangerous);
  // The bound active_frameworks param contains the SANITIZED string (no `;`).
  assert.equal(mock._queryInvocations.length, 1);
  const bound = mock._queryInvocations[0].params.active_frameworks;
  assert.ok(Array.isArray(bound));
  assert.ok(!bound[0].includes(';'), 'sanitized value must not contain ";"');
  // The whitelist is [a-zA-Z0-9 ._-] -- letters survive, only the metacharacter
  // `;` is stripped. The injection vector dies because the bound value is the
  // sanitizer output (a plain identifier string), not raw user input.
  assert.equal(bound[0], 'SWOT DROP TABLE x'); // ';' stripped, kept word chars
  // The second framework name (clean) passes through unchanged.
  assert.equal(bound[1], 'Beautiful Question Framework');
});

// ---------------------------------------------------------------- Test 4

test('Test 4: max_hops bound to 1..3 enum; 0 and 4 degrade; 1, 2, 3 valid', async function () {
  const mock = makeMockClient({ queryFn: async function () { return []; } });
  // max_hops = 0 -> degraded, no Brain call.
  let r = await fetchFrameworkChainSlice({
    active_frameworks: ['X'], max_hops: 0, brainClient: mock,
  });
  assert.equal(r.edges.length, 0);
  assert.ok(r.slice_rationale.includes('invalid_max_hops'));
  // max_hops = 4 -> degraded.
  r = await fetchFrameworkChainSlice({
    active_frameworks: ['X'], max_hops: 4, brainClient: mock,
  });
  assert.ok(r.slice_rationale.includes('invalid_max_hops'));
  // No Brain call should have been made for the two invalid hop counts.
  assert.equal(mock._queryInvocations.length, 0);
  // max_hops = 1, 2, 3 -> valid (Brain query issued).
  for (const hops of [1, 2, 3]) {
    const m2 = makeMockClient({ queryFn: async function () { return []; } });
    const ok = await fetchFrameworkChainSlice({
      active_frameworks: ['X'], max_hops: hops, brainClient: m2,
    });
    assert.equal(ok.slice_scope, hops);
    assert.equal(m2._queryInvocations.length, 1);
    assert.equal(m2._queryInvocations[0].params.max_hops, hops);
  }
});

// ---------------------------------------------------------------- Test 5

test('Test 5: empty active_frameworks short-circuits without Brain call', async function () {
  const mock = makeMockClient({ queryFn: async function () { return []; } });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: [], max_hops: 2, brainClient: mock,
  });
  assert.equal(r.edges.length, 0);
  assert.equal(r.slice_scope, 2);
  assert.ok(r.slice_rationale.includes('empty active_frameworks'));
  assert.equal(r.brain_snapshot_id, null);
  // Brain query NOT called.
  assert.equal(mock._queryInvocations.length, 0);
  assert.equal(mock._sanitizationCalls.length, 0);
});

// ---------------------------------------------------------------- Test 6

test('Test 6: Brain unreachable (isAvailable=false) degrades; no query call', async function () {
  const mock = makeMockClient({ available: false });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['Beautiful Question Framework'],
    max_hops: 3,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 0);
  assert.equal(r.slice_scope, 3);
  assert.equal(r.slice_rationale, 'brain_unreachable');
  assert.equal(r.brain_snapshot_id, null);
  assert.equal(typeof r.fetched_at, 'string');
  assert.equal(mock._queryInvocations.length, 0);
});

// ---------------------------------------------------------------- Test 7

test('Test 7: Brain query throws -> degraded; no exception propagates', async function () {
  const mock = makeMockClient({
    queryFn: async function () { throw new Error('connection refused'); },
  });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['X'],
    max_hops: 2,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 0);
  assert.equal(r.slice_scope, 2);
  assert.ok(
    r.slice_rationale.includes('brain_query_failed'),
    'rationale must include brain_query_failed; got: ' + r.slice_rationale
  );
  assert.ok(r.slice_rationale.includes('connection refused'));
  assert.equal(r.brain_snapshot_id, null);
});

// ---------------------------------------------------------------- Test 8

test('Test 8: result mapping preserves all 5 fields verbatim', async function () {
  const row = {
    from: 'SWOT',
    to: 'Porter Five Forces',
    confidence: 0.85,
    transform_description: 'analysis -> strategy',
    hop_distance: 1,
  };
  const mock = makeMockClient({ queryFn: async function () { return [row]; } });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['SWOT'],
    max_hops: 1,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 1);
  const e = r.edges[0];
  assert.equal(e.from, 'SWOT');
  assert.equal(e.to, 'Porter Five Forces');
  assert.equal(e.confidence, 0.85);
  assert.equal(e.transform_description, 'analysis -> strategy');
  assert.equal(e.hop_distance, 1);
});

// ---------------------------------------------------------------- Test 9 (G-05)

test('Test 9: null confidence + null transform_description preserved (not defaulted)', async function () {
  const row = {
    from: 'A',
    to: 'B',
    confidence: null,
    transform_description: null,
    hop_distance: 2,
  };
  const mock = makeMockClient({ queryFn: async function () { return [row]; } });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['A'],
    max_hops: 2,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 1);
  const e = r.edges[0];
  assert.equal(e.from, 'A');
  assert.equal(e.to, 'B');
  // Explicit null preservation per CONTEXT.md G-05 + Plan 04 schema.
  assert.equal(e.confidence, null);
  assert.equal(e.transform_description, null);
  // hop_distance still propagates.
  assert.equal(e.hop_distance, 2);
});

// ---------------------------------------------------------------- Test 10

test('Test 10: brain_snapshot_id is sha256 of JSON.stringify(raw rows)', async function () {
  const rows = [
    { from: 'A', to: 'B', confidence: 0.5, transform_description: 't', hop_distance: 1 },
  ];
  const mock = makeMockClient({ queryFn: async function () { return rows; } });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['A'],
    max_hops: 1,
    brainClient: mock,
  });
  // Expected hash: sha256 of JSON.stringify(rows) exactly as the implementation
  // computes it (it is the raw rows after Cypher, before edge-shape mapping).
  const expected = crypto.createHash('sha256')
    .update(JSON.stringify(rows), 'utf8')
    .digest('hex');
  assert.equal(r.brain_snapshot_id, expected);
});

// ---------------------------------------------------------------- Bonus: shape-tolerant
// (the live brain-client returns { records: [] }; this verifies both shapes work).

test('Bonus: { records: [...] } wrapper from brain-client.query is unwrapped', async function () {
  const rows = [
    { from: 'X', to: 'Y', confidence: 0.6, transform_description: 'x->y', hop_distance: 1 },
  ];
  const mock = makeMockClient({
    queryFn: async function () { return { records: rows }; },
  });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['X'],
    max_hops: 1,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 1);
  assert.equal(r.edges[0].from, 'X');
});

// ---------------------------------------------------------------- Bonus: non-array
// Brain return (e.g. an error payload like { error: 'foo' }) degrades cleanly.

test('Bonus: non-array Brain return degrades cleanly', async function () {
  const mock = makeMockClient({
    queryFn: async function () { return { error: 'whatever' }; },
  });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['X'],
    max_hops: 1,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 0);
  assert.ok(r.slice_rationale.includes('brain_returned_non_array'));
});

// ---------------------------------------------------------------- Canon Part 8:
// re-read the module source and grep it for forbidden tokens (defence in depth).

test('Canon Part 8: module source contains zero user-content tokens', function () {
  const src = fs.readFileSync(
    '/home/jsagi/MindrianOS-Plugin/lib/brain/framework-chain-slice.cjs',
    'utf8'
  );
  // The Cypher constant has been validated above. Here we audit that the
  // module never builds the query with user-content fields. The only tokens
  // forbidden in the Cypher *template* + *param-binding* are listed below.
  // We scan only the Cypher constant + the param object site.
  const cypherIdx = src.indexOf('FRAMEWORK_CHAIN_SLICE_CYPHER =');
  assert.ok(cypherIdx > 0);
  const cypherBlock = src.slice(cypherIdx, src.indexOf('}', cypherIdx + 200));
  // Cypher must not embed any user-content token literally.
  const forbidden = ['roomDir', 'roomSlug', 'transcript', 'artifact_body'];
  for (const tok of forbidden) {
    assert.ok(
      !cypherBlock.includes(tok),
      'Cypher block must not embed user-content token "' + tok + '"'
    );
  }
});
