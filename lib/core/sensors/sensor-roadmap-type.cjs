'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SENS-18 -- roadmap-type classifier -> the roadmap-type-selector context_block offer.
 *
 * Classifies a navigator's stated research goal into ONE of six roadmap output-
 * shapes, so a research command is picked by a governed classifier instead of
 * improvisation (Canon Part 7: one shipped reach-candidate seam, no second
 * selection brain).
 *
 * FIRES on ANY of (in CANON PART 11 R3 precedence order -- CONTEXT primary,
 * keyword DEMOTED to fallback; D-06 single-hit tiered fire):
 *   1. SIGNAL MODE  -- an explicit 'roadmap_type:<slug>' signal on the turn (the
 *      strongest tier). NO SHIPPED PRODUCER EMITS THIS SIGNAL YET: this tier is
 *      a reserved highest-precedence override seam, not a live wire today. Do
 *      not read this docblock as implying a wire that does not exist.
 *   2. CONTEXT MODE -- tuple.problem_type (the LOCAL navigator problem-state
 *      the navigation.cjs chokepoint surfaces) matches ROADMAP_PROBLEM_TYPES.
 *      This is the R3-primary tier.
 *   3. KEYWORD MODE -- the LOCAL turn text matches a \b-anchored pattern in
 *      ROADMAP_PATTERNS (the DEMOTED fallback tier, D-02 additive-score
 *      classifier). Fires only when no signal/context tier produced a slug.
 * There is NO marker tier: no side-channel marker file exists for this sensor.
 *
 * CANON PART 8: the sensor reads ONLY LOCAL bytes -- turn.text, turn.signals,
 * tuple.problem_type -- to DECIDE firing; it makes NO Brain call and NO network
 * call. The reach carries ONLY generic handles: a closed 6-value roadmap-type
 * enum, a mode enum, two numbers, a boolean, and framework NAMES drawn from the
 * committed data/roadmap-type-chains.json table -- never the user's matched
 * text.
 *
 * TWO FACTS a future reader would otherwise get wrong:
 *   (a) evidence.roadmap_type is the LOAD-BEARING field; companions carries the
 *       framework names for OBSERVABILITY ONLY. The sole shipped `companions`
 *       consumer (lib/brain/chain-recommender.cjs::parseChainCompanions) skips
 *       any companion string without a 'brain_framework_chain:' prefix and
 *       deliberately ignores a third ':<framework>' segment, so bare framework
 *       names on `companions` reach nobody today. Do NOT prefix them with
 *       'brain_framework_chain:' to "fix" this: that would make the parser feed
 *       the segment to the Brain chain recommender as a problem_type handle,
 *       which is wrong semantics and would produce wrong Brain queries. Wiring
 *       a live consumer is a follow-on, not done here.
 *   (b) the sensor is SYNCHRONOUS by contract. dispatchSensors checks
 *       REACH_IDS.indexOf(reach.reach_id) !== -1; a Promise satisfies
 *       `typeof === 'object'` but has `reach_id === undefined`, so it is
 *       silently dropped with no throw and no log. Never make any function in
 *       this file `async`.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide().
 *
 * Pure / sync / LOCAL-first. node built-ins + sensor-types only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  makeReach,
  classifyTriggerTier,
} = require('./sensor-types.cjs');

/**
 * The six roadmap output-shapes. OUR fixed generic enum, NOT user content.
 * This array's order IS the deterministic tie-break order (Decisions section
 * of 264-03-PLAN.md: ties in the keyword tier are broken by declaration order
 * and the fact is recorded as evidence.tie_broken = true).
 */
const ROADMAP_TYPES = Object.freeze([
  'landscape-analysis',
  'technical-roadmap',
  'pipeline-analysis',
  'opportunity-analysis',
  'agenda-setting-manifesto',
  'vision-paper',
]);

/**
 * ROADMAP_PATTERNS -- OUR fixed generic vocabulary, NOT user content. A frozen
 * map from slug to { strong: [RegExp], weak: [RegExp] }. Every pattern uses \b
 * word boundaries with the 'i' flag deliberately (D-02): this is the divergence
 * from the donor sensor-diffusion-adoption.cjs's textMatchesLexicon indexOf
 * scan, which carries a live over-fire bug in two shipped sensors
 * (DIFFUSION_LEXICON's 'laws' matching inside 'flaws'; SHOW_SHARE_LEXICON's
 * 'show' matching inside 'slideshow'). \b anchoring is the structural fix, not
 * propagated forward here.
 */
const ROADMAP_PATTERNS = Object.freeze({
  'landscape-analysis': Object.freeze({
    strong: Object.freeze([
      /\blandscape analysis\b/i,
      /\bfield scan\b/i,
      /\bmap (?:the|this) (?:landscape|field|terrain|domain)\b/i,
      /\bwho else is working on\b/i,
      /\bstate of the (?:field|art)\b/i,
    ]),
    weak: Object.freeze([
      /\blandscape\b/i,
      /\bsurvey\b/i,
      /\bprior art\b/i,
      /\btaxonomy\b/i,
      /\bwhat exists\b/i,
    ]),
  }),
  'technical-roadmap': Object.freeze({
    strong: Object.freeze([
      /\btechnical roadmap\b/i,
      /\breverse salient\b/i,
      /\bcritical path\b/i,
      /\brate[- ]limiting step\b/i,
      /\bwhat has to be solved (?:first|before)\b/i,
    ]),
    weak: Object.freeze([
      /\broadmap\b/i,
      /\bbottleneck\b/i,
      /\bblocker\b/i,
      /\bmilestone\b/i,
      /\bunknowns?\b/i,
    ]),
  }),
  'pipeline-analysis': Object.freeze({
    strong: Object.freeze([
      /\bpipeline analysis\b/i,
      /\bvalley of death\b/i,
      /\btranslation gap\b/i,
      /\bstage[- ]gate\b/i,
      /\bwhere (?:does|do) (?:it|things|projects) stall\b/i,
    ]),
    weak: Object.freeze([
      /\bpipeline\b/i,
      /\bthroughput\b/i,
      /\bhandoffs?\b/i,
      /\battrition\b/i,
      /\bfunnels?\b/i,
    ]),
  }),
  'opportunity-analysis': Object.freeze({
    strong: Object.freeze([
      /\bopportunity analysis\b/i,
      /\bvalue proposition\b/i,
      /\bworth (?:doing|solving|pursuing)\b/i,
      /\bmarket opportunity\b/i,
      /\bbusiness case\b/i,
    ]),
    weak: Object.freeze([
      /\bopportunity\b/i,
      /\bviable\b/i,
      /\bwilling to pay\b/i,
      /\bcustomers?\b/i,
      /\bthesis\b/i,
    ]),
  }),
  'agenda-setting-manifesto': Object.freeze({
    strong: Object.freeze([
      /\bresearch agenda\b/i,
      /\bmanifesto\b/i,
      /\bagenda[- ]setting\b/i,
      /\bcall to action\b/i,
      /\bwhat (?:should|ought) the field (?:be )?(?:ask|work|focus)/i,
    ]),
    weak: Object.freeze([
      /\bagenda\b/i,
      /\bposition paper\b/i,
      /\bprovocation\b/i,
      /\bbeautiful question\b/i,
      /\bframing\b/i,
    ]),
  }),
  'vision-paper': Object.freeze({
    strong: Object.freeze([
      /\bvision paper\b/i,
      /\bscenario planning\b/i,
      /\bwhat (?:could|would|might) (?:the )?world look like\b/i,
      /\bten years? (?:out|from now)\b/i,
      /\bplausible futures?\b/i,
    ]),
    weak: Object.freeze([
      /\bvision\b/i,
      /\bfutures?\b/i,
      /\bscenarios?\b/i,
      /\bspeculative\b/i,
      /\blong[- ]term\b/i,
    ]),
  }),
});

/**
 * ROADMAP_PROBLEM_TYPES -- OUR fixed generic vocabulary, NOT user content. A
 * frozen map from a lowercased tuple.problem_type enum handle to a roadmap-type
 * slug. Read by roadmapContextOf (the R3-primary CONTEXT tier).
 */
const ROADMAP_PROBLEM_TYPES = Object.freeze({
  'landscape': 'landscape-analysis',
  'domain-survey': 'landscape-analysis',
  'technical-roadmap': 'technical-roadmap',
  'roadmap': 'technical-roadmap',
  'bottleneck': 'technical-roadmap',
  'pipeline': 'pipeline-analysis',
  'translation-gap': 'pipeline-analysis',
  'opportunity': 'opportunity-analysis',
  'value-proposition': 'opportunity-analysis',
  'agenda-setting': 'agenda-setting-manifesto',
  'manifesto': 'agenda-setting-manifesto',
  'research-agenda': 'agenda-setting-manifesto',
  'vision': 'vision-paper',
  'futures': 'vision-paper',
});

const ROADMAP_SIGNAL_PREFIX = 'roadmap_type:';

// lib/core/sensors/ -> lib/core -> lib -> <repo root> -> data/roadmap-type-chains.json
const ROADMAP_CHAIN_TABLE_PATH = path.join(__dirname, '..', '..', '..', 'data', 'roadmap-type-chains.json');

const STRONG_WEIGHT = 2;
const WEAK_WEIGHT = 1;

let _chainTableCache = null;

/**
 * SIGNAL MODE -- returns a roadmap-type slug or ''. Iterates turn.signals,
 * accepting a signal that is either a string or an object with a `kind`
 * property (the donor's defensive idiom), and returns the slug when the value
 * equals ROADMAP_SIGNAL_PREFIX + slug for a slug in ROADMAP_TYPES.
 *
 * NO SHIPPED PRODUCER EMITS THESE SIGNALS YET: this tier is a reserved
 * highest-precedence override seam, not a live wire. Defensive; never throws.
 */
function roadmapSignalOf(turn) {
  if (!turn || typeof turn !== 'object') return '';
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    const kind = (typeof s === 'string') ? s : (s && typeof s === 'object' ? s.kind : '');
    if (typeof kind === 'string' && kind.indexOf(ROADMAP_SIGNAL_PREFIX) === 0) {
      const slug = kind.slice(ROADMAP_SIGNAL_PREFIX.length);
      if (ROADMAP_TYPES.indexOf(slug) !== -1) return slug;
    }
  }
  return '';
}

/**
 * CONTEXT MODE (R3-primary) -- returns a roadmap-type slug or ''. Reads
 * tuple.problem_type, lowercases it, and looks it up in ROADMAP_PROBLEM_TYPES.
 * Defensive; never throws.
 */
function roadmapContextOf(tuple) {
  const pt = (tuple && typeof tuple === 'object' && typeof tuple.problem_type === 'string')
    ? tuple.problem_type.toLowerCase() : '';
  if (!pt) return '';
  const slug = ROADMAP_PROBLEM_TYPES[pt];
  return (typeof slug === 'string') ? slug : '';
}

/**
 * KEYWORD MODE (fallback tier, D-02 additive-score classifier). For each slug,
 * sums STRONG_WEIGHT per matching strong pattern and WEAK_WEIGHT per matching
 * weak pattern (each pattern counts at most once regardless of how many times
 * it matches). The winner is the highest score; ties are broken by
 * ROADMAP_TYPES declaration order with tie_broken = true. Output is enum plus
 * number plus boolean only, never a matched substring (mirrors
 * dual-path-detector.cjs's own Part-8 discipline). Guards a non-string or
 * empty text by returning the zero result.
 *
 * @param {string} text
 * @returns {{ type: string, score: number, tie_broken: boolean }}
 */
function classifyRoadmapType(text) {
  if (typeof text !== 'string' || !text) {
    return { type: '', score: 0, tie_broken: false };
  }

  const scores = {};
  for (const slug of ROADMAP_TYPES) {
    const bank = ROADMAP_PATTERNS[slug];
    let score = 0;
    for (const rx of bank.strong) {
      if (rx.test(text)) score += STRONG_WEIGHT;
    }
    for (const rx of bank.weak) {
      if (rx.test(text)) score += WEAK_WEIGHT;
    }
    scores[slug] = score;
  }

  let topSlug = '';
  let topScore = 0;
  let tieCount = 0;
  for (const slug of ROADMAP_TYPES) {
    const s = scores[slug];
    if (s > topScore) {
      topScore = s;
      topSlug = slug;
      tieCount = 1;
    } else if (s === topScore && s > 0) {
      tieCount += 1;
    }
  }

  if (topScore === 0 || !topSlug) {
    return { type: '', score: 0, tie_broken: false };
  }

  return { type: topSlug, score: topScore, tie_broken: tieCount > 1 };
}

/**
 * Lazily reads and caches ROADMAP_CHAIN_TABLE_PATH with fs.readFileSync inside
 * a try/catch, soft-failing to an empty object so a missing or malformed table
 * never blocks the reach. Returns a copy of the framework-name array for the
 * slug, filtered to strings, or []. Never hashes anything (Part-8 sweep bans
 * unmarked sha256/createHash under lib/core/sensors/).
 *
 * @param {string} slug
 * @returns {string[]}
 */
function chainForRoadmapType(slug) {
  if (_chainTableCache === null) {
    _chainTableCache = {};
    try {
      const raw = fs.readFileSync(ROADMAP_CHAIN_TABLE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        _chainTableCache = parsed;
      }
    } catch (_e) {
      _chainTableCache = {};
    }
  }
  const arr = _chainTableCache[slug];
  if (!Array.isArray(arr)) return [];
  return arr.filter(function (v) { return typeof v === 'string'; }).slice();
}

/**
 * Pull the problem_type enum off the diagnose tuple as a generic handle.
 * Returns 'undefined' (the enum value) when absent -- never user content.
 */
function problemTypeOf(tuple) {
  if (!tuple || typeof tuple !== 'object') return 'undefined';
  const pt = tuple.problem_type;
  return (typeof pt === 'string' && pt) ? pt : 'undefined';
}

/**
 * SENS-18 -- roadmap-type classifier -> context_block roadmap-type-selector.
 *
 * Contract: sensorFn(turn, tuple, ctx) -> candidate-reach|null (the shipped
 * contract per insight-sensors.cjs; SPEC.md Requirement 1's `sensorX(context)`
 * is a documentation error, not the actual shape).
 *
 * @param {object} turn  -- normalized turn ({ text, signals })
 * @param {object} tuple -- /mos:diagnose tuple { problem_type }
 * @param {object} ctx   -- LOCAL context
 * @returns {Readonly<object>|null}
 */
function sensorRoadmapType(turn, tuple, ctx) {
  let slug = '';
  let mode = '';
  let score = 0;
  let tieBroken = false;

  const signalSlug = roadmapSignalOf(turn);
  if (signalSlug) {
    slug = signalSlug;
    mode = 'signal';
  } else {
    const contextSlug = roadmapContextOf(tuple);
    if (contextSlug) {
      slug = contextSlug;
      mode = 'context';
    } else {
      const text = (turn && typeof turn === 'object' && typeof turn.text === 'string') ? turn.text : '';
      const kw = classifyRoadmapType(text);
      if (kw.type) {
        slug = kw.type;
        mode = 'keyword';
        score = kw.score;
        tieBroken = kw.tie_broken;
      }
    }
  }

  if (!slug) return null;

  let trigger_tier = null;
  try {
    trigger_tier = classifyTriggerTier(turn, tuple, ctx);
  } catch (_e) {
    trigger_tier = null;
  }

  const chain = chainForRoadmapType(slug);

  return makeReach({
    reach_id: 'context_block',
    posture: 'hold',
    dispatch: 'roadmap-type-selector',
    companions: chain,
    signal: 'roadmap_type_classified',
    evidence: {
      roadmap_type: slug,
      mode: mode,
      score: score,
      chain_len: chain.length,
      tie_broken: tieBroken,
      trigger_tier: trigger_tier,
      problem_type: problemTypeOf(tuple),
    },
  });
}

module.exports = {
  sensorRoadmapType: sensorRoadmapType,
  classifyRoadmapType: classifyRoadmapType,
  chainForRoadmapType: chainForRoadmapType,
  ROADMAP_TYPES: ROADMAP_TYPES,
  ROADMAP_PATTERNS: ROADMAP_PATTERNS,
  ROADMAP_PROBLEM_TYPES: ROADMAP_PROBLEM_TYPES,
  ROADMAP_CHAIN_TABLE_PATH: ROADMAP_CHAIN_TABLE_PATH,
};
