/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 89-07 Wave 2 -- ReverseSalientAgent persona suffix.
 *
 * Maps Phase 115 USER.md role_blend -> persona-aware F.0 header suffix.
 * 7 canonical role keys + 2 aliases + default fallback.
 *
 * Lex tie-break per Phase 115 D-AMEND-04 (agents/larry-extended.md lines 78-100):
 *   1. Filter to canonical keys with positive numeric weight
 *   2. Sort filtered keys alphabetically
 *   3. Walk in sorted order, keep highest-weight; on ties, alphabetical earlier wins
 *   4. Any error / no canonical match / all-zero weights -> default
 *
 * Editorial copy (SCOPE B Section 6 of 89-07-RESEARCH.md, confidence: LOW):
 *   founder        -> 'shipping risk'
 *   researcher     -> 'evidence gap'
 *   researcher_ind -> 'evidence gap'        (functionally a researcher persona)
 *   founder_grant  -> 'submission risk'     (grant-specific founder)
 *   investor       -> 'thesis fragility'
 *   operator       -> 'execution gap'
 *   mentor         -> 'coaching wedge'
 *   domain_expert  -> 'physical-reality friction'
 *   student        -> 'understanding gap'
 *   default        -> 'lagging component'
 *
 * Wording is tunable post-empathy-audit per RESEARCH Confidence: LOW caveat.
 * Final copy is subject to revision after the beta.4 empathy audit, at which
 * point both this module and any consumer test would be updated together.
 *
 * Pure CJS, zero dependencies, never throws.
 */

'use strict';

// Frozen suffix map. 9 keys + default = 10 entries.
const PERSONA_SUFFIX = Object.freeze({
  founder:        'shipping risk',
  researcher:     'evidence gap',
  researcher_ind: 'evidence gap',
  founder_grant:  'submission risk',
  investor:       'thesis fragility',
  operator:       'execution gap',
  mentor:         'coaching wedge',
  domain_expert:  'physical-reality friction',
  student:        'understanding gap',
  default:        'lagging component',
});

// Frozen canonical key list. Order is alphabetical (matches lex tie-break
// expectation in tests). 9 canonical + 'default' = 10 entries.
const CANONICAL_KEYS = Object.freeze([
  'default',
  'domain_expert',
  'founder',
  'founder_grant',
  'investor',
  'mentor',
  'operator',
  'researcher',
  'researcher_ind',
  'student',
]);

/**
 * Pick the persona suffix string for a USER.md role_blend object.
 *
 * @param {object|null|undefined} roleBlend
 *   { founder?: number, researcher?: number, ... } per Phase 115 schema.
 * @returns {string} One of the PERSONA_SUFFIX values; 'lagging component' on
 *                   any failure / cold-start / empty / all-zero / unknown-key.
 */
function suffixFor(roleBlend) {
  try {
    // Reject non-object, null, undefined, primitives.
    if (roleBlend === null || roleBlend === undefined) return PERSONA_SUFFIX.default;
    if (typeof roleBlend !== 'object') return PERSONA_SUFFIX.default;
    // Arrays pass typeof === 'object' but their numeric-index keys never match
    // CANONICAL_KEYS so they fall through to default. We document this rather
    // than special-case Array.isArray(...) since the filter step handles it.

    const keys = Object.keys(roleBlend);
    if (keys.length === 0) return PERSONA_SUFFIX.default;

    // Canonical-only candidates with positive numeric weight; lex tie-break by
    // walking sorted keys (alphabetical earlier wins on ties because we keep
    // strict > comparison and the earlier key was assigned first).
    const canonicalSorted = keys
      .filter((k) => CANONICAL_KEYS.indexOf(k) !== -1)
      .sort();

    let best = null;
    let bestWeight = 0;
    for (const k of canonicalSorted) {
      const w = roleBlend[k];
      if (typeof w === 'number' && Number.isFinite(w) && w > bestWeight) {
        best = k;
        bestWeight = w;
      }
    }
    if (best === null || bestWeight <= 0) return PERSONA_SUFFIX.default;
    // Reliability fence: if PERSONA_SUFFIX somehow lacks the canonical key
    // (shouldn't be possible since CANONICAL_KEYS and PERSONA_SUFFIX are
    // co-frozen at module load), fall through to default.
    return PERSONA_SUFFIX[best] || PERSONA_SUFFIX.default;
  } catch (_e) {
    return PERSONA_SUFFIX.default;
  }
}

module.exports = {
  suffixFor: suffixFor,
  PERSONA_SUFFIX: PERSONA_SUFFIX,
  CANONICAL_KEYS: CANONICAL_KEYS,
};
