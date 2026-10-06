#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 14 (369.2-R05) -- the operation ledger wired into the quick and deep run
 * controllers (HARNESS-02: "create a ledger row before dispatch"; invariant 7: "complete" comes
 * from the ledger, never from a command return).
 *
 *   L1  quick   a run writes operations.json; one op per fetch query, per theo leaf, per refused
 *               slot; every op terminal; run.operations equals the file; run.completion sums up
 *   L2  failure a 500 from the provider is not_executed with attempted true and provider_failed:<class>,
 *               never executed_empty; an executed_empty op always carries a counted zero
 *   L3  refusal a slot the composer refuses keeps leaf.refusal on the saved plan and a
 *               refused_before_fetch op in the ledger
 *   L4  deep    the scientific-roadmapping fixture driven to synthesize: every mandatory op terminal,
 *               round-one, round-two and counterevidence ops present, run.completion present
 *   L5  lanes   lanes cut by the fan-out cap become not_executed ops with reason lane_cap
 *   L6  search  counterevidence branches cut by the search cap become not_executed ops with
 *               reason search_cap, one per over_cap gap
 *   L7  ids     operation ids are stable across loadState, nextDeepStep and later rounds
 *   L8  audit   each executed op's audit_ref.q_hash matches exactly one research-audit.jsonl record
 *   L9  theo    a quick plan with theo leaves mints one theo op per leaf; outcomes map from the checks
 *   L10 dash    no em-dash or en-dash in this file
 *   L11 torn    a torn operations.json refuses a deep step with ledger_corrupt
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads;
 * vendor keys are deleted; the provider is the OpenAlex replay, reached through the REAL corpus path.
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
const { check, summary } = makeChecker('test-3692-ledger-wiring');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const quickMod = require(path.join(RP, 'quick.cjs'));
const deepMod = require(path.join(RP, 'deep.cjs'));
const auditLedger = require(path.join(RP, 'audit-ledger.cjs'));
const operations = require(path.join(RP, 'operations.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
const { makeReplayFetch, SENTINELS } = require('./helpers/openalex-replay-363.cjs');
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));

const QS_WS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
const QS_SR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const BODIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-14-test' };

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}
process.on('exit', function () { rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* best effort */ } }); });

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function ledgerOf(room, runId) { return operations.readLedger(room.roomDir, runId); }
function runJson(room, runId) {
  return JSON.parse(fs.readFileSync(path.join(room.roomDir, '.mindrian', 'research-runs', runId, 'run.json'), 'utf8'));
}
function isTerm(op) { return operations.TERMINAL_STATES.indexOf(op.state) !== -1; }
function countBy(ledger, fn) { return ledger.operations.filter(fn).length; }
function byState(ledger) {
  const o = {};
  ledger.operations.forEach(function (x) { o[x.state] = (o[x.state] || 0) + 1; });
  return JSON.stringify(o);
}

async function leg(name, fn) {
  try {
    const r = await fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 400));
  }
}

// ---- quick helpers --------------------------------------------------------------------
function builtQuick(room, mutate) {
  const qs = clone(QS_WS);
  if (typeof mutate === 'function') mutate(qs);
  const built = planner.buildPlan(room.roomDir, qs, { mode: 'quick' });
  if (!built || built.ok === false || !built.run_id) throw new Error('buildPlan failed: ' + JSON.stringify(built).slice(0, 300));
  const loaded = planner.loadPlan(room.roomDir, built.run_id);
  if (!loaded.ok) throw new Error('loadPlan failed: ' + JSON.stringify(loaded));
  if (loaded.plan.status !== 'ready') throw new Error('plan status ' + loaded.plan.status + ' ' + JSON.stringify(built.local_only_leaves));
  return loaded.plan;
}
function approveRun(room, plan) {
  const p = grants.buildRunGrant(plan);
  p.room_id = grants.roomIdFor(room.roomDir);
  const w = grants.writeGrant(room.roomDir, p, { approved_via: VIA });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}
function shapeRoute(q) {
  const s = String(q || '');
  if (s.indexOf(' OR ') !== -1) return 'synonym_hits';
  if (s.indexOf(' AND (') !== -1) return 'gap_primary_zero';
  return 'derivation_hit';
}
async function runQuickWith(room, plan, route) {
  approveRun(room, plan);
  const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: real.realFetchEnvelope(route), now: Date.now() });
  if (out.status !== 'done') throw new Error('runQuick ' + out.status + ' ' + (out.reason || ''));
  return out;
}
function fetchQs(plan) {
  const seen = {};
  const out = [];
  plan.leaves.forEach(function (leaf) {
    if (!leaf || leaf.researchable !== true || leaf.corpus !== 'openalex') return;
    (leaf.queries || []).forEach(function (q) {
      if (!q || (q.round !== undefined && q.round !== 1) || seen[q.q_hash]) return;
      seen[q.q_hash] = true;
      out.push(q);
    });
  });
  return out;
}

// ---- deep helpers ---------------------------------------------------------------------
function srRoute(q) {
  const s = String(q || '');
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
function analyst(p, round) {
  const rows = [];
  if (round === 1 && p.lane === 'LM1') rows.push(rowOf('derivation_hit', 0, 'L8', 'derivation'));
  if (round === 1 && p.lane === 'LM2') rows.push(rowOf('retest_hit', 0, 'L9', 'retest'));
  if (round === 2 && p.lane === 'LM2') rows.push(rowOf('scurve_ceiling', 0, 'L9', 'scurve_ceiling'));
  return rows;
}
function deepPlan(room, budget) {
  const built = planner.buildPlan(room.roomDir, clone(QS_SR), { mode: 'deep', now: new Date('2026-10-04T00:00:00Z') });
  const plan = built.plan;
  Object.assign(plan.budget, budget || {});
  plan.plan_hash = planMod.planHash(plan);
  return plan;
}
function deepSeam(route) {
  const rp = makeReplayFetch({ route: route || srRoute, bodies: BODIES });
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
// drive to synthesize (the HARNESS-01 loop); onStep(stepName) runs before each step
async function driveDeep(room, plan, onStep) {
  const id = plan.run_id;
  const env = { fetchEnvelopeFn: deepSeam() };
  let result = null;
  for (let g = 0; g < 60; g += 1) {
    const n = deepMod.nextDeepStep(room.roomDir, id);
    if (!n.ok) throw new Error('nextDeepStep ' + JSON.stringify(n));
    if (typeof onStep === 'function') onStep(n.step);
    if (n.step === 'fetch_round') {
      const fr = await deepMod.fetchRound(room.roomDir, id, env);
      if (!fr.ok) throw new Error('fetchRound ' + JSON.stringify(fr));
    } else if (n.step === 'dispatch_lanes') {
      n.payload.lanes.forEach(function (p) { deepMod.recordLaneRows(room.roomDir, id, p.lane, analyst(p, n.round)); });
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

async function main() {
  // ---- L1 quick ledger ----
  let l1 = null;
  await leg('L1 quick run writes operations.json: one op per fetch query, all terminal, run.operations equals the file, completion sums up', async function () {
    const room = newRoom();
    const plan = builtQuick(room);
    const qs = fetchQs(plan);
    const nq = qs.length;
    const emptyQ = qs[1] ? qs[1].q : null;
    // one search answers with a counted zero, the others with results: the ledger must tell them apart
    const out = await runQuickWith(room, plan, function (q) { return q === emptyQ ? 'gap_primary_zero' : shapeRoute(q); });
    const ledger = ledgerOf(room, plan.run_id);
    if (!ledger) return 'operations.json missing';
    const run = runJson(room, plan.run_id);
    l1 = { room: room, plan: plan, ledger: ledger, run: run };
    const sum = Object.keys(run.completion && run.completion.by_state ? run.completion.by_state : {}).reduce(function (n, k) { return n + run.completion.by_state[k]; }, 0);
    console.log('L1 measured: fetch queries=' + nq + ' ops=' + ledger.operations.length + ' states=' + byState(ledger) + ' complete=' + (run.completion && run.completion.complete));
    assert.strictEqual(ledger.operations.length, nq, 'ops ' + ledger.operations.length + ' vs queries ' + nq);
    assert.ok(ledger.operations.every(isTerm), 'a non-terminal op is left');
    assert.deepStrictEqual(run.operations, ledger.operations, 'run.operations differs from the file');
    assert.ok(run.completion && typeof run.completion.complete === 'boolean', 'run.completion missing');
    assert.strictEqual(sum, ledger.operations.length, 'by_state sum ' + sum);
    assert.ok(nq >= 2 && countBy(ledger, function (o) { return o.state === 'executed_empty' && o.result_count === 0; }) === 1, 'expected one executed_empty op with a counted zero: ' + byState(ledger));
    assert.ok(countBy(ledger, function (o) { return o.state === 'executed_with_results' && o.result_count > 0; }) === nq - 1, 'expected the rest executed_with_results: ' + byState(ledger));
    assert.deepStrictEqual(run.completion, operations.completion(ledger, { counterevidence_needed: false }), 'completion is not the ledger completion');
    assert.ok(out.run.completion && out.run.operations, 'the returned run lacks the ledger fields');
    return true;
  });

  // ---- L2 failure ----
  await leg('L2 a provider 500 is not_executed with attempted true and provider_failed:<class>, never executed_empty', async function () {
    const room = newRoom();
    const plan = builtQuick(room);
    const qs = fetchQs(plan);
    const failQ = qs[0].q;
    await runQuickWith(room, plan, function (q) { return q === failQ ? SENTINELS.SENTINEL_500 : shapeRoute(q); });
    const ledger = ledgerOf(room, plan.run_id);
    const run = runJson(room, plan.run_id);
    const bad = ledger.operations.filter(function (o) { return o.q === failQ; })[0];
    if (!bad) return 'no op for the failed query';
    console.log('L2 measured: failed op state=' + bad.state + ' attempted=' + bad.attempted + ' reason=' + bad.reason + ' complete=' + run.completion.complete);
    assert.strictEqual(bad.state, 'not_executed');
    assert.strictEqual(bad.attempted, true);
    assert.ok(/^provider_failed:.+/.test(bad.reason), 'reason ' + bad.reason);
    assert.strictEqual(run.completion.complete, false);
    ledger.operations.filter(function (o) { return o.state === 'executed_empty'; }).forEach(function (o) {
      assert.strictEqual(o.result_count, 0, 'an executed_empty op without a counted zero');
    });
    assert.ok(run.completion.incomplete.some(function (i) { return i.operation_id === bad.operation_id; }), 'the failed op does not travel in completion.incomplete');
    return true;
  });

  // ---- L3 refusal trace ----
  await leg('L3 a refused slot keeps leaf.refusal on the saved plan and a refused_before_fetch op in the ledger', async function () {
    const room = newRoom();
    const plan = builtQuick(room, function (qs) { qs.leaves[0].slots = { term: 'x' }; });
    const l1leaf = plan.leaves.filter(function (l) { return l.id === 'L1'; })[0];
    if (!l1leaf || !l1leaf.refusal) return 'leaf.refusal missing on the saved plan: ' + JSON.stringify(l1leaf && Object.keys(l1leaf));
    assert.ok(typeof l1leaf.refusal.reason === 'string' && l1leaf.refusal.reason.length > 0, 'refusal.reason');
    assert.ok('slot' in l1leaf.refusal, 'refusal.slot key');
    await runQuickWith(room, plan, shapeRoute);
    const ledger = ledgerOf(room, plan.run_id);
    const refused = ledger.operations.filter(function (o) { return o.state === 'refused_before_fetch' && o.plan_dimension === 'L1'; });
    console.log('L3 measured: refusal=' + JSON.stringify(l1leaf.refusal) + ' refused ops for L1=' + refused.length + ' reason=' + (refused[0] && refused[0].reason));
    assert.strictEqual(refused.length, 1, 'refused ops ' + refused.length);
    assert.ok(/^bad_slot:.+/.test(refused[0].reason) || refused[0].reason === 'term_not_composed', 'reason ' + refused[0].reason);
    assert.strictEqual(refused[0].attempted, false);
    return true;
  });

  // ---- L4 deep ledger ----
  await leg('L4 deep run to synthesize: every op terminal, round-one, round-two and counterevidence ops present, run.completion present', async function () {
    const room = newRoom();
    const plan = deepPlan(room, {});
    deepInit(room, plan);
    const result = await driveDeep(room, plan);
    const ledger = ledgerOf(room, plan.run_id);
    if (!ledger) return 'operations.json missing';
    const run = result.run;
    const r1 = countBy(ledger, function (o) { return o.round === 1 && o.plan_dimension.indexOf('CE:') !== 0; });
    const r2 = countBy(ledger, function (o) { return o.round === 2 && o.plan_dimension.indexOf('CE:') !== 0; });
    const ce = countBy(ledger, function (o) { return o.plan_dimension.indexOf('CE:') === 0; });
    const fal = countBy(ledger, function (o) { return o.kind === 'falsifier'; });
    console.log('L4 measured: ops=' + ledger.operations.length + ' round1=' + r1 + ' round2=' + r2 + ' ce=' + ce + ' falsifier=' + fal + ' states=' + byState(ledger) + ' complete=' + (run.completion && run.completion.complete));
    assert.ok(ledger.operations.every(isTerm), 'a non-terminal op is left: ' + byState(ledger));
    assert.ok(r1 > 0 && r2 > 0 && ce > 0, 'round ops missing');
    assert.ok(fal > 0, 'no falsifier op');
    assert.ok(ledger.operations.filter(function (o) { return o.plan_dimension.indexOf('CE:') === 0; }).every(function (o) { return o.kind === 'falsifier'; }), 'a CE op is not a falsifier');
    assert.ok(run.completion && typeof run.completion.complete === 'boolean', 'run.completion missing');
    assert.deepStrictEqual(run.operations, ledger.operations, 'run.operations differs from the file');
    assert.deepStrictEqual(run.completion, operations.completion(ledger, { counterevidence_needed: plan.budget.counterevidence === true }));
    assert.deepStrictEqual(runJson(room, plan.run_id).completion, run.completion, 'run.json on disk');
    return true;
  });

  // ---- L5 lane_cap ----
  await leg('L5 lanes cut by the fan-out cap become not_executed ops with reason lane_cap', async function () {
    const full = newRoom();
    const fullPlan = deepPlan(full, {});
    const lanesDefault = deepInit(full, fullPlan).state.lanes.length;
    const room = newRoom();
    const plan = deepPlan(room, { breadth: 2 });
    const init = deepInit(room, plan);
    const ledger = ledgerOf(room, plan.run_id);
    const cut = ledger.operations.filter(function (o) { return o.reason === 'lane_cap'; });
    console.log('L5 measured: lanes at default=' + lanesDefault + ' lanes at breadth 2=' + init.state.lanes.length + ' lane_cap ops=' + cut.length);
    assert.strictEqual(init.state.lanes.length, 2);
    assert.ok(lanesDefault > 2 && cut.length === lanesDefault - 2, 'lane_cap ops ' + cut.length + ' expected ' + (lanesDefault - 2));
    assert.ok(cut.every(function (o) { return o.state === 'not_executed' && o.attempted === false; }), 'a lane_cap op is not not_executed');
    return true;
  });

  // ---- L6 search_cap ----
  await leg('L6 counterevidence branches cut by the search cap become not_executed ops with reason search_cap', async function () {
    const room = newRoom();
    const plan = deepPlan(room, { max_searches: 8 });
    deepInit(room, plan);
    await driveDeep(room, plan);
    const ledger = ledgerOf(room, plan.run_id);
    const state = deepMod.loadState(room.roomDir, plan.run_id).state;
    const over = state.ce.gaps.filter(function (g) { return g.reason === 'over_cap'; }).length;
    const capOps = ledger.operations.filter(function (o) { return o.reason === 'search_cap' && o.plan_dimension.indexOf('CE:') === 0; });
    console.log('L6 measured: over_cap gaps=' + over + ' search_cap CE ops=' + capOps.length + ' states=' + byState(ledger));
    assert.ok(over > 0, 'the scenario produced no over_cap gap');
    assert.strictEqual(capOps.length, over);
    assert.ok(capOps.every(function (o) { return o.state === 'not_executed' && o.kind === 'falsifier'; }));
    assert.ok(ledger.operations.every(isTerm), 'a non-terminal op is left');
    return true;
  });

  // ---- L7 stable ids ----
  await leg('L7 operation ids are unchanged across loadState, nextDeepStep and later rounds', async function () {
    const room = newRoom();
    const plan = deepPlan(room, {});
    deepInit(room, plan);
    const A = ledgerOf(room, plan.run_id);
    const idsA = A.operations.map(function (o) { return o.operation_id; });
    assert.ok(idsA.length > 0, 'no ops at init');
    deepMod.loadState(room.roomDir, plan.run_id);
    deepMod.nextDeepStep(room.roomDir, plan.run_id);
    const B = ledgerOf(room, plan.run_id);
    assert.deepStrictEqual(B.operations.map(function (o) { return o.operation_id; }), idsA, 'ids moved after loadState and nextDeepStep');
    await driveDeep(room, plan);
    const C = ledgerOf(room, plan.run_id);
    const idsC = C.operations.map(function (o) { return o.operation_id; });
    A.operations.forEach(function (o) {
      const later = C.operations.filter(function (x) { return x.operation_id === o.operation_id; })[0];
      assert.ok(later, 'op ' + o.operation_id + ' vanished');
      ['plan_dimension', 'kind', 'template_id', 'round', 'ordinal', 'q'].forEach(function (k) { assert.strictEqual(later[k], o[k], k + ' changed'); });
    });
    assert.strictEqual(new Set(idsC).size, idsC.length, 'duplicate ids');
    console.log('L7 measured: ids at init=' + idsA.length + ' ids at synthesize=' + idsC.length);
    return true;
  });

  // ---- L8 audit_ref ----
  await leg('L8 each executed op audit_ref.q_hash matches exactly one research-audit.jsonl record', async function () {
    if (!l1) return 'L1 did not run';
    const rows = auditLedger.readAudit(l1.room.roomDir, { run_id: l1.plan.run_id });
    const executed = l1.ledger.operations.filter(function (o) { return o.state === 'executed_with_results' || o.state === 'executed_empty'; });
    console.log('L8 measured: executed ops=' + executed.length + ' audit rows=' + rows.length);
    assert.ok(executed.length > 0, 'no executed ops');
    executed.forEach(function (o) {
      assert.ok(o.audit_ref && typeof o.audit_ref.q_hash === 'string', 'audit_ref missing on ' + o.operation_id);
      const hits = rows.filter(function (r) { return r.q_hash === o.audit_ref.q_hash; });
      assert.strictEqual(hits.length, 1, 'audit rows for ' + o.audit_ref.q_hash + ': ' + hits.length);
    });
    return true;
  });

  // ---- L9 theo ----
  await leg('L9 a plan with theo leaves mints one theo op per leaf and maps each check outcome', async function () {
    let fixture366 = null;
    let cn = null;
    try {
      fixture366 = require('./helpers/fixture-366.cjs');
      cn = require(path.join(RP, 'perspectives', 'connections-recall.cjs'));
    } catch (e) { return 'fixtures missing: ' + e.message; }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos3692-14-theo-'));
    rooms.push({ cleanup: function () { fs.rmSync(root, { recursive: true, force: true }); } });
    const built = fixture366.buildPerspectiveRoom(path.join(root, 'r1'));
    const rec = cn.runRecall(built.roomDir, { tag: '20261006T120001Z' });
    const qs = clone(rec.question_set);
    qs.leaves = qs.leaves.filter(function (l) { return l.dimension !== 'cn:literature_link'; });
    qs.key_line = (qs.key_line || []).filter(function (k) { return k.dimension !== 'cn:literature_link'; });
    qs.coverage_notes = [{ dimension: 'cn:literature_link', not_researchable_reason: 'This fixture exercises the Theo lane only.' }];
    const bp = planner.buildPlan(built.roomDir, qs, { mode: 'quick' });
    if (!bp.ok || bp.plan.status !== 'ready') return 'plan not ready: ' + JSON.stringify(bp.errors);
    const plan = bp.plan;
    const p = grants.buildRunGrant(plan);
    p.room_id = grants.roomIdFor(built.roomDir);
    const w = grants.writeGrant(built.roomDir, p, { approved_via: VIA });
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const RS = 'Reverse Salient Analysis';
    const callTool = async function (name, args) {
      if (name !== 'find_connections') return { error: 'unknown tool' };
      if ((args.from === RS || args.to === RS) && (args.from !== 'Systems Thinking' && args.to !== 'Systems Thinking')) {
        return { paths: [{ path: [args.from, 'Hub', args.to], pathLabels: ['Framework', 'Framework', 'Framework'], edges: ['EXTENDS', 'SUPPORTS'], hops: 2 }] };
      }
      if (args.from === 'Systems Thinking' || args.to === 'Systems Thinking') return { paths: [] };
      return { error: 'rate_limited' };
    };
    const out = await quickMod.runQuick(built.roomDir, plan, { fetchEnvelopeFn: real.realFetchEnvelope(shapeRoute), callTool: callTool, now: Date.now() });
    if (out.status !== 'done') return 'runQuick ' + out.status + ' ' + (out.reason || '');
    const ledger = operations.readLedger(built.roomDir, plan.run_id);
    const theoOps = ledger.operations.filter(function (o) { return o.kind === 'theo'; });
    const checks = out.run.theo_checks;
    console.log('L9 measured: theo ops=' + theoOps.length + ' checks=' + checks.length + ' states=' + byState(ledger));
    assert.ok(theoOps.length > 0 && theoOps.length === checks.length, 'theo ops ' + theoOps.length + ' vs checks ' + checks.length);
    assert.ok(ledger.operations.every(isTerm), 'a non-terminal op is left');
    checks.forEach(function (c) {
      const op = theoOps.filter(function (o) { return o.plan_dimension === c.leaf_id; })[0];
      assert.ok(op, 'no theo op for leaf ' + c.leaf_id);
      assert.strictEqual(op.provider, 'theo');
      if (c.outcome === 'ok') assert.strictEqual(op.state, 'executed_with_results');
      else if (c.outcome === 'empty_valid') { assert.strictEqual(op.state, 'executed_empty'); assert.strictEqual(op.result_count, 0); }
      else if (c.outcome === 'failed') { assert.strictEqual(op.state, 'not_executed'); assert.ok(/^provider_failed:/.test(op.reason)); assert.strictEqual(op.attempted, true); }
      else assert.ok(op.state === 'not_executed' || op.state === 'refused_before_fetch', 'skipped check state ' + op.state);
    });
    return true;
  });

  // ---- L11 corrupt ledger ----
  await leg('L11 a torn operations.json refuses the deep step with ledger_corrupt, never reads as an empty ledger', async function () {
    const room = newRoom();
    const plan = deepPlan(room, {});
    deepInit(room, plan);
    const file = operations.ledgerPath(room.roomDir, plan.run_id);
    fs.writeFileSync(file, '{"schema":"mos.research-operations/1","operations":[', 'utf8');
    const n = deepMod.nextDeepStep(room.roomDir, plan.run_id);
    const f = await deepMod.fetchRound(room.roomDir, plan.run_id, { fetchEnvelopeFn: deepSeam() });
    console.log('L11 measured: nextDeepStep=' + n.reason + ' fetchRound=' + f.reason);
    assert.strictEqual(n.ok, false);
    assert.strictEqual(n.reason, 'ledger_corrupt');
    assert.strictEqual(f.reason, 'ledger_corrupt');
    return true;
  });

  // ---- L10 dash ----
  await leg('L10 no em-dash or en-dash in this file', async function () {
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
