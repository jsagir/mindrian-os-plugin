#!/usr/bin/env node
'use strict';
// Phase 400.4 plan 09 (QA-F2, QA-F3): a set goal job picks the nest; a job with no canon section gets a room-level
// move; the stored domain is explained while the advisor is off; advisor options carry method_job.
//
// Legs G1 to G9 and R1 to R5:
//   G1 sectionsForJob (canon rank order, two tiers)          G2 goal find-problem picks problem-definition
//   G3 understand-market falls to competitive-analysis       G4 mapped sections all absent: no_active_nest + detail
//   G5 section argument wins; no goal job keeps the base     G6 domain_note with the advisor off, moves unchanged
//   G7 no note without a domain or with the advisor on       G8 note on the none paths and the room-level path
//   G9 method_job on advisor options, no raw number
//   R1 rowForJob (flag independent)                          R2 prepare-pitch gets a room-level move
//   R3 table without the row: command registry fallback      R4 no runnable command: no_active_nest + detail
//   R5 the flag stays unset, no calibrated number
// Real registered handlers on a fake server, a born fixture room under an isolated home. No network.
// Node built-ins only. Hyphens only in this file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const SESSION = 'test-4004-09-' + Date.now() + '-' + Math.random().toString(36).slice(2);
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
async function leg(label, fn) {
  try { await fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join(' | ')); }
}

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

async function call(handler, args) {
  const res = await handler(args, { sessionId: SESSION });
  return JSON.parse(res.content[0].text);
}

function goalCard(job) {
  return [{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: job }) }, { id: 'defer', label: 'Not now' }];
}

const ENV_KEYS = ['MINDRIAN_DECISION_ADVISOR', 'MINDRIAN_DECISION_ADVISOR_TABLE'];
function withEnv(env, fn) {
  const saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; if (Object.prototype.hasOwnProperty.call(env, k)) { if (env[k] === null) delete process.env[k]; else process.env[k] = env[k]; } }
  const restore = () => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
  let out;
  try { out = fn(); } catch (e) { restore(); throw e; }
  if (out && typeof out.then === 'function') return out.then((v) => { restore(); return v; }, (e) => { restore(); throw e; });
  restore();
  return out;
}

async function main() {
  delete process.env.MINDRIAN_DECISION_ADVISOR;
  delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
  delete process.env.CLAUDE_ACTIVE_ROOM;

  const registry = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));
  const SL = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'shortlist.cjs'));
  const CANON = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-job-canon.json'), 'utf8')).sections;
  const TABLE_PATH = path.join(ROOT, 'data', 'decision-advisor-table.json');
  const TABLE = JSON.parse(fs.readFileSync(TABLE_PATH, 'utf8'));
  const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
  const JOBS = registry.JOB_VOCABULARY;
  const unmapped = JOBS.filter((id) => !Object.keys(CANON).some((s) => CANON[s].job_id === id || CANON[s].secondary_job_id === id));
  const PITCH = 'prepare-pitch';
  assert.ok(unmapped.includes(PITCH), 'prepare-pitch maps to no canon section in the current data');

  // ---- G1 -----------------------------------------------------------------------------------------------------
  await leg('G1 sectionsForJob returns canon rank order in two tiers', async () => {
    assert.equal(typeof registry.sectionsForJob, 'function');
    assert.deepEqual(registry.sectionsForJob('find-problem'), { primary: ['problem-definition'], secondary: [] });
    assert.deepEqual(registry.sectionsForJob('understand-market'), { primary: ['market-analysis', 'competitive-analysis'], secondary: [] });
    const v = registry.sectionsForJob('validate-idea');
    assert.deepEqual(v.primary, ['personas']);
    assert.deepEqual(v.secondary, ['competitive-analysis']);
    // plan-execution: 0.97 before 0.5
    assert.deepEqual(registry.sectionsForJob('plan-execution').primary, ['team-execution', 'funding']);
    // a null probe_confidence sorts after a number
    const ex = registry.sectionsForJob('explore');
    assert.deepEqual(ex.primary, ['opportunity-bank']);
    assert.deepEqual(registry.sectionsForJob(PITCH), { primary: [], secondary: [] });
    assert.deepEqual(registry.sectionsForJob('nope'), { primary: [], secondary: [] });
    assert.deepEqual(registry.sectionsForJob(undefined), { primary: [], secondary: [] });
  });

  // ---- born room ----------------------------------------------------------------------------------------------
  const iso = H.mkIsolatedHome('4004-09');
  const born = H.birthFixtureRoom({ iso, slug: 'nest', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  const bind = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'))
    .writeSessionBinding(SESSION, { bound: ['nest'], primary: 'nest', sticky: false }, { home: iso.roomsHome });
  if (!bind || bind.ok !== true) throw new Error('session binding failed: ' + JSON.stringify(bind));

  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const sFake = fakeServer({ getClientCapabilities() { return {}; } });
  sensors.register(sFake.server, { fallbackRoomDir: roomDir });
  const suggestNext = sFake.registered.find((r) => r.name === 'suggest_next').handler;

  const gate = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const gFake = fakeServer({ getClientCapabilities() { return {}; } });
  gate.register(gFake.server, { fallbackRoomDir: roomDir });
  const render = gFake.registered.find((r) => r.name === 'gate_render').handler;
  const answer = gFake.registered.find((r) => r.name === 'gate_answer').handler;

  // The goal is set through the real card and gate_answer (the only intended path).
  async function setGoal(job) {
    const r = await call(render, { header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'], options: goalCard(job) });
    assert.equal(r.ok, true, JSON.stringify(r));
    const done = await call(answer, { gate_id: r.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.equal(done.strategy_ratification.goal_written, true, JSON.stringify(done.strategy_ratification));
    assert.equal(jtbdState.getGoal(roomDir).jtbd, job);
  }
  const pull = (args) => call(suggestNext, args || {});

  // The section folders the room was born with.
  const has = (s) => fs.existsSync(path.join(roomDir, s));
  assert.ok(has('problem-definition'), 'fixture room has problem-definition');

  await leg('G5a with no goal job the reply is the base shape (no nest_source, no reason_detail)', async () => {
    assert.equal(jtbdState.getGoal(roomDir), null);
    const r = await pull();
    assert.equal(r.next_move.primary, null);
    assert.equal(r.next_move_reason, 'no_active_nest');
    assert.ok(!('nest_source' in r) && !('nest_section' in r) && !('reason_detail' in r));
    assert.ok(!('domain_note' in r.next_move));
  });

  await leg('G2 goal find-problem, no section, no focus: ranked primary from the canon nest', async () => {
    await setGoal('find-problem');
    const r = await pull();
    assert.ok(r.next_move.primary, JSON.stringify(r.next_move));
    assert.equal(r.next_move_source, 'feyminto_face');
    assert.equal(r.nest_source, 'goal_job_map');
    assert.equal(r.nest_section, 'problem-definition');
    assert.ok(!('reason_detail' in r));
    const keys = Object.keys(r);
    assert.ok(keys.indexOf('nest_source') < keys.indexOf('goal_job'), 'nest fields come before goal_job');
    assert.equal(keys.indexOf('cause_effect'), keys.indexOf('goal_job') + 1);
  });

  await leg('G5b a section argument still wins over the goal job map', async () => {
    const r = await pull({ section: 'problem-definition' });
    assert.ok(r.next_move.primary);
    assert.ok(!('nest_source' in r) && !('nest_section' in r));
  });

  // ---- G3: market-analysis absent, competitive-analysis present ----------------------------------------------
  const ma = path.join(roomDir, 'market-analysis');
  const ca = path.join(roomDir, 'competitive-analysis');
  await leg('G3 goal understand-market, market-analysis absent, competitive-analysis present', async () => {
    const hadMa = fs.existsSync(ma);
    const hadCa = fs.existsSync(ca);
    const moved = path.join(iso.home, 'moved-market-analysis');
    if (hadMa) fs.renameSync(ma, moved);
    if (!hadCa) fs.mkdirSync(ca, { recursive: true });
    try {
      await setGoal('understand-market');
      const r = await pull();
      assert.equal(r.nest_source, 'goal_job_map');
      assert.equal(r.nest_section, 'competitive-analysis');
    } finally {
      if (!hadCa) fs.rmSync(ca, { recursive: true, force: true });
      if (hadMa) fs.renameSync(moved, ma);
    }
  });

  await leg('G4 every mapped section absent: no_active_nest with reason_detail', async () => {
    const pd = path.join(roomDir, 'problem-definition');
    const moved = path.join(iso.home, 'moved-problem-definition');
    fs.renameSync(pd, moved);
    try {
      await setGoal('find-problem');
      const r = await pull();
      assert.equal(r.next_move.primary, null);
      assert.equal(r.next_move_reason, 'no_active_nest');
      assert.equal(r.reason_detail, 'The sections mapped to the goal job find-problem (problem-definition) are not in this room.');
      assert.ok(!('nest_source' in r));
    } finally {
      fs.renameSync(moved, pd);
    }
  });

  // ---- G6 to G8: the domain note -----------------------------------------------------------------------------
  const NOTE = 'Cause and effect domain: complex (probe, then sense, then respond). The decision advisor is off, so these moves are not ordered by the domain.';
  await leg('G7a no domain stored: no domain_note', async () => {
    await setGoal('find-problem');
    const r = await pull({ section: 'problem-definition' });
    assert.ok(!('domain_note' in r.next_move));
    assert.equal(sensors._internal.domainNoteFor(roomDir), null);
  });
  const baseReply = await pull({ section: 'problem-definition' });

  const db = navigation.openRoomDbForCaller(roomDir);
  try {
    db.exec('BEGIN');
    const w = navigation.writeCauseEffect(db, { domain: 'complex', gateId: 'g-g6', decisionNodeId: 'decision:gate:g-g6' });
    db.exec('COMMIT');
    assert.equal(w.ok, true);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }

  await leg('G6 advisor off, domain complex stored: domain_note set, moves byte-identical', async () => {
    const r = await pull({ section: 'problem-definition' });
    assert.equal(r.next_move.domain_note, NOTE);
    const strip = (nm) => { const c = JSON.parse(JSON.stringify(nm)); delete c.domain_note; return c; };
    assert.deepEqual(strip(r.next_move), strip(baseReply.next_move));
    assert.deepEqual(r.next_move.primary, baseReply.next_move.primary);
    assert.deepEqual(r.next_move.alternatives, baseReply.next_move.alternatives);
  });

  await leg('G7b advisor on with the domain stored: no domain_note', async () => {
    await withEnv({ MINDRIAN_DECISION_ADVISOR: 'on' }, async () => {
      const r = await pull({ section: 'problem-definition' });
      assert.ok(!('domain_note' in r.next_move), JSON.stringify(Object.keys(r.next_move)));
    });
  });

  await leg('G8 none paths carry domain_note when a domain is stored and the advisor is off', async () => {
    // no_active_nest (no goal job mapped, no section)
    const pd = path.join(roomDir, 'problem-definition');
    const moved = path.join(iso.home, 'moved-pd-g8');
    fs.renameSync(pd, moved);
    try {
      const r1 = await pull();
      assert.equal(r1.next_move_reason, 'no_active_nest');
      assert.equal(r1.next_move.domain_note, NOTE);
    } finally { fs.renameSync(moved, pd); }
    // nest_not_found
    const r2 = await pull({ section: 'no-such-section' });
    assert.equal(r2.next_move_reason, 'nest_not_found');
    assert.equal(r2.next_move.domain_note, NOTE);
  });

  // ---- R1 to R5 ----------------------------------------------------------------------------------------------
  await leg('R1 rowForJob reads the stored row as data, flag independent', async () => {
    assert.equal(typeof SL.rowForJob, 'function');
    withEnv({ MINDRIAN_DECISION_ADVISOR: null, MINDRIAN_DECISION_ADVISOR_TABLE: null }, () => {
      const row = SL.rowForJob(PITCH);
      const stored = TABLE.rows[PITCH + '|*|*'];
      assert.deepEqual(row.map((x) => x.command), stored.map((x) => x.command));
      for (const x of row) {
        assert.deepEqual(Object.keys(x).sort(), ['band', 'command']);
        assert.ok(['strong', 'possible', 'weak'].includes(x.band));
      }
      assert.equal(SL.rowForJob('nope'), null);
      assert.equal(SL.rowForJob(undefined), null);
      assert.equal(process.env.MINDRIAN_DECISION_ADVISOR, undefined);
    });
    // a temp table path is honored
    const tmp = path.join(iso.home, 'one-row-table.json');
    const t2 = JSON.parse(JSON.stringify(TABLE));
    t2.rows[PITCH + '|*|*'] = [{ command: '/mos:persona', calibrated: 0.9 }];
    fs.writeFileSync(tmp, JSON.stringify(t2));
    withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: tmp }, () => {
      const row = SL.rowForJob(PITCH);
      assert.deepEqual(row, [{ command: '/mos:persona', band: 'strong' }]);
    });
  });

  const cap = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs'));
  const runnableOnMcp = (name) => { try { const c = cap.capabilityFor(name, { kind: 'command' }); return !!(c && c.known !== false && c.mcp === 'runnable'); } catch (_e) { return false; } };
  const reasonSentence = 'No section of data/section-job-canon.json is mapped to the goal job ' + PITCH + ', so this is a room-level move for the job.';

  let r2reply = null;
  await leg('R2 goal prepare-pitch, flag unset: a room-level move from the stored job row', async () => {
    await setGoal(PITCH);
    const r = await withEnv({ MINDRIAN_DECISION_ADVISOR: null, MINDRIAN_DECISION_ADVISOR_TABLE: null }, () => pull());
    r2reply = r;
    assert.ok(r.next_move.primary, JSON.stringify(r.next_move));
    assert.equal(r.next_move_source, 'room_level');
    assert.equal(r.nest_source, 'goal_job_room_level');
    assert.ok(!('nest_section' in r));
    assert.equal(r.next_move.room_level_source, 'decision_advisor_table');
    assert.equal(r.reason_detail, reasonSentence);
    const first = TABLE.rows[PITCH + '|*|*'].map((x) => x.command.replace(/^\/mos:/, '')).find(runnableOnMcp);
    assert.ok(first, 'the row has a runnable command on this install');
    assert.equal(r.next_move.primary.command, first);
    assert.ok(Array.isArray(r.next_move.alternatives));
    const mj = sensors._internal.methodJobFor ? sensors._internal.methodJobFor(r.next_move.primary) : require(path.join(ROOT, 'lib', 'core', 'framework-jobs.cjs')).methodJobForCommand(r.next_move.primary.command);
    if (mj) assert.deepEqual(r.next_move.method_job, mj); else assert.ok(!('method_job' in r.next_move));
    assert.ok(r.next_move.primary.why.indexOf('room-level') !== -1);
  });

  await leg('R3 table without the row: the command registry names the move', async () => {
    const tmp = path.join(iso.home, 'no-pitch-table.json');
    const t3 = JSON.parse(JSON.stringify(TABLE));
    delete t3.rows[PITCH + '|*|*'];
    fs.writeFileSync(tmp, JSON.stringify(t3));
    const r = await withEnv({ MINDRIAN_DECISION_ADVISOR: null, MINDRIAN_DECISION_ADVISOR_TABLE: tmp }, () => pull());
    assert.equal(r.next_move_source, 'room_level');
    assert.equal(r.next_move.room_level_source, 'command_registry');
    const first = REG.filter((c) => c.visibility !== 'admin' && Array.isArray(c.serves_jtbd) && c.serves_jtbd.includes(PITCH))
      .map((c) => c.command.replace(/^\/mos:/, '')).find(runnableOnMcp);
    assert.ok(first);
    assert.equal(r.next_move.primary.command, first);
  });

  await leg('R4 no runnable command anywhere: no_active_nest with the second reason_detail', async () => {
    const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
    assert.equal(typeof NM.roomLevelMoveForJob, 'function');
    const none = NM.roomLevelMoveForJob({ roomDir, jobId: PITCH, surface: 'mcp', capabilityFor: () => ({ known: false }) });
    assert.equal(none.primary, null);
    assert.deepEqual(none.alternatives, []);
    const real = NM.roomLevelMoveForJob;
    NM.roomLevelMoveForJob = () => ({ primary: null, alternatives: [], outcomes_differ: false, room_level_source: null });
    try {
      const r = await pull();
      assert.equal(r.next_move.primary, null);
      assert.equal(r.next_move_reason, 'no_active_nest');
      assert.equal(r.reason_detail, 'No section of data/section-job-canon.json is mapped to the goal job ' + PITCH + ', and no runnable command serves it.');
    } finally {
      NM.roomLevelMoveForJob = real;
    }
  });

  await leg('G8b the room-level path carries domain_note (domain stored, advisor off)', async () => {
    const r = await pull();
    assert.equal(r.next_move_source, 'room_level');
    assert.equal(r.next_move.domain_note, NOTE);
  });

  await leg('R5 the advisor stays off; no advisor key, no calibrated number', async () => {
    assert.equal(process.env.MINDRIAN_DECISION_ADVISOR, undefined);
    const s = SL.lookupShortlist({ jobId: PITCH });
    assert.equal(s.state, 'off');
    const r = r2reply;
    assert.ok(!('advisor' in r.next_move));
    assert.equal(PR.hasRawNumber(r.next_move), false);
    assert.equal(JSON.stringify(r.next_move).indexOf('calibrated'), -1);
  });

  // ---- G9 ----------------------------------------------------------------------------------------------------
  await leg('G9 advisor on: each option with a job statement carries method_job; no raw number', async () => {
    await setGoal('find-problem');
    await withEnv({ MINDRIAN_DECISION_ADVISOR: 'on' }, async () => {
      const r = await pull({ section: 'problem-definition' });
      const adv = r.next_move.advisor;
      assert.ok(adv && Array.isArray(adv.options) && adv.options.length > 0, JSON.stringify(adv));
      const FJ = require(path.join(ROOT, 'lib', 'core', 'framework-jobs.cjs'));
      let withJob = 0;
      let withoutJob = 0;
      for (const o of adv.options) {
        const mj = FJ.methodJobForCommand(o.command);
        if (mj) { assert.deepEqual(o.method_job, mj, o.command); withJob += 1; } else { assert.ok(!('method_job' in o), o.command); withoutJob += 1; }
        assert.ok('command' in o && 'band' in o && 'rank' in o, 'other keys stay: ' + o.command);
      }
      assert.ok(withJob + withoutJob === adv.options.length);
      console.log('  G9 options with a job statement: ' + withJob + ', without: ' + withoutJob);
      assert.equal(PR.hasRawNumber(adv), false);
    });
  });

  // ---- file hygiene ------------------------------------------------------------------------------------------
  await leg('dash guard on the files of this plan', async () => {
    for (const f of ['lib/core/section-registry.cjs', 'lib/core/decision-advisor/shortlist.cjs', 'lib/core/feyminto/next-move.cjs', 'lib/mcp/tools/sensors.cjs', 'tests/test-400.4-goal-job-nest.cjs']) {
      const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
      assert.ok(t.indexOf(EM) === -1 && t.indexOf(EN) === -1, f);
    }
  });

  console.log('test-400.4-goal-job-nest: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
