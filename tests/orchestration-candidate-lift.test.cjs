'use strict';
/*
 * Phase 191 Plan 01 -- RED scaffold for the lift module (Nyquist: test precedes
 * implementation). Asserts the liftFiringCandidate(input) -> LiftResult contract
 * pinned in 191-IFACE.md section 2. The module this test requires,
 * lib/core/orchestration-candidate-lift.cjs, does NOT exist yet -- Wave 2 (191-02)
 * writes it. Running this file today MUST exit non-zero: the require below throws
 * MODULE_NOT_FOUND before any assertion runs. That is the RED state Wave 1 ships.
 *
 * Reason codes covered (per 191-IFACE.md section 2 LiftResult.reason):
 *   'lifted'            winner clears the gate AND maps to a canonical verb.
 *   'below_gate'        winner matched a rankFn score below the gate.
 *   'no_canonical_verb' winner clears the gate but its reach_id has no verb mapping.
 *   'no_offer'          projectionOffer is null/empty (skipped or no options).
 *   'no_match'          the winning option's command slug has no rankFn match.
 *
 * The gate is READ via the injected/default RECOMMENDED_CONFIDENCE_FLOOR
 * (lib/core/navigation-engine.cjs, exported at :1314) -- this file never hardcodes
 * a bare 0.70 literal for the gate comparison; every fixture score is expressed
 * RELATIVE to the imported floor constant.
 *
 * Canon Part 8: all fixtures are synthetic enum/scalar shapes; zero live Brain /
 * network / room bytes. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// RED: this require throws (module absent) -- the whole file crashes with a
// non-zero exit before a single assertion runs. That crash IS the RED signal
// tests/orchestration-candidate-lift.test.cjs is required to produce per the
// plan's acceptance criteria. Once Wave 2 lands the module, this line starts
// resolving and every test body below starts exercising the real contract.
const lift = require(path.join(REPO_ROOT, 'lib', 'core', 'orchestration-candidate-lift.cjs'));

// The gate MUST be imported from navigation-engine.cjs, never a re-typed literal
// (191-IFACE.md section 2 anchor: lib/core/navigation-engine.cjs:86, exported :1314).
const navigationEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const FLOOR = navigationEngine.RECOMMENDED_CONFIDENCE_FLOOR;

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log('  ok - ' + name);
  pass += 1;
}

// ---- fixtures (synthetic; mirror the real option-content shape, decide-projection-reader.cjs:263-284) ----

function fixtureProjectionOffer(overrides) {
  const base = {
    options: [
      {
        label: '/mos:red-team',
        command: '/mos:red-team',
        reach_id: 'hats',
        sub_mode: 'b',
        framework: 'Hats',
        methodology_tier: 'mindrian-operation',
        why: 'context-matched capability (projection-ranked)',
        fires: false,
      },
    ],
    skipped: false,
    reason: 'ok',
  };
  return Object.assign({}, base, overrides || {});
}

function fixtureSensorReaches(reachId) {
  return [{ reach_id: reachId || 'hats', posture: 'push_forward', tier: 't1', confidence: 0.9 }];
}

// rankFn seam: mirrors f-selector-ranker.cjs rankForSelector's scored-item shape
// (command, score, framework, why -- lib/workflow/f-selector-ranker.cjs:575-588).
function makeRankFn(command, score) {
  return function rankFnFixture() {
    return [{ command: command, score: score, framework: 'Hats', why: 'fixture' }];
  };
}

// verbFn seam: mirrors navigation-engine.cjs reachIdToSkillFamily(reachId) -> verb|null.
function verbFnMaps(reachId) {
  return reachId === 'hats' ? 'red-team' : null;
}
function verbFnNoMap() {
  return null;
}

// =====================================================================
// Reason: 'lifted' -- winner clears the gate AND maps to a canonical verb.
// =====================================================================
(function () {
  const projectionOffer = fixtureProjectionOffer();
  const result = lift.liftFiringCandidate({
    projectionOffer: projectionOffer,
    sensorReaches: fixtureSensorReaches('hats'),
    context: {},
    rankFn: makeRankFn('/mos:red-team', FLOOR + 0.15),
    verbFn: verbFnMaps,
  });
  ok('lifted: fire_skill_verb is the mapped canonical verb', result.fire_skill_verb === 'red-team');
  ok('lifted: lifted_option.fires is true', result.lifted_option && result.lifted_option.fires === true);
  ok('lifted: reason is lifted', result.reason === 'lifted');
  ok('lifted: command_recommendation is populated', result.command_recommendation !== null
    && result.command_recommendation.command_slug === '/mos:red-team');
  ok('lifted: confidence rides the rankFn score untouched', result.confidence === FLOOR + 0.15);
})();

// =====================================================================
// Reason: 'below_gate' -- matched score below the imported gate.
// =====================================================================
(function () {
  const projectionOffer = fixtureProjectionOffer();
  const result = lift.liftFiringCandidate({
    projectionOffer: projectionOffer,
    sensorReaches: fixtureSensorReaches('hats'),
    context: {},
    rankFn: makeRankFn('/mos:red-team', FLOOR - 0.10),
    verbFn: verbFnMaps,
  });
  ok('below_gate: fire_skill_verb stays null', result.fire_skill_verb === null);
  ok('below_gate: reason is below_gate', result.reason === 'below_gate');
  ok('below_gate: lifted_option.fires stays false', !result.lifted_option || result.lifted_option.fires === false);
})();

// =====================================================================
// Reason: 'no_canonical_verb' -- winner clears the gate but reach_id has no
// verb mapping. command_recommendation still populated (D-03 candidate rides
// the F.7 dial even when the router-flip verb is absent).
// =====================================================================
(function () {
  const projectionOffer = fixtureProjectionOffer();
  const result = lift.liftFiringCandidate({
    projectionOffer: projectionOffer,
    sensorReaches: fixtureSensorReaches('hats'),
    context: {},
    rankFn: makeRankFn('/mos:red-team', FLOOR + 0.05),
    verbFn: verbFnNoMap,
  });
  ok('no_canonical_verb: fire_skill_verb stays null', result.fire_skill_verb === null);
  ok('no_canonical_verb: reason is no_canonical_verb', result.reason === 'no_canonical_verb');
  ok('no_canonical_verb: command_recommendation still populated', result.command_recommendation !== null
    && result.command_recommendation.command_slug === '/mos:red-team');
})();

// =====================================================================
// Reason: 'no_offer' -- null/empty projectionOffer degrades to all-null.
// =====================================================================
(function () {
  const resultNull = lift.liftFiringCandidate({
    projectionOffer: null,
    sensorReaches: fixtureSensorReaches('hats'),
    context: {},
    rankFn: makeRankFn('/mos:red-team', FLOOR + 0.10),
    verbFn: verbFnMaps,
  });
  ok('no_offer (null): reason is no_offer', resultNull.reason === 'no_offer');
  ok('no_offer (null): fire_skill_verb is null', resultNull.fire_skill_verb === null);
  ok('no_offer (null): lifted_option is null', resultNull.lifted_option === null);
  ok('no_offer (null): command_recommendation is null', resultNull.command_recommendation === null);

  const resultEmpty = lift.liftFiringCandidate({
    projectionOffer: fixtureProjectionOffer({ options: [] }),
    sensorReaches: fixtureSensorReaches('hats'),
    context: {},
    rankFn: makeRankFn('/mos:red-team', FLOOR + 0.10),
    verbFn: verbFnMaps,
  });
  ok('no_offer (empty options): reason is no_offer', resultEmpty.reason === 'no_offer');
})();

// =====================================================================
// Reason: 'no_match' -- the winning option's command slug has no rankFn match.
// =====================================================================
(function () {
  const projectionOffer = fixtureProjectionOffer();
  const result = lift.liftFiringCandidate({
    projectionOffer: projectionOffer,
    sensorReaches: fixtureSensorReaches('hats'),
    context: {},
    rankFn: makeRankFn('/mos:some-other-command', FLOOR + 0.10),
    verbFn: verbFnMaps,
  });
  ok('no_match: reason is no_match', result.reason === 'no_match');
  ok('no_match: fire_skill_verb stays null', result.fire_skill_verb === null);
  ok('no_match: lifted_option stays advisory (fires false)', !result.lifted_option || result.lifted_option.fires === false);
})();

// =====================================================================
// Gate provenance -- the module imports RECOMMENDED_CONFIDENCE_FLOOR; it does
// not redefine or hardcode 0.70. Proven by NOT passing a gate override and
// confirming the DEFAULT gate behaves identically to the explicit FLOOR import.
// =====================================================================
(function () {
  ok('gate provenance: navigation-engine.cjs exports a numeric RECOMMENDED_CONFIDENCE_FLOOR',
    typeof FLOOR === 'number' && FLOOR > 0 && FLOOR < 1);

  const projectionOffer = fixtureProjectionOffer();
  const atFloorDefaultGate = lift.liftFiringCandidate({
    projectionOffer: projectionOffer,
    sensorReaches: fixtureSensorReaches('hats'),
    context: {},
    rankFn: makeRankFn('/mos:red-team', FLOOR),
    verbFn: verbFnMaps,
    // gate omitted deliberately: module must default to RECOMMENDED_CONFIDENCE_FLOOR
  });
  ok('gate provenance: default gate lifts a score exactly at the imported floor',
    atFloorDefaultGate.reason === 'lifted');

  const belowFloorDefaultGate = lift.liftFiringCandidate({
    projectionOffer: projectionOffer,
    sensorReaches: fixtureSensorReaches('hats'),
    context: {},
    rankFn: makeRankFn('/mos:red-team', FLOOR - 0.01),
    verbFn: verbFnMaps,
  });
  ok('gate provenance: default gate rejects a score just below the imported floor',
    belowFloorDefaultGate.reason === 'below_gate');
})();

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> orchestration-candidate-lift.test.cjs: PASSED');
process.exit(0);
