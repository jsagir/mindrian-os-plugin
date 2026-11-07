#!/usr/bin/env node
'use strict';
// Phase 384 plan 20, Task 1: path-rule probe on synthetic folders only.
//
// Question: which path layouts run the post-write cascade and which skip it?
// Method: build one small room per layout in a temporary base folder, call
// `node scripts/mindrian-tools.cjs cascade <roomDir> <file> --raw` on the
// section ROOM.md file, and read the skip reason. The reason
// "filePath not inside a room directory" means the path rule failed. The reason
// "ROOM.md is not an artifact" means the path rule passed (the basename skip is
// the next guard and is cheap). In bash the glob that scripts/post-write uses
// for its room check is evaluated on the same path.
//
// Canon Part 8: no real room, registry or home folder is read. All folders are
// made here under os.tmpdir(). The output holds booleans and constant strings
// only, no path.
//
// Usage:
//   node s2-path-rule-probe.cjs [--out <file>]     run all 7 layouts
//   node s2-path-rule-probe.cjs --selftest         run a pair of layouts, exit 0 on success

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const SKIP_NOT_ROOM = 'filePath not inside a room directory';
const SKIP_ROOM_MD = 'ROOM.md is not an artifact';

// The default rooms home folder name is a constant of the code. Read the
// constant from the source text of lib/core/session-binding.cjs.
function defaultRoomsHomeName() {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'session-binding.cjs'), 'utf8');
  const m = src.match(/path\.join\(os\.homedir\(\),\s*'([^']+)'\)/);
  if (!m) throw new Error('default rooms home constant not found');
  return m[1];
}

function bashGlob(p) {
  const r = spawnSync('bash', ['-c',
    'p="$1"; if [[ "$p" == */room/* ]] || [[ "$p" == */rooms/* ]]; then echo yes; else echo no; fi',
    'bash', p], { encoding: 'utf8', timeout: 10000 });
  return r.stdout.trim() === 'yes';
}

function buildRoom(roomDir) {
  fs.mkdirSync(path.join(roomDir, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# state\n');
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'sec', 'ROOM.md'), '# section\n');
  fs.writeFileSync(path.join(roomDir, 'sec', 'a.md'), '# artifact\n');
}

function runCascade(roomDir, file, home) {
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' };
  const r = spawnSync('taskset', ['-c', '0-3', process.execPath,
    path.join(REPO, 'scripts', 'mindrian-tools.cjs'), 'cascade', roomDir, file, '--raw'],
    { encoding: 'utf8', timeout: 60000, env, cwd: home });
  let reason = null;
  try {
    const j = JSON.parse(r.stdout);
    reason = j.skipReason || null;
  } catch (_) { /* leave null */ }
  return { reason, status: r.status };
}

function probe(layouts, base, home) {
  const rows = [];
  for (const L of layouts) {
    const roomDir = path.join(base, ...L.parts);
    buildRoom(roomDir);
    const file = path.join(roomDir, 'sec', 'ROOM.md');
    const res = runCascade(roomDir, file, home);
    const passed = res.reason === SKIP_ROOM_MD ? true : (res.reason === SKIP_NOT_ROOM ? false : null);
    const glob = bashGlob(file);
    rows.push({
      layout: L.id,
      shape: L.shape,
      path_rule_passed: passed,
      bash_glob_matches: glob,
      agree: passed !== null && passed === glob,
      skip_reason: res.reason
    });
  }
  return rows;
}

function makeBase() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s2-'));
  // The base path itself must hold neither /room/ nor /rooms/, or every layout would pass.
  if (/\/rooms?\//.test(base + '/')) {
    fs.rmSync(base, { recursive: true, force: true });
    throw new Error('temporary base path holds a room segment; set TMPDIR to another folder');
  }
  const home = path.join(base, 'home');
  fs.mkdirSync(home, { recursive: true });
  return { base, home };
}

function main() {
  const argv = process.argv.slice(2);
  const selftest = argv.includes('--selftest');
  const oi = argv.indexOf('--out');
  const out = oi >= 0 ? argv[oi + 1] : null;
  const { base, home } = makeBase();
  try {
    const homeName = defaultRoomsHomeName();
    const all = [
      { id: 'L1', shape: 'base/room/n', parts: ['room', 'n'] },
      { id: 'L2', shape: 'base/rooms/n', parts: ['rooms', 'n'] },
      { id: 'L3', shape: 'base/<default rooms home>/n', parts: [homeName, 'n'] },
      { id: 'L4', shape: 'base/proj/.planning/phases/x', parts: ['proj', '.planning', 'phases', 'x'] },
      { id: 'L5', shape: 'base/Rooms/n', parts: ['Rooms', 'n'] },
      { id: 'L6', shape: 'base/my-room/n', parts: ['my-room', 'n'] },
      { id: 'L7', shape: 'base/team-rooms/n', parts: ['team-rooms', 'n'] }
    ];
    if (selftest) {
      const rows = probe([all[1], all[3]], base, home);
      const ok = rows[0].path_rule_passed === true && rows[0].bash_glob_matches === true &&
        rows[1].path_rule_passed === false && rows[1].bash_glob_matches === false &&
        rows.every(r => r.agree);
      process.stdout.write(ok ? 'selftest ok\n' : 'selftest FAIL ' + JSON.stringify(rows) + '\n');
      process.exitCode = ok ? 0 : 1;
      return;
    }
    const rows = probe(all, base, home);
    const result = {
      schema: 'mos.path-rule-384/1',
      default_rooms_home_folder: homeName,
      rule: 'path contains /room/ or /rooms/',
      rows
    };
    const text = JSON.stringify(result, null, 2) + '\n';
    if (out) fs.writeFileSync(out, text); else process.stdout.write(text);
    process.exitCode = rows.every(r => r.agree) ? 0 : 1;
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

main();
