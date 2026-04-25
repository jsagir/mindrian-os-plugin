/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1 Plan 02 -- Sequential-Thinking-style domain analyzer.
 *
 * Deterministic decomposition: indexes Brain methodology substrate
 * against topic n-grams; seeds the 7-field output (primary_domain,
 * concepts, terminology, methods, breakthroughs, boundary_flag,
 * adjacent_domains) from substrate metadata + topic intersection.
 * NO runtime LLM call. NO Brain-write surface. analyzeDomain NEVER
 * throws unless ExternalEgressViolation fires (Canon Part 8 third
 * tripwire on output before return).
 *
 * Canon Part 7 (Reuse Before Build): wraps loadSubstrate from
 * lib/core/rs-brain-substrate.cjs and FORBIDDEN_PATTERNS from
 * lib/core/rs-brain-substrate-prompts.cjs. Both surfaces remain
 * untouched; this module is a pure consumer.
 *
 * Canon Part 8 (Graph Boundary): output passes FORBIDDEN_PATTERNS
 * scan before return. Topic also passes pre-input FORBIDDEN_PATTERNS
 * scan; user-controlled inputs are scrubbed at the gate. Substrate
 * metadata that contains forbidden patterns is either scrubbed
 * (scalars become null) or causes ExternalEgressViolation at the
 * pre-return audit. Reason: concepts/terminology/methods/breakthroughs/
 * adjacent_domains will all flow downstream into 89.2 external
 * fetchers (OpenAlex, arXiv, Tavily, Scopus, PubMed). Leaked user
 * content here = leaked to public endpoints.
 *
 * Pure CJS, zero npm deps, node built-ins only.
 */
'use strict';

const rsBrainSubstrate = require('./rs-brain-substrate.cjs');
const prompts = require('./rs-brain-substrate-prompts.cjs');
const { FORBIDDEN_PATTERNS } = prompts;

// ---------- ExternalEgressViolation (Canon Part 8 sibling) ----------
//
// Sibling of BrainBoundaryViolation. The two surfaces are semantically
// distinct: BrainBoundaryViolation guards inbound queries to Brain;
// ExternalEgressViolation guards outbound flow to public external
// fetchers (OpenAlex / arXiv / Tavily / Scopus / PubMed). Sharing the
// class would conflate two different bottlenecks.

class ExternalEgressViolation extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'ExternalEgressViolation';
    this.meta = meta || {};
  }
}

// ---------- Constants ----------

const TOPIC_MAX_LEN = 512;
const BOUNDARY_THRESHOLD_DEFAULT = 0.5;
const ADJACENT_DOMAINS_MAX = 5;
const CONCEPTS_MAX = 10;
const TERMINOLOGY_MAX = 10;
const METHODS_MAX = 10;
const BREAKTHROUGHS_MAX = 10;

// English stopwords for n-gram filtering. Frozen, deterministic.
const STOPWORDS = Object.freeze(new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'have', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'this', 'to', 'was', 'were', 'will', 'with',
  'i', 'you', 'we', 'they', 'he', 'she', 'our', 'their',
]));

// ---------- tokenize ----------
//
// Lowercase, alpha+digit only, stopwords stripped, length >= 2.
// Deterministic: same input always produces same output.

function tokenize(s) {
  if (typeof s !== 'string') return [];
  return s.toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(function (t) { return t.length >= 2 && !STOPWORDS.has(t); });
}

// ---------- ngrams ----------
//
// 1-grams + 2-grams as a Set for O(1) intersection lookup.

function ngrams(tokens) {
  const out = new Set(tokens);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    out.add(tokens[i] + ' ' + tokens[i + 1]);
  }
  return out;
}

// ---------- scrubScalar ----------
//
// Returns null if the input string contains any FORBIDDEN_PATTERNS hit;
// otherwise returns the input unchanged. Non-string inputs returned as-is.

function scrubScalar(s) {
  if (typeof s !== 'string') return s;
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(s)) return null;
  }
  return s;
}

// ---------- auditOutput ----------
//
// Final pre-return tripwire (Canon Part 8). JSON.stringifies the output
// and scans against FORBIDDEN_PATTERNS. Any hit throws ExternalEgressViolation.
// This is the third tripwire for the analyzer surface (after pre-input scan
// and per-scalar scrub) and guarantees that even composite output (where
// individual scalars passed) cannot smuggle a forbidden pattern via
// concatenation or reformatting.

function auditOutput(output) {
  const json = JSON.stringify(output);
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(json)) {
      throw new ExternalEgressViolation(
        'analyzer output contains forbidden pattern: ' + re.source,
        { pattern: re.source }
      );
    }
  }
}

// ---------- validateTopic ----------
//
// Input gate. Returns {ok:true, topic:trimmed} on success, or a structured
// {ok:false, error, reason, ...} envelope on failure. Pre-input
// FORBIDDEN_PATTERNS scan blocks user-controlled topics that already carry
// forbidden bytes (Canon Part 8: user input scrubbing at the gate).

function validateTopic(topic) {
  if (typeof topic !== 'string') {
    return { ok: false, error: 'invalid_topic', reason: 'not_string' };
  }
  const trimmed = topic.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'invalid_topic', reason: 'empty_or_whitespace' };
  }
  if (trimmed.length > TOPIC_MAX_LEN) {
    return { ok: false, error: 'invalid_topic', reason: 'oversized', max: TOPIC_MAX_LEN };
  }
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(trimmed)) {
      return { ok: false, error: 'invalid_topic', reason: 'forbidden_input' };
    }
  }
  return { ok: true, topic: trimmed };
}

// ---------- scoreEntryAgainstTopic ----------
//
// Returns: substrate score (default 0) * (1 + token-intersection-overlap).
// Multiplier weights base substrate confidence by topic relevance.
// Deterministic: same inputs always produce same output.

function scoreEntryAgainstTopic(entry, topicNgrams, topicTokenCount) {
  const baseScore = (typeof entry.score === 'number') ? entry.score : 0;
  const entryText = [];
  const md = entry && entry.metadata;
  if (md && typeof md === 'object') {
    for (const k of ['framework_name', 'title', 'text', 'tier']) {
      if (typeof md[k] === 'string') entryText.push(md[k]);
    }
  }
  const entryTokens = ngrams(tokenize(entryText.join(' ')));
  let intersection = 0;
  for (const tok of topicNgrams) {
    if (entryTokens.has(tok)) intersection += 1;
  }
  const overlap = topicTokenCount > 0 ? (intersection / topicTokenCount) : 0;
  return baseScore * (1 + overlap);
}

// ---------- analyzeDomain ----------
//
// Public entry point. Deterministic. NEVER throws except for
// ExternalEgressViolation (Canon Part 8). All other failure modes
// return structured-error envelopes.
//
// Inputs:
//   topic   string in (0, TOPIC_MAX_LEN] characters, scrubbed against
//           FORBIDDEN_PATTERNS.
//   opts    optional object:
//             roomDir              string. Defaults to MINDRIAN_ROOM env or process.cwd().
//             limit                integer. Substrate pull limit. Default 100.
//             forceRefresh         boolean. Bypass cache. Default false.
//             boundary_threshold   number. Top-score floor. Default 0.5.
//
// Output (happy path):
//   {
//     primary_domain   : string | null,
//     concepts         : string[],
//     terminology      : string[],
//     methods          : string[],
//     breakthroughs    : string[],
//     boundary_flag    : boolean,
//     adjacent_domains : string[],
//     warning?         : string,
//   }
//
// Output (input failure):
//   {ok:false, error:'invalid_topic', reason:'...', max?:512}
//
// All scalars in the output are guaranteed to have passed FORBIDDEN_PATTERNS
// (per-field scrub) and the composite output is guaranteed to have passed
// the JSON.stringify audit. Any forbidden pattern reaching the boundary
// throws ExternalEgressViolation before egress.

async function analyzeDomain(topic, opts) {
  opts = opts || {};
  const topicCheck = validateTopic(topic);
  if (!topicCheck.ok) return topicCheck;

  const boundaryThreshold = (typeof opts.boundary_threshold === 'number')
    ? opts.boundary_threshold
    : BOUNDARY_THRESHOLD_DEFAULT;

  // Pull substrate via 89.1a chokepoint. Canon Part 7 Reuse Before Build:
  // we never call brain-client directly; loadSubstrate is the only path.
  let substrateResult;
  try {
    substrateResult = await rsBrainSubstrate.loadSubstrate({
      roomDir: opts.roomDir || process.env.MINDRIAN_ROOM || process.cwd(),
      limit: opts.limit || 100,
      forceRefresh: !!opts.forceRefresh,
    });
  } catch (err) {
    // Defensive: loadSubstrate is contracted to never throw, but we still wrap.
    const out = {
      primary_domain: null,
      concepts: [],
      terminology: [],
      methods: [],
      breakthroughs: [],
      boundary_flag: true,
      adjacent_domains: [],
      warning: 'substrate_load_failed: ' + String(err && err.message),
    };
    auditOutput(out);
    return out;
  }

  const substrate = (substrateResult && Array.isArray(substrateResult.substrate))
    ? substrateResult.substrate
    : [];

  // Tier-0 path: no substrate -> degraded valid output.
  if (substrate.length === 0) {
    const out = {
      primary_domain: null,
      concepts: [],
      terminology: [],
      methods: [],
      breakthroughs: [],
      boundary_flag: true,
      adjacent_domains: [],
      warning: 'substrate_empty_tier0',
    };
    auditOutput(out);
    return out;
  }

  // Score and rank.
  const topicTokens = tokenize(topicCheck.topic);
  const topicNgramSet = ngrams(topicTokens);
  const ranked = substrate
    .map(function (e) {
      return {
        entry: e,
        score: scoreEntryAgainstTopic(e, topicNgramSet, topicTokens.length),
      };
    })
    .sort(function (a, b) { return b.score - a.score; });

  const top = ranked[0];
  const primaryName = (top && top.entry && top.entry.metadata &&
    top.entry.metadata.framework_name) || null;
  const primary = scrubScalar(primaryName);

  // boundary_flag: top score below threshold OR primary scrubbed to null OR top missing.
  const boundary_flag = (!top) || (top.score < boundaryThreshold) || primary === null;

  // Seed lists. Deterministic: ranked order is stable; dedup via Set.
  // Per-field scrubScalar guarantees individual entries are clean.
  function seedFromMetadata(field, max) {
    const seen = new Set();
    const out = [];
    for (const r of ranked) {
      if (out.length >= max) break;
      const v = r.entry && r.entry.metadata && r.entry.metadata[field];
      const safe = scrubScalar(v);
      if (typeof safe === 'string' && safe.length > 0 && !seen.has(safe)) {
        seen.add(safe);
        out.push(safe);
      }
    }
    return out;
  }

  const concepts = seedFromMetadata('framework_name', CONCEPTS_MAX);
  const terminology = seedFromMetadata('title', TERMINOLOGY_MAX);
  const methods = seedFromMetadata('framework_name', METHODS_MAX);

  // Breakthroughs: tier === 'core' subset (highest-confidence canonical methods).
  const breakthroughs = (function () {
    const seen = new Set();
    const out = [];
    for (const r of ranked) {
      if (out.length >= BREAKTHROUGHS_MAX) break;
      const md = r.entry && r.entry.metadata;
      if (md && md.tier === 'core') {
        const safe = scrubScalar(md.framework_name);
        if (typeof safe === 'string' && safe.length > 0 && !seen.has(safe)) {
          seen.add(safe);
          out.push(safe);
        }
      }
    }
    return out;
  })();

  // Adjacent: top framework_names not equal to primary, capped at 5.
  const adjacent_domains = (function () {
    const seen = new Set();
    const out = [];
    for (const r of ranked) {
      if (out.length >= ADJACENT_DOMAINS_MAX) break;
      const safe = scrubScalar(
        r.entry && r.entry.metadata && r.entry.metadata.framework_name
      );
      if (typeof safe === 'string' && safe.length > 0 &&
          safe !== primary && !seen.has(safe)) {
        seen.add(safe);
        out.push(safe);
      }
    }
    return out;
  })();

  const result = {
    primary_domain: primary,
    concepts: concepts,
    terminology: terminology,
    methods: methods,
    breakthroughs: breakthroughs,
    boundary_flag: boundary_flag,
    adjacent_domains: adjacent_domains,
  };

  // Carry mode warning if degraded.
  if (substrateResult && substrateResult.warning) {
    result.warning = substrateResult.warning;
  }

  // Final pre-return audit (Canon Part 8 third tripwire on output side).
  auditOutput(result);
  return result;
}

// ---------- Exports ----------

module.exports = {
  analyzeDomain: analyzeDomain,
  ExternalEgressViolation: ExternalEgressViolation,
  _test: {
    tokenize: tokenize,
    ngrams: ngrams,
    scrubScalar: scrubScalar,
    auditOutput: auditOutput,
    validateTopic: validateTopic,
    scoreEntryAgainstTopic: scoreEntryAgainstTopic,
    TOPIC_MAX_LEN: TOPIC_MAX_LEN,
    BOUNDARY_THRESHOLD_DEFAULT: BOUNDARY_THRESHOLD_DEFAULT,
    ADJACENT_DOMAINS_MAX: ADJACENT_DOMAINS_MAX,
    CONCEPTS_MAX: CONCEPTS_MAX,
    TERMINOLOGY_MAX: TERMINOLOGY_MAX,
    METHODS_MAX: METHODS_MAX,
    BREAKTHROUGHS_MAX: BREAKTHROUGHS_MAX,
  },
};
