'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-09 (scope item 9) -- the SUITE MANIFEST for the Plurai eval suite.
 * Declares the SUITE: one judge per reach/behavior, seeded with the three
 * existing Plurai eval threads (judges.cjs). Wires them for the evals MCP plugin
 * (tools: start_evaluator, send_message, upload_data, get_results,
 * search_evaluators) WITHOUT firing any live mutation here.
 *
 * INDEPENDENT-JUDGE RULE (no circularity). The judge must NOT be the Brain that
 * DROVE the move. We record the driving_brain_id and assert every judge_id
 * (its seeded thread id) differs from it. A fixture proves the guard throws when
 * a judge would grade its own driver.
 *
 * LAB-SIDE ONLY. Under lab/, never lib/, never shipped to the user machine
 * (no-Python-on-user rule). Part 8: synthetic personas + generic doctrine only,
 * NO user data. The personas below are invented; the doctrine is generic Test-6
 * elevation theory, not any real room or person.
 *
 * NO LIVE MUTATION here: this manifest DECLARES the suite. The actual live
 * re-seed of the three seeded judge threads to the corrected labels
 * (DEVIATION 2: horizontal-elevation -> [.../Presumptuous]) is a DELIBERATE
 * navigator follow-up, surfaced via reSeedRequirements().
 *
 * House rule: hyphens only, no em-dashes. CJS. Read-only, LOCAL (Part 8).
 */

const { JUDGES, JUDGE_BY_ID, FROZEN_REACH_IDS } = require('./judges.cjs');

/*
 * The Brain that DRIVES Larry's move (brain_ask / DirectiveEnvelope, Phase 191).
 * The judges must be INDEPENDENT of it. This is a synthetic identity for the
 * lab suite; the real driving Brain is the remote MCP at mindrian-brain. What
 * matters is the STRUCTURAL guard: no judge thread id may equal the driver.
 */
const DRIVING_BRAIN_ID = 'mindrian-brain@onrender.mcp';

/*
 * Part 8 synthetic personas. Invented figures only -- never a real room, never a
 * real tester. Generic elevation doctrine, no user data. These are the personas
 * the Bruce harness (synthetic coverage seam, golden-loader.cjs) may expand.
 */
const SYNTHETIC_PERSONAS = Object.freeze([
  Object.freeze({
    id: 'synthetic-professor',
    role_level: 'professor',
    blurb: 'Invented strategy professor persona; peer/collaborator mode. '
      + 'Generic stand-in for the horizontal-elevation reach (multi-frame research).',
  }),
  Object.freeze({
    id: 'synthetic-practitioner',
    role_level: 'practitioner',
    blurb: 'Invented practitioner persona; mixed vertical/horizontal. '
      + 'Generic stand-in for the anti-circular within-frame gear-shift.',
  }),
  Object.freeze({
    id: 'synthetic-student',
    role_level: 'student',
    blurb: 'Invented student persona; vertical-heavy. Generic stand-in for the '
      + 'reach+gate correctness judge over the six frozen reaches.',
  }),
]);

/*
 * Assert one judge is independent of the driving Brain. Throws on circularity.
 * judge_id === driving_brain_id would mean the Brain grades its own move.
 */
function assertIndependentJudge(judge, drivingBrainId) {
  const judgeId = judge && judge.thread_id;
  if (!judgeId) {
    throw new Error(`independent-judge guard: judge "${judge && judge.id}" has no thread_id`);
  }
  if (judgeId === drivingBrainId) {
    throw new Error(
      `independent-judge guard VIOLATED: judge "${judge.id}" thread_id (${judgeId}) `
      + `=== driving_brain_id (${drivingBrainId}). The judge cannot grade its own driver `
      + '(no circularity).'
    );
  }
  return true;
}

/*
 * Build the suite. Asserts the independent-judge rule for every judge before
 * returning. Carries synthetic personas + generic doctrine only (Part 8).
 * No live evals-MCP call is made; this only DECLARES the wiring.
 */
function buildSuite(opts = {}) {
  const drivingBrainId = opts.drivingBrainId || DRIVING_BRAIN_ID;

  // Independent-judge rule holds for EVERY judge, or the build fails closed.
  for (const judge of JUDGES) {
    assertIndependentJudge(judge, drivingBrainId);
  }

  return Object.freeze({
    suite: 'larryreacts-plurai-suite',
    lab_side: true,
    shipped_to_user_machine: false,
    part8: Object.freeze({
      user_data: false,
      synthetic_personas: true,
      generic_doctrine_only: true,
    }),
    driving_brain_id: drivingBrainId,
    // one judge per reach/behavior
    judges: JUDGES,
    judge_ids: Object.freeze(JUDGES.map((j) => j.thread_id)),
    frozen_reach_ids: FROZEN_REACH_IDS,
    personas: SYNTHETIC_PERSONAS,
    // the evals MCP plugin tool surface this suite targets (declared, NOT fired)
    evals_mcp: Object.freeze({
      plugin: 'evals',
      tools: Object.freeze([
        'start_evaluator',
        'send_message',
        'upload_data',
        'get_results',
        'search_evaluators',
      ]),
      live_mutation_fired: false,
    }),
  });
}

/*
 * Surface the deliberate live-re-seed follow-up (navigator task, NOT this build).
 * Declares which seeded threads must be re-seeded to the corrected label ladder.
 */
function reSeedRequirements() {
  return JUDGES
    .filter((j) => j.re_seed && j.re_seed.required)
    .map((j) => Object.freeze({
      judge_id: j.id,
      thread_id: j.thread_id,
      labels: j.labels,
      reason: j.re_seed.reason,
    }));
}

module.exports = Object.freeze({
  DRIVING_BRAIN_ID,
  SYNTHETIC_PERSONAS,
  JUDGE_BY_ID,
  assertIndependentJudge,
  buildSuite,
  reSeedRequirements,
});
