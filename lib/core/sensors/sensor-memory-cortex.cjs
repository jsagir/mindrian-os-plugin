'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 150-05 (MEM-05, D-05) -- SENS-08 memory-cortex detector.
 *
 * A net-new STATE-PATTERN detector over the SHIPPED Phase 150-04 projected
 * cortex. When the projected memory cortex signals it needs attention -- a STALE
 * governing thought (the navigator's MINTO spine sentence no longer governs what
 * the room now holds) OR a FRESH contradiction (a newly projected contradiction
 * edge against a claim the navigator depends on) -- this sensor SURFACES the
 * memory-cortex bridge candidate reach.
 *
 * REUSE BEFORE BUILD (Canon Part 7): the cortex is SHIPPED -- Phase 150-01 mints
 * the memory_artifact / governing_thought / decision nodes, Phase 150-03 projects
 * them, Phase 150-04 surfaces them on getRoomContext legD (cortexNodes) and
 * derives the cortex ctx scalars. This sensor does NOT re-run the projection and
 * does NOT read room.db. It CONSUMES the projected cortex signals threaded on the
 * LOCAL ctx and surfaces the DISPATCH HANDLE only; the navigator approves at the
 * Decision Gate (Canon Part 3) before the orchestrator reads the cortex.
 *
 * The two cortex signals it reads from ctx (both LOCAL scalars, produced by the
 * Wave-2 cortex producers in 150-04, never user content -- a boolean freshness
 * flag and a contradiction count):
 *   - ctx.staleGoverningThought  : boolean -- a governing thought has gone stale
 *   - ctx.freshContradictions    : number  -- count of freshly projected
 *                                  contradiction edges (> 0 fires)
 *
 * Reach: cross_room (the cortex reach is a cross-room/memory bridge per D-05 --
 * NEVER a 7th reach). Posture push_forward: bringing the cortex signal forward to
 * the Decision Gate is a forward-momentum move (surface the stale thought / fresh
 * contradiction, then push through with the navigator's call).
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide(). The routing fence over
 * lib/core/sensors/ asserts this. It MUST soft-fail to null on a malformed or
 * empty ctx (never throw -- one bad sensor cannot poison dispatchSensors).
 *
 * Canon Part 8: the sensor reads ONLY enum/scalar ctx signals; it carries no
 * cortex prose, no governing-thought text, no claim body. The Part-8 sensor sweep
 * auto-covers every lib/core/sensors/*.cjs, including this file.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');

/**
 * True if the projected cortex carries a stale-governing-thought signal on ctx.
 * Tolerant of a missing/malformed ctx -- returns false rather than throwing.
 */
function hasStaleGoverningThought(ctx) {
  if (!ctx || typeof ctx !== 'object') return false;
  return ctx.staleGoverningThought === true;
}

/**
 * The count of freshly projected contradiction edges on ctx (0 when absent or
 * malformed). A count > 0 is the fresh-contradiction signal.
 */
function freshContradictionCount(ctx) {
  if (!ctx || typeof ctx !== 'object') return 0;
  const n = ctx.freshContradictions;
  return typeof n === 'number' && isFinite(n) && n > 0 ? n : 0;
}

/**
 * SENS-08 -- memory-cortex -> the cross-room memory-cortex bridge reach.
 *
 * Fires when EITHER cortex signal is present: a stale governing thought OR a
 * fresh contradiction. Soft-fails to null when neither is present (or the ctx is
 * malformed); never throws.
 *
 * @param {object} _turn -- the turn signal bag (unused; the cortex signal is
 *                          state-driven, threaded on ctx by the 150-04 producer)
 * @param {object} _tuple -- the /mos:diagnose tuple (unused for detection)
 * @param {object} ctx    -- LOCAL context carrying the projected cortex scalars
 * @returns {Readonly<object>|null}
 */
function sensorMemoryCortex(_turn, _tuple, ctx) {
  const stale = hasStaleGoverningThought(ctx);
  const fresh = freshContradictionCount(ctx);
  if (!stale && fresh === 0) return null;

  // The signal kind that tripped the sensor (a generic enum, not user content).
  // A stale governing thought takes precedence in the label when both fire.
  const trigger = stale ? 'stale_governing_thought' : 'fresh_contradiction';

  return makeReach({
    reach_id: 'cross_room',
    posture: 'push_forward',
    // Dispatch names the SHIPPED memory-cortex bridge surface (the reach the
    // orchestrator routes per the connector registry). A handle, not user content.
    dispatch: 'memory-cortex-bridge',
    companions: [],
    signal: 'memory_cortex',
    // LOCAL scalars only: the trigger enum + the contradiction count + the
    // stale flag. No governing-thought text, no claim body -- the WHICH never
    // rides the reach.
    evidence: {
      trigger: trigger,
      stale_governing_thought: stale,
      fresh_contradictions: fresh,
    },
  });
}

module.exports = {
  sensorMemoryCortex: sensorMemoryCortex,
};
