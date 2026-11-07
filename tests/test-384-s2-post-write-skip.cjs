#!/usr/bin/env node
'use strict';
// Plan 384-20 (finding S2, Write path): scripts/post-write starts a node process for the
// cascade even when the path is not a room file (no /room/ and no /rooms/ segment).
//
// Groups:
//   parity     P1..P3 (must pass before and after the change). The default run (no argument)
//              runs this group only.
//   mechanism  M1, M2 (M1 fails on the code before the change). Run it with the argument
//              `mechanism`, or run both with `all`.
//
// Tree A runs the post-write of BASE_SHA (read with git show). Tree B runs the post-write of
// the working tree. Everything else (mindrian-tools.cjs and the libs) is the same file in both
// trees, because the change touches scripts/post-write only. Each run gets its own fresh
// temporary folder with a sandbox HOME and a closed loopback Brain URL. The helper scripts that
// post-write starts in the background are stubs that log their arguments. Fixture rooms only
// (Canon Part 8). Node built-ins only, no network.
//
// Usage: node tests/test-384-s2-post-write-skip.cjs [parity|mechanism|all]

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const BASE_SHA = '933ec50df06b75f2c129b3de429e428a3cde277d'; // START_SHA of plan 384-20 (post-write before the change)
const SESSION = 'sess-384-s2';
const group = process.argv[2] || 'parity';
if (!['parity', 'mechanism', 'all'].includes(group)) {
  console.log('usage: test-384-s2-post-write-skip.cjs [parity|mechanism|all]');
  process.exit(2);
}

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log('ok   ' + name);
  else { failed++; console.log('FAIL ' + name + (detail ? ' : ' + detail : '')); }
}

if (spawnSync('jq', ['--version']).status !== 0) {
  console.log('FAIL jq is not on PATH (post-write needs jq)');
  console.log('s2-post-write: 1 FAILED');
  process.exit(1);
}

const tmpRoots = [];
function mkW() {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s2t-'));
  // The folder path itself must hold neither /room/ nor /rooms/, or every layout would pass the rule.
  if (/\/rooms?\//.test(w + '/')) throw new Error('temporary folder path holds a room segment; set TMPDIR to another folder');
  tmpRoots.push(w);
  return w;
}

function postWriteSource(tree) {
  if (tree === 'B') return fs.readFileSync(path.join(REPO, 'scripts', 'post-write'), 'utf8');
  const r = spawnSync('git', ['show', BASE_SHA + ':scripts/post-write'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 24 });
  if (r.status !== 0) throw new Error('git show failed for BASE_SHA');
  return r.stdout;
}

const REAL_SCRIPTS = path.join(REPO, 'scripts');
const STUB_JSON = {
  skipped: false,
  classification: { type: 'insight', confidence: 0.9 },
  gitCommit: { committed: true, hash: 'abc1234' },
  graphIndex: { nodes: 3 },
  proactiveIntelligence: { items: [{ kind: 'gap', text: 'fixed' }] },
};

// Layout of one run, all under W/data. W/meta holds the plugin root, the node shim and its log.
// kind: 'default' (MindrianRooms/r1), 'rooms' (rooms/r1)
function setup(tree, kind, opts) {
  const W = mkW();
  const data = path.join(W, 'data');
  const meta = path.join(W, 'meta');
  const logs = path.join(data, 'logs');
  const home = path.join(data, 'home');
  const plugin = path.join(meta, 'plugin');
  const scripts = path.join(plugin, 'scripts');
  const bin = path.join(meta, 'bin');
  for (const d of [logs, home, scripts, bin]) fs.mkdirSync(d, { recursive: true });

  // post-write: a copy of the tree's script
  fs.writeFileSync(path.join(scripts, 'post-write'), postWriteSource(tree), { mode: 0o755 });
  // mindrian-tools.cjs: real (symlink) or stub
  if (opts.stubTools) {
    fs.writeFileSync(path.join(scripts, 'mindrian-tools.cjs'),
      '#!/usr/bin/env node\n' +
      'require("fs").appendFileSync(' + JSON.stringify(path.join(logs, 'tools.log')) + ', JSON.stringify(process.argv.slice(2)) + "\\n");\n' +
      'process.stdout.write(' + JSON.stringify(JSON.stringify(STUB_JSON)) + ');\n', { mode: 0o755 });
  } else {
    fs.symlinkSync(path.join(REAL_SCRIPTS, 'mindrian-tools.cjs'), path.join(scripts, 'mindrian-tools.cjs'));
  }
  // deterministic stubs for the helpers that post-write starts
  const logger = (name) => '#!/usr/bin/env node\nrequire("fs").appendFileSync(' + JSON.stringify(path.join(logs, name + '.log')) +
    ', JSON.stringify(process.argv.slice(2)) + "\\n");\n';
  for (const n of ['stamp-artifact-write', 'minto-debouncer', 'recompile-room-references']) {
    fs.writeFileSync(path.join(scripts, n + '.cjs'), logger(n), { mode: 0o755 });
  }
  fs.writeFileSync(path.join(scripts, 'track-analytics'),
    '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> ' + JSON.stringify(path.join(logs, 'track-analytics.log')) + '\n', { mode: 0o755 });
  fs.writeFileSync(path.join(scripts, 'resolve-room'), '#!/usr/bin/env bash\nexit 1\n', { mode: 0o755 });

  // node shim: logs each start, then runs the real node
  const shimLog = path.join(meta, 'node-starts.log');
  fs.writeFileSync(path.join(bin, 'node'),
    '#!/bin/sh\nprintf \'%s\\n\' "$*" >> ' + JSON.stringify(shimLog) + '\nexec ' + JSON.stringify(process.execPath) + ' "$@"\n', { mode: 0o755 });

  // the room
  const roomsFolder = kind === 'rooms' ? 'rooms' : 'MindrianRooms';
  const roomDir = path.join(data, roomsFolder, 'r1');
  fs.mkdirSync(path.join(roomDir, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# state\n');
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'sec', 'ROOM.md'), '# section\n');
  fs.writeFileSync(path.join(roomDir, 'sec', 'a.md'), '# artifact\n');
  return { W, data, meta, plugin, scripts, bin, shimLog, home, roomDir, logs };
}

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function run(fx, file) {
  const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file }, session_id: SESSION });
  const env = {
    PATH: fx.bin + ':' + process.env.PATH,
    HOME: fx.home,
    USERPROFILE: fx.home,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    LANG: 'C',
  };
  const r = spawnSync('bash', [path.join(fx.scripts, 'post-write')], {
    cwd: fx.home, env, input: payload, encoding: 'utf8', timeout: 60000,
  });
  sleep(1500); // let the backgrounded helper stubs finish
  return r;
}

function walk(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p));
  }
  return out;
}

// Normalized snapshot of the compared set: stdout, exit code, files under W/data with their content.
function snapshot(fx, r) {
  const norm = (s) => s.split(fx.W).join('<W>');
  const files = walk(fx.data, fx.data, []).sort();
  const content = {};
  for (const f of files) {
    let t = fs.readFileSync(path.join(fx.data, f), 'utf8');
    t = norm(t);
    if (f.endsWith('last-cascade.json')) {
      t = t.replace(/"timestamp":"[^"]*"/, '"timestamp":"<T>"').replace(/"session_id":"[^"]*"/, '"session_id":"<S>"');
    }
    if (f.endsWith('.log')) t = t.split('\n').filter(Boolean).sort().join('\n');
    content[f] = t;
  }
  return { stdout: norm(r.stdout || ''), code: r.status, files, content };
}

function countCascadeStarts(fx) {
  let t = '';
  try { t = fs.readFileSync(fx.shimLog, 'utf8'); } catch (_) { /* none */ }
  return t.split('\n').filter((l) => /mindrian-tools\.cjs cascade/.test(l)).length;
}

function cleanup() {
  for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
}

function sameSnap(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function diffHint(a, b) {
  if (a.stdout !== b.stdout) return 'stdout differs: ' + JSON.stringify(a.stdout) + ' vs ' + JSON.stringify(b.stdout);
  if (a.code !== b.code) return 'exit code differs';
  if (JSON.stringify(a.files) !== JSON.stringify(b.files)) return 'file set differs: ' + JSON.stringify(a.files) + ' vs ' + JSON.stringify(b.files);
  for (const f of a.files) if (a.content[f] !== b.content[f]) return 'content differs in ' + f;
  return 'unknown';
}

const CASES = [
  { id: 'P1', note: 'artifact on the default layout (no /room/ or /rooms/): real cascade, skipped', kind: 'default', file: 'sec/a.md', stub: false, expectStatus: 'skipped' },
  { id: 'P2', note: 'ROOM.md on a /rooms/ layout: the path rule passes, the basename skip happens inside node', kind: 'rooms', file: 'sec/ROOM.md', stub: false, expectStatus: 'skipped' },
  { id: 'P3', note: 'artifact on a /rooms/ layout, stub cascade output', kind: 'rooms', file: 'sec/a.md', stub: true, expectStatus: 'complete' },
];

function runCase(tree, c) {
  const fx = setup(tree, c.kind, { stubTools: c.stub });
  const file = path.join(fx.roomDir, c.file);
  const r = run(fx, file);
  return { fx, r, snap: snapshot(fx, r), starts: countCascadeStarts(fx) };
}

// ---------------------------------------------------------------------------
// parity group
// ---------------------------------------------------------------------------
function parity() {
  for (const c of CASES) {
    const a1 = runCase('A', c);
    const a2 = runCase('A', c);
    ok(c.id + ' control: two runs of tree A are equal (' + c.note + ')', sameSnap(a1.snap, a2.snap), diffHint(a1.snap, a2.snap));
    ok(c.id + ' premise: exit 0 and the envelope is one JSON line', a1.snap.code === 0 && /^\{.*\}\n?$/.test(a1.snap.stdout) && a1.snap.stdout.trim().split('\n').length === 1, JSON.stringify(a1.snap.stdout));
    const scFile = a1.snap.files.find((f) => f.endsWith('last-cascade.json'));
    let status = null;
    try { status = JSON.parse(a1.snap.content[scFile]).cascade_status; } catch (_) { /* leave null */ }
    ok(c.id + ' premise: side-channel record exists with cascade_status ' + c.expectStatus, status === c.expectStatus, String(status));
    const b = runCase('B', c);
    ok(c.id + ' parity: tree B equals tree A (stdout bytes, exit code, side-channel content, files written)', sameSnap(a1.snap, b.snap), diffHint(a1.snap, b.snap));
  }
}

// ---------------------------------------------------------------------------
// mechanism group
// ---------------------------------------------------------------------------
function bashGlob(p) {
  const r = spawnSync('bash', ['-c',
    'p="$1"; if [[ "$p" == */room/* ]] || [[ "$p" == */rooms/* ]]; then echo yes; else echo no; fi',
    'bash', p], { encoding: 'utf8', timeout: 10000 });
  return r.stdout.trim() === 'yes';
}

function mechanism() {
  // M1: the number of `mindrian-tools.cjs cascade` starts
  const expected = { P1: 0, P2: 1, P3: 1 };
  for (const c of CASES) {
    const a = runCase('A', c);
    const b = runCase('B', c);
    const wantA = 1;
    ok('M1 control ' + c.id + ': tree A starts the cascade once (' + a.starts + ')', a.starts === wantA, String(a.starts));
    ok('M1 ' + c.id + ': tree B starts the cascade ' + expected[c.id] + ' time(s)', b.starts === expected[c.id], 'got ' + b.starts);
  }

  // M2: the bash condition equals the cascade rule on a table of paths
  const W = mkW();
  const sandboxHome = path.join(W, 'home');
  fs.mkdirSync(sandboxHome, { recursive: true });
  const base = path.join(W, 'b');
  fs.mkdirSync(base, { recursive: true });
  const table = [
    'room/n/sec/ROOM.md',
    'rooms/n/sec/ROOM.md',
    'MindrianRooms/n/sec/ROOM.md',
    'Rooms/n/sec/ROOM.md',
    'my-room/n/sec/ROOM.md',
    'team-rooms/n/sec/ROOM.md',
    'myrooms/n/sec/ROOM.md',
    'rooms2/n/sec/ROOM.md',
    'ROOM/n/sec/ROOM.md',
    '.planning/phases/x/ROOM.md',
    '.rooms/sessions/ROOM.md',
    'a/rooms/b/rooms/c/ROOM.md',
    'room/room/ROOM.md',
    'a/room/b/rooms/c/ROOM.md',
    'rooms//n/sec/ROOM.md',
    'x/room', // a path that ends in /room (no trailing slash)
    'x/rooms', // a path that ends in /rooms
    'room.d/n/ROOM.md',
  ];
  ok('M2 table has at least 14 paths (' + table.length + ')', table.length >= 14);
  let allAgree = true;
  const bad = [];
  for (const rel of table) {
    const file = base + '/' + rel;
    const glob = bashGlob(file);
    const env = { PATH: process.env.PATH, HOME: sandboxHome, USERPROFILE: sandboxHome, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' };
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'mindrian-tools.cjs'), 'cascade', base, file, '--raw'],
      { encoding: 'utf8', timeout: 60000, env, cwd: sandboxHome });
    let reason = null;
    try { reason = JSON.parse(r.stdout).skipReason || null; } catch (_) { /* leave null */ }
    const cascadeSkipsAsNotRoom = reason === 'filePath not inside a room directory';
    const agree = cascadeSkipsAsNotRoom === !glob;
    if (!agree) { allAgree = false; bad.push(rel + ' glob=' + glob + ' reason=' + reason); }
  }
  ok('M2 the bash glob matches exactly when the cascade does not skip with "filePath not inside a room directory"', allAgree, bad.join('; '));

  // M2b: post-write uses that condition before the node call (read from the working tree script)
  const src = postWriteSource('B');
  const i = src.indexOf('# -- Delegate intelligence cascade');
  const j = src.indexOf('mindrian-tools.cjs" cascade', i);
  const block = i >= 0 && j > i ? src.slice(i, j) : '';
  ok('M2b post-write checks the room path glob inside the cascade block before the node call',
    block.includes('*/room/*') && block.includes('*/rooms/*'));
}

try {
  if (group === 'parity' || group === 'all') parity();
  if (group === 'mechanism' || group === 'all') mechanism();
} finally {
  cleanup();
}
console.log(failed === 0 ? 's2-post-write: ALL PASS' : 's2-post-write: ' + failed + ' FAILED');
process.exit(failed === 0 ? 0 : 1);
