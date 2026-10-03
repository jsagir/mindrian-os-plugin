'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/research-planner/question-templates.cjs (Phase 363 Plan 06)
 *
 * What each framework asks. A command such as /mos:map-unknowns does not
 * fetch anything: it contributes the questions worth asking (its closed
 * dimension set), a lens per dimension, and a falsifier template per lens
 * (D-02, D-02c). This module is that contribution as data, plus the shape
 * check for the question set Larry writes (mos.research-question-set/1).
 *
 * Plain English: a template is a checklist of the questions a framework says
 * you must ask. The pyramid checker later compares the questions Larry wrote
 * against this checklist; every item left unasked is a question the navigator
 * did not know to ask (D-00).
 *
 * Pure and local. No network, no room read, no Brain call. Question sets,
 * SCQA, leaves and perspective prose never leave the machine (Canon Part 8).
 * Dimension ids are stable API for the command doors and for SEED-098.
 *
 * Every researchable dimension names a default_lens, a default_family and a
 * falsifier_template. The family ids are the frozen composer families of
 * 363-08 (whitespace-gap/v1, concept-evidence/v1, causal-link/v1,
 * constraint-interrogation/v1, diffusion/v1). The falsifier template is a
 * template id of the composer; the diffusion/v1 family declares no falsifier
 * role of its own, so the df dimensions borrow concept-evidence's ce.counter
 * (a disclosed default, tuned in 363-20). A local dimension (a room check) or
 * a closed dimension carries family null and falsifier template null.
 *
 * Hyphens only: no em-dash or en-dash in any file of this plan.
 */

const { LEAF_ORIGINS } = require('./plan.cjs');

const SCHEMA = 'mos.research-question-set/1';
const FAMILY_IDS = Object.freeze(['whitespace-gap/v1', 'concept-evidence/v1', 'causal-link/v1', 'constraint-interrogation/v1', 'diffusion/v1']);
const PERSPECTIVE_STEPS = Object.freeze(['tension', 'goal', 'rung', 'forum', 'paths', 'limiters', 'ranking']);
const MODE_HINTS = Object.freeze(['quick', 'deep']);

const CE = 'concept-evidence/v1';
const WS = 'whitespace-gap/v1';
const CL = 'causal-link/v1';
const CI = 'constraint-interrogation/v1';
const DF = 'diffusion/v1';

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
  }
  return o;
}

// dim(id, label, prompt, spec)
//   spec.lens, spec.family, spec.falsifier (template id or null),
//   spec.falsifier_default (prose), spec.step, spec.reason (not researchable),
//   spec.required_when (conditional dimension)
//   spec.corpus (366-15, optional: 'theo' marks a dimension answered by the Theo
//   lateral-path lane; absent by default so every existing record is unchanged)
function dim(id, label, prompt, spec) {
  const researchable = spec.reason === undefined;
  const d = {
    id: id,
    label: label,
    prompt: prompt,
    researchable: researchable,
    default_lens: spec.lens,
    default_family: spec.family === undefined ? null : spec.family,
    falsifier_template: spec.falsifier === undefined ? null : spec.falsifier,
    perspective_step: spec.step,
  };
  if (researchable) d.falsifier_default = spec.falsifier_default;
  else d.not_researchable_reason = spec.reason;
  if (spec.required_when) d.required_when = spec.required_when;
  if (spec.local) d.local = true;
  if (spec.corpus) d.corpus = spec.corpus;
  return d;
}

const SIX_M = [
  ['rc:6m_man', 'Man', 'people and skills'],
  ['rc:6m_machine', 'Machine', 'equipment and tooling'],
  ['rc:6m_method', 'Method', 'process and procedure'],
  ['rc:6m_material', 'Material', 'inputs and parts'],
  ['rc:6m_measurement', 'Measurement', 'how the thing is measured'],
  ['rc:6m_nature', 'Nature', 'environment and conditions'],
];

const MAP_UNKNOWNS = {
  id: 'map-unknowns',
  framework: 'Knowns and Unknowns Matrix Framework',
  doors: ['/mos:map-unknowns'],
  lenses: ['mu.verify', 'mu.blind_spot', 'mu.reveal'],
  perspective_map: 'Blind spots and known unknowns feed assumed limiters; known knowns feed physics candidates to verify.',
  opportunity_rules: [],
  dimensions: [
    dim('mu:known_known', 'Known knowns', 'Which of your firm facts have you actually checked?', {
      lens: 'mu.verify', family: CE, falsifier: 'ce.counter', step: 'limiters',
      falsifier_default: 'Evidence that contradicts the stated fact.',
    }),
    dim('mu:blind_spot', 'Blind spots', 'What does someone outside your view already know about this?', {
      lens: 'mu.blind_spot', family: CE, falsifier: 'ce.counter', step: 'limiters',
      falsifier_default: 'Evidence that outside parties see nothing you have missed.',
    }),
    dim('mu:hidden_known', 'Hidden knowns', 'What do you know but have not said out loud?', {
      lens: 'mu.reveal', step: 'forum', reason: 'tacit knowledge the team must surface',
    }),
    dim('mu:unknown_unknown', 'Unknown unknowns', 'What adjacent evidence would reveal something nobody has named?', {
      lens: 'mu.reveal', step: 'paths', reason: 'unknowable by definition',
    }),
  ],
};

const ROOT_CAUSE = {
  id: 'root-cause',
  framework: 'Root Cause Analysis',
  doors: ['/mos:root-cause'],
  lenses: ['rc.why_link', 'rc.6m'],
  perspective_map: 'Each why answered by an assumption becomes an assumed limiter to re-test.',
  opportunity_rules: [],
  dimensions: [
    dim('rc:why_link', 'Causal links', 'Does each why rest on evidence, or on an assumption?', {
      lens: 'rc.why_link', family: CL, falsifier: 'cl.break', step: 'limiters',
      falsifier_default: 'The link breaks, or a confound explains it.',
    }),
  ].concat(SIX_M.map(function (m) {
    return dim(m[0], m[1] + ' factors', 'Could a ' + m[1].toLowerCase() + ' factor (' + m[2] + ') also cause this?', {
      lens: 'rc.6m', family: CL, falsifier: 'cl.break', step: 'limiters', required_when: 'multi_cause',
      falsifier_default: 'The link breaks, or a confound explains it.',
    });
  })),
};

const THINK_HATS = {
  id: 'think-hats',
  framework: 'Six Thinking Hats',
  doors: ['/mos:think-hats'],
  lenses: ['hat.white', 'hat.black', 'hat.yellow', 'hat.green'],
  perspective_map: 'The green hat feeds the perspective paths; the black hat feeds the falsifiers.',
  opportunity_rules: [],
  dimensions: [
    dim('hat:white', 'White hat facts', 'What facts are missing?', {
      lens: 'hat.white', family: CE, falsifier: 'ce.counter', step: 'tension',
      falsifier_default: 'Evidence that the facts on record already settle the question.',
    }),
    dim('hat:black', 'Black hat counterevidence', 'What evidence says this fails?', {
      lens: 'hat.black', family: CE, falsifier: 'ce.prior_success', step: 'limiters',
      falsifier_default: 'Evidence that the feared failure does not occur.',
    }),
    dim('hat:yellow', 'Yellow hat prior successes', 'Where has this worked before?', {
      lens: 'hat.yellow', family: CE, falsifier: 'ce.counter', step: 'goal',
      falsifier_default: 'Evidence that earlier successes did not last or do not transfer.',
    }),
    dim('hat:green', 'Green hat alternatives', 'What alternatives exist?', {
      lens: 'hat.green', family: CE, falsifier: 'ce.counter', step: 'paths',
      falsifier_default: 'Evidence that the alternative fails where it was tried.',
    }),
    dim('hat:red', 'Red hat feelings', 'How does it feel to the people involved?', {
      lens: 'hat.white', step: 'forum', reason: 'feelings, not literature',
    }),
    dim('hat:blue', 'Blue hat process', 'Is this the right question?', {
      lens: 'hat.white', step: 'rung', reason: 'process hat frames the pyramid top',
    }),
  ],
};

const WHITESPACE = {
  id: 'whitespace',
  // The exact `frameworks:` value of commands/whitespace.md, used verbatim.
  framework: 'HSI Semantic Surprise Analysis Assistant',
  doors: ['/mos:whitespace'],
  lenses: ['ws.gap', 'ws.covered_elsewhere', 'ws.extraction'],
  perspective_map: 'A confirmed gap becomes a literature-gap opportunity candidate.',
  opportunity_rules: [
    { kind: 'literature_gap', dimension: 'ws:gap_claim', when: 'verdict gap-confirmed' },
  ],
  dimensions: [
    dim('ws:gap_claim', 'Gap claim', 'Is the zone empty in the literature, or only in your room?', {
      lens: 'ws.gap', family: WS, falsifier: 'ws.synonym_cover', step: 'tension',
      falsifier_default: 'Any peer-reviewed work that addresses the zone directly.',
    }),
    dim('ws:covered_elsewhere', 'Covered under another term', 'Is the same problem studied under a different name?', {
      lens: 'ws.covered_elsewhere', family: WS, falsifier: 'ws.prior_attempts', step: 'paths',
      falsifier_default: 'Work under another term that answers the same question.',
    }),
    dim('ws:irrelevant', 'Irrelevant zone', 'Is this zone worth filling at all?', {
      lens: 'ws.gap', step: 'goal', reason: 'navigator judgment',
    }),
    dim('ws:extraction_failure', 'Extraction failure', 'Does the room already hold this under other words?', {
      lens: 'ws.extraction', step: 'tension', local: true,
      falsifier_default: 'A room artifact that already covers the zone.',
    }),
  ],
};

const DIFFUSION = {
  id: 'diffusion',
  framework: 'Adoption-Capacity Theory',
  doors: ['/mos:diffusion'],
  lenses: ['df.first_adopters', 'df.absorptive_capacity', 'df.civil_defense_crossing', 'df.timing'],
  perspective_map: 'The timing rows feed the Scientific Roadmapping S-curve reading (step 6).',
  opportunity_rules: [
    { kind: 'trend_break', dimension: 'df:timing', when: 'near ceiling on the incumbent and headroom on the challenger' },
  ],
  dimensions: [
    dim('df:first_adopters', 'First adopters', 'Who adopts first?', {
      lens: 'df.first_adopters', family: DF, falsifier: 'ce.counter', step: 'goal',
      falsifier_default: 'Evidence that adoption stayed with the first buyers.',
    }),
    dim('df:absorptive_capacity', 'Absorptive capacity', 'Who can absorb it, and what does that take?', {
      lens: 'df.absorptive_capacity', family: DF, falsifier: 'ce.counter', step: 'limiters',
      falsifier_default: 'Cases where adopters absorbed it without the stated capacity.',
    }),
    dim('df:civil_defense_crossing', 'Civil and defense crossing', 'Does it cross between civil and defense buyers, and how?', {
      lens: 'df.civil_defense_crossing', family: DF, falsifier: 'ce.counter', step: 'paths',
      falsifier_default: 'Cases where the crossing was blocked or never attempted.',
    }),
    dim('df:timing', 'Timing', 'Where is each technology on its adoption curve?', {
      lens: 'df.timing', family: DF, falsifier: 'ce.counter', step: 'limiters',
      falsifier_default: 'Rate data placing incumbent and challenger at the same stage.',
    }),
  ],
};

const SCIENTIFIC_ROADMAPPING = {
  id: 'scientific-roadmapping',
  framework: 'Scientific Roadmapping',
  // Two doors since Phase 364: the /mos:research runner and the
  // /mos:scientific-roadmap door. Both reach this template through an explicit
  // template_id (or templateForFramework), never through templateForCommand.
  doors: ['/mos:research', '/mos:scientific-roadmap'],
  explicit_only: true,
  lenses: ['mu.verify', 'hat.green', 'hat.black', 'hat.white', 'mu.reveal', 'ci.derivation', 'ci.retest', 'ci.scurve', 'ci.prior_attack'],
  perspective_map: 'Each dimension lands in one step of the D-18 perspective: tension, goal, rung, forum, paths, limiters, ranking.',
  opportunity_rules: [
    { kind: 'constraint_attack', dimension: 'sr:limiters', when: 'assumed limiter with an unlock chain of length at least 1' },
  ],
  dimensions: [
    dim('sr:tension', 'Tension', 'Is the tension real, and who says so?', {
      lens: 'mu.verify', family: CE, falsifier: 'ce.counter', step: 'tension',
      falsifier_default: 'Evidence that the tension does not exist at the stated scale.',
    }),
    dim('sr:goal', 'Goal', 'What is the goal as a number, and what would falsify it?', {
      lens: 'mu.verify', family: CE, falsifier: 'ce.counter', step: 'goal',
      falsifier_default: 'Evidence that the goal is already met or cannot be measured as stated.',
    }),
    dim('sr:rung', 'Rung and roadmap type', 'Which kind of roadmap does the question call for?', {
      lens: 'mu.reveal', step: 'rung', reason: 'placement is a local judgment from the room, not a literature question',
    }),
    dim('sr:forum_insider', 'Forum: frustrated insider', 'What does the frustrated insider say is stuck?', {
      lens: 'hat.black', step: 'forum', reason: 'a voice pass run by Larry that feeds paths and limiters',
    }),
    dim('sr:forum_entrant', 'Forum: fresh entrant', 'What does a fresh entrant see that insiders stopped seeing?', {
      lens: 'hat.green', step: 'forum', reason: 'a voice pass run by Larry that feeds paths and limiters',
    }),
    dim('sr:forum_grounder', 'Forum: physics grounder', 'What does physics say is possible?', {
      lens: 'hat.white', step: 'forum', reason: 'a voice pass run by Larry that feeds paths and limiters',
    }),
    dim('sr:paths', 'Paths', 'Which routes to the goal exist?', {
      lens: 'hat.green', family: CE, falsifier: 'ce.counter', step: 'paths',
      falsifier_default: 'Evidence that the route fails where it was tried.',
    }),
    dim('sr:paths_10x', 'Paths from a 10X resurvey', 'Which routes appear only when you look ten times wider?', {
      lens: 'hat.green', family: CE, falsifier: 'ce.counter', step: 'paths',
      falsifier_default: 'Evidence that the borrowed mechanism fails at this scale.',
    }),
    dim('sr:limiters', 'Limiters', 'Which limits are physics and which are only assumed?', {
      lens: 'ci.derivation', family: CI, falsifier: 'ci.retest', step: 'limiters',
      falsifier_default: 'A re-test that reproduces the limit, or a derivation that shows it is not a bound.',
    }),
    dim('sr:ranking', 'Catalytic ranking', 'Which limiter unlocks the most downstream?', {
      lens: 'ci.derivation', step: 'ranking', reason: 'ranking is computed locally from the unlock chains', local: true,
    }),
  ],
};

// SEED-103 (2026-10-01): the Eureka PERSPECTIVE. Eureka the standalone engine
// retires; what it contributes to the planner is a question: does a recalled
// cross-domain pair share a mechanism, or only words, and does the room
// already know it. Candidates come from lib/core/research-planner/perspectives/
// eureka-recall.cjs (local graph + ICM structure, no embeddings).
const EUREKA = {
  id: 'eureka',
  framework: 'Cross-Domain Opportunity Discovery',
  doors: ['/mos:eureka'],
  lenses: ['eu.transfer', 'eu.known'],
  perspective_map: 'A pair whose mechanism transfer is documented outside the room becomes a cross-domain opportunity candidate.',
  opportunity_rules: [
    { kind: 'cross_domain_transfer', dimension: 'eu:mechanism_transfer', when: 'verdict supported and not already known' },
  ],
  dimensions: [
    dim('eu:mechanism_transfer', 'Mechanism transfer', 'Does the mechanism behind one thing transfer to the other, beyond shared vocabulary?', {
      lens: 'eu.transfer', family: CE, falsifier: 'ce.counter', step: 'paths',
      falsifier_default: 'Published work where the two mechanisms are combined and the transfer fails, or where the pairing is already standard practice.',
    }),
    dim('eu:already_known', 'Already known', 'Does the room already connect these two under other words?', {
      lens: 'eu.known', step: 'tension', local: true,
      falsifier_default: 'A room artifact that already states the connection.',
    }),
    dim('eu:worth_exploring', 'Worth exploring', 'Is this pair worth the navigator\'s time now?', {
      lens: 'eu.transfer', step: 'goal', reason: 'navigator judgment',
    }),
  ],
};

// Phase 366 (D-06): every perspective has the same shape, a recall stage, a
// question template with a falsifier and lenses; judge, plan, research, prose
// and filing are shared. The four templates below land before their recall
// modules (366-13, 366-14, 366-15), so those modules only add recall. Each
// framework is an exact canon name (D-10). Whitespace keeps its shipped
// template above. Every opportunity rule is consumed by the one generic pair
// branch of pyramid.cjs (366-02); no per-perspective pyramid code exists.

// Reverse Salient: which section of the system lags and holds the rest back.
// Leaves carry {cause, effect} slots through causal-link/v1.
const RS = {
  id: 'rs',
  framework: 'Reverse Salient Analysis',
  doors: ['/mos:find-bottlenecks'],
  lenses: ['rs.lag', 'rs.known'],
  perspective_map: 'A lagging section confirmed outside the room becomes a constraint-attack opportunity candidate.',
  opportunity_rules: [
    { kind: 'constraint_attack', dimension: 'rs:lagging_component', when: 'verdict supported and not already known' },
  ],
  dimensions: [
    dim('rs:lagging_component', 'Lagging component', 'Is this section the one that holds the rest of the system back?', {
      lens: 'rs.lag', family: CL, falsifier: 'cl.break', step: 'paths',
      falsifier_default: 'Evidence that the named section is not the constraint: downstream progress is blocked elsewhere, or the section is complete under other words.',
    }),
    dim('rs:already_known', 'Already known', 'Does the room already name this section as the constraint?', {
      lens: 'rs.known', step: 'tension', local: true,
      falsifier_default: 'A room artifact that already names this section as the constraint.',
    }),
    dim('rs:worth_exploring', 'Worth exploring', 'Is this constraint worth the navigator\'s time now?', {
      lens: 'rs.lag', step: 'goal', reason: 'navigator judgment',
    }),
  ],
};

// HSI: a semantic surprise, two parts of the room close in structure and far
// in words. Reached only as the /mos:scout hsi subcommand (explicit_only); the
// hsi module sets template_id itself, so /mos:scout is never rerouted.
const HSI = {
  id: 'hsi',
  framework: 'HSI Semantic Surprise Analysis Assistant',
  doors: ['/mos:scout hsi'],
  explicit_only: true,
  lenses: ['hsi.diverge', 'hsi.known'],
  perspective_map: 'A surprising pair whose shared structure is documented outside the room becomes a mechanism-transfer opportunity candidate.',
  opportunity_rules: [
    { kind: 'mechanism_transfer', dimension: 'hsi:divergence', when: 'verdict supported and not already known' },
  ],
  dimensions: [
    dim('hsi:divergence', 'Semantic divergence', 'Do these two share a structure the room has not put into words?', {
      lens: 'hsi.diverge', family: CE, falsifier: 'ce.counter', step: 'paths',
      falsifier_default: 'A source that already states this relationship in the room\'s own words, or shows the shared structure is coincidental.',
    }),
    dim('hsi:already_known', 'Already known', 'Does the room already connect these two under other words?', {
      lens: 'hsi.known', step: 'tension', local: true,
      falsifier_default: 'A room artifact that already states the connection.',
    }),
  ],
};

// Analogies: does a source domain's solution transfer, judged on function,
// behavior and structure per side (SAPPhIRE, references/methodology/
// sapphire-encoding.md).
const ANALOGIES = {
  id: 'analogies',
  framework: 'Four Lenses of Innovation',
  doors: ['/mos:find-analogies'],
  lenses: ['an.structure', 'an.known'],
  // D-09: the statement stage fills these per side from the room text on the
  // host; recall never fills them and they are never query slots.
  statement_slots: ['function', 'behavior', 'structure'],
  perspective_map: 'An analogy whose structural transfer is documented outside the room becomes a mechanism-transfer opportunity candidate.',
  opportunity_rules: [
    { kind: 'mechanism_transfer', dimension: 'an:structural_transfer', when: 'verdict supported and not already known' },
  ],
  dimensions: [
    dim('an:structural_transfer', 'Structural transfer', 'Does the source domain\'s function and behavior transfer, given the structures on each side?', {
      lens: 'an.structure', family: CE, falsifier: 'ce.counter', step: 'paths',
      falsifier_default: 'A documented case where the shared function and behavior did not transfer because the structures differ.',
    }),
    dim('an:already_known', 'Already known', 'Does the room already draw this analogy under other words?', {
      lens: 'an.known', step: 'tension', local: true,
      falsifier_default: 'A room artifact that already draws the analogy.',
    }),
  ],
};

// Connections: a lateral path between two canon frameworks that touch the work.
const CONNECTIONS = {
  id: 'connections',
  framework: 'Usher\'s Model of Cumulative Synthesis',
  doors: ['/mos:find-connections'],
  lenses: ['cn.lateral', 'cn.known'],
  perspective_map: 'A lateral path documented outside the room becomes a cross-domain opportunity candidate.',
  opportunity_rules: [
    { kind: 'cross_domain_transfer', dimension: 'cn:lateral_path', when: 'verdict supported and not already known' },
  ],
  dimensions: [
    dim('cn:lateral_path', 'Lateral path', 'Is there a real path between these two frameworks, beyond generic hubs?', {
      lens: 'cn.lateral', family: CE, falsifier: 'ce.counter', step: 'paths', corpus: 'theo',
      falsifier_default: 'No lateral path exists between the two canon frameworks, or the path runs only through generic hubs.',
    }),
    dim('cn:already_known', 'Already known', 'Does the room already connect these two frameworks?', {
      lens: 'cn.known', step: 'tension', local: true,
      falsifier_default: 'A room artifact that already states the connection.',
    }),
  ],
};

const TEMPLATES = deepFreeze({
  'map-unknowns': MAP_UNKNOWNS,
  'root-cause': ROOT_CAUSE,
  'think-hats': THINK_HATS,
  'whitespace': WHITESPACE,
  'diffusion': DIFFUSION,
  'scientific-roadmapping': SCIENTIFIC_ROADMAPPING,
  'eureka': EUREKA,
  'rs': RS,
  'hsi': HSI,
  'analogies': ANALOGIES,
  'connections': CONNECTIONS,
});

const PLANNER_TEMPLATE_IDS = Object.freeze(Object.keys(TEMPLATES));

// A selectable lens is itself a template whose dimensions join the coverage
// set (D-19: the diffusion lens adds the df dimensions).
const LENS_TEMPLATES = Object.freeze({ diffusion: 'diffusion' });

function allDimensions() {
  const out = {};
  PLANNER_TEMPLATE_IDS.forEach(function (id) {
    TEMPLATES[id].dimensions.forEach(function (d) { out[d.id] = d; });
  });
  return out;
}
const DIMENSION_INDEX = allDimensions();

function templateForCommand(command) {
  if (typeof command !== 'string') return null;
  for (let i = 0; i < PLANNER_TEMPLATE_IDS.length; i += 1) {
    const t = TEMPLATES[PLANNER_TEMPLATE_IDS[i]];
    if (t.explicit_only) continue;
    if (t.doors.indexOf(command) !== -1) return t;
  }
  return null;
}

function templateForFramework(framework) {
  if (typeof framework !== 'string') return null;
  for (let i = 0; i < PLANNER_TEMPLATE_IDS.length; i += 1) {
    const t = TEMPLATES[PLANNER_TEMPLATE_IDS[i]];
    if (t.framework === framework) return t;
  }
  return null;
}

// dimensionsFor(template, {multi_cause}) -> the template's dimensions with the
// conditional ones resolved: `required` says the checker must see a leaf or a
// reasoned note; `effective_researchable` and `effective_reason` carry the
// resolved researchability (the 6M dimensions close with a reason when the
// question set does not declare multi_cause).
function dimensionsFor(template, opts) {
  const multi = !!(opts && opts.multi_cause === true);
  return template.dimensions.map(function (d) {
    const conditional = d.required_when === 'multi_cause';
    const open = conditional ? multi : d.researchable;
    return {
      id: d.id,
      label: d.label,
      prompt: d.prompt,
      default_lens: d.default_lens,
      default_family: d.default_family,
      falsifier_template: d.falsifier_template,
      falsifier_default: d.falsifier_default || null,
      perspective_step: d.perspective_step,
      local: d.local === true,
      conditional: conditional,
      effective_researchable: open,
      effective_reason: open ? null : (conditional ? 'single causal chain' : d.not_researchable_reason),
      // A researchable dimension must be covered by a leaf or a reasoned note.
      required: open,
    };
  });
}

// ---------------------------------------------------------------------------
// validateQuestionSet: shape only. Plain validators, named error codes.
// Falsifier presence is a checkPyramid concern (reported with the leaf id).
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }

function validatePerspectiveShape(p, errors) {
  if (!isObj(p)) { errors.push('perspective_invalid'); return; }
  if (!isObj(p.tension)) errors.push('perspective_tension_missing');
  if (!isObj(p.goal)) errors.push('perspective_goal_missing');
  if (!isObj(p.rung_phrase)) errors.push('perspective_rung_phrase_missing');
  ['forum', 'paths', 'limiters', 'unlock_chains', 'tensions'].forEach(function (k) {
    if (!Array.isArray(p[k])) errors.push('perspective_' + k + '_invalid');
  });
}

function validateQuestionSet(qs) {
  const errors = [];
  if (!isObj(qs)) return { ok: false, errors: ['question_set_not_object'] };
  if (qs.schema === undefined) errors.push('schema_missing');
  else if (qs.schema !== SCHEMA) errors.push('schema_invalid');
  const template = TEMPLATES[qs.template_id] || null;
  if (!template) errors.push('template_id_invalid');
  if (!nonEmpty(qs.command)) errors.push('command_missing');
  if (!nonEmpty(qs.stated_question)) errors.push('stated_question_missing');
  if (!isObj(qs.scqa)) errors.push('scqa_missing');
  else {
    ['situation', 'complication', 'question'].forEach(function (k) {
      if (!nonEmpty(qs.scqa[k])) errors.push('scqa_' + k + '_missing');
    });
  }
  if (qs.mode_hint !== null && qs.mode_hint !== undefined && MODE_HINTS.indexOf(qs.mode_hint) === -1) errors.push('mode_hint_invalid');
  if (qs.multi_cause !== undefined && typeof qs.multi_cause !== 'boolean') errors.push('multi_cause_invalid');

  if (qs.perspective !== null && qs.perspective !== undefined) validatePerspectiveShape(qs.perspective, errors);
  else if (template && template.id === 'scientific-roadmapping') errors.push('perspective_missing');

  if (!Array.isArray(qs.key_line) || qs.key_line.length === 0) errors.push('key_line_invalid');
  else {
    const seenK = {};
    qs.key_line.forEach(function (k, i) {
      if (!isObj(k) || !nonEmpty(k.id) || !nonEmpty(k.label)) { errors.push('key_line_entry_invalid:' + i); return; }
      if (seenK[k.id]) errors.push('key_line_id_duplicate:' + k.id);
      seenK[k.id] = true;
      if (!DIMENSION_INDEX[k.dimension]) errors.push('key_line_dimension_unknown:' + k.id);
    });
  }

  if (!Array.isArray(qs.leaves) || qs.leaves.length === 0) errors.push('leaves_missing');
  else {
    const seen = {};
    qs.leaves.forEach(function (l, i) {
      if (!isObj(l)) { errors.push('leaf_invalid:' + i); return; }
      const id = nonEmpty(l.id) ? l.id : '?' + i;
      if (!nonEmpty(l.id)) errors.push('leaf_id_missing:' + i);
      else if (seen[l.id]) errors.push('leaf_id_duplicate:' + l.id);
      seen[id] = true;
      if (l.parent !== null && l.parent !== undefined && !nonEmpty(l.parent)) errors.push('leaf_parent_invalid:' + id);
      if (!nonEmpty(l.question)) errors.push('leaf_question_missing:' + id);
      if (LEAF_ORIGINS.indexOf(l.origin) === -1) errors.push('leaf_origin_invalid:' + id);
      const d = DIMENSION_INDEX[l.dimension];
      if (!d) errors.push('leaf_dimension_unknown:' + id);
      if (!nonEmpty(l.lens)) errors.push('leaf_lens_missing:' + id);
      if (typeof l.researchable !== 'boolean') errors.push('leaf_researchable_invalid:' + id);
      else if (l.researchable === false && !nonEmpty(l.not_researchable_reason)) errors.push('leaf_reason_missing:' + id);
      else if (l.researchable === true && d && d.researchable === false && !d.required_when && l.origin !== 'mece_gap') {
        errors.push('leaf_researchable_on_closed_dimension:' + id);
      }
      if (l.falsifier !== undefined && l.falsifier !== null && !isObj(l.falsifier)) errors.push('leaf_falsifier_invalid:' + id);
      if (l.corpus !== undefined && l.corpus !== null && l.corpus !== 'openalex' && l.corpus !== 'room' && l.corpus !== 'theo') errors.push('leaf_corpus_invalid:' + id);
      if (l.slots !== undefined && l.slots !== null && !isObj(l.slots)) errors.push('leaf_slots_invalid:' + id);
    });
  }

  if (qs.coverage_notes !== undefined && qs.coverage_notes !== null) {
    if (!Array.isArray(qs.coverage_notes)) errors.push('coverage_notes_invalid');
    else {
      qs.coverage_notes.forEach(function (n, i) {
        if (!isObj(n) || !DIMENSION_INDEX[n.dimension]) errors.push('coverage_note_dimension_unknown:' + i);
      });
    }
  }
  if (qs.lens_selection !== undefined && qs.lens_selection !== null) {
    if (!Array.isArray(qs.lens_selection)) errors.push('lens_selection_invalid');
    else {
      qs.lens_selection.forEach(function (s, i) {
        if (!isObj(s) || !LENS_TEMPLATES[s.lens]) errors.push('lens_selection_lens_unknown:' + i);
        else if (!nonEmpty(s.reason)) errors.push('lens_selection_reason_missing:' + i);
      });
    }
  }
  return { ok: errors.length === 0, errors: errors };
}

module.exports = {
  SCHEMA: SCHEMA,
  TEMPLATES: TEMPLATES,
  PLANNER_TEMPLATE_IDS: PLANNER_TEMPLATE_IDS,
  LENS_TEMPLATES: LENS_TEMPLATES,
  FAMILY_IDS: FAMILY_IDS,
  PERSPECTIVE_STEPS: PERSPECTIVE_STEPS,
  templateForCommand: templateForCommand,
  templateForFramework: templateForFramework,
  dimensionsFor: dimensionsFor,
  validateQuestionSet: validateQuestionSet,
};
