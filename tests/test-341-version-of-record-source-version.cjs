#!/usr/bin/env node
'use strict';

/*
 * Phase 341 Plan 05 -- hermetic proof for doctor.cjs's version-of-record-
 * published point, leg (b), via the exported pure helper
 * `evaluateMarketplaceSourcePin(source, ver)`.
 *
 * Leg (c) of the real point makes a real `npm view` network call, so this
 * file does NOT run the whole point. Instead it:
 *   1. Asserts `node scripts/doctor.cjs --acceptance --pre-tag` still passes
 *      (that tier excludes this 'full'-only point entirely, so this proves
 *      nothing regressed elsewhere), run against a fixture home at this
 *      checkout's version (quick 261002-dht), plus a wrong-version negative.
 *   2. Exercises the comparison logic directly through the doctor's own
 *      exported helper against fixture marketplace source objects, so every
 *      branch (npm shape, half-migrated, legacy git shape, neither) is
 *      proved without touching the real marketplace.json or the network.
 *
 * Zero network. Registered in tests/run-all-341.sh.
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const doctor = require(path.join(REPO_ROOT, 'scripts', 'doctor.cjs'));
const evaluateMarketplaceSourcePin = doctor.evaluateMarketplaceSourcePin;

let failures = 0;
let total = 0;

function pass(name) {
  process.stdout.write('PASS: ' + name + '\n');
}
function fail(name, err) {
  failures++;
  process.stdout.write('FAIL: ' + name + '\n');
  if (err) process.stdout.write('  ' + String(err && err.stack ? err.stack : err) + '\n');
}
function run(name, fn) {
  total++;
  try {
    fn();
    pass(name);
  } catch (e) {
    fail(name, e);
  }
}

function assertOk(result, msg) {
  if (!result || result.ok !== true) throw new Error((msg || 'expected ok:true') + ', got: ' + JSON.stringify(result));
}
function assertFail(result, findingSubstr, msg) {
  if (!result || result.ok !== false) throw new Error((msg || 'expected ok:false') + ', got: ' + JSON.stringify(result));
  if (findingSubstr && (!result.finding || result.finding.indexOf(findingSubstr) === -1)) {
    throw new Error((msg || '') + ' expected finding to contain "' + findingSubstr + '", got: ' + JSON.stringify(result));
  }
}

// --------------------- Arm 0: doctor --acceptance --pre-tag still passes ---
//
// Quick 261002-dht (navigator ruling 2026-10-02, fixture-home approach):
// three pre-tag points read the install under $HOME (install-state,
// session-start-active-version, deployment-surfaces). Run with the inherited
// env under HOME=$(mktemp -d), they fail on an empty home that is not the
// thing under test. So Arm 0 builds a minimal fixture home -- a marketplace-
// cache layout whose version dir is a symlink to THIS checkout, at its
// current plugin.json version -- and runs the REAL doctor (no DOCTOR_TEST_MODE,
// no stubbed point) with HOME pointed at it. Every path those three points
// resolve comes from os.homedir()/HOME:
//   install-state                 <home>/.mindrian/install-state.json, the
//                                 6-way version-of-record (installed_plugins
//                                 .json, record, .mindrian-last-version,
//                                 record.path_bin_version), <root>/bin
//   session-start-active-version  <home>/.claude/plugins/installed_plugins.json
//                                 vs the resolved root's plugin.json
//   deployment-surfaces           data/deployment-surfaces.json with $HOME and
//                                 <active_root> expanded
// Fixture shapes mirror tests/test-doctor-acceptance.cjs (makeMarketplaceCache,
// makeInstalledPluginsJson, makeInstallStateRecord). Arm 0b is the negative
// case: a wrong version in installed_plugins.json must fail the real check.

const fs = require('node:fs');
const os = require('node:os');

const CHECKOUT_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')
).version;

function makeFixtureHome(installedVersion) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '341-vor-home-'));
  const pluginsDir = path.join(home, '.claude', 'plugins');
  // Marketplace-cache layout; the version dir IS this checkout (symlink), so
  // the resolver lands on the real plugin.json and the real bin/.
  const verDir = path.join(pluginsDir, 'cache', 'mindrian-marketplace', 'mos', CHECKOUT_VERSION);
  fs.mkdirSync(path.dirname(verDir), { recursive: true });
  fs.symlinkSync(REPO_ROOT, verDir, 'dir');
  fs.writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: {
      'mos@mindrian-marketplace': [
        { scope: 'user', installPath: verDir, version: installedVersion,
          installedAt: '2026-10-02T00:00:00Z', lastUpdated: '2026-10-02T00:00:00Z' },
      ],
    },
  }, null, 2));
  // install-state record (the shape session-start writes).
  fs.mkdirSync(path.join(home, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(home, '.mindrian', 'install-state.json'), JSON.stringify({
    active_version: CHECKOUT_VERSION,
    active_root: verDir,
    topology: 'marketplace-cache',
    resolved_at: '2026-10-02T00:00:00Z',
    surfaces: [],
    installed_plugins_version: CHECKOUT_VERSION,
    statusline_renders_version: CHECKOUT_VERSION,
    last_version_file_value: CHECKOUT_VERSION,
    path_bin_version: CHECKOUT_VERSION,
  }, null, 2));
  // Owned deployment surfaces, as session-start stamps them.
  fs.writeFileSync(path.join(home, '.mindrian-last-version'), CHECKOUT_VERSION + '\n');
  fs.writeFileSync(path.join(home, '.claude', 'statusline-mos'),
    '#!/usr/bin/env bash\n# MINDRIAN-STATUSLINE-DISPATCH\n');
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
    statusLine: { type: 'command', command: 'bash "' + path.join(home, '.claude', 'statusline-mos') + '"' },
  }, null, 2));
  return home;
}

function runPreTag(home) {
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
    MINDRIAN_STATUSLINE_SURFACE: 'CLI',
  });
  // Anything that would bypass the fixture or the real check logic goes.
  delete env.MINDRIAN_OS_ROOT;
  delete env.CLAUDE_DESKTOP;
  delete env.COWORK_SESSION_ID;
  delete env.DOCTOR_TEST_MODE;
  delete env.DOCTOR_TEST_FAIL_POINT;
  const r = spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'doctor.cjs'), '--acceptance', '--pre-tag', '--json'], {
    cwd: REPO_ROOT,
    env: env,
    encoding: 'utf8',
    timeout: 120000,
  });
  let json = null;
  const out = r.stdout || '';
  const start = out.indexOf('{');
  if (start !== -1) { try { json = JSON.parse(out.slice(start)); } catch (_) { /* leave null */ } }
  return { r: r, json: json };
}

function pointById(json, id) {
  const pts = (json && Array.isArray(json.points)) ? json.points : [];
  return pts.find(function (p) { return p.id === id; }) || null;
}

const HOME_POINTS = ['install-state', 'session-start-active-version', 'deployment-surfaces'];

run('Arm 0 (doctor --acceptance --pre-tag exits 0 against a fixture home at the checkout version -- excludes this full-only point)', function () {
  const home = makeFixtureHome(CHECKOUT_VERSION);
  try {
    const res = runPreTag(home);
    if (!res.json) {
      throw new Error('doctor --json output unparseable, exit ' + res.r.status + ':\n' + (res.r.stdout || '').slice(-1000) + (res.r.stderr || '').slice(-500));
    }
    for (const id of HOME_POINTS) {
      const p = pointById(res.json, id);
      if (!p) throw new Error('point ' + id + ' did not run');
      if (p.ok !== true) throw new Error('point ' + id + ' failed against the fixture home: ' + p.finding);
    }
    if (res.r.status !== 0) {
      throw new Error('doctor --acceptance --pre-tag exited ' + res.r.status + ', failed points: ' + JSON.stringify(res.json.failed_points));
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

run('Arm 0b (negative: installed_plugins.json carries a wrong version -> session-start-active-version fails, doctor exits non-zero)', function () {
  const WRONG = '0.0.0-fixture-wrong';
  const home = makeFixtureHome(WRONG);
  try {
    const res = runPreTag(home);
    if (!res.json) {
      throw new Error('doctor --json output unparseable, exit ' + res.r.status + ':\n' + (res.r.stdout || '').slice(-1000) + (res.r.stderr || '').slice(-500));
    }
    const p = pointById(res.json, 'session-start-active-version');
    if (!p) throw new Error('session-start-active-version did not run');
    if (p.ok !== false) throw new Error('expected session-start-active-version ok:false, got ' + JSON.stringify(p));
    const want = 'plugin.json says ' + CHECKOUT_VERSION + ' but installed_plugins.json says ' + WRONG;
    if (p.finding !== want) throw new Error('expected finding "' + want + '", got "' + p.finding + '"');
    if (res.r.status === 0) throw new Error('doctor exited 0 with a wrong installed_plugins.json version');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --------------------- Arm 1: npm-shape fixture, exact match accepted ------

run('Arm 1 (npm shape {source:npm, package:@mindrian_os/cli, version:2.0.0-beta.31} matches ver -> accepted)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'npm', package: '@mindrian_os/cli', version: '2.0.0-beta.31' },
    '2.0.0-beta.31'
  );
  assertOk(result);
});

// --------------------- Arm 2: npm shape with v-prefix -> rejected ----------

run('Arm 2 (npm shape version carries a v prefix -> rejected, v prefix is wrong for npm)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'npm', package: '@mindrian_os/cli', version: 'v2.0.0-beta.31' },
    '2.0.0-beta.31'
  );
  assertFail(result, 'source.version is v2.0.0-beta.31');
});

// --------------------- Arm 3: half-migrated (version + residual ref) -------

run('Arm 3 (correct version but a residual ref also present -> rejected, half-migrated D-01 state)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'npm', package: '@mindrian_os/cli', version: '2.0.0-beta.31', ref: 'v2.0.0-beta.31' },
    '2.0.0-beta.31'
  );
  assertFail(result, 'residual ref/url key');
});

// --------------------- Arm 4: still on the legacy {source:url, ref} shape --

run('Arm 4a (legacy {source:url, ref:v<ver>} shape, matching -> accepted during the transition)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'url', url: 'git' + '-url-placeholder.invalid/mindrian-os-plugin.git', ref: 'v2.0.0-beta.29' },
    '2.0.0-beta.29'
  );
  assertOk(result);
});

run('Arm 4b (legacy {source:url, ref} shape, mismatched ref -> rejected)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'url', url: 'git' + '-url-placeholder.invalid/mindrian-os-plugin.git', ref: 'v9.9.9' },
    '2.0.0-beta.29'
  );
  assertFail(result, 'source.ref is v9.9.9');
});

// --------------------- Arm 5: neither shape (defensive) ---------------------

run('Arm 5 (source object has neither version nor ref -> rejected)', function () {
  const result = evaluateMarketplaceSourcePin({ source: 'url' }, '2.0.0-beta.29');
  assertFail(result, 'neither a version nor a ref key');
});

run('Arm 6 (source is missing entirely -> rejected)', function () {
  const result = evaluateMarketplaceSourcePin(undefined, '2.0.0-beta.29');
  assertFail(result, 'missing or not an object');
});

// ------------------------ Summary ----------------------------------------

process.on('exit', function () {
  process.stdout.write('\n');
  process.stdout.write('Total: ' + total + '  Passed: ' + (total - failures) + '  Failed: ' + failures + '\n');
  if (failures > 0) process.exitCode = 1;
});
