#!/usr/bin/env node
'use strict';

/*
 * Phase 127.2 Plan 04 Instance #7 (post-update silent activation gap):
 * test-mos-update-activation-gap.cjs
 *
 * Verifies the full activation lifecycle end-to-end:
 *   1. activatePostUpdate against a fresh staging dir atomically swaps the
 *      live install and writes the touch-file.
 *   2. activatePostUpdate is idempotent: re-running when live == staging
 *      returns {swapped: false, message: 'already on latest...'}.
 *   3. sessionstart-post-update-preflight.cjs:
 *      a) emits an empty envelope (exit 0) when no touch-file is present;
 *      b) emits an empty envelope (exit 0) when the touch-file is present
 *         BUT the wire probe is inconclusive (no live Brain MCP server in
 *         the test environment) -- "never block on uncertainty" per the
 *         preflight's defensive contract.
 *
 * This test is intentionally hermetic: it builds a synthetic plugin
 * structure under a tmp MINDRIAN_PLUGIN_HOME so the real ~/.claude/plugins
 * is not touched. The atomic-swap path runs the real doctor.cjs --fix
 * pipeline (Phase 95.2) against the synthetic tree.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ACTIVATOR = require(path.join(REPO_ROOT, 'scripts', 'post-update-activation.cjs'));
const PREFLIGHT_SCRIPT = path.join(REPO_ROOT, 'scripts', 'sessionstart-post-update-preflight.cjs');

let pass = 0;
let fail = 0;
function assert(label, cond, detail) {
  if (cond) {
    pass++;
    console.log('PASS ' + label);
  } else {
    fail++;
    console.log('FAIL ' + label + (detail ? ' -- ' + detail : ''));
  }
}

function makeSyntheticPluginTree(rootDir, version) {
  const cachePluginDir = path.join(rootDir, 'cache', 'mindrian-marketplace', 'mos', version);
  fs.mkdirSync(path.join(cachePluginDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cachePluginDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version: version }, null, 2)
  );
  // Minimal payload (just enough that the recovery cp pipeline copies a
  // non-empty tree -- doctor.cjs verifies version-match post-copy).
  fs.writeFileSync(path.join(cachePluginDir, 'README.md'), '# synthetic ' + version);
  return cachePluginDir;
}

function makeSyntheticLiveInstall(rootDir, version) {
  const liveDir = path.join(rootDir, 'mindrian-os');
  fs.mkdirSync(path.join(liveDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(liveDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version: version }, null, 2)
  );
  return liveDir;
}

// -- Test 1: cold activation (live=oldV, staging=newV) -> atomic swap. ----

async function testColdActivation() {
  const ts = Date.now();
  const tmpHome = path.join(os.tmpdir(), 'mos-test-activation-' + ts + '-' + Math.floor(Math.random() * 1e6));
  const tmpMindrian = path.join(tmpHome, '.mindrian');
  fs.mkdirSync(tmpHome, { recursive: true });
  try {
    // Synthesize live install at beta.N + cache-staging at beta.N+1.
    const OLD_VERSION = '1.13.0-beta.30';
    const NEW_VERSION = '1.13.0-beta.31';
    makeSyntheticLiveInstall(tmpHome, OLD_VERSION);
    // Cache must contain BOTH old + new (doctor sorts and picks latest).
    makeSyntheticPluginTree(tmpHome, OLD_VERSION);
    makeSyntheticPluginTree(tmpHome, NEW_VERSION);

    const result = await ACTIVATOR.activatePostUpdate({
      pluginHome: tmpHome,
      mindrianDir: tmpMindrian,
    });

    assert('cold: result.ok === true', result.ok === true, JSON.stringify(result));
    assert('cold: result.swapped === true', result.swapped === true);
    assert('cold: result.oldVersion is the old', result.oldVersion === OLD_VERSION, 'got ' + result.oldVersion);
    assert('cold: result.newVersion is the new', result.newVersion === NEW_VERSION, 'got ' + result.newVersion);
    assert('cold: backupPath present + plausible', typeof result.backupPath === 'string' && result.backupPath.length > 0);

    // Live install should now report the new version.
    const liveAfter = JSON.parse(fs.readFileSync(path.join(tmpHome, 'mindrian-os', '.claude-plugin', 'plugin.json'), 'utf8'));
    assert('cold: live plugin.json bumped to new version', liveAfter.version === NEW_VERSION, 'got ' + liveAfter.version);

    // Stale backup at .stale-OLD-...
    const stale = fs.readdirSync(tmpHome).filter(function (n) { return n.indexOf('mindrian-os.stale-' + OLD_VERSION + '-') === 0; });
    assert('cold: stale backup dir created with old-version tag', stale.length === 1, 'stale dirs: ' + JSON.stringify(stale));

    // Touch-file written with new version content.
    const touchFile = path.join(tmpMindrian, 'post-update-restart-pending');
    assert('cold: touch-file exists', fs.existsSync(touchFile));
    const touchContents = fs.readFileSync(touchFile, 'utf8').trim();
    assert('cold: touch-file contains new version', touchContents === NEW_VERSION, 'got ' + touchContents);
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
}

// -- Test 2: idempotent (live == staging) -> no swap, no touch-file. ------

async function testIdempotent() {
  const ts = Date.now();
  const tmpHome = path.join(os.tmpdir(), 'mos-test-activation-idemp-' + ts + '-' + Math.floor(Math.random() * 1e6));
  const tmpMindrian = path.join(tmpHome, '.mindrian');
  fs.mkdirSync(tmpHome, { recursive: true });
  try {
    const VERSION = '1.13.0-beta.31';
    makeSyntheticLiveInstall(tmpHome, VERSION);
    makeSyntheticPluginTree(tmpHome, VERSION);

    const result = await ACTIVATOR.activatePostUpdate({
      pluginHome: tmpHome,
      mindrianDir: tmpMindrian,
    });

    assert('idemp: result.ok === true', result.ok === true, JSON.stringify(result));
    assert('idemp: result.swapped === false', result.swapped === false);
    assert('idemp: message says "already on latest"', /already on latest/.test(result.message || ''), result.message);

    // Touch-file should NOT have been created.
    const touchFile = path.join(tmpMindrian, 'post-update-restart-pending');
    assert('idemp: touch-file NOT created', !fs.existsSync(touchFile));
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
}

// -- Test 3: preflight hook silent paths (no touch-file, inconclusive). ---

function testPreflightSilentNoTouchFile() {
  const ts = Date.now();
  const tmpHome = path.join(os.tmpdir(), 'mos-test-preflight-silent-' + ts);
  fs.mkdirSync(tmpHome, { recursive: true });
  try {
    // No touch-file at HOME/.mindrian -> preflight exits 0 silently with
    // the canonical {"continue":true} envelope.
    const r = spawnSync('node', [PREFLIGHT_SCRIPT], {
      encoding: 'utf8',
      timeout: 5000,
      env: Object.assign({}, process.env, { HOME: tmpHome, USERPROFILE: tmpHome }),
    });
    assert('preflight: exit 0 when no touch-file', r.status === 0, 'status=' + r.status + ' stderr=' + (r.stderr || ''));
    let envelope = null;
    try { envelope = JSON.parse(r.stdout); } catch (_) { envelope = null; }
    assert('preflight: emits {"continue":true} envelope', envelope && envelope.continue === true, 'stdout=' + r.stdout);
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
}

function testPreflightInconclusiveProbe() {
  const ts = Date.now();
  const tmpHome = path.join(os.tmpdir(), 'mos-test-preflight-incon-' + ts);
  const tmpMindrian = path.join(tmpHome, '.mindrian');
  fs.mkdirSync(tmpMindrian, { recursive: true });
  fs.writeFileSync(path.join(tmpMindrian, 'post-update-restart-pending'), '1.13.0-beta.99\n');
  try {
    // Touch-file present. The probe will spawn doctor --brain-smoke which
    // (in this hermetic env, MINDRIAN_BRAIN_API_KEY likely unset and
    // network potentially blocked) returns inconclusive. Preflight MUST
    // exit 0 + emit empty envelope rather than block on uncertainty.
    const env = Object.assign({}, process.env, {
      HOME: tmpHome,
      USERPROFILE: tmpHome,
      MINDRIAN_NO_NETWORK: '1',
    });
    // Remove anything that might make brain-smoke succeed in the test env
    // (test should be inconclusive about wire-version):
    delete env.MINDRIAN_BRAIN_API_KEY;
    const r = spawnSync('node', [PREFLIGHT_SCRIPT], {
      encoding: 'utf8',
      timeout: 15000,
      env: env,
    });
    // Acceptable outcomes:
    //   - exit 0 (probe inconclusive OR probe succeeded with version match
    //     -- both safe paths)
    //   - exit 1 (real drift detected) -- only possible if a live MCP
    //     server happened to be reachable with a different version
    // For a hermetic test, exit 0 is the canonical outcome.
    const acceptableExits = [0];
    assert('preflight (inconclusive): exit in {0}', acceptableExits.indexOf(r.status) !== -1,
      'status=' + r.status + ' stderr=' + (r.stderr || '').slice(0, 400));
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
}

// -- Test 4: module exports surface contract (Plan must_haves). -----------

function testModuleExportsSurface() {
  assert('exports: activatePostUpdate is a function', typeof ACTIVATOR.activatePostUpdate === 'function');
  assert('exports: POST_UPDATE_TOUCH_FILE is a string', typeof ACTIVATOR.POST_UPDATE_TOUCH_FILE === 'string');
  assert('exports: POST_UPDATE_TOUCH_FILE ends in /post-update-restart-pending',
    /post-update-restart-pending$/.test(ACTIVATOR.POST_UPDATE_TOUCH_FILE));
}

// -- Driver ---------------------------------------------------------------

(async function main() {
  try {
    await testColdActivation();
    await testIdempotent();
    testPreflightSilentNoTouchFile();
    testPreflightInconclusiveProbe();
    testModuleExportsSurface();
  } catch (e) {
    console.error('test runner threw: ' + e.message);
    console.error(e.stack);
    fail++;
  }
  console.log('');
  console.log('====================================');
  console.log('test-mos-update-activation-gap: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ', ' + fail + ' FAIL' : ''));
  console.log('====================================');
  process.exit(fail === 0 ? 0 : 1);
}());
