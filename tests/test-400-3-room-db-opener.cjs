#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 06b: the room.db write door opens a ready room without the SQLite write lock, and the write
 * users keep their typed busy error.
 *
 * Owner rulings covered: OR-3 (openRoomDb busyMs of Phase 400.4 plan 10 is reused, not rebuilt), D-10, D-11, and
 * Phase 369 Pitfall 6 (the change feed is still checked and repaired on every write-door open).
 *
 * Canon Part 8: fixture rooms only under one mkdtemp root; HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point inside
 * it; no network.
 *
 * Do not put a table-creation SQL statement in this file: the Phase 108 schema-drift pre-commit guard refuses
 * one in a staged test file. Fixtures use openRoomDb, lazygraph openGraph and raw DROP, DELETE or PRAGMA only.
 *
 * Native Windows is UNMEASURED.
 *
 * Groups: door (O1-O9), consumers (T1-T3), hookcap (K1, owner answer OA-3), probe (P1-P3, wave 2 Goldfish W2-CD-04:
 * openRoomDbForCaller {probeWrite} delegates to openRoomDb {writeProbe: true}; spine-events keeps no own probe).
 * Usage: node tests/test-400-3-room-db-opener.cjs [door|consumers|hookcap|probe|all]   (default all)
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { fork, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DB_LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');
const HOLDER_MODE = 'BEGIN IMMEDIATE + write';

const GROUP = process.argv[2] || 'all';
if (['door', 'consumers', 'hookcap', 'probe', 'all'].indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-room-db-opener.cjs [door|consumers|hookcap|probe|all]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
function skip(label, why) { console.log('SKIP: ' + label + ' (' + why + ')'); }

// One mkdtemp root; HOME, USERPROFILE and MINDRIAN_ROOMS_HOME inside it, set before any lib module loads.
const TOP = fs.mkdtempSync(path.join(os.tmpdir(), '4003-06b-'));
process.on('exit', () => { try { fs.rmSync(TOP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
const HOME = path.join(TOP, 'home');
fs.mkdirSync(HOME, { recursive: true });
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(HOME, 'MindrianRooms');
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_ROOM_DIR;
const ROOMS_HOME = process.env.MINDRIAN_ROOMS_HOME;

const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const { openRoomDb, closeRoomDb, RoomDbBusyError } = roomDbMod;

function msNow() { return Number(process.hrtime.bigint()) / 1e6; }
let seq = 0;
function newRoom(label) {
  seq += 1;
  const room = path.join(ROOMS_HOME, label + '-' + seq);
  fs.mkdirSync(path.join(room, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), '');
  return room;
}
function dbPathOf(room) { return path.join(room, '.mindrian', 'room.db'); }
// A room opened and closed once through the write door (migrated and, after this plan, stamped).
function readyRoom(label) {
  const room = newRoom(label);
  closeRoomDb(openRoomDb(room));
  return room;
}
function withRaw(room, fn, readOnly) {
  const raw = new DatabaseSync(dbPathOf(room), readOnly ? { readOnly: true } : { timeout: 0 });
  try { return fn(raw); } finally { raw.close(); }
}
function userVersion(room) { return withRaw(room, (raw) => raw.prepare('PRAGMA user_version').get().user_version, true); }
function identityValue(room, key) {
  return withRaw(room, (raw) => { const r = raw.prepare('SELECT value FROM identity WHERE key = ?').get(key); return r ? r.value : null; }, true);
}
function names(room, type) {
  return withRaw(room, (raw) => raw.prepare('SELECT name FROM sqlite_master WHERE type = ?').all(type).map((r) => r.name), true);
}
function countOf(room, table) { return withRaw(room, (raw) => raw.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n, true); }
function roomDbFdCount() {
  let n = 0;
  for (const fd of fs.readdirSync('/proc/self/fd')) {
    try { if (fs.readlinkSync('/proc/self/fd/' + fd).endsWith('room.db')) n += 1; } catch (_e) { /* closed in between */ }
  }
  return n;
}
function stampFn() { return typeof roomDbMod._schemaStamp === 'function' ? roomDbMod._schemaStamp : null; }

function startHolder(room, holdMs, mode) {
  return new Promise((resolve, reject) => {
    const args = [room];
    if (holdMs) { args.push(String(holdMs)); args.push(mode || 'rollback'); }
    const child = fork(DB_LOCK_HOLDER, args, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.on('error', () => { /* the holder is gone */ });
    let settled = false;
    child.on('message', (msg) => {
      if (settled || !msg || !msg.ready) return;
      settled = true;
      if (msg.mode !== HOLDER_MODE) {
        try { child.kill(); } catch (_e) { /* gone */ }
        reject(new Error('holder mode is ' + JSON.stringify(msg.mode) + ', not ' + JSON.stringify(HOLDER_MODE)));
        return;
      }
      resolve({ child });
    });
    child.on('exit', (code) => { if (!settled) { settled = true; reject(new Error('room-db-lock-holder-236 exited ' + code + ' before ready')); } });
  });
}
function stopHolder(h) {
  return new Promise((resolve) => {
    if (!h || !h.child || h.child.exitCode !== null || h.child.signalCode !== null) return resolve();
    h.child.once('exit', () => resolve());
    try { h.child.send('release', (err) => { if (err) { try { h.child.kill(); } catch (_e) { /* gone */ } } }); }
    catch (_e) { try { h.child.kill(); } catch (_e2) { resolve(); } }
  });
}
function timedSync(fn) {
  const t0 = msNow();
  let result;
  let err = null;
  try { result = fn(); } catch (e) { err = e; }
  return { result, err, ms: msNow() - t0 };
}
function errInfo(e) { return e ? JSON.stringify({ name: e.name, message: e.message, code: e.code, errcode: e.errcode }) : 'no error'; }

// The stamp of room-db.cjs, recomputed from the files: the source text of room-db.cjs, then of each chain module
// in the order of the requires of room-db.cjs (lazygraph-ops, memory-ops, the phase-109 session-focus, 160, 222
// and 224 migrations, navigation/room-change-log, then the phase-109 nodes-provenance migration).
function expectedStamp() {
  const core = path.join(ROOT, 'lib', 'core');
  const files = [
    'room-db.cjs', 'lazygraph-ops.cjs', 'memory-ops.cjs',
    'migrations/phase-109-session-focus.cjs', 'migrations/phase-160-nodes-bitemporal.cjs',
    'migrations/phase-222-ranker-weights.cjs', 'migrations/phase-224-edge-review-status.cjs',
    'navigation/room-change-log.cjs', 'migrations/phase-109-nodes-provenance.cjs',
  ];
  const text = files.filter((f) => fs.existsSync(path.join(core, f))).map((f) => fs.readFileSync(path.join(core, f), 'utf8')).join('');
  const n = parseInt(crypto.createHash('sha256').update(text).digest('hex').slice(0, 7), 16);
  return n === 0 ? 1 : n;
}

// ---------------------------------------------------------------------------
// Group door (O1-O9)
// ---------------------------------------------------------------------------
async function groupDoor() {
  console.log('\n-- group door --');

  // O1
  {
    const room = readyRoom('o1');
    let h = null;
    try {
      h = await startHolder(room);
      const r = timedSync(() => openRoomDb(room, { busyMs: 750 }));
      let selectOk = false;
      if (r.result) {
        try { r.result.prepare('SELECT COUNT(*) AS n FROM nodes').get(); selectOk = true; } catch (_e) { selectOk = false; }
        closeRoomDb(r.result);
      }
      check('O1 a ready room under a held foreign write opens in less than 300 ms and reads nodes (measured ' + r.ms.toFixed(0) + ' ms)',
        !r.err && !!r.result && r.ms < 300 && selectOk, errInfo(r.err));
    } catch (e) { check('O1 fixture', false, e.message); }
    await stopHolder(h);
  }

  const stamp = stampFn();

  // O2
  {
    const room = readyRoom('o2');
    const v1 = userVersion(room);
    closeRoomDb(openRoomDb(room));
    const v2 = userVersion(room);
    check('O2 the first open stamps user_version with _schemaStamp(); a second open leaves it unchanged',
      !!stamp && v1 > 0 && v1 === stamp() && v2 === v1, JSON.stringify({ v1, v2, stamp: stamp ? stamp() : null }));
  }

  // O3
  {
    const room = readyRoom('o3');
    const KEY = 'phase_109_session_focus_v1';
    withRaw(room, (raw) => raw.prepare('DELETE FROM identity WHERE key = ?').run(KEY));
    closeRoomDb(openRoomDb(room));
    const skipped = identityValue(room, KEY) === null;
    withRaw(room, (raw) => raw.exec('PRAGMA user_version = 0'));
    closeRoomDb(openRoomDb(room));
    const restored = identityValue(room, KEY) !== null;
    const v = userVersion(room);
    check('O3 a stamped room skips the chain (a deleted sentinel stays deleted); user_version 0 re-runs it and restamps',
      skipped && restored && !!stamp && v === stamp(), JSON.stringify({ skipped, restored, v }));
  }

  // O4
  {
    const room = readyRoom('o4');
    const epochBefore = identityValue(room, 'change_log_epoch');
    withRaw(room, (raw) => raw.exec('DROP TRIGGER rcl_nodes_ai'));
    closeRoomDb(openRoomDb(room));
    const triggerBack = names(room, 'trigger').indexOf('rcl_nodes_ai') !== -1;
    const epochAfter = identityValue(room, 'change_log_epoch');
    check('O4 Pitfall 6: a dropped trigger is re-created and change_log_epoch is re-minted',
      triggerBack && typeof epochBefore === 'string' && epochAfter !== epochBefore, JSON.stringify({ triggerBack, epochBefore, epochAfter }));
  }

  // O5
  {
    const room = readyRoom('o5');
    withRaw(room, (raw) => raw.exec('DROP TABLE room_tx_context'));
    closeRoomDb(openRoomDb(room));
    const back = names(room, 'table').indexOf('room_tx_context') !== -1;
    const row = back ? withRaw(room, (raw) => raw.prepare('SELECT id FROM room_tx_context WHERE id = 1').get(), true) : null;
    check('O5 a dropped room_tx_context is re-created with its id 1 row', back && !!row, JSON.stringify({ back, row }));
  }

  // O6
  {
    const room = newRoom('o6');
    const lazygraph = require(path.join(ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
    const g = await lazygraph.openGraph(room);
    await lazygraph.closeGraph(g.db);
    const v0 = userVersion(room);
    closeRoomDb(openRoomDb(room));
    const hasIdentity = names(room, 'table').indexOf('identity') !== -1;
    const v1 = userVersion(room);
    check('O6 a graph-only room.db (user_version 0) gets the identity table and the stamp',
      v0 === 0 && hasIdentity && !!stamp && v1 === stamp(), JSON.stringify({ v0, hasIdentity, v1 }));
  }

  // O7
  {
    const room = readyRoom('o7');
    withRaw(room, (raw) => raw.exec('PRAGMA user_version = 0'));
    let h = null;
    try {
      h = await startHolder(room);
      const r = timedSync(() => openRoomDb(room, { busyMs: 750 }));
      if (r.result) closeRoomDb(r.result);
      const v = userVersion(room);
      check('O7 an unstamped migrated room under a held foreign write opens in less than 300 ms and stays unstamped (measured ' + r.ms.toFixed(0) + ' ms)',
        !r.err && !!r.result && r.ms < 300 && v === 0, errInfo(r.err) + ' v=' + v);
    } catch (e) { check('O7 fixture', false, e.message); }
    await stopHolder(h);
  }

  // O8
  {
    const probe = spawnSync(process.execPath, ['-e',
      "const r=require(process.argv[1]);const t=process.hrtime.bigint();const s=typeof r._schemaStamp==='function'?r._schemaStamp():null;"
      + "console.log(JSON.stringify({s:s,ms:Number(process.hrtime.bigint()-t)/1e6}))", path.join(ROOT, 'lib', 'core', 'room-db.cjs')],
    { encoding: 'utf8', env: process.env });
    let out = null;
    try { out = JSON.parse(String(probe.stdout).trim().split('\n').pop()); } catch (_e) { out = null; }
    const want = expectedStamp();
    check('O8 _schemaStamp() is the 7-hex sha256 prefix of the chain source text (first-process stamp cost ' + (out ? out.ms.toFixed(2) : '?') + ' ms)',
      !!stamp && stamp() === want && !!out && out.s === want, JSON.stringify({ got: stamp ? stamp() : null, want, child: out }));
  }

  // O9
  {
    const room = readyRoom('o9');
    let h = null;
    try {
      h = await startHolder(room);
      const linux = process.platform === 'linux' && fs.existsSync('/proc/self/fd');
      const fdBefore = linux ? roomDbFdCount() : 0;
      const r = timedSync(() => openRoomDb(room, { busyMs: 750, writeProbe: true }));
      if (r.result) closeRoomDb(r.result);
      const fdAfter = linux ? roomDbFdCount() : 0;
      check('O9 writeProbe under a held foreign write throws RoomDbBusyError after 600 ms or more and closes its handle (measured ' + r.ms.toFixed(0) + ' ms)',
        r.err instanceof RoomDbBusyError && r.ms >= 600 && fdAfter === fdBefore, errInfo(r.err) + ' fd ' + fdBefore + '->' + fdAfter);
    } catch (e) { check('O9 fixture', false, e.message); }
    await stopHolder(h);
    const r2 = timedSync(() => openRoomDb(room, { busyMs: 750, writeProbe: true }));
    let writeOk = false;
    let inTx = null;
    if (r2.result) {
      inTx = r2.result.isTransaction;
      try {
        r2.result.prepare('INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)').run('t_4003_06b_o9', '1', new Date().toISOString());
        writeOk = true;
      } catch (_e) { writeOk = false; }
      closeRoomDb(r2.result);
    }
    check('O9 writeProbe with no holder returns a handle with no open transaction, and a write through it succeeds',
      !r2.err && !!r2.result && inTx === false && writeOk, errInfo(r2.err) + ' inTx=' + inTx);
  }
}

// ---------------------------------------------------------------------------
// Group consumers (T1-T3)
// ---------------------------------------------------------------------------
async function groupConsumers() {
  console.log('\n-- group consumers --');
  // A ready room: the real room birth of tests/helpers/isolated-home-36925.cjs (identity, sentinel and registry
  // entry inside this test's HOME), then one write-door open, so the room is stamped.
  const H = require(path.join(__dirname, 'helpers', 'isolated-home-36925.cjs'));
  function readyIdentityRoom(label) {
    seq += 1;
    const b = H.birthFixtureRoom({ iso: { home: HOME, roomsHome: ROOMS_HOME }, slug: 'r4003-' + label + '-' + seq });
    const room = b.roomDir;
    closeRoomDb(openRoomDb(room));
    return room;
  }

  // T1
  {
    const room = readyIdentityRoom('t1');
    const { runDerivation } = require(path.join(ROOT, 'lib', 'core', 'graph-derivation.cjs'));
    const before = countOf(room, 'nodes');
    let h = null;
    try {
      h = await startHolder(room);
      let err = null;
      let res = null;
      try {
        res = runDerivation({
          roomDir: room,
          deriveFn: () => [{ edge_type: 'INFORMS', source: 'sec/a', target: 'sec/b', reason: 'stub' }],
          artifactPairs: [],
        });
        if (res && typeof res.then === 'function') res = await res;
      } catch (e) { err = e; }
      await stopHolder(h);
      h = null;
      const after = countOf(room, 'nodes');
      check('T1 runDerivation on a ready room under a held foreign write throws RoomDbBusyError and writes no node',
        err instanceof RoomDbBusyError && after === before, errInfo(err) + ' nodes ' + before + '->' + after + ' res=' + JSON.stringify(res && res.trace));
    } catch (e) { check('T1 fixture', false, e.message); }
    await stopHolder(h);
  }

  // T2
  {
    const room = readyIdentityRoom('t2');
    const { runGraphRefine } = require(path.join(ROOT, 'lib', 'core', 'graph-refine-loop.cjs'));
    const beforeN = countOf(room, 'nodes');
    const beforeE = countOf(room, 'edges');
    let h = null;
    try {
      h = await startHolder(room);
      let err = null;
      let res = null;
      try {
        res = runGraphRefine(room, {
          focusNodeId: 'refine-focus-4003',
          proposeFn: () => [{ from: 'refine-focus-4003', to: 'other-4003', type: 'INFORMS', reason: 'stub' }],
          getNeighborhoodFn: () => [],
          factCheckFn: () => ({ verified: true, reason: 'stub' }),
          dryRun: false,
          approve: true,
        });
      } catch (e) { err = e; }
      await stopHolder(h);
      h = null;
      const afterN = countOf(room, 'nodes');
      const afterE = countOf(room, 'edges');
      check('T2 runGraphRefine on a ready room under a held foreign write throws RoomDbBusyError and writes no node or edge',
        err instanceof RoomDbBusyError && afterN === beforeN && afterE === beforeE,
        errInfo(err) + ' nodes ' + beforeN + '->' + afterN + ' edges ' + beforeE + '->' + afterE + ' res=' + JSON.stringify(res));
    } catch (e) { check('T2 fixture', false, e.message); }
    await stopHolder(h);
  }

  // T3
  {
    const room = readyIdentityRoom('t3');
    const readiness = require(path.join(ROOT, 'lib', 'core', 'room-readiness.cjs'));
    let h = null;
    try {
      h = await startHolder(room);
      let r = null;
      let err = null;
      try { r = readiness.readinessFor(room, 'governed_write', { roomsHome: ROOMS_HOME }); } catch (e) { err = e; }
      await stopHolder(h);
      h = null;
      const ok = !!r && ((r.state === 'ready' && r.reason === null) || (r.reason === 'room_db_unreadable' && r.cause === 'busy'));
      const badCause = !!r && ['not_a_database', 'cannot_open', 'io', 'other'].indexOf(r.cause) !== -1;
      check('T3 readinessFor governed_write under a held foreign write is ready or room_db_unreadable with cause busy, never a broken cause',
        !err && ok && !badCause, errInfo(err) + ' ' + JSON.stringify(r));
    } catch (e) { check('T3 fixture', false, e.message); }
    await stopHolder(h);
  }
}

// ---------------------------------------------------------------------------
// Group hookcap (K1, owner answer OA-3, 2026-11-27)
// ---------------------------------------------------------------------------
// A hook process (hook-busy-cap set to HOOK_BUSY_MS) opens a ready room through openRoomDbForCaller while another
// process holds a write, then makes N memory-event writes through the one handle. The first busy write waits the
// cap once and trips it; every later write fails at once.
const HOOK_WRITES = 4;
function hookWriterCode() {
  return [
    "const path = require('node:path');",
    'const ROOT = process.argv[1];',
    "const cap = require(path.join(ROOT, 'lib', 'core', 'hook-busy-cap.cjs'));",
    'cap.setHookBusyCap(cap.HOOK_BUSY_MS);',
    "const nav = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));",
    'const db = nav.openRoomDbForCaller(process.argv[2]);',
    'const out = { opened: !!db, writes: [] };',
    'if (db) {',
    '  for (let i = 0; i < Number(process.argv[3]); i++) {',
    '    const t0 = process.hrtime.bigint();',
    "    const r = nav.logMemoryEvent(db, 'gate_reached', { offered: 1, source_path: 'system:test-4003-06b' });",
    '    out.writes.push({ ok: r.ok, ms: Number(process.hrtime.bigint() - t0) / 1e6 });',
    '  }',
    '  nav.closeRoomDbForCaller(db);',
    '}',
    'process.stdout.write(JSON.stringify(out));',
  ].join('\n');
}
async function groupHookcap() {
  console.log('\n-- group hookcap --');
  const room = readyRoom('k1');
  let h = null;
  try {
    h = await startHolder(room);
    const r = spawnSync(process.execPath, ['-e', hookWriterCode(), ROOT, room, String(HOOK_WRITES)], { encoding: 'utf8', env: process.env, timeout: 60000 });
    let out = null;
    try { out = JSON.parse(String(r.stdout).trim()); } catch (_e) { out = null; }
    const w = (out && out.writes) || [];
    const msList = w.map((x) => Math.round(x.ms));
    const total = w.reduce((a, x) => a + x.ms, 0);
    const first = w[0] || { ok: true, ms: 0 };
    const rest = w.slice(1);
    check('K1 ' + HOOK_WRITES + ' busy writes in one hook process wait once (about 750 ms), then fail at once (measured ' + JSON.stringify(msList) + ' ms, total ' + Math.round(total) + ' ms)',
      !!out && out.opened === true && w.length === HOOK_WRITES && w.every((x) => x.ok === false)
        && first.ms >= 600 && rest.every((x) => x.ms < 100) && total < 1100,
      JSON.stringify({ stdout: String(r.stdout).slice(0, 300), stderr: String(r.stderr).slice(-300) }));
  } catch (e) { check('K1 fixture', false, e.message); }
  await stopHolder(h);
}

async function groupProbe() {
  console.log('\n-- group probe --');
  const spine = require(path.join(ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));
  const seen = [];
  const realOpen = roomDbMod.openRoomDb;
  roomDbMod.openRoomDb = function spyOpen(dir, opts) { seen.push(opts ? Object.assign({}, opts) : null); return realOpen.apply(this, arguments); };
  try {
    // P1: a held write lock.
    const room = readyRoom('p1');
    let h = null;
    try {
      h = await startHolder(room);
      seen.length = 0;
      const sink = [];
      const t0 = msNow();
      const db = spine.openRoomDbForCaller(room, { busyMs: 200, probeWrite: true, reasonSink: sink });
      const ms = msNow() - t0;
      if (db) { try { closeRoomDb(db); } catch (_e) { /* closed */ } }
      check('P1 probeWrite under a held write: null, reason room_db_busy, and openRoomDb got {writeProbe: true, busyMs: 200} (measured ' + ms.toFixed(0) + ' ms)',
        db === null && JSON.stringify(sink) === JSON.stringify(['room_db_busy']) && seen.length === 1 && !!seen[0] && seen[0].writeProbe === true && seen[0].busyMs === 200,
        JSON.stringify({ db: db === null ? null : 'handle', sink, seen }));
    } catch (e) { check('P1 fixture', false, e.message); }
    await stopHolder(h);
    // P2: no lock.
    seen.length = 0;
    const sink2 = [];
    const db2 = spine.openRoomDbForCaller(readyRoom('p2'), { probeWrite: true, reasonSink: sink2 });
    check('P2 probeWrite on a free room: a handle, no reason, and openRoomDb got {writeProbe: true}',
      !!db2 && sink2.length === 0 && seen.length === 1 && !!seen[0] && seen[0].writeProbe === true, JSON.stringify({ sink2, seen }));
    if (db2) { try { closeRoomDb(db2); } catch (_e) { /* closed */ } }
  } finally {
    roomDbMod.openRoomDb = realOpen;
  }
  // P3: no own probe in spine-events.
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'), 'utf8');
  const fn = (src.match(/function openRoomDbForCaller\([\s\S]*?\n\}/) || [''])[0];
  check('P3 openRoomDbForCaller has no BEGIN IMMEDIATE of its own and passes writeProbe: true',
    fn.length > 0 && fn.indexOf('BEGIN IMMEDIATE') === -1 && /writeProbe\s*[:=]\s*true/.test(fn), fn.slice(0, 200));
}

async function main() {
  if (GROUP === 'door' || GROUP === 'all') await groupDoor();
  if (GROUP === 'consumers' || GROUP === 'all') await groupConsumers();
  if (GROUP === 'hookcap' || GROUP === 'all') await groupHookcap();
  if (GROUP === 'probe' || GROUP === 'all') await groupProbe();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
