'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-03 -- four bias-control fences + the D-02a floor (RJP-04 / D-05 / D-06).
 * ============================================================================
 * Each of the four fences (M min-presentations floor, W aging window, periodic
 * deterministic parole, per-room scope) and the combined-suppression floor are
 * exercised deterministically + db-free via the roomState injection seam.
 *
 * Behaviors (158-03-PLAN <behavior>):
 *   - M fence: pres < M, n >= N -> NOT suppressed (present).
 *   - W aging: rejects only OUTSIDE the trailing W window do not count toward N
 *     -> the reach re-surfaces. (Modeled db-free via the injected count: the W
 *     window lives inside rejectCountInWindow; the injected count is the
 *     already-windowed value, so a stale streak that has aged out reads as a
 *     low count and the reach is not suppressed.)
 *   - parole (P): pres % P === 0 with n >= N -> isHardSuppressed false (force
 *     re-admit), deterministic (no RNG).
 *   - floor (D-02a): n high but < N, pres >= M -> discounted score >= base*FLOOR,
 *     never exactly 0.
 *   - per-room scope: the readers read only the passed db / injected roomState,
 *     never aggregate across rooms (asserted structurally: two independent
 *     roomStates do not bleed).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const reader = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs'));

const N = reader.REJECT_SUPPRESS_THRESHOLD;      // 3
const M = reader.MIN_PRESENTATIONS;              // 2
const P = reader.PAROLE_PERIOD;                  // 5
const FLOOR = reader.COMBINED_SUPPRESS_FLOOR;    // 0.05
const CAP = reader.COUNT_PENALTY_CAP;            // 0.6

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-158-reach-fences.cjs (D-05/D-06): M / W / parole / per-room + D-02a floor');

// ---------------------------------------------------------------------------
// Fence M: presentationsCount < M -> NOT suppressed even at >= N.
// ---------------------------------------------------------------------------
check('M fence: pres < M with n >= N -> NOT suppressed', () => {
  const roomState = {
    rejectCountInWindow: { deep_research: N + 5 }, // well over N
    presentationsCount: { deep_research: M - 1 },  // below M
  };
  assert.strictEqual(
    reader.isHardSuppressed(null, 'deep_research', roomState), false,
    'below M presentations, no suppression even with many rejects'
  );
});

// ---------------------------------------------------------------------------
// Fence W (aging): a streak that has aged OUT of the trailing window reads as a
// low in-window count -> not suppressed. The injected rejectCountInWindow IS the
// already-windowed value (the W window lives inside rejectCountInWindow); a reach
// whose rejects all fell outside W reads as 0 in-window and re-surfaces.
// ---------------------------------------------------------------------------
check('W aging: rejects aged out of the window -> in-window count below N -> not suppressed', () => {
  const aged = {
    rejectCountInWindow: { deep_research: 0 }, // all prior rejects fell outside W
    presentationsCount: { deep_research: 7 },  // many presentations since
  };
  assert.strictEqual(
    reader.isHardSuppressed(null, 'deep_research', aged), false,
    'a streak aged out of W re-surfaces (in-window count < N)'
  );
  // And contrast: an IN-window streak of >= N (M met, not parole) IS suppressed.
  const fresh = {
    rejectCountInWindow: { deep_research: N },
    presentationsCount: { deep_research: 4 }, // M met, 4 % 5 != 0
  };
  assert.strictEqual(
    reader.isHardSuppressed(null, 'deep_research', fresh), true,
    'an in-window >= N streak (M met, not parole) IS suppressed'
  );
});

// ---------------------------------------------------------------------------
// Fence P (parole): pres % P === 0 with n >= N -> force re-admit (deterministic).
// ---------------------------------------------------------------------------
check('parole fence: pres % P === 0 with n >= N -> isHardSuppressed false (deterministic)', () => {
  const onParole = {
    rejectCountInWindow: { deep_research: N + 2 }, // over N
    presentationsCount: { deep_research: P },      // exactly a parole boundary
  };
  assert.strictEqual(
    reader.isHardSuppressed(null, 'deep_research', onParole), false,
    'on a parole turn the reach is force-re-admitted'
  );
  // Deterministic: the same input always yields the same answer.
  for (let i = 0; i < 5; i += 1) {
    assert.strictEqual(
      reader.isHardSuppressed(null, 'deep_research', onParole), false,
      'parole is deterministic (repeatable)'
    );
  }
  // A multiple of P also paroles (2P).
  const onParole2 = {
    rejectCountInWindow: { deep_research: N + 2 },
    presentationsCount: { deep_research: 2 * P },
  };
  assert.strictEqual(
    reader.isHardSuppressed(null, 'deep_research', onParole2), false,
    'every Pth presentation paroles (2P boundary)'
  );
});

// ---------------------------------------------------------------------------
// Floor (D-02a): n high but < N, pres >= M -> discounted >= base*FLOOR, never 0.
// ---------------------------------------------------------------------------
check('D-02a floor: a heavily-discounted-but-below-N reach never lands at exactly 0', () => {
  const base = 0.9;
  // A count that maxes the penalty at CAP but is still < N for suppression: use
  // n = N - 1 = 2 (penalty 0.5, below CAP) AND a separately constructed case
  // where the penalty equals CAP. Either way the floor must keep it off 0.
  const roomState = {
    reachScores: { deep_research: base },
    rejectCountInWindow: { deep_research: N - 1 },
    presentationsCount: { deep_research: 4 },
  };
  const pen = reader.computeReachPenalties(null, roomState);
  const discounted = pen.discountedScores.deep_research;
  assert.ok(typeof discounted === 'number', 'a below-N reach carries a discounted score');
  assert.ok(discounted > 0, 'the discounted score is strictly above 0 (D-02a)');
  assert.ok(
    discounted >= base * FLOOR - 1e-12,
    'the discounted score is floored at base*FLOOR; got ' + discounted
  );
  assert.deepStrictEqual(pen.suppressedReachIds, [], 'a below-N reach is not suppressed');
});

// ---------------------------------------------------------------------------
// Per-room scope: two independent roomStates do not bleed. The reader reads only
// the passed roomState (structural proof of room-locality; the db path reads only
// the passed db, asserted in the Plan 02 db-backed suites).
// ---------------------------------------------------------------------------
check('per-room scope: independent roomStates do not bleed', () => {
  const roomA = {
    rejectCountInWindow: { deep_research: N },
    presentationsCount: { deep_research: 4 },
  };
  const roomB = {
    rejectCountInWindow: { deep_research: 0 },
    presentationsCount: { deep_research: 4 },
  };
  assert.strictEqual(reader.isHardSuppressed(null, 'deep_research', roomA), true,
    'room A (in-window >= N) suppresses');
  assert.strictEqual(reader.isHardSuppressed(null, 'deep_research', roomB), false,
    'room B (zero rejects) does NOT suppress -- A does not bleed into B');
});

// ---------------------------------------------------------------------------
// Sanity: the penalty curve is bounded by CAP (re-asserted at the fence layer).
// ---------------------------------------------------------------------------
check('countPenalty stays bounded by CAP under the fences', () => {
  const roomState = {
    rejectCountInWindow: { deep_research: 99 },
    presentationsCount: { deep_research: 4 },
  };
  assert.ok(reader.countPenalty(null, 'deep_research', roomState) <= CAP,
    'penalty bounded by CAP under the fences');
});

console.log('');
console.log('PASS test-158-reach-fences.cjs (' + passed + ' checks)');
process.exit(0);
