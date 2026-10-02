'use strict';
/*
 * tests/test-349-release-wiring.cjs -- Phase 349 Plan 04 (NOTIFY-02/04/05),
 * re-pinned by quick 261002-byh (navigator ruling 2026-10-02).
 *
 * Phase 349 wired the Theo notify gate into scripts/release.sh as Step 5.6:
 * a repository_dispatch (event theo-resync) at jsagir/theo. No Theo workflow
 * ever received that event, so the navigator retired it; Step 0.55 (the
 * release-cut listener's Theo leg, quick 261002-5v9) is RULE 5 place 8's
 * leading half now. This file used to prove the Step 5.6 wiring; it now
 * proves the retirement is complete and stays complete: every piece of the
 * old wiring is gone, the unknown-flag arm rejects --no-theo-notify, Step
 * 0.55 is still in place before Step 0.6, and the sibling --no-theo-check
 * flag is untouched.
 *
 * STATIC: reads release.sh as TEXT and never executes the release script
 * (tests/test-349-dry-run-never-sends.cjs owns the live shelled proof).
 *
 * Bare node script: assert, an ok(label) counter, no framework, non-zero
 * exit on any assertion failure (uncaught throw), self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO, 'scripts', 'release.sh');
const NOTIFY_GATE = path.join(REPO, 'scripts', 'release-lib', 'theo-notify-gate.sh');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-349-release-wiring (Step 5.6 retirement, quick 261002-byh):');

const src = fs.readFileSync(RELEASE_SH, 'utf8');
const code = src.split('\n').filter(function (l) { return !/^\s*#/.test(l); }).join('\n');

{
  const r = cp.spawnSync('bash', ['-n', RELEASE_SH], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'bash -n scripts/release.sh must exit 0: ' + (r.stderr || ''));
  ok('bash -n scripts/release.sh exits 0');
}

{
  assert.equal(fs.existsSync(NOTIFY_GATE), false, 'scripts/release-lib/theo-notify-gate.sh must be deleted');
  ok('scripts/release-lib/theo-notify-gate.sh is deleted');
}

{
  assert.equal(code.indexOf('theo-notify-gate.sh'), -1, 'no non-comment line may guard or source theo-notify-gate.sh');
  assert.equal(code.indexOf('mos_theo_notify_gate'), -1, 'no non-comment line may call mos_theo_notify_gate');
  ok('no source guard, no `.` source and no call of the notify gate remain');
}

{
  assert.equal(/NO_THEO_NOTIFY/.test(code), false, 'the NO_THEO_NOTIFY flag variable must be gone');
  assert.equal(code.indexOf('--no-theo-notify'), -1, '--no-theo-notify must be gone from the case arm, USAGE_BLOCK and the dry-run listing');
  ok('NO_THEO_NOTIFY and --no-theo-notify are gone (var, case arm, USAGE_BLOCK, dry-run listing)');
}

{
  assert.equal(src.indexOf('# --- Step 5.6'), -1, 'the `# --- Step 5.6` block header must be gone');
  assert.equal(code.indexOf('Step 5.6'), -1, 'no non-comment line may print Step 5.6 (header echo or dry-run listing)');
  assert.equal(code.indexOf('theo-resync'), -1, 'no non-comment line may name the theo-resync event');
  assert.equal(code.indexOf('repository_dispatch'), -1, 'no non-comment line may fire a repository_dispatch');
  ok('Step 5.6 block, its echo, its dry-run listing and the theo-resync dispatch are gone');
}

{
  // The generic unknown-arg arm now rejects the retired flag.
  const m = src.match(/\n\s*\*\)\n\s*echo -e "\$\{RED\}unknown arg: \$arg\$\{NC\}"\n\s*echo "\$USAGE_BLOCK"\n\s*exit 1/);
  assert.ok(m, 'the generic unknown-arg arm must still exit 1');
  ok('the generic unknown-arg arm still exits 1, so --no-theo-notify is rejected');
}

{
  const i055 = src.indexOf('# --- Step 0.55');
  const i06 = src.indexOf('# --- Step 0.6:');
  assert.ok(i055 !== -1 && i06 !== -1 && i055 < i06, 'Step 0.55 (release-cut listener, Theo leg) must sit before Step 0.6');
  assert.ok(src.slice(i055, i06).indexOf('release-cut-listener.cjs') !== -1, 'Step 0.55 must call scripts/release-cut-listener.cjs');
  ok('Step 0.55 (the leading half of place 8 now) calls the release-cut listener before Step 0.6');
}

{
  assert.ok(/NO_THEO_CHECK=0/.test(src), 'NO_THEO_CHECK=0 must still be present');
  assert.ok(/--no-theo-check\)\s*NO_THEO_CHECK=1\s*;;/.test(src), '--no-theo-check case arm must still be present');
  assert.ok(/USAGE_BLOCK="[^"]*--no-theo-check\]/.test(src), '--no-theo-check must still appear in USAGE_BLOCK');
  assert.ok(/USAGE_BLOCK="[^"]*--no-cut-listener\]/.test(src), '--no-cut-listener must still appear in USAGE_BLOCK');
  ok('--no-theo-check and --no-cut-listener survive in all their locations');
}

{
  const step55Idx = src.indexOf('# --- Step 5.5');
  const step98Idx = src.indexOf('# --- Step 9.8');
  assert.ok(step55Idx !== -1 && step98Idx > step55Idx, 'Step 5.5 must still precede Step 9.8');
  const between = src.slice(step55Idx, step98Idx);
  assert.equal((between.match(/^# --- Step/gm) || []).length, 1, 'no step block may sit between Step 5.5 and Step 9.8');
  ok('Step 9.8 directly follows Step 5.5 (no step block between them)');
}

{
  const requiredHeaders = ['Step 0.55', 'Step 0.6', 'Step 2.5', 'Step 6.6', 'Step 7.5', 'Step 8', 'Step 9', 'Step 5.5', 'Step 9.6c', 'Step 9.8', 'Step 10', 'Step 11'];
  for (const header of requiredHeaders) {
    assert.ok(src.indexOf(header) !== -1, 'pre-existing step header must survive: ' + header);
  }
  ok('all other step headers survive: ' + requiredHeaders.join(', '));
}

{
  const emDash = String.fromCharCode(8212);
  assert.ok(src.indexOf(emDash) === -1, 'scripts/release.sh must contain zero em-dashes');
  const selfSrc = fs.readFileSync(__filename, 'utf8');
  assert.ok(selfSrc.indexOf(emDash) === -1, 'this test file must contain zero em-dashes');
  ok('zero em-dashes in scripts/release.sh and this test file');
}

console.log(checks + ' checks passed.');
process.exit(0);
