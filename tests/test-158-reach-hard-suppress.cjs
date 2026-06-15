'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-03 -- hard-suppression suite (RJP-04).
 * ============================================================================
 * Proves the chronically-rejected reach is DROPPED from buildReachList's
 * rendered top-K once its REJECT-in-window count reaches N (all four fences
 * passing), and is PRESENT (discounted) at N-1. Deterministic + db-free: all
 * signals injected via the roomState seam.
 *
 * Behaviors (158-03-PLAN <behavior> hard-suppress):
 *   - n>=N, pres>=M, not on a parole turn -> suppressed set contains reach_id
 *     -> ABSENT from buildReachList.
 *   - n=N-1 -> PRESENT + discounted (RJP-04).
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

const N = reader.REJECT_SUPPRESS_THRESHOLD; // 3
const M = reader.MIN_PRESENTATIONS;         // 2
const P = reader.PAROLE_PERIOD;             // 5

const FIXED_SCORES = {
  deep_research: 0.9,
  hats: 0.8,
  context_block: 0.7,
  brain_consult: 0.6,
  contradiction: 0.5,
  cross_room: 0.4,
};

// A presentations count that meets M but is NOT on a parole boundary (so the P
// fence does not re-admit). M=2, P=5 -> pres=4 meets M and 4 % 5 !== 0.
const PRES_NOT_PAROLE = 4;
assert.ok(PRES_NOT_PAROLE >= M && PRES_NOT_PAROLE % P !== 0,
  'fixture invariant: pres meets M and is not a parole turn');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-158-reach-hard-suppress.cjs (RJP-04): drop at >= N within W, present at N-1');

// ---------------------------------------------------------------------------
// Test 1: at n >= N (all fences pass), isHardSuppressed is true and
// computeReachPenalties collects the reach_id.
// ---------------------------------------------------------------------------
check('n >= N with all fences passing -> isHardSuppressed true + in suppressedReachIds', () => {
  const roomState = {
    reachScores: Object.assign({}, FIXED_SCORES),
    rejectCountInWindow: { deep_research: N }, // exactly N
    presentationsCount: { deep_research: PRES_NOT_PAROLE },
  };
  assert.strictEqual(
    reader.isHardSuppressed(null, 'deep_research', roomState), true,
    'a reach at >= N within W (M met, not parole) must be hard-suppressed'
  );
  const pen = reader.computeReachPenalties(null, roomState);
  assert.ok(
    pen.suppressedReachIds.indexOf('deep_research') !== -1,
    'computeReachPenalties must collect the suppressed reach_id'
  );
});

// ---------------------------------------------------------------------------
// Test 2: the suppressed reach is ABSENT from buildReachList's rendered set.
// ---------------------------------------------------------------------------
check('the suppressed reach_id is ABSENT from buildReachList (dropped before sort + gate)', () => {
  const roomState = {
    reachScores: Object.assign({}, FIXED_SCORES),
    rejectCountInWindow: { deep_research: N },
    presentationsCount: { deep_research: PRES_NOT_PAROLE },
  };
  const pen = reader.computeReachPenalties(null, roomState);
  const folded = Object.assign({}, FIXED_SCORES, pen.discountedScores);
  const list = orchestrator.buildReachList({
    tierMode: 'mode_a',
    reachScores: folded,
    suppressedReachIds: pen.suppressedReachIds,
  });
  const present = list.reaches.some((r) => r.reach_id === 'deep_research');
  assert.strictEqual(present, false, 'deep_research must be DROPPED from the rendered set');
  // total_count shrinks honestly: 6 - 1 = 5; the bank is still 6 (frozen) but
  // this turn renders 5.
  assert.strictEqual(list.total_count, 5, 'total_count honestly reflects the post-drop bank; got ' + list.total_count);
});

// ---------------------------------------------------------------------------
// Test 3: at N-1 the reach is PRESENT and discounted (RJP-04 boundary).
// ---------------------------------------------------------------------------
check('at N-1 the reach is PRESENT and discounted (not dropped)', () => {
  const roomState = {
    reachScores: Object.assign({}, FIXED_SCORES),
    rejectCountInWindow: { deep_research: N - 1 }, // 2
    presentationsCount: { deep_research: PRES_NOT_PAROLE },
  };
  assert.strictEqual(
    reader.isHardSuppressed(null, 'deep_research', roomState), false,
    'at N-1 the reach must NOT be hard-suppressed'
  );
  const pen = reader.computeReachPenalties(null, roomState);
  assert.deepStrictEqual(pen.suppressedReachIds, [], 'no reach suppressed at N-1');
  assert.ok(
    pen.discountedScores.deep_research < FIXED_SCORES.deep_research,
    'at N-1 the reach is discounted below its base'
  );

  const folded = Object.assign({}, FIXED_SCORES, pen.discountedScores);
  const list = orchestrator.buildReachList({
    tierMode: 'mode_a',
    reachScores: folded,
    suppressedReachIds: pen.suppressedReachIds,
  });
  const present = list.reaches.some((r) => r.reach_id === 'deep_research');
  assert.strictEqual(present, true, 'at N-1 the reach stays PRESENT (discounted)');
});

console.log('');
console.log('PASS test-158-reach-hard-suppress.cjs (' + passed + ' checks)');
process.exit(0);
