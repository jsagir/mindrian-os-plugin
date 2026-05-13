#!/usr/bin/env node
'use strict';

/*
 * Phase 123 Plan-03 Task 1 -- /mos:doctor class I (install-state +
 * topology + version-of-record consistency) hermetic test fixtures.
 *
 * Eleven scenarios exercise the new class:
 *   i.1  absent ~/.mindrian/install-state.json -> warn + recoverable
 *   i.2  wrong-version ~/.mindrian-last-version -> drift; --fix rewrites it
 *   i.3  legacy clone + healthy marketplace-cache -> migration candidate;
 *        --fix backup-then-verify-then-remove (legacy gone, tarball
 *        present, marketplace-cache untouched)
 *   i.4  legacy clone with uncommitted git changes -> --fix REFUSES;
 *        legacy dir remains
 *   i.5  MINDRIAN_OS_ROOT -> dev-clone -> --fix NEVER touches it (no rm,
 *        no rename, no backup tarball for this path); topology classified
 *        as dev-clone
 *   i.6  installed_plugins.json version == "1.12.5.1" (4-component non-
 *        semver) -> no crash; exit != 3 (internal-error)
 *   i.7  6-way version-of-record green on clean install -> no drift
 *   i.8  6-way version-of-record red when LV diverges -> drift finding
 *   i.9  --fix recovers missing install-state record via session-start
 *        spawn (mocked or real, depending on harness)
 *   i.10 record present but stale (live spot-check disagrees with
 *        installed_plugins.json) -> "record stale -- re-run session-start"
 *   i.11 topology classified correctly for marketplace-cache (BUG 7 fix --
 *        assert this is NOT a drift finding)
 *
 * Hermetic envelope: per-test mkdtempSync HOME + USERPROFILE +
 * MINDRIAN_PLUGIN_HOME override so the detector reads scratch
 * ~/.claude/plugins. Mirrors tests/test-doctor-class-g.cjs makeTmpHome
 * and tests/test-doctor-atomic-swap.cjs MINDRIAN_PLUGIN_HOME pattern.
 *
 * Registered in lib/memory/run-feynman-tests.cjs (Phase-123 block) and
 * picked up automatically by tests/run-all.sh's test-*.cjs glob.
 *
 * RED until Phase 123 Plan-03 Task 2 lands class I in doctor.cjs.
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '123-03-i-' + suffix + '-'));
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

// Write the Claude Code registry file.
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

// Write a synthetic ~/.mindrian/install-state.json record.
function makeInstallStateRecord(home, fields) {
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

// Lay down a synthetic LEGACY clone at <home>/.claude/plugins/mindrian-os/.
// Optionally make it git-dirty by initializing git + adding an untracked file.
function makeLegacyClone(home, version, opts) {
  const o = opts || {};
  const legacyDir = path.join(home, '.claude', 'plugins', 'mindrian-os');
  fs.mkdirSync(path.join(legacyDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(legacyDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  fs.writeFileSync(path.join(legacyDir, 'install.sh'), '#!/usr/bin/env bash\necho legacy install\n');
  if (o.git) {
    // Real `git init` so `git -C <legacy> status --porcelain` runs cleanly.
    try {
      spawnSync('git', ['-C', legacyDir, 'init', '-q'], { encoding: 'utf8' });
      spawnSync('git', ['-C', legacyDir, 'config', 'user.email', 'test@example.com'], { encoding: 'utf8' });
      spawnSync('git', ['-C', legacyDir, 'config', 'user.name', 'Test'], { encoding: 'utf8' });
    } catch (_) { /* ignore -- if git is unavailable the doctor's --fix should fall through to other refuse-checks */ }
    if (o.dirty) {
      // Write an untracked file. This makes `git status --porcelain` non-empty.
      fs.writeFileSync(path.join(legacyDir, 'dirty-file.txt'), 'dirty\n');
    }
  }
  return legacyDir;
}

// Lay down a synthetic DEV-CLONE shape at a hermetic path. Includes a fake
// .git + install.sh + plugin.json so the dev-clone structural probe in
// active-plugin-root.cjs would classify it as dev-clone (and MINDRIAN_OS_ROOT
// short-circuits the classification before the probe runs, per Plan-02).
function makeDevCloneRoot(home, version) {
  const root = path.join(home, 'MindrianOS-Plugin-dev-clone');
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  fs.writeFileSync(path.join(root, 'install.sh'), '#!/usr/bin/env bash\n');
  try {
    spawnSync('git', ['-C', root, 'init', '-q'], { encoding: 'utf8' });
    spawnSync('git', ['-C', root, 'config', 'user.email', 'test@example.com'], { encoding: 'utf8' });
    spawnSync('git', ['-C', root, 'config', 'user.name', 'Test'], { encoding: 'utf8' });
    spawnSync('git', ['-C', root, 'remote', 'add', 'origin', 'https://github.com/jsagir/mindrian-os-plugin.git'], { encoding: 'utf8' });
  } catch (_) { /* ignore */ }
  return root;
}

function runDoctor(home, extraArgs, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
  }, extraEnv || {});
  // Force CLI surface so non-TTY child spawn does not fall back to DESKTOP.
  if (!env.MINDRIAN_STATUSLINE_SURFACE) env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  // Default scrub: tests own MINDRIAN_OS_ROOT (i.5 sets it).
  if (!extraEnv || extraEnv.MINDRIAN_OS_ROOT === undefined) delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  const args = [DOCTOR].concat(extraArgs || []).concat(['--json']);
  const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 30000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

// -- i.1: absent install-state record -> warn + recoverable ----------------
try {
  const home = makeTmpHome('i1');
  // Synthesize the minimum so the resolver returns something non-null.
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.13');
  makeInstalledPluginsJson(home, '1.13.0-beta.13', mcDir);
  // Intentionally do NOT write ~/.mindrian/install-state.json.
  const { r, report } = runDoctor(home, ['--install-state']);
  assert.strictEqual(r.status, 0, 'class-flag invariant: exit 0; got ' + r.status);
  assert.ok(report && report.checks, 'JSON parses + checks key present');
  const c = report.checks['install-state'];
  assert.ok(c, 'install-state check key present in report.checks');
  assert.strictEqual(c.status, 'warn', 'expected warn; got ' + c.status);
  assert.strictEqual(c.recoverable, true, 'expected recoverable=true');
  const findings = c.findings || [];
  const hasAbsent = findings.some(f => /install-state.*absent/i.test(f.finding || ''));
  assert.ok(hasAbsent, 'expected an "install-state record absent" finding');
  rmTmp(home);
  pass('Test i.1 (absent record -> warn + recoverable)');
} catch (err) { failTest('Test i.1 (absent record -> warn + recoverable)', err); }

// -- i.2: wrong-version ~/.mindrian-last-version -> drift; --fix rewrites --
try {
  const home = makeTmpHome('i2');
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.13');
  makeInstalledPluginsJson(home, '1.13.0-beta.13', mcDir);
  makeInstallStateRecord(home, { active_root: mcDir });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '0.0.0-stale\n');
  // First run: detect drift on the LV-vs-IP leg.
  let { report } = runDoctor(home, ['--install-state']);
  let c = report.checks['install-state'];
  assert.strictEqual(c.status, 'warn', 'expected warn (drift); got ' + c.status);
  const findings = c.findings || [];
  const hasVor = findings.some(f => /vor-|version-of-record|last.?version|last_version|0\.0\.0-stale/i.test(f.id || f.finding || ''));
  assert.ok(hasVor, 'expected a version-of-record divergence finding involving last-version');
  // Second run: --fix should rewrite the file.
  ({ report } = runDoctor(home, ['--install-state', '--fix']));
  const lvAfter = fs.readFileSync(path.join(home, '.mindrian-last-version'), 'utf8').trim();
  assert.strictEqual(lvAfter, '1.13.0-beta.13', '~/.mindrian-last-version was rewritten to match IP');
  rmTmp(home);
  pass('Test i.2 (wrong LV -> drift + --fix rewrites)');
} catch (err) { failTest('Test i.2 (wrong LV -> drift + --fix rewrites)', err); }

// -- i.3: legacy clone + marketplace-cache -> migration via --fix ----------
try {
  const home = makeTmpHome('i3');
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.13');
  makeInstalledPluginsJson(home, '1.13.0-beta.13', mcDir);
  makeInstallStateRecord(home, { active_root: mcDir });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.13.0-beta.13\n');
  const legacyDir = makeLegacyClone(home, '0.0.0', { git: false, dirty: false });
  // Now mutate the resolver: with installed_plugins.json pointing at mcDir
  // the resolver picks mcDir; but we still want class I to *see* the legacy
  // path exists. checkInstallState's detectMarketplaceCacheInstall finds the
  // healthy mc, and the legacy probe at ~/.claude/plugins/mindrian-os/ is
  // separate. doctor --install-state should classify topology marketplace-cache
  // (per the resolver) AND flag the legacy clone as a migration candidate.
  let { report } = runDoctor(home, ['--install-state']);
  let c = report.checks['install-state'];
  const findings = c.findings || [];
  const isMigCandidate = findings.some(f => /legacy.*migration|migrate|legacy.clone/i.test(f.finding || ''));
  assert.ok(isMigCandidate, 'expected a legacy-clone migration-candidate finding; findings=' + JSON.stringify(findings));
  // Apply --fix -- the legacy dir should be tarred + removed.
  ({ report } = runDoctor(home, ['--install-state', '--fix']));
  assert.strictEqual(fs.existsSync(legacyDir), false, 'legacy dir removed');
  // A backup tarball should exist.
  const backupsDir = path.join(home, '.mindrian', 'backups');
  assert.ok(fs.existsSync(backupsDir), 'backups dir created');
  const tarballs = fs.readdirSync(backupsDir).filter(f => /^legacy-.*\.tar\.gz$/.test(f));
  assert.ok(tarballs.length >= 1, 'a legacy-* tarball exists in ~/.mindrian/backups/');
  // The marketplace-cache install is UNTOUCHED.
  const mcPj = JSON.parse(fs.readFileSync(path.join(mcDir, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.strictEqual(mcPj.version, '1.13.0-beta.13', 'marketplace-cache install untouched');
  rmTmp(home);
  pass('Test i.3 (legacy + marketplace-cache -> migration via --fix)');
} catch (err) { failTest('Test i.3 (legacy + marketplace-cache -> migration via --fix)', err); }

// -- i.4: dirty legacy clone -> --fix REFUSES; legacy remains -------------
try {
  const home = makeTmpHome('i4');
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.13');
  makeInstalledPluginsJson(home, '1.13.0-beta.13', mcDir);
  makeInstallStateRecord(home, { active_root: mcDir });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.13.0-beta.13\n');
  const legacyDir = makeLegacyClone(home, '0.0.0', { git: true, dirty: true });
  const { report } = runDoctor(home, ['--install-state', '--fix']);
  // The legacy dir must STILL be there (migration refused).
  assert.strictEqual(fs.existsSync(legacyDir), true, 'legacy dir remains -- --fix refused');
  // The recovery records (in any of report.recoveries / report.recovered)
  // should include a skipped entry for legacy-clone.
  const recoveries = (report && (report.recoveries || report.recovered)) || [];
  const skipped = recoveries.some(rec => {
    const reason = (rec && (rec.reason || rec.detail || '')) + '';
    const surface = (rec && (rec.surface || rec.tool || '')) + '';
    const action = (rec && (rec.action || '')) + '';
    return /legacy/i.test(surface) && /skip/i.test(action) && /dirty|uncommitted|unpushed|porcelain/i.test(reason);
  });
  assert.ok(skipped, 'expected a {surface:"legacy-clone", action:"skipped", reason: dirty/uncommitted} recovery entry; got ' + JSON.stringify(recoveries));
  rmTmp(home);
  pass('Test i.4 (dirty legacy -> --fix refuses)');
} catch (err) { failTest('Test i.4 (dirty legacy -> --fix refuses)', err); }

// -- i.5: MINDRIAN_OS_ROOT (dev-clone) -> --fix NEVER touches it ----------
try {
  const home = makeTmpHome('i5');
  // No marketplace-cache install -- the resolver follows MINDRIAN_OS_ROOT.
  const devRoot = makeDevCloneRoot(home, '1.13.0-beta.13');
  makeInstalledPluginsJson(home, '1.13.0-beta.13', devRoot);
  makeInstallStateRecord(home, { active_root: devRoot, topology: 'dev-clone' });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.13.0-beta.13\n');
  const { report } = runDoctor(home, ['--install-state', '--fix'], { MINDRIAN_OS_ROOT: devRoot });
  const c = report.checks['install-state'];
  assert.strictEqual(c.topology, 'dev-clone', 'topology classified as dev-clone; got ' + c.topology);
  // The dev-clone root must STILL exist and be untouched.
  assert.strictEqual(fs.existsSync(path.join(devRoot, '.claude-plugin', 'plugin.json')), true, 'dev clone untouched');
  // No backup tarball anywhere referencing the dev-clone path.
  const backupsDir = path.join(home, '.mindrian', 'backups');
  if (fs.existsSync(backupsDir)) {
    for (const f of fs.readdirSync(backupsDir)) {
      assert.ok(!/dev-clone|MindrianOS-Plugin-dev/i.test(f), 'no backup tarball references dev-clone path: ' + f);
    }
  }
  rmTmp(home);
  pass('Test i.5 (dev-clone -> never touched by --fix)');
} catch (err) { failTest('Test i.5 (dev-clone -> never touched by --fix)', err); }

// -- i.6: 4-component non-semver 1.12.5.1 -> no crash; exit != 3 ---------
try {
  const home = makeTmpHome('i6');
  const mcDir = makeMarketplaceCache(home, '1.12.5.1');
  makeInstalledPluginsJson(home, '1.12.5.1', mcDir);
  makeInstallStateRecord(home, {
    active_root: mcDir,
    active_version: '1.12.5.1',
    installed_plugins_version: '1.12.5.1',
    last_version_file_value: '1.12.5.1',
    path_bin_version: '1.12.5.1',
  });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.12.5.1\n');
  const { r, report } = runDoctor(home, ['--install-state']);
  // Class-flag invariant: exit 0 (no crash -> NOT exit 3).
  assert.notStrictEqual(r.status, 3, 'no internal error; got ' + r.status);
  assert.ok(report && report.checks && report.checks['install-state'], 'install-state check ran without crashing on 1.12.5.1');
  rmTmp(home);
  pass('Test i.6 (1.12.5.1 non-semver -> no crash)');
} catch (err) { failTest('Test i.6 (1.12.5.1 non-semver -> no crash)', err); }

// -- i.7: 6-way version-of-record green on a clean install -> no drift ---
try {
  const home = makeTmpHome('i7');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, {
    active_root: mcDir,
    active_version: V,
    installed_plugins_version: V,
    last_version_file_value: V,
    path_bin_version: V,
    statusline_renders_version: V,
    topology: 'marketplace-cache',
  });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), V + '\n');
  const { report } = runDoctor(home, ['--install-state']);
  const c = report.checks['install-state'];
  const findings = c.findings || [];
  // No version-of-record divergences on the IP-LV / IP-AV legs.
  const vorIssues = findings.filter(f => /^vor-/i.test(f.id || ''));
  assert.strictEqual(vorIssues.length, 0, 'no version-of-record divergences on clean install; got ' + JSON.stringify(vorIssues));
  rmTmp(home);
  pass('Test i.7 (clean install -> 6-way VoR green)');
} catch (err) { failTest('Test i.7 (clean install -> 6-way VoR green)', err); }

// -- i.8: 6-way VoR red when LV diverges -> drift finding ----------------
try {
  const home = makeTmpHome('i8');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, { active_root: mcDir });
  // LV is wrong on disk.
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), 'wrong-1.0.0\n');
  const { report } = runDoctor(home, ['--install-state']);
  const c = report.checks['install-state'];
  const findings = c.findings || [];
  const hasLv = findings.some(f => /(last.?version|LV|wrong-1\.0\.0)/i.test((f.id || '') + ' ' + (f.finding || '')));
  assert.ok(hasLv, 'expected a VoR divergence flagging the LV mismatch');
  rmTmp(home);
  pass('Test i.8 (LV divergence -> drift)');
} catch (err) { failTest('Test i.8 (LV divergence -> drift)', err); }

// -- i.9: --fix recovers missing record by spawning session-start --------
try {
  const home = makeTmpHome('i9');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  // Intentionally no record on disk.
  const recordPath = path.join(home, '.mindrian', 'install-state.json');
  assert.strictEqual(fs.existsSync(recordPath), false, 'record absent before --fix');
  const { report } = runDoctor(home, ['--install-state', '--fix']);
  const recoveries = (report && (report.recoveries || report.recovered)) || [];
  // We assert the recovery entry recorded the attempt. Whether the spawned
  // session-start actually materialized the record depends on the real
  // session-start script's behavior in a hermetic env -- the recovery entry
  // is the contract Plan-3 owns.
  const tried = recoveries.some(rec => {
    const surface = (rec && (rec.surface || rec.tool || '')) + '';
    const action = (rec && (rec.action || '')) + '';
    return /record|install-state/i.test(surface) && /session-start|record-write|spawn/i.test(action);
  });
  assert.ok(tried, 'expected a recovery entry for {surface:"record", action:"session-start-write"}; got ' + JSON.stringify(recoveries));
  rmTmp(home);
  pass('Test i.9 (--fix records the session-start recovery attempt)');
} catch (err) { failTest('Test i.9 (--fix records the session-start recovery attempt)', err); }

// -- i.10: record present but stale (spot-check disagrees) ---------------
try {
  const home = makeTmpHome('i10');
  const mcDir = makeMarketplaceCache(home, '1.13.0-beta.13');
  // installed_plugins.json says 1.13.0-beta.13 (the live truth)...
  makeInstalledPluginsJson(home, '1.13.0-beta.13', mcDir);
  // ...but the record says the active version was something different.
  makeInstallStateRecord(home, {
    active_root: mcDir,
    active_version: '1.12.0',
    installed_plugins_version: '1.12.0', // record's snapshot of IP at write-time
    last_version_file_value: '1.12.0',
    path_bin_version: '1.12.0',
  });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '1.13.0-beta.13\n');
  const { report } = runDoctor(home, ['--install-state']);
  const c = report.checks['install-state'];
  const findings = c.findings || [];
  const stale = findings.some(f => /record.*stale|re-?run.*session-start/i.test(f.finding || ''));
  assert.ok(stale, 'expected a "record stale -- re-run session-start" finding; got ' + JSON.stringify(findings));
  rmTmp(home);
  pass('Test i.10 (record stale -> re-run session-start finding)');
} catch (err) { failTest('Test i.10 (record stale -> re-run session-start finding)', err); }

// -- i.11: marketplace-cache topology -> NOT a drift finding (BUG 7) ----
try {
  const home = makeTmpHome('i11');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, {
    active_root: mcDir, active_version: V,
    installed_plugins_version: V, last_version_file_value: V, path_bin_version: V,
    statusline_renders_version: V, topology: 'marketplace-cache',
  });
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), V + '\n');
  // No legacy dir on this box -- bug 7's "no legacy clone" must be HEALTHY.
  const { report } = runDoctor(home, ['--install-state']);
  const c = report.checks['install-state'];
  assert.strictEqual(c.topology, 'marketplace-cache', 'topology classified as marketplace-cache');
  const findings = c.findings || [];
  const falsePositive = findings.some(f => /no.*legacy|legacy.*missing|install dir does not exist/i.test(f.finding || ''));
  assert.strictEqual(falsePositive, false, 'BUG 7 fix: marketplace-cache topology must NOT produce a "no legacy clone" finding; got ' + JSON.stringify(findings));
  rmTmp(home);
  pass('Test i.11 (marketplace-cache topology -> healthy, no drift) [BUG 7]');
} catch (err) { failTest('Test i.11 (marketplace-cache topology -> healthy, no drift) [BUG 7]', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
