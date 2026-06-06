'use strict';
/*
 * Phase 143-02 Task 3 -- SENS-07 gate-approach loop-fires test.
 *
 * SENS-07 is a net-new state-pattern detector over the SHIPPED Phase 120
 * breakthrough scanner (lib/core/breakthrough/scanner.cjs::scanForBreakthroughs)
 * + the agents/investor.md objection surface. When the venture nears a gate /
 * milestone -- tuple.stage in {Well-Defined Problem, Ready to Build} near a
 * commit, or a STATE.md venture_stage advance toward a commit decision -- the
 * sensor surfaces the candidate reach dispatching the breakthrough scan
 * (Category G) + the investor-objection surface. It does NOT re-run the scanner
 * inline and does NOT re-implement breakthrough scoring (Canon Part 7).
 *
 * Loop-fires assertions:
 *   1. A gate-approach tuple (stage in {Well-Defined Problem, Ready to Build})
 *      returns a reach whose dispatch references the breakthrough scan +
 *      agents/investor.
 *   2. An early-stage tuple (Pre-Opportunity / Opportunity Identified) returns
 *      null (no gate approaching).
 *   3. The reach references the shipped scanner + investor; the sensor does not
 *      re-implement scoring (asserted structurally: dispatch is a handle string).
 *   4. dispatchSensors INCLUDES the SENS-07 reach when a gate is approaching.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const detector = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-gate-approach.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

(function test_firesOnWellDefinedProblem() {
  const label = 'SENS-07 fires on a Well-Defined Problem stage -> breakthrough scan + investor reach';
  try {
    const tuple = { problem_type: 'wicked', complexity: 'complex', stage: 'Well-Defined Problem' };
    const reach = detector.sensorGateApproach({ signals: [] }, tuple, {});
    assert.ok(reach && typeof reach === 'object', label + ': must return a reach');
    assert.match(reach.dispatch, /breakthrough|scanForBreakthroughs|investor/,
      label + ': dispatch references the shipped breakthrough scanner + investor surface');
    const joined = (reach.dispatch + '|' + reach.companions.join('|'));
    assert.match(joined, /investor/, label + ': the investor-objection surface is co-surfaced');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_firesOnReadyToBuild() {
  const label = 'SENS-07 fires on a Ready to Build stage (commit-near)';
  try {
    const reach = detector.sensorGateApproach({}, { stage: 'Ready to Build' }, {});
    assert.ok(reach, label + ': fires on Ready to Build');
    assert.match(reach.dispatch, /breakthrough|scanForBreakthroughs|investor/, label + ': dispatches breakthrough/investor');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_firesOnLocalVentureStageAdvance() {
  const label = 'SENS-07 fires on a LOCAL ctx.venture_stage commit-near signal';
  try {
    const reach = detector.sensorGateApproach({}, { stage: 'unknown' }, { venture_stage: 'Ready to Build' });
    assert.ok(reach, label + ': fires on a commit-near LOCAL venture_stage');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_earlyStageReturnsNull() {
  const label = 'SENS-07 returns null at early stages (Pre-Opportunity / Opportunity Identified)';
  try {
    assert.equal(detector.sensorGateApproach({}, { stage: 'Pre-Opportunity' }, {}), null, label + ': Pre-Opportunity -> null');
    assert.equal(detector.sensorGateApproach({}, { stage: 'Opportunity Identified' }, {}), null, label + ': Opportunity Identified -> null');
    assert.equal(detector.sensorGateApproach(null, null, null), null, label + ': null inputs -> null (never throws)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_dispatchIncludesSens07() {
  const label = 'dispatchSensors includes the SENS-07 reach when a gate is approaching';
  try {
    const out = sensors.dispatchSensors({ signals: [] }, { stage: 'Well-Defined Problem' }, {});
    assert.ok(Array.isArray(out), label + ': array');
    const sens07 = out.find(function (r) { return /breakthrough|investor/.test(r.dispatch); });
    assert.ok(sens07, label + ': a breakthrough/investor reach is in the dispatch output');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('SENS-07 gate-approach loop-fires: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
