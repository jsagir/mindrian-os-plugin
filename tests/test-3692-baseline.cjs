#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 23 (369.2-R17; HARNESS-10, plan-time half). A deep plan with at least one limiter carries a
 * bounded field scan composed at plan time: at most four queries, one per facet, built from the governing
 * question and the practice kind. The card lists the scan first and the run grant covers its strings.
 * Plan 24 adds the run-time legs BE1-BE5 to this file.
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
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');

const QS_SR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const QS_WS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
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
