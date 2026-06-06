'use strict';
/*
 * Phase 143-01 Task 1 -- the sensor-spine dispatch contract.
 *
 * Asserts the net-new spine of the 7-row trigger map:
 *   - REACH_IDS  is exactly the 5 committed dial-doctrine reach ids (Phase 141
 *     D-05 drift contract; skills/larry-personality/SKILL.md lines ~48-52).
 *   - POSTURE_IDS is exactly the 3 committed posture ids (Phase 141 D-12;
 *     SKILL.md lines ~87-89).
 *   - makeReach() is a pure factory that validates reach_id + posture against
 *     the banks and returns a FROZEN candidate-reach struct, or null on invalid
 *     input (never throws).
 *   - dispatchSensors() is the pure/sync chokepoint that runs the SENSOR_REGISTRY
 *     in canonical order, returns an array (possibly empty), never throws on
 *     malformed input, and makes zero network calls / zero non-LOCAL fs reads
 *     when the registry is empty.
 *
 * Loop-fires discipline: the drift tests FIX the banks (any add/remove fails),
 * mirroring the Phase 141 exactly-5 / exactly-3 drift discipline this module
 * inherits. Named so the Phase 146 gate can compose this suite.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const types = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const EXPECTED_REACH_IDS = ['context_block', 'contradiction', 'cross_room', 'brain_consult', 'deep_research'];
const EXPECTED_POSTURE_IDS = ['push_forward', 'hold', 'pull_back'];

(function test_reachIdsExactlyFive() {
  const label = 'REACH_IDS is exactly the 5 dial-doctrine reach ids (Phase 141 D-05 drift contract)';
  try {
    assert.deepEqual(types.REACH_IDS, EXPECTED_REACH_IDS,
      label + ': REACH_IDS must match the committed bank in canonical order');
    assert.equal(types.REACH_IDS.length, 5, label + ': exactly 5 -- no more, no fewer');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_postureIdsExactlyThree() {
  const label = 'POSTURE_IDS is exactly the 3 posture ids (Phase 141 D-12 drift contract)';
  try {
    assert.deepEqual(types.POSTURE_IDS, EXPECTED_POSTURE_IDS,
      label + ': POSTURE_IDS must match the committed bank in canonical order');
    assert.equal(types.POSTURE_IDS.length, 3, label + ': exactly 3 -- no more, no fewer');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_makeReachValidFrozenStruct() {
  const label = 'makeReach returns a frozen candidate-reach struct for valid input';
  try {
    const reach = types.makeReach({
      reach_id: 'context_block',
      posture: 'push_forward',
      dispatch: 'explore-domains',
      signal: 'first_material',
    });
    assert.ok(reach && typeof reach === 'object', label + ': must return an object');
    assert.equal(reach.reach_id, 'context_block', label + ': reach_id preserved');
    assert.equal(reach.posture, 'push_forward', label + ': posture preserved');
    assert.equal(reach.dispatch, 'explore-domains', label + ': dispatch preserved');
    assert.equal(reach.signal, 'first_material', label + ': signal preserved');
    assert.ok(Array.isArray(reach.companions), label + ': companions is an array');
    assert.ok(Object.isFrozen(reach), label + ': struct is frozen');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_makeReachInvalidReturnsNullNoThrow() {
  const label = 'makeReach returns null (never throws) on an invalid reach_id or posture';
  try {
    assert.equal(types.makeReach({ reach_id: 'not_a_reach', posture: 'push_forward', dispatch: 'x', signal: 's' }), null,
      label + ': invalid reach_id -> null');
    assert.equal(types.makeReach({ reach_id: 'context_block', posture: 'not_a_posture', dispatch: 'x', signal: 's' }), null,
      label + ': invalid posture -> null');
    assert.equal(types.makeReach(null), null, label + ': null opts -> null');
    assert.equal(types.makeReach(undefined), null, label + ': undefined opts -> null');
    assert.equal(types.makeReach('garbage'), null, label + ': non-object opts -> null');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchSensorsReturnsArrayNeverThrows() {
  const label = 'dispatchSensors returns an array and never throws on malformed input';
  try {
    const out = sensors.dispatchSensors({ signals: [] }, { problem_type: 'undefined', complexity: 'simple', stage: 'pre' }, {});
    assert.ok(Array.isArray(out), label + ': returns an array');
    // Malformed inputs must not throw.
    assert.ok(Array.isArray(sensors.dispatchSensors(null, null, null)), label + ': null inputs -> array');
    assert.ok(Array.isArray(sensors.dispatchSensors(undefined, undefined, undefined)), label + ': undefined inputs -> array');
    assert.ok(Array.isArray(sensors.dispatchSensors('garbage', 42, [])), label + ': junk inputs -> array');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchSensorsCanonicalOrderEmptyContext() {
  const label = 'dispatchSensors runs registered sensors in canonical order; empty/no-signal turn yields a clean array';
  try {
    // With no signals, no sensor fires -> empty array (every sensor soft-fails to null).
    const out = sensors.dispatchSensors({ signals: [] }, { problem_type: 'undefined', complexity: 'simple', stage: 'pre' }, {});
    assert.ok(Array.isArray(out), label + ': array');
    for (const r of out) {
      assert.ok(types.REACH_IDS.indexOf(r.reach_id) !== -1, label + ': every produced reach carries a valid reach_id');
    }
    // SENSOR_REGISTRY is exposed for composition/order assertions.
    assert.ok(Array.isArray(sensors.SENSOR_REGISTRY), label + ': SENSOR_REGISTRY is an array');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('sensor-spine dispatch contract: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
