#!/usr/bin/env node
'use strict';
// Phase 400.4 plan 11 (success criterion 10): the cold-start replay. One synthetic room of the shape of the QA room
// (431 notes, 3,830 proposed claims, 0 SUPPORTS edges, one section with 27 inbound BELONGS_TO and none outbound, 72
// unlinked notes) is driven through the real registered tool handlers and the real hook CLIs.
//
// Legs (one ok line each):
//   A1  F1  suggest_next with no goal job offers 19 plain jobs (label and sentence)
//   A2  F1  the goal card shows 'Set this job: <label>' and the sentence; gate_answer writes the goal
//   A3a F2  a mapped goal job (find-problem) picks the nest: nest_source goal_job_map
//   A3b F2  an unmapped goal job (prepare-pitch) gets a room-level move: nest_source goal_job_room_level
//   A4  F10 F3  cause_effect_domain cards carry descriptions; stored complex adds domain_note; moves unchanged
//   A5  F4  advisor on: alternatives follow the advisor options
//   A6  F6  context_assemble caps the cortex leg; the estimate is within 5 percent of the real reply
//   A7  F7  the neighbourhood of the hub section returns its 27 notes (inbound edges)
//   A8  F8  whitespace_scan counts the 3,830 unratified claims and the 72 isolated notes
//   A9  F5  composeWorkflow resolves a spelling variant and flags an unknown name
//   A10 F9  eureka_graph_project carries the file text of 50 notes
//   A11 F11 part A: four hook CLIs exit 0 within 3,000 ms under a 10 s room.db lock
//   A13 F12 the hook block, the cue and suggest_next name the same move for the session's own room
// There is no leg A12: it covered the one-process dispatcher, which moved to Phase 400.5 (CONTEXT ADDENDUM 4).
//
// HOME and MINDRIAN_ROOMS_HOME point at temp dirs for the whole run. No network. Node built-ins only. Hyphens only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');

const T_START = Date.now();
const ROOT = path.resolve(__dirname, '..');

// The whole run lives under temp dirs, set before any module that resolves rooms is loaded.
const BOOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-4-replay-boot-'));
process.env.HOME = path.join(BOOT, 'home');
process.env.USERPROFILE = process.env.HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(BOOT, 'rooms');
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
delete process.env.MINDRIAN_DECISION_ADVISOR;
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.on('exit', () => { try { fs.rmSync(BOOT, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

const H = require('./helpers/isolated-home-36925.cjs');
const { buildColdStartRoom } = require('./fixtures/400.4/build-cold-start-room.cjs');

let passed = 0;
let failed = 0;
async function leg(label, fn) {
  try { await fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 7).join(' | ')); }
}
const measure = (s) => console.log('  measured: ' + s);

function fakeServer(inner) {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
      registerTool(name, _c, handler) { registered.push({ name, handler }); },
      server: inner,
    },
  };
}
const pick = (f, name) => f.registered.find((r) => r.name === name).handler;
const strip = (c) => String(c).replace(/^\/mos:/, '');

const rand = Math.random().toString(36).slice(2);
const SESSION_B = 'replay-b-' + Date.now() + '-' + rand;
const SESSION_A = 'replay-a-' + Date.now() + '-' + rand;
const SESSION_11 = 'replay-a11-' + Date.now() + '-' + rand;
const SESSION_13 = 'replay-a13-' + Date.now() + '-' + rand;

async function main() {
  // ---- the QA-shaped room (room B) and the isolated home ------------------------------------------------------
  const iso = H.mkIsolatedHome('400.4-replay');
  const real = require('node:os').userInfo().homedir;
  assert.ok(!path.resolve(iso.home).startsWith(path.join(real, 'MindrianRooms')), 'the replay home is not the real rooms home');
  assert.ok(path.resolve(iso.roomsHome).startsWith(os.tmpdir() + path.sep), 'the rooms home is a temp dir');
  const fx = buildColdStartRoom({ iso, slug: 'cold-start-qa' });
  const roomDir = fx.roomDir;
  console.log('fixture built in ' + fx.buildMs + ' ms: ' + fx.ids.notes.length + ' notes, ' + fx.ids.claims.length + ' claims, hub section ' + fx.ids.hubSection + ', ' + fx.ids.unlinked.length + ' unlinked');
  assert.equal(fx.ids.notes.length, 431);
  assert.equal(fx.ids.claims.length, 3830);
  assert.equal(fx.ids.unlinked.length, 72);

  const binding = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'));
  const bind = (sid, slug) => {
    const b = binding.writeSessionBinding(sid, { bound: [slug], primary: slug, sticky: false }, { home: iso.roomsHome });
    if (!b || b.ok !== true) throw new Error('session binding failed: ' + JSON.stringify(b));
  };
  bind(SESSION_B, fx.slug);

  const registry = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const roomDbLib = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  const VOC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'job-vocabulary.json'), 'utf8'));
  const CYN = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cynefin-domains.json'), 'utf8'));

  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const gate = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const contextTool = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'context.cjs'));
  const eurekaTool = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'eureka-graph-projection.cjs'));

  // Tools for one room and its session. The caller's session binding picks the room; the fallback room is the same one.
  function toolsFor(dir, sid) {
    const inner = { getClientCapabilities() { return {}; } };
    const s = fakeServer(inner);
    sensors.register(s.server, { fallbackRoomDir: dir });
    const g = fakeServer(inner);
    gate.register(g.server, { fallbackRoomDir: dir });
    const c = fakeServer(inner);
    contextTool.register(c.server, { fallbackRoomDir: dir, pluginRoot: ROOT, surface: 'cli' });
    const e = fakeServer(inner);
    eurekaTool.register(e.server, {});
    const run = async (handler, args) => {
      const res = await handler(args || {}, { sessionId: sid });
      return { res, text: res.content && res.content[0] ? res.content[0].text : '' };
    };
    const json = async (handler, args) => JSON.parse((await run(handler, args)).text);
    return {
      suggest: (args) => json(pick(s, 'suggest_next'), args),
      whitespace: (args) => json(pick(s, 'whitespace_scan'), args),
      render: (args) => json(pick(g, 'gate_render'), args),
      answer: (args) => json(pick(g, 'gate_answer'), args),
      context: (args) => run(pick(c, 'context_assemble'), args),
      eureka: async (args) => (await pick(e, 'eureka_graph_project')(args || {}, { sessionId: sid })).structuredContent,
    };
  }
  const B = toolsFor(roomDir, SESSION_B);
  // The three room.db hooks drain the registry's active room, so a leg sets which room is active.
  const regPath = path.join(iso.roomsHome, '.rooms', 'registry.json');
  const setActive = (slug) => {
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    reg.active = slug;
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
  };

  const goalCard = (job) => [{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: job }) }, { id: 'defer', label: 'Not now' }];
  async function setGoal(T, dir, job) {
    const r = await T.render({ header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'], options: goalCard(job) });
    assert.equal(r.ok, true, JSON.stringify(r));
    const done = await T.answer({ gate_id: r.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.equal(done.strategy_ratification.goal_written, true, JSON.stringify(done.strategy_ratification));
    assert.equal(jtbdState.getGoal(dir).jtbd, job);
    return r;
  }

  // ---- A1 -----------------------------------------------------------------------------------------------------
  await leg('A1 (F1) suggest_next with no goal job offers 19 plain jobs with label and sentence', async () => {
    assert.equal(jtbdState.getGoal(roomDir), null);
    const r = await B.suggest();
    const g = r.goal_job;
    assert.ok(g, 'a goal_job block is in the reply');
    assert.equal(g.state, 'not_set');
    assert.equal(g.offers.length, 19);
    assert.equal(g.offer_ids.length, 19);
    assert.deepEqual(g.offers.map((o) => o.id), g.offer_ids);
    for (const o of g.offers) {
      assert.deepEqual(Object.keys(o).sort(), ['id', 'label', 'sentence'], o.id);
      assert.equal(o.label, VOC.jobs[o.id].summary, o.id);
      assert.equal(o.sentence, VOC.jobs[o.id].sentence, o.id);
    }
    measure('goal_job.offers ' + g.offers.length + ', offer_ids ' + g.offer_ids.length);
  });

  // ---- A2 -----------------------------------------------------------------------------------------------------
  const JOB = 'find-problem';
  await leg('A2 (F1) the goal card shows the plain label and sentence; gate_answer writes the goal', async () => {
    const offer = registry.jobOffer(JOB);
    const want = 'Set this job: ' + offer.label.replace(/\.$/, '');
    const r = await B.render({ header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'], options: goalCard(JOB) });
    assert.equal(r.ok, true, JSON.stringify(r));
    const set = r.card.options.find((o) => o.id === 'rewrite-jtbd');
    assert.equal(set.label, want);
    assert.equal(set.description, offer.sentence);
    assert.ok(JSON.stringify(r).indexOf(want) !== -1 && JSON.stringify(r).indexOf(offer.sentence) !== -1, 'the text rung shows label and sentence');
    const done = await B.answer({ gate_id: r.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.equal(done.strategy_ratification.goal_written, true);
    assert.equal(jtbdState.getGoal(roomDir).jtbd, JOB);
    measure('label "' + want + '"');
  });

  // ---- A3a ----------------------------------------------------------------------------------------------------
  let a3a = null;
  await leg('A3a (F2) a mapped goal job picks the nest: goal_job_map, problem-definition', async () => {
    const r = await B.suggest();
    a3a = r;
    assert.ok(r.next_move.primary, JSON.stringify(r.next_move));
    assert.equal(r.nest_source, 'goal_job_map');
    assert.equal(r.nest_section, 'problem-definition');
    measure('primary ' + r.next_move.primary.command + ', alternatives ' + r.next_move.alternatives.map((a) => a.command).join(','));
  });

  // ---- A3b: a second, small born room in the same isolated home -------------------------------------------------
  const PITCH = 'prepare-pitch';
  const small = H.birthFixtureRoom({ iso, slug: 'small-pitch', vname: 'Quokka Labs', ventureText: 'Quokka Labs pitch room', sessionId: 'replay-birth-small' });
  if (!small || small.ok !== true) throw new Error('small room birth failed: ' + JSON.stringify(small));
  const smallDir = fs.realpathSync(small.roomDir);
  bind(SESSION_A, 'small-pitch');
  const A = toolsFor(smallDir, SESSION_A);
  let a3b = null;
  await leg('A3b (F2) an unmapped goal job gets a room-level move: goal_job_room_level, advisor flag unset', async () => {
    assert.equal(process.env.MINDRIAN_DECISION_ADVISOR, undefined);
    await setGoal(A, smallDir, PITCH);
    const r = await A.suggest();
    a3b = r;
    assert.ok(r.next_move.primary, JSON.stringify(r.next_move));
    assert.equal(r.next_move_source, 'room_level');
    assert.equal(r.nest_source, 'goal_job_room_level');
    assert.equal(r.next_move.room_level_source, 'decision_advisor_table');
    const SL = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'shortlist.cjs'));
    const cap = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs'));
    const runnableOnMcp = (name) => { try { const c = cap.capabilityFor(name, { kind: 'command' }); return !!(c && c.known !== false && c.mcp === 'runnable'); } catch (_e) { return false; } };
    const row = SL.rowForJob(PITCH);
    const first = row.map((x) => x.command.replace(/^\/mos:/, '')).find(runnableOnMcp);
    assert.ok(first, 'the row of ' + PITCH + ' has a runnable command');
    assert.equal(strip(r.next_move.primary.command), first);
    assert.equal(process.env.MINDRIAN_DECISION_ADVISOR, undefined);
    measure('room-level primary ' + r.next_move.primary.command);
  });

  // ---- A4 -----------------------------------------------------------------------------------------------------
  await leg('A4 (F10, F3) cause_effect_domain cards carry descriptions; complex adds a note; moves unchanged', async () => {
    const S1 = CYN.card.stages[0].options;
    const S2 = CYN.card.stages[1].options;
    const opts = (list) => list.map((o) => ({ id: o.id, label: 'caller label', description: 'caller text' }));
    const r1 = await B.render({ kind: 'cause_effect_domain', header: 'caller header', options: opts(S1) });
    assert.equal(r1.ok, true, JSON.stringify(r1));
    assert.equal(r1.card.options.length, 4);
    assert.equal(r1.card.recommended, null);
    for (const o of r1.card.options) {
      const src = S1.find((x) => x.id === o.id);
      assert.ok(o.description && o.description === src.description, o.id);
    }
    const a1 = await B.answer({ gate_id: r1.gate_id, chosen: ['ce-nobody'], verdict: 'approve' });
    assert.equal(a1.ok, true, JSON.stringify(a1));
    assert.equal(a1.cause_effect.written, false);
    assert.equal(a1.cause_effect.follow_up.stage, 2);
    const r2 = await B.render({ kind: 'cause_effect_domain', options: opts(S2) });
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(r2.card.recommended, null);
    for (const o of r2.card.options) assert.ok(o.description, o.id);
    const a2 = await B.answer({ gate_id: r2.gate_id, chosen: ['ce-probe'], verdict: 'approve' });
    assert.equal(a2.ok, true, JSON.stringify(a2));
    assert.deepEqual(a2.cause_effect, { ok: true, written: true, domain: 'complex' });
    const r = await B.suggest();
    const note = r.next_move.domain_note;
    assert.ok(note && note.indexOf('complex') !== -1 && note.indexOf('probe, then sense, then respond') !== -1, String(note));
    assert.deepEqual(r.next_move.primary, a3a.next_move.primary);
    assert.deepEqual(r.next_move.alternatives, a3a.next_move.alternatives);
    measure('domain_note "' + note + '"');
  });

  // ---- A5 -----------------------------------------------------------------------------------------------------
  await leg('A5 (F4) advisor on: the alternatives follow the advisor options, then the ledger order', async () => {
    const prev = process.env.MINDRIAN_DECISION_ADVISOR;
    process.env.MINDRIAN_DECISION_ADVISOR = 'on';
    let on;
    try { on = await B.suggest(); } finally { if (prev === undefined) delete process.env.MINDRIAN_DECISION_ADVISOR; else process.env.MINDRIAN_DECISION_ADVISOR = prev; }
    const adv = on.next_move.advisor;
    const primary = on.next_move.primary && strip(on.next_move.primary.command);
    const alts = on.next_move.alternatives.map((a) => strip(a.command));
    if (adv && Array.isArray(adv.options) && adv.options.length > 0 && (adv.state === 'ok' || adv.state === 'no_strong_pick')) {
      const opt = adv.options.map((o) => strip(o.command)).filter((c) => c !== primary);
      const want = opt.slice(0, 2);
      assert.deepEqual(alts.slice(0, want.length), want, 'alternatives start with the advisor options; got ' + alts.join(',') + ' want ' + want.join(','));
      measure('advisor state ' + adv.state + ', options ' + adv.options.map((o) => strip(o.command)).join(',') + ', alternatives ' + alts.join(','));
    } else {
      console.log('  note: the advisor has no options for this job (state ' + (adv && adv.state) + '); the advisor-off order is checked instead');
      const off = await B.suggest();
      assert.deepEqual(off.next_move.alternatives, a3a.next_move.alternatives);
    }
    const off2 = await B.suggest();
    assert.deepEqual(off2.next_move.primary, a3a.next_move.primary, 'advisor off again: the primary is as before');
    assert.deepEqual(off2.next_move.alternatives, a3a.next_move.alternatives, 'advisor off again: the alternatives are as before');
  });

  // ---- A6 -----------------------------------------------------------------------------------------------------
  await leg('A6 (F6) context_assemble caps the cortex leg; the estimate is within 5 percent of the real reply', async () => {
    const est = await B.context({ estimate_only: true });
    const estBody = JSON.parse(est.text);
    assert.equal(estBody.ok, true, est.text.slice(0, 300));
    const realRes = await B.context({});
    const body = JSON.parse(realRes.text);
    assert.equal(body.ok, true, realRes.text.slice(0, 300));
    assert.ok(Array.isArray(body.cortexNodes) && body.cortexNodes.length <= 40, 'cortexNodes ' + (body.cortexNodes && body.cortexNodes.length));
    assert.ok(body._meta.omitted.some((e) => e.leg === 'legD' && e.reason === 'top_k_cap'), JSON.stringify(body._meta.omitted));
    assert.ok(body._meta.cortexTotal >= 3830, 'cortexTotal ' + body._meta.cortexTotal);
    const realBytes = Buffer.byteLength(realRes.text, 'utf8');
    const estimate = estBody._meta.reply_bytes_estimate;
    assert.equal(typeof estimate, 'number');
    assert.ok(Math.abs(estimate - realBytes) / realBytes <= 0.05, 'estimate ' + estimate + ' real ' + realBytes);
    measure('reply bytes ' + realBytes + ', estimate ' + estimate + ' (' + (100 * Math.abs(estimate - realBytes) / realBytes).toFixed(2) + ' percent), cortexNodes ' + body.cortexNodes.length + ', cortexTotal ' + body._meta.cortexTotal);
  });

  // ---- A7 -----------------------------------------------------------------------------------------------------
  await leg('A7 (F7) the neighbourhood of the hub section returns its 27 notes with inbound edges', async () => {
    const db = roomDbLib.openRoomDb(roomDir);
    try {
      const rows = navigation.getNeighborhood(db, fx.ids.hubSection, { maxDepth: 1, topK: 50 });
      const notes = rows.filter((x) => x.directionIn === 'in');
      assert.equal(notes.length, 27, 'inbound rows ' + notes.length + ' of ' + rows.length);
      assert.equal(rows.length, 27);
      for (const r of notes) assert.ok(fx.ids.notes.includes(r.id), r.id);
      measure('neighbourhood rows ' + rows.length + ' of the hub section ' + fx.ids.hubSection);
    } finally { roomDbLib.closeRoomDb(db); }
    const ctx = await B.context({ focus_node_id: fx.ids.hubSection });
    const body = JSON.parse(ctx.text);
    assert.equal(body.ok, true, ctx.text.slice(0, 300));
    assert.ok(Array.isArray(body.relevantNodes) && body.relevantNodes.length > 0, 'relevantNodes ' + JSON.stringify(Object.keys(body)));
    measure('context_assemble relevantNodes ' + body.relevantNodes.length);
  });

  // ---- A8 -----------------------------------------------------------------------------------------------------
  await leg('A8 (F8) whitespace_scan counts the 3,830 unratified claims and the 72 isolated notes', async () => {
    const w = await B.whitespace();
    assert.equal(w.ok, true, JSON.stringify(w).slice(0, 300));
    assert.equal(w.unratified_unsupported.count, 3830);
    assert.equal(w.unratified_unsupported.ids.length, 20);
    assert.equal(w.isolated_artifacts.count, 72);
    assert.equal(w.isolated_artifacts.ids.length, 20);
    for (const id of w.isolated_artifacts.ids) assert.ok(fx.ids.unlinked.includes(id), id);
    assert.deepEqual(w.unsupported_claims, []);
    assert.equal(w.gap_count, w.open_questions.length);
    measure('unratified_unsupported ' + w.unratified_unsupported.count + ', isolated_artifacts ' + w.isolated_artifacts.count + ', gap_count ' + w.gap_count);
  });

  // ---- A9 -----------------------------------------------------------------------------------------------------
  await leg('A9 (F5) composeWorkflow resolves a spelling variant and flags an unknown name', async () => {
    const resolver = require(path.join(ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
    assert.equal(resolver.composeWorkflow(['Beautiful Question'])[0].command, '/mos:beautiful-question');
    const u = resolver.composeWorkflow(['Not A Real Framework 400'])[0];
    assert.equal(u.unresolved, true);
    assert.equal(u.reason, 'unknown_framework_name');
  });

  // ---- A10 ----------------------------------------------------------------------------------------------------
  await leg('A10 (F9) eureka_graph_project carries the file text of 50 notes', async () => {
    const ids50 = fx.ids.notes.slice(0, 50);
    const r = await B.eureka({ node_ids: ids50 });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
    assert.equal(r.projection_omissions.empty_text_nodes, 0);
    assert.equal(r.text_from_file.nodes, 50);
    assert.equal(r.snapshot.nodes.length, 50);
    let longest = 0;
    for (const n of r.snapshot.nodes) { assert.ok(n.text.length > 0 && n.text.length <= 4000, n.id + ' ' + n.text.length); longest = Math.max(longest, n.text.length); }
    measure('text_from_file.nodes ' + r.text_from_file.nodes + ', empty_text_nodes ' + r.projection_omissions.empty_text_nodes + ', longest text ' + longest);
  });

  // ---- A11: four hook CLIs under a 10 s room.db lock ------------------------------------------------------------
  await leg('A11 (F11 part A) four hook CLIs exit 0 within 3,000 ms under a 10 s room.db lock', async () => {
    const PROMPT = 'what should I work on next for this venture';
    setActive(fx.slug);
    const DB = path.join(roomDir, '.mindrian', 'room.db');
    fs.writeFileSync(path.join(roomDir, '.mindrian', 'auto-explore-f400411.json'), JSON.stringify({
      id: 'f400411', material_id: 'm400411', source_section: 'market-analysis', file_path_sha256: 'a'.repeat(64),
    }));
    const counts = () => {
      const { DatabaseSync } = require('node:sqlite');
      const d = new DatabaseSync(DB, { readOnly: true });
      try { return { nodes: d.prepare('SELECT COUNT(*) AS n FROM nodes').get().n, edges: d.prepare('SELECT COUNT(*) AS n FROM edges').get().n }; } finally { d.close(); }
    };
    // One open and close so pending WAL frames reach room.db before the first count.
    const q = navigation.openRoomDbForCaller(roomDir);
    if (q) navigation.closeRoomDbForCaller(q);
    const before = counts();

    const lockCode = [
      "const { DatabaseSync } = require('node:sqlite');",
      'const db = new DatabaseSync(process.argv[1], { timeout: 0 });',
      "db.exec('BEGIN IMMEDIATE');",
      "process.stdout.write('locked\\n');",
      'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.argv[2]));',
      "db.exec('ROLLBACK');",
      'db.close();',
    ].join('\n');
    const lock = spawn(process.execPath, ['-e', lockCode, DB, '10000'], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((resolve, reject) => {
      let buf = '';
      lock.stdout.on('data', (d) => { buf += d.toString(); if (buf.includes('locked')) resolve(); });
      lock.on('error', reject);
      lock.on('exit', () => { if (!buf.includes('locked')) reject(new Error('lock holder exited early')); });
    });
    const env = Object.assign({}, iso.env, { CLAUDE_PLUGIN_ROOT: ROOT, MINDRIAN_ROOM_DIR: roomDir, CLAUDE_USER_MESSAGE: PROMPT });
    delete env.MINDRIAN_DISABLE_MEMORY_EVENT;
    const stdin = JSON.stringify({ prompt: PROMPT, session_id: SESSION_11, cwd: roomDir, hook_event_name: 'UserPromptSubmit' });
    const HOOKS = [
      { name: 'brain-derivation-drain', script: 'scripts/brain-derivation-drain.cjs', args: [], writer: true },
      { name: 'jtbd-update userprompt', script: 'scripts/jtbd-update.cjs', args: ['userprompt'], writer: true },
      { name: 'auto-explore-drain', script: 'scripts/auto-explore-drain.cjs', args: [], writer: true },
      { name: 'intent-classifier', script: 'scripts/intent-classifier.cjs', args: [], writer: false },
    ];
    const runOne = (hk) => new Promise((resolve) => {
      const t0 = Date.now();
      const child = spawn(process.execPath, [path.join(ROOT, hk.script)].concat(hk.args), { env, cwd: roomDir, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, 9000);
      child.on('exit', (code, sig) => { clearTimeout(killer); resolve({ code: code === null ? 'signal:' + sig : code, ms: Date.now() - t0, stdout, stderr }); });
      child.stdin.end(stdin);
    });
    let results;
    try {
      results = await Promise.all(HOOKS.map(runOne));
    } finally {
      await new Promise((resolve) => { if (lock.exitCode !== null) return resolve(); lock.on('exit', () => resolve()); lock.kill('SIGKILL'); });
    }
    const failures = [];
    HOOKS.forEach((hk, i) => {
      const r = results[i];
      measure(hk.name + ' ' + r.ms + ' ms (exit ' + r.code + ')');
      if (r.code !== 0 || r.ms > 3000) failures.push(hk.name + ' exit ' + r.code + ' in ' + r.ms + ' ms: ' + r.stderr.slice(-200));
      if (hk.writer && !/room_db_busy/.test(r.stderr)) failures.push(hk.name + ' did not say room_db_busy: ' + r.stderr.slice(-200));
      if (!hk.writer) {
        if (!/^Voice reminder:/.test(r.stdout)) failures.push('intent-classifier stdout does not begin with "Voice reminder:": ' + r.stdout.slice(0, 120));
        console.log('  intent-classifier stderr ' + (/room_db_busy/.test(r.stderr) ? 'holds' : 'does not hold') + ' room_db_busy');
      }
    });
    const after = counts();
    if (before.nodes !== after.nodes || before.edges !== after.edges) failures.push('row counts changed: ' + JSON.stringify(before) + ' -> ' + JSON.stringify(after));
    measure('nodes ' + before.nodes + ' -> ' + after.nodes + ', edges ' + before.edges + ' -> ' + after.edges);
    assert.deepEqual(failures, []);
  });

  // ---- A13: one voice for the block, the cue and suggest_next ---------------------------------------------------
  await leg('A13 (F12) the hook block, the cue and suggest_next name the same move for the session\'s own room', async () => {
    const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
    const cache = require(path.join(ROOT, 'lib', 'statusline', 'next-move-cache.cjs'));
    // Room A is the small room (goal prepare-pitch); the registry active room is room B (the QA-shaped room).
    setActive(fx.slug);

    const primaryOf = (r) => strip(r.next_move.primary.command);
    const sgB = await B.suggest();
    let sgA = await A.suggest();
    let jobUsed = PITCH;
    if (primaryOf(sgA) === primaryOf(sgB)) {
      // Precondition: the two rooms must give different moves. Use another goal job with no canon section.
      const canon = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-job-canon.json'), 'utf8')).sections;
      const mapped = (id) => Object.keys(canon).some((s) => canon[s].job_id === id || canon[s].secondary_job_id === id);
      let found = false;
      for (const id of registry.JOB_VOCABULARY) {
        if (mapped(id) || id === PITCH) continue;
        await setGoal(A, smallDir, id);
        const t = await A.suggest();
        if (t.next_move.primary && primaryOf(t) !== primaryOf(sgB)) { sgA = t; jobUsed = id; found = true; break; }
      }
      assert.ok(found, 'a goal job of room A gives a move that differs from room B');
    }
    console.log('  room A goal job used: ' + jobUsed);
    const C = sgA.next_move.primary.command;
    const P = cache.shortJobPhrase(C, NM.jobWhenFor(C));
    assert.notEqual(primaryOf(sgA), primaryOf(sgB), 'precondition: the two rooms give different moves');
    assert.equal(sgA.nest_source, 'goal_job_room_level', 'suggest_next of room A: room-level nest');

    const env = Object.assign({}, iso.env, {
      MINDRIAN_ROOMS_ROOT: iso.roomsHome, MOS_NAV_TEST_DISABLE_DRAIN: '1', MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
      MINDRIAN_VOICE_REMINDER: '0', CLAUDE_PLUGIN_ROOT: ROOT,
    });
    delete env.MINDRIAN_NAV_NO_SUPPRESS;
    const t0 = Date.now();
    const hook = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'intent-classifier.cjs')], {
      input: JSON.stringify({ prompt: 'what should I work on next for this venture', session_id: SESSION_13, cwd: smallDir, hook_event_name: 'UserPromptSubmit' }),
      env, encoding: 'utf8', cwd: smallDir, timeout: 30000,
    });
    const ms = Date.now() - t0;
    measure('intent-classifier ' + ms + ' ms (exit ' + hook.status + ')');
    assert.equal(hook.status, 0, String(hook.stderr).slice(-300));
    const out = String(hook.stdout || '');

    // (1) the block names the move of room A, with its job phrase, and no line names room B.
    const line = (out.match(/^next_move: .*$/m) || [null])[0];
    assert.ok(line, 'a next_move line in the block: ' + out.slice(0, 500));
    const m = line.match(/^next_move: (?:\/mos:)?(\S+)(?: \| (.*))?$/);
    assert.ok(m, line);
    assert.equal(m[1], strip(C));
    assert.equal(m[2] || '', P);
    assert.ok(out.indexOf(fx.slug) === -1, 'no line of the block names room B');
    measure('block line "' + line + '"');

    // (2) the cue record holds room A, the move and its phrase; the statusline prints it.
    const rec = JSON.parse(fs.readFileSync(path.join(iso.home, '.mindrian', 'next-move', SESSION_13 + '.json'), 'utf8'));
    assert.equal(rec.room, 'small-pitch');
    assert.equal(strip(rec.command), strip(C));
    const wantCue = cache.formatMoveCue(C, NM.jobWhenFor(C));
    assert.equal(rec.next_move, wantCue);
    const mon = spawnSync('node', [path.join(ROOT, 'scripts', 'context-monitor')], {
      input: JSON.stringify({ session_id: SESSION_13, model: { display_name: 'Sonnet' }, workspace: { current_dir: iso.home }, context_window: { used_percentage: 10, remaining_percentage: 90, context_window_size: 200000 } }),
      cwd: iso.home, env, encoding: 'utf8', timeout: 20000,
    });
    const text = String(mon.stdout || '').replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(text.indexOf(wantCue) !== -1, 'the statusline holds "' + wantCue + '": ' + text.slice(0, 300));
    measure('cue "' + wantCue + '"');

    // (3) suggest_next of room A names the same move (checked above); (4) no trace for the session under room B.
    assert.ok(fs.existsSync(path.join(smallDir, '.mindrian', 'decision-traces', SESSION_13 + '.json')), 'the decision trace is under room A');
    assert.ok(!fs.existsSync(path.join(roomDir, '.mindrian', 'decision-traces', SESSION_13 + '.json')), 'no decision trace under room B');
  });

  const total = Date.now() - T_START;
  console.log('test-400.4-cold-start-replay: ' + passed + ' passed, ' + failed + ' failed, total run time ' + total + ' ms');
  if (total > 150000) { console.log('FAIL: run time above 150 s'); failed += 1; }
  try { fx.cleanup(); } catch (_e) { /* best effort */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.log('FAIL: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
