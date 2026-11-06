#!/usr/bin/env node
/**
 * Plan 386-44 (finding B17): a section row is never a path.
 *
 * The room state table listed the room's own Windows-style path as a section
 * with 0 entries. Cause: a Windows drive path string is read as a relative
 * name on POSIX, openRoomDb creates a folder with that literal name, and the
 * renderer lists every folder without checking the name.
 *
 * Canon Part 8: synthetic fixtures only. Every Windows-style value below is a
 * string passed to the code. No real room, registry or home folder is read:
 * every child process gets a temporary HOME and MINDRIAN_ROOMS_HOME.
 *
 * Arms:
 *   BR1  table rows of renderState hold no path-like name
 *   BR2  discoverSections does not list a literal path-like folder
 *   BR3a renderState with a Windows-style room argument shows no literal-path room
 *   BR3b CLAUDE_ACTIVE_ROOM with a Windows-style value does not resolve to a stray folder
 *   BR3c a registry abs_path with a Windows-style value does not resolve to a stray folder
 *   BR3d openRoomDb with a Windows-style value creates no literal folder
 *   BR3e the platform helper maps a drive path and refuses an unreachable one
 *   BR4  the whole state text holds no line with a drive path
 *   BRP1 normal sections are still listed
 *   BRP2 a sub-room with a .room-root sentinel is still not a section
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RENDER = path.join(ROOT, 'lib', 'core', 'room-render.cjs');
const WIN = 'C:\\Users\\synthetic-386-44\\MindrianRooms\\synthetic-ventures\\synthetic-room';

let failures = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failures += 1;
    console.log('FAIL - ' + label + (detail ? ' :: ' + detail : ''));
  }
}

const tmpRoots = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpRoots.push(d);
  return d;
}

// A clean HOME for every child: nothing of the owner is read or written.
const FAKE_HOME = tmp('t386-44-home-');
const CHILD_ENV = Object.assign({}, process.env, {
  HOME: FAKE_HOME,
  USERPROFILE: FAKE_HOME,
  MINDRIAN_ROOMS_HOME: path.join(FAKE_HOME, 'MindrianRooms'),
  NODE_NO_WARNINGS: '1',
});
delete CHILD_ENV.CLAUDE_ACTIVE_ROOM;

function writeFile(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

// A fixture room with normal sections only.
function normalRoom() {
  const room = tmp('t386-44-room-');
  writeFile(path.join(room, 'problem-definition', 'a.md'), '# a\n');
  writeFile(path.join(room, 'market-analysis', 'STATE.md'), '# state\n');
  writeFile(path.join(room, 'legal-ip', 'nested-one', 'nested-one.md'), '# n\n');
  writeFile(path.join(room, 'my-hyphen-section', 'b.md'), '# b\n');
  return room;
}

// The room as the bug leaves it: a folder with the literal Windows-style name.
function strayRoom(withState) {
  const room = normalRoom();
  const stray = path.join(room, WIN);
  fs.mkdirSync(path.join(stray, '.mindrian'), { recursive: true });
  if (withState) writeFile(path.join(stray, 'STATE.md'), '# stray\n');
  return room;
}

function runState(cwd, arg) {
  const r = spawnSync(process.execPath, [RENDER, 'state', arg], { cwd, env: CHILD_ENV, encoding: 'utf8' });
  return r.stdout || '';
}

function tableRows(text) {
  const rows = [];
  let inTable = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('## Sections')) { inTable = true; continue; }
    if (inTable && line.startsWith('## ')) break;
    if (inTable && line.startsWith('| ') && !line.startsWith('| Section') && !line.startsWith('|--')) {
      rows.push(line.split('|')[1].trim());
    }
  }
  return rows;
}

function pathLike(name) {
  return /[\\/]/.test(name) || /^[A-Za-z]:/.test(name);
}

function child(cwd, code) {
  const r = spawnSync(process.execPath, ['-e', code], { cwd, env: CHILD_ENV, encoding: 'utf8' });
  return { out: (r.stdout || '').trim(), err: r.stderr || '', status: r.status };
}

// ---- BR1: table rows
{
  const room = strayRoom(false);
  const rows = tableRows(runState(room, room));
  ok('BR1 section table rows hold no path-like name', rows.length > 0 && !rows.some(pathLike), JSON.stringify(rows));
}

// ---- BR2: discoverSections
{
  const room = strayRoom(true);
  const { discoverSections } = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  const all = discoverSections(room).all;
  ok('BR2 discoverSections does not list a literal path folder', !all.some(pathLike), JSON.stringify(all));
}

// ---- BR3a: Windows-style room argument, working folder is the room that holds the stray folder
{
  const room = strayRoom(false);
  const text = runState(room, WIN);
  ok('BR3a renderState with a Windows-style room argument finds no room', /No room directory found/.test(text), text.slice(0, 120));
}

// ---- BR3b: CLAUDE_ACTIVE_ROOM
{
  const room = strayRoom(false);
  const env = Object.assign({}, CHILD_ENV, { CLAUDE_ACTIVE_ROOM: WIN });
  const code = "const r=require(" + JSON.stringify(path.join(ROOT, 'lib', 'core', 'resolve-active-room.cjs')) + ").resolveActiveRoom({home:" + JSON.stringify(path.join(FAKE_HOME, 'MindrianRooms')) + "});console.log(JSON.stringify(r));";
  const r = spawnSync(process.execPath, ['-e', code], { cwd: room, env, encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  ok('BR3b CLAUDE_ACTIVE_ROOM with a Windows-style value does not resolve', out === 'null', out);
}

// ---- BR3c: registry abs_path
{
  const room = strayRoom(false);
  const reg = { rooms: { 'synthetic-room': { abs_path: WIN } }, active: 'synthetic-room' };
  const code = "const m=require(" + JSON.stringify(path.join(ROOT, 'lib', 'core', 'resolve-active-room.cjs')) + ");console.log(JSON.stringify(m.registryRoomPath(" + JSON.stringify(path.join(FAKE_HOME, 'MindrianRooms')) + ",'synthetic-room'," + JSON.stringify(reg) + ")));";
  const c = child(room, code);
  ok('BR3c a registry abs_path with a Windows-style value does not resolve', c.out === 'null', c.out);
}

// ---- BR3d: the writer
{
  const room = normalRoom();
  const code = "const m=require(" + JSON.stringify(path.join(ROOT, 'lib', 'core', 'room-db.cjs')) + ");try{const d=m.openRoomDb(" + JSON.stringify(WIN) + ");m.closeRoomDb(d);console.log('opened');}catch(e){console.log('threw:'+e.code);}";
  const c = child(room, code);
  const made = fs.readdirSync(room).filter(pathLike);
  ok('BR3d openRoomDb with a Windows-style value creates no literal folder', made.length === 0 && c.out === 'threw:EROOMPATH', c.out + ' ' + JSON.stringify(made));
}

// ---- BR3e: the helper
{
  const plat = require(path.join(ROOT, 'lib', 'core', 'platform.cjs'));
  const mount = tmp('t386-44-mnt-');
  fs.mkdirSync(path.join(mount, 'c', 'Users', 'synthetic', 'room'), { recursive: true });
  let mapped = 'missing';
  let refused = 'missing';
  let same = 'missing';
  let onWin = 'missing';
  if (typeof plat.windowsDrivePathToPosix === 'function') {
    mapped = plat.windowsDrivePathToPosix('C:\\Users\\synthetic\\room', { platform: 'linux', mountRoot: mount });
    refused = plat.windowsDrivePathToPosix('C:\\Users\\synthetic\\nope', { platform: 'linux', mountRoot: mount });
    same = plat.windowsDrivePathToPosix('/tmp/x', { platform: 'linux', mountRoot: mount });
    onWin = plat.windowsDrivePathToPosix('C:\\Users\\synthetic\\room', { platform: 'win32', mountRoot: mount });
  }
  ok('BR3e helper maps a reachable drive path, refuses an unreachable one, keeps other paths',
    mapped === path.join(mount, 'c', 'Users', 'synthetic', 'room') && refused === null && same === '/tmp/x' && onWin === 'C:\\Users\\synthetic\\room',
    JSON.stringify({ mapped, refused, same, onWin }));
}

// ---- BR4: the whole state text (what session start inserts)
{
  const room = strayRoom(false);
  const text = runState(room, room);
  const bad = text.split('\n').filter((l) => /[A-Za-z]:\\/.test(l));
  ok('BR4 state text holds no line with a drive path', bad.length === 0, JSON.stringify(bad));
}

// ---- BRP1: normal sections stay
{
  const room = normalRoom();
  const { discoverSections } = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  const all = discoverSections(room).all;
  const rows = tableRows(runState(room, room));
  const want = ['problem-definition', 'market-analysis', 'legal-ip', 'my-hyphen-section'];
  ok('BRP1 flat, STATE.md, nested-artifact and hyphenated sections are listed',
    want.every((n) => all.includes(n) && rows.includes(n)), JSON.stringify({ all, rows }));
}

// ---- BRP2: sub-room sentinel
{
  const room = normalRoom();
  writeFile(path.join(room, 'portfolio', 'inner-room', '.room-root'), '');
  writeFile(path.join(room, 'portfolio', 'inner-room', 'x.md'), '# x\n');
  const { discoverSections } = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  const all = discoverSections(room).all;
  ok('BRP2 a sub-room with a .room-root sentinel is not a section', !all.includes('portfolio'), JSON.stringify(all));
}

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

if (failures > 0) {
  console.log(failures + ' arm(s) failed');
  process.exit(1);
}
console.log('all arms passed');
