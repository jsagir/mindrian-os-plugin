#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 Plan 13, loop check L1 (PLAN.md section 5): the wire carries only
 * the generic question plus the closed-vocabulary shape. Theo receives
 * {question, shape} on a shaped call and {question} on a bare call; the
 * captured bytes hold no room lexicon word and no credential shape, through
 * the shim and in process.
 *
 * Offline: the shared capture server (tests/helpers/brain-capture-server.cjs)
 * advertises schema B (inputSchema.properties.shape on brain_ask and
 * recommend_chain, Theo Phase 48) and answers every tool by name. Zero
 * network. Every room value is invented: the synthetic rooms of
 * tests/helpers/synthetic-room-db.cjs (room A carries the invented term
 * "Quillfern Labs" and its lexicon is read through loadRoomLexicon) and the
 * shape files of tests/fixtures/392-shape-rooms/room-a (invented enum values).
 *
 * Arms:
 *   L1-1 in process, session S1 bound to room A, schema B: the brain_ask body
 *        keys are exactly [question, shape]; the shape validates against the
 *        closed vocabulary; recommend_chain carries the same shape.
 *   L1-2 bare call (MINDRIAN_BRAIN_SHAPE=0): body keys exactly [question].
 *   L1-3 bytes: JSON.stringify of every captured record holds none of room
 *        A's lexicon entries (case-insensitive) and matches none of
 *        CREDENTIAL_SHAPES (lib/core/cross-room-aggregator.cjs).
 *   L1-4 belt: ask(question with a lexicon word) sends nothing and answers
 *        the typed egress_blocked sentinel.
 *   L1-5 shim with CLAUDE_CODE_SESSION_ID S1: brain_ask(generic) yields the
 *        same [question, shape] body; brain_ask(lexicon word) yields zero
 *        captured records and the honest egress_blocked envelope.
 *   L1-6 shim without a session id: the body is bare [question] (plan 392-12
 *        option a); the same byte assertions.
 *   L1-7 the byte scan again over every record of every arm.
 *   L1-0 no em dash or en dash in this file.
 *
 * RED proof (plan 392-13 Task 1): MOS392_GUARD_ROOT=<git archive export of
 * tag v2.0.0-beta.81> loads lib/ and scripts/ from the export (the
 * --guard-root style of tests/helpers/audit-probe-loader.cjs); the shape key
 * assertion of L1-1 fails there because beta.81 sends {question} only.
 * The validator (lib/core/brain-shape-packet.cjs) and the test helpers are
 * always read from this repository.
 *
 * No em dash or en dash anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_ROOT = process.env.MOS392_GUARD_ROOT ? path.resolve(process.env.MOS392_GUARD_ROOT) : REPO_ROOT;
const BRAIN_CLIENT_PATH = path.join(GUARD_ROOT, 'lib', 'core', 'brain-client.cjs');
const SHIM = path.join(GUARD_ROOT, 'scripts', 'mindrian-brain-mcp-client.cjs');
const FIXTURE_ROOM_A = path.join(REPO_ROOT, 'tests', 'fixtures', '392-shape-rooms', 'room-a');

// Isolate HOME and the rooms home before any plugin module loads.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-13-l1-'));
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
rooms.roomFor(SLUG_B);                  // a second room so the registry has two

// Room A takes the shape files of the committed fixture room-a (invented).
fs.copyFileSync(path.join(FIXTURE_ROOM_A, 'STATE.md'), path.join(ROOM_A, 'STATE.md'));
fs.copyFileSync(path.join(FIXTURE_ROOM_A, 'USER.md'), path.join(ROOM_A, 'USER.md'));
fs.mkdirSync(path.join(ROOM_A, '.mindrian'), { recursive: true });
fs.copyFileSync(path.join(FIXTURE_ROOM_A, '.mindrian', 'jtbd-state.json'), path.join(ROOM_A, '.mindrian', 'jtbd-state.json'));

const SESSION_1 = 'sess-l1-one-7d2c41ab';

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

// The generic question and room A's invented word (a lexicon room_term).
const GENERIC = 'what is jobs to be done';
const WORD_A = 'quillfern labs pricing framework';

// Room A's lexicon, read through the module under test's own reader, so the
// byte scan uses the same entries the guard protects (every text invented).
const lexiconMod = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-room-lexicon.cjs'));
const lexiconRead = lexiconMod.loadRoomLexicon(ROOM_A);
assert.ok(lexiconRead && lexiconRead.ok && Array.isArray(lexiconRead.entries) && lexiconRead.entries.length > 0,
  'room A lexicon must load: ' + JSON.stringify(lexiconRead));
const LEXICON_TEXTS = lexiconRead.entries.map(function (e) { return String(e.text).toLowerCase(); });
assert.ok(LEXICON_TEXTS.indexOf('quillfern labs') !== -1, 'room A lexicon must hold the invented term');

const { CREDENTIAL_SHAPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'cross-room-aggregator.cjs'));
assert.ok(Array.isArray(CREDENTIAL_SHAPES) && CREDENTIAL_SHAPES.length > 0, 'CREDENTIAL_SHAPES exported');

const shapePacket = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-shape-packet.cjs'));

// ---- capture server ---------------------------------------------------------
const capture = require(path.join(REPO_ROOT, 'tests', 'helpers', 'brain-capture-server.cjs'));

const SHAPE_SCHEMA = { type: 'object', properties: { schema_version: { type: 'number', const: 1 } } };
const SCHEMA_B = [
  { name: 'brain_ask', inputSchema: { type: 'object', properties: { question: { type: 'string' }, op: { type: 'string' }, params: { type: 'object' }, shape: SHAPE_SCHEMA }, additionalProperties: false } },
  { name: 'recommend_chain', inputSchema: { type: 'object', properties: { problem_type: { type: 'string' }, max_steps: { type: 'integer' }, shape: SHAPE_SCHEMA }, additionalProperties: false } },
];

function sse(payload) {
  return 'data: ' + JSON.stringify({
    jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  }) + '\n';
}
// Methodology-only replies (invented chapter ids, generic snippets).
const ASK_REPLY = {
  answer_mode: 'structured_rows',
  rows: [{ chapterId: 'ch03', section: 'FRAMEWORK', score: 2.1, snippet: 'a framework row', shape_match: true }],
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

function scenario() {
  capture.resetCaptured();
  capture.resetToolList();
  capture.setToolList(SCHEMA_B);
  capture.resetToolScript();
  capture.setToolReplies({
    brain_ask: { body: sse(ASK_REPLY) },
    recommend_chain: { body: sse(CHAIN_REPLY) },
    brain_query: { body: sse(QUERY_REPLY) },
  });
}
function callsNamed(name) {
  return capture.captured.filter(function (c) { return c.name === name; });
}
function keysOf(obj) {
  return Object.keys(obj).sort();
}

// Every record of every arm, kept for the final scan (L1-7).
const ALL_RECORDS = [];
function keepCaptured() {
  capture.captured.forEach(function (c) { ALL_RECORDS.push(c); });
}
// The byte assertion of the plan: no lexicon entry, no credential shape.
function assertCleanBytes(records, label) {
  assert.ok(records.length > 0, label + ': at least one record to scan');
  records.forEach(function (rec, i) {
    const bytes = JSON.stringify(rec);
    const lower = bytes.toLowerCase();
    LEXICON_TEXTS.forEach(function (t) {
      assert.strictEqual(lower.indexOf(t), -1, label + ' record ' + i + ' (' + rec.name + '): lexicon entry on the wire');
    });
    CREDENTIAL_SHAPES.forEach(function (re, k) {
      assert.ok(!re.test(bytes), label + ' record ' + i + ': credential shape ' + k + ' matched the wire bytes');
    });
  });
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
    MINDRIAN_BRAIN_KEY: 'synthetic-392-13-shim-key',
    MINDRIAN_ROOMS_HOME: ROOMS,
  };
  Object.keys(extraEnv || {}).forEach(function (k) {
    if (extraEnv[k] === undefined || extraEnv[k] === null) delete env[k]; else env[k] = extraEnv[k];
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SHIM],
    env: env,
    stderr: 'pipe',
    cwd: GUARD_ROOT,
  });
  const client = new Client({ name: 'test-392-13-l1-shim', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    const call = async function (args) {
      try {
        const resp = await client.callTool({ name: 'brain_ask', arguments: args });
        const content = resp && resp.content && resp.content[0];
        let parsed = null;
        try { parsed = content && content.type === 'text' ? JSON.parse(content.text) : null; } catch (_e) { parsed = null; }
        return { ok: true, text: content && content.text, parsed: parsed, isError: !!(resp && resp.isError) };
      } catch (e) {
        return { ok: false, message: e && e.message ? e.message : String(e) };
      }
    };
    return await fn(call);
  } finally {
    try { await client.close(); } catch (_e) { /* best-effort teardown */ }
  }
}

// ---- main ---------------------------------------------------------------------
async function main() {
  console.log('test-392-loop-l1-wire-bytes: lib and scripts from ' + (GUARD_ROOT === REPO_ROOT ? 'this repository' : GUARD_ROOT));
  const started = await capture.startCaptureServer();
  const url = started.url;
  // ORDERING CONTRACT (tests/helpers/brain-capture-server.cjs): env before the require.
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'synthetic-392-13-key';
  delete require.cache[BRAIN_CLIENT_PATH];
  brainClient = require(BRAIN_CLIENT_PATH);

  // ---- L1-1 ----------------------------------------------------------------
  await check('L1-1 in process, session S1, schema B: brain_ask body keys exactly [question, shape]; the shape validates; recommend_chain carries the same shape', async function () {
    scenario(); resetProbe();
    const env = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(GENERIC); });
    const asks = callsNamed('brain_ask');
    assert.strictEqual(asks.length, 1, 'one brain_ask expected: ' + JSON.stringify(capture.captured));
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['question', 'shape'], 'body keys: ' + JSON.stringify(asks[0].arguments));
    assert.strictEqual(asks[0].arguments.question, GENERIC);
    const v = shapePacket.validateShapePacket(asks[0].arguments.shape);
    assert.ok(v && v.ok === true, 'the shape on the wire validates: ' + JSON.stringify(v));
    const chains = callsNamed('recommend_chain');
    assert.strictEqual(chains.length, 1, 'one recommend_chain expected');
    assert.deepStrictEqual(keysOf(chains[0].arguments), ['max_steps', 'problem_type', 'shape']);
    assert.deepStrictEqual(chains[0].arguments.shape, asks[0].arguments.shape, 'one shape on both tools');
    assert.strictEqual(chains[0].arguments.problem_type, asks[0].arguments.shape.problem_type, 'one type per call');
    assert.ok(env && env.grounding && env.grounding.problem_type_source === 'signal', 'envelope says signal: ' + JSON.stringify(env && env.grounding));
    keepCaptured();
  });

  // ---- L1-2 ----------------------------------------------------------------
  await check('L1-2 bare call (MINDRIAN_BRAIN_SHAPE=0): body keys exactly [question]; recommend_chain [max_steps, problem_type]', async function () {
    scenario(); resetProbe();
    await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1, MINDRIAN_BRAIN_SHAPE: '0' }, function () { return brainClient.ask(GENERIC); });
    const asks = callsNamed('brain_ask');
    assert.strictEqual(asks.length, 1, 'one brain_ask expected: ' + JSON.stringify(capture.captured));
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['question'], 'bare body keys: ' + JSON.stringify(asks[0].arguments));
    assert.deepStrictEqual(keysOf(callsNamed('recommend_chain')[0].arguments), ['max_steps', 'problem_type']);
    keepCaptured();
  });

  // ---- L1-3 ----------------------------------------------------------------
  await check('L1-3 bytes of the shaped and the bare in-process calls: no lexicon entry of room A, no CREDENTIAL_SHAPES match', function () {
    assertCleanBytes(ALL_RECORDS, 'in-process');
  });

  // ---- L1-4 ----------------------------------------------------------------
  await check('L1-4 belt: ask(question with a lexicon word) sends nothing and answers egress_blocked', async function () {
    scenario(); resetProbe();
    const before = capture.captured.length;
    const res = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () { return brainClient.ask(WORD_A); });
    assert.strictEqual(capture.captured.length, before, 'captured length unchanged: ' + JSON.stringify(capture.captured));
    assert.ok(res && res.error === 'egress_blocked', 'typed sentinel expected: ' + JSON.stringify(res));
    assert.strictEqual(JSON.stringify(res).toLowerCase().indexOf('quillfern'), -1, 'the sentinel never echoes the word');
  });

  // ---- L1-5 ----------------------------------------------------------------
  await check('L1-5 shim with session S1: brain_ask(generic) body keys exactly [question, shape]; brain_ask(lexicon word) sends nothing and returns the egress_blocked envelope', async function () {
    scenario();
    await withShim(url, { CLAUDE_CODE_SESSION_ID: SESSION_1 }, async function (call) {
      const r = await call({ question: GENERIC });
      assert.ok(r.ok && !r.isError, 'tool call ok: ' + (r.message || r.text));
      const asks = callsNamed('brain_ask');
      assert.strictEqual(asks.length, 1, 'one brain_ask: ' + JSON.stringify(capture.captured));
      assert.deepStrictEqual(keysOf(asks[0].arguments), ['question', 'shape'], 'shim body: ' + JSON.stringify(asks[0].arguments));
      assert.ok(shapePacket.validateShapePacket(asks[0].arguments.shape).ok === true, 'the shim shape validates');
      assert.ok(r.parsed && r.parsed.grounding && r.parsed.grounding.problem_type_source === 'signal', 'envelope: ' + r.text);
      keepCaptured();

      capture.resetCaptured();
      const blocked = await call({ question: WORD_A });
      assert.ok(blocked.ok, 'a block is an in-band refusal: ' + blocked.message);
      assert.strictEqual(callsNamed('brain_ask').length, 0, 'zero records for the lexicon word: ' + JSON.stringify(capture.captured));
      assert.strictEqual(capture.captured.length, 0, 'nothing of any tool was sent for the lexicon word');
      // The shim renders the block as a DirectiveEnvelope whose refusal.kind
      // is egress_blocked (status BRAIN_EGRESS_BLOCKED); brain-client's own
      // sentinel is {error: egress_blocked}. Either form is the honest refusal.
      const p = blocked.parsed;
      const honest = !!p && (p.error === 'egress_blocked' || (p.refusal && p.refusal.kind === 'egress_blocked'));
      assert.ok(honest, 'honest egress_blocked envelope: ' + blocked.text);
      assert.strictEqual(String(blocked.text).toLowerCase().indexOf('quillfern'), -1, 'the envelope never echoes the word');
    });
  });

  // ---- L1-6 ----------------------------------------------------------------
  await check('L1-6 shim without a session id: the body is bare [question]; the bytes are clean', async function () {
    scenario();
    await withShim(url, { CLAUDE_CODE_SESSION_ID: null }, async function (call) {
      const r = await call({ question: GENERIC });
      assert.ok(r.ok && !r.isError, 'tool call ok: ' + (r.message || r.text));
      const asks = callsNamed('brain_ask');
      assert.strictEqual(asks.length, 1, 'one brain_ask: ' + JSON.stringify(capture.captured));
      assert.deepStrictEqual(keysOf(asks[0].arguments), ['question'], 'bare body without a session: ' + JSON.stringify(asks[0].arguments));
      assertCleanBytes(capture.captured, 'shim no-session');
      keepCaptured();
    });
  });

  // ---- L1-7 ----------------------------------------------------------------
  await check('L1-7 every captured record of every arm (in process, shim with and without a session): no lexicon entry, no credential shape', function () {
    assert.ok(ALL_RECORDS.length >= 8, 'records from every arm: ' + ALL_RECORDS.length);
    assertCleanBytes(ALL_RECORDS, 'all arms');
    const names = ALL_RECORDS.map(function (r) { return r.name; });
    assert.ok(names.indexOf('brain_ask') !== -1 && names.indexOf('recommend_chain') !== -1, 'both tools scanned: ' + names.join(','));
  });

  await check('L1-0 no em dash or en dash in this file', function () {
    const src = fs.readFileSync(__filename, 'utf8');
    assert.strictEqual(src.indexOf(String.fromCharCode(0x2014)), -1, 'em dash');
    assert.strictEqual(src.indexOf(String.fromCharCode(0x2013)), -1, 'en dash');
  });

  await capture.stopCaptureServer(started.server);
  console.log('\n' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) {
    console.log('FAIL: test-392-loop-l1-wire-bytes');
    process.exit(1);
  }
  console.log('PASS: test-392-loop-l1-wire-bytes');
  process.exit(0);
}

main().catch(function (e) {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
