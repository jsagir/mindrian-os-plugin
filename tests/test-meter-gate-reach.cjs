'use strict';
/*
 * Phase 183-01 METER-01 RED pin: gate_reached EVENT_TYPES membership + the single
 * engine-arm emit. Mirrors the tests/test-canon-entry-31-two-gauge-floor.cjs FLOOR
 * idiom (named membership, never a raw count). RED until Task 2 adds the additive
 * gate_reached member to the frozen EVENT_TYPES Set and the one emit line beside the
 * live reach_presented loop at the engine arm; GREEN after.
 *
 * Canon Part 8: zero Brain / network. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const { EVENT_TYPES } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs')
);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// 1: gate_reached is a member of the frozen EVENT_TYPES Set (the additive idiom).
ok('EVENT_TYPES has gate_reached', EVENT_TYPES.has('gate_reached'));

// 2: the single engine-arm emit literal is present (one gate_reached emit beside
//    the live reach_presented loop, guarded by offered.length > 0).
const icl = fs.readFileSync(
  path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs'), 'utf8'
);
ok('intent-classifier carries the gate_reached emit',
  icl.includes("logMemoryEvent(roomDb, 'gate_reached'"));

// 3: it is a SINGLE hook (per-gate, NOT one-per-reach) -- exactly one occurrence.
const count = icl.split("logMemoryEvent(roomDb, 'gate_reached'").length - 1;
ok('exactly one gate_reached emit (single hook, not per-reach)', count === 1);

// 4: a dedupe handle rides the gate_reached payload (turn-keyed idempotency, so a
//    re-entrant arm cannot double-count one gate).
ok('the gate_reached payload carries a dedupe_key',
  /gate_reached'[\s\S]{0,400}dedupe_key/.test(icl));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-meter-gate-reach.cjs: PASSED');
