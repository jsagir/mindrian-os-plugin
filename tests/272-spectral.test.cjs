/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 272 Wave 0 -- pins compute-hsi.py's Markov spectral surface against
 * live numpy ground truth, RED by design.
 *
 * PYPORT-03. Ports scripts/compute-hsi.py:428-533 (build_transition_matrix,
 * compute_spectral_gap, compute_stationary_distribution,
 * detect_absorbing_tendency) faithfully. Gates lib/core/hsi-spectral.cjs
 * (272-07), which does not exist yet.
 *
 * The 5-mode set (integrative, creative, evaluative, analytical, descriptive)
 * is confirmed via scripts/compute-hsi.py:406-425 (classify_sentence_mode's
 * priority list) and scripts/compute-hsi.py:81-97 (_THINKING_MODES) --
 * resolves RESEARCH.md Assumption A2. Fixed 5x5 transition matrix chosen
 * with mode index 3 (analytical)'s self-loop probability forced above 0.6,
 * per detect_absorbing_tendency's own docstring threshold.
 *
 * Ground truth computed live this session via numpy:
 *   np.linalg.eigvals(P) for the spectral gap
 *   np.linalg.eig(P.T), nearest eigenvalue to 1, abs()-normalized, for the
 *     stationary distribution (compute-hsi.py:497-511)
 *   the Laplace-smoothed (alpha=0.1) transition-matrix-from-sequence
 *     construction (compute-hsi.py:428-455)
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HSI_SPECTRAL_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'hsi-spectral.cjs');

let hsiSpectralModule;
try {
  // eslint-disable-next-line global-require
  hsiSpectralModule = require(HSI_SPECTRAL_MODULE_PATH);
} catch (_e) {
  hsiSpectralModule = null;
}

const TOL = 1e-6;

// The 5 thinking modes, in classify_sentence_mode's own priority order
// (compute-hsi.py:421): integrative > creative > evaluative > analytical >
// descriptive.
const MODES = ['integrative', 'creative', 'evaluative', 'analytical', 'descriptive'];

// Fixed 5x5 row-stochastic transition matrix. Row index 3 ('analytical')'s
// self-loop (P[3][3] = 0.65) is forced above the 0.6 absorbing-tendency
// threshold named in compute-hsi.py:520-521's docstring.
const P = [
  [0.10, 0.30, 0.20, 0.20, 0.20],
  [0.25, 0.15, 0.20, 0.20, 0.20],
  [0.20, 0.20, 0.15, 0.25, 0.20],
  [0.10, 0.10, 0.10, 0.65, 0.05],
  [0.20, 0.20, 0.20, 0.20, 0.20],
];

// Ground truth: np.linalg.eigvals(P), sorted by magnitude descending, then
// spectral_gap = 1 - magnitudes[1], clamped to [0, 1]. Computed live this
// session.
const EXPECTED_SPECTRAL_GAP = 0.5602084238343643;

// Ground truth: np.linalg.eig(P.T), nearest eigenvalue to 1, abs()-normalized
// to sum to 1, in MODES order. Computed live this session.
const EXPECTED_STATIONARY = [
  0.1551782049, 0.1692853144, 0.1545064378, 0.3776824034, 0.1433476395,
];

// Ground truth: detect_absorbing_tendency(P, MODES) -- diagonal excess over
// the uniform baseline (1/5 = 0.2), averaged and rescaled. Computed live
// this session.
const EXPECTED_ABSORBING_SCORE = 0.11249999999999999;

// Ground truth: build_transition_matrix applied to this mode sequence, with
// Laplace smoothing alpha=0.1. Computed live this session.
const MODE_SEQUENCE = [
  'integrative', 'creative', 'integrative', 'analytical', 'analytical',
  'analytical', 'descriptive', 'integrative',
];
const EXPECTED_BUILT_MATRIX = [
  [0.04, 0.44, 0.04, 0.44, 0.04],
  [0.7333333333333333, 0.06666666666666667, 0.06666666666666667, 0.06666666666666667, 0.06666666666666667],
  [0.2, 0.2, 0.2, 0.2, 0.2],
  [0.02857142857142857, 0.02857142857142857, 0.02857142857142857, 0.6, 0.3142857142857143],
  [0.7333333333333333, 0.06666666666666667, 0.06666666666666667, 0.06666666666666667, 0.06666666666666667],
];

async function main() {
  assert.ok(
    hsiSpectralModule !== null,
    'lib/core/hsi-spectral.cjs does not exist yet (expected until plan 272-07 lands) -- ' +
      'this test is RED by design for Phase 272 Wave 0'
  );
  assert.ok(
    typeof hsiSpectralModule.computeSpectralGap === 'function' &&
      typeof hsiSpectralModule.computeStationaryDistribution === 'function' &&
      typeof hsiSpectralModule.detectAbsorbingTendency === 'function' &&
      typeof hsiSpectralModule.buildTransitionMatrix === 'function',
    'lib/core/hsi-spectral.cjs MUST export computeSpectralGap, ' +
      'computeStationaryDistribution, detectAbsorbingTendency, buildTransitionMatrix'
  );

  const gap = hsiSpectralModule.computeSpectralGap(P);
  assert.ok(
    Math.abs(gap - EXPECTED_SPECTRAL_GAP) < TOL,
    `computeSpectralGap: expected ${EXPECTED_SPECTRAL_GAP}, got ${gap}`
  );

  const stationary = hsiSpectralModule.computeStationaryDistribution(P);
  assert.equal(stationary.length, EXPECTED_STATIONARY.length, 'stationary distribution length mismatch');
  let stationarySum = 0;
  for (let i = 0; i < EXPECTED_STATIONARY.length; i += 1) {
    assert.ok(
      Math.abs(stationary[i] - EXPECTED_STATIONARY[i]) < TOL,
      `computeStationaryDistribution[${i}] (${MODES[i]}): expected ${EXPECTED_STATIONARY[i]}, got ${stationary[i]}`
    );
    stationarySum += stationary[i];
  }
  assert.ok(Math.abs(stationarySum - 1.0) < TOL, 'stationary distribution must sum to 1');

  const absorbingScore = hsiSpectralModule.detectAbsorbingTendency(P, MODES);
  assert.ok(
    Math.abs(absorbingScore - EXPECTED_ABSORBING_SCORE) < TOL,
    `detectAbsorbingTendency: expected ${EXPECTED_ABSORBING_SCORE}, got ${absorbingScore}`
  );
  assert.ok(
    absorbingScore > 0,
    'a matrix with one mode self-loop forced above 0.6 must score strictly greater than 0'
  );

  const built = hsiSpectralModule.buildTransitionMatrix(MODE_SEQUENCE, MODES);
  for (let r = 0; r < EXPECTED_BUILT_MATRIX.length; r += 1) {
    for (let c = 0; c < EXPECTED_BUILT_MATRIX[r].length; c += 1) {
      assert.ok(
        Math.abs(built[r][c] - EXPECTED_BUILT_MATRIX[r][c]) < TOL,
        `buildTransitionMatrix[${r}][${c}]: expected ${EXPECTED_BUILT_MATRIX[r][c]}, got ${built[r][c]}`
      );
    }
  }

  console.log('PASS 272-spectral');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
