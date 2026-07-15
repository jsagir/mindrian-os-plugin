'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-02 -- rankFiredCandidates ordering semantics (Req 1, module level).
 * ============================================================================
 * Six checks pin the shared selection contract against the REAL module exports
 * (db-free, via the roomState injection seams):
 *   1. SCORE ORDER: two fired candidates come back in combined-score order, not
 *      the input (registry) order, when a real D4 score separates them.
 *   2. ZERO/ONE PASSTHROUGH: [] and [one] return the SAME array reference
 *      (byte-identity per SPEC Req 1 acceptance -- no reads, no side effects).
 *   3. FLAT-FLOOR OUTCOME TIE-BREAK: with no cortex nodes and no reachScores
 *      (the real MCP condition, every D4 = 0.5), the injected Phase-158 reject
 *      discount on the registry-FIRST candidate makes the SECOND win -- proving
 *      the outcome layer breaks the flat-floor tie, no silent registry revert.
 *   4. STABILITY: identical combined scores preserve input order.
 *   5. SHAPE: returned objects are the same references with keys untouched.
 *   6. SOFT-FAIL: a roomState whose cortexNodes getter throws still returns the
 *      input array unchanged (the hot-path guard).
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-hedge-ranker.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// Fixture candidates: plain reach objects matching dispatchSensors' output shape.
function reach(reachId) {
  return { reach_id: reachId, posture: 'suggest' };
}

console.log('test-222-rank-fired.cjs: rankFiredCandidates ordering semantics (Req 1)');

// ---------------------------------------------------------------------------
// (1) SCORE ORDER -- the higher D4 score wins over input order.
// ---------------------------------------------------------------------------
check('(1) score order: context_block (0.9) sorts ahead of deep_research (0.3)', () => {
  const fired = [reach('deep_research'), reach('context_block')];
  const out = ranker.rankFiredCandidates(fired, {
    reachScores: { context_block: 0.9, deep_research: 0.3 },
    hedgeWeights: { d4_blend: 1, registry_order: 0 },
  });
  assert.strictEqual(out[0].reach_id, 'context_block',
    'the higher-D4 candidate must lead, not the input order; got ' + out[0].reach_id);
  assert.strictEqual(out[1].reach_id, 'deep_research', 'the lower-D4 candidate must trail');
});

// ---------------------------------------------------------------------------
// (2) ZERO/ONE PASSTHROUGH -- same reference, byte-identical.
// ---------------------------------------------------------------------------
check('(2) 0/1 candidates return the SAME array reference (byte-identity)', () => {
  const empty = [];
  assert.strictEqual(ranker.rankFiredCandidates(empty, {}), empty, '[] must pass through by reference');
  const one = [reach('hats')];
  assert.strictEqual(ranker.rankFiredCandidates(one, {}), one, '[one] must pass through by reference');
});

// ---------------------------------------------------------------------------
// (3) FLAT-FLOOR OUTCOME TIE-BREAK -- the outcome layer breaks the 0.5 tie.
// ---------------------------------------------------------------------------
check('(3) flat-floor: a heavy reject discount on the registry-first candidate lets the second win', () => {
  // No reachScores, no cortexNodes -> every D4 = 0.5 (the MCP condition). The
  // registry-first candidate (context_block, index 0) carries a heavy injected
  // Phase-158 reject discount; the outcome layer must break the tie for the second.
  const fired = [reach('context_block'), reach('contradiction')];
  const out = ranker.rankFiredCandidates(fired, {
    hedgeWeights: { d4_blend: 0.9, registry_order: 0.1 },
    // Phase 158 injection seams reach-reject-reader honors db-free:
    rejectCountInWindow: { context_block: 4 },
    presentationsCount: { context_block: 5 },
  });
  assert.strictEqual(out[0].reach_id, 'contradiction',
    'the outcome layer must break the flat-floor tie for the second candidate; got ' + out[0].reach_id);
});

// ---------------------------------------------------------------------------
// (4) STABILITY -- identical combined scores keep input order.
// ---------------------------------------------------------------------------
check('(4) stability: equal combined scores preserve input order', () => {
  const x = reach('hats');
  const y = reach('cross_room');
  const out = ranker.rankFiredCandidates([x, y], {
    // No reachScores -> both D4 = 0.5; registry_order weight 0 -> combined equal.
    hedgeWeights: { d4_blend: 1, registry_order: 0 },
  });
  assert.strictEqual(out[0], x, 'a tie must keep the first input first');
  assert.strictEqual(out[1], y, 'a tie must keep the second input second');
});

// ---------------------------------------------------------------------------
// (5) SHAPE -- same object references, keys untouched.
// ---------------------------------------------------------------------------
check('(5) shape: returned entries are the SAME objects with keys untouched', () => {
  const a = reach('deep_research');
  const b = reach('context_block');
  const out = ranker.rankFiredCandidates([a, b], {
    reachScores: { context_block: 0.9, deep_research: 0.3 },
    hedgeWeights: { d4_blend: 1, registry_order: 0 },
  });
  assert.ok(out.includes(a) && out.includes(b), 'the same object references must be returned');
  for (const item of out) {
    assert.deepStrictEqual(Object.keys(item).sort(), ['posture', 'reach_id'],
      'the reach object shape must be untouched');
  }
});

// ---------------------------------------------------------------------------
// (6) SOFT-FAIL -- a throwing roomState returns the input unchanged.
// ---------------------------------------------------------------------------
check('(6) soft-fail: a throwing cortexNodes getter returns the input array unchanged', () => {
  const fired = [reach('hats'), reach('cross_room')];
  const hostile = {};
  Object.defineProperty(hostile, 'cortexNodes', {
    get() { throw new Error('boom'); },
    enumerable: true,
  });
  const out = ranker.rankFiredCandidates(fired, hostile);
  assert.strictEqual(out, fired, 'an unexpected throw must return the ORIGINAL input array');
});

// ---------------------------------------------------------------------------
// (7) WR-01 -- the live registry signal uses the CANONICAL REACH_IDS rank, not
// the fired array's own turn-relative index, so it is the IDENTICAL feature
// deriveExpertLosses trains against.
// ---------------------------------------------------------------------------
check('(7) WR-01: registry signal is the canonical REACH_IDS rank, not the fired-array\'s turn-relative index', () => {
  // hats (canonical index 5, LAST) fires FIRST this turn; contradiction
  // (canonical index 1) fires SECOND. Pre-fix, the live blend used the fired
  // array's own index (hats=0 -> signal 1, contradiction=1 -> signal 0.5), so
  // hats would have won on a registry-only blend -- the OPPOSITE of what the
  // training-time deriveExpertLosses would ever learn to reward for the same
  // reach_id pair (it always rewards front-of-CANONICAL-registry, i.e.
  // contradiction over hats). Post-fix, both features agree.
  const fired = [reach('hats'), reach('contradiction')];
  const out = ranker.rankFiredCandidates(fired, {
    hedgeWeights: { d4_blend: 0, registry_order: 1 },
  });
  assert.strictEqual(out[0].reach_id, 'contradiction',
    'the canonically-earlier reach (contradiction, index 1) must win the registry-only blend over hats (index 5), got ' + out[0].reach_id);
});

check('(7b) WR-01: canonicalRegistryRank matches REACH_IDS.indexOf for every canonical reach, and floors unknown ids to REACH_IDS.length', () => {
  for (const id of ranker.REACH_IDS) {
    assert.strictEqual(ranker.canonicalRegistryRank(id), ranker.REACH_IDS.indexOf(id),
      'canonicalRegistryRank must equal REACH_IDS.indexOf for a canonical id: ' + id);
  }
  assert.strictEqual(ranker.canonicalRegistryRank('not_a_reach'), ranker.REACH_IDS.length,
    'an off-registry reach_id must floor to REACH_IDS.length, not -1 or Infinity');
});

check('(7c) WR-01: deriveExpertLosses\' endorsementRegistry is the SAME formula rankFiredCandidates now applies', () => {
  // For a valid, on-registry reach_id, 1/(canonicalRegistryRank+1) is exactly
  // what deriveExpertLosses computes as endorsement_registry (accept branch:
  // loss = 1 - endorsement, so recovering endorsement from a reject-decision
  // row's loss is the direct, non-inverted read).
  for (const id of ranker.REACH_IDS) {
    const losses = ranker.deriveExpertLosses({ reach_id: id, decision: 'reject' }, {});
    const expectedEndorsement = 1 / (ranker.canonicalRegistryRank(id) + 1);
    assert.ok(Math.abs(losses.registry_order - expectedEndorsement) < 1e-12,
      'training-time endorsement for ' + id + ' must equal the live registrySignal formula; got ' +
      losses.registry_order + ' vs expected ' + expectedEndorsement);
  }
});

console.log('');
console.log('PASS test-222-rank-fired.cjs (' + passed + ' checks)');
