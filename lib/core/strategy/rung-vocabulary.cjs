'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-01 Task 2 -- the ONE home for the persisted problem-type rung
 * vocabulary and its mapping to the Part 8 egress-guard ladder enum.
 * layer: graph
 *
 * WHY THIS FILE EXISTS AT ALL (STRAT-03, 345-ICM-CONSULT R6 BLOCKING).
 * Phase 345 persists a problem-type rung for the first time in this repo's
 * history (a `goal.rung` field on `<roomDir>/.mindrian/jtbd-state.json`,
 * plan 02). Three rung vocabularies already coexist in code and a fourth,
 * incompatible model lives in prose. Persisting a value without declaring
 * which vocabulary it is in ships a stored fact with four descriptions of
 * what it means. This module makes that impossible: it names the PERSISTED
 * vocabulary, the WIRE vocabulary, and the one mapping between them, and it
 * is the only file in the repo allowed to answer that question.
 *
 * FOUR THINGS THIS HEADER STATES, and nothing else needs saying:
 *
 * 1. THE PERSISTED VOCABULARY IS THEO'S FOUR RUNG IDS: Wicked, UnDefined,
 *    WellDefined, IllDefined. The reason is that
 *    `lib/core/brain-client.cjs::_inferRungFromQuestion` is this repo's ONLY
 *    classifier of a free-text question into a problem-type rung
 *    (`brain-client.cjs:1150-1200`), and those four strings, in that fixed
 *    precedence order, are the complete set it returns. `THEO_RUNGS` below
 *    exists to state that fact as a frozen, importable constant rather than
 *    a comment a future reader has to trust.
 *
 * 2. THE WIRE VOCABULARY IS THE EGRESS GUARD'S LOWERCASE LADDER ENUM, and it
 *    is reached ONLY through `toLadderRung`. `lib/core/part8-egress-guard.cjs`
 *    declares `TAXONOMY_RUNGS = {'undefined', 'ill-defined', 'well-defined',
 *    'wicked'}` (`part8-egress-guard.cjs:328`) as the closed set its own
 *    `taxonomy_ladder` known-shape proof accepts (`:436-447`). A caller that
 *    hands the guard a Theo-cased rung string (`'IllDefined'`) fails the
 *    exact-match check silently and falls through to the terminal
 *    ambiguous catch-all, which PROCEEDS with a disclosure rather than
 *    blocking (345-RESEARCH Pitfall 4). `toLadderRung` is the one place that
 *    conversion happens, so it happens correctly or not at all.
 *
 * 3. THE THIRD LIVE VOCABULARY, `RECOMMEND_CHAIN_PROBLEM_TYPES` at
 *    `part8-egress-guard.cjs:335-338`, IS A CUTOVER UNION FOR A DIFFERENT
 *    TOOL (`recommend_chain`'s `problem_type` argument, live during the
 *    Brain-to-Theo cutover soak) AND IS DELIBERATELY NOT USED HERE. It
 *    accepts both the incumbent's canonical rung names ('Undefined Problem',
 *    'Ill-Defined Problem', 'Well-Defined Problem') and Theo's own ids as a
 *    convenience union for one call site; it is not a general-purpose rung
 *    vocabulary and this module does not read it, export it, or map through
 *    it.
 *
 * 4. `templates/room-skeleton/section-contracts/problem-definition.md`
 *    PROCESS STEP 2 CURRENTLY DESCRIBES A THREE-RUNG LADDER WITH WICKED AS A
 *    SCORE-TRIGGERED ESCALATION, which contradicts all three code
 *    vocabularies above (a fourth, incompatible model, per
 *    345-ICM-CONSULT R6). Persisting a `goal.rung` value against the
 *    four-rung code model while that contract still describes a three-rung
 *    escalation model is a live contradiction the moment the first room
 *    ratifies a goal. Plan 08 corrects that prose; this module does not
 *    touch it.
 *
 * REUSE BEFORE BUILD (Canon Part 7): this file does NOT require
 * `brain-client.cjs`. `brainClient` is a heavy module with a Brain wire
 * door (`callTool`), and the only coupling this file needs to it is an
 * assertion that `THEO_RUNGS` matches the classifier's return set -- that
 * assertion belongs in the TEST (tests/test-345-rung-mapping.cjs), not as a
 * runtime import here. Requiring brain-client.cjs from a pure vocabulary
 * module would also trip the sensors routing-fence idiom this family
 * otherwise follows (lib/core/sensors/*.cjs never requires
 * navigation-engine.cjs for the same reason: a leaf module stays a leaf).
 *
 * CANON PART 8: every export here is a closed-enum handle or a pure mapping
 * function over closed enums. Nothing in this file reads room content,
 * writes anything, or makes a network call.
 *
 * Pure CJS. node built-ins only. Zero new deps (the Phase 87 invariant).
 * No default export, no class.
 * House rule: hyphens only, no em-dashes.
 */

// ---------------------------------------------------------------------------
// PERSISTED_VOCABULARY: a grep for which vocabulary is stored has exactly
// one hit in lib/. This literal is that hit.
// ---------------------------------------------------------------------------
const PERSISTED_VOCABULARY = 'theo_rung_ids';

// ---------------------------------------------------------------------------
// THEO_RUNGS: the frozen four-member array, fixed precedence order, equal to
// the complete return set of brainClient._inferRungFromQuestion
// (brain-client.cjs:1184). Precedence order matches _RUNG_MARKERS
// (brain-client.cjs:1170-1175) verbatim: Wicked wins outright (the
// orthogonal stakeholder-conflict axis), then UnDefined, then WellDefined,
// then IllDefined (the broadest, and the classifier's own default).
// ---------------------------------------------------------------------------
const THEO_RUNGS = Object.freeze(['Wicked', 'UnDefined', 'WellDefined', 'IllDefined']);

// ---------------------------------------------------------------------------
// LADDER_RUNG_BY_THEO_ID: the ONE mapping from the PERSISTED vocabulary to
// the WIRE vocabulary. Every value here is a member of
// part8-egress-guard.cjs's own TAXONOMY_RUNGS set; the test asserts this
// bidirectionally (no leftovers in either direction).
// ---------------------------------------------------------------------------
const LADDER_RUNG_BY_THEO_ID = Object.freeze({
  Wicked: 'wicked',
  UnDefined: 'undefined',
  WellDefined: 'well-defined',
  IllDefined: 'ill-defined',
});

/**
 * isTheoRung(value) -> boolean
 *
 * True only for one of the four exact, correctly-cased Theo rung id strings.
 * A lowercase or ladder-vocabulary string (e.g. 'ill-defined') is a
 * different vocabulary and returns false, on purpose (Pitfall 4: the two
 * vocabularies must never be treated as interchangeable). Never throws on
 * any input, including null/undefined/non-string.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isTheoRung(value) {
  if (typeof value !== 'string') return false;
  return THEO_RUNGS.indexOf(value) !== -1;
}

/**
 * toLadderRung(theoRung) -> one of the four TAXONOMY_RUNGS members, or null.
 *
 * Fail closed, never guess: an unrecognized input (including a
 * WIRE-vocabulary string handed in by mistake, or any non-Theo-rung value)
 * returns null rather than a best-effort guess. This is the ONLY function in
 * the repo permitted to convert a PERSISTED rung id into a WIRE rung id.
 *
 * @param {*} theoRung
 * @returns {('wicked'|'undefined'|'well-defined'|'ill-defined'|null)}
 */
function toLadderRung(theoRung) {
  if (!isTheoRung(theoRung)) return null;
  return LADDER_RUNG_BY_THEO_ID[theoRung];
}

module.exports = {
  PERSISTED_VOCABULARY: PERSISTED_VOCABULARY,
  THEO_RUNGS: THEO_RUNGS,
  LADDER_RUNG_BY_THEO_ID: LADDER_RUNG_BY_THEO_ID,
  isTheoRung: isTheoRung,
  toLadderRung: toLadderRung,
};
