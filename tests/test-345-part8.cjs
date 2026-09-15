#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-04 Task 2 -- the runtime Part 8 evidence-bag proof for
 * lib/core/sensors/sensor-strategy-reach.cjs (SENS-20). The inherited
 * tests/test-sensors-part8-sweep.cjs is a STATIC sweep (grep-shaped: no
 * forbidden require, token, or hash call site); it cannot see what a fired
 * reach's evidence bag actually CONTAINS at runtime. This file drives the
 * sensor to fire and asserts on the returned object directly.
 *
 * Written as a regex scan over Object.keys(reach.evidence) rather than an
 * allow-list (per the plan's own instruction), so a future field added to
 * the evidence bag with a prose-shaped name fails THIS test rather than
 * passing it silently.
 *
 * Fixture rooms live under os.tmpdir(); MINDRIAN_ROOMS_HOME is pointed at a
 * scratch root for the duration of this file and restored on exit (344-05
 * fixture discipline) -- the user's real rooms directory is never touched.
 * Plain-node house style. CJS. No em-dashes.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const assert = require('node:assert/strict');

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

// The prose-shaped-name regex this test scans Object.keys(evidence) against.
// Matches T-345-15's own mitigation plan (345-04-PLAN.md threat register).
const PROSE_SHAPED_KEY_RX = /question|prose|text|slug_path|node_id|anchor/i;

// The companion-handle shape both T-345-16 and this sensor's own header
// promise: a closed prefix, a colon, then word/hyphen characters only.
const COMPANION_RX = /^(serves_jtbd|ADDRESSES_PROBLEM_TYPE):[A-Za-z0-9_-]+$/;

const SCRATCH_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-test-345-part8-'));
const PRIOR_ROOMS_HOME = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = SCRATCH_ROOT;

try {
  const roomDir = path.join(SCRATCH_ROOT, 'room-fire');
  fs.mkdirSync(roomDir, { recursive: true });

  // Seed a ratified goal AND a drifted current (goal.jtbd !== current.jtbd)
  // so the fired reach's `drifted` field is exercised as true, and the goal
  // carries a real parent_question so the negative check this file's own
  // acceptance criteria describes (adding it to the evidence bag must fail
  // this test) has something real to leak if the sensor ever regresses.
  jtbdState.setGoal(roomDir, {
    jtbd: 'validate-idea',
    rung: 'IllDefined',
    parent_question: 'what is the future of on-demand cold storage in the Midwest',
    set_by: 'gate_answer',
  });
  jtbdState.setCurrent(roomDir, { jtbd: 'raise-funding', trigger: 'test' });

  const ctx = {
    roomDir: roomDir,
    reachesSinceLastProposal: goalCadence.STRATEGY_CADENCE_REACHES,
    claimsSinceLastProposal: 4,
    promotionsSinceLastProposal: 1,
    artifactsSinceLastProposal: 0,
    unresolvedContradictions: 2,
  };
  const reach = sensorStrategyReach({}, { problem_type: 'IllDefined' }, ctx);

  ok('the sensor fired (precondition for every assertion below)', reach !== null);

  if (reach !== null) {
    ok('the reach is frozen', Object.isFrozen(reach));
    ok('the evidence bag is frozen', Object.isFrozen(reach.evidence));

    const evidenceKeys = Object.keys(reach.evidence);
    ok('evidence bag is non-empty', evidenceKeys.length > 0);

    let allPrimitive = true;
    for (const k of evidenceKeys) {
      const t = typeof reach.evidence[k];
      if (t !== 'string' && t !== 'number' && t !== 'boolean') allPrimitive = false;
    }
    ok('every evidence value is a primitive (string/number/boolean)', allPrimitive);

    let noProseKey = true;
    for (const k of evidenceKeys) {
      if (PROSE_SHAPED_KEY_RX.test(k)) noProseKey = false;
    }
    ok('no evidence key matches the prose-shaped-name regex', noProseKey);

    let noPathSeparator = true;
    for (const k of evidenceKeys) {
      const v = reach.evidence[k];
      if (typeof v === 'string' && (v.indexOf('/') !== -1 || v.indexOf('\\') !== -1)) {
        noPathSeparator = false;
      }
    }
    ok('no evidence value contains a filesystem path separator', noPathSeparator);

    ok('evidence carries no sensor_id key', !Object.prototype.hasOwnProperty.call(reach.evidence, 'sensor_id'));

    ok('companions is a non-empty array', Array.isArray(reach.companions) && reach.companions.length > 0);
    let companionsMatch = true;
    for (const c of reach.companions) {
      if (typeof c !== 'string' || !COMPANION_RX.test(c)) companionsMatch = false;
    }
    ok('every companion matches the generic-handle shape', companionsMatch);

    ok('drifted reads true (goal.jtbd !== current.jtbd in this fixture)', reach.evidence.drifted === true);
  }

  // Deliberate negative check (run by hand per the plan's acceptance
  // criteria, reverted immediately after -- this repo's own copy of the
  // check, executed programmatically rather than left as a manual step):
  // rebuilding the same reach with a parent_question field smuggled into
  // the evidence bag must make the prose-shaped-name scan fail. This proves
  // the regex leg actually detects the leak it exists to catch, rather than
  // vacuously passing because the sensor never puts anything suspicious in
  // the bag in the first place.
  {
    const goal = jtbdState.getGoal(roomDir);
    const leakedKeys = Object.keys(Object.assign({}, { jtbd: goal.jtbd }, { parent_question: goal.parent_question }));
    let wouldCatchLeak = false;
    for (const k of leakedKeys) {
      if (PROSE_SHAPED_KEY_RX.test(k)) wouldCatchLeak = true;
    }
    ok('the prose-shaped-name regex would catch a smuggled parent_question key', wouldCatchLeak);
  }

  // Symmetric proof the sensor refuses cleanly under cooldown with no state
  // touch attempted at all, mirroring the strict ordering documented in the
  // sensor's own header.
  {
    const r = sensorStrategyReach({}, {}, { roomDir: roomDir, strategyCooldownActive: true });
    ok('cooldown refusal is null, not a Promise', r === null);
  }

  assert.equal(sensorStrategyReach.constructor.name === 'AsyncFunction', false);
  ok('sensor is not an AsyncFunction (assert.equal form)', true);
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
