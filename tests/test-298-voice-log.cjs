#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-voice-log.cjs -- Phase 298 (harness-as-code) Plan 01, Task 3.
 *
 * Proves R-08 (voice log Stop hook). Carries the VALIDATION.md T-298-18 row:
 *   T-298-18 R-08 voice log Stop hook: always {continue: true}; log line only
 *     under MINDRIAN_HOME; never throws
 *
 * SUBJECT: scripts/check-voice-style.cjs
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * PENDING checklist below is actually implemented -- it can never pass
 * vacuously in between.
 *
 * Run: node tests/test-298-voice-log.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'scripts', 'check-voice-style.cjs');
const TEST_NAME = 'test-298-voice-log.cjs';

const ASSERTIONS_IMPLEMENTED = false;

const PENDING = [
  'with process.env.MINDRIAN_HOME pointed at an fs.mkdtempSync directory, a Stop envelope whose turn text carries U+2014 produces stdout that parses to an object with continue === true, exit 0, and exactly one new line in $MINDRIAN_HOME/voice-style.jsonl',
  'a clean glyph-bearing turn produces continue === true, exit 0, and zero new lines',
  'a malformed stdin payload still produces continue === true and exit 0',
  'the emitted envelope contains no hookSpecificOutput key',
  'evaluatePromotion called twice leaves the log file mtime unchanged',
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
