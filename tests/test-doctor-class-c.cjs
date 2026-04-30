#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.1-02 -- RED skeleton for /mos:doctor class C detector
 * (active-room guard silence drift).
 *
 * Covers: DOCTOR-95.1-01 (C half).
 *
 * Behavior asserted (Wave 1 Plan 95.1-03 will extend checkCascadeRooms()
 * in scripts/doctor.cjs to detect the class C silence path at
 * scripts/post-write lines 207-217 where non-active-room writes exit 0
 * before write_cascade_side_channel runs):
 *   1. registry's active room is roomA, simulate a write to roomB
 *      -> checks['cascade-rooms-active'].status === 'warn'
 *      -> activeMismatch === true
 *      -> activeRoom === 'roomA', writeRoom === 'roomB'
 *   2. registry's active room is roomA, write inside roomA
 *      -> checks['cascade-rooms-active'].status === 'ok'
 *   3. no registry
 *      -> checks['cascade-rooms-active'].status === 'skip'
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
    'mos-doctor-class-c-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

// Build scratch registry with a specific active room and a list of
// existing rooms (each with .room-root + a section dir for downstream
// active-room-guard simulation).
function makeScratchRegistry(scratch, activeRoom, rooms) {
  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  for (const roomName of rooms) {
    const roomDir = path.join(scratch, roomName);
    fs.mkdirSync(path.join(roomDir, 'problem-definition'), { recursive: true });
    fs.writeFileSync(path.join(roomDir, '.room-root'), '');
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# ' + roomName + '\n');
  }
  const registry = { active: activeRoom, rooms: {} };
  for (const roomName of rooms) {
    registry.rooms[roomName] = { path: roomName };
  }
  fs.writeFileSync(
    path.join(registryDir, 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
  return scratch;
}

function runDoctorJson(scratch, args, extraEnv) {
  const env = Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: scratch }, extraEnv || {});
  const opts = { encoding: 'utf8', timeout: 8000, env };
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

(function test1_writeToNonActiveRoom() {
  // RED: asserts behavior of checkCascadeRooms() class C half which Wave 1 Plan 95.1-03 will implement
  const label = 'class C: write to non-active room -> activeMismatch warn';
  const scratch = makeScratchDir('non-active-write');
  try {
    makeScratchRegistry(scratch, 'roomA', ['roomA', 'roomB']);
    // Simulate a write inside roomB while active room is roomA. The
    // doctor's class C check should report the silenced mismatch.
    const writeTarget = path.join(scratch, 'roomB', 'problem-definition');
    const { stdout, status } = runDoctorJson(scratch,
      ['--cascade-rooms', '--json', '--simulate-write=' + writeTarget]);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const cra = report.checks['cascade-rooms-active'];
    assert.equal(typeof cra, 'object',
      label + ': report.checks["cascade-rooms-active"] must exist');
    assert.equal(cra.status, 'warn',
      label + ': status must be "warn" on active-room mismatch');
    assert.equal(cra.activeMismatch, true,
      label + ': activeMismatch must be true');
    assert.equal(cra.activeRoom, 'roomA',
      label + ': activeRoom must be roomA');
    assert.equal(cra.writeRoom, 'roomB',
      label + ': writeRoom must be roomB');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test2_writeInsideActiveRoom() {
  // RED: asserts behavior of checkCascadeRooms() class C half which Wave 1 Plan 95.1-03 will implement
  const label = 'class C: write inside active room -> ok';
  const scratch = makeScratchDir('active-write');
  try {
    makeScratchRegistry(scratch, 'roomA', ['roomA']);
    const writeTarget = path.join(scratch, 'roomA', 'problem-definition');
    const { stdout, status } = runDoctorJson(scratch,
      ['--cascade-rooms', '--json', '--simulate-write=' + writeTarget]);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const cra = report.checks['cascade-rooms-active'];
    assert.equal(cra.status, 'ok',
      label + ': status must be "ok" when write is inside active room');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test3_noRegistry() {
  // RED: asserts behavior of checkCascadeRooms() class C half which Wave 1 Plan 95.1-03 will implement
  const label = 'class C: no registry -> skip';
  const scratch = makeScratchDir('no-registry-c');
  try {
    // No registry file written.
    const { stdout, status } = runDoctorJson(scratch, ['--cascade-rooms', '--json']);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const cra = report.checks['cascade-rooms-active'];
    assert.equal(cra.status, 'skip',
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
  'doctor class C (cascade-rooms active-room guard): ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
