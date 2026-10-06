#!/usr/bin/env node
'use strict';
/*
 * 369.25 Phase 0 (plan 01): the ONE never-ready room fixture.
 *
 * A never-ready room is the shape a session produces when the room skeleton is scaffolded and work is
 * written into it by plain file writes, but no room.db was ever created, no identity was ever committed
 * and no registry entry was ever made: scaffoldRoomSkeleton says ready:false, room_db:false (quick 261005-l9o)
 * and nothing afterwards opens the room through birthRoom.
 *
 * buildNeverReadyRoom(targetDir, { slug }) builds that room under <targetDir>/rooms/<slug>:
 *   - a .room-root sentinel (the same JSON shape birthRoom writes), no .mindrian/room.db, no registry entry
 *   - scaffoldRoomSkeleton (the eleven core section folders and their ROOM.md / CONTEXT.md / MINTO.md ...)
 *   - eleven artifacts by plain fs.writeFileSync, one per core section (lib/core/section-registry.cjs CORE_SECTIONS)
 * and returns { roomDir, artifacts: [11 absolute paths] }.
 *
 * Reused as: the RED half of RFT-09 (plan 09), failure test 1 (plan 13), the real-room negative leg (plan 23).
 * No second never-ready fixture is minted anywhere.
 *
 * Safety (threat T-369.25-01-04): writes only under targetDir; refuses a targetDir under ~/MindrianRooms or
 * ~/.mindrian (the real home and the HOME env value are both checked). Run as a script:
 *   node tests/fixtures/never-ready-room/build-fixture.cjs <targetDir> [slug]
 * prints the result JSON on stdout. Hyphens only; no network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

function forbiddenRoots() {
  const homes = new Set();
  [process.env.HOME, process.env.USERPROFILE, os.homedir()].forEach((h) => { if (h) homes.add(path.resolve(h)); });
  try { homes.add(path.resolve(os.userInfo().homedir)); } catch (_e) { /* no passwd entry */ }
  const out = [];
  homes.forEach((h) => { out.push(path.join(h, 'MindrianRooms')); out.push(path.join(h, '.mindrian')); });
  return out;
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function buildNeverReadyRoom(targetDir, opts) {
  const options = opts || {};
  const slug = options.slug || 'never-ready-fixture';
  if (!targetDir || typeof targetDir !== 'string') throw new Error('buildNeverReadyRoom: targetDir must be a string');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('buildNeverReadyRoom: slug must be lowercase letters, digits and hyphens');
  const target = path.resolve(targetDir);
  forbiddenRoots().forEach((f) => {
    if (isInside(target, f)) throw new Error('buildNeverReadyRoom: refusing a target under ' + f);
  });
  const roomDir = path.join(target, 'rooms', slug);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), JSON.stringify({ room: slug, active: true, born: new Date().toISOString() }), 'utf8');

  const scaffold = require(path.join(ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'));
  const s = scaffold.scaffoldRoomSkeleton(roomDir, { blueprintFamily: 'venture' });
  if (!s || s.ok !== true) throw new Error('buildNeverReadyRoom: scaffold failed ' + JSON.stringify(s && s.errors));

  const sections = Object.keys(require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs')).CORE_SECTIONS);
  const artifacts = sections.map((name) => {
    const dir = path.join(roomDir, name);
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'phase0-' + name + '-note.md');
    fs.writeFileSync(f, '# Phase 0 note for ' + name + '\n\nThis is synthetic fixture text for the ' + name + ' section.\nIt was written by a plain file write, not through the governed path.\n', 'utf8');
    return f;
  });
  return { roomDir, artifacts };
}

/*
 * 369.25 plan 27 (Larry's leg B): the THIRD negative-leg room, injection room_db_reminted.
 *
 * buildRemintedRoom(targetDir, { slug }) builds a room under <targetDir>/rooms/<slug> through the REAL birth path
 * (lib/core/navigation/room-birth.cjs birthRoom: identity in room.db, the room_id projected to .room-root, the faces
 * and the graph work birth writes), then removes room.db with its -wal and -shm, then performs the SILENT MINTING OPEN:
 * a plain lib/core/room-db.cjs openRoomDb call, which is exactly what a hook or a forgetful path does and which leaves
 * an empty identity-less database behind. The recorded id stays in .room-root.
 *
 * Birth runs in a CHILD process whose HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are <targetDir>/home and
 * <targetDir>/rooms, so the registry entry birth writes lands under targetDir and never in the navigator's rooms home
 * (the run's own env may point at it). Same safety guard as buildNeverReadyRoom. Returns
 * { roomDir, slug, room_id, nodes_before, nodes_after_mint }. No network.
 */
const REMINT_CHILD = [
  "'use strict';",
  "const fs = require('node:fs'); const path = require('node:path');",
  "const a = JSON.parse(process.argv[1]);",
  "const birth = require(path.join(a.root, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({",
  "  slug: a.slug, roomDir: a.roomDir, sessionId: 'negative-leg-reminted', ventureText: 'A fixture venture for the negative leg',",
  "  jtbd: '', approvedBy: 'negative-leg', canonicalRole: 'founder', vname: a.slug, vstage: 'Pre-Opportunity' });",
  "if (!birth || birth.ok !== true) { process.stderr.write('birth failed ' + JSON.stringify(birth).slice(0, 300)); process.exit(3); }",
  "const roomDb = require(path.join(a.root, 'lib', 'core', 'room-db.cjs'));",
  "const count = () => { const d = roomDb.openRoomDb(a.roomDir); try { return d.prepare('SELECT count(*) AS c FROM nodes').get().c; } finally { d.close(); } };",
  "const before = count();",
  "['', '-wal', '-shm'].forEach((x) => { try { fs.rmSync(path.join(a.roomDir, '.mindrian', 'room.db' + x), { force: true }); } catch (e) { /* none */ } });",
  "const afterMint = count();",  // this open IS the silent mint
  // settle the sidecars: the first read-only open of a WAL database leaves an empty -wal and a -shm behind, so a room
  // that has been opened once already holds them and a later read (the readiness check) changes no byte of the tree
  "require(path.join(a.root, 'lib', 'core', 'navigation', 'room-identity.cjs')).readRoomIdentity(a.roomDir, { door: 'in_place' });",
  "const root = JSON.parse(fs.readFileSync(path.join(a.roomDir, '.room-root'), 'utf8'));",
  "process.stdout.write(JSON.stringify({ room_id: root.room_id || null, nodes_before: before, nodes_after_mint: afterMint }) + '\\n');",
].join('\n');

function buildRemintedRoom(targetDir, opts) {
  const options = opts || {};
  const slug = options.slug || 'reminted-fixture';
  if (!targetDir || typeof targetDir !== 'string') throw new Error('buildRemintedRoom: targetDir must be a string');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('buildRemintedRoom: slug must be lowercase letters, digits and hyphens');
  const target = path.resolve(targetDir);
  forbiddenRoots().forEach((f) => {
    if (isInside(target, f)) throw new Error('buildRemintedRoom: refusing a target under ' + f);
  });
  const home = path.join(target, 'home');
  const roomsHome = path.join(target, 'rooms');
  const roomDir = path.join(roomsHome, slug);
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(roomsHome, { recursive: true });
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: roomsHome });
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.MINDRIAN_ACTIVE_SESSION_ID;
  const r = require('node:child_process').spawnSync(process.execPath, ['-e', REMINT_CHILD, JSON.stringify({ root: ROOT, slug: slug, roomDir: roomDir })], {
    encoding: 'utf8', env: env, timeout: 180000, maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error('buildRemintedRoom: child failed (' + r.status + ') ' + String(r.stderr || '').slice(-300));
  const lines = String(r.stdout || '').split('\n').map((l) => l.trim()).filter((l) => l[0] === '{');
  const info = JSON.parse(lines[lines.length - 1]);
  return { roomDir: roomDir, slug: slug, room_id: info.room_id, nodes_before: info.nodes_before, nodes_after_mint: info.nodes_after_mint };
}

module.exports = { buildNeverReadyRoom, buildRemintedRoom };

if (require.main === module) {
  try {
    const result = buildNeverReadyRoom(process.argv[2], { slug: process.argv[3] });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (e) {
    process.stderr.write(String((e && e.message) || e) + '\n');
    process.exit(1);
  }
}
