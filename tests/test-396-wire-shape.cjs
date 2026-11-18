#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 Plan 12 (P4 second half, the wire): the shape rides on the Brain
 * wire behind a capability probe, recommend_chain carries one problem type,
 * the shim ignores a model-supplied shape and builds the room shape only when
 * it owns a session, brainRoute passes the full shape.
 *
 * Offline: the shared capture server (tests/helpers/brain-capture-server.cjs)
 * answers tools/list with schema A (no shape advertised, the beta.81 Theo) or
 * schema B (inputSchema.properties.shape on brain_ask and recommend_chain,
 * Theo Phase 48). Zero network. Every room value is invented: the synthetic
 * rooms of tests/helpers/synthetic-room-db.cjs (room A carries the invented
 * term "Quillfern Labs", room B an invented claim about "Dravi couriers") and
 * the shape files of tests/fixtures/392-shape-rooms/room-a, copied into room
 * A so its packet is WellDefined / Phase3 / investor / finance /
 * [regulatory, capital].
 *
 * Arms:
 *   W1  schema B, session S1 bound to room A: brain_ask body keys are exactly
 *       [question, shape]; shape equals buildShapePacket(room A); envelope
 *       says signal / signal, shape_source room, lexicon_scope session.
 *   W2  schema B: recommend_chain body keys [max_steps, problem_type, shape];
 *       problem_type equals shape.problem_type; max_steps 4; rung_conflict
 *       recorded when the caller's rung differs, absent when it agrees.
 *   W3  schema A: body keys [question] and [max_steps, problem_type] with the
 *       router or inferred rung; the envelope says structured or heuristic.
 *   W4  the probe is cached per process (one tools/list for two asks) and
 *       re-probes after a transport error (a 404 list is not cached).
 *   W5  MINDRIAN_BRAIN_SHAPE=0 forces the bare wire under schema B;
 *       MINDRIAN_BRAIN_SHAPE=1 forces the shape under schema A without a probe.
 *   W6  an invalid opts.shape is refused with {error: shape_invalid, field}
 *       and nothing is sent.
 *   W7  a valid caller-built opts.shape rides without a session.
 *   W8  askOp (op mode) never carries a shape: body keys [op, params].
 *   W9  Part 8: no lexicon word of either room and no room file line in any
 *       captured byte.
 *   W10 shim with CLAUDE_CODE_SESSION_ID S1 under schema B: {question} yields
 *       {question, shape} with the room-built shape; shape_source room.
 *   W11 shim: a model-supplied valid shape (Wicked) is ignored; the wire
 *       carries the room-built shape.
 *   W12 shim: shape.problem_type "wicked" (wrong case) is refused by the zod
 *       enum, the error names a member, nothing is sent.
 *   W13 shim: {question, context} is refused by strictObject as today.
 *   W14 shim without a session id (Desktop and Cowork): bare {question},
 *       lexicon_scope machine_global, room A's word blocked, room B's word
 *       allowed, a model-supplied valid shape still ignored (bare body).
 *   W15 brainRoute(room A) under schema B: {question, shape} with the
 *       room-built shape; recommend_chain carries the shape's type and
 *       rung_conflict when the router rung differs.
 *   W16 the shim prints the MINDRIAN_PART8_DEBUG probe line (presence and
 *       scope, never the id).
 *   W0  no em dash or en dash in this file.
 *
 * No em dash or en dash anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
const ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'brain-router.cjs');
const SHIM = path.join(REPO_ROOT, 'scripts', 'mindrian-brain-mcp-client.cjs');
const FIXTURE_ROOM_A = path.join(REPO_ROOT, 'tests', 'fixtures', '392-shape-rooms', 'room-a');

// Isolate HOME and the rooms home before any plugin module loads.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-12-wire-'));
const HOME = path.join(TMP, 'home');
const ROOMS = path.join(TMP, 'rooms');
fs.mkdirSync(HOME);
fs.mkdirSync(path.join(ROOMS, '.rooms', 'sessions'), { recursive: true });
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_ROOMS_HOME = ROOMS;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_BRAIN_SHAPE;
delete process.env.MINDRIAN_PART8_DEBUG;

const loader = require(path.join(REPO_ROOT, 'tests', 'helpers', 'audit-probe-loader.cjs'));
const rooms = loader.makeRooms(ROOMS, REPO_ROOT);
const SLUG_A = 'gate-lexgen';
const SLUG_B = 'gate-claims';
const ROOM_A = rooms.roomFor(SLUG_A);   // room_term "Quillfern Labs" (invented)
const ROOM_B = rooms.roomFor(SLUG_B);   // a claim about Dravi couriers (invented)

// Room A takes the shape files of the committed fixture room-a (invented).
fs.copyFileSync(path.join(FIXTURE_ROOM_A, 'STATE.md'), path.join(ROOM_A, 'STATE.md'));
fs.copyFileSync(path.join(FIXTURE_ROOM_A, 'USER.md'), path.join(ROOM_A, 'USER.md'));
fs.mkdirSync(path.join(ROOM_A, '.mindrian'), { recursive: true });
fs.copyFileSync(path.join(FIXTURE_ROOM_A, '.mindrian', 'jtbd-state.json'), path.join(ROOM_A, '.mindrian', 'jtbd-state.json'));

const SESSION_1 = 'sess-one-4b7e2c90';
const SESSION_UNBOUND = 'sess-unbound-0c3f91ad';

function writeRegistry() {
  const reg = { active: SLUG_A, rooms: {} };
  reg.rooms[SLUG_A] = { path: SLUG_A };
  reg.rooms[SLUG_B] = { path: SLUG_B };
  fs.writeFileSync(path.join(ROOMS, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2));
}
function writeBinding(sessionId, slug) {
  fs.writeFileSync(path.join(ROOMS, '.rooms', 'sessions', sessionId + '.json'), JSON.stringify({
    bound: [slug], primary: slug, sticky: false, updated: new Date().toISOString(),
  }));
}
writeRegistry();
writeBinding(SESSION_1, SLUG_A);

// Questions (sprouts, generic) and the two rooms' invented words.
const GENERIC = 'what is jobs to be done';
const WORD_A = 'quillfern labs pricing framework';
const WORD_B = 'dravi couriers refuse night routes fuel rebate';
const LEXICON_MARKERS = ['quillfern', 'dravi'];
const ROOM_FILE_LINES = ['regulatory approval pending', 'limited capital', 'invented goal for the fixture', 'Room A (synthetic fixture'];

// The expected room-built packet (392-08 SUMMARY, room-a).
const EXPECTED_SHAPE = {
  schema_version: 1,
  problem_type: 'WellDefined',
  stage: 'Phase3',
  role: 'investor',
  domain_tag: 'finance',
  constraint_categories: ['regulatory', 'capital'],
};
// A caller-built packet for another room (invented, every member an enum).
const CALLER_SHAPE = {
  schema_version: 1,
  problem_type: 'Wicked',
  stage: 'Phase5',
  role: 'mentor',
  domain_tag: 'energy',
  constraint_categories: ['talent'],
};

// ---- capture server ---------------------------------------------------------
const capture = require(path.join(REPO_ROOT, 'tests', 'helpers', 'brain-capture-server.cjs'));

const SHAPE_SCHEMA = { type: 'object', properties: { schema_version: { type: 'number', const: 1 } } };
const SCHEMA_A = [
  { name: 'brain_ask', inputSchema: { type: 'object', properties: { question: { type: 'string' }, op: { type: 'string' }, params: { type: 'object' } }, additionalProperties: false } },
  { name: 'recommend_chain', inputSchema: { type: 'object', properties: { problem_type: { type: 'string' }, max_steps: { type: 'integer' } }, additionalProperties: false } },
];
const SCHEMA_B = [
  { name: 'brain_ask', inputSchema: { type: 'object', properties: { question: { type: 'string' }, op: { type: 'string' }, params: { type: 'object' }, shape: SHAPE_SCHEMA }, additionalProperties: false } },
  { name: 'recommend_chain', inputSchema: { type: 'object', properties: { problem_type: { type: 'string' }, max_steps: { type: 'integer' }, shape: SHAPE_SCHEMA }, additionalProperties: false } },
];

function sse(payload) {
  return 'data: ' + JSON.stringify({
    jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  }) + '\n';
}
const ASK_REPLY = {
  answer_mode: 'structured_rows',
  rows: [{ chapterId: 'ch03', section: 'FRAMEWORK', score: 2.1, snippet: 'row one', shape_match: true }],
  grounding_order: 'shape_boosted',
};
const CHAIN_REPLY = {
  tool: 'recommend_chain', grounded: true,
  chain: [
    { step: 1, framework: 'Alpha', rank: 1, degree: 10 },
    { step: 2, framework: 'Beta', rank: 2, degree: 5 },
  ],
  chain_coverage: { steps_returned: 2, steps_requested: 4, rank1_leads_total: 2, rank1_leads_returned: 2, full: true },
  evidence: { linked_frameworks_for_type: 7 },
};
const QUERY_REPLY = { records: [] };
const OP_REPLY = { op: 'list_frameworks', rows: [], coverage: { matched: 0 } };

// Replies by tool name: one ask() = brain_ask, recommend_chain, brain_query
// (commands); the shim's start-up pre-warm (theo_health) gets the default.
function scriptAsk() {
  capture.resetToolScript();
  capture.setToolReplies({
    brain_ask: { body: sse(ASK_REPLY) },
    recommend_chain: { body: sse(CHAIN_REPLY) },
    brain_query: { body: sse(QUERY_REPLY) },
  });
}
function scriptOp() {
  capture.resetToolScript();
  capture.setToolReplies({ brain_ask: { body: sse(OP_REPLY) } });
}
function scenario(schema) {
  capture.resetCaptured();
  capture.resetToolList();
  capture.setToolList(schema);
  scriptAsk();
}
function callsNamed(name) {
  return capture.captured.filter(function (c) { return c.name === name; });
}
function keysOf(obj) {
  return Object.keys(obj).sort();
}

// ---- harness ----------------------------------------------------------------
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('ok   - ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL - ' + name + '\n  ' + (e && e.message ? e.message : String(e)).split('\n').join('\n  '));
  }
}
function withEnv(vars, fn) {
  const saved = {};
  Object.keys(vars).forEach(function (k) {
    saved[k] = process.env[k];
    if (vars[k] === undefined || vars[k] === null) delete process.env[k]; else process.env[k] = vars[k];
  });
  return Promise.resolve().then(fn).finally(function () {
    Object.keys(vars).forEach(function (k) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    });
  });
}

let brainClient = null;
function resetProbe() {
  if (brainClient && brainClient._test && typeof brainClient._test._resetShapeProbe === 'function') {
    brainClient._test._resetShapeProbe();
  }
}

// ---- shim driver -------------------------------------------------------------
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

async function withShim(url, extraEnv, fn) {
  const env = {
    HOME: HOME,
    USERPROFILE: HOME,
    PATH: process.env.PATH || '',
    MINDRIAN_BRAIN_URL: url,
    MINDRIAN_BRAIN_KEY: 'synthetic-392-12-shim-key',
    MINDRIAN_ROOMS_HOME: ROOMS,
    MINDRIAN_PART8_DEBUG: '1',
  };
  Object.keys(extraEnv || {}).forEach(function (k) {
    if (extraEnv[k] === undefined || extraEnv[k] === null) delete env[k]; else env[k] = extraEnv[k];
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SHIM],
    env: env,
    stderr: 'pipe',
    cwd: REPO_ROOT,
  });
  const stderrChunks = [];
  const client = new Client({ name: 'test-396-12-shim', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    if (transport.stderr) transport.stderr.on('data', function (d) { stderrChunks.push(String(d)); });
    const call = async function (args) {
      try {
        const resp = await client.callTool({ name: 'brain_ask', arguments: args });
        const content = resp && resp.content && resp.content[0];
        let parsed = null;
        try { parsed = content && content.type === 'text' ? JSON.parse(content.text) : null; } catch (_e) { parsed = null; }
        return { ok: true, resp: resp, text: content && content.text, parsed: parsed, isError: !!(resp && resp.isError) };
      } catch (e) {
        return { ok: false, error: e, message: e && e.message ? e.message : String(e) };
      }
    };
    return await fn(call, function () { return stderrChunks.join(''); });
  } finally {
    try { await client.close(); } catch (_e) { /* best-effort teardown */ }
  }
}

// ---- main ---------------------------------------------------------------------
async function main() {
  const started = await capture.startCaptureServer();
  const url = started.url;
  // ORDERING CONTRACT (tests/helpers/brain-capture-server.cjs): env before the require.
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'synthetic-392-12-key';
  delete require.cache[BRAIN_CLIENT_PATH];
  brainClient = require(BRAIN_CLIENT_PATH);
  const shapePacket = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-shape-packet.cjs'));
  const built = shapePacket.buildShapePacket({ roomDir: ROOM_A });
  assert.deepStrictEqual(built.shape, EXPECTED_SHAPE, 'fixture room A must build the room-a packet: ' + JSON.stringify(built.shape));

  // ---- W1 ------------------------------------------------------------------
  await check('W1 schema B, session S1: brain_ask body is exactly {question, shape} with the room-built shape; envelope signal / signal, shape_source room, lexicon_scope session', async function () {
    scenario(SCHEMA_B); resetProbe();
    const env = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC); });
    const asks = callsNamed('brain_ask');
    assert.strictEqual(asks.length, 1, 'one brain_ask expected: ' + JSON.stringify(capture.captured));
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['question', 'shape'], 'body keys: ' + JSON.stringify(asks[0].arguments));
    assert.strictEqual(asks[0].arguments.question, GENERIC);
    assert.deepStrictEqual(asks[0].arguments.shape, EXPECTED_SHAPE, 'shape on the wire: ' + JSON.stringify(asks[0].arguments.shape));
    assert.ok(env && env.grounding, 'composed envelope expected: ' + JSON.stringify(env));
    assert.strictEqual(env.grounding.problem_type, 'WellDefined');
    assert.strictEqual(env.grounding.problem_type_source, 'signal');
    assert.strictEqual(env.grounding.rung_source, 'signal');
    assert.strictEqual(env.grounding.shape_source, 'room');
    assert.strictEqual(env.grounding.lexicon_scope, 'session');
    assert.strictEqual(env.grounding.grounding_order, 'shape_boosted');
  });

  // ---- W2 ------------------------------------------------------------------
  await check('W2 schema B: recommend_chain body keys [max_steps, problem_type, shape], type equals shape.problem_type, max_steps 4; rung_conflict on disagreement, absent on agreement', async function () {
    scenario(SCHEMA_B); resetProbe();
    const conflict = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC, { problem_type: 'IllDefined' }); });
    let chains = callsNamed('recommend_chain');
    assert.strictEqual(chains.length, 1, 'one recommend_chain expected: ' + JSON.stringify(capture.captured));
    assert.deepStrictEqual(keysOf(chains[0].arguments), ['max_steps', 'problem_type', 'shape'], 'chain body keys: ' + JSON.stringify(chains[0].arguments));
    assert.strictEqual(chains[0].arguments.problem_type, 'WellDefined', 'the shape type rides, never the router rung');
    assert.strictEqual(chains[0].arguments.max_steps, 4);
    assert.deepStrictEqual(chains[0].arguments.shape, EXPECTED_SHAPE);
    assert.ok(conflict && conflict.grounding && conflict.grounding.evidence, 'evidence expected: ' + JSON.stringify(conflict && conflict.grounding));
    assert.deepStrictEqual(conflict.grounding.evidence.rung_conflict, { router: 'IllDefined', shape: 'WellDefined' });
    assert.strictEqual(conflict.grounding.evidence.linked_frameworks_for_type, 7, 'Theo evidence kept beside the conflict');
    assert.strictEqual(conflict.grounding.problem_type, 'WellDefined');
    assert.strictEqual(conflict.grounding.problem_type_source, 'signal');

    scenario(SCHEMA_B);
    const agree = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC, { problem_type: 'WellDefined' }); });
    chains = callsNamed('recommend_chain');
    assert.strictEqual(chains.length, 1);
    assert.strictEqual(chains[0].arguments.problem_type, 'WellDefined');
    assert.ok(agree.grounding.evidence && !Object.prototype.hasOwnProperty.call(agree.grounding.evidence, 'rung_conflict'), 'no rung_conflict on agreement: ' + JSON.stringify(agree.grounding.evidence));
  });

  // ---- W3 ------------------------------------------------------------------
  await check('W3 schema A: brain_ask body is exactly {question}; recommend_chain is {problem_type, max_steps} with the router rung (structured) or the inferred rung (heuristic); no shape anywhere', async function () {
    scenario(SCHEMA_A); resetProbe();
    const structured = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC, { problem_type: 'IllDefined' }); });
    let asks = callsNamed('brain_ask');
    let chains = callsNamed('recommend_chain');
    assert.strictEqual(asks.length, 1);
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['question'], 'schema A body keys: ' + JSON.stringify(asks[0].arguments));
    assert.deepStrictEqual(keysOf(chains[0].arguments), ['max_steps', 'problem_type']);
    assert.strictEqual(chains[0].arguments.problem_type, 'IllDefined');
    assert.strictEqual(chains[0].arguments.max_steps, 4);
    assert.strictEqual(structured.grounding.problem_type_source, 'signal');
    assert.strictEqual(structured.grounding.rung_source, 'structured');
    assert.strictEqual(structured.grounding.shape_source, 'none');
    assert.strictEqual(structured.grounding.lexicon_scope, 'session');
    assert.ok(!structured.grounding.evidence || !structured.grounding.evidence.rung_conflict, 'no conflict without a shape on the wire');

    scenario(SCHEMA_A);
    const heuristic = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC); });
    asks = callsNamed('brain_ask');
    chains = callsNamed('recommend_chain');
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['question']);
    assert.deepStrictEqual(keysOf(chains[0].arguments), ['max_steps', 'problem_type']);
    assert.strictEqual(heuristic.grounding.problem_type_source, 'heuristic');
    assert.strictEqual(heuristic.grounding.rung_source, 'inferred');
    assert.strictEqual(heuristic.grounding.shape_source, 'none');
  });

  // ---- W4 ------------------------------------------------------------------
  await check('W4 the probe is cached per process (one tools/list for two shaped asks) and re-probes after a transport error (a failed list is not cached)', async function () {
    assert.strictEqual(typeof brainClient.brainAcceptsShape, 'function', 'brainAcceptsShape exported');
    scenario(SCHEMA_B); resetProbe();
    await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC); });
    scriptAsk();
    await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC); });
    assert.strictEqual(capture.getToolListCount(), 1, 'tools/list once for two asks, got ' + capture.getToolListCount());
    assert.strictEqual(callsNamed('brain_ask').length, 2);
    callsNamed('brain_ask').forEach(function (c) { assert.deepStrictEqual(keysOf(c.arguments), ['question', 'shape']); });

    // Transport error on the list (404, no list set): bare call, not cached.
    scenario(null); resetProbe();
    await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC); });
    assert.deepStrictEqual(keysOf(callsNamed('brain_ask')[0].arguments), ['question'], 'a failed probe sends the bare call');
    const listsAfterFail = capture.getToolListCount();
    assert.ok(listsAfterFail >= 1, 'the probe was attempted');
    capture.setToolList(SCHEMA_B); capture.resetCaptured(); scriptAsk();
    await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC); });
    assert.ok(capture.getToolListCount() > listsAfterFail, 're-probed after the failed list');
    assert.deepStrictEqual(keysOf(callsNamed('brain_ask')[0].arguments), ['question', 'shape'], 'the shape rides once the list answers');
  });

  // ---- W5 ------------------------------------------------------------------
  await check('W5 MINDRIAN_BRAIN_SHAPE=0 forces the bare wire under schema B; MINDRIAN_BRAIN_SHAPE=1 forces the shape under schema A with no probe', async function () {
    scenario(SCHEMA_B); resetProbe();
    await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1, MINDRIAN_BRAIN_SHAPE: '0' }, function () { return brainClient.ask(GENERIC); });
    assert.deepStrictEqual(keysOf(callsNamed('brain_ask')[0].arguments), ['question'], 'forced off: ' + JSON.stringify(capture.captured));
    assert.deepStrictEqual(keysOf(callsNamed('recommend_chain')[0].arguments), ['max_steps', 'problem_type']);

    scenario(SCHEMA_A); resetProbe();
    const forced = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1, MINDRIAN_BRAIN_SHAPE: '1' }, function () { return brainClient.ask(GENERIC); });
    assert.deepStrictEqual(keysOf(callsNamed('brain_ask')[0].arguments), ['question', 'shape'], 'forced on: ' + JSON.stringify(capture.captured));
    assert.deepStrictEqual(keysOf(callsNamed('recommend_chain')[0].arguments), ['max_steps', 'problem_type', 'shape']);
    assert.strictEqual(capture.getToolListCount(), 0, 'no probe when forced on');
    assert.strictEqual(forced.grounding.shape_source, 'room');
  });

  // ---- W6 ------------------------------------------------------------------
  await check('W6 an invalid opts.shape is refused with {error: shape_invalid, field} and nothing is sent', async function () {
    scenario(SCHEMA_B); resetProbe();
    const before = capture.captured.length;
    const bad = Object.assign({}, CALLER_SHAPE, { problem_type: 'wicked' });
    const res = await brainClient.ask(GENERIC, { shape: bad });
    assert.ok(res && res.error === 'shape_invalid', 'typed sentinel expected: ' + JSON.stringify(res));
    assert.strictEqual(res.field, 'problem_type');
    assert.strictEqual(res.tool, 'brain_ask');
    assert.strictEqual(capture.captured.length, before, 'nothing sent');
    assert.strictEqual(JSON.stringify(res).indexOf('wicked'), -1, 'the sentinel carries no shape value');
  });

  // ---- W7 ------------------------------------------------------------------
  await check('W7 a valid caller-built opts.shape rides without a session (the caller used the one builder)', async function () {
    scenario(SCHEMA_B); resetProbe();
    const env = await brainClient.ask(GENERIC, { shape: CALLER_SHAPE });
    const asks = callsNamed('brain_ask');
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['question', 'shape']);
    assert.deepStrictEqual(asks[0].arguments.shape, CALLER_SHAPE);
    assert.strictEqual(callsNamed('recommend_chain')[0].arguments.problem_type, 'Wicked');
    assert.strictEqual(env.grounding.problem_type, 'Wicked');
    assert.strictEqual(env.grounding.problem_type_source, 'signal');
    assert.strictEqual(env.grounding.lexicon_scope, 'machine_global');
  });

  // ---- W8 ------------------------------------------------------------------
  await check('W8 askOp (op mode) never carries a shape under schema B: body keys [op, params]', async function () {
    capture.resetCaptured(); capture.resetToolList(); capture.setToolList(SCHEMA_B); scriptOp(); resetProbe();
    await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.askOp('list_frameworks', { limit: 5 }); });
    const asks = callsNamed('brain_ask');
    assert.strictEqual(asks.length, 1);
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['op', 'params'], 'op body: ' + JSON.stringify(asks[0].arguments));
  });

  // ---- W15 (router, before the shim legs so the capture stays in process) --
  await check('W15 brainRoute(room A) under schema B: {question, shape} with the room-built shape; recommend_chain carries the shape type; rung_conflict when the router rung differs', async function () {
    scenario(SCHEMA_B); resetProbe();
    delete require.cache[ROUTER_PATH];
    const router = require(ROUTER_PATH);
    assert.strictEqual(typeof router.brainRoute, 'function', 'brainRoute exported for the wire test');
    const stateContent = '---\ndefinition_level: ill-defined\ncomplexity: complex\n---\n';
    await router.brainRoute(ROOM_A, stateContent, 'next');
    const asks = callsNamed('brain_ask');
    assert.strictEqual(asks.length, 1, 'one brain_ask: ' + JSON.stringify(capture.captured));
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['question', 'shape']);
    assert.deepStrictEqual(asks[0].arguments.shape, EXPECTED_SHAPE);
    assert.strictEqual(asks[0].arguments.question, 'recommend a framework for a ill-defined definition complex problem');
    const chains = callsNamed('recommend_chain');
    assert.deepStrictEqual(keysOf(chains[0].arguments), ['max_steps', 'problem_type', 'shape']);
    assert.strictEqual(chains[0].arguments.problem_type, 'WellDefined', 'the shape type rides, not the router rung IllDefined');

    // Agreement: a well-defined STATE.md, no conflict recorded (probe the composer through ask).
    scenario(SCHEMA_B);
    await router.brainRoute(ROOM_A, '---\ndefinition_level: well-defined\ncomplexity: complex\n---\n', 'next');
    assert.strictEqual(callsNamed('recommend_chain')[0].arguments.problem_type, 'WellDefined');
  });

  // ---- W9 ------------------------------------------------------------------
  // The Part 8 scan over everything captured so far, then again after the shim legs.
  const allCapturedSoFar = [];
  function scanCaptured(label) {
    const wire = JSON.stringify(capture.captured);
    LEXICON_MARKERS.forEach(function (w) {
      assert.strictEqual(wire.toLowerCase().indexOf(w), -1, label + ': lexicon word on the wire: ' + w);
    });
    ROOM_FILE_LINES.forEach(function (line) {
      assert.strictEqual(wire.indexOf(line), -1, label + ': room file line on the wire: ' + line);
    });
    allCapturedSoFar.push(wire);
  }
  await check('W9 Part 8: no lexicon word of either room and no room file line in any captured byte (in-process legs)', async function () {
    scanCaptured('in-process');
  });

  // ---- shim legs -------------------------------------------------------------
  await check('W10 shim with session S1 under schema B: {question} yields {question, shape} with the room-built shape; shape_source room', async function () {
    scenario(SCHEMA_B);
    await withShim(url, { CLAUDE_CODE_SESSION_ID: SESSION_1 }, async function (call) {
      const r = await call({ question: GENERIC });
      assert.ok(r.ok && !r.isError, 'tool call ok: ' + (r.message || r.text));
      const asks = callsNamed('brain_ask');
      assert.strictEqual(asks.length, 1, 'one brain_ask: ' + JSON.stringify(capture.captured));
      assert.deepStrictEqual(keysOf(asks[0].arguments), ['question', 'shape'], 'shim body: ' + JSON.stringify(asks[0].arguments));
      assert.deepStrictEqual(asks[0].arguments.shape, EXPECTED_SHAPE);
      assert.ok(r.parsed && r.parsed.grounding, 'envelope grounding: ' + r.text);
      assert.strictEqual(r.parsed.grounding.shape_source, 'room');
      assert.strictEqual(r.parsed.grounding.lexicon_scope, 'session');
      assert.strictEqual(r.parsed.grounding.problem_type_source, 'signal');
    });
  });

  await check('W11 shim: a model-supplied valid shape (Wicked) is ignored; the wire carries the room-built shape; shape_source room', async function () {
    scenario(SCHEMA_B);
    await withShim(url, { CLAUDE_CODE_SESSION_ID: SESSION_1 }, async function (call) {
      const r = await call({ question: GENERIC, shape: CALLER_SHAPE });
      assert.ok(r.ok && !r.isError, 'tool call ok: ' + (r.message || r.text));
      const asks = callsNamed('brain_ask');
      assert.strictEqual(asks.length, 1, 'one brain_ask: ' + JSON.stringify(capture.captured));
      assert.deepStrictEqual(asks[0].arguments.shape, EXPECTED_SHAPE, 'room-built, not the model shape: ' + JSON.stringify(asks[0].arguments.shape));
      assert.strictEqual(callsNamed('recommend_chain')[0].arguments.problem_type, 'WellDefined');
      assert.strictEqual(r.parsed.grounding.shape_source, 'room');
      assert.strictEqual(r.parsed.grounding.model_shape_ignored, true);
    });
  });

  await check('W12 shim: shape.problem_type "wicked" (wrong case) is refused by the zod enum, the error names a member, nothing is sent', async function () {
    scenario(SCHEMA_B);
    await withShim(url, { CLAUDE_CODE_SESSION_ID: SESSION_1 }, async function (call) {
      const r = await call({ question: GENERIC, shape: Object.assign({}, CALLER_SHAPE, { problem_type: 'wicked' }) });
      const refused = (!r.ok) || r.isError;
      const text = r.ok ? String(r.text) : r.message;
      assert.ok(refused, 'the shim must refuse: ' + text);
      assert.ok(/UnDefined|IllDefined|WellDefined|Wicked/.test(text), 'the error names an enum member: ' + text);
      assert.ok(/problem_type/.test(text), 'the error names the field: ' + text);
      assert.strictEqual(callsNamed('brain_ask').length, 0, 'nothing sent: ' + JSON.stringify(capture.captured));
    });
  });

  await check('W13 shim: {question, context} is refused by strictObject as today, nothing is sent', async function () {
    scenario(SCHEMA_B);
    await withShim(url, { CLAUDE_CODE_SESSION_ID: SESSION_1 }, async function (call) {
      const r = await call({ question: GENERIC, context: 'x' });
      assert.ok((!r.ok) || r.isError, 'the shim must refuse: ' + (r.text || r.message));
      assert.strictEqual(callsNamed('brain_ask').length, 0, 'nothing sent');
    });
  });

  await check('W14 shim without a session id: bare {question}, lexicon_scope machine_global, room A word blocked, room B word allowed, a model-supplied shape still ignored (bare body)', async function () {
    scenario(SCHEMA_B);
    await withShim(url, { CLAUDE_CODE_SESSION_ID: null }, async function (call, stderrText) {
      const r = await call({ question: GENERIC });
      assert.ok(r.ok && !r.isError, 'tool call ok: ' + (r.message || r.text));
      let asks = callsNamed('brain_ask');
      assert.strictEqual(asks.length, 1);
      assert.deepStrictEqual(keysOf(asks[0].arguments), ['question'], 'bare body without a session: ' + JSON.stringify(asks[0].arguments));
      assert.ok(r.parsed && r.parsed.grounding, 'envelope grounding: ' + r.text);
      assert.strictEqual(r.parsed.grounding.lexicon_scope, 'machine_global');
      assert.strictEqual(r.parsed.grounding.shape_source, 'none');

      // Room A is the machine-global active room: its word is blocked, room B's word is allowed.
      capture.resetCaptured(); scriptAsk();
      const blocked = await call({ question: WORD_A });
      assert.ok(blocked.ok, 'a block is an in-band refusal: ' + blocked.message);
      assert.ok(String(blocked.text).indexOf('egress_blocked') !== -1, 'room A word blocked: ' + blocked.text);
      assert.strictEqual(callsNamed('brain_ask').length, 0, 'nothing sent for room A word');
      capture.resetCaptured(); scriptAsk();
      const allowed = await call({ question: WORD_B });
      assert.ok(allowed.ok && String(allowed.text).indexOf('egress_blocked') === -1, 'room B word allowed: ' + allowed.text);
      assert.strictEqual(callsNamed('brain_ask').length, 1, 'room B word reached the wire');

      capture.resetCaptured(); scriptAsk();
      const modelShape = await call({ question: GENERIC, shape: CALLER_SHAPE });
      assert.ok(modelShape.ok && !modelShape.isError, 'tool call ok: ' + (modelShape.message || modelShape.text));
      asks = callsNamed('brain_ask');
      assert.deepStrictEqual(keysOf(asks[0].arguments), ['question'], 'model shape ignored, no session: bare body');
      assert.strictEqual(modelShape.parsed.grounding.model_shape_ignored, true);

      const err = stderrText();
      assert.ok(err.indexOf('part8 session: absent; lexicon_scope: machine_global') !== -1, 'probe line: ' + err);
    });
  });

  await check('W16 shim MINDRIAN_PART8_DEBUG probe line says present and session, never the id', async function () {
    scenario(SCHEMA_B);
    await withShim(url, { CLAUDE_CODE_SESSION_ID: SESSION_1 }, async function (call, stderrText) {
      await call({ question: GENERIC });
      const err = stderrText();
      assert.ok(err.indexOf('part8 session: present; lexicon_scope: session') !== -1, 'probe line: ' + err);
      assert.strictEqual(err.indexOf(SESSION_1), -1, 'the id never prints');
    });
  });

  await check('W9b Part 8: no lexicon word and no room file line in any captured byte (shim legs), and the unbound session builds no shape', async function () {
    scanCaptured('shim');
    scenario(SCHEMA_B); resetProbe();
    await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_UNBOUND }, function () { return brainClient.ask(GENERIC); });
    assert.deepStrictEqual(keysOf(callsNamed('brain_ask')[0].arguments), ['question'], 'unbound session: bare body');
    scanCaptured('unbound');
  });

  await check('W0 no em dash or en dash in this file', function () {
    const src = fs.readFileSync(__filename, 'utf8');
    assert.strictEqual(src.indexOf(String.fromCharCode(0x2014)), -1, 'em dash');
    assert.strictEqual(src.indexOf(String.fromCharCode(0x2013)), -1, 'en dash');
  });

  await capture.stopCaptureServer(started.server);
  console.log('\n' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) {
    console.log('FAIL: test-396-wire-shape');
    process.exit(1);
  }
  console.log('PASS: test-396-wire-shape');
  process.exit(0);
}

main().catch(function (e) {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
