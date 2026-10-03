#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 05 Tasks 1-3 -- the Scientific Roadmapping door (SYS, HYP,
 * NR-1, THEO-C, NV-2, the D-18 reuse contract). layer: loop
 *
 * Legs D1-D17 drive lib/core/research-planner/sr-door.cjs: the stage machine,
 * the systems pass before paths and limiters, the bound reverse-salient rule,
 * the question set on the 363 template, Stage B hypothesis leaves, the ratchet
 * and the plugin-side rubric. Hermetic: HOME, USERPROFILE and
 * MINDRIAN_ROOMS_HOME point at mkdtemp dirs before any repo module loads; the
 * network guard is installed first and the last check proves zero attempts.
 * Exit 77 when node:sqlite is missing. Rooms live only under os.tmpdir().
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-door-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-door-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  console.log('SKIP: node:sqlite is not available (ENV GAP)');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-sr-door');

const MOD_PATH = path.join(REPO_ROOT, 'lib/core/research-planner/sr-door.cjs');
const fixtures = require(path.join(REPO_ROOT, 'tests/helpers/fixture-door-364.cjs'));
const roomFixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-364.cjs'));

const ROOT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-door-'));
const NO_DASH = /[\u2014\u2013]/;
const REFUSAL = 'Theo has not authored this step yet';
const FORBIDDEN = ['srStepGuide', 'LOCAL_STEP_TEMPLATE', 'structureFor', 'research-corpus', 'research-cache', 'rs-fetcher',
  'audit-ledger', 'grants.cjs', 'quick.cjs', 'deep.cjs', 'families.cjs', 'evidence-rows', 'brain-client', 'fetch(',
  'writeFileSync', 'appendFileSync', 'mkdirSync'];

let roomCount = 0;
function newRoom() {
  roomCount += 1;
  return roomFixture.buildEntryRoom(ROOT_DIR, 'stated_goal', { name: 'door-room-' + roomCount }).roomDir;
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function out63() { return fixtures.stageOutputsFrom363(); }

async function main() {
  let door = null;
  try { door = require(MOD_PATH); } catch (e) { C.check('D1 sr-door.cjs loads', false, e.message); }
  if (!door) { C.check('D17 zero network attempts', net.attempts() === 0); process.exit(C.summary() || 1); }

  const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
  const perspective = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspective.cjs'));
  const { readSrSteps } = require(path.join(REPO_ROOT, 'lib/core/research-planner/sr-steps.cjs'));
  const { STAGES, STAGE_GATES, RUBRIC, createRun, recordStage, nextStage, buildQuestionSet, stageB, mapSteps } = door;

  const theoOk = fixtures.theoAuthored();
  const COVERAGE = { status: 'uncovered', problem_type: 'WellDefined' };
  function make(entry, chosenStep) {
    const e = entry || fixtures.syntheticEntry();
    return createRun({ entry: e, theo: theoOk, chosenStep: chosenStep, confirmedWhat: e.what.candidates[0], coverage: COVERAGE, now: new Date('2026-10-03T00:00:00Z') });
  }
  function rec(state, stage, outcome) {
    const r = recordStage(state, stage, outcome);
    if (!r.ok) throw new Error('recordStage ' + stage + ' refused ' + JSON.stringify(r));
    return r.state;
  }
  // approve every stage before `stop`, systems pass declined with a reason
  function advanceTo(state, stop, entryBound) {
    const outcomes = out63();
    const order = ['sr:1', 'sr:2', 'sr:3', 'sr:4', 'systems_pass', 'sr:5', 'sr:6', 'sr:7'];
    let s = state;
    for (let i = 0; i < order.length && order[i] !== stop; i += 1) {
      const id = order[i];
      if (s.stages[id].status === 'not_run') continue;
      if (id === 'systems_pass') s = rec(s, id, { decision: 'approve', status: 'declined', reason: 'no systems artifact' });
      else {
        const oc = clone(outcomes[id]);
        if (id === 'sr:6' && entryBound) oc.dismissed = entryBound.map(function (x) { return { id: x, reason: 'out of scope' }; });
        s = rec(s, id, oc);
      }
    }
    return s;
  }

  // D1 engine binding
  {
    const d = door.describeDoor();
    C.check('D1 describeDoor names the command, template, engine api_version 1 and the stages',
      d.command === '/mos:scientific-roadmap' && d.template_id === 'scientific-roadmapping' && d.engine_api_version === '1'
      && JSON.stringify(d.stages) === JSON.stringify(STAGES), JSON.stringify(d));
    const roomDir = newRoom();
    const state = fixtures.walkedState({});
    const r = await stageB(roomDir, state, { perspectiveModule: { describeEngine: function () { return { api_version: '2' }; } } });
    C.check('D1 an engine api_version other than 1 refuses engine_api_mismatch and writes nothing',
      r.ok === false && r.reason === 'engine_api_mismatch' && !fs.existsSync(path.join(roomDir, '.mindrian', 'research-runs')), JSON.stringify(r));
  }

  // D2 theo refusal and missing WHAT
  {
    const e = fixtures.syntheticEntry();
    const r = createRun({ entry: e, theo: { ok: false, reason: 'step_unauthored', message: REFUSAL }, confirmedWhat: e.what.candidates[0], coverage: COVERAGE });
    C.check('D2 an unauthored Theo step refuses theo_refused with the exact text and the /mos:research offer',
      r.ok === false && r.reason === 'theo_refused' && r.theo_reason === 'step_unauthored' && r.message === REFUSAL && r.offer === '/mos:research', JSON.stringify(r));
    const m = fixtures.syntheticEntry({ what: { status: 'missing', candidates: [] } });
    const r2 = createRun({ entry: m, theo: theoOk, coverage: COVERAGE });
    C.check('D2 a missing WHAT refuses what_missing', r2.ok === false && r2.reason === 'what_missing', JSON.stringify(r2));
    const r3 = make();
    C.check('D2 a good entry and authored steps start a run with a run_tag and one record per stage',
      r3.ok === true && /^sr-\d{8}-[0-9a-f]{8}$/.test(r3.state.run_tag) && r3.state.plan_ref === null
      && JSON.stringify(Object.keys(r3.state.stages)) === JSON.stringify(STAGES)
      && r3.state.stages['sr:1'].status === 'pending' && r3.state.theo.mapping === 'label'
      && r3.state.theo.map['sr:1'] === 'sr-v1-step-1', JSON.stringify(r3));
  }

  // D3 step map
  {
    const a = mapSteps(fixtures.runnableRows('framework-step-authored'));
    C.check('D3 authored labels map by label (sr:1 is the Tension Qualification row)',
      a.ok === true && a.mapping === 'label' && a.map['sr:1'] === 'sr-v1-step-1' && a.map['sr:7'] === 'sr-v1-step-7', JSON.stringify(a));
    const b = mapSteps(fixtures.runnableRows('framework-step-unlabelled-seven'));
    C.check('D3 seven unlabelled runnable rows map by position', b.ok === true && b.mapping === 'position' && b.map['sr:4'] === 'sr-v1-step-4', JSON.stringify(b));
    const c = mapSteps(fixtures.runnableRows('framework-step-eight-unlabelled'));
    C.check('D3 eight unlabelled rows refuse step_map_unresolved and never auto-fill',
      c.ok === false && c.reason === 'step_map_unresolved' && c.map === undefined, JSON.stringify(c));
  }

  // D4 fixed order and purity
  {
    const s0 = make().state;
    const before = JSON.stringify(s0);
    const r = recordStage(s0, 'sr:2', { decision: 'approve', output: out63()['sr:2'].output });
    C.check('D4 sr:2 before sr:1 refuses stage_out_of_order:sr:2', r.ok === false && r.reason === 'stage_out_of_order:sr:2', JSON.stringify(r));
    const ok = recordStage(s0, 'sr:1', out63()['sr:1']);
    C.check('D4 recordStage never mutates its input state', JSON.stringify(s0) === before && ok.ok === true && ok.state !== s0, JSON.stringify(ok).slice(0, 120));
    C.check('D4 an unknown stage refuses stage_unknown', recordStage(s0, 'sr:9', { decision: 'approve' }).reason === 'stage_unknown');
    const r1 = recordStage(ok.state, 'sr:1', out63()['sr:1']);
    C.check('D4 re-recording a finished stage refuses as out of order', r1.ok === false && r1.reason === 'stage_out_of_order:sr:1', JSON.stringify(r1));
    const bad = recordStage(s0, 'sr:1', { decision: 'approve', output: 'text' });
    C.check('D4 a non-object output refuses output_invalid', bad.ok === false && bad.reason === 'output_invalid', JSON.stringify(bad));
    const big = recordStage(s0, 'sr:1', { decision: 'approve', output: { tension: { statement: 'x'.repeat(21000) } } });
    C.check('D4 an output over 20000 characters refuses output_too_large', big.ok === false && big.reason === 'output_too_large', JSON.stringify(big).slice(0, 120));
  }

  // D5 the systems pass
  {
    const entry = fixtures.syntheticEntry({ bound: { reverse_salients: [], dominant_designs: [], futures: [], systems: ['sys-1'] } });
    const s4 = advanceTo(make(entry).state, 'systems_pass');
    C.check('D5 after sr:1-sr:4 the next stage is the systems pass', nextStage(s4) === 'systems_pass');
    const r5 = recordStage(s4, 'sr:5', out63()['sr:5']);
    C.check('D5 sr:5 before the systems pass refuses systems_pass_required', r5.ok === false && r5.reason === 'systems_pass_required', JSON.stringify(r5));
    const r6 = recordStage(s4, 'sr:6', out63()['sr:6']);
    C.check('D5 sr:6 before the systems pass refuses systems_pass_required', r6.ok === false && r6.reason === 'systems_pass_required', JSON.stringify(r6));
    const noReason = recordStage(s4, 'systems_pass', { decision: 'approve', status: 'declined' });
    C.check('D5 a declined systems pass with no reason refuses reason_required', noReason.ok === false && noReason.reason === 'reason_required', JSON.stringify(noReason));
    const declined = recordStage(s4, 'systems_pass', { decision: 'approve', status: 'declined', reason: 'no systems read applies here' });
    C.check('D5 a declined systems pass with a reason is accepted and recorded', declined.ok === true && declined.state.stages.systems_pass.reason === 'no systems read applies here' && nextStage(declined.state) === 'sr:5', JSON.stringify(declined));
    C.check('D5 then sr:5 is accepted', recordStage(declined.state, 'sr:5', out63()['sr:5']).ok === true);
    const badStand = recordStage(s4, 'systems_pass', { decision: 'approve', stand_in: 'sys-nope' });
    C.check('D5 a stand-in not among the bound systems refuses stand_in_unknown:sys-nope', badStand.ok === false && badStand.reason === 'stand_in_unknown:sys-nope', JSON.stringify(badStand));
    const goodStand = recordStage(s4, 'systems_pass', { decision: 'approve', stand_in: 'sys-1' });
    C.check('D5 a filed systems artifact stands in for the pass',
      goodStand.ok === true && goodStand.state.stages.systems_pass.status === 'not_run' && goodStand.state.stages.systems_pass.stand_in.id === 'sys-1' && nextStage(goodStand.state) === 'sr:5', JSON.stringify(goodStand));
    const done = recordStage(s4, 'systems_pass', { decision: 'approve', output: { note: 'ran /mos:systems-thinking' } });
    C.check('D5 a pass that was run is recorded done', done.ok === true && done.state.stages.systems_pass.status === 'done' && nextStage(done.state) === 'sr:5', JSON.stringify(done));
    const b = door.boundForStage(s4, 'systems_pass');
    C.check('D5 boundForStage offers the systems commands and names the filed systems ids',
      JSON.stringify(b.systems) === '["sys-1"]' && b.offer.indexOf('/mos:systems-thinking') !== -1 && b.offer.indexOf('/mos:analyze-systems') !== -1, JSON.stringify(b));
  }

  // D6 mid-journey entry
  {
    const sk = [{ step: 1, stand_in: { kind: 'goal', id: 'goal:v1' } }, { step: 2, stand_in: { kind: 'goal', id: 'goal:v1' } },
      { step: 3, stand_in: null }, { step: 4, stand_in: null }, { step: 5, stand_in: null }];
    const entry = fixtures.syntheticEntry({ proposed_step: 6, rule: 'rs_finding', not_run: sk, bound: { reverse_salients: ['rs-node-1'], dominant_designs: [], futures: [], systems: [] } });
    const r = make(entry, 6);
    const st = r.ok ? r.state : null;
    C.check('D6 chosenStep 6 marks sr:1-sr:5 not_run with the entry stand-ins; the systems pass stays pending',
      r.ok === true && ['sr:1', 'sr:2', 'sr:3', 'sr:4', 'sr:5'].every(function (k) { return st.stages[k].status === 'not_run'; })
      && st.stages['sr:1'].stand_in && st.stages['sr:1'].stand_in.id === 'goal:v1' && st.stages['sr:3'].stand_in === null
      && st.stages.systems_pass.status === 'pending' && nextStage(st) === 'systems_pass', JSON.stringify(r).slice(0, 300));
    const first = recordStage(st, 'sr:6', out63()['sr:6']);
    C.check('D6 a mid-journey entry still needs the systems pass before sr:6', first.ok === false && first.reason === 'systems_pass_required', JSON.stringify(first));
    const above = make(entry, 7);
    C.check('D6 a chosen step above the proposed step refuses chosen_step_invalid', above.ok === false && above.reason === 'chosen_step_invalid', JSON.stringify(above));
    const zero = make(entry, 0);
    C.check('D6 a chosen step of 0 refuses chosen_step_invalid', zero.ok === false && zero.reason === 'chosen_step_invalid', JSON.stringify(zero));
    const down = make(entry, 4);
    C.check('D6 an override toward step 1 is allowed: sr:1-sr:3 not_run, sr:4 is next',
      down.ok === true && down.state.stages['sr:3'].status === 'not_run' && down.state.stages['sr:4'].status === 'pending' && nextStage(down.state) === 'sr:4', JSON.stringify(down).slice(0, 200));
    const dflt = make(entry);
    C.check('D6 no chosenStep defaults to the proposed step', dflt.ok === true && dflt.state.entry.chosen_step === 6 && dflt.state.entry.proposed_step === 6);
  }

  // D7 reject and defer
  {
    const s0 = make().state;
    const nr = recordStage(s0, 'sr:1', { decision: 'reject' });
    C.check('D7 reject without a reason refuses reason_required', nr.ok === false && nr.reason === 'reason_required', JSON.stringify(nr));
    const wr = recordStage(s0, 'sr:1', { decision: 'reject', reason: 'the tension is not real yet' });
    C.check('D7 reject with a reason keeps the stage open', wr.ok === true && nextStage(wr.state) === 'sr:1' && wr.state.stages['sr:1'].status === 'rejected' && wr.state.stages['sr:1'].reason === 'the tension is not real yet', JSON.stringify(wr).slice(0, 200));
    const df = recordStage(s0, 'sr:1', { decision: 'defer' });
    C.check('D7 defer returns paused and the stage stays next', df.ok === true && df.paused === true && nextStage(df.state) === 'sr:1' && df.state.stages['sr:1'].status === 'deferred', JSON.stringify(df).slice(0, 200));
    const at5 = advanceTo(make().state, 'sr:5');
    const at5b = rec(at5, 'sr:5', { decision: 'reject', reason: 'routes overlap', output: { paths: [{ id: 'P1', label: 'Lithium metal anode' }, { id: 'P2', label: 'Silicon anode' }] } });
    const ids = at5b.discarded.map(function (d) { return d.kind + ':' + d.id; }).sort();
    C.check('D7 a rejected route list is logged into discarded with the reason',
      JSON.stringify(ids) === '["route:P1","route:P2"]' && at5b.discarded.every(function (d) { return d.reason === 'routes overlap'; }) && nextStage(at5b) === 'sr:5', JSON.stringify(at5b.discarded));
  }

  // D8 bound reverse-salient rule
  {
    const entry = fixtures.syntheticEntry({ bound: { reverse_salients: ['rs-node-1'], dominant_designs: [], futures: [], systems: [] } });
    const s6 = advanceTo(make(entry).state, 'sr:6');
    const plain = out63()['sr:6'];
    const miss = recordStage(s6, 'sr:6', plain);
    C.check('D8 a bound reverse salient with no limiter row and no dismissal refuses bound_input_unaddressed:rs-node-1',
      miss.ok === false && miss.reason === 'bound_input_unaddressed:rs-node-1', JSON.stringify(miss));
    const withSrc = clone(plain);
    withSrc.output.limiters[1].source_node_id = 'rs-node-1';
    const okSrc = recordStage(s6, 'sr:6', withSrc);
    C.check('D8 a limiter row carrying source_node_id satisfies it', okSrc.ok === true, JSON.stringify(okSrc));
    const dis = recordStage(s6, 'sr:6', Object.assign(clone(plain), { dismissed: [{ id: 'rs-node-1', reason: 'out of scope' }] }));
    C.check('D8 a dismissal with a reason satisfies it and is logged in discarded',
      dis.ok === true && dis.state.discarded.some(function (d) { return d.kind === 'reverse_salient' && d.id === 'rs-node-1' && d.reason === 'out of scope'; }), JSON.stringify(dis).slice(0, 200));
    const disNo = recordStage(s6, 'sr:6', Object.assign(clone(plain), { dismissed: [{ id: 'rs-node-1' }] }));
    C.check('D8 a dismissal with no reason does not count', disNo.ok === false, JSON.stringify(disNo));
    const bf = door.boundForStage(s6, 'sr:6');
    C.check('D8 boundForStage lists the reverse salients as the first rows', JSON.stringify(bf.first_rows) === '["rs-node-1"]', JSON.stringify(bf));
    const ds = fixtures.syntheticEntry({ bound: { reverse_salients: [], dominant_designs: ['dd-1'], futures: ['fu-1'], systems: [] } });
    const b5 = door.boundForStage(make(ds).state, 'sr:5');
    C.check('D8 boundForStage lists dominant designs and futures as candidate routes', JSON.stringify(b5.candidate_routes) === '["dd-1","fu-1"]', JSON.stringify(b5));
  }

  // D9 question set on the 363 template
  {
    const state = fixtures.walkedState({});
    const r = buildQuestionSet(state, {});
    const qs = r.question_set;
    C.check('D9 a walked run builds a valid question set on scientific-roadmapping',
      r.ok === true && qs.template_id === 'scientific-roadmapping' && qs.command === '/mos:scientific-roadmap' && qs.schema === 'mos.research-question-set/1'
      && Q.validateQuestionSet(qs).ok === true && qs.mode_hint === 'deep', JSON.stringify(r.errors) + JSON.stringify(Q.validateQuestionSet(qs).errors));
    const dims = Q.dimensionsFor(Q.TEMPLATES['scientific-roadmapping']).filter(function (d) { return d.effective_researchable; }).map(function (d) { return d.id; });
    const covered = qs.leaves.map(function (l) { return l.dimension; });
    C.check('D9 every researchable template dimension has a leaf; the stated question is a user_stated leaf',
      dims.every(function (d) { return covered.indexOf(d) !== -1; }) && qs.leaves.some(function (l) { return l.origin === 'user_stated'; })
      && qs.leaves.every(function (l) { return ['user_stated', 'framework_dimension', 'mece_gap'].indexOf(l.origin) !== -1; }), JSON.stringify(covered));
    const t = Q.TEMPLATES['scientific-roadmapping'];
    C.check('D9 templateForCommand stays null; the template has both doors and stays explicit_only',
      Q.templateForCommand('/mos:scientific-roadmap') === null && t.doors.indexOf('/mos:research') !== -1 && t.doors.indexOf('/mos:scientific-roadmap') !== -1 && t.explicit_only === true, JSON.stringify(t.doors));

    // a filed plan stands in for a not_run step, read-only
    const roomDir = newRoom();
    const run = 'sr-filed-run';
    fs.mkdirSync(path.join(roomDir, 'research', run), { recursive: true });
    fs.writeFileSync(path.join(roomDir, 'research', run, 'plan.json'), JSON.stringify({ perspective: { rung_phrase: { roadmap_type: 'Pipeline', idea_kind: 'optimizations' } } }));
    const entry = fixtures.syntheticEntry({
      proposed_step: 4, rule: 'quantified_goal',
      not_run: [{ step: 1, stand_in: { kind: 'goal', id: 'goal:v1' } }, { step: 2, stand_in: { kind: 'goal', id: 'goal:v1' } }, { step: 3, stand_in: { kind: 'sr_plan', id: run } }],
    });
    const w4 = fixtures.walkedState({ entry: entry, chosenStep: 4 });
    const q4 = buildQuestionSet(w4, { roomDir: roomDir });
    C.check('D9 a not_run stage with an sr_plan stand-in copies that field from the filed plan; the others stay empty',
      q4.ok === true && q4.question_set.perspective.rung_phrase.roadmap_type === 'Pipeline' && Object.keys(q4.question_set.perspective.tension).length === 0, JSON.stringify(q4).slice(0, 300));
    const traversal = fixtures.syntheticEntry({
      proposed_step: 4, rule: 'quantified_goal',
      not_run: [{ step: 1, stand_in: null }, { step: 2, stand_in: null }, { step: 3, stand_in: { kind: 'sr_plan', id: '../../etc' } }],
    });
    const qt = buildQuestionSet(fixtures.walkedState({ entry: traversal, chosenStep: 4 }), { roomDir: roomDir });
    C.check('D9 a stand-in id that is not a plain run name is never read', qt.question_set && Object.keys(qt.question_set.perspective.rung_phrase).length === 0, JSON.stringify(qt).slice(0, 200));
  }

  // D10 hypothesis leaves
  const d10Rooms = {};
  {
    const roomDir = newRoom();
    d10Rooms.base = roomDir;
    const state = fixtures.walkedState({});
    const r = await stageB(roomDir, state, {});
    const leaves = r.leaves || [];
    const ids = leaves.map(function (l) { return l.slots && l.slots.limiter_id; }).sort();
    C.check('D10 stageB succeeds on a walked run', r.ok === true, JSON.stringify(r).slice(0, 300));
    C.check('D10 exactly one hypothesis leaf per assumed limiter (LM2, LM3, LM4); the physics limiter LM1 gets none',
      JSON.stringify(ids) === '["LM2","LM3","LM4"]', JSON.stringify(ids));
    C.check('D10 each leaf carries dimension sr:limiters, a claim, why_unlocks, falsifier text and the evidence tier',
      leaves.length > 0 && leaves.every(function (l) {
        return l.dimension === 'sr:limiters' && typeof l.claim === 'string' && l.claim.length > 0 && typeof l.why_unlocks === 'string' && l.why_unlocks.length > 0
          && l.falsifier && typeof l.falsifier.text === 'string' && l.falsifier.text.length > 0 && l.slots && typeof l.slots.evidence_tier_needed === 'string' && l.slots.evidence_tier_needed.length > 0;
      }), JSON.stringify(leaves[0]));
    const lm2 = leaves.filter(function (l) { return l.slots.limiter_id === 'LM2'; })[0];
    C.check('D10 the first-ranked hypothesis is the limiter that unlocks the longest field chain (LM2)', leaves[0] && leaves[0].slots.limiter_id === 'LM2' && lm2 && /2 downstream/.test(lm2.why_unlocks), JSON.stringify(leaves.map(function (l) { return l.why_unlocks; })));

    const room2 = newRoom();
    const lims = clone(out63()['sr:6'].output.limiters);
    lims.forEach(function (l) { if (l.id === 'LM4') l.resolved = true; });
    const s2 = fixtures.walkedState({ outputs: { 'sr:6': { limiters: lims } } });
    const r2 = await stageB(room2, s2, {});
    C.check('D10 a resolved assumed limiter gets no hypothesis leaf', r2.ok === true && r2.leaves.map(function (l) { return l.slots.limiter_id; }).sort().join(',') === 'LM2,LM3', JSON.stringify(r2).slice(0, 200));
    const noStage = await stageB(newRoom(), make().state, {});
    C.check('D10 stageB before sr:7 is done refuses stage_order', noStage.ok === false && noStage.reason === 'stage_order', JSON.stringify(noStage));
  }

  // D11 plan through the one planner
  {
    const roomDir = newRoom();
    const state = fixtures.walkedState({});
    const r = await stageB(roomDir, state, {});
    const runId = r.plan_ref && r.plan_ref.run_id;
    const planFile = runId ? path.join(roomDir, '.mindrian', 'research-runs', runId, 'plan.json') : null;
    const plan = planFile && fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : null;
    C.check('D11 stageB returns a run id, a non-empty F.6 card string, and the plan is ready on disk',
      r.ok === true && typeof runId === 'string' && typeof r.card === 'string' && r.card.length > 0 && plan && plan.status === 'ready'
      && plan.origin.template_id === 'scientific-roadmapping' && plan.origin.command === '/mos:scientific-roadmap', JSON.stringify(r).slice(0, 300));
    C.check('D11 the state is updated: stage_b done and plan_ref set; the input state is not mutated',
      r.state.stages.stage_b.status === 'done' && r.state.plan_ref && r.state.plan_ref.run_id === runId && state.plan_ref === null && state.stages.stage_b.status === 'pending');
    C.check('D11 nothing is created under research/ or research-plan/',
      !fs.existsSync(path.join(roomDir, 'research')) && !fs.existsSync(path.join(roomDir, 'research-plan')));
    C.check('D11 the plan carries every limiter as a leaf joined by limiter_id',
      plan && ['LM1', 'LM2', 'LM3', 'LM4'].every(function (id) { return plan.leaves.some(function (l) { return l.limiter_id === id; }); }));
  }

  // D12 ratchet
  {
    function seedSettled(roomDir) {
      const key = perspective.limiterKey('Interface resistance at the anode');
      fs.mkdirSync(path.join(roomDir, 'research', 'earlier-run'), { recursive: true });
      fs.writeFileSync(path.join(roomDir, 'research', 'earlier-run', 'plan.json'), JSON.stringify({
        perspective: { ratchet: { settled: [{ limiter_key: key, column: 'assumed', evidence: ['ev-old'], run_ref: 'earlier-run' }] } },
      }));
    }
    const roomA = newRoom();
    seedSettled(roomA);
    const rA = await stageB(roomA, fixtures.walkedState({}), {});
    const ex = (rA.settled_excluded || []).filter(function (s) { return s.limiter_id === 'LM2'; })[0];
    C.check('D12 a limiter settled by an earlier filed run is excluded with its run_ref and gets no leaf',
      rA.ok === true && ex && ex.run_ref === 'earlier-run' && !rA.leaves.some(function (l) { return l.slots.limiter_id === 'LM2'; }) && rA.leaves.length === 2, JSON.stringify(rA).slice(0, 400));

    const roomB = newRoom();
    seedSettled(roomB);
    const lims = clone(out63()['sr:6'].output.limiters);
    lims.forEach(function (l) { if (l.id === 'LM2') l.new_evidence = ['ev-new']; });
    const rB = await stageB(roomB, fixtures.walkedState({ outputs: { 'sr:6': { limiters: lims } } }), {});
    C.check('D12 the same limiter with new evidence is kept and the engine warns reopened_with_new_evidence',
      rB.ok === true && rB.leaves.some(function (l) { return l.slots.limiter_id === 'LM2'; }) && (rB.settled_excluded || []).length === 0
      && (rB.warnings || []).some(function (w) { return String(w).indexOf('reopened_with_new_evidence') === 0; }), JSON.stringify(rB).slice(0, 400));
  }

  // D13 rubric
  {
    const ids = RUBRIC.items.map(function (i) { return i.id; });
    C.check('D13 RUBRIC is frozen with falsifiability, controls, priors and mechanism_vs_property',
      Object.isFrozen(RUBRIC) && JSON.stringify(ids) === '["falsifiability","controls","priors","mechanism_vs_property"]'
      && RUBRIC.label === 'plugin-side rubric, not Theo content' && RUBRIC.items.every(function (i) { return typeof i.check === 'string' && i.check.length > 10; }), JSON.stringify(ids));
    const lines = door.rubricLines();
    C.check('D13 rubricLines is markdown whose heading carries the label', typeof lines === 'string' && /^#+ .*plugin-side rubric, not Theo content/m.test(lines), String(lines).slice(0, 120));
    C.check('D13 no rubric item carries a Theo stepId', RUBRIC.items.every(function (i) { return i.stepId === undefined; }) && JSON.stringify(RUBRIC).indexOf('stepId') === -1);
    const r = await stageB(newRoom(), fixtures.walkedState({}), {});
    C.check('D13 stageB returns the rubric', r.ok === true && r.rubric === RUBRIC);
  }

  // D14 Part 3 gate
  {
    const s7 = advanceTo(make().state, 'sr:7');
    const bad = recordStage(s7, 'sr:7', { decision: 'reject', reason: '' });
    C.check('D14 sr:7 reject with an empty reason refuses reason_required', bad.ok === false && bad.reason === 'reason_required', JSON.stringify(bad));
    const good = recordStage(s7, 'sr:7', { decision: 'reject', reason: 'ranking ignores supply risk' });
    C.check('D14 sr:7 reject with a reason keeps it open; defer pauses; approve moves on',
      good.ok === true && nextStage(good.state) === 'sr:7' && recordStage(s7, 'sr:7', { decision: 'defer' }).paused === true
      && nextStage(recordStage(s7, 'sr:7', out63()['sr:7']).state) === 'stage_b');
    C.check('D14 the gate map: sr:7 F.0, systems_pass F.1, sr:5 F.4, sr:6 F.8, stage_b F.6, filing F.8',
      STAGE_GATES['sr:7'] === 'F.0' && STAGE_GATES.systems_pass === 'F.1' && STAGE_GATES['sr:5'] === 'F.4' && STAGE_GATES['sr:6'] === 'F.8'
      && STAGE_GATES.stage_b === 'F.6' && STAGE_GATES.filing === 'F.8' && Object.isFrozen(STAGE_GATES) && Object.isFrozen(STAGES)
      && STAGES.join(',') === 'sr:1,sr:2,sr:3,sr:4,systems_pass,sr:5,sr:6,sr:7,stage_b,filing');
  }

  // D15 static scan
  {
    const lines = hygiene.nonCommentLines(MOD_PATH);
    const hits = [];
    lines.forEach(function (line) { FORBIDDEN.forEach(function (w) { if (line.indexOf(w) !== -1) hits.push(w + ' :: ' + line.trim().slice(0, 80)); }); });
    C.check('D15 sr-door.cjs names no ledger, local template, corpus, cache, fetcher, grant, runner or write call', hits.length === 0, hits.join(' | '));
    const doorLines = lines.join('\n');
    C.check('D15 the door reaches the one planner and binds the engine api_version', /buildPlan\(/.test(doorLines) && /api_version/.test(doorLines));
  }

  // D16 no fabricated content
  {
    const keyQuestions = perspective.srStepGuide(null).steps.map(function (s) { return s.key_question; });
    const allNull = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/364-theo/framework-step-all-null.json'), 'utf8'));
    const fakeClient = { callTool: async function () { return JSON.parse(JSON.stringify(allNull)); }, recommendChain: async function () { return null; } };
    const theo = await readSrSteps({ brainClient: fakeClient });
    const e = fixtures.syntheticEntry();
    const refused = createRun({ entry: e, theo: theo, confirmedWhat: e.what.candidates[0], coverage: COVERAGE });
    C.check('D16 the all-null Theo state refuses and the refusal carries no local step text',
      refused.ok === false && refused.reason === 'theo_refused' && refused.message === REFUSAL && keyQuestions.every(function (k) { return JSON.stringify(refused).indexOf(k) === -1; }), JSON.stringify(refused));
    const roomDir = newRoom();
    const r = await stageB(roomDir, fixtures.walkedState({}), {});
    const blob = JSON.stringify({ state: r.state, card: r.card, leaves: r.leaves, qs: buildQuestionSet(r.state, {}), rub: door.rubricLines() });
    C.check('D16 no door output contains a local step-guide key question', keyQuestions.every(function (k) { return blob.indexOf(k) === -1; }));
    // D17 hyphens only
    C.check('D17 no door output string contains an em-dash or en-dash', !NO_DASH.test(blob) && !NO_DASH.test(JSON.stringify(refused)));
  }

  C.check('D17 zero network attempts', net.attempts() === 0, String(net.attempts()));
  process.exit(C.summary());
}

main().catch(function (e) { console.log('FAIL: D1 unexpected error ' + (e && e.stack || e)); process.exit(1); });
