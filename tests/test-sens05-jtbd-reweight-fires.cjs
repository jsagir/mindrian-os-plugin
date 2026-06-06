'use strict';
/*
 * Phase 143-03 Task 2 -- SENS-05 JTBD set/changed re-weighting loop-fires test.
 *
 * SENS-05 is the consumer over the shipped-but-unconsumed Phase 104 JTBD signal
 * (lib/hmi/jtbd-state.cjs). When the room's JTBD is set or changed (the current
 * jtbd differs from the prior history transition), this sensor surfaces a reach
 * carrying the re-weight signal:
 *   - the serves_jtbd re-weight for the selector menu (the new JTBD slug, which
 *     f-selector-ranker consumes as roomState.activeJtbd), and
 *   - the ADDRESSES_PROBLEM_TYPE handle for the Brain-query weighting (the GENERIC
 *     problem-type enum only -- Canon Part 8).
 * The sensor does NOT re-rank inline; it surfaces the signal f-selector-ranker
 * consumes.
 *
 * Loop-fires assertions:
 *   1. Given a jtbd-state transition (current jtbd differs from the prior history
 *      row's `to`), sensorJtbdReweight returns a reach carrying the serves_jtbd
 *      re-weight + the ADDRESSES_PROBLEM_TYPE handle.
 *   2. Given no JTBD change (current == prior), it returns null (no spurious
 *      re-weight).
 *   3. Part-8 no-leak: the ADDRESSES_PROBLEM_TYPE handle carries ONLY the generic
 *      problem-type enum, never user content.
 *   4. dispatchSensors INCLUDES the SENS-05 reach when the JTBD changed.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const detector = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-jtbd-reweight.cjs'));
const jtbdState = require(path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const SECRET = 'ACME proprietary CAR-T burn rate 4.2M / 18 month runway';

// Build a throwaway room with a real jtbd-state.json via the shipped writer.
function makeRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sens05-'));
  return dir;
}

(function test_firesOnJtbdChange() {
  const label = 'SENS-05 fires on a JTBD set/change -> reach with serves_jtbd + ADDRESSES_PROBLEM_TYPE handle';
  try {
    const room = makeRoom();
    // First set: explore -> validate_assumptions (a transition row is written).
    jtbdState.setCurrent(room, { jtbd: 'validate_assumptions', confidence: 0.8, trigger: 'manual', evidence: [] });
    // Change: validate_assumptions -> reduce_time_to_decision (the change SENS-05 detects).
    jtbdState.setCurrent(room, { jtbd: 'reduce_time_to_decision', confidence: 0.9, trigger: 'manual', evidence: [] });

    const reach = detector.sensorJtbdReweight(
      { signals: ['jtbd_changed'] },
      { problem_type: 'wicked' },
      { roomDir: room }
    );
    assert.ok(reach && typeof reach === 'object', label + ': must return a reach');
    const joined = reach.companions.join('|');
    assert.match(joined, /serves_jtbd/, label + ': carries the serves_jtbd re-weight handle');
    assert.match(joined, /reduce_time_to_decision/, label + ': carries the new JTBD slug for the selector menu');
    assert.match(joined, /ADDRESSES_PROBLEM_TYPE/, label + ': carries the ADDRESSES_PROBLEM_TYPE Brain-query handle');
    assert.match(joined, /wicked/, label + ': the ADDRESSES_PROBLEM_TYPE handle carries the problem-type enum');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_noChangeReturnsNull() {
  const label = 'SENS-05 returns null when the JTBD has not changed (no spurious re-weight)';
  try {
    const room = makeRoom();
    // A single set: there is a current but no PRIOR transition to differ from,
    // and a re-set to the SAME jtbd must not fire.
    jtbdState.setCurrent(room, { jtbd: 'validate_assumptions', confidence: 0.8, trigger: 'manual', evidence: [] });
    jtbdState.setCurrent(room, { jtbd: 'validate_assumptions', confidence: 0.85, trigger: 'manual', evidence: [] });

    const reach = detector.sensorJtbdReweight(
      { signals: ['jtbd_changed'] },
      { problem_type: 'wicked' },
      { roomDir: room }
    );
    assert.equal(reach, null, label + ': same jtbd -> null');

    // No room state at all -> null (never throws).
    const empty = makeRoom();
    assert.equal(detector.sensorJtbdReweight({ signals: ['jtbd_changed'] }, {}, { roomDir: empty }), null, label + ': no state -> null');
    assert.equal(detector.sensorJtbdReweight(null, null, null), null, label + ': null ctx -> null (never throws)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_part8GenericHandleOnly() {
  const label = 'SENS-05 Part-8: the reach carries only the generic problem-type enum + JTBD slug, never user content';
  try {
    const room = makeRoom();
    // Inject the secret as evidence text on the state write -- it must NOT ride
    // the reach.
    jtbdState.setCurrent(room, { jtbd: 'validate_assumptions', confidence: 0.8, trigger: 'manual', evidence: [SECRET] });
    jtbdState.setCurrent(room, { jtbd: 'reduce_time_to_decision', confidence: 0.9, trigger: 'manual', evidence: [SECRET] });

    const reach = detector.sensorJtbdReweight(
      { signals: ['jtbd_changed'], text: SECRET },
      { problem_type: 'wicked', notes: SECRET },
      { roomDir: room, artifact: SECRET }
    );
    assert.ok(reach, label + ': fires');
    const serialized = JSON.stringify(reach);
    assert.equal(serialized.indexOf(SECRET), -1, label + ': the secret must NOT appear in the reach');
    assert.equal(serialized.indexOf('ACME'), -1, label + ': no fragment of user content leaks');
    assert.equal(serialized.indexOf('4.2M'), -1, label + ': no proprietary number leaks');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchIncludesSens05() {
  const label = 'dispatchSensors includes the SENS-05 reach when the JTBD changed';
  try {
    const room = makeRoom();
    jtbdState.setCurrent(room, { jtbd: 'explore', confidence: 0.7, trigger: 'manual', evidence: [] });
    jtbdState.setCurrent(room, { jtbd: 'validate_assumptions', confidence: 0.9, trigger: 'manual', evidence: [] });

    const out = sensors.dispatchSensors(
      { signals: ['jtbd_changed'] },
      { problem_type: 'ill-defined' },
      { roomDir: room }
    );
    assert.ok(Array.isArray(out), label + ': array');
    const sens05 = out.find(function (r) { return r.signal === 'jtbd_changed'; });
    assert.ok(sens05, label + ': a SENS-05 jtbd_changed reach is in the dispatch output');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('SENS-05 jtbd-reweight loop-fires: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
