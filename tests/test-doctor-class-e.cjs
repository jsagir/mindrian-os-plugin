#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.1-02 -- RED skeleton for /mos:doctor class E detector
 * (ROOM.md / MINTO.md cascade-room-md drift).
 *
 * Covers: DOCTOR-95.1-03.
 *
 * Behavior asserted (Wave 1 Plan 95.1-05 will implement
 * checkRoomMd() in scripts/doctor.cjs):
 *   1. scratch room with .room-root + STATE.md + 3 sections, no ROOM.md/
 *      MINTO.md anywhere -> checks['room-md'].status === 'warn'
 *      AND checks['room-md'].missing has 3 entries
 *   2. same setup but all 3 sections have BOTH files
 *      -> checks['room-md'].status === 'ok'
 *      AND checks['room-md'].missing === []
 *   3. --fix dispatches scripts/generate-section-intelligence.cjs
 *      --recursive against the room and re-runs the check; expect
 *      missing === [] post-generation
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
    'mos-doctor-class-e-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

function makeScratchRoom(scratch, sections, populateMd) {
  const roomName = 'class-e-room';
  const roomDir = path.join(scratch, roomName);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# class-e-room state\n');
  for (const sectionName of sections) {
    const secDir = path.join(roomDir, sectionName);
    fs.mkdirSync(secDir, { recursive: true });
    if (populateMd) {
      fs.writeFileSync(path.join(secDir, 'ROOM.md'),
        '---\nsection: ' + sectionName + '\n---\n# ' + sectionName + '\n');
      fs.writeFileSync(path.join(secDir, 'MINTO.md'),
        '---\ntype: section-minto\nsection: ' + sectionName + '\n---\n# Governing Thought\nTBD.\n');
    }
  }
  // Registry pointing at the scratch room.
  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registry = { active: roomName, rooms: {} };
  registry.rooms[roomName] = { path: roomName };
  fs.writeFileSync(path.join(registryDir, 'registry.json'),
    JSON.stringify(registry, null, 2));
  return { scratch, roomDir, roomName };
}

function runDoctorJson(scratch, args) {
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

(function test1_threeSectionsAllMissing() {
  // RED: asserts behavior of checkRoomMd() which Wave 1 Plan 95.1-05 will implement
  const label = 'class E: 3 sections / 0 ROOM.md+MINTO.md -> warn (3 missing)';
  const scratch = makeScratchDir('e-all-missing');
  try {
    makeScratchRoom(scratch,
      ['problem-definition', 'market-analysis', 'solution-design'],
      false);
    const { stdout, status } = runDoctorJson(scratch, ['--room-md', '--json']);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const rm = report.checks['room-md'];
    assert.equal(typeof rm, 'object',
      label + ': report.checks["room-md"] must exist');
    assert.equal(rm.status, 'warn',
      label + ': status must be "warn" when sections are missing files');
    assert.equal(Array.isArray(rm.missing), true,
      label + ': missing must be an array');
    assert.equal(rm.missing.length, 3,
      label + ': missing must contain 3 entries (one per section)');
    // Each entry shape: { section, files: ['ROOM.md','MINTO.md'] }
    for (const entry of rm.missing) {
      assert.equal(typeof entry.section, 'string',
        label + ': each missing entry must carry a section string');
      assert.equal(Array.isArray(entry.files), true,
        label + ': each missing entry must carry a files array');
      assert.equal(entry.files.includes('ROOM.md'), true,
        label + ': missing files must include ROOM.md');
      assert.equal(entry.files.includes('MINTO.md'), true,
        label + ': missing files must include MINTO.md');
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test2_threeSectionsAllPopulated() {
  // RED: asserts behavior of checkRoomMd() which Wave 1 Plan 95.1-05 will implement
  const label = 'class E: 3 sections / all populated -> ok';
  const scratch = makeScratchDir('e-all-populated');
  try {
    makeScratchRoom(scratch,
      ['problem-definition', 'market-analysis', 'solution-design'],
      true);
    const { stdout, status } = runDoctorJson(scratch, ['--room-md', '--json']);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const rm = report.checks['room-md'];
    assert.equal(rm.status, 'ok',
      label + ': status must be "ok" when all sections populated');
    assert.equal(Array.isArray(rm.missing), true,
      label + ': missing must be an array');
    assert.equal(rm.missing.length, 0,
      label + ': missing must be empty when all populated');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test3_fixDispatchesGenerator() {
  // RED: asserts --fix dispatches scripts/generate-section-intelligence.cjs
  // (which Wave 1 Plan 95.1-06 will implement) and re-runs the check
  // expecting missing === []. Until BOTH the doctor --fix wiring AND the
  // generator land, this test is RED.
  const label = 'class E: --fix invokes generator -> missing empty post-fix';
  const scratch = makeScratchDir('e-fix');
  try {
    makeScratchRoom(scratch,
      ['problem-definition', 'market-analysis', 'solution-design'],
      false);
    const { stdout, status } = runDoctorJson(scratch,
      ['--room-md', '--fix', '--json']);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const rm = report.checks['room-md'];
    // After --fix the doctor SHOULD have invoked the generator + re-checked.
    // The post-fix shape: status === 'ok' OR 'fixed', missing array empty.
    assert.equal(Array.isArray(rm.missing), true,
      label + ': missing must be an array post-fix');
    assert.equal(rm.missing.length, 0,
      label + ': missing must be empty after --fix');
    // recovered field should record the generator invocation
    assert.equal(Array.isArray(report.recovered), true,
      label + ': report.recovered must be an array');
    const recoveredKey = report.recovered.some((r) =>
      typeof r === 'string'
        ? r.indexOf('generate-section-intelligence') !== -1
        : (r && r.tool === 'generate-section-intelligence')
    );
    assert.equal(recoveredKey, true,
      label + ': recovered must reference generate-section-intelligence invocation');
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
  'doctor class E (room-md cascade): ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
