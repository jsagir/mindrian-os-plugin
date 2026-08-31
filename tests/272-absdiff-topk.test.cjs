/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 272 Wave 0 -- pins abs_diff_topk's upper-triangle / symmetric-cleanup
 * / k-clamping semantics, RED by design.
 *
 * PYPORT-01. Ports lib/core/rs_math.py:176-235 (abs_diff_topk) faithfully.
 * Gates lib/core/rs-math.cjs (272-06), which does not exist yet.
 *
 * Fixture ground truth computed live this session by re-implementing the
 * exact Python algorithm (rs_math.py:176-235) in a throwaway python3 script
 * and running it against the fixed 4x4 matrices below -- not guessed.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RS_MATH_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'rs-math.cjs');

let rsMathModule;
try {
  // eslint-disable-next-line global-require
  rsMathModule = require(RS_MATH_MODULE_PATH);
} catch (_e) {
  rsMathModule = null;
}

const TOL = 1e-9;

// Fixed 4x4 symmetric matrices, diagonal 1.0, values in [0,1]. No off-diagonal
// signed_diff (sem - lsa) is exactly zero, so all n*(n-1)/2 = 6 upper-triangle
// pairs are guaranteed to be selected by an unbounded-k request -- this
// deliberately avoids the abs_diff<=0.0 early-break edge case for the k=100
// assertion below.
const LSA = [
  [1.0, 0.20, 0.55, 0.30],
  [0.20, 1.0, 0.15, 0.60],
  [0.55, 0.15, 1.0, 0.45],
  [0.30, 0.60, 0.45, 1.0],
];
const SEM = [
  [1.0, 0.70, 0.50, 0.90],
  [0.70, 1.0, 0.25, 0.10],
  [0.50, 0.25, 1.0, 0.40],
  [0.90, 0.10, 0.40, 1.0],
];

// Ground truth: full unbounded (k=1000) run, in the exact iterative-argmax
// order the algorithm produces (largest abs_diff first).
const EXPECTED_FULL_RESULTS = [
  { i: 0, j: 3, signedDiff: 0.6, absDiff: 0.6 },
  { i: 1, j: 3, signedDiff: -0.5, absDiff: 0.5 },
  { i: 0, j: 1, signedDiff: 0.5, absDiff: 0.5 },
  { i: 1, j: 2, signedDiff: 0.1, absDiff: 0.1 },
  { i: 0, j: 2, signedDiff: -0.05, absDiff: 0.05 },
  { i: 2, j: 3, signedDiff: -0.05, absDiff: 0.05 },
];

function assertResultsClose(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: length mismatch`);
  for (let k = 0; k < expected.length; k += 1) {
    const a = actual[k];
    const e = expected[k];
    assert.equal(a.i, e.i, `${label}[${k}].i`);
    assert.equal(a.j, e.j, `${label}[${k}].j`);
    assert.ok(Math.abs(a.signedDiff - e.signedDiff) < TOL, `${label}[${k}].signedDiff`);
    assert.ok(Math.abs(a.absDiff - e.absDiff) < TOL, `${label}[${k}].absDiff`);
  }
}

async function main() {
  assert.ok(
    rsMathModule !== null,
    'lib/core/rs-math.cjs does not exist yet (expected until plan 272-06 lands) -- ' +
      'this test is RED by design for Phase 272 Wave 0'
  );
  assert.ok(
    typeof rsMathModule.absDiffTopk === 'function',
    'lib/core/rs-math.cjs MUST export a function named absDiffTopk(lsa, semantic, opts)'
  );

  // (a) skip_diagonal=true: no (i,i) pair is ever returned, plus full
  // unbounded ordering matches the hand-verified Python trace exactly.
  const full = rsMathModule.absDiffTopk(LSA, SEM, { k: 1000, skipDiagonal: true });
  for (const pair of full) {
    assert.notEqual(pair.i, pair.j, 'skip_diagonal=true must never return an (i,i) pair');
  }
  assertResultsClose(full, EXPECTED_FULL_RESULTS, 'unbounded k=1000');

  // (b) requesting k larger than n*(n-1)/2 (here 6) returns at most 6
  // results, never throws.
  const overK = rsMathModule.absDiffTopk(LSA, SEM, { k: 100, skipDiagonal: true });
  assert.ok(overK.length <= 6, 'k=100 on a 4x4 matrix must return at most 6 pairs');
  assert.equal(overK.length, 6, 'this fixture has no zero-diff pairs, so all 6 must be returned');

  // (c) once (i,j) is selected, (j,i) never separately appears (symmetric
  // cleanup) -- verified structurally: every returned pair has i < j.
  for (const pair of full) {
    assert.ok(pair.i < pair.j, `symmetric cleanup: pair (${pair.i},${pair.j}) must have i < j`);
  }

  // (d) each returned tuple's signed_diff equals semantic[i][j] - lsa[i][j]
  // exactly (not lsa - semantic).
  for (const pair of full) {
    const expectedSignedDiff = SEM[pair.i][pair.j] - LSA[pair.i][pair.j];
    assert.ok(
      Math.abs(pair.signedDiff - expectedSignedDiff) < TOL,
      `signed_diff for (${pair.i},${pair.j}) must be semantic - lsa, not lsa - semantic`
    );
  }

  // (e) a k=0 request returns an empty array.
  const zeroK = rsMathModule.absDiffTopk(LSA, SEM, { k: 0, skipDiagonal: true });
  assert.deepEqual(zeroK, [], 'k=0 must return an empty array');

  // (f) a 1x1 or 0x0 input returns an empty array without throwing (n < 2 guard).
  const oneByOne = rsMathModule.absDiffTopk([[1.0]], [[1.0]], { k: 5, skipDiagonal: true });
  assert.deepEqual(oneByOne, [], '1x1 input must return an empty array, not throw');

  const zeroByZero = rsMathModule.absDiffTopk([], [], { k: 5, skipDiagonal: true });
  assert.deepEqual(zeroByZero, [], '0x0 input must return an empty array, not throw');

  console.log('PASS 272-absdiff-topk');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
