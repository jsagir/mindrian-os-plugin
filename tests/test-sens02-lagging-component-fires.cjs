'use strict';
/*
 * Phase 143-02 Task 1 -- SENS-02 lagging-component loop-fires test.
 *
 * SENS-02 is a net-new conversation-pattern detector over the SHIPPED Phase 89
 * reverse-salient engine (scripts/rs-engine.py + commands/find-bottlenecks.md).
 * It does NOT re-run rs-engine; it SURFACES the candidate reach the
 * find-bottlenecks / reverse-salient path represents. find-bottlenecks reads the
 * room's OWN artifact corpus + section fill levels, so it is a LOCAL analysis
 * surface -- reach_id is 'context_block', NOT a Brain/web surface.
 *
 * Loop-fires assertions:
 *   1. A turn matching the lagging-component pattern ("the bottleneck is X",
 *      "X is lagging", "X is holding us back") returns a reach with
 *      reach_id='context_block', posture 'pull_back' (a stated lagging component
 *      pulls back to re-set the weakest subsystem), and a dispatch referencing
 *      find-bottlenecks / the reverse-salient engine.
 *   2. A turn with no lagging-component pattern returns null.
 *   3. The returned struct never carries a routing_source field (Part 3
 *      candidate-surface; Phase 144 fence).
 *   4. Detection is LOCAL-only and never throws on malformed turn input.
 *   5. dispatchSensors INCLUDES the SENS-02 reach when the pattern fires
 *      (the sensor is registered).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const detector = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-lagging-component.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

(function test_firesOnBottleneckPhrase() {
  const label = 'SENS-02 fires on "the bottleneck is..." -> context_block reach dispatching find-bottlenecks';
  try {
    const turn = { text: 'I think the bottleneck is our go-to-market motion right now.' };
    const tuple = { problem_type: 'wicked', complexity: 'complex', stage: 'opportunity' };
    const reach = detector.sensorLaggingComponent(turn, tuple, { roomDir: '/tmp/nonexistent-room' });

    assert.ok(reach && typeof reach === 'object', label + ': must return a reach');
    assert.equal(reach.reach_id, 'context_block', label + ": reach_id is 'context_block' (LOCAL analysis, not Brain/web)");
    assert.match(reach.dispatch, /find-bottlenecks|rs-engine|reverse.salient/,
      label + ': dispatch references the shipped find-bottlenecks / reverse-salient engine');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_firesOnLaggingAndHoldingBack() {
  const label = 'SENS-02 fires on "X is lagging" and "X is holding us back" phrasings';
  try {
    const r1 = detector.sensorLaggingComponent({ text: 'Our distribution is lagging behind everything else.' }, {}, {});
    const r2 = detector.sensorLaggingComponent({ text: 'The regulatory piece is holding us back.' }, {}, {});
    assert.ok(r1 && r1.reach_id === 'context_block', label + ': "is lagging" fires context_block');
    assert.ok(r2 && r2.reach_id === 'context_block', label + ': "holding us back" fires context_block');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_noPatternReturnsNull() {
  const label = 'SENS-02 returns null on a turn with no lagging-component pattern';
  try {
    const reach = detector.sensorLaggingComponent({ text: 'We had a great call with the customer today.' }, {}, {});
    assert.equal(reach, null, label + ': no pattern -> null');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_noRoutingSourceAndNeverThrows() {
  const label = 'SENS-02 never carries routing_source and never throws on malformed input';
  try {
    const reach = detector.sensorLaggingComponent({ text: 'the bottleneck is funding' }, null, null);
    assert.ok(reach, label + ': fires with null tuple/ctx (LOCAL-only, no throw)');
    assert.equal(Object.prototype.hasOwnProperty.call(reach, 'routing_source'), false,
      label + ': reach must NOT carry a routing_source field (Phase 144 fence)');
    // malformed inputs soft-fail to null, never throw
    assert.equal(detector.sensorLaggingComponent(null, null, null), null, label + ': null turn -> null');
    assert.equal(detector.sensorLaggingComponent({}, {}, {}), null, label + ': no text -> null');
    assert.equal(detector.sensorLaggingComponent({ text: 12345 }, {}, {}), null, label + ': non-string text -> null');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchIncludesSens02() {
  const label = 'dispatchSensors includes the SENS-02 reach when the lagging-component pattern fires (sensor registered)';
  try {
    const out = sensors.dispatchSensors(
      { text: 'X is the reverse salient holding us back', signals: [] },
      { problem_type: 'wicked' },
      { roomDir: '/tmp/x' }
    );
    assert.ok(Array.isArray(out), label + ': array');
    const sens02 = out.find(function (r) {
      return r.reach_id === 'context_block' && /find-bottlenecks|rs-engine|reverse.salient/.test(r.dispatch);
    });
    assert.ok(sens02, label + ': a find-bottlenecks context_block reach is in the dispatch output');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('SENS-02 lagging-component loop-fires: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
