#!/usr/bin/env node
'use strict';

/*
 * Debug session doctor-class-a-drift-topology-blind-false-positive (2026-05-31).
 *
 * The class A "install-missing" drift branch in scripts/doctor.cjs (the one that
 * feeds the SessionStart preflight banner via scripts/doctor-preflight-format.cjs)
 * was topology-blind: it fired on `installResult.status === 'missing' &&
 * cacheResult.status === 'ok'` keyed off the hardcoded legacy INSTALL_DIR
 * (~/.claude/plugins/mindrian-os), with no consultation of resolveActivePluginRoot().
 * Under marketplace-cache topology that legacy dir is CORRECTLY absent -- Claude Code
 * loads the plugin from the cache path in installed_plugins.json -- so the branch
 * reported false "install dir missing" drift and the banner fired on every healthy
 * session, while the topology-aware class I gate (--install-state) reported healthy.
 *
 * Fix: a topology guard `resolveActivePluginRoot().topology !== 'marketplace-cache'`
 * on the drift branch (plus a defense-in-depth guard on the --fix recovery gate).
 *
 * These tests assert the fixed contract:
 *   a.1  marketplace-cache topology + absent legacy dir + populated cache
 *        -> report.drift.detected === false AND formatPreflightWarning(report) === ''
 *        (the false banner is gone; cross-gate consistency restored).
 *   a.2  NON-marketplace-cache topology + absent legacy dir + populated cache
 *        -> report.drift.detected === true reason === 'install-missing'
 *        (the legacy/dev recovery path is preserved -- no regression).
 *   a.3  cross-gate consistency: on the SAME marketplace-cache install, doctor --json
 *        and doctor --install-state AGREE (both healthy / no drift).
 *
 * Hermetic envelope mirrors tests/test-doctor-class-i.cjs: per-test mkdtempSync HOME
 * + USERPROFILE + MINDRIAN_PLUGIN_HOME override so the resolver reads a scratch
 * ~/.claude/plugins. Registered in lib/memory/run-feynman-tests.cjs and picked up by
 * tests/run-all.sh's test-*.cjs glob.
 *
 * Canon Part 8: this test reads/writes only LOCAL scratch dirs. Zero network surface.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const { formatPreflightWarning } = require(path.join(REPO_ROOT, 'scripts', 'doctor-preflight-format.cjs'));

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'class-a-topo-' + suffix + '-'));
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

// Write the Claude Code registry file (makes the resolver pick the cache install
// via installed_plugins.json -> topology marketplace-cache).
function makeInstalledPluginsJson(home, version, installPath) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 2,
    plugins: {
      'mos@mindrian-marketplace': [
        { scope: 'user', installPath, version, installedAt: '2026-05-31T00:00:00Z', lastUpdated: '2026-05-31T00:00:00Z' }
      ]
    }
  }, null, 2));
}

// Shell out to doctor.cjs --json under a hermetic HOME. extraEnv lets a test pin
// MINDRIAN_OS_ROOT (which forces a non-marketplace-cache topology). The default
// scrub deletes any inherited MINDRIAN_OS_ROOT so marketplace-cache tests are clean.
function runDoctorJson(home, extraArgs, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
  }, extraEnv || {});
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  if (!extraEnv || extraEnv.MINDRIAN_OS_ROOT === undefined) delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  const args = [DOCTOR].concat(extraArgs || []).concat(['--json']);
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 30000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// Run doctor --install-state (class I, topology-aware) and return its parsed report.
function runInstallState(home) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
    MINDRIAN_STATUSLINE_SURFACE: 'CLI',
  });
  delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  const r = spawnSync('node', [DOCTOR, '--install-state', '--json'], { env, encoding: 'utf8', timeout: 30000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// -- a.1: marketplace-cache + absent legacy -> NO drift, NO banner ---------
try {
  const home = makeTmpHome('a1');
  const V = '1.13.0-beta.40';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  // Critically: NO legacy ~/.claude/plugins/mindrian-os dir. checkInstallVersion()
  // returns status:'missing' against the legacy INSTALL_DIR -- the exact false-positive
  // trigger. The topology guard must suppress the drift.
  const { r, report } = runDoctorJson(home, []);
  assert.strictEqual(r.status, 0, 'doctor --json exits 0; got ' + r.status);
  assert.ok(report && report.drift, 'report.drift present');
  assert.strictEqual(report.drift.detected, false,
    'marketplace-cache topology + absent legacy dir must NOT be drift; got ' + JSON.stringify(report.drift));
  // The SessionStart formatter must be silent on this report.
  const banner = formatPreflightWarning(report, { color: false });
  assert.strictEqual(banner, '', 'preflight banner must be empty on healthy marketplace-cache; got [' + banner + ']');
  rmTmp(home);
  pass('Test a.1 (marketplace-cache + absent legacy -> no drift, no banner)');
} catch (err) { failTest('Test a.1 (marketplace-cache + absent legacy -> no drift, no banner)', err); }

// -- a.2: non-marketplace-cache topology + absent legacy + cache -> drift FIRES (no regression) --
try {
  const home = makeTmpHome('a2');
  const V = '1.13.0-beta.40';
  // Cache HAS versions (so the recovery is possible)...
  makeMarketplaceCache(home, V);
  // ...but the active topology is NOT marketplace-cache. Pinning MINDRIAN_OS_ROOT
  // to the (absent) legacy path forces topology 'dev-clone' -- a non-marketplace-cache
  // topology -- which is the class of state where a genuinely-missing legacy active
  // root must STILL report install-missing drift (the recovery path the guard preserves).
  // No installed_plugins.json and no legacy dir on disk -> checkInstallVersion() == missing.
  const legacyPath = path.join(home, '.claude', 'plugins', 'mindrian-os');
  const { r, report } = runDoctorJson(home, [], { MINDRIAN_OS_ROOT: legacyPath });
  // doctor --json exits 1 to SIGNAL detected drift (CLI contract); the JSON still
  // parses. The recovery-path assertion is on the parsed drift verdict, not exit 0.
  assert.notStrictEqual(r.status, 3, 'no internal error (exit 3); got ' + r.status);
  assert.ok(report && report.drift, 'report.drift present (json parsed despite drift exit)');
  assert.strictEqual(report.drift.detected, true,
    'non-marketplace-cache topology + missing legacy + populated cache MUST still be drift (recovery path preserved); got ' + JSON.stringify(report.drift));
  assert.strictEqual(report.drift.reason, 'install-missing',
    'drift reason must be install-missing; got ' + JSON.stringify(report.drift));
  rmTmp(home);
  pass('Test a.2 (non-marketplace-cache topology -> install-missing drift preserved)');
} catch (err) { failTest('Test a.2 (non-marketplace-cache topology -> install-missing drift preserved)', err); }

// -- a.3: cross-gate consistency -- --json and --install-state AGREE -------
try {
  const home = makeTmpHome('a3');
  const V = '1.13.0-beta.40';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  // class A gate (--json drift)
  const { report: jsonReport } = runDoctorJson(home, []);
  assert.ok(jsonReport && jsonReport.drift, 'json report.drift present');
  const classADrift = jsonReport.drift.detected === true;
  // class I gate (--install-state)
  const { report: isReport } = runInstallState(home);
  assert.ok(isReport && isReport.checks && isReport.checks['install-state'],
    'install-state check present');
  const c = isReport.checks['install-state'];
  assert.strictEqual(c.topology, 'marketplace-cache', 'class I classifies topology marketplace-cache; got ' + c.topology);
  // A "no legacy clone" / "install dir does not exist" finding would be the class I
  // analogue of the false positive -- there must be none on a healthy marketplace-cache.
  const findings = c.findings || [];
  const classIFalsePositive = findings.some(f => /no.*legacy|legacy.*missing|install dir does not exist/i.test(f.finding || ''));
  // The invariant: both gates agree the install is healthy (no drift on either side).
  assert.strictEqual(classADrift, false, 'class A (--json) reports no drift on healthy marketplace-cache');
  assert.strictEqual(classIFalsePositive, false, 'class I (--install-state) reports no false-positive finding');
  // Therefore the two gates AGREE (both healthy).
  assert.strictEqual(classADrift, classIFalsePositive,
    'cross-gate consistency: class A drift and class I false-positive verdicts must agree');
  rmTmp(home);
  pass('Test a.3 (cross-gate consistency: --json and --install-state agree)');
} catch (err) { failTest('Test a.3 (cross-gate consistency: --json and --install-state agree)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
