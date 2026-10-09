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
 *   - Phase 355 D-04: a classification of 'none' (lib/core/rs-innovation-
 *     classifier.cjs's below-floor sentinel) is never passed to this
 *     function -- scripts/rs-discovery-engine.cjs routes 'none' pairs PAST
 *     thesis generation entirely (skipped_reason: 'no_direction', pair kept
 *     not dropped). This module adds no mechanism for 'none'; a 'none'
 *     value reaching generateThesis by some other path still falls into
 *     the existing invalid_classification envelope above, unchanged.
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
 *
 * 2026 package changes (additive; generateThesis output is byte-identical for
 * every input the original handled correctly):
 *   - BUG FIX: the lookups used the "in" operator on plain objects, which also
 *     sees inherited keys. classification 'toString' or 'constructor' passed the
 *     validity check and mechanism became a function, so the thesis text read
 *     "... because function toString() { [native code] } ...". The lookups now
 *     use own-property checks, so those values take the invalid_classification
 *     path (classification) or the 'novel insight' fallback (dominant_dimension).
 *   - generateThesisRecord(pair, breakthrough, opts) wraps the same thesis with
 *     an evidence trail, an explicit deterministic confidence with its basis,
 *     the fallbacks that were used, second-signal and novelty-check status, and
 *     provenance. The thesis sentence is a TEMPLATE FILL: on its own it asserts
 *     nothing, so a record with no evidence is capped at confidence 0.35 and
 *     labelled 'unsupported'.
 */
'use strict';

const crypto = require('node:crypto');

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

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

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
  if (typeof classification !== 'string' || !hasOwn(MECHANISM_BY_CLASSIFICATION, classification)) {
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
    if (typeof dom === 'string' && hasOwn(DOMINANT_TO_LABEL, dom)) {
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

// ---------- generateThesisRecord (2026) ----------
//
// Evidence-carrying wrapper. Optional inputs read from classified_pair:
//   evidence[]            [{source_id, url, retrieved_at, side: 'problem'|'method',
//                           sentence}] extracted sentences with their source trail
//   second_signal         {confirmed: boolean, method?: string}  an independent check
//   novelty_check_status  'passed' | 'failed' | 'possible_prior_art' | 'not_run'
//                         (or novelty_check: {status})
// Ranking and scoring here are plain arithmetic: no LLM, no randomness.

const MAX_RECORD_EVIDENCE = 8;
const NOVELTY_STATES = Object.freeze(['passed', 'failed', 'possible_prior_art', 'not_run']);

function normalizeEvidence(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const sentence = typeof e.sentence === 'string' ? e.sentence.trim().slice(0, 400) : '';
    if (!sentence) continue;
    const rec = {
      source_id: typeof e.source_id === 'string' ? e.source_id : null,
      url: typeof e.url === 'string' ? e.url : null,
      retrieved_at: typeof e.retrieved_at === 'string' ? e.retrieved_at : null,
      side: (e.side === 'problem' || e.side === 'method') ? e.side : 'unspecified',
      sentence: sentence,
    };
    // Canon Part 8: evidence text is user-adjacent content; audit it too.
    auditQueryString(rec.sentence, 'thesis-generator');
    if (rec.url) auditQueryString(rec.url, 'thesis-generator');
    out.push(rec);
    if (out.length >= MAX_RECORD_EVIDENCE) break;
  }
  return out;
}

function scoreThesisConfidence(facts) {
  const basis = ['template_fill_only'];
  let c = 0.20;
  if (facts.hasProblem) { c += 0.15; basis.push('problem_sentence_sourced'); }
  if (facts.hasMethod) { c += 0.15; basis.push('method_sentence_sourced'); }
  if (facts.distinctSources >= 2) { c += 0.10; basis.push('two_or_more_sources'); }
  if (facts.secondSignal === true) { c += 0.15; basis.push('second_signal_confirmed'); }
  if (facts.novelty === 'passed') { c += 0.15; basis.push('novelty_check_passed'); }
  if (facts.novelty === 'failed' || facts.novelty === 'possible_prior_art') { c -= 0.15; basis.push('novelty_check_' + facts.novelty); }
  if (facts.fallbacks.indexOf('bridge_concept') >= 0) { c -= 0.10; basis.push('bridge_concept_fallback'); }
  if (facts.fallbacks.indexOf('dominant_dimension') >= 0) { c -= 0.05; basis.push('dimension_fallback'); }
  if (facts.evidenceCount === 0) { c = Math.min(c, 0.35); basis.push('no_evidence_cap_0.35'); }
  c = Math.max(0, Math.min(1, c));
  c = Math.round(c * 100) / 100;
  const label = c < 0.30 ? 'unsupported' : (c < 0.50 ? 'weak' : (c < 0.75 ? 'moderate' : 'strong'));
  return { confidence: c, confidence_label: label, confidence_basis: basis };
}

function generateThesisRecord(classified_pair, breakthrough, opts) {
  opts = opts || {};
  const thesis = generateThesis(classified_pair, breakthrough, opts); // audits run here
  if (thesis && typeof thesis === 'object') {
    return {
      error: thesis.error,
      reason: thesis.reason,
      thesis: null,
      confidence: 0,
      confidence_label: 'unsupported',
      confidence_basis: ['invalid_input'],
    };
  }
  const evidence = normalizeEvidence(classified_pair.evidence);
  const fallbacks = [];
  const dom = breakthrough && typeof breakthrough === 'object' ? breakthrough.dominant_dimension : undefined;
  if (!(typeof dom === 'string' && hasOwn(DOMINANT_TO_LABEL, dom))) fallbacks.push('dominant_dimension');
  if (!(typeof classified_pair.bridge_concept === 'string' && classified_pair.bridge_concept.length > 0)) fallbacks.push('bridge_concept');

  let novelty = typeof classified_pair.novelty_check_status === 'string' ? classified_pair.novelty_check_status
    : (classified_pair.novelty_check && typeof classified_pair.novelty_check.status === 'string' ? classified_pair.novelty_check.status : 'not_run');
  if (NOVELTY_STATES.indexOf(novelty) < 0) novelty = 'not_run';
  const second = classified_pair.second_signal && typeof classified_pair.second_signal === 'object'
    ? classified_pair.second_signal : null;

  const sources = [];
  for (const e of evidence) { if (e.source_id && sources.indexOf(e.source_id) < 0) sources.push(e.source_id); }
  const score = scoreThesisConfidence({
    hasProblem: evidence.some(function (e) { return e.side === 'problem'; }),
    hasMethod: evidence.some(function (e) { return e.side === 'method'; }),
    distinctSources: sources.length,
    secondSignal: second ? second.confirmed === true : null,
    novelty: novelty,
    fallbacks: fallbacks,
    evidenceCount: evidence.length,
  });

  const computedAt = typeof opts.now === 'function' ? new Date(opts.now()).toISOString() : new Date().toISOString();
  const inputsHash = crypto.createHash('sha256').update(JSON.stringify({
    q: classified_pair.query_concept, d: classified_pair.doc_concept, c: classified_pair.classification,
    b: classified_pair.bridge_concept || null, dom: dom || null,
  })).digest('hex').slice(0, 16);

  const result = {
    thesis: thesis,
    components: {
      X: classified_pair.query_concept,
      Y: classified_pair.doc_concept,
      Z: hasOwn(DOMINANT_TO_LABEL, dom) ? DOMINANT_TO_LABEL[dom] : FALLBACK_Z,
      mechanism: MECHANISM_BY_CLASSIFICATION[classified_pair.classification],
      bridge_concept: fallbacks.indexOf('bridge_concept') >= 0 ? FALLBACK_BRIDGE : classified_pair.bridge_concept,
    },
    fallbacks_used: fallbacks,
    evidence: evidence,
    evidence_count: evidence.length,
    source_ids: sources,
    second_signal: second ? { confirmed: second.confirmed === true, method: typeof second.method === 'string' ? second.method : null } : { confirmed: null, method: null },
    novelty_check_status: novelty,
    confidence: score.confidence,
    confidence_label: score.confidence_label,
    confidence_basis: score.confidence_basis,
    provenance: {
      tool: 'rs-thesis-generator/2026.1',
      computed_at: computedAt,
      template: 'v1',
      deterministic: true,
      inputs_hash: inputsHash,
    },
  };
  auditQueryString(JSON.stringify(result), 'thesis-generator');
  return result;
}

// ---------- Exports ----------

module.exports = {
  generateThesis: generateThesis,
  generateThesisRecord: generateThesisRecord,
  _test: {
    MECHANISM_BY_CLASSIFICATION: MECHANISM_BY_CLASSIFICATION,
    DOMINANT_TO_LABEL: DOMINANT_TO_LABEL,
    FALLBACK_Z: FALLBACK_Z,
    FALLBACK_BRIDGE: FALLBACK_BRIDGE,
    scoreThesisConfidence: scoreThesisConfidence,
    normalizeEvidence: normalizeEvidence,
  },
};
