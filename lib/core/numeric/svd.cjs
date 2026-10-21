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
 * ALGORITHM (two paths behind one switch, Phase 379.1 D-379.1-14):
 *
 *   jacobi (the small-matrix path, unchanged since 272-05): Gram-matrix
 *   eigendecomposition. Given an m x n dense matrix A, form the Gram matrix
 *   on whichever side is smaller (A*A^T if m <= n, else A^T*A),
 *   eigendecompose that small symmetric matrix with a classic cyclic
 *   one-sided Jacobi eigenvalue algorithm (documented per this task's
 *   "power-iteration-based OR one-sided Jacobi, executor's choice" option --
 *   Jacobi was chosen here because it needs no random initialization and
 *   converges to an exact per-vector ordering, not just a subspace), then
 *   derive the other side's singular vectors algebraically
 *   (V = A^T U / sigma, or U = A V / sigma) and sort by descending singular
 *   value. `opts.iterations` bounds the Jacobi sweep count (default 60,
 *   generous for the bounded matrix sizes above; exposed, not hardcoded
 *   invisibly, per this task's instruction).
 *
 *   randomized (the large-matrix path, Halko, Martinsson and Tropp 2011):
 *   a seeded randomized truncated SVD. Omega (n x l, l = k + 10) is a
 *   Gaussian block drawn from a xorshift32 generator seeded by the code
 *   constant RANDOMIZED_SEED, in a fixed row-major order; Y = A Omega;
 *   Q = mgsQR(Y); two power iterations (Z = A^T Q, Z = mgsQR(Z), Y = A Z,
 *   Q = mgsQR(Y)); B = Q^T A; the small SVD of B goes through the same
 *   gramSelf plus jacobiEigenSymmetric on B B^T (l x l); U = Q Utilde and
 *   V = B^T Utilde / sigma; the first k triplets by descending sigma are
 *   returned through the same sign pairing as the jacobi path. The seed is
 *   a code constant: there is no call to the global random function and no
 *   external seed, so the same input still gives the same output. Every
 *   inner loop over A skips zero entries (the TF-IDF matrix is sparse).
 *
 *   The switch: resolveSolver(opts, shape) returns 'jacobi' or 'randomized'
 *   from, in priority order, the env MINDRIAN_SVD_SOLVER (only the two
 *   literal values count; anything else means auto), opts.solver (same two
 *   values), else auto: 'randomized' when min(rows, cols) is greater than
 *   MINDRIAN_SVD_RANDOMIZED_MIN_SIDE (a positive integer, default 300) and
 *   k + 10 fits inside min(rows, cols), else 'jacobi'. A matrix whose
 *   smaller side is at most 300 therefore takes the jacobi path exactly as
 *   before (D-379.1-15: LSA stays). The envelope carries the path that ran
 *   as `solver`. A degenerate shape on the randomized path falls back to
 *   the jacobi path; neither path throws.
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

// Randomized path (Phase 379.1 D-379.1-14). The seed is a code constant so
// the same input gives the same output; the oversampling and the power
// iteration count are the values the breakthrough probe measured
// (2163 x 2000, k = 80, p = 10, q = 2 in 3,381 ms).
const RANDOMIZED_OVERSAMPLING = 10;
const RANDOMIZED_POWER_ITERATIONS = 2;
const RANDOMIZED_SEED = 0x379101;
const DEFAULT_RANDOMIZED_MIN_SIDE = 300;

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

// ---------- the solver switch (Phase 379.1 D-379.1-14) ----------

// Reads MINDRIAN_SVD_RANDOMIZED_MIN_SIDE as a positive integer (the
// resolveBatchSize shape from embedding-spine.cjs); any other value means
// the default.
function resolveRandomizedMinSide() {
  const raw = process.env.MINDRIAN_SVD_RANDOMIZED_MIN_SIDE;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  return DEFAULT_RANDOMIZED_MIN_SIDE;
}

function _literalSolver(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v === 'jacobi' || v === 'randomized') return v;
  return null;
}

// resolveSolver(opts, shape) -> 'jacobi' | 'randomized'. shape is
// { rows, cols, nComponents } after the caller's clamping. Priority: the
// env MINDRIAN_SVD_SOLVER (two literal values only), opts.solver (same),
// else the auto rule described in the header.
function resolveSolver(opts, shape) {
  const fromEnv = _literalSolver(process.env.MINDRIAN_SVD_SOLVER);
  if (fromEnv) return fromEnv;
  const fromOpts = _literalSolver(opts && opts.solver);
  if (fromOpts) return fromOpts;
  const s = shape || {};
  const rows = Number(s.rows);
  const cols = Number(s.cols);
  const k = Number(s.nComponents);
  const minSide = Math.min(rows, cols);
  if (
    Number.isFinite(minSide) &&
    minSide > resolveRandomizedMinSide() &&
    Number.isFinite(k) &&
    k + RANDOMIZED_OVERSAMPLING <= minSide
  ) {
    return 'randomized';
  }
  return 'jacobi';
}

// ---------- seeded PRNG (xorshift32, Box-Muller) ----------

// xorshift32 over an unsigned 32-bit state. A zero state would stay zero, so
// the constant seed is non-zero by construction and guarded here anyway.
function makeXorshift32(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return function next() {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };
}

// Standard normal samples by Box-Muller over uniforms strictly inside (0, 1).
function makeGaussian(seed) {
  const next = makeXorshift32(seed);
  function uniform() {
    return (next() + 1) / 4294967297;
  }
  let spare = null;
  return function gaussian() {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    const u1 = uniform();
    const u2 = uniform();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spare = r * Math.sin(theta);
    return r * Math.cos(theta);
  };
}

// ---------- block helpers for the randomized path ----------
// A "block" is a rows x l row-major Float64Array. A is the caller's dense
// m x n matrix of plain rows; every loop over A skips its zero entries.

// Y = A * W, with W an n x l block. Returns an m x l block.
function mulAW(A, m, n, W, l) {
  const Y = new Float64Array(m * l);
  for (let i = 0; i < m; i += 1) {
    const row = A[i];
    const yb = i * l;
    for (let p = 0; p < n; p += 1) {
      const a = row[p];
      if (a === 0) continue;
      const wb = p * l;
      for (let j = 0; j < l; j += 1) Y[yb + j] += a * W[wb + j];
    }
  }
  return Y;
}

// Z = A^T * Q, with Q an m x l block. Returns an n x l block.
function mulAtQ(A, m, n, Q, l) {
  const Z = new Float64Array(n * l);
  for (let i = 0; i < m; i += 1) {
    const row = A[i];
    const qb = i * l;
    for (let p = 0; p < n; p += 1) {
      const a = row[p];
      if (a === 0) continue;
      const zb = p * l;
      for (let j = 0; j < l; j += 1) Z[zb + j] += a * Q[qb + j];
    }
  }
  return Z;
}

// Modified Gram-Schmidt on the columns of a rows x l block. A column whose
// norm after projection is below ZERO_TOL is dropped (the input has rank
// below l). Returns { q: rows x lEff block, l: lEff }.
function mgsQR(block, rows, l) {
  const cols = [];
  for (let j = 0; j < l; j += 1) {
    const c = new Float64Array(rows);
    for (let i = 0; i < rows; i += 1) c[i] = block[i * l + j];
    cols.push(c);
  }
  const kept = [];
  for (let j = 0; j < l; j += 1) {
    const v = cols[j];
    for (let t = 0; t < kept.length; t += 1) {
      const q = kept[t];
      let r = 0;
      for (let i = 0; i < rows; i += 1) r += q[i] * v[i];
      if (r !== 0) {
        for (let i = 0; i < rows; i += 1) v[i] -= r * q[i];
      }
    }
    let norm = 0;
    for (let i = 0; i < rows; i += 1) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    if (norm < ZERO_TOL) continue;
    for (let i = 0; i < rows; i += 1) v[i] /= norm;
    kept.push(v);
  }
  const lEff = kept.length;
  const q = new Float64Array(rows * lEff);
  for (let j = 0; j < lEff; j += 1) {
    const c = kept[j];
    for (let i = 0; i < rows; i += 1) q[i * lEff + j] = c[i];
  }
  return { q, l: lEff };
}

// ---------- randomizedTruncatedSvd (the large-matrix path) ----------

// randomizedTruncatedSvd(matrix, k, maxSweeps): m x n dense rows, k already
// clamped to min(m, n). Returns the same envelope as the jacobi path with
// solver: 'randomized', or null on a degenerate shape or any internal
// failure (the caller then takes the jacobi path). Never throws.
function randomizedTruncatedSvd(matrix, k, maxSweeps) {
  try {
    const m = matrix.length;
    const n = matrix[0].length;
    const maxRank = Math.min(m, n);
    if (m < 1 || n < 1 || k < 1 || k > maxRank) return null;
    const l = Math.min(k + RANDOMIZED_OVERSAMPLING, maxRank);

    // Omega: n x l Gaussian block in a fixed row-major order from the
    // constant seed, so the draw is reproducible.
    const gaussian = makeGaussian(RANDOMIZED_SEED);
    const Omega = new Float64Array(n * l);
    for (let p = 0; p < n; p += 1) {
      const ob = p * l;
      for (let j = 0; j < l; j += 1) Omega[ob + j] = gaussian();
    }

    let Q = mgsQR(mulAW(matrix, m, n, Omega, l), m, l);
    for (let it = 0; it < RANDOMIZED_POWER_ITERATIONS; it += 1) {
      if (Q.l < 1) break;
      const Z = mgsQR(mulAtQ(matrix, m, n, Q.q, Q.l), n, Q.l);
      if (Z.l < 1) break;
      Q = mgsQR(mulAW(matrix, m, n, Z.q, Z.l), m, Z.l);
    }
    const lEff = Q.l;
    if (lEff < 1) return null;

    // B = Q^T A (lEff x n), built from its transpose B^T = A^T Q so the
    // zero-skip loop writes contiguous rows.
    const BT = mulAtQ(matrix, m, n, Q.q, lEff);
    const B = [];
    for (let j = 0; j < lEff; j += 1) {
      const row = new Array(n);
      for (let p = 0; p < n; p += 1) row[p] = BT[p * lEff + j];
      B.push(row);
    }

    // Small SVD of B through the existing Gram plus Jacobi machinery:
    // B B^T = Utilde Sigma^2 Utilde^T.
    const G = gramSelf(B, false);
    const { eigenvalues, eigenvectors } = jacobiEigenSymmetric(G, maxSweeps);
    const order = [];
    for (let i = 0; i < lEff; i += 1) order.push(i);
    order.sort((a, b) => (eigenvalues[b] - eigenvalues[a]) || (a - b));
    const kept = Math.min(k, lEff);

    const singularValues = new Array(k).fill(0);
    for (let c = 0; c < kept; c += 1) {
      singularValues[c] = Math.sqrt(Math.max(eigenvalues[order[c]], 0));
    }

    // U = Q Utilde (m x k rows), V = B^T Utilde / sigma (n x k rows). Columns
    // beyond `kept` (rank below k) stay zero, as the jacobi path leaves them.
    const U = [];
    for (let i = 0; i < m; i += 1) U.push(new Array(k).fill(0));
    const V = [];
    for (let p = 0; p < n; p += 1) V.push(new Array(k).fill(0));
    for (let c = 0; c < kept; c += 1) {
      const col = order[c];
      const sv = singularValues[c];
      for (let i = 0; i < m; i += 1) {
        const qb = i * lEff;
        let acc = 0;
        for (let j = 0; j < lEff; j += 1) acc += Q.q[qb + j] * eigenvectors[j][col];
        U[i][c] = acc;
      }
      if (sv > ZERO_TOL) {
        const accRow = new Float64Array(n);
        for (let j = 0; j < lEff; j += 1) {
          const coef = eigenvectors[j][col];
          if (coef === 0) continue;
          const brow = B[j];
          for (let p = 0; p < n; p += 1) accRow[p] += coef * brow[p];
        }
        for (let p = 0; p < n; p += 1) V[p][c] = accRow[p] / sv;
      }
    }

    return assembleEnvelope(U, V, singularValues, m, n, k, 'randomized');
  } catch (_e) {
    return null;
  }
}

// ---------- the shared envelope tail (sign pairing) ----------

// assembleEnvelope(U, V, singularValues, m, n, kEff, solver): U is m x kEff
// rows, V is n x kEff rows. Builds the unflipped V^T, applies svdFlip, and
// pairs U's columns with the same per-row sign. This is the tail of the
// 272-05 jacobi pipeline, unchanged in its arithmetic; the randomized path
// reuses it so both paths pair the signs the same way.
function assembleEnvelope(U, V, singularValues, m, n, kEff, solver) {
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

  return { ok: true, components, singularValues, leftSingularVectors, solver };
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

  // The solver switch (Phase 379.1 D-379.1-14). A null from the randomized
  // path means a degenerate shape; the jacobi path below then runs.
  const solver = resolveSolver(options, { rows: m, cols: n, nComponents: k });
  if (solver === 'randomized') {
    const randomized = randomizedTruncatedSvd(matrix, k, maxSweeps);
    if (randomized) return randomized;
  }

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

  return assembleEnvelope(U, V, singularValues, m, n, kEff, 'jacobi');
}

module.exports = {
  svdFlip,
  truncatedSvdWithSignFlip,
  _test: {
    resolveSolver,
    resolveRandomizedMinSide,
    randomizedTruncatedSvd,
    RANDOMIZED_OVERSAMPLING,
    RANDOMIZED_POWER_ITERATIONS,
    RANDOMIZED_SEED,
    DEFAULT_RANDOMIZED_MIN_SIDE,
  },
};
