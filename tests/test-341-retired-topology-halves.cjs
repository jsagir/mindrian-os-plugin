#!/usr/bin/env node
'use strict';

/*
 * Phase 341 plan 10 (D-13 step 5): tripwire for the legacy-topology halves of
 * doctor classes I and J.
 *
 * WHAT THIS FREEZES, in one sentence: the audit of plan 341-10 found that the
 * legacy halves of class I are STILL REACHABLE, so they were KEPT, and this
 * file fails if a later cleanup removes them before the reach is gone.
 *
 * The plan asked to retire the `legacy` topology value, the F11 legacy-config-pin
 * finding and the legacy-clone migration-candidate branch. The plan also said to
 * retire a half only when its failure mode cannot happen. The audit (temp HOMEs
 * only, no real home touched) found:
 *
 *   - `legacy` topology: lib/core/active-plugin-root.cjs still resolves a
 *     ~/.claude/plugins/mindrian-os directory and classifies it `legacy`. A
 *     machine that ran the old shell installer has that directory. Arm 11
 *     produces the value through the doctor engine.
 *   - legacy clone alongside a marketplace cache: this finding is the ONLY path
 *     from the doctor to scripts/migrate-legacy-install-location.cjs. If it went,
 *     the migrator would have no caller and a user would never be told. Arm 12.
 *   - F11 legacy-config-pin: ~/.claude/plugins/config.json is a file of the
 *     platform's own v1 plugin system, not of the retired installer. The retired
 *     installer never wrote it (install.sh at the commit before its deletion has
 *     no reference to it). The proof the plan demands does not hold, so the
 *     finding stays. Arm 6.
 *   - checkInstallVersion legacy fall-through: the engine reads the running
 *     version through it, and on a legacy-only machine that fall-through is the
 *     only answer. Arm 8.
 *
 * What IS true today, and is also frozen (retired arms): class J has no legacy
 * branch and no surface carries topology_scope legacy.
 *
 * To retire a kept half later: first remove its producer (the resolver's
 * fromLegacyClone for the value, the platform's config.json for F11), then
 * change the matching arm in the same commit.
 *
 * Arms (each prints its own ok or FAIL line):
 *
 *   RETIRED (already true)
 *   1   data/deployment-surfaces.json parses and no surface has topology_scope legacy.
 *   2   the class J module carries no legacy topology value.
 *   3   the registry still holds class I and class J, both fix_supported, 29 entries.
 *
 *   KEPT (reachable, so not retired)
 *   4   the class I module still classifies legacy and still names the
 *       migration-candidate finding.
 *   5   the class I --fix still delegates to the teardown migrator.
 *   6   shared.cjs still exports readLegacyConfigPin and reads the platform's
 *       config.json (F11 stays).
 *   7   dev-clone is live in both modules; at least one surface is dev-clone scoped.
 *   8   shared.cjs still exports INSTALL_DIR and checkInstallVersion, and the
 *       fall-through reads a legacy-only machine (behavioral).
 *   9   classes I and J exist, export check, stay registered with fix_supported true.
 *   10  the teardown migrator exists and exports scanLegacyReferences and migrate.
 *
 *   BEHAVIORAL (temp HOME, no network, no paid command)
 *   11  legacy-only machine: doctor --install-state --json exits 0, topology legacy.
 *   12  legacy directory beside a marketplace cache: a recoverable topology
 *       finding names the migration candidate.
 *   13  empty machine: topology not-found; MINDRIAN_OS_ROOT at this repo: dev-clone.
 *   14  the migrator CLI runs with --dry-run --json and exits 0.
 *   15  dash scan.
 *
 * Dash scan uses String.fromCharCode. Zero network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');
const MIGRATOR = path.join(REPO, 'scripts', 'migrate-legacy-install-location.cjs');

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  try {
    fn();
    PASS += 1;
    console.log('ok   ' + name);
  } catch (err) {
    FAIL += 1;
    console.log('FAIL ' + name + '\n     ' + String(err && err.message ? err.message : err).split('\n').join('\n     '));
  }
}

function read(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(REPO, rel)); }

const registryRaw = JSON.parse(read('data/doctor-modules.json'));
const modules = Array.isArray(registryRaw) ? registryRaw : registryRaw.modules;
const surfacesRaw = JSON.parse(read('data/deployment-surfaces.json'));
const surfaces = Array.isArray(surfacesRaw) ? surfacesRaw : surfacesRaw.surfaces;

// ---------------------------------------------------------------- RETIRED
arm('1 no deployment surface is scoped to the legacy topology', () => {
  assert.ok(Array.isArray(surfaces), 'surfaces is an array');
  const bad = surfaces.filter((s) => s.topology_scope === 'legacy').map((s) => s.id || s.name || '?');
  assert.deepStrictEqual(bad, [], 'legacy scoped surfaces: ' + bad.join(', '));
});

arm('2 the class J module carries no legacy topology value', () => {
  const src = read('lib/core/doctor/deployment-surfaces-module.cjs');
  assert.ok(!/['"]legacy['"]/.test(src), 'class J names a quoted legacy value');
});

arm('3 the registry entries for class I and class J exist and are fix_supported', () => {
  assert.ok(Array.isArray(modules), 'registry modules is an array');
  assert.strictEqual(modules.length, 29, 'parsed registry count must be 29 (set by plan 341-09); got ' + modules.length);
  for (const id of ['install-state', 'deployment-surfaces']) {
    const row = modules.find((m) => m.id === id);
    assert.ok(row, id + ' missing from the registry');
    assert.strictEqual(row.fix_supported, true, id + ' must stay fix_supported true');
  }
});

// ------------------------------------------------------------------- KEPT
arm('4 class I still classifies legacy and still names the migration candidate', () => {
  const src = read('lib/core/doctor/install-state-module.cjs');
  assert.ok(/topology === 'legacy'/.test(src), 'the legacy topology branch was removed');
  assert.ok(/migration candidate/.test(src), 'the migration-candidate finding was removed');
});

arm('5 class I --fix still delegates to the teardown migrator', () => {
  const src = read('lib/core/doctor/install-state-module.cjs');
  assert.ok(src.includes('migrate-legacy-install-location'), 'the --fix no longer spawns the migrator');
});

arm('6 shared.cjs still exports readLegacyConfigPin and reads the platform config.json', () => {
  const shared = require(path.join(REPO, 'lib', 'core', 'doctor', 'shared.cjs'));
  assert.strictEqual(typeof shared.readLegacyConfigPin, 'function', 'readLegacyConfigPin removed');
  assert.strictEqual(typeof shared.resolveLegacyConfigPinEntry, 'function', 'resolveLegacyConfigPinEntry removed');
  const src = read('lib/core/doctor/shared.cjs');
  assert.ok(/'plugins', 'config\.json'/.test(src), 'the reader no longer targets plugins/config.json');
});

arm('7 dev-clone is live in both modules and at least one surface is dev-clone scoped', () => {
  assert.ok(read('lib/core/doctor/install-state-module.cjs').includes('dev-clone'), 'class I lost dev-clone');
  assert.ok(read('lib/core/doctor/deployment-surfaces-module.cjs').includes('dev-clone'), 'class J lost dev-clone');
  const n = surfaces.filter((s) => s.topology_scope === 'dev-clone').length;
  assert.ok(n > 0, 'no dev-clone scoped surface remains');
});

// ------------------------------------------------------------- BEHAVIORAL
function makeHome(tag) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-10-' + tag + '-'));
  fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(home, 'rooms'), { recursive: true });
  return home;
}
function rm(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
function envFor(home, extra) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_ROOMS_HOME: path.join(home, 'rooms'),
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
    MINDRIAN_STATUSLINE_SURFACE: 'CLI',
  }, extra || {});
  delete env.CLAUDE_DESKTOP;
  delete env.CLAUDE_PLUGIN_ROOT;
  if (!extra || extra.MINDRIAN_OS_ROOT === undefined) delete env.MINDRIAN_OS_ROOT;
  return env;
}
function writePlugin(dir, version) {
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos', version }, null, 2));
}
function repoVersion() { return JSON.parse(read('.claude-plugin/plugin.json')).version; }
function installState(home, extraEnv) {
  const r = spawnSync(process.execPath, [DOCTOR, '--install-state', '--json'], { env: envFor(home, extraEnv), encoding: 'utf8', timeout: 60000 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_) { /* leave null */ }
  const row = report && report.checks ? report.checks['install-state'] : null;
  return { r, report, row };
}

arm('8 checkInstallVersion fall-through reads a legacy-only machine', () => {
  const shared = require(path.join(REPO, 'lib', 'core', 'doctor', 'shared.cjs'));
  assert.strictEqual(typeof shared.INSTALL_DIR, 'string', 'INSTALL_DIR removed');
  assert.strictEqual(typeof shared.checkInstallVersion, 'function', 'checkInstallVersion removed');
  const home = makeHome('a8');
  try {
    writePlugin(path.join(home, '.claude', 'plugins', 'mindrian-os'), '9.9.9');
    const code = "const s=require(" + JSON.stringify(path.join(REPO, 'lib', 'core', 'doctor', 'shared.cjs')) + ");"
      + "const r=s.checkInstallVersion();process.stdout.write(JSON.stringify({status:r.status,version:r.version}));";
    const r = spawnSync(process.execPath, ['-e', code], { env: envFor(home), encoding: 'utf8', timeout: 30000 });
    assert.strictEqual(r.status, 0, 'child exit ' + r.status + ' ' + String(r.stderr).slice(0, 200));
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.status, 'ok', 'fall-through status ' + out.status);
    assert.strictEqual(out.version, '9.9.9', 'fall-through version ' + out.version);
  } finally { rm(home); }
});

arm('9 classes I and J exist, export check, stay registered', () => {
  for (const file of ['install-state-module.cjs', 'deployment-surfaces-module.cjs']) {
    const p = path.join(REPO, 'lib', 'core', 'doctor', file);
    assert.ok(fs.existsSync(p), file + ' missing');
    assert.strictEqual(typeof require(p).check, 'function', file + ' must export check');
  }
});

arm('10 the teardown migrator exists and exports scanLegacyReferences and migrate', () => {
  assert.ok(fs.existsSync(MIGRATOR), 'migrator missing');
  const m = require(MIGRATOR);
  assert.strictEqual(typeof m.scanLegacyReferences, 'function', 'scanLegacyReferences missing');
  assert.strictEqual(typeof m.migrate, 'function', 'migrate missing');
});

arm('11 a legacy-only machine reports topology legacy through the doctor engine', () => {
  const home = makeHome('a11');
  try {
    // The version must be recent: the engine defers diagnostics newer than the
    // running version, and returns no checks at all for a very old fixture.
    writePlugin(path.join(home, '.claude', 'plugins', 'mindrian-os'), repoVersion());
    const { r, row } = installState(home);
    assert.strictEqual(r.status, 0, 'exit ' + r.status + ' ' + String(r.stderr).slice(0, 200));
    assert.ok(row, 'no install-state row in the report');
    assert.strictEqual(row.topology, 'legacy', 'topology ' + row.topology);
  } finally { rm(home); }
});

arm('12 a legacy directory beside a marketplace cache yields a recoverable migration candidate', () => {
  const home = makeHome('a12');
  try {
    const plugins = path.join(home, '.claude', 'plugins');
    const v = repoVersion();
    writePlugin(path.join(plugins, 'mindrian-os'), v);
    writePlugin(path.join(plugins, 'cache', 'mindrian-marketplace', 'mos', v), v);
    const { r, row } = installState(home);
    assert.strictEqual(r.status, 0, 'exit ' + r.status);
    assert.ok(row, 'no install-state row');
    assert.strictEqual(row.topology, 'marketplace-cache', 'topology ' + row.topology);
    const f = (row.findings || []).find((x) => x.id === 'topology');
    assert.ok(f, 'no topology finding');
    assert.strictEqual(f.recoverable, true, 'finding must be recoverable');
    assert.ok(/migration candidate/.test(f.finding), 'finding text: ' + f.finding);
  } finally { rm(home); }
});

arm('13 an empty machine reports not-found and a pinned dev root reports dev-clone', () => {
  const home = makeHome('a13');
  try {
    const empty = installState(home);
    assert.ok(empty.row, 'no install-state row on the empty machine');
    assert.strictEqual(empty.row.topology, 'not-found', 'empty topology ' + empty.row.topology);
    const dev = installState(home, { MINDRIAN_OS_ROOT: REPO });
    assert.ok(dev.row, 'no install-state row for the dev root');
    assert.strictEqual(dev.row.topology, 'dev-clone', 'dev topology ' + dev.row.topology);
    const allowed = ['marketplace-cache', 'dev-clone', 'legacy', 'not-found'];
    assert.ok(allowed.includes(empty.row.topology) && allowed.includes(dev.row.topology), 'value outside the vocabulary');
  } finally { rm(home); }
});

arm('14 the migrator CLI dry run exits 0 on a temp home', () => {
  const home = makeHome('a14');
  try {
    const r = spawnSync(process.execPath, [MIGRATOR, '--dry-run', '--json'], { env: envFor(home), encoding: 'utf8', timeout: 30000 });
    assert.strictEqual(r.status, 0, 'exit ' + r.status + ' ' + String(r.stderr).slice(0, 200));
    assert.ok(/already-clean/.test(r.stdout), 'expected already-clean, got: ' + String(r.stdout).slice(0, 200));
  } finally { rm(home); }
});

arm('15 this file carries no em-dash or en-dash', () => {
  const dashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
  const txt = read('tests/test-341-retired-topology-halves.cjs');
  const bad = dashes.filter((d) => txt.includes(d)).map((d) => 'U+' + d.charCodeAt(0).toString(16));
  assert.deepStrictEqual(bad, [], bad.join('; '));
});

console.log('\nPASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
