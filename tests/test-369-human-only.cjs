// HUM369-02 and HUM369-03: the D-15 acceptance test (plan 369-21).
//
// D-15: only a person approves. The agent may PROPOSE a claim (the gate is minted on the person's browser
// session); it may never APPROVE one, with or without a forged principal; a direct MCP gate_answer from the
// adapter's own MCP session is refused session_mismatch; the only thing that ratifies is the browser click that
// carries the single-use render nonce readGate issued to that browser session for that exact gate.
//
// Arms 1-7 run the shell's server modules in process against the hermetic flag-ON daemon (fixture rooms).
// Arm 8 runs over real HTTP against the built shell (`cd ui/shell && npm run build`); it reports SKIP with the
// reason when the build output is absent (plan 31 requires it to have RUN). Exit 77 only for a daemon start failure.
//
// The Phase 289 line: a refused answer burns the gate before the ledger checks (lib/mcp/gate-ledger.cjs consumeGate),
// so an owner who answers after a stranger's refusal is refused unknown_or_expired_gate. That is the D-16 boundary,
// recorded here as the same KNOWN line tests/test-369-sessionful-acceptance.cjs arm 4 prints, and it flips by itself
// when Phase 289 lands.
//
// Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME; no CLAUDE_ACTIVE_ROOM or CLAUDE_CODE_SESSION_ID; every
// server binds 127.0.0.1 only; telemetry off; this test kills only the processes it spawned.
'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const SHELL = path.join(REPO, 'ui', 'shell');
const SHARED = path.join(REPO, 'ui', 'shared');
const STANDALONE = path.join(SHELL, '.next', 'standalone');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-humanonly-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP_HOME, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.DO_NOT_TRACK = '1';

// ui/shell resolves `mos-ui-shared/<name>` through its node_modules entry; Node refuses to strip types under
// node_modules, so the in-process arms resolve that specifier straight to ui/shared/src (the files the chassis bundles).
require('node:module').registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('mos-ui-shared/')) {
      return nextResolve(pathToFileURL(path.join(SHARED, 'src', specifier.slice('mos-ui-shared/'.length) + '.ts')).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const D = require('./helpers/mcp-daemon-369.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
let skipped = 0;
let envGap = null;
async function arm(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 10).join('\n    '));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const load = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

// Read-only look at a room.db: no write door, no mutation.
function readNodes(roomDir, like) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return db.prepare('SELECT id, type FROM nodes WHERE id LIKE ?').all(like);
  } finally {
    db.close();
  }
}

function claimIds(roomDir) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:%' ORDER BY rowid").all().map((r) => r.id);
  } finally {
    db.close();
  }
}

// Does consumeGate delete the ledger entry AFTER the session check (Phase 289, consume-after-checks)? Read from
// source so the KNOWN lines flip by themselves (the same detection tests/test-369-sessionful-acceptance.cjs uses).
function phase289Landed() {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'), 'utf8');
  const start = src.indexOf('function consumeGate(');
  assert.ok(start !== -1, 'consumeGate must exist');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  const sessionCheck = body.indexOf('session_mismatch');
  const del = body.indexOf('_ledger.delete(');
  assert.ok(sessionCheck !== -1 && del !== -1, 'consumeGate must hold a session check and a delete');
  return del > sessionCheck;
}

async function killChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', () => resolve()));
  try { process.kill(child.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
  await Promise.race([exited, sleep(5000)]);
}

const CLAIM_TEXTS = [
  'Local-first rooms keep a founder in control of the decision trail.',
  'A second claim a person must confirm before it becomes a decision.',
  'A third claim for the concurrent double submit.',
  'A fourth claim for the refused-answer release check.',
];

function proposalFor(subject) {
  return {
    subject_node_id: subject,
    verdict_options: [
      { id: 'approve', label: 'Approve', description: 'Confirm this claim.' },
      { id: 'reject', label: 'Reject' },
      { id: 'defer', label: 'Defer' },
    ],
    recommended_id: 'approve',
    evidence_node_ids: [],
    rationale: 'The claim names a located source.',
  };
}

// ---------------------------------------------------------------------------------------------
// Arms 1-7: in process
// ---------------------------------------------------------------------------------------------

async function inProcessArms() {
  const actionsMod = await load('ui/shell/server/actions.ts');
  const sessionsMod = await load('ui/shell/server/sessions.ts');
  const connMod = await load('ui/shell/server/connection-state.ts');
  const feedMod = await load('ui/shell/server/feed-routes.ts');
  const authMod = await load('ui/shell/server/auth.ts');
  const originMod = await load('ui/shell/server/human-origin.ts');
  const proposalMod = await load('ui/shared/src/proposal.ts');

  console.log('live arms against the hermetic flag-ON daemon');
  let h = null;
  try {
    h = await D.startDaemon({
      rooms: [{ slug: 'room-x', variant: 'wide', migrate: true, seed: CLAIM_TEXTS.map((text, i) => ({ kind: 'claim', text, variant: 'c' + i })) }],
    });
  } catch (err) {
    envGap = 'the hermetic daemon could not start (' + (err && err.message ? String(err.message).slice(0, 200) : err) + ')';
    console.log('ENV GAP: ' + envGap);
    return;
  }

  const roomDir = h.roomDirs['room-x'];
  const [S1, S2, S3, S4] = claimIds(roomDir);
  assert.ok(S1 && S2 && S3 && S4, 'four seeded claims');

  const daemonUrl = () => 'http://127.0.0.1:' + h.port;
  const pool = sessionsMod.makePool(daemonUrl);
  // The pool spy: every gate_answer the shell's browser sessions make is counted; a refusal can be injected.
  const spy = { count: 0, mode: 'pass', calls: [] };
  const realCall = pool.call;
  pool.call = async function (key, tool, args) {
    if (tool === 'gate_answer') {
      spy.count += 1;
      spy.calls.push({ key, args });
      if (spy.mode === 'refuse') {
        return { ok: true, isError: false, data: { ok: false, reason: 'stale_subject' }, text: '{"ok":false,"reason":"stale_subject"}', reconnected: false };
      }
    }
    return realCall.apply(pool, arguments);
  };
  const relay = feedMod.makeRelay(pool, daemonUrl);
  const connection = connMod.createConnectionStates();
  const proposalRef = { current: null };
  const proposalSource = { propose: (request) => proposalMod.fixedProposalSource(proposalRef.current).propose(request) };
  const nonces = originMod.createNonceStore();
  const actions = actionsMod.createShellActions({ pool, proposalSource, relay, connection, nonces });
  const store = authMod.createSessionStore();
  const X = authMod.issueSession(store).session;
  const Y = authMod.issueSession(store).session;
  const ctx = (principal, session) => ({ principal, browserSession: session || X });
  const human = (name, input) => actions.invoke(name, input, ctx('human'));
  const agent = (name, input) => actions.invoke(name, input, ctx('agent'));
  const propose = async (subject) => {
    const res = await agent('proposeDecision', { proposal: proposalFor(subject) });
    assert.strictEqual(res.ok, true, 'the agent proposes: ' + JSON.stringify(res));
    return res.gate_id;
  };
  const approveWith = (gate_id, render_nonce, extra) =>
    human('approveDecision', Object.assign({ gate_id, chosen: ['approve'], verdict: 'approve', render_nonce }, extra || {}));
  const decisionNodes = (gate) => readNodes(roomDir, 'decision:gate:' + gate);
  const phase289 = phase289Landed();

  let G1 = null;
  let G2 = null;
  let G3 = null;
  let N1 = null;
  const seenNonces = [];

  try {
    assert.deepStrictEqual(await human('openRoom', { room: 'room-x' }), { ok: true, room: 'room-x' });

    await arm('1 the agent proposes: the gate is minted on the browser session MCP key, never the adapter session', async () => {
      G1 = await propose(S1);
      const rec = actions.recordedGate(X.mcpKey, G1);
      assert.ok(rec, 'the gate is recorded against browser session X');
      assert.strictEqual(rec.mcp_key, X.mcpKey, 'recorded MCP key is X\'s own');
      const browserSid = (await pool.get(X.mcpKey)).mcpSessionId;
      const adapterSid = (await pool.adapterSession()).mcpSessionId;
      assert.ok(browserSid && adapterSid && browserSid !== adapterSid, 'the adapter has its own MCP session');
      const open = await human('listOpenGates', {});
      assert.ok(open.gates.some((g) => g.gate_id === G1), 'the person sees it waiting');
      assert.strictEqual(decisionNodes(G1).length, 0, 'nothing is decided by proposing');
    });

    await arm('2 the agent tries to approve through the same action, with a forged principal, and is refused human_only', async () => {
      const before = spy.count;
      const body = { gate_id: G1, chosen: ['approve'], verdict: 'approve' };
      const plain = await actions.invoke('approveDecision', body, ctx('agent'));
      assert.strictEqual(plain.ok, false);
      assert.strictEqual(plain.reason, 'human_only');
      const forged = await actions.invoke('approveDecision', Object.assign({ principal: 'human' }, body), ctx('agent'));
      assert.strictEqual(forged.reason, 'human_only');
      // Even carrying a nonce-shaped guess: the principal comes from the code path, the action never runs.
      const guessed = await actions.invoke('approveDecision', Object.assign({ principal: 'human', render_nonce: crypto.randomBytes(32).toString('base64url') }, body), ctx('agent'));
      assert.strictEqual(guessed.reason, 'human_only');
      assert.strictEqual(guessed.exposure, 'human');
      console.log('  forged principal: human in the input, agent path: ' + JSON.stringify(forged));
      const readAsAgent = await actions.invoke('readGate', { gate_id: G1 }, ctx('agent'));
      assert.strictEqual(readAsAgent.reason, 'human_only', 'the agent cannot read the gate, so it cannot obtain a nonce');
      assert.strictEqual(spy.count, before, 'no gate_answer was made');
      const open = await human('listOpenGates', {});
      assert.ok(open.gates.some((g) => g.gate_id === G1), 'G1 is still listed');
      assert.strictEqual(decisionNodes(G1).length, 0, 'no decision node exists');
    });

    await arm('3 a browser call with no nonce, another gate\'s nonce, or another session\'s nonce is refused human_only', async () => {
      const before = spy.count;
      const read = await human('readGate', { gate_id: G1 });
      assert.strictEqual(read.ok, true);
      assert.strictEqual(typeof read.render_nonce, 'string');
      assert.ok(read.render_nonce.length >= 43, 'a 32-byte base64url token');
      seenNonces.push(read.render_nonce);

      const none = await approveWith(G1, undefined);
      assert.deepStrictEqual([none.ok, none.reason, none.detail], [false, 'human_only', 'nonce_missing']);
      const blank = await approveWith(G1, '');
      assert.strictEqual(blank.detail, 'nonce_missing');

      // A nonce issued for a different gate (same browser session X).
      const otherGateNonce = nonces.issue({ gateId: 'gate-some-other', browserSessionId: X.mcpKey });
      const wrongGate = await approveWith(G1, otherGateNonce);
      assert.deepStrictEqual([wrongGate.ok, wrongGate.reason, wrongGate.detail], [false, 'human_only', 'nonce_mismatch']);

      // A nonce issued to another browser session Y for this very gate id.
      const otherSessionNonce = nonces.issue({ gateId: G1, browserSessionId: Y.mcpKey });
      const wrongSession = await approveWith(G1, otherSessionNonce);
      assert.deepStrictEqual([wrongSession.ok, wrongSession.reason, wrongSession.detail], [false, 'human_only', 'nonce_mismatch']);

      // A made-up token.
      const made = await approveWith(G1, crypto.randomBytes(32).toString('base64url'));
      assert.strictEqual(made.detail, 'nonce_mismatch');

      assert.strictEqual(spy.count, before, 'none of the refusals reached gate_answer');
      assert.strictEqual(decisionNodes(G1).length, 0);
      assert.ok((await human('listOpenGates', {})).gates.some((g) => g.gate_id === G1), 'G1 still waits');
      // X's own nonce was not disturbed by those refusals: it still reserves.
      assert.deepStrictEqual(nonces.reserve({ nonce: read.render_nonce, gateId: G1, browserSessionId: X.mcpKey }), { ok: true });
      nonces.release(read.render_nonce);
    });

    await arm('3b a refused or failed gate_answer releases the nonce (pool spy, shell-side), and a real refusal releases it too', async () => {
      // (i) the shell-side property, on its own gate G4, with the pool spy standing in for the daemon.
      const G4 = await propose(S1);
      const N4 = (await human('readGate', { gate_id: G4 })).render_nonce;
      assert.ok(N4);
      spy.mode = 'refuse';
      const before = spy.count;
      let refusal;
      try {
        refusal = await approveWith(G4, N4);
      } finally {
        spy.mode = 'pass';
      }
      assert.deepStrictEqual(refusal, { ok: false, reason: 'stale_subject' }, 'the refusal comes back unchanged');
      assert.strictEqual(spy.count - before, 1, 'the spy saw exactly one gate_answer call');
      assert.deepStrictEqual(nonces.reserve({ nonce: N4, gateId: G4, browserSessionId: X.mcpKey }), { ok: true }, 'N4 was released, not burned');
      nonces.release(N4);
      assert.ok((await human('listOpenGates', {})).gates.some((g) => g.gate_id === G4), 'G4 is still answerable');
      assert.strictEqual(decisionNodes(G4).length, 0);

      // A thrown failure (no MCP answer at all) also releases.
      const realCall2 = pool.call;
      pool.call = async function (key, tool, args) {
        if (tool === 'gate_answer') throw new Error('socket hang up (injected)');
        return realCall2.apply(pool, arguments);
      };
      let thrown;
      try {
        thrown = await approveWith(G4, N4);
      } finally {
        pool.call = realCall2;
      }
      assert.strictEqual(thrown.reason, 'mcp_unavailable', JSON.stringify(thrown));
      assert.deepStrictEqual(nonces.reserve({ nonce: N4, gateId: G4, browserSessionId: X.mcpKey }), { ok: true }, 'a thrown call released N4 as well');
      nonces.release(N4);

      // (ii) end to end: a value outside the card's options is a real gate_answer refusal.
      const G6 = await propose(S4);
      const first = (await human('readGate', { gate_id: G6 })).render_nonce;
      const bad = await human('approveDecision', { gate_id: G6, chosen: ['not-an-option'], verdict: 'approve', render_nonce: first });
      assert.strictEqual(bad.ok, false, JSON.stringify(bad));
      assert.notStrictEqual(bad.reason, 'human_only', 'a real room refusal, not a human-origin refusal: ' + JSON.stringify(bad));
      assert.deepStrictEqual(nonces.reserve({ nonce: first, gateId: G6, browserSessionId: X.mcpKey }), { ok: true }, 'the real refusal released the nonce');
      nonces.release(first);
      const reread = await human('readGate', { gate_id: G6 });
      assert.strictEqual(reread.ok, true, 'a refusal that is not unknown_or_expired_gate keeps the record: ' + JSON.stringify(reread));
      const retry = await approveWith(G6, reread.render_nonce);
      if (phase289) {
        assert.strictEqual(retry.ok, true, 'Phase 289 landed: the gate stays answerable after a refusal: ' + JSON.stringify(retry));
        assert.strictEqual(retry.ratified, true, JSON.stringify(retry));
        console.log('  refused answer left the gate answerable and the retry ratified (Phase 289 consume-after-checks is in)');
      } else {
        assert.strictEqual(retry.ok, false, JSON.stringify(retry));
        assert.strictEqual(retry.reason, 'unknown_or_expired_gate', JSON.stringify(retry));
        console.log("  KNOWN: a refused answer burns the gate before the ledger checks (lib/mcp/gate-ledger.cjs consumeGate and gate.cjs consume before validation); Phase 289 fixes it, plan 26 arm 9 and plan 27 prove it end to end");
      }
    });

    await arm('4 the agent through MCP directly: the adapter session is refused session_mismatch; owner-after-stranger is recorded', async () => {
      G2 = await propose(S2);
      const stranger = await pool.adapterCall('gate_answer', { gate_id: G2, chosen: ['approve'], verdict: 'approve' });
      assert.strictEqual(stranger.data && stranger.data.ok, false, JSON.stringify(stranger.data));
      assert.strictEqual(stranger.data.reason, 'session_mismatch', JSON.stringify(stranger.data));
      assert.strictEqual(decisionNodes(G2).length, 0, 'the stranger wrote nothing');
      // The D-16 boundary stays visible: the owner's own human answer after the stranger's refusal.
      const read = await human('readGate', { gate_id: G2 });
      assert.strictEqual(read.ok, true);
      const owner = await approveWith(G2, read.render_nonce);
      if (phase289) {
        assert.strictEqual(owner.ok, true, 'Phase 289 landed: the owner must ratify after a refused stranger: ' + JSON.stringify(owner));
        assert.strictEqual(owner.ratified, true, JSON.stringify(owner));
        console.log('  owner-after-stranger ratified (Phase 289 consume-after-checks is in)');
      } else {
        assert.strictEqual(owner.ok, false, 'owner-after-stranger must be the known refusal: ' + JSON.stringify(owner));
        assert.strictEqual(owner.reason, 'unknown_or_expired_gate', JSON.stringify(owner));
        console.log("  KNOWN: a cross-session refusal burns the owner's gate (spike 007 burn-probe); Phase 289 fixes it");
      }
    });

    await arm('5 the click: the nonce readGate issued ratifies; the decision node exists; reusing the nonce is refused nonce_used', async () => {
      const before = spy.count;
      const read = await human('readGate', { gate_id: G1 });
      assert.strictEqual(read.ok, true);
      N1 = read.render_nonce;
      assert.notStrictEqual(N1, seenNonces[0], 'a re-read issues a fresh nonce');
      // The earlier nonce was replaced by the re-read.
      assert.strictEqual((await approveWith(G1, seenNonces[0])).detail, 'nonce_mismatch');
      const rec = actions.recordedGate(X.mcpKey, G1);
      const answer = await approveWith(G1, N1, { chosen: [rec.recommended_id] });
      assert.strictEqual(answer.ok, true, JSON.stringify(answer));
      assert.strictEqual(answer.ratified, true, JSON.stringify(answer));
      assert.strictEqual(spy.count - before, 1, 'exactly one gate_answer');
      assert.strictEqual(decisionNodes(G1).length, 1, 'node decision:gate:' + G1 + ' exists');
      const replay = await approveWith(G1, N1);
      assert.deepStrictEqual([replay.ok, replay.reason, replay.detail], [false, 'human_only', 'nonce_used']);
      assert.strictEqual(spy.count - before, 1, 'the replay did not reach gate_answer');
    });

    await arm('7 a concurrent double submit with one nonce makes exactly one gate_answer call and one decision node', async () => {
      G3 = await propose(S3);
      const N3 = (await human('readGate', { gate_id: G3 })).render_nonce;
      const before = spy.count;
      const [a, b] = await Promise.all([approveWith(G3, N3), approveWith(G3, N3)]);
      const results = [a, b];
      const wins = results.filter((r) => r.ok === true);
      const losers = results.filter((r) => r.ok !== true);
      assert.strictEqual(wins.length, 1, JSON.stringify(results));
      assert.strictEqual(wins[0].ratified, true);
      assert.strictEqual(losers.length, 1);
      assert.strictEqual(losers[0].reason, 'human_only');
      assert.ok(['nonce_in_flight', 'nonce_used'].includes(losers[0].detail), JSON.stringify(losers[0]));
      const calls = spy.count - before;
      console.log('  two concurrent submits, one nonce: gate_answer calls = ' + calls + ', loser answered ' + losers[0].detail);
      assert.strictEqual(calls, 1, 'exactly one gate_answer call');
      assert.strictEqual(decisionNodes(G3).length, 1, 'one decision node');
    });

    await arm('6 static: gate_answer only inside approveDecision; the nonce never reaches an agent-path response; release sits in a finally', async () => {
      const src = fs.readFileSync(path.join(SHELL, 'server', 'actions.ts'), 'utf8');
      const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      const startMatch = /define\(\s*'approveDecision',\s*'human'/.exec(code);
      const start = startMatch ? startMatch.index : -1;
      const end = code.indexOf('async function invoke(');
      assert.ok(start > 0 && end > start, 'located the approveDecision definition');
      const outside = code.slice(0, start) + code.slice(end);
      assert.ok(!/gateAnswer\s*\(|gate_answer/.test(outside), 'gate_answer is reached nowhere outside approveDecision');
      assert.strictEqual((code.match(/gateAnswer\s*\(/g) || []).length, 1, 'one call site');
      const body = code.slice(start, end);
      assert.ok(/gateAnswer\s*\(/.test(body), 'and it is inside approveDecision');
      assert.ok(body.indexOf('nonces.reserve(') !== -1 && body.indexOf('nonces.reserve(') < body.indexOf('gateAnswer('), 'reserve runs before the MCP call');
      assert.ok(/finally\s*\{[^}]*nonces\.release\(/.test(body), 'release sits in a finally');
      assert.ok(/nonces\.burn\(/.test(body) && body.indexOf('nonces.burn(') > body.indexOf('gateAnswer('), 'burn only after the answer');
      assert.ok(/data\.ok === true\)\s*\{[^}]*nonces\.burn\(/.test(body), 'burn only when gate_answer returned ok');
      // Nonces are issued in one place: inside readGate (human-only).
      assert.strictEqual((code.match(/nonces\.issue\(/g) || []).length, 1, 'one issue site');
      const readStart = code.indexOf("define('readGate', 'human'");
      const readEnd = code.indexOf("define('listOpenGates'");
      assert.ok(readStart > 0 && code.indexOf('nonces.issue(') > readStart && code.indexOf('nonces.issue(') < readEnd, 'issued inside readGate');
      // Dynamic: no agent-path response (and no human answer except readGate) carries a nonce.
      const agentAnswers = [
        await agent('listRooms', {}),
        await agent('roomDoc', {}),
        await agent('proposeDecision', { proposal: proposalFor(S1) }),
        await agent('readArtifact', { path: '../outside.md' }),
        await human('listOpenGates', {}),
        await human('roomDoc', {}),
      ];
      for (const a of agentAnswers) {
        const text = JSON.stringify(a);
        assert.ok(!/render_nonce/.test(text), 'no nonce field: ' + text.slice(0, 120));
        for (const n of seenNonces.concat([N1])) if (n) assert.ok(!text.includes(n), 'an issued nonce leaked into a response');
      }
      // The client keeps the nonce in page memory only.
      const api = fs.readFileSync(path.join(SHELL, 'client', 'api.ts'), 'utf8');
      assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB|location\./.test(api), 'no storage, cookie or URL use');
      // The nonce lifetime equals the gate ledger TTL, by value.
      const ledger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
      assert.strictEqual(originMod.DEFAULT_NONCE_TTL_MS, ledger.LEDGER_TTL_MS, 'nonce TTL matches the gate ledger TTL');
      for (const f of ['human-origin.ts', 'actions.ts']) {
        const t = fs.readFileSync(path.join(SHELL, 'server', f), 'utf8');
        assert.ok(!t.includes(EM) && !t.includes(EN), f + ' carries a long dash');
      }
    });

    await arm('6b the nonce store: single use, expiry, re-issue and in-flight semantics', async () => {
      let t = 1000;
      const s = originMod.createNonceStore({ now: () => t, ttlMs: 100 });
      const n = s.issue({ gateId: 'g', browserSessionId: 'b' });
      assert.ok(/^[A-Za-z0-9_-]{43}$/.test(n), 'a 32-byte base64url token: ' + n);
      assert.strictEqual(s.issue({ gateId: 'g2', browserSessionId: 'b' }) === n, false);
      assert.strictEqual(s.reserve({ nonce: n, gateId: 'g', browserSessionId: 'b' }).ok, true);
      assert.strictEqual(s.reserve({ nonce: n, gateId: 'g', browserSessionId: 'b' }).reason, 'nonce_in_flight');
      assert.strictEqual(s.issue({ gateId: 'g', browserSessionId: 'b' }), n, 'a re-read while in flight returns the reserved nonce');
      s.release(n);
      assert.strictEqual(s.reserve({ nonce: n, gateId: 'g', browserSessionId: 'b' }).ok, true);
      s.burn(n);
      assert.strictEqual(s.reserve({ nonce: n, gateId: 'g', browserSessionId: 'b' }).reason, 'nonce_used');
      const m = s.issue({ gateId: 'g', browserSessionId: 'b' });
      assert.notStrictEqual(m, n);
      assert.strictEqual(s.reserve({ nonce: n, gateId: 'g', browserSessionId: 'b' }).reason, 'nonce_mismatch', 'a re-issue invalidates the earlier nonce');
      t += 101;
      assert.strictEqual(s.reserve({ nonce: m, gateId: 'g', browserSessionId: 'b' }).reason, 'nonce_expired');
      assert.strictEqual(s.reserve({ nonce: undefined, gateId: 'g', browserSessionId: 'b' }).reason, 'nonce_missing');
      const k = s.issue({ gateId: 'g', browserSessionId: 'b' });
      s.forgetSession('b');
      assert.strictEqual(s.reserve({ nonce: k, gateId: 'g', browserSessionId: 'b' }).reason, 'nonce_mismatch');
      assert.strictEqual(s.size(), 0, 'forgetSession dropped the session records');
    });
  } finally {
    await pool.closeAll();
    await D.stopDaemon(h);
  }
}

// ---------------------------------------------------------------------------------------------
// Arm 8: over real HTTP against the built shell
// ---------------------------------------------------------------------------------------------

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

function request(port, opts) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: opts.method || 'GET', path: opts.path, headers: opts.headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('request timeout ' + opts.path)));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function waitUntil(fn, ms, what) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return; } catch (_e) { /* retry */ }
    if (Date.now() > end) throw new Error('timeout waiting for ' + what);
    await sleep(100);
  }
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const code = () => crypto.randomBytes(32).toString('base64url');

// The ruled shape: the built output runs with ONLY the plugin root's node_modules reachable (the same tree
// test-369-shell-actions.cjs builds, cached under the OS temp dir by manifest hash).
function rootNodeModules() {
  const repoNm = path.join(REPO, 'node_modules');
  if (fs.existsSync(path.join(repoNm, 'next', 'package.json')) && fs.existsSync(path.join(repoNm, 'react-dom', 'package.json'))) return repoNm;
  const key = crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, 'package.json'))).update(fs.readFileSync(path.join(REPO, 'npm-shrinkwrap.json'))).digest('hex').slice(0, 16);
  const cache = path.join(os.tmpdir(), 'mos-369-root-deps-' + key);
  const nm = path.join(cache, 'node_modules');
  if (fs.existsSync(path.join(nm, '.mos-complete'))) return nm;
  return null;
}

function makePluginTree(nm) {
  const plugin = path.join(TMP_HOME, 'plugin');
  fs.mkdirSync(path.join(plugin, 'lib', 'ui-shell'), { recursive: true });
  fs.symlinkSync(nm, path.join(plugin, 'node_modules'), 'dir');
  const dist = path.join(plugin, 'lib', 'ui-shell', 'dist');
  fs.cpSync(STANDALONE, dist, { recursive: true });
  return dist;
}

async function httpArm() {
  if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) {
    skipped += 1;
    console.log('  SKIP 8 over real HTTP: the shell is not built (cd ui/shell && npm run build)');
    return;
  }
  const nm = rootNodeModules();
  if (nm === null) {
    skipped += 1;
    console.log('  SKIP 8 over real HTTP: the root dependencies are not installed for the plugin-like tree (npm ci --ignore-scripts at the repo root)');
    return;
  }
  const dist = makePluginTree(nm);

  console.log('HTTP arm against the built shell');
  const NODE_TEXT = 'A note about node-live-sel-369: the person must click to confirm.';
  let h = null;
  try {
    h = await D.startDaemon({ rooms: [{ slug: 'room-h', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: NODE_TEXT, variant: 'h' }] }] });
  } catch (err) {
    envGap = 'the hermetic daemon could not start for the HTTP arm (' + String(err && err.message).slice(0, 200) + ')';
    console.log('ENV GAP: ' + envGap);
    return;
  }
  const roomDir = h.roomDirs['room-h'];

  const shellPort = await freePort();
  const tokenFile = path.join(TMP_HOME, 'ctl', 'control.token');
  const c1 = code();
  const env = Object.assign({}, process.env, {
    HOME: TMP_HOME, USERPROFILE: TMP_HOME, MINDRIAN_ROOMS_HOME: path.join(TMP_HOME, 'rooms'),
    MOS_DAEMON_URL: 'http://127.0.0.1:' + h.port, MOS_SHELL_PORT: String(shellPort), MOS_PROPOSAL_SOURCE: 'adapter',
    MOS_SHELL_BOOTSTRAP_SHA256: sha(c1), MOS_SHELL_CONTROL_TOKEN_FILE: tokenFile,
    HOSTNAME: '127.0.0.1', PORT: String(shellPort), NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
  });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  const shell = cp.spawn(process.execPath, ['server.js'], { cwd: dist, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  shell.stdout.on('data', (d) => { log += d; });
  shell.stderr.on('data', (d) => { log += d; });
  const origin = 'http://127.0.0.1:' + shellPort;
  const NONE = { 'sec-fetch-site': 'none' };

  async function signIn(c) {
    const r = await request(shellPort, { path: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: NONE });
    assert.strictEqual(r.status, 303, 'sign-in answered ' + r.status + ': ' + r.body.slice(0, 120));
    const cookie = [].concat(r.headers['set-cookie'] || [])[0].split(';')[0];
    const page = await request(shellPort, { path: '/', headers: { cookie } });
    const m = /<meta name="mos-csrf" content="([A-Za-z0-9_-]+)"/.exec(page.body);
    assert.ok(m, 'the signed-in page carries the CSRF meta tag');
    return { cookie, csrf: m[1] };
  }
  function post(session, name, body, extra) {
    const headers = Object.assign({ 'content-type': 'application/json', origin, 'sec-fetch-site': 'same-origin' }, extra || {});
    if (session && session.cookie) headers.cookie = session.cookie;
    if (session && session.csrf && !(extra && extra.omitCsrf)) headers['x-mos-csrf'] = session.csrf;
    delete headers.omitCsrf;
    return request(shellPort, { method: 'POST', path: '/api/actions/' + name, headers, body: JSON.stringify(body || {}) });
  }
  const json = (r) => { try { return JSON.parse(r.body); } catch (_e) { return null; } };

  try {
    await waitUntil(async () => fs.existsSync(tokenFile) && (await request(shellPort, { path: '/auth/bootstrap', headers: NONE })).status > 0, 25000, 'the shell to answer');
    const A = await signIn(c1);

    await arm('8 over real HTTP: an approve POST without the cookie, without the CSRF header, or with a forged Origin is refused before any action code runs; the genuine click then ratifies', async () => {
      assert.strictEqual(json(await post(A, 'openRoom', { room: 'room-h' })).ok, true);
      const asked = json(await post(A, 'askClaude', { selectedNodeId: 'node-live-sel-369', question: 'Should this claim be confirmed?' }));
      assert.strictEqual(asked.ok, true, 'the agent proposal minted a gate on the browser session: ' + JSON.stringify(asked));
      const gate = asked.gate_id;
      const read = json(await post(A, 'readGate', { gate_id: gate }));
      assert.strictEqual(read.ok, true, JSON.stringify(read).slice(0, 200));
      const nonce = read.render_nonce;
      assert.strictEqual(typeof nonce, 'string');
      const chosen = [read.gate.recommended_id];
      const body = { gate_id: gate, chosen, verdict: 'approve', render_nonce: nonce };

      const listed = async () => (json(await post(A, 'listOpenGates', {})).gates || []).map((g) => g.gate_id);
      assert.ok((await listed()).includes(gate), 'the gate is listed');
      assert.strictEqual(readNodes(roomDir, 'decision:gate:' + gate).length, 0);

      const noCookie = await post({ csrf: A.csrf }, 'approveDecision', body);
      assert.ok([401, 403].includes(noCookie.status), 'no cookie: ' + noCookie.status + ' ' + noCookie.body);
      const noCsrf = await post(A, 'approveDecision', body, { omitCsrf: true });
      assert.strictEqual(noCsrf.status, 403, noCsrf.body);
      assert.strictEqual(json(noCsrf).reason, 'csrf_missing');
      const evil = await post(A, 'approveDecision', body, { origin: 'http://evil.example' });
      assert.strictEqual(evil.status, 403, evil.body);
      const crossSite = await post(A, 'approveDecision', body, { 'sec-fetch-site': 'cross-site' });
      assert.strictEqual(crossSite.status, 403, crossSite.body);
      for (const r of [noCookie, noCsrf, evil, crossSite]) {
        assert.ok(!/ratified|decision:gate/.test(r.body), 'no approval came back: ' + r.body);
      }
      assert.ok((await listed()).includes(gate), 'the gate is still listed: no gate_answer was made');
      assert.strictEqual(readNodes(roomDir, 'decision:gate:' + gate).length, 0, 'no decision node exists');

      // A body that tries to be an agent changes nothing; one with no nonce is refused by the action.
      const forged = await post(A, 'approveDecision', { gate_id: gate, chosen, verdict: 'approve', principal: 'human' });
      assert.strictEqual(forged.status, 403, forged.body);
      assert.strictEqual(json(forged).detail, 'nonce_missing');
      assert.strictEqual(readNodes(roomDir, 'decision:gate:' + gate).length, 0);

      // The refusals above did not spend the nonce: the genuine click (cookie, CSRF, Origin, nonce) ratifies.
      const click = await post(A, 'approveDecision', body);
      assert.strictEqual(click.status, 200, click.body);
      const answer = json(click);
      assert.strictEqual(answer.ok, true, click.body);
      assert.strictEqual(answer.ratified, true, click.body);
      assert.strictEqual(readNodes(roomDir, 'decision:gate:' + gate).length, 1, 'the decision node exists');
      const replay = json(await post(A, 'approveDecision', body));
      assert.deepStrictEqual([replay.ok, replay.reason, replay.detail], [false, 'human_only', 'nonce_used']);
    });
  } finally {
    await killChild(shell);
    await D.stopDaemon(h);
    if (failed) console.log('--- shell log (tail) ---\n' + log.split('\n').slice(-12).join('\n'));
  }
}

async function main() {
  await inProcessArms();
  if (envGap === null) await httpArm();
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  console.log('\nPASS=' + passed + ' FAIL=' + failed + ' SKIP=' + skipped);
  if (failed > 0) process.exit(1);
  if (envGap) {
    console.log('ENV GAP: ' + envGap + ' (exit 77)');
    process.exit(77);
  }
  process.exit(0);
}

main().catch((e) => {
  console.log('FATAL ' + (e && e.stack ? e.stack : e));
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(1);
});
