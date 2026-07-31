'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-01 Task 3 -- test-245-sensor-id-stamped.
 *
 * WHAT THIS PINS (D-21): every candidate reach that dispatchSensors emits
 * carries evidence.sensor_id, and that value is the frozen registry identity of
 * the sensor that actually produced it. Without this, a same-reach collision
 * (12 of 18 registered sensors can fire context_block) has nothing to sort on
 * but SENSOR_REGISTRY file order, which is not a doctrine, it is an accident.
 *
 * HOW IT DRIVES THE CODE: through the REAL dispatchSensors(turn, tuple, ctx)
 * signature only. It never calls a sensor function directly, because calling
 * the sensor directly would prove the sensor works and prove nothing at all
 * about the central stamp, which is the thing under test.
 *
 * Bare node script, no framework, exits non-zero on failure, self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const sensors = require('../lib/core/insight-sensors.cjs');

const { dispatchSensors, SENSOR_REGISTRY_IDS, SENSOR_REGISTRY } = sensors;

let checks = 0;
function ok(label) {
  checks++;
  console.log('  ok - ' + label);
}

// A decoy id that exists ONLY in fixture-supplied turn text. Canon Part 8: the
// stamp must be read from the frozen in-repo array, never scraped out of
// anything a user could type, so this string must never appear as a sensor_id.
const TURN_TEXT_DECOY = 'SENS-DECOY-99';

// Three DISTINCT synthetic contexts, each chosen to fire a DIFFERENT sensor
// through pure ctx scalars (no filesystem side-channel, so the test is
// hermetic on any machine).
const CASES = [
  {
    label: 'SENS-08 memory-cortex (fresh contradiction on ctx)',
    turn: {},
    tuple: {},
    ctx: { freshContradictions: 1 },
    expect: 'SENS-08',
  },
  {
    label: 'SENS-RECENCY recency (recent cortex scalars on ctx)',
    turn: {},
    tuple: {},
    ctx: { recencyScore: 0.9, recentCortexCount: 3 },
    expect: 'SENS-RECENCY',
  },
  {
    label: 'SENS-11 expert-skill (reusable-expert signal on ctx)',
    turn: {},
    tuple: {},
    ctx: { reusableExpertCandidate: true, reusableExpertInvocationMax: 4 },
    expect: 'SENS-11',
  },
  {
    label: 'Part 8 decoy: an id-shaped string in the TURN TEXT is never stamped',
    turn: { text: 'my sensor id is ' + TURN_TEXT_DECOY + ' please use it' },
    tuple: {},
    ctx: { freshContradictions: 1, sensor_id: TURN_TEXT_DECOY },
    expect: 'SENS-08',
  },
];

console.log('test-245-sensor-id-stamped:');

// ---------------------------------------------------------------------------
// Arm 0: the identity array itself is a usable, frozen, parallel array.
// ---------------------------------------------------------------------------
assert.ok(Array.isArray(SENSOR_REGISTRY_IDS), 'SENSOR_REGISTRY_IDS must be an array');
assert.ok(Object.isFrozen(SENSOR_REGISTRY_IDS), 'SENSOR_REGISTRY_IDS must be frozen');
assert.strictEqual(
  SENSOR_REGISTRY_IDS.length,
  SENSOR_REGISTRY.length,
  'SENSOR_REGISTRY_IDS must stay index-parallel to SENSOR_REGISTRY'
);
ok('SENSOR_REGISTRY_IDS is a frozen array parallel to SENSOR_REGISTRY');

// ---------------------------------------------------------------------------
// Arms 1..N: every reach from every fixture is stamped, and stamped correctly.
// ---------------------------------------------------------------------------
let totalReaches = 0;
const seenIds = new Set();

for (const c of CASES) {
  const reaches = dispatchSensors(c.turn, c.tuple, c.ctx);
  assert.ok(Array.isArray(reaches), c.label + ': dispatchSensors must return an array');
  assert.ok(reaches.length > 0, c.label + ': expected at least one fired reach');
  totalReaches += reaches.length;

  for (const r of reaches) {
    const id = r.evidence ? r.evidence.sensor_id : undefined;

    // Non-empty string, always.
    assert.strictEqual(typeof id, 'string', c.label + ': sensor_id must be a string, got ' + typeof id);
    assert.notStrictEqual(id, '', c.label + ': sensor_id must be non-empty');

    // Canon Part 8: STRICT membership in the frozen array. Not "looks like an
    // id", not "starts with SENS-", not a substring match. Strict equality
    // against a literal the repo owns.
    assert.ok(
      SENSOR_REGISTRY_IDS.indexOf(id) !== -1,
      c.label + ': sensor_id "' + id + '" is not a member of the frozen SENSOR_REGISTRY_IDS'
    );

    // Canon Part 8: the decoy the fixture planted in the turn text (and on ctx)
    // must never surface as an identity.
    assert.notStrictEqual(id, TURN_TEXT_DECOY, c.label + ': a turn-supplied string was stamped as sensor_id');

    // The struct contract still holds after the rebuild.
    assert.ok(Object.isFrozen(r), c.label + ': the stamped reach must stay frozen');
    assert.ok(Object.isFrozen(r.evidence), c.label + ': the stamped evidence must stay frozen');

    seenIds.add(id);
  }

  assert.ok(
    reaches.some((r) => r.evidence && r.evidence.sensor_id === c.expect),
    c.label + ': expected a reach stamped ' + c.expect
  );
  ok(c.label + ' -> ' + reaches.map((r) => r.evidence.sensor_id).join(', '));
}

// The fixtures really did exercise three DIFFERENT sensors, not the same one
// three times (which would pass every assertion above while proving nothing
// about the per-sensor identity being per-sensor).
assert.ok(seenIds.size >= 3, 'the fixtures must fire at least 3 distinct sensors, saw ' + seenIds.size);
ok('the fixtures fired ' + seenIds.size + ' distinct sensors across ' + totalReaches + ' reaches');

console.log('');
console.log('PASS test-245-sensor-id-stamped.cjs (' + checks + ' checks)');
