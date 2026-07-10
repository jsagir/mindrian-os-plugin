/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-01 -- AHP criterion-weight module (SEED-048 portfolio-scale fusion).
 *
 * The ONE genuinely net-new piece of math this phase mints. It turns a small
 * pairwise judgment matrix over the THREE portfolio CRITERIA (strategic fit /
 * validated demand / technical-economic feasibility) into a normalized weight
 * vector, so every ranked candidate in Plans 03-05 carries a defensible
 * weighted score instead of a vibe number.
 *
 * --------------------------------------------------------------------------
 * CANON PART 7 (Reuse Before Build): net-new is JUSTIFIED.
 * --------------------------------------------------------------------------
 * The 215-RESEARCH.md Part-7 reuse search was performed and came back
 * grep-clean: no AHP / analytic-hierarchy / pairwise-weighting scorer exists
 * anywhere in lib/ or scripts/ (the only "pairwise" hits are sklearn cosine
 * similarity in the RS engine, unrelated). This is a ~1-file deterministic CJS
 * module (geometric-mean weights + Saaty Consistency Ratio), NOT a shared
 * engine. Reuse searched, none found, net-new mint approved.
 *
 * --------------------------------------------------------------------------
 * CANON PART 8 (Graph Boundary): N/A by construction.
 * --------------------------------------------------------------------------
 * Pure local math over at most 9 numbers plus one committed local JSON read.
 * Zero network, zero Brain, zero room-byte egress. Nothing to leak
 * (215-RESEARCH.md threat T-215-02: accept).
 *
 * --------------------------------------------------------------------------
 * THE LOCKED DECISION (215-RESEARCH.md Pitfall 2, SEED-048 line 33):
 * --------------------------------------------------------------------------
 * AHP weights the 3 CRITERIA only (a trivial 3x3), and each technology is then
 * scored on each criterion independently: score = weights . dimension-scores.
 * We NEVER pairwise-compare technologies against each other: a full
 * technology-by-technology matrix (millions of pairs at portfolio scale) is
 * intractable and inconsistent by construction, and AHP's strength is
 * weighting a SMALL number of criteria, not ranking thousands of
 * alternatives. That anti-pattern is forbidden here.
 *
 * Node built-ins only. No new deps. No em-dashes.
 *
 * Interface contract (consumed by Plans 02/04):
 *   CRITERIA
 *     -> frozen ['strategic_fit','validated_demand','tech_econ_feasibility']
 *        (order is load-bearing: matrix rows/cols + weight vector follow it).
 *   computeAhpWeights(matrix)
 *     -> { weights:[w0,w1,w2], lambdaMax, ci, cr, consistent }
 *   loadAhpConfig(configPath?)
 *     -> { criteria, matrix, weights, cr, provenance }
 *   composeScore(dims, weights)
 *     -> number in [0,1] (dot product in CRITERIA order).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// This module lives at lib/core/eureka/, so the repo root is three up.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_CONFIG_PATH = path.join(REPO_ROOT, 'data', 'portfolio-ahp-matrix.json');

// The frozen, order-bearing criterion vocabulary. Matrix rows/cols and the
// resulting weight vector are ALL indexed in this order.
const CRITERIA = Object.freeze([
  'strategic_fit',
  'validated_demand',
  'tech_econ_feasibility',
]);

const N = 3; // AHP here weights EXACTLY the 3 criteria (never the technologies).
const EPS = 1e-9;

// Saaty's Random Index for n=3. Frozen constant, cited to 215-RESEARCH.md
// Pitfall 2 ("compute Saaty's Consistency Ratio on the 3x3 and reject CR > 0.1").
// RI is the average CI of many random reciprocal matrices; for n=3 it is 0.58.
const RI_3 = 0.58;

// The Saaty acceptance threshold. A matrix with CR above this is REJECTED, never
// silently rescaled (SEED-048 "defensible, not a vibe number").
const CR_MAX = 0.1;

// ---------- Validation ----------

function validateMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== N) {
    throw new Error('AHP_MATRIX_SHAPE: expected a ' + N + 'x' + N + ' matrix, got ' +
      (Array.isArray(matrix) ? matrix.length + ' rows' : typeof matrix));
  }
  for (let i = 0; i < N; i += 1) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== N) {
      throw new Error('AHP_MATRIX_SHAPE: row ' + i + ' is not a length-' + N + ' array');
    }
  }
  // Positivity + finiteness (every judgment on the Saaty 1-9 scale is > 0).
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      const v = matrix[i][j];
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        throw new Error('AHP_MATRIX_POSITIVE: entry [' + i + '][' + j +
          '] must be a finite positive number, got ' + String(v));
      }
    }
  }
  // Diagonal is 1 (a criterion compared to itself).
  for (let i = 0; i < N; i += 1) {
    if (Math.abs(matrix[i][i] - 1) > EPS) {
      throw new Error('AHP_MATRIX_SHAPE: diagonal [' + i + '][' + i + '] must be 1, got ' +
        matrix[i][i]);
    }
  }
  // Reciprocity: m[i][j] * m[j][i] == 1. A non-reciprocal edit is a bad matrix,
  // not a preference (Test 4: m[0][1]=3 with m[1][0]=3 is rejected).
  for (let i = 0; i < N; i += 1) {
    for (let j = i + 1; j < N; j += 1) {
      if (Math.abs(matrix[i][j] * matrix[j][i] - 1) > EPS) {
        throw new Error('AHP_RECIPROCITY: entries [' + i + '][' + j + '] and [' + j + '][' + i +
          '] must be reciprocals (product = 1), got ' + matrix[i][j] + ' and ' + matrix[j][i]);
      }
    }
  }
}

// ---------- Weights (geometric-mean method) ----------

// g_i = (product over j of m[i][j])^(1/N); w_i = g_i / sum(g). This is the
// standard eigenvector approximation and is EXACT for consistent matrices.
function computeAhpWeights(matrix) {
  validateMatrix(matrix);

  const g = new Array(N);
  for (let i = 0; i < N; i += 1) {
    let prod = 1;
    for (let j = 0; j < N; j += 1) prod *= matrix[i][j];
    g[i] = Math.pow(prod, 1 / N);
  }
  const gSum = g[0] + g[1] + g[2];
  const weights = g.map(function (gi) { return gi / gSum; });

  // lambdaMax = mean over i of ((M x w)_i / w_i).
  let lambdaSum = 0;
  for (let i = 0; i < N; i += 1) {
    let mw = 0;
    for (let j = 0; j < N; j += 1) mw += matrix[i][j] * weights[j];
    lambdaSum += mw / weights[i];
  }
  const lambdaMax = lambdaSum / N;

  // ci = (lambdaMax - n) / (n - 1); cr = ci / RI. Float noise can push ci very
  // slightly negative on a perfectly consistent matrix; clamp cr to 0 there.
  let ci = (lambdaMax - N) / (N - 1);
  if (ci < 0) ci = 0;
  const cr = ci / RI_3;
  const consistent = cr <= CR_MAX;

  return { weights: weights, lambdaMax: lambdaMax, ci: ci, cr: cr, consistent: consistent };
}

// ---------- Config load (per-run reload from the committed matrix) ----------

// Reads the committed judgment matrix, re-validates + re-scores it on EVERY
// load (so a navigator edit takes effect next run with no code change), and
// THROWS AHP_INCONSISTENT if the edited matrix fails the CR gate. Never
// rescales, never silently falls back to equal weights: a silent fallback
// would fabricate defensibility, the exact failure the seed exists to prevent.
function loadAhpConfig(configPath) {
  const p = configPath || DEFAULT_CONFIG_PATH;
  const raw = fs.readFileSync(p, 'utf8');
  const config = JSON.parse(raw);

  if (!config || !Array.isArray(config.criteria) ||
      config.criteria.length !== CRITERIA.length ||
      config.criteria.some(function (c, i) { return c !== CRITERIA[i]; })) {
    throw new Error('AHP_MATRIX_SHAPE: config.criteria must deep-equal CRITERIA in order [' +
      CRITERIA.join(', ') + '], got [' +
      (Array.isArray(config && config.criteria) ? config.criteria.join(', ') : 'n/a') + ']');
  }

  const result = computeAhpWeights(config.matrix);
  if (!result.consistent) {
    throw new Error('AHP_INCONSISTENT: committed matrix ' + p + ' has Consistency Ratio cr=' +
      result.cr.toFixed(4) + ' > ' + CR_MAX + '; fix the judgments before any portfolio run');
  }

  return {
    criteria: config.criteria.slice(),
    matrix: config.matrix,
    weights: result.weights,
    cr: result.cr,
    provenance: config.provenance || null,
  };
}

// ---------- Score composition ----------

// score = weights . dimension-scores, in CRITERIA order. Every dimension must
// be present and in [0,1] (a probability-like normalized sub-score); a missing
// key or an out-of-range value throws DIM_RANGE. The result is in [0,1]
// because the weights are a convex combination (sum to 1) of [0,1] values.
function composeScore(dims, weights) {
  if (!dims || typeof dims !== 'object') {
    throw new Error('DIM_RANGE: dims must be an object keyed by CRITERIA');
  }
  if (!Array.isArray(weights) || weights.length !== N) {
    throw new Error('DIM_RANGE: weights must be a length-' + N + ' vector');
  }
  let score = 0;
  for (let i = 0; i < N; i += 1) {
    const key = CRITERIA[i];
    const v = dims[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error('DIM_RANGE: dimension "' + key + '" must be a number in [0,1], got ' +
        String(v));
    }
    score += weights[i] * v;
  }
  return score;
}

// ---------- Exports ----------

module.exports = {
  CRITERIA: CRITERIA,
  computeAhpWeights: computeAhpWeights,
  loadAhpConfig: loadAhpConfig,
  composeScore: composeScore,
  _test: {
    RI_3: RI_3,
    CR_MAX: CR_MAX,
    REPO_ROOT: REPO_ROOT,
    DEFAULT_CONFIG_PATH: DEFAULT_CONFIG_PATH,
    validateMatrix: validateMatrix,
  },
};
