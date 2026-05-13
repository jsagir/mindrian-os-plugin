#!/usr/bin/env node
'use strict';

/*
 * Phase 123-01 Wave 0 -- semver bump algebra + scripts/release.sh structural assertions.
 *
 * Owning plan: 123-01 (release.sh pre-release support + dirty-repo guard + Step 9.5 rename).
 * Requirements: HARNESS-123-01, HARNESS-123-02, HARNESS-123-03, HARNESS-123-04.
 *
 * Tests A-E exercise `semver.inc()` directly to lock the bump-mode semantics
 * release.sh delegates to (incl. the CONTEXT-D-18 correction:
 *   semver.inc('1.13.0-beta.11','patch') -> '1.13.0' (not '1.13.1');
 *   semver.inc('1.13.0-beta.11','minor') -> '1.13.0' (not '1.14.0');
 * so `--finalize` is `inc(v,'patch')`, and the legacy `patch|minor|major` bump
 * args map to `semver.inc(v, mode)` cleanly). Test E covers the legacy
 * 4-component `1.12.5.1` version on the dev box -- `semver.valid()` rejects it,
 * `semver.coerce()` strips to `1.12.5`. Plan-03 handles the consistency check;
 * Plan-01 just documents the awareness.
 *
 * Tests F/G are structural assertions on `scripts/release.sh`:
 *   F = the broad rewrite landed (no IFS='.' parse, semver require, --prerelease
 *       arm, the dirty-repo guard, node_modules/semver preflight, the
 *       @mindrian_os/install rename).
 *   G = the two-commit form markers are present (Commit A + Commit B + --allow-ahead).
 *
 * Tests F + G are RED until Task 2 of plan 123-01 rewrites release.sh; that is
 * the intended RED -> GREEN cycle. Tests A-E are pure semver assertions and
 * are GREEN from the moment this file lands.
 *
 * Registered in `tests/run-all.sh` (test-*.cjs auto-glob) and
 * `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` (Phase-123 block).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let semver;
try {
  semver = require('semver');
} catch (err) {
  process.stderr.write('FAIL: cannot require("semver") -- run `npm install` first.\n');
  process.stderr.write(String(err && err.message) + '\n');
  process.exit(1);
}

let failures = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('PASS ' + name + '\n');
  } catch (err) {
    failures += 1;
    process.stdout.write('FAIL ' + name + ': ' + (err && err.message) + '\n');
  }
}

// ---------------- Test A: prerelease bump ----------------
run('A: semver.inc prerelease beta.11 -> beta.12', function () {
  assert.strictEqual(
    semver.inc('1.13.0-beta.11', 'prerelease', 'beta'),
    '1.13.0-beta.12'
  );
});

// ---------------- Test B: patch + minor finalize, NOT bump ----------------
run("B: semver.inc('1.13.0-beta.11','patch') === '1.13.0' AND ('minor') === '1.13.0'", function () {
  assert.strictEqual(semver.inc('1.13.0-beta.11', 'patch'), '1.13.0');
  assert.strictEqual(semver.inc('1.13.0-beta.11', 'minor'), '1.13.0');
});

// ---------------- Test C: major still increments core ----------------
run("C: semver.inc('1.13.0-beta.11','major') === '2.0.0'", function () {
  assert.strictEqual(semver.inc('1.13.0-beta.11', 'major'), '2.0.0');
});

// ---------------- Test D: --start-prerelease form yields beta.1 (not beta.0) ----------------
run("D: preminor + prerelease opens '1.14.0-beta.1' from '1.13.0'", function () {
  let v = semver.inc('1.13.0', 'preminor', 'beta');
  assert.strictEqual(v, '1.14.0-beta.0');
  v = semver.inc(v, 'prerelease', 'beta');
  assert.strictEqual(v, '1.14.0-beta.1');
});

// ---------------- Test E: 1.12.5.1 is NOT valid semver ----------------
run("E: semver.valid('1.12.5.1') === null AND coerce -> '1.12.5'", function () {
  assert.strictEqual(semver.valid('1.12.5.1'), null);
  const coerced = semver.coerce('1.12.5.1');
  assert.ok(coerced, 'coerce should return a SemVer object for 1.12.5.1');
  assert.strictEqual(coerced.version, '1.12.5');
});

// ---------------- Test F: structural -- release.sh broad rewrite landed ----------------
run('F: scripts/release.sh has semver bump algebra + @mindrian_os/install', function () {
  const releaseSh = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'release.sh'),
    'utf8'
  );

  // The IFS='.' parse on line 40 of the legacy script is gone.
  assert.ok(
    !releaseSh.includes("IFS='.' read -r MAJOR MINOR PATCH"),
    'release.sh still contains the broken IFS=\'.\' parse'
  );

  // Calls semver via `require(`.
  assert.ok(
    releaseSh.includes('require('),
    'release.sh does not call require( for semver'
  );

  // Has the existence preflight against node_modules/semver.
  assert.ok(
    releaseSh.includes('node_modules/semver'),
    'release.sh does not preflight node_modules/semver'
  );

  // Has the --prerelease arm.
  assert.ok(
    releaseSh.includes('--prerelease'),
    'release.sh does not handle --prerelease'
  );

  // Has the ahead-of-origin guard (git log origin/main..HEAD).
  assert.ok(
    releaseSh.includes('git log origin/main..HEAD'),
    'release.sh does not have the ahead-of-origin guard'
  );

  // Step 9.5 renamed to @mindrian_os/install.
  assert.ok(
    releaseSh.includes('@mindrian_os/install'),
    'release.sh does not publish @mindrian_os/install'
  );
  assert.ok(
    !releaseSh.includes('@mindrian_os/cli'),
    'release.sh still references the stale @mindrian_os/cli package name'
  );
});

// ---------------- Test G: structural -- two-commit form ----------------
run('G: scripts/release.sh has the two-commit form + --allow-ahead', function () {
  const releaseSh = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'release.sh'),
    'utf8'
  );

  assert.ok(
    releaseSh.includes('Commit A'),
    'release.sh does not mark Commit A (release commit)'
  );
  assert.ok(
    releaseSh.includes('Commit B'),
    'release.sh does not mark Commit B (next-bump commit)'
  );
  assert.ok(
    releaseSh.includes('--allow-ahead'),
    'release.sh does not accept --allow-ahead (the ahead-of-origin escape)'
  );
});

if (failures > 0) {
  process.stderr.write('\n' + failures + ' test(s) failed.\n');
  process.exit(1);
}
process.stdout.write('\nAll bump-algebra tests passed.\n');
process.exit(0);
