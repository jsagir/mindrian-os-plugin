#!/usr/bin/env node
'use strict';

/*
 * tests/test-367-catchup-cli.cjs -- Phase 367 plans 05 and 06.
 *
 * The detached catch-up runner scripts/graph-catchup.cjs (design 5.2): the
 * room set, the room.db guard, the job lock, the status file, the files leg
 * (cache, cursor, batches, budget) on the Phase 400.3-01 primitives
 * (openGraph mustExist and busyMs, write-lock acquireLockWithBackoff,
 * graph-ops INDEX_LOCK_WAIT_MS and classifyIndexError).
 *
 * Groups (argv[2]): unit (U1-U11), ac3 (AC3), ac5 (AC5), ac10 (AC10), all.
 * Plan 367-06 adds ac1 (AC1) and ac8hook (AC8).
 *
 * Polling rule (design section 10): a detached run is polled until its
 * status file leaves running, cap 30 s.
 *
 * Canon Part 8: fixture rooms under os.tmpdir() with an isolated HOME and
 * MINDRIAN_ROOMS_HOME. No network, no Brain. tests/ is on
 * scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync, fork } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RUNNER = path.join(REPO, 'scripts', 'graph-catchup.cjs');
const LG_PATH = path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs');
const CA_PATH = path.join(REPO, 'lib', 'core', 'content-artifacts.cjs');
const WL_HOLDER = path.join(REPO, 'tests', 'helpers', 'write-lock-holder-354.cjs');

const STATUS_FIELDS = ['schema', 'state', 'reason', 'run_id', 'trigger', 'started_at', 'last_run_at',
  'files_seen', 'files_indexed', 'files_vanished', 'files_failed', 'id_collisions', 'cards_recorded',
  'cards_rejected', 'cards_skipped', 'cards_failed', 'remaining'];
const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ---------------------------------------------------------------- harness

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}

const ROOTS = [];
process.on('exit', () => {
  for (const r of ROOTS) {
    try { fs.chmodSync(r, 0o700); } catch (_e) { /* ignore */ }
    try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

function mkTmp(label) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-367-05-' + label + '-'));
  ROOTS.push(r);
  return r;
}

// An isolated HOME and MINDRIAN_ROOMS_HOME per group.
function mkHome(label) {
  const home = mkTmp(label + '-home');
  const roomsHome = path.join(home, 'MindrianRooms');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  return { home, roomsHome };
}

function writeRegistry(roomsHome, reg) {
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify(reg));
}

function baseEnv(h, extra) {
  const e = Object.assign({}, process.env);
  for (const k of ['CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MOS_NO_GRAPH_CATCHUP', 'MOS_GRAPH_CATCHUP_HOLD_MS']) delete e[k];
  e.HOME = h.home;
  e.USERPROFILE = h.home;
  e.MINDRIAN_ROOMS_HOME = h.roomsHome;
  return Object.assign(e, extra || {});
}

function put(room, rel, body) {
  const abs = path.join(room, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body == null ? '# ' + rel + '\n\nbody of ' + rel + '\n' : body);
  return abs;
}

// A fixture room: .room-root, section files, and a room.db made by lazygraph openGraph.
async function mkRoom(label, files, opts) {
  const room = mkTmp(label);
  fs.writeFileSync(path.join(room, '.room-root'), '');
  for (const rel of (files || [])) put(room, rel);
  if (!opts || opts.db !== false) {
    const lg = require(LG_PATH);
    const { db } = await lg.openGraph(room);
    await lg.closeGraph(db);
  }
  return room;
}

function statusPath(room) { return path.join(room, '.mindrian', 'graph-catchup.json'); }
function cachePath(room) { return path.join(room, '.mindrian', 'graph-catchup-cache.json'); }
function lockPath(room) { return path.join(room, '.mindrian', 'graph-catchup.lock'); }

function readStatus(room) {
  try { return JSON.parse(fs.readFileSync(statusPath(room), 'utf8')); } catch (_e) { return null; }
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; }
}

function runRunner(args, env, execArgv, timeoutMs) {
  const r = spawnSync(process.execPath, [...(execArgv || []), RUNNER, ...args], {
    env, encoding: 'utf8', timeout: timeoutMs || 60000,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

function runRunnerAsync(args, env, execArgv) {
  const child = spawn(process.execPath, [...(execArgv || []), RUNNER, ...args], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += String(d); });
  const done = new Promise((resolve) => child.on('exit', (code) => resolve({ status: code, stderr })));
  return { child, done };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function pollStatus(room, pred, capMs) {
  const end = Date.now() + (capMs || 30000);
  for (;;) {
    const s = readStatus(room);
    if (s && pred(s)) return s;
    if (Date.now() > end) return s;
    await sleep(50);
  }
}

async function artifactIds(room) {
  const lg = require(LG_PATH);
  const { db } = await lg.openGraph(room, { mustExist: true });
  try {
    return db.prepare("SELECT id FROM nodes WHERE type = 'Artifact'").all().map((r) => r.id);
  } finally {
    await lg.closeGraph(db);
  }
}

function listingIds(room) {
  return require(CA_PATH).listContentArtifacts(room).files.map((f) => f.id);
}

function sameSet(a, b) {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return JSON.stringify(x) === JSON.stringify(y);
}

// ---------------------------------------------------------------- group unit

async function groupUnit() {
  // U1 kill switch.
  {
    const h = mkHome('u1');
    const room = await mkRoom('u1', ['problem-definition/a.md']);
    const r = runRunner(['--cwd', room, '--trigger', 'stop'], baseEnv(h, { MOS_NO_GRAPH_CATCHUP: '1' }));
    check('U1 kill switch exits 0', r.status === 0, r.status + ' ' + r.stderr);
    check('U1 no status file', !fs.existsSync(statusPath(room)));
    check('U1 no lock file', !fs.existsSync(lockPath(room)));
  }

  // U2 room guard: .room-root and no room.db.
  {
    const h = mkHome('u2');
    const room = await mkRoom('u2', ['problem-definition/a.md'], { db: false });
    const r = runRunner(['--cwd', room, '--trigger', 'stop'], baseEnv(h));
    check('U2 exits 0', r.status === 0, r.status + ' ' + r.stderr);
    check('U2 no .mindrian folder after the run', !fs.existsSync(path.join(room, '.mindrian')));
    check('U2 stderr holds room_db_missing', /room_db_missing/.test(r.stderr), r.stderr);
    const room2 = await mkRoom('u2b', ['problem-definition/a.md'], { db: false });
    fs.mkdirSync(path.join(room2, '.mindrian'));
    fs.writeFileSync(path.join(room2, '.mindrian', 'keep.txt'), 'x');
    const before = fs.readdirSync(path.join(room2, '.mindrian')).sort().join(',');
    const r2 = runRunner(['--cwd', room2, '--trigger', 'stop'], baseEnv(h));
    const after = fs.readdirSync(path.join(room2, '.mindrian')).sort().join(',');
    check('U2 an existing .mindrian listing is unchanged', r2.status === 0 && before === after, before + ' -> ' + after);
  }

  // U3 room set: cwd room, --room with .room-root, registry active room; a bad --room; a duplicate.
  {
    const h = mkHome('u3');
    const A = await mkRoom('u3-a', ['problem-definition/a.md']);
    const B = await mkRoom('u3-b', ['problem-definition/b.md']);
    const C = await mkRoom('u3-c', ['problem-definition/c.md']);
    const D = await mkRoom('u3-d', ['problem-definition/d.md']);
    fs.unlinkSync(path.join(D, '.room-root')); // room.db, but no .room-root and no registry entry
    const linkDir = mkTmp('u3-link');
    const aLink = path.join(linkDir, 'a-link');
    fs.symlinkSync(A, aLink, 'dir');
    const E = await mkRoom('u3-e', ['problem-definition/e.md']);
    fs.unlinkSync(path.join(E, '.room-root')); // no .room-root, but a registered room
    writeRegistry(h.roomsHome, { active: 'c', rooms: { c: { abs_path: C }, e: { abs_path: E } } });
    const env = baseEnv(h);
    const args = ['--cwd', path.join(A, 'problem-definition'), '--trigger', 'stop', '--room', B, '--room', D, '--room', aLink, '--room', E];
    const r = runRunner(args, env);
    check('U3 exits 0', r.status === 0, r.status + ' ' + r.stderr);
    check('U3 cwd room A has a status', readStatus(A) && readStatus(A).state === 'complete', JSON.stringify(readStatus(A)));
    check('U3 --room B has a status', readStatus(B) && readStatus(B).state === 'complete', JSON.stringify(readStatus(B)));
    check('U3 registry room C has a status', readStatus(C) && readStatus(C).state === 'complete', JSON.stringify(readStatus(C)));
    check('U3 --room D (no .room-root, not registered) gets nothing', !fs.existsSync(statusPath(D)) && !fs.existsSync(lockPath(D)));
    check('U3 --room E (registered, no .room-root) has a status', readStatus(E) && readStatus(E).state === 'complete', JSON.stringify(readStatus(E)));
    const code = 'const g=require(' + JSON.stringify(RUNNER) + ');' +
      'g.run(g.parseArgs(' + JSON.stringify(args) + ')).then(function(r){process.stdout.write(JSON.stringify(r.map(function(x){return x.room;})));});';
    const c = spawnSync(process.execPath, ['-e', code], { env, encoding: 'utf8', timeout: 60000 });
    let rooms = [];
    try { rooms = JSON.parse(c.stdout); } catch (_e) { rooms = []; }
    const realA = fs.realpathSync(A);
    check('U3 the duplicate (A by a symlink) runs once', rooms.filter((x) => x === realA).length === 1 && rooms.length === 4,
      JSON.stringify(rooms) + ' ' + c.stderr);
    check('U3 order: cwd room, --room values, registry room',
      JSON.stringify(rooms) === JSON.stringify([realA, fs.realpathSync(B), fs.realpathSync(E), fs.realpathSync(C)]), JSON.stringify(rooms));
  }

  // U4 a second runner while the first holds the job lock.
  {
    const h = mkHome('u4');
    const room = await mkRoom('u4', ['problem-definition/a.md']);
    const env = baseEnv(h);
    const first = runRunnerAsync(['--cwd', room, '--trigger', 'stop', '--hold-ms', '3000'], env);
    const running = await pollStatus(room, (s) => s.state === 'running', 30000);
    check('U4 the first run is running', running && running.state === 'running', JSON.stringify(running));
    const r = runRunner(['--cwd', room, '--trigger', 'stop'], env);
    const mid = readStatus(room);
    check('U4 the second runner exits 0', r.status === 0, r.status + ' ' + r.stderr);
    check('U4 the first status is untouched', mid && running && mid.run_id === running.run_id && mid.state === 'running', JSON.stringify(mid));
    const fin = await first.done;
    const end = readStatus(room);
    check('U4 the first run ends complete', fin.status === 0 && end && end.run_id === running.run_id && end.state === 'complete', JSON.stringify(end));
  }

  // U5 the final status file.
  {
    const h = mkHome('u5');
    const room = await mkRoom('u5', ['problem-definition/a.md', 'problem-definition/b.md']);
    const r = runRunner(['--cwd', room, '--trigger', 'session_start'], baseEnv(h));
    const s = readStatus(room);
    check('U5 exits 0', r.status === 0, r.status + ' ' + r.stderr);
    let mode = null;
    try { mode = fs.statSync(statusPath(room)).mode & 0o777; } catch (_e) { mode = null; }
    if (process.platform !== 'win32') check('U5 mode 0600', mode === 0o600, mode === null ? 'none' : mode.toString(8));
    check('U5 every field of design 5.2 step 10', s && STATUS_FIELDS.every((k) => k in s), s ? STATUS_FIELDS.filter((k) => !(k in s)).join(',') : 'no status');
    check('U5 schema 1, state complete, trigger session_start', s && s.schema === 1 && s.state === 'complete' && s.trigger === 'session_start', JSON.stringify(s));
    check('U5 ISO 8601 times with ms', s && ISO_MS.test(s.started_at) && ISO_MS.test(s.last_run_at), s && (s.started_at + ' ' + s.last_run_at));
  }

  // U6 require-safety.
  {
    const h = mkHome('u6');
    const room = await mkRoom('u6', ['problem-definition/a.md']);
    const code = 'const g=require(' + JSON.stringify(RUNNER) + ');' +
      "process.stdout.write(typeof g.run + ',' + typeof g.parseArgs);";
    const c = spawnSync(process.execPath, ['-e', code, '--', '--cwd', room, '--trigger', 'stop'], { env: baseEnv(h), cwd: room, encoding: 'utf8', timeout: 30000 });
    await sleep(300);
    check('U6 require exposes run and parseArgs', c.status === 0 && c.stdout === 'function,function', c.stdout + ' ' + c.stderr);
    check('U6 require runs nothing (no status file)', !fs.existsSync(statusPath(room)));
  }

  // U7 the drain still re-exports the moved functions.
  {
    const code = "const d=require(" + JSON.stringify(path.join(REPO, 'scripts', 'gsd-graph-derive-drain.cjs')) + ")._test," +
      "b=require(" + JSON.stringify(path.join(REPO, 'lib', 'core', 'bg-worker.cjs')) + ");" +
      "process.stdout.write(String(d.lowerWorkerPriority===b.lowerWorkerPriority&&d.armBackstop===b.armBackstop));";
    const c = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 30000 });
    check('U7 drain _test re-exports lowerWorkerPriority and armBackstop from bg-worker.cjs', c.stdout === 'true', c.stdout + ' ' + c.stderr);
  }

  // UNIT2_SLOT: Task 2 adds U8-U11.
}

// GROUPS_SLOT: Task 2 adds ac3, ac5 and ac10.

// ---------------------------------------------------------------- main

const GROUPS = { unit: groupUnit };

async function main() {
  const group = process.argv[2] || 'all';
  console.log('test-367-catchup-cli (Phase 367 plans 05 and 06) group ' + group);
  const names = group === 'all' ? Object.keys(GROUPS) : [group];
  for (const n of names) {
    if (!GROUPS[n]) { check('known group ' + n, false); continue; }
    await GROUPS[n]();
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.log('FAIL: FATAL :: ' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
