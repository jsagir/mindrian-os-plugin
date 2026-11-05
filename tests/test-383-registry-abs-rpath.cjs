#!/usr/bin/env node
'use strict';
/*
 * Phase 383 plan 01 (QA383-01, QA383-10): scripts/room-registry create with an absolute room path.
 *
 * birthRoom passes an absolute room path. The script joins it onto the rooms home with mkdir -p, so
 * an absolute path nests inside the home (research E9): /home/u/MindrianRooms/home/u/MindrianRooms/x.
 * A Windows drive path does the same: C:/Users/x/... becomes a folder named C: inside the home.
 * The script must resolve the real room folder first and never join an absolute path.
 *
 *   A1  absolute path inside the home: no nested copy of the home path, one ROOM.md at probe/ROOM.md
 *   A2  absolute path outside the home: no nested copy, the room is where the caller said
 *   A3  relative path: the room is under the home (guard leg)
 *   A4  Windows drive form: no folder named C: appears under the home
 *   A5  static: the create stanza classifies the path before its first mkdir -p
 *
 * Hermetic: HOME and the rooms home are mkdtemp dirs. System PATH. No network.
 * House rule: hyphens only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/harness-383.cjs');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'scripts', 'room-registry');
const rep = H.reporter('test-383-registry-abs-rpath');

function run(h, args, cwd) {
  return cp.spawnSync(H.realBash(), [REGISTRY].concat(args), { env: h.env, cwd: cwd || ROOT, encoding: 'utf8', timeout: 60000 });
}
function ok(cond, what) { if (!cond) throw new Error(what); }
function tail(r) { return 'exit=' + r.status + ' stderr=' + String(r.stderr || '').slice(-300); }
function firstSegment(p) { return String(p).split('/').filter(Boolean)[0]; }

const legs = [];
function leg(label, fn) { legs.push({ label: label, fn: fn }); }

leg('A1 absolute path inside the home: no nested copy of the home path, one ROOM.md at probe/ROOM.md', function () {
  const h = H.hermeticEnv('a1');
  const r = run(h, [h.roomsHome, 'create', 'probe', path.join(h.roomsHome, 'probe'), 'Probe', 'idea']);
  ok(r.status === 0, tail(r));
  const nested = path.join(h.roomsHome, h.roomsHome.replace(/^\/+/, ''));
  ok(!fs.existsSync(nested), 'nested copy of the home path exists: ' + nested);
  const rooms = H.snapshotTree(h.roomsHome).filter(function (p) { return /(^|\/)ROOM\.md$/.test(p); });
  ok(JSON.stringify(rooms) === JSON.stringify(['probe/ROOM.md']), 'ROOM.md files under the home: ' + JSON.stringify(rooms));
});

leg('A2 absolute path outside the home: no nested copy, the room is where the caller said', function () {
  const h = H.hermeticEnv('a2');
  const x = H.mkTmp('a2-outside');
  const target = path.join(x, 'rooms', 'probe2');
  const r = run(h, [h.roomsHome, 'create', 'probe2', target, 'Probe', 'idea']);
  ok(r.status === 0, tail(r));
  const seg = firstSegment(x);
  const nested = H.snapshotTree(h.roomsHome).filter(function (p) { return p === seg || p.indexOf(seg + '/') === 0; });
  ok(nested.length === 0, 'paths under the home that start with ' + seg + ': ' + JSON.stringify(nested.slice(0, 3)));
  ok(fs.existsSync(path.join(target, 'ROOM.md')), target + '/ROOM.md does not exist');
});

leg('A3 relative path: the room is under the home (guard leg)', function () {
  const h = H.hermeticEnv('a3');
  const r = run(h, [h.roomsHome, 'create', 'rel-room', 'rel-room', 'Probe', 'idea']);
  ok(r.status === 0, tail(r));
  ok(fs.existsSync(path.join(h.roomsHome, 'rel-room', 'ROOM.md')), 'rel-room/ROOM.md does not exist');
});

leg('A4 Windows drive form: no folder named C: appears under the home', function () {
  const h = H.hermeticEnv('a4');
  const cwd = H.mkTmp('a4-cwd');
  run(h, [h.roomsHome, 'create', 'probe3', 'C:/Users/x/MindrianRooms/probe3', 'Probe', 'idea'], cwd);
  const inHome = H.snapshotTree(h.roomsHome).filter(function (p) { return p === 'C:' || p.indexOf('C:/') === 0; });
  const inCwd = H.snapshotTree(cwd).filter(function (p) { return p === 'C:' || p.indexOf('C:/') === 0; });
  try {
    ok(inHome.length === 0, 'a folder named C: exists under the home: ' + JSON.stringify(inHome.slice(0, 3)));
    ok(inCwd.length === 0, 'a folder named C: exists under the cwd: ' + JSON.stringify(inCwd.slice(0, 3)));
  } finally {
    try { fs.rmSync(cwd, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

leg('A5 static: the create stanza classifies the path before its first mkdir -p and knows a drive letter', function () {
  const src = fs.readFileSync(REGISTRY, 'utf8');
  const a = src.indexOf('\n  create)');
  const b = src.indexOf('\n  read)');
  ok(a >= 0 && b > a, 'create) and read) stanzas found');
  const stanza = src.slice(a, b);
  const iCase = stanza.indexOf('case "$RPATH" in');
  const iMkdir = stanza.indexOf('mkdir -p');
  ok(iCase >= 0 && iMkdir >= 0, 'case "$RPATH" in at ' + iCase + ', mkdir -p at ' + iMkdir);
  ok(iCase < iMkdir, 'the first case "$RPATH" in (' + iCase + ') comes after the first mkdir -p (' + iMkdir + ')');
  ok(stanza.indexOf('[A-Za-z]:') !== -1, 'the create stanza has no [A-Za-z]: drive-letter pattern');
});

if (!H.realBash()) {
  console.log('SKIP test-383-registry-abs-rpath: no bash under /usr/bin or /bin');
  process.exit(0);
}

const havePython = H.realPython3() !== null;
for (const l of legs) {
  if (!havePython && !/^A5/.test(l.label)) { rep.pending(l.label, 'no real python3 on this host'); continue; }
  try { l.fn(); rep.pass(l.label); } catch (e) { rep.fail(l.label, String(e && e.message || e)); }
}
rep.done();
