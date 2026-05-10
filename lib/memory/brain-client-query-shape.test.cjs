#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Regression test for brainClient.query (graph-on-graph P0 cont., 2026-05-11).
 * =============================================================================
 * Proves two contracts that the rest of the codebase depends on:
 *
 *  1. PARAMS FORWARDING (introduced in b43aff9, kept here):
 *     - query(cypher, { x: 1 })  ->  brain_query arguments are { cypher, params: { x: 1 } }
 *     - query(cypher)            ->  brain_query arguments are { cypher } (NO params key)
 *     - query(cypher, {})        ->  brain_query arguments are { cypher } (empty object is NOT forwarded)
 *
 *  2. RESULT-SHAPE NORMALIZATION (this fix):
 *     The Brain MCP brain_query tool serializes a BARE ARRAY of rows. callTool
 *     returns that array directly. Every consumer reads result.records, so query
 *     now wraps it: a successful brain_query ALWAYS resolves to { records: [...] }.
 *
 * Self-contained: no live Brain, no live Aura. We set MINDRIAN_BRAIN_KEY BEFORE
 * requiring brain-client.cjs, then monkey-patch global.fetch to a stub that
 * fakes the `initialize` handshake and the `tools/call` brain_query response
 * (SSE `data: {...}` line, the same wire shape callTool parses). global.fetch
 * is restored in a finally.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert).
 */

const assert = require('node:assert/strict');

// MUST be set before requiring brain-client.cjs -- getApiKey() reads it.
process.env.MINDRIAN_BRAIN_KEY = 'test-key-260511-2ik';

const brain = require('../core/brain-client.cjs');

let passed = 0;
let failed = 0;
const failures = [];

// Module-local capture of the brain_query arguments seen by the fetch stub.
let lastArgs = null;

// Build an SSE-style response body the way the Brain Streamable HTTP transport
// returns it: a single `data: {...json...}\n` line. callTool splits on \n and
// finds the line that startsWith('data: ').
function sseBody(jsonRpcResult) {
  return 'data: ' + JSON.stringify(jsonRpcResult) + '\n';
}

// The fake row payload the brain_query tool would serialize (a BARE ARRAY).
const FAKE_ROWS = [{ name: 'X', id: 'x1' }];

function makeFetchStub() {
  return async function fetchStub(url, init) {
    const body = JSON.parse(init.body);
    if (body.method === 'initialize') {
      // _ensureSession only checks initRes.ok / initRes.status.
      return {
        ok: true,
        status: 200,
        text: async () => sseBody({
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            serverInfo: { name: 'brain', version: '1' },
          },
        }),
      };
    }
    if (body.method === 'tools/call' && body.params && body.params.name === 'brain_query') {
      // Capture the arguments object so the test can assert params forwarding.
      lastArgs = body.params.arguments;
      return {
        ok: true,
        status: 200,
        text: async () => sseBody({
          jsonrpc: '2.0',
          id: 2,
          result: {
            content: [{ type: 'text', text: JSON.stringify(FAKE_ROWS) }],
          },
        }),
      };
    }
    // Any other call (defensive) -> not-ok so the client returns null.
    return { ok: false, status: 500, text: async () => '' };
  };
}

async function runAssertions() {
  // (1) params forwarded as { cypher, params } when params is a non-empty object.
  lastArgs = null;
  const r1 = await brain.query('MATCH (f) RETURN f', { x: 1 });
  assert.deepStrictEqual(
    lastArgs,
    { cypher: 'MATCH (f) RETURN f', params: { x: 1 } },
    'non-empty params must be forwarded as { cypher, params }'
  );
  assert.deepStrictEqual(
    r1,
    { records: [{ name: 'X', id: 'x1' }] },
    'successful brain_query result must be normalized to { records: [...] }'
  );

  // (2) no params arg -> only { cypher } is sent (no params key at all).
  lastArgs = null;
  const r2 = await brain.query('MATCH (f) RETURN f');
  assert.deepStrictEqual(
    lastArgs,
    { cypher: 'MATCH (f) RETURN f' },
    'a param-less call must send only { cypher }, no params key'
  );
  assert.deepStrictEqual(
    r2,
    { records: [{ name: 'X', id: 'x1' }] },
    'param-less call result must also be normalized to { records: [...] }'
  );

  // (3) empty object params -> NOT forwarded (no params key).
  lastArgs = null;
  const r3 = await brain.query('MATCH (f) RETURN f', {});
  assert.deepStrictEqual(
    lastArgs,
    { cypher: 'MATCH (f) RETURN f' },
    'an empty params object must NOT be forwarded'
  );
  assert.deepStrictEqual(
    r3,
    { records: [{ name: 'X', id: 'x1' }] },
    'empty-params call result must also be normalized to { records: [...] }'
  );
}

(async function main() {
  const realFetch = global.fetch;
  global.fetch = makeFetchStub();
  // Clear any cached Brain session so our init stub is exercised cleanly.
  try { brain._test.sessionCache.clear(); } catch (_e) { /* ignore */ }
  try {
    await runAssertions();
    passed = 3;
  } catch (err) {
    failed = 1;
    failures.push(err && err.message ? err.message : String(err));
  } finally {
    global.fetch = realFetch;
    try { brain._test.sessionCache.clear(); } catch (_e) { /* ignore */ }
  }

  if (failed > 0) {
    process.stderr.write('brain-client-query-shape: FAIL\n');
    for (const f of failures) process.stderr.write('  - ' + f + '\n');
    process.exit(1);
  }
  process.stdout.write('brain-client-query-shape: all assertions passed (params forwarding x3 + return normalization x3)\n');
  process.exit(0);
})();
