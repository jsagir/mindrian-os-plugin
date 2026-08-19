#!/usr/bin/env node
'use strict';

/**
 * Quick 260819-c8j (WS-C2 + WS-C3) -- companion consumer (chainOfferForReach)
 * + chain adapter (adaptChainToRunInput) in lib/brain/chain-recommender.cjs.
 * ==========================================================================
 * A local mutable-status loopback mock server (mirrors the established
 * test-247-brain-client-403.cjs / test-249-capture-seam.cjs pattern -- real
 * node:http, no fetch mocking) drives the Brain leg. A real temp room.db
 * (lib/core/room-db.cjs openRoomDb) drives the memory_event legs, mirroring
 * tests/test-249-capture-seam.cjs's Test 9 pattern.
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

function freshRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-c8j-chain-consumer-'));
}

// ---------------------------------------------------------------------------
// Mutable-status mock server. state.toolResponses[toolName] controls the
// tools/call response for that tool: { status?: number, body?: object } for
// non-200, or a plain object treated as the 200 success payload. Absent ->
// 200 { ok: true }. captured records every tools/call { name, arguments }.
// ---------------------------------------------------------------------------
const state = {
  initMode: 'ok', // 'ok' | 'closed' (network-failure leg uses a separately closed server)
  toolResponses: {},
  captured: [],
};

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

        if (configured && configured.status === 403) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: -32003, name: 'MoatViolation', message: 'denied' } }));
          return;
        }
        if (configured && configured.status === 401) {
          // 401 only makes sense at initialize in the real client, but this
          // mock keeps the branch for completeness / documentation parity.
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid key' }));
          return;
        }

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

function freshModules(url, key) {
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = key === undefined ? 'test-key-not-real' : key;
  if (key === null) delete process.env.MINDRIAN_BRAIN_KEY;
  delete require.cache[BRAIN_CLIENT_PATH];
  delete require.cache[CHAIN_RECOMMENDER_PATH];
  const chainRecommender = require(CHAIN_RECOMMENDER_PATH);
  return chainRecommender;
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
  state.toolResponses = {};
  state.captured = [];
});

// ---------------------------------------------------------------------------
// parseChainCompanions
// ---------------------------------------------------------------------------

test('parseChainCompanions: reach null / not an object / no companions array -> []', () => {
  const cr = freshModules(mockUrl);
  assert.deepStrictEqual(cr.parseChainCompanions(null), []);
  assert.deepStrictEqual(cr.parseChainCompanions('not an object'), []);
  assert.deepStrictEqual(cr.parseChainCompanions({}), []);
  assert.deepStrictEqual(cr.parseChainCompanions({ companions: 'not an array' }), []);
});

test('parseChainCompanions: extracts the handle and ignores a bare non-matching companion', () => {
  const cr = freshModules(mockUrl);
  const reach = { companions: ['brain_framework_chain:Undefined Problem', 'whitespace'] };
  assert.deepStrictEqual(cr.parseChainCompanions(reach), ['Undefined Problem']);
});

test('parseChainCompanions: a third segment (methodology-decision producer) is read and ignored, not acted on', () => {
  const cr = freshModules(mockUrl);
  const reach = { companions: ['brain_framework_chain:IDP:SWOT Analysis'] };
  assert.deepStrictEqual(cr.parseChainCompanions(reach), ['IDP']);
});

test('parseChainCompanions: duplicates collapse, first-seen order preserved', () => {
  const cr = freshModules(mockUrl);
  const reach = {
    companions: [
      'brain_framework_chain:Undefined Problem',
      'brain_framework_chain:Ill-Defined Problem',
      'brain_framework_chain:Undefined Problem',
    ],
  };
  assert.deepStrictEqual(cr.parseChainCompanions(reach), ['Undefined Problem', 'Ill-Defined Problem']);
});

test('parseChainCompanions: bare handle with no second segment is skipped', () => {
  const cr = freshModules(mockUrl);
  const reach = { companions: ['brain_framework_chain', 'brain_framework_chain:'] };
  assert.deepStrictEqual(cr.parseChainCompanions(reach), []);
});

// ---------------------------------------------------------------------------
// chainOfferForReach
// ---------------------------------------------------------------------------

test('chainOfferForReach: no companion -> null (nothing to offer, no Brain touch)', async () => {
  const cr = freshModules(mockUrl);
  const offer = await cr.chainOfferForReach({ companions: [] }, {});
  assert.strictEqual(offer, null);
  assert.strictEqual(state.captured.length, 0);
});

test('chainOfferForReach: companion present, Brain unavailable (no key) -> grounded:false disclosure, note brain_unavailable', async () => {
  // Full ladder isolation (mirrors tests/test-250-silent-registration.cjs and
  // tests/test-c8j-brain-wire.cjs Leg 8): a fresh tmp HOME with no
  // .mindrian.env / .mindrian-install.json, and a temporary chdir so
  // <cwd>/.env (this repo carries a real one) cannot resolve a real key out
  // from under the test.
  const prevDisable = process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
  const prevHome = process.env.HOME;
  const prevCwd = process.cwd();
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'test-c8j-nokeyhome-'));
  process.env.MINDRIAN_DISABLE_AUTO_REGISTER = '1';
  process.env.HOME = tmpHome;
  process.chdir(tmpHome);
  try {
    const cr = freshModules(mockUrl, null);
    const offer = await cr.chainOfferForReach({ companions: ['brain_framework_chain:Undefined Problem'] }, {});
    assert.ok(offer, 'must return a disclosure object, never null, when a companion is present');
    assert.strictEqual(offer.grounded, false);
    assert.strictEqual(offer.note, 'brain_unavailable');
    assert.strictEqual(offer.problem_type, 'Undefined Problem');
    assert.strictEqual(state.captured.length, 0, 'no Brain call when isAvailable() is false');
  } finally {
    process.chdir(prevCwd);
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
    if (prevDisable === undefined) delete process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
    else process.env.MINDRIAN_DISABLE_AUTO_REGISTER = prevDisable;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('chainOfferForReach: companion present, transport null -> disclosure note brain_unreachable', async () => {
  const { server, port } = await startMockServer();
  await new Promise((resolve) => server.close(resolve));
  const cr = freshModules('http://127.0.0.1:' + port);
  const offer = await cr.chainOfferForReach({ companions: ['brain_framework_chain:Undefined Problem'] }, {});
  assert.strictEqual(offer.grounded, false);
  assert.strictEqual(offer.note, 'brain_unreachable');
});

test('chainOfferForReach: companion present, tier_denied sentinel -> disclosure note carries the sentinel token', async () => {
  const cr = freshModules(mockUrl);
  state.toolResponses.recommend_chain = { status: 403 };
  const offer = await cr.chainOfferForReach({ companions: ['brain_framework_chain:Undefined Problem'] }, {});
  assert.strictEqual(offer.grounded, false);
  assert.strictEqual(offer.note, 'tier_denied');
});

test('chainOfferForReach: companion present, unknown problem type (grounded:false, empty chain) -> note unknown_problem_type', async () => {
  const cr = freshModules(mockUrl);
  state.toolResponses.recommend_chain = { body: { tool: 'recommend_chain', grounded: false, chain: [] } };
  const offer = await cr.chainOfferForReach({ companions: ['brain_framework_chain:adoption-capacity'] }, {});
  assert.strictEqual(offer.grounded, false);
  assert.strictEqual(offer.note, 'unknown_problem_type');
});

test('chainOfferForReach: Brain answers -> grounded offer carrying chain + chain_input + unmapped_count', async () => {
  const cr = freshModules(mockUrl);
  state.toolResponses.recommend_chain = {
    body: {
      tool: 'recommend_chain',
      grounded: true,
      problem_type: 'Undefined Problem',
      chain: [
        { step: 1, framework: 'Jobs to Be Done (JTBD)', pagerank: 0.9, edge_confidence: 0.8, commands: ['/mos:jtbd'] },
      ],
      note: null,
    },
  };
  const offer = await cr.chainOfferForReach({ companions: ['brain_framework_chain:Undefined Problem'] }, {});
  assert.strictEqual(offer.grounded, true);
  assert.strictEqual(offer.problem_type, 'Undefined Problem');
  assert.deepStrictEqual(offer.chain, state.toolResponses.recommend_chain.body.chain);
  assert.deepStrictEqual(offer.chain_input, ['Jobs to Be Done (JTBD)']);
  assert.strictEqual(offer.unmapped_count, 0);
});

test('chainOfferForReach: exactly ONE Brain recommend_chain call per invocation (only the first companion is consulted)', async () => {
  const cr = freshModules(mockUrl);
  state.toolResponses.recommend_chain = { body: { tool: 'recommend_chain', grounded: false, chain: [] } };
  await cr.chainOfferForReach(
    { companions: ['brain_framework_chain:Undefined Problem', 'brain_framework_chain:Ill-Defined Problem'] },
    {}
  );
  const calls = state.captured.filter((c) => c.name === 'recommend_chain');
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].arguments.problem_type, 'Undefined Problem');
});

test('chainOfferForReach: never throws (malformed reach input)', async () => {
  const cr = freshModules(mockUrl);
  await assert.doesNotReject(async () => {
    await cr.chainOfferForReach(undefined, {});
  });
  await assert.doesNotReject(async () => {
    await cr.chainOfferForReach({ companions: [42, null, {}] }, {});
  });
});

// ---------------------------------------------------------------------------
// adaptChainToRunInput
// ---------------------------------------------------------------------------

test('adaptChainToRunInput: chain order preserved, one output name per input step', async () => {
  const cr = freshModules(mockUrl);
  const brainChain = [
    { step: 1, framework: 'Jobs to Be Done (JTBD)', commands: ['/mos:jtbd'] },
    { step: 2, framework: 'Systems Thinking', commands: [] },
  ];
  const result = await cr.adaptChainToRunInput(brainChain, {});
  assert.deepStrictEqual(result.chain_input, ['Jobs to Be Done (JTBD)', 'Systems Thinking']);
});

test('adaptChainToRunInput: a locally-known framework passes through with zero normalize calls', async () => {
  const cr = freshModules(mockUrl);
  const brainChain = [{ step: 1, framework: 'Jobs to Be Done (JTBD)' }];
  await cr.adaptChainToRunInput(brainChain, {});
  const normCalls = state.captured.filter((c) => c.name === 'normalize_framework_name');
  assert.strictEqual(normCalls.length, 0);
});

test('adaptChainToRunInput: a locally-missing framework triggers exactly ONE normalizeFrameworkName call; a hit uses the normalized name', async () => {
  const cr = freshModules(mockUrl);
  state.toolResponses.normalize_framework_name = { body: { canonical: 'Jobs to Be Done (JTBD)' } };
  const brainChain = [{ step: 1, framework: 'JTBD (typo)' }];
  const result = await cr.adaptChainToRunInput(brainChain, {});
  const normCalls = state.captured.filter((c) => c.name === 'normalize_framework_name');
  assert.strictEqual(normCalls.length, 1);
  assert.strictEqual(normCalls[0].arguments.raw, 'JTBD (typo)');
  assert.deepStrictEqual(result.chain_input, ['Jobs to Be Done (JTBD)']);
  assert.deepStrictEqual(result.unmapped, []);
});

test('adaptChainToRunInput: still-unmapped after retry keeps the ORIGINAL name and reports it in unmapped', async () => {
  const cr = freshModules(mockUrl);
  state.toolResponses.normalize_framework_name = { body: { canonical: 'Still Not A Real Framework' } };
  const brainChain = [{ step: 1, framework: 'Not A Real Framework At All' }];
  const result = await cr.adaptChainToRunInput(brainChain, {});
  assert.deepStrictEqual(result.chain_input, ['Not A Real Framework At All']);
  assert.deepStrictEqual(result.unmapped, ['Not A Real Framework At All']);
});

test('adaptChainToRunInput: divergence recorded when local and Brain commands differ (data only, no reconciliation)', async () => {
  const cr = freshModules(mockUrl);
  const brainChain = [{ step: 1, framework: 'Jobs to Be Done (JTBD)', commands: ['/mos:totally-different-command'] }];
  const result = await cr.adaptChainToRunInput(brainChain, {});
  assert.strictEqual(result.divergences.length, 1);
  assert.strictEqual(result.divergences[0].framework, 'Jobs to Be Done (JTBD)');
  assert.deepStrictEqual(result.divergences[0].brain_commands, ['/mos:totally-different-command']);
  assert.ok(result.divergences[0].local_commands.includes('/mos:jtbd'));
  // The local resolution wins in chain_input -- the Brain's commands never
  // become the output; only the framework NAME does (fence 4: no command
  // literal ever written here, and the local resolver stays authoritative).
  assert.deepStrictEqual(result.chain_input, ['Jobs to Be Done (JTBD)']);
});

test('adaptChainToRunInput: never computes or returns autonomous_safe', async () => {
  const cr = freshModules(mockUrl);
  const brainChain = [{ step: 1, framework: 'Jobs to Be Done (JTBD)', commands: ['/mos:totally-different'] }];
  const result = await cr.adaptChainToRunInput(brainChain, {});
  assert.strictEqual(JSON.stringify(result).includes('autonomous_safe'), false);
});

test('adaptChainToRunInput: with opts.db, a divergence writes ONE brain_cmdmap_divergence memory_event', async () => {
  const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const cr = freshModules(mockUrl);
  const roomDir = freshRoom();
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);

  const brainChain = [{ step: 1, framework: 'Jobs to Be Done (JTBD)', commands: ['/mos:totally-different'] }];
  await cr.adaptChainToRunInput(brainChain, { db });

  const row = db.prepare(
    "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'brain_cmdmap_divergence' LIMIT 1"
  ).get();
  assert.ok(row, 'a brain_cmdmap_divergence memory_event must have been logged');
  const props = JSON.parse(row.properties);
  assert.equal(props.framework, 'Jobs to Be Done (JTBD)');
  assert.equal(typeof props.brain_command_count, 'number');
  assert.equal(typeof props.local_command_count, 'number');
});

test('adaptChainToRunInput: WITHOUT opts.db, zero writes and the divergences still return as data', async () => {
  const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const cr = freshModules(mockUrl);
  const roomDir = freshRoom();
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir); // opened only to prove zero rows land, never passed to the adapter

  const brainChain = [{ step: 1, framework: 'Jobs to Be Done (JTBD)', commands: ['/mos:totally-different'] }];
  const result = await cr.adaptChainToRunInput(brainChain, {}); // no db in opts

  assert.strictEqual(result.divergences.length, 1, 'the divergence is still returned as data');
  const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get();
  assert.equal(row.n, 0, 'zero memory_event rows without opts.db');
});

test('adaptChainToRunInput: a repeat divergence inside 60s dedupes via dedupe_key', async () => {
  const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const cr = freshModules(mockUrl);
  const roomDir = freshRoom();
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);

  const brainChain = [{ step: 1, framework: 'Jobs to Be Done (JTBD)', commands: ['/mos:totally-different'] }];
  await cr.adaptChainToRunInput(brainChain, { db });
  await cr.adaptChainToRunInput(brainChain, { db });

  const row = db.prepare(
    "SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'brain_cmdmap_divergence'"
  ).get();
  assert.equal(row.n, 1, 'a repeat within the 60s TTL must dedupe to a single row');
});
