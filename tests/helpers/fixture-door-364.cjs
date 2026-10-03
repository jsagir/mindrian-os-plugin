'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 05 shared door fixture (layer: loop).
 *
 * Exports (plans 06 and 09 reuse them):
 *   stageOutputsFrom363()    the 363 scientific-roadmapping question-set
 *                            fixture mapped to one approve outcome per walked
 *                            stage: { 'sr:1': { decision:'approve', output:{ tension } }, ... }
 *   syntheticEntry(over)     a hand-built resolveEntry result (no room.db), so a
 *                            leg can choose the proposed step, the skipped steps
 *                            and the bound inputs directly
 *   theoAuthored(name)       a readSrSteps-shaped success built from a 364-theo
 *                            fixture (default framework-step-authored)
 *   runnableRows(name)       the runnable rows of a 364-theo fixture, for mapSteps
 *   walkedState(opts)        createRun, then every stage recorded in order up to
 *                            and including sr:7; the systems pass is declined with
 *                            the reason 'fixture: no systems artifact'; stage_b is
 *                            left for the async stageB call.
 *       opts.entry      a resolveEntry result (default syntheticEntry())
 *       opts.theo       a readSrSteps result (default theoAuthored())
 *       opts.chosenStep step number 1..7 (default: the entry's proposed step)
 *       opts.outputs    { 'sr:6': { limiters: [...] } } style per-stage output overrides
 *       opts.roomDir    ignored by the walk, kept for call-site symmetry
 *
 * sr-door.cjs is required lazily inside walkedState so this helper loads before
 * the module exists. Hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const QS_FIXTURE = path.join(REPO_ROOT, 'tests/fixtures/363-question-sets/scientific-roadmapping.json');
const THEO_DIR = path.join(REPO_ROOT, 'tests/fixtures/364-theo');

// stage id -> the perspective field its output carries
const FIELD = Object.freeze({
  'sr:1': 'tension', 'sr:2': 'goal', 'sr:3': 'rung_phrase', 'sr:4': 'forum',
  'sr:5': 'paths', 'sr:6': 'limiters', 'sr:7': 'unlock_chains',
});

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function stageOutputsFrom363() {
  const qs = JSON.parse(fs.readFileSync(QS_FIXTURE, 'utf8'));
  const out = {};
  Object.keys(FIELD).forEach(function (stage) {
    const field = FIELD[stage];
    const o = {};
    o[field] = clone(qs.perspective[field]);
    out[stage] = { decision: 'approve', output: o };
  });
  return out;
}

function syntheticEntry(over) {
  const base = {
    ok: true,
    what: {
      status: 'present',
      candidates: [{ kind: 'goal', id: 'goal:v1', text: 'Can solid-state cells reach 400 Wh/kg at pack level?' }],
    },
    route: null,
    offers: [],
    rung: { rung: 'WellDefined', source: 'goal' },
    rooting: { in_primary: true },
    proposed_step: 1,
    rule: 'fresh',
    why: 'Only the starting question is on file, so qualify the tension first.',
    not_run: [],
    bound: { reverse_salients: [], dominant_designs: [], futures: [], systems: [] },
    offer_bound: [],
    context_insufficient: [],
    provisional_ranking: false,
    explore_opportunity_offer: { offer: false, opportunity_ids: [] },
    persona: { researcher: false },
    prior: { settled_count: 0, new_evidence_ids: [] },
  };
  return Object.assign(base, clone(over || {}));
}

function theoFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(THEO_DIR, (name || 'framework-step-authored') + '.json'), 'utf8'));
}

function runnableRows(name) {
  const rows = theoFixture(name).rows[0].steps;
  return rows
    .filter(function (s) { return s.stepKind !== 'DEFINITION' && s.stepKind !== 'ASIDE'; })
    .map(function (s) { return { stepId: s.stepId, label: s.label, stepKind: s.stepKind, runIt: s.runIt }; });
}

function theoAuthored(name) {
  const f = theoFixture(name);
  return { ok: true, steps: runnableRows(name), framework_status: f.rows[0].orchestrationStatus || null };
}

function walkedState(opts) {
  const o = opts || {};
  const door = require(path.join(REPO_ROOT, 'lib/core/research-planner/sr-door.cjs'));
  const entry = o.entry || syntheticEntry();
  const theo = o.theo || theoAuthored();
  const created = door.createRun({
    entry: entry,
    theo: theo,
    chosenStep: o.chosenStep,
    confirmedWhat: entry.what && entry.what.candidates ? entry.what.candidates[0] : undefined,
    coverage: { status: 'uncovered', problem_type: 'WellDefined' },
    now: o.now || new Date('2026-10-03T00:00:00Z'),
  });
  if (!created.ok) throw new Error('fixture-door-364: createRun refused ' + JSON.stringify(created));
  let state = created.state;

  const outcomes = stageOutputsFrom363();
  Object.keys(o.outputs || {}).forEach(function (stage) {
    const field = FIELD[stage];
    const out = {};
    out[field] = clone(o.outputs[stage][field] !== undefined ? o.outputs[stage][field] : o.outputs[stage]);
    outcomes[stage] = { decision: 'approve', output: out };
  });

  const order = ['sr:1', 'sr:2', 'sr:3', 'sr:4', 'systems_pass', 'sr:5', 'sr:6', 'sr:7'];
  order.forEach(function (stage) {
    if (state.stages[stage].status === 'not_run') return;
    let outcome;
    if (stage === 'systems_pass') {
      outcome = { decision: 'approve', status: 'declined', reason: 'fixture: no systems artifact' };
    } else {
      outcome = clone(outcomes[stage]);
      if (stage === 'sr:6') {
        const limiters = (outcome.output && outcome.output.limiters) || [];
        const addressed = limiters.map(function (l) { return l.source_node_id; });
        const open = (entry.bound && entry.bound.reverse_salients ? entry.bound.reverse_salients : []).filter(function (id) { return addressed.indexOf(id) === -1; });
        if (open.length > 0) outcome.dismissed = open.map(function (id) { return { id: id, reason: 'fixture: out of scope' }; });
      }
    }
    const r = door.recordStage(state, stage, outcome);
    if (!r.ok) throw new Error('fixture-door-364: recordStage ' + stage + ' refused ' + JSON.stringify(r));
    state = r.state;
  });
  return state;
}

module.exports = { stageOutputsFrom363, syntheticEntry, theoAuthored, runnableRows, walkedState, FIELD };
