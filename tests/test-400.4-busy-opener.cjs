'use strict';
// Phase 400.4 plan 10 (QA-F11 part A): the busyMs opener, the hook busy cap and the write-lock probe.
// Legs B1 to B5. Run with HOME and MINDRIAN_ROOMS_HOME in temp dirs (the runner does this).
// A lock-holder child process holds BEGIN IMMEDIATE on a temp room.db; nothing touches ~/MindrianRooms.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const roomDbMod = require(path.join(ROOT, 'lib/core/room-db.cjs'));
const navigation = require(path.join(ROOT, 'lib/core/navigation.cjs'));

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('PASS ' + name);
  } else {
    failures++;
    console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function mkRoom() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-40040-busy-'));
  const roomDir = path.join(base, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  const db = roomDbMod.openRoomDb(roomDir);
  roomDbMod.closeRoomDb(db);
  return roomDir;
}

// Start a child that holds BEGIN IMMEDIATE on <roomDir>/.mindrian/room.db for holdMs.
function holdLock(roomDir, holdMs) {
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const code = [
    "const { DatabaseSync } = require('node:sqlite');",
    'const db = new DatabaseSync(process.argv[1], { timeout: 0 });',
    "db.exec('BEGIN IMMEDIATE');",
    "process.stdout.write('locked\\n');",
    'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.argv[2]));',
    "db.exec('ROLLBACK');",
    'db.close();',
  ].join('\n');
  const child = spawn(process.execPath, ['-e', code, dbPath, String(holdMs)], { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      if (buf.includes('locked')) resolve(child);
    });
    child.on('error', reject);
    child.on('exit', () => { if (!buf.includes('locked')) reject(new Error('lock holder exited early')); });
  });
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.on('exit', () => resolve());
    child.kill('SIGKILL');
  });
}

async function main() {
  const cap = require(path.join(ROOT, 'lib/core/hook-busy-cap.cjs'));

  // B3: cap module (pure, run in a fresh process state via a child so the trip does not leak into later legs).
  {
    const code = [
      "const c = require(process.argv[1]);",
      'const out = {};',
      'out.noCap = c.capBusyMs(5000);',
      'c.setHookBusyCap(750);',
      'out.capBig = c.capBusyMs(5000);',
      'out.capSmall = c.capBusyMs(200);',
      'c.noteBusy();',
      'out.tripped = c.capBusyMs(5000);',
      'c.setHookBusyCap(750);',
      'out.afterReset = c.capBusyMs(5000);',
      'out.hookMs = c.HOOK_BUSY_MS;',
      'process.stdout.write(JSON.stringify(out));',
    ].join('\n');
    const r = require('node:child_process').spawnSync(process.execPath, ['-e', code, path.join(ROOT, 'lib/core/hook-busy-cap.cjs')], { encoding: 'utf8' });
    let o = {};
    try { o = JSON.parse(r.stdout); } catch (_e) { /* leave empty */ }
    check('B3 no cap returns the requested wait', o.noCap === 5000, JSON.stringify(o));
    check('B3 cap 750 limits 5000 to 750', o.capBig === 750, JSON.stringify(o));
    check('B3 cap 750 keeps 200', o.capSmall === 200, JSON.stringify(o));
    check('B3 noteBusy drops the cap to 0', o.tripped === 0, JSON.stringify(o));
    check('B3 a second setHookBusyCap keeps the trip', o.afterReset === 0, JSON.stringify(o));
    check('B3 HOOK_BUSY_MS is 750', o.hookMs === 750, JSON.stringify(o));
  }

  // B1: a held write lock; the opener with busyMs 300.
  {
    const roomDir = mkRoom();
    const child = await holdLock(roomDir, 8000);
    try {
      let t0 = Date.now();
      let outcome = 'opened';
      try {
        const db = roomDbMod.openRoomDb(roomDir, { busyMs: 300 });
        roomDbMod.closeRoomDb(db);
      } catch (e) {
        outcome = e && e.name;
      }
      const dt = Date.now() - t0;
      check('B1 openRoomDb busyMs 300 opens or throws RoomDbBusyError within 1500 ms',
        (outcome === 'opened' || outcome === 'RoomDbBusyError') && dt <= 1500, 'outcome=' + outcome + ' ms=' + dt);

      const reasons = [];
      t0 = Date.now();
      const h = navigation.openRoomDbForCaller(roomDir, { busyMs: 300, probeWrite: true, reasonSink: reasons });
      const dt2 = Date.now() - t0;
      if (h) navigation.closeRoomDbForCaller(h);
      check('B1 openRoomDbForCaller probeWrite returns null within 1500 ms', h === null && dt2 <= 1500, 'handle=' + (h ? 'live' : 'null') + ' ms=' + dt2);
      check('B1 reasonSink holds room_db_busy', reasons.includes('room_db_busy'), JSON.stringify(reasons));
    } finally {
      await stopChild(child);
    }
  }

  // B2: no busyMs and no cap keeps the 5000 ms wait (a held lock makes the probe wait about 5 s).
  {
    const roomDir = mkRoom();
    check('B2 DEFAULT_BUSY_MS is 5000', roomDbMod.DEFAULT_BUSY_MS === 5000, String(roomDbMod.DEFAULT_BUSY_MS));
    const child = await holdLock(roomDir, 9000);
    try {
      // Without probeWrite the default open may succeed (no write needed); force the wait with a direct write
      // through the opened handle when it opens, else measure the throw.
      const t0 = Date.now();
      let waited = 0;
      try {
        const db = roomDbMod.openRoomDb(roomDir);
        try {
          db.exec('BEGIN IMMEDIATE');
          db.exec('ROLLBACK');
        } catch (_e) { /* busy after the default wait */ }
        roomDbMod.closeRoomDb(db);
      } catch (_e) { /* busy at open */ }
      waited = Date.now() - t0;
      check('B2 default open waits at least 4000 ms on a held lock', waited >= 4000, 'ms=' + waited);
    } finally {
      await stopChild(child);
    }
  }

  // B4: the selector mirror under the cap.
  {
    const roomDir = mkRoom();
    const child = await holdLock(roomDir, 9000);
    const code = [
      "const t = require(process.argv[1]);",
      "const c = require(process.argv[2]);",
      'c.setHookBusyCap(750);',
      "const room = process.argv[3];",
      "const payload = { surface: 'test', correlation_id: 'c1' };",
      'let t0 = Date.now();',
      "let r1; try { r1 = t.recordSelectorMirror(room, 'selector_presentation', payload); } catch (e) { r1 = { threw: String(e) }; }",
      'const d1 = Date.now() - t0;',
      't0 = Date.now();',
      "let r2; try { r2 = t.recordSelectorMirror(room, 'selector_presentation', payload); } catch (e) { r2 = { threw: String(e) }; }",
      'const d2 = Date.now() - t0;',
      'process.stdout.write(JSON.stringify({ d1, d2, r1, r2 }));',
    ].join('\n');
    try {
      const r = require('node:child_process').spawnSync(process.execPath,
        ['-e', code, path.join(ROOT, 'lib/hmi/selector-telemetry.cjs'), path.join(ROOT, 'lib/core/hook-busy-cap.cjs'), roomDir],
        { encoding: 'utf8', timeout: 20000 });
      let o = {};
      try { o = JSON.parse(r.stdout); } catch (_e) { /* leave empty */ }
      check('B4 first mirror call returns within 1500 ms and does not throw', o.d1 !== undefined && o.d1 <= 1500 && !(o.r1 && o.r1.threw), JSON.stringify(o) + ' ' + (r.stderr || ''));
      check('B4 second mirror call returns within 200 ms', o.d2 !== undefined && o.d2 <= 200 && !(o.r2 && o.r2.threw), JSON.stringify(o));
    } finally {
      await stopChild(child);
    }
  }

  // B5: no lock; the probe returns a live handle with no open transaction.
  {
    const roomDir = mkRoom();
    const h = navigation.openRoomDbForCaller(roomDir, { busyMs: 750, probeWrite: true });
    check('B5 probe returns a live handle without a lock', !!h);
    if (h) {
      let wrote = false;
      try {
        // A fresh write transaction begins and commits: no transaction was left open by the probe.
        h.exec('BEGIN IMMEDIATE');
        h.exec('COMMIT');
        wrote = true;
      } catch (_e) { /* fall through */ }
      check('B5 a write through the handle succeeds (no open transaction)', wrote);
      navigation.closeRoomDbForCaller(h);
    }
    // one-argument call is unchanged
    const h1 = navigation.openRoomDbForCaller(roomDir);
    check('B5 one-argument openRoomDbForCaller still returns a handle', !!h1);
    if (h1) navigation.closeRoomDbForCaller(h1);
    const missing = navigation.openRoomDbForCaller(path.join(os.tmpdir(), 'mos-40040-no-such-room-' + process.pid), { reasonSink: [] });
    check('B5 absent room.db returns null', missing === null);
    const r = require('node:child_process').spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-substrate.cjs')], { encoding: 'utf8', cwd: ROOT });
    check('B5 scripts/check-substrate.cjs passes', r.status === 0, (r.stdout || '').slice(-300) + (r.stderr || '').slice(-300));
  }

  console.log(failures === 0 ? 'ALL PASS test-400.4-busy-opener' : 'FAILED ' + failures);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FAIL test crashed: ' + (e && e.stack || e)); process.exit(1); });
