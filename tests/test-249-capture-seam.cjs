#!/usr/bin/env node
'use strict';

/**
 * Phase 249 Plan 01, Task 2 (ENRICH-01) -- capture seams.
 * ==========================================================================
 * Proves the wrapper chokepoint (lib/core/brain-client.cjs's
 * orchestrationReadiness/discoverStructure) and the derivation-drain
 * piggyback (lib/brain/framework-chain-slice.cjs's fetchFrameworkChainSlice,
 * threaded from lib/core/navigation/packet.cjs's _surfaceFrameworkChainHint)
 * capture genuine misses ONLY, never touch the 1200ms hot path, and never
 * throw into or block the caller.
 *
 *   1. orchestrationReadiness(name, opts) with opts.roomDir: readiness_score
 *      <= 2 captures; >= 3 does not; tier_denied/invalid_key sentinel does
 *      not; null transport failure does not.
 *   2. discoverStructure(name, opts) with opts.roomDir: grounded === false
 *      captures; grounded true does not.
 *   3. No opts / no roomDir: zero capture, zero throw, wrapper return value
 *      byte-identical to the un-instrumented call.
 *   4. An enqueue failure (unwritable dir) never surfaces to the wrapper
 *      caller (the wrapper still returns the real payload).
 *   5. fetchFrameworkChainSlice with opts.roomDir: each sanitized seed gets
 *      an orchestrationReadiness probe in the same async drain pass; a probe
 *      failure never degrades the slice result.
 *   6. _surfaceFrameworkChainHint passes roomDir into the fetcher args from
 *      buildBrainPacket's options.roomDir; null when absent.
 *   7. Each successful capture logs a scalar enrichment_queue_captured
 *      memory_event (mirrors the brain_packet_rejected precedent).
 *   8. Hot-path fence: no brain-client/enrichment-queue require in
 *      lib/core/sensors/*.cjs or the decide() path
 *      (lib/core/navigation-engine.cjs).
 *
 * Loopback mock-server pattern copied from tests/test-247-brain-client-403.cjs
 * (real node:http server, no fetch mocking). node --test, CJS,
 * node:assert/strict only. No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after, beforeEach } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
const ENRICHMENT_QUEUE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'enrichment-queue.cjs');
const QUEUE_RELATIVE = path.join('.mindrian', 'enrichment-queue.json');

function freshRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-249-capture-seam-'));
}

function readQueueFile(roomDir) {
  const p = path.join(roomDir, QUEUE_RELATIVE);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// Mock server: same shape as test-247-brain-client-403.cjs's loopback server,
// generalized so each test can set the exact tool-response payload it needs.
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
        state.lastToolCall = {
          name: parsed.params && parsed.params.name,
          arguments: (parsed.params && parsed.params.arguments) || {},
        };

        if (state.toolMode === '403-json') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: { code: -32003, name: 'MoatViolation', message: 'MoatViolation: tool "' + state.lastToolCall.name + '" is not on the read allowlist' },
          }));
          return;
        }

        if (state.toolMode === '500') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'internal_error' }));
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

function freshBrainClient(url) {
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';
  delete require.cache[BRAIN_CLIENT_PATH];
  delete require.cache[ENRICHMENT_QUEUE_PATH];
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
// Test 1: orchestrationReadiness captures on a real miss (score <= 2).
// ---------------------------------------------------------------------------
test('Test 1: orchestrationReadiness(name, {roomDir}) captures when readiness_score <= 2', async () => {
  const brain = freshBrainClient(mockUrl);
  const roomDir = freshRoom();
  state.toolResultPayload = { name: 'Six Thinking Hats', readiness_score: 1, orchestration_status: 'not_ready' };

  const result = await brain.orchestrationReadiness('Six Thinking Hats', { roomDir });

  assert.deepStrictEqual(result, state.toolResultPayload, 'the return value must be byte-identical to the raw payload');
  const q = readQueueFile(roomDir);
  assert.ok(q, 'a queue file must have been written');
  assert.equal(q.entries.length, 1);
  assert.equal(q.entries[0].framework, 'Six Thinking Hats');
  assert.equal(q.entries[0].readiness_score, 1);
  assert.equal(q.entries[0].source, 'live_reach');
});

// ---------------------------------------------------------------------------
// Test 2: readiness_score >= 3 does not capture.
// ---------------------------------------------------------------------------
test('Test 2: orchestrationReadiness does NOT capture when readiness_score >= 3', async () => {
  const brain = freshBrainClient(mockUrl);
  const roomDir = freshRoom();
  state.toolResultPayload = { name: 'Beautiful Question', readiness_score: 4, orchestration_status: 'ready' };

  await brain.orchestrationReadiness('Beautiful Question', { roomDir });

  assert.equal(readQueueFile(roomDir), null, 'a ready framework must never be queued');
});

// ---------------------------------------------------------------------------
// Test 3: a tier_denied sentinel is never a capture trigger.
// ---------------------------------------------------------------------------
test('Test 3: orchestrationReadiness does NOT capture on a tier_denied (403) sentinel', async () => {
  const brain = freshBrainClient(mockUrl);
  const roomDir = freshRoom();
  state.toolMode = '403-json';

  const result = await brain.orchestrationReadiness('Six Thinking Hats', { roomDir });

  assert.equal(result.error, 'tier_denied');
  assert.equal(readQueueFile(roomDir), null, 'a sentinel must never be treated as an enrichment miss');
});

// ---------------------------------------------------------------------------
// Test 4: an invalid_key sentinel is never a capture trigger.
// ---------------------------------------------------------------------------
test('Test 4: orchestrationReadiness does NOT capture on an invalid_key (401) sentinel', async () => {
  const brain = freshBrainClient(mockUrl);
  const roomDir = freshRoom();
  state.initMode = '401';

  const result = await brain.orchestrationReadiness('Six Thinking Hats', { roomDir });

  assert.equal(result.error, 'invalid_key');
  assert.equal(readQueueFile(roomDir), null);
});

// ---------------------------------------------------------------------------
// Test 5: a null transport failure is never a capture trigger.
// ---------------------------------------------------------------------------
test('Test 5: orchestrationReadiness does NOT capture on a null transport failure', async () => {
  const { server, port } = await startMockServer();
  await new Promise((resolve) => server.close(resolve));
  const brain = freshBrainClient('http://127.0.0.1:' + port);
  const roomDir = freshRoom();

  const result = await brain.orchestrationReadiness('Six Thinking Hats', { roomDir });

  assert.equal(result, null, 'a transport failure must stay the null signal, unchanged');
  assert.equal(readQueueFile(roomDir), null, 'failure visibility is Phase 250 territory, not an enrichment miss');
});

// ---------------------------------------------------------------------------
// Test 6: discoverStructure grounded:false captures; grounded:true does not.
// ---------------------------------------------------------------------------
test('Test 6: discoverStructure(name, {roomDir}) captures on grounded:false, not on grounded:true', async () => {
  const brain = freshBrainClient(mockUrl);

  const roomDirA = freshRoom();
  state.toolResultPayload = { grounded: false, components: [] };
  const resA = await brain.discoverStructure('PEST Analysis', { roomDir: roomDirA });
  assert.deepStrictEqual(resA, state.toolResultPayload);
  const qA = readQueueFile(roomDirA);
  assert.ok(qA);
  assert.equal(qA.entries[0].framework, 'PEST Analysis');
  assert.equal(qA.entries[0].readiness_score, null);
  assert.deepEqual(qA.entries[0].missing_dimensions, ['structure']);

  const roomDirB = freshRoom();
  state.toolResultPayload = { grounded: true, components: [{ name: 'x' }] };
  await brain.discoverStructure('Beautiful Question', { roomDir: roomDirB });
  assert.equal(readQueueFile(roomDirB), null, 'a grounded structure must never be queued');
});

// ---------------------------------------------------------------------------
// Test 7: no opts / no roomDir -- zero capture, zero throw, byte-identical return.
// ---------------------------------------------------------------------------
test('Test 7: no opts (or opts without roomDir) -- zero capture, zero throw, return value unchanged', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolResultPayload = { name: 'Six Thinking Hats', readiness_score: 1, orchestration_status: 'not_ready' };

  const noOptsResult = await brain.orchestrationReadiness('Six Thinking Hats');
  assert.deepStrictEqual(noOptsResult, state.toolResultPayload);

  const emptyOptsResult = await brain.orchestrationReadiness('Six Thinking Hats', {});
  assert.deepStrictEqual(emptyOptsResult, state.toolResultPayload);

  const noRoomDirResult = await brain.orchestrationReadiness('Six Thinking Hats', { contextClass: { reach_id: 'brain_consult' } });
  assert.deepStrictEqual(noRoomDirResult, state.toolResultPayload);

  // discoverStructure mirrors the same contract.
  state.toolResultPayload = { grounded: false, components: [] };
  const dsResult = await brain.discoverStructure('PEST Analysis');
  assert.deepStrictEqual(dsResult, state.toolResultPayload);
});

// ---------------------------------------------------------------------------
// Test 8: an enqueue failure (unwritable dir) never surfaces to the caller.
// ---------------------------------------------------------------------------
test('Test 8: an enqueue failure (unwritable roomDir) never surfaces to the wrapper caller', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolResultPayload = { name: 'Six Thinking Hats', readiness_score: 1, orchestration_status: 'not_ready' };

  await assert.doesNotReject(async () => {
    const result = await brain.orchestrationReadiness('Six Thinking Hats', { roomDir: '/root/definitely-unwritable-249-capture' });
    assert.deepStrictEqual(result, state.toolResultPayload, 'the wrapper must still return the real payload even when the enqueue write fails');
  });
});

// ---------------------------------------------------------------------------
// Test 9: successful capture logs a scalar enrichment_queue_captured memory_event.
// ---------------------------------------------------------------------------
test('Test 9: a successful capture logs a scalar enrichment_queue_captured memory_event', async () => {
  const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const brain = freshBrainClient(mockUrl);
  const roomDir = freshRoom();
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);

  state.toolResultPayload = { name: 'Six Thinking Hats', readiness_score: 1, orchestration_status: 'not_ready' };
  await brain.orchestrationReadiness('Six Thinking Hats', { roomDir, db });

  const row = db.prepare(
    "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'enrichment_queue_captured' LIMIT 1"
  ).get();
  assert.ok(row, 'an enrichment_queue_captured memory_event must have been logged');
  const props = JSON.parse(row.properties);
  assert.equal(props.framework, 'Six Thinking Hats');
  assert.equal(props.readiness_score, 1);
});

// ---------------------------------------------------------------------------
// Test 10: fetchFrameworkChainSlice piggyback -- each seed gets an
// orchestrationReadiness probe in the same drain pass; a probe failure never
// degrades the slice result.
// ---------------------------------------------------------------------------
test('Test 10: fetchFrameworkChainSlice(opts.roomDir) probes each sanitized seed via orchestrationReadiness in the same drain pass', async () => {
  const chainSlice = require(path.join(REPO_ROOT, 'lib', 'brain', 'framework-chain-slice.cjs'));
  const roomDir = freshRoom();
  const probed = [];

  const stubBrainClient = {
    isAvailable: () => true,
    askOp: async () => ({
      op: 'framework_chain_slice',
      count: 1,
      rows: [{ from: 'Six Thinking Hats', to: 'Reverse Salient Analysis', hop_distance: 1 }],
    }),
    orchestrationReadiness: async (name, opts) => {
      probed.push({ name, opts });
      return { name, readiness_score: 1, orchestration_status: 'not_ready' };
    },
    _test: { sanitizeCypherInput: (s) => s },
  };

  const result = await chainSlice.fetchFrameworkChainSlice({
    active_frameworks: ['Six Thinking Hats'],
    max_hops: 2,
    brainClient: stubBrainClient,
    roomDir,
  });

  assert.equal(result.edges.length, 1, 'the slice envelope must be unaffected by the piggyback probe');
  assert.equal(probed.length, 1, 'exactly one probe must fire for the one sanitized seed');
  assert.equal(probed[0].name, 'Six Thinking Hats');
  assert.equal(probed[0].opts.roomDir, roomDir);
});

test('Test 11: fetchFrameworkChainSlice -- a probe failure never degrades the slice result', async () => {
  const chainSlice = require(path.join(REPO_ROOT, 'lib', 'brain', 'framework-chain-slice.cjs'));
  const roomDir = freshRoom();

  const stubBrainClient = {
    isAvailable: () => true,
    askOp: async () => ({
      op: 'framework_chain_slice',
      count: 1,
      rows: [{ from: 'Six Thinking Hats', to: 'Reverse Salient Analysis', hop_distance: 1 }],
    }),
    orchestrationReadiness: async () => { throw new Error('boom'); },
    _test: { sanitizeCypherInput: (s) => s },
  };

  const result = await chainSlice.fetchFrameworkChainSlice({
    active_frameworks: ['Six Thinking Hats'],
    max_hops: 2,
    brainClient: stubBrainClient,
    roomDir,
  });

  assert.equal(result.edges.length, 1, 'a probe throw must never surface into the slice envelope');
  assert.equal(result.edges[0].from, 'Six Thinking Hats');
});

test('Test 12: fetchFrameworkChainSlice without opts.roomDir fires zero probes', async () => {
  const chainSlice = require(path.join(REPO_ROOT, 'lib', 'brain', 'framework-chain-slice.cjs'));
  let probeCount = 0;

  const stubBrainClient = {
    isAvailable: () => true,
    askOp: async () => ({
      op: 'framework_chain_slice',
      count: 1,
      rows: [{ from: 'Six Thinking Hats', to: 'Reverse Salient Analysis', hop_distance: 1 }],
    }),
    orchestrationReadiness: async () => { probeCount++; return { readiness_score: 1 }; },
    _test: { sanitizeCypherInput: (s) => s },
  };

  const result = await chainSlice.fetchFrameworkChainSlice({
    active_frameworks: ['Six Thinking Hats'],
    max_hops: 2,
    brainClient: stubBrainClient,
    // no roomDir
  });

  assert.equal(result.edges.length, 1);
  assert.equal(probeCount, 0, 'no roomDir means no piggyback probe fires');
});

// ---------------------------------------------------------------------------
// Test 13: _surfaceFrameworkChainHint threads roomDir into the fetcher args.
// ---------------------------------------------------------------------------
test('Test 13: _surfaceFrameworkChainHint passes roomDir into the fetcher when present, null when absent', async () => {
  const packet = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'packet.cjs'));
  const roomState = { governing_thought: 'Apply Six Thinking Hats to this decision' };

  const callsWith = [];
  const mockFetcher = async (fetchOpts) => {
    callsWith.push(fetchOpts);
    return { edges: [], slice_scope: 3, slice_rationale: 'mock', brain_snapshot_id: null, fetched_at: new Date().toISOString() };
  };

  await packet._test._surfaceFrameworkChainHint(null, roomState, {
    roomDir: '/tmp/some-room-249',
    _mocks: { fetchFrameworkChainSlice: mockFetcher },
  });
  assert.equal(callsWith.length, 1);
  assert.equal(callsWith[0].roomDir, '/tmp/some-room-249');

  callsWith.length = 0;
  await packet._test._surfaceFrameworkChainHint(null, roomState, {
    _mocks: { fetchFrameworkChainSlice: mockFetcher },
  });
  assert.equal(callsWith.length, 1);
  assert.equal(callsWith[0].roomDir, null, 'absent options.roomDir must thread through as null, not undefined-and-missing');
});

// ---------------------------------------------------------------------------
// Test 14: hot-path fence -- no brain-client/enrichment-queue require in
// sensors/ or the decide() path.
// ---------------------------------------------------------------------------
test('Test 14 (hot-path fence): lib/core/sensors/*.cjs and navigation-engine.cjs carry no brain-client / enrichment-queue require', () => {
  const sensorsDir = path.join(REPO_ROOT, 'lib', 'core', 'sensors');
  const files = fs.readdirSync(sensorsDir).filter((f) => f.endsWith('.cjs') && !f.endsWith('.test.cjs'));
  assert.ok(files.length > 0, 'the sensors directory must not be empty (a false-pass guard)');

  const forbidden = /require\(\s*['"][^'"]*(brain-client|enrichment-queue)\.cjs['"]\s*\)/;
  for (const f of files) {
    const content = fs.readFileSync(path.join(sensorsDir, f), 'utf8');
    assert.equal(forbidden.test(content), false, 'forbidden require found in sensors/' + f);
  }

  const navEnginePath = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs');
  const navEngineContent = fs.readFileSync(navEnginePath, 'utf8');
  assert.equal(forbidden.test(navEngineContent), false, 'forbidden require found in navigation-engine.cjs (the decide() path)');
});
