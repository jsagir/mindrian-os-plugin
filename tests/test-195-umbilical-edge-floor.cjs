'use strict';
/*
 * Phase 195-01 Wave 0 -- the UMBILICAL_TO edge-type FLOOR (FCM-11 guard).
 * =========================================================================
 * FLOOR discipline (the edges.cjs SHARES_JOB / ELEVATES_TO block states it verbatim):
 * assert named MEMBERSHIP of every edge type, NEVER an exact `.size` / count, so an
 * additive extension of ALLOWED_EDGE_TYPES cannot regress the baseline. This matters
 * doubly here: a parallel Phase-205 session is concurrently adding SHARES_JOB /
 * ELEVATES_TO to the SAME frozen Set, so a size assertion would race and flap.
 *
 * Two jobs:
 *   1. GREEN NOW: assert the current cross-room-relevant edge types are all present
 *      (NESTED_WITHIN, SHARES_JOB, ELEVATES_TO) plus the foundational decision pair
 *      (DEFERRED, REJECTED). This is the always-on floor.
 *   2. SKIP-SAFE until Wave 3: UMBILICAL_TO is minted later (195-04). Until it lands,
 *      this file self-skips the UMBILICAL_TO assertion (prints a SKIP notice, exits 0).
 *      The instant edges.cjs carries UMBILICAL_TO, the assertion auto-activates - no
 *      edit to this file needed to tighten the gate.
 *
 * Read-only: imports the frozen Set and probes membership; mutates nothing.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { ALLOWED_EDGE_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));

// The always-on FLOOR: these MUST be members. NESTED_WITHIN is the vertical room
// lineage edge UMBILICAL_TO contrasts with; SHARES_JOB / ELEVATES_TO are the
// Phase-205 concurrent additions the floor must tolerate (membership, never size).
const FLOOR_MEMBERS = ['DEFERRED', 'REJECTED', 'NESTED_WITHIN', 'SHARES_JOB', 'ELEVATES_TO'];

// The net-new member, minted in Wave 3 (195-04). As of that wave this is a HARD
// membership assertion, no longer SKIP-safe: UMBILICAL_TO is the PEER-to-peer
// cross-room edge type, contrasted with the VERTICAL NESTED_WITHIN lineage edge.
const NEW_EDGE = 'UMBILICAL_TO';

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// It IS a Set, and membership is the contract (never `.size`).
ok('ALLOWED_EDGE_TYPES is a Set instance', ALLOWED_EDGE_TYPES instanceof Set);

for (const t of FLOOR_MEMBERS) {
  ok('ALLOWED_EDGE_TYPES has ' + t + ' (floor member preserved)', ALLOWED_EDGE_TYPES.has(t));
}

// Wave 3 (195-04) Task 1: UMBILICAL_TO is now minted; the assertion is HARD.
// Membership only -- never `.size` (the concurrent Phase-205 additions must not
// make this flap). Tasks 2 + 3 append the cross-room-store round-trip / purge /
// reap assertions below this line as those modules land.
ok('ALLOWED_EDGE_TYPES has ' + NEW_EDGE + ' (minted Wave 3, peer cross-room edge)',
  ALLOWED_EDGE_TYPES.has(NEW_EDGE));

console.log('\nPASS test-195-umbilical-edge-floor (' + pass + ' assertions)');
console.log('>>> test-195-umbilical-edge-floor.cjs: PASSED');
