#!/usr/bin/env node
'use strict';
/*
 * Quick 261005-l9o -- rooms work on stock macOS (Python 3.9) and name the error
 * on Windows / no-python3 machines (SEED-117; Phase 0 ids CODE-01, SW-01, SW-02,
 * SW-20, ACT-04, HARNESS-06).
 *
 * WHY THIS TEST EXISTS. scripts/room-registry (create, set-active),
 * scripts/resolve-room (--adopt) and scripts/on-cwd-changed called a Python
 * 3.11-only alias for UTC, so on the macOS default Python 3.9 no room could be
 * created or switched. lib/core/room-open.cjs swallowed the child's stderr, so
 * the tester saw only `set_active_failed`. birthRoom tolerated a failed registry
 * flip and reported ok:true for a room the registry never heard of.
 *
 * Arms:
 *   R1 static       no 3.11-only Python API in the shipped scripts
 *   R2 runtime 3.9  create / set-active / get-active exit 0 and stamp the registry
 *   R3 stderr       the failure payload carries the child stderr + python version
 *   R4 birthRoom    registry listed under 3.9; a registry failure rolls back
 *   R5 scaffold     scaffoldRoomSkeleton says ready:false / room_db:false
 *   R6 doctrine     agents stop on a failed create (never hand-build a room)
 *   R7 doctor       a python-floor acceptance point
 *   R8 dash guard   no em/en dash in the text this task added
 *   R9 changelog    the Unreleased entry exists
 *
 * Python 3.9 resolution: `python3.9` on PATH, else $MINDRIAN_TEST_PYTHON39, else
 * /home/jsagi/.local/bin/python3.9. None found => the runtime 3.9 arms print
 * `SKIP python39: <reason>`; the static arms still run.
 *
 * Every runtime arm uses an isolated HOME + MINDRIAN_ROOMS_HOME under the OS
 * temp dir; nothing here touches ~/MindrianRooms or ~/.mindrian.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'scripts', 'room-registry');
const RESOLVE_ROOM = path.join(ROOT, 'scripts', 'resolve-room');
const MARK = 'L9O_JSON=';
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

// ---------------------------------------------------------------------------
// Child mode: runs inside an env-controlled subprocess so PATH is exactly the
// shim the arm built. `node this-file --child <kind> <json-args>`.
// ---------------------------------------------------------------------------
if (process.argv[2] === '--child') {
  const kind = process.argv[3];
  const a = JSON.parse(process.argv[4] || '{}');
  let out;
  if (kind === 'openroom') {
    out = require(path.join(ROOT, 'lib', 'core', 'room-open.cjs')).openRoom({ room: a.room, home: a.home });
  } else if (kind === 'birth') {
    const nav = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
    const ret = nav.birthRoom({
      slug: a.slug, roomDir: a.roomDir, approvedBy: 'l9o', ventureText: 'generic venture',
      jtbd: 'generic', blueprintFamily: 'venture', sessionId: 'l9o-sess',
    });
    out = { ret: ret, dirExists: fs.existsSync(a.roomDir),
      dbExists: fs.existsSync(path.join(a.roomDir, '.mindrian', 'room.db')) };
    if (out.dbExists) {
      const db = nav.openRoomDbForCaller(a.roomDir);
      if (db) {
        try {
          out.nodeCount = db.prepare('select count(*) as c from nodes').get().c;
          out.governedWrite = nav.logMemoryEvent(db, 'node_created', { label: 'l9o-probe' });
        } finally { nav.closeRoomDbForCaller(db); }
      }
    }
  } else {
    out = { error: 'unknown child kind ' + kind };
  }
  process.stdout.write('\n' + MARK + JSON.stringify(out) + '\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Tiny harness
// ---------------------------------------------------------------------------
let passed = 0, failed = 0, skipped = 0;
class Skip extends Error {}
function arm(name, fn) {
  try {
    fn();
    passed += 1; console.log('PASS: ' + name);
  } catch (e) {
    if (e instanceof Skip) { skipped += 1; console.log('SKIP ' + name + ': ' + e.message); return; }
    failed += 1; console.log('FAIL: ' + name + '\n    ' + String(e && e.message || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }

const TMP_ROOTS = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'l9o-' + prefix + '-'));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP_ROOTS) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});

function findPython39() {
  const cands = [];
  const which = cp.spawnSync('sh', ['-c', 'command -v python3.9'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) cands.push(which.stdout.trim());
  if (process.env.MINDRIAN_TEST_PYTHON39) cands.push(process.env.MINDRIAN_TEST_PYTHON39);
  cands.push('/home/jsagi/.local/bin/python3.9');
  for (const c of cands) {
    if (!fs.existsSync(c)) continue;
    const v = cp.spawnSync(c, ['--version'], { encoding: 'utf8' });
    const txt = (v.stdout || '') + (v.stderr || '');
    if (v.status === 0 && /Python 3\.9\./.test(txt)) return c;
  }
  return null;
}
const PY39 = findPython39();
const SKIP39 = 'no python3.9 on PATH, $MINDRIAN_TEST_PYTHON39 or /home/jsagi/.local/bin/python3.9';

// A PATH dir whose `python3` is the 3.9 binary.
function shim39() {
  const d = mk('py39bin');
  fs.symlinkSync(PY39, path.join(d, 'python3'));
  return d;
}
// A PATH dir whose `python3` always fails with "boom" (but answers --version).
function shimBoom() {
  const d = mk('boombin');
  const p = path.join(d, 'python3');
  fs.writeFileSync(p, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "Python 9.9.9"; exit 0; fi\necho boom >&2\nexit 1\n');
  fs.chmodSync(p, 0o755);
  return d;
}
// A PATH dir with the system tools but no python at all, plus node.
function shimNoPython() {
  const d = mk('nopybin');
  for (const dir of ['/usr/bin', '/bin']) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/^(python|pydoc)/.test(f)) continue;
      const target = path.join(d, f);
      if (fs.existsSync(target)) continue;
      try { fs.symlinkSync(path.join(dir, f), target); } catch (_e) { /* skip */ }
    }
  }
  const node = path.join(d, 'node');
  try { fs.rmSync(node, { force: true }); } catch (_e) { /* none */ }
  fs.symlinkSync(process.execPath, node);
  if (!fs.existsSync(path.join(d, 'bash'))) throw new Skip('no bash under /usr/bin or /bin to build the no-python3 PATH');
  return d;
}

function freshHome() {
  const home = mk('home');
  const roomsHome = path.join(home, 'MindrianRooms');
  fs.mkdirSync(roomsHome, { recursive: true });
  return { home, roomsHome };
}
function envFor(h, shimDir) {
  const env = Object.assign({}, process.env, { HOME: h.home, USERPROFILE: h.home, MINDRIAN_ROOMS_HOME: h.roomsHome });
  delete env.CLAUDE_CODE_SESSION_ID; delete env.CLAUDE_PID;
  delete env.MINDRIAN_ACTIVE_SESSION_ID; delete env.MINDRIAN_ACTIVE_SESSION_PID;
  if (shimDir) env.PATH = shimDir + path.delimiter + process.env.PATH;
  return env;
}
function bash(script, args, env, cwd) {
  return cp.spawnSync('bash', [script].concat(args), { env: env, cwd: cwd || ROOT, encoding: 'utf8', timeout: 60000 });
}
function child(kind, args, env) {
  const r = cp.spawnSync(process.execPath, [__filename, '--child', kind, JSON.stringify(args)],
    { env: env, cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  const line = (r.stdout || '').split('\n').reverse().find((l) => l.startsWith(MARK));
  if (!line) throw new Error('child ' + kind + ' printed no result; exit=' + r.status + ' stderr=' + (r.stderr || '').slice(-400));
  return JSON.parse(line.slice(MARK.length));
}
function readReg(h) {
  return JSON.parse(fs.readFileSync(path.join(h.roomsHome, '.rooms', 'registry.json'), 'utf8'));
}

// ---------------------------------------------------------------------------
// R1 static: no 3.11-only Python API in the shipped scripts
// ---------------------------------------------------------------------------
function walk(dir, hits, re) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, hits, re); continue; }
    if (!e.isFile()) continue;
    let st; try { st = fs.statSync(p); } catch (_e) { continue; }
    if (st.size > 3 * 1024 * 1024) continue;
    let buf; try { buf = fs.readFileSync(p); } catch (_e) { continue; }
    if (buf.includes(0)) continue;
    const lines = buf.toString('utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) hits.push(path.relative(ROOT, p) + ':' + (i + 1) + ': ' + lines[i].trim().slice(0, 120));
    }
  }
}
arm('R1a no datetime.UTC anywhere in scripts hooks lib bin', () => {
  const hits = [];
  const re = new RegExp('datetime' + '\\.' + 'UTC');
  for (const d of ['scripts', 'hooks', 'lib', 'bin']) walk(path.join(ROOT, d), hits, re);
  check(hits.length === 0, hits.length + ' hit(s):\n' + hits.join('\n'));
});
arm('R1b no tomllib / ExceptionGroup / match-statement in the three Python-bearing scripts', () => {
  const hits = [];
  const re = new RegExp('\\btomll' + 'ib\\b|Exception' + 'Group|\\bmatch .*:$');
  for (const f of ['room-registry', 'resolve-room', 'on-cwd-changed']) {
    const lines = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8').split('\n');
    lines.forEach((l, i) => { if (re.test(l)) hits.push(f + ':' + (i + 1) + ': ' + l.trim().slice(0, 120)); });
  }
  check(hits.length === 0, hits.length + ' hit(s):\n' + hits.join('\n'));
});

// ---------------------------------------------------------------------------
// R2 runtime: create / set-active / get-active exit 0 and stamp ISO-Z fields
// ---------------------------------------------------------------------------
function r2(label, shimDir) {
  const h = freshHome();
  const env = envFor(h, shimDir);
  const dir = path.join(h.roomsHome, 'r1');
  fs.mkdirSync(dir, { recursive: true });
  const create = bash(REGISTRY, ['create', 'r1', dir, 'R1', 'idea'], env);
  check(create.status === 0, label + ' create exit ' + create.status + ': ' + (create.stderr || '').slice(-300));
  const set = bash(REGISTRY, ['set-active', 'r1'], env);
  check(set.status === 0, label + ' set-active exit ' + set.status + ': ' + (set.stderr || '').slice(-300));
  const get = bash(REGISTRY, ['get-active'], env);
  check(get.status === 0, label + ' get-active exit ' + get.status);
  check(get.stdout.trim() === 'r1', label + ' get-active printed ' + JSON.stringify(get.stdout.trim()));
  const entry = readReg(h).rooms.r1;
  check(entry && /Z$/.test(entry.last_opened || '') && /Z$/.test(entry.created || ''),
    label + ' registry stamps are not ISO-Z strings: ' + JSON.stringify(entry));
}
arm('R2 runtime python3.9: create / set-active / get-active', () => {
  if (!PY39) throw new Skip(SKIP39);
  r2('py39', shim39());
});
arm('R2 runtime system python3 (control): create / set-active / get-active', () => { r2('system', null); });
arm('R2 runtime python3.9: resolve-room --adopt writes the registry', () => {
  if (!PY39) throw new Skip(SKIP39);
  const w = mk('adopt');
  fs.mkdirSync(path.join(w, 'room'));
  const env = Object.assign({}, process.env, { HOME: w, USERPROFILE: w, MINDRIAN_ROOMS_HOME: path.join(w, 'none') });
  env.PATH = shim39() + path.delimiter + process.env.PATH;
  const r = bash(RESOLVE_ROOM, [w, '--adopt'], env);
  check(r.status === 0, 'resolve-room --adopt exit ' + r.status + ': ' + (r.stderr || '').slice(-300));
  check(fs.existsSync(path.join(w, '.rooms', 'registry.json')), 'no registry written by --adopt');
});

// ---------------------------------------------------------------------------
// R3 stderr surfaced in the openRoom failure payload
// ---------------------------------------------------------------------------
function seedAB(h) {
  const env = envFor(h, null);
  for (const s of ['a', 'b']) {
    const d = path.join(h.roomsHome, s);
    fs.mkdirSync(d, { recursive: true });
    const r = bash(REGISTRY, ['create', s, d, s.toUpperCase(), 'idea'], env);
    check(r.status === 0, 'seed create ' + s + ' exit ' + r.status + ': ' + (r.stderr || '').slice(-200));
  }
}
arm('R3 no python3 on PATH: openRoom fails with a stderr line naming python3', () => {
  const h = freshHome();
  seedAB(h);
  const nopy = shimNoPython();
  const env = { PATH: nopy, HOME: h.home, MINDRIAN_ROOMS_HOME: h.roomsHome };
  const out = child('openroom', { room: 'a', home: h.roomsHome }, env);
  check(out.ok === false && out.reason === 'set_active_failed', 'payload ' + JSON.stringify(out));
  check(typeof out.stderr === 'string' && out.stderr.length > 0, 'no stderr in the failure payload: ' + JSON.stringify(out));
  check(/python3/.test(out.stderr), 'stderr does not name python3: ' + JSON.stringify(out.stderr));
  check(typeof out.python === 'string' && out.python.length > 0, 'no python field: ' + JSON.stringify(out));
});
arm('R3 failing python3: openRoom failure carries the child stderr and the python version', () => {
  const h = freshHome();
  seedAB(h);
  const env = envFor(h, shimBoom());
  const out = child('openroom', { room: 'a', home: h.roomsHome }, env);
  check(out.ok === false && out.reason === 'set_active_failed', 'payload ' + JSON.stringify(out));
  check(typeof out.stderr === 'string' && /boom/.test(out.stderr), 'stderr missing the child text: ' + JSON.stringify(out));
  check(typeof out.python === 'string' && /Python 9\.9\.9/.test(out.python), 'python version missing: ' + JSON.stringify(out));
});
arm('R3 MCP rooms-open text shows the stderr tail and the python line', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');
  check(/result\.stderr/.test(src) && /result\.python/.test(src), 'tool-router rooms-open failure branch does not read result.stderr / result.python');
});

// ---------------------------------------------------------------------------
// R4 birthRoom: registry listed under 3.9; a registry failure rolls back
// ---------------------------------------------------------------------------
arm('R4 birthRoom under python3.9: db reads back, registry lists the room, governed write ok', () => {
  if (!PY39) throw new Skip(SKIP39);
  const h = freshHome();
  const sd = shim39();
  const env = envFor(h, sd);
  const roomDir = path.join(h.roomsHome, 'r4');
  const out = child('birth', { slug: 'r4', roomDir: roomDir }, env);
  check(out.ret && out.ret.ok === true, 'birthRoom did not return ok:true: ' + JSON.stringify(out.ret));
  check(out.dbExists === true, '.mindrian/room.db missing');
  check(typeof out.nodeCount === 'number', 'room.db did not read back (select count(*) from nodes)');
  check(out.governedWrite && out.governedWrite.ok === true, 'governed write: ' + JSON.stringify(out.governedWrite));
  const list = bash(REGISTRY, ['list'], env);
  check(list.status === 0 && /r4/.test(list.stdout), 'room-registry list does not name r4: ' + JSON.stringify(list.stdout.slice(0, 200)));
  check(readReg(h).rooms && readReg(h).rooms.r4, 'registry.json has no r4 entry');
});
arm('R4 birthRoom with a failing registry: ok:false, reason, stderr, directory rolled back', () => {
  const h = freshHome();
  const env = envFor(h, shimBoom());
  const roomDir = path.join(h.roomsHome, 'r4b');
  const out = child('birth', { slug: 'r4b', roomDir: roomDir }, env);
  const r = out.ret || {};
  check(r.ok === false, 'birthRoom did not return ok:false: ' + JSON.stringify(r));
  check(typeof r.reason === 'string' && r.reason.indexOf('registry_create_failed') === 0, 'reason: ' + JSON.stringify(r.reason));
  check(typeof r.stderr === 'string' && /boom/.test(r.stderr), 'stderr missing the child text: ' + JSON.stringify(r.stderr));
  check(out.dirExists === false && !fs.existsSync(roomDir), 'room directory left behind after the failed registry create: ' + roomDir);
});
arm('R4 birthRoom over a PRE-EXISTING directory never deletes it on registry failure', () => {
  const h = freshHome();
  const env = envFor(h, shimBoom());
  const roomDir = path.join(h.roomsHome, 'r4c');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'keep-me.txt'), 'user data');
  const out = child('birth', { slug: 'r4c', roomDir: roomDir }, env);
  check(out.ret && out.ret.ok === false, 'birthRoom did not return ok:false: ' + JSON.stringify(out.ret));
  check(fs.existsSync(path.join(roomDir, 'keep-me.txt')), 'a pre-existing user file was deleted by the rollback');
});

// ---------------------------------------------------------------------------
// R5 scaffold result: a skeleton is not a room
// ---------------------------------------------------------------------------
arm('R5 scaffoldRoomSkeleton result says ready:false and room_db:false', () => {
  const d = mk('scaffold');
  const s = require(path.join(ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs')).scaffoldRoomSkeleton(d, { blueprintFamily: 'venture' });
  check(s.ready === false, 'ready is ' + JSON.stringify(s.ready));
  check(s.room_db === false, 'room_db is ' + JSON.stringify(s.room_db));
});

// ---------------------------------------------------------------------------
// R6 doctrine: stop on a failed create / switch
// ---------------------------------------------------------------------------
arm('R6 doctrine: never hand-build a room, in every agent and rooms surface that exists', () => {
  const missing = [];
  const files = ['agents/larry.md', 'agents/larry-extended.md', 'commands/rooms.md', 'skills/rooms/SKILL.md'];
  let seen = 0;
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue; // agents/larry.md does not exist in this repo (Larry is agents/larry-extended.md)
    seen += 1;
    if (!/never hand-build a room/i.test(fs.readFileSync(p, 'utf8'))) missing.push(f);
  }
  check(seen >= 3, 'fewer than 3 doctrine surfaces exist on disk');
  check(missing.length === 0, 'missing the sentence in: ' + missing.join(', '));
});
arm('R6 tool-router rooms-new NOT EXECUTED banner names /mos:rooms new', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');
  const i = src.indexOf('NOT EXECUTED');
  check(i !== -1, 'no NOT EXECUTED banner');
  check(src.indexOf('/mos:rooms new', i) !== -1, 'banner does not name /mos:rooms new');
});

// ---------------------------------------------------------------------------
// R7 doctor python-floor point
// ---------------------------------------------------------------------------
arm('R7 doctor carries a python-floor acceptance point (python3_version, py311_only_api_hits: 0)', () => {
  const h = freshHome();
  const env = Object.assign({}, process.env, {
    HOME: h.home, USERPROFILE: h.home, MINDRIAN_ROOMS_HOME: h.roomsHome,
    DOCTOR_TEST_MODE: '1', DOCTOR_TEST_ONLY_POINTS: 'python-floor', MINDRIAN_ACCEPTANCE_PROGRESS: '0',
  });
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.cjs'), '--acceptance', '--pre-tag', '--json'],
    { env: env, cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  const at = (r.stdout || '').indexOf('{');
  check(at !== -1, 'doctor printed no JSON; exit=' + r.status + ' stderr=' + (r.stderr || '').slice(-300));
  const json = JSON.parse(r.stdout.slice(at));
  const pt = (json.points || []).find((p) => /python-floor/.test(p.id));
  check(pt, 'no python-floor point in ' + JSON.stringify((json.points || []).map((p) => p.id)));
  check(pt.detail && typeof pt.detail.python3_version === 'string' && pt.detail.python3_version.length > 0,
    'detail.python3_version missing: ' + JSON.stringify(pt.detail));
  check(pt.detail.py311_only_api_hits === 0, 'py311_only_api_hits is ' + JSON.stringify(pt.detail.py311_only_api_hits));
  check(pt.ok === true, 'point not ok: ' + JSON.stringify(pt.finding));
});

// ---------------------------------------------------------------------------
// R8 dash guard over the text this task added; R9 changelog entry
// ---------------------------------------------------------------------------
function hasDash(s) { return s.indexOf(EM) !== -1 || s.indexOf(EN) !== -1; }
arm('R8 no em/en dash in the text this task added', () => {
  const bad = [];
  if (hasDash(fs.readFileSync(__filename, 'utf8'))) bad.push('tests/test-l9o-rooms-python-floor.cjs');
  for (const f of ['agents/larry-extended.md', 'commands/rooms.md', 'skills/rooms/SKILL.md']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (/never hand-build a room/i.test(line) && hasDash(line)) bad.push(f + ': ' + line.slice(0, 80));
    }
  }
  const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const u = cl.indexOf('## [Unreleased]');
  if (u !== -1) {
    const next = cl.indexOf('\n## [', u + 5);
    const sec = cl.slice(u, next === -1 ? cl.length : next);
    for (const line of sec.split('\n')) { if (/SEED-117/.test(line) && hasDash(line)) bad.push('CHANGELOG.md: ' + line.slice(0, 80)); }
  }
  check(bad.length === 0, 'dash found in: ' + bad.join(' | '));
});
arm('R9 CHANGELOG [Unreleased] names the python-floor fix (SEED-117)', () => {
  const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const u = cl.indexOf('## [Unreleased]');
  check(u !== -1, 'no ## [Unreleased] heading');
  const next = cl.indexOf('\n## [', u + 5);
  const sec = cl.slice(u, next === -1 ? cl.length : next);
  check(/SEED-117/.test(sec) && /timezone\.utc/.test(sec), 'Unreleased section does not carry the SEED-117 / timezone.utc entry');
});

console.log('\ntest-l9o-rooms-python-floor: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
process.exit(failed === 0 ? 0 : 1);
