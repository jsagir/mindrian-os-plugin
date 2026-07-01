'use strict';
// Phase 200-02 Wave 1 -- RS edge-vocabulary reconciliation (SEED-030, D-200-2).
//
// The RS dual-tier writers emit five edge types (DISCOVERED, DERIVED_FROM,
// ENABLES, AUTHORED_BY, AFFILIATED_WITH). Three were already members of the
// navigation.cjs frozen ALLOWED_EDGE_TYPES set; DISCOVERED and AUTHORED_BY were
// NOT, so rerouting RS edge writes through the navigation.writeEdge chokepoint
// (Canon Part 9, mirroring lib/core/breakthrough/schema.cjs) would have been
// REJECTED for those two. This Wave-1 additive amendment mints them.
//
// NAVIGATOR-GATED: the navigator ratified "Extend navigation vocab" at a blocking
// checkpoint (2026-07-01) BEFORE these bytes landed, per the frozen-set amendment
// procedure (D-168 / D-169-11 / D-150.8 precedent).
//
// FLOOR test (per the edges.cjs contract): asserts the two new members are present
// AND a sample of prior members survive AND the Set is still a frozen Set. NEVER
// asserts .size, so the additive extension cannot regress the baseline.

const assert = require('node:assert/strict');
const path = require('node:path');
const { ALLOWED_EDGE_TYPES } = require(path.join(__dirname, '..', 'lib', 'core', 'navigation', 'edges.cjs'));

let n = 0;
function check(desc, fn) { fn(); n += 1; console.log('ok - ' + desc); }

console.log('test-200-02-rs-edge-vocab');

// The two newly minted RS edge types.
check('DISCOVERED is a member', function () {
  assert.equal(ALLOWED_EDGE_TYPES.has('DISCOVERED'), true, 'missing DISCOVERED');
});
check('AUTHORED_BY is a member', function () {
  assert.equal(ALLOWED_EDGE_TYPES.has('AUTHORED_BY'), true, 'missing AUTHORED_BY');
});

// The three RS types that were already members (proves this is a reconciliation,
// not a from-scratch RS vocabulary).
check('the three prior RS types remain members', function () {
  for (const t of ['DERIVED_FROM', 'ENABLES', 'AFFILIATED_WITH']) {
    assert.equal(ALLOWED_EDGE_TYPES.has(t), true, 'missing prior RS type ' + t);
  }
});

// Floor: a sample of unrelated prior members must survive the additive change.
check('prior frozen-set floor survives', function () {
  for (const t of ['DEFERRED', 'REJECTED', 'FEEDS_INTO', 'SHARES_JOB', 'NESTED_WITHIN']) {
    assert.equal(ALLOWED_EDGE_TYPES.has(t), true, 'missing prior member ' + t);
  }
});

check('the set is still a frozen Set (closed surface intact)', function () {
  assert.equal(ALLOWED_EDGE_TYPES instanceof Set, true);
  assert.equal(Object.isFrozen(ALLOWED_EDGE_TYPES), true);
});

// A non-member still rejected (the set stays closed, not opened up).
check('a non-member string is still not a member', function () {
  assert.equal(ALLOWED_EDGE_TYPES.has('DISCOVERED_BY_MAGIC'), false);
});

console.log('\n' + n + ' assertions passed');
