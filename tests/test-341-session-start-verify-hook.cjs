#!/usr/bin/env node
'use strict';
/*
 * tests/test-341-session-start-verify-hook.cjs
 *
 * Phase 341 plan 08 Task 5 (D-07a a, b). Pins the converted SessionStart hook
 * scripts/sessionstart-post-update-preflight.cjs: the version-change trigger, the
 * bounded offline verification, the three honest result states, the F8 cue that
 * survives, and the contract that the hook NEVER blocks.
 *
 * Hermetic. Every child runs with a temp HOME and a temp MOS_SESSION_VERIFY_HOME.
 * CLAUDE_PLUGIN_ROOT points at a temp plugin root carrying a STUB doctor.cjs for
 * the deterministic arms; one arm drives the REAL doctor tier end to end through
 * its test-mode failure injection. The detached probe is switched off with
 * MOS_SESSION_VERIFY_NO_PROBE=1 so `wire` stays pending for assertion. Zero network.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HOOK = path.join(REPO, 'scripts', 'sessionstart-post-update-preflight.cjs');

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  try { fn(); PASS += 1; console.log('PASS: ' + name); }
  catch (e) { FAIL += 1; console.log('FAIL: ' + name + '\n  ' + (e && e.message ? e.message : e)); }
}
function must(cond, label) { if (!cond) throw new Error(label || 'assertion failed'); }

const tmpRoots = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpRoots.push(d);
  return d;
}

function makeHome(registeredVersion) {
  const home = mk('mos-341-hook-home-');
  const dir = path.join(home, '.claude', 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: { 'mos@mindrian-marketplace': [{ scope: 'user', installPath: '/x/mos/' + registeredVersion, version: registeredVersion }] },
  }), 'utf8');
  return home;
}

function seedMarker(home, obj) {
  const d = path.join(home, '.mindrian', 'session-verify');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'state.json'), JSON.stringify(obj), 'utf8');
}
function readMarker(home) {
  try { return JSON.parse(fs.readFileSync(path.join(home, '.mindrian', 'session-verify', 'state.json'), 'utf8')); } catch (_e) { return null; }
}

// A temp plugin root: plugin.json at the registered version, and an optional stub doctor.
function makeRoot(version, doctorBody) {
  const root = mk('mos-341-hook-root-');
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos', version: version }), 'utf8');
  if (doctorBody !== null && doctorBody !== undefined) {
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'scripts', 'doctor.cjs'), doctorBody, 'utf8');
  }
  return root;
}

function stubDoctor(payload, exitCode) {
  return "process.stdout.write(" + JSON.stringify(JSON.stringify(payload)) + "); process.exit(" + exitCode + ");\n";
}
const PASS_PAYLOAD = {
  mode: 'session-start', failed_points: [], summary: { total: 4, passed: 4, failed: 0, duration_ms: 12 },
  points: [{ id: 'a', ok: true }, { id: 'b', ok: true }, { id: 'c', ok: true }, { id: 'd', ok: true }],
};
const FAIL_PAYLOAD = {
  mode: 'session-start', failed_points: ['install-state'], summary: { total: 4, passed: 3, failed: 1, duration_ms: 12 },
  points: [{ id: 'install-state', ok: false }, { id: 'b', ok: true }, { id: 'c', ok: true }, { id: 'd', ok: true }],
};

function runHook(home, root, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: home, USERPROFILE: home, MOS_SESSION_VERIFY_HOME: home,
    MOS_SESSION_VERIFY_NO_PROBE: '1', MOS_NO_COLOR: '1', CLAUDE_PLUGIN_ROOT: root,
  }, extraEnv || {});
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [HOOK], { env: env, encoding: 'utf8', timeout: 30000, input: '' });
  let json = null;
  try { json = JSON.parse((r.stdout || '').trim()); } catch (_e) { json = null; }
  return { status: r.status, json: json, ms: Date.now() - t0, stdout: r.stdout };
}
function neverBlocks(r, label) {
  must(r.status === 0, label + ': exit ' + r.status);
  must(r.json && r.json.continue === true, label + ': continue not true: ' + r.stdout);
  must(r.json.stopReason === undefined, label + ': stopReason present');
}

const V = '2.0.0-beta.31';

arm('no version change: empty envelope, exit 0, fast, doctor never spawned, verified_at_ms unchanged', () => {
  const home = makeHome(V);
  seedMarker(home, { last_seen_version: V, verified_at_ms: 1234 });
  // A doctor that would leave a witness file if it ever ran.
  const witness = path.join(home, 'doctor-ran');
  const root = makeRoot(V, "require('fs').writeFileSync(" + JSON.stringify(witness) + ", 'x');\n");
  const r = runHook(home, root);
  neverBlocks(r, 'common path');
  console.log('  measured common-path wall clock: ' + r.ms + ' ms');
  must(r.json.systemMessage === undefined && r.json.hookSpecificOutput === undefined, 'common path must be silent');
  must(!fs.existsSync(witness), 'doctor was spawned on the common path');
  must(readMarker(home).verified_at_ms === 1234, 'verified_at_ms changed');
  must(r.ms < 1500, 'common path took ' + r.ms + ' ms');
});

arm('fresh install, no marker at all: counts as changed and runs the verification', () => {
  const home = makeHome(V);
  const root = makeRoot(V, stubDoctor(PASS_PAYLOAD, 0));
  const r = runHook(home, root);
  neverBlocks(r, 'fresh');
  const m = readMarker(home);
  must(m && m.local && m.local.ran === true, 'verification did not run: ' + JSON.stringify(m));
  must(m.last_seen_version === V, 'last_seen_version ' + (m && m.last_seen_version));
});

arm('version changed, tier passes: local.ok true, last_seen set, wire pending, message carries the short label', () => {
  const home = makeHome(V);
  seedMarker(home, { last_seen_version: '2.0.0-beta.30', eureka_optin: { choice: 'never', version: '2.0.0-beta.30' } });
  const root = makeRoot(V, stubDoctor(PASS_PAYLOAD, 0));
  const r = runHook(home, root);
  neverBlocks(r, 'passes');
  const m = readMarker(home);
  must(m.local.ok === true && m.local.failed_count === 0, 'local ' + JSON.stringify(m.local));
  must(m.last_seen_version === V, 'last_seen_version');
  must(m.wire === 'pending' && m.theo === 'pending', 'wire/theo ' + m.wire + '/' + m.theo);
  must(typeof r.json.systemMessage === 'string' && r.json.systemMessage.indexOf('beta.31') !== -1, 'message lacks label: ' + r.json.systemMessage);
  must(m.eureka_optin && m.eureka_optin.choice === 'never', 'a verification write erased the never');
});

arm('version changed, tier fails (stub): local.ok false, count 1, message names the count, hook still exits 0', () => {
  const home = makeHome(V);
  const root = makeRoot(V, stubDoctor(FAIL_PAYLOAD, 1));
  const r = runHook(home, root);
  neverBlocks(r, 'fails');
  const m = readMarker(home);
  must(m.local.ok === false && m.local.failed_count === 1, JSON.stringify(m.local));
  must(m.local.failed_points.indexOf('install-state') !== -1, 'failed_points');
  must(/1 local check/.test(r.json.systemMessage) && /install-state/.test(r.json.systemMessage), 'message: ' + r.json.systemMessage);
});

arm('version changed, REAL doctor tier with DOCTOR_TEST_FAIL_POINT=install-state: count 1, hook exits 0', () => {
  // The registered version must equal the real plugin.json version, or the F8
  // stale-registry cue (correctly) fires first.
  const repoVersion = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const home = makeHome(repoVersion);
  const r = runHook(home, REPO, {
    DOCTOR_TEST_MODE: '1',
    DOCTOR_TEST_FAIL_POINT: 'install-state',
    DOCTOR_TEST_ONLY_POINTS: 'install-state,eureka-optin-state',
  });
  neverBlocks(r, 'real doctor');
  const m = readMarker(home);
  must(m.local.ran === true && m.local.ok === false, JSON.stringify(m.local));
  must(m.local.failed_count === 1 && m.local.failed_points.indexOf('install-state') !== -1, JSON.stringify(m.local));
  must(m.local.mode === 'session-start', 'mode ' + m.local.mode);
});

arm('inconclusive (doctor absent): local.ran false with a reason, exit 0, last_seen_version still written', () => {
  const home = makeHome(V);
  const root = makeRoot(V, null);
  const r = runHook(home, root);
  neverBlocks(r, 'doctor absent');
  const m = readMarker(home);
  must(m.local.ran === false && m.local.ok === null, JSON.stringify(m.local));
  must(typeof m.local.inconclusive_reason === 'string' && m.local.inconclusive_reason.length > 0, 'reason');
  must(m.last_seen_version === V, 'last_seen_version not written, the budget would be re-spent every session');
  must(/could not finish/.test(r.json.systemMessage), r.json.systemMessage);
});

arm('inconclusive (doctor hangs): the budget kills it, result is inconclusive, hook exits 0 inside its 12 s budget', () => {
  const home = makeHome(V);
  const root = makeRoot(V, "setInterval(function () {}, 1000);\n");
  const r = runHook(home, root);
  neverBlocks(r, 'doctor hangs');
  const m = readMarker(home);
  must(m.local.ran === false && /timed out/.test(m.local.inconclusive_reason), JSON.stringify(m.local));
  must(r.ms < 12000, 'hook took ' + r.ms + ' ms, over the 12000 ms hook budget');
  console.log('  measured hung-doctor wall clock: ' + r.ms + ' ms');
});

arm('the F8 stale-registry cue still fires first and unchanged; the verification does not run', () => {
  const home = makeHome('1.15.1');
  const root = makeRoot('1.15.0', stubDoctor(PASS_PAYLOAD, 0));
  const r = runHook(home, root);
  neverBlocks(r, 'F8');
  must(r.json.systemMessage && /RESTART THIS SESSION/i.test(r.json.systemMessage), 'cue missing');
  must(/1\.15\.0/.test(r.json.hookSpecificOutput.additionalContext) && /1\.15\.1/.test(r.json.hookSpecificOutput.additionalContext), 'cue versions');
  must(readMarker(home) === null, 'the verification ran alongside the cue');
});

arm('source: the hook cannot block and cannot reach an install', () => {
  const src = fs.readFileSync(HOOK, 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*[*/#]/.test(l)).join('\n');
  must(code.indexOf('continue: false') === -1, 'continue: false present');
  must(code.indexOf('enableEureka') === -1, 'the hook reaches the installer');
  must(code.indexOf('writeVerifyState') === -1, 'the hook uses the raw overwrite');
  must(code.indexOf('mergeVerifyState') !== -1, 'the hook does not merge');
});

for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
console.log('\nsession-start-verify-hook: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
