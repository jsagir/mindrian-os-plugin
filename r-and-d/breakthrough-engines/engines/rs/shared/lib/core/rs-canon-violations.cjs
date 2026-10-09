/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.4 Plan 01 -- Canon Part 3 closed-vocabulary enforcement.
 *
 * Sibling of rs-egress-violations.cjs (89.2-01) by ANATOMY but
 * SEPARATE module by SEMANTICS. ExternalEgressViolation guards
 * outbound flow to public external fetchers; CanonVerbViolation
 * guards the 10-verb closed vocabulary at the Decision Gate
 * boundary. Sharing the class would conflate two distinct
 * chokepoints. Both classes follow identical anatomy (.name + .meta)
 * so Canon-aware caller wrappers catch them uniformly via err.name.
 *
 * The 10-verb canonical vocabulary is authoritative per
 * docs/MINDRIAN-CANON.md Part 3 lines 153-162. New verbs require
 * canon amendment, not a code-level invention.
 *
 * meta convention (informal, not enforced): callers SHOULD populate
 *   meta.attempted_verb (string)  the verb_string that failed validation
 *   meta.surface        (string)  the call-site tag, e.g. 'navigation-engine'
 * The class itself does not enforce shape so adversarial fixtures can
 * probe edge cases (default meta = {}, omitted meta) without
 * instantiation fighting them.
 *
 * validateVerb contract:
 *   typeof verb_string !== 'string'  -> TypeError ('must be a string')
 *   empty or out-of-set string       -> CanonVerbViolation
 *   in-set string                    -> returns the input verbatim
 *
 * surface argument is optional. When supplied as a non-empty string it
 * propagates to err.meta.surface. When omitted or empty, defaults to
 * the literal 'unknown' so downstream audit log lines always carry a
 * non-empty surface tag (mirrors Phase 89.2 audit-triple convention).
 *
 * CANONICAL_VERBS is Object.freeze'd so accidental mutation throws in
 * strict mode and Object.isFrozen returns true. Downstream consumers
 * (89.5 NL-Graph Surface UI, future Decision Gate renderers) can
 * enumerate the set without defensive copying.
 *
 * Pure CJS, zero npm deps, no Node built-ins beyond core require.
 */
'use strict';

class CanonVerbViolation extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'CanonVerbViolation';
    this.meta = meta || {};
  }
}

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

function validateVerb(verb_string, surface) {
  if (typeof verb_string !== 'string') {
    throw new TypeError(
      'validateVerb: input must be a string; got ' + typeof verb_string
    );
  }
  const surfaceTag = (typeof surface === 'string' && surface.length > 0)
    ? surface
    : 'unknown';
  if (!CANONICAL_VERBS.includes(verb_string)) {
    throw new CanonVerbViolation(
      'verb not in Canon Part 3 closed vocabulary: ' + JSON.stringify(verb_string),
      { attempted_verb: verb_string, surface: surfaceTag }
    );
  }
  return verb_string;
}

module.exports = { CanonVerbViolation, CANONICAL_VERBS, validateVerb };
