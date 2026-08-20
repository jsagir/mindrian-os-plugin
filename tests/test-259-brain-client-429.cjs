#!/usr/bin/env node
'use strict';

/**
 * Phase 259 Plan 01 (TRUST-01) -- forced-429 proof.
 * ==========================================================================
 * Proves lib/core/brain-client.cjs::callTool() no longer drops HTTP 429
 * into the bare `return null` at the bottom of its non-OK status ladder
 * (which the MCP shim renders as BRAIN_UNREACHABLE with copy claiming a
 * retry budget was spent, when zero retries actually ran). Instead a 429
 * honors Retry-After (D-01), falls back to a 500/1000/2000ms schedule when
 * Retry-After is absent (D-02), and after the budget exhausts returns a
 * distinct `{ error: 'rate_limited', ... }` sentinel (D-03), never null.
 *
 *   Test A (recovery): 429 then 200 -- the wrapped call returns the
 *     payload, never null; exactly 2 tools/call attempts.
 *   Test B (exhaustion): 429 on every attempt -- the sentinel comes back
 *     with attempts === 4 (1 initial + 3 retries, D-01) and the tools/call
 *     counter is exactly 4.
 *   Test C (RED PROOF): the exhaustion fixture, asserted so it fails
 *     against the pre-fix ladder (callTool returns null on a 429 today).
 *   Test D (Retry-After honored, D-01): elapsed wall time reflects the
 *     literal header value; retry_after_s is populated on the sentinel.
 *   Test E (D-02 schedule, zero sleeps): _rateLimitWaitMs(0|1|2, null, 500)
 *     returns exactly 500, 1000, 2000.
 *   Test F (_parseRetryAfterMs, zero I/O): delay-seconds and HTTP-date
 *     forms, and every invalid form returning null.
 *   Test G (budget independence, F-02): MINDRIAN_BRAIN_RETRY_MAX=0 does not
 *     disable 429 retries -- the 429 budget is a separate counter.
 *   Test H (Canon Part 8): the 429 branch adds zero outbound payload.
 *   Test I (no-Retry-After exhaustion): retry_after_s is null when the
 *     header was never present.
 *
 * Skeleton copied from tests/test-250-transport-retry.cjs; mock server is
 * the shared tests/helpers/brain-capture-server.cjs per D-04 (no fifth
 * mock server). No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { test, before, after, beforeEach } = require('node:test');

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
  setToolScript,
  getToolCallCount,
  resetToolScript,
} = require('./helpers/brain-capture-server.cjs');

const BRAIN_CLIENT_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'brain-client.cjs');

function freshBrainClient(url, envOverrides) {
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';
  // Tiny backoff by default so the suite stays fast; individual tests can
  // override via envOverrides to exercise other values.
  delete process.env.MINDRIAN_BRAIN_RETRY_MAX;
  delete process.env.MINDRIAN_BRAIN_RETRY_BASE_MS;
  delete process.env.MINDRIAN_BRAIN_RATELIMIT_RETRY_MAX;
  delete process.env.MINDRIAN_BRAIN_RATELIMIT_BASE_MS;
  delete process.env.MINDRIAN_BRAIN_RATELIMIT_MAX_WAIT_MS;
  process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '5';
  process.env.MINDRIAN_BRAIN_RATELIMIT_BASE_MS = '5';
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
  const started = await startCaptureServer();
  mockServer = started.server;
  mockUrl = started.url;
});

after(async () => {
  await stopCaptureServer(mockServer);
});

beforeEach(() => {
  resetToolScript();
  resetCaptured();
});

// ---------------------------------------------------------------------------
// Test A: recovery -- 429 (Retry-After: 0) then 200.
// ---------------------------------------------------------------------------
test('Test A: a 429 followed by a 200 recovers -- callTool returns the payload, never null, in exactly 2 attempts', async () => {
  const brain = freshBrainClient(mockUrl);
  setToolScript([
    { status: 429, headers: { 'Retry-After': '0' } },
    { status: 200 },
  ]);

  const result = await brain.callTool('brain_stats', {});

  assert.deepStrictEqual(result, { ok: true }, 'the wrapped call must return the payload, never null');
  assert.equal(getToolCallCount(), 2, 'the tools/call attempt counter must be exactly 2');
});

// ---------------------------------------------------------------------------
// Test B / Test C (RED PROOF): exhaustion -- 429 on every attempt.
// ---------------------------------------------------------------------------
test('Test B: a 429 on every attempt returns the rate_limited sentinel after exactly 4 attempts, never null', async () => {
  const brain = freshBrainClient(mockUrl);
  setToolScript([{ status: 429 }]); // last (only) entry repeats

  const result = await brain.callTool('brain_stats', {});

  assert.notEqual(result, null, 'exhaustion must never surface as null -- that is the bug this phase closes');
  assert.equal(result && result.error, 'rate_limited', 'the sentinel error kind must be rate_limited');
  assert.equal(result && result.tool, 'brain_stats', 'the sentinel must name the tool that was closed');
  assert.equal(result && result.attempts, 4, '1 initial + 3 retries (D-01) = 4 attempts');
  assert.equal(getToolCallCount(), 4, 'exactly 4 tools/call attempts (1 initial + 3 retries, D-01)');
});

test('RED PROOF: a 429 exhaustion never surfaces as null and always carries the rate_limited sentinel', async () => {
  const brain = freshBrainClient(mockUrl);
  setToolScript([{ status: 429 }]);

  const result = await brain.callTool('brain_stats', {});

  // Against the pre-fix ladder this fails: callTool falls through the
  // shared drain into the bare `return null` at the bottom of the non-OK
  // ladder, and result is null here, not an object with .error.
  assert.notEqual(result, null, 'RED PROOF: callTool must not return null on 429 exhaustion (the pre-fix behavior)');
  assert.equal(result.error, 'rate_limited', 'RED PROOF: the sentinel must be rate_limited, not a silent null');
});

// ---------------------------------------------------------------------------
// Test D: Retry-After is honored literally (D-01).
// ---------------------------------------------------------------------------
test('Test D: a Retry-After header on a 429 is honored literally for the wait before the next attempt', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RATELIMIT_BASE_MS: '5' });
  setToolScript([
    { status: 429, headers: { 'Retry-After': '1' } },
    { status: 200 },
  ]);

  const startedAt = Date.now();
  const result = await brain.callTool('brain_stats', {});
  const elapsedMs = Date.now() - startedAt;

  assert.deepStrictEqual(result, { ok: true }, 'the call must still recover after honoring Retry-After');
  assert.ok(elapsedMs >= 950, `elapsed time (${elapsedMs}ms) must reflect the 1s Retry-After wait, not the 5ms fallback base`);
});

test('Test D (exhaustion leg): retry_after_s on the sentinel reflects the last observed Retry-After header', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RATELIMIT_BASE_MS: '5' });
  setToolScript([{ status: 429, headers: { 'Retry-After': '1' } }]);

  const result = await brain.callTool('brain_stats', {});

  assert.equal(result && result.error, 'rate_limited');
  assert.equal(result && result.retry_after_s, 1, 'retry_after_s must equal the literal Retry-After value observed on the final attempt');
});

// ---------------------------------------------------------------------------
// Test E: D-02 schedule, zero sleeps, through the _test seam.
// ---------------------------------------------------------------------------
test('Test E: _rateLimitWaitMs falls back to the exact 500/1000/2000 schedule when Retry-After is absent', () => {
  const brain = freshBrainClient(mockUrl);
  const { _rateLimitWaitMs } = brain._test;

  assert.equal(_rateLimitWaitMs(0, null, 500), 500, 'first retry wait must be exactly 500ms');
  assert.equal(_rateLimitWaitMs(1, null, 500), 1000, 'second retry wait must be exactly 1000ms');
  assert.equal(_rateLimitWaitMs(2, null, 500), 2000, 'third retry wait must be exactly 2000ms');
});

// ---------------------------------------------------------------------------
// Test F: _parseRetryAfterMs, zero I/O.
// ---------------------------------------------------------------------------
test('Test F: _parseRetryAfterMs parses delay-seconds and HTTP-date forms and rejects everything else', () => {
  const brain = freshBrainClient(mockUrl);
  const { _parseRetryAfterMs } = brain._test;

  for (const bad of [null, undefined, '', '   ', 'abc', '-5', '1.5', 'Infinity']) {
    assert.equal(_parseRetryAfterMs(bad), null, `_parseRetryAfterMs(${JSON.stringify(bad)}) must be null`);
  }
  assert.equal(_parseRetryAfterMs('0'), 0, 'delay-seconds "0" must parse to 0ms');
  assert.equal(_parseRetryAfterMs('2'), 2000, 'delay-seconds "2" must parse to 2000ms');

  const futureDate = new Date(Date.now() + 10000).toUTCString();
  const futureMs = _parseRetryAfterMs(futureDate);
  assert.ok(typeof futureMs === 'number' && futureMs > 0, 'a future HTTP-date must parse to a positive number of ms');

  const pastDate = new Date(Date.now() - 10000).toUTCString();
  assert.equal(_parseRetryAfterMs(pastDate), 0, 'a past HTTP-date must clamp to 0 (retry now)');
});

// ---------------------------------------------------------------------------
// Test G: budget independence (F-02) -- MINDRIAN_BRAIN_RETRY_MAX=0 must not
// disable the 429 retry budget.
// ---------------------------------------------------------------------------
test('Test G: the 429 retry budget is independent of AVAIL-02\'s budget -- MINDRIAN_BRAIN_RETRY_MAX=0 does not disable 429 retries', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RETRY_MAX: '0' });
  setToolScript([{ status: 429 }]);

  const result = await brain.callTool('brain_stats', {});

  assert.equal(getToolCallCount(), 4, 'the 429 budget must still run its own 4 attempts even when the AVAIL-02 budget is zeroed');
  assert.equal(result && result.error, 'rate_limited', 'the result must still be the rate_limited sentinel');
});

// ---------------------------------------------------------------------------
// Test H: Canon Part 8 -- zero outbound payload added by the 429 branch.
// ---------------------------------------------------------------------------
test('Test H: the 429 branch adds zero outbound payload (Canon Part 8)', async () => {
  const brain = freshBrainClient(mockUrl);
  setToolScript([{ status: 429 }]);

  await brain.callTool('brain_stats', {});

  assert.ok(captured.length > 0, 'the capture server must have recorded at least one tools/call request');
  for (const entry of captured) {
    assert.deepStrictEqual(Object.keys(entry).sort(), ['arguments', 'name'], 'each captured request must carry exactly name and arguments');
    assert.equal(entry.name, 'brain_stats', 'the captured tool name must be unchanged');
    assert.deepStrictEqual(entry.arguments, {}, 'the captured arguments must be unchanged -- zero new outbound fields');
  }
});

// ---------------------------------------------------------------------------
// Test I: no-Retry-After exhaustion -- retry_after_s is null.
// ---------------------------------------------------------------------------
test('Test I: with no Retry-After header present, the exhaustion sentinel carries retry_after_s === null', async () => {
  const brain = freshBrainClient(mockUrl);
  setToolScript([{ status: 429 }]);

  const result = await brain.callTool('brain_stats', {});

  assert.equal(result && result.error, 'rate_limited');
  assert.equal(result && result.retry_after_s, null, 'retry_after_s must be null when no Retry-After header was ever observed');
});

// ---------------------------------------------------------------------------
// Regression: the pre-existing null contract is unchanged (5xx, 403, 401).
// ---------------------------------------------------------------------------
test('Regression: a 5xx-exhausted call still returns null, unchanged', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RETRY_MAX: '1', MINDRIAN_BRAIN_RETRY_BASE_MS: '5' });
  setToolScript([{ status: 503 }]);

  const result = await brain.callTool('brain_stats', {});

  assert.equal(result, null, 'a 5xx-exhausted call must still resolve to null, unchanged by the 429 branch');
});

test('Regression: a 403 still returns the tier_denied sentinel in exactly one attempt', async () => {
  const brain = freshBrainClient(mockUrl);
  setToolScript([{ status: 403, body: JSON.stringify({ error: { message: 'MoatViolation: tool not on the read allowlist' } }) }]);

  const result = await brain.callTool('brain_query', { cypher: 'MATCH (n) RETURN n' });

  assert.equal(result && result.error, 'tier_denied', '403 must still map to tier_denied, unchanged');
  assert.equal(getToolCallCount(), 1, '403 stays zero-retry, unchanged');
});
