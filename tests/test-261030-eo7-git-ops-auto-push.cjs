'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261030-eo7 (N2) -- a room path, a workspace path and a registry path
 * must never reach python3 as program text in scripts/git-ops get-auto-push.
 * RCA: .planning/debug/command-injection-commit-message-and-speaker-urlencode.md
 *
 * The bc75d431e cut pasted $REGISTRY_FILE, $ROOM_PATH and $WORK_DIR into
 * python3 -c program text inside single quotes. When $PWD/.rooms/registry.json
 * exists, a room folder name (or a workspace folder name) written to break out
 * of that string literal ran its own code. `commit` and `status` reach this
 * subcommand, so the H1 chain (commitArtifact -> git-ops commit) reached it too.
 * The fix gives the 3 paths to python3 as sys.argv (the scripts/resolve-room
 * argv model).
 *
 * Legs:
 *   A1-A3. hostile room folder names (2 quote break-outs, 1 $( )): no marker,
 *      the registry value is found;
 *   A4. the commit chain: git-ops commit in a hostile room makes the commit and
 *      creates no marker;
 *   A5. a hostile workspace folder name with a relative registry path;
 *   B. normal paths: NEW stdout bytes equal the bc75d431e cut (oracle: git
 *      archive), plus pinned values;
 *   C. the pinned divergence: an apostrophe and a backslash sequence in a room
 *      path now match the registry (the old code fell back to off);
 *   D. source pins: no path variable inside the program text, sys.argv used.
 *
 * No leg pushes: the scratch repos have no remote and no registry value is
 * `auto` on the commit leg. Every run uses a fresh cwd under os.tmpdir().
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail.
 * Hyphens only (no em-dash or en-dash).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NEW_SCRIPT = path.join(ROOT, 'scripts', 'git-ops');
const BASE_SHA = process.env.EO7_ORACLE_SHA || 'bc75d431ea8bc5e4218c01a51f5c0a37b74d2295';

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'test-eo7-n2-' + label + '-')));
  tmpRoots.push(d);
  return d;
}
function assertUnderTmp(p) {
  const t = fs.realpathSync(os.tmpdir());
  assert.ok(p.startsWith(t + path.sep), 'path must live under os.tmpdir(): ' + p);
}

const base = mkTmp('base');
assertUnderTmp(base);
fs.mkdirSync(path.join(base, 'home'));
const GLOBAL_CFG = path.join(base, 'gitconfig-empty');
fs.writeFileSync(GLOBAL_CFG, '');

const ENV = {
  PATH: [path.dirname(process.execPath), '/usr/bin', '/bin'].join(':'),
  HOME: path.join(base, 'home'),
  LANG: 'C.UTF-8',
  LC_ALL: 'C.UTF-8',
  TZ: 'UTC',
  GIT_CONFIG_GLOBAL: GLOBAL_CFG,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CEILING_DIRECTORIES: base,
  GIT_TERMINAL_PROMPT: '0',
};

// OLD oracle: read-only git archive of BASE_SHA.
let OLD_SCRIPT = null;
let oracleError = null;
{
  const tar = path.join(base, 'old.tar');
  const oldDir = path.join(base, 'old');
  fs.mkdirSync(oldDir);
  const a = spawnSync('git', ['archive', '-o', tar, BASE_SHA, 'scripts/git-ops'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'],
  });
  if (a.status !== 0) {
    oracleError = 'git archive of ' + BASE_SHA + ' failed (set EO7_ORACLE_SHA to a reachable sha): ' + String(a.stderr || '').trim();
  } else {
    const x = spawnSync('tar', ['-xf', tar, '-C', oldDir], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
    if (x.status !== 0) oracleError = 'tar extract failed: ' + String(x.stderr || '').trim();
    else OLD_SCRIPT = path.join(oldDir, 'scripts', 'git-ops');
  }
}
function needOracle() {
  if (!OLD_SCRIPT) throw new Error(oracleError || 'OLD oracle missing (EO7_ORACLE_SHA)');
}

const HAVE_PY = spawnSync('python3', ['--version']).status === 0;
function pyLeg(name, fn) {
  if (!HAVE_PY) { console.log('ok - ' + name + ' # SKIP python3 absent'); return; }
  leg(name, fn);
}

// A workspace dir (the cwd of git-ops) with .rooms/registry.json.
function makeWorkspace(name, rooms, rawRegistry) {
  const ws = name ? path.join(base, name) : fs.mkdtempSync(path.join(base, 'ws-'));
  assertUnderTmp(ws);
  fs.mkdirSync(path.join(ws, '.rooms'), { recursive: true });
  if (rawRegistry !== undefined) {
    if (rawRegistry !== null) fs.writeFileSync(path.join(ws, '.rooms', 'registry.json'), rawRegistry);
  } else {
    fs.writeFileSync(path.join(ws, '.rooms', 'registry.json'), JSON.stringify({ rooms }, null, 2) + '\n');
  }
  return ws;
}
function makeDir(p) {
  assertUnderTmp(p);
  fs.mkdirSync(p, { recursive: true });
  return p;
}
function getAutoPush(script, ws, room) {
  const r = spawnSync('bash', [script, 'get-auto-push', room], { cwd: ws, env: ENV });
  return { status: r.status, stdout: r.stdout, listing: fs.readdirSync(ws).sort() };
}

const PROOF_ROOM = "room'+str(open('mos-eo7-n2-proof','w').write('1'))+'";
const SYS_ROOM = "room'); __import__('os').system('touch mos-eo7-n2-sys'); ('x";
const SUBST_ROOM = 'room $(touch mos-eo7-n2-subst)';

const HOSTILE_ROOMS = [
  ['A1. quote break-out room name (open/write)', PROOF_ROOM, 'h1'],
  ['A2. quote break-out room name (os.system)', SYS_ROOM, 'h2'],
  ['A3. $( ) room name', SUBST_ROOM, 'h3'],
];
for (const [name, roomName, tag] of HOSTILE_ROOMS) {
  pyLeg(name + ': no marker, registry value found', () => {
    const room = makeDir(path.join(base, 'rooms-' + tag, roomName));
    const ws = makeWorkspace(null, { hostile: { path: room, auto_push: 'manual' } });
    const r = getAutoPush(NEW_SCRIPT, ws, room);
    assert.deepEqual(r.listing, ['.rooms'], 'the workspace must hold only .rooms (a marker means code ran): ' + JSON.stringify(r.listing));
    assert.equal(r.status, 0);
    assert.equal(r.stdout.toString('utf8'), 'manual\n');
  });
}

pyLeg('A4. commit chain in a hostile room: commit made, no marker', () => {
  const room = makeDir(path.join(base, 'rooms-h4', PROOF_ROOM));
  fs.mkdirSync(path.join(room, 'sec'));
  const git = (args) => execFileSync('git', ['-C', room].concat(args), { env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  execFileSync('git', ['init', '-q', room], { env: ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  git(['config', 'user.name', 'eo7 test']);
  git(['config', 'user.email', 'eo7@example.invalid']);
  git(['config', 'commit.gpgsign', 'false']);
  git(['commit', '--allow-empty', '-q', '-m', 'seed']);
  const file = path.join(room, 'sec', 'a4.md');
  fs.writeFileSync(file, '# a4\n');
  const ws = makeWorkspace(null, { hostile: { path: room, auto_push: 'manual' } });
  const r = spawnSync('bash', [NEW_SCRIPT, 'commit', room, file, 'file(sec): a4'], { cwd: ws, env: ENV, encoding: 'utf8' });
  assert.deepEqual(fs.readdirSync(ws).sort(), ['.rooms'], 'the workspace must hold only .rooms (a marker means code ran)');
  assert.equal(r.status, 0, 'rc: ' + r.stderr);
  assert.equal(git(['log', '-1', '--format=%B']), 'file(sec): a4\n\n');
});

pyLeg('A5. hostile workspace folder name with a relative registry path: no marker, value found', () => {
  const ws = makeWorkspace("ws'+str(open('mos-eo7-n2-ws','w').write('1'))+'", { alpha: { path: 'rooms/alpha', auto_push: 'manual' } });
  const room = makeDir(path.join(ws, 'rooms', 'alpha'));
  const r = getAutoPush(NEW_SCRIPT, ws, room);
  assert.deepEqual(r.listing, ['.rooms', 'rooms'], 'the workspace must hold only .rooms and rooms: ' + JSON.stringify(r.listing));
  assert.equal(r.stdout.toString('utf8'), 'manual\n');
});

pyLeg('B. normal paths: NEW stdout bytes equal the bc75d431e cut, pinned values hold', () => {
  needOracle();
  const cases = [];
  const plain = makeDir(path.join(base, 'normal', 'room-plain'));
  const spaced = makeDir(path.join(base, 'normal', 'room with space'));
  const uni = makeDir(path.join(base, 'normal', 'Zoë room 東京'));
  const noKey = makeDir(path.join(base, 'normal', 'room-nokey'));
  const unreg = makeDir(path.join(base, 'normal', 'room-unregistered'));
  const link = path.join(base, 'normal', 'room-link');
  fs.symlinkSync(plain, link);
  const rooms = {
    plain: { path: plain, auto_push: 'auto' },
    spaced: { path: spaced, auto_push: 'manual' },
    uni: { path: uni, auto_push: 'auto' },
    nokey: { path: noKey },
    rel: { path: 'rooms/beta', auto_push: 'manual' },
  };
  const ws = makeWorkspace('ws-normal', rooms);
  const rel = makeDir(path.join(ws, 'rooms', 'beta'));
  cases.push([ws, plain, 'auto\n'], [ws, spaced, 'manual\n'], [ws, uni, 'auto\n'], [ws, noKey, 'off\n'],
    [ws, unreg, 'off\n'], [ws, link, 'auto\n'], [ws, rel, 'manual\n']);
  const wsNoReg = makeWorkspace('ws-noreg', null, null);
  cases.push([wsNoReg, plain, 'off\n']);
  const wsBad = makeWorkspace('ws-badjson', null, '{ not json');
  cases.push([wsBad, plain, 'off\n']);
  for (const [w, room, want] of cases) {
    const o = getAutoPush(OLD_SCRIPT, w, room);
    const n = getAutoPush(NEW_SCRIPT, w, room);
    assert.ok(n.stdout.equals(o.stdout), 'byte identity for ' + JSON.stringify(room) + ': OLD ' + JSON.stringify(o.stdout.toString()) + ' NEW ' + JSON.stringify(n.stdout.toString()));
    assert.equal(n.status, o.status, 'rc for ' + room);
    assert.equal(n.stdout.toString('utf8'), want, 'pinned value for ' + JSON.stringify(room));
  }
});

pyLeg('C. pinned divergence: apostrophe and backslash room paths now match the registry', () => {
  needOracle();
  const apos = makeDir(path.join(base, 'div', "Dana O'Sample room"));
  const bslash = makeDir(path.join(base, 'div', 'back\\tslash room'));
  const ws = makeWorkspace('ws-div', { apos: { path: apos, auto_push: 'manual' }, bslash: { path: bslash, auto_push: 'manual' } });
  for (const room of [apos, bslash]) {
    const o = getAutoPush(OLD_SCRIPT, ws, room).stdout.toString('utf8');
    const n = getAutoPush(NEW_SCRIPT, ws, room).stdout.toString('utf8');
    assert.equal(o, 'off\n', 'OLD value for ' + JSON.stringify(room));
    assert.equal(n, 'manual\n', 'NEW value for ' + JSON.stringify(room));
  }
});

leg('D. source pins: no path variable inside the get-auto-push program text', () => {
  const src = fs.readFileSync(NEW_SCRIPT, 'utf8');
  for (const v of ["'$REGISTRY_FILE'", "'$ROOM_PATH'", "'$WORK_DIR'"]) {
    assert.ok(!src.includes(v), 'scripts/git-ops must not hold ' + v);
  }
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.trim() === 'get-auto-push)');
  assert.ok(start > 0, 'the get-auto-push case must exist');
  const open = lines.findIndex((l, i) => i > start && l.trim() === 'python3 -c "');
  assert.ok(open > start, 'the python3 -c line must exist');
  const close = lines.findIndex((l, i) => i > open && l.startsWith('"'));
  assert.ok(close > open, 'the program text must end');
  const program = lines.slice(open + 1, close).join('\n');
  for (const ch of ['$', '`', '\\']) assert.ok(!program.includes(ch), 'the program text must not hold ' + ch);
  for (const a of ['sys.argv[1]', 'sys.argv[2]', 'sys.argv[3]']) assert.ok(program.includes(a), 'the program text must use ' + a);
  assert.ok(lines[close].includes('"$REGISTRY_FILE" "$ROOM_PATH" "$WORK_DIR"'), 'the 3 paths must follow the program as arguments');
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

if (failures === 0) {
  console.log('git-ops-auto-push: ALL PASS');
  process.exit(0);
} else {
  console.log('git-ops-auto-push: ' + failures + ' FAILED');
  process.exit(1);
}
