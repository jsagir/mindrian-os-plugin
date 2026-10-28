#!/usr/bin/env node
'use strict';
/*
 * tests/test-341-eureka-optin-card.cjs
 *
 * Phase 341 plan 08 Task 6 (D-07b a, c, d, e, g). Pins the Eureka opt-in card end
 * to end: the CLI half (the router branch), the Desktop and Cowork half (room_list),
 * the ONE recorder (gate_answer's reserved branch), and the enable coupling that
 * clears a wedged never.
 *
 * ZERO network and ZERO real install. Every child process runs with a temp HOME, a
 * temp MOS_SESSION_VERIFY_HOME, a temp MINDRIAN_ROOMS_HOME and a temp
 * MINDRIAN_EUREKA_DEPS_ROOT. Every arm that would reach enableEureka's npm spawn
 * either hits the idempotent probe on a seeded fixture tree or monkeypatches the
 * module export, restored in a finally. At the end the suite asserts that no
 * @huggingface directory was created under any temp deps root.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const ROUTER = path.join(REPO, 'scripts', 'first-install-router.cjs');
const vs = require(path.join(REPO, 'lib', 'core', 'session-verify-state.cjs'));
const V = '2.0.0-beta.31';
const SENTINEL = 'SENTINEL-ROOM-SECRET-7d1e';

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { PASS += 1; console.log('PASS: ' + name); },
    (e) => { FAIL += 1; console.log('FAIL: ' + name + '\n  ' + (e && e.message ? e.message : e)); }
  );
}
function must(cond, label) { if (!cond) throw new Error(label || 'assertion failed'); }

const tmpRoots = [];
const depsRoots = [];
let answersHome = null;
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpRoots.push(d);
  return d;
}

// A temp world: HOME, state root, rooms home, deps root. Applied to THIS process.
function world() {
  const home = mk('mos-341-card-');
  const deps = path.join(home, 'eureka-deps');
  fs.mkdirSync(deps, { recursive: true });
  depsRoots.push(deps);
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.MOS_SESSION_VERIFY_HOME = home;
  process.env.MINDRIAN_ROOMS_HOME = path.join(home, 'rooms');
  process.env.MINDRIAN_EUREKA_DEPS_ROOT = deps;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  return { home, deps };
}
function installFixture(deps) {
  const d = path.join(deps, 'node_modules', '@huggingface', 'transformers');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), '{"name":"@huggingface/transformers","version":"0.0.0-fixture"}', 'utf8');
}
function stateOf(home) { try { return JSON.parse(fs.readFileSync(path.join(home, '.mindrian', 'session-verify', 'state.json'), 'utf8')); } catch (_e) { return null; } }
function seed(obj) { return vs.writeVerifyState(obj); }

function routerEnv(w, extra) {
  return Object.assign({}, process.env, {
    HOME: w.home, USERPROFILE: w.home, MOS_SESSION_VERIFY_HOME: w.home,
    MINDRIAN_ROOMS_HOME: path.join(w.home, 'rooms'), MINDRIAN_EUREKA_DEPS_ROOT: w.deps,
  }, extra || {});
}
function runRouter(w, session, extraEnv) {
  const r = spawnSync(process.execPath, [ROUTER], {
    env: routerEnv(w, extraEnv), encoding: 'utf8', timeout: 20000,
    input: JSON.stringify({ prompt: 'hello there', session_id: session || 's1' }),
  });
  let json = null;
  try { json = JSON.parse((r.stdout || '').trim()); } catch (_e) { json = null; }
  const ctx = json && json.hookSpecificOutput && json.hookSpecificOutput.additionalContext;
  return { status: r.status, stdout: r.stdout, json: json, ctx: typeof ctx === 'string' ? ctx : null };
}
function setRouterPhase(w, phase) {
  const d = path.join(w.home, '.mindrian', 'first-install');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'state.json'), JSON.stringify({ phase: phase, schema_version: 1 }), 'utf8');
}
function markOnboarded(w) { fs.writeFileSync(path.join(w.home, '.mindrian-onboarded'), '2.0.0-beta.1\n2026-01-01\n', 'utf8'); }

// gate tools in-process through a captured server.
function gateHarness() {
  const { captureToolServer } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-354.cjs'));
  const { server, handlers } = captureToolServer();
  require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs')).register(server, { pluginRoot: REPO, surface: 'cli' });
  return handlers;
}
function jsonOf(raw) {
  try { return JSON.parse(raw.content[0].text); } catch (_e) { return null; }
}
async function mintCard(handlers, version) {
  const card = vs.buildEurekaOptinCard(version);
  const r = await handlers.get('gate_render')({
    gate_id: card.gate_id, header: card.header, select_mode: 'single',
    options: card.options.map((o) => ({ id: o.id, label: o.label, description: o.description })),
  }, {});
  const j = jsonOf(r);
  must(j && j.ok === true, 'mint failed: ' + JSON.stringify(j));
  return card;
}
const OPT = (choice) => vs.EUREKA_OPTIN_OPTIONS.find((o) => vs.EUREKA_OPTIN_CHOICE_BY_OPTION_ID[o.id] === choice).id;

(async () => {
  await arm('the copy is locked and single-sourced: the router instruction carries it character for character; no other file spells it', () => {
    const w = world();
    seed({ last_seen_version: V, local: { ok: true } });
    setRouterPhase(w, 'done');
    const r = runRouter(w);
    must(r.ctx && r.ctx.indexOf(vs.EUREKA_OPTIN_COPY) !== -1, 'instruction lacks the locked copy: ' + r.stdout);
    for (const f of ['scripts/first-install-router.cjs', 'lib/mcp/tools/room.cjs', 'lib/mcp/tools/gate.cjs']) {
      must(fs.readFileSync(path.join(REPO, f), 'utf8').indexOf('380 MB') === -1, f + ' spells 380 MB');
    }
  });

  await arm('fires once: copy and all three labels on the first turn; no card on the second, nor after a recorded answer', () => {
    const w = world();
    seed({ last_seen_version: V, local: { ok: true } });
    setRouterPhase(w, 'done');
    const first = runRouter(w);
    must(first.ctx, 'no card on the first turn: ' + first.stdout);
    for (const o of vs.EUREKA_OPTIN_OPTIONS) must(first.ctx.indexOf(o.label) !== -1, 'label missing: ' + o.label);
    must(stateOf(w.home).eureka_optin_shown_for_version === V, 'shown marker not written');
    const second = runRouter(w);
    must(second.stdout.trim() === '{"continue":true}', 'second turn emitted: ' + second.stdout);
    vs.recordEurekaOptin('declined', V);
    const third = runRouter(w);
    must(third.stdout.trim() === '{"continue":true}', 'card after an answer: ' + third.stdout);
  });

  await arm('one turn, one emit: a pending insight and the card ride the SAME envelope (no second mechanism)', () => {
    const w = world();
    const cap = path.join(w.home, '.mindrian', 'session-verify', 'insight-' + V + '.md');
    fs.mkdirSync(path.dirname(cap), { recursive: true });
    fs.writeFileSync(cap, 'INSTRUCTION FOR LARRY: ask one question about the narrow job.\n', 'utf8');
    seed({ last_seen_version: V, local: { ok: true }, insight: { pending: true, capture_path: cap, handle: 'IDP', drain_retries: 0 } });
    setRouterPhase(w, 'done');
    const r = runRouter(w);
    must(r.status === 0 && r.json && r.json.continue === true, 'envelope ' + r.stdout);
    must(r.stdout.trim().split('\n').length === 1, 'more than one envelope on stdout');
    must(r.ctx.indexOf('ask one question about the narrow job') !== -1, 'insight missing');
    must(r.ctx.indexOf(vs.EUREKA_OPTIN_COPY) !== -1, 'card missing');
    must(r.ctx.indexOf('narrow job') < r.ctx.indexOf(vs.EUREKA_OPTIN_COPY), 'the card must follow the insight');
    const s = stateOf(w.home);
    must(s.insight.pending === false && s.insight.delivered_for_version === V && s.eureka_optin_shown_for_version === V, JSON.stringify(s));
  });

  await arm('a card the model rendered is marked shown by gate_render, so Desktop is not nagged on the next session', async () => {
    const w = world();
    const handlers = gateHarness();
    seed({ last_seen_version: V, local: { ok: true } });
    // A distinct gate id: the in-process ledger keeps this open gate for the rest of the run.
    await mintCard(handlers, '9.9.9-shown-marker');
    must(stateOf(w.home).eureka_optin_shown_for_version === V, 'gate_render did not mark the card shown');
  });

  await arm('never an ASCII box: the verbatim SEED-021 clause, no box-drawing characters, no run of three dashes or equals', () => {
    const w = world();
    seed({ last_seen_version: V, local: { ok: true } });
    setRouterPhase(w, 'done');
    const ctx = runRouter(w).ctx;
    must(ctx && ctx.indexOf('do not reproduce this block as text (SEED-021)') !== -1, 'SEED-021 clause missing');
    must(!/[─-╿]/.test(ctx), 'box-drawing character present');
    must(!/-{3,}|={3,}/.test(ctx), 'a run of three dashes or equals present');
    must(ctx.indexOf('gate_render') !== -1 && ctx.indexOf('gate_answer') !== -1, 'the card tools are not named');
  });

  await arm('defers, does not drop: no card while the reward owns the turn, retries count, no record; the card lands on the next turn of the SAME session', () => {
    const w = world();
    seed({ last_seen_version: V, local: { ok: true } });
    setRouterPhase(w, 'routed');
    markOnboarded(w);
    const a = runRouter(w, 'sess-A');
    must(a.ctx === null, 'card fired during the reward: ' + a.stdout);
    let s = stateOf(w.home);
    must(s.eureka_optin_defer_retries === 1 && s.eureka_optin === undefined, JSON.stringify(s));
    setRouterPhase(w, 'done');
    const b = runRouter(w, 'sess-A');
    must(b.ctx && b.ctx.indexOf(vs.EUREKA_OPTIN_COPY) !== -1, 'the card did not land on the next turn: ' + b.stdout);
  });

  await arm('the defer bound: at the bound the card is not shown and no record is written; a NEW session re-evaluates from scratch', () => {
    const w = world();
    seed({ last_seen_version: V, local: { ok: true }, eureka_optin_defer_session: 'sess-W', eureka_optin_defer_retries: 8 });
    setRouterPhase(w, 'routed');
    markOnboarded(w);
    const wedged = runRouter(w, 'sess-W');
    must(wedged.ctx === null, 'card fired past the bound');
    let s = stateOf(w.home);
    must(s.eureka_optin === undefined && s.eureka_optin_defer_retries === 8, JSON.stringify(s));
    const fresh = runRouter(w, 'sess-NEW');
    must(fresh.ctx === null, 'card fired during the reward in a new session');
    s = stateOf(w.home);
    must(s.eureka_optin_defer_session === 'sess-NEW' && s.eureka_optin_defer_retries === 1, 'a new session did not restart the count: ' + JSON.stringify(s));
  });

  await arm('installedNow short-circuits: an installed stack never asks, and nothing is marked shown', () => {
    const w = world();
    installFixture(w.deps);
    seed({ last_seen_version: V, local: { ok: true } });
    setRouterPhase(w, 'done');
    const r = runRouter(w);
    must(r.stdout.trim() === '{"continue":true}', 'card for an installed stack: ' + r.stdout);
    must(stateOf(w.home).eureka_optin_shown_for_version === undefined, 'marked shown for an installed stack');
  });

  await arm('the three answers through gate_answer: not_now -> declined, never -> never, install ok -> installed, install failed -> declined plus the honest failure, never installed', async () => {
    const w = world();
    answersHome = w.home;
    const handlers = gateHarness();
    const eurekaEnable = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-enable.cjs'));
    const original = eurekaEnable.enableEureka;
    try {
      seed({ last_seen_version: V, local: { ok: true } });

      let card = await mintCard(handlers, V);
      let j = jsonOf(await handlers.get('gate_answer')({ gate_id: card.gate_id, chosen: [OPT('declined')], verdict: 'approve' }, {}));
      must(j && j.ok === true && j.eureka_optin === 'declined', JSON.stringify(j));
      let rec = stateOf(w.home).eureka_optin;
      must(rec.choice === 'declined' && rec.version === V, JSON.stringify(rec));

      card = await mintCard(handlers, V);
      j = jsonOf(await handlers.get('gate_answer')({ gate_id: card.gate_id, chosen: [OPT('never')], verdict: 'approve' }, {}));
      must(j && j.ok === true && j.eureka_optin === 'never', JSON.stringify(j));
      must(stateOf(w.home).eureka_optin.choice === 'never', 'never not recorded');

      let sawSkip = null;
      eurekaEnable.enableEureka = async (o) => { sawSkip = o && o.skipOptinRecord; return { ok: true, alreadyInstalled: false, message: 'installed (fixture)', durationMs: 5 }; };
      card = await mintCard(handlers, V);
      j = jsonOf(await handlers.get('gate_answer')({ gate_id: card.gate_id, chosen: [OPT('installed')], verdict: 'approve' }, {}));
      must(j && j.ok === true && j.eureka_optin === 'installed' && j.installed === true, JSON.stringify(j));
      must(sawSkip === true, 'the recorder did not pass skipOptinRecord');
      must(stateOf(w.home).eureka_optin.choice === 'installed', 'installed not recorded');

      eurekaEnable.enableEureka = async () => ({ ok: false, alreadyInstalled: false, message: 'the install did not land', stderrTail: 'ENOTFOUND registry', durationMs: 5 });
      card = await mintCard(handlers, V);
      j = jsonOf(await handlers.get('gate_answer')({ gate_id: card.gate_id, chosen: [OPT('installed')], verdict: 'approve' }, {}));
      must(j && j.ok === true && j.installed === false && j.eureka_optin === 'declined', JSON.stringify(j));
      rec = stateOf(w.home).eureka_optin;
      must(rec.choice === 'declined' && rec.install_failed === true && /ENOTFOUND/.test(rec.install_failure_reason), JSON.stringify(rec));
      must(rec.choice !== 'installed', 'a failed install was recorded as installed');
    } finally {
      eurekaEnable.enableEureka = original;
    }
  });

  await arm('the aborted-call degradation: a thrown install records nothing and the card still asks next time', async () => {
    const w = world();
    const handlers = gateHarness();
    const eurekaEnable = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-enable.cjs'));
    const original = eurekaEnable.enableEureka;
    try {
      seed({ last_seen_version: V, local: { ok: true } });
      eurekaEnable.enableEureka = async () => { throw new Error('host aborted the call'); };
      const card = await mintCard(handlers, V);
      const j = jsonOf(await handlers.get('gate_answer')({ gate_id: card.gate_id, chosen: [OPT('installed')], verdict: 'approve' }, {}));
      must(j && j.ok === false && j.reason === 'optin_record_failed', JSON.stringify(j));
      const s = stateOf(w.home);
      must(s.eureka_optin === undefined, 'a record was written: ' + JSON.stringify(s.eureka_optin));
      must(vs.shouldAskEurekaOptin({ installedNow: false, state: s, currentVersion: V, firstInstallRewardPending: false }).ask === true, 'the card would not ask again');
    } finally {
      eurekaEnable.enableEureka = original;
    }
  });

  await arm('no room needed: every answer above ran with no room bound and no room.db anywhere', () => {
    must(answersHome !== null && fs.existsSync(answersHome), 'the answers world is missing');
    must(!fs.existsSync(path.join(answersHome, 'rooms')), 'a rooms home exists');
    const found = [];
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p); else if (e.name === 'room.db') found.push(p);
      }
    }(answersHome));
    must(found.length === 0, 'room.db found: ' + found.join(', '));
  });

  await arm('a non-reserved gate id is untouched: it still reaches the room resolution and writes no opt-in record', async () => {
    const w = world();
    const handlers = gateHarness();
    seed({ last_seen_version: V, local: { ok: true } });
    const r = await handlers.get('gate_render')({ gate_id: 'plain-gate-1', header: 'Which one?', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, {});
    must(jsonOf(r).ok === true, 'plain mint failed');
    const j = jsonOf(await handlers.get('gate_answer')({ gate_id: 'plain-gate-1', chosen: ['a'], verdict: 'approve' }, {}));
    must(j && j.ok === false && typeof j.reason === 'string' && j.reason !== 'optin_card_mismatch', 'a plain gate did not take the existing path: ' + JSON.stringify(j));
    must(stateOf(w.home).eureka_optin === undefined, 'a plain gate wrote an opt-in record');
  });

  await arm('a look-alike card under the reserved prefix cannot trigger an install (the locked copy is required)', async () => {
    const w = world();
    const handlers = gateHarness();
    const eurekaEnable = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-enable.cjs'));
    const original = eurekaEnable.enableEureka;
    let called = false;
    try {
      eurekaEnable.enableEureka = async () => { called = true; return { ok: true }; };
      seed({ last_seen_version: V, local: { ok: true } });
      const id = vs.EUREKA_OPTIN_GATE_PREFIX + 'forged';
      await handlers.get('gate_render')({ gate_id: id, header: 'Install the thing?', options: vs.EUREKA_OPTIN_OPTIONS.map((o) => ({ id: o.id, label: o.label })) }, {});
      const j = jsonOf(await handlers.get('gate_answer')({ gate_id: id, chosen: [OPT('installed')], verdict: 'approve' }, {}));
      must(j && j.ok === false && j.reason === 'optin_card_mismatch', JSON.stringify(j));
      must(called === false, 'the installer ran for a forged card');
    } finally {
      eurekaEnable.enableEureka = original;
    }
    void w;
  });

  await arm('/mos:eureka enable clears never: a successful enable records installed and the card stops asking', async () => {
    const w = world();
    installFixture(w.deps);
    seed({ last_seen_version: V, local: { ok: true }, eureka_optin: { choice: 'never', version: V, at: 1 } });
    const eurekaEnable = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-enable.cjs'));
    const result = await eurekaEnable.enableEureka({});
    must(result.ok === true && result.alreadyInstalled === true, 'the idempotent probe did not short-circuit: ' + JSON.stringify(result));
    const s = stateOf(w.home);
    must(s.eureka_optin.choice === 'installed' && s.eureka_optin.version === V, JSON.stringify(s.eureka_optin));
    const v = vs.shouldAskEurekaOptin({ installedNow: false, state: s, currentVersion: V, firstInstallRewardPending: false });
    must(v.ask === false && v.reason === 'already_installed', JSON.stringify(v));
  });

  await arm('skipOptinRecord is honored: the never record is untouched', async () => {
    const w = world();
    installFixture(w.deps);
    seed({ last_seen_version: V, local: { ok: true }, eureka_optin: { choice: 'never', version: V, at: 1 } });
    const eurekaEnable = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-enable.cjs'));
    await eurekaEnable.enableEureka({ skipOptinRecord: true });
    must(stateOf(w.home).eureka_optin.choice === 'never', 'skipOptinRecord was ignored');
  });

  await arm('Canon Part 8 and (g): a planted room sentinel appears in neither the instruction, the card, nor the state file; the recorder has no network token', () => {
    const w = world();
    const room = mk('mos-341-card-room-');
    fs.writeFileSync(path.join(room, 'STATE.md'), '# State ' + SENTINEL + '\n', 'utf8');
    fs.writeFileSync(path.join(room, 'ROOM.md'), '# Room ' + SENTINEL + '\n', 'utf8');
    seed({ last_seen_version: V, local: { ok: true } });
    setRouterPhase(w, 'done');
    const r = runRouter(w, 's1', { CLAUDE_ACTIVE_ROOM: room });
    must(r.ctx, 'no card');
    must(r.ctx.indexOf(SENTINEL) === -1 && r.ctx.indexOf(room) === -1, 'room content in the instruction');
    must(fs.readFileSync(path.join(w.home, '.mindrian', 'session-verify', 'state.json'), 'utf8').indexOf(SENTINEL) === -1, 'sentinel in the state file');
    const card = JSON.stringify(vs.buildEurekaOptinCard(V));
    must(card.indexOf(SENTINEL) === -1 && card.indexOf(room) === -1, 'room content in the card');
    const gateSrc = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'), 'utf8');
    const a = gateSrc.indexOf('async function _answerEurekaOptin');
    const b = gateSrc.indexOf('function register(server, ctx)');
    const body = gateSrc.slice(a, b).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    must(!/https?|fetch|spawn|child_process/.test(body), 'a network or spawn token in the recorder');
  });

  await arm('room_list: byte-identical when no card is due; exactly one extra top-level key, eureka_optin, when it is', async () => {
    const w = world();
    const { captureToolServer } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-354.cjs'));
    const { server, handlers } = captureToolServer();
    server.registerResource = server.registerResource || function () {};
    require(path.join(REPO, 'lib', 'mcp', 'tools', 'room.cjs')).register(server, {});
    const listRoomRoots = require(path.join(REPO, 'lib', 'core', 'icm-forest.cjs')).listRoomRoots;

    seed({ last_seen_version: V, local: { ok: true }, eureka_optin: { choice: 'never', version: V, at: 1 } });
    const quiet = await handlers.get('room_list')({});
    const quietJson = JSON.parse(quiet.content[0].text);
    require('node:assert').deepStrictEqual(quietJson, listRoomRoots());
    require('node:assert').deepStrictEqual(quiet.structuredContent, listRoomRoots());
    must(JSON.stringify(Object.keys(quietJson).sort()) === JSON.stringify(['home', 'rooms']), 'keys ' + Object.keys(quietJson));

    seed({ last_seen_version: V, local: { ok: true } });
    const loud = JSON.parse((await handlers.get('room_list')({})).content[0].text);
    const extra = Object.keys(loud).filter((k) => k !== 'home' && k !== 'rooms');
    must(JSON.stringify(extra) === JSON.stringify(['eureka_optin']), 'extra keys ' + extra);
    must(loud.home === quietJson.home && JSON.stringify(loud.rooms) === JSON.stringify(quietJson.rooms), 'home or rooms changed');
    must(loud.eureka_optin.card.gate_id === vs.EUREKA_OPTIN_GATE_PREFIX + V, 'card gate id');
    must(loud.eureka_optin.instruction.indexOf('Install now') !== -1, 'instruction lacks the labels');
    must(loud.eureka_optin.instruction.indexOf('eureka-enable.cjs') === -1, 'the mcp instruction promises a shell');
    // room_list is a pure read: it wrote no shown marker.
    must(stateOf(w.home).eureka_optin_shown_for_version === undefined, 'room_list wrote a marker');
  });

  await arm('zero real install: no @huggingface directory was created under any temp deps root of this run', () => {
    for (const d of depsRoots) {
      const hf = path.join(d, 'node_modules', '@huggingface');
      // Only the explicit installFixture trees may hold one, and only the package.json stub.
      if (fs.existsSync(hf)) {
        const stub = path.join(hf, 'transformers');
        const entries = fs.readdirSync(hf);
        must(entries.length === 1 && entries[0] === 'transformers', 'unexpected @huggingface content: ' + entries.join(','));
        const files = fs.readdirSync(stub);
        must(files.length === 1 && files[0] === 'package.json', 'a real package landed: ' + files.join(','));
      }
    }
  });

  for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
  console.log('\neureka-optin-card: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
})();
