'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-04 Task 1 -- SENS-20 sensorStrategyReach: the graph-layer
 * strategy node, pure/sync/zero-I/O, that re-aims a room's ratified goal
 * rather than executing inside it.
 * layer: graph
 *
 * SENS-20, NOT THE ID THIS PHASE'S OWN EARLIER TEXT NAMES. This file was
 * authored against a different id in 345-RESEARCH.md, 345-ICM-CONSULT.md,
 * and this phase's own plan text (345-04-PLAN.md), before, or in parallel
 * with, Phase 343 landing that same id on this tree for a different sensor
 * (sensorGraphIntegrity, lib/core/sensors/sensor-graph-integrity.cjs). Per
 * docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md Section 6, the
 * strategy-reach sensor is corrected to SENS-20, the next free id, in every
 * doc string, constant, comment and test this phase writes from this plan
 * forward. This file registers nowhere (see below), so it never stamps an
 * identity of its own; the corrected id is named here purely for the
 * reader, and the central-registry stamp (whichever plan wires it) is the
 * only place that id is ever written onto a fired reach.
 *
 * WHY THIS IS THE GRAPH LAYER, NOT THE LOOP LAYER (langtalks 4645:4703,
 * 4810:4853, per 345-LANGTALKS-CONSULT). A loop cannot question its own
 * goal; the strategy node is a slower watcher, running on its own cadence,
 * that analyzes outcome rates and rewrites the goals of the downstream
 * execution loops. This detector is the sensor half of that watcher: it
 * decides WHETHER to propose a re-aim, never WHAT the new goal is (that is
 * a later plan's climb) and never WHETHER to ratify one (that is a later
 * plan's Decision Gate).
 *
 * THE STATE-STORE READ IS NOT THIS FILE'S JOB (Canon Part 8/9;
 * sensor-graph-integrity.cjs is the shape precedent this file follows). The
 * counts below arrive as flat ctx scalars -- ctx.reachesSinceLastProposal,
 * ctx.claimsSinceLastProposal, ctx.promotionsSinceLastProposal,
 * ctx.artifactsSinceLastProposal, ctx.unresolvedContradictions,
 * ctx.strategyCooldownActive -- assembled by a ctx producer this plan does
 * NOT add (that lands behind a later plan's own blocking checkpoint). This
 * file requires no chokepoint module, no decide()-engine module, no native
 * SQLite driver of any kind, and no Brain wire-call module.
 *
 * PURE AND SYNCHRONOUS BY CONTRACT, PERMANENTLY (the sensor-roadmap-type.cjs
 * :40-47 scar). A Promise satisfies `typeof === 'object'` but has
 * `reach_id === undefined`, so dispatchSensors drops it with no throw and no
 * log. Never mark any function in this file with the keyword that turns it
 * asynchronous, and never use the pause keyword that keyword enables.
 *
 * ONE OF THE SIX FROZEN REACH IDS (the reject of minting a seventh, per the
 * 343-ICM precedent this phase's own decisions record cites): this fires
 * `contradiction` at posture `pull_back`, never a new id. `makeReach`
 * (./sensor-types.cjs) returns null for anything outside the frozen bank.
 *
 * REGISTERED NOWHERE. This file is not required by lib/core/insight-sensors
 * .cjs, lib/core/sensors/sensor-priority.cjs, or the decide()-engine module.
 * That wiring is the material step and sits behind a later plan's own
 * blocking checkpoint (345-04-PLAN.md's own concurrent_phase_note). A
 * written-but-unregistered sensor changes nothing at runtime.
 *
 * ORDER OF EVALUATION IS LOAD-BEARING (mirrors goal-cadence.cjs's own
 * header note, and 345-03-SUMMARY.md deviation 1's floor-first ruling):
 * cool-down is checked FIRST, before any state-store read -- a watcher that
 * nags is worse than no watcher. Then the four flat scalars are read and
 * handed to goalCadence.shouldPropose, whose own STRATEGY_MIN_INTERVAL_
 * REACHES floor wins over every other count, INCLUDING a genuine stall
 * reading (STRATEGY_STALL_MIN_SAMPLE, 12, is smaller than
 * STRATEGY_MIN_INTERVAL_REACHES, 20, so a stall never fires before the
 * floor clears -- the same floor-first order goal-cadence.cjs itself
 * implements and 345-03-SUMMARY.md documents as a deliberate deviation from
 * a literal, self-contradicting plan-text example). Only once shouldPropose
 * says propose:true does this file touch jtbd-state.json at all.
 *
 * EVIDENCE BAG: scalars and closed enums only (Canon Part 8), enforced by
 * convention here rather than relying on makeReach's non-primitive drop
 * alone. One goal field is named and refused at the evidence-object comment
 * below (LOCAL venture prose, never a reach). Also forbidden and never read
 * here: the room slug, the anchor node id, and any candidate node id (a
 * LOCAL room-content handle that rides the sensor ctx for the gate handler
 * only, per the ICM consult's own framing).
 *
 * Requires exactly: ./sensor-types.cjs (makeReach), ../../hmi/jtbd-state.cjs
 * (getGoal, getCurrent), ../strategy/goal-cadence.cjs (shouldPropose plus
 * the three threshold constants). Nothing else.
 * Pure CJS, zero I/O, zero new deps. House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');
const jtbdState = require('../../hmi/jtbd-state.cjs');
const goalCadence = require('../strategy/goal-cadence.cjs');

// Read a numeric ctx field with a typeof guard, defaulting to 0. Absence is
// never treated as a signal of its own here -- shouldPropose's own floor
// already treats a low reaches_since reading as the honest low-count case.
function numOr0(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
}

// The problem-type enum off the diagnose tuple, mirroring
// sensor-jtbd-reweight.cjs::problemTypeEnum verbatim (Canon Part 7: the same
// generic-handle read, never re-derived). Never the tuple's free text.
function problemTypeEnum(tuple) {
  if (!tuple || typeof tuple !== 'object') return 'undefined';
  const pt = tuple.problem_type;
  return (typeof pt === 'string' && pt) ? pt : 'undefined';
}

/**
 * sensorStrategyReach(turn, tuple, ctx) -> candidate-reach|null.
 *
 * Refuses (returns null) with no roomDir, under cool-down, below every
 * threshold, with no state file, or with no ratified goal -- in that order,
 * cheapest and most certain check first (see module header). Never throws.
 *
 * @param {object} _turn -- unused; the signal is state-driven, not turn-text-driven
 * @param {object} tuple -- the /mos:diagnose tuple { problem_type }
 * @param {object} ctx   -- LOCAL context; see the module header for the exact scalar bag
 * @returns {Readonly<object>|null}
 */
function sensorStrategyReach(_turn, tuple, ctx) {
  const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string' && ctx.roomDir)
    ? ctx.roomDir : '';
  if (!roomDir) return null;

  // Cool-down first, before any state-store read (see header). A boolean
  // ctx flag threaded by the far-end producer, not a call into
  // strategy-throttle.cjs from here -- the throttle computation itself runs
  // in that same producer, alongside the four scalars below, never in this
  // pure detector.
  if (ctx.strategyCooldownActive === true) return null;

  const reachesSinceLastProposal = numOr0(ctx.reachesSinceLastProposal);
  const claimsSinceLastProposal = numOr0(ctx.claimsSinceLastProposal);
  const promotionsSinceLastProposal = numOr0(ctx.promotionsSinceLastProposal);
  const artifactsSinceLastProposal = numOr0(ctx.artifactsSinceLastProposal);
  const unresolvedContradictions = numOr0(ctx.unresolvedContradictions);

  // The threshold decision lives in goal-cadence.cjs; never inlined here.
  const decision = goalCadence.shouldPropose({
    reaches_since: reachesSinceLastProposal,
    claims_since: claimsSinceLastProposal,
    promotions_since: promotionsSinceLastProposal,
    artifacts_since: artifactsSinceLastProposal,
  });
  if (!decision || decision.propose !== true) return null;

  // Only now read state: cool-down and every threshold have already cleared.
  const goal = jtbdState.getGoal(roomDir);
  if (!goal || typeof goal !== 'object') return null;
  const current = jtbdState.getCurrent(roomDir);

  const currentJtbd = (current && typeof current.jtbd === 'string') ? current.jtbd : '';
  // The divergence between what the classifier believes THIS TURN
  // (current.jtbd) and what the navigator ratified at a gate (goal.jtbd) is
  // not a bug to be designed away -- it is itself the drift signal this
  // sensor exists to notice.
  const drifted = goal.jtbd !== currentJtbd;
  const problemType = problemTypeEnum(tuple);

  return makeReach({
    reach_id: 'contradiction',
    posture: 'pull_back',
    dispatch: 'strategy-reach (jtbd re-aim)',
    companions: [
      'serves_jtbd:' + goal.jtbd,
      'ADDRESSES_PROBLEM_TYPE:' + problemType,
    ],
    signal: decision.signal,
    // Scalars and closed enums ONLY. Never `goal.parent_question` (LOCAL
    // venture prose), the room slug, the anchor node id, or a candidate node
    // id -- makeReach would drop a non-primitive anyway, but this file
    // relies on the convention, not the accident.
    evidence: {
      jtbd: goal.jtbd,
      current_jtbd: currentJtbd,
      rung: goal.rung,
      goal_version: goal.goal_version,
      reaches_since: reachesSinceLastProposal,
      claims_since: claimsSinceLastProposal,
      promotions_since: promotionsSinceLastProposal,
      artifacts_since: artifactsSinceLastProposal,
      unresolved_contradictions: unresolvedContradictions,
      problem_type: problemType,
      drifted: drifted,
    },
  });
}

module.exports = {
  sensorStrategyReach: sensorStrategyReach,
};
