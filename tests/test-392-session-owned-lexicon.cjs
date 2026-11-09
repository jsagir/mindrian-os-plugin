#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-11 (phase wave 3, item P5; 392-SC5): the session-owned room
 * lexicon on the CLI hook path.
 *
 * Rule (392-CONTEXT.md wave 3, F8): the Part 8 lexicon check resolves the
 * room of THIS session through resolveSessionRoom({sessionId,
 * requireOwnership: true}). An unbound session gives an empty lexicon and
 * allows. A bound room whose room.db cannot be read, or a resolver failure,
 * blocks with class room_check_unavailable for every payload kind. Two
 * sessions bound to different rooms never share a lexicon. Without a session
 * id (the shim on Claude Desktop and Cowork, or any process where
 * CLAUDE_CODE_SESSION_ID is absent) the check runs against the machine-global
 * active room, today's behaviour, and the verdict, the sentinel and telemetry
 * record lexicon_scope machine_global.
 *
 * Part 8: every string in this file is invented. The synthetic rooms are the
 * gate-lexgen, gate-claims and gate-segment rooms of
 * tests/helpers/synthetic-room-db.cjs (invented names). The binding files are
 * written under a temporary rooms home (MINDRIAN_ROOMS_HOME). No real room is
 * read or written. No session id is printed by any probe line.
 *
 * Legs:
 *   L1  RED anchor: hook with session B and room B's word exits 2
 *       (room_content); hook with session A and room B's word exits 0.
 *   L2  the mirror: session A and room A's word exits 2; session B and room
 *       A's word exits 0.
 *   L3  unbound session with a generic question exits 0.
 *   L4  no session id: the machine-global active room A; room A's word exits
 *       2, room B's word exits 0.
 *   L5  bound but unreadable (room.db chmod 000): a generic question and a
 *       3-word sprout exit 2 with room_check_unavailable. RED on beta.81: 0.
 *   L6  resolver failure (a binding file with invalid JSON): a generic
 *       question and a 3-word sprout exit 2 with room_check_unavailable.
 *   L7  in-process: classify and theoVerdict with roomStatus 'unavailable'
 *       block room_check_unavailable for a sprout, an edge, a body, a
 *       brain_search query and a brain_query cypher; lexicon_scope carried.
 *   L8  resolveLexiconRoom result shapes for every case; never throws.
 *   L9  telemetry: after the session B run room B holds one brain_egress_*
 *       row with lexicon_scope session and room A none; after a no-session
 *       run room A holds one row with lexicon_scope machine_global; nothing
 *       is written for the unbound and the unavailable runs.
 *   L10 brain-client in process with CLAUDE_CODE_SESSION_ID set to B, to the
 *       unbound id, to the corrupt id, and unset: the sentinel class, the
 *       lexicon_scope, and zero captured bytes for the blocked cases.
 *   L11 the MINDRIAN_PART8_DEBUG probe line in the hook and in brain-client:
 *       present or absent and the scope, never the id.
 *   L12 hook wall time on a generic question under 2,000 ms (printed).
 *
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(REPO_ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const LEXICON_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-room-lexicon.cjs');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
const SPINE_EVENTS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs');

// Isolate HOME and the rooms home before any plugin module loads.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-11-sess-'));
const HOME = path.join(TMP, 'home');
const ROOMS = path.join(TMP, 'rooms');
fs.mkdirSync(HOME);
fs.mkdirSync(path.join(ROOMS, '.rooms', 'sessions'), { recursive: true });
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_ROOMS_HOME = ROOMS;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_PART8_DEBUG;

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

const loader = require(path.join(REPO_ROOT, 'tests', 'helpers', 'audit-probe-loader.cjs'));
const rooms = loader.makeRooms(ROOMS, REPO_ROOT);
const ROOM_A = rooms.roomFor('gate-lexgen');   // room_term "Quillfern Labs" (invented)
const ROOM_B = rooms.roomFor('gate-claims');   // a claim about Dravi couriers (invented)
const ROOM_C = rooms.roomFor('gate-segment');  // the unreadable room
const SLUG_A = 'gate-lexgen';
const SLUG_B = 'gate-claims';
const SLUG_C = 'gate-segment';

// Session ids (invented, long enough that an accidental echo is detectable).
const SESSION_A = 'sess-a-7c1e4b90';
const SESSION_B = 'sess-b-3d9f2a61';
const SESSION_UNBOUND = 'sess-unbound-9f2c77e0';
const SESSION_CORRUPT = 'sess-corrupt-51aa0c3d';
const SESSION_UNREADABLE = 'sess-unreadable-e04b6f12';
const ALL_IDS = [SESSION_A, SESSION_B, SESSION_UNBOUND, SESSION_CORRUPT, SESSION_UNREADABLE];

// Sprout questions (4 to 7 words, no capital letter, no digit).
const WORD_A = 'quillfern labs pricing framework';
const WORD_B = 'dravi couriers refuse night routes fuel rebate';
const GENERIC = 'what is jobs to be done';
const SPROUT3 = 'lean canvas steps';
const EDGE = 'how should the team plan the pilot with the partners after the kickoff when the group reviews the results next quarter';
const BODY = 'The first draft of the plan was signed last spring. ' +
  'The second part covers the market size. The third part covers the pricing tiers.';

const TOOL_ASK = 'mcp__plugin_mos_mindrian-brain__brain_ask';

function writeRegistry(extra) {
  const reg = Object.assign({
    active: SLUG_A,
    rooms: {},
  }, extra || {});
  reg.rooms[SLUG_A] = { path: SLUG_A };
  reg.rooms[SLUG_B] = { path: SLUG_B };
  reg.rooms[SLUG_C] = { path: SLUG_C };
  fs.writeFileSync(path.join(ROOMS, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2));
}
function writeBinding(sessionId, slug) {
  fs.writeFileSync(path.join(ROOMS, '.rooms', 'sessions', sessionId + '.json'), JSON.stringify({
    bound: [slug], primary: slug, sticky: false, updated: new Date().toISOString(),
  }));
}
writeRegistry();
writeBinding(SESSION_A, SLUG_A);
writeBinding(SESSION_B, SLUG_B);
writeBinding(SESSION_UNREADABLE, SLUG_C);
fs.writeFileSync(path.join(ROOMS, '.rooms', 'sessions', SESSION_CORRUPT + '.json'), '{ this is not json');
const DB_C = path.join(ROOM_C, '.mindrian', 'room.db');
const DB_C_MODE = fs.statSync(DB_C).mode & 0o777;
if (!IS_ROOT) fs.chmodSync(DB_C, 0);

let passed = 0;
let failed = 0;
let skipped = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL - ' + name);
    console.error('    ' + (err && err.message ? err.message : err));
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL - ' + name);
    console.error('    ' + (err && err.message ? err.message : err));
  }
}
function skip(name, why) {
  skipped += 1;
  console.log('  SKIP - ' + name + ': ' + why);
}

function hookEnv(extra) {
  const env = Object.assign({}, process.env, {
    HOME: HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: ROOMS, PART8_FORCE_BRAIN_AVAILABLE: '1',
  }, extra || {});
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  if (!extra || !extra.MINDRIAN_PART8_DEBUG) delete env.MINDRIAN_PART8_DEBUG;
  return env;
}

// Spawn the hook once. sessionId undefined = no session_id key in the payload.
function runHook(question, sessionId, extraEnv) {
  const payload = { tool_name: TOOL_ASK, tool_input: { question: question } };
  if (typeof sessionId === 'string') payload.session_id = sessionId;
  const s = process.hrtime.bigint();
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload), encoding: 'utf8', env: hookEnv(extraEnv), timeout: 20000,
  });
  return { code: res.status, stderr: res.stderr || '', stdout: res.stdout || '', ms: Number(process.hrtime.bigint() - s) / 1e6 };
}

function noIds(text) {
  return ALL_IDS.every(function (id) { return String(text).indexOf(id) === -1; });
}

// brain_egress_* memory_event rows of a room, read through the read-only door.
function egressRows(roomDir) {
  const db = require(SPINE_EVENTS_PATH).openRoomDbReadOnlyForCaller(roomDir);
  if (!db) throw new Error('could not open room.db read-only');
  try {
    const rows = db.prepare("SELECT properties FROM nodes WHERE type = 'memory_event'").all();
    return rows.map(function (r) {
      try { return JSON.parse(r.properties || '{}'); } catch (_e) { return {}; }
    }).filter(function (p) { return typeof p.event_type === 'string' && p.event_type.indexOf('brain_egress_') === 0; });
  } finally {
    try { db.close(); } catch (_e) { /* best effort */ }
  }
}

function freshGuard() {
  delete require.cache[GUARD_PATH];
  return require(GUARD_PATH);
}

async function main() {
  console.log('test-392-session-owned-lexicon: ' + (IS_ROOT ? 'running as root (the unreadable leg is skipped)' : 'uid ' + process.getuid()));

  // ---- L1, L2: two sessions never share a lexicon --------------------------
  const rowsBBefore = egressRows(ROOM_B).length;
  const rowsABefore = egressRows(ROOM_A).length;

  const l1Block = runHook(WORD_B, SESSION_B);
  const l1Allow = runHook(WORD_B, SESSION_A);
  check('L1 session B with room B\'s word exits 2 room_content; session A with room B\'s word exits 0', function () {
    assert.strictEqual(l1Block.code, 2, 'session B exit ' + l1Block.code + ' stderr: ' + l1Block.stderr.slice(0, 200));
    assert.ok(l1Block.stderr.indexOf('room_content') !== -1, 'class missing: ' + l1Block.stderr.slice(0, 200));
    assert.strictEqual(l1Allow.code, 0, 'session A exit ' + l1Allow.code + ' stderr: ' + l1Allow.stderr.slice(0, 200));
    assert.ok(noIds(l1Block.stderr + l1Allow.stderr), 'a session id was echoed');
  });

  const rowsBAfterL1 = egressRows(ROOM_B);
  const rowsAAfterL1 = egressRows(ROOM_A);

  const l2Block = runHook(WORD_A, SESSION_A);
  const l2Allow = runHook(WORD_A, SESSION_B);
  check('L2 session A with room A\'s word exits 2 room_content; session B with room A\'s word exits 0', function () {
    assert.strictEqual(l2Block.code, 2, 'session A exit ' + l2Block.code + ' stderr: ' + l2Block.stderr.slice(0, 200));
    assert.ok(l2Block.stderr.indexOf('room_content') !== -1, 'class missing: ' + l2Block.stderr.slice(0, 200));
    assert.strictEqual(l2Allow.code, 0, 'session B exit ' + l2Allow.code + ' stderr: ' + l2Allow.stderr.slice(0, 200));
  });

  // ---- L3: unbound session, empty lexicon, allowed ---------------------------
  const rowsAAfterL2 = egressRows(ROOM_A).length;
  const rowsBAfterL2 = egressRows(ROOM_B).length;
  const l3 = runHook(GENERIC, SESSION_UNBOUND);
  const l3Word = runHook(WORD_A, SESSION_UNBOUND);
  check('L3 unbound session: a generic question exits 0; room A\'s word exits 0 too (empty lexicon, not the machine-global room)', function () {
    assert.strictEqual(l3.code, 0, 'generic exit ' + l3.code + ' stderr: ' + l3.stderr.slice(0, 200));
    assert.strictEqual(l3Word.code, 0, 'room A word under an unbound session exit ' + l3Word.code + ' stderr: ' + l3Word.stderr.slice(0, 200));
  });
  const rowsAAfterL3 = egressRows(ROOM_A).length;
  const rowsBAfterL3 = egressRows(ROOM_B).length;

  // ---- L4: no session id, machine-global active room A -----------------------
  const l4Block = runHook(WORD_A, undefined);
  const l4Allow = runHook(WORD_B, undefined);
  check('L4 no session id: room A\'s word exits 2 (machine-global active room A), room B\'s word exits 0', function () {
    assert.strictEqual(l4Block.code, 2, 'exit ' + l4Block.code + ' stderr: ' + l4Block.stderr.slice(0, 200));
    assert.ok(l4Block.stderr.indexOf('room_content') !== -1, 'class missing: ' + l4Block.stderr.slice(0, 200));
    assert.strictEqual(l4Allow.code, 0, 'exit ' + l4Allow.code + ' stderr: ' + l4Allow.stderr.slice(0, 200));
  });
  const rowsAAfterL4 = egressRows(ROOM_A);

  // ---- L5: bound but unreadable ---------------------------------------------
  let l5a = null;
  let l5b = null;
  if (IS_ROOT) {
    skip('L5 bound but unreadable room.db blocks room_check_unavailable', 'chmod 000 does not stop root');
  } else {
    l5a = runHook(GENERIC, SESSION_UNREADABLE);
    l5b = runHook(SPROUT3, SESSION_UNREADABLE);
    check('L5 bound but unreadable room.db: a generic question and a 3-word sprout exit 2 room_check_unavailable', function () {
      assert.strictEqual(l5a.code, 2, 'generic exit ' + l5a.code + ' stderr: ' + l5a.stderr.slice(0, 200));
      assert.ok(l5a.stderr.indexOf('room_check_unavailable') !== -1, 'class missing: ' + l5a.stderr.slice(0, 200));
      assert.strictEqual(l5b.code, 2, 'sprout exit ' + l5b.code + ' stderr: ' + l5b.stderr.slice(0, 200));
      assert.ok(l5b.stderr.indexOf('room_check_unavailable') !== -1, 'class missing: ' + l5b.stderr.slice(0, 200));
    });
  }

  // ---- L6: resolver failure (corrupt binding file) ---------------------------
  const l6a = runHook(GENERIC, SESSION_CORRUPT);
  const l6b = runHook(SPROUT3, SESSION_CORRUPT);
  check('L6 corrupt binding file: a generic question and a 3-word sprout exit 2 room_check_unavailable', function () {
    assert.strictEqual(l6a.code, 2, 'generic exit ' + l6a.code + ' stderr: ' + l6a.stderr.slice(0, 200));
    assert.ok(l6a.stderr.indexOf('room_check_unavailable') !== -1, 'class missing: ' + l6a.stderr.slice(0, 200));
    assert.strictEqual(l6b.code, 2, 'sprout exit ' + l6b.code + ' stderr: ' + l6b.stderr.slice(0, 200));
    assert.ok(l6b.stderr.indexOf('room_check_unavailable') !== -1, 'class missing: ' + l6b.stderr.slice(0, 200));
  });
  const rowsAAfterL6 = egressRows(ROOM_A).length;
  const rowsBAfterL6 = egressRows(ROOM_B).length;
  let rowsCAfterL6 = null;
  if (!IS_ROOT) {
    fs.chmodSync(DB_C, DB_C_MODE);
    rowsCAfterL6 = egressRows(ROOM_C).length;
    fs.chmodSync(DB_C, 0);
  }

  // ---- L7: in-process unavailable blocks every kind --------------------------
  const guard = freshGuard();
  check('L7 classify and theoVerdict with roomStatus unavailable block room_check_unavailable for every kind, lexicon_scope carried', function () {
    const cases = [
      ['brain_ask', { question: SPROUT3 }],
      ['brain_ask', { question: GENERIC }],
      ['brain_ask', { question: EDGE }],
      ['brain_ask', { question: BODY }],
      ['brain_search', { query: SPROUT3 }],
      ['brain_query', { cypher: 'MATCH (f:Framework) RETURN f.name LIMIT 5' }],
      ['mcp__theo__search', { query: GENERIC }],
    ];
    cases.forEach(function (c) {
      const v = guard.classify(c[1], { toolName: c[0], roomStatus: 'unavailable', roomDir: null, lexiconScope: 'session' });
      assert.strictEqual(v.verdict, 'block', c[0] + ' ' + JSON.stringify(c[1]).slice(0, 40) + ' -> ' + JSON.stringify(v));
      assert.strictEqual(v.class, 'room_check_unavailable', c[0] + ' class ' + v.class);
      assert.strictEqual(v.lexicon_scope, 'session', c[0] + ' lexicon_scope ' + v.lexicon_scope);
    });
    const tv = guard.theoVerdict({ question: SPROUT3 }, { toolName: 'brain_ask', roomStatus: 'unavailable', roomDir: null, lexiconScope: 'machine_global' });
    assert.strictEqual(tv.verdict, 'block', JSON.stringify(tv));
    assert.strictEqual(tv.class, 'room_check_unavailable', 'theoVerdict class ' + tv.class);
    assert.strictEqual(tv.lexicon_scope, 'machine_global');
    // A bound room still carries its scope on an allow.
    const ok = guard.classify({ question: GENERIC }, { toolName: 'brain_ask', roomStatus: 'bound', roomDir: ROOM_B, lexiconScope: 'session' });
    assert.strictEqual(ok.verdict, 'allow', JSON.stringify(ok));
    assert.strictEqual(ok.lexicon_scope, 'session');
    // Without the new options the verdict is byte-compatible (no lexicon_scope key).
    const old = guard.classify({ question: GENERIC }, { toolName: 'brain_ask', roomDir: null });
    assert.strictEqual(old.verdict, 'allow');
    assert.ok(!Object.prototype.hasOwnProperty.call(old, 'lexicon_scope'), 'lexicon_scope stamped without the option');
    // An operational Theo tool is not consulted against the lexicon and stays allowed.
    const op = guard.classify({ room: 'x' }, { toolName: 'mcp__theo__room_bind', roomStatus: 'unavailable', roomDir: null });
    assert.strictEqual(op.verdict, 'allow', 'operational tool under unavailable: ' + JSON.stringify(op));
  });

  // ---- L8: resolveLexiconRoom shapes ----------------------------------------
  const lex = require(LEXICON_PATH);
  check('L8 resolveLexiconRoom returns the typed result for every case and never throws', function () {
    assert.strictEqual(typeof lex.resolveLexiconRoom, 'function');
    const b = lex.resolveLexiconRoom({ sessionId: SESSION_B, requireOwnership: true });
    assert.deepStrictEqual(b, { status: 'bound', roomDir: ROOM_B, reason: 'session.primary', lexicon_scope: 'session' }, JSON.stringify(b));
    const u = lex.resolveLexiconRoom({ sessionId: SESSION_UNBOUND, requireOwnership: true });
    assert.deepStrictEqual(u, { status: 'unbound', roomDir: null, reason: 'no_binding', lexicon_scope: 'session' }, JSON.stringify(u));
    const g = lex.resolveLexiconRoom({});
    assert.deepStrictEqual(g, { status: 'bound', roomDir: ROOM_A, reason: 'reg.active', lexicon_scope: 'machine_global' }, JSON.stringify(g));
    const g2 = lex.resolveLexiconRoom();
    assert.deepStrictEqual(g2, g, 'no-argument form differs: ' + JSON.stringify(g2));
    const c = lex.resolveLexiconRoom({ sessionId: SESSION_CORRUPT, requireOwnership: true });
    assert.deepStrictEqual(c, { status: 'unavailable', roomDir: null, reason: 'resolver_error', lexicon_scope: 'session' }, JSON.stringify(c));
    if (!IS_ROOT) {
      const r = lex.resolveLexiconRoom({ sessionId: SESSION_UNREADABLE, requireOwnership: true });
      assert.deepStrictEqual(r, { status: 'unavailable', roomDir: ROOM_C, reason: 'room_unreadable', lexicon_scope: 'session' }, JSON.stringify(r));
    }
    // A binding whose primary names a room that is not on disk: unbound (nothing to protect).
    writeBinding('sess-missing-room-0a1b', 'no-such-room-xyz');
    const m = lex.resolveLexiconRoom({ sessionId: 'sess-missing-room-0a1b', requireOwnership: true });
    assert.deepStrictEqual(m, { status: 'unbound', roomDir: null, reason: 'room_missing', lexicon_scope: 'session' }, JSON.stringify(m));
    // The operator and test seam CLAUDE_ACTIVE_ROOM is honoured under a session id too.
    process.env.CLAUDE_ACTIVE_ROOM = ROOM_B;
    try {
      const e = lex.resolveLexiconRoom({ sessionId: SESSION_UNBOUND, requireOwnership: true });
      assert.deepStrictEqual(e, { status: 'bound', roomDir: ROOM_B, reason: 'env_override', lexicon_scope: 'machine_global' }, JSON.stringify(e));
    } finally {
      delete process.env.CLAUDE_ACTIVE_ROOM;
    }
    // Never throws: odd inputs.
    [{ sessionId: 123 }, { sessionId: '../escape' }, { sessionId: 'a/b' }, { home: path.join(TMP, 'nowhere') }, null, 'string'].forEach(function (arg) {
      const v = lex.resolveLexiconRoom(arg);
      assert.ok(v && typeof v === 'object' && ['bound', 'unbound', 'unavailable'].indexOf(v.status) !== -1, 'odd input ' + JSON.stringify(arg) + ' -> ' + JSON.stringify(v));
      assert.ok(['session', 'machine_global'].indexOf(v.lexicon_scope) !== -1, 'scope for ' + JSON.stringify(arg));
    });
    const trav = lex.resolveLexiconRoom({ sessionId: '../escape' });
    assert.strictEqual(trav.status, 'unavailable', 'a traversal id must not resolve a room: ' + JSON.stringify(trav));
    // The old string form stays for untouched callers.
    assert.strictEqual(typeof lex.resolveLexiconRoomDir, 'function', 'resolveLexiconRoomDir missing');
    assert.strictEqual(lex.resolveLexiconRoomDir(), ROOM_A);
  });

  // ---- L9: telemetry lands in the resolved room with its scope ---------------
  check('L9 telemetry: session B run wrote one row to room B with lexicon_scope session and none to room A; no-session run wrote to room A with machine_global; unbound and unavailable wrote nothing', function () {
    const newB = rowsBAfterL1.slice(rowsBBefore);
    assert.strictEqual(newB.length, 1, 'room B rows after L1: ' + newB.length + ' (before ' + rowsBBefore + ')');
    assert.strictEqual(newB[0].lexicon_scope, 'session', 'room B row: ' + JSON.stringify(newB[0]));
    assert.strictEqual(newB[0].event_type, 'brain_egress_blocked');
    // L1 ran two hooks: session B (blocked, room B above) and session A (allowed).
    // Room A therefore gained exactly the session A allow row, scope session.
    const newA1 = rowsAAfterL1.slice(rowsABefore);
    assert.strictEqual(newA1.length, 1, 'room A rows after L1: ' + newA1.length + ' (before ' + rowsABefore + ')');
    assert.strictEqual(newA1[0].event_type, 'brain_egress_allowed', 'room A row: ' + JSON.stringify(newA1[0]));
    assert.strictEqual(newA1[0].lexicon_scope, 'session', 'room A row: ' + JSON.stringify(newA1[0]));
    // L1's allow leg (session A, room B's word) and L2 wrote to room A only.
    assert.strictEqual(rowsBAfterL2, rowsBAfterL1.length + 1, 'room B after L2 (session B allow): ' + rowsBAfterL2);
    assert.ok(rowsAAfterL2 > rowsABefore, 'room A gained no row from the session A runs');
    // L3 (unbound) wrote nothing anywhere.
    assert.strictEqual(rowsAAfterL3, rowsAAfterL2, 'unbound run wrote to room A');
    assert.strictEqual(rowsBAfterL3, rowsBAfterL2, 'unbound run wrote to room B');
    // L4 (no session) wrote to room A with machine_global, both runs.
    const newA = rowsAAfterL4.slice(rowsAAfterL3);
    assert.strictEqual(newA.length, 2, 'room A rows after L4: ' + newA.length);
    newA.forEach(function (row) { assert.strictEqual(row.lexicon_scope, 'machine_global', 'room A row: ' + JSON.stringify(row)); });
    // L5 and L6 (unavailable) wrote nothing.
    assert.strictEqual(rowsAAfterL6, rowsAAfterL4.length, 'unavailable run wrote to room A');
    assert.strictEqual(rowsBAfterL6, rowsBAfterL3, 'unavailable run wrote to room B');
    if (rowsCAfterL6 !== null) assert.strictEqual(rowsCAfterL6, 0, 'unreadable room C gained rows: ' + rowsCAfterL6);
    // Hygiene: no row carries a question word or a session id.
    const all = JSON.stringify(rowsAAfterL4.concat(rowsBAfterL1));
    ['quillfern', 'dravi', 'couriers'].forEach(function (w) { assert.ok(all.toLowerCase().indexOf(w) === -1, 'a row carries text: ' + w); });
    assert.ok(noIds(all), 'a row carries a session id');
  });

  // ---- L10: brain-client in process ------------------------------------------
  const capture = require(path.join(REPO_ROOT, 'tests', 'helpers', 'brain-capture-server.cjs'));
  process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';
  const started = await capture.startCaptureServer();
  process.env.MINDRIAN_BRAIN_URL = started.url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real-392-11';
  delete require.cache[BRAIN_CLIENT_PATH];
  const brain = require(BRAIN_CLIENT_PATH);
  function withSession(id, fn) {
    if (typeof id === 'string') process.env.CLAUDE_CODE_SESSION_ID = id; else delete process.env.CLAUDE_CODE_SESSION_ID;
    lex._resetLexiconCache();
    return Promise.resolve().then(fn).finally(function () { delete process.env.CLAUDE_CODE_SESSION_ID; });
  }
  try {
    await checkAsync('L10a session B: ask(room B word) refuses room_content with lexicon_scope session, zero bytes on the wire', async function () {
      await withSession(SESSION_B, async function () {
        capture.resetCaptured();
        const r = await brain.ask(WORD_B);
        assert.ok(r && r.error === 'egress_blocked', 'not refused: ' + JSON.stringify(r));
        assert.strictEqual(r.egress_class, 'room_content', JSON.stringify(r));
        assert.strictEqual(r.lexicon_scope, 'session', JSON.stringify(r));
        assert.strictEqual(capture.captured.length, 0, 'wire received ' + capture.captured.length);
        assert.ok(JSON.stringify(r).indexOf('dravi') === -1 && noIds(JSON.stringify(r)), 'the refusal carries text or an id');
      });
    });
    await checkAsync('L10b session B: ask(room A word) reaches the wire (room A\'s lexicon is not consulted)', async function () {
      await withSession(SESSION_B, async function () {
        capture.resetCaptured();
        await brain.ask(WORD_A);
        assert.strictEqual(capture.captured.length, 1, 'wire received ' + capture.captured.length);
        assert.strictEqual(capture.captured[0].name, 'brain_ask');
      });
    });
    await checkAsync('L10c unbound session: ask(generic) reaches the wire', async function () {
      await withSession(SESSION_UNBOUND, async function () {
        capture.resetCaptured();
        await brain.ask(GENERIC);
        assert.strictEqual(capture.captured.length, 1, 'wire received ' + capture.captured.length);
      });
    });
    await checkAsync('L10d corrupt binding: ask, search, query and the callTool belt refuse room_check_unavailable with lexicon_scope session, zero bytes', async function () {
      await withSession(SESSION_CORRUPT, async function () {
        capture.resetCaptured();
        const a = await brain.ask(GENERIC);
        assert.ok(a && a.error === 'egress_blocked' && a.egress_class === 'room_check_unavailable', 'ask: ' + JSON.stringify(a));
        assert.strictEqual(a.lexicon_scope, 'session', 'ask scope: ' + JSON.stringify(a));
        const s = await brain.search(SPROUT3);
        assert.ok(s && s.error === 'egress_blocked' && s.egress_class === 'room_check_unavailable', 'search: ' + JSON.stringify(s));
        assert.strictEqual(s.lexicon_scope, 'session', 'search scope: ' + JSON.stringify(s));
        const q = await brain.query('MATCH (f:Framework) RETURN f.name LIMIT 5');
        assert.ok(q && q.error === 'egress_blocked' && q.egress_class === 'room_check_unavailable', 'query: ' + JSON.stringify(q));
        const belt = await brain.callTool('brain_ask', { question: GENERIC });
        assert.ok(belt && belt.error === 'egress_blocked' && belt.egress_class === 'room_check_unavailable', 'belt: ' + JSON.stringify(belt));
        assert.strictEqual(belt.lexicon_scope, 'session', 'belt scope: ' + JSON.stringify(belt));
        assert.strictEqual(capture.captured.length, 0, 'wire received ' + capture.captured.length);
      });
    });
    await checkAsync('L10e no session id: ask(room A word) refuses room_content with lexicon_scope machine_global; ask(room B word) reaches the wire', async function () {
      await withSession(undefined, async function () {
        capture.resetCaptured();
        const r = await brain.ask(WORD_A);
        assert.ok(r && r.error === 'egress_blocked' && r.egress_class === 'room_content', JSON.stringify(r));
        assert.strictEqual(r.lexicon_scope, 'machine_global', JSON.stringify(r));
        assert.strictEqual(capture.captured.length, 0, 'wire received ' + capture.captured.length);
        await brain.ask(WORD_B);
        assert.strictEqual(capture.captured.length, 1, 'wire received ' + capture.captured.length);
      });
    });
    if (IS_ROOT) {
      skip('L10f unreadable room via brain-client', 'chmod 000 does not stop root');
    } else {
      await checkAsync('L10f unreadable room: ask(generic) refuses room_check_unavailable, zero bytes', async function () {
        await withSession(SESSION_UNREADABLE, async function () {
          capture.resetCaptured();
          const r = await brain.ask(GENERIC);
          assert.ok(r && r.error === 'egress_blocked' && r.egress_class === 'room_check_unavailable', JSON.stringify(r));
          assert.strictEqual(capture.captured.length, 0, 'wire received ' + capture.captured.length);
        });
      });
    }

    // ---- L11: the probe line ----------------------------------------------------
    await checkAsync('L11 MINDRIAN_PART8_DEBUG: hook and brain-client print present or absent and the scope, never the id', async function () {
      const hp = runHook(GENERIC, SESSION_UNBOUND, { MINDRIAN_PART8_DEBUG: '1' });
      assert.ok(hp.stderr.indexOf('part8 session: present; lexicon_scope: session') !== -1, 'hook present line missing: ' + hp.stderr.slice(0, 200));
      const ha = runHook(GENERIC, undefined, { MINDRIAN_PART8_DEBUG: '1' });
      assert.ok(ha.stderr.indexOf('part8 session: absent; lexicon_scope: machine_global') !== -1, 'hook absent line missing: ' + ha.stderr.slice(0, 200));
      assert.ok(noIds(hp.stderr + ha.stderr), 'the probe line carries a session id');
      const quiet = runHook(GENERIC, SESSION_UNBOUND);
      assert.ok(quiet.stderr.indexOf('part8 session:') === -1, 'the probe line prints without the flag');
      // brain-client, in process: capture stderr.
      const seen = [];
      const origWrite = process.stderr.write;
      process.stderr.write = function (chunk) { seen.push(String(chunk)); return true; };
      process.env.MINDRIAN_PART8_DEBUG = '1';
      try {
        await withSession(SESSION_UNBOUND, async function () { await brain.ask(GENERIC); });
        await withSession(undefined, async function () { await brain.ask(GENERIC); });
      } finally {
        delete process.env.MINDRIAN_PART8_DEBUG;
        process.stderr.write = origWrite;
      }
      const text = seen.join('');
      assert.ok(text.indexOf('part8 session: present; lexicon_scope: session') !== -1, 'brain-client present line missing: ' + text.slice(0, 300));
      assert.ok(text.indexOf('part8 session: absent; lexicon_scope: machine_global') !== -1, 'brain-client absent line missing: ' + text.slice(0, 300));
      assert.ok(noIds(text), 'the brain-client probe line carries a session id');
    });
  } finally {
    await capture.stopCaptureServer(started.server);
  }

  // ---- L12: wall time -------------------------------------------------------
  check('L12 hook wall time on a generic question with the binding read stays under 2,000 ms', function () {
    runHook(GENERIC, SESSION_A); // warm the disk cache
    const times = [];
    for (let i = 0; i < 5; i++) times.push(runHook(GENERIC, SESSION_A).ms);
    const max = Math.max.apply(null, times);
    const mean = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
    console.log('    hook wall time (session bound, generic question): mean ' + mean.toFixed(0) + ' ms, max ' + max.toFixed(0) + ' ms over ' + times.length + ' runs');
    assert.ok(max < 2000, 'hook wall time max ' + max.toFixed(0) + ' ms (budget 2,000 ms)');
  });

  // Dash hygiene on this file.
  check('L0 no em dash or en dash in this file', function () {
    const src = fs.readFileSync(__filename, 'utf8');
    assert.ok(src.indexOf(String.fromCharCode(0x2014)) === -1 && src.indexOf(String.fromCharCode(0x2013)) === -1);
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
  if (!IS_ROOT) { try { fs.chmodSync(DB_C, DB_C_MODE); } catch (_e) { /* best effort */ } }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (e) {
  console.error('FATAL: ' + (e && e.stack ? e.stack : e));
  if (!IS_ROOT) { try { fs.chmodSync(DB_C, DB_C_MODE); } catch (_e) { /* best effort */ } }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(1);
});
