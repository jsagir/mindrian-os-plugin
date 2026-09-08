#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-contract-parity.cjs -- Phase 298 (harness-as-code) Plan 01, Task 3.
 *
 * Proves R-06 (contract parity, byte budget, frozen phrases). Carries the
 * VALIDATION.md T-298-12 and T-298-13 rows:
 *   T-298-12 R-06 contract parity: dropped phrase fails --check naming
 *     surface and phrase
 *   T-298-13 R-06 byte budget: Desktop wire <= 1,950 bytes (reads 1,944
 *     today)
 *
 * SUBJECT: data/harness-policies/contract-parity-larry.json
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * PENDING checklist below is actually implemented -- it can never pass
 * vacuously in between.
 *
 * Run: node tests/test-298-contract-parity.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'data', 'harness-policies', 'contract-parity-larry.json');
const TEST_NAME = 'test-298-contract-parity.cjs';

const ASSERTIONS_IMPLEMENTED = false;

const PENDING = [
  'deleting one pinned phrase from agents/larry-extended.md inside a try-finally makes node scripts/build-harness-manifest.cjs --check exit 1 with the surface name and the phrase in its output',
  'restoring the file makes it exit 0',
  'Buffer.byteLength(require(\'./lib/mcp/runtime-instructions.cjs\').RUNTIME_INSTRUCTIONS, \'utf8\') is less than or equal to 1950',
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
