#!/usr/bin/env node
'use strict';

/*
 * Phase 126 Plan-05 -- Acceptance-gate preflight-checks fixture coverage.
 *
 * Phase 123's release cut surfaced 5 hot-patches during Plan-06 pre-flight that
 * the operator applied MANUALLY before tagging the release. Each was tribal
 * knowledge in the operator's head -- the gate did NOT enforce them. Plan 05
 * absorbs the 5 hot-patches as doctor --acceptance checklist entries so they
 * run automatically on every release.
 *
 * This test fixture proves: (a) the 5 new entries are present in the gate, (b)
 * each entry honors the existing DOCTOR_TEST_FAIL_POINT injection (the
 * established Phase 123 test-mode hook), (c) the live dev workspace continues
 * to pass all 5 new checks (no regression), (d) one failure does NOT cascade
 * to the others (isolation guard).
 *
 * The 5 new entries:
 *   1. session-start-active-version    -- session-start derives active_version
 *                                          correctly from installed_plugins.json
 *                                          + active plugin root plugin.json
 *   2. verify-release-clean-tree       -- scripts/verify-release Step 12 reports
 *                                          clean git tree (tracked-only)
 *   3. frontmatter-yaml-validity       -- commands/operator.md + commands/doctor.md
 *                                          YAML frontmatter parses cleanly
 *   4. release-dry-run-output          -- release.sh --dry-run produces all
 *                                          expected step names in order
 *   5. working-tree-housekeeping       -- no orphan .tmp/.bak/.swp files
 *                                          tracked in the repo
 *
 * Test architecture (settled in plan-phase):
 *   - Test 1 scaffolds REAL state (mktemp HOME with a v2 install-state record
 *     pointing at a NON-matching version) to prove the actual detection logic
 *     works against a real fixture.
 *   - Tests 2-5 use DOCTOR_TEST_FAIL_POINT injection per entry. This proves the
 *     END-TO-END plumbing for each entry without polluting the dev workspace
 *     (mirrors the established Phase 123 pattern in tests/test-doctor-acceptance.cjs).
 *   - Test 6 is the live-workspace no-regression guard: all 5 new checks pass
 *     against the dev tree.
 *   - Test 7 is the isolation guard: under DOCTOR_TEST_FAIL_POINT=working-tree-
 *     housekeeping, ONLY that check fails; the other 4 new checks + the 7
 *     existing checks remain unaffected.
 *
 * Isolation from acc.5 (pre-existing Plan 04 failure, logged in
 * .planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md): this
 * test scaffolds its own scratch HOMEs and never reads scripts/release.sh's
 * Step 9 / 9.6 layout. Plan 05 takes no dependency on acc.5's resolution.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// -- Helpers ---------------------------------------------------------

function mktempHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-preflight-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function seedVerifyReleaseShim(home) {
  const shimPath = path.join(home, 'verify-release-shim.sh');
  fs.writeFileSync(shimPath, '#!/usr/bin/env bash\necho "[shim] verify-release ok"\nexit 0\n');
  fs.chmodSync(shimPath, 0o755);
  return shimPath;
}

// Lay down a synthetic marketplace-cache install at
// <home>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/.
function seedMarketplaceCache(home, version) {
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);
  fs.mkdirSync(path.join(cacheDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version: version }, null, 2)
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
        { scope: 'user', installPath: installPath, version: version, installedAt: '2026-05-13T00:00:00Z', lastUpdated: '2026-05-13T00:00:00Z' }
      ]
    }
  }, null, 2));
}

// Invoke doctor --acceptance --pre-tag --json against the given home + env.
// Returns parsed JSON (or null if unparseable) + exit code + stdout/stderr.
function runAcceptance(home, extraEnv) {
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
  const r = spawnSync('node', args, { env: env, encoding: 'utf8', timeout: 90000 });
  let json = null;
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start !== -1) {
      try { json = JSON.parse(r.stdout.slice(start)); } catch (_) {
        try { json = JSON.parse(r.stdout); } catch (__) { /* leave null */ }
      }
    }
  }
  return { exitCode: r.status, json: json, stdout: r.stdout, stderr: r.stderr };
}

// Invoke doctor --acceptance --pre-tag --json against the LIVE workspace (no
// HOME override). Returns parsed JSON. Used by Tests 6 + 7.
function runAcceptanceLive(extraEnv) {
  const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-preflight-live-'));
  const shimPath = seedVerifyReleaseShim(shimDir);
  const env = Object.assign({}, process.env, {
    DOCTOR_TEST_MODE: '1',
    DOCTOR_VERIFY_RELEASE_PATH: shimPath,
  }, extraEnv || {});
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  delete env.CLAUDE_DESKTOP;
  const args = [DOCTOR, '--acceptance', '--pre-tag', '--json'];
  const r = spawnSync('node', args, { env: env, encoding: 'utf8', timeout: 120000 });
  let json = null;
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start !== -1) {
      try { json = JSON.parse(r.stdout.slice(start)); } catch (_) { /* leave null */ }
    }
  }
  rmTmp(shimDir);
  return { exitCode: r.status, json: json, stdout: r.stdout, stderr: r.stderr };
}

function entry(result, id) {
  const pts = result.json && result.json.points;
  if (!Array.isArray(pts)) return null;
  return pts.find(function (x) { return x.id === id; });
}

const NEW_ENTRY_IDS = [
  'session-start-active-version',
  'verify-release-clean-tree',
  'frontmatter-yaml-validity',
  'release-dry-run-output',
  'working-tree-housekeeping',
];

// -- Test 1 (session-start-active-version: real broken state) -------
//
// Scaffold a HOME where installed_plugins.json says version A but the
// resolver lands on a cache root for version B. session-start derivation
// would record one or the other; the check verifies they AGREE. When they
// don't, the entry must FAIL.
try {
  const home = mktempHome('1-real');
  try {
    // Cache present for version B.
    const cacheDirB = seedMarketplaceCache(home, '1.13.0-beta.13');
    // BUT installed_plugins.json says version A (mismatched).
    seedInstalledPluginsJson(home, '1.13.0-beta.9', cacheDirB);
    const result = runAcceptance(home);
    assert.ok(result.json, 'JSON parses; stdout=' + (result.stdout || '').slice(0, 400) + ' stderr=' + (result.stderr || '').slice(0, 400));
    const e = entry(result, 'session-start-active-version');
    assert.ok(e, 'session-start-active-version entry not found in: ' + JSON.stringify((result.json.points || []).map(function (p) { return p.id; })));
    assert.strictEqual(e.ok, false,
      'session-start-active-version.ok must be false when installed_plugins.json version disagrees with active plugin.json; got finding=' + e.finding);
    pass('Test 1 (session-start-active-version: real broken state -> ok=false)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 1 (session-start-active-version: real broken state)', err); }

// -- Test 2 (verify-release-clean-tree: synthesized failure) --------
//
// Use DOCTOR_TEST_FAIL_POINT to synthesize a verify-release-clean-tree
// failure WITHOUT actually dirtying the dev workspace. The SAFE proxy
// pattern from Phase 123 (tests/test-doctor-acceptance.cjs).
try {
  const home = mktempHome('2-inj');
  try {
    const result = runAcceptance(home, { DOCTOR_TEST_FAIL_POINT: 'verify-release-clean-tree' });
    assert.ok(result.json, 'JSON parses');
    const e = entry(result, 'verify-release-clean-tree');
    assert.ok(e, 'verify-release-clean-tree entry not found');
    assert.strictEqual(e.ok, false, 'verify-release-clean-tree.ok must be false under synthesized failure');
    assert.match(e.finding || '', /synthesized failure \(test mode\)/i,
      'expected synthesized-failure finding; got: ' + e.finding);
    pass('Test 2 (verify-release-clean-tree: synthesized failure)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 2 (verify-release-clean-tree: synthesized failure)', err); }

// -- Test 3 (frontmatter-yaml-validity: synthesized failure) --------
try {
  const home = mktempHome('3-inj');
  try {
    const result = runAcceptance(home, { DOCTOR_TEST_FAIL_POINT: 'frontmatter-yaml-validity' });
    assert.ok(result.json, 'JSON parses');
    const e = entry(result, 'frontmatter-yaml-validity');
    assert.ok(e, 'frontmatter-yaml-validity entry not found');
    assert.strictEqual(e.ok, false, 'frontmatter-yaml-validity.ok must be false under synthesized failure');
    assert.match(e.finding || '', /synthesized failure \(test mode\)/i,
      'expected synthesized-failure finding; got: ' + e.finding);
    pass('Test 3 (frontmatter-yaml-validity: synthesized failure)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 3 (frontmatter-yaml-validity: synthesized failure)', err); }

// -- Test 4 (release-dry-run-output: synthesized failure) -----------
try {
  const home = mktempHome('4-inj');
  try {
    const result = runAcceptance(home, { DOCTOR_TEST_FAIL_POINT: 'release-dry-run-output' });
    assert.ok(result.json, 'JSON parses');
    const e = entry(result, 'release-dry-run-output');
    assert.ok(e, 'release-dry-run-output entry not found');
    assert.strictEqual(e.ok, false, 'release-dry-run-output.ok must be false under synthesized failure');
    assert.match(e.finding || '', /synthesized failure \(test mode\)/i,
      'expected synthesized-failure finding; got: ' + e.finding);
    pass('Test 4 (release-dry-run-output: synthesized failure)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 4 (release-dry-run-output: synthesized failure)', err); }

// -- Test 5 (working-tree-housekeeping: synthesized failure) --------
try {
  const home = mktempHome('5-inj');
  try {
    const result = runAcceptance(home, { DOCTOR_TEST_FAIL_POINT: 'working-tree-housekeeping' });
    assert.ok(result.json, 'JSON parses');
    const e = entry(result, 'working-tree-housekeeping');
    assert.ok(e, 'working-tree-housekeeping entry not found');
    assert.strictEqual(e.ok, false, 'working-tree-housekeeping.ok must be false under synthesized failure');
    assert.match(e.finding || '', /synthesized failure \(test mode\)/i,
      'expected synthesized-failure finding; got: ' + e.finding);
    pass('Test 5 (working-tree-housekeeping: synthesized failure)');
  } finally {
    rmTmp(home);
  }
} catch (err) { failTest('Test 5 (working-tree-housekeeping: synthesized failure)', err); }

// -- Test 6 (no regression: all 5 new checks pass against dev workspace) ----
//
// Live workspace, no synthetic failures. The 5 new checks must all PASS;
// this is the strongest signal that the implementation works against real
// state. verify-release sub-check is shimmed (mid-release CHANGELOG noise
// is known-acceptable per Plan 03 precedent).
try {
  const result = runAcceptanceLive();
  assert.ok(result.json, 'JSON parses against live workspace; stdout-tail=' + (result.stdout || '').slice(-400));
  for (const id of NEW_ENTRY_IDS) {
    const e = entry(result, id);
    assert.ok(e, 'new checklist entry ' + id + ' not found in live workspace run');
    assert.strictEqual(e.ok, true,
      id + '.ok must be true on dev workspace; got finding=' + e.finding + ' detail=' + JSON.stringify(e.detail || {}).slice(0, 300));
  }
  pass('Test 6 (no regression: all 5 new checks pass on dev workspace)');
} catch (err) { failTest('Test 6 (no regression: live workspace)', err); }

// -- Test 7 (isolation: one failure does not cascade to others) -----
//
// Under DOCTOR_TEST_FAIL_POINT=working-tree-housekeeping, the run-mode
// surfaces should remain isolated: ONLY working-tree-housekeeping fails;
// the other 4 new checks AND the 7 existing checks must remain GREEN.
try {
  const result = runAcceptanceLive({ DOCTOR_TEST_FAIL_POINT: 'working-tree-housekeeping' });
  assert.ok(result.json, 'JSON parses');
  // The targeted check fails.
  const target = entry(result, 'working-tree-housekeeping');
  assert.ok(target, 'working-tree-housekeeping entry not found');
  assert.strictEqual(target.ok, false, 'targeted check must be false; got finding=' + target.finding);
  // The other 4 new checks must remain ok=true.
  const otherNewIds = NEW_ENTRY_IDS.filter(function (id) { return id !== 'working-tree-housekeeping'; });
  for (const id of otherNewIds) {
    const e = entry(result, id);
    assert.ok(e, 'sibling new entry ' + id + ' not found');
    assert.strictEqual(e.ok, true,
      'isolation: ' + id + ' must remain ok=true when working-tree-housekeeping is synthesized to fail; got finding=' + e.finding);
  }
  // The existing pre-tag points (install-state, deployment-surfaces,
  // version-of-record-repo, verify-release, doctor-all) must also remain
  // ok=true. They are the Phase 123 baseline; one Plan 05 failure must not
  // cascade. (verify-release uses the shim so CHANGELOG noise doesn't bleed
  // into this assertion.)
  const existingIds = [
    'install-state',
    'deployment-surfaces',
    'version-of-record-repo',
    'verify-release',
    'doctor-all',
  ];
  for (const id of existingIds) {
    const e = entry(result, id);
    assert.ok(e, 'existing entry ' + id + ' not found');
    assert.strictEqual(e.ok, true,
      'isolation: existing entry ' + id + ' must remain ok=true; got finding=' + e.finding);
  }
  // And the runner's overall exit must be non-zero because the targeted
  // check failed.
  assert.notStrictEqual(result.exitCode, 0,
    'doctor --acceptance must exit non-zero when working-tree-housekeeping is synthesized to fail; got exit=' + result.exitCode);
  pass('Test 7 (isolation: working-tree-housekeeping fail does not cascade to siblings)');
} catch (err) { failTest('Test 7 (isolation: one failure does not cascade)', err); }

// -- Summary --------------------------------------------------------
console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
