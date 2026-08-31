/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 272 Wave 0 -- pins sklearn's svd_flip sign convention, RED by design.
 *
 * PYPORT-01. Resolves RESEARCH.md Assumption A1 ("sklearn 1.8.0's svd_flip uses
 * the max-absolute-value-in-column sign rule" -- flagged as UNVERIFIED, "asserted
 * from training knowledge, not read from installed source").
 *
 * VERIFIED LIVE THIS SESSION against the sklearn 1.8.0 actually installed on
 * this machine:
 *
 *   $ python3 -c "import sklearn.decomposition._truncated_svd as m, inspect; \
 *       print(inspect.getsource(m))"
 *
 * shows TruncatedSVD.fit_transform calls svd_flip(U, VT, u_based_decision=False)
 * at BOTH call sites (the algorithm=='arpack' branch and the algorithm==
 * 'randomized' branch) -- sklearn/decomposition/_truncated_svd.py:235,252 (the
 * exact line numbers as read from the installed package this session).
 *
 *   $ python3 -c "import inspect; from sklearn.utils.extmath import svd_flip; \
 *       print(inspect.getsource(svd_flip))"
 *
 * shows the u_based_decision=False branch's EXACT rule (sklearn/utils/extmath.py,
 * read live this session):
 *
 *   else:
 *       # rows of v, columns of u
 *       max_abs_v_rows = xp.argmax(xp.abs(v), axis=1)
 *       ...
 *       signs = xp.sign(xp.take(xp.reshape(v, (-1,)), indices, axis=0))
 *       ...
 *       v *= signs[:, np.newaxis]
 *
 * In plain terms: THIS IS THE V-ROW RULE, NOT THE U-COLUMN RULE Assumption A1
 * flagged as unverified. For EACH ROW of V (= svd.components_ once flipped),
 * find the COLUMN index of the entry with the largest ABSOLUTE value in that
 * row. Take the SIGN of that entry. Multiply every entry in the row by that
 * sign (so a negative dominant entry flips the whole row; a positive dominant
 * entry leaves the row unchanged). u_based_decision=False means U is NOT
 * consulted for this decision at all -- V (components_) alone decides.
 *
 * lib/core/numeric/svd.cjs (272-05) MUST implement exactly this V-row
 * argmax-abs rule -- not the U-column rule, not a re-derived approximation.
 * This test file is RED until lib/core/numeric/svd.cjs exists and exports a
 * function named `svdFlip` (the exact name 272-05 MUST use so this test can
 * bind to it -- see the require() below).
 *
 * The fixture matrix and its expected sklearn output (Assert 2/3 below) were
 * generated this session via:
 *
 *   TruncatedSVD(n_components=2, algorithm='arpack', random_state=0).fit(X)
 *
 * against a hand-picked 4-document x 5-term TF-IDF-shaped matrix (values in
 * [0,1]). ARPACK, not randomized -- per Pitfall 1, randomized SVD has not
 * converged at rs_math.py's n_iter=10 and is not reproducible baseline
 * material; arpack is deterministic and is the correct algorithm to pin a
 * sign rule against.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SVD_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'numeric', 'svd.cjs');

let svdModule;
try {
  // eslint-disable-next-line global-require
  svdModule = require(SVD_MODULE_PATH);
} catch (_e) {
  svdModule = null;
}

// The 4x5 fixture matrix. Row 2 ("cat"-heavy row analog) has a clearly
// dominant entry so the components derived from it are non-degenerate.
const FIXTURE_X = [
  [0.10, 0.80, 0.05, 0.00, 0.10],
  [0.00, 0.05, 0.85, 0.05, 0.05],
  [0.70, 0.10, 0.05, 0.10, 0.05],
  [0.05, 0.05, 0.05, 0.80, 0.05],
];

// Ground truth: python3 TruncatedSVD(n_components=2, algorithm='arpack',
// random_state=0).fit(FIXTURE_X).components_ -- the SIGN-FLIPPED (final,
// post-svd_flip) output sklearn actually returns. Rounded to 6 decimals.
const EXPECTED_COMPONENTS = [
  [0.386374, 0.539633, 0.572074, 0.463801, 0.130888],
  [-0.370884, -0.482877, 0.787275, -0.089429, -0.038401],
];

// Ground truth: the RAW (pre-flip) arpack VT for the same fixture, read
// live this session, used to prove the flip and no-flip branches both fire.
// Row 0's raw dominant entry (index 2, value -0.572074) is NEGATIVE -> flip
// fires (row negated). Row 1's raw dominant entry (index 2, value 0.787275)
// is POSITIVE -> flip does NOT fire (row unchanged).
const RAW_UNFLIPPED_VT = [
  [-0.386374, -0.539633, -0.572074, -0.463801, -0.130888],
  [-0.370884, -0.482877, 0.787275, -0.089429, -0.038401],
];

const TOL = 1e-6;

function assertClose(actual, expected, msg) {
  assert.ok(
    Math.abs(actual - expected) < TOL,
    `${msg}: expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`
  );
}

async function main() {
  // Assert 1: the module exists and exports the exact name this test binds
  // to. RED today: lib/core/numeric/svd.cjs does not exist until 272-05.
  assert.ok(
    svdModule !== null,
    'lib/core/numeric/svd.cjs does not exist yet (expected until plan 272-05 lands) -- ' +
      'this test is RED by design for Phase 272 Wave 0'
  );
  assert.ok(
    typeof svdModule.svdFlip === 'function',
    'lib/core/numeric/svd.cjs MUST export a function named svdFlip(rawVRows) -- ' +
      'see this file header for the exact name contract'
  );

  // Assert 2: applying the pinned V-row argmax-abs rule to the RAW unflipped
  // VT reproduces sklearn's actual post-flip components_ exactly (within
  // float tolerance). At least one row (row 0) required a flip relative to
  // its raw output, so this cannot pass vacuously on an already-positive
  // matrix.
  const flipped = svdModule.svdFlip(RAW_UNFLIPPED_VT);
  assert.equal(flipped.length, EXPECTED_COMPONENTS.length, 'row count mismatch');
  let anyRowFlipped = false;
  for (let r = 0; r < EXPECTED_COMPONENTS.length; r += 1) {
    for (let c = 0; c < EXPECTED_COMPONENTS[r].length; c += 1) {
      assertClose(flipped[r][c], EXPECTED_COMPONENTS[r][c], `row ${r} col ${c}`);
    }
    const rawDominantSign = Math.sign(RAW_UNFLIPPED_VT[r][2]);
    const flippedDominantSign = Math.sign(flipped[r][2]);
    if (rawDominantSign !== flippedDominantSign) anyRowFlipped = true;
  }
  assert.ok(
    anyRowFlipped,
    'at least one component must have required a sign flip relative to its raw ' +
      'arpack output -- otherwise this test would pass vacuously on an ' +
      'already-positive matrix (see Pitfall 2)'
  );

  // Assert 3 (negative case): row 1's pre-flip dominant entry (index 2,
  // value 0.787275) is already positive -- svdFlip must NOT alter this row.
  // The flip is conditional on sign, not an unconditional negation.
  for (let c = 0; c < RAW_UNFLIPPED_VT[1].length; c += 1) {
    assertClose(flipped[1][c], RAW_UNFLIPPED_VT[1][c], `row 1 (no-flip case) col ${c}`);
  }

  console.log('PASS 272-svd-sign');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
