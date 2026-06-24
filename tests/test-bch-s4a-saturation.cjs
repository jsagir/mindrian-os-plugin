#!/usr/bin/env node
'use strict';
/*
 * Phase 177-04 Task 2 -- BCH-S4a saturation by turn-count + node-delta.
 * =====================================================================
 *
 * THE PROOF this suite makes: saturation fires DETERMINISTICALLY on the
 * "turn 8+, no new nodes" condition (turn_count >= 8 AND node_delta === 0) and
 * NOT otherwise. The helper is defensive (absent / non-number inputs -> false,
 * never throws) and opens NO db read -- it consumes an already-computed
 * node_delta scalar passed on the turn/ctx (the cheap created_at window query is
 * the navigation.cjs chokepoint's job, keeping dispatchSensors pure per the :8
 * contract). When a turn IS saturated, dispatchSensors enriches the dispatch
 * COPY with a 'saturation' signal kind while the caller's turn object gains zero
 * keys (the D-03a no-mutation guarantee).
 *
 * This is a deterministic SIGNAL only -- it fires NO reach, composes NO dial,
 * emits NO model cue (the "circling 3+ turns" cue wiring is BCH-S4b, Wave 4,
 * behind BCH-CAL). It reads the turn_count BCH-S1 (177-01) established; node_delta
 * + turn_count stay LOCAL (Canon Part 8 -- no Brain wire).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const sensors = require(path.join(ROOT, 'lib', 'core', 'insight-sensors.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok   ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}
function check(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

console.log('--- test-bch-s4a-saturation ---');

const isSaturated = sensors.isSaturated;

check('isSaturated is exported', () => {
  assert.equal(typeof isSaturated, 'function', 'isSaturated must be a function');
});

// The "turn 8+, no new nodes" condition.
check('saturated at turn_count 8 with node_delta 0', () => {
  assert.equal(isSaturated({ turn_count: 8, node_delta: 0 }), true);
});
check('saturated at turn_count 12 with node_delta 0 (deeper into the conversation)', () => {
  assert.equal(isSaturated({ turn_count: 12, node_delta: 0 }), true);
});

// New nodes since last turn -> not saturated (the venture is still moving).
check('NOT saturated at turn_count 8 with node_delta 3 (new nodes)', () => {
  assert.equal(isSaturated({ turn_count: 8, node_delta: 3 }), false);
});
check('NOT saturated at turn_count 8 with node_delta 1', () => {
  assert.equal(isSaturated({ turn_count: 8, node_delta: 1 }), false);
});

// Before turn 8 -> not saturated (too early).
check('NOT saturated at turn_count 5 with node_delta 0 (too early)', () => {
  assert.equal(isSaturated({ turn_count: 5, node_delta: 0 }), false);
});
check('NOT saturated at turn_count 7 with node_delta 0 (boundary: 8 is inclusive)', () => {
  assert.equal(isSaturated({ turn_count: 7, node_delta: 0 }), false);
});

// Defensive: absent / non-number inputs -> false, never throws.
check('NOT saturated on empty object (defensive)', () => {
  assert.equal(isSaturated({}), false);
});
check('NOT saturated on non-number turn_count (defensive)', () => {
  assert.equal(isSaturated({ turn_count: 'x', node_delta: 0 }), false);
});
check('NOT saturated on non-number node_delta (defensive)', () => {
  assert.equal(isSaturated({ turn_count: 8, node_delta: 'x' }), false);
});
check('NOT saturated on undefined arg (defensive, never throws)', () => {
  assert.equal(isSaturated(undefined), false);
});
check('NOT saturated on null arg (defensive, never throws)', () => {
  assert.equal(isSaturated(null), false);
});
check('NOT saturated on negative node_delta (defensive)', () => {
  // node_delta is a count of new nodes; a negative value is malformed -> not saturated.
  assert.equal(isSaturated({ turn_count: 8, node_delta: -1 }), false);
});

// A saturated dispatch enriches the COPY with a 'saturation' signal kind while
// the caller's turn object gains zero keys.
check('saturated dispatch enriches the copy with a saturation signal; caller turn unmutated', () => {
  const turn = {
    userText: 'still going in circles on the same point',
    turn_count: 8,
    node_delta: 0,
  };
  const callerKeysBefore = Object.keys(turn).sort();
  const tuple = { problem_type: 'undefined' };
  const ctx = { roomDir: '' };

  const normalized = sensors.normalizeTurn(turn, ctx, tuple);
  const sigKinds = (Array.isArray(normalized.signals) ? normalized.signals : []).map(
    (s) => (typeof s === 'string' ? s : (s && typeof s === 'object' ? s.kind : ''))
  );
  assert.notEqual(sigKinds.indexOf('saturation'), -1, "the normalized COPY must carry a 'saturation' signal; got " + JSON.stringify(sigKinds));

  // The caller's turn object gains zero keys (D-03a no-mutation guarantee).
  const callerKeysAfter = Object.keys(turn).sort();
  assert.deepEqual(callerKeysAfter, callerKeysBefore, 'the caller turn object must not gain keys');
});

check('a NON-saturated turn does NOT carry a saturation signal on the copy', () => {
  const turn = { userText: 'new direction', turn_count: 8, node_delta: 4 };
  const normalized = sensors.normalizeTurn(turn, { roomDir: '' }, { problem_type: 'undefined' });
  const sigKinds = (Array.isArray(normalized.signals) ? normalized.signals : []).map(
    (s) => (typeof s === 'string' ? s : (s && typeof s === 'object' ? s.kind : ''))
  );
  assert.equal(sigKinds.indexOf('saturation'), -1, 'a moving turn must not be flagged saturated');
});

// The saturation signal does NOT itself fire a reach (it is a SIGNAL only;
// the cue wiring is BCH-S4b, Wave 4). Driving a saturated turn through the real
// dispatchSensors must not surface a reach SOLELY because of saturation.
check('saturation alone fires no reach (signal only, not a reach)', () => {
  const turn = { userText: 'circling the same point with nothing new', turn_count: 8, node_delta: 0 };
  const reaches = sensors.dispatchSensors(turn, { problem_type: 'undefined' }, { roomDir: '' });
  // No sensor in the registry fires on a bare 'saturation' signal with empty
  // generic text, so the result must be empty (saturation did not mint a reach).
  const fromSaturation = reaches.filter((r) => r && r.signal === 'saturation');
  assert.equal(fromSaturation.length, 0, 'saturation must not fire a reach: ' + JSON.stringify(fromSaturation));
});

console.log('');
console.log('  passed: ' + passed + '   failed: ' + failed);
if (failed > 0) process.exit(1);
console.log('PASS test-bch-s4a-saturation');
process.exit(0);
