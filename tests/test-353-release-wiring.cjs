#!/usr/bin/env node
/**
 * Phase 353 Plan 02 Task 10: release.sh Step 2.4 offline ledger check, the
 * audited opt-out, and the step-hash re-pin.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.join(__dirname, '..');
const RELEASE_SH = path.join(REPO, 'scripts', 'release.sh');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

if (!fs.existsSync(RELEASE_SH)) {
  console.error('RED: missing scripts/release.sh');
  process.exit(1);
}

const src = fs.readFileSync(RELEASE_SH, 'utf8');

// --- exactly one build-section-command-ledger.cjs --check call site ---
const callSites = src.match(/build-section-command-ledger\.cjs["']?\s+--check/g) || [];
check('exactly one build-section-command-ledger.cjs --check call site', callSites.length === 1);

// --- the call site's byte offset falls inside the Step 2.4 block ---
const step24Idx = src.indexOf('# --- Step 2.4: coverage gates');
const step25Idx = src.indexOf('# --- Step 2.5:');
const callIdx = src.indexOf('build-section-command-ledger.cjs');
check('the call site sits inside the Step 2.4 block', step24Idx !== -1 && step25Idx !== -1 && callIdx > step24Idx && callIdx < step25Idx);

// --- --no-ledger-check appears in USAGE_BLOCK and in the case list ---
const usageLine = (src.match(/USAGE_BLOCK="[^"]*"/) || [''])[0];
check('--no-ledger-check appears in USAGE_BLOCK', usageLine.includes('--no-ledger-check'));
check('--no-ledger-check appears in the case arm list', /--no-ledger-check\)\s*NO_LEDGER_CHECK=1/.test(src));

// --- no key literal, no vendor call site literal ---
check('no TYPESAFE_API_KEY literal in release.sh', !/TYPESAFE_API_KEY/.test(src));
check('no api.typesafe.ai literal in release.sh', !/api\.typesafe\.ai/.test(src));

// --- no ACTUAL shell invocation of build-section-command-ledger.cjs
//     without --check (an "echo"'d recovery hint naming the navigator's
//     real rebuild command, deliberately without --check, is prose, not an
//     invocation this release script itself runs) ---
const invocationLines = src.split('\n').filter((line) => /build-section-command-ledger\.cjs/.test(line));
const executedWithoutCheck = invocationLines.filter((line) => {
  const trimmed = line.trim();
  if (/^echo\b/.test(trimmed)) return false; // prose, not an invocation this script runs
  return !/--check/.test(line);
});
check('every build-section-command-ledger.cjs invocation this script RUNS carries --check', executedWithoutCheck.length === 0);

// --- bash -n syntax check ---
const syntaxResult = cp.spawnSync('bash', ['-n', RELEASE_SH]);
check('bash -n scripts/release.sh exits 0', syntaxResult.status === 0);

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
