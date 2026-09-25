#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 03 Task 1 -- test-3551-lockstep: pins SENS-21
 * (sensorRoomDelta, lib/core/sensors/sensor-room-delta.cjs) as a full member
 * of the six-place lockstep (places 1-6; place 7, a decide() ctx producer, is
 * deliberately absent -- this file also pins that absence). Mirrors
 * tests/test-345-lockstep.cjs's own shape for SENS-20.
 *
 * ID CORRECTION (355.1-CONTEXT.md "Research corrections applied"): the PRD
 * text said SENS-20; Phase 345 already holds SENS-20 as sensorStrategyReach.
 * The correct, re-grepped-at-registration id is SENS-21. Every assertion
 * below reads SENS-21.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure.
 * House rule: hyphens only, no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');

let insightSensors;
try {
  insightSensors = require('../lib/core/insight-sensors.cjs');
} catch (_e) {
  insightSensors = null;
}
const { SENS_PRIORITY, SENS_PRIORITY_IDS } = require('../lib/core/sensors/sensor-priority.cjs');

let sensorFile;
try {
  sensorFile = require('../lib/core/sensors/sensor-room-delta.cjs');
} catch (_e) {
  sensorFile = null;
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-lockstep:');

// ---------------------------------------------------------------------------
// Place 1: the sensor file exists, exports sensorRoomDelta with SENSOR_ID
// 'SENS-21', REACH_ID 'context_block', and sensorRoomDelta.constructor.name
// !== 'AsyncFunction' (a sensor must never be async -- dispatchSensors drops
// async sensors silently).
// ---------------------------------------------------------------------------
assert.ok(sensorFile, 'lib/core/sensors/sensor-room-delta.cjs must exist and load (module missing)');
assert.strictEqual(sensorFile.SENSOR_ID, 'SENS-21', 'sensor-room-delta.cjs must self-declare SENSOR_ID === \'SENS-21\'');
assert.strictEqual(sensorFile.REACH_ID, 'context_block', 'sensor-room-delta.cjs must ride the EXISTING context_block reach');
assert.strictEqual(typeof sensorFile.sensorRoomDelta, 'function', 'the detector module must export sensorRoomDelta');
assert.notStrictEqual(sensorFile.sensorRoomDelta.constructor.name, 'AsyncFunction', 'sensorRoomDelta must never be async');
ok('sensor-room-delta.cjs exports sensorRoomDelta, SENSOR_ID === \'SENS-21\', REACH_ID === \'context_block\', and is never async');

// ---------------------------------------------------------------------------
// Place 2: insight-sensors.cjs requires the SAME function object.
// ---------------------------------------------------------------------------
assert.ok(insightSensors, 'lib/core/insight-sensors.cjs must exist and load');
assert.strictEqual(insightSensors.sensorRoomDelta, sensorFile.sensorRoomDelta, 'insight-sensors.cjs must require the SAME function, never a copy');
ok('insight-sensors.cjs requires the exact sensorRoomDelta function sensor-room-delta.cjs exports');

// ---------------------------------------------------------------------------
// Places 3 + 4: SENSOR_REGISTRY and SENSOR_REGISTRY_IDS stay index-parallel,
// and SENS-21 sits at the SAME index in both.
// ---------------------------------------------------------------------------
const { SENSOR_REGISTRY, SENSOR_REGISTRY_IDS } = insightSensors;
assert.strictEqual(SENSOR_REGISTRY.length, SENSOR_REGISTRY_IDS.length, 'SENSOR_REGISTRY and SENSOR_REGISTRY_IDS must stay the same length');
ok('SENSOR_REGISTRY and SENSOR_REGISTRY_IDS are the same length (' + SENSOR_REGISTRY.length + ')');

const idIndex = SENSOR_REGISTRY_IDS.indexOf('SENS-21');
assert.notStrictEqual(idIndex, -1, 'SENSOR_REGISTRY_IDS must contain SENS-21');
assert.strictEqual(SENSOR_REGISTRY_IDS.indexOf('SENS-21', idIndex + 1), -1, 'SENSOR_REGISTRY_IDS must contain SENS-21 exactly once');
const fnIndex = SENSOR_REGISTRY.indexOf(sensorFile.sensorRoomDelta);
assert.notStrictEqual(fnIndex, -1, 'SENSOR_REGISTRY must contain the sensorRoomDelta function');
assert.strictEqual(SENSOR_REGISTRY.indexOf(sensorFile.sensorRoomDelta, fnIndex + 1), -1, 'SENSOR_REGISTRY must contain sensorRoomDelta exactly once');
assert.strictEqual(idIndex, fnIndex, "SENSOR_REGISTRY_IDS.indexOf('SENS-21') must equal SENSOR_REGISTRY.indexOf(sensorRoomDelta) -- same index, both arrays");
ok("SENSOR_REGISTRY_IDS.indexOf('SENS-21') === SENSOR_REGISTRY.indexOf(sensorRoomDelta), at index " + idIndex);

// ---------------------------------------------------------------------------
// Place 5: module.exports.sensorRoomDelta reachable by name.
// ---------------------------------------------------------------------------
assert.strictEqual(insightSensors.sensorRoomDelta, sensorFile.sensorRoomDelta, 'lib/core/insight-sensors.cjs must export sensorRoomDelta by name');
ok('sensorRoomDelta is reachable by name on insight-sensors.cjs module.exports');

// ---------------------------------------------------------------------------
// Place 6: SENS_PRIORITY carries exactly one frozen SENS-21 record with
// non-empty optimizes / watched_by / why, placed in Group B immediately
// after SENS-13 (positional pin -- never a hardcoded absolute index).
// ---------------------------------------------------------------------------
const sens21Records = SENS_PRIORITY.filter((r) => r.id === 'SENS-21');
assert.strictEqual(sens21Records.length, 1, 'SENS_PRIORITY must contain exactly one SENS-21 record');
const sens21Record = sens21Records[0];
for (const key of ['id', 'optimizes', 'watched_by', 'why']) {
  assert.ok(Object.prototype.hasOwnProperty.call(sens21Record, key), 'the SENS-21 record must carry its own "' + key + '" key');
  assert.ok(typeof sens21Record[key] === 'string' && sens21Record[key].length > 0, 'SENS-21.' + key + ' must be a non-empty string');
}
assert.ok(Object.isFrozen(sens21Record), 'the SENS-21 record must be frozen');
ok('SENS_PRIORITY contains exactly one frozen SENS-21 record with non-empty optimizes/watched_by/why');

const rank21 = SENS_PRIORITY_IDS.indexOf('SENS-21');
const rank13 = SENS_PRIORITY_IDS.indexOf('SENS-13');
assert.notStrictEqual(rank13, -1, 'SENS_PRIORITY_IDS must contain SENS-13 (the Group B neighbor this plan places SENS-21 after)');
assert.strictEqual(rank21, rank13 + 1, 'SENS-21 must sit IMMEDIATELY after SENS-13 in SENS_PRIORITY (Group B placement)');
ok('SENS-21 sits immediately after SENS-13 in SENS_PRIORITY (Group B, positional pin)');

// ---------------------------------------------------------------------------
// The 343-04 completeness gate: SENS-21's optimizes/watched_by pairing is
// coherent (non-empty together, per the header contract).
// ---------------------------------------------------------------------------
assert.strictEqual(sens21Record.optimizes === null, sens21Record.watched_by === null, 'SENS-21 must declare optimizes/watched_by null together or non-null together');
ok('SENS-21 declares a coherent counter-metric pairing (343-04 doctrine)');

// ---------------------------------------------------------------------------
// Place 7 (deliberately NOT taken, per this plan's own ruling): no command
// frontmatter declares sensor_triggers: [SENS-21], and no decide() ctx
// producer block mentions SENS-21.
// ---------------------------------------------------------------------------
const repoRoot = path.resolve(__dirname, '..');
let commandsGrep = '';
try {
  commandsGrep = execSync("grep -rl 'SENS-21' commands/ 2>/dev/null || true", { cwd: repoRoot }).toString().trim();
} catch (_e) {
  commandsGrep = '';
}
assert.strictEqual(commandsGrep, '', 'no commands/*.md may declare SENS-21 (place 7 is deliberately not taken this phase): ' + commandsGrep);
ok('no command frontmatter declares sensor_triggers for SENS-21 (place 7 deliberately absent)');

let engineGrep = '';
try {
  engineGrep = execSync("grep -l 'SENS-21' lib/core/navigation-engine.cjs 2>/dev/null || true", { cwd: repoRoot }).toString().trim();
} catch (_e) {
  engineGrep = '';
}
assert.strictEqual(engineGrep, '', 'navigation-engine.cjs (decide()) must not name SENS-21 in a ctx producer block (place 7 deliberately absent)');
ok('lib/core/navigation-engine.cjs carries no SENS-21 ctx producer block (place 7 deliberately absent)');

console.log('');
console.log('PASS test-3551-lockstep.cjs (' + checks + ' checks)');

assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
netGuard.restore();
