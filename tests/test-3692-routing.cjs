#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 17 (369.2-R10, R11; SEED-118 D4 and D5; Phase 0 probes CODE-05 and CODE-06; brief tests
 * 4 and 5). Two input-mangling defects become typed refusals before fetch.
 *
 * Measured before this plan: with every limiter slot unbound, 4 lanes and 8 queries each sent the full
 * limiter statement as a quoted phrase (a 132-character sentence left as one quoted phrase), and
 * bad_slot:limiter was emitted 0 times. mu.verify supplied {term, term2} composed 2 queries with term2 in 0
 * of them while the lane returned evidence for the wrong subject.
 *
 *   R0   OK-02 and OK-03 hold: no nameable limiter still makes a wish with no deep_run, and a handwritten
 *        query string in an edit still refuses
 *   R5a  a scientific-roadmapping plan with every limiter slot unbound: no round-one query carries a limiter
 *        statement, the lanes carry bad_slot:limiter, the saved leaves carry leaf.refusal bad_slot:limiter
 *   R5b  the 132-character sentence limiter: no query contains it, bad_slot:limiter is present
 *   R5c  initDeepState on a plan with one unbound limiter: the ledger holds refused_before_fetch bad_slot:limiter
 *        for it and the plan card asks for the wall in a few words
 *   R5d  counterevidence: an assumed limiter whose statement is a sentence is a CE gap bad_slot:limiter (a
 *        refused_before_fetch op), a sentence goal target is a gap bad_slot:goal, a term-shaped goal target
 *        ('energy density') still composes
 *   R5e  counterevidence: an assumed limiter of 5 or more content words and no punctuation is still a sentence:
 *        a CE gap bad_slot:limiter, never a quoted phrase; a 4-word goal target still composes (quick 261006)
 *   R6a  composeForLeaf mu.verify {term, term2}: refused unused_slot:term2, no query
 *   R6b  a slot the lens does consume (eu.transfer term2, ws.gap synonyms) still composes
 *   R6c  a quick plan with that leaf: local-only with leaf.refusal unused_slot:term2, the card names the reason
 *   R6d  the helper consumedSlots(lensId) names the union of needs over round one and round two
 *   R7   no em-dash or en-dash in this file
 *
 * Phase 369.2 Plan 19 (369.2-R09; SEED-118 D2 and D3; Phase 0 probes CODE-03 and CODE-04; brief tests 2 and 3).
 * Every leaf fetches its own search and every slot on the plan is sent or refused by name.
 *
 * Measured before plan 19: two leaves sharing one lens: queries by leaf L1=2, L2=0, L3=1 and the L2 term
 * in 0 queries; a scientific-roadmapping plan: 8 round-one queries, all ci.derivation and ci.retest, the L1
 * marker term in 0 queries and the L6 extra term in 0 queries and in no typed refusal.
 *
 *   R3a  CODE-03 plan: every researchable leaf has at least 1 round-one query, and the L2 term is in a query
 *   R3b  CODE-03 plan driven to synthesize: every researchable leaf has a terminal ledger op
 *   R3c  three leaves on one lens: the lane spends at least 3 queries when the cap allows; when the search cap
 *        allows 1, the leaves left without a query have a not_executed op with reason search_cap
 *   R3d  roundOneQueries gives the same hashes when it runs again on the saved plan, and the run grant approves
 *        every query it returns
 *   R4a  CODE-04 plan: the L1 marker is in a round-one query, the limiter marker still is
 *   R4b  CODE-04 plan: the L6 extra term is in a query or the leaf carries refusal unused_slot:term
 *   R4c  a limiter-lane leaf with a non-ci lens and its own term sends that term, the ci queries stay
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads; vendor
 * keys are deleted; the provider is the OpenAlex replay reached through the REAL corpus path; a net guard
 * counts any fetch that escapes the replay.
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
const { check, summary } = makeChecker('test-3692-routing');

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const deepMod = require(path.join(RP, 'deep.cjs'));
const families = require(path.join(RP, 'families.cjs'));
const operations = require(path.join(RP, 'operations.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
const { makeReplayFetch } = require('./helpers/openalex-replay-363.cjs');
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));

const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
const QS_SR = JSON.parse(fs.readFileSync(path.join(QS_DIR, 'scientific-roadmapping.json'), 'utf8'));
const QS_WS = JSON.parse(fs.readFileSync(path.join(QS_DIR, 'whitespace-quick.json'), 'utf8'));
const QS_NOLIM = JSON.parse(fs.readFileSync(path.join(QS_DIR, 'map-unknowns.json'), 'utf8'));
const BODIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-17-test' };
const NOW = new Date('2026-10-04T00:00:00Z');
// the CODE-05 / 02 sentence, 132 characters
const SENT = 'Thin wires cannot be reliably detected by the autonomous terminal guidance stack because contrast falls below sensor noise at range?';
const WALL_WORDS = 'the wall it tests is written as a sentence; name it in a few words';
const EXTRA_WORDS = 'the extra term given for it is not used by its search shape';

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

// a scientific-roadmapping question set with the slots of the named leaves cleared
function srSet(unbindLeafIds) {
  const qs = clone(QS_SR);
  qs.leaves.forEach(function (l) { if (unbindLeafIds.indexOf(l.id) !== -1) l.slots = {}; });
  return qs;
}
const LIMITER_LEAVES = ['L6', 'L7', 'L8', 'L9', 'L10', 'L11'];

function buildDeep(room, qs) {
  const built = planner.buildPlan(room.roomDir, qs, { mode: 'deep', now: NOW });
  if (!built.ok) throw new Error('buildPlan ' + JSON.stringify(built).slice(0, 200));
  return built.plan;
}

function statementsOf(plan) {
  return plan.perspective.limiters.map(function (l) { return String(l.statement || l.label || '').trim(); }).filter(function (s) { return s.length > 0; });
}

// how many round-one queries (leaf queries and roundOneQueries) carry any limiter statement
function quotedStatementQueries(plan, r1) {
  const stmts = statementsOf(plan).map(function (s) { return s.toLowerCase().slice(0, 40); });
  const qs = [];
  plan.leaves.forEach(function (l) { (l.queries || []).forEach(function (q) { qs.push(String(q.q)); }); });
  r1.forEach(function (lane) { lane.queries.forEach(function (q) { qs.push(String(q.q)); }); });
  const distinct = qs.filter(function (q, i) { return qs.indexOf(q) === i; });
  return distinct.filter(function (q) {
    const low = q.toLowerCase();
    return stmts.some(function (s) { return low.indexOf(s) !== -1; });
  }).length;
}

function srRoute() { return 'gap_primary_zero'; }
function deepSeam() {
  const rp = makeReplayFetch({ route: srRoute, bodies: BODIES });
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = rp;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
}
function deepInit(room, plan) {
  const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
  if (!w.ok) throw new Error('deep grant refused ' + JSON.stringify(w));
  const init = deepMod.initDeepState(room.roomDir, plan, w.grant, {});
  if (!init.ok) throw new Error('init ' + JSON.stringify(init));
  return init;
}
// drive a deep run to synthesize with an analyst that keeps no rows (every limiter stays assumed)
async function driveDeep(room, plan) {
  const id = plan.run_id;
  const env = { fetchEnvelopeFn: deepSeam() };
  let result = null;
  for (let g = 0; g < 60; g += 1) {
    const n = deepMod.nextDeepStep(room.roomDir, id);
    if (!n.ok) throw new Error('nextDeepStep ' + JSON.stringify(n));
    if (n.step === 'fetch_round') {
      const fr = await deepMod.fetchRound(room.roomDir, id, env);
      if (!fr.ok) throw new Error('fetchRound ' + JSON.stringify(fr));
    } else if (n.step === 'dispatch_lanes') {
      n.payload.lanes.forEach(function (p) { deepMod.recordLaneRows(room.roomDir, id, p.lane, []); });
    } else if (n.step === 'reflect') {
      deepMod.proposeFollowups(room.roomDir, id, []);
    } else if (n.step === 'extend_card') {
      deepMod.applyExtendDecision(room.roomDir, id, 'stop', { approved_via: VIA });
    } else if (n.step === 'counterevidence') {
      const ce = await deepMod.runCounterevidence(room.roomDir, id, env);
      if (!ce.ok) throw new Error('runCounterevidence ' + JSON.stringify(ce));
      if (ce.lane_payload) deepMod.recordLaneRows(room.roomDir, id, 'CE', []);
    } else if (n.step === 'synthesize') {
      result = deepMod.synthesize(room.roomDir, id);
      break;
    } else if (n.step === 'done') {
      break;
    }
  }
  if (!result || !result.ok) throw new Error('synthesize ' + JSON.stringify(result));
  return result;
}
async function ceScenario(mutate) {
  const room = newRoom();
  const qs = clone(QS_SR);
  mutate(qs);
  const plan = buildDeep(room, qs);
  plan.budget.max_searches = 16;
  plan.plan_hash = planMod.planHash(plan);
  deepInit(room, plan);
  const result = await driveDeep(room, plan);
  return { plan: plan, run: result.run, ledger: operations.readLedger(room.roomDir, plan.run_id) };
}
function ceOps(ledger, dimension) {
  return ledger.operations.filter(function (o) { return o.plan_dimension === dimension; });
}

async function main() {
  // ---- R0 OK-02 and OK-03 preserved ----
  await leg('R0 no_nameable_limiter still refuses a deep plan, and a handwritten query still refuses', async function () {
    const room = newRoom();
    const built = planner.buildPlan(room.roomDir, clone(QS_NOLIM), { mode: 'deep', now: NOW });
    assert.ok(built.ok, 'buildPlan');
    assert.strictEqual(built.status, 'wish', 'status ' + built.status);
    assert.ok(built.errors.indexOf('no_nameable_limiter') !== -1, 'errors ' + JSON.stringify(built.errors));
    const card = planner.cardFor(room.roomDir, built.plan, {});
    assert.ok(card.next !== 'deep_run' && card.next !== 'review', 'cardFor offered ' + card.next);
    const ok = planner.buildPlan(room.roomDir, clone(QS_WS), { mode: 'quick', now: NOW });
    assert.ok(ok.ok && ok.plan.leaves.length > 0, 'quick plan');
    const e = planMod.applyEdit(ok.plan, { op: 'reword_leaf', leaf_id: ok.plan.leaves[0].id, question: 'a new question', q: '"x" AND y' }, {});
    assert.ok(!e.ok && e.reason === 'raw_query_refused', 'raw edit ' + JSON.stringify(e));
    assert.strictEqual(families.isRawQueryEdit({ q: 'x' }), true, 'isRawQueryEdit');
    return true;
  });

  // ---- R5a every limiter slot unbound ----
  await leg('R5a every limiter slot unbound: no quoted statement, lanes and leaves carry bad_slot:limiter', async function () {
    const room = newRoom();
    const plan = buildDeep(room, srSet(LIMITER_LEAVES));
    const r1 = deepMod.roundOneQueries(plan);
    const quoted = quotedStatementQueries(plan, r1);
    assert.strictEqual(quoted, 0, quoted + ' round-one queries carry a quoted limiter statement (' + r1.length + ' lanes with queries)');
    const refusals = Array.isArray(r1.refusals) ? r1.refusals : [];
    assert.strictEqual(refusals.length, 4, 'roundOneQueries refusals ' + refusals.length + ', expected 4 limiter lanes');
    refusals.forEach(function (x) { assert.strictEqual(x.reason, 'bad_slot:limiter', 'lane refusal ' + JSON.stringify(x)); });
    const limLeaves = plan.leaves.filter(function (l) { return l.limiter_id; });
    assert.ok(limLeaves.length >= 4, 'limiter leaves ' + limLeaves.length);
    const missing = limLeaves.filter(function (l) { return !(l.refusal && l.refusal.reason === 'bad_slot:limiter'); });
    assert.strictEqual(missing.length, 0, 'leaves without leaf.refusal bad_slot:limiter: ' + missing.map(function (l) { return l.id; }).join(','));
    return true;
  });

  // ---- R5b the sentence limiter ----
  await leg('R5b the 132-character sentence limiter is never quoted, bad_slot:limiter is present', async function () {
    assert.strictEqual(SENT.length, 132, 'sentence length ' + SENT.length);
    const room = newRoom();
    const plan = clone(buildDeep(room, clone(QS_SR)));
    plan.perspective.limiters[0].statement = SENT;
    plan.leaves.forEach(function (l) { l.slots = {}; l.queries = []; });
    const r1 = deepMod.roundOneQueries(plan);
    const text = JSON.stringify(r1);
    assert.ok(text.indexOf(SENT.slice(0, 40)) === -1, 'the sentence left as a query (' + r1.length + ' lanes)');
    const lm1 = (Array.isArray(r1.refusals) ? r1.refusals : []).filter(function (x) { return x.lane === 'LM1'; });
    assert.strictEqual(lm1.length, 1, 'LM1 refusals ' + lm1.length);
    assert.strictEqual(lm1[0].reason, 'bad_slot:limiter', 'reason ' + lm1[0].reason);
    return true;
  });

  // ---- R5c ledger and card ----
  await leg('R5c ledger holds refused_before_fetch bad_slot:limiter and the card asks for the wall in a few words', async function () {
    const room = newRoom();
    const plan = buildDeep(room, srSet(['L9']));
    deepInit(room, plan);
    const ledger = operations.readLedger(room.roomDir, plan.run_id);
    const refused = ledger.operations.filter(function (o) { return o.state === 'refused_before_fetch' && o.reason === 'bad_slot:limiter'; });
    assert.ok(refused.length >= 1, 'refused_before_fetch bad_slot:limiter ops ' + refused.length);
    assert.ok(refused.some(function (o) { return o.plan_dimension === 'L9'; }), 'no refused op for L9');
    const laneOps = ledger.operations.filter(function (o) { return o.template_id === 'lane:LM2'; });
    assert.strictEqual(laneOps.length, 0, 'a lane op also exists for the refused lane: ' + laneOps.map(function (o) { return o.reason; }).join(','));
    const card = planMod.planReviewCard(plan);
    assert.ok(card.body_md.indexOf(WALL_WORDS) !== -1, 'the card lacks the wall sentence');
    return true;
  });

  // ---- R5d counterevidence gaps ----
  await leg('R5d a sentence assumed limiter and a sentence goal are CE gaps, a term-shaped goal composes', async function () {
    const one = await ceScenario(function (qs) {
      const lm2 = qs.perspective.limiters.filter(function (l) { return l.id === 'LM2'; })[0];
      lm2.label = SENT;
    });
    const stmt = one.plan.perspective.limiters.filter(function (l) { return l.id === 'LM2'; })[0].statement;
    assert.strictEqual(stmt, SENT, 'the plan limiter statement is not the sentence: ' + String(stmt).slice(0, 60));
    const lm2 = ceOps(one.ledger, 'CE:LM2');
    assert.ok(lm2.some(function (o) { return o.state === 'refused_before_fetch' && o.reason === 'bad_slot:limiter'; }), 'CE:LM2 ops ' + JSON.stringify(lm2.map(function (o) { return [o.state, o.reason]; })));
    const sent = one.ledger.operations.filter(function (o) { return typeof o.q === 'string' && o.q.indexOf(SENT.slice(0, 40)) !== -1; });
    assert.strictEqual(sent.length, 0, sent.length + ' ledger operations carry the sentence');
    const goalOk = one.ledger.operations.filter(function (o) { return /^CE:goal_falsifier/.test(String(o.plan_dimension)) || (o.kind === 'falsifier' && typeof o.q === 'string' && o.q.indexOf('energy density') !== -1); });
    assert.ok(goalOk.length >= 1, 'the term-shaped goal target did not compose (' + goalOk.length + ' ops)');
    const two = await ceScenario(function (qs) { qs.perspective.goal.target = SENT; });
    const goalGap = ceOps(two.ledger, 'CE:goal');
    assert.ok(goalGap.some(function (o) { return o.state === 'refused_before_fetch' && o.reason === 'bad_slot:goal'; }), 'CE:goal ops ' + JSON.stringify(goalGap.map(function (o) { return [o.state, o.reason]; })));
    const leaked = two.ledger.operations.filter(function (o) { return typeof o.q === 'string' && o.q.indexOf(SENT.slice(0, 40)) !== -1; });
    assert.strictEqual(leaked.length, 0, leaked.length + ' ledger operations carry the goal sentence');
    return true;
  });

  // ---- R5e a short unpunctuated sentence limiter (quick 261006 D4, plan 17 follow-up) ----
  await leg('R5e a 5-word limiter statement with no punctuation is a CE gap bad_slot:limiter, a 4-word goal target composes', async function () {
    const SHORT = 'Entanglement requires pre-positioned physical barriers';
    const one = await ceScenario(function (qs) {
      const lm2 = qs.perspective.limiters.filter(function (l) { return l.id === 'LM2'; })[0];
      lm2.label = SHORT;
    });
    const stmt = one.plan.perspective.limiters.filter(function (l) { return l.id === 'LM2'; })[0].statement;
    assert.strictEqual(stmt, SHORT, 'the plan limiter statement is not the short sentence: ' + String(stmt).slice(0, 60));
    const sent = one.ledger.operations.filter(function (o) { return typeof o.q === 'string' && o.q.indexOf('Entanglement requires') !== -1; });
    assert.strictEqual(sent.length, 0, sent.length + ' ledger operations carry the short sentence: ' + JSON.stringify(sent.map(function (o) { return [o.plan_dimension, o.state, o.reason]; })));
    const lm2 = ceOps(one.ledger, 'CE:LM2');
    assert.ok(lm2.some(function (o) { return o.state === 'refused_before_fetch' && o.reason === 'bad_slot:limiter'; }), 'CE:LM2 ops ' + JSON.stringify(lm2.map(function (o) { return [o.state, o.reason]; })));
    const two = await ceScenario(function (qs) { qs.perspective.goal.target = 'thin film energy density'; });
    const goalOk = two.ledger.operations.filter(function (o) { return /^CE:goal_falsifier/.test(String(o.plan_dimension)) || (o.kind === 'falsifier' && typeof o.q === 'string' && o.q.indexOf('thin film energy density') !== -1); });
    assert.ok(goalOk.length >= 1, 'the 4-word goal target did not compose (' + goalOk.length + ' ops)');
    return true;
  });

  // ---- R6a unused slot ----
  await leg('R6a mu.verify with {term, term2} is refused unused_slot:term2, no query', async function () {
    const a = families.composeForLeaf({ lens: 'mu.verify', corpus: 'openalex', slots: { term: 'electrical cable', term2: 'OTDRMARK optical fiber' } }, { round: 1 });
    const inQueries = a.ok ? a.queries.filter(function (q) { return q.q.indexOf('OTDRMARK') !== -1; }).length : 0;
    assert.ok(a.ok === false, 'composed ' + (a.ok ? a.queries.length : 0) + ' queries with term2 in ' + inQueries + ' queries');
    assert.strictEqual(a.reason, 'unused_slot', 'reason ' + a.reason);
    assert.strictEqual(a.slot, 'term2', 'slot ' + a.slot);
    assert.strictEqual(a.code, 'unused_slot:term2', 'code ' + a.code);
    assert.ok(!a.queries, 'a refusal carries no query');
    assert.ok(JSON.stringify(a).indexOf('OTDRMARK') === -1, 'the refusal echoed the slot value');
    const b = families.composeForLeaf({ lens: 'mu.verify', corpus: 'openalex', slots: { term: 'OTDRMARK optical fiber' } }, { round: 1 });
    assert.ok(b.ok && b.queries.length === 2, 'term only composes 2 queries');
    return true;
  });

  // ---- R6b consumed slots still compose ----
  await leg('R6b a consumed slot still composes (eu.transfer term2, ws.gap synonyms)', async function () {
    const a = families.composeForLeaf({ lens: 'eu.transfer', corpus: 'openalex', slots: { term: 'graph theory', term2: 'protein folding' } }, { round: 1 });
    assert.ok(a.ok && a.queries.some(function (q) { return q.q.indexOf('protein folding') !== -1; }), 'eu.transfer ' + JSON.stringify(a).slice(0, 160));
    const b = families.composeForLeaf({ lens: 'ws.gap', corpus: 'openalex', slots: { term: 'thin film sensor', synonyms: ['coating sensor'] } }, { round: 1 });
    assert.ok(b.ok && b.queries.some(function (q) { return q.q.indexOf('coating sensor') !== -1; }), 'ws.gap ' + JSON.stringify(b).slice(0, 160));
    return true;
  });

  // ---- R6c quick plan ----
  await leg('R6c a quick plan with the unused slot is local-only, the leaf and the card name it', async function () {
    const room = newRoom();
    const qs = clone(QS_WS);
    const l1 = qs.leaves[0];
    l1.lens = 'mu.verify';
    l1.slots = { term: 'electrical cable', term2: 'OTDRMARK optical fiber' };
    const built = planner.buildPlan(room.roomDir, qs, { mode: 'quick', now: NOW });
    assert.ok(built.ok, 'buildPlan ' + JSON.stringify(built).slice(0, 200));
    const leaf = built.plan.leaves.filter(function (l) { return l.id === l1.id; })[0];
    assert.ok(leaf, 'leaf missing');
    assert.strictEqual(leaf.researchable, false, 'leaf is still researchable');
    assert.ok(leaf.refusal && leaf.refusal.reason === 'unused_slot:term2' && leaf.refusal.slot === 'term2', 'leaf.refusal ' + JSON.stringify(leaf.refusal));
    assert.ok(String(leaf.not_researchable_reason).indexOf('not used by its search shape') !== -1, 'reason text ' + leaf.not_researchable_reason);
    const card = planMod.planReviewCard(built.plan);
    assert.ok(card.body_md.indexOf(EXTRA_WORDS) !== -1, 'the card lacks the unused-slot words');
    return true;
  });

  // ---- R6d helper ----
  await leg('R6d consumedSlots(lensId) is the union of needs over round one and round two', async function () {
    assert.strictEqual(typeof families.consumedSlots, 'function', 'families.consumedSlots is not exported');
    const eu = families.consumedSlots('eu.transfer').slice().sort();
    assert.deepStrictEqual(eu, ['term', 'term2'], 'eu.transfer ' + JSON.stringify(eu));
    const mu = families.consumedSlots('mu.verify').slice().sort();
    assert.deepStrictEqual(mu, ['term'], 'mu.verify ' + JSON.stringify(mu));
    const ws = families.consumedSlots('ws.gap').slice().sort();
    assert.deepStrictEqual(ws, ['synonyms', 'term'], 'ws.gap ' + JSON.stringify(ws));
    assert.deepStrictEqual(families.consumedSlots('no.such.lens'), [], 'unknown lens');
    return true;
  });


  // ---- plan 19: per-leaf dispatch (CODE-03) and SR leaf slots (CODE-04) ----
  // the whitespace question set plus extra ws.gap leaves under the gap claim K1, each with its own term: the plan
  // stays ready (every key-line dimension is still covered)
  function wsReadyQs(extraTerms) {
    const qs = clone(QS_WS);
    extraTerms.forEach(function (t, i) {
      qs.leaves.push(Object.assign({}, qs.leaves[0], { id: 'L' + (4 + i), slots: { term: t } }));
    });
    return qs;
  }
  function code03Plan(room) {
    const qs = clone(QS_WS);
    qs.leaves = [
      Object.assign({}, qs.leaves[0], { id: 'L1', slots: { term: 'thin-film sensors' } }),
      Object.assign({}, qs.leaves[0], { id: 'L2', slots: { term: 'dielectric probes' } }),
      Object.assign({}, qs.leaves[1], { id: 'L3', lens: 'ws.covered_elsewhere' }),
    ];
    return buildDeep(room, qs);
  }
  function countByLeaf(r1) {
    const by = {};
    r1.forEach(function (lane) { lane.queries.forEach(function (q) { by[q.leaf_ids[0]] = (by[q.leaf_ids[0]] || 0) + 1; }); });
    return by;
  }
  function allQueryText(r1) {
    const all = [];
    r1.forEach(function (lane) { lane.queries.forEach(function (q) { all.push(String(q.q)); }); });
    return all;
  }

  await leg('R3a two leaves on one lens: every researchable leaf has a round-one query, the L2 term is sent', async function () {
    const room = newRoom();
    const plan = code03Plan(room);
    const r1 = deepMod.roundOneQueries(plan);
    const by = countByLeaf(r1);
    console.log('R3a queries by leaf L1/L2/L3 = ' + (by.L1 || 0) + '/' + (by.L2 || 0) + '/' + (by.L3 || 0));
    const fetch = plan.leaves.filter(function (l) { return l.researchable === true && l.corpus === 'openalex'; });
    const starved = fetch.filter(function (l) { return !(by[l.id] >= 1); }).map(function (l) { return l.id; });
    assert.strictEqual(starved.length, 0, 'leaves with 0 queries: ' + starved.join(',') + ' (counts L1=' + (by.L1 || 0) + ' L2=' + (by.L2 || 0) + ' L3=' + (by.L3 || 0) + ')');
    const inL2 = allQueryText(r1).filter(function (q) { return q.indexOf('dielectric probes') !== -1; }).length;
    assert.ok(inL2 >= 1, 'the term dielectric probes is in ' + inL2 + ' queries');
    // the lanes stay grouped by lens for the analyst
    const gap = r1.filter(function (l) { return l.lane === 'ws-gap'; })[0];
    assert.ok(gap && gap.leaf_ids.indexOf('L1') !== -1 && gap.leaf_ids.indexOf('L2') !== -1, 'the ws-gap lane lost a leaf ' + JSON.stringify(gap && gap.leaf_ids));
    return true;
  });

  await leg('R3b CODE-03 plan driven to synthesize: every researchable leaf has a terminal ledger op', async function () {
    const room = newRoom();
    const plan = buildDeep(room, wsReadyQs(['dielectric probes']));
    // the whitespace set names no limiter, so buildPlan calls a deep plan on it a wish; the lens-lane path under
    // test is the one a plan without limiter lanes takes, so the test marks the plan ready to drive it
    plan.status = 'ready';
    plan.plan_hash = planMod.planHash(plan);
    deepInit(room, plan);
    const result = await driveDeep(room, plan);
    assert.ok(result.ok, 'synthesize');
    const ledger = operations.readLedger(room.roomDir, plan.run_id);
    const fetch = plan.leaves.filter(function (l) { return l.researchable === true && l.corpus === 'openalex'; });
    fetch.forEach(function (l) {
      const mine = ledger.operations.filter(function (o) { return o.plan_dimension === l.id; });
      assert.ok(mine.length >= 1, 'leaf ' + l.id + ' has no op in the ledger');
      const open = mine.filter(function (o) { return operations.TERMINAL_STATES.indexOf(o.state) === -1; });
      assert.strictEqual(open.length, 0, 'leaf ' + l.id + ' has a non-terminal op ' + open.map(function (o) { return o.state; }).join(','));
    });
    return true;
  });

  await leg('R3c three leaves on one lens: at least 3 queries when the cap allows, search_cap ops when it does not', async function () {
    const room = newRoom();
    const plan = buildDeep(room, wsReadyQs(['dielectric probes', 'coating monitors']));
    assert.strictEqual(plan.budget.queries_per_round, 2, 'queries_per_round ' + plan.budget.queries_per_round);
    const same = plan.leaves.filter(function (l) { return l.lens === 'ws.gap'; });
    assert.ok(same.length >= 2, 'ws.gap leaves ' + same.length);
    const r1 = deepMod.roundOneQueries(plan);
    const by = countByLeaf(r1);
    const spent = r1.reduce(function (n, l) { return n + l.queries.length; }, 0);
    console.log('R3c leaves on the lens ' + same.length + ', queries spent ' + spent + ', by leaf ' + JSON.stringify(by));
    same.forEach(function (l) { assert.ok(by[l.id] >= 1, 'leaf ' + l.id + ' has ' + (by[l.id] || 0) + ' queries'); });
    const gapLane = r1.filter(function (l) { return l.lane === 'ws-gap'; })[0];
    assert.ok(gapLane && gapLane.queries.length >= same.length, 'the ws-gap lane spent ' + (gapLane ? gapLane.queries.length : 0) + ' queries for ' + same.length + ' leaves');
    // a cap of 1 search: the run spends it on the first query and every other leaf's query is closed search_cap
    const tight = clone(plan);
    tight.budget.max_searches = 2;
    tight.status = 'ready'; // the whitespace set names no limiter, see R3b
    tight.plan_hash = planMod.planHash(tight);
    const r1t = deepMod.roundOneQueries(tight);
    const sentBy = countByLeaf(r1t);
    same.forEach(function (l) { assert.ok(sentBy[l.id] >= 1, 'a tight cap dropped leaf ' + l.id + ' before the run (' + JSON.stringify(sentBy) + ')'); });
    deepInit(room, tight);
    const fr = await deepMod.fetchRound(room.roomDir, tight.run_id, { fetchEnvelopeFn: deepSeam() });
    assert.ok(fr.ok, 'fetchRound ' + JSON.stringify(fr).slice(0, 200));
    const ledger = operations.readLedger(room.roomDir, tight.run_id);
    const ran = ledger.operations.filter(function (o) { return o.state === 'executed_with_results' || o.state === 'executed_empty'; });
    assert.strictEqual(ran.length, 1, 'a cap of 1 ran ' + ran.length + ' searches');
    const left = same.filter(function (l) { return ran.every(function (o) { return o.plan_dimension !== l.id; }); });
    assert.ok(left.length >= 1, 'no leaf was left without a search');
    left.forEach(function (l) {
      const mine = ledger.operations.filter(function (o) { return o.plan_dimension === l.id; });
      const capped = mine.filter(function (o) { return o.state === 'not_executed' && o.reason === 'search_cap'; });
      assert.ok(capped.length >= 1, 'leaf ' + l.id + ' has no not_executed search_cap op: ' + JSON.stringify(mine.map(function (o) { return [o.state, o.reason]; })));
    });
    return true;
  });

  await leg('R3d roundOneQueries repeats on the saved plan and the run grant approves every query it returns', async function () {
    const room = newRoom();
    const plan = code03Plan(room);
    const a = deepMod.roundOneQueries(plan);
    const b = deepMod.roundOneQueries(plan);
    const ha = JSON.stringify(a.map(function (l) { return [l.lane, l.queries.map(function (q) { return q.q_hash + ':' + q.leaf_ids[0]; })]; }));
    const hb = JSON.stringify(b.map(function (l) { return [l.lane, l.queries.map(function (q) { return q.q_hash + ':' + q.leaf_ids[0]; })]; }));
    assert.strictEqual(ha, hb, 'a second pass differs: ' + ha + ' vs ' + hb);
    const grant = grants.buildRunGrant(plan);
    a.forEach(function (l) { l.queries.forEach(function (q) { assert.ok(grant.approved_hashes.indexOf(q.q_hash) !== -1, 'a sent query is not approved: ' + q.q); }); });
    return true;
  });

  function code04Plan(room, edit) {
    const qs = clone(QS_SR);
    const byId = {};
    qs.leaves.forEach(function (l) { byId[l.id] = l; });
    byId.L1.slots = { term: 'ALPHAMARK_mu_verify_term' };
    byId.L6.slots = { limiter: 'cathode host capacity', term: 'BETAMARK_ci_derivation_term' };
    byId.L9.slots = { limiter: 'LIMMARK anode interface resistance' };
    if (edit) edit(byId);
    return buildDeep(room, qs);
  }

  await leg('R4a SR plan: the L1 marker is sent in a round-one query beside the limiter queries', async function () {
    const room = newRoom();
    const plan = code04Plan(room);
    const r1 = deepMod.roundOneQueries(plan);
    const text = allQueryText(r1).join('\n');
    const alpha = allQueryText(r1).filter(function (q) { return q.indexOf('ALPHAMARK') !== -1; }).length;
    const lim = allQueryText(r1).filter(function (q) { return q.indexOf('LIMMARK') !== -1; }).length;
    console.log('R4a round-one queries ' + allQueryText(r1).length + ', ALPHAMARK in ' + alpha + ', LIMMARK in ' + lim);
    assert.ok(alpha >= 1, 'ALPHAMARK is in ' + alpha + ' of ' + allQueryText(r1).length + ' queries');
    assert.ok(lim >= 1, 'LIMMARK is in ' + lim + ' queries');
    assert.ok(text.indexOf('fundamental limit') !== -1, 'the ci.* limiter queries are gone');
    const alphaQ = r1.map(function (l) { return l.queries; }).reduce(function (a, b) { return a.concat(b); }, []).filter(function (q) { return q.q.indexOf('ALPHAMARK') !== -1; })[0];
    assert.deepStrictEqual(alphaQ.leaf_ids, ['L1'], 'the L1 query is attached to ' + JSON.stringify(alphaQ.leaf_ids));
    const l1 = plan.leaves.filter(function (l) { return l.id === 'L1'; })[0];
    assert.ok(l1.queries.length >= 1 && l1.queries.some(function (q) { return q.q.indexOf('ALPHAMARK') !== -1; }), 'the L1 leaf carries ' + l1.queries.length + ' queries');
    return true;
  });

  await leg('R4b SR plan: the L6 extra term is in a query or the leaf is refused unused_slot:term', async function () {
    const room = newRoom();
    const plan = code04Plan(room);
    const r1 = deepMod.roundOneQueries(plan);
    const inQuery = allQueryText(r1).filter(function (q) { return q.indexOf('BETAMARK') !== -1; }).length;
    const l6 = plan.leaves.filter(function (l) { return l.id === 'L6'; })[0];
    const refused = !!(l6.refusal && l6.refusal.reason === 'unused_slot:term');
    console.log('R4b BETAMARK in ' + inQuery + ' queries, L6 refusal ' + JSON.stringify(l6.refusal));
    assert.ok(inQuery >= 1 || refused, 'BETAMARK is in ' + inQuery + ' queries and L6 refusal is ' + JSON.stringify(l6.refusal));
    assert.ok(JSON.stringify(l6).indexOf('BETAMARK') === -1, 'the refused leaf echoes the slot value');
    return true;
  });

  await leg('R4c a limiter-lane leaf with a non-ci lens and its own term sends that term, the ci queries stay', async function () {
    const room = newRoom();
    const plan = code04Plan(room, function (byId) {
      byId.L8.lens = 'mu.verify';
      byId.L8.slots = { term: 'GAMMAMARK volume swing' };
    });
    const r1 = deepMod.roundOneQueries(plan);
    const flat = r1.map(function (l) { return l.queries; }).reduce(function (a, b) { return a.concat(b); }, []);
    const gamma = flat.filter(function (q) { return q.q.indexOf('GAMMAMARK') !== -1; });
    assert.ok(gamma.length >= 1, 'GAMMAMARK is in ' + gamma.length + ' queries');
    assert.ok(gamma.every(function (q) { return q.leaf_ids.length === 1 && q.leaf_ids[0] === 'L8'; }), 'GAMMAMARK is attached to ' + JSON.stringify(gamma.map(function (q) { return q.leaf_ids; })));
    const lm1 = flat.filter(function (q) { return q.lane === 'LM1' && q.template_id.indexOf('ci.') === 0; });
    assert.ok(lm1.length >= 1, 'the LM1 ci queries are gone');
    return true;
  });

  // ---- R7 dash ----
  await leg('R7 no em-dash or en-dash in this file', async function () {
    const src = fs.readFileSync(__filename, 'utf8');
    return (src.indexOf(String.fromCharCode(0x2014)) === -1 && src.indexOf(String.fromCharCode(0x2013)) === -1) || 'a dash is present';
  });

  check('net guard: zero network attempts', NET.attempts() === 0, String(NET.attempts()));
  return summary();
}

main().then(function (code) { process.exit(code); }, function (e) {
  console.log('FAIL: harness (' + String((e && e.stack) || e).slice(0, 500) + ')');
  process.exit(1);
});
