#!/usr/bin/env node
'use strict';
/*
 * Phase 383 plan 01 (QA383-04, D-01, D-03): a preview checks the environment before it shows a card.
 *
 * Today room_create shows an approval card, the user approves, and only then does the registry
 * spawn fail. After D-03 the preview asks resolveRoomRuntime first: with no working bash and no
 * working Python the user gets a plain refusal, no card, and nothing on disk. The approval step
 * checks again, because the machine can change between the card and the answer.
 *
 * The runtime is made to fail with no test seam: PATH is an empty directory and the override
 * variables are removed, so a real probe finds nothing.
 *
 *   P1  prepareRoomCreation returns environment_not_ready with a plain text and a tried list
 *   P2  that refusal leaves no live gate and an unchanged rooms home
 *   P3  a gate minted while the machine was ready is refused again at approval if it is no longer ready
 *   P4  birthRoom itself refuses before it writes anything
 *   P5  autoCreatePlaceholderRoom refuses before it makes the rooms home (D-01)
 *   P6  the CLI new-project command and skill name platform.cjs room-runtime before their B2 gate
 *   P7  with a ready machine the preview still returns a card (guard leg)
 *
 * Hermetic: HOME and the rooms vars are mkdtemp dirs before any repo require. No network.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/harness-383.cjs');

const hermetic = H.hermeticEnv('preview');
H.applyEnv(hermetic.env);
const REAL_PATH = process.env.PATH;
const EMPTY_PATH = H.mkTmp('emptypath');

const ROOT = path.resolve(__dirname, '..');
const platform = require('../lib/core/platform.cjs');
const gateLedger = require('../lib/mcp/gate-ledger.cjs');
const operations = require('../lib/mcp/startup-operations.cjs');
const rep = H.reporter('test-383-preview-env-check');

const STUB = { server: { getClientCapabilities: function () { return {}; } } };
function resetPlatform() { if (typeof platform.__resetForTests === 'function') platform.__resetForTests(); }
function useFailingPath() { process.env.PATH = EMPTY_PATH; resetPlatform(); }
function useRealPath() { process.env.PATH = REAL_PATH; resetPlatform(); }
function ok(cond, what) { if (!cond) throw new Error(what); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const legs = [];
function leg(label, fn) { legs.push({ label: label, fn: fn }); }

leg('P1 prepareRoomCreation returns environment_not_ready with a plain text and a tried list', async function () {
  useFailingPath();
  const r = await operations.prepareRoomCreation(STUB, {}, 'sess-383-p1', { name: 'Probe Room', purpose: 'probe' });
  ok(r.ok === false, 'ok is ' + r.ok + ' (want false); the preview returned a card: ' + JSON.stringify(Object.keys(r)));
  ok(r.reason === 'environment_not_ready', 'reason is ' + JSON.stringify(r.reason));
  ok(typeof r.plain === 'string' && r.plain.length > 0, 'no plain text: ' + JSON.stringify(r.plain));
  ok(Array.isArray(r.tried), 'tried is not an array');
});

leg('P2 the refusal leaves no live gate and an unchanged rooms home', async function () {
  useFailingPath();
  const before = H.snapshotTree(hermetic.roomsHome);
  await operations.prepareRoomCreation(STUB, {}, 'sess-383-p2', { name: 'Probe Room Two', purpose: 'probe' });
  ok(gateLedger.liveCountFor('sess-383-p2') === 0, 'live gates for the session: ' + gateLedger.liveCountFor('sess-383-p2'));
  const after = H.snapshotTree(hermetic.roomsHome);
  ok(same(before, after), 'the rooms home changed: ' + JSON.stringify(after.filter(function (p) { return before.indexOf(p) === -1; })));
});

leg('P3 a gate minted while ready is refused again at approval when the machine is no longer ready', async function () {
  const sid = 'sess-383-p3';
  useRealPath();
  const prepared = await operations.prepareRoomCreation(STUB, {}, sid, { name: 'Probe Room', purpose: 'probe' });
  ok(prepared.ok === true && prepared.gate && prepared.gate.gate_id, 'the preview with a ready machine returned no gate: ' + JSON.stringify(prepared).slice(0, 200));
  useFailingPath();
  const gateId = prepared.gate.gate_id;
  const live = gateLedger.peekGate(gateId, sid);
  ok(live && typeof live.resumeFn === 'function', 'no live gate to answer');
  const res = operations.answerRoomCreation(live, { gate_id: gateId, verdict: 'approve', chosen: ['approve'], answered_via: 'test' }, sid);
  ok(res.room_creation && res.room_creation.reason === 'environment_not_ready', 'room_creation is ' + JSON.stringify(res.room_creation));
  ok(!fs.existsSync(path.join(hermetic.roomsHome, 'probe-room')), 'the room folder probe-room exists after a refused approval');
});

leg('P4 birthRoom refuses before it writes anything', function () {
  useFailingPath();
  const navigation = require('../lib/core/navigation.cjs');
  const roomDir = path.join(hermetic.roomsHome, 'g383');
  const r = navigation.birthRoom({ approvedBy: 'navigator', slug: 'g383', roomDir: roomDir, sessionId: 'nosession', vname: 'G', ventureText: 'g' });
  ok(r && r.reason === 'environment_not_ready', 'reason is ' + JSON.stringify(r && r.reason));
  ok(!fs.existsSync(roomDir), 'the room folder exists after a refused birth');
});

leg('P5 autoCreatePlaceholderRoom refuses before it makes the rooms home (D-01)', function () {
  useFailingPath();
  const { autoCreatePlaceholderRoom } = require('../lib/core/room-auto-create.cjs');
  const fresh = path.join(hermetic.home, 'fresh-rooms');
  const r = autoCreatePlaceholderRoom(fresh);
  ok(r && r.ok === false && r.reason === 'environment_not_ready', 'result is ' + JSON.stringify(r));
  ok(!fs.existsSync(fresh), 'the rooms home ' + fresh + ' exists after a refused auto-create');
});

leg('P6 the new-project command and skill name platform.cjs room-runtime before the B2 gate', function () {
  for (const rel of ['commands/new-project.md', 'skills/new-project/SKILL.md']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const iCheck = src.indexOf('platform.cjs room-runtime');
    const iGate = src.indexOf('B2 GATE');
    ok(iGate >= 0, rel + ' has no B2 GATE line');
    ok(iCheck >= 0, rel + ' does not name platform.cjs room-runtime');
    ok(iCheck < iGate, rel + ': platform.cjs room-runtime (' + iCheck + ') comes after B2 GATE (' + iGate + ')');
  }
});

leg('P7 with a ready machine the preview returns a card (guard leg)', async function () {
  useRealPath();
  const r = await operations.prepareRoomCreation(STUB, {}, 'sess-383-p7', { name: 'Probe Room Seven', purpose: 'probe' });
  ok(r.ok === true && r.gate && typeof r.gate.gate_id === 'string', 'result is ' + JSON.stringify(r).slice(0, 200));
});

(async function main() {
  for (const l of legs) {
    try { await l.fn(); rep.pass(l.label); } catch (e) { rep.fail(l.label, String(e && e.message || e)); }
  }
  useRealPath();
  rep.done();
})();
