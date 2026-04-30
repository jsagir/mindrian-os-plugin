#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.1-02 -- RED skeleton for /mos:doctor class B detector
 * (.room-root sentinel cascade-rooms drift).
 *
 * Covers: DOCTOR-95.1-01 (B half).
 *
 * Behavior asserted (Wave 1 Plan 95.1-03 will implement the production
 * code in scripts/doctor.cjs as `checkCascadeRooms()`):
 *   1. registry has 2 rooms, only 1 has .room-root
 *      -> checks['cascade-rooms'].status === 'warn'
 *      -> checks['cascade-rooms'].missingSentinels === ['<roomName>']
 *   2. registry has 1 room, has .room-root
 *      -> checks['cascade-rooms'].status === 'ok'
 *      -> checks['cascade-rooms'].missingSentinels === []
 *   3. registry empty / missing
 *      -> checks['cascade-rooms'].status === 'skip'
 *
 * Spawns: `node scripts/doctor.cjs --cascade-rooms --json` with
 * MINDRIAN_ROOMS_HOME=<scratch> so the scan operates against the hermetic
 * scratch registry, not the user's real ~/MindrianRooms/.
 *
 * IIFE harness pattern from tests/test-cascade-side-channel.cjs.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Sandbox helpers ----------

function makeScratchDir(suffix) {
  const base = path.join(
    os.tmpdir(),
    'mos-doctor-class-b-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

// Build a scratch registry with N rooms; sentinelMap[roomName] === true
// means write a .room-root sentinel into that room. Returns the absolute
// path of the scratch ROOMS_HOME.
function makeScratchRegistry(scratch, rooms, sentinelMap) {
  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registry = { active: rooms[0] || null, rooms: {} };
  for (const roomName of rooms) {
    const roomDir = path.join(scratch, roomName);
    fs.mkdirSync(roomDir, { recursive: true });
    if (sentinelMap && sentinelMap[roomName]) {
      fs.writeFileSync(path.join(roomDir, '.room-root'), '');
    }
    registry.rooms[roomName] = { path: roomName };
  }
  fs.writeFileSync(
    path.join(registryDir, 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
  return scratch;
}

function runDoctorJson(scratch, args) {
  // Defensive (Pitfall 2 from 95.1-RESEARCH.md): every spawnSync MUST set
  // MINDRIAN_ROOMS_HOME to scratch so the scan never leaks into the user's
  // real active room.
  const opts = {
    encoding: 'utf8',
    timeout: 8000,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: scratch }),
  };
  assert.equal(typeof opts.env.MINDRIAN_ROOMS_HOME, 'string',
    'Test must set MINDRIAN_ROOMS_HOME to scratch dir to avoid leaking into real active room');
  const res = spawnSync('node', [DOCTOR].concat(args), opts);
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

// ---------- Scenarios ----------

(function test1_twoRoomsOneMissingSentinel() {
  // RED: asserts behavior of checkCascadeRooms() which Wave 1 Plan 95.1-03 will implement
  const label = 'class B: 2 rooms / 1 missing sentinel -> warn';
  const scratch = makeScratchDir('two-rooms');
  try {
    makeScratchRegistry(
      scratch,
      ['room-with-sentinel', 'room-without-sentinel'],
      { 'room-with-sentinel': true, 'room-without-sentinel': false }
    );
    const { stdout, status } = runDoctorJson(scratch, ['--cascade-rooms', '--json']);
    assert.equal(status, 0, label + ': doctor must exit 0 (graceful degradation)');
    let report;
    try {
      report = JSON.parse(stdout);
    } catch (e) {
      throw new Error(label + ': stdout must be valid JSON. Got: ' + stdout);
    }
    assert.equal(typeof report.checks, 'object',
      label + ': report.checks must be an object');
    const cr = report.checks['cascade-rooms'];
    assert.equal(typeof cr, 'object',
      label + ': report.checks["cascade-rooms"] must exist');
    assert.equal(cr.status, 'warn',
      label + ': status must be "warn" when a sentinel is missing');
    assert.equal(Array.isArray(cr.missingSentinels), true,
      label + ': missingSentinels must be an array');
    assert.equal(cr.missingSentinels.length, 1,
      label + ': missingSentinels must contain exactly the unsentineled room');
    assert.equal(cr.missingSentinels[0], 'room-without-sentinel',
      label + ': missingSentinels[0] must be the unsentineled room name');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test2_oneRoomWithSentinel() {
  // RED: asserts behavior of checkCascadeRooms() which Wave 1 Plan 95.1-03 will implement
  const label = 'class B: 1 room / has sentinel -> ok';
  const scratch = makeScratchDir('one-room-ok');
  try {
    makeScratchRegistry(scratch, ['only-room'], { 'only-room': true });
    const { stdout, status } = runDoctorJson(scratch, ['--cascade-rooms', '--json']);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const cr = report.checks['cascade-rooms'];
    assert.equal(cr.status, 'ok',
      label + ': status must be "ok" when sentinel is present');
    assert.equal(Array.isArray(cr.missingSentinels), true,
      label + ': missingSentinels must be an array');
    assert.equal(cr.missingSentinels.length, 0,
      label + ': missingSentinels must be empty');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test3_emptyOrMissingRegistry() {
  // RED: asserts behavior of checkCascadeRooms() which Wave 1 Plan 95.1-03 will implement
  const label = 'class B: empty / missing registry -> skip';
  const scratch = makeScratchDir('no-registry');
  try {
    // Intentionally do NOT call makeScratchRegistry. Scratch dir exists but
    // .rooms/registry.json is absent.
    const { stdout, status } = runDoctorJson(scratch, ['--cascade-rooms', '--json']);
    assert.equal(status, 0, label + ': doctor must exit 0 (graceful degradation)');
    const report = JSON.parse(stdout);
    const cr = report.checks['cascade-rooms'];
    assert.equal(cr.status, 'skip',
      label + ': status must be "skip" when no registry exists');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'doctor class B (cascade-rooms .room-root): ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
