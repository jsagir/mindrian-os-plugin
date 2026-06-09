'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-05 Task 2 (IRW-08, D-04) -- the typed Brain-review packet builder.
 * ==========================================================================
 * The Brain-review standing option ("outside review") auto-reviews the latest
 * findings and surfaces contradictions + the next framework chain WITHOUT a scope
 * prompt (D-04). It is the SINGLE highest-risk path in the phase (Canon Part 8
 * boundary): a finding body egressed via Brain review is a constitutional breach.
 *
 * The defense is STRUCTURAL, not procedural:
 *
 *   1. Contradictions are surfaced LOCALLY from room.db via navigation.cjs
 *      (getNeighborhood + the CONTRADICTS edges) -- never sent to Brain. The
 *      packet carries ONLY the count of local contradictions + the generic
 *      framework handles involved, never a finding body, artifact text, number,
 *      or name (Phase 110 typed-packet contract).
 *
 *   2. The outbound methodology question is composed ONLY from generic framework
 *      handles + phase ids + enum scalars ("what chains from <framework> at phase
 *      <N>?"). The framework handle is gated through
 *      rs-egress-prompts.auditQueryString (default-deny) BEFORE it is allowed into
 *      the packet -- a smuggled body throws ExternalEgressViolation and the build
 *      degrades to local-only.
 *
 *   3. Any Brain response is passed through brain-response-sanitize.sanitize
 *      (the A3 PII-redaction sanitizer, the 6th Part-8 tripwire) before it is
 *      surfaced.
 *
 *   4. On Brain-unreachable (mode_b / tier_0) the option DEGRADES to a local-only
 *      answer (omits the Brain line) -- it NEVER blocks (D-04).
 *
 * All reads route through navigation.cjs (Part 9 chokepoint); this module opens no
 * room.db directly and writes nothing.
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 *
 * License: BSL 1.1.
 */

const EGRESS_SURFACE = 'brain-review';

// How far the local contradiction scan reaches off the focus node.
const NEIGHBORHOOD_TOP_K = 200;
const NEIGHBORHOOD_MAX_DEPTH = 2;

/**
 * _safeAudit(handle) -> string | null
 *
 * Run a single generic framework handle through the default-deny
 * auditQueryString gate. On a forbidden-pattern hit (a smuggled body, an email, a
 * number, etc.) auditQueryString THROWS; we catch and return null so the caller
 * drops the handle rather than letting it cross. Returns the handle on a clean
 * pass. This is the structural egress gate (T-148-05-01 mitigation).
 */
function _safeAudit(handle) {
  if (typeof handle !== 'string' || handle.trim().length === 0) return null;
  try {
    const egress = require('../core/rs-egress-prompts.cjs');
    return egress.auditQueryString(handle.trim(), EGRESS_SURFACE);
  } catch (_e) {
    // ExternalEgressViolation (or any audit failure) -> drop the handle.
    return null;
  }
}

/**
 * _localContradictions(db, focusNodeId) -> { count, framework_handles }
 *
 * Surface contradictions LOCALLY from room.db via navigation.cjs. Reads the
 * neighborhood off the focus node and filters to CONTRADICTS edges, returning the
 * COUNT only. The navigation.cjs getNeighborhood projection deliberately exposes
 * ONLY typed scalars (id / type / edgeTypeIn / score / review_status / timestamps)
 * and NEVER the node `properties` blob -- so there is structurally NO finding
 * body, summary, artifact text, number, or name available to leak here. The
 * framework_handles set therefore stays driven ONLY by the explicitly-passed,
 * audited input.framework (see buildBrainReviewPacket), never derived from a local
 * node body. Wrapped: any read failure returns the empty shape (degrade, never
 * crash).
 */
function _localContradictions(db, focusNodeId) {
  const empty = { count: 0, framework_handles: [] };
  if (!db || typeof focusNodeId !== 'string' || focusNodeId.length === 0) return empty;
  try {
    const navigation = require('../core/navigation.cjs');
    const neighbors = navigation.getNeighborhood(db, focusNodeId, {
      topK: NEIGHBORHOOD_TOP_K,
      maxDepth: NEIGHBORHOOD_MAX_DEPTH,
    }) || [];
    const contradicts = neighbors.filter(function (n) {
      return n && n.edgeTypeIn === 'CONTRADICTS';
    });
    // Count only -- no per-node handle is read off the (intentionally bodyless)
    // neighborhood projection. framework_handles is populated solely from the
    // audited input.framework at the call site.
    return { count: contradicts.length, framework_handles: [] };
  } catch (_e) {
    return empty;
  }
}

/**
 * buildBrainReviewPacket(input) -> packet
 *
 * input = {
 *   db,             // room.db handle (opened by the caller via room-db.cjs)
 *   focusNodeId,    // the node the review centers on (e.g. 'section:<slug>')
 *   framework,      // the generic framework handle the chain question is about
 *   phaseId,        // optional integer phase id for the chain question
 *   tierMode,       // 'mode_a' | 'mode_b' | 'tier_0' (Brain reachability)
 *   brainResponse,  // optional raw Brain response string (sanitized before use)
 * }
 *
 * Returns a TYPED methodology packet:
 *   {
 *     kind: 'brain_review',
 *     local: { contradiction_count, framework_handles[] },   // LOCAL only
 *     methodology_question: '<generic handle + phase id>' | null,  // audited
 *     brain_line: '<sanitized brain response>' | null,        // null when degraded
 *     degraded: boolean,                                      // true => local-only
 *   }
 *
 * NEVER contains a finding body, artifact text, raw number, or name. On
 * Brain-unreachable, brain_line is null and degraded is true (D-04: never blocks).
 * Never throws.
 */
function buildBrainReviewPacket(input) {
  const inp = (input && typeof input === 'object') ? input : {};
  const tierMode = (inp.tierMode === 'mode_a' || inp.tierMode === 'mode_b' || inp.tierMode === 'tier_0')
    ? inp.tierMode : 'tier_0';

  // 1. LOCAL contradictions (never sent to Brain). Count-only; the projection
  //    carries no node body.
  const local = _localContradictions(inp.db, inp.focusNodeId);

  // 2. The outbound methodology question -- composed ONLY from a generic
  //    framework handle (audited, default-deny) + an optional integer phase id +
  //    enum scalars. A smuggled body fails the audit and yields a null question.
  const auditedFramework = _safeAudit(inp.framework);

  // The only framework handle the packet surfaces is the audited input.framework
  // (a generic handle that cleared the default-deny gate). A smuggled body yields
  // null here and never reaches framework_handles.
  if (auditedFramework && local.framework_handles.indexOf(auditedFramework) === -1) {
    local.framework_handles.push(auditedFramework);
  }
  let methodologyQuestion = null;
  if (auditedFramework) {
    const phaseId = Number.isInteger(inp.phaseId) ? inp.phaseId : null;
    methodologyQuestion = (phaseId !== null)
      ? ('what chains from ' + auditedFramework + ' at phase ' + phaseId + '?')
      : ('what chains from ' + auditedFramework + '?');
    // Final defense-in-depth: audit the COMPOSED question too (the handle was
    // clean, but re-audit the whole string so the composed form cannot smuggle).
    methodologyQuestion = _safeAuditQuestion(methodologyQuestion);
  }

  // 3. Brain line: only when Brain is reachable (mode_a) AND a response was
  //    provided. The response is sanitized (A3 PII redaction) before it surfaces.
  //    Otherwise degrade to local-only (omit the Brain line; never block).
  let brainLine = null;
  let degraded = true;
  if (tierMode === 'mode_a' && typeof inp.brainResponse === 'string' && inp.brainResponse.length > 0) {
    brainLine = _sanitizeBrain(inp.brainResponse);
    degraded = false;
  }

  return {
    kind: 'brain_review',
    local: {
      contradiction_count: local.count,
      framework_handles: local.framework_handles,
    },
    methodology_question: methodologyQuestion,
    brain_line: brainLine,
    degraded: degraded,
  };
}

/**
 * _safeAuditQuestion(question) -> string | null
 *
 * Re-audit the COMPOSED methodology question through the default-deny gate. The
 * handle was already clean, but the composed string is the actual outbound
 * payload, so it gets the final word. Returns null on any violation.
 */
function _safeAuditQuestion(question) {
  if (typeof question !== 'string' || question.length === 0) return null;
  try {
    const egress = require('../core/rs-egress-prompts.cjs');
    return egress.auditQueryString(question, EGRESS_SURFACE);
  } catch (_e) {
    return null;
  }
}

/**
 * _sanitizeBrain(text) -> string
 *
 * Pass a Brain response through brain-response-sanitize.sanitize (A3 PII
 * redaction). Wrapped: if the sanitizer module is unavailable, return an empty
 * string (fail closed -- never surface an unsanitized response).
 */
function _sanitizeBrain(text) {
  try {
    const sanitizer = require('../core/brain-response-sanitize.cjs');
    return sanitizer.sanitize(text);
  } catch (_e) {
    return '';
  }
}

module.exports = {
  buildBrainReviewPacket: buildBrainReviewPacket,
  EGRESS_SURFACE: EGRESS_SURFACE,
  // Test seams (the IRW-08 adversarial suite spies these).
  _localContradictions: _localContradictions,
  _safeAudit: _safeAudit,
  _sanitizeBrain: _sanitizeBrain,
};
