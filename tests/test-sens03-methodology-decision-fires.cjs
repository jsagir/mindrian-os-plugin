'use strict';
/*
 * Phase 143-02 Task 2 -- SENS-03 methodology-decision loop-fires test.
 *
 * SENS-03 is a net-new detector that finally AUTO-INVOKES the EXISTING
 * brain_framework_chain CHAINS_TO pattern (references/brain/query-patterns.md
 * Section 1). When a methodology completes / a decision point is reached / the
 * Decision Gate verb-1 context lands, the sensor surfaces a brain_consult
 * candidate reach whose companion is brain_framework_chain carrying ONLY generic
 * handles: the framework NAMES (from the LOCAL methodology cache) + the
 * problem_type ENUM. Never artifact bodies / identifiers (Canon Part 8).
 *
 * Loop-fires assertions:
 *   1. A turn with a methodology-decision signal + a tuple with problem_type and
 *      current_frameworks returns a reach with reach_id='brain_consult' and a
 *      companion naming brain_framework_chain with the framework-name handles +
 *      the problem_type enum.
 *   2. No methodology-decision signal -> null.
 *   3. Part-8 no-leak: a fixture turn carrying artifact TEXT yields a reach whose
 *      serialized form contains NONE of that text (LOCAL -> Brain: NO). Only
 *      framework names + the problem_type enum ride the companion.
 *   4. dispatchSensors INCLUDES the SENS-03 reach when the signal fires.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const detector = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-methodology-decision.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const SECRET = 'ACME proprietary CAR-T financial model: $4.2M burn, 18mo runway';

(function test_firesOnMethodologyDecision() {
  const label = 'SENS-03 fires on methodology-decision -> brain_consult + brain_framework_chain companion';
  try {
    const turn = { signals: ['methodology_completed'] };
    const tuple = {
      problem_type: 'wicked',
      complexity: 'wicked',
      stage: 'opportunity',
      current_frameworks: ['Beautiful Question Framework', 'Domain Selection'],
    };
    const reach = detector.sensorMethodologyDecision(turn, tuple, {});

    assert.ok(reach && typeof reach === 'object', label + ': must return a reach');
    assert.equal(reach.reach_id, 'brain_consult', label + ": reach_id is 'brain_consult'");
    assert.ok(Array.isArray(reach.companions), label + ': companions is an array');
    const chainCompanion = reach.companions.find(function (c) { return /brain_framework_chain/.test(c); });
    assert.ok(chainCompanion, label + ': a brain_framework_chain companion is present');
    // The companion must carry the problem_type enum + framework name handles.
    assert.match(chainCompanion, /wicked/, label + ': companion carries the problem_type enum');
    const joined = reach.companions.join('|');
    assert.match(joined, /Beautiful Question Framework/, label + ': companion carries framework-name handles');
    assert.match(joined, /Domain Selection/, label + ': companion carries all framework-name handles');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_decisionPointSignalAlsoFires() {
  const label = 'SENS-03 also fires on a "decision_point" / Decision Gate verb-1 signal';
  try {
    const r = detector.sensorMethodologyDecision(
      { signals: ['decision_point'] },
      { problem_type: 'ill-defined', current_frameworks: ['SWOT'] },
      {}
    );
    assert.ok(r && r.reach_id === 'brain_consult', label + ': decision_point fires brain_consult');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_noSignalReturnsNull() {
  const label = 'SENS-03 returns null when no methodology-decision signal is present';
  try {
    const reach = detector.sensorMethodologyDecision({ signals: ['first_material'] }, { problem_type: 'wicked' }, {});
    assert.equal(reach, null, label + ': no methodology-decision signal -> null');
    assert.equal(detector.sensorMethodologyDecision(null, null, null), null, label + ': null turn -> null (never throws)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_part8NoLeak() {
  const label = 'SENS-03 Part-8: user artifact text does NOT appear in the returned reach (LOCAL -> Brain: NO)';
  try {
    const turn = { signals: ['methodology_completed'], text: SECRET, artifact_body: SECRET };
    const tuple = {
      problem_type: 'wicked',
      current_frameworks: ['Porter Five Forces'],
      artifact_body: SECRET,
      notes: SECRET,
    };
    const reach = detector.sensorMethodologyDecision(turn, tuple, { roomDir: '/tmp/x', artifact: SECRET });

    assert.ok(reach, label + ': fires');
    const serialized = JSON.stringify(reach);
    assert.equal(serialized.indexOf(SECRET), -1, label + ': the secret artifact text must NOT appear anywhere in the reach');
    assert.equal(serialized.indexOf('ACME'), -1, label + ': no fragment of user content leaks');
    assert.equal(serialized.indexOf('4.2M'), -1, label + ': no proprietary number leaks');
    // Only the framework name + problem_type enum ride the companion.
    assert.match(reach.companions.join('|'), /Porter Five Forces/, label + ': framework name handle present');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchIncludesSens03() {
  const label = 'dispatchSensors includes the SENS-03 reach when the methodology-decision signal fires';
  try {
    const out = sensors.dispatchSensors(
      { signals: ['methodology_completed'] },
      { problem_type: 'wicked', current_frameworks: ['JTBD'] },
      {}
    );
    assert.ok(Array.isArray(out), label + ': array');
    const sens03 = out.find(function (r) { return r.reach_id === 'brain_consult'; });
    assert.ok(sens03, label + ': a brain_consult reach is in the dispatch output');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('SENS-03 methodology-decision loop-fires: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
