#!/usr/bin/env node
'use strict';

/*
 * RCA doctor-marketplace-cache-drift-deadlock (2026-06-12).
 *
 * On a box with BOTH a marketplace-cache install (registry ->
 * cache/.../mos/1.13.1-beta.16) AND a vestigial legacy
 * ~/.claude/plugins/mindrian-os/ dir (stuck at 1.13.0-beta.30), doctor --fix
 * entered a permanent contradiction:
 *
 *   - checkInstallVersion() read the LEGACY dir (its existence short-circuited
 *     the topology-aware active-root read, which lived only inside the
 *     dir-missing branch) -> stale version -> drift.detected = true.
 *   - The class A recovery gate refused to run under marketplace-cache
 *     topology (by design; class I owns legacy migration) -> classARecovered
 *     null, recoveryError null.
 *   - The renderer fell back to the literal `recovery failed: unknown`.
 *   - _finalizeAndExit fired `if (report.drift.detected) process.exit(1)`
 *     unconditionally -> post-update-activation.cjs saw exit 1 -> permanent
 *     `activation failed: doctor exit 1` on every /mos:update Step 7.
 *
 * Fix under test:
 *   - checkInstallVersion() is topology-aware REGARDLESS of legacy-dir
 *     presence (active root wins; the vestigial legacy dir is informational).
 *   - When recovery is skipped by design (marketplace-cache topology),
 *     report.recoverySkipped records the reason, the renderer says
 *     `recovery skipped (...)` instead of `recovery failed: unknown`, and
 *     the exit code is 0 (skipped-by-design is not failure). Read-only
 *     drift signaling (exit 1 without --fix) is preserved.
 *   - Legacy/dev-clone topology behavior is byte-identical (drift detection,
 *     atomic recovery, exit codes 0/1/2/3/4).
 *
 * Five sub-tests:
 *   v.1  THE RCA fixture (coexistence): marketplace-cache beta.16 + registry
 *        + legacy dir at beta.30 -> doctor --json exits 0, drift false,
 *        install.version is the ACTIVE root's version (cache wins).
 *   v.2  fix path + activator contract: same fixture -> doctor --fix --json
 *        exits 0, classARecovered === null, recoveryError === null; human
 *        render of doctor --fix contains NEITHER 'recovery failed' NOR the
 *        bare word 'unknown'.
 *   v.3  post-update activation heals: same fixture -> doctor --fix
 *        --post-update exits 0 and does NOT print 'activation failed'.
 *   v.4  skipped-by-design render + exit: cache holds beta.15 AND beta.16 but
 *        the registry pins the OLDER beta.15 -> genuine class A drift under
 *        marketplace-cache topology. doctor --fix --json exits 0 with a
 *        recoverySkipped object (topology reason); human render says
 *        'recovery skipped' + 'marketplace-cache', never 'recovery failed:
 *        unknown'. Read-only doctor --json still exits 1 (drift signal kept).
 *   v.5  legacy-topology regression: legacy dir at an older version +
 *        populated cache + NO installed_plugins.json + MINDRIAN_OS_ROOT pinned
 *        at the legacy path (the a.2 idiom from
 *        tests/test-doctor-class-a-topology-drift.cjs) -> read-only exit 1
 *        with drift detected; --fix runs the atomic recovery (exit 2 +
 *        classARecovered set).
 *
 * Hermetic envelope mirrors tests/test-doctor-class-a-topology-drift.cjs:
 * per-test mkdtempSync HOME + USERPROFILE + MINDRIAN_PLUGIN_HOME override so
 * the resolver reads a scratch ~/.claude/plugins. Picked up by tests/run-all.sh
 * via the test-*.cjs glob.
 *
 * Canon Part 8: this test reads/writes only LOCAL scratch dirs. Zero network.
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

const LEGACY_V = '1.13.0-beta.30'; // the RCA box's stale legacy version
const CACHE_V = '1.13.1-beta.16';  // the RCA box's marketplace-cache version
const OLDER_CACHE_V = '1.13.1-beta.15'; // v.4's pinned-older active root

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'class-a-vestigial-' + suffix + '-'));
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

// Lay down a vestigial LEGACY install at <home>/.claude/plugins/mindrian-os/
// (the dir whose mere presence used to short-circuit the topology-aware read).
function makeLegacyDir(home, version) {
  const legacyDir = path.join(home, '.claude', 'plugins', 'mindrian-os');
  fs.mkdirSync(path.join(legacyDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(legacyDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  fs.mkdirSync(path.join(legacyDir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'bin', 'cli.js'), '#!/usr/bin/env node\n');
  return legacyDir;
}

// Write the Claude Code registry file (makes the resolver pick the cache install
// via installed_plugins.json -> topology marketplace-cache).
function makeInstalledPluginsJson(home, version, installPath) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 2,
    plugins: {
      'mos@mindrian-marketplace': [
        { scope: 'user', installPath, version, installedAt: '2026-06-12T00:00:00Z', lastUpdated: '2026-06-12T00:00:00Z' }
      ]
    }
  }, null, 2));
}

function hermeticEnv(home, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
  }, extraEnv || {});
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  if (!extraEnv || extraEnv.MINDRIAN_OS_ROOT === undefined) delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  return env;
}

// Shell out to doctor.cjs --json under a hermetic HOME.
function runDoctorJson(home, extraArgs, extraEnv) {
  const args = [DOCTOR].concat(extraArgs || []).concat(['--json']);
  const r = spawnSync('node', args, { env: hermeticEnv(home, extraEnv), encoding: 'utf8', timeout: 30000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// Shell out to doctor.cjs WITHOUT --json (human render); strips ANSI.
function runDoctorHuman(home, extraArgs, extraEnv) {
  const args = [DOCTOR].concat(extraArgs || []);
  const r = spawnSync('node', args, { env: hermeticEnv(home, extraEnv), encoding: 'utf8', timeout: 30000 });
  const out = ((r.stdout || '') + (r.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '');
  return { r, out };
}

// Build the RCA coexistence fixture: marketplace-cache install (registry-pinned)
// PLUS a vestigial legacy dir at a stale version.
function makeCoexistenceFixture(home) {
  const mcDir = makeMarketplaceCache(home, CACHE_V);
  makeInstalledPluginsJson(home, CACHE_V, mcDir);
  makeLegacyDir(home, LEGACY_V);
  return mcDir;
}

// -- v.1: THE RCA fixture -- coexistence deadlock broken --------------------
try {
  const home = makeTmpHome('v1');
  makeCoexistenceFixture(home);
  const { r, report } = runDoctorJson(home, []);
  assert.strictEqual(r.status, 0, 'doctor --json exits 0 on the coexistence box; got ' + r.status);
  assert.ok(report && report.drift, 'report.drift present');
  assert.strictEqual(report.drift.detected, false,
    'active root (cache ' + CACHE_V + ') wins over the vestigial legacy dir -- no drift; got ' + JSON.stringify(report.drift));
  assert.strictEqual(report.install.version, CACHE_V,
    'install.version is the ACTIVE root version, not the legacy dir version; got ' + report.install.version);
  rmTmp(home);
  pass('Test v.1 (coexistence: legacy dir present, active root wins, no drift, exit 0)');
} catch (err) { failTest('Test v.1 (coexistence: legacy dir present, active root wins, no drift, exit 0)', err); }

// -- v.2: fix path + activator contract -------------------------------------
try {
  const home = makeTmpHome('v2');
  makeCoexistenceFixture(home);
  const { r, report } = runDoctorJson(home, ['--fix']);
  assert.strictEqual(r.status, 0, 'doctor --fix --json exits 0 on the coexistence box; got ' + r.status);
  assert.ok(report, 'json report parsed');
  assert.strictEqual(report.classARecovered, null,
    'no recovery ran (nothing to recover); classARecovered must be null; got ' + JSON.stringify(report.classARecovered));
  assert.strictEqual(report.recoveryError, null,
    'no recovery error; recoveryError must be null; got ' + JSON.stringify(report.recoveryError));
  // Human render: the literal 'recovery failed' and the bare 'unknown' fallback
  // must be unreachable on this fixture. Scope the 'unknown' check to
  // recovery-related lines: the unrelated plugin-enabled-state row legitimately
  // says "treated as enabled (unknown, not an error)" on hermetic fixtures
  // (no ~/.claude.json), and that pre-existing render is out of this RCA's scope.
  const { out } = runDoctorHuman(home, ['--fix']);
  assert.ok(!/recovery failed/.test(out), 'human render must not say "recovery failed"; got: ' + out.slice(0, 300));
  const recoveryLines = out.split('\n').filter(l => /recovery/i.test(l));
  assert.ok(!recoveryLines.some(l => /\bunknown\b/.test(l)),
    'no recovery line may contain the bare word "unknown"; got: ' + JSON.stringify(recoveryLines));
  rmTmp(home);
  pass('Test v.2 (--fix exits 0, classARecovered/recoveryError null, no unknown render)');
} catch (err) { failTest('Test v.2 (--fix exits 0, classARecovered/recoveryError null, no unknown render)', err); }

// -- v.3: post-update activation heals --------------------------------------
try {
  const home = makeTmpHome('v3');
  makeCoexistenceFixture(home);
  const { r, out } = runDoctorHuman(home, ['--fix', '--post-update']);
  assert.strictEqual(r.status, 0, 'doctor --fix --post-update exits 0; got ' + r.status + ' :: ' + out.slice(0, 250));
  assert.ok(!/activation failed/.test(out), 'activator must not report "activation failed"; got: ' + out.slice(0, 250));
  rmTmp(home);
  pass('Test v.3 (post-update activation succeeds on the coexistence box)');
} catch (err) { failTest('Test v.3 (post-update activation succeeds on the coexistence box)', err); }

// -- v.4: skipped-by-design render + exit (genuine drift, marketplace-cache) -
try {
  const home = makeTmpHome('v4');
  // TWO cache version dirs; the registry pins the OLDER one as the active root.
  const olderDir = makeMarketplaceCache(home, OLDER_CACHE_V);
  makeMarketplaceCache(home, CACHE_V);
  makeInstalledPluginsJson(home, OLDER_CACHE_V, olderDir);
  // (a) --fix --json: skipped-by-design is NOT failure -> exit 0 + recoverySkipped.
  const { r: rf, report: fixReport } = runDoctorJson(home, ['--fix']);
  assert.strictEqual(rf.status, 0,
    'doctor --fix --json exits 0 when recovery is skipped by design; got ' + rf.status);
  assert.ok(fixReport && fixReport.drift && fixReport.drift.detected === true,
    'genuine class A drift detected (active ' + OLDER_CACHE_V + ' < cache latest ' + CACHE_V + '); got ' + JSON.stringify(fixReport && fixReport.drift));
  assert.ok(fixReport.recoverySkipped && typeof fixReport.recoverySkipped === 'object',
    'report.recoverySkipped object present; got ' + JSON.stringify(fixReport.recoverySkipped));
  assert.ok(/topology/.test(String(fixReport.recoverySkipped.reason)),
    'recoverySkipped.reason carries a topology reason; got ' + JSON.stringify(fixReport.recoverySkipped));
  // (b) human render: 'recovery skipped' + the topology, never 'recovery failed: unknown'.
  const { out } = runDoctorHuman(home, ['--fix']);
  assert.ok(/recovery skipped/.test(out), 'human render says "recovery skipped"; got: ' + out.slice(0, 300));
  assert.ok(/marketplace-cache/.test(out), 'human render names the marketplace-cache topology; got: ' + out.slice(0, 300));
  assert.ok(!/recovery failed: unknown/.test(out), 'the dead string "recovery failed: unknown" must not render; got: ' + out.slice(0, 300));
  // (c) read-only drift signaling preserved: doctor --json (no --fix) still exits 1.
  const { r: ro } = runDoctorJson(home, []);
  assert.strictEqual(ro.status, 1,
    'read-only doctor --json still exits 1 on genuine drift (signal preserved); got ' + ro.status);
  rmTmp(home);
  pass('Test v.4 (skipped-by-design: exit 0 + recoverySkipped + skipped render; read-only exit 1 kept)');
} catch (err) { failTest('Test v.4 (skipped-by-design: exit 0 + recoverySkipped + skipped render; read-only exit 1 kept)', err); }

// -- v.5: legacy-topology byte-identical regression --------------------------
try {
  const home = makeTmpHome('v5');
  // Legacy dir at an older version + populated cache + NO installed_plugins.json.
  // Pin MINDRIAN_OS_ROOT at the legacy path (the a.2 idiom) so the resolver
  // classifies a NON-marketplace-cache topology and the legacy recovery path runs.
  const legacyDir = makeLegacyDir(home, LEGACY_V);
  makeMarketplaceCache(home, CACHE_V);
  const pin = { MINDRIAN_OS_ROOT: legacyDir };
  // (a) read-only: drift detected, exit 1 (the CLI drift signal).
  const { r: ro, report: roReport } = runDoctorJson(home, [], pin);
  assert.strictEqual(ro.status, 1, 'read-only doctor --json exits 1 on legacy drift; got ' + ro.status);
  assert.ok(roReport && roReport.drift && roReport.drift.detected === true,
    'legacy topology drift detected; got ' + JSON.stringify(roReport && roReport.drift));
  // (b) --fix: the atomic recovery still runs (exit 2 + classARecovered set) --
  // the behavior covered today by scripts/test-doctor-recovery.cjs and
  // tests/test-doctor-atomic-swap.cjs.
  const { r: rf, report: fixReport } = runDoctorJson(home, ['--fix'], pin);
  assert.strictEqual(rf.status, 2, 'doctor --fix exits 2 (drift recovered) on legacy topology; got ' + rf.status);
  assert.ok(fixReport && fixReport.classARecovered,
    'classARecovered set after legacy recovery; got ' + JSON.stringify(fixReport && fixReport.classARecovered));
  assert.strictEqual(fixReport.classARecovered.recoveredVersion, CACHE_V,
    'recovered to the cache latest ' + CACHE_V + '; got ' + JSON.stringify(fixReport.classARecovered));
  rmTmp(home);
  pass('Test v.5 (legacy topology: drift + atomic recovery byte-identical)');
} catch (err) { failTest('Test v.5 (legacy topology: drift + atomic recovery byte-identical)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
