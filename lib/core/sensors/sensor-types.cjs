'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143-01 Task 1 -- the candidate-reach struct contract + the id banks
 * every sensor detector shares.
 *
 * This module makes the committed Phase 141 dial doctrine
 * (skills/larry-personality/SKILL.md, LARRY-03 / D-12) machine-readable:
 *
 *   REACH_IDS   -- the 6 stable reach ids (SKILL.md lines ~48-52):
 *     context_block | contradiction | cross_room | brain_consult | deep_research | hats
 *     (the Hats reach: confirm-gated research-personas hat-spin -- Phase 148 D-09)
 *   POSTURE_IDS -- the 3 stable posture ids (SKILL.md lines ~87-89):
 *     push_forward | hold | pull_back
 *
 * The exactly-6 / exactly-3 invariants are drift contracts inherited from
 * Phase 141 (D-05 / D-12) and amended in Phase 148 (D-09, the constitutional
 * 6th-reach lockstep); the spine dispatch test fixes them so any add or
 * remove fails CI.
 *
 * The candidate-reach struct is the pure data shape a sensor returns when it
 * fires (or null when it does not). It carries ONLY generic handles + LOCAL
 * scalars -- never user content (Canon Part 8). Brain-touching companions
 * (e.g. brain_framework_chain) carry only the problem_type enum.
 *
 * Pure, zero-I/O, sync. No network, no filesystem, no require of any
 * Brain/packet egress surface. House rule: hyphens only, no em-dashes.
 */

// ---------- The id banks (committed dial doctrine, frozen) ----------

// The 6 reach ids, in canonical order. Mirrors the row mapping in
// skills/larry-personality/SKILL.md:
//   Context Block row            -> context_block
//   contradiction surface row    -> contradiction
//   cross-room reach row         -> cross_room
//   Brain consult row            -> brain_consult
//   framework-led deep research  -> deep_research
//   Hats reach (Phase 148 D-09)  -> hats
//     the confirm-gated research-personas hat-spin: a REAL 6th machine reach,
//     no longer a render-label sub_mode under brain_consult.
const REACH_IDS = Object.freeze([
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
  'hats',
]);

// The 3 posture ids, in canonical order. Mirrors the Hierarchical Navigator
// movement in SKILL.md (push_forward / hold / pull_back).
const POSTURE_IDS = Object.freeze([
  'push_forward',
  'hold',
  'pull_back',
]);

// ---------- Phase 172-07: the trigger TIER model (R3 / INV-07) ----------
//
// Canon Part 11 R3: a trigger keys on navigator PROBLEM-STATE (stage / JTBD /
// graph-gap) read LOCALLY via the navigation.cjs chokepoint (enum/scalar only,
// Part 8/9); keyword/lexicon match is a FALLBACK tier, not the basis. This is
// the closed, ORDERED tier vocabulary -- the order IS the precedence doctrine:
//   signal   -- an explicit problem-state signal kind on the turn (strongest).
//   context  -- a LOCAL navigator problem-state enum (stage / jtbd / graph_gap)
//               present on the tuple+ctx the navigation.cjs chokepoint populated.
//   content  -- Phase 244: lexical relevance to LOCAL stored material, bm25-
//               ranked against the room's own corpus (eureka_fts). Content is
//               NOT navigator problem-state, so R3 forbids ranking it as
//               context-tier; it IS corpus-relative evidence rather than a
//               hand-picked private word list, so it ranks above keyword.
//   keyword  -- only a keyword/lexicon match in the turn text (the FALLBACK).
// A sensor that records a `mode` enum (the sensor-diffusion-adoption precedent)
// MUST draw it from this set, so the demotion of keyword to fallback is legible
// in the evidence object. Mints NO reach and NO edge -- it is a classifier only.
const TRIGGER_TIERS = Object.freeze([
  'signal',
  'context',
  'content',   // Phase 244: lexical relevance to LOCAL stored material (bm25)
  'keyword',
]);

// The closed set of LOCAL problem-state enum fields a context-tier trigger may
// read. Each is an ENUM/scalar handle (stage label / jtbd slug / graph-gap kind)
// that the navigation.cjs chokepoint surfaces onto the diagnose tuple or the
// LOCAL ctx -- NEVER the user's prose (Part 8). This list is the read allow-list
// so a future field cannot silently smuggle user content into the tier read.
const PROBLEM_STATE_FIELDS = Object.freeze([
  'stage',       // tuple.stage / ctx.venture_stage (the journey/definition stage)
  'jtbd',        // ctx.jtbd (the active Jobs-to-be-Done slug)
  'graph_gap',   // ctx.graph_gap (the LOCAL navigation gap kind, e.g. thin-evidence)
]);

/**
 * Read the LOCAL navigator problem-state as a flat ENUM/scalar bag, drawn ONLY
 * from PROBLEM_STATE_FIELDS over the diagnose tuple + LOCAL ctx (both populated
 * by the navigation.cjs chokepoint upstream -- this helper adds NO filesystem or
 * Brain read; it is a pure projection of values already in hand). Returns enum
 * strings only; a field absent or non-string is omitted (never user content).
 *
 *   stage     <- tuple.stage || ctx.venture_stage || ctx.stage
 *   jtbd      <- ctx.jtbd || tuple.jtbd
 *   graph_gap <- ctx.graph_gap || tuple.graph_gap
 *
 * @param {object} turn  -- the normalized turn (unused for the read; kept for symmetry)
 * @param {object} tuple -- the /mos:diagnose tuple { problem_type, stage, ... }
 * @param {object} ctx   -- LOCAL context ({ venture_stage, jtbd, graph_gap })
 * @returns {object} a flat { stage?, jtbd?, graph_gap? } enum bag (possibly empty)
 */
function readProblemStateEnum(turn, tuple, ctx) {
  const t = (tuple && typeof tuple === 'object') ? tuple : {};
  const c = (ctx && typeof ctx === 'object') ? ctx : {};
  const out = {};

  const stage = (typeof t.stage === 'string' && t.stage) ? t.stage
    : (typeof c.venture_stage === 'string' && c.venture_stage) ? c.venture_stage
    : (typeof c.stage === 'string' && c.stage) ? c.stage
    : '';
  const jtbd = (typeof c.jtbd === 'string' && c.jtbd) ? c.jtbd
    : (typeof t.jtbd === 'string' && t.jtbd) ? t.jtbd
    : '';
  const graphGap = (typeof c.graph_gap === 'string' && c.graph_gap) ? c.graph_gap
    : (typeof t.graph_gap === 'string' && t.graph_gap) ? t.graph_gap
    : '';

  if (stage) out.stage = stage;
  if (jtbd) out.jtbd = jtbd;
  if (graphGap) out.graph_gap = graphGap;
  return out;
}

/**
 * True if the turn carries an explicit problem-state SIGNAL kind. A turn is
 * { signals: [...] } where each signal is a string kind or { kind }. The closed
 * signal-kind set that denotes a problem-state advance is small and generic.
 * Defensive; never throws.
 */
function hasProblemStateSignal(turn) {
  if (!turn || typeof turn !== 'object') return false;
  const PS_SIGNAL_KINDS = ['problem_state_changed', 'stage_advanced', 'jtbd_set', 'graph_gap_detected'];
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    const kind = (typeof s === 'string') ? s : (s && typeof s === 'object' ? s.kind : '');
    if (PS_SIGNAL_KINDS.indexOf(kind) !== -1) return true;
  }
  return false;
}

/**
 * True if the turn text is a non-empty string (the precondition for a keyword
 * FALLBACK match to be possible at all). This classifier does NOT itself run a
 * lexicon -- each sensor owns its own vocabulary; this just reports whether the
 * keyword TIER is the highest tier available when no problem-state is present.
 */
function hasKeywordSurface(turn) {
  const text = (turn && typeof turn === 'object' && typeof turn.text === 'string') ? turn.text : '';
  return text.length > 0;
}

/**
 * Classify the trigger TIER for a turn, applying the R3 precedence: a present
 * problem-state SIGNAL or a present LOCAL problem-state ENUM is the CONTEXT tier
 * (preferred); a bare keyword surface is the KEYWORD fallback tier; absent all,
 * returns null (nothing to trigger on). This is the seam that makes "context
 * first, keyword fallback" a recorded, testable property rather than a comment.
 *
 *   signal kind present                 -> 'signal'  (a context-tier member)
 *   problem-state enum present          -> 'context'
 *   only a keyword surface present      -> 'keyword' (the FALLBACK)
 *   nothing                             -> null
 *
 * NOTE: 'signal' and 'context' are BOTH context-tier (both rank above keyword).
 * Phase 244 ADDED a fourth tier, 'content', ranked between 'context' and
 * 'keyword'. The binary idiom this comment used to recommend,
 * `classifyTriggerTier(...) === 'keyword'` (fallback) against anything else,
 * is NOW WRONG: 'content' is "anything else" and would be silently promoted
 * to context-tier by any caller still following that advice. Use the two
 * correct predicates instead: `isContextTier(tier)` (true for signal/context)
 * and `isFallbackTier(tier)` (true for content/keyword). The bare
 * `=== 'keyword'` comparison is no longer a safe fallback test.
 *
 * @returns {string|null} one of TRIGGER_TIERS, or null
 */
function classifyTriggerTier(turn, tuple, ctx) {
  if (hasProblemStateSignal(turn)) return 'signal';
  const ps = readProblemStateEnum(turn, tuple, ctx);
  if (Object.keys(ps).length > 0) return 'context';
  if (hasKeywordSurface(turn)) return 'keyword';
  return null;
}

/**
 * True when the classified tier is a CONTEXT tier (signal or context), i.e. the
 * trigger is keying on problem-state rather than falling back to keyword. The
 * one-line predicate sensors use to PREFER the context signal over keyword.
 */
function isContextTier(tier) {
  return tier === 'signal' || tier === 'context';
}

/**
 * True when the classified tier is a FALLBACK tier (content or keyword), i.e.
 * the trigger is NOT keying on navigator problem-state. Phase 244 companion
 * to isContextTier: both predicates are EXPLICIT allowlists, mutually
 * exclusive, and their union covers every member of TRIGGER_TIERS. This is
 * deliberately NOT implemented as `!isContextTier(tier)` -- a negated form
 * would silently absorb any future fifth tier, which is the exact failure
 * mode this predicate exists to repair (the doctrine-rot the amended NOTE
 * above describes).
 */
function isFallbackTier(tier) {
  return tier === 'content' || tier === 'keyword';
}

// ---------- makeReach: the pure candidate-reach factory ----------

/**
 * Build a frozen candidate-reach struct, validating reach_id + posture against
 * the committed banks. Returns null (never throws) on any invalid input.
 *
 * Struct shape:
 *   {
 *     reach_id   : one of REACH_IDS
 *     posture    : one of POSTURE_IDS
 *     dispatch   : the /mos: command slug or shipped-engine handle to fire
 *     companions : array of additional GENERIC handles (e.g. the
 *                  brain_framework_chain:<problem_type> handle) -- never user content
 *     signal     : the signal kind that fired the sensor
 *     evidence   : LOCAL scalars only (counts, enums, ids) -- never user bytes
 *   }
 *
 * @param {object} opts
 * @returns {Readonly<object>|null}
 */
function makeReach(opts) {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return null;

  const reach_id = opts.reach_id;
  const posture = opts.posture;

  if (REACH_IDS.indexOf(reach_id) === -1) return null;
  if (POSTURE_IDS.indexOf(posture) === -1) return null;

  const dispatch = typeof opts.dispatch === 'string' ? opts.dispatch : '';
  const signal = typeof opts.signal === 'string' ? opts.signal : '';

  // companions: array of generic-handle strings only. Anything non-string is
  // dropped (defensive -- the struct must never carry arbitrary objects that
  // could smuggle user content past the Part-8 sweep).
  const companions = Array.isArray(opts.companions)
    ? opts.companions.filter(function (c) { return typeof c === 'string'; })
    : [];

  // evidence: LOCAL scalars only. We freeze a shallow copy of primitive values.
  // Non-primitive values are dropped so the struct stays a flat scalar bag.
  const evidence = {};
  if (opts.evidence && typeof opts.evidence === 'object' && !Array.isArray(opts.evidence)) {
    for (const k of Object.keys(opts.evidence)) {
      const v = opts.evidence[k];
      const t = typeof v;
      if (t === 'string' || t === 'number' || t === 'boolean') {
        evidence[k] = v;
      }
    }
  }

  return Object.freeze({
    reach_id: reach_id,
    posture: posture,
    dispatch: dispatch,
    companions: Object.freeze(companions),
    signal: signal,
    evidence: Object.freeze(evidence),
  });
}

module.exports = {
  REACH_IDS: REACH_IDS,
  POSTURE_IDS: POSTURE_IDS,
  makeReach: makeReach,
  // Phase 172-07: the trigger-tier model (R3 / INV-07 -- context first, keyword
  // fallback). Pure classifiers + the closed ordered tier vocabulary + the
  // LOCAL problem-state enum read (enum/scalar only, Part 8).
  TRIGGER_TIERS: TRIGGER_TIERS,
  PROBLEM_STATE_FIELDS: PROBLEM_STATE_FIELDS,
  readProblemStateEnum: readProblemStateEnum,
  classifyTriggerTier: classifyTriggerTier,
  isContextTier: isContextTier,
  // Phase 244: the fallback-tier allowlist companion to isContextTier.
  isFallbackTier: isFallbackTier,
  hasProblemStateSignal: hasProblemStateSignal,
};
