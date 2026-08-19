#!/usr/bin/env node
'use strict';

/**
 * Quick 260819-c8j (WS-C1 + WS-D2) -- recommendChain() wrapper + the Part 8
 * belt at callTool().
 * ==========================================================================
 * Two loopback servers, no fetch mocking, per the 247-conformance precedent:
 *
 *   - tests/helpers/brain-capture-server.cjs (always-200, capture-only) for
 *     the arg-shape / alias-projection / pass-through / clamp / shape-gate /
 *     belt legs (1-3, 4, 5, 7).
 *   - a local mutable-status mock server, mirroring the established
 *     test-247-brain-client-403.cjs pattern (the precedent this suite reuses
 *     rather than reinvents), for the degradation leg (6: transport failure,
 *     403 passthrough, byte-identical success) and the no-key belt-regression
 *     leg (8).
 *
 * node --test, CJS, node:assert/strict + node:http only. No new deps.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const path = require('node:path');
const { test, before, after, beforeEach } = require('node:test');
const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
} = require('./helpers/brain-capture-server.cjs');

const BRAIN_CLIENT_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'brain-client.cjs');

// key: string -> sets MINDRIAN_BRAIN_KEY to that value. undefined (the
// default) -> a real-looking test key. null -> deletes the env var entirely
// (used by Leg 8, the no-key belt-regression proof).
function freshBrainClient(url, key) {
  process.env.MINDRIAN_BRAIN_URL = url;
  if (key === null) {
    delete process.env.MINDRIAN_BRAIN_KEY;
  } else {
    process.env.MINDRIAN_BRAIN_KEY = key === undefined ? 'test-key-not-real' : key;
  }
  delete require.cache[BRAIN_CLIENT_PATH];
  return require(BRAIN_CLIENT_PATH);
}

// ---------------------------------------------------------------------------
// Group A: brain-capture-server.cjs (always 200, capture-only).
// ---------------------------------------------------------------------------
let captureServer;
let captureUrl;

before(async () => {
  const started = await startCaptureServer();
  captureServer = started.server;
  captureUrl = started.url;
});

after(async () => {
  await stopCaptureServer(captureServer);
});

beforeEach(() => {
  resetCaptured();
});

test('Leg 1: recommendChain arg shape is exactly {problem_type, max_steps}, canonical tool name', async () => {
  const brain = freshBrainClient(captureUrl);
  await brain.recommendChain('Undefined Problem');
  const call = captured[captured.length - 1];
  assert.ok(call, 'recommendChain must call the transport');
  assert.strictEqual(call.name, 'recommend_chain');
  assert.deepStrictEqual(Object.keys(call.arguments).sort(), ['max_steps', 'problem_type']);
  assert.strictEqual(call.arguments.problem_type, 'Undefined Problem');
  assert.strictEqual(call.arguments.max_steps, 6);
});

test('Leg 2: alias projection -- local sensor slugs project onto canonical Brain names', async () => {
  const brain = freshBrainClient(captureUrl);

  resetCaptured();
  await brain.recommendChain('undefined');
  assert.strictEqual(captured[captured.length - 1].arguments.problem_type, 'Undefined Problem');

  resetCaptured();
  await brain.recommendChain('wdp');
  assert.strictEqual(captured[captured.length - 1].arguments.problem_type, 'Well-Defined Problem');

  resetCaptured();
  await brain.recommendChain('idp');
  assert.strictEqual(captured[captured.length - 1].arguments.problem_type, 'Ill-Defined Problem');

  resetCaptured();
  await brain.recommendChain('ILL-DEFINED');
  assert.strictEqual(
    captured[captured.length - 1].arguments.problem_type,
    'Ill-Defined Problem',
    'alias matching is case-insensitive on the trimmed token'
  );
});

test('Leg 3: an unmapped but well-shaped token passes through UNCHANGED', async () => {
  const brain = freshBrainClient(captureUrl);
  await brain.recommendChain('adoption-capacity');
  const call = captured[captured.length - 1];
  assert.strictEqual(call.arguments.problem_type, 'adoption-capacity');
});

test('Leg 4: max_steps clamps to an integer in 1..6; absent/NaN/out-of-range -> 6', async () => {
  const brain = freshBrainClient(captureUrl);

  resetCaptured();
  await brain.recommendChain('Undefined Problem');
  assert.strictEqual(captured[captured.length - 1].arguments.max_steps, 6, 'absent -> 6');

  resetCaptured();
  await brain.recommendChain('Undefined Problem', 99);
  assert.strictEqual(captured[captured.length - 1].arguments.max_steps, 6, '99 -> 6');

  resetCaptured();
  await brain.recommendChain('Undefined Problem', 0);
  assert.strictEqual(captured[captured.length - 1].arguments.max_steps, 6, '0 -> 6');

  resetCaptured();
  await brain.recommendChain('Undefined Problem', 3);
  assert.strictEqual(captured[captured.length - 1].arguments.max_steps, 3, '3 -> 3');

  resetCaptured();
  await brain.recommendChain('Undefined Problem', NaN);
  assert.strictEqual(captured[captured.length - 1].arguments.max_steps, 6, 'NaN -> 6');
});

test('Leg 5: a prose/PII-shaped problem_type is refused locally with ZERO network calls', async () => {
  const brain = freshBrainClient(captureUrl);
  resetCaptured();

  const result = await brain.recommendChain('jane@startup.com sent this problem description');
  assert.deepStrictEqual(result, { error: 'invalid_problem_type', tool: 'recommend_chain' });
  assert.strictEqual(captured.length, 0, 'a shape-gate refusal must make zero transport calls');
});

test('Leg 7 (clean half): a clean generic-handle framework_name still reaches the wire unchanged', async () => {
  const brain = freshBrainClient(captureUrl);
  resetCaptured();
  const result = await brain.discoverStructure('SWOT Analysis');
  assert.notStrictEqual(result, null);
  const call = captured[captured.length - 1];
  assert.ok(call, 'a clean payload must still reach the transport');
  assert.strictEqual(call.name, 'discover_structure');
  assert.strictEqual(call.arguments.framework_name, 'SWOT Analysis');
});

test('Leg 7 (belt half): a CONTENT-SET forbidden-pattern payload is refused before any network call', async () => {
  const brain = freshBrainClient(captureUrl);
  resetCaptured();
  // FORBIDDEN_PATTERNS (lib/core/cross-room-aggregator.cjs) includes an email
  // regex; discoverStructure wraps its arg as { framework_name: ... }, so this
  // payload hits the CONTENT-SET default-deny scan at the callTool belt.
  const result = await brain.discoverStructure('leak@example.com');
  assert.deepStrictEqual(result, {
    error: 'egress_blocked',
    tool: 'discover_structure',
    egress_class: 'content_set',
  });
  assert.strictEqual(captured.length, 0, 'a belt refusal must open zero sockets');
});

// ---------------------------------------------------------------------------
// Group B: local mutable-status mock server (degradation legs + no-key belt
// regression). Mirrors the established test-247-brain-client-403.cjs pattern.
// ---------------------------------------------------------------------------
const state = {
  initMode: 'ok', // 'ok' | '401'
  toolMode: 'ok', // 'ok' | '403-json' | '500'
  toolResultPayload: { ok: true },
  lastToolCall: null,
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
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: {
                code: -32003,
                name: 'MoatViolation',
                message: 'MoatViolation: tool "' + state.lastToolCall.name + '" is not on the read allowlist',
              },
            })
          );
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

test('Leg 6a: transport failure (unreachable server) -> null, unchanged', async () => {
  const { server, port } = await startMockServer();
  await new Promise((resolve) => server.close(resolve));
  const brain = freshBrainClient('http://127.0.0.1:' + port);

  const result = await brain.recommendChain('Undefined Problem');
  assert.strictEqual(result, null, 'transport failure must return null, not a sentinel');
});

test('Leg 6b: HTTP 403 -> tier_denied sentinel passes through UNRESHAPED', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolMode = '403-json';

  const result = await brain.recommendChain('Undefined Problem');
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.error, 'tier_denied');
  assert.strictEqual(result.tool, 'recommend_chain');
});

test('Leg 6c: a success payload is returned byte-identical (zero reshaping)', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolResultPayload = {
    tool: 'recommend_chain',
    backend: 'memgraph',
    grounded: true,
    problem_type: 'Undefined Problem',
    seed_candidates: ['Beautiful Question Framework'],
    chain: [
      { step: 1, framework: 'Beautiful Question Framework', pagerank: 0.9, edge_confidence: 0.8, commands: ['bq'] },
    ],
    note: null,
    execution_hint: 'run step 1 first',
  };

  const result = await brain.recommendChain('Undefined Problem');
  assert.deepStrictEqual(result, state.toolResultPayload, 'recommendChain must not reshape the Brain payload');
});

test('Leg 8: the belt does not regress the no-key path -- unset key still returns null', async () => {
  // Full ladder isolation (mirrors tests/test-250-silent-registration.cjs):
  // a fresh tmp HOME with no .mindrian.env / .mindrian-install.json, and a
  // temporary chdir so <cwd>/.env (this repo carries a real one) cannot
  // resolve a real key out from under the test. Restored in `finally`.
  const prevDisable = process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
  const prevHome = process.env.HOME;
  const prevCwd = process.cwd();
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'test-c8j-nokeyhome-'));
  process.env.MINDRIAN_DISABLE_AUTO_REGISTER = '1';
  process.env.HOME = tmpHome;
  process.chdir(tmpHome);
  try {
    const brain = freshBrainClient(mockUrl, null); // null -> deletes MINDRIAN_BRAIN_KEY
    const result = await brain.recommendChain('Undefined Problem');
    assert.strictEqual(result, null, 'no key -> null, belt sits after the key gate and never runs');
    assert.strictEqual(state.lastToolCall, null, 'no transport call should have been made');
  } finally {
    process.chdir(prevCwd);
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
    if (prevDisable === undefined) delete process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
    else process.env.MINDRIAN_DISABLE_AUTO_REGISTER = prevDisable;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});
