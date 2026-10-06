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
 *   R6a  composeForLeaf mu.verify {term, term2}: refused unused_slot:term2, no query
 *   R6b  a slot the lens does consume (eu.transfer term2, ws.gap synonyms) still composes
 *   R6c  a quick plan with that leaf: local-only with leaf.refusal unused_slot:term2, the card names the reason
 *   R6d  the helper consumedSlots(lensId) names the union of needs over round one and round two
 *   R7   no em-dash or en-dash in this file
 *
 * Plan 19 adds R3x and R4x to this file.
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
