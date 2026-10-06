/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 07 -- the research-perspective builder (D-18, D-19).
 *
 * Plain English: this is the engine that makes every research plan ask "what
 * does the field treat as fixed, and which of those things are really
 * physics?" instead of "what should we build?". It runs the seven Scientific
 * Roadmapping operations, sorts every limiter into two columns (physics or
 * assumed), turns each assumed limiter into a research question, ranks the
 * limiters by how many dominoes the FIELD would push once one falls, and keeps
 * a ratchet so a settled constraint is never re-argued without new evidence.
 *
 * Framework-keyed: nothing here is specific to one command. describeEngine()
 * is the reuse contract SEED-098 binds to (no second engine).
 *
 * Egress (Canon Part 8): pure and local. No network, no brain-client, no
 * research-corpus. Perspective prose, limiter statements, unlock chains and
 * forum passes never leave the machine. srStepGuide reads a ledger object the
 * caller passes in; it never loads data or calls Theo itself.
 *
 * Hyphens only, no em-dashes.
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const IssueTreeEngine = require('../issue-tree.cjs');
const planMod = require('./plan.cjs');

function frozen(a) { return Object.freeze(a.slice()); }

const ENGINES = frozen(['scientific-roadmapping', 'constraint-layer']);
const SR_OPERATIONS = frozen([
  'Tension Qualification',
  'Goal Quantification',
  'Rung Placement and Type Selection',
  'Forum Construction',
  'Path Enumeration',
  'Constraint Interrogation',
  'Catalytic Ranking',
]);
const FORUM_ROLES = frozen(['frustrated_insider', 'fresh_entrant', 'physics_grounder']);

// The article's step 3, by rung. Wicked bounds the map: "unresolved" is a valid outcome [disclosed default].
const ROADMAP_TYPES = Object.freeze({
  UnDefined: frozen(['Landscape', 'Vision']),
  IllDefined: frozen(['Manifesto', 'Technical Roadmap']),
  WellDefined: frozen(['Pipeline', 'Opportunity']),
  Wicked: frozen(['Landscape']),
});
const IDEA_KIND = Object.freeze({
  UnDefined: 'reframings',
  IllDefined: 'programs',
  WellDefined: 'optimizations',
  Wicked: 'systems map',
});
// Higher number = more defined question. A type placed above the honest rung is the failure mode.
const RUNG_ORDER = Object.freeze({ UnDefined: 1, IllDefined: 2, WellDefined: 3 });

const API_VERSION = '1';

const LOCAL_STEP_TEMPLATE = Object.freeze([
  { name: SR_OPERATIONS[0], key_question: 'Does the field agree the goal matters while disputing whether it is reachable, and can you name the limiter?', gates: [] },
  { name: SR_OPERATIONS[1], key_question: 'What target, with what unit and threshold, and what result would prove the direction wrong?', gates: [] },
  { name: SR_OPERATIONS[2], key_question: 'Which rung is the question honestly on, and which roadmap type fits it?', gates: [] },
  { name: SR_OPERATIONS[3], key_question: 'What do the frustrated insider, the fresh entrant and the physics grounder each say, written one pass at a time?', gates: [] },
  { name: SR_OPERATIONS[4], key_question: 'Which routes cover the space without overlap, and where is the 10X resurvey path?', gates: [] },
  { name: SR_OPERATIONS[5], key_question: 'Is each limiter physics or assumed, and what is the question behind every assumed one?', gates: [] },
  { name: SR_OPERATIONS[6], key_question: 'Which limiter unlocks the longest chain of steps the field would push itself?', gates: [] },
]);

// ------------------------------------------------------------------ helpers
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function arr(v) { return Array.isArray(v) ? v : []; }

function limiterKey(statement) {
  const tokens = String(statement == null ? '' : statement).toLowerCase().match(/[a-z0-9]+/g) || [];
  const uniq = Array.from(new Set(tokens)).sort();
  return crypto.createHash('sha256').update(uniq.join(' ')).digest('hex').slice(0, 16);
}

function isRetracted(row) { return !!(row && row.flags && row.flags.retracted); }

function rowsForLimiter(limiter, rows) {
  return arr(rows).filter(function (r) {
    if (!isObj(r) || isRetracted(r)) return false;
    if (limiter && nonEmpty(limiter.leaf_id) && nonEmpty(r.leaf_id) && limiter.leaf_id !== r.leaf_id) return false;
    return true;
  });
}

// ------------------------------------------------------------ classifyLimiter
function classifyLimiter(limiter, rows) {
  const usable = rowsForLimiter(limiter, rows);
  const ofLabel = function (label) { return usable.filter(function (r) { return r.label === label; }); };
  const derivation = ofLabel('derivation');
  const retest = ofLabel('retest');
  const ceiling = ofLabel('scurve_ceiling');
  const headroom = ofLabel('scurve_headroom');

  let s_curve = 'unknown';
  let advice = 'unknown';
  if (ceiling.length > 0 && headroom.length > 0) s_curve = 'contested';
  else if (ceiling.length > 0) { s_curve = 'near_ceiling'; advice = 'route_around'; }
  else if (headroom.length > 0) { s_curve = 'headroom'; advice = 'push'; }

  let column = 'assumed';
  let reason = 'unclear_filed_as_assumed';
  let basis = [];
  if (retest.length > 0) {
    reason = 're_tested';
    basis = retest.map(function (r) { return r.row_id; });
  } else if (derivation.length > 0) {
    column = 'physics';
    reason = 'validated_derivation';
    basis = derivation.map(function (r) { return r.row_id; });
  }
  return { column: column, s_curve: s_curve, advice: advice, basis_row_ids: basis, reason: reason };
}

// ------------------------------------------------------------- rankByUnlock
function fieldStepCount(chain) {
  if (!isObj(chain)) return 0;
  return arr(chain.steps).filter(function (s) {
    if (!isObj(s) || s.pushed_by === 'self') return false;
    // diffusion-lens adoption steps count as field steps (D-19)
    return s.pushed_by === 'field' || s.kind === 'adoption';
  }).length;
}

function rankByUnlock(perspective, opts) {
  const support = (opts && isObj(opts.supportByLimiter)) ? opts.supportByLimiter : {};
  const p = isObj(perspective) ? perspective : {};
  const lengths = {};
  arr(p.unlock_chains).forEach(function (c) {
    if (!isObj(c) || !nonEmpty(c.limiter_id)) return;
    lengths[c.limiter_id] = (lengths[c.limiter_id] || 0) + fieldStepCount(c);
  });
  const list = arr(p.limiters).filter(isObj).map(function (l) {
    const sup = typeof support[l.id] === 'number' ? support[l.id] : 0;
    return { limiter_id: l.id, length: lengths[l.id] || 0, support: sup, contradicted: l.baseline === 'contradicted' };
  });
  // 369.2-24 (HARNESS-10): a limiter the field scan contradicted sorts after every limiter that is not
  // contradicted, whatever the chain length; the other keys keep their order inside each group
  list.sort(function (a, b) {
    if (a.contradicted !== b.contradicted) return a.contradicted ? 1 : -1;
    if (b.length !== a.length) return b.length - a.length;
    if (a.support !== b.support) return a.support - b.support;
    return a.limiter_id < b.limiter_id ? -1 : (a.limiter_id > b.limiter_id ? 1 : 0);
  });
  list.forEach(function (r, i) { r.rank = i + 1; delete r.contradicted; });
  return list;
}

function nextBindingConstraint(perspective) {
  const p = isObj(perspective) ? perspective : {};
  const stored = planMod.rankingIds(p);
  const ranking = stored.length > 0 ? stored : planMod.rankingIds({ ranking: rankByUnlock(p, {}) });
  const limiters = arr(p.limiters);
  for (let i = 0; i < ranking.length; i++) {
    const id = ranking[i];
    const l = limiters.find(function (x) { return isObj(x) && x.id === id; });
    // 369.2-24: a limiter the field scan contradicted is never the next wall
    if (l && l.column === 'assumed' && l.resolved !== true && l.baseline !== 'contradicted') return l;
  }
  return null;
}

// ------------------------------------------------------------------ ratchet
function loadSettled(roomDir) {
  const out = [];
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) return out;
    const base = path.join(roomDir, 'research');
    let names = [];
    try { names = fs.readdirSync(base).sort(); } catch (_e) { return out; }
    const seen = new Set();
    names.forEach(function (name) {
      try {
        const file = path.join(base, name, 'plan.json');
        if (!fs.existsSync(file)) return;
        const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
        const settled = plan && plan.perspective && plan.perspective.ratchet && plan.perspective.ratchet.settled;
        arr(settled).forEach(function (s) {
          if (!isObj(s) || !nonEmpty(s.limiter_key)) return;
          const key = s.limiter_key + '|' + (s.run_ref || name);
          if (seen.has(key)) return;
          seen.add(key);
          out.push({
            limiter_key: s.limiter_key,
            column: s.column === 'physics' ? 'physics' : 'assumed',
            evidence: arr(s.evidence).filter(nonEmpty),
            run_ref: nonEmpty(s.run_ref) ? s.run_ref : name,
          });
        });
      } catch (_e) { /* malformed run home: skip, never throw (T-363-30) */ }
    });
  } catch (_e) { return []; }
  return out;
}

function nextVersion(plan, runResult) {
  const p = isObj(plan) && isObj(plan.perspective) ? plan.perspective : {};
  const ratchet = isObj(p.ratchet) ? p.ratchet : {};
  const version = (typeof ratchet.version === 'number' ? ratchet.version : (typeof p.version === 'number' ? p.version : 1)) + 1;
  let parent = null;
  if (isObj(plan)) {
    if (nonEmpty(plan.plan_hash)) parent = plan.plan_hash;
    else { try { parent = planMod.planHash(plan); } catch (_e) { parent = null; } }
  }
  const discarded = clone(arr(ratchet.discarded));
  const settled = clone(arr(ratchet.settled));
  const rr = isObj(runResult) ? runResult : {};
  arr(rr.discarded).forEach(function (d) { if (isObj(d)) discarded.push(Object.assign({ version: version - 1 }, clone(d))); });
  const byId = {};
  arr(p.limiters).forEach(function (l) { if (isObj(l) && l.id) byId[l.id] = l; });
  arr(rr.classifications).forEach(function (c) {
    if (!isObj(c)) return;
    const lim = byId[c.limiter_id];
    const stmt = lim ? lim.statement : c.statement;
    if (!nonEmpty(stmt)) return;
    const evidence = arr(c.evidence_row_ids).length > 0 ? arr(c.evidence_row_ids) : arr(c.basis_row_ids);
    // a limiter with no evidence row stays an open question; only evidence-backed ones settle
    if (evidence.length === 0) return;
    const key = limiterKey(stmt);
    const entry = {
      limiter_key: key,
      column: c.column === 'physics' ? 'physics' : 'assumed',
      evidence: evidence.filter(nonEmpty),
      run_ref: nonEmpty(rr.run_id) ? rr.run_id : null,
    };
    const at = settled.findIndex(function (s) { return s && s.limiter_key === key; });
    if (at >= 0) settled[at] = entry; else settled.push(entry);
  });
  return { version: version, parent_plan_hash: parent, discarded: discarded, settled: settled };
}

// ------------------------------------------------------------ srStepGuide
function srStepGuide(ledgerLike) {
  let steps = null;
  try {
    const L = isObj(ledgerLike) ? ledgerLike : null;
    if (L) {
      const fw = (isObj(L.frameworks) && L.frameworks['Scientific Roadmapping']) || L['Scientific Roadmapping'] || null;
      const s = (fw && Array.isArray(fw.steps)) ? fw.steps : (Array.isArray(L.steps) ? L.steps : null);
      if (s && s.length > 0) steps = s;
    }
  } catch (_e) { steps = null; }
  if (!steps) {
    return {
      source: 'local_template',
      steps: LOCAL_STEP_TEMPLATE.map(function (t, i) { return { order: i + 1, name: t.name, key_question: t.key_question, gates: t.gates.slice() }; }),
    };
  }
  const byName = {};
  steps.forEach(function (s) { if (isObj(s) && nonEmpty(s.name)) byName[s.name] = s; });
  return {
    source: 'ledger',
    steps: SR_OPERATIONS.map(function (name, i) {
      const l = byName[name];
      const t = LOCAL_STEP_TEMPLATE[i];
      return {
        order: i + 1,
        name: name,
        key_question: (l && nonEmpty(l.key_question)) ? l.key_question : t.key_question,
        gates: (l && Array.isArray(l.gates)) ? l.gates.slice() : t.gates.slice(),
      };
    }),
  };
}

function describeEngine() {
  return {
    template_id: 'scientific-roadmapping',
    engines: ENGINES.slice(),
    operations: SR_OPERATIONS.slice(),
    forum_roles: FORUM_ROLES.slice(),
    roadmap_types: clone(ROADMAP_TYPES),
    api_version: API_VERSION,
  };
}

// --------------------------------------------------------- buildPerspective
function buildPerspective(qs, options) {
  const errors = [];
  const warnings = [];
  const q = isObj(qs) ? qs : {};
  const o = isObj(options) ? options : {};

  const scientific = o.scientific === true || o.template === 'scientific-roadmapping';
  const engine = scientific ? 'scientific-roadmapping' : 'constraint-layer';
  const mode = o.mode === 'quick' || o.mode === 'deep' ? o.mode : null;
  let depth = o.depth === 'lite' ? 'lite' : 'full';
  if (depth === 'lite' && mode !== 'quick') {
    errors.push('depth_lite_requires_quick');
    depth = 'full';
  }
  const full = depth === 'full';

  // ---- 1 Tension Qualification
  const t = isObj(q.tension) ? q.tension : {};
  if (!nonEmpty(t.statement)) errors.push('tension_statement_missing');
  const rawLimiters = arr(q.limiters).filter(isObj);
  const tension = {
    statement: nonEmpty(t.statement) ? t.statement : '',
    agreed_value: nonEmpty(t.agreed_value) ? t.agreed_value : '',
    disputed_feasibility: nonEmpty(t.disputed_feasibility) ? t.disputed_feasibility : '',
    status: 'ok',
  };
  if (rawLimiters.length === 0) {
    tension.status = 'wish';
    errors.push('no_nameable_limiter');
  }

  // ---- 2 Goal Quantification
  const g = isObj(q.goal) ? q.goal : {};
  const goal = {
    target: nonEmpty(g.target) ? g.target : '',
    unit: nonEmpty(g.unit) ? g.unit : '',
    threshold: nonEmpty(String(g.threshold == null ? '' : g.threshold)) ? String(g.threshold) : '',
    falsifier: nonEmpty(g.falsifier) ? g.falsifier : '',
    quantified: false,
  };
  goal.quantified = nonEmpty(goal.target) && nonEmpty(goal.unit) && nonEmpty(goal.threshold);
  if (!nonEmpty(goal.falsifier)) errors.push('goal_falsifier_missing');
  if (full && !goal.quantified) {
    if (scientific) errors.push('goal_not_quantified');
    else warnings.push('goal_not_quantified: a target, unit and threshold make the goal rankable');
  }

  // ---- 3 Rung Placement and Type Selection
  const rp = isObj(q.rung_phrase) ? q.rung_phrase : {};
  const rung = nonEmpty(o.rung) ? o.rung : null;
  const roadmapType = nonEmpty(rp.roadmap_type) ? rp.roadmap_type : '';
  const rung_phrase = {
    roadmap_type: roadmapType,
    idea_kind: nonEmpty(rp.idea_kind) ? rp.idea_kind : (rung && IDEA_KIND[rung] ? IDEA_KIND[rung] : ''),
  };
  if (!rung || !ROADMAP_TYPES[rung]) {
    warnings.push('rung_unplaced: place the rung before choosing a roadmap type');
  } else if (roadmapType) {
    const known = [].concat.apply([], Object.keys(ROADMAP_TYPES).map(function (r) { return ROADMAP_TYPES[r].slice(); }));
    const canonType = known.filter(function (k) { return k.toLowerCase() === roadmapType.toLowerCase(); })[0] || roadmapType;
    rung_phrase.roadmap_type = canonType;
    if (ROADMAP_TYPES[rung].indexOf(canonType) === -1) {
      const typeRung = Object.keys(ROADMAP_TYPES).filter(function (r) { return r !== 'Wicked' && ROADMAP_TYPES[r].indexOf(canonType) !== -1; })[0];
      if (typeRung && RUNG_ORDER[typeRung] > (RUNG_ORDER[rung] || 0)) {
        warnings.push('climb_rung_honestly: ' + canonType + ' belongs to a more defined rung than ' + rung);
      } else {
        warnings.push('roadmap_type_unfit: ' + canonType + ' is not a listed type for ' + rung);
      }
    }
  } else if (full) {
    warnings.push('roadmap_type_missing');
  }

  // ---- 4 Forum Construction
  const forum = [];
  const tensions = [];
  if (full) {
    const rawForum = arr(q.forum).filter(isObj);
    FORUM_ROLES.forEach(function (role) {
      if (!rawForum.some(function (f) { return f.role === role; })) errors.push('forum_role_missing:' + role);
    });
    const seenOrder = {};
    rawForum.forEach(function (f) {
      if (FORUM_ROLES.indexOf(f.role) === -1) { errors.push('forum_role_invalid:' + f.role); return; }
      const po = f.pass_order;
      if (!Number.isInteger(po) || po < 1 || po > 3) errors.push('forum_pass_order_invalid:' + f.role);
      else if (seenOrder[po]) errors.push('forum_pass_order_duplicate:' + po);
      else seenOrder[po] = true;
      const contributed = arr(f.contributed).filter(nonEmpty);
      const none = nonEmpty(f.none_reason) ? f.none_reason : null;
      if (contributed.length === 0 && !none) errors.push('forum_role_silent:' + f.role);
      forum.push({ role: f.role, pass_order: po, contributed: contributed, none_reason: none });
      arr(f.contradicts).filter(isObj).forEach(function (c) {
        if (nonEmpty(c.text) && FORUM_ROLES.indexOf(c.role) !== -1) tensions.push({ roles: [f.role, c.role], text: c.text });
      });
    });
    forum.sort(function (a, b) { return (a.pass_order || 9) - (b.pass_order || 9); });
  } else {
    arr(q.forum).filter(isObj).forEach(function (f) {
      if (FORUM_ROLES.indexOf(f.role) === -1) return;
      forum.push({ role: f.role, pass_order: Number.isInteger(f.pass_order) ? f.pass_order : 0, contributed: arr(f.contributed).filter(nonEmpty), none_reason: nonEmpty(f.none_reason) ? f.none_reason : null });
    });
  }

  // ---- 5 Path Enumeration
  const paths = arr(q.paths).filter(isObj).map(function (p, i) {
    return { id: nonEmpty(p.id) ? p.id : 'P' + (i + 1), label: nonEmpty(p.label) ? p.label : '', from_10x: p.from_10x === true, raised_by: nonEmpty(p.raised_by) ? p.raised_by : null };
  });
  if (full) {
    if (paths.length < 2) errors.push('paths_too_few');
    if (scientific && !paths.some(function (p) { return p.from_10x; })) errors.push('no_10x_resurvey');
    if (paths.length >= 2) {
      IssueTreeEngine.validateMECE(paths.map(function (p) { return { label: p.label }; }), 'paths').forEach(function (w) {
        warnings.push('paths_mece: ' + w);
      });
    }
  }

  // ---- ratchet base and settled memory
  const settled = arr(o.settled).filter(isObj);
  const base = isObj(o.ratchet) ? o.ratchet : {};
  const ratchet = {
    version: typeof base.version === 'number' ? base.version : 1,
    parent_plan_hash: nonEmpty(base.parent_plan_hash) ? base.parent_plan_hash : null,
    discarded: clone(arr(base.discarded)),
    settled: clone(arr(base.settled).length > 0 ? arr(base.settled) : settled),
  };

  // ---- 6 Constraint Interrogation
  const limiters = rawLimiters.map(function (l, i) {
    const id = nonEmpty(l.id) ? l.id : 'L' + (i + 1);
    // tolerant aliases: 363-06 question sets carry label / derivation.claim
    l = Object.assign({}, l);
    if (!nonEmpty(l.statement)) l.statement = nonEmpty(l.label) ? l.label : (nonEmpty(l.text) ? l.text : '');
    if (!nonEmpty(l.derivation_claim) && isObj(l.derivation) && nonEmpty(l.derivation.claim)) l.derivation_claim = l.derivation.claim;
    let column = l.column === 'physics' ? 'physics' : 'assumed';
    if (l.column !== 'physics' && l.column !== 'assumed') warnings.push('limiter_unclear_filed_as_assumed:' + id);
    const hasRef = nonEmpty(l.derivation_row_id) || nonEmpty(l.derivation_claim);
    if (column === 'physics' && !hasRef) {
      column = 'assumed';
      warnings.push('physics_without_derivation_filed_as_assumed:' + id);
    }
    if (column === 'assumed' && !nonEmpty(l.question)) errors.push('assumed_limiter_question_missing:' + id);
    if (!nonEmpty(l.statement)) errors.push('limiter_statement_missing:' + id);
    const out = {
      id: id,
      path_id: nonEmpty(l.path_id) ? l.path_id : null,
      leaf_id: nonEmpty(l.leaf_id) ? l.leaf_id : null,
      statement: nonEmpty(l.statement) ? l.statement : '',
      column: column,
      derivation_row_id: nonEmpty(l.derivation_row_id) ? l.derivation_row_id : null,
      s_curve: ['near_ceiling', 'headroom', 'unknown', 'contested'].indexOf(l.s_curve) !== -1 ? l.s_curve : 'unknown',
      question: nonEmpty(l.question) ? l.question : null,
      raised_by: nonEmpty(l.raised_by) ? l.raised_by : null,
      settled_ref: null,
    };
    if (nonEmpty(l.derivation_claim)) out.derivation_claim = l.derivation_claim;
    if (l.resolved === true) out.resolved = true;
    // the ratchet: no reopening a settled constraint without new evidence
    const key = limiterKey(out.statement);
    const hits = settled.filter(function (s) { return s.limiter_key === key; });
    if (hits.length > 0) {
      out.settled_ref = nonEmpty(hits[0].run_ref) ? hits[0].run_ref : null;
      const known = new Set();
      hits.forEach(function (h) { arr(h.evidence).forEach(function (e) { known.add(e); }); });
      const fresh = arr(l.new_evidence).filter(nonEmpty).filter(function (e) { return !known.has(e); });
      if (fresh.length === 0) errors.push('reopen_settled_without_new_evidence:' + id);
      else warnings.push('reopened_with_new_evidence:' + id);
    }
    return out;
  });
  if (limiters.length === 0 && depth === 'lite') { /* already reported as no_nameable_limiter */ }

  // ---- 7 Catalytic Ranking
  const limiterIds = new Set(limiters.map(function (l) { return l.id; }));
  const unlock_chains = arr(q.unlock_chains).filter(isObj).filter(function (c) { return limiterIds.has(c.limiter_id); }).map(function (c) {
    const steps = arr(c.steps).filter(isObj).map(function (s) {
      return {
        text: nonEmpty(s.text) ? s.text : '',
        pushed_by: s.pushed_by === 'self' ? 'self' : 'field',
        kind: s.kind === 'adoption' ? 'adoption' : 'field',
      };
    });
    const chain = { limiter_id: c.limiter_id, steps: steps, length: 0 };
    chain.length = fieldStepCount(chain);
    return chain;
  });

  const perspective = {
    engine: engine,
    depth: depth,
    version: ratchet.version,
    tension: tension,
    goal: goal,
    rung_phrase: rung_phrase,
    forum: forum,
    paths: paths,
    limiters: limiters,
    unlock_chains: unlock_chains,
    ranking: [],
    tensions: tensions,
    ratchet: ratchet,
    next_binding_constraint: null,
  };
  perspective.ranking = rankByUnlock(perspective, { supportByLimiter: isObj(o.supportByLimiter) ? o.supportByLimiter : {} });
  const nb = nextBindingConstraint(perspective);
  perspective.next_binding_constraint = nb ? nb.id : null;

  if (depth === 'lite' && limiters.length < 1 && errors.indexOf('no_nameable_limiter') === -1) errors.push('no_nameable_limiter');
  return { ok: errors.length === 0, perspective: perspective, errors: errors, warnings: warnings };
}

module.exports = {
  ENGINES: ENGINES,
  SR_OPERATIONS: SR_OPERATIONS,
  FORUM_ROLES: FORUM_ROLES,
  ROADMAP_TYPES: ROADMAP_TYPES,
  buildPerspective: buildPerspective,
  limiterKey: limiterKey,
  classifyLimiter: classifyLimiter,
  rankByUnlock: rankByUnlock,
  nextBindingConstraint: nextBindingConstraint,
  nextVersion: nextVersion,
  loadSettled: loadSettled,
  srStepGuide: srStepGuide,
  describeEngine: describeEngine,
};
