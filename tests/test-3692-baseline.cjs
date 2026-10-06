#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 23 (369.2-R17; HARNESS-10, plan-time half). A deep plan with at least one limiter carries a
 * bounded field scan composed at plan time: at most four queries, one per facet, built from the governing
 * question and the practice kind. The card lists the scan first and the run grant covers its strings.
 * Plan 24 (369.2-R17, execution half) adds the run-time legs BE1-BE6: round 0 runs the scan before any
 * limiter is ranked, a limiter the field refuted is demoted and never leads (brief test 20).
 *
 *   BP1  buildPlan(deep) on the scientific-roadmapping fixture: plan.baseline.queries has 4 entries in facet
 *        order (deployed_practice, primary_terminology, recent_state_of_the_art, challenge_source), each with
 *        kind baseline, round 0, a q and a q_hash; a deep plan with no limiter and a quick plan carry none;
 *        a top-ranked limiter leaf with a practice kind feeds the deployed_practice query
 *   BP2  the plan review card holds 'Field scan first, sent exactly as written:' before the sub-questions,
 *        with one line per query and each q byte for byte; a plan with no baseline has no such line
 *   BP3  buildRunGrant(plan).approved_hashes holds every baseline q_hash; validateExecutedQuery for a round 0
 *        query: a hash not on the card refuses hash_not_approved, an approved hash is ok
 *   BP4  plan.budget.baseline_max 0 turns the scan off; 2 keeps the first two facets; 5 is refused
 *
 *   BE1  a deep SR run with plan.baseline opens with round 0 (lane BL, 4 baseline queries), every baseline op reaches a
 *        terminal state, round one is still round 1
 *   BE2  brief test 20: a BL row that contradicts LM1's leaf sets LM1.baseline contradicted; LM1 led before (rank 1),
 *        does not lead after round 0, sorts after every other limiter, and is not the next binding constraint
 *   BE3  no contradicting row: the round-one lane order equals today's; a supports row gives supported, same order
 *   BE4  a limiter promoted into the top lanes but outside the approved set goes through the extend card; nothing
 *        for it is fetched before approval; declining it continues with the approved lanes
 *   BE5  the HARNESS-01 cap-8 replay still executes at least 1 counterevidence search; baseline searches count
 *        against the cap
 *   BE6  a baseline string equal to a round-one string is not run twice (dropped from round 0, no op minted)
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads; vendor
 * keys are deleted; no network call is made (the net guard counts attempts).
 *
 * Output: one PASS or FAIL line per leg, then PASS: n FAIL: n. Exit 0 pass, 1 fail.
 * House rule: hyphens only.
 */

const real = require('./helpers/real-corpus-3692.cjs');
const hermetic = real.hermeticEnv();
['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL'].forEach(function (k) {
  process.env[k] = hermetic[k];
});
real.VENDOR_KEYS.forEach(function (k) { delete process.env[k]; });
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3692-baseline');

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const deepMod = require(path.join(RP, 'deep.cjs'));
const operations = require(path.join(RP, 'operations.cjs'));
const perspectiveMod = require(path.join(RP, 'perspective.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
const { makeReplayFetch } = require('./helpers/openalex-replay-363.cjs');
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));

const QS_SR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const QS_WS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
const BODIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-23-test' };
const NOW = new Date('2026-10-04T00:00:00Z');

const FACETS = ['deployed_practice', 'primary_terminology', 'recent_state_of_the_art', 'challenge_source'];
const FACET_WORDS = {
  deployed_practice: 'what is deployed today',
  primary_terminology: 'what the field calls it',
  recent_state_of_the_art: 'what is new',
  challenge_source: 'what argues against it',
};
const HEADER = 'Field scan first, sent exactly as written:';
const PRACTICE = 'solid electrolyte interphase coatings';

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}
process.on('exit', function () {
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* best effort */ } });
});

function clone(v) { return JSON.parse(JSON.stringify(v)); }

async function leg(name, fn) {
  try {
    const r = await fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 500));
  }
}

function build(room, qsIn, mode, mutate) {
  const qs = clone(qsIn);
  if (mutate) mutate(qs);
  const built = planner.buildPlan(room.roomDir, qs, { mode: mode, now: NOW });
  if (!built.ok) throw new Error('buildPlan ' + JSON.stringify(built).slice(0, 300));
  return built;
}
function baselineOf(plan) { return plan.baseline && Array.isArray(plan.baseline.queries) ? plan.baseline.queries : []; }


// ---- 369.2-24 helpers: the deep driver with a round 0 aware analyst ----
function srRoute(q) {
  const s = String(q || '');
  if (/limiter binds first unlocks/.test(s)) return /success OR adoption/.test(s) ? 'retest_hit' : 'gap_primary_zero';
  if (/fundamental limit/.test(s)) return 'derivation_hit';
  if (/overcome/.test(s)) return 'retest_hit';
  if (/saturation/.test(s)) return /host volume swing/.test(s) ? 'scurve_headroom' : 'scurve_ceiling';
  if (/\(review OR survey\)/.test(s)) return 'prior_review_two';
  return 'gap_primary_zero';
}
function rowOf(key, i, leaf, label) {
  const r = BODIES[key].results[i];
  return { leaf_id: leaf, record_id: r.id, claim: 'c ' + leaf, quote: r.title, label: label };
}
// the replayed field record describes a deployed countermeasure that refutes LM1 (synthetic fixture text)
function contradictLm1(p, round) {
  return round === 0 && p.lane === 'BL' ? [rowOf('retest_hit', 0, 'L8', 'contradicts')] : [];
}
// LM1 leads the ranking: assumed, with the longest field chain
function leadLm1(qs) {
  const p = qs.perspective;
  const lm1 = p.limiters.filter(function (l) { return l.id === 'LM1'; })[0];
  lm1.column = 'assumed';
  delete lm1.derivation;
  lm1.s_curve = 'unknown';
  lm1.question = 'Is the host lattice capacity truly capped at this chemistry?';
  p.unlock_chains.push({ limiter_id: 'LM1', steps: [
    { pushed_by: 'field', kind: 'field', note: 'a new host' },
    { pushed_by: 'field', kind: 'field', note: 'a new binder' },
    { pushed_by: 'field', kind: 'adoption', note: 'cell maker qualification' },
  ] });
  p.ranking = ['LM1', 'LM2', 'LM3', 'LM4'];
}
function deepPlan(room, budget, mutate) {
  const qs = clone(QS_SR);
  if (mutate) mutate(qs);
  const built = planner.buildPlan(room.roomDir, qs, { mode: 'deep', now: NOW });
  if (!built.ok) throw new Error('buildPlan ' + JSON.stringify(built).slice(0, 300));
  const plan = built.plan;
  Object.assign(plan.budget, budget || {});
  plan.plan_hash = planMod.planHash(plan);
  return plan;
}
function seam() {
  const rp = makeReplayFetch({ route: srRoute, bodies: BODIES });
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = rp;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
}
async function driveBe(room, plan, o) {
  const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
  if (!w.ok) throw new Error('grant refused ' + JSON.stringify(w));
  const init = deepMod.initDeepState(room.roomDir, plan, w.grant, {});
  if (!init.ok) throw new Error('init ' + JSON.stringify(init));
  const id = plan.run_id;
  const env = { fetchEnvelopeFn: seam() };
  const out = { plan: plan, first: null, round0: null, fetchRounds: [], result: null, maxRounds: init.state.max_rounds };
  let sawRound0 = false;
  for (let g = 0; g < 90; g += 1) {
    const n = deepMod.nextDeepStep(room.roomDir, id);
    if (!n.ok) throw new Error('nextDeepStep ' + JSON.stringify(n));
    if (out.first === null) out.first = n;
    if (n.step === 'validate' && sawRound0 && out.round0 === null) out.round0 = deepMod.loadState(room.roomDir, id).state;
    if (n.step === 'fetch_round') {
      if (n.round === 0) sawRound0 = true;
      out.fetchRounds.push(n.round);
      const fr = await deepMod.fetchRound(room.roomDir, id, env);
      if (!fr.ok) throw new Error('fetchRound ' + JSON.stringify(fr));
    } else if (n.step === 'dispatch_lanes') {
      n.payload.lanes.forEach(function (p) { deepMod.recordLaneRows(room.roomDir, id, p.lane, o.analyst(p, n.round)); });
    } else if (n.step === 'reflect') {
      deepMod.proposeFollowups(room.roomDir, id, []);
    } else if (n.step === 'extend_card') {
      const st = deepMod.loadState(room.roomDir, id).state;
      const d = typeof o.onExtend === 'function' ? o.onExtend(n, st) : 'stop';
      const r = d === 'extend' ? deepMod.applyExtendDecision(room.roomDir, id, 'extend', { approved_via: VIA }) : deepMod.applyExtendDecision(room.roomDir, id, 'stop', {});
      if (!r.ok) throw new Error('applyExtendDecision ' + JSON.stringify(r));
    } else if (n.step === 'counterevidence') {
      const ce = await deepMod.runCounterevidence(room.roomDir, id, env);
      if (!ce.ok) throw new Error('runCounterevidence ' + JSON.stringify(ce));
      if (ce.lane_payload) deepMod.recordLaneRows(room.roomDir, id, 'CE', []);
    } else if (n.step === 'synthesize') {
      out.result = deepMod.synthesize(room.roomDir, id);
      break;
    } else if (n.step === 'done') {
      break;
    }
  }
  if (!out.result || !out.result.ok) throw new Error('synthesize ' + JSON.stringify(out.result).slice(0, 300));
  out.finalState = deepMod.loadState(room.roomDir, id).state;
  // the OpenAlex rolling budget (100 calls in 24h) lives in the hermetic HOME and this file runs many deep
  // runs in one process: reset it between runs so a later leg is not starved by an earlier one
  try { fs.unlinkSync(require(path.join(ROOT, 'lib', 'core', 'rs-egress-telemetry.cjs')).TELEMETRY_FILE); } catch (_e) { /* no file yet */ }
  return out;
}
async function runBe1() {
  const room = newRoom();
  const plan = deepPlan(room, {});
  const run = await driveBe(room, plan, { analyst: function () { return []; } });
  run.baselineOps = operations.readLedger(room.roomDir, plan.run_id).operations.filter(function (o) { return o.kind === 'baseline'; });
  return run;
}

async function main() {
  // ---- BP1 ----
  await leg('BP1 a deep plan with a limiter carries four field-scan queries, one per facet, kind baseline, round 0', async function () {
    const room = newRoom();
    const plan = build(room, QS_SR, 'deep').plan;
    const qs = baselineOf(plan);
    console.log('BP1 measured: ' + qs.map(function (q) { return q.facet + '=' + q.q; }).join(' | '));
    assert.strictEqual(qs.length, 4, 'baseline queries ' + qs.length);
    assert.deepStrictEqual(qs.map(function (q) { return q.facet; }), FACETS);
    qs.forEach(function (q) {
      assert.strictEqual(q.kind, 'baseline', 'kind ' + q.kind);
      assert.strictEqual(q.round, 0, 'round ' + q.round);
      assert.ok(typeof q.q === 'string' && q.q.length > 0, 'q missing');
      assert.ok(/^sha256:[0-9a-f]{64}$/.test(String(q.q_hash)), 'q_hash ' + q.q_hash);
      assert.ok(q.audit === 'pass' || q.audit === 'not_applicable', 'audit ' + q.audit);
    });
    assert.ok(qs[2].q.indexOf('systematic review') !== -1, 'recent facet lacks the review cover: ' + qs[2].q);
    assert.ok(qs[3].q.indexOf('limitation OR failure') !== -1, 'challenge facet lacks the counter cover: ' + qs[3].q);
    assert.ok(qs[0].q.indexOf('success OR adoption') !== -1, 'practice facet lacks the success cover: ' + qs[0].q);
    assert.ok(planMod.validatePlan(plan).ok, 'plan invalid: ' + JSON.stringify(planMod.validatePlan(plan).errors));
    return true;
  });

  await leg('BP1b no baseline on a deep plan with no limiter, and none on a quick plan', async function () {
    const room = newRoom();
    const noLim = build(room, QS_WS, 'deep').plan;
    assert.ok(noLim.baseline === undefined, 'baseline on a plan with no limiter');
    const quick = build(room, QS_SR, 'quick').plan;
    assert.ok(quick.baseline === undefined, 'baseline on a quick plan');
    return true;
  });

  await leg('BP1c the top-ranked limiter leaf practice kind feeds the deployed_practice query', async function () {
    const room = newRoom();
    const plan = build(room, QS_SR, 'deep', function (qs) {
      const rank1 = qs.perspective.limiters.filter(function (l) { return l.id === 'LM2'; })[0];
      assert.ok(rank1, 'fixture has no LM2');
      qs.leaves.forEach(function (l) { if (l.id === 'L9') l.query_kinds = { practice: PRACTICE }; });
    }).plan;
    const first = baselineOf(plan)[0];
    assert.ok(first && first.facet === 'deployed_practice', 'first facet ' + (first && first.facet));
    assert.ok(first.q.indexOf(PRACTICE) !== -1, 'practice value missing: ' + first.q);
    const second = baselineOf(plan)[1];
    assert.ok(second.q.indexOf(PRACTICE) === -1, 'the terminology facet used the practice value: ' + second.q);
    return true;
  });

  // ---- BP2 ----
  await leg('BP2 the plan review card lists the field scan first, every string exactly as it will be sent', async function () {
    const room = newRoom();
    const plan = build(room, QS_SR, 'deep').plan;
    const body = String(planMod.planReviewCard(plan).body_md || '');
    const at = body.indexOf(HEADER);
    assert.ok(at !== -1, 'header missing');
    const sub = body.indexOf('### Sub-questions');
    assert.ok(sub !== -1 && at < sub, 'the field scan is not before the sub-questions');
    baselineOf(plan).forEach(function (q) {
      const line = '- ' + FACET_WORDS[q.facet] + ': ' + q.q;
      assert.ok(body.indexOf(line) !== -1, 'card line missing: ' + line);
      assert.ok(body.indexOf(line) > at && body.indexOf(line) < sub, 'line outside the field scan block: ' + line);
    });
    const noLim = build(room, QS_WS, 'deep').plan;
    assert.ok(String(planMod.planReviewCard(noLim).body_md).indexOf(HEADER) === -1, 'header on a plan with no baseline');
    return true;
  });

  // ---- BP3 ----
  await leg('BP3 the run grant covers the baseline strings; a round 0 string not on the card refuses hash_not_approved', async function () {
    const room = newRoom();
    const plan = build(room, QS_SR, 'deep').plan;
    const proposal = grants.buildRunGrant(plan);
    baselineOf(plan).forEach(function (q) {
      assert.ok(proposal.approved_hashes.indexOf(q.q_hash) !== -1, 'approved_hashes lacks ' + q.facet);
      assert.ok(proposal.families.indexOf(q.family) !== -1, 'families lacks ' + q.family);
    });
    proposal.room_id = grants.roomIdFor(room.roomDir);
    const w = grants.writeGrant(room.roomDir, proposal, { approved_via: VIA });
    assert.ok(w.ok, 'grant ' + JSON.stringify(w));
    const st = { room_id: proposal.room_id, now: Date.now(), searches_used: 0, round: 0, runs_in_window: 0 };
    const mk = function (q, over) {
      return Object.assign({ q: q.q, q_hash: q.q_hash, template_id: q.template_id, family: q.family, provider: 'openalex', audit: q.audit, slot_terms: q.slot_terms || [], round: 0, trigger: 'navigator' }, over || {});
    };
    const first = baselineOf(plan)[0];
    const ok = grants.validateExecutedQuery(mk(first), w.grant, st);
    assert.strictEqual(ok.ok, true, 'approved round 0 refused: ' + JSON.stringify(ok));
    const stray = grants.validateExecutedQuery(mk(first, { q: first.q + ' extra', q_hash: 'sha256:' + '0'.repeat(64) }), w.grant, st);
    assert.ok(stray.ok === false && stray.reason === 'hash_not_approved', 'stray round 0 verdict ' + JSON.stringify(stray));
    return true;
  });

  // ---- BP4 ----
  await leg('BP4 baseline_max 0 turns the scan off, 2 keeps deployed_practice and primary_terminology, above 4 is refused', async function () {
    const room = newRoom();
    const built = build(room, QS_SR, 'deep');
    assert.strictEqual(built.plan.budget.baseline_max, planMod.BUDGETS.DEEP_BASELINE_MAX, 'default baseline_max ' + built.plan.budget.baseline_max);
    assert.strictEqual(planMod.BUDGETS.DEEP_BASELINE_MAX, 4);
    const over = planner.revisePlan(room.roomDir, built.run_id, { op: 'set_budget', budget: { baseline_max: 5 } }, {});
    assert.ok(over.ok === false && over.reason === 'over_cap', 'baseline_max 5 verdict ' + JSON.stringify(over).slice(0, 160));
    const two = planner.revisePlan(room.roomDir, built.run_id, { op: 'set_budget', budget: { baseline_max: 2 } }, {});
    assert.ok(two.ok, 'set 2 ' + JSON.stringify(two).slice(0, 200));
    assert.deepStrictEqual(baselineOf(two.plan).map(function (q) { return q.facet; }), ['deployed_practice', 'primary_terminology']);
    const zero = planner.revisePlan(room.roomDir, built.run_id, { op: 'set_budget', budget: { baseline_max: 0 } }, {});
    assert.ok(zero.ok, 'set 0 ' + JSON.stringify(zero).slice(0, 200));
    assert.ok(zero.plan.baseline === undefined, 'baseline present with baseline_max 0');
    return true;
  });


  // ---------------------------------------------------------------------------------------------
  // 369.2-24: the run-time legs (round 0, limiter.baseline, the re-rank)
  // ---------------------------------------------------------------------------------------------
  const TERMINAL = ['executed_with_results', 'executed_empty', 'refused_before_fetch', 'not_executed'];
  const be1 = await runBe1();
  await leg('BE1 a deep SR run with plan.baseline opens with round 0 (lane BL, 4 queries); every baseline op ends terminal; round one is still round 1', async function () {
    console.log('BE1 measured: first step=' + be1.first.step + ' round=' + be1.first.round + ' lanes=' + JSON.stringify(be1.first.payload.lanes.map(function (l) { return l.lane + ':' + l.queries.length; })) + ' baseline ops=' + be1.baselineOps.length + ' states=' + be1.baselineOps.map(function (o) { return o.state; }).join(',') + ' fetch rounds=' + be1.fetchRounds.join(','));
    assert.strictEqual(be1.first.step, 'fetch_round');
    assert.strictEqual(be1.first.round, 0, 'first round ' + be1.first.round);
    assert.deepStrictEqual(be1.first.payload.lanes.map(function (l) { return l.lane; }), ['BL']);
    assert.strictEqual(be1.first.payload.lanes[0].queries.length, 4);
    assert.strictEqual(be1.baselineOps.length, 4, 'baseline ops ' + be1.baselineOps.length);
    be1.baselineOps.forEach(function (o) {
      assert.strictEqual(o.mandatory, true, 'baseline op not mandatory');
      assert.ok(TERMINAL.indexOf(o.state) !== -1, 'baseline op state ' + o.state);
    });
    assert.deepStrictEqual(be1.fetchRounds.slice(0, 2), [0, 1], 'fetch rounds ' + be1.fetchRounds.join(','));
    assert.ok(be1.maxRounds === be1.plan.budget.rounds, 'max_rounds moved: ' + be1.maxRounds);
    return true;
  });

  await leg('BE2 brief test 20: a contradicted limiter does not lead after round 0 and is not the next binding constraint', async function () {
    const room = newRoom();
    const plan = deepPlan(room, {}, leadLm1);
    const before = perspectiveMod.rankByUnlock(plan.perspective, {}).map(function (r) { return r.limiter_id; });
    const run = await driveBe(room, plan, { analyst: contradictLm1 });
    const snap = run.round0;
    const after = snap.baseline_ranking;
    console.log('BE2 measured: LM1 rank before=' + (before.indexOf('LM1') + 1) + ' after=' + (after.indexOf('LM1') + 1) + ' baseline=' + JSON.stringify(snap.perspective_baseline) + ' order after=' + after.join('>'));
    assert.strictEqual(before[0], 'LM1', 'the fixture does not lead with LM1: ' + before.join('>'));
    assert.strictEqual(snap.perspective_baseline.LM1, 'contradicted');
    ['LM2', 'LM3', 'LM4'].forEach(function (id) { assert.strictEqual(snap.perspective_baseline[id], null, id + ' baseline ' + snap.perspective_baseline[id]); });
    assert.notStrictEqual(after[0], 'LM1');
    assert.strictEqual(after[after.length - 1], 'LM1', 'LM1 is not last: ' + after.join('>'));
    // the pure functions agree with the controller
    const work = clone(plan.perspective);
    work.limiters.forEach(function (l) { l.baseline = l.id === 'LM1' ? 'contradicted' : null; });
    const ranked = perspectiveMod.rankByUnlock(work, {}).map(function (r) { return r.limiter_id; });
    assert.deepStrictEqual(ranked, after, 'rankByUnlock disagrees with the run: ' + ranked.join('>'));
    work.ranking = ['LM1', 'LM2', 'LM3', 'LM4'];
    const nb = perspectiveMod.nextBindingConstraint(work);
    assert.ok(nb && nb.id === 'LM2', 'next binding constraint ' + (nb && nb.id));
    // the finished run keeps the verdict on the perspective and never names LM1 as the next wall
    const lim = run.result.run.perspective.limiters.filter(function (l) { return l.id === 'LM1'; })[0];
    assert.strictEqual(lim.baseline, 'contradicted', 'run perspective LM1.baseline ' + lim.baseline);
    assert.notStrictEqual(run.result.run.next_binding_constraint, 'LM1');
    assert.notStrictEqual(run.result.run.perspective.ranking[0], 'LM1');
    return true;
  });

  await leg('BE3 without a contradicting row the round-one lane order equals today; a supports row gives supported and the same order', async function () {
    const room = newRoom();
    const plan = deepPlan(room, {}, leadLm1);
    const today = deepMod.roundOneQueries(plan).map(function (l) { return l.lane; });
    const none = await driveBe(room, plan, { analyst: function () { return []; } });
    assert.deepStrictEqual(none.round0.round_lanes['1'], today, 'lane order moved: ' + none.round0.round_lanes['1'].join('>'));
    Object.keys(none.round0.perspective_baseline).forEach(function (k) { assert.strictEqual(none.round0.perspective_baseline[k], null, k); });
    const room2 = newRoom();
    const plan2 = deepPlan(room2, {}, leadLm1);
    const sup = await driveBe(room2, plan2, { analyst: function (p, round) { return round === 0 && p.lane === 'BL' ? [rowOf('retest_hit', 0, 'L8', 'supports')] : []; } });
    console.log('BE3 measured: today=' + today.join('>') + ' none=' + none.round0.round_lanes['1'].join('>') + ' supports=' + sup.round0.round_lanes['1'].join('>') + ' LM1=' + sup.round0.perspective_baseline.LM1);
    assert.strictEqual(sup.round0.perspective_baseline.LM1, 'supported');
    assert.deepStrictEqual(sup.round0.round_lanes['1'], today);
    return true;
  });

  await leg('BE4 a lane the re-rank promotes goes through the extend card; nothing for it is fetched before approval; declining continues with the approved lanes', async function () {
    const room = newRoom();
    const plan = deepPlan(room, { breadth: 2 }, leadLm1);
    const approved = deepMod.roundOneQueries(plan).map(function (l) { return l.lane; });
    assert.deepStrictEqual(approved, ['LM1', 'LM2'], 'approved lanes ' + approved.join(','));
    const seen = {};
    const run = await driveBe(room, plan, {
      analyst: contradictLm1,
      onExtend: function (n, st) {
        seen.card = n.payload.card;
        seen.new_queries = n.payload.new_queries;
        seen.executedBefore = st.executed.map(function (q) { return q.lane; });
        seen.noApproval = deepMod.applyExtendDecision(room.roomDir, plan.run_id, 'extend', {});
        return 'extend';
      },
    });
    const lanes1 = run.finalState.executed.filter(function (q) { return q.round === 1; }).map(function (q) { return q.lane; });
    const order = lanes1.filter(function (l, i) { return lanes1.indexOf(l) === i; });
    console.log('BE4 measured: card=' + (seen.card && seen.card.shape) + ' new queries=' + (seen.new_queries || []).length + ' lanes executed before approval=' + JSON.stringify(seen.executedBefore) + ' round-one lane order=' + order.join('>'));
    assert.ok(seen.card && seen.card.shape === 'F.3', 'no extend card');
    assert.ok(seen.new_queries.length > 0, 'the card lists no queries');
    seen.new_queries.forEach(function (q) { assert.ok(String(seen.card.body_md).indexOf(q.q) !== -1, 'card lacks ' + q.q); });
    assert.ok(seen.executedBefore.every(function (l) { return l === 'BL'; }), 'a lane other than BL was fetched before approval: ' + seen.executedBefore.join(','));
    assert.strictEqual(seen.noApproval.ok, false);
    assert.strictEqual(seen.noApproval.reason, 'approval_required');
    assert.deepStrictEqual(order, ['LM2', 'LM3', 'LM1'], 'round one order ' + order.join('>'));
    // declined: the approved lanes only, in the new order, and the run is not stopped
    const room2 = newRoom();
    const plan2 = deepPlan(room2, { breadth: 2 }, leadLm1);
    const run2 = await driveBe(room2, plan2, { analyst: contradictLm1, onExtend: function () { return 'stop'; } });
    const lanes2 = run2.finalState.executed.filter(function (q) { return q.round === 1; }).map(function (q) { return q.lane; });
    const order2 = lanes2.filter(function (l, i) { return lanes2.indexOf(l) === i; });
    console.log('BE4 measured (declined): round-one lane order=' + order2.join('>') + ' stop_reason=' + run2.finalState.stop_reason);
    assert.deepStrictEqual(order2, ['LM2', 'LM1'], 'declined round one order ' + order2.join('>'));
    assert.notStrictEqual(run2.finalState.stop_reason, 'navigator_stop');
    assert.ok(run2.finalState.executed.every(function (q) { return q.lane !== 'LM3'; }), 'LM3 fetched without approval');
    return true;
  });

  await leg('BE5 the cap-8 replay still executes at least one counterevidence search; baseline searches count against the cap', async function () {
    const room = newRoom();
    const plan = deepPlan(room, { max_searches: 8 });
    const run = await driveBe(room, plan, { analyst: function () { return []; } });
    const ledger = operations.readLedger(room.roomDir, plan.run_id);
    const ops = ledger.operations;
    const done = function (o) { return o.state === 'executed_with_results' || o.state === 'executed_empty'; };
    const cePass = ops.filter(function (o) { return typeof o.plan_dimension === 'string' && o.plan_dimension.indexOf('CE:') === 0 && done(o); }).length;
    const baseDone = ops.filter(function (o) { return o.kind === 'baseline' && done(o); }).length;
    const roundSpend = ops.filter(function (o) { return !(typeof o.plan_dimension === 'string' && o.plan_dimension.indexOf('CE:') === 0) && done(o); }).length;
    console.log('BE5 measured: cap=8 ce_reserve=' + run.finalState.ce_reserve + ' baseline executed=' + baseDone + ' round and baseline searches=' + roundSpend + ' ce pass executed=' + cePass + ' searches_used=' + run.finalState.searches_used + ' status=' + run.result.run.counterevidence.status);
    assert.ok(baseDone >= 1, 'no baseline search ran');
    assert.ok(cePass >= 1, 'the counterevidence pass executed=' + cePass);
    assert.ok(roundSpend <= 8 - run.finalState.ce_reserve, 'rounds and baseline spent ' + roundSpend + ' of ' + (8 - run.finalState.ce_reserve));
    assert.ok(run.finalState.searches_used <= 8, 'searches_used ' + run.finalState.searches_used);
    return true;
  });

  await leg('BE6 a baseline string equal to a round-one string is run once, in round one', async function () {
    const room = newRoom();
    const plan0 = deepPlan(room, {});
    const r1 = deepMod.roundOneQueries(plan0)[0].queries[0];
    const plan = clone(plan0);
    const b0 = plan.baseline.queries[0];
    ['q', 'q_hash', 'template_id', 'family', 'audit', 'slot_terms'].forEach(function (k) { b0[k] = clone(r1[k]); });
    plan.plan_hash = planMod.planHash(plan);
    const run = await driveBe(room, plan, { analyst: function () { return []; } });
    const times = run.finalState.executed.filter(function (q) { return q.q_hash === r1.q_hash; });
    const bl = operations.readLedger(room.roomDir, plan.run_id).operations.filter(function (o) { return o.kind === 'baseline'; });
    console.log('BE6 measured: shared string executed ' + times.length + ' time(s) in round ' + times.map(function (q) { return q.round; }).join(',') + '; baseline ops ' + bl.length);
    assert.strictEqual(times.length, 1, 'executed ' + times.length + ' times');
    assert.strictEqual(times[0].round, 1);
    assert.strictEqual(bl.length, 3, 'baseline ops ' + bl.length);
    return true;
  });

  const guardCalls = typeof NET.attempts === 'function' ? NET.attempts() : 0;
  check('BP net guard: no real network call', guardCalls === 0, 'attempts ' + guardCalls);
  const bad = fs.readFileSync(__filename, 'utf8').split('').some(function (ch) { return ch === String.fromCharCode(0x2013) || ch === String.fromCharCode(0x2014); });
  check('BP no em or en dash in this file', !bad, 'dash found');
  process.exit(summary());
}

main().catch(function (e) {
  console.error('FAIL: harness ' + String((e && e.stack) || e));
  process.exit(1);
});
