'use strict';
/*
 * Phase 143-01 Task 2 -- SENS-01 first-material loop-fires test.
 *
 * SENS-01 is PARTIAL over the shipped Phase 117 auto-explore path
 * (scripts/auto-explore-fire.cjs). It does NOT re-run the pipeline; it SURFACES
 * the candidate reach the shipped path represents, and ATTACHES the
 * brain_framework_chain companion carrying ONLY the problem_type enum (Part 8).
 *
 * Loop-fires assertions:
 *   1. Given a turn carrying the first-material signal + a tuple with
 *      problem_type='undefined', sensorFirstMaterial returns a reach with
 *      reach_id='context_block', posture 'push_forward', a dispatch referencing
 *      the explore-domains/whitespace path, and a companion
 *      'brain_framework_chain:undefined' (generic enum handle only).
 *   2. Given NO first-material signal, sensorFirstMaterial returns null.
 *   3. Part-8 no-leak: a turn carrying user artifact TEXT does NOT surface that
 *      text anywhere in the returned reach (LOCAL -> Brain: NO). Only the
 *      problem_type enum rides the companion.
 *   4. Dispatch-level: with the first-material signal, dispatchSensors INCLUDES
 *      the SENS-01 reach (the sensor is registered).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const SECRET = 'ACME proprietary CAR-T financial model: $4.2M burn, 18mo runway';

(function test_firesOnFirstMaterial() {
  const label = 'SENS-01 fires on first-material -> context_block reach + brain_framework_chain companion';
  try {
    const turn = { signals: ['first_material'] };
    const tuple = { problem_type: 'undefined', complexity: 'simple', stage: 'pre-opportunity' };
    const reach = sensors.sensorFirstMaterial(turn, tuple, { roomDir: '/tmp/nonexistent-room' });

    assert.ok(reach && typeof reach === 'object', label + ': must return a reach');
    assert.equal(reach.reach_id, 'context_block', label + ": reach_id is 'context_block'");
    assert.equal(reach.posture, 'push_forward', label + ": posture is 'push_forward'");
    assert.match(reach.dispatch, /explore-domains|whitespace|auto-explore/,
      label + ': dispatch references the shipped explore-domains/whitespace path');
    assert.ok(Array.isArray(reach.companions), label + ': companions is an array');
    assert.ok(reach.companions.indexOf('brain_framework_chain:undefined') !== -1,
      label + ": companions include 'brain_framework_chain:undefined' (generic enum handle)");
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_noSignalReturnsNull() {
  const label = 'SENS-01 returns null when no first-material signal is present';
  try {
    const reach = sensors.sensorFirstMaterial({ signals: [] }, { problem_type: 'wicked' }, {});
    assert.equal(reach, null, label + ': no signal -> null');
    assert.equal(sensors.sensorFirstMaterial(null, null, null), null, label + ': null turn -> null (never throws)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_part8NoLeak() {
  const label = 'SENS-01 Part-8: user artifact text does NOT appear in the returned reach (LOCAL -> Brain: NO)';
  try {
    const turn = { signals: ['first_material'], artifact_text: SECRET, body: SECRET };
    const tuple = { problem_type: 'wicked', complexity: 'wicked', stage: 'opportunity', artifact_body: SECRET };
    const reach = sensors.sensorFirstMaterial(turn, tuple, { roomDir: '/tmp/x', artifact: SECRET });

    assert.ok(reach, label + ': fires');
    const serialized = JSON.stringify(reach);
    assert.equal(serialized.indexOf(SECRET), -1, label + ': the secret artifact text must NOT appear anywhere in the reach');
    assert.equal(serialized.indexOf('ACME'), -1, label + ': no fragment of user content leaks');
    // The companion must carry ONLY the problem_type enum.
    assert.ok(reach.companions.indexOf('brain_framework_chain:wicked') !== -1,
      label + ": companion carries only the problem_type enum ('wicked')");
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchIncludesSens01() {
  const label = 'dispatchSensors includes the SENS-01 reach when the first-material signal fires (sensor registered)';
  try {
    const out = sensors.dispatchSensors(
      { signals: ['first_material'] },
      { problem_type: 'undefined', complexity: 'simple', stage: 'pre' },
      { roomDir: '/tmp/x' }
    );
    assert.ok(Array.isArray(out), label + ': array');
    const sens01 = out.find(function (r) { return r.reach_id === 'context_block'; });
    assert.ok(sens01, label + ': a context_block reach is in the dispatch output');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('SENS-01 first-material loop-fires: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
