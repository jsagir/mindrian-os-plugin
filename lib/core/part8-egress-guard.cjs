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
 */
function _isFreeFormTool(toolName) {
  if (typeof toolName !== 'string') return false;
  return toolName.indexOf('brain_ask') !== -1 ||
    toolName.indexOf('brain_query') !== -1 ||
    toolName.indexOf('brain_search') !== -1;
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
 *      default-deny AND carries generic methodology vocabulary -> allow; else
 *      ambiguous. (brain_search added by quick task 260807-h5s; see the
 *      _isFreeFormTool docblock for why that is boundary-neutral.)
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
      if (METHODOLOGY_VOCAB.test(str)) {
        return { verdict: 'allow', class: 'move_set', reason: 'generic methodology vocabulary handle' };
      }
      return { verdict: 'ambiguous', class: 'freeform_unmatched', reason: 'no methodology vocabulary match' };
    }
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
  _isProvablyEmptyPayload: _isProvablyEmptyPayload,
};
