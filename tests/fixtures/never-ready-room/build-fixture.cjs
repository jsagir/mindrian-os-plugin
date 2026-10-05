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

module.exports = { buildNeverReadyRoom };

if (require.main === module) {
  try {
    const result = buildNeverReadyRoom(process.argv[2], { slug: process.argv[3] });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (e) {
    process.stderr.write(String((e && e.message) || e) + '\n');
    process.exit(1);
  }
}
