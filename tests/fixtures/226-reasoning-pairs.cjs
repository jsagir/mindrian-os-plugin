/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-01 -- the reasoning-mode reference dataset (AI-SPEC Section 5).
 *
 * WHAT THIS IS
 *   The >= 12 fixture candidate-pair set that every Phase 226 test leg drives.
 *   Embedded mode's Phase 212 gold cards do not fit here: reasoning-mode runs
 *   with 2 of the critic's 3 numeric legs (differential_score, semantic_similarity)
 *   structurally absent (no encoder), so the fixtures must exercise the
 *   encoder-free Stage B rubric path specifically. Each fixture carries the stub
 *   judge answers (neutral + adversarial, coerceBool-compatible 'yes'/'no'
 *   strings) that drive the REAL critic.runRubric to the stated expected verdict.
 *
 * COMPOSITION (AI-SPEC Section 5):
 *   (a) 5 critical-path pairs: genuinely cross-domain, LOW Jaccard overlap
 *       between textA and textB, all six rubric items yes on both passes ->
 *       'transferable' (the eureka signature: shared meaning the vocabulary hides).
 *   (b) 2 fabricated-number traps: mechanism prose that TEMPTS a numeric estimate
 *       (scale / growth / valuation stated IN WORDS, no bare $-figures and no
 *       K/M/B tokens so the Gate 1 fabricated-quantity regex never trips) ->
 *       'transferable'. Their purpose is the null-legs assertion, not rejection.
 *   (c) 3 rejection pairs, one each, mirroring the Phase 212 negative-corpus junk
 *       classes: 'pseudoscience' (item f no, unsourced quantity in the mapping),
 *       'restatement' (item e no), 'general_shallow' (items a/b no).
 *   (d) 2 adversarial-flip pairs: neutral all-yes but adversarial flips at least
 *       one item to no -> the two-pass disagreement route, 'general_shallow' with
 *       reasoning_tag 'rubric_disagreement'.
 *
 * Pure CJS, node built-ins only, frozen data, no side effects, no em-dashes.
 * Mirrors the lib/core/eureka/lexical-overlap.cjs module shape.
 */
'use strict';

// A full six-item rubric answer with every item set to the same value, then
// selectively overridden. 'yes'/'no' strings are the coerceBool-compatible form
// the real parseRubricResponse accepts.
function allYes(overrides) {
  const base = { a: 'yes', b: 'yes', c: 'yes', d: 'yes', e: 'yes', f: 'yes' };
  return Object.assign(base, overrides || {});
}

// Each fixture: { id, textA, textB, mechanismText, mappingStatement,
//   expected_verdict, expected_reasoning_tag, expected_stage_a_pass,
//   neutral: {a..f}, adversarial: {a..f} }.
const FIXTURE_PAIRS = [
  // ---------- (a) critical path: cross-domain, LOW lexical overlap, transferable ----------
  {
    id: 'P01-circadian-shifts',
    textA: 'Circadian biology sets internal clocks that gate when cells repair and when hormones peak across a daily cycle.',
    textB: 'Factory crew rotation aligns operators to machine duty windows so throughput stays steady around the clock.',
    mechanismText: 'Both regimes phase-lock a population of units to an external period so recovery windows never collide with peak-load windows.',
    mappingStatement: 'Endocrine repair windows map to machine cooldown windows; the shared schema is phase-locked duty cycling.',
    expected_verdict: 'transferable',
    expected_reasoning_tag: 'passes_all_gates',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes(),
  },
  {
    id: 'P02-immune-fraud',
    textA: 'Adaptive immunity remembers past pathogens and mounts a faster antibody response on re-exposure.',
    textB: 'A fraud engine records prior attack signatures and blocks repeat offenders on their next attempt.',
    mechanismText: 'A prior exposure leaves a durable trace that lowers the cost of recognizing the same threat later.',
    mappingStatement: 'Antibody memory maps to a cached attack signature; the shared schema is exposure-primed recognition.',
    expected_verdict: 'transferable',
    expected_reasoning_tag: 'passes_all_gates',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes(),
  },
  {
    id: 'P03-mycorrhiza-logistics',
    textA: 'Fungal root networks trade sugar for phosphorus, routing scarce nutrients to the trees that need them most.',
    textB: 'A regional depot reroutes scarce parts to the assembly lines whose backlog is growing fastest.',
    mechanismText: 'A shared carrier reallocates a scarce resource toward the nodes whose local deficit is steepest.',
    mappingStatement: 'Symbiotic nutrient trading maps to depot reallocation; the shared schema is deficit-gradient routing.',
    expected_verdict: 'transferable',
    expected_reasoning_tag: 'passes_all_gates',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes(),
  },
  {
    id: 'P04-coral-pension',
    textA: 'Reef corals hold healthy until a heat threshold is crossed, then bleach abruptly and cascade to collapse.',
    textB: 'A pension pool stays solvent until a funding ratio is breached, then unwinds abruptly under redemptions.',
    mechanismText: 'A slowly stressed system looks stable right up to a hidden threshold, then flips state without warning.',
    mappingStatement: 'Thermal bleaching maps to a solvency breach; the shared schema is threshold-triggered regime collapse.',
    expected_verdict: 'transferable',
    expected_reasoning_tag: 'passes_all_gates',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes(),
  },
  {
    id: 'P05-birdsong-forks',
    textA: 'Songbird populations drift into local dialects as young birds copy neighbors with small copying errors.',
    textB: 'Software communities drift into forks as maintainers copy upstream with small divergent patches.',
    mechanismText: 'Faithful copying with a small error rate accumulates into distinct lineages once groups stop mixing.',
    mappingStatement: 'Dialect drift maps to a project fork; the shared schema is copy-error accumulation under isolation.',
    expected_verdict: 'transferable',
    expected_reasoning_tag: 'passes_all_gates',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes(),
  },

  // ---------- (b) fabricated-number traps: prose tempts a number, verdict still transferable ----------
  {
    id: 'P06-fabtrap-platform',
    textA: 'A contagion spreads person to person, accelerating once a critical density of carriers is reached.',
    textB: 'A marketplace spreads user to user, accelerating once a critical density of listings is reached.',
    mechanismText: 'The platform effect compounds as adoption spreads, promising enormous scale, exponential user growth, and a valuation that could reach into the billions once network density crosses a tipping threshold.',
    mappingStatement: 'Biological contagion maps to product adoption; the shared schema is threshold-gated diffusion.',
    expected_verdict: 'transferable',
    expected_reasoning_tag: 'passes_all_gates',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes(),
  },
  {
    id: 'P07-fabtrap-returns',
    textA: 'A wildfire jumps fuel breaks and doubles its footprint each hour once wind and dryness align.',
    textB: 'A viral clip jumps communities and doubles its reach each hour once timing and novelty align.',
    mechanismText: 'The compounding curve here is staggering, hinting at hundredfold returns, a market worth untold billions, and growth so steep the early numbers look almost unbelievable.',
    mappingStatement: 'Fire spread maps to viral reach; the shared schema is wind-aligned exponential propagation.',
    expected_verdict: 'transferable',
    expected_reasoning_tag: 'passes_all_gates',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes(),
  },

  // ---------- (c) rejection set: one each pseudoscience / restatement / general_shallow ----------
  {
    id: 'P08-reject-pseudoscience',
    textA: 'Crystal healing claims that mineral lattices emit vibrations aligned with human energy fields.',
    textB: 'Wellness marketing claims that wearable magnets rebalance the body and lift mood.',
    mechanismText: 'Quantum resonance in crystal lattices allegedly harmonizes with biofield frequencies to boost wellness.',
    mappingStatement: 'Crystal vibration maps to cellular signaling, and adoption should double wellness outcomes for most users.',
    expected_verdict: 'pseudoscience',
    expected_reasoning_tag: 'unsourced_quantity',
    expected_stage_a_pass: true,
    neutral: allYes({ f: 'no' }),
    adversarial: allYes({ f: 'no' }),
  },
  {
    id: 'P09-reject-restatement',
    textA: 'A thermostat senses room temperature and switches the heater to hold a target setpoint.',
    textB: 'A cruise controller senses vehicle speed and switches the throttle to hold a target setpoint.',
    mechanismText: 'A controller compares a measured value to a target and acts to close the gap.',
    mappingStatement: 'Thermostat control maps to cruise control, which is the same feedback idea told in new words.',
    expected_verdict: 'restatement',
    expected_reasoning_tag: 'restatement_vocab_swap',
    expected_stage_a_pass: true,
    neutral: allYes({ e: 'no' }),
    adversarial: allYes({ e: 'no' }),
  },
  {
    id: 'P10-reject-general-shallow',
    textA: 'One admired company credits its success to hard work and a focus on customers.',
    textB: 'Another admired company credits its success to hard work and a focus on customers.',
    mechanismText: 'Two successful companies both value effort and paying attention to their customers.',
    mappingStatement: 'Company X is like company Y because both work hard and care about customers.',
    expected_verdict: 'general_shallow',
    expected_reasoning_tag: 'schema_orphan',
    expected_stage_a_pass: true,
    neutral: allYes({ a: 'no', b: 'no' }),
    adversarial: allYes({ a: 'no', b: 'no' }),
  },

  // ---------- (d) adversarial-flip: neutral all-yes, adversarial flips >= 1 item -> disagreement ----------
  {
    id: 'P11-advflip-conductor',
    textA: 'An orchestra conductor keeps every section locked to a shared tempo through visible gestures.',
    textB: 'A distributed database keeps every node locked to a shared clock through periodic heartbeats.',
    mechanismText: 'A central signal keeps many independent actors synchronized to one shared beat.',
    mappingStatement: 'The conductor maps to the coordinator; sections map to nodes under one shared clock.',
    expected_verdict: 'general_shallow',
    expected_reasoning_tag: 'rubric_disagreement',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes({ b: 'no' }),
  },
  {
    id: 'P12-advflip-ants',
    textA: 'Ant colonies lay pheromone trails that reinforce the shortest routes to food over time.',
    textB: 'A content network reinforces the lowest-latency routes to a server through feedback weights.',
    mechanismText: 'Positive feedback on cheap paths lets a decentralized swarm converge on an efficient route.',
    mappingStatement: 'Pheromone reinforcement maps to latency-weighted routing; the schema is feedback-selected pathing.',
    expected_verdict: 'general_shallow',
    expected_reasoning_tag: 'rubric_disagreement',
    expected_stage_a_pass: true,
    neutral: allYes(),
    adversarial: allYes({ e: 'no' }),
  },
];

module.exports = {
  FIXTURE_PAIRS: FIXTURE_PAIRS,
  _test: {
    allYes: allYes,
  },
};
