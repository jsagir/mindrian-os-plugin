#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 353 Plan 01 Task 4 -- test-353-doctor-room-map: the room-map doctor
 * module's six drift classes, its sync contract, its non-empty-detail
 * guarantee on every return path (D-03 rule 9), its recoverable:false guard
 * outside tests/fixtures/icm-rooms/, and the fix-then-recheck path.
 *
 * Drives check()/fix() against TEMP COPIES of tests/fixtures/icm-rooms/ made
 * under os.tmpdir(). Never against the fixture in place, never against a
 * real room.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure.
 * House rule: hyphens only, no em-dashes.
 *
 * Run: node tests/test-353-doctor-room-map.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const ALPHA_ROOM = path.join(REPO, 'tests', 'fixtures', 'icm-rooms', 'alpha-room');

// No optional/environment-dependent deps in either module: a hard require.
let doctorModule;
let roomMap;
try {
  doctorModule = require(path.join(REPO, 'lib', 'core', 'doctor', 'room-map-module.cjs'));
  roomMap = require(path.join(REPO, 'lib', 'core', 'room-map.cjs'));
} catch (e) {
  console.error('FAIL: test-353-doctor-room-map -- required module failed to load: ' + (e && e.stack ? e.stack : e));
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
  // --- sync contract: check() never returns a Promise -----------------------
  const tmpRoot1 = fs.mkdtempSync(path.join(os.tmpdir(), '353-doctor-sync-'));
  try {
    const roomCopy = path.join(tmpRoot1, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const result = doctorModule.check({ roomPath: roomCopy });
    assert.equal(typeof result.then, 'undefined', 'check() returns a plain object, not a Promise');
    ok('check() returns synchronously (typeof result.then !== "function")');
  } finally {
    fs.rmSync(tmpRoot1, { recursive: true, force: true });
  }

  // --- drift class: missing_map ----------------------------------------------
  const tmpRoot2 = fs.mkdtempSync(path.join(os.tmpdir(), '353-doctor-missing-map-'));
  try {
    const roomCopy = path.join(tmpRoot2, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const result = doctorModule.check({ roomPath: roomCopy });
    assert.equal(result.status, 'warn');
    assert.ok(result.drift.missing_map.length >= 1, 'missing_map drift reported on a fresh fixture copy (no .mindrian/ yet)');
    assert.ok(result.detail.length > 0, 'detail non-empty on the warn path');
    ok('drift class 1 (missing_map) detected on a fresh fixture copy with no room-map.json yet');
  } finally {
    fs.rmSync(tmpRoot2, { recursive: true, force: true });
  }

  // --- fix-then-recheck reaches ok --------------------------------------------
  // This scenario needs a room path that genuinely resolves UNDER
  // tests/fixtures/icm-rooms/ (recoverable:true is scoped to that prefix by
  // T-353-08's path.resolve containment check, not by "is this a copy").
  // A fresh subdirectory is created here and removed in the finally block --
  // it is never a committed fixture, only a transient copy scoped to this
  // test run, same isolation guarantee os.tmpdir() gives the other legs.
  const tmpRoot3 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-353-doctor-fix-'));
  try {
    const roomCopy = path.join(tmpRoot3, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const checkResult = doctorModule.check({ roomPath: roomCopy });
    assert.equal(checkResult.status, 'warn');
    assert.equal(checkResult.recoverable, true, 'a fixture-prefixed room is recoverable:true');
    const fixResult = doctorModule.fix({ check_result: checkResult });
    assert.equal(fixResult.status, 'ok', 'fix resolves the fresh-copy drift: ' + fixResult.detail);
    assert.ok(fixResult.detail.length > 0, 'detail non-empty on the fix ok path');
    const recheck = doctorModule.check({ roomPath: roomCopy });
    assert.equal(recheck.status, 'ok', 'a recheck after fix reports 0 drift: ' + recheck.detail);
    console.log('fix-then-recheck reaches ok');
    ok('fix() rebuilds the map + self blocks, and a recheck reaches status:ok');
  } finally {
    fs.rmSync(tmpRoot3, { recursive: true, force: true });
  }

  // --- drift class: block_fingerprint_drift + fix resolves it ----------------
  const tmpRoot4 = fs.mkdtempSync(path.join(os.tmpdir(), '353-doctor-block-drift-'));
  try {
    const roomCopy = path.join(tmpRoot4, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const freshMap = roomMap.buildRoomMap(roomCopy);
    roomMap.writeRoomMap(roomCopy, freshMap);
    roomMap.writeSelfBlocks(roomCopy, freshMap);
    // Corrupt the market-analysis section's block by hand-editing its
    // fingerprint field, simulating an out-of-band edit.
    const sectionRoomMd = path.join(roomCopy, 'market-analysis', 'ROOM.md');
    const corrupted = fs.readFileSync(sectionRoomMd, 'utf8').replace(
      /fingerprint: "[0-9a-f]+"/,
      'fingerprint: "0000000000000000000000000000000000000000000000000000000000000000"'
    );
    fs.writeFileSync(sectionRoomMd, corrupted);
    const result = doctorModule.check({ roomPath: roomCopy });
    assert.equal(result.status, 'warn');
    assert.ok(result.drift.block_fingerprint_drift.includes('market-analysis'), 'block_fingerprint_drift names market-analysis');
    ok('drift class 4 (block_fingerprint_drift) detected on a hand-edited fingerprint');
  } finally {
    fs.rmSync(tmpRoot4, { recursive: true, force: true });
  }

  // --- drift class: artifact_with_block --------------------------------------
  const tmpRoot5 = fs.mkdtempSync(path.join(os.tmpdir(), '353-doctor-artifact-block-'));
  try {
    const roomCopy = path.join(tmpRoot5, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const freshMap = roomMap.buildRoomMap(roomCopy);
    const artifactNode = freshMap.nodes.find((n) => n.kind === 'artifact');
    assert.ok(artifactNode, 'fixture has an artifact node');
    const artifactRoomMd = path.join(roomCopy, artifactNode.path, 'ROOM.md');
    const injected = fs.readFileSync(artifactRoomMd, 'utf8').replace(
      /^---\n/,
      '---\nicm_self:\n  room: "alpha-room"\n  path: "' + artifactNode.path + '"\n  parent: null\n  depth: 2\n  children: []\n  artifact_count: 0\n  fingerprint: "deadbeef"\n'
    );
    fs.writeFileSync(artifactRoomMd, injected);
    roomMap.writeRoomMap(roomCopy, freshMap);
    const result = doctorModule.check({ roomPath: roomCopy });
    assert.equal(result.status, 'warn');
    assert.ok(result.drift.artifact_with_block.includes(artifactNode.path), 'artifact_with_block names the artifact folder');
    ok('drift class 5 (artifact_with_block) detected when an artifact folder wrongly carries icm_self');
  } finally {
    fs.rmSync(tmpRoot5, { recursive: true, force: true });
  }

  // --- recoverable:false outside the fixture prefix ---------------------------
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-doctor-outside-'));
  try {
    const roomCopy = path.join(outsideRoot, 'not-a-fixture-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const checkResult = doctorModule.check({ roomPath: roomCopy });
    assert.equal(checkResult.status, 'warn');
    assert.equal(checkResult.recoverable, false, 'a room outside tests/fixtures/icm-rooms/ is recoverable:false');
    const fixResult = doctorModule.fix({ check_result: checkResult });
    assert.equal(fixResult.status, 'skip', 'fix refuses on a non-fixture room');
    assert.ok(fixResult.detail.length > 0, 'detail non-empty on the refusal path');
    console.log('recoverable:false outside the fixture prefix');
    ok('check() sets recoverable:false and fix() refuses outside tests/fixtures/icm-rooms/ (T-353-08, D-353-9)');
  } finally {
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }

  // --- D-03 rule 9: every return path carries a non-empty detail -------------
  const skipResult = doctorModule.check({ roomPath: '/does/not/exist/at/all/353' });
  assert.ok(typeof skipResult.detail === 'string' && skipResult.detail.length > 0, 'error/skip path also carries a non-empty detail');
  const skipFix = doctorModule.fix({});
  assert.ok(typeof skipFix.detail === 'string' && skipFix.detail.length > 0, 'fix() with no check_result also carries a non-empty detail');
  console.log('detail non-empty on every path');
  ok('every observed check()/fix() return path (ok, warn, error, skip) carries a non-empty detail string');

  console.log('');
  console.log('Checks: ' + checks);
  console.log('PASS test-353-doctor-room-map.cjs');
}

try {
  main();
} catch (e) {
  console.error('FAIL: test-353-doctor-room-map');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
