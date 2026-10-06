#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 22 (369.2-R14; SW-14, INPUT defect 2; RESEARCH HARNESS-09 row).
 * A quick run has a cap of three searches. The cap must reach the walls (limiters) the plan exists to test
 * first, in rankByUnlock order, and when it cannot reach a wall the card says so before anything runs.
 *
 * Measured before this plan (fixtures/phase0/SW-14): cap 3; queries by leaf L1=2, L2=1, L3=0, L4=0, L6 (the
 * limiter leaf)=0, L5=0 (L5 is not researchable). The cap went to the first leaves in array order.
 *
 *   QC1  the SW-14 plan (limiter tied to L6, last in array order): L6 holds at least 1 query
 *   QC2  two limiters, LM2 ranked over LM1 by unlock chains: the first queries go to LM2's leaf, then LM1's,
 *        and the leaves tied to no limiter get none
 *   QC3  a limiter leaf that carries query_kinds: its practice query precedes its direct query
 *   QC4  four limiter leaves and a cap of 3: the plan card (planReviewCard and the quick grant card from
 *        cardFor) says 'A quick run has three searches, so it cannot reach the wall "<label>"; a deep run can
 *        test it.' for the walls left out, and says how many searches do not fit
 *   QC5  after runQuick under a run grant (replay), every trimmed query is a not_executed op with reason
 *        quick_cap, and the answer line names a question the cap left out as not searched
 *   QC6  a plan with no limiter keeps leaf order, and says nothing about walls
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads; vendor
 * keys are deleted; the provider is the OpenAlex replay reached through the REAL corpus path.
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
const { check, summary } = makeChecker('test-3692-quick-cap');

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const quickMod = require(path.join(RP, 'quick.cjs'));
const operations = require(path.join(RP, 'operations.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');

const QS_LIM = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'map-unknowns-limiter.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-22-test' };
const NOW = new Date('2026-10-04T00:00:00Z');
const CAP = planMod.BUDGETS.QUICK_MAX_QUERIES;

const WALL_PREFIX = 'A quick run has three searches, so it cannot reach the wall "';
const WALL_SUFFIX = '"; a deep run can test it.';

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

// the SW-14 question set: every researchable leaf gets a short term; the limiter is tied to a named leaf
function qsWith(mutate) {
  const qs = clone(QS_LIM);
  qs.leaves.forEach(function (l, i) { if (l.researchable === true) l.slots = { term: 'TERM' + (i + 1) + ' topic ' + (i + 1) }; });
  qs.perspective.limiters[0].leaf_id = 'L6';
  if (mutate) mutate(qs);
  return qs;
}
function build(room, qs) {
  const built = planner.buildPlan(room.roomDir, qs, { mode: 'quick', now: NOW });
  if (!built.ok) throw new Error('buildPlan ' + JSON.stringify(built).slice(0, 300));
  return built.plan;
}
function leafOf(plan, id) { return plan.leaves.filter(function (l) { return l.id === id; })[0]; }
function nq(plan, id) { return (leafOf(plan, id).queries || []).length; }
function limiter(id, leafId, label) {
  return { id: id, column: 'assumed', label: label, path_id: 'P1', s_curve: 'unknown', question: 'Is ' + label + ' fixed by design or by placement?', leaf_id: leafId };
}
function chain(limiterId, n) {
  const steps = [];
  for (let i = 0; i < n; i += 1) steps.push({ text: 'field step ' + (i + 1), pushed_by: 'field', kind: 'field' });
  return { limiter_id: limiterId, steps: steps };
}
function approveRun(room, plan) {
  const p = grants.buildRunGrant(plan);
  p.room_id = grants.roomIdFor(room.roomDir);
  const w = grants.writeGrant(room.roomDir, p, { approved_via: VIA });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}
function cutCount(plan) {
  return plan.leaves.reduce(function (n, l) { return n + (Array.isArray(l.queries_cut) ? l.queries_cut.length : 0); }, 0);
}

async function main() {
  // ---- QC1 ----
  await leg('QC1 the SW-14 plan: the limiter leaf L6 holds at least 1 query', async function () {
    const room = newRoom();
    const plan = build(room, qsWith());
    const by = plan.leaves.map(function (l) { return l.id + '=' + (l.queries || []).length; }).join(' ');
    console.log('QC1 measured (cap ' + CAP + '): ' + by);
    assert.ok(nq(plan, 'L6') >= 1, 'L6 queries ' + nq(plan, 'L6') + ' (' + by + ')');
    const total = plan.leaves.reduce(function (n, l) { return n + (l.queries || []).length; }, 0);
    assert.ok(total <= CAP, 'plan holds ' + total + ' queries, cap is ' + CAP);
    return true;
  });

  // ---- QC2 ----
  await leg('QC2 two limiters: the leaf of the higher-ranked limiter is served first, then the next, then the rest', async function () {
    const room = newRoom();
    const plan = build(room, qsWith(function (qs) {
      qs.perspective.limiters = [limiter('LM1', 'L3', 'Indicator blind spot under excursions'), limiter('LM2', 'L4', 'Carrier handoff gap nobody tracks')];
      qs.perspective.unlock_chains = [chain('LM2', 3)];
    }));
    const by = plan.leaves.map(function (l) { return l.id + '=' + (l.queries || []).length; }).join(' ');
    console.log('QC2 measured: ' + by + ' ranking=' + JSON.stringify((plan.perspective.ranking || []).map(function (r) { return r.limiter_id || r; })));
    assert.ok(nq(plan, 'L4') >= 1, 'LM2 leaf L4 has ' + nq(plan, 'L4') + ' (' + by + ')');
    assert.ok(nq(plan, 'L3') >= 1, 'LM1 leaf L3 has ' + nq(plan, 'L3') + ' (' + by + ')');
    assert.ok(nq(plan, 'L4') >= nq(plan, 'L3'), 'LM2 leaf got fewer than LM1 leaf (' + by + ')');
    assert.strictEqual(nq(plan, 'L1') + nq(plan, 'L2'), 0, 'a leaf tied to no limiter was served before a wall (' + by + ')');
    return true;
  });

  // ---- QC3 ----
  await leg('QC3 inside a limiter leaf the practice query precedes the direct query', async function () {
    const room = newRoom();
    const plan = build(room, qsWith(function (qs) {
      const l6 = qs.leaves.filter(function (l) { return l.id === 'L6'; })[0];
      l6.query_kinds = { practice: 'optical time domain reflectometry', mechanism: 'fiber backscatter' };
    }));
    const qs = leafOf(plan, 'L6').queries || [];
    console.log('QC3 measured: ' + JSON.stringify(qs.map(function (q) { return q.kind + ':' + q.template_id; })));
    const iPractice = qs.findIndex(function (q) { return q.kind === 'practice'; });
    const iDirect = qs.findIndex(function (q) { return q.kind === 'direct'; });
    assert.ok(iPractice !== -1, 'no practice query on L6');
    assert.ok(iDirect !== -1, 'no direct query on L6');
    assert.ok(iPractice < iDirect, 'practice at ' + iPractice + ' is not before direct at ' + iDirect);
    return true;
  });

  // ---- QC4 ----
  function fourWalls(qs) {
    qs.perspective.limiters = [
      limiter('LM1', 'L1', 'Wall one about calibration drift'),
      limiter('LM2', 'L2', 'Wall two about handoff loss'),
      limiter('LM3', 'L3', 'Wall three about carrier tracking'),
      limiter('LM4', 'L4', 'Wall four about neighbouring product rules'),
    ];
    qs.perspective.unlock_chains = [];
  }
  await leg('QC4 the plan review card says, before the run, which walls a quick run cannot reach', async function () {
    const room = newRoom();
    const plan = build(room, qsWith(fourWalls));
    const unreached = Array.isArray(plan.quick_unreached) ? plan.quick_unreached : [];
    console.log('QC4 measured: quick_unreached=' + JSON.stringify(unreached) + ' cut=' + cutCount(plan));
    assert.ok(unreached.length >= 1, 'quick_unreached is empty');
    const fourth = 'Wall four about neighbouring product rules';
    assert.ok(unreached.some(function (u) { return u.limiter_id === 'LM4' && u.label === fourth; }), 'LM4 not named in quick_unreached');
    const sentence = WALL_PREFIX + fourth + WALL_SUFFIX;
    const body = String(planMod.planReviewCard(plan).body_md || '');
    assert.ok(body.indexOf(sentence) !== -1, 'planReviewCard lacks: ' + sentence);
    const n = cutCount(plan);
    assert.ok(n > 0, 'no searches were cut');
    const fit = n + ' of this plan' + "'" + 's searches ' + (n === 1 ? 'does' : 'do') + ' not fit in a quick run and will be listed as not searched.';
    assert.ok(body.indexOf(fit) !== -1, 'planReviewCard lacks: ' + fit);
    assert.ok(body.indexOf(sentence) < body.indexOf('### Budget'), 'the wall sentence is not above the budget block');
    return true;
  });

  await leg('QC4 the quick grant card from cardFor says it too, before anything is sent', async function () {
    const room = newRoom();
    const plan = build(room, qsWith(fourWalls));
    const c = planner.cardFor(room.roomDir, plan, {});
    assert.strictEqual(c.next, 'grant', 'next ' + c.next + ' ' + (c.reason || ''));
    const body = String(c.card.body_md || '');
    const sentence = WALL_PREFIX + 'Wall four about neighbouring product rules' + WALL_SUFFIX;
    assert.ok(body.indexOf(sentence) !== -1, 'grant card lacks: ' + sentence);
    assert.ok(body.indexOf('The searches, exactly as they will be sent:') !== -1, 'the exact searches list is gone');
    return true;
  });

  // ---- QC5 ----
  await leg('QC5 a run closes every trimmed query as not_executed quick_cap, and the answer names a question left out', async function () {
    const room = newRoom();
    const plan = build(room, qsWith(fourWalls));
    const cut = [];
    plan.leaves.forEach(function (l) { (l.queries_cut || []).forEach(function (c) { cut.push({ leaf: l.id, c: c }); }); });
    assert.ok(cut.length > 0, 'the plan cut nothing');
    approveRun(room, plan);
    const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: real.realFetchEnvelope(function () { return 'gap_primary_zero'; }), now: Date.now() });
    assert.strictEqual(out.status, 'done', 'runQuick ' + out.status + ' ' + (out.reason || ''));
    const ledger = operations.readLedger(room.roomDir, plan.run_id);
    const miss = ledger.operations.filter(function (o) { return o.state === 'not_executed' && o.reason === 'quick_cap'; });
    console.log('QC5 measured: cut=' + cut.length + ' quick_cap ops=' + miss.length);
    assert.strictEqual(miss.length, cut.length, 'quick_cap ops ' + miss.length + ' vs queries_cut ' + cut.length);
    cut.forEach(function (x) {
      assert.ok(miss.some(function (o) { return o.plan_dimension === x.leaf && o.template_id === x.c.template_id; }), 'no quick_cap op for ' + JSON.stringify(x));
    });
    const noQuery = ledger.operations.filter(function (o) { return o.reason === 'no_query_composed' && cut.some(function (x) { return x.leaf === o.plan_dimension; }); });
    assert.strictEqual(noQuery.length, 0, 'a cut leaf is also marked no_query_composed: ' + JSON.stringify(noQuery.map(function (o) { return o.plan_dimension; })));
    const answer = String((out.run && out.run.answer_line) || out.answer_line || '');
    const firstLeaf = leafOf(plan, cut[0].leaf);
    const label = String(firstLeaf.question).replace(/\s*\?+\s*$/, '').slice(0, 40);
    assert.ok(answer.indexOf(label) !== -1 && answer.indexOf('was not searched') !== -1, 'the answer line does not name "' + label + '" as not searched: ' + answer.slice(0, 300));
    assert.ok(answer.indexOf('three searches went to other questions first') !== -1, 'the answer line lacks the quick cap words: ' + answer.slice(0, 300));
    return true;
  });

  // ---- QC6 ----
  await leg('QC6 a plan with no limiter keeps leaf order and says nothing about walls', async function () {
    const room = newRoom();
    const plan = build(room, qsWith(function (qs) { qs.perspective.limiters = []; qs.perspective.unlock_chains = []; }));
    const by = plan.leaves.map(function (l) { return l.id + '=' + (l.queries || []).length; }).join(' ');
    console.log('QC6 measured: ' + by);
    assert.strictEqual(nq(plan, 'L1'), 2, 'L1 ' + nq(plan, 'L1'));
    assert.strictEqual(nq(plan, 'L2'), 1, 'L2 ' + nq(plan, 'L2'));
    assert.strictEqual(nq(plan, 'L6'), 0, 'L6 ' + nq(plan, 'L6'));
    assert.ok(plan.quick_unreached === undefined, 'quick_unreached present: ' + JSON.stringify(plan.quick_unreached));
    const body = String(planMod.planReviewCard(plan).body_md || '');
    assert.ok(body.indexOf('cannot reach the wall') === -1, 'a wall sentence on a plan with no wall');
    return true;
  });

  const guardCalls = typeof NET.attempts === 'function' ? NET.attempts() : 0;
  check('QC net guard: no real network call', guardCalls === 0, 'attempts ' + guardCalls);
  const bad = fs.readFileSync(__filename, 'utf8').split('').some(function (ch) { return ch === String.fromCharCode(0x2013) || ch === String.fromCharCode(0x2014); });
  check('QC no em or en dash in this file', !bad, 'dash found');
  process.exit(summary());
}

main().catch(function (e) {
  console.error('FAIL: harness ' + String((e && e.stack) || e));
  process.exit(1);
});
