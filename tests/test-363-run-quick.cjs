'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 12 -- the quick research run (lib/core/research-planner/
 * verdict.cjs and quick.cjs). Legs Q1-Q15, all offline on OpenAlex replay.
 *
 * The replay fetch is injected through runQuick's fetchEnvelopeFn seam and is
 * swapped in only for the duration of one corpus call; the net guard stays
 * installed everywhere else and its counter is the last check. Rooms come from
 * fixture-room-363. No em-dash or en-dash literals: those characters are
 * spelled with String.fromCharCode.
 *
 * Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-quick-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const NET_GUARD_FETCH = globalThis.fetch;
const { check, summary } = hygiene.makeChecker('363-12 quick research run');

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

let VERDICT = null;
let QUICK = null;
let loadError = null;
try {
  VERDICT = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'verdict.cjs'));
  QUICK = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'quick.cjs'));
} catch (e) {
  loadError = e;
}

const QS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
const SYN = 'ultrasonic biofilm removal';
const FAMILY = 'whitespace-gap/v1';

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  try { fs.rmSync(path.join(TMP_HOME, '.mindrian'), { recursive: true, force: true }); } catch (_e) { /* ok */ }
  return r;
}

function compose(slots, ids) {
  const c = families.composeFamily(FAMILY, slots, { templateIds: ids, round: 1 });
  if (!c.ok) throw new Error('compose failed: ' + JSON.stringify(c));
  return c.queries;
}

// Builds a quick plan from the whitespace question set: L1 (gap claim) owns
// the primary search, L2 (covered elsewhere) owns the synonym cover and the
// prior-attempts search, L3 is the room-only leaf.
function makePlan(opts) {
  const o = opts || {};
  const term = o.term || GAP_TERM_363;
  const qs = JSON.parse(JSON.stringify(QS));
  qs.leaves[0].slots = { term: term };
  qs.leaves[1].slots = { term: term, synonyms: [SYN] };
  if (o.limiter === true) {
    qs.perspective.limiters = [{ id: 'LM1', column: 'assumed', label: 'The gap term is a vocabulary gap', path_id: null, s_curve: 'unknown', question: 'Is the gap a vocabulary gap?', leaf_id: 'L1', raised_by: 'navigator' }];
  }
  const bp = pyramid.buildPyramid(qs, {});
  if (!bp.ok) throw new Error('pyramid failed: ' + JSON.stringify(bp.errors));
  const pp = perspective.buildPerspective(qs.perspective, { mode: 'quick', depth: 'lite' });
  const leaves = bp.leaves;
  const l1 = o.l1 || ['ws.exact'];
  const l2 = o.l2 || ['ws.synonym_cover', 'ws.prior_attempts'];
  leaves[0].queries = compose({ term: term }, l1);
  leaves[1].queries = compose({ term: term, synonyms: [SYN] }, l2);
  const plan = {
    schema: planMod.PLAN_SCHEMA,
    run_id: planMod.newRunId(new Date('2026-09-29T10:00:00Z')),
    mode: 'quick',
    version: 1,
    max_revisions: 3,
    revision: 0,
    status: 'ready',
    parent_plan_hash: null,
    origin: { template_id: 'whitespace', command: '/mos:whitespace' },
    context: { rung: 'unknown', scientific: { scientific: false, signals: [] } },
    structure: { source: 'local_template', tree_type: bp.pyramid.tree_type },
    perspective: pp.perspective,
    pyramid: bp.pyramid,
    leaves: leaves,
    budget: { breadth: 1, rounds: 1, queries_per_round: 3, results_per_query: 5, max_searches: 3, time_budget_ms: 60000, counterevidence: false },
    stop_rules: ['cap', 'time', 'budget'],
    grant_ref: null,
    return_target: { section: 'market-analysis' },
    plan_hash: null,
  };
  plan.plan_hash = planMod.planHash(plan);
  return plan;
}

function standingGrant(room, terms) {
  const list = terms || [{ term: GAP_TERM_363, synonyms: [SYN] }];
  const proposal = grants.buildStandingProposal(room.roomDir, { terms: list });
  const w = grants.writeGrant(room.roomDir, proposal, { approved_via: { surface: 'cli', decision_node_id: 'd-363-12-test' } });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}

// Route by search shape: primary, synonym cover (OR), prior attempts (AND).
function routeBy(map) {
  return function (q) {
    const s = String(q || '');
    if (s.indexOf(' OR ') !== -1) return map.cover;
    if (s.indexOf(' AND (') !== -1) return map.prior;
    return map.primary;
  };
}

function seam(replay, opts) {
  const o = opts || {};
  return async function (args) {
    if (o.delayMs) await new Promise(function (r) { setTimeout(r, o.delayMs); });
    const prev = globalThis.fetch;
    globalThis.fetch = replay;
    try {
      return await corpus.fetchCorpusEnvelope(args);
    } finally {
      globalThis.fetch = prev;
    }
  };
}

function replayFor(map, extraBodies) {
  const bodies = Object.assign({}, BODIES, extraBodies || {});
  return makeReplayFetch({ route: routeBy(map), bodies: bodies });
}

const ZERO = { primary: 'gap_primary_zero', cover: 'gap_primary_zero', prior: 'gap_primary_zero' };

async function run(room, plan, replay, extra) {
  const opts = Object.assign({ fetchEnvelopeFn: seam(replay), now: Date.parse('2026-09-29T10:00:00Z') }, extra || {});
  return QUICK.runQuick(room.roomDir, plan, opts);
}

function auditFor(room, runId) { return auditLedger.readAudit(room.roomDir, { run_id: runId }); }

function rowFrom(bodyKey, idx, leafId, label, quoteOf) {
  const rec = BODIES[bodyKey].results[idx];
  return { leaf_id: leafId, record_id: rec.id, claim: 'Model claim for ' + leafId, quote: quoteOf || rec.title, label: label };
}

function hasDash(text) { return text.indexOf(EM) !== -1 || text.indexOf(EN) !== -1; }

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  entries.forEach(function (e) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else out.push(abs);
  });
  return out;
}

async function leg(name, fn) {
  try {
    const r = await fn();
    if (r === undefined) return;
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.message) || String(e));
  }
}

async function main() {
  check('modules load (verdict.cjs, quick.cjs)', loadError === null && !!VERDICT && !!QUICK, loadError ? loadError.message : '');
  if (loadError) {
    // RED: name every leg as failing so the count is visible.
    ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15'].forEach(function (q) {
      check(q + ' quick run leg', false, 'modules missing');
    });
    check('net guard: zero network attempts', guard.attempts() === 0);
    return summary();
  }

  // Q1 gap confirmed
  await leg('Q1 gap confirmed: three audit records, literature_gap candidate, no escalation', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor(ZERO);
    const out = await run(room, plan, replay);
    if (out.status !== 'done') return 'status ' + out.status + ' ' + out.reason;
    const r = out.run;
    const audit = auditFor(room, plan.run_id);
    const v = planMod.validateRunResult(r);
    return r.verdict === 'gap-confirmed'
      && r.verdict_detail && r.verdict_detail.plurality_ran === true
      && audit.length === 3
      && audit.every(function (a) { return a.outcome === 'empty_valid' && a.count === 0; })
      && r.opportunity_candidates.length === 1 && r.opportunity_candidates[0].kind === 'literature_gap'
      && r.escalation_offer === null
      && r.filed === false && r.mode === 'quick'
      && v.ok === true
      && replay.calls.length === 3
      || ('verdict ' + r.verdict + ' audit ' + audit.length + ' calls ' + replay.calls.length + ' valid ' + JSON.stringify(v.errors));
  });

  // Q2 covered elsewhere
  await leg('Q2 covered elsewhere: deterministic synonym row supports ws:covered_elsewhere, settled', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor({ primary: 'gap_primary_zero', cover: 'synonym_hits', prior: 'gap_primary_zero' });
    const out = await run(room, plan, replay);
    if (out.status !== 'done') return 'status ' + out.status + ' ' + out.reason;
    const r = out.run;
    const sup = r.rows.filter(function (x) { return x.leaf_id === 'L2' && x.label === 'supports'; });
    const audit = auditFor(room, plan.run_id);
    const cover = audit.filter(function (a) { return a.template_id === 'ws.synonym_cover'; })[0];
    return r.verdict === 'settled' && sup.length >= 1 && cover && cover.count === 240 && cover.outcome === 'ok'
      && r.escalation_offer === null
      && sup.every(function (x) { return /^E-[A-Z]+-\d+$/.test(x.row_id) && /^sha256:/.test(x.content_hash); })
      || ('verdict ' + r.verdict + ' sup ' + sup.length);
  });

  // Q3 contested. quick-whitespace-bottleneck: a plan that names no limiter asks for the bottleneck
  // first, so the offer is never a dead end (navigator ruling 2026-10-01).
  await leg('Q3 contested with no named limiter: exactly one offer, and it asks what blocks the gap', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor({ primary: 'contested_rows', cover: 'gap_primary_zero', prior: 'gap_primary_zero' });
    const out = await run(room, plan, replay, {
      rowsProvider: async function () {
        return [
          rowFrom('contested_rows', 0, 'L1', 'supports'),
          rowFrom('contested_rows', 3, 'L1', 'contradicts'),
        ];
      },
    });
    if (out.status !== 'done') return 'status ' + out.status + ' ' + out.reason;
    const r = out.run;
    const lines = out.card.body_md.split('\n').filter(function (l) { return /name what blocks this and I'll plan a deep run/i.test(l); });
    const ids = out.card.options.map(function (o) { return o.id; });
    return r.verdict === 'contested'
      && r.escalation_offer && r.escalation_offer.text === "name what blocks this and I'll plan a deep run"
      && r.escalation_offer.kind === 'needs_limiter'
      && lines.length === 1
      && ids.indexOf('name_limiter') !== -1 && ids.indexOf('run_deep') === -1
      && r.contradictions.length === 1
      || ('verdict ' + r.verdict + ' offer ' + JSON.stringify(r.escalation_offer) + ' lines ' + lines.length);
  });

  // Q3b the same contested run on a plan that already names a limiter keeps the plain offer
  await leg('Q3b contested with a named limiter: exactly one deep offer, run deep on this?', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan({ limiter: true });
    const replay = replayFor({ primary: 'contested_rows', cover: 'gap_primary_zero', prior: 'gap_primary_zero' });
    const out = await run(room, plan, replay, {
      rowsProvider: async function () {
        return [
          rowFrom('contested_rows', 0, 'L1', 'supports'),
          rowFrom('contested_rows', 3, 'L1', 'contradicts'),
        ];
      },
    });
    if (out.status !== 'done') return 'status ' + out.status + ' ' + out.reason;
    const r = out.run;
    const lines = out.card.body_md.split('\n').filter(function (l) { return /run deep on this\?/i.test(l); });
    return r.verdict === 'contested'
      && r.escalation_offer && r.escalation_offer.text === 'run deep on this?'
      && lines.length === 1
      && r.contradictions.length === 1
      || ('verdict ' + r.verdict + ' offer ' + JSON.stringify(r.escalation_offer) + ' lines ' + lines.length);
  });

  // Q4 provider down
  await leg('Q4 budget 429: unresolved, never gap-confirmed, audit failed with failure_class', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor({ primary: SENTINELS.SENTINEL_429_BUDGET, cover: 'gap_primary_zero', prior: 'gap_primary_zero' });
    const out = await run(room, plan, replay);
    if (out.status !== 'done') return 'status ' + out.status + ' ' + out.reason;
    const r = out.run;
    const audit = auditFor(room, plan.run_id);
    const first = audit[0];
    return r.verdict === 'unresolved' && r.verdict !== 'gap-confirmed'
      && (r.stop_reason === 'budget' || r.stop_reason === 'reask')
      && first && (first.outcome === 'failed' || first.outcome === 'blocked')
      && typeof first.failure_class === 'string' && first.failure_class.length > 0
      || ('verdict ' + r.verdict + ' stop ' + r.stop_reason + ' audit ' + JSON.stringify(first));
  });

  // Q5 other failures
  await leg('Q5 500, timeout and network failures each give unresolved', async function () {
    const kinds = [SENTINELS.SENTINEL_500, SENTINELS.SENTINEL_TIMEOUT, SENTINELS.SENTINEL_NETWORK];
    for (let i = 0; i < kinds.length; i += 1) {
      const room = newRoom();
      standingGrant(room);
      const plan = makePlan();
      const replay = replayFor({ primary: kinds[i], cover: 'gap_primary_zero', prior: 'gap_primary_zero' });
      const out = await run(room, plan, replay);
      if (out.status !== 'done') return kinds[i] + ' status ' + out.status;
      if (out.run.verdict !== 'unresolved') return kinds[i] + ' verdict ' + out.run.verdict;
      const a = auditFor(room, plan.run_id)[0];
      if (!a || a.outcome !== 'failed' || !a.failure_class) return kinds[i] + ' audit ' + JSON.stringify(a);
    }
    return true;
  });

  // Q6 missing count
  await leg('Q6 a body with no meta.count gives unresolved', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor({ primary: 'no_count', cover: 'gap_primary_zero', prior: 'gap_primary_zero' }, {
      no_count: { meta: { db_response_time_ms: 3 }, results: [] },
    });
    const out = await run(room, plan, replay);
    if (out.status !== 'done') return 'status ' + out.status;
    return out.run.verdict === 'unresolved' || ('verdict ' + out.run.verdict);
  });

  // Q7 no grant
  await leg('Q7 no grant: reask no_grant, F.0 card, zero calls, no audit record', async function () {
    const room = newRoom();
    const plan = makePlan();
    const replay = replayFor(ZERO);
    const out = await run(room, plan, replay);
    const audit = auditLedger.readAudit(room.roomDir);
    return out.status === 'reask' && out.reason === 'no_grant'
      && out.card && out.card.shape === 'F.0'
      && replay.calls.length === 0 && audit.length === 0
      || ('status ' + out.status + ' reason ' + out.reason + ' calls ' + replay.calls.length + ' audit ' + audit.length);
  });

  // Q8 new term
  await leg('Q8 new term: reask new_term, zero calls, card lists the term', async function () {
    const room = newRoom();
    standingGrant(room, [{ term: 'unrelated approved term', synonyms: [] }]);
    const plan = makePlan();
    const replay = replayFor(ZERO);
    const out = await run(room, plan, replay);
    return out.status === 'reask' && out.reason === 'new_term'
      && replay.calls.length === 0
      && out.card && out.card.body_md.indexOf(GAP_TERM_363) !== -1
      && auditLedger.readAudit(room.roomDir).length === 0
      || ('status ' + out.status + ' reason ' + out.reason + ' calls ' + replay.calls.length);
  });

  // Q9 cache
  await leg('Q9 cache: second run makes zero calls, cache_hit audit records with the cached count', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const map = { primary: 'gap_primary_zero', cover: 'synonym_hits', prior: 'prior_review_two' };
    const first = replayFor(map);
    const a = await run(room, plan, first);
    if (a.status !== 'done') return 'first status ' + a.status;
    const second = replayFor(map);
    const b = await run(room, plan, second);
    if (b.status !== 'done') return 'second status ' + b.status;
    const audit = auditFor(room, plan.run_id);
    const late = audit.slice(3);
    return first.calls.length === 3 && second.calls.length === 0
      && audit.length === 6
      && late.length === 3 && late.every(function (x) { return x.outcome === 'cache_hit'; })
      && late.map(function (x) { return x.count; }).join(',') === audit.slice(0, 3).map(function (x) { return x.count; }).join(',')
      && b.run.queries.every(function (x) { return x.cache_hit === true; })
      && b.run.verdict === a.run.verdict
      || ('calls ' + first.calls.length + '/' + second.calls.length + ' audit ' + audit.length + ' late ' + JSON.stringify(late.map(function (x) { return [x.outcome, x.count]; })));
  });

  // Q10 caps
  await leg('Q10 caps: four queries refused before fetching; at most five records per query kept', async function () {
    const room = newRoom();
    standingGrant(room);
    const big = makePlan({ l1: ['ws.exact', 'ws.absence_reason'] });
    const replay = replayFor(ZERO);
    const out = await run(room, big, replay);
    const refused = (out.status === 'refused' || out.status === 'reask')
      && (out.reason === 'cap_exceeded' || /cap|plan/.test(String(out.reason)))
      && replay.calls.length === 0;
    if (!refused) return 'four queries: status ' + out.status + ' reason ' + out.reason + ' calls ' + replay.calls.length;

    const room2 = newRoom();
    standingGrant(room2);
    const plan = makePlan();
    const eight = [];
    for (let i = 0; i < 8; i += 1) {
      const src = BODIES.synonym_hits.results[i % 5];
      eight.push(Object.assign({}, src, { id: 'https://openalex.org/W93639' + String(i).padStart(2, '0') }));
    }
    const fake = async function () {
      return {
        status: 'ok',
        payload: { results: eight, meta: { count: 99, cost_usd: 0.001, remaining_usd: 0.09, limit_usd: 0.1, x_query: null } },
        meta: { count: 99, cost_usd: 0.001, remaining_usd: 0.09, limit_usd: 0.1, x_query: null },
      };
    };
    const out2 = await QUICK.runQuick(room2.roomDir, plan, { fetchEnvelopeFn: fake, now: Date.parse('2026-09-29T10:00:00Z') });
    if (out2.status !== 'done') return 'eight: status ' + out2.status + ' ' + out2.reason;
    const records = JSON.parse(fs.readFileSync(path.join(room2.roomDir, '.mindrian', 'research-runs', plan.run_id, 'records.json'), 'utf8'));
    const perQuery = {};
    (records.records || records).forEach(function (rec) { perQuery[rec.q_hash] = (perQuery[rec.q_hash] || 0) + 1; });
    const counts = Object.keys(perQuery).map(function (k) { return perQuery[k]; });
    return counts.length > 0 && counts.every(function (n) { return n <= 5; }) || ('per query ' + JSON.stringify(perQuery));
  });

  // Q11 local room check
  await leg('Q11 local room check: fs only, flags extraction_failure, never reads .mindrian', async function () {
    const room = newRoom();
    const noteDir = path.join(room.roomDir, 'market-analysis', 'acoustic-note');
    fs.mkdirSync(noteDir, { recursive: true });
    fs.writeFileSync(path.join(noteDir, 'acoustic-note.md'), '# Note\n\nWe looked at ' + GAP_TERM_363.toUpperCase() + ' last spring.\n', 'utf8');
    fs.mkdirSync(path.join(room.roomDir, '.mindrian', 'hidden'), { recursive: true });
    fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'hidden', 'x.md'), GAP_TERM_363, 'utf8');
    const before = guard.attempts();
    const direct = QUICK.localRoomCheck(room.roomDir, [GAP_TERM_363, SYN]);
    const noHit = QUICK.localRoomCheck(room.roomDir, ['zzz nothing matches this phrase']);
    const okDirect = direct.flagged === true && direct.artifact_count === 1
      && noHit.flagged === false && noHit.artifact_count === 0 && guard.attempts() === before;
    if (!okDirect) return 'direct ' + JSON.stringify(direct) + ' ' + JSON.stringify(noHit);

    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor(ZERO);
    const out = await run(room, plan, replay);
    if (out.status !== 'done') return 'status ' + out.status;
    const lc = out.run.local_checks.filter(function (c) { return c.leaf_id === 'L3'; })[0];
    const roomQueries = replay.calls.filter(function (c) { return /acoustic-note|last spring/i.test(String(c.q)); });
    return !!lc && lc.flagged === true && lc.kind === 'extraction_failure'
      && replay.calls.length === 3 && roomQueries.length === 0
      || ('local_checks ' + JSON.stringify(out.run.local_checks) + ' calls ' + replay.calls.length);
  });

  // Q12 escalate
  await leg('Q12 escalateToDeep: deep seed, same perspective and pyramid, valid, no side effects', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor({ primary: 'prior_review_two', cover: 'synonym_hits', prior: 'gap_primary_zero' });
    const out = await run(room, plan, replay, { rowsProvider: async function () { return []; } });
    if (out.status !== 'done') return 'status ' + out.status;
    if (out.run.verdict !== 'thin') return 'verdict ' + out.run.verdict;
    const auditBefore = auditLedger.readAudit(room.roomDir).length;
    const callsBefore = replay.calls.length + guard.attempts();
    const filesBefore = walk(room.roomDir, []).length;
    const deep = QUICK.escalateToDeep(plan, out.run);
    const v = planMod.validatePlan(deep);
    return deep.mode === 'deep'
      && JSON.stringify(deep.perspective) === JSON.stringify(plan.perspective)
      && JSON.stringify(deep.pyramid) === JSON.stringify(plan.pyramid)
      && deep.parent_plan_hash === planMod.planHash(plan)
      && deep.revision === 0
      && v.ok === true
      && replay.calls.length + guard.attempts() === callsBefore
      && auditLedger.readAudit(room.roomDir).length === auditBefore
      && walk(room.roomDir, []).length === filesBefore
      && deep.run_id !== plan.run_id
      || ('mode ' + deep.mode + ' errors ' + JSON.stringify(v.errors));
  });

  // Q13 evidence card
  await leg('Q13 evidenceCard: shape, options, row ids, attributed counts, no praise, no dash', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor({ primary: 'contested_rows', cover: 'synonym_hits', prior: 'gap_primary_zero' });
    const out = await run(room, plan, replay, {
      rowsProvider: async function () {
        return [
          rowFrom('contested_rows', 0, 'L1', 'supports'),
          rowFrom('contested_rows', 3, 'L1', 'contradicts'),
        ];
      },
    });
    if (out.status !== 'done') return 'status ' + out.status;
    const card = QUICK.evidenceCard(out.run, plan);
    const body = card.body_md;
    const praise = /\b(great|excellent|congrat|well done|impressive|fantastic|amazing)\b/i;
    const allRowsShown = out.run.rows.length > 0 && out.run.rows.every(function (r) { return body.indexOf(r.row_id) !== -1; });
    const counted = /OpenAlex exact-phrase count/.test(body);
    const fileOpt = card.options.filter(function (o) { return /fil/i.test(o.label); });
    return card.shape === 'evidence'
      && card.options.length <= 3 && card.options.length >= 2
      && fileOpt.length === 1 && /nothing is filed|files nothing/i.test(fileOpt[0].label + ' ' + body)
      && allRowsShown && counted
      && !praise.test(body) && !hasDash(body) && !hasDash(JSON.stringify(card))
      && /quick research run/.test(body)
      && !/quick pass|deep dive/i.test(body)
      || ('shape ' + card.shape + ' opts ' + card.options.length + ' rows ' + allRowsShown + ' counted ' + counted);
  });

  // Q14 time budget
  await leg('Q14 time budget: a slow fetch stops the run with stop_reason time and verdict unresolved', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const replay = replayFor(ZERO);
    const out = await QUICK.runQuick(room.roomDir, plan, {
      fetchEnvelopeFn: seam(replay, { delayMs: 120 }),
      budgetMs: 25,
      now: Date.parse('2026-09-29T10:00:00Z'),
    });
    await new Promise(function (r) { setTimeout(r, 300); });
    if (out.status !== 'done') return 'status ' + out.status + ' ' + out.reason;
    return out.run.stop_reason === 'time' && out.run.verdict === 'unresolved'
      || ('stop ' + out.run.stop_reason + ' verdict ' + out.run.verdict);
  });

  // Q15 Part 8
  await leg('Q15 Part 8: marker in no audit record, URL or card; the key never reaches a file', async function () {
    const room = newRoom();
    standingGrant(room);
    const plan = makePlan();
    const FAKE_KEY = 'fake-key-363-quick-sweep';
    process.env.OPENALEX_API_KEY = FAKE_KEY;
    let out;
    let replay;
    try {
      replay = replayFor({ primary: 'gap_primary_zero', cover: 'synonym_hits', prior: 'prior_review_two' });
      out = await run(room, plan, replay);
    } finally {
      delete process.env.OPENALEX_API_KEY;
    }
    if (out.status !== 'done') return 'status ' + out.status;
    const files = walk(path.join(room.roomDir, '.mindrian'), []);
    let markerHits = 0;
    let keyHits = 0;
    files.forEach(function (f) {
      // room.db is the room's own local store (the fixture seeds the marker into
      // its claims on purpose); the sweep covers what the run itself wrote.
      if (/room\.db/.test(path.basename(f))) return;
      let text = '';
      try { text = fs.readFileSync(f, 'utf8'); } catch (_e) { return; }
      if (text.indexOf(room.marker) !== -1) markerHits += 1;
      if (text.indexOf(FAKE_KEY) !== -1) keyHits += 1;
    });
    const urls = replay.calls.map(function (c) { return c.url + ' ' + c.q; }).join('\n');
    const card = JSON.stringify(out.card);
    return replay.calls.length === 3
      && replay.calls.every(function (c) { return c.has_auth === true && c.key_in_url === false; })
      && replay.violations.length === 0
      && urls.indexOf(room.marker) === -1
      && card.indexOf(room.marker) === -1
      && markerHits === 0 && keyHits === 0
      || ('markerHits ' + markerHits + ' keyHits ' + keyHits);
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
