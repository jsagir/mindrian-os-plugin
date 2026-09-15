#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-05 Task 2 -- test-345-lockstep: pins SENS-20 (sensorStrategyReach,
 * lib/core/sensors/sensor-strategy-reach.cjs, shipped inert by 345-04) as a
 * FULL member of the seven-place lockstep (343-ICM-CONSULT.md's binding
 * correction; 345-RESEARCH Pattern 1), places 2 through 6 in this file's own
 * scope. Place 7 (the ctx producer block in decide()) is pinned separately by
 * tests/test-345-producer-fires.cjs, from the far end, per the same consult's
 * instruction: a unit test that calls sensorStrategyReach(...) directly (or
 * checks the registry alone) cannot catch a missing producer block, so that
 * pin belongs to a different file.
 *
 * ID CORRECTION (docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md Section
 * 6): the strategy-reach sensor registers as SENS-20, not SENS-19 --
 * SENS-19 was already claimed by Phase 343's sensorGraphIntegrity on this
 * tree. Every assertion below reads SENS-20.
 *
 * SENS_PRIORITY SHAPE NOTE: 343-04 (CENSUS-08, WD-8) turned SENS_PRIORITY's
 * elements into { id, optimizes, watched_by, why } records. Group A/D
 * membership is therefore asserted through SENS_PRIORITY_IDS (the derived id
 * array), never a raw SENS_PRIORITY.indexOf on a string.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure,
 * self-contained. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');

const insightSensors = require('../lib/core/insight-sensors.cjs');
const { SENSOR_REGISTRY, SENSOR_REGISTRY_IDS, sensorStrategyReach } = insightSensors;
const { SENS_PRIORITY, SENS_PRIORITY_IDS, sensorPriorityRank } = require('../lib/core/sensors/sensor-priority.cjs');
const sensorFile = require('../lib/core/sensors/sensor-strategy-reach.cjs');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-345-lockstep:');

// ---------------------------------------------------------------------------
// Place 1 (free): the detector file exports the function this file pins
// against, and it is the SAME function object insight-sensors.cjs requires.
// ---------------------------------------------------------------------------
assert.strictEqual(typeof sensorFile.sensorStrategyReach, 'function', 'the detector module must export sensorStrategyReach');
assert.strictEqual(sensorFile.sensorStrategyReach, sensorStrategyReach, 'insight-sensors.cjs must require the SAME function, never a copy');
ok('the detector file exports sensorStrategyReach, and insight-sensors.cjs requires that exact function');

// ---------------------------------------------------------------------------
// Places 3 + 4: SENSOR_REGISTRY and SENSOR_REGISTRY_IDS stay index-parallel,
// and SENS-20 sits at the SAME index in both.
// ---------------------------------------------------------------------------
assert.strictEqual(
  SENSOR_REGISTRY.length,
  SENSOR_REGISTRY_IDS.length,
  'SENSOR_REGISTRY and SENSOR_REGISTRY_IDS must stay the same length'
);
ok('SENSOR_REGISTRY and SENSOR_REGISTRY_IDS are the same length (' + SENSOR_REGISTRY.length + ')');

const idIndex = SENSOR_REGISTRY_IDS.indexOf('SENS-20');
assert.notStrictEqual(idIndex, -1, 'SENSOR_REGISTRY_IDS must contain SENS-20');
assert.strictEqual(
  SENSOR_REGISTRY_IDS.indexOf('SENS-20', idIndex + 1),
  -1,
  'SENSOR_REGISTRY_IDS must contain SENS-20 exactly once'
);
const fnIndex = SENSOR_REGISTRY.indexOf(sensorStrategyReach);
assert.notStrictEqual(fnIndex, -1, 'SENSOR_REGISTRY must contain the sensorStrategyReach function');
assert.strictEqual(
  SENSOR_REGISTRY.indexOf(sensorStrategyReach, fnIndex + 1),
  -1,
  'SENSOR_REGISTRY must contain sensorStrategyReach exactly once'
);
assert.strictEqual(
  idIndex,
  fnIndex,
  "SENSOR_REGISTRY_IDS.indexOf('SENS-20') must equal SENSOR_REGISTRY.indexOf(sensorStrategyReach) -- same index, both arrays"
);
ok("SENSOR_REGISTRY_IDS.indexOf('SENS-20') === SENSOR_REGISTRY.indexOf(sensorStrategyReach), at index " + idIndex);

// ---------------------------------------------------------------------------
// Place 5: the module exports sensorStrategyReach BY NAME (Phase 245-01 found
// sensorRoomPick registered but unexported -- this is the exact gap that
// leaves behind).
// ---------------------------------------------------------------------------
assert.strictEqual(
  insightSensors.sensorStrategyReach,
  sensorStrategyReach,
  'lib/core/insight-sensors.cjs must export sensorStrategyReach by name'
);
ok('sensorStrategyReach is reachable by name on insight-sensors.cjs module.exports');

// ---------------------------------------------------------------------------
// Place 6: SENS_PRIORITY carries a SENS-20 record with all four counter-
// metric keys (343-04 completeness gate), ranked in Group A -- strictly
// after SENS-11 and strictly before SENS-14, which pins Group A membership
// POSITIONALLY without hardcoding an absolute index that the next sensor
// registration would immediately go stale.
// ---------------------------------------------------------------------------
const sens20Record = SENS_PRIORITY.find((r) => r.id === 'SENS-20');
assert.ok(sens20Record, 'SENS_PRIORITY must contain a SENS-20 record');
for (const key of ['id', 'optimizes', 'watched_by', 'why']) {
  assert.ok(Object.prototype.hasOwnProperty.call(sens20Record, key), 'the SENS-20 record must carry its own "' + key + '" key');
}
assert.ok(Object.isFrozen(sens20Record), 'the SENS-20 record must be frozen');
ok('SENS_PRIORITY contains a frozen SENS-20 record with all four keys');

const rank20 = SENS_PRIORITY_IDS.indexOf('SENS-20');
const rank11 = SENS_PRIORITY_IDS.indexOf('SENS-11');
const rank14 = SENS_PRIORITY_IDS.indexOf('SENS-14');
assert.notStrictEqual(rank20, -1, 'SENS-20 must appear in SENS_PRIORITY_IDS');
assert.ok(rank20 > rank11, 'SENS-20 must rank after SENS-11 (Group A ordering)');
assert.ok(rank20 < rank14, 'SENS-20 must rank before SENS-14 (still Group A, not spilled into Group B)');
ok('SENS_PRIORITY_IDS places SENS-20 strictly between SENS-11 and SENS-14 (Group A membership, positional pin)');

assert.ok(
  sensorPriorityRank('SENS-20') < sensorPriorityRank('SENS-16'),
  'SENS-20 (Group A) must outrank SENS-16 (Group D), per Canon Part 11 R3'
);
ok('sensorPriorityRank(SENS-20) < sensorPriorityRank(SENS-16): Group A outranks the Group D fallback tier');

// ---------------------------------------------------------------------------
// The 343-04 completeness gate itself: every registered sensor (SENS-20
// included) has a coherent optimizes/watched_by pairing. Duplicates the
// build gate's own arm 4 for a second audience (this phase suite), same
// reason test-245-priority-complete.cjs's own header states.
// ---------------------------------------------------------------------------
const validPairValue = (v) => v === null || (typeof v === 'string' && v.length > 0);
assert.ok(validPairValue(sens20Record.optimizes), 'SENS-20.optimizes must be null or a non-empty string');
assert.ok(validPairValue(sens20Record.watched_by), 'SENS-20.watched_by must be null or a non-empty string');
assert.strictEqual(
  sens20Record.optimizes === null,
  sens20Record.watched_by === null,
  'SENS-20 must declare optimizes/watched_by null together or non-null together'
);
ok('SENS-20 declares a coherent counter-metric pairing (343-04 doctrine)');

// ---------------------------------------------------------------------------
// Place 8 (deliberately NOT taken, per this plan's own ruling): no command
// frontmatter declares sensor_triggers: [SENS-20], and the registry regen
// this plan runs must not touch commands/.
// ---------------------------------------------------------------------------
const { execSync } = require('node:child_process');
const path = require('node:path');
const repoRoot = path.resolve(__dirname, '..');
let commandsGrep = '';
try {
  commandsGrep = execSync("grep -rl 'SENS-20' commands/ 2>/dev/null || true", { cwd: repoRoot }).toString().trim();
} catch (_e) {
  commandsGrep = '';
}
assert.strictEqual(commandsGrep, '', 'no commands/*.md may declare SENS-20 (place 8 is deliberately not taken this phase): ' + commandsGrep);
ok('no command frontmatter declares sensor_triggers for SENS-20 (place 8 deferred, as ruled)');

console.log('');
console.log('PASS test-345-lockstep.cjs (' + checks + ' checks)');
