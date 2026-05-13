#!/usr/bin/env node
'use strict';

/*
 * Phase 123 Plan-03 Task 1 -- /mos:doctor class J (deployment-surface
 * manifest reconciliation) hermetic test fixtures.
 *
 * Eight scenarios exercise the new class:
 *   j.1  all 6 surfaces present + correct -> healthy
 *   j.2  statusline-dispatch-shim marker missing -> drift; --fix re-stamps
 *        via session-start
 *   j.3  settings.json statusLine.command wrong (read via path_within_file)
 *        -> drift; --fix rewrites it
 *   j.4  ~/.mindrian-last-version wrong value -> drift; --fix rewrites
 *   j.5  dev-clone-pre-commit-hook on a MARKETPLACE-CACHE box -> SKIPPED
 *        (topology_scope: dev-clone)
 *   j.6  dev-clone-pre-commit-hook on a DEV-CLONE box -> CHECKED
 *   j.7  install-state.json self-entry excluded from its own check
 *        (observed-only, never ok:false)
 *   j.8  plugin-bin-path-entry is observed-only (never stamped)
 *
 * Hermetic envelope mirrors test-doctor-class-i.cjs.
 *
 * Registered in lib/memory/run-feynman-tests.cjs (Phase-123 block) and
 * picked up automatically by tests/run-all.sh's test-*.cjs glob.
 *
 * RED until Phase 123 Plan-03 Task 2 lands class J in doctor.cjs.
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '123-03-j-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function makeMarketplaceCache(home, version) {
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);
  fs.mkdirSync(path.join(cacheDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  fs.mkdirSync(path.join(cacheDir, 'bin'), { recursive: true });
  return cacheDir;
}

function makeInstalledPluginsJson(home, version, installPath) {
  fs.writeFileSync(
    path.join(home, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify({
      version: 2,
      plugins: {
        'mos@mindrian-marketplace': [
          { scope: 'user', installPath, version }
        ]
      }
    }, null, 2)
  );
}

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

// Lay down all 6 owned/observed deployment surfaces healthy on a
// marketplace-cache topology box.
function makeHealthySurfaces(home, mcDir, V) {
  // 1. statusline-dispatch-shim
  fs.writeFileSync(path.join(home, '.claude', 'statusline-mos'),
    '#!/usr/bin/env bash\n# MINDRIAN-STATUSLINE-DISPATCH\nexec bash "' + mcDir + '/scripts/statusline-mos"\n');
  // 2. settings.json statusLine.command (the canonical literal)
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
    statusLine: { type: 'command', command: 'bash "' + path.join(home, '.claude', 'statusline-mos') + '"' }
  }, null, 2));
  // 3. ~/.mindrian-last-version
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), V + '\n');
  // 4. install-state record (self -- already written by makeInstallStateRecord)
  // 5. plugin-bin-path-entry (we just need <active_root>/bin to exist)
  fs.mkdirSync(path.join(mcDir, 'bin'), { recursive: true });
}

function makeDevCloneRoot(home, version) {
  const root = path.join(home, 'MindrianOS-Plugin-dev-clone');
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  fs.writeFileSync(path.join(root, 'install.sh'), '#!/usr/bin/env bash\n');
  fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
  try {
    spawnSync('git', ['-C', root, 'init', '-q'], { encoding: 'utf8' });
    spawnSync('git', ['-C', root, 'config', 'user.email', 'test@example.com'], { encoding: 'utf8' });
    spawnSync('git', ['-C', root, 'config', 'user.name', 'Test'], { encoding: 'utf8' });
  } catch (_) { /* ignore */ }
  return root;
}

function runDoctor(home, extraArgs, extraEnv) {
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

function getSurface(check, id) {
  const surfaces = (check && check.surfaces) || [];
  return surfaces.find(s => s.id === id);
}

// -- j.1: all 6 surfaces healthy -> status healthy -----------------------
try {
  const home = makeTmpHome('j1');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, { active_root: mcDir, active_version: V });
  makeHealthySurfaces(home, mcDir, V);
  const { report } = runDoctor(home, ['--install-state']);
  const c = report.checks['deployment-surfaces'];
  assert.ok(c, 'deployment-surfaces check present');
  assert.strictEqual(c.status, 'healthy', 'expected healthy; got ' + c.status);
  // Sanity: assert each owned surface is ok:true.
  for (const id of ['statusline-dispatch-shim', 'settings-statusline-command', 'mindrian-last-version']) {
    const s = getSurface(c, id);
    assert.ok(s, 'surface ' + id + ' present');
    assert.notStrictEqual(s.ok, false, 'surface ' + id + ' must not be ok:false on a healthy fixture; got ok=' + s.ok);
  }
  rmTmp(home);
  pass('Test j.1 (all surfaces healthy)');
} catch (err) { failTest('Test j.1 (all surfaces healthy)', err); }

// -- j.2: statusline-dispatch-shim marker missing -> drift + fix --------
try {
  const home = makeTmpHome('j2');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, { active_root: mcDir, active_version: V });
  makeHealthySurfaces(home, mcDir, V);
  // Replace the shim with one MISSING the marker.
  fs.writeFileSync(path.join(home, '.claude', 'statusline-mos'),
    '#!/usr/bin/env bash\n# no marker here\necho hi\n');
  let { report } = runDoctor(home, ['--install-state']);
  let c = report.checks['deployment-surfaces'];
  assert.strictEqual(c.status, 'warn', 'expected warn; got ' + c.status);
  const sBefore = getSurface(c, 'statusline-dispatch-shim');
  assert.strictEqual(sBefore.ok, false, 'statusline-dispatch-shim flagged');
  // --fix re-stamps the shim. Spawning session-start in the hermetic harness
  // re-writes the shim with the marker. We confirm by checking the file.
  ({ report } = runDoctor(home, ['--install-state', '--fix']));
  const shimAfter = fs.readFileSync(path.join(home, '.claude', 'statusline-mos'), 'utf8');
  assert.match(shimAfter, /MINDRIAN-STATUSLINE-DISPATCH/, '--fix re-stamped the marker into the shim');
  rmTmp(home);
  pass('Test j.2 (missing dispatch marker -> drift + --fix re-stamps)');
} catch (err) { failTest('Test j.2 (missing dispatch marker -> drift + --fix re-stamps)', err); }

// -- j.3: settings.json statusLine.command wrong -> drift + fix ---------
// This is the live-dev-box bug. The surface entry expects a value at the
// JSON path `statusLine.command`; doctor must EXTRACT that field, not
// compare the whole file. Plan-03 adds `path_within_file` to the manifest.
try {
  const home = makeTmpHome('j3');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, { active_root: mcDir, active_version: V });
  makeHealthySurfaces(home, mcDir, V);
  // Now mutate settings.json so .statusLine.command is wrong.
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
    statusLine: { type: 'command', command: 'echo wrong' }
  }, null, 2));
  let { report } = runDoctor(home, ['--install-state']);
  let c = report.checks['deployment-surfaces'];
  const sBefore = getSurface(c, 'settings-statusline-command');
  assert.ok(sBefore, 'settings-statusline-command surface present');
  assert.strictEqual(sBefore.ok, false, 'settings-statusline-command flagged (extracted via path_within_file)');
  ({ report } = runDoctor(home, ['--install-state', '--fix']));
  // After --fix the JSON file's statusLine.command must be the canonical literal.
  const after = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
  assert.ok(after && after.statusLine && after.statusLine.command, 'settings.statusLine.command present after fix');
  assert.match(after.statusLine.command, /statusline-mos/, '--fix rewrote statusLine.command to point at statusline-mos');
  rmTmp(home);
  pass('Test j.3 (wrong settings.json statusLine.command -> drift + --fix rewrites)');
} catch (err) { failTest('Test j.3 (wrong settings.json statusLine.command -> drift + --fix rewrites)', err); }

// -- j.4: ~/.mindrian-last-version wrong -> drift + fix ------------------
try {
  const home = makeTmpHome('j4');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, { active_root: mcDir, active_version: V });
  makeHealthySurfaces(home, mcDir, V);
  // Stale LV.
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), '0.0.0-stale\n');
  let { report } = runDoctor(home, ['--install-state']);
  let c = report.checks['deployment-surfaces'];
  const sBefore = getSurface(c, 'mindrian-last-version');
  assert.strictEqual(sBefore.ok, false, 'mindrian-last-version flagged');
  ({ report } = runDoctor(home, ['--install-state', '--fix']));
  const lvAfter = fs.readFileSync(path.join(home, '.mindrian-last-version'), 'utf8').trim();
  assert.strictEqual(lvAfter, V, '--fix rewrote ~/.mindrian-last-version to active_version');
  rmTmp(home);
  pass('Test j.4 (wrong LV -> drift + --fix rewrites)');
} catch (err) { failTest('Test j.4 (wrong LV -> drift + --fix rewrites)', err); }

// -- j.5: dev-clone surface SKIPPED on marketplace-cache box -----------
try {
  const home = makeTmpHome('j5');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, { active_root: mcDir, active_version: V, topology: 'marketplace-cache' });
  makeHealthySurfaces(home, mcDir, V);
  const { report } = runDoctor(home, ['--install-state']);
  const c = report.checks['deployment-surfaces'];
  const s = getSurface(c, 'dev-clone-pre-commit-hook');
  if (s) {
    // Either status='skipped' or ok=null with 'skipped' marker
    const skippedShape = s.status === 'skipped' || /skip/i.test((s.reason || '') + ' ' + (s.observed || ''));
    assert.ok(skippedShape, 'dev-clone surface on user box -> skipped marker; got ' + JSON.stringify(s));
    // Critically: it must NOT be flagged as ok:false (since it's not a surface
    // on a user box at all).
    assert.notStrictEqual(s.ok, false, 'dev-clone surface on user box: ok must NOT be false; got ok=' + s.ok);
  }
  // (If the doctor omits the surface entirely from the array, that's also
  // acceptable per the plan's wording.)
  rmTmp(home);
  pass('Test j.5 (dev-clone surface skipped on marketplace-cache box)');
} catch (err) { failTest('Test j.5 (dev-clone surface skipped on marketplace-cache box)', err); }

// -- j.6: dev-clone surface CHECKED on dev-clone box -------------------
try {
  const home = makeTmpHome('j6');
  const V = '1.13.0-beta.13';
  const devRoot = makeDevCloneRoot(home, V);
  makeInstalledPluginsJson(home, V, devRoot);
  makeInstallStateRecord(home, { active_root: devRoot, active_version: V, topology: 'dev-clone' });
  makeHealthySurfaces(home, devRoot, V);
  const { report } = runDoctor(home, ['--install-state'], { MINDRIAN_OS_ROOT: devRoot });
  const c = report.checks['deployment-surfaces'];
  const s = getSurface(c, 'dev-clone-pre-commit-hook');
  // On a dev-clone box the surface MUST be present in the check and NOT
  // marked skipped. (Whether it is ok:false here depends on whether the
  // hook is installed -- in this hermetic fixture it isn't, so ok:false is
  // the right shape.)
  assert.ok(s, 'dev-clone-pre-commit-hook surface present on dev-clone box');
  assert.notStrictEqual(s.status, 'skipped', 'surface NOT skipped on dev-clone box');
  rmTmp(home);
  pass('Test j.6 (dev-clone surface checked on dev-clone box)');
} catch (err) { failTest('Test j.6 (dev-clone surface checked on dev-clone box)', err); }

// -- j.7: install-state.json self-entry excluded from its own check ----
try {
  const home = makeTmpHome('j7');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, { active_root: mcDir, active_version: V });
  makeHealthySurfaces(home, mcDir, V);
  const { report } = runDoctor(home, ['--install-state']);
  const c = report.checks['deployment-surfaces'];
  const s = getSurface(c, 'install-state-record');
  assert.ok(s, 'install-state-record surface present');
  // observed-only -> ok is null (never false). The walker excludes it from
  // its own consistency check.
  assert.notStrictEqual(s.ok, false, 'install-state-record self-entry never ok:false');
  rmTmp(home);
  pass('Test j.7 (install-state-record self-entry excluded from own check)');
} catch (err) { failTest('Test j.7 (install-state-record self-entry excluded from own check)', err); }

// -- j.8: plugin-bin-path-entry observed-only -- never stamped --------
try {
  const home = makeTmpHome('j8');
  const V = '1.13.0-beta.13';
  const mcDir = makeMarketplaceCache(home, V);
  makeInstalledPluginsJson(home, V, mcDir);
  makeInstallStateRecord(home, { active_root: mcDir, active_version: V });
  makeHealthySurfaces(home, mcDir, V);
  // Remove the bin dir to simulate a vanished PATH entry.
  fs.rmSync(path.join(mcDir, 'bin'), { recursive: true, force: true });
  const { report } = runDoctor(home, ['--install-state', '--fix']);
  // After --fix the bin dir must NOT have been re-created by doctor.
  assert.strictEqual(fs.existsSync(path.join(mcDir, 'bin')), false,
    'doctor --fix must NOT stamp the plugin-bin-path-entry (observed-only, owner: claude-code)');
  // The surface result for plugin-bin-path-entry must report observed=absent,
  // ok=null (not ok:false).
  const c = report.checks['deployment-surfaces'];
  const s = getSurface(c, 'plugin-bin-path-entry');
  if (s) {
    assert.notStrictEqual(s.ok, false, 'plugin-bin-path-entry must be observed-only (ok:null); got ok=' + s.ok);
  }
  rmTmp(home);
  pass('Test j.8 (plugin-bin-path-entry observed-only -- never stamped)');
} catch (err) { failTest('Test j.8 (plugin-bin-path-entry observed-only -- never stamped)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
