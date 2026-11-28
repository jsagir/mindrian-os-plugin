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


// ---- group C ------------------------------------------------------------------------------------------------
async function groupC() {
  const os = require('node:os');
  const { spawnSync } = require('node:child_process');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '4004-14c-'));
  const realHome = process.env.HOME;
  const realRooms = process.env.MINDRIAN_ROOMS_HOME;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.MINDRIAN_ROOMS_HOME = path.join(home, 'rooms');
  fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
  const cache = require(path.join(ROOT, 'lib', 'statusline', 'next-move-cache.cjs'));
  const signals = require(path.join(ROOT, 'lib', 'statusline', 'cockpit-signals.cjs'));
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const cueDir = path.join(home, '.mindrian', 'next-move');
  const globalFile = path.join(home, '.mindrian', 'next-move.json');
  const PHRASE = 'an idea feels too clean and nobody has argued against it';
  const STOP = ['and', 'or', 'but', 'with', 'the', 'a', 'an', 'to', 'of', 'for', 'in', 'on', 'that'];
  const rm = () => { fs.rmSync(path.join(home, '.mindrian'), { recursive: true, force: true }); };
  try {
    await leg('C1 formatMoveCue and shortJobPhrase: command words, job phrase, 48 characters, whole words', async () => {
      assert.equal(cache.formatMoveCue('/mos:challenge-assumptions', PHRASE), 'challenge assumptions: an idea feels too clean');
      assert.equal(cache.shortJobPhrase('/mos:challenge-assumptions', PHRASE), 'an idea feels too clean');
      assert.equal(cache.formatMoveCue('/mos:challenge-assumptions', null), 'challenge assumptions');
      assert.equal(cache.formatMoveCue('', PHRASE), '');
      const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
      let n = 0;
      registry.forEach((c) => {
        const when = c && c.job_sentence && c.job_sentence.when;
        if (typeof when !== 'string' || !c.command) return;
        const cue = cache.formatMoveCue(c.command, when);
        n += 1;
        assert.ok(cue.length <= cache.CUE_MAX, c.command + ' cue too long: ' + cue);
        const phrase = cache.shortJobPhrase(c.command, when);
        if (phrase) {
          assert.ok(when.indexOf(phrase) === 0, c.command + ' phrase is not a whole-word start of the job phrase');
          const next = when.charAt(phrase.length);
          assert.ok(next === '' || next === ' ', c.command + ' phrase ends inside a word');
          const last = phrase.split(' ').pop().toLowerCase();
          assert.ok(STOP.indexOf(last) === -1, c.command + ' phrase ends on a stop word: ' + phrase);
        }
      });
      assert.ok(n > 20, 'checked ' + n + ' registry commands');
    });

    await leg('C2 persistFromDecision writes the session record, not the global file', async () => {
      rm();
      const decision = { decision_trace: { selector_next_move: { command: '/mos:challenge-assumptions', job_id: 'validate-idea', job_when: PHRASE, nest_source: 'goal_job_map', nest_section: 'x' } } };
      assert.equal(cache.persistFromDecision(decision, { sessionId: 'S1', room: 'room-a' }), true);
      const rec = JSON.parse(fs.readFileSync(path.join(cueDir, 'S1.json'), 'utf8'));
      assert.equal(rec.room, 'room-a');
      assert.equal(rec.command, '/mos:challenge-assumptions');
      assert.equal(rec.job_id, 'validate-idea');
      assert.equal(rec.job_when, PHRASE);
      assert.equal(rec.source, 'selector');
      assert.equal(rec.next_move, cache.formatMoveCue('/mos:challenge-assumptions', PHRASE));
      assert.equal(typeof rec.ts, 'number');
      assert.ok(!fs.existsSync(globalFile), 'the global file is not written');
    });

    await leg('C3 readNextMove: own record, other session, global fallback, 24 h freshness', async () => {
      rm();
      cache.persistFromDecision({ decision_trace: { selector_next_move: { command: '/mos:build-thesis', job_id: 'decide-pursue', job_when: null } } }, { sessionId: 'S1', room: 'a' });
      cache.persistFromDecision({ decision_trace: { selector_next_move: { command: '/mos:find-analogies', job_id: 'connect-domains', job_when: null } } }, { sessionId: 'S2', room: 'b' });
      cache.persistNextMove({ command: '/mos:mullins', jtbd: null });
      const cueOf = (c) => cache.formatMoveCue(c, NM.jobWhenFor(c));
      assert.equal(cache.readNextMove({ sessionId: 'S1' }), cueOf('/mos:build-thesis'));
      assert.equal(cache.readNextMove({ sessionId: 'S2' }), cueOf('/mos:find-analogies'));
      assert.ok(cueOf('/mos:build-thesis').indexOf('build thesis') === 0);
      assert.equal(cache.readNextMove({ sessionId: 'S3' }), 'mullins', 'no record: the global cue');
      const old = Date.now() - 25 * 3600 * 1000;
      const f1 = path.join(cueDir, 'S1.json');
      const r1 = JSON.parse(fs.readFileSync(f1, 'utf8'));
      r1.ts = old;
      fs.writeFileSync(f1, JSON.stringify(r1));
      assert.equal(cache.readNextMove({ sessionId: 'S1' }), 'mullins', 'a 25 h old record is ignored: the global cue');
      const g = JSON.parse(fs.readFileSync(globalFile, 'utf8'));
      g.ts = old;
      fs.writeFileSync(globalFile, JSON.stringify(g));
      assert.equal(cache.readNextMove({ sessionId: 'S1' }), null, 'a 25 h old global gives null');
    });

    await leg('C4 never a skill name; plain sentences; the ratification cue wins over them', async () => {
      rm();
      const only = { fire_skill: 'context-engine', offer_next_step: null };
      cache.persistFromDecision(only, { sessionId: 'S1', room: 'a' });
      assert.equal(cache.readNextMove({ sessionId: 'S1' }), cache.NO_GOAL_CUE);
      assert.equal(cache.NO_GOAL_CUE, 'set a goal job');
      cache.persistFromDecision(Object.assign({ decision_trace: { selector_next_move: { command: null, job_id: 'find-problem', job_when: null } } }, only), { sessionId: 'S1', room: 'a' });
      assert.equal(cache.readNextMove({ sessionId: 'S1' }), cache.NO_MOVE_CUE);
      assert.equal(cache.NO_MOVE_CUE, 'no move for this job yet');
      cache.persistFromDecision(only, { sessionId: 'S1', room: null, roomless: true });
      assert.equal(cache.readNextMove({ sessionId: 'S1' }), cache.NO_ROOM_CUE);
      assert.equal(cache.NO_ROOM_CUE, 'no room for this session');
      cache.persistFromDecision(only, { sessionId: 'S1', room: 'a', fallbackProvider: () => 'ratify weak (1 open)' });
      assert.equal(cache.readNextMove({ sessionId: 'S1' }), 'ratify weak (1 open)');
      // legacy global path: no skill name either
      cache.persistFromDecision(only, {});
      assert.equal(fs.existsSync(globalFile), false, 'no global file with only a skill');
      fs.readdirSync(cueDir).forEach((f) => assert.ok(fs.readFileSync(path.join(cueDir, f), 'utf8').indexOf('context-engine') === -1));
    });

    await leg('C5 an unsafe session id writes nothing outside the cue folder and reads the global fallback', async () => {
      rm();
      cache.persistNextMove({ command: '/mos:mullins', jtbd: null });
      const long = 'a'.repeat(200);
      ['../x', 'a/b', long, '', null].forEach((bad) => {
        assert.equal(cache.sessionCuePath(bad), null, 'unsafe: ' + String(bad).slice(0, 10));
        cache.persistFromDecision({ decision_trace: { selector_next_move: { command: '/mos:build-thesis', job_id: 'x', job_when: null } } }, { sessionId: bad, room: 'a' });
        assert.equal(cache.readNextMove({ sessionId: bad }), cache.readNextMove());
      });
      assert.ok(!fs.existsSync(path.join(home, '.mindrian', 'x.json')));
      assert.ok(!fs.existsSync(path.join(cueDir, 'a')));
      assert.ok(!fs.existsSync(cueDir) || fs.readdirSync(cueDir).length === 0, 'no record written for an unsafe id');
      assert.equal(cache.sessionCuePath('S_1-x'), path.join(cueDir, 'S_1-x.json'));
    });

    await leg('C6 scripts/context-monitor prints the cue of its own stdin session', async () => {
      rm();
      cache.persistFromDecision({ decision_trace: { selector_next_move: { command: '/mos:build-thesis', job_id: 'decide-pursue', job_when: null } } }, { sessionId: 'S1', room: 'a' });
      cache.persistFromDecision({ decision_trace: { selector_next_move: { command: '/mos:find-analogies', job_id: 'connect-domains', job_when: null } } }, { sessionId: 'S2', room: 'b' });
      const run = (sid) => {
        const r = spawnSync('node', [path.join(ROOT, 'scripts', 'context-monitor')], {
          input: JSON.stringify({ session_id: sid, model: { display_name: 'Sonnet' }, workspace: { current_dir: home }, context_window: { used_percentage: 10, remaining_percentage: 90, context_window_size: 200000 } }),
          cwd: home, env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: path.join(home, 'rooms') }), encoding: 'utf8', timeout: 20000,
        });
        return String(r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '');
      };
      assert.ok(run('S1').indexOf('build thesis') !== -1, 'S1 cue: ' + run('S1'));
      assert.ok(run('S1').indexOf('find analogies') === -1);
      assert.ok(run('S2').indexOf('find analogies') !== -1, 'S2 cue');
      assert.ok(run('S2').indexOf('build thesis') === -1);
    });

    await leg('C7 deriveNextMove: -- when unknown, plain sentences by goal state, a fresh record wins', async () => {
      rm();
      assert.equal(signals.deriveNextMove({}), '--');
      assert.equal(signals.deriveNextMove({ goalJobSet: false }), 'set a goal job');
      assert.equal(signals.deriveNextMove({ goalJobSet: true }), 'no move for this job yet');
      cache.persistFromDecision({ decision_trace: { selector_next_move: { command: '/mos:build-thesis', job_id: 'x', job_when: null } } }, { sessionId: 'S1', room: 'a' });
      assert.equal(signals.deriveNextMove({ sessionId: 'S1', jtbd: 'explore', governingThought: 'a thought', goalJobSet: false }), cache.formatMoveCue('/mos:build-thesis', NM.jobWhenFor('/mos:build-thesis')));
      assert.equal(signals.deriveNextMove({ sessionId: 'S9', jtbd: 'explore' }), 'explore');
    });
  } finally {
    if (realHome === undefined) delete process.env.HOME; else process.env.HOME = realHome;
    if (realRooms === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = realRooms;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

// ---- group H ------------------------------------------------------------------------------------------------
async function groupH() {
  const { spawnSync } = require('node:child_process');
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const cache = require(path.join(ROOT, 'lib', 'statusline', 'next-move-cache.cjs'));
  const rar = require(path.join(ROOT, 'lib', 'core', 'resolve-active-room.cjs'));
  const binding = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'));
  const HOOK = path.join(ROOT, 'scripts', 'intent-classifier.cjs');
  const MONITOR = path.join(ROOT, 'scripts', 'context-monitor');
  const BLOCK_HEAD = '## NAVIGATION DECISION';
  const UNCHANGED = '[NAV DECISION unchanged - prior block stands]';

  const iso = H.mkIsolatedHome('4004-14h');
  const mk = (slug) => {
    const b = H.birthFixtureRoom({ iso, slug, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
    if (!b || b.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(b));
    return fs.realpathSync(b.roomDir);
  };
  const A = mk('room-a');
  const B = mk('room-b');
  const C = mk('room-c');
  const regPath = path.join(iso.roomsHome, '.rooms', 'registry.json');
  const setActive = (slug) => {
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    reg.active = slug;
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
  };
  const home = iso.roomsHome;
  const env = () => Object.assign({}, iso.env, {
    MINDRIAN_ROOMS_ROOT: iso.roomsHome, MOS_NAV_TEST_DISABLE_DRAIN: '1', MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
    MINDRIAN_VOICE_REMINDER: '0', CLAUDE_PLUGIN_ROOT: ROOT,
  });
  delete process.env.MINDRIAN_NAV_NO_SUPPRESS;
  const runHook = (sid, cwd, prompt) => {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ prompt: prompt || 'what should I work on next for this venture', session_id: sid, cwd, hook_event_name: 'UserPromptSubmit' }),
      env: env(), encoding: 'utf8', cwd: iso.home, timeout: 30000,
    });
    return { status: r.status, out: String(r.stdout || ''), err: String(r.stderr || ''), ms: Date.now() - t0 };
  };
  const nextMoveLine = (out) => { const m = out.match(/^next_move: .*$/m); return m ? m[0] : null; };
  const traceFile = (roomDir, sid) => path.join(roomDir, '.mindrian', 'decision-traces', sid + '.json');
  const lastTrace = (roomDir, sid) => {
    try { const d = JSON.parse(fs.readFileSync(traceFile(roomDir, sid), 'utf8')); return d.traces[d.traces.length - 1]; } catch (_e) { return null; }
  };
  const suggestPrimary = async (roomDir, sid) => {
    const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
    const f = fakeServer({ getClientCapabilities() { return {}; } });
    sensors.register(f.server, { fallbackRoomDir: roomDir });
    const h = f.registered.find((r) => r.name === 'suggest_next').handler;
    // suggest_next runs as a separate MCP session bound to the room, so it answers for that room.
    const mcpSid = 'mcp-' + sid;
    binding.writeSessionBinding(mcpSid, { bound: [path.basename(roomDir)], primary: path.basename(roomDir), sticky: false }, { home });
    const res = await h({}, { sessionId: mcpSid });
    return JSON.parse(res.content[0].text);
  };

  await leg('H1 resolveSessionRoom: binding, then the cwd room, then reg.active; no cwd means today\'s answer', async () => {
    setActive('room-c');
    binding.writeSessionBinding('sess-h1a', { bound: ['room-a'], primary: 'room-a', sticky: false }, { home });
    const inB = path.join(B, 'problem-definition');
    const outside = iso.home;
    const r1 = rar.resolveSessionRoom({ sessionId: 'sess-h1a', home, cwd: inB });
    assert.equal(r1.slug, 'room-a'); assert.equal(r1.source, 'session.primary');
    const r2 = rar.resolveSessionRoom({ sessionId: 'sess-h1b', home, cwd: inB });
    assert.equal(r2.slug, 'room-b'); assert.equal(r2.source, 'cwd.room_root');
    assert.equal(fs.realpathSync(r2.abs_path), B);
    const r3 = rar.resolveSessionRoom({ sessionId: 'sess-h1b', home, cwd: outside });
    assert.equal(r3.slug, 'room-c'); assert.equal(r3.source, 'reg.active');
    const bare = rar.resolveSessionRoom({ sessionId: 'sess-h1b', home });
    assert.equal(bare.slug, 'room-c'); assert.equal(bare.source, 'reg.active');
    const bound = rar.resolveSessionRoom({ sessionId: 'sess-h1a', home });
    assert.equal(bound.slug, 'room-a');
    // an empty cwd never starts a walk from process.cwd()
    const savedCwd = process.cwd();
    try {
      process.chdir(B);
      const r4 = rar.resolveSessionRoom({ sessionId: 'sess-h1b', home, cwd: '' });
      assert.equal(r4.source, 'reg.active', 'process.cwd() inside room B is never read');
    } finally { process.chdir(savedCwd); }
  });

  await leg('H2 the hook block is for the cwd room, names the suggest_next move with its job phrase', async () => {
    setActive('room-b');
    jtbdState.setGoal(A, { jtbd: 'find-problem' });
    const sid = 'sess-h2';
    const sg = await suggestPrimary(A, sid);
    assert.ok(sg.next_move.primary, JSON.stringify(sg.next_move));
    const Cmd = sg.next_move.primary.command;
    const P = cache.shortJobPhrase(Cmd, NM.jobWhenFor(Cmd));
    const r = runHook(sid, A, null);
    console.log('  H2 hook run time ms: ' + r.ms);
    assert.equal(r.status, 0, r.err);
    const line = nextMoveLine(r.out);
    assert.ok(line, 'a next_move line in the block: ' + r.out.slice(0, 600));
    const m = line.match(/^next_move: (?:\/mos:)?(\S+)(?: \| (.*))?$/);
    assert.ok(m, line);
    assert.equal(m[1], strip(Cmd));
    assert.equal(m[2] || '', P);
    assert.ok(r.out.indexOf('room-b') === -1, 'no line names room B');
    assert.ok(fs.existsSync(traceFile(A, sid)), 'the decision trace is under room A');
    assert.ok(!fs.existsSync(traceFile(B, sid)), 'and not under room B');
    assert.equal(lastTrace(A, sid).room_source, 'cwd.room_root');
  });

  await leg('H3 the cue record carries room A, the move and its phrase; context-monitor prints it', async () => {
    const sid = 'sess-h2';
    const sg = await suggestPrimary(A, sid);
    const Cmd = sg.next_move.primary.command;
    const rec = JSON.parse(fs.readFileSync(path.join(iso.home, '.mindrian', 'next-move', sid + '.json'), 'utf8'));
    assert.equal(rec.room, 'room-a');
    assert.equal(strip(rec.command), strip(Cmd));
    const want = cache.formatMoveCue(Cmd, NM.jobWhenFor(Cmd));
    assert.equal(rec.next_move, want);
    const mon = spawnSync('node', [MONITOR], {
      input: JSON.stringify({ session_id: sid, model: { display_name: 'Sonnet' }, workspace: { current_dir: iso.home }, context_window: { used_percentage: 10, remaining_percentage: 90, context_window_size: 200000 } }),
      cwd: iso.home, env: env(), encoding: 'utf8', timeout: 20000,
    });
    const text = String(mon.stdout || '').replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(text.indexOf(want) !== -1, 'statusline holds "' + want + '": ' + text);
  });

  await leg('H4 repeat is suppressed; a new goal job, a new room each give the full block again', async () => {
    const sid = 'sess-h4';
    setActive('room-b');
    jtbdState.setGoal(A, { jtbd: 'find-problem' });
    const first = runHook(sid, A, null);
    assert.ok(first.out.indexOf(BLOCK_HEAD) !== -1, 'first turn: full block ' + first.out.slice(0, 300));
    const again = runHook(sid, A, null);
    assert.ok(again.out.indexOf(UNCHANGED) !== -1, 'second turn: unchanged marker ' + again.out.slice(0, 300));
    jtbdState.setGoal(A, { jtbd: 'prepare-pitch' });
    const changedJob = runHook(sid, A, null);
    assert.ok(changedJob.out.indexOf(BLOCK_HEAD) !== -1, 'new goal job: full block');
    const sg = await suggestPrimary(A, sid);
    assert.equal(nextMoveLine(changedJob.out).replace(/^next_move: (\/mos:)?/, '').split(' ')[0], strip(sg.next_move.primary.command));
    // a turn in room B (unbound, reg.active B), then back in A
    const inB = runHook(sid, B, null);
    assert.ok(inB.out.indexOf(BLOCK_HEAD) !== -1 || inB.out.indexOf(UNCHANGED) === -1, 'room B turn is a full block');
    const backInA = runHook(sid, A, null);
    assert.ok(backInA.out.indexOf(BLOCK_HEAD) !== -1, 'return to room A: full block, not the marker: ' + backInA.out.slice(0, 200));
    jtbdState.setGoal(A, { jtbd: 'find-problem' });
  });

  await leg('H5 a binding to room A wins over a cwd inside room B', async () => {
    const sid = 'sess-h5';
    setActive('room-c');
    binding.writeSessionBinding(sid, { bound: ['room-a'], primary: 'room-a', sticky: false }, { home });
    const r = runHook(sid, B, null);
    assert.equal(r.status, 0, r.err);
    assert.ok(fs.existsSync(traceFile(A, sid)), 'trace under the bound room A');
    assert.ok(!fs.existsSync(traceFile(B, sid)), 'none under room B');
    assert.equal(lastTrace(A, sid).room_source, 'session.primary');
  });

  await leg('H6 with no registry active room and cwd inside room A the block still renders for A', async () => {
    const sid = 'sess-h6';
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    reg.active = null;
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
    const r = runHook(sid, A, null);
    assert.equal(r.status, 0, r.err);
    assert.ok(r.out.indexOf(BLOCK_HEAD) !== -1, 'a full block: ' + r.out.slice(0, 300));
    assert.ok(fs.existsSync(traceFile(A, sid)));
    assert.ok(r.out.indexOf('room-b') === -1 && r.out.indexOf('room-c') === -1);
  });
}

async function main() {
  if (want('V')) await groupV();
  if (want('C') && typeof groupC === 'function') await groupC();
  if (want('H') && typeof groupH === 'function') await groupH();
  console.log('test-400.4-one-voice: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.log('FAIL: fatal -- ' + (e && e.stack || e)); process.exit(1); });
