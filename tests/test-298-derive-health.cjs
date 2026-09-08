#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-derive-health.cjs -- Phase 298 (harness-as-code) Plan 01, Task 3.
 *
 * Proves R-05 (derive-health gate, ghost refusal). Carries the VALIDATION.md
 * T-298-10 and T-298-11 rows:
 *   T-298-10 R-05 derive-health: thin wrapper over detectRoomHealth(); no
 *     second detector
 *   T-298-11 R-05 ghost refusal: a ghost gate is the "missing information"
 *     class -- refuse converged: true, never retry
 *
 * SUBJECT: scripts/check-graph-derive-health.cjs
 *
 * This file also hosts the D-03 throwaway-db governance.cjs:57 proposed-node
 * SQL unit test (per 298-VALIDATION.md Wave 0 requirements and
 * 298-PATTERNS.md), so node:sqlite is required in exactly one new test file
 * in this phase. Guard the whole file on node:sqlite availability with the
 * try/catch SKIP pattern used at tests/test-189-governance-candidates.cjs:21-27.
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * PENDING checklist below is actually implemented -- it can never pass
 * vacuously in between.
 *
 * Run: node tests/test-298-derive-health.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'scripts', 'check-graph-derive-health.cjs');
const TEST_NAME = 'test-298-derive-health.cjs';

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_e) {
  process.stdout.write('SKIP ' + TEST_NAME + ' (node:sqlite unavailable)\n');
  process.exit(0);
}
void DatabaseSync;

const ASSERTIONS_IMPLEMENTED = false;

const PENDING = [
  'a throwaway node:sqlite room.db carrying BELONGS_TO edges and zero cascade edges yields detectRoomHealth().status === \'fail\' and the wrapper exits 1',
  'the committed fixture yields status === \'skip\' and the wrapper exits 0',
  '--json prints the returned object verbatim',
  'an unknown flag exits 2',
  'a temp policy dir with runner: null for gate-graph-derive-health reports ghost and forces converged: false',
  'a throwaway-db unit test of the governance.cjs:57 proposed-node SQL path',
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

  // The owning plan fills the real assertions here, using `record()` /
  // `assertEqual()` above, then reports passCount/failCount below.
  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
