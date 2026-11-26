#!/usr/bin/env node
'use strict';
/*
 * Phase 400.4-01: SENS-SHOW must not fire on "show me" or "show us" read as "tell me".
 * Legs S1 to S4. Plain node:assert script. Exit 1 on any failure.
 * House rule: hyphens only.
 */
const assert = require('node:assert/strict');
const path = require('node:path');

const { sensorShowShare } = require(path.join(__dirname, '..', 'lib', 'core', 'sensors', 'sensor-show-share.cjs'));

let failed = 0;
function leg(name, fn) {
  try { fn(); console.log('  ok - ' + name); } catch (e) { failed += 1; console.log('  FAIL - ' + name + ': ' + (e && e.message)); }
}
function run(text, tuple) { return sensorShowShare({ text: text, signals: [] }, tuple || {}, {}); }

leg('S1 "show me what the room says about pricing" does not fire', function () {
  assert.equal(run('show me what the room says about pricing'), null);
});

leg('S2 "Show us the gaps" and "can you show me the evidence" do not fire', function () {
  assert.equal(run('Show us the gaps'), null);
  assert.equal(run('can you show me the evidence'), null);
});

leg('S3 real share intent still fires with the right term', function () {
  const a = run('I want to show my work to the board');
  assert.ok(a, 'show my work fires');
  assert.equal(a.evidence.mode, 'keyword');
  assert.equal(a.evidence.matched_term || a.matched_term || 'show', 'show');
  assert.ok(run('share this with my team'), 'share fires');
  assert.ok(run('publish the deck'), 'publish fires');
  assert.ok(run('show me the room, then show my work to the board'), 'a later real show still fires');
});

leg('S4 an explicit signal and a present problem_type still fire on "show me"', function () {
  const bySignal = sensorShowShare({ text: 'show me', signals: ['show_share_intent'] }, {}, {});
  assert.ok(bySignal);
  assert.equal(bySignal.evidence.mode, 'signal');
  const byContext = sensorShowShare({ text: 'show me', signals: [] }, { problem_type: 'present' }, {});
  assert.ok(byContext);
});

if (failed > 0) { console.log('test-400.4-show-me: ' + failed + ' leg(s) FAILED'); process.exit(1); }
console.log('test-400.4-show-me: legs S1-S4 PASSED');
