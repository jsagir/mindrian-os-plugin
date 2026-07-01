'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-04 -- the frozen-six DRIFT GUARD (scope item 7). The FLOOR test the
 * whole 205 phase rides on.
 * ============================================================================
 * Mirrors tests/test-158-reach-frozen-148-guard.cjs: it EXERCISES the 205
 * additions first (dispatch a SENS-10 circling turn through the registry, resolve
 * the nav-dial with an elevation companion, resolve GRILL / REFRAME gear
 * positions), THEN asserts the frozen constitutional set is untouched:
 *   - REACH_IDS is still EXACTLY the six ids, length 6
 *   - MAX_K === 3, DIAL_REACH_K === 6, the 0.70 / 0.15 detents byte-identical
 *
 * Plus the explicit item-7 assertions that make the invariant testable:
 *   - GRILL / REFRAME / FUSION are NOT members of REACH_IDS (they are nav-dial
 *     positions + existing-reach routing, not reaches)
 *   - a SENS-10 circling turn only ever emits a FROZEN reach_id (its gear rides
 *     in evidence, never as a reach)
 *   - the nav-dial gear label set (Investigate | Blend | Insight) is DISJOINT
 *     from REACH_IDS -- a gear is a POSITION, not a reach
 *
 * The frozen scalars are re-read through the decide()-spine read-only accessor
 * navigation-engine.frozenConstitutionalSet() so the guard reads ONE point on the
 * routing spine (item 7: "the drift test in navigation-engine.cjs").
 *
 * House rule: hyphens only, no em-dashes. CJS. Read-only, LOCAL (Part 8).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sensorTypes = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));
const insightSensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const circularity = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-circularity.cjs'));
const navEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const dial = require(path.join(REPO_ROOT, 'lib', 'core', 'nav-dial.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-205-frozen-six-guard.cjs (item 7): the frozen six + scalars hold after 205');

const FROZEN_SIX = ['context_block', 'contradiction', 'cross_room', 'brain_consult', 'deep_research', 'hats'];

// ---------------------------------------------------------------------------
// EXERCISE the 205 machinery FIRST, so the frozen assertions below run AFTER it.
// ---------------------------------------------------------------------------

// (a) Dispatch a SENS-10 circling turn THROUGH the registry (the production path).
const circlingReaches = insightSensors.dispatchSensors(
  { text: "we keep going round in circles and you're not answering my question" },
  {}, {}
);

// (b) Resolve GRILL and REFRAME gear positions directly (the four-cause exits).
const grillReach = circularity.sensorCircularity(
  { text: 'obviously this is true, trust me, it goes without saying' }, {}, {}
);
const reframeReach = circularity.sensorCircularity(
  { text: 'maybe this is the wrong question, we should reframe it' }, {}, {}
);

// (c) Resolve the nav-dial WITH an elevation companion (item 8 machinery).
const dialPos = dial.resolveDialWithElevation({
  brain_md_tier_mode: 'mode_a',
  brain_md_weight_applied: 0.8,
  chosen_rationale: 'blending',
  fired_reach_id: 'contradiction',
});

check('the 205 machinery was actually exercised (guard is meaningful)', () => {
  assert.ok(Array.isArray(circlingReaches) && circlingReaches.length >= 1,
    'the SENS-10 circling turn must emit at least one candidate reach');
  assert.ok(grillReach && grillReach.evidence && grillReach.evidence.gear === 'GRILL',
    'the assertion-unvalidated turn must resolve to the GRILL gear');
  assert.ok(reframeReach && reframeReach.evidence && reframeReach.evidence.gear === 'REFRAME',
    'the wrong-frame turn must resolve to the REFRAME gear');
  assert.strictEqual(dialPos.elevation, 'horizontal',
    'the nav-dial resolved an elevation companion (item 8)');
});

// ---------------------------------------------------------------------------
// The frozen constitutional set, re-read through the decide()-spine accessor.
// ---------------------------------------------------------------------------
const frozen = navEngine.frozenConstitutionalSet();

check('REACH_IDS is EXACTLY the six frozen ids, length 6 (after 205)', () => {
  assert.ok(Array.isArray(frozen.REACH_IDS), 'accessor must return the REACH_IDS array');
  assert.strictEqual(frozen.REACH_IDS.length, 6, 'REACH_IDS must be length 6');
  assert.deepStrictEqual(frozen.REACH_IDS.slice(), FROZEN_SIX,
    'REACH_IDS must be exactly {context_block, contradiction, cross_room, brain_consult, deep_research, hats}');
  // The source module agrees byte-for-byte.
  assert.deepStrictEqual(sensorTypes.REACH_IDS.slice(), FROZEN_SIX,
    'sensor-types.REACH_IDS must equal the frozen six');
});

check('MAX_K === 3 (chooser-row cap FROZEN)', () => {
  assert.strictEqual(frozen.MAX_K, 3, 'MAX_K via the spine accessor must be 3');
  assert.strictEqual(ranker.MAX_K, 3, 'ranker.MAX_K must be 3');
});

check('DIAL_REACH_K === 6 (reach bank FROZEN)', () => {
  assert.strictEqual(frozen.DIAL_REACH_K, 6, 'DIAL_REACH_K via the spine accessor must be 6');
  assert.strictEqual(orchestrator.DIAL_REACH_K, 6, 'orchestrator.DIAL_REACH_K must be 6');
});

check('the 0.70 / 0.15 detents are byte-identical (FROZEN)', () => {
  assert.strictEqual(frozen.RECOMMEND_FLOOR, 0.70, 'RECOMMEND_FLOOR must be 0.70');
  assert.strictEqual(frozen.MARGIN_THRESHOLD, 0.15, 'MARGIN_THRESHOLD must be 0.15');
  assert.strictEqual(orchestrator.RECOMMEND_FLOOR, 0.70, 'orchestrator.RECOMMEND_FLOOR must be 0.70');
  assert.strictEqual(orchestrator.MARGIN_THRESHOLD, 0.15, 'orchestrator.MARGIN_THRESHOLD must be 0.15');
  // The decide()-spine 0.70 floor agrees with the orchestrator detent.
  assert.strictEqual(navEngine.RECOMMENDED_CONFIDENCE_FLOOR, 0.70,
    'the decide() spine RECOMMENDED_CONFIDENCE_FLOOR must be 0.70');
});

check('the two caps stay DISTINCT (DIAL_REACH_K=6 != MAX_K=3)', () => {
  assert.notStrictEqual(frozen.DIAL_REACH_K, frozen.MAX_K,
    'the dial-preview cap and the chooser cap must remain distinct');
});

// ---------------------------------------------------------------------------
// Item 7: GRILL / REFRAME / FUSION mint NO new reach_id.
// ---------------------------------------------------------------------------
check("'GRILL', 'REFRAME', 'FUSION' are NOT members of REACH_IDS", () => {
  for (const gear of ['GRILL', 'REFRAME', 'FUSION']) {
    assert.strictEqual(frozen.REACH_IDS.indexOf(gear), -1,
      gear + ' must NOT be a reach_id (it is a nav-dial position / existing-reach routing)');
    // Case-insensitive belt-and-braces (no lowercase variant leaked in either).
    assert.strictEqual(frozen.REACH_IDS.indexOf(gear.toLowerCase()), -1,
      gear.toLowerCase() + ' must NOT be a reach_id');
  }
});

check('a SENS-10 circling turn only ever emits a FROZEN reach_id', () => {
  // Every reach the SENS-10 dispatch produced routes to one of the frozen six --
  // the gear (TELL / GRILL / REFRAME) rides in evidence, NEVER as a reach_id.
  for (const r of circlingReaches) {
    assert.ok(FROZEN_SIX.indexOf(r.reach_id) !== -1,
      'circling reach_id ' + r.reach_id + ' must be one of the frozen six');
  }
  // The GRILL / REFRAME exits route to EXISTING reaches (deep_research), not new ones.
  assert.ok(FROZEN_SIX.indexOf(grillReach.reach_id) !== -1,
    'the GRILL exit routes to an existing frozen reach (' + grillReach.reach_id + ')');
  assert.ok(FROZEN_SIX.indexOf(reframeReach.reach_id) !== -1,
    'the REFRAME exit routes to an existing frozen reach (' + reframeReach.reach_id + ')');
});

// ---------------------------------------------------------------------------
// Item 7: a gear is a POSITION, not a reach.
// ---------------------------------------------------------------------------
check('the nav-dial gear label set is DISJOINT from REACH_IDS', () => {
  const gearLabels = ['Investigate', 'Blend', 'Insight'];
  for (const g of gearLabels) {
    assert.strictEqual(frozen.REACH_IDS.indexOf(g), -1,
      'gear label ' + g + ' must NOT be a reach_id (a gear is a position, not a reach)');
    assert.strictEqual(frozen.REACH_IDS.indexOf(g.toLowerCase()), -1,
      'gear label ' + g.toLowerCase() + ' must NOT be a reach_id');
  }
  // The elevation companion axis is likewise NOT a reach set.
  for (const e of dial.ELEVATION_TYPES) {
    assert.strictEqual(frozen.REACH_IDS.indexOf(e), -1,
      'elevation type ' + e + ' must NOT be a reach_id (an elevation is a direction, not a reach)');
  }
});

console.log('');
console.log('PASS test-205-frozen-six-guard.cjs (' + passed + ' checks)');
process.exit(0);
