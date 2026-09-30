'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 13 -- the deep research run controller
 * (lib/core/research-planner/deep.cjs). Legs E1-E13, all offline on OpenAlex
 * replay.
 *
 * The replay fetch is injected through the fetchEnvelopeFn seam and swapped
 * into globalThis.fetch only for the duration of one corpus call; the net guard
 * stays installed everywhere else and its counter is the last check. The lane
 * analyst is simulated here: the test writes rows JSON that quote fetched
 * records. Rooms come from fixture-room-363. No em-dash or en-dash literals:
 * those characters are spelled with String.fromCharCode.
 *
 * Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-deep-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const NET_GUARD_FETCH = globalThis.fetch;
const { check, summary } = hygiene.makeChecker('363-13 deep research run controller');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const FIXTURES = path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json');
if (!fs.existsSync(FIXTURES)) {
  console.log('SKIP: 363-02 fixtures absent');
  process.exit(77);
}
const BODIES = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));

const { makeReplayFetch, SENTINELS } = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'));
const { buildRoom363, GAP_TERM_363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));

const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const pyramid = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'pyramid.cjs'));
const perspective = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'perspective.cjs'));
const families = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'families.cjs'));
const planMod = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'plan.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const auditLedger = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs'));
const orchestrator = require(path.join(ROOT, 'lib', 'core', 'futures', 'orchestrator.cjs'));

let DEEP = null;
let QUICK = null;
let loadError = null;
try {
  QUICK = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'quick.cjs'));
  DEEP = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'deep.cjs'));
} catch (e) {
  loadError = e;
}

const SR_QS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const WS_QS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
const SYN = 'ultrasonic biofilm removal';
const VIA = { surface: 'cli', decision_node_id: 'd-363-13-test' };
const B = planMod.BUDGETS;

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  try { fs.rmSync(path.join(TMP_HOME, '.mindrian'), { recursive: true, force: true }); } catch (_e) { /* ok */ }
  return r;
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }

// -- plan builders -----------------------------------------------------------
function attachRoundOne(plan) {
  DEEP.roundOneQueries(plan).forEach(function (lane) {
    const leaf = plan.leaves.filter(function (l) { return l.id === lane.leaf_ids[0]; })[0];
    leaf.queries = leaf.queries.concat(lane.queries);
  });
  plan.plan_hash = planMod.planHash(plan);
  return plan;
}

function deepBudget(over) {
  return Object.assign({
    breadth: B.DEEP_LANES_REQUESTED, rounds: B.DEEP_ROUNDS, queries_per_round: B.DEEP_R1_QUERIES_PER_LANE,
    results_per_query: B.DEEP_RESULTS_PER_QUERY, max_searches: B.DEEP_MAX_SEARCHES,
    time_budget_ms: B.DEEP_TIME_BUDGET_MS, counterevidence: true,
  }, over || {});
}

function makeSrPlan(over) {
  const bp = pyramid.buildPyramid(SR_QS, {});
  if (!bp.ok) throw new Error('pyramid failed: ' + JSON.stringify(bp.errors));
  const pp = perspective.buildPerspective(SR_QS.perspective, { mode: 'deep', depth: 'full', template: 'scientific-roadmapping' });
  const plan = {
    schema: planMod.PLAN_SCHEMA,
    run_id: planMod.newRunId(new Date('2026-09-29T10:00:00Z')),
    mode: 'deep', version: 1, max_revisions: 3, revision: 0, status: 'ready', parent_plan_hash: null,
    origin: { template_id: 'scientific-roadmapping', command: '/mos:research' },
    context: { rung: 'unknown', scientific: { scientific: true, signals: ['S5:navigator_toggle'] } },
    structure: { source: 'local_template', tree_type: bp.pyramid.tree_type },
    perspective: pp.perspective, pyramid: bp.pyramid, leaves: bp.leaves,
    budget: deepBudget(over), stop_rules: ['cap', 'saturation', 'budget', 'time'],
    grant_ref: null, return_target: { section: 'market-analysis' }, plan_hash: null,
  };
  const v = planMod.validatePlan(plan);
  if (!v.ok) throw new Error('sr plan invalid: ' + JSON.stringify(v.errors));
  return attachRoundOne(plan);
}

function makeWsQuickPlan() {
  const qs = clone(WS_QS);
  qs.leaves[0].slots = { term: GAP_TERM_363, synonyms: [SYN] };
  qs.leaves[1].slots = { term: GAP_TERM_363, synonyms: [SYN] };
  const bp = pyramid.buildPyramid(qs, {});
  if (!bp.ok) throw new Error('pyramid failed: ' + JSON.stringify(bp.errors));
  const pp = perspective.buildPerspective(qs.perspective, { mode: 'quick', depth: 'lite' });
  const plan = {
    schema: planMod.PLAN_SCHEMA,
    run_id: planMod.newRunId(new Date('2026-09-29T10:00:00Z')),
    mode: 'quick', version: 1, max_revisions: 3, revision: 0, status: 'ready', parent_plan_hash: null,
    origin: { template_id: 'whitespace', command: '/mos:whitespace' },
    context: { rung: 'unknown', scientific: { scientific: false, signals: [] } },
    structure: { source: 'local_template', tree_type: bp.pyramid.tree_type },
    perspective: pp.perspective, pyramid: bp.pyramid, leaves: bp.leaves,
    budget: { breadth: 1, rounds: 1, queries_per_round: 3, results_per_query: 5, max_searches: 3, time_budget_ms: 60000, counterevidence: false },
    stop_rules: ['cap', 'time', 'budget'], grant_ref: null, return_target: { section: 'market-analysis' }, plan_hash: null,
  };
  plan.plan_hash = planMod.planHash(plan);
  return plan;
}

function makeWsDeepPlan() {
  const deep = QUICK.escalateToDeep(makeWsQuickPlan(), null);
  const v = planMod.validatePlan(deep);
  if (!v.ok) throw new Error('ws deep plan invalid: ' + JSON.stringify(v.errors));
  return attachRoundOne(deep);
}

function approve(room, plan) {
  const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}

// -- replay ------------------------------------------------------------------
function srRoute(q) {
  const s = String(q || '');
  if (/fundamental limit/.test(s)) return 'derivation_hit';
  if (/overcome/.test(s)) return 'retest_hit';
  if (/saturation/.test(s)) return /host volume swing/.test(s) ? 'scurve_headroom' : 'scurve_ceiling';
  if (/\(review OR survey\)/.test(s)) return 'prior_review_two';
  return 'gap_primary_zero';
}
function replayFor(route, opts) {
  return makeReplayFetch(Object.assign({ route: route, bodies: BODIES }, opts || {}));
}
function seam(replay) {
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = replay;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
}

// -- analyst simulation ------------------------------------------------------
function idsOf(key) { return BODIES[key].results.map(function (r) { return r.id; }); }
function rec(key, i) { return BODIES[key].results[i]; }
function rowOf(key, i, leafId, label, quote) {
  const r = rec(key, i);
  return { leaf_id: leafId, record_id: r.id, claim: 'Model claim for ' + leafId, quote: quote || r.title, label: label };
}
function readRecords(room, payload) {
  const f = path.join(room.roomDir, payload.records_path);
  return JSON.parse(fs.readFileSync(f, 'utf8')).records;
}

// The scenario: LM1 gets a derivation row, LM2 a retest row then an S-curve
// ceiling, LM3 nothing (or a timing headroom row when asked), LM4 nothing.
function srAnalyst(cfg) {
  const c = cfg || {};
  return function (p, records, round) {
    const rows = [];
    if (round === 1 && p.lane === 'LM1') rows.push(rowOf('derivation_hit', 0, 'L8', 'derivation'));
    if (round === 1 && p.lane === 'LM2') {
      rows.push(rowOf('retest_hit', 0, 'L9', 'retest'));
      if (c.contested) { rows.push(rowOf('retest_hit', 1, 'L3', 'supports')); rows.push(rowOf('retest_hit', 0, 'L3', 'contradicts')); }
    }
    if (round === 2 && p.lane === 'LM2') rows.push(rowOf('scurve_ceiling', 0, 'L9', 'scurve_ceiling'));
    if (round === 2 && p.lane === 'LM3' && c.timing) rows.push(rowOf('scurve_headroom', 0, 'L15', 'scurve_headroom'));
    if (c.paraphrase && p.lane === 'LM4') rows.push({ leaf_id: 'L11', record_id: rec('derivation_hit', 0).id, claim: 'x', quote: 'a paraphrase that never appears in the record', label: 'supports' });
    return rows;
  };
}

// -- driver ------------------------------------------------------------------
async function drive(room, plan, cfg) {
  const c = cfg || {};
  const replay = c.replay || replayFor(srRoute);
  const grant = c.grant || approve(room, plan);
  const init = DEEP.initDeepState(room.roomDir, plan, grant, c.init || {});
  const out = { replay: replay, grant: grant, init: init, steps: [], fetched: [], lanes: [] };
  if (!init.ok) return out;
  const id = plan.run_id;
  const env = { fetchEnvelopeFn: seam(replay) };
  for (let guardN = 0; guardN < 60; guardN += 1) {
    const n = DEEP.nextDeepStep(room.roomDir, id);
    if (!n.ok) { out.error = n; return out; }
    out.steps.push(n.step);
    if (n.step === 'fetch_round') {
      const fr = await DEEP.fetchRound(room.roomDir, id, env);
      out.fetched.push(fr);
      if (!fr.ok) { out.error = fr; return out; }
    } else if (n.step === 'dispatch_lanes') {
      n.payload.lanes.forEach(function (p) {
        out.lanes.push({ round: n.round, lane: p.lane });
        const rows = (c.analyst || srAnalyst())(p, readRecords(room, p), n.round);
        const rr = DEEP.recordLaneRows(room.roomDir, id, p.lane, rows);
        if (rr && rr.ok === false) out.error = rr;
        (out.recorded = out.recorded || []).push(rr);
      });
    } else if (n.step === 'reflect') {
      out.reflect = n.payload;
      const pf = DEEP.proposeFollowups(room.roomDir, id, c.followups ? c.followups(n.payload) : []);
      out.proposed = pf;
      if (!pf.ok) { out.error = pf; return out; }
    } else if (n.step === 'extend_card') {
      out.card = n.payload.card;
      const d = DEEP.applyExtendDecision(room.roomDir, id, c.decision || 'stop', { approved_via: VIA });
      if (!d.ok) { out.error = d; return out; }
    } else if (n.step === 'counterevidence') {
      out.cePayload = n.payload;
      const ce = await DEEP.runCounterevidence(room.roomDir, id, env);
      out.ce = ce;
      if (!ce.ok) { out.error = ce; return out; }
      if (ce.lane_payload) {
        const rows = c.ceRows ? c.ceRows(ce.lane_payload, readRecords(room, ce.lane_payload)) : [];
        const rr = DEEP.recordLaneRows(room.roomDir, id, 'CE', rows);
        if (rr && rr.ok === false) { out.error = rr; return out; }
      }
    } else if (n.step === 'synthesize') {
      out.result = DEEP.synthesize(room.roomDir, id);
      const after = DEEP.nextDeepStep(room.roomDir, id);
      out.steps.push(after.step);
      return out;
    } else if (n.step === 'done') {
      return out;
    }
  }
  out.error = { reason: 'loop_guard' };
  return out;
}

function auditFor(room, id) { return auditLedger.readAudit(room.roomDir, { run_id: id }); }
function hasDash(text) { return text.indexOf(EM) !== -1 || text.indexOf(EN) !== -1; }
function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  entries.forEach(function (e) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out); else out.push(abs);
  });
  return out;
}
function runDir(room, id) { return path.join(room.roomDir, '.mindrian', 'research-runs', id); }
async function leg(name, fn) {
  try {
    const r = await fn();
    if (r === undefined) return;
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.stack) || String(e));
  }
}

const EXPECTED_STEPS = ['fetch_round', 'dispatch_lanes', 'validate', 'reflect', 'fetch_round', 'dispatch_lanes', 'validate', 'counterevidence', 'synthesize', 'done'];
const LEGS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14'];

async function main() {
  check('module loads (deep.cjs)', loadError === null && !!DEEP, loadError ? loadError.message : '');
  if (loadError) {
    LEGS.forEach(function (l) { check(l + ' deep run leg', false, 'module missing'); });
    check('net guard: zero network attempts', guard.attempts() === 0);
    return summary();
  }

  await leg('E1 init refuses without a run grant and with a standing grant; lanes clamped by resolveFanoutCap', async function () {
    const room = newRoom();
    const plan = makeSrPlan();
    const none = DEEP.initDeepState(room.roomDir, plan, null, {});
    const proposal = grants.buildStandingProposal(room.roomDir, { terms: [{ term: GAP_TERM_363, synonyms: [SYN] }] });
    const st = grants.writeGrant(room.roomDir, proposal, { approved_via: VIA });
    const standing = DEEP.initDeepState(room.roomDir, plan, st.grant, {});
    const ambient = DEEP.initDeepState(room.roomDir, plan, approve(room, plan), { trigger: 'ambient' });
    const ok = DEEP.initDeepState(room.roomDir, plan, approve(room, plan), {});
    const cap = orchestrator.resolveFanoutCap({ fanout: B.DEEP_LANES_REQUESTED });
    return none.ok === false && none.reason === 'no_grant'
      && standing.ok === false && standing.reason === 'multi_step'
      && ambient.ok === false
      && ok.ok === true && ok.state.step === 'fetch_round' && ok.state.round === 1
      && ok.state.lanes.length === cap
      && Array.isArray(DEEP.DEEP_STEPS) && DEEP.DEEP_STEPS.length === 8
      || ('none ' + JSON.stringify(none) + ' standing ' + JSON.stringify(standing) + ' lanes ' + (ok.state && ok.state.lanes.length));
  });

  await leg('E2 a round-one hash outside the approved set refuses the round with hash_not_approved and fetches nothing', async function () {
    const room = newRoom();
    const plan = makeSrPlan();
    const grant = approve(room, plan);
    const edited = clone(plan);
    const q = edited.leaves.filter(function (l) { return l.queries.length > 0; })[0].queries[0];
    const swapped = families.composeFamily('constraint-interrogation/v1', { limiter: 'an unapproved limiter phrase' }, { templateIds: ['ci.derivation'], round: 1 }).queries[0];
    Object.assign(q, swapped);
    const replay = replayFor(srRoute);
    const init = DEEP.initDeepState(room.roomDir, edited, grant, {});
    if (!init.ok) return 'init ' + JSON.stringify(init);
    const fr = await DEEP.fetchRound(room.roomDir, edited.run_id, { fetchEnvelopeFn: seam(replay) });
    return fr.ok === false && fr.reason === 'hash_not_approved'
      && replay.calls.length === 0 && auditFor(room, edited.run_id).length === 0
      || ('fr ' + JSON.stringify(fr) + ' calls ' + replay.calls.length);
  });

  let happy = null;
  let happyRoom = null;
  let happyPlan = null;
  await leg('E3 happy path steps in order; one audit record per executed query; stop is cap', async function () {
    happyRoom = newRoom();
    happyPlan = makeSrPlan();
    happy = await drive(happyRoom, happyPlan, { analyst: srAnalyst({ contested: true, timing: true }) });
    if (happy.error) return 'error ' + JSON.stringify(happy.error);
    const audit = auditFor(happyRoom, happyPlan.run_id);
    const r = happy.result;
    return happy.steps.join(',') === EXPECTED_STEPS.join(',')
      && audit.length === 15 && happy.replay.calls.length === audit.length
      && r && r.ok === true && r.run.stop_reason === 'cap' && r.run.mode === 'deep' && r.run.verdict === null
      && planMod.validateRunResult(r.run).ok === true
      || ('steps ' + happy.steps.join(',') + ' audit ' + audit.length + ' calls ' + happy.replay.calls.length + ' stop ' + (r && r.run && r.run.stop_reason) + ' valid ' + JSON.stringify(r && r.run ? planMod.validateRunResult(r.run).errors : r));
  });

  await leg('E4 SR lanes are the top limiters by unlock rank; round 2 halves breadth and reads only still-assumed limiters', async function () {
    if (!happy || !happy.result) return 'no happy run';
    const audit = auditFor(happyRoom, happyPlan.run_id);
    const r1 = audit.slice(0, 8);
    const r2 = audit.slice(8, 12);
    const laneOrder = happy.lanes.filter(function (l) { return l.round === 1; }).map(function (l) { return l.lane; });
    const lanes2 = happy.lanes.filter(function (l) { return l.round === 2; }).map(function (l) { return l.lane; });
    return laneOrder.join(',') === 'LM2,LM3,LM1,LM4'
      && r1.every(function (a) { return a.template_id === 'ci.derivation' || a.template_id === 'ci.retest'; })
      && r1.filter(function (a) { return a.template_id === 'ci.derivation'; }).length === 4
      && r2.every(function (a) { return a.template_id === 'ci.scurve' || a.template_id === 'ci.prior_attack'; })
      && lanes2.join(',') === 'LM2,LM3'
      && r2.every(function (a) { return /anode interface resistance|host volume swing/.test(a.q) && !/cathode host capacity|electrolyte cost floor/.test(a.q); })
      && Math.ceil(laneOrder.length / 2) === lanes2.length
      || ('lanes ' + laneOrder.join(',') + ' / ' + lanes2.join(','));
  });

  await leg('E5 synthesis classifies limiters physics or assumed and reads S-curve rows; diffusion timing rows inform the reading', async function () {
    if (!happy || !happy.result) return 'no happy run';
    const cls = happy.result.run.classifications;
    const by = {};
    cls.forEach(function (c) { by[c.limiter_id] = c; });
    const okBase = by.LM1.column === 'physics' && by.LM1.reason === 'validated_derivation'
      && by.LM2.column === 'assumed' && by.LM2.reason === 're_tested' && by.LM2.s_curve === 'near_ceiling'
      && by.LM3.column === 'assumed' && by.LM4.column === 'assumed' && by.LM4.reason === 'unclear_filed_as_assumed';
    // LM3 has no own S-curve rows; the df:timing headroom row informs it only when the diffusion lens is selected.
    const withDiffusion = by.LM3.s_curve === 'headroom';
    const room = newRoom();
    const plan = makeSrPlan();
    plan.pyramid.lenses_selected = [];
    plan.plan_hash = planMod.planHash(plan);
    const alt = await drive(room, plan, { analyst: srAnalyst({ timing: true }) });
    if (alt.error) return 'alt error ' + JSON.stringify(alt.error);
    const altLm3 = alt.result.run.classifications.filter(function (c) { return c.limiter_id === 'LM3'; })[0];
    return okBase && withDiffusion && altLm3.s_curve === 'unknown'
      || ('base ' + okBase + ' diffusion ' + by.LM3.s_curve + ' alt ' + altLm3.s_curve);
  });

  await leg('E6 in-family follow-up queues without a card; out-of-family halts on F.3; stop goes to counterevidence, extend continues', async function () {
    const inFam = { leaf_id: 'L9', lens: 'ci.retest', slots: { limiter: 'solid electrolyte interphase resistance' } };
    const outFam = { leaf_id: 'L1', lens: 'mu.verify', slots: { term: 'solid state battery pack energy' } };

    const roomA = newRoom();
    const planA = makeSrPlan();
    const a = await drive(roomA, planA, { followups: function () { return [inFam]; } });
    if (a.error) return 'A error ' + JSON.stringify(a.error);
    const aQueries = auditFor(roomA, planA.run_id).map(function (x) { return x.q; });
    const noCard = a.steps.indexOf('extend_card') === -1 && !a.card
      && aQueries.some(function (q) { return /solid electrolyte interphase resistance/.test(q); });

    const roomB = newRoom();
    const planB = makeSrPlan();
    const replayB = replayFor(srRoute);
    const b = await drive(roomB, planB, { replay: replayB, followups: function () { return [outFam]; }, decision: 'stop' });
    if (b.error) return 'B error ' + JSON.stringify(b.error);
    const stopSteps = b.steps.join(',');
    const bQueries = auditFor(roomB, planB.run_id).map(function (x) { return x.q; });
    const cardOk = b.card && b.card.shape === 'F.3' && /solid state battery pack energy/.test(b.card.body_md)
      && bQueries.every(function (q) { return !/solid state battery pack energy/.test(q); });
    const stopGoes = /reflect,extend_card,counterevidence/.test(stopSteps);

    const roomC = newRoom();
    const planC = makeSrPlan();
    const c = await drive(roomC, planC, { followups: function () { return [outFam]; }, decision: 'extend' });
    if (c.error) return 'C error ' + JSON.stringify(c.error);
    const cQueries = auditFor(roomC, planC.run_id).map(function (x) { return x.q; });
    const extendGoes = /reflect,extend_card,fetch_round/.test(c.steps.join(','))
      && cQueries.some(function (q) { return /solid state battery pack energy/.test(q); });
    return (noCard && cardOk && stopGoes && extendGoes)
      || ('noCard ' + noCard + ' cardOk ' + !!cardOk + ' stopGoes ' + stopGoes + ' (' + stopSteps + ') extendGoes ' + extendGoes + ' (' + c.steps.join(',') + ')');
  });

  await leg('E7 synthesize before the counterevidence pass is refused; a budget stop names it as an unresolved branch', async function () {
    const room = newRoom();
    const plan = makeSrPlan();
    // drive until counterevidence, then synthesize early
    const grant = approve(room, plan);
    DEEP.initDeepState(room.roomDir, plan, grant, {});
    const replay = replayFor(srRoute);
    const env = { fetchEnvelopeFn: seam(replay) };
    const analyst = srAnalyst();
    for (let i = 0; i < 40; i += 1) {
      const n = DEEP.nextDeepStep(room.roomDir, plan.run_id);
      if (n.step === 'counterevidence') break;
      if (n.step === 'fetch_round') await DEEP.fetchRound(room.roomDir, plan.run_id, env);
      else if (n.step === 'dispatch_lanes') n.payload.lanes.forEach(function (p) { DEEP.recordLaneRows(room.roomDir, plan.run_id, p.lane, analyst(p, readRecords(room, p), n.round)); });
      else if (n.step === 'reflect') DEEP.proposeFollowups(room.roomDir, plan.run_id, []);
    }
    const early = DEEP.synthesize(room.roomDir, plan.run_id);

    const room2 = newRoom();
    const plan2 = makeSrPlan();
    const b = await drive(room2, plan2, { replay: replayFor(srRoute, { budgetUsd: 0.0025 }) });
    if (b.error) return 'budget error ' + JSON.stringify(b.error);
    const run = b.result.run;
    return early.ok === false && early.reason === 'counterevidence_not_run'
      && run.stop_reason === 'budget' && run.unresolved_branches.indexOf('counterevidence not run') !== -1
      && b.steps.indexOf('counterevidence') === -1
      || ('early ' + JSON.stringify(early) + ' stop ' + run.stop_reason + ' unresolved ' + JSON.stringify(run.unresolved_branches));
  });

  await leg('E8 each stop reason fires alone: cap, saturation, budget (usd and search cap), time, plurality_required', async function () {
    const seen = {};
    // cap: the happy run
    seen.cap = happy && happy.result ? happy.result.run.stop_reason : 'none';

    // saturation: every query returns the same records and the analyst files nothing
    const r1 = newRoom();
    const p1 = makeSrPlan();
    const s1 = await drive(r1, p1, { replay: replayFor(function () { return 'derivation_hit'; }), analyst: function () { return []; } });
    if (s1.error) return 'saturation error ' + JSON.stringify(s1.error);
    seen.saturation = s1.result.run.stop_reason;

    // budget by usd
    const r2 = newRoom();
    const p2 = makeSrPlan();
    const s2 = await drive(r2, p2, { replay: replayFor(srRoute, { budgetUsd: 0.0025 }) });
    if (s2.error) return 'budget usd error ' + JSON.stringify(s2.error);
    seen.budget_usd = s2.result.run.stop_reason;
    const usdCalls = s2.replay.calls.length;

    // budget by search cap
    const r3 = newRoom();
    const p3 = makeSrPlan({ max_searches: 3 });
    const s3 = await drive(r3, p3, {});
    if (s3.error) return 'budget cap error ' + JSON.stringify(s3.error);
    seen.budget_cap = s3.result.run.stop_reason;
    const capCalls = s3.replay.calls.length;

    // time
    const r4 = newRoom();
    const p4 = makeSrPlan();
    const s4 = await drive(r4, p4, { init: { now: Date.now() - 100000, budgetMs: 1000 } });
    if (s4.error) return 'time error ' + JSON.stringify(s4.error);
    seen.time = s4.result.run.stop_reason;

    // plurality_required: whitespace deep run whose synonym cover failed
    const r5 = newRoom();
    const p5 = makeWsDeepPlan();
    const route5 = function (q) {
      const s = String(q || '');
      if (s.indexOf(' AND (') !== -1) return 'gap_primary_zero';
      if (s.indexOf(' OR ') !== -1) return SENTINELS.SENTINEL_500;
      return 'prior_review_two';
    };
    const s5 = await drive(r5, p5, {
      replay: replayFor(route5),
      analyst: function (p, records) {
        return records.length > 0 ? [rowOf('prior_review_two', 0, 'L1', 'supports')] : [];
      },
    });
    if (s5.error) return 'plurality error ' + JSON.stringify(s5.error);
    seen.plurality = s5.result.run.stop_reason;
    const gap = s5.result.run.leaves.filter(function (l) { return l.id === 'L1'; })[0];
    const gapOk = !!gap && gap.status !== 'supported';

    return seen.cap === 'cap' && seen.saturation === 'saturation' && seen.budget_usd === 'budget' && seen.budget_cap === 'budget'
      && seen.time === 'time' && seen.plurality === 'plurality_required' && gapOk
      && usdCalls < 16 && capCalls === 3
      || ('seen ' + JSON.stringify(seen) + ' gapOk ' + gapOk + ' usdCalls ' + usdCalls + ' capCalls ' + capCalls);
  });

  await leg('E9 synthesize: roll-up, governing status, unresolved branches by label, contradictions, opportunities, next constraint, next version', async function () {
    if (!happy || !happy.result) return 'no happy run';
    const run = happy.result.run;
    const statuses = {};
    run.leaves.forEach(function (l) { statuses[l.id] = l.status; });
    const cont = run.contradictions.filter(function (c) { return c.leaf_id === 'L3'; })[0];
    const attack = run.opportunity_candidates.filter(function (o) { return o.kind === 'constraint_attack'; }).map(function (o) { return o.limiter_id; });
    const labels = run.pyramid.key_line.filter(function (k) { return k.status === 'unresolved'; }).map(function (k) { return k.label; });
    return statuses.L3 === 'contested' && statuses.L9 !== undefined
      && run.pyramid.key_line.every(function (k) { return typeof k.status === 'string'; })
      && ['strengthened', 'weakened', 'split', 'unresolved'].indexOf(run.governing_status) !== -1
      && labels.length > 0 && labels.every(function (l) { return run.unresolved_branches.indexOf(l) !== -1; })
      && cont && cont.row_ids.length === 2
      && attack.indexOf('LM2') !== -1 && attack.indexOf('LM1') === -1
      && run.next_binding_constraint === 'LM2'
      && run.next_version && run.next_version.version === 2 && run.next_version.parent_plan_hash === happyPlan.plan_hash
      && run.next_version.settled.length >= 2
      && run.rows.every(function (r) { return /^E-[A-Z0-9]+-\d+$/.test(r.row_id) && /^sha256:/.test(r.content_hash); })
      && new Set(run.rows.map(function (r) { return r.row_id; })).size === run.rows.length
      || ('L3 ' + statuses.L3 + ' gov ' + run.governing_status + ' attack ' + attack + ' next ' + run.next_binding_constraint + ' nv ' + JSON.stringify(run.next_version));
  });

  await leg('E10 state tamper: editing plan.json after init makes the next step refuse with plan_hash_mismatch', async function () {
    const room = newRoom();
    const plan = makeSrPlan();
    const grant = approve(room, plan);
    const init = DEEP.initDeepState(room.roomDir, plan, grant, {});
    if (!init.ok) return 'init ' + JSON.stringify(init);
    const file = path.join(runDir(room, plan.run_id), 'plan.json');
    const edited = JSON.parse(fs.readFileSync(file, 'utf8'));
    edited.pyramid.stated_question = 'A different question than the one approved.';
    fs.writeFileSync(file, JSON.stringify(edited, null, 2));
    const replay = replayFor(srRoute);
    const n = DEEP.nextDeepStep(room.roomDir, plan.run_id);
    const fr = await DEEP.fetchRound(room.roomDir, plan.run_id, { fetchEnvelopeFn: seam(replay) });
    return n.ok === false && n.reason === 'plan_hash_mismatch'
      && fr.ok === false && fr.reason === 'plan_hash_mismatch' && replay.calls.length === 0
      || ('n ' + JSON.stringify(n) + ' fr ' + JSON.stringify(fr));
  });

  await leg('E11 a paraphrased quote drops the row; a lane with no kept rows is searched-not-found, never support', async function () {
    const room = newRoom();
    const plan = makeSrPlan();
    const d = await drive(room, plan, { analyst: srAnalyst({ paraphrase: true }) });
    if (d.error) return 'error ' + JSON.stringify(d.error);
    const run = d.result.run;
    const rec4 = (d.recorded || []).filter(function (r) { return r.lane === 'LM4' && r.round === 1; })[0];
    const lane4 = (run.lanes || []).filter(function (l) { return l.lane === 'LM4' && l.round === 1; })[0];
    const l11 = run.leaves.filter(function (l) { return l.id === 'L11'; })[0];
    return !!rec4 && rec4.kept === 0 && rec4.dropped.unverified_quote === 1 && rec4.searched_not_found === true
      && !!lane4 && lane4.searched_not_found === true
      && l11.status !== 'supported'
      && run.rows.every(function (r) { return r.leaf_id !== 'L11'; })
      || ('rec4 ' + JSON.stringify(rec4) + ' lane4 ' + JSON.stringify(lane4) + ' l11 ' + l11.status);
  });

  await leg('E12 extendCard is F.3 with at most 3 options and shows the remaining cap as a labeled cap', async function () {
    const room = newRoom();
    const plan = makeSrPlan();
    const init = DEEP.initDeepState(room.roomDir, plan, approve(room, plan), {});
    const q = families.composeFamily('concept-evidence/v1', { term: 'solid state battery pack energy' }, { templateIds: ['ce.counter'], round: 2 }).queries;
    const card = DEEP.extendCard(init.state, q);
    const text = JSON.stringify(card);
    return card.shape === 'F.3' && card.options.length >= 2 && card.options.length <= 3
      && /remaining cap/i.test(card.body_md) && card.body_md.indexOf(q[0].q) !== -1
      && !hasDash(text) && !/quick pass|deep dive/i.test(text)
      || ('card ' + text.slice(0, 200));
  });

  await leg('E13 Part 8: the planted marker is in no audit record, URL or run file; the lane payload holds only ids, path, leaf question and falsifier', async function () {
    if (!happy || !happy.result) return 'no happy run';
    const files = walk(path.join(happyRoom.roomDir, '.mindrian'), []);
    let markerHits = 0;
    files.forEach(function (f) {
      if (/room\.db/.test(path.basename(f))) return;
      let text = '';
      try { text = fs.readFileSync(f, 'utf8'); } catch (_e) { return; }
      if (text.indexOf(happyRoom.marker) !== -1) markerHits += 1;
    });
    const urls = happy.replay.calls.map(function (c) { return c.url + ' ' + c.q; }).join('\n');
    const state = DEEP.loadState(happyRoom.roomDir, happyPlan.run_id).state;
    const payload = DEEP.lanePayload(state, 'LM2');
    const keys = Object.keys(payload).sort().join(',');
    const leafKeys = payload.leaves.map(function (l) { return Object.keys(l).sort().join(','); });
    const dashFree = files.every(function (f) {
      if (/room\.db/.test(path.basename(f))) return true;
      try { return !hasDash(fs.readFileSync(f, 'utf8')); } catch (_e) { return true; }
    });
    return markerHits === 0 && urls.indexOf(happyRoom.marker) === -1
      && JSON.stringify(payload).indexOf(happyRoom.marker) === -1
      && keys === 'lane,leaves,records_path,round,run_id'
      && leafKeys.every(function (k) { return k === 'falsifier,leaf_id,question'; })
      && happy.replay.violations.length === 0 && dashFree
      || ('markerHits ' + markerHits + ' keys ' + keys + ' dashFree ' + dashFree);
  });

  // E14 (363-20): a whitespace plan built in a researcher room carries the
  // scientific-roadmapping engine but has no limiters; it must still get lens
  // lanes, not "no_lanes". Found by the 363-20 acceptance run (quick thin,
  // escalate, revise no_search_terms).
  await leg('E14 a whitespace plan on the scientific-roadmapping engine with no limiters still gets lens lanes and runs to synthesis', async function () {
    const room = newRoom();
    const plan = makeWsDeepPlan();
    plan.perspective.engine = 'scientific-roadmapping';
    plan.plan_hash = planMod.planHash(plan);
    if (planMod.validatePlan(plan).ok !== true) return 'plan invalid ' + JSON.stringify(planMod.validatePlan(plan).errors);
    const lanes = DEEP.roundOneQueries(plan);
    if (lanes.length === 0) return 'no round-one lanes for a limiter-less scientific plan';
    if (!lanes.every(function (l) { return l.queries.length > 0; })) return 'a lane has no queries';
    const out = await drive(room, plan, { analyst: function () { return []; } });
    if (out.error) return 'drive ' + JSON.stringify(out.error);
    if (!out.result || out.result.ok !== true) return 'synthesis ' + JSON.stringify(out.result);
    if (out.result.run.mode !== 'deep' || auditFor(room, plan.run_id).length === 0) return 'no searches ran';
    return true;
  });

  check('net guard: zero network attempts', guard.attempts() === 0);
  check('global fetch restored to the net guard', globalThis.fetch === NET_GUARD_FETCH);
  return summary();
}

main().then(function (code) {
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ok */ } });
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ok */ }
  process.exit(code);
}, function (e) {
  console.log('FAIL: unhandled ' + ((e && e.stack) || e));
  process.exit(1);
});
