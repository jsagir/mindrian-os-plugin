/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-03 -- the no-Python lexical leg of the measured differential.
 *
 * Pure-CJS deterministic pair-wise lexical similarity: Jaccard over normalized,
 * stopword-filtered token SETS. This is the PAIR-WISE lexical anchor of the
 * measured differential (scoreMeasured in rs-differential-scorer.cjs). SEED-049
 * decision D2 retires the Python sklearn LSA spawn on this measured path; a
 * 2-document IDF+SVD is mathematically degenerate anyway (see the Part 7
 * carve-out in rs-differential-scorer.cjs), so the pair-wise lexical question is
 * answered here by vocabulary overlap -- real, reproducible, cheap, zero deps.
 *
 * NOTE (different job, do not conflate): CORPUS-LEVEL retrieval lexical scoring
 * lives in the tri-modal index as FTS5/BM25 (211-02). That ranks a query against
 * a whole corpus. THIS module answers a single pair "how much vocabulary do these
 * two texts share," which is the eureka signal: the canonical breakthrough pair
 * (sleep-science circadian rhythm vs manufacturing shift scheduling) shares NO
 * content vocabulary (lexical ~0) while a real embedding sees the meaning link
 * (semantic high) -- the SIGNED gap between the two legs is the insight.
 *
 * Provenance: the metric is VERSIONED as 'jaccard-v1'. The version tag refers to
 * this exact frozen stopword list PLUS these exact tokenize rules (lowercase,
 * split on non-alphanumerics, drop tokens shorter than 2 chars, drop stopwords).
 * Any future change to the list or the rules MUST bump to 'jaccard-v2' so a
 * stored differential number can always be recomputed against the metric that
 * produced it.
 *
 * Pure CJS, zero npm deps, node built-ins only. Never throws.
 */
'use strict';

// The versioned method tag stamped on every measured differential result. Bump
// to 'jaccard-v2' if STOPWORDS or the tokenize rules below change.
const LEXICAL_METHOD = 'jaccard-v1';

// Frozen English stopword list (~60 common function words). Frozen as a module
// constant so the metric is versioned: 'jaccard-v1' == this exact set + rules.
const STOPWORDS = Object.freeze(new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'once', 'here',
  'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'can', 'will', 'just', 'of', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'this', 'that', 'these', 'those', 'it', 'its', 'around',
]));

// ---------- tokenize ----------
//
// Deterministic normalization: lowercase, split on any run of non-alphanumeric
// characters, drop tokens shorter than 2 chars, drop stopwords. Same input ->
// same ordered token list, every run. Non-string input yields [] (never throws).

function tokenize(text) {
  if (typeof text !== 'string') return [];
  const lowered = text.toLowerCase();
  const raw = lowered.split(/[^a-z0-9]+/);
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const tok = raw[i];
    if (tok.length < 2) continue;
    if (STOPWORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

// ---------- lexicalOverlap ----------
//
// Jaccard similarity = |intersection| / |union| over the two token SETS. Both
// inputs empty (or entirely stopwords/punctuation) yields 0.0 -- never NaN,
// never a throw. Identical content vocabulary yields 1.0; disjoint yields 0.0.

function lexicalOverlap(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 0.0;
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  if (union === 0) return 0.0;
  return inter / union;
}

// ---------- Exports ----------

module.exports = {
  lexicalOverlap: lexicalOverlap,
  tokenize: tokenize,
  LEXICAL_METHOD: LEXICAL_METHOD,
  _test: {
    STOPWORDS: STOPWORDS,
    LEXICAL_METHOD: LEXICAL_METHOD,
  },
};
