/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * 2026 REVISION NOTE. computeLsaSimilarity / classifyDirectionB are unchanged
 * in behaviour (LSA path kept) except that non-finite cosines clip to 0. New,
 * additive exports at the bottom: computeLsaSimilarityDetailed (says why it
 * degraded to identity), computeBm25Similarity, computeHybridLexicalSimilarity
 * (mean of LSA and BM25), empiricalPercentile and zscores (corpus-relative
 * ranking). The no-embedding-model rule below still holds: dense signals
 * come from the caller (hsi-engine.cjs), never from this file.
 *
 * Phase 272-07 -- compute-hsi.py's Convention B LSA similarity
 * (compute_lsa_similarity, cosine-on-the-SVD-reduced-matrix).
 *
 * THIS IS A DIFFERENT SIMILARITY ALGORITHM FROM lib/core/rs-math.cjs
 * (272-06), even though both are colloquially called "LSA" and both build
 * TF-IDF + a truncated SVD. rs-math.cjs extracts per-component top-7 topic
 * keywords and counts topic-keyword membership. THIS module instead runs
 * cosine similarity directly on the SVD-reduced matrix. They MUST NOT share
 * one SIMILARITY ALGORITHM implementation (RESEARCH.md Finding F-3/F-6,
 * PATTERNS.md convention 8) -- that separation is UNCHANGED. The two
 * modules are built in separate plans (272-06, 272-07), in the same wave,
 * deliberately kept in separate executor contexts, by design (see
 * 272-07-PLAN.md's <objective>) -- Pitfall 3 from RESEARCH.md is the exact
 * failure this separation defends against.
 *
 * Phase 355 D-03 RE-SCOPE: the label RULE (what the two similarity numbers
 * mean, "Convention B" as this file used to call it) is retired as a
 * SEPARATE rule -- classifyDirectionB below now delegates to lib/core/
 * direction-convention.cjs's classify(), the same module rs-math.cjs's
 * classifyDirection now delegates to. Only the ALGORITHM warning above
 * still holds; the label rule was never algorithmic and is now
 * deliberately unified at one module.
 *
 * PYTHON BEING PORTED (scripts/compute-hsi.py:324-348, compute_lsa_similarity;
 * classification inline at scripts/compute-hsi.py:748-751):
 *
 *   def compute_lsa_similarity(texts):
 *       n = len(texts)
 *       vectorizer = TfidfVectorizer(stop_words='english', max_features=500)
 *       try:
 *           tfidf_matrix = vectorizer.fit_transform(texts)
 *       except ValueError:
 *           return np.eye(n)
 *       n_components = min(80, n - 1, tfidf_matrix.shape[1])
 *       if n_components < 1:
 *           return np.eye(n)
 *       svd = TruncatedSVD(n_components=n_components)   # UNSEEDED
 *       reduced = svd.fit_transform(tfidf_matrix)
 *       sim_matrix = cosine_similarity(reduced)
 *       return np.clip(sim_matrix, 0.0, 1.0)
 *
 *   if lsa_sim > sem_sim:
 *       surprise_type = 'structural_transfer'
 *   else:
 *       surprise_type = 'semantic_implementation'
 *
 * PARAMETERS (this file's OWN defaults, distinct from rs-math.cjs's
 * max_features=2000, max_df=0.5 -- RESEARCH.md Finding F-6's table):
 *   maxFeatures: defaults to 500 (compute-hsi.py:331, "lighter than V2's
 *     2000 -- room artifacts are smaller"). Explicit per call, never
 *     hardcoded silently to rs-math.cjs's value.
 *   maxDf: explicit 1.0 (sklearn's true default -- compute-hsi.py never
 *     passes max_df at all, so it is NOT 0.5, which is rs-math.cjs's own
 *     caller-side value only).
 *   SVD: UNSEEDED, matching Python exactly. RESEARCH.md Finding F-6
 *     measured live: 5 runs of this unseeded SVD had max abs difference
 *     1.9e-15 (numerically stable) but the FULL pair ordering differed on
 *     every run. This module's own output is therefore legitimately
 *     non-reproducible run-to-run at the full-ordering level. Per
 *     RESEARCH.md Pitfall 4: do not write (or let a caller write) an
 *     acceptance test asserting exact output equality against this
 *     module's output across two calls -- only top-K rank agreement, per
 *     the phase-wide D-03 gate design.
 *
 * D-02 CITATION (272-CONTEXT.md): this module does NOT load, reference, or
 * consume Xenova/multilingual-e5-large, or any embedding model at all. It
 * is pure TF-IDF + SVD + cosine, operating entirely on lexical term-weight
 * vectors -- there is no encoder call anywhere in this file. The Python
 * function this module replaces sits ALONGSIDE, not inside,
 * compute_semantic_similarity_tier1 (compute-hsi.py:350-361, the local
 * MiniLM encoder call) -- that function is a SEPARATE concern, out of this
 * plan's scope, and belongs to hsi-engine.cjs's orchestration (272-09),
 * which is expected to consume embedding-spine.cjs directly per D-01. If a
 * future caller of computeLsaSimilarity ever needs a semantic-embedding
 * input, it must be passed in as a parameter/interface by that caller --
 * this module itself never loads or references e5-large or any other
 * embedding model, locally or remotely.
 *
 * COMPOSITION (Canon Part 7, reuse before build -- this file builds
 * nothing numerically new):
 *   - lib/core/numeric/tfidf.cjs::fitTfidf -- sklearn TfidfVectorizer
 *     parity vectorizer (272-05), shared with rs-math.cjs, parametrized
 *     per-caller (never hardcodes either caller's maxFeatures/maxDf).
 *   - lib/core/numeric/svd.cjs::truncatedSvdWithSignFlip -- deterministic
 *     truncated SVD with sklearn's svd_flip sign convention (272-05),
 *     shared with rs-math.cjs. The reduced-matrix projection this file
 *     needs (sklearn's TruncatedSVD.fit_transform semantics: reduced =
 *     X @ V^T = X @ components_.T) is algebraically identical to
 *     U @ diag(singularValues), since X = U S V^T and V^T V = I on the
 *     orthonormal component subspace svd.cjs returns -- so this module
 *     multiplies leftSingularVectors by singularValues directly rather
 *     than re-doing the X @ components^T matrix multiply a second time;
 *     svd.cjs's own header documents this exact pairing
 *     ("leftSingularVectors * diag(singularValues) * components
 *     approximates matrix").
 *   - lib/core/rs-pinecone-bridge.cjs::cosineSimilarity -- the SAME
 *     function object rs-differential-scorer.cjs already uses for its
 *     BERT-leg cosine, reused here per-pair to build the full pairwise
 *     matrix (cosineSimilarityMatrix below is a thin loop over that one
 *     primitive, not a second cosine implementation).
 *
 * Error-envelope family: this module never throws (PATTERNS.md convention
 * 4). computeLsaSimilarity returns a plain n x n array directly (matching
 * both numeric/tfidf.cjs's and numeric/svd.cjs's own "unwrapped happy
 * path" convention, and the exact shape
 * tests/272-hsi-lsa-algorithm.test.cjs binds to) -- there is no {ok,...}
 * wrapper on the matrix itself. classifyDirectionB is a pure sign-check
 * primitive with no envelope at all, matching rs-math.cjs's
 * classifyDirection sibling shape.
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
'use strict';

const { fitTfidf } = require('./numeric/tfidf.cjs');
const { truncatedSvdWithSignFlip } = require('./numeric/svd.cjs');
const { cosineSimilarity } = require('./rs-pinecone-bridge.cjs');
const { classify } = require('./direction-convention.cjs');

// ---------- classifyDirectionB (retired, Phase 355 D-03) ----------

/*
 * classifyDirectionB(lsaSim, semSim): Convention B is RETIRED (Phase 355
 * D-03). This name is kept ONLY so existing importers (lib/core/hsi-engine.cjs's
 * former call site, any external caller) do not break on a missing export;
 * the function no longer computes its own opposite-sign bucketing. It now
 * delegates straight to lib/core/direction-convention.cjs's classify(lsa,
 * semantic), the SAME rule rs-math.cjs's classifyDirection now delegates to,
 * so hsi-lsa's reported direction matches rs-math's on the same numbers.
 *
 * The SIMILARITY ALGORITHM in this file (computeLsaSimilarity, cosine on
 * the SVD-reduced matrix) is UNCHANGED and stays a genuinely separate
 * computation from rs-math.cjs's topic-keyword-membership algorithm -- the
 * MUST-NOT-unify warning below is about the two SIMILARITY ALGORITHMS, not
 * the label rule (which is now deliberately unified, by design, at the
 * single lib/core/direction-convention.cjs module).
 */
function classifyDirectionB(lsaSim, semSim) {
  return classify(lsaSim, semSim);
}

// ---------- small local helpers (no second cosine implementation) ----------

function identityMatrix(n) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const row = new Array(n).fill(0);
    row[i] = 1;
    out.push(row);
  }
  return out;
}

// Thin loop over rs-pinecone-bridge.cjs::cosineSimilarity -- the SAME
// dot-product/norm math, not a second implementation (Canon Part 7).
function cosineSimilarityMatrix(rows) {
  const n = rows.length;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      const sim = i === j ? cosineSimilarity(rows[i], rows[i]) : cosineSimilarity(rows[i], rows[j]);
      out[i][j] = sim;
      out[j][i] = sim;
    }
  }
  return out;
}

function clip01InPlace(matrix) {
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i];
    for (let j = 0; j < row.length; j += 1) {
      // 2026: NaN and +-Infinity (a zero-norm row through the cosine primitive)
      // used to pass straight through the two comparisons below and poison
      // every downstream score; they now clip to 0.
      if (!Number.isFinite(row[j])) row[j] = 0;
      else if (row[j] < 0) row[j] = 0;
      else if (row[j] > 1) row[j] = 1;
    }
  }
  return matrix;
}

// ---------- computeLsaSimilarity (the ported pipeline) ----------

/*
 * computeLsaSimilarity(texts, opts): Convention B, cosine-on-SVD.
 *
 * opts.maxFeatures defaults to 500 -- this file's OWN default, distinct
 * from rs-math.cjs's 2000 (RESEARCH.md Finding F-6). Explicit, never
 * silently inherited from a sibling module.
 *
 * Degenerate-input degradation matches Python's own behavior exactly
 * (compute-hsi.py:335-341): an empty-vocabulary corpus, or a corpus whose
 * clamped n_components falls below 1, returns an n x n IDENTITY matrix,
 * never a thrown error and never a structured error envelope -- downstream
 * (hsi-engine.cjs, 272-09) expects this call to always return a valid
 * similarity matrix. This differs deliberately from other modules in this
 * phase that use {ok,error,detail} envelopes; that asymmetry is
 * intentional, preserving Python's own degradation, not an inconsistency.
 */
function computeLsaSimilarity(texts, opts) {
  const options = opts || {};
  // this file's own default (500), distinct from rs-math.cjs's maxFeatures
  // default of 2000 -- never share this value with rs-math.cjs
  const maxFeatures = Number.isFinite(options.maxFeatures) ? options.maxFeatures : 500;

  const n = Array.isArray(texts) ? texts.length : 0;
  if (n === 0) return [];

  try {
    // Explicit maxDf: 1.0 -- sklearn's TRUE default (compute-hsi.py never
    // passes max_df at all). Never 0.5; that is rs-math.cjs's own value.
    const tfidfResult = fitTfidf(texts, {
      maxFeatures: maxFeatures,
      stopWords: 'english',
      maxDf: 1.0,
    });

    const vocabSize = Array.isArray(tfidfResult.vocabulary) ? tfidfResult.vocabulary.length : 0;

    // n_components = min(80, n - 1, tfidf_matrix.shape[1]) -- the exact,
    // subtly different clamp from rs_math.py's build_tfidf_svd (no
    // max(1, ...) floor, no separate n_terms - 1). Ported as-is, not
    // harmonized with rs-math.cjs's clamp.
    const nComponents = Math.min(80, n - 1, vocabSize);
    if (nComponents < 1) return identityMatrix(n);

    // UNSEEDED -- no opts.randomState / seed argument passed at all,
    // visibly distinct from rs-math.cjs's seeded call site.
    const svdResult = truncatedSvdWithSignFlip(tfidfResult.weights, nComponents);
    if (!svdResult || !svdResult.ok || !svdResult.singularValues || svdResult.singularValues.length === 0) {
      return identityMatrix(n);
    }

    // reduced = X @ V^T = U @ diag(S) (sklearn TruncatedSVD.transform's own
    // semantics -- see the COMPOSITION note above for the derivation).
    const singularValues = svdResult.singularValues;
    const reduced = svdResult.leftSingularVectors.map((row) =>
      row.map((v, j) => v * singularValues[j])
    );

    const simMatrix = cosineSimilarityMatrix(reduced);
    return clip01InPlace(simMatrix);
  } catch (_err) {
    // Never throw across the module boundary (PATTERNS.md convention 4).
    // Python's own except ValueError: return np.eye(n) covers the
    // empty-vocabulary case explicitly above; this catch is the defensive
    // backstop for anything else, degrading to the same identity fallback.
    return identityMatrix(n);
  }
}

// ---------- 2026 additions: degradation visibility, BM25, hybrid lexical, percentiles ----------

/*
 * computeLsaSimilarityDetailed(texts, opts) -> { matrix, degraded, reason }.
 * Same pipeline as computeLsaSimilarity, but says WHY an identity matrix was
 * returned instead of hiding it (the original catch-all turned any internal
 * failure, including a missing numeric module, into "no similarity at all"
 * without a trace). computeLsaSimilarity itself is unchanged for callers.
 */
function computeLsaSimilarityDetailed(texts, opts) {
  const n = Array.isArray(texts) ? texts.length : 0;
  if (n === 0) return { matrix: [], degraded: false, reason: null };
  const options = opts || {};
  const maxFeatures = Number.isFinite(options.maxFeatures) ? options.maxFeatures : 500;
  try {
    const tfidfResult = fitTfidf(texts, { maxFeatures: maxFeatures, stopWords: 'english', maxDf: 1.0 });
    const vocabSize = Array.isArray(tfidfResult.vocabulary) ? tfidfResult.vocabulary.length : 0;
    if (vocabSize === 0) return { matrix: identityMatrix(n), degraded: true, reason: 'empty_vocabulary' };
    const nComponents = Math.min(80, n - 1, vocabSize);
    if (nComponents < 1) return { matrix: identityMatrix(n), degraded: true, reason: 'too_few_documents' };
    const svdResult = truncatedSvdWithSignFlip(tfidfResult.weights, nComponents);
    if (!svdResult || !svdResult.ok || !svdResult.singularValues || svdResult.singularValues.length === 0) {
      return { matrix: identityMatrix(n), degraded: true, reason: 'svd_failed' };
    }
    const sv = svdResult.singularValues;
    const reduced = svdResult.leftSingularVectors.map((row) => row.map((v, j) => v * sv[j]));
    return { matrix: clip01InPlace(cosineSimilarityMatrix(reduced)), degraded: false, reason: null };
  } catch (err) {
    return { matrix: identityMatrix(n), degraded: true, reason: 'exception: ' + (err && err.message ? err.message : String(err)) };
  }
}

const FALLBACK_STOPWORDS = new Set((
  'a about above after again all also am an and any are as at be because been before being below between both but by ' +
  'can could did do does doing down during each few for from further had has have having he her here hers herself him ' +
  'himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other ' +
  'our ours ourselves out over own same she should so some such than that the their theirs them themselves then there ' +
  'these they this those through to too under until up very was we were what when where which while who whom why will ' +
  'with would you your yours yourself yourselves'
).split(' '));

function tokenizeLexical(text) {
  const raw = String(text == null ? '' : text).toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || [];
  return raw.filter((t) => !FALLBACK_STOPWORDS.has(t));
}

/*
 * computeBm25Similarity(texts, opts): symmetric BM25 document similarity in
 * [0, 1]. S[i][j] = BM25 score of document i used as the query against
 * document j, divided by the self-score S[i][i], then averaged with its
 * transpose. Same definition as scripts/compute-hsi.py::compute_bm25_similarity.
 * Never throws; an empty vocabulary or a single document returns identity.
 */
function computeBm25Similarity(texts, opts) {
  const n = Array.isArray(texts) ? texts.length : 0;
  if (n === 0) return [];
  const o = opts || {};
  const k1 = Number.isFinite(o.k1) ? o.k1 : 1.5;
  const b = Number.isFinite(o.b) ? o.b : 0.75;
  if (n < 2) return identityMatrix(n);

  const docs = texts.map((t) => {
    const counts = new Map();
    let len = 0;
    for (const tok of tokenizeLexical(t)) {
      counts.set(tok, (counts.get(tok) || 0) + 1);
      len += 1;
    }
    return { counts: counts, len: len };
  });
  const df = new Map();
  docs.forEach((d) => d.counts.forEach((_c, term) => df.set(term, (df.get(term) || 0) + 1)));
  if (df.size === 0) return identityMatrix(n);
  const avgdl = docs.reduce((a, d) => a + d.len, 0) / n || 1;
  const idf = (term) => Math.log(1 + (n - df.get(term) + 0.5) / (df.get(term) + 0.5));

  function score(q, d) {
    const norm = (1 - b) + b * (d.len / avgdl);
    let total = 0;
    q.counts.forEach((_c, term) => {
      const tf = d.counts.get(term);
      if (tf) total += idf(term) * ((tf * (k1 + 1)) / (tf + k1 * norm + 1e-12));
    });
    return total;
  }

  const raw = [];
  for (let i = 0; i < n; i += 1) {
    const row = new Array(n).fill(0);
    for (let j = 0; j < n; j += 1) row[j] = score(docs[i], docs[j]);
    raw.push(row);
  }
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    const si = raw[i][i] > 1e-12 ? raw[i][i] : 1;
    for (let j = i; j < n; j += 1) {
      const sj = raw[j][j] > 1e-12 ? raw[j][j] : 1;
      const v = 0.5 * (raw[i][j] / si + raw[j][i] / sj);
      out[i][j] = v;
      out[j][i] = v;
    }
    out[i][i] = 1;
  }
  return clip01InPlace(out);
}

/*
 * computeHybridLexicalSimilarity(texts, opts) -> { lsa, bm25, hybrid, degraded, reason }.
 * hybrid = mean(LSA, BM25). The LSA path stays available on its own
 * (computeLsaSimilarity); this is the lexical leg the 2026 engine pairs with
 * the dense embedding leg.
 */
function computeHybridLexicalSimilarity(texts, opts) {
  const lsaDetail = computeLsaSimilarityDetailed(texts, opts);
  const bm25 = computeBm25Similarity(texts, opts);
  const n = lsaDetail.matrix.length;
  const hybrid = [];
  for (let i = 0; i < n; i += 1) {
    const row = new Array(n);
    for (let j = 0; j < n; j += 1) row[j] = 0.5 * (lsaDetail.matrix[i][j] + bm25[i][j]);
    hybrid.push(row);
  }
  return { lsa: lsaDetail.matrix, bm25: bm25, hybrid: hybrid, degraded: lsaDetail.degraded, reason: lsaDetail.reason };
}

/*
 * empiricalPercentile(values) -> number[] in [0, 1]; ties share their average
 * rank; one value maps to 1; empty to []. zscores(values): zeros when the
 * spread is zero. Both match the Python helpers of the same name.
 */
function empiricalPercentile(values) {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  const idx = values.map((_v, i) => i).sort((x, y) => (values[x] - values[y]) || (x - y));
  const out = new Array(n);
  let start = 0;
  while (start < n) {
    let end = start;
    while (end + 1 < n && values[idx[end + 1]] === values[idx[start]]) end += 1;
    const avgRank = (start + end) / 2;
    for (let k = start; k <= end; k += 1) out[idx[k]] = avgRank / (n - 1);
    start = end + 1;
  }
  return out;
}

function zscores(values) {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, v) => a + v, 0) / n;
  const variance = values.reduce((a, v) => a + (v - mean) * (v - mean), 0) / n;
  const sd = Math.sqrt(variance);
  if (!Number.isFinite(sd) || sd < 1e-12) return new Array(n).fill(0);
  return values.map((v) => (v - mean) / sd);
}

module.exports = {
  computeLsaSimilarity,
  classifyDirectionB,
  computeLsaSimilarityDetailed,
  computeBm25Similarity,
  computeHybridLexicalSimilarity,
  empiricalPercentile,
  zscores,
};
