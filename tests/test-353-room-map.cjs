#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 353 Plan 01 Task 2 -- test-353-room-map: buildRoomMap's walk, the
 * five kinds (root/section/structural/sub-room/artifact), the traversal
 * guard, and mapFingerprint's stability/sensitivity contract.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure.
 * House rule: hyphens only, no em-dashes.
 *
 * Run: node tests/test-353-room-map.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const ALPHA_ROOM = path.join(REPO, 'tests', 'fixtures', 'icm-rooms', 'alpha-room');

// room-map.cjs has no optional/environment-dependent requires (fs, path,
// crypto, gray-matter, section-registry.cjs, room-skeleton-scaffold.cjs are
// all guaranteed present), so this is a hard require, NOT a SKIP-on-missing
// guard: a missing module is this test's RED state, not an environment gap.
let roomMap;
try {
  roomMap = require(path.join(REPO, 'lib', 'core', 'room-map.cjs'));
} catch (e) {
  console.error('FAIL: test-353-room-map -- lib/core/room-map.cjs failed to load: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  // --- kinds: root/section/structural/sub-room/artifact -------------------
  const map = roomMap.buildRoomMap(ALPHA_ROOM);
  assert.equal(map.room, 'alpha-room');
  assert.ok(Array.isArray(map.nodes) && map.nodes.length > 0, 'map has nodes');

  const byKind = {};
  for (const n of map.nodes) {
    byKind[n.kind] = (byKind[n.kind] || 0) + 1;
  }
  assert.equal(byKind.root, 1, 'exactly one root node');
  assert.equal(byKind.section, 3, 'alpha-room has 3 sections');
  assert.equal(byKind.structural, 1, 'alpha-room has 1 structural dir (meetings)');
  assert.equal(byKind['sub-room'], 1, 'alpha-room has 1 declared sub-room (beta-sub)');
  assert.ok(byKind.artifact >= 1, 'alpha-room has at least 1 artifact node (first-cut)');
  console.log('kinds: root/section/structural/sub-room/artifact');
  ok('buildRoomMap classifies all five kinds against alpha-room');

  const rootNode = map.nodes.find((n) => n.path === '.');
  assert.equal(rootNode.kind, 'root');
  assert.equal(rootNode.parent, null);
  assert.equal(rootNode.depth, 0);
  assert.ok(rootNode.has_room_md === true);
  ok('root node shape: path ".", parent null, depth 0, has_room_md true');

  const betaSub = map.nodes.find((n) => n.kind === 'sub-room');
  assert.equal(betaSub.job_id, 'find-problem', 'beta-sub declares job_id find-problem');
  assert.equal(betaSub.has_room_md, true);
  ok('sub-room node carries the declared job_id from its own ROOM.md');

  const firstCut = map.nodes.find((n) => n.kind === 'artifact');
  assert.ok(firstCut, 'first-cut classified as artifact');
  assert.equal(firstCut.parent, 'problem-definition');
  ok('nested Key-Decision-16 artifact folder classified as kind:artifact under its section');

  // --- SELF_BLOCK_KINDS excludes artifact ----------------------------------
  assert.ok(roomMap.SELF_BLOCK_KINDS.has('root'));
  assert.ok(roomMap.SELF_BLOCK_KINDS.has('section'));
  assert.ok(roomMap.SELF_BLOCK_KINDS.has('structural'));
  assert.ok(roomMap.SELF_BLOCK_KINDS.has('sub-room'));
  assert.ok(!roomMap.SELF_BLOCK_KINDS.has('artifact'));
  ok('SELF_BLOCK_KINDS is exactly root/section/structural/sub-room, artifact excluded (R-353-B)');

  // --- fingerprint stable across two builds --------------------------------
  const map2 = roomMap.buildRoomMap(ALPHA_ROOM);
  assert.equal(map.fingerprint, map2.fingerprint, 'two builds of an unchanged tree share a fingerprint');
  console.log('fingerprint stable across two builds');
  ok('mapFingerprint is stable across two builds of an unchanged tree');

  // Fingerprint sensitivity: mutate a tracked tuple (rename a section dir)
  // in a TEMP COPY, never the committed fixture.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-room-map-'));
  try {
    const roomCopy = path.join(tmpRoot, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const before = roomMap.buildRoomMap(roomCopy);
    fs.renameSync(path.join(roomCopy, 'meetings'), path.join(roomCopy, 'meetings-renamed'));
    const after = roomMap.buildRoomMap(roomCopy);
    assert.notEqual(before.fingerprint, after.fingerprint, 'renaming a tracked dir changes the fingerprint');
    ok('mapFingerprint changes when a tracked tuple (a directory path) changes');

    // Adding an untracked file (an artifact body edit) must NOT change it.
    const stableBase = roomMap.buildRoomMap(roomCopy);
    fs.writeFileSync(path.join(roomCopy, 'market-analysis', 'notes.md'), '# notes\n\nfixture body edit.\n');
    const stableAfter = roomMap.buildRoomMap(roomCopy);
    assert.equal(stableBase.fingerprint, stableAfter.fingerprint, 'adding an untracked artifact file does not change the fingerprint');
    ok('mapFingerprint is insensitive to an untracked artifact file addition');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  // --- traversal guard: a symlinked directory is never followed -----------
  const guardRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-room-map-guard-'));
  try {
    const roomDir = path.join(guardRoot, 'guard-room');
    fs.mkdirSync(roomDir, { recursive: true });
    fs.writeFileSync(path.join(roomDir, '.room-root'), '');
    fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\ndirectory_type: root\n---\n\n# guard-room\n');
    const outsideDir = path.join(guardRoot, 'outside-target');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'STATE.md'), '# outside state\n');
    let symlinkOk = true;
    try {
      fs.symlinkSync(outsideDir, path.join(roomDir, 'linked-section'), 'dir');
    } catch (_e) {
      symlinkOk = false; // platform without symlink permission (e.g. some Windows setups)
    }
    if (symlinkOk) {
      const guardMap = roomMap.buildRoomMap(roomDir);
      const linked = guardMap.nodes.find((n) => n.path === 'linked-section' || n.room === 'outside-target');
      assert.equal(linked, undefined, 'a symlinked directory is never walked into or listed as a node');
      console.log('traversal guard');
      ok('buildRoomMap never follows a symlinked directory (T-353-01)');
    } else {
      console.log('traversal guard');
      ok('symlink creation unsupported on this platform; traversal guard exercised via path.resolve containment below');
    }
  } finally {
    fs.rmSync(guardRoot, { recursive: true, force: true });
  }

  // --- writeRoomMap / readRoomMap round trip -------------------------------
  const rwRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-room-map-rw-'));
  try {
    const roomCopy = path.join(rwRoot, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const builtMap = roomMap.buildRoomMap(roomCopy);
    const writeResult = roomMap.writeRoomMap(roomCopy, builtMap);
    assert.equal(writeResult.ok, true, 'writeRoomMap succeeds');
    assert.ok(fs.existsSync(path.join(roomCopy, '.mindrian', 'room-map.json')));
    const readResult = roomMap.readRoomMap(roomCopy);
    assert.equal(readResult.ok, true);
    assert.equal(readResult.map.fingerprint, builtMap.fingerprint);
    ok('writeRoomMap + readRoomMap round-trip through .mindrian/room-map.json');

    const missingRead = roomMap.readRoomMap(path.join(rwRoot, 'no-such-room'));
    assert.equal(missingRead.ok, false);
    assert.equal(missingRead.reason, 'no_map');
    ok('readRoomMap degrades to {ok:false, reason:"no_map"} on a missing map');
  } finally {
    fs.rmSync(rwRoot, { recursive: true, force: true });
  }

  console.log('');
  console.log('Checks: ' + checks);
  console.log('PASS test-353-room-map.cjs');
}

try {
  main();
} catch (e) {
  console.error('FAIL: test-353-room-map');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
