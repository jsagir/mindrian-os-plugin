/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 07 Task 1 -- Phase 3 deterministic innovation classifier.
 *
 * Rule-based classifier on the {diff, lsa, bert, passes} output of
 * rs-differential-scorer.cjs. Emits one of three enum values per kickoff
 * §5 Phase 3 enumeration:
 *
 *   structural_transfer      lsa > 0.3 AND bert <= 0.3
 *                            (LSA-anchored isomorphic structure transfer)
 *   semantic_implementation  bert > 0.3 AND lsa <= 0.3
 *                            (BERT-anchored semantic-embedding bridge)
 *   hybrid                   lsa > 0.3 AND bert > 0.3
 *                            (rare-but-valuable: both axes engage)
 *   <default fallback>       structural_transfer (most common, also when
 *                            both axes fail to clear the 0.3 floor)
 *
 * Strict > comparisons throughout (Test 5 verifies the exact-threshold
 * lsa=0.3 case falls to default fallback, NOT into the lsa-high branch).
 *
 * Determinism contract: byte-identical JSON.stringify(out1) === JSON.stringify(out2)
 * for identical inputs, including key insertion order. No Math.random,
 * no Date.now, no LLM call. Pure rule application.
 *
 * Classification independence from passes:
 *   The classifier emits a classification regardless of the dual-floor
 *   passes flag from differential-scorer. A pair with high lsa AND high
 *   bert AND low diff (direct intersection -- pruned by dual-floor) still
 *   carries a 'hybrid' classification label because the underlying
 *   structural+semantic alignment is the load-bearing signal even when
 *   the pair itself does not pass the detection filter. Downstream
 *   consumers (breakthrough scorer, thesis generator) gate on passes
 *   separately.
 *
 * Canon Part 8 (Graph Boundary): two defense-in-depth layers.
 *
 *   Layer 1 -- pre-input scan: query_concept + doc_concept passed
 *     through auditQueryString BEFORE any rule application. On
 *     FORBIDDEN_PATTERNS hit, throws ExternalEgressViolation (Tests 7
 *     and 8 verify the contract).
 *
 *   Layer 2 -- pre-return audit: composite output passed through
 *     auditQueryObject before return. Throws ExternalEgressViolation on
 *     hit. Defense-in-depth so any forbidden pattern smuggled via
 *     pass-through fields is caught at the gate.
 *
 * Pure CJS, zero npm deps, node built-ins only beyond rs-egress-* primitives.
 */
'use strict';

const { auditQueryString, auditQueryObject } = require('./rs-egress-prompts.cjs');
// rs-egress-violations is required transitively by rs-egress-prompts; the
// require below is a reachability witness for the audit chain (Canon Part 7
// reuse of the shared ExternalEgressViolation class).
require('./rs-egress-violations.cjs');

// ---------- Frozen invariants ----------

// Floor thresholds per kickoff §5 Phase 3 enumeration. Strict > used.
const LSA_HIGH = 0.3;
const BERT_HIGH = 0.3;

// The 3-enum classification space, frozen.
const CLASSIFICATIONS = Object.freeze([
  'structural_transfer',
  'semantic_implementation',
  'hybrid',
]);

// Bridge concept mapping per classification. The bridge_concept field is
// the optional helper read by rs-thesis-generator to fill the template's
// trailing clause. Default fallback (both axes below threshold but
// classified as structural_transfer per Phase 3 fallback rule) carries
// the same bridge_concept as the lsa-high structural_transfer branch:
// the surface symmetry is intentional so the thesis template renders
// identically regardless of branch path.
const BRIDGE_CONCEPT_BY_CLASSIFICATION = Object.freeze({
  structural_transfer: 'cross-domain isomorphism',
  semantic_implementation: 'semantic bridge',
  hybrid: 'cross-domain isomorphism + semantic bridge',
});

// ---------- computeBridgeConcept ----------
//
// Deterministic helper. Returns the bridge concept label for a given
// classification, or null on unknown classification (defensive default).

function computeBridgeConcept(scored_pair, classification) {
  if (typeof classification !== 'string') return null;
  const concept = BRIDGE_CONCEPT_BY_CLASSIFICATION[classification];
  if (typeof concept !== 'string') return null;
  return concept;
}

// ---------- classify ----------
//
// Public entry point. Synchronous (no I/O, no spawn). Throws only on
// Canon Part 8 violations.
//
// Inputs:
//   scored_pair  object  {query_concept, doc_concept, diff, lsa, bert, passes}
//   opts         optional (currently unused; reserved for future tuning)
//
// Output (happy path):
//   {query_concept, doc_concept, diff, lsa, bert, passes,
//    classification: 'structural_transfer'|'semantic_implementation'|'hybrid',
//    bridge_concept: <string or null>}
//
// Output (invalid input):
//   {error: 'invalid_input', reason: <string>}
//
// Throws (Canon Part 8):
//   ExternalEgressViolation  if query_concept OR doc_concept matches FORBIDDEN_PATTERNS
//   ExternalEgressViolation  if composite output matches FORBIDDEN_PATTERNS

function classify(scored_pair, opts) {
  // Defensive input validation -- envelope return on shape errors so
  // adversarial fixtures probing malformed inputs do not crash the chain.
  if (!scored_pair || typeof scored_pair !== 'object') {
    return { error: 'invalid_input', reason: 'not_object' };
  }

  // Canon Part 8 Layer 1: pre-input scan on user-controlled concepts.
  // auditQueryString throws ExternalEgressViolation on hit; classify()
  // body below is NEVER executed when this throws.
  if (typeof scored_pair.query_concept === 'string') {
    auditQueryString(scored_pair.query_concept, 'innovation-classifier');
  }
  if (typeof scored_pair.doc_concept === 'string') {
    auditQueryString(scored_pair.doc_concept, 'innovation-classifier');
  }

  // Numeric shape guard. lsa + bert are required for classification.
  if (typeof scored_pair.lsa !== 'number' || typeof scored_pair.bert !== 'number') {
    return { error: 'invalid_input', reason: 'missing_lsa_or_bert' };
  }

  // Rule application. Strict > on both axes per kickoff §5.
  const lsaHigh = scored_pair.lsa > LSA_HIGH;
  const bertHigh = scored_pair.bert > BERT_HIGH;

  let classification;
  if (lsaHigh && bertHigh) {
    classification = 'hybrid';
  } else if (lsaHigh && !bertHigh) {
    classification = 'structural_transfer';
  } else if (!lsaHigh && bertHigh) {
    classification = 'semantic_implementation';
  } else {
    // Default fallback. Per CONTEXT.md Specific Ideas: structural_transfer
    // is the most common pattern; below-floor pairs default here.
    classification = 'structural_transfer';
  }

  const bridge_concept = computeBridgeConcept(scored_pair, classification);

  // Build composite output. Pass-through preserves the differential-scorer
  // shape so downstream breakthrough-scorer + thesis-generator can read
  // both layers from a single object. Key insertion order is fixed
  // (pass-through fields first, then classification + bridge_concept) so
  // JSON.stringify is byte-stable across invocations.
  const out = {
    query_concept: scored_pair.query_concept,
    doc_concept: scored_pair.doc_concept,
    diff: scored_pair.diff,
    lsa: scored_pair.lsa,
    bert: scored_pair.bert,
    passes: scored_pair.passes,
    classification: classification,
    bridge_concept: bridge_concept,
  };

  // Canon Part 8 Layer 2: pre-return audit on composite output. Throws
  // ExternalEgressViolation on any FORBIDDEN_PATTERNS hit. Defense in
  // depth: any forbidden pattern smuggled via pass-through fields not
  // covered by Layer 1 (e.g., a malformed warning string, a future
  // metadata field) is caught here.
  auditQueryObject(out, 'innovation-classifier');

  return out;
}

// ---------- Exports ----------

module.exports = {
  classify: classify,
  _test: {
    LSA_HIGH: LSA_HIGH,
    BERT_HIGH: BERT_HIGH,
    CLASSIFICATIONS: CLASSIFICATIONS,
    BRIDGE_CONCEPT_BY_CLASSIFICATION: BRIDGE_CONCEPT_BY_CLASSIFICATION,
    computeBridgeConcept: computeBridgeConcept,
  },
};
