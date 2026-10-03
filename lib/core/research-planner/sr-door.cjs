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
 *   CMP-1  (Plan 14, navigator ruling 2026-10-03) a hypothesis in flight, an
 *          explored opportunity or a Phase 355 stamped finding, follows the
 *          same rule as a reverse salient: the entry carries it into the run
 *          state (entry.in_flight), step 6 lists it after the reverse
 *          salients, and recordStage refuses step 6 until each one is a limiter
 *          row (source_node_id) or is dismissed with a reason. The stamp lines
 *          are carried exactly as the entry gave them (never collapsed, never
 *          re-worded); this module reads no stamp itself.
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

// The in-flight rows the entry resolver found (Plan 14). Ids and the opaque
// stamp lines only; the lines are copied as they are, never through cap().
function carryInFlight(entry) {
  return arr(entry.in_flight).filter(function (r) { return isObj(r) && nonEmpty(r.opportunity_id); }).slice(0, 50).map(function (r) {
    return {
      opportunity_id: cap(r.opportunity_id),
      source: nonEmpty(r.source) ? cap(r.source) : null,
      depends_on: arr(r.depends_on).filter(nonEmpty).slice(0, 4).map(cap),
      stamp_lines: arr(r.stamp_lines).filter(function (l) { return typeof l === 'string'; }).slice(0, 8),
    };
  });
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
      in_flight: carryInFlight(entry),
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
  if (stageId === 'sr:6') {
    const flight = isObj(state) && isObj(state.entry) ? arr(state.entry.in_flight).filter(isObj) : [];
    const first = arr(bound.reverse_salients).slice();
    flight.forEach(function (r) { if (nonEmpty(r.opportunity_id) && first.indexOf(r.opportunity_id) === -1) first.push(r.opportunity_id); });
    return { first_rows: first, in_flight: clone(flight) };
  }
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
    const open = boundForStage(s, 'sr:6').first_rows.filter(function (id) {
      return fromRows.indexOf(id) === -1 && dismissedIds.indexOf(id) === -1;
    });
    if (open.length > 0) return fail('bound_input_unaddressed:' + open[0]);
    const salients = arr(s.entry.bound && s.entry.bound.reverse_salients);
    dismissed.forEach(function (d) {
      s.discarded.push({ kind: salients.indexOf(d.id) !== -1 ? 'reverse_salient' : 'hypothesis_in_flight', id: d.id, reason: d.reason.trim() });
    });
  }

  rec.status = 'done'; rec.decision = 'approve'; rec.output = hasOutput ? clone(outcome.output) : null;
  rec.reason = nonEmpty(outcome.reason) ? outcome.reason.trim() : null;
  return { ok: true, state: s };
}

// -------------------------------------------------------- question set
const RUNGS = Object.freeze(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']);

// A short search term from a limiter statement: no operators, quotes, brackets
// or sentence breaks, at most 80 characters. The planner's composer accepts
// only a plain term here; a statement that cannot be reduced gets no term and
// its leaf stays unsearched (the engine names the gap).
function shortTerm(text) {
  let t = String(text === undefined || text === null ? '' : text);
  t = t.replace(/["()\\\r\n\t*`|~_#>]/g, ' ').replace(/[.!?;:]+(\s|$)/g, ' ').replace(/^[^A-Za-z0-9]+/, '');
  const tokens = t.split(/\s+/).filter(function (x) { return x.length > 0 && !/^(and|or|not)$/i.test(x); });
  let out = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const next = out ? out + ' ' + tokens[i] : tokens[i];
    if (next.length > 80) break;
    out = next;
  }
  return out.length >= 2 ? out : null;
}

function statementOf(l) {
  if (nonEmpty(l.statement)) return l.statement.trim();
  if (nonEmpty(l.label)) return l.label.trim();
  if (nonEmpty(l.text)) return l.text.trim();
  return '';
}

// Read one perspective field of a filed plan, read-only. The run name must be
// a plain folder name; anything else is never opened.
function readFiledField(roomDir, runName, field) {
  if (!nonEmpty(roomDir) || !nonEmpty(runName) || !RUN_NAME_RE.test(runName) || runName.indexOf('..') !== -1) return null;
  try {
    const file = path.join(roomDir, 'research', runName, 'plan.json');
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > MAX_PLAN_BYTES) return null;
    const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
    const p = plan && plan.perspective;
    return isObj(p) && p[field] !== undefined ? clone(p[field]) : null;
  } catch (_e) {
    return null;
  }
}

function stageValue(state, stageId, roomDir) {
  const rec = state.stages[stageId];
  const field = STAGE_FIELD[stageId];
  let v = null;
  if (rec && rec.status === 'done' && isObj(rec.output) && rec.output[field] !== undefined) v = clone(rec.output[field]);
  else if (rec && rec.status === 'not_run' && isObj(rec.stand_in) && PLAN_STAND_IN_KINDS.indexOf(rec.stand_in.kind) !== -1) {
    v = readFiledField(roomDir, rec.stand_in.id, field);
  }
  const wantsObject = field === 'tension' || field === 'goal' || field === 'rung_phrase';
  if (wantsObject) return isObj(v) ? v : {};
  return Array.isArray(v) ? v : [];
}

function freshEvidence(limiter, hits) {
  const known = new Set();
  hits.forEach(function (h) { arr(h.evidence).forEach(function (e) { known.add(e); }); });
  return arr(limiter.new_evidence).filter(nonEmpty).filter(function (e) { return !known.has(e); });
}

/**
 * buildQuestionSet(state, opts) -> { ok, question_set, errors, settled_excluded }.
 * opts: roomDir (to read a filed plan that stands in for a not_run step),
 * settled (loadSettled rows; limiters they settle are left out unless they
 * carry new evidence), diffusion ({reason} adds the diffusion lens leaves),
 * perspectiveModule (test seam).
 */
function buildQuestionSet(state, opts) {
  const o = isObj(opts) ? opts : {};
  const persp = o.perspectiveModule || basePerspective;
  if (!isObj(state) || !isObj(state.stages) || !isObj(state.entry) || !isObj(state.entry.what)) {
    return { ok: false, question_set: null, errors: ['state_invalid'], settled_excluded: [] };
  }
  const tmpl = Q.TEMPLATES[TEMPLATE_ID];
  const dims = Q.dimensionsFor(tmpl);
  const dimById = {};
  dims.forEach(function (d) { dimById[d.id] = d; });

  const tension = stageValue(state, 'sr:1', o.roomDir);
  const goal = stageValue(state, 'sr:2', o.roomDir);
  const rungPhrase = stageValue(state, 'sr:3', o.roomDir);
  const forum = stageValue(state, 'sr:4', o.roomDir);
  const paths = stageValue(state, 'sr:5', o.roomDir).filter(isObj);
  const allLimiters = stageValue(state, 'sr:6', o.roomDir).filter(isObj).map(clone);
  const chains = stageValue(state, 'sr:7', o.roomDir).filter(isObj);

  // the ratchet: a limiter settled by an earlier filed run is left out unless it carries new evidence
  const settled = arr(o.settled).filter(isObj);
  const excluded = [];
  const limiters = [];
  allLimiters.forEach(function (l, i) {
    const id = nonEmpty(l.id) ? l.id : 'L' + (i + 1);
    l.id = id;
    const key = persp.limiterKey(statementOf(l));
    const hits = settled.filter(function (x) { return x.limiter_key === key; });
    if (hits.length > 0 && freshEvidence(l, hits).length === 0) {
      excluded.push({ limiter_id: id, limiter_key: key, run_ref: nonEmpty(hits[0].run_ref) ? hits[0].run_ref : null, statement: cap(statementOf(l)) });
    } else {
      limiters.push(l);
    }
  });
  const keptIds = limiters.map(function (l) { return l.id; });
  const keptChains = chains.filter(function (c) { return keptIds.indexOf(c.limiter_id) !== -1; });

  const keyLine = [];
  const keyOf = {};
  dims.filter(function (d) { return d.effective_researchable; }).forEach(function (d) {
    const id = 'K' + (keyLine.length + 1);
    keyOf[d.id] = id;
    keyLine.push({ id: id, label: d.label, dimension: d.id });
  });

  const leaves = [];
  function addLeaf(l) {
    const leaf = Object.assign({ id: 'L' + (leaves.length + 1) }, l);
    leaves.push(leaf);
    return leaf;
  }
  function falsifier(dimId, text) {
    return { text: nonEmpty(text) ? text.trim() : (dimById[dimId].falsifier_default || 'Evidence that the claim does not hold.') };
  }
  const whatText = cap(state.entry.what.text);

  addLeaf({
    parent: keyOf['sr:tension'], question: whatText, origin: 'user_stated', dimension: 'sr:tension', lens: dimById['sr:tension'].default_lens,
    researchable: true, falsifier: falsifier('sr:tension'), slots: {},
  });
  addLeaf({
    parent: keyOf['sr:goal'],
    question: nonEmpty(goal.target) ? 'What baseline figures are reported for ' + cap(goal.target) + (nonEmpty(goal.unit) ? ' in ' + cap(goal.unit) : '') + '?' : dimById['sr:goal'].prompt,
    origin: 'framework_dimension', dimension: 'sr:goal', lens: dimById['sr:goal'].default_lens,
    researchable: true, falsifier: falsifier('sr:goal', goal.falsifier), slots: {},
  });
  const plain = paths.filter(function (p) { return p.from_10x !== true && nonEmpty(p.label); }).slice(0, 3).map(function (p) { return cap(p.label); });
  addLeaf({
    parent: keyOf['sr:paths'],
    question: plain.length > 0 ? 'Which of these routes has been demonstrated, and where did each one stop: ' + plain.join('; ') + '?' : dimById['sr:paths'].prompt,
    origin: 'framework_dimension', dimension: 'sr:paths', lens: dimById['sr:paths'].default_lens,
    researchable: true, falsifier: falsifier('sr:paths'), slots: {},
  });
  const tenX = paths.filter(function (p) { return p.from_10x === true && nonEmpty(p.label); });
  addLeaf({
    parent: keyOf['sr:paths_10x'],
    question: tenX.length > 0 ? 'Which neighboring fields reached ' + cap(tenX[0].label) + ' by another mechanism?' : dimById['sr:paths_10x'].prompt,
    origin: 'framework_dimension', dimension: 'sr:paths_10x', lens: dimById['sr:paths_10x'].default_lens,
    researchable: true, falsifier: falsifier('sr:paths_10x'), slots: {},
  });
  limiters.forEach(function (l) {
    const stmt = statementOf(l);
    const physics = l.column === 'physics';
    const term = shortTerm(nonEmpty(l.term) ? l.term : stmt);
    const leaf = addLeaf({
      parent: keyOf['sr:limiters'],
      question: physics ? 'Is the ' + cap(stmt) + ' bound derived from first principles?' : (nonEmpty(l.question) ? cap(l.question) : 'Is ' + cap(stmt) + ' truly fixed?'),
      origin: 'framework_dimension', dimension: 'sr:limiters', lens: physics ? 'ci.derivation' : 'ci.retest',
      researchable: true, falsifier: falsifier('sr:limiters', l.refutation), slots: term ? { limiter: term } : {}, limiter_id: l.id,
    });
    l.leaf_id = leaf.id;
  });

  let lensSelection = [];
  if (isObj(o.diffusion) && nonEmpty(o.diffusion.reason)) {
    const dfDims = Q.dimensionsFor(Q.TEMPLATES.diffusion).filter(function (d) { return d.effective_researchable; });
    dfDims.forEach(function (d) {
      const id = 'K' + (keyLine.length + 1);
      keyLine.push({ id: id, label: d.label, dimension: d.id });
      addLeaf({
        parent: id, question: d.prompt, origin: 'framework_dimension', dimension: d.id, lens: d.default_lens,
        researchable: true, falsifier: { text: d.falsifier_default || 'Evidence that the adoption claim does not hold.' }, slots: {},
      });
    });
    lensSelection = [{ lens: 'diffusion', reason: cap(o.diffusion.reason) }];
  }

  const tensions = state.stages['sr:4'] && isObj(state.stages['sr:4'].output) ? arr(state.stages['sr:4'].output.tensions).filter(isObj) : [];
  const qs = {
    schema: Q.SCHEMA,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: whatText,
    scqa: {
      situation: 'The question on the table is: ' + whatText,
      complication: nonEmpty(tension.disputed_feasibility) ? cap(tension.disputed_feasibility) : (nonEmpty(tension.statement) ? cap(tension.statement) : 'No tension statement was recorded for this run.'),
      question: 'Which limiter binds first and what unlocks it?',
      answer_hypothesis: null,
    },
    mode_hint: 'deep',
    perspective: {
      tension: tension, goal: goal, rung_phrase: rungPhrase, forum: forum, paths: paths,
      limiters: limiters, unlock_chains: keptChains, ranking: [], tensions: clone(tensions),
    },
    key_line: keyLine,
    leaves: leaves,
    coverage_notes: [],
    lens_selection: lensSelection,
  };
  const v = Q.validateQuestionSet(qs);
  return { ok: v.ok, question_set: qs, errors: v.errors, settled_excluded: excluded };
}

// ------------------------------------------------------------------ Stage B
function mergeWarnings(a, b) {
  const out = [];
  arr(a).concat(arr(b)).forEach(function (w) { if (out.indexOf(w) === -1) out.push(w); });
  return out;
}

/**
 * stageB(roomDir, state, opts) -> Stage B: ranked assumed limiters become
 * falsifiable hypothesis leaves, the plan is built by the one planner, and the
 * F.6 card is returned. opts.perspectiveModule and opts.planner are test seams.
 */
async function stageB(roomDir, state, opts) {
  const o = isObj(opts) ? opts : {};
  const persp = o.perspectiveModule || basePerspective;
  let api = null;
  try { api = persp.describeEngine().api_version; } catch (_e) { api = null; }
  if (api !== ENGINE_API_VERSION) return fail('engine_api_mismatch');
  if (!isObj(state) || !isObj(state.stages) || nextStage(state) !== 'stage_b') return fail('stage_order');
  if (!nonEmpty(roomDir)) return fail('plan_failed', { errors: ['room_required'] });

  let settled = [];
  try { settled = persp.loadSettled(roomDir); } catch (_e) { settled = []; }
  const rungIn = state.entry && state.entry.rung ? state.entry.rung.rung : null;
  const rung = RUNGS.indexOf(rungIn) !== -1 ? rungIn : null;

  let built = buildQuestionSet(state, { roomDir: roomDir, settled: settled, perspectiveModule: persp });
  if (!built.ok) return fail('question_set_invalid', { errors: built.errors });
  const pb = persp.buildPerspective(built.question_set.perspective, { rung: rung, scientific: true, template: TEMPLATE_ID, mode: 'deep', settled: settled });
  if (!pb.ok) return fail('perspective_errors', { errors: pb.errors });

  // the diffusion lens: the planner decides from the same signals; mirror it so the plan carries its leaves
  let diffusion = null;
  try {
    const sel = require('./structure.cjs').lensSelection({
      roomDir: roomDir, templateId: TEMPLATE_ID, navigatorToggle: false, requested: null,
      frameworks: [Q.TEMPLATES[TEMPLATE_ID].framework], perspective: built.question_set.perspective,
    });
    if (sel && Array.isArray(sel.selected) && sel.selected.length > 0 && nonEmpty(sel.selected[0].reason)) diffusion = { reason: sel.selected[0].reason };
  } catch (_e) { diffusion = null; }
  if (diffusion) {
    built = buildQuestionSet(state, { roomDir: roomDir, settled: settled, perspectiveModule: persp, diffusion: diffusion });
    if (!built.ok) return fail('question_set_invalid', { errors: built.errors });
  }
  const qs = built.question_set;

  // one hypothesis per ranked assumed, unresolved limiter
  const dimLimiters = Q.dimensionsFor(Q.TEMPLATES[TEMPLATE_ID]).filter(function (d) { return d.id === 'sr:limiters'; })[0];
  const keyForLimiters = qs.key_line.filter(function (k) { return k.dimension === 'sr:limiters'; })[0];
  const inputById = {};
  qs.perspective.limiters.forEach(function (l) { inputById[l.id] = l; });
  const hyps = [];
  const planLeafByLimiter = {};
  persp.rankByUnlock(pb.perspective, {}).forEach(function (r) {
    const l = pb.perspective.limiters.filter(function (x) { return x.id === r.limiter_id; })[0];
    if (!l || l.column !== 'assumed' || l.resolved === true) return;
    const src = inputById[l.id] || {};
    const hid = 'H' + (hyps.length + 1);
    const term = shortTerm(nonEmpty(src.term) ? src.term : l.statement);
    const tier = nonEmpty(src.evidence_tier) ? src.evidence_tier.trim() : 'Academic';
    const refutation = nonEmpty(src.refutation) ? src.refutation.trim() : (dimLimiters.falsifier_default || 'A re-test that reproduces the limit.');
    const planLeaf = {
      id: hid, parent: keyForLimiters ? keyForLimiters.id : null, question: l.question || cap(l.statement),
      origin: 'framework_dimension', dimension: 'sr:limiters', lens: 'ci.retest', researchable: true,
      falsifier: { text: refutation, template_id: 'ci.retest' }, slots: term ? { limiter: term } : {}, corpus: 'openalex', limiter_id: l.id,
    };
    const hyp = Object.assign(clone(planLeaf), {
      claim: l.statement,
      why_unlocks: 'unlocks ' + r.length + ' downstream steps the field must push',
      slots: Object.assign({ limiter_id: l.id, unlock_length: r.length, evidence_tier_needed: tier }, term ? { limiter: term } : {}),
    });
    hyps.push(hyp);
    planLeafByLimiter[l.id] = planLeaf;
  });
  qs.leaves = qs.leaves.map(function (leaf) { return leaf.limiter_id && planLeafByLimiter[leaf.limiter_id] ? planLeafByLimiter[leaf.limiter_id] : leaf; });
  qs.perspective.limiters.forEach(function (l) { if (planLeafByLimiter[l.id]) l.leaf_id = planLeafByLimiter[l.id].id; });
  const v = Q.validateQuestionSet(qs);
  if (!v.ok) return fail('question_set_invalid', { errors: v.errors });

  const planner = o.planner || require('./planner.cjs');
  let res = null;
  try { res = planner.buildPlan(roomDir, qs, { mode: 'deep' }); } catch (e) { return fail('plan_failed', { errors: [String((e && e.message) || e).slice(0, 80)] }); }
  if (!res || res.ok !== true || !isObj(res.plan)) return fail('plan_failed', { errors: arr(res && res.errors) });

  let cardRes = null;
  try { cardRes = planner.cardFor(roomDir, res.plan); } catch (_e) { cardRes = null; }
  const cardObj = cardRes && isObj(cardRes.card) ? cardRes.card : null;

  const summary = hyps.map(function (h) { return { id: h.id, limiter_id: h.limiter_id, claim: cap(h.claim), why_unlocks: h.why_unlocks, evidence_tier_needed: h.slots.evidence_tier_needed }; });
  let rs = recordStage(state, 'stage_b', { decision: 'approve', output: { run_id: res.run_id, hypotheses: summary } });
  if (!rs.ok) rs = recordStage(state, 'stage_b', { decision: 'approve', output: { run_id: res.run_id } });
  if (!rs.ok) return fail('stage_order');
  const next = rs.state;
  next.plan_ref = { run_id: res.run_id };

  return {
    ok: true,
    state: next,
    plan_ref: { run_id: res.run_id },
    card: cardObj && typeof cardObj.body_md === 'string' ? cardObj.body_md : '',
    card_object: cardObj,
    leaves: hyps,
    settled_excluded: built.settled_excluded,
    warnings: mergeWarnings(pb.warnings, res.warnings),
    rubric: RUBRIC,
    plan_status: res.status,
    next: cardRes ? cardRes.next : null,
  };
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
  buildQuestionSet,
  stageB,
};
