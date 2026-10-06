#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 15 (369.2-R06) -- the counterevidence reserve and the status computed from
 * operation ids (HARNESS-01, SW-03, ACT-06, annex C17, invariant 5). This is the Phase 0
 * HARNESS-01 probe (fixtures/phase0/HARNESS-01) ported into the 363 harness: the same
 * scientific-roadmapping fixture, the same replay routes, the same analyst, driven to synthesize.
 *
 * Measured before this plan (probe scenario B, cap 8): the counterevidence pass planned 0 and
 * executed 0, and the run still reported counterevidence.ran true and synthesized ok true.
 *
 *   B1  cap 8, default reserve: state.ce_reserve is 2 and the counterevidence pass executes at least one search
 *   B2  cap 8, test seam ceReserve 0: the pass ops are not_executed with search_cap, status is partial
 *       (round-one falsifiers count, C17) and completion is false
 *   B3  cap 16: ce_reserve 3, the pass executes at least 3 searches, status complete
 *   B4  C17: falsifiers are counted from operation ids across all rounds (a pass that added zero searches
 *       still reads complete when the round-one falsifiers ran); the count is never the pass alone
 *   B5  contract: run.counterevidence carries status, planned, executed, failed, reasons (and the old fields)
 *   B6  no false pass: a needed pass with no falsifier executed anywhere is not_run, ran false, not complete
 *   B7  reserve formula and enforcement: 16 -> 3, 8 -> 2, 3 -> 1, cap 1 -> 0 (never starves round one);
 *       rounds and follow-ups never spend the reserve
 *   B8  no em-dash or en-dash in this file
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
const { check, summary } = makeChecker('test-3692-ce-budget');

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
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
const { makeReplayFetch } = require('./helpers/openalex-replay-363.cjs');
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));

const QS_SR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const BODIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-15-test' };

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}
process.on('exit', function () { rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* best effort */ } }); });

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function byState(ledger) {
  const o = {};
  ledger.operations.forEach(function (x) { o[x.state] = (o[x.state] || 0) + 1; });
  return JSON.stringify(o);
}
function isCe(o) { return typeof o.plan_dimension === 'string' && o.plan_dimension.indexOf('CE:') === 0; }
function executedOps(list) {
  return list.filter(function (o) { return o.state === 'executed_with_results' || o.state === 'executed_empty'; });
}

async function leg(name, fn) {
  try {
    const r = await fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 400));
  }
}

// ---- the HARNESS-01 probe, ported (its replay routes and analyst, verbatim in behavior) ----
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
function deepSeam() {
  const rp = makeReplayFetch({ route: srRoute, bodies: BODIES });
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = rp;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
}
function deepInit(room, plan, initOpts) {
  const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
  if (!w.ok) throw new Error('deep grant refused ' + JSON.stringify(w));
  const init = deepMod.initDeepState(room.roomDir, plan, w.grant, initOpts || {});
  if (!init.ok) throw new Error('init ' + JSON.stringify(init));
  return init;
}
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
// one full scenario: plan at a cap, optional reserve seam, driven to synthesize
async function scenario(cap, initOpts) {
  const room = newRoom();
  const plan = deepPlan(room, cap === null ? {} : { max_searches: cap });
  deepInit(room, plan, initOpts);
  const result = await driveDeep(room, plan);
  const ledger = operations.readLedger(room.roomDir, plan.run_id);
  const state = deepMod.loadState(room.roomDir, plan.run_id).state;
  return { room: room, plan: plan, result: result, run: result.run, ledger: ledger, state: state };
}

async function main() {
  // ---- B1 cap 8, default reserve ----
  await leg('B1 cap 8 with the default reserve: ce_reserve is 2 and the counterevidence pass executes at least one search', async function () {
    const s = await scenario(8);
    const cePass = executedOps(s.ledger.operations.filter(isCe)).length;
    const ce = s.run.counterevidence;
    console.log('B1 measured: cap=8 ce_reserve=' + s.state.ce_reserve + ' pass executed=' + cePass + ' run.counterevidence.executed=' + (ce && ce.executed) + ' status=' + (ce && ce.status) + ' searches_used=' + s.state.searches_used + ' stop=' + s.state.stop_reason);
    assert.ok(cePass >= 1, 'the counterevidence pass executed=' + cePass);
    assert.strictEqual(s.state.ce_reserve, 2, 'ce_reserve ' + s.state.ce_reserve);
    assert.ok(ce && ce.executed >= 1, 'run.counterevidence.executed=' + (ce && ce.executed));
    assert.ok(ce.status === 'complete' || ce.status === 'partial', 'status ' + ce.status);
    return true;
  });

  // ---- B2 cap 8, reserve 0 ----
  await leg('B2 cap 8 with ceReserve 0: the pass ops are not_executed with search_cap, status partial, completion false', async function () {
    const s = await scenario(8, { ceReserve: 0 });
    const ceOps = s.ledger.operations.filter(isCe);
    const ce = s.run.counterevidence;
    console.log('B2 measured: ce_reserve=' + s.state.ce_reserve + ' CE pass ops=' + ceOps.length + ' states=' + byState({ operations: ceOps }) + ' status=' + (ce && ce.status) + ' executed=' + (ce && ce.executed) + ' planned=' + (ce && ce.planned) + ' complete=' + (s.run.completion && s.run.completion.complete));
    assert.strictEqual(s.state.ce_reserve, 0, 'the seam did not set the reserve');
    assert.ok(ceOps.length > 0 && ceOps.every(function (o) { return o.state === 'not_executed' && o.reason === 'search_cap'; }), 'a pass op is not not_executed/search_cap');
    assert.ok(ce && ce.status === 'partial', 'status ' + (ce && ce.status));
    assert.ok(ce.executed >= 1, 'round-one falsifiers must count (C17): executed=' + ce.executed);
    assert.strictEqual(s.run.completion.complete, false);
    return true;
  });

  // ---- B3 cap 16 ----
  let b3 = null;
  await leg('B3 cap 16: ce_reserve 3, the pass executes at least 3 searches, status complete', async function () {
    const s = await scenario(null);
    b3 = s;
    const cePass = executedOps(s.ledger.operations.filter(isCe)).length;
    const ce = s.run.counterevidence;
    console.log('B3 measured: cap=' + s.state.max_searches_base + ' ce_reserve=' + s.state.ce_reserve + ' pass executed=' + cePass + ' run.counterevidence=' + JSON.stringify(ce && { status: ce.status, planned: ce.planned, executed: ce.executed, failed: ce.failed }) + ' searches_used=' + s.state.searches_used);
    assert.strictEqual(s.state.max_searches_base, 16);
    assert.strictEqual(s.state.ce_reserve, 3, 'ce_reserve ' + s.state.ce_reserve);
    assert.ok(cePass >= 3, 'pass executed=' + cePass);
    assert.ok(ce && ce.executed >= 3, 'run.counterevidence.executed=' + (ce && ce.executed));
    assert.strictEqual(ce.status, 'complete');
    return true;
  });

  // ---- B4 C17 ----
  await leg('B4 C17: falsifiers are counted from operation ids across all rounds, so a pass that added zero searches still reads complete', async function () {
    if (!b3) return 'B3 did not run';
    const all = b3.ledger.operations;
    const falsifiers = all.filter(function (o) { return o.kind === 'falsifier'; });
    const roundOne = falsifiers.filter(function (o) { return !isCe(o); });
    const ce = b3.run.counterevidence;
    // the beta.55 shape: every counterevidence branch already ran as a round-one falsifier, so the extra pass
    // has nothing left to plan. Derive that ledger from the real run by dropping the pass ops.
    const noExtra = { operations: all.filter(function (o) { return !isCe(o); }) };
    const st = operations.counterevidenceStatus(noExtra, { needed: true });
    console.log('B4 measured: falsifier ops=' + falsifiers.length + ' round-one falsifiers=' + roundOne.length + ' run.counterevidence.executed=' + (ce && ce.executed) + ' no-extra-pass status=' + st.status + ' executed=' + st.executed + ' planned=' + st.planned);
    assert.ok(roundOne.length > 0 && executedOps(roundOne).length === roundOne.length, 'round-one falsifiers did not all run');
    assert.ok(ce && ce.executed === executedOps(falsifiers).length, 'run.counterevidence.executed is not the all-rounds count: ' + (ce && ce.executed));
    assert.ok(ce.executed > executedOps(falsifiers.filter(isCe)).length, 'the count is the extra pass alone');
    assert.strictEqual(st.status, 'complete');
    assert.strictEqual(st.executed, roundOne.length, 'executed counted from round-one ops');
    assert.ok(st.executed > 0, 'executed 0');
    return true;
  });

  // ---- B5 contract ----
  await leg('B5 run.counterevidence carries status, planned, executed, failed, reasons and keeps the old fields', async function () {
    if (!b3) return 'B3 did not run';
    const ce = b3.run.counterevidence;
    const keys = ['status', 'planned', 'executed', 'failed', 'reasons'];
    const old = ['ran', 'skipped', 'skipped_reason', 'partial', 'queries', 'gaps'];
    const missing = keys.concat(old).filter(function (k) { return !(k in ce); });
    console.log('B5 measured: keys=' + Object.keys(ce).join(','));
    assert.deepStrictEqual(missing, [], 'missing keys: ' + missing.join(','));
    assert.ok(['complete', 'partial', 'not_run', 'not_needed'].indexOf(ce.status) !== -1, 'status ' + ce.status);
    assert.ok(Number.isInteger(ce.planned) && Number.isInteger(ce.executed) && Number.isInteger(ce.failed) && Array.isArray(ce.reasons));
    assert.deepStrictEqual({ status: ce.status, planned: ce.planned, executed: ce.executed, failed: ce.failed, reasons: ce.reasons },
      operations.counterevidenceStatus(b3.ledger, { needed: true }), 'not the ledger status');
    assert.deepStrictEqual(b3.run.completion.counterevidence, operations.counterevidenceStatus(b3.ledger, { needed: true }), 'completion carries a different status');
    return true;
  });

  // ---- B6 no false pass ----
  await leg('B6 a needed pass with no falsifier executed anywhere is not_run, ran false, never complete', async function () {
    const s = await scenario(1, { ceReserve: 0 });
    const ce = s.run.counterevidence;
    const exec = executedOps(s.ledger.operations.filter(function (o) { return o.kind === 'falsifier'; })).length;
    console.log('B6 measured: searches_used=' + s.state.searches_used + ' falsifier executed=' + exec + ' status=' + (ce && ce.status) + ' ran=' + (ce && ce.ran) + ' complete=' + s.run.completion.complete + ' unresolved has CE flag=' + s.run.unresolved_branches.indexOf('counterevidence not run'));
    assert.strictEqual(exec, 0, 'a falsifier executed in the scenario');
    assert.strictEqual(ce.status, 'not_run');
    assert.strictEqual(ce.ran, false);
    assert.strictEqual(s.run.completion.complete, false);
    assert.ok(s.run.unresolved_branches.indexOf('counterevidence not run') !== -1, 'unresolved_branches lacks the counterevidence flag');
    return true;
  });

  // ---- B7 formula and enforcement ----
  await leg('B7 reserve formula (16 -> 3, 8 -> 2, 3 -> 1, 1 -> 0) and rounds never spend the reserve', async function () {
    const got = {};
    const rooms7 = [];
    [16, 8, 3, 1].forEach(function (cap) {
      const room = newRoom();
      rooms7.push(room);
      const plan = deepPlan(room, { max_searches: cap });
      got[cap] = deepInit(room, plan).state.ce_reserve;
    });
    const s = await scenario(8);
    const roundSpend = executedOps(s.ledger.operations.filter(function (o) { return !isCe(o); })).length;
    console.log('B7 measured: reserve by cap=' + JSON.stringify(got) + ' cap 8 round-and-follow-up searches=' + roundSpend + ' (bound ' + (8 - 2) + ')');
    assert.deepStrictEqual(got, { 16: 3, 8: 2, 3: 1, 1: 0 });
    assert.ok(roundSpend <= 8 - 2, 'rounds spent ' + roundSpend + ' of a ' + (8 - 2) + ' search round budget');
    assert.ok(s.state.searches_used <= 8, 'searches_used ' + s.state.searches_used);
    return true;
  });

  // ---- B8 dash ----
  await leg('B8 no em-dash or en-dash in this file', async function () {
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
