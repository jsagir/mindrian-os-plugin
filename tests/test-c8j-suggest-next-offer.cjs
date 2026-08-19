#!/usr/bin/env node
'use strict';

/**
 * Quick 260819-c8j (Task 3) -- chain_offer on suggest_next, hookless and
 * graceful.
 * ==========================================================================
 * Drives the REAL registered suggest_next handler (captured off a fake MCP
 * server from the REAL sensors.cjs register(), the same idiom
 * tests/test-222-reach-wired.cjs:162-190 uses -- reuse, not a second
 * harness). A real fired SENS-01 reach (a fresh <roomDir>/.mindrian/
 * auto-explore-*.json marker, the shipped Phase 117 side-channel) supplies
 * the real brain_framework_chain companion, so the Brain leg is driven
 * through the loopback mock server, never a chainOfferForReach stub.
 *
 * node --test, CJS, node:assert/strict + node:http + node:fs only. No new
 * deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const path = require('node:path');
const { test, before, after, beforeEach } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
const CHAIN_RECOMMENDER_PATH = path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs');
const SENSORS_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs');

// ---------------------------------------------------------------------------
// Mutable-status mock server (same shape as test-c8j-chain-consumer.cjs).
// ---------------------------------------------------------------------------
const state = { toolResponses: {}, captured: [] };

function startMockServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
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
        const name = parsed.params && parsed.params.name;
        const args = (parsed.params && parsed.params.arguments) || {};
        state.captured.push({ name, arguments: args });

        const configured = state.toolResponses[name];
        const payload = (configured && configured.body !== undefined) ? configured.body : { ok: true };
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(
          'data: ' +
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
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

// key: string -> that key. undefined -> a test key. null -> deletes the env var.
function freshSensorsTool(url, key) {
  process.env.MINDRIAN_BRAIN_URL = url;
  if (key === null) {
    delete process.env.MINDRIAN_BRAIN_KEY;
  } else {
    process.env.MINDRIAN_BRAIN_KEY = key === undefined ? 'test-key-not-real' : key;
  }
  delete require.cache[BRAIN_CLIENT_PATH];
  delete require.cache[CHAIN_RECOMMENDER_PATH];
  delete require.cache[SENSORS_PATH];
  return require(SENSORS_PATH);
}

function makeRoomWithFiredMaterial() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-c8j-suggest-next-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  // SENS-01's signal source: any fresh <roomDir>/.mindrian/auto-explore-*.json
  // fire marker (Phase 117 substrate). No session_id -> isMarkerOwnedByCaller
  // fails open, so this fires for any caller session (lib/core/insight-
  // sensors.cjs deriveTurnSignals). Yields ONE fired reach (context_block)
  // carrying companions ['brain_framework_chain:undefined', 'whitespace'] --
  // problemTypeOf(tuple) is always 'undefined' through the bare MCP pull
  // (buildSensorInputs hardcodes tuple = {}).
  fs.writeFileSync(path.join(dir, '.mindrian', 'auto-explore-c8j-test.json'), JSON.stringify({ fired: true }));
  return dir;
}

function makeEmptyRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-c8j-suggest-next-empty-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

function fakeMcpServer() {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _desc, schemaOrHandler, maybeHandler) {
        const handler = typeof maybeHandler === 'function' ? maybeHandler : schemaOrHandler;
        registered.push({ name, handler });
      },
      server: { getClientCapabilities() { return {}; } },
    },
  };
}

function registerAndGetSuggestNext(sensorsTool, roomDir) {
  const fake = fakeMcpServer();
  sensorsTool.register(fake.server, { fallbackRoomDir: roomDir });
  const suggestNext = fake.registered.find((r) => r.name === 'suggest_next');
  assert.ok(suggestNext, 'suggest_next must register through the REAL register()');
  return suggestNext.handler;
}

let mockServer;
let mockUrl;
let prevActiveRoom;

before(async () => {
  const started = await startMockServer();
  mockServer = started.server;
  mockUrl = started.url;
});

after(async () => {
  await new Promise((resolve) => mockServer.close(resolve));
});

beforeEach(() => {
  state.toolResponses = {};
  state.captured = [];
  prevActiveRoom = process.env.CLAUDE_ACTIVE_ROOM;
});

function restoreActiveRoom() {
  if (prevActiveRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM;
  else process.env.CLAUDE_ACTIVE_ROOM = prevActiveRoom;
}

// ---------------------------------------------------------------------------
// Leg 1: companion + reachable Brain -> chain_offer.grounded === true.
// ---------------------------------------------------------------------------
test('Leg 1: top reach carries the companion and the Brain is reachable -> chain_offer.grounded === true, non-empty chain', async () => {
  const dir = makeRoomWithFiredMaterial();
  process.env.CLAUDE_ACTIVE_ROOM = dir;
  try {
    state.toolResponses.recommend_chain = {
      body: {
        tool: 'recommend_chain',
        grounded: true,
        problem_type: 'Undefined Problem',
        chain: [{ step: 1, framework: 'Beautiful Question Framework', pagerank: 0.9, edge_confidence: 0.8, commands: [] }],
        note: null,
      },
    };
    const sensorsTool = freshSensorsTool(mockUrl);
    const handler = registerAndGetSuggestNext(sensorsTool, dir);
    const payload = JSON.parse((await handler({}, { sessionId: 's-c8j-1' })).content[0].text);

    assert.strictEqual(payload.ok, true);
    assert.ok(payload.suggestion, 'a candidate reach must have fired');
    assert.ok(payload.chain_offer, 'chain_offer must be present');
    assert.strictEqual(payload.chain_offer.grounded, true);
    assert.ok(Array.isArray(payload.chain_offer.chain) && payload.chain_offer.chain.length > 0);
  } finally {
    restoreActiveRoom();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 2: companion + no key -> chain_offer.grounded === false, ok:true,
// suggestion intact.
// ---------------------------------------------------------------------------
test('Leg 2: top reach carries the companion, Brain unreachable/keyless -> grounded:false, ok:true, suggestion intact', async () => {
  const dir = makeRoomWithFiredMaterial();
  process.env.CLAUDE_ACTIVE_ROOM = dir;
  // Full ladder isolation (mirrors test-c8j-brain-wire.cjs Leg 8): a fresh
  // tmp HOME + temporary chdir so no real key resolves out from under the
  // test (this repo carries a real <cwd>/.env and this machine a real
  // ~/.mindrian.env).
  const prevDisable = process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
  const prevHome = process.env.HOME;
  const prevCwd = process.cwd();
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'test-c8j-sn-nokeyhome-'));
  process.env.MINDRIAN_DISABLE_AUTO_REGISTER = '1';
  process.env.HOME = tmpHome;
  process.chdir(tmpHome);
  try {
    const sensorsTool = freshSensorsTool(mockUrl, null);
    const handler = registerAndGetSuggestNext(sensorsTool, dir);
    const payload = JSON.parse((await handler({}, { sessionId: 's-c8j-2' })).content[0].text);

    assert.strictEqual(payload.ok, true);
    assert.ok(payload.suggestion, 'suggestion must stay intact when the Brain is down');
    assert.ok(payload.chain_offer, 'chain_offer must still be present (a disclosure, not an omission)');
    assert.strictEqual(payload.chain_offer.grounded, false);
    assert.strictEqual(typeof payload.chain_offer.note, 'string');
  } finally {
    process.chdir(prevCwd);
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
    if (prevDisable === undefined) delete process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
    else process.env.MINDRIAN_DISABLE_AUTO_REGISTER = prevDisable;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    restoreActiveRoom();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 3: no companion -> chain_offer absent entirely (omit-when-absent).
// ---------------------------------------------------------------------------
test('Leg 3: top reach carries NO brain_framework_chain companion -> chain_offer key is absent entirely', async () => {
  // "the data pipeline is the bottleneck" fires context_block via the
  // text-driven SENS path (no auto-explore marker), which carries NO
  // brain_framework_chain companion.
  const dir = makeEmptyRoom();
  process.env.CLAUDE_ACTIVE_ROOM = dir;
  try {
    const sensorsTool = freshSensorsTool(mockUrl);
    const handler = registerAndGetSuggestNext(sensorsTool, dir);
    const payload = JSON.parse(
      (await handler({ user_text: 'the data pipeline is the bottleneck' }, { sessionId: 's-c8j-3' })).content[0].text
    );

    assert.ok(payload.suggestion, 'a candidate reach must have fired for this leg to be meaningful');
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(payload, 'chain_offer'),
      false,
      'chain_offer must be omitted entirely, not present-as-null'
    );
    assert.strictEqual(state.captured.length, 0, 'no companion -> zero Brain calls');
  } finally {
    restoreActiveRoom();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 4: no candidate reach fired -> unchanged payload, zero Brain calls.
// ---------------------------------------------------------------------------
test('Leg 4: no candidate reach fired -> unchanged payload, zero Brain calls', async () => {
  const dir = makeEmptyRoom();
  process.env.CLAUDE_ACTIVE_ROOM = dir;
  try {
    const sensorsTool = freshSensorsTool(mockUrl);
    const handler = registerAndGetSuggestNext(sensorsTool, dir);
    const payload = JSON.parse((await handler({}, { sessionId: 's-c8j-4' })).content[0].text);

    assert.strictEqual(payload.suggestion, null);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(payload, 'chain_offer'),
      false,
      'chain_offer must be absent when nothing fired'
    );
    assert.strictEqual(state.captured.length, 0);
  } finally {
    restoreActiveRoom();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 5: write-free proof -- zero memory_event rows added.
// ---------------------------------------------------------------------------
test('Leg 5: the call performs no room.db write of any kind (zero memory_event rows added)', async () => {
  const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const dir = makeRoomWithFiredMaterial();
  process.env.CLAUDE_ACTIVE_ROOM = dir;
  const db = openRoomDb(dir);
  try {
    const before = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;

    // A divergent commands array -- if the divergence write leg could ever
    // fire on this path (it cannot: suggest_next passes an empty opts
    // object with no db key into chainOfferForReach), this response would
    // trigger it.
    state.toolResponses.recommend_chain = {
      body: {
        tool: 'recommend_chain',
        grounded: true,
        problem_type: 'Undefined Problem',
        chain: [{ step: 1, framework: 'Jobs to Be Done (JTBD)', pagerank: 0.9, edge_confidence: 0.8, commands: ['/mos:totally-different'] }],
        note: null,
      },
    };
    const sensorsTool = freshSensorsTool(mockUrl);
    const handler = registerAndGetSuggestNext(sensorsTool, dir);
    await handler({}, { sessionId: 's-c8j-5' });

    const after = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;
    assert.strictEqual(after, before, 'zero memory_event rows must be added by this call');
  } finally {
    restoreActiveRoom();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 6 (reach_candidates unchanged): no Brain call, no chain_offer.
// ---------------------------------------------------------------------------
test('reach_candidates is unchanged: no Brain call, no chain_offer field, even with a fired companion reach', async () => {
  const dir = makeRoomWithFiredMaterial();
  process.env.CLAUDE_ACTIVE_ROOM = dir;
  try {
    const sensorsTool = freshSensorsTool(mockUrl);
    const fake = fakeMcpServer();
    sensorsTool.register(fake.server, { fallbackRoomDir: dir });
    const reachCandidates = fake.registered.find((r) => r.name === 'reach_candidates');
    assert.ok(reachCandidates);
    const payload = JSON.parse((await reachCandidates.handler({}, { sessionId: 's-c8j-6' })).content[0].text);

    assert.ok(Array.isArray(payload.candidates) && payload.candidates.length > 0);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'chain_offer'), false);
    assert.strictEqual(state.captured.length, 0, 'reach_candidates must never touch the Brain');
  } finally {
    restoreActiveRoom();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Static fence: lib/mcp/tools/sensors.cjs has no brain-client require and no
// executable is/ensureAvailable( call.
// ---------------------------------------------------------------------------
test('static fence: lib/mcp/tools/sensors.cjs contains no require of brain-client.cjs and no executable is/ensureAvailable( call', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'), 'utf8');
  // Executable lines only (mirrors tests/test-249-capture-seam.cjs Test 14's
  // discipline): a doctrine comment is allowed to NAME isAvailable()/
  // ensureAvailable() when explaining why the file must not CALL them.
  const executableSrc = src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return t.indexOf('*') !== 0 && t.indexOf('//') !== 0;
    })
    .join('\n');
  assert.ok(!/require\(\s*['"][^'"]*brain-client\.cjs['"]\s*\)/.test(executableSrc), 'must not require brain-client.cjs directly');
  assert.ok(!/\b(?:is|ensure)Available\(/.test(executableSrc), 'must not call isAvailable(/ensureAvailable( directly');
});
