'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-01 Task 1 -- Brain derivation prompt builders
 * ======================================================
 * 9 frozen prompt-builder functions. Each maps a Canon-Part-8-safe query
 * context (allow-list scalars only) into a Cypher string (or null for
 * the stub builder). Every builder validates its ctx at function entry
 * against the frozen allow-list schema: an unexpected field or an
 * out-of-range enum triggers a TypeError. Throwing is the safest
 * posture: any forbidden field in ctx is already a Canon Part 8
 * boundary violation upstream.
 *
 * The Canon Part 8 boundary (docs/MINDRIAN-CANON.md Part 8) is enforced
 * at two layers in this file:
 *
 *   1. Schema gate at function entry (allow-list whitelist + enum check).
 *   2. Interpolation hygiene via brain-client.sanitizeCypherInput on the
 *      few enum-like strings that still reach the Cypher template.
 *      Numeric scalars are coerced with Number(...) + isFinite guards
 *      before interpolation. No ctx field is ever concatenated raw.
 *
 * The five Canon Part 8 forbidden triple fields (enumerated in the Plan
 * 90-01 <interfaces> block) DO NOT appear in this module as code or as
 * string literals. A grep audit in the plan verification asserts zero
 * matches against the forbidden-name regex.
 *
 * PROMPT_VERSION bumps force a brain_graph_version mismatch in Plan
 * 90-05 so stale derivations regenerate automatically.
 *
 * Pure CJS, node built-ins only, zero npm deps. Three-surface safe.
 */

const { _test } = require('./brain-client.cjs');
const sanitizeCypherInput = _test.sanitizeCypherInput;

// ---------- Frozen version + allow-list schema ----------

const PROMPT_VERSION = Object.freeze({ value: 1 });

// Canon Part 8 allow-list schema. Every buildXxxQuery(ctx) must receive
// a ctx that is a subset of these keys only. No other keys are permitted.
const ALLOWED_CTX_KEYS = Object.freeze([
  'section_slug',
  'problem_type',
  'complexity',
  'phase_indicator',
  'reasoning_health_score',
  'arguments_count',
  'mece_status',
  'evidence_density',
  'governing_thought_hash',
  'brain_graph_version',
  'reverse_salient_present',
]);

const PROBLEM_TYPES = Object.freeze(['UDP', 'IDP', 'WDP']);
const COMPLEXITIES = Object.freeze(['Simple', 'Complex', 'Wicked']);
const MECE_STATES = Object.freeze(['pass', 'warn', 'fail']);
const PHASE_INDICATORS = Object.freeze([
  'discovery',
  'formulation',
  'validation',
  'scaling',
  'unknown',
]);

// ---------- Ctx validator (Canon Part 8 chokepoint) ----------
//
// Every builder calls validateCtx(ctx) as its first action. A non-object
// ctx throws. A ctx with a key outside ALLOWED_CTX_KEYS throws. Enum
// fields out of range throw. Numeric-range fields outside [0,1] for
// scalars or negative for counts throw.

function validateCtx(ctx) {
  if (ctx === null || typeof ctx !== 'object' || Array.isArray(ctx)) {
    throw new TypeError('ctx must be a non-null plain object');
  }
  const allowed = new Set(ALLOWED_CTX_KEYS);
  for (const k of Object.keys(ctx)) {
    if (!allowed.has(k)) {
      throw new TypeError(
        'ctx contains forbidden or unknown key "' + k +
        '" (Canon Part 8 allow-list violation)'
      );
    }
  }
  if ('problem_type' in ctx && ctx.problem_type !== undefined && ctx.problem_type !== null) {
    if (PROBLEM_TYPES.indexOf(ctx.problem_type) === -1) {
      throw new TypeError(
        'ctx.problem_type "' + ctx.problem_type + '" not in [UDP, IDP, WDP]'
      );
    }
  }
  if ('complexity' in ctx && ctx.complexity !== undefined && ctx.complexity !== null) {
    if (COMPLEXITIES.indexOf(ctx.complexity) === -1) {
      throw new TypeError(
        'ctx.complexity "' + ctx.complexity + '" not in [Simple, Complex, Wicked]'
      );
    }
  }
  if ('mece_status' in ctx && ctx.mece_status !== undefined && ctx.mece_status !== null) {
    if (MECE_STATES.indexOf(ctx.mece_status) === -1) {
      throw new TypeError(
        'ctx.mece_status "' + ctx.mece_status + '" not in [pass, warn, fail]'
      );
    }
  }
  if ('phase_indicator' in ctx && ctx.phase_indicator !== undefined && ctx.phase_indicator !== null) {
    if (PHASE_INDICATORS.indexOf(ctx.phase_indicator) === -1) {
      throw new TypeError(
        'ctx.phase_indicator "' + ctx.phase_indicator + '" not in allowed enum'
      );
    }
  }
  if ('reasoning_health_score' in ctx && ctx.reasoning_health_score !== null && ctx.reasoning_health_score !== undefined) {
    const n = Number(ctx.reasoning_health_score);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      throw new TypeError('ctx.reasoning_health_score must be finite in [0,1]');
    }
  }
  if ('evidence_density' in ctx && ctx.evidence_density !== null && ctx.evidence_density !== undefined) {
    const n = Number(ctx.evidence_density);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      throw new TypeError('ctx.evidence_density must be finite in [0,1]');
    }
  }
  if ('arguments_count' in ctx && ctx.arguments_count !== null && ctx.arguments_count !== undefined) {
    const n = Number(ctx.arguments_count);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new TypeError('ctx.arguments_count must be a non-negative integer');
    }
  }
  if ('governing_thought_hash' in ctx && ctx.governing_thought_hash !== null && ctx.governing_thought_hash !== undefined) {
    if (typeof ctx.governing_thought_hash !== 'string' ||
        !/^sha256:[a-f0-9]{64}$/.test(ctx.governing_thought_hash)) {
      throw new TypeError(
        'ctx.governing_thought_hash must match /^sha256:[a-f0-9]{64}$/'
      );
    }
  }
  if ('section_slug' in ctx && ctx.section_slug !== null && ctx.section_slug !== undefined) {
    if (typeof ctx.section_slug !== 'string' ||
        !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(ctx.section_slug)) {
      throw new TypeError(
        'ctx.section_slug must be a structural folder slug (lowercase, hyphen/underscore)'
      );
    }
  }
}

// ---------- Safe interpolation helpers ----------
//
// Every string reaching the Cypher template goes through
// sanitizeCypherInput. Every numeric reaches via Number() + clamp.

function safeEnum(value, fallback) {
  return sanitizeCypherInput(String(value == null ? fallback : value));
}

function safeScalar01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(fallback) || 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function safeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(fallback) | 0;
  if (n < 0) return 0;
  return Math.floor(n);
}

// ---------- 9 prompt builders ----------
//
// Each builder returns a Cypher string (or pinecone-style search string).
// Parameterized Cypher style is not native to the Brain MCP callTool
// interface (which takes raw cypher); interpolation is unavoidable.
// Safety is achieved by the two-layer validation above.

// BUG 2 fix: was mode:'query' (admin-gated brain_query with ADDRESSES_PROBLEM_TYPE
// Cypher). Repointed to mode:'search' (ungated brain_search). Returns a semantic
// search string instead of Cypher. The Brain's Pinecone index surfaces frameworks
// that address the problem type and phase via embedding similarity.
// Canon Part 8: only frozen enum strings are interpolated -- no user content.
function buildPatternMatchesQuery(ctx) {
  validateCtx(ctx);
  const section = safeEnum(ctx.section_slug, 'unknown');
  const problemType = safeEnum(ctx.problem_type, 'UDP');
  const phase = safeEnum(ctx.phase_indicator, 'unknown');
  return (
    'frameworks that address problem_type:' + problemType +
    ' at phase:' + phase +
    ' for section:' + section
  );
}

function buildCrossDomainAnalogiesQuery(ctx) {
  validateCtx(ctx);
  // Pinecone semantic search. Returns a string that brain-client.search()
  // will pass in as queryText. Methodology handles only.
  const problemType = safeEnum(ctx.problem_type, 'UDP');
  const complexity = safeEnum(ctx.complexity, 'Simple');
  const phase = safeEnum(ctx.phase_indicator, 'unknown');
  return (
    'cross-domain analogies for problem_type:' + problemType +
    ' complexity:' + complexity +
    ' phase:' + phase
  );
}

function buildWickedIndicatorsQuery(ctx) {
  validateCtx(ctx);
  const problemType = safeEnum(ctx.problem_type, 'UDP');
  const complexity = safeEnum(ctx.complexity, 'Simple');
  // Only emit a meaningful query when the triple shape suggests wickedness.
  if (problemType !== 'IDP' && !(problemType === 'WDP' && complexity === 'Wicked')) {
    return (
      'MATCH (wi:WickedIndicator) WHERE false ' +
      'RETURN wi.name AS indicator LIMIT 1'
    );
  }
  return (
    'MATCH (wi:WickedIndicator)-[:FLAGS_PROBLEM_TYPE]->(pt:ProblemType) ' +
    'WHERE pt.name CONTAINS "' + problemType + '" ' +
    'RETURN wi.name AS indicator, wi.description AS description LIMIT 10'
  );
}

function buildUnfilledOpportunityMatchesQuery(ctx) {
  validateCtx(ctx);
  const section = safeEnum(ctx.section_slug, 'unknown');
  const problemType = safeEnum(ctx.problem_type, 'UDP');
  return (
    'MATCH (o:Opportunity)-[:MATCHES_SECTION]->(s:Section {slug: "' + section + '"}) ' +
    'WHERE NOT (o)-[:FILLED_BY]->() ' +
    'OPTIONAL MATCH (o)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: "' + problemType + '"}) ' +
    'RETURN o.name AS opportunity, o.description AS description LIMIT 10'
  );
}

// BUG 2 fix: was mode:'query' (admin-gated brain_query with FEEDS_INTO Cypher).
// Repointed to mode:'search' (ungated brain_search). Returns a semantic
// search string instead of Cypher. The Brain's Pinecone index surfaces framework
// chain predictions via embedding similarity on FEEDS_INTO relationships.
// Canon Part 8: only frozen enum strings are interpolated -- no user content.
function buildFrameworkChainPredictionsQuery(ctx) {
  validateCtx(ctx);
  const phase = safeEnum(ctx.phase_indicator, 'unknown');
  const problemType = safeEnum(ctx.problem_type, 'UDP');
  return (
    'framework chain predictions FEEDS_INTO phase:' + phase +
    ' problem_type:' + problemType
  );
}

function buildAssessmentThinkingChainPositionQuery(ctx) {
  validateCtx(ctx);
  const rhs = safeScalar01(ctx.reasoning_health_score, 0);
  const ed = safeScalar01(ctx.evidence_density, 0);
  return (
    'MATCH (rl:RigorLevel) ' +
    'WHERE rl.min_health <= ' + rhs + ' AND rl.max_health >= ' + rhs + ' ' +
    'AND rl.min_evidence <= ' + ed + ' AND rl.max_evidence >= ' + ed + ' ' +
    'RETURN rl.name AS level, rl.advance_hint AS hint LIMIT 5'
  );
}

function buildProblemTypeClassificationQuery(ctx) {
  validateCtx(ctx);
  const meceStatus = safeEnum(ctx.mece_status, 'warn');
  const argsCount = safeInt(ctx.arguments_count, 0);
  return (
    'MATCH (pt:ProblemType) ' +
    'WHERE pt.mece_status = "' + meceStatus + '" ' +
    'AND pt.min_arguments <= ' + argsCount + ' ' +
    'AND pt.max_arguments >= ' + argsCount + ' ' +
    'RETURN pt.name AS problem_type, pt.confidence AS confidence LIMIT 5'
  );
}

// Stub for Plan 90-06 cross-room aggregation. Returns null by contract:
// Plan 90-01 does not implement cross-room edge aggregation. Plan 90-06
// will fill this with a real Cypher query once cross-room edges exist.
function buildFlaggedContradictionsXroomQuery(ctx) {
  validateCtx(ctx);
  return null;
}

function buildHsiSignalsQuery(ctx) {
  validateCtx(ctx);
  if (!ctx.reverse_salient_present) return null;
  const section = safeEnum(ctx.section_slug, 'unknown');
  const problemType = safeEnum(ctx.problem_type, 'UDP');
  return (
    'MATCH (hsi:HsiRecommendation)-[:FOR_SECTION]->(s:Section {slug: "' + section + '"}) ' +
    'OPTIONAL MATCH (hsi)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: "' + problemType + '"}) ' +
    'RETURN hsi.name AS name, hsi.description AS description, hsi.score AS score LIMIT 5'
  );
}

// ---------- Exports (frozen) ----------

module.exports = Object.freeze({
  PROMPT_VERSION: PROMPT_VERSION,
  ALLOWED_CTX_KEYS: ALLOWED_CTX_KEYS,
  PROBLEM_TYPES: PROBLEM_TYPES,
  COMPLEXITIES: COMPLEXITIES,
  MECE_STATES: MECE_STATES,
  PHASE_INDICATORS: PHASE_INDICATORS,
  buildPatternMatchesQuery: buildPatternMatchesQuery,
  buildCrossDomainAnalogiesQuery: buildCrossDomainAnalogiesQuery,
  buildWickedIndicatorsQuery: buildWickedIndicatorsQuery,
  buildUnfilledOpportunityMatchesQuery: buildUnfilledOpportunityMatchesQuery,
  buildFrameworkChainPredictionsQuery: buildFrameworkChainPredictionsQuery,
  buildAssessmentThinkingChainPositionQuery: buildAssessmentThinkingChainPositionQuery,
  buildProblemTypeClassificationQuery: buildProblemTypeClassificationQuery,
  buildFlaggedContradictionsXroomQuery: buildFlaggedContradictionsXroomQuery,
  buildHsiSignalsQuery: buildHsiSignalsQuery,
  // Test surface only: not part of the public API.
  _test: Object.freeze({
    validateCtx: validateCtx,
    safeEnum: safeEnum,
    safeScalar01: safeScalar01,
    safeInt: safeInt,
  }),
});
