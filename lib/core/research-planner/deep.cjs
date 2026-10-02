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
const egressPolicy = require('./egress-policy.cjs');
const evidenceRows = require('./evidence-rows.cjs');
const perspectiveMod = require('./perspective.cjs');
const verdictMod = require('./verdict.cjs');
const quickMod = require('./quick.cjs');
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
  return { ok: true, state: state, plan: plan };
}

// ---------------------------------------------------------------------------
// grant handling
// ---------------------------------------------------------------------------
function capNow(state, base) {
  const lift = list(state.extensions).reduce(function (n, e) { return n + (num(e.cap_lift) ? e.cap_lift : 0); }, 0);
  return Math.min(BUDGETS.DEEP_MAX_SEARCHES, base + lift);
}

// The run grant as it stands on disk, plus what the navigator has extended on
// this run through an F.3 approval (families, hashes, a bounded cap lift).
function activeGrant(roomDir, state, nowMs) {
  const g = grants.findActiveGrant(roomDir, { now: nowMs, lifetime: 'run', run_id: state.run_id });
  if (!g || g.grant_id !== state.grant_ref.grant_id) return null;
  const eff = clone(g);
  list(state.extensions).forEach(function (e) {
    list(e.families).forEach(function (f) { if (eff.families.indexOf(f) === -1) eff.families.push(f); });
    list(e.hashes).forEach(function (h) { if (eff.approved_hashes.indexOf(h) === -1) eff.approved_hashes.push(h); });
  });
  const base = eff.caps && num(eff.caps.max_searches) ? eff.caps.max_searches : 0;
  eff.caps = Object.assign({}, eff.caps, { max_searches: capNow(state, base) });
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

function limiterSlot(plan, lim, leaves) {
  for (let i = 0; i < leaves.length; i += 1) {
    const s = isObj(leaves[i].slots) ? leaves[i].slots.limiter : null;
    if (nonEmpty(s)) return s.trim();
  }
  return nonEmpty(lim.statement) ? lim.statement.trim() : null;
}

function laneCapFor(plan) {
  return orchestrator.resolveFanoutCap({ fanout: plan.budget.breadth });
}

// laneSpecs(plan) -> [{lane, kind, limiter_id?, lens?, leaf_ids, slot?, slots?}] in rank order, clamped.
function laneSpecs(plan) {
  const cap = laneCapFor(plan);
  const leaves = fetchLeaves(plan);
  const specs = [];
  if (isSR(plan)) {
    const ranking = perspectiveMod.rankByUnlock(plan.perspective, {});
    ranking.forEach(function (r) {
      const lim = list(plan.perspective.limiters).filter(function (l) { return l && l.id === r.limiter_id; })[0];
      if (!lim) return;
      const own = leaves.filter(function (l) { return l.limiter_id === lim.id || l.id === lim.leaf_id; });
      if (own.length === 0) return;
      specs.push({ lane: safeLane(lim.id), kind: 'limiter', limiter_id: lim.id, leaf_ids: own.map(function (l) { return l.id; }), slot: limiterSlot(plan, lim, own) });
    });
  } else {
    const order = [];
    const byLens = {};
    leaves.forEach(function (l) {
      const key = nonEmpty(l.lens) ? l.lens : l.id;
      if (!byLens[key]) { byLens[key] = []; order.push(key); }
      byLens[key].push(l);
    });
    order.forEach(function (lens) {
      const own = byLens[lens];
      const withSlots = own.filter(function (l) { return isObj(l.slots) && Object.keys(l.slots).length > 0; })[0] || own[0];
      specs.push({ lane: safeLane(lens), kind: 'lens', lens: lens, leaf_ids: own.map(function (l) { return l.id; }), slots: clone(withSlots.slots || {}) });
    });
  }
  return specs.slice(0, cap);
}

function shapeQuery(q, lane, leafIds, round) {
  return {
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
}

// roundOneQueries(plan) -> [{lane, leaf_ids, queries[]}]. Uses the round-one
// queries already on the lane's leaves (a reviewed plan) and composes the rest
// through families.cjs; a hash a lane already claimed is not repeated in a later
// lane. The facade calls this before buildRunGrant so approved hashes match.
function roundOneQueries(plan) {
  const perLane = plan.budget.queries_per_round;
  const claimed = {};
  const out = [];
  laneSpecs(plan).forEach(function (spec) {
    const leaves = list(plan.leaves).filter(function (l) { return spec.leaf_ids.indexOf(l.id) !== -1; });
    let found = [];
    leaves.forEach(function (l) {
      list(l.queries).forEach(function (q) {
        if (!isObj(q) || (q.round !== undefined && q.round !== 1)) return;
        if (!found.some(function (x) { return x.q_hash === q.q_hash; })) found.push(q);
      });
    });
    if (found.length === 0) {
      let c;
      if (spec.kind === 'limiter') {
        c = nonEmpty(spec.slot) ? families.composeFamily(CI_FAMILY, { limiter: spec.slot }, { templateIds: ROUND_ONE_TEMPLATES.slice(), round: 1 }) : refuse('bad_slot');
      } else {
        c = families.composeForLeaf({ lens: spec.lens, slots: spec.slots }, { round: 1 });
      }
      found = c && c.ok ? c.queries : [];
    }
    const kept = [];
    found.forEach(function (q) {
      if (kept.length >= perLane || claimed[q.q_hash]) return;
      claimed[q.q_hash] = true;
      kept.push(shapeQuery(q, spec.lane, spec.leaf_ids, 1));
    });
    if (kept.length > 0) out.push({ lane: spec.lane, leaf_ids: spec.leaf_ids.slice(), queries: kept });
  });
  return out;
}

function leafBrief(plan, id) {
  const l = list(plan.leaves).filter(function (x) { return x.id === id; })[0];
  return { leaf_id: id, question: l ? String(l.question) : '', falsifier: l && isObj(l.falsifier) ? String(l.falsifier.text || '') : '' };
}

// ---------------------------------------------------------------------------
// initDeepState
// ---------------------------------------------------------------------------
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
  if (r1.length === 0) return refuse('no_lanes');

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
    lane_results: [],
    executed: [],
    planned_round_one: pending.map(function (q) { return { template_id: q.template_id, q_hash: q.q_hash, role: q.role, leaf_id: q.leaf_ids[0] }; }),
    searches_used: 0,
    max_searches_base: plan.budget.max_searches,
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
  try {
    atomicWriteJson(path.join(runAbs(roomDir, plan.run_id), 'plan.json'), plan);
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
async function executeQueries(roomDir, state, plan, queries, opts) {
  const o = isObj(opts) ? opts : {};
  const topRows = plan.budget.results_per_query;
  const inner = typeof o.fetchEnvelopeFn === 'function' ? o.fetchEnvelopeFn : corpus.fetchCorpusEnvelope;
  const envelopeFn = function (args) { return inner({ source: PROVIDER, query: args.query, limit: topRows }); };
  const cacheFn = typeof o.cacheFn === 'function' ? o.cacheFn : sourceLensDriver.fetchSourceCached;

  // 366-17: the declared egress policy gates the one deep fetch door; the audit ledger refuses an
  // off line too, but only AFTER a fetch, so the check has to come first
  if (queries.length > 0 && !egressPolicy.lineAllowed(egressPolicy.loadEgressPolicy(roomDir, { offline: o.offline === true }), 'research')) {
    return { aborted: 'egress_line_off' };
  }

  for (let i = 0; i < queries.length; i += 1) {
    const q = queries[i];
    const elapsed = Date.now() - state.started_ms;
    if (elapsed >= state.budget_ms) { state.stop_reason = state.stop_reason || 'time'; return { ok: true }; }
    if (num(state.remaining_usd) && num(state.next_cost_usd) && state.remaining_usd < state.next_cost_usd) {
      state.stop_reason = state.stop_reason || 'budget';
      return { ok: true };
    }
    const grant = activeGrant(roomDir, state, Date.now());
    const v = checkQuery(roomDir, q, grant, state.searches_used, Date.now());
    if (!v.ok) {
      if (v.reason === 'cap_exceeded') { state.stop_reason = state.stop_reason || 'budget'; return { ok: true }; }
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

    let info;
    if (waited.timedOut) {
      info = { outcome: 'failed', failure_class: 'network_timeout', count: null, cost_usd: null, remaining_usd: null, x_query: null, cache_hit: false, items: [], budget_stop: false };
      state.stop_reason = state.stop_reason || 'time';
    } else if (waited.error) {
      info = { outcome: 'failed', failure_class: 'unknown_error', count: null, cost_usd: null, remaining_usd: null, x_query: null, cache_hit: false, items: [], budget_stop: false };
    } else {
      info = classify(waited.value, topRows);
      if (restock && (info.outcome === 'ok' || info.outcome === 'empty_valid')) {
        try { researchCache.putCached(roomDir, SOURCE_ID, q.q, info.items, { meta: metaOf(waited.value) }); } catch (_e) { /* ignore */ }
      }
      if (info.budget_stop) state.stop_reason = state.stop_reason || 'budget';
    }

    const itemList = info.items;
    const hashes = itemList.map(function (it) { return evidenceRows.contentHash(it); });
    const failed = info.outcome === 'failed' || info.outcome === 'blocked';
    const audit = auditLedger.appendAudit(roomDir, {
      ts: iso(Date.now()),
      run_id: state.run_id,
      grant_id: String(grant.grant_id),
      grant_version: grant.version,
      q: q.q,
      q_hash: q.q_hash,
      template_id: q.template_id,
      family: q.family,
      part8_verdict: q.audit === 'pass' ? 'pass' : 'tripped',
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
    if (!audit.ok) return { aborted: 'audit_write_failed' };

    state.searches_used += 1;
    if (num(info.remaining_usd)) state.remaining_usd = info.remaining_usd;
    if (num(info.cost_usd) && info.cost_usd > 0) state.next_cost_usd = Math.max(num(state.next_cost_usd) ? state.next_cost_usd : 0, info.cost_usd);
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
    if (state.stop_reason === 'budget' || state.stop_reason === 'time') return { ok: true };
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
  if (truncated) state.stop_reason = state.stop_reason || 'budget';
  state.pending = [];

  // Lanes with no records are recorded as searched-not-found; the rest go to the analysts.
  const laneIds = state.round_lanes[state.round] || [];
  state.expected = [];
  laneIds.forEach(function (lane) {
    const n = laneRecords(roomDir, runId, lane).filter(function (r) { return r.round === state.round; }).length;
    if (n === 0) {
      state.recorded[state.round + ':' + lane] = true;
      state.lane_results.push({ lane: lane, round: state.round, records: 0, rows_kept: 0, dropped_total: 0, searched_not_found: true });
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

function recordLaneRows(roomDir, runId, lane, rawRows) {
  const loaded = loadState(roomDir, runId);
  if (!loaded.ok) return loaded;
  const state = loaded.state;
  const plan = loaded.plan;
  const isCE = lane === CE_LANE;
  if (isCE) {
    if (state.step !== 'counterevidence' || !state.ce.fetched || state.ce.recorded) return refuse('wrong_step', { step: state.step });
  } else {
    if (state.step !== 'dispatch_lanes' || state.expected.indexOf(lane) === -1) return refuse('wrong_step', { step: state.step });
    if (state.recorded[state.round + ':' + lane]) return refuse('already_recorded');
  }
  const records = laneRecords(roomDir, runId, lane).filter(function (r) { return isCE || r.round === state.round; });
  const index = evidenceRows.recordsIndex(records);
  const code = isCE ? CE_LANE : laneCode(lane) + 'R' + state.round;
  const validated = evidenceRows.validateRows(list(rawRows), index, { leafIds: researchableIds(plan), lane: code, retrievedAt: iso(Date.now()) });

  const file = lanePath(roomDir, runId, lane, 'rows');
  const cur = readJson(file, null);
  const body = isObj(cur) && Array.isArray(cur.rows) ? cur : { schema: 'mos.research-rows/1', run_id: runId, lane: lane, rows: [], dropped: {} };
  validated.rows.forEach(function (r) {
    body.rows.push(r);
    const key = r.leaf_id + '|' + r.record_id + '|' + r.label;
    if (!state.seen_row_keys[key]) { state.seen_row_keys[key] = true; state.round_new.rows += 1; }
  });
  body.dropped = sumDropped(body.dropped, validated.dropped);
  atomicWriteJson(file, body);

  const droppedTotal = Object.keys(validated.dropped).reduce(function (n, k) { return n + validated.dropped[k]; }, 0);
  const kept = validated.rows.length;
  const summary = { lane: lane, round: state.round, records: records.length, rows_kept: kept, dropped_total: droppedTotal, searched_not_found: kept === 0 };
  state.lane_results.push(summary);
  let allRecorded;
  if (isCE) {
    state.ce.recorded = true;
    state.ce.run = true;
    state.step = 'synthesize';
    allRecorded = true;
  } else {
    state.recorded[state.round + ':' + lane] = true;
    allRecorded = state.expected.every(function (l) { return state.recorded[state.round + ':' + l]; });
    if (allRecorded) state.step = 'validate';
  }
  saveState(roomDir, state);
  return { ok: true, lane: lane, round: state.round, kept: kept, dropped: validated.dropped, searched_not_found: kept === 0, all_recorded: allRecorded, next_step: state.step };
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
  const half = Math.ceil(prev.length / 2);
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
function extendCard(state, newQueries) {
  const qs = list(newQueries);
  const base = num(state.max_searches_base) ? state.max_searches_base : 0;
  const cap = capNow(state, base);
  const used = num(state.searches_used) ? state.searches_used : 0;
  const lines = [];
  lines.push('## Extend this deep run?');
  lines.push('');
  lines.push('The run wants searches outside what you approved. Nothing below has been sent yet.');
  lines.push('');
  lines.push('New searches (each already passed the egress audit):');
  qs.forEach(function (q) {
    lines.push('- ' + oneLine(q.template_id) + ' (' + oneLine(q.family) + '): ' + oneLine(q.q));
  });
  lines.push('');
  lines.push('Remaining cap: ' + Math.max(0, cap - used) + ' of ' + cap + ' searches (a cap, not a forecast).');
  lines.push('OpenAlex budget remaining: ' + (num(state.remaining_usd) ? '$' + state.remaining_usd + ' as last reported' : 'not reported') + ' (a cap, not a cost estimate).');
  lines.push('Approving extends this run only. Stopping synthesizes what is already on file.');
  return {
    shape: 'F.3',
    title: 'Extend or stop this deep run',
    question: 'Run these searches, or stop here?',
    options: [
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
  if (state.stop_reason === 'budget' || state.stop_reason === 'time') {
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

  if (isSR(plan) && nonEmpty(plan.perspective.goal && plan.perspective.goal.target)) {
    const goalLeaves = list(plan.leaves).filter(function (l) { return l.dimension === 'sr:goal'; }).map(function (l) { return l.id; });
    const c = families.composeFamily(CI_FAMILY, { limiter: plan.perspective.goal.target }, { templateIds: ['ci.derivation'], round: round });
    if (c.ok) add(c, goalLeaves.length > 0 ? goalLeaves : researchableIds(plan).slice(0, 1), 'goal_falsifier');
    else gaps.push({ branch: 'goal', reason: c.reason });
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
    perspectiveMod.rankByUnlock(plan.perspective, {}).forEach(function (r) {
      const lim = list(plan.perspective.limiters).filter(function (l) { return l.id === r.limiter_id; })[0];
      if (!lim || classifyOne(plan, lim, rows).column !== 'assumed' || !nonEmpty(lim.statement)) return;
      const c = families.composeFamily(CI_FAMILY, { limiter: lim.statement }, { templateIds: ['ci.derivation'], round: round });
      if (c.ok) add(c, limiterLeafIds(plan, lim), 'limiter_derivation');
      else gaps.push({ branch: lim.id, reason: c.reason });
    });
  }

  // Never repeat a search already run; keep within the remaining cap.
  const seen = executedHashes(state);
  let fresh = queries.filter(function (q) { return !seen[q.q_hash] && !seen['q:' + q.q.toLowerCase()]; });
  const remaining = Math.max(0, capNow(state, state.max_searches_base) - state.searches_used);
  if (fresh.length > remaining) {
    fresh.slice(remaining).forEach(function (q) { gaps.push({ branch: q.note, reason: 'over_cap' }); });
    fresh = fresh.slice(0, remaining);
  }
  state.ce.gaps = gaps;
  state.ce.lane_leaves = uniq([].concat.apply([], fresh.map(function (q) { return q.leaf_ids; }))).map(function (id) { return leafBrief(plan, id); });

  const grant = activeGrant(roomDir, state, Date.now());
  const need = [];
  fresh.forEach(function (q, i) {
    const v = checkQuery(roomDir, q, grant, state.searches_used + i, Date.now());
    if (!v.ok && (v.reason === 'outside_family' || v.reason === 'provider_not_in_policy')) need.push(q);
  });
  if (need.length > 0) {
    state.extend_ctx = { kind: 'counterevidence', new_queries: need, all: fresh, cap_lift: 0 };
    state.extend_ctx.card = extendCard(state, need);
    state.step = 'extend_card';
    return;
  }
  state.ce.queries = fresh;
  state.step = 'counterevidence';
}

// ---------------------------------------------------------------------------
// nextDeepStep
// ---------------------------------------------------------------------------
function runValidate(roomDir, state, plan) {
  const payload = { round: state.round, new_record_ids: state.round_new.ids, new_rows: state.round_new.rows, stop_reason: null };
  if (!state.stop_reason) {
    if (isWhitespace(plan) && !whitespacePluralityRan(state)) state.stop_reason = 'plurality_required';
    else if (state.round_new.ids === 0 && state.round_new.rows === 0) state.stop_reason = 'saturation';
    else if (state.round >= state.max_rounds) state.stop_reason = 'cap';
  }
  payload.stop_reason = state.stop_reason;
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
  const capLeft = Math.max(0, capNow(state, state.max_searches_base) - state.searches_used);
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
    } else {
      state.ce.queries = ctx.all;
      state.step = 'counterevidence';
    }
  } else {
    state.extend_ctx = null;
    if (ctx.kind === 'followup') {
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
  const res = await executeQueries(roomDir, state, plan, queries, opts);
  if (res.aborted) { saveState(roomDir, state); return refuse(res.aborted); }
  const executed = state.executed.length - before;
  if (executed < queries.length) state.ce.partial = true;
  const gotRecords = laneRecords(roomDir, runId, CE_LANE).length > 0;
  if (executed === 0 || !gotRecords) {
    // nothing to read: the pass ran (or was cut off) with no records for an analyst
    state.ce.fetched = true;
    state.ce.recorded = true;
    state.ce.run = executed > 0 || queries.length === 0;
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
  const ceNotRun = !state.ce.run;
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
  const answer = noDash('The deep run stopped on ' + (state.stop_reason || 'cap') + ' after ' + state.searches_used + ' searches and ' + keptTotal + ' validated rows; the governing thought reads ' + governing + ' with ' + unresolved.length + ' unresolved branch' + (unresolved.length === 1 ? '' : 'es') + '.');
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
    answer_line: answer,
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
    counterevidence: { ran: !!state.ce.run, skipped: !!state.ce.skipped, skipped_reason: state.ce.skipped_reason, partial: !!state.ce.partial, queries: state.ce.queries.map(function (q) { return { template_id: q.template_id, q_hash: q.q_hash, leaf_ids: q.leaf_ids }; }), gaps: clone(state.ce.gaps) },
    extensions: clone(state.extensions),
  };
  if (ws && wsVerdict) run.verdict_detail = { plurality_ran: pluralityRan, primary_count: wsVerdict.primary_count, cover_count: wsVerdict.cover_count, floor: wsVerdict.floor, reasons: wsVerdict.reasons };
  const valid = planMod.validateRunResult(run);
  if (!valid.ok) return refuse('run_result_invalid', { errors: valid.errors });

  const records = readAllRecords(roomDir, state);
  const dir = runAbs(roomDir, runId);
  try {
    atomicWriteJson(path.join(dir, 'records.json'), { schema: 'mos.research-records/1', run_id: runId, records: records });
    atomicWriteJson(path.join(dir, 'rows.json'), { schema: 'mos.research-rows/1', run_id: runId, rows: rows, dropped: all.dropped });
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
