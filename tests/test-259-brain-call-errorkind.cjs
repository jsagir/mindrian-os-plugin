#!/usr/bin/env node
'use strict';

/**
 * Phase 259 Plan 03 (TRUST-02) -- brainCall errorKind classification.
 * ==========================================================================
 * scripts/build-brain-census.cjs::brainCall() returns { ok:false, httpStatus,
 * bodyText } on every failure, but the catch blocks keep only e.message,
 * which collapses an AbortSignal.timeout abort ("The operation was aborted
 * due to timeout") and a connection failure ("fetch failed") into the same
 * bodyText prefix -- no reliable signal survives to classify the failure
 * without string-sniffing an English message Node is free to reword. This
 * suite proves an additive errorKind field ('hard_error' | 'timeout' |
 * 'malformed') is classified at the site where the error object still
 * exists, using two live loopback legs (a hang and a closed port) plus two
 * scripted-response legs (a 429 and a malformed body).
 *
 * Server-lifecycle shape copied from tests/test-250-transport-retry.cjs:143-161
 * (before/after real node:http server, no fetch mocking). Deliberately
 * SEPARATE from tests/test-259-floor-void.cjs, which stays pure and zero-I/O.
 * No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test, before, after } = require('node:test');

const CENSUS_PATH = path.resolve(__dirname, '..', 'scripts', 'build-brain-census.cjs');

function freshBrainCall(url, timeoutMs) {
  process.env.MINDRIAN_BRAIN_URL = url;
  if (timeoutMs) {
    process.env.MINDRIAN_BRAIN_TIMEOUT_MS = String(timeoutMs);
  } else {
    delete process.env.MINDRIAN_BRAIN_TIMEOUT_MS;
  }
  delete require.cache[CENSUS_PATH];
  return require(CENSUS_PATH);
}

// ---------------------------------------------------------------------------
// A scriptable loopback server: mode controls how it responds to a POST.
// ---------------------------------------------------------------------------
let scriptedServer;
let scriptedUrl;
let scriptedMode = 'ok';

function startScriptedServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (scriptedMode === 'hang') {
        // Never call res.end() -- the client's own AbortSignal.timeout fires.
        return;
      }
      if (scriptedMode === '429') {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: -32005, message: 'Rate limit exceeded' } }));
        return;
      }
      if (scriptedMode === 'no-data-line') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end('not an sse line at all');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: ' + JSON.stringify({
        jsonrpc: '2.0', id: 2,
        result: { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] },
      }) + '\n');
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: 'http://127.0.0.1:' + port });
    });
  });
}

before(async () => {
  const started = await startScriptedServer();
  scriptedServer = started.server;
  scriptedUrl = started.url;
});

after(async () => {
  await new Promise((resolve) => scriptedServer.close(resolve));
});

// ---------------------------------------------------------------------------
// Timeout leg: server accepts the connection, never responds.
// ---------------------------------------------------------------------------
test('a hung connection classifies as errorKind timeout', async () => {
  scriptedMode = 'hang';
  const { brainCall } = freshBrainCall(scriptedUrl, 200);

  const result = await brainCall('brain_stats', {}, 'test-key');

  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 0, 'a hang never reaches an HTTP status');
  assert.equal(result.errorKind, 'timeout', 'an AbortSignal.timeout abort must classify as timeout, not hard_error');
});

// ---------------------------------------------------------------------------
// Closed-port leg: connection refused.
// ---------------------------------------------------------------------------
test('a closed port classifies as errorKind hard_error', async () => {
  const closed = await startScriptedServer();
  const deadUrl = closed.url;
  await new Promise((resolve) => closed.server.close(resolve));

  const { brainCall } = freshBrainCall(deadUrl, 2000);
  const result = await brainCall('brain_stats', {}, 'test-key');

  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 0);
  assert.equal(result.errorKind, 'hard_error', 'a connection failure (TypeError, no distinguishing name) must classify as hard_error');
});

// ---------------------------------------------------------------------------
// HTTP 429 leg: non-OK HTTP response.
// ---------------------------------------------------------------------------
test('an HTTP 429 response classifies as errorKind hard_error', async () => {
  scriptedMode = '429';
  const { brainCall } = freshBrainCall(scriptedUrl, 2000);

  const result = await brainCall('brain_stats', {}, 'test-key');

  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 429);
  assert.equal(result.errorKind, 'hard_error');
});

// ---------------------------------------------------------------------------
// Malformed leg: HTTP 200 with no SSE data: line.
// ---------------------------------------------------------------------------
test('an HTTP 200 with no SSE data line classifies as errorKind malformed', async () => {
  scriptedMode = 'no-data-line';
  const { brainCall } = freshBrainCall(scriptedUrl, 2000);

  const result = await brainCall('brain_stats', {}, 'test-key');

  assert.equal(result.ok, false);
  assert.equal(result.errorKind, 'malformed');
});

// ---------------------------------------------------------------------------
// Success leg: errorKind is absent, existing fields unaffected.
// ---------------------------------------------------------------------------
test('a successful call carries no errorKind and keeps ok/result unaffected', async () => {
  scriptedMode = 'ok';
  const { brainCall } = freshBrainCall(scriptedUrl, 2000);

  const result = await brainCall('brain_stats', {}, 'test-key');

  assert.equal(result.ok, true);
  assert.deepStrictEqual(result.result, { ok: true });
  assert.equal(result.errorKind, undefined, 'errorKind is a failure-only field');
});
