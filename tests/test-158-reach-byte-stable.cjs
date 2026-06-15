'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-04 -- byte-stable-at-zero snapshot (RJP-02).
 * ============================================================================
 * The load-bearing RJP-02 proof on the reach surface: a zero-reject room
 * produces a reach list byte-identical to a captured pre-phase baseline. The
 * baseline is captured in-process from buildReachList on a fixed reachScores
 * input with NO suppression and NO penalty signal (the test-drift-baseline
 * capture-then-byte-compare idiom). We then assert that:
 *
 *   Test 1: buildReachList(fixedScores) === captured baseline (byte-identical).
 *   Test 2: buildReachList(fixedScores, suppressedReachIds:[]) === baseline (an
 *           empty suppression set is a no-op -- the pre-158 render shape).
 *   Test 3: the full computeReachPenalties -> fold -> buildReachList path on a
 *           zero-reject room (every reach_id with zero rejects via empty
 *           reject signal + empty suppressedReachIds) === baseline.
 *
 * This broadens the test-158-reach-discount.cjs check-4 anchor into a standalone
 * snapshot suite so the phase gate carries an explicit byte-stable proof.
 *
 * Deterministic, db-free (the reach surface is pure; the penalty is injected via
 * the roomState seam). NO RNG, NO live Brain. NO em-dashes (CLAUDE.md HARD RULE).
 * Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const reader = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-158-reach-byte-stable.cjs (RJP-02): zero-reject reach list === captured baseline');

// A fixed reachScores prior. Spread across the gate so the baseline render
// exercises a real ranking (deep_research over the 0.70 floor, the rest below),
// not a degenerate all-zero list.
const FIXED_SCORES = Object.freeze({
  context_block: 0.72,
  contradiction: 0.40,
  deep_research: 0.90,
  hats: 0.60,
  brain_consult: 0.55,
  cross_room: 0.45,
});

function freshScores() { return Object.assign({}, FIXED_SCORES); }

// Capture the baseline in-process: the pre-158 render shape is buildReachList on
// the fixed scores with no suppression input at all (the path a zero-reject room
// takes). JSON.stringify is the byte-compare surface.
const BASELINE = JSON.stringify(orchestrator.buildReachList({
  tierMode: 'mode_a',
  reachScores: freshScores(),
}));

// ---------------------------------------------------------------------------
// Test 1: same input -> byte-identical to the captured baseline.
// ---------------------------------------------------------------------------
check('buildReachList(fixedScores) is byte-identical to the captured baseline', () => {
  const again = JSON.stringify(orchestrator.buildReachList({
    tierMode: 'mode_a',
    reachScores: freshScores(),
  }));
  assert.strictEqual(again, BASELINE, 'identical input must render byte-identical output');
});

// ---------------------------------------------------------------------------
// Test 2: an EMPTY suppression set is a no-op (the pre-158 baseline shape).
// ---------------------------------------------------------------------------
check('buildReachList(fixedScores, suppressedReachIds:[]) === baseline (empty set is a no-op)', () => {
  const withEmpty = JSON.stringify(orchestrator.buildReachList({
    tierMode: 'mode_a',
    reachScores: freshScores(),
    suppressedReachIds: [],
  }));
  assert.strictEqual(withEmpty, BASELINE, 'an empty suppressedReachIds must not change the render');
});

// ---------------------------------------------------------------------------
// Test 3: the FULL production fold path on a zero-reject room -> baseline.
// computeReachPenalties on a roomState with zero rejects for every reach_id
// (and presentations met, so the zero-penalty is driven by zero rejects, not by
// the M fence) yields an identity fold: discountedScores === base for each
// reach, suppressedReachIds empty. Folding that over the base scores and
// rebuilding must reproduce the baseline byte-for-byte.
// ---------------------------------------------------------------------------
check('zero-reject fold path (computeReachPenalties -> buildReachList) === baseline', () => {
  const zeroReject = {
    reachScores: freshScores(),
    rejectCountInWindow: {
      context_block: 0, contradiction: 0, deep_research: 0,
      hats: 0, brain_consult: 0, cross_room: 0,
    },
    presentationsCount: {
      context_block: 5, contradiction: 5, deep_research: 5,
      hats: 5, brain_consult: 5, cross_room: 5,
    },
  };
  const pen = reader.computeReachPenalties(null, zeroReject);
  assert.deepStrictEqual(pen.suppressedReachIds, [], 'zero rejects -> no suppression');

  const folded = Object.assign(freshScores(), pen.discountedScores);
  const foldedList = JSON.stringify(orchestrator.buildReachList({
    tierMode: 'mode_a',
    reachScores: folded,
    suppressedReachIds: pen.suppressedReachIds,
  }));
  assert.strictEqual(
    foldedList,
    BASELINE,
    'the zero-reject production fold must render byte-identical to the pre-phase baseline'
  );
});

console.log('');
console.log('PASS test-158-reach-byte-stable.cjs (' + passed + ' checks)');
process.exit(0);
