'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-01 Task 1 -- SENS_PRIORITY: the doctrine-authored sensor priority
 * table (D-20) plus its defensive rank lookup.
 *
 * WHY THIS FILE EXISTS
 *
 * 12 of the registered sensors can fire the SAME reach id, `context_block`
 * (D-19, count re-derived live; 12 of 18 when 245-01 authored this, 12 of 19
 * once 245-06 added SENS-17, which fires `hats` and so does not widen the
 * collision). When two of them fire on one turn,
 * `rankFiredCandidates` in lib/workflow/reach-hedge-ranker.cjs is structurally
 * blind to the collision: every scoring term it has (d4For,
 * canonicalRegistryRank, countPenalty) is keyed on `reach_id`, not on the
 * individual sensor, so the comparator falls all the way through to the stable
 * sort's `a.index - b.index`. That index is SENSOR_REGISTRY file order. In
 * other words: today "which sensor's payload wins a same-reach collision" is
 * decided by whoever edited the registry array last. That is not a doctrine,
 * it is an accident.
 *
 * This table is the doctrine that replaces the accident. It is the sort key,
 * not the sort: this file changes NO ranking behavior on its own. The
 * comparator branch that reads SENS_PRIORITY lands in plan 245-07.
 *
 * THE ORDERING RULES (the doctrine surface D-20 requires). A future author
 * adding a sensor must be able to place it without guessing, so the placement
 * procedure is written down here rather than living in someone's head:
 *
 *   1. Canon Part 11 R3 trigger-tier precedence comes first. A sensor keyed on
 *      navigator problem-state (the `signal` / `context` tiers of
 *      TRIGGER_TIERS in sensor-types.cjs) outranks a sensor keyed on lexical
 *      match (the `content` / `keyword` FALLBACK tiers, per isFallbackTier).
 *      This single rule is why SENS-16 (bm25 lexical content relevance, the
 *      only pure FALLBACK-tier member of the registry) is last in this table.
 *
 *   2. Within a tier, EVIDENCE DURABILITY decides. A confirmed graph fact or a
 *      projected-cortex fact (durable, already written and re-readable)
 *      outranks a transient marker file (a side-channel JSON that a later turn
 *      overwrites), which in turn outranks a derived reweight (a signal
 *      recomputed from other signals, so it carries no independent evidence).
 *
 *   3. Remaining ties fall to canonical SENSOR_REGISTRY order. This keeps the
 *      table a DOCUMENTED REFINEMENT of today's shipped behavior rather than
 *      an arbitrary reshuffle: where doctrine has nothing to say, the status
 *      quo is preserved on purpose.
 *
 * NON-NUMERIC IDS ARE REAL. Two entries below are not `SENS-<number>`:
 * `SENS-RECENCY` (lib/core/sensors/sensor-recency.cjs, Phase 160-03) and
 * `SENS-SHOW` (lib/core/sensors/sensor-show-share.cjs, Phase 173). Those are
 * the ids those sensors actually self-declare in the live tree. Do NOT
 * renumber them, and do NOT invent numeric aliases for them: the Task 3
 * completeness gate compares this table against the ids the registry really
 * uses, so a "tidied" alias would fail the build, correctly.
 *
 * WHAT IS DELIBERATELY ABSENT, and why it is not a gap:
 *   - lib/core/sensors/sensor-temporal-blindness.cjs is NOT a member of
 *     SENSOR_REGISTRY. It is an unregistered module; dispatchSensors never
 *     runs it, so it can never produce a colliding candidate to order.
 *   - lib/core/sensors/sensor-types.cjs is the shared struct contract (the id
 *     banks + makeReach), not a sensor.
 *   - lib/core/sensors/hat-scoping-table.cjs is a pure lookup table read by
 *     SENS-04, not a sensor.
 * The Task 3 fail-closed gate enumerates SENSOR_REGISTRY (via
 * SENSOR_REGISTRY_IDS), NOT the lib/core/sensors/ directory listing, precisely
 * so those three do not read as false gaps to a reader or to the build.
 *
 * SENS-17 LANDED IN PLAN 245-06 (this note is kept, updated, as the worked
 * example of the gate doing its job). 245-01 deliberately shipped this table
 * WITHOUT SENS-17. The moment 245-06 registered sensorPerspectiveLock in
 * SENSOR_REGISTRY + SENSOR_REGISTRY_IDS, both the build gate
 * (`node scripts/build-connector-registry.cjs --check`) and the test-time pin
 * (`node tests/test-245-priority-complete.cjs`) went RED, and stayed red until
 * the `'SENS-17'` entry below was added. A registered sensor with no priority
 * entry cannot ship. The table is now 19 entries against 19 registered sensors.
 *
 * Canon Part 8: this module is a frozen in-repo literal plus an array index
 * lookup. Zero I/O, zero network, zero user bytes. Pure and sync.
 * House rule: hyphens only, no em-dashes.
 */

// ---------- Phase 343 Plan 04 (CENSUS-08, WD-8): the counter-metric pairing
// contract each record below carries ----------
//
// THE PAIR. Every record carries `optimizes` (the quantity this sensor's
// firing pushes up) and `watched_by` (the counter quantity that would catch
// that optimization going wrong), plus a one-line `why`. Both fields are
// EXPLICIT: `null` is a declaration ("this sensor optimizes nothing
// measurable, and here is why"), an ABSENT key is a gap, and the fourth arm
// of the build gate in scripts/build-connector-registry.cjs (
// sensorPriorityCompletenessErrors) tells the two apart on purpose -- a
// sensor nobody has thought about and a sensor deliberately exempted must
// never read the same.
//
// THE PAIRING IS METADATA ABOUT A SENSOR, NEVER ABOUT A TURN. It must never
// ride a reach's `evidence` bag (Canon Part 8: this file is a frozen in-repo
// literal, derived from no turn text, room content, or user-suppliable
// value). The numbers behind a pair -- how many times a sensor actually fired,
// how many times its watched quantity actually moved -- are computed from
// room.db by the doctor organ (docs/COUNTER-METRIC-DOCTRINE.md), never by
// this file: this file only declares WHAT is paired, not the measured count.
//
// TWO WORKED EXAMPLES (set the register for every other record below):
//   SENS-06 artifact-filed: optimizes the count of artifacts filed; watched
//     by the count of filed artifacts that are later contradicted or never
//     cited; why: an assistant rewarded for filing will file more and worse.
//   SENS-16 content-relevance: optimizes lexical hit count against stored
//     material; watched by the share of offered reaches the navigator
//     declines; why: bm25 recall rises while usefulness falls and nothing in
//     the hit count can tell the difference.
//
// ---------- The priority table (frozen, index 0 = highest priority) ----------
//
// Group A -- confirmed room-state / projected-cortex facts. Highest durability
// under rule 2: each of these keys on something already written down and
// re-readable (a cortex projection, a graph pattern, a stored artifact), so its
// payload is the one a navigator can most defensibly be shown first.
//   SENS-08      memory-cortex        (cross-room projected-cortex contradiction)
//   SENS-17      perspective-lock     (>= 2 unresolved projected-cortex contradictions)
//     Placed immediately after SENS-08 on purpose. SENS-17 reads the SAME
//     cortex-derived contradiction count (ctx.freshContradictions) and
//     represents the STRONGER, more-unresolved state of that same signal, so
//     within Group A it outranks the single-contradiction bridge under rule 2
//     (evidence durability): both are projected-cortex facts, and the one
//     carrying more accumulated unresolved tension is the more defensible thing
//     to show a navigator first. Note that the two sensors emit DIFFERENT reach
//     ids (`hats` vs `cross_room`), so this relative rank only bites if a future
//     collision ever puts them on the same reach. It is recorded now so the
//     ordering is DELIBERATE rather than incidental, which is the whole point of
//     this table.
//   SENS-10      circularity          (a confirmed conversational-loop pattern)
//   SENS-11      expert-skill         (a reusable-expert pattern in room state)
//   SENS-19      graph-integrity      (a measured room-graph defect count, WD-7)
//     Placed in Group A, not appended at the end: a graph-integrity read is a
//     confirmed room-state fact (the ctx-assembly producer counts real rows in
//     the bound room's room.db, same durability class as SENS-11's confirmed
//     SyntheticExpert read), not a transient marker or a derived reweight.
//     Ranking a measured structural fact below bm25 lexical relevance (Group
//     D) would be a doctrine error, not a neutral default.
//   SENS-20      strategy-reach       (a measured cadence/stall count over
//     memory_event, WD-9)
//     Placed in Group A, immediately after SENS-19: a measured count of
//     reaches, claims, promotions and artifacts since the last strategy
//     proposal, read over the persisted memory_event log by the ctx-assembly
//     producer, is a confirmed room-state fact, not a derived intent. Ranking
//     it in Group D would rank a structural fact below bm25 lexical
//     relevance, which Canon Part 11 R3 forbids
//     (docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md WD-9).
//   SENS-14      opportunity-harvest  (a harvested opportunity already stored)
//   SENS-02      lagging-component    (a component-lag fact read off room state)
//   SENS-RECENCY recency              (the R6 recency read over stored material)
//
// Group B -- explicit turn signals and shipped side-channel markers. Still
// context-tier under rule 1 (they key on problem-state or on a real event that
// just happened), but their evidence is transient: a marker file the next turn
// overwrites, or a signal scoped to this turn only.
//   SENS-01      first-material       (the first-material turn signal)
//   SENS-06      artifact-filed       (the last-cascade.json marker)
//   SENS-13      eureka               (the eureka-bridge freshness marker)
//   SENS-15      url-ingest           (a bare URL present in this turn)
//   SENS-12      room-pick            (the mid-dialogue room-switch fork)
//   SENS-07      gate-approach        (a gate/milestone approach signal)
//   SENS-03      methodology-decision (a methodology decision on this turn)
//
// Group C -- derived / reweighted intent signals. Lowest durability under rule
// 2: each is recomputed from other signals rather than carrying independent
// evidence of its own, so it yields to anything above it.
//   SENS-05      jtbd-reweight        (a re-weight derived from a JTBD change)
//   SENS-04      external-fact        (a derived external-reference intent)
//   SENS-09      diffusion-adoption   (a derived dual-use diffusion read)
//   SENS-SHOW    show-share           (a derived show/present/share intent)
//   SENS-18      roadmap-type         (a derived 1-of-6 roadmap output-shape read)
//
// Group D -- the FALLBACK lexical tier. Last by rule 1, not by quality: SENS-16
// is bm25 lexical relevance to stored material, which is corpus-relative and
// genuinely useful, but it is NOT navigator problem-state, so Canon Part 11 R3
// forbids ranking it above anything that is.
//   SENS-16      content-relevance    (bm25 lexical content relevance)
const SENS_PRIORITY = Object.freeze([
  // Group A -- confirmed room-state / projected-cortex facts
  Object.freeze({
    id: 'SENS-08',
    optimizes: 'the count of cross-room contradiction reaches surfaced to the navigator',
    watched_by: 'the count of surfaced contradictions the navigator actually resolves versus lets recur',
    why: 'a sensor rewarded for firing on every contradiction will surface the same unresolved one on every turn, and only a resolution count tells surfacing from solving apart',
  }),
  Object.freeze({
    id: 'SENS-17',
    optimizes: 'the count of hats offers made on accumulated unresolved contradiction',
    watched_by: 'the count of hats offers the navigator accepts versus dismisses',
    why: 'an offer nobody takes is noise dressed as signal, and only the accept rate tells the two apart',
  }),
  Object.freeze({
    id: 'SENS-10',
    optimizes: 'the count of gear-shift offers made on a detected conversational loop',
    watched_by: 'the count of turns after the offer that still show the same loop pattern',
    why: 'an offer that fires while the loop continues unchanged means the detector is pattern-matching without breaking anything',
  }),
  Object.freeze({
    id: 'SENS-11',
    optimizes: 'the count of save-as-skill offers made on a reusable-expert pattern',
    watched_by: 'the count of saved skills that are later actually invoked again',
    why: 'a skill saved once and never invoked again is a filed artifact, not a working skill',
  }),
  Object.freeze({
    id: 'SENS-19',
    optimizes: 'the count of room-graph-integrity contradiction offers surfaced to the navigator',
    watched_by: 'the count of surfaced integrity offers the navigator declines, plus the count of surfaced defects still present a week later',
    why: 'a sensor rewarded for surfacing defects will surface noise, and a decline rate is what catches it',
  }),
  Object.freeze({
    id: 'SENS-20',
    optimizes: 'the count of strategy re-aim proposals surfaced to the navigator',
    watched_by: 'the count of surfaced proposals the navigator dismisses or rejects, versus ratifies',
    why: 'a watcher rewarded for proposing will nag on a wrong cadence, and only the dismissal rate tells a wrong cadence from a genuinely stale goal',
  }),
  Object.freeze({
    id: 'SENS-14',
    optimizes: 'the count of qualification-card offers made on a harvested opportunity',
    watched_by: 'the count of qualification cards that convert to a filed opportunity record versus are dismissed',
    why: 'an opportunity harvested and never qualified is a false-positive harvest',
  }),
  Object.freeze({
    id: 'SENS-02',
    optimizes: 'the count of lagging-component reaches surfaced',
    watched_by: 'the count of surfaced lags the navigator confirms are still blocking versus already resolved',
    why: 'a lag computed from stale room state can keep firing after the lag has already closed',
  }),
  Object.freeze({
    id: 'SENS-RECENCY',
    optimizes: 'the count of recency-weighted reaches shown ahead of older material',
    watched_by: 'the count of recency-favored reaches the navigator declines in favor of older material',
    why: 'recency is a proxy for relevance, not relevance itself, and only a decline count catches the gap',
  }),
  // Group B -- explicit turn signals and shipped side-channel markers
  Object.freeze({
    id: 'SENS-01',
    optimizes: null,
    watched_by: null,
    why: 'a one-shot structural turn-position fact (is this the first material in the room), not a quantity repeated firing can push up',
  }),
  Object.freeze({
    id: 'SENS-06',
    optimizes: 'the count of artifacts filed',
    watched_by: 'the count of filed artifacts that are later contradicted or never cited',
    why: 'an assistant rewarded for filing will file more and worse',
  }),
  Object.freeze({
    id: 'SENS-13',
    optimizes: 'the count of deep_research offers made on a fresh eureka marker',
    watched_by: 'the count of offered deep_research runs the navigator actually starts',
    why: 'a marker that goes stale and keeps firing spends the offer\'s credibility before the navigator ever sees a real eureka',
  }),
  Object.freeze({
    id: 'SENS-15',
    optimizes: 'the count of url-ingest offers made on a bare URL in the turn',
    watched_by: 'the count of ingested URLs later cited in a filed claim',
    why: 'an ingested url nobody cites again was ingested for nothing',
  }),
  Object.freeze({
    id: 'SENS-12',
    optimizes: 'the count of room-chooser cards offered on a mid-dialogue fork',
    watched_by: 'the count of room-chooser offers the navigator accepts versus continues past in the current room',
    why: 'an offer to switch rooms that is always declined is interrupting a session that was never actually ambiguous',
  }),
  Object.freeze({
    id: 'SENS-07',
    optimizes: 'the count of gate-approach reaches surfaced ahead of a milestone',
    watched_by: 'the count of surfaced gates the navigator actually gates on versus that pass with no review',
    why: 'a gate signal that fires and is waved through every time is a checkpoint in name only',
  }),
  Object.freeze({
    id: 'SENS-03',
    optimizes: 'the count of methodology-decision reaches surfaced',
    watched_by: 'the count of surfaced methodology decisions the navigator later revisits or reverses',
    why: 'a decision surfaced and never revisited either was right or was never actually reviewed, and only the reversal count tells the two apart',
  }),
  // Group C -- derived / reweighted intent signals
  Object.freeze({
    id: 'SENS-05',
    optimizes: null,
    watched_by: null,
    why: 'a derived reweight of other sensors\' scores, not itself a reach shown to the navigator, so it pushes up no independently observable quantity of its own',
  }),
  Object.freeze({
    id: 'SENS-04',
    optimizes: 'the count of external-reference reaches surfaced',
    watched_by: 'the count of surfaced external references the navigator actually opens or verifies',
    why: 'a reference offered and never opened is dead weight in the reach queue',
  }),
  Object.freeze({
    id: 'SENS-09',
    optimizes: 'the count of diffusion-adoption reaches routed to ACE',
    watched_by: 'the count of ACE-routed reaches that convert to a filed dual-use finding',
    why: 'a diffusion read that never produces a finding is routing traffic for nothing',
  }),
  Object.freeze({
    id: 'SENS-SHOW',
    optimizes: 'the count of show/share selector offers made',
    watched_by: 'the count of show/share offers the navigator actually invokes',
    why: 'an intent detector that fires on every mention of show but is never wanted is guessing, not detecting',
  }),
  Object.freeze({
    id: 'SENS-18',
    optimizes: 'the count of roadmap-type-selector offers made',
    watched_by: 'the count of roadmap-type selections that match the type the sensor guessed',
    why: 'a guessed output shape the navigator always overrides carries no information',
  }),
  // Group D -- the FALLBACK lexical tier (last by doctrine, Canon Part 11 R3)
  Object.freeze({
    id: 'SENS-16',
    optimizes: 'lexical hit count against stored material',
    watched_by: 'the share of offered reaches the navigator declines',
    why: 'bm25 recall rises while usefulness falls and nothing in the hit count can tell the difference',
  }),
]);

// ---------- Phase 343 Plan 04 (WD-8): the derived id array ----------
//
// SENS_PRIORITY_IDS is built ONCE from SENS_PRIORITY rather than hand
// maintained, so an order-sensitive reader (sensorPriorityRank below, and any
// future reader that only needs the ids) never has to learn the record shape,
// and so a hand-maintained second copy -- the exact drift this table exists to
// stop -- can never happen. Order is byte-identical to the pre-343-04 id-only
// table.
const SENS_PRIORITY_IDS = Object.freeze(SENS_PRIORITY.map((r) => r.id));

/**
 * The 0-indexed doctrine rank of a sensor id: lower is higher priority.
 *
 * Defensive by the same shape as canonicalRegistryRank in
 * lib/workflow/reach-hedge-ranker.cjs: an unknown id, a non-string, or an empty
 * string falls to SENS_PRIORITY.length -- the WORST rank, a finite integer.
 * Never Infinity, never NaN, never -1. A comparator that subtracts two of these
 * must always get a usable finite number, because a NaN comparator result
 * silently corrupts a sort rather than failing loudly.
 *
 * Phase 343 Plan 04: looks the id up through SENS_PRIORITY_IDS (the derived
 * id array) rather than SENS_PRIORITY directly, since SENS_PRIORITY's elements
 * are now records, not bare strings; the contract below is otherwise
 * unchanged.
 *
 * @param {string} sensorId -- a self-declared sensor id, e.g. 'SENS-08'
 * @returns {number} 0..SENS_PRIORITY.length
 */
function sensorPriorityRank(sensorId) {
  if (typeof sensorId !== 'string' || sensorId === '') return SENS_PRIORITY.length;
  const idx = SENS_PRIORITY_IDS.indexOf(sensorId);
  return idx === -1 ? SENS_PRIORITY.length : idx;
}

module.exports = {
  SENS_PRIORITY: SENS_PRIORITY,
  SENS_PRIORITY_IDS: SENS_PRIORITY_IDS,
  sensorPriorityRank: sensorPriorityRank,
};
