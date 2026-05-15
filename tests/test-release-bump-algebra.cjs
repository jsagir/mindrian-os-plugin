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
 * Phase 126.1 hotfix (2026-05-15) adds Tests H + I:
 *   H = Commit B (Step 7.5) bumps marketplace.json to NEXT_VERSION as part
 *       of the 7-place lockstep contract (feedback_install_minisite_lockstep.md).
 *       source.ref deliberately stays at v$NEW_VERSION; only the version field
 *       advances.
 *   I = Step 9.7 npx-publish self-test uses the ~/.claude/_test-install-<sha8>/
 *       HOME-override sandbox (not the legacy mktemp -d that checked cwd
 *       non-empty -- @mindrian_os/install installs into ~/.claude/, NOT cwd).
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

// ---------------- Test H: Commit B bumps marketplace.json (Phase 126.1) ----------------
run('H: Step 7.5 (Commit B) bumps marketplace.json to NEXT_VERSION (7-place lockstep)', function () {
  const releaseSh = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'release.sh'),
    'utf8'
  );

  // Locate the Step 7.5 block. The block header is the canonical marker.
  const step75Idx = releaseSh.indexOf('# --- Step 7.5: Commit B');
  assert.ok(
    step75Idx !== -1,
    'Step 7.5 Commit B block header not found in scripts/release.sh -- expected "# --- Step 7.5: Commit B"'
  );

  // Look in the next ~120 lines (roughly 6000 chars) after the header for the
  // marketplace.json + NEXT_VERSION bump pattern.
  const window = releaseSh.slice(step75Idx, step75Idx + 6000);

  assert.ok(
    window.includes('marketplace.json'),
    'Step 7.5 Commit B block does not mention marketplace.json (7-place lockstep gap; see feedback_install_minisite_lockstep.md)'
  );

  // Stricter: assert the marketplace bump pattern. The node -e block sets
  // m.plugins[0].version = '$NEXT_VERSION' (single quotes around NEXT_VERSION
  // when the bash node -e block is rendered literally in the file).
  assert.ok(
    /m\.plugins\[0\]\.version\s*=\s*['"]\$NEXT_VERSION['"]/.test(window),
    'Step 7.5 Commit B does not bump marketplace.json m.plugins[0].version to $NEXT_VERSION (7-place lockstep gap; see feedback_install_minisite_lockstep.md)'
  );

  // And there must be a parallel marketplace commit (so the bump actually
  // lands in the marketplace repo's git history, not just on disk).
  assert.ok(
    /(Commit B 7-place lockstep|marketplace\.json to v\$NEXT_VERSION)/.test(window),
    'Step 7.5 Commit B does not commit the marketplace.json bump (marker "Commit B 7-place lockstep" missing)'
  );
});

// ---------------- Test I: Step 9.7 sandbox path (Phase 126.1) ----------------
run('I: Step 9.7 npx-publish self-test uses ~/.claude/_test-install-<sha8>/ HOME-override sandbox', function () {
  const releaseSh = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'release.sh'),
    'utf8'
  );

  // Locate the Step 9.7 block.
  const step97Idx = releaseSh.indexOf('# --- Step 9.7: npx-publish self-test');
  assert.ok(
    step97Idx !== -1,
    'Step 9.7 npx-publish self-test block header not found in scripts/release.sh'
  );

  // ~5000 chars after the header should contain the full step.
  const window = releaseSh.slice(step97Idx, step97Idx + 5000);

  // Sandbox path marker.
  assert.ok(
    window.includes('_test-install-'),
    'Step 9.7 does not use the ~/.claude/_test-install-<sha8>/ sandbox path (Phase 126.1 fix; @mindrian_os/install installs into ~/.claude/, NOT cwd)'
  );

  // Must NOT contain the legacy broken pattern. The legacy `mktemp -d -t
  // mos-npx-selftest` checked cwd non-empty after npx, but the install never
  // landed in cwd -- it landed in ~/.claude/. The check spuriously failed
  // during the beta.16 cut.
  assert.ok(
    !/mktemp -d -t mos-npx-selftest/.test(window),
    'Step 9.7 still contains the legacy `mktemp -d -t mos-npx-selftest` pattern that spuriously failed in beta.16 (npx installs into ~/.claude/, not cwd)'
  );

  // HOME-override marker (env HOME="$NPX_TEST_DIR" ... npx). The env wrapper
  // is what redirects the install to the sandbox subpath.
  assert.ok(
    /HOME="?\$NPX_TEST_DIR"?/.test(window),
    'Step 9.7 does not set HOME=$NPX_TEST_DIR (the HOME-override is what redirects @mindrian_os/install into the sandbox)'
  );
});

if (failures > 0) {
  process.stderr.write('\n' + failures + ' test(s) failed.\n');
  process.exit(1);
}
process.stdout.write('\nAll bump-algebra tests passed.\n');
process.exit(0);
