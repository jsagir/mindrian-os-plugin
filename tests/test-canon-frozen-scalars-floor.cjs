'use strict';
/*
 * Phase 188-00 Wave 0 -- the frozen-scalar FLOOR test (SFS-11 guard).
 * =========================================================================
 * This test is GREEN NOW and MUST STAY GREEN. It is the guard the 188-05 canon
 * amendment writes AGAINST: the amendment may ADD Appendix D entries that restate
 * the frozen Part 3 scalars byte-identical, but it may NEVER change their values.
 *
 * The four frozen scalars (Part 3, MindrianOS constitution):
 *   MAX_K = 3           (the top-K option cap; NOT F.8's MAX_TOGGLE_N)
 *   DIAL_REACH_K = 6    (the frozen reach bank size; moved 5->6 at Phase 148, frozen since)
 *   0.70                (the RECOMMENDED-marker confidence gate)
 *   0.15                (the second gate scalar)
 *
 * Guard strategy: this test does NOT lock occurrence counts (the amendment adds
 * restatements, which is legal). It locks the VALUES: each scalar must be present
 * in its exact byte form, its drift-forms (e.g. MAX_K=4) must be ABSENT, and the
 * canonical composite anchor phrase must be byte-present. Any change to a value
 * flips this RED -- exactly the tamper the FLOOR test exists to catch (T-188-00-01).
 *
 * Read-only: this test never mutates a tracked file (Part 8: zero Brain/network).
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const canon = fs.readFileSync(CANON, 'utf8');

// ---- each frozen scalar is present in its exact byte form ----
ok('MAX_K=3 present (byte-identical)', canon.indexOf('MAX_K=3') !== -1);
ok('DIAL_REACH_K=6 present (byte-identical)', canon.indexOf('DIAL_REACH_K=6') !== -1);
ok('0.70 present (byte-identical)', canon.indexOf('0.70') !== -1);
ok('0.15 present (byte-identical)', canon.indexOf('0.15') !== -1);

// ---- the canonical composite anchor phrase is byte-present ----
ok('composite anchor "MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate" present',
  canon.indexOf('MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate') !== -1);

// ---- drift-forms MUST be absent (a value change would introduce one of these) ----
for (const bad of ['MAX_K=2', 'MAX_K=4', 'MAX_K=5']) {
  ok('no drift of MAX_K to ' + bad, canon.indexOf(bad) === -1);
}
for (const bad of ['DIAL_REACH_K=5', 'DIAL_REACH_K=7', 'DIAL_REACH_K=4']) {
  ok('no drift of DIAL_REACH_K to ' + bad, canon.indexOf(bad) === -1);
}
// The 0.70/0.15 gate: guard the composite form against a re-tuned pair.
for (const bad of ['0.80/0.15', '0.70/0.20', '0.75/0.15', '0.70/0.10']) {
  ok('no drift of the 0.70/0.15 gate to ' + bad, canon.indexOf(bad) === -1);
}

console.log('\nPASS test-canon-frozen-scalars-floor (' + pass + ' assertions)');
console.log('>>> test-canon-frozen-scalars-floor.cjs: PASSED');
