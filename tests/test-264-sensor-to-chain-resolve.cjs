#!/usr/bin/env node
'use strict';

/*
 * Phase 264 Plan 05, Task 1 -- tests/test-264-sensor-to-chain-resolve.cjs
 * ================================================================
 * Behaviors covered:
 *   1. One sample turn drives the REAL dispatcher (dispatchSensors, never
 *      sensorRoadmapType called in isolation) and fires exactly one
 *      roadmap-type-selector reach.
 *   2. That reach carries the frozen reach_id/posture/signal/sensor_id shape.
 *   3. LOAD-BEARING CARRIER: evidence.roadmap_type is a key in
 *      data/roadmap-type-chains.json.
 *   4. The chain the table names for that slug resolves through chainResolve
 *      (lib/mcp/tools/chain.cjs -- the shipped chain_resolve seam).
 *   5. THE REQUIREMENT 3 ACCEPTANCE: the resolved plan has zero required-null
 *      steps.
 *   6. The resolved technical-roadmap plan's commands match the real
 *      registry-backed sequence and the plan is runnable per
 *      validateChainAutonomy.
 *   7. Every resolved step carries exactly the four composeWorkflow keys.
 *   8. OBSERVABILITY CARRIER: reach.companions mirrors the table array;
 *      nothing reads it today (documented, not wired).
 *   9. AGREEMENT CHECK: chainResolve(chain) deep-equals composeWorkflow(chain).
 *  10. ALL SIX roadmap types resolve with zero required-null steps and
 *      runnable === true, not just the flagship technical-roadmap type.
 *  11. NEGATIVE: an unrelated turn produces no roadmap-type-selector reach.
 *  12. SYNC FENCE: dispatchSensors returns a real array of non-thenable
 *      elements -- a Promise-returning sensor is silently dropped by the
 *      REACH_IDS membership check with no throw and no log, so absence of an
 *      error proves nothing on this seam.
 *
 * Requirement 3 resolved (RESEARCH Open Question 2): SPEC Requirement 3
 * names a `suggested_chain` field. D-03 already established this cannot be a
 * new top-level reach key -- makeReach freezes the struct to exactly six keys
 * (reach_id, posture, dispatch, companions, signal, evidence) and DROPS
 * anything else. The resolution, proven by BOTH halves in this file:
 *   - evidence.roadmap_type is the LOAD-BEARING carrier: a closed 6-value
 *     scalar enum from which the consumer resolves the chain out of
 *     data/roadmap-type-chains.json. This is the only route with a working
 *     path today.
 *   - companions carries the framework-name array for observability. NOTHING
 *     reads it yet: the sole shipped consumer
 *     (lib/brain/chain-recommender.cjs::parseChainCompanions, :526-543) skips
 *     any companion string without a 'brain_framework_chain:' prefix and
 *     deliberately ignores a third ':<framework>' segment. Do not imply a
 *     wire that does not exist, and do not "fix" it by prefixing the names,
 *     which would feed the segment to the Brain chain recommender as a
 *     problem_type handle and produce wrong Brain queries.
 * "Wire a live consumer for the roadmap-type reach" is a NAMED FOLLOW-ON,
 * exactly like D-11's async-path fix. Not attempted here.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const { dispatchSensors } = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const { chainResolve } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'chain.cjs'));
const { composeWorkflow, validateChainAutonomy } = require(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'));

const CHAIN_TABLE_PATH = path.join(REPO_ROOT, 'data', 'roadmap-type-chains.json');
const chainTable = JSON.parse(fs.readFileSync(CHAIN_TABLE_PATH, 'utf8'));

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

console.log('test-264-sensor-to-chain-resolve');

// ---------------------------------------------------------------------------
// 1-2: ONE SAMPLE TURN, driven through the REAL dispatchSensors.
// turn_count: 5 is required: turnCountOf returns undefined when neither
// turn.turn_count nor ctx.turn_count is finite, and an absent counter is a
// no-op, so a fixture that omits it can pass while production drops the
// reach.
// ---------------------------------------------------------------------------
const sampleTurn = {
  text: 'I need a technical roadmap - what has to be solved first before the rest becomes possible',
  signals: [],
  turn_count: 5,
};
const sampleReaches = dispatchSensors(sampleTurn, { problem_type: 'IDP' }, {});

const roadmapReaches = sampleReaches.filter(function (r) { return r && r.dispatch === 'roadmap-type-selector'; });
ok('exactly one reach with dispatch === roadmap-type-selector fires on the sample turn',
  roadmapReaches.length === 1);
const reach = roadmapReaches[0];

ok('the reach has reach_id === context_block', reach.reach_id === 'context_block');
ok('the reach has posture === hold', reach.posture === 'hold');
ok('the reach has signal === roadmap_type_classified', reach.signal === 'roadmap_type_classified');
ok('the reach has evidence.sensor_id === SENS-18', reach.evidence.sensor_id === 'SENS-18');

// ---------------------------------------------------------------------------
// 3: LOAD-BEARING CARRIER.
// ---------------------------------------------------------------------------
ok('evidence.roadmap_type === technical-roadmap', reach.evidence.roadmap_type === 'technical-roadmap');
ok('evidence.roadmap_type is a key in data/roadmap-type-chains.json',
  Object.prototype.hasOwnProperty.call(chainTable, reach.evidence.roadmap_type));

// ---------------------------------------------------------------------------
// 4-5: resolve the chain the way a real consumer would, through chainResolve
// (the shipped chain_resolve seam SPEC Requirement 3 names).
// ---------------------------------------------------------------------------
ok('chainResolve is exported from lib/mcp/tools/chain.cjs as a function', typeof chainResolve === 'function');

const namedChain = chainTable[reach.evidence.roadmap_type];
const resolvedPlan = chainResolve(namedChain);

const nullRequiredSteps = resolvedPlan.filter(function (s) { return s.command === null && s.optional !== true; });
ok('THE REQUIREMENT 3 ACCEPTANCE: zero steps where command === null && optional !== true' +
  (nullRequiredSteps.length > 0 ? (' (offending: ' + nullRequiredSteps.map(function (s) { return s.framework; }).join(', ') + ')') : ''),
  nullRequiredSteps.length === 0);

// ---------------------------------------------------------------------------
// 6: the resolved technical-roadmap plan's commands, and autonomy.
// ---------------------------------------------------------------------------
ok('the resolved technical-roadmap plan commands deep-equal the expected sequence',
  (function () {
    try {
      assert.deepEqual(resolvedPlan.map(function (s) { return s.command; }),
        ['/mos:diagnose', '/mos:find-bottlenecks', '/mos:map-unknowns']);
      return true;
    } catch (_e) { return false; }
  })());
ok('validateChainAutonomy(resolvedPlan).runnable === true', validateChainAutonomy(resolvedPlan).runnable === true);

// ---------------------------------------------------------------------------
// 7: every step object has exactly the composeWorkflow shape.
// ---------------------------------------------------------------------------
ok('every resolved step has exactly the keys step, framework, command, optional',
  resolvedPlan.every(function (s) {
    const keys = Object.keys(s).sort();
    return keys.length === 4 && JSON.stringify(keys) === JSON.stringify(['command', 'framework', 'optional', 'step']);
  }));

// ---------------------------------------------------------------------------
// 8: OBSERVABILITY CARRIER. companions mirrors the table array; nothing
// reads it today (see the header note above).
// ---------------------------------------------------------------------------
ok('reach.companions deep-equals the framework-name array read from the table',
  JSON.stringify(reach.companions) === JSON.stringify(namedChain));
ok('reach.evidence.chain_len === reach.companions.length',
  reach.evidence.chain_len === reach.companions.length);

// ---------------------------------------------------------------------------
// 9: AGREEMENT CHECK -- chainResolve is the thin wrapper it claims to be.
// ---------------------------------------------------------------------------
ok('chainResolve(chain) deep-equals composeWorkflow(chain) for the technical-roadmap chain',
  JSON.stringify(chainResolve(namedChain)) === JSON.stringify(composeWorkflow(namedChain)));

// ---------------------------------------------------------------------------
// 10: ALL SIX roadmap types, not just the flagship.
// ---------------------------------------------------------------------------
const ALL_SLUGS = [
  'landscape-analysis',
  'technical-roadmap',
  'pipeline-analysis',
  'opportunity-analysis',
  'agenda-setting-manifesto',
  'vision-paper',
];
ok('data/roadmap-type-chains.json has exactly the six declared slugs',
  ALL_SLUGS.every(function (slug) { return Object.prototype.hasOwnProperty.call(chainTable, slug); }));

for (const slug of ALL_SLUGS) {
  const chain = chainTable[slug];
  const plan = chainResolve(chain);
  const nullReq = plan.filter(function (s) { return s.command === null && s.optional !== true; });
  ok(slug + ': zero required-null commands' +
    (nullReq.length > 0 ? (' (offending: ' + nullReq.map(function (s) { return s.framework; }).join(', ') + ')') : ''),
    nullReq.length === 0);
  ok(slug + ': validateChainAutonomy(...).runnable === true', validateChainAutonomy(plan).runnable === true);
  ok(slug + ': chainResolve(chain) deep-equals composeWorkflow(chain)',
    JSON.stringify(plan) === JSON.stringify(composeWorkflow(chain)));
}

// ---------------------------------------------------------------------------
// 11: NEGATIVE -- an unrelated turn produces no roadmap-type-selector reach.
// turn_count: 5 set here too, for the same reason as the positive fixture.
// ---------------------------------------------------------------------------
const negativeReaches = dispatchSensors(
  { text: 'what is the weather today', signals: [], turn_count: 5 },
  { problem_type: 'IDP' }, {});
ok('a neutral turn produces NO reach with dispatch === roadmap-type-selector',
  !negativeReaches.some(function (r) { return r && r.dispatch === 'roadmap-type-selector'; }));

// ---------------------------------------------------------------------------
// 12: SYNC FENCE -- dispatchSensors returns a real array of non-thenable
// elements. A Promise-returning sensor is dropped by the REACH_IDS
// membership check with no throw and no log; absence of an error proves
// nothing on this seam, so the positive property is what must be asserted.
// ---------------------------------------------------------------------------
ok('dispatchSensors(sampleTurn) returns a real Array', Array.isArray(sampleReaches));
ok('no element returned by dispatchSensors is a thenable',
  sampleReaches.every(function (r) { return !(r && typeof r.then === 'function'); }));

console.log('\nPASS test-264-sensor-to-chain-resolve (' + pass + ' assertions)');
