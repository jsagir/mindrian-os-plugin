/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 01 -- Phase 4 commercial assessor (deterministic).
 *
 * Deterministic 3-field commercial layer consumed by the Phase 89.5-04
 * top-level orchestrator (kickoff §5 Phase 4 Synthesis). Reads the post-
 * breakthrough-scorer + post-fetcher rs_discovery shape and emits:
 *
 *   {
 *     market_size_estimate: <string from frozen 5-bucket TAM/SAM table>,
 *     value_proposition:    <string from frozen classification template table>,
 *     partnership_targets:  <array derived from resolved_institutions + resolved_authors>,
 *   }
 *
 * Hard contract:
 *   1. NO runtime LLM call (no fetch, no brain-client, no spawn of model
 *      process). Pure-function from a frozen table lookup + array map.
 *   2. Deterministic: same input -> byte-identical JSON.stringify(output)
 *      across N invocations.
 *   3. Edge-case safe: zero industry signals, single expert, missing
 *      breakthrough_score, missing classification all produce deterministic
 *      safe defaults; never throws on missing fields. Only throw paths are
 *      Canon Part 8 forbidden-pattern violations on adversarial input.
 *   4. Canon Part 8 chokepoint: FIRST line of body is auditQueryObject on
 *      the (rs_discovery, opts) tuple. Any forbidden field anywhere in the
 *      tuple raises ExternalEgressViolation BEFORE any computation.
 *
 * Frozen tables:
 *   VALUE_PROP_TEMPLATES -- keyed on classification ('structural_transfer',
 *     'semantic_implementation', 'hybrid', '_fallback'). Larry-style
 *     template stems with [bridge_concept] / [source] / [target] /
 *     [outcome] placeholders that are filled deterministically from
 *     rs_discovery scalars (no free-form generation).
 *
 *   MARKET_SIZE_BUCKETS -- 5 frozen TAM/SAM proxy buckets keyed on the
 *     2D quantile of (industry_signals_count, breakthrough_score):
 *       emerging-niche   (signals <= 1, score < 5)
 *       small-targeted   (signals 2-3, score 5-7)
 *       mid-market       (signals 4-6, score 6-8)
 *       large-market     (signals 7-10, score 8-9)
 *       platform-scale   (signals > 10, score >= 9)
 *     Edge: missing breakthrough_score -> 'unknown-bucket' (deterministic).
 *
 *   Bucket thresholds tuned conservatively for v1.11.0-beta.1; expanding
 *   the bucket vocabulary requires a Plan 89.5-01-N revision (canon-amend
 *   discipline).
 *
 * Pure CJS, zero npm deps, no Node built-ins beyond core require.
 */
'use strict';

const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryObject } = require('./rs-egress-prompts.cjs');

// ---------- Frozen invariants ----------

// Larry-style value-proposition template stems keyed on classification.
// Each stem is a deterministic template with [PLACEHOLDER] tokens that
// are filled from rs_discovery scalars. NO free-form text generation.
//
// Stem-prefix design rule: the first 12 characters of each rendered
// template string MUST differ across the three real classifications +
// the fallback so T8 (classification table coverage) can verify table
// distinctness on the rendered output without coupling to internal stem
// keys. The leading words below ('Apply' / 'Implement' / 'Bridge' /
// 'Cross-domain') satisfy the 12-char-distinct invariant.
const VALUE_PROP_TEMPLATES = Object.freeze({
  structural_transfer:
    'Apply [BRIDGE] from [SOURCE] to [TARGET] to unlock cross-domain advantage',
  semantic_implementation:
    'Implement [BRIDGE] in [TARGET] to compress time from insight to validated decision',
  hybrid:
    'Bridge [SOURCE] and [TARGET] via [BRIDGE] to unlock a defensible cross-domain moat',
  _fallback:
    'Cross-domain opportunity: combine [SOURCE] and [TARGET] to address an underserved gap',
});

// 5-bucket TAM/SAM proxy table. Keyed on bucket-id; each entry is a
// frozen string. Bucket selection is deterministic via a 2D step-function
// over (industry_signals_count, breakthrough_score). See bucketize() below.
const MARKET_SIZE_BUCKETS = Object.freeze({
  'unknown-bucket':
    'unknown-bucket: insufficient signal to estimate market size',
  'emerging-niche':
    'emerging-niche: pre-market opportunity; demand signal not yet established',
  'small-targeted':
    'small-targeted: focused vertical with bounded TAM; early-stage adopters',
  'mid-market':
    'mid-market: established demand with measurable SAM; multi-segment reach',
  'large-market':
    'large-market: validated demand with broad SAM; cross-segment platform potential',
  'platform-scale':
    'platform-scale: category-defining opportunity with cross-vertical reach',
});

// Frozen safe-default scalars.
const SAFE_DEFAULT_BRIDGE = 'cross-domain bridge concept';
const SAFE_DEFAULT_SOURCE = 'source domain';
const SAFE_DEFAULT_TARGET = 'target domain';

// ---------- bucketize ----------
//
// 2D step-function over (signals, score). Pure deterministic lookup.
//
// Bucket selection rules (in order; first match wins):
//   missing breakthrough_score (score === null)  -> 'unknown-bucket'
//   signals <= 1 AND score < 5                   -> 'emerging-niche'
//   signals between 2-3 AND score in [5, 7]      -> 'small-targeted'
//   signals between 4-6 AND score in [6, 8]      -> 'mid-market'
//   signals between 7-10 AND score in [8, 9]     -> 'large-market'
//   signals > 10 AND score >= 9                  -> 'platform-scale'
//   anything else                                -> nearest-neighbor by signals

function bucketize(signals, score) {
  if (score === null || score === undefined) return 'unknown-bucket';
  const s = (typeof signals === 'number' && isFinite(signals)) ? signals : 0;
  const b = (typeof score === 'number' && isFinite(score)) ? score : 0;
  // Top-down: pick the highest-bucket the input qualifies for. Each bucket
  // requires BOTH signals AND score to satisfy its threshold pair so a
  // single high dimension cannot inflate the estimate.
  if (s > 10 && b >= 9) return 'platform-scale';
  if (s >= 7 && b >= 8) return 'large-market';
  if (s >= 4 && b >= 6) return 'mid-market';
  if (s >= 2 && b >= 5) return 'small-targeted';
  return 'emerging-niche';
}

// ---------- buildPartnershipTargets ----------
//
// Pure-function map from resolved_institutions + resolved_authors to a
// deterministic ordered array of partnership targets. Empty inputs yield
// [] (empty array). Authors precede institutions; both are sorted by the
// natural input order from the upstream fetcher (no re-sort here so
// upstream determinism propagates).

function buildPartnershipTargets(rs_discovery) {
  if (!rs_discovery || typeof rs_discovery !== 'object') return [];
  const out = [];
  const authors = Array.isArray(rs_discovery.resolved_authors) ? rs_discovery.resolved_authors : [];
  for (let i = 0; i < authors.length; i += 1) {
    const a = authors[i];
    if (!a || typeof a !== 'object') continue;
    const name = (typeof a.name === 'string' && a.name.length > 0) ? a.name : null;
    if (!name) continue;
    out.push({
      name: name,
      type: 'author',
      // Score = 1.0 - (i / authors.length) so the upstream-natural-order
      // first author scores highest. Deterministic from input order.
      score: 1.0 - (i / Math.max(authors.length, 1)),
    });
  }
  const institutions = Array.isArray(rs_discovery.resolved_institutions) ? rs_discovery.resolved_institutions : [];
  for (let i = 0; i < institutions.length; i += 1) {
    const inst = institutions[i];
    if (typeof inst !== 'string' || inst.length === 0) continue;
    out.push({
      name: inst,
      type: 'institution',
      score: 1.0 - (i / Math.max(institutions.length, 1)),
    });
  }
  return out;
}

// ---------- buildValueProposition ----------
//
// Deterministic template-fill from frozen VALUE_PROP_TEMPLATES. Picks
// the template by classification (with '_fallback' for missing); fills
// [BRIDGE] / [SOURCE] / [TARGET] tokens from rs_discovery scalars when
// present (with safe defaults otherwise).

function buildValueProposition(rs_discovery) {
  const cls = (rs_discovery && typeof rs_discovery.classification === 'string'
    && (rs_discovery.classification in VALUE_PROP_TEMPLATES))
    ? rs_discovery.classification
    : '_fallback';
  let stem = VALUE_PROP_TEMPLATES[cls];
  const bridge = (rs_discovery && typeof rs_discovery.bridge_concept === 'string'
    && rs_discovery.bridge_concept.length > 0)
    ? rs_discovery.bridge_concept
    : SAFE_DEFAULT_BRIDGE;
  const source = (rs_discovery && typeof rs_discovery.query_concept === 'string'
    && rs_discovery.query_concept.length > 0)
    ? rs_discovery.query_concept
    : SAFE_DEFAULT_SOURCE;
  const target = (rs_discovery && typeof rs_discovery.doc_concept === 'string'
    && rs_discovery.doc_concept.length > 0)
    ? rs_discovery.doc_concept
    : SAFE_DEFAULT_TARGET;
  // Token replacement is deterministic global string replace; no regex
  // escaping needed because tokens are frozen literals.
  stem = stem.split('[BRIDGE]').join(bridge);
  stem = stem.split('[SOURCE]').join(source);
  stem = stem.split('[TARGET]').join(target);
  return stem;
}

// ---------- buildMarketSizeEstimate ----------
//
// Pure-function lookup from frozen MARKET_SIZE_BUCKETS. Reads
// industry_signals_count + breakthrough_score; missing breakthrough_score
// yields 'unknown-bucket' (the safe-default path).

function buildMarketSizeEstimate(rs_discovery) {
  if (!rs_discovery || typeof rs_discovery !== 'object') {
    return MARKET_SIZE_BUCKETS['unknown-bucket'];
  }
  const signals = (typeof rs_discovery.industry_signals_count === 'number')
    ? rs_discovery.industry_signals_count
    : 0;
  // Distinguish "explicitly missing breakthrough_score" (-> unknown-bucket)
  // from "score = 0" (-> emerging-niche by bucketize). The hasOwnProperty
  // check catches the missing case.
  const hasScore = Object.prototype.hasOwnProperty.call(rs_discovery, 'breakthrough_score')
    && rs_discovery.breakthrough_score !== undefined
    && rs_discovery.breakthrough_score !== null;
  const score = hasScore ? rs_discovery.breakthrough_score : null;
  const bucketId = bucketize(signals, score);
  return MARKET_SIZE_BUCKETS[bucketId];
}

// ---------- assess ----------
//
// Public entry point. FIRST line of body: auditQueryObject on the
// composite (rs_discovery, opts) tuple. Throws ExternalEgressViolation on
// any forbidden field BEFORE any computation. The chokepoint is the only
// throw path; all other branches return deterministic safe defaults.
//
// Inputs:
//   rs_discovery  optional object (post-breakthrough-scorer shape)
//   opts          optional object (caller-supplied configuration scalars)
//
// Output:
//   {
//     market_size_estimate: <string from MARKET_SIZE_BUCKETS>,
//     value_proposition:    <string from VALUE_PROP_TEMPLATES>,
//     partnership_targets:  <array of {name, type, score} entries>,
//   }

function assess(rs_discovery, opts) {
  // Canon Part 8 chokepoint: pre-input audit on the composite tuple.
  // Throws ExternalEgressViolation BEFORE any field is touched. Empty
  // tuple is permitted (no-args path); only the audit-on-non-empty
  // branch is adversarial-relevant. We always audit so a malicious
  // opts cannot smuggle through the no-args branch.
  auditQueryObject({
    rs_discovery: (rs_discovery === undefined ? null : rs_discovery),
    opts: (opts === undefined ? null : opts),
  }, 'rs-commercial-assessor-input');

  // Safe-default path: no rs_discovery -> deterministic minimal output.
  const safeIn = (rs_discovery && typeof rs_discovery === 'object') ? rs_discovery : {};

  return {
    market_size_estimate: buildMarketSizeEstimate(safeIn),
    value_proposition: buildValueProposition(safeIn),
    partnership_targets: buildPartnershipTargets(safeIn),
  };
}

// ---------- Exports ----------

module.exports = {
  assess: assess,
  // Re-export sentinel so adversarial fixtures can reference the class
  // without a second require() round-trip.
  ExternalEgressViolation: ExternalEgressViolation,
  _test: {
    VALUE_PROP_TEMPLATES: VALUE_PROP_TEMPLATES,
    MARKET_SIZE_BUCKETS: MARKET_SIZE_BUCKETS,
    SAFE_DEFAULT_BRIDGE: SAFE_DEFAULT_BRIDGE,
    SAFE_DEFAULT_SOURCE: SAFE_DEFAULT_SOURCE,
    SAFE_DEFAULT_TARGET: SAFE_DEFAULT_TARGET,
    bucketize: bucketize,
    buildPartnershipTargets: buildPartnershipTargets,
    buildValueProposition: buildValueProposition,
    buildMarketSizeEstimate: buildMarketSizeEstimate,
  },
};
