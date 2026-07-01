'use strict';
/*
 * Phase 205-03 -- SENS-10 circularity sensor + registry registration + the
 * ranker clarify-vs-reframe flip.
 *
 * Asserts (Task 1) the four causes each route to a FROZEN-six exit reach + a
 * closed `cause` enum, a progressing turn returns null, malformed input soft-
 * fails, and the sensor makes no network / decide() call (grep). (Task 2) SENS-10
 * is APPEND-registered (the pre-205 order is a prefix), exported, and surfaces
 * end-to-end through dispatchSensors. (Task 3) with SENS-10 fired the recommended
 * detent is the exit (never a clarifying re-ask), a reframe stays eligible, and
 * with SENS-10 silent the ranking is byte-identical to the base.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { REACH_IDS, POSTURE_IDS } = require(path.join(REPO_ROOT, 'lib/core/sensors/sensor-types.cjs'));
const { sensorCircularity, CAUSES, CAUSE_EXIT } = require(path.join(REPO_ROOT, 'lib/core/sensors/sensor-circularity.cjs'));
const sensors = require(path.join(REPO_ROOT, 'lib/core/insight-sensors.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib/workflow/f-selector-ranker.cjs'));

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const CLOSED_CAUSES = ['answer_unheard', 'assertion_unvalidated', 'stuck_unlocated', 'wrong_frame'];

// ---------------------------------------------------------------------------
// TASK 1 -- the SENS-10 sensor: four causes -> four frozen-six exits.
// ---------------------------------------------------------------------------

// The closed cause set is exactly the four (drift guard on the enum).
ok('CAUSES has exactly the four closed values',
  JSON.stringify(Object.values(CAUSES).sort()) === JSON.stringify(CLOSED_CAUSES.slice().sort()));

// Four circling fixtures, one per cause.
const FIXTURES = [
  {
    label: 'answer_unheard',
    turn: { text: "I already answered that; we keep going back and forth and you're not answering my question", signals: [] },
    cause: 'answer_unheard',
    gear: 'TELL',
  },
  {
    label: 'assertion_unvalidated',
    turn: { text: 'obviously this market is huge, everyone knows that, trust me', signals: [] },
    cause: 'assertion_unvalidated',
    gear: 'GRILL',
  },
  {
    label: 'stuck_unlocated',
    turn: { text: "we're stuck; the pipeline is the bottleneck but I can't say where exactly", signals: [] },
    cause: 'stuck_unlocated',
    gear: 'GRILL',
  },
  {
    label: 'wrong_frame',
    turn: { text: "maybe we're asking the wrong question here, we should reframe this", signals: [] },
    cause: 'wrong_frame',
    gear: 'REFRAME',
  },
];

for (const fx of FIXTURES) {
  const r = sensorCircularity(fx.turn, { problem_type: 'WDP' }, {});
  ok('[' + fx.label + '] fires (non-null reach)', r !== null && typeof r === 'object');
  ok('[' + fx.label + '] reach_id is in the frozen REACH_IDS', REACH_IDS.indexOf(r.reach_id) !== -1);
  ok('[' + fx.label + '] posture is in the frozen POSTURE_IDS', POSTURE_IDS.indexOf(r.posture) !== -1);
  ok('[' + fx.label + '] classified to the expected cause', r.evidence.cause === fx.cause);
  ok('[' + fx.label + '] cause is in the closed set', CLOSED_CAUSES.indexOf(r.evidence.cause) !== -1);
  ok('[' + fx.label + '] gear enum matches the exit table', r.evidence.gear === fx.gear);
  ok('[' + fx.label + '] reach_id matches the CAUSE_EXIT mapping', r.reach_id === CAUSE_EXIT[fx.cause].reach_id);
  ok('[' + fx.label + '] signal is circularity_detected', r.signal === 'circularity_detected');
  // Part 8: evidence is a flat scalar/enum bag, no user prose.
  for (const key of Object.keys(r.evidence)) {
    const v = r.evidence[key];
    ok('[' + fx.label + '] evidence "' + key + '" is a scalar/enum', ['string', 'number', 'boolean'].indexOf(typeof v) !== -1);
  }
  ok('[' + fx.label + '] evidence carries no multi-word user prose',
    !Object.values(r.evidence).some(function (v) { return typeof v === 'string' && v.split(' ').length > 3; }));
}

// Every mapped reach_id is frozen-six (mints none).
for (const cause of CLOSED_CAUSES) {
  ok('CAUSE_EXIT[' + cause + '] reach_id is frozen-six', REACH_IDS.indexOf(CAUSE_EXIT[cause].reach_id) !== -1);
}

// stuck_unlocated genuinely reuses the SENS-02 lagging-component signal: a bare
// bottleneck phrasing (no explicit "stuck") still classifies stuck_unlocated.
const laggingOnly = sensorCircularity({ text: 'the data pipeline is the bottleneck', signals: [] }, {}, {});
ok('stuck_unlocated via SENS-02 lagging-component reuse (bottleneck only)',
  laggingOnly !== null && laggingOnly.evidence.cause === 'stuck_unlocated');

// Explicit signal forces the cause (signal-mode, the strongest tier).
const bySignal = sensorCircularity({ text: '', signals: ['wrong_frame'] }, {}, {});
ok('explicit signal fires', bySignal !== null);
ok('explicit signal recorded as mode=signal', bySignal.evidence.mode === 'signal');
ok('explicit signal classifies wrong_frame', bySignal.evidence.cause === 'wrong_frame');

// Generic circling signal defaults to answer_unheard (TELL).
const genericSig = sensorCircularity({ text: '', signals: [{ kind: 'circular' }] }, {}, {});
ok('generic circling signal defaults to answer_unheard', genericSig !== null && genericSig.evidence.cause === 'answer_unheard');

// A progressing conversation returns null (no circling).
const progressing = sensorCircularity({ text: "great, that makes sense, let's move on to pricing next", signals: [] }, {}, {});
ok('progressing conversation returns null', progressing === null);

// Soft-fail: malformed / throwing input yields null, never an exception.
const badInputs = [null, undefined, 42, 'a string', {}, { text: 123 }, { signals: 'nope' }];
for (const bad of badInputs) {
  let r = 'THREW';
  try { r = sensorCircularity(bad, null, null); } catch (_e) { r = 'THREW'; }
  ok('soft-fails to null on malformed input ' + JSON.stringify(bad), r === null);
}
// A signals array with a poisoned getter must not throw out of the sensor.
const poison = { text: 'circular', get signals() { throw new Error('boom'); } };
let poisonRes = 'THREW';
try { poisonRes = sensorCircularity(poison, {}, {}); } catch (_e) { poisonRes = 'THREW'; }
ok('soft-fails on a throwing turn getter (DoS mitigation)', poisonRes === null);

// Grep guard: the module performs no network call and no decide() call.
const srcSensor = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/sensors/sensor-circularity.cjs'), 'utf8');
ok('sensor makes no fetch/http network call', !/\bfetch\s*\(|require\(['"]https?['"]\)|node:http/.test(srcSensor));
ok('sensor never calls decide()', !/\bdecide\s*\(/.test(srcSensor));
ok('sensor never requires navigation-engine', !/navigation-engine/.test(srcSensor));
const EM_DASH = String.fromCharCode(0x2014); // detect the char without writing it
ok('sensor has no em-dashes (house rule)', srcSensor.indexOf(EM_DASH) === -1);

// ---------------------------------------------------------------------------
// TASK 2 -- registry registration (append-only) + dispatch surfacing.
// ---------------------------------------------------------------------------

ok('sensorCircularity exported from insight-sensors', typeof sensors.sensorCircularity === 'function');
ok('present in SENSOR_REGISTRY', sensors.SENSOR_REGISTRY.indexOf(sensors.sensorCircularity) !== -1);
ok('SENS-10 is the LAST registry entry (append, not insert)',
  sensors.SENSOR_REGISTRY[sensors.SENSOR_REGISTRY.length - 1] === sensors.sensorCircularity);

// Append-only: the pre-205 order (everything before SENS-10) is a prefix, and
// SENS-09 (sensorDiffusionAdoption) still precedes SENS-10.
const idxShow = sensors.SENSOR_REGISTRY.indexOf(sensors.sensorShowShare);
const idxCirc = sensors.SENSOR_REGISTRY.indexOf(sensors.sensorCircularity);
const idxDiff = sensors.SENSOR_REGISTRY.indexOf(sensors.sensorDiffusionAdoption);
ok('SENS-10 appended after SENS-SHOW (order unchanged for prior detectors)', idxCirc === idxShow + 1);
ok('SENS-09 (diffusion) still precedes SENS-10', idxDiff !== -1 && idxDiff < idxCirc);

// End-to-end: dispatchSensors surfaces the SENS-10 reach for a circling turn.
const dispatched = sensors.dispatchSensors(
  { text: "we're going round and round in circles and you're not answering", signals: [] },
  { problem_type: 'WDP' }, {});
ok('dispatchSensors returns an array', Array.isArray(dispatched));
const circReach = dispatched.find(function (r) { return r && r.signal === 'circularity_detected'; });
ok('dispatchSensors surfaces the SENS-10 circularity reach', !!circReach);
ok('the dispatched reach_id is frozen-six', circReach && REACH_IDS.indexOf(circReach.reach_id) !== -1);

// ---------------------------------------------------------------------------
// TASK 3 -- the ranker clarify-vs-reframe flip.
// ---------------------------------------------------------------------------

// Baseline (SENS-10 silent) ranking.
const baseArgs = { jtbd: 'validate-idea', problemType: 'WDP', roomState: {}, k: 3 };
const baseRanked = ranker.rankForSelector(baseArgs);
ok('base ranking is a plain array (synchronous, not a Promise)',
  Array.isArray(baseRanked) && typeof baseRanked.then !== 'function');

// No-op guard: passing a not-fired sens10 must be byte-identical to the base.
const notFired = ranker.rankForSelector(Object.assign({}, baseArgs, { sens10: { fired: false } }));
ok('sens10.fired=false is byte-identical to base (no-op)', JSON.stringify(notFired) === JSON.stringify(baseRanked));
const noSens10Absent = ranker.rankForSelector(Object.assign({}, baseArgs, { sens10: undefined }));
ok('absent sens10 is byte-identical to base (no-op)', JSON.stringify(noSens10Absent) === JSON.stringify(baseRanked));
ok('base rows carry no sens10 fields (no-op cleanliness)',
  baseRanked.every(function (it) { return !('detent' in it) && !('sens10_applied' in it); }));

// SENS-10 fired: the exit is the top recommendation; a clarifying re-ask is
// demoted; the reframe stays eligible.
const firedArgs = Object.assign({}, baseArgs, {
  sens10: {
    fired: true,
    exit_command: '/mos:challenge-assumptions', // the GRILL exit for assertion_unvalidated
    reframe_command: '/mos:beautiful-question',  // the allowed ASK-as-reframe
    clarify_commands: ['/mos:diagnose'],         // a re-ask-within-frame, must be demoted
    cause: 'assertion_unvalidated',
  },
});
const firedRanked = ranker.rankForSelector(firedArgs);
ok('fired ranking is a plain array (synchronous)', Array.isArray(firedRanked));
ok('top recommendation is the SENS-10 exit (not a re-ask)',
  firedRanked.length > 0 && firedRanked[0].command === '/mos:challenge-assumptions');
ok('top recommendation is tagged detent=exit', firedRanked[0].detent === 'exit');
ok('fired rows carry sens10_applied + cause', firedRanked.every(function (it) {
  return it.sens10_applied === true && it.sens10_cause === 'assertion_unvalidated';
}));
// The clarification re-ask is NEVER the recommended (top) detent.
ok('ASK-as-clarification is never the top recommendation',
  firedRanked[0].command !== '/mos:diagnose' && firedRanked[0].detent !== 'ask_clarification');
// If the clarification is present at all, it sits below every non-clarification row.
const clarIdx = firedRanked.findIndex(function (it) { return it.command === '/mos:diagnose'; });
if (clarIdx !== -1) {
  const nonClarAfter = firedRanked.slice(clarIdx + 1).some(function (it) { return it.detent !== 'ask_clarification'; });
  ok('ASK-as-clarification is demoted below all non-clarification rows', nonClarAfter === false);
}

// ASK-as-reframe stays eligible: a larger-k pull keeps the reframe in the list.
const firedWide = ranker.rankForSelector(Object.assign({}, baseArgs, {
  k: 3,
  sens10: {
    fired: true,
    exit_command: '/mos:challenge-assumptions',
    reframe_command: '/mos:beautiful-question',
    clarify_commands: ['/mos:diagnose'],
    cause: 'wrong_frame',
  },
}));
const reframeRow = firedWide.find(function (it) { return it.command === '/mos:beautiful-question' || it.detent === 'ask_reframe'; });
ok('ASK-as-reframe remains eligible in the ranked list', !!reframeRow);
ok('the reframe row is tagged detent=ask_reframe', reframeRow.detent === 'ask_reframe');
ok('the reframe sits directly after the exit (reserved slot)',
  firedWide[0].detent === 'exit' && firedWide[1] && firedWide[1].detent === 'ask_reframe');

// House rule: the ranker source has no em-dashes.
const srcRanker = fs.readFileSync(path.join(REPO_ROOT, 'lib/workflow/f-selector-ranker.cjs'), 'utf8');
ok('ranker flip source has no em-dashes', srcRanker.indexOf(EM_DASH) === -1);

console.log('\nPASS ' + pass + ' assertions');
