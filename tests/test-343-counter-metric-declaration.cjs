'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 343 Plan 04 Task 2 (CENSUS-08, WD-8) -- test-343-counter-metric-declaration.
 *
 * WHAT THIS PINS: the fourth arm of scripts/build-connector-registry.cjs's
 * `sensorPriorityCompletenessErrors` -- every SENS_PRIORITY record must carry an
 * `optimizes` and a `watched_by` key, each either `null` or a non-empty string,
 * and the two must be null together or non-null together (an optimized
 * quantity declared with no watcher, or a watcher declared with no optimized
 * quantity, are both incoherent and both fail). It also re-pins the migrated
 * arms 2/3 (reading `.id` on a record instead of a bare string) and the
 * unchanged `sensorPriorityRank` contract.
 *
 * ONE HOME FOR THE RULE: `sensorPriorityCompletenessErrors` is imported
 * directly from the build gate and called with an injected, in-memory shallow
 * copy of the real table for every mutation case below. The real file on disk
 * is never touched, so the same predicate function that reddens
 * `node scripts/build-connector-registry.cjs --check` is exactly the function
 * this test exercises -- there is no second implementation of the rule to
 * drift out of step with the first.
 *
 * Bare node script, no framework, exits non-zero on failure, self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const {
  SENS_PRIORITY,
  SENS_PRIORITY_IDS,
  sensorPriorityRank,
} = require('../lib/core/sensors/sensor-priority.cjs');
const { SENSOR_REGISTRY, SENSOR_REGISTRY_IDS } = require('../lib/core/insight-sensors.cjs');
const { sensorPriorityCompletenessErrors } = require('../scripts/build-connector-registry.cjs');

let checks = 0;
function ok(label) {
  checks++;
  console.log('  ok - ' + label);
}

console.log('test-343-counter-metric-declaration:');

function cloneRecords() {
  return SENS_PRIORITY.map((r) => Object.assign({}, r));
}

function run(records) {
  return sensorPriorityCompletenessErrors({
    SENSOR_REGISTRY: SENSOR_REGISTRY,
    SENSOR_REGISTRY_IDS: SENSOR_REGISTRY_IDS,
    SENS_PRIORITY: records,
  });
}

// ---------------------------------------------------------------------------
// Baseline: the intact, real table produces zero completeness/pairing errors.
// ---------------------------------------------------------------------------
{
  const errs = run(cloneRecords());
  assert.strictEqual(errs.length, 0, 'the intact table must produce zero errors: ' + errs.join(' | '));
  ok('the intact table (all twenty-one records) produces zero completeness/pairing errors');
}

// ---------------------------------------------------------------------------
// The rank contract: pre-343-04 order with SENS-19 (343-06, WD-7) inserted in
// Group A between SENS-11 and SENS-14; every registered id ranks in-range,
// every non-member ranks worst.
// ---------------------------------------------------------------------------
{
  const want = [
    'SENS-08', 'SENS-17', 'SENS-10', 'SENS-11', 'SENS-19', 'SENS-14', 'SENS-02', 'SENS-RECENCY',
    'SENS-01', 'SENS-06', 'SENS-13', 'SENS-15', 'SENS-12', 'SENS-07', 'SENS-03',
    'SENS-05', 'SENS-04', 'SENS-09', 'SENS-SHOW', 'SENS-18',
    'SENS-16',
  ];
  assert.deepStrictEqual(SENS_PRIORITY_IDS.slice(), want, 'SENS_PRIORITY_IDS order changed unexpectedly');
  for (let i = 0; i < want.length; i++) {
    assert.strictEqual(sensorPriorityRank(want[i]), i, 'rank for ' + want[i] + ' changed from its expected position');
  }
  assert.strictEqual(sensorPriorityRank('SENS-NOPE'), SENS_PRIORITY.length, 'unknown id must rank worst');
  assert.strictEqual(sensorPriorityRank(''), SENS_PRIORITY.length, 'empty string must rank worst');
  assert.strictEqual(sensorPriorityRank(null), SENS_PRIORITY.length, 'null must rank worst');
  ok('sensorPriorityRank ranks every id in the expected order (SENS-19 in Group A per WD-7), non-members rank worst');
}

// ---------------------------------------------------------------------------
// Deleting a record fails, naming the sensor id that lost its rank.
// ---------------------------------------------------------------------------
{
  const records = cloneRecords().filter((r) => r.id !== 'SENS-08');
  const errs = run(records);
  const joined = errs.join(' | ');
  assert.ok(errs.length > 0, 'removing SENS-08 must produce at least one error');
  assert.ok(joined.includes('SENS-08'), 'the error must name SENS-08: ' + joined);
  ok('deleting a record from the table fails the predicate and names the sensor id that lost its rank');
}

// ---------------------------------------------------------------------------
// A phantom id (naming no registered sensor) fails, naming the phantom.
// ---------------------------------------------------------------------------
{
  const records = cloneRecords();
  records.push({ id: 'SENS-PHANTOM-343', optimizes: null, watched_by: null, why: 'test fixture, not a real sensor' });
  const errs = run(records);
  const joined = errs.join(' | ');
  assert.ok(joined.includes('SENS-PHANTOM-343'), 'the error must name the phantom id: ' + joined);
  ok('adding a record naming no registered sensor fails the predicate and names the phantom id');
}

// ---------------------------------------------------------------------------
// Deleting the watched_by key fails, naming the record and the missing key.
// Setting it to explicit null (paired with optimizes: null) does not fail.
// ---------------------------------------------------------------------------
{
  const records = cloneRecords();
  const target = records.find((r) => r.id === 'SENS-04');
  delete target.watched_by;
  const errs = run(records);
  const joined = errs.join(' | ');
  assert.ok(
    joined.includes('SENS-04') && joined.toLowerCase().includes('watched_by'),
    'deleting watched_by must name the record and the missing key: ' + joined
  );
  ok('deleting the watched_by key from one record fails, naming the record and the missing key');
}
{
  const records = cloneRecords();
  const target = records.find((r) => r.id === 'SENS-04');
  target.watched_by = null;
  target.optimizes = null;
  const errs = run(records);
  assert.strictEqual(errs.length, 0, 'explicit null (paired) must not fail: ' + errs.join(' | '));
  ok('setting watched_by to explicit null, paired with optimizes: null, does not fail the predicate');
}

// ---------------------------------------------------------------------------
// An optimized quantity with no watcher fails; the reverse (a watcher with no
// optimized quantity) also fails, as an incoherent declaration.
// ---------------------------------------------------------------------------
{
  const records = cloneRecords();
  const target = records.find((r) => r.id === 'SENS-01'); // ships optimizes: null, watched_by: null
  target.optimizes = 'some quantity this fixture claims to optimize';
  const errs = run(records);
  const joined = errs.join(' | ');
  assert.ok(errs.length > 0 && joined.includes('SENS-01'), 'an optimized quantity with no watcher must fail: ' + joined);
  ok('setting optimizes to non-null while watched_by stays null fails: an optimized quantity with no watcher');
}
{
  const records = cloneRecords();
  const target = records.find((r) => r.id === 'SENS-01');
  target.watched_by = 'some counter quantity this fixture claims to watch';
  const errs = run(records);
  const joined = errs.join(' | ');
  assert.ok(errs.length > 0 && joined.includes('SENS-01'), 'a watcher with no optimized quantity must fail: ' + joined);
  ok('setting watched_by to non-null while optimizes stays null fails: an incoherent declaration, the reverse case');
}

console.log('');
console.log('PASS test-343-counter-metric-declaration.cjs (' + checks + ' checks)');
