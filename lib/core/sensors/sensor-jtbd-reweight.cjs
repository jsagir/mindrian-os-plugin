'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143-03 Task 2 -- SENS-05 JTBD set/changed re-weighting detector.
 *
 * The CONSUMER over the shipped-but-unconsumed Phase 104 JTBD signal
 * (lib/hmi/jtbd-state.cjs, v1.12.3). The JTBD state has been CAPTURED since
 * Phase 100/104 but never consumed for re-weighting -- this detector is that
 * consumer. When the room's JTBD is set or changed (the current jtbd differs
 * from the prior history transition), SENS-05 surfaces a candidate reach
 * carrying the re-weight signal for two downstream consumers:
 *
 *   - SELECTOR MENU re-weight: the new JTBD slug, which lib/workflow/
 *     f-selector-ranker.cjs already consumes as roomState.activeJtbd
 *     (_resolveJtbdForCommand leans the activeJtbd that matches a command's
 *     serves_jtbd). SENS-05 does NOT re-rank inline -- it surfaces the slug; the
 *     ranker consumes it.
 *   - BRAIN-QUERY weight: the ADDRESSES_PROBLEM_TYPE handle (references/brain/
 *     query-patterns.md), carrying ONLY the generic problem-type ENUM.
 *
 * REUSE BEFORE BUILD (Canon Part 7): the JTBD state I/O is shipped. This sensor
 * READS it (getCurrent + history) and surfaces the re-weight signal. It never
 * re-implements the JTBD inference engine or the selector ranker.
 *
 * CANON PART 8: the reach carries ONLY generic handles -- the JTBD slug (a
 * taxonomy enum) + the problem-type enum. Never the evidence text, meeting
 * content, or proprietary numbers that the jtbd-state rows may carry. The
 * detector reads the slug + the `to` transition field only; it never copies the
 * evidence array. The inherited Part-8 sweep over lib/core/sensors/ spans this
 * file: no packet/brain-client require, no projection token, no hashing path.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide(). The routing fence over
 * lib/core/sensors/ asserts this.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');
const jtbdState = require('../../hmi/jtbd-state.cjs');

/**
 * Pull the problem_type enum off the diagnose tuple as a generic handle.
 * Returns 'undefined' (the enum value) when absent -- never user content.
 */
function problemTypeEnum(tuple) {
  if (!tuple || typeof tuple !== 'object') return 'undefined';
  const pt = tuple.problem_type;
  return (typeof pt === 'string' && pt) ? pt : 'undefined';
}

/**
 * The current JTBD slug for the room, or '' when no current state exists.
 * Reads ONLY the slug -- never the evidence array or confidence.
 */
function currentJtbdSlug(roomDir) {
  const current = jtbdState.getCurrent(roomDir);
  if (!current || typeof current !== 'object') return '';
  return (typeof current.jtbd === 'string' && current.jtbd) ? current.jtbd : '';
}

/**
 * The prior JTBD slug -- the `from` of the most recent transition row whose `to`
 * equals the current slug. This is what the current slug CHANGED FROM. Returns
 * '' when there is no prior transition (a brand-new set). Reads ONLY the
 * `from`/`to` slug fields, never the row's evidence.
 */
function priorJtbdSlug(roomDir, currentSlug) {
  const rows = jtbdState.history(roomDir, 50);
  if (!Array.isArray(rows) || rows.length === 0) return '';
  // Walk from the newest row backward; the first row whose `to` is the current
  // slug names the transition INTO the current JTBD, and its `from` is the prior.
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row && typeof row === 'object' && row.to === currentSlug) {
      return (typeof row.from === 'string') ? row.from : '';
    }
  }
  return '';
}

/**
 * SENS-05 -- JTBD set/changed -> the selector-menu + Brain-query re-weight reach.
 *
 * Fires when the room's current JTBD differs from what it changed from (a real
 * set/change event). Returns null when the JTBD is unchanged or absent.
 *
 * @param {object} _turn -- the turn signal bag (unused; the change lives in state)
 * @param {object} tuple -- the /mos:diagnose tuple { problem_type }
 * @param {object} ctx   -- LOCAL context { roomDir }
 * @returns {Readonly<object>|null}
 */
function sensorJtbdReweight(_turn, tuple, ctx) {
  const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
  if (!roomDir) return null;

  const currentSlug = currentJtbdSlug(roomDir);
  if (!currentSlug) return null; // no JTBD set -> nothing to re-weight

  const priorSlug = priorJtbdSlug(roomDir, currentSlug);
  // A change requires a prior that differs from the current. A first-ever set
  // (priorSlug '' / the seed 'explore' equal to current) or a re-set to the same
  // slug is NOT a change -> no spurious re-weight.
  if (!priorSlug || priorSlug === currentSlug) return null;

  const pt = problemTypeEnum(tuple);

  // Companions carry ONLY generic handles:
  //   - serves_jtbd:<slug>            -> the selector-menu re-weight (f-selector-ranker)
  //   - ADDRESSES_PROBLEM_TYPE:<enum> -> the Brain-query weighting (generic enum only)
  // The JTBD slug is a taxonomy enum (jtbd-taxonomy.json), not user content.
  const companions = [
    'serves_jtbd:' + currentSlug,
    'ADDRESSES_PROBLEM_TYPE:' + pt,
  ];

  return makeReach({
    reach_id: 'context_block',
    // 'hold' posture: a JTBD change re-weights the menus and holds for the
    // navigator's next Decision Gate selection rather than auto-advancing.
    posture: 'hold',
    // Dispatch names the re-weight surface (a handle): f-selector-ranker consumes
    // the serves_jtbd slug as roomState.activeJtbd; the sensor does not re-rank.
    dispatch: 'jtbd-reweight (f-selector-ranker serves_jtbd)',
    companions: companions,
    signal: 'jtbd_changed',
    // LOCAL scalars only: the new + prior JTBD slugs (taxonomy enums) + the
    // problem-type enum. No evidence text, no confidence, no user content.
    evidence: {
      jtbd: currentSlug,
      prior_jtbd: priorSlug,
      problem_type: pt,
    },
  });
}

module.exports = {
  sensorJtbdReweight: sensorJtbdReweight,
};
