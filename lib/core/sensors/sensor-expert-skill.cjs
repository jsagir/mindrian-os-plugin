'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 203-03 Task 1 -- SENS-11 expert-skill detector: Larry PROACTIVELY suggests
 * materializing a reusable SyntheticExpert as a project skill (SEED-035 sub-claim 2).
 *
 * This module carries THREE roles at three different layers, kept separate on purpose:
 *
 *   1. sensorExpertSkill(turn, tuple, ctx) -> reach|null  -- the PURE registered
 *      sensor. It mirrors sensor-recency.cjs:114 / sensor-external-fact.cjs:117
 *      EXACTLY: a sync fn that reads ONLY LOCAL ctx enum/scalars, makes NO db read
 *      and NO Brain call, and returns a SINGLE makeReach({ reach_id:'context_block',
 *      ... }) object or null. It promotes nothing and emits nothing. It is the piece
 *      registered into SENSOR_REGISTRY so dispatchSensors actually fires it.
 *
 *   2. detectExpertSkillCandidates(db, opts)  -- the ctx-assembly PRODUCER helper.
 *      THIS is where the db read lives. It runs at ctx-assembly time (inside the
 *      navigation-engine sensorCtx block, mirroring the MED-01 cortex producer at
 *      navigation-engine.cjs:847-865), reads CONFIRMED-only SyntheticExpert nodes
 *      via the shipped confirmed filter (rankExpertsForSlot's confirmed read), and
 *      returns closed scalars + a LOCAL candidate list. The sensor NEVER touches it.
 *
 *   3. resolveExpertSkillDecision(db, nodeId, decision, opts)  -- the gate action.
 *      APPROVE promotes the expert node through the SINGLE door, the POSITIONAL
 *      confirmNode(db, nodeId, byUser, reason) where byUser is a STRING id from
 *      resolveByUser(roomDir), then returns a materialize intent naming Plan 02's
 *      /mos:skill --from-expert <nodeId>. REJECT/DEFER become typed graph edges
 *      through the navigation chokepoint (writeEdge REJECTED / DEFERRED); a REJECT
 *      with no reason is refused (rejection is data, Decision 13). The sensor never
 *      calls this; only the navigator's Shape-F gate does.
 *
 * FROZEN REACH (Phase 148 lockstep): this sensor mints NO new reach_id. It rides the
 *   existing 'context_block' reach (the LOCAL in-process context surface). The
 *   'save as skill' identity is a sub_mode/offer LABEL on the evidence, never a 7th
 *   reach_id. The module fails closed at load if context_block ever drifts off the
 *   frozen REACH_IDS bank.
 *
 * Canon Part 8: the reach evidence carries CLOSED scalars only (candidate count,
 *   invocation max, tier-signal boolean) -- never a node id, name, or prose. The WHICH
 *   (the specific expert) is resolved LOCALLY at the gate from the producer's candidate
 *   list, never ridden on the reach.
 *
 * Canon Part 9 role 5: only a human promotes. The sensor promotes nothing; the gate
 *   APPROVE promotes only through the positional confirmNode with a string byUser.
 *
 * Pure / sync / LOCAL-first for the sensor. node built-ins + project libs only.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach, REACH_IDS } = require('./sensor-types.cjs');

// SENS-11: the new sensor id (SENS-01/06 live in insight-sensors; 02-05/07-10 live
// in sibling sensor files; 11 is the next free id).
const SENSOR_ID = 'SENS-11';

// FROZEN: the sensor rides the existing context_block reach (the LOCAL in-process
// context surface). Fail closed at load if it ever drifts off the frozen bank.
const REACH_ID = 'context_block';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-expert-skill: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}

// The default reusable-invocation threshold N (SEED-035: a confirmed expert reused
// at least N times is a reuse signal). Overridable via the producer opts.
const DEFAULT_THRESHOLD = 3;

// The evidence tiers that mark a confirmed expert reusable on their own, even at
// invocation 0 (a rigorously-grounded expert is worth offering to save as a skill).
const REUSABLE_TIERS = Object.freeze(['Academic', 'Operational']);

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * SENS-11 -- the PURE registered sensor. Fires the context_block reach when the
 * ctx carries the reusable-expert signal (ctx.reusableExpertCandidate === true),
 * surfaced by the ctx-assembly producer. Reads ONLY LOCAL ctx scalars; makes NO db
 * read and NO Brain call; promotes nothing. Soft-fails to null on malformed ctx;
 * never throws.
 *
 * @param {object} _turn  -- the turn signal bag (unused; the signal is state-driven)
 * @param {object} _tuple -- the /mos:diagnose tuple (unused for detection)
 * @param {object} ctx    -- LOCAL context carrying the reusable-expert scalars
 * @returns {Readonly<object>|null}
 */
function sensorExpertSkill(_turn, _tuple, ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  if (ctx.reusableExpertCandidate !== true) return null; // no confirmed reusable signal

  const invocationMax = (isFiniteNumber(ctx.reusableExpertInvocationMax) && ctx.reusableExpertInvocationMax > 0)
    ? ctx.reusableExpertInvocationMax
    : 0;
  const tierSignal = ctx.reusableExpertTierSignal === true;
  const candidateCount = (isFiniteNumber(ctx.reusableExpertCandidateCount) && ctx.reusableExpertCandidateCount > 0)
    ? ctx.reusableExpertCandidateCount
    : 0;

  return makeReach({
    // FROZEN: rides the existing context_block reach. Mints NO new reach_id.
    reach_id: REACH_ID,
    // push_forward: a reusable expert is forward momentum -- bring the save-as-skill
    // offer forward to the Decision Gate, then push through on the navigator's call.
    posture: 'push_forward',
    // Dispatch names the SHIPPED Plan-02 materializer surface. A handle, not a call.
    dispatch: 'expert-skill materialization offer (mos:skill --from-expert)',
    companions: [],
    signal: 'expert_skill',
    // LOCAL closed scalars only. sub_mode is the 'save as skill' offer LABEL (not a
    // reach_id). The WHICH (the specific expert) is resolved LOCALLY at the gate.
    evidence: {
      candidate_count: candidateCount,
      invocation_max: invocationMax,
      tier_signal: tierSignal,
      sub_mode: 'save_expert_as_skill',
    },
  });
}

module.exports = {
  sensorExpertSkill: sensorExpertSkill,
  SENSOR_ID: SENSOR_ID,
  REACH_ID: REACH_ID,
  DEFAULT_THRESHOLD: DEFAULT_THRESHOLD,
  REUSABLE_TIERS: REUSABLE_TIERS,
};
