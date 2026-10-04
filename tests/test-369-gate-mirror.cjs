#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 36 (SHELL369-12 answerability half, GREC369-02 replay extended to "answered elsewhere",
 * canon parts 3, 8, 9) -- a gate raised in another session can be decided once, by a person, on the
 * session that shows it, without loosening the session-scoped ledger.
 * ==========================================================================
 * The shape. Claude Code owns the source gate S (its own stdio process, its own in-memory ledger).
 * The shell's session A, bound to the same room, raises a MIRROR of S with gate_render mirror_of: the
 * card is drawn from the room's own gate_raised record, never from the caller. A answers the mirror M
 * through gate_answer (A owns M, the ledger rule is unchanged). The answer writes the mirror's decision
 * node and S's gate_answer anchor (answered_via M) in ONE transaction. S's owner answering afterwards is
 * told "answered elsewhere" with the recorded answer; nothing is written twice; a halted step resumes
 * exactly once.
 *
 * Arms (numbers are the plan's):
 *   1  mirror_of mints a different id; the card matches the record; gate_list still lists exactly S;
 *      mirror_with_gate_id, mirror_mismatch, unknown_gate (never-minted, other room, a mirror id),
 *      gate_expired
 *   2  A answers M: ok and ratified; decision:gate:M with SOURCED_FROM edges; the gate_answer anchor for S
 *      names M; both rows share one room_change_log transaction_id; gate_list drops S and reads it
 *      answered with decision:gate:M
 *   3  S's owner (the CLI) answers afterwards: ok, replayed, answered_elsewhere, the recorded verdict and
 *      chosen, decision:gate:M; counts unchanged; a second owner answer replays from the durable trace;
 *      3b an owner APPROVE after a mirror approve is answered_elsewhere, not stale_subject
 *   4  the owner answered first: the mirror answer replays answered_elsewhere, writes no decision node
 *   5  a stranger session is refused session_mismatch on A's mirror and the owner still answers; a second
 *      mirror of the same source answered after the first replays answered_elsewhere and writes nothing
 *   6  a chain-shaped source resumes exactly once with the recorded answer; a repeat does not resume
 *   7  the mirror keeps the source's approving ids: approve with a non-approving option is refused and
 *      the mirror stays answerable
 *   8  a chain halt's framework handle rides: decision:gate:<mirror> has the USES_FRAMEWORK edge
 *   9  static: inside the gate_answer transaction the anchor and source-state reads precede the first
 *      write; lib/mcp/gate-ledger.cjs is untouched by this plan
 *
 * Exit 0 all PASS, 1 any FAIL, 77 only when @modelcontextprotocol/client cannot be loaded or the daemon
 * cannot start. Every child it spawns is killed in a finally. Hyphens only. CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

try {
  require('@modelcontextprotocol/client');
} catch (e) {
  console.log('SKIP: @modelcontextprotocol/client cannot be loaded (' + (e && e.message ? e.message : e) + ')');
  process.exit(77);
}

const D = require('./helpers/mcp-daemon-369.cjs');
const { cliClient } = require('./helpers/cli-gate-369.cjs');

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
    console.log('    ' + (err && err.message ? err.message : String(err)).split('\n').join('\n    '));
  }
}

// -- reading a tool result ----------------------------------------------------------------
function parseToolJson(result) {
  const text = (result && Array.isArray(result.content) ? result.content : [])
    .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
    .join('');
  const marker = text.indexOf('\n\n## ');
  const body = marker === -1 ? text : text.slice(0, marker);
  try {
    return JSON.parse(body);
  } catch (_e) {
    return { __error: 'unparseable tool body: ' + body.slice(0, 200) };
  }
}

async function dcall(client, name, args) {
  try {
    return parseToolJson(await client.callTool({ name: name, arguments: args || {} }));
  } catch (e) {
    return { __error: String((e && e.message) || e).slice(0, 300) };
  }
}

async function dbind(client, room) {
  const out = await dcall(client, 'room_bind', { room: room });
  assert.equal(out.ok, true, 'room_bind ' + room + ': ' + JSON.stringify(out));
}

// -- raw reads of room.db (tests/ is on the Canon Part 9 allow-list) ------------------------
function withDb(roomDir, fn, writable) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), writable ? {} : { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
function eventRows(roomDir, dedupeKey) {
  return withDb(roomDir, (db) => db.prepare(
    "SELECT id, properties FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
    "AND json_extract(properties, '$.dedupe_key') = ?"
  ).all(dedupeKey));
}
function nodeExists(roomDir, id) {
  return withDb(roomDir, (db) => !!db.prepare('SELECT id FROM nodes WHERE id = ?').get(id));
}
function countLike(roomDir, pattern) {
  return withDb(roomDir, (db) => Number(db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE id LIKE ?').get(pattern).c));
}
function answerRowCount(roomDir) {
  return withDb(roomDir, (db) => Number(db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
    "AND json_extract(properties, '$.label') = 'gate_answer'"
  ).get().c));
}
function edgeRows(roomDir, sourceId, edgeType) {
  return withDb(roomDir, (db) => db.prepare(
    'SELECT target FROM edges WHERE source = ? AND type = ?'
  ).all(sourceId, edgeType));
}
function claimIds(roomDir) {
  return withDb(roomDir, (db) => db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:%' ORDER BY rowid").all().map((r) => r.id));
}
function txIds(roomDir, entityIds) {
  return withDb(roomDir, (db) => {
    const marks = entityIds.map(() => '?').join(',');
    const stmt = db.prepare(
      "SELECT entity_id, transaction_id FROM room_change_log WHERE entity_type = 'node' AND entity_id IN (" + marks + ')'
    );
    return stmt.all(...entityIds);
  });
}

const OPTIONS = [
  { id: 'approve', label: 'Approve', rank: 1, description: 'Recommended: ratify.', preview: 'Ratifies the claim.' },
  { id: 'hold', label: 'Hold', rank: 2 },
  { id: 'reject', label: 'Reject', rank: 3 },
];

const SEED = [
  { kind: 'claim', text: 'Local-first rooms keep a founder in control of the decision trail.' },
  { kind: 'claim', text: 'A second claim for the gate-mirror test.' },
  { kind: 'claim', text: 'A third claim for the owner-approve-after-mirror case.' },
  { kind: 'source', url: 'https://example.org/369/gate-mirror-1', retrieved_at: '2026-10-01T00:00:00Z' },
];

function cardFor(gateId, extra) {
  const gateRender = require('../lib/mcp/gate-render.cjs');
  return gateRender.normalizeCard(Object.assign({
    gate_id: gateId,
    header: 'In-process gate ' + gateId,
    kind: 'general',
    options: OPTIONS,
  }, extra || {}));
}

async function main() {
  const clients = [];
  const cleanups = [];
  let h = null;
  let cli = null;
  const savedEnv = {};
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
    cleanups.push(() => D.stopDaemon(h));
    const roomX = h.roomDirs['room-x'];
    const claims = claimIds(roomX);
    assert.ok(claims.length >= 3, 'room-x must hold the seeded claims');
    console.log('rooms: room-x, room-y; seeded claims: ' + claims.join(', '));

    const CLI_SESSION = 'cli-gate-mirror-369-owner';
    cli = await cliClient({ roomsHome: h.roomsHome, home: h.env.HOME, sessionId: CLI_SESSION });
    await cli.bind('room-x');

    const A = await D.legacyClient(h.port, 'gate-mirror-a');
    const B = await D.legacyClient(h.port, 'gate-mirror-b');
    const Y = await D.legacyClient(h.port, 'gate-mirror-y');
    clients.push(A, B, Y);
    await dbind(A.client, 'room-x');
    await dbind(B.client, 'room-x');
    await dbind(Y.client, 'room-y');
    const a = (tool, args) => dcall(A.client, tool, args);
    const b = (tool, args) => dcall(B.client, tool, args);

    // -- in-process set-up (arms 1 expired, 6, 7, 8): the test process is a second Claude Code shaped owner --
    for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_BRAIN_URL', 'MINDRIAN_TEST_MODE']) {
      savedEnv[k] = process.env[k];
    }
    process.env.HOME = h.env.HOME;
    process.env.USERPROFILE = h.env.HOME;
    process.env.MINDRIAN_ROOMS_HOME = h.roomsHome;
    process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
    delete process.env.CLAUDE_CODE_SESSION_ID;
    const gateLedger = require('../lib/mcp/gate-ledger.cjs');
    const gateTools = require('../lib/mcp/tools/gate.cjs'); // loading it installs the observers
    const { writeSessionBinding } = require('../lib/core/session-binding.cjs');
    for (const s of ['inproc-owner', 'inproc-a', 'inproc-old']) {
      writeSessionBinding(s, { bound: ['room-x'], primary: 'room-x' });
    }
    const handlers = {};
    const fakeServer = {
      registerTool(name, _cfg, handler) { handlers[name] = handler; },
      server: {
        getClientCapabilities: () => ({}),
        getClientVersion: () => ({ name: 'gate-mirror-369', version: '1.0.0' }),
      },
    };
    gateTools.register(fakeServer, {});
    assert.equal(typeof handlers.gate_render, 'function', 'gate_render registered on the fake server');
    assert.equal(typeof handlers.gate_answer, 'function', 'gate_answer registered on the fake server');
    const ip = async (tool, args, session) => parseToolJson(await handlers[tool](args, { sessionId: session }));

    // The source gates the daemon arms use are raised by the CLI process.
    const raise = (args) => cli.call('gate_render', Object.assign({ kind: 'general', select_mode: 'single', options: OPTIONS }, args));

    let S = null;
    let M = null;
    let sRendered = null;

    await arm('1 mirror_of mints a different gate whose card is the room\'s record; refusals are typed', async () => {
      const src = await raise({ header: 'Ratify the first claim?', subject_node_id: claims[0], evidence_node_ids: [claims[1]] });
      assert.equal(src.ok, true, 'cli gate_render: ' + JSON.stringify(src));
      S = src.gate_id;
      sRendered = src.rendered;
      const m = await a('gate_render', { mirror_of: S, options: OPTIONS });
      assert.equal(m.ok, true, 'mirror gate_render: ' + JSON.stringify(m));
      M = m.gate_id;
      assert.ok(typeof M === 'string' && M.length > 0 && M !== S, 'the mirror has its own id: ' + M + ' vs ' + S);
      const swap = (r) => JSON.stringify(r).split(M).join('<id>').split(S).join('<id>');
      assert.equal(swap(m.rendered), swap(sRendered), 'the mirror renders the same card as the record');
      const l = await a('gate_list', {});
      assert.equal(l.ok, true, JSON.stringify(l));
      assert.deepEqual(l.gates.map((g) => g.gate_id), [S], 'gate_list still lists exactly the source');

      const withId = await a('gate_render', { mirror_of: S, gate_id: 'caller-chosen-369', options: OPTIONS });
      assert.equal(withId.ok, false, JSON.stringify(withId));
      assert.equal(withId.reason, 'mirror_with_gate_id', JSON.stringify(withId));
      const wrongIds = await a('gate_render', { mirror_of: S, options: [{ id: 'approve', label: 'Approve' }, { id: 'nope', label: 'Nope' }] });
      assert.equal(wrongIds.ok, false, JSON.stringify(wrongIds));
      assert.equal(wrongIds.reason, 'mirror_mismatch', JSON.stringify(wrongIds));
      const unknown = await a('gate_render', { mirror_of: 'never-minted-gate-369', options: OPTIONS });
      assert.equal(unknown.reason, 'unknown_gate', JSON.stringify(unknown));
      const otherRoom = await dcall(Y.client, 'gate_render', { mirror_of: S, options: OPTIONS });
      assert.equal(otherRoom.reason, 'unknown_gate', 'a client bound to room-y cannot mirror a room-x gate: ' + JSON.stringify(otherRoom));
      const ofMirror = await a('gate_render', { mirror_of: M, options: OPTIONS });
      assert.equal(ofMirror.reason, 'unknown_gate', 'a mirror leaves no record, so it cannot itself be mirrored: ' + JSON.stringify(ofMirror));
      gateLedger.mintGate('g-old-mirror-369', {
        card: cardFor('g-old-mirror-369'),
        sessionId: 'inproc-old',
        kind: 'general',
        mintedAt: Date.now() - 31 * 60 * 1000,
      });
      const old = await a('gate_render', { mirror_of: 'g-old-mirror-369', options: OPTIONS });
      assert.equal(old.reason, 'gate_expired', JSON.stringify(old));
    });

    await arm('2 answering the mirror writes its decision node and the source anchor in ONE transaction', async () => {
      assert.ok(S && M, 'arm 1 must have minted the pair');
      const ans = await a('gate_answer', { gate_id: M, chosen: ['approve'], verdict: 'approve' });
      assert.equal(ans.ok, true, 'A gate_answer: ' + JSON.stringify(ans));
      assert.equal(ans.ratified, true, JSON.stringify(ans));
      assert.ok(nodeExists(roomX, 'decision:gate:' + M), 'decision:gate:<mirror> exists');
      assert.ok(!nodeExists(roomX, 'decision:gate:' + S), 'no decision node under the source id');
      const targets = edgeRows(roomX, 'decision:gate:' + M, 'SOURCED_FROM').map((e) => e.target);
      assert.ok(targets.includes(claims[0]) && targets.includes(claims[1]), 'SOURCED_FROM the subject and the evidence: ' + targets.join(','));
      const anchors = eventRows(roomX, 'gate_answer:' + S);
      assert.equal(anchors.length, 1, 'exactly one source anchor, got ' + anchors.length);
      const props = JSON.parse(anchors[0].properties);
      assert.equal(props.answered_via, M, 'the anchor names the mirror');
      assert.equal(props.verdict, 'approve');
      assert.deepEqual(props.chosen, ['approve']);
      const rows = txIds(roomX, ['decision:gate:' + M, anchors[0].id]);
      assert.ok(rows.length >= 2, 'both rows are in the change log: ' + JSON.stringify(rows));
      const distinct = new Set(rows.map((r) => r.transaction_id));
      assert.ok(!distinct.has(null) && !distinct.has(undefined), 'every row carries a transaction id: ' + JSON.stringify(rows));
      assert.equal(distinct.size, 1, 'one transaction id for both rows: ' + JSON.stringify(rows));
      const l = await a('gate_list', {});
      assert.ok(!l.gates.some((g) => g.gate_id === S), 'the answered source left the list');
      const st = await a('gate_list', { gate_id: S });
      assert.equal(st.gate.state, 'answered', JSON.stringify(st));
      assert.equal(st.gate.answered.decision_node_id, 'decision:gate:' + M, JSON.stringify(st));
    });

    await arm('3 the owner answering afterwards replays answered_elsewhere; 3b an owner approve is not stale_subject', async () => {
      assert.ok(S && M);
      const decisionsBefore = countLike(roomX, 'decision:gate:%');
      const answersBefore = answerRowCount(roomX);
      const own = await cli.call('gate_answer', { gate_id: S, chosen: ['hold'], verdict: 'defer' });
      assert.equal(own.ok, true, 'owner gate_answer: ' + JSON.stringify(own));
      assert.equal(own.replayed, true, JSON.stringify(own));
      assert.equal(own.answered_elsewhere, true, JSON.stringify(own));
      assert.equal(own.verdict, 'approve', 'the recorded verdict, not the requested one');
      assert.deepEqual(own.chosen, ['approve']);
      assert.equal(own.decision_node_id, 'decision:gate:' + M, JSON.stringify(own));
      assert.equal(countLike(roomX, 'decision:gate:%'), decisionsBefore, 'no decision node written');
      assert.equal(answerRowCount(roomX), answersBefore, 'no answer row written');
      const again = await cli.call('gate_answer', { gate_id: S, chosen: ['hold'], verdict: 'defer' });
      assert.equal(again.ok, true, JSON.stringify(again));
      assert.equal(again.replayed, true, JSON.stringify(again));
      assert.equal(again.verdict, 'approve', JSON.stringify(again));
      assert.equal(answerRowCount(roomX), answersBefore, 'still no answer row written');

      // 3b: the mirror's approve promotes the subject claim, so the owner's later APPROVE must be
      // answered_elsewhere, never refused stale_subject.
      const s3 = await raise({ header: 'Ratify the third claim?', subject_node_id: claims[2] });
      assert.equal(s3.ok, true, JSON.stringify(s3));
      const m3 = await a('gate_render', { mirror_of: s3.gate_id, options: OPTIONS });
      assert.equal(m3.ok, true, JSON.stringify(m3));
      const a3 = await a('gate_answer', { gate_id: m3.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(a3.ok, true, JSON.stringify(a3));
      const o3 = await cli.call('gate_answer', { gate_id: s3.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(o3.ok, true, 'owner approve after mirror approve: ' + JSON.stringify(o3));
      assert.equal(o3.answered_elsewhere, true, JSON.stringify(o3));
      assert.notEqual(o3.reason, 'stale_subject');
    });

    await arm('4 the owner answers first: the mirror answer replays answered_elsewhere and writes no decision node', async () => {
      const s2 = await raise({ header: 'Second gate' });
      assert.equal(s2.ok, true, JSON.stringify(s2));
      const m2 = await a('gate_render', { mirror_of: s2.gate_id, options: OPTIONS });
      assert.equal(m2.ok, true, JSON.stringify(m2));
      const own = await cli.call('gate_answer', { gate_id: s2.gate_id, chosen: ['reject'], verdict: 'reject' });
      assert.equal(own.ok, true, JSON.stringify(own));
      const answersBefore = answerRowCount(roomX);
      const viaMirror = await a('gate_answer', { gate_id: m2.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(viaMirror.ok, true, JSON.stringify(viaMirror));
      assert.equal(viaMirror.replayed, true, JSON.stringify(viaMirror));
      assert.equal(viaMirror.answered_elsewhere, true, JSON.stringify(viaMirror));
      assert.equal(viaMirror.verdict, 'reject', 'the recorded verdict stands');
      assert.equal(viaMirror.requested_verdict, 'approve');
      assert.ok(!nodeExists(roomX, 'decision:gate:' + m2.gate_id), 'no decision node for the mirror');
      assert.equal(answerRowCount(roomX), answersBefore, 'no answer row written');
      const retry = await a('gate_answer', { gate_id: m2.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(retry.ok, false, 'the released mirror is not answerable again: ' + JSON.stringify(retry));
    });

    await arm('5 a stranger is refused session_mismatch and the owner can still answer; a second mirror replays', async () => {
      const s5 = await raise({ header: 'Isolation gate' });
      assert.equal(s5.ok, true, JSON.stringify(s5));
      const m3 = await a('gate_render', { mirror_of: s5.gate_id, options: OPTIONS });
      const m3b = await b('gate_render', { mirror_of: s5.gate_id, options: OPTIONS });
      assert.equal(m3.ok, true, JSON.stringify(m3));
      assert.equal(m3b.ok, true, 'a second session may mirror the same source: ' + JSON.stringify(m3b));
      const answersBefore = answerRowCount(roomX);
      const stranger = await b('gate_answer', { gate_id: m3.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(stranger.ok, false, JSON.stringify(stranger));
      assert.equal(stranger.reason, 'session_mismatch', JSON.stringify(stranger));
      assert.equal(answerRowCount(roomX), answersBefore, 'the refused stranger wrote nothing');
      assert.equal(eventRows(roomX, 'gate_answer:' + s5.gate_id).length, 0, 'no source anchor from a stranger');
      const owner = await a('gate_answer', { gate_id: m3.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(owner.ok, true, 'the owner still answers: ' + JSON.stringify(owner));
      assert.equal(owner.ratified, true, JSON.stringify(owner));
      const afterOne = answerRowCount(roomX);
      const second = await b('gate_answer', { gate_id: m3b.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(second.ok, true, JSON.stringify(second));
      assert.equal(second.replayed, true, JSON.stringify(second));
      assert.equal(second.answered_elsewhere, true, JSON.stringify(second));
      assert.ok(!nodeExists(roomX, 'decision:gate:' + m3b.gate_id), 'the second mirror wrote no decision node');
      assert.equal(answerRowCount(roomX), afterOne, 'the second mirror wrote no row');
    });

    // -- arms 6 to 8: an in-process owner shaped like a chain halt ------------------------------
    function mintChainShaped(gateId, extra) {
      const calls = [];
      gateLedger.mintGate(gateId, Object.assign({
        card: cardFor(gateId, { kind: 'material_step' }),
        sessionId: 'inproc-owner',
        kind: 'material_step',
        roomDir: roomX,
        approving: ['approve'],
        resumeFn: async (payload) => { calls.push(payload); return { ok: true, executed: true, completed: true }; },
      }, extra || {}));
      return calls;
    }

    await arm('6 a halted step resumes exactly once with the recorded answer', async () => {
      const calls = mintChainShaped('g-chain-mirror-369');
      const m = await ip('gate_render', { mirror_of: 'g-chain-mirror-369', options: OPTIONS }, 'inproc-a');
      assert.equal(m.ok, true, 'in-process mirror: ' + JSON.stringify(m));
      const viaMirror = await ip('gate_answer', { gate_id: m.gate_id, chosen: ['approve'], verdict: 'approve' }, 'inproc-a');
      assert.equal(viaMirror.ok, true, JSON.stringify(viaMirror));
      assert.equal(calls.length, 0, 'answering the mirror runs no step: the owner holds the resume');
      const own = await ip('gate_answer', { gate_id: 'g-chain-mirror-369', chosen: ['hold'], verdict: 'defer' }, 'inproc-owner');
      assert.equal(own.ok, true, 'owner gate_answer: ' + JSON.stringify(own));
      assert.equal(own.answered_elsewhere, true, JSON.stringify(own));
      assert.equal(calls.length, 1, 'the resumeFn ran exactly once');
      assert.deepEqual(calls[0].chosen, ['approve']);
      assert.equal(calls[0].verdict, 'approve');
      assert.ok(own.chain_result && own.chain_result.executed === true, 'chain_result is nested: ' + JSON.stringify(own));
      const repeat = await ip('gate_answer', { gate_id: 'g-chain-mirror-369', chosen: ['approve'], verdict: 'approve' }, 'inproc-owner');
      assert.equal(repeat.ok, true, JSON.stringify(repeat));
      assert.equal(calls.length, 1, 'a repeat answer never resumes again');
    });

    await arm('7 the mirror keeps the source approving ids: approve with a non-approving option is refused', async () => {
      mintChainShaped('g-approving-mirror-369');
      const m = await ip('gate_render', { mirror_of: 'g-approving-mirror-369', options: OPTIONS }, 'inproc-a');
      assert.equal(m.ok, true, JSON.stringify(m));
      const answersBefore = answerRowCount(roomX);
      const bad = await ip('gate_answer', { gate_id: m.gate_id, chosen: ['hold'], verdict: 'approve' }, 'inproc-a');
      assert.equal(bad.ok, false, JSON.stringify(bad));
      assert.equal(bad.reason, 'chosen_not_approving', JSON.stringify(bad));
      const bad2 = await ip('gate_answer', { gate_id: m.gate_id, chosen: ['approve'], verdict: 'reject' }, 'inproc-a');
      assert.equal(bad2.reason, 'verdict_chosen_mismatch', JSON.stringify(bad2));
      assert.equal(answerRowCount(roomX), answersBefore, 'refusals wrote nothing');
      assert.equal(eventRows(roomX, 'gate_answer:g-approving-mirror-369').length, 0, 'no source anchor');
      const good = await ip('gate_answer', { gate_id: m.gate_id, chosen: ['approve'], verdict: 'approve' }, 'inproc-a');
      assert.equal(good.ok, true, 'the mirror stayed answerable: ' + JSON.stringify(good));
    });

    await arm('8 a chain halt framework handle rides to the mirror decision node', async () => {
      mintChainShaped('g-framework-mirror-369', { haltedStep: { framework: 'six-thinking-hats' } });
      const m = await ip('gate_render', { mirror_of: 'g-framework-mirror-369', options: OPTIONS }, 'inproc-a');
      assert.equal(m.ok, true, JSON.stringify(m));
      const ans = await ip('gate_answer', { gate_id: m.gate_id, chosen: ['approve'], verdict: 'approve' }, 'inproc-a');
      assert.equal(ans.ok, true, JSON.stringify(ans));
      const fw = edgeRows(roomX, 'decision:gate:' + m.gate_id, 'USES_FRAMEWORK').map((e) => e.target);
      assert.deepEqual(fw, ['framework:six-thinking-hats'], 'USES_FRAMEWORK edge: ' + JSON.stringify(fw));
    });

    await arm('9 static: the anchor and source-state reads precede the first write inside the transaction; the ledger is untouched', async () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'), 'utf8');
      const start = src.indexOf('function _answerInTx(');
      assert.ok(start !== -1, 'gate.cjs defines _answerInTx, the withRoomTx callback body');
      const end = src.indexOf('\n}\n', start);
      const body = src.slice(start, end);
      const readAt = Math.min(
        ...['readGateAnswerAnchor(', 'readGateState('].map((t) => { const i = body.indexOf(t); return i === -1 ? Infinity : i; })
      );
      assert.ok(Number.isFinite(readAt), '_answerInTx reads the anchor or the source state');
      const writeAt = Math.min(
        ...['logMemoryEvent(', '_applyRatification('].map((t) => { const i = body.indexOf(t); return i === -1 ? Infinity : i; })
      );
      assert.ok(readAt < writeAt, 'the reads (' + readAt + ') come before the first write (' + writeAt + ')');
      assert.ok(/withRoomTx\(db, \(\) => _answerInTx\(/.test(src), 'gate_answer runs _answerInTx inside withRoomTx');
      const status = cp.spawnSync('git', ['status', '--short', '--', 'lib/mcp/gate-ledger.cjs'], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(String(status.stdout).trim(), '', 'gate-ledger.cjs has no uncommitted change');
      const log = cp.spawnSync('git', ['log', '--format=%s', '--', 'lib/mcp/gate-ledger.cjs'], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.ok(!/\(369-36\)/.test(String(log.stdout)), 'no commit of this plan touches gate-ledger.cjs');
    });

    await arm('dash guard: this file holds no em-dash or en-dash', async () => {
      const own = fs.readFileSync(__filename);
      const bad = [];
      for (let i = 0; i + 2 < own.length; i += 1) {
        if (own[i] === 0xE2 && own[i + 1] === 0x80 && (own[i + 2] === 0x94 || own[i + 2] === 0x93)) bad.push(i);
      }
      assert.equal(bad.length, 0, 'dash bytes at ' + bad.join(','));
    });
  } finally {
    for (const k of Object.keys(savedEnv)) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    for (const c of clients) {
      try { await c.close(); } catch (_e) { /* best effort */ }
    }
    if (cli) {
      try { await cli.close(); } catch (_e) { /* best effort */ }
    }
    for (const c of cleanups.reverse()) {
      try { await c(); } catch (_e) { /* best effort */ }
    }
  }
  console.log('\nPASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.log('FATAL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
