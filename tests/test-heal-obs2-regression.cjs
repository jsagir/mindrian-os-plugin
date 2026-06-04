'use strict';
/*
 * tests/test-heal-obs2-regression.cjs -- Phase 139 Plan 01 Task 2.
 *
 * OBS-2 regression: running heal from a NON-room cwd (simulating ~/dev/<repo>)
 * must make ZERO room-artifact writes to that target. The room guards
 * (isContainerDir + assertIsRoom) fire BEFORE any .mindrian/ mkdir,
 * heal-log.json write, or .heal-backup/ creation.
 *
 * Hermetic (mkdtempSync). Asserts:
 *   (a) the return envelope error is error_not_a_room (or error_container_dir)
 *   (b) fs.existsSync(scratch/.mindrian) is FALSE
 *   (c) fs.existsSync(scratch/.mindrian/heal-log.json) is FALSE
 *   (d) fs.existsSync(scratch/.heal-backup) is FALSE
 *
 * Zero room-artifact writes is the OBS-2 floor.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { runHeal } = require('../scripts/heal-command.cjs');

let passed = 0;
function ok(name) { passed++; console.log('  ok  ' + name); }

(async function main() {
  // Build a NON-room scratch dir that looks like a plain code repo:
  // a .git/ dir + a package.json, and crucially NO .room-root / NO ROOM.md /
  // NO STATE.md (the three sentinels assertIsRoom recognizes).
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-obs2-'));
  fs.mkdirSync(path.join(scratch, '.git'), { recursive: true });
  fs.writeFileSync(
    path.join(scratch, 'package.json'),
    JSON.stringify({ name: 'some-code-repo', version: '0.0.0' }, null, 2),
    'utf8'
  );

  // Sanity: the scratch dir carries none of the room sentinels.
  for (const s of ['.room-root', 'ROOM.md', 'STATE.md']) {
    assert.strictEqual(
      fs.existsSync(path.join(scratch, s)), false,
      'precondition: scratch must NOT contain ' + s
    );
  }

  const env = await runHeal(scratch, { silent: true });

  // (a) envelope error is error_not_a_room (or error_container_dir).
  const firstStatus = (env.steps && env.steps[0] && env.steps[0].status) || null;
  const validErrors = ['error_not_a_room', 'error_container_dir'];
  assert.ok(
    validErrors.indexOf(firstStatus) !== -1,
    'expected error_not_a_room/error_container_dir, got: ' + firstStatus
  );
  assert.strictEqual(env.summary.exit_code, 2, 'rejected target -> exit_code 2');
  assert.strictEqual(env.summary.error_count, 10, 'all steps marked error on rejection');
  ok('(a) non-room target rejected with ' + firstStatus + ' (exit 2)');

  // (b) NO .mindrian/ directory written to the rejected target.
  assert.strictEqual(
    fs.existsSync(path.join(scratch, '.mindrian')), false,
    'OBS-2 breach: .mindrian/ was written to a non-room target'
  );
  ok('(b) no .mindrian/ written to non-room target');

  // (c) NO heal-log.json written.
  assert.strictEqual(
    fs.existsSync(path.join(scratch, '.mindrian', 'heal-log.json')), false,
    'OBS-2 breach: .mindrian/heal-log.json was written to a non-room target'
  );
  ok('(c) no .mindrian/heal-log.json written');

  // (d) NO .heal-backup/ written.
  assert.strictEqual(
    fs.existsSync(path.join(scratch, '.heal-backup')), false,
    'OBS-2 breach: .heal-backup/ was written to a non-room target'
  );
  ok('(d) no .heal-backup/ written');

  // Final floor: the ONLY entries in scratch are the ones the test created.
  const entries = fs.readdirSync(scratch).sort();
  assert.deepStrictEqual(
    entries, ['.git', 'package.json'],
    'OBS-2 floor: scratch must contain ONLY pre-existing entries, found: ' + entries.join(', ')
  );
  ok('(floor) scratch dir unchanged: only .git + package.json remain');

  console.log('\nheal-obs2-regression: ' + passed + ' assertions passed.');
})().catch(function (e) {
  console.error('FAIL: ' + (e && e.message));
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});
