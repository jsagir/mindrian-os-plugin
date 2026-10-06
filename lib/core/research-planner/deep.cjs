'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 13 -- the deep research run controller.
 *
 * A deterministic, resumable state machine (D-03). The model reads records and
 * proposes rows and follow-up slots; this controller decides every step. It
 * never starts without an approved per-run grant (D-04, T-363-07), fans out one
 * lane per lens (or, for the Scientific Roadmapping engine, one lane per top
 * limiter by unlock rank, D-18), reflects, halves breadth for round two, runs a
 * mandatory counterevidence pass, stops for a named reason, and synthesizes the
 * updated perspective and pyramid with row ids (D-08, D-13).
 *
 * 369.2-24 (HARNESS-10, R17): a plan that carries plan.baseline opens with round 0, one lane BL, the field scan.
 * Round 0 runs before any limiter is ranked; its rows are recorded by the same analyst step; after round 0
 * validates, a limiter a BL row contradicts gets limiter.baseline 'contradicted' (supports gives 'supported'),
 * rankByUnlock re-runs, round one proceeds in the new order among the approved lanes, and a lane the re-rank
 * promotes outside the approved set is proposed through the extend card (kind baseline_promotion). Round 0 does
 * not count toward max_rounds; its searches count toward the search cap.
 *
 * Steps (DEEP_STEPS) and payloads:
 *   fetch_round     {round, lanes:[{lane, leaf_id, queries:[q_hash...]}]}
 *   dispatch_lanes  {lanes:[lanePayload...]}  the host hands each to an analyst
 *   validate        internal, runs when nextDeepStep is asked after every lane
 *                   is recorded; evaluates the typed stop checks
 *   reflect         {leaves_open, unused_records_digest}; the host calls
 *                   proposeFollowups (an empty list is fine) to leave it
 *   extend_card     {card (F.3), new_queries} when a follow-up or a falsifier is
 *                   outside the approved family, provider or remaining budget
 *   counterevidence {queries}; runCounterevidence fetches, recordLaneRows('CE')
 *   synthesize      synthesize(roomDir, runId) builds the RunResult
 *   done            finished
 *
 * Stop reasons recorded as stop_reason: cap, saturation, budget, time,
 * plurality_required, navigator_stop. A budget or time stop skips the
 * counterevidence pass and the RunResult names it as an unresolved branch.
 *
 * Run state layout (the CLI steps across separate calls; 363-15 and 363-18
 * drive it), all under <room>/.mindrian/research-runs/<run_id>/ :
 *   plan.json                  the plan as approved; every step refuses with
 *                              plan_hash_mismatch when it no longer hashes to
 *                              state.plan_hash (tamper)
 *   state.json                 the controller state (atomic writes)
 *   lanes/<lane>.records.json  fetched records for the lane, tagged by round
 *   lanes/<lane>.rows.json     validated rows for the lane
 *   records.json rows.json run.json   written by synthesize (same shapes as the
 *                              quick run so 363-14 reads either)
 *
 * Egress audit (Canon Part 8): the only outbound strings are the round-one q
 * strings the grant approved, plus follow-ups and falsifiers composed through
 * families.cjs; each is checked by validateExecutedQuery against the run grant
 * and audited again at the corpus dispatch. The lane payload handed to an
 * analyst holds ids, a records file path, the leaf question and the falsifier,
 * never room content and never a network capability.
 *
 * Dependencies: node built-ins plus the shipped 363 modules. No em-dash or
 * en-dash in this file.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const planMod = require('./plan.cjs');
const pyramidMod = require('./pyramid.cjs');
const families = require('./families.cjs');
const grants = require('./grants.cjs');
const auditLedger = require('./audit-ledger.cjs');
const evidenceRows = require('./evidence-rows.cjs');
const perspectiveMod = require('./perspective.cjs');
const verdictMod = require('./verdict.cjs');
const quickMod = require('./quick.cjs');
const operations = require('./operations.cjs');
const jobLines = require('./job-lines.cjs');
const researchCache = require('../research-cache.cjs');
const corpus = require('../research-corpus.cjs');
const orchestrator = require('../futures/orchestrator.cjs');
const sourceLensDriver = require('../../lens-engine/source-lens-driver.cjs');

const BUDGETS = planMod.BUDGETS;

const STATE_SCHEMA = 'mos.research-deep-state/1';
const DEEP_STEPS = Object.freeze(['fetch_round', 'dispatch_lanes', 'validate', 'reflect', 'extend_card', 'counterevidence', 'synthesize', 'done']);
const STATE_DIR = path.join('.mindrian', 'research-runs');
const SOURCE_ID = 'openalex-v2';
const PROVIDER = 'openalex';
const CE_LANE = 'CE';
const CE_NOT_RUN = 'counterevidence not run';
const FOLLOWUP_LANE = 'FU';
const BL_LANE = 'BL';
const CI_FAMILY = 'constraint-interrogation/v1';
const DIGEST_CAP = 40;
const ROUND_ONE_TEMPLATES = Object.freeze(['ci.derivation', 'ci.retest']);
const ROUND_TWO_TEMPLATES = Object.freeze(['ci.scurve', 'ci.prior_attack']);
const OK_OUTCOMES = Object.freeze(['ok', 'empty_valid', 'cache_hit']);

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function num(v) { return typeof v === 'number' && Number.isFinite(v); }
function iso(ms) { return new Date(ms).toISOString(); }
function noDash(s) { return String(s).replace(/[\u2014\u2013]/g, '-'); }
function oneLine(s) { return noDash(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()); }
function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
function refuse(reason, extra) { return Object.assign({ ok: false, reason: reason }, extra || {}); }

function atomicWriteJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return fallback; }
}

function safeLane(s) { return String(s).replace(/[^A-Za-z0-9_-]/g, '-'); }
function laneCode(lane) { return String(lane).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function relRun(runId) { return path.join(STATE_DIR, runId); }
function runAbs(roomDir, runId) { return path.join(roomDir, relRun(runId)); }
function lanePath(roomDir, runId, lane, kind) { return path.join(runAbs(roomDir, runId), 'lanes', safeLane(lane) + '.' + kind + '.json'); }
function laneRel(runId, lane, kind) { return path.join(relRun(runId), 'lanes', safeLane(lane) + '.' + kind + '.json').split(path.sep).join('/'); }

function isApprovedVia(v) {
  return isObj(v) && (v.surface === 'cli' || v.surface === 'mcp') && nonEmpty(v.decision_node_id);
}

// ---------------------------------------------------------------------------
// state io (plan hash checked on every load)
// ---------------------------------------------------------------------------
function saveState(roomDir, state) {
  atomicWriteJson(path.join(runAbs(roomDir, state.run_id), 'state.json'), state);
}

// loadState(roomDir, runId) -> {ok, state, plan} | {ok:false, reason}
function loadState(roomDir, runId) {
  if (!nonEmpty(roomDir) || !nonEmpty(runId) || !/^rp-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/.test(runId)) return refuse('bad_run_id');
  const state = readJson(path.join(runAbs(roomDir, runId), 'state.json'), null);
  if (!isObj(state) || state.schema !== STATE_SCHEMA) return refuse('no_state');
  const plan = readJson(path.join(runAbs(roomDir, runId), 'plan.json'), null);
  if (!isObj(plan)) return refuse('no_plan');
  let hash = null;
  try { hash = planMod.planHash(plan); } catch (_e) { hash = null; }
  if (hash !== state.plan_hash) return refuse('plan_hash_mismatch');
  // 369.2-14: a torn or foreign operations.json refuses the step up front (readLedger throws ledger_corrupt),
  // so a restart can never read a damaged ledger as an empty one. An absent file is a run begun before the ledger.
  try { operations.readLedger(roomDir, runId); } catch (e) { return refuse('ledger_corrupt', { detail: String((e && e.message) || e).slice(0, 200) }); }
  return { ok: true, state: state, plan: plan };
}

// ---------------------------------------------------------------------------
// grant handling
// ---------------------------------------------------------------------------
function capNow(state, base) {
  const lift = list(state.extensions).reduce(function (n, e) { return n + (num(e.cap_lift) ? e.cap_lift : 0); }, 0);
  return Math.min(BUDGETS.DEEP_MAX_SEARCHES, base + lift);
}

// 369.2-15 (HARNESS-01, SW-03, ACT-06): the counterevidence pass has a reserve the rounds cannot spend.
// ce_reserve = min(3, max(1, ceil(0.2 * max_searches))) when the plan asks for counterevidence, held back from
// every round and follow-up; the pass itself may spend the full cap. A cap of one or less keeps no reserve,
// so a tiny cap never starves round one (the reserve is at most cap - 1). A state saved before this plan has
// no ce_reserve and reads 0, so an older run keeps its behavior.
function computeCeReserve(plan) {
  const b = plan && plan.budget;
  if (!b || b.counterevidence !== true || !num(b.max_searches)) return 0;
  const want = Math.min(3, Math.max(1, Math.ceil(0.2 * b.max_searches)));
  return Math.min(want, Math.max(0, b.max_searches - 1));
}
function roundCap(state) {
  return Math.max(0, capNow(state, state.max_searches_base) - (num(state.ce_reserve) ? state.ce_reserve : 0));
}

// The run grant as it stands on disk, plus what the navigator has extended on
// this run through an F.3 approval (families, hashes, a bounded cap lift).
function activeGrant(roomDir, state, nowMs, grantOpts) {
  const g = grants.findActiveGrant(roomDir, { now: nowMs, lifetime: 'run', run_id: state.run_id });
  if (!g || g.grant_id !== state.grant_ref.grant_id) return null;
  const eff = clone(g);
  list(state.extensions).forEach(function (e) {
    list(e.families).forEach(function (f) { if (eff.families.indexOf(f) === -1) eff.families.push(f); });
    list(e.hashes).forEach(function (h) { if (eff.approved_hashes.indexOf(h) === -1) eff.approved_hashes.push(h); });
  });
  const base = eff.caps && num(eff.caps.max_searches) ? eff.caps.max_searches : 0;
  // rounds and follow-ups see the cap minus the counterevidence reserve; the pass itself sees the full cap
  const reserve = isObj(grantOpts) && grantOpts.forCounterevidence === true ? 0 : (num(state.ce_reserve) ? state.ce_reserve : 0);
  eff.caps = Object.assign({}, eff.caps, { max_searches: Math.max(0, capNow(state, base) - reserve) });
  return eff;
}

function checkQuery(roomDir, q, grant, searchesUsed, nowMs) {
  return grants.validateExecutedQuery({
    q: q.q,
    q_hash: q.q_hash,
    template_id: q.template_id,
    family: q.family,
    provider: PROVIDER,
    audit: q.audit,
    slot_terms: list(q.slot_terms),
    round: q.round,
    trigger: 'navigator',
  }, grant, { room_id: grants.roomIdFor(roomDir), now: nowMs, searches_used: searchesUsed, round: q.round, runs_in_window: 0 });
}

// ---------------------------------------------------------------------------
// the operation ledger (369.2-14, HARNESS-02)
// ---------------------------------------------------------------------------
// Rows exist BEFORE dispatch: round one in initDeepState, round two and follow-ups in proposeFollowups,
// counterevidence in prepareCounterevidence. A transition sits next to each fetch (executeQueries); the
// run ends with a sweep and run.completion comes from operations.completion(), never from a command return.
// An operation is found again by (query_id, round): the ids themselves are minted once and never recomputed.
function leafQuestion(plan, id) {
  const l = list(plan.leaves).filter(function (x) { return x && x.id === id; })[0];
  return l && typeof l.question === 'string' ? oneLine(l.question).slice(0, 120) : null;
}

function refusalReason(refusal) {
  const r = isObj(refusal) && nonEmpty(refusal.reason) ? refusal.reason : 'bad_slot';
  if (r === 'term_not_composed') return r;
  // 369.2-17: a reason that already names its slot (bad_slot:limiter, unused_slot:term2) is the ledger reason
  if (r.indexOf('bad_slot:') === 0 || r.indexOf('unused_slot:') === 0) return r;
  const slot = isObj(refusal) && nonEmpty(refusal.slot) ? refusal.slot : null;
  if (r === 'bad_slot') return 'bad_slot:' + (slot || 'unspecified');
  if (r === 'unused_slot') return 'unused_slot:' + (slot || 'unspecified');
  return 'bad_slot:' + r;
}

// a classified provider answer -> the terminal state it proves (a failed call is never empty)
function ledgerOutcome(info, itemCount) {
  if (info.outcome === 'failed' || info.outcome === 'blocked') {
    return { to: 'not_executed', fields: { attempted: true, reason: 'provider_failed:' + (info.failure_class || 'unknown_error') } };
  }
  if (itemCount > 0) return { to: 'executed_with_results', fields: { count: itemCount } };
  if (info.count === 0) return { to: 'executed_empty', fields: { proof: { count: 0 } } };
  return { to: 'not_executed', fields: { attempted: true, reason: 'provider_failed:' + (num(info.count) ? 'items_missing' : 'count_missing') } };
}

function stopToSweepReason(stop) {
  if (stop === 'time') return 'time';
  if (stop === 'budget') return 'budget_usd';
  if (stop === 'navigator_stop') return 'stopped_by_navigator';
  return 'search_cap';
}

// the ledger for a run: the file when it exists, else a fresh one (loadState already refused a corrupt file)
function ledgerFor(roomDir, state) {
  return operations.readLedger(roomDir, state.run_id) || operations.createLedger(state.run_id, state.plan_hash);
}

// next ordinal for (dimension, kind, template, round): deterministic given mint order, and ops are never removed
function nextOrdinal(ledger, dim, kind, template, round) {
  return ledger.operations.filter(function (o) {
    return o.plan_dimension === dim && o.kind === kind && o.template_id === template && o.round === round;
  }).length;
}

// ensureOp(ledger, q, dim): the op for a shaped query, minted (state composed) when it is not there yet
function ensureOp(ledger, plan, q, dim) {
  const found = ledger.operations.filter(function (o) { return o.query_id === q.q_hash && o.round === q.round; })[0];
  if (found) return found;
  const isBl = q.lane === BL_LANE;
  const dimension = dim || (isBl ? baselineDimension(q) : q.leaf_ids[0]);
  // every counterevidence search is a falsifier for the ledger (annex C17), whatever its template
  // 369.2-21: a practice, mechanism or adjacent query keeps its kind; a falsifier template stays a falsifier
  // 369.2-24: a field-scan search is kind baseline, mandatory, and never a falsifier (its challenge facet uses a
  // falsifier template, but it does not stand for the falsification pass)
  const tagged = typeof q.kind === 'string' && families.QUERY_KINDS.indexOf(q.kind) !== -1 ? q.kind : 'direct';
  const kind = isBl ? 'baseline' : (q.lane === CE_LANE || operations.isFalsifier({ template_id: q.template_id, role: q.role }) ? 'falsifier' : tagged);
  const op = operations.mint(ledger, {
    plan_dimension: dimension, dimension_label: isBl ? baselineLabel(q) : leafQuestion(plan, q.leaf_ids[0]), mandatory: true, kind: kind,
    template_id: q.template_id, round: q.round, ordinal: nextOrdinal(ledger, dimension, kind, q.template_id, q.round),
    query_id: q.q_hash, q: q.q, provider: PROVIDER, role: q.role,
  });
  if (op.state === 'planned') operations.transition(ledger, op.operation_id, 'composed', {});
  return op;
}

// an op with no query (a cut lane, an uncomposed branch, a refused slot): minted and closed at once
function closedOp(ledger, plan, fields, to, reason) {
  const kind = fields.kind || 'direct';
  const round = fields.round || 1;
  const same = ledger.operations.filter(function (o) {
    return o.plan_dimension === fields.dimension && o.kind === kind && o.template_id === fields.template && o.round === round && o.reason === reason;
  })[0];
  if (same) return same;
  const op = operations.mint(ledger, {
    plan_dimension: fields.dimension, dimension_label: fields.label === undefined ? leafQuestion(plan, fields.leaf_id) : fields.label,
    mandatory: true, kind: kind, template_id: fields.template, round: round,
    ordinal: nextOrdinal(ledger, fields.dimension, kind, fields.template, round), provider: PROVIDER,
  });
  if (!isTermState(op.state)) operations.transition(ledger, op.operation_id, to, { reason: reason });
  return op;
}
function isTermState(st) { return operations.TERMINAL_STATES.indexOf(st) !== -1; }

// settle(ledger, op, to, fields): a transition the ledger refuses never leaves the op open
function settle(ledger, op, to, fields) {
  const r = operations.transition(ledger, op.operation_id, to, fields);
  if (r.ok) return r;
  return operations.transition(ledger, op.operation_id, 'not_executed', { attempted: true, reason: 'provider_failed:ledger_' + String(r.reason || 'refused') });
}

// queries[from..] were not run in this pass: close each with the reason the pass stopped
function closeRest(ledger, plan, queries, from, reason, dimFn) {
  for (let i = from; i < queries.length; i += 1) {
    const op = ensureOp(ledger, plan, queries[i], dimFn ? dimFn(queries[i]) : null);
    if (!isTermState(op.state)) operations.transition(ledger, op.operation_id, 'not_executed', { reason: reason });
  }
}

function ceDimension(q) { return 'CE:' + String(q.note || 'branch') + ':' + String(q.leaf_ids && q.leaf_ids[0]); }
function baselineDimension(q) { return 'BL:' + String(q.facet || q.template_id); }
function baselineLabel(q) {
  const words = planMod.BASELINE_FACET_WORDS && planMod.BASELINE_FACET_WORDS[q.facet];
  return 'Field scan: ' + (words || String(q.facet || q.template_id));
}
function dimOf(q) { return q.lane === CE_LANE ? ceDimension(q) : (q.lane === BL_LANE ? baselineDimension(q) : null); }

// ---------------------------------------------------------------------------
// plan reading and lane specs
// ---------------------------------------------------------------------------
// The limiter-lane path needs limiters to lane on. A researcher room gives every
// plan the scientific-roadmapping engine (structure.detectScientific), including
// a lite whitespace plan with no limiters; that plan runs on lens lanes.
function isSR(plan) {
  return !!plan.perspective && plan.perspective.engine === 'scientific-roadmapping'
    && list(plan.perspective.limiters).length > 0;
}
function isWhitespace(plan) { return !!plan.origin && plan.origin.template_id === 'whitespace'; }

function fetchLeaves(plan) {
  return list(plan.leaves).filter(function (l) { return isObj(l) && l.researchable === true && l.corpus === 'openalex'; });
}

// 369.2-17 (CODE-05, R10): the first BOUND slots.limiter, or null. The limiter's statement is a sentence, not a
// term, so it is never a fallback: an unbound limiter is refused bad_slot:limiter before fetch.
function limiterSlot(plan, lim, leaves) {
  for (let i = 0; i < leaves.length; i += 1) {
    const s = isObj(leaves[i].slots) ? leaves[i].slots.limiter : null;
    if (nonEmpty(s)) return s.trim();
  }
  return null;
}

function laneCapFor(plan) {
  return orchestrator.resolveFanoutCap({ fanout: plan.budget.breadth });
}

// allLaneSpecs(plan) -> every lane the plan asks for, in rank order, NOT clamped (369.2-14: the lanes the
// cap cuts need a ledger row each; laneSpecs below is the clamped list the run uses).
// 369.2-19 (CODE-03, CODE-04): a spec carries `leaves: [{leaf_id, slots}]`, one entry per leaf in the lane, so
// every leaf composes its own search. A lens lane groups the leaves of one lens for the analyst only. A
// scientific-roadmapping plan lists its limiter lanes first, then a lens lane for each lens whose leaves sit
// under no limiter and carry slots, so a slot on such a leaf is sent and not echoed back.
function leafEntry(l) { return { leaf_id: l.id, slots: clone(isObj(l.slots) ? l.slots : {}) }; }

function lensSpecs(leaves) {
  const specs = [];
  const order = [];
  const byLens = {};
  leaves.forEach(function (l) {
    const key = nonEmpty(l.lens) ? l.lens : l.id;
    if (!byLens[key]) { byLens[key] = []; order.push(key); }
    byLens[key].push(l);
  });
  order.forEach(function (lens) {
    const own = byLens[lens];
    specs.push({ lane: safeLane(lens), kind: 'lens', lens: lens, leaf_ids: own.map(function (l) { return l.id; }), leaves: own.map(leafEntry) });
  });
  return specs;
}

function allLaneSpecs(plan) {
  const leaves = fetchLeaves(plan);
  const specs = [];
  if (isSR(plan)) {
    const ranking = perspectiveMod.rankByUnlock(plan.perspective, {});
    const inLane = {};
    ranking.forEach(function (r) {
      const lim = list(plan.perspective.limiters).filter(function (l) { return l && l.id === r.limiter_id; })[0];
      if (!lim) return;
      const own = leaves.filter(function (l) { return l.limiter_id === lim.id || l.id === lim.leaf_id; });
      if (own.length === 0) return;
      own.forEach(function (l) { inLane[l.id] = true; });
      specs.push({ lane: safeLane(lim.id), kind: 'limiter', limiter_id: lim.id, leaf_ids: own.map(function (l) { return l.id; }), leaves: own.map(leafEntry), slot: limiterSlot(plan, lim, own) });
    });
    lensSpecs(leaves.filter(function (l) { return !inLane[l.id] && isObj(l.slots) && Object.keys(l.slots).length > 0; })).forEach(function (sp) { specs.push(sp); });
  } else {
    lensSpecs(leaves).forEach(function (sp) { specs.push(sp); });
  }
  return specs;
}

// splitLanes(plan) -> {run, cut}: the lanes the run uses and the lanes the fan-out cap cuts. The cap bounds the
// limiter lanes (or the lens lanes of a plan with no limiter); the extra lens lanes of a scientific-roadmapping
// plan are bounded by the same cap on their own, so a slot on a leaf under no limiter is not lost to it.
function splitLanes(plan) {
  const cap = laneCapFor(plan);
  const all = allLaneSpecs(plan);
  const main = all.filter(function (sp) { return sp.kind === 'limiter'; });
  const extra = all.filter(function (sp) { return sp.kind === 'lens' && isSR(plan); });
  const plain = all.filter(function (sp) { return sp.kind === 'lens' && !isSR(plan); });
  const lead = isSR(plan) ? main : plain;
  return { run: lead.slice(0, cap).concat(extra.slice(0, cap)), cut: lead.slice(cap).concat(extra.slice(cap)) };
}

// laneSpecs(plan) -> [{lane, kind, limiter_id?, lens?, leaf_ids, leaves, slot?}] in rank order, clamped.
function laneSpecs(plan) {
  return splitLanes(plan).run;
}

function shapeQuery(q, lane, leafIds, round) {
  const out = {
    lane: lane,
    leaf_ids: leafIds.slice(),
    q: q.q,
    q_hash: q.q_hash,
    template_id: q.template_id,
    family: q.family,
    role: q.role || null,
    audit: q.audit,
    round: round,
    slot_terms: Array.isArray(q.slot_terms) ? q.slot_terms.slice() : [],
  };
  // 369.2-21: the query kind (direct, practice, mechanism, adjacent) rides with the query into the ledger
  if (typeof q.kind === 'string' && families.QUERY_KINDS.indexOf(q.kind) !== -1) out.kind = q.kind;
  return out;
}

// the round-one queries already on a leaf (a reviewed plan), by family class
function leafQueriesOf(leaf, wantCi) {
  const out = [];
  list(leaf && leaf.queries).forEach(function (q) {
    if (!isObj(q) || (q.round !== undefined && q.round !== 1)) return;
    if ((q.family === CI_FAMILY) !== wantCi) return;
    if (!out.some(function (x) { return x.q_hash === q.q_hash; })) out.push(q);
  });
  return out;
}

function isCiLens(lens) {
  const m = Object.prototype.hasOwnProperty.call(families.LENS_FAMILY, lens) ? families.LENS_FAMILY[lens] : null;
  return !!m && m.family === CI_FAMILY;
}

// a leaf's own round-one queries: the ones the plan already carries, else composed from its slots
function ownQueries(leaf, slots) {
  const have = leafQueriesOf(leaf, false);
  if (have.length > 0) return have;
  if (!isObj(slots) || Object.keys(slots).length === 0) return [];
  const c = families.composeForKinds({ lens: leaf.lens, slots: slots, query_kinds: leaf.query_kinds }, { round: 1 });
  return c && c.ok ? c.queries : [];
}

// 369.2-21: a leaf's round-one queries as one allocation entry per (kind, leaf): every leaf's direct entry first,
// then every leaf's practice, mechanism and adjacent entry, so the round-robin gives each kind of each leaf its
// first query before any entry gets a second. A leaf with no query kinds has one entry, as before.
function kindEntries(items) {
  const entries = [];
  families.QUERY_KINDS.forEach(function (kind) {
    items.forEach(function (it) {
      entries.push({ leaf_id: it.leaf_id, kind: kind, queries: it.queries.filter(function (q) { return (q.kind || 'direct') === kind; }) });
    });
  });
  return entries;
}
// the lane budget: the old floor (queries per round, one per leaf) plus one first query for each non-direct
// entry that has queries, so a question with four kinds is searched in all four before any fetch
function kindBudget(perLane, leafCount, entries) {
  const extra = entries.filter(function (e) { return e.kind !== 'direct' && e.queries.length > 0; }).length;
  return Math.max(perLane, leafCount + extra);
}

// roundOneQueries(plan) -> [{lane, leaf_ids, queries[]}] (+ .refusals, .cut). 369.2-19 (CODE-03, CODE-04): every
// leaf of a lane composes its own queries; the lane budget is max(queries_per_round, leaves in the lane) and is
// shared round-robin so each leaf gets its first query before any leaf gets a second. A query is tagged with the
// leaf that composed it (a limiter query keeps the lane's leaves). A limiter lane also sends the lens queries of
// its own leaves whose lens is not a ci.* lens. A leaf the lane budget left without any query is named in `cut`
// ({leaf_id, template_id, lane, reason: 'lane_cap'}), never dropped silently. The search cap is not applied here:
// fetchRound spends the cap in pending order and closes the rest as search_cap (369.2-14), so the stop reason
// stays 'budget'; the round-robin order puts every leaf's first query before any second one. A hash an earlier
// query claimed is not repeated; a leaf of the same lane that composed the same search shares it.
// The facade calls this before buildRunGrant so approved hashes match.
function roundOneQueries(plan, opts) {
  const perLane = plan.budget.queries_per_round;
  const claimed = {};
  const elsewhere = {};
  const lanes = [];
  const out = [];
  // lanes refused before fetch (369.2-17): attachQueries marks their leaves, seedDeepLedger closes their ops
  out.refusals = [];
  out.cut = [];

  // round-robin over one list per leaf; returns [{query, pos}]
  function allocate(spec, entries, budget) {
    const picks = [];
    const at = entries.map(function () { return 0; });
    let pos = 0;
    let progress = true;
    while (picks.length < budget && progress) {
      progress = false;
      for (let i = 0; i < entries.length && picks.length < budget; i += 1) {
        while (at[i] < entries[i].queries.length) {
          const q = entries[i].queries[at[i]];
          at[i] += 1;
          const prior = claimed[q.q_hash];
          if (prior) {
            // the same search is already in the run: a leaf of the same lane shares it, a leaf of another lane
            // is covered by it (never a cut)
            if (prior.lane === spec.lane && prior.leaf_ids.indexOf(entries[i].leaf_id) === -1) prior.leaf_ids.push(entries[i].leaf_id);
            elsewhere[entries[i].leaf_id] = true;
            continue;
          }
          const shaped = shapeQuery(q, spec.lane, [entries[i].leaf_id], 1);
          claimed[q.q_hash] = shaped;
          picks.push({ query: shaped, pos: pos });
          progress = true;
          break;
        }
      }
      pos += 1;
    }
    return picks;
  }

  // 369.2-24: opts.specs composes the queries of the given lane specs instead of the approved ones (a lane the
  // field scan promoted); the facade calls this with the plan alone
  (isObj(opts) && Array.isArray(opts.specs) ? opts.specs : laneSpecs(plan)).forEach(function (spec) {
    const byId = {};
    list(plan.leaves).forEach(function (l) { if (l && spec.leaf_ids.indexOf(l.id) !== -1) byId[l.id] = l; });
    const slotsOf = {};
    list(spec.leaves).forEach(function (e) { slotsOf[e.leaf_id] = e.slots; });
    const picks = [];
    const candidates = [];
    if (spec.kind === 'limiter') {
      let ci = [];
      spec.leaf_ids.forEach(function (id) {
        leafQueriesOf(byId[id], true).forEach(function (q) { if (!ci.some(function (x) { return x.q_hash === q.q_hash; })) ci.push(q); });
      });
      if (ci.length === 0) {
        if (!nonEmpty(spec.slot)) {
          out.refusals.push({ lane: spec.lane, leaf_ids: spec.leaf_ids.slice(), reason: 'bad_slot:limiter' });
          return;
        }
        const c = families.composeFamily(CI_FAMILY, { limiter: spec.slot }, { templateIds: ROUND_ONE_TEMPLATES.slice(), round: 1 });
        ci = c && c.ok ? c.queries : [];
      }
      let n = 0;
      ci.forEach(function (q) {
        candidates.push({ leaf_id: spec.leaf_ids[0], template_id: q.template_id });
        if (n >= perLane || claimed[q.q_hash]) return;
        const shaped = shapeQuery(q, spec.lane, spec.leaf_ids, 1);
        claimed[q.q_hash] = shaped;
        picks.push({ query: shaped, pos: n });
        n += 1;
      });
      const items = [];
      spec.leaf_ids.forEach(function (id) {
        const l = byId[id];
        if (!l || isCiLens(l.lens)) return;
        items.push({ leaf_id: id, queries: ownQueries(l, slotsOf[id]) });
      });
      const entries = kindEntries(items);
      entries.forEach(function (e) { if (e.kind === 'direct' && e.queries.length > 0) candidates.push({ leaf_id: e.leaf_id, template_id: e.queries[0].template_id }); });
      allocate(spec, entries, kindBudget(perLane, items.length, entries)).forEach(function (p) { picks.push(p); });
    } else {
      const items = spec.leaf_ids.map(function (id) { return { leaf_id: id, queries: byId[id] ? ownQueries(byId[id], slotsOf[id]) : [] }; });
      const entries = kindEntries(items);
      entries.forEach(function (e) { if (e.kind === 'direct' && e.queries.length > 0) candidates.push({ leaf_id: e.leaf_id, template_id: e.queries[0].template_id }); });
      allocate(spec, entries, kindBudget(perLane, spec.leaf_ids.length, entries)).forEach(function (p) { picks.push(p); });
    }
    lanes.push({ spec: spec, picks: picks, candidates: candidates });
  });

  lanes.forEach(function (ln) {
    const kept = ln.picks.map(function (p) { return p.query; });
    const have = {};
    kept.forEach(function (q) { q.leaf_ids.forEach(function (id) { have[id] = true; }); });
    Object.keys(elsewhere).forEach(function (id) { have[id] = true; });
    // a leaf that composed a search and was left without one is named, once, with its first template
    const named = {};
    ln.candidates.forEach(function (c) {
      if (have[c.leaf_id] || named[c.leaf_id]) return;
      named[c.leaf_id] = true;
      out.cut.push({ leaf_id: c.leaf_id, template_id: c.template_id, lane: ln.spec.lane, reason: 'lane_cap' });
    });
    if (kept.length > 0) out.push({ lane: ln.spec.lane, leaf_ids: ln.spec.leaf_ids.slice(), queries: kept });
  });
  return out;
}

function leafBrief(plan, id) {
  const l = list(plan.leaves).filter(function (x) { return x.id === id; })[0];
  return { leaf_id: id, question: l ? String(l.question) : '', falsifier: l && isObj(l.falsifier) ? String(l.falsifier.text || '') : '' };
}

// seedDeepLedger: one op per round-one query; a not_executed op (lane_cap) per lane the fan-out cap cut
// (pitfall 14: nothing promised disappears silently); no_query_composed for a lane or a web leaf that
// produced no search; refused_before_fetch for a slot the composer refused at plan time.
function seedDeepLedger(ledger, plan, r1, scan) {
  const split = splitLanes(plan);
  // 369.2-24: the field-scan operations have rows before round 0 dispatches; a scan query the search cap leaves
  // out is closed at once with reason search_cap (never silent)
  if (isObj(scan)) {
    list(scan.run).forEach(function (q) { ensureOp(ledger, plan, q, null); });
    list(scan.cut).forEach(function (q) {
      const op = ensureOp(ledger, plan, q, null);
      if (!isTermState(op.state)) operations.transition(ledger, op.operation_id, 'not_executed', { reason: 'search_cap' });
    });
  }
  r1.forEach(function (lane) { lane.queries.forEach(function (q) { ensureOp(ledger, plan, q, null); }); });
  split.cut.forEach(function (spec) {
    closedOp(ledger, plan, { dimension: spec.leaf_ids[0], leaf_id: spec.leaf_ids[0], template: 'lane:' + spec.lane }, 'not_executed', 'lane_cap');
  });
  // 369.2-19: a leaf the lane budget or the search cap left without a query (a named cut, never silent)
  const cutLanes = {};
  list(r1.cut).forEach(function (c) {
    cutLanes[c.lane] = true;
    closedOp(ledger, plan, { dimension: c.leaf_id, leaf_id: c.leaf_id, template: c.template_id || 'none' }, 'not_executed', c.reason);
  });
  const refusedLanes = list(r1.refusals).map(function (x) { return x.lane; });
  split.run.forEach(function (spec) {
    if (r1.some(function (l) { return l.lane === spec.lane; })) return;
    if (refusedLanes.indexOf(spec.lane) !== -1) {
      // the lane was refused before fetch: each of its leaves gets the refused op (a leaf.refusal the plan
      // already carries lands on the same row, closedOp does not mint it twice)
      spec.leaf_ids.forEach(function (id) {
        closedOp(ledger, plan, { dimension: id, leaf_id: id, template: 'refusal' }, 'refused_before_fetch', 'bad_slot:limiter');
      });
      return;
    }
    if (cutLanes[spec.lane]) return;
    closedOp(ledger, plan, { dimension: spec.leaf_ids[0], leaf_id: spec.leaf_ids[0], template: 'lane:' + spec.lane }, 'not_executed', 'no_query_composed');
  });
  // 369.2-19: a leaf of a lens lane that composed no search at all (no slots, or none the lens can render) has
  // its own no_query_composed op; a leaf that shares a lane query, or another lane's identical query, is covered
  const sent = {};
  r1.forEach(function (lane) { lane.queries.forEach(function (q) { q.leaf_ids.forEach(function (id) { sent[id] = true; }); }); });
  const named = {};
  list(r1.cut).forEach(function (c) { named[c.leaf_id] = true; });
  split.run.forEach(function (spec) {
    if (spec.kind !== 'lens') return;
    spec.leaf_ids.forEach(function (id) {
      const leaf = list(plan.leaves).filter(function (l) { return l && l.id === id; })[0];
      if (sent[id] || named[id] || (leaf && isObj(leaf.refusal))) return;
      if (leaf && leafQueriesOf(leaf, false).length > 0) return;
      const own = list(spec.leaves).filter(function (e) { return e.leaf_id === id; })[0];
      if (leaf && ownQueries(leaf, own && own.slots).length > 0) return;
      closedOp(ledger, plan, { dimension: id, leaf_id: id, template: 'none' }, 'not_executed', 'no_query_composed');
    });
  });
  const covered = {};
  splitAll(split).forEach(function (spec) { spec.leaf_ids.forEach(function (id) { covered[id] = true; }); });
  fetchLeaves(plan).forEach(function (leaf) {
    if (covered[leaf.id] || isObj(leaf.refusal)) return;
    closedOp(ledger, plan, { dimension: leaf.id, leaf_id: leaf.id, template: 'none' }, 'not_executed', 'no_query_composed');
  });
  list(plan.leaves).forEach(function (leaf) {
    if (!isObj(leaf) || !isObj(leaf.refusal)) return;
    closedOp(ledger, plan, { dimension: leaf.id, leaf_id: leaf.id, template: 'refusal' }, 'refused_before_fetch', refusalReason(leaf.refusal));
  });
}
function splitAll(split) { return split.run.concat(split.cut); }

// ---------------------------------------------------------------------------
// initDeepState
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// the field scan, round 0 (369.2-24, HARNESS-10)
// ---------------------------------------------------------------------------
// the leaves of every limiter, researchable ones only: the leaves a BL row can name
function scanLeafIds(plan) {
  const ok = researchableIds(plan);
  const ids = [];
  list(plan.perspective && plan.perspective.limiters).forEach(function (lim) {
    limiterLeafIds(plan, lim).forEach(function (id) { if (ok.indexOf(id) !== -1 && ids.indexOf(id) === -1) ids.push(id); });
  });
  return ids;
}

function shapeBaseline(bq, leafIds) {
  const out = shapeQuery(bq, BL_LANE, leafIds, 0);
  out.kind = 'baseline';
  out.facet = bq.facet;
  return out;
}

// scanQueries(plan, state-less) -> {run, cut, leafIds}: the plan's field scan as shaped queries. A scan string
// equal to a round-one string is dropped (round one runs it once, in round one, and that is one search). The
// scan may spend at most half of the round cap, so it never starves round one; the facets after that are cut.
function scanQueries(plan, r1, roundCapNow) {
  const out = { run: [], cut: [], leafIds: [] };
  const queries = isObj(plan.baseline) ? list(plan.baseline.queries) : [];
  if (!isSR(plan) || queries.length === 0) return out;
  const leafIds = scanLeafIds(plan);
  if (leafIds.length === 0) return out;
  const inRoundOne = {};
  list(r1).forEach(function (lane) { lane.queries.forEach(function (q) { inRoundOne[q.q_hash] = true; }); });
  const allow = Math.floor(Math.max(0, roundCapNow) / 2);
  queries.forEach(function (bq) {
    if (!isObj(bq) || inRoundOne[bq.q_hash]) return;
    const shaped = shapeBaseline(bq, leafIds);
    if (out.run.length < allow) out.run.push(shaped);
    else out.cut.push(shaped);
  });
  out.leafIds = leafIds;
  return out;
}

// the plan's perspective with the field-scan verdicts on its limiters (the plan itself is never changed)
function workingPerspective(plan, verdicts) {
  if (!isObj(verdicts)) return plan.perspective;
  const p = clone(plan.perspective);
  list(p.limiters).forEach(function (l) { l.baseline = verdicts[l.id] === undefined ? null : verdicts[l.id]; });
  return p;
}

// baselineVerdicts: per limiter, from the BL rows on its leaves. A contradicts row wins over a supports row.
function baselineVerdicts(roomDir, state, plan) {
  const f = readJson(lanePath(roomDir, state.run_id, BL_LANE, 'rows'), null);
  const rows = isObj(f) ? list(f.rows) : [];
  const out = {};
  list(plan.perspective.limiters).forEach(function (lim) {
    if (!isObj(lim)) return;
    const ids = limiterLeafIds(plan, lim);
    const own = rows.filter(function (r) { return ids.indexOf(r.leaf_id) !== -1 && !(r.flags && r.flags.retracted); });
    out[lim.id] = own.some(function (r) { return r.label === 'contradicts'; }) ? 'contradicted' : (own.some(function (r) { return r.label === 'supports'; }) ? 'supported' : null);
  });
  return out;
}

// lane position under a ranking: a limiter lane by its rank, every other lane after them in its own order
function lanePos(state, lane, ranking) {
  const spec = state.lane_specs[lane];
  if (spec && spec.kind === 'limiter') {
    const at = ranking.indexOf(spec.limiter_id);
    return at === -1 ? 500 : at;
  }
  return 1000;
}
function stableByLane(state, items, laneOf, ranking) {
  return items.map(function (it, i) { return { it: it, i: i, pos: lanePos(state, laneOf(it), ranking) }; })
    .sort(function (a, b) { return a.pos !== b.pos ? a.pos - b.pos : a.i - b.i; })
    .map(function (x) { return x.it; });
}

// promotionQueries: the lanes the re-rank puts in the top lanes that the navigator did not approve, with the
// round-one queries each would send. Nothing here is sent; the extend card lists it first (T-369.2-24-01).
function promotionQueries(state, plan, ranking) {
  const none = { specs: [], queries: [] };
  if (!isSR(plan)) return none;
  const all = allLaneSpecs(plan).filter(function (sp) { return sp.kind === 'limiter'; });
  const eligible = ranking.filter(function (id) { return all.some(function (sp) { return sp.limiter_id === id; }); });
  const top = eligible.slice(0, laneCapFor(plan));
  const have = {};
  Object.keys(state.lane_specs).forEach(function (l) { if (state.lane_specs[l].kind === 'limiter') have[state.lane_specs[l].limiter_id] = true; });
  const specs = all.filter(function (sp) { return top.indexOf(sp.limiter_id) !== -1 && !have[sp.limiter_id]; });
  if (specs.length === 0) return none;
  const seen = executedHashes(state);
  list(state.round_one_pending).forEach(function (q) { seen[q.q_hash] = true; });
  const keptSpecs = [];
  const queries = [];
  roundOneQueries(plan, { specs: specs }).forEach(function (lane) {
    let any = false;
    lane.queries.forEach(function (q) {
      if (seen[q.q_hash] || seen['q:' + String(q.q).toLowerCase()]) return;
      seen[q.q_hash] = true;
      queries.push(q);
      any = true;
    });
    if (any) keptSpecs.push(specs.filter(function (sp) { return sp.lane === lane.lane; })[0]);
  });
  return { specs: keptSpecs, queries: queries };
}

// beginRoundOne: round 0 is over (or never ran); round one starts in the ranking the field scan left. Lanes the
// navigator approved run in the new order; promoted lanes the navigator approved join at their rank.
function beginRoundOne(state, plan, specs, queries) {
  list(specs).forEach(function (sp) {
    state.lane_specs[sp.lane] = sp;
    state.lane_leaves[sp.lane] = sp.leaf_ids.map(function (id) { return leafBrief(plan, id); });
  });
  const ranking = list(state.baseline_ranking);
  const pending = stableByLane(state, list(state.round_one_pending).concat(list(queries)), function (q) { return q.lane; }, ranking);
  const lanes = uniq(pending.map(function (q) { return q.lane; }));
  const rest = lanes.filter(function (l) { return state.lane_order.indexOf(l) === -1; });
  state.lane_order = [BL_LANE].concat(stableByLane(state, state.lane_order.filter(function (l) { return l !== BL_LANE; }).concat(rest), function (l) { return l; }, ranking));
  state.round = 1;
  state.round_new = { ids: 0, rows: 0 };
  state.pending = pending;
  state.pending_after_extend = null;
  state.round_one_pending = null;
  state.round_lanes[1] = lanes;
  state.expected = [];
  state.step = 'fetch_round';
}

function initDeepState(roomDir, plan, runGrant, opts) {
  const o = isObj(opts) ? opts : {};
  if (o.trigger === 'ambient') return refuse('navigator_only');
  const shape = planMod.validatePlan(plan);
  if (!shape.ok) return refuse('plan_invalid', { errors: shape.errors });
  if (plan.mode !== 'deep') return refuse('not_deep');
  if (plan.status !== 'ready') return refuse('plan_' + plan.status);
  const pyr = pyramidMod.checkPyramid(plan.pyramid, plan.leaves, {});
  if (pyr.status !== 'ready') return refuse('pyramid_' + pyr.status, { errors: pyr.errors });

  if (!isObj(runGrant)) return refuse('no_grant');
  if (runGrant.lifetime === 'standing') return refuse('multi_step');
  if (runGrant.lifetime !== 'run') return refuse('no_grant');
  const nowReal = Date.now();
  const onDisk = grants.findActiveGrant(roomDir, { now: nowReal, lifetime: 'run', run_id: plan.run_id });
  if (!onDisk || onDisk.grant_id !== runGrant.grant_id) return refuse('no_grant');

  const r1 = roundOneQueries(plan);
  if (r1.length === 0) return refuse('no_lanes', r1.refusals.length > 0 ? { refused: r1.refusals.map(function (x) { return x.reason; }) } : {});

  const startMs = num(o.now) ? o.now : nowReal;
  const budgetMs = num(o.budgetMs) && o.budgetMs > 0 ? o.budgetMs : Math.min(plan.budget.time_budget_ms, BUDGETS.DEEP_TIME_BUDGET_MS);
  const specs = {};
  laneSpecs(plan).forEach(function (s) { specs[s.lane] = s; });
  const laneLeaves = {};
  const pending = [];
  r1.forEach(function (lane) {
    laneLeaves[lane.lane] = lane.leaf_ids.map(function (id) { return leafBrief(plan, id); });
    lane.queries.forEach(function (q) { pending.push(q); });
  });

  // 369.2-24: the field scan. ce_reserve is computed first because the scan spends the round cap.
  const ceReserveAtInit = (Number.isInteger(o.ceReserve) && o.ceReserve >= 0) ? o.ceReserve : computeCeReserve(plan);
  const scan = scanQueries(plan, r1, Math.max(0, plan.budget.max_searches - ceReserveAtInit));
  const roundZero = scan.run.length > 0;

  const state = {
    schema: STATE_SCHEMA,
    run_id: plan.run_id,
    plan_hash: planMod.planHash(plan),
    trigger: 'navigator',
    started_ms: startMs,
    budget_ms: budgetMs,
    step: 'fetch_round',
    round: 1,
    max_rounds: plan.budget.rounds,
    grant_ref: { grant_id: onDisk.grant_id, lifetime: onDisk.lifetime, version: onDisk.version },
    lanes: r1.map(function (l) { return specs[l.lane]; }),
    lane_specs: specs,
    lane_leaves: laneLeaves,
    lane_order: r1.map(function (l) { return l.lane; }),
    round_lanes: { 1: r1.map(function (l) { return l.lane; }) },
    pending: pending,
    pending_after_extend: null,
    expected: [],
    recorded: {},
    correction: {},
    validated_round: null,
    lane_results: [],
    executed: [],
    planned_round_one: pending.map(function (q) { return { template_id: q.template_id, q_hash: q.q_hash, role: q.role, leaf_id: q.leaf_ids[0] }; }),
    searches_used: 0,
    max_searches_base: plan.budget.max_searches,
    // 369.2-15: the test seam opts.ceReserve (a non-negative integer) overrides the computed reserve
    ce_reserve: ceReserveAtInit,
    remaining_usd: null,
    next_cost_usd: null,
    seen_record_ids: {},
    seen_row_keys: {},
    round_new: { ids: 0, rows: 0 },
    extensions: [],
    stop_reason: null,
    extend_ctx: null,
    ce: { queries: [], fetched: false, recorded: false, run: false, skipped: false, skipped_reason: null, gaps: [], partial: false, lane_leaves: [] },
    trigger_note: 'navigator_started',
  };
  // HARNESS-02: every promised operation has a row BEFORE anything is dispatched. A fresh init is a fresh
  // run, so it starts a fresh ledger just as it starts fresh state.
  if (roundZero) {
    // round 0 is the field scan: one lane BL over the leaves of every limiter. Round one is composed and kept
    // for after round 0, so the re-rank can reorder it; round 0 never counts as a round of the plan.
    state.round = 0;
    state.round_one_pending = pending;
    state.pending = scan.run.slice();
    state.round_lanes = { 0: [BL_LANE], 1: r1.map(function (l) { return l.lane; }) };
    state.lane_specs[BL_LANE] = { lane: BL_LANE, kind: 'baseline', leaf_ids: scan.leafIds.slice() };
    state.lane_leaves[BL_LANE] = scan.leafIds.map(function (id) { return leafBrief(plan, id); });
    state.lane_order = [BL_LANE].concat(state.lane_order);
    state.perspective_baseline = null;
    state.baseline_ranking = null;
  }
  const ledger = operations.createLedger(plan.run_id, state.plan_hash);
  seedDeepLedger(ledger, plan, r1, scan);
  try {
    atomicWriteJson(path.join(runAbs(roomDir, plan.run_id), 'plan.json'), plan);
    operations.writeLedger(roomDir, ledger);
    saveState(roomDir, state);
  } catch (e) {
    return refuse('state_write_failed', { detail: String((e && e.message) || e) });
  }
  if (o.recordInLedger !== false) {
    try { grants.recordRun(roomDir, { run_id: plan.run_id, mode: 'deep', trigger: 'navigator', delta_hash: null, now: nowReal }); } catch (_e) { /* ledger failure never blocks the run */ }
  }
  return { ok: true, run_id: plan.run_id, state: state };
}

// ---------------------------------------------------------------------------
// fetching (shared by fetchRound and runCounterevidence)
// ---------------------------------------------------------------------------
function withDeadline(promise, ms) {
  return new Promise(function (resolve) {
    const t = setTimeout(function () { resolve({ timedOut: true }); }, Math.max(0, ms));
    promise.then(function (value) { clearTimeout(t); resolve({ value: value }); }, function (error) { clearTimeout(t); resolve({ error: error }); });
  });
}

function metaOf(res) {
  return (res && isObj(res.meta)) ? res.meta : ((res && res.envelope && isObj(res.envelope.meta)) ? res.envelope.meta : null);
}
function hasCount(meta) { return isObj(meta) && num(meta.count); }

function classify(res, topRows) {
  const meta = metaOf(res);
  const env = res && res.envelope;
  const cacheHit = !!res && res.reason === 'cache_hit';
  const out = {
    outcome: 'failed', failure_class: null,
    count: hasCount(meta) ? meta.count : null,
    cost_usd: meta && num(meta.cost_usd) ? meta.cost_usd : null,
    remaining_usd: meta && num(meta.remaining_usd) ? meta.remaining_usd : null,
    x_query: meta && typeof meta.x_query === 'string' ? meta.x_query : null,
    cache_hit: cacheHit, items: [], budget_stop: false,
  };
  if (!res || res.status === 'error' || res.status === 'skipped') {
    out.outcome = env && env.status === 'blocked' ? 'blocked' : 'failed';
    out.failure_class = (env && typeof env.failure_class === 'string' && env.failure_class) || 'unknown_error';
    if (out.outcome === 'blocked' || out.failure_class === 'spend_limit_exceeded') out.budget_stop = true;
    if (env && (/budget_exhausted/.test(String(env.error || '')) || (isObj(env.payload) && env.payload.reason === 'budget_exhausted'))) out.budget_stop = true;
    if (meta && num(meta.remaining_usd) && meta.remaining_usd <= 0) out.budget_stop = true;
    return out;
  }
  out.items = list(res.items).slice(0, topRows);
  if (cacheHit) { out.outcome = 'cache_hit'; out.cost_usd = 0; }
  else out.outcome = (env && env.status === 'empty_valid') || out.items.length === 0 ? 'empty_valid' : 'ok';
  return out;
}

function appendLaneRecords(roomDir, runId, lane, records) {
  const file = lanePath(roomDir, runId, lane, 'records');
  const cur = readJson(file, null);
  const body = isObj(cur) && Array.isArray(cur.records) ? cur : { schema: 'mos.research-records/1', run_id: runId, lane: lane, records: [] };
  records.forEach(function (r) { body.records.push(r); });
  atomicWriteJson(file, body);
}

function laneRecords(roomDir, runId, lane) {
  const cur = readJson(lanePath(roomDir, runId, lane, 'records'), null);
  return isObj(cur) && Array.isArray(cur.records) ? cur.records : [];
}

// executeQueries: runs queries in order; mutates state; returns {aborted} or {ok:true}.
async function executeQueries(roomDir, state, plan, queries, opts, ceMode) {
  const o = isObj(opts) ? opts : {};
  const topRows = plan.budget.results_per_query;
  const inner = typeof o.fetchEnvelopeFn === 'function' ? o.fetchEnvelopeFn : corpus.fetchCorpusEnvelope;
  const envelopeFn = function (args) { return inner({ source: PROVIDER, query: args.query, limit: topRows }); };
  const cacheFn = typeof o.cacheFn === 'function' ? o.cacheFn : sourceLensDriver.fetchSourceCached;

  // --offline sends nothing (369.2-05): the web searches have no policy line since 2026-10-05, so
  // the flag is read directly at the one deep fetch door, before any fetch
  if (queries.length > 0 && o.offline === true) return { aborted: 'offline' };

  // HARNESS-02: the ledger row exists before the fetch; a transition sits next to the push below, and every
  // query this pass does not reach is closed with the reason the pass stopped (never left to vanish)
  const ledger = ledgerFor(roomDir, state);
  const stopAt = function (i, reason) {
    closeRest(ledger, plan, queries, i, reason, dimOf);
    operations.writeLedger(roomDir, ledger);
    return { ok: true };
  };
  queries.forEach(function (q) { ensureOp(ledger, plan, q, dimOf(q)); });

  for (let i = 0; i < queries.length; i += 1) {
    const q = queries[i];
    const elapsed = Date.now() - state.started_ms;
    if (elapsed >= state.budget_ms) { state.stop_reason = state.stop_reason || 'time'; return stopAt(i, 'time'); }
    if (num(state.remaining_usd) && num(state.next_cost_usd) && state.remaining_usd < state.next_cost_usd) {
      state.stop_reason = state.stop_reason || 'budget';
      return stopAt(i, 'budget_usd');
    }
    const grant = activeGrant(roomDir, state, Date.now(), { forCounterevidence: ceMode === true });
    const v = checkQuery(roomDir, q, grant, state.searches_used, Date.now());
    if (!v.ok) {
      if (v.reason === 'cap_exceeded') {
        state.stop_reason = state.stop_reason || 'budget';
        if (ceMode !== true) state.round_cap_stop = true;
        return stopAt(i, 'search_cap');
      }
      operations.writeLedger(roomDir, ledger);
      return { aborted: v.reason };
    }

    let cacheRoom = roomDir;
    let restock = false;
    try {
      const cached = researchCache.getCachedEntry(roomDir, SOURCE_ID, q.q);
      if (cached && !hasCount(cached.meta)) { cacheRoom = ''; restock = true; }
    } catch (_e) { /* a cache read failure falls through to a live fetch */ }

    const t0 = Date.now();
    const waited = await withDeadline(cacheFn(SOURCE_ID, q.q, cacheRoom, envelopeFn), state.budget_ms - elapsed);
    const latency = Date.now() - t0;

    // 369.2-15: the stop is read from THIS query, not from state.stop_reason, which a round cut at the round cap
    // may already carry into the counterevidence pass
    let passStop = null;
    let info;
    if (waited.timedOut) {
      info = { outcome: 'failed', failure_class: 'network_timeout', count: null, cost_usd: null, remaining_usd: null, x_query: null, cache_hit: false, items: [], budget_stop: false };
      state.stop_reason = state.stop_reason || 'time';
      passStop = 'time';
    } else if (waited.error) {
      info = { outcome: 'failed', failure_class: 'unknown_error', count: null, cost_usd: null, remaining_usd: null, x_query: null, cache_hit: false, items: [], budget_stop: false };
    } else {
      info = classify(waited.value, topRows);
      if (restock && (info.outcome === 'ok' || info.outcome === 'empty_valid')) {
        try { researchCache.putCached(roomDir, SOURCE_ID, q.q, info.items, { meta: metaOf(waited.value) }); } catch (_e) { /* ignore */ }
      }
      if (info.budget_stop) { state.stop_reason = state.stop_reason || 'budget'; passStop = 'budget'; }
    }

    const itemList = info.items;
    const hashes = itemList.map(function (it) { return evidenceRows.contentHash(it); });
    const failed = info.outcome === 'failed' || info.outcome === 'blocked';
    const auditTs = iso(Date.now());
    const audit = auditLedger.appendAudit(roomDir, {
      ts: auditTs,
      run_id: state.run_id,
      grant_id: String(grant.grant_id),
      grant_version: grant.version,
      q: q.q,
      q_hash: q.q_hash,
      template_id: q.template_id,
      family: q.family,
      part8_verdict: q.audit === 'pass' ? 'pass' : (q.audit === 'not_applicable' ? 'not_applicable' : 'tripped'),
      provider: PROVIDER,
      filters: {},
      pagination: { per_page: topRows, page: 1 },
      fallback_used: false,
      origin_ref: state.run_id + '/' + q.lane,
      result_ids: itemList.map(function (it) { return String(it.id); }),
      content_hashes: hashes,
      outcome: info.outcome,
      failure_class: failed ? (info.failure_class || 'unknown_error') : null,
      count: info.count,
      cost_usd: info.cost_usd,
      remaining_usd: info.remaining_usd,
      x_query: info.x_query,
      latency_ms: latency,
    });
    if (!audit.ok) { operations.writeLedger(roomDir, ledger); return { aborted: 'audit_write_failed' }; }

    state.searches_used += 1;
    if (num(info.remaining_usd)) state.remaining_usd = info.remaining_usd;
    if (num(info.cost_usd) && info.cost_usd > 0) state.next_cost_usd = Math.max(num(state.next_cost_usd) ? state.next_cost_usd : 0, info.cost_usd);
    const op = ensureOp(ledger, plan, q, dimOf(q));
    const m = ledgerOutcome(info, itemList.length);
    settle(ledger, op, m.to, Object.assign({ audit_ref: { q_hash: q.q_hash, ts: auditTs }, cache_hit: info.cache_hit === true }, m.fields));
    operations.writeLedger(roomDir, ledger);
    state.executed.push({
      lane: q.lane, leaf_id: q.leaf_ids[0], leaf_ids: q.leaf_ids.slice(), template_id: q.template_id, family: q.family, role: q.role || null,
      q: q.q, q_hash: q.q_hash, round: q.round, outcome: info.outcome, failure_class: failed ? (info.failure_class || 'unknown_error') : null,
      count: info.count, cost_usd: info.cost_usd, latency_ms: latency, cache_hit: info.cache_hit, result_count: itemList.length,
    });
    const recs = itemList.map(function (it, idx) {
      return Object.assign({}, it, { record_id: String(it.id), content_hash: hashes[idx], q_hash: q.q_hash, round: q.round, leaf_ids: q.leaf_ids.slice() });
    });
    appendLaneRecords(roomDir, state.run_id, q.lane, recs);
    recs.forEach(function (r) {
      if (!state.seen_record_ids[r.record_id]) { state.seen_record_ids[r.record_id] = q.round; state.round_new.ids += 1; }
    });
    if (passStop) return stopAt(i + 1, passStop === 'time' ? 'time' : 'budget_usd');
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// fetchRound
// ---------------------------------------------------------------------------
async function fetchRound(roomDir, runId, opts) {
  const loaded = loadState(roomDir, runId);
  if (!loaded.ok) return loaded;
  const state = loaded.state;
  const plan = loaded.plan;
  if (state.step !== 'fetch_round') return refuse('wrong_step', { step: state.step });
  const grant = activeGrant(roomDir, state, Date.now());
  if (!grant) return refuse('no_grant');

  // Pre-pass: every query in the round is checked before the first fetch. A
  // cap hit truncates the round (a budget stop); anything else refuses it whole.
  const pending = state.pending;
  let allowed = pending.length;
  for (let i = 0; i < pending.length; i += 1) {
    const v = checkQuery(roomDir, pending[i], grant, state.searches_used + i, Date.now());
    if (!v.ok) {
      if (v.reason === 'cap_exceeded') { allowed = i; break; }
      return refuse(v.reason, { query_index: i });
    }
  }
  const truncated = allowed < pending.length;
  const run = pending.slice(0, allowed);

  state.round_new = { ids: 0, rows: 0 };
  const before = state.executed.length;
  const res = await executeQueries(roomDir, state, plan, run, opts);
  if (res.aborted) { saveState(roomDir, state); return refuse(res.aborted); }
  if (truncated) {
    state.stop_reason = state.stop_reason || 'budget';
    state.round_cap_stop = true;
    // the round was cut at the search cap: the queries it never reached are not_executed with reason search_cap
    const cutLedger = ledgerFor(roomDir, state);
    closeRest(cutLedger, plan, pending, allowed, 'search_cap', dimOf);
    operations.writeLedger(roomDir, cutLedger);
  }
  state.pending = [];

  // Lanes with no records are recorded as searched-not-found; the rest go to the analysts.
  const laneIds = state.round_lanes[state.round] || [];
  state.expected = [];
  laneIds.forEach(function (lane) {
    const n = laneRecords(roomDir, runId, lane).filter(function (r) { return r.round === state.round; }).length;
    if (n === 0) {
      state.recorded[state.round + ':' + lane] = true;
      // 369.2-20: the closure carries its reason and time, so a later record call can say it is closed
      state.lane_results.push({ lane: lane, round: state.round, records: 0, rows_kept: 0, dropped_total: 0, searched_not_found: true, closed_at: iso(Date.now()), closed_reason: 'empty_fetch' });
    } else {
      state.expected.push(lane);
    }
  });
  state.step = state.expected.length > 0 ? 'dispatch_lanes' : 'validate';
  saveState(roomDir, state);
  return { ok: true, round: state.round, executed: state.executed.length - before, stop_reason: state.stop_reason, next_step: state.step };
}

// ---------------------------------------------------------------------------
// lanePayload
// ---------------------------------------------------------------------------
function lanePayload(state, lane) {
  const leaves = lane === CE_LANE ? list(state.ce && state.ce.lane_leaves) : list(state.lane_leaves && state.lane_leaves[lane]);
  return {
    run_id: state.run_id,
    lane: lane,
    round: state.round,
    records_path: laneRel(state.run_id, lane, 'records'),
    leaves: leaves.map(function (l) { return { leaf_id: l.leaf_id, question: l.question, falsifier: l.falsifier }; }),
  };
}

// ---------------------------------------------------------------------------
// rows
// ---------------------------------------------------------------------------
function sumDropped(a, b) {
  const out = Object.assign({}, a);
  Object.keys(b || {}).forEach(function (k) { out[k] = (num(out[k]) ? out[k] : 0) + (num(b[k]) ? b[k] : 0); });
  return out;
}

function allLanes(state) { return state.lane_order.concat(state.ce.lane_leaves.length > 0 || state.ce.fetched ? [CE_LANE] : []); }

function readAllRows(roomDir, state) {
  let rows = [];
  let dropped = {};
  allLanes(state).forEach(function (lane) {
    const f = readJson(lanePath(roomDir, state.run_id, lane, 'rows'), null);
    if (isObj(f)) { rows = rows.concat(list(f.rows)); dropped = sumDropped(dropped, f.dropped); }
  });
  return { rows: rows, dropped: dropped };
}

function readAllRecords(roomDir, state) {
  let recs = [];
  allLanes(state).forEach(function (lane) {
    laneRecords(roomDir, state.run_id, lane).forEach(function (r) { recs.push(Object.assign({ lane: lane }, r)); });
  });
  return recs;
}

function researchableIds(plan) {
  return list(plan.leaves).filter(function (l) { return l && l.researchable === true; }).map(function (l) { return l.id; });
}

// closedEmptyLane: the lane_results entry of a lane an empty fetch closed this round (369.2-20), or null
function closedEmptyLane(state, lane) {
  const hit = list(state.lane_results).filter(function (x) {
    return isObj(x) && x.lane === lane && x.round === state.round && x.searched_not_found === true && x.records === 0;
  })[0];
  return hit || null;
}

// correctionRows: the one corrective record call (369.2-20, SW-13). A lane that recorded rows which dropped as
// unverified_quote gets exactly one more call, before the validate step runs, limited to the record ids that
// dropped. Returns the canonical record ids of the rows, or null when the call is not a valid correction.
function correctionWindow(state, lane, rawRows, index) {
  if (state.step !== 'dispatch_lanes' && state.step !== 'validate') return null;
  if (state.validated_round === state.round) return null;
  const win = isObj(state.correction) ? state.correction[state.round + ':' + lane] : null;
  if (!isObj(win) || win.used === true) return null;
  const rows = list(rawRows);
  if (rows.length === 0) return null;
  const allowed = {};
  list(win.record_ids).forEach(function (id) { allowed[id] = true; });
  const ok = rows.every(function (r) {
    if (!isObj(r) || typeof r.record_id !== 'string') return false;
    const e = index.get(r.record_id.trim()) || index.get(evidenceRows.bareId(r.record_id));
    return !!e && allowed[String(e.record.id).trim()] === true;
  });
  return ok ? win : null;
}

function recordLaneRows(roomDir, runId, lane, rawRows) {
  const loaded = loadState(roomDir, runId);
  if (!loaded.ok) return loaded;
  const state = loaded.state;
  const plan = loaded.plan;
  const isCE = lane === CE_LANE;
  let corrected = false;
  if (isCE) {
    if (state.step !== 'counterevidence' || !state.ce.fetched || state.ce.recorded) return refuse('wrong_step', { step: state.step });
  } else {
    const closedLane = closedEmptyLane(state, lane);
    if (closedLane) {
      return refuse('lane_already_closed', { lane: lane, closed_reason: closedLane.closed_reason || 'empty_fetch', closed_at: closedLane.closed_at || null });
    }
    const early = laneRecords(roomDir, runId, lane).filter(function (r) { return r.round === state.round; });
    if (state.recorded[state.round + ':' + lane] && state.expected.indexOf(lane) !== -1) {
      corrected = correctionWindow(state, lane, rawRows, evidenceRows.recordsIndex(early)) !== null;
      if (!corrected) return refuse('already_recorded');
    } else {
      if (state.step !== 'dispatch_lanes' || state.expected.indexOf(lane) === -1) return refuse('wrong_step', { step: state.step });
    }
  }
  const records = laneRecords(roomDir, runId, lane).filter(function (r) { return isCE || r.round === state.round; });
  const index = evidenceRows.recordsIndex(records);
  const code = isCE ? CE_LANE : laneCode(lane) + 'R' + state.round;
  const validated = evidenceRows.validateRows(list(rawRows), index, { leafIds: researchableIds(plan), lane: code, retrievedAt: iso(Date.now()) });

  const file = lanePath(roomDir, runId, lane, 'rows');
  const cur = readJson(file, null);
  const body = isObj(cur) && Array.isArray(cur.rows) ? cur : { schema: 'mos.research-rows/1', run_id: runId, lane: lane, rows: [], dropped: {} };
  validated.rows.forEach(function (r) {
    // a corrected row joins rows already stored for the lane, so its row_id continues the lane's numbering
    if (corrected) r.row_id = 'E-' + code + '-' + (body.rows.length + 1);
    body.rows.push(r);
    const key = r.leaf_id + '|' + r.record_id + '|' + r.label;
    if (!state.seen_row_keys[key]) { state.seen_row_keys[key] = true; state.round_new.rows += 1; }
  });
  body.dropped = sumDropped(body.dropped, validated.dropped);
  atomicWriteJson(file, body);

  const droppedTotal = Object.keys(validated.dropped).reduce(function (n, k) { return n + validated.dropped[k]; }, 0);
  const kept = validated.rows.length;
  const summary = { lane: lane, round: state.round, records: records.length, rows_kept: kept, dropped_total: droppedTotal, searched_not_found: kept === 0 };
  let allRecorded;
  if (corrected) {
    // the correction folds into the lane's one summary and spends the window
    const prev = list(state.lane_results).filter(function (x) { return isObj(x) && x.lane === lane && x.round === state.round; })[0];
    if (prev) {
      prev.rows_kept = (num(prev.rows_kept) ? prev.rows_kept : 0) + kept;
      prev.dropped_total = (num(prev.dropped_total) ? prev.dropped_total : 0) + droppedTotal;
      prev.searched_not_found = prev.rows_kept === 0;
    } else {
      state.lane_results.push(summary);
    }
    state.correction[state.round + ':' + lane].used = true;
    allRecorded = state.expected.every(function (l) { return state.recorded[state.round + ':' + l]; });
  } else if (isCE) {
    state.lane_results.push(summary);
    state.ce.recorded = true;
    state.ce.run = true;
    state.step = 'synthesize';
    allRecorded = true;
  } else {
    state.lane_results.push(summary);
    state.recorded[state.round + ':' + lane] = true;
    // 369.2-20: rows that dropped as unverified_quote open one correction window, limited to those record ids
    const droppedQuotes = validated.dropped_ids && Array.isArray(validated.dropped_ids.unverified_quote) ? validated.dropped_ids.unverified_quote : [];
    if (droppedQuotes.length > 0) {
      if (!isObj(state.correction)) state.correction = {};
      state.correction[state.round + ':' + lane] = { record_ids: droppedQuotes.filter(function (id, i) { return droppedQuotes.indexOf(id) === i; }), used: false };
    }
    allRecorded = state.expected.every(function (l) { return state.recorded[state.round + ':' + l]; });
    if (allRecorded) state.step = 'validate';
  }
  saveState(roomDir, state);
  const out = { ok: true, lane: lane, round: state.round, kept: kept, dropped: validated.dropped, searched_not_found: kept === 0, all_recorded: allRecorded, next_step: state.step };
  if (corrected) out.corrected = true;
  return out;
}

// ---------------------------------------------------------------------------
// roll-up helpers
// ---------------------------------------------------------------------------
function rollNow(plan, rows) {
  return pyramidMod.rollUp(plan.pyramid, plan.leaves, rows, {});
}

function limiterLeafIds(plan, lim) {
  return list(plan.leaves).filter(function (l) { return l.limiter_id === lim.id || l.id === lim.leaf_id; }).map(function (l) { return l.id; });
}

function diffusionSelected(plan) {
  return list(plan.pyramid && plan.pyramid.lenses_selected).indexOf('diffusion') !== -1;
}

// classifyOne(plan, lim, rows) -> classifyLimiter result over the limiter's own
// leaves (a limiter may own several). When the diffusion lens is selected and the
// limiter has no S-curve rows of its own, the df:timing rows inform the S-curve
// reading only (D-19).
function classifyOne(plan, lim, rows) {
  const ids = limiterLeafIds(plan, lim);
  const own = rows.filter(function (r) { return ids.indexOf(r.leaf_id) !== -1; });
  const copy = Object.assign({}, lim);
  delete copy.leaf_id;
  const c = perspectiveMod.classifyLimiter(copy, own);
  if (c.s_curve === 'unknown' && diffusionSelected(plan)) {
    const timingLeaves = list(plan.leaves).filter(function (l) { return l.dimension === 'df:timing'; }).map(function (l) { return l.id; });
    const timing = rows.filter(function (r) { return timingLeaves.indexOf(r.leaf_id) !== -1 && (r.label === 'scurve_ceiling' || r.label === 'scurve_headroom'); });
    if (timing.length > 0) {
      const c2 = perspectiveMod.classifyLimiter(copy, own.concat(timing));
      c.s_curve = c2.s_curve;
      c.advice = c2.advice;
      c.s_curve_row_ids = timing.map(function (r) { return r.row_id; });
    }
  }
  return c;
}

function whitespacePluralityRan(state) {
  return state.executed.some(function (q) { return q.role === 'falsifier_covered_elsewhere' && OK_OUTCOMES.indexOf(q.outcome) !== -1 && num(q.count); });
}

// ---------------------------------------------------------------------------
// round two (controller-composed defaults)
// ---------------------------------------------------------------------------
// Hashes and case-folded strings of every search already run (the cache folds
// case, so a re-worded-by-case search is the same search).
function executedHashes(state) {
  const seen = {};
  state.executed.forEach(function (q) { seen[q.q_hash] = true; seen['q:' + String(q.q).toLowerCase()] = true; });
  return seen;
}

function defaultRoundTwo(roomDir, state, plan) {
  const round = state.round + 1;
  const rows = readAllRows(roomDir, state).rows;
  const rolled = rollNow(plan, rows);
  const prev = state.round_lanes[state.round] || [];
  const seen = executedHashes(state);
  const perLane = plan.budget.queries_per_round;
  // 369.2-19: the extra lens lanes of a scientific-roadmapping plan get no round two of their own, so they do not
  // widen the half: the breadth of round two stays half the limiter lanes
  const halfOf = isSR(plan) ? prev.filter(function (ln) { return state.lane_specs[ln] && state.lane_specs[ln].kind === 'limiter'; }) : prev;
  const half = Math.ceil(halfOf.length / 2);
  const lanes = [];

  if (isSR(plan)) {
    prev.forEach(function (lane) {
      const spec = state.lane_specs[lane];
      if (!spec || spec.kind !== 'limiter' || !nonEmpty(spec.slot)) return;
      const lim = list(plan.perspective.limiters).filter(function (l) { return l.id === spec.limiter_id; })[0];
      if (!lim || classifyOne(plan, lim, rows).column !== 'assumed') return;
      const c = families.composeFamily(CI_FAMILY, { limiter: spec.slot }, { templateIds: ROUND_TWO_TEMPLATES.slice(), round: round });
      if (!c.ok) return;
      lanes.push({ lane: lane, leaf_ids: spec.leaf_ids, queries: c.queries });
    });
  } else {
    prev.forEach(function (lane) {
      const spec = state.lane_specs[lane];
      if (!spec) return;
      const qs = [];
      spec.leaf_ids.forEach(function (id) {
        const leaf = rolled.leaves.filter(function (l) { return l.id === id; })[0];
        if (!leaf || (leaf.status !== 'unresolved' && leaf.status !== 'contested' && leaf.status !== 'open')) return;
        const c = families.composeForLeaf({ lens: leaf.lens, slots: leaf.slots }, { round: round });
        if (c.ok) c.queries.forEach(function (q) { qs.push(q); });
      });
      if (qs.length > 0) lanes.push({ lane: lane, leaf_ids: spec.leaf_ids, queries: qs });
    });
  }

  const out = [];
  const claimed = {};
  lanes.slice(0, half).forEach(function (l) {
    const kept = [];
    l.queries.forEach(function (q) {
      if (kept.length >= perLane || seen[q.q_hash] || seen['q:' + q.q.toLowerCase()] || claimed[q.q_hash]) return;
      claimed[q.q_hash] = true;
      kept.push(shapeQuery(q, l.lane, l.leaf_ids, round));
    });
    kept.forEach(function (q) { out.push(q); });
  });
  return out;
}

// ---------------------------------------------------------------------------
// extend card (F.3)
// ---------------------------------------------------------------------------
function extendCard(state, newQueries, forCounterevidence, kind) {
  const qs = list(newQueries);
  const base = num(state.max_searches_base) ? state.max_searches_base : 0;
  const cap = forCounterevidence === true ? capNow(state, base) : roundCap(state);
  const used = num(state.searches_used) ? state.searches_used : 0;
  const promo = kind === 'baseline_promotion';
  const lines = [];
  // 369.2-30 (INPUT addendum 2, R23): the searches read by the move they make, never by template id or family id;
  // the payload below keeps the hashes. The wording for a promotion is final here (369.2-24 left a first draft).
  lines.push(promo ? '## Add searches for the limits the field scan moved up?' : '## Extend this deep run?');
  lines.push('');
  lines.push(promo
    ? 'The field scan changed which limits come first. These searches test limits that were not in the plan you approved.'
    : 'The run wants searches outside what you approved.');
  lines.push('');
  lines.push('New searches (none has been sent yet):');
  qs.forEach(function (q) {
    const move = Object.prototype.hasOwnProperty.call(jobLines.FAMILY_WORDS, q.family) ? jobLines.FAMILY_WORDS[q.family] : 'search';
    lines.push('- ' + move + ': ' + oneLine(q.q));
  });
  lines.push('');
  lines.push('Remaining cap: ' + Math.max(0, cap - used) + ' of ' + cap + ' searches (a cap, not a forecast).');
  lines.push('OpenAlex budget remaining: ' + (num(state.remaining_usd) ? '$' + state.remaining_usd + ' as last reported' : 'not reported') + ' (a cap, not a cost estimate).');
  lines.push(promo
    ? 'Approving adds these searches to this run only. Skipping goes on with the searches you approved.'
    : 'Approving extends this run only. Stopping synthesizes what is already on file.');
  return {
    shape: 'F.3',
    title: promo ? 'Add the searches the field scan moved up' : 'Extend or stop this deep run',
    question: promo ? 'Add these searches, or skip them?' : 'Run these searches, or stop here?',
    options: promo
      ? [
        { id: 'extend_run', label: 'Add these searches (this run only)', recommended: true },
        { id: 'stop_run', label: 'Skip them and go on with the approved searches' },
      ]
      : [
        { id: 'extend_run', label: 'Run these searches (this run only)', recommended: true },
        { id: 'stop_run', label: 'Stop here and synthesize what is on file' },
      ],
    body_md: noDash(lines.join('\n')),
    payload: { run_id: state.run_id, new_hashes: qs.map(function (q) { return q.q_hash; }), remaining_cap: Math.max(0, cap - used) },
  };
}

// ---------------------------------------------------------------------------
// transitions
// ---------------------------------------------------------------------------
function startRound(state, plan, queries) {
  state.round += 1;
  state.round_new = { ids: 0, rows: 0 };
  state.pending = queries;
  state.pending_after_extend = null;
  const lanes = uniq(queries.map(function (q) { return q.lane; }));
  lanes.forEach(function (lane) {
    if (!state.lane_specs[lane]) {
      const ids = uniq([].concat.apply([], queries.filter(function (q) { return q.lane === lane; }).map(function (q) { return q.leaf_ids; })));
      state.lane_specs[lane] = { lane: lane, kind: 'followup', leaf_ids: ids };
    }
    if (!state.lane_leaves[lane]) {
      state.lane_leaves[lane] = state.lane_specs[lane].leaf_ids.map(function (id) { return leafBrief(plan, id); });
    }
    if (state.lane_order.indexOf(lane) === -1) state.lane_order.push(lane);
  });
  state.round_lanes[state.round] = lanes;
  state.expected = [];
  state.step = 'fetch_round';
}

function nextAfterStop(roomDir, state, plan) {
  // 369.2-15: a round cut at the round cap (cap minus the counterevidence reserve) has not spent the reserve,
  // so the falsification pass still runs on it. A time or USD budget stop skips the pass as before.
  const reserveLeft = state.round_cap_stop === true && state.stop_reason === 'budget' && num(state.ce_reserve) && state.ce_reserve > 0 &&
    capNow(state, state.max_searches_base) - state.searches_used > 0;
  if ((state.stop_reason === 'budget' || state.stop_reason === 'time') && !reserveLeft) {
    state.step = 'synthesize';
    return;
  }
  prepareCounterevidence(roomDir, state, plan);
}

function templateOwner(templateId) {
  const ids = Object.keys(families.FAMILIES);
  for (let i = 0; i < ids.length; i += 1) {
    const t = families.FAMILIES[ids[i]].templates.filter(function (x) { return x.id === templateId; })[0];
    if (t) return { family: ids[i], template: t };
  }
  return null;
}

// slots for a template from the leaf, borrowing missing ones from sibling leaves
function pooledSlots(plan, leaf, template) {
  const slots = {};
  for (let i = 0; i < template.needs.length; i += 1) {
    const name = template.needs[i];
    let v = isObj(leaf.slots) ? leaf.slots[name] : undefined;
    if (v === undefined) {
      const other = list(plan.leaves).filter(function (l) { return isObj(l.slots) && l.slots[name] !== undefined; })[0];
      v = other ? other.slots[name] : undefined;
    }
    if (v === undefined) return null;
    slots[name] = v;
  }
  return slots;
}

function prepareCounterevidence(roomDir, state, plan) {
  const round = state.round + 1;
  const rows = readAllRows(roomDir, state).rows;
  const rolled = rollNow(plan, rows);
  const queries = [];
  const gaps = [];
  const leafById = {};
  rolled.leaves.forEach(function (l) { leafById[l.id] = l; });

  function add(c, leafIds, laneNote) {
    c.queries.forEach(function (q) {
      if (queries.some(function (x) { return x.q_hash === q.q_hash; })) return;
      const shaped = shapeQuery(q, CE_LANE, leafIds, round);
      shaped.note = laneNote;
      queries.push(shaped);
    });
  }

  // 369.2-17 (CODE-05): a goal target or an assumed limiter is composed only when it is term-shaped; a sentence
  // is a recorded gap (bad_slot:goal, bad_slot:limiter), never a quoted phrase
  if (isSR(plan) && nonEmpty(plan.perspective.goal && plan.perspective.goal.target)) {
    const goalLeaves = list(plan.leaves).filter(function (l) { return l.dimension === 'sr:goal'; }).map(function (l) { return l.id; });
    const goalTerm = families.composableDerivationTerm(plan.perspective.goal.target);
    const c = goalTerm === null ? null : families.composeFamily(CI_FAMILY, { limiter: goalTerm }, { templateIds: ['ci.derivation'], round: round });
    if (c && c.ok) add(c, goalLeaves.length > 0 ? goalLeaves : researchableIds(plan).slice(0, 1), 'goal_falsifier');
    else gaps.push({ branch: 'goal', reason: c ? c.reason : 'bad_slot:goal' });
  }
  rolled.pyramid.key_line.filter(function (k) { return k.status === 'supported'; }).forEach(function (k) {
    const leaf = list(k.leaf_ids).map(function (id) { return leafById[id]; }).filter(function (l) { return l && l.status === 'supported' && l.researchable && l.corpus === 'openalex'; })[0];
    const tid = leaf && isObj(leaf.falsifier) ? leaf.falsifier.template_id : null;
    const owner = nonEmpty(tid) ? templateOwner(tid) : null;
    const slots = owner ? pooledSlots(plan, leaf, owner.template) : null;
    const c = owner && slots ? families.composeFamily(owner.family, slots, { templateIds: [tid], round: round }) : null;
    if (c && c.ok) add(c, [leaf.id], 'branch_falsifier');
    else gaps.push({ branch: k.label, reason: c ? c.reason : 'no_falsifier_template' });
  });
  if (isSR(plan)) {
    perspectiveMod.rankByUnlock(workingPerspective(plan, state.perspective_baseline), {}).forEach(function (r) {
      const lim = list(plan.perspective.limiters).filter(function (l) { return l.id === r.limiter_id; })[0];
      if (!lim || classifyOne(plan, lim, rows).column !== 'assumed' || !nonEmpty(lim.statement)) return;
      const limTerm = families.composableDerivationTerm(lim.statement);
      const c = limTerm === null ? null : families.composeFamily(CI_FAMILY, { limiter: limTerm }, { templateIds: ['ci.derivation'], round: round });
      if (c && c.ok) add(c, limiterLeafIds(plan, lim), 'limiter_derivation');
      else gaps.push({ branch: lim.id, reason: c ? c.reason : 'bad_slot:limiter' });
    });
  }

  // Never repeat a search already run; keep within the remaining cap.
  const seen = executedHashes(state);
  let fresh = queries.filter(function (q) { return !seen[q.q_hash] && !seen['q:' + q.q.toLowerCase()]; });
  const remaining = Math.max(0, capNow(state, state.max_searches_base) - state.searches_used);
  let cutByCap = [];
  if (fresh.length > remaining) {
    cutByCap = fresh.slice(remaining);
    cutByCap.forEach(function (q) { gaps.push({ branch: q.note, reason: 'over_cap' }); });
    fresh = fresh.slice(0, remaining);
  }
  // HARNESS-02: every counterevidence operation has a row before the pass runs; a branch the search cap cut
  // is not_executed with reason search_cap, and a branch the composer could not compose is a closed op too
  const ceLedger = ledgerFor(roomDir, state);
  fresh.forEach(function (q) { ensureOp(ceLedger, plan, q, ceDimension(q)); });
  cutByCap.forEach(function (q) {
    const op = ensureOp(ceLedger, plan, q, ceDimension(q));
    if (!isTermState(op.state)) operations.transition(ceLedger, op.operation_id, 'not_executed', { reason: 'search_cap' });
  });
  gaps.forEach(function (g) {
    if (g.reason === 'over_cap') return;
    const fields = { dimension: 'CE:' + String(g.branch), label: oneLine(g.branch).slice(0, 120), kind: 'falsifier', round: round, template: 'ce:gap' };
    if (g.reason === 'no_falsifier_template') closedOp(ceLedger, plan, fields, 'not_executed', 'no_query_composed');
    else closedOp(ceLedger, plan, fields, 'refused_before_fetch', refusalReason({ reason: g.reason, slot: null }));
  });
  operations.writeLedger(roomDir, ceLedger);
  state.ce.gaps = gaps;
  state.ce.lane_leaves = uniq([].concat.apply([], fresh.map(function (q) { return q.leaf_ids; }))).map(function (id) { return leafBrief(plan, id); });

  const grant = activeGrant(roomDir, state, Date.now(), { forCounterevidence: true });
  const need = [];
  fresh.forEach(function (q, i) {
    const v = checkQuery(roomDir, q, grant, state.searches_used + i, Date.now());
    if (!v.ok && (v.reason === 'outside_family' || v.reason === 'provider_not_in_policy')) need.push(q);
  });
  if (need.length > 0) {
    state.extend_ctx = { kind: 'counterevidence', new_queries: need, all: fresh, cap_lift: 0 };
    state.extend_ctx.card = extendCard(state, need, true);
    state.step = 'extend_card';
    return;
  }
  state.ce.queries = fresh;
  state.step = 'counterevidence';
}

// ---------------------------------------------------------------------------
// nextDeepStep
// ---------------------------------------------------------------------------
// validateRoundZero: the field scan is read. Each limiter gets its verdict, rankByUnlock re-runs with it, and
// round one starts in the new order (a lane promoted outside the approved set goes through the extend card).
// Round 0 runs none of the round stop checks: it is not a round of the plan.
function validateRoundZero(roomDir, state, plan, payload) {
  payload.round = 0;
  state.validated_round = 0;
  const verdicts = baselineVerdicts(roomDir, state, plan);
  state.perspective_baseline = verdicts;
  const ranking = perspectiveMod.rankByUnlock(workingPerspective(plan, verdicts), {}).map(function (r) { return r.limiter_id; });
  state.baseline_ranking = ranking;
  payload.baseline = verdicts;
  payload.stop_reason = state.stop_reason;
  if (state.stop_reason) {
    nextAfterStop(roomDir, state, plan);
    payload.next_step = state.step;
    return payload;
  }
  state.round_one_pending = stableByLane(state, list(state.round_one_pending), function (q) { return q.lane; }, ranking);
  const promo = promotionQueries(state, plan, ranking);
  if (promo.queries.length > 0) {
    state.extend_ctx = { kind: 'baseline_promotion', new_queries: promo.queries, all: promo.queries, specs: promo.specs, cap_lift: 0 };
    state.extend_ctx.card = extendCard(state, promo.queries, false, 'baseline_promotion');
    state.step = 'extend_card';
  } else {
    beginRoundOne(state, plan, [], []);
  }
  payload.next_step = state.step;
  return payload;
}

function runValidate(roomDir, state, plan) {
  const payload = { round: state.round, new_record_ids: state.round_new.ids, new_rows: state.round_new.rows, stop_reason: null };
  if (state.round === 0) return validateRoundZero(roomDir, state, plan, payload);
  if (!state.stop_reason) {
    if (isWhitespace(plan) && !whitespacePluralityRan(state)) state.stop_reason = 'plurality_required';
    else if (state.round_new.ids === 0 && state.round_new.rows === 0) state.stop_reason = 'saturation';
    else if (state.round >= state.max_rounds) state.stop_reason = 'cap';
  }
  payload.stop_reason = state.stop_reason;
  // 369.2-20: validate has run for this round, so every correction window of the round is closed
  state.validated_round = state.round;
  if (!state.stop_reason) state.step = 'reflect';
  else nextAfterStop(roomDir, state, plan);
  payload.next_step = state.step;
  return payload;
}

function reflectPayload(roomDir, state, plan) {
  const all = readAllRows(roomDir, state);
  const rolled = rollNow(plan, all.rows);
  const cited = {};
  all.rows.forEach(function (r) { cited[r.record_id] = true; });
  const digest = [];
  readAllRecords(roomDir, state).forEach(function (r) {
    if (cited[r.record_id] || digest.some(function (d) { return d.record_id === r.record_id; })) return;
    if (digest.length < DIGEST_CAP) digest.push({ record_id: r.record_id, lane: r.lane, title: oneLine(r.title || '').slice(0, 120) });
  });
  return {
    round: state.round,
    leaves_open: rolled.leaves.filter(function (l) { return l.researchable && (l.status === 'unresolved' || l.status === 'contested'); }).map(function (l) { return l.id; }),
    unused_records_digest: digest,
  };
}

function nextDeepStep(roomDir, runId) {
  const loaded = loadState(roomDir, runId);
  if (!loaded.ok) return loaded;
  const state = loaded.state;
  const plan = loaded.plan;
  let payload = {};
  let reported = state.step;
  switch (state.step) {
    case 'fetch_round': {
      const lanes = [];
      state.pending.forEach(function (q) {
        let e = lanes.filter(function (x) { return x.lane === q.lane; })[0];
        if (!e) { e = { lane: q.lane, leaf_id: q.leaf_ids[0], queries: [] }; lanes.push(e); }
        e.queries.push(q.q_hash);
      });
      payload = { round: state.round, lanes: lanes };
      break;
    }
    case 'dispatch_lanes':
      payload = { lanes: state.expected.filter(function (l) { return !state.recorded[state.round + ':' + l]; }).map(function (l) { return lanePayload(state, l); }) };
      break;
    case 'validate':
      payload = runValidate(roomDir, state, plan);
      saveState(roomDir, state);
      break;
    case 'reflect':
      payload = reflectPayload(roomDir, state, plan);
      break;
    case 'extend_card':
      payload = { card: state.extend_ctx.card, new_queries: state.extend_ctx.new_queries.map(function (q) { return { q: q.q, q_hash: q.q_hash, template_id: q.template_id, family: q.family }; }) };
      break;
    case 'counterevidence':
      payload = { queries: state.ce.queries.map(function (q) { return { q: q.q, q_hash: q.q_hash, template_id: q.template_id, family: q.family, leaf_ids: q.leaf_ids }; }) };
      break;
    default:
      payload = {};
  }
  return { ok: true, step: reported, round: state.round, stop_reason: state.stop_reason, payload: payload };
}

// ---------------------------------------------------------------------------
// proposeFollowups
// ---------------------------------------------------------------------------
function laneOfLeaf(state, leafId) {
  const ids = Object.keys(state.lane_specs);
  for (let i = 0; i < ids.length; i += 1) {
    if (state.lane_specs[ids[i]].leaf_ids.indexOf(leafId) !== -1) return ids[i];
  }
  return null;
}

function proposeFollowups(roomDir, runId, followups) {
  const loaded = loadState(roomDir, runId);
  if (!loaded.ok) return loaded;
  const state = loaded.state;
  const plan = loaded.plan;
  if (state.step !== 'reflect') return refuse('wrong_step', { step: state.step });
  const round = state.round + 1;
  const defaults = defaultRoundTwo(roomDir, state, plan);
  const known = {};
  Object.keys(executedHashes(state)).forEach(function (h) { known[h] = true; });
  defaults.forEach(function (q) { known[q.q_hash] = true; });

  const rejected = [];
  const fu = [];
  const ids = researchableIds(plan);
  list(followups).forEach(function (f) {
    if (!isObj(f) || ids.indexOf(f.leaf_id) === -1 || !nonEmpty(f.lens) || !isObj(f.slots)) { rejected.push({ reason: 'bad_followup' }); return; }
    const c = families.composeForLeaf({ lens: f.lens, slots: f.slots }, { round: round });
    if (!c.ok) { rejected.push({ reason: c.reason }); return; }
    const lane = laneOfLeaf(state, f.leaf_id) || FOLLOWUP_LANE;
    c.queries.forEach(function (q) {
      if (known[q.q_hash] || known['q:' + q.q.toLowerCase()]) return;
      known[q.q_hash] = true;
      fu.push(shapeQuery(q, lane, [f.leaf_id], round));
    });
  });

  // Defaults are the controller's own in-family plan: trim them to the cap.
  const grant = activeGrant(roomDir, state, Date.now());
  const capLeft = Math.max(0, roundCap(state) - state.searches_used);
  const keptDefaults = defaults.slice(0, capLeft);
  const need = [];
  const runnable = [];
  fu.forEach(function (q) {
    const at = state.searches_used + keptDefaults.length + runnable.length;
    const v = checkQuery(roomDir, q, grant, at, Date.now());
    if (v.ok) runnable.push(q);
    else if (v.reason === 'outside_family' || v.reason === 'provider_not_in_policy' || v.reason === 'cap_exceeded') need.push({ q: q, reason: v.reason });
    else rejected.push({ reason: v.reason });
  });
  const combined = keptDefaults.concat(runnable);
  // HARNESS-02: round-two and follow-up operations have rows before they are dispatched; the default
  // round-two searches the cap trimmed are not_executed with reason search_cap
  const fuLedger = ledgerFor(roomDir, state);
  combined.forEach(function (q) { ensureOp(fuLedger, plan, q, null); });
  need.forEach(function (n) { ensureOp(fuLedger, plan, n.q, null); });
  defaults.slice(capLeft).forEach(function (q) {
    const op = ensureOp(fuLedger, plan, q, null);
    if (!isTermState(op.state)) operations.transition(fuLedger, op.operation_id, 'not_executed', { reason: 'search_cap' });
  });
  operations.writeLedger(roomDir, fuLedger);
  if (need.length === 0 && combined.length === 0) {
    state.stop_reason = state.stop_reason || 'saturation';
    nextAfterStop(roomDir, state, plan);
    saveState(roomDir, state);
    return { ok: true, step: state.step, queued: 0, rejected: rejected };
  }
  if (need.length > 0) {
    const overCap = need.filter(function (n) { return n.reason === 'cap_exceeded'; }).length;
    const all = combined.concat(need.map(function (n) { return n.q; }));
    state.extend_ctx = { kind: 'followup', new_queries: need.map(function (n) { return n.q; }), all: all, cap_lift: overCap };
    state.extend_ctx.card = extendCard(state, state.extend_ctx.new_queries);
    state.pending_after_extend = all;
    state.step = 'extend_card';
    saveState(roomDir, state);
    return { ok: true, step: 'extend_card', card: state.extend_ctx.card, new_queries: state.extend_ctx.new_queries.map(function (q) { return { q: q.q, q_hash: q.q_hash }; }), rejected: rejected };
  }
  startRound(state, plan, combined);
  saveState(roomDir, state);
  return { ok: true, step: state.step, queued: combined.length, rejected: rejected };
}

// ---------------------------------------------------------------------------
// applyExtendDecision
// ---------------------------------------------------------------------------
function applyExtendDecision(roomDir, runId, decision, opts) {
  const loaded = loadState(roomDir, runId);
  if (!loaded.ok) return loaded;
  const state = loaded.state;
  const plan = loaded.plan;
  if (state.step !== 'extend_card' || !isObj(state.extend_ctx)) return refuse('wrong_step', { step: state.step });
  if (decision !== 'extend' && decision !== 'stop') return refuse('bad_decision');
  const ctx = state.extend_ctx;

  if (decision === 'extend') {
    const via = isObj(opts) ? opts.approved_via : null;
    if (!isApprovedVia(via)) return refuse('approval_required');
    const grant = activeGrant(roomDir, state, Date.now());
    const fams = uniq(ctx.new_queries.map(function (q) { return q.family; })).filter(function (f) { return !grant || grant.families.indexOf(f) === -1; });
    state.extensions.push({
      at: iso(Date.now()),
      approved_via: { surface: via.surface, decision_node_id: via.decision_node_id },
      kind: ctx.kind,
      hashes: ctx.new_queries.map(function (q) { return q.q_hash; }),
      families: fams,
      cap_lift: num(ctx.cap_lift) ? ctx.cap_lift : 0,
    });
    state.extend_ctx = null;
    if (ctx.kind === 'followup') {
      startRound(state, plan, ctx.all);
    } else if (ctx.kind === 'baseline_promotion') {
      // the promoted lanes are approved: their operations get rows before round one dispatches
      const promoLedger = ledgerFor(roomDir, state);
      list(ctx.all).forEach(function (q) { ensureOp(promoLedger, plan, q, null); });
      operations.writeLedger(roomDir, promoLedger);
      beginRoundOne(state, plan, ctx.specs, ctx.all);
    } else {
      state.ce.queries = ctx.all;
      state.step = 'counterevidence';
    }
  } else {
    state.extend_ctx = null;
    if (ctx.kind === 'baseline_promotion') {
      // skipped: the run goes on with the lanes the navigator approved, in the new order (it does not stop)
      beginRoundOne(state, plan, [], []);
    } else if (ctx.kind === 'followup') {
      state.stop_reason = state.stop_reason || 'navigator_stop';
      state.pending_after_extend = null;
      nextAfterStop(roomDir, state, plan);
    } else {
      state.ce.skipped = true;
      state.ce.skipped_reason = 'navigator_stop';
      state.stop_reason = state.stop_reason || 'navigator_stop';
      state.step = 'synthesize';
    }
  }
  saveState(roomDir, state);
  return { ok: true, step: state.step, stop_reason: state.stop_reason };
}

// ---------------------------------------------------------------------------
// runCounterevidence
// ---------------------------------------------------------------------------
async function runCounterevidence(roomDir, runId, opts) {
  const loaded = loadState(roomDir, runId);
  if (!loaded.ok) return loaded;
  const state = loaded.state;
  const plan = loaded.plan;
  if (state.step !== 'counterevidence') return refuse('wrong_step', { step: state.step });
  if (state.ce.fetched) return refuse('already_fetched');
  const queries = state.ce.queries;
  const before = state.executed.length;
  state.round_new = { ids: 0, rows: 0 };
  const res = await executeQueries(roomDir, state, plan, queries, opts, true);
  if (res.aborted) { saveState(roomDir, state); return refuse(res.aborted); }
  const executed = state.executed.length - before;
  if (executed < queries.length) state.ce.partial = true;
  const gotRecords = laneRecords(roomDir, runId, CE_LANE).length > 0;
  if (executed === 0 || !gotRecords) {
    // nothing to read: the pass ran (or was cut off) with no records for an analyst
    state.ce.fetched = true;
    state.ce.recorded = true;
    // 369.2-15 (T-369.2-15-01): an empty pass never reads as a pass that ran
    state.ce.run = executed > 0;
    state.lane_results.push({ lane: CE_LANE, round: state.round, records: 0, rows_kept: 0, dropped_total: 0, searched_not_found: true });
    state.step = 'synthesize';
    saveState(roomDir, state);
    return { ok: true, executed: executed, lane_payload: null, stop_reason: state.stop_reason, next_step: state.step };
  }
  state.ce.fetched = true;
  saveState(roomDir, state);
  return { ok: true, executed: executed, lane_payload: lanePayload(state, CE_LANE), stop_reason: state.stop_reason, next_step: state.step };
}

// ---------------------------------------------------------------------------
// synthesize
// ---------------------------------------------------------------------------
function planTerms(plan) {
  const seen = {};
  const out = [];
  list(plan.leaves).forEach(function (leaf) {
    const s = isObj(leaf && leaf.slots) ? leaf.slots : {};
    [s.term].concat(list(s.synonyms)).filter(nonEmpty).forEach(function (t) {
      const k = t.trim().toLowerCase();
      if (!seen[k]) { seen[k] = true; out.push(t.trim()); }
    });
  });
  return out;
}

function synthesize(roomDir, runId) {
  const loaded = loadState(roomDir, runId);
  if (!loaded.ok) return loaded;
  const state = loaded.state;
  const plan = loaded.plan;
  if (state.step === 'done') {
    const prior = readJson(path.join(runAbs(roomDir, runId), 'run.json'), null);
    return isObj(prior) ? { ok: true, run: prior, state_dir: relRun(runId).split(path.sep).join('/'), already: true } : refuse('no_run');
  }
  if (state.step !== 'synthesize') {
    if (state.step === 'counterevidence' || (state.step === 'extend_card' && state.extend_ctx && state.extend_ctx.kind === 'counterevidence')) return refuse('counterevidence_not_run');
    return refuse('wrong_step', { step: state.step });
  }

  const all = readAllRows(roomDir, state);
  const rows = all.rows;
  const ws = isWhitespace(plan);
  const pluralityRan = ws ? whitespacePluralityRan(state) : true;
  const verdictByLeaf = {};
  if (ws && !pluralityRan) {
    list(plan.leaves).forEach(function (l) { if (l.dimension === 'ws:gap_claim') verdictByLeaf[l.id] = 'unresolved'; });
  }
  const rolled = pyramidMod.rollUp(plan.pyramid, plan.leaves, rows, { verdictByLeaf: verdictByLeaf });

  let governing = rolled.governing_status;
  let wsVerdict = null;
  if (ws) {
    wsVerdict = verdictMod.computeQuickVerdict({
      queries: state.executed.filter(function (q) { return q.round === 1; }),
      planned: state.planned_round_one,
      rows: rows, leaves: plan.leaves, template: plan.pyramid.template_id,
    });
    const byVerdict = { 'gap-confirmed': 'strengthened', settled: 'weakened', contested: 'split', thin: 'unresolved', unresolved: 'unresolved' };
    governing = byVerdict[wsVerdict.verdict] || governing;
    if (!pluralityRan) governing = 'unresolved';
    rolled.pyramid.governing_status = governing;
  }

  // limiters: classify, update the perspective, rank, name the next binding constraint
  const updated = clone(plan.perspective);
  // 369.2-24: the field-scan verdict stays on the limiter, so the ranking, the next binding constraint and the
  // filed record can say a limiter the field already refuted is not an open wall
  if (isObj(state.perspective_baseline)) {
    list(updated.limiters).forEach(function (lim) { lim.baseline = state.perspective_baseline[lim.id] === undefined ? null : state.perspective_baseline[lim.id]; });
  }
  const classifications = [];
  const support = {};
  list(updated.limiters).forEach(function (lim) {
    const c = classifyOne(plan, lim, rows);
    lim.column = c.column;
    lim.s_curve = c.s_curve;
    lim.derivation_row_id = c.column === 'physics' && c.basis_row_ids.length > 0 ? c.basis_row_ids[0] : null;
    support[lim.id] = c.basis_row_ids.length;
    classifications.push({ limiter_id: lim.id, statement: lim.statement, path_id: lim.path_id || null, column: c.column, s_curve: c.s_curve, advice: c.advice, basis_row_ids: c.basis_row_ids, reason: c.reason });
  });
  updated.ranking = perspectiveMod.rankByUnlock(updated, { supportByLimiter: support }).map(function (r) { return r.limiter_id; });
  const nb = perspectiveMod.nextBindingConstraint(updated);
  updated.next_binding_constraint = nb ? nb.id : null;
  const nextVer = perspectiveMod.nextVersion(plan, {
    run_id: runId,
    classifications: classifications.map(function (c) { return { limiter_id: c.limiter_id, column: c.column, basis_row_ids: c.basis_row_ids }; }),
    discarded: [],
  });

  const opportunities = pyramidMod.opportunityCandidates(rolled.pyramid, rolled.leaves, rows, { perspective: updated, verdict: wsVerdict ? wsVerdict.verdict : undefined });

  const unresolved = rolled.unresolved_branches.slice();
  // 369.2-15 (C17): falsification work counts from operation ids across all rounds. A pass that added zero
  // searches because its branches already ran as round-one falsifiers is not a missing pass; a run where no
  // falsifier executed anywhere is (T-369.2-15-01).
  const ceEarly = operations.counterevidenceStatus(ledgerFor(roomDir, state), { needed: plan.budget.counterevidence === true });
  const ceRan = !!state.ce.run || ceEarly.executed > 0;
  // the unresolved flag stays for a run whose pass did not run unless every falsifier operation executed
  const ceNotRun = !state.ce.run && ceEarly.status !== 'complete' && ceEarly.status !== 'not_needed';
  if (ceNotRun) unresolved.push(CE_NOT_RUN);
  else if (state.ce.partial) unresolved.push('counterevidence incomplete');
  list(state.ce.gaps).forEach(function (g) { unresolved.push(oneLine(g.branch) + ' (counterevidence not composed: ' + oneLine(g.reason) + ')'); });

  const localChecks = [];
  list(plan.leaves).forEach(function (leaf) {
    if (!isObj(leaf) || leaf.researchable !== true || leaf.corpus !== 'room') return;
    const chk = quickMod.localRoomCheck(roomDir, planTerms(plan));
    localChecks.push({ leaf_id: leaf.id, kind: leaf.dimension === 'ws:extraction_failure' ? 'extraction_failure' : 'room_check', terms_checked: chk.terms_checked, artifact_count: chk.artifact_count, flagged: chk.flagged, artifacts: chk.artifacts });
  });

  const finishedMs = Date.now();
  const executedHashSet = executedHashes(state);
  const relDir = relRun(runId);
  const keptTotal = rows.length;
  const run = {
    schema: planMod.RUN_SCHEMA,
    run_id: runId,
    mode: 'deep',
    plan_hash: state.plan_hash,
    grant_ref: clone(state.grant_ref),
    trigger: 'navigator',
    started_at: iso(state.started_ms),
    finished_at: iso(finishedMs),
    stop_reason: state.stop_reason || 'cap',
    queries: clone(state.executed),
    records_path: path.join(relDir, 'records.json').split(path.sep).join('/'),
    rows: rows,
    dropped: all.dropped,
    leaves: rolled.leaves,
    verdict: null,
    answer_line: '',
    pyramid: rolled.pyramid,
    perspective: updated,
    governing_status: governing,
    unresolved_branches: unresolved,
    opportunity_candidates: opportunities,
    contradictions: rolled.contradictions,
    escalation_offer: null,
    local_checks: localChecks,
    timings: {
      total_ms: finishedMs - state.started_ms,
      budget_ms: state.budget_ms,
      per_query: state.executed.map(function (q) { return { q_hash: q.q_hash, latency_ms: q.latency_ms }; }),
      not_run: state.planned_round_one.filter(function (p) { return !executedHashSet[p.q_hash]; }).map(function (p) { return p.template_id; }),
    },
    filed: false,
    lanes: clone(state.lane_results),
    classifications: classifications,
    next_binding_constraint: nb ? nb.id : null,
    next_version: nextVer,
    weakest_branch: rolled.weakest_branch ? rolled.weakest_branch.label : null,
    // 369.2-15 (R06): status, planned, executed, failed and reasons are counted from operation ids across ALL
    // rounds (annex C17), filled below from the swept ledger; the old fields stay for existing readers
    counterevidence: { ran: ceRan, skipped: !!state.ce.skipped, skipped_reason: state.ce.skipped_reason, partial: !!state.ce.partial, queries: state.ce.queries.map(function (q) { return { template_id: q.template_id, q_hash: q.q_hash, leaf_ids: q.leaf_ids }; }), gaps: clone(state.ce.gaps) },
    extensions: clone(state.extensions),
  };
  // 369.2-14: close the ledger (every op still open becomes not_executed with the stop reason), then read
  // "complete" from it. A ledger file absent here is a run begun before the ledger: it reads as not complete.
  const opsLedger = ledgerFor(roomDir, state);
  operations.sweep(opsLedger, stopToSweepReason(state.stop_reason));
  run.operations = clone(opsLedger.operations);
  const ceNeeded = plan.budget.counterevidence === true;
  run.completion = operations.completion(opsLedger, { counterevidence_needed: ceNeeded });
  const ceStatus = operations.counterevidenceStatus(opsLedger, { needed: ceNeeded });
  run.counterevidence = Object.assign({ status: ceStatus.status, planned: ceStatus.planned, executed: ceStatus.executed, failed: ceStatus.failed, reasons: ceStatus.reasons }, run.counterevidence);
  // 369.2-16 (R07; C01-C03, C17): the answer is built from the swept ledger, never from a command return. It says
  // what ran of what was planned, which questions were not searched and why, what an empty result does and does
  // not prove, and whether the searches for evidence against the claim ran. No id and no code reaches the line.
  const doneOps = run.completion.by_state.executed_with_results + run.completion.by_state.executed_empty;
  const plannedOps = doneOps + run.completion.by_state.refused_before_fetch + run.completion.by_state.not_executed + run.completion.open.length;
  const ceRoundOneOnly = state.ce.queries.length === 0 && ceStatus.executed > 0;
  run.answer_line = noDash([
    jobLines.deepOpeningLine({ executed: doneOps, planned: plannedOps, rows: keptTotal, governing: governing, stop: state.stop_reason || 'cap', operations: run.operations }),
    jobLines.incompleteLines(run.completion, { max: 3, operations: run.operations, skipFalsifiers: true }).join(' '),
    jobLines.emptyResultLine(run.operations),
    jobLines.counterevidenceLine(ceStatus, { roundOneOnly: ceRoundOneOnly }),
  ].filter(function (x) { return typeof x === 'string' && x.length > 0; }).join(' '));
  if (ws && wsVerdict) run.verdict_detail = { plurality_ran: pluralityRan, primary_count: wsVerdict.primary_count, cover_count: wsVerdict.cover_count, floor: wsVerdict.floor, reasons: wsVerdict.reasons };
  const valid = planMod.validateRunResult(run);
  if (!valid.ok) return refuse('run_result_invalid', { errors: valid.errors });

  const records = readAllRecords(roomDir, state);
  const dir = runAbs(roomDir, runId);
  try {
    atomicWriteJson(path.join(dir, 'records.json'), { schema: 'mos.research-records/1', run_id: runId, records: records });
    atomicWriteJson(path.join(dir, 'rows.json'), { schema: 'mos.research-rows/1', run_id: runId, rows: rows, dropped: all.dropped });
    operations.writeLedger(roomDir, opsLedger);
    atomicWriteJson(path.join(dir, 'run.json'), run);
    state.step = 'done';
    saveState(roomDir, state);
  } catch (e) {
    return refuse('state_write_failed', { detail: String((e && e.message) || e) });
  }
  return { ok: true, run: run, state_dir: relDir.split(path.sep).join('/') };
}

module.exports = {
  DEEP_STEPS: DEEP_STEPS,
  initDeepState: initDeepState,
  nextDeepStep: nextDeepStep,
  fetchRound: fetchRound,
  lanePayload: lanePayload,
  recordLaneRows: recordLaneRows,
  proposeFollowups: proposeFollowups,
  applyExtendDecision: applyExtendDecision,
  runCounterevidence: runCounterevidence,
  synthesize: synthesize,
  extendCard: extendCard,
  roundOneQueries: roundOneQueries,
  loadState: loadState,
};
