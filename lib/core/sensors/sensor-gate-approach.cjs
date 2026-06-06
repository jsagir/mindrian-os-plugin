'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143-02 Task 3 -- SENS-07 gate-approach detector.
 *
 * A net-new STATE-PATTERN detector over the SHIPPED Phase 120 breakthrough
 * scanner (lib/core/breakthrough/scanner.cjs::scanForBreakthroughs +
 * surfaceBreakthrough; scripts/check-pending-breakthrough.cjs) and the
 * agents/investor.md objection surface. When the venture nears a gate /
 * milestone -- a commit-near stage (Well-Defined Problem / Ready to Build),
 * or a STATE.md venture_stage advance toward a commit decision -- this sensor
 * SURFACES the candidate reach that dispatches the breakthrough scan (Category G)
 * + the investor-objection surface.
 *
 * REUSE BEFORE BUILD (Canon Part 7): the breakthrough scan + investor agent are
 * SHIPPED. This sensor does NOT re-run the scanner inline and does NOT
 * re-implement breakthrough scoring. It surfaces the DISPATCH HANDLE only; the
 * navigator approves at the Decision Gate (Canon Part 3) before the scan runs.
 * (T-143-06: the sensor SURFACES a candidate; the navigator approves.)
 *
 * Reach: context_block (LOCAL) -- the breakthrough scan reads the room's OWN
 * artifact corpus and the investor objection surface argues from LOCAL state.
 * Neither is a Brain or web call, so the reach is context_block. Posture
 * 'push_forward': a gate approaching is a forward-momentum moment -- surface the
 * pre-commit breakthrough check + the investor stress-test, then push through.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide(). The routing fence over
 * lib/core/sensors/ asserts this.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');

/**
 * Commit-near stages: the gate/milestone stages where a breakthrough scan +
 * investor stress-test is warranted before committing (funding, hiring, build,
 * public launch). Compared case-insensitively and whitespace-normalized so
 * "well-defined problem" and "Well-Defined Problem" both match.
 */
const COMMIT_NEAR_STAGES = [
  'well-defined problem',
  'ready to build',
  'ready-to-build',
  'investment',
  'commit',
  'pre-commit',
];

/** Normalize a stage label for matching: lowercase + collapse whitespace. */
function normStage(s) {
  if (typeof s !== 'string') return '';
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** True if the normalized stage is a commit-near gate stage. */
function isCommitNear(stageLabel) {
  const n = normStage(stageLabel);
  if (!n) return false;
  return COMMIT_NEAR_STAGES.indexOf(n) !== -1;
}

/**
 * SENS-07 -- gate/milestone approach -> the breakthrough scan + investor reach.
 *
 * The gate signal comes from tuple.stage (the /mos:diagnose classification) OR
 * the LOCAL ctx.venture_stage (the STATE.md venture_stage advance). Either being
 * commit-near fires the reach.
 *
 * @param {object} _turn -- the turn signal bag (unused; the gate is state-driven)
 * @param {object} tuple -- the /mos:diagnose tuple { ..., stage }
 * @param {object} ctx   -- LOCAL context (optional ctx.venture_stage from STATE.md)
 * @returns {Readonly<object>|null}
 */
function sensorGateApproach(_turn, tuple, ctx) {
  const tupleStage = (tuple && typeof tuple === 'object') ? tuple.stage : '';
  const ventureStage = (ctx && typeof ctx === 'object') ? ctx.venture_stage : '';

  const gateApproaching = isCommitNear(tupleStage) || isCommitNear(ventureStage);
  if (!gateApproaching) return null;

  // Which stage label tripped the gate (a generic enum, not user content).
  const stageEnum = isCommitNear(tupleStage) ? normStage(tupleStage) : normStage(ventureStage);

  return makeReach({
    reach_id: 'context_block',
    posture: 'push_forward',
    // Dispatch names the SHIPPED Phase 120 breakthrough scan (Category G) + the
    // agents/investor objection surface. Handles, not calls -- the navigator
    // approves at the Decision Gate before scanForBreakthroughs runs.
    dispatch: 'breakthrough-scan (Category G) + agents/investor objection',
    companions: ['scanForBreakthroughs', 'agents/investor'],
    signal: 'gate_approach',
    // LOCAL scalars only: the commit-near stage enum. No artifact bytes.
    evidence: { stage: stageEnum, category: 'G', surfaces: 2 },
  });
}

module.exports = {
  sensorGateApproach: sensorGateApproach,
};
