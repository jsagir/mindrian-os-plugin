'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-05 (item 4, D-Q4) -- the TWO ORTHOGONAL DECISION AXES.
 * =========================================================================
 * The Test 6 tone slip ("these ARE the same" + the "would be its own
 * punchline" quip) was ONE failure mode: a presumptuous, confident TELL to a
 * professor. The classic fix is prompt discipline ("always hedge"). This
 * module fixes it by CONSTRUCTION instead: it splits the single decision
 * surface into two independent axes so the forbidden quadrant cannot be
 * expressed at all.
 *
 *   AXIS 1 -- confidence : {hedged, confident}
 *   AXIS 2 -- initiative : {ask_first, act_first}
 *
 * Hedging is ALWAYS on (the GUIDED default, Canon Part 3 / D-Q4): the
 * `confident` value is NEVER emitted. Because the emitted confidence value is
 * a const `HEDGED`, the only reachable modes are:
 *
 *   ask_first  x hedged -> ask_and_hedged   (SAFE)
 *   act_first  x hedged -> tell_and_hedged  (SAFE)
 *
 * The fourth composition, tell_and_confident (FORBIDDEN_MODE), has NO return
 * path: `confident` is never assigned to the emitted axis, so the string
 * 'tell_and_confident' is only ever the negative-assertion target in the
 * export + the drift test, never a value resolveDecisionMode returns.
 *
 * D-Q4: the act/tell line reuses the FROZEN Shape-F 0.70 detent
 * (RECOMMENDED_CONFIDENCE_FLOOR, Part 3) imported LIVE from
 * navigation-engine.cjs -- never a re-typed literal, mints no new scalar.
 *
 * Constraints: CJS, Node built-ins only, zero network, LOCAL only (Part 8).
 * House rule: hyphens only, no em-dashes.
 *
 * License: BSL 1.1.
 */

// ---------- AXIS 1: confidence (hedged vs confident) ----------
// The closed confidence vocabulary. `confident` exists in the vocabulary as the
// value that is DELIBERATELY never emitted -- keeping it named makes the
// hedge-always clamp explicit and greppable. Frozen.
const CONFIDENCE_AXIS = Object.freeze(['hedged', 'confident']);
const HEDGED = 'hedged';
const CONFIDENT = 'confident'; // named for documentation; never emitted.

// ---------- AXIS 2: initiative (ask-first vs act-first) ----------
// The closed initiative vocabulary, read from the confidence SCALAR detent plus
// mode_signals + persona -- fully independent of AXIS 1. Frozen.
const INITIATIVE_AXIS = Object.freeze(['ask_first', 'act_first']);
const ASK_FIRST = 'ask_first';
const ACT_FIRST = 'act_first';

// ---------- The composed modes ----------
// Only the two hedged compositions are reachable; both are SAFE. Frozen.
const ASK_AND_HEDGED = 'ask_and_hedged';
const TELL_AND_HEDGED = 'tell_and_hedged';
const SAFE_MODES = Object.freeze([ASK_AND_HEDGED, TELL_AND_HEDGED]);

// The forbidden quadrant. Defined ONLY as the negative-assertion target for the
// drift test; it is never a return value of resolveDecisionMode by construction.
const FORBIDDEN_MODE = 'tell_and_confident';

// ---------- D-Q4 detents (reuse frozen Shape-F scalars, mint nothing) ----------
// The act/tell line is the frozen Shape-F 0.70 detent, imported live so a future
// re-tune of the Brain floor tracks here automatically (never a duplicated
// literal). Tunable output of the Bruce harness per D-Q4.
const { RECOMMENDED_CONFIDENCE_FLOOR } = require('./navigation-engine.cjs');
const ACT_TELL_DETENT = RECOMMENDED_CONFIDENCE_FLOOR; // == 0.70 (D-Q4)

// The P0-6 hard-override floor (~0.40): below this the confidence is so low that
// the move is forced to ask-first regardless of any act signal. Derived as a
// tunable span BELOW the frozen detent (detent - 0.30), so it tracks the detent
// and introduces no independent frozen gate scalar. Because every sub-0.70
// confidence already resolves to ask-first, this floor changes only the
// RATIONALE (a hard P0-6 override vs an offer-as-question), never the mode.
const P0_6_OVERRIDE_FLOOR = ACT_TELL_DETENT - 0.30; // ~0.40, tunable

/**
 * Resolve the initiative axis (ask_first vs act_first) from the confidence
 * SCALAR + mode_signals + persona. This function NEVER touches the confidence
 * AXIS (hedged/confident) -- that is what makes the two axes orthogonal: the
 * scalar gates the detent, the axis stays clamped elsewhere.
 *
 * @returns {{value: string, rationale: string}}
 */
function resolveInitiative(confidence, requires_judgment, mode_signals, persona) {
  // P0-6 hard overrides -- both force ask-first, independent of everything else.
  if (requires_judgment === true) {
    return { value: ASK_FIRST, rationale: 'p0_6_requires_judgment' };
  }
  if (confidence < P0_6_OVERRIDE_FLOOR) {
    return { value: ASK_FIRST, rationale: 'p0_6_confidence_floor' };
  }
  // Cold start always asks first (mirrors the DirectiveEnvelope GUIDED cold-start
  // rule; a fresh room never leads with an act).
  if (mode_signals.is_cold_start || mode_signals.is_first_material) {
    return { value: ASK_FIRST, rationale: 'cold_start_ask_first' };
  }
  // D-Q4 detent: at/above the frozen 0.70 line, act-and-report is permitted.
  if (confidence >= ACT_TELL_DETENT) {
    // persona is read here purely as annotation -- a peer/expert persona does not
    // change the gate (the detent governs), it only colors the rationale. This
    // keeps initiative a function of the scalar + signals, never of the hedge axis.
    const who = (typeof persona === 'string' && persona) ? persona : 'generic';
    return { value: ACT_FIRST, rationale: 'detent_act_and_report:' + who };
  }
  // Below the detent: offer-as-question (an explicit act signal below the detent
  // still stays an offer -- hedged-always plus below-detent = ask).
  return { value: ASK_FIRST, rationale: 'below_detent_offer_as_question' };
}

/**
 * Resolve the decision mode for a turn. ALWAYS returns a member of SAFE_MODES.
 *
 * The confidence axis is clamped to HEDGED unconditionally (hedging always on,
 * Part 3 / D-Q4). The initiative axis is resolved independently. The two are
 * composed; because the confidence value is always HEDGED, tell_and_confident
 * (FORBIDDEN_MODE) is structurally unreachable.
 *
 * @param {object} input {confidence, mode_signals, persona, requires_judgment}
 * @returns {{mode:string, confidence_axis:string, initiative_axis:string, rationale:string}}
 */
function resolveDecisionMode(input) {
  const inp = (input && typeof input === 'object') ? input : {};
  const confidence = (typeof inp.confidence === 'number' && Number.isFinite(inp.confidence))
    ? inp.confidence : 0;
  const requires_judgment = inp.requires_judgment === true;
  const mode_signals = (inp.mode_signals && typeof inp.mode_signals === 'object')
    ? inp.mode_signals : {};
  const persona = (typeof inp.persona === 'string') ? inp.persona : null;

  // AXIS 1 -- confidence. Hedging is ALWAYS on (Canon Part 3, D-Q4). The emitted
  // value is the const HEDGED and NOTHING else. This single line is what makes
  // FORBIDDEN_MODE (tell_and_confident) unreachable: `confident` is never the
  // value that reaches the composition below. Any inbound "confident intent" on
  // the input is ignored by construction (there is no code path that reads it).
  const confidenceValue = HEDGED; // never CONFIDENT -- the structural guarantee.

  // AXIS 2 -- initiative. Independent of AXIS 1 (uses the scalar, not the axis).
  const initiative = resolveInitiative(confidence, requires_judgment, mode_signals, persona);
  const initiativeValue = initiative.value;

  // Compose. confidenceValue is invariably HEDGED, so the only two reachable
  // outputs are ask_and_hedged and tell_and_hedged -- both in SAFE_MODES.
  const mode = (initiativeValue === ACT_FIRST) ? TELL_AND_HEDGED : ASK_AND_HEDGED;

  return {
    mode,
    confidence_axis: confidenceValue,
    initiative_axis: initiativeValue,
    rationale: initiative.rationale,
  };
}

module.exports = {
  // The two frozen axes.
  CONFIDENCE_AXIS,
  INITIATIVE_AXIS,
  // The composed vocabulary.
  SAFE_MODES,
  FORBIDDEN_MODE,
  // The resolver.
  resolveDecisionMode,
  // Detents (reused frozen Shape-F 0.70 + the derived P0-6 floor) -- exported so
  // the test reads the engine-owned numbers, never a duplicated literal.
  ACT_TELL_DETENT,
  P0_6_OVERRIDE_FLOOR,
  // Test seam (private).
  _test: {
    HEDGED,
    CONFIDENT,
    ASK_FIRST,
    ACT_FIRST,
    resolveInitiative,
    RECOMMENDED_CONFIDENCE_FLOOR,
  },
};
