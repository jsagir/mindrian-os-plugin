'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 05 -- Plan object (mos.research-plan/1), RunResult, planHash,
 * applyEdit and the F.6 Plan Review card. Legs P1-P12.
 *
 * Plain node:assert/strict semantics through the hygiene checker, zero deps.
 * Fixtures are built inline because sibling modules may not exist yet.
 * No em-dash or en-dash in this file: tests spell those characters as
 * JavaScript unicode escapes.
 * Exit 0 pass, 1 fail, 77 skip.
 */

const nodeCrypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('363-05 plan schema');

const ROOT = path.resolve(__dirname, '..');
const PLANNER_DIR = path.join(ROOT, 'lib', 'core', 'research-planner');
const PLAN_FILE = path.join(PLANNER_DIR, 'plan.cjs');
const CONTEXT_FILE = path.join(PLANNER_DIR, 'CONTEXT.md');

const EM = '—';
const EN = '–';

let P = null;
let loadError = null;
try {
  P = require(PLAN_FILE);
} catch (e) {
  loadError = e;
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function sha(text) { return 'sha256:' + nodeCrypto.createHash('sha256').update(text).digest('hex'); }

function leg(name, fn) {
  try {
    const res = fn();
    if (res === false) check(name, false, 'returned false');
    else if (res !== 'checked') check(name, true);
  } catch (e) {
    check(name, false, String(e && e.message ? e.message : e).slice(0, 160));
  }
}

function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function hasError(result, code) {
  return Array.isArray(result.errors) && result.errors.some(function (e) { return String(e).indexOf(code) === 0; });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function mkQuery(templateId, text, round) {
  return {
    template_id: templateId,
    family: 'variant',
    role: 'primary',
    q: text,
    q_hash: sha(text),
    audit: 'pass',
    round: round || 1,
  };
}

const Q_L1A = 'adoption barriers dual-use sensor technology diffusion';
const Q_L1B = 'first adopter capacity sensor technology early market';
const Q_L2A = 'competing designs history solid-state storage first introduced';
const Q_L2B = 'energy density ceiling solid-state storage limits';

function mkLeaf(id, over) {
  return Object.assign({
    id: id,
    parent: null,
    question: 'What does the evidence say about ' + id + '?',
    origin: 'user_stated',
    dimension: 'adoption',
    lens: 'diffusion',
    source_command: '/mos:diffusion',
    researchable: true,
    not_researchable_reason: null,
    falsifier: { text: 'No adopter beyond the pilot group after two years', template_id: 'fals-adoption' },
    corpus: 'openalex',
    slots: {},
    queries: [],
    priority: 1,
    status: 'open',
    limiter_id: null,
  }, over || {});
}

function deepFixture() {
  return {
    schema: 'mos.research-plan/1',
    run_id: 'rp-2026-09-29-1a2b3c4d',
    mode: 'deep',
    version: 1,
    revision: 0,
    max_revisions: 3,
    created_at: '2026-09-29T10:00:00.000Z',
    parent_plan_hash: null,
    status: 'ready',
    origin: { template_id: 'scientific-roadmapping', command: '/mos:research', framework: 'Scientific Roadmapping', card_or_node_id: null, section: 'market-analysis' },
    context: {
      rung: 'Wicked',
      rung_source: 'room_state',
      scientific: { is: true, signals: ['S1:physical_limits'] },
      cohort: { sections: ['market-analysis'], node_ids: [] },
      lenses_selected: [
        { lens: 'diffusion', reason: 'adoption is the disputed part', source: 'command' },
        { lens: 'dominant-design', reason: 'ceiling question', source: 'command' },
      ],
    },
    structure: { source: 'local_template', reason: 'no live ledger row', tree_type: 'issue', frameworks: ['Adoption-Capacity Theory'], steps_applied: ['tension', 'goal'] },
    perspective: {
      engine: 'scientific-roadmapping',
      depth: 'full',
      version: 1,
      tension: { statement: 'Everyone wants denser storage; whether density can keep rising is disputed', agreed_value: 'denser storage matters', disputed_feasibility: 'the ceiling', status: 'ok' },
      goal: { target: 'energy density', unit: 'Wh/kg', threshold: '400', falsifier: 'a cell at 400 Wh/kg fails 500 cycles', quantified: true },
      rung_phrase: { roadmap_type: 'a program of linked bets', idea_kind: 'a set of research programs' },
      forum: [
        { role: 'frustrated_insider', pass_order: 1, contributed: ['LM2'], none_reason: null },
        { role: 'fresh_entrant', pass_order: 2, contributed: ['LM3'], none_reason: null },
        { role: 'physics_grounder', pass_order: 3, contributed: ['LM1'], none_reason: null },
      ],
      paths: [
        { id: 'PA1', label: 'Better anode', from_10x: false, raised_by: 'frustrated_insider' },
        { id: 'PA2', label: 'Different chemistry', from_10x: true, raised_by: 'fresh_entrant' },
      ],
      limiters: [
        { id: 'LM1', path_id: 'PA1', leaf_id: 'L2', statement: 'Lithium metal dendrite growth sets a hard limit', column: 'physics', derivation_row_id: 'row-1', s_curve: 'near_ceiling', question: 'Is the dendrite limit derived or observed?', raised_by: 'physics_grounder', settled_ref: null },
        { id: 'LM2', path_id: 'PA1', leaf_id: 'L1', statement: 'Nobody re-tested cell pressure since 2015', column: 'assumed', derivation_row_id: null, s_curve: 'headroom', question: 'Has anyone re-tested cell pressure recently?', raised_by: 'frustrated_insider', settled_ref: null },
        { id: 'LM3', path_id: 'PA2', leaf_id: null, statement: 'Cost floor assumed fixed by cathode metals', column: 'assumed', derivation_row_id: null, s_curve: 'unknown', question: 'Is the cost floor a material fact or a supply habit?', raised_by: 'fresh_entrant', settled_ref: null },
      ],
      unlock_chains: [
        { limiter_id: 'LM2', steps: [{ text: 'pressure fixture redesign', pushed_by: 'field', kind: 'field' }, { text: 'pack makers accept new fixture', pushed_by: 'self', kind: 'adoption' }], length: 2 },
      ],
      ranking: ['LM2', 'LM1', 'LM3'],
      tensions: [{ roles: ['frustrated_insider', 'physics_grounder'], text: 'insider says untested, grounder says derived' }],
      ratchet: { version: 1, parent_plan_hash: null, discarded: [], settled: [] },
      next_binding_constraint: 'LM2',
    },
    pyramid: {
      stated_question: 'Can solid-state storage reach 400 Wh/kg at scale?',
      scqa: { situation: 'Storage density gates the product.', complication: 'The ceiling is disputed.', question: 'Is 400 Wh/kg reachable?', answer_hypothesis: null },
      governing_question: 'Which assumed limiter blocks 400 Wh/kg?',
      governing_status: 'restated',
      key_line: [
        { id: 'K1', label: 'Adoption', dimension: 'adoption', leaf_ids: ['L1'] },
        { id: 'K2', label: 'Ceiling', dimension: 'ceiling', leaf_ids: ['L2', 'L3'] },
      ],
      coverage: { dimensions: ['adoption', 'ceiling', 'cost'], uncovered: ['regulation', 'recycling'], not_researchable: [{ dimension: 'taste', reason: 'no corpus measures it' }] },
      mece: { warnings: ['adoption and cost overlap on price'], falsifiability: [], restatement_warnings: [], passes: 1 },
      d00: { passes: 1, beyond_stated_leaf_ids: ['L3'] },
      dropped: [],
    },
    leaves: [
      mkLeaf('L1', { dimension: 'adoption', lens: 'diffusion', source_command: '/mos:diffusion', limiter_id: 'LM2', queries: [mkQuery('t-a', Q_L1A), mkQuery('t-b', Q_L1B)] }),
      mkLeaf('L2', { dimension: 'ceiling', lens: 'dominant-design', source_command: '/mos:dominant-designs', origin: 'framework_dimension', limiter_id: 'LM1', queries: [mkQuery('t-c', Q_L2A), mkQuery('t-d', Q_L2B)] }),
      mkLeaf('L3', { dimension: 'ceiling', lens: 'scientific-roadmapping', source_command: '/mos:research', origin: 'mece_gap', researchable: false, not_researchable_reason: 'needs a lab measurement', falsifier: { text: 'n/a', template_id: null }, queries: [] }),
    ],
    budget: { breadth: 4, rounds: 2, queries_per_round: 2, results_per_query: 5, max_searches: 16, time_budget_ms: 1200000, counterevidence: true },
    stop_rules: ['cap', 'saturation', 'budget', 'time'],
    grant_ref: { grant_id: 'g-run-1', version: 1, lifetime: 'run' },
    return_target: { card_id: null, section: 'market-analysis' },
    plan_hash: null,
  };
}

function quickFixture() {
  return {
    schema: 'mos.research-plan/1',
    run_id: 'rp-2026-09-29-0a0b0c0d',
    mode: 'quick',
    version: 1,
    revision: 0,
    max_revisions: 3,
    created_at: '2026-09-29T10:00:00.000Z',
    parent_plan_hash: null,
    status: 'ready',
    origin: { template_id: 'whitespace', command: '/mos:whitespace', framework: 'Whitespace', card_or_node_id: 'node-7', section: 'problem-definition' },
    context: { rung: 'IllDefined', rung_source: 'room_state', scientific: { is: false, signals: [] }, cohort: { sections: ['problem-definition'], node_ids: ['node-7'] }, lenses_selected: [{ lens: 'whitespace', reason: 'gap check', source: 'command' }] },
    structure: { source: 'local_template', reason: 'quick run', tree_type: 'hypothesis', frameworks: [], steps_applied: [] },
    perspective: {
      engine: 'constraint-layer', depth: 'lite', version: 1,
      tension: { statement: 'Is the gap real', agreed_value: '', disputed_feasibility: '', status: 'ok' },
      goal: { target: 'a yes or no on the gap', unit: '', threshold: '', falsifier: 'a paper that covers it', quantified: false },
      rung_phrase: { roadmap_type: 'a short checked list', idea_kind: 'a reframing' },
      forum: [], paths: [], limiters: [], unlock_chains: [], ranking: [], tensions: [],
      ratchet: { version: 1, parent_plan_hash: null, discarded: [], settled: [] },
      next_binding_constraint: null,
    },
    pyramid: {
      stated_question: 'Is anyone covering thin-film sensors for dairy?',
      scqa: { situation: '', complication: '', question: '', answer_hypothesis: null },
      governing_question: 'Is anyone covering thin-film sensors for dairy?',
      governing_status: 'restated',
      key_line: [{ id: 'K1', label: 'Coverage', dimension: 'coverage', leaf_ids: ['L1', 'L2'] }],
      coverage: { dimensions: ['coverage'], uncovered: [], not_researchable: [] },
      mece: { warnings: [], falsifiability: [], restatement_warnings: [], passes: 1 },
      d00: { passes: 0, beyond_stated_leaf_ids: [] },
      dropped: [],
    },
    leaves: [
      mkLeaf('L1', { dimension: 'coverage', lens: 'whitespace', source_command: '/mos:whitespace', queries: [mkQuery('ws-1', 'thin film sensor dairy monitoring literature')] }),
      mkLeaf('L2', { dimension: 'coverage', lens: 'whitespace', source_command: '/mos:whitespace', queries: [mkQuery('ws-2', 'thin film sensor milk quality review')] }),
    ],
    budget: { breadth: 1, rounds: 1, queries_per_round: 3, results_per_query: 5, max_searches: 3, time_budget_ms: 60000, counterevidence: false },
    stop_rules: ['cap', 'budget', 'time'],
    grant_ref: null,
    return_target: { card_id: 'node-7', section: 'problem-definition' },
    plan_hash: null,
  };
}

function runFixture() {
  return {
    schema: 'mos.research-run/1',
    run_id: 'rp-2026-09-29-0a0b0c0d',
    mode: 'quick',
    plan_hash: 'sha256:' + 'a'.repeat(64),
    grant_ref: null,
    trigger: 'navigator',
    started_at: '2026-09-29T10:01:00.000Z',
    finished_at: '2026-09-29T10:01:20.000Z',
    stop_reason: 'pass_complete',
    queries: [{ q_hash: sha('x'), template_id: 'ws-1', outcome: 'ok', count: 4, failure_class: null }],
    records_path: 'research/rp-2026-09-29-0a0b0c0d',
    rows: [],
    dropped: {},
    leaves: [{ id: 'L1', status: 'supported', row_ids: [] }],
    verdict: 'settled',
    answer_line: 'Coverage exists in three papers.',
    pyramid: {},
    perspective: {},
    governing_status: 'restated',
    unresolved_branches: [],
    opportunity_candidates: [],
    contradictions: [],
    escalation_offer: null,
    local_checks: [],
    timings: { total_ms: 20000, per_query_ms: [4000] },
    filed: false,
  };
}

// ---------------------------------------------------------------------------
// P0 load
// ---------------------------------------------------------------------------
leg('P0 plan.cjs loads and exports the contract', function () {
  if (loadError) throw loadError;
  ['PLAN_SCHEMA', 'RUN_SCHEMA', 'BUDGETS', 'validatePlan', 'validateRunResult', 'planHash', 'newRunId', 'applyEdit', 'planReviewCard'].forEach(function (k) {
    assertTrue(P[k] !== undefined, 'missing export ' + k);
  });
  assertTrue(P.PLAN_SCHEMA === 'mos.research-plan/1', 'PLAN_SCHEMA value');
  assertTrue(P.RUN_SCHEMA === 'mos.research-run/1', 'RUN_SCHEMA value');
});

// ---------------------------------------------------------------------------
// P1 valid fixtures
// ---------------------------------------------------------------------------
leg('P1 complete quick fixture passes validatePlan', function () {
  const r = P.validatePlan(quickFixture());
  assertTrue(r.ok === true, 'errors: ' + JSON.stringify(r.errors));
});

leg('P1 complete deep fixture passes validatePlan', function () {
  const r = P.validatePlan(deepFixture());
  assertTrue(r.ok === true, 'errors: ' + JSON.stringify(r.errors));
});

// ---------------------------------------------------------------------------
// P2 named errors
// ---------------------------------------------------------------------------
leg('P2 malformed plans fail with named errors', function () {
  const cases = [
    ['schema_missing', function (p) { delete p.schema; }],
    ['mode_invalid', function (p) { p.mode = 'medium'; }],
    ['leaf_origin_invalid', function (p) { p.leaves[0].origin = 'guessed'; }],
    ['leaf_reason_missing', function (p) { p.leaves[2].not_researchable_reason = null; }],
    ['leaf_falsifier_missing', function (p) { p.leaves[0].falsifier = { text: '', template_id: null }; }],
    ['query_q_hash_missing', function (p) { delete p.leaves[0].queries[0].q_hash; }],
    ['query_audit_not_pass', function (p) { p.leaves[0].queries[0].audit = 'fail'; }],
    ['revision_over_max', function (p) { p.revision = 4; }],
    ['budget_over_cap', function (p) { p.budget.max_searches = 99; }],
    ['budget_over_cap', function (p) { p.budget.rounds = 9; }],
    ['budget_over_cap', function (p) { p.budget.time_budget_ms = 99999999; }],
    ['budget_over_cap', function (p) { p.budget.results_per_query = 50; }],
    ['forum_role_invalid', function (p) { p.perspective.forum[0].role = 'cheerleader'; }],
    ['limiter_column_invalid', function (p) { p.perspective.limiters[0].column = 'vibes'; }],
    ['unlock_pushed_by_invalid', function (p) { p.perspective.unlock_chains[0].steps[0].pushed_by = 'luck'; }],
  ];
  cases.forEach(function (c) {
    const p = deepFixture();
    c[1](p);
    const r = P.validatePlan(p);
    assertTrue(r.ok === false, c[0] + ' should fail');
    assertTrue(hasError(r, c[0]), c[0] + ' not named, got ' + JSON.stringify(r.errors));
  });
});

leg('P2 quick budget over the quick cap fails', function () {
  const p = quickFixture();
  p.budget.max_searches = 4;
  const r = P.validatePlan(p);
  assertTrue(r.ok === false && hasError(r, 'budget_over_cap'), JSON.stringify(r.errors));
});

// ---------------------------------------------------------------------------
// P3 planHash
// ---------------------------------------------------------------------------
leg('P3 planHash is stable across key order and excluded fields', function () {
  const a = deepFixture();
  const h1 = P.planHash(a);
  assertTrue(/^sha256:[0-9a-f]{64}$/.test(h1), 'hash shape ' + h1);
  const b = deepFixture();
  const reordered = {};
  Object.keys(b).reverse().forEach(function (k) { reordered[k] = b[k]; });
  reordered.budget = { counterevidence: true, time_budget_ms: 1200000, max_searches: 16, results_per_query: 5, queries_per_round: 2, rounds: 2, breadth: 4 };
  assertTrue(P.planHash(reordered) === h1, 'key order changed the hash');
  const c = deepFixture();
  c.plan_hash = 'sha256:' + 'f'.repeat(64);
  c.created_at = '2030-01-01T00:00:00.000Z';
  c.revision = 2;
  assertTrue(P.planHash(c) === h1, 'plan_hash, created_at, revision must be excluded');
});

leg('P3 planHash changes on any leaf, query, budget, perspective or limiter edit', function () {
  const base = P.planHash(deepFixture());
  const edits = [
    function (p) { p.leaves[0].question = 'a different question'; },
    function (p) { p.leaves[0].queries[0].q = 'adoption barriers changed'; },
    function (p) { p.budget.breadth = 3; },
    function (p) { p.perspective.tension.statement = 'another tension'; },
    function (p) { p.perspective.limiters[1].column = 'physics'; },
  ];
  const seen = new Set([base]);
  edits.forEach(function (fn, i) {
    const p = deepFixture();
    fn(p);
    const h = P.planHash(p);
    assertTrue(h !== base, 'edit ' + i + ' did not change the hash');
    seen.add(h);
  });
  assertTrue(seen.size === edits.length + 1, 'hashes collide across distinct edits');
});

// ---------------------------------------------------------------------------
// P4 applyEdit drop_leaf and revision cap
// ---------------------------------------------------------------------------
leg('P4 drop_leaf records the drop in pyramid.dropped and the ratchet, increments revision', function () {
  const plan = deepFixture();
  const r = P.applyEdit(plan, { op: 'drop_leaf', leaf_id: 'L2', reason: 'out of scope for this run' }, {});
  assertTrue(r.ok === true, JSON.stringify(r));
  assertTrue(r.plan.revision === 1 && r.revision === 1, 'revision');
  assertTrue(!r.plan.leaves.some(function (l) { return l.id === 'L2'; }), 'leaf removed');
  const d1 = r.plan.pyramid.dropped.find(function (d) { return d.id === 'L2'; });
  const d2 = r.plan.perspective.ratchet.discarded.find(function (d) { return d.id === 'L2'; });
  assertTrue(d1 && d1.kind === 'leaf' && d1.reason === 'out of scope for this run' && d1.version === r.plan.version, 'pyramid drop record');
  assertTrue(d2 && d2.kind === 'leaf' && d2.reason === 'out of scope for this run' && d2.version === r.plan.version, 'ratchet drop record');
  assertTrue(r.plan.parent_plan_hash === P.planHash(plan), 'parent hash links the prior plan');
  assertTrue(plan.leaves.length === 3, 'input plan must not be mutated');
});

leg('P4 the fourth edit returns revision_cap', function () {
  let plan = deepFixture();
  const edits = [
    { op: 'drop_leaf', leaf_id: 'L3', reason: 'not researchable here' },
    { op: 'set_budget', budget: { breadth: 3 } },
    { op: 'toggle_scientific' },
  ];
  edits.forEach(function (e) {
    const r = P.applyEdit(plan, e, {});
    assertTrue(r.ok === true, 'edit ' + e.op + ' ' + JSON.stringify(r));
    plan = r.plan;
  });
  assertTrue(plan.revision === 3, 'three revisions used');
  const fourth = P.applyEdit(plan, { op: 'set_budget', budget: { breadth: 2 } }, {});
  assertTrue(fourth.ok === false && fourth.reason === 'revision_cap', JSON.stringify(fourth));
});

// ---------------------------------------------------------------------------
// P5 raw query refused
// ---------------------------------------------------------------------------
leg('P5 an edit carrying a q key is refused and never echoed', function () {
  const offered = 'send this exact raw string to the web please';
  const plan = deepFixture();
  const edits = [
    { op: 'reword_leaf', leaf_id: 'L1', question: 'x', q: offered },
    { op: 'add_leaf', leaf: { id: 'L9', question: 'y', queries: [{ q: offered }] } },
    { op: 'set_budget', budget: { breadth: 2 }, q: offered },
  ];
  edits.forEach(function (e) {
    const r = P.applyEdit(plan, e, { recompose: function () { throw new Error('recompose must not run'); } });
    assertTrue(r.ok === false && r.reason === 'raw_query_refused', JSON.stringify(r));
    assertTrue(JSON.stringify(r).indexOf(offered) === -1, 'refusal echoed the offered string');
  });
});

// ---------------------------------------------------------------------------
// P6 reword_leaf recompose seam
// ---------------------------------------------------------------------------
leg('P6 reword_leaf calls recompose exactly once with the reworded leaf', function () {
  const plan = deepFixture();
  let calls = 0;
  let seenLeaf = null;
  const newQ = mkQuery('t-new', 'adoption capacity thin film sensors review');
  const r = P.applyEdit(plan, { op: 'reword_leaf', leaf_id: 'L1', question: 'Who adopts first and why?' }, {
    recompose: function (arg) {
      calls += 1;
      seenLeaf = arg && arg.leaf;
      return { ok: true, queries: [newQ] };
    },
  });
  assertTrue(r.ok === true, JSON.stringify(r));
  assertTrue(calls === 1, 'recompose calls ' + calls);
  assertTrue(seenLeaf && seenLeaf.id === 'L1' && seenLeaf.question === 'Who adopts first and why?', 'recompose saw the reworded leaf');
  const l1 = r.plan.leaves.find(function (l) { return l.id === 'L1'; });
  assertTrue(l1.question === 'Who adopts first and why?' && l1.queries.length === 1 && l1.queries[0].q === newQ.q, 'leaf carries the recomposed query');
  assertTrue(P.planHash(r.plan) !== P.planHash(plan), 'hash moved');
});

leg('P6 a local-only recompose refusal leaves the plan unchanged without the string', function () {
  const plan = deepFixture();
  const before = P.planHash(plan);
  const offered = 'Reworded question that must not be echoed back';
  const r = P.applyEdit(plan, { op: 'reword_leaf', leaf_id: 'L1', question: offered }, {
    recompose: function () { return { ok: false, degrade: 'local-only', reason: 'egress_violation' }; },
  });
  assertTrue(r.ok === false && r.degrade === 'local-only', JSON.stringify(r));
  assertTrue(r.plan === undefined, 'no plan on refusal');
  assertTrue(JSON.stringify(r).indexOf(offered) === -1, 'refusal echoed the offered string');
  assertTrue(P.planHash(plan) === before, 'input plan unchanged');
});

// ---------------------------------------------------------------------------
// P7 budget, scientific, counterevidence
// ---------------------------------------------------------------------------
leg('P7 set_budget above a cap returns over_cap', function () {
  const r = P.applyEdit(deepFixture(), { op: 'set_budget', budget: { max_searches: 17 } }, {});
  assertTrue(r.ok === false && r.reason === 'over_cap', JSON.stringify(r));
});

leg('P7 toggle_scientific flips the flag and records S5:navigator_toggle', function () {
  const plan = quickFixture();
  const r = P.applyEdit(plan, { op: 'toggle_scientific' }, {});
  assertTrue(r.ok === true, JSON.stringify(r));
  assertTrue(r.plan.context.scientific.is === true, 'flag flipped on');
  assertTrue(r.plan.context.scientific.signals.indexOf('S5:navigator_toggle') !== -1, 'signal recorded');
});

leg('P7 toggle_counterevidence off on a deep plan is refused', function () {
  const r = P.applyEdit(deepFixture(), { op: 'toggle_counterevidence', value: false }, {});
  assertTrue(r.ok === false && r.reason === 'counterevidence_mandatory', JSON.stringify(r));
});

leg('P7 drop_path records the path and its limiters in the ratchet', function () {
  const r = P.applyEdit(deepFixture(), { op: 'drop_path', path_id: 'PA2', reason: 'not affordable' }, {});
  assertTrue(r.ok === true, JSON.stringify(r));
  assertTrue(!r.plan.perspective.paths.some(function (x) { return x.id === 'PA2'; }), 'path removed');
  const kinds = r.plan.perspective.ratchet.discarded.map(function (d) { return d.kind + ':' + d.id; });
  assertTrue(kinds.indexOf('path:PA2') !== -1, 'path recorded ' + kinds.join(','));
  assertTrue(r.plan.pyramid.dropped.some(function (d) { return d.id === 'PA2' && d.reason === 'not affordable'; }), 'pyramid drop recorded');
});

// ---------------------------------------------------------------------------
// P8 / P9 the F.6 card
// ---------------------------------------------------------------------------
leg('P8 planReviewCard(deep) is a renderable F.6 card with every audited string', function () {
  const plan = deepFixture();
  const card = P.planReviewCard(plan);
  assertTrue(card.shape === 'F.6', 'shape');
  assertTrue(Array.isArray(card.options) && card.options.length >= 1 && card.options.length <= 3, 'options count');
  assertTrue(card.options.every(function (o) { return o.id && o.label; }), 'option shape');
  assertTrue(typeof card.title === 'string' && typeof card.question === 'string' && card.payload && typeof card.payload === 'object', 'card fields');
  const body = card.body_md;
  [Q_L1A, Q_L1B, Q_L2A, Q_L2B].forEach(function (q) { assertTrue(body.indexOf(q) !== -1, 'missing round-one query: ' + q); });
  assertTrue(body.indexOf('/mos:diffusion') !== -1 && body.indexOf('/mos:dominant-designs') !== -1, 'source commands');
  assertTrue(body.indexOf('diffusion') !== -1 && body.indexOf('dominant-design') !== -1, 'lenses');
  assertTrue(/max searches[^\n]*cap[^\n]*16|cap[^\n]*max searches[^\n]*16/i.test(body), 'budget numbers labeled as caps');
  assertTrue(/counterevidence[^\n]*on/i.test(body), 'counterevidence on');
  assertTrue(body.indexOf('market-analysis') !== -1, 'return target section');
  assertTrue(body.indexOf(plan.perspective.tension.statement) !== -1, 'tension');
  assertTrue(body.indexOf('400') !== -1 && body.indexOf('Wh/kg') !== -1 && body.indexOf(plan.perspective.goal.falsifier) !== -1, 'goal and falsifier');
  assertTrue(body.indexOf('a program of linked bets') !== -1, 'roadmap type');
  ['frustrated_insider', 'fresh_entrant', 'physics_grounder'].forEach(function (role) {
    assertTrue(body.split('\n').some(function (line) { return line.indexOf(role) !== -1 || line.indexOf(role.replace(/_/g, ' ')) !== -1; }), 'forum line ' + role);
  });
  assertTrue(/physics/i.test(body) && /assumed/i.test(body), 'limiter table columns');
  assertTrue(body.indexOf('Lithium metal dendrite growth') !== -1 && body.indexOf('Nobody re-tested cell pressure') !== -1, 'limiter statements');
  assertTrue(body.indexOf('LM2') !== -1 && body.indexOf('LM2') < body.indexOf('LM3', body.indexOf('LM2')), 'ranking');
  assertTrue(body.indexOf('adoption and cost overlap on price') !== -1, 'MECE warning');
  const at = body.search(/questions not yet asked/i);
  assertTrue(at !== -1, 'heading for uncovered dimensions');
  assertTrue(body.indexOf('regulation', at) !== -1 && body.indexOf('recycling', at) !== -1, 'uncovered dimensions listed under the heading');
});

leg('P8 the card options follow the plan mode', function () {
  const deep = P.planReviewCard(deepFixture());
  const quick = P.planReviewCard(quickFixture());
  assertTrue(deep.options[0].label === 'Run this deep research run (Recommended)', 'deep option one');
  assertTrue(deep.options[1].label === 'Edit the plan' && deep.options[2].label === 'Stop without running', 'deep options two and three');
  assertTrue(quick.options[0].label === 'Run this quick research run (Recommended)', 'quick option one');
  assertTrue(quick.options[1].label === 'Edit the plan' && quick.options[2].label === 'Not now', 'quick options two and three');
});

leg('P9 the card never prints a problem-type label or the retired mode names', function () {
  [deepFixture(), quickFixture()].forEach(function (plan) {
    const card = P.planReviewCard(plan);
    const all = card.title + '\n' + card.question + '\n' + card.body_md + '\n' + card.options.map(function (o) { return o.label; }).join('\n');
    ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked', 'Quick pass', 'deep dive'].forEach(function (bad) {
      assertTrue(all.indexOf(bad) === -1, 'card contains ' + bad);
    });
  });
  assertTrue(P.planReviewCard(deepFixture()).body_md.indexOf('deep research run') !== -1, 'names the deep research run');
});

// ---------------------------------------------------------------------------
// P10 RunResult
// ---------------------------------------------------------------------------
leg('P10 validateRunResult accepts a complete fixture and rejects bad ones', function () {
  const ok = P.validateRunResult(runFixture());
  assertTrue(ok.ok === true, JSON.stringify(ok.errors));
  const badVerdict = runFixture();
  badVerdict.verdict = 'great';
  assertTrue(P.validateRunResult(badVerdict).ok === false, 'verdict enum');
  const filed = runFixture();
  filed.filed = true;
  assertTrue(P.validateRunResult(filed).ok === false, 'quick filed true');
  const badStop = runFixture();
  badStop.stop_reason = 'bored';
  assertTrue(P.validateRunResult(badStop).ok === false, 'stop_reason enum');
});

leg('P10 newRunId matches rp-YYYY-MM-DD-8hex', function () {
  const id = P.newRunId(new Date('2026-09-29T10:00:00Z'));
  assertTrue(/^rp-2026-09-29-[0-9a-f]{8}$/.test(id), id);
  assertTrue(P.newRunId(new Date('2026-09-29T10:00:00Z')) !== id, 'ids are random per call');
});

leg('P10 BUDGETS constants match the disclosed defaults', function () {
  const B = P.BUDGETS;
  const want = {
    QUICK_MAX_QUERIES: 3, QUICK_TOP_ROWS: 5, QUICK_CORPORA: 1, QUICK_TIME_BUDGET_MS: 60000,
    DEEP_LANES_REQUESTED: 4, DEEP_ROUNDS: 2, DEEP_R1_QUERIES_PER_LANE: 2, DEEP_RESULTS_PER_QUERY: 5,
    DEEP_MAX_SEARCHES: 16, DEEP_TIME_BUDGET_MS: 1200000, MAX_PLAN_REVISIONS: 3, PYRAMID_DEPTH_CAP: 3,
  };
  Object.keys(want).forEach(function (k) { assertTrue(B[k] === want[k], k + ' is ' + B[k]); });
  assertTrue(Object.isFrozen(B), 'BUDGETS frozen');
  const src = fs.readFileSync(PLAN_FILE, 'utf8');
  Object.keys(want).forEach(function (k) {
    assertTrue(new RegExp('^const ' + k + ' = ', 'm').test(src), k + ' is not its own top-level const');
  });
});

// ---------------------------------------------------------------------------
// P11 dependency scan
// ---------------------------------------------------------------------------
leg('P11 every require in lib/core/research-planner is a node built-in or repo-relative (DRP363-18)', function () {
  const files = hygiene.listFilesRecursive(PLANNER_DIR).filter(function (f) { return f.endsWith('.cjs'); });
  assertTrue(files.length >= 1, 'no .cjs files to scan');
  files.forEach(function (f) {
    hygiene.nonCommentLines(f).forEach(function (line) {
      const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
      let m;
      while ((m = re.exec(line)) !== null) {
        const spec = m[1];
        assertTrue(spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../'), path.basename(f) + ' requires ' + spec);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// P12 no dashes; CONTEXT.md contract
// ---------------------------------------------------------------------------
leg('P12 no em-dash or en-dash in plan.cjs or the card body', function () {
  const src = fs.readFileSync(PLAN_FILE, 'utf8');
  assertTrue(src.indexOf(EM) === -1 && src.indexOf(EN) === -1, 'plan.cjs has a long dash');
  [deepFixture(), quickFixture()].forEach(function (plan) {
    const body = P.planReviewCard(plan).body_md;
    assertTrue(body.indexOf(EM) === -1 && body.indexOf(EN) === -1, 'card body has a long dash');
  });
  const dirty = deepFixture();
  dirty.pyramid.stated_question = 'Can it work ' + EM + ' really' + EN + 'truly?';
  const body = P.planReviewCard(dirty).body_md;
  assertTrue(body.indexOf(EM) === -1 && body.indexOf(EN) === -1, 'card body did not normalize a long dash from user prose');
});

leg('P12 CONTEXT.md has no long dash', function () {
  const src = fs.readFileSync(CONTEXT_FILE, 'utf8');
  assertTrue(src.indexOf(EM) === -1 && src.indexOf(EN) === -1, 'CONTEXT.md has a long dash');
});

leg('P12 CONTEXT.md carries the folder contract headings and the SEED-098 reuse contract', function () {
  const src = fs.readFileSync(CONTEXT_FILE, 'utf8');
  ['Reuse inventory (Canon Part 7)', 'Borrowed patterns (D-01)', 'SEED-098 reuse contract', 'One reasoning store (D-08)', 'Part 8 fences', 'What we do not copy'].forEach(function (h) {
    assertTrue(src.indexOf(h) !== -1, 'missing heading ' + h);
  });
  ['/mos:diffusion', '/mos:research', 'Apache-2.0', 'MIT', 'scientific-roadmapping', 'describeEngine().api_version'].forEach(function (s) {
    assertTrue(src.indexOf(s) !== -1, 'missing ' + s);
  });
});

// ---------------------------------------------------------------------------
// Hygiene close
// ---------------------------------------------------------------------------
leg('P13 no network was attempted', function () {
  assertTrue(guard.attempts() === 0, 'fetch was called');
});

const code = summary();
guard.restore();
process.exit(code);
