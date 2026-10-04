#!/usr/bin/env node
'use strict';

/**
 * Phase 289 code review fixes (289-REVIEW.md, iteration 1) -- regression arms.
 * ==========================================================================
 * Written RED-first: each arm fails against the pre-fix code and passes after
 * its fix commit.
 *
 *   cr01   CR-01  a verdict that disagrees with the chosen option is refused
 *                 BEFORE the consume with a named reason; nothing is executed,
 *                 written or confirmed, and the gate survives for the owner.
 *                 Covered on gate_answer for a chain material-step gate and
 *                 for a research-style gate that declares approving ids, on
 *                 chain_run's own resume, and the real research gate minter
 *                 persists the approving ids it already knew.
 *   wr01   WR-01  chain_run's resume refuses a gate that is not a material
 *                 chain-step gate (kind, onStepFn, restSteps) before the
 *                 consume, so the owner's gate_render gate is not burned.
 *   wr02   WR-02  the refusals knowable before the consume are pre-consume (see
 *                 cr01); the one that cannot be known (a resolve that throws) is
 *                 pinned honestly as the residual: the gate is spent and the
 *                 failure is returned under chain_result, never as success.
 *   wr03   WR-03  a throwing elicitInput on rung (a) falls through to the card
 *                 rung with the reason recorded on the rendered result, never
 *                 render_failed, and the gate is still answerable.
 *   wr05   WR-05  the gate_render input schema accepts the optional boolean
 *                 `recommended` on an option and it reaches the card.
 *
 * Repeatable --arm <id>; no flag runs every arm. Hermetic: temp HOME and rooms
 * home, MINDRIAN_BRAIN_URL unreachable, env restored and dirs removed in a
 * finally. In-process only, no exit 77. No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 't289-review-'));
const ENV_KEYS = ['HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL', 'MINDRIAN_BRAIN_KEY',
  'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM', 'MINDRIAN_ROOM'];
const SAVED_ENV = {};
for (const k of ENV_KEYS) SAVED_ENV[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
const HOME_DIR = path.join(TMP_ROOT, 'home');
const ROOMS_HOME = path.join(TMP_ROOT, 'rooms');
fs.mkdirSync(HOME_DIR, { recursive: true });
fs.mkdirSync(ROOMS_HOME, { recursive: true });
process.env.HOME = HOME_DIR;
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.MINDRIAN_BRAIN_KEY;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_ROOM;

function restoreEnvAndClean() {
  for (const k of ENV_KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
  try { fs.rmSync(TMP_ROOT, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

let passed = 0;
let failed = 0;
async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log('PASS: ' + label);
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    console.log('FAIL: ' + label + ' :: ' + msg);
  }
}

const ALL_ARMS = ['cr01', 'wr01', 'wr02', 'wr03', 'wr05'];
function parseArms(argv) {
  const picked = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--arm' && i + 1 < argv.length) { picked.push(argv[i + 1]); i += 1; }
  }
  return picked.length > 0 ? picked : ALL_ARMS;
}

// ---------------------------------------------------------------------------
// Shared fixture: one scratch room, sessions S1 bound to it, the real gate.cjs
// handlers on a fake server, the real chain.cjs, the real research gate minter.
// ---------------------------------------------------------------------------
function makeFakeServer(opts) {
  const o = opts || {};
  const registered = [];
  return {
    registerTool(name, config, handler) {
      const cfg = config || {};
      if (registered.some((r) => r.name === name)) throw new Error('DUPLICATE_TOOL_NAME: ' + name);
      registered.push({ name: name, description: cfg.description, inputSchema: cfg.inputSchema, handler: handler });
    },
    _registered: registered,
    server: o.server || { getClientCapabilities() { return {}; } },
  };
}

let _fixture = null;
function fixture() {
  if (_fixture) return _fixture;
  const gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const chain = require(path.join(REPO, 'lib', 'mcp', 'tools', 'chain.cjs'));
  const research = require(path.join(REPO, 'lib', 'mcp', 'tools', 'research.cjs'));
  const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
  const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
  const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  const sessionBinding = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));

  const roomDir = path.join(ROOMS_HOME, 'room-x');
  fs.mkdirSync(roomDir, { recursive: true });
  roomDb.closeRoomDb(roomDb.openRoomDb(roomDir));
  fs.mkdirSync(path.join(ROOMS_HOME, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(ROOMS_HOME, '.rooms', 'registry.json'), JSON.stringify({
    active: 'room-x',
    rooms: { 'room-x': { slug: 'room-x', abs_path: roomDir } },
  }, null, 2));
  sessionBinding.writeSessionBinding('S1', { bound: ['room-x'], primary: 'room-x' });

  const fake = makeFakeServer();
  gateModule.register(fake, { surface: 'cli' });
  const renderHandler = fake._registered.find((r) => r.name === 'gate_render').handler;
  const answerHandler = fake._registered.find((r) => r.name === 'gate_answer').handler;

  const parse = (res) => {
    const p = JSON.parse(res.content[0].text);
    p._isError = !!res.isError;
    return p;
  };
  const answer = async (sessionId, gateId, chosen, verdict) => parse(await answerHandler(
    { gate_id: gateId, chosen: chosen, verdict: verdict }, { sessionId: sessionId }));

  function rowCount(gateId) {
    const db = navigation.openRoomDbForCaller(roomDir);
    assert.ok(db, 'the scratch room db must open for a row count');
    try {
      const row = db.prepare(
        "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' "
        + "AND json_extract(properties, '$.label') = 'gate_answer' "
        + "AND json_extract(properties, '$.gate_id') = ?"
      ).get(gateId);
      return row ? row.c : 0;
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  }
  function nodeExists(nodeId) {
    const db = navigation.openRoomDbForCaller(roomDir);
    assert.ok(db, 'the scratch room db must open');
    try {
      return !!db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  }
  const decisionNodeId = (gateId) => navigation.REASONING_NODE_ID('decision:gate', gateId);

  _fixture = {
    gateModule, chain, research, gateLedger, gateRender, fake, renderHandler, answerHandler,
    parse, answer, rowCount, nodeExists, decisionNodeId, roomDir,
  };
  return _fixture;
}

// A halted chain material-step gate with its own execution witness.
async function mintChainGate(sessionId) {
  const f = fixture();
  const counter = { n: 0 };
  const halt = await f.chain.chainRun([{ step: 1, framework: 'fixture-review-material', command: null, optional: false }], {
    roomDir: f.roomDir,
    sessionId: sessionId,
    onStep: async () => { counter.n += 1; return { chain_output: { ran: true } }; },
    postureFn: () => ({ autonomous_safe: false, posture: 'halt' }),
    gateRenderCtx: {},
  });
  assert.equal(halt.halted, true, 'FIXTURE: the chain halted at the material step');
  const gateId = halt.gate && halt.gate.gate_id;
  assert.equal(typeof gateId, 'string', 'FIXTURE: a gate id was minted');
  return { gateId: gateId, counter: counter };
}

// A research-style gate minted by the REAL research gate minter.
async function mintResearchGate(sessionId) {
  const f = fixture();
  const counter = { n: 0 };
  const out = await f.research._internal.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, sessionId, {
    card: { title: 'Grant', question: 'Allow the run?' },
    options: [{ id: 'grant', label: 'Grant' }, { id: 'later', label: 'Later' }, { id: 'no', label: 'No' }],
    approving: ['grant'],
    rejecting: ['no'],
    resolve: async () => { counter.n += 1; return { ok: true, executed: true }; },
  });
  assert.equal(typeof out.gate_id, 'string', 'FIXTURE: the research gate minted');
  return { gateId: out.gate_id, counter: counter };
}

// ---------------------------------------------------------------------------
// Arm: cr01
// ---------------------------------------------------------------------------
async function armCr01() {
  const f = fixture();
  const stillThere = (gateId) => {
    const e = f.gateLedger.peekGate(gateId, 'S1');
    return !!(e && e.ok !== false);
  };

  // --- chain material-step gate through gate_answer ---
  const a = await mintChainGate('S1');
  await check('cr01 gate_answer: approve verdict with the reject option chosen is refused, named, nothing executed or written', async () => {
    const r = await f.answer('S1', a.gateId, ['reject'], 'approve');
    assert.equal(r._isError, true, 'must be an error response, got ' + JSON.stringify(r));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'chosen_not_approving');
    assert.equal(a.counter.n, 0, 'the material step must not run');
    assert.equal(f.rowCount(a.gateId), 0, 'no ratification row');
    assert.equal(f.nodeExists(f.decisionNodeId(a.gateId)), false, 'no decision node minted or confirmed');
  });
  await check('cr01 gate_answer: the refused mismatch left the gate for its owner', () => {
    assert.equal(stillThere(a.gateId), true, 'the gate must survive a refused answer');
  });
  await check('cr01 gate_answer: reject verdict with the approve option chosen is refused, named, nothing executed or written', async () => {
    const r = await f.answer('S1', a.gateId, ['approve'], 'reject');
    assert.equal(r._isError, true, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'verdict_chosen_mismatch');
    assert.equal(a.counter.n, 0);
    assert.equal(f.rowCount(a.gateId), 0);
    assert.equal(stillThere(a.gateId), true, 'the gate must survive');
  });
  await check('cr01 gate_answer: defer verdict with the approve option chosen is refused too', async () => {
    const r = await f.answer('S1', a.gateId, ['approve'], 'defer');
    assert.equal(r._isError, true, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'verdict_chosen_mismatch');
    assert.equal(a.counter.n, 0);
  });
  await check('cr01 gate_answer: the coherent answer then runs the step exactly once (anti-vacuity control)', async () => {
    const r = await f.answer('S1', a.gateId, ['approve'], 'approve');
    assert.equal(r.ok, true, 'got ' + JSON.stringify(r));
    assert.equal(a.counter.n, 1);
    assert.equal(f.rowCount(a.gateId), 1);
  });
  await check('cr01 gate_answer: a coherent reject (reject chosen, reject verdict) still resolves without running the step', async () => {
    const b = await mintChainGate('S1');
    const r = await f.answer('S1', b.gateId, ['reject'], 'reject');
    assert.equal(r.ok, true, 'got ' + JSON.stringify(r));
    assert.equal(b.counter.n, 0);
  });

  // --- the same two mismatches through chain_run's own resume ---
  const c = await mintChainGate('S1');
  const resume = (gateId, chosen, verdict) => f.chain.chainRun(null, {
    sessionId: 'S1',
    gateAnswer: f.gateRender.normalizeGateAnswer(gateId, chosen, verdict),
  });
  await check('cr01 chain_run: approve verdict with the reject option chosen is refused before the consume, nothing executed', async () => {
    const r = await resume(c.gateId, ['reject'], 'approve');
    assert.equal(r.ok, false, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'chosen_not_approving');
    assert.equal(c.counter.n, 0, 'the material step must not run');
    assert.equal(stillThere(c.gateId), true, 'the gate must survive the refusal');
  });
  await check('cr01 chain_run: reject verdict with the approve option chosen is refused before the consume', async () => {
    const r = await resume(c.gateId, ['approve'], 'reject');
    assert.equal(r.ok, false, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'verdict_chosen_mismatch');
    assert.equal(stillThere(c.gateId), true);
  });
  await check('cr01 chain_run: the coherent answer then executes once (anti-vacuity control)', async () => {
    const r = await resume(c.gateId, ['approve'], 'approve');
    assert.equal(r.ok, true, 'got ' + JSON.stringify(r));
    assert.equal(c.counter.n, 1);
  });

  // --- a research-style gate that declares approving ids ---
  const d = await mintResearchGate('S1');
  await check('cr01 research gate: the minter persists the approving ids it already knew on the ledger entry', () => {
    const e = f.gateLedger.peekGate(d.gateId, 'S1');
    assert.ok(e && Array.isArray(e.approving) && e.approving.indexOf('grant') !== -1, 'entry.approving must name grant, got ' + JSON.stringify(e && e.approving));
  });
  await check('cr01 research gate: approve verdict naming a non-approving option is refused before the consume and before any write', async () => {
    const r = await f.answer('S1', d.gateId, ['later'], 'approve');
    assert.equal(r._isError, true, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'chosen_not_approving');
    assert.equal(d.counter.n, 0);
    assert.equal(f.rowCount(d.gateId), 0, 'no ratification row left behind');
    assert.equal(f.nodeExists(f.decisionNodeId(d.gateId)), false, 'no approved decision node left behind');
    assert.equal(stillThere(d.gateId), true, 'the gate must not be burned');
  });
  await check('cr01 research gate: reject verdict naming the approving option is refused', async () => {
    const r = await f.answer('S1', d.gateId, ['grant'], 'reject');
    assert.equal(r._isError, true, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'verdict_chosen_mismatch');
    assert.equal(d.counter.n, 0);
    assert.equal(stillThere(d.gateId), true);
  });
  await check('cr01 research gate: the coherent approve resolves exactly once (anti-vacuity control)', async () => {
    const r = await f.answer('S1', d.gateId, ['grant'], 'approve');
    assert.equal(r.ok, true, 'got ' + JSON.stringify(r));
    assert.equal(d.counter.n, 1);
  });
}

// ---------------------------------------------------------------------------
// Arm: wr01
// ---------------------------------------------------------------------------
async function armWr01() {
  const f = fixture();
  const resume = (gateId, chosen, verdict) => f.chain.chainRun(null, {
    sessionId: 'S1',
    gateAnswer: f.gateRender.normalizeGateAnswer(gateId, chosen, verdict),
  });
  const mintGeneral = async () => f.parse(await f.renderHandler({
    options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }],
  }, { sessionId: 'S1' }));
  const stillThere = (gateId) => {
    const e = f.gateLedger.peekGate(gateId, 'S1');
    return !!(e && e.ok !== false);
  };

  const g = await mintGeneral();
  await check('wr01: a general gate_render gate is minted (anti-vacuity control)', () => {
    assert.equal(g.ok, true, JSON.stringify(g));
    assert.equal(stillThere(g.gate_id), true);
  });
  await check('wr01: chain_run resume of a general gate with reject is refused not_a_chain_gate and the gate survives', async () => {
    const r = await resume(g.gate_id, ['reject'], 'reject');
    assert.equal(r.ok, false, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'not_a_chain_gate');
    assert.equal(stillThere(g.gate_id), true, 'the owner gate must not be burned by a chain_run call');
  });
  await check('wr01: chain_run resume of a general gate with approve is refused not_a_chain_gate (no onStep_fault) and the gate survives', async () => {
    const r = await resume(g.gate_id, ['approve'], 'approve');
    assert.equal(r.ok, false, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'not_a_chain_gate');
    assert.equal(stillThere(g.gate_id), true);
  });
  await check('wr01: the burned-by-mistake gate is still answerable through gate_answer', async () => {
    const r = await f.answer('S1', g.gate_id, ['approve'], 'approve');
    assert.equal(r.ok, true, 'got ' + JSON.stringify(r));
    assert.equal(r.ratified, true);
  });
  await check('wr01: a research-style material_step gate (no onStepFn) is refused by chain_run too, and survives', async () => {
    const d = await mintResearchGate('S1');
    const r = await resume(d.gateId, ['grant'], 'approve');
    assert.equal(r.ok, false, 'got ' + JSON.stringify(r));
    assert.equal(r.reason, 'not_a_chain_gate');
    assert.equal(d.counter.n, 0);
    assert.equal(stillThere(d.gateId), true);
    f.gateLedger._internal._ledger.delete(d.gateId);
  });
  await check('wr01: a real chain material-step gate still resumes through chain_run (anti-vacuity control)', async () => {
    const c = await mintChainGate('S1');
    const r = await resume(c.gateId, ['approve'], 'approve');
    assert.equal(r.ok, true, 'got ' + JSON.stringify(r));
    assert.equal(c.counter.n, 1);
  });
}

// ---------------------------------------------------------------------------
// Arm: wr02
// ---------------------------------------------------------------------------
async function armWr02() {
  const f = fixture();
  await check('wr02: a resolve that throws is the stated residual - reported ok:false under chain_result, never success', async () => {
    const out = await f.research._internal.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', {
      card: { title: 'Grant', question: 'Allow the run?' },
      options: [{ id: 'grant', label: 'Grant' }, { id: 'no', label: 'No' }],
      approving: ['grant'],
      rejecting: ['no'],
      resolve: async () => { throw new Error('boom'); },
    });
    const r = await f.answer('S1', out.gate_id, ['grant'], 'approve');
    assert.equal(r.ok, false, 'a failed resume must not report success, got ' + JSON.stringify(r));
    assert.ok(r.chain_result && r.chain_result.ok === false && r.chain_result.reason === 'approval_failed', 'got ' + JSON.stringify(r.chain_result));
    assert.equal(f.gateLedger.peekGate(out.gate_id, 'S1'), null, 'the residual: the gate is spent once resumeFn ran (Phase 369 plan 26 owns durable consumption)');
  });
  await check('wr02: the coherence refusal that WAS knowable leaves no spent gate and no row (contrast with the residual)', async () => {
    const out = await f.research._internal.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', {
      card: { title: 'Grant', question: 'Allow the run?' },
      options: [{ id: 'grant', label: 'Grant' }, { id: 'no', label: 'No' }],
      approving: ['grant'],
      rejecting: ['no'],
      resolve: async () => ({ ok: true }),
    });
    const r = await f.answer('S1', out.gate_id, ['no'], 'approve');
    assert.equal(r.reason, 'chosen_not_approving');
    assert.equal(f.rowCount(out.gate_id), 0);
    const e = f.gateLedger.peekGate(out.gate_id, 'S1');
    assert.ok(e && e.ok !== false, 'the gate must survive');
    f.gateLedger._internal._ledger.delete(out.gate_id);
  });
}

// ---------------------------------------------------------------------------
// Arm: wr03
// ---------------------------------------------------------------------------
async function armWr03() {
  const f = fixture();
  const throwing = {
    getClientCapabilities() { return { elicitation: {} }; },
    getClientVersion() { return { name: 'Visual Studio Code', version: '1.0.0' }; },
    async elicitInput() { throw new Error('elicitation is not supported on this protocol revision'); },
  };

  await check('wr03: renderGate with a throwing elicitInput on rung (a) does not throw and falls to the card rung', async () => {
    const result = await f.gateRender.renderGate(
      { options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }] },
      {
        capabilities: { elicitation: true },
        sessionId: 'S1',
        elicitInput: () => throwing.elicitInput(),
      }
    );
    assert.notEqual(result.renderer, 'elicitation', 'the throwing rung must not be reported as the renderer');
    assert.ok(result.renderer === 'askuserquestion' || result.renderer === 'text', 'got renderer ' + result.renderer);
    assert.equal(result.answer, null);
    assert.ok(typeof result.elicit_fallback === 'string' && result.elicit_fallback.length > 0, 'the reason must be recorded, got ' + JSON.stringify(result.elicit_fallback));
  });

  await check('wr03: gate_render through a non-Claude host whose elicitInput throws returns a rendered gate, never render_failed, and it is answerable', async () => {
    const fake = makeFakeServer({ server: throwing });
    f.gateModule.register(fake, { surface: 'vscode' });
    const render = fake._registered.find((r) => r.name === 'gate_render').handler;
    const res = await render({ options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }] }, { sessionId: 'S1' });
    const out = f.parse(res);
    assert.equal(out._isError, false, 'got ' + JSON.stringify(out));
    assert.equal(out.ok, true);
    assert.notEqual(out.reason, 'render_failed');
    assert.notEqual(out.renderer, 'elicitation');
    assert.ok(out.rendered && typeof out.rendered.elicit_fallback === 'string' && out.rendered.elicit_fallback.length > 0, 'the fallback reason must be visible on the rendered result, got ' + JSON.stringify(out.rendered && out.rendered.elicit_fallback));
    const r = await f.answer('S1', out.gate_id, ['approve'], 'approve');
    assert.equal(r.ok, true, 'the gate must be answerable, got ' + JSON.stringify(r));
  });

  await check('wr03: the research gate minter does not propagate a throwing elicitInput', async () => {
    const counter = { n: 0 };
    const out = await f.research._internal.mintApprovalGate(makeFakeServer({ server: throwing }), { surface: 'vscode' }, 'S1', {
      card: { title: 'Grant', question: 'Allow?' },
      options: [{ id: 'grant', label: 'Grant' }, { id: 'no', label: 'No' }],
      approving: ['grant'],
      rejecting: ['no'],
      resolve: async () => { counter.n += 1; return { ok: true }; },
    });
    assert.equal(typeof out.gate_id, 'string', 'a gate must be minted, got ' + JSON.stringify(out));
    assert.notEqual(out.renderer, 'elicitation');
    const e = f.gateLedger.peekGate(out.gate_id, 'S1');
    assert.ok(e && e.ok !== false, 'the gate must be in the ledger');
  });
}

// ---------------------------------------------------------------------------
// Arm: wr05
// ---------------------------------------------------------------------------
async function armWr05() {
  const f = fixture();
  await check('wr05: the gate_render input schema accepts an option with recommended:true and keeps the key', () => {
    const reg = f.fake._registered.find((r) => r.name === 'gate_render');
    const parsed = reg.inputSchema.safeParse({
      options: [{ id: 'a', label: 'A', recommended: true }, { id: 'b', label: 'B' }],
    });
    assert.equal(parsed.success, true, JSON.stringify(parsed.error && parsed.error.issues));
    assert.equal(parsed.data.options[0].recommended, true, 'the schema must not strip recommended');
  });
  await check('wr05: the gate_render input schema rejects a non-boolean recommended', () => {
    const reg = f.fake._registered.find((r) => r.name === 'gate_render');
    const parsed = reg.inputSchema.safeParse({ options: [{ id: 'a', label: 'A', recommended: 'yes' }] });
    assert.equal(parsed.success, false);
  });
  await check('wr05: through the gate_render handler an explicit recommended reaches the minted card contract (single and basket)', async () => {
    const single = f.parse(await f.renderHandler({
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', recommended: true }],
    }, { sessionId: 'S1' }));
    assert.equal(single.ok, true, JSON.stringify(single));
    const live = f.gateLedger.peekGate(single.gate_id, 'S1');
    assert.equal(live.card.recommended, 'b', 'single select: the flagged option is the recommended id');
    const basket = f.parse(await f.renderHandler({
      select_mode: 'multi',
      options: [{ id: 'a', label: 'A', recommended: true }, { id: 'b', label: 'B' }],
    }, { sessionId: 'S1' }));
    const liveBasket = f.gateLedger.peekGate(basket.gate_id, 'S1');
    assert.equal(liveBasket.card.options.find((o) => o.id === 'a').recommended, true, 'basket: the flag survives onto the card option');
  });
}

async function main() {
  const arms = parseArms(process.argv.slice(2));
  const table = { cr01: armCr01, wr01: armWr01, wr02: armWr02, wr03: armWr03, wr05: armWr05 };
  try {
    for (const id of arms) {
      if (!table[id]) {
        failed += 1;
        console.log('FAIL: unknown arm ' + id + ' (ids: ' + ALL_ARMS.join(', ') + ')');
        continue;
      }
      console.log('-- arm ' + id);
      try {
        await table[id]();
      } catch (err) {
        failed += 1;
        console.log('FAIL: arm ' + id + ' setup :: ' + ((err && err.message) ? String(err.message).split('\n')[0] : String(err)));
      }
    }
  } finally {
    restoreEnvAndClean();
  }
  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  restoreEnvAndClean();
  process.exit(1);
});
