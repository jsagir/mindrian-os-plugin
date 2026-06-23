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
  } else if (textMatchesLexicon(turn)) {
    mode = 'keyword';
  } else if (hasFreshMarker(ctx)) {
    mode = 'marker';
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
};
