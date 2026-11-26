#!/usr/bin/env node
'use strict';
// Phase 400.4 plan 14 (QA-F12): one voice for the statusline cue, the NAVIGATION DECISION block and suggest_next,
// keyed to the session's own room and goal job.
//
// Leg groups (--legs V,C,H selects groups by prefix, default all):
//   V1-V6  one nest pick (nextMoveForGoalJob) for suggest_next and decide(); selector_next_move on the trace
//   C1-C7  the per-session cue in plain words, read by the statusline
//   H1-H6  the hook keys the block and the cue to the session's room
// A fresh isolated HOME and MINDRIAN_ROOMS_HOME per group. No network. Node built-ins only. Hyphens only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const argLegs = (() => {
  const i = process.argv.indexOf('--legs');
  if (i === -1 || !process.argv[i + 1]) return ['V', 'C', 'H'];
  return process.argv[i + 1].split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
})();
const want = (g) => argLegs.indexOf(g) !== -1;

let passed = 0;
let failed = 0;
async function leg(label, fn) {
  try { await fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join(' | ')); }
}

const SESSION = 'test-4004-14-' + Date.now() + '-' + Math.random().toString(36).slice(2);

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
const strip = (c) => String(c).replace(/^\/mos:/, '');

// ---- group V ------------------------------------------------------------------------------------------------
async function groupV() {
  delete process.env.MINDRIAN_DECISION_ADVISOR;
  delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const engine = require(path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs'));
  const offerMod = require(path.join(ROOT, 'lib', 'core', 'navigation-engine-offer.cjs'));
  const capability = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs'));

  const iso = H.mkIsolatedHome('4004-14v');
  const born = H.birthFixtureRoom({ iso, slug: 'nest', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'))
    .writeSessionBinding(SESSION, { bound: ['nest'], primary: 'nest', sticky: false }, { home: iso.roomsHome });

  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const sFake = fakeServer({ getClientCapabilities() { return {}; } });
  sensors.register(sFake.server, { fallbackRoomDir: roomDir });
  const suggestNext = sFake.registered.find((r) => r.name === 'suggest_next').handler;
  const pull = (args) => call(suggestNext, args || {});

  const decideCtx = (extra) => Object.assign({
    roomDir, surface: 'cli', operator: 'JUST_TALK', brainAvailable: false, roomState: {},
    userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'discovery' }, problemType: 'IDP',
  }, extra || {});
  const keyOf = (o) => Object.keys(o).sort();

  await leg('V1 nextMoveForGoalJob and suggest_next name the same primary (goal find-problem)', async () => {
    assert.equal(typeof NM.nextMoveForGoalJob, 'function');
    assert.equal(typeof NM.jobWhenFor, 'function');
    assert.equal(NM.nextMoveForGoalJob({ roomDir, surface: 'mcp' }), null, 'no goal job: null');
    jtbdState.setGoal(roomDir, { jtbd: 'find-problem' });
    const gj = NM.nextMoveForGoalJob({ roomDir, surface: 'mcp' });
    assert.ok(gj && gj.next_move && gj.next_move.primary, JSON.stringify(gj));
    assert.equal(gj.nest_source, 'goal_job_map');
    assert.equal(gj.nest_section, 'problem-definition');
    const r = await pull();
    assert.ok(r.next_move.primary, JSON.stringify(r));
    assert.equal(r.nest_source, 'goal_job_map');
    assert.equal(r.next_move.primary.command, gj.next_move.primary.command);
  });

  let v2Command = null;
  await leg('V2 decide() with a goal job and no section names the same move on the trace', async () => {
    const r = await pull();
    const primary = r.next_move.primary.command;
    // Precondition, computed: the primary is runnable on both surfaces.
    const cap = capability.capabilityFor(primary, { kind: 'command' });
    assert.ok(cap && cap.cli === 'runnable' && cap.mcp === 'runnable', 'precondition: runnable on cli and mcp: ' + JSON.stringify(cap));
    const ctx = decideCtx();
    const d = engine.decide({ userText: null, sessionId: 'v2' }, ctx);
    const sm = d.decision_trace.selector_next_move;
    assert.ok(sm && typeof sm === 'object', JSON.stringify(sm));
    assert.equal(strip(sm.command), strip(primary));
    assert.equal(sm.job_id, 'find-problem');
    assert.equal(sm.job_when, NM.jobWhenFor(sm.command));
    assert.equal(sm.nest_source, 'goal_job_map');
    assert.equal(sm.nest_section, 'problem-definition');
    assert.equal(ctx.tierCandidatesSource, 'feyminto_face');
    v2Command = sm.command;
  });

  await leg('V3 goal prepare-pitch (no canon section): room-level move, same command as suggest_next', async () => {
    jtbdState.setGoal(roomDir, { jtbd: 'prepare-pitch' });
    const r = await pull();
    assert.equal(r.nest_source, 'goal_job_room_level');
    const ctx = decideCtx();
    const d = engine.decide({ userText: null, sessionId: 'v3' }, ctx);
    const sm = d.decision_trace.selector_next_move;
    assert.ok(sm && sm.command, JSON.stringify(sm));
    assert.equal(sm.nest_source, 'goal_job_room_level');
    assert.equal(strip(sm.command), strip(r.next_move.primary.command));
    jtbdState.setGoal(roomDir, { jtbd: 'find-problem' });
  });

  await leg('V4 section wins; selectorSkipped and no goal job leave no pick; sectionFallback is the nest', async () => {
    const withSection = decideCtx({ section: 'problem-definition' });
    const d1 = engine.decide({ userText: null, sessionId: 'v4a' }, withSection);
    assert.equal(d1.decision_trace.selector_next_move.nest_source, 'section');
    assert.ok(!('goalJobId' in withSection), 'no goal pick when a section is given');

    const skipped = decideCtx({ selectorSkipped: true });
    const d2 = engine.decide({ userText: null, sessionId: 'v4b' }, skipped);
    assert.ok(!('tierCandidatesNestSource' in skipped));
    assert.ok(!(skipped.tierCandidatesSource === 'feyminto_face'), 'no selector list when skipped');
    assert.ok(d2.decision_trace.selector_next_move === null);

    // no goal job: remove the goal state file, then no section and no fallback is the base behavior
    const goalBackup = jtbdState.getGoal(roomDir);
    assert.ok(goalBackup, 'precondition: goal set');
    const stateFile = path.join(roomDir, '.mindrian', 'jtbd-state.json');
    const statePresent = fs.existsSync(stateFile);
    const saved = statePresent ? fs.readFileSync(stateFile) : null;
    try {
      if (statePresent) fs.rmSync(stateFile);
      assert.equal(jtbdState.getGoal(roomDir), null, 'precondition: no goal');
      const bare = decideCtx();
      const d3 = engine.decide({ userText: null, sessionId: 'v4c' }, bare);
      assert.equal(d3.decision_trace.selector_next_move, null);
      assert.ok(!Array.isArray(bare.tierCandidates));
      const fb = decideCtx({ sectionFallback: 'problem-definition' });
      const d4 = engine.decide({ userText: null, sessionId: 'v4d' }, fb);
      assert.equal(d4.decision_trace.selector_next_move.nest_source, 'section_fallback');
      assert.equal(d4.decision_trace.selector_next_move.nest_section, 'problem-definition');
    } finally {
      if (saved) fs.writeFileSync(stateFile, saved);
    }
    assert.ok(jtbdState.getGoal(roomDir), 'goal restored');
  });

  await leg('V5 selector_next_move is a stable trace key; a goal job with no runnable move says so', async () => {
    const base = engine.decide({}, {});
    assert.ok(Object.prototype.hasOwnProperty.call(base.decision_trace, 'selector_next_move'));
    assert.equal(base.decision_trace.selector_next_move, null);
    const d = engine.decide({ userText: null, sessionId: 'v5' }, decideCtx());
    assert.deepEqual(keyOf(d.decision_trace), keyOf(base.decision_trace));
    // every mapped section absent: temporarily rename problem-definition
    const pd = path.join(roomDir, 'problem-definition');
    const moved = path.join(iso.home, 'moved-pd');
    fs.renameSync(pd, moved);
    try {
      const ctx = decideCtx();
      const d2 = engine.decide({ userText: null, sessionId: 'v5b' }, ctx);
      const sm = d2.decision_trace.selector_next_move;
      assert.ok(sm && sm.command === null && sm.job_id === 'find-problem' && typeof sm.reason === 'string', JSON.stringify(sm));
      assert.notEqual(ctx.tierCandidatesSource, 'feyminto_face');
    } finally {
      fs.renameSync(moved, pd);
    }
  });

  await leg('V6 resolveOffer after the V2 decide names the selector command or abstains', async () => {
    assert.ok(v2Command, 'V2 ran');
    const ctx = decideCtx({ operator: 'DECISION_GATE' });
    engine.decide({ userText: null, sessionId: 'v6' }, ctx);
    assert.equal(ctx.tierCandidatesSource, 'feyminto_face');
    const offer = offerMod.resolveOffer(ctx);
    if (offer === null || offer === undefined) {
      console.log('  V6 case: the offer abstained (the block carries the next_move line)');
    } else {
      assert.equal(strip(offer.command), strip(ctx.tierCandidates[0].items[0].id));
      console.log('  V6 case: the offer names the selector command ' + offer.command);
    }
  });
}

async function main() {
  if (want('V')) await groupV();
  if (want('C') && typeof groupC === 'function') await groupC();
  if (want('H') && typeof groupH === 'function') await groupH();
  console.log('test-400.4-one-voice: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
// GROUP_C_AND_H_HERE
main().catch((e) => { console.log('FAIL: fatal -- ' + (e && e.stack || e)); process.exit(1); });
