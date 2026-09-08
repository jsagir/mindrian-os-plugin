#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-derive-health.cjs -- Phase 298 (harness-as-code) Plan 01/06, Task 3.
 *
 * Proves R-05 (derive-health gate): SUBJECT is a thin CLI wrapper over the
 * SHIPPED detector (lib/core/doctor/graph-derive-health-module.cjs), never a
 * second detector -- carries VALIDATION.md row T-298-10.
 *
 * SUBJECT: scripts/check-graph-derive-health.cjs
 *
 * Scope note (298-06): this plan's own read_first/action/locked_constraints
 * implement exactly four assertion groups -- the red case (fail/exit 1), the
 * green case (fixture skip/exit 0, unmutated), --json verbatim output, and
 * the unknown-flag exit-2 case. Two PENDING items from the original 298-01
 * stub are deliberately NOT implemented here, each for a stated reason:
 *   - "a temp policy dir with runner: null ... reports ghost and forces
 *     converged: false" (VALIDATION.md T-298-11) tests scripts/run-harness.cjs's
 *     ghost-refusal behavior, not this wrapper's. 298-10-PLAN.md and
 *     298-11-PLAN.md both register that exact case against
 *     tests/test-298-runner-idempotent.cjs instead (the runner does not exist
 *     yet -- it lands in plan 298-10).
 *   - "a throwaway-db unit test of the governance.cjs:57 proposed-node SQL
 *     path" is explicitly excluded by this plan's own locked_constraints:
 *     plan 298-04 already discharged it by extending
 *     tests/test-189-governance-candidates.cjs, which owns that harness.
 * Both remaining PENDING lines stay listed below for traceability; they are
 * not this plan's SUBJECT's job.
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * checks below are actually implemented -- it can never pass vacuously in
 * between.
 *
 * Run: node tests/test-298-derive-health.cjs
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'scripts', 'check-graph-derive-health.cjs');
const FIXTURE_ROOM = path.join(REPO_ROOT, 'data', 'harness-fixtures', 'converged-room');
const TEST_NAME = 'test-298-derive-health.cjs';

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_e) {
  process.stdout.write('SKIP ' + TEST_NAME + ' (node:sqlite unavailable)\n');
  process.exit(0);
}

const ASSERTIONS_IMPLEMENTED = true;

const PENDING = [
  'a temp policy dir with runner: null for gate-graph-derive-health reports ghost and forces converged: false -- owned by tests/test-298-runner-idempotent.cjs (plan 298-10/298-11), not this wrapper',
  'a throwaway-db unit test of the governance.cjs:57 proposed-node SQL path -- discharged by plan 298-04 via tests/test-189-governance-candidates.cjs, not built a second time here',
];

let passCount = 0;
let failCount = 0;
function record(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
    passCount += 1;
  } catch (err) {
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : err) + '\n');
    failCount += 1;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertion failed') + ' -- expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertTrue(actual, msg) {
  if (!actual) {
    throw new Error((msg || 'assertion failed') + ' -- expected a truthy value, got ' + JSON.stringify(actual));
  }
}

// -- Throwaway room.db builder ------------------------------------------
//
// Built with node:sqlite DIRECTLY (not via lib/core/room-db.cjs), so
// node:sqlite is required by exactly one new 298 test file, per this plan's
// own action text. Schema mirrors lib/core/lazygraph-ops.cjs::initSchema's
// nodes/edges tables (the minimal columns detectRoomHealth's
// countEdgesOfTypes query reads: edges.type).
function buildDamagedRoomDb(roomDir) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(mindrianDir, { recursive: true });
  const dbPath = path.join(mindrianDir, 'room.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS nodes (" +
      "  id TEXT PRIMARY KEY," +
      "  type TEXT NOT NULL," +
      "  properties TEXT DEFAULT '{}'" +
      ");" +
      "CREATE TABLE IF NOT EXISTS edges (" +
      "  source TEXT NOT NULL," +
      "  target TEXT NOT NULL," +
      "  type TEXT NOT NULL," +
      "  properties TEXT DEFAULT '{}'," +
      "  PRIMARY KEY (source, target, type)" +
      ");"
    );
    db.prepare("INSERT INTO nodes (id, type) VALUES (?, ?)").run('n0', 'artifact');
    db.prepare("INSERT INTO nodes (id, type) VALUES (?, ?)").run('section0', 'section');
    // Structural section-membership edge only -- zero cascade edges. This is
    // the exact needsHeal shape the module's own header describes: BELONGS_TO
    // present, cascade count zero.
    db.prepare("INSERT INTO edges (source, target, type) VALUES (?, ?, ?)")
      .run('n0', 'section0', 'BELONGS_TO');
  } finally {
    db.close();
  }
}

function main() {
  if (!fs.existsSync(SUBJECT)) {
    process.stdout.write('SKIP ' + TEST_NAME + ' (missing ' + SUBJECT + ')\n');
    process.exit(0);
  }

  if (!ASSERTIONS_IMPLEMENTED) {
    process.stdout.write('FAIL ' + TEST_NAME + ': subject landed but assertions are still a stub\n');
    process.stdout.write('PENDING:\n');
    PENDING.forEach((line) => process.stdout.write('  - ' + line + '\n'));
    process.exit(1);
  }

  const healthMod = require(path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'graph-derive-health-module.cjs'));

  // -- Red case: a damaged throwaway room -------------------------------

  let damagedRoom = null;
  try {
    damagedRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-298-derive-health-'));
    buildDamagedRoomDb(damagedRoom);

    let inProcessResult;
    record('in-process detectRoomHealth() on the damaged room reports fail', () => {
      inProcessResult = healthMod.detectRoomHealth(damagedRoom);
      assertEqual(inProcessResult.status, 'fail', 'damaged room status');
      assertEqual(inProcessResult.needsHeal, true, 'damaged room needsHeal');
    });

    record('spawned wrapper on the damaged room exits 1 with status fail in --json', () => {
      const res = spawnSync('node', [SUBJECT, '--room', damagedRoom, '--json'], { encoding: 'utf8' });
      assertEqual(res.status, 1, 'exit status');
      const parsed = JSON.parse(res.stdout);
      assertEqual(parsed.status, 'fail', 'reported status');
    });

    record('--json output key set matches the in-process detectRoomHealth() key set', () => {
      const res = spawnSync('node', [SUBJECT, '--room', damagedRoom, '--json'], { encoding: 'utf8' });
      const parsed = JSON.parse(res.stdout);
      const spawnedKeys = Object.keys(parsed).sort();
      const inProcessKeys = Object.keys(inProcessResult).sort();
      assertEqual(JSON.stringify(spawnedKeys), JSON.stringify(inProcessKeys), 'key set');
    });
  } finally {
    if (damagedRoom) fs.rmSync(damagedRoom, { recursive: true, force: true });
  }

  // -- Green case: the committed converged-room fixture ------------------

  record('spawned wrapper on the committed fixture exits 0 with status skip', () => {
    const res = spawnSync('node', [SUBJECT, '--room', FIXTURE_ROOM, '--json'], { encoding: 'utf8' });
    assertEqual(res.status, 0, 'exit status');
    const parsed = JSON.parse(res.stdout);
    assertEqual(parsed.status, 'skip', 'reported status');
  });

  record('the fixture run never mutated the fixture', () => {
    assertEqual(fs.existsSync(path.join(FIXTURE_ROOM, '.mindrian')), false, 'no .mindrian directory was created');
    const res = spawnSync('git', ['status', '--porcelain', FIXTURE_ROOM], { cwd: REPO_ROOT, encoding: 'utf8' });
    assertEqual(res.status, 0, 'git status exit code');
    assertEqual(res.stdout.trim(), '', 'git status --porcelain output for the fixture');
  });

  // -- Flag cases ----------------------------------------------------------

  record('an unknown flag exits 2', () => {
    const res = spawnSync('node', [SUBJECT, '--bogus-flag'], { encoding: 'utf8' });
    assertEqual(res.status, 2, 'exit status');
    assertTrue(/^check-graph-derive-health:/.test(res.stderr), 'stderr is script-name-prefixed');
  });

  record('--room with no value exits 2', () => {
    const res = spawnSync('node', [SUBJECT, '--room'], { encoding: 'utf8' });
    assertEqual(res.status, 2, 'exit status');
  });

  if (failCount > 0) {
    process.stdout.write(TEST_NAME + ': ' + passCount + ' passed, ' + failCount + ' failed\n');
    process.exit(1);
  }
  process.stdout.write(TEST_NAME + ': ' + passCount + ' passed, 0 failed\n');
  process.exit(0);
}

main();
