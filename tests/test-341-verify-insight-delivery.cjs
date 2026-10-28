#!/usr/bin/env node
'use strict';
/*
 * tests/test-341-verify-insight-delivery.cjs
 *
 * Phase 341 plan 08 Task 5 (D-07a d and e). Pins the detached probe
 * scripts/session-verify-probe.cjs (the Theo verdict, the honest refusal, the
 * generic handle, the Canon Part 8 egress allowlist) and the router branch
 * scripts/first-install-router.cjs _deliverVerifyInsight (once per install or
 * update, never per session, never competing with the first-install reward, never
 * wedging).
 *
 * Hermetic and zero network. The probe is driven through
 * MOS_SESSION_VERIFY_PROBE_FIXTURE, which replaces the doctor spawn and the brain
 * client call; the fixture can name a call log so "no Theo call" is asserted by a
 * file, not by inspection. Temp HOME and temp MOS_SESSION_VERIFY_HOME everywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const PROBE = path.join(REPO, 'scripts', 'session-verify-probe.cjs');
const ROUTER = path.join(REPO, 'scripts', 'first-install-router.cjs');
const V = '2.0.0-beta.31';
const SENTINEL = 'SENTINEL-ROOM-SECRET-4f9c2a';

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
function stateFile(home) { return path.join(home, '.mindrian', 'session-verify', 'state.json'); }
function readState(home) { try { return JSON.parse(fs.readFileSync(stateFile(home), 'utf8')); } catch (_e) { return null; } }
function seed(home, obj) {
  fs.mkdirSync(path.dirname(stateFile(home)), { recursive: true });
  fs.writeFileSync(stateFile(home), JSON.stringify(obj), 'utf8');
}

function makeRoom(problemType) {
  const room = mk('mos-341-room-');
  fs.writeFileSync(path.join(room, 'USER.md'),
    '---\nschema_version: 1\ncanonical_role: ' + SENTINEL + '\nproblem_type: ' + problemType + '\n---\n\nBody text ' + SENTINEL + '\n', 'utf8');
  fs.writeFileSync(path.join(room, 'STATE.md'), '# State\n' + SENTINEL + '\n', 'utf8');
  fs.writeFileSync(path.join(room, 'ROOM.md'), '# Room ' + SENTINEL + '\n', 'utf8');
  return room;
}

const CHAIN = { grounded: true, chain: [{ step: 1, framework: 'Jobs to be Done' }, { step: 2, framework: 'Five Whys' }], note: 'start narrow' };

function runProbe(opts) {
  const home = opts.home;
  const fixturePath = path.join(home, 'fixture.json');
  const callLog = path.join(home, 'calls.log');
  const fixture = Object.assign({ call_log: callLog }, opts.fixture);
  fs.writeFileSync(fixturePath, JSON.stringify(fixture), 'utf8');
  const env = Object.assign({}, process.env, {
    HOME: home, USERPROFILE: home, MOS_SESSION_VERIFY_HOME: home,
    MINDRIAN_ROOMS_HOME: path.join(home, 'rooms'),
    MOS_SESSION_VERIFY_PROBE_FIXTURE: fixturePath,
  });
  delete env.CLAUDE_ACTIVE_ROOM;
  if (opts.room) env.CLAUDE_ACTIVE_ROOM = opts.room;
  const r = spawnSync(process.execPath, [PROBE], { env: env, encoding: 'utf8', timeout: 30000, input: '' });
  const calls = fs.existsSync(callLog) ? fs.readFileSync(callLog, 'utf8').split('\n').filter(Boolean) : [];
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, calls: calls };
}

function runRouter(home) {
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, MOS_SESSION_VERIFY_HOME: home });
  delete env.CLAUDE_ACTIVE_ROOM;
  const r = spawnSync(process.execPath, [ROUTER], { env: env, encoding: 'utf8', timeout: 20000, input: JSON.stringify({ prompt: 'hello there' }) });
  let json = null;
  try { json = JSON.parse((r.stdout || '').trim()); } catch (_e) { json = null; }
  return { status: r.status, stdout: r.stdout, json: json };
}
function setRouterPhase(home, phase) {
  const d = path.join(home, '.mindrian', 'first-install');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'state.json'), JSON.stringify({ phase: phase, schema_version: 1 }), 'utf8');
}
function markOnboarded(home) { fs.writeFileSync(path.join(home, '.mindrian-onboarded'), '2.0.0-beta.1\n2026-01-01\n', 'utf8'); }

function seedPendingInsight(home, retries) {
  const cap = path.join(home, '.mindrian', 'session-verify', 'insight-' + V + '.md');
  fs.mkdirSync(path.dirname(cap), { recursive: true });
  fs.writeFileSync(cap, 'INSTRUCTION FOR LARRY: ask one question about the narrow job.\n', 'utf8');
  seed(home, { last_seen_version: V, local: { ok: true }, insight: { pending: true, capture_path: cap, handle: 'IDP', drain_retries: retries || 0 } });
  return cap;
}

arm('probe: wire ok + a room whose problem_type is IDP -> theo reachable, handle IDP, insight captured', () => {
  const home = mk('mos-341-probe-');
  seed(home, { last_seen_version: V, local: { ok: true } });
  const r = runProbe({ home: home, room: makeRoom('IDP'), fixture: { wire: { ok: true }, surface: { ok: true }, recommend_chain: CHAIN } });
  must(r.status === 0, 'exit ' + r.status);
  const s = readState(home);
  must(s.theo === 'reachable' && s.wire === 'ok', 'theo/wire ' + s.theo + '/' + s.wire);
  must(s.insight.handle === 'IDP' && s.insight.pending === true, JSON.stringify(s.insight));
  must(fs.existsSync(s.insight.capture_path) && fs.statSync(s.insight.capture_path).size > 0, 'capture file');
  must(r.calls.length === 1 && r.calls[0] === 'IDP', 'calls ' + JSON.stringify(r.calls));
  must(s.local.ok === true, 'the probe overwrote local');
});

arm('probe: wire failed + brain unavailable -> theo refused with the verbatim honest refusal, no insight', () => {
  const home = mk('mos-341-probe-');
  seed(home, { last_seen_version: V, local: { ok: true } });
  const r = runProbe({ home: home, room: makeRoom('IDP'), fixture: { wire: { ok: false, finding: 'handshake failed' }, brain_available: false, recommend_chain: CHAIN } });
  const s = readState(home);
  must(s.theo === 'refused', 'theo ' + s.theo);
  must(s.theo_reason.indexOf('verification is local-only') !== -1, 'reason ' + s.theo_reason);
  must(s.insight.pending === false, 'insight pending');
  must(r.calls.length === 0, 'a Theo call was made while Theo was not reachable');
});

arm('probe: wire failed + brain available -> theo unreachable carrying the finding (never imitates reachable)', () => {
  const home = mk('mos-341-probe-');
  seed(home, { last_seen_version: V, local: { ok: true } });
  runProbe({ home: home, room: makeRoom('IDP'), fixture: { wire: { ok: false, finding: 'activation gap detected' }, brain_available: true, recommend_chain: CHAIN } });
  const s = readState(home);
  must(s.theo === 'unreachable' && /activation gap/.test(s.theo_reason), JSON.stringify([s.theo, s.theo_reason]));
  must(s.wire === 'failed', 'wire ' + s.wire);
});

arm('probe: no room bound -> no Theo call at all and handle null', () => {
  const home = mk('mos-341-probe-');
  seed(home, { last_seen_version: V, local: { ok: true } });
  const r = runProbe({ home: home, room: null, fixture: { wire: { ok: true }, recommend_chain: CHAIN } });
  const s = readState(home);
  must(s.theo === 'reachable', 'theo ' + s.theo);
  must(s.insight.handle === null && s.insight.pending === false, JSON.stringify(s.insight));
  must(r.calls.length === 0, 'calls ' + JSON.stringify(r.calls));
});

arm('probe: problem_type unknown is not a handle -> no call, no insight', () => {
  const home = mk('mos-341-probe-');
  seed(home, { last_seen_version: V, local: { ok: true } });
  const r = runProbe({ home: home, room: makeRoom('unknown'), fixture: { wire: { ok: true }, recommend_chain: CHAIN } });
  const s = readState(home);
  must(s.insight.handle === null && s.insight.pending === false, JSON.stringify(s.insight));
  must(r.calls.length === 0, 'calls ' + JSON.stringify(r.calls));
});

arm('probe: an ungrounded or empty chain is a legitimate answer -> no insight manufactured', () => {
  const home = mk('mos-341-probe-');
  seed(home, { last_seen_version: V, local: { ok: true } });
  runProbe({ home: home, room: makeRoom('WDP'), fixture: { wire: { ok: true }, recommend_chain: { grounded: false, chain: [] } } });
  const s = readState(home);
  must(s.insight.pending === false && s.insight.handle === 'WDP', JSON.stringify(s.insight));
  must(!fs.existsSync(path.join(home, '.mindrian', 'session-verify', 'insight-' + V + '.md')), 'a capture was written');
});

arm('Canon Part 8: the only room-derived value written or sent is UDP, IDP or WDP; a planted sentinel never appears', () => {
  const home = mk('mos-341-probe-');
  seed(home, { last_seen_version: V, local: { ok: true } });
  const r = runProbe({ home: home, room: makeRoom('IDP'), fixture: { wire: { ok: true }, recommend_chain: CHAIN } });
  const stateText = fs.readFileSync(stateFile(home), 'utf8');
  const s = JSON.parse(stateText);
  const captureText = fs.readFileSync(s.insight.capture_path, 'utf8');
  must(stateText.indexOf(SENTINEL) === -1, 'sentinel in the state file');
  must(captureText.indexOf(SENTINEL) === -1, 'sentinel in the capture file');
  must(['UDP', 'IDP', 'WDP'].indexOf(s.insight.handle) !== -1, 'handle ' + s.insight.handle);
  for (const c of r.calls) must(['UDP', 'IDP', 'WDP'].indexOf(c) !== -1, 'a call carried ' + c);
  must(r.calls.join('').indexOf(SENTINEL) === -1, 'sentinel in a call');
  must(captureText.indexOf(home) === -1 && captureText.indexOf('rooms') === -1, 'a path leaked into the capture');
});

arm('router: delivers the capture once as additionalContext, marks it, and a second turn emits nothing', () => {
  const home = mk('mos-341-router-');
  const cap = seedPendingInsight(home, 0);
  setRouterPhase(home, 'done');
  const first = runRouter(home);
  must(first.status === 0 && first.json && first.json.continue === true, 'first run: ' + first.stdout);
  const ctx = first.json.hookSpecificOutput && first.json.hookSpecificOutput.additionalContext;
  must(ctx === fs.readFileSync(cap, 'utf8'), 'context is not the capture: ' + ctx);
  const s = readState(home);
  must(s.insight.pending === false && s.insight.delivered_for_version === V, JSON.stringify(s.insight));
  const second = runRouter(home);
  must(second.stdout.trim() === '{"continue":true}', 'second run was not empty: ' + second.stdout);
});

arm('router: defers while the first-install reward owns the turn; the capture survives and drain_retries counts', () => {
  const home = mk('mos-341-router-');
  const cap = seedPendingInsight(home, 0);
  setRouterPhase(home, 'routed');
  markOnboarded(home);
  const r = runRouter(home);
  must(!(r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.additionalContext === fs.readFileSync(cap, 'utf8')), 'the insight competed with the reward');
  const s = readState(home);
  must(s.insight.pending === true && s.insight.drain_retries === 1, JSON.stringify(s.insight));
  must(fs.existsSync(cap), 'capture removed');
});

arm('router: never wedges: at drain_retries 3 it gives up terminally and the normal envelope still comes out', () => {
  const home = mk('mos-341-router-');
  seedPendingInsight(home, 3);
  setRouterPhase(home, 'done');
  const r = runRouter(home);
  must(r.status === 0 && r.stdout.trim() === '{"continue":true}', 'envelope ' + r.stdout);
  const s = readState(home);
  must(s.insight.pending === false && s.insight.reason === 'drain_timeout', JSON.stringify(s.insight));
});

arm('router: with no router state yet, a FIRST_INSTALL machine defers and an onboarded machine delivers', () => {
  const first = mk('mos-341-router-');
  const cap1 = seedPendingInsight(first, 0);
  const r1 = runRouter(first);
  must(!(r1.json && r1.json.hookSpecificOutput && r1.json.hookSpecificOutput.additionalContext === fs.readFileSync(cap1, 'utf8')), 'delivered on a first install');
  must(readState(first).insight.drain_retries === 1, 'defer not counted');
  const onboarded = mk('mos-341-router-');
  const cap2 = seedPendingInsight(onboarded, 0);
  markOnboarded(onboarded);
  const r2 = runRouter(onboarded);
  must(r2.json.hookSpecificOutput.additionalContext === fs.readFileSync(cap2, 'utf8'), 'not delivered on an onboarded machine');
});

arm('router: the original machine is untouched when there is no verify state at all', () => {
  const doneHome = mk('mos-341-router-');
  setRouterPhase(doneHome, 'done');
  const a = runRouter(doneHome);
  must(a.status === 0 && a.stdout.trim() === '{"continue":true}', 'done phase: ' + a.stdout);
  const onboarded = mk('mos-341-router-');
  markOnboarded(onboarded);
  const b = runRouter(onboarded);
  must(b.status === 0 && b.stdout.trim() === '{"continue":true}', 'onboarded: ' + b.stdout);
  must(readState(onboarded) === null && readState(doneHome) === null, 'the branch created a verify state');
  must(!fs.existsSync(path.join(onboarded, '.mindrian', 'first-install', 'state.json')), 'router state created for an onboarded machine');
});

arm('source: the probe never writes to the terminal and never uses the raw overwrite', () => {
  const src = fs.readFileSync(PROBE, 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*[*/#]/.test(l)).join('\n');
  must(!/console\.(log|error)|process\.stdout\.write|process\.stderr\.write/.test(code), 'terminal write');
  must(code.indexOf('writeVerifyState') === -1, 'raw overwrite');
  must(code.indexOf('mergeVerifyState') !== -1, 'no merge');
  must(src.indexOf('verification is local-only') !== -1, 'refusal text');
});

for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
console.log('\nverify-insight-delivery: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
