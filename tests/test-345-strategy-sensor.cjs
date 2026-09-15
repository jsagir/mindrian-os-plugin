#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-04 Task 2 -- one named leg per refusal branch, plus the two fire
 * branches, for lib/core/sensors/sensor-strategy-reach.cjs (SENS-20, see
 * that file's own header for the id-correction note).
 *
 * FLOOR-FIRST DEVIATION (recorded here, and in 345-04-SUMMARY.md, per Rule
 * 1 -- the same class of correction 345-03-SUMMARY.md's deviation 1 already
 * made for goal-cadence.cjs's own test suite). The plan's own <behavior>
 * bullet list gives the stall-fire example keyed on
 * STRATEGY_STALL_MIN_SAMPLE (12) alone, but goal-cadence.cjs::shouldPropose
 * checks STRATEGY_MIN_INTERVAL_REACHES (20) FIRST and short-circuits to
 * propose:false regardless of every other count when reaches_since < 20.
 * 12 < 20, so a literal reaches_since=12 stall-true case never reaches the
 * stall branch at all. This suite drives the "fires on stall" and "refuses
 * when artifacts filed" legs at reaches_since =
 * max(STRATEGY_STALL_MIN_SAMPLE, STRATEGY_MIN_INTERVAL_REACHES) = 20, so the
 * case clears the floor and the stall sample size at once, honoring the
 * floor-first order the sensor itself (and goal-cadence.cjs) implement.
 *
 * Fixture rooms live under os.tmpdir() with a unique suffix per leg;
 * MINDRIAN_ROOMS_HOME is pointed at a scratch root for the duration of this
 * file and restored on exit (344-05 fixture discipline) -- the user's real
 * rooms directory is never touched. Plain-node house style: hand-rolled ok()
 * helper, a failing assertion prints and process.exit(1)s. CJS. No em-dashes.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SENSOR_PATH = path.join(ROOT, 'lib', 'core', 'sensors', 'sensor-strategy-reach.cjs');
const JTBD_STATE_PATH = path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs');
const CADENCE_PATH = path.join(ROOT, 'lib', 'core', 'strategy', 'goal-cadence.cjs');

let checks = 0;
let failed = 0;

function ok(label, cond) {
  checks++;
  if (!cond) {
    failed++;
    console.log('FAIL: ' + label);
  } else {
    console.log('ok: ' + label);
  }
}

const { sensorStrategyReach } = require(SENSOR_PATH);
const jtbdState = require(JTBD_STATE_PATH);
const goalCadence = require(CADENCE_PATH);

// The floor-first constant driving the stall/artifacts legs (see header note).
const STALL_REACHES = Math.max(goalCadence.STRATEGY_STALL_MIN_SAMPLE, goalCadence.STRATEGY_MIN_INTERVAL_REACHES);

// ---------------------------------------------------------------------------
// Fixture room scaffolding. jtbd-state.cjs takes roomDir directly (no env
// var read), so MINDRIAN_ROOMS_HOME below is defense-in-depth per the
// fixture-discipline convention, not a functional requirement of the module
// under test.
// ---------------------------------------------------------------------------
const SCRATCH_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-test-345-strategy-sensor-'));
const PRIOR_ROOMS_HOME = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = SCRATCH_ROOT;

let legCounter = 0;
function freshRoomDir() {
  legCounter += 1;
  const dir = path.join(SCRATCH_ROOT, 'room-' + legCounter);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ratifiedGoalRoom(jtbd, rung) {
  const roomDir = freshRoomDir();
  jtbdState.setGoal(roomDir, { jtbd: jtbd || 'validate-idea', rung: rung || 'IllDefined', set_by: 'gate_answer' });
  return roomDir;
}

// The base ctx shared by legs that need to clear every threshold (cadence).
function cadenceCtx(overrides) {
  return Object.assign({
    roomDir: '',
    reachesSinceLastProposal: goalCadence.STRATEGY_CADENCE_REACHES,
    claimsSinceLastProposal: 3,
    promotionsSinceLastProposal: 1,
    artifactsSinceLastProposal: 0,
    unresolvedContradictions: 0,
  }, overrides || {});
}

function stallCtx(overrides) {
  return Object.assign({
    roomDir: '',
    reachesSinceLastProposal: STALL_REACHES,
    claimsSinceLastProposal: 0,
    promotionsSinceLastProposal: 0,
    artifactsSinceLastProposal: 0,
    unresolvedContradictions: 0,
  }, overrides || {});
}

try {
  // ---------------------------------------------------------------------
  // Leg: refuses with no roomDir
  // ---------------------------------------------------------------------
  console.log('--- refuses with no roomDir ---');
  ok('refuses with no roomDir', sensorStrategyReach({}, {}, {}) === null);
  ok('refuses with no roomDir (empty string)', sensorStrategyReach({}, {}, { roomDir: '' }) === null);

  // ---------------------------------------------------------------------
  // Leg: refuses with no state file
  // ---------------------------------------------------------------------
  console.log('--- refuses with no state file ---');
  {
    const roomDir = freshRoomDir(); // never touched by jtbdState -> no jtbd-state.json
    const r = sensorStrategyReach({}, {}, cadenceCtx({ roomDir: roomDir }));
    ok('refuses with no state file', r === null);
  }
  {
    // Deliberately corrupt fixture: readState swallows the JSON.parse
    // failure and returns null, so the sensor must behave identically to
    // "no state file" -- return null, never throw.
    const roomDir = freshRoomDir();
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(roomDir, '.mindrian', 'jtbd-state.json'), '{not json', 'utf8');
    let threw = false;
    let r = 'unset';
    try {
      r = sensorStrategyReach({}, {}, cadenceCtx({ roomDir: roomDir }));
    } catch (_e) {
      threw = true;
    }
    ok('refuses with no state file (corrupt json, never throws)', threw === false && r === null);
  }

  // ---------------------------------------------------------------------
  // Leg: refuses with no ratified goal
  // ---------------------------------------------------------------------
  console.log('--- refuses with no ratified goal ---');
  {
    const roomDir = freshRoomDir();
    // current.jtbd IS set, but setGoal is never called -> no top-level goal.
    jtbdState.setCurrent(roomDir, { jtbd: 'validate-idea', trigger: 'test' });
    const r = sensorStrategyReach({}, {}, cadenceCtx({ roomDir: roomDir }));
    ok('refuses with no ratified goal', r === null);
  }

  // ---------------------------------------------------------------------
  // Leg: refuses under cooldown
  // ---------------------------------------------------------------------
  console.log('--- refuses under cooldown ---');
  {
    const roomDir = ratifiedGoalRoom();
    const r = sensorStrategyReach({}, {}, cadenceCtx({ roomDir: roomDir, strategyCooldownActive: true }));
    ok('refuses under cooldown', r === null);
  }

  // ---------------------------------------------------------------------
  // Leg: refuses below thresholds
  // ---------------------------------------------------------------------
  console.log('--- refuses below thresholds ---');
  {
    const roomDir = ratifiedGoalRoom();
    const r = sensorStrategyReach({}, {}, cadenceCtx({
      roomDir: roomDir,
      reachesSinceLastProposal: goalCadence.STRATEGY_MIN_INTERVAL_REACHES - 1,
    }));
    ok('refuses below thresholds', r === null);
  }

  // ---------------------------------------------------------------------
  // Leg: refuses when artifacts filed
  // ---------------------------------------------------------------------
  console.log('--- refuses when artifacts filed ---');
  {
    const roomDir = ratifiedGoalRoom();
    const r = sensorStrategyReach({}, {}, stallCtx({ roomDir: roomDir, artifactsSinceLastProposal: 2 }));
    ok('refuses when artifacts filed', r === null);
  }

  // ---------------------------------------------------------------------
  // Leg: fires on cadence
  // ---------------------------------------------------------------------
  console.log('--- fires on cadence ---');
  {
    const roomDir = ratifiedGoalRoom();
    const r = sensorStrategyReach({}, { problem_type: 'IllDefined' }, cadenceCtx({ roomDir: roomDir }));
    ok('fires on cadence: non-null', r !== null);
    ok('fires on cadence: reach_id contradiction', r && r.reach_id === 'contradiction');
    ok('fires on cadence: posture pull_back', r && r.posture === 'pull_back');
    ok('fires on cadence: signal goal_cadence_due', r && r.signal === 'goal_cadence_due');
  }

  // ---------------------------------------------------------------------
  // Leg: fires on stall
  // ---------------------------------------------------------------------
  console.log('--- fires on stall ---');
  {
    const roomDir = ratifiedGoalRoom();
    const r = sensorStrategyReach({}, {}, stallCtx({ roomDir: roomDir }));
    ok('fires on stall: non-null', r !== null);
    ok('fires on stall: reach_id contradiction', r && r.reach_id === 'contradiction');
    ok('fires on stall: posture pull_back', r && r.posture === 'pull_back');
    ok('fires on stall: signal goal_stall', r && r.signal === 'goal_stall');
  }

  // ---------------------------------------------------------------------
  // Leg: is synchronous
  // ---------------------------------------------------------------------
  console.log('--- is synchronous ---');
  ok('is synchronous: not an async function', sensorStrategyReach.constructor.name !== 'AsyncFunction');
  {
    const roomDir = ratifiedGoalRoom();
    const r = sensorStrategyReach({}, {}, cadenceCtx({ roomDir: roomDir }));
    ok('is synchronous: fired result is not a thenable', !(r && typeof r.then === 'function'));
  }

  // ---------------------------------------------------------------------
  // Leg: carries no sensor_id
  // ---------------------------------------------------------------------
  console.log('--- carries no sensor_id ---');
  {
    const roomDir = ratifiedGoalRoom();
    const r = sensorStrategyReach({}, {}, cadenceCtx({ roomDir: roomDir }));
    ok('carries no sensor_id', r !== null && !Object.prototype.hasOwnProperty.call(r.evidence, 'sensor_id'));
  }
} finally {
  if (PRIOR_ROOMS_HOME === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
  else process.env.MINDRIAN_ROOMS_HOME = PRIOR_ROOMS_HOME;
  try {
    fs.rmSync(SCRATCH_ROOT, { recursive: true, force: true });
  } catch (_e) {
    // best-effort cleanup only
  }
}

console.log('');
console.log('Checks: ' + checks + '  Failed: ' + failed + '  Skipped: 0');
process.exit(failed === 0 ? 0 : 1);
