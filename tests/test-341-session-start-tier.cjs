#!/usr/bin/env node
'use strict';
/*
 * tests/test-341-session-start-tier.cjs
 *
 * Phase 341 plan 08 Task 4 (D-07a b and f). Pins the doctor session-start
 * acceptance tier and the session-start-verification harness policy.
 *
 * Measured fact behind the tier membership (2026-10-29): mcp-surface-tool-count
 * spawns both MCP servers and takes 15.4 s (the brain shim does not exit on stdin
 * EOF, so the organ waits out its 15 s spawn timeout). That alone exceeds the
 * 12 s SessionStart hook budget, so the tier is FOUR points and the surface point
 * runs on the detached leg. The expected set below is that decision, asserted in
 * both directions.
 *
 * Every child process runs with a temp HOME and a temp MOS_SESSION_VERIFY_HOME,
 * so the real ~/.claude and the real plugin cache are never read or written.
 * Zero network.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

const EXPECTED_TIER = ['eureka-optin-state', 'harness-policies', 'install-state', 'session-start-active-version'];

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  try { fn(); PASS += 1; console.log('PASS: ' + name); }
  catch (e) { FAIL += 1; console.log('FAIL: ' + name + '\n  ' + (e && e.message ? e.message : e)); }
}
function must(cond, label) { if (!cond) throw new Error(label || 'assertion failed'); }

const tmpRoots = [];
function tempHome() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-sst-'));
  tmpRoots.push(d);
  return d;
}
function childEnv(home, extra) {
  return Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MOS_SESSION_VERIFY_HOME: home,
    MINDRIAN_ROOMS_HOME: path.join(home, 'rooms'),
    MINDRIAN_ACCEPTANCE_PROGRESS: '0',
  }, extra || {});
}
function run(args, env, extraOpts) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, Object.assign({
    cwd: REPO, env: env, encoding: 'utf8', timeout: 60000, input: '',
  }, extraOpts || {}));
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', ms: Date.now() - t0 };
}
function parseJson(s) {
  const i = s.indexOf('{');
  return JSON.parse(s.slice(i));
}

arm('doctor --help documents --session-start', () => {
  const r = run([DOCTOR, '--help'], childEnv(tempHome()));
  must(r.stdout.indexOf('--session-start') !== -1, 'help lacks --session-start');
});

let tierRun = null;
arm('tier selects exactly the four expected points (both directions), mode session-start', () => {
  tierRun = run([DOCTOR, '--acceptance', '--session-start', '--json'], childEnv(tempHome()));
  must(tierRun.status === 0 || tierRun.status === 1, 'exit code ' + tierRun.status);
  const j = parseJson(tierRun.stdout);
  must(j.mode === 'session-start', 'mode ' + j.mode);
  const got = j.points.map((p) => p.id).sort();
  must(JSON.stringify(got) === JSON.stringify(EXPECTED_TIER), 'point ids: ' + JSON.stringify(got));
});

arm('the wire point and the MCP surface point are NOT on the inline tier', () => {
  const j = parseJson(tierRun.stdout);
  const ids = j.points.map((p) => p.id);
  must(ids.indexOf('activation-reached-the-wire') === -1, 'wire point is on the inline tier');
  must(ids.indexOf('mcp-surface-tool-count') === -1, 'mcp surface point is on the inline tier');
});

arm('the tier is bounded: measured wall clock under the 12000 ms hook budget', () => {
  console.log('  MEASURED session-start tier wall clock: ' + tierRun.ms + ' ms');
  must(tierRun.ms < 12000, 'tier took ' + tierRun.ms + ' ms');
});

arm('failure path is wired and countable: DOCTOR_TEST_FAIL_POINT=install-state', () => {
  const env = childEnv(tempHome(), {
    DOCTOR_TEST_MODE: '1',
    DOCTOR_TEST_FAIL_POINT: 'install-state',
    DOCTOR_TEST_ONLY_POINTS: 'install-state,eureka-optin-state',
  });
  const r = run([DOCTOR, '--acceptance', '--session-start', '--json'], env);
  must(r.status === 1, 'exit code ' + r.status);
  const j = parseJson(r.stdout);
  must(j.failed_points.length === 1 && j.failed_points[0] === 'install-state', 'failed_points ' + JSON.stringify(j.failed_points));
  must(j.summary.failed === 1, 'summary.failed ' + j.summary.failed);
});

arm('--only narrows the tier to the named point', () => {
  const r = run([DOCTOR, '--acceptance', '--session-start', '--only=eureka-optin-state', '--json'], childEnv(tempHome()));
  must(r.status === 0, 'exit code ' + r.status);
  const j = parseJson(r.stdout);
  must(j.points.length === 1 && j.points[0].id === 'eureka-optin-state', JSON.stringify(j.points.map((p) => p.id)));
});

arm('run-harness --tier session-start reports exactly two logged policies', () => {
  const r = run([path.join(REPO, 'scripts', 'run-harness.cjs'), '--tier', 'session-start', '--json'], childEnv(tempHome()));
  const j = parseJson(r.stdout);
  const ids = j.policies.map((p) => p.id).sort();
  must(JSON.stringify(ids) === JSON.stringify(['eureka-optin-once', 'session-start-verification']), JSON.stringify(ids));
  must(j.policies.every((p) => p.rung === 'logged'), 'a policy is not at rung logged');
});

arm('build-harness-manifest --check exits 0', () => {
  const r = run([path.join(REPO, 'scripts', 'build-harness-manifest.cjs'), '--check'], childEnv(tempHome()));
  must(r.status === 0, 'exit ' + r.status + ' ' + r.stdout.slice(-200));
});

arm('the schema enum grew by exactly one member: 6 members, includes session-start', () => {
  const s = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'harness-policies', '_schema.json'), 'utf8'));
  const v = s._doc.applies_to_vocabulary;
  must(v.length === 6 && v.indexOf('session-start') !== -1, JSON.stringify(v));
});

arm('check-session-start-verification: unknown flag exits 2 with usage; runChecks is exported', () => {
  const r = run([path.join(REPO, 'scripts', 'check-session-start-verification.cjs'), '--bogus'], childEnv(tempHome()));
  must(r.status === 2, 'exit ' + r.status);
  must(/usage:/.test(r.stderr + r.stdout), 'no usage line');
  must(typeof require(path.join(REPO, 'scripts', 'check-session-start-verification.cjs')).runChecks === 'function', 'runChecks');
});

arm('check-session-start-verification: a synthetic tree with a failed last verification reports it; absent state does not', () => {
  const mod = require(path.join(REPO, 'scripts', 'check-session-start-verification.cjs'));
  const home = tempHome();
  const prev = process.env.MOS_SESSION_VERIFY_HOME;
  process.env.MOS_SESSION_VERIFY_HOME = home;
  try {
    const stateMod = require(path.join(REPO, 'lib', 'core', 'session-verify-state.cjs'));
    must(mod.checkLastVerification(REPO).length === 0, 'absent state must not be a violation');
    stateMod.writeVerifyState({ last_seen_version: 'X', local: { ok: false, failed_points: ['install-state'], failed_count: 1 } });
    const v = mod.checkLastVerification(REPO);
    must(v.length === 1 && v[0].id === 'last-verification-failed', JSON.stringify(v));
    stateMod.writeVerifyState({ last_seen_version: 'X', local: { ok: true } });
    must(mod.checkLastVerification(REPO).length === 0, 'a passing verification must not be a violation');
  } finally {
    if (prev === undefined) delete process.env.MOS_SESSION_VERIFY_HOME; else process.env.MOS_SESSION_VERIFY_HOME = prev;
  }
});

arm('check-session-start-verification: tier-set drift is caught in both directions', () => {
  const mod = require(path.join(REPO, 'scripts', 'check-session-start-verification.cjs'));
  const src = fs.readFileSync(DOCTOR, 'utf8');
  const real = mod.tierPointsFromSource(src);
  must(JSON.stringify(real) === JSON.stringify(EXPECTED_TIER), 'real tier ' + JSON.stringify(real));
  // Drop one member: the parser must see the difference.
  const dropped = src.replace("applies_to: ['pre-tag', 'session-start', 'full'],\n      run: async function () {\n        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'install-state')", "applies_to: ['pre-tag', 'full'],\n      run: async function () {\n        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'install-state')");
  must(dropped !== src, 'fixture edit did not apply');
  must(mod.tierPointsFromSource(dropped).indexOf('install-state') === -1, 'dropped member still seen');
});

arm('Canon Part 8: runner source has no http, https or fetch token outside comments', () => {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'check-session-start-verification.cjs'), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*[*/#]/.test(l)).join('\n');
  must(!/https?|fetch|spawn|child_process/.test(code), 'network or spawn token in code');
});

for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
console.log('\nsession-start-tier: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
