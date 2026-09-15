'use strict';
/*
 * tests/test-348-include-superseded.cjs -- Phase 348-04 Task 1 (SUPER-04/05).
 *
 * Proves the includeSuperseded behavior: a superseded endpoint is absent by
 * default and present on request, on EITHER side of the CONTRADICTS edge
 * (not only when the target is superseded), and a NULL review_status is
 * KEPT (SQLite's null-safe IS NOT), never silently dropped by a naive <>.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
} = require('./helpers/fixture-room-348.cjs');
const navigation = require('../lib/core/navigation.cjs');

let assertions = 0;
function check(cond, msg) {
  assertions++;
  assert.ok(cond, msg);
}

// --- 1. Target (claim B) superseded: absent by default, present on request

(function testTargetSuperseded() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'test-supersede',
      { invalidatedAt: 1, validTo: 2 }
    );
    const off = navigation.findContradictions(fx.db, fx.claimAId);
    check(off.length === 0, 'default call must exclude the pair when claimB is superseded');
    const on = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: true });
    check(on.length === 1, 'includeSuperseded:true must return the pair');
    check(on[0].claimB.id === fx.claimBId, 'the returned pair claimB.id must be the superseded node');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 2. Source (claim A) superseded: also excluded (both-endpoints filter)

(function testSourceSuperseded() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimAId, 'confirmed', 'superseded', 'navigator', 'test-supersede',
      { invalidatedAt: 1, validTo: 2 }
    );
    const off = navigation.findContradictions(fx.db, fx.claimAId);
    check(off.length === 0, 'default call must exclude the pair when claimA (the source/edge origin) is superseded');
    const on = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: true });
    check(on.length === 1, 'includeSuperseded:true must return the pair even when claimA is superseded');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 3. NULL review_status is KEPT, never dropped (null-safe IS NOT) -----

(function testNullStatusKept() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    fx.db.prepare('UPDATE nodes SET review_status = NULL WHERE id = ?').run(fx.claimBId);
    const result = navigation.findContradictions(fx.db, fx.claimAId);
    check(result.length === 1, 'a NULL review_status row must be KEPT by the default filter, not dropped');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 4. Strict === true coercion: truthy string / 1 do not opt in --------

(function testStrictTrueCoercion() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'test-supersede',
      { invalidatedAt: 1, validTo: 2 }
    );
    const truthyString = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: 'yes' });
    check(truthyString.length === 0, 'a truthy string must NOT opt the caller in (strict === true)');
    const numericOne = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: 1 });
    check(numericOne.length === 0, 'a numeric 1 must NOT opt the caller in (strict === true)');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 5. The node row and its edges are intact either way (not truncated) -

(function testNodeRowAndEdgesIntact() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'test-supersede',
      { invalidatedAt: 1, validTo: 2 }
    );
    const stillThere = fx.db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(fx.claimBId);
    check(!!stillThere, 'superseded node row must still exist (invalidated-not-deleted, per SUPERSESSION-CONTRACT)');
    const edgeStillThere = fx.db.prepare(
      "SELECT 1 AS x FROM edges WHERE source = ? AND target = ? AND type = 'CONTRADICTS'"
    ).get(fx.claimAId, fx.claimBId);
    check(!!edgeStillThere, 'the CONTRADICTS edge must still exist regardless of the exclusion filter');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

console.log(assertions + ' assertions passed.');
console.log('>>> test-348-include-superseded.cjs: PASSED');
