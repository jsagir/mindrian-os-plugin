#!/usr/bin/env node
'use strict';

/**
 * Phase 125-02 -- Brain framework-chain slice (framework_chain_hint) tests.
 *
 * BUG 2 fix update (2026-05-22): the implementation was repointed from the
 * admin-gated brain_query / raw-Cypher path onto brain.askOp('framework_chain_slice',
 * { seeds, max_hops }) per .planning/brain-curated-ops-contract.md.
 *
 * Tests updated to mock askOp() instead of query(). Cypher-constant-content
 * assertions (LIMIT 50 verbatim, FEEDS_INTO*1..$max_hops) are no longer
 * applicable since the Cypher is now frozen server-side. The constant is
 * deprecated (empty string); Test 2 now asserts it is exported but empty.
 *
 * Run: node --test lib/memory/brain-cypher-chain-slice.test.cjs
 * Exit 0 on pass. Uses node:test + node:assert/strict.
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

// Build a mock brainClient with stubbed isAvailable + askOp + _test seam.
// sanitizationCalls records every arg passed to sanitizeCypherInput so the
// test can assert call counts + bound-value equivalence.
// askOpInvocations records every call to askOp for inspection.
function makeMockClient(opts) {
  const o = opts || {};
  const sanitizationCalls = [];
  const askOpInvocations = [];
  const sanitizer = function (v) {
    sanitizationCalls.push(v);
    // Match the shipped whitelist exactly: [a-zA-Z0-9 ._-]
    return String(v == null ? '' : v).replace(/[^a-zA-Z0-9 ._-]/g, '');
  };
  const isAvailable = (typeof o.available === 'boolean') ? o.available : true;
  const askOpFn = (typeof o.askOpFn === 'function')
    ? o.askOpFn
    : (async function () { return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 0, rows: [] }; });
  return {
    isAvailable: function () { return isAvailable; },
    askOp: async function (operation, params) {
      askOpInvocations.push({ operation: operation, params: params });
      return askOpFn(operation, params);
    },
    _test: {
      sanitizeCypherInput: sanitizer,
    },
    // Exposed on the mock for the test to inspect.
    _sanitizationCalls: sanitizationCalls,
    _askOpInvocations: askOpInvocations,
  };
}

// ---------------------------------------------------------------- Test 2
// FRAMEWORK_CHAIN_SLICE_CYPHER is now deprecated (empty string). Verify it
// is still exported (for backward compat) but acknowledges the change.

test('Test 2: FRAMEWORK_CHAIN_SLICE_CYPHER is exported (deprecated empty string)', function () {
  assert.ok(
    typeof FRAMEWORK_CHAIN_SLICE_CYPHER === 'string',
    'FRAMEWORK_CHAIN_SLICE_CYPHER must still be exported as a string'
  );
  // Post-repoint: the Cypher is frozen server-side; the exported constant
  // is intentionally empty to signal deprecation.
  assert.equal(
    FRAMEWORK_CHAIN_SLICE_CYPHER,
    '',
    'FRAMEWORK_CHAIN_SLICE_CYPHER must be empty after curated-op repoint'
  );
});

// ---------------------------------------------------------------- Test 1

test('Test 1: happy-path returns 3 mapped edges + slice_scope=2 + non-null snapshot_id', async function () {
  const rows = [
    { from: 'A', to: 'B', hop_distance: 1 },
    { from: 'A', to: 'C', hop_distance: 2 },
    { from: 'B', to: 'D', hop_distance: 2 },
  ];
  const mock = makeMockClient({
    askOpFn: async function () {
      return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 3, rows: rows };
    },
  });
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
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(result.fetched_at));
  // confidence_omitted flag must be set
  assert.equal(result.confidence_omitted, true);
});

// ---------------------------------------------------------------- Test 3
// Sanitization is still called on seed names (client-side defence-in-depth).

test('Test 3: sanitization called for every framework name; bound value is sanitized', async function () {
  const mock = makeMockClient({
    askOpFn: async function () {
      return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 0, rows: [] };
    },
  });
  const dangerous = "SWOT; DROP TABLE x";
  await fetchFrameworkChainSlice({
    active_frameworks: [dangerous, 'Beautiful Question Framework'],
    max_hops: 1,
    brainClient: mock,
  });
  // Sanitizer was called on each name.
  assert.equal(mock._sanitizationCalls.length, 2);
  assert.equal(mock._sanitizationCalls[0], dangerous);
  // askOp was called with the sanitized seeds array.
  assert.equal(mock._askOpInvocations.length, 1);
  const bound = mock._askOpInvocations[0].params.seeds;
  assert.ok(Array.isArray(bound));
  assert.ok(!bound[0].includes(';'), 'sanitized value must not contain ";"');
  assert.equal(bound[0], 'SWOT DROP TABLE x'); // ';' stripped
  assert.equal(bound[1], 'Beautiful Question Framework');
});

// ---------------------------------------------------------------- Test 4

test('Test 4: max_hops bound to 1..3 enum; 0 and 4 degrade; 1, 2, 3 valid', async function () {
  const mock = makeMockClient({
    askOpFn: async function () {
      return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 0, rows: [] };
    },
  });
  // max_hops = 0 -> degraded, no askOp call.
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
  // No askOp call for the two invalid hop counts.
  assert.equal(mock._askOpInvocations.length, 0);
  // max_hops = 1, 2, 3 -> valid (askOp called).
  for (const hops of [1, 2, 3]) {
    const m2 = makeMockClient({
      askOpFn: async function () {
        return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 0, rows: [] };
      },
    });
    const ok = await fetchFrameworkChainSlice({
      active_frameworks: ['X'], max_hops: hops, brainClient: m2,
    });
    assert.equal(ok.slice_scope, hops);
    assert.equal(m2._askOpInvocations.length, 1);
    assert.equal(m2._askOpInvocations[0].params.max_hops, hops);
  }
});

// ---------------------------------------------------------------- Test 5

test('Test 5: empty active_frameworks short-circuits without askOp call', async function () {
  const mock = makeMockClient();
  const r = await fetchFrameworkChainSlice({
    active_frameworks: [], max_hops: 2, brainClient: mock,
  });
  assert.equal(r.edges.length, 0);
  assert.equal(r.slice_scope, 2);
  assert.ok(r.slice_rationale.includes('empty active_frameworks'));
  assert.equal(r.brain_snapshot_id, null);
  // askOp NOT called.
  assert.equal(mock._askOpInvocations.length, 0);
  assert.equal(mock._sanitizationCalls.length, 0);
});

// ---------------------------------------------------------------- Test 6

test('Test 6: Brain unreachable (isAvailable=false) degrades; no askOp call', async function () {
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
  assert.equal(mock._askOpInvocations.length, 0);
});

// ---------------------------------------------------------------- Test 7

test('Test 7: askOp throws -> degraded; no exception propagates', async function () {
  const mock = makeMockClient({
    askOpFn: async function () { throw new Error('connection refused'); },
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
// After the repoint, edges have from/to/hop_distance; confidence and
// transform_description are always null (not in the curated op).

test('Test 8: result mapping: from/to/hop_distance propagate; confidence/transform null', async function () {
  const row = {
    from: 'SWOT',
    to: 'Porter Five Forces',
    hop_distance: 1,
  };
  const mock = makeMockClient({
    askOpFn: async function () {
      return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 1, rows: [row] };
    },
  });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['SWOT'],
    max_hops: 1,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 1);
  const e = r.edges[0];
  assert.equal(e.from, 'SWOT');
  assert.equal(e.to, 'Porter Five Forces');
  assert.equal(e.hop_distance, 1);
  // Curated op does not return confidence or transform_description.
  assert.equal(e.confidence, null);
  assert.equal(e.transform_description, null);
  assert.equal(r.confidence_omitted, true);
});

// ---------------------------------------------------------------- Test 9 (G-05)

test('Test 9: null hop_distance preserved; from/to strings preserved', async function () {
  const row = {
    from: 'A',
    to: 'B',
    hop_distance: null,
  };
  const mock = makeMockClient({
    askOpFn: async function () {
      return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 1, rows: [row] };
    },
  });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['A'],
    max_hops: 2,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 1);
  const e = r.edges[0];
  assert.equal(e.from, 'A');
  assert.equal(e.to, 'B');
  assert.equal(e.hop_distance, null);
});

// ---------------------------------------------------------------- Test 10

test('Test 10: brain_snapshot_id is sha256 of JSON.stringify(raw rows)', async function () {
  const rows = [
    { from: 'A', to: 'B', hop_distance: 1 },
  ];
  const mock = makeMockClient({
    askOpFn: async function () {
      return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 1, rows: rows };
    },
  });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['A'],
    max_hops: 1,
    brainClient: mock,
  });
  const expected = crypto.createHash('sha256')
    .update(JSON.stringify(rows), 'utf8')
    .digest('hex');
  assert.equal(r.brain_snapshot_id, expected);
});

// ---------------------------------------------------------------- Test: degraded envelope from server

test('Degraded envelope from server: edges=[], snapshot null', async function () {
  const mock = makeMockClient({
    askOpFn: async function () {
      return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 0, rows: [], degraded: true };
    },
  });
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['X'],
    max_hops: 2,
    brainClient: mock,
  });
  assert.equal(r.edges.length, 0);
  assert.ok(r.slice_rationale.includes('brain_returned_degraded'));
  assert.equal(r.brain_snapshot_id, null);
});

// ---------------------------------------------------------------- Test: askOp absent on client degrades

test('askOp absent on brainClient: degrades without throwing', async function () {
  // A minimal client without askOp (simulates old brain-client before update).
  const minimalClient = {
    isAvailable: function () { return true; },
    _test: { sanitizeCypherInput: function (s) { return s; } },
  };
  const r = await fetchFrameworkChainSlice({
    active_frameworks: ['X'],
    max_hops: 2,
    brainClient: minimalClient,
  });
  assert.equal(r.edges.length, 0);
  assert.ok(r.slice_rationale.includes('askOp_not_available'));
});

// ---------------------------------------------------------------- Canon Part 8:
// Verify no raw Cypher with user-content tokens is emitted.

test('Canon Part 8: askOp receives only seeds (generic framework names) + max_hops', async function () {
  const mock = makeMockClient({
    askOpFn: async function () {
      return { op: 'framework_chain_slice', source: 'neo4j_curated', count: 0, rows: [] };
    },
  });
  await fetchFrameworkChainSlice({
    active_frameworks: ['SWOT', 'Porter Five Forces'],
    max_hops: 2,
    brainClient: mock,
  });
  assert.equal(mock._askOpInvocations.length, 1);
  const inv = mock._askOpInvocations[0];
  assert.equal(inv.operation, 'framework_chain_slice');
  // Only seeds + max_hops should be in params.
  assert.ok(Array.isArray(inv.params.seeds));
  assert.equal(inv.params.max_hops, 2);
  // No user-content tokens in params.
  const paramStr = JSON.stringify(inv.params);
  const forbidden = ['roomDir', 'roomSlug', 'transcript', 'artifact_body'];
  for (const tok of forbidden) {
    assert.ok(!paramStr.includes(tok), 'params must not contain user-content token "' + tok + '"');
  }
});
