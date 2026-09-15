'use strict';
/*
 * tests/test-348-contradictions-floor.cjs -- Phase 348-04 Task 1 (SUPER-04).
 *
 * The additive-floor proof for findContradictions's reshape: a call with no
 * options bag (absent, undefined, null, {}) returns the SAME result the
 * pre-348 function returned, on both schema variants (wide and legacy). The
 * four-key return shape (claimA, claimB, edgePath, explanation) is frozen --
 * no key added, renamed or removed.
 *
 * Modeled on the additive-floor doctrine in this repo's own words
 * (lib/core/navigation/edges.cjs: "the floor is byte-identical except this
 * one addition; tests assert named MEMBERSHIP, never an exact size").
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
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

// --- 1. No-bag / undefined / null / {} all deep-equal, on the wide fixture --

(function testNoBagDeepEqual() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const a = navigation.findContradictions(fx.db, fx.claimAId);
    const b = navigation.findContradictions(fx.db, fx.claimAId, undefined);
    const c = navigation.findContradictions(fx.db, fx.claimAId, {});
    check(JSON.stringify(a) === JSON.stringify(b), 'no-bag and undefined-bag must deep-equal');
    check(JSON.stringify(a) === JSON.stringify(c), 'no-bag and empty-bag must deep-equal');
    check(a.length === 1, 'wide fixture with no superseded node should return exactly one pair');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 2. Four-key return shape, frozen -------------------------------------

(function testFourKeyShape() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const result = navigation.findContradictions(fx.db, fx.claimAId);
    check(result.length === 1, 'expected exactly one contradiction pair');
    const keys = Object.keys(result[0]).sort().join(',');
    check(keys === 'claimA,claimB,edgePath,explanation', 'return shape must be exactly the four keys, got: ' + keys);
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 3. Non-object opts coerced to empty bag, never throws ----------------

(function testNonObjectOptsCoerced() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const baseline = navigation.findContradictions(fx.db, fx.claimAId);
    for (const bad of [null, 'x', [], 42]) {
      let result;
      let threw = false;
      try {
        result = navigation.findContradictions(fx.db, fx.claimAId, bad);
      } catch (_e) {
        threw = true;
      }
      check(!threw, 'non-object opts (' + JSON.stringify(bad) + ') must not throw');
      check(JSON.stringify(result) === JSON.stringify(baseline), 'non-object opts must coerce to the empty bag behavior');
    }
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 4. Legacy fixture: no review_status column, no throw, non-empty -----

(function testLegacyFallThrough() {
  const fx = buildSupersessionFixtureRoom({ variant: 'legacy' });
  try {
    let result;
    let threw = false;
    try {
      result = navigation.findContradictions(fx.db, fx.claimAId);
    } catch (_e) {
      threw = true;
    }
    check(!threw, 'legacy fixture must not throw on default call');
    check(Array.isArray(result), 'legacy fixture default call must return an array');
    check(result.length === 1, 'legacy fixture has one CONTRADICTS edge, must be returned');

    let resultOn;
    let threwOn = false;
    try {
      resultOn = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: true });
    } catch (_e) {
      threwOn = true;
    }
    check(!threwOn, 'legacy fixture must not throw on includeSuperseded:true call');
    check(JSON.stringify(resultOn) === JSON.stringify(result), 'legacy fixture: default and includeSuperseded must be identical (vacuous satisfaction)');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 5. Unknown focus node: still [] and no neighborhood walk -------------

(function testUnknownFocusNode() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const result = navigation.findContradictions(fx.db, 'claim:does-not-exist');
    check(Array.isArray(result) && result.length === 0, 'unknown focus node must return []');
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
})();

// --- 6. Zero writes: source scan finds no INSERT/UPDATE/DELETE -----------

(function testZeroWrites() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'core', 'navigation', 'insights.cjs'), 'utf8');
  const startIdx = src.indexOf('function findContradictions');
  const endIdx = src.indexOf('function findUnsupportedClaims');
  check(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx, 'could not locate findContradictions function body bounds');
  const body = src.slice(startIdx, endIdx)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  check(!/\b(INSERT|UPDATE|DELETE)\b/i.test(body), 'findContradictions must perform zero writes');
})();

console.log(assertions + ' assertions passed.');
console.log('>>> test-348-contradictions-floor.cjs: PASSED');
