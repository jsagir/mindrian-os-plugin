#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-policies-schema.cjs -- Phase 298 (harness-as-code) Plan 01, Task 3.
 *
 * Proves R-02 (policy schema, closed and validated) and R-03 (the rung ladder;
 * a policy's declared rung is one of declared/logged/blocking, and the runner
 * never mints one). Carries the VALIDATION.md T-298-03 and T-298-04 rows for
 * this test file:
 *   T-298-03 R-02 policy schema: closed schema; unknown key rejected at --check
 *   T-298-04 R-02 gate reachability: every `runner` path resolves inside the
 *     repo root (no traversal)
 *
 * SUBJECT: data/harness-policies/_schema.json
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * PENDING checklist below is actually implemented -- it can never pass
 * vacuously in between.
 *
 * Run: node tests/test-298-policies-schema.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'data', 'harness-policies', '_schema.json');
const TEST_NAME = 'test-298-policies-schema.cjs';

const ASSERTIONS_IMPLEMENTED = false;

const PENDING = [
  'every file in data/harness-policies/ except _schema.json and CONTEXT.md validates against the schema',
  'an unknown key on any policy file is rejected by build-harness-manifest.cjs --check',
  'every policy declares rung in [\'declared\', \'logged\', \'blocking\']',
  'every policy declares kind in [\'gate\', \'voice\', \'memory\', \'contract\']',
  'every policy runner is either null or a repo-relative path that resolves inside REPO_ROOT and exists',
  'every policy promotion_rule carries window_runs, max_false_positive_rate, min_true_positives',
  'every policy applies_to is drawn from [\'pre-flight\', \'pre-tag\', \'full\', \'stop-hook\', \'room\']',
  'zero unintentional ghosts among the gate-* policies',
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
