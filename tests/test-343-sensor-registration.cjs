'use strict';
/*
 * tests/test-343-sensor-registration.cjs -- Phase 343 Plan 06.
 *
 * Pins SENS-19 (lib/core/sensors/sensor-graph-integrity.cjs): the pure
 * detector's threshold/exclusion/frozen/sync contract (Task 1), the six
 * in-file registration places (Task 2), and the ctx producer block proved
 * through decide() end to end (Task 3). See docs/343-ROOM-GRAPH-CENSUS-
 * DECISIONS.md WD-6/WD-7/WD-19 for the ruled decisions this file pins.
 *
 * Bare node script: assert, an ok(label) counter, no framework, non-zero
 * exit on any assertion failure (uncaught throw), self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const DETECTOR_PATH = path.join(REPO, 'lib', 'core', 'sensors', 'sensor-graph-integrity.cjs');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-343-sensor-registration:');

// ---------------------------------------------------------------------------
// Task 1: the pure detector.
// ---------------------------------------------------------------------------

const { sensorGraphIntegrity, INTEGRITY_DEFECT_THRESHOLD } = require(DETECTOR_PATH);

assert.strictEqual(typeof sensorGraphIntegrity, 'function', 'sensorGraphIntegrity must be exported as a function');
assert.strictEqual(typeof INTEGRITY_DEFECT_THRESHOLD, 'number', 'INTEGRITY_DEFECT_THRESHOLD must be a number');
ok('the detector and its threshold constant are exported with the right types');

assert.strictEqual(
  sensorGraphIntegrity.constructor.name,
  'Function',
  'sensorGraphIntegrity must not be async (an async fn constructor.name is AsyncFunction)'
);
ok('sensorGraphIntegrity is not async');

assert.strictEqual(sensorGraphIntegrity({}, {}, {}), null, 'an absent ctx.graph_integrity must return null');
assert.strictEqual(
  sensorGraphIntegrity({}, {}, { graph_integrity: 'not-an-object' }),
  null,
  'a non-object ctx.graph_integrity must return null'
);
assert.strictEqual(sensorGraphIntegrity({}, {}, null), null, 'a null ctx must return null, never throw');
assert.strictEqual(sensorGraphIntegrity({}, {}, undefined), null, 'an undefined ctx must return null, never throw');
ok('absent/malformed ctx.graph_integrity returns null and never throws');

const belowThreshold = sensorGraphIntegrity({}, {}, {
  graph_integrity: { edge_rows_missing_endpoint: 1, claim_nodes_no_anchor_new: 1, schema_variant: 'migrated' },
});
assert.strictEqual(belowThreshold, null, 'a sum below INTEGRITY_DEFECT_THRESHOLD must return null');
ok('a sum below threshold returns strictly null');

const fired = sensorGraphIntegrity({}, {}, {
  graph_integrity: { edge_rows_missing_endpoint: 26, claim_nodes_no_anchor_new: 0, schema_variant: 'migrated' },
});
assert.ok(fired, 'a sum above threshold must fire');
assert.strictEqual(fired.reach_id, 'contradiction', 'SENS-19 must reuse the frozen contradiction reach, mint no seventh');
assert.strictEqual(fired.posture, 'hold', 'SENS-19 is a standing offer, never auto-run');
assert.strictEqual(fired.dispatch, 'room-graph-integrity');
assert.strictEqual(fired.signal, 'graph_integrity_threshold');
assert.ok(Object.isFrozen(fired), 'the returned reach must be frozen');
assert.ok(Object.isFrozen(fired.evidence), 'the reach evidence must be frozen');
ok('a threshold-crossing ctx fires the frozen contradiction/hold reach with the right dispatch and signal');

for (const k of Object.keys(fired.evidence)) {
  const v = fired.evidence[k];
  const t = typeof v;
  assert.ok(t === 'string' || t === 'number' || t === 'boolean', 'evidence.' + k + ' must be a flat scalar, got ' + t);
}
ok("the fired reach's evidence carries flat scalars only");

const excludedOnly = sensorGraphIntegrity({}, {}, {
  graph_integrity: {
    claim_nodes_no_anchor_legacy: 9999,
    edge_rows_type_outside_allowlist: 9999,
    edge_rows_missing_endpoint: 0,
    claim_nodes_no_anchor_new: 0,
  },
});
assert.strictEqual(excludedOnly, null, 'the two fleet-wide excluded classes must never trigger the sensor on their own');
ok('the two fleet-wide-explained classes (legacy anchor cohort, edge-type-outside-allowlist) cannot trigger it');

let legacyThrew = false;
let legacyResult;
try {
  legacyResult = sensorGraphIntegrity({}, {}, {
    graph_integrity: {
      edge_rows_missing_endpoint: 0,
      claim_nodes_no_anchor_new: null,
      claim_nodes_no_anchor_legacy: null,
      proposed_nodes_past_window: null,
      schema_variant: 'legacy',
    },
  });
} catch (_e) {
  legacyThrew = true;
}
assert.strictEqual(legacyThrew, false, 'a legacy-schema ctx with null fields must never throw');
assert.strictEqual(legacyResult, null, 'a legacy-schema ctx with null trigger fields must return null');
ok('a legacy-schema ctx (null trigger fields) returns null and never throws');

const detectorSource = fs.readFileSync(DETECTOR_PATH, 'utf8');
assert.strictEqual(/navigation-engine/.test(detectorSource), false, 'the detector must never reference navigation-engine');
ok('the detector file contains no reference to navigation-engine (the routing fence)');

// ---------------------------------------------------------------------------
// Task 2: the six in-file registration places.
// ---------------------------------------------------------------------------

const insightSensors = require(path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'));
const { SENSOR_REGISTRY, SENSOR_REGISTRY_IDS } = insightSensors;
const { SENS_PRIORITY, sensorPriorityRank } = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-priority.cjs'));

assert.strictEqual(
  SENSOR_REGISTRY.length,
  SENSOR_REGISTRY_IDS.length,
  'SENSOR_REGISTRY and SENSOR_REGISTRY_IDS must stay the same length'
);
ok('SENSOR_REGISTRY and SENSOR_REGISTRY_IDS are the same length');

const sens19Index = SENSOR_REGISTRY_IDS.indexOf('SENS-19');
assert.notStrictEqual(sens19Index, -1, 'SENSOR_REGISTRY_IDS must contain SENS-19');
assert.strictEqual(
  SENSOR_REGISTRY_IDS.indexOf('SENS-19', sens19Index + 1),
  -1,
  'SENSOR_REGISTRY_IDS must contain SENS-19 exactly once'
);
assert.strictEqual(
  SENSOR_REGISTRY[sens19Index],
  sensorGraphIntegrity,
  "SENSOR_REGISTRY_IDS's SENS-19 index must point at the same function as sensorGraphIntegrity"
);
ok('SENSOR_REGISTRY_IDS names SENS-19 exactly once, at the index whose SENSOR_REGISTRY entry is the detector function');

assert.strictEqual(insightSensors.sensorGraphIntegrity, sensorGraphIntegrity, 'insight-sensors.cjs must export sensorGraphIntegrity by name');
ok('sensorGraphIntegrity is present on the module exports');

const sens19Record = SENS_PRIORITY.find((r) => r.id === 'SENS-19');
assert.ok(sens19Record, 'SENS_PRIORITY must contain a SENS-19 record');
for (const key of ['id', 'optimizes', 'watched_by', 'why']) {
  assert.ok(Object.prototype.hasOwnProperty.call(sens19Record, key), 'the SENS-19 record must carry its own "' + key + '" key');
}
ok('SENS_PRIORITY contains a SENS-19 record with all four keys');

assert.ok(
  sensorPriorityRank('SENS-19') < sensorPriorityRank('SENS-16'),
  'SENS-19 must outrank SENS-16 (SENS-19 is Group A, SENS-16 is Group D)'
);
ok('sensorPriorityRank(SENS-19) is less than sensorPriorityRank(SENS-16): Group A placement took effect');

console.log('');
console.log('PASS test-343-sensor-registration.cjs (' + checks + ' checks so far)');
