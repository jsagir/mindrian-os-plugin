/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 272-07 -- compute-hsi.py's Markov/OM-HMM spectral surface: sentence
 * thinking-mode classification, transition-matrix construction, spectral
 * gap, stationary distribution, absorbing tendency, and the composite
 * OM-HMM integrative-thinking score.
 *
 * Genuinely independent of lib/core/hsi-lsa.cjs (this same plan's other
 * file) -- no TF-IDF, no SVD, no shared state. Paired in one plan only
 * because both feed hsi-engine.cjs's single orchestration output (272-09),
 * per 272-07-PLAN.md's <objective>.
 *
 * SCOPE: small, fixed-shape dense eigen-analysis. The transition matrix is
 * always THINKING_MODES_v1.length x THINKING_MODES_v1.length (5x5 today),
 * well under 10x10 (RESEARCH.md Finding F-7). No numerical-linear-algebra
 * npm dependency was added -- same zero-new-deps discipline as 272-05's
 * hand-written SVD.
 *
 * D-02 CITATION (272-CONTEXT.md): this module has no embedding dependency
 * at all -- it is pure sentence-level regex classification plus dense
 * matrix eigen-analysis. It does not load, reference, or consume
 * Xenova/multilingual-e5-large, or any embedding model, locally or
 * remotely. There is nothing in this file for D-02 to constrain beyond
 * confirming, explicitly, that it does not apply here.
 *
 * THE 5-MODE SET (resolves RESEARCH.md Assumption A2, confirmed from
 * source, not assumed): scripts/compute-hsi.py:81-97 (_THINKING_MODES
 * dict) and :406-425 (classify_sentence_mode's own priority list) both
 * name the SAME five modes in the SAME order:
 *
 *   integrative, creative, evaluative, analytical, descriptive
 *
 * This one order serves BOTH as the vocabulary (THINKING_MODES_v1) AND as
 * the tie-break priority order in classifySentenceMode -- exactly as
 * scripts/compute-hsi.py:421-424 uses its own `priority` list for both
 * purposes. THINKING_MODES_v1 is the single source; nothing else
 * hardcodes this order a second time.
 *
 * PYTHON FUNCTIONS PORTED (scripts/compute-hsi.py, verbatim behavior):
 *   :406-425  classify_sentence_mode      -> classifySentenceMode
 *   :428-455  build_transition_matrix     -> buildTransitionMatrix
 *   :458-484  compute_spectral_gap        -> computeSpectralGap
 *   :487-514  compute_stationary_distribution -> computeStationaryDistribution
 *   :517-532  detect_absorbing_tendency   -> detectAbsorbingTendency
 *   :535-597  compute_omhmm_score         -> computeOmhmmScore
 *   :600-647  _compute_omhmm_legacy       -> computeOmhmmLegacy (ported in
 *             full -- short and self-contained, per this plan's own
 *             "port if short and self-contained" instruction; not a
 *             simplified equivalent, the real thing)
 *
 * EIGEN-ANALYSIS STRATEGY (executor's choice, documented per RESEARCH.md
 * Finding F-7 -- "power-iteration-based OR the QR algorithm on a small
 * matrix, both are short and deterministic; what must match is the OUTPUT
 * within tolerance on the fixed test fixture, not the algorithm's
 * internals"):
 *
 *   computeStationaryDistribution: power iteration on the transpose P^T
 *   (Perron-Frobenius guarantees convergence to the dominant eigenvector,
 *   which for a row-stochastic matrix's spectral radius-1 eigenvalue is
 *   exactly the eigenvalue-1 eigenvector Python's np.linalg.eig(P.T) +
 *   argmin(|eigenvalues - 1|) selects). Deterministic uniform start vector,
 *   L2-renormalized every iteration to prevent under/overflow, final
 *   sum-of-absolute-values normalization (NOT signed sum -- matches
 *   Python's np.abs(stationary) / total exactly).
 *
 *   computeSpectralGap: the transition matrix is NOT symmetric in general.
 *   2026 REVISION: the original hand-written unshifted QR iteration
 *   misread the second eigenvalue on roughly 5 percent of realistic
 *   transition matrices (eigenvalues of equal modulus never converge under
 *   an unshifted QR step); it is replaced by the characteristic polynomial
 *   (Faddeev-LeVerrier) plus Durand-Kerner root finding, which handles real
 *   and complex-conjugate eigenvalues uniformly. Checked against
 *   numpy.linalg.eigvals on 60 random 5-state matrices to 1e-15.
 *
 * Error-envelope family: never throws (PATTERNS.md convention 4). Every
 * function wraps its core computation in try/catch and degrades exactly
 * per Python's own except clauses (0.0 for spectral gap, uniform
 * distribution for stationary, per RESEARCH.md's transcription of
 * scripts/compute-hsi.py:483-484 and :512-514).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
'use strict';

// ---------- THINKING_MODES_v1 (single source: vocabulary + priority order) ----------

const THINKING_MODES_v1 = Object.freeze([
  'integrative',
  'creative',
  'evaluative',
  'analytical',
  'descriptive',
]);

// ---------- classifySentenceMode (scripts/compute-hsi.py:73-97, 406-425) ----------

// Ported verbatim from _THINKING_MODES (compute-hsi.py:81-97). Each pattern
// is word-boundary-anchored, case-insensitive, with a greedy \w* suffix,
// exactly mirroring Python's re.I \w* patterns. "what.if" in the creative
// pattern intentionally uses "." as Python's regex wildcard does (matches
// "what if", not a literal period) -- not escaped, matching the source.
// Phase 355 D-58: typo fix (anolog -> analog) in the integrative pattern.
// Pre-fix accuracy is recorded in 355-JEV-MEASUREMENT.md (regex_prefix);
// scripts/compute-hsi.py keeps the original "anolog" pattern as reference
// (D-05) -- CJS and the Python reference now diverge on the word "analog"
// by design.
const MODE_PATTERNS = {
  analytical: /\b(because|therefore|consequently|evidence|data|measure|quantif|statistic|analyz|assess|evaluat|compar)\w*\b/gi,
  integrative: /\b(connect|bridge|synthes|combin|integrat|cross|interdisciplin|convergence|fusion|hybrid|analog|metaphor|transfer)\w*\b/gi,
  descriptive: /\b(is|are|was|were|has|have|consist|compris|includ|contain|describ|defin|refer|represent)\w*\b/gi,
  evaluative: /\b(should|must|better|worse|risk|opportunit|strength|weakness|advantage|disadvantage|critical|important|significant)\w*\b/gi,
  creative: /\b(novel|innovati|reimagin|redefin|what.if|could|might|envision|transform|disrupt|pioneer|breakthrough|radical)\w*\b/gi,
};

/*
 * classifySentenceMode(sentence): the mode with the highest keyword-match
 * count, ties broken by THINKING_MODES_v1's own priority order, falling
 * back to 'descriptive' on zero matches. Ports compute-hsi.py:406-425
 * exactly.
 */
function classifySentenceMode(sentence) {
  const text = String(sentence == null ? '' : sentence);
  const scores = {};
  for (let i = 0; i < THINKING_MODES_v1.length; i += 1) {
    const mode = THINKING_MODES_v1[i];
    const matches = text.match(MODE_PATTERNS[mode]);
    scores[mode] = matches ? matches.length : 0;
  }
  let maxScore = 0;
  for (let i = 0; i < THINKING_MODES_v1.length; i += 1) {
    const s = scores[THINKING_MODES_v1[i]];
    if (s > maxScore) maxScore = s;
  }
  if (maxScore === 0) return 'descriptive';
  for (let i = 0; i < THINKING_MODES_v1.length; i += 1) {
    const mode = THINKING_MODES_v1[i];
    if (scores[mode] === maxScore) return mode;
  }
  return 'descriptive';
}

// ---------- buildTransitionMatrix (scripts/compute-hsi.py:428-455) ----------

/*
 * buildTransitionMatrix(modeSequence, modes): Laplace-smoothed (alpha=0.1)
 * row-normalized Markov transition matrix from a sequence of mode-name
 * strings. `modes` defaults to THINKING_MODES_v1 when omitted; the test
 * contract (tests/272-spectral.test.cjs) passes it explicitly as the
 * second argument, so it is accepted as a real parameter, not hardcoded.
 * Returns the plain matrix (2D array) directly -- matches the pinned test
 * contract's own binding (built[r][c]), not a {matrix, modes} wrapper.
 */
function buildTransitionMatrix(modeSequence, modes) {
  const modeList = Array.isArray(modes) && modes.length > 0 ? modes : THINKING_MODES_v1;
  const n = modeList.length;
  const modeIdx = {};
  for (let i = 0; i < n; i += 1) modeIdx[modeList[i]] = i;

  const counts = [];
  for (let i = 0; i < n; i += 1) counts.push(new Array(n).fill(0));

  const seq = Array.isArray(modeSequence) ? modeSequence : [];
  for (let k = 0; k < seq.length - 1; k += 1) {
    const i = modeIdx[seq[k]];
    const j = modeIdx[seq[k + 1]];
    if (i === undefined || j === undefined) continue;
    counts[i][j] += 1.0;
  }

  // Laplace smoothing alpha=0.1, added to EVERY cell before normalization
  // (so a mode with zero observed transitions still gets a valid,
  // non-degenerate row) -- matches compute-hsi.py:448-449 exactly.
  const alpha = 0.1;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) counts[i][j] += alpha;
  }

  const matrix = [];
  for (let i = 0; i < n; i += 1) {
    let rowSum = 0;
    for (let j = 0; j < n; j += 1) rowSum += counts[i][j];
    if (rowSum === 0) rowSum = 1.0; // safety, matches row_sums[row_sums==0]=1.0
    const row = new Array(n);
    for (let j = 0; j < n; j += 1) row[j] = counts[i][j] / rowSum;
    matrix.push(row);
  }
  return matrix;
}

// ---------- eigenvalues of a small general real matrix ----------
//
// 2026: the original used an unshifted QR iteration (500 steps) and read
// eigenvalues off the diagonal / 2x2 blocks. That never converges when two
// eigenvalues share a modulus (lambda and -lambda, or a complex pair next to a
// real value of the same size) and then reads the wrong 2x2 block. Measured
// against numpy.linalg.eigvals on 60 random smoothed 5-state transition
// matrices it was off by up to 0.28 in the spectral gap on 3 of 60 matrices.
// This version builds the characteristic polynomial (Faddeev-LeVerrier) and
// finds all roots with Durand-Kerner, which has no such failure mode for the
// n <= 10 matrices this module receives. Deterministic: fixed seeds, fixed
// iteration cap.

function charPolyCoefficients(A) {
  // returns [1, c1, ..., cn] for det(lambda I - A) = lambda^n + c1 lambda^(n-1) + ... + cn
  const n = A.length;
  const coeffs = [1];
  let M = [];
  for (let i = 0; i < n; i += 1) M.push(new Array(n).fill(0));
  for (let k = 1; k <= n; k += 1) {
    // M_k = A * M_{k-1} + c_{k-1} * I
    const next = [];
    for (let i = 0; i < n; i += 1) {
      const row = new Array(n).fill(0);
      for (let j = 0; j < n; j += 1) {
        let sum = 0;
        for (let t = 0; t < n; t += 1) sum += A[i][t] * M[t][j];
        row[j] = sum;
      }
      row[i] += coeffs[k - 1];
      next.push(row);
    }
    M = next;
    let trace = 0;
    for (let i = 0; i < n; i += 1) {
      let diag = 0;
      for (let t = 0; t < n; t += 1) diag += A[i][t] * M[t][i];
      trace += diag;
    }
    coeffs.push(-trace / k);
  }
  return coeffs;
}

const ROOT_ITERATIONS = 4000;
const ROOT_TOL = 1e-15;

function polynomialRoots(coeffs) {
  const n = coeffs.length - 1;
  if (n < 1) return [];
  let radius = 0;
  for (let k = 1; k <= n; k += 1) radius = Math.max(radius, Math.pow(Math.abs(coeffs[k]), 1 / k));
  radius = Math.max(radius, 0.5);
  const re = new Array(n);
  const im = new Array(n);
  for (let k = 0; k < n; k += 1) {
    const ang = (2 * Math.PI * k) / n + 0.4;
    re[k] = radius * 0.9 * Math.cos(ang);
    im[k] = radius * 0.9 * Math.sin(ang);
  }
  const evalPoly = (zr, zi) => {
    let pr = coeffs[0];
    let pi = 0;
    for (let k = 1; k <= n; k += 1) {
      const nr = pr * zr - pi * zi + coeffs[k];
      const ni = pr * zi + pi * zr;
      pr = nr;
      pi = ni;
    }
    return [pr, pi];
  };
  for (let iter = 0; iter < ROOT_ITERATIONS; iter += 1) {
    let maxStep = 0;
    for (let k = 0; k < n; k += 1) {
      const [pr, pi] = evalPoly(re[k], im[k]);
      let dr = 1;
      let di = 0;
      for (let m = 0; m < n; m += 1) {
        if (m === k) continue;
        const xr = re[k] - re[m];
        const xi = im[k] - im[m];
        const nr = dr * xr - di * xi;
        const ni = dr * xi + di * xr;
        dr = nr;
        di = ni;
      }
      const den = dr * dr + di * di;
      if (den < 1e-300) continue;
      const stepR = (pr * dr + pi * di) / den;
      const stepI = (pi * dr - pr * di) / den;
      re[k] -= stepR;
      im[k] -= stepI;
      maxStep = Math.max(maxStep, Math.abs(stepR) + Math.abs(stepI));
    }
    if (maxStep < ROOT_TOL) break;
  }
  const out = [];
  for (let k = 0; k < n; k += 1) out.push({ re: re[k], im: im[k] });
  return out;
}

// ---------- computeSpectralGap (scripts/compute-hsi.py:458-484) ----------

/*
 * computeSpectralGap(transitionMatrix): 1.0 - |lambda_2|, where lambda_2 is
 * the second-largest eigenvalue by magnitude, clamped to [0, 1]. Returns
 * 0.0 on fewer than 2 eigenvalues or any computation failure -- matches
 * Python's except (LinAlgError, ValueError): return 0.0 exactly.
 */
function computeSpectralGap(transitionMatrix) {
  try {
    if (!Array.isArray(transitionMatrix) || transitionMatrix.length === 0) return 0.0;
    const n = transitionMatrix.length;
    if (n < 2) return 0.0;

    const eigenvalues = polynomialRoots(charPolyCoefficients(transitionMatrix));
    const magnitudes = eigenvalues
      .map((e) => Math.sqrt(e.re * e.re + e.im * e.im))
      .sort((x, y) => y - x);

    if (magnitudes.length < 2) return 0.0;

    const gap = 1.0 - magnitudes[1];
    return Math.max(0.0, Math.min(1.0, gap));
  } catch (_err) {
    return 0.0;
  }
}

// ---------- computeStationaryDistribution (scripts/compute-hsi.py:487-514) ----------

const POWER_ITERATIONS = 400;

/*
 * computeStationaryDistribution(transitionMatrix): the dominant
 * left-eigenvector of P, computed via power iteration on P^T
 * (Perron-Frobenius guarantees convergence for a valid row-stochastic
 * matrix's spectral-radius-1 eigenvalue). Real part is taken (power
 * iteration on a real matrix stays real; the abs()-normalization below
 * absorbs any residual sign ambiguity, matching Python's own
 * np.real(...) + np.abs(...)/total pipeline). Normalized by
 * sum-of-absolute-values (NOT signed sum). Uniform-distribution fallback
 * on any failure, matching Python's except clause exactly.
 */
function computeStationaryDistribution(transitionMatrix) {
  const n = Array.isArray(transitionMatrix) ? transitionMatrix.length : 0;
  if (n === 0) return [];
  try {
    let v = new Array(n).fill(1 / n);
    for (let iter = 0; iter < POWER_ITERATIONS; iter += 1) {
      const next = new Array(n).fill(0);
      // (P^T * v)[i] = sum_j P[j][i] * v[j]
      for (let i = 0; i < n; i += 1) {
        let sum = 0;
        for (let j = 0; j < n; j += 1) sum += transitionMatrix[j][i] * v[j];
        next[i] = sum;
      }
      let normSq = 0;
      for (let i = 0; i < n; i += 1) normSq += next[i] * next[i];
      const norm = Math.sqrt(normSq);
      if (norm < 1e-300) {
        v = next;
        break;
      }
      for (let i = 0; i < n; i += 1) v[i] = next[i] / norm;
    }

    let total = 0;
    for (let i = 0; i < n; i += 1) total += Math.abs(v[i]);
    if (total > 0) {
      return v.map((x) => Math.abs(x) / total);
    }
    return new Array(n).fill(1 / n);
  } catch (_err) {
    return new Array(n).fill(1 / n);
  }
}

// ---------- detectAbsorbingTendency (scripts/compute-hsi.py:517-532) ----------

/*
 * detectAbsorbingTendency(transitionMatrix, modes): diagonal excess over
 * the uniform baseline (1/modes.length), averaged and rescaled by
 * 1/(1-baseline), clamped to [0, 1]. Ports compute-hsi.py:517-532 exactly.
 */
function detectAbsorbingTendency(transitionMatrix, modes) {
  const modeList = Array.isArray(modes) && modes.length > 0 ? modes : THINKING_MODES_v1;
  const n = modeList.length;
  if (n === 0 || !Array.isArray(transitionMatrix) || transitionMatrix.length === 0) return 0.0;
  const baseline = 1.0 / n;

  let sumExcess = 0;
  for (let i = 0; i < n; i += 1) {
    const diagVal = transitionMatrix[i] ? transitionMatrix[i][i] : 0;
    const excess = Math.max(diagVal - baseline, 0);
    sumExcess += excess;
  }
  const mean = sumExcess / n;
  const absorbingScore = baseline < 1.0 ? mean / (1.0 - baseline) : 0.0;
  return Math.max(0.0, Math.min(1.0, absorbingScore));
}

// ---------- computeOmhmmScore / computeOmhmmLegacy (compute-hsi.py:535-647) ----------

// Ported verbatim from _INTEGRATIVE_KEYWORDS (compute-hsi.py:73-77).
const INTEGRATIVE_KEYWORDS = new Set([
  'cross-domain', 'synthesis', 'combine', 'bridge', 'transfer',
  'connect', 'integrate', 'hybrid', 'convergence', 'interdisciplinary',
  'analogy', 'metaphor', 'parallel', 'intersection', 'fusion',
]);

// Ported verbatim from _FEATURE_PATTERNS (compute-hsi.py:100-109).
const FEATURE_PATTERNS = [
  [/\bsimple\b|\bstraightforward\b|\bbasic\b/i, 'simple'],
  [/\bcomplex\b|\bcomplicated\b|\bintricate\b/i, 'complex'],
  [/\blinear\b|\bsequential\b|\bstep.by.step\b/i, 'linear'],
  [/\bmulti\w*\b|\bparallel\b|\bsimultaneous\b/i, 'multidirectional'],
  [/\bpart\b|\bcomponent\b|\bpiece\b|\bfragment\b/i, 'part'],
  [/\bholistic\b|\bwhole\b|\bsystem\b|\bentire\b/i, 'holistic'],
  [/\btrade.?off\b|\bcompromise\b|\bbalance\b/i, 'tradeoff'],
  [/\bcreative\b|\bnovel\b|\binnovati\w+\b|\boriginal\b/i, 'creative'],
];

/*
 * computeOmhmmLegacy(text): ported in full from _compute_omhmm_legacy
 * (compute-hsi.py:600-647) -- short and self-contained, so this is the
 * real algorithm, not a documented simplification. Used as the fallback
 * for texts with fewer than 5 qualifying sentences.
 */
function computeOmhmmLegacy(text) {
  const original = String(text == null ? '' : text);
  const textLower = original.toLowerCase();
  const words = textLower.split(/\s+/).filter(Boolean);
  const totalWords = Math.max(words.length, 1);

  const featuresFound = new Set();
  for (let i = 0; i < FEATURE_PATTERNS.length; i += 1) {
    const pattern = FEATURE_PATTERNS[i][0];
    const label = FEATURE_PATTERNS[i][1];
    if (pattern.test(textLower)) featuresFound.add(label);
  }
  const featureDiversity = featuresFound.size;

  const rawSentences = original.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  let complexityRatio = 0.0;
  if (rawSentences.length > 1) {
    const lengths = rawSentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (meanLen > 0) {
      let variance = 0;
      for (let i = 0; i < lengths.length; i += 1) variance += (lengths[i] - meanLen) * (lengths[i] - meanLen);
      variance /= lengths.length;
      complexityRatio = Math.sqrt(variance) / meanLen;
    }
  }

  let integrativeCount = 0;
  for (let i = 0; i < words.length; i += 1) {
    const stripped = words[i].replace(/^[.,;:!?]+/, '').replace(/[.,;:!?]+$/, '');
    if (INTEGRATIVE_KEYWORDS.has(stripped)) integrativeCount += 1;
  }
  const likelihoodRatio = integrativeCount / totalWords;

  const score =
    0.5 * likelihoodRatio * 100 +
    0.3 * (featureDiversity / 8) * 100 +
    0.2 * Math.min(complexityRatio * 50, 100);

  return Math.max(0.0, Math.min(100.0, score));
}

/*
 * computeOmhmmScore(text): the composite (0-100) integrative-thinking
 * score. Splits on sentence terminators, filters to length > 10 after
 * trim, falls back to computeOmhmmLegacy on fewer than 5 sentences.
 * Weights and entropy formula ported verbatim from
 * scripts/compute-hsi.py:576-597 (grepped from source, not invented):
 *   spectral_gap * 0.40 + integrative_stationary_weight * 0.25 * n_modes
 *   + mode_diversity_entropy * 0.20 + (1 - absorbing_score) * 0.15
 * (all terms scaled to a 0-100 composite; the integrative term is scaled
 * by len(modes) in the Python original, preserved here exactly, not
 * "fixed" to omit that factor).
 */
function computeOmhmmScore(text) {
  try {
    const original = String(text == null ? '' : text);
    const sentences = original
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length < 5) {
      return computeOmhmmLegacy(original);
    }

    const modes = THINKING_MODES_v1;
    const modeSequence = sentences.map((s) => classifySentenceMode(s));
    const transitionMatrix = buildTransitionMatrix(modeSequence, modes);

    const spectralGap = computeSpectralGap(transitionMatrix);
    const stationary = computeStationaryDistribution(transitionMatrix);

    const integrativeIdx = modes.indexOf('integrative');
    const integrativeWeight = integrativeIdx >= 0 ? stationary[integrativeIdx] : 0;

    let entropy = 0.0;
    for (let i = 0; i < stationary.length; i += 1) {
      const p = stationary[i];
      if (p > 1e-10) entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(modes.length);
    const modeDiversity = maxEntropy > 0 ? entropy / maxEntropy : 0.0;

    const absorbing = detectAbsorbingTendency(transitionMatrix, modes);
    const antiAbsorption = 1.0 - absorbing;

    const score =
      0.4 * spectralGap * 100 +
      0.25 * integrativeWeight * 100 * modes.length +
      0.2 * modeDiversity * 100 +
      0.15 * antiAbsorption * 100;

    return Math.max(0.0, Math.min(100.0, score));
  } catch (_err) {
    // Never throw across the module boundary. Degrade to the legacy path,
    // matching the spirit of Python's own short-text fallback rather than
    // propagating a raw exception.
    return computeOmhmmLegacy(text);
  }
}

module.exports = {
  THINKING_MODES_v1: THINKING_MODES_v1,
  classifySentenceMode: classifySentenceMode,
  buildTransitionMatrix: buildTransitionMatrix,
  computeSpectralGap: computeSpectralGap,
  computeStationaryDistribution: computeStationaryDistribution,
  detectAbsorbingTendency: detectAbsorbingTendency,
  computeOmhmmScore: computeOmhmmScore,
  computeOmhmmLegacy: computeOmhmmLegacy,
};
