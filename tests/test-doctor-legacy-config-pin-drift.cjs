#!/usr/bin/env node
'use strict';

/*
 * Quick 260705-f6k -- /mos:doctor Class I legacy-config-pin-drift test.
 *
 * F11 repro (two confirmed real-world occurrences on the SAME Windows machine):
 * the LEGACY v1 plugin-system file ~/.claude/plugins/config.json keeps a
 * `mos.version` pin that drifts away from the MODERN installed_plugins.json
 * (schema v2, namespaced key `mos@mindrian-marketplace`).
 *   - 2026-07-02: config.json pinned 1.8.2  while the install had moved on.
 *   - 2026-07-05: config.json pinned 1.15.1 while the active build was
 *     1.15.3-beta.1 (recurrence -> confirmed drift class, not a one-off).
 * The stale pin poisons command registration while every other subsystem looks
 * healthy. doctor now flags this as the Class I finding `legacy-config-pin-drift`
 * and `--fix` backs up config.json then reconciles mos.version conservatively.
 *
 * Five scenarios:
 *   1. agree   -- config.json.mos.version === installed_plugins.json version
 *                 -> NO legacy-config-pin-drift finding.
 *   2. disagree+fix -- versions differ (flat top-level schema) -> finding
 *                 present; --fix rewrites the pin AND leaves a
 *                 config.json.*.bak backup; re-run is clean (fix is convergent).
 *   3. config.json absent   -- legacy artifact absent (fresh install) is
 *                 healthy, not an error -> NO finding.
 *   4. installed_plugins.json absent -- nothing to compare against -> NO finding.
 *   5. disagree+fix (repositories-nested schema) -- the OTHER config.json
 *                 generation confirmed live via a direct cross-check against a
 *                 real Windows install (2026-07-05): repositories.<mp>.plugins.
 *                 <plugin>.version, not the flat top-level key. Locks that the
 *                 shared resolver (not a `data[key]` shortcut) covers both.
 *
 * The sandbox will legitimately produce OTHER findings (record-absent, topology
 * not-found); we assert ONLY on presence/absence of the legacy-config-pin-drift
 * id, never on overall health. A source-grep guard catches a silent revert of
 * the doctor.cjs implementation.
 *
 * Hermetic envelope mirrors tests/test-doctor-class-h-fix.cjs +
 * tests/test-doctor-class-i.cjs: per-test mkdtempSync HOME + USERPROFILE +
 * MINDRIAN_PLUGIN_HOME override so the doctor reads scratch ~/.claude/plugins.
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

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f6k-legacy-pin-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) { try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ } }

// Lay down a synthetic marketplace-cache install so the resolver returns a
// non-null root (mirrors test-doctor-class-i.cjs makeMarketplaceCache).
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

// Write the MODERN Claude Code registry file. The namespaced key matters -- a
// plain `mos` key is exactly what the F11 recurrence note warns a grep misses.
function writeInstalledPluginsJson(home, version, installPath) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 2,
    plugins: {
      'mos@mindrian-marketplace': [
        { scope: 'user', version, installPath, lastUpdated: '2026-07-05T00:00:00Z', gitCommitSha: 'abc' }
      ]
    }
  }, null, 2));
}

// Write the LEGACY v1 plugin-system config.json with the real-world shape.
function writeLegacyConfigJson(home, version) {
  const file = path.join(home, '.claude', 'plugins', 'config.json');
  fs.writeFileSync(file, JSON.stringify({
    mos: { version, enabled: true, installedAt: '2026-04-06T00:00:00Z' }
  }, null, 2));
}

// Write the OTHER legacy generation actually confirmed live on a real Windows
// install (2026-07-05 cross-check): repositories.<mp>.plugins.<plugin>.version,
// not the flat top-level `mos` key. A naive `data[key]` lookup misses this
// entirely -- Test 5 below locks that the shared resolver (and --fix) covers it.
function writeRepositoriesNestedConfigJson(home, version) {
  const file = path.join(home, '.claude', 'plugins', 'config.json');
  fs.writeFileSync(file, JSON.stringify({
    repositories: {
      'mindrian-marketplace': {
        plugins: {
          mos: { version, enabled: true }
        }
      }
    }
  }, null, 2));
}

// Seed a minimal install-state record so the record-absent recovery does NOT
// spawn session-start during --fix (keeps the test fast + deterministic).
function seedInstallStateRecord(home, version, activeRoot) {
  const recordDir = path.join(home, '.mindrian');
  fs.mkdirSync(recordDir, { recursive: true });
  fs.writeFileSync(path.join(recordDir, 'install-state.json'), JSON.stringify({
    schema_version: 2,
    active_version: version,
    active_root: activeRoot,
    topology: 'marketplace-cache',
    installed_plugins_version: version,
    statusline_renders_version: version,
    last_version_file_value: version,
    path_bin_version: version,
  }, null, 2));
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), version + '\n');
}

function runDoctor(home, extraArgs) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
  });
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  const args = [DOCTOR, '--install-state', '--json'].concat(extraArgs || []);
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 30000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

function findLegacyPinFinding(report) {
  const c = report && report.checks && report.checks['install-state'];
  const findings = (c && c.findings) || [];
  return findings.find(f => (f.id || '') === 'legacy-config-pin-drift') || null;
}

// -- Source-grep guard: catch a silent revert of the doctor.cjs impl ---------
try {
  const src = fs.readFileSync(DOCTOR, 'utf8');
  assert.ok(src.includes('legacy-config-pin-drift'), 'doctor.cjs carries the legacy-config-pin-drift finding id');
  assert.ok(src.includes('readLegacyConfigPin'), 'doctor.cjs carries the readLegacyConfigPin helper');
  pass('Guard (doctor.cjs carries the legacy-config-pin-drift implementation)');
} catch (err) { failTest('Guard (doctor.cjs carries the legacy-config-pin-drift implementation)', err); }

// -- Test 1: agree -> NO finding --------------------------------------------
try {
  const home = makeTmpHome('t1');
  const V = '1.15.3-beta.1';
  const mcDir = makeMarketplaceCache(home, V);
  writeInstalledPluginsJson(home, V, mcDir);
  writeLegacyConfigJson(home, V); // same version -> agree
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0, 'class-flag invariant: exit 0; got ' + r.status);
  assert.ok(report && report.checks, 'JSON parses + checks present');
  assert.strictEqual(findLegacyPinFinding(report), null, 'no drift finding when versions agree');
  rmTmp(home);
  pass('Test 1 (agree -> no legacy-config-pin-drift finding)');
} catch (err) { failTest('Test 1 (agree -> no finding)', err); }

// -- Test 2: disagree -> finding; --fix reconciles + backs up; re-run clean --
try {
  const home = makeTmpHome('t2');
  const MODERN = '1.15.3-beta.1';
  const STALE = '1.15.1'; // the actual 2026-07-05 recurrence pair
  const mcDir = makeMarketplaceCache(home, MODERN);
  writeInstalledPluginsJson(home, MODERN, mcDir);
  writeLegacyConfigJson(home, STALE); // stale pin -> drift
  seedInstallStateRecord(home, MODERN, mcDir);

  // First run: the drift finding is present.
  let res = runDoctor(home);
  const finding = findLegacyPinFinding(res.report);
  assert.ok(finding, 'expected a legacy-config-pin-drift finding when versions differ');
  assert.strictEqual(finding.legacyVersion, STALE, 'finding carries the stale legacy version');
  assert.strictEqual(finding.modernVersion, MODERN, 'finding carries the modern version');
  assert.strictEqual(finding.recoverable, true, 'finding is recoverable');

  // --fix: rewrite config.json.mos.version to the modern version.
  runDoctor(home, ['--fix']);
  const cfgAfter = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'plugins', 'config.json'), 'utf8'));
  assert.strictEqual(cfgAfter.mos.version, MODERN, 'config.json mos.version reconciled to the modern version');
  // Conservative repair: other fields untouched.
  assert.strictEqual(cfgAfter.mos.enabled, true, 'config.json mos.enabled left untouched');
  assert.strictEqual(cfgAfter.mos.installedAt, '2026-04-06T00:00:00Z', 'config.json mos.installedAt left untouched');

  // A config.json.*.bak backup exists under ~/.mindrian/backups/.
  const backupsDir = path.join(home, '.mindrian', 'backups');
  assert.ok(fs.existsSync(backupsDir), 'backups dir created');
  const baks = fs.readdirSync(backupsDir).filter(f => /^config\.json\..*\.bak$/.test(f));
  assert.ok(baks.length >= 1, 'a config.json.*.bak backup exists; got ' + JSON.stringify(fs.readdirSync(backupsDir)));
  // Filename-safety regression lock (2026-07-05 Windows finding): a raw
  // toISOString() timestamp contains ':', a reserved character on Windows
  // (NTFS) that makes fs.copyFileSync throw -- the outer catch swallowed it,
  // so --fix silently no-op'd there (detection worked, repair did not).
  // Asserted here so a future regression fails on EVERY platform, not only
  // when someone happens to test on Windows.
  for (const name of baks) {
    assert.ok(!name.includes(':'), 'backup filename must not contain \':\' (Windows-illegal): ' + name);
  }

  // Re-run: the fix is convergent -> no drift finding.
  res = runDoctor(home);
  assert.strictEqual(findLegacyPinFinding(res.report), null, 'no drift finding after --fix (convergent)');
  rmTmp(home);
  pass('Test 2 (disagree -> finding + --fix reconciles + backup + re-run clean)');
} catch (err) { failTest('Test 2 (disagree + fix)', err); }

// -- Test 3: config.json absent -> NO finding (fresh-install healthy) --------
try {
  const home = makeTmpHome('t3');
  const V = '1.15.3-beta.1';
  const mcDir = makeMarketplaceCache(home, V);
  writeInstalledPluginsJson(home, V, mcDir);
  // Intentionally do NOT write config.json.
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0, 'class-flag invariant: exit 0; got ' + r.status);
  assert.strictEqual(findLegacyPinFinding(report), null, 'no drift finding when config.json is absent');
  rmTmp(home);
  pass('Test 3 (config.json absent -> no finding)');
} catch (err) { failTest('Test 3 (config.json absent)', err); }

// -- Test 4: installed_plugins.json absent -> NO finding ---------------------
try {
  const home = makeTmpHome('t4');
  // Legacy pin present, but NO modern registry to compare against.
  writeLegacyConfigJson(home, '1.8.2');
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0, 'class-flag invariant: exit 0; got ' + r.status);
  assert.strictEqual(findLegacyPinFinding(report), null, 'no drift finding when installed_plugins.json is absent');
  rmTmp(home);
  pass('Test 4 (installed_plugins.json absent -> no finding)');
} catch (err) { failTest('Test 4 (installed_plugins.json absent)', err); }

// -- Test 5: repositories-nested schema -> finding + --fix reconciles -------
// The generation actually confirmed live via a direct cross-check against a
// real Windows install (2026-07-05). This is the schema Test 2 does NOT
// cover (Test 2 uses the flat top-level shape) -- without the shared
// resolver fix, --fix would silently skip with "could not re-resolve the
// mos pin key" because `data.mos` does not exist in this generation.
try {
  const home = makeTmpHome('t5');
  const MODERN = '1.15.3-beta.1';
  const STALE = '1.15.1';
  const mcDir = makeMarketplaceCache(home, MODERN);
  writeInstalledPluginsJson(home, MODERN, mcDir);
  writeRepositoriesNestedConfigJson(home, STALE);
  seedInstallStateRecord(home, MODERN, mcDir);

  let res = runDoctor(home);
  const finding = findLegacyPinFinding(res.report);
  assert.ok(finding, 'expected a legacy-config-pin-drift finding under the repositories-nested schema');
  assert.strictEqual(finding.legacyVersion, STALE, 'finding carries the stale legacy version');
  assert.strictEqual(finding.modernVersion, MODERN, 'finding carries the modern version');

  runDoctor(home, ['--fix']);
  const cfgAfter = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'plugins', 'config.json'), 'utf8'));
  assert.strictEqual(
    cfgAfter.repositories['mindrian-marketplace'].plugins.mos.version,
    MODERN,
    'nested repositories.<mp>.plugins.mos.version reconciled to the modern version'
  );
  assert.strictEqual(cfgAfter.repositories['mindrian-marketplace'].plugins.mos.enabled, true, 'sibling field left untouched');

  res = runDoctor(home);
  assert.strictEqual(findLegacyPinFinding(res.report), null, 'no drift finding after --fix on the nested schema (convergent)');
  rmTmp(home);
  pass('Test 5 (repositories-nested schema -> finding + --fix reconciles)');
} catch (err) { failTest('Test 5 (repositories-nested schema)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
