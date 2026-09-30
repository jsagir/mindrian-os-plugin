'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 06 -- planner question templates and the Minto pyramid
 * builder / checker / roll-up. Legs Y1-Y14 (plus sub-legs).
 *
 * Pure functions over fixtures; no room, no network. The `structure`
 * argument is a hand-built object (363-10 builds the real one). Evidence
 * rows are hand-built in the 363-11 row shape. No em-dash or en-dash in this
 * file: the checks spell those characters through String.fromCharCode.
 * Exit 0 pass, 1 fail, 77 skip.
 */

const fs = require('node:fs');
const path = require('node:path');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('363-06 pyramid');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'question-templates.cjs');
const PYRAMID_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'pyramid.cjs');
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let T = null;
let Y = null;
let loadError = null;
try {
  T = require(TEMPLATES_FILE);
  Y = require(PYRAMID_FILE);
} catch (e) {
  loadError = e;
}

function fx(name) { return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name + '.json'), 'utf8')); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function assertTrue(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function leg(name, fn) {
  try {
    const res = fn();
    if (res === false) check(name, false, 'returned false');
    else check(name, true);
  } catch (e) {
    check(name, false, String(e && e.message ? e.message : e).slice(0, 200));
  }
}
function need() { if (loadError) throw loadError; }

const GOOD = ['map-unknowns', 'root-cause', 'think-hats', 'whitespace-quick', 'diffusion', 'scientific-roadmapping'];
const TEMPLATE_BY_FIXTURE = {
  'map-unknowns': 'map-unknowns',
  'root-cause': 'root-cause',
  'think-hats': 'think-hats',
  'whitespace-quick': 'whitespace',
  'diffusion': 'diffusion',
  'scientific-roadmapping': 'scientific-roadmapping',
  'restated-only': 'whitespace',
};

function buildFrom(name, qsMod) {
  const qs = qsMod || fx(name);
  const template = T.TEMPLATES[TEMPLATE_BY_FIXTURE[name] || qs.template_id];
  const built = Y.buildPyramid(qs, { template: template, structure: {}, rung: 'IllDefined' });
  return { qs: qs, template: template, built: built };
}
function checkOf(b) {
  return Y.checkPyramid(b.built.pyramid, b.built.leaves, { template: b.template });
}
function dims(list) { return list.map(function (d) { return d.dimension; }); }

function row(id, leafId, label, extra) {
  const r = {
    row_id: id, leaf_id: leafId, record_id: 'rec-' + id, claim: 'claim ' + id, quote: 'quote ' + id,
    label: label, source_url: 'https://example.org/' + id, source_title: 'Title ' + id,
    retrieved_at: '2026-09-29T00:00:00Z', content_hash: 'sha256:' + id, evidence_tier: 'peer_reviewed',
    flags: { retracted: false, is_in_doaj: true, venue: 'journal' },
  };
  return Object.assign(r, extra || {});
}
function researchable(leaves) { return leaves.filter(function (l) { return l.researchable; }); }

// ---------------------------------------------------------------------------
// Y1 templates
// ---------------------------------------------------------------------------
leg('Y1 TEMPLATES has exactly the seven ids with full dimension records', function () {
  need();
  const ids = Object.keys(T.TEMPLATES).sort();
  const want = ['diffusion', 'eureka', 'map-unknowns', 'root-cause', 'scientific-roadmapping', 'think-hats', 'whitespace'];
  assertTrue(JSON.stringify(ids) === JSON.stringify(want), 'template ids ' + ids.join(','));
  assertTrue(JSON.stringify(T.PLANNER_TEMPLATE_IDS.slice().sort()) === JSON.stringify(want), 'PLANNER_TEMPLATE_IDS');
  const families = ['whitespace-gap/v1', 'concept-evidence/v1', 'causal-link/v1', 'constraint-interrogation/v1', 'diffusion/v1'];
  const steps = ['tension', 'goal', 'rung', 'forum', 'paths', 'limiters', 'ranking'];
  want.forEach(function (id) {
    const t = T.TEMPLATES[id];
    assertTrue(typeof t.framework === 'string' && t.framework.length > 0, id + ' framework');
    assertTrue(Array.isArray(t.doors) && t.doors.length > 0, id + ' doors');
    assertTrue(Array.isArray(t.lenses) && t.lenses.length > 0, id + ' lenses');
    assertTrue(Array.isArray(t.opportunity_rules), id + ' opportunity_rules');
    assertTrue(Array.isArray(t.dimensions) && t.dimensions.length > 0, id + ' dimensions');
    t.dimensions.forEach(function (d) {
      assertTrue(typeof d.id === 'string' && d.id.length > 0, id + ' dim id');
      assertTrue(typeof d.default_lens === 'string' && d.default_lens.length > 0, d.id + ' default_lens');
      assertTrue(d.default_family === null || families.indexOf(d.default_family) !== -1, d.id + ' default_family');
      assertTrue(d.falsifier_template === null || typeof d.falsifier_template === 'string', d.id + ' falsifier_template');
      assertTrue(steps.indexOf(d.perspective_step) !== -1, d.id + ' perspective_step');
      if (d.researchable) {
        assertTrue(typeof d.falsifier_default === 'string' && d.falsifier_default.length > 0, d.id + ' falsifier_default');
        if (d.default_family !== null) assertTrue(d.falsifier_template !== null, d.id + ' needs a falsifier template');
      } else {
        assertTrue(typeof d.not_researchable_reason === 'string' && d.not_researchable_reason.length > 0, d.id + ' reason');
      }
    });
  });
  const byId = {};
  want.forEach(function (id) { T.TEMPLATES[id].dimensions.forEach(function (d) { byId[d.id] = d; }); });
  ['mu:unknown_unknown', 'mu:hidden_known', 'hat:red', 'hat:blue', 'ws:irrelevant'].forEach(function (id) {
    assertTrue(byId[id] && byId[id].researchable === false && byId[id].not_researchable_reason.length > 0, id + ' not researchable');
  });
  const stable = {
    'map-unknowns': ['mu:known_known', 'mu:blind_spot', 'mu:hidden_known', 'mu:unknown_unknown'],
    'root-cause': ['rc:why_link', 'rc:6m_man', 'rc:6m_machine', 'rc:6m_method', 'rc:6m_material', 'rc:6m_measurement', 'rc:6m_nature'],
    'think-hats': ['hat:white', 'hat:black', 'hat:yellow', 'hat:green', 'hat:red', 'hat:blue'],
    'whitespace': ['ws:gap_claim', 'ws:covered_elsewhere', 'ws:irrelevant', 'ws:extraction_failure'],
    'diffusion': ['df:first_adopters', 'df:absorptive_capacity', 'df:civil_defense_crossing', 'df:timing'],
    'eureka': ['eu:mechanism_transfer', 'eu:already_known', 'eu:worth_exploring'],
    'scientific-roadmapping': ['sr:tension', 'sr:goal', 'sr:rung', 'sr:forum_insider', 'sr:forum_entrant', 'sr:forum_grounder', 'sr:paths', 'sr:paths_10x', 'sr:limiters', 'sr:ranking'],
  };
  Object.keys(stable).forEach(function (id) {
    const got = T.TEMPLATES[id].dimensions.map(function (d) { return d.id; });
    assertTrue(JSON.stringify(got) === JSON.stringify(stable[id]), id + ' dimension ids ' + got.join(','));
  });
});

leg('Y1b whitespace framework equals the command frontmatter value verbatim', function () {
  need();
  const src = fs.readFileSync(path.join(ROOT, 'commands', 'whitespace.md'), 'utf8');
  const m = src.match(/^frameworks:\s*\[\s*"([^"]+)"\s*\]/m);
  assertTrue(m, 'frameworks line found');
  assertTrue(T.TEMPLATES.whitespace.framework === m[1], 'whitespace framework ' + T.TEMPLATES.whitespace.framework);
  assertTrue(T.TEMPLATES['map-unknowns'].framework === 'Knowns and Unknowns Matrix Framework', 'map-unknowns framework');
  assertTrue(T.TEMPLATES.diffusion.framework === 'Adoption-Capacity Theory', 'diffusion framework');
  assertTrue(T.TEMPLATES['scientific-roadmapping'].framework === 'Scientific Roadmapping', 'sr framework');
});

// ---------------------------------------------------------------------------
// Y2 resolvers
// ---------------------------------------------------------------------------
leg('Y2 templateForCommand and templateForFramework resolve; /mos:research only explicitly', function () {
  need();
  assertTrue(T.templateForCommand('/mos:map-unknowns').id === 'map-unknowns', 'map-unknowns door');
  assertTrue(T.templateForCommand('/mos:root-cause').id === 'root-cause', 'root-cause door');
  assertTrue(T.templateForCommand('/mos:think-hats').id === 'think-hats', 'think-hats door');
  assertTrue(T.templateForCommand('/mos:whitespace').id === 'whitespace', 'whitespace door');
  assertTrue(T.templateForCommand('/mos:diffusion').id === 'diffusion', 'diffusion door');
  assertTrue(T.templateForFramework('Scientific Roadmapping').id === 'scientific-roadmapping', 'sr by framework');
  assertTrue(T.templateForFramework('No Such Framework') === null, 'unknown framework');
  assertTrue(T.templateForCommand('/mos:research') === null, '/mos:research does not resolve by command');
  assertTrue(T.templateForCommand('/mos:nope') === null, 'unknown command');
  assertTrue(T.TEMPLATES['scientific-roadmapping'].doors.indexOf('/mos:research') !== -1, 'sr declares /mos:research');
  const qs = fx('scientific-roadmapping');
  assertTrue(T.validateQuestionSet(qs).ok, 'explicit template_id validates');
});

// ---------------------------------------------------------------------------
// Y3 validateQuestionSet
// ---------------------------------------------------------------------------
leg('Y3 validateQuestionSet accepts every fixture; origin other fails', function () {
  need();
  GOOD.concat(['restated-only']).forEach(function (n) {
    const r = T.validateQuestionSet(fx(n));
    assertTrue(r.ok === true, n + ' should validate: ' + JSON.stringify(r.errors));
  });
  const bad = fx('think-hats');
  bad.leaves[1].origin = 'other';
  const r = T.validateQuestionSet(bad);
  assertTrue(r.ok === false && r.errors.some(function (e) { return e.indexOf('leaf_origin_invalid') === 0; }), 'origin other rejected: ' + JSON.stringify(r.errors));
  const noSchema = fx('think-hats');
  delete noSchema.schema;
  assertTrue(T.validateQuestionSet(noSchema).ok === false, 'schema required');
  const badTpl = fx('think-hats');
  badTpl.template_id = 'nope';
  assertTrue(T.validateQuestionSet(badTpl).ok === false, 'template id must exist');
  const noReason = fx('map-unknowns');
  noReason.leaves.forEach(function (l) { if (!l.researchable) delete l.not_researchable_reason; });
  assertTrue(T.validateQuestionSet(noReason).ok === false, 'not researchable needs a reason');
  const badDim = fx('think-hats');
  badDim.leaves[0].dimension = 'zz:nothing';
  assertTrue(T.validateQuestionSet(badDim).ok === false, 'unknown dimension rejected');
});

// ---------------------------------------------------------------------------
// Y4 build and check every good fixture
// ---------------------------------------------------------------------------
leg('Y4 buildPyramid returns the pyramid; checkPyramid passes six fixtures', function () {
  need();
  GOOD.forEach(function (n) {
    const b = buildFrom(n);
    assertTrue(b.built.ok === true, n + ' build ok: ' + JSON.stringify(b.built.errors));
    const p = b.built.pyramid;
    assertTrue(p.scqa && typeof p.scqa.situation === 'string' && p.scqa.situation.length > 0, n + ' scqa');
    assertTrue(typeof p.governing_question === 'string' && p.governing_question.length > 0, n + ' governing question');
    assertTrue(Array.isArray(p.key_line) && p.key_line.length > 0, n + ' key line');
    p.key_line.forEach(function (k) { assertTrue(Array.isArray(k.leaf_ids), n + ' key line leaf_ids'); });
    assertTrue(Array.isArray(b.built.leaves) && b.built.leaves.length > 0, n + ' leaves');
    b.built.leaves.forEach(function (l) {
      assertTrue(Array.isArray(l.queries) && typeof l.status === 'string' && typeof l.corpus === 'string', n + ' leaf plan shape');
    });
    const c = checkOf(b);
    assertTrue(c.passes === true, n + ' should pass: ' + JSON.stringify({ status: c.status, unc: c.coverage.uncovered, f: c.falsifiability.warnings, d00: c.d00 }));
    assertTrue(c.status === 'ready', n + ' status ' + c.status);
  });
  const w = buildFrom('whitespace-quick');
  assertTrue(w.built.pyramid.governing_status === 'restated', 'governing status starts restated');
  const mu = buildFrom('map-unknowns');
  assertTrue(mu.built.leaves.some(function (l) { return l.researchable === false && l.status === 'not_run'; }), 'not researchable leaf is not_run');
  const ws = buildFrom('whitespace-quick');
  assertTrue(ws.built.leaves.some(function (l) { return l.dimension === 'ws:extraction_failure' && l.corpus === 'room'; }), 'extraction failure leaf is a room corpus');
  const input = fx('think-hats');
  const before = JSON.stringify(input);
  Y.buildPyramid(input, { template: T.TEMPLATES['think-hats'], structure: {}, rung: 'IllDefined' });
  assertTrue(JSON.stringify(input) === before, 'buildPyramid does not mutate its input');
  const inv = clone(input);
  inv.leaves[0].origin = 'other';
  const r = Y.buildPyramid(inv, { template: T.TEMPLATES['think-hats'], structure: {}, rung: 'IllDefined' });
  assertTrue(r.ok === false && Array.isArray(r.errors), 'invalid question set does not build');
});

// ---------------------------------------------------------------------------
// Y5 D-00
// ---------------------------------------------------------------------------
leg('Y5 D-00 gate: restated-only fails, one researchable framework leaf passes it', function () {
  need();
  const b = buildFrom('restated-only');
  const c = checkOf(b);
  assertTrue(c.d00.passes === false, 'd00 fails when every leaf is user_stated');
  assertTrue(c.passes === false && c.status === 'wish', 'plan does not pass, status wish: ' + c.status);
  const qs = fx('restated-only');
  qs.leaves.push({
    id: 'L3', parent: 'K1', question: 'Is the same problem described under a different term in adjacent fields?', origin: 'framework_dimension',
    dimension: 'ws:gap_claim', lens: 'ws.gap', researchable: true, falsifier: { text: 'A paper that treats the problem under its own term.' }, slots: {},
  });
  const b2 = buildFrom('restated-only', qs);
  const c2 = checkOf(b2);
  assertTrue(c2.d00.passes === true, 'd00 passes with a framework leaf');
  assertTrue(c2.passes === true, 'plan passes: ' + JSON.stringify({ s: c2.status, u: c2.coverage.uncovered, f: c2.falsifiability.warnings }));
  const qs3 = fx('restated-only');
  qs3.leaves.push({
    id: 'L3', parent: 'K1', question: 'Is the same problem described under a different term in adjacent fields?', origin: 'mece_gap',
    dimension: 'ws:gap_claim', lens: 'ws.gap', researchable: false, not_researchable_reason: 'navigator judgment', falsifier: { text: '' }, slots: {},
  });
  const c3 = checkOf(buildFrom('restated-only', qs3));
  assertTrue(c3.d00.passes === false, 'a not researchable framework leaf does not satisfy D-00');
});

// ---------------------------------------------------------------------------
// Y6 coverage
// ---------------------------------------------------------------------------
leg('Y6 coverage: uncovered dimension blocks; a reasoned note moves it to not researchable', function () {
  need();
  const qs = fx('map-unknowns');
  qs.leaves = qs.leaves.filter(function (l) { return l.dimension !== 'mu:blind_spot'; });
  const b = buildFrom('map-unknowns', qs);
  const c = checkOf(b);
  assertTrue(dims(c.coverage.uncovered_detail).indexOf('mu:blind_spot') !== -1, 'blind spot is uncovered');
  assertTrue(c.coverage.uncovered.length === c.coverage.uncovered_detail.length && c.coverage.uncovered.every(function (u) { return typeof u === 'string'; }), 'uncovered is card-ready strings');
  assertTrue(c.coverage.uncovered_detail.every(function (u) { return typeof u.prompt === 'string' && u.prompt.length > 0; }), 'each uncovered dimension carries the question not asked');
  assertTrue(c.passes === false && c.status === 'incomplete', 'does not pass: ' + c.status);
  assertTrue(b.built.pyramid.coverage.uncovered.length > 0, 'pyramid carries the uncovered list for the card');
  const qs2 = clone(qs);
  qs2.coverage_notes = [{ dimension: 'mu:blind_spot', not_researchable_reason: 'no outside party to ask yet' }];
  const c2 = checkOf(buildFrom('map-unknowns', qs2));
  assertTrue(c2.coverage.not_researchable.some(function (n) { return n.dimension === 'mu:blind_spot' && n.reason === 'no outside party to ask yet'; }), 'moved to not researchable');
  assertTrue(dims(c2.coverage.uncovered_detail).indexOf('mu:blind_spot') === -1, 'no longer uncovered');
  assertTrue(c2.passes === true, 'passes: ' + JSON.stringify(c2.coverage.uncovered));
  const qs3 = clone(qs);
  qs3.coverage_notes = [{ dimension: 'mu:blind_spot', not_researchable_reason: '' }];
  assertTrue(checkOf(buildFrom('map-unknowns', qs3)).passes === false, 'an empty reason does not count');
  const rc = fx('root-cause');
  const rcSingle = checkOf(buildFrom('root-cause', rc));
  assertTrue(rcSingle.coverage.not_researchable.some(function (n) { return n.dimension === 'rc:6m_man' && /single causal chain/.test(n.reason); }), '6M is not researchable for a single chain');
  const multi = clone(rc);
  multi.multi_cause = true;
  const cm = checkOf(buildFrom('root-cause', multi));
  assertTrue(cm.passes === false && dims(cm.coverage.uncovered_detail).indexOf('rc:6m_man') !== -1, '6M becomes required when multi_cause');
  assertTrue(dims(cm.coverage.uncovered_detail).length === 6, 'all six 6M dimensions uncovered');
  const unk = fx('map-unknowns');
  const cu = checkOf(buildFrom('map-unknowns', unk));
  assertTrue(cu.coverage.not_researchable.some(function (n) { return n.dimension === 'mu:hidden_known'; }), 'hidden known is a reasoned not researchable dimension');
});

// ---------------------------------------------------------------------------
// Y7 falsifiability
// ---------------------------------------------------------------------------
leg('Y7 falsifiability via issue-tree validateFalsifiability, reported with the leaf id', function () {
  need();
  const qs = fx('map-unknowns');
  qs.leaves[1].falsifier = { text: '   ' };
  const c = checkOf(buildFrom('map-unknowns', qs));
  assertTrue(c.passes === false && c.status === 'incomplete', 'does not pass: ' + c.status);
  assertTrue(c.falsifiability.warnings.some(function (w) { return w.indexOf('L2') !== -1; }), 'warning names L2: ' + JSON.stringify(c.falsifiability.warnings));
  assertTrue(c.falsifiability.missing_leaf_ids.indexOf('L2') !== -1, 'missing_leaf_ids lists L2');
  const qs2 = fx('map-unknowns');
  delete qs2.leaves[1].falsifier;
  const c2 = checkOf(buildFrom('map-unknowns', qs2));
  assertTrue(c2.falsifiability.missing_leaf_ids.indexOf('L2') !== -1 && c2.passes === false, 'a missing falsifier object also fails');
  const okc = checkOf(buildFrom('map-unknowns'));
  assertTrue(okc.falsifiability.missing_leaf_ids.length === 0 && okc.falsifiability.warnings.length === 0, 'the good fixture has no falsifier warnings');
});

// ---------------------------------------------------------------------------
// Y8 MECE and restatement
// ---------------------------------------------------------------------------
leg('Y8 MECE overlap and restatement warnings are returned, never dropped', function () {
  need();
  const base = checkOf(buildFrom('think-hats'));
  const n0 = base.mece.warnings.length;
  const qs = fx('think-hats');
  qs.leaves.push({
    id: 'L9', parent: 'K1', question: 'What throughput figures do pathology workflow studies report for scanners?', origin: 'framework_dimension',
    dimension: 'hat:white', lens: 'hat.white', researchable: true, falsifier: { text: 'Studies reporting no throughput change.' }, slots: {},
  });
  const b = buildFrom('think-hats', qs);
  const c = checkOf(b);
  assertTrue(c.mece.warnings.length > n0, 'a new overlap warning appears');
  assertTrue(c.mece.warnings.some(function (w) { return w.indexOf('Possible overlap') !== -1; }), 'overlap wording from issue-tree');
  assertTrue(c.passes === true, 'a MECE warning is surfaced but does not fail the plan');
  assertTrue(b.built.pyramid.mece.warnings.length === c.mece.warnings.length, 'the pyramid carries the same warnings');
  const qs2 = fx('think-hats');
  qs2.leaves[3].question = qs2.stated_question;
  const c2 = checkOf(buildFrom('think-hats', qs2));
  assertTrue(c2.restatement_warnings.length >= 1, 'restatement warning present');
  assertTrue(c2.restatement_warnings.some(function (w) { return w.indexOf('L4') !== -1; }), 'restatement warning names the leaf: ' + JSON.stringify(c2.restatement_warnings));
  assertTrue(c2.passes === true, 'restatement only warns');
  assertTrue(c2.mece.restatement_warnings === undefined || Array.isArray(c2.mece.restatement_warnings), 'shape');
  const clean = checkOf(buildFrom('think-hats'));
  assertTrue(clean.restatement_warnings.length === 0, 'no restatement warning on the good fixture: ' + JSON.stringify(clean.restatement_warnings));
});

// ---------------------------------------------------------------------------
// Y9 diffusion lens
// ---------------------------------------------------------------------------
leg('Y9 D-19: the diffusion lens adds the df dimensions to coverage', function () {
  need();
  const b = buildFrom('scientific-roadmapping');
  const c = checkOf(b);
  ['df:first_adopters', 'df:absorptive_capacity', 'df:civil_defense_crossing', 'df:timing'].forEach(function (d) {
    assertTrue(c.coverage.dimensions.indexOf(d) !== -1, d + ' is part of coverage');
  });
  assertTrue(b.built.pyramid.lenses_selected.indexOf('diffusion') !== -1, 'lens recorded on the pyramid');
  const qs = fx('scientific-roadmapping');
  qs.leaves = qs.leaves.filter(function (l) { return l.dimension.indexOf('df:') !== 0; });
  const c2 = checkOf(buildFrom('scientific-roadmapping', qs));
  assertTrue(c2.status === 'needs_lens_leaves', 'status ' + c2.status);
  assertTrue(c2.passes === false, 'does not pass');
  assertTrue(JSON.stringify(c2.missing_lens_dimensions.slice().sort()) === JSON.stringify(['df:absorptive_capacity', 'df:civil_defense_crossing', 'df:first_adopters', 'df:timing']), 'missing lens dims ' + JSON.stringify(c2.missing_lens_dimensions));
  const qs3 = clone(qs);
  qs3.lens_selection = [];
  qs3.key_line = qs3.key_line.filter(function (k) { return k.dimension.indexOf('df:') !== 0; });
  const c3 = checkOf(buildFrom('scientific-roadmapping', qs3));
  assertTrue(c3.passes === true && c3.coverage.dimensions.indexOf('df:timing') === -1, 'without the lens the df dimensions are not required');
  const qs4 = fx('scientific-roadmapping');
  qs4.lens_selection = [{ lens: 'diffusion', reason: '' }];
  assertTrue(T.validateQuestionSet(qs4).ok === false, 'a lens selection needs a reason');
});

// ---------------------------------------------------------------------------
// Y10 Logic Trees
// ---------------------------------------------------------------------------
const LT_STEPS = [
  'Choose tree type based on problem',
  'Apply MECE principle at each level',
  'Break down until actionable',
  'Prioritize branches by impact',
  'Prune low-value branches',
];
function sciStructure(extra) {
  return Object.assign({ source: 'theo_ledger', scientific: true, frameworks: ['Scientific Roadmapping', 'Logic Trees'], logic_trees_steps: LT_STEPS.slice() }, extra || {});
}

leg('Y10a applyLogicTreeSteps sets tree type and records the applied steps', function () {
  need();
  const b = buildFrom('scientific-roadmapping');
  const ctx = { template: b.template, rung: 'WellDefined', perspective: b.qs.perspective };
  const r = Y.applyLogicTreeSteps(b.built.pyramid, b.built.leaves, sciStructure(), ctx);
  assertTrue(r.applied === true, 'applied');
  assertTrue(r.tree_type === 'hypothesis', 'WellDefined rung -> hypothesis: ' + r.tree_type);
  assertTrue(JSON.stringify(r.steps_applied) === JSON.stringify(LT_STEPS), 'steps applied in order');
  assertTrue(r.pyramid.tree_type === 'hypothesis', 'pyramid carries tree_type');
  const rc = buildFrom('root-cause');
  const r2 = Y.applyLogicTreeSteps(rc.built.pyramid, rc.built.leaves, sciStructure(), { template: rc.template, rung: 'WellDefined' });
  assertTrue(r2.tree_type === 'issue', 'root-cause template -> issue even at WellDefined: ' + r2.tree_type);
  const r3 = Y.applyLogicTreeSteps(b.built.pyramid, b.built.leaves, sciStructure(), { template: b.template, rung: 'IllDefined', perspective: b.qs.perspective });
  assertTrue(r3.tree_type === 'issue', 'IllDefined default -> issue: ' + r3.tree_type);
  const r4 = Y.applyLogicTreeSteps(b.built.pyramid, b.built.leaves, sciStructure({ frameworks: ['Scientific Roadmapping', 'Hypothesis-Driven Problem Solving'] }), { template: b.template, rung: 'IllDefined', perspective: b.qs.perspective });
  assertTrue(r4.tree_type === 'hypothesis', 'HDPS in the frameworks -> hypothesis: ' + r4.tree_type);
  const r5 = Y.applyLogicTreeSteps(b.built.pyramid, b.built.leaves, sciStructure(), { template: b.template, rung: 'IllDefined', decision_gate: true, perspective: b.qs.perspective });
  assertTrue(r5.tree_type === 'decision', 'decision-gate origin -> decision: ' + r5.tree_type);
  assertTrue(b.built.pyramid.tree_type !== 'decision', 'the input pyramid is not mutated by applyLogicTreeSteps');
});

leg('Y10b depth cap 3, ordering by unlock chain then weakest support, pruning with reasons', function () {
  need();
  const b = buildFrom('scientific-roadmapping');
  const ctxBase = { template: b.template, rung: 'IllDefined', perspective: b.qs.perspective };
  const leaves = clone(b.built.leaves);
  const lim = leaves.filter(function (l) { return l.dimension === 'sr:limiters'; });
  assertTrue(lim.length >= 4, 'fixture has four limiter leaves');
  lim[1].parent = lim[0].id;
  lim[2].parent = lim[1].id;
  lim[3].parent = lim[2].id;
  const r = Y.applyLogicTreeSteps(clone(b.built.pyramid), leaves, sciStructure(), ctxBase);
  assertTrue(r.rejected.some(function (x) { return x.id === lim[3].id && x.reason === 'depth_cap'; }), 'the fourth level leaf is rejected');
  assertTrue(!r.leaves.some(function (l) { return l.id === lim[3].id; }), 'rejected leaf is out of the returned leaves');
  assertTrue(r.leaves.some(function (l) { return l.id === lim[2].id; }), 'third level leaf stays');
  assertTrue(r.pyramid.dropped.some(function (d) { return d.id === lim[3].id && d.reason === 'depth_cap'; }), 'rejection recorded in pyramid.dropped');

  const support = {};
  const byLimiter = {};
  b.built.leaves.forEach(function (l) { if (l.limiter_id) byLimiter[l.limiter_id] = l.id; });
  const zeroChain = b.built.leaves.filter(function (l) { return !l.limiter_id || l.limiter_id === 'LM1' || l.limiter_id === 'LM4'; });
  support[zeroChain[0].id] = 5;
  const o = Y.applyLogicTreeSteps(clone(b.built.pyramid), clone(b.built.leaves), sciStructure(), Object.assign({}, ctxBase, { supportByLeaf: support }));
  const order = o.lane_order;
  const lm2 = order.indexOf(byLimiter.LM2);
  const lm3 = order.indexOf(byLimiter.LM3);
  assertTrue(lm2 === 0 && lm3 === 1, 'longest unlock chain first: ' + lm2 + ',' + lm3);
  const strong = order.indexOf(zeroChain[0].id);
  const weak = order.indexOf(zeroChain[1].id);
  assertTrue(weak < strong, 'weaker support first among equal chains');
  assertTrue(JSON.stringify(o.leaves.map(function (l) { return l.id; }).filter(function (id) { return order.indexOf(id) !== -1; })) === JSON.stringify(order), 'returned leaves follow lane_order');

  const drops = [{ id: lim[0].id, reason: 'low impact on the goal' }, { id: b.built.leaves[3].id }];
  const p = Y.applyLogicTreeSteps(clone(b.built.pyramid), clone(b.built.leaves), sciStructure(), Object.assign({}, ctxBase, { drops: drops }));
  assertTrue(p.pruned.some(function (x) { return x.id === lim[0].id && x.reason === 'low impact on the goal' && x.via === 'card_edit'; }), 'prune recorded as a card edit with its reason');
  assertTrue(p.refused_prunes.some(function (x) { return x.id === b.built.leaves[3].id && x.reason === 'reason_required'; }), 'a prune without a reason is refused');
  assertTrue(!p.leaves.some(function (l) { return l.id === lim[0].id; }), 'pruned leaf removed');
  assertTrue(p.leaves.some(function (l) { return l.id === b.built.leaves[3].id; }), 'refused prune keeps the leaf');
  assertTrue(p.pyramid.dropped.some(function (d) { return d.id === lim[0].id && d.reason === 'low impact on the goal' && d.kind === 'leaf'; }), 'prune recorded in pyramid.dropped');
});

leg('Y10c unknown step is recorded not fatal; non scientific structure is a no-op that says so', function () {
  need();
  const b = buildFrom('scientific-roadmapping');
  const ctx = { template: b.template, rung: 'IllDefined', perspective: b.qs.perspective };
  const st = sciStructure({ logic_trees_steps: LT_STEPS.concat(['Reticulate the splines']) });
  const r = Y.applyLogicTreeSteps(b.built.pyramid, b.built.leaves, st, ctx);
  assertTrue(r.applied === true && r.unmapped_steps.indexOf('Reticulate the splines') !== -1, 'unmapped step listed');
  assertTrue(r.steps_applied.length === 5, 'the five known steps still apply');
  const n = Y.applyLogicTreeSteps(b.built.pyramid, b.built.leaves, { source: 'local_template', scientific: false, frameworks: [], logic_trees_steps: LT_STEPS }, ctx);
  assertTrue(n.applied === false && n.reason === 'not_scientific_structure', 'no-op reason ' + n.reason);
  assertTrue(n.leaves.length === b.built.leaves.length && n.leaves[0].id === b.built.leaves[0].id, 'leaves unchanged');
  const e = Y.applyLogicTreeSteps(b.built.pyramid, b.built.leaves, sciStructure({ logic_trees_steps: [] }), ctx);
  assertTrue(e.applied === false && e.reason === 'no_logic_trees_steps', 'no steps in the ledger -> no-op');
  const objSteps = sciStructure({ logic_trees_steps: LT_STEPS.map(function (s, i) { return { order: i + 1, name: s }; }) });
  assertTrue(Y.applyLogicTreeSteps(b.built.pyramid, b.built.leaves, objSteps, ctx).steps_applied.length === 5, 'steps may be {order,name} objects');
});

// ---------------------------------------------------------------------------
// Y11 rollUp
// ---------------------------------------------------------------------------
function rowsFor(leaves, plan) {
  // plan: leafId -> array of labels
  const rows = [];
  let n = 0;
  leaves.forEach(function (l) {
    (plan[l.id] || []).forEach(function (label) { n += 1; rows.push(row('r' + n, l.id, label)); });
  });
  return rows;
}
function allSupports(leaves) {
  const plan = {};
  researchable(leaves).forEach(function (l) { plan[l.id] = ['supports']; });
  return plan;
}

leg('Y11 rollUp statuses, governing thought and unresolved branches', function () {
  need();
  const b = buildFrom('think-hats');
  const leaves = b.built.leaves;
  const py = b.built.pyramid;
  const r1 = Y.rollUp(py, leaves, rowsFor(leaves, allSupports(leaves)), {});
  assertTrue(r1.leaves.every(function (l) { return l.status === 'supported'; }), 'supports-only -> supported');
  assertTrue(r1.governing_status === 'strengthened', 'governing strengthened: ' + r1.governing_status);
  assertTrue(r1.unresolved_branches.length === 0, 'no unresolved branches');
  assertTrue(r1.pyramid.governing_status === 'strengthened' && r1.pyramid.key_line.every(function (k) { return k.status === 'supported'; }), 'pyramid carries branch statuses');

  const plan2 = allSupports(leaves);
  const blackLeaf = leaves.find(function (l) { return l.dimension === 'hat:black'; });
  plan2[blackLeaf.id] = ['contradicts'];
  const r2 = Y.rollUp(py, leaves, rowsFor(leaves, plan2), {});
  assertTrue(r2.leaves.find(function (l) { return l.id === blackLeaf.id; }).status === 'contradicted', 'contradicts-only -> contradicted');
  assertTrue(r2.governing_status === 'weakened', 'governing weakened: ' + r2.governing_status);

  const plan3 = allSupports(leaves);
  plan3[blackLeaf.id] = ['supports', 'contradicts'];
  const r3 = Y.rollUp(py, leaves, rowsFor(leaves, plan3), {});
  assertTrue(r3.leaves.find(function (l) { return l.id === blackLeaf.id; }).status === 'contested', 'both -> contested');
  assertTrue(r3.governing_status === 'split', 'governing split: ' + r3.governing_status);
  assertTrue(r3.contradictions.some(function (c) { return c.leaf_id === blackLeaf.id && c.row_ids.length === 2; }), 'the contradiction keeps both rows');

  const r4 = Y.rollUp(py, leaves, [], {});
  assertTrue(r4.leaves.every(function (l) { return l.status === 'unresolved'; }), 'none -> unresolved');
  assertTrue(r4.governing_status === 'unresolved', 'governing unresolved');
  assertTrue(JSON.stringify(r4.unresolved_branches.slice().sort()) === JSON.stringify(py.key_line.map(function (k) { return k.label; }).sort()), 'every branch named by label');

  const plan5 = allSupports(leaves);
  delete plan5[blackLeaf.id];
  const r5 = Y.rollUp(py, leaves, rowsFor(leaves, plan5), {});
  assertTrue(r5.governing_status === 'unresolved', 'one unresolved branch keeps the governing thought unresolved');
  assertTrue(JSON.stringify(r5.unresolved_branches) === JSON.stringify(['Black hat counterevidence']), 'only the black branch is named: ' + JSON.stringify(r5.unresolved_branches));

  const mu = buildFrom('map-unknowns');
  const r6 = Y.rollUp(mu.built.pyramid, mu.built.leaves, [], {});
  assertTrue(r6.leaves.some(function (l) { return l.dimension === 'mu:hidden_known' && l.status === 'not_run'; }), 'not researchable -> not_run');
  const r7 = Y.rollUp(py, leaves, rowsFor(leaves, { [blackLeaf.id]: ['context', 'derivation'] }), {});
  assertTrue(r7.leaves.find(function (l) { return l.id === blackLeaf.id; }).status === 'unresolved', 'context rows alone do not settle a leaf');
  const ws = buildFrom('whitespace-quick');
  const gap = ws.built.leaves.find(function (l) { return l.dimension === 'ws:gap_claim'; });
  const r8 = Y.rollUp(ws.built.pyramid, ws.built.leaves, [], { verdictByLeaf: { [gap.id]: 'gap-confirmed' } });
  assertTrue(r8.leaves.find(function (l) { return l.id === gap.id; }).status === 'supported', 'a gap-confirmed verdict supports the gap claim');
  const inputBefore = JSON.stringify(py);
  Y.rollUp(py, leaves, [], {});
  assertTrue(JSON.stringify(py) === inputBefore, 'rollUp does not mutate the pyramid');
});

// ---------------------------------------------------------------------------
// Y12 weakestBranch
// ---------------------------------------------------------------------------
leg('Y12 weakestBranch picks the contradicted or unresolved branch with the fewest supports', function () {
  need();
  const b = buildFrom('think-hats');
  const leaves = b.built.leaves;
  const black = leaves.find(function (l) { return l.dimension === 'hat:black'; });
  const green = leaves.find(function (l) { return l.dimension === 'hat:green'; });
  const plan = allSupports(leaves);
  plan[black.id] = ['contradicts'];
  delete plan[green.id];
  const r = Y.rollUp(b.built.pyramid, leaves, rowsFor(leaves, plan), {});
  const w = Y.weakestBranch(r.pyramid);
  assertTrue(w && w.label === 'Black hat counterevidence', 'contradicted with zero supports wins: ' + (w && w.label));
  const yellow = leaves.find(function (l) { return l.dimension === 'hat:yellow'; });
  const plan2 = allSupports(leaves);
  delete plan2[green.id];
  delete plan2[yellow.id];
  const white = leaves.filter(function (l) { return l.dimension === 'hat:white'; });
  const r2 = Y.rollUp(b.built.pyramid, leaves, rowsFor(leaves, plan2), {});
  const w2 = Y.weakestBranch(r2.pyramid);
  assertTrue(w2 && (w2.label === 'Green hat alternatives' || w2.label === 'Yellow hat prior successes'), 'an unresolved branch is chosen');
  assertTrue(w2.support_count === 0, 'support count carried');
  const r3 = Y.rollUp(b.built.pyramid, leaves, rowsFor(leaves, allSupports(leaves)), {});
  assertTrue(Y.weakestBranch(r3.pyramid) === null, 'null when every branch is supported');
  assertTrue(white.length === 2, 'fixture sanity');
  const plan4 = allSupports(leaves);
  plan4[white[0].id] = ['supports'];
  delete plan4[white[1].id];
  delete plan4[green.id];
  const r4 = Y.rollUp(b.built.pyramid, leaves, rowsFor(leaves, plan4), {});
  const w4 = Y.weakestBranch(r4.pyramid);
  assertTrue(w4.label === 'Green hat alternatives', 'fewest supporting rows wins among unresolved: ' + w4.label);
});

// ---------------------------------------------------------------------------
// Y13 opportunity candidates
// ---------------------------------------------------------------------------
leg('Y13a whitespace gap-confirmed gives literature_gap', function () {
  need();
  const b = buildFrom('whitespace-quick');
  const gap = b.built.leaves.find(function (l) { return l.dimension === 'ws:gap_claim'; });
  const c = Y.opportunityCandidates(b.built.pyramid, b.built.leaves, [], { verdict: 'gap-confirmed', perspective: b.qs.perspective, template: b.template });
  const hit = c.filter(function (x) { return x.kind === 'literature_gap'; });
  assertTrue(hit.length === 1 && hit[0].leaf_ids.indexOf(gap.id) !== -1, 'literature_gap on the gap claim leaf');
  c.forEach(function (x) { assertTrue(Array.isArray(x.leaf_ids) && Array.isArray(x.row_ids), 'candidate carries leaf_ids and row_ids'); assertTrue(Y.OPPORTUNITY_KINDS.indexOf(x.kind) !== -1, 'kind in OPPORTUNITY_KINDS'); });
  const none = Y.opportunityCandidates(b.built.pyramid, b.built.leaves, [], { verdict: 'thin', perspective: b.qs.perspective, template: b.template });
  assertTrue(none.filter(function (x) { return x.kind === 'literature_gap'; }).length === 0, 'thin verdict gives no literature_gap');
  assertTrue(JSON.stringify(Y.OPPORTUNITY_KINDS) === JSON.stringify(['literature_gap', 'constraint_attack', 'untried_intervention', 'mechanism_transfer', 'trend_break', 'funding_signal']), 'OPPORTUNITY_KINDS');
});

leg('Y13b assumed limiter with unlock length >= 1 gives constraint_attack; self steps do not count', function () {
  need();
  const b = buildFrom('scientific-roadmapping');
  const byLimiter = {};
  b.built.leaves.forEach(function (l) { if (l.limiter_id) byLimiter[l.limiter_id] = l.id; });
  const rows = [row('q1', byLimiter.LM2, 'retest'), row('q2', byLimiter.LM3, 'scurve_headroom'), row('q3', byLimiter.LM2, 'context')];
  const c = Y.opportunityCandidates(b.built.pyramid, b.built.leaves, rows, { verdict: null, perspective: b.qs.perspective, template: b.template });
  const ca = c.filter(function (x) { return x.kind === 'constraint_attack'; });
  const ids = ca.map(function (x) { return x.limiter_id; }).sort();
  assertTrue(JSON.stringify(ids) === JSON.stringify(['LM2', 'LM3']), 'LM2 and LM3 only: ' + JSON.stringify(ids));
  const lm2 = ca.find(function (x) { return x.limiter_id === 'LM2'; });
  assertTrue(lm2.leaf_ids.indexOf(byLimiter.LM2) !== -1 && lm2.row_ids.indexOf('q1') !== -1, 'candidate names its leaf and rows');
  assertTrue(lm2.row_ids.indexOf('q3') === -1, 'context rows are not evidence for the attack');
  assertTrue(!ids.includes('LM1') && !ids.includes('LM4'), 'physics limiter and self-only chain excluded');
  c.forEach(function (x) { assertTrue(Array.isArray(x.leaf_ids) && Array.isArray(x.row_ids), 'leaf_ids and row_ids present'); });
});

leg('Y13c funding_signal only from a labeled row carrying funder and program', function () {
  need();
  const b = buildFrom('whitespace-quick');
  const leaf = b.built.leaves[0];
  const good = row('f1', leaf.id, 'funding_signal', { funder: 'Example Foundation', program: 'Open Sensing Call' });
  const noProgram = row('f2', leaf.id, 'funding_signal', { funder: 'Example Foundation' });
  const wrongLabel = row('f3', leaf.id, 'context', { funder: 'Example Foundation', program: 'Open Sensing Call' });
  const opts = { verdict: null, perspective: b.qs.perspective, template: b.template };
  const c = Y.opportunityCandidates(b.built.pyramid, b.built.leaves, [good], opts);
  const fs1 = c.filter(function (x) { return x.kind === 'funding_signal'; });
  assertTrue(fs1.length === 1 && fs1[0].row_ids[0] === 'f1' && fs1[0].leaf_ids[0] === leaf.id, 'funding_signal from the complete row');
  assertTrue(fs1[0].funder === 'Example Foundation' && fs1[0].program === 'Open Sensing Call', 'funder and program carried');
  const c2 = Y.opportunityCandidates(b.built.pyramid, b.built.leaves, [noProgram, wrongLabel], opts);
  assertTrue(c2.filter(function (x) { return x.kind === 'funding_signal'; }).length === 0, 'no funding_signal without program or label');
});

leg('Y13d trend_break needs a ceiling reading on the incumbent and headroom on the challenger', function () {
  need();
  const b = buildFrom('diffusion');
  const timing = b.built.leaves.find(function (l) { return l.dimension === 'df:timing'; });
  const both = [row('t1', timing.id, 'scurve_ceiling'), row('t2', timing.id, 'scurve_headroom')];
  const opts = { verdict: null, perspective: b.qs.perspective, template: b.template };
  const c = Y.opportunityCandidates(b.built.pyramid, b.built.leaves, both, opts);
  const tb = c.filter(function (x) { return x.kind === 'trend_break'; });
  assertTrue(tb.length === 1 && tb[0].leaf_ids[0] === timing.id && tb[0].row_ids.sort().join() === 't1,t2', 'trend_break carries both rows');
  const one = Y.opportunityCandidates(b.built.pyramid, b.built.leaves, [both[0]], opts);
  assertTrue(one.filter(function (x) { return x.kind === 'trend_break'; }).length === 0, 'ceiling alone is not a trend break');
  const other = b.built.leaves.find(function (l) { return l.dimension === 'df:first_adopters'; });
  const wrongLeaf = Y.opportunityCandidates(b.built.pyramid, b.built.leaves, [row('t3', other.id, 'scurve_ceiling'), row('t4', other.id, 'scurve_headroom')], opts);
  assertTrue(wrongLeaf.filter(function (x) { return x.kind === 'trend_break'; }).length === 0, 'only the timing leaf counts');
});

// ---------------------------------------------------------------------------
// Y14 hygiene
// ---------------------------------------------------------------------------
leg('Y14 no em-dash or en-dash in the modules, the fixtures or this test', function () {
  const files = [TEMPLATES_FILE, PYRAMID_FILE, __filename];
  fs.readdirSync(FIXTURE_DIR).forEach(function (f) { files.push(path.join(FIXTURE_DIR, f)); });
  files.forEach(function (f) {
    assertTrue(fs.existsSync(f), 'file exists ' + path.basename(f));
    const s = fs.readFileSync(f, 'utf8');
    assertTrue(s.indexOf(EM) === -1 && s.indexOf(EN) === -1, path.basename(f) + ' has a long dash');
  });
  const src = fs.readFileSync(PYRAMID_FILE, 'utf8');
  assertTrue((src.match(/require\('\.\.\/issue-tree\.cjs'\)/g) || []).length === 1, 'pyramid.cjs requires issue-tree exactly once');
  assertTrue(/validateMECE/.test(src) && /validateFalsifiability/.test(src), 'issue-tree validators reused');
  assertTrue(!/Math\.random|Date\.now/.test(src), 'deterministic');
  assertTrue(!/require\('[^']*(brain-client|research-corpus|fetch)[^']*'\)/.test(src), 'no network or Brain requires');
});

leg('Y15 no network attempted', function () {
  assertTrue(guard.attempts() === 0, 'fetch attempts ' + guard.attempts());
});

process.exit(summary());
