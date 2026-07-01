'use strict';
/*
 * Phase 189-01 Wave 0 -- the HITL Memory Governance edge-type FLOOR (HMG-08 guard).
 * =========================================================================
 * FLOOR discipline (the edges.cjs REMEMBERED_AS / ATTRIBUTED_TO / NOT_REMEMBERED_BECAUSE
 * block states it verbatim, same as every prior additive block): assert named
 * MEMBERSHIP of every edge type, NEVER an exact `.size` / count, so an additive
 * extension of ALLOWED_EDGE_TYPES cannot regress the baseline OR race a concurrent
 * addition to the SAME frozen Set.
 *
 * Two jobs:
 *   1. GREEN NOW: assert the pre-existing floor (DEFERRED, REJECTED, REJECTED_BECAUSE,
 *      STATES, SUPPORTS, UMBILICAL_TO) is still present -- a regression trip-wire.
 *   2. GREEN NOW: assert the three Phase-189 governance edge types are present
 *      (REMEMBERED_AS, ATTRIBUTED_TO, NOT_REMEMBERED_BECAUSE). These are HARD from
 *      Wave 0 because 189-01 mints them in the same plan that authors this test.
 *
 * Read-only: imports the frozen Set and probes membership; mutates nothing.
 * House rule: hyphens only, no em-dashes. Plain node script (node tests/test-*.cjs),
 * no test framework -- matches the codebase convention.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { ALLOWED_EDGE_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));

// The pre-existing FLOOR: a representative slice of the closed vocabulary that MUST
// stay present so a future edit cannot silently drop a member (per the plan's floor list).
const FLOOR_MEMBERS = ['DEFERRED', 'REJECTED', 'REJECTED_BECAUSE', 'STATES', 'SUPPORTS', 'UMBILICAL_TO'];

// The THREE net-new members minted in this plan (189-01). HARD membership assertions.
const NEW_EDGES = ['REMEMBERED_AS', 'ATTRIBUTED_TO', 'NOT_REMEMBERED_BECAUSE'];

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// It IS a Set, and membership is the contract (never `.size`).
ok('ALLOWED_EDGE_TYPES is a Set instance', ALLOWED_EDGE_TYPES instanceof Set);

for (const t of FLOOR_MEMBERS) {
  if (!ALLOWED_EDGE_TYPES.has(t)) {
    console.error('FAIL - pre-existing floor member missing from ALLOWED_EDGE_TYPES: ' + t);
    process.exit(1);
  }
  ok('ALLOWED_EDGE_TYPES has ' + t + ' (floor member preserved)', true);
}

for (const t of NEW_EDGES) {
  if (!ALLOWED_EDGE_TYPES.has(t)) {
    console.error('FAIL - Phase-189 governance edge type missing from ALLOWED_EDGE_TYPES: ' + t);
    process.exit(1);
  }
  ok('ALLOWED_EDGE_TYPES has ' + t + ' (Phase-189 governance edge minted)', true);
}

console.log('EDGE_FLOOR_OK (' + pass + ' assertions passed)');
process.exit(0);
