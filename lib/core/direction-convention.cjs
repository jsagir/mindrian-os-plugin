/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 01 Task 2 (HIPS-01, D-01, D-02). This is the ONE module
 * that owns the wording-difference direction rule for every cross-domain
 * finding MindrianOS shows a user (eureka, find-connections,
 * find-bottlenecks, HSI, whitespace).
 *
 * SOURCE: .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-ORIGIN-CONCEPT.md
 * section 3, "Read against the two notes filed today". The 2025 origin
 * deck (Algorithmic Generation of Reverse Salient Solutions) measures two
 * similarities per pair -- a shallow, word-co-occurrence measure (LSA) and
 * a deep, whole-text-meaning measure (semantic/BERT) -- and reports the
 * pairs where the two measures disagree the most. The deck itself never
 * named which disagreement direction means what; 355-ORIGIN-CONCEPT.md
 * section 3 derives the two directions from the deck's own semantics:
 *
 *   deep high, shallow low  -- same meaning, different words (the vocabulary
 *     bridge: two fields describing one structure with disjoint terms).
 *   shallow high, deep low  -- same words, different meaning (the false
 *     friend, e.g. "automobile means something else in biology").
 *
 * CONVENTION A (this module's convention, matching lib/core/rs-math.cjs:
 * 29-31, :401 exactly, which the deck's own semantics already agree with --
 * see 355-CONTEXT.md D-02):
 *
 *   signed_diff = semantic - lsa
 *   signed_diff > 0  -> structural_transfer      (same meaning, different words)
 *   signed_diff <= 0 -> semantic_implementation  (same words, different meaning)
 *
 * D-01 (wire ids unchanged): the two exported direction ids stay
 * `structural_transfer` / `semantic_implementation` exactly as already
 * wired through 65 files, the `eureka_critic` zod enum
 * (lib/mcp/tool-router.cjs) and the SEED-014 Brain-lift contract. Renaming
 * them would break stored room labels into unknown values. Only the
 * DEFINITION moves to this one module; nothing downstream is renamed.
 *
 * TIE RULE (D-02, locked): an exact tie (signed_diff === 0, equivalently
 * classify(x, x) for any finite x) buckets into semantic_implementation via
 * the `> 0` / else branch, matching lib/core/rs-math.cjs:401-403's
 * classifyDirection and keeping tests/272-direction-convention.test.cjs
 * green. Do not add a third branch for the zero case -- rs-math.cjs:395-400
 * forbids it, because a third finite-value branch would change the ported
 * Python behavior this module's sibling already pins.
 *
 * NONE SENTINEL: classify()/classifyDiff() return 'none' whenever either
 * input is null, undefined, or not a finite number after Number()
 * coercion (NaN, Infinity, non-numeric strings). NONE_MEANING is the D-49
 * phrase for a finding with no word-versus-meaning measurement at all
 * (whitespace zones, find-connections Brain concepts -- producers with no
 * (lsa, semantic) pair to compare).
 *
 * lib/core/hsi-lsa.cjs owns a DIFFERENT algorithm (Convention B: cosine
 * similarity directly on the SVD-reduced matrix, opposite sign bucketing
 * on differently-named quantities) and MUST NOT be unified with this
 * module -- see hsi-lsa.cjs:1-20 and 272-PATTERNS.md convention 8. This
 * module defines Convention A's LABEL RULE only; it does not compute lsa
 * or semantic itself, and it protects neither rs-math.cjs's nor
 * hsi-lsa.cjs's own algorithm, only the comparison-to-label step.
 *
 * Zod-free, requires nothing but node:crypto, so the hook-path sensor
 * chain can import it without a load-time throw (T-355-05).
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */
'use strict';

const crypto = require('node:crypto');

// The two wire ids, frozen (D-01: never rename).
const DIRECTIONS = Object.freeze(['structural_transfer', 'semantic_implementation']);

// The sentinel for "no wording signal measured" -- producers with no
// (lsa, semantic) pair to compare (whitespace zones, find-connections Brain
// concepts) render this instead of a direction.
const NONE = 'none';
const NONE_MEANING = 'no wording signal measured';

// The two confirmed phrases (355-CONTEXT.md <specifics>, the PWS author
// confirms these in plan 355-02; this plan ships the gist per D-02 ahead of
// that confirmation, in the exact wording the specifics block already
// pins).
const DIRECTION_MEANING = Object.freeze({
  structural_transfer: 'same meaning in different words',
  semantic_implementation: 'same words with different meaning',
});

/*
 * classifyDiff(signedDiff): the ONLY place in the repo the
 * comparison-to-label rule lives. Mirrors rs-math.cjs:401-403's
 * classifyDirection exactly:
 *   signed_diff > 0  -> 'structural_transfer'
 *   signed_diff <= 0 -> 'semantic_implementation' (includes exactly 0.0)
 * null / undefined / non-finite -> NONE.
 */
function classifyDiff(signedDiff) {
  if (signedDiff === null || signedDiff === undefined) return NONE;
  const d = Number(signedDiff);
  if (!Number.isFinite(d)) return NONE;
  return d > 0 ? 'structural_transfer' : 'semantic_implementation';
}

/*
 * classify(lsa, semantic): the two-value entry point most producers call.
 * null / undefined on either side, or a non-finite Number() coercion on
 * either side (NaN, Infinity, a non-numeric string), returns NONE. A
 * numeric string coerces (matches rs-math.cjs's Number() handling of its
 * own signed_diff input). Otherwise defers to classifyDiff(semantic - lsa)
 * so the tie/none rules live in exactly one function.
 */
function classify(lsa, semantic) {
  if (lsa === null || lsa === undefined || semantic === null || semantic === undefined) return NONE;
  const l = Number(lsa);
  const s = Number(semantic);
  if (!Number.isFinite(l) || !Number.isFinite(s)) return NONE;
  return classifyDiff(s - l);
}

/*
 * phraseHash(): a 64-char hex sha256 of the frozen phrase table
 * (JSON.stringify({DIRECTIONS, DIRECTION_MEANING, NONE_MEANING})), so a
 * later change to any phrase is detectable by a changed hash rather than a
 * silent drift.
 */
function phraseHash() {
  const payload = JSON.stringify({ DIRECTIONS, DIRECTION_MEANING, NONE_MEANING });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/*
 * PHRASES_CONFIRMED (Phase 355-02, PWS author ruling 2026-09-23, D-35 step 2,
 * AI-SPEC D17): the PWS author confirmed all three phrases exactly as shipped
 * by plan 355-01 -- no replacement wording, DIRECTION_MEANING and
 * NONE_MEANING stayed byte-identical. `by` names a role, never a person
 * (repo naming rule). `phrase_hash` is the phraseHash() value at the moment
 * of the ruling; the equality check in tests/test-355-direction-convention.cjs
 * (`PHRASES_CONFIRMED.phrase_hash === phraseHash()`) means any later edit to
 * a phrase without a fresh ruling fails the test (D-35: "if the phrases
 * change after judging, direction_ok labels are re-run"). Full record:
 * .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-PHRASE-CONFIRMATION.md
 */
const PHRASES_CONFIRMED = Object.freeze({
  by: 'pws-author',
  at: '2026-09-23',
  phrase_hash: 'fba76597996550770774995f22602eb220054e2615a4d6e77212c01bc09cfe16',
});

module.exports = {
  classify,
  classifyDiff,
  DIRECTIONS,
  DIRECTION_MEANING,
  NONE,
  NONE_MEANING,
  phraseHash,
  PHRASES_CONFIRMED,
};
