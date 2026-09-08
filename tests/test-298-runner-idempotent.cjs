#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-runner-idempotent.cjs -- Phase 298 (harness-as-code) Plan 01, Task 3.
 *
 * Proves R-04 (tiered check, rung exit contract, converged no-op, read-only
 * door). Carries the VALIDATION.md T-298-06 through T-298-09 rows:
 *   T-298-06 R-04 tiered check: --tier filters strictly by applies_to
 *   T-298-07 R-04 rung exit contract: blocking failure exits 1; logged
 *     failure exits 0 with one JSONL line
 *   T-298-08 R-04 converged no-op: runner writes only
 *     <room>/.mindrian/harness-run.json; second run is byte-identical
 *   T-298-09 R-04 read-only door (D-03a): runner never opens the write path
 *
 * SUBJECT: scripts/run-harness.cjs
 *
 * D-03a is already encoded here as a source grep so the read-only-door rule
 * cannot be forgotten later: once SUBJECT lands, the owning plan must prove
 * `grep -c "openGraph|openRoomDbForCaller|room-db.cjs" scripts/run-harness.cjs`
 * returns 0, and that the runner never assigns to `rung` (it reports, it
 * never promotes).
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * PENDING checklist below is actually implemented -- it can never pass
 * vacuously in between.
 *
 * Run: node tests/test-298-runner-idempotent.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'scripts', 'run-harness.cjs');
const TEST_NAME = 'test-298-runner-idempotent.cjs';

const ASSERTIONS_IMPLEMENTED = false;

const PENDING = [
  '--check --tier pre-tag --json reports only policies whose applies_to contains pre-tag',
  'a temp logged policy failing exits 0 and appends exactly one JSONL row',
  'the same policy at blocking exits 1',
  'a runner: null policy reports ghost and forces converged: false',
  'two consecutive --room data/harness-fixtures/converged-room runs both exit 0 with converged: true and leave git status --porcelain empty',
  'the two reports are byte-identical',
  'data/harness-fixtures/converged-room/.mindrian does not exist afterwards',
  'D-03a: the source grep openGraph|openRoomDbForCaller|room-db.cjs over scripts/run-harness.cjs returns 0 matches',
  'R-03: the source grep for an assignment to rung in scripts/run-harness.cjs returns 0 matches (the runner never promotes)',
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
