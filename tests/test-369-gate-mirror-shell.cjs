#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 42 (SHELL369-12 shell half, GREC369-05, REV369-04 and REV369-06 shell halves) --
 * the shell's actions over the gate contract of plans 33, 36 and 38.
 * ==========================================================================
 * Why it exists. A gate Larry raises in Claude Code lives in a stdio process's ledger; the room
 * holds only its contract record. The shell must (1) LIST such gates for the bound room through
 * gate_list, (2) answer one through a mirror raised on the browser session's own MCP key (the
 * nonce-bound, human-only durable path), (3) read the room's saved answer for an old gate id after
 * a restart ("already recorded", not "no longer open"), (4) refuse a verdict that does not match
 * the chosen option, and (5) keep a gate whose lookup failed instead of dropping it.
 *
 * Runs the shell's server modules in process (the registerHooks resolver of
 * tests/test-369-shell-actions.cjs) over a live hermetic flag-ON daemon (tests/helpers/mcp-daemon-369.cjs)
 * and a live Claude Code shaped stdio raiser (tests/helpers/cli-gate-369.cjs).
 *
 * Arms:
 *   1  a gate raised by the CLI process is listed once with raised_elsewhere, header, subject, evidence
 *      count and minted time; the shell's own gate is listed once
 *   2  readGate on it raises a mirror on the browser session: page-facing id equals the source id, no
 *      MCP key or mirror ledger id in the JSON, one mirror reused on a second read, a nonce is issued
 *   3  approveDecision answers the mirror's ledger id; the room holds the decision node and the source
 *      anchor; the gate leaves the list; the owner's later answer replays answered_elsewhere
 *   4  gap 2: a fresh registry (a shell restart) reads an answered gate as answered with the recorded
 *      verdict and chosen; expired reads gate_expired; a never-seen id reads unknown_gate
 *   5  WR-06: a gate_list failure reads replay_lookup_failed and keeps the records; the list says
 *      raised_unavailable; a replay_lookup_failed answer keeps the gate; a retry then works
 *   6  WR-03: an approve naming Hold, or a reject naming approve, is verdict_chosen_mismatch with no
 *      gate_answer call and a reusable nonce; proposeDecision declares approving [approve]; a mirror
 *      carries the recorded approving ids
 *   7  a second browser session whose mirror outlived the first session's answer reads
 *      replayed and answered_elsewhere and writes nothing new
 *   8  the agent principal cannot call readGate or listOpenGates; one nonces.issue and one gateAnswer
 *      call site in actions.ts
 *
 * Exit 0 all PASS, 1 any FAIL, 77 only when @modelcontextprotocol/client cannot be loaded or the
 * daemon cannot start. Every child it spawns is killed in a finally. Hyphens only. CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const SHARED = path.join(REPO, 'ui', 'shared');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-mirror-shell-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP_HOME, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.DO_NOT_TRACK = '1';

try {
  require('@modelcontextprotocol/client');
} catch (e) {
  console.log('SKIP: @modelcontextprotocol/client cannot be loaded (' + (e && e.message ? e.message : e) + ')');
  process.exit(77);
}

// ui/shell resolves `mos-ui-shared/<name>` through a node_modules COPY that Node will not strip types from:
// the in-process arms resolve it straight to ui/shared/src (the way tests/test-369-shell-actions.cjs does).
require('node:module').registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('mos-ui-shared/')) {
      return nextResolve(pathToFileURL(path.join(SHARED, 'src', specifier.slice('mos-ui-shared/'.length) + '.ts')).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const D = require('./helpers/mcp-daemon-369.cjs');
const { cliClient } = require('./helpers/cli-gate-369.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const load = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

let passed = 0;
let failed = 0;
async function arm(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 8).join('\n    '));
  }
}

// -- raw reads of room.db (tests/ is on the Canon Part 9 allow-list) ------------------------
function withDb(roomDir, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
function claimIds(roomDir) {
  return withDb(roomDir, (db) => db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:%' ORDER BY rowid").all().map((r) => r.id));
}
function nodeExists(roomDir, id) {
  return withDb(roomDir, (db) => !!db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(id));
}
function countLike(roomDir, pattern) {
  return withDb(roomDir, (db) => Number(db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE id LIKE ?').get(pattern).c));
}
function anchorRows(roomDir, gateId) {
  return withDb(roomDir, (db) => db.prepare(
    "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
    "AND json_extract(properties, '$.dedupe_key') = ?"
  ).all('gate_answer:' + gateId));
}
function answerRowCount(roomDir) {
  return withDb(roomDir, (db) => Number(db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
    "AND json_extract(properties, '$.dedupe_key') LIKE 'gate_answer:%'"
  ).get().c));
}

const OPTIONS = [
  { id: 'approve', label: 'Approve', rank: 1, description: 'Recommended: ratify.', preview: 'Ratifies the claim.' },
  { id: 'hold', label: 'Hold', rank: 2 },
  { id: 'reject', label: 'Reject', rank: 3 },
];

const SEED = [
  { kind: 'claim', text: 'Local-first rooms keep a founder in control of the decision trail.' },
  { kind: 'claim', text: 'A second claim for the shell mirror test.' },
  { kind: 'claim', text: 'A third claim for the shell mirror test.' },
  { kind: 'claim', text: 'A fourth claim for the shell mirror test.' },
  { kind: 'claim', text: 'A fifth claim for the shell mirror test.' },
  { kind: 'claim', text: 'A sixth claim for the shell mirror test.' },
  { kind: 'claim', text: 'A seventh claim for the shell mirror test.' },
  { kind: 'claim', text: 'An eighth claim for the shell mirror test.' },
  { kind: 'source', url: 'https://example.org/369/shell-mirror-1', retrieved_at: '2026-10-01T00:00:00Z' },
];

// A pool wrapper: records every call, lets an arm answer one tool differently for a while.
function spyPool(base) {
  const calls = [];
  const overrides = new Map();
  const wrapped = Object.assign({}, base, {
    async call(key, tool, args) {
      calls.push({ key: key, tool: tool, args: args });
      const o = overrides.get(tool);
      if (o) {
        const r = await o(key, tool, args);
        if (r) return r;
      }
      return base.call(key, tool, args);
    },
  });
  return {
    pool: wrapped,
    calls: calls,
    override(tool, fn) { overrides.set(tool, fn); },
    clear(tool) { overrides.delete(tool); },
    count(tool) { return calls.filter((c) => c.tool === tool).length; },
  };
}
const fakeResult = (data) => ({ ok: false, isError: false, data: data, text: JSON.stringify(data), reconnected: false });

async function main() {
  const actionsMod = await load('ui/shell/server/actions.ts');
  const sessionsMod = await load('ui/shell/server/sessions.ts');
  const connMod = await load('ui/shell/server/connection-state.ts');
  const feedMod = await load('ui/shell/server/feed-routes.ts');
  const authMod = await load('ui/shell/server/auth.ts');
  const proposalMod = await load('ui/shared/src/proposal.ts');

  let h = null;
  let cli = null;
  const clients = [];
  let pool = null;
  try {
    try {
      h = await D.startDaemon({
        rooms: [
          { slug: 'room-x', variant: 'wide', migrate: true, seed: SEED },
          { slug: 'room-y', variant: 'wide', migrate: true },
        ],
        extraEnv: { MINDRIAN_TEST_MODE: '1' },
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      process.exit(77);
    }
    const roomX = h.roomDirs['room-x'];
    const claims = claimIds(roomX);
    assert.ok(claims.length >= 8, 'room-x must hold the seeded claims: ' + claims.length);
    console.log('rooms: room-x, room-y; seeded claims: ' + claims.length);

    cli = await cliClient({ roomsHome: h.roomsHome, home: h.env.HOME, sessionId: 'cli-gate-mirror-shell-369' });
    await cli.bind('room-x');
    const raise = (args) => cli.call('gate_render', Object.assign({ kind: 'general', select_mode: 'single', options: OPTIONS, approving: ['approve'] }, args));

    const daemonUrl = () => 'http://127.0.0.1:' + h.port;
    pool = sessionsMod.makePool(daemonUrl);
    const spy = spyPool(pool);
    const relay = feedMod.makeRelay(pool, daemonUrl);
    const connection = connMod.createConnectionStates();
    const proposalRef = { current: null };
    const proposalSource = { propose: (request) => proposalMod.fixedProposalSource(proposalRef.current).propose(request) };
    const makeActions = (p) => actionsMod.createShellActions({ pool: p, proposalSource, relay, connection });
    const actions = makeActions(spy.pool);
    const store = authMod.createSessionStore();
    const X = authMod.issueSession(store).session;
    const human = (name, input, a, sess) => (a || actions).invoke(name, input, { principal: 'human', browserSession: sess || X });
    const proposal = (subject, extra) => Object.assign({
      subject_node_id: subject,
      verdict_options: [
        { id: 'approve', label: 'Approve', description: 'Confirm this claim.' },
        { id: 'reject', label: 'Reject' },
        { id: 'defer', label: 'Defer' },
      ],
      recommended_id: 'approve',
      evidence_node_ids: [],
      rationale: 'The claim names a located source.',
    }, extra || {});

    assert.equal((await human('openRoom', { room: 'room-x' })).ok, true, 'the browser session opens room-x');

    let S = null;
    let G = null;

    await arm('1 a gate raised by the CLI process is listed once for the bound room, marked raised_elsewhere; the shell\'s own gate is listed once', async () => {
      const src = await raise({ header: 'Ratify the first claim?', subject_node_id: claims[0], evidence_node_ids: [claims[1]] });
      assert.equal(src.ok, true, 'cli gate_render: ' + JSON.stringify(src));
      S = src.gate_id;
      proposalRef.current = proposal(claims[2]);
      const own = await human('askClaude', { selectedNodeId: claims[2], question: 'Confirm the third claim?' });
      assert.equal(own.ok, true, JSON.stringify(own));
      G = own.gate_id;
      const list = await human('listOpenGates', {});
      assert.equal(list.ok, true, JSON.stringify(list));
      assert.ok(!list.raised_unavailable, 'gate_list answered: ' + JSON.stringify(list));
      const ids = list.gates.map((g) => g.gate_id);
      assert.equal(ids.filter((i) => i === S).length, 1, 'S is listed once: ' + ids.join(','));
      assert.equal(ids.filter((i) => i === G).length, 1, 'the shell\'s own gate is listed once, not again through gate_list: ' + ids.join(','));
      assert.equal(list.waiting, list.gates.length);
      const s = list.gates.find((g) => g.gate_id === S);
      assert.equal(s.raised_elsewhere, true, JSON.stringify(s));
      assert.equal(s.header, 'Ratify the first claim?');
      assert.equal(s.subject_node_id, claims[0]);
      assert.equal(s.evidence_count, 1);
      assert.equal(typeof s.minted_at, 'number');
      assert.equal(s.room, 'room-x');
      const g = list.gates.find((x) => x.gate_id === G);
      assert.notEqual(g.raised_elsewhere, true, 'the shell\'s own gate is not raised elsewhere');
    });

    let mirrorLedgerId = null;
    let sNonce = null;
    await arm('2 readGate on a raised gate raises ONE mirror on the browser session; the page-facing id is the source id; no key or ledger id leaks', async () => {
      assert.ok(S, 'arm 1 raised S');
      const read = await human('readGate', { gate_id: S });
      assert.equal(read.ok, true, JSON.stringify(read));
      assert.equal(read.gate.gate_id, S);
      assert.equal(read.gate.proposal_from, 'raised_elsewhere');
      assert.deepEqual(read.gate.options.map((o) => o.id), ['approve', 'hold', 'reject']);
      assert.equal(read.gate.header, 'Ratify the first claim?');
      assert.equal(read.gate.subject_node_id, claims[0]);
      assert.equal(read.gate.recommended_id, 'approve');
      assert.equal(typeof read.render_nonce, 'string');
      sNonce = read.render_nonce;
      const rec = actions.recordedGate(X.mcpKey, S);
      assert.ok(rec, 'the session holds a card for S');
      mirrorLedgerId = rec.mcp_gate_id;
      assert.ok(typeof mirrorLedgerId === 'string' && mirrorLedgerId.length > 0 && mirrorLedgerId !== S, 'the mirror has its own ledger id: ' + mirrorLedgerId);
      assert.equal(rec.source_gate_id, S);
      const json = JSON.stringify(read);
      assert.ok(!json.includes(mirrorLedgerId), 'the mirror ledger id never reaches the page');
      assert.ok(!json.includes(X.mcpKey) && !('mcp_key' in read.gate), 'the MCP key never reaches the page');
      assert.ok(!('mcp_gate_id' in read.gate), 'mcp_gate_id is stripped');
      // One mirror per session and source: a second read reuses it.
      const again = await human('readGate', { gate_id: S });
      assert.equal(again.ok, true);
      assert.equal(actions.recordedGate(X.mcpKey, S).mcp_gate_id, mirrorLedgerId, 'the same mirror');
      const mirrorCalls = spy.calls.filter((c) => c.tool === 'gate_render' && c.args && c.args.mirror_of === S);
      assert.equal(mirrorCalls.length, 1, 'exactly one gate_render mirror_of call, got ' + mirrorCalls.length);
      const listed = await human('listOpenGates', {});
      assert.equal(listed.gates.filter((g) => g.gate_id === S).length, 1, 'the mirror does not double the list');
      // The mirror belongs to the browser session: another session cannot answer it.
      const stranger = await pool.adapterCall('gate_answer', { gate_id: mirrorLedgerId, chosen: ['approve'], verdict: 'approve' });
      assert.equal(stranger.data && stranger.data.ok, false, 'a stranger cannot answer the mirror: ' + JSON.stringify(stranger.data));
    });

    await arm('3 approveDecision answers the mirror through the nonce-bound path; the room records one decision; the owner replays answered_elsewhere', async () => {
      assert.ok(S && mirrorLedgerId && sNonce);
      const tooEarly = await human('approveDecision', { gate_id: S, chosen: ['approve'], verdict: 'approve' });
      assert.equal(tooEarly.reason, 'human_only', 'no nonce, no answer: ' + JSON.stringify(tooEarly));
      const before = answerRowCount(roomX);
      const read = await human('readGate', { gate_id: S });
      const answer = await human('approveDecision', { gate_id: S, chosen: ['approve'], verdict: 'approve', render_nonce: read.render_nonce });
      assert.equal(answer.ok, true, JSON.stringify(answer));
      assert.ok(!JSON.stringify(answer).includes('"gate_id":"' + mirrorLedgerId + '"'), 'the answer does not name the mirror ledger id as the gate: ' + JSON.stringify(answer).slice(0, 300));
      assert.ok(nodeExists(roomX, 'decision:gate:' + mirrorLedgerId), 'the mirror\'s decision node is in the room');
      const anchors = anchorRows(roomX, S);
      assert.equal(anchors.length, 1, 'one source anchor, got ' + anchors.length);
      assert.equal(JSON.parse(anchors[0].properties).answered_via, mirrorLedgerId);
      assert.equal(answerRowCount(roomX), before + 2, 'the mirror answer and the source anchor are the only new answer rows');
      const list = await human('listOpenGates', {});
      assert.ok(!list.gates.some((g) => g.gate_id === S), 'S left the list');
      const done = await human('readGate', { gate_id: S });
      assert.equal(done.ok, true, JSON.stringify(done));
      assert.equal(done.answered.verdict, 'approve');
      assert.deepEqual(done.answered.chosen, ['approve']);
      const owner = await cli.call('gate_answer', { gate_id: S, chosen: ['hold'], verdict: 'defer' });
      assert.equal(owner.ok, true, 'owner gate_answer: ' + JSON.stringify(owner));
      assert.equal(owner.replayed, true);
      assert.equal(owner.answered_elsewhere, true);
      assert.equal(owner.verdict, 'approve', 'the recorded verdict, not the requested one');
    });

    await arm('4 gap 2: after a shell restart an old gate id reads answered from the room; expired reads gate_expired; a never-seen id reads unknown_gate', async () => {
      assert.ok(S && G);
      // The old registry approves the shell's own gate G.
      const readG = await human('readGate', { gate_id: G });
      const ansG = await human('approveDecision', { gate_id: G, chosen: ['approve'], verdict: 'approve', render_nonce: readG.render_nonce });
      assert.equal(ansG.ok, true, JSON.stringify(ansG));
      // A gate raised and answered in the CLI process, never seen by the shell.
      const s4 = await raise({ header: 'Ratify the fourth claim?', subject_node_id: claims[3] });
      assert.equal(s4.ok, true, JSON.stringify(s4));
      const own4 = await cli.call('gate_answer', { gate_id: s4.gate_id, chosen: ['reject'], verdict: 'reject' });
      assert.equal(own4.ok, true, JSON.stringify(own4));
      // The shell restarts: a fresh registry, a new browser session, the room opened again.
      const fresh = makeActions(pool);
      const X2 = authMod.issueSession(store).session;
      assert.equal((await human('openRoom', { room: 'room-x' }, fresh, X2)).ok, true);
      for (const [id, verdict, chosen] of [[S, 'approve', ['approve']], [G, 'approve', ['approve']], [s4.gate_id, 'reject', ['reject']]]) {
        const r = await human('readGate', { gate_id: id }, fresh, X2);
        assert.equal(r.ok, true, id + ': ' + JSON.stringify(r));
        assert.ok(r.answered, id + ' reads as already recorded: ' + JSON.stringify(r));
        assert.equal(r.answered.gate_id, id);
        assert.equal(r.answered.verdict, verdict);
        assert.deepEqual(r.answered.chosen, chosen);
        assert.equal(r.gate, null);
        assert.equal(r.render_nonce, undefined, 'no nonce for an answered gate');
      }
      // Expired: a raise record 31 minutes old, written the way the observer writes it.
      const nav = require('../lib/core/navigation.cjs');
      const old = Date.now() - 31 * 60 * 1000;
      const db = nav.openRoomDbForCaller(roomX);
      try {
        const res = nav.logMemoryEvent(db, 'mcp_client_event_logged', {
          label: 'gate_raised', gate_id: 'g-old-shell-369', dedupe_key: 'gate_raised:g-old-shell-369', gate_kind: 'general',
          header: 'An old gate', select_mode: 'single', options: [{ id: 'approve', label: 'Approve', rank: 1 }], recommended: 'approve',
          subject_node_id: null, evidence_node_ids: [], approving: null, minted_at: old, expires_at: old + 30 * 60 * 1000, resumes: false,
        });
        assert.ok(res && res.ok === true, 'the old raise record was written: ' + JSON.stringify(res));
      } finally {
        nav.closeRoomDbForCaller(db);
      }
      const expired = await human('readGate', { gate_id: 'g-old-shell-369' }, fresh, X2);
      assert.equal(expired.ok, false);
      assert.equal(expired.reason, 'gate_expired', JSON.stringify(expired));
      const unknown = await human('readGate', { gate_id: 'never-seen-gate-369' }, fresh, X2);
      assert.equal(unknown.reason, 'unknown_gate', JSON.stringify(unknown));
    });

    await arm('5 WR-06: a lookup failure keeps the records and offers a retry; the list says raised_unavailable; a replay_lookup_failed answer keeps the gate', async () => {
      const s5 = await raise({ header: 'Ratify the fifth claim?', subject_node_id: claims[4] });
      assert.equal(s5.ok, true, JSON.stringify(s5));
      proposalRef.current = proposal(claims[5]);
      const own = await human('askClaude', { selectedNodeId: claims[5], question: 'Confirm the sixth claim?' });
      assert.equal(own.ok, true, JSON.stringify(own));
      const keep = own.gate_id;
      const recBefore = actions.recordedGate(X.mcpKey, keep);
      assert.ok(recBefore);

      spy.override('gate_list', async () => fakeResult({ ok: false, reason: 'lookup_failed' }));
      const failed1 = await human('readGate', { gate_id: s5.gate_id });
      assert.equal(failed1.ok, false);
      assert.equal(failed1.reason, 'replay_lookup_failed', JSON.stringify(failed1));
      assert.equal(actions.recordedGate(X.mcpKey, s5.gate_id), null, 'no card was invented');
      assert.ok(actions.recordedGate(X.mcpKey, keep), 'the session\'s own record is untouched');
      const l1 = await human('listOpenGates', {});
      assert.equal(l1.ok, true);
      assert.equal(l1.raised_unavailable, true, JSON.stringify(l1));
      assert.ok(l1.gates.some((g) => g.gate_id === keep), 'the shell\'s own gate is still listed');
      spy.override('gate_list', async () => { throw new Error('daemon went away'); });
      const failed2 = await human('readGate', { gate_id: s5.gate_id });
      assert.equal(failed2.reason, 'replay_lookup_failed', 'a thrown lookup is the same retryable state: ' + JSON.stringify(failed2));
      spy.clear('gate_list');
      const retry = await human('readGate', { gate_id: s5.gate_id });
      assert.equal(retry.ok, true, 'the retry reads the gate: ' + JSON.stringify(retry));
      assert.equal(retry.gate.gate_id, s5.gate_id);

      // An answer the room could not confirm keeps the gate and the nonce is usable again.
      const rd = await human('readGate', { gate_id: keep });
      spy.override('gate_answer', async () => fakeResult({ ok: false, reason: 'replay_lookup_failed' }));
      const unconfirmed = await human('approveDecision', { gate_id: keep, chosen: ['approve'], verdict: 'approve', render_nonce: rd.render_nonce });
      assert.equal(unconfirmed.ok, false);
      assert.equal(unconfirmed.reason, 'replay_lookup_failed', JSON.stringify(unconfirmed));
      assert.ok(actions.recordedGate(X.mcpKey, keep), 'replay_lookup_failed keeps the gate record');
      spy.clear('gate_answer');
      const rd2 = await human('readGate', { gate_id: keep });
      const done = await human('approveDecision', { gate_id: keep, chosen: ['approve'], verdict: 'approve', render_nonce: rd2.render_nonce });
      assert.equal(done.ok, true, 'the retry answers: ' + JSON.stringify(done));
      const cleanup = await human('readGate', { gate_id: s5.gate_id });
      await human('approveDecision', { gate_id: s5.gate_id, chosen: ['hold'], verdict: 'defer', render_nonce: cleanup.render_nonce });
    });

    await arm('6 WR-03: an approve naming Hold or a reject naming approve is verdict_chosen_mismatch before any MCP call; the nonce stays usable; approving is declared', async () => {
      proposalRef.current = proposal(claims[6]);
      const own = await human('askClaude', { selectedNodeId: claims[6], question: 'Confirm the seventh claim?' });
      assert.equal(own.ok, true, JSON.stringify(own));
      const declared = spy.calls.filter((c) => c.tool === 'gate_render' && c.args && !c.args.mirror_of && Array.isArray(c.args.approving));
      assert.ok(declared.length > 0 && declared.every((c) => JSON.stringify(c.args.approving) === '["approve"]'), 'proposeDecision sends approving [approve] to gate_render');
      assert.deepEqual(actions.recordedGate(X.mcpKey, own.gate_id).approving, ['approve']);

      const rd = await human('readGate', { gate_id: own.gate_id });
      const answersBefore = spy.count('gate_answer');
      const hold = await human('approveDecision', { gate_id: own.gate_id, chosen: ['defer'], verdict: 'approve', render_nonce: rd.render_nonce });
      assert.equal(hold.ok, false);
      assert.equal(hold.reason, 'verdict_chosen_mismatch', JSON.stringify(hold));
      const rej = await human('approveDecision', { gate_id: own.gate_id, chosen: ['approve'], verdict: 'reject', render_nonce: rd.render_nonce });
      assert.equal(rej.reason, 'verdict_chosen_mismatch', JSON.stringify(rej));
      const dfr = await human('approveDecision', { gate_id: own.gate_id, chosen: ['approve'], verdict: 'defer', render_nonce: rd.render_nonce });
      assert.equal(dfr.reason, 'verdict_chosen_mismatch', JSON.stringify(dfr));
      assert.equal(spy.count('gate_answer'), answersBefore, 'no gate_answer call was made for a refused answer');
      const ok = await human('approveDecision', { gate_id: own.gate_id, chosen: ['approve'], verdict: 'approve', render_nonce: rd.render_nonce });
      assert.equal(ok.ok, true, 'the same nonce still ratifies a correct answer: ' + JSON.stringify(ok));

      // A mirror carries the recorded approving ids.
      const s6 = await raise({ header: 'Ratify the eighth claim?', subject_node_id: claims[7] });
      assert.equal(s6.ok, true, JSON.stringify(s6));
      const rm = await human('readGate', { gate_id: s6.gate_id });
      assert.equal(rm.ok, true, JSON.stringify(rm));
      assert.deepEqual(actions.recordedGate(X.mcpKey, s6.gate_id).approving, ['approve']);
      const before = spy.count('gate_answer');
      const bad = await human('approveDecision', { gate_id: s6.gate_id, chosen: ['hold'], verdict: 'approve', render_nonce: rm.render_nonce });
      assert.equal(bad.reason, 'verdict_chosen_mismatch', JSON.stringify(bad));
      assert.equal(spy.count('gate_answer'), before, 'no gate_answer call for the mirror either');
      await cli.call('gate_answer', { gate_id: s6.gate_id, chosen: ['hold'], verdict: 'defer' });
    });

    await arm('7 a second browser session whose mirror outlived the first answer reads replayed and answered_elsewhere and writes nothing new', async () => {
      const s7 = await raise({ header: 'Ratify the shared claim?', subject_node_id: claims[1], approving: ['approve'] });
      assert.equal(s7.ok, true, JSON.stringify(s7));
      const X3 = authMod.issueSession(store).session;
      assert.equal((await human('openRoom', { room: 'room-x' }, actions, X3)).ok, true);
      const r1 = await human('readGate', { gate_id: s7.gate_id });
      const r3 = await human('readGate', { gate_id: s7.gate_id }, actions, X3);
      assert.equal(r1.ok, true, JSON.stringify(r1));
      assert.equal(r3.ok, true, JSON.stringify(r3));
      const first = await human('approveDecision', { gate_id: s7.gate_id, chosen: ['approve'], verdict: 'approve', render_nonce: r1.render_nonce });
      assert.equal(first.ok, true, JSON.stringify(first));
      const decisions = countLike(roomX, 'decision:gate:%');
      const answers = answerRowCount(roomX);
      const second = await human('approveDecision', { gate_id: s7.gate_id, chosen: ['reject'], verdict: 'reject', render_nonce: r3.render_nonce }, actions, X3);
      assert.equal(second.ok, true, JSON.stringify(second));
      assert.equal(second.replayed, true, JSON.stringify(second));
      assert.equal(second.answered_elsewhere, true, JSON.stringify(second));
      assert.equal(second.verdict, 'approve', 'the recorded verdict stands');
      assert.equal(countLike(roomX, 'decision:gate:%'), decisions, 'no new decision node');
      assert.equal(answerRowCount(roomX), answers, 'no new answer row');
      const after = await human('readGate', { gate_id: s7.gate_id }, actions, X3);
      assert.equal(after.ok, true);
      assert.equal(after.answered.verdict, 'approve', 'the second session now reads the recorded answer: ' + JSON.stringify(after));
    });

    await arm('8 the agent principal cannot reach readGate or listOpenGates; one nonces.issue and one gateAnswer call site', async () => {
      const agent = { principal: 'agent', browserSession: X };
      assert.equal((await actions.invoke('readGate', { gate_id: 'x' }, agent)).reason, 'human_only');
      assert.equal((await actions.invoke('listOpenGates', {}, agent)).reason, 'human_only');
      const src = fs.readFileSync(path.join(REPO, 'ui', 'shell', 'server', 'actions.ts'), 'utf8');
      assert.equal((src.match(/nonces\.issue\(/g) || []).length, 1, 'one nonces.issue call site');
      assert.equal((src.match(/gateAnswer\(/g) || []).length, 1, 'one gateAnswer call site');
      assert.ok((src.match(/mcp_gate_id/g) || []).length >= 3, 'the mirror ledger id is carried on the server');
      assert.ok(!src.includes(EM) && !src.includes(EN), 'actions.ts carries a long dash');
    });

    await arm('9 dash guard: this test file carries no long dash', async () => {
      const own = fs.readFileSync(__filename, 'utf8');
      assert.ok(!own.includes(EM) && !own.includes(EN));
    });
  } finally {
    for (const c of clients) { try { await c.close(); } catch (_e) { /* best effort */ } }
    if (pool) { try { await pool.closeAll(); } catch (_e) { /* best effort */ } }
    if (cli) { try { await cli.close(); } catch (_e) { /* best effort */ } }
    if (h) { try { await D.stopDaemon(h); } catch (_e) { /* best effort */ } }
    try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().then(() => {
  console.log('PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}, (err) => {
  console.log('ERROR: ' + String((err && err.stack) || err));
  process.exit(1);
});
