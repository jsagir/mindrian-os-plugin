'use strict';
/*
 * SENS-SHOW show/share sensor unit test (Phase 173 R4).
 *
 * Mirrors tests/test-diffusion-adoption-sensor.cjs verbatim in idiom. Asserts:
 * null without a trigger; fires on signal / keyword / context with a FROZEN
 * reach_id (context_block) + posture (hold); Part-8-clean evidence (scalars/enums,
 * no user prose); registered in SENSOR_REGISTRY + exported from insight-sensors;
 * the dispatch handle is the /mos:show selector route (NOT a Brain framework);
 * dispatchSensors({show turn}) includes a context_block reach AND
 * dispatchSensors({neutral turn}) does not include the show-share reach.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');

const { REACH_IDS, POSTURE_IDS } = require('../lib/core/sensors/sensor-types.cjs');
const { sensorShowShare } = require('../lib/core/sensors/sensor-show-share.cjs');
const sensors = require('../lib/core/insight-sensors.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// 1. null when no trigger
const none = sensorShowShare(
  { text: 'we sell artisanal sourdough bread', signals: [] },
  { problem_type: 'IDP' }, {});
ok('null with no show/share trigger', none === null);

// 2. SIGNAL MODE -> frozen reach
const bySignal = sensorShowShare(
  { text: '', signals: ['show_share_intent'] },
  { problem_type: 'IDP' }, {});
ok('fires on explicit signal', bySignal && typeof bySignal === 'object');
ok('reach_id is in frozen REACH_IDS', REACH_IDS.indexOf(bySignal.reach_id) !== -1);
ok('posture is in frozen POSTURE_IDS', POSTURE_IDS.indexOf(bySignal.posture) !== -1);
ok('reach_id is context_block (no 7th reach minted)', bySignal.reach_id === 'context_block');
ok('posture is hold (standing suggestion, never auto-opens UI)', bySignal.posture === 'hold');
ok('signal mode recorded', bySignal.evidence.mode === 'signal');
ok('dispatch is the /mos:show selector handle', bySignal.dispatch === 'show-jtbd-selector');
ok('signal kind recorded', bySignal.signal === 'show_share_intent');

// 3. KEYWORD MODE -> show/share lexicon hit in LOCAL turn text
const byKeyword = sensorShowShare(
  { text: 'help me show my work to investors', signals: [] },
  { problem_type: 'WDP' }, {});
ok('fires on show keyword', byKeyword !== null);
ok('keyword mode recorded', byKeyword.evidence.mode === 'keyword');
ok('keyword still fires context_block', byKeyword.reach_id === 'context_block');
ok('keyword still posture hold', byKeyword.posture === 'hold');

// 3b. additional keyword terms (present / share / publish / make it land)
ok('fires on "present"', sensorShowShare({ text: 'present this to the board', signals: [] }, {}, {}) !== null);
ok('fires on "make it land"', sensorShowShare({ text: 'help me make it land', signals: [] }, {}, {}) !== null);
ok('fires on "publish"', sensorShowShare({ text: 'publish my room', signals: [] }, {}, {}) !== null);

// 4. Part 8 -- evidence carries only scalars/enums and no user prose
for (const k of Object.keys(byKeyword.evidence)) {
  const v = byKeyword.evidence[k];
  ok('evidence "' + k + '" is a scalar/enum',
    v === null || ['string', 'number', 'boolean'].indexOf(typeof v) !== -1);
}
ok('no multi-word user prose in evidence',
  !Object.values(byKeyword.evidence).some(function (v) {
    return typeof v === 'string' && v.split(' ').length > 3;
  }));

// 5. registered + exported
ok('present in SENSOR_REGISTRY', sensors.SENSOR_REGISTRY.indexOf(sensorShowShare) !== -1);
ok('exported from insight-sensors', typeof sensors.sensorShowShare === 'function');

// 6. CONTEXT branch primary, keyword DEMOTED (R3 / INV-07).
// Behavior 1: a show/share-shaped problem_type (the LOCAL navigator problem-state,
// read via the navigation.cjs chokepoint convention) fires the CONTEXT tier even
// with NO show/share lexicon in the turn text.
const byContext = sensorShowShare(
  { text: 'are the pieces ready for someone outside?', signals: [] },
  { problem_type: 'present' }, {});
ok('fires on show/share problem_type with no keyword', byContext !== null);
ok('context mode recorded (not keyword)', byContext.evidence.mode === 'context');
ok('context branch still fires context_block', byContext.reach_id === 'context_block');
ok('context branch posture frozen', POSTURE_IDS.indexOf(byContext.posture) !== -1);

// Behavior 2: with NO show/share problem-state, a bare lexicon hit fires the
// DEMOTED keyword fallback tier (proves keyword is reachable but secondary).
ok('keyword is the demoted fallback tier', byKeyword.evidence.mode === 'keyword');
ok('keyword fallback only when no show/share context', byKeyword.evidence.problem_type === 'WDP');

// 7. dispatch is the /mos:show selector route, NOT a Brain framework -- so it does
// NOT appear in data/dispatch-framework-map.json (that map is framework-only;
// the selector resolves through the command-resolver path). This keeps
// tests/test-dispatch-framework-map-drift.cjs green (the map is untouched).
const fs = require('node:fs');
const path = require('node:path');
const dmap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'dispatch-framework-map.json'), 'utf8'));
ok('show-jtbd-selector is NOT in dispatch-framework-map (selector route, not framework)',
  !Object.prototype.hasOwnProperty.call(dmap, 'show-jtbd-selector'));

// 8. dispatchSensors: a show/share turn produces a context_block reach; a neutral
// turn does not produce the show-share reach.
const showReaches = sensors.dispatchSensors(
  { text: 'help me show my work to investors', signals: [] },
  { problem_type: 'IDP' }, {});
ok('dispatchSensors(show turn) includes a context_block reach',
  showReaches.some(function (r) { return r && r.reach_id === 'context_block' && r.dispatch === 'show-jtbd-selector'; }));

const neutralReaches = sensors.dispatchSensors(
  { text: 'what is the weather today', signals: [] },
  { problem_type: 'IDP' }, {});
ok('dispatchSensors(neutral turn) does NOT include the show-share reach',
  !neutralReaches.some(function (r) { return r && r.dispatch === 'show-jtbd-selector'; }));

// 9. the R12 cross-surface Tri-Polar note is carried in the sensor file.
const sensorSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'core', 'sensors', 'sensor-show-share.cjs'), 'utf8');
ok('sensor file carries the R12 cross-surface Tri-Polar note',
  /R12 CROSS-SURFACE/.test(sensorSrc) && /ui:\/\//.test(sensorSrc) && /IDENTICAL/.test(sensorSrc));

console.log('\nPASS ' + pass + ' assertions');
