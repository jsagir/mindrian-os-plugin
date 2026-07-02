'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-09 (scope item 9) -- the JUDGE SPECS for the Plurai eval SUITE.
 * "larryreacts needs a plurai": the behavior harness is not ONE evaluator, it is
 * a SUITE of Plurai (IntellAgent, arXiv 2501.11067) LLM-as-a-judge classifiers,
 * ONE judge per reach/behavior. This file declares each judge spec: the
 * reach/behavior it evaluates, its label ladder, and its seeded Plurai thread id.
 *
 * LAB-SIDE ONLY. Lives under lab/, never under lib/, never shipped to the user
 * machine (respects the no-Python-on-user rule). Part 8: synthetic personas +
 * generic doctrine only, no user data.
 *
 * CORRECTED LABEL SCHEMA (navigator-approved 2026-07-01, DEVIATION 2):
 *   The horizontal-elevation judge was seeded with labels
 *   [No Connection / Hedged / Confident]. That is WRONG. Test 6's own doctrine
 *   states verbatim: "Always careful, cautious, hedged, backed by evidence,
 *   NEVER confident... Larry offers; the person judges. Being presumptuous is
 *   not [fine]." So "Confident" is NOT the ideal -- it is a SECOND failure mode.
 *   The corrected ladder is [No Connection / Hedged / Presumptuous]:
 *     - No Connection : missed the cross-frame link entirely (the 5 real misses)
 *     - Hedged        : made the connection, offered tentatively, evidence-backed
 *                       (THE TARGET; the 2 real should-have-said lines)
 *     - Presumptuous  : made the connection but overclaimed / asserted it as fact
 *                       (negative; the miss-#2 "punchline" quip is its exemplar)
 *   This matches FUSION's (205-07) "offer, never assert" invariant.
 *   The live re-seed of the three seeded judge threads to these corrected labels
 *   is a DELIBERATE navigator follow-up, NOT part of this build (see re_seed).
 *
 * House rule: hyphens only, no em-dashes. CJS. Read-only, LOCAL (Part 8).
 */

// The six FROZEN reach_ids (lib/core/methodology-ingest.cjs / sensor-types.cjs).
// The reach+gate judge classifies over these six plus the "none" sentinel.
const FROZEN_REACH_IDS = Object.freeze([
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
  'hats',
]);

/*
 * Each judge spec is a plain, inspectable record:
 *   id           slug for the reach/behavior this judge evaluates
 *   behavior     the reach or behavior under test
 *   thread_id    the seeded Plurai eval thread (parked at the samples/Optimize gate)
 *   labels       the classification ladder the judge emits
 *   primary      true for Lawrence's PRIMARY target (horizontal elevation)
 *   corrected    documents the label correction (DEVIATION 2), if any
 *   re_seed      the live-re-seed follow-up required to align the thread with `labels`
 *   scope        (reach+gate judge only) the classification domain
 */
const JUDGES = Object.freeze([
  Object.freeze({
    id: 'horizontal-elevation',
    behavior: 'cross-frame horizontal elevation (connect the navigator OWN separate ideas)',
    thread_id: '392ec50f-282d-4956-adc6-1f03130e3bd8',
    labels: Object.freeze(['No Connection', 'Hedged', 'Presumptuous']),
    primary: true,
    corrected: Object.freeze({
      was: ['No Connection', 'Hedged', 'Confident'],
      now: ['No Connection', 'Hedged', 'Presumptuous'],
      why: 'Test 6 doctrine: hedged is the target; "Confident" is a second failure '
        + 'mode, not the ideal. Renamed to "Presumptuous" (overclaimed / asserted '
        + 'as fact). Matches FUSION 205-07 "offer, never assert".',
    }),
    re_seed: Object.freeze({
      required: true,
      reason: 'the live seeded thread still carries the old [.../Confident] labels; '
        + 'navigator must re-seed thread 392ec50f to [.../Presumptuous].',
    }),
  }),
  Object.freeze({
    id: 'anti-circular',
    behavior: 'within-frame anti-circular gear-shift (Mordi/Eli circling failure)',
    thread_id: '127f8f53-2e72-48d8-a771-4ae9d51e5a00',
    labels: Object.freeze(['circular', 'progressing']),
    primary: false,
    corrected: null,
    re_seed: Object.freeze({
      required: false,
      reason: 'labels unchanged; thread parked at the Optimize model choice.',
    }),
  }),
  Object.freeze({
    id: 'reach-gate',
    behavior: 'reach + gate correctness (which of the six frozen reaches fired, '
      + 'and the Shape-F 188 gate it rendered through)',
    thread_id: 'f989b4cf-9ef2-48ca-bb02-9dcd9dba3cc8',
    labels: Object.freeze(['Correct', 'Wrong', 'Missed', 'Ambiguous']),
    primary: false,
    scope: Object.freeze({
      reach_ids: Object.freeze([...FROZEN_REACH_IDS, 'none']),
      gate: 'shape-f-188',
    }),
    supersedes: '2e1b0bba',
    corrected: null,
    re_seed: Object.freeze({
      required: false,
      reason: 'labels unchanged; supersedes the earlier 3-label reach judge thread 2e1b0bba.',
    }),
  }),
]);

// Index by id for the manifest and tests.
const JUDGE_BY_ID = Object.freeze(
  JUDGES.reduce((acc, j) => {
    acc[j.id] = j;
    return acc;
  }, Object.create(null))
);

module.exports = Object.freeze({
  FROZEN_REACH_IDS,
  JUDGES,
  JUDGE_BY_ID,
});
