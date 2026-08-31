/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 272 Wave 0 -- pins classify_direction's Convention A exactly, RED by
 * design.
 *
 * PYPORT-01. Ports lib/core/rs_math.py:242-252 (classify_direction) verbatim,
 * including the <= 0 bucketing into semantic_implementation. Convention A:
 *
 *   signed_diff > 0  -> structural_transfer      (different keywords, similar meaning)
 *   signed_diff <= 0 -> semantic_implementation  (same keywords, different meaning)
 *
 * This is Convention A (rs-math.cjs's convention), the OPPOSITE sign
 * bucketing from Convention B (hsi-lsa.cjs's convention, see
 * tests/272-hsi-lsa-algorithm.test.cjs) -- rs_math.py's classify_direction
 * inspects (semantic - lsa), while compute-hsi.py's inline classification at
 * scripts/compute-hsi.py:748-751 inspects (lsa > sem), an inverted test on a
 * differently-signed quantity. Per PATTERNS.md Convention #8, these two MUST
 * NOT be unified into one shared helper.
 *
 * Gates lib/core/rs-math.cjs (272-06), which does not exist yet.
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

// Table-driven per rs_math.py:242-252. The 0.0 case is the one RESEARCH.md
// explicitly calls out: it buckets into semantic_implementation via the <= 0
// branch, NOT a separate zero-case label.
const CASES = [
  { signedDiff: 0.5, expected: 'structural_transfer' },
  { signedDiff: -0.5, expected: 'semantic_implementation' },
  { signedDiff: 0.0, expected: 'semantic_implementation' },
];

async function main() {
  assert.ok(
    rsMathModule !== null,
    'lib/core/rs-math.cjs does not exist yet (expected until plan 272-06 lands) -- ' +
      'this test is RED by design for Phase 272 Wave 0'
  );
  assert.ok(
    typeof rsMathModule.classifyDirection === 'function',
    'lib/core/rs-math.cjs MUST export a function named classifyDirection(signedDiff)'
  );

  for (const { signedDiff, expected } of CASES) {
    // Accepts a plain JS number, not a wrapped object -- calling the
    // function directly on a bare number proves this without a separate
    // assertion.
    const actual = rsMathModule.classifyDirection(signedDiff);
    assert.equal(
      actual,
      expected,
      `classifyDirection(${signedDiff}) expected '${expected}', got '${actual}' ` +
        '(Convention A: > 0 -> structural_transfer, <= 0 -> semantic_implementation)'
    );
  }

  // Explicitly re-assert the <= 0 bucket for the exact-zero case, since it is
  // the one RESEARCH.md flags as easy to get wrong (a naive port might treat
  // 0.0 as its own case or as > 0 due to floating rounding).
  assert.equal(
    rsMathModule.classifyDirection(0.0),
    'semantic_implementation',
    'signed_diff === 0.0 MUST bucket into semantic_implementation via the <= 0 branch, ' +
      'not a separate zero case'
  );

  console.log('PASS 272-direction-convention');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
