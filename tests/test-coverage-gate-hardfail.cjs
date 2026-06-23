'use strict';
/*
 * Phase 172-13 - the coverage-gate hard-FAIL adversarial test (Task 3, TDD).
 *
 * Proves, BY CONSTRUCTION, that the Phase 172-13 "full flip" makes the connector
 * coverage gate a HARD FAIL on an accidental-dark surface (Canon Part 11
 * R2/R9/INV-10 step 3), while leaving the real repo GREEN and an EXCLUDED-with-
 * reason surface conformant.
 *
 *   Test 1: a synthesized dark surface (no connector block) classifies `gap`,
 *           and --check exits non-zero when that surface is present.
 *   Test 2: a synthesized excluded surface (excluded:true + reason) classifies
 *           `excluded` with no error -- it does NOT trip the gate.
 *   Test 3: the clean live repo passes --check exit 0 (the fixtures live under
 *           tests/fixtures/, never walked by the live generator).
 *   Test 4: the gate FAIL message names the offending surface + the recovery line.
 *
 * The dark/excluded fixtures live under tests/fixtures/coverage-gate-dark/ and
 * are NEVER walked by the live generator's listSourceFiles() (commands/ +
 * skills/ + agents/ only). Test 1/4 prove the end-to-end exit-code contract by
 * COPYING the dark fixture into commands/ under a temp name, spawning --check,
 * and removing it in a finally -- never mutating a tracked file.
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GEN = path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'coverage-gate-dark');
const DARK_FIXTURE = path.join(FIXTURE_DIR, 'DARK-FIXTURE.md');
const EXCLUDED_FIXTURE = path.join(FIXTURE_DIR, 'EXCLUDED-FIXTURE.md');

const gen = require(GEN);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------------------------------------------------------------------------
// Test 1 (part a): classifySurface() classifies the dark fixture `gap`.
// ---------------------------------------------------------------------------
const darkSrc = { kind: 'command', base: '__dark_fixture__', file: DARK_FIXTURE };
const darkClass = gen.classifySurface(darkSrc);
ok('dark fixture classifies state=gap', darkClass.state === 'gap');
ok('dark fixture carries no excluded reason', !darkClass.reason);
ok('dark fixture carries no error (gap is not the missing-reason error)', !darkClass.error);

// ---------------------------------------------------------------------------
// Test 2: classifySurface() classifies the excluded fixture `excluded`, no error.
// ---------------------------------------------------------------------------
const exclSrc = { kind: 'command', base: '__excluded_fixture__', file: EXCLUDED_FIXTURE };
const exclClass = gen.classifySurface(exclSrc);
ok('excluded fixture classifies state=excluded', exclClass.state === 'excluded');
ok('excluded fixture carries a reason', typeof exclClass.reason === 'string' && exclClass.reason.length > 0);
ok('excluded fixture carries no build error (reason present)', !exclClass.error);

// ---------------------------------------------------------------------------
// Test 3: the clean live repo passes --check exit 0.
// ---------------------------------------------------------------------------
const clean = cp.spawnSync('node', [GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
ok('clean live repo --check exits 0', clean.status === 0);
ok('clean live repo --check prints OK', /connector-registry: OK/.test(clean.stdout || ''));

// ---------------------------------------------------------------------------
// Test 1 (part b) + Test 4: a dark surface PRESENT in commands/ makes --check
// exit non-zero AND the FAIL message names the surface + the recovery line.
// We copy the dark fixture into commands/ under a temp name, spawn --check,
// and ALWAYS remove it (finally) so no tracked file is ever mutated.
// ---------------------------------------------------------------------------
const TEMP_NAME = '__coverage_gate_dark_probe__.md';
const TEMP_PATH = path.join(COMMANDS_DIR, TEMP_NAME);
let darkRun;
try {
  fs.copyFileSync(DARK_FIXTURE, TEMP_PATH);
  darkRun = cp.spawnSync('node', [GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
} finally {
  try { fs.unlinkSync(TEMP_PATH); } catch (_e) { /* best-effort */ }
}
ok('dark surface present -> --check exits non-zero (HARD FAIL)', darkRun && darkRun.status !== 0);
const stderr = (darkRun && darkRun.stderr) || '';
ok('FAIL message names the offending surface', stderr.indexOf('/mos:__coverage_gate_dark_probe__') !== -1);
ok('FAIL message says GAP', /GAP:/.test(stderr));
ok('FAIL message carries the recovery line', /build-connector-registry\.cjs/.test(stderr));

// Confirm the temp probe was removed (no tracked-file mutation leaked).
ok('temp dark probe removed from commands/', !fs.existsSync(TEMP_PATH));

// Confirm the live repo is STILL green after the probe round-trip.
const cleanAgain = cp.spawnSync('node', [GEN, '--check'], { encoding: 'utf8', timeout: 60000 });
ok('live repo --check still exits 0 after probe removed', cleanAgain.status === 0);

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-coverage-gate-hardfail.cjs: PASSED');
