'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 05 -- the Scientific Roadmapping door. layer: loop
 *
 * Plain English: this is the walker for /mos:scientific-roadmap. It takes
 * Theo's authored steps in the order Theo gave them, keeps a small run state
 * (which stage is done, skipped with a stand-in, rejected or deferred), and
 * refuses to let Path Enumeration or Constraint Interrogation start until a
 * systems pass has been done, stood in by a filed systems artifact, or
 * declined with a reason. It then turns the finished walk into a question set
 * on the 363 scientific-roadmapping template and hands it to the one planner.
 *
 * Decision labels:
 *   SYS    systems pass before paths and limiters, enforced in code, also for
 *          a mid-journey entry.
 *   HYP    Stage B: each ranked assumed limiter becomes a falsifiable
 *          hypothesis leaf (claim, why it unlocks, refutation test, evidence
 *          tier) for the F.6 review and /mos:research.
 *   NR-1   a filed reverse-salient finding must enter Constraint
 *          Interrogation as a limiter row or be dismissed with a reason.
 *   THEO-C step CONTENT comes only from Theo (the readSrSteps result passed
 *          in); this module never displays a ledger step, a local step
 *          template or remembered step text.
 *   NV-2   no authored Theo step means no walk: createRun refuses.
 *
 * D-18 reuse contract: a door, not an engine. The engine is
 * perspective.cjs (api_version bound to '1', fail closed), the planner is
 * planner.buildPlan. This module adds no engine, ledger, fetcher, cache or
 * approval ledger.
 *
 * Canon Part 3: the ranking stage (sr:7) is an APPROVE / REJECT with reason /
 * DEFER gate; a reject without a reason is refused.
 * Canon Part 8: nothing here calls the Brain. The only network-adjacent thing
 * is the planner's own egress-audited query composition, unchanged.
 * Canon Part 9: this module writes nothing to the room. The plan save happens
 * inside planner.buildPlan (the F.6 review object, the /mos:research
 * precedent); it is not filing.
 * Canon Part 12: no grades or scores appear in any string here.
 *
 * recordStage and createRun are pure: the input state is never mutated.
 * Hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const Q = require('./question-templates.cjs');
const basePerspective = require('./perspective.cjs');
const { REFUSAL_TEXT } = require('./sr-steps.cjs');

const COMMAND = '/mos:scientific-roadmap';
const TEMPLATE_ID = 'scientific-roadmapping';
const ENGINE_API_VERSION = '1';
const STATE_SCHEMA = 'mos.sr-door-state/1';
const MAX_OUTPUT_CHARS = 20000;
const MAX_TEXT = 280;
const MAX_PLAN_BYTES = 2 * 1024 * 1024;
const RUN_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PLAN_STAND_IN_KINDS = Object.freeze(['sr_plan', 'quantified_plan']);

const STAGES = Object.freeze(['sr:1', 'sr:2', 'sr:3', 'sr:4', 'systems_pass', 'sr:5', 'sr:6', 'sr:7', 'stage_b', 'filing']);
// The entry gate is F.1 and lives before createRun.
const STAGE_GATES = Object.freeze({
  'sr:1': 'F.0', 'sr:2': 'F.0', 'sr:3': 'F.0', 'sr:4': 'F.0',
  systems_pass: 'F.1',
  'sr:5': 'F.4', 'sr:6': 'F.8', 'sr:7': 'F.0',
  stage_b: 'F.6', filing: 'F.8',
});
const STAGE_FIELD = Object.freeze({
  'sr:1': 'tension', 'sr:2': 'goal', 'sr:3': 'rung_phrase', 'sr:4': 'forum',
  'sr:5': 'paths', 'sr:6': 'limiters', 'sr:7': 'unlock_chains',
});
const DECISIONS = Object.freeze(['approve', 'reject', 'defer']);

const RUBRIC = Object.freeze({
  label: 'plugin-side rubric, not Theo content',
  source: 'SEED-106 item 2: Theo carries no scientific-method content yet; the plugin carries this until Theo ingests it',
  items: Object.freeze([
    Object.freeze({ id: 'falsifiability', check: 'Name the observation that would show this limiter is not real; if none exists, the limiter is a belief, not a hypothesis.' }),
    Object.freeze({ id: 'controls', check: 'Name what must be held fixed so a test isolates this limiter and nothing else.' }),
    Object.freeze({ id: 'priors', check: 'Say what earlier work already tried on this limiter and what it found.' }),
    Object.freeze({ id: 'mechanism_vs_property', check: 'Say whether the limit comes from a mechanism that can change or from a property that cannot.' }),
  ]),
});

// ----------------------------------------------------------------- helpers
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function arr(v) { return Array.isArray(v) ? v : []; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function cap(s) {
  const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
  return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) : t;
}
function fail(reason, extra) { return Object.assign({ ok: false, reason: reason }, extra || {}); }

function rubricLines() {
  const lines = ['### Scientific-method rubric (' + RUBRIC.label + ')', '', 'Source: ' + RUBRIC.source + '.', ''];
  RUBRIC.items.forEach(function (i) { lines.push('- ' + i.id + ': ' + i.check); });
  return lines.join('\n') + '\n';
}

function describeDoor() {
  return { command: COMMAND, template_id: TEMPLATE_ID, engine_api_version: ENGINE_API_VERSION, stages: STAGES };
}

// ------------------------------------------------------------------ mapSteps
// Case-insensitive label equality to the seven operation names first; failing
// that, exactly seven runnable rows map by position; anything else refuses and
// never fills a step in.
function mapSteps(steps) {
  const rows = arr(steps).filter(function (s) {
    return isObj(s) && nonEmpty(s.stepId) && s.stepKind !== 'DEFINITION' && s.stepKind !== 'ASIDE';
  });
  const ops = basePerspective.SR_OPERATIONS;
  const byLabel = {};
  const map = {};
  rows.forEach(function (s) {
    if (nonEmpty(s.label)) {
      const k = s.label.trim().toLowerCase();
      byLabel[k] = byLabel[k] === undefined ? s.stepId : null;
    }
  });
  let all = true;
  ops.forEach(function (name, i) {
    const id = byLabel[name.toLowerCase()];
    if (typeof id === 'string') map['sr:' + (i + 1)] = id; else all = false;
  });
  if (all && new Set(Object.keys(map).map(function (k) { return map[k]; })).size === ops.length) {
    return { ok: true, mapping: 'label', map: map };
  }
  if (rows.length === ops.length) {
    const byPos = {};
    rows.forEach(function (s, i) { byPos['sr:' + (i + 1)] = s.stepId; });
    return { ok: true, mapping: 'position', map: byPos };
  }
  return { ok: false, reason: 'step_map_unresolved', runnable: rows.length };
}

// ------------------------------------------------------------------ createRun
function toDate(now) {
  if (now instanceof Date && !Number.isNaN(now.getTime())) return now;
  if (typeof now === 'string' || typeof now === 'number') {
    const d = new Date(now);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function blankStage() { return { status: 'pending', output: null, decision: null, reason: null, stand_in: null }; }

function createRun(input) {
  const o = isObj(input) ? input : {};
  const entry = isObj(o.entry) ? o.entry : {};
  const candidates = entry.what && Array.isArray(entry.what.candidates) ? entry.what.candidates : [];
  const pick = isObj(o.confirmedWhat) ? o.confirmedWhat : (candidates[0] || null);
  if (!entry.what || entry.what.status === 'missing' || !isObj(pick) || !nonEmpty(pick.id) || !nonEmpty(pick.text)) {
    return fail('what_missing');
  }
  const theo = isObj(o.theo) ? o.theo : null;
  if (!theo || theo.ok !== true || !Array.isArray(theo.steps)) {
    const tr = theo && nonEmpty(theo.reason) ? theo.reason : 'theo_missing';
    const message = tr === 'step_unauthored' ? REFUSAL_TEXT : (theo && nonEmpty(theo.message) ? theo.message : 'Theo steps could not be read: ' + tr);
    return fail('theo_refused', { theo_reason: tr, message: message, offer: '/mos:research' });
  }
  const mapped = mapSteps(theo.steps);
  if (!mapped.ok) return mapped;

  const proposed = Number.isInteger(entry.proposed_step) ? entry.proposed_step : 1;
  const chosen = o.chosenStep === undefined || o.chosenStep === null ? proposed : o.chosenStep;
  if (!Number.isInteger(chosen) || chosen < 1 || chosen > 7 || chosen > proposed) return fail('chosen_step_invalid');

  const when = toDate(o.now);
  const iso = when.toISOString();
  const tag = 'sr-' + iso.slice(0, 10).replace(/-/g, '') + '-' + crypto.createHash('sha256').update(String(pick.id) + '|' + iso).digest('hex').slice(0, 8);

  const stages = {};
  STAGES.forEach(function (id) { stages[id] = blankStage(); });
  const skipped = arr(entry.not_run).filter(isObj);
  for (let n = 1; n < chosen; n += 1) {
    const hit = skipped.filter(function (s) { return s.step === n; })[0];
    stages['sr:' + n] = { status: 'not_run', output: null, decision: null, reason: null, stand_in: hit && isObj(hit.stand_in) ? clone(hit.stand_in) : null };
  }

  const coverage = isObj(o.coverage) ? o.coverage : {};
  const state = {
    schema: STATE_SCHEMA,
    run_tag: tag,
    created_at: iso,
    entry: {
      what: { kind: cap(pick.kind), id: cap(pick.id), text: cap(pick.text) },
      proposed_step: proposed,
      chosen_step: chosen,
      rule: nonEmpty(entry.rule) ? entry.rule : null,
      not_run: clone(skipped),
      bound: clone(isObj(entry.bound) ? entry.bound : { reverse_salients: [], dominant_designs: [], futures: [], systems: [] }),
      rung: clone(isObj(entry.rung) ? entry.rung : { rung: 'unknown', source: 'none' }),
      rooting: clone(isObj(entry.rooting) ? entry.rooting : {}),
      provisional_ranking: entry.provisional_ranking === true,
    },
    theo: {
      framework_status: nonEmpty(theo.framework_status) ? theo.framework_status : null,
      steps: theo.steps.filter(isObj).map(function (s) { return { stepId: s.stepId, label: s.label === undefined ? null : s.label, stepKind: s.stepKind === undefined ? null : s.stepKind }; }),
      map: mapped.map,
      mapping: mapped.mapping,
    },
    coverage: { status: nonEmpty(coverage.status) ? coverage.status : 'unavailable', problem_type: nonEmpty(coverage.problem_type) ? coverage.problem_type : null },
    stages: stages,
    discarded: [],
    plan_ref: null,
  };
  return { ok: true, state: state };
}

// ------------------------------------------------------------ stage machine
function nextStage(state) {
  if (!isObj(state) || !isObj(state.stages)) return null;
  for (let i = 0; i < STAGES.length; i += 1) {
    const rec = state.stages[STAGES[i]];
    if (!rec || (rec.status !== 'done' && rec.status !== 'not_run')) return STAGES[i];
  }
  return null;
}

function systemsSatisfied(state) {
  const rec = state.stages.systems_pass;
  return !!rec && (rec.status === 'done' || rec.status === 'not_run');
}

function boundForStage(state, stageId) {
  const bound = isObj(state) && isObj(state.entry) && isObj(state.entry.bound) ? state.entry.bound : {};
  if (stageId === 'sr:5') return { candidate_routes: arr(bound.dominant_designs).concat(arr(bound.futures)) };
  if (stageId === 'sr:6') return { first_rows: arr(bound.reverse_salients).slice() };
  if (stageId === 'systems_pass') return { systems: arr(bound.systems).slice(), offer: ['/mos:systems-thinking', '/mos:analyze-systems'] };
  return {};
}

function routeIds(output) {
  const o = isObj(output) ? output : {};
  const list = arr(o.paths).length > 0 ? arr(o.paths) : arr(o.routes);
  const ids = [];
  list.forEach(function (p) {
    if (isObj(p) && nonEmpty(p.id)) ids.push(p.id);
    else if (isObj(p) && nonEmpty(p.label)) ids.push(p.label);
  });
  return ids;
}

function recordStage(state, stageId, outcome) {
  if (!isObj(state) || !isObj(state.stages)) return fail('state_invalid');
  if (STAGES.indexOf(stageId) === -1) return fail('stage_unknown');
  if (!isObj(outcome) || DECISIONS.indexOf(outcome.decision) === -1) return fail('decision_invalid');

  const s = clone(state);
  // SYS: paths and limiters need the systems pass first, whatever the entry step.
  if ((stageId === 'sr:5' || stageId === 'sr:6') && !systemsSatisfied(s)) return fail('systems_pass_required');
  if (nextStage(s) !== stageId) return fail('stage_out_of_order:' + stageId);

  const decision = outcome.decision;
  const hasOutput = outcome.output !== undefined && outcome.output !== null;
  if (hasOutput) {
    if (!isObj(outcome.output)) return fail('output_invalid');
    if (JSON.stringify(outcome.output).length > MAX_OUTPUT_CHARS) return fail('output_too_large');
  }
  const rec = s.stages[stageId];

  if (decision === 'reject') {
    if (!nonEmpty(outcome.reason)) return fail('reason_required');
    rec.status = 'rejected'; rec.decision = 'reject'; rec.reason = outcome.reason.trim(); rec.output = hasOutput ? clone(outcome.output) : null;
    routeIds(outcome.output).forEach(function (id) { s.discarded.push({ kind: 'route', id: id, reason: rec.reason }); });
    return { ok: true, state: s };
  }
  if (decision === 'defer') {
    rec.status = 'deferred'; rec.decision = 'defer'; rec.reason = nonEmpty(outcome.reason) ? outcome.reason.trim() : null; rec.output = hasOutput ? clone(outcome.output) : null;
    return { ok: true, state: s, paused: true };
  }

  // approve
  if (stageId === 'systems_pass') {
    const standIn = isObj(outcome.stand_in) ? outcome.stand_in.id : outcome.stand_in;
    if (standIn !== undefined && standIn !== null) {
      const known = arr(s.entry.bound && s.entry.bound.systems);
      if (!nonEmpty(standIn) || known.indexOf(standIn) === -1) return fail('stand_in_unknown:' + String(standIn));
      rec.status = 'not_run'; rec.decision = 'stand_in'; rec.stand_in = { kind: 'systems', id: standIn }; rec.output = null; rec.reason = null;
      return { ok: true, state: s };
    }
    if (outcome.status === 'declined') {
      if (!nonEmpty(outcome.reason)) return fail('reason_required');
      rec.status = 'not_run'; rec.decision = 'declined'; rec.reason = outcome.reason.trim(); rec.output = null;
      return { ok: true, state: s };
    }
    rec.status = 'done'; rec.decision = 'approve'; rec.output = hasOutput ? clone(outcome.output) : null; rec.reason = null;
    return { ok: true, state: s };
  }

  if (STAGE_FIELD[stageId] && !hasOutput) return fail('output_invalid');

  if (stageId === 'sr:6') {
    const rows = arr(outcome.output && outcome.output.limiters).filter(isObj);
    const fromRows = rows.map(function (l) { return l.source_node_id; }).filter(nonEmpty);
    const dismissed = arr(outcome.dismissed).filter(isObj);
    for (let i = 0; i < dismissed.length; i += 1) {
      if (!nonEmpty(dismissed[i].id)) return fail('output_invalid');
      if (!nonEmpty(dismissed[i].reason)) return fail('reason_required');
    }
    const dismissedIds = dismissed.map(function (d) { return d.id; });
    const open = arr(s.entry.bound && s.entry.bound.reverse_salients).filter(function (id) {
      return fromRows.indexOf(id) === -1 && dismissedIds.indexOf(id) === -1;
    });
    if (open.length > 0) return fail('bound_input_unaddressed:' + open[0]);
    dismissed.forEach(function (d) { s.discarded.push({ kind: 'reverse_salient', id: d.id, reason: d.reason.trim() }); });
  }

  rec.status = 'done'; rec.decision = 'approve'; rec.output = hasOutput ? clone(outcome.output) : null;
  rec.reason = nonEmpty(outcome.reason) ? outcome.reason.trim() : null;
  return { ok: true, state: s };
}

module.exports = {
  COMMAND,
  TEMPLATE_ID,
  STAGES,
  STAGE_GATES,
  STAGE_FIELD,
  RUBRIC,
  rubricLines,
  describeDoor,
  mapSteps,
  createRun,
  nextStage,
  recordStage,
  boundForStage,
};
