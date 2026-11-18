#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 Plan 13, loop check L3 (PLAN.md section 5): Larry recombines
 * locally. The assembled local text (lib/core/part8-split-route.cjs
 * assembleLocal, reached through runSplitRoute) contains the room words and
 * Theo's method names, while the captured request to the Brain contains no
 * room word, on the CLI path (hook plus belt) and on the shim-alone path
 * (Desktop).
 *
 * Offline: the shared capture server (tests/helpers/brain-capture-server.cjs)
 * advertises schema B and answers by tool name with a scripted Theo reply:
 * recommend_chain from tests/fixtures/364-theo/recommend-chain-covered.json
 * plus the Theo Phase 48 additive block (chain_coverage, evidence,
 * grounding_order), brain_ask a structured_rows payload with methodology
 * snippets only. Zero network. Every room value is invented: the synthetic
 * room A of tests/helpers/synthetic-room-db.cjs (room terms "Quillfern Labs"
 * and "Veldmark") with the shape files of tests/fixtures/392-shape-rooms/
 * room-a; the claims below are invented sentences that reuse those two room
 * terms.
 *
 * Arms:
 *   L3-1 CLI path: the hook (scripts/part8-egress-guard-hook.cjs) with
 *        session S1 allows the generic sprout (exit 0) and blocks the body
 *        claim (exit 2); runSplitRoute with three claims (two room-word
 *        claims and one 3-sentence body) and one generic sprout files the
 *        claims locally, calls the Brain once, and the assembled text holds
 *        both room words and the three Theo method names; no captured record
 *        holds either room word or any sentence of the body; the envelope
 *        that entered the assembly carries Theo's evidence block
 *        (grounding.evidence.linked_frameworks_for_type, plan 392-10), and the
 *        wire carried {question, shape}.
 *   L3-2 shim-alone path: brain_ask through StdioClientTransport with
 *        session S1, then assembleLocal from the shim's envelope and the same
 *        claims; the same assertions.
 *   L3-3 the body claim (3 sentences) is in no captured record of any arm;
 *        the split route sent sprouts only (plan 386-27 outcome preserved).
 *   L3-0 no em dash or en dash in this file.
 *
 * RED proof (plan 392-13 Task 2): on the v2.0.0-beta.81 export
 * (MOS392_GUARD_ROOT) the byte assertions still pass (L3 is independent of
 * the shape) and the evidence assertion fails: beta.81's _composeTheoAsk
 * dropped Theo's evidence block (392-CONTEXT F4). The grep count of tests
 * referencing assembleLocal on beta.81 is recorded in the SUMMARY.
 *
 * No em dash or en dash anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_ROOT = process.env.MOS392_GUARD_ROOT ? path.resolve(process.env.MOS392_GUARD_ROOT) : REPO_ROOT;
const BRAIN_CLIENT_PATH = path.join(GUARD_ROOT, 'lib', 'core', 'brain-client.cjs');
const SPLIT_ROUTE_PATH = path.join(GUARD_ROOT, 'lib', 'core', 'part8-split-route.cjs');
const GUARD_PATH = path.join(GUARD_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(GUARD_ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const SHIM = path.join(GUARD_ROOT, 'scripts', 'mindrian-brain-mcp-client.cjs');
const ROOM_DB_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs');
const FIXTURE_ROOM_A = path.join(REPO_ROOT, 'tests', 'fixtures', '392-shape-rooms', 'room-a');
const CHAIN_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', '364-theo', 'recommend-chain-covered.json');

// Isolate HOME and the rooms home before any plugin module loads.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-13-l3-'));
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
const ROOM_A = rooms.roomFor(SLUG_A);   // room terms "Quillfern Labs", "Veldmark" (invented)

fs.copyFileSync(path.join(FIXTURE_ROOM_A, 'STATE.md'), path.join(ROOM_A, 'STATE.md'));
fs.copyFileSync(path.join(FIXTURE_ROOM_A, 'USER.md'), path.join(ROOM_A, 'USER.md'));
fs.mkdirSync(path.join(ROOM_A, '.mindrian'), { recursive: true });
fs.copyFileSync(path.join(FIXTURE_ROOM_A, '.mindrian', 'jtbd-state.json'), path.join(ROOM_A, '.mindrian', 'jtbd-state.json'));

const SESSION_1 = 'sess-l3-one-9e4a72cd';
fs.writeFileSync(path.join(ROOMS, '.rooms', 'registry.json'), JSON.stringify({ active: SLUG_A, rooms: { [SLUG_A]: { path: SLUG_A } } }, null, 2));
fs.writeFileSync(path.join(ROOMS, '.rooms', 'sessions', SESSION_1 + '.json'), JSON.stringify({
  bound: [SLUG_A], primary: SLUG_A, sticky: false, updated: new Date().toISOString(),
}));

const TOOL_ASK = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const GENERIC = 'what is jobs to be done';

// Room words (room A's invented terms) and the claims the host model would file
// locally. The third claim is a body of three sentences (never a sprout).
const ROOM_WORD_1 = 'Quillfern Labs';
const ROOM_WORD_2 = 'Veldmark';
const BODY_SENTENCES = [
  'The retrofit cut chiller downtime at the northern depots.',
  'Buyers noticed the change within one season.',
  'Repeat orders rose after that season ended.',
];
const CLAIMS = [
  { knowledge_type: 'fact', text: ROOM_WORD_1 + ' runs two depots in the north' },
  { knowledge_type: 'assumption', text: ROOM_WORD_2 + ' buyers will accept a seasonal price' },
  { knowledge_type: 'causal', text: BODY_SENTENCES.join(' ') },
];
const THEO_METHODS = ['Business Model Canvas', 'Scientific Roadmapping', 'Unit Economics Review'];

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
// The scripted Theo reply: the 364 fixture chain plus the Phase 48 additive block.
const CHAIN_FIXTURE_JSON = JSON.parse(fs.readFileSync(CHAIN_FIXTURE, 'utf8'));
assert.deepStrictEqual(CHAIN_FIXTURE_JSON.chain.map(function (s) { return s.framework; }), THEO_METHODS, 'fixture frameworks');
const CHAIN_REPLY = Object.assign({}, CHAIN_FIXTURE_JSON, {
  chain: CHAIN_FIXTURE_JSON.chain.map(function (s) { return Object.assign({}, s, { rank: s.step, degree: 10 - s.step }); }),
  chain_coverage: { steps_returned: 3, steps_requested: 4, rank1_leads_total: 3, rank1_leads_returned: 3, full: true },
  evidence: { linked_frameworks_for_type: 46 },
  grounding_order: 'shape_boosted',
});
// Methodology snippets only (invented chapter ids, generic text).
const ASK_REPLY = {
  answer_mode: 'structured_rows',
  rows: [
    { chapterId: 'ch03', section: 'FRAMEWORK', score: 2.4, snippet: 'jobs to be done asks what progress a customer hires a product to make', shape_match: true },
    { chapterId: 'ch05', section: 'METHOD', score: 1.9, snippet: 'a well-defined problem takes a canvas before a roadmap', shape_match: false },
  ],
  grounding_order: 'shape_boosted',
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

const ALL_RECORDS = [];
function keepCaptured() {
  capture.captured.forEach(function (c) { ALL_RECORDS.push(c); });
}
function assertNoRoomWordOnWire(records, label) {
  assert.ok(records.length > 0, label + ': at least one record to scan');
  const wire = JSON.stringify(records).toLowerCase();
  assert.strictEqual(wire.indexOf(ROOM_WORD_1.toLowerCase()), -1, label + ': room word 1 on the wire');
  assert.strictEqual(wire.indexOf(ROOM_WORD_2.toLowerCase()), -1, label + ': room word 2 on the wire');
  BODY_SENTENCES.forEach(function (s, i) {
    assert.strictEqual(wire.indexOf(s.toLowerCase()), -1, label + ': body sentence ' + (i + 1) + ' on the wire');
  });
}
// The assertions on an assembled result shared by both paths.
function assertAssembled(assembled, label) {
  assert.ok(assembled && typeof assembled.text === 'string', label + ': assembled text expected: ' + JSON.stringify(assembled));
  const text = assembled.text;
  assert.ok(text.indexOf(ROOM_WORD_1) !== -1, label + ': room word 1 in the local text');
  assert.ok(text.indexOf(ROOM_WORD_2) !== -1, label + ': room word 2 in the local text');
  THEO_METHODS.forEach(function (m) {
    assert.ok(text.indexOf(m) !== -1, label + ': Theo method in the local text: ' + m);
  });
  assert.ok(text.indexOf('What the Brain said:') !== -1 && text.indexOf('What stays in the room:') !== -1, label + ': both labels');
  assert.strictEqual(assembled.parts.local.length, 3, label + ': three local claims');
  assert.strictEqual(assembled.parts.brain.length, 1, label + ': one Brain answer');
  assert.strictEqual(assembled.parts.brain_unavailable, 0, label + ': the Brain answer was usable');
}
// The 392-10 assertion that fails on beta.81: the envelope carries Theo's evidence.
function assertEnvelopeEvidence(env, label) {
  assert.ok(env && env.grounding, label + ': composed envelope expected: ' + JSON.stringify(env));
  assert.ok(env.grounding.evidence && env.grounding.evidence.linked_frameworks_for_type === 46,
    label + ': grounding.evidence.linked_frameworks_for_type expected (plan 392-10 keeps Theo evidence): ' + JSON.stringify(env.grounding.evidence));
  assert.ok(env.grounding.chain_coverage && env.grounding.chain_coverage.full === true, label + ': chain_coverage kept');
  assert.deepStrictEqual(env.next_gate.options.map(function (o) { return o.framework; }), THEO_METHODS, label + ': options in Theo order');
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

// The hook, spawned once per question with the session id in the payload.
function runHook(question, sessionId) {
  const env = Object.assign({}, process.env, {
    HOME: HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: ROOMS, PART8_FORCE_BRAIN_AVAILABLE: '1',
  });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  const payload = { tool_name: TOOL_ASK, tool_input: { question: question }, session_id: sessionId };
  const res = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8', env: env, timeout: 20000, cwd: GUARD_ROOT });
  return { code: res.status, stderr: res.stderr || '', stdout: res.stdout || '' };
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
    MINDRIAN_BRAIN_KEY: 'synthetic-392-13-l3-shim-key',
    MINDRIAN_ROOMS_HOME: ROOMS,
  };
  Object.keys(extraEnv || {}).forEach(function (k) {
    if (extraEnv[k] === undefined || extraEnv[k] === null) delete env[k]; else env[k] = extraEnv[k];
  });
  const transport = new StdioClientTransport({ command: process.execPath, args: [SHIM], env: env, stderr: 'pipe', cwd: GUARD_ROOT });
  const client = new Client({ name: 'test-396-13-l3-shim', version: '1.0.0' }, { capabilities: {} });
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
  console.log('test-396-loop-l3-recombine: lib and scripts from ' + (GUARD_ROOT === REPO_ROOT ? 'this repository' : GUARD_ROOT));
  const started = await capture.startCaptureServer();
  const url = started.url;
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'synthetic-392-13-l3-key';
  delete require.cache[BRAIN_CLIENT_PATH];
  const brainClient = require(BRAIN_CLIENT_PATH);
  const splitRoute = require(SPLIT_ROUTE_PATH);
  const guard = require(GUARD_PATH);
  const roomDb = require(ROOM_DB_PATH);

  // ---- L3-1 CLI path ---------------------------------------------------------
  await check('L3-1 CLI path: the hook allows the generic sprout (exit 0) and blocks the body (exit 2); runSplitRoute files the claims locally, the assembled text holds both room words and the Theo methods, the wire holds neither room word, the envelope carries Theo evidence, the wire carried {question, shape}', async function () {
    const allowed = runHook(GENERIC, SESSION_1);
    assert.strictEqual(allowed.code, 0, 'hook exit for the generic sprout: ' + allowed.code + ' ' + allowed.stderr);
    const blockedBody = runHook(CLAIMS[2].text, SESSION_1);
    assert.strictEqual(blockedBody.code, 2, 'hook exit for the body claim: ' + blockedBody.code + ' ' + blockedBody.stderr);
    BODY_SENTENCES.forEach(function (s) {
      assert.strictEqual(blockedBody.stderr.indexOf(s), -1, 'the hook never echoes the body');
    });

    scenario();
    if (brainClient._test && typeof brainClient._test._resetShapeProbe === 'function') brainClient._test._resetShapeProbe();
    const handle = roomDb.openRoomDb(ROOM_A, { allowExtension: true });
    let out;
    try {
      out = await withEnv({ CLAUDE_CODE_SESSION_ID: SESSION_1 }, function () {
        return splitRoute.runSplitRoute({
          db: handle,
          claims: CLAIMS,
          sprouts: [GENERIC],
          classify: guard.classify,
          roomDir: ROOM_A,
          sessionId: SESSION_1,
          callBrain: function (sprout) { return brainClient.ask(sprout); },
        });
      });
    } finally {
      try { roomDb.closeRoomDb(handle); } catch (_e) { /* best effort */ }
    }
    assert.ok(out && out.ok === true, 'runSplitRoute ok: ' + JSON.stringify(out && { ok: out.ok, reason: out.reason, rejected: out.rejected }));
    assert.strictEqual(out.ids.length, 3, 'three claims filed locally');
    assert.strictEqual(out.answers.length, 1, 'one Brain call for one sprout');
    const asks = callsNamed('brain_ask');
    assert.strictEqual(asks.length, 1, 'one brain_ask on the wire: ' + JSON.stringify(capture.captured));
    assert.strictEqual(asks[0].arguments.question, GENERIC, 'the sprout is the only question sent');
    assertNoRoomWordOnWire(capture.captured, 'CLI path');
    assertAssembled(out.assembled, 'CLI path');
    // The plan's RED line on beta.81: the evidence block was dropped there.
    assertEnvelopeEvidence(out.answers[0], 'CLI path');
    assert.deepStrictEqual(keysOf(asks[0].arguments), ['question', 'shape'], 'the wire carried the shape beside the question: ' + JSON.stringify(asks[0].arguments));
    keepCaptured();
  });

  // ---- L3-2 shim-alone path --------------------------------------------------
  await check('L3-2 shim-alone path (Desktop): brain_ask through the shim with session S1, then assembleLocal from the shim envelope and the same claims; room words in the local text, none on the wire, Theo evidence on the envelope', async function () {
    scenario();
    await withShim(url, { CLAUDE_CODE_SESSION_ID: SESSION_1 }, async function (call) {
      const r = await call({ question: GENERIC });
      assert.ok(r.ok && !r.isError && r.parsed, 'tool call ok: ' + (r.message || r.text));
      const asks = callsNamed('brain_ask');
      assert.strictEqual(asks.length, 1, 'one brain_ask: ' + JSON.stringify(capture.captured));
      assert.deepStrictEqual(keysOf(asks[0].arguments), ['question', 'shape'], 'shim body: ' + JSON.stringify(asks[0].arguments));
      assertNoRoomWordOnWire(capture.captured, 'shim path');
      const assembled = splitRoute.assembleLocal(CLAIMS, [r.parsed]);
      assertAssembled(assembled, 'shim path');
      assertEnvelopeEvidence(r.parsed, 'shim path');
      keepCaptured();
    });
  });

  // ---- L3-3 ------------------------------------------------------------------
  await check('L3-3 the body claim and both room words are in no captured record of any arm; sprouts only reached the wire', function () {
    assert.ok(ALL_RECORDS.length >= 6, 'records from both arms: ' + ALL_RECORDS.length);
    assertNoRoomWordOnWire(ALL_RECORDS, 'all arms');
    ALL_RECORDS.filter(function (r) { return r.name === 'brain_ask'; }).forEach(function (r) {
      assert.strictEqual(r.arguments.question, GENERIC, 'every brain_ask carried the sprout only');
    });
  });

  await check('L3-0 no em dash or en dash in this file', function () {
    const src = fs.readFileSync(__filename, 'utf8');
    assert.strictEqual(src.indexOf(String.fromCharCode(0x2014)), -1, 'em dash');
    assert.strictEqual(src.indexOf(String.fromCharCode(0x2013)), -1, 'en dash');
  });

  await capture.stopCaptureServer(started.server);
  console.log('\n' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) {
    console.log('FAIL: test-396-loop-l3-recombine');
    process.exit(1);
  }
  console.log('PASS: test-396-loop-l3-recombine');
  process.exit(0);
}

main().catch(function (e) {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
