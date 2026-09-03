'use strict';
// Phase 267.2 W1a/W1c -- exhaustive routing-table pin for
// lib/core/greeting-intent-detector.cjs (HOOK-06). Iterates the EXPORTED
// BUCKETS enum rather than restating the bucket names, so a future bucket
// added without a routing-table entry fails here automatically.

const assert = require('node:assert/strict');

const { BUCKETS, OUTCOMES, ROUTING_TABLE, route } = require('../lib/core/greeting-intent-detector.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-routing-table');

ok('every bucket in BUCKETS has a ROUTING_TABLE entry that is a member of OUTCOMES (no bucket unmapped)', function () {
  for (const bucket of BUCKETS) {
    const outcome = ROUTING_TABLE[bucket];
    assert.notEqual(outcome, undefined, 'bucket "' + bucket + '" has no ROUTING_TABLE entry');
    assert.ok(
      OUTCOMES.includes(outcome),
      'bucket "' + bucket + '" maps to "' + outcome + '", which is not a member of OUTCOMES',
    );
  }
});

ok('route(bucket) returns exactly ROUTING_TABLE[bucket] as a single string for every bucket', function () {
  for (const bucket of BUCKETS) {
    const routed = route(bucket);
    assert.equal(routed, ROUTING_TABLE[bucket], 'route("' + bucket + '") diverges from ROUTING_TABLE');
    assert.equal(typeof routed, 'string', 'route("' + bucket + '") returned a non-string: ' + typeof routed);
    assert.ok(!Array.isArray(routed), 'route("' + bucket + '") returned an array, not a single outcome');
  }
});

ok('every outcome in OUTCOMES is reachable from at least one bucket', function () {
  const reachable = new Set(BUCKETS.map(function (b) { return ROUTING_TABLE[b]; }));
  for (const outcome of OUTCOMES) {
    assert.ok(reachable.has(outcome), 'outcome "' + outcome + '" is unreachable from any bucket');
  }
});

ok("clarify is reached by exactly one bucket, and that bucket is prior_work (decision D-C)", function () {
  const clarifyBuckets = BUCKETS.filter(function (b) { return ROUTING_TABLE[b] === 'clarify'; });
  assert.deepEqual(
    clarifyBuckets,
    ['prior_work'],
    'decision D-C pins clarify to exactly ["prior_work"], found ' + JSON.stringify(clarifyBuckets),
  );
});

ok('ROUTING_TABLE.ambiguous is larry, not clarify (decision D-C: a clarifying question on an '
  + 'ambiguous FIRST sentence is a user-input ask before any reward has landed, the exact '
  + 'ordering docs/reward-before-investment-rule.md exists to prevent -- do not "improve" this '
  + 'to clarify without reading that reasoning first)', function () {
  assert.equal(
    ROUTING_TABLE.ambiguous,
    'larry',
    'ROUTING_TABLE.ambiguous must stay "larry" per decision D-C; routing an ambiguous first '
      + 'sentence to a clarifying question asks the user for input before any reward has landed',
  );
});

ok('ROUTING_TABLE, BUCKETS and OUTCOMES are all frozen (a caller cannot mutate the table at run time)', function () {
  assert.ok(Object.isFrozen(ROUTING_TABLE), 'ROUTING_TABLE is not frozen');
  assert.ok(Object.isFrozen(BUCKETS), 'BUCKETS is not frozen');
  assert.ok(Object.isFrozen(OUTCOMES), 'OUTCOMES is not frozen');
});

console.log('\nPASS test-267-2-routing-table (' + n + ' assertions)');
