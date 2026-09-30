'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 16 -- a room-started quick research run, inside a standing
 * grant, riding the 355.1 ambient child (D-03, D-05, D-10, D-11).
 *
 * lib/core/ambient-run.cjs runAmbientInChild calls maybeQuick once, after the
 * ambient composition and under the same lock. This module is not a trigger,
 * not a scheduler and not a sensor: there is no second ambient trigger.
 *
 * What it does, in order (every step returns an outcome and nothing throws):
 *   1. Only a whitespace finding counts: the composition's whitespace producer
 *      must have run, and the frozen whitespace-results.json (the file the
 *      ambient whitespace adapter itself reads) must hold a gap that spans at
 *      least COHORT_MIN_SECTIONS sections and carries a zone term. A gap that
 *      spans fewer is context_insufficient: no section is ever invented.
 *   2. The run must fit inside the remaining ambient budget, must not repeat
 *      the same delta hash, and must respect the separate research run ledger
 *      throttle (1 room-started run per room per hour). The strict 355.1
 *      ambient ledger and delta-state keys are never touched (Pitfall 18).
 *   3. The plan is composed through the one planner facade (families.cjs
 *      composes every search string; no model, no free text).
 *   4. With no standing grant, or on any re-ask reason (including the first use
 *      of a new search term, D-10), the room records a plan-only card and
 *      nothing leaves the room.
 *   5. With a covering grant, one quick run executes (runQuick, trigger
 *      ambient). The throttle slot is recorded before the first fetch. The
 *      evidence card is written unfiled under .mindrian/research-runs/<id>/
 *      and queued in the run ledger's pending_cards for the next research
 *      touchpoint (planner.pendingCards). Nothing is filed and no deep run
 *      ever starts here.
 *
 * Egress audit (Canon Part 8): the only outbound strings are whitespace-gap/v1
 * queries built from terms a human already approved into the standing grant,
 * validated per query by grants.validateExecutedQuery and audited again at the
 * corpus dispatch. Room text is never read into a query. The zone term is the
 * navigator-visible term on the gap; without one there is nothing to search.
 *
 * Hyphens only. No em-dash or en-dash in this file.
 */

const fs = require('node:fs');
const path = require('node:path');

const planMod = require('./plan.cjs');
const grants = require('./grants.cjs');

const STATE_DIR = path.join('.mindrian', 'research-runs');
const RUN_ID_RE = /^rp-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/;
const DELTA_HASH_RE = /^[0-9a-f]{64}$/;
const WHITESPACE_RESULTS = path.join('.mindrian', 'whitespace-results.json');
const TERM_MAX_CHARS = 120;

// SEED-097 cohort rule: a gap only counts when it spans at least this many
// room sections. Fewer is context_insufficient, never an invented section.
const COHORT_MIN_SECTIONS = 2;

const AMBIENT_OUTCOMES = Object.freeze([
  'skipped_no_whitespace',
  'context_insufficient',
  'plan_card_no_grant',
  'plan_card_reask',
  'throttled',
  'already_run_for_delta',
  'ran',
  'budget_exhausted',
  'error',
]);

// planner.pendingCards keys on this kind for every plan-only card.
const KIND_PLAN_ONLY = 'plan_card_no_grant';
const KIND_EVIDENCE = 'evidence';

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function noDash(s) { return String(s).replace(/[\u2014\u2013]/g, '-'); }
function normTerm(t) { return String(t).trim().toLowerCase(); }

function atomicWriteJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, noDash(JSON.stringify(data, null, 2)) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function outcome(name, extra) {
  return Object.assign({ outcome: name }, extra || {});
}

// Removes only a run directory this call created (id shape checked first).
function dropRunDir(roomDir, runId) {
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) return;
  try { fs.rmSync(path.join(roomDir, STATE_DIR, runId), { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

// ---------------------------------------------------------------------------
// gap reading
// ---------------------------------------------------------------------------
function readGaps(roomDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(roomDir, WHITESPACE_RESULTS), 'utf8'));
    return list(parsed && parsed.gaps).filter(isObj);
  } catch (_e) {
    return null;
  }
}

// Sections a gap spans: an explicit `sections` array wins; otherwise the first
// path segment of each nearest room artifact id (the field
// scripts/write-whitespace-sections.cjs derives sections from).
function sectionsOf(gap) {
  const seen = {};
  const out = [];
  function add(s) {
    const t = typeof s === 'string' ? s.trim() : '';
    if (t && !seen[t]) { seen[t] = true; out.push(t); }
  }
  if (Array.isArray(gap.sections) && gap.sections.length > 0) {
    gap.sections.forEach(add);
    return out;
  }
  list(gap.nearest_room_artifacts).forEach(function (a) {
    const id = typeof a === 'string' ? a : (isObj(a) && typeof a.artifact_id === 'string' ? a.artifact_id : '');
    const parts = id.split('/').filter(Boolean);
    if (parts.length >= 2) add(parts[0]);
  });
  return out;
}

function zoneTermOf(gap) {
  const t = typeof gap.zone_term === 'string' ? gap.zone_term.replace(/\s+/g, ' ').trim() : '';
  return t.length > 0 && t.length <= TERM_MAX_CHARS ? t : '';
}

// pickZone(gaps) -> {zone} | {reason}. Sparsest zone first (density ascending,
// then file order): the same order the whitespace surfaces use.
function pickZone(gaps) {
  const ordered = gaps.map(function (g, i) { return { g: g, i: i }; }).sort(function (a, b) {
    const da = typeof a.g.density_score === 'number' ? a.g.density_score : 0;
    const db = typeof b.g.density_score === 'number' ? b.g.density_score : 0;
    return da - db || a.i - b.i;
  });
  let fewSections = false;
  let noTerm = false;
  for (let k = 0; k < ordered.length; k += 1) {
    const g = ordered[k].g;
    const sections = sectionsOf(g);
    if (sections.length < COHORT_MIN_SECTIONS) { fewSections = true; continue; }
    const term = zoneTermOf(g);
    if (!term) { noTerm = true; continue; }
    return { zone: { term: term, sections: sections, zone_id: nonEmpty(g.zone_id) ? g.zone_id : null } };
  }
  return { reason: fewSections ? 'fewer_than_2_sections' : (noTerm ? 'no_zone_term' : 'no_gap') };
}

// ---------------------------------------------------------------------------
// whitespaceQuestionSet(zone, grant) -> a mos.research-question-set/1 for the
// whitespace template. Deterministic: built from the zone's term and section
// names and, for synonyms, only the terms the grant already approved for that
// same term. No model, no free text.
// ---------------------------------------------------------------------------
function whitespaceQuestionSet(zone, grant) {
  const z = isObj(zone) ? zone : {};
  const term = nonEmpty(z.term) ? z.term.trim() : '';
  const sections = list(z.sections).filter(nonEmpty);
  const synonyms = [];
  list(isObj(grant) ? grant.approved_terms : []).forEach(function (e) {
    if (!isObj(e) || !nonEmpty(e.term) || normTerm(e.term) !== normTerm(term)) return;
    list(e.synonyms).filter(nonEmpty).forEach(function (s) {
      if (synonyms.indexOf(s.trim()) === -1) synonyms.push(s.trim());
    });
  });
  const stated = 'Is there published work on ' + term + '?';
  const l2slots = { term: term };
  if (synonyms.length > 0) l2slots.synonyms = synonyms;
  return {
    schema: 'mos.research-question-set/1',
    template_id: 'whitespace',
    command: '/mos:whitespace',
    stated_question: stated,
    scqa: {
      situation: 'The room maps ' + (sections.length > 0 ? sections.join(' and ') : 'this zone') + '.',
      complication: 'One zone looks empty and may be a real gap.',
      question: 'Is the zone empty in the literature or only in the room?',
      answer_hypothesis: 'Empty in the room only.',
    },
    mode_hint: 'quick',
    perspective: {
      tension: { statement: 'Is this gap absent from the literature, or only from this room?' },
      goal: {
        target: 'Confirm or refute the gap.',
        threshold: null,
        unit: null,
        quantified: false,
        falsifier: 'evidence that the zone is already covered',
      },
      rung_phrase: { roadmap_type: 'exploration', idea_kind: 'open question' },
      forum: [],
      paths: [],
      limiters: [{
        id: 'L1',
        column: 'assumed',
        leaf_id: 'L1',
        statement: 'The gap is real: the literature holds no direct work on this zone.',
        question: 'Is there any direct published work on this zone?',
      }],
      unlock_chains: [],
      tensions: [],
    },
    key_line: [
      { id: 'K1', label: 'Gap claim', dimension: 'ws:gap_claim' },
      { id: 'K2', label: 'Covered under another term', dimension: 'ws:covered_elsewhere' },
      { id: 'K3', label: 'Extraction failure', dimension: 'ws:extraction_failure' },
    ],
    leaves: [
      {
        id: 'L1', parent: 'K1', question: stated, origin: 'user_stated',
        dimension: 'ws:gap_claim', lens: 'ws.gap', researchable: true,
        falsifier: { text: 'Any peer-reviewed paper that addresses the zone directly.' },
        slots: { term: term },
      },
      {
        id: 'L2', parent: 'K2', question: 'Is the same problem studied under a neighboring term?', origin: 'framework_dimension',
        dimension: 'ws:covered_elsewhere', lens: 'ws.covered_elsewhere', researchable: true,
        falsifier: { text: 'Papers under another term that answer the same question.' },
        slots: l2slots,
      },
      {
        id: 'L3', parent: 'K3', question: 'Does the room already hold an artifact naming this zone in other words?', origin: 'framework_dimension',
        dimension: 'ws:extraction_failure', lens: 'ws.extraction', researchable: true,
        falsifier: { text: 'A room artifact that already covers the zone.' },
        slots: {}, corpus: 'room',
      },
    ],
    coverage_notes: [],
    lens_selection: [],
    return_target: { section: sections.length > 0 ? sections[0] : 'market-analysis' },
  };
}

// ---------------------------------------------------------------------------
// plan-only card: written unfiled and queued for the next research touchpoint.
// Nothing here fetches. The card is the F.0 grant card; the proposal that would
// approve it sits beside it so the touchpoint can offer the approval.
// ---------------------------------------------------------------------------
function recordPlanOnly(roomDir, planner, plan, cover, nowMs) {
  const dir = path.join(roomDir, STATE_DIR, plan.run_id);
  const card = clone(cover.card);
  card.payload = Object.assign({}, isObj(card.payload) ? card.payload : {}, {
    ambient: true,
    plan_only: true,
    run_id: plan.run_id,
    reask_reason: cover.reason,
  });
  atomicWriteJson(path.join(dir, 'card.json'), card);
  if (isObj(cover.proposal)) {
    atomicWriteJson(path.join(dir, 'proposal.json'), { proposal: cover.proposal, new_terms: list(cover.new_terms) });
  }
  const q = planner.queuePendingCard(roomDir, { run_id: plan.run_id, kind: KIND_PLAN_ONLY, now: nowMs });
  return q && q.ok === true;
}

function hasPendingPlanOnly(roomDir) {
  try {
    const ledger = grants.readRunLedger(roomDir, {});
    const hit = list(ledger.pending_cards).filter(function (e) {
      return isObj(e) && e.kind === KIND_PLAN_ONLY && e.surfaced !== true && RUN_ID_RE.test(String(e.run_id));
    })[0];
    return hit ? hit.run_id : null;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// maybeQuick(roomDir, compResult, {budgetMs, deps, now, deltaHash})
//   -> Promise<{outcome, run_id?, reason?}>. Never throws.
// deps (all optional): fetchEnvelopeFn (replay seam), rowsProvider.
// ---------------------------------------------------------------------------
async function maybeQuickInner(roomDir, compResult, opts) {
  const o = isObj(opts) ? opts : {};
  const deps = isObj(o.deps) ? o.deps : {};
  const nowMs = Number.isFinite(o.now) ? o.now : Date.now();
  const deltaHash = typeof o.deltaHash === 'string' && DELTA_HASH_RE.test(o.deltaHash) ? o.deltaHash : null;
  const need = planMod.BUDGETS.QUICK_TIME_BUDGET_MS;
  const budgetMs = Number.isFinite(o.budgetMs) ? o.budgetMs : need;
  if (!nonEmpty(roomDir)) return outcome('error', { reason: 'room_required' });

  // 1. a whitespace finding that spans the cohort
  const ws = isObj(compResult) && isObj(compResult.producers) ? compResult.producers.whitespace : null;
  const ranOk = isObj(ws) && (ws.outcome === 'no_candidate' || ws.outcome === 'filed');
  if (!ranOk) return outcome('skipped_no_whitespace');
  const gaps = readGaps(roomDir);
  if (!gaps || gaps.length === 0) return outcome('skipped_no_whitespace');
  const picked = pickZone(gaps);
  if (!picked.zone) return outcome('context_insufficient', { reason: picked.reason });

  // 2. budget, once per delta, throttle
  if (!(budgetMs >= need)) return outcome('budget_exhausted');
  if (deltaHash) {
    const ledger = grants.readRunLedger(roomDir, { now: nowMs });
    const seen = list(ledger.runs).some(function (r) { return isObj(r) && r.trigger === 'ambient' && r.delta_hash === deltaHash; });
    if (seen) return outcome('already_run_for_delta');
  }
  const standing = grants.findActiveGrant(roomDir, { now: nowMs, lifetime: 'standing' });
  if (standing && !grants.throttleState(roomDir, { now: nowMs }).allowed_next) return outcome('throttled');

  // 3. one plan through the one facade
  const planner = require('./planner.cjs');
  const quickMod = require('./quick.cjs');
  const qs = whitespaceQuestionSet(picked.zone, standing);
  const built = planner.buildPlan(roomDir, qs, { mode: 'quick', now: new Date(nowMs), section: qs.return_target.section });
  if (!built || built.ok !== true) return outcome('error', { reason: 'plan_invalid' });
  const plan = built.plan;
  if (built.status !== 'ready') {
    dropRunDir(roomDir, plan.run_id);
    return outcome('error', { reason: 'plan_' + built.status });
  }

  // 4. no grant, or any re-ask: a plan-only card, zero egress
  const cover = quickMod.coverFor(roomDir, plan, { trigger: 'ambient', now: nowMs });
  if (cover.covered !== true) {
    if (cover.reason === 'throttle_exceeded') {
      dropRunDir(roomDir, plan.run_id);
      return outcome('throttled');
    }
    if (!isObj(cover.card)) {
      dropRunDir(roomDir, plan.run_id);
      return outcome('error', { reason: String(cover.reason || 'not_covered') });
    }
    const name = cover.reason === 'no_grant' ? 'plan_card_no_grant' : 'plan_card_reask';
    const pending = hasPendingPlanOnly(roomDir);
    if (pending) {
      // one unsurfaced plan-only card at a time: a room delta must not stack cards
      dropRunDir(roomDir, plan.run_id);
      return outcome(name, { reason: cover.reason, run_id: pending, deduped: true });
    }
    if (!recordPlanOnly(roomDir, planner, plan, cover, nowMs)) {
      dropRunDir(roomDir, plan.run_id);
      return outcome('error', { reason: 'card_write_failed' });
    }
    return outcome(name, { reason: cover.reason, run_id: plan.run_id });
  }

  // 5. a covering grant: record the throttle slot first, then one quick run
  const rec = grants.recordRun(roomDir, { run_id: plan.run_id, mode: 'quick', trigger: 'ambient', delta_hash: deltaHash, now: nowMs });
  if (!rec || rec.ok !== true) {
    dropRunDir(roomDir, plan.run_id);
    return outcome('error', { reason: 'ledger_write_failed' });
  }
  const res = await quickMod.runQuick(roomDir, plan, {
    trigger: 'ambient',
    recordInLedger: false,
    fetchEnvelopeFn: typeof deps.fetchEnvelopeFn === 'function' ? deps.fetchEnvelopeFn : undefined,
    rowsProvider: typeof deps.rowsProvider === 'function' ? deps.rowsProvider : undefined,
    budgetMs: Math.min(budgetMs, need),
    now: nowMs,
  });
  if (res && res.status === 'done') {
    planner.queuePendingCard(roomDir, { run_id: plan.run_id, kind: KIND_EVIDENCE, now: nowMs });
    return outcome('ran', { run_id: plan.run_id, verdict: res.run && res.run.verdict });
  }
  if (res && res.status === 'reask') {
    if (res.reason === 'throttle_exceeded') return outcome('throttled');
    if (isObj(res.card) && !hasPendingPlanOnly(roomDir)) {
      recordPlanOnly(roomDir, planner, plan, { reason: res.reason, card: res.card, proposal: res.proposal, new_terms: res.new_terms }, nowMs);
    }
    return outcome('plan_card_reask', { reason: res.reason, run_id: plan.run_id });
  }
  return outcome('error', { reason: String((res && res.reason) || 'run_refused') });
}

async function maybeQuick(roomDir, compResult, opts) {
  try {
    return await maybeQuickInner(roomDir, compResult, opts);
  } catch (_e) {
    return outcome('error', { reason: 'exception' });
  }
}

module.exports = {
  maybeQuick: maybeQuick,
  whitespaceQuestionSet: whitespaceQuestionSet,
  AMBIENT_OUTCOMES: AMBIENT_OUTCOMES,
  COHORT_MIN_SECTIONS: COHORT_MIN_SECTIONS,
};
