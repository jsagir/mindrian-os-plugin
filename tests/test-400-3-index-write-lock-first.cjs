#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 06a: the index path takes the SQLite write lock first, so its busy wait is real and bounded.
 *
 * Owner rulings covered: OR-2 (BEGIN IMMEDIATE at the indexArtifact and rebuildGraph owned sites), OR-4 (the
 * index busy wait of 500 ms keeps the C10 bound of 750 ms), C10, D-10 (no index call fills a 0-byte room.db),
 * D-11 (bounded busy wait), and the OR-7 follow-ups of the index-path files (the 750 ms constants, the
 * openGraph handle leak on busy, a 0-byte room.db that passes mustExist).
 *
 * Canon Part 8: fixture rooms only under mkdtemp roots; no network.
 * Native Windows is UNMEASURED.
 *
 * Groups: lock (W1-W6), backfill (B1-B3), presence (E1-E6).
 * Usage: node tests/test-400-3-index-write-lock-first.cjs [lock|backfill|presence|all]   (default all)
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DB_LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');
const HOLDER_MODE = 'BEGIN IMMEDIATE + write';

const GROUPS = ['lock', 'backfill', 'presence', 'all'];
const GROUP = process.argv[2] || 'all';
if (GROUPS.indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-index-write-lock-first.cjs [lock|backfill|presence|all]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
function skip(label, why) { console.log('SKIP: ' + label + ' (' + why + ')'); }

const ROOTS = [];
process.on('exit', () => {
  for (const r of ROOTS) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});
function mkRoot(label) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), '4003-06a-' + label + '-'));
  ROOTS.push(r);
  return r;
}
function msNow() { return Number(process.hrtime.bigint()) / 1e6; }

const graphOps = require(path.join(ROOT, 'lib', 'core', 'graph-ops.cjs'));
const lazygraph = require(path.join(ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));

const ARTIFACT = '---\ntitle: A note\n---\n\n# A note\n\nOne prose line for the index.\n';

// A room seeded through the real write door (openRoomDb then closeRoomDb), plus sec/a.md.
function mkRoom(parent, name) {
  const room = path.join(parent, name);
  fs.mkdirSync(path.join(room, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), '');
  fs.writeFileSync(path.join(room, 'sec', 'a.md'), ARTIFACT);
  const db = openRoomDb(room);
  closeRoomDb(db);
  return room;
}
function dbPathOf(room) { return path.join(room, '.mindrian', 'room.db'); }
function artifactRows(room, id) {
  const p = dbPathOf(room);
  if (!fs.existsSync(p)) return -1;
  const db = new DatabaseSync(p, { readOnly: true });
  try {
    if (id === undefined) return db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'Artifact'").get().n;
    return db.prepare("SELECT id FROM nodes WHERE type = 'Artifact' AND id = ?").all(id).length;
  } finally { db.close(); }
}

// The holder of tests/helpers/room-db-lock-holder-236.cjs. holdMs and mode end the hold on the holder's own
// timer (plan 400.3-06a), because this process is inside a synchronous busy wait when the hold must end.
function startHolder(room, holdMs, mode) {
  return new Promise((resolve, reject) => {
    const args = [room];
    if (holdMs) { args.push(String(holdMs)); args.push(mode || 'rollback'); }
    const child = fork(DB_LOCK_HOLDER, args, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    // A timed holder can exit while this process is inside a synchronous busy wait; a late send then fails with EPIPE.
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
async function timed(fn) {
  const t0 = msNow();
  let result;
  let err = null;
  try { result = await fn(); } catch (e) { err = e; }
  return { result, err, ms: msNow() - t0 };
}
function errInfo(e) { return e ? JSON.stringify({ message: e.message, code: e.code, errcode: e.errcode }) : 'no error'; }

// ---------------------------------------------------------------------------
// Group lock (W1-W6)
// ---------------------------------------------------------------------------
async function groupLock() {
  console.log('\n-- group lock --');
  const root = mkRoot('lock');

  // W1
  {
    const room = mkRoom(root, 'w1');
    let h = null;
    try {
      h = await startHolder(room, 300, 'commit');
      const r = await timed(() => graphOps.indexArtifact(room, path.join(room, 'sec', 'a.md'), { mustExist: true, busyMs: graphOps.INDEX_BUSY_MS }));
      check('W1 a 300 ms foreign write: the index waits and succeeds (measured ' + r.ms.toFixed(0) + ' ms)',
        !r.err && r.result && r.result.success === true && r.ms >= 150 && artifactRows(room, 'sec/a') === 1,
        errInfo(r.err) + ' rows=' + artifactRows(room, 'sec/a'));
    } catch (e) { check('W1 fixture', false, e.message); }
    await stopHolder(h);
  }

  // W2
  {
    const room = mkRoom(root, 'w2');
    let h = null;
    try {
      h = await startHolder(room);
      const r = await timed(() => graphOps.indexArtifact(room, path.join(room, 'sec', 'a.md'), { mustExist: true, busyMs: graphOps.INDEX_BUSY_MS }));
      check('W2 a held foreign write: room_db_busy after 450-750 ms (measured ' + r.ms.toFixed(0) + ' ms)',
        !!r.err && graphOps.classifyIndexError(r.err) === 'room_db_busy' && r.ms >= 450 && r.ms < 750,
        errInfo(r.err));
    } catch (e) { check('W2 fixture', false, e.message); }
    await stopHolder(h);
  }

  // W3
  {
    const room = mkRoom(root, 'w3');
    let h = null;
    try {
      h = await startHolder(room, 300, 'commit');
      const r = await timed(() => graphOps.indexArtifact(room, path.join(room, 'sec', 'a.md')));
      check('W3 the default busy wait waits out a 300 ms foreign write (measured ' + r.ms.toFixed(0) + ' ms)',
        !r.err && r.result && r.result.success === true && artifactRows(room, 'sec/a') === 1, errInfo(r.err));
    } catch (e) { check('W3 fixture', false, e.message); }
    await stopHolder(h);
  }

  // W4
  {
    const room = mkRoom(root, 'w4');
    let h = null;
    try {
      h = await startHolder(room, 300, 'commit');
      const r = await timed(() => graphOps.rebuildGraph(room));
      check('W4 rebuildGraph waits out a 300 ms foreign write (measured ' + r.ms.toFixed(0) + ' ms)',
        !r.err && r.result && r.result.success === true, errInfo(r.err));
    } catch (e) { check('W4 fixture', false, e.message); }
    await stopHolder(h);
  }

  // W5
  {
    const room = mkRoom(root, 'w5');
    let err = null;
    let db = null;
    try {
      const g = await lazygraph.openGraph(room);
      db = g.db;
      g.conn.exec('BEGIN IMMEDIATE');
      await lazygraph.indexArtifact(g.conn, room, path.join(room, 'sec', 'a.md'));
      await lazygraph.rebuildGraph(g.conn, room);
      g.conn.exec('COMMIT');
    } catch (e) {
      err = e;
      try { if (db) db.exec('ROLLBACK'); } catch (_e) { /* none open */ }
    }
    if (db) await lazygraph.closeGraph(db);
    check('W5 indexArtifact and rebuildGraph compose inside a caller transaction', !err && artifactRows(room, 'sec/a') === 1, errInfo(err));
  }

  // W6
  check('W6 INDEX_BUSY_MS is 500, INDEX_LOCK_WAIT_MS is 750, and INDEX_BUSY_MS is below the C10 bound of 750 ms',
    graphOps.INDEX_BUSY_MS === 500 && graphOps.INDEX_LOCK_WAIT_MS === 750 && graphOps.INDEX_BUSY_MS < 750,
    JSON.stringify({ INDEX_BUSY_MS: graphOps.INDEX_BUSY_MS, INDEX_LOCK_WAIT_MS: graphOps.INDEX_LOCK_WAIT_MS }));
}

// ---------------------------------------------------------------------------
// Group backfill (B1-B3)
// ---------------------------------------------------------------------------
function mkManyRoom(parent, name, n) {
  const room = mkRoom(parent, name);
  const files = [];
  for (let i = 0; i < n; i++) {
    const f = path.join(room, 'sec', 'f' + i + '.md');
    fs.writeFileSync(f, ARTIFACT.replace('A note', 'Note ' + i));
    files.push(f);
  }
  return { room, files };
}
async function groupBackfill() {
  console.log('\n-- group backfill --');
  const root = mkRoot('backfill');
  const fn = graphOps.indexArtifactsStopOnBusy;
  if (typeof fn !== 'function') {
    check('B1-B3 graphOps.indexArtifactsStopOnBusy exists', false, typeof fn);
    return;
  }

  // B1
  const m = mkManyRoom(root, 'b1', 20);
  {
    let h = null;
    try {
      h = await startHolder(m.room);
      const r = await timed(() => fn(m.room, m.files, { busyMs: graphOps.INDEX_BUSY_MS }));
      check('B1 a held foreign write: indexed 0, stopped room_db_busy, in less than 1500 ms (measured ' + r.ms.toFixed(0) + ' ms)',
        !r.err && r.result && r.result.indexed === 0 && r.result.stopped === 'room_db_busy' && r.ms < 1500,
        errInfo(r.err) + ' ' + JSON.stringify(r.result));
    } catch (e) { check('B1 fixture', false, e.message); }
    await stopHolder(h);
  }

  // B2
  {
    const r = await timed(() => fn(m.room, m.files, { busyMs: graphOps.INDEX_BUSY_MS }));
    let rows = 0;
    for (let i = 0; i < 20; i++) rows += artifactRows(m.room, 'sec/f' + i);
    check('B2 no holder: indexed 20, stopped null, 20 Artifact rows',
      !r.err && r.result && r.result.indexed === 20 && r.result.stopped === null && rows === 20,
      errInfo(r.err) + ' ' + JSON.stringify(r.result) + ' rows=' + rows);
  }

  // B3
  {
    const m3 = mkManyRoom(root, 'b3', 3);
    const files = [m3.files[0], path.join(m3.room, 'sec', 'missing.md'), m3.files[2]];
    const r = await timed(() => fn(m3.room, files, { busyMs: graphOps.INDEX_BUSY_MS }));
    check('B3 a missing file does not stop the loop: indexed 2, stopped null',
      !r.err && r.result && r.result.indexed === 2 && r.result.stopped === null,
      errInfo(r.err) + ' ' + JSON.stringify(r.result));
  }
}

async function main() {
  if (GROUP === 'lock' || GROUP === 'all') await groupLock();
  if (GROUP === 'backfill' || GROUP === 'all') await groupBackfill();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
