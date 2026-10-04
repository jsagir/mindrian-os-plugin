#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 38 -- gate hardening, review findings WR-01 to WR-06 (369-REVIEW.md).
 * ==========================================================================
 * One arm group per finding. Faults are injected in THIS process only, by wrapping
 * module functions (navigation.withRoomTx, navigation.readGateAnswerAnchor, the
 * ledger's backdate seam) and restoring them in a finally; production code carries no
 * test-only marker for any of them (IN-07). The one live-daemon leg (WR-06, a session
 * that is unbound after a daemon restart) uses tests/helpers/mcp-daemon-369.cjs.
 *
 *   WR-01  the goal file is written after COMMIT and release, idempotent per decision node
 *   WR-02  the durable answer wins over the TTL: a committed answer never replays as gate_expired
 *   WR-03  gate_render approving ids: approve with a non-approving option is refused
 *   WR-04  stale check inside the write transaction, evidence nodes included, unknown is not changed
 *   WR-05  no live-gate takeover, no answered-id re-mint, expired entries purged, a per-session cap
 *   WR-06  a replay lookup that cannot read the room is replay_lookup_failed, never unknown_gate
 *
 * Exit 0 all PASS, 1 any FAIL, 77 only when the daemon leg cannot start and nothing else failed.
 * Hyphens only. CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos369-38-'));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'roomshome');
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_TEST_MODE;
process.chdir(TMP);

const REPO = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const jtbdState = require(path.join(REPO, 'lib', 'hmi', 'jtbd-state.cjs'));
const strategyCard = require(path.join(REPO, 'lib', 'core', 'strategy', 'strategy-card.cjs'));
const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
const gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
const { buildRoom369, writeRegistry } = require(path.join(__dirname, 'helpers', 'fixture-room-369.cjs'));
const { writeSessionBinding } = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));

let passed = 0;
let failed = 0;
let firstFail = null;
async function arm(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    const msg = err && err.message ? err.message : String(err);
    if (firstFail === null) firstFail = name + ' :: ' + msg.split('\n')[0].slice(0, 300);
    console.log('  FAIL ' + name);
    console.log('    ' + msg.split('\n').slice(0, 4).join('\n    '));
  }
}

// -- in-process gate tools on a capture server ------------------------------------
function makeServer() {
  const captured = new Map();
  return {
    captured: captured,
    registerTool: function (name, config, handler) {
      captured.set(name, { description: (config || {}).description, handler: handler });
    },
    server: { getClientCapabilities: function () { return {}; } },
  };
}

function parse(raw) {
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
}

function boot(roomDir) {
  const server = makeServer();
  gateModule.register(server, { fallbackRoomDir: roomDir });
  return {
    server: server,
    render: async function (input, sid) { return parse(await server.captured.get('gate_render').handler(input, { sessionId: sid })); },
    answer: async function (gateId, chosen, verdict, sid) {
      return parse(await server.captured.get('gate_answer').handler({ gate_id: gateId, chosen: chosen, verdict: verdict }, { sessionId: sid }));
    },
  };
}

// Rooms are registered in the hermetic rooms home and sessions are bound to them, so a
// gate minted here records the room it was drawn for (the mint context needs a session the
// resolver can tie to a room, not the boot fallback).
const REGISTRY = {};
function registerRoom(slug, dir) {
  REGISTRY[slug] = { slug: slug, abs_path: dir };
  writeRegistry(process.env.MINDRIAN_ROOMS_HOME, Object.values(REGISTRY), slug);
}
function bindSession(sessionId, slug) {
  writeSessionBinding(sessionId, { bound: [slug], primary: slug, sticky: false }, { home: process.env.MINDRIAN_ROOMS_HOME });
}

let roomSeq = 0;
function newRoom(claimCount) {
  roomSeq += 1;
  const seed = [];
  for (let i = 0; i < (claimCount || 0); i += 1) {
    seed.push({ kind: 'claim', text: 'Hardening 369-38 claim ' + roomSeq + '-' + i + ' stays in this fixture room only.', variant: roomSeq + '-' + i });
  }
  const built = buildRoom369({ tmpDir: path.join(TMP, 'rooms', 'r' + roomSeq), slug: 'r' + roomSeq, variant: 'wide', migrate: true, seed: seed });
  const claims = withRead(built.roomDir, (db) => db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:%' ORDER BY rowid").all().map((r) => r.id));
  registerRoom(built.slug, built.roomDir);
  return { roomDir: built.roomDir, slug: built.slug, claims: claims };
}

function withRead(roomDir, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try { return fn(db); } finally { db.close(); }
}
function withWrite(roomDir, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'));
  db.exec('PRAGMA busy_timeout = 5000');
  try { return fn(db); } finally { db.close(); }
}
function nodeCount(roomDir, like) {
  return withRead(roomDir, (db) => db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE id LIKE ?').get(like).c);
}
function touchNode(roomDir, id) {
  withWrite(roomDir, (db) => db.prepare('UPDATE nodes SET last_seen_at = ? WHERE id = ?').run(Date.now() + 7, id));
}
function goalBytes(roomDir) {
  try { return fs.readFileSync(path.join(roomDir, '.mindrian', 'jtbd-state.json'), 'utf8'); } catch (_e) { return null; }
}

const OPTS = [
  { id: 'approve', label: 'Approve', rank: 1, description: 'Recommended.' },
  { id: 'hold', label: 'Hold', rank: 2 },
  { id: 'reject', label: 'Reject', rank: 3 },
];

let sidSeq = 0;
function sid(prefix, room) {
  sidSeq += 1;
  const id = (prefix || 's') + '-38-' + sidSeq;
  if (room) bindSession(id, room.slug);
  return id;
}

async function patched(obj, key, replacement, fn) {
  const original = obj[key];
  obj[key] = replacement(original);
  try { return await fn(); } finally { obj[key] = original; }
}

// -- WR-01 -------------------------------------------------------------------------
async function strategyRoom(tag) {
  const roomDir = fs.mkdtempSync(path.join(TMP, 'strat-' + tag + '-'));
  const slug = 'strat-' + tag;
  registerRoom(slug, roomDir);
  const db = roomDbMod.openRoomDb(roomDir);
  jtbdState.setGoal(roomDir, { jtbd: 'decide-pursue', rung: 'IllDefined', parent_question: 'should we pursue this now' });
  const card = await strategyCard.buildStrategyCard({
    db: db, roomDir: roomDir, roomSlug: 'wr01-' + tag,
    reach: { evidence: { current_jtbd: 'find-problem', reaches_since: 30, unresolved_contradictions: 2 } },
    candidates: [],
  });
  roomDbMod.closeRoomDb(db);
  assert.ok(card, 'strategy card');
  return { roomDir: roomDir, slug: slug, card: card };
}

async function renderStrategy(g, card, s) {
  const out = await g.render({
    header: card.header, kind: card.kind, select_mode: 'single', options: card.options,
    subject_node_id: card.subject_node_id, evidence_node_ids: card.evidence_node_ids,
  }, s);
  assert.equal(out.ok, true, 'gate_render: ' + JSON.stringify(out));
  return out.gate_id;
}

async function groupWR01() {
  console.log('WR-01 the goal file after COMMIT, idempotent per decision node');
  await arm('WR-01a a rolled-back answer leaves the goal file byte-identical, the retry then writes it once', async () => {
    const r = await strategyRoom('a');
    const g = boot(r.roomDir);
    const s = sid('wr01a', r);
    const gateId = await renderStrategy(g, r.card, s);
    const before = goalBytes(r.roomDir);
    const real = navigation.withRoomTx;
    const failed1 = await patched(navigation, 'withRoomTx', () => function (db, fn, o) {
      return real(db, function (d) { fn(d); throw new Error('commit fault injected by test'); }, o);
    }, () => g.answer(gateId, ['rewrite-jtbd'], 'approve', s));
    assert.equal(failed1.ok, false, JSON.stringify(failed1));
    assert.equal(failed1.reason, 'persistence_failed', JSON.stringify(failed1));
    assert.equal(goalBytes(r.roomDir), before, 'the goal file is byte-identical after the rolled-back answer');
    const retry = await g.answer(gateId, ['rewrite-jtbd'], 'approve', s);
    assert.equal(retry.ok, true, JSON.stringify(retry));
    const goal = jtbdState.getGoal(r.roomDir);
    assert.equal(goal.goal_version, 2, 'goal_version bumped exactly once: ' + JSON.stringify(goal));
    assert.equal(goal.jtbd, 'find-problem');
    assert.equal(jtbdState.goalHistory(r.roomDir, 50).length, 2, 'one new goal_history row');
    assert.equal(retry.strategy_ratification.goal_file, 'ok', JSON.stringify(retry.strategy_ratification));
  });

  await arm('WR-01b a replayed answer never bumps goal_version or adds a goal_history row', async () => {
    const r = await strategyRoom('b');
    const g = boot(r.roomDir);
    const s = sid('wr01b', r);
    const gateId = await renderStrategy(g, r.card, s);
    const first = await g.answer(gateId, ['rewrite-jtbd'], 'approve', s);
    assert.equal(first.ok, true, JSON.stringify(first));
    const afterFirst = goalBytes(r.roomDir);
    const replay = await g.answer(gateId, ['rewrite-jtbd'], 'approve', s);
    assert.equal(replay.replayed, true, JSON.stringify(replay));
    assert.equal(goalBytes(r.roomDir), afterFirst, 'the goal file did not move on the replay');
  });

  await arm('WR-01c setGoal with the same decision_node_id twice is unchanged the second time', async () => {
    const roomDir = fs.mkdtempSync(path.join(TMP, 'goal-c-'));
    const one = jtbdState.setGoal(roomDir, { jtbd: 'find-problem', set_by: 'gate_answer', decision_node_id: 'decision:gate:wr01c' });
    assert.ok(one && one.goal_version === 1, JSON.stringify(one));
    const bytes = goalBytes(roomDir);
    const two = jtbdState.setGoal(roomDir, { jtbd: 'find-problem', set_by: 'gate_answer', decision_node_id: 'decision:gate:wr01c' });
    assert.ok(two && two.unchanged === true && two.ok === true, 'second call is unchanged: ' + JSON.stringify(two));
    assert.equal(goalBytes(roomDir), bytes, 'no byte moved');
    const three = jtbdState.setGoal(roomDir, { jtbd: 'find-problem', set_by: 'gate_answer', decision_node_id: 'decision:gate:other' });
    assert.equal(three.goal_version, 2, 'a different decision node writes: ' + JSON.stringify(three));
  });
}

// -- WR-02 -------------------------------------------------------------------------
async function groupWR02() {
  console.log('WR-02 the durable answer wins over the TTL');
  await arm('WR-02a an answer committed as the TTL runs out replays as recorded, never gate_expired', async () => {
    const r = newRoom(1);
    const g = boot(r.roomDir);
    const s = sid('wr02a', r);
    const out = await g.render({ header: 'Ttl edge', kind: 'general', options: OPTS }, s);
    const gateId = out.gate_id;
    const real = navigation.withRoomTx;
    const first = await patched(navigation, 'withRoomTx', () => function (db, fn, o) {
      const result = real(db, fn, o);
      gateLedger._internal.backdate(gateId, gateLedger.LEDGER_TTL_MS + 1000);
      return result;
    }, () => g.answer(gateId, ['approve'], 'approve', s));
    assert.equal(first.ok, true, 'the committed answer is ok: ' + JSON.stringify(first));
    const retry = await g.answer(gateId, ['approve'], 'approve', s);
    assert.equal(retry.ok, true, 'the retry is not gate_expired: ' + JSON.stringify(retry));
    assert.equal(retry.replayed, true, JSON.stringify(retry));
    assert.equal(retry.decision_node_id, 'decision:gate:' + gateId);
  });

  await arm('WR-02b a never-answered gate past its TTL still reads gate_expired', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const s = sid('wr02b', r);
    const out = await g.render({ header: 'Never answered', kind: 'general', options: OPTS }, s);
    gateLedger._internal.backdate(out.gate_id, gateLedger.LEDGER_TTL_MS + 1000);
    const late = await g.answer(out.gate_id, ['approve'], 'approve', s);
    assert.equal(late.reason, 'gate_expired', JSON.stringify(late));
    assert.equal(nodeCount(r.roomDir, 'decision:gate:' + out.gate_id), 0, 'nothing written');
  });
}

// -- WR-03 -------------------------------------------------------------------------
async function groupWR03() {
  console.log('WR-03 approving ids on gate_render');
  await arm('WR-03a approve naming the Hold option is chosen_not_approving and writes nothing', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const s = sid('wr03a', r);
    const out = await g.render({ header: 'Coherence', kind: 'general', options: OPTS, approving: ['approve'] }, s);
    assert.equal(out.ok, true, JSON.stringify(out));
    const refused = await g.answer(out.gate_id, ['hold'], 'approve', s);
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.reason, 'chosen_not_approving', JSON.stringify(refused));
    assert.equal(nodeCount(r.roomDir, 'decision:gate:' + out.gate_id), 0, 'no decision node');
    const mismatch = await g.answer(out.gate_id, ['approve'], 'reject', s);
    assert.equal(mismatch.reason, 'verdict_chosen_mismatch', JSON.stringify(mismatch));
    const ok = await g.answer(out.gate_id, ['approve'], 'approve', s);
    assert.equal(ok.ok, true, 'the gate survived both refusals: ' + JSON.stringify(ok));
  });

  await arm('WR-03b approving ids that are not option ids are refused bad_approving', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const out = await g.render({ header: 'Bad approving', kind: 'general', options: OPTS, approving: ['nope'] }, sid('wr03b', r));
    assert.equal(out.ok, false, JSON.stringify(out));
    assert.equal(out.reason, 'bad_approving', JSON.stringify(out));
  });

  await arm('WR-03c a card without approving behaves as before: an approve with any option ratifies', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const s = sid('wr03c', r);
    const out = await g.render({ header: 'No approving', kind: 'general', options: OPTS }, s);
    const ok = await g.answer(out.gate_id, ['hold'], 'approve', s);
    assert.equal(ok.ok, true, JSON.stringify(ok));
    assert.equal(ok.ratified, true);
  });
}

// -- WR-04 -------------------------------------------------------------------------
async function groupWR04() {
  console.log('WR-04 the stale check inside the transaction, evidence included');
  await arm('WR-04a a subject written between the pre-check and the transaction is stale_subject, nothing written', async () => {
    const r = newRoom(2);
    const g = boot(r.roomDir);
    const s = sid('wr04a', r);
    const subject = r.claims[0];
    const out = await g.render({ header: 'Race', kind: 'general', options: OPTS, subject_node_id: subject }, s);
    assert.equal(out.ok, true, JSON.stringify(out));
    const real = navigation.withRoomTx;
    const refused = await patched(navigation, 'withRoomTx', () => function (db, fn, o) {
      db.prepare('UPDATE nodes SET last_seen_at = ? WHERE id = ?').run(Date.now() + 9, subject);
      return real(db, fn, o);
    }, () => g.answer(out.gate_id, ['approve'], 'approve', s));
    assert.equal(refused.reason, 'stale_subject', JSON.stringify(refused));
    assert.equal(nodeCount(r.roomDir, 'decision:gate:' + out.gate_id), 0, 'no decision node');
    const status = withRead(r.roomDir, (db) => db.prepare('SELECT review_status AS s FROM nodes WHERE id = ?').get(subject).s);
    assert.equal(status, 'proposed', 'the claim is untouched');
    const dismissed = await g.answer(out.gate_id, ['reject'], 'reject', s);
    assert.equal(dismissed.ok, true, 'the gate stayed answerable: ' + JSON.stringify(dismissed));
  });

  await arm('WR-04b a changed evidence node is stale_subject on approve', async () => {
    const r = newRoom(2);
    const g = boot(r.roomDir);
    const s = sid('wr04b', r);
    const out = await g.render({ header: 'Evidence', kind: 'general', options: OPTS, subject_node_id: r.claims[0], evidence_node_ids: [r.claims[1]] }, s);
    assert.equal(out.ok, true, JSON.stringify(out));
    touchNode(r.roomDir, r.claims[1]);
    const refused = await g.answer(out.gate_id, ['approve'], 'approve', s);
    assert.equal(refused.reason, 'stale_subject', JSON.stringify(refused));
    assert.equal(nodeCount(r.roomDir, 'decision:gate:' + out.gate_id), 0, 'no decision node');
  });

  await arm('WR-04c a subject whose revision was unknown at mint (no feed then) is not stale when a feed row appears', async () => {
    roomSeq += 1;
    const built = buildRoom369({ tmpDir: path.join(TMP, 'rooms', 'r' + roomSeq), slug: 'r' + roomSeq, variant: 'wide', migrate: false });
    const roomDir = built.roomDir;
    registerRoom(built.slug, roomDir);
    const r = { roomDir: roomDir, slug: built.slug };
    const subject = 'claim:wr04c-legacy';
    withWrite(roomDir, (db) => db.prepare(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) VALUES (?, 'claim', '{}', 'test:wr04c', 'system', 'proposed', ?, ?)"
    ).run(subject, Date.now(), Date.now()));
    assert.equal(withRead(roomDir, (db) => db.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE name = 'room_change_log'").get().c), 0, 'no feed yet');
    const g = boot(roomDir);
    const s = sid('wr04c', r);
    const out = await g.render({ header: 'Legacy room', kind: 'review', options: OPTS, subject_node_id: subject }, s);
    assert.equal(out.ok, true, JSON.stringify(out));
    const live = gateLedger.peekGate(out.gate_id, s);
    assert.equal(live.subjectRevision, null, 'unknown at mint is null, not 0: ' + JSON.stringify(live.subjectRevision));
    const db = roomDbMod.openRoomDb(roomDir);
    roomDbMod.closeRoomDb(db);
    touchNode(roomDir, subject);
    const ok = await g.answer(out.gate_id, ['approve'], 'approve', s);
    assert.equal(ok.ok, true, 'not a false stale_subject: ' + JSON.stringify(ok));
  });
}

// -- WR-05 -------------------------------------------------------------------------
async function groupWR05() {
  console.log('WR-05 no takeover, no re-mint of an answered id, purge, per-session cap');
  await arm('WR-05a a second session cannot take a live gate id; the owner still ratifies', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const a = sid('wr05a-owner', r);
    const b = sid('wr05a-other', r);
    const id = 'wr05-live-' + Date.now();
    const mine = await g.render({ gate_id: id, header: 'Mine', kind: 'general', options: OPTS }, a);
    assert.equal(mine.ok, true, JSON.stringify(mine));
    const theirs = await g.render({ gate_id: id, header: 'Theirs', kind: 'general', options: OPTS }, b);
    assert.equal(theirs.ok, false, JSON.stringify(theirs));
    assert.equal(theirs.reason, 'gate_id_in_use', JSON.stringify(theirs));
    const again = await g.render({ gate_id: id, header: 'Mine again', kind: 'general', options: OPTS }, a);
    assert.equal(again.reason, 'gate_id_in_use', 'a live caller-chosen id is refused for its owner too: ' + JSON.stringify(again));
    const done = await g.answer(id, ['approve'], 'approve', a);
    assert.equal(done.ok, true, 'the owner is not locked out: ' + JSON.stringify(done));
    const reused = await g.render({ gate_id: id, header: 'After the answer', kind: 'general', options: OPTS }, b);
    assert.equal(reused.reason, 'gate_id_answered', JSON.stringify(reused));
    assert.equal(nodeCount(r.roomDir, 'decision:gate:' + id), 1, 'still exactly one decision node');
  });

  await arm('WR-05b mintGate returns false for a cross-session collision (ledger untouched), true otherwise', async () => {
    const id = 'wr05b-' + Date.now();
    assert.equal(gateLedger.mintGate(id, { card: { header: 'a' }, sessionId: 'sess-A', kind: 'general' }), true);
    assert.equal(gateLedger.mintGate(id, { card: { header: 'b' }, sessionId: 'sess-B', kind: 'general' }), false);
    assert.equal(gateLedger._internal._ledger.get(id).sessionKey, 'sess-A', 'the owner kept it');
    assert.equal(gateLedger.mintGate(id, { card: { header: 'a2' }, sessionId: 'sess-A', kind: 'general' }), true, 'same session may replace');
    assert.equal(gateLedger.consumeGate.length, 2);
    assert.equal(gateLedger.peekGate.length, 2);
    gateLedger.consumeGate(id, 'sess-A');
  });

  await arm('WR-05c every mint purges expired entries: 5,000 old mints leave only live entries', async () => {
    const ledger = gateLedger._internal._ledger;
    const old = Date.now() - gateLedger.LEDGER_TTL_MS - 5000;
    for (let i = 0; i < 5000; i += 1) {
      gateLedger.mintGate('wr05c-old-' + i, { card: {}, sessionId: 'purge-session', kind: 'general', mintedAt: old });
    }
    gateLedger.mintGate('wr05c-fresh', { card: {}, sessionId: 'purge-session', kind: 'general' });
    let expiredLeft = 0;
    for (const e of ledger.values()) if (Date.now() - e.mintedAt > gateLedger.LEDGER_TTL_MS) expiredLeft += 1;
    assert.equal(expiredLeft, 0, 'no expired entry stays: ' + expiredLeft + ' of ' + ledger.size);
    assert.ok(ledger.has('wr05c-fresh'));
    assert.equal(gateLedger.isGateExpired('wr05c-old-4999'), true, 'a purged id still reads expired (until the memory cap)');
    gateLedger.consumeGate('wr05c-fresh', 'purge-session');
  });

  await arm('WR-05d one session past the cap of live gates is refused too_many_open_gates, others are not', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const capped = sid('wr05d-capped', r);
    assert.equal(typeof gateLedger.liveCountFor, 'function', 'liveCountFor exists');
    for (let i = 0; i < 200; i += 1) {
      gateLedger.mintGate('wr05d-fill-' + i, { card: {}, sessionId: capped, kind: 'general' });
    }
    assert.equal(gateLedger.liveCountFor(capped), 200);
    const refused = await g.render({ header: 'One too many', kind: 'general', options: OPTS }, capped);
    assert.equal(refused.reason, 'too_many_open_gates', JSON.stringify(refused));
    const other = await g.render({ header: 'Fine', kind: 'general', options: OPTS }, sid('wr05d-other', r));
    assert.equal(other.ok, true, JSON.stringify(other));
    for (let i = 0; i < 200; i += 1) gateLedger.consumeGate('wr05d-fill-' + i, capped);
  });
}

// -- WR-06 -------------------------------------------------------------------------
async function groupWR06InProcess() {
  console.log('WR-06 a replay lookup failure is its own retryable state');
  async function answeredGate(g, room, label) {
    const s = sid('wr06', room);
    const out = await g.render({ header: label, kind: 'general', options: OPTS }, s);
    const done = await g.answer(out.gate_id, ['approve'], 'approve', s);
    assert.equal(done.ok, true, JSON.stringify(done));
    return { gateId: out.gate_id, sid: s };
  }

  await arm('WR-06a a query that throws answers replay_lookup_failed, not unknown_gate; then replays when readable', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const done = await answeredGate(g, r, 'Throwing lookup');
    const failedLookup = await patched(navigation, 'readGateAnswerAnchor', () => function () { throw new Error('lookup fault injected by test'); },
      () => g.answer(done.gateId, ['approve'], 'approve', done.sid));
    assert.equal(failedLookup.ok, false, JSON.stringify(failedLookup));
    assert.equal(failedLookup.reason, 'replay_lookup_failed', JSON.stringify(failedLookup));
    const good = await g.answer(done.gateId, ['approve'], 'approve', done.sid);
    assert.equal(good.replayed, true, 'the retry replays: ' + JSON.stringify(good));
  });

  await arm('WR-06b an unopenable room.db answers replay_lookup_failed', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const done = await answeredGate(g, r, 'Unopenable db');
    const dbPath = path.join(r.roomDir, '.mindrian', 'room.db');
    const keep = dbPath + '.keep38';
    fs.renameSync(dbPath, keep);
    fs.writeFileSync(dbPath, 'this is not a sqlite database');
    let failedLookup;
    try {
      failedLookup = await g.answer(done.gateId, ['approve'], 'approve', done.sid);
    } finally {
      fs.rmSync(dbPath, { force: true });
      fs.renameSync(keep, dbPath);
    }
    assert.equal(failedLookup.reason, 'replay_lookup_failed', JSON.stringify(failedLookup));
    const good = await g.answer(done.gateId, ['approve'], 'approve', done.sid);
    assert.equal(good.replayed, true, JSON.stringify(good));
  });

  await arm('WR-06c one malformed memory_event row does not change a real replay', async () => {
    const r = newRoom(0);
    const g = boot(r.roomDir);
    const done = await answeredGate(g, r, 'Malformed neighbour');
    withWrite(r.roomDir, (db) => db.prepare(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) VALUES ('memory_event:bad38', 'memory_event', '{not json', 'test:wr06c', 'system', 'proposed', ?, ?)"
    ).run(Date.now(), Date.now()));
    const again = await g.answer(done.gateId, ['approve'], 'approve', done.sid);
    assert.equal(again.replayed, true, JSON.stringify(again));
    const unknown = await g.answer('never-minted-wr06c', ['approve'], 'approve', done.sid);
    assert.equal(unknown.reason, 'unknown_gate', 'a bound session with a readable room still reads unknown_gate: ' + JSON.stringify(unknown));
  });
}

async function groupWR06Daemon() {
  const D = require(path.join(__dirname, 'helpers', 'mcp-daemon-369.cjs'));
  const parseTool = (result) => {
    const text = result && result.content && result.content[0] && result.content[0].text;
    const marker = text.indexOf('\n\n## Suggested Next');
    return JSON.parse(marker === -1 ? text : text.slice(0, marker));
  };
  let h = null;
  const clients = [];
  try {
    try {
      h = await D.startDaemon({
        rooms: [
          { slug: 'room-x', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: 'WR-06 daemon fixture claim stays local.' }] },
          { slug: 'room-y', variant: 'wide', migrate: true },
        ],
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      return 'skip';
    }
    const call = async (c, name, args) => parseTool(await c.client.callTool({ name: name, arguments: args }));
    await arm('WR-06d a session unbound after a daemon restart reads replay_lookup_failed, not unknown_gate', async () => {
      const A = await D.legacyClient(h.port, 'wr06-before');
      clients.push(A);
      assert.equal((await call(A, 'room_bind', { room: 'room-y' })).ok, true);
      const out = await call(A, 'gate_render', { header: 'Before restart', kind: 'general', select_mode: 'single', options: OPTS });
      assert.equal(out.ok, true, JSON.stringify(out));
      const done = await call(A, 'gate_answer', { gate_id: out.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(done.ok, true, JSON.stringify(done));
      h = await D.restartDaemon(h);
      const B = await D.legacyClient(h.port, 'wr06-after');
      clients.push(B);
      const lost = await call(B, 'gate_answer', { gate_id: out.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(lost.ok, false, JSON.stringify(lost));
      assert.equal(lost.reason, 'replay_lookup_failed', JSON.stringify(lost));
      assert.equal((await call(B, 'room_bind', { room: 'room-y' })).ok, true);
      const replay = await call(B, 'gate_answer', { gate_id: out.gate_id, chosen: ['approve'], verdict: 'approve' });
      assert.equal(replay.replayed, true, 'once bound the answer replays: ' + JSON.stringify(replay));
    });
  } finally {
    for (const c of clients) { try { await c.close(); } catch (_e) { /* best effort */ } }
    if (h) { try { await D.stopDaemon(h); } catch (_e) { /* best effort */ } }
  }
  return 'ran';
}

async function main() {
  await groupWR01();
  await groupWR02();
  await groupWR03();
  await groupWR04();
  await groupWR05();
  await groupWR06InProcess();
  let daemon = 'ran';
  try {
    daemon = await groupWR06Daemon();
  } catch (err) {
    failed += 1;
    console.log('  FAIL WR-06d daemon leg crashed: ' + (err && err.message ? err.message : String(err)));
  }

  // Dash guard on this file.
  const self = fs.readFileSync(__filename, 'utf8');
  const bad = self.indexOf(String.fromCharCode(0x2014)) !== -1 || self.indexOf(String.fromCharCode(0x2013)) !== -1;
  if (bad) { failed += 1; console.log('  FAIL dash guard: this file holds an em-dash or en-dash'); } else { passed += 1; console.log('  PASS dash guard'); }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (firstFail) console.log('FIRST FAIL: ' + firstFail);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  if (failed > 0) process.exit(1);
  if (daemon === 'skip') process.exit(77);
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL (harness): ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
