/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 07 Task 3 -- Phase 4 deterministic thesis template fill.
 *
 * Pure template fill emitting:
 *
 *   "By applying ${X} to ${Y}, achieve ${Z} because ${mechanism} ${bridge_concept}."
 *
 * from the post-classifier + post-breakthrough-scorer composite shape.
 * NO runtime LLM. NO Math.random. NO Date.now. Pure string concatenation
 * over deterministic lookups -- byte-identical output for identical inputs.
 *
 * Field mapping per kickoff §5 Phase 4:
 *
 *   X = classified_pair.query_concept
 *   Y = classified_pair.doc_concept
 *
 *   Z = DOMINANT_TO_LABEL[breakthrough.dominant_dimension]:
 *     feasibility  -> 'feasible novel transfer'
 *     market       -> 'market-ready innovation'
 *     magnitude    -> 'high-magnitude breakthrough'
 *     advantage    -> 'rare cross-domain advantage'
 *     impact       -> 'high-impact result'
 *     missing      -> 'novel insight'  (graceful fallback)
 *
 *   mechanism = MECHANISM_BY_CLASSIFICATION[classification]:
 *     structural_transfer      -> 'isomorphic structure transfers under'
 *     semantic_implementation  -> 'semantic embedding bridges'
 *     hybrid                   -> 'both structural and semantic alignment supports'
 *
 *   bridge_concept = classified_pair.bridge_concept || 'domain analogy'
 *
 * Edge cases:
 *   - Missing breakthrough.dominant_dimension: Z = 'novel insight'.
 *   - Missing classified_pair.bridge_concept: bridge_concept = 'domain analogy'.
 *   - Missing both: thesis still emitted with both fallbacks.
 *   - Missing classification or unknown classification: returns
 *     {error: 'invalid_input', reason: 'invalid_classification'} envelope.
 *   - Missing query_concept or doc_concept: returns
 *     {error: 'invalid_input', reason: 'missing_concepts'} envelope.
 *
 * Canon Part 8 (Graph Boundary): two defense-in-depth layers.
 *
 *   Layer 1 -- pre-input scan: every string field of classified_pair
 *     (query_concept, doc_concept, bridge_concept, classification)
 *     passed through auditQueryString BEFORE any template assembly.
 *     Throws ExternalEgressViolation on hit -- thesis is NEVER generated
 *     when this throws.
 *
 *   Layer 2 -- pre-return audit: assembled thesis string passed through
 *     auditQueryString before return. Defense-in-depth so any forbidden
 *     pattern smuggled via a Layer-1-uncovered surface (e.g., a future
 *     opts.suffix) is caught at the gate.
 *
 * Pure CJS, zero npm deps, node built-ins only beyond rs-egress-* primitives.
 */
'use strict';

const { auditQueryString } = require('./rs-egress-prompts.cjs');
require('./rs-egress-violations.cjs');

// ---------- Frozen invariants ----------

// Classification -> mechanism clause lookup (frozen). Ordered by frequency
// (structural_transfer is the most common per Phase 3 default fallback).
const MECHANISM_BY_CLASSIFICATION = Object.freeze({
  structural_transfer: 'isomorphic structure transfers under',
  semantic_implementation: 'semantic embedding bridges',
  hybrid: 'both structural and semantic alignment supports',
});

// Dominant dimension -> Z clause lookup (frozen). Ordered to match the
// rs-breakthrough-scorer.cjs DIMENSIONS frozen order so the two modules'
// frozen-order contracts stay aligned.
const DOMINANT_TO_LABEL = Object.freeze({
  feasibility: 'feasible novel transfer',
  market: 'market-ready innovation',
  magnitude: 'high-magnitude breakthrough',
  advantage: 'rare cross-domain advantage',
  impact: 'high-impact result',
});

// Fallback strings for missing fields. Frozen as constants so refactor
// drift is loud, not silent.
const FALLBACK_Z = 'novel insight';
const FALLBACK_BRIDGE = 'domain analogy';

// ---------- generateThesis ----------
//
// Public entry point. Synchronous (no I/O, no spawn). Throws only on
// Canon Part 8 violations.
//
// Inputs:
//   classified_pair  object  post-classifier shape (query_concept,
//                            doc_concept, classification, bridge_concept)
//   breakthrough     object  post-breakthrough-scorer shape (dominant_dimension)
//   opts             optional (currently unused; reserved for future)
//
// Output (happy path):
//   thesis  string  the assembled template-fill string ending in '.'
//
// Output (invalid input):
//   {error: 'invalid_input', reason: <string>}  envelope
//
// Throws (Canon Part 8):
//   ExternalEgressViolation  if any string field of classified_pair
//                            matches FORBIDDEN_PATTERNS
//   ExternalEgressViolation  if assembled thesis matches FORBIDDEN_PATTERNS

function generateThesis(classified_pair, breakthrough, opts) {
  if (!classified_pair || typeof classified_pair !== 'object') {
    return { error: 'invalid_input', reason: 'not_object' };
  }

  // Canon Part 8 Layer 1: pre-input scan on every string field BEFORE
  // any template assembly. Throws ExternalEgressViolation on hit.
  // Order is fixed (query, doc, bridge, classification) so the thrown
  // error's stack trace is byte-stable across invocations.
  if (typeof classified_pair.query_concept === 'string') {
    auditQueryString(classified_pair.query_concept, 'thesis-generator');
  }
  if (typeof classified_pair.doc_concept === 'string') {
    auditQueryString(classified_pair.doc_concept, 'thesis-generator');
  }
  if (typeof classified_pair.bridge_concept === 'string') {
    auditQueryString(classified_pair.bridge_concept, 'thesis-generator');
  }
  if (typeof classified_pair.classification === 'string') {
    auditQueryString(classified_pair.classification, 'thesis-generator');
  }

  // Required field shape guards.
  const X = classified_pair.query_concept;
  const Y = classified_pair.doc_concept;
  if (typeof X !== 'string' || typeof Y !== 'string' || X.length === 0 || Y.length === 0) {
    return { error: 'invalid_input', reason: 'missing_concepts' };
  }

  const classification = classified_pair.classification;
  if (typeof classification !== 'string' || !(classification in MECHANISM_BY_CLASSIFICATION)) {
    return { error: 'invalid_input', reason: 'invalid_classification' };
  }
  const mechanism = MECHANISM_BY_CLASSIFICATION[classification];

  // Z lookup with graceful fallback when dominant_dimension is missing or
  // not in DOMINANT_TO_LABEL. Missing breakthrough envelope itself is
  // also handled (downstream callers may pass breakthrough=null when
  // skipping the scorer for a quick template render).
  let Z = FALLBACK_Z;
  if (breakthrough && typeof breakthrough === 'object') {
    const dom = breakthrough.dominant_dimension;
    if (typeof dom === 'string' && (dom in DOMINANT_TO_LABEL)) {
      Z = DOMINANT_TO_LABEL[dom];
    }
  }

  // bridge_concept fallback. classified_pair.bridge_concept may be null
  // (computeBridgeConcept returned null for an unknown classification, or
  // upstream classifier passed null deliberately).
  const bridge_concept = (typeof classified_pair.bridge_concept === 'string' &&
    classified_pair.bridge_concept.length > 0)
    ? classified_pair.bridge_concept
    : FALLBACK_BRIDGE;

  // Assemble the template. Pure string concat -- no template literal
  // backtick interpolation so the source surface is mechanically grep-able.
  const thesis = 'By applying ' + X + ' to ' + Y +
    ', achieve ' + Z +
    ' because ' + mechanism + ' ' + bridge_concept + '.';

  // Canon Part 8 Layer 2: pre-return audit on assembled thesis. Defense
  // in depth.
  auditQueryString(thesis, 'thesis-generator');

  return thesis;
}

// ---------- Exports ----------

module.exports = {
  generateThesis: generateThesis,
  _test: {
    MECHANISM_BY_CLASSIFICATION: MECHANISM_BY_CLASSIFICATION,
    DOMINANT_TO_LABEL: DOMINANT_TO_LABEL,
    FALLBACK_Z: FALLBACK_Z,
    FALLBACK_BRIDGE: FALLBACK_BRIDGE,
  },
};
