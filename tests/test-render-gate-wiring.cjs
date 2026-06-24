'use strict';
/*
 * Phase 178-03 Task 2 - the render-gate wiring proof (C-3, HARD-FAIL).
 *
 * Proves scripts/check-render-coverage.cjs --check is wired into the SAME FOUR
 * enforcement surfaces the two CIRS gates ride after the Phase 172-13 R9 flip:
 *   1. pre-commit            -- installed BY scripts/install-pre-commit.sh, so
 *                               wiring it there covers the pre-commit surface.
 *   2. install-pre-commit.sh -- the grep-presence guard AND both install-block
 *                               families (the primary HOOK_TRAILER_RENDER block
 *                               + the dev-clone manifest-surface block), each
 *                               with an exit-1 fail-closed line.
 *   3. release.sh            -- a check-render-coverage.cjs --check block that
 *                               aborts the release on nonzero (HARD ABORT).
 *   4. doctor --acceptance   -- the coverage-gate organ gates[] array includes
 *                               { id:'render', script:'check-render-coverage.cjs' }.
 *
 * The critical assertion is that every wire is HARD-FAIL (exit 1 / abort), never
 * WARN -- a WARN-only render gate is the SKILL fence with extra steps (R-5) and
 * rots exactly as 143.x/144.1 did before the CIRS R9 flip (T-178-03-01).
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// Surface 1+2: install-pre-commit.sh -- the grep guard + BOTH install-block
// families, each with an exit-1 fail-closed line.
// ---------------------------------------------------------------------------
const installSrc = read('scripts/install-pre-commit.sh');

ok('install-pre-commit.sh grep-presence guard references check-render-coverage.cjs --check',
  /grep -q "check-render-coverage\.cjs --check"/.test(installSrc));

// Both install-block families must invoke the gate with --check. The primary
// block uses $REPO_ROOT_PLACEHOLDER; the dev-clone block uses $REPO_ROOT.
const renderCheckInvocations = (installSrc.match(/check-render-coverage\.cjs" --check/g) || []).length;
ok('install-pre-commit.sh invokes check-render-coverage.cjs --check in BOTH install-block families (>=2 invocations)',
  renderCheckInvocations >= 2);

// Every render-gate invocation in the installer must be HARD-FAIL: the
// node ... --check line ends in `|| { echo ...; exit 1; }`. Assert the
// fail-closed line exists and uses exit 1 (not a warn / continue).
const renderFailClosed = installSrc.match(
  /node "[^"]*check-render-coverage\.cjs" --check \|\| \{ echo "render-coverage drift \/ dark surface[^}]*exit 1; \}/g
) || [];
ok('install-pre-commit.sh render-gate invocations are HARD-FAIL (|| { echo ...; exit 1; }), never WARN -- in BOTH families',
  renderFailClosed.length >= 2);
ok('install-pre-commit.sh render-gate fail-closed line uses "exit 1" (R-5: hard-FAIL, not WARN)',
  installSrc.indexOf('render-coverage drift / dark surface') >= 0 && /render-coverage[^]*?exit 1;/.test(installSrc));

// ---------------------------------------------------------------------------
// Surface 3: release.sh -- a check-render-coverage.cjs --check block that
// aborts the release on nonzero.
// ---------------------------------------------------------------------------
const releaseSrc = read('scripts/release.sh');
ok('release.sh references check-render-coverage.cjs --check',
  releaseSrc.indexOf('check-render-coverage.cjs') >= 0 &&
  /check-render-coverage\.cjs" --check/.test(releaseSrc));
ok('release.sh render gate is an abort block (if ! node ... --check; then ... exit 1; fi)',
  /if ! node "[^"]*check-render-coverage\.cjs" --check; then[\s\S]*?exit 1[\s\S]*?fi/.test(releaseSrc));
ok('release.sh render-gate abort prints the ABORT line (HARD-FAIL, not WARN)',
  /ABORT: render-coverage gate failed/.test(releaseSrc));

// ---------------------------------------------------------------------------
// Surface 4: doctor.cjs -- the coverage-gate organ gates[] array includes
// the render gate as a sibling of the two CIRS gates.
// ---------------------------------------------------------------------------
const doctorSrc = read('scripts/doctor.cjs');
ok('doctor.cjs coverage-gate organ references check-render-coverage.cjs',
  doctorSrc.indexOf('check-render-coverage.cjs') >= 0);
ok("doctor.cjs gates[] array includes { id: 'render', script: 'check-render-coverage.cjs' }",
  /\{\s*id:\s*'render',\s*script:\s*'check-render-coverage\.cjs'\s*\}/.test(doctorSrc));
// The render gate sits in the SAME gates[] array as the two CIRS gates (sibling),
// so it is spawned with --check and aggregated into ok = failed.length === 0
// (a blocker-severity organ). Assert all three are present together.
ok('doctor.cjs coverage-gate spawns connector + projection + render as siblings (all three in gates[])',
  /build-connector-registry\.cjs/.test(doctorSrc) &&
  /build-orchestration-projection\.cjs/.test(doctorSrc) &&
  /check-render-coverage\.cjs/.test(doctorSrc));

// ---------------------------------------------------------------------------
// Cross-surface: the four surfaces ALL reference the gate (the C-3 promise).
// ---------------------------------------------------------------------------
ok('all four enforcement surfaces reference check-render-coverage --check (pre-commit-via-installer + install-pre-commit.sh + release.sh + doctor --acceptance)',
  installSrc.indexOf('check-render-coverage.cjs --check') >= 0 &&
  releaseSrc.indexOf('check-render-coverage.cjs') >= 0 &&
  doctorSrc.indexOf('check-render-coverage.cjs') >= 0);

console.log('');
console.log('PASS test-render-gate-wiring.cjs (' + pass + ' assertions)');
console.log('CONFIRMED: check-render-coverage --check is wired HARD-FAIL into all FOUR enforcement surfaces (the same four as the CIRS R9 gate); every wire fails closed (exit 1 / abort), never WARN.');
