'use strict';
/*
 * SENS-18 roadmap-type sensor unit test (Phase 264 Plan 03, R1).
 *
 * Behaviors covered:
 *   1. Twelve fixture utterances classify into their correct roadmap-type slug
 *      (two per bank across all six banks).
 *   2. Two true-negative utterances and one near-miss negative (D-07: the
 *      word-boundary regression fence against the indexOf-scan over-fire bug
 *      class already latent in two shipped sensors) return null and produce no
 *      reach through the real dispatcher.
 *   3. The reach is frozen, carries the frozen six keys, uses the frozen
 *      reach_id/posture banks, and is proven SYNCHRONOUS by a positive
 *      `then !== 'function'` assertion (never an absence-of-error check).
 *   4. Part-8 evidence-shape sweep: every evidence value is a scalar/null, and
 *      no evidence string exceeds three space-separated words.
 *   5. companions carries the committed chain from data/roadmap-type-chains.json;
 *      evidence.chain_len matches its length.
 *   6. Signal-tier precedence over a vision-paper-shaped text.
 *   7. Context-primary / keyword-demoted precedence over a vision-paper-shaped
 *      text.
 *   8. Tie-break observability: classifyRoadmapType records tie_broken and picks
 *      the earlier ROADMAP_TYPES slug on an engineered equal-score input.
 *   9. Registration: present in SENSOR_REGISTRY, exported from insight-sensors.
 *  10. Dispatch-map non-membership: 'roadmap-type-selector' is not a
 *      data/dispatch-framework-map.json key.
 *  11. End-to-end through the real dispatchSensors, positive and negative.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { REACH_IDS, POSTURE_IDS } = require('../lib/core/sensors/sensor-types.cjs');
const {
  sensorRoadmapType,
  classifyRoadmapType,
  chainForRoadmapType,
  ROADMAP_TYPES,
} = require('../lib/core/sensors/sensor-roadmap-type.cjs');
const sensors = require('../lib/core/insight-sensors.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------- 1. Twelve positive fixtures ----------

const POSITIVES = [
  ['landscape-analysis', 'before we commit, I want a landscape analysis of who else is working on solid-state electrolytes'],
  ['landscape-analysis', 'map the terrain here - what is the state of the art and what prior art already exists'],
  ['technical-roadmap', 'I need a technical roadmap - what has to be solved first before the rest becomes possible'],
  ['technical-roadmap', 'where is the reverse salient in this system, the rate-limiting step everything else waits on'],
  ['pipeline-analysis', 'our pipeline analysis keeps showing projects dying in the valley of death between lab and product'],
  ['pipeline-analysis', 'where do things stall stage-gate to stage-gate, and what is the attrition at each handoff'],
  ['opportunity-analysis', 'run an opportunity analysis - is this actually worth solving and who is willing to pay'],
  ['opportunity-analysis', 'I need the value proposition and the business case before I build the thesis'],
  ['agenda-setting-manifesto', 'I want to write a research agenda - a manifesto for what the field should be asking'],
  // Deliberately contains the landscape weak term "survey" -- doubles as a
  // cross-bank robustness check (must still classify as agenda-setting-manifesto).
  ['agenda-setting-manifesto', 'this is agenda-setting: a position paper with a real call to action, not a survey'],
  ['vision-paper', 'a vision paper - what could the world look like ten years out if this works'],
  ['vision-paper', 'run scenario planning across the plausible futures and pick the one worth betting on'],
];

for (const [expected, text] of POSITIVES) {
  const r = sensorRoadmapType({ text: text, signals: [] }, {}, {});
  ok('fixture classifies as ' + expected + ': "' + text.slice(0, 40) + '..."',
    r !== null && r.evidence.roadmap_type === expected);
}

// ---------- 2. Negatives (two true, one near-miss D-07) ----------

const NEGATIVES = [
  'what is the weather today',
  'can you fix the failing unit test in the auth module',
  // D-07 near-miss: contains "vision" inside "television" and "survey" inside
  // "surveyor", both of which an indexOf lexicon scan would match. With \b
  // word-boundary anchoring neither must fire. Regression fence against the
  // 'laws'-matches-'flaws' bug class already latent in two shipped sensors.
  'we bought a new television for the lobby and the surveyor is coming friday',
];

for (const text of NEGATIVES) {
  const r = sensorRoadmapType({ text: text, signals: [] }, {}, {});
  ok('negative fires nothing: "' + text.slice(0, 40) + '..."', r === null);
}

// ---------- 3. Frozen shape + sync fence ----------

const techFixture = { text: 'I need a technical roadmap - what has to be solved first before the rest becomes possible', signals: [] };
const techReach = sensorRoadmapType(techFixture, {}, {});

ok('reach_id is in frozen REACH_IDS', REACH_IDS.indexOf(techReach.reach_id) !== -1);
ok('posture is in frozen POSTURE_IDS', POSTURE_IDS.indexOf(techReach.posture) !== -1);
ok('reach_id is context_block (no 7th reach minted)', techReach.reach_id === 'context_block');
ok('posture is hold (standing suggestion, never auto-opens UI)', techReach.posture === 'hold');
ok('Object.keys(reach) deep-equals the frozen six',
  JSON.stringify(Object.keys(techReach)) === JSON.stringify(['reach_id', 'posture', 'dispatch', 'companions', 'signal', 'evidence']));

// SYNC FENCE: positive assertion, not absence-of-error.
ok('sensorRoadmapType(...) returns a plain object, then !== \'function\'', typeof techReach.then !== 'function');

// ---------- 4. Part-8 evidence scalar sweep ----------

for (const k of Object.keys(techReach.evidence)) {
  const v = techReach.evidence[k];
  ok('evidence "' + k + '" is a scalar/enum or null',
    v === null || ['string', 'number', 'boolean'].indexOf(typeof v) !== -1);
}
ok('no multi-word user prose in evidence (max three space-separated words)',
  !Object.values(techReach.evidence).some(function (v) {
    return typeof v === 'string' && v.split(' ').length > 3;
  }));

// ---------- 5. companions chain ----------

const expectedChain = chainForRoadmapType('technical-roadmap');
ok('companions is an array of strings', Array.isArray(techReach.companions) && techReach.companions.every(function (c) { return typeof c === 'string'; }));
ok('companions deep-equals the technical-roadmap chain table entry',
  JSON.stringify(techReach.companions) === JSON.stringify(expectedChain));
ok('evidence.chain_len equals companions.length', techReach.evidence.chain_len === techReach.companions.length);

// ---------- 6. Signal-tier precedence ----------

const visionShapedText = 'a vision paper - what could the world look like ten years out if this works';
const bySignal = sensorRoadmapType(
  { text: visionShapedText, signals: ['roadmap_type:pipeline-analysis'] },
  {}, {});
ok('signal tier overrides vision-shaped text', bySignal !== null && bySignal.evidence.roadmap_type === 'pipeline-analysis');
ok('signal mode recorded', bySignal.evidence.mode === 'signal');

// ---------- 7. Context-primary / keyword-demoted precedence ----------

const byContext = sensorRoadmapType(
  { text: visionShapedText, signals: [] },
  { problem_type: 'bottleneck' }, {});
ok('context tier (problem_type=bottleneck) overrides vision-shaped text', byContext !== null && byContext.evidence.roadmap_type === 'technical-roadmap');
ok('context mode recorded (not keyword)', byContext.evidence.mode === 'context');

// ---------- 8. Tie-break observability ----------

const tieText = 'landscape roadmap';
const preCheck = classifyRoadmapType(tieText);
ok('tie fixture genuinely ties before asserting the tie-break', preCheck.type !== '' && preCheck.tie_broken === true);
const tieResult = classifyRoadmapType(tieText);
ok('classifyRoadmapType records tie_broken === true on an engineered tie', tieResult.tie_broken === true);
ok('tie-break picks the earlier ROADMAP_TYPES slug', tieResult.type === ROADMAP_TYPES[0]);

// ---------- 9. Registration ----------

ok('present in SENSOR_REGISTRY', sensors.SENSOR_REGISTRY.indexOf(sensorRoadmapType) !== -1);
ok('exported from insight-sensors', typeof sensors.sensorRoadmapType === 'function');

// ---------- 10. Dispatch-map non-membership ----------

const dmap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'dispatch-framework-map.json'), 'utf8'));
ok('roadmap-type-selector is NOT in dispatch-framework-map (a different seam)',
  !Object.prototype.hasOwnProperty.call(dmap, 'roadmap-type-selector'));

// ---------- 11. End-to-end through the real dispatcher ----------

const positiveDispatch = sensors.dispatchSensors(
  { text: 'I need a technical roadmap - what has to be solved first before the rest becomes possible', signals: [], turn_count: 5 },
  {}, { turn_count: 5 });
const fired = positiveDispatch.find(function (r) { return r && r.dispatch === 'roadmap-type-selector'; });
ok('dispatchSensors(technical-roadmap turn) includes a context_block reach',
  fired && fired.reach_id === 'context_block');
ok('dispatchSensors reach carries evidence.sensor_id === SENS-18',
  fired && fired.evidence.sensor_id === 'SENS-18');

for (const text of NEGATIVES) {
  const negTurn = { text: text, signals: [], turn_count: 5 };
  const negCtx = { turn_count: 5 };
  const negDispatch = sensors.dispatchSensors(negTurn, {}, negCtx);
  ok('dispatchSensors(negative turn) does NOT include the roadmap-type-selector reach: "' + text.slice(0, 30) + '..."',
    !negDispatch.some(function (r) { return r && r.dispatch === 'roadmap-type-selector'; }));
}

console.log('\nPASS ' + pass + ' assertions');
