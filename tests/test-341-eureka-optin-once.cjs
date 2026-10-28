#!/usr/bin/env node
'use strict';
/*
 * tests/test-341-eureka-optin-once.cjs
 *
 * Phase 341 plan 08 Task 4 (D-07b f). Pins the eureka-optin-once runner and the
 * eureka-optin-state doctor reporter. Separate from the session-start tier suite
 * so the two policies' pins do not entangle.
 *
 * Every child process runs with a temp HOME and a temp MOS_SESSION_VERIFY_HOME.
 * Zero network. No real install anywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RUNNER = path.join(REPO, 'scripts', 'check-eureka-optin-once.cjs');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');
const STATE_MOD = path.join(REPO, 'lib', 'core', 'session-verify-state.cjs');

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  try { fn(); PASS += 1; console.log('PASS: ' + name); }
  catch (e) { FAIL += 1; console.log('FAIL: ' + name + '\n  ' + (e && e.message ? e.message : e)); }
}
function must(cond, label) { if (!cond) throw new Error(label || 'assertion failed'); }

const tmpRoots = [];
function tempHome() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-eoo-'));
  tmpRoots.push(d);
  return d;
}
function env(home) {
  return Object.assign({}, process.env, {
    HOME: home, USERPROFILE: home, MOS_SESSION_VERIFY_HOME: home,
    MINDRIAN_ROOMS_HOME: path.join(home, 'rooms'), MINDRIAN_ACCEPTANCE_PROGRESS: '0',
  });
}
function run(args, e) {
  const r = spawnSync(process.execPath, args, { cwd: REPO, env: e, encoding: 'utf8', timeout: 60000, input: '' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

arm('runner --check exits 0 on a clean tree; --bogus exits 2 with usage', () => {
  const r = run([RUNNER, '--check'], env(tempHome()));
  must(r.status === 0, 'exit ' + r.status + ' ' + r.stdout);
  const b = run([RUNNER, '--bogus'], env(tempHome()));
  must(b.status === 2 && /usage:/.test(b.stderr + b.stdout), 'bogus exit ' + b.status);
});

arm('FIXTURES has exactly six members and exactly the six D-07b (f) names (set, both directions)', () => {
  const m = require(RUNNER);
  must(Array.isArray(m.FIXTURES) && m.FIXTURES.length === 6, 'length ' + (m.FIXTURES && m.FIXTURES.length));
  const want = ['fresh', 'installed', 'declined-same-version', 'declined-older-version', 'never', 'first-install-reward-pending'];
  const got = m.FIXTURES.map((f) => f.name);
  must(want.every((n) => got.indexOf(n) !== -1) && got.every((n) => want.indexOf(n) !== -1), JSON.stringify(got));
});

arm('the runner is a caller, not a second implementation: the declined literal lives only inside the FIXTURES block', () => {
  // Boundary: the block between the FIXTURES-BEGIN and FIXTURES-END marker lines
  // in the runner source. Any occurrence of the quoted declined literal outside
  // those markers would be a comparison of the runner's own.
  const src = fs.readFileSync(RUNNER, 'utf8');
  must(src.indexOf('shouldAskEurekaOptin') !== -1, 'does not reference shouldAskEurekaOptin');
  const b = src.indexOf('// FIXTURES-BEGIN');
  const e = src.indexOf('// FIXTURES-END');
  must(b !== -1 && e > b, 'fixture markers missing');
  const literal = "'declined'";
  let at = src.indexOf(literal);
  let count = 0;
  while (at !== -1) {
    count += 1;
    must(at > b && at < e, 'declined literal outside the FIXTURES block at offset ' + at);
    at = src.indexOf(literal, at + 1);
  }
  must(count >= 2, 'expected the two declined fixtures, found ' + count);
});

arm('a real regression is caught: an always-ask decision function trips the three no-fire fixtures', () => {
  const mod = require(STATE_MOD);
  const runner = require(RUNNER);
  const original = mod.shouldAskEurekaOptin;
  try {
    mod.shouldAskEurekaOptin = function () { return { ask: true, defer: false, reason: 'patched' }; };
    const r = runner.runChecks(REPO);
    must(r.ok === false, 'runner stayed green against a broken rule');
    const ids = r.violations.map((v) => v.id);
    for (const name of ['installed', 'declined-same-version', 'never']) {
      must(ids.indexOf('fixture-' + name) !== -1, 'no violation for fixture ' + name + ': ' + JSON.stringify(ids));
    }
  } finally {
    mod.shouldAskEurekaOptin = original;
  }
  must(runner.runChecks(REPO).ok === true, 'runner not green after restore');
});

arm('eureka-optin-state is in the session-start tier, never fails it, and names each of the four states honestly', () => {
  const stateMod = require(STATE_MOD);
  const cases = [
    { seed: null, want: [/not yet asked/] },
    { seed: { choice: 'installed', version: '2.0.0-beta.31' }, want: [/installed at 2\.0\.0-beta\.31/] },
    { seed: { choice: 'declined', version: '2.0.0-beta.31' }, want: [/declined for 2\.0\.0-beta\.31/] },
    { seed: { choice: 'declined', version: '2.0.0-beta.31', install_failed: true, install_failure_reason: 'network down' }, want: [/declined/, /install failed/, /network down/] },
    { seed: { choice: 'never', version: '2.0.0-beta.31' }, want: [/never/, /\/mos:eureka enable/] },
  ];
  for (const c of cases) {
    const home = tempHome();
    const prev = process.env.MOS_SESSION_VERIFY_HOME;
    process.env.MOS_SESSION_VERIFY_HOME = home;
    try {
      if (c.seed) stateMod.writeVerifyState({ last_seen_version: '2.0.0-beta.31', eureka_optin: c.seed });
    } finally {
      if (prev === undefined) delete process.env.MOS_SESSION_VERIFY_HOME; else process.env.MOS_SESSION_VERIFY_HOME = prev;
    }
    const r = run([DOCTOR, '--acceptance', '--session-start', '--json'], env(home));
    const j = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    const p = j.points.find((x) => x.id === 'eureka-optin-state');
    must(p && p.ok === true, 'point missing or not ok for seed ' + JSON.stringify(c.seed));
    must(p.detail && typeof p.detail.sentence === 'string', 'no sentence');
    for (const re of c.want) must(re.test(p.detail.sentence), 'sentence "' + p.detail.sentence + '" lacks ' + re);
  }
});

arm('Canon Part 8: runner source has no http, https, fetch or spawn token outside comments', () => {
  const src = fs.readFileSync(RUNNER, 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*[*/#]/.test(l)).join('\n');
  must(!/https?|fetch|spawn|child_process/.test(code), 'forbidden token in runner code');
});

for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
console.log('\neureka-optin-once: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
