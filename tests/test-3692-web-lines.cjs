#!/usr/bin/env node
'use strict';

// Phase 369.2 Plan 02 - web fetch layers carry no fence (ruling 2026-10-05, R01).
//
// W0  prints the A4 value read (MOS_369_2_A4, default keep)
// W1  the REAL fetchCorpusEnvelope sends a fenced-city query unchanged: 1 replay call
// W2  person-with-degree, venture name, money figure, email: 1 call each, q unchanged
// W3  buildAcademicQuery carries the encoded string
// W4  buildIndustryQuery and buildPatentsQuery accept a venture name plus a city
// W5  brain-cypher (Canon Part 8, the Brain line) still refuses with zero calls
// W6  A4: credential strings refused before dispatch (keep) or sent (drop)
// W7  the analogies online composer keeps a money-figure keyword
//
// Plan 05 (planner half, same ruling):
// W8  composeFamily: web destination stamps audit not_applicable and keeps the phrase;
//     destination theo keeps the strict audit (egress_violation, no echo)
// W9  grants.validateExecutedQuery accepts audit not_applicable, refuses tripped
// W10 the egress policy has six non-web lines; a research override is unknown
// W11 appendAudit records a web provider with no policy gate; theo-side lines and keys still gate
// W12 quick run through the REAL corpus: the fenced-city string is sent and recorded
// W13 deep fetch round through the REAL corpus: a limiter slot naming a city is sent
// W14 --offline sends nothing (quick plan_only reason offline, deep refuses offline)
//
// Never stubs the corpus: the seam is realFetchEnvelope / withReplay from
// tests/helpers/real-corpus-3692.cjs, which runs the real fetchCorpusEnvelope
// through the OpenAlex replay at globalThis.fetch.
//
// Hygiene: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at mkdtemp dirs BEFORE
// any repo module loads; vendor keys are deleted; a net guard counts any fetch
// that escapes the replay.
//
// exit 0 -> PASSED, exit 1 -> FAILED
// House rule: hyphens only, no em or en dashes.

const A4 = process.env.MOS_369_2_A4 === 'drop' ? 'drop' : 'keep';

const real = require('./helpers/real-corpus-3692.cjs');
const realFetchEnvelope = real.realFetchEnvelope;
const hermetic = real.hermeticEnv();
['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL'].forEach(function (k) {
  process.env[k] = hermetic[k];
});
real.VENDOR_KEYS.forEach(function (k) { delete process.env[k]; });

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3692-web-lines');

const corpus = require('../lib/core/research-corpus.cjs');
const academic = require('../lib/core/rs-fetcher-academic.cjs');
const industry = require('../lib/core/rs-fetcher-industry.cjs');
const patents = require('../lib/core/rs-fetcher-patents.cjs');
const { composePatternQueries } = require('../lib/core/semantic-index/online-pattern-query.cjs');
const { ExternalEgressViolation } = require('../lib/core/rs-egress-violations.cjs');

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const families = require(path.join(RP, 'families.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const planMod = require(path.join(RP, 'plan.cjs'));
const pyramid = require(path.join(RP, 'pyramid.cjs'));
const perspective = require(path.join(RP, 'perspective.cjs'));
const auditLedger = require(path.join(RP, 'audit-ledger.cjs'));
const egressPolicy = require(path.join(RP, 'egress-policy.cjs'));
const quickMod = require(path.join(RP, 'quick.cjs'));
const deepMod = require(path.join(RP, 'deep.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');

const PHRASE = 'Nimbus Robotics cold lockers in Haifa';
const LIMITER_PHRASE = 'cable entanglement near Haifa';
const VIA = { surface: 'cli', decision_node_id: 'd-3692-05-test' };
const QS_WS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
const QS_SR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const B = planMod.BUDGETS;
const rooms = [];

function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function anyRoute() { return 'synonym_hits'; }

// quick plan from the whitespace question set; term is the L1 and L2 slot (room phrase allowed)
function makeQuickPlan(term) {
  const qs = clone(QS_WS);
  qs.leaves[0].slots = { term: term };
  qs.leaves[1].slots = { term: term, synonyms: ['ultrasonic biofilm removal'] };
  const bp = pyramid.buildPyramid(qs, {});
  if (!bp.ok) throw new Error('pyramid failed: ' + JSON.stringify(bp.errors));
  const pp = perspective.buildPerspective(qs.perspective, { mode: 'quick', depth: 'lite' });
  const leaves = bp.leaves;
  function compose(slots, ids) {
    const c = families.composeFamily('whitespace-gap/v1', slots, { templateIds: ids, round: 1 });
    if (!c.ok) throw new Error('compose failed: ' + JSON.stringify(c));
    return c.queries;
  }
  leaves[0].queries = compose({ term: term }, ['ws.exact']);
  leaves[1].queries = compose({ term: term, synonyms: ['ultrasonic biofilm removal'] }, ['ws.synonym_cover', 'ws.prior_attempts']);
  const plan = {
    schema: planMod.PLAN_SCHEMA,
    run_id: planMod.newRunId(new Date('2026-10-05T10:00:00Z')),
    mode: 'quick', version: 1, max_revisions: 3, revision: 0, status: 'ready', parent_plan_hash: null,
    origin: { template_id: 'whitespace', command: '/mos:whitespace' },
    context: { rung: 'unknown', scientific: { scientific: false, signals: [] } },
    structure: { source: 'local_template', tree_type: bp.pyramid.tree_type },
    perspective: pp.perspective, pyramid: bp.pyramid, leaves: leaves,
    budget: { breadth: 1, rounds: 1, queries_per_round: 3, results_per_query: 5, max_searches: 3, time_budget_ms: 60000, counterevidence: false },
    stop_rules: ['cap', 'time', 'budget'], grant_ref: null, return_target: { section: 'market-analysis' }, plan_hash: null,
  };
  plan.plan_hash = planMod.planHash(plan);
  return plan;
}

function approveRun(room, plan) {
  const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}

function attachRoundOne(plan) {
  deepMod.roundOneQueries(plan).forEach(function (lane) {
    const leaf = plan.leaves.filter(function (l) { return l.id === lane.leaf_ids[0]; })[0];
    leaf.queries = leaf.queries.concat(lane.queries);
  });
  plan.plan_hash = planMod.planHash(plan);
  return plan;
}

// deep scientific-roadmapping plan; L9 (limiter LM2) carries the given limiter slot
function makeDeepPlan(limiter) {
  const qs = clone(QS_SR);
  qs.leaves.filter(function (l) { return l.id === 'L9'; })[0].slots = { limiter: limiter };
  const bp = pyramid.buildPyramid(qs, {});
  if (!bp.ok) throw new Error('pyramid failed: ' + JSON.stringify(bp.errors));
  const pp = perspective.buildPerspective(qs.perspective, { mode: 'deep', depth: 'full', template: 'scientific-roadmapping' });
  const plan = {
    schema: planMod.PLAN_SCHEMA,
    run_id: planMod.newRunId(new Date('2026-10-05T10:00:00Z')),
    mode: 'deep', version: 1, max_revisions: 3, revision: 0, status: 'ready', parent_plan_hash: null,
    origin: { template_id: 'scientific-roadmapping', command: '/mos:research' },
    context: { rung: 'unknown', scientific: { scientific: true, signals: ['S5:navigator_toggle'] } },
    structure: { source: 'local_template', tree_type: bp.pyramid.tree_type },
    perspective: pp.perspective, pyramid: bp.pyramid, leaves: bp.leaves,
    budget: {
      breadth: B.DEEP_LANES_REQUESTED, rounds: B.DEEP_ROUNDS, queries_per_round: B.DEEP_R1_QUERIES_PER_LANE,
      results_per_query: B.DEEP_RESULTS_PER_QUERY, max_searches: B.DEEP_MAX_SEARCHES,
      time_budget_ms: B.DEEP_TIME_BUDGET_MS, counterevidence: true,
    },
    stop_rules: ['cap', 'saturation', 'budget', 'time'], grant_ref: null, return_target: { section: 'market-analysis' }, plan_hash: null,
  };
  const v = planMod.validatePlan(plan);
  if (!v.ok) throw new Error('deep plan invalid: ' + JSON.stringify(v.errors));
  return attachRoundOne(plan);
}

// a closed 23-key audit record for the ledger legs
function auditRecord(over) {
  return Object.assign({
    ts: '2026-10-05T10:00:00.000Z', run_id: 'r-3692-05', grant_id: 'g-3692-05', grant_version: 1,
    q: '"cold lockers"', q_hash: 'sha256:abc', template_id: 'ws.exact', family: 'whitespace-gap/v1',
    part8_verdict: 'not_applicable', provider: 'openalex', filters: {}, pagination: { per_page: 5, page: 1 },
    fallback_used: false, origin_ref: 'r-3692-05/L1', result_ids: [], content_hashes: [],
    outcome: 'empty_valid', failure_class: null, count: 0, cost_usd: 0, remaining_usd: null, x_query: null, latency_ms: 1,
  }, over || {});
}

function mkRoomDir() { return fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mos3692-pol-')); }

async function leg(name, fn) {
  try {
    const r = await fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.message) || String(e));
  }
}

const TEST_KEY = 'test-key-3692-abcdefgh';

function runEnvelope(args) {
  return real.withReplay(function () { return 'gap_primary_zero'; }, function () {
    return corpus.fetchCorpusEnvelope(args);
  });
}

function describeOutcome(out) {
  return (out.error ? (out.error.name || 'Error') + ': ' + out.error.message : 'resolved')
    + ' calls=' + out.calls.length;
}

function oneCallUnchanged(out, query) {
  return !out.error && out.calls.length === 1 && out.calls[0].q === query;
}

async function main() {
  // ---- W0 ----
  console.log('MOS_369_2_A4=' + A4);
  check('W0 A4 value read (' + A4 + ')', A4 === 'keep' || A4 === 'drop');

  // ---- W1 ----
  {
    const q = '"wireless sensing in Tel Aviv"';
    const out = await runEnvelope({ source: 'openalex', query: q, limit: 3 });
    check('W1 fetchCorpusEnvelope sends a fenced-city query unchanged (1 call, q byte-identical)',
      oneCallUnchanged(out, q), describeOutcome(out)
        + ' q=' + JSON.stringify(out.calls[0] && out.calls[0].q));
  }

  // ---- W2 ----
  {
    const queries = [
      '"cold storage study by Orla Venn PhD"',
      '"Nimbus Robotics cold lockers"',
      '"a $5M market for cold lockers"',
      '"contact jane.roe@example.com about biofilm"',
    ];
    const bad = [];
    for (const q of queries) {
      const out = await runEnvelope({ source: 'openalex', query: q, limit: 3 });
      if (!oneCallUnchanged(out, q)) bad.push(q + ' -> ' + describeOutcome(out));
    }
    check('W2 person, venture, money figure and email leave unchanged (1 call each)',
      bad.length === 0, bad.join(' | '));
  }

  // ---- W3 ----
  {
    const q = '"wireless sensing in Haifa"';
    let built = null;
    let err = null;
    try { built = academic.buildAcademicQuery(q, 'openalex'); } catch (e) { err = e; }
    check('W3 buildAcademicQuery carries the encoded string',
      !err && built && built.skip === false && built.url.indexOf(encodeURIComponent(q)) !== -1,
      err ? err.name + ': ' + err.message : 'url=' + (built && built.url));
  }

  // ---- W4 ----
  {
    const q = '"Nimbus Robotics" cold lockers Haifa';
    process.env.TAVILY_API_KEY = 'tavily-test-3692-abcdef';
    let ind = null;
    let indErr = null;
    try { ind = industry.buildIndustryQuery(q); } catch (e) { indErr = e; } finally { delete process.env.TAVILY_API_KEY; }
    check('W4a buildIndustryQuery accepts a venture name plus a city (refined sub-queries carry it)',
      !indErr && ind && ind.skip === false && ind.refined_subqueries.every(function (s) { return s.indexOf(q) !== -1; }),
      indErr ? indErr.name + ': ' + indErr.message : 'skip=' + (ind && ind.skip));
    let pat = null;
    let patErr = null;
    try { pat = patents.buildPatentsQuery(q, 'google_patents'); } catch (e) { patErr = e; }
    check('W4b buildPatentsQuery accepts a venture name plus a city',
      !patErr && pat && pat.skip === false && pat.url.indexOf(encodeURIComponent(q)) !== -1,
      patErr ? patErr.name + ': ' + patErr.message : 'skip=' + (pat && pat.skip));
  }

  // ---- W5 ----
  {
    const q = 'MATCH (n) WHERE n.city = "Haifa" RETURN n';
    const out = await runEnvelope({ source: 'brain-cypher', query: q });
    check('W5 brain-cypher still refuses a CONTENT-SET string with zero calls (Canon Part 8)',
      out.error instanceof ExternalEgressViolation && out.calls.length === 0, describeOutcome(out));
  }

  // ---- W6 ----
  {
    const prior = process.env.OPENALEX_API_KEY;
    process.env.OPENALEX_API_KEY = TEST_KEY;
    const queries = [
      '"cold lockers" api_key=abc123',
      '"cold lockers" Bearer abcdefghijklmnopqrstu',
      '"cold lockers" ' + TEST_KEY,
    ];
    const bad = [];
    try {
      for (const q of queries) {
        const out = await runEnvelope({ source: 'openalex', query: q, limit: 3 });
        if (A4 === 'keep') {
          const credential = out.error instanceof ExternalEgressViolation
            && out.error.meta && out.error.meta.matched_pattern === 'credential'
            && out.error.meta.sample === '';
          if (!(credential && out.calls.length === 0)) bad.push('keep: ' + describeOutcome(out));
        } else if (!oneCallUnchanged(out, q)) {
          bad.push('drop: ' + describeOutcome(out));
        }
      }
    } finally {
      if (prior === undefined) delete process.env.OPENALEX_API_KEY; else process.env.OPENALEX_API_KEY = prior;
    }
    check('W6 A4=' + A4 + (A4 === 'keep'
      ? ' credential strings refused (matched credential, empty sample) with zero calls'
      : ' credential strings sent like any other string (1 call, q unchanged)'),
      bad.length === 0, bad.join(' | '));
  }

  // ---- W7 ----
  {
    const res = composePatternQueries({
      functionalKeywords: ['raises $3.5M', 'background subtraction'],
      trizPrinciples: ['Separation'],
      abstractFunction: 'recover a rare signal',
    });
    check('W7 composePatternQueries keeps a money-figure keyword (ok true, a query carries 3.5M)',
      res.ok === true && Array.isArray(res.queries) && res.queries.some(function (c) { return c.q.indexOf('3.5M') !== -1; }),
      JSON.stringify(res).slice(0, 160));
  }


  // ---- W8 ----
  await leg('W8 composeFamily: web stamps audit not_applicable and keeps the phrase; theo destination keeps the strict audit with no echo', async function () {
    const web = families.composeFamily('concept-evidence/v1', { term: PHRASE }, {});
    const webOk = web.ok === true && web.queries.length > 0
      && web.queries.every(function (x) { return x.audit === 'not_applicable' && x.q.indexOf(PHRASE) !== -1; });
    const theo = families.composeFamily('concept-evidence/v1', { term: PHRASE }, { destination: 'theo' });
    const refused = JSON.stringify(theo);
    const theoOk = theo.ok === false && theo.reason === 'egress_violation' && refused.indexOf('Haifa') === -1 && refused.indexOf('Nimbus') === -1;
    return (webOk && theoOk) || ('web=' + JSON.stringify(web).slice(0, 140) + ' theo=' + refused.slice(0, 140));
  });

  // ---- W9 ----
  await leg('W9 validateExecutedQuery: audit not_applicable ok under a covering run grant, tripped refused audit_tripped', async function () {
    const room = newRoom();
    const plan = makeQuickPlan('acoustic biofilm disruption');
    const grant = approveRun(room, plan);
    const q = plan.leaves[0].queries[0];
    const base = { q: q.q, q_hash: q.q_hash, template_id: q.template_id, family: q.family, provider: 'openalex', slot_terms: q.slot_terms || [], round: 1, trigger: 'navigator' };
    const state = { room_id: grants.roomIdFor(room.roomDir), now: Date.now(), searches_used: 0, round: 1, runs_in_window: 0 };
    const okV = grants.validateExecutedQuery(Object.assign({}, base, { audit: 'not_applicable' }), grant, state);
    const badV = grants.validateExecutedQuery(Object.assign({}, base, { audit: 'tripped' }), grant, state);
    return (okV.ok === true && badV.ok === false && badV.reason === 'audit_tripped') || (JSON.stringify(okV) + ' ' + JSON.stringify(badV));
  });

  // ---- W10 ----
  await leg('W10 egress policy: six non-web lines; a research override is ignored as override_unknown_line:research', async function () {
    const dir = mkRoomDir();
    const names = Object.keys(egressPolicy.loadEgressPolicy(dir).lines).sort().join(',');
    fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.mindrian', 'egress-policy.json'), JSON.stringify({ lines: { research: false } }));
    const pol = egressPolicy.loadEgressPolicy(dir);
    const ignoredOk = pol.ignored.indexOf('override_unknown_line:research') !== -1;
    return (names === 'citation_check,entity_extraction,judge_jev,prose,theo,vector_model_download' && ignoredOk)
      || ('lines=' + names + ' ignored=' + JSON.stringify(pol.ignored));
  });

  // ---- W11 ----
  await leg('W11 appendAudit: openalex not_applicable written with no policy read; typesafe with judge_jev off refused; key-shaped q refused', async function () {
    const dir = mkRoomDir();
    const web = auditLedger.appendAudit(dir, auditRecord({}), { policy: { lines: {} } });
    const typesafe = auditLedger.appendAudit(dir, auditRecord({ provider: 'typesafe', part8_verdict: 'pass' }), {});
    const keyed = auditLedger.appendAudit(dir, auditRecord({ q: 'cold lockers api_key=x1' }), {});
    const written = auditLedger.readAudit(dir, {});
    return (web.ok === true && typesafe.ok === false && typesafe.reason === 'egress_line_off'
      && keyed.ok === false && keyed.reason === 'key_shaped_value'
      && written.length === 1 && written[0].part8_verdict === 'not_applicable')
      || (JSON.stringify([web, typesafe, keyed]) + ' written=' + written.length);
  });

  // ---- W12 ----
  await leg('W12 quick run through the REAL corpus sends the fenced-city string byte for byte and the ledger records it', async function () {
    const room = newRoom();
    const plan = makeQuickPlan(PHRASE);
    approveRun(room, plan);
    const env = realFetchEnvelope(anyRoute);
    const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: env, now: Date.now() });
    if (out.status !== 'done') return 'status ' + out.status + ' ' + out.reason;
    const sent = env.calls.filter(function (c) { return typeof c.q === 'string' && c.q.indexOf(PHRASE) !== -1; });
    const audit = auditLedger.readAudit(room.roomDir, { run_id: plan.run_id });
    const rec = audit.filter(function (a) { return a.q.indexOf(PHRASE) !== -1; });
    const unknown = audit.filter(function (a) { return a.failure_class === 'unknown_error'; });
    console.log('W12 measured: replay calls=' + env.calls.length + ' carrying phrase=' + sent.length
      + ' audit records=' + audit.length + ' with phrase=' + rec.length + ' unknown_error=' + unknown.length);
    return (sent.length >= 1 && rec.length >= 1 && rec.every(function (a) { return a.part8_verdict === 'not_applicable'; }) && unknown.length === 0)
      || ('sent=' + sent.length + ' rec=' + rec.length + ' unknown=' + unknown.length);
  });

  // ---- W13 ----
  await leg('W13 deep fetch round through the REAL corpus sends a limiter slot that names a city', async function () {
    const room = newRoom();
    const plan = makeDeepPlan(LIMITER_PHRASE);
    const grant = approveRun(room, plan);
    const init = deepMod.initDeepState(room.roomDir, plan, grant, {});
    if (!init.ok) return 'init ' + JSON.stringify(init);
    const env = realFetchEnvelope(anyRoute);
    const fr = await deepMod.fetchRound(room.roomDir, plan.run_id, { fetchEnvelopeFn: env });
    const sent = env.calls.filter(function (c) { return typeof c.q === 'string' && c.q.indexOf(LIMITER_PHRASE) !== -1; });
    const audit = auditLedger.readAudit(room.roomDir, { run_id: plan.run_id });
    const unknown = audit.filter(function (a) { return a.failure_class === 'unknown_error'; });
    console.log('W13 measured: replay calls=' + env.calls.length + ' carrying phrase=' + sent.length
      + ' audit records=' + audit.length + ' unknown_error=' + unknown.length);
    return (fr.ok === true && sent.length >= 1 && unknown.length === 0)
      || ('fetchRound=' + JSON.stringify(fr).slice(0, 160) + ' sent=' + sent.length + ' unknown=' + unknown.length);
  });

  // ---- W14 ----
  await leg('W14 offline sends nothing: quick plan_only reason offline, deep refuses offline, zero calls, no audit line', async function () {
    const room = newRoom();
    const plan = makeQuickPlan('acoustic biofilm disruption');
    approveRun(room, plan);
    const env = realFetchEnvelope(anyRoute);
    const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: env, now: Date.now(), offline: true });
    const quickOk = out.status === 'plan_only' && out.reason === 'offline' && out.sent === false
      && env.calls.length === 0 && auditLedger.readAudit(room.roomDir, {}).length === 0;
    const room2 = newRoom();
    const dplan = makeDeepPlan('anode interface resistance');
    const grant = approveRun(room2, dplan);
    const init = deepMod.initDeepState(room2.roomDir, dplan, grant, {});
    if (!init.ok) return 'deep init ' + JSON.stringify(init);
    const env2 = realFetchEnvelope(anyRoute);
    const fr = await deepMod.fetchRound(room2.roomDir, dplan.run_id, { fetchEnvelopeFn: env2, offline: true });
    const deepOk = fr.ok === false && fr.reason === 'offline' && env2.calls.length === 0
      && auditLedger.readAudit(room2.roomDir, {}).length === 0;
    return (quickOk && deepOk) || ('quick=' + out.status + '/' + out.reason + ' calls=' + env.calls.length + ' deep=' + JSON.stringify(fr).slice(0, 100) + ' calls=' + env2.calls.length);
  });

  check('W-net no fetch escaped the replay (net guard attempts 0)', NET.attempts() === 0, 'attempts=' + NET.attempts());
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* best effort */ } });
  process.exit(summary());
}

main().catch(function (e) {
  console.log('FAIL: harness crashed (' + (e && e.stack ? e.stack : e) + ')');
  process.exit(1);
});
