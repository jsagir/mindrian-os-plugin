'use strict';
/*
 * SENS-09 diffusion-adoption sensor test (Phase 170 dual-use diffusion).
 *
 * Asserts: null without a trigger; fires on signal / keyword / marker with a
 * FROZEN reach_id + posture; Part-8-clean evidence (scalars/enums, no user
 * prose); registered in SENSOR_REGISTRY + exported; the dispatch handle
 * resolves through the WFL-01 map to a real framework name in the allowlist.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { REACH_IDS, POSTURE_IDS } = require('../lib/core/sensors/sensor-types.cjs');
const { sensorDiffusionAdoption } = require('../lib/core/sensors/sensor-diffusion-adoption.cjs');
const sensors = require('../lib/core/insight-sensors.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// 1. null when no trigger
const none = sensorDiffusionAdoption(
  { text: 'we sell artisanal sourdough bread', signals: [] },
  { problem_type: 'IDP' }, {});
ok('null with no diffusion trigger', none === null);

// 2. SIGNAL MODE -> frozen reach
const bySignal = sensorDiffusionAdoption(
  { text: '', signals: ['diffusion_detected'] },
  { problem_type: 'IDP' }, {});
ok('fires on explicit signal', bySignal && typeof bySignal === 'object');
ok('reach_id is in frozen REACH_IDS', REACH_IDS.indexOf(bySignal.reach_id) !== -1);
ok('posture is in frozen POSTURE_IDS', POSTURE_IDS.indexOf(bySignal.posture) !== -1);
ok('reach_id is brain_consult', bySignal.reach_id === 'brain_consult');
ok('signal mode recorded', bySignal.evidence.mode === 'signal');
ok('dispatch is generic handle', bySignal.dispatch === 'adoption-capacity');
ok('companion is generic handle', bySignal.companions.indexOf('brain_framework_chain:adoption-capacity') !== -1);

// 3. KEYWORD MODE -> dual-use lexicon hit in LOCAL turn text
const byKeyword = sensorDiffusionAdoption(
  { text: 'a dual-use drone swarm for the navy', signals: [] },
  { problem_type: 'WDP' }, {});
ok('fires on dual-use keyword', byKeyword !== null);
ok('keyword mode recorded', byKeyword.evidence.mode === 'keyword');

// 4. MARKER MODE -> fresh side-channel marker
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-sens-'));
fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
fs.writeFileSync(path.join(tmp, '.mindrian', 'diffusion-scan-x.json'), '{}');
const byMarker = sensorDiffusionAdoption(
  { text: 'unrelated text', signals: [] }, {}, { roomDir: tmp });
ok('fires on fresh marker', byMarker !== null);
ok('marker mode recorded', byMarker.evidence.mode === 'marker');

// 5. Part 8 -- evidence carries only scalars/enums and no user prose
for (const k of Object.keys(byKeyword.evidence)) {
  const v = byKeyword.evidence[k];
  ok('evidence "' + k + '" is a scalar', ['string', 'number', 'boolean'].indexOf(typeof v) !== -1);
}
ok('no multi-word user prose in evidence',
  !Object.values(byKeyword.evidence).some(function (v) {
    return typeof v === 'string' && v.split(' ').length > 3;
  }));

// 6. registered + exported
ok('present in SENSOR_REGISTRY', sensors.SENSOR_REGISTRY.indexOf(sensorDiffusionAdoption) !== -1);
ok('exported from insight-sensors', typeof sensors.sensorDiffusionAdoption === 'function');

// 7. dispatch resolves through WFL-01 map -> framework name -> allowlist
const dmap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'dispatch-framework-map.json'), 'utf8'));
ok('dispatch maps to framework name', dmap['adoption-capacity'] === 'Adoption-Capacity Theory');
const fnames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'framework-names.json'), 'utf8'));
const allNames = (fnames.framework_names || []).concat(fnames.curated_extras || []);
ok('framework name in allowlist', allNames.indexOf('Adoption-Capacity Theory') !== -1);

// 8. Phase 172-12 (R3 / INV-07) -- CONTEXT branch primary, keyword DEMOTED.
// Behavior 1: a diffusion-shaped problem_type (the LOCAL navigator problem-state,
// read via the navigation.cjs chokepoint convention) fires the CONTEXT tier even
// with NO diffusion lexicon in the turn text.
const byContext = sensorDiffusionAdoption(
  { text: 'will this catch on in the field?', signals: [] },
  { problem_type: 'diffusion' }, {});
ok('fires on diffusion problem_type with no keyword', byContext !== null);
ok('context mode recorded (not keyword)', byContext.evidence.mode === 'context');

// Behavior 2: with NO diffusion problem-state, a bare lexicon hit fires the
// DEMOTED keyword fallback tier (proves keyword is reachable but secondary).
ok('keyword is the demoted fallback tier', byKeyword.evidence.mode === 'keyword');
ok('keyword fallback only when no diffusion context', byKeyword.evidence.problem_type === 'WDP');

// Behavior 3: every firing mode still uses the FROZEN brain_consult reach (no
// 7th reach minted by the context branch).
ok('context branch still fires brain_consult', byContext.reach_id === 'brain_consult');
ok('context branch posture frozen', POSTURE_IDS.indexOf(byContext.posture) !== -1);

// Behavior 4: the evidence carries only enums (mode + trigger_tier + problem_type),
// never matched user text (Part 8).
for (const k of Object.keys(byContext.evidence)) {
  const v = byContext.evidence[k];
  ok('context evidence "' + k + '" is scalar/enum',
    v === null || ['string', 'number', 'boolean'].indexOf(typeof v) !== -1);
}
ok('context evidence has no user prose',
  !Object.values(byContext.evidence).some(function (v) {
    return typeof v === 'string' && v.split(' ').length > 3;
  }));

console.log('\nPASS ' + pass + ' assertions');
