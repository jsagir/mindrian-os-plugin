#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261118-vbv (Task A): the Part 8 hook room telemetry is off the hot
 * path. The hook appends 1 queue line; a drain (Stop step, session start)
 * writes the row through part8-egress-ontology record() and navigation.cjs.
 *
 * Legs:
 *   Q1  hot path: a hook spawn adds 0 brain_egress_* rows and exactly 1 queue
 *       line; the exit code and the queued verdict equal in-process classify().
 *   Q2  module load: the hook process never loads part8-egress-ontology.cjs or
 *       navigation.cjs and never calls room-db.cjs openRoomDb (the lexicon read
 *       keeps its read-only door).
 *   Q3  the record lands: the drain with --stop and the Stop payload lands the
 *       queued count of rows (event type, lexicon_scope session); pendingCount
 *       0; no claim file left. A --room run lands the machine_global record of
 *       a no-session hook spawn in the active room. A --sweep run (no stdin)
 *       lands a registry room's queue.
 *   Q4  no silent loss: room.db not openable (chmod 000) gives open_failed and
 *       keeps every record; after the mode is restored a second drain lands
 *       each record exactly once. A room whose room.db is gone gives missing,
 *       keeps the records and mints no db.
 *   Q5  concurrency: a line enqueued after the claim stays in the queue and
 *       lands on the next drain. Malformed lines go to the rejected file and
 *       are counted.
 *   Q6  verdict independence: with the queue path not writable (a directory)
 *       the hook exit codes of the Q1 inputs are unchanged.
 *   Q7  hygiene: a queue line has only the 7 whitelisted keys and no question
 *       word.
 *   Q8  wiring: scripts/on-stop runs the drain with --stop before the
 *       MINDRIAN_MCP_FIRST branch, with "|| true" and no timeout binary; a real
 *       on-stop run drains the session room.
 *   Q9  session start: scripts/gsd-graph-derive-drain.cjs starts the drain
 *       detached with --sweep (no new hooks.json entry); a real run drains.
 *   Q10 the cap: the queue holds at most 5,000 lines and 2 MB; the oldest lines
 *       drop and the drain reports the dropped count; the hook exit code is
 *       unchanged at the cap; a budget stop keeps every line not yet done.
 *
 * Part 8: every string is invented (tests/helpers/synthetic-room-db.cjs
 * rooms). HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temporary folders. No
 * network. Prints "ok - Qn" or "FAIL - Qn"; exit 1 on a failure. No em dash
 * and no en dash.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(REPO_ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const DRAIN = path.join(REPO_ROOT, 'scripts', 'part8-egress-telemetry-drain.cjs');
const ON_STOP = path.join(REPO_ROOT, 'scripts', 'on-stop');
const DERIVE_DRAIN = path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-drain.cjs');
const QUEUE_MOD = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-telemetry-queue.cjs');
const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const SPINE_EVENTS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-vbv-queue-'));
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
delete process.env.MINDRIAN_MCP_FIRST;

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

const loader = require(path.join(REPO_ROOT, 'tests', 'helpers', 'audit-probe-loader.cjs'));
const rooms = loader.makeRooms(ROOMS, REPO_ROOT);
const SLUGS = { A: 'gate-lexgen', B: 'gate-claims', C: 'gate-noise', D: 'gate-empty', E: 'gate-scaffold' };
const ROOM = {};
Object.keys(SLUGS).forEach(function (k) { ROOM[k] = rooms.roomFor(SLUGS[k]); });

const SESSION = { A: 'sess-vbv-a-41c9', B: 'sess-vbv-b-8e27', C: 'sess-vbv-c-5d10', D: 'sess-vbv-d-a3f4' };
const WORD_A = 'quillfern labs pricing framework';
const GENERIC = 'what is jobs to be done';
const QUESTION_WORDS = ['quillfern', 'pricing', 'framework', 'jobs to be done'];
const TOOL_ASK = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const KEYS = ['v', 'at', 'verdict', 'class', 'matched_pattern', 'session_id', 'lexicon_scope'];

(function writeRegistry() {
  const reg = { active: SLUGS.A, rooms: {} };
  Object.keys(SLUGS).forEach(function (k) { reg.rooms[SLUGS[k]] = { path: SLUGS[k] }; });
  fs.writeFileSync(path.join(ROOMS, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2));
  ['A', 'B', 'C', 'D'].forEach(function (k) {
    fs.writeFileSync(path.join(ROOMS, '.rooms', 'sessions', SESSION[k] + '.json'), JSON.stringify({
      bound: [SLUGS[k]], primary: SLUGS[k], sticky: false, updated: new Date().toISOString(),
    }));
  });
}());

let failed = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failed += 1;
    console.log('FAIL - ' + name + ': ' + (err && err.message ? err.message : String(err)));
  }
}

function env(extra) {
  const e = Object.assign({}, process.env, { HOME: HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: ROOMS, PART8_FORCE_BRAIN_AVAILABLE: '1' }, extra || {});
  delete e.CLAUDE_ACTIVE_ROOM;
  delete e.CLAUDE_CODE_SESSION_ID;
  delete e.MINDRIAN_PART8_DEBUG;
  delete e.MINDRIAN_MCP_FIRST;
  return e;
}

function runHook(question, sessionId, nodeArgs) {
  const payload = { tool_name: TOOL_ASK, tool_input: { question: question } };
  if (typeof sessionId === 'string') payload.session_id = sessionId;
  const res = spawnSync(process.execPath, (nodeArgs || []).concat([HOOK]), {
    input: JSON.stringify(payload), encoding: 'utf8', env: env(), timeout: 20000,
  });
  return { code: res.status, stderr: res.stderr || '' };
}

function runDrain(args, input) {
  const res = spawnSync(process.execPath, [DRAIN].concat(args), {
    input: input === undefined ? '' : input, encoding: 'utf8', env: env(), timeout: 20000,
  });
  let json = null;
  try { json = JSON.parse((res.stdout || '').trim().split('\n').pop()); } catch (_e) { json = null; }
  return { code: res.status, stdout: res.stdout || '', json: json };
}

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

function mdir(roomDir) { return path.join(roomDir, '.mindrian'); }
function queueFile(roomDir) { return path.join(mdir(roomDir), 'part8-egress-telemetry.queue.jsonl'); }
function queueLines(roomDir) {
  try {
    return fs.readFileSync(queueFile(roomDir), 'utf8').split('\n').filter(function (l) { return l.length > 0; });
  } catch (_e) {
    return [];
  }
}
function claimFiles(roomDir) {
  try { return fs.readdirSync(mdir(roomDir)).filter(function (n) { return /\.claim$/.test(n); }); } catch (_e) { return []; }
}
function expectedExit(v) {
  // The hook exits 2 on a block. On this shim-backed tool name an ambiguous
  // verdict of these classes proceeds (SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES).
  if (v.verdict === 'block') return 2;
  return 0;
}
function queueMod() {
  if (!fs.existsSync(QUEUE_MOD)) throw new Error('lib/core/part8-egress-telemetry-queue.cjs is missing');
  return require(QUEUE_MOD);
}
function waitFor(cond, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    spawnSync(process.execPath, ['-e', 'setTimeout(function(){}, 100)']);
  }
  return cond();
}

const guard = require(GUARD_PATH);
const Q1_INPUTS = [GENERIC, WORD_A];
const q1Codes = [];
const q1Queued = [];

leg('Q1 hot path: 0 new rows and exactly 1 queue line for each hook spawn; exit code and verdict equal in-process classify()', function () {
  Q1_INPUTS.forEach(function (q) {
    const rowsBefore = egressRows(ROOM.A).length;
    const linesBefore = queueLines(ROOM.A).length;
    const h = runHook(q, SESSION.A);
    const v = guard.classify({ question: q }, { toolName: TOOL_ASK, roomDir: ROOM.A, roomStatus: 'bound', lexiconScope: 'session' });
    q1Codes.push(h.code);
    assert.strictEqual(h.code, expectedExit(v), 'hook exit ' + h.code + ' for verdict ' + v.verdict + '/' + v.class);
    assert.strictEqual(egressRows(ROOM.A).length, rowsBefore, 'the hook wrote a brain_egress_* row on the hot path');
    const lines = queueLines(ROOM.A);
    assert.strictEqual(lines.length, linesBefore + 1, 'queue lines ' + lines.length + ' (before ' + linesBefore + ')');
    const rec = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(rec.verdict, v.verdict, 'queued verdict ' + rec.verdict + ' vs ' + v.verdict);
    assert.strictEqual(rec.class, v.class, 'queued class ' + rec.class + ' vs ' + v.class);
    assert.strictEqual(rec.lexicon_scope, 'session');
    q1Queued.push(rec);
  });
  assert.deepStrictEqual(q1Codes, [0, 2], 'the two inputs: a plain question proceeds, a room word blocks');
});

leg('Q2 module load: the hook process never loads part8-egress-ontology.cjs or navigation.cjs and never calls openRoomDb', function () {
  const out = path.join(TMP, 'q2-cache.json');
  const opens = path.join(TMP, 'q2-opens.txt');
  const spy = path.join(TMP, 'q2-spy.cjs');
  fs.writeFileSync(spy, [
    "'use strict';",
    "const Module = require('node:module');",
    "const fs = require('node:fs');",
    "const orig = Module._load;",
    "Module._load = function (req) {",
    "  const m = orig.apply(this, arguments);",
    "  if (/room-db\\.cjs$/.test(req) && m && typeof m.openRoomDb === 'function' && !m.__vbvSpy) {",
    "    const o = m.openRoomDb;",
    "    m.openRoomDb = function () { fs.appendFileSync(" + JSON.stringify(opens) + ", 'open\\n'); return o.apply(this, arguments); };",
    "    m.__vbvSpy = true;",
    "  }",
    "  return m;",
    "};",
    "process.on('exit', function () { fs.writeFileSync(" + JSON.stringify(out) + ", JSON.stringify(Object.keys(require.cache))); });",
    '',
  ].join('\n'));
  [GENERIC, WORD_A].forEach(function (q) {
    try { fs.unlinkSync(opens); } catch (_e) { /* none */ }
    const h = runHook(q, SESSION.A, ['-r', spy]);
    assert.strictEqual(h.code, q === GENERIC ? 0 : 2, 'hook exit ' + h.code);
    const keys = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.ok(keys.some(function (k) { return /part8-egress-guard-hook\.cjs$/.test(k); }), 'the spy did not see the hook');
    ['part8-egress-ontology.cjs', 'navigation.cjs'].forEach(function (m) {
      assert.ok(!keys.some(function (k) { return k.endsWith(path.sep + m); }), m + ' is in the hook require.cache');
    });
    assert.ok(keys.some(function (k) { return /part8-egress-telemetry-queue\.cjs$/.test(k); }), 'the queue module was not loaded (no enqueue ran)');
    assert.strictEqual(fs.existsSync(opens) ? fs.readFileSync(opens, 'utf8').split('\n').filter(Boolean).length : 0, 0, 'the hook called openRoomDb');
  });
});

leg('Q3 the record lands: --stop lands the session queue, --room lands a machine_global record, --sweep lands a registry room', function () {
  const q = queueMod();
  const pending = q.pendingCount(ROOM.A);
  assert.ok(pending >= 2, 'room A pending ' + pending);
  const lines = queueLines(ROOM.A).map(function (l) { return JSON.parse(l); });
  const before = egressRows(ROOM.A).length;
  const d = runDrain(['--stop', '--json'], JSON.stringify({ session_id: SESSION.A, hook_event_name: 'Stop' }));
  assert.strictEqual(d.code, 0, 'drain exit ' + d.code);
  assert.ok(d.json && Array.isArray(d.json.results), 'no --json results: ' + d.stdout.slice(0, 200));
  const rows = egressRows(ROOM.A);
  const fresh = rows.slice(before);
  assert.strictEqual(fresh.length, lines.length, 'landed ' + fresh.length + ' of ' + lines.length);
  const want = { allow: 'brain_egress_allowed', block: 'brain_egress_blocked', ambiguous: 'brain_egress_ambiguous' };
  lines.forEach(function (rec, i) {
    assert.strictEqual(fresh[i].event_type, want[rec.verdict], 'row ' + i + ' event_type ' + fresh[i].event_type);
    assert.strictEqual(fresh[i].lexicon_scope, 'session', 'row ' + i + ' scope ' + fresh[i].lexicon_scope);
  });
  assert.strictEqual(q.pendingCount(ROOM.A), 0, 'room A still pending');
  assert.deepStrictEqual(claimFiles(ROOM.A), [], 'a claim file is left');

  // A no-session hook spawn: the machine-global active room (room A).
  const h = runHook(GENERIC);
  assert.strictEqual(h.code, 0);
  assert.strictEqual(q.pendingCount(ROOM.A), 1, 'the no-session spawn did not queue 1 line');
  const b2 = egressRows(ROOM.A).length;
  const r = runDrain(['--room', ROOM.A]);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.stdout, '', 'stdout without --json');
  const g = egressRows(ROOM.A).slice(b2);
  assert.strictEqual(g.length, 1, 'machine_global rows ' + g.length);
  assert.strictEqual(g[0].lexicon_scope, 'machine_global');

  // --sweep: no stdin, room B (not the active room) is found through the registry.
  const hb = runHook(GENERIC, SESSION.B);
  assert.strictEqual(hb.code, 0);
  assert.strictEqual(q.pendingCount(ROOM.B), 1);
  const b3 = egressRows(ROOM.B).length;
  const s = runDrain(['--sweep']);
  assert.strictEqual(s.code, 0);
  assert.strictEqual(egressRows(ROOM.B).length, b3 + 1, 'the sweep did not land room B');
  assert.strictEqual(q.pendingCount(ROOM.B), 0);
});

leg('Q4 no silent loss: open_failed and missing keep every record; a second drain lands each exactly once; no db is minted', function () {
  const q = queueMod();
  const info = { verdict: 'allow', class: 'generic_question', matched_pattern: 'x', sessionId: SESSION.C, lexicon_scope: 'session' };
  for (let i = 0; i < 3; i += 1) assert.strictEqual(q.enqueue(ROOM.C, info), true, 'enqueue ' + i);
  const before = egressRows(ROOM.C).length;
  const dbFile = path.join(mdir(ROOM.C), 'room.db');
  if (IS_ROOT) {
    console.log('SKIP - Q4 chmod leg: running as root');
  } else {
    const mode = fs.statSync(dbFile).mode & 0o777;
    fs.chmodSync(dbFile, 0);
    let r;
    try { r = q.drainRoom(ROOM.C); } finally { fs.chmodSync(dbFile, mode); }
    assert.strictEqual(r.room_db, 'open_failed', JSON.stringify(r));
    assert.strictEqual(r.kept, 3, JSON.stringify(r));
    assert.strictEqual(r.landed, 0, JSON.stringify(r));
    assert.strictEqual(egressRows(ROOM.C).length, before, 'rows changed on a failed drain');
    assert.strictEqual(q.pendingCount(ROOM.C), 3, 'pending after open_failed');
  }
  const r2 = q.drainRoom(ROOM.C);
  assert.strictEqual(r2.room_db, 'ok', JSON.stringify(r2));
  assert.strictEqual(r2.landed, 3, JSON.stringify(r2));
  assert.strictEqual(egressRows(ROOM.C).length, before + 3, 'not exactly once');
  const r3 = q.drainRoom(ROOM.C);
  assert.strictEqual(r3.landed, 0, 'a third drain landed again: ' + JSON.stringify(r3));
  assert.strictEqual(egressRows(ROOM.C).length, before + 3);

  // A room whose room.db is gone.
  const dbE = path.join(mdir(ROOM.E), 'room.db');
  assert.strictEqual(q.enqueue(ROOM.E, info), true);
  assert.strictEqual(q.enqueue(ROOM.E, info), true);
  const away = dbE + '.away';
  fs.renameSync(dbE, away);
  let m;
  try {
    assert.strictEqual(q.enqueue(ROOM.E, info), false, 'enqueue wrote with no room.db');
    m = q.drainRoom(ROOM.E);
    assert.strictEqual(fs.existsSync(dbE), false, 'the drain minted a room.db');
  } finally { fs.renameSync(away, dbE); }
  assert.strictEqual(m.room_db, 'missing', JSON.stringify(m));
  assert.strictEqual(m.kept, 2, JSON.stringify(m));
  const beforeE = egressRows(ROOM.E).length;
  const m2 = q.drainRoom(ROOM.E);
  assert.strictEqual(m2.landed, 2, JSON.stringify(m2));
  assert.strictEqual(egressRows(ROOM.E).length, beforeE + 2);
});

leg('Q5 concurrency and malformed lines: a line queued after the claim waits for the next drain; malformed lines are rejected and counted', function () {
  const q = queueMod();
  const a = { verdict: 'allow', class: 'generic_question', matched_pattern: 'a', sessionId: SESSION.D, lexicon_scope: 'session' };
  const b = { verdict: 'block', class: 'room_content', matched_pattern: 'b', sessionId: SESSION.D, lexicon_scope: 'session' };
  const before = egressRows(ROOM.D).length;
  assert.strictEqual(q.enqueue(ROOM.D, a), true);
  const r = q.drainRoom(ROOM.D, { onClaimed: function () { q.enqueue(ROOM.D, b); } });
  assert.strictEqual(r.landed, 1, JSON.stringify(r));
  const rows1 = egressRows(ROOM.D).slice(before);
  assert.strictEqual(rows1.length, 1);
  assert.strictEqual(rows1[0].event_type, 'brain_egress_allowed');
  assert.strictEqual(q.pendingCount(ROOM.D), 1, 'B is not in the queue');
  const r2 = q.drainRoom(ROOM.D);
  assert.strictEqual(r2.landed, 1, JSON.stringify(r2));
  const rows2 = egressRows(ROOM.D).slice(before);
  assert.strictEqual(rows2.length, 2);
  assert.strictEqual(rows2[1].event_type, 'brain_egress_blocked');

  fs.appendFileSync(queueFile(ROOM.D), 'not json at all\n{"v":1,"verdict":"maybe"}\n');
  assert.strictEqual(q.enqueue(ROOM.D, a), true);
  const r3 = q.drainRoom(ROOM.D);
  assert.strictEqual(r3.rejected, 2, JSON.stringify(r3));
  assert.strictEqual(r3.landed, 1, JSON.stringify(r3));
  const rej = fs.readFileSync(path.join(mdir(ROOM.D), 'part8-egress-telemetry.rejected.jsonl'), 'utf8').split('\n').filter(Boolean);
  assert.strictEqual(rej.length, 2, 'rejected file lines ' + rej.length);
  assert.strictEqual(q.pendingCount(ROOM.D), 0);
});

leg('Q7 hygiene: a queue line has only the 7 whitelisted keys and no question word', function () {
  assert.ok(q1Queued.length === 2, 'Q1 queued nothing');
  q1Queued.forEach(function (rec) {
    Object.keys(rec).forEach(function (k) { assert.ok(KEYS.indexOf(k) !== -1, 'extra key ' + k); });
    const text = JSON.stringify(rec).toLowerCase();
    QUESTION_WORDS.forEach(function (w) { assert.ok(text.indexOf(w) === -1, 'a queue line carries the question word ' + w); });
  });
});

leg('Q8 wiring: on-stop runs the drain with --stop before the MINDRIAN_MCP_FIRST branch, || true, no timeout binary; a real on-stop run drains', function () {
  const src = fs.readFileSync(ON_STOP, 'utf8').split('\n');
  const di = src.findIndex(function (l) { return l.indexOf('part8-egress-telemetry-drain.cjs" --stop') !== -1 && !/^\s*#/.test(l); });
  const mi = src.findIndex(function (l) { return l.indexOf('if [ -n "${MINDRIAN_MCP_FIRST:-}" ]') === 0; });
  const si = src.findIndex(function (l) { return l.indexOf('HOOK_STDIN="$(cat') === 0; });
  assert.ok(di > si && si !== -1, 'the drain line is not after the HOOK_STDIN capture (' + si + ', ' + di + ')');
  assert.ok(mi !== -1 && di < mi, 'the drain line is not before the MINDRIAN_MCP_FIRST branch (' + di + ', ' + mi + ')');
  assert.ok(/\|\| true\s*$/.test(src[di]), 'no || true: ' + src[di]);
  assert.ok(!/\btimeout\s+\d/.test(src[di]), 'the timeout binary is used: ' + src[di]);
  assert.ok(src.slice(0, di).every(function (l) { return !/^\s*exit\b/.test(l); }), 'an exit runs before the drain line');

  const q = queueMod();
  const h = runHook(GENERIC, SESSION.B);
  assert.strictEqual(h.code, 0);
  assert.strictEqual(q.pendingCount(ROOM.B), 1);
  const before = egressRows(ROOM.B).length;
  const cwd = fs.mkdtempSync(path.join(TMP, 'stop-cwd-'));
  const res = spawnSync('bash', [ON_STOP], {
    input: JSON.stringify({ session_id: SESSION.B, hook_event_name: 'Stop' }), encoding: 'utf8', cwd: cwd,
    env: env({ MINDRIAN_DERIVE_SKIP: '1' }), timeout: 60000,
  });
  assert.ok(res.status !== null, 'on-stop did not end: ' + String(res.error || ''));
  assert.strictEqual(egressRows(ROOM.B).length, before + 1, 'on-stop did not drain room B (exit ' + res.status + ')');
  assert.strictEqual(q.pendingCount(ROOM.B), 0);
});

leg('Q9 session start: gsd-graph-derive-drain.cjs starts the drain detached with --sweep; a real run drains; hooks.json is unchanged', function () {
  const src = fs.readFileSync(DERIVE_DRAIN, 'utf8');
  assert.ok(/part8-egress-telemetry-drain\.cjs/.test(src) && /'--sweep'/.test(src), 'no --sweep spawn in gsd-graph-derive-drain.cjs');
  const hooks = fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8');
  assert.ok(hooks.indexOf('part8-egress-telemetry-drain') === -1, 'hooks.json names the drain (no new entry allowed)');
  const q = queueMod();
  const h = runHook(GENERIC, SESSION.B);
  assert.strictEqual(h.code, 0);
  assert.strictEqual(q.pendingCount(ROOM.B), 1);
  const before = egressRows(ROOM.B).length;
  const res = spawnSync(process.execPath, [DERIVE_DRAIN], {
    input: '{}', encoding: 'utf8', cwd: TMP, env: env({ MOS_NO_DETACHED_DERIVE: '1' }), timeout: 30000,
  });
  assert.strictEqual(res.status, 0, 'derive drain exit ' + res.status);
  assert.ok(waitFor(function () { return q.pendingCount(ROOM.B) === 0; }, 8000), 'the session-start sweep did not drain room B');
  assert.ok(waitFor(function () { return egressRows(ROOM.B).length === before + 1; }, 3000), 'room B rows ' + egressRows(ROOM.B).length + ' (before ' + before + ')');
});

leg('Q10 the cap: at most 5,000 lines and 2 MB; the oldest lines drop and are counted; the hook exit is unchanged; a budget stop keeps the rest', function () {
  const q = queueMod();
  const qf = queueFile(ROOM.D);
  const mk = function (i, pad) {
    return JSON.stringify({ v: 1, at: new Date().toISOString(), verdict: 'allow', class: 'generic_question', matched_pattern: pad || ('n' + i), session_id: SESSION.D, lexicon_scope: 'session' });
  };
  const fill = [];
  for (let i = 0; i < 5000; i += 1) fill.push(mk(i));
  fs.writeFileSync(qf, fill.join('\n') + '\n');
  const dropped0 = q.droppedCount(ROOM.D);
  assert.strictEqual(q.enqueue(ROOM.D, { verdict: 'block', class: 'room_content', matched_pattern: 'newest', sessionId: SESSION.D, lexicon_scope: 'session' }), true);
  let lines = queueLines(ROOM.D);
  assert.strictEqual(lines.length, 5000, 'line cap: ' + lines.length);
  assert.strictEqual(JSON.parse(lines[0]).matched_pattern, 'n1', 'the oldest line did not drop');
  assert.strictEqual(JSON.parse(lines[4999]).matched_pattern, 'newest', 'the new line is not last');
  assert.strictEqual(q.droppedCount(ROOM.D), dropped0 + 1, 'dropped counter');

  // The hook at the cap: same exit code as classify(); still 5,000 lines.
  const h = runHook(GENERIC, SESSION.D);
  const v = guard.classify({ question: GENERIC }, { toolName: TOOL_ASK, roomDir: ROOM.D, roomStatus: 'bound', lexiconScope: 'session' });
  assert.strictEqual(h.code, expectedExit(v), 'hook exit at the cap ' + h.code);
  assert.strictEqual(queueLines(ROOM.D).length, 5000, 'the hook broke the line cap');
  assert.strictEqual(q.droppedCount(ROOM.D), dropped0 + 2, 'the hook drop was not counted');

  // The byte cap: 3,100 lines of about 700 bytes (more than 2 MB).
  const pad = 'p'.repeat(200);
  const big = [];
  for (let i = 0; i < 3100; i += 1) big.push(mk(i, pad) + ' '.repeat(480));
  fs.writeFileSync(qf, big.join('\n') + '\n');
  assert.ok(fs.statSync(qf).size > q.MAX_QUEUE_BYTES, 'the fixture is not over 2 MB');
  assert.strictEqual(q.enqueue(ROOM.D, { verdict: 'allow', class: 'generic_question', matched_pattern: 'tail', sessionId: SESSION.D, lexicon_scope: 'session' }), true);
  assert.ok(fs.statSync(qf).size <= q.MAX_QUEUE_BYTES, 'byte cap: ' + fs.statSync(qf).size);
  lines = queueLines(ROOM.D);
  assert.strictEqual(JSON.parse(lines[lines.length - 1]).matched_pattern, 'tail');

  // The drain reports the dropped count; a budget stop keeps every line not done.
  const total = q.pendingCount(ROOM.D);
  const r = q.drainRoom(ROOM.D, { budgetMs: 30 });
  assert.ok(r.dropped >= dropped0 + 2, 'drain dropped field: ' + JSON.stringify(r));
  assert.strictEqual(r.claimed, total, JSON.stringify(r));
  assert.ok(r.kept > 0, 'the budget did not stop the drain: ' + JSON.stringify(r));
  assert.strictEqual(r.landed + r.rejected + r.kept, r.claimed, 'a line was lost: ' + JSON.stringify(r));
  assert.strictEqual(q.pendingCount(ROOM.D), r.kept, 'pending after a budget stop');
  // Clean the large queue so later legs stay fast.
  claimFiles(ROOM.D).forEach(function (n) { fs.unlinkSync(path.join(mdir(ROOM.D), n)); });
  try { fs.unlinkSync(qf); } catch (_e) { /* none */ }
});

leg('Q6 verdict independence: with the queue path not writable the Q1 exit codes are unchanged', function () {
  const qf = queueFile(ROOM.A);
  try { fs.unlinkSync(qf); } catch (_e) { /* none */ }
  fs.mkdirSync(qf);
  try {
    const codes = Q1_INPUTS.map(function (qq) { return runHook(qq, SESSION.A).code; });
    assert.deepStrictEqual(codes, q1Codes, 'exit codes ' + JSON.stringify(codes) + ' vs ' + JSON.stringify(q1Codes));
  } finally {
    fs.rmSync(qf, { recursive: true, force: true });
  }
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
console.log(failed === 0 ? 'test-261118-vbv-hook-telemetry-queue: all legs ok' : 'test-261118-vbv-hook-telemetry-queue: ' + failed + ' leg(s) failed');
process.exit(failed === 0 ? 0 : 1);
