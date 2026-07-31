'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-07 Task 1 -- the SENS_PRIORITY tie-break is deterministic and
 * independent of input order (Requirement 4, D-20).
 * ============================================================================
 * WHAT THIS PINS, in plain terms.
 *
 * Twelve of the registered sensors can fire the SAME reach id, `context_block`.
 * Every scoring term rankFiredCandidates has (d4For, canonicalRegistryRank,
 * countPenalty) is keyed on `reach_id`, never on the individual sensor, so two
 * sensors that collide on one reach produce the IDENTICAL combined score. Before
 * 245-07 the comparator fell all the way through to `a.index - b.index`, i.e.
 * SENSOR_REGISTRY file order: "which sensor's payload wins" was decided by
 * whoever edited the registry array last. Requirement 4 replaces that accident
 * with the SENS_PRIORITY doctrine table.
 *
 * The literal acceptance criterion is "reproducibly across runs, independent of
 * file load order", so the load-bearing arm here is not a single ordering check.
 * It is: feed the SAME colliding set in EVERY permutation (all 6 of a 3-element
 * set, reverse order included) and assert one identical output every time.
 *
 * Self-contained: db-free through the roomState injection seams (reachScores +
 * hedgeWeights), no fixtures, no room, no network. Bare `node`, non-zero exit on
 * failure.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-hedge-ranker.cjs'));
const sensorTypes = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));
const sensorPriority = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-priority.cjs'));

const SENS_PRIORITY = sensorPriority.SENS_PRIORITY;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// A REAL frozen reach struct, built through the shipped makeReach so the test
// can never pass against a shape dispatchSensors would not actually produce.
// `signal` carries the sensor id too, purely so a failure message can name the
// candidate: the comparator reads evidence.sensor_id and nothing else.
function stampedReach(reachId, sensorId) {
  const evidence = {};
  if (sensorId !== null) evidence.sensor_id = sensorId;
  const r = sensorTypes.makeReach({
    reach_id: reachId,
    posture: 'hold',
    dispatch: 'noop',
    signal: 'tiebreak_fixture',
    evidence: evidence,
  });
  assert.ok(r, 'FIXTURE: makeReach returned null for ' + reachId + ' / ' + sensorId);
  if (sensorId === null) {
    assert.ok(!Object.prototype.hasOwnProperty.call(r.evidence, 'sensor_id'),
      'FIXTURE: the unstamped reach must genuinely carry no sensor_id');
  } else {
    assert.equal(r.evidence.sensor_id, sensorId,
      'FIXTURE: makeReach dropped the sensor_id scalar');
  }
  return r;
}

function idsOf(list) {
  return list.map(function (r) {
    return (r && r.evidence && r.evidence.sensor_id) ? r.evidence.sensor_id : '(unstamped)';
  });
}

// Every permutation of a list (3 elements -> 6, including the reverse).
function permutations(list) {
  if (list.length <= 1) return [list.slice()];
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const rest = list.slice(0, i).concat(list.slice(i + 1));
    for (const tail of permutations(rest)) out.push([list[i]].concat(tail));
  }
  return out;
}

// The three colliders. All three carry reach_id 'context_block', so every
// reach_id-keyed scoring term is identical and only the tie branch can decide.
// Their SENS_PRIORITY ranks are read from the SHIPPED table, never hand-typed,
// so a future re-ordering of the doctrine reddens this test rather than silently
// invalidating it.
const COLLIDERS = ['SENS-08', 'SENS-01', 'SENS-16'];
const EXPECTED = COLLIDERS.slice().sort(function (a, b) {
  return sensorPriority.sensorPriorityRank(a) - sensorPriority.sensorPriorityRank(b);
});

console.log('test-245-tiebreak-deterministic.cjs: SENS_PRIORITY resolves same-reach_id collisions (Req 4)');

// ---------------------------------------------------------------------------
// (0) PRECONDITIONS -- the fixture is a genuine collision with distinct ranks.
// ---------------------------------------------------------------------------
check('(0) preconditions: three DISTINCT SENS_PRIORITY members with three distinct ranks', () => {
  for (const id of COLLIDERS) {
    assert.ok(SENS_PRIORITY.indexOf(id) !== -1,
      'FIXTURE DRIFT: ' + id + ' is no longer a SENS_PRIORITY member');
  }
  const ranks = COLLIDERS.map(sensorPriority.sensorPriorityRank);
  assert.equal(new Set(ranks).size, 3, 'the three fixture sensors must have three distinct ranks; got ' + ranks);
  // Deliberately chosen across the table's three ends (Group A, Group B, the
  // Group D fallback tier) so the ordering is not an artifact of adjacency.
  assert.deepEqual(EXPECTED, ['SENS-08', 'SENS-01', 'SENS-16'],
    'DOCTRINE DRIFT: the expected winner order changed; check sensor-priority.cjs before touching this test');
});

// ---------------------------------------------------------------------------
// (1) PERMUTATION INVARIANCE -- the acceptance criterion, literally.
// ---------------------------------------------------------------------------
check('(1) all 6 input permutations (reverse included) yield ONE identical SENS_PRIORITY order', () => {
  const perms = permutations(COLLIDERS);
  assert.equal(perms.length, 6, 'the permutation generator must emit all 6 orderings; got ' + perms.length);

  // The reverse of the expected output must genuinely be among the inputs, so
  // "identical every time" is not satisfied by never having been perturbed.
  const reversed = EXPECTED.slice().reverse().join(',');
  assert.ok(perms.some(function (p) { return p.join(',') === reversed; }),
    'the permutation set must include the exact reverse of the expected order');

  let seen = 0;
  for (const perm of perms) {
    const fired = perm.map(function (id) { return stampedReach('context_block', id); });
    const out = ranker.rankFiredCandidates(fired, {
      reachScores: { context_block: 0.4 },
      hedgeWeights: { d4_blend: 0.5, registry_order: 0.5 },
    });
    assert.deepEqual(idsOf(out), EXPECTED,
      'PERMUTATION LEAK: input ' + perm.join(',') + ' produced ' + idsOf(out).join(',') +
      ' instead of the SENS_PRIORITY order ' + EXPECTED.join(','));
    seen += 1;
  }
  console.log('       permutations asserted: ' + seen);
});

// ---------------------------------------------------------------------------
// (2) SKEWED WEIGHTS -- the tie branch still decides at both extremes.
// ---------------------------------------------------------------------------
check('(2) skewed hedge weights (0.99/0.01 and the reverse) do not change the tie outcome', () => {
  const skews = [
    { d4_blend: 0.99, registry_order: 0.01 },
    { d4_blend: 0.01, registry_order: 0.99 },
  ];
  for (const hedgeWeights of skews) {
    for (const perm of permutations(COLLIDERS)) {
      const fired = perm.map(function (id) { return stampedReach('context_block', id); });
      const out = ranker.rankFiredCandidates(fired, {
        reachScores: { context_block: 0.4 },
        hedgeWeights: hedgeWeights,
      });
      assert.deepEqual(idsOf(out), EXPECTED,
        'WEIGHT LEAK: weights ' + JSON.stringify(hedgeWeights) + ' with input ' + perm.join(',') +
        ' produced ' + idsOf(out).join(','));
    }
  }
});

// ---------------------------------------------------------------------------
// (3) UNSTAMPED SORTS LAST -- sensorPriorityRank's worst-finite-rank contract.
// ---------------------------------------------------------------------------
check('(3) an unstamped reach sorts LAST among a tied set and nothing throws', () => {
  const inputs = [
    ['SENS-08', null, 'SENS-16'],
    [null, 'SENS-08', 'SENS-16'],
    ['SENS-16', 'SENS-08', null],
    [null, 'SENS-16', 'SENS-08'],
  ];
  for (const perm of inputs) {
    const fired = perm.map(function (id) { return stampedReach('context_block', id); });
    let out;
    assert.doesNotThrow(function () {
      out = ranker.rankFiredCandidates(fired, {
        reachScores: { context_block: 0.4 },
        hedgeWeights: { d4_blend: 0.5, registry_order: 0.5 },
      });
    }, 'an unstamped reach must never make the comparator throw');
    assert.deepEqual(idsOf(out), ['SENS-08', 'SENS-16', '(unstamped)'],
      'UNSTAMPED LEAK: input ' + JSON.stringify(perm) + ' produced ' + idsOf(out).join(','));
  }
});

// ---------------------------------------------------------------------------
// (3b) TWO UNSTAMPED -- the retained tertiary fallback keeps same-rank ties
//      deterministic instead of leaving them to the engine's sort.
// ---------------------------------------------------------------------------
check('(3b) two equally-unranked reaches keep their original fired order (tertiary fallback retained)', () => {
  const first = stampedReach('context_block', null);
  const second = stampedReach('context_block', null);
  const out = ranker.rankFiredCandidates([first, second], {
    reachScores: { context_block: 0.4 },
    hedgeWeights: { d4_blend: 0.5, registry_order: 0.5 },
  });
  assert.strictEqual(out[0], first, 'the first-fired of two same-rank reaches must stay first');
  assert.strictEqual(out[1], second, 'the second-fired of two same-rank reaches must stay second');
});

// ---------------------------------------------------------------------------
// (4) SCORE STILL DOMINATES -- the tie branch never overrides `combined`.
// ---------------------------------------------------------------------------
check('(4) a mixed set sorts primarily by combined score; the tie branch only breaks true ties', () => {
  // The LOWEST-priority collider (SENS-16, last in the table) rides a reach with
  // the HIGHEST score. If the tie branch ever leaked into the primary comparison
  // it would sink; it must lead.
  const hi = stampedReach('contradiction', 'SENS-16');
  const a = stampedReach('context_block', 'SENS-08');
  const b = stampedReach('context_block', 'SENS-01');
  const out = ranker.rankFiredCandidates([a, b, hi], {
    reachScores: { context_block: 0.10, contradiction: 0.95 },
    hedgeWeights: { d4_blend: 1, registry_order: 0 },
  });
  assert.deepEqual(out.map(function (r) { return r.reach_id; }),
    ['contradiction', 'context_block', 'context_block'],
    'SCORE OVERRIDE: the higher-scoring reach must lead regardless of sensor priority; got ' +
    JSON.stringify(out.map(function (r) { return r.reach_id; })));
  assert.deepEqual(idsOf(out), ['SENS-16', 'SENS-08', 'SENS-01'],
    'the two genuine colliders must still resolve by doctrine behind the scored winner; got ' + idsOf(out).join(','));

  // The mirror case: flip the scores and the same three reaches reorder by score
  // again, with the collision pair leading in doctrine order.
  const out2 = ranker.rankFiredCandidates([hi, b, a], {
    reachScores: { context_block: 0.95, contradiction: 0.10 },
    hedgeWeights: { d4_blend: 1, registry_order: 0 },
  });
  assert.deepEqual(idsOf(out2), ['SENS-08', 'SENS-01', 'SENS-16'],
    'MIRROR: got ' + idsOf(out2).join(','));
});

// ---------------------------------------------------------------------------
// (5) RETURN CONTRACT UNCHANGED -- same objects, resorted (never rebuilt).
// ---------------------------------------------------------------------------
check('(5) rankFiredCandidates still returns the SAME reach objects, only reordered', () => {
  const fired = COLLIDERS.map(function (id) { return stampedReach('context_block', id); });
  const out = ranker.rankFiredCandidates(fired, {
    reachScores: { context_block: 0.4 },
    hedgeWeights: { d4_blend: 0.5, registry_order: 0.5 },
  });
  assert.equal(out.length, fired.length, 'the ranker must never add or drop a candidate');
  for (const r of out) {
    assert.ok(fired.indexOf(r) !== -1, 'IDENTITY LEAK: the ranker returned an object it was not given');
  }
});

console.log('');
console.log('PASS test-245-tiebreak-deterministic.cjs (' + passed + ' checks)');
