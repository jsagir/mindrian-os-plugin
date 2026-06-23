'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SENS-SHOW -- the "show my work" show/present/share-intent detector (Phase 173 R4).
 *
 * Surfaces a context_block candidate reach naming the /mos:show JTBD
 * need-selector front door (commands/show.md, 173-02) when the LOCAL turn shows
 * a show/present/share intent. The selector then asks the navigator their JOB in
 * plain language and resolves it to the right visual/publish command underneath
 * (via the Phase 122 command-resolver + the Phase 166 runChain handoff). This
 * sensor is the "does the navigator want to show their work?" gate -- the trigger
 * IS the discoverability surface (the selector is invokable, not typed-only).
 *
 * D-03 (173-CONTEXT, navigator-LOCKED): the reach is a STANDING SUGGESTION at the
 * Decision Gate (posture 'hold' -- Canon Part 3 GUIDED default, the "no card
 * unprompted" doctrine); it NEVER auto-opens UI. It REUSES the existing
 * context_block reach -- NO 7th reach is minted (mirrors SENS-09 reusing
 * brain_consult; CIRS R3 / Part 3 the 6-reach bank is frozen).
 *
 * FIRES on ANY of (in CANON PART 11 R3 precedence order -- CONTEXT first,
 * keyword DEMOTED to fallback; navigator decision D-03):
 *   1. SIGNAL MODE  -- an explicit 'show_share_intent' signal on the turn (the
 *      strongest tier), OR
 *   2. CONTEXT MODE -- the LOCAL navigator PROBLEM-STATE indicates a show/share
 *      shape: tuple.problem_type matches the generic show/share problem-type
 *      allow-list, OR the navigation.cjs chokepoint populated a problem-state
 *      enum (stage / jtbd / graph_gap). This is the PRIMARY branch (R3 / INV-07):
 *      the trigger keys on problem-state read LOCALLY via the chokepoint
 *      convention, enum/scalar only (Part 8/9), NOT on a keyword scan. OR
 *   3. KEYWORD MODE -- the LOCAL turn text contains a show/share lexicon term
 *      (the DEMOTED fallback tier -- fires ONLY when no problem-state context is
 *      present).
 *
 * CANON PART 8: the sensor reads ONLY LOCAL bytes (the turn text, the diagnose
 * tuple/ctx enums the chokepoint populated) to DECIDE firing; it makes NO Brain
 * call and NO network call. The reach carries ONLY generic handles: dispatch
 * 'show-jtbd-selector' (the WFL-01 / command-resolver handle the orchestrator
 * routes to /mos:show, a selector front door -- NOT a Brain framework, so it does
 * NOT enter data/dispatch-framework-map.json; it resolves through the
 * command-resolver path, keeping tests/test-dispatch-framework-map-drift.cjs
 * green). evidence is a flat scalar/enum bag (the fire MODE enum + the trigger
 * TIER enum + the problem_type enum) -- never the user's matched text. The
 * lexicon terms + the show/share problem-type allow-list are OUR fixed generic
 * vocabulary, never user content.
 *
 * R12 CROSS-SURFACE TRI-POLAR CONTRACT (the documented note):
 *   The AskUserQuestion selector /mos:show renders is IDENTICAL across CLI /
 *   Desktop / Cowork (the host owns the keymap; the phase owns the two axes --
 *   SEED-020, no custom TUI). The rendered RESULTS degrade per the shipped
 *   3-layer model: the inline ui:// views (dashboard / wiki / graph, already
 *   shipped in lib/mcp/app-views.cjs) render where Node cannot run (Desktop /
 *   Cowork); a Node-only result (present / export / snapshot / radar) requested
 *   on Desktop / Cowork surfaces an EXPLICIT degradation note (never a silent
 *   failure) telling the navigator the result is CLI-only. The selector and this
 *   trigger are surface-agnostic; only the result RENDER target differs.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide().
 *
 * Pure / sync / LOCAL-first; soft-fail to null; never throws. node built-ins +
 * sensor-types only. No new deps. House rule: hyphens only, no em-dashes.
 */

const {
  makeReach,
  // Phase 172-07 (R3 / INV-07): the trigger-tier seam. classifyTriggerTier reads
  // the LOCAL problem-state enum (stage / jtbd / graph_gap) off the tuple+ctx the
  // navigation.cjs chokepoint populated, applying the context-first /
  // keyword-fallback precedence. Adds NO filesystem / Brain read.
  classifyTriggerTier,
} = require('./sensor-types.cjs');

/**
 * The show/share lexicon. OUR fixed generic vocabulary -- the words that mean
 * "the navigator wants to show / present / share / publish their work". Generic
 * handles, NOT user content. A LOCAL turn-text hit on any term means "this looks
 * like a show-my-work intent" and surfaces the /mos:show selector.
 */
const SHOW_SHARE_LEXICON = [
  'show', 'present', 'share', 'send a link', 'pitch', 'make it land',
  'publish', 'visualize', 'visualise',
];

/**
 * The show/share PROBLEM-TYPE allow-list. OUR fixed generic vocabulary of the
 * /mos:diagnose problem_type enum values that denote a show/present/share shape.
 * A tuple.problem_type hit on any of these means the NAVIGATOR PROBLEM-STATE --
 * not a keyword in the prose -- says "this is a show-my-work moment," so the
 * CONTEXT branch fires (R3 primary). Generic enum handles, NEVER user content.
 */
const SHOW_SHARE_PROBLEM_TYPES = [
  'show', 'present', 'share', 'publish', 'visualize', 'communicate',
  'show-work', 'show_work', 'present-deck', 'present_deck',
];

/**
 * SIGNAL MODE -- true if the turn carries an explicit 'show_share_intent' signal
 * (string or { kind }). Defensive; never throws.
 */
function hasShowShareSignal(turn) {
  if (!turn || typeof turn !== 'object') return false;
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    const kind = (typeof s === 'string') ? s : (s && typeof s === 'object' ? s.kind : '');
    if (kind === 'show_share_intent') return true;
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
  for (const term of SHOW_SHARE_LEXICON) {
    if (text.indexOf(term) !== -1) return term;
  }
  return '';
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
 * a SHOW/SHARE shape specifically: tuple.problem_type (the enum the
 * navigation.cjs chokepoint surfaces onto the diagnose tuple) is in OUR generic
 * show/share problem-type allow-list. This is the PRIMARY trigger (R3):
 * SENS-SHOW keys on the problem-state, not on a keyword scan. enum/scalar only
 * (Part 8/9); a pure projection of the value already in hand -- NO filesystem /
 * Brain read.
 *
 * (The broader Plan-07 tiering seam -- classifyTriggerTier -- is used to LABEL
 * the tier enum recorded in evidence, so "context first, keyword fallback" is a
 * recorded, testable property; it does NOT itself widen what SENS-SHOW fires on,
 * keeping the keyword fallback genuinely reachable on a bare show/share-lexicon
 * turn that carries no show/share problem-state.)
 */
function hasShowShareContext(tuple) {
  const pt = (tuple && typeof tuple === 'object' && typeof tuple.problem_type === 'string')
    ? tuple.problem_type.toLowerCase() : '';
  return !!pt && SHOW_SHARE_PROBLEM_TYPES.indexOf(pt) !== -1;
}

/**
 * SENS-SHOW -- show/present/share intent -> the /mos:show JTBD need-selector.
 *
 * @param {object} turn  -- normalized turn ({ text, signals })
 * @param {object} tuple -- /mos:diagnose tuple { problem_type }
 * @param {object} ctx   -- LOCAL context ({ roomDir })
 * @returns {Readonly<object>|null}
 */
function sensorShowShare(turn, tuple, ctx) {
  // R3 precedence (Canon Part 11): CONTEXT first, keyword DEMOTED to fallback.
  //   signal  -- strongest (explicit show_share_intent signal on the turn)
  //   context -- the PRIMARY branch: the LOCAL navigator problem-state
  //   keyword -- the FALLBACK (fires only when no problem-state context present)
  let mode = '';
  if (hasShowShareSignal(turn)) {
    mode = 'signal';
  } else if (hasShowShareContext(tuple)) {
    mode = 'context';
  } else if (textMatchesLexicon(turn)) {
    mode = 'keyword';
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
    // REUSE the existing context_block reach -- mint NO 7th reach (D-03; mirrors
    // SENS-09 reusing brain_consult). The 6-reach bank stays frozen.
    reach_id: 'context_block',
    // A STANDING SUGGESTION at the Decision Gate -- NEVER push_forward; it must
    // NOT auto-open UI (Canon Part 3 GUIDED default + the "no card unprompted"
    // doctrine, D-03).
    posture: 'hold',
    // Generic handle: the /mos:show selector front-door token. The orchestrator
    // routes 'show-jtbd-selector' to /mos:show through the command-resolver path
    // (a selector front door, NOT a Brain framework -- so it does not enter
    // data/dispatch-framework-map.json, keeping its drift test green).
    dispatch: 'show-jtbd-selector',
    signal: 'show_share_intent',
    // LOCAL scalars / enums ONLY: the fire MODE enum + the trigger TIER enum +
    // the problem_type enum. Never the user's matched text (Part 8).
    evidence: { mode: mode, trigger_tier: trigger_tier, problem_type: pt },
  });
}

module.exports = {
  sensorShowShare: sensorShowShare,
  SHOW_SHARE_LEXICON: SHOW_SHARE_LEXICON,
  SHOW_SHARE_PROBLEM_TYPES: SHOW_SHARE_PROBLEM_TYPES,
};
