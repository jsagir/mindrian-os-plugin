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
 * PHASE 343 PLAN 04 EXTENSION (CENSUS-08, WD-8): SENS_PRIORITY's elements
 * became `{ id, optimizes, watched_by, why }` records. Arms 1/3/4 below read
 * `.id` off each record instead of treating the element as a bare string; the
 * assertions and their wording are otherwise unchanged. A new arm 6 pins the
 * counter-metric pairing rule itself (every record needs an own-key
 * optimizes/watched_by pair, null paired with null, non-null paired with
 * non-null), duplicating scripts/build-connector-registry.cjs's fourth gate
 * arm for the same two-audiences reason arms 1-4 already state.
 *
 * Bare node script, no framework, exits non-zero on failure, self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const { SENS_PRIORITY, SENS_PRIORITY_IDS, sensorPriorityRank } = require('../lib/core/sensors/sensor-priority.cjs');
const { SENSOR_REGISTRY, SENSOR_REGISTRY_IDS } = require('../lib/core/insight-sensors.cjs');

let checks = 0;
function ok(label) {
  checks++;
  console.log('  ok - ' + label);
}

console.log('test-245-priority-complete:');

// ---------------------------------------------------------------------------
// Arm 1: the table is a frozen, duplicate-free array of frozen id records.
// ---------------------------------------------------------------------------
assert.ok(Array.isArray(SENS_PRIORITY), 'SENS_PRIORITY must be an array');
assert.ok(Object.isFrozen(SENS_PRIORITY), 'SENS_PRIORITY must be frozen');
for (const r of SENS_PRIORITY) {
  assert.ok(Object.isFrozen(r), 'every SENS_PRIORITY record must be frozen: ' + JSON.stringify(r));
}
ok('SENS_PRIORITY is a frozen array of frozen records');

const priorityIds = SENS_PRIORITY.map((r) => r.id);
const dupes = priorityIds.filter((id, i) => priorityIds.indexOf(id) !== i);
assert.strictEqual(dupes.length, 0, 'SENS_PRIORITY has duplicate entries: ' + dupes.join(', '));
ok('SENS_PRIORITY is duplicate-free (' + SENS_PRIORITY.length + ' entries)');

assert.deepStrictEqual(
  SENS_PRIORITY_IDS.slice(),
  priorityIds,
  'SENS_PRIORITY_IDS must be exactly SENS_PRIORITY.map(r => r.id), same order'
);
ok('SENS_PRIORITY_IDS is the derived id array, same order as SENS_PRIORITY');

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
const missingFromPriority = SENSOR_REGISTRY_IDS.filter((id) => priorityIds.indexOf(id) === -1);
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
const missingFromRegistry = priorityIds.filter((id) => SENSOR_REGISTRY_IDS.indexOf(id) === -1);
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

// ---------------------------------------------------------------------------
// Arm 6: Phase 343 Plan 04 (CENSUS-08, WD-8, T-343-17): every record declares
// its counter-metric pairing. optimizes/watched_by are OWN keys (an absent
// key is a gap, explicit null is a declaration), each is null or a non-empty
// string, and the two are null together or non-null together.
// ---------------------------------------------------------------------------
const validPairValue = (v) => v === null || (typeof v === 'string' && v.length > 0);
for (const r of SENS_PRIORITY) {
  assert.ok(
    Object.prototype.hasOwnProperty.call(r, 'optimizes'),
    r.id + ' is missing its own "optimizes" key (absent key is a gap, not an exemption)'
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(r, 'watched_by'),
    r.id + ' is missing its own "watched_by" key (absent key is a gap, not an exemption)'
  );
  assert.ok(
    validPairValue(r.optimizes),
    r.id + '.optimizes must be null or a non-empty string, got: ' + JSON.stringify(r.optimizes)
  );
  assert.ok(
    validPairValue(r.watched_by),
    r.id + '.watched_by must be null or a non-empty string, got: ' + JSON.stringify(r.watched_by)
  );
  assert.strictEqual(
    r.optimizes === null,
    r.watched_by === null,
    r.id + ' declares optimizes=' + JSON.stringify(r.optimizes) + ' but watched_by=' +
      JSON.stringify(r.watched_by) + '; both must be null together or non-null together'
  );
}
const pairedCount = SENS_PRIORITY.filter((r) => r.optimizes !== null).length;
ok('every SENS_PRIORITY record declares a coherent optimizes/watched_by pairing (' + pairedCount + ' of ' + SENS_PRIORITY.length + ' paired, rest explicit null)');

console.log('');
console.log('PASS test-245-priority-complete.cjs (' + checks + ' checks)');
