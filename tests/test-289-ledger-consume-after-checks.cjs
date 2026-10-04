#!/usr/bin/env node
'use strict';

/**
 * Phase 289 plan 02 (LEDGER289-01, LEDGER289-02, LEDGER289-03) -- the gate
 * ledger consumes a gate only AFTER every check that can refuse the answer.
 * ==========================================================================
 * Why: today lib/mcp/gate-ledger.cjs::consumeGate deletes the entry on lookup,
 * before the TTL and session checks, and gate_answer consumes before its own
 * chosen / resume-owner / write-room refusals. One stranger (or one typo, or
 * one unbound room) therefore burns the OWNER's gate: the human's pending
 * decision vanishes and the next honest answer reads unknown_or_expired_gate.
 * Measured by .planning/spikes/007-agent-native-wraps-mcp/stages/02_actions/
 * burn-probe.cjs; this file turns that measurement into a definition.
 *
 * Three arms (repeatable --arm <id>; no flag runs all three):
 *   ledger        peekGate (non-consuming read, same TTL and session contract),
 *                 consumeGate keeps the entry on a session mismatch, the
 *                 owner-after-stranger order at the ledger layer, expiry,
 *                 and the exact text Phase 369-07's detector reads
 *   gate-answer   the same rule through the REAL gate_render / gate_answer
 *                 handlers (in-process fake server): owner-after-stranger,
 *                 chosen refusal then correct answer, unbound-room refusal
 *                 then bind then answer, replay, double submit, resume owner
 *   source        ordering inside the gate_answer handler and inside chain.cjs
 *                 _resumeFromGateAnswer: peek, then checks, then consume, with
 *                 no await between the peek and the consume
 *
 * Every textual check is paired with a behavioural case on the same rule (the
 * repo's source-presence grep anti-pattern). Hermetic: temp HOME and rooms
 * home, MINDRIAN_BRAIN_URL unreachable, env restored and dirs removed in a
 * finally. In-process only, so there is no environment gap and no exit 77.
 *
 * No em-dashes (hyphens only). CJS, Node built-ins only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Hermetic environment, BEFORE any lib/ module is required.
// ---------------------------------------------------------------------------
const REPO = path.resolve(__dirname, '..');
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 't289-ledger-'));
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
delete process.env.CLAUDE_ACTIVE_ROOM; // an env pin would make the unbound session a write target
delete process.env.MINDRIAN_ROOM;

function restoreEnvAndClean() {
  for (const k of ENV_KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
  try { fs.rmSync(TMP_ROOT, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Harness: one PASS:/FAIL: line per case, a throw is a FAIL line, never fatal.
// ---------------------------------------------------------------------------
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

function parseArms(argv) {
  const all = ['ledger', 'gate-answer', 'source'];
  const picked = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--arm' && i + 1 < argv.length) {
      picked.push(argv[i + 1]);
      i += 1;
    }
  }
  return picked.length > 0 ? picked : all;
}

function sliceFunction(src, header) {
  const start = src.indexOf(header);
  assert.ok(start !== -1, 'source must contain ' + header);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end === -1 ? src.length : end);
}

// ---------------------------------------------------------------------------
// Arm: ledger
// ---------------------------------------------------------------------------
async function armLedger() {
  const ledger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
  const store = ledger._internal._ledger;
  const card = { gate_id: 'x', options: [{ id: 'approve', label: 'Approve' }] };

  await check('ledger: peekGate is a function of two parameters (gateId, sessionId)', () => {
    assert.equal(typeof ledger.peekGate, 'function', 'peekGate is not exported');
    assert.equal(ledger.peekGate.length, 2, 'peekGate must take exactly (gateId, sessionId)');
  });
  await check('ledger: consumeGate still takes exactly two parameters (no bypass argument)', () => {
    assert.equal(ledger.consumeGate.length, 2);
  });

  const G = 'g289-ledger-owner';
  ledger.mintGate(G, { card: card, sessionId: 'sessA', kind: 'general' });

  await check('ledger: peekGate by a stranger returns session_mismatch and leaves the entry', () => {
    const r = ledger.peekGate(G, 'sessB');
    assert.deepEqual(r, { ok: false, reason: 'session_mismatch' });
    assert.equal(store.has(G), true, 'a peek must never delete');
  });
  await check('ledger: peekGate by the owner twice returns the entry both times and leaves it', () => {
    const a = ledger.peekGate(G, 'sessA');
    const b = ledger.peekGate(G, 'sessA');
    assert.ok(a && a.sessionId === 'sessA' && a.card === card, 'first peek must return the stored entry');
    assert.ok(b && b.sessionId === 'sessA', 'second peek must return the stored entry');
    assert.equal(store.has(G), true);
  });
  await check('ledger: consumeGate by a stranger returns session_mismatch AND the entry stays (no burn)', () => {
    const r = ledger.consumeGate(G, 'sessB');
    assert.deepEqual(r, { ok: false, reason: 'session_mismatch' });
    assert.equal(store.has(G), true, 'a refused stranger must not burn the owner\'s gate');
  });
  await check('ledger: owner-after-stranger - the owner still consumes the gate the stranger could not', () => {
    const r = ledger.consumeGate(G, 'sessA');
    assert.ok(r && r.ok !== false && r.sessionId === 'sessA', 'owner consume must return the entry, got ' + JSON.stringify(r));
    assert.equal(store.has(G), false, 'a successful consume removes the entry');
  });
  await check('ledger: replay after a successful consume returns null (single use holds)', () => {
    assert.equal(ledger.consumeGate(G, 'sessA'), null);
    assert.equal(ledger.consumeGate(G, 'sessB'), null);
  });

  const E = 'g289-ledger-expired';
  ledger.mintGate(E, { card: card, sessionId: 'sessA', kind: 'general' });
  store.get(E).mintedAt = Date.now() - ledger.LEDGER_TTL_MS - 1000;
  await check('ledger: an expired entry peeks as null (never session_mismatch) and is not deleted by the peek', () => {
    assert.equal(ledger.peekGate(E, 'sessA'), null);
    assert.equal(ledger.peekGate(E, 'sessB'), null, 'expired outranks a session mismatch');
    assert.equal(store.has(E), true, 'a peek must not delete, not even an expired entry');
  });
  await check('ledger: consumeGate on an expired entry by a stranger is null, then removes it', () => {
    assert.equal(ledger.consumeGate(E, 'sessB'), null, 'expired never reports session_mismatch');
    assert.equal(store.has(E), false, 'consuming an expired entry clears it');
  });

  await check('ledger: a null session mints and peeks under the process-scoped sentinel only', () => {
    const N = 'g289-ledger-nosession';
    ledger.mintGate(N, { card: card, sessionId: null, kind: 'general' });
    try {
      const own = ledger.peekGate(N, null);
      assert.ok(own && own.sessionKey === ledger.ledgerSessionKey(null), 'the same process peeks its own null-session gate');
      assert.deepEqual(ledger.peekGate(N, 'sessA'), { ok: false, reason: 'session_mismatch' });
    } finally {
      store.delete(N);
    }
  });

  await check('ledger source mirror: in consumeGate the first _ledger.delete( comes after session_mismatch (the 369-07 detector rule)', () => {
    const src = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'), 'utf8');
    const body = sliceFunction(src, 'function consumeGate(');
    const sessionCheck = body.indexOf('session_mismatch');
    const del = body.indexOf('_ledger.delete(');
    assert.ok(sessionCheck !== -1, 'consumeGate must hold the session_mismatch check');
    assert.ok(del !== -1, 'consumeGate must hold a _ledger.delete( call');
    assert.ok(del > sessionCheck, 'the first _ledger.delete( (at ' + del + ') must come after session_mismatch (at ' + sessionCheck + ')');
  });
  await check('ledger source mirror: peekGate holds no .delete( call', () => {
    const src = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'), 'utf8');
    const body = sliceFunction(src, 'function peekGate(');
    assert.equal(body.indexOf('.delete('), -1, 'peekGate must never delete');
  });
}

// ---------------------------------------------------------------------------
// Arm: gate-answer (the real handlers, in process)
// ---------------------------------------------------------------------------
function makeFakeServer() {
  const registered = [];
  return {
    registerTool(name, config, handler) {
      const cfg = config || {};
      if (registered.some((r) => r.name === name)) throw new Error('DUPLICATE_TOOL_NAME: ' + name);
      registered.push({ name: name, description: cfg.description, handler: handler });
    },
    _registered: registered,
    server: {
      getClientCapabilities() { return {}; }, // no elicitation: the card rung
    },
  };
}

async function armGateAnswer() {
  const gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
  const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
  const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  const sessionRoom = require(path.join(REPO, 'lib', 'mcp', 'session-room.cjs'));
  const sessionBinding = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));

  // One scratch room named in the registry as the active room; S1 and S2 are
  // bound to it (the stranger shares the SAME room, as the 369 probe has it);
  // S3 has an identity and no binding, so the write-authority gate refuses it.
  const roomDir = path.join(ROOMS_HOME, 'room-x');
  fs.mkdirSync(roomDir, { recursive: true });
  roomDb.closeRoomDb(roomDb.openRoomDb(roomDir));
  fs.mkdirSync(path.join(ROOMS_HOME, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(ROOMS_HOME, '.rooms', 'registry.json'), JSON.stringify({
    active: 'room-x',
    rooms: { 'room-x': { slug: 'room-x', abs_path: roomDir } },
  }, null, 2));
  sessionBinding.writeSessionBinding('S1', { bound: ['room-x'], primary: 'room-x' });
  sessionBinding.writeSessionBinding('S2', { bound: ['room-x'], primary: 'room-x' });

  const fake = makeFakeServer();
  gateModule.register(fake, { surface: 'cli' });
  const renderHandler = fake._registered.find((r) => r.name === 'gate_render').handler;
  const answerHandler = fake._registered.find((r) => r.name === 'gate_answer').handler;

  const parse = (res) => {
    const p = JSON.parse(res.content[0].text);
    p._isError = !!res.isError;
    return p;
  };
  const mintCard = async (sessionId) => parse(await renderHandler({
    options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }],
  }, { sessionId: sessionId }));
  const answer = async (sessionId, gateId, chosen, verdict) => parse(await answerHandler(
    { gate_id: gateId, chosen: chosen, verdict: verdict || 'approve' }, { sessionId: sessionId }));

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
  const decisionNodeId = (gateId) => (typeof navigation.REASONING_NODE_ID === 'function'
    ? navigation.REASONING_NODE_ID('decision:gate', gateId)
    : 'decision:gate:' + gateId);

  // Case A: owner-after-stranger at the tool level.
  const a = await mintCard('S1');
  await check('gate-answer: the owner mints a gate (anti-vacuity control)', () => {
    assert.equal(a.ok, true, JSON.stringify(a));
    assert.equal(typeof a.gate_id, 'string');
  });
  await check('gate-answer: owner-after-stranger - a stranger bound to the same room is refused session_mismatch, writing nothing', async () => {
    const r = await answer('S2', a.gate_id, ['approve']);
    assert.equal(r._isError, true, 'the stranger answer must be an error response');
    assert.equal(r.reason, 'session_mismatch');
    assert.equal(rowCount(a.gate_id), 0, 'a refused stranger must write no bookkeeping row');
  });
  await check('gate-answer: owner-after-stranger - the owner then ratifies the same gate and the decision node exists', async () => {
    const r = await answer('S1', a.gate_id, ['approve']);
    assert.equal(r.ok, true, 'owner answer after a refused stranger must ratify, got ' + JSON.stringify(r));
    assert.equal(r.ratified, true);
    assert.equal(nodeExists(decisionNodeId(a.gate_id)), true, 'node ' + decisionNodeId(a.gate_id) + ' must exist in room.db');
  });
  await check('gate-answer: replay after success is refused unknown_or_expired_gate', async () => {
    const r = await answer('S1', a.gate_id, ['approve']);
    assert.equal(r._isError, true);
    assert.equal(r.reason, 'unknown_or_expired_gate');
  });

  // Case B: a chosen refusal does not burn the gate.
  const b = await mintCard('S1');
  await check('gate-answer: a chosen outside the card is refused chosen_not_in_card_options', async () => {
    const r = await answer('S1', b.gate_id, ['not-an-option']);
    assert.equal(r._isError, true);
    assert.equal(r.reason, 'chosen_not_in_card_options');
  });
  await check('gate-answer: after a chosen refusal the correct answer ratifies the same gate', async () => {
    const r = await answer('S1', b.gate_id, ['approve']);
    assert.equal(r.ok, true, 'the gate must survive a refused chosen, got ' + JSON.stringify(r));
    assert.equal(r.ratified, true);
  });

  // Case C: an unbound room refusal does not burn the gate.
  const c = await mintCard('S3');
  await check('gate-answer: an unbound session is refused with the no-bound-room reason', async () => {
    const r = await answer('S3', c.gate_id, ['approve']);
    assert.equal(r._isError, true);
    assert.equal(r.reason, sessionRoom.NO_BOUND_ROOM, 'expected the session-room NO_BOUND_ROOM value');
  });
  await check('gate-answer: after the session is bound the same gate ratifies', async () => {
    sessionBinding.writeSessionBinding('S3', { bound: ['room-x'], primary: 'room-x' });
    const r = await answer('S3', c.gate_id, ['approve']);
    assert.equal(r.ok, true, 'the gate must survive an unbound refusal, got ' + JSON.stringify(r));
    assert.equal(r.ratified, true);
  });

  // Case D: a double submit ratifies exactly once.
  const d = await mintCard('S1');
  await check('gate-answer: two concurrent approves ratify exactly once, with exactly one bookkeeping row', async () => {
    const both = await Promise.all([answer('S1', d.gate_id, ['approve']), answer('S1', d.gate_id, ['approve'])]);
    const ratified = both.filter((r) => r.ok === true && r.ratified === true);
    const refused = both.filter((r) => r.reason === 'unknown_or_expired_gate');
    assert.equal(ratified.length, 1, 'exactly one ratification, got ' + JSON.stringify(both));
    assert.equal(refused.length, 1, 'exactly one unknown_or_expired_gate, got ' + JSON.stringify(both));
    assert.equal(rowCount(d.gate_id), 1, 'exactly one gate_answer memory_event row for the gate');
  });

  // Case D2 (Phase 289 review WR-06): a material_step gate whose resumeFn
  // genuinely awaits. Case D's non-material gate has no await in the handler, so
  // Promise.all ran its two calls strictly one after the other and could not
  // detect a consume that moved after an await. Here the first call suspends
  // inside resumeFn while the second starts; exactly one resumeFn call must run.
  const d2 = 'g289-concurrent-material';
  const d2Counter = { n: 0 };
  gateLedger.mintGate(d2, {
    card: gateRender.normalizeCard({ gate_id: d2, options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }] }),
    sessionId: 'S1',
    kind: 'material_step',
    approving: ['approve'],
    resumeFn: async () => {
      d2Counter.n += 1;
      await new Promise((resolve) => setImmediate(resolve));
      return { ok: true, executed: true };
    },
  });
  await check('gate-answer: two concurrent approves on a material gate whose resumeFn awaits run resumeFn exactly once', async () => {
    const both = await Promise.all([answer('S1', d2, ['approve']), answer('S1', d2, ['approve'])]);
    assert.equal(d2Counter.n, 1, 'resumeFn must run exactly once, got ' + d2Counter.n + ' with ' + JSON.stringify(both));
    assert.equal(both.filter((r) => r.ok === true).length, 1, 'exactly one ratification, got ' + JSON.stringify(both));
    assert.equal(both.filter((r) => r.reason === 'unknown_or_expired_gate').length, 1, 'exactly one unknown_or_expired_gate, got ' + JSON.stringify(both));
    assert.equal(rowCount(d2), 1, 'exactly one bookkeeping row');
  });

  // Case E: a material_step gate with no resume owner is refused and kept.
  const e = 'g289-no-resume-owner';
  gateLedger.mintGate(e, {
    card: gateRender.normalizeCard({ gate_id: e, options: [{ id: 'approve', label: 'Approve' }] }),
    sessionId: 'S1',
    kind: 'material_step',
  });
  await check('gate-answer: a material_step gate with no resumeFn is refused resume_owner_missing', async () => {
    const r = await answer('S1', e, ['approve']);
    assert.equal(r._isError, true);
    assert.equal(r.reason, 'resume_owner_missing');
    assert.equal(rowCount(e), 0, 'no ratification row for a step that will never run');
  });
  await check('gate-answer: the resume_owner_missing refusal leaves the entry in the ledger', () => {
    assert.equal(typeof gateLedger.peekGate, 'function', 'peekGate is not exported');
    const entry = gateLedger.peekGate(e, 'S1');
    assert.ok(entry && entry.ok !== false && entry.kind === 'material_step', 'entry must remain, got ' + JSON.stringify(entry));
  });
  gateLedger._internal._ledger.delete(e);
}

// ---------------------------------------------------------------------------
// Arm: source (ordering inside the two consumers)
// ---------------------------------------------------------------------------
async function armSource() {
  const gateSrc = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'), 'utf8');
  const reg = gateSrc.search(/registerTool\(\s*'gate_answer',/);
  assert.ok(reg !== -1, 'gate.cjs must register gate_answer');
  const nextReg = gateSrc.indexOf('server.registerTool(', reg + 10);
  const handlerText = gateSrc.slice(reg, nextReg === -1 ? gateSrc.length : nextReg);

  await check('source: in the gate_answer handler a peek precedes _consumeLiveGate( with no await between them', () => {
    const peekAt = firstIndex(handlerText, ['gateLedger.peekGate(', '_peekLiveGate(']);
    const consumeAt = handlerText.indexOf('_consumeLiveGate(');
    assert.ok(peekAt !== -1, 'gate_answer must peek the ledger (gateLedger.peekGate( or _peekLiveGate()');
    assert.ok(consumeAt !== -1, 'gate_answer must still consume through _consumeLiveGate(');
    assert.ok(peekAt < consumeAt, 'the peek (at ' + peekAt + ') must precede the consume (at ' + consumeAt + ')');
    assert.equal(/\bawait\b/.test(handlerText.slice(peekAt, consumeAt)), false, 'no await between the peek and the consume');
  });
  // Phase 289 review WR-06: the first _consumeLiveGate( in the handler is the
  // binding-path consume, so the assertion above covers only that window. The
  // window that matters is peek to the MAIN consume (the last one, after
  // resolveMcpWriteRoom and openRoomDbForCaller). Check every consume, comments
  // stripped (the code comments name the word await on purpose), and prove the
  // detector is not vacuous by running it over a mutated copy.
  const awaitInWindow = (text) => {
    const peekAt = firstIndex(text, ['gateLedger.peekGate(', '_peekLiveGate(']);
    const consumes = [];
    for (let i = text.indexOf('_consumeLiveGate('); i !== -1; i = text.indexOf('_consumeLiveGate(', i + 1)) consumes.push(i);
    if (peekAt === -1 || consumes.length < 2) return { error: 'expected a peek and at least two consumes (binding path and main), got peek=' + peekAt + ' consumes=' + consumes.length };
    const hits = consumes.filter((at) => /\bawait\b/.test(stripComments(text.slice(peekAt, at))));
    return { hits: hits.length, windows: consumes.length };
  };
  await check('source: no await between the peek and ANY _consumeLiveGate( in the handler, the main consume included', () => {
    const r = awaitInWindow(handlerText);
    assert.equal(r.error, undefined, r.error);
    assert.equal(r.hits, 0, r.hits + ' of ' + r.windows + ' peek-to-consume windows contain an await');
  });
  await check('source: the main consume is the LAST _consumeLiveGate( and sits after openRoomDbForCaller (the window really spans the room open)', () => {
    const mainAt = handlerText.lastIndexOf('_consumeLiveGate(');
    const openAt = handlerText.indexOf('openRoomDbForCaller(roomDir)');
    assert.ok(openAt !== -1 && mainAt > openAt, 'main consume (at ' + mainAt + ') must follow openRoomDbForCaller (at ' + openAt + ')');
  });
  await check('source: the detector is not vacuous - an await inserted before openRoomDbForCaller is caught', () => {
    const mutated = handlerText.replace('const db = navigation.openRoomDbForCaller(roomDir);', 'await Promise.resolve();\n      const db = navigation.openRoomDbForCaller(roomDir);');
    assert.notEqual(mutated, handlerText, 'the mutation must apply');
    const r = awaitInWindow(mutated);
    assert.equal(r.error, undefined, r.error);
    assert.ok(r.hits >= 1, 'an await before the main consume must be detected, hits=' + r.hits);
  });

  const chainSrc = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tools', 'chain.cjs'), 'utf8');
  const resumeText = sliceFunction(chainSrc, 'async function _resumeFromGateAnswer(');
  await check('source: in _resumeFromGateAnswer the peek precedes validateChosenAgainstCard( which precedes _consumeResumeLedger(', () => {
    const peekAt = firstIndex(resumeText, ['gateLedger.peekGate(', '_peekResumeLedger(']);
    const validateAt = resumeText.indexOf('validateChosenAgainstCard(');
    const consumeAt = resumeText.indexOf('_consumeResumeLedger(');
    assert.ok(peekAt !== -1, '_resumeFromGateAnswer must peek the ledger');
    assert.ok(validateAt !== -1, '_resumeFromGateAnswer must validate chosen before consuming');
    assert.ok(consumeAt !== -1, '_resumeFromGateAnswer must still consume through _consumeResumeLedger(');
    assert.ok(peekAt < validateAt && validateAt < consumeAt, 'order must be peek < validate < consume, got ' + [peekAt, validateAt, consumeAt].join(' / '));
  });
  await check('source: no await between the chain peek and the chain consume', () => {
    const peekAt = firstIndex(resumeText, ['gateLedger.peekGate(', '_peekResumeLedger(']);
    const consumeAt = resumeText.indexOf('_consumeResumeLedger(');
    assert.ok(peekAt !== -1 && consumeAt !== -1 && peekAt < consumeAt, 'peek and consume must both exist, peek first');
    assert.equal(/\bawait\b/.test(resumeText.slice(peekAt, consumeAt)), false, 'no await between the peek and the consume');
  });
}

// Strips block comments and whole-line or trailing // comments. Good enough for
// the handler window: it holds no string literal containing //.
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

function firstIndex(text, needles) {
  let best = -1;
  for (const n of needles) {
    const i = text.indexOf(n);
    if (i !== -1 && (best === -1 || i < best)) best = i;
  }
  return best;
}

async function main() {
  const arms = parseArms(process.argv.slice(2));
  const table = { 'ledger': armLedger, 'gate-answer': armGateAnswer, 'source': armSource };
  try {
    for (const id of arms) {
      if (!table[id]) {
        failed += 1;
        console.log('FAIL: unknown arm ' + id + ' (ids: ledger, gate-answer, source)');
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
