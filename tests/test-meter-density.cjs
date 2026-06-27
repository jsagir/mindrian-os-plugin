'use strict';
/*
 * Phase 183-01 METER-01 RED pin: the Gauge-1 invocation-density reader. RED until
 * Task 3 ships lib/core/meter/gate-density-reader.cjs; GREEN after. Exercises the
 * roomState injection seam so the floor runs db-free (no live room.db).
 *
 * Canon Part 8: zero Brain / network. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const m = require(
  path.join(REPO_ROOT, 'lib', 'core', 'meter', 'gate-density-reader.cjs')
);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

ok('computeInvocationDensity is exported', typeof m.computeInvocationDensity === 'function');

// cold-start on a null db: a zeroed object, never a throw.
const cold = m.computeInvocationDensity(null, 0, {});
ok('cold-start returns an object', !!cold && typeof cold === 'object');
ok('carries gate_reaches', Object.prototype.hasOwnProperty.call(cold, 'gate_reaches'));
ok('carries reach_presentations', Object.prototype.hasOwnProperty.call(cold, 'reach_presentations'));
ok('carries framework_invocations', Object.prototype.hasOwnProperty.call(cold, 'framework_invocations'));
ok('carries density', Object.prototype.hasOwnProperty.call(cold, 'density'));
ok('carries denominator_unit', Object.prototype.hasOwnProperty.call(cold, 'denominator_unit'));
ok('denominator_unit is gate_reached (Open Question 2)', cold.denominator_unit === 'gate_reached');
ok('cold gate_reaches is 0', cold.gate_reaches === 0);
ok('cold density is 0 (guarded div-by-zero)', cold.density === 0);

// roomState injection seam: a db-free run with injected counters. The density basis
// leans on reach_presented + gate_reached (the events that actually fire);
// framework_invocations is an additive term that reads ~0 today (Open Question 1).
const injected = m.computeInvocationDensity(null, 0, {
  gate_reaches: 4,
  reach_presentations: 9,
  framework_invocations: 0,
});
ok('injected gate_reaches honored', injected.gate_reaches === 4);
ok('injected reach_presentations honored', injected.reach_presentations === 9);
ok('framework_invocations additive term reads 0', injected.framework_invocations === 0);
ok('density is positive when invocations are present', injected.density > 0);

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-meter-density.cjs: PASSED');
