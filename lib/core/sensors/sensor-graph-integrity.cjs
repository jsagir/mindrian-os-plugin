'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/sensors/sensor-graph-integrity.cjs -- Phase 343 Plan 06, Task 1.
 *
 * SENS-19 -- the room-graph integrity sensor. Fires the EXISTING
 * `contradiction` reach at posture `hold` when a bound room's per-room
 * graph-integrity defect count crosses INTEGRITY_DEFECT_THRESHOLD (WD-6,
 * WD-19, docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md), so a room a human never
 * runs /mos:doctor against still gets a standing offer at the Decision Gate.
 *
 * WHY `contradiction` AND NO SEVENTH REACH ID. `makeReach` (./sensor-types.cjs)
 * returns null for any reach_id outside the frozen REACH_IDS bank, and the
 * reach then vanishes with NO error anywhere -- the same silent-failure shape
 * the ctx-producer warning below names for a different place. Minting a
 * seventh id would also touch skills/larry-personality/SKILL.md and every
 * render surface that reads the six-row dial doctrine, for no gain: dangling
 * edge endpoints and unanchored claims are exactly the graph disagreeing with
 * itself, which is what the contradiction row already means. It carries no
 * turn-stage gate (only brain_consult/deep_research are gated), so it can
 * fire on turn 1.
 *
 * PURE AND SYNCHRONOUS BY CONTRACT, PERMANENTLY. A Promise satisfies
 * `typeof === 'object'` but has `reach_id === undefined`, so dispatchSensors
 * drops it with no throw and no log (sensor-roadmap-type.cjs documents the
 * identical scar for the same reason). Never make any function in this file
 * `async`.
 *
 * THE room.db READ IS NOT THIS FILE'S JOB. Canon Part 8/9: this detector
 * reads ctx.graph_integrity scalars only. The read against the caller-owned
 * handle runs in the ctx-assembly producer block this plan adds to the
 * decide() engine module (after its SENS-16 block), never here. This file
 * does not require the decide() engine module by name, does not call
 * decide(), and does not set routing_source -- the governed path runs one
 * direction only.
 *
 * POSTURE IS `hold`: a standing offer that never auto-runs. Nothing files
 * without the navigator verb (Canon Part 9 role 5 / Part 3).
 *
 * THE THRESHOLD (WD-19). Sums ONLY the two defect classes that vary by room:
 * edge_rows_missing_endpoint and claim_nodes_no_anchor_new. Two fleet-wide
 * classes are DELIBERATELY EXCLUDED from the sum even though they ride the
 * evidence as information, because a future reader who adds either back to
 * the sum needs to find the reason right here, not only in a document:
 *   - claim_nodes_no_anchor_legacy: frozen at roughly 7,824 rows fleet-wide,
 *     fully explained by one named writer gap (lib/core/navigation/
 *     typed-claim.cjs::writeClaimNode inserts a claim node and writes zero
 *     edges). Including it would fire this sensor in every room on every
 *     turn forever -- a sensor that carries no information.
 *   - edge_rows_type_outside_allowlist: a single named chokepoint bypass
 *     present across the fleet (lib/core/graph-ops.cjs, scripts/
 *     build-ecosystem-graph.cjs issuing raw INSERT INTO edges statements
 *     that skip writeEdge's ALLOWED_EDGE_TYPES check), not a per-room
 *     condition, and Phase 273 territory rather than a per-turn signal.
 *
 * Measured per-room distribution, 2026-09-14
 * (docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md Section 3): three rooms carry 99
 * percent of the 2,657 fleet-wide dangling edge rows; the remaining measured
 * rooms carry as few as one or four. INTEGRITY_DEFECT_THRESHOLD = 25 fires on
 * the three, stays silent on the rest. Moving it is a one-line,
 * evidence-backed change -- the distribution lives in this comment, not only
 * in docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md.
 *
 * Canon Part 8: this file requires exactly one thing, makeReach, from
 * ./sensor-types.cjs. No require of the decide() engine module; no decide()
 * call; no routing_source write. Pure / sync / LOCAL-first. House rule:
 * hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');

// WD-19, measured 2026-09-14 (see the header comment above for the full
// distribution and the two excluded-class reasons). A future navigator moving
// this constant should re-measure the live fleet first, not copy this number.
const INTEGRITY_DEFECT_THRESHOLD = 25;

// Coerce a null/missing/non-numeric field to 0 for the SUM only (WD-19). The
// raw value, including null, still rides the evidence bag untouched below.
function coerceCountForSum(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
}

/**
 * sensorGraphIntegrity(turn, tuple, ctx) -> candidate-reach|null.
 *
 * Reads ONLY ctx.graph_integrity, a flat scalar bag the decide() engine's
 * ctx-assembly producer threads on. Makes no db read, no filesystem read, no
 * network call. Defensive; never throws.
 *
 * @param {object} _turn  -- unused; the signal is state-driven, not turn-text-driven
 * @param {object} _tuple -- unused; the trigger is a room-state fact, not a problem-type read
 * @param {object} ctx    -- LOCAL context carrying ctx.graph_integrity
 * @returns {Readonly<object>|null}
 */
function sensorGraphIntegrity(_turn, _tuple, ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  const gi = ctx.graph_integrity;
  if (!gi || typeof gi !== 'object' || Array.isArray(gi)) return null;

  const sum = coerceCountForSum(gi.edge_rows_missing_endpoint)
    + coerceCountForSum(gi.claim_nodes_no_anchor_new);
  if (sum < INTEGRITY_DEFECT_THRESHOLD) return null;

  return makeReach({
    reach_id: 'contradiction',
    posture: 'hold',
    dispatch: 'room-graph-integrity',
    companions: [],
    signal: 'graph_integrity_threshold',
    // LOCAL scalars only. The two excluded classes ride here as information
    // even though they cannot trigger the sensor, so a navigator reading the
    // offer sees the whole picture. Never a node id, a room path, or an edge
    // type name: edge_types_outside_allowlist is a DOCTOR payload field
    // (lib/core/navigation/graph-integrity-counts.cjs) and must never cross
    // into a reach.
    evidence: {
      edge_rows_missing_endpoint: gi.edge_rows_missing_endpoint,
      claim_nodes_no_anchor_new: gi.claim_nodes_no_anchor_new,
      edge_rows_type_outside_allowlist: gi.edge_rows_type_outside_allowlist,
      proposed_nodes_past_window: gi.proposed_nodes_past_window,
      schema_variant: gi.schema_variant,
    },
  });
}

module.exports = {
  sensorGraphIntegrity: sensorGraphIntegrity,
  INTEGRITY_DEFECT_THRESHOLD: INTEGRITY_DEFECT_THRESHOLD,
};
