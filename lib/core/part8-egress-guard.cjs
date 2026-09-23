'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 196-03 (PB8-01/02/03/05) -- the pure LOCAL Part-8 egress classifier.
 * ==========================================================================
 * classify(payload, { toolName }) is the constitutional heart of the Part 8
 * runtime gate (D-01/D-06): CONTENT-SET -> block, proven MOVE-SET -> allow,
 * neither -> ambiguous (fail-closed toward gate, never silent-allow).
 *
 * It is a PURE LOCAL function. It opens ZERO Brain wire and makes ZERO network
 * call (D-01, constitutional). No Plurai endpoint, no Brain call inside
 * classify(). The judge is local-only.
 *
 * The heavy lifting already shipped and is REUSED, never re-implemented:
 *   - The Canon-authoritative default-deny pattern set lives in
 *     cross-room-aggregator.cjs and is re-exported BYTE-FOR-BYTE by
 *     rs-egress-prompts.cjs. This module IMPORTS auditQueryObject /
 *     auditQueryString from rs-egress-prompts.cjs; it NEVER declares a private
 *     pattern copy (PB8-02). A new pattern lands in the Canon source, not here.
 *   - The MOVE-SET job allowlist is the shipped SHIPPED_JOBS closed vocabulary
 *     from brain-client.cjs (D-02); imported, not re-listed.
 *
 * The _safeAudit / scanForContent try/catch shape is cloned from
 * lib/hmi/brain-review-packet.cjs (the closest shipped structural-egress
 * defense module).
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 * Pure CJS, zero npm deps at classify time.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const egress = require('./rs-egress-prompts.cjs');

const EGRESS_SURFACE = 'part8-egress-guard';

// ---------------------------------------------------------------------------
// SHIPPED_JOBS: the D-02 closed job vocabulary, IMPORTED from brain-client.cjs
// (exposed on its _test seam). We import rather than re-list so a Canon change
// to the job vocabulary is felt here with zero code change. The require is
// wrapped: if brain-client (or its ajv dependency) is unavailable, the typed
// MOVE-SET recognizer degrades to ambiguous (fail-closed) rather than crashing.
// ---------------------------------------------------------------------------
let SHIPPED_JOBS = null;
try {
  const brainClient = require('./brain-client.cjs');
  if (brainClient && brainClient._test && brainClient._test.SHIPPED_JOBS) {
    SHIPPED_JOBS = brainClient._test.SHIPPED_JOBS;
  }
} catch (_e) {
  SHIPPED_JOBS = null;
}

// ---------------------------------------------------------------------------
// Generic methodology-vocabulary shape. The POSITIVE recognizer for the
// free-form brain_ask / brain_query string path: a MOVE-SET allow requires the
// string to clear default-deny AND carry at least one generic methodology
// token (framework handle, edge type, phase id, enum, tier, slug, reach_id).
// A clean string with NO methodology vocabulary is NOT proven MOVE-SET -> it
// gates as ambiguous (never silent-allow). This is a positive shape check, not
// a forbidden-content scan, so it does not duplicate the Canon pattern set.
//
// Quick task 260807-h5s (defect B1, a genuine bug). The list shipped as 37
// business-methodology tokens with ZERO graph or schema introspection
// vocabulary. Verified false for: labels, node, relationship, count, keys,
// schema, properties, MATCH, RETURN. A content-free Cypher label census such as
// "MATCH (n) RETURN labels(n) AS labels, count(*) AS c" therefore matched no
// positive recognizer, fell to the ambiguous freeform_unmatched verdict, and
// the hook turned that into a block on a payload that carries zero user bytes.
// The graph-introspection tokens below close that false positive. The regex is
// already case-insensitive and word-bounded, so "labels" matches inside a
// labels(n) call; the flags and the bounding are deliberately unchanged.
// ---------------------------------------------------------------------------
const METHODOLOGY_VOCAB = new RegExp(
  '\\b(?:' + [
    'framework', 'frameworks', 'methodology', 'methodology_tier',
    'reach_id', 'slug', 'phase', 'phase-id', 'problem[- ]type',
    'enum', 'edge[- ]type', 'FEEDS_INTO', 'CONTRADICTS', 'PRECEDES',
    'chain', 'chains', 'traverse', 'sequence', 'targets',
    'SWOT', 'Porter', 'jobs-to-be-done', 'first-principles',
    'value-chain', 'design-thinking', 'six-hats',
    'discovery', 'investment', 'scoping', 'execution', 'stage',
    'wicked', 'ill-defined', 'well-defined', 'undefined',
    'UDP', 'WDP',
    // Graph-introspection vocabulary (quick 260807-h5s, defect B1).
    'labels', 'relationshipTypes', 'propertyKeys', 'nodeTypeProperties',
    'count', 'keys', 'schema',
  ].join('|') + ')\\b',
  'i'
);

// The free-form tool-input keys a brain_ask / brain_query / brain_search call
// carries a raw string on (not a typed packet). brain_ask -> { question },
// brain_query -> { cypher }, brain_search -> { query } (and the Plurai fixture
// uses { brain_query_payload }). The `query` key was already present before
// quick task 260807-h5s widened _isFreeFormTool to brain_search, so that
// widening needed no change here; verified by reading, not assumed.
const FREEFORM_KEYS = ['question', 'cypher', 'brain_query_payload', 'query', 'ask'];

// A generic outbound handle shape (lowercase methodology-vocabulary handle):
// used to keep MOVE-SET packet handle/slug fields structural.
const GENERIC_HANDLE = /^[a-z0-9][a-z0-9 ._-]{0,40}$/;

/**
 * scanForContent(payload) -> { hit, matched_pattern }
 *
 * Wrap the shipped default-deny audit (auditQueryObject, which JSON.stringify
 * scans the whole outbound object against the Canon FORBIDDEN_PATTERNS). A
 * throw = a CONTENT-SET hit = an immediate block, the safe default. Cloned from
 * the brain-review-packet.cjs _safeAudit idiom. Carries NO offending bytes out,
 * only the matched regex source scalar.
 */
function scanForContent(payload) {
  try {
    egress.auditQueryObject(payload, EGRESS_SURFACE);
    return { hit: false };
  } catch (e) {
    return { hit: true, matched_pattern: (e && e.meta && e.meta.matched_pattern) || 'unknown' };
  }
}

/**
 * _safeAudit(str) -> boolean clean
 *
 * Run a single outbound string through the default-deny auditQueryString gate.
 * Returns true when the string clears, false on any ExternalEgressViolation (or
 * audit failure). Cloned from brain-review-packet.cjs:57-66.
 */
function _safeAudit(str) {
  if (typeof str !== 'string' || str.length === 0) return false;
  try {
    egress.auditQueryString(str, EGRESS_SURFACE);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * _looksLikePacket(payload) -> boolean
 *
 * A Phase 110 typed Brain packet carries packet_version and/or a job field.
 * Free-form brain_ask / brain_query inputs do not; opaque tool_input blobs do
 * not either.
 */
function _looksLikePacket(payload) {
  return Object.prototype.hasOwnProperty.call(payload, 'packet_version') ||
    Object.prototype.hasOwnProperty.call(payload, 'job');
}

/**
 * _summaryLeavesAllHashed(node) -> boolean
 *
 * Walk every leaf named summary / explanation anywhere in the object graph.
 * Each MUST be absent or a sha256:-prefixed projection (the projectText()
 * invariant, packet.cjs:130). A raw-prose summary is an instant CONTENT-SET
 * tell (the H5 breach projectText fixed) -> the packet is NOT proven MOVE-SET.
 */
function _summaryLeavesAllHashed(node, seen) {
  if (node === null || typeof node !== 'object') return true;
  seen = seen || new Set();
  if (seen.has(node)) return true;
  seen.add(node);
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (!_summaryLeavesAllHashed(node[i], seen)) return false;
    }
    return true;
  }
  const keys = Object.keys(node);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const val = node[key];
    if ((key === 'summary' || key === 'explanation')) {
      if (val === null || val === undefined) continue;
      if (typeof val !== 'string' || val.indexOf('sha256:') !== 0) return false;
    } else if (val !== null && typeof val === 'object') {
      if (!_summaryLeavesAllHashed(val, seen)) return false;
    }
  }
  return true;
}

/**
 * _proveMoveSet(payload) -> boolean
 *
 * POSITIVE proof that a typed packet held the Phase 110 MOVE-SET shape:
 *   - job is a string in the imported SHIPPED_JOBS closed vocabulary,
 *   - every summary / explanation leaf is sha256:-prefixed or absent,
 *   - any framework / slug / handle field matches the generic-handle shape and
 *     clears the default-deny string audit.
 * The content scan already cleared before this runs. Absence of proof is NOT
 * an allow (the caller gates it as ambiguous).
 */
function _proveMoveSet(payload) {
  if (!SHIPPED_JOBS) return false;
  if (typeof payload.job !== 'string' || !SHIPPED_JOBS.has(payload.job)) return false;
  if (!_summaryLeavesAllHashed(payload)) return false;
  const handleFields = ['framework', 'slug', 'handle', 'reach_id', 'methodology'];
  for (let i = 0; i < handleFields.length; i++) {
    const v = payload[handleFields[i]];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') continue;
    if (!GENERIC_HANDLE.test(v)) return false;
    if (!_safeAudit(v)) return false;
  }
  return true;
}

/**
 * _extractFreeFormString(payload) -> string | null
 *
 * Pull the raw outbound string a free-form brain_ask / brain_query /
 * brain_search call carries (question / cypher / brain_query_payload / query).
 * Top-level only: an opaque tool_input blob with no free-form key yields null
 * (-> ambiguous, not allow).
 */
function _extractFreeFormString(payload) {
  for (let i = 0; i < FREEFORM_KEYS.length; i++) {
    const v = payload[FREEFORM_KEYS[i]];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/**
 * _isProvablyEmptyPayload(payload) -> boolean
 *
 * Phase 245-03 (R5 / F-4). POSITIVE proof that a payload carries zero bytes:
 * a plain object (non-null, typeof 'object', NOT an array) with zero own keys.
 * Nothing else qualifies.
 *
 * Three constraints, stated here so the next reader cannot mistake this for a
 * relaxation of the boundary:
 *   1. The terminal catch-all at the end of classify() is UNCHANGED. It still
 *      returns 'ambiguous' for every payload that carries anything at all.
 *      This is a NEW POSITIVE PROOF, not a weakened default. An empty payload
 *      is the one case where "cannot prove it is safe" and "provably has
 *      nothing to leak" coincide: zero bytes cannot carry user content.
 *   2. SUPERSEDED, recorded in place rather than deleted so a later reader sees
 *      both the original call and the reversal.
 *        ORIGINAL (Phase 245-03): "_isFreeFormTool is NOT broadened.
 *        brain_search stays out of it deliberately (see
 *        .planning/debug/245-part8-contentless-block.md, the D-28 FLAGGED
 *        disposition): a search string IS real user content, so its block may
 *        well be correct and widening it is a real egress-surface change that
 *        needs its own navigator decision."
 *        REVERSED (quick task 260807-h5s, WITH navigator approval):
 *        _isFreeFormTool now DOES recognize brain_search. Phase 245 was right
 *        that this needed its own navigator decision; that decision has since
 *        been taken. It is boundary-neutral because step 4 only ever runs on
 *        strings the step 1 default-deny scan has already cleared, and step 1
 *        is byte-unchanged. A brain_search payload carrying an email address, a
 *        funding-round string or a money figure is STILL blocked as
 *        content_set, asserted in tests/test-245-brain-envelope-shape.cjs claim
 *        (d). The full safety argument lives at the _isFreeFormTool docblock.
 *   3. null and undefined stay FAIL-CLOSED. The early return at the top of
 *      classify() keeps yielding 'non-object payload'. A missing envelope
 *      field is a different claim from an explicitly empty object, and every
 *      shipped caller (brain-client.cjs:488 brain_schema, :575 brain_stats)
 *      passes {} explicitly, so nothing needs the looser branch.
 *
 * An array is excluded on purpose: [] is not a plain object and must not be
 * carved out (spoofing guard, threat T-245-12).
 */
function _isProvablyEmptyPayload(payload) {
  if (payload === null || typeof payload !== 'object') return false;
  if (Array.isArray(payload)) return false;
  return Object.keys(payload).length === 0;
}

/**
 * _isFreeFormTool(toolName) -> boolean
 *
 * brain_ask / brain_query / brain_search send a raw string, not a typed packet.
 *
 * WHY brain_search WAS ADDED, AND WHY IT CANNOT WEAKEN THE BOUNDARY.
 * Quick task 260807-h5s (defect B2), NAVIGATOR-APPROVED reversal of the Phase
 * 245 D-28 FLAGGED disposition. Before this change a brain_search call never
 * reached the step 4 vocabulary test at all: it fell straight to the terminal
 * catch-all as class 'unknown', which the hook blocks. That made the fallback
 * documented in commands/pws-brain.md (brain_ask errors -> fall back ONCE to
 * brain_search) dead prose, since the runtime blocked the very call the doc
 * promised.
 *
 * The safety argument, in full, so no later reader has to reconstruct it:
 *
 *   The step 4 vocabulary gate is a bare substring-presence test and protects
 *   NOTHING on its own. Proven with a real payload against the shipped
 *   classifier:
 *     payload {cypher:"MATCH (n) WHERE n.owner='Jonathan' RETURN
 *              n.private_meeting_notes // framework"}
 *     verdict {"verdict":"allow","class":"move_set"}
 *   Real user content already sailed through step 4 because the token
 *   "framework" appeared in a trailing comment. A gate that a trailing comment
 *   defeats is not the thing holding the line.
 *
 *   The ACTUAL Canon Part 8 boundary is step 1, the default-deny scanForContent
 *   scan. It runs FIRST on every single call, before this function is ever
 *   consulted, and it blocks email addresses, funding-round strings, money
 *   figures and the rest of the Canon FORBIDDEN_PATTERNS set regardless of
 *   vocabulary. Step 1 is byte-unchanged by this quick task. Widening step 4
 *   therefore CANNOT weaken the boundary, because step 4 only ever runs on
 *   strings step 1 has already cleared.
 *
 *   IF ANYONE EVER WEAKENS STEP 1, THIS DECISION BECOMES THE HOLE. The
 *   boundary-neutrality of widening step 4 is entirely borrowed from step 1
 *   running first and running default-deny. Touch that ordering or that scan
 *   and this widening stops being free.
 *
 * FREEFORM_KEYS already carries the `query` key a brain_search payload uses, so
 * no change was needed there (verified by reading, not assumed).
 *
 * UPDATE (354-06, D-354-EGR): the "a trailing comment defeats it" proof above
 * is exactly why step 3's keyword-presence test was replaced with
 * _proveTypedQuestion's structural proof (every token closed-vocabulary, not
 * merely one token present). This docblock's boundary-neutrality argument for
 * WIDENING _isFreeFormTool to brain_search is unaffected -- step 1 still runs
 * first, still default-deny, still byte-unchanged -- but step 3 itself no
 * longer treats keyword presence as proof of anything. See classify()'s own
 * docblock and _proveTypedQuestion's docblock for the current step 3 shape.
 */
function _isFreeFormTool(toolName) {
  if (typeof toolName !== 'string') return false;
  return toolName.indexOf('brain_ask') !== -1 ||
    toolName.indexOf('brain_query') !== -1 ||
    toolName.indexOf('brain_search') !== -1;
}

// ---------------------------------------------------------------------------
// Step 3b: known-safe structural shapes for two specific Brain tools,
// find_connections and taxonomy_ladder. TAXONOMY_RUNGS is the closed four-
// value enum taxonomy_ladder's own schema declares; KNOWN_LABEL_MAX bounds a
// label field as node-label hygiene, not a content defense (step 1 is).
//
// Phase 354-10 (THEO-01 taxonomy casing, CTX-TAXO, P2): this set is Theo's
// OWN PROBLEM_TYPE_IDS casing (/home/jsagi/Theo/src/mcp/content/
// vocabulary.ts:53-58, taxonomy-ladder.ts:285-286's z.enum, inspected
// read-only at commit 881e147), not an independently-invented lowercase/
// hyphenated vocabulary. Before this fix the two disagreed: this file's own
// lowercase set matched lib/core/strategy/rung-vocabulary.cjs's
// LADDER_RUNG_BY_THEO_ID (so this file's OWN test suite stayed green) but
// neither matched the provider's real schema, so a correctly-shaped call
// still failed at Theo. lib/core/strategy/rung-vocabulary.cjs's
// toLadderRung is the ONE place a rung id is converted before it reaches
// this recognizer or the wire; this set stays equal to that function's
// output set, proven bidirectionally by tests/test-354-taxonomy-ladder-
// casing.cjs (against the provider) and tests/test-345-rung-mapping.cjs
// (against this module).
// ---------------------------------------------------------------------------
const TAXONOMY_RUNGS = Object.freeze(new Set(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']));
const KNOWN_LABEL_MAX = 120;

// Quick 260910-hni: recommend_chain's problem_type enum, the UNION of the
// incumbent's canonical rung strings and Theo's own ids (both vocabularies
// are live during the cutover soak; recommendChain() in brain-client.cjs
// already selects the right table by origin, this recognizer just has to
// accept whichever one the wrapper actually sent).
const RECOMMEND_CHAIN_PROBLEM_TYPES = Object.freeze(new Set([
  'Undefined Problem', 'Ill-Defined Problem', 'Well-Defined Problem',
  'UnDefined', 'IllDefined', 'WellDefined', 'Wicked',
]));

// _isSafeShortLabel(v): a string, 1-120 chars, no CR/LF, and clears _safeAudit.
// The length-and-single-line bound is label hygiene ("this is a node label,
// not prose"), NOT the content defense -- step 1's default-deny scan is. It is
// what keeps this recognizer from doubling as a bulk free-text channel for
// content that happens to dodge every forbidden pattern.
function _isSafeShortLabel(v) {
  if (typeof v !== 'string') return false;
  if (v.length < 1 || v.length > KNOWN_LABEL_MAX) return false;
  if (v.indexOf('\r') !== -1 || v.indexOf('\n') !== -1) return false;
  return _safeAudit(v);
}

// _hasExactKeys(payload, required, optional): every name in required must be
// an own key of payload, and every own key of payload must appear in required
// or optional. Anything else (missing required, unrecognized extra) is false.
// This is what makes the recognizer fail-closed on tool-schema drift: an
// argument name this file does not know about means no proof, so the call
// keeps gating as ambiguous exactly as it does today.
function _hasExactKeys(payload, required, optional) {
  const allowed = required.concat(optional || []);
  for (let i = 0; i < required.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(payload, required[i])) return false;
  }
  const ownKeys = Object.keys(payload);
  for (let i = 0; i < ownKeys.length; i++) {
    if (allowed.indexOf(ownKeys[i]) === -1) return false;
  }
  return true;
}

/**
 * _proveKnownToolShape(payload, toolName) -> null | {class, reason}
 *
 * 1. PLACEMENT IS THE FIRST HALF OF THE ARGUMENT. This runs LAST in classify(),
 *    after step 1's default-deny scan, after step 1b, after step 2's packet
 *    branch, and after step 3's free-form branch. It therefore has exactly one
 *    power: converting a payload that would have hit the terminal catch-all as
 *    ambiguous into an allow. It cannot shadow, preempt, or reorder any
 *    existing verdict, and in particular it can never intercept a call on its
 *    way to a block. The terminal catch-all itself is byte-unchanged; this
 *    narrows what is ambiguous, it never widens what is allowed to carry
 *    content. Same shape of claim as Phase 245-03's step 1b, and the same
 *    reason it holds.
 * 2. STEP 1 IS THE ACTUAL BOUNDARY, AND IT ALREADY RAN. auditQueryObject
 *    JSON.stringify-sweeps the WHOLE payload against the Canon
 *    FORBIDDEN_PATTERNS set before this function is ever consulted: email,
 *    currency and bare financial magnitude, percent metric, financial idiom
 *    (Series A / ARR / MRR / burn rate / runway / Nx growth), quoted-person,
 *    meeting fragments and verbatim prose, SSN-like, phone-like, name plus
 *    degree, user-count metric, venture proper-noun, identifying location. A
 *    from / to / question_label carrying real user content is blocked at step
 *    1 and never reaches this code. Step 1 is byte-unchanged by this addition.
 * 3. DEFENSE IN DEPTH, NOT ORDERING ALONE. Every string field is independently
 *    re-run through _safeAudit here, mirroring what _proveMoveSet already does
 *    for its handleFields. So this recognizer returns no-proof for a
 *    content-carrying payload even when called directly, out of classify()'s
 *    ordering. That is asserted by test, not just claimed here.
 * 4. THE SHAPE CHECK IS PAIRED WITH THE TOOL NAME, DELIBERATELY. Unlike
 *    _isProvablyEmptyPayload, which is payload-shaped and tool-agnostic on
 *    purpose (a zero-key payload has nothing to leak under any tool name), a
 *    from/to pair IS a pair of strings, so a bare structural match usable by
 *    any caller would be a general-purpose two-string channel. Scoping to the
 *    matching tool name is what keeps it a recognizer for two specific
 *    known-safe call shapes rather than a new hole.
 * 5. FAIL-CLOSED ON SCHEMA DRIFT. The key set is EXACT. This repo holds no
 *    local copy of either tool's input schema (data/brain-surface-contract.json
 *    lists both as non-contract with no args), so if the live schema ever
 *    renames or adds an argument, _hasExactKeys stops matching, the recognizer
 *    declines, and the call reverts to gating ambiguous. A drift produces a
 *    false ambiguous, never a false allow.
 * 6. WHY question_label IS ADMITTED AT ALL, stated honestly. It is a string
 *    the user can influence. It is admitted only because (a) step 1 already
 *    cleared it, and (b) step 3 ALREADY admits an entire free-form brain_ask
 *    question on exactly that same step-1-cleared basis, behind a vocabulary
 *    gate the _isFreeFormTool docblock itself proves is defeated by a trailing
 *    comment. This path is strictly narrower than what already ships: exact
 *    key set, single line, 120-char cap, and no vocabulary theater. It does
 *    not widen the boundary beyond the shipped surface.
 * 7. maxHops IS A NUMBER AND CARRIES NO FREE TEXT. The integer-and-at-least-one
 *    constraint is shape hygiene, not a content defense.
 * 8. THE WARNING, in the same terms the _isFreeFormTool docblock uses: the
 *    boundary-neutrality of this recognizer is entirely borrowed from step 1
 *    running FIRST and running default-deny, and from this branch sitting
 *    LAST. Anyone who weakens step 1, or moves this branch earlier in the
 *    chain, turns this decision into the hole.
 */
function _proveKnownToolShape(payload, toolName) {
  if (typeof toolName !== 'string') return null;

  if (toolName.indexOf('find_connections') !== -1) {
    if (!_hasExactKeys(payload, ['from', 'to'], ['maxHops'])) return null;
    if (!_isSafeShortLabel(payload.from)) return null;
    if (!_isSafeShortLabel(payload.to)) return null;
    if (Object.prototype.hasOwnProperty.call(payload, 'maxHops')) {
      if (!Number.isInteger(payload.maxHops) || payload.maxHops < 1) return null;
    }
    return { class: 'known_tool_shape', reason: 'find_connections from/to label pair' };
  }

  if (toolName.indexOf('taxonomy_ladder') !== -1) {
    if (!_hasExactKeys(payload, ['rung'], ['question_label'])) return null;
    if (typeof payload.rung !== 'string' || !TAXONOMY_RUNGS.has(payload.rung)) return null;
    if (Object.prototype.hasOwnProperty.call(payload, 'question_label')) {
      if (!_isSafeShortLabel(payload.question_label)) return null;
    }
    return { class: 'known_tool_shape', reason: 'taxonomy_ladder rung enum' };
  }

  if (toolName.indexOf('recommend_chain') !== -1) {
    // BOTH required, ZERO optional: recommendChain() (lib/core/brain-
    // client.cjs) always sends both problem_type and max_steps, and an empty
    // optional list is what makes this fail-closed on any extra key.
    if (!_hasExactKeys(payload, ['problem_type', 'max_steps'], [])) return null;
    if (typeof payload.problem_type !== 'string'
        || !RECOMMEND_CHAIN_PROBLEM_TYPES.has(payload.problem_type)) return null;
    if (!Number.isInteger(payload.max_steps)
        || payload.max_steps < 1 || payload.max_steps > 6) return null;
    // _normalizeBrainProblemType passes any well-shaped UNMAPPED token
    // through unchanged, so an off-enum value (say 'Trinity') falls out of
    // this arm to the terminal catch-all as ambiguous, which PROCEEDS with a
    // disclosure rather than blocking: this change strictly NARROWS what is
    // ambiguous and never widens what may carry content.
    return { class: 'known_tool_shape', reason: 'recommend_chain problem_type enum' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Closed-vocabulary typed-question proof (354-06, D-354-EGR: "Use typed
// fields and canonical methodology identifiers at the egress boundary...
// do not forward free-form user prose through a 'generic' channel").
//
// THE SEAM THIS CLOSES. The step 3 free-form allow above this block proved
// "generic" with bare keyword PRESENCE: one methodology word anywhere in an
// otherwise-arbitrary sentence earned 'allow'/'move_set' (see the
// _isFreeFormTool docblock's own proof that a trailing `// framework`
// comment defeats it). "Generic" now means STRUCTURALLY PROVEN instead:
// every token of the free-form string comes from a closed vocabulary
// (function words, methodology tokens, canonical framework-name phrases,
// command slugs, or a bare 1-2 digit number). A methodology word sitting
// next to unproven prose (a venture name, "our", a date) is ambiguous
// (freeform_unproven), never allow.
//
// This does NOT touch step 1 (the actual boundary, default-deny,
// byte-unchanged) or the packet path (step 2). It narrows what step 3 can
// prove; it never widens what may carry content.
// ---------------------------------------------------------------------------
// 354-06 Task 2 executor note: two words were added to the plan-specified
// enumeration after the required verify commands (test-239-query-egress-
// canary.cjs LEG 6, test-257-brain-tool-egress-invariant.cjs Arm 5, both
// pre-existing, unowned by this plan's file list) surfaced them as
// necessary -- 'i' (the fixture "What framework should I use for an
// ill-defined problem?" needs the first-person subject pronoun for a
// grammatical generic question; it carries no identifying content by
// itself, unlike the deliberately-excluded possessives our/my/we/us/
// your/their) and 'analysis' (the fixture "framework chain analysis"
// needs the generic process noun, the same closed-vocabulary shape as the
// already-listed 'method'/'technique'). Neither addition weakens the block
// path: the PRIVATE sentence (cedar/juniper/confidential/plan/acquire/
// autumn) and the 'lean startup methodology' fixture (lean/startup) remain
// unproven with both words present, re-verified after this addition.
const QUESTION_FUNCTION_WORDS = Object.freeze(new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'from',
  'into', 'via', 'and', 'or', 'not', 'is', 'are', 'be', 'does', 'do', 'should',
  'can', 'which', 'what', 'when', 'why', 'how', 'where', 'best', 'first',
  'next', 'then', 'before', 'after', 'between', 'versus', 'vs', 'than',
  'most', 'more', 'fit', 'fits', 'apply', 'use', 'recommend', 'suggest',
  'sequence', 'order', 'follow', 'follows', 'feed', 'feeds', 'precede',
  'precedes', 'step', 'steps', 'stage', 'stages', 'rung', 'level', 'type',
  'types', 'kind', 'problem', 'problems', 'question', 'framework',
  'frameworks', 'method', 'methods', 'methodology', 'technique', 'techniques',
  'definition', 'defined', 'simple', 'complex', 'complexity', 'chain',
  'chains', 'reverse', 'salient', 'relationship', 'relationships', 'edge',
  'edges', 'command', 'commands', 'compare', 'difference',
  'i', 'analysis',
]));

// The lowercase alternatives already enumerated in METHODOLOGY_VOCAB above
// (split 'problem[- ]type' and 'edge[- ]type' into their hyphen and space
// forms, since a tokenized space-separated occurrence splits into two
// separate tokens rather than one hyphenated one), plus the Theo rung ids
// lowercased (undefined is already present via METHODOLOGY_VOCAB's own
// 'undefined' entry).
const METHODOLOGY_TOKEN_SET = Object.freeze(new Set([
  'framework', 'frameworks', 'methodology', 'methodology_tier',
  'reach_id', 'slug', 'phase', 'phase-id', 'problem-type', 'problem type',
  'enum', 'edge-type', 'edge type', 'feeds_into', 'contradicts', 'precedes',
  'chain', 'chains', 'traverse', 'sequence', 'targets',
  'swot', 'porter', 'jobs-to-be-done', 'first-principles',
  'value-chain', 'design-thinking', 'six-hats',
  'discovery', 'investment', 'scoping', 'execution', 'stage',
  'wicked', 'ill-defined', 'well-defined', 'undefined',
  'udp', 'wdp',
  'labels', 'relationshiptypes', 'propertykeys', 'nodetypeproperties',
  'count', 'keys', 'schema',
  // Theo rung ids, lowercased (quick 260910-hni's RECOMMEND_CHAIN_PROBLEM_TYPES
  // union; 'undefined' and 'wicked' already carried above).
  'illdefined', 'welldefined',
]));

// _loadJsonSafe: fs.readFileSync inside a try/catch, repo-root-relative.
// A load failure returns null -- every caller below fails closed on null
// (an empty vocabulary set, never a crash and never a wider proof).
function _loadJsonSafe(relParts) {
  try {
    const p = path.join.apply(path, [__dirname, '..', '..'].concat(relParts));
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return null;
  }
}

// COMMAND_SLUG_SET: slugs from data/command-registry.json (the leading
// '/mos:' stripped, lowercased). Built once, module-load time.
const COMMAND_SLUG_SET = Object.freeze(new Set((function () {
  const registry = _loadJsonSafe(['data', 'command-registry.json']);
  if (!registry || !Array.isArray(registry.commands)) return [];
  return registry.commands
    .map(function (c) { return (c && typeof c.command === 'string') ? c.command : ''; })
    .filter(function (c) { return c.indexOf('/mos:') === 0; })
    .map(function (c) { return c.slice('/mos:'.length).toLowerCase(); });
})()));

// CANONICAL_PHRASES: framework_names plus curated_extras from
// data/framework-names.json, lowercased, sorted LONGEST FIRST so a longer
// phrase match is never shadowed by a shorter prefix sharing its first word.
const CANONICAL_PHRASES = Object.freeze((function () {
  const names = _loadJsonSafe(['data', 'framework-names.json']);
  if (!names) return [];
  const all = [].concat(names.framework_names || [], names.curated_extras || []);
  return Object.freeze(all
    .filter(function (n) { return typeof n === 'string' && n.length > 0; })
    .map(function (n) { return n.toLowerCase(); })
    .sort(function (a, b) { return b.length - a.length; }));
})());

// Fail-closed on a data-load failure: if EITHER shipped vocabulary file did
// not load, the proof returns false unconditionally rather than silently
// proving against a partial (and therefore too-permissive) vocabulary.
const _TYPED_QUESTION_DATA_LOADED = COMMAND_SLUG_SET.size > 0 && CANONICAL_PHRASES.length > 0;

/**
 * _proveTypedQuestion(str) -> boolean
 *
 * POSITIVE structural proof that a free-form brain_ask / brain_search string
 * carries ONLY closed-vocabulary tokens: a function word, a methodology
 * token, a canonical framework-name phrase, a command slug, or a bare 1-2
 * digit number. Absence of proof is NOT an allow -- classify() gates it
 * ambiguous (freeform_unproven when methodology vocabulary is present,
 * freeform_unmatched otherwise). Exported as a test seam.
 */
function _proveTypedQuestion(str) {
  if (!_TYPED_QUESTION_DATA_LOADED) return false;
  if (typeof str !== 'string' || str.length < 1 || str.length > 240) return false;
  if (str.indexOf('\r') !== -1 || str.indexOf('\n') !== -1) return false;
  if (!_safeAudit(str)) return false;

  let lowered = str.toLowerCase();
  // Strip every '/mos:' command prefix -- a slash-command reference is a
  // command handle, not free prose.
  lowered = lowered.split('/mos:').join(' ');
  // Replace each canonical framework-name phrase (whole-phrase, longest
  // first) with a space, so a multi-word framework name does not need each
  // of its individual words to separately be closed-vocabulary.
  for (let i = 0; i < CANONICAL_PHRASES.length; i++) {
    const phrase = CANONICAL_PHRASES[i];
    if (lowered.indexOf(phrase) !== -1) {
      lowered = lowered.split(phrase).join(' ');
    }
  }

  const tokens = lowered.split(/[^a-z0-9_-]+/).filter(function (t) { return t.length > 0; });
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (QUESTION_FUNCTION_WORDS.has(t)) continue;
    if (METHODOLOGY_TOKEN_SET.has(t)) continue;
    if (COMMAND_SLUG_SET.has(t)) continue;
    if (/^[0-9]{1,2}$/.test(t)) continue;
    return false;
  }
  return true;
}

/**
 * classify(payload, { toolName }) -> { verdict, class, reason }
 *
 * verdict: 'allow' | 'block' | 'ambiguous'. Pure LOCAL, zero network (D-01).
 *   1. CONTENT-SET default-deny scan first (any hit -> block, the safe default).
 *   1b. A provably empty plain object (zero own keys) -> allow. Positive proof
 *      of emptiness, never a relaxed default (Phase 245-03).
 *   2. A proven typed MOVE-SET packet -> allow; an unproven packet -> ambiguous.
 *   3. A free-form brain_ask / brain_query / brain_search string that clears
 *      default-deny: allow (class typed_question) ONLY when every token is
 *      STRUCTURALLY PROVEN closed-vocabulary (_proveTypedQuestion, 354-06
 *      D-354-EGR); a methodology-vocabulary hit that is NOT structurally
 *      proven is ambiguous (freeform_unproven), never allow; no vocabulary
 *      hit at all is ambiguous (freeform_unmatched). Bare keyword PRESENCE
 *      is no longer proof of anything -- see _proveTypedQuestion's own
 *      docblock for what changed and why. (brain_search added by quick task
 *      260807-h5s; see the _isFreeFormTool docblock for why that is
 *      boundary-neutral.)
 *   3b. A known-safe structural shape for a specific Brain tool
 *      (find_connections, taxonomy_ladder) that clears default-deny -> allow;
 *      else falls through. See _proveKnownToolShape's own docblock for the
 *      boundary-neutrality argument.
 *   4. Neither -> ambiguous (fail-closed toward gate, never silent-allow).
 * class is a category slug; reason is a short scalar carrying NO offending bytes.
 */
function classify(payload, opts) {
  opts = opts || {};
  const toolName = opts.toolName || '';

  if (payload === null || typeof payload !== 'object') {
    return { verdict: 'ambiguous', class: 'unknown', reason: 'non-object payload' };
  }

  // 1. CONTENT-SET: the shipped default-deny scan is the discriminator.
  const scan = scanForContent(payload);
  if (scan.hit) {
    return { verdict: 'block', class: 'content_set', reason: 'forbidden pattern hit: ' + scan.matched_pattern };
  }

  // 1b. Phase 245-03 (R5 / F-4): provably contentless payload. Placed AFTER the
  // CONTENT-SET scan on purpose, so the forbidden-pattern default-deny still
  // runs FIRST on every call and no branch can precede it (threat T-245-11).
  // An empty object trivially clears that scan, so the ordering is safe by
  // construction; keeping the scan first preserves the invariant.
  // The catch-all below is untouched: this narrows what is ambiguous, it never
  // widens what is allowed to carry content.
  if (_isProvablyEmptyPayload(payload)) {
    return { verdict: 'allow', class: 'empty_payload', reason: 'zero-key payload carries no bytes' };
  }

  // 2. typed MOVE-SET packet.
  if (_looksLikePacket(payload)) {
    if (_proveMoveSet(payload)) {
      return { verdict: 'allow', class: 'move_set', reason: 'proven Phase 110 packet shape' };
    }
    return { verdict: 'ambiguous', class: 'unproven_packet', reason: 'packet shape not proven' };
  }

  // 3. free-form brain_ask / brain_query string path.
  if (_isFreeFormTool(toolName)) {
    const str = _extractFreeFormString(payload);
    if (typeof str === 'string' && str.length > 0) {
      if (!_safeAudit(str)) {
        return { verdict: 'block', class: 'content_set', reason: 'forbidden pattern in free-form string' };
      }
      // 354-06 (D-354-EGR): "generic" means STRUCTURALLY PROVEN, not merely
      // keyword-present. A proven closed-vocabulary question allows; a
      // methodology-vocabulary hit that is NOT proven is ambiguous
      // (freeform_unproven), never allow; no vocabulary hit at all keeps the
      // pre-existing freeform_unmatched ambiguous verdict, byte-unchanged.
      if (_proveTypedQuestion(str)) {
        return { verdict: 'allow', class: 'typed_question', reason: 'closed-vocabulary methodology question' };
      }
      if (METHODOLOGY_VOCAB.test(str)) {
        return { verdict: 'ambiguous', class: 'freeform_unproven', reason: 'methodology vocabulary present but free-form tokens unproven' };
      }
      return { verdict: 'ambiguous', class: 'freeform_unmatched', reason: 'no methodology vocabulary match' };
    }
  }

  // 3b. known-safe structural shape for a specific Brain tool.
  const knownShape = _proveKnownToolShape(payload, toolName);
  if (knownShape) {
    return { verdict: 'allow', class: knownShape.class, reason: knownShape.reason };
  }

  // 4. neither proven MOVE-SET nor a content hit.
  return { verdict: 'ambiguous', class: 'unknown', reason: 'neither proven move-set nor content hit' };
}

// ---------- Exports ----------
// classify + the test seams the adversarial suite spies (clone of the
// brain-review-packet.cjs exports style).
module.exports = {
  classify: classify,
  scanForContent: scanForContent,
  EGRESS_SURFACE: EGRESS_SURFACE,
  _safeAudit: _safeAudit,
  _proveMoveSet: _proveMoveSet,
  _looksLikePacket: _looksLikePacket,
  _summaryLeavesAllHashed: _summaryLeavesAllHashed,
  _extractFreeFormString: _extractFreeFormString,
  _isFreeFormTool: _isFreeFormTool,
  _proveTypedQuestion: _proveTypedQuestion,
  QUESTION_FUNCTION_WORDS: QUESTION_FUNCTION_WORDS,
  METHODOLOGY_TOKEN_SET: METHODOLOGY_TOKEN_SET,
  COMMAND_SLUG_SET: COMMAND_SLUG_SET,
  CANONICAL_PHRASES: CANONICAL_PHRASES,
  _isProvablyEmptyPayload: _isProvablyEmptyPayload,
  _proveKnownToolShape: _proveKnownToolShape,
  _isSafeShortLabel: _isSafeShortLabel,
  _hasExactKeys: _hasExactKeys,
  TAXONOMY_RUNGS: TAXONOMY_RUNGS,
};
