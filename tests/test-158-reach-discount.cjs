'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-03 -- bounded reach discount suite (RJP-02 / RJP-03).
 * ============================================================================
 * Proves the bounded countPenalty discount on the reach surface, db-free and
 * deterministic (no RNG, no live Brain): the discount is injected entirely via
 * the roomState seam (roomState.reachScores + roomState.rejectCountInWindow +
 * roomState.presentationsCount), so every assertion is a pure function of the
 * injected numbers.
 *
 * Behaviors (158-03-PLAN <behavior> discount):
 *   - countPenalty(n=2, pres=5) is in (0, CAP]; the discounted score is strictly
 *     lower than the base; n=0 -> penalty 0 -> identical buildReachList output.
 *   - byte-stable-at-zero: buildReachList(fixed reachScores, no suppression /
 *     no penalty) === captured baseline (deep-equal / JSON byte compare).
 *   - the discount never exceeds CAP.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const reader = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));

const CAP = reader.COUNT_PENALTY_CAP;   // 0.6
const N = reader.REJECT_SUPPRESS_THRESHOLD; // 3

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-158-reach-discount.cjs (RJP-02/03): bounded countPenalty, byte-stable at zero');

// A fixed reachScores prior used across the byte-stable comparisons.
const FIXED_SCORES = {
  deep_research: 0.9,
  hats: 0.8,
  context_block: 0.7,
  brain_consult: 0.6,
  contradiction: 0.5,
  cross_room: 0.4,
};

// ---------------------------------------------------------------------------
// Test 1: countPenalty(n=2, pres=5) is in (0, CAP] and discounts the score.
// ---------------------------------------------------------------------------
check('countPenalty(n=2, pres met) is in (0, CAP] and lowers the score below base', () => {
  const roomState = {
    rejectCountInWindow: { deep_research: 2 },
    presentationsCount: { deep_research: 5 },
  };
  const cp = reader.countPenalty(null, 'deep_research', roomState);
  assert.ok(cp > 0, 'penalty must be > 0 when there are rejects and M is met; got ' + cp);
  assert.ok(cp <= CAP, 'penalty must never exceed CAP=' + CAP + '; got ' + cp);
  // n/(N+1) = 2/4 = 0.5 (below CAP), so the discount is exactly 0.5.
  assert.strictEqual(cp, 2 / (N + 1), 'countPenalty must be n/(N+1) below CAP; got ' + cp);

  const base = 0.9;
  const discounted = base * (1 - cp);
  assert.ok(discounted < base, 'discounted score must be strictly below base');
});

// ---------------------------------------------------------------------------
// Test 2: the discount never exceeds CAP even at a high (still < N suppress) count.
// ---------------------------------------------------------------------------
check('countPenalty is bounded by CAP at a high reject count', () => {
  // n large enough that n/(N+1) would exceed CAP -> clamped to CAP.
  const roomState = {
    rejectCountInWindow: { hats: 100 },
    presentationsCount: { hats: 5 },
  };
  const cp = reader.countPenalty(null, 'hats', roomState);
  assert.strictEqual(cp, CAP, 'a large reject count clamps the penalty to CAP=' + CAP + '; got ' + cp);
});

// ---------------------------------------------------------------------------
// Test 3: M fence -- presentations below M yields zero penalty even with rejects.
// ---------------------------------------------------------------------------
check('countPenalty is 0 when presentationsCount < M (the noise fence)', () => {
  const roomState = {
    rejectCountInWindow: { deep_research: 2 },
    presentationsCount: { deep_research: 1 }, // below M=2
  };
  const cp = reader.countPenalty(null, 'deep_research', roomState);
  assert.strictEqual(cp, 0, 'below M, the penalty is 0; got ' + cp);
});

// ---------------------------------------------------------------------------
// Test 4: byte-stable at zero -- zero rejects -> countPenalty 0 -> identical list.
// computeReachPenalties on a zero-reject roomState yields an identity fold:
// discountedScores === base for each reach, suppressedReachIds empty. The folded
// reachScores produce a buildReachList output byte-identical to the no-penalty
// baseline (the same FIXED_SCORES with no suppression).
// ---------------------------------------------------------------------------
check('byte-stable at zero rejects: folded list === no-penalty baseline (JSON byte compare)', () => {
  const baseline = orchestrator.buildReachList({
    tierMode: 'mode_a',
    reachScores: Object.assign({}, FIXED_SCORES),
  });

  // Zero rejections for every reach; some presentations (so M would be met if
  // there were rejects -- proving the zero-penalty is driven by zero rejects,
  // not by the M fence).
  const zeroReject = {
    reachScores: Object.assign({}, FIXED_SCORES),
    rejectCountInWindow: {
      deep_research: 0, hats: 0, context_block: 0,
      brain_consult: 0, contradiction: 0, cross_room: 0,
    },
    presentationsCount: {
      deep_research: 5, hats: 5, context_block: 5,
      brain_consult: 5, contradiction: 5, cross_room: 5,
    },
  };
  const pen = reader.computeReachPenalties(null, zeroReject);
  assert.deepStrictEqual(pen.suppressedReachIds, [], 'zero rejects -> no suppression');

  // Fold the (identity) discount over the base scores and rebuild.
  const folded = Object.assign({}, FIXED_SCORES);
  Object.assign(folded, pen.discountedScores);
  const foldedList = orchestrator.buildReachList({
    tierMode: 'mode_a',
    reachScores: folded,
    suppressedReachIds: pen.suppressedReachIds,
  });

  assert.strictEqual(
    JSON.stringify(foldedList),
    JSON.stringify(baseline),
    'zero-reject folded reach list must be byte-identical to the no-penalty baseline'
  );
});

// ---------------------------------------------------------------------------
// Test 5: below N, a discounted reach is PRESENT with a strictly lower score
// than its zero-reject self, via the full computeReachPenalties -> buildReachList
// path (the production fold shape).
// ---------------------------------------------------------------------------
check('below N: discounted reach is present and strictly lower than its zero-reject self', () => {
  const withReject = {
    reachScores: Object.assign({}, FIXED_SCORES),
    rejectCountInWindow: { deep_research: 2 }, // 2 < N=3
    presentationsCount: { deep_research: 5 },
  };
  const pen = reader.computeReachPenalties(null, withReject);
  assert.deepStrictEqual(pen.suppressedReachIds, [], '2 rejects (< N) must NOT suppress');
  assert.ok(
    typeof pen.discountedScores.deep_research === 'number',
    'deep_research must carry a discounted score'
  );
  assert.ok(
    pen.discountedScores.deep_research < FIXED_SCORES.deep_research,
    'discounted deep_research must be strictly below its base prior'
  );

  const folded = Object.assign({}, FIXED_SCORES, pen.discountedScores);
  const list = orchestrator.buildReachList({
    tierMode: 'mode_a',
    reachScores: folded,
    suppressedReachIds: pen.suppressedReachIds,
  });
  const present = list.reaches.some((r) => r.reach_id === 'deep_research');
  assert.ok(present, 'a below-N reach stays PRESENT (discounted, not dropped)');
});

console.log('');
console.log('PASS test-158-reach-discount.cjs (' + passed + ' checks)');
process.exit(0);
