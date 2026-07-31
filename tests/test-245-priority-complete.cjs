'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-01 Task 3 -- test-245-priority-complete.
 *
 * WHAT THIS PINS (D-20 / D-22 as corrected by 245-RESEARCH.md F-3): the
 * SENS_PRIORITY doctrine table covers EXACTLY the registered sensor set, is
 * frozen, and is duplicate-free.
 *
 * WHY IT DUPLICATES THE BUILD GATE ON PURPOSE: the identical three set
 * relations are asserted by scripts/build-connector-registry.cjs --check. That
 * is deliberate, not redundant. The invariant is pinned in two places that fail
 * for two different audiences: --check reddens a release/commit gate, this test
 * reddens the phase suite. A sensor that ships without a doctrine rank silently
 * degrades a same-reach collision back to SENSOR_REGISTRY file order, and a
 * silent degradation is precisely the failure class this phase exists to close,
 * so one fence is not enough.
 *
 * Bare node script, no framework, exits non-zero on failure, self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const { SENS_PRIORITY, sensorPriorityRank } = require('../lib/core/sensors/sensor-priority.cjs');
const { SENSOR_REGISTRY, SENSOR_REGISTRY_IDS } = require('../lib/core/insight-sensors.cjs');

let checks = 0;
function ok(label) {
  checks++;
  console.log('  ok - ' + label);
}

console.log('test-245-priority-complete:');

// ---------------------------------------------------------------------------
// Arm 1: the table is a frozen, duplicate-free array.
// ---------------------------------------------------------------------------
assert.ok(Array.isArray(SENS_PRIORITY), 'SENS_PRIORITY must be an array');
assert.ok(Object.isFrozen(SENS_PRIORITY), 'SENS_PRIORITY must be frozen');
ok('SENS_PRIORITY is a frozen array');

const dupes = SENS_PRIORITY.filter((id, i) => SENS_PRIORITY.indexOf(id) !== i);
assert.strictEqual(dupes.length, 0, 'SENS_PRIORITY has duplicate entries: ' + dupes.join(', '));
ok('SENS_PRIORITY is duplicate-free (' + SENS_PRIORITY.length + ' entries)');

// ---------------------------------------------------------------------------
// Arm 2: the two registry arrays stay index-parallel.
// ---------------------------------------------------------------------------
assert.strictEqual(
  SENSOR_REGISTRY_IDS.length,
  SENSOR_REGISTRY.length,
  'SENSOR_REGISTRY_IDS (' + SENSOR_REGISTRY_IDS.length + ') and SENSOR_REGISTRY (' +
    SENSOR_REGISTRY.length + ') have diverged'
);
ok('SENSOR_REGISTRY_IDS is index-parallel to SENSOR_REGISTRY');

// ---------------------------------------------------------------------------
// Arm 3: every REGISTERED sensor has a doctrine rank. This is the direction
// that catches a new sensor shipping unranked.
// ---------------------------------------------------------------------------
const missingFromPriority = SENSOR_REGISTRY_IDS.filter((id) => SENS_PRIORITY.indexOf(id) === -1);
assert.strictEqual(
  missingFromPriority.length,
  0,
  'registered sensor(s) with NO SENS_PRIORITY entry: ' + missingFromPriority.join(', ')
);
ok('every registered sensor id has a SENS_PRIORITY rank');

// ---------------------------------------------------------------------------
// Arm 4: the table carries no phantom entry. This is the direction that catches
// doctrine outliving the code (a sensor deleted, its rank left behind).
// ---------------------------------------------------------------------------
const missingFromRegistry = SENS_PRIORITY.filter((id) => SENSOR_REGISTRY_IDS.indexOf(id) === -1);
assert.strictEqual(
  missingFromRegistry.length,
  0,
  'SENS_PRIORITY entr(ies) with NO registered sensor: ' + missingFromRegistry.join(', ')
);
ok('every SENS_PRIORITY entry names a registered sensor');

// ---------------------------------------------------------------------------
// Arm 5: the rank lookup is total and defensive. A comparator that subtracts
// two ranks must always get a finite number; a NaN silently corrupts a sort
// instead of failing loudly.
// ---------------------------------------------------------------------------
for (const id of SENSOR_REGISTRY_IDS) {
  const r = sensorPriorityRank(id);
  assert.ok(Number.isInteger(r) && r >= 0 && r < SENS_PRIORITY.length, 'bad rank for ' + id + ': ' + r);
}
for (const bad of [null, undefined, '', 42, {}, [], 'SENS-NOPE']) {
  assert.strictEqual(
    sensorPriorityRank(bad),
    SENS_PRIORITY.length,
    'a non-member input must rank worst, not: ' + String(sensorPriorityRank(bad))
  );
}
ok('sensorPriorityRank is total: every registered id ranks in-range, every non-member ranks worst');

console.log('');
console.log('PASS test-245-priority-complete.cjs (' + checks + ' checks)');
