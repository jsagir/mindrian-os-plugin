// 261108-ekl task 1: /mos:status resolves the registry active room after the explicit marker walk.
//
// Legs:
//   S1  cwd is not a room, registry names fixture-active: output names fixture-active.
//   S2  cwd holds the legacy room/ layout, registry exists: registry wins over the legacy folder.
//   S2b same legacy cwd, no registry: the legacy fallback still answers "room: room".
//   S3  cwd has a .room-root file, registry names another room: the explicit marker wins.
//   S4  no registry, cwd holds sections with ROOM.md and no root ROOM.md: the fixture pass answers.
//   S5  no registry, empty cwd: "no active room", exit 0.
//   S6  S1 with every CLAUDE_* env key removed (Tri-Polar: no CLI-only env var).
//   S7  source check: requires resolve-active-room.cjs, holds no second registry reader.
// CJS, Node built-ins only. Hermetic: no network. Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const STATUS = path.join(REPO, 'scripts', 'mos-status.cjs');

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'ekl-status-'));
function mk(rel) {
  const p = path.join(SCRATCH, rel);
  fs.mkdirSync(p, { recursive: true });
  return p;
}
function roomMd(dir, name) {
  fs.writeFileSync(path.join(dir, 'ROOM.md'), '---\nname: ' + name + '\n---\n# ' + name + '\n', 'utf8');
}
// A fixture room: root ROOM.md plus one section with ROOM.md.
function mkFixtureRoom(rel) {
  const root = mk(rel);
  roomMd(root, path.basename(root));
  const sec = path.join(root, 'problem-definition');
  fs.mkdirSync(sec, { recursive: true });
  roomMd(sec, 'problem-definition');
  return root;
}
function writeRegistry(roomsHome, slug, absPath) {
  const dir = path.join(roomsHome, '.rooms');
  fs.mkdirSync(dir, { recursive: true });
  const rooms = {};
  rooms[slug] = { path: absPath, status: 'active' };
  fs.writeFileSync(path.join(dir, 'registry.json'),
    JSON.stringify({ version: 1, active: slug, rooms: rooms }), 'utf8');
}

const HOME = mk('home');
function run(cwd, roomsHome, opts) {
  const o = opts || {};
  let env = Object.assign({}, process.env);
  if (o.stripClaude) {
    for (const k of Object.keys(env)) { if (k.indexOf('CLAUDE_') === 0) delete env[k]; }
  } else {
    env.CLAUDE_ACTIVE_ROOM = '';
  }
  env.HOME = HOME;
  env.USERPROFILE = HOME;
  env.MINDRIAN_ROOMS_HOME = roomsHome;
  const r = spawnSync(process.execPath, [STATUS], { cwd: cwd, env: env, encoding: 'utf8', timeout: 8000 });
  return { out: String(r.stdout || ''), code: r.status };
}

try {
  // The registry room and its rooms home.
  const regHome = mk('rooms-home-reg');
  const activeRoom = mkFixtureRoom('fixtures/fixture-active');
  writeRegistry(regHome, 'fixture-active', activeRoom);
  const emptyHome = mk('rooms-home-empty');

  say('S1 not a room, registry active');
  const s1cwd = mk('s1-empty');
  const s1 = run(s1cwd, regHome);
  check(s1.out.indexOf('room: fixture-active') !== -1, 'S1 names fixture-active (got: ' + s1.out.split('\n')[0] + ')');

  say('S2 legacy room/ layout, registry wins');
  const s2cwd = mk('s2-legacy');
  const legacy = path.join(s2cwd, 'room', 'market-analysis');
  fs.mkdirSync(legacy, { recursive: true });
  roomMd(legacy, 'market-analysis');
  const s2 = run(s2cwd, regHome);
  check(s2.out.indexOf('room: fixture-active') !== -1, 'S2 names fixture-active (got: ' + s2.out.split('\n')[0] + ')');
  check(s2.out.indexOf('room: room') === -1, 'S2 does not name the legacy folder');

  say('S2b legacy room/ layout, no registry');
  const s2b = run(s2cwd, emptyHome);
  check(s2b.out.indexOf('room: room') !== -1, 'S2b legacy fallback names "room" (got: ' + s2b.out.split('\n')[0] + ')');

  say('S3 explicit .room-root beats the registry');
  const s3cwd = mkFixtureRoom('fixtures/marker-room');
  fs.writeFileSync(path.join(s3cwd, '.room-root'), '', 'utf8');
  const s3 = run(s3cwd, regHome);
  check(s3.out.indexOf('room: marker-room') !== -1, 'S3 names marker-room (got: ' + s3.out.split('\n')[0] + ')');
  check(s3.out.indexOf('fixture-active') === -1, 'S3 does not name fixture-active');

  say('S4 no registry, fixture cwd layout');
  const s4cwd = mk('s4-fixture');
  const s4sec = path.join(s4cwd, 'market-analysis');
  fs.mkdirSync(s4sec, { recursive: true });
  roomMd(s4sec, 'market-analysis');
  const s4 = run(s4cwd, emptyHome);
  check(s4.out.indexOf('room: ' + path.basename(s4cwd)) !== -1, 'S4 names the cwd basename (got: ' + s4.out.split('\n')[0] + ')');

  say('S5 no registry, empty cwd');
  const s5cwd = mk('s5-empty');
  const s5 = run(s5cwd, emptyHome);
  check(s5.out.indexOf('no active room') !== -1, 'S5 prints "no active room"');
  check(s5.code === 0, 'S5 exits 0');

  say('S6 no CLAUDE_* env var');
  const s6 = run(mk('s6-empty'), regHome, { stripClaude: true });
  check(s6.out.indexOf('room: fixture-active') !== -1, 'S6 names fixture-active (got: ' + s6.out.split('\n')[0] + ')');

  say('S7 source shape');
  const src = fs.readFileSync(STATUS, 'utf8');
  check(/resolve-active-room\.cjs/.test(src), 'S7 requires resolve-active-room.cjs');
  const code = src.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); }).join('\n');
  check(code.indexOf('registry.json') === -1, 'S7 non-comment lines hold no registry.json');
  check(code.indexOf('detectActiveRoom') === -1, 'S7 no navigation.detectActiveRoom fallback');
} finally {
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

say('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
