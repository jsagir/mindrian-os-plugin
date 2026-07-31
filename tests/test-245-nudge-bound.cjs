'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-07 Task 3 -- the F-7 / A3 invariant: the signal fusion is bounded
 * BELOW the frozen 0.70 RECOMMENDED floor, by construction (Requirement 1, D-05,
 * and the navigator-resolved Open Question A3).
 * ============================================================================
 * WHY THIS IS A SWEEP AND NOT THREE SPOT CHECKS.
 *
 * The bound is the one thing standing between this fusion and an unauthorized
 * product behavior change. `buildSignalNudges` raises reach scores. The dial
 * renders a RECOMMENDED marker at `score >= 0.70` (a frozen Canon Part 3
 * constant). If any base-plus-fraction combination can reach that floor, a reach
 * starts wearing a marker it never earned, and the SPEC authorized reordering,
 * not floor-crossing. Three hand-picked examples cannot establish that; a sweep
 * over the whole achievable input space can.
 *
 * FIVE ASSERTIONS:
 *   1. Bound sweep. 21 bases (0.00 .. 1.00 by 0.05) crossed with all 6
 *      achievable fraction cases. Every fused value is either strictly below the
 *      REAL RECOMMEND_FLOOR (imported from the orchestrator, never hardcoded) or
 *      exactly equal to its base (the at-or-above-ceiling passthrough).
 *   2. Monotonicity in both arguments, which is what guarantees the fusion
 *      cannot manufacture a tie AT the ceiling.
 *   3. No-op discipline: absent signal returns {} in every tier mode, which is
 *      what keeps the existing dial render byte-stable.
 *   4. End-to-end gate proof through the REAL buildReachList: the set of
 *      `recommended === true` reaches is IDENTICAL with and without the fusion.
 *      This is the criterion that actually matters. The fusion changes ORDER,
 *      never marker state.
 *   5. Env-override safety: hostile values for MINDRIAN_SENSOR_TOP_FRACTION fall
 *      back to the default and the bound sweep still holds.
 *
 * Self-contained, db-free, no fixtures, no network. Bare `node`, non-zero exit
 * on failure. NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-hedge-ranker.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const cortexAdapter = require(path.join(REPO_ROOT, 'lib', 'hmi', 'cortex-reach-adapter.cjs'));

// Read every threshold off the SHIPPED modules. A future edit to either the
// frozen gate or the fusion constants must redden this test, not slip past it
// because the test carried its own copy of the number (the Phase 185
// no-parallel-reimplementation rule).
const RECOMMEND_FLOOR = orchestrator.RECOMMEND_FLOOR;
const FUSION_CEILING = ranker.FUSION_CEILING;
const NUDGE_FRACTION_CAP = ranker.NUDGE_FRACTION_CAP;
const DEFAULT_FUSION_BASE = ranker.DEFAULT_FUSION_BASE;
const SENSOR_TOP_FRACTION = ranker.SENSOR_TOP_FRACTION;
const SENSOR_OTHER_FRACTION = ranker.SENSOR_OTHER_FRACTION;
const BRAIN_VERB_FRACTION = ranker.BRAIN_VERB_FRACTION;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function reach(reachId) {
  return { reach_id: reachId, posture: 'hold' };
}

// The sweep's subject reach and the verb that names it. 'Spawn Sub-Agent' is one
// of the four canonical verbs with an unambiguous single-reach affinity
// ({ deep_research: 1 }), so a fraction case's expected value is exact rather
// than split. LEAD is a DIFFERENT reach_id, used only to occupy index 0 so
// TARGET receives the OTHER fraction instead of the TOP one.
const TARGET = 'deep_research';
const VERB = 'Spawn Sub-Agent';
const LEAD = 'cross_room';

// The 6 achievable fraction cases. Each builds a real buildSignalNudges input
// for a given base and declares the fraction that input must produce.
const FRACTION_CASES = [
  {
    name: 'sensor-top alone',
    fraction: SENSOR_TOP_FRACTION,
    build: (base) => ({
      baseScores: { [TARGET]: base },
      sensorReaches: [reach(TARGET)],
      brainVerb: null,
      tierMode: 'tier_0',
    }),
  },
  {
    name: 'sensor-other alone',
    fraction: SENSOR_OTHER_FRACTION,
    build: (base) => ({
      baseScores: { [TARGET]: base },
      sensorReaches: [reach(LEAD), reach(TARGET)],
      brainVerb: null,
      tierMode: 'tier_0',
    }),
  },
  {
    name: 'brain-verb alone',
    fraction: BRAIN_VERB_FRACTION,
    build: (base) => ({
      baseScores: { [TARGET]: base },
      sensorReaches: [],
      brainVerb: VERB,
      tierMode: 'mode_a',
    }),
  },
  {
    name: 'sensor-top plus brain-verb',
    fraction: SENSOR_TOP_FRACTION + BRAIN_VERB_FRACTION,
    build: (base) => ({
      baseScores: { [TARGET]: base },
      sensorReaches: [reach(TARGET)],
      brainVerb: VERB,
      tierMode: 'mode_a',
    }),
  },
  {
    name: 'sensor-other plus brain-verb',
    fraction: SENSOR_OTHER_FRACTION + BRAIN_VERB_FRACTION,
    build: (base) => ({
      baseScores: { [TARGET]: base },
      sensorReaches: [reach(LEAD), reach(TARGET)],
      brainVerb: VERB,
      tierMode: 'mode_a',
    }),
  },
  {
    // The NUDGE_FRACTION_CAP maximum. Both tunables forced to their largest
    // accepted value (1) so the raw sum is 2.0 and the cap is the only thing
    // holding it down. This is the worst case an operator can produce without
    // editing source.
    name: 'NUDGE_FRACTION_CAP maximum (both tunables at 1)',
    fraction: NUDGE_FRACTION_CAP,
    env: { MINDRIAN_SENSOR_TOP_FRACTION: '1', MINDRIAN_BRAIN_VERB_FRACTION: '1' },
    build: (base) => ({
      baseScores: { [TARGET]: base },
      sensorReaches: [reach(TARGET)],
      brainVerb: VERB,
      tierMode: 'mode_a',
    }),
  },
];

// The 21 swept bases.
const BASES = [];
for (let i = 0; i <= 20; i += 1) BASES.push(i * 0.05);

// Run one case at one base, honoring the case's env overrides and always
// restoring them (the brain-md-staleness.test.cjs Test 10 env discipline).
function fusedFor(kase, base) {
  const prior = {};
  const env = kase.env || {};
  for (const k of Object.keys(env)) {
    prior[k] = process.env[k];
    process.env[k] = env[k];
  }
  try {
    const out = ranker.buildSignalNudges(kase.build(base));
    return out[TARGET];
  } finally {
    for (const k of Object.keys(env)) {
      if (prior[k] === undefined) delete process.env[k];
      else process.env[k] = prior[k];
    }
  }
}

console.log('test-245-nudge-bound.cjs: the fusion is bounded below the frozen RECOMMENDED floor (Req 1 / A3)');

// ---------------------------------------------------------------------------
// (0) PRECONDITIONS.
// ---------------------------------------------------------------------------
check('(0) preconditions: the ceiling is strictly below the REAL frozen floor and the cap is < 1', () => {
  assert.equal(typeof RECOMMEND_FLOOR, 'number', 'the orchestrator must export RECOMMEND_FLOOR');
  assert.ok(FUSION_CEILING < RECOMMEND_FLOOR,
    'A3 BREACH: FUSION_CEILING (' + FUSION_CEILING + ') must be strictly below RECOMMEND_FLOOR (' +
    RECOMMEND_FLOOR + ')');
  assert.ok(NUDGE_FRACTION_CAP < 1,
    'STRUCTURAL BREACH: NUDGE_FRACTION_CAP (' + NUDGE_FRACTION_CAP + ') must be strictly below 1, or the ' +
    'fusion could land exactly ON the ceiling and tie there');
  assert.ok(SENSOR_TOP_FRACTION + BRAIN_VERB_FRACTION <= NUDGE_FRACTION_CAP,
    'the default max stack must not already exceed the cap');
});

// ---------------------------------------------------------------------------
// (1) BOUND SWEEP -- 21 bases times 6 fraction cases.
// ---------------------------------------------------------------------------
check('(1) bound sweep: every fused value is < RECOMMEND_FLOOR, or exactly equal to its base', () => {
  let combos = 0;
  for (const kase of FRACTION_CASES) {
    for (const base of BASES) {
      const fused = fusedFor(kase, base);
      assert.equal(typeof fused, 'number',
        'case "' + kase.name + '" at base ' + base + ' produced no key for ' + TARGET);
      const passthrough = (fused === base);
      assert.ok(fused < RECOMMEND_FLOOR || passthrough,
        'FLOOR CROSSING: case "' + kase.name + '" at base ' + base + ' fused to ' + fused +
        ', which is at or above the frozen RECOMMEND_FLOOR ' + RECOMMEND_FLOOR +
        ' and is not the at-ceiling passthrough');
      if (base >= FUSION_CEILING) {
        assert.equal(fused, base,
          'PASSTHROUGH BREACH: case "' + kase.name + '" lifted an at-or-above-ceiling base ' + base +
          ' to ' + fused);
      } else {
        assert.ok(fused < FUSION_CEILING,
          'CEILING BREACH: case "' + kase.name + '" at base ' + base + ' fused to ' + fused +
          ', not strictly below FUSION_CEILING ' + FUSION_CEILING);
        assert.ok(fused > base,
          'DEAD NUDGE: case "' + kase.name + '" at base ' + base + ' did not raise the score at all');
      }
      combos += 1;
    }
  }
  assert.ok(combos >= 21 * 6, 'the sweep must cover at least 21 bases times 6 fraction cases; got ' + combos);
  console.log('       swept combinations: ' + combos + ' (' + BASES.length + ' bases x ' +
    FRACTION_CASES.length + ' fraction cases)');
});

// ---------------------------------------------------------------------------
// (2) MONOTONICITY in both arguments.
// ---------------------------------------------------------------------------
check('(2) monotonicity: strictly increasing in the fraction, and strictly increasing in the base', () => {
  // (a) fixed base, increasing fraction. Four cases with four DISTINCT fractions,
  // ordered by the shipped constants rather than by a hand-typed sequence.
  const distinct = [];
  for (const kase of FRACTION_CASES) {
    if (!distinct.some((k) => k.fraction === kase.fraction)) distinct.push(kase);
  }
  distinct.sort((a, b) => a.fraction - b.fraction);
  assert.ok(distinct.length >= 4, 'the case set must offer at least 4 distinct fractions; got ' + distinct.length);

  for (const base of BASES) {
    if (base >= FUSION_CEILING) continue; // passthrough: fraction is irrelevant by design
    let prev = null;
    for (const kase of distinct) {
      const fused = fusedFor(kase, base);
      if (prev !== null) {
        assert.ok(fused > prev,
          'FRACTION MONOTONICITY BREACH at base ' + base + ': "' + kase.name + '" fused to ' + fused +
          ', not strictly above the previous fraction case (' + prev + ')');
      }
      prev = fused;
    }
  }

  // (b) fixed fraction, increasing base. Holds across the passthrough boundary
  // too, because a passthrough emits the base itself.
  for (const kase of FRACTION_CASES) {
    let prev = null;
    for (const base of BASES) {
      const fused = fusedFor(kase, base);
      if (prev !== null) {
        assert.ok(fused > prev,
          'BASE MONOTONICITY BREACH in case "' + kase.name + '" at base ' + base + ': fused to ' + fused +
          ', not strictly above the previous base (' + prev + ')');
      }
      prev = fused;
    }
  }
});

// ---------------------------------------------------------------------------
// (3) NO-OP DISCIPLINE -- absent signal is byte-identical in every tier.
// ---------------------------------------------------------------------------
check('(3) no-op discipline: absent sensor signal AND absent Brain verb returns {} in every tier mode', () => {
  for (const tierMode of ['mode_a', 'mode_b', 'tier_0']) {
    for (const sensorReaches of [[], null, undefined, 'not-an-array']) {
      const out = ranker.buildSignalNudges({
        baseScores: { context_block: 0.4, cross_room: 0.5 },
        sensorReaches: sensorReaches,
        brainVerb: null,
        tierMode: tierMode,
      });
      assert.deepEqual(out, {},
        'NO-OP BREACH: tier ' + tierMode + ' with sensorReaches ' + JSON.stringify(sensorReaches) +
        ' returned ' + JSON.stringify(out));
    }
  }
  // A Brain verb outside mode_a has no standing either (Canon Part 3).
  for (const tierMode of ['mode_b', 'tier_0']) {
    assert.deepEqual(ranker.buildSignalNudges({
      baseScores: {}, sensorReaches: [], brainVerb: 'Run Methodology', tierMode: tierMode,
    }), {}, 'TIER BREACH: a Brain verb produced a nudge in ' + tierMode);
  }
  // A verb with no reach preimage contributes NOTHING, not zero-to-everything
  // (245-04 carry-forward 1: 5 of the 10 canonical verbs return null).
  assert.deepEqual(ranker.buildSignalNudges({
    baseScores: {}, sensorReaches: [], brainVerb: 'Defer', tierMode: 'mode_a',
  }), {}, 'a no-preimage verb must contribute no term at all');
  // An off-enum reach_id is ignored, never emitted (T-245-28).
  assert.deepEqual(ranker.buildSignalNudges({
    baseScores: {}, sensorReaches: [reach('not_a_real_reach')], brainVerb: null, tierMode: 'mode_a',
  }), {}, 'an off-enum reach_id must produce no key');
  // Purity: the supplied map is never mutated, even deep-frozen.
  const frozen = Object.freeze({ context_block: 0.2 });
  const snapshot = JSON.stringify(frozen);
  ranker.buildSignalNudges({
    baseScores: frozen, sensorReaches: [reach('context_block')], brainVerb: null, tierMode: 'mode_a',
  });
  assert.equal(JSON.stringify(frozen), snapshot, 'MUTATION: buildSignalNudges wrote into baseScores');
});

// ---------------------------------------------------------------------------
// (4) END-TO-END GATE PROOF through the REAL buildReachList.
// ---------------------------------------------------------------------------
check('(4) end-to-end: the recommended-marker set is IDENTICAL with and without the fusion', () => {
  // A realistic cortex, built from the node types cortex-reach-adapter actually
  // reads, so the base scores come from the shipped CONTRIBUTIONS table rather
  // than from invented numbers.
  const CORTEX = [
    { type: 'governing_thought', properties: { freshness: 'fresh' } },
    { type: 'decision', properties: { kind: 'contradiction' } },
    { type: 'navigator_persona', properties: {} },
    { type: 'memory_artifact', properties: {} },
    { type: 'claim', properties: { knowledge_type: 'causal' } },
  ];
  const cortexScores = cortexAdapter.buildReachScoresFromCortex(CORTEX);
  assert.ok(Object.keys(cortexScores).length >= 4,
    'FIXTURE: the synthetic cortex must produce a multi-reach score map; got ' + JSON.stringify(cortexScores));

  // Two fixtures. The first is the pure cortex map (no reach can reach 0.70 from
  // a cortex alone, so both runs carry an EMPTY marker set). The second adds an
  // already-RECOMMENDED-class prior so the identical-set claim is asserted on a
  // NON-EMPTY set too, which is the case that could actually regress.
  const FIXTURES = [
    { name: 'cortex-only', scores: cortexScores },
    { name: 'cortex plus an already-recommended prior', scores: Object.assign({}, cortexScores, {
      contradiction: 0.82,
      brain_consult: 0.74,
    }) },
  ];

  const fired = [reach('deep_research'), reach('hats'), reach('context_block')];

  function recommendedSet(reachScores) {
    const list = orchestrator.buildReachList({ tierMode: 'mode_a', reachScores: reachScores });
    return list.reaches.filter((r) => r.recommended === true).map((r) => r.reach_id).sort();
  }

  for (const fixture of FIXTURES) {
    const before = recommendedSet(fixture.scores);

    const nudges = ranker.buildSignalNudges({
      baseScores: fixture.scores,
      sensorReaches: fired,
      brainVerb: 'Run Methodology',
      tierMode: 'mode_a',
    });
    assert.ok(Object.keys(nudges).length > 0,
      'FIXTURE: the fusion must actually produce nudges on "' + fixture.name + '", or this arm proves nothing');

    const fusedScores = Object.assign({}, fixture.scores, nudges);
    const after = recommendedSet(fusedScores);

    assert.deepEqual(after, before,
      'MARKER STATE CHANGED on fixture "' + fixture.name + '": without the fusion ' +
      JSON.stringify(before) + ', with it ' + JSON.stringify(after) +
      '. The fusion is authorized to change ORDER, never marker state.');

    // And prove the fusion is not a no-op hiding behind an identical set: the
    // ORDER must actually be reachable-different, which is the whole point.
    const orderBefore = orchestrator.buildReachList({ tierMode: 'mode_a', reachScores: fixture.scores })
      .reaches.map((r) => r.reach_id);
    const orderAfter = orchestrator.buildReachList({ tierMode: 'mode_a', reachScores: fusedScores })
      .reaches.map((r) => r.reach_id);
    assert.equal(orderBefore.length, orderAfter.length, 'the fusion must never add or drop a reach');
    if (fixture.name === 'cortex-only') {
      assert.notDeepEqual(orderAfter, orderBefore,
        'INERT FUSION: the render order did not change at all on "' + fixture.name +
        '", so this arm would pass even if buildSignalNudges returned {}');
    }
  }

  // Every fused score, checked directly against the real gate one more time.
  const nudges = ranker.buildSignalNudges({
    baseScores: cortexScores, sensorReaches: fired, brainVerb: 'Run Methodology', tierMode: 'mode_a',
  });
  for (const reachId of Object.keys(nudges)) {
    const base = cortexScores[reachId];
    const fused = nudges[reachId];
    assert.ok(fused < RECOMMEND_FLOOR || fused === base,
      'FLOOR CROSSING through the live adapter path: ' + reachId + ' fused to ' + fused);
  }
});

// ---------------------------------------------------------------------------
// (5) ENV-OVERRIDE SAFETY.
// ---------------------------------------------------------------------------
check('(5) env-override safety: hostile MINDRIAN_SENSOR_TOP_FRACTION values fall back and the bound holds', () => {
  const KEY = 'MINDRIAN_SENSOR_TOP_FRACTION';
  const prior = process.env[KEY];
  try {
    // The reference value the default constant produces at an absent base.
    const expected = DEFAULT_FUSION_BASE + SENSOR_TOP_FRACTION * (FUSION_CEILING - DEFAULT_FUSION_BASE);

    for (const hostile of ['5', '-1', 'abc', '', '0', 'Infinity', 'NaN', '1e400']) {
      process.env[KEY] = hostile;
      const out = ranker.buildSignalNudges({
        baseScores: {}, sensorReaches: [reach(TARGET)], brainVerb: null, tierMode: 'tier_0',
      });
      assert.ok(Math.abs(out[TARGET] - expected) < 1e-12,
        'ENV LEAK: ' + KEY + '="' + hostile + '" produced ' + out[TARGET] +
        ' instead of falling back to the default-derived ' + expected);

      // And the whole bound sweep still holds under the hostile value.
      for (const kase of FRACTION_CASES) {
        for (const base of BASES) {
          const fused = fusedFor(kase, base);
          assert.ok(fused < RECOMMEND_FLOOR || fused === base,
            'FLOOR CROSSING under ' + KEY + '="' + hostile + '": case "' + kase.name +
            '" at base ' + base + ' fused to ' + fused);
        }
      }
    }

    // A LEGITIMATE override is honored (proving the fallback is not just "ignore
    // the variable"), and the bound still holds.
    process.env[KEY] = '0.9';
    const honored = ranker.buildSignalNudges({
      baseScores: {}, sensorReaches: [reach(TARGET)], brainVerb: null, tierMode: 'tier_0',
    });
    const expected09 = DEFAULT_FUSION_BASE + 0.9 * (FUSION_CEILING - DEFAULT_FUSION_BASE);
    assert.ok(Math.abs(honored[TARGET] - expected09) < 1e-12,
      'a legitimate override in (0, 1] must be honored; got ' + honored[TARGET]);
    assert.ok(honored[TARGET] < RECOMMEND_FLOOR, 'even a 0.9 override stays below the floor');
  } finally {
    if (prior === undefined) delete process.env[KEY];
    else process.env[KEY] = prior;
  }
  assert.equal(process.env[KEY], prior, 'the env var must be restored exactly');
});

console.log('');
console.log('PASS test-245-nudge-bound.cjs (' + passed + ' checks)');
