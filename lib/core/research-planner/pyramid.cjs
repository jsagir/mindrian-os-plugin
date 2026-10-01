'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/research-planner/pyramid.cjs (Phase 363 Plan 06)
 *
 * The Minto pyramid, down, across and up (D-08).
 *
 *   down:   buildPyramid turns a question set (mos.research-question-set/1)
 *           into SCQA + governing question + key line + leaves, and
 *           checkPyramid checks it: MECE and falsifiability at every level
 *           (issue-tree, reused not re-implemented), coverage against the
 *           template's closed dimension set, and the D-00 gate.
 *   across: applyLogicTreeSteps lets the Logic Trees steps from the graph
 *           structure a scientific pyramid (D-09): tree type, depth cap,
 *           lane order, pruning.
 *   up:     rollUp attaches statuses to leaves and branches and says what
 *           happened to the governing thought; weakestBranch and
 *           opportunityCandidates are computed in code (D-07).
 *
 * Plain English: the checklist for a framework is the template. Any item on
 * the checklist that Larry did not turn into a question is a question the
 * navigator did not know to ask, and it is listed, never hidden. A plan whose
 * only questions are the ones the navigator already asked (restated) is a
 * wish, not research, and does not pass.
 *
 * Pure and local: no network, no Brain call, no room read, no randomness, no clock
 * reads. The question set, SCQA, leaf text and perspective prose never
 * leave the machine (Canon Part 8). No keyword classifier decides anything
 * from the navigator's text (AMB-07): the restatement check only produces a
 * warning, using the token-overlap rule issue-tree already ships.
 *
 * Pitfall 19: validateMECE alone never earns the words "MECE verified". Its
 * overlap heuristic covers the mutually exclusive half; the collectively
 * exhaustive half comes from coverage against the closed dimension set.
 *
 * Hyphens only: no em-dash or en-dash in any file of this plan.
 */

const IssueTreeEngine = require('../issue-tree.cjs');
// PYRAMID_DEPTH_CAP is owned by plan.cjs (363-05); one number, one owner.
const PYRAMID_DEPTH_CAP = require('./plan.cjs').BUDGETS.PYRAMID_DEPTH_CAP;
if (!Number.isInteger(PYRAMID_DEPTH_CAP) || PYRAMID_DEPTH_CAP < 1) throw new Error('plan.cjs BUDGETS.PYRAMID_DEPTH_CAP missing');
const Q = require('./question-templates.cjs');

// cross_domain_transfer (366-02, D-04): appended last so the final sort order of
// the six older kinds is unchanged. It is the eureka perspective's declared kind.
const OPPORTUNITY_KINDS = Object.freeze([
  'literature_gap', 'constraint_attack', 'untried_intervention', 'mechanism_transfer', 'trend_break', 'funding_signal',
  'cross_domain_transfer',
]);
const PAIR_KEYS = Object.freeze(['a', 'b', 'perspective', 'run_tag']);
const PAIR_FIELD_MAX = 200;

// The exact Logic Trees step names the ledger carries (363-RESEARCH Pattern 9).
const LT_STEP_NAMES = Object.freeze({
  TREE_TYPE: 'Choose tree type based on problem',
  MECE: 'Apply MECE principle at each level',
  BREAKDOWN: 'Break down until actionable',
  PRIORITIZE: 'Prioritize branches by impact',
  PRUNE: 'Prune low-value branches',
});
const LT_ORDER = Object.freeze([LT_STEP_NAMES.TREE_TYPE, LT_STEP_NAMES.MECE, LT_STEP_NAMES.BREAKDOWN, LT_STEP_NAMES.PRIORITIZE, LT_STEP_NAMES.PRUNE]);

const HDPS = 'Hypothesis-Driven Problem Solving';

const VERDICT_STATUS = Object.freeze({
  'settled': 'supported',
  'gap-confirmed': 'supported',
  'contested': 'contested',
  'thin': 'unresolved',
  'unresolved': 'unresolved',
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function list(v) { return Array.isArray(v) ? v : []; }

function templateOf(pyramid, opts) {
  if (opts && opts.template) return opts.template;
  if (pyramid && Q.TEMPLATES[pyramid.template_id]) return Q.TEMPLATES[pyramid.template_id];
  return null;
}

function lensTemplatesOf(pyramid, opts) {
  const out = {};
  const given = opts && opts.lensTemplates;
  list(pyramid && pyramid.lenses_selected).forEach(function (lens) {
    if (given && given[lens]) out[lens] = given[lens];
    else if (Q.LENS_TEMPLATES[lens]) out[lens] = Q.TEMPLATES[Q.LENS_TEMPLATES[lens]];
  });
  return out;
}

// Where a leaf hangs: another leaf, a key-line branch by id, or the key-line
// branch of its dimension. null means the root.
function parentRef(leaf, keyById, leafById, keyByDim) {
  if (nonEmpty(leaf.parent) && leaf.parent !== leaf.id) {
    if (leafById[leaf.parent]) return leaf.parent;
    if (keyById[leaf.parent]) return leaf.parent;
  }
  if (keyByDim[leaf.dimension]) return keyByDim[leaf.dimension].id;
  return null;
}

function indexes(keyLine, leaves) {
  const keyById = {};
  const keyByDim = {};
  const leafById = {};
  list(keyLine).forEach(function (k) {
    keyById[k.id] = k;
    if (!keyByDim[k.dimension]) keyByDim[k.dimension] = k;
  });
  list(leaves).forEach(function (l) { leafById[l.id] = l; });
  return { keyById: keyById, keyByDim: keyByDim, leafById: leafById };
}

// depthOf: top-level leaf = 1, each leaf-under-leaf step adds 1. A cycle
// counts as over the cap.
function depthOf(leaf, ix) {
  let depth = 1;
  let cur = leaf;
  const seen = {};
  while (cur) {
    if (seen[cur.id]) return PYRAMID_DEPTH_CAP + 1;
    seen[cur.id] = true;
    const ref = parentRef(cur, ix.keyById, ix.leafById, ix.keyByDim);
    if (ref !== null && ix.leafById[ref]) { depth += 1; cur = ix.leafById[ref]; } else { cur = null; }
  }
  return depth;
}

function branchOf(leaf, ix) {
  let cur = leaf;
  const seen = {};
  while (cur) {
    if (seen[cur.id]) return null;
    seen[cur.id] = true;
    const ref = parentRef(cur, ix.keyById, ix.leafById, ix.keyByDim);
    if (ref === null) return null;
    if (ix.keyById[ref]) return ref;
    cur = ix.leafById[ref];
  }
  return null;
}

function chainLength(perspective, limiterId) {
  if (!perspective || !limiterId) return 0;
  let best = 0;
  list(perspective.unlock_chains).forEach(function (c) {
    if (c && c.limiter_id === limiterId) {
      // Self steps (pushed by the navigator's own team) are excluded: they do
      // not unlock anything the field must first move.
      const n = list(c.steps).filter(function (s) { return s && s.pushed_by !== 'self'; }).length;
      if (n > best) best = n;
    }
  });
  return best;
}

function limiterIdOfLeaf(leaf, perspective) {
  if (leaf.limiter_id) return leaf.limiter_id;
  const hit = list(perspective && perspective.limiters).find(function (l) { return l && l.leaf_id === leaf.id; });
  return hit ? hit.id : null;
}

function treeTypeFor(ctx, structure) {
  const template = ctx && ctx.template;
  if (template && template.id === 'root-cause') return 'issue';
  if (ctx && ctx.decision_gate === true) return 'decision';
  const rung = ctx && ctx.rung;
  const fw = list(structure && structure.frameworks);
  if (rung === 'WellDefined' || fw.indexOf(HDPS) !== -1) return 'hypothesis';
  return 'issue';
}

// ---------------------------------------------------------------------------
// the issue-tree bridge: leaves and key-line branches become the node shape
// { label, test?, branches? } that IssueTreeEngine validates.
// ---------------------------------------------------------------------------
function leafTest(leaf) {
  if (leaf.researchable === false) return 'not researchable: ' + String(leaf.not_researchable_reason || '');
  return leaf.falsifier && nonEmpty(leaf.falsifier.text) ? leaf.falsifier.text : '';
}

function buildTree(keyLine, leaves) {
  const ix = indexes(keyLine, leaves);
  const children = {};
  const rootLeaves = [];
  list(leaves).forEach(function (l) {
    const ref = parentRef(l, ix.keyById, ix.leafById, ix.keyByDim);
    if (ref === null) rootLeaves.push(l);
    else { if (!children[ref]) children[ref] = []; children[ref].push(l); }
  });
  function leafNode(l, seen) {
    const next = Object.assign({}, seen);
    next[l.id] = true;
    const kids = list(children[l.id]).filter(function (k) { return !seen[k.id]; }).map(function (k) { return leafNode(k, next); });
    const node = { label: l.id + ': ' + l.question, test: leafTest(l) };
    if (kids.length > 0) { node.branches = kids; delete node.test; }
    return node;
  }
  const branches = list(keyLine).map(function (k) {
    const kids = list(children[k.id]);
    // A branch with exactly one childless leaf is not a decomposition: fold
    // it into that leaf so issue-tree does not warn "only 1 branch" for a
    // dimension that simply has one question.
    if (kids.length === 1 && list(children[kids[0].id]).length === 0) {
      const only = kids[0];
      return { label: k.label + ' / ' + only.id + ': ' + only.question, test: leafTest(only) };
    }
    if (kids.length === 0) return { label: k.label, test: 'no leaf yet: coverage is checked against the closed dimension set' };
    return { label: k.label, branches: kids.map(function (c) { return leafNode(c, {}); }) };
  });
  rootLeaves.forEach(function (l) { branches.push(leafNode(l, {})); });
  return { branches: branches };
}

// ---------------------------------------------------------------------------
// checkPyramid
// ---------------------------------------------------------------------------
function coverageReport(pyramid, leaves, template, lensTemplates) {
  const dimsList = [];
  Q.dimensionsFor(template, { multi_cause: pyramid.multi_cause === true }).forEach(function (d) {
    dimsList.push({ dim: d, source: 'template' });
  });
  Object.keys(lensTemplates).forEach(function (lens) {
    Q.dimensionsFor(lensTemplates[lens], { multi_cause: false }).forEach(function (d) {
      dimsList.push({ dim: d, source: 'lens:' + lens });
    });
  });
  const notes = {};
  list(pyramid.coverage_notes).forEach(function (n) {
    if (isObj(n) && nonEmpty(n.not_researchable_reason)) notes[n.dimension] = n.not_researchable_reason;
  });
  const byDim = {};
  list(leaves).forEach(function (l) { if (!byDim[l.dimension]) byDim[l.dimension] = []; byDim[l.dimension].push(l); });

  const covered = [];
  const uncovered = [];
  const notResearchable = [];
  dimsList.forEach(function (e) {
    const d = e.dim;
    const lvs = byDim[d.id] || [];
    if (lvs.length > 0) {
      covered.push(d.id);
      if (lvs.every(function (l) { return l.researchable === false; })) {
        notResearchable.push({ dimension: d.id, reason: String(lvs[0].not_researchable_reason || d.effective_reason || 'not researchable'), source: 'leaf' });
      }
    } else if (notes[d.id]) {
      notResearchable.push({ dimension: d.id, reason: notes[d.id], source: 'note' });
    } else if (!d.required) {
      notResearchable.push({ dimension: d.id, reason: d.effective_reason, source: e.source });
    } else {
      uncovered.push({ dimension: d.id, label: d.label, prompt: d.prompt, source: e.source });
    }
  });
  return {
    dimensions: dimsList.map(function (e) { return e.dim.id; }),
    covered: covered,
    uncovered: uncovered.map(function (u) { return u.label; }),
    uncovered_detail: uncovered,
    not_researchable: notResearchable,
  };
}

function checkPyramid(pyramid, leaves, opts) {
  const template = templateOf(pyramid, opts);
  if (!template) {
    return { passes: false, status: 'incomplete', errors: ['template_unknown'], d00: { passes: false, beyond_stated_leaf_ids: [], user_stated_leaf_ids: [], reason: 'template_unknown' } };
  }
  const lensTemplates = lensTemplatesOf(pyramid, opts);
  const allLeaves = list(leaves);
  const keyLine = list(pyramid.key_line);
  const ix = indexes(keyLine, allLeaves);
  const errors = [];

  // -- D-00: a plan needs at least one researchable leaf the navigator did not
  //    state (a framework dimension or a MECE gap).
  const beyond = allLeaves.filter(function (l) { return l.researchable === true && l.origin !== 'user_stated'; }).map(function (l) { return l.id; });
  const stated = allLeaves.filter(function (l) { return l.origin === 'user_stated'; }).map(function (l) { return l.id; });
  const d00 = {
    passes: beyond.length > 0,
    beyond_stated_leaf_ids: beyond,
    user_stated_leaf_ids: stated,
    reason: beyond.length > 0 ? 'the plan asks at least one question beyond the stated one' : 'every researchable leaf restates the navigator: a plan that only restates is a wish',
  };
  if (!d00.passes) errors.push('d00_failed');

  // -- coverage against the closed dimension set (plus lens dimensions)
  const coverage = coverageReport(pyramid, allLeaves, template, lensTemplates);
  const uncoveredTemplate = coverage.uncovered_detail.filter(function (u) { return u.source === 'template'; });
  const uncoveredLens = coverage.uncovered_detail.filter(function (u) { return u.source !== 'template'; });
  uncoveredTemplate.forEach(function (u) { errors.push('uncovered:' + u.dimension); });
  uncoveredLens.forEach(function (u) { errors.push('lens_leaves_missing:' + u.dimension); });

  // -- MECE and falsifiability through issue-tree, never a second validator
  const tree = buildTree(keyLine, allLeaves);
  const meceAll = IssueTreeEngine.validateMECE(tree.branches);
  const overlap = meceAll.filter(function (w) { return w.indexOf('Possible overlap') !== -1; });
  const single = meceAll.filter(function (w) { return w.indexOf('Possible overlap') === -1; });
  const falsWarnings = tree.branches.reduce(function (acc, b, i) {
    return acc.concat(IssueTreeEngine.validateFalsifiability(b, 'root/' + (i + 1)));
  }, []);
  const missing = allLeaves.filter(function (l) {
    return l.researchable === true && !(isObj(l.falsifier) && nonEmpty(l.falsifier.text));
  }).map(function (l) { return l.id; });
  missing.forEach(function (id) { errors.push('falsifier_missing:' + id); });

  // -- restatement: a non-stated leaf that repeats the stated question warns
  const restatement = [];
  if (nonEmpty(pyramid.stated_question)) {
    allLeaves.forEach(function (l) {
      if (l.origin === 'user_stated') return;
      const w = IssueTreeEngine.validateMECE([{ label: pyramid.stated_question }, { label: l.question }], 'restatement');
      if (w.some(function (x) { return x.indexOf('Possible overlap') !== -1; })) {
        restatement.push('Leaf ' + l.id + ' repeats the stated question instead of asking something new: "' + l.question + '".');
      }
    });
  }

  // -- depth cap
  const depthViolations = allLeaves.filter(function (l) { return depthOf(l, ix) > PYRAMID_DEPTH_CAP; }).map(function (l) { return l.id; });
  depthViolations.forEach(function (id) { errors.push('depth_cap:' + id); });

  const surfaced = meceAll.concat(restatement, falsWarnings);
  let status = 'ready';
  if (!d00.passes) status = 'wish';
  else if (uncoveredTemplate.length > 0 || missing.length > 0 || depthViolations.length > 0) status = 'incomplete';
  else if (uncoveredLens.length > 0) status = 'needs_lens_leaves';

  return {
    passes: status === 'ready',
    status: status,
    d00: d00,
    coverage: coverage,
    mece: {
      // Every warning the navigator must see: overlap and structure from
      // issue-tree, restatement, falsifiability. Never suppressed.
      warnings: surfaced,
      overlap_warnings: overlap,
      single_branch_warnings: single,
      restatement_warnings: restatement,
      falsifiability_warnings: falsWarnings,
      passes: surfaced.length === 0,
    },
    falsifiability: { warnings: falsWarnings, missing_leaf_ids: missing },
    restatement_warnings: restatement,
    missing_lens_dimensions: uncoveredLens.map(function (u) { return u.dimension; }),
    depth_violations: depthViolations,
    errors: errors,
  };
}

// ---------------------------------------------------------------------------
// buildPyramid
// ---------------------------------------------------------------------------
function normalizeLeaf(l, qs, dimIndex) {
  const d = dimIndex[l.dimension] || null;
  const out = {
    id: l.id,
    parent: nonEmpty(l.parent) ? l.parent : null,
    question: l.question.trim(),
    origin: l.origin,
    dimension: l.dimension,
    lens: l.lens,
    source_command: qs.command,
    researchable: l.researchable === true,
    falsifier: {
      text: isObj(l.falsifier) && nonEmpty(l.falsifier.text) ? l.falsifier.text.trim() : '',
      template_id: (isObj(l.falsifier) && l.falsifier.template_id) || (d ? d.falsifier_template : null) || null,
    },
    slots: isObj(l.slots) ? clone(l.slots) : {},
    corpus: nonEmpty(l.corpus) ? l.corpus : (l.dimension === 'ws:extraction_failure' ? 'room' : 'openalex'),
    status: l.researchable === true ? 'open' : 'not_run',
    queries: [],
  };
  if (l.researchable !== true) out.not_researchable_reason = l.not_researchable_reason;
  if (nonEmpty(l.limiter_id)) out.limiter_id = l.limiter_id;
  // 366-02: the closed perspective pair. Strings only, extra keys dropped, so
  // the pair enters the plan hash and nothing else rides along with it.
  const pair = closedPair(l.pair);
  if (pair) out.pair = pair;
  return out;
}

function closedPair(p) {
  if (!isObj(p)) return null;
  const okField = function (v) { return nonEmpty(v) && v.length <= PAIR_FIELD_MAX; };
  if (!PAIR_KEYS.every(function (k) { return okField(p[k]); })) return null;
  return { a: p.a, b: p.b, perspective: p.perspective, run_tag: p.run_tag };
}

function buildPyramid(qs, opts) {
  const o = opts || {};
  const shape = Q.validateQuestionSet(qs);
  if (!shape.ok) return { ok: false, errors: shape.errors };
  const template = o.template || Q.TEMPLATES[qs.template_id];
  const dimIndex = {};
  template.dimensions.forEach(function (d) { dimIndex[d.id] = d; });
  Object.keys(Q.LENS_TEMPLATES).forEach(function (lens) {
    Q.TEMPLATES[Q.LENS_TEMPLATES[lens]].dimensions.forEach(function (d) { if (!dimIndex[d.id]) dimIndex[d.id] = d; });
  });

  const leaves = qs.leaves.map(function (l) { return normalizeLeaf(l, qs, dimIndex); });
  const lensesSelected = Array.isArray(o.lensesSelected)
    ? o.lensesSelected.slice()
    : list(qs.lens_selection).map(function (s) { return s.lens; });

  const keyLine = qs.key_line.map(function (k) {
    return { id: k.id, label: k.label, dimension: k.dimension, leaf_ids: [] };
  });
  const ix = indexes(keyLine, leaves);
  leaves.forEach(function (l) {
    const bid = branchOf(l, ix);
    if (bid && ix.keyById[bid]) ix.keyById[bid].leaf_ids.push(l.id);
  });

  const pyramid = {
    template_id: template.id,
    stated_question: qs.stated_question.trim(),
    scqa: {
      situation: qs.scqa.situation,
      complication: qs.scqa.complication,
      question: qs.scqa.question,
      answer_hypothesis: nonEmpty(qs.scqa.answer_hypothesis) ? qs.scqa.answer_hypothesis : null,
    },
    governing_question: qs.scqa.question.trim(),
    // The thought as stated, not yet tested. rollUp moves it.
    governing_status: 'restated',
    tree_type: treeTypeFor({ template: template, rung: o.rung }, o.structure),
    mode_hint: qs.mode_hint === undefined ? null : qs.mode_hint,
    multi_cause: qs.multi_cause === true,
    lenses_selected: lensesSelected,
    coverage_notes: clone(list(qs.coverage_notes)),
    key_line: keyLine,
    dropped: [],
  };
  const check = checkPyramid(pyramid, leaves, { template: template, lensTemplates: o.lensTemplates });
  pyramid.coverage = { dimensions: check.coverage.dimensions, uncovered: check.coverage.uncovered, not_researchable: check.coverage.not_researchable };
  pyramid.mece = {
    warnings: check.mece.warnings,
    falsifiability: check.falsifiability.warnings,
    restatement_warnings: check.restatement_warnings,
    passes: check.mece.passes,
  };
  pyramid.d00 = { passes: check.d00.passes, beyond_stated_leaf_ids: check.d00.beyond_stated_leaf_ids };
  return { ok: true, pyramid: pyramid, leaves: leaves, check: check, status: check.status };
}

// ---------------------------------------------------------------------------
// applyLogicTreeSteps (D-09)
// ---------------------------------------------------------------------------
function logicTreesStepNames(structure) {
  if (!isObj(structure)) return [];
  let raw = [];
  if (Array.isArray(structure.logic_trees_steps)) raw = structure.logic_trees_steps;
  else if (isObj(structure.logic_trees) && Array.isArray(structure.logic_trees.steps)) raw = structure.logic_trees.steps;
  else if (Array.isArray(structure.steps)) {
    raw = structure.steps.filter(function (s) { return isObj(s) && s.framework === 'Logic Trees'; });
  }
  const entries = raw.map(function (s, i) {
    if (typeof s === 'string') return { order: i, name: s };
    if (isObj(s)) return { order: Number.isInteger(s.order) ? s.order : i, name: s.name || s.step || s.text || '' };
    return { order: i, name: '' };
  }).filter(function (e) { return nonEmpty(e.name); });
  entries.sort(function (a, b) { return a.order - b.order; });
  return entries.map(function (e) { return e.name.trim(); });
}

function normName(s) { return String(s).trim().replace(/\s+/g, ' ').toLowerCase(); }

function applyLogicTreeSteps(pyramid, leaves, structure, ctx) {
  const c = ctx || {};
  const base = { pyramid: clone(pyramid), leaves: clone(list(leaves)), steps_applied: [], unmapped_steps: [], rejected: [], pruned: [], refused_prunes: [], lane_order: [] };
  base.lane_order = base.leaves.filter(function (l) { return l.researchable; }).map(function (l) { return l.id; });
  base.tree_type = base.pyramid && base.pyramid.tree_type ? base.pyramid.tree_type : 'issue';

  if (!isObj(structure) || structure.scientific !== true) {
    return Object.assign(base, { applied: false, reason: 'not_scientific_structure' });
  }
  const names = logicTreesStepNames(structure);
  if (names.length === 0) return Object.assign(base, { applied: false, reason: 'no_logic_trees_steps' });

  const known = {};
  LT_ORDER.forEach(function (n) { known[normName(n)] = n; });
  const present = {};
  const stepsApplied = [];
  const unmapped = [];
  names.forEach(function (n) {
    const canon = known[normName(n)];
    if (canon) { if (!present[canon]) { present[canon] = true; stepsApplied.push(canon); } } else unmapped.push(n);
  });

  const py = base.pyramid;
  let lv = base.leaves;
  const template = c.template || Q.TEMPLATES[py.template_id] || null;
  const dropped = list(py.dropped);
  py.dropped = dropped;

  // Step 1: choose the tree type.
  if (present[LT_STEP_NAMES.TREE_TYPE]) py.tree_type = treeTypeFor({ template: template, rung: c.rung, decision_gate: c.decision_gate }, structure);

  // The depth cap is a pyramid invariant (plan.cjs owns the number); it holds
  // for every scientific pyramid whether or not step 3 is in the ledger.
  const rejected = [];
  let ix = indexes(py.key_line, lv);
  const over = {};
  lv.forEach(function (l) { const d = depthOf(l, ix); if (d > PYRAMID_DEPTH_CAP) over[l.id] = d; });
  Object.keys(over).forEach(function (id) {
    rejected.push({ id: id, reason: 'depth_cap', depth: over[id] });
    dropped.push({ id: id, kind: 'leaf', reason: 'depth_cap', step: LT_STEP_NAMES.BREAKDOWN, version: null });
  });
  lv = lv.filter(function (l) { return !over[l.id]; });

  // Step 3: break down until actionable. A leaf is done when it has a
  // falsifier (and a corpus) or is marked not researchable with a reason.
  let notActionable = [];
  if (present[LT_STEP_NAMES.BREAKDOWN]) {
    notActionable = lv.filter(function (l) {
      if (l.researchable === false) return !nonEmpty(l.not_researchable_reason);
      return !(isObj(l.falsifier) && nonEmpty(l.falsifier.text)) || !nonEmpty(l.corpus);
    }).map(function (l) { return l.id; });
  }

  // Step 5: prune, recorded as card edits with reasons (rejection is data).
  const pruned = [];
  const refused = [];
  if (present[LT_STEP_NAMES.PRUNE]) {
    list(c.drops).forEach(function (drop) {
      if (!isObj(drop) || !nonEmpty(drop.id)) { refused.push({ id: null, reason: 'id_required' }); return; }
      if (!lv.some(function (l) { return l.id === drop.id; })) { refused.push({ id: drop.id, reason: 'unknown_leaf' }); return; }
      if (!nonEmpty(drop.reason)) { refused.push({ id: drop.id, reason: 'reason_required' }); return; }
      ix = indexes(py.key_line, lv);
      const gone = {};
      gone[drop.id] = drop.reason;
      // A pruned leaf takes its descendants with it.
      let grew = true;
      while (grew) {
        grew = false;
        lv.forEach(function (l) {
          if (gone[l.id] === undefined) {
            const ref = parentRef(l, ix.keyById, ix.leafById, ix.keyByDim);
            if (ref !== null && gone[ref] !== undefined) { gone[l.id] = 'parent_pruned'; grew = true; }
          }
        });
      }
      Object.keys(gone).forEach(function (id) {
        pruned.push({ id: id, reason: gone[id], via: 'card_edit' });
        dropped.push({ id: id, kind: 'leaf', reason: gone[id], step: LT_STEP_NAMES.PRUNE, via: 'card_edit', version: null });
      });
      lv = lv.filter(function (l) { return gone[l.id] === undefined; });
    });
  }

  // Step 4: prioritize. Unlock-chain length first (longest first), then
  // weakest support first; the original order breaks ties.
  const support = isObj(c.supportByLeaf) ? c.supportByLeaf : {};
  const researchableLeaves = lv.filter(function (l) { return l.researchable; });
  const rest = lv.filter(function (l) { return !l.researchable; });
  let ordered = researchableLeaves;
  if (present[LT_STEP_NAMES.PRIORITIZE]) {
    const decorated = researchableLeaves.map(function (l, i) {
      return { l: l, i: i, chain: chainLength(c.perspective, limiterIdOfLeaf(l, c.perspective)), sup: Number(support[l.id]) || 0 };
    });
    decorated.sort(function (a, b) { return (b.chain - a.chain) || (a.sup - b.sup) || (a.i - b.i); });
    ordered = decorated.map(function (d) { return d.l; });
  }
  lv = ordered.concat(rest);

  // Refresh branch membership and, when step 2 is in the ledger, re-run the
  // MECE and coverage checks over what remains.
  const keyLine = list(py.key_line).map(function (k) { return Object.assign({}, k, { leaf_ids: [] }); });
  const ix2 = indexes(keyLine, lv);
  lv.forEach(function (l) { const bid = branchOf(l, ix2); if (bid && ix2.keyById[bid]) ix2.keyById[bid].leaf_ids.push(l.id); });
  py.key_line = keyLine;
  let mece = null;
  if (present[LT_STEP_NAMES.MECE] && template) {
    mece = checkPyramid(py, lv, { template: template });
    py.mece = { warnings: mece.mece.warnings, falsifiability: mece.falsifiability.warnings, restatement_warnings: mece.restatement_warnings, passes: mece.mece.passes };
    py.coverage = { dimensions: mece.coverage.dimensions, uncovered: mece.coverage.uncovered, not_researchable: mece.coverage.not_researchable };
  }

  return {
    applied: true,
    tree_type: py.tree_type,
    steps_applied: LT_ORDER.filter(function (n) { return present[n]; }),
    unmapped_steps: unmapped,
    rejected: rejected,
    pruned: pruned,
    refused_prunes: refused,
    not_actionable: notActionable,
    lane_order: ordered.map(function (l) { return l.id; }),
    check: mece,
    pyramid: py,
    leaves: lv,
  };
}

// ---------------------------------------------------------------------------
// rollUp (D-07, D-08 up)
// ---------------------------------------------------------------------------
function rowsByLeaf(rows) {
  const out = {};
  list(rows).forEach(function (r) {
    if (!isObj(r) || !nonEmpty(r.leaf_id)) return;
    if (!out[r.leaf_id]) out[r.leaf_id] = [];
    out[r.leaf_id].push(r);
  });
  return out;
}

function branchStatus(statuses, hasLeaves) {
  const st = statuses.filter(function (s) { return s !== 'not_run'; });
  if (st.length === 0) return hasLeaves ? 'not_run' : 'unresolved';
  const has = function (x) { return st.indexOf(x) !== -1; };
  if (has('contested') || (has('supported') && has('contradicted'))) return 'contested';
  if (st.every(function (s) { return s === 'supported'; })) return 'supported';
  if (has('contradicted')) return 'contradicted';
  return 'unresolved';
}

function governingStatus(branchStatuses) {
  const st = branchStatuses.filter(function (s) { return s !== 'not_run'; });
  if (st.length === 0) return 'unresolved';
  if (st.every(function (s) { return s === 'supported'; })) return 'strengthened';
  if (st.indexOf('contested') !== -1) return 'split';
  if (st.indexOf('contradicted') !== -1) return 'weakened';
  return 'unresolved';
}

function rollUp(pyramid, leaves, rows, opts) {
  const o = opts || {};
  const verdicts = isObj(o.verdictByLeaf) ? o.verdictByLeaf : {};
  const byLeaf = rowsByLeaf(rows);
  const py = clone(pyramid);
  const contradictions = [];

  const outLeaves = clone(list(leaves)).map(function (l) {
    const rs = byLeaf[l.id] || [];
    const sup = rs.filter(function (r) { return r.label === 'supports'; });
    const con = rs.filter(function (r) { return r.label === 'contradicts'; });
    l.support_count = sup.length;
    l.contradict_count = con.length;
    if (l.researchable === false) { l.status = 'not_run'; return l; }
    let status;
    if (sup.length > 0 && con.length > 0) status = 'contested';
    else if (sup.length > 0) status = 'supported';
    else if (con.length > 0) status = 'contradicted';
    else status = 'unresolved';
    if (nonEmpty(verdicts[l.id]) && VERDICT_STATUS[verdicts[l.id]]) status = VERDICT_STATUS[verdicts[l.id]];
    l.status = status;
    if (status === 'contested') {
      contradictions.push({ leaf_id: l.id, row_ids: sup.concat(con).map(function (r) { return r.row_id; }) });
    }
    return l;
  });

  const byId = {};
  outLeaves.forEach(function (l) { byId[l.id] = l; });
  list(py.key_line).forEach(function (k) {
    const ls = list(k.leaf_ids).map(function (id) { return byId[id]; }).filter(Boolean);
    k.status = branchStatus(ls.map(function (l) { return l.status; }), ls.length > 0);
    k.support_count = ls.reduce(function (n, l) { return n + (l.support_count || 0); }, 0);
    k.contradict_count = ls.reduce(function (n, l) { return n + (l.contradict_count || 0); }, 0);
  });

  py.governing_status = governingStatus(list(py.key_line).map(function (k) { return k.status; }));
  const unresolved = list(py.key_line).filter(function (k) { return k.status === 'unresolved'; }).map(function (k) { return k.label; });
  const weakest = weakestBranch(py);

  return {
    pyramid: py,
    leaves: outLeaves,
    governing_status: py.governing_status,
    unresolved_branches: unresolved,
    contradictions: contradictions,
    weakest_branch: weakest,
  };
}

// The contradicted or unresolved branch with the fewest supporting rows;
// contradicted before unresolved on a tie. null when nothing is weak.
function weakestBranch(pyramid) {
  const weak = list(pyramid && pyramid.key_line).map(function (k, i) { return { k: k, i: i }; }).filter(function (e) {
    return e.k.status === 'contradicted' || e.k.status === 'unresolved';
  });
  if (weak.length === 0) return null;
  weak.sort(function (a, b) {
    const sa = a.k.support_count || 0;
    const sb = b.k.support_count || 0;
    if (sa !== sb) return sa - sb;
    const ca = a.k.status === 'contradicted' ? 0 : 1;
    const cb = b.k.status === 'contradicted' ? 0 : 1;
    return (ca - cb) || (a.i - b.i);
  });
  return weak[0].k;
}

// ---------------------------------------------------------------------------
// opportunityCandidates (D-07)
// ---------------------------------------------------------------------------
function opportunityCandidates(pyramid, leaves, rows, opts) {
  const o = opts || {};
  const template = templateOf(pyramid, o);
  const kinds = {};
  const sources = [];
  if (template) sources.push(template);
  Object.keys(lensTemplatesOf(pyramid, o)).forEach(function (lens) { sources.push(lensTemplatesOf(pyramid, o)[lens]); });
  sources.forEach(function (t) { list(t.opportunity_rules).forEach(function (r) { kinds[r.kind] = true; }); });

  const allLeaves = list(leaves);
  const byLeaf = rowsByLeaf(rows);
  const rowIds = function (leafId, labels) {
    return list(byLeaf[leafId]).filter(function (r) { return labels.indexOf(r.label) !== -1; }).map(function (r) { return r.row_id; });
  };
  const out = [];

  // 366-02 (D-04, D-06): ONE generic pair branch for every perspective. A leaf
  // that carries a pair is filed only here, through the template's own
  // opportunity_rules, so the dedicated branches below skip it (no double
  // emission) and no per-perspective pyramid branch is ever written.
  const seenRule = {};
  sources.forEach(function (t) {
    list(t.opportunity_rules).forEach(function (rule) {
      if (!isObj(rule) || OPPORTUNITY_KINDS.indexOf(rule.kind) === -1 || !nonEmpty(rule.dimension)) return;
      const rk = rule.kind + '\u0000' + rule.dimension;
      if (seenRule[rk]) return;
      seenRule[rk] = true;
      const prefix = rule.dimension.split(':')[0];
      allLeaves.filter(function (l) {
        return isObj(l) && l.dimension === rule.dimension && l.researchable && isObj(l.pair);
      }).forEach(function (l) {
        if (!pairLeafSupported(l, allLeaves, prefix)) return;
        out.push({
          kind: rule.kind, leaf_ids: [l.id], row_ids: rowIds(l.id, ['supports', 'context']), pair: clone(l.pair),
          reason: 'The pair held up on this leaf and the room does not already connect the two (' + rule.dimension + ').',
        });
      });
    });
  });

  if (kinds.literature_gap && o.verdict === 'gap-confirmed') {
    allLeaves.filter(function (l) { return l.dimension === 'ws:gap_claim' && l.researchable && !l.pair; }).forEach(function (l) {
      out.push({
        kind: 'literature_gap', leaf_ids: [l.id], row_ids: rowIds(l.id, ['context']),
        reason: 'The gap claim held up against the search: nothing found that addresses the zone directly.',
      });
    });
  }

  if (kinds.constraint_attack && isObj(o.perspective)) {
    list(o.perspective.limiters).forEach(function (lim) {
      if (!isObj(lim) || lim.column !== 'assumed') return;
      if (chainLength(o.perspective, lim.id) < 1) return;
      const matched = allLeaves.filter(function (l) { return l.limiter_id === lim.id || lim.leaf_id === l.id; });
      const ls = matched.filter(function (l) { return !l.pair; });
      // every leaf of this limiter carries a pair: the generic pair branch owns it
      if (matched.length > 0 && ls.length === 0) return;
      const ids = [];
      ls.forEach(function (l) { if (ids.indexOf(l.id) === -1) ids.push(l.id); });
      const rids = [];
      ids.forEach(function (id) {
        rowIds(id, ['retest', 'derivation', 'scurve_headroom', 'scurve_ceiling']).forEach(function (r) { if (rids.indexOf(r) === -1) rids.push(r); });
      });
      out.push({
        kind: 'constraint_attack', limiter_id: lim.id, leaf_ids: ids, row_ids: rids,
        reason: 'An assumed limiter that unlocks at least one downstream step and has not been re-tested.',
      });
    });
  }

  if (kinds.trend_break) {
    allLeaves.filter(function (l) { return l.dimension === 'df:timing' && l.researchable && !l.pair; }).forEach(function (l) {
      const ceil = rowIds(l.id, ['scurve_ceiling']);
      const head = rowIds(l.id, ['scurve_headroom']);
      if (ceil.length > 0 && head.length > 0) {
        out.push({
          kind: 'trend_break', leaf_ids: [l.id], row_ids: ceil.concat(head),
          reason: 'The incumbent reads near its ceiling while the challenger reads with headroom.',
        });
      }
    });
  }

  // funding_signal fires only from a labeled row that carries funder and program.
  const funding = {};
  const fundingOrder = [];
  list(rows).forEach(function (r) {
    if (!isObj(r) || r.label !== 'funding_signal') return;
    if (!nonEmpty(r.funder) || !nonEmpty(r.program) || !nonEmpty(r.row_id) || !nonEmpty(r.leaf_id)) return;
    const key = r.funder.trim() + '\u0000' + r.program.trim();
    if (!funding[key]) { funding[key] = { kind: 'funding_signal', funder: r.funder.trim(), program: r.program.trim(), leaf_ids: [], row_ids: [], reason: 'A validated row names a funder and a program for this work.' }; fundingOrder.push(key); }
    if (funding[key].leaf_ids.indexOf(r.leaf_id) === -1) funding[key].leaf_ids.push(r.leaf_id);
    funding[key].row_ids.push(r.row_id);
  });
  fundingOrder.forEach(function (k) { out.push(funding[k]); });

  // Final guard: one candidate per kind + leaf_ids. The limiter, funder and
  // program ride the key so two limiters or two funders on one leaf stay two.
  const seen = {};
  const deduped = out.filter(function (c) {
    const k = [c.kind, list(c.leaf_ids).join(','), c.limiter_id || '', c.funder || '', c.program || ''].join('\u0000');
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
  deduped.sort(function (a, b) { return OPPORTUNITY_KINDS.indexOf(a.kind) - OPPORTUNITY_KINDS.indexOf(b.kind); });
  return deduped;
}

// pairLeafSupported(l, allLeaves, prefix): the ONE per-leaf condition of the
// generic pair branch, for every kind. The rolled leaf status is 'supported'
// (rollUp sets it from supports rows or from verdictByLeaf through
// VERDICT_STATUS, where 'settled' and 'gap-confirmed' both map to supported),
// and no leaf on <prefix>:already_known is supported while carrying the same
// pair (either order) or carrying no pair at all (a run-level known leaf).
function pairLeafSupported(l, allLeaves, prefix) {
  if (!isObj(l) || l.status !== 'supported' || !isObj(l.pair)) return false;
  const knownDim = prefix + ':already_known';
  const hit = list(allLeaves).some(function (k) {
    if (!isObj(k) || k.dimension !== knownDim || k.status !== 'supported') return false;
    if (!isObj(k.pair)) return true;
    return (k.pair.a === l.pair.a && k.pair.b === l.pair.b) || (k.pair.a === l.pair.b && k.pair.b === l.pair.a);
  });
  return !hit;
}

module.exports = {
  OPPORTUNITY_KINDS: OPPORTUNITY_KINDS,
  LT_STEP_NAMES: LT_STEP_NAMES,
  buildPyramid: buildPyramid,
  checkPyramid: checkPyramid,
  applyLogicTreeSteps: applyLogicTreeSteps,
  rollUp: rollUp,
  weakestBranch: weakestBranch,
  opportunityCandidates: opportunityCandidates,
};
