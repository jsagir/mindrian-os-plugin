#!/usr/bin/env node
'use strict';
/*
 * Phase 383 plan 01 (QA383-01, D-03 single helper): one spawn chokepoint for scripts/room-registry.
 *
 * Six call sites spawn bash on scripts/room-registry by the bare name 'bash'. On Windows that name
 * can be the WSL launcher. After D-03 every site calls spawnRoomRegistry in lib/core/platform.cjs,
 * and every site that writes to disk first asks resolveRoomRuntime whether the machine can finish
 * the job. These legs read the source, with comments removed.
 *
 *   S1  no site spawns the bare name 'bash'                              (one leg per file)
 *   S2  every site calls spawnRoomRegistry(                              (one leg per file)
 *   S3  birthRoom resolves the runtime before it makes the room folder
 *   S4  autoCreatePlaceholderRoom resolves the runtime before it makes the rooms home
 *   S5  prepareRoomCreation resolves before it mints the card, and resumeFn before it births the room
 *   S6  spawnRoomRegistry never passes a shell option
 *
 * Static source reads only. No network. House rule: hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/harness-383.cjs');

const ROOT = path.resolve(__dirname, '..');
const rep = H.reporter('test-383-spawn-chokepoint');

const SITES = [
  'lib/core/navigation/room-birth.cjs',
  'lib/core/navigation/room-identity.cjs',
  'lib/core/room-open.cjs',
  'lib/core/room-auto-create.cjs',
  'lib/core/graph-backfill.cjs',
];

function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/([ \t])\/\/[ \t].*$/gm, '$1');
}
function read(rel) { return strip(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function ok(cond, what) { if (!cond) throw new Error(what); }
// The text of a function: from its header to the next line that starts a top-level function or the exports.
function body(src, header) {
  const a = src.indexOf(header);
  if (a < 0) return null;
  const rest = src.slice(a + header.length);
  const m = rest.search(/\n(?:async )?function |\nmodule\.exports/);
  return src.slice(a, m < 0 ? src.length : a + header.length + m);
}

const legs = [];
function leg(label, fn) { legs.push({ label: label, fn: fn }); }

const BARE_BASH = /\b(?:execFileSync|execFile|spawnSync|spawn)\s*\(\s*['"]bash['"]/;
for (const rel of SITES) {
  leg('S1 ' + rel + ' does not spawn the bare name bash', function () {
    ok(!BARE_BASH.test(read(rel)), 'a spawn call with the bare name bash is left in ' + rel);
  });
}
for (const rel of SITES) {
  leg('S2 ' + rel + ' calls spawnRoomRegistry(', function () {
    ok(read(rel).indexOf('spawnRoomRegistry(') !== -1, 'no spawnRoomRegistry( call in ' + rel);
  });
}

leg('S3 birthRoom resolves the runtime before it makes the room folder', function () {
  const src = read('lib/core/navigation/room-birth.cjs');
  const fn = body(src, 'function birthRoom(');
  ok(fn !== null, 'function birthRoom( not found');
  const iRes = fn.indexOf('resolveRoomRuntime(');
  const iMk = fn.indexOf('fs.mkdirSync(roomDir');
  ok(iMk >= 0, 'fs.mkdirSync(roomDir not found in birthRoom');
  ok(iRes >= 0 && iRes < iMk, 'resolveRoomRuntime( at ' + iRes + ', fs.mkdirSync(roomDir at ' + iMk);
});

leg('S4 autoCreatePlaceholderRoom resolves the runtime before it makes the rooms home', function () {
  const src = read('lib/core/room-auto-create.cjs');
  const iRes = src.indexOf('resolveRoomRuntime(');
  const iMk = src.indexOf('fs.mkdirSync(absRoomsHome');
  ok(iMk >= 0, 'fs.mkdirSync(absRoomsHome not found');
  ok(iRes >= 0 && iRes < iMk, 'resolveRoomRuntime( at ' + iRes + ', fs.mkdirSync(absRoomsHome at ' + iMk);
});

leg('S5 prepareRoomCreation resolves before it mints the card, and resumeFn before it births the room', function () {
  const src = read('lib/mcp/startup-operations.cjs');
  const fn = body(src, 'async function prepareRoomCreation(');
  ok(fn !== null, 'async function prepareRoomCreation( not found');
  const iRes = fn.indexOf('resolveRoomRuntime(');
  const iMint = fn.indexOf('mintCard(server, ctx, sessionId, {');
  ok(iMint >= 0, 'mintCard(server, ctx, sessionId, { not found in prepareRoomCreation');
  ok(iRes >= 0 && iRes < iMint, 'resolveRoomRuntime( at ' + iRes + ', mintCard( at ' + iMint);
  const r = fn.indexOf('resumeFn(');
  ok(r >= 0, 'resumeFn( not found');
  const resume = fn.slice(r);
  const iRes2 = resume.indexOf('resolveRoomRuntime(');
  const iBirth = resume.indexOf('navigation.birthRoom(');
  ok(iBirth >= 0, 'navigation.birthRoom( not found in resumeFn');
  ok(iRes2 >= 0 && iRes2 < iBirth, 'in resumeFn, resolveRoomRuntime( at ' + iRes2 + ', navigation.birthRoom( at ' + iBirth);
});

leg('S6 spawnRoomRegistry never passes a shell option', function () {
  const src = read('lib/core/platform.cjs');
  const fn = body(src, 'function spawnRoomRegistry(');
  ok(fn !== null, 'function spawnRoomRegistry( is not defined in lib/core/platform.cjs');
  ok(fn.indexOf('shell:') === -1, 'spawnRoomRegistry carries a shell: option');
});

for (const l of legs) {
  try { l.fn(); rep.pass(l.label); } catch (e) { rep.fail(l.label, String(e && e.message || e)); }
}
rep.done();
