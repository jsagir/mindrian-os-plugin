#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 01: the MCP artifact_file tool indexes the filed artifact in the room graph and reports
 * the index result honestly.
 *
 * Decisions covered: D-04 (graph_index {ok, reason}, partial on a landed file with a failed leg, no rollback),
 * D-05 tightened and review M-1 (one bounded write.lock backoff, about 750 ms), D-10 and review M-3 (no index
 * call creates or recreates room.db), D-11 (a busy-wait option on the existing opener), review M-8 (one
 * classifier, one word for one failure).
 *
 * Canon Part 8: fixture rooms only, under mkdtemp roots; no network call.
 *
 * Groups:
 *   primitives  P1-P8  write-lock code, acquireLockWithBackoff, openGraph mustExist and busyMs, classifyIndexError
 *   mcp         F1-F8  in-process artifact_file handler (the tests/test-36925-an01.cjs fake-server seam)
 *
 * Usage: node tests/test-400-3-mcp-filing-index.cjs [primitives|mcp|all]   (default all)
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const PHASE_DIR = path.join(ROOT, '.planning', 'phases', '400.3-timeouts-that-lie-hook-budgets-room-db-contention-and-filing');
const WRITE_LOCK_HOLDER = path.join(__dirname, 'helpers', 'write-lock-holder-354.cjs');
const DB_LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');

const GROUP = process.argv[2] || 'all';
if (['primitives', 'mcp', 'all'].indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-mcp-filing-index.cjs [primitives|mcp|all]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}

const ROOTS = [];
function mkRoot(label) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), '4003-01-' + label + '-'));
  ROOTS.push(r);
  return r;
}
process.on('exit', () => {
  for (const r of ROOTS) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});

function msNow() { return Number(process.hrtime.bigint()) / 1e6; }

// ---------------------------------------------------------------------------
// Forked write.lock holder (tests/helpers/write-lock-holder-354.cjs, mode 'hold')
// ---------------------------------------------------------------------------
function startWriteLockHolder(roomDir, holdMs) {
  return new Promise((resolve, reject) => {
    const child = fork(WRITE_LOCK_HOLDER, [roomDir, 'hold', String(holdMs)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    child.on('message', (msg) => {
      if (settled) return;
      if (msg && msg.acquired) { settled = true; resolve({ child, pid: msg.pid }); }
      else if (msg && msg.error) { settled = true; reject(new Error('write-lock holder error: ' + msg.error)); }
    });
    child.on('exit', (code) => { if (!settled) { settled = true; reject(new Error('write-lock holder exited ' + code + ' before acquiring')); } });
  });
}
function stopChild(handle) {
  return new Promise((resolve) => {
    if (!handle || !handle.child || handle.child.exitCode !== null || handle.child.signalCode !== null) return resolve();
    handle.child.once('exit', () => resolve());
    try { handle.child.kill(); } catch (_e) { resolve(); }
  });
}

// ---------------------------------------------------------------------------
// SQLite write-transaction holder (the tests/test-276-busy-timeout-propagation.cjs idiom, copied: test fixtures)
// ---------------------------------------------------------------------------
// Only the identity table, without the lazygraph nodes/edges schema, so openGraph's initSchema has genuine
// new-table write work to contend over.
function seedBareIdentityRoom(roomDir) {
  const dbDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dbDir, { recursive: true });
  const raw = new DatabaseSync(path.join(dbDir, 'room.db'), { timeout: 0 });
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('CREATE TABLE IF NOT EXISTS identity (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)');
  raw.close();
}
function startDbLockHolder(roomDir) {
  return new Promise((resolve, reject) => {
    const child = fork(DB_LOCK_HOLDER, [roomDir], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let settled = false;
    child.on('message', (msg) => { if (msg && msg.ready && !settled) { settled = true; resolve({ child, mode: msg.mode }); } });
    child.on('exit', (code) => {
      if (!settled) { settled = true; reject(new Error('room-db-lock-holder-236 exited with code ' + code + ' before signalling ready')); }
    });
  });
}
function stopDbLockHolder(handle) {
  return new Promise((resolve) => {
    if (!handle || !handle.child) return resolve();
    if (handle.child.exitCode !== null) return resolve();
    handle.child.once('exit', () => resolve());
    try { handle.child.send('release'); } catch (_e) { handle.child.kill(); }
  });
}

// ---------------------------------------------------------------------------
// Group primitives
// ---------------------------------------------------------------------------
async function groupPrimitives() {
  console.log('\n-- group primitives --');
  const writeLock = require(path.join(ROOT, 'lib', 'core', 'write-lock.cjs'));
  const lazygraph = require(path.join(ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
  const graphOps = require(path.join(ROOT, 'lib', 'core', 'graph-ops.cjs'));
  const { acquireLock, releaseLock } = writeLock;
  const acquireLockWithBackoff = writeLock.acquireLockWithBackoff;

  // P1
  {
    const room = path.join(mkRoot('p1'), 'room');
    fs.mkdirSync(room, { recursive: true });
    let h = null;
    try {
      h = await startWriteLockHolder(room, 4000);
      let err = null;
      try { acquireLock(room); } catch (e) { err = e; }
      check('P1 acquireLock under a live holder throws code WRITE_LOCK_HELD with the old message',
        !!err && err.code === 'WRITE_LOCK_HELD' && /^SQLite write lock held by PID/.test(err.message),
        err ? ('code=' + err.code + ' message=' + err.message) : 'no throw');
    } catch (e) { check('P1 fixture', false, e.message); }
    await stopChild(h);
  }

  // P2
  {
    const room = path.join(mkRoot('p2'), 'room');
    fs.mkdirSync(room, { recursive: true });
    let h = null;
    try {
      h = await startWriteLockHolder(room, 8000);
      if (typeof acquireLockWithBackoff !== 'function') throw new Error('acquireLockWithBackoff is not exported');
      const t0 = msNow();
      let err = null;
      try { acquireLockWithBackoff(room, { totalMs: 750 }); } catch (e) { err = e; }
      const ms = msNow() - t0;
      check('P2 acquireLockWithBackoff {totalMs:750} under a held lock throws WRITE_LOCK_HELD after 600-1500 ms (measured ' + ms.toFixed(0) + ' ms)',
        !!err && err.code === 'WRITE_LOCK_HELD' && ms >= 600 && ms <= 1500, err ? err.code : 'no throw');
    } catch (e) { check('P2 fixture', false, e.message); }
    await stopChild(h);
  }

  // P3
  {
    const room = path.join(mkRoot('p3'), 'room');
    fs.mkdirSync(room, { recursive: true });
    let h = null;
    try {
      h = await startWriteLockHolder(room, 300);
      if (typeof acquireLockWithBackoff !== 'function') throw new Error('acquireLockWithBackoff is not exported');
      let handle = null;
      let err = null;
      try { handle = acquireLockWithBackoff(room, { totalMs: 750 }); } catch (e) { err = e; }
      const rel = handle ? releaseLock(room, handle) : null;
      check('P3 acquireLockWithBackoff waits out a 300 ms holder and returns a handle; releaseLock reports released',
        !!handle && !!rel && rel.released === true, err ? err.message : JSON.stringify(rel));
    } catch (e) { check('P3 fixture', false, e.message); }
    await stopChild(h);
  }

  // P4
  {
    const room = path.join(mkRoot('p4'), 'room');
    fs.mkdirSync(room, { recursive: true });
    try {
      if (typeof acquireLockWithBackoff !== 'function') throw new Error('acquireLockWithBackoff is not exported');
      const t0 = msNow();
      const handle = acquireLockWithBackoff(room);
      const ms = msNow() - t0;
      releaseLock(room, handle);
      check('P4 acquireLockWithBackoff on a free room returns a handle at once (measured ' + ms.toFixed(1) + ' ms)', !!handle && ms < 100);
    } catch (e) { check('P4 acquireLockWithBackoff on a free room', false, e.message); }
  }

  // P5
  {
    const r = mkRoot('p5');
    const roomA = path.join(r, 'a');
    const roomB = path.join(r, 'b');
    fs.mkdirSync(roomA); fs.mkdirSync(roomB);
    let err = null;
    try { const g = await lazygraph.openGraph(roomA, { mustExist: true }); await lazygraph.closeGraph(g.db); } catch (e) { err = e; }
    check('P5 openGraph {mustExist:true} on a room with no room.db rejects with code ROOM_DB_MISSING',
      !!err && err.code === 'ROOM_DB_MISSING', err ? err.code : 'resolved');
    check('P5 openGraph {mustExist:true} created no .mindrian folder and no room.db',
      !fs.existsSync(path.join(roomA, '.mindrian')) && !fs.existsSync(path.join(roomA, '.mindrian', 'room.db')));
    let ok = false;
    try { const g = await lazygraph.openGraph(roomB); await lazygraph.closeGraph(g.db); ok = fs.existsSync(path.join(roomB, '.mindrian', 'room.db')); } catch (_e) { ok = false; }
    check('P5 openGraph(room) with no option still creates room.db (old behaviour)', ok);
  }

  // P6
  {
    const room = path.join(mkRoot('p6'), 'room');
    fs.mkdirSync(room, { recursive: true });
    seedBareIdentityRoom(room);
    let h = null;
    try {
      h = await startDbLockHolder(room);
      const t0 = msNow();
      let err = null;
      let res = null;
      try { res = await lazygraph.openGraph(room, { busyMs: 750 }); } catch (e) { err = e; }
      const ms = msNow() - t0;
      if (res && res.db) { try { await lazygraph.closeGraph(res.db); } catch (_e) { /* best effort */ } }
      check('P6 openGraph {busyMs:750} under a held SQLite write transaction rejects after 600-2000 ms (measured ' + ms.toFixed(0) + ' ms)',
        !!err && ms >= 600 && ms < 2000, err ? err.message : 'resolved');
      const cls = typeof graphOps.classifyIndexError === 'function' ? graphOps.classifyIndexError(err) : '(no classifier)';
      check('P6 classifyIndexError of that error returns room_db_busy', cls === 'room_db_busy', cls);
    } catch (e) { check('P6 fixture', false, e.message); }
    await stopDbLockHolder(h);
  }

  // P7
  {
    const c = graphOps.classifyIndexError;
    if (typeof c !== 'function') {
      check('P7 classifyIndexError is exported', false);
    } else {
      const withCode = (code) => { const e = new Error('x'); e.code = code; return e; };
      const withErrcode = (n) => { const e = new Error('some sqlite text'); e.errcode = n; return e; };
      const cases = [
        [withCode('WRITE_LOCK_HELD'), 'write_lock_held'],
        [new Error('SQLite write lock held by PID 123 on host h'), 'write_lock_held'],
        [new Error('SQLite write lock held by PID 123'), 'write_lock_held'],
        [new Error('SQLite write lock could not be acquired after retry (roomDir=/x)'), 'write_lock_held'],
        [withCode('ROOM_DB_MISSING'), 'room_db_missing'],
        [withErrcode(5), 'room_db_busy'],
        [withErrcode(517), 'room_db_busy'],
        [new Error('database is locked'), 'room_db_busy'],
        [new Error('no such table: nodes'), 'index_failed'],
        [null, 'index_failed'],
        ['x', 'index_failed'],
      ];
      let threw = false;
      const bad = [];
      for (const [input, want] of cases) {
        let got;
        try { got = c(input); } catch (_e) { threw = true; got = 'THREW'; }
        if (got !== want) bad.push(String(input && input.message || input) + ' -> ' + got + ' (want ' + want + ')');
      }
      check('P7 classifyIndexError maps every input to its one word and never throws', bad.length === 0 && !threw, bad.join('; '));
      check('P7 INDEX_LOCK_WAIT_MS equals 750', graphOps.INDEX_LOCK_WAIT_MS === 750, String(graphOps.INDEX_LOCK_WAIT_MS));
      const room = path.join(mkRoot('p7'), 'room');
      fs.mkdirSync(path.join(room, 'sec'), { recursive: true });
      const file = path.join(room, 'sec', 'a.md');
      fs.writeFileSync(file, '---\ntitle: a\n---\n\n# A\n\nText.\n');
      let err = null;
      try { await graphOps.indexArtifact(room, file, { mustExist: true }); } catch (e) { err = e; }
      check('P7 indexArtifact {mustExist:true} on a room with no room.db rejects as room_db_missing and creates no room.db',
        !!err && c(err) === 'room_db_missing' && !fs.existsSync(path.join(room, '.mindrian', 'room.db')),
        err ? c(err) + ' ' + err.message : 'resolved');
    }
  }

  // P8: give-up parity of the moved backoff (plan 400.3-01 Task 1 Step 3 acceptance). The old loop of
  // scripts/minto-debouncer.cjs at BASE is extracted and run with the same constants, the same always-held
  // lock and a fixed random; the elapsed give-up times must differ by less than 50 ms. Small constants keep
  // the arm short; the loop logic is the one under test.
  {
    const room = path.join(mkRoot('p8'), 'room');
    fs.mkdirSync(room, { recursive: true });
    let h = null;
    try {
      const base = fs.readFileSync(path.join(PHASE_DIR, '400.3-BASE.txt'), 'utf8').trim();
      const oldSrc = execFileSync('git', ['show', base + ':scripts/minto-debouncer.cjs'], { cwd: ROOT, encoding: 'utf8' });
      const sleepSrc = oldSrc.slice(oldSrc.indexOf('function sleepSync('), oldSrc.indexOf('/**', oldSrc.indexOf('function sleepSync(')));
      const tryStart = oldSrc.indexOf('function tryAcquire(');
      const trySrc = oldSrc.slice(tryStart, oldSrc.indexOf('\n}\n', tryStart) + 2);
      if (sleepSrc.length < 20 || trySrc.length < 20) throw new Error('could not extract the BASE loop');
      const RAND = 0.5;
      const fixedMath = Object.assign(Object.create(Math), { random: () => RAND });
      // eslint-disable-next-line no-new-func
      const oldTryAcquire = new Function('acquireLock', 'Math', 'LOCK_RETRY_MAX_ATTEMPTS', 'LOCK_RETRY_BASE_MS', 'LOCK_RETRY_CAP_MS', 'process',
        sleepSrc + '\n' + trySrc + '\nreturn tryAcquire;')(acquireLock, fixedMath, 6, 25, 200, { stderr: { write() { return true; } } });
      h = await startWriteLockHolder(room, 20000);
      const t0 = msNow();
      const oldResult = oldTryAcquire(room);
      const oldMs = msNow() - t0;
      const t1 = msNow();
      let err = null;
      try { acquireLockWithBackoff(room, { baseMs: 25, capMs: 200, maxAttempts: 6, random: () => RAND }); } catch (e) { err = e; }
      const newMs = msNow() - t1;
      check('P8 give-up time of the BASE loop (' + oldMs.toFixed(0) + ' ms) and of acquireLockWithBackoff (' + newMs.toFixed(0) + ' ms) differ by less than 50 ms',
        oldResult === false && !!err && Math.abs(oldMs - newMs) < 50, 'old=' + oldResult + ' err=' + (err && err.code));
    } catch (e) { check('P8 fixture', false, e.message); }
    await stopChild(h);
  }
}

// ---------------------------------------------------------------------------
// Group mcp (in-process handler, the tests/test-36925-an01.cjs seam)
// ---------------------------------------------------------------------------
function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _d, _s, handler) { tools[name] = handler; },
    registerTool(name, _config, handler) { tools[name] = handler; },
    server: { getClientVersion() { return { name: 'claude-code', version: '2.1.0' }; }, getClientCapabilities() { return {}; } },
  };
}
function parse(res) {
  const text = res && res.content && res.content[0] && res.content[0].text;
  if (!text) return null;
  const marker = text.indexOf('\n\n## Suggested Next');
  try { return JSON.parse(marker === -1 ? text : text.slice(0, marker)); } catch (_e) { return null; }
}
function countArtifactRows(roomDir, id) {
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try { return db.prepare("SELECT id FROM nodes WHERE type = 'Artifact' AND id = ?").all(id).length; }
  finally { db.close(); }
}
function spanFrom(src, startPred, endPred) {
  const lines = src.split('\n');
  const s = lines.findIndex((l, i) => startPred(l, i, lines));
  if (s === -1) return null;
  for (let j = s + 1; j < lines.length; j++) if (endPred(lines[j])) return lines.slice(s, j + 1).join('\n');
  return null;
}
function declaredSpans(src) {
  let seen = 0;
  const a = spanFrom(src,
    (l, i, lines) => { if (l.indexOf('server.registerTool(') === -1) return false; seen += 1; return seen === 2 && /'artifact_file',/.test(lines[i + 1] || ''); },
    (l) => l.indexOf('async ({ section, filename, content, epistemic_type, evidence_node_ids }, extra) => {') !== -1);
  const b = spanFrom(src, (l) => l === 'const connectors = [', (l) => l === '];');
  return { a, b };
}

async function groupMcp() {
  console.log('\n-- group mcp --');
  const H = require('./helpers/isolated-home-36925.cjs');
  const SAVED = {};
  for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_MCP_FIRST', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID']) SAVED[k] = process.env[k];
  const restoreEnv = () => { for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; } };

  try {
    const iso = H.mkIsolatedHome('4003-01');
    const isoMr = Object.assign({}, iso, { roomsHome: path.join(iso.home, 'MindrianRooms') });
    const SLUG = 'f-room';
    const SESSION = 'sess-4003-01';
    const room = H.birthFixtureRoom({ iso: isoMr, slug: SLUG, sessionId: '4003-01-birth' });
    const roomDir = room && room.roomDir;
    const unixish = roomDir ? roomDir.split(path.sep).join('/') : '';
    const pre = !!roomDir && fs.existsSync(roomDir) && unixish.indexOf('/room/') === -1 && unixish.indexOf('/rooms/') === -1
      && roomDir.startsWith(isoMr.roomsHome);
    check('F1 fixture room is born under <home>/MindrianRooms/<slug> with no /room/ or /rooms/ segment', pre,
      'roomDir=' + roomDir + ' (if TMPDIR holds /room/ or /rooms/, set TMPDIR elsewhere)');
    if (!pre) return;
    delete process.env.MINDRIAN_MCP_FIRST;
    delete process.env.CLAUDE_ACTIVE_ROOM;

    const toolRouter = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
    const views = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'views.cjs'));
    const server = makeFakeServer();
    const ctx = { fallbackRoomDir: null, surface: 'cli' };
    toolRouter.registerRouterTools(server, path.join(iso.home, 'boot-fallback'), ROOT, { compact: '' }, 'cli');
    views.register(server, ctx);
    const bound = parse(await server.tools.room_bind({ room: SLUG }, { sessionId: SESSION }));
    check('F1 room_bind binds the session to the fixture room', !!bound && bound.ok === true, JSON.stringify(bound));
    const extra = { sessionId: SESSION };
    const call = async (args) => parse(await server.tools.artifact_file(args, extra));

    // F2, F3
    const f2 = await call({ section: 'problem-definition', filename: 'f2-note', content: '---\ntitle: F2 note\n---\n\n# F2 note\n\nOne prose line for the index.\n' });
    check('F2 artifact_file returns ok true and graph_index {ok:true, reason:indexed, node_id:problem-definition/f2-note} with no partial key',
      !!f2 && f2.ok === true && !!f2.graph_index && f2.graph_index.ok === true && f2.graph_index.reason === 'indexed'
        && f2.graph_index.node_id === 'problem-definition/f2-note' && !Object.prototype.hasOwnProperty.call(f2, 'partial'),
      JSON.stringify(f2 && { ok: f2.ok, graph_index: f2.graph_index, partial: f2.partial, file_path: f2.file_path }));
    let n3 = -1;
    try { n3 = countArtifactRows(roomDir, 'problem-definition/f2-note'); } catch (e) { n3 = -1; }
    check('F3 room.db holds exactly 1 Artifact row problem-definition/f2-note (no manual index)', n3 === 1, String(n3));

    // F4, F5
    let h = null;
    try {
      h = await startWriteLockHolder(roomDir, 8000);
      const t0 = msNow();
      const f4 = await call({ section: 'problem-definition', filename: 'f4-locked', content: '---\ntitle: F4\n---\n\n# F4\n\nLocked filing.\n' });
      const ms = msNow() - t0;
      let lockPid = null;
      try { lockPid = JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'write.lock'), 'utf8')).pid; } catch (_e) { lockPid = null; }
      let n4 = -1;
      try { n4 = countArtifactRows(roomDir, 'problem-definition/f4-locked'); } catch (_e) { n4 = -1; }
      check('F4 under a held write.lock: ok true, partial true, graph_index {ok:false, reason:write_lock_held}',
        !!f4 && f4.ok === true && f4.partial === true && !!f4.graph_index && f4.graph_index.ok === false && f4.graph_index.reason === 'write_lock_held',
        JSON.stringify(f4 && { ok: f4.ok, partial: f4.partial, graph_index: f4.graph_index }));
      check('F4 the filed file exists, no Artifact row exists, and the lock file still names the child PID',
        fs.existsSync(path.join(roomDir, 'problem-definition', 'f4-locked.md')) && n4 === 0 && lockPid === h.pid,
        'exists=' + fs.existsSync(path.join(roomDir, 'problem-definition', 'f4-locked.md')) + ' rows=' + n4 + ' lockPid=' + lockPid + ' child=' + h.pid);
      console.log('F5 measured artifact_file under a held write.lock: ' + ms.toFixed(0) + ' ms');
      check('F5 the F4 call returns in less than 3000 ms (measured ' + ms.toFixed(0) + ' ms)', ms < 3000);
    } catch (e) { check('F4 fixture', false, e.message); }
    await stopChild(h);

    // F6
    const f6 = await call({ section: 'problem-definition', filename: '..', content: 'x' });
    check('F6 a refused filing (invalid_filename) carries no graph_index key and no partial key',
      !!f6 && f6.ok === false && f6.reason === 'invalid_filename' && !Object.prototype.hasOwnProperty.call(f6, 'graph_index')
        && !Object.prototype.hasOwnProperty.call(f6, 'partial'), JSON.stringify(f6));

    // F7
    try {
      const base = fs.readFileSync(path.join(PHASE_DIR, '400.3-BASE.txt'), 'utf8').trim();
      const oldSrc = execFileSync('git', ['show', base + ':lib/mcp/tools/views.cjs'], { cwd: ROOT, encoding: 'utf8' });
      const newSrc = fs.readFileSync(path.join(ROOT, 'lib', 'mcp', 'tools', 'views.cjs'), 'utf8');
      const o = declaredSpans(oldSrc);
      const n = declaredSpans(newSrc);
      check('F7 the artifact_file registration span is byte-unchanged against BASE', !!o.a && o.a === n.a, 'old=' + !!o.a + ' new=' + !!n.a);
      check('F7 the connectors array is byte-unchanged against BASE', !!o.b && o.b === n.b, 'old=' + !!o.b + ' new=' + !!n.b);
    } catch (e) { check('F7 declared shape', false, e.message); }

    // F8
    const f8 = await call({ section: 'problem-definition', filename: 'f8-bad-type', content: '---\ntitle: f8\n---\n\n# F8\n\nA refused node.\n', epistemic_type: 'not-a-real-type' });
    check('F8 a refused reasoning node gives ok true, reasoning_node.ok false, partial true, graph_index.ok true',
      !!f8 && f8.ok === true && !!f8.reasoning_node && f8.reasoning_node.ok === false && f8.partial === true && !!f8.graph_index && f8.graph_index.ok === true,
      JSON.stringify(f8 && { ok: f8.ok, partial: f8.partial, reasoning_node: f8.reasoning_node, graph_index: f8.graph_index }));
  } finally {
    restoreEnv();
  }
}

async function main() {
  if (GROUP === 'primitives' || GROUP === 'all') await groupPrimitives();
  if (GROUP === 'mcp' || GROUP === 'all') await groupMcp();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
