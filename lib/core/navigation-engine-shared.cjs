#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-00 -- Navigation Engine shared helpers (pure, zero I/O)
 * ================================================================
 * Frozen constants and pure helper functions that the L5 Navigation
 * Engine (lib/core/navigation-engine.cjs) composes into a structured
 * decision function. Splitting these out keeps the engine entry point
 * thin and lets unit tests exercise the rules without booting a full
 * fixture room.
 *
 * Contract source of truth:
 *   .planning/research/navigation-engine-brain-interface.md (v1, frozen
 *   at Phase 90-09).
 *
 * What this module exports:
 *   STALENESS_MULTIPLIERS  frozen table -- Section 4.1 multiplier rows
 *   CANONICAL_VERBS        frozen 10-entry array -- Canon Part 3 vocabulary
 *   applyStalenessMultiplier(brain) -> number in [0, 1]
 *   resolveTierMode(quadruple, brainAvailable) -> 'mode_a' | 'mode_b' | 'tier_0'
 *   emptyDecision()        decision shell
 *   emptyDecisionTrace()   trace shell with all 8 Section 8 fields
 *
 * Canon Part 8 posture:
 *   This module does ZERO I/O. No fs, no network, no child_process. It
 *   only computes pure functions over already-parsed quadruple structs.
 *   The Brain boundary is irrelevant here because no bytes leave or
 *   enter; all guarding is delegated to the engine entry point.
 *
 * License: BSL 1.1.
 */

// ---------- Frozen constants ----------

/**
 * Section 4.1 staleness multiplier table.
 * Keys are sentinel labels:
 *   'null'                            -- brain === null (BRAIN.md absent)
 *   'fresh'                           -- staleness === 'fresh'
 *   'unavailable'                     -- staleness === 'unavailable'
 *   <stale_reason string>             -- staleness === 'stale' AND
 *                                        stale_reason === <key>
 *
 * Values are the multiplier applied to the BRAIN.md contribution block.
 */
const STALENESS_MULTIPLIERS = Object.freeze({
  null: 0.0,
  fresh: 1.0,
  age_exceeded: 0.7,
  governing_thought_changed: 0.3,
  brain_graph_version_mismatch: 0.5,
  brain_offline: 0.9, // EXEMPT per Section 4.2 (transient network)
  derivation_timeout: 0.2,
  parse_failed: 0.0,
  unavailable: 0.0,
});

/**
 * Canon Part 3 canonical 10-verb vocabulary. Closed set; new verbs
 * require a canon amendment, not a runtime addition.
 */
const CANONICAL_VERBS = Object.freeze([
  'Run Methodology',
  'Reformulate',
  'Spawn Sub-Agent',
  'Navigate Graph',
  "Devil's Advocate",
  'Scenario Plan',
  'Synthesize',
  'Bank Opportunity',
  'Defer',
  'Free-Text',
]);

// The dead weighted-section-score map was removed (Phase 150-04 MEM-07):
// composition stays rule-based per 150-CONTEXT D-03 (implement-or-delete resolved
// to delete). It had no live consumer beyond the dead navigation-engine.cjs
// import; the required/optional section KEY lists below are retained (they are a
// separate contract used elsewhere).
const REQUIRED_SECTION_KEYS = Object.freeze([
  'pattern_matches',
  'framework_chain_predictions',
  'cross_domain_analogies',
  'wicked_indicators',
  'unfilled_opportunity_matches',
  'assessment_thinking_chain_position',
  'problemtype_classification',
]);

const OPTIONAL_SECTION_KEYS = Object.freeze([
  'flagged_contradictions_xroom',
  'hsi_signals',
]);

// ---------- Pure helpers ----------

/**
 * applyStalenessMultiplier(brain) -> number in [0, 1]
 *
 * Resolves the BRAIN.md staleness multiplier per Section 4.1. Never
 * throws; falls back to 0.0 conservatively on any unrecognized shape.
 *
 * Decision order (highest precedence first):
 *   1. brain === null                         -> 0.0
 *   2. brain.parse_failed === true            -> 0.0  (override)
 *   3. brain.staleness === 'unavailable'      -> 0.0
 *   4. brain.staleness === 'fresh'            -> 1.0
 *   5. brain.staleness === 'stale' + known reason -> table lookup
 *   6. unknown shape                          -> 0.0  (conservative)
 */
function applyStalenessMultiplier(brain) {
  if (brain === null || brain === undefined) {
    return STALENESS_MULTIPLIERS.null;
  }
  if (typeof brain !== 'object') {
    return 0.0;
  }
  if (brain.parse_failed === true) {
    return STALENESS_MULTIPLIERS.parse_failed;
  }
  const staleness = brain.staleness;
  if (staleness === 'unavailable') {
    return STALENESS_MULTIPLIERS.unavailable;
  }
  if (staleness === 'fresh') {
    return STALENESS_MULTIPLIERS.fresh;
  }
  if (staleness === 'stale') {
    const reason = brain.stale_reason;
    if (typeof reason === 'string' && Object.prototype.hasOwnProperty.call(STALENESS_MULTIPLIERS, reason)) {
      const m = STALENESS_MULTIPLIERS[reason];
      // Clamp [0, 1] defensively even though all table values are in range.
      if (typeof m === 'number' && m >= 0.0 && m <= 1.0) return m;
      return 0.0;
    }
    // Unknown stale_reason -- fall through to conservative zero.
    return 0.0;
  }
  // Unknown staleness label -- conservative zero.
  return 0.0;
}

/**
 * resolveTierMode(quadruple, brainAvailable) -> 'mode_a' | 'mode_b' | 'tier_0'
 *
 * Implements Section 5 logic exactly. Re-evaluated every turn (no
 * cross-turn caching per Section 5.4).
 *
 * Mode A : brain reachable AND brain non-null AND staleness !== 'unavailable'
 *          AND parse_failed !== true
 * Mode B : brain unreachable AND brain non-null AND
 *          stale_reason === 'brain_offline' (acceptable transient)
 * Tier 0 : brain === null OR parse_failed === true OR
 *          staleness === 'unavailable' OR (any other unreachable shape)
 */
function resolveTierMode(quadruple, brainAvailable) {
  const brain = quadruple && quadruple.brain;
  if (brain === null || brain === undefined) return 'tier_0';
  if (brain.parse_failed === true) return 'tier_0';
  if (brain.staleness === 'unavailable') return 'tier_0';
  if (brainAvailable === true) {
    return 'mode_a';
  }
  // Brain unreachable: only mode_b when offline-exempt. Otherwise tier_0.
  if (brain.stale_reason === 'brain_offline') return 'mode_b';
  return 'tier_0';
}

/**
 * emptyDecisionTrace() -> shell with all 8 Section 8 fields + 5
 * structural fields. Sentinel values:
 *   scalars  -> null
 *   booleans -> false
 *   arrays   -> []
 *   tier_mode -> 'tier_0' (fail-safe default)
 */
function emptyDecisionTrace() {
  return {
    // Section 8 required fields:
    brain_md_version: null,
    brain_md_staleness: 'absent',
    brain_md_stale_reason: null,
    brain_md_weight_applied: 0.0,
    brain_md_recommended_confidence: null,
    brain_md_recommended_marker_rendered: false,
    brain_md_tier_mode: 'tier_0',
    brain_md_sections_consumed: [],
    // Phase 245 (245-05, D-25 / 245-RESEARCH.md F-2): the Brain pattern_matches
    // OBSERVATION. Requirement 1's third fusion input. Default null so the trace
    // shape is stable across every path (tier_0 / legacy / mode_a / mode_b /
    // fault) and a consumer never reads `undefined` where `null` belongs.
    //
    // This is NOT fire_skill and it is NOT decision_grounding. resolveFireSkill's
    // step 3 (the Brain pattern_matches branch) sits BELOW the fired-sensor branch,
    // which returns early, so on a sensor-fires turn -- essentially every observed
    // turn -- the Brain verb never reaches any consumer. These two fields are the
    // independent observation of what Brain suggested, computed regardless of who
    // won the fire_skill race.
    //
    // Part 8: brain_pattern_verb is a member of the frozen CANONICAL_VERBS closed
    // set or null (extractTopCandidateVerb resolves by exact case-insensitive match
    // against that set, so no free prose can ride the trace).
    // brain_pattern_verb_confidence is a bare number or null.
    brain_pattern_verb: null,
    brain_pattern_verb_confidence: null,
    // CASC-02 (Phase 142): the navigated-neighborhood leg. Default null so the
    // trace shape is stable across every path (Tier 0 / legacy / mode_a). When
    // context.roomContext carries a non-empty getNeighborhood-ranked Leg C, decide()
    // replaces this with { ranked: [...] } where each entry is scalars/slugs/scores
    // only (Canon Part 8: never raw bodies). routing_source stays untouched -- the
    // spine NAVIGATES here; the legacy->engine flip is Phase 144 (NAV-01).
    navigated_neighborhood: null,
    // Structural fields (5):
    icm_scope: null,
    sql_signals: null,
    minto_reasoning: null,
    intent_persona: null,
    chosen_rationale: null,
    // Phase 184 (READER-01..04): the decide-time projection OFFER. Default null so
    // the trace shape is stable across every path (Tier 0 / legacy / mode_a / fault).
    // decide() replaces this with the READER result -- ranked LOCAL orchestration-
    // projection capabilities surfaced as Shape F OPTION CONTENT (options carry
    // fires:false; READER is a reader, never a firer). Part 8: machinery metadata
    // scalars/slugs only, derived from a LOCAL file read; never user content.
    projection_offer: null,
  };
}

/**
 * emptyDecision() -> empty decision shell with full empty trace.
 */
function emptyDecision() {
  return {
    fire_skill: null,
    offer_next_step: null,
    suppress_skills: [],
    persona_updates: null,
    decision_trace: emptyDecisionTrace(),
  };
}

// ---------- Exports ----------

module.exports = {
  STALENESS_MULTIPLIERS: STALENESS_MULTIPLIERS,
  CANONICAL_VERBS: CANONICAL_VERBS,
  REQUIRED_SECTION_KEYS: REQUIRED_SECTION_KEYS,
  OPTIONAL_SECTION_KEYS: OPTIONAL_SECTION_KEYS,
  applyStalenessMultiplier: applyStalenessMultiplier,
  resolveTierMode: resolveTierMode,
  emptyDecision: emptyDecision,
  emptyDecisionTrace: emptyDecisionTrace,
};
