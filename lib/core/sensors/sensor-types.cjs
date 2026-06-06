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
 *   REACH_IDS   -- the 5 stable reach ids (SKILL.md lines ~48-52):
 *     context_block | contradiction | cross_room | brain_consult | deep_research
 *   POSTURE_IDS -- the 3 stable posture ids (SKILL.md lines ~87-89):
 *     push_forward | hold | pull_back
 *
 * The exactly-5 / exactly-3 invariants are drift contracts inherited from
 * Phase 141 (D-05 / D-12); the spine dispatch test fixes them so any add or
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

// The 5 reach ids, in canonical order. Mirrors the row mapping in
// skills/larry-personality/SKILL.md:
//   Context Block row            -> context_block
//   contradiction surface row    -> contradiction
//   cross-room reach row         -> cross_room
//   Brain consult row            -> brain_consult
//   framework-led deep research  -> deep_research
const REACH_IDS = Object.freeze([
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
]);

// The 3 posture ids, in canonical order. Mirrors the Hierarchical Navigator
// movement in SKILL.md (push_forward / hold / pull_back).
const POSTURE_IDS = Object.freeze([
  'push_forward',
  'hold',
  'pull_back',
]);

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
};
