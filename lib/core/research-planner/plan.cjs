'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 05 -- the one Plan object of the research planner.
 *
 * What lives here (D-04, D-08, D-18, D-02a):
 *   - PLAN_SCHEMA / RUN_SCHEMA: mos.research-plan/1 and mos.research-run/1.
 *   - BUDGETS: the disclosed default caps, each its own top-level const so a
 *     floor-ledger line_anchor row can find it (D-03: numbers are proposed and
 *     measured in 363-20).
 *   - validatePlan / validateRunResult: plain validators returning
 *     { ok, errors[] }. Errors are short named codes ("code" or "code:detail").
 *   - planHash: sha256 over canonical JSON (sorted keys), excluding plan_hash,
 *     created_at and revision.
 *   - applyEdit: the navigator's edit operations. Pure (never mutates its
 *     input). Capped at MAX_PLAN_REVISIONS. There is no send-anyway path: any
 *     edit carrying a raw query string is refused, and a refusal never echoes a
 *     string from the edit. Anything that changes what is fetched goes through
 *     the injected recompose seam (363-08's composer and audit).
 *   - planReviewCard: the surface-neutral F.6 Plan Review card. The CLI renders
 *     it through AskUserQuestion, MCP through gate-render.cjs renderGate.
 *
 * Egress audit (Canon Part 8): nothing in this file sends anything. Prose in
 * pyramid, scqa, leaf questions and the perspective is LOCAL. Only
 * leaves[].queries[].q (already audited upstream) may ever cross, and only to
 * the corpus.
 *
 * Dependencies: node built-ins only (D-01, DRP363-18). Pure CJS, no fs, no
 * network. No em-dash or en-dash anywhere in this file.
 */

const nodeCrypto = require('node:crypto');

const PLAN_SCHEMA = 'mos.research-plan/1';
const RUN_SCHEMA = 'mos.research-run/1';

// ---------------------------------------------------------------------------
// Disclosed default budgets. One top-level const per number.
// DEEP_LANES_REQUESTED is clamped at run time by futures/orchestrator.cjs
// resolveFanoutCap; this file only documents the clamp, the run modules call it.
// ---------------------------------------------------------------------------
const QUICK_MAX_QUERIES = 3;
const QUICK_TOP_ROWS = 5;
const QUICK_CORPORA = 1;
const QUICK_TIME_BUDGET_MS = 60000;
const DEEP_LANES_REQUESTED = 4;
const DEEP_ROUNDS = 2;
const DEEP_R1_QUERIES_PER_LANE = 2;
const DEEP_RESULTS_PER_QUERY = 5;
const DEEP_MAX_SEARCHES = 16;
const DEEP_TIME_BUDGET_MS = 1200000;
const MAX_PLAN_REVISIONS = 3;
const MAX_LIMITER_CHARS = 240;
const PYRAMID_DEPTH_CAP = 3;

const BUDGETS = Object.freeze({
  QUICK_MAX_QUERIES: QUICK_MAX_QUERIES,
  QUICK_TOP_ROWS: QUICK_TOP_ROWS,
  QUICK_CORPORA: QUICK_CORPORA,
  QUICK_TIME_BUDGET_MS: QUICK_TIME_BUDGET_MS,
  DEEP_LANES_REQUESTED: DEEP_LANES_REQUESTED,
  DEEP_ROUNDS: DEEP_ROUNDS,
  DEEP_R1_QUERIES_PER_LANE: DEEP_R1_QUERIES_PER_LANE,
  DEEP_RESULTS_PER_QUERY: DEEP_RESULTS_PER_QUERY,
  DEEP_MAX_SEARCHES: DEEP_MAX_SEARCHES,
  DEEP_TIME_BUDGET_MS: DEEP_TIME_BUDGET_MS,
  MAX_PLAN_REVISIONS: MAX_PLAN_REVISIONS,
  PYRAMID_DEPTH_CAP: PYRAMID_DEPTH_CAP,
});

const MAX_QUERY_CHARS = 200;
const MAX_REASON_CHARS = 240;

// ---------------------------------------------------------------------------
// Frozen enums
// ---------------------------------------------------------------------------
function frozen(list) { return Object.freeze(list.slice()); }

const MODES = frozen(['quick', 'deep']);
const PLAN_STATUSES = frozen(['ready', 'incomplete', 'wish', 'local_only', 'needs_lens_leaves']);
const LEAF_ORIGINS = frozen(['user_stated', 'framework_dimension', 'mece_gap']);
const LEAF_STATUSES = frozen(['open', 'supported', 'contradicted', 'contested', 'unresolved', 'not_run']);
// 366-15 (D-09): 'theo' is a corpus too; its leaves carry canon-name slots and no composed query.
const CORPORA = frozen(['openalex', 'room', 'theo']);
const STOP_RULES = frozen(['cap', 'saturation', 'budget', 'time', 'plurality_required']);
const STOP_REASONS = frozen(['pass_complete', 'cap', 'saturation', 'budget', 'time', 'plurality_required', 'navigator_stop', 'reask']);
const VERDICTS = frozen(['settled', 'thin', 'contested', 'gap-confirmed', 'unresolved']);
const QUERY_OUTCOMES = frozen(['ok', 'empty_valid', 'failed', 'blocked', 'cache_hit']);
const TRIGGERS = frozen(['navigator', 'ambient']);
const FORUM_ROLES = frozen(['frustrated_insider', 'fresh_entrant', 'physics_grounder']);
const LIMITER_COLUMNS = frozen(['physics', 'assumed']);
const S_CURVE = frozen(['near_ceiling', 'headroom', 'unknown', 'contested']);
const PUSHED_BY = frozen(['field', 'self']);
const STEP_KINDS = frozen(['field', 'adoption']);
const ENGINES = frozen(['scientific-roadmapping', 'constraint-layer']);
const DEPTHS = frozen(['lite', 'full']);
const RUNGS = frozen(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked', 'unknown']);
const TREE_TYPES = frozen(['issue', 'hypothesis', 'decision']);
const STRUCTURE_SOURCES = frozen(['theo_ledger', 'theo_live', 'local_template']);
const GOVERNING_STATUSES = frozen(['restated', 'strengthened', 'weakened', 'split', 'unresolved']);
const GRANT_LIFETIMES = frozen(['standing', 'run']);
const CARD_SHAPES = frozen(['F.0', 'F.3', 'F.6', 'F.8', 'evidence']);
const DROP_KINDS = frozen(['path', 'limiter', 'leaf']);
const EDIT_OPS = frozen(['drop_leaf', 'add_leaf', 'reword_leaf', 'toggle_source', 'set_budget', 'toggle_counterevidence', 'toggle_scientific', 'drop_path', 'add_limiter']);
const BUDGET_FIELDS = frozen(['breadth', 'rounds', 'queries_per_round', 'results_per_query', 'max_searches', 'time_budget_ms']);

const RUN_ID_RE = /^rp-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isStr(v) { return typeof v === 'string'; }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function isInt(v) { return Number.isInteger(v); }
function inList(list, v) { return list.indexOf(v) !== -1; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

function budgetCaps(mode) {
  if (mode === 'quick') {
    return {
      breadth: QUICK_CORPORA,
      rounds: 1,
      queries_per_round: QUICK_MAX_QUERIES,
      results_per_query: QUICK_TOP_ROWS,
      max_searches: QUICK_MAX_QUERIES,
      time_budget_ms: QUICK_TIME_BUDGET_MS,
    };
  }
  return {
    breadth: DEEP_LANES_REQUESTED,
    rounds: DEEP_ROUNDS,
    queries_per_round: DEEP_R1_QUERIES_PER_LANE,
    results_per_query: DEEP_RESULTS_PER_QUERY,
    max_searches: DEEP_MAX_SEARCHES,
    time_budget_ms: DEEP_TIME_BUDGET_MS,
  };
}

// ---------------------------------------------------------------------------
// validatePlan
// ---------------------------------------------------------------------------
function validateQuery(q, leafId, idx, errors) {
  const at = leafId + ':' + idx;
  if (!isObj(q)) { errors.push('query_invalid:' + at); return; }
  if (!nonEmpty(q.q)) errors.push('query_q_missing:' + at);
  else if (q.q.length > MAX_QUERY_CHARS || /[\r\n]/.test(q.q)) errors.push('query_q_shape:' + at);
  if (!nonEmpty(q.q_hash)) errors.push('query_q_hash_missing:' + at);
  if (q.audit !== 'pass' && q.audit !== 'not_applicable') errors.push('query_audit_not_pass:' + at);
  if (!isInt(q.round) || q.round < 1) errors.push('query_round_invalid:' + at);
  if (!nonEmpty(q.template_id)) errors.push('query_template_missing:' + at);
}

function validateLeaf(leaf, seen, errors) {
  if (!isObj(leaf)) { errors.push('leaf_invalid'); return; }
  const id = nonEmpty(leaf.id) ? leaf.id : '?';
  if (!nonEmpty(leaf.id)) errors.push('leaf_id_missing');
  else if (seen[leaf.id]) errors.push('leaf_id_duplicate:' + id);
  else seen[leaf.id] = true;
  if (!nonEmpty(leaf.question)) errors.push('leaf_question_missing:' + id);
  if (!inList(LEAF_ORIGINS, leaf.origin)) errors.push('leaf_origin_invalid:' + id);
  if (!inList(CORPORA, leaf.corpus)) errors.push('leaf_corpus_invalid:' + id);
  if (!inList(LEAF_STATUSES, leaf.status)) errors.push('leaf_status_invalid:' + id);
  if (typeof leaf.researchable !== 'boolean') {
    errors.push('leaf_researchable_invalid:' + id);
  } else if (leaf.researchable === false) {
    if (!nonEmpty(leaf.not_researchable_reason)) errors.push('leaf_reason_missing:' + id);
  } else if (!isObj(leaf.falsifier) || !nonEmpty(leaf.falsifier.text)) {
    errors.push('leaf_falsifier_missing:' + id);
  }
  if (!Array.isArray(leaf.queries)) errors.push('leaf_queries_invalid:' + id);
  else leaf.queries.forEach(function (q, i) { validateQuery(q, id, i, errors); });
}

function validatePerspective(p, errors) {
  if (!isObj(p)) { errors.push('perspective_missing'); return; }
  if (!inList(ENGINES, p.engine)) errors.push('perspective_engine_invalid');
  if (!inList(DEPTHS, p.depth)) errors.push('perspective_depth_invalid');
  if (!isObj(p.tension)) errors.push('perspective_tension_missing');
  if (!isObj(p.goal)) errors.push('perspective_goal_missing');
  if (!isObj(p.rung_phrase)) errors.push('perspective_rung_phrase_missing');
  if (!Array.isArray(p.forum)) errors.push('perspective_forum_invalid');
  else {
    p.forum.forEach(function (f, i) {
      if (!isObj(f) || !inList(FORUM_ROLES, f.role)) errors.push('forum_role_invalid:' + i);
      else if (!isInt(f.pass_order) || f.pass_order < 1 || f.pass_order > 3) errors.push('forum_pass_order_invalid:' + i);
    });
  }
  if (!Array.isArray(p.paths)) errors.push('perspective_paths_invalid');
  if (!Array.isArray(p.limiters)) errors.push('perspective_limiters_invalid');
  else {
    p.limiters.forEach(function (l, i) {
      if (!isObj(l)) { errors.push('limiter_invalid:' + i); return; }
      if (!inList(LIMITER_COLUMNS, l.column)) errors.push('limiter_column_invalid:' + (l.id || i));
      if (!inList(S_CURVE, l.s_curve)) errors.push('limiter_s_curve_invalid:' + (l.id || i));
    });
  }
  if (!Array.isArray(p.unlock_chains)) errors.push('perspective_unlock_chains_invalid');
  else {
    p.unlock_chains.forEach(function (c, i) {
      if (!isObj(c) || !Array.isArray(c.steps)) { errors.push('unlock_chain_invalid:' + i); return; }
      c.steps.forEach(function (s, j) {
        if (!isObj(s) || !inList(PUSHED_BY, s.pushed_by)) errors.push('unlock_pushed_by_invalid:' + i + ':' + j);
        else if (!inList(STEP_KINDS, s.kind)) errors.push('unlock_step_kind_invalid:' + i + ':' + j);
      });
    });
  }
  if (!Array.isArray(p.ranking)) errors.push('perspective_ranking_invalid');
  if (!isObj(p.ratchet) || !Array.isArray(p.ratchet.discarded)) errors.push('perspective_ratchet_invalid');
  else {
    p.ratchet.discarded.forEach(function (d, i) {
      if (!isObj(d) || !inList(DROP_KINDS, d.kind)) errors.push('ratchet_discard_kind_invalid:' + i);
    });
  }
}

function validatePlan(plan) {
  const errors = [];
  if (!isObj(plan)) return { ok: false, errors: ['plan_not_object'] };

  if (plan.schema === undefined) errors.push('schema_missing');
  else if (plan.schema !== PLAN_SCHEMA) errors.push('schema_invalid');
  if (!isStr(plan.run_id) || !RUN_ID_RE.test(plan.run_id)) errors.push('run_id_invalid');
  const modeOk = inList(MODES, plan.mode);
  if (!modeOk) errors.push('mode_invalid');
  if (!isInt(plan.version) || plan.version < 1) errors.push('version_invalid');
  if (!isInt(plan.max_revisions) || plan.max_revisions < 0 || plan.max_revisions > MAX_PLAN_REVISIONS) errors.push('max_revisions_invalid');
  if (!isInt(plan.revision) || plan.revision < 0) errors.push('revision_invalid');
  else if (plan.revision > (isInt(plan.max_revisions) ? plan.max_revisions : MAX_PLAN_REVISIONS)) errors.push('revision_over_max');
  if (!inList(PLAN_STATUSES, plan.status)) errors.push('status_invalid');
  if (plan.parent_plan_hash !== null && !nonEmpty(plan.parent_plan_hash)) errors.push('parent_plan_hash_invalid');

  if (!isObj(plan.origin) || !nonEmpty(plan.origin.template_id) || !nonEmpty(plan.origin.command)) errors.push('origin_invalid');
  if (!isObj(plan.context) || !isObj(plan.context.scientific) || !Array.isArray(plan.context.scientific.signals)) errors.push('context_invalid');
  else if (!inList(RUNGS, plan.context.rung)) errors.push('context_rung_invalid');
  if (!isObj(plan.structure) || !inList(STRUCTURE_SOURCES, plan.structure.source) || !inList(TREE_TYPES, plan.structure.tree_type)) errors.push('structure_invalid');

  validatePerspective(plan.perspective, errors);

  if (!isObj(plan.pyramid)) errors.push('pyramid_missing');
  else {
    if (!inList(GOVERNING_STATUSES, plan.pyramid.governing_status)) errors.push('pyramid_governing_status_invalid');
    if (!Array.isArray(plan.pyramid.key_line)) errors.push('pyramid_key_line_invalid');
    if (!isObj(plan.pyramid.coverage) || !Array.isArray(plan.pyramid.coverage.uncovered)) errors.push('pyramid_coverage_invalid');
    if (!Array.isArray(plan.pyramid.dropped)) errors.push('pyramid_dropped_invalid');
    if (!isObj(plan.pyramid.mece) || !Array.isArray(plan.pyramid.mece.warnings)) errors.push('pyramid_mece_invalid');
  }

  if (!Array.isArray(plan.leaves) || plan.leaves.length === 0) errors.push('leaves_missing');
  else {
    const seen = {};
    plan.leaves.forEach(function (leaf) { validateLeaf(leaf, seen, errors); });
  }

  if (!isObj(plan.budget)) errors.push('budget_missing');
  else {
    const caps = modeOk ? budgetCaps(plan.mode) : null;
    BUDGET_FIELDS.forEach(function (f) {
      const v = plan.budget[f];
      if (!isInt(v) || v < 1) errors.push('budget_invalid:' + f);
      else if (caps && v > caps[f]) errors.push('budget_over_cap:' + f);
    });
    if (typeof plan.budget.counterevidence !== 'boolean') errors.push('budget_invalid:counterevidence');
    else if (plan.mode === 'deep' && plan.budget.counterevidence !== true) errors.push('counterevidence_mandatory');
  }

  if (!Array.isArray(plan.stop_rules) || !plan.stop_rules.every(function (r) { return inList(STOP_RULES, r); })) errors.push('stop_rules_invalid');
  if (plan.grant_ref !== null) {
    if (!isObj(plan.grant_ref) || !nonEmpty(plan.grant_ref.grant_id) || !inList(GRANT_LIFETIMES, plan.grant_ref.lifetime)) errors.push('grant_ref_invalid');
  }
  if (!isObj(plan.return_target) || !nonEmpty(plan.return_target.section)) errors.push('return_target_invalid');
  if (plan.plan_hash !== null && plan.plan_hash !== undefined && !nonEmpty(plan.plan_hash)) errors.push('plan_hash_invalid');

  return { ok: errors.length === 0, errors: errors };
}

// ---------------------------------------------------------------------------
// validateRunResult
// ---------------------------------------------------------------------------
const RUN_KEYS = Object.freeze([
  'schema', 'run_id', 'mode', 'plan_hash', 'grant_ref', 'trigger', 'started_at', 'finished_at', 'stop_reason',
  'queries', 'records_path', 'rows', 'dropped', 'leaves', 'verdict', 'answer_line', 'pyramid', 'perspective',
  'governing_status', 'unresolved_branches', 'opportunity_candidates', 'contradictions', 'escalation_offer',
  'local_checks', 'timings', 'filed',
]);

function validateRunResult(run) {
  const errors = [];
  if (!isObj(run)) return { ok: false, errors: ['run_not_object'] };
  RUN_KEYS.forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(run, k)) errors.push('run_key_missing:' + k);
  });
  if (run.schema !== undefined && run.schema !== RUN_SCHEMA) errors.push('run_schema_invalid');
  if (!inList(MODES, run.mode)) errors.push('run_mode_invalid');
  if (!inList(TRIGGERS, run.trigger)) errors.push('run_trigger_invalid');
  if (!inList(STOP_REASONS, run.stop_reason)) errors.push('run_stop_reason_invalid');
  if (run.mode === 'quick') {
    if (run.verdict !== null && !inList(VERDICTS, run.verdict)) errors.push('run_verdict_invalid');
  } else if (run.mode === 'deep' && run.verdict !== null && run.verdict !== undefined) {
    errors.push('run_verdict_quick_only');
  }
  if (run.governing_status !== undefined && run.governing_status !== null && !inList(GOVERNING_STATUSES, run.governing_status)) errors.push('run_governing_status_invalid');
  if (typeof run.filed !== 'boolean') errors.push('run_filed_invalid');
  else if (run.mode === 'quick' && run.filed === true) errors.push('run_quick_filed_true');
  if (Array.isArray(run.queries)) {
    run.queries.forEach(function (q, i) {
      if (!isObj(q) || !inList(QUERY_OUTCOMES, q.outcome)) errors.push('run_query_outcome_invalid:' + i);
    });
  } else if (run.queries !== undefined) {
    errors.push('run_queries_invalid');
  }
  if (run.leaves !== undefined && !Array.isArray(run.leaves)) errors.push('run_leaves_invalid');
  return { ok: errors.length === 0, errors: errors };
}

// ---------------------------------------------------------------------------
// planHash
// ---------------------------------------------------------------------------
const HASH_EXCLUDED = Object.freeze(['plan_hash', 'created_at', 'revision']);

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (isObj(value)) {
    return '{' + Object.keys(value).sort().filter(function (k) { return value[k] !== undefined; }).map(function (k) {
      return JSON.stringify(k) + ':' + canonical(value[k]);
    }).join(',') + '}';
  }
  if (value === undefined) return 'null';
  return JSON.stringify(value);
}

function planHash(plan) {
  const body = {};
  Object.keys(plan).forEach(function (k) {
    if (HASH_EXCLUDED.indexOf(k) === -1) body[k] = plan[k];
  });
  return 'sha256:' + nodeCrypto.createHash('sha256').update(canonical(body)).digest('hex');
}

function newRunId(now) {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return 'rp-' + d.toISOString().slice(0, 10) + '-' + nodeCrypto.randomBytes(4).toString('hex');
}

// ---------------------------------------------------------------------------
// applyEdit
// ---------------------------------------------------------------------------
function carriesRawQuery(value, depth) {
  if (depth > 8) return true;
  if (Array.isArray(value)) return value.some(function (v) { return carriesRawQuery(v, depth + 1); });
  if (isObj(value)) {
    if (Object.prototype.hasOwnProperty.call(value, 'q')) return true;
    return Object.keys(value).some(function (k) { return carriesRawQuery(value[k], depth + 1); });
  }
  return false;
}

function refuse(reason, extra) {
  return Object.assign({ ok: false, reason: reason }, extra || {});
}

function safeToken(v, fallback) {
  return isStr(v) && /^[a-z][a-z0-9_-]{0,40}$/.test(v) ? v : fallback;
}

function record(next, id, kind, reason) {
  const entry = { id: id, kind: kind, reason: reason, version: next.version };
  next.pyramid.dropped.push(clone(entry));
  next.perspective.ratchet.discarded.push(clone(entry));
}

function callRecompose(opts, leaf) {
  if (!opts || typeof opts.recompose !== 'function') return refuse('recompose_unavailable');
  let out;
  try {
    out = opts.recompose({ leaf: clone(leaf) });
  } catch (_e) {
    return refuse('recompose_failed');
  }
  if (!out || out.ok !== true || !Array.isArray(out.queries)) {
    return refuse(safeToken(out && out.reason, 'recompose_refused'), out && out.degrade ? { degrade: safeToken(out.degrade, 'local-only') } : {});
  }
  return { ok: true, queries: clone(out.queries) };
}

function findLeaf(next, id) {
  return next.leaves.find(function (l) { return l.id === id; }) || null;
}

function applyEdit(plan, edit, opts) {
  if (!isObj(plan)) return refuse('plan_invalid');
  if (!isObj(edit) || !inList(EDIT_OPS, edit.op)) return refuse('edit_invalid');
  // No send-anyway path: a raw query string in any edit is refused before
  // anything else, and the refusal carries none of the edit's strings.
  if (carriesRawQuery(edit, 0)) return refuse('raw_query_refused');
  const cap = isInt(plan.max_revisions) ? plan.max_revisions : MAX_PLAN_REVISIONS;
  if (!isInt(plan.revision) || plan.revision >= cap) return refuse('revision_cap');

  const before = planHash(plan);
  const next = clone(plan);
  next.version = plan.version + 1;
  if (!isObj(next.perspective.ratchet)) next.perspective.ratchet = { version: 1, parent_plan_hash: null, discarded: [], settled: [] };
  if (!Array.isArray(next.pyramid.dropped)) next.pyramid.dropped = [];

  const reason = isStr(edit.reason) ? edit.reason.trim() : '';
  let out;

  switch (edit.op) {
    case 'drop_leaf': {
      if (!nonEmpty(reason) || reason.length > MAX_REASON_CHARS) return refuse('reason_required');
      const leaf = findLeaf(next, edit.leaf_id);
      if (!leaf) return refuse('unknown_leaf');
      if (next.leaves.length === 1) return refuse('last_leaf');
      next.leaves = next.leaves.filter(function (l) { return l.id !== leaf.id; });
      next.pyramid.key_line.forEach(function (k) {
        if (Array.isArray(k.leaf_ids)) k.leaf_ids = k.leaf_ids.filter(function (id) { return id !== leaf.id; });
      });
      next.perspective.limiters.forEach(function (l) { if (l.leaf_id === leaf.id) l.leaf_id = null; });
      record(next, leaf.id, 'leaf', reason);
      break;
    }
    case 'add_leaf': {
      const src = isObj(edit.leaf) ? edit.leaf : null;
      if (!src || !nonEmpty(src.id) || !nonEmpty(src.question)) return refuse('leaf_invalid');
      if (findLeaf(next, src.id)) return refuse('leaf_id_duplicate');
      const researchable = src.researchable !== false;
      const leaf = {
        id: src.id,
        parent: nonEmpty(src.parent) ? src.parent : null,
        question: src.question,
        origin: 'user_stated',
        dimension: nonEmpty(src.dimension) ? src.dimension : 'navigator_added',
        lens: nonEmpty(src.lens) ? src.lens : 'navigator',
        source_command: nonEmpty(src.source_command) ? src.source_command : next.origin.command,
        researchable: researchable,
        not_researchable_reason: researchable ? null : (nonEmpty(src.not_researchable_reason) ? src.not_researchable_reason : null),
        falsifier: isObj(src.falsifier) ? { text: src.falsifier.text, template_id: src.falsifier.template_id || null } : { text: '', template_id: null },
        corpus: inList(CORPORA, src.corpus) ? src.corpus : 'openalex',
        slots: {},
        queries: [],
        priority: isInt(src.priority) ? src.priority : next.leaves.length + 1,
        status: 'open',
        limiter_id: null,
      };
      if (researchable) {
        out = callRecompose(opts, leaf);
        if (!out.ok) return out;
        leaf.queries = out.queries;
      }
      next.leaves.push(leaf);
      break;
    }
    case 'reword_leaf': {
      const leaf = findLeaf(next, edit.leaf_id);
      if (!leaf) return refuse('unknown_leaf');
      if (!nonEmpty(edit.question)) return refuse('question_required');
      leaf.question = edit.question;
      if (leaf.researchable) {
        out = callRecompose(opts, leaf);
        if (!out.ok) return out;
        leaf.queries = out.queries;
      }
      break;
    }
    case 'toggle_source': {
      const leaf = findLeaf(next, edit.leaf_id);
      if (!leaf) return refuse('unknown_leaf');
      if (!inList(CORPORA, edit.corpus)) return refuse('corpus_invalid');
      leaf.corpus = edit.corpus;
      if (leaf.researchable) {
        out = callRecompose(opts, leaf);
        if (!out.ok) return out;
        leaf.queries = out.queries;
      }
      break;
    }
    case 'set_budget': {
      if (!isObj(edit.budget) || Object.keys(edit.budget).length === 0) return refuse('budget_invalid');
      const caps = budgetCaps(next.mode);
      const keys = Object.keys(edit.budget);
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        const v = edit.budget[k];
        if (!inList(BUDGET_FIELDS, k)) return refuse('unknown_budget_field');
        if (!isInt(v) || v < 1) return refuse('budget_invalid');
        if (v > caps[k]) return refuse('over_cap');
        next.budget[k] = v;
      }
      break;
    }
    case 'toggle_counterevidence': {
      const want = typeof edit.value === 'boolean' ? edit.value : !next.budget.counterevidence;
      if (next.mode === 'deep' && want === false) return refuse('counterevidence_mandatory');
      next.budget.counterevidence = want;
      break;
    }
    case 'toggle_scientific': {
      next.context.scientific.is = !next.context.scientific.is;
      if (next.context.scientific.signals.indexOf('S5:navigator_toggle') === -1) next.context.scientific.signals.push('S5:navigator_toggle');
      break;
    }
    case 'drop_path': {
      if (!nonEmpty(reason) || reason.length > MAX_REASON_CHARS) return refuse('reason_required');
      const path = next.perspective.paths.find(function (p) { return p.id === edit.path_id; });
      if (!path) return refuse('unknown_path');
      next.perspective.paths = next.perspective.paths.filter(function (p) { return p.id !== path.id; });
      const gone = next.perspective.limiters.filter(function (l) { return l.path_id === path.id; }).map(function (l) { return l.id; });
      next.perspective.limiters = next.perspective.limiters.filter(function (l) { return gone.indexOf(l.id) === -1; });
      next.perspective.unlock_chains = next.perspective.unlock_chains.filter(function (c) { return gone.indexOf(c.limiter_id) === -1; });
      next.perspective.ranking = next.perspective.ranking.filter(function (r) { return gone.indexOf(rankingId(r)) === -1; });
      next.leaves.forEach(function (l) { if (gone.indexOf(l.limiter_id) !== -1) l.limiter_id = null; });
      if (gone.indexOf(next.perspective.next_binding_constraint) !== -1) {
        next.perspective.next_binding_constraint = next.perspective.ranking.length > 0 ? rankingId(next.perspective.ranking[0]) : null;
      }
      record(next, path.id, 'path', reason);
      gone.forEach(function (id) { record(next, id, 'limiter', 'path_dropped'); });
      break;
    }
    case 'add_limiter': {
      // The navigator names what blocks the gap, in their own words. The text is stored as given
      // (whitespace collapsed): never sent to the Brain (Canon Part 8, D-10 governs Theo). On the web
      // search lines it is a slot phrase like any other and leaves under the run's grant (SEED-115).
      const words = isStr(edit.statement) ? edit.statement.replace(/\s+/g, ' ').trim() : '';
      if (!nonEmpty(words)) return refuse('statement_required');
      if (words.length > MAX_LIMITER_CHARS) return refuse('statement_too_long');
      const taken = next.perspective.limiters.map(function (l) { return l.id; });
      let n = next.perspective.limiters.length + 1;
      while (taken.indexOf('LM' + n) !== -1) n += 1;
      const id = 'LM' + n;
      const target = nonEmpty(edit.leaf_id) ? findLeaf(next, edit.leaf_id)
        : next.leaves.find(function (l) { return l.researchable === true && l.corpus === 'openalex'; });
      next.perspective.limiters.push({
        id: id,
        path_id: null,
        leaf_id: target ? target.id : null,
        statement: words,
        column: 'assumed',
        derivation_row_id: null,
        s_curve: 'unknown',
        question: words,
        raised_by: 'navigator',
        settled_ref: null,
      });
      next.perspective.ranking.push({ limiter_id: id, length: 0, support: 0, rank: next.perspective.ranking.length + 1 });
      if (!nonEmpty(next.perspective.next_binding_constraint)) next.perspective.next_binding_constraint = id;
      if (isObj(next.perspective.tension) && next.perspective.tension.status === 'wish') next.perspective.tension.status = 'ok';
      break;
    }
    default:
      return refuse('edit_invalid');
  }

  next.revision = plan.revision + 1;
  next.parent_plan_hash = before;
  next.perspective.ratchet.version = next.version;
  next.perspective.ratchet.parent_plan_hash = before;
  const check = validatePlan(next);
  if (!check.ok) return refuse('invalid_after_edit', { errors: check.errors.map(function (e) { return String(e).split(':')[0]; }) });
  next.plan_hash = planHash(next);
  return { ok: true, plan: next, revision: next.revision };
}

// ---------------------------------------------------------------------------
// planReviewCard (F.6)
// ---------------------------------------------------------------------------
function oneLine(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
}

function cell(v) {
  return oneLine(v).replace(/\|/g, '/');
}

function minutes(ms) {
  return Math.round(ms / 60000) + ' min';
}

function roundOne(leaf) {
  return (leaf.queries || []).filter(function (q) { return q.round === 1 || q.round === undefined; });
}

function limiterCell(l) {
  if (!l) return '';
  const tag = l.s_curve && l.s_curve !== 'unknown' ? ' [' + String(l.s_curve).replace(/_/g, ' ') + ']' : '';
  return cell(l.id + ': ' + l.statement + tag);
}

// perspective.ranking is persisted in two shapes: {limiter_id, length, support,
// rank} objects from rankByUnlock() at build time, and plain id strings after a
// deep re-rank (deep.cjs). Neither shape is a contract change worth making, so
// every reader goes through these two accessors instead of checking the shape
// itself: rankingId(entry) names one entry, rankingIds(perspective) lists them.
function rankingId(entry) {
  if (entry && typeof entry === 'object') return typeof entry.limiter_id === 'string' ? entry.limiter_id : null;
  return typeof entry === 'string' ? entry : null;
}

function rankingIds(perspective) {
  const r = perspective && Array.isArray(perspective.ranking) ? perspective.ranking : [];
  return r.map(rankingId).filter(function (id) { return id !== null; });
}

// Name one ranked limiter by its id and statement.
function rankedLabel(r, limiters) {
  const id = rankingId(r);
  const l = (limiters || []).find(function (x) { return x && x.id === id; });
  return oneLine(id) + (l && nonEmpty(l.statement) ? ': ' + oneLine(l.statement) : '');
}

function perspectiveLines(plan) {
  const p = plan.perspective;
  const lines = [];
  lines.push('### Research perspective');
  lines.push('- Tension: ' + oneLine(p.tension.statement));
  const g = p.goal;
  const threshold = oneLine([g.threshold, g.unit].filter(nonEmpty).join(' '));
  lines.push('- Goal: ' + oneLine(g.target) + (threshold ? ' at ' + threshold : '') + (g.quantified ? '' : ' (not yet quantified)'));
  lines.push('- What would prove it wrong: ' + oneLine(g.falsifier));
  lines.push('- Roadmap type: ' + oneLine(p.rung_phrase.roadmap_type) + '; kind of idea: ' + oneLine(p.rung_phrase.idea_kind));
  if (p.depth === 'full') {
    lines.push('');
    lines.push('Forum, run one voice at a time:');
    p.forum.slice().sort(function (a, b) { return a.pass_order - b.pass_order; }).forEach(function (f) {
      const role = String(f.role).replace(/_/g, ' ');
      const said = f.contributed && f.contributed.length > 0 ? 'raised ' + f.contributed.join(', ') : 'nothing raised' + (f.none_reason ? ' (' + oneLine(f.none_reason) + ')' : '');
      lines.push('- ' + role + ' (pass ' + f.pass_order + '): ' + said);
    });
    if (p.paths.length > 0) {
      lines.push('');
      lines.push('Paths:');
      p.paths.forEach(function (x) {
        lines.push('- ' + x.id + ': ' + oneLine(x.label) + (x.from_10x ? ' (from the 10X resurvey)' : ''));
      });
    }
    const physics = p.limiters.filter(function (l) { return l.column === 'physics'; });
    const assumed = p.limiters.filter(function (l) { return l.column === 'assumed'; });
    lines.push('');
    lines.push('Limiters sorted by what kind of wall each one is:');
    lines.push('');
    lines.push('| Physics limiters (derived) | Assumed limiters (not yet re-tested) |');
    lines.push('|---|---|');
    const rows = Math.max(physics.length, assumed.length, 1);
    for (let i = 0; i < rows; i += 1) {
      lines.push('| ' + limiterCell(physics[i]) + ' | ' + limiterCell(assumed[i]) + ' |');
    }
    if (p.ranking.length > 0) {
      lines.push('');
      lines.push('Ranked by what each one unlocks downstream: ' + rankingIds(p).map(function (id) { return rankedLabel(id, p.limiters); }).join('; '));
      p.unlock_chains.forEach(function (c) {
        lines.push('- ' + c.limiter_id + ' unlocks a chain of ' + c.length + ' step' + (c.length === 1 ? '' : 's'));
      });
    }
    if (p.tensions.length > 0) {
      lines.push('');
      lines.push('Voices that disagree:');
      p.tensions.forEach(function (t) {
        lines.push('- ' + (t.roles || []).map(function (r) { return String(r).replace(/_/g, ' '); }).join(' vs ') + ': ' + oneLine(t.text));
      });
    }
  }
  return lines;
}

function planReviewCard(plan) {
  const deep = plan.mode === 'deep';
  const noun = deep ? 'deep research run' : 'quick research run';
  const lines = [];

  lines.push('## Plan for this ' + noun);
  lines.push('');
  lines.push('Question: ' + oneLine(plan.pyramid.stated_question));
  if (oneLine(plan.pyramid.governing_question) !== oneLine(plan.pyramid.stated_question)) {
    lines.push('Governing question: ' + oneLine(plan.pyramid.governing_question));
  }
  lines.push('Results go to: section ' + oneLine(plan.return_target.section) + (plan.return_target.card_id ? ' (card ' + oneLine(plan.return_target.card_id) + ')' : ''));
  lines.push('');

  lines.push('### Sub-questions and the exact searches');
  plan.leaves.forEach(function (leaf, i) {
    lines.push('');
    lines.push((i + 1) + '. ' + oneLine(leaf.question));
    lines.push('   - lens: ' + oneLine(leaf.lens) + '; asked by: ' + oneLine(leaf.source_command) + '; searches: ' + oneLine(leaf.corpus));
    if (!leaf.researchable) {
      lines.push('   - not run: ' + oneLine(leaf.not_researchable_reason));
      return;
    }
    lines.push('   - would be disproved by: ' + oneLine(leaf.falsifier && leaf.falsifier.text));
    const qs = roundOne(leaf);
    if (qs.length === 0) lines.push('   - round one: no search text yet');
    qs.forEach(function (q) {
      lines.push('   - round one search, sent exactly as written: ' + oneLine(q.q));
    });
  });
  lines.push('');
  lines.push('Every search below leaves exactly as written once you approve the run; nothing else from the room is sent.');
  lines.push('');

  const b = plan.budget;
  lines.push('### Budget (caps, not targets)');
  lines.push('- Max searches (cap): ' + b.max_searches);
  lines.push('- Searches per round (cap): ' + b.queries_per_round + '; results per search (cap): ' + b.results_per_query);
  lines.push('- Rounds (cap): ' + b.rounds + '; lanes requested (cap): ' + b.breadth);
  lines.push('- Time (cap): ' + minutes(b.time_budget_ms));
  lines.push('- Counterevidence: ' + (b.counterevidence ? 'on' : 'off'));
  lines.push('- Stops on: ' + (plan.stop_rules.length > 0 ? plan.stop_rules.join(', ') : 'nothing extra'));
  lines.push('');

  lines.push(perspectiveLines(plan).join('\n'));
  lines.push('');

  lines.push('### Checks on the plan');
  const warnings = plan.pyramid.mece.warnings || [];
  if (warnings.length === 0) lines.push('- No overlap or gap warnings.');
  warnings.forEach(function (w) { lines.push('- ' + oneLine(w)); });
  lines.push('');

  lines.push('### Questions not yet asked');
  const uncovered = plan.pyramid.coverage.uncovered || [];
  if (uncovered.length === 0) lines.push('- None found.');
  uncovered.forEach(function (d) { lines.push('- ' + oneLine(d) + ': no sub-question covers this yet'); });
  const notResearchable = plan.pyramid.coverage.not_researchable || [];
  if (notResearchable.length > 0) {
    lines.push('');
    lines.push('### Not researchable in this run');
    notResearchable.forEach(function (n) { lines.push('- ' + oneLine(n.dimension) + ': ' + oneLine(n.reason)); });
  }

  const body = lines.join('\n').replace(/[\u2014\u2013]/g, '-');
  const qHashes = [];
  plan.leaves.forEach(function (leaf) { roundOne(leaf).forEach(function (q) { qHashes.push(q.q_hash); }); });

  return {
    shape: 'F.6',
    title: 'Plan review: ' + noun,
    question: 'Run this plan as written, edit it, or stop?',
    options: [
      { id: 'run', label: 'Run this ' + noun + ' (Recommended)', recommended: true },
      { id: 'edit', label: 'Edit the plan' },
      deep ? { id: 'stop', label: 'Stop without running' } : { id: 'not_now', label: 'Not now' },
    ],
    body_md: body,
    payload: {
      run_id: plan.run_id,
      mode: plan.mode,
      plan_hash: planHash(plan),
      revision: plan.revision,
      max_revisions: plan.max_revisions,
      round_one_q_hashes: qHashes,
      section: plan.return_target.section,
    },
  };
}

module.exports = {
  PLAN_SCHEMA: PLAN_SCHEMA,
  RUN_SCHEMA: RUN_SCHEMA,
  BUDGETS: BUDGETS,
  MODES: MODES,
  LEAF_ORIGINS: LEAF_ORIGINS,
  LEAF_STATUSES: LEAF_STATUSES,
  STOP_REASONS: STOP_REASONS,
  VERDICTS: VERDICTS,
  FORUM_ROLES: FORUM_ROLES,
  LIMITER_COLUMNS: LIMITER_COLUMNS,
  S_CURVE: S_CURVE,
  CARD_SHAPES: CARD_SHAPES,
  EDIT_OPS: EDIT_OPS,
  validatePlan: validatePlan,
  validateRunResult: validateRunResult,
  planHash: planHash,
  newRunId: newRunId,
  applyEdit: applyEdit,
  rankingId: rankingId,
  rankingIds: rankingIds,
  planReviewCard: planReviewCard,
};
