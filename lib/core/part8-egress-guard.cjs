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
// Phase 369.2 Plan 01 (CODE-07, J4, ruling 2026-10-05): the recognizer is the
// allow FAST PATH, no longer the only path. A free-form Theo string is now
// decided by theoVerdict() (below), by content and provenance: the bound
// room's lexicon, private-venture context, unknown identifiers and unknown
// proper names block; a plain methodology question with no room-local token
// allows. METHODOLOGY_VOCAB below is retained for the guard's own
// documentation and tests; classify() no longer branches on it.
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

// Plan 386-28 (E-JOB): the packet key allowlist, read lazily from
// data/brain-packet-schema.json ($defs.<job>.in.properties; additionalProperties
// is false on every object node there). The five handle fields that
// _proveMoveSet checks one by one are allowed in addition. A load failure or an
// unknown job returns false (no proof), never a wider proof.
const PACKET_HANDLE_KEYS = Object.freeze(['framework', 'slug', 'handle', 'reach_id', 'methodology']);
let _packetSchemaDoc;
function _packetKeysWithinSchema(payload) {
  if (_packetSchemaDoc === undefined) _packetSchemaDoc = _loadJsonSafe(['data', 'brain-packet-schema.json']);
  const defs = _packetSchemaDoc && _packetSchemaDoc.$defs;
  const def = defs && typeof payload.job === 'string' ? defs[payload.job] : null;
  const props = def && def.in && def.in.properties;
  if (!props || typeof props !== 'object') return false;
  const keys = Object.keys(payload);
  for (let i = 0; i < keys.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(props, keys[i]) && PACKET_HANDLE_KEYS.indexOf(keys[i]) === -1) return false;
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
  // Plan 386-28 (E-JOB): the payload keys must be keys of the packet schema for
  // this job (plus the five handle fields checked below). An extra key, such as
  // a nested object, a free-text field or a key that holds a token, makes the
  // packet unproven.
  if (!_packetKeysWithinSchema(payload)) return false;
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

// The FREEFORM_KEYS key the primary string sits under (same order as
// _extractFreeFormString), or null.
function _primaryFreeFormKey(payload) {
  for (let i = 0; i < FREEFORM_KEYS.length; i++) {
    const v = payload[FREEFORM_KEYS[i]];
    if (typeof v === 'string' && v.length > 0) return FREEFORM_KEYS[i];
  }
  return null;
}

/**
 * _collectStringLeaves(payload) -> [{ path, value }] | { over_budget: true, reason }
 *
 * Plan 392-05 (bypasses 2 and 3 of the Phase 392 audit, F6). Every string
 * leaf of the payload, at any depth, with its key path ("context",
 * "notes.0", "params.name"). Before this plan the free-form verdict read the
 * first FREEFORM_KEYS key only, so a sibling key beside a generic question
 * ({question, context}), an array leaf, a nested leaf and every value under
 * brain_query.params were never decided; only the default-deny scan of
 * classify step 1 saw them, and a room paragraph with no forbidden pattern
 * cleared it.
 *
 * The walk is bounded: LEAF_WALK_MAX_DEPTH levels (the top-level values sit
 * at depth 1, the same count lib/core/part8-split-route.cjs carriesEdgeOrBody
 * uses), LEAF_WALK_MAX_NODES visited values, and a seen set against cycles.
 * Past either cap it answers { over_budget: true, reason: 'depth' | 'nodes' }
 * and the caller refuses (fail closed; T-392-13): a payload the guard cannot
 * finish reading is not sent. Never throws. Holds the leaf values only for
 * the caller's decision; no verdict carries them out (leaf_path names the
 * key path, never the text).
 */
const LEAF_WALK_MAX_DEPTH = 8;
const LEAF_WALK_MAX_NODES = 2000;
function _collectStringLeaves(payload) {
  if (payload === null || typeof payload !== 'object') return [];
  const leaves = [];
  const seen = new Set();
  let budget = LEAF_WALK_MAX_NODES;
  let over = null;
  const walk = function (v, depth, prefix) {
    if (over) return;
    if (depth > LEAF_WALK_MAX_DEPTH) { over = 'depth'; return; }
    if (budget <= 0) { over = 'nodes'; return; }
    budget -= 1;
    if (typeof v === 'string') { leaves.push({ path: prefix, value: v }); return; }
    if (v === null || typeof v !== 'object') return;
    if (seen.has(v)) return;
    seen.add(v);
    const keys = Array.isArray(v) ? v.map(function (_x, i) { return String(i); }) : Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
      walk(v[keys[i]], depth + 1, prefix === '' ? keys[i] : prefix + '.' + keys[i]);
      if (over) return;
    }
  };
  seen.add(payload);
  const top = Array.isArray(payload) ? payload.map(function (_x, i) { return String(i); }) : Object.keys(payload);
  for (let i = 0; i < top.length; i++) {
    walk(payload[top[i]], 1, top[i]);
    if (over) break;
  }
  if (over) return { over_budget: true, reason: over };
  return leaves;
}

// The over-budget refusal (plan 392-05). Class content_set: the guard could
// not finish reading the payload, so it treats it as content. The reason is
// the constant over_budget; over_budget names the cap that tripped.
function _overBudgetBlock(reason) {
  return { verdict: 'block', class: 'content_set', token_class: null, reason: 'over_budget', over_budget: reason === 'nodes' ? 'nodes' : 'depth' };
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

/**
 * _isBrainWriteTool(toolName) -> boolean
 *
 * Plan 386-04 (B2). True when the tool name contains brain_write: the bare
 * name the script path uses and every scoped name (plugin, project, theo,
 * a legacy direct connector). It is a tool-NAME test only. It reads no payload and
 * adds no word list. classify() blocks on it (class write_blocked) after the
 * CONTENT-SET scan and the empty-payload proof.
 */
function _isBrainWriteTool(toolName) {
  if (typeof toolName !== 'string') return false;
  return toolName.indexOf('brain_write') !== -1;
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
 * 9. 361-02 (D-10, D-14) ADDS THREE MORE ARMS, LAST: framework_step,
 *    framework_techniques and case_story, sitting after recommend_chain and
 *    before the terminal return null. framework_step, framework_techniques
 *    and case_story's framework_name path are STRICTER than every arm
 *    above: the value must be an exact, lowercase-normalized member of
 *    CANONICAL_PHRASES (a generic framework handle only, per D-10), not
 *    merely a safe short label. See _isKnownFrameworkHandle, declared
 *    directly after this function's closing brace, for the full argument.
 *    case_story's case_name path (361-09, Theo 20.1-04) has no local closed
 *    case vocabulary to prove against, so it is admitted under the
 *    find_connections free-label rule (_isSafeShortLabel, after step 1)
 *    plus Theo's own FRAMEWORK_NAME_RE charset.
 * 10. 369.25 ADDS THREE HANDLE-ONLY ARMS FOR THE FEYMINTO READS (ruling
 *    2026-10-06): find_frameworks_for_problem_type, commands_for_problem_type
 *    and framework_neighborhood, LAST. Same fail-closed posture as item 5: an
 *    exact key set, so any extra or renamed argument declines to ambiguous.
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

  // 361-02 (D-10, D-14): the three Theo calls research mode makes. STRICTER
  // than the arms above on purpose -- D-10 says generic handles only, so the
  // framework value must be an exact, lowercase-normalized member of
  // CANONICAL_PHRASES (see _isKnownFrameworkHandle just below this function),
  // not merely a safe short label. Placed LAST, after recommend_chain, and
  // before the terminal return null below.
  if (toolName.indexOf('framework_step') !== -1) {
    if (!_hasExactKeys(payload, ['framework'], ['step_id'])) return null;
    if (!_isKnownFrameworkHandle(payload.framework)) return null;
    if (Object.prototype.hasOwnProperty.call(payload, 'step_id')) {
      if (typeof payload.step_id !== 'string' || !PROCESS_STEP_ID_RE.test(payload.step_id)) return null;
    }
    return { class: 'known_tool_shape', reason: 'framework_step canonical framework handle' };
  }

  if (toolName.indexOf('framework_techniques') !== -1) {
    if (!_hasExactKeys(payload, ['framework'], [])) return null;
    if (!_isKnownFrameworkHandle(payload.framework)) return null;
    return { class: 'known_tool_shape', reason: 'framework_techniques canonical framework handle' };
  }

  // case_story (361-09, D-15 resolved): mirrors Theo 20.1-04's
  // /home/jsagi/Theo/src/mcp/content/case-story.ts. Both keys, case_name and
  // framework_name, are OPTIONAL at the wire (each is Theo's handle(): a
  // string over FRAMEWORK_NAME_PATTERN capped at 128, sealed by
  // z.strictObject), and the handler enforces EXACTLY ONE OF: neither or both
  // is refused with EXACTLY_ONE_OF. The tool is still unregistered at Theo
  // e501bbe (registration is Theo 20.1-16). D-15's `{framework}` guess is
  // retired: that key now falls to the terminal ambiguous, never allow.
  if (toolName.indexOf('case_story') !== -1) {
    if (!_hasExactKeys(payload, [], ['case_name', 'framework_name'])) return null;
    const hasCaseName = Object.prototype.hasOwnProperty.call(payload, 'case_name');
    const hasFrameworkName = Object.prototype.hasOwnProperty.call(payload, 'framework_name');
    // Neither, or both: a shape Theo refuses is not a known-good shape, so it
    // falls to the terminal ambiguous, never allow.
    if (hasCaseName === hasFrameworkName) return null;
    if (hasFrameworkName) {
      if (!_isKnownFrameworkHandle(payload.framework_name)) return null;
      return { class: 'known_tool_shape', reason: 'case_story canonical framework handle' };
    }
    // case_name: no local closed case vocabulary exists (data/ holds none),
    // so per Canon Part 8 case_name gets exactly the free-handle proof this
    // function already gives find_connections' from/to (step 1 ran first and
    // default-deny; _isSafeShortLabel re-runs the audit independently; the
    // 120-char cap is stricter than Theo's 128, so a 121-128 char name is
    // ambiguous, never allowed), plus Theo's own charset. The plugin itself
    // never sends case_name (theo-structure sends framework_name only, 361-10).
    if (!_isSafeShortLabel(payload.case_name)) return null;
    if (!FRAMEWORK_NAME_RE.test(payload.case_name)) return null;
    return { class: 'known_tool_shape', reason: 'case_story case_name label' };
  }

  // 369.25-05 (ruling 2026-10-06): three handle-only arms for the FeyMinto reads, LAST, before the terminal
  // return null. Each is exact-key-set and closed-vocabulary: problem_type is a member of
  // RECOMMEND_CHAIN_PROBLEM_TYPES (the arm is stricter than that set needs to be, FeyMinto only sends Theo's
  // four ids), framework is an exact CANONICAL_PHRASES member via _isKnownFrameworkHandle, and a limit, when
  // present, is an integer 1..100 (Theo's own bound; FeyMinto omits it). None of the three names contains
  // another arm's name (find_connections, taxonomy_ladder, recommend_chain, framework_step,
  // framework_techniques, case_story), so the indexOf ordering above cannot shadow them.
  if (toolName.indexOf('find_frameworks_for_problem_type') !== -1) {
    if (!_hasExactKeys(payload, ['problem_type'], [])) return null;
    if (typeof payload.problem_type !== 'string'
        || !RECOMMEND_CHAIN_PROBLEM_TYPES.has(payload.problem_type)) return null;
    return { class: 'known_tool_shape', reason: 'find_frameworks_for_problem_type problem_type enum' };
  }

  if (toolName.indexOf('commands_for_problem_type') !== -1) {
    if (!_hasExactKeys(payload, ['problem_type'], ['limit'])) return null;
    if (typeof payload.problem_type !== 'string'
        || !RECOMMEND_CHAIN_PROBLEM_TYPES.has(payload.problem_type)) return null;
    if (Object.prototype.hasOwnProperty.call(payload, 'limit')) {
      if (!Number.isInteger(payload.limit) || payload.limit < 1 || payload.limit > 100) return null;
    }
    return { class: 'known_tool_shape', reason: 'commands_for_problem_type problem_type enum' };
  }

  if (toolName.indexOf('framework_neighborhood') !== -1) {
    if (!_hasExactKeys(payload, ['framework'], [])) return null;
    if (!_isKnownFrameworkHandle(payload.framework)) return null;
    return { class: 'known_tool_shape', reason: 'framework_neighborhood canonical framework handle' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 361-02 (D-10, D-14): the canonical-framework-handle proof shared by the
// three arms just above (framework_step, framework_techniques, and
// case_story's framework_name path; 361-09). FRAMEWORK_NAME_RE is also the
// charset gate on case_story's case_name, since Theo's handle() applies the
// same pattern to both keys.
// GENERIC HANDLES ONLY per D-10 -- this is STRICTER than find_connections's
// _isSafeShortLabel on purpose: find_connections proves any safe short label,
// this additionally proves EXACT MEMBERSHIP (never a substring match) in
// CANONICAL_PHRASES, the same frozen, lowercased vocabulary _proveTypedQuestion
// already trusts (data/framework-names.json). FRAMEWORK_NAME_RE and
// PROCESS_STEP_ID_RE below are byte-for-byte copies of Theo's own
// FRAMEWORK_NAME_PATTERN and PROCESS_STEP_ID_PATTERN
// (/home/jsagi/Theo/src/mcp/content/vocabulary.ts); tests/test-361-theo-
// parity.cjs pins that copy so a Theo-side change is caught, not silently
// drifted from. CANONICAL_PHRASES is read at CALL time, not at
// function-definition time: this file's module-level `const`s (including
// CANONICAL_PHRASES, declared further down this file) finish initializing
// before classify() is ever invoked, and _isKnownFrameworkHandle is a
// function DECLARATION, which hoists -- so the arms above may call it despite
// its later textual position.
// 2026-10-19 (quick 261019-gct): Theo Phase 42/45 widened the pattern with phase42:: and export13- ids and a 160-char cap; PROCESS_STEP_ID_RE re-synced.
// ---------------------------------------------------------------------------
const FRAMEWORK_NAME_RE = /^[A-Za-z0-9 '(),.\/-]{1,128}$/;
const PROCESS_STEP_ID_RE = /^(?=.{1,160}$)(?:[a-z0-9]{1,64}::[a-z0-9]{1,64}(?:-[a-z0-9]{1,64}){0,8}::(?:s\d{2}(?:::p\d{2})?|p\d{2}|t\d{2})|phase42::(?:framework|command)::[a-z0-9]{1,64}(?:-[a-z0-9]{1,64}){0,15}::[a-z0-9]{1,64}(?:-[a-z0-9]{1,64}){0,15}|export13-[0-9a-f]{16})$/;

function _isKnownFrameworkHandle(v) {
  if (!_isSafeShortLabel(v)) return false;
  if (!FRAMEWORK_NAME_RE.test(v)) return false;
  // Fail closed on a vocabulary load failure, mirroring
  // _TYPED_QUESTION_DATA_LOADED: an empty CANONICAL_PHRASES means the shipped
  // data/framework-names.json did not load, and proving against an empty
  // vocabulary would be vacuously permissive rather than fail-closed.
  if (CANONICAL_PHRASES.length === 0) return false;
  return CANONICAL_PHRASES.indexOf(v.toLowerCase()) !== -1;
}

// ---------------------------------------------------------------------------
// Plan 386-25 (E-TYPED): allow arms for the typed Theo read tools.
// Debug session (.planning/debug, 2026-11): the guard blocked every call on
// the direct Brain connector of that time unconditionally (the connector key
// itself is retired since Phase 392 plan 06, D-08).
//
// WHY. Before this plan classify() had allow arms for 9 tool shapes. Every other
// typed read tool (normalize_framework_name, discover_structure,
// orchestration_readiness, feeds_into_chains, framework_concepts, search,
// brain_ask in op mode) fell to the terminal ambiguous. The hook blocks an
// ambiguous verdict on a direct connector whatever the payload says, which is
// the "unconditional block" symptom. An allow needs a positive rule; these are
// those rules.
//
// TWO KINDS.
//   handle    exact key set; each value a canonical framework handle, a command
//             slug, an integer in a closed range, or (brain_ask op mode) a closed
//             enum. No word list: the proof is membership in a closed set.
//   freeform  the one string value is decided by theoVerdict, exactly as a
//             brain_ask question is decided (parity): allow or block, never
//             ambiguous. This plan adds no new loosening and no new tightening
//             for a keyword query. The sprout bypass for every free-form route is
//             the owner's decision in plan 386-32 and is built in plan 386-33.
//
// BOUNDARY NEUTRALITY. Same argument as _proveKnownToolShape. _proveTypedReadShape
// and the freeform route sit AFTER step 1 (the default-deny scan) and step 1b,
// and BEFORE only the navigator release arm and the terminal ambiguous return.
// They can turn an ambiguous into an allow (handle arms) or an ambiguous into a
// theoVerdict answer (freeform). They cannot shadow a block. Weakening step 1
// would turn these arms into a hole, as with every arm of this kind.
//
// FAIL CLOSED ON SCHEMA DRIFT. Key sets are exact. An extra or renamed key
// declines the proof and the call stays ambiguous.
//
// A NEW TYPED TOOL needs a row in TYPED_READ_TOOLS and a test in
// tests/test-386-typed-theo-allow-arms.cjs.
//
// CREDENTIALS. A credential-shaped token is a sprout by shape, so it would pass
// a shape test. The freeform route therefore refuses one long opaque token
// (_hasOpaqueSecretToken) before it asks theoVerdict. Plan 386-31 adds the full
// credential shape list to the Canon scan, which then covers every route.
// ---------------------------------------------------------------------------
const TYPED_READ_TOOLS = Object.freeze({
  normalize_framework_name: Object.freeze({ kind: 'handle', required: ['raw'], optional: [], fields: Object.freeze({ raw: 'handle' }) }),
  discover_structure: Object.freeze({ kind: 'handle', required: ['framework_name'], optional: [], fields: Object.freeze({ framework_name: 'handle' }) }),
  orchestration_readiness: Object.freeze({ kind: 'handle', required: ['framework_name'], optional: [], fields: Object.freeze({ framework_name: 'handle' }) }),
  feeds_into_chains: Object.freeze({
    kind: 'handle',
    required: ['seeds', 'max_hops'],
    optional: [],
    fields: Object.freeze({ seeds: 'seeds', max_hops: Object.freeze({ min: 1, max: 3 }) }),
  }),
  framework_concepts: Object.freeze({
    kind: 'handle',
    required: ['framework'],
    optional: ['limit'],
    fields: Object.freeze({ framework: 'handle', limit: Object.freeze({ min: 1, max: 10 }) }),
  }),
  search: Object.freeze({
    kind: 'freeform',
    required: ['query'],
    optional: ['topK'],
    stringKey: 'query',
    fields: Object.freeze({ topK: Object.freeze({ min: 1, max: 20 }) }),
  }),
  // Theo's classify_problem_type takes no parameters (strictObject, empty); {}
  // already allows as an empty payload. A `statement` string is decided as
  // brain_ask decides it. Theo refuses the key, so no live channel is added.
  classify_problem_type: Object.freeze({
    kind: 'freeform',
    required: ['statement'],
    optional: [],
    stringKey: 'statement',
    fields: Object.freeze({}),
  }),
});

const BRAIN_ASK_OP_NAMES = Object.freeze(['list_frameworks', 'framework_edges', 'framework_chain_slice']);
const BRAIN_ASK_EDGE_TYPE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const BRAIN_ASK_PARAM_KEYS = Object.freeze(['framework', 'edge_type', 'seeds', 'max_hops', 'limit']);
const TYPED_SEEDS_MAX = 10;

// The tool-name rule: the part after the last double underscore, or the whole
// name. mcp__theo__search -> search; mcp__x__brain_search -> brain_search (not a
// typed tool here; brain_search is a free-form tool decided in step 3).
function _typedToolBase(toolName) {
  if (typeof toolName !== 'string' || toolName.length === 0) return '';
  const at = toolName.lastIndexOf('__');
  return at === -1 ? toolName : toolName.slice(at + 2);
}

// ---------------------------------------------------------------------------
// Plan 392-06 (F6 bypass 5, D-08): the Theo tool class table.
//
// WHY. The widened hook matcher (hooks/hooks.json, BRAIN_SHAPED_TOOL_MATCHER)
// now sends every Theo route to classify(): the `theo` stdio server, the
// theo-context server and the claude.ai connectors, about 60 tool names. The
// Theo CLAUDE.md names two classes. Content tools (search, text2cypher,
// recommend_chain, case_story and the rest) receive GENERIC HANDLES ONLY and
// are scanned: a typed arm when TYPED_READ_TOOLS or _proveKnownToolShape has
// a row, the generic content arm (_genericContentVerdict) otherwise.
// Operational tools (the absorbed mindrian-os surface: room_bind, graph_write,
// gate_render, gate_answer, chain_run and the rest) legitimately carry room
// content, because writing it is their job; the guard allows them with the
// class operational_tool and does NOT scan them, and the hook records that
// class in telemetry (class only). An auth tool is allowed with the class
// auth_tool, not scanned.
//
// THE TABLE IS DATA. data/theo-tool-classes.json, schema_version 1, a map of
// bare tool name to class. It is read ONCE with fs.readFileSync (never
// require, so the hook's fresh-process module count stays flat: LZ5 of
// tests/test-386-folder-memory-lazy-timeline.cjs) and only on the first name
// that is not brain_*. A brain_* name is content on every server without a
// read. An unreadable table, a malformed table or a name absent from the
// table all resolve to content (fail closed: the name is scanned).
//
// THE LOOKUP KEY is the part after the last double underscore, the same rule
// _typedToolBase applies: mcp__theo__room_bind -> room_bind;
// mcp__claude_ai_Theo-Claude__canon_search -> canon_search.
// ---------------------------------------------------------------------------
const TOOL_CLASS_TABLE_PATH = path.join(__dirname, '..', '..', 'data', 'theo-tool-classes.json');
const TOOL_CLASSES = Object.freeze(['content', 'operational', 'auth']);
const CONTENT_STRING_CAP = 256;
// The content tools that already have an exact-key typed arm above
// (_proveKnownToolShape). Together with TYPED_READ_TOOLS they keep their
// fail-closed posture: an extra or renamed key declines the proof and the
// call stays ambiguous (plan 386-25, test TB2). The generic content arm
// never reaches them.
const KNOWN_SHAPE_TOOLS = Object.freeze(new Set([
  'case_story', 'commands_for_problem_type', 'find_connections', 'find_frameworks_for_problem_type',
  'framework_neighborhood', 'framework_step', 'framework_techniques', 'recommend_chain', 'taxonomy_ladder',
]));

// True when the name has its own typed arm (exact keys, fail closed), so the
// generic content arm must not decide it.
function _hasTypedArm(base) {
  return base.indexOf('brain_') === 0 || KNOWN_SHAPE_TOOLS.has(base) || Object.prototype.hasOwnProperty.call(TYPED_READ_TOOLS, base);
}
let _toolClassTable; // undefined = not read yet; null = unreadable (every name is content)

function _loadToolClassTable() {
  if (_toolClassTable !== undefined) return _toolClassTable;
  try {
    const doc = JSON.parse(fs.readFileSync(TOOL_CLASS_TABLE_PATH, 'utf8'));
    const classes = doc && doc.classes;
    _toolClassTable = (classes !== null && typeof classes === 'object' && !Array.isArray(classes)) ? classes : null;
  } catch (_e) {
    _toolClassTable = null;
  }
  return _toolClassTable;
}

/**
 * _theoToolClass(toolName) -> 'content' | 'operational' | 'auth'
 *
 * The declared class of a Theo tool name (data/theo-tool-classes.json). A
 * brain_* name, an empty name, an unreadable table and an unknown name all
 * answer content, so the name is scanned.
 */
function _theoToolClass(toolName) {
  const base = _typedToolBase(toolName);
  if (base === '' || base.indexOf('brain_') === 0) return 'content';
  const table = _loadToolClassTable();
  if (!table) return 'content';
  const c = table[base];
  return (typeof c === 'string' && TOOL_CLASSES.indexOf(c) !== -1) ? c : 'content';
}

/**
 * _genericContentVerdict(payload, opts) -> verdict | null
 *
 * The generic content arm (plan 392-06): a content tool with no typed arm is
 * decided by the same free-form rules as a brain_ask question. Every string
 * leaf of the payload is collected (the 392-05 walker; over budget blocks
 * unread). A leaf longer than CONTENT_STRING_CAP (256, Theo's own search
 * cap) blocks content_set with the reason string_over_cap and the key path,
 * never the text. When a FREEFORM_KEYS key is present, theoVerdict decides
 * the payload (primary key first, then every other leaf, strictest wins).
 * Otherwise each leaf is decided as a bare string by _theoStringVerdict with
 * the room resolved once; the first block returns with leaf_path; an allow
 * is typed_question when every leaf proved, generic_question otherwise.
 * A payload with no string leaf answers null: the caller keeps the terminal
 * ambiguous verdict (the gate decides; fail closed).
 */
function _genericContentVerdict(payload, opts) {
  const leaves = _collectStringLeaves(payload);
  if (!Array.isArray(leaves)) return _overBudgetBlock(leaves.reason);
  const strings = leaves.filter(function (l) { return l.value.length > 0; });
  if (strings.length === 0) return null;
  for (let i = 0; i < strings.length; i++) {
    if (strings[i].value.length > CONTENT_STRING_CAP) {
      return { verdict: 'block', class: 'content_set', token_class: null, reason: 'string_over_cap', leaf_path: strings[i].path, cap: CONTENT_STRING_CAP };
    }
  }
  if (_primaryFreeFormKey(payload) !== null) {
    return theoVerdict(payload, { toolName: opts.toolName, roomDir: opts.roomDir, lexicon: opts.lexicon });
  }
  let leafOpts = { toolName: opts.toolName, roomDir: opts.roomDir, lexicon: opts.lexicon };
  if (!opts.lexicon && opts.roomDir === undefined) {
    leafOpts.roomDir = _roomLexicon ? _roomLexicon.resolveLexiconRoomDir() : null;
  }
  let allTyped = true;
  for (let i = 0; i < strings.length; i++) {
    const v = _theoStringVerdict(strings[i].value, null, leafOpts);
    if (v.verdict === 'block') {
      v.leaf_path = strings[i].path;
      return v;
    }
    if (v.class !== 'typed_question') allTyped = false;
  }
  return allTyped
    ? { verdict: 'allow', class: 'typed_question', token_class: null, reason: 'closed-vocabulary methodology handles on every string leaf' }
    : { verdict: 'allow', class: 'generic_question', token_class: null, reason: 'generic methodology strings with no room-local token' };
}

function _inIntRange(v, range) {
  return Number.isInteger(v) && v >= range.min && v <= range.max;
}

// A seed is a canonical framework handle, or a command slug /mos:<slug> that
// the command registry carries (Theo accepts both as exact node names).
function _isSeedHandle(v) {
  if (_isKnownFrameworkHandle(v)) return true;
  if (typeof v !== 'string' || v.indexOf('/mos:') !== 0) return false;
  if (COMMAND_SLUG_SET.size === 0) return false;
  return COMMAND_SLUG_SET.has(v.slice('/mos:'.length).toLowerCase()) && _isSafeShortLabel(v);
}

function _isSeedList(v) {
  if (!Array.isArray(v) || v.length < 1 || v.length > TYPED_SEEDS_MAX) return false;
  for (let i = 0; i < v.length; i++) {
    if (!_isSeedHandle(v[i])) return false;
  }
  return true;
}

function _typedFieldOk(spec, value) {
  if (spec === 'handle') return _isKnownFrameworkHandle(value);
  if (spec === 'seeds') return _isSeedList(value);
  if (spec !== null && typeof spec === 'object') return _inIntRange(value, spec);
  return false;
}

// One long opaque token (32 or more characters without a space) is the shape
// of a key or a token, not of a keyword. A shape rule, not a word list.
function _hasOpaqueSecretToken(str) {
  if (typeof str !== 'string') return false;
  return /[^\s]{32,}/.test(str);
}

// brain_ask op mode: {op, params?}. op is a closed enum; params is a plain
// object whose keys are the five Theo allows and whose values are canonical
// handles, command slugs, an edge type token, or integers.
function _proveBrainAskOpShape(payload) {
  if (!_hasExactKeys(payload, ['op'], ['params'])) return null;
  if (typeof payload.op !== 'string' || BRAIN_ASK_OP_NAMES.indexOf(payload.op) === -1) return null;
  if (Object.prototype.hasOwnProperty.call(payload, 'params')) {
    const p = payload.params;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) return null;
    const keys = Object.keys(p);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (BRAIN_ASK_PARAM_KEYS.indexOf(k) === -1) return null;
      const val = p[k];
      if (k === 'framework') {
        if (!_isKnownFrameworkHandle(val)) return null;
      } else if (k === 'edge_type') {
        if (typeof val !== 'string' || !BRAIN_ASK_EDGE_TYPE_RE.test(val)) return null;
      } else if (k === 'seeds') {
        if (!_isSeedList(val)) return null;
      } else if (k === 'max_hops') {
        if (!_inIntRange(val, { min: 1, max: 3 })) return null;
      } else if (k === 'limit') {
        if (!_inIntRange(val, { min: 1, max: 200 })) return null;
      }
    }
  }
  return { class: 'typed_read_shape', reason: 'brain_ask op mode: closed op, handle params' };
}

/**
 * _typedFreeformString(payload, toolName) -> string | null
 *
 * The free-text value of a freeform typed tool (search, classify_problem_type),
 * when the key set is exact and the optional numeric field is in range. Null
 * otherwise (the call then stays ambiguous, as before this plan).
 */
function _typedFreeformString(payload, toolName) {
  const row = TYPED_READ_TOOLS[_typedToolBase(toolName)];
  if (!row || row.kind !== 'freeform') return null;
  if (!_hasExactKeys(payload, row.required, row.optional)) return null;
  const s = payload[row.stringKey];
  if (typeof s !== 'string' || s.length === 0) return null;
  const keys = Object.keys(row.fields);
  for (let i = 0; i < keys.length; i++) {
    if (Object.prototype.hasOwnProperty.call(payload, keys[i]) && !_typedFieldOk(row.fields[keys[i]], payload[keys[i]])) return null;
  }
  return s;
}

/**
 * _proveTypedReadShape(payload, toolName) -> null | { class, reason }
 *
 * The handle arms and brain_ask op mode. See the section comment above for the
 * boundary-neutrality argument. Freeform typed tools are not decided here; they
 * go to theoVerdict through _typedFreeformString.
 */
function _proveTypedReadShape(payload, toolName) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const base = _typedToolBase(toolName);
  if (base === 'brain_ask') return _proveBrainAskOpShape(payload);
  const row = TYPED_READ_TOOLS[base];
  if (!row || row.kind !== 'handle') return null;
  if (!_hasExactKeys(payload, row.required, row.optional)) return null;
  const keys = Object.keys(payload);
  for (let i = 0; i < keys.length; i++) {
    if (!_typedFieldOk(row.fields[keys[i]], payload[keys[i]])) return null;
  }
  return { class: 'typed_read_shape', reason: base + ' typed read: exact keys, canonical handles' };
}

// ---------------------------------------------------------------------------
// Plan 392-09 (phase wave 3, item P3; 392-SC3, 392-SC4): the typed shape arm.
//
// WHY. Part 8 moves from "filter the free text we send to the Brain" to "send
// only a closed-vocabulary problem shape plus the generic question" (392-CONTEXT
// D-01, D-02). The three free-form Theo tools accept their free-text key plus
// an optional `shape` object built by lib/core/brain-shape-packet.cjs from the
// bound room (one builder, never the model). The guard checks the shape by
// EXACT ENUM MEMBERSHIP (validateShapePacket) before any free-text rule: a
// bad shape is a typed block (class shape_invalid, the field named), never a
// repair or a silent drop. A validated shape holds enum ids only, so its
// subtree never enters the free-text walk. The free-text key is decided by
// theoVerdict under a 240 character cap (reason question_too_long; the
// recognizer's own cap). ANY other key beside the pair blocks: the arm is an
// exact key set (fail closed on schema drift, the 386-25 posture), so a
// sibling leaf cannot ride beside a valid shape. brain_write is blocked at
// step 1c before this arm runs (plan 386-04). The old sprout, edge and body
// rules (plan 386-33) stay as a belt on the free-text key only.
//
// KEY NAMES. 392-CONTEXT names {question, shape}. brain_search carries `query`
// (shim scripts/mindrian-brain-mcp-client.cjs) and classify_problem_type
// carries `statement` (TYPED_READ_TOOLS); renaming a wire key is Theo's
// contract, not this repo's, so each tool keeps its own free-text key.
//
// DECLARED NON-TEXT PARAMETERS (D-07 constraint from the release session,
// 2026-11-09). The Phase 389 pyramid Seed calls brain-client search(phrase,
// {topK}) and the shipped client sends {query, namespace: undefined, topK}
// (brain-client.cjs search()). A declared non-text parameter of the tool is
// an allowed key beside the pair: brain_search topK, an integer 1..50 (the
// shim's bound). A key whose value is undefined is not on the wire (JSON
// drops it) and is treated as absent. namespace is a declared STRING
// parameter of the shim, so it is free text outside the free-text key: a
// string namespace blocks (reason unexpected_key, leaf_path namespace).
// "Any other string leaf blocks" applies to undeclared keys and to text
// outside the free-text key, never to a declared integer.
//
// NON-LATIN SCRIPT (carried from 392-03 deviation 1, decided here). Under this
// arm a question in Hebrew, Arabic, Cyrillic or CJK is not blocked for its
// script. It fails the typed-question fast path (Latin vocabulary) and then
// takes the same rules as any question: the Unicode-aware room lexicon, the
// sprout rule, the credential and body patterns, the 240 cap. The bare
// (unshaped) path keeps the 392-03 block. opts.typedArm carries the switch.
//
// LAZY. brain-shape-packet.cjs is required on the first shaped payload only,
// so the hook's fresh-process module count stays flat (LZ5 of
// tests/test-386-folder-memory-lazy-timeline.cjs; tests/test-369-hook-
// require-graph.cjs). A load failure blocks with class guard_unavailable.
// ---------------------------------------------------------------------------
const SHAPED_ARM_TOOLS = Object.freeze({
  brain_ask: Object.freeze({ stringKey: 'question', params: Object.freeze({}) }),
  brain_search: Object.freeze({ stringKey: 'query', params: Object.freeze({ topK: Object.freeze({ min: 1, max: 50 }) }) }),
  classify_problem_type: Object.freeze({ stringKey: 'statement', params: Object.freeze({}) }),
});
const SHAPED_QUESTION_CAP = 240;
const SAFE_KEY_PATH = /^[A-Za-z0-9_.-]{1,40}$/;

let _shapePacket; // undefined = not loaded yet; null = unavailable (every shaped payload blocks)

function _loadShapePacket() {
  if (_shapePacket !== undefined) return _shapePacket;
  try {
    const mod = require('./brain-shape-packet.cjs');
    _shapePacket = (mod && typeof mod.validateShapePacket === 'function') ? mod : null;
  } catch (_e) {
    _shapePacket = null;
  }
  return _shapePacket;
}

// The arm's row for a tool name, or null. Bare and scoped names alike
// (mcp__theo__classify_problem_type -> classify_problem_type).
function _shapedArmRow(toolName) {
  const base = _typedToolBase(toolName);
  return Object.prototype.hasOwnProperty.call(SHAPED_ARM_TOOLS, base) ? SHAPED_ARM_TOOLS[base] : null;
}

function _hasShapeKey(payload) {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload) &&
    Object.prototype.hasOwnProperty.call(payload, 'shape');
}

/**
 * _shapedArmVerdict(payload, row, opts) -> verdict (never null)
 *
 * 1. validateShapePacket(payload.shape): {ok: false} -> block shape_invalid
 *    with `field` (the validator's field, a closed key name) and `members`
 *    count; a validator that cannot load -> block guard_unavailable.
 * 2. Exact keys: every key other than row.stringKey, `shape` and the row's
 *    declared non-text parameters -> block content_set, reason
 *    unexpected_key, leaf_path (the key when it is a short safe path, else
 *    the literal "key"). A key with the value undefined is absent. A declared
 *    parameter outside its integer range -> block content_set, reason
 *    param_out_of_range, leaf_path.
 * 3. The free-text key: missing or empty -> block unknown; longer than 240
 *    characters -> block content_set, reason question_too_long, cap 240.
 * 4. theoVerdict on the string alone (bare-string path: the shape helper, the
 *    credential patterns, the lexicon, the sprout, edge and body rules) with
 *    typedArm true (the non-Latin script rule is skipped; see above).
 * Every verdict after step 1 carries shape_validated true. No field carries
 * the free text, a shape member or a byte of either.
 */
function _shapedArmVerdict(payload, row, opts) {
  const sp = _loadShapePacket();
  if (!sp) {
    return { verdict: 'block', class: 'guard_unavailable', token_class: null, reason: 'the shape validator could not load; nothing is sent' };
  }
  let result = null;
  try { result = sp.validateShapePacket(payload.shape); } catch (_e) { result = null; }
  if (!result || result.ok !== true) {
    const field = (result && typeof result.field === 'string' && SAFE_KEY_PATH.test(result.field)) ? result.field : 'shape';
    const v = { verdict: 'block', class: 'shape_invalid', token_class: null, reason: 'the shape is not a closed-vocabulary packet; it is refused, never repaired', field: field };
    if (result && Array.isArray(result.members)) v.members = result.members.length;
    return v;
  }
  const keys = Object.keys(payload);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k === row.stringKey || k === 'shape' || payload[k] === undefined) continue;
    const leafPath = SAFE_KEY_PATH.test(k) ? k : 'key';
    if (Object.prototype.hasOwnProperty.call(row.params, k)) {
      if (_inIntRange(payload[k], row.params[k])) continue;
      return { verdict: 'block', class: 'content_set', token_class: null, reason: 'param_out_of_range', leaf_path: leafPath, shape_validated: true };
    }
    return { verdict: 'block', class: 'content_set', token_class: null, reason: 'unexpected_key', leaf_path: leafPath, shape_validated: true };
  }
  const str = payload[row.stringKey];
  if (typeof str !== 'string' || str.length === 0) {
    return { verdict: 'block', class: 'unknown', token_class: null, reason: 'no free-form string beside the shape', shape_validated: true };
  }
  if (str.length > SHAPED_QUESTION_CAP) {
    return { verdict: 'block', class: 'content_set', token_class: null, reason: 'question_too_long', cap: SHAPED_QUESTION_CAP, shape_validated: true };
  }
  const v = theoVerdict(str, { toolName: opts.toolName, roomDir: opts.roomDir, lexicon: opts.lexicon, typedArm: true });
  v.shape_validated = true;
  return v;
}

// ---------------------------------------------------------------------------
// Phase 366-11 (D-13 a): the navigator-consent allow.
// ---------------------------------------------------------------------------
const RELEASE_GATE_ID_RE = /^gate-[0-9a-f]{16}$/;
const RELEASE_SECTION_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// The closed JTBD handle vocabulary, read at call time from the shipped taxonomy.
// An unreadable file yields an empty set, so an intent is never proven (fail closed).
function _releaseIntentVocabulary() {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hmi', 'jtbd-taxonomy.json'), 'utf8'));
    const ids = Array.isArray(doc && doc.entries) ? doc.entries.map(function (e) { return e && e.id; }) : [];
    return ids.filter(function (id) { return typeof id === 'string' && id.length > 0; });
  } catch (_e) {
    return [];
  }
}

// The perspective ids, read lazily from the registry. A load failure yields an empty list (fail closed).
function _releasePerspectiveIds() {
  try {
    return require('./research-planner/perspectives/index.cjs').PERSPECTIVE_IDS.slice();
  } catch (_e) {
    return [];
  }
}

/**
 * _proveNavigatorRelease(payload, opts) -> null | {verdict, class, reason}
 *
 * THE ONLY WIDENED PATH. Every other arm in this file narrows `ambiguous` by proving a
 * payload is a closed vocabulary (a canonical handle, a rung enum). This arm is different in
 * kind: it admits a room-vocabulary term (a word the navigator's own artifact carries, which
 * is NOT in the canon snapshot) because the NAVIGATOR said yes to that exact term on an F.8
 * card (D-13 a, ruled 2026-10-01: "the guard can change ... the intent and context must lead
 * not just names"). Consent is the proof, so the proof is a receipt, not the payload's shape.
 *
 * It allows only when ALL of these hold, and returns null (no opinion) otherwise:
 *   1. opts.toolName contains normalize_framework_name (no other tool is ever released);
 *   2. opts.release is an object whose gate_id matches the gate-ledger id format and whose
 *      term is a string (the receipt rides in opts, never in the payload, so a payload cannot
 *      forge its own consent);
 *   3. the payload keys are exactly raw, plus optionally intent, section, perspective;
 *   4. payload.raw === receipt.term (the exact released bytes, no trimming) and is a safe
 *      short label (_isSafeShortLabel: single line, 1-120 chars, clears the content audit);
 *   5. intent, when present, is a member of the closed JTBD handle vocabulary (never prose);
 *      section, when present, is a lowercase slug; perspective, when present, is a registry id.
 *
 * ORDERING IS THE OTHER HALF OF THE ARGUMENT. classify() calls this AFTER the CONTENT-SET
 * default-deny scan (so a term carrying an email, a key or any forbidden pattern is blocked
 * even with a receipt), after the provably-empty arm, after the packet, free-form and
 * known-tool-shape arms, and immediately before the terminal ambiguous return. It can only turn
 * an `ambiguous` into an `allow`; it can never preempt a block or an existing allow.
 *
 * It does not use the free-form string path (_isFreeFormTool / _proveTypedQuestion): the term
 * is proven by receipt and shape, so the known false block on generic brain_ask words
 * (SEED-019, SEED-106 item 1) neither helps nor hurts this path.
 *
 * The reason string is a fixed slug and carries none of the released bytes.
 */
function _proveNavigatorRelease(payload, opts) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const toolName = opts && typeof opts.toolName === 'string' ? opts.toolName : '';
  if (toolName.indexOf('normalize_framework_name') === -1) return null;
  const receipt = opts && opts.release;
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) return null;
  if (typeof receipt.gate_id !== 'string' || !RELEASE_GATE_ID_RE.test(receipt.gate_id)) return null;
  if (typeof receipt.term !== 'string') return null;
  if (!_hasExactKeys(payload, ['raw'], ['intent', 'section', 'perspective'])) return null;
  if (payload.raw !== receipt.term) return null;
  if (!_isSafeShortLabel(payload.raw)) return null;
  if (Object.prototype.hasOwnProperty.call(payload, 'intent')) {
    if (typeof payload.intent !== 'string' || _releaseIntentVocabulary().indexOf(payload.intent) === -1) return null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'section')) {
    if (typeof payload.section !== 'string' || !RELEASE_SECTION_RE.test(payload.section)) return null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'perspective')) {
    if (typeof payload.perspective !== 'string' || _releasePerspectiveIds().indexOf(payload.perspective) === -1) return null;
  }
  return { verdict: 'allow', class: 'navigator_released', reason: 'navigator_released' };
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

// Plan 392-03 (bypass 1): the Unicode-aware token split and the vocabulary
// character test used by _proveTypedQuestion. The split keeps every letter and
// digit of every script as token material, so a Hebrew or CJK sentence yields
// tokens instead of an empty list; the second test then refuses any token that
// holds a character outside the Latin closed-vocabulary alphabet.
const TYPED_TOKEN_SPLIT = /[^\p{L}\p{N}_-]+/u;
const TYPED_TOKEN_NON_VOCAB = /[^a-z0-9_-]/;

// Plan 392-03 Task 2: the shared normaliser (NFKC, then strip every \p{Cf}
// format character). Applied at both guard entries, classify and theoVerdict,
// to every string leaf of the payload before any rule runs, so the lexicon
// check, the credential shapes, the sprout shape and the typed proof all see
// the plain form. The guard returns no field that carries string bytes or a
// byte length, so no raw copy is kept.
//
// The module loads lazily, on the first string with a character above 0x7F.
// NFKC and the \p{Cf} strip are both identities on pure ASCII (ASCII has no
// compatibility variant and no Cf code point), so an ASCII string is returned
// as is and the hook's fresh-process module count stays inside the budget of
// tests/test-386-folder-memory-lazy-timeline.cjs LZ5 (the 386-35 pattern: a
// dependency loads only when the input needs it).
const _ASCII_ONLY_RE = /^[\x00-\x7f]*$/;
let _normalizeMod = null;
function _normalizeForGuard(s) {
  if (typeof s !== 'string') return '';
  if (_ASCII_ONLY_RE.test(s)) return s;
  if (!_normalizeMod) _normalizeMod = require('./part8-normalize.cjs');
  return _normalizeMod.normalizeForGuard(s);
}

// A copy of the payload with every string leaf normalised. Arrays and plain
// objects are walked; any other value is kept as is. The depth cap is a guard
// against a pathological nesting; a leaf below it stays raw, and the full
// default-deny scan of step 1 still runs over the raw JSON of such a leaf.
const _NORMALIZE_DEPTH_CAP = 32;
function _normalizePayloadLeaves(value, depth) {
  const d = depth || 0;
  if (typeof value === 'string') return _normalizeForGuard(value);
  if (value === null || typeof value !== 'object' || d >= _NORMALIZE_DEPTH_CAP) return value;
  if (Array.isArray(value)) {
    return value.map(function (v) { return _normalizePayloadLeaves(v, d + 1); });
  }
  const out = {};
  Object.keys(value).forEach(function (k) { out[k] = _normalizePayloadLeaves(value[k], d + 1); });
  return out;
}

/**
 * _proveTypedQuestion(str) -> boolean
 *
 * POSITIVE structural proof that a free-form brain_ask / brain_search string
 * carries ONLY closed-vocabulary tokens: a function word, a methodology
 * token, a canonical framework-name phrase, a command slug, or a bare 1-2
 * digit number. Absence of proof is NOT an allow -- classify() gates it
 * ambiguous (freeform_unproven when methodology vocabulary is present,
 * freeform_unmatched otherwise). Exported as a test seam.
 *
 * Plan 392-03 (bypass 1 of the Phase 392 audit, F6): the tokenizer is
 * Unicode-aware. The string is NFKC-normalised and lowercased, then split on
 * every run of characters that is not a letter, a digit, an underscore or a
 * hyphen (\p{L}, \p{N}, the u flag). Before this plan the split was on
 * /[^a-z0-9_-]+/, so a Hebrew or CJK sentence produced no token at all and
 * the empty loop proved it. Two rules close that hole: an empty token list is
 * no proof (return false), and a token that carries any character outside
 * [a-z0-9_-] after normalisation is outside the closed vocabulary (the
 * vocabulary is Latin-script ids and phrases) and fails the proof.
 */
function _proveTypedQuestion(str) {
  if (!_TYPED_QUESTION_DATA_LOADED) return false;
  if (typeof str !== 'string' || str.length < 1 || str.length > 240) return false;
  if (str.indexOf('\r') !== -1 || str.indexOf('\n') !== -1) return false;
  // Plan 395-13 review CR-04: the token split reads only ASCII words, so a
  // string with any other character (Hebrew, Cyrillic, CJK, a guillemet) is
  // not proven closed-vocabulary. It falls through to the full rules.
  if (/[^\x00-\x7F]/.test(str.replace(/[\u2018\u2019\u201C\u201D]/g, ''))) return false;
  if (!_safeAudit(str)) return false;

  let lowered = _normalizeForGuard(str).toLowerCase();
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

  const tokens = lowered.split(TYPED_TOKEN_SPLIT).filter(function (t) { return t.length > 0; });
  if (tokens.length === 0) return false; // an empty proof is no proof (392-03)
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // A letter or digit outside [a-z0-9_-] (Hebrew, CJK, an accented Latin
    // letter, a non-ASCII digit) is outside the closed vocabulary.
    if (TYPED_TOKEN_NON_VOCAB.test(t)) return false;
    if (QUESTION_FUNCTION_WORDS.has(t)) continue;
    if (METHODOLOGY_TOKEN_SET.has(t)) continue;
    if (COMMAND_SLUG_SET.has(t)) continue;
    if (/^[0-9]{1,2}$/.test(t)) continue;
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Phase 369.2 Plan 01 (369.2-R04, CODE-07, J4): theoVerdict, the ONE verdict
// for every free-form Theo string.
// ---------------------------------------------------------------------------
// Canon Part 8 means one thing: no room content to Theo. "Room content" is a
// claim about PROVENANCE and CONTENT, not about the shape of a string, so the
// free-form verdict is decided by what the string names, in this order:
//   1. CONTENT-SET default-deny (_safeAudit; the 8-city fence stays here, on
//      the Theo line only)                      -> block content_set
//   2. the recognizer (_proveTypedQuestion)     -> allow typed_question (fast path)
//   3. the bound room's lexicon (names, claims, people, ventures, artifact
//      titles; lib/core/part8-room-lexicon.cjs) -> block room_content, or
//      block room_check_unavailable when a bound room cannot be read
//   4. content rules: private-venture context, a non-Latin token (392-03;
//      skipped under the 392-09 typed shape arm), an unknown identifier, an
//      unknown proper name                      -> block room_content
//   5. otherwise                                -> allow generic_question
// Plan 392-09: a shaped payload ({question, shape} and its brain_search and
// classify_problem_type twins) is decided by _shapedArmVerdict in classify
// step 1d; the shape by exact enum membership, the free-text key by this
// order under a 240 character cap.
// brain_ask, brain_search, brain_query, the in-process belt and the PreToolUse
// hook all call this one function (via classify), so one prompt gets one
// disposition. The refusal names a token CLASS, never the token.
const TOKEN_CLASSES = Object.freeze([
  'room_term', 'claim', 'person', 'venture_name', 'room_name', 'room_file',
  'private_context', 'identifier', 'name',
]);

let _roomLexicon = null;
try {
  _roomLexicon = require('./part8-room-lexicon.cjs');
} catch (_e) {
  _roomLexicon = null;
}

// A TitleCase word within two tokens of one of these is a methodology name
// (Minto Pyramid, Lean Canvas, Kano Model), not a venture name.
// The words interview, check and whys are NOT in this set: see
// TITLECASE_TOOL_HEAD_NOUNS below.
const METHODOLOGY_HEAD_NOUNS = Object.freeze(new Set([
  'framework', 'frameworks', 'method', 'methods', 'model', 'models',
  'principle', 'principles', 'pyramid', 'matrix', 'analysis', 'canvas',
  'theory', 'theories',
]));

// 2026-10-18 the navigator added these nouns (option B, debug session
// part8-egress-guard-name-class-blocks-unknown-tool-names) so a tool Theo does
// not know yet (Problem Interview, Opportunity Fitness Check, Five Whys) is not
// read as a person name. Quick 261019-91i narrowed them (SEED-130). A noun
// counts only when it is TitleCase and directly follows an adjacent TitleCase
// word. It exempts only that TitleCase sequence up to and including the noun.
// It never counts in lowercase, before a name, after a function-word bridge, or
// in the 2-token window. Residual: a person name directly before a TitleCase
// noun has the shape of a tool name and still passes ("Marrowby Pell
// Interview"). SEED-130 direction 3 closes that residual.
const TITLECASE_TOOL_HEAD_NOUNS = Object.freeze(new Set([
  'interview', 'check', 'whys',
]));

// Generic single-word technique handles the plugin's own methodology questions
// carry (lib/core/grill-engine.cjs bias techniques). A closed list of
// methodology words, never a room term.
const METHODOLOGY_TECHNIQUE_WORDS = Object.freeze(new Set(['premortem']));

const CYPHER_KEYWORDS = Object.freeze(new Set([
  'match', 'where', 'return', 'with', 'as', 'order', 'by', 'limit', 'skip',
  'optional', 'call', 'yield', 'contains', 'starts', 'ends', 'and', 'or',
  'not', 'in', 'is', 'null', 'distinct', 'union', 'unwind', 'case', 'when',
  'then', 'else', 'end', 'exists', 'count', 'collect', 'asc', 'desc', 'all',
  'any', 'none', 'single', 'true', 'false',
]));

const PRIVATE_POSSESSIVE = /\b(?:my|our)\s+(?:[\p{L}'-]+\s+)?(?:startup|company|venture|product|customers|users|pivot|team|investors|revenue|pricing)\b/iu;
const PRIVATE_CONFIDENTIAL = /\b(?:confidential|internal only|under nda)\b/i;

// Plan 392-03 (bypass 1): a letter outside the Latin script. The methodology
// vocabulary, the command slugs and every name rule are Latin-script, so the
// guard cannot prove a Hebrew, Arabic, Cyrillic or CJK token generic; it fails
// closed. Runs after the lexicon (a bound room's own word reports the lexicon
// hit) and before the identifier rule, in both verdict paths.
const NON_LATIN_LETTER = /(?!\p{Script=Latin})\p{L}/u;
function _hasNonLatinLetter(str) {
  return NON_LATIN_LETTER.test(str);
}
const NON_LATIN_REASON = 'the string carries a token outside the Latin methodology vocabulary; no methodology handle matches it';

// Quick 261118-q35 (owner ruling 2026-11-18, narrows the plan 392-03 rule):
// Hebrew gets the same per-token proof as Latin. A Hebrew token passes the
// script rule, so a generic Hebrew methodology question can pass, and the
// Hebrew string still takes every other rule (the Unicode room lexicon, the
// identifier rule, the private markers below). The rule stays fail closed
// for (a) a letter of any script that has no private-marker set here (CJK,
// Arabic, Cyrillic and the rest: no proof can run on it), and (b) a Hebrew
// string that holds a combining mark (niqqud or cantillation, \p{M}): a mark
// splits a word for the lexicon tokenizer, so a room term could hide in it.
// The input is already NFKC-normalised and free of \p{Cf} (part8-normalize).
const HEBREW_LETTER = /\p{Script=Hebrew}/u;
const UNPROVABLE_SCRIPT_LETTER = /(?!\p{Script=Latin}|\p{Script=Hebrew})\p{L}/u;
const COMBINING_MARK = /\p{M}/u;
function _hasUnprovableLetter(str) {
  if (!_hasNonLatinLetter(str)) return false;
  if (UNPROVABLE_SCRIPT_LETTER.test(str)) return true;
  return HEBREW_LETTER.test(str) && COMBINING_MARK.test(str);
}
// The Hebrew private markers, the counterparts of PRIVATE_WORD,
// POSSESSIVE_MARKER and FIRST_PERSON_CLAUSE_MARKER. A Hebrew word can carry
// up to 3 one-letter prefixes (and, the, in, to, from, that, as). A hit
// blocks in every shape (stricter than the Latin sprout and long-edge rule).
const HE_PREFIX = '[והבלמשכ]{0,3}';
// secret, confidential (classified), proprietary, classified (security).
const HE_SECRET_TOKEN = new RegExp('^' + HE_PREFIX + '(?:סוד(?:י|ית|יים|יות|ות)?|חסוי(?:ה|ים|ות)?|קנייני(?:ת)?|מסווג(?:ת|ים|ות)?)$', 'u');
// mine, ours.
const HE_POSSESSIVE_TOKEN = new RegExp('^' + HE_PREFIX + 'של(?:י|נו)$', 'u');
// internal use, internal only.
const HE_INTERNAL_PHRASE = /שימוש\s+פנימי|פנימי\s+בלבד/u;
// I, we (2 forms) at the start of a clause, as FIRST_PERSON_CLAUSE_MARKER.
const HE_FIRST_PERSON_CLAUSE = /(?:^|[,;:.!]\s+|\n\s*)ו?(?:אני|אנחנו|אנו)(?=\s|$)/u;
// Quick 261118-x1g (owner rulings 2026-11-19: OWNER-R35, OWNER-REDUCE,
// OWNER-FP, OWNER-HE, OWNER-P): the Hebrew prose bound of quick 261118-q35 is
// withdrawn (ruling 35 is the only length bar, in every script). Every
// profiled script gets English-equivalent checks from
// lib/core/part8-script-proof.cjs instead: the check view (marks, tatweel and
// digits folded), the private markers with the English shape split, first
// person at English parity, the email, phone and identifier shapes, the
// mixed-script token rule and the edge name rule. The module loads lazily,
// only for a string with a non-ASCII letter, digit or mark, so an ASCII
// string keeps its verdict and the hook cold start. Each wrapper answers
// block when the module cannot load.
const _SCRIPT_PROOF_NEED_RE = /(?![\x00-\x7F])[\p{L}\p{N}\p{M}]/u;
let _scriptProof; // undefined = not loaded yet; null = unavailable (every wrapper blocks)
function _scriptProofMod() {
  if (_scriptProof === undefined) {
    try { _scriptProof = require('./part8-script-proof.cjs'); } catch (_e) { _scriptProof = null; }
  }
  return _scriptProof;
}
const MIXED_SCRIPT_REASON = 'the string carries a token that mixes Latin letters with another script; no methodology handle has that form';
function _scriptNeeds(str) {
  return typeof str === 'string' && _SCRIPT_PROOF_NEED_RE.test(str);
}
function _scriptCall(fn, onFail) {
  const m = _scriptProofMod();
  if (!m) return onFail;
  try { return fn(m); } catch (_e) { return onFail; }
}
// A letter of a script with no marker row (Thai, Persian, Serbian Cyrillic,
// Armenian, Georgian, Bengali and the rest): no English-equivalent proof runs.
function _hasUnprovableScript(str) {
  if (!_scriptNeeds(str)) return false;
  return _scriptCall(function (m) { return m.hasUnprovableScript(str); }, true);
}
function _scriptCheckView(str) {
  if (!_scriptNeeds(str)) return str;
  return _scriptCall(function (m) { return m.checkView(str); }, str);
}
// The ALWAYS patterns on the check view (native digits), a Unicode email and
// an at-word email.
function _scriptAlwaysHit(str) {
  if (!_scriptNeeds(str)) return false;
  return _scriptCall(function (m) { return m.hasAlwaysShape(str, _ALWAYS_PATTERNS); }, true);
}
// The private markers with the English shape split: private_marker in a
// sprout or a long edge, edge_rule in a short edge. A body and a pasted span
// keep their own outcome (body_shape, pasted_text: the rest of a cut is a
// long edge and takes every marker).
function _scriptPrivateMarker(str, shape) {
  if (!_scriptNeeds(str) || !shape || shape.kind === 'body' || shape.quoted === true) return null;
  const hit = _scriptCall(function (m) { return m.hasPrivateMarker(str, shape); }, true);
  if (!hit) return null;
  return (shape.kind === 'sprout' || shape.longEdge === true) ? _sproutsRequired('private_marker') : _sproutsRequired('edge_rule');
}
function _scriptIdentifier(str) {
  if (!_scriptNeeds(str)) return false;
  return _scriptCall(function (m) { return m.hasIdentifier(str, _hasUnknownIdentifier); }, true);
}
function _scriptMixedToken(str) {
  if (!_scriptNeeds(str)) return false;
  return _scriptCall(function (m) { return m.hasMixedScriptToken(str); }, true);
}
function _scriptNameSets() {
  return { functionWords: QUESTION_FUNCTION_WORDS, methodologyTokens: METHODOLOGY_TOKEN_SET, headNouns: METHODOLOGY_HEAD_NOUNS };
}
// The edge name rule of the cased scripts (TitleCase) and the caseless
// scripts (title cues), and the prose patterns on the check view.
function _scriptEdgeRule(str) {
  if (!_scriptNeeds(str)) return false;
  return _scriptCall(function (m) { return m.hasEdgeNameRule(str, _scriptNameSets()) || m.proseOnView(str, _PROSE_PATTERNS); }, true);
}
// The ASCII name rule reads [A-Za-z] runs only: a Spanish opening mark hides
// the sentence start, and an accented word (Cuál) reads as a fragment (Cu).
// Such a fragment is exempt only when the whole word is exempt under the
// Unicode TitleCase rule. Never for an ASCII string; on failure not exempt.
function _scriptNameFragmentExempt(work, idx, len) {
  if (!_scriptNeeds(work)) return false;
  return _scriptCall(function (m) { return m.nameFragmentExempt(work, idx, len, _scriptNameSets()); }, false);
}
function _hasHebrewPrivateMarker(str) {
  if (typeof str !== 'string' || !HEBREW_LETTER.test(str)) return false;
  if (HE_INTERNAL_PHRASE.test(str) || HE_FIRST_PERSON_CLAUSE.test(str.trim())) return true;
  const tokens = str.split(/[^\p{L}\p{N}]+/u);
  for (let i = 0; i < tokens.length; i += 1) {
    if (HE_SECRET_TOKEN.test(tokens[i]) || HE_POSSESSIVE_TOKEN.test(tokens[i])) return true;
  }
  return false;
}
const THEO_STRING_CEILING = 4000;

// An uppercase-alphanumeric run of 5 or more characters holding a digit and a
// letter (CANARY7F3A2B, ACME2026X): an identifier no methodology handle is.
function _hasUnknownIdentifier(str) {
  const re = /(?<![A-Za-z0-9])[A-Z0-9]{5,}(?![A-Za-z0-9])/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (/[0-9]/.test(m[0]) && /[A-Z]/.test(m[0])) return true;
  }
  return false;
}

// An unknown TitleCase proper name: not sentence-initial, not inside a
// canonical framework phrase, not itself a methodology or Cypher word, not a
// Cypher label or property key, not the literal a Framework node's name is
// compared to, and not within two tokens of a methodology head noun.
function _hasUnknownProperName(str, isCypher) {
  let work = str;
  const lowered = work.toLowerCase();
  if (lowered.length === work.length) {
    let lw = lowered;
    for (let i = 0; i < CANONICAL_PHRASES.length; i++) {
      const phrase = CANONICAL_PHRASES[i];
      let at = lw.indexOf(phrase);
      while (at !== -1) {
        const blank = ' '.repeat(phrase.length);
        work = work.slice(0, at) + blank + work.slice(at + phrase.length);
        lw = lw.slice(0, at) + blank + lw.slice(at + phrase.length);
        at = lw.indexOf(phrase, at + phrase.length);
      }
    }
  }
  if (isCypher) {
    const bound = [];
    const bindRe = /\(\s*(\w+)\s*:\s*Framework\b/g;
    let b;
    while ((b = bindRe.exec(work)) !== null) bound.push(b[1]);
    bound.forEach(function (v) {
      const cmp = new RegExp(
        '\\b' + v + '\\.name\\s*(?:=~|=|CONTAINS|STARTS WITH|ENDS WITH|IN)\\s*(?:\\[[^\\]]*\\]|"[^"]*"|\'[^\']*\')',
        'gi'
      );
      work = work.replace(cmp, function (s) { return ' '.repeat(s.length); });
    });
    work = work.replace(/:\s*[A-Za-z_]\w*/g, function (s) { return ' '.repeat(s.length); });
    work = work.replace(/\.[A-Za-z_]\w*/g, function (s) { return ' '.repeat(s.length); });
  }
  const words = [];
  const wordRe = /[A-Za-z]+(?:-[A-Za-z]+)*/g;
  let m;
  while ((m = wordRe.exec(work)) !== null) {
    words.push({ w: m[0], idx: m.index, lc: m[0].toLowerCase() });
  }
  for (let j = 0; j < words.length; j++) {
    const w = words[j];
    if (!/^[A-Z][a-z]/.test(w.w)) continue;
    // A hyphenated TitleCase compound (Red-Team-Steelman, Reference-Class-
    // Forecasting) is a technique handle, not a person or venture name; the
    // plugin's own generic questions (grill-engine bias techniques) carry them.
    if (w.w.indexOf('-') !== -1) continue;
    if (/(?:^|[.!?\n]\s*)$/.test(work.slice(0, w.idx))) continue; // sentence-initial
    if (_scriptNameFragmentExempt(work, w.idx, w.w.length)) continue; // quick 261118-x1g
    if (QUESTION_FUNCTION_WORDS.has(w.lc) || METHODOLOGY_TOKEN_SET.has(w.lc) ||
        COMMAND_SLUG_SET.has(w.lc) || CYPHER_KEYWORDS.has(w.lc) ||
        METHODOLOGY_TECHNIQUE_WORDS.has(w.lc)) continue;
    let nearHead = false;
    for (let k = Math.max(0, j - 2); k <= Math.min(words.length - 1, j + 2); k++) {
      if (METHODOLOGY_HEAD_NOUNS.has(words[k].lc)) { nearHead = true; break; }
    }
    if (nearHead) continue;
    // A run of adjacent TitleCase words is one name ("Porter Five Forces",
    // "Jobs To Be Done"; a function word may bridge two TitleCase words). When
    // any word of the run is a methodology token or head noun, or the word
    // just outside the run is a head noun ("Jobs To Be Done framework"), the
    // whole run is a methodology name, not a venture name.
    const isTitle = function (x) { return /^[A-Z][a-z]/.test(x.w); };
    const isFn = function (x) { return QUESTION_FUNCTION_WORDS.has(x.lc); };
    const adjacent = function (x, y) { return /^[ \t]+$/.test(work.slice(x.idx + x.w.length, y.idx)); };
    const isMethodologyWord = function (x) { return METHODOLOGY_TOKEN_SET.has(x.lc) || METHODOLOGY_HEAD_NOUNS.has(x.lc); };
    let lo = j;
    while (lo - 1 >= 0 && adjacent(words[lo - 1], words[lo]) &&
           (isTitle(words[lo - 1]) || (isFn(words[lo - 1]) && lo - 2 >= 0 && isTitle(words[lo - 2])))) lo--;
    let hi = j;
    while (hi + 1 < words.length && adjacent(words[hi], words[hi + 1]) &&
           (isTitle(words[hi + 1]) || (isFn(words[hi + 1]) && hi + 2 < words.length && isTitle(words[hi + 2])))) hi++;
    let runIsMethodology = false;
    for (let k = lo; k <= hi; k++) if (isMethodologyWord(words[k])) runIsMethodology = true;
    if (lo - 1 >= 0 && adjacent(words[lo - 1], words[lo]) && METHODOLOGY_HEAD_NOUNS.has(words[lo - 1].lc)) runIsMethodology = true;
    if (hi + 1 < words.length && adjacent(words[hi], words[hi + 1]) && METHODOLOGY_HEAD_NOUNS.has(words[hi + 1].lc)) runIsMethodology = true;
    if (runIsMethodology) continue;
    // SEED-130 (quick 261019-91i): a new tool noun exempts only the TitleCase
    // words directly before it, plus itself, and only when it is TitleCase.
    let toolHead = false;
    for (let n = j; n < words.length; n++) {
      if (n > j && (!adjacent(words[n - 1], words[n]) || !isTitle(words[n]))) break;
      if (TITLECASE_TOOL_HEAD_NOUNS.has(words[n].lc) && isTitle(words[n])) {
        toolHead = n > j || (j - 1 >= 0 && adjacent(words[j - 1], words[j]) && isTitle(words[j - 1]));
        break;
      }
    }
    if (toolHead) continue;
    return true;
  }
  return false;
}

function _theoBlock(klass, tokenClass, reason) {
  return { verdict: 'block', class: klass, token_class: tokenClass || null, reason: reason };
}

// ---------------------------------------------------------------------------
// Plan 386-33 (E-OVER, owner decision option-e of 2026-11-06): the sprout, edge
// and body outcomes of a free-form string.
// ---------------------------------------------------------------------------
// Owner principle (PRD, 2026-11-06): a short keyword query may leave the room, a
// full body of text may not, and the guard must never cripple contextualised
// work. Shape (lib/core/part8-sprout-shape.cjs: size, sentences, lines, quoted
// text) separates a sprout from a body; a word list on an ordinary keyword is
// the wrong tool. So, for a free-form string that is not an assembled Cypher
// template:
//   - credentials and structured identifiers (the ALWAYS half of the Canon list,
//     and the artifact-style identifier rule) block in every shape;
//   - a room-lexicon term blocks in every shape (room_content, its token class);
//   - a body is answered with the class sprouts_required, whatever words it holds;
//   - an edge is answered sprouts_required when a prose rule fires (the PROSE
//     half of the Canon list, the private-context rules or the name rule), and
//     is allow when none fires;
//   - a clear sprout skips the word-list rules and is allow, unless it holds a
//     private-claim marker (a my or our possessive, a first-person clause, a
//     private word), which is answered sprouts_required: the claim stays local,
//     only a generic sprout leaves.
// The class name is SPROUTS_REQUIRED of lib/core/part8-split-route.cjs. The
// reason of every outcome is a constant that holds no word of the input. The
// Cypher key of brain_query is NOT shaped: repo code paths (enrichCausalEdges,
// suggestValidationSteps, hatAwareRecommend) send assembled templates with no
// model to split them (plan 386-26 RCA), so a Cypher string keeps the full
// default-deny list and the old rules.
// If the shape module cannot load, every string takes the old, stricter path.
let _sproutShape = null;
try {
  _sproutShape = require('./part8-sprout-shape.cjs');
} catch (_e) {
  _sproutShape = null;
}
const _ALWAYS_PATTERNS = Array.isArray(egress.ALWAYS_PATTERNS) ? egress.ALWAYS_PATTERNS : null;
const _PROSE_PATTERNS = Array.isArray(egress.PROSE_PATTERNS) ? egress.PROSE_PATTERNS : null;

let _splitRoute = null;
function _sproutsRequiredClass() {
  if (!_splitRoute) {
    try { _splitRoute = require('./part8-split-route.cjs'); } catch (_e) { _splitRoute = null; }
  }
  return _splitRoute && typeof _splitRoute.SPROUTS_REQUIRED === 'string' ? _splitRoute.SPROUTS_REQUIRED : 'sprouts_required';
}

const SR_REASONS = Object.freeze({
  body_shape: 'the string is a body of text; split it into claims and send only sprouts',
  edge_rule: 'the string fails a prose rule; split it into claims and send only generic sprouts',
  private_marker: 'the string carries a private-claim marker; keep the claim local and send only a generic sprout',
  room_check_unavailable: 'the room check could not run, so the call is blocked and nothing was sent; split the text and send only sprouts once the room opens',
  pasted_text: 'the string holds pasted text (a quote, a block quote or a code block); the pasted text stays local and only the rest of the question may be sent',
});

// Plan 392-11 (P5): the typed block for a room that cannot be checked. The
// caller (the hook, brain-client) resolved the session's room and found
// status 'unavailable' (a corrupt binding, a resolver throw, a bound room
// whose room.db cannot be read), or the lexicon load failed in process. Every
// payload kind blocks; nothing is sent. The reason is a constant literal.
const ROOM_CHECK_UNAVAILABLE_REASON = 'the room check could not run, so the call is blocked and nothing was sent';

function _roomCheckUnavailableBlock() {
  return { verdict: 'block', class: 'room_check_unavailable', token_class: null, reason: ROOM_CHECK_UNAVAILABLE_REASON };
}

// Plan 392-11: stamp the caller's lexicon scope on a verdict so telemetry, the
// sentinel and the hook can say which room was checked (session or
// machine_global). Only a closed value is copied; without the option the
// verdict is byte-identical to before.
function _stampLexiconScope(verdict, opts) {
  if (!verdict || typeof verdict !== 'object') return verdict;
  const scope = opts && opts.lexiconScope;
  if (scope === 'session' || scope === 'machine_global') verdict.lexicon_scope = scope;
  return verdict;
}

function _sproutsRequired(tokenClass) {
  return { verdict: 'block', class: _sproutsRequiredClass(), token_class: tokenClass, reason: SR_REASONS[tokenClass] };
}

// A private-claim marker on a sprout. Measured on the corpora: 0 hits on the 26
// positives, the 535 extended questions, the 16 compliant and the 31 generic
// 354 questions (plan 386-33 RCA evidence).
const PRIVATE_WORD = /\b(?:confidential|secret|proprietary|undisclosed|internal only|under nda)\b/i;
const POSSESSIVE_MARKER = /\b(?:my|our)\s+\p{L}/iu;
const FIRST_PERSON_CLAUSE_MARKER = /(?:^|[,;:.!]\s+)(?:i|we)\s+\p{L}/iu;

function _hasPrivateMarker(str, shape) {
  return PRIVATE_WORD.test(str) || POSSESSIVE_MARKER.test(str) || FIRST_PERSON_CLAUSE_MARKER.test(str) ||
    PRIVATE_POSSESSIVE.test(str) || (shape && shape.firstPersonStatement === true);
}

function _hasProseHit(str) {
  if (!_PROSE_PATTERNS) return true; // cannot prove it clean: treat as a hit
  for (let i = 0; i < _PROSE_PATTERNS.length; i++) {
    if (_PROSE_PATTERNS[i].test(str)) return true;
  }
  return false;
}

function _hasAlwaysHit(str) {
  if (!_ALWAYS_PATTERNS) return true;
  for (let i = 0; i < _ALWAYS_PATTERNS.length; i++) {
    if (_ALWAYS_PATTERNS[i].test(str)) return true;
  }
  return false;
}

// A string is an assembled Cypher template (not shaped) when it sits under the
// cypher key, or opens with a Cypher verb and holds an upper-case Cypher
// keyword. A natural-language body that starts with the word With does not.
function _isCypherForShape(str, payload) {
  if (payload !== null && typeof payload === 'object' && typeof payload.cypher === 'string' && payload.cypher === str) return true;
  return /^\s*(?:OPTIONAL\s+)?(?:MATCH|CALL|WITH|RETURN|UNWIND)\b/i.test(str) && /\b(?:MATCH|RETURN|UNWIND|CALL)\b/.test(str);
}

// -> { kind, ... } | null (null: take the old path)
function _shapeOfFreeform(str, payload) {
  if (!_sproutShape || !_ALWAYS_PATTERNS || !_PROSE_PATTERNS) return null;
  if (_isCypherForShape(str, payload)) return null;
  try {
    return _sproutShape.classifyShape(str);
  } catch (_e) {
    return null;
  }
}

function _theoShapedVerdict(str, shape, payload, opts) {
  // 1. Credentials, emails, phone-like and SSN-like numbers: every shape.
  if (_hasAlwaysHit(str)) {
    return _theoBlock('content_set', null, 'the string matches a private-content pattern');
  }
  // Quick 261118-x1g: the same shapes on the check view (native and fullwidth
  // digits), a Unicode email and an at-word email.
  if (_scriptAlwaysHit(str)) {
    return _theoBlock('content_set', null, 'the string matches a private-content pattern');
  }
  const kind = shape.kind;
  const proseHit = kind === 'edge' && _hasProseHit(str);

  // 2. The recognizer stays the allow fast path (never for a body, a prose
  // hit or pasted text: plan 395-13 review CR-04, the paste rule of step 6
  // must see a quoted span first).
  if (kind !== 'body' && shape.quoted !== true && !proseHit && _proveTypedQuestion(str)) {
    return { verdict: 'allow', class: 'typed_question', token_class: null, reason: 'closed-vocabulary methodology question' };
  }

  // 3. Provenance: the bound room's lexicon.
  let lex = opts.lexicon || null;
  let unreadable = false;
  if (!lex) {
    let roomDir = opts.roomDir;
    if (roomDir === undefined) roomDir = _roomLexicon ? _roomLexicon.resolveLexiconRoomDir() : null;
    if (roomDir) {
      if (!_roomLexicon) unreadable = true;
      else lex = _roomLexicon.loadRoomLexicon(roomDir);
    }
  }
  if (lex && (!_roomLexicon || lex.ok === false)) unreadable = true;
  if (lex && !unreadable) {
    const hit = _roomLexicon.matchLexicon(str, lex);
    if (hit) return _lexiconBlock(str, lex, hit);
  }

  // 4. A non-Latin token (392-03) or a structured identifier blocks in every
  // shape. Plan 392-09: under the typed shape arm (opts.typedArm) the script
  // rule is skipped and the string takes the remaining rules as any question.
  // Quick 261118-x1g (OWNER-REDUCE): the script rule is narrowed to the
  // scripts with no marker row (_hasUnprovableScript); the typed arm keeps its
  // START skip (plan-check W1). The q35 Hebrew markers follow the English shape
  // split (OWNER-HE): PW, POS and P1 in a sprout and a long edge, also on the
  // check view; the Hebrew PC, PP and P2 rows run in _scriptPrivateMarker.
  if (opts.typedArm !== true && _hasUnprovableScript(str)) {
    return _theoBlock('room_content', 'identifier', NON_LATIN_REASON);
  }
  if ((kind === 'sprout' || shape.longEdge === true) && _hasHebrewPrivateMarker(str)) return _sproutsRequired('private_marker');
  if ((kind === 'sprout' || shape.longEdge === true) && _hasHebrewPrivateMarker(_scriptCheckView(str))) return _sproutsRequired('private_marker');
  const scriptMarker = _scriptPrivateMarker(str, shape);
  if (scriptMarker) return scriptMarker;
  if (_hasUnknownIdentifier(str)) {
    return _theoBlock('room_content', 'identifier', 'the string carries an identifier no methodology handle matches');
  }
  if (_scriptIdentifier(str)) {
    return _theoBlock('room_content', 'identifier', 'the string carries an identifier no methodology handle matches');
  }
  if (_scriptMixedToken(str)) return _theoBlock('room_content', 'identifier', MIXED_SCRIPT_REASON);

  // 5. The lexicon cannot be read: nothing passes. Plan 392-11 (P5, owner rule
  // of 392-CONTEXT wave 3: "bound but unreadable or resolver failure = block
  // room_check_unavailable") supersedes the plan 386-33 acknowledgement
  // (owner_ack_unreadable_db_lexicon: "short sprouts go") under which a clear
  // sprout was allowed as room_check_skipped. A sprout now blocks with the
  // class room_check_unavailable; an edge or a body keeps the sprouts_required
  // outcome with the token class room_check_unavailable (the split guide).
  if (unreadable) {
    if (kind !== 'sprout') return _sproutsRequired('room_check_unavailable');
    // Quick 261118-q35: main's private-claim marker rule for a sprout stays
    // in place (both outcomes block; nothing passes an unreadable room).
    if (_hasPrivateMarker(str, shape)) return _sproutsRequired('private_marker');
    return _roomCheckUnavailableBlock();
  }

  // 6. By shape. Plan 395-13 (owner ruling 37): pasted text (a quoted span)
  // is answered first, so classifyAndCut can cut it and decide the rest.
  // 6. By shape. Plan 392-05 (carried from 392-04): a body made by a cap
  // (a token over WORD_MAX_CHARS, a string over STRING_MAX_CHARS) carries the
  // shape helper's typed reason in shape_reason (word_too_long |
  // string_too_long). A separate field, not a token class: TOKEN_CLASSES is
  // pinned at 9 entries by tests/test-3692-theo-verdict.cjs and the
  // sprouts_required token classes are the five SR_REASONS keys (pasted_text
  // added by plan 395-13).
  if (shape.quoted === true) return _sproutsRequired('pasted_text');
  if (kind === 'body') {
    const body = _sproutsRequired('body_shape');
    if (shape.reason === 'word_too_long' || shape.reason === 'string_too_long') body.shape_reason = shape.reason;
    return body;
  }
  if (kind === 'sprout') {
    if (_hasPrivateMarker(str, shape)) return _sproutsRequired('private_marker');
    return { verdict: 'allow', class: 'generic_question', token_class: null, reason: 'plain methodology question with no room-local token' };
  }
  // edge: the narrowed prose rules, the private-context rules and the name rule.
  if (proseHit || PRIVATE_POSSESSIVE.test(str) || PRIVATE_CONFIDENTIAL.test(str) || shape.firstPersonStatement === true ||
      _hasUnknownProperName(str, false)) {
    return _sproutsRequired('edge_rule');
  }
  // Quick 261118-x1g: the name rule of the cased and the caseless scripts.
  if (_scriptEdgeRule(str)) return _sproutsRequired('edge_rule');
  // Plan 395-13 (owner ruling 35): a long edge (the size that was a body before
  // the ruling) also keeps the private-claim marker rule of a sprout.
  if (shape.longEdge === true && _hasPrivateMarker(str, shape)) return _sproutsRequired('private_marker');
  return { verdict: 'allow', class: 'generic_question', token_class: null, reason: 'plain methodology question with no room-local token' };
}

// The lexicon block with the kind, the word count and the hit count (quick
// 261012-sph). Shared by the old path and the shaped path (plan 386-33).
function _lexiconBlock(str, lex, hit) {
  const block = _theoBlock('room_content', hit.token_class, 'the string names something the bound room recorded');
  block.matched_kind = hit.token_class;
  if (Number.isInteger(hit.token_count) && hit.token_count > 0) block.matched_token_count = hit.token_count;
  if (Number.isInteger(hit.at)) {
    const all = Array.isArray(lex) ? lex : lex.entries;
    let count = 1;
    let start = hit.at + 1;
    while (count < THEO_MATCH_COUNT_CAP && start < all.length) {
      const more = _roomLexicon.matchLexicon(str, all.slice(start));
      if (!more || !Number.isInteger(more.at)) break;
      count += 1;
      start += more.at + 1;
    }
    block.matched_count = count;
  }
  return block;
}

// The refusal counts lexicon hits up to this cap, so a long string with many
// hits costs at most 5 extra matchLexicon calls, on the block path only.
const THEO_MATCH_COUNT_CAP = 5;

/**
 * theoVerdict(payload, { toolName, roomDir, lexicon }) ->
 *   { verdict: 'allow' | 'block', class, token_class, reason }
 *
 * payload carries the free-form string under a FREEFORM_KEYS key (a bare
 * string is accepted too). roomDir: a room directory path, null for "no room
 * bound", undefined to resolve the active room. lexicon: a prebuilt lexicon
 * (test seam). Fail closed: a payload with no string, a bound room whose
 * lexicon cannot be read, or an unavailable lexicon module blocks. The reason
 * names a class in plain words and never carries the offending bytes.
 *
 * Plan 392-05 (bypasses 2 and 3): for an object payload EVERY string leaf is
 * decided (_collectStringLeaves), not only the primary key. The primary key
 * keeps its rules and classes byte-unchanged; each other leaf (a sibling
 * key, an array item, a nested value, a brain_query params value) is decided
 * by the same content rules as a bare string, and the strictest verdict
 * wins. A block on a non-primary leaf carries leaf_path (the key path, for
 * example "context" or "params.name"), never the text. A payload past the
 * walk budget (depth 8, 2,000 nodes) blocks content_set with the reason
 * over_budget before any leaf is read.
 *
 * Quick 261012-sph: a lexicon block also carries matched_kind (the entry kind),
 * matched_token_count (how many words the hit was long, or how many content
 * words of a claim the string carried) and matched_count (how many entries the
 * string hits, counted up to THEO_MATCH_COUNT_CAP). All three are a closed kind
 * or an integer. No field carries entry text, a token of the entry or its index.
 */
function theoVerdict(payload, opts) {
  opts = opts || {};
  // Plan 392-11 (P5): the caller resolved the session's room and could not
  // check it. Block before any rule, for every payload kind; nothing is sent.
  if (opts.roomStatus === 'unavailable') return _stampLexiconScope(_roomCheckUnavailableBlock(), opts);
  return _stampLexiconScope(_theoVerdictUnscoped(payload, opts), opts);
}

function _theoVerdictUnscoped(payload, opts) {
  // Plan 392-03: normalise (NFKC, strip format characters) before any rule.
  payload = (typeof payload === 'string') ? _normalizeForGuard(payload) : _normalizePayloadLeaves(payload);
  if (typeof payload === 'string') {
    if (payload.length === 0) return _theoBlock('unknown', null, 'no free-form string to check');
    return _theoStringVerdict(payload, payload, opts);
  }
  if (payload === null || typeof payload !== 'object') {
    return _theoBlock('unknown', null, 'no free-form string to check');
  }

  // Plan 392-05 (bypasses 2 and 3): every string leaf of the payload is
  // decided, not only the first FREEFORM_KEYS key. The walk is bounded; past
  // the cap the payload is refused unread (fail closed).
  const leaves = _collectStringLeaves(payload);
  if (!Array.isArray(leaves)) return _overBudgetBlock(leaves.reason);

  const primaryKey = _primaryFreeFormKey(payload);
  const str = primaryKey === null ? null : payload[primaryKey];
  if (typeof str !== 'string' || str.length === 0) {
    return _theoBlock('unknown', null, 'no free-form string to check');
  }

  // The primary key keeps today's rules and classes, byte-unchanged.
  const primary = _theoStringVerdict(str, payload, opts);
  if (primary.verdict === 'block') return primary;
  if (leaves.length <= 1) return primary;

  // Every other leaf is decided by the same content rules (credential
  // shapes, the lexicon, the non-Latin and identifier rules, the sprout
  // shape, the typed proof). The strictest verdict wins: the first block
  // returns, with leaf_path naming the key path and never the text. The
  // room is resolved once for the whole payload.
  let leafOpts = opts;
  if (!opts.lexicon && opts.roomDir === undefined) {
    leafOpts = Object.assign({}, opts, { roomDir: _roomLexicon ? _roomLexicon.resolveLexiconRoomDir() : null });
  }
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    if (leaf.path === primaryKey || leaf.value.length === 0) continue;
    const v = _theoStringVerdict(leaf.value, null, leafOpts);
    if (v.verdict === 'block') {
      v.leaf_path = leaf.path;
      return v;
    }
  }
  return primary;
}

// The verdict of ONE free-form string. payload is the object the string came
// from (so the cypher key is recognised), the string itself for a bare
// string, or null for a sibling leaf (plan 392-05).
function _theoStringVerdict(str, payload, opts) {
  // Plan 386-33 (option-e): a free-form string that is not an assembled Cypher
  // template is decided by shape (sprout, edge, body). See the section above.
  const shaped = _shapeOfFreeform(str, payload);
  if (shaped) return _theoShapedVerdict(str, shaped, payload, opts);

  // 1. CONTENT-SET default-deny. Unchanged; the city fence stays on this line.
  if (!_safeAudit(str)) {
    return _theoBlock('content_set', null, 'the string matches a private-content pattern');
  }
  if (_scriptAlwaysHit(str)) { // quick 261118-x1g
    return _theoBlock('content_set', null, 'the string matches a private-content pattern');
  }

  // 2. The recognizer stays as the allow fast path.
  if (_proveTypedQuestion(str)) {
    return { verdict: 'allow', class: 'typed_question', token_class: null, reason: 'closed-vocabulary methodology question' };
  }

  // 3. Provenance: the bound room's lexicon.
  let lex = opts.lexicon || null;
  if (!lex) {
    let roomDir = opts.roomDir;
    if (roomDir === undefined) roomDir = _roomLexicon ? _roomLexicon.resolveLexiconRoomDir() : null;
    if (roomDir) {
      if (!_roomLexicon) return _theoBlock('room_check_unavailable', null, 'the bound room names could not be read');
      lex = _roomLexicon.loadRoomLexicon(roomDir);
    }
  }
  if (lex) {
    if (!_roomLexicon || lex.ok === false) {
      return _theoBlock('room_check_unavailable', null, 'the bound room names could not be read');
    }
    const hit = _roomLexicon.matchLexicon(str, lex);
    if (hit) return _lexiconBlock(str, lex, hit);
  }

  // 4. Content rules.
  if (str.length > THEO_STRING_CEILING || PRIVATE_POSSESSIVE.test(str) || PRIVATE_CONFIDENTIAL.test(str)) {
    return _theoBlock('room_content', 'private_context', 'the string carries private venture context');
  }
  if (opts.typedArm !== true && _hasUnprovableLetter(str)) { // plan 392-09: skipped under the typed shape arm; quick 261118-q35: narrowed
    return _theoBlock('room_content', 'identifier', NON_LATIN_REASON);
  }
  if (_hasHebrewPrivateMarker(str)) {
    return _theoBlock('room_content', 'private_context', 'the string carries private venture context');
  }
  if (_hasNonLatinLetter(str)) { // quick 261118-x1g: this path has no shape, so a non-Latin string fails closed
    return _theoBlock('room_content', 'identifier', NON_LATIN_REASON);
  }
  if (_hasUnknownIdentifier(str)) {
    return _theoBlock('room_content', 'identifier', 'the string carries an identifier no methodology handle matches');
  }
  const isCypher = (payload !== null && typeof payload === 'object' && typeof payload.cypher === 'string' && payload.cypher === str) ||
    /^\s*(?:OPTIONAL\s+)?(?:MATCH|CALL|WITH|RETURN|UNWIND)\b/i.test(str);
  if (_hasUnknownProperName(str, isCypher)) {
    return _theoBlock('room_content', 'name', 'the string carries a proper name no methodology handle matches');
  }

  // 5. A plain methodology question.
  return { verdict: 'allow', class: 'generic_question', token_class: null, reason: 'plain methodology question with no room-local token' };
}

// Plan 386-33: the free-form string of a payload that theoVerdict decides by
// shape: { key, str } for a brain_ask / brain_query / brain_search string that is
// not under the cypher key and not an assembled template, or for a typed
// freeform tool (search, classify_problem_type) with its exact key set. null
// otherwise (the full default-deny list runs on the whole payload).
function _shapedFreeformEntry(payload, toolName) {
  if (!_sproutShape || !_ALWAYS_PATTERNS || !_PROSE_PATTERNS) return null;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  // Plan 392-09: a shaped payload's free-text key is scanned inside
  // theoVerdict by shape (step 1d); step 1 scans the rest (the shape and
  // any other key) with the full default-deny list.
  const armRow = _hasShapeKey(payload) ? _shapedArmRow(toolName) : null;
  if (armRow) {
    const s = payload[armRow.stringKey];
    if (typeof s !== 'string' || s.length === 0 || _isCypherForShape(s, payload)) return null;
    return { key: armRow.stringKey, str: s };
  }
  if (_isFreeFormTool(toolName)) {
    for (let i = 0; i < FREEFORM_KEYS.length; i++) {
      const v = payload[FREEFORM_KEYS[i]];
      if (typeof v === 'string' && v.length > 0) {
        if (FREEFORM_KEYS[i] === 'cypher' || _isCypherForShape(v, payload)) return null;
        return { key: FREEFORM_KEYS[i], str: v };
      }
    }
    return null;
  }
  const typed = _typedFreeformString(payload, toolName);
  if (typed !== null) {
    if (_isCypherForShape(typed, payload)) return null;
    return { key: TYPED_READ_TOOLS[_typedToolBase(toolName)].stringKey, str: typed };
  }
  return null;
}

/**
 * classify(payload, { toolName }) -> { verdict, class, reason }
 *
 * verdict: 'allow' | 'block' | 'ambiguous'. Pure LOCAL, zero network (D-01).
 *   1. CONTENT-SET default-deny scan first (any hit -> block, the safe default).
 *   1b. A provably empty plain object (zero own keys) -> allow. Positive proof
 *      of emptiness, never a relaxed default (Phase 245-03).
 *   1c. Plan 386-04 (B2): a brain_write tool name -> block, class write_blocked,
 *      for every payload, on every scope name. This arm closes B2. It has no
 *      allow rule; an allow for brain_write needs a positive proven shape and
 *      a gate. It borrows nothing from the vocabulary test and sits after
 *      step 1 and 1b, before the packet check.
 *   1d. Plan 392-09 (P3, the typed shape arm): brain_ask {question, shape},
 *      brain_search {query, shape, topK?} and classify_problem_type
 *      {statement, shape}. The shape is validated by exact enum membership
 *      (lib/core/brain-shape-packet.cjs validateShapePacket, lazy) before any
 *      free-text rule: block shape_invalid with the field, never a repair.
 *      Any other key blocks (unexpected_key). The free-text key is decided by
 *      theoVerdict under a 240 character cap (question_too_long); the sprout,
 *      edge and body belt still runs on it; the non-Latin script rule does
 *      not. The verdict carries shape_validated true.
 *   2. Plan 386-28 (E-JOB): a free-form brain_ask / brain_query / brain_search
 *      string is decided by theoVerdict BEFORE the packet arm, whatever other
 *      keys the payload carries (a job key no longer skips the room-word rules).
 *      2b. A proven typed MOVE-SET packet (job in SHIPPED_JOBS, keys within the
 *      packet schema for that job) -> allow; an unproven packet -> ambiguous.
 *   3. Phase 369.2 Plan 01 (CODE-07, J4): a free-form brain_ask / brain_query /
 *      brain_search string is decided by theoVerdict(), by content and
 *      provenance, and never comes back ambiguous: allow (typed_question fast
 *      path, or generic_question) or block (content_set, room_content with a
 *      token_class, room_check_unavailable). The paragraph below is the
 *      354-06 history of the recognizer that is now its fast path.
 *      A free-form brain_ask / brain_query / brain_search string that clears
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
 *   3a. Plan 386-25: a freeform typed Theo tool (search, classify_problem_type)
 *      is decided by theoVerdict as brain_ask is (credential-shaped opaque token
 *      first). 3b2: typed Theo read tools by shape (_proveTypedReadShape).
 *   3c. Phase 366-11: a normalize_framework_name term the navigator released on an F.8 card
 *      (opts.release receipt: gate id + exact term) -> allow, class navigator_released.
 *      Runs after every arm above, so it only narrows ambiguous. See _proveNavigatorRelease.
 *   4. Neither -> ambiguous (fail-closed toward gate, never silent-allow).
 * class is a category slug; reason is a short scalar carrying NO offending bytes.
 */
function classify(payload, opts) {
  opts = opts || {};
  // Plan 392-11 (P5): the verdict carries the caller's lexicon scope when the
  // caller resolved the room by session (lexiconScope 'session' or
  // 'machine_global'); without the option the verdict is byte-identical.
  return _stampLexiconScope(_classifyUnscoped(payload, opts), opts);
}

function _classifyUnscoped(payload, opts) {
  const toolName = opts.toolName || '';

  if (payload === null || typeof payload !== 'object') {
    return { verdict: 'ambiguous', class: 'unknown', reason: 'non-object payload' };
  }

  // 0a. Plan 392-06 (F6 bypass 5): the declared tool class. An operational
  // Theo tool (room_bind, graph_write, gate_*, chain_run and the rest of the
  // absorbed mindrian-os surface) carries room content BY DESIGN and is
  // allowed without a scan; the class is what the hook records. An auth tool
  // likewise. Every other name (content, unknown, brain_*) continues below
  // and is scanned. brain_write is content and stays blocked at step 1c.
  const toolClass = _theoToolClass(toolName);
  if (toolClass === 'operational') {
    return { verdict: 'allow', class: 'operational_tool', token_class: null, reason: 'operational Theo tool: room content by design, not scanned (data/theo-tool-classes.json)' };
  }
  if (toolClass === 'auth') {
    return { verdict: 'allow', class: 'auth_tool', token_class: null, reason: 'auth tool: no methodology payload, not scanned (data/theo-tool-classes.json)' };
  }

  // 0b. Plan 392-11 (P5, 392-SC5): the caller resolved the session's room and
  // could not check it (opts.roomStatus 'unavailable': a corrupt binding file,
  // a resolver throw, a bound room whose room.db cannot be read). Block with
  // the class room_check_unavailable before any other rule and for every
  // payload kind; a sprout no longer passes. Placed after 0a on purpose: an
  // operational tool never consults the lexicon (room_bind must still work so
  // the user can rebind or repair the room) and the scan below is not reached
  // because nothing is sent either way (the T-245-11 invariant guards the
  // allow branches; this is a block).
  if (opts.roomStatus === 'unavailable') return _roomCheckUnavailableBlock();

  // 0. Plan 392-03: every string leaf is normalised (NFKC, then every \p{Cf}
  // format character stripped) before any rule below runs. A fullwidth or
  // zero-width-joined key, address or room word is judged in its plain form.
  payload = _normalizePayloadLeaves(payload);

  // 1. CONTENT-SET: the shipped default-deny scan is the discriminator.
  // Plan 386-33 (option-e): for a free-form string that is decided by shape
  // (not a Cypher template), the string itself is scanned inside theoVerdict
  // (ALWAYS patterns for every shape, PROSE patterns for an edge or a body).
  // Every OTHER field of the payload still gets the full default-deny list here.
  const shapedEntry = _shapedFreeformEntry(payload, toolName);
  const scan = shapedEntry
    ? scanForContent(Object.assign({}, payload, { [shapedEntry.key]: '' }))
    : scanForContent(payload);
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

  // 1c. Plan 386-04 (finding B2, owner decision option A, 2026-11-06): a Brain
  // WRITE is blocked for every payload. A write sends data to be stored in the
  // remote graph, not a query sprout, so no shape of it is a proven-safe
  // sprout. Placed AFTER step 1 and step 1b (step 1 stays first and
  // byte-unchanged; a content hit still reports content_set) and BEFORE the
  // packet check. It adds NO allow rule for brain_write and borrows nothing
  // from the vocabulary test. The reason is a constant literal that carries no
  // payload bytes. An allow for brain_write needs its own positive proven
  // shape and a gate; until then the verdict is block, never ambiguous.
  if (_isBrainWriteTool(toolName)) {
    return { verdict: 'block', class: 'write_blocked', token_class: null, reason: 'brain_write is blocked: Part 8 sends no write to the Brain' };
  }

  // 1d. Plan 392-09 (P3): the typed shape arm. brain_ask, brain_search and
  // classify_problem_type with a `shape` key: the shape by exact enum
  // membership first (block shape_invalid, never a repair), then exact keys
  // (the free-text key, shape, the declared non-text parameters; any other
  // key blocks), then the free-text key by theoVerdict under the 240 cap.
  // After step 1 (the default-deny scan ran on the shape and every other
  // key) and after 1c (brain_write stays blocked); before step 2, so the
  // shape never enters the free-text walk. See the section comment above
  // _shapedArmVerdict.
  const shapedRow = _hasShapeKey(payload) ? _shapedArmRow(toolName) : null;
  if (shapedRow) {
    return _shapedArmVerdict(payload, shapedRow, { toolName: toolName, roomDir: opts.roomDir, lexicon: opts.lexicon });
  }

  // 2. Plan 386-28 (E-JOB): a free-form string is decided by theoVerdict
  // BEFORE the packet arm, whatever other keys the payload carries. A job key
  // no longer skips the name, my or our and lexicon rules. Step 1 still ran
  // first and is unchanged.
  // free-form brain_ask / brain_query / brain_search string path.
  // Phase 369.2 Plan 01 (CODE-07, J4): one verdict by CONTENT and PROVENANCE,
  // not by shape. A free-form string never comes back ambiguous: theoVerdict
  // answers allow (typed_question fast path or generic_question) or block
  // (content_set, room_content with a token_class, room_check_unavailable).
  // Every other arm (packets, known tool shapes, navigator release, the final
  // ambiguous) is unchanged.
  if (_isFreeFormTool(toolName)) {
    const str = _extractFreeFormString(payload);
    if (typeof str === 'string' && str.length > 0) {
      return theoVerdict(payload, { toolName: toolName, roomDir: opts.roomDir, lexicon: opts.lexicon });
    }
  }

  // 2b. typed MOVE-SET packet (exact schema keys, see _proveMoveSet).
  if (_looksLikePacket(payload)) {
    if (_proveMoveSet(payload)) {
      return { verdict: 'allow', class: 'move_set', reason: 'proven Phase 110 packet shape' };
    }
    return { verdict: 'ambiguous', class: 'unproven_packet', reason: 'packet shape not proven' };
  }

  // 3a. Plan 386-25 (E-TYPED): a freeform typed Theo tool (search,
  // classify_problem_type) is decided exactly as brain_ask decides the same
  // string (parity through theoVerdict: allow or block, never ambiguous). A
  // credential-shaped opaque token blocks first. No shape bypass here: the
  // sprout rule for all free-form routes is plans 386-32 and 386-33.
  const typedFreeform = _typedFreeformString(payload, toolName);
  if (typedFreeform !== null) {
    if (_hasOpaqueSecretToken(typedFreeform)) {
      return { verdict: 'block', class: 'content_set', token_class: null, reason: 'the string carries a credential-shaped token' };
    }
    return theoVerdict(typedFreeform, { toolName: toolName, roomDir: opts.roomDir, lexicon: opts.lexicon });
  }

  // 3b. known-safe structural shape for a specific Brain tool.
  const knownShape = _proveKnownToolShape(payload, toolName);
  if (knownShape) {
    return { verdict: 'allow', class: knownShape.class, reason: knownShape.reason };
  }

  // 3b2. Plan 386-25 (E-TYPED): typed Theo read tools by shape (exact keys,
  // canonical handles, integers). After step 1 and before the navigator
  // release arm; it only narrows ambiguous.
  const typedShape = _proveTypedReadShape(payload, toolName);
  if (typedShape) {
    return { verdict: 'allow', class: typedShape.class, reason: typedShape.reason };
  }

  // 3c. Phase 366-11 (D-13 a): the navigator-consent allow. AFTER the CONTENT-SET scan and every
  // other arm, so it can only narrow ambiguous; see _proveNavigatorRelease for the argument.
  const released = _proveNavigatorRelease(payload, opts);
  if (released) return released;

  // 3d. Plan 392-06 (F6 bypass 5): the generic content arm. A content tool
  // with NO typed arm (every Theo content tool without a row in
  // TYPED_READ_TOOLS or _proveKnownToolShape, every connector tool and every
  // unknown name) is decided by the free-form rules on every string leaf,
  // with the 256 character cap: allow or block, never ambiguous when it
  // carries a string. A tool WITH a typed arm keeps the terminal ambiguous
  // below (exact keys, fail closed on schema drift, plan 386-25), as do the
  // six brain_* names (the replay matrix is unchanged). After 3c so a
  // navigator release still wins on normalize_framework_name.
  if (!_hasTypedArm(_typedToolBase(toolName))) {
    const generic = _genericContentVerdict(payload, opts);
    if (generic) return generic;
  }

  // 4. neither proven MOVE-SET nor a content hit.
  return { verdict: 'ambiguous', class: 'unknown', reason: 'neither proven move-set nor content hit' };
}

/**
 * classifyAndCut(payload, opts) -> { verdict, payload, cut }
 *
 * Plan 395-13 (owner ruling 37, 2026-11-16, "cut the paste, send the rest").
 * It runs classify() first. When the verdict is sprouts_required with the
 * token class pasted_text, it cuts the pasted spans of the free-form string
 * (part8-sprout-shape.cjs cutPastedText; each span becomes the note
 * "[pasted text kept local]") and runs classify() again on the rest. The
 * rules for every shape (credentials, room-lexicon terms, structured
 * identifiers) ran first on the whole text with the paste, so a paste never
 * hides a hit. verdict is the verdict of the payload to send; payload is a new
 * object when cut > 0, else the same object; cut is the number of spans cut.
 * Fail closed: when the quote marks cannot be paired cleanly, when the rest
 * holds no letter, or when the cut text still holds a quoted span, the verdict
 * stays sprouts_required/pasted_text and cut is 0.
 * The reason of each verdict is a constant; no field but payload holds input.
 */
function classifyAndCut(payload, opts) {
  const first = classify(payload, opts);
  if (!first || first.verdict !== 'block' || first.token_class !== 'pasted_text') return { verdict: first, payload: payload, cut: 0 };
  const entry = _shapedFreeformEntry(payload, (opts && opts.toolName) || '');
  if (!entry || !_sproutShape || typeof _sproutShape.cutPastedText !== 'function') return { verdict: first, payload: payload, cut: 0 };
  const cut = _sproutShape.cutPastedText(entry.str);
  if (!cut || !(cut.count > 0) || typeof cut.text !== 'string') return { verdict: first, payload: payload, cut: 0 };
  // Plan 395-13 review CR-03: quote marks that cannot be paired cleanly (a
  // stray inch mark, an unclosed or a lone quote) fail closed: nothing is cut,
  // the pasted_text block stays, and nothing is sent.
  if (cut.ambiguous === true) return { verdict: first, payload: payload, cut: 0 };
  const rest = cut.text.split(_sproutShape.PASTE_NOTE).join(' ');
  if (!/\p{L}/u.test(rest) || _sproutShape.classifyShape(cut.text).quoted === true) return { verdict: first, payload: payload, cut: 0 };
  if (!_pasteIsGone(cut)) return { verdict: first, payload: payload, cut: 0 };
  // Plan 395-13 review round 2 NEW-BL-02: the cut must never join lines. If
  // the cut text has fewer line breaks than the input, fail closed.
  if (typeof _sproutShape.countNewlines !== 'function' ||
      _sproutShape.countNewlines(cut.text) < _sproutShape.countNewlines(entry.str)) return { verdict: first, payload: payload, cut: 0 };
  const cleaned = Object.assign({}, payload, { [entry.key]: cut.text });
  return { verdict: classify(cleaned, opts), payload: cleaned, cut: cut.count };
}

// Plan 395-13 review IN-03: the shim disclosure says the pasted text stayed on
// this machine. Check it before a cut is used: no cut span (its text without
// the marks at each end, PASTE_GONE_MIN_CHARS or more characters) may stand in
// the text to send. A short generic term that the question names twice does
// not count. On a hit the cut fails closed.
const PASTE_GONE_MIN_CHARS = 40;
function _pasteIsGone(cut) {
  if (!Array.isArray(cut.spans)) return false;
  for (let i = 0; i < cut.spans.length; i++) {
    const inner = String(cut.spans[i]).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (inner.length >= PASTE_GONE_MIN_CHARS && cut.text.indexOf(inner) !== -1) return false;
  }
  return true;
}

// ---------- Exports ----------
// classify + the test seams the adversarial suite spies (clone of the
// brain-review-packet.cjs exports style).
module.exports = {
  classify: classify,
  classifyAndCut: classifyAndCut,
  theoVerdict: theoVerdict,
  TOKEN_CLASSES: TOKEN_CLASSES,
  scanForContent: scanForContent,
  EGRESS_SURFACE: EGRESS_SURFACE,
  _safeAudit: _safeAudit,
  _proveMoveSet: _proveMoveSet,
  _looksLikePacket: _looksLikePacket,
  _summaryLeavesAllHashed: _summaryLeavesAllHashed,
  _extractFreeFormString: _extractFreeFormString,
  _collectStringLeaves: _collectStringLeaves,
  LEAF_WALK_MAX_DEPTH: LEAF_WALK_MAX_DEPTH,
  LEAF_WALK_MAX_NODES: LEAF_WALK_MAX_NODES,
  _isFreeFormTool: _isFreeFormTool,
  _isBrainWriteTool: _isBrainWriteTool,
  _proveTypedQuestion: _proveTypedQuestion,
  QUESTION_FUNCTION_WORDS: QUESTION_FUNCTION_WORDS,
  METHODOLOGY_TOKEN_SET: METHODOLOGY_TOKEN_SET,
  COMMAND_SLUG_SET: COMMAND_SLUG_SET,
  CANONICAL_PHRASES: CANONICAL_PHRASES,
  _isProvablyEmptyPayload: _isProvablyEmptyPayload,
  _proveKnownToolShape: _proveKnownToolShape,
  _proveTypedReadShape: _proveTypedReadShape,
  TYPED_READ_TOOLS: TYPED_READ_TOOLS,
  _theoToolClass: _theoToolClass,
  _genericContentVerdict: _genericContentVerdict,
  _shapedArmVerdict: _shapedArmVerdict,
  SHAPED_ARM_TOOLS: SHAPED_ARM_TOOLS,
  SHAPED_QUESTION_CAP: SHAPED_QUESTION_CAP,
  TOOL_CLASSES: TOOL_CLASSES,
  CONTENT_STRING_CAP: CONTENT_STRING_CAP,
  _proveNavigatorRelease: _proveNavigatorRelease,
  _releaseIntentVocabulary: _releaseIntentVocabulary,
  _releasePerspectiveIds: _releasePerspectiveIds,
  _isSafeShortLabel: _isSafeShortLabel,
  _hasExactKeys: _hasExactKeys,
  TAXONOMY_RUNGS: TAXONOMY_RUNGS,
};
