#!/usr/bin/env node
'use strict';

/**
 * Phase 250 Plan 01, Task 1 (AVAIL-02, navigator ruling 2026-08-10) --
 * bounded transport retry budget.
 * ==========================================================================
 * Proves the retry lives at the transport layer around the single HTTP
 * dispatch seam every Brain tool flows through (the tools/call POST inside
 * lib/core/brain-client.cjs's callTool()), NOT in the refusal renderer, NOT
 * in the shim.
 *
 *   Test A (transient recovers): server fails twice (503) then 200 on
 *     tools/call -- the wrapped call returns the payload, never null; the
 *     tools/call attempt counter is exactly 3.
 *   Test B (budget exhausted): server always 503 on tools/call -- the call
 *     returns null after exactly 1 + RETRY_MAX attempts.
 *   Test C (zero-retry classes): a 403 on tools/call returns the
 *     tier_denied sentinel with exactly ONE attempt; a 401 on the
 *     initialize handshake returns the invalid_key sentinel with exactly
 *     ONE attempt (401/403 are validation-class, never transient).
 *   Test D (env override): MINDRIAN_BRAIN_RETRY_MAX=0 disables retries (one
 *     attempt); an invalid value falls back to the default.
 *
 * Loopback mock-server pattern copied from tests/test-247-brain-client-403.cjs
 * / tests/test-249-capture-seam.cjs (real node:http server, no fetch
 * mocking). Tiny backoff via env overrides keeps this suite well under 60s.
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
// Mock server: distinguishes initialize vs tools/call by JSON-RPC method (the
// test-249-capture-seam.cjs precedent), so the retry-eligible seam (tools/call)
// can be scripted independently of the session handshake.
// ---------------------------------------------------------------------------
const state = {
  initMode: 'ok', // 'ok' | '401'
  toolScript: null, // array of 'ok' | '503' consumed in order; last entry repeats
  toolResultPayload: { ok: true },
  toolCallCount: 0,
};

function nextToolMode() {
  if (!Array.isArray(state.toolScript) || state.toolScript.length === 0) return 'ok';
  const idx = Math.min(state.toolCallCount, state.toolScript.length - 1);
  return state.toolScript[idx];
}

function startMockServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
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
        res.end('data: ' + JSON.stringify({
          jsonrpc: '2.0', id: parsed.id,
          result: { protocolVersion: '2024-11-05', capabilities: {} },
        }) + '\n');
        return;
      }

      if (parsed.method === 'tools/call') {
        const mode = nextToolMode();
        state.toolCallCount += 1;

        if (mode === '503') {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'temporarily_unavailable' }));
          return;
        }
        if (mode === '403') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: { code: -32003, name: 'MoatViolation', message: 'MoatViolation: tool not on the read allowlist' },
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end('data: ' + JSON.stringify({
          jsonrpc: '2.0', id: parsed.id,
          result: { content: [{ type: 'text', text: JSON.stringify(state.toolResultPayload) }] },
        }) + '\n');
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

function freshBrainClient(url, envOverrides) {
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';
  // Tiny backoff by default so the suite stays fast; individual tests can
  // override via envOverrides to exercise the real default / invalid-value
  // fallback path.
  delete process.env.MINDRIAN_BRAIN_RETRY_MAX;
  delete process.env.MINDRIAN_BRAIN_RETRY_BASE_MS;
  process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '5';
  if (envOverrides) {
    for (const k of Object.keys(envOverrides)) {
      if (envOverrides[k] === undefined) { delete process.env[k]; }
      else { process.env[k] = envOverrides[k]; }
    }
  }
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
  state.toolScript = null;
  state.toolResultPayload = { ok: true };
  state.toolCallCount = 0;
});

// ---------------------------------------------------------------------------
// Test A: transient recovers -- 503, 503, 200 on tools/call.
// ---------------------------------------------------------------------------
test('Test A: a transient failure retries then recovers, never surfaces null', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolScript = ['503', '503', 'ok'];
  state.toolResultPayload = { hello: 'recovered' };

  const result = await brain.callTool('brain_stats', {});

  assert.deepStrictEqual(result, { hello: 'recovered' }, 'the wrapped call must return the payload, never null');
  assert.equal(state.toolCallCount, 3, 'the tools/call attempt counter must be exactly 3');
});

// ---------------------------------------------------------------------------
// Test B: budget exhausted -- always 503 on tools/call.
// ---------------------------------------------------------------------------
test('Test B: budget exhausted returns null after exactly 1 + RETRY_MAX attempts', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RETRY_MAX: '2' });
  state.toolScript = ['503', '503', '503', '503', '503'];

  const result = await brain.callTool('brain_stats', {});

  assert.equal(result, null, 'a real outage must still resolve to null after the retry budget');
  assert.equal(state.toolCallCount, 3, 'exactly 1 + RETRY_MAX(2) = 3 attempts');
});

// ---------------------------------------------------------------------------
// Test C: zero-retry classes -- 403 and 401 never retry.
// ---------------------------------------------------------------------------
test('Test C (403 leg): tier_denied sentinel comes back with exactly ONE tools/call attempt', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RETRY_MAX: '2' });
  state.toolScript = ['403', '503', 'ok']; // if the client retried, it would see 503 next -- it must not

  const result = await brain.callTool('brain_query', { cypher: 'MATCH (n) RETURN n' });

  assert.equal(result && result.error, 'tier_denied', '403 must map to the tier_denied sentinel');
  assert.equal(state.toolCallCount, 1, '403 is validation-class, never transient -- exactly one attempt');
});

test('Test C (401 leg): invalid_key sentinel comes back with exactly ONE attempt', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RETRY_MAX: '2' });
  state.initMode = '401';
  state.toolScript = ['ok']; // must never be reached -- init fails first

  const result = await brain.callTool('brain_query', { cypher: 'MATCH (n) RETURN n' });

  assert.deepStrictEqual(result, { error: 'invalid_key', message: 'Brain API key is invalid.' });
  assert.equal(state.toolCallCount, 0, '401 on the handshake means tools/call is never reached -- zero tool attempts');
});

// ---------------------------------------------------------------------------
// Test D: env override -- RETRY_MAX=0 disables retries; invalid value falls
// back to the default.
// ---------------------------------------------------------------------------
test('Test D (leg 1): MINDRIAN_BRAIN_RETRY_MAX=0 disables retries (one attempt)', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RETRY_MAX: '0' });
  state.toolScript = ['503', 'ok'];

  const result = await brain.callTool('brain_stats', {});

  assert.equal(result, null, 'with retries disabled, a single 503 must surface as null immediately');
  assert.equal(state.toolCallCount, 1, 'exactly one attempt when RETRY_MAX=0');
});

test('Test D (leg 2): an invalid RETRY_MAX value falls back to the default (2 retries, 3 attempts)', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RETRY_MAX: 'not-a-number' });
  state.toolScript = ['503', '503', '503', '503'];

  const result = await brain.callTool('brain_stats', {});

  assert.equal(result, null, 'budget still exhausts under the default');
  assert.equal(state.toolCallCount, 3, 'an invalid env value must fall back to the default RETRY_MAX=2 (3 attempts)');
});
