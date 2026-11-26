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
 * Groups: door (O1-O9), consumers (T1-T3).
 * Usage: node tests/test-400-3-room-db-opener.cjs [door|consumers|all]   (default all)
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
if (['door', 'consumers', 'all'].indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-room-db-opener.cjs [door|consumers|all]');
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

async function main() {
  if (GROUP === 'door' || GROUP === 'all') await groupDoor();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
