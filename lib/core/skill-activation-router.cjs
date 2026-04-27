#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-03 -- Skill Activation Router (precedence layer over legacy
 * file-state + env activation)
 * =====================================================================
 * Composes navigation-engine.decide() output with the pre-91 (legacy)
 * skill activation set into a single declarative activation decision
 * that the UserPromptSubmit hook embeds into additionalContext.
 *
 * Routing precedence (Canon Part 3 + Canon Part 7):
 *
 *   1. engine.fire_skill is set AND validates as canonical verb
 *      -> source = 'engine'
 *      -> activated_skills = [canonical-cased verb]
 *      -> suppressed_skills = engine.suppress_skills minus the fired verb
 *      -> reason = 'engine_fire_skill_set'
 *
 *   2. engine.fire_skill is null/invalid AND engine.suppress_skills
 *      is non-empty
 *      -> source = 'mixed'
 *      -> activated_skills = legacyActivation minus suppress_skills
 *      -> suppressed_skills = intersection(legacyActivation, suppress_skills)
 *      -> reason = 'engine_suppress_with_legacy'
 *
 *   3. engine is null OR engine.fire_skill is null AND
 *      engine.suppress_skills is empty
 *      -> source = 'legacy'
 *      -> activated_skills = legacyActivation (unchanged)
 *      -> suppressed_skills = []
 *      -> reason = 'engine_silent_or_absent'
 *
 * Canon Part 3 (closed 10-verb vocabulary):
 *   The CANONICAL_VERBS array in lib/core/navigation-engine-shared.cjs is
 *   the single source of truth. Engine outputs MUST map to one of the 10
 *   verbs. Unknown verbs are rejected with a 'canon_part_3_unknown_verb_
 *   rejected' trace note and the router falls through to legacy or mixed
 *   depending on whether suppress_skills is also populated. New verbs
 *   require a canon amendment, NOT a runtime addition.
 *
 * Canon Part 7 (Reuse Before Build):
 *   Legacy file-state + env activation is preserved. This module is a
 *   precedence layer on top, NOT a replacement. When engine returns
 *   { fire_skill: null, suppress_skills: [] } (the silent path), output
 *   is byte-equivalent to pre-91 behavior.
 *
 * Canon Part 8 (Graph Boundary):
 *   Pure local. Zero I/O. Zero network. Zero Brain reads. The router
 *   never queries Brain, never embeds user content in any payload. It
 *   composes two pre-computed inputs into a declarative output.
 *
 * Purity:
 *   - No fs require (verified by Test 28-style audit; this module is
 *     pure-function except the require of navigation-engine-shared for
 *     CANONICAL_VERBS).
 *   - No I/O.
 *   - Never throws on null/non-array inputs (defensive coercion).
 *
 * License: BSL 1.1.
 */

const shared = require('./navigation-engine-shared.cjs');

const CANONICAL_VERBS = shared.CANONICAL_VERBS;

// ---------- Pure helpers ----------

/**
 * validateVerb(verb) -> boolean
 *
 * Returns true if verb maps (case-insensitive) to a CANONICAL_VERBS
 * entry per Canon Part 3. Returns false on null, non-string, empty
 * string, or unknown verb. The router uses this gate to enforce the
 * closed-vocabulary boundary on engine outputs.
 */
function validateVerb(verb) {
  if (verb === null || verb === undefined) return false;
  if (typeof verb !== 'string') return false;
  if (verb.length === 0) return false;
  const lc = verb.toLowerCase();
  for (let i = 0; i < CANONICAL_VERBS.length; i += 1) {
    if (CANONICAL_VERBS[i].toLowerCase() === lc) return true;
  }
  return false;
}

/**
 * canonicalizeVerb(verb) -> string|null
 *
 * Returns the canonical-cased entry from CANONICAL_VERBS that matches
 * verb case-insensitively. Returns null when verb is not a canonical
 * verb. The router calls this to normalize user/engine-supplied casing
 * to the canonical form before emission (Test 12).
 */
function canonicalizeVerb(verb) {
  if (verb === null || verb === undefined) return null;
  if (typeof verb !== 'string') return null;
  const lc = verb.toLowerCase();
  for (let i = 0; i < CANONICAL_VERBS.length; i += 1) {
    if (CANONICAL_VERBS[i].toLowerCase() === lc) return CANONICAL_VERBS[i];
  }
  return null;
}

/**
 * coerceArray(maybeArray) -> Array
 *
 * Defensive coercion. Returns the input when it is an array; returns
 * [] for any other shape (null, undefined, string, object, number).
 * Used for both engine.suppress_skills and legacyActivation inputs.
 */
function coerceArray(maybeArray) {
  if (Array.isArray(maybeArray)) return maybeArray;
  return [];
}

/**
 * intersection(a, b) -> Array
 *
 * Returns elements appearing in both a and b. Preserves a's order.
 * Used to compute suppressed_skills (legacy ∩ engine.suppress_skills)
 * in mixed mode.
 */
function intersection(a, b) {
  const aArr = coerceArray(a);
  const bArr = coerceArray(b);
  if (aArr.length === 0 || bArr.length === 0) return [];
  const bSet = new Set(bArr);
  const out = [];
  for (let i = 0; i < aArr.length; i += 1) {
    if (bSet.has(aArr[i])) out.push(aArr[i]);
  }
  return out;
}

/**
 * difference(a, b) -> Array
 *
 * Returns elements of a not present in b. Preserves a's order. Used to
 * compute activated_skills (legacy minus engine.suppress_skills) in
 * mixed mode and to drop a fired-verb from suppress_skills in the
 * contradictory-decision case.
 */
function difference(a, b) {
  const aArr = coerceArray(a);
  const bArr = coerceArray(b);
  if (bArr.length === 0) return aArr.slice();
  const bSet = new Set(bArr);
  const out = [];
  for (let i = 0; i < aArr.length; i += 1) {
    if (!bSet.has(aArr[i])) out.push(aArr[i]);
  }
  return out;
}

// ---------- Main entry ----------

/**
 * routeActivation(engineDecision, legacyActivation) -> {
 *   activated_skills: string[],
 *   suppressed_skills: string[],
 *   source: 'engine' | 'legacy' | 'mixed',
 *   reason: string,
 *   trace_notes: string[]
 * }
 *
 * Composes engine decision with legacy activation set. See the
 * routing-precedence comment block at the top of this file for the
 * three precedence rules.
 *
 * Pure function. Defensive on inputs (null, non-array, missing fields
 * all coerce to safe defaults; never throws).
 *
 * Inputs:
 *   engineDecision: typed decision from navigation-engine.decide(), OR
 *                   null when the engine timed out / errored / was not
 *                   invoked. May be a partial object; missing fields
 *                   coerce to safe defaults.
 *   legacyActivation: string[] of skill names that the pre-91
 *                     (file-state + env) activation logic determined
 *                     would fire this turn. May be null, non-array,
 *                     or empty.
 *
 * Outputs (always a fresh object; never returns input references):
 *   activated_skills: ordered list of skill names that should fire.
 *   suppressed_skills: ordered list of skill names that should NOT fire
 *                      this turn (informational; consumer Larry uses
 *                      this to know which legacy activations were
 *                      vetoed).
 *   source: 'engine' | 'legacy' | 'mixed' (which path won).
 *   reason: short symbolic reason code.
 *   trace_notes: optional symbolic notes (Canon Part 3 verb rejections,
 *                contradictory decisions resolved, etc) consumed by
 *                /mos:explain-decision.
 */
function routeActivation(engineDecision, legacyActivation) {
  const traceNotes = [];

  // ---- Defensive input coercion ----
  // Capture whether both inputs were nullish so we can flag null_inputs.
  const bothNull =
    (engineDecision === null || engineDecision === undefined) &&
    (legacyActivation === null || legacyActivation === undefined);

  // legacy is always an array internally; non-array shapes coerce to [].
  const legacy = coerceArray(legacyActivation);

  // engine fields read defensively. Missing engine -> treated as silent.
  let fireSkillRaw = null;
  let suppress = [];
  if (engineDecision !== null && typeof engineDecision === 'object') {
    if (engineDecision.fire_skill !== undefined) {
      fireSkillRaw = engineDecision.fire_skill;
    }
    if (Array.isArray(engineDecision.suppress_skills)) {
      suppress = engineDecision.suppress_skills.slice();
    }
  }

  // ---- Precedence Rule 1: engine.fire_skill set + canonical verb ----
  if (fireSkillRaw !== null && fireSkillRaw !== undefined && fireSkillRaw !== '') {
    if (validateVerb(fireSkillRaw)) {
      const canonical = canonicalizeVerb(fireSkillRaw);
      // Resolve contradictory fire-vs-suppress: drop the fired verb
      // from the suppress list so the output is internally consistent.
      let resolvedSuppress = suppress;
      const lcCanonical = canonical.toLowerCase();
      const hadOverlap = suppress.some(function (s) {
        return typeof s === 'string' && s.toLowerCase() === lcCanonical;
      });
      if (hadOverlap) {
        resolvedSuppress = suppress.filter(function (s) {
          return !(typeof s === 'string' && s.toLowerCase() === lcCanonical);
        });
        traceNotes.push('engine_contradictory_fire_vs_suppress_resolved');
      }
      return {
        activated_skills: [canonical],
        suppressed_skills: resolvedSuppress,
        source: 'engine',
        reason: 'engine_fire_skill_set',
        trace_notes: traceNotes,
      };
    }
    // Unknown / non-canonical verb. Reject with trace note and fall
    // through to suppress-only (mixed) or legacy.
    traceNotes.push('canon_part_3_unknown_verb_rejected');
  }

  // ---- Precedence Rule 2: engine silent on fire, but suppresses ----
  if (suppress.length > 0) {
    const activated = difference(legacy, suppress);
    const suppressed = intersection(legacy, suppress);
    return {
      activated_skills: activated,
      suppressed_skills: suppressed,
      source: 'mixed',
      reason: 'engine_suppress_with_legacy',
      trace_notes: traceNotes,
    };
  }

  // ---- Precedence Rule 3: full legacy fallback ----
  return {
    activated_skills: legacy.slice(),
    suppressed_skills: [],
    source: 'legacy',
    reason: bothNull ? 'null_inputs' : 'engine_silent_or_absent',
    trace_notes: traceNotes,
  };
}

module.exports = {
  routeActivation: routeActivation,
  validateVerb: validateVerb,
  canonicalizeVerb: canonicalizeVerb,
  // Internal helpers exposed for test introspection only.
  _intersection: intersection,
  _difference: difference,
  _coerceArray: coerceArray,
};
