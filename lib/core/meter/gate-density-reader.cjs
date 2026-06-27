'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 183-01 METER-01 -- the Gauge-1 invocation-density reader.
 * ============================================================================
 * A PURE reader over the Part 9 memory_event log. It answers the volume half of
 * the v1.19 welded two-gauge metric: how often the intelligence fired this
 * session (reaches / capability invocations per gate-reaching turn).
 *
 *   computeInvocationDensity(db, sinceEpochMs, roomState)
 *     -> { gate_reaches, reach_presentations, framework_invocations,
 *          density, denominator_unit }
 *
 * Density basis (Open Question 1, verified this phase): framework_invoked fires at
 * ~ZERO production sites today (it is READ by _invocationsSinceDecision /
 * computeInvestmentLevel but its emission is a deferred follow-on), so the density
 * basis leans on the events that ACTUALLY fire -- reach_presented + gate_reached --
 * and framework_invocations is carried as an ADDITIVE term that reads ~0 today.
 *
 * denominator_unit = 'gate_reached' (Open Question 2): the cleanest per-turn unit.
 * Density is the invocation volume relative to the gate_reached denominator, so a
 * downstream transfer-per-invocation reading divides by the same unit.
 *
 * Contract (mirrors lib/workflow/reach-reject-reader.cjs verbatim in shape):
 *   - Opens NO db (caller-owned handle, the writeEdge / getRoomContext contract).
 *   - Makes NO remote methodology call; reads ONLY via navigation.findRecentChanges
 *     (the Part 9 chokepoint). Canon Part 8: enum/scalar reads only, no prose, no
 *     egress; the run-all-183.sh grep-sweep proves zero network surface here.
 *   - Prefers the roomState injection seam (roomState.<counter>) so the floor test
 *     runs db-free.
 *   - Returns a zeroed cold-start object on a null db / read fault; NEVER throws.
 *
 * Scope fence (T-183-04): this module is Gauge 1 ONLY. It must NOT be the surface a
 * caller uses to read density in isolation downstream -- Plan 02's welded two-gauge
 * read (lib/core/meter/two-gauge.cjs) is the only sanctioned read path. There is no
 * exported bare-density function returning a number; computeInvocationDensity always
 * returns the full count object with the denominator unit named, never a lone scalar.
 *
 * House rule: hyphens only, no em-dashes.
 */

const navigation = require('../navigation.cjs');

const DENOMINATOR_UNIT = 'gate_reached';
const READ_LIMIT = 1000;

// Injection seam: returns roomState[key] when it is a finite number (the db-free
// test path), else null so the db read path runs. Mirrors the
// reach-reject-reader.cjs::_injected pre-computed-counter guard.
function _injected(roomState, key) {
  if (roomState
      && typeof roomState[key] === 'number'
      && Number.isFinite(roomState[key])) {
    return roomState[key];
  }
  return null;
}

// Count memory_event rows of a single eventType via the Part 9 chokepoint. Returns
// 0 on a null db or any read fault (never throws). Enum/scalar read only.
function _countEvent(db, sinceEpochMs, eventType) {
  if (!db) return 0;
  let rows;
  try {
    rows = navigation.findRecentChanges(db, sinceEpochMs || 0, {
      eventType: eventType,
      limit: READ_LIMIT,
    });
  } catch (_err) {
    return 0;
  }
  return Array.isArray(rows) ? rows.length : 0;
}

// Resolve one counter, preferring the injected roomState value, else the db count.
function _counter(db, sinceEpochMs, roomState, key, eventType) {
  const injected = _injected(roomState, key);
  if (injected !== null) return injected;
  return _countEvent(db, sinceEpochMs, eventType);
}

// ---------------------------------------------------------------------------
// computeInvocationDensity(db, sinceEpochMs, roomState)
//   -> { gate_reaches, reach_presentations, framework_invocations,
//        density, denominator_unit }
//
// gate_reaches        COUNT(memory_event gate_reached)   -- the per-turn denominator
// reach_presentations COUNT(memory_event reach_presented) -- a firing
// framework_invocations COUNT(memory_event framework_invoked) -- additive, ~0 today
// density             (reach_presentations + framework_invocations) / gate_reaches
//                     guarded so cold-start (gate_reaches === 0) density is 0.
// denominator_unit    the string 'gate_reached'.
// ---------------------------------------------------------------------------
function computeInvocationDensity(db, sinceEpochMs, roomState) {
  const gate_reaches = _counter(db, sinceEpochMs, roomState, 'gate_reaches', 'gate_reached');
  const reach_presentations = _counter(db, sinceEpochMs, roomState, 'reach_presentations', 'reach_presented');
  const framework_invocations = _counter(db, sinceEpochMs, roomState, 'framework_invocations', 'framework_invoked');

  const invocation_volume = reach_presentations + framework_invocations;
  const density = gate_reaches > 0 ? (invocation_volume / gate_reaches) : 0;

  return {
    gate_reaches: gate_reaches,
    reach_presentations: reach_presentations,
    framework_invocations: framework_invocations,
    density: density,
    denominator_unit: DENOMINATOR_UNIT,
  };
}

module.exports = { computeInvocationDensity };
