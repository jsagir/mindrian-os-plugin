/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 272-05 -- sklearn-compatible TF-IDF vectorizer (TfidfVectorizer parity).
 *
 * Matches sklearn's `TfidfVectorizer` vocabulary, idf, and L2-normalized
 * weight conventions exactly, per tests/272-tfidf-parity.test.cjs (272-01's
 * RED fixture, independently verified against live sklearn 1.8.0 this
 * session). Do not regenerate the fixture's expected values; if this
 * implementation ever disagrees with the test's expected numbers, the
 * FIXTURE is authoritative -- fix this file, not the test.
 *
 * STOPWORD LIST PROVENANCE (deliberate, not a repeat of the frozen literal):
 * the frozen `SKLEARN_ENGLISH_STOPWORDS_v1` constant already lives, verified
 * and RED-pinned, inside tests/272-tfidf-parity.test.cjs (regenerated live
 * via `python3 -c "from sklearn.feature_extraction.text import
 * ENGLISH_STOP_WORDS; print(sorted(ENGLISH_STOP_WORDS))"` in 272-01). Rather
 * than retype that 318-word list a second time as a literal array inside
 * this file's own source, it was extracted PROGRAMMATICALLY from the test
 * file's source text (a small Node script located the array literal by its
 * `const SKLEARN_ENGLISH_STOPWORDS_v1 = [ ... ]` marker, balanced brackets,
 * and evaluated it) and written once to the sibling data file
 * `lib/core/numeric/sklearn-stopwords-v1.json`, which THIS module loads via
 * `require`. Same discipline as `lexical-overlap.cjs`'s frozen, versioned
 * list (a named constant, a `_v1` version tag, recomputable forever) --
 * just sourced from a committed JSON data file instead of a second inline
 * JS literal, since duplicating the same 318-word literal a third time
 * (test file, then this file's own header, then again inline) added no
 * value over loading the one committed copy directly.
 *
 * PIPELINE (matches sklearn's default TfidfVectorizer behavior):
 *   1. Lowercase every document.
 *   2. Tokenize with sklearn's default token_pattern `(?u)\b\w\w+\b`
 *      (word-boundary runs of word chars, length >= 2 -- single-character
 *      tokens are excluded by the PATTERN, not by the stopword list).
 *   3. Remove stopwords (case-insensitive membership in stopWords).
 *   4. Count raw per-document term frequencies.
 *   5. Apply max_df filtering FIRST (drop terms whose document frequency
 *      fraction exceeds maxDf) -- order matters, sklearn does this before
 *      max_features selection.
 *   6. Apply max_features selection by TOTAL corpus term count descending
 *      (sklearn's actual selection criterion; ties broken alphabetically
 *      for determinism, matching CPython's stable sort over the
 *      alphabetically-built candidate list).
 *   7. Final vocabulary is sorted ALPHABETICALLY (matches sklearn's
 *      `get_feature_names_out()` ordering -- selection order and output
 *      order are different steps).
 *   8. idf per selected term: `ln((1+n_docs)/(1+df_t)) + 1`
 *      (the `smooth_idf=True` formula; smoothIdf defaults to true,
 *      matching sklearn's own default and both this phase's callers).
 *   9. Per-document weight = raw term count * idf, then L2-normalize each
 *      document's row (divide by the row's Euclidean norm; an all-zero row
 *      stays all-zero, never divides by zero).
 *
 * PARAMETER DEFAULTS (deliberately caller-neutral -- Pitfall 3 from
 * RESEARCH.md: two different callers, rs-math.cjs Convention A
 * (max_features=2000, max_df=0.5) and hsi-lsa.cjs Convention B
 * (max_features=500, no max_df), must never silently share a value):
 *   - maxFeatures: NO default. Required. Forces every caller explicit.
 *   - maxDf: defaults to 1.0 (sklearn's TRUE default). NEVER 0.5 -- only
 *     rs-math.cjs uses 0.5, and it must pass that value itself.
 *   - stopWords: defaults to the frozen SKLEARN_ENGLISH_STOPWORDS_v1 set
 *     when the caller passes 'english' or omits the option entirely
 *     (both this phase's callers use English stopwords); a caller may also
 *     pass its own explicit array (the parity test does this).
 *   - smoothIdf: defaults to true (sklearn's own default, and both this
 *     phase's callers rely on it).
 *
 * Error-envelope family: matches svd.cjs's `{ok, error, detail}` family
 * (the `rs-*` sibling convention per 272-PATTERNS.md convention 4) for the
 * degenerate/empty-vocabulary case. The happy path returns a plain
 * `{vocabulary, idf, weights}` object with no envelope wrapper, matching
 * the exact shape tests/272-tfidf-parity.test.cjs binds to directly.
 *
 * Pure CJS, zero npm deps, node built-ins only. Never throws.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
'use strict';

const STOPWORDS_DATA = require('./sklearn-stopwords-v1.json');

// Frozen, versioned constant (per lexical-overlap.cjs's own discipline),
// sourced from the committed data file rather than a second inline literal.
const SKLEARN_ENGLISH_STOPWORDS_v1 = Object.freeze(STOPWORDS_DATA.words.slice());

// sklearn's default token_pattern: (?u)\b\w\w+\b -- word-boundary runs of
// word characters, length >= 2. Single-character tokens never enter the
// vocabulary, independent of stopword removal.
const TOKEN_PATTERN = /\b\w{2,}\b/g;

function tokenize(text) {
  const lower = String(text).toLowerCase();
  const matches = lower.match(TOKEN_PATTERN);
  return matches || [];
}

function buildStopwordSet(stopWords) {
  if (stopWords === 'english' || stopWords === undefined || stopWords === null) {
    return new Set(SKLEARN_ENGLISH_STOPWORDS_v1);
  }
  if (Array.isArray(stopWords)) {
    return new Set(stopWords);
  }
  if (stopWords instanceof Set) {
    return stopWords;
  }
  // Unrecognized shape -- treat as no stopwords rather than throwing.
  return new Set();
}

/*
 * fitTfidf(texts, opts): the exported contract tests/272-tfidf-parity.test.cjs
 * binds to directly (function name is load-bearing -- do not rename).
 *
 * opts: { maxFeatures (required), maxDf = 1.0, stopWords = 'english',
 *         smoothIdf = true }
 *
 * Returns { vocabulary: [...termsInOrder], idf: [...perTermIdf],
 *           weights: [[...perDocRow]...] } on success, or
 *           { vocabulary: [], idf: [], weights: [] } on an empty-vocabulary
 *           corpus (never throws; matches svd.cjs's never-throw-across-a-
 *           module-boundary convention).
 */
function fitTfidf(texts, opts) {
  const options = opts || {};
  const maxDf = Number.isFinite(options.maxDf) ? options.maxDf : 1.0;
  const smoothIdf = options.smoothIdf === undefined ? true : !!options.smoothIdf;
  const stopSet = buildStopwordSet(options.stopWords);
  const maxFeatures = Number.isFinite(options.maxFeatures) ? Math.floor(options.maxFeatures) : Infinity;

  if (!Array.isArray(texts) || texts.length === 0) {
    return { vocabulary: [], idf: [], weights: [] };
  }

  const nDocs = texts.length;

  // Per-document token lists (post lowercase/tokenize/stopword-removal).
  const docTokens = texts.map((t) => {
    const toks = tokenize(t);
    const kept = [];
    for (let i = 0; i < toks.length; i += 1) {
      if (!stopSet.has(toks[i])) kept.push(toks[i]);
    }
    return kept;
  });

  // Per-document term counts, and corpus-level total count + document
  // frequency per term.
  const totalCount = new Map();
  const docFreq = new Map();
  const perDocCounts = docTokens.map((tokens) => {
    const counts = new Map();
    for (let i = 0; i < tokens.length; i += 1) {
      const term = tokens[i];
      counts.set(term, (counts.get(term) || 0) + 1);
    }
    counts.forEach((c, term) => {
      totalCount.set(term, (totalCount.get(term) || 0) + c);
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    });
    return counts;
  });

  if (totalCount.size === 0) {
    return { vocabulary: [], idf: [], weights: texts.map(() => []) };
  }

  // Candidate terms sorted alphabetically first (deterministic tie-break
  // basis for the frequency selection step below).
  let candidates = Array.from(totalCount.keys()).sort();

  // Step: max_df filtering FIRST (drop terms in more than maxDf fraction
  // of documents), before max_features selection.
  candidates = candidates.filter((term) => {
    const df = docFreq.get(term) || 0;
    return df / nDocs <= maxDf;
  });

  if (candidates.length === 0) {
    return { vocabulary: [], idf: [], weights: texts.map(() => []) };
  }

  // Step: max_features selection by TOTAL corpus term frequency
  // descending; ties broken alphabetically (candidates is already
  // alphabetical, and Array.prototype.sort is stable in Node, so an
  // alphabetical-then-frequency-descending sort preserves alpha order
  // within equal-frequency groups).
  let selected = candidates;
  if (Number.isFinite(maxFeatures) && candidates.length > maxFeatures) {
    selected = candidates
      .slice()
      .sort((a, b) => (totalCount.get(b) || 0) - (totalCount.get(a) || 0))
      .slice(0, maxFeatures);
  }

  // Final vocabulary: sorted alphabetically (matches sklearn's
  // get_feature_names_out() ordering).
  const vocabulary = selected.slice().sort();
  const vocabIndex = new Map();
  for (let i = 0; i < vocabulary.length; i += 1) vocabIndex.set(vocabulary[i], i);

  // idf per selected term, in vocabulary order: smooth_idf=True formula
  // ln((1+n_docs)/(1+df_t)) + 1. (Non-smoothed variant not needed by
  // either of this phase's callers; smoothIdf defaults true and is the
  // only mode both callers rely on -- a false branch is included for
  // completeness since the option is exposed.)
  const idf = new Array(vocabulary.length);
  for (let i = 0; i < vocabulary.length; i += 1) {
    const term = vocabulary[i];
    const df = docFreq.get(term) || 0;
    idf[i] = smoothIdf
      ? Math.log((1 + nDocs) / (1 + df)) + 1
      : Math.log(nDocs / df) + 1;
  }

  // Per-document weights: raw term count * idf, then L2-normalize the row.
  const weights = new Array(nDocs);
  for (let d = 0; d < nDocs; d += 1) {
    const row = new Array(vocabulary.length).fill(0);
    const counts = perDocCounts[d];
    counts.forEach((count, term) => {
      const idx = vocabIndex.get(term);
      if (idx !== undefined) row[idx] = count * idf[idx];
    });
    let normSq = 0;
    for (let i = 0; i < row.length; i += 1) normSq += row[i] * row[i];
    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (let i = 0; i < row.length; i += 1) row[i] /= norm;
    }
    weights[d] = row;
  }

  return { vocabulary, idf, weights };
}

module.exports = {
  fitTfidf,
  SKLEARN_ENGLISH_STOPWORDS_v1,
};
