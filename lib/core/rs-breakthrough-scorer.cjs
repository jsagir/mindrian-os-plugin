/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 07 Task 2 -- Phase 3 deterministic breakthrough scorer.
 *
 * 5-dimension 0-10 rubric per kickoff §5 Phase 3 enumeration. Deterministic
 * weighted sum from substrate metadata + classifier output. Each dimension
 * is scored 0-2; total is the simple sum.
 *
 *   feasibility   0-2 from substrate.tier
 *                   core         -> 2.0
 *                   applied      -> 1.5
 *                   theoretical  -> 1.0
 *                   <other>      -> 1.0  (defensive default)
 *
 *   market        0-2 from industry signal count (Tavily-orchestrated
 *                 industry-fetcher signal count for the target domain):
 *                   0            -> 0.0
 *                   1-3          -> 0.5
 *                   4-9          -> 1.0
 *                   10-19        -> 1.5
 *                   >=20         -> 2.0
 *
 *   magnitude     0-2 from differential score (`diff` value mapped):
 *                   0.0 - 0.3    -> 0.0
 *                   0.3 - 0.5    -> 1.0
 *                   0.5 - 0.7    -> 1.5
 *                   >=0.7        -> 2.0
 *
 *   advantage     0-2 from cross-domain pair rarity. Computed from
 *                 opts.pair_density (density of similar pairs in the
 *                 substrate, [0, 1]; 1 = fully dense, 0 = perfectly rare).
 *                 advantage = 2 * (1 - density), clamped to [0, 2].
 *                 Default density = 1.0 (fully dense -> zero advantage)
 *                 when pair_density is omitted -- pessimistic default.
 *
 *   impact        0-2 from BERT cosine score (semantic depth):
 *                   0.0 - 0.2    -> 0.0
 *                   0.2 - 0.4    -> 0.5
 *                   0.4 - 0.6    -> 1.0
 *                   0.6 - 0.8    -> 1.5
 *                   >=0.8        -> 2.0
 *
 * dominant_dimension is the breakdown key with the highest score. Ties
 * are broken by frozen DIMENSIONS order ['feasibility', 'market',
 * 'magnitude', 'advantage', 'impact'] -- the FIRST matching key wins.
 * The frozen-order tie-break is the determinism contract; without it,
 * Object.keys insertion order would be the implicit tie-breaker, which
 * is fragile under refactor.
 *
 * Determinism contract: byte-identical JSON.stringify(out1) === JSON.stringify(out2)
 * for identical inputs. No Math.random, no Date.now, no LLM call.
 *
 * Canon Part 8 (Graph Boundary): two defense-in-depth layers.
 *
 *   Layer 1 -- pre-input scan: classified_pair.query_concept and
 *     classified_pair.doc_concept passed through auditQueryString BEFORE
 *     any rubric application. Throws ExternalEgressViolation on hit.
 *
 *   Layer 2 -- pre-return audit: composite output passed through
 *     auditQueryObject before return. Defense-in-depth so any forbidden
 *     pattern smuggled via opts.substrate_metadata.title (or any field
 *     that propagates into the return envelope) is caught at the gate.
 *
 * Pure CJS, zero npm deps, node built-ins only beyond rs-egress-* primitives.
 */
'use strict';

const { auditQueryString, auditQueryObject } = require('./rs-egress-prompts.cjs');
require('./rs-egress-violations.cjs');

// ---------- Frozen invariants ----------

// 5-dimension space, frozen. Order is the tie-break contract for
// dominant_dimension: first matching key wins.
const DIMENSIONS = Object.freeze([
  'feasibility',
  'market',
  'magnitude',
  'advantage',
  'impact',
]);

// substrate.tier -> feasibility lookup (frozen).
const TIER_TO_FEASIBILITY = Object.freeze({
  core: 2.0,
  applied: 1.5,
  theoretical: 1.0,
});

// ---------- Dimension functions ----------

// Industry signal count -> market score. Pure step function.
function SIGNAL_COUNT_TO_MARKET(n) {
  const x = (typeof n === 'number' && isFinite(n)) ? n : 0;
  if (x >= 20) return 2.0;
  if (x >= 10) return 1.5;
  if (x >= 4) return 1.0;
  if (x >= 1) return 0.5;
  return 0.0;
}

// Differential score -> magnitude score. Pure step function.
function DIFF_TO_MAGNITUDE(d) {
  const x = (typeof d === 'number' && isFinite(d)) ? d : 0;
  if (x >= 0.7) return 2.0;
  if (x >= 0.5) return 1.5;
  if (x >= 0.3) return 1.0;
  return 0.0;
}

// Cross-domain pair density -> advantage score. Density in [0, 1] inverts
// to advantage = 2 * (1 - density), clamped to [0, 2] for defense against
// out-of-range inputs (e.g., NaN, density > 1, density < 0).
function PAIR_DENSITY_TO_ADVANTAGE(rho) {
  const x = (typeof rho === 'number' && isFinite(rho)) ? rho : 1.0;
  const raw = 2.0 * (1.0 - x);
  if (raw < 0) return 0.0;
  if (raw > 2.0) return 2.0;
  return raw;
}

// BERT score -> impact score. Pure step function.
function BERT_TO_IMPACT(b) {
  const x = (typeof b === 'number' && isFinite(b)) ? b : 0;
  if (x >= 0.8) return 2.0;
  if (x >= 0.6) return 1.5;
  if (x >= 0.4) return 1.0;
  if (x >= 0.2) return 0.5;
  return 0.0;
}

// ---------- computeDominant ----------
//
// Returns the first DIMENSIONS key whose breakdown value equals the max.
// Frozen-order tie-break is the determinism contract.

function computeDominant(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return DIMENSIONS[0];
  let max = -Infinity;
  for (let i = 0; i < DIMENSIONS.length; i += 1) {
    const v = breakdown[DIMENSIONS[i]];
    if (typeof v === 'number' && v > max) max = v;
  }
  for (let i = 0; i < DIMENSIONS.length; i += 1) {
    if (breakdown[DIMENSIONS[i]] === max) return DIMENSIONS[i];
  }
  return DIMENSIONS[0];
}

// ---------- scoreBreakthrough ----------
//
// Public entry point. Synchronous (no I/O, no spawn). Throws only on
// Canon Part 8 violations.
//
// Inputs:
//   classified_pair  object  the post-classifier shape (pass-through fields)
//   opts             optional:
//     substrate_metadata    {tier: 'core'|'applied'|'theoretical', ...}
//     industry_signal_count number  count of industry-fetcher signals
//     pair_density          number  [0, 1]; 1 = fully dense, 0 = rare
//
// Output (happy path):
//   {<pass-through classified_pair fields>,
//    breakthrough: {
//      score: 0-10,
//      breakdown: {feasibility, market, magnitude, advantage, impact},
//      dominant_dimension: <one of DIMENSIONS>,
//    }}
//
// Output (invalid input):
//   {error: 'invalid_input', reason: <string>}

function scoreBreakthrough(classified_pair, opts) {
  if (!classified_pair || typeof classified_pair !== 'object') {
    return { error: 'invalid_input', reason: 'not_object' };
  }

  // Canon Part 8 Layer 1: pre-input scan on user-controlled concepts
  // BEFORE any rubric application. Throws ExternalEgressViolation on hit.
  if (typeof classified_pair.query_concept === 'string') {
    auditQueryString(classified_pair.query_concept, 'breakthrough-scorer');
  }
  if (typeof classified_pair.doc_concept === 'string') {
    auditQueryString(classified_pair.doc_concept, 'breakthrough-scorer');
  }

  opts = opts || {};
  const substrateMeta = (opts.substrate_metadata && typeof opts.substrate_metadata === 'object')
    ? opts.substrate_metadata
    : {};
  const tier = (typeof substrateMeta.tier === 'string') ? substrateMeta.tier : 'theoretical';

  // 5-dimension rubric application.
  const feasibility = (tier in TIER_TO_FEASIBILITY) ? TIER_TO_FEASIBILITY[tier] : 1.0;
  const market = SIGNAL_COUNT_TO_MARKET(opts.industry_signal_count);
  const magnitude = DIFF_TO_MAGNITUDE(classified_pair.diff);
  const advantage = PAIR_DENSITY_TO_ADVANTAGE(
    (typeof opts.pair_density === 'number') ? opts.pair_density : 1.0
  );
  const impact = BERT_TO_IMPACT(classified_pair.bert);

  const breakdown = {
    feasibility: feasibility,
    market: market,
    magnitude: magnitude,
    advantage: advantage,
    impact: impact,
  };
  // Score = simple sum, bounded in [0, 10] by construction (each
  // dimension is in [0, 2]).
  const score = feasibility + market + magnitude + advantage + impact;
  const dominant_dimension = computeDominant(breakdown);

  // Pass-through preserves the classifier shape so downstream
  // thesis-generator can read all 3 layers (pair + classification +
  // breakthrough) from a single object.
  const out = {
    query_concept: classified_pair.query_concept,
    doc_concept: classified_pair.doc_concept,
    diff: classified_pair.diff,
    lsa: classified_pair.lsa,
    bert: classified_pair.bert,
    passes: classified_pair.passes,
    classification: classified_pair.classification,
    bridge_concept: classified_pair.bridge_concept,
    breakthrough: {
      score: score,
      breakdown: breakdown,
      dominant_dimension: dominant_dimension,
    },
  };

  // Canon Part 8 Layer 2: pre-return audit on composite output. Defense
  // in depth. If a future refactor propagates substrate_metadata.title or
  // similar fields into the envelope, the audit catches forbidden bytes
  // at the gate.
  auditQueryObject(out, 'breakthrough-scorer');

  return out;
}

// ---------- Exports ----------

module.exports = {
  scoreBreakthrough: scoreBreakthrough,
  _test: {
    DIMENSIONS: DIMENSIONS,
    TIER_TO_FEASIBILITY: TIER_TO_FEASIBILITY,
    SIGNAL_COUNT_TO_MARKET: SIGNAL_COUNT_TO_MARKET,
    DIFF_TO_MAGNITUDE: DIFF_TO_MAGNITUDE,
    PAIR_DENSITY_TO_ADVANTAGE: PAIR_DENSITY_TO_ADVANTAGE,
    BERT_TO_IMPACT: BERT_TO_IMPACT,
    computeDominant: computeDominant,
  },
};
