/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 272 -- CJS port of lib/core/rs_math.py, the reverse-salient math core.
 *
 * Ports the authoritative Hughes 1983 / Kwan 2023 reverse-salient algorithm
 * from lib/core/rs_math.py into pure CJS functions. Consumed by
 * lib/core/rs-engine.cjs (272-08) for the structural/LSA leg of the
 * reverse-salient computation.
 *
 * ALGORITHM WARNING (ported verbatim from rs_math.py's own docstring, this
 * is load-bearing documentation, not decoration -- do not remove):
 *
 *   "The distinguishing property of this algorithm is TOPIC-KEYWORD-
 *   MEMBERSHIP COUNTING + signed abs-diff detection -- NOT cosine on the
 *   SVD-reduced matrix, NOT MiniLM cosine. Do not replace these with more
 *   modern defaults; ALGORITHM-SOURCE.md documents why the keyword-
 *   membership signal is load-bearing." (rs_math.py:12-16)
 *
 *   And from count_topic_membership's own docstring (rs_math.py:104-108):
 *   "CRITICAL: this is NOT cosine on the SVD-reduced matrix. It measures
 *   whether papers share topic-level keywords (top 7 terms per SVD
 *   component). ALGORITHM-SOURCE.md line 72 warns that swapping this for
 *   cosine similarity on the SVD-reduced matrix changes the signal
 *   entirely. Do not optimize this."
 *
 * CONVENTION A (this file's direction convention; Phase 355 D-03 moved the
 * comparison-to-label RULE itself to lib/core/direction-convention.cjs --
 * classifyDirection below is a one-line delegate to that module's
 * classifyDiff(), finite-input behavior unchanged. hsi-lsa.cjs's
 * SIMILARITY ALGORITHM stays a separate, un-unified computation -- see
 * 272-PATTERNS.md convention 8 -- only the label rule moved):
 *
 *   signed_diff = semantic - lsa
 *   signed_diff > 0  -> structural_transfer      (different keywords, similar meaning)
 *   signed_diff <= 0 -> semantic_implementation  (same keywords, different meaning)
 *
 * This module consumes lib/core/numeric/tfidf.cjs and lib/core/numeric/
 * svd.cjs (272-05) rather than reimplementing TF-IDF or SVD inline (Canon
 * Part 7, reuse before build).
 *
 * Error-envelope family: {ok, error, detail} on failure (matches svd.cjs /
 * tfidf.cjs, the rs-* sibling family per 272-PATTERNS.md convention 4). The
 * happy path for each function returns its raw result (a plain array or
 * object) with no wrapper, matching the exact shapes
 * tests/272-absdiff-topk.test.cjs and tests/272-direction-convention.test.cjs
 * bind to directly. Never throws across the module boundary.
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
'use strict';

// 2026: the heavy numeric deps and the direction rule are required lazily so
// the pure matrix functions (countTopicMembership, normalizeAndL1Similarity,
// absDiffTopk, the percentile helpers) load and run with no other module
// present. Behaviour of every export is unchanged when the modules exist.
function _tfidf() { return require('./numeric/tfidf.cjs'); }
function _svd() { return require('./numeric/svd.cjs'); }
function _direction() { return require('./direction-convention.cjs'); }

const DEFAULT_MAX_FEATURES = 2000;
const DEFAULT_MAX_DF = 0.5;
const DEFAULT_N_COMPONENTS = 80;
const DEFAULT_TOP_K = 7;
const DEFAULT_ABS_DIFF_K = 1000;

// ---------------------------------------------------------------------------
// Step 1: TF-IDF + Truncated SVD
// ---------------------------------------------------------------------------

/*
 * buildTfidfSvd(texts, opts): ports rs_math.py:32-71 (build_tfidf_svd).
 *
 * Fits TF-IDF (max_features=2000, max_df=0.5, stop_words='english',
 * smooth_idf=True by default, all overridable via opts) via
 * numeric/tfidf.cjs::fitTfidf, then clamps n_components to
 * max(1, min(80, n_rows-1, n_terms-1)) -- computed HERE, not inside
 * svd.cjs, per 272-05's contract that svd.cjs does not own that policy --
 * and calls numeric/svd.cjs::truncatedSvdWithSignFlip with that clamped
 * count.
 *
 * Returns { ok: true, vocabulary, idf, weights, components, singularValues,
 * effectiveComponents } on success, or { ok: false, error, detail } if the
 * corpus is empty or produces an empty vocabulary.
 */
function buildTfidfSvd(texts, opts) {
  const options = opts || {};
  const maxFeatures = Number.isFinite(options.maxFeatures) ? options.maxFeatures : DEFAULT_MAX_FEATURES;
  const maxDf = Number.isFinite(options.maxDf) ? options.maxDf : DEFAULT_MAX_DF;
  const nComponentsRequested = Number.isFinite(options.nComponents)
    ? options.nComponents
    : DEFAULT_N_COMPONENTS;
  const stopWords = options.stopWords === undefined ? 'english' : options.stopWords;
  const smoothIdf = options.smoothIdf === undefined ? true : !!options.smoothIdf;

  if (!Array.isArray(texts) || texts.length === 0) {
    return { ok: false, error: 'empty_corpus', detail: 'texts must be a non-empty array' };
  }

  const tfidfResult = _tfidf().fitTfidf(texts, { maxFeatures, maxDf, stopWords, smoothIdf });
  const vocabulary = tfidfResult.vocabulary || [];
  const idf = tfidfResult.idf || [];
  const weights = tfidfResult.weights || [];

  if (vocabulary.length === 0) {
    return { ok: false, error: 'empty_vocabulary', detail: 'TF-IDF produced an empty vocabulary for this corpus' };
  }

  const nRows = texts.length;
  const nTerms = vocabulary.length;
  const effectiveComponents = Math.max(1, Math.min(nComponentsRequested, nRows - 1, nTerms - 1));

  const svdResult = _svd().truncatedSvdWithSignFlip(weights, effectiveComponents, options.svdOpts);
  if (!svdResult.ok) {
    return { ok: false, error: 'svd_failed', detail: svdResult.detail || svdResult.error || 'unknown SVD failure' };
  }

  return {
    ok: true,
    vocabulary,
    idf,
    weights,
    components: svdResult.components,
    singularValues: svdResult.singularValues,
    effectiveComponents,
  };
}

// ---------------------------------------------------------------------------
// Step 2: Extract top-k keywords per SVD component
// ---------------------------------------------------------------------------

/*
 * extractTopicKeywords(components, terms, topK): ports rs_math.py:75-88
 * (extract_topic_keywords). Per SVD component, sort the term weights
 * DESCENDING and slice the top topK (default 7) term names. Operates on the
 * ALREADY-sign-flipped `components` output from numeric/svd.cjs -- this
 * step itself does no additional sign handling.
 */
function extractTopicKeywords(components, terms, topK) {
  const k = Number.isFinite(topK) ? topK : DEFAULT_TOP_K;
  if (!Array.isArray(components)) return [];
  const topics = [];
  for (let c = 0; c < components.length; c += 1) {
    const row = components[c] || [];
    const pairs = [];
    for (let t = 0; t < row.length; t += 1) {
      pairs.push([terms[t], row[t]]);
    }
    pairs.sort((a, b) => b[1] - a[1]);
    topics.push(pairs.slice(0, k).map((p) => p[0]));
  }
  return topics;
}

// ---------------------------------------------------------------------------
// Step 3: Topic-keyword-membership counting (the authoritative signature)
// ---------------------------------------------------------------------------

/*
 * countTopicMembership(tokenizedPapers, topics): ports rs_math.py:95-116
 * (count_topic_membership). For each paper's whitespace-split tokens, count
 * membership in each topic's keyword SET (Set-based O(1) lookup, matching
 * the Python's own `set(t) for t in topics` precomputation). Returns a
 * dense (n_papers x n_topics) 2D array.
 *
 * CRITICAL (carried forward from rs_math.py's own docstring): this is NOT
 * cosine on the SVD-reduced matrix. Do not substitute a cosine-similarity
 * computation for this membership-counting step -- the signal is different.
 */
function countTopicMembership(tokenizedPapers, topics) {
  const papers = Array.isArray(tokenizedPapers) ? tokenizedPapers : [];
  const nPapers = papers.length;
  const nTopics = Array.isArray(topics) ? topics.length : 0;

  const topicSets = [];
  for (let j = 0; j < nTopics; j += 1) topicSets.push(new Set(topics[j] || []));

  const counts = [];
  for (let i = 0; i < nPapers; i += 1) counts.push(new Array(nTopics).fill(0));

  for (let i = 0; i < nPapers; i += 1) {
    const tokens = papers[i] || [];
    for (let w = 0; w < tokens.length; w += 1) {
      const word = tokens[w];
      for (let j = 0; j < nTopics; j += 1) {
        if (topicSets[j].has(word)) counts[i][j] += 1;
      }
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Step 4: Row-normalize + pairwise L1 distance + invert to similarity
// ---------------------------------------------------------------------------

/*
 * normalizeAndL1Similarity(topicCountMatrix): ports rs_math.py:119-152
 * (normalize_and_l1_similarity).
 *
 *   1. Row-normalize (each paper becomes a topic distribution summing to
 *      1). Papers with zero keyword hits (row sum 0) get the
 *      safe_row_sums substitution (divide by 1.0 instead), leaving an
 *      all-zero row -- NOT a divide-by-zero crash.
 *   2. Pairwise L1 distance via nested loops (broadcast-equivalent).
 *   3. Invert: sim = max(dist) - dist (closer pairs score higher).
 *   4. Rescale to [0, 1] centered at 0.5, computed from the INVERTED
 *      matrix's own max/min (matches the Python's in-place reassignment
 *      of sum_matrix before computing rng/midpoint).
 *
 * Degenerate corpus (all-identical, rng === 0) returns an identity matrix,
 * NOT a divide-by-zero.
 */
function normalizeAndL1Similarity(topicCountMatrix) {
  const matrix = Array.isArray(topicCountMatrix) ? topicCountMatrix : [];
  const n = matrix.length;
  if (n === 0) return [];
  const nTopics = Array.isArray(matrix[0]) ? matrix[0].length : 0;

  const rowSums = matrix.map((row) => (row || []).reduce((a, b) => a + b, 0));
  const safeRowSums = rowSums.map((s) => (s === 0 ? 1.0 : s));
  const normalized = matrix.map((row, i) => (row || []).map((v) => v / safeRowSums[i]));

  // Pairwise L1 distance (broadcast-equivalent nested loop).
  const distMatrix = [];
  for (let i = 0; i < n; i += 1) distMatrix.push(new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let t = 0; t < nTopics; t += 1) s += Math.abs(normalized[i][t] - normalized[j][t]);
      distMatrix[i][j] = s;
    }
  }

  let distMax = -Infinity;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (distMatrix[i][j] > distMax) distMax = distMatrix[i][j];
    }
  }

  // Invert so that smaller distances become larger similarities.
  const inverted = [];
  for (let i = 0; i < n; i += 1) {
    inverted.push(new Array(n));
    for (let j = 0; j < n; j += 1) inverted[i][j] = distMax - distMatrix[i][j];
  }

  // rng/midpoint computed from the INVERTED matrix, matching Python's
  // in-place reassignment before the rescale step.
  let invMax = -Infinity;
  let invMin = Infinity;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (inverted[i][j] > invMax) invMax = inverted[i][j];
      if (inverted[i][j] < invMin) invMin = inverted[i][j];
    }
  }

  const rng = invMax - invMin;
  if (rng === 0) {
    // Degenerate corpus (all identical) -- return identity matrix so
    // absDiffTopk still produces deterministic output.
    const identity = [];
    for (let i = 0; i < n; i += 1) {
      identity.push(new Array(n).fill(0));
      identity[i][i] = 1;
    }
    return identity;
  }

  const midpoint = (invMax + invMin) / 2.0;
  const result = [];
  for (let i = 0; i < n; i += 1) {
    result.push(new Array(n));
    for (let j = 0; j < n; j += 1) {
      result[i][j] = (inverted[i][j] - midpoint) / rng + 0.5;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 5: abs-diff top-k iterative argmax with symmetric cleanup
// ---------------------------------------------------------------------------

/*
 * absDiffTopk(lsaMatrix, semanticMatrix, opts): ports rs_math.py:176-235
 * (abs_diff_topk). opts: { k = 1000, skipDiagonal = true }.
 *
 * 2026: opts.minPercentile (0..1, optional) keeps only pairs at or above that
 * quantile of this corpus's own upper-triangle |diff| distribution.
 *
 * Returns the top-k pairs by |semantic - lsa| differential, each as
 * { i, j, signedDiff, absDiff } where signedDiff = semantic[i][j] -
 * lsa[i][j] (NOT lsa - semantic -- this is Convention A's defining line).
 *
 *   - skipDiagonal=true (default) fills the diagonal with -Infinity before
 *     selection, so (i, i) never wins.
 *   - Upper-triangle-only masking (lower-triangle indices set to
 *     -Infinity) so (j, i) can never be independently selected.
 *   - Iterative argmax loop sets BOTH (i, j) and (j, i) to -Infinity after
 *     each pick (symmetric cleanup).
 *   - k is clamped to min(k, n*(n-1)/2).
 *   - The loop breaks early if the remaining max value is -Infinity or
 *     <= 0.0 (a zero or negative differential is not worth reporting).
 *
 * n < 2 returns an empty array. A shape mismatch between lsaMatrix and
 * semanticMatrix returns { ok: false, error: 'shape_mismatch', detail }
 * rather than throwing.
 */
function absDiffTopk(lsaMatrix, semanticMatrix, opts) {
  const options = opts || {};

  if (!Array.isArray(lsaMatrix) || !Array.isArray(semanticMatrix)) {
    return { ok: false, error: 'invalid_input', detail: 'lsaMatrix and semanticMatrix must be arrays' };
  }

  const n = lsaMatrix.length;
  if (semanticMatrix.length !== n) {
    return {
      ok: false,
      error: 'shape_mismatch',
      detail: `lsa rows=${n} vs semantic rows=${semanticMatrix.length}`,
    };
  }
  for (let i = 0; i < n; i += 1) {
    const lRow = lsaMatrix[i];
    const sRow = semanticMatrix[i];
    if (!Array.isArray(lRow) || !Array.isArray(sRow) || lRow.length !== n || sRow.length !== n) {
      return {
        ok: false,
        error: 'shape_mismatch',
        detail: `row ${i} is not a square n x n row matching lsa/semantic shape`,
      };
    }
  }

  if (n < 2) return [];

  const skipDiagonal = options.skipDiagonal !== false;
  const kRequested = Number.isFinite(options.k) ? Math.floor(options.k) : DEFAULT_ABS_DIFF_K;
  const maxPairs = Math.floor((n * (n - 1)) / 2);
  const k = Math.max(0, Math.min(kRequested, maxPairs));

  // 2026: selection by one sort instead of k full-matrix argmax scans
  // (O(k n^2) -> O(n^2 log n)). The result is identical to the iterative
  // argmax: pairs ordered by descending |semantic - lsa|, ties broken by
  // row-major (i, j) order, upper triangle only, value must be > 0. NaN
  // differentials are never selectable (the original skipped them in JS and
  // the Python twin let them win; both now skip them).
  const cand = [];
  const allAbs = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = skipDiagonal ? i + 1 : i; j < n; j += 1) {
      const sd = semanticMatrix[i][j] - lsaMatrix[i][j];
      const ad = Math.abs(sd);
      if (j !== i) allAbs.push(ad);
      if (ad > 0) cand.push({ i, j, signedDiff: sd, absDiff: ad });
    }
  }
  cand.sort((a, b) => (b.absDiff - a.absDiff) || (a.i - b.i) || (a.j - b.j));

  let floorValue = -Infinity;
  const minPercentile = Number.isFinite(options.minPercentile) ? options.minPercentile : null;
  if (minPercentile !== null) {
    if (minPercentile < 0 || minPercentile > 1) {
      return { ok: false, error: 'invalid_input', detail: 'minPercentile must be within [0, 1]' };
    }
    floorValue = percentileThreshold(allAbs.filter(Number.isFinite), minPercentile);
  }

  const results = [];
  for (let t = 0; t < cand.length && results.length < k; t += 1) {
    const c = cand[t];
    if (c.absDiff < floorValue) break;
    results.push({ i: c.i, j: c.j, signedDiff: c.signedDiff, absDiff: c.absDiff });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2026: corpus-relative (percentile / z-score) differential ranking
// ---------------------------------------------------------------------------
//
// A fixed cutoff such as 0.3 means different things in every corpus. These
// helpers rank a pair against the empirical distribution of all pair
// differentials in the SAME corpus. Pure, deterministic, no I/O. The Python
// twin in rs_math.py implements the same definitions (cross-checked by
// rs/_tests/core/crosscheck_math.cjs).
//
//   quantile(sortedAsc, q)         linear interpolation between order statistics
//                                  (numpy.percentile default, "linear").
//   percentileRank(sortedAsc, x)   mid-rank empirical CDF:
//                                  (count(< x) + 0.5 * count(== x)) / n, in [0, 1].
//   zScores(values)                population z-scores (ddof = 0); all zeros
//                                  when the deviation is 0 or the input is empty.

function _sortedFinite(values) {
  const out = [];
  for (let i = 0; i < values.length; i += 1) {
    if (Number.isFinite(values[i])) out.push(values[i]);
  }
  out.sort((a, b) => a - b);
  return out;
}

function quantile(sortedAsc, q) {
  const n = sortedAsc.length;
  if (n === 0 || !Number.isFinite(q)) return NaN;
  const qq = Math.min(1, Math.max(0, q));
  const idx = (n - 1) * qq;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

// percentileThreshold(values, q): quantile of an UNSORTED array (sorts a copy).
function percentileThreshold(values, q) {
  return quantile(_sortedFinite(Array.isArray(values) ? values : []), q);
}

function percentileRank(sortedAsc, x) {
  const n = sortedAsc.length;
  if (n === 0 || !Number.isFinite(x)) return NaN;
  let lo = 0;
  let hi = n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sortedAsc[m] < x) lo = m + 1; else hi = m; }
  const left = lo;
  hi = n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sortedAsc[m] <= x) lo = m + 1; else hi = m; }
  const right = lo;
  return (left + 0.5 * (right - left)) / n;
}

function zScores(values) {
  const v = Array.isArray(values) ? values : [];
  const n = v.length;
  if (n === 0) return [];
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += v[i];
  mean /= n;
  let ss = 0;
  for (let i = 0; i < n; i += 1) ss += (v[i] - mean) * (v[i] - mean);
  const sd = Math.sqrt(ss / n);
  if (!(sd > 0)) return v.map(() => 0);
  return v.map((x) => (x - mean) / sd);
}

// absDiffDistribution(lsa, semantic): sorted ascending |semantic - lsa| over the
// strict upper triangle (the population a pair is ranked against).
function absDiffDistribution(lsaMatrix, semanticMatrix) {
  const n = Array.isArray(lsaMatrix) ? lsaMatrix.length : 0;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) out.push(Math.abs(semanticMatrix[i][j] - lsaMatrix[i][j]));
  }
  return _sortedFinite(out);
}

/*
 * rankPairsByPercentile(lsa, semantic, opts): corpus-relative replacement for a
 * fixed threshold. opts: { k = 1000, minPercentile = 0.9, skipDiagonal = true }.
 * Returns pairs (same order rule as absDiffTopk) whose |diff| sits at or above
 * the minPercentile quantile of this corpus's own pair distribution, each as
 * { i, j, signedDiff, absDiff, percentile, zScore }. zScore is computed against
 * the whole upper-triangle distribution. Shape errors return the same
 * { ok:false, error, detail } envelope as absDiffTopk.
 */
function rankPairsByPercentile(lsaMatrix, semanticMatrix, opts) {
  const options = opts || {};
  const minPercentile = Number.isFinite(options.minPercentile) ? options.minPercentile : 0.9;
  const top = absDiffTopk(lsaMatrix, semanticMatrix, {
    k: options.k, skipDiagonal: options.skipDiagonal, minPercentile,
  });
  if (!Array.isArray(top)) return top;
  const dist = absDiffDistribution(lsaMatrix, semanticMatrix);
  if (dist.length === 0) return [];
  let mean = 0;
  for (let i = 0; i < dist.length; i += 1) mean += dist[i];
  mean /= dist.length;
  let ss = 0;
  for (let i = 0; i < dist.length; i += 1) ss += (dist[i] - mean) * (dist[i] - mean);
  const sd = Math.sqrt(ss / dist.length);
  return top.map((p) => ({
    i: p.i,
    j: p.j,
    signedDiff: p.signedDiff,
    absDiff: p.absDiff,
    percentile: percentileRank(dist, p.absDiff),
    zScore: sd > 0 ? (p.absDiff - mean) / sd : 0,
  }));
}

// ---------------------------------------------------------------------------
// Step 6: Direction classification (Convention A)
// ---------------------------------------------------------------------------

/*
 * classifyDirection(signedDiff): ports rs_math.py:242-252
 * (classify_direction), Convention A. Phase 355 D-03: the rule itself now
 * lives in lib/core/direction-convention.cjs (classifyDiff) -- this
 * function is a one-line delegate. Finite-input behavior is UNCHANGED:
 *
 *   signed_diff > 0  -> 'structural_transfer'
 *   signed_diff <= 0 -> 'semantic_implementation' (includes exactly 0.0)
 *
 * Do not add a third branch for the zero case -- the zero case is
 * deliberately bucketed with semantic_implementation (direction-convention.cjs
 * enforces this, not this file, any more).
 */
function classifyDirection(signedDiff) {
  return _direction().classifyDiff(signedDiff);
}

// ---------------------------------------------------------------------------
// Convenience: full LSA pipeline on raw text corpus
// ---------------------------------------------------------------------------

/*
 * buildLsaMatrix(texts, opts): ports rs_math.py:259-276 (build_lsa_matrix).
 * Single entry point lib/core/rs-engine.cjs (272-08) calls for the
 * structural/LSA leg of the reverse-salient computation.
 *
 * Tokenization is a SIMPLE whitespace split on raw text, explicitly NOT
 * pre-stripped of punctuation (topic-keyword matching must compare against
 * the SAME tokens TF-IDF saw). This is deliberately cruder than TF-IDF's
 * own internal word-boundary regex -- do not "fix" this by making
 * membership-counting use the same regex as tfidf.cjs, that would be a
 * silent behavior change.
 *
 * Returns the final similarity matrix (plain 2D array) on success, or
 * { ok: false, error, detail } if the upstream TF-IDF/SVD step fails.
 */
function buildLsaMatrix(texts, opts) {
  const options = opts || {};
  const nComponents = Number.isFinite(options.nComponents) ? options.nComponents : DEFAULT_N_COMPONENTS;
  const topK = Number.isFinite(options.topK) ? options.topK : DEFAULT_TOP_K;

  if (!Array.isArray(texts) || texts.length === 0) {
    return { ok: false, error: 'empty_corpus', detail: 'texts must be a non-empty array' };
  }

  // 2026 option lowercaseTokens (default false = verbatim original behaviour).
  // TF-IDF lowercases, so topic keywords are lowercase; with the default
  // whitespace-only split a capitalised token ("Reactor") can never match its
  // own lowercase topic keyword. Set lowercaseTokens:true to count those hits.
  const lower = options.lowercaseTokens === true;
  const tokenized = texts.map((t) => {
    const s = lower ? String(t).toLowerCase() : String(t);
    return s.split(/\s+/).filter((x) => x.length > 0);
  });

  const svdBuild = buildTfidfSvd(texts, {
    nComponents,
    maxFeatures: options.maxFeatures,
    maxDf: options.maxDf,
    stopWords: options.stopWords,
    smoothIdf: options.smoothIdf,
    svdOpts: options.svdOpts,
  });
  if (!svdBuild.ok) return svdBuild;

  const topics = extractTopicKeywords(svdBuild.components, svdBuild.vocabulary, topK);
  const counts = countTopicMembership(tokenized, topics);
  return normalizeAndL1Similarity(counts);
}

module.exports = {
  buildTfidfSvd,
  extractTopicKeywords,
  countTopicMembership,
  normalizeAndL1Similarity,
  buildLsaMatrix,
  absDiffTopk,
  classifyDirection,
  // 2026 additions (percentile mode)
  quantile,
  percentileThreshold,
  percentileRank,
  zScores,
  absDiffDistribution,
  rankPairsByPercentile,
};
