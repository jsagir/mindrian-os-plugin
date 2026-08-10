#!/usr/bin/env node
'use strict';

/**
 * Phase 247-02 (CONTRACT-01, 403-vs-null fix) -- hermetic client suite.
 * ==========================================================================
 * Proves two things about lib/core/brain-client.cjs:
 *
 *   1. callTool distinguishes a tier denial (HTTP 403 + MoatViolation body)
 *      from an outage (network failure / timeout). 403 now returns a typed
 *      { error: 'tier_denied', tool, message } sentinel -- NEVER null.
 *      null is reserved for genuine transport failure. 401 (invalid_key)
 *      is unchanged. Every other public wrapper that calls callTool either
 *      passes the sentinel through unchanged or handles it explicitly
 *      (audited below, one assertion per wrapper).
 *   2. The five loop-contract read wrappers (normalizeFrameworkName,
 *      loopSearch, discoverStructure, orchestrationReadiness,
 *      feedsIntoChains) emit exactly the contracted tool name and arg keys.
 *
 * Mock transport: a real loopback HTTP server (mirrors the SSE-shaped
 * capture-server pattern already established by tests/helpers/
 * brain-capture-server.cjs and tests/test-brain-client-params.cjs), with a
 * mutable `state` object controlling per-request behavior so each test can
 * pick the response shape it needs (200 / 403-json / 403-raw / 401) without
 * standing up a new server per case. Network-failure (Test 4) uses a second,
 * deliberately-closed server so the request gets a real ECONNREFUSED --
 * no fetch mock, no monkeypatching.
 *
 * BRAIN_URL is captured at module-load time in brain-client.cjs, so every
 * test that needs a different server (or key) does
 * `delete require.cache[...]` then re-requires -- the same pattern
 * test-brain-client-params.cjs already uses.
 *
 * RED PROOF (recorded in 247-02-SUMMARY.md, not a permanent code path):
 * with the 403-sentinel branch in callTool temporarily sabotaged to
 * `return null;`, Test 1 (and every other 403-sentinel test) goes red.
 * Restored before commit; the sabotage never lands in this file or in
 * brain-client.cjs.
 *
 * node --test, CJS, node:assert/strict + node:http only. No new deps.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test, before, after, beforeEach } = require('node:test');

const BRAIN_CLIENT_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'brain-client.cjs');

// ---------------------------------------------------------------------------
// Mock server: SSE-shaped for `initialize` / `tools/call` success, plain
// JSON for the 403/401 failure shapes (matches the real Brain's
// `res.status(403).json({...})` -- confirmed against
// ProblemsWorthSolving-Brain src/http/auth.mjs tierGate, not guessed).
// ---------------------------------------------------------------------------
const state = {
  initMode: 'ok', // 'ok' | '401'
  toolMode: 'ok', // 'ok' | '403-json' | '403-raw' | '500'
  toolResultPayload: { ok: true },
  lastToolCall: null, // { name, arguments }
};

function startMockServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad_json' }));
        return;
      }

      if (parsed.method === 'initialize') {
        if (state.initMode === '401') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid key' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(
          'data: ' +
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: { protocolVersion: '2024-11-05', capabilities: {} },
            }) +
            '\n'
        );
        return;
      }

      if (parsed.method === 'tools/call') {
        state.lastToolCall = {
          name: parsed.params && parsed.params.name,
          arguments: (parsed.params && parsed.params.arguments) || {},
        };

        if (state.toolMode === '403-json') {
          // Verbatim shape from ProblemsWorthSolving-Brain src/http/auth.mjs
          // tierGate (both the WRITE_TOOLS branch and the read-allowlist
          // branch use this exact { error: { code, name, message } } shape).
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: {
                code: -32003,
                name: 'MoatViolation',
                message:
                  'MoatViolation: tool "' + state.lastToolCall.name + '" is not on the read allowlist',
              },
            })
          );
          return;
        }

        if (state.toolMode === '403-raw') {
          // An unparseable body (e.g. an upstream proxy's HTML error page) --
          // the sentinel must still be typed, with the raw text as message.
          res.writeHead(403, { 'Content-Type': 'text/html' });
          res.end('<html><body>403 Forbidden (upstream proxy, not Brain JSON)</body></html>');
          return;
        }

        if (state.toolMode === '500') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'internal_error' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(
          'data: ' +
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(state.toolResultPayload) }],
              },
            }) +
            '\n'
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown_method' }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, url: 'http://127.0.0.1:' + port });
    });
  });
}

function freshBrainClient(url) {
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';
  delete require.cache[BRAIN_CLIENT_PATH];
  return require(BRAIN_CLIENT_PATH);
}

let mockServer;
let mockUrl;

before(async () => {
  const started = await startMockServer();
  mockServer = started.server;
  mockUrl = started.url;
});

after(async () => {
  await new Promise((resolve) => mockServer.close(resolve));
});

beforeEach(() => {
  state.initMode = 'ok';
  state.toolMode = 'ok';
  state.toolResultPayload = { ok: true };
  state.lastToolCall = null;
});

// ---------------------------------------------------------------------------
// Test 1: HTTP 403 with a parseable MoatViolation body -> typed sentinel.
// ---------------------------------------------------------------------------
test('Test 1: 403 + parseable MoatViolation body returns tier_denied sentinel, never null', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolMode = '403-json';

  const result = await brain.callTool('brain_query', { cypher: 'MATCH (n) RETURN n LIMIT 1' });

  assert.notStrictEqual(result, null, '403 must not collapse to null');
  assert.strictEqual(typeof result, 'object');
  assert.strictEqual(result.error, 'tier_denied');
  assert.strictEqual(result.tool, 'brain_query');
  assert.strictEqual(typeof result.message, 'string');
  assert.match(result.message, /not on the read allowlist/, 'server message must be extracted, not discarded');
});

// ---------------------------------------------------------------------------
// Test 2: HTTP 403 with an unparseable body -> sentinel with raw text
// (truncated) as message.
// ---------------------------------------------------------------------------
test('Test 2: 403 + unparseable body still returns tier_denied sentinel with truncated raw text', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolMode = '403-raw';

  const result = await brain.callTool('search', { query: 'jobs to be done', topK: 5 });

  assert.notStrictEqual(result, null);
  assert.strictEqual(result.error, 'tier_denied');
  assert.strictEqual(result.tool, 'search');
  assert.strictEqual(typeof result.message, 'string');
  assert.ok(result.message.length > 0, 'message must not be empty even on unparseable body');
  assert.ok(result.message.includes('403 Forbidden'), 'raw text must survive into message');
  assert.ok(result.message.length <= 300, 'raw text fallback must be truncated');
});

// ---------------------------------------------------------------------------
// Test 3: HTTP 401 keeps the existing invalid_key sentinel path unchanged.
// ---------------------------------------------------------------------------
test('Test 3: HTTP 401 keeps the existing invalid_key sentinel path unchanged', async () => {
  const brain = freshBrainClient(mockUrl);
  state.initMode = '401';

  const result = await brain.callTool('brain_stats', {});

  assert.deepStrictEqual(result, { error: 'invalid_key', message: 'Brain API key is invalid.' });
});

// ---------------------------------------------------------------------------
// Test 4: network failure / unreachable transport still returns null.
// ---------------------------------------------------------------------------
test('Test 4: network failure (unreachable transport) still returns null, unchanged', async () => {
  const { server, port } = await startMockServer();
  await new Promise((resolve) => server.close(resolve));
  // The server is now closed; this port refuses connections.
  const brain = freshBrainClient('http://127.0.0.1:' + port);

  const result = await brain.callTool('brain_stats', {});

  assert.strictEqual(result, null, 'transport failure must return null, not a sentinel');
});

// ---------------------------------------------------------------------------
// Test 5: HTTP 200 returns the parsed result unchanged.
// ---------------------------------------------------------------------------
test('Test 5: HTTP 200 returns the parsed tool result unchanged', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolResultPayload = { hello: 'world', n: 42 };

  const result = await brain.callTool('brain_stats', {});

  assert.deepStrictEqual(result, { hello: 'world', n: 42 });
});

// ---------------------------------------------------------------------------
// Test 6: each of the 5 new loop-tool wrappers emits exactly the contracted
// tool name and arg keys.
// ---------------------------------------------------------------------------
test('Test 6: the 5 loop-tool wrappers emit exactly the contracted tool name + arg keys', async () => {
  const brain = freshBrainClient(mockUrl);

  const cases = [
    { fn: () => brain.normalizeFrameworkName('SWOT'), name: 'normalize_framework_name', keys: ['raw'] },
    { fn: () => brain.loopSearch('jobs to be done', 5), name: 'search', keys: ['query', 'topK'] },
    { fn: () => brain.discoverStructure('SWOT Analysis'), name: 'discover_structure', keys: ['framework_name'] },
    {
      fn: () => brain.orchestrationReadiness('SWOT Analysis'),
      name: 'orchestration_readiness',
      keys: ['framework_name'],
    },
    {
      fn: () => brain.feedsIntoChains(['SWOT Analysis'], 2),
      name: 'feeds_into_chains',
      keys: ['seeds', 'max_hops'],
    },
  ];

  for (const c of cases) {
    state.lastToolCall = null;
    await c.fn();
    assert.ok(state.lastToolCall, 'wrapper for ' + c.name + ' must have called the transport');
    assert.strictEqual(state.lastToolCall.name, c.name, 'wrapper must emit the exact contracted tool name');
    assert.deepStrictEqual(
      Object.keys(state.lastToolCall.arguments).sort(),
      c.keys.slice().sort(),
      'wrapper for ' + c.name + ' must emit exactly the contracted arg keys'
    );
  }
});

// ---------------------------------------------------------------------------
// Test 7: query() passes the tier_denied sentinel through unchanged.
// ---------------------------------------------------------------------------
test('Test 7: query() passes the tier_denied sentinel through unchanged', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolMode = '403-json';

  const result = await brain.query('MATCH (n) RETURN n');

  assert.notStrictEqual(result, null, 'a 403 on brain_query must be distinguishable from an outage');
  assert.strictEqual(result.error, 'tier_denied');
  assert.strictEqual(result.tool, 'brain_query');
});

// ---------------------------------------------------------------------------
// Test 8: audit of every other direct callTool consumer -- each either
// passes the sentinel through unchanged, or handles it explicitly and that
// handling is asserted here (not left implicit).
// ---------------------------------------------------------------------------
test('Test 8: every direct callTool consumer handles the tier_denied sentinel (passthrough or explicit)', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolMode = '403-json';

  const searchResult = await brain.search('innovation framework');
  assert.strictEqual(searchResult.error, 'tier_denied', 'search() must pass the sentinel through');

  const smartResult = await brain.smartSearch('innovation framework');
  assert.strictEqual(
    smartResult.error,
    'tier_denied',
    'smartSearch() must pass the sentinel through unchanged (not silently reroute to neo4j fallback)'
  );

  const schemaResult1 = await brain.schema();
  assert.strictEqual(schemaResult1.error, 'tier_denied', 'schema() must pass the sentinel through');

  // schema() must NOT cache the sentinel as valid schema data -- a stale
  // denial served for up to 30 minutes even after the Brain recovers would
  // be a correctness bug (Rule 1 audit fix, this phase).
  state.toolMode = 'ok';
  state.toolResultPayload = { labels: ['Framework'] };
  const schemaResult2 = await brain.schema();
  assert.deepStrictEqual(
    schemaResult2,
    { labels: ['Framework'] },
    'schema() must re-fetch, not serve a cached tier_denied sentinel as schema data'
  );
  state.toolMode = '403-json';

  const statsResult = await brain.stats();
  assert.strictEqual(statsResult.error, 'tier_denied', 'stats() must pass the sentinel through');

  const askResult = await brain.ask('what is SWOT');
  assert.strictEqual(askResult.error, 'tier_denied', 'ask() must pass the sentinel through');

  // askOp() has its own pre-existing degraded-sentinel contract (any result
  // shape that is not {count:number, rows:Array} degrades to
  // {degraded:true, count:0, rows:[]}). tier_denied does not carry
  // count/rows, so it degrades through that existing path -- documented
  // here as the audit's explicit finding, not a silent gap.
  const askOpResult = await brain.askOp('list_frameworks', {});
  assert.strictEqual(askOpResult.degraded, true, 'askOp() must degrade gracefully on the sentinel, not throw');
  assert.strictEqual(askOpResult.count, 0);
  assert.deepStrictEqual(askOpResult.rows, []);

  const writeResult = await brain.write('CREATE (n:Test) RETURN n');
  assert.strictEqual(writeResult.error, 'tier_denied', 'write() must pass the sentinel through (the realistic 403 case -- brain_write is admin-gated)');
});

// ---------------------------------------------------------------------------
// Regression: every OTHER non-OK status still returns null (only 403 gets
// the sentinel treatment; research Pitfall 4's degradation-test boundary).
// ---------------------------------------------------------------------------
test('Regression: HTTP 500 (or any other non-403 non-OK status) still returns null', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolMode = '500';

  const result = await brain.callTool('brain_stats', {});

  assert.strictEqual(result, null, 'a non-403 non-OK status must still be the transport-failure null signal');
});
