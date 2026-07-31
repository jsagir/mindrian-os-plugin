'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-01 Task 1 -- SENS_PRIORITY: the doctrine-authored sensor priority
 * table (D-20) plus its defensive rank lookup.
 *
 * WHY THIS FILE EXISTS
 *
 * 12 of the 18 registered sensors can fire the SAME reach id, `context_block`
 * (D-19, count re-derived live). When two of them fire on one turn,
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
 * SENS-17 is intentionally NOT in this table yet. Plan 245-06 mints
 * sensorPerspectiveLock as SENS-17 and inserts it here; the Task 3 gate is
 * exactly what FORCES that insertion, because a registered sensor with no
 * priority entry fails `node scripts/build-connector-registry.cjs --check`
 * closed.
 *
 * Canon Part 8: this module is a frozen in-repo literal plus an array index
 * lookup. Zero I/O, zero network, zero user bytes. Pure and sync.
 * House rule: hyphens only, no em-dashes.
 */

// ---------- The priority table (frozen, index 0 = highest priority) ----------
//
// Group A -- confirmed room-state / projected-cortex facts. Highest durability
// under rule 2: each of these keys on something already written down and
// re-readable (a cortex projection, a graph pattern, a stored artifact), so its
// payload is the one a navigator can most defensibly be shown first.
//   SENS-08      memory-cortex        (cross-room projected-cortex contradiction)
//   SENS-10      circularity          (a confirmed conversational-loop pattern)
//   SENS-11      expert-skill         (a reusable-expert pattern in room state)
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
//
// Group D -- the FALLBACK lexical tier. Last by rule 1, not by quality: SENS-16
// is bm25 lexical relevance to stored material, which is corpus-relative and
// genuinely useful, but it is NOT navigator problem-state, so Canon Part 11 R3
// forbids ranking it above anything that is.
//   SENS-16      content-relevance    (bm25 lexical content relevance)
const SENS_PRIORITY = Object.freeze([
  // Group A -- confirmed room-state / projected-cortex facts
  'SENS-08',
  'SENS-10',
  'SENS-11',
  'SENS-14',
  'SENS-02',
  'SENS-RECENCY',
  // Group B -- explicit turn signals and shipped side-channel markers
  'SENS-01',
  'SENS-06',
  'SENS-13',
  'SENS-15',
  'SENS-12',
  'SENS-07',
  'SENS-03',
  // Group C -- derived / reweighted intent signals
  'SENS-05',
  'SENS-04',
  'SENS-09',
  'SENS-SHOW',
  // Group D -- the FALLBACK lexical tier (last by doctrine, Canon Part 11 R3)
  'SENS-16',
]);

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
 * @param {string} sensorId -- a self-declared sensor id, e.g. 'SENS-08'
 * @returns {number} 0..SENS_PRIORITY.length
 */
function sensorPriorityRank(sensorId) {
  if (typeof sensorId !== 'string' || sensorId === '') return SENS_PRIORITY.length;
  const idx = SENS_PRIORITY.indexOf(sensorId);
  return idx === -1 ? SENS_PRIORITY.length : idx;
}

module.exports = {
  SENS_PRIORITY: SENS_PRIORITY,
  sensorPriorityRank: sensorPriorityRank,
};
