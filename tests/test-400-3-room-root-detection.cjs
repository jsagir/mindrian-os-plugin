#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 02: room-root detection for rooms the old /room/-or-/rooms/ rule skipped, graph-index only.
 *
 * Decisions covered: D-01 (index only for newly recognised rooms; legacy rooms keep the full cascade), D-03
 * amended (marker = .room-root plus an existing .mindrian/room.db), D-06 (hook budget, Linux timing), D-07
 * (indexed or index failed, never cascade complete), D-10 (no hook creates room.db), D-11 (about 750 ms busy
 * wait, pending record first), review B-1 (node is the one resolver; the record goes where node indexed), M-1
 * (bounded lock retry; 20 back-to-back Writes all indexed), M-4 (reuse resolveRoomRoot and normalizeRoomPath),
 * M-5 (no second marker), M-6 (one walk path in post-write), revision W1 (shell rooms with no STATE.md).
 *
 * Canon Part 8: fixture rooms only under mkdtemp roots; MINDRIAN_BRAIN_URL points at a closed loopback port.
 *
 * Windows path forms are covered by path.win32 unit arms and by Linux proxies of the bash walks. Native
 * Windows is UNMEASURED.
 *
 * Groups: unit (U1-U9), cascade (C1-C10), hook (H1-H15, H8w).
 * Usage: node tests/test-400-3-room-root-detection.cjs [unit|cascade|hook|all]   (default all)
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const POST_WRITE = path.join(ROOT, 'scripts', 'post-write');
const WRITE_LOCK_HOLDER = path.join(__dirname, 'helpers', 'write-lock-holder-354.cjs');
const DB_LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');
const POSIX = process.platform !== 'win32';

const GROUP = process.argv[2] || 'all';
if (['unit', 'cascade', 'hook', 'all'].indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-room-root-detection.cjs [unit|cascade|hook|all]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
function skip(label) { console.log('SKIP: ' + label + ' (POSIX arm on win32)'); }
// KNOWN-OPEN: an owner-accepted open item (2026-11-26). It is measured and printed every run, never counted as a pass.
let knownOpen = 0;
function known(label, detail) { knownOpen += 1; console.log('KNOWN-OPEN: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }

const ROOTS = [];
process.on('exit', () => {
  for (const r of ROOTS) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});

// The tests/test-384-s2-post-write-skip.cjs TMPDIR guard: a root under /room/ or /rooms/, or under an ancestor
// with .room-root or STATE.md, would change what the cascade sees.
function guardRoot(r) {
  const u = r.split(path.sep).join('/') + '/';
  if (u.indexOf('/room/') !== -1 || u.indexOf('/rooms/') !== -1) return 'mkdtemp root holds /room/ or /rooms/: ' + r;
  let d = path.dirname(r);
  for (;;) {
    if (fs.existsSync(path.join(d, '.room-root')) || fs.existsSync(path.join(d, 'STATE.md'))) return 'an ancestor of the root holds .room-root or STATE.md: ' + d;
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}
function mkRoot(label) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), '4003-02-' + label + '-'));
  ROOTS.push(r);
  const bad = guardRoot(r);
  if (bad) { console.log('FAIL: TMPDIR guard: ' + bad + ' (set TMPDIR elsewhere)'); process.exit(1); }
  return r;
}

function msNow() { return Number(process.hrtime.bigint()) / 1e6; }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function withRoomDb(roomDir) {
  const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
}
const ARTIFACT = '---\ntitle: A note\n---\n\n# A note\n\nOne prose line for the index.\n';
// r1 shape: .room-root, STATE.md, ROOM.md, sec/ROOM.md, sec/a.md; room.db when opts.db.
function mkR1(roomDir, opts) {
  const o = opts || {};
  fs.mkdirSync(path.join(roomDir, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  if (o.state !== false) fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# State\n');
  if (o.roomMd !== false) fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Room\n');
  if (o.secRoomMd !== false) fs.writeFileSync(path.join(roomDir, 'sec', 'ROOM.md'), '# sec\n');
  fs.writeFileSync(path.join(roomDir, 'sec', 'a.md'), ARTIFACT);
  if (o.db) withRoomDb(roomDir);
  return roomDir;
}
function artifactRows(roomDir, id) {
  const p = path.join(roomDir, '.mindrian', 'room.db');
  if (!fs.existsSync(p)) return -1;
  const db = new DatabaseSync(p, { readOnly: true });
  try { return db.prepare("SELECT id FROM nodes WHERE type = 'Artifact' AND id = ?").all(id).length; }
  finally { db.close(); }
}
function readSide(roomDir) {
  try { return JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'last-cascade.json'), 'utf8')); }
  catch (_e) { return null; }
}

function startWriteLockHolder(roomDir, holdMs) {
  return new Promise((resolve, reject) => {
    const child = fork(WRITE_LOCK_HOLDER, [roomDir, 'hold', String(holdMs)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    child.on('message', (msg) => {
      if (settled) return;
      if (msg && msg.acquired) { settled = true; resolve({ child, pid: msg.pid }); }
      else if (msg && msg.error) { settled = true; reject(new Error('write-lock holder error: ' + msg.error)); }
    });
    child.on('exit', (code) => { if (!settled) { settled = true; reject(new Error('write-lock holder exited ' + code)); } });
  });
}
function stopChild(handle) {
  return new Promise((resolve) => {
    if (!handle || !handle.child || handle.child.exitCode !== null || handle.child.signalCode !== null) return resolve();
    handle.child.once('exit', () => resolve());
    try { handle.child.kill(); } catch (_e) { resolve(); }
  });
}
function startDbLockHolder(roomDir) {
  return new Promise((resolve, reject) => {
    const child = fork(DB_LOCK_HOLDER, [roomDir], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    child.on('message', (msg) => { if (msg && msg.ready && !settled) { settled = true; resolve({ child }); } });
    child.on('exit', (code) => { if (!settled) { settled = true; reject(new Error('room-db-lock-holder-236 exited ' + code + ' before ready')); } });
  });
}
function stopDbLockHolder(handle) {
  return new Promise((resolve) => {
    if (!handle || !handle.child || handle.child.exitCode !== null) return resolve();
    handle.child.once('exit', () => resolve());
    try { handle.child.send('release'); } catch (_e) { handle.child.kill(); }
  });
}

// ---------------------------------------------------------------------------
// Group unit
// ---------------------------------------------------------------------------
function groupUnit() {
  console.log('\n-- group unit --');
  const { resolveRoomRoot } = require(path.join(ROOT, 'lib', 'core', 'room-root.cjs'));
  const cascade = require(path.join(ROOT, 'lib', 'core', 'intelligence-cascade.cjs'));
  const internal = cascade._internal || {};
  const setExists = (arr) => { const s = new Set(arr); return (p) => s.has(p); };
  const W = { pathImpl: path.win32 };

  if (POSIX) {
    check('U1 POSIX default-home room resolves', resolveRoomRoot('/home/u/MindrianRooms/x/sec/a.md', { exists: setExists(['/home/u/MindrianRooms/x/.room-root']) }) === '/home/u/MindrianRooms/x');
  } else skip('U1');

  {
    const ex = setExists(['C:\\Users\\u\\MindrianRooms\\x\\.room-root']);
    const a = resolveRoomRoot('C:\\Users\\u\\MindrianRooms\\x\\sec\\a.md', Object.assign({ exists: ex }, W));
    const b = resolveRoomRoot('C:/Users/u/MindrianRooms/x/sec/a.md', Object.assign({ exists: ex }, W));
    check('U2 win32 drive path (backslash and forward slash) resolves to C:\\Users\\u\\MindrianRooms\\x',
      a === 'C:\\Users\\u\\MindrianRooms\\x' && b === 'C:\\Users\\u\\MindrianRooms\\x', a + ' / ' + b);
  }
  {
    const r = resolveRoomRoot('\\\\srv\\share\\MindrianRooms\\x\\sec\\a.md', Object.assign({ exists: setExists(['\\\\srv\\share\\MindrianRooms\\x\\.room-root']) }, W));
    check('U3 win32 UNC path resolves to \\\\srv\\share\\MindrianRooms\\x', r === '\\\\srv\\share\\MindrianRooms\\x', r);
  }
  {
    const none = () => false;
    const a = resolveRoomRoot('C:\\Users\\u\\a.md', Object.assign({ exists: none }, W));
    const b = resolveRoomRoot('\\\\srv\\share\\a.md', Object.assign({ exists: none }, W));
    const c = POSIX ? resolveRoomRoot('/home/u/a/b.md', { exists: none }) : '';
    check('U4 with no marker the drive, UNC and POSIX walks return an empty string and stop', a === '' && b === '' && c === '', [a, b, c].join('|'));
  }
  if (POSIX) {
    const t = mkRoot('u5');
    fs.mkdirSync(path.join(t, 'r', 'sec'), { recursive: true });
    fs.writeFileSync(path.join(t, 'r', '.room-root'), '');
    fs.writeFileSync(path.join(t, 'r', 'sec', 'a.md'), 'x');
    check('U5 the one-argument form is unchanged on a real tree', resolveRoomRoot(path.join(t, 'r', 'sec', 'a.md')) === path.join(t, 'r'));
  } else skip('U5');
  if (POSIX) {
    const a = resolveRoomRoot('/h/MR/x/sub/sec/a.md', { exists: setExists(['/h/MR/x/.room-root', '/h/MR/x/sub/.room-root']) });
    const b = resolveRoomRoot('/h/MR/x/sec/a.md', { exists: setExists(['/h/MR/x/.room-root', '/h/MR/x/sec/ROOM.md']) });
    check('U6 the nearest .room-root wins; ROOM.md is not a marker', a === '/h/MR/x/sub' && b === '/h/MR/x', a + ' / ' + b);
  } else skip('U6');

  if (typeof internal.findRoomDir !== 'function') {
    check('U7 _internal.findRoomDir is exported', false);
  } else {
    const a = internal.findRoomDir('C:\\Users\\u\\rooms\\x\\a.md', { pathImpl: path.win32, exists: () => false });
    const b = internal.findRoomDir('C:\\Users\\u\\rooms\\x\\a.md', { pathImpl: path.win32, exists: setExists(['C:\\Users\\u\\rooms\\x\\STATE.md']) });
    const c = POSIX ? internal.findRoomDir('/tmp/none/a.md', { exists: () => false }) : null;
    check('U7 findRoomDir stops at a win32 drive root and finds STATE.md', a === null && b === 'C:\\Users\\u\\rooms\\x' && c === null, [a, b, c].join('|'));
  }

  if (typeof internal.resolveCascadeMode !== 'function') {
    check('U8 _internal.resolveCascadeMode is exported', false);
    check('U9 resolveCascadeMode indexOnly', false);
  } else {
    const m = internal.resolveCascadeMode;
    const winEx = (p) => ({ platform: 'win32', pathImpl: path.win32, exists: setExists([p]) });
    const rows = [];
    rows.push(['a', m('/home/u/rooms/x/a.md', {}).mode === 'full']);
    rows.push(['b', m('/home/u/room/x/a.md', {}).mode === 'full']);
    rows.push(['c', m('C:/Users/u/rooms/x/a.md', {}).mode === 'full']);
    const d = m('C:\\Users\\u\\rooms\\x\\a.md', winEx('C:\\Users\\u\\rooms\\x\\.room-root'));
    rows.push(['d', d.mode === 'index-only' && d.roomDir === 'C:\\Users\\u\\rooms\\x']);
    const e = m('C:\\Users\\u\\MindrianRooms\\x\\sec\\a.md', winEx('C:\\Users\\u\\MindrianRooms\\x\\.room-root'));
    rows.push(['e', e.mode === 'index-only' && e.roomDir === 'C:\\Users\\u\\MindrianRooms\\x']);
    if (POSIX) {
      rows.push(['f', m('/home/u/MindrianRooms/x/sec/a.md', { exists: setExists(['/home/u/MindrianRooms/x/.room-root']) }).mode === 'index-only']);
      rows.push(['g', m('/home/u/MindrianRooms/x/sec/a.md', { exists: setExists([]) }).mode === 'skip']);
      rows.push(['h', m('/p/.planning/phases/x/a.md', { exists: setExists(['/p/.planning/STATE.md', '/p/.planning/ROOM.md', '/p/.planning/.mindrian', '/p/.planning/.mindrian/room.db']) }).mode === 'skip']);
      rows.push(['i', m('\\\\?\\C:\\Users\\u\\MindrianRooms\\x\\a.md', {}).mode === 'skip']);
    }
    const bad = rows.filter((r) => !r[1]).map((r) => r[0]);
    check('U8 resolveCascadeMode gives full, index-only or skip per case (a-i' + (POSIX ? '' : ', POSIX cases skipped') + ')', bad.length === 0, 'failing cases: ' + bad.join(','));
    if (POSIX) {
      const ex = setExists(['/home/u/rooms/x/.room-root']);
      const a = m('/home/u/rooms/x/sec/a.md', { indexOnly: true, exists: ex }).mode;
      const b = m('/home/u/rooms/x/sec/a.md', { indexOnly: true, exists: setExists([]) }).mode;
      const c = m('/home/u/rooms/x/sec/a.md', { exists: ex }).mode;
      check('U9 indexOnly skips the legacy rule: index-only with a marker, skip without, full without indexOnly', a === 'index-only' && b === 'skip' && c === 'full', [a, b, c].join('|'));
    } else skip('U9');
  }
}

// ---------------------------------------------------------------------------
// Group cascade
// ---------------------------------------------------------------------------
async function groupCascade() {
  console.log('\n-- group cascade --');
  const root = mkRoot('cascade');
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  const SAVED = {};
  const KEYS = ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL', 'MOS_NO_DETACHED_DERIVE', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_ROOM_DIR'];
  for (const k of KEYS) SAVED[k] = process.env[k];
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.MINDRIAN_ROOMS_HOME = path.join(home, 'MindrianRooms');
  process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.CLAUDE_ROOM_DIR;
  const cascade = require(path.join(ROOT, 'lib', 'core', 'intelligence-cascade.cjs'));
  const run = (roomDir, filePath, extra) => cascade.runCascade(roomDir, Object.assign({ trigger: 'cli-hook', filePath }, extra || {}));
  try {
    // C1
    const r1 = mkR1(path.join(home, 'MindrianRooms', 'r1'), { db: true });
    const aPath = path.join(r1, 'sec', 'a.md');
    const before = fs.readFileSync(aPath);
    const c1 = await run(r1, aPath);
    check('C1 a default-home room with room.db gets index-only: mode, roomDir, graphIndex ok sec/a',
      c1.mode === 'index-only' && c1.skipped === false && c1.roomDir === r1 && c1.graphIndex && c1.graphIndex.status === 'ok' && c1.graphIndex.id === 'sec/a',
      JSON.stringify({ mode: c1.mode, skipped: c1.skipped, skipReason: c1.skipReason, roomDir: c1.roomDir, graphIndex: c1.graphIndex }));
    check('C1 nothing else ran: classification, gitCommit, hsi null; no deriveEnqueue key',
      c1.classification === null && c1.gitCommit === null && c1.hsi === null && !Object.prototype.hasOwnProperty.call(c1, 'deriveEnqueue'));
    check('C1 room.db holds 1 Artifact row sec/a and the file bytes are unchanged',
      artifactRows(r1, 'sec/a') === 1 && Buffer.compare(before, fs.readFileSync(aPath)) === 0, String(artifactRows(r1, 'sec/a')));

    // C2
    const pl = path.join(root, 'proj', '.planning');
    fs.mkdirSync(path.join(pl, 'phases', 'x'), { recursive: true });
    fs.mkdirSync(path.join(pl, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(pl, 'STATE.md'), '# state\n');
    fs.writeFileSync(path.join(pl, '.mindrian', 'last-cascade.json'), '{}');
    fs.writeFileSync(path.join(pl, 'phases', 'x', 'a.md'), ARTIFACT);
    const c2 = await run(pl, path.join(pl, 'phases', 'x', 'a.md'));
    check('C2 a GSD .planning folder is not a room: skipped, no room.db',
      c2.skipped === true && c2.skipReason === 'filePath not inside a room directory' && !fs.existsSync(path.join(pl, '.mindrian', 'room.db')),
      JSON.stringify({ skipped: c2.skipped, skipReason: c2.skipReason }));

    // C3
    const c3 = await run(r1, path.join(r1, 'sec', 'ROOM.md'));
    check('C3 ROOM.md is not an artifact (index-only mode)', c3.skipped === true && c3.skipReason === 'ROOM.md is not an artifact' && c3.mode === 'index-only', JSON.stringify({ skipReason: c3.skipReason, mode: c3.mode }));

    // C4
    fs.writeFileSync(path.join(r1, 'sec', 'b.txt'), 'x');
    fs.writeFileSync(path.join(r1, '.mindrian', 'notes.md'), '# n\n');
    const c4a = await run(r1, path.join(r1, 'sec', 'b.txt'));
    const c4b = await run(r1, path.join(r1, '.mindrian', 'notes.md'));
    check('C4 a .txt file and a file under .mindrian are not indexable markdown artifacts',
      c4a.skipped === true && c4a.skipReason === 'not an indexable markdown artifact' && c4b.skipped === true && c4b.skipReason === 'not an indexable markdown artifact',
      JSON.stringify([c4a.skipReason, c4b.skipReason]));

    // C5
    {
      fs.writeFileSync(path.join(r1, 'sec', 'c.md'), ARTIFACT);
      let h = null;
      try {
        h = await startWriteLockHolder(r1, 8000);
        const t0 = msNow();
        const c5 = await run(r1, path.join(r1, 'sec', 'c.md'));
        const ms = msNow() - t0;
        check('C5 a held write.lock gives graphIndex error write_lock_held after 600-2000 ms (measured ' + ms.toFixed(0) + ' ms)',
          c5.graphIndex && c5.graphIndex.status === 'error' && c5.graphIndex.reason === 'write_lock_held' && ms >= 600 && ms < 2000,
          JSON.stringify(c5.graphIndex));
      } catch (e) { check('C5 fixture', false, e.message); }
      await stopChild(h);
    }

    // C6
    {
      fs.writeFileSync(path.join(r1, 'sec', 'e.md'), ARTIFACT);
      let h = null;
      try {
        h = await startWriteLockHolder(r1, 300);
        const c6 = await run(r1, path.join(r1, 'sec', 'e.md'));
        check('C6 the bounded backoff waits out a 300 ms holder: graphIndex ok', c6.graphIndex && c6.graphIndex.status === 'ok', JSON.stringify(c6.graphIndex));
      } catch (e) { check('C6 fixture', false, e.message); }
      await stopChild(h);
    }

    // C7
    {
      process.env.MOS_NO_DETACHED_DERIVE = '1';
      const y = path.join(root, 'rooms', 'y');
      mkR1(y, { roomMd: false });
      const c7 = await run(y, path.join(y, 'sec', 'a.md'));
      check('C7 a legacy /rooms/ room with STATE.md runs the full cascade: no mode key, classification not null',
        !Object.prototype.hasOwnProperty.call(c7, 'mode') && c7.classification !== null && c7.classification !== undefined,
        JSON.stringify({ mode: c7.mode, classification: c7.classification, skipReason: c7.skipReason }));
      if (SAVED.MOS_NO_DETACHED_DERIVE === undefined) delete process.env.MOS_NO_DETACHED_DERIVE; else process.env.MOS_NO_DETACHED_DERIVE = SAVED.MOS_NO_DETACHED_DERIVE;
    }

    // C8
    {
      const z = path.join(root, 'rooms', 'z');
      mkR1(z, { state: false, roomMd: false, secRoomMd: false, db: true });
      const c8 = await run(z, path.join(z, 'sec', 'a.md'), { indexOnly: true });
      check('C8 a shell room on a /rooms/ path with indexOnly gets index-only, classification null, Artifact row sec/a',
        c8.mode === 'index-only' && c8.classification === null && artifactRows(z, 'sec/a') === 1,
        JSON.stringify({ mode: c8.mode, classification: c8.classification, graphIndex: c8.graphIndex }));
    }

    // C9
    {
      const r9 = mkR1(path.join(home, 'MindrianRooms', 'r9'), { db: false });
      const c9 = await run(r9, path.join(r9, 'sec', 'a.md'));
      check('C9 no room.db: skipped room_db_missing and room.db is not created',
        c9.skipped === true && c9.skipReason === 'room_db_missing' && c9.graphIndex && c9.graphIndex.status === 'skipped'
          && c9.graphIndex.reason === 'room_db_missing' && !fs.existsSync(path.join(r9, '.mindrian', 'room.db')),
        JSON.stringify({ skipReason: c9.skipReason, graphIndex: c9.graphIndex }));
    }

    // C10
    {
      const r10 = mkR1(path.join(home, 'MindrianRooms', 'r10'), { db: true });
      let h = null;
      try {
        h = await startDbLockHolder(r10);
        const t0 = msNow();
        const c10 = await run(r10, path.join(r10, 'sec', 'a.md'));
        const ms = msNow() - t0;
        check('C10 a held SQLite write transaction gives graphIndex error room_db_busy in less than 2500 ms (measured ' + ms.toFixed(0) + ' ms)',
          c10.graphIndex && c10.graphIndex.status === 'error' && c10.graphIndex.reason === 'room_db_busy' && ms < 2500,
          JSON.stringify(c10.graphIndex));
        // Owner ruling 2026-11-26 (option A): the arm is "busy is reported within 750 ms". The plan's 600 ms wait floor
        // conflicts with BASE code: lazygraph indexArtifact reads inside a deferred BEGIN before its first INSERT, and in
        // WAL mode SQLite returns SQLITE_BUSY at once on that read-to-write upgrade (measured 1-3 ms). BEGIN IMMEDIATE,
        // which would use the busy wait, moves to plan 400.3-06.
        check('C10 busy is reported within 750 ms (measured ' + ms.toFixed(0) + ' ms)', ms <= 750);
      } catch (e) { check('C10 fixture', false, e.message); }
      await stopDbLockHolder(h);
    }
  } finally {
    for (const k of KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  }
}

// ---------------------------------------------------------------------------
// Group hook (the real scripts/post-write)
// ---------------------------------------------------------------------------
function hookEnv(home, extra) {
  const env = Object.assign({}, process.env, {
    HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: path.join(home, 'MindrianRooms'), MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
  }, extra || {});
  for (const k of ['CLAUDE_ACTIVE_ROOM', 'CLAUDE_ROOM_DIR', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID', 'MINDRIAN_MCP_FIRST']) delete env[k];
  return env;
}
function postWrite(filePath, cwd, home, opts) {
  const o = opts || {};
  const t0 = msNow();
  const r = spawnSync('bash', [POST_WRITE], {
    cwd, env: hookEnv(home, o.env),
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath }, session_id: 'sess-4003-02' }),
    encoding: 'utf8', timeout: o.timeout || 120000,
  });
  const ms = msNow() - t0;
  let advisory = null;
  try { advisory = JSON.parse(r.stdout.trim()).hookSpecificOutput.additionalContext; } catch (_e) { advisory = null; }
  if (o.wait !== false) sleep(1500);
  return { status: r.status, stdout: r.stdout, advisory, ms, signal: r.signal };
}
const IDX = (b) => 'post-write: indexed ' + b + ' (index only)';

function groupHook() {
  console.log('\n-- group hook --');
  const jq = spawnSync('bash', ['-c', 'command -v jq'], { encoding: 'utf8' });
  if (jq.status !== 0) { check('hook group needs jq on PATH', false); return Promise.resolve(); }
  const root = mkRoot('hook');
  const home = path.join(root, 'home');
  const MR = path.join(home, 'MindrianRooms');
  fs.mkdirSync(MR, { recursive: true });
  const wincwd = path.join(root, 'wincwd');
  fs.mkdirSync(wincwd, { recursive: true });

  return (async () => {
    // H1
    const r1 = mkR1(path.join(MR, 'r1'), { db: true });
    {
      const h1 = postWrite(path.join(r1, 'sec', 'a.md'), r1, home);
      const side = readSide(r1);
      check('H1 exit 0 and the advisory says indexed (index only)', h1.status === 0 && h1.advisory === IDX('a.md'), JSON.stringify({ status: h1.status, stdout: h1.stdout }));
      check('H1 last-cascade.json: cascade_status indexed, graph_index ok; room.db holds sec/a',
        !!side && side.cascade_status === 'indexed' && side.graph_index && side.graph_index.status === 'ok' && artifactRows(r1, 'sec/a') === 1,
        JSON.stringify(side));
    }

    // H2 (POSIX proxy of a native Windows backslash path)
    if (POSIX) {
      const r2 = mkR1(path.join(wincwd, 'C:', 'Users', 'u', 'MindrianRooms', 'r2'), { db: true });
      const h2 = postWrite('C:\\Users\\u\\MindrianRooms\\r2\\sec\\a.md', wincwd, home);
      const side = readSide(r2);
      check('H2 a backslash path: the bash walk finds the room (skipped record) and detect_room_section got WALK_PATH (minto-queue.json)',
        h2.status === 0 && !!side && side.cascade_status === 'skipped' && fs.existsSync(path.join(r2, '.mindrian', 'minto-queue.json')),
        JSON.stringify({ status: h2.status, side, queue: fs.existsSync(path.join(r2, '.mindrian', 'minto-queue.json')) }));
      // Fix round (coordinator item 1): every advisory names the file by the WALK_PATH basename.
      check('H2 the skipped advisory names a.md, not the whole backslash string', h2.advisory === 'post-write: cascade skipped for a.md', JSON.stringify(h2.advisory));
    } else skip('H2');

    // H3
    if (POSIX) {
      const r3 = mkR1(path.join(wincwd, 'C:', 'Users', 'u', 'MindrianRooms', 'r3'), { db: true });
      const h3 = postWrite('C:/Users/u/MindrianRooms/r3/sec/a.md', wincwd, home);
      check('H3 a forward-slash drive path is indexed', h3.advisory === IDX('a.md') && artifactRows(r3, 'sec/a') === 1, JSON.stringify({ advisory: h3.advisory, rows: artifactRows(r3, 'sec/a') }));
    } else skip('H3');

    // H4
    {
      const pl = path.join(root, 'proj', '.planning');
      fs.mkdirSync(path.join(pl, 'phases', 'x'), { recursive: true });
      fs.writeFileSync(path.join(pl, 'STATE.md'), '# state\n');
      fs.writeFileSync(path.join(pl, 'phases', 'x', 'a.md'), ARTIFACT);
      const h4 = postWrite(path.join(pl, 'phases', 'x', 'a.md'), path.join(root, 'proj'), home);
      const side = readSide(pl);
      check('H4 a .planning folder: cascade skipped, no room.db',
        h4.advisory === 'post-write: cascade skipped for a.md' && !!side && side.cascade_status === 'skipped' && !fs.existsSync(path.join(pl, '.mindrian', 'room.db')),
        JSON.stringify({ advisory: h4.advisory, side }));
    }

    // H5
    {
      fs.writeFileSync(path.join(r1, 'sec', 'd.md'), ARTIFACT);
      let h = null;
      try {
        h = await startWriteLockHolder(r1, 10000);
        const h5 = postWrite(path.join(r1, 'sec', 'd.md'), r1, home);
        const side = readSide(r1);
        // Owner ruling 2026-11-26 (option A): H5 is a KNOWN-OPEN item that plan 400.3-08 (cascade off the foreground) fixes.
        // post-write runs the minto-debouncer enqueue in the foreground with its retry loop, so under a held write.lock the
        // hook takes 10-14 s (unchanged BASE post-write: 10.8 s), past the 5 s hook budget; by the time the index runs the
        // 10 s holder has released the lock, so "indexed" is the true outcome. What this arm still asserts: the advisory and
        // the side-channel record agree (no success word after a failure).
        const agree = h5.status === 0 && !!side && (
          (h5.advisory === 'post-write: indexed d.md (index only)' && side.cascade_status === 'indexed')
          || (h5.advisory === 'post-write: index failed for d.md (index only)' && side.cascade_status === 'index_failed'
            && side.graph_index && side.graph_index.reason === 'write_lock_held'));
        check('H5 a held write.lock: the advisory and the side-channel record agree', agree, JSON.stringify({ advisory: h5.advisory, side }));
        if (h5.ms < 3000) check('H5 spawn wall time under 3000 ms (measured ' + h5.ms.toFixed(0) + ' ms)', h5.ms < 3000 && agree);
        else known('H5 spawn wall time under 3000 ms (measured ' + h5.ms.toFixed(0) + ' ms); fixed by plan 400.3-08');
      } catch (e) { check('H5 fixture', false, e.message); }
      await stopChild(h);
    }

    // H6
    {
      const y = path.join(root, 'rooms', 'y');
      mkR1(y, { roomMd: false });
      const h6 = postWrite(path.join(y, 'sec', 'a.md'), y, home, { env: { MOS_NO_DETACHED_DERIVE: '1' } });
      const side = readSide(y);
      check('H6 a legacy /rooms/ room keeps the full cascade: complete, classification set, queued MINTO advisory',
        h6.status === 0 && !!side && side.cascade_status === 'complete' && side.classification !== null && typeof h6.advisory === 'string' && h6.advisory.indexOf('queued MINTO regen for sec') === 0,
        JSON.stringify({ advisory: h6.advisory, status: side && side.cascade_status, classification: side && side.classification }));
    }

    // H7 timing (D-06)
    {
      const times = [];
      const advs = [];
      for (let i = 0; i < 5; i++) {
        const r = mkR1(path.join(MR, 'h7-' + i), { db: true });
        const res = postWrite(path.join(r, 'sec', 'a.md'), r, home);
        times.push(res.ms);
        advs.push(res.advisory);
      }
      const sorted = times.slice().sort((a, b) => a - b);
      console.log('400.3-02 index-only post-write wall ms (Linux, n=5): p50=' + sorted[2].toFixed(0) + ' max=' + sorted[4].toFixed(0));
      check('H7 max wall time under 2500 ms and every advisory says indexed', sorted[4] < 2500 && advs.every((a) => a === IDX('a.md')), JSON.stringify(advs));
    }

    // H8
    {
      const sa = mkR1(path.join(MR, 'untitled-a'), { state: false, roomMd: false, secRoomMd: false, db: true });
      const h8 = postWrite(path.join(sa, 'sec', 'a.md'), sa, home);
      const side = readSide(sa);
      check('H8 a shell room (no STATE.md) is indexed through the fallback',
        h8.advisory === IDX('a.md') && !!side && side.cascade_status === 'indexed' && artifactRows(sa, 'sec/a') === 1,
        JSON.stringify({ advisory: h8.advisory, side }));
    }

    // H8w
    if (POSIX) {
      const sw = mkR1(path.join(wincwd, 'C:', 'Users', 'u', 'MindrianRooms', 'untitled-w'), { state: false, roomMd: false, secRoomMd: false, db: true });
      const h8w = postWrite('C:/Users/u/MindrianRooms/untitled-w/sec/a.md', wincwd, home);
      check('H8w a shell room on a forward-slash drive path is indexed', h8w.advisory === IDX('a.md') && artifactRows(sw, 'sec/a') === 1, JSON.stringify({ advisory: h8w.advisory }));
    } else skip('H8w');

    // H9
    {
      const sb = mkR1(path.join(root, 'rooms', 'untitled-b'), { state: false, roomMd: false, secRoomMd: false, db: true });
      const h9 = postWrite(path.join(sb, 'sec', 'a.md'), sb, home);
      const side = readSide(sb);
      check('H9 a shell room on a /rooms/ path gets index only: classification and git_commit null',
        h9.advisory === IDX('a.md') && !!side && side.classification === null && side.git_commit === null,
        JSON.stringify({ advisory: h9.advisory, side }));
    }

    // H10
    {
      const r5 = mkR1(path.join(MR, 'r5'), { db: true });
      const sub = path.join(r5, 'sub');
      mkR1(sub, { state: false, roomMd: false, secRoomMd: false, db: true });
      try { fs.rmSync(path.join(r5, '.mindrian', 'last-cascade.json'), { force: true }); } catch (_e) { /* none */ }
      postWrite(path.join(sub, 'sec', 'a.md'), r5, home);
      const side = readSide(sub);
      check('H10 the record is in the room node indexed (sub) and the pending record in r5 is removed',
        !!side && side.cascade_status === 'indexed' && !fs.existsSync(path.join(r5, '.mindrian', 'last-cascade.json')),
        JSON.stringify({ sub: side, r5: readSide(r5) }));
      check('H10 sub room.db holds sec/a and r5 room.db does not', artifactRows(sub, 'sec/a') === 1 && artifactRows(r5, 'sec/a') === 0,
        artifactRows(sub, 'sec/a') + ' / ' + artifactRows(r5, 'sec/a'));
    }

    // H11
    {
      const p2 = path.join(root, 'proj2', 'notes', 'x');
      fs.mkdirSync(p2, { recursive: true });
      fs.writeFileSync(path.join(p2, 'a.md'), ARTIFACT);
      const a = postWrite(path.join(p2, 'a.md'), path.join(root, 'proj2'), home);
      const p3 = path.join(root, 'proj3');
      fs.mkdirSync(path.join(p3, 'sec'), { recursive: true });
      fs.writeFileSync(path.join(p3, '.room-root'), '');
      fs.writeFileSync(path.join(p3, 'sec', 'a.md'), ARTIFACT);
      const b = postWrite(path.join(p3, 'sec', 'a.md'), p3, home);
      check('H11 no marker: exit 0, stdout empty, no .mindrian folder', a.status === 0 && a.stdout === '' && !fs.existsSync(path.join(root, 'proj2', '.mindrian')) && !fs.existsSync(path.join(root, 'proj2', 'notes', '.mindrian')), JSON.stringify(a.stdout));
      check('H11 .room-root only (no room.db): exit 0, stdout empty, no room.db', b.status === 0 && b.stdout === '' && !fs.existsSync(path.join(p3, '.mindrian', 'room.db')), JSON.stringify(b.stdout));
    }

    // H12 (M-1)
    {
      const r12 = mkR1(path.join(MR, 'r12'), { db: true });
      const advs = [];
      for (let i = 0; i < 20; i++) {
        fs.writeFileSync(path.join(r12, 'sec', 't' + i + '.md'), ARTIFACT);
        advs.push(postWrite(path.join(r12, 'sec', 't' + i + '.md'), r12, home, { wait: false }).advisory);
      }
      sleep(2000);
      const bad = advs.map((a, i) => (a === IDX('t' + i + '.md') ? null : i + ':' + a)).filter(Boolean);
      console.log('400.3-02 H12 20 back-to-back Writes: ' + (20 - bad.length) + ' of 20 indexed');
      check('H12 20 back-to-back Writes all report indexed', bad.length === 0, bad.join('; '));
      let rows = 0;
      for (let i = 0; i < 20; i++) rows += artifactRows(r12, 'sec/t' + i);
      check('H12 room.db holds 20 Artifact rows sec/t0 to sec/t19', rows === 20, String(rows));
    }

    // H13 (D-11)
    {
      const rk = mkR1(path.join(MR, 'rk'), { db: true });
      fs.writeFileSync(path.join(rk, 'sec', 'k1.md'), ARTIFACT);
      fs.writeFileSync(path.join(rk, 'sec', 'k2.md'), ARTIFACT);
      const k1 = postWrite(path.join(rk, 'sec', 'k1.md'), rk, home);
      const bin = path.join(root, 'shim-bin');
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(bin, 'node'),
        '#!/bin/sh\ncase "$*" in *cascade*) sleep 10; exit 1;; esac\nexec ' + JSON.stringify(process.execPath) + ' "$@"\n', { mode: 0o755 });
      const k2 = postWrite(path.join(rk, 'sec', 'k2.md'), rk, home, { timeout: 3000, env: { PATH: bin + ':' + process.env.PATH } });
      const side = readSide(rk);
      check('H13 the first Write says indexed', k1.advisory === IDX('k1.md'), JSON.stringify(k1.advisory));
      check('H13 a host kill during the node call leaves a pending record for k2, never indexed',
        !!side && side.cascade_status === 'pending' && typeof side.file_path === 'string' && /k2\.md$/.test(side.file_path),
        JSON.stringify({ signal: k2.signal, side }));
    }

    // H14 (D-10)
    {
      const r9 = mkR1(path.join(MR, 'r9'), { db: false });
      const h14 = postWrite(path.join(r9, 'sec', 'a.md'), r9, home);
      const side = readSide(r9);
      check('H14 no room.db: cascade skipped, graph_index.reason room_db_missing, room.db not created',
        h14.advisory === 'post-write: cascade skipped for a.md' && !!side && side.graph_index && side.graph_index.reason === 'room_db_missing'
          && !fs.existsSync(path.join(r9, '.mindrian', 'room.db')),
        JSON.stringify({ advisory: h14.advisory, side }));
    }

    // H15
    {
      const h15 = postWrite('\\\\?\\C:\\Users\\u\\MindrianRooms\\x\\sec\\a.md', wincwd, home);
      check('H15 the long-path prefix form: exit 0 and stdout empty (stated skip)', h15.status === 0 && h15.stdout === '', JSON.stringify(h15.stdout));
    }

    // H16 (fix round item 1, POSIX proxy): a backslash-form write of a section ROOM.md is a system file. It must not
    // queue a MINTO regen and must not recompile references (BASENAME comes from WALK_PATH).
    if (POSIX) {
      const r16 = mkR1(path.join(wincwd, 'C:', 'Users', 'u', 'MindrianRooms', 'r16'), { db: true });
      const h16 = postWrite('C:\\Users\\u\\MindrianRooms\\r16\\sec\\ROOM.md', wincwd, home);
      const queue = fs.existsSync(path.join(r16, '.mindrian', 'minto-queue.json'));
      const stamps = fs.existsSync(path.join(r16, '.mindrian', 'recompile-stamps.json'));
      check('H16 a backslash ROOM.md write queues no MINTO regen and runs no recompile', h16.status === 0 && !queue && !stamps,
        JSON.stringify({ status: h16.status, queue, stamps, advisory: h16.advisory }));
    } else skip('H16');

    // H17 (fix round item 2, D-11): a host kill while the foreground debouncer waits on a held write.lock leaves a
    // pending record for the new file, never the earlier indexed record.
    {
      const rq = mkR1(path.join(MR, 'rq'), { db: true });
      fs.writeFileSync(path.join(rq, 'sec', 'q1.md'), ARTIFACT);
      fs.writeFileSync(path.join(rq, 'sec', 'q2.md'), ARTIFACT);
      const q1 = postWrite(path.join(rq, 'sec', 'q1.md'), rq, home);
      check('H17 the first Write says indexed', q1.advisory === IDX('q1.md'), JSON.stringify(q1.advisory));
      let h = null;
      try {
        h = await startWriteLockHolder(rq, 20000);
        const q2 = postWrite(path.join(rq, 'sec', 'q2.md'), rq, home, { timeout: 3000 });
        const side = readSide(rq);
        check('H17 a kill during the debouncer wait leaves a pending record for q2, not the earlier indexed record',
          !!side && side.cascade_status === 'pending' && typeof side.file_path === 'string' && /q2\.md$/.test(side.file_path),
          JSON.stringify({ signal: q2.signal, ms: Math.round(q2.ms), side }));
      } catch (e) { check('H17 fixture', false, e.message); }
      await stopChild(h);
    }

    // H5b (fix round item 3): a holder that outlives the foreground debouncer and the index wait reaches the
    // index failed advisory for real.
    {
      fs.writeFileSync(path.join(r1, 'sec', 'd2.md'), ARTIFACT);
      let h = null;
      try {
        h = await startWriteLockHolder(r1, 30000);
        const h5b = postWrite(path.join(r1, 'sec', 'd2.md'), r1, home);
        const side = readSide(r1);
        console.log('400.3-02 H5b post-write under a 30 s write.lock holder: ' + h5b.ms.toFixed(0) + ' ms');
        check('H5b advisory index failed, cascade_status index_failed, reason write_lock_held',
          h5b.status === 0 && h5b.advisory === 'post-write: index failed for d2.md (index only)' && !!side && side.cascade_status === 'index_failed'
            && side.graph_index && side.graph_index.reason === 'write_lock_held',
          JSON.stringify({ advisory: h5b.advisory, side }));
      } catch (e) { check('H5b fixture', false, e.message); }
      await stopChild(h);
    }

    // H18 (fix round item 4): a room folder name with glob characters. detect_room_section strips the room prefix
    // with a quoted pattern, so the shell-room fallback still finds the section.
    {
      const sg = mkR1(path.join(MR, 'shell[x]'), { state: false, roomMd: false, secRoomMd: false, db: true });
      const h18 = postWrite(path.join(sg, 'sec', 'a.md'), sg, home);
      check('H18 a shell room named shell[x] is indexed', h18.advisory === IDX('a.md') && artifactRows(sg, 'sec/a') === 1,
        JSON.stringify({ advisory: h18.advisory, rows: artifactRows(sg, 'sec/a') }));
    }
  })();
}

async function main() {
  if (GROUP === 'unit' || GROUP === 'all') groupUnit();
  if (GROUP === 'cascade' || GROUP === 'all') await groupCascade();
  if (GROUP === 'hook' || GROUP === 'all') await groupHook();
  console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + knownOpen + ' known-open');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
