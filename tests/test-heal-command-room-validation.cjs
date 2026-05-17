#!/usr/bin/env node
'use strict';

/*
 * heal-command room-validation guard tests.
 *
 * Tests the two-layer guard added to runHeal() to prevent CWD-pollution
 * misfires (heal-command-cwd-misfire-scaffolds-spurious-sections debug session,
 * 2026-05-17).
 *
 * Covers:
 *   T1  assertIsRoom accepts a directory with .room-root
 *   T2  assertIsRoom accepts a directory with STATE.md
 *   T3  assertIsRoom accepts a directory with ROOM.md
 *   T4  assertIsRoom rejects a directory with none of the three sentinels
 *   T5  isContainerDir returns false for a single-child sentinel dir
 *   T6  isContainerDir returns true for 2+ child dirs each with .room-root
 *   T7  runHeal returns error_not_a_room on a bare directory (no dry-run)
 *   T8  runHeal returns error_container_dir on a sub-rooms container
 *   T9  runHeal proceeds past validation on a valid room (.room-root present)
 *   T10 runHeal skipRoomCheck=true bypasses both guards (explicit override)
 *   T11 Container detection names the child rooms in the error message
 *   T12 error envelopes carry exit_code=2 and error_count=10
 *
 * Exit 0 = all pass. Exit 1 = one or more failures.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const {
  runHeal,
  assertIsRoom,
  isContainerDir,
  STEP_NAMES,
} = require(path.join(REPO_ROOT, 'scripts', 'heal-command.cjs'));

// ---------- Test harness ----------

let failures = 0;
let passed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        console.log('PASS:', name);
        passed++;
      }).catch(e => {
        console.error('FAIL:', name, '-', e.message);
        failures++;
      });
    }
    console.log('PASS:', name);
    passed++;
    return Promise.resolve();
  } catch (e) {
    console.error('FAIL:', name, '-', e.message);
    failures++;
    return Promise.resolve();
  }
}

// ---------- Fixture helpers ----------

let tmpBase;

function setup() {
  tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-validation-test-'));
}

function teardown() {
  try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

function makeDir(...parts) {
  const p = path.join(tmpBase, ...parts);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function touch(filePath) {
  fs.writeFileSync(filePath, '');
}

// ---------- Tests ----------

async function runTests() {
  setup();

  // T1: assertIsRoom accepts .room-root
  await test('T1 assertIsRoom accepts .room-root sentinel', () => {
    const dir = makeDir('t1-room-root');
    touch(path.join(dir, '.room-root'));
    const result = assertIsRoom(dir);
    assert.ok(result.ok, 'expected ok=true for directory with .room-root');
    assert.ok(result.reason.includes('.room-root'), 'reason should mention .room-root');
  });

  // T2: assertIsRoom accepts STATE.md
  await test('T2 assertIsRoom accepts STATE.md sentinel', () => {
    const dir = makeDir('t2-state-md');
    touch(path.join(dir, 'STATE.md'));
    const result = assertIsRoom(dir);
    assert.ok(result.ok, 'expected ok=true for directory with STATE.md');
  });

  // T3: assertIsRoom accepts ROOM.md
  await test('T3 assertIsRoom accepts ROOM.md sentinel', () => {
    const dir = makeDir('t3-room-md');
    touch(path.join(dir, 'ROOM.md'));
    const result = assertIsRoom(dir);
    assert.ok(result.ok, 'expected ok=true for directory with ROOM.md');
  });

  // T4: assertIsRoom rejects a bare directory
  await test('T4 assertIsRoom rejects directory with no sentinels', () => {
    const dir = makeDir('t4-bare');
    const result = assertIsRoom(dir);
    assert.ok(!result.ok, 'expected ok=false for bare directory');
    assert.ok(result.reason.length > 0, 'reason should be non-empty');
  });

  // T5: isContainerDir returns false for 1 child with .room-root
  await test('T5 isContainerDir returns false for single child sentinel', () => {
    const dir = makeDir('t5-single-child');
    const child = makeDir('t5-single-child', 'only-sub-room');
    touch(path.join(child, '.room-root'));
    const result = isContainerDir(dir);
    assert.ok(!result.container, 'expected container=false for 1 child');
    assert.strictEqual(result.childRooms.length, 1);
  });

  // T6: isContainerDir returns true for 2+ children each with .room-root
  await test('T6 isContainerDir returns true for 2+ child sentinels', () => {
    const dir = makeDir('t6-container');
    for (const name of ['sub-a', 'sub-b', 'sub-c']) {
      const child = makeDir('t6-container', name);
      touch(path.join(child, '.room-root'));
    }
    const result = isContainerDir(dir);
    assert.ok(result.container, 'expected container=true for 3 child rooms');
    assert.strictEqual(result.childRooms.length, 3);
  });

  // T7: runHeal returns error_not_a_room on a bare directory
  await test('T7 runHeal returns error_not_a_room on bare directory', async () => {
    const dir = makeDir('t7-bare-heal');
    const env = await runHeal(dir, { silent: true });
    assert.strictEqual(env.summary.exit_code, 2, 'exit_code should be 2');
    assert.ok(
      env.steps.every(s => s.status === 'error_not_a_room'),
      'all steps should be error_not_a_room'
    );
    assert.strictEqual(env.summary.error_count, 10, 'error_count should be 10');
  });

  // T8: runHeal returns error_container_dir on a sub-rooms container
  await test('T8 runHeal returns error_container_dir on sub-rooms container', async () => {
    const dir = makeDir('t8-container');
    for (const name of ['room-alpha', 'room-beta']) {
      const child = makeDir('t8-container', name);
      touch(path.join(child, '.room-root'));
    }
    const env = await runHeal(dir, { silent: true });
    assert.strictEqual(env.summary.exit_code, 2, 'exit_code should be 2');
    assert.ok(
      env.steps.every(s => s.status === 'error_container_dir'),
      'all steps should be error_container_dir'
    );
  });

  // T9: runHeal proceeds past validation on a valid room (.room-root present)
  // We use dry-run to avoid touching real filesystem beyond the room dir itself.
  await test('T9 runHeal passes validation for directory with .room-root', async () => {
    const dir = makeDir('t9-valid-room');
    touch(path.join(dir, '.room-root'));
    // dry-run: will attempt steps but won't scaffold or write anything
    const env = await runHeal(dir, { silent: true, dryRun: true });
    // The envelope should NOT contain error_not_a_room or error_container_dir
    const errStatuses = env.steps
      .map(s => s.status)
      .filter(s => s === 'error_not_a_room' || s === 'error_container_dir');
    assert.strictEqual(errStatuses.length, 0, 'no validation-error steps expected');
    // room_dir in envelope should match the dir we passed
    assert.strictEqual(env.room_dir, path.resolve(dir));
  });

  // T10: skipRoomCheck bypasses both guards
  await test('T10 skipRoomCheck=true bypasses room validation', async () => {
    const dir = makeDir('t10-bypass');
    // bare directory, no sentinels -- would normally fail
    const env = await runHeal(dir, { silent: true, dryRun: true, skipRoomCheck: true });
    const errStatuses = env.steps
      .map(s => s.status)
      .filter(s => s === 'error_not_a_room' || s === 'error_container_dir');
    assert.strictEqual(errStatuses.length, 0, 'no validation-error steps with skipRoomCheck');
  });

  // T11: Container error message names the child rooms
  await test('T11 container error message names child room directories', async () => {
    const dir = makeDir('t11-container');
    for (const name of ['sanhedrin', 'motj-canon']) {
      const child = makeDir('t11-container', name);
      touch(path.join(child, '.room-root'));
    }
    const env = await runHeal(dir, { silent: true });
    const reason = env.steps[0].details.reason;
    assert.ok(reason.includes('sanhedrin') || reason.includes('motj-canon'),
      'error reason should name the child rooms, got: ' + reason);
    assert.ok(reason.includes('CONTAINER'),
      'error reason should say CONTAINER, got: ' + reason);
  });

  // T12: All error envelopes share the correct summary shape
  await test('T12 error envelopes have exit_code=2 and error_count=10', async () => {
    const dir = makeDir('t12-bare');
    const env = await runHeal(dir, { silent: true });
    assert.strictEqual(env.summary.exit_code, 2);
    assert.strictEqual(env.summary.error_count, 10);
    assert.strictEqual(env.steps.length, STEP_NAMES.length,
      'envelope should have one entry per step name');
    assert.ok(env.schema_version, 'envelope should carry schema_version');
    assert.ok(env.room_dir, 'envelope should carry room_dir');
  });

  teardown();

  console.log('');
  console.log('Results: ' + passed + ' passed, ' + failures + ' failed.');
  process.exit(failures > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
