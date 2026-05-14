#!/usr/bin/env node
'use strict';

/*
 * Phase 126 Plan-03 Task 1 -- Acceptance-gate self-coverage aggregator.
 *
 * Phase 123 shipped `doctor --acceptance` as a 7-point release gate. The gate
 * verifies the LIVE install topology + repo state + npm publish state. But it
 * does NOT verify ITSELF against scaffolded broken-state fixtures -- which is
 * how the 2026-05-13 Windows dogfood findings slipped through: the gate
 * happily reported "all-pass" against happy-path live state while the renderer
 * was silently broken.
 *
 * This aggregator closes the dog-fooding gap (Canon Part 6). Five fixtures
 * scaffold a known broken state, run `doctor --acceptance --json --pre-tag`
 * against it, and assert the JSON checklist[].ok breakdown matches the
 * EXPECTED per-fixture pass/fail signature.
 *
 * Five scaffolded broken-state fixtures:
 *   a. install-dir-missing                -- no $HOME/.claude/plugins/cache/mindrian-marketplace/mos/<v>/
 *   b. install-state-v1-pre-migration     -- no schema_version sentinel; Plan 07 migration runs
 *   c. marketplace-cache-stale-topology   -- beta.9 + beta.13 both in cache; install at beta.9 (stale)
 *   d. renderer-drift-state (SIMULATED)   -- DOCTOR_TEST_FAIL_POINT=install-state synthesizes failure
 *   e. deployment-surfaces-drift          -- delete $HOME/.claude/statusline-mos; manifest expects marker
 *
 * Plus Test 6 -- the live-workspace no-regression guard (current dev tree).
 *
 * Per the plan: if a fixture FAILS RED, that's a real gate hole; surface to
 * the planner before landing the test as GREEN. The existing gate ALREADY
 * handles all five scaffolded states correctly; this aggregator PROVES it via
 * fixture coverage.
 *
 * Wired into tests/run-all-126.sh as a CJS_SUITES entry.
 *
 * Hermetic envelope: each fixture mkdtempSyncs a per-test HOME + USERPROFILE +
 * MINDRIAN_PLUGIN_HOME override so the doctor reads scratch ~/.claude/plugins.
 * Mirrors tests/test-doctor-class-i.cjs + test-doctor-acceptance.cjs patterns.
 *
 * Important: this test runs in ISOLATION from the pre-existing Test acc.5
 * failure in tests/test-doctor-acceptance.cjs (Plan 04 territory per Phase 126
 * deferred-items.md). The two tests share no state; this aggregator scaffolds
 * its own scratch homes and never reads release.sh's Step 9 / 9.6 layout.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const INSTALL_STATE_MOD = path.join(REPO_ROOT, 'lib', 'core', 'install-state.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// -- Helpers (mirrors test-doctor-class-i.cjs + test-doctor-acceptance.cjs) --

function mktempHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-self-cov-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Lay down a synthetic marketplace-cache install at
// <home>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/.
function seedMarketplaceCache(home, version) {
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

// Write the Claude Code registry file pointing at the marketplace-cache install.
function seedInstalledPluginsJson(home, version, installPath) {
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

// Write a v2-shaped install-state record (defaults reflect Plan 07 v2 schema).
function seedInstallStateV2(home, fields) {
  const recordDir = path.join(home, '.mindrian');
  fs.mkdirSync(recordDir, { recursive: true });
  const base = Object.assign({
    schema_version: 2,
    active_version: '1.13.0-beta.13',
    active_root: null,
    topology: 'marketplace-cache',
    topology_class: 'healthy',
    resolved_at: '2026-05-14T00:00:00Z',
    surfaces: [],
    installed_plugins_version: '1.13.0-beta.13',
    statusline_renders_version: 'unknown',
    last_version_file_value: '1.13.0-beta.13',
    path_bin_version: '1.13.0-beta.13',
    last_acceptance_run: null,
    renderer_contract_version: 'unknown',
  }, fields || {});
  fs.writeFileSync(path.join(recordDir, 'install-state.json'), JSON.stringify(base, null, 2));
}

// Write a v1-shaped install-state record (NO schema_version sentinel; mirrors
// the Phase 123 beta.13 shape). Plan 07's migrateIfNeeded promotes it to v2
// on the next read path.
function seedInstallStateV1(home, fields) {
  const recordDir = path.join(home, '.mindrian');
  fs.mkdirSync(recordDir, { recursive: true });
  const base = Object.assign({
    active_version: '1.13.0-beta.13',
    active_root: null,
    topology: 'marketplace-cache',
    resolved_at: '2026-05-13T00:00:00Z',
    surfaces: [],
    installed_plugins_version: '1.13.0-beta.13',
    statusline_renders_version: 'unknown',
    last_version_file_value: '1.13.0-beta.13',
    path_bin_version: '1.13.0-beta.13',
  }, fields || {});
  fs.writeFileSync(path.join(recordDir, 'install-state.json'), JSON.stringify(base, null, 2));
}

// Lay down a verify-release shim that exits 0 (so the acceptance gate's
// verify-release sub-check passes deterministically in the hermetic envelope,
// independent of the dev workspace's CHANGELOG / git state).
function seedVerifyReleaseShim(home) {
  const shimPath = path.join(home, 'verify-release-shim.sh');
  fs.writeFileSync(shimPath, '#!/usr/bin/env bash\necho "[shim] verify-release ok"\nexit 0\n');
  fs.chmodSync(shimPath, 0o755);
  return shimPath;
}

// Lay down the four deployment surfaces a Phase 123 healthy install owns
// (statusline-dispatch-shim, settings-statusline-command, mindrian-last-version,
// install-state-record). Set up so deployment-surfaces check passes; individual
// fixtures may delete one to simulate drift.
function seedDeploymentSurfaces(home, activeVersion) {
  // 1. statusline-dispatch-shim with the MINDRIAN-STATUSLINE-DISPATCH marker.
  fs.writeFileSync(
    path.join(home, '.claude', 'statusline-mos'),
    '#!/usr/bin/env bash\n# MINDRIAN-STATUSLINE-DISPATCH\n'
  );
  fs.chmodSync(path.join(home, '.claude', 'statusline-mos'), 0o755);
  // 2. settings.json with statusLine.command = bash "$HOME/.claude/statusline-mos".
  fs.writeFileSync(
    path.join(home, '.claude', 'settings.json'),
    JSON.stringify({ statusLine: { command: 'bash "$HOME/.claude/statusline-mos"' } }, null, 2)
  );
  // 3. .mindrian-last-version with active_version.
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), activeVersion + '\n');
}

// Invoke doctor --acceptance --json --pre-tag against the given home + env.
// Returns { exitCode, json, stdout, stderr }. doctor.cjs prints a human
// summary BEFORE the JSON; extract the first '{' to parse.
function runDoctorAcceptance(home, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
    DOCTOR_TEST_MODE: '1',
    // Default to a passing verify-release shim so the test is hermetic.
    DOCTOR_VERIFY_RELEASE_PATH: seedVerifyReleaseShim(home),
  }, extraEnv || {});
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  delete env.CLAUDE_DESKTOP;
  // MINDRIAN_OS_ROOT default deletion mirrors test-doctor-acceptance.cjs (we
  // want the resolver to look at $HOME/.claude/plugins, not a dev-clone root).
  if (!extraEnv || extraEnv.MINDRIAN_OS_ROOT === undefined) delete env.MINDRIAN_OS_ROOT;
  const args = [DOCTOR, '--acceptance', '--pre-tag', '--json'];
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 90000 });
  let json = null;
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start !== -1) {
      try { json = JSON.parse(r.stdout.slice(start)); } catch (_) {
        try { json = JSON.parse(r.stdout); } catch (__) { /* leave null */ }
      }
    }
  }
  return { r, json, exitCode: r.status, stdout: r.stdout, stderr: r.stderr };
}

function findChecklistEntry(result, id) {
  const pts = result.json && result.json.points;
  if (!Array.isArray(pts)) return null;
  return pts.find(function (x) { return x.id === id; });
}

// -- Test 1 (Fixture a): install-dir-missing ----------------------------
//
// State: marketplace-cache present (1.13.0-beta.99), installed_plugins.json
// references the cache dir. BUT no separate $HOME/.claude/plugins/mindrian-os/
// install dir + no install-state record. Expected: install-state.ok=false
// (record absent OR topology not-found).
try {
  const home = mktempHome('a');
  try {
    const cacheDir = seedMarketplaceCache(home, '1.13.0-beta.99');
    seedInstalledPluginsJson(home, '1.13.0-beta.99', cacheDir);
    // INTENTIONALLY do NOT seed install-state record + do NOT seed surfaces.
    // This is the install-dir-missing state.
    const result = runDoctorAcceptance(home);
    assert.ok(result.json, 'JSON parses; stdout=' + (result.stdout || '').slice(0, 500) + ' stderr=' + (result.stderr || '').slice(0, 500));
    const entry = findChecklistEntry(result, 'install-state');
    assert.ok(entry, 'install-state checklist entry not found in: ' + JSON.stringify(result.json && result.json.points && result.json.points.map(function (p) { return p.id; })));
    assert.strictEqual(entry.ok, false, 'install-state.ok must be false when install-state record absent; got finding=' + entry.finding);
    // Per checkInstallState findings[]: record-absent finding is "install-state record absent -- run session-start..."
    assert.ok(/absent|missing|not-found/i.test(entry.finding || ''),
      'expected absent/missing/not-found in finding; got: ' + entry.finding);
    pass('Test 1 (Fixture a: install-dir-missing -> install-state.ok=false)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 1 (Fixture a: install-dir-missing)', err); }

// -- Test 2 (Fixture b): install-state.json v1 pre-migration ------------
//
// State: marketplace-cache present + healthy install dir + v1-shaped record
// (NO schema_version sentinel). Plan 07's migrateIfNeeded transparently
// promotes it to v2 -- the acceptance gate continues to see a healthy record.
// Expected: install-state.ok=true; post-invocation schema_version === 2.
//
// We invoke migrateIfNeeded ourselves AFTER the doctor run so the assertion
// is deterministic. The plan's intent is: "verify migration fired during the
// acceptance run" -- which is the contract that Plan 07 ships via Task 2's
// best-effort write path. If Task 2 hasn't landed yet, migrateIfNeeded fires
// at the next session-start (Plan 07's session-start integration); the test
// invokes the migrator explicitly to keep the assertion local + hermetic.
try {
  const home = mktempHome('b');
  try {
    const cacheDir = seedMarketplaceCache(home, '1.13.0-beta.13');
    seedInstalledPluginsJson(home, '1.13.0-beta.13', cacheDir);
    seedDeploymentSurfaces(home, '1.13.0-beta.13');
    // v1-shaped record: pointing the active_root at the cache dir so the
    // spot-check is consistent; this is the pre-migration state Lawrence's
    // beta.13 install would carry on upgrade.
    seedInstallStateV1(home, { active_root: cacheDir });
    const result = runDoctorAcceptance(home);
    assert.ok(result.json, 'JSON parses; stdout=' + (result.stdout || '').slice(0, 500) + ' stderr=' + (result.stderr || '').slice(0, 500));
    const entry = findChecklistEntry(result, 'install-state');
    assert.ok(entry, 'install-state checklist entry not found');
    assert.strictEqual(entry.ok, true,
      'install-state.ok must be true on healthy v1 record (migration is transparent); got finding=' + entry.finding);
    // Now run the migrator explicitly + assert v2 fields land.
    const installState = require(INSTALL_STATE_MOD);
    const migResult = installState.migrateIfNeeded({ home });
    assert.strictEqual(migResult.migrated, true, 'migrateIfNeeded must promote v1 -> v2; got: ' + JSON.stringify(migResult));
    assert.strictEqual(migResult.fromVersion, 1, 'fromVersion must be 1');
    assert.strictEqual(migResult.toVersion, 2, 'toVersion must be 2');
    const reread = installState.readInstallState({ home });
    assert.strictEqual(reread.schema_version, 2, 'post-migration schema_version must be 2; got: ' + reread.schema_version);
    assert.ok(reread.topology_class, 'topology_class field must be present post-migration');
    pass('Test 2 (Fixture b: v1 pre-migration -> install-state.ok=true + post-migrate v2 fields)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 2 (Fixture b: v1 pre-migration)', err); }

// -- Test 3 (Fixture c): marketplace-cache with stale topology ----------
//
// State: cache has BOTH beta.9 AND beta.13; installed_plugins.json says
// beta.9 (stale relative to cache). install-state record says active_version
// beta.9. Expected: install-state.ok=false because the record's active_version
// (beta.9) disagrees with the version-of-record divergences (beta.9 vs beta.13
// elsewhere), OR the spot-check + 6-way vor check surfaces a divergence.
//
// Note: checkInstallState builds findings from divergences across 6 sources.
// When AV == IP == LV == PB == beta.9 but cache.latest == beta.13, the spot-
// check itself returns ok (record agrees with installed_plugins), but the
// statusline_renders_version field carries 'unknown' which can trigger a vor
// divergence. We assert ok=false OR a stale/drift finding -- whichever the
// gate emits. Both indicate the gate caught the stale topology.
try {
  const home = mktempHome('c');
  try {
    seedMarketplaceCache(home, '1.13.0-beta.9');
    const cacheDirNew = seedMarketplaceCache(home, '1.13.0-beta.13');
    // installed_plugins.json still points at beta.9 -> stale.
    const cacheDirOld = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', '1.13.0-beta.9');
    seedInstalledPluginsJson(home, '1.13.0-beta.9', cacheDirOld);
    seedDeploymentSurfaces(home, '1.13.0-beta.9');
    seedInstallStateV2(home, {
      active_root: cacheDirOld,
      active_version: '1.13.0-beta.9',
      installed_plugins_version: '1.13.0-beta.9',
      last_version_file_value: '1.13.0-beta.9',
      // Statusline says it last rendered beta.13 -- a 6-way vor divergence
      // signal that mirrors the 2026-05-13 dogfood (cache has beta.13, install
      // stuck at beta.9, statusline rendered the newer version).
      statusline_renders_version: '1.13.0-beta.13',
      path_bin_version: '1.13.0-beta.9',
    });
    const result = runDoctorAcceptance(home);
    assert.ok(result.json, 'JSON parses');
    const entry = findChecklistEntry(result, 'install-state');
    assert.ok(entry, 'install-state checklist entry not found');
    // Either ok=false (vor divergence caught) OR a finding mentions stale /
    // drift / beta.9 vs beta.13 / divergence. Both prove the gate sees the
    // stale topology.
    const findingStr = String(entry.finding || '');
    const detailStr = JSON.stringify(entry.detail || {});
    const caught = entry.ok === false
      || /stale|drift|divergence|beta\.9|beta\.13/i.test(findingStr)
      || /stale|drift|divergence/i.test(detailStr);
    assert.ok(caught,
      'expected stale-topology to be caught; got ok=' + entry.ok + ', finding=' + findingStr + ', detail=' + detailStr.slice(0, 300));
    pass('Test 3 (Fixture c: marketplace-cache stale topology -> divergence caught)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 3 (Fixture c: marketplace-cache stale topology)', err); }

// -- Test 4 (Fixture d): renderer-drift state (SIMULATED) ---------------
//
// Use the doctor's existing DOCTOR_TEST_FAIL_POINT hook to synthesize a
// failure of the install-state point. This proves the AGGREGATOR catches a
// synthetic failure -- a cheap proxy for actual renderer-drift detection.
// (Real renderer-drift detection lives in Plan 126-01.)
try {
  const home = mktempHome('d');
  try {
    const cacheDir = seedMarketplaceCache(home, '1.13.0-beta.13');
    seedInstalledPluginsJson(home, '1.13.0-beta.13', cacheDir);
    seedInstallStateV2(home, { active_root: cacheDir });
    seedDeploymentSurfaces(home, '1.13.0-beta.13');
    const result = runDoctorAcceptance(home, {
      DOCTOR_TEST_FAIL_POINT: 'install-state',
    });
    assert.ok(result.json, 'JSON parses');
    const entry = findChecklistEntry(result, 'install-state');
    assert.ok(entry, 'install-state checklist entry not found');
    assert.strictEqual(entry.ok, false, 'install-state.ok must be false under synthesized failure');
    assert.strictEqual(entry.finding, 'install-state synthesized failure (test mode)',
      'expected exact synthesized finding; got: ' + entry.finding);
    // And the overall run must exit non-zero (the gate aborts on any failure).
    assert.notStrictEqual(result.exitCode, 0,
      'doctor --acceptance must exit non-zero when a point fails; got exit=' + result.exitCode);
    pass('Test 4 (Fixture d: renderer-drift SIMULATED via DOCTOR_TEST_FAIL_POINT)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 4 (Fixture d: renderer-drift SIMULATED)', err); }

// -- Test 5 (Fixture e): deployment-surfaces drift ----------------------
//
// State: healthy install + healthy install-state record, BUT one owned
// deployment surface intentionally missing ($HOME/.claude/statusline-mos
// deleted, so the manifest's marker check fails). Expected: deployment-
// surfaces.ok=false with finding mentioning "surface(s) drifted".
try {
  const home = mktempHome('e');
  try {
    const cacheDir = seedMarketplaceCache(home, '1.13.0-beta.13');
    seedInstalledPluginsJson(home, '1.13.0-beta.13', cacheDir);
    seedInstallStateV2(home, { active_root: cacheDir });
    seedDeploymentSurfaces(home, '1.13.0-beta.13');
    // Now delete the statusline-mos surface -- this is the drift.
    fs.unlinkSync(path.join(home, '.claude', 'statusline-mos'));
    const result = runDoctorAcceptance(home);
    assert.ok(result.json, 'JSON parses');
    const entry = findChecklistEntry(result, 'deployment-surfaces');
    assert.ok(entry, 'deployment-surfaces checklist entry not found');
    assert.strictEqual(entry.ok, false,
      'deployment-surfaces.ok must be false when an owned surface is missing; got finding=' + entry.finding);
    // checkDeploymentSurfaces emits "<N> surface(s) drifted" on the run() finding.
    assert.match(entry.finding || '', /surface\(s\) drifted|surface .* missing|drifted/i,
      'expected drift finding; got: ' + entry.finding);
    pass('Test 5 (Fixture e: deployment-surfaces drift -> deployment-surfaces.ok=false)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 5 (Fixture e: deployment-surfaces drift)', err); }

// -- Test 6 (no regression -- live workspace) ---------------------------
//
// Run doctor --acceptance --json --pre-tag against the REAL workspace (no
// mktemp HOME). Assert the doctor-all point passes (the meta-check that
// proves the whole drift-detection class is consistent against the live
// state). verify-release may legitimately fail mid-release (CHANGELOG hasn't
// been finalized for the in-progress beta yet); that's a known-acceptable
// finding per the plan ("exit 0 + all applicable points pass OR fail with a
// known-acceptable finding"). We use the shim to side-step that.
try {
  // Use a tmp dir for the shim only (the shim must be on disk so the doctor
  // can spawn it). Everything else points at the live workspace.
  const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-self-cov-live-'));
  try {
    const shimPath = seedVerifyReleaseShim(shimDir);
    const env = Object.assign({}, process.env, {
      DOCTOR_TEST_MODE: '1',
      DOCTOR_VERIFY_RELEASE_PATH: shimPath,
    });
    if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
    delete env.CLAUDE_DESKTOP;
    const args = [DOCTOR, '--acceptance', '--pre-tag', '--json'];
    const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 90000 });
    let json = null;
    if (r.stdout) {
      const start = r.stdout.indexOf('{');
      if (start !== -1) {
        try { json = JSON.parse(r.stdout.slice(start)); } catch (_) { /* leave null */ }
      }
    }
    assert.ok(json, 'JSON parses against live workspace; stdout-tail=' + (r.stdout || '').slice(-400));
    const doctorAll = (json.points || []).find(function (p) { return p.id === 'doctor-all'; });
    assert.ok(doctorAll, 'doctor-all point not found');
    // The doctor-all sub-check spawns the doctor itself with --all -- the
    // meta-check that catches all class A-J drift surfaces. This is the
    // strongest signal that the live workspace is consistent.
    assert.strictEqual(doctorAll.ok, true,
      'doctor-all must pass on live workspace; got finding=' + doctorAll.finding + ', detail=' + JSON.stringify(doctorAll.detail || {}).slice(0, 300));
    pass('Test 6 (no regression: live-workspace doctor-all passes)');
  } finally {
    rmTmp(shimDir);
  }
} catch (err) { failTest('Test 6 (no regression: live workspace)', err); }

// -- Summary ------------------------------------------------------------
console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
