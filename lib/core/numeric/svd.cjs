/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 272-05 -- deterministic truncated SVD with sklearn-compatible sign
 * resolution (svd_flip).
 *
 * WAVE 0 SPIKE DECISION (recorded here per this task's own instruction, not a
 * separate report): hand-write the truncated SVD rather than adding
 * `ml-matrix`/`svd-js`. Rationale, per 272-RESEARCH.md's "Alternatives
 * Considered" table: this repo's convention is zero-new-runtime-deps with a
 * fully vendored `node_modules` tree; a self-contained truncated SVD for the
 * bounded matrix shapes this phase actually needs (n_docs up to a few
 * hundred, n_terms up to `max_features` <= 2000, n_components <= 80) is a
 * testable, bounded numerical-methods problem, not an open-ended one. No
 * package-manager install was attempted for this task.
 *
 * ALGORITHM: Gram-matrix eigendecomposition (a standard, deterministic,
 * non-randomized SVD construction -- no Math.random(), no external seed,
 * same input always produces the same output). Given an m x n dense matrix
 * A, form the Gram matrix on whichever side is smaller (A*A^T if m <= n,
 * else A^T*A), eigendecompose that small symmetric matrix with a classic
 * cyclic one-sided Jacobi eigenvalue algorithm (documented per this task's
 * "power-iteration-based OR one-sided Jacobi, executor's choice" option --
 * Jacobi was chosen here because it needs no random initialization and
 * converges to an exact per-vector ordering, not just a subspace), then
 * derive the other side's singular vectors algebraically
 * (V = A^T U / sigma, or U = A V / sigma) and sort by descending singular
 * value. `opts.iterations` bounds the Jacobi sweep count (default 60,
 * generous for the bounded matrix sizes above; exposed, not hardcoded
 * invisibly, per this task's instruction).
 *
 * DELIBERATE SIMPLIFICATION (not silent): `matrix` is a plain dense 2D
 * array. The TF-IDF matrix this module receives from tfidf.cjs is sparse in
 * the original Python (scipy.sparse), but this port operates on a dense
 * representation given this phase's bounded shapes. If room sizes grow well
 * beyond this phase's fixture room, a sparse representation is the natural
 * next optimization point -- flagged here for 272-06/272-07, not attempted
 * in this task.
 *
 * PUBLIC CONTRACT for 272-06 (rs-math.cjs) / 272-07 (hsi-lsa.cjs), the two
 * consumers of this module (both call it independently with their own
 * n_components; neither caller's value is hardcoded here):
 *
 *   - svdFlip(rawVRows): pure sign-flip primitive, the piece
 *     tests/272-svd-sign.test.cjs pins directly. `rawVRows` is a plain
 *     k x n array (rows = raw, unflipped right-singular-vector components --
 *     e.g. a VT matrix from any SVD source). Returns a NEW k x n array
 *     (never mutates the input) with sklearn's exact
 *     svd_flip(u_based_decision=False) rule applied per row: find the
 *     column index of the row's largest-ABSOLUTE-value entry; take the sign
 *     of that entry (0 is treated as positive, i.e. no flip, to avoid
 *     zeroing an all-zero row); multiply the whole row by that sign. This
 *     is the V-row argmax-abs rule verified live against installed sklearn
 *     1.8.0 source in 272-01 -- see tests/272-svd-sign.test.cjs's header for
 *     the exact verification trail. Do not re-derive this rule elsewhere.
 *
 *   - truncatedSvdWithSignFlip(matrix, nComponents, opts): the full
 *     pipeline. `matrix` is an m x n dense array of numbers, `nComponents`
 *     is an already-clamped integer (callers compute
 *     max(1, min(n_components, n_rows-1, n_terms-1)) themselves, mirroring
 *     rs_math.py:32-71's build_tfidf_svd -- this module clamps again
 *     defensively but does not own that policy). `opts.iterations` (default
 *     60) bounds the Jacobi eigensolver's sweep count.
 *
 *     Returns on success:
 *       {
 *         ok: true,
 *         components: <nComponents x n array, sign-flipped via svdFlip --
 *           this IS sklearn's components_ equivalent>,
 *         singularValues: <length-nComponents array, descending>,
 *         leftSingularVectors: <m x nComponents array, U, sign-paired with
 *           components so leftSingularVectors * diag(singularValues) *
 *           components approximates matrix -- mirrors sklearn's own
 *           `u *= signs; v *= signs` pairing even though the primary
 *           consumer only reads components_/V>,
 *       }
 *     Never throws. Degenerate input (empty matrix, nComponents <= 0,
 *     nComponents larger than the matrix's rank) is clamped internally and
 *     returns a valid (possibly empty) `ok: true` result, never a thrown
 *     error and never a bare crash -- consistent with PATTERNS.md
 *     convention 4 (never throw across a module boundary).
 *
 * Error-envelope family: `{ ok, error, detail }` (matches the `rs-*` module
 * family per 272-PATTERNS.md convention 4, not the `embedding-*` `success`
 * family -- svd.cjs/tfidf.cjs are primarily consumed by rs-math.cjs).
 * truncatedSvdWithSignFlip uses this family; svdFlip is a pure array-in,
 * array-out primitive with no envelope, matching the exact shape
 * tests/272-svd-sign.test.cjs binds to.
 *
 * Pure CJS, zero npm deps, node built-ins only. Never throws.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
'use strict';

const DEFAULT_ITERATIONS = 60;
const ZERO_TOL = 1e-12;

// ---------- svdFlip (the tested, pinned sign-flip primitive) ----------

function svdFlip(rawVRows) {
  if (!Array.isArray(rawVRows)) return [];
  const out = [];
  for (let r = 0; r < rawVRows.length; r += 1) {
    const row = rawVRows[r];
    if (!Array.isArray(row) || row.length === 0) {
      out.push(Array.isArray(row) ? row.slice() : row);
      continue;
    }
    let maxAbs = -Infinity;
    let maxIdx = 0;
    for (let c = 0; c < row.length; c += 1) {
      const a = Math.abs(row[c]);
      if (a > maxAbs) {
        maxAbs = a;
        maxIdx = c;
      }
    }
    // sklearn's np.sign(0) == 0 would zero the whole row; treat a zero
    // dominant entry as positive (no flip) instead -- a documented,
    // deliberate choice for a degenerate all-zero-ish row, not silent.
    const sign = row[maxIdx] < 0 ? -1 : 1;
    if (sign === 1) {
      out.push(row.slice());
    } else {
      const flipped = new Array(row.length);
      for (let c = 0; c < row.length; c += 1) flipped[c] = -row[c];
      out.push(flipped);
    }
  }
  return out;
}

// ---------- small dense linear-algebra helpers ----------

// A^T * B, where A is m x n and B is m x k. Returns n x k.
function matTMul(A, B) {
  const m = A.length;
  const n = m > 0 ? A[0].length : 0;
  const k = B.length > 0 ? B[0].length : 0;
  const out = [];
  for (let j = 0; j < n; j += 1) out.push(new Array(k).fill(0));
  for (let i = 0; i < m; i += 1) {
    const arow = A[i];
    const brow = B[i];
    for (let j = 0; j < n; j += 1) {
      const aij = arow[j];
      if (aij === 0) continue;
      const outRow = out[j];
      for (let p = 0; p < k; p += 1) outRow[p] += aij * brow[p];
    }
  }
  return out;
}

// A * B, where A is m x n and B is n x k. Returns m x k.
function matMul(A, B) {
  const m = A.length;
  const n = m > 0 ? A[0].length : 0;
  const k = B.length > 0 ? B[0].length : 0;
  const out = [];
  for (let i = 0; i < m; i += 1) {
    const row = new Array(k).fill(0);
    const arow = A[i];
    for (let p = 0; p < n; p += 1) {
      const aip = arow[p];
      if (aip === 0) continue;
      const brow = B[p];
      for (let j = 0; j < k; j += 1) row[j] += aip * brow[j];
    }
    out.push(row);
  }
  return out;
}

// Symmetric Gram matrix on the SMALLER dimension: A*A^T (m x m) if
// useSelfT is false, or A^T*A (n x n) if useSelfT is true.
function gramSelf(matrix, useSelfT) {
  if (useSelfT) {
    return matTMul(matrix, matrix);
  }
  const m = matrix.length;
  const n = m > 0 ? matrix[0].length : 0;
  const out = [];
  for (let i = 0; i < m; i += 1) out.push(new Array(m).fill(0));
  for (let i = 0; i < m; i += 1) {
    const rowI = matrix[i];
    for (let j = i; j < m; j += 1) {
      const rowJ = matrix[j];
      let sum = 0;
      for (let p = 0; p < n; p += 1) sum += rowI[p] * rowJ[p];
      out[i][j] = sum;
      out[j][i] = sum;
    }
  }
  return out;
}

// Classic cyclic one-sided Jacobi eigenvalue algorithm for a small dense
// symmetric matrix. Deterministic (identity start, no randomness). Returns
// { eigenvalues: [...], eigenvectors: <n x n, columns are eigenvectors> }.
function jacobiEigenSymmetric(A, maxSweeps) {
  const n = A.length;
  const M = [];
  for (let i = 0; i < n; i += 1) M.push(A[i].slice());
  const V = [];
  for (let i = 0; i < n; i += 1) {
    const row = new Array(n).fill(0);
    row[i] = 1;
    V.push(row);
  }
  const sweeps = maxSweeps > 0 ? maxSweeps : DEFAULT_ITERATIONS;
  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    let offDiagSum = 0;
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) offDiagSum += M[p][q] * M[p][q];
    }
    if (offDiagSum < 1e-20) break;
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        const mpq = M[p][q];
        if (Math.abs(mpq) < 1e-15) continue;
        const mpp = M[p][p];
        const mqq = M[q][q];
        const theta = (mqq - mpp) / (2 * mpq);
        const thetaSign = theta < 0 ? -1 : 1;
        const t = thetaSign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        M[p][p] = c * c * mpp - 2 * s * c * mpq + s * s * mqq;
        M[q][q] = s * s * mpp + 2 * s * c * mpq + c * c * mqq;
        M[p][q] = 0;
        M[q][p] = 0;

        for (let i = 0; i < n; i += 1) {
          if (i === p || i === q) continue;
          const mip = M[i][p];
          const miq = M[i][q];
          M[i][p] = c * mip - s * miq;
          M[p][i] = M[i][p];
          M[i][q] = s * mip + c * miq;
          M[q][i] = M[i][q];
        }
        for (let i = 0; i < n; i += 1) {
          const vip = V[i][p];
          const viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  const eigenvalues = new Array(n);
  for (let i = 0; i < n; i += 1) eigenvalues[i] = M[i][i];
  return { eigenvalues, eigenvectors: V };
}

// ---------- truncatedSvdWithSignFlip (the full pipeline) ----------

function truncatedSvdWithSignFlip(matrix, nComponents, opts) {
  const options = opts || {};
  const maxSweeps = Number.isFinite(options.iterations) && options.iterations > 0
    ? Math.floor(options.iterations)
    : DEFAULT_ITERATIONS;

  const empty = { ok: true, components: [], singularValues: [], leftSingularVectors: [] };

  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0]) || matrix[0].length === 0) {
    return empty;
  }

  const m = matrix.length;
  const n = matrix[0].length;
  const maxRank = Math.min(m, n);
  const requested = Number.isFinite(nComponents) ? Math.floor(nComponents) : 0;
  const k = Math.max(0, Math.min(requested, maxRank));

  if (k === 0) return empty;

  const useSelfT = m > n; // Gram matrix on the smaller dimension
  const gramDim = useSelfT ? n : m;
  const G = gramSelf(matrix, useSelfT);
  const { eigenvalues, eigenvectors } = jacobiEigenSymmetric(G, maxSweeps);

  const order = [];
  for (let i = 0; i < gramDim; i += 1) order.push(i);
  order.sort((a, b) => eigenvalues[b] - eigenvalues[a]);
  const kEff = Math.min(k, order.length);
  const topOrder = order.slice(0, kEff);

  const singularValues = new Array(kEff);
  for (let j = 0; j < kEff; j += 1) {
    singularValues[j] = Math.sqrt(Math.max(eigenvalues[topOrder[j]], 0));
  }

  let U;
  let V;
  if (!useSelfT) {
    // eigenvectors are U (m x m columns, selected -> m x kEff)
    const Usel = [];
    for (let i = 0; i < m; i += 1) {
      const row = new Array(kEff);
      for (let j = 0; j < kEff; j += 1) row[j] = eigenvectors[i][topOrder[j]];
      Usel.push(row);
    }
    const AtU = matTMul(matrix, Usel); // n x kEff
    const Vsel = [];
    for (let i = 0; i < n; i += 1) Vsel.push(new Array(kEff));
    for (let j = 0; j < kEff; j += 1) {
      const sv = singularValues[j];
      for (let i = 0; i < n; i += 1) {
        Vsel[i][j] = sv > ZERO_TOL ? AtU[i][j] / sv : 0;
      }
    }
    U = Usel;
    V = Vsel;
  } else {
    // eigenvectors are V (n x n columns, selected -> n x kEff)
    const Vsel = [];
    for (let i = 0; i < n; i += 1) {
      const row = new Array(kEff);
      for (let j = 0; j < kEff; j += 1) row[j] = eigenvectors[i][topOrder[j]];
      Vsel.push(row);
    }
    const AV = matMul(matrix, Vsel); // m x kEff
    const Usel = [];
    for (let i = 0; i < m; i += 1) Usel.push(new Array(kEff));
    for (let j = 0; j < kEff; j += 1) {
      const sv = singularValues[j];
      for (let i = 0; i < m; i += 1) {
        Usel[i][j] = sv > ZERO_TOL ? AV[i][j] / sv : 0;
      }
    }
    U = Usel;
    V = Vsel;
  }

  // rawComponents (unflipped V^T, k x n)
  const rawComponents = [];
  for (let j = 0; j < kEff; j += 1) {
    const row = new Array(n);
    for (let i = 0; i < n; i += 1) row[i] = V[i][j];
    rawComponents.push(row);
  }

  const components = svdFlip(rawComponents);

  // Pair U's columns with the same per-row sign applied to components, so
  // U * diag(S) * components stays consistent -- mirrors sklearn's
  // u *= signs; v *= signs pairing (svd_flip's u_based_decision=False path
  // still flips u by the SAME sign it computed from v, it just doesn't use
  // u to DECIDE the sign).
  const leftSingularVectors = [];
  for (let i = 0; i < m; i += 1) leftSingularVectors.push(new Array(kEff));
  for (let j = 0; j < kEff; j += 1) {
    const rawRow = rawComponents[j];
    let maxAbs = -Infinity;
    let maxIdx = 0;
    for (let c = 0; c < rawRow.length; c += 1) {
      const a = Math.abs(rawRow[c]);
      if (a > maxAbs) {
        maxAbs = a;
        maxIdx = c;
      }
    }
    const sign = rawRow[maxIdx] < 0 ? -1 : 1;
    for (let i = 0; i < m; i += 1) leftSingularVectors[i][j] = U[i][j] * sign;
  }

  return { ok: true, components, singularValues, leftSingularVectors };
}

module.exports = {
  svdFlip,
  truncatedSvdWithSignFlip,
};
