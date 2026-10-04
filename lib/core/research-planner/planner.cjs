'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 15 -- the planner facade: the one front door in code.
 *
 * Every surface (the CLI script, the MCP tool, the ambient branch, the command
 * bodies) assembles a plan, picks the next card, records an approval and
 * reads a run's state through this file, so a plan is built one way (D-02a).
 * The facade fetches nothing and files nothing on its own: fetches happen only
 * inside quick.runQuick and deep.fetchRound after their grant checks, and
 * filing happens only in filing.fileRun on an approved selection (D-04).
 *
 *   buildPlan(roomDir, questionSet, opts)   assemble, validate, hash and save
 *   buildPlanLive(roomDir, qs, opts)        same, after an optional live read
 *   cardFor(roomDir, plan, opts)            the next honest move and its card
 *   approveStandingGrant(roomDir, proposal, opts)
 *   approvePlanReview(roomDir, runId, opts)
 *   pendingCards / markSurfaced / queuePendingCard
 *   status(roomDir, runId)                  where a run stands and what is next
 *   nextMove(roomDir, run, plan)            weakest branch -> next framework
 *   plus the small state helpers the CLI door needs (loadPlan, loadRun,
 *   revisePlan, escalate, basketFor, fileFromState, deepNext, applyExtend,
 *   validateRowsFor, proposeGrant, grantStatus).
 *
 * Assembly order (one governed path): validate the question set, choose the
 * mode, read the room's rung silently, detect scientific research, select
 * lenses (diffusion, D-19), read the structure (ledger, or a live read only on
 * request, D-09), settle the ratchet memory, build the research perspective
 * (D-18) and the Minto pyramid (D-08), apply the Logic Trees steps for a
 * scientific question, compose every search string through the query families
 * and their audit fence (a refusal keeps that leaf in the room and never echoes
 * the string, D-04), check the pyramid, validate the plan, hash it, save it.
 *
 * Plan status: ready | incomplete | wish | needs_lens_leaves | local_only.
 *   incomplete        the pyramid does not pass: a required question is not yet
 *                     asked, or every question only restates the navigator
 *                     (D-00). The card lists what to ask. No run is offered.
 *   wish              the Scientific Roadmapping perspective has no nameable
 *                     limiter. The card says so. No run is offered.
 *   needs_lens_leaves a selected lens has no sub-questions yet.
 *   local_only        no sub-question can be searched outside the room.
 *
 * Canon Part 8: nothing here sends anything. Approvals record the grant id and
 * run id in a decision node, never a term or a question. Canon Part 9: every
 * node lands proposed. No em-dash or en-dash anywhere in this file.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const Q = require('./question-templates.cjs');
const structure = require('./structure.cjs');
const perspectiveMod = require('./perspective.cjs');
const pyramidMod = require('./pyramid.cjs');
const families = require('./families.cjs');
const planMod = require('./plan.cjs');
const grants = require('./grants.cjs');
const quickMod = require('./quick.cjs');
const deepMod = require('./deep.cjs');
const filingMod = require('./filing.cjs');
const evidenceRows = require('./evidence-rows.cjs');
const framing = require('../ambient-framing.cjs');
const navigation = require('../navigation.cjs');

const BUDGETS = planMod.BUDGETS;
const RUN_ID_RE = /^rp-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/;
const GRANT_ID_RE = /^g-[0-9a-f]{8}$/;
const RUNGS = Object.freeze(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked', 'unknown']);
const SURFACES = Object.freeze(['cli', 'mcp']);
const STATE_DIR = path.join('.mindrian', 'research-runs');
const DEFAULT_SECTION = 'market-analysis';
const PENDING_KEEP = 50;
const ORIGIN = 'research-planner';

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function noDash(s) { return String(s).replace(/[\u2014\u2013]/g, '-'); }
function oneLine(s) { return noDash(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()); }
function fail(reason, extra) { return Object.assign({ ok: false, reason: reason }, extra || {}); }

function atomicWriteJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return fallback; }
}

function runDirAbs(roomDir, runId) { return path.join(roomDir, STATE_DIR, runId); }

function surfaceOf(v) {
  if (typeof v === 'string' && SURFACES.indexOf(v) !== -1) return v;
  if (isObj(v) && SURFACES.indexOf(v.surface) !== -1) return v.surface;
  return null;
}

// ---------------------------------------------------------------------------
// run state on disk
// ---------------------------------------------------------------------------
function savePlan(roomDir, plan) {
  atomicWriteJson(path.join(runDirAbs(roomDir, plan.run_id), 'plan.json'), plan);
}

// loadPlan(roomDir, runId) -> {ok, plan} | {ok:false, reason}. The saved plan
// must still hash to its own plan_hash (a hand edit is refused).
function loadPlan(roomDir, runId) {
  if (!nonEmpty(roomDir) || typeof runId !== 'string' || !RUN_ID_RE.test(runId)) return fail('bad_run_id');
  const plan = readJson(path.join(runDirAbs(roomDir, runId), 'plan.json'), null);
  if (!isObj(plan)) return fail('unknown_run');
  let hash = null;
  try { hash = planMod.planHash(plan); } catch (_e) { hash = null; }
  if (hash !== plan.plan_hash) return fail('plan_hash_mismatch');
  return { ok: true, plan: plan };
}

function loadRun(roomDir, runId) {
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) return fail('bad_run_id');
  const run = readJson(path.join(runDirAbs(roomDir, runId), 'run.json'), null);
  return isObj(run) ? { ok: true, run: run } : fail('run_not_finished');
}

function filingOf(roomDir, runId) {
  const f = readJson(path.join(runDirAbs(roomDir, runId), 'filing.json'), null);
  return isObj(f) && f.filed === true ? f : null;
}

// ---------------------------------------------------------------------------
// assembly pieces
// ---------------------------------------------------------------------------
function pickMode(requested, hint) {
  if (requested === 'quick' || requested === 'deep') return requested;
  if (hint === 'quick' || hint === 'deep') return hint;
  return 'quick';
}

function budgetFor(mode) {
  if (mode === 'quick') {
    return {
      plan: { breadth: BUDGETS.QUICK_CORPORA, rounds: 1, queries_per_round: BUDGETS.QUICK_MAX_QUERIES, results_per_query: BUDGETS.QUICK_TOP_ROWS, max_searches: BUDGETS.QUICK_MAX_QUERIES, time_budget_ms: BUDGETS.QUICK_TIME_BUDGET_MS, counterevidence: false },
      stop: ['cap', 'time', 'budget'],
    };
  }
  return {
    plan: { breadth: BUDGETS.DEEP_LANES_REQUESTED, rounds: BUDGETS.DEEP_ROUNDS, queries_per_round: BUDGETS.DEEP_R1_QUERIES_PER_LANE, results_per_query: BUDGETS.DEEP_RESULTS_PER_QUERY, max_searches: BUDGETS.DEEP_MAX_SEARCHES, time_budget_ms: BUDGETS.DEEP_TIME_BUDGET_MS, counterevidence: true },
    stop: ['cap', 'saturation', 'budget', 'time'],
  };
}

function hasSlots(leaf) {
  return isObj(leaf.slots) && Object.keys(leaf.slots).length > 0;
}

// A refusal keeps the leaf in the room. The reason never carries the string.
function markLocalOnly(leaf, refusal) {
  leaf.researchable = false;
  leaf.not_researchable_reason = refusal === 'egress_violation'
    ? 'A search term did not pass the egress audit, so this question is answered from the room only.'
    : 'A search term could not be used as written, so this question is answered from the room only.';
  leaf.corpus = 'room';
  leaf.status = 'not_run';
  leaf.slots = {};
  leaf.queries = [];
}

// attachQueries(plan) -> {local_only:[{leaf_id, reason}], trimmed:n}. Composes
// every search string through the families and their audit (one path for every
// mode). Idempotent: existing queries are rebuilt from the slots.
function attachQueries(plan) {
  const localOnly = [];
  const composed = {};
  let trimmed = 0;
  plan.leaves.forEach(function (leaf) {
    leaf.queries = [];
    if (!isObj(leaf) || leaf.researchable !== true || leaf.corpus !== 'openalex') return;
    if (!hasSlots(leaf)) return;
    const c = families.composeForLeaf({ lens: leaf.lens, slots: leaf.slots, corpus: leaf.corpus }, { round: 1 });
    if (c.ok) { composed[leaf.id] = c.queries; return; }
    if (c.reason === 'unknown_lens') return;
    localOnly.push({ leaf_id: leaf.id, reason: c.reason });
    markLocalOnly(leaf, c.reason);
  });

  if (plan.mode === 'quick') {
    const seen = {};
    let count = 0;
    plan.leaves.forEach(function (leaf) {
      const qs = composed[leaf.id];
      if (!qs) return;
      const kept = [];
      qs.forEach(function (q) {
        if (seen[q.q_hash]) { kept.push(q); return; }
        if (count < BUDGETS.QUICK_MAX_QUERIES) { seen[q.q_hash] = true; count += 1; kept.push(q); return; }
        trimmed += 1;
      });
      leaf.queries = kept;
    });
  } else {
    deepMod.roundOneQueries(plan).forEach(function (lane) {
      const leaf = plan.leaves.filter(function (l) { return l.id === lane.leaf_ids[0]; })[0];
      if (leaf) leaf.queries = leaf.queries.concat(lane.queries.map(function (q) {
        return { template_id: q.template_id, family: q.family, role: q.role, q: q.q, q_hash: q.q_hash, audit: q.audit, round: q.round, slot_terms: q.slot_terms };
      }));
    });
  }
  return { local_only: localOnly, trimmed: trimmed };
}

// refreshChecks(plan) -> the pyramid check. Rewrites the plan's coverage, mece
// and D-00 records from the current leaves.
function refreshChecks(plan) {
  const check = pyramidMod.checkPyramid(plan.pyramid, plan.leaves, {});
  plan.pyramid.coverage = { dimensions: check.coverage.dimensions, uncovered: check.coverage.uncovered, not_researchable: check.coverage.not_researchable };
  plan.pyramid.mece = {
    warnings: check.mece.warnings,
    falsifiability: check.falsifiability.warnings,
    restatement_warnings: check.restatement_warnings,
    passes: check.mece.passes,
  };
  plan.pyramid.d00 = { passes: check.d00.passes, beyond_stated_leaf_ids: check.d00.beyond_stated_leaf_ids };
  return check;
}

// 366-15 (D-09): a researchable theo leaf leaves the room too (the grant-gated lateral-path
// lane), so a connections plan with only theo and room leaves is ready, not local_only.
function anySearchable(plan) {
  return plan.leaves.some(function (l) { return l.researchable === true && (l.corpus === 'openalex' || l.corpus === 'theo'); });
}

// True when the plan has no limiter to test: the errors just computed name it,
// the stored tension is a wish, or the stored perspective holds no limiter
// (revise and escalate pass no fresh errors, so the plan itself is the record).
function hasNoLimiter(plan, perr) {
  if (perr.indexOf('no_nameable_limiter') !== -1) return true;
  const pv = plan && plan.perspective;
  if (!isObj(pv)) return false;
  if (isObj(pv.tension) && pv.tension.status === 'wish') return true;
  return Array.isArray(pv.limiters) && pv.limiters.length === 0;
}

// assess(plan, perspectiveErrors) -> {status, errors}. Pyramid first, then the
// Scientific Roadmapping perspective, then whether anything can leave the room.
function assess(plan, perspectiveErrors, priorStatus) {
  const check = refreshChecks(plan);
  const errors = [];
  let status = 'ready';
  if (check.status !== 'ready') {
    // A plan that only restates the navigator (D-00) is an incomplete plan:
    // the missing thing is the questions the navigator did not know to ask.
    status = check.status === 'wish' ? 'incomplete' : check.status;
    check.errors.forEach(function (e) { errors.push(e); });
  }
  const perr = list(perspectiveErrors);
  if (plan.origin.template_id === 'scientific-roadmapping' && perr.length > 0 && status === 'ready') {
    status = perr.indexOf('no_nameable_limiter') !== -1 ? 'wish' : 'incomplete';
    perr.forEach(function (e) { errors.push(e); });
  } else if (plan.mode === 'deep' && status === 'ready' && hasNoLimiter(plan, perr)) {
    // Navigator ruling 2026-10-01 (DRP363-19): a deep plan with no nameable
    // limiter is a wish whatever its template, including a scientific-roadmapping
    // plan that lost its last limiter through revise (second ruling, same day).
    // Only this one perspective error gates here; the other errors stay advisory
    // outside scientific-roadmapping, whose build-time branch above is unchanged.
    status = 'wish';
    errors.push('no_nameable_limiter');
  } else if (priorStatus === 'wish' && status === 'ready' && hasNoLimiter(plan, perr)) {
    status = 'wish';
    errors.push('no_nameable_limiter');
  }
  if (status === 'ready' && !anySearchable(plan)) status = 'local_only';
  return { status: status, errors: errors, check: check };
}

function ownerTemplate(dimension, plan) {
  const first = plan && plan.origin ? Q.TEMPLATES[plan.origin.template_id] : null;
  const ordered = (first ? [first.id] : []).concat(Q.PLANNER_TEMPLATE_IDS.filter(function (id) { return !first || id !== first.id; }));
  for (let i = 0; i < ordered.length; i += 1) {
    const t = Q.TEMPLATES[ordered[i]];
    if (t && list(t.dimensions).some(function (d) { return d.id === dimension; })) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// buildPlan
// ---------------------------------------------------------------------------
function buildPlan(roomDir, questionSet, opts) {
  const o = isObj(opts) ? opts : {};
  if (!nonEmpty(roomDir)) return fail('room_required', { status: 'invalid', errors: ['room_required'] });
  const now = o.now instanceof Date ? o.now : new Date();

  let qs = questionSet;
  if (isObj(qs) && !nonEmpty(qs.template_id)) {
    const t = Q.templateForCommand(qs.command);
    if (t) qs = Object.assign({}, qs, { template_id: t.id });
  }
  const shape = Q.validateQuestionSet(qs);
  if (!shape.ok) return { ok: false, status: 'invalid', errors: shape.errors };
  const template = Q.TEMPLATES[qs.template_id];
  const mode = pickMode(o.mode, qs.mode_hint);
  const caps = budgetFor(mode);

  // the room's rung, read silently; it caps the kind of idea (D-02b)
  const rungRes = framing.resolveRoomRung(roomDir);
  const rung = rungRes && RUNGS.indexOf(rungRes.rung) !== -1 ? rungRes.rung : 'unknown';

  const sci = structure.detectScientific({ templateId: template.id, roomDir: roomDir, navigatorToggle: o.navigatorToggle === true });

  const requested = list(qs.lens_selection).filter(function (s) { return isObj(s) && s.lens === 'diffusion'; })[0] || null;
  const lens = structure.lensSelection({
    roomDir: roomDir,
    templateId: template.id,
    navigatorToggle: o.diffusionToggle === true,
    requested: requested,
    frameworks: [template.framework],
    perspective: qs.perspective,
  });

  const base = structure.structureFor({ templateId: template.id, rung: rung, scientific: sci.scientific, engine: sci.scientific ? 'scientific-roadmapping' : 'constraint-layer' });
  if (isObj(o.live) && o.live.source === 'theo_live' && isObj(o.live.live) && list(o.live.live.logic_trees_steps).length > 0 && base.scientific === true) {
    base.source = 'theo_live';
    base.reason = o.live.reason;
    base.logic_trees_steps = clone(o.live.live.logic_trees_steps);
  }

  const settled = perspectiveMod.loadSettled(roomDir);
  const pp = perspectiveMod.buildPerspective(qs.perspective, {
    rung: rung === 'unknown' ? null : rung,
    scientific: sci.scientific,
    mode: mode,
    depth: mode === 'quick' ? 'lite' : 'full',
    template: template.id,
    settled: settled,
  });

  const bp = pyramidMod.buildPyramid(qs, {
    rung: rung === 'unknown' ? undefined : rung,
    structure: base,
    lensesSelected: lens.selected.map(function (s) { return s.lens; }),
  });
  if (!bp.ok) return { ok: false, status: 'invalid', errors: bp.errors };

  let py = bp.pyramid;
  let leaves = bp.leaves;
  if (base.scientific === true) {
    const lt = pyramidMod.applyLogicTreeSteps(py, leaves, base, { rung: rung === 'unknown' ? undefined : rung, template: template });
    py = lt.pyramid;
    leaves = lt.leaves;
  }

  const section = nonEmpty(o.section) ? o.section
    : (isObj(qs.return_target) && nonEmpty(qs.return_target.section) ? qs.return_target.section : DEFAULT_SECTION);

  const plan = {
    schema: planMod.PLAN_SCHEMA,
    run_id: planMod.newRunId(now),
    mode: mode,
    version: 1,
    max_revisions: BUDGETS.MAX_PLAN_REVISIONS,
    revision: 0,
    status: 'ready',
    parent_plan_hash: null,
    origin: { template_id: template.id, command: qs.command },
    context: {
      rung: rung,
      scientific: { scientific: sci.scientific, is: sci.scientific, signals: sci.signals.slice() },
      lenses_selected: clone(lens.selected),
    },
    structure: { source: base.source, reason: base.reason, tree_type: py.tree_type, scientific: base.scientific === true },
    perspective: pp.perspective,
    pyramid: py,
    leaves: leaves,
    budget: caps.plan,
    stop_rules: caps.stop,
    grant_ref: null,
    return_target: { section: section },
    plan_hash: null,
  };

  const attached = attachQueries(plan);
  const verdict = assess(plan, pp.errors, null);
  plan.status = verdict.status;

  const valid = planMod.validatePlan(plan);
  if (!valid.ok) return { ok: false, status: 'invalid', errors: valid.errors };
  plan.plan_hash = planMod.planHash(plan);
  try {
    savePlan(roomDir, plan);
  } catch (e) {
    return fail('state_write_failed', { status: 'invalid', errors: ['state_write_failed'], detail: String((e && e.message) || e).slice(0, 80) });
  }

  return {
    ok: true,
    run_id: plan.run_id,
    status: plan.status,
    mode: plan.mode,
    plan: plan,
    plan_hash: plan.plan_hash,
    errors: verdict.errors,
    warnings: pp.warnings,
    perspective_errors: pp.errors,
    lenses_selected: clone(lens.selected),
    lens_refused: clone(lens.refused),
    local_only_leaves: attached.local_only,
    quick_trimmed: attached.trimmed,
    structure_source: plan.structure.source,
    saved: path.join(STATE_DIR, plan.run_id, 'plan.json').split(path.sep).join('/'),
  };
}

// buildPlanLive: the same plan after an optional live structure read. The read
// carries framework handles only and falls back to the shipped ledger with the
// reason named (D-09, D-17).
async function buildPlanLive(roomDir, questionSet, opts) {
  const o = isObj(opts) ? opts : {};
  let live = null;
  if (o.liveStructure === true) {
    try { live = await structure.refreshLive({ brainClient: o.brainClient }); } catch (_e) { live = null; }
  }
  return buildPlan(roomDir, questionSet, Object.assign({}, o, { live: live }));
}

// ---------------------------------------------------------------------------
// cardFor
// ---------------------------------------------------------------------------
function notReadyCard(plan, title, lines) {
  return {
    shape: 'F.6',
    title: title,
    question: 'Add or change questions, or stop?',
    options: [
      { id: 'revise', label: 'Add or change questions (Recommended)', recommended: true },
      { id: 'stop', label: 'Stop' },
    ],
    body_md: noDash(lines.join('\n')),
    payload: { run_id: plan.run_id, mode: plan.mode, plan_hash: plan.plan_hash, status: plan.status },
  };
}

function uncoveredLines(plan) {
  const out = [];
  const py = plan.pyramid || {};
  if (py.d00 && py.d00.passes === false) {
    out.push('- Every sub-question restates yours. Add at least one question you had not asked: this run exists to find those.');
  }
  list(py.coverage && py.coverage.uncovered).forEach(function (d) { out.push('- ' + oneLine(d) + ': no sub-question covers this yet'); });
  list(py.mece && py.mece.warnings).forEach(function (w) { out.push('- ' + oneLine(w)); });
  return out;
}

function cardFor(roomDir, plan, opts) {
  const o = isObj(opts) ? opts : {};
  if (!isObj(plan)) return fail('plan_required', { next: 'none', card: null });
  const nowMs = typeof o.now === 'number' ? o.now : Date.now();

  if (plan.status === 'incomplete') {
    const lines = ['## This plan is not ready to run', '', 'Questions not yet asked:'].concat(uncoveredLines(plan));
    return { next: 'revise', reason: 'incomplete', card: notReadyCard(plan, 'Plan review: not ready', lines) };
  }
  if (plan.status === 'wish' && plan.mode === 'deep' && isObj(plan.seed)) {
    // A deep plan that grew out of a quick run (escalate) with no limiter is not a dead end:
    // ask the navigator to name what blocks the gap, in their own words (Canon Part 8, D-10).
    const lines = ['## A deep run needs a bottleneck', '', 'Name what blocks this and I\'ll plan a deep run. Say what actually stands between this gap and the goal, in your own words. Your words become the limiter the deep plan is built around; they stay in the room and are never sent anywhere.'];
    const card = notReadyCard(plan, 'Plan review: name what blocks this', lines);
    card.question = 'What actually blocks this gap?';
    card.options = [
      { id: 'name_limiter', label: 'Name what blocks this (Recommended)', recommended: true },
      { id: 'stop', label: 'Stop' },
    ];
    card.payload.edit_op = 'add_limiter';
    return { next: 'needs_limiter', reason: 'no_nameable_limiter', card: card };
  }
  if (plan.status === 'wish') {
    const lines = ['## This plan is still a wish', '', 'There is no nameable limiter: no wall stands between the tension and the goal that research could test. Name the limiter (what physically or economically blocks the goal), or reframe the goal.'];
    return { next: 'revise', reason: 'no_nameable_limiter', card: notReadyCard(plan, 'Plan review: no nameable limiter', lines) };
  }
  if (plan.status === 'needs_lens_leaves') {
    const lines = ['## A selected lens has no sub-questions yet', '', 'Add a sub-question for each of these before anything runs:'].concat(uncoveredLines(plan));
    return { next: 'revise', reason: 'needs_lens_leaves', card: notReadyCard(plan, 'Plan review: lens needs questions', lines) };
  }
  if (plan.status === 'local_only') {
    const lines = ['## Nothing in this plan can be searched outside the room', '', 'Every sub-question either stays in the room by design or carried a search term that did not pass the egress audit. Reword the terms, or answer from the room.'];
    return { next: 'local_only', reason: 'local_only', card: notReadyCard(plan, 'Plan review: room only', lines) };
  }

  if (plan.mode === 'quick') {
    const cover = quickMod.coverFor(roomDir, plan, { now: nowMs });
    if (cover.covered) return { next: 'run_quick', reason: null, card: null };
    if (cover.reason === 'no_fetch_queries') {
      const lines = ['## This plan has no search text yet', '', 'A quick research run needs a search term for at least one sub-question. Add the term the room should look up.'];
      return { next: 'revise', reason: 'no_search_terms', card: notReadyCard(plan, 'Plan review: needs search terms', lines) };
    }
    if (!cover.card) {
      const out = { next: 'revise', reason: cover.reason, card: null };
      // SEED-104: the typed loop-guard fields ride along only when present.
      ['reask_reason', 'plan_families', 'grant_families'].forEach(function (k) { if (cover[k] !== undefined) out[k] = cover[k]; });
      return out;
    }
    return { next: 'grant', reason: cover.reason, card: cover.card, proposal: cover.proposal, new_terms: cover.new_terms };
  }

  const hashes = [];
  plan.leaves.forEach(function (l) {
    list(l.queries).forEach(function (q) { if ((q.round === undefined || q.round === 1) && hashes.indexOf(q.q_hash) === -1) hashes.push(q.q_hash); });
  });
  if (hashes.length === 0) {
    const lines = ['## This plan has no search text yet', '', 'A deep research run needs search terms on its sub-questions. Add them before the plan is reviewed.'];
    return { next: 'revise', reason: 'no_search_terms', card: notReadyCard(plan, 'Plan review: needs search terms', lines) };
  }
  const approved = grants.findActiveGrant(roomDir, { now: nowMs, lifetime: 'run', run_id: plan.run_id });
  if (approved) return { next: 'deep_run', reason: null, card: null, grant_id: approved.grant_id };
  return { next: 'review', reason: 'plan_review', card: planMod.planReviewCard(plan) };
}

// ---------------------------------------------------------------------------
// approvals (grants become graph data)
// ---------------------------------------------------------------------------
function withDb(roomDir, opts, fn) {
  if (opts && opts.db) return fn(opts.db);
  let db = null;
  try { db = navigation.openRoomDbForCaller(roomDir); } catch (_e) { db = null; }
  if (!db) return fail('room_db_unavailable');
  try {
    return fn(db);
  } finally {
    try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* ignore */ }
  }
}

function decisionId() {
  return navigation.REASONING_NODE_ID('decision', 'research-grant-' + crypto.randomBytes(5).toString('hex'));
}

function mintDecision(db, nodeId, text, sourceKey) {
  return navigation.writeReasoningNode(db, {
    nodeId: nodeId,
    nodeType: 'decision',
    epistemicType: 'decision',
    text: text,
    sourcePath: 'research-grant:' + sourceKey,
    origin: ORIGIN,
  });
}

function normTerms(terms) {
  const out = [];
  list(terms).forEach(function (t) {
    const term = typeof t === 'string' ? t : (isObj(t) ? t.term : null);
    if (!nonEmpty(term)) return;
    const syn = isObj(t) ? list(t.synonyms).filter(nonEmpty).map(function (s) { return s.trim(); }) : [];
    out.push({ term: term.trim(), synonyms: syn });
  });
  return out;
}

function mergeTerms(a, b) {
  const map = {};
  const order = [];
  normTerms(a).concat(normTerms(b)).forEach(function (t) {
    const key = t.term.toLowerCase();
    if (!map[key]) { map[key] = { term: t.term, synonyms: [] }; order.push(key); }
    t.synonyms.forEach(function (s) { if (map[key].synonyms.indexOf(s) === -1) map[key].synonyms.push(s); });
  });
  return order.map(function (k) { return map[k]; });
}

// proposeGrant(roomDir, {terms}) -> the unapproved standing proposal and its F.0 card.
function proposeGrant(roomDir, opts) {
  const terms = normTerms(isObj(opts) ? opts.terms : []);
  // SEED-115: a grant term is a web-line phrase; it may be a room phrase or question.
  // Only an empty, over-cap or control-character value is refused.
  const prose = terms.some(function (t) {
    return families.composableQuery(t.term) === null || t.synonyms.some(function (x) { return families.composableQuery(x) === null; });
  });
  if (prose) return fail('term_not_composed');
  const proposal = grants.buildStandingProposal(roomDir, { terms: terms });
  const card = grants.grantCard(proposal, { newTerms: terms.map(function (t) { return t.term; }) });
  return { ok: true, proposal: proposal, card: card };
}

function approveStandingGrant(roomDir, proposal, opts) {
  const o = isObj(opts) ? opts : {};
  const surface = surfaceOf(o.approvedVia);
  if (!surface) return fail('approval_required');
  if (!isObj(proposal) || proposal.lifetime !== 'standing') return fail('not_standing');
  const terms = mergeTerms(proposal.approved_terms, o.terms);
  const existing = grants.findActiveGrant(roomDir, { lifetime: 'standing' });
  return withDb(roomDir, o, function (db) {
    const nodeId = decisionId();
    const via = { surface: surface, decision_node_id: nodeId };
    let grant;
    let created = false;
    if (existing) {
      // SEED-104: re-approving widens the grant to the proposal's families. Reuse
      // only when there is nothing to add; a no-op extend mints no decision node.
      const propFams = list(proposal.families);
      const widens = propFams.some(function (f) { return list(existing.families).indexOf(f) === -1; });
      if (terms.length === 0 && !widens) return { ok: true, grant: existing, reused: true, decision_node_id: null };
      const ext = grants.extendTerms(roomDir, existing.grant_id, terms, via, { families: propFams });
      if (!ext.ok) return fail(ext.reason);
      if (ext.unchanged === true) return { ok: true, grant: ext.grant, reused: true, unchanged: true, decision_node_id: null };
      grant = ext.grant;
    } else {
      const written = grants.writeGrant(roomDir, Object.assign({}, proposal, { approved_terms: terms }), { approved_via: via });
      if (!written.ok) return fail(written.reason);
      grant = written.grant;
      created = true;
    }
    const node = mintDecision(db, nodeId, 'Approved standing research grant ' + grant.grant_id + ' via ' + surface + '.', grant.grant_id);
    if (!node || node.ok !== true) {
      if (created) grants.revokeGrant(roomDir, grant.grant_id, {});
      return fail('decision_node_failed');
    }
    return { ok: true, grant: grant, decision_node_id: nodeId, extended: !created };
  });
}

function approvePlanReview(roomDir, runId, opts) {
  const o = isObj(opts) ? opts : {};
  const surface = surfaceOf(o.approvedVia);
  if (!surface) return fail('approval_required');
  const loaded = loadPlan(roomDir, runId);
  if (!loaded.ok) return loaded;
  const plan = loaded.plan;
  if (!planMod.validatePlan(plan).ok) return fail('plan_invalid');
  if (plan.status !== 'ready') return fail('plan_' + plan.status);
  const already = grants.findActiveGrant(roomDir, { lifetime: 'run', run_id: runId });
  if (already) return { ok: true, grant: already, reused: true, run_id: runId, next: plan.mode === 'deep' ? 'deep_next' : 'run_quick' };
  const proposal = grants.buildRunGrant(plan);
  if (proposal.approved_hashes.length === 0) return fail('no_searches_to_approve');
  return withDb(roomDir, o, function (db) {
    const nodeId = decisionId();
    const written = grants.writeGrant(roomDir, proposal, { approved_via: { surface: surface, decision_node_id: nodeId } });
    if (!written.ok) return fail(written.reason);
    const grant = written.grant;
    const node = mintDecision(db, nodeId, 'Approved research run ' + runId + ' with grant ' + grant.grant_id + ' via ' + surface + '.', grant.grant_id);
    if (!node || node.ok !== true) {
      grants.revokeGrant(roomDir, grant.grant_id, {});
      return fail('decision_node_failed');
    }
    return { ok: true, grant: grant, decision_node_id: nodeId, run_id: runId, next: plan.mode === 'deep' ? 'deep_next' : 'run_quick' };
  });
}

function grantStatus(roomDir) {
  const standing = grants.findActiveGrant(roomDir, { lifetime: 'standing' });
  const runs = grants.readGrants(roomDir, {}).grants.filter(function (g) {
    return g && g.lifetime === 'run' && !g.revoked_at && Date.parse(g.expires_at) > Date.now();
  });
  return { ok: true, standing: standing, runs: runs, throttle: grants.throttleState(roomDir, {}) };
}

// ---------------------------------------------------------------------------
// pending cards (room-started runs, surfaced once)
// ---------------------------------------------------------------------------
function ledgerPath(roomDir) { return path.join(roomDir, '.mindrian', 'research-run-ledger.json'); }

function saveLedger(roomDir, ledger, pending) {
  atomicWriteJson(ledgerPath(roomDir), {
    schema: ledger.schema,
    runs_window: ledger.runs_window,
    runs: ledger.runs,
    pending_cards: pending.slice(-PENDING_KEEP),
  });
}

function queuePendingCard(roomDir, entry) {
  const e = isObj(entry) ? entry : {};
  if (typeof e.run_id !== 'string' || !RUN_ID_RE.test(e.run_id)) return fail('bad_run_id');
  const ledger = grants.readRunLedger(roomDir, {});
  const kind = nonEmpty(e.kind) ? e.kind : 'evidence';
  const pending = list(ledger.pending_cards).slice();
  const dup = pending.some(function (p) { return isObj(p) && p.run_id === e.run_id && p.kind === kind && p.surfaced !== true; });
  if (!dup) pending.push({ run_id: e.run_id, kind: kind, queued_at: new Date(typeof e.now === 'number' ? e.now : Date.now()).toISOString(), surfaced: false });
  try { saveLedger(roomDir, ledger, pending); } catch (_e) { return fail('write_failed'); }
  return { ok: true, queued: !dup };
}

function pendingCards(roomDir) {
  const ledger = grants.readRunLedger(roomDir, {});
  const out = [];
  list(ledger.pending_cards).forEach(function (raw) {
    const e = typeof raw === 'string' ? { run_id: raw, kind: 'evidence', surfaced: false } : raw;
    if (!isObj(e) || typeof e.run_id !== 'string' || !RUN_ID_RE.test(e.run_id) || e.surfaced === true) return;
    if (filingOf(roomDir, e.run_id)) return;
    out.push({
      run_id: e.run_id,
      kind: nonEmpty(e.kind) ? e.kind : 'evidence',
      queued_at: e.queued_at || null,
      card: readJson(path.join(runDirAbs(roomDir, e.run_id), 'card.json'), null),
    });
  });
  return out;
}

function markSurfaced(roomDir, runId) {
  const ledger = grants.readRunLedger(roomDir, {});
  let marked = 0;
  const at = new Date().toISOString();
  const pending = list(ledger.pending_cards).map(function (raw) {
    const e = typeof raw === 'string' ? { run_id: raw, kind: 'evidence', surfaced: false } : raw;
    if (isObj(e) && e.run_id === runId && e.surfaced !== true) { marked += 1; return Object.assign({}, e, { surfaced: true, surfaced_at: at }); }
    return raw;
  });
  if (marked > 0) {
    try { saveLedger(roomDir, ledger, pending); } catch (_e) { return fail('write_failed'); }
  }
  return { ok: true, marked: marked };
}

// ---------------------------------------------------------------------------
// status and the next move
// ---------------------------------------------------------------------------
function status(roomDir, runId) {
  const loaded = loadPlan(roomDir, runId);
  if (!loaded.ok) return loaded;
  const plan = loaded.plan;
  const filed = filingOf(roomDir, runId);
  const hasRun = loadRun(roomDir, runId).ok;
  const state = readJson(path.join(runDirAbs(roomDir, runId), 'state.json'), null);
  const out = { ok: true, run_id: runId, mode: plan.mode, plan_status: plan.status, filed: !!filed, stage: 'planned', next: null };
  if (filed) { out.stage = 'filed'; out.next = 'next_framework'; return out; }
  if (hasRun) { out.stage = 'done'; out.next = 'basket'; return out; }
  if (plan.mode === 'deep' && isObj(state)) {
    out.stage = 'running';
    const n = deepMod.nextDeepStep(roomDir, runId);
    out.step = n.ok ? n.step : null;
    out.next = 'deep_next';
    return out;
  }
  const c = cardFor(roomDir, plan, {});
  if (c.next === 'run_quick' || c.next === 'deep_run') out.stage = 'approved';
  out.next = c.next;
  out.reason = c.reason || null;
  return out;
}

function nextMove(roomDir, run, plan) {
  const py = isObj(run) && isObj(run.pyramid) ? run.pyramid : (isObj(plan) ? plan.pyramid : null);
  const weak = pyramidMod.weakestBranch(py);
  if (!weak) return { none: true, reason: 'no_weak_branch' };
  const owner = ownerTemplate(weak.dimension, plan);
  const branch = { id: weak.id, label: weak.label, status: weak.status, dimension: weak.dimension };
  if (!owner) return { none: true, reason: 'branch_lens_unknown', branch: branch };
  const rung = isObj(plan) && isObj(plan.context) ? plan.context.rung : 'unknown';
  const nf = structure.nextFramework({ rung: rung, lensFramework: owner.framework });
  return Object.assign({ branch: branch, lens_framework: owner.framework }, nf);
}

// ---------------------------------------------------------------------------
// revise and escalate
// ---------------------------------------------------------------------------
function recomposeLeaf(leaf) {
  if (!isObj(leaf) || leaf.researchable !== true || leaf.corpus !== 'openalex' || !hasSlots(leaf)) return { ok: true, queries: [] };
  const c = families.composeForLeaf({ lens: leaf.lens, slots: leaf.slots, corpus: leaf.corpus }, { round: 1 });
  if (c.ok) return { ok: true, queries: c.queries };
  if (c.reason === 'unknown_lens') return { ok: true, queries: [] };
  return { ok: false, reason: c.reason, degrade: 'local-only' };
}

function revisePlan(roomDir, runId, edit, opts) {
  const loaded = loadPlan(roomDir, runId);
  if (!loaded.ok) return loaded;
  const plan = loaded.plan;
  if (isObj(readJson(path.join(runDirAbs(roomDir, runId), 'state.json'), null)) || loadRun(roomDir, runId).ok) return fail('run_started');
  const out = planMod.applyEdit(plan, edit, { recompose: function (arg) { return recomposeLeaf(arg.leaf); } });
  if (!out.ok) return out;
  const next = out.plan;
  attachQueries(next);
  const verdict = assess(next, [], plan.status);
  next.status = verdict.status;
  const valid = planMod.validatePlan(next);
  if (!valid.ok) return fail('invalid_after_edit', { errors: valid.errors.map(function (e) { return String(e).split(':')[0]; }) });
  next.plan_hash = planMod.planHash(next);
  // the reviewed plan changed, so a run approval for the old one no longer applies
  const stale = grants.findActiveGrant(roomDir, { lifetime: 'run', run_id: runId });
  if (stale) grants.revokeGrant(roomDir, stale.grant_id, {});
  try { savePlan(roomDir, next); } catch (_e) { return fail('state_write_failed'); }
  const c = cardFor(roomDir, next, {});
  return { ok: true, run_id: runId, status: next.status, mode: next.mode, revision: next.revision, plan: next, errors: verdict.errors, next: c.next, reason: c.reason || null, card: c.card, proposal: c.proposal, new_terms: c.new_terms };
}

function escalate(roomDir, runId, opts) {
  const loaded = loadPlan(roomDir, runId);
  if (!loaded.ok) return loaded;
  if (loaded.plan.mode !== 'quick') return fail('not_quick');
  const ran = loadRun(roomDir, runId);
  if (!ran.ok) return ran;
  const now = isObj(opts) && opts.now instanceof Date ? opts.now : new Date();
  const deep = quickMod.escalateToDeep(loaded.plan, ran.run);
  if (!deep) return fail('escalate_failed');
  deep.run_id = planMod.newRunId(now);
  const attached = attachQueries(deep);
  const verdict = assess(deep, [], null);
  deep.status = verdict.status;
  const valid = planMod.validatePlan(deep);
  if (!valid.ok) return fail('plan_invalid', { errors: valid.errors.map(function (e) { return String(e).split(':')[0]; }) });
  deep.plan_hash = planMod.planHash(deep);
  try { savePlan(roomDir, deep); } catch (_e) { return fail('state_write_failed'); }
  const c = cardFor(roomDir, deep, {});
  return {
    ok: true, run_id: deep.run_id, from_run_id: runId, status: deep.status, mode: 'deep', plan: deep, plan_hash: deep.plan_hash,
    errors: verdict.errors, local_only_leaves: attached.local_only, next: c.next, reason: c.reason || null, card: c.card,
  };
}

// ---------------------------------------------------------------------------
// deep-run steps that need the plan and the run grant together
// ---------------------------------------------------------------------------
function ensureDeepState(roomDir, runId) {
  const existing = deepMod.loadState(roomDir, runId);
  if (existing.ok) return { ok: true, existed: true };
  if (existing.reason !== 'no_state') return existing;
  const loaded = loadPlan(roomDir, runId);
  if (!loaded.ok) return loaded;
  const grant = grants.findActiveGrant(roomDir, { lifetime: 'run', run_id: runId });
  if (!grant) return fail('no_grant');
  const init = deepMod.initDeepState(roomDir, loaded.plan, grant, {});
  return init.ok ? { ok: true, existed: false } : init;
}

function deepNext(roomDir, runId) {
  const ready = ensureDeepState(roomDir, runId);
  if (!ready.ok) return ready;
  return deepMod.nextDeepStep(roomDir, runId);
}

function applyExtend(roomDir, runId, decision, opts) {
  const o = isObj(opts) ? opts : {};
  if (decision !== 'extend' && decision !== 'stop') return fail('bad_decision');
  if (decision === 'stop') return deepMod.applyExtendDecision(roomDir, runId, 'stop', {});
  const surface = surfaceOf(o.approvedVia);
  if (!surface) return fail('approval_required');
  return withDb(roomDir, o, function (db) {
    const nodeId = navigation.REASONING_NODE_ID('decision', 'research-extend-' + crypto.randomBytes(5).toString('hex'));
    const node = mintDecision(db, nodeId, 'Approved extending research run ' + runId + ' via ' + surface + '.', runId);
    if (!node || node.ok !== true) return fail('decision_node_failed');
    return deepMod.applyExtendDecision(roomDir, runId, 'extend', { approved_via: { surface: surface, decision_node_id: nodeId } });
  });
}

// ---------------------------------------------------------------------------
// rows, basket, filing
// ---------------------------------------------------------------------------
function allRecords(roomDir, runId) {
  const dir = runDirAbs(roomDir, runId);
  const main = readJson(path.join(dir, 'records.json'), null);
  if (isObj(main) && Array.isArray(main.records)) return main.records;
  let out = [];
  let names = [];
  try { names = fs.readdirSync(path.join(dir, 'lanes')).filter(function (n) { return /\.records\.json$/.test(n); }).sort(); } catch (_e) { names = []; }
  names.forEach(function (n) {
    const cur = readJson(path.join(dir, 'lanes', n), null);
    if (isObj(cur) && Array.isArray(cur.records)) out = out.concat(cur.records);
  });
  return out;
}

function validateRowsFor(roomDir, runId, rawRows) {
  const loaded = loadPlan(roomDir, runId);
  if (!loaded.ok) return loaded;
  const rows = Array.isArray(rawRows) ? rawRows : (isObj(rawRows) && Array.isArray(rawRows.rows) ? rawRows.rows : null);
  if (!rows) return fail('rows_not_a_list');
  const index = evidenceRows.recordsIndex(allRecords(roomDir, runId));
  const leafIds = loaded.plan.leaves.filter(function (l) { return l.researchable === true; }).map(function (l) { return l.id; });
  const res = evidenceRows.validateRows(rows, index, { leafIds: leafIds, lane: 'V', retrievedAt: new Date().toISOString() });
  const dropped = Object.keys(res.dropped).reduce(function (n, k) { return n + res.dropped[k]; }, 0);
  return { ok: true, run_id: runId, kept: res.rows.length, dropped_total: dropped, dropped: res.dropped, rows: res.rows };
}

// opts.sessionId / opts.deps (366-11): when a session id is present the basket mints one single-use release
// gate per offered canon term; deps is the injected Theo transport (tests). Neither changes the filing items.
function basketFor(roomDir, runId, opts) {
  const loaded = loadPlan(roomDir, runId);
  if (!loaded.ok) return loaded;
  if (filingOf(roomDir, runId)) return fail('already_filed');
  const ran = loadRun(roomDir, runId);
  if (!ran.ok) return ran;
  const items = filingMod.basketWithCanon(roomDir, ran.run, loaded.plan, isObj(opts) ? opts : {});
  return { ok: true, run_id: runId, items: items, card: filingMod.basketCard(items) };
}

// fileFromState: files only on an approved selection and an explicit approval
// surface. Whatever fileRun answers, including its report, comes back as is.
function fileFromState(roomDir, runId, selection, opts) {
  const o = isObj(opts) ? opts : {};
  const surface = surfaceOf(o.approvedVia);
  if (!surface) return fail('approved_via_required');
  const loaded = loadPlan(roomDir, runId);
  if (!loaded.ok) return loaded;
  if (filingOf(roomDir, runId)) return fail('already_filed');
  const ran = loadRun(roomDir, runId);
  if (!ran.ok) return ran;
  return filingMod.fileRun(roomDir, ran.run, loaded.plan, selection, { approvedVia: surface, now: o.now });
}

module.exports = {
  buildPlan: buildPlan,
  buildPlanLive: buildPlanLive,
  cardFor: cardFor,
  approveStandingGrant: approveStandingGrant,
  approvePlanReview: approvePlanReview,
  pendingCards: pendingCards,
  markSurfaced: markSurfaced,
  queuePendingCard: queuePendingCard,
  status: status,
  nextMove: nextMove,
  proposeGrant: proposeGrant,
  grantStatus: grantStatus,
  loadPlan: loadPlan,
  loadRun: loadRun,
  revisePlan: revisePlan,
  escalate: escalate,
  ensureDeepState: ensureDeepState,
  deepNext: deepNext,
  applyExtend: applyExtend,
  validateRowsFor: validateRowsFor,
  basketFor: basketFor,
  fileFromState: fileFromState,
  RUN_ID_RE: RUN_ID_RE,
  GRANT_ID_RE: GRANT_ID_RE,
};
