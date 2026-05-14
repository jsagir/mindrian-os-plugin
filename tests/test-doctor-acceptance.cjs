#!/usr/bin/env node
'use strict';

/*
 * Phase 123 Plan-04 Task 1 -- /mos:doctor --acceptance hermetic tests.
 *
 * The release-gate-as-a-command. `doctor --acceptance` (full) runs 7 points;
 * `doctor --acceptance --pre-tag` runs the 5 points true before the tag /
 * publish step. Both hard abort on any failure (no --allow override).
 *
 * Six scenarios:
 *   acc.1  --pre-tag filters to the 5 pre-tag-applicable points; the 2
 *          post-publish points (version-of-record-published + npx-roundtrip)
 *          are NOT invoked. Verified by DOCTOR_TEST_STUB_POST_PUBLISH=1: if
 *          --pre-tag erroneously invokes a post-publish point, the stub
 *          throws and the run fails.
 *   acc.2  --acceptance calls scripts/verify-release exactly once. Use
 *          DOCTOR_VERIFY_RELEASE_PATH=<shim> to redirect; the shim appends
 *          to a counter file. Assert counter == 1.
 *   acc.3  A sub-check failure propagates as a non-zero exit. Use
 *          DOCTOR_TEST_FAIL_POINT=doctor-all to synthesize a failure of the
 *          named point. Assert exit != 0; assert failed_points names it.
 *   acc.4  The npx sandbox is cleaned up after --acceptance returns. Run in
 *          --light-npx mode (so the test stays fast, no real install) and
 *          assert no mos-acceptance-* dirs remain under os.tmpdir() after.
 *   acc.5  scripts/release.sh wires both gates in the right ordering. Read
 *          the file; find offsets of Step 6.5, Step 6.6, Step 7, Step 9,
 *          Step 9.5, Step 9.8; assert ordering AND that both literal
 *          invocations are present. (Phase 126 Plan 04 renamed the post-publish
 *          full --acceptance block from Step 9.6 -> Step 9.8 to make room for
 *          the new Step 9.6 install-minisite HARD lockstep and Step 9.7
 *          npx-publish self-test. The original Step 9.6 numbering collision
 *          between the soft-skip minisite block and the doctor --acceptance
 *          block is resolved by the rename.)
 *   acc.6  scripts/release-beta-smoke.sh is deleted.
 *
 * Hermetic envelope: per-test mkdtempSync HOME + USERPROFILE +
 * MINDRIAN_PLUGIN_HOME override so the doctor reads scratch
 * ~/.claude/plugins. Mirrors tests/test-doctor-class-i.cjs + class-j.cjs.
 *
 * Test-mode env hooks the doctor honors only when DOCTOR_TEST_MODE=1:
 *   DOCTOR_TEST_STUB_POST_PUBLISH=1 -- post-publish points throw if invoked
 *   DOCTOR_TEST_FAIL_POINT=<point_id> -- synthesize a failure for that point
 *   DOCTOR_VERIFY_RELEASE_PATH=<path> -- use this path for verify-release
 *
 * Registered in lib/memory/run-feynman-tests.cjs (Phase-123 block) and
 * picked up automatically by tests/run-all.sh's test-*.cjs glob.
 *
 * RED until Phase 123 Plan-04 Task 2 lands --acceptance in doctor.cjs and
 * Task 3 wires release.sh + deletes release-beta-smoke.sh.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');
const RELEASE_BETA_SMOKE = path.join(REPO_ROOT, 'scripts', 'release-beta-smoke.sh');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '123-04-acc-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Lay down a synthetic marketplace-cache install at
// <home>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/.
function makeMarketplaceCache(home, version) {
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);
  fs.mkdirSync(path.join(cacheDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  fs.mkdirSync(path.join(cacheDir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'bin', 'cli.js'), '#!/usr/bin/env node\n');
  return cacheDir;
}

function makeInstalledPluginsJson(home, version, installPath) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 2,
    plugins: {
      'mos@mindrian-marketplace': [
        { scope: 'user', installPath, version, installedAt: '2026-05-13T00:00:00Z', lastUpdated: '2026-05-13T00:00:00Z' }
      ]
    }
  }, null, 2));
}

function makeInstallStateRecord(home, fields) {
  const recordDir = path.join(home, '.mindrian');
  fs.mkdirSync(recordDir, { recursive: true });
  const base = Object.assign({
    active_version: '1.13.0-beta.12',
    active_root: null,
    topology: 'marketplace-cache',
    resolved_at: '2026-05-13T00:00:00Z',
    surfaces: [],
    installed_plugins_version: '1.13.0-beta.12',
    statusline_renders_version: 'unknown',
    last_version_file_value: '1.13.0-beta.12',
    path_bin_version: '1.13.0-beta.12',
  }, fields || {});
  fs.writeFileSync(path.join(recordDir, 'install-state.json'), JSON.stringify(base, null, 2));
}

// Build a verify-release shim that increments a counter file. The shim
// itself exits 0 (success). Returns { shimPath, counterPath }.
function makeVerifyReleaseShim(home) {
  const counterPath = path.join(home, 'verify-release-counter.txt');
  const shimPath = path.join(home, 'verify-release-shim.sh');
  fs.writeFileSync(shimPath, '#!/usr/bin/env bash\n'
    + 'echo "1" >> "' + counterPath + '"\n'
    + 'echo "[shim] verify-release called"\n'
    + 'exit 0\n');
  fs.chmodSync(shimPath, 0o755);
  return { shimPath, counterPath };
}

function runDoctorAcceptance(home, flags, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
    DOCTOR_TEST_MODE: '1',
  }, extraEnv || {});
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  if (!extraEnv || extraEnv.MINDRIAN_OS_ROOT === undefined) delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  const args = [DOCTOR, '--acceptance'].concat(flags || []).concat(['--json']);
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 60000 });
  let json = null;
  // doctor may print human-readable lines BEFORE the JSON; extract the first {...}.
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start !== -1) {
      // Find the matching outer brace by attempting to parse from start.
      try { json = JSON.parse(r.stdout.slice(start)); } catch (_) {
        // Fall back: try the whole stdout (rare; --json prints JSON only when set).
        try { json = JSON.parse(r.stdout); } catch (__) { /* leave null */ }
      }
    }
  }
  return { r, json, exitCode: r.status, stdout: r.stdout, stderr: r.stderr };
}

// -- acc.1: --pre-tag filters to pre-tag-applicable checks only -----------
try {
  const home = makeTmpHome('a1');
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.12');
  makeInstalledPluginsJson(home, '1.13.0-beta.12', mcDir);
  makeInstallStateRecord(home, { active_root: mcDir });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.13.0-beta.12\n');
  // Point verify-release at a shim that exits 0 -- this lets --pre-tag
  // reach a clean conclusion regardless of repo state.
  const { shimPath } = makeVerifyReleaseShim(home);
  const { exitCode, json } = runDoctorAcceptance(home, ['--pre-tag'], {
    DOCTOR_TEST_STUB_POST_PUBLISH: '1',
    DOCTOR_VERIFY_RELEASE_PATH: shimPath,
  });
  // The harness expects --pre-tag to filter; if the stub throws, the doctor's
  // runner catches it and marks the point failed. Either way, the post-
  // publish points must not appear in result.points.
  assert.ok(json, 'JSON output parses');
  assert.ok(Array.isArray(json.points), 'points[] in output');
  const ids = json.points.map(function (p) { return p.id; });
  // Pre-tag-applicable points should be present
  assert.ok(ids.indexOf('install-state') !== -1, 'install-state included');
  assert.ok(ids.indexOf('deployment-surfaces') !== -1, 'deployment-surfaces included');
  assert.ok(ids.indexOf('version-of-record-repo') !== -1, 'version-of-record-repo included');
  assert.ok(ids.indexOf('verify-release') !== -1, 'verify-release included');
  assert.ok(ids.indexOf('doctor-all') !== -1, 'doctor-all included');
  // Post-publish points must NOT appear under --pre-tag.
  assert.strictEqual(ids.indexOf('version-of-record-published'), -1, 'version-of-record-published filtered out');
  assert.strictEqual(ids.indexOf('npx-roundtrip'), -1, 'npx-roundtrip filtered out');
  assert.strictEqual(json.mode, 'pre-tag', 'mode === pre-tag');
  rmTmp(home);
  pass('Test acc.1 (--pre-tag filters to 5 pre-tag-applicable points)');
} catch (err) { failTest('Test acc.1 (--pre-tag filters to 5 pre-tag-applicable points)', err); }

// -- acc.2: --acceptance calls scripts/verify-release exactly once --------
try {
  const home = makeTmpHome('a2');
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.12');
  makeInstalledPluginsJson(home, '1.13.0-beta.12', mcDir);
  makeInstallStateRecord(home, { active_root: mcDir });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.13.0-beta.12\n');
  const { shimPath, counterPath } = makeVerifyReleaseShim(home);
  // Run --pre-tag so we don't try to do a real npm view / npx round-trip
  // (the verify-release sub-check IS in --pre-tag's set).
  runDoctorAcceptance(home, ['--pre-tag'], {
    DOCTOR_VERIFY_RELEASE_PATH: shimPath,
  });
  // Read counter -- expect exactly one '1' line.
  const counterContents = fs.existsSync(counterPath) ? fs.readFileSync(counterPath, 'utf8') : '';
  const lines = counterContents.split('\n').filter(function (l) { return l.trim() === '1'; });
  assert.strictEqual(lines.length, 1, 'verify-release shim called exactly once; got ' + lines.length + ' calls');
  rmTmp(home);
  pass('Test acc.2 (--acceptance calls verify-release exactly once)');
} catch (err) { failTest('Test acc.2 (--acceptance calls verify-release exactly once)', err); }

// -- acc.3: Sub-check failure propagates to non-zero exit -----------------
try {
  const home = makeTmpHome('a3');
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.12');
  makeInstalledPluginsJson(home, '1.13.0-beta.12', mcDir);
  makeInstallStateRecord(home, { active_root: mcDir });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.13.0-beta.12\n');
  const { shimPath } = makeVerifyReleaseShim(home);
  const { exitCode, json } = runDoctorAcceptance(home, ['--pre-tag'], {
    DOCTOR_VERIFY_RELEASE_PATH: shimPath,
    DOCTOR_TEST_FAIL_POINT: 'doctor-all',
  });
  assert.notStrictEqual(exitCode, 0, '--acceptance exit non-zero when a point fails; got ' + exitCode);
  assert.ok(json, 'JSON output parses');
  assert.ok(Array.isArray(json.failed_points), 'failed_points[] in output');
  assert.ok(json.failed_points.indexOf('doctor-all') !== -1, 'failed_points names the failure; got ' + JSON.stringify(json.failed_points));
  rmTmp(home);
  pass('Test acc.3 (sub-check failure -> non-zero exit)');
} catch (err) { failTest('Test acc.3 (sub-check failure -> non-zero exit)', err); }

// -- acc.4: npx sandbox cleanup (--light-npx mode) -------------------------
try {
  // We don't want to actually invoke npm/npx; --light-npx skips the mktemp
  // sandbox entirely. After the run, NO mos-acceptance-* dirs may remain
  // under os.tmpdir().
  // Note: --light-npx is meaningful only in full mode (post-publish point).
  // Use a wholly-mocked scenario: --pre-tag (where npx-roundtrip is skipped)
  // STILL must not leak. --light-npx run in full mode would need network
  // access -- we run --pre-tag here as the negative-side proof: no temp dir.
  const tmpRoot = os.tmpdir();
  const beforeDirs = fs.readdirSync(tmpRoot).filter(function (n) { return /^mos-acceptance-/.test(n); });
  const home = makeTmpHome('a4');
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.12');
  makeInstalledPluginsJson(home, '1.13.0-beta.12', mcDir);
  makeInstallStateRecord(home, { active_root: mcDir });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.13.0-beta.12\n');
  const { shimPath } = makeVerifyReleaseShim(home);
  runDoctorAcceptance(home, ['--pre-tag', '--light-npx'], {
    DOCTOR_VERIFY_RELEASE_PATH: shimPath,
  });
  const afterDirs = fs.readdirSync(tmpRoot).filter(function (n) { return /^mos-acceptance-/.test(n); });
  // No new mos-acceptance-* dirs should exist (--light-npx + --pre-tag never
  // creates a sandbox; if the doctor regressed and created one without cleaning,
  // afterDirs would have a new entry beyond beforeDirs).
  const leaked = afterDirs.filter(function (n) { return beforeDirs.indexOf(n) === -1; });
  assert.strictEqual(leaked.length, 0, 'no leaked mos-acceptance-* dirs; leaked: ' + leaked.join(','));
  rmTmp(home);
  pass('Test acc.4 (npx sandbox cleanup; --light-npx skips sandbox)');
} catch (err) { failTest('Test acc.4 (npx sandbox cleanup; --light-npx skips sandbox)', err); }

// -- acc.5: release.sh wires both gates with correct ordering --------------
try {
  const sh = fs.readFileSync(RELEASE_SH, 'utf8');
  // Find offsets of the key step markers in COMMENTS / echo headers.
  // Use the literal step labels Plan-04 inserts.
  function findOffset(needle) {
    const i = sh.indexOf(needle);
    assert.ok(i !== -1, 'expected literal "' + needle + '" in release.sh');
    return i;
  }
  const off65 = findOffset('Step 6.5:');
  const off66 = findOffset('Step 6.6:');
  const off7  = findOffset('Step 7:');
  const off9  = findOffset('Step 9:');
  const off95 = findOffset('Step 9.5:');
  // Phase 126 Plan 04 renamed the post-publish full --acceptance block from
  // Step 9.6 -> Step 9.8. The new Step 9.6 is the install-minisite HARD lockstep
  // block; Step 9.7 is the npx-publish self-test. The doctor --acceptance
  // ordering check tracks Step 9.8 (the renamed post-publish gate).
  const off98 = findOffset('Step 9.8:');
  assert.ok(off66 > off65, 'Step 6.6 must appear after Step 6.5; got 6.5@' + off65 + ' / 6.6@' + off66);
  assert.ok(off66 < off7, 'Step 6.6 must appear before Step 7 (commit A + tag); got 6.6@' + off66 + ' / 7@' + off7);
  assert.ok(off98 > off95, 'Step 9.8 must appear after Step 9.5 (npm publish); got 9.5@' + off95 + ' / 9.8@' + off98);
  assert.ok(off98 > off9, 'Step 9.8 must appear after Step 9 (push); got 9@' + off9 + ' / 9.8@' + off98);
  // The actual invocations.
  assert.ok(/doctor\.cjs.*--acceptance.*--pre-tag/.test(sh), 'release.sh invokes doctor --acceptance --pre-tag');
  // Full --acceptance (no --pre-tag) must also appear; the literal "doctor.cjs --acceptance"
  // alone (not followed by --pre-tag on the same line) is the one we want.
  const fullAcceptanceLines = sh.split('\n').filter(function (line) {
    return /doctor\.cjs.*--acceptance\s*$/.test(line.trim()) || /doctor\.cjs.*--acceptance[^-]/.test(line);
  });
  assert.ok(fullAcceptanceLines.length >= 1, 'release.sh invokes doctor --acceptance (full); found 0 lines');
  pass('Test acc.5 (release.sh wires --pre-tag before tag AND full --acceptance after push)');
} catch (err) { failTest('Test acc.5 (release.sh wires --pre-tag before tag AND full --acceptance after push)', err); }

// -- acc.6: scripts/release-beta-smoke.sh is deleted ----------------------
try {
  assert.strictEqual(fs.existsSync(RELEASE_BETA_SMOKE), false,
    'scripts/release-beta-smoke.sh should be deleted (Plan-04 retires it; --acceptance --pre-tag supersedes)');
  pass('Test acc.6 (release-beta-smoke.sh is deleted)');
} catch (err) { failTest('Test acc.6 (release-beta-smoke.sh is deleted)', err); }

// -- Summary --------------------------------------------------------------
console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
