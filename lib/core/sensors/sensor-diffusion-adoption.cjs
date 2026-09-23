'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SENS-09 -- dual-use diffusion/adoption detector.
 *
 * Surfaces a brain_consult candidate reach for the Brain framework
 * "Adoption-Capacity Theory" (the Adoption-Capacity Engine, ACE v2;
 * mos_command /mos:analyze-timing) when the LOCAL turn shows a dual-use
 * technology diffusion/adoption shape. ACE forecasts whether a (dual-use)
 * innovation will diffuse, who adopts first, and the adoption path -- so this
 * sensor is the "is this a diffusion question?" gate.
 *
 * FIRES on ANY of (in CANON PART 11 R3 precedence order -- CONTEXT first,
 * keyword DEMOTED to fallback; navigator decision 2026-06-23):
 *   1. SIGNAL MODE  -- an explicit 'diffusion_detected' signal on the turn, OR
 *      a problem-state SIGNAL kind (the strongest context tier), OR
 *   2. CONTEXT MODE -- the LOCAL navigator PROBLEM-STATE indicates a
 *      dual-use / diffusion / adoption shape: tuple.problem_type matches the
 *      generic diffusion problem-type allow-list, OR the navigation.cjs
 *      chokepoint populated a problem-state enum (stage / jtbd / graph_gap).
 *      This is the PRIMARY branch (R3 / INV-07): the trigger keys on
 *      problem-state read LOCALLY via the chokepoint convention, enum/scalar
 *      only (Part 8/9), NOT on a keyword scan. OR
 *   3. KEYWORD MODE -- the LOCAL turn text contains a dual-use lexicon term
 *      (the DEMOTED fallback tier -- fires ONLY when no problem-state context
 *      is present), OR
 *   4. MARKER MODE  -- a fresh <roomDir>/.mindrian/diffusion-scan-*.json
 *      side-channel marker exists.
 *
 * CANON PART 8: the sensor reads ONLY LOCAL bytes (the turn text, the diagnose
 * tuple/ctx enums the chokepoint populated, a LOCAL side-channel) to DECIDE
 * firing; it makes NO Brain call and NO network call. The reach carries ONLY
 * generic handles: dispatch 'adoption-capacity' and the brain_framework_chain
 * companion. evidence is a flat scalar/enum bag (the fire MODE enum + the
 * trigger TIER enum + problem_type enum) -- never the user's matched text. The
 * lexicon terms + the diffusion problem-type allow-list are OUR fixed generic
 * vocabulary, never user content.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide().
 *
 * Pure / sync / LOCAL-first. node built-ins + sensor-types only. No new deps.
 * House rule: hyphens only, no em-dashes.
 *
 * Quick task 260923-u8v -- the DOMINANT DESIGN BRANCH. This same file also
 * surfaces the Dominant Design framework (dispatch handle 'dominant-design',
 * translated to the exact framework name by data/dispatch-framework-map.json,
 * resolved to /mos:dominant-designs by commandsForFramework) when the LOCAL
 * turn text carries a Theo ch04 "Trend Analysis & S-Curves" tell (era of
 * ferment, a locked design, or a design converging). The cue source is the
 * Theo repo chapter chapters/week-04-trend-analysis-s-curves.md (lines 174,
 * 176, 178, 188, 190, 192) -- read-only, never edited from here.
 *
 * Why SENS-09 is this branch's home: Theo's graph has Dominant Design FEEDS
 * INTO Adoption-Capacity Theory (confidence 0.8) and ADDRESSES_PROBLEM_TYPE
 * UnDefined and IllDefined -- the same diffusion/adoption neighborhood this
 * sensor already covers. No new sensor is minted, the frozen brain_consult
 * reach is reused (no context_block collider is added to sensor-priority.cjs
 * Group C), and the existing BCH-S5 turn-stage gate keeps it out of turns 1-2
 * for free (lib/core/insight-sensors.cjs TURN_STAGE_GATED_REACHES).
 *
 * Precedence ladder (highest first): ACE signal, then ACE context, then this
 * dominant-design keyword branch, then ACE keyword, then ACE marker. The
 * dominant-design branch sits ABOVE the ACE keyword fallback on purpose: a
 * turn that carries a ch04 tell AND only an ACE keyword/marker hit (no ACE
 * signal, no ACE context) routes to Dominant Design, not to ACE, because a
 * ch04-shaped read is more specific than a bare dual-use lexicon hit.
 *
 * The branch is keyword-tier ONLY: no shipped producer emits a dominant-design
 * problem_type today, so no context tier is minted for it. Companions stay
 * empty -- the S-Curve -> Dominant Design -> Reverse Salient chain is Theo's
 * to encode (the two missing FEEDS_INTO edges land Theo-side, Theo Phase
 * 20.3), never plugin logic.
 *
 * Cues are \b-anchored RegExp with the 'i' flag over bounded [^.?!]{0,N}
 * windows (the SENS-18 structural fix for the DIFFUSION_LEXICON indexOf
 * over-fire bug, and the bound also keeps a very long turn from ever costing
 * more than a fixed amount of regex work -- no ReDoS). Evidence carries enums
 * only (Part 8): framework, mode, design_state, trigger_tier, problem_type --
 * never the matched substring or any of the turn's own words.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  makeReach,
  // Phase 172-12 (R3 / INV-07): the Plan-07 trigger-tier seam. classifyTriggerTier
  // reads the LOCAL problem-state enum (stage / jtbd / graph_gap) off the
  // tuple+ctx the navigation.cjs chokepoint populated, applying the
  // context-first / keyword-fallback precedence. Adds NO filesystem / Brain read.
  classifyTriggerTier,
  isContextTier,
} = require('./sensor-types.cjs');

/**
 * The dual-use diffusion lexicon. OUR fixed generic vocabulary (mirrors the
 * Brain ACE node trigger_lexicon). Generic handles, NOT user content. A LOCAL
 * turn-text hit on any term means "this looks like a dual-use diffusion
 * question" and surfaces ACE.
 */
const DIFFUSION_LEXICON = [
  'dual-use', 'dual use', 'defense', 'defence', 'military', 'army', 'navy',
  'air force', 'idf', 'weapon', 'missile', 'drone', 'swarm', 'autonomous',
  'laws', 'deep-tech', 'deep tech', 'diffusion', 'adoption', 'first-mover',
  'first mover', 'proliferation', 'arms race', 'procurement',
];

/**
 * The diffusion PROBLEM-TYPE allow-list. OUR fixed generic vocabulary of the
 * /mos:diagnose problem_type enum values that denote a diffusion/adoption shape.
 * A tuple.problem_type hit on any of these means the NAVIGATOR PROBLEM-STATE --
 * not a keyword in the prose -- says "this is a diffusion question," so the
 * CONTEXT branch fires (R3 primary). Generic enum handles, NEVER user content.
 */
const DIFFUSION_PROBLEM_TYPES = [
  'diffusion', 'adoption', 'dual-use', 'dual_use', 'technology-diffusion',
  'adoption-capacity', 'market-timing',
];

const SIGNAL_FRESHNESS_MS = 30 * 60 * 1000;

/**
 * Quick 260923-u8v -- the three Theo ch04 states, in classification precedence
 * order (declaration order IS the precedence: ferment before locked before
 * convergence). Frozen; drift-tested by the quick task's own test file.
 */
const DOMINANT_DESIGN_STATES = Object.freeze(['ferment', 'locked', 'convergence']);

/**
 * Quick 260923-u8v -- the Theo ch04 tell cues, one frozen RegExp array per
 * state. OUR fixed generic vocabulary (never user content); \b-anchored with
 * the 'i' flag and bounded [^.?!]{0,N} windows so a long turn cannot cost more
 * than a fixed amount of regex work. Deliberately excluded (do not add): a
 * bare S-curve phrase (an S-curve placement question belongs upstream to
 * S-Curve Analysis per the ch04 sequence), a bare 'built on top of' phrase,
 * and bare 'bottleneck' words (SENS-02 owns lagging-component detection).
 */
const DOMINANT_DESIGN_CUES = Object.freeze({
  ferment: Object.freeze([
    /\bera of ferment\b/i, // ch04:176
    /\b(?:rival|competing)\s+(?:architectures|standards|formats)\b/i, // ch04:178 (never "designs")
    /\b(?:nobody|no one|no-one)\s+(?:has\s+)?(?:agrees?|agreed)\b[^.?!]{0,40}\bmetric\b/i, // ch04:178
    /\bwhich metric decides\b/i, // ch04:192
    /\bswitching\b[^.?!]{0,50}\bis (?:still )?cheap\b/i, // ch04:178 (requires "is")
    /\bcheap to switch\b/i, // ch04:178
    /\b(?:several|multiple|many)\b,?\s+(?:different\s+)?lagging components\b/i, // ch04:178
    /\b(?:standard|design|architecture)\b\s+(?:is\s+|are\s+)?(?:visibly\s+|already\s+|now\s+)?crack(?:s|ed|ing)?\b/i, // ch04:176,188,210 (adjacency)
  ]),
  locked: Object.freeze([
    /\binterface\b\s+(?:has\s+|had\s+)?stopped changing\b/i, // ch04:190
    /\b(?:freeze|froze|frozen)\b\s+(?:one|the|an|that)\s+interface\b/i, // ch04:174
    /\b(?:fight|competition|battle|race)\b[^.?!]{0,40}\b(?:moved|moves|shifted|shifts)\b[^.?!]{0,40}\bon top\b/i, // ch04:178
    /\bswitching costs?\b[^.?!]{0,20}\bharden(?:s|ed|ing)?\b/i, // ch04:178
    /\btechnological momentum\b/i, // ch04:178
    /\bone lagging component\b/i, // ch04:178
  ]),
  convergence: Object.freeze([
    /\bdominant designs?\b/i, // ch04:174 (never "predominant designation")
    /\bconverg(?:e|es|ed|ing)\b[^.?!]{0,30}\b(?:one|same|single|common)\b[^.?!]{0,25}\b(?:shapes?|designs?|standards?|architectures?|formats?)\b/i, // ch04:174
    /\bwhich\s+(?:architecture|design|standard|format|body)\b\s*(?:will\s+)?wins?\b/i, // ch04:192 (never "which one wins" alone)
    /\b(?:agree|agrees|agreed)\s+on\s+(?:a|one|the)\s+standard\b/i, // ch04:174
    /\b(?:everyone else falls in line|falls? in line)\b/i, // ch04:174
  ]),
});

/**
 * classifyDominantDesign(text) -> one of DOMINANT_DESIGN_STATES, or ''.
 *
 * Pure, sync, never throws. Returns '' for a non-string or empty text,
 * otherwise the first state in DOMINANT_DESIGN_STATES order whose cue array
 * has any match, else ''.
 */
function classifyDominantDesign(text) {
  if (typeof text !== 'string' || !text) return '';
  for (const state of DOMINANT_DESIGN_STATES) {
    const cues = DOMINANT_DESIGN_CUES[state];
    for (const rx of cues) {
      if (rx.test(text)) return state;
    }
  }
  return '';
}

/**
 * SIGNAL MODE -- true if the turn carries an explicit 'diffusion_detected'
 * signal (string or { kind }). Defensive; never throws.
 */
function hasDiffusionSignal(turn) {
  if (!turn || typeof turn !== 'object') return false;
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    const kind = (typeof s === 'string') ? s : (s && typeof s === 'object' ? s.kind : '');
    if (kind === 'diffusion_detected') return true;
  }
  return false;
}

/**
 * KEYWORD MODE -- returns the matched lexicon term (OUR generic vocabulary) if
 * the LOCAL turn text contains one, else ''. Reads turn.text only; never
 * egresses it. The returned term is from our fixed list, not user bytes.
 */
function textMatchesLexicon(turn) {
  const text = (turn && typeof turn === 'object' && typeof turn.text === 'string') ? turn.text.toLowerCase() : '';
  if (!text) return '';
  for (const term of DIFFUSION_LEXICON) {
    if (text.indexOf(term) !== -1) return term;
  }
  return '';
}

/**
 * MARKER MODE -- true if a fresh <roomDir>/.mindrian/diffusion-scan-*.json
 * side-channel marker exists. Mirrors the insight-sensors auto-explore-*.json
 * freshness idiom; self-contained (no require of insight-sensors -- that would
 * be circular). Soft-fail to false; never throws. A future-dated mtime (clock
 * skew) is rejected: age must be non-negative AND within the window.
 */
function hasFreshMarker(ctx) {
  try {
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return false;
    const sideDir = path.join(roomDir, '.mindrian');
    let entries = [];
    try { entries = fs.readdirSync(sideDir); } catch (_e) { return false; }
    for (const name of entries) {
      if (name.indexOf('diffusion-scan-') === 0 && name.slice(-5) === '.json') {
        try {
          const st = fs.statSync(path.join(sideDir, name));
          const age = Date.now() - st.mtimeMs;
          if (age >= 0 && age <= SIGNAL_FRESHNESS_MS) return true;
        } catch (_e) { /* keep scanning */ }
      }
    }
    return false;
  } catch (_e) {
    return false;
  }
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
 * CONTEXT MODE (R3 primary) -- true when the LOCAL navigator PROBLEM-STATE shows
 * a DIFFUSION/ADOPTION shape specifically: tuple.problem_type (the enum the
 * navigation.cjs chokepoint surfaces onto the diagnose tuple) is in OUR generic
 * diffusion problem-type allow-list. This is the PRIMARY trigger (R3): SENS-09
 * keys on the problem-state, not on a keyword scan. enum/scalar only (Part 8/9);
 * a pure projection of the value already in hand -- NO filesystem / Brain read.
 *
 * (The broader Plan-07 tiering seam -- classifyTriggerTier -- is used to LABEL
 * the tier enum recorded in evidence, so "context first, keyword fallback" is a
 * recorded, testable property; it does NOT itself widen what SENS-09 fires on,
 * keeping the keyword fallback genuinely reachable on a bare diffusion-lexicon
 * turn that carries no diffusion problem-state.)
 */
function hasDiffusionContext(tuple) {
  const pt = (tuple && typeof tuple === 'object' && typeof tuple.problem_type === 'string')
    ? tuple.problem_type.toLowerCase() : '';
  return !!pt && DIFFUSION_PROBLEM_TYPES.indexOf(pt) !== -1;
}

/**
 * SENS-09 -- dual-use diffusion/adoption -> Adoption-Capacity Theory (ACE).
 *
 * @param {object} turn  -- normalized turn ({ text, signals })
 * @param {object} tuple -- /mos:diagnose tuple { problem_type }
 * @param {object} ctx   -- LOCAL context ({ roomDir })
 * @returns {Readonly<object>|null}
 */
function sensorDiffusionAdoption(turn, tuple, ctx) {
  // R3 precedence (Canon Part 11): CONTEXT first, keyword DEMOTED to fallback.
  //   signal  -- strongest (explicit diffusion signal on the turn)
  //   context -- the PRIMARY branch: the LOCAL navigator problem-state
  //   keyword -- the FALLBACK (fires only when no problem-state context present)
  //   marker  -- a fresh LOCAL side-channel
  let mode = '';
  if (hasDiffusionSignal(turn)) {
    mode = 'signal';
  } else if (hasDiffusionContext(tuple)) {
    mode = 'context';
  }

  if (!mode) {
    // Quick 260923-u8v -- the DOMINANT DESIGN BRANCH. Only considered when
    // neither ACE tier fired. Reuses this sensor's frozen brain_consult reach
    // (no new sensor, no new reach id); sits ABOVE the ACE keyword fallback
    // (a ch04-shaped read is more specific than a bare dual-use lexicon hit).
    const ddText = (turn && typeof turn === 'object' && typeof turn.text === 'string') ? turn.text : '';
    const designState = classifyDominantDesign(ddText);
    if (designState) {
      let dd_trigger_tier = null;
      try {
        dd_trigger_tier = classifyTriggerTier(turn, tuple, ctx);
      } catch (_e) {
        dd_trigger_tier = null;
      }
      return makeReach({
        reach_id: 'brain_consult',
        posture: 'push_forward',
        // Generic handle: the dominant-design dispatch token. The WFL-01
        // layer (data/dispatch-framework-map.json) maps 'dominant-design' ->
        // "Dominant Design" -> /mos:dominant-designs via commandsForFramework.
        dispatch: 'dominant-design',
        companions: [],
        signal: 'dominant_design_detected',
        // LOCAL scalars / enums ONLY (Part 8): never the matched substring.
        evidence: {
          framework: 'dominant-design',
          mode: 'keyword',
          design_state: designState,
          trigger_tier: dd_trigger_tier,
          problem_type: problemTypeOf(tuple),
        },
      });
    }
    if (textMatchesLexicon(turn)) {
      mode = 'keyword';
    } else if (hasFreshMarker(ctx)) {
      mode = 'marker';
    }
  }

  if (!mode) return null;

  const pt = problemTypeOf(tuple);

  // The Plan-07 tiering classification, recorded as a generic enum so the
  // context-first / keyword-fallback precedence is legible in the evidence.
  // Soft-fail to null so a classifier fault never blocks the reach.
  let trigger_tier = null;
  try {
    trigger_tier = classifyTriggerTier(turn, tuple, ctx);
  } catch (_e) {
    trigger_tier = null;
  }

  return makeReach({
    reach_id: 'brain_consult',
    posture: 'push_forward',
    // Generic handle: the ACE dispatch token. The WFL-01 layer
    // (data/dispatch-framework-map.json) maps 'adoption-capacity' ->
    // "Adoption-Capacity Theory" -> /mos:analyze-timing via commandsForFramework.
    dispatch: 'adoption-capacity',
    companions: ['brain_framework_chain:adoption-capacity'],
    signal: 'diffusion_detected',
    // LOCAL scalars / enums ONLY: the fire MODE enum + the trigger TIER enum +
    // the problem_type enum. Never the user's matched text (Part 8).
    evidence: { framework: 'adoption-capacity', mode: mode, trigger_tier: trigger_tier, problem_type: pt },
  });
}

module.exports = {
  sensorDiffusionAdoption: sensorDiffusionAdoption,
  DIFFUSION_LEXICON: DIFFUSION_LEXICON,
  DIFFUSION_PROBLEM_TYPES: DIFFUSION_PROBLEM_TYPES,
  // Quick 260923-u8v -- the Theo ch04 dominant-design classifier surface.
  DOMINANT_DESIGN_CUES: DOMINANT_DESIGN_CUES,
  DOMINANT_DESIGN_STATES: DOMINANT_DESIGN_STATES,
  classifyDominantDesign: classifyDominantDesign,
};
