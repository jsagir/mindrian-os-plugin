#!/usr/bin/env node
'use strict';
/*
 * tests/test-341-session-verify-state.cjs
 *
 * Phase 341 plan 08 Task 3. Pins lib/core/session-verify-state.cjs: the ONE
 * authority for the last-seen version marker, the verification result, the one
 * statusline segment, and the D-07b Eureka opt-in record plus its pure decision
 * function. Hermetic: MOS_SESSION_VERIFY_HOME points at an fs.mkdtempSync tree.
 * Zero network, zero spawn.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MOD_PATH = path.join(REPO, 'lib', 'core', 'session-verify-state.cjs');
const m = require(MOD_PATH);

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  try {
    fn();
    PASS += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    FAIL += 1;
    console.log('FAIL: ' + name);
    console.log('  ' + (e && e.message ? e.message : e));
  }
}
function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error((label || 'value') + ': expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}
function ok(cond, label) {
  if (!cond) throw new Error(label || 'assertion failed');
}

const roots = [];
function freshHome() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-sv-state-'));
  roots.push(d);
  process.env.MOS_SESSION_VERIFY_HOME = d;
  return d;
}

// The D-07b (c) locked copy, written out here so the arm compares with ===.
const LOCKED_COPY = 'Eureka spots connections between your claims by meaning, not keywords. It needs a one-time 380 MB local model download. Install it now?';
const CHECK = String.fromCharCode(0x2713);
const WARN = String.fromCharCode(0x26A0);

arm('detectVersionChange: empty home + real version -> changed:true, lastSeen:null (fresh install)', () => {
  freshHome();
  const r = m.detectVersionChange('2.0.0-beta.74');
  eq(r.changed, true, 'changed');
  eq(r.lastSeen, null, 'lastSeen');
  eq(r.current, '2.0.0-beta.74', 'current');
});

arm('detectVersionChange: same version unchanged, different version changed', () => {
  freshHome();
  ok(m.writeVerifyState({ last_seen_version: 'X' }), 'write');
  eq(m.detectVersionChange('X').changed, false, 'same');
  eq(m.detectVersionChange('Y').changed, true, 'different');
  eq(m.detectVersionChange('Y').lastSeen, 'X', 'lastSeen');
});

arm('detectVersionChange: null and empty registered version are not a trigger', () => {
  freshHome();
  eq(m.detectVersionChange(null).changed, false, 'null');
  eq(m.detectVersionChange('').changed, false, 'empty');
  eq(m.detectVersionChange(undefined).changed, false, 'undefined');
});

arm('malformed state.json: readVerifyState null, detectVersionChange changed:true, no throw', () => {
  const home = freshHome();
  const dir = path.join(home, '.mindrian', 'session-verify');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), '{ this is not json ', 'utf8');
  eq(m.readVerifyState(), null, 'read');
  eq(m.detectVersionChange('X').changed, true, 'changed');
});

arm('writeVerifyState is atomic: no .tmp sibling remains', () => {
  freshHome();
  ok(m.writeVerifyState({ last_seen_version: 'X' }), 'write');
  ok(m.mergeVerifyState({ wire: 'pending' }), 'merge');
  const left = fs.readdirSync(m.verifyDir()).filter((f) => /\.tmp$/.test(f));
  eq(left.length, 0, 'tmp files: ' + JSON.stringify(left));
  eq(path.basename(m.statePath()), 'state.json', 'state file name');
});

arm('shortVersionLabel: prerelease tail or whole version', () => {
  eq(m.shortVersionLabel('2.0.0-beta.30'), 'beta.30', 'beta');
  eq(m.shortVersionLabel('2.1.0'), '2.1.0', 'stable');
  eq(m.shortVersionLabel(''), '', 'empty');
  eq(m.shortVersionLabel(null), '', 'null');
});

arm('buildStatuslineSegment: exactly one segment for ok, failed, pending, null', () => {
  const okSeg = m.buildStatuslineSegment({ last_seen_version: '2.0.0-beta.30', local: { ok: true } });
  eq(okSeg, 'mos beta.30 ' + CHECK, 'ok');
  const failSeg = m.buildStatuslineSegment({ last_seen_version: '2.0.0-beta.30', local: { ok: false, failed_count: 3 } });
  eq(failSeg, 'mos beta.30 ' + WARN + ' 3', 'failed');
  ok(/\b3\b/.test(failSeg), 'failed form carries the count as digits');
  const pending = m.buildStatuslineSegment({ last_seen_version: '2.0.0-beta.30', local: { ok: null, ran: false } });
  eq(pending, 'mos beta.30', 'inconclusive claims no glyph');
  const noLocal = m.buildStatuslineSegment({ last_seen_version: '2.0.0-beta.30' });
  eq(noLocal, 'mos beta.30', 'pending claims no glyph');
  // T-341-31: a failed state with no usable count still shows at least 1.
  eq(m.buildStatuslineSegment({ last_seen_version: '2.1.0', local: { ok: false } }), 'mos 2.1.0 ' + WARN + ' 1', 'failed without count');
  for (const seg of [okSeg, failSeg, pending, noLocal]) {
    ok(seg.indexOf('\n') === -1 && seg.indexOf(' · ') === -1, 'one segment: ' + seg);
  }
});

arm('buildStatuslineSegment(null) and a versionless state return empty string', () => {
  eq(m.buildStatuslineSegment(null), '', 'null');
  eq(m.buildStatuslineSegment({ local: { ok: true } }), '', 'no version');
  eq(m.buildStatuslineSegment('junk'), '', 'string');
});

arm('mergeVerifyState preserves siblings: a verification write cannot erase a never', () => {
  freshHome();
  ok(m.writeVerifyState({ eureka_optin: { choice: 'never', version: 'X' } }), 'seed');
  ok(m.mergeVerifyState({ last_seen_version: 'Y', local: { ok: true } }), 'merge');
  const s = m.readVerifyState();
  eq(s.eureka_optin.choice, 'never', 'never survives');
  eq(s.last_seen_version, 'Y', 'patch applied');
  eq(s.schema, 'mos-session-verify/1', 'schema stamped');
});

arm('EUREKA_OPTIN_COPY is the D-07b (c) literal byte for byte; three labels in order', () => {
  eq(m.EUREKA_OPTIN_COPY, LOCKED_COPY, 'copy');
  eq(m.EUREKA_OPTIN_OPTIONS.length, 3, 'option count');
  eq(m.EUREKA_OPTIN_OPTIONS.map((o) => o.label).join('|'), 'Install now|Not now|Never ask again', 'labels');
  eq(m.EUREKA_OPTIN_CHOICES.join(','), 'installed,declined,never', 'choices');
  eq(m.EUREKA_OPTIN_OPTIONS.map((o) => m.EUREKA_OPTIN_CHOICE_BY_OPTION_ID[o.id]).join('|'), 'installed|declined|never', 'map join');
  ok(Object.isFrozen(m.EUREKA_OPTIN_OPTIONS) && Object.isFrozen(m.EUREKA_OPTIN_CHOICES), 'frozen');
});

arm('shouldAskEurekaOptin: the six D-07b (f) fixture states (ask, defer and reason)', () => {
  const V = '2.0.0-beta.31';
  const cases = [
    { name: 'fresh', in: { installedNow: false, state: null, currentVersion: V, firstInstallRewardPending: false }, ask: true, defer: false, reason: 'no_standing_answer' },
    { name: 'installed', in: { installedNow: true, state: null, currentVersion: V, firstInstallRewardPending: false }, ask: false, defer: false, reason: 'already_installed' },
    { name: 'declined-same', in: { installedNow: false, state: { eureka_optin: { choice: 'declined', version: V } }, currentVersion: V, firstInstallRewardPending: false }, ask: false, defer: false, reason: 'declined_this_version' },
    { name: 'declined-older', in: { installedNow: false, state: { eureka_optin: { choice: 'declined', version: '2.0.0-beta.30' } }, currentVersion: V, firstInstallRewardPending: false }, ask: true, defer: false, reason: 'no_standing_answer' },
    { name: 'never', in: { installedNow: false, state: { eureka_optin: { choice: 'never', version: '2.0.0-beta.30' } }, currentVersion: V, firstInstallRewardPending: false }, ask: false, defer: false, reason: 'never' },
    { name: 'reward-pending', in: { installedNow: false, state: null, currentVersion: V, firstInstallRewardPending: true }, ask: false, defer: true, reason: 'first_install_reward_owns_turn' },
  ];
  for (const c of cases) {
    const r = m.shouldAskEurekaOptin(c.in);
    eq(r.ask, c.ask, c.name + ' ask');
    eq(r.defer, c.defer, c.name + ' defer');
    eq(r.reason, c.reason, c.name + ' reason');
  }
  eq(m.shouldAskEurekaOptin({ installedNow: false, state: null, currentVersion: '' }).reason, 'unknown_version', 'unknown version');
  // A malformed record degrades to ask, never to a silent never.
  eq(m.shouldAskEurekaOptin({ installedNow: false, state: { eureka_optin: 'garbage' }, currentVersion: V }).ask, true, 'malformed record asks');
});

arm('shouldAskEurekaOptin precedence: installed beats never, never beats reward-pending', () => {
  const V = 'V';
  const neverState = { eureka_optin: { choice: 'never', version: 'U' } };
  const a = m.shouldAskEurekaOptin({ installedNow: true, state: neverState, currentVersion: V });
  eq(a.reason, 'already_installed', 'rule 2 before rule 3');
  const b = m.shouldAskEurekaOptin({ installedNow: false, state: neverState, currentVersion: V, firstInstallRewardPending: true });
  eq(b.reason, 'never', 'rule 3 before rule 6');
  eq(b.defer, false, 'a never never defers');
});

arm('recordEurekaOptin: invalid choice writes nothing; valid choice records choice, version, numeric at', () => {
  const home = freshHome();
  ok(m.writeVerifyState({ last_seen_version: 'X' }), 'seed');
  const before = fs.readFileSync(m.statePath(), 'utf8');
  const bad = m.recordEurekaOptin('bogus', 'X');
  eq(bad.ok, false, 'bad ok');
  eq(bad.reason, 'invalid_choice', 'bad reason');
  eq(fs.readFileSync(m.statePath(), 'utf8'), before, 'state byte-identical after a rejected write');
  const good = m.recordEurekaOptin('never', 'X');
  eq(good.ok, true, 'good ok');
  const rec = m.readVerifyState().eureka_optin;
  eq(rec.choice, 'never', 'choice');
  eq(rec.version, 'X', 'version');
  eq(typeof rec.at, 'number', 'at');
  eq(m.readVerifyState().last_seen_version, 'X', 'sibling preserved');
  // Honest failure encoding stays inside the three-value enum.
  const failed = m.recordEurekaOptin('declined', 'X', { install_failed: true, install_failure_reason: 'network down', junk: 'no' });
  eq(failed.ok, true, 'failed ok');
  const frec = m.readVerifyState().eureka_optin;
  eq(frec.choice, 'declined', 'declined');
  eq(frec.install_failed, true, 'install_failed');
  eq(frec.install_failure_reason, 'network down', 'reason');
  eq(frec.junk, undefined, 'unknown extra fields are dropped');
  void home;
});

arm('buildEurekaOptinCard survives gate-render normalizeCard with all three option ids intact', () => {
  const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
  const card = m.buildEurekaOptinCard('2.0.0-beta.31');
  ok(card.gate_id.startsWith(m.EUREKA_OPTIN_GATE_PREFIX), 'gate id prefix');
  eq(card.gate_id, m.EUREKA_OPTIN_GATE_PREFIX + '2.0.0-beta.31', 'gate id');
  eq(card.header, m.EUREKA_OPTIN_COPY, 'header is the locked copy');
  const n = gateRender.normalizeCard(card);
  eq(n.gate_id, card.gate_id, 'normalized gate id');
  eq(n.header, m.EUREKA_OPTIN_COPY, 'normalized header');
  eq(n.options.map((o) => o.id).join(','), 'install_now,not_now,never_ask_again', 'option ids');
  eq(n.options.map((o) => o.label).join('|'), 'Install now|Not now|Never ask again', 'option labels');
  eq(n.selectMode, 'single', 'select mode');
});

arm('resolveOptinVersion: marker version first, repo-version fallback second', () => {
  eq(m.resolveOptinVersion({ last_seen_version: '9.9.9' }), '9.9.9', 'marker');
  const fallback = m.resolveOptinVersion(null);
  ok(typeof fallback === 'string' && fallback.length > 0, 'fallback is a version string, got ' + fallback);
});

arm('module never throws on an unreachable root', () => {
  process.env.MOS_SESSION_VERIFY_HOME = '/nonexistent-path-' + process.pid + '/deeper';
  eq(m.readVerifyState(), null, 'read');
  eq(m.detectVersionChange('X').changed, true, 'detect');
  // A write to an unwritable root reports false and does not throw.
  const w = m.mergeVerifyState({ a: 1 });
  ok(w === true || w === false, 'merge returns a boolean');
});

arm('Canon Part 8: module source has no http, https or fetch token outside comments', () => {
  const src = fs.readFileSync(MOD_PATH, 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*[*/#]/.test(l)).join('\n');
  eq(/https?|fetch|spawn|child_process/.test(code), false, 'network or spawn token in code');
});

arm('dash scan: no em-dash or en-dash in the module', () => {
  const src = fs.readFileSync(MOD_PATH, 'utf8');
  eq(src.indexOf(String.fromCharCode(0x2014)), -1, 'em-dash');
  eq(src.indexOf(String.fromCharCode(0x2013)), -1, 'en-dash');
});

for (const d of roots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
console.log('\nsession-verify-state: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
