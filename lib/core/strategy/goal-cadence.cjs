'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-03 Task 2 -- the cadence and stall counters, pure over the Part 9
 * memory_event log, plus the null-default stall signal Phase 346 consumes.
 * layer: graph
 *
 * WHAT THIS FILE IS. The strategy node needs to answer three questions before
 * it can be a sensor: how many execution reaches have happened since the
 * last proposal, whether the room is producing (new claims, promotions,
 * filed artifacts) or circling, and whether it is too soon to propose again.
 * This module answers the first two, purely, over a caller-supplied handle;
 * lib/core/strategy/strategy-throttle.cjs (Task 3) answers the third.
 *
 * REUSE BEFORE BUILD (Canon Part 7, 345-RESEARCH "Don't Hand-Roll"): the
 * `_counter` idiom (the roomState injection seam, the READ_LIMIT bound, the
 * zeroed cold-start return, the enum-only read discipline) is copied from
 * lib/core/meter/gate-density-reader.cjs and lib/workflow/reach-reject-
 * reader.cjs, verbatim in SHAPE. Neither reader is callable as-is for this
 * job: gate-density-reader's computeInvocationDensity returns a ratio against
 * a fixed denominator, not a since-timestamp count; reach-reject-reader's
 * presentationsCount is reach_id-keyed and all-time, not windowed. So this
 * module calls navigation.findRecentChanges directly, through the SAME
 * chokepoint those readers use (never a raw statement-level SQL query of its
 * own), and states that reason here rather than silently re-deriving the
 * same four guards.
 *
 * ARTIFACTS_SINCE, THE ONE DERIVED COUNT. The roadmap's stall definition is
 * "repeated reaches with no new claim, NO FILED ARTIFACT, or a contradiction
 * left unresolved" -- so artifacts_since is first-class, not an optional
 * extra. SENS-06 (lib/core/sensors/sensor-artifact-filed.cjs) keys on the
 * <roomDir>/.mindrian/last-cascade.json marker, a filesystem side-channel,
 * not a memory_event -- so there is NO event type that records an artifact
 * filing (grepping the EVENT_TYPES additive blocks confirms this; the
 * closest name, node_created, is a generic node-creation event with no
 * artifact-specific member). Building a counter on a producer that does not
 * exist would repeat the sessionstart_coordinator_run ghost-event failure
 * (345-RESEARCH Pitfall 6, 345-ICM-CONSULT AP-G3): a counter that reads 0
 * forever and never says why. So artifacts_since is instead DERIVED from the
 * node_created rows already being read for claims_since, filtered to the
 * rows whose properties.node_type names an artifact node type
 * (memory_artifact or the legacy Artifact alias -- both real node types read
 * this way elsewhere, e.g. lib/core/eureka/opportunity-harvest.cjs:520-521,
 * lib/core/eureka/tri-modal-index.cjs:162). This is an honest reading, not a
 * fault: a room that never fires node_created with an artifact node_type
 * reads artifacts_since=0, same as a room with no artifacts at all, and that
 * is the correct answer until a real artifact-filing producer exists.
 *
 * CANDIDATES. Built from the SAME node_created rows' target_node_id field
 * (memory-events.cjs's own extracted properties.target_node_id column,
 * findRecentChanges:788/804 -- the canonical "which node this event is
 * about" handle used across the repo), first-wins de-duplicated, capped at
 * MAX_CANDIDATES (64, matching gate-render.cjs:57 MAX_EVIDENCE_NODE_IDS).
 * These ids are LOCAL room content by the ICM consult's own framing: they
 * ride sensorCtx for the gate handler only and must never ride a reach.
 *
 * READSTALLSIGNAL AND THE NULL-DEFAULT (STRAT-09, Phase 346's named input).
 * A true "consecutive reaches with no new claim" streak is a stateful
 * computation this plan does not build (the plan's own scope fence: "this
 * plan builds nothing new that already exists" and "everything here is
 * testable in isolation with no database at all"). So readStallSignal
 * prefers roomState.strategyStallCount (the injection seam a future producer
 * or a unit test can supply) and otherwise returns stall_count: null, NEVER
 * 0, whether or not a db handle is present -- because this module does not
 * yet compute the live streak from raw events, and 0 would assert "measured,
 * zero stall" for a quantity nothing has measured. Phase 346's arbiter reads
 * this null as "no signal available" and a future plan wires the real
 * streak producer into the same seam without this file's contract changing.
 *
 * Canon Part 8: every read is an enum/scalar count or a LOCAL node-id
 * handle; no room prose crosses this module, and nothing here makes a
 * network call. Canon Part 9: every count is a navigation.findRecentChanges
 * call through the chokepoint; there is no raw SQL and no database require
 * anywhere in this file.
 *
 * Pure CJS, node built-ins plus require('../navigation.cjs') only. No native
 * SQLite driver require of any kind (the third-party npm driver does not
 * even resolve from the repo root; see 345-RESEARCH Environment
 * Availability, and Node's own built-in module is likewise absent -- every
 * read here goes through the navigation chokepoint's caller-supplied handle,
 * never a module this file opens itself).
 * House rule: hyphens only, no em-dashes.
 */

// Phase 345-05 (Rule 3 fix, discovered registering SENS-20): navigation.cjs is
// required LAZILY, inside _rows below, rather than at module top level. The
// moment lib/core/insight-sensors.cjs requires sensor-strategy-reach.cjs
// (which requires THIS module), a top-level require here would drag in
// navigation.cjs's own dependency tree, which reaches back to
// lib/core/navigation-engine.cjs (via navigation/calibration-log.cjs ->
// lib/workflow/f-selector-ranker.cjs), which itself requires
// insight-sensors.cjs for dispatchSensors -- closing a require cycle onto the
// very module that started the chain. Measured effect before this fix: when
// insight-sensors.cjs is required before navigation-engine.cjs anywhere in a
// process (a plausible order, not a contrived one), navigation-engine.cjs's
// own `const { dispatchSensors } = require('./insight-sensors.cjs')` binds to
// undefined permanently (Node's classic circular-require partial-exports
// trap), and decide()'s own try/catch around dispatchSensors(...) then
// SILENTLY swallows every TypeError, forever, for ALL registered sensors, not
// just this one. This mirrors the exact class of cycle
// lib/core/navigation/calibration-gate.cjs already documents solving the same
// way (its own lazy require of f-selector-ranker.cjs, for the identical
// reason: a top-level require there would force navigation-engine.cjs to load
// before it finishes exporting). Lazy-requiring here breaks the cycle at this
// module's own edge without touching navigation-engine.cjs's unavoidable
// existing dependency on navigation.cjs. Zero behavior change: the same
// function, called at the same call sites, is used either way.
// ---------------------------------------------------------------------------
// Named constants (WD-1, reversible by editing this block alone; each
// carries a one-line comment saying what the number MEANS).
// ---------------------------------------------------------------------------

// The per-event-type row bound, matching gate-density-reader.cjs's own bound.
const READ_LIMIT = 1000;

// The scheduled cadence. Measured basis: 14,676 reach_presented rows across
// 30 live rooms, roughly 489 reaches per room over the fleet's life to date;
// 40 puts the ceiling at about a dozen proposals over a room's entire
// history -- a slower cadence than the loops it watches, not a per-session
// nag.
const STRATEGY_CADENCE_REACHES = 40;

// The minimum reaches with zero new claims and zero promotions before "the
// room is circling" is a claim rather than a coincidence.
const STRATEGY_STALL_MIN_SAMPLE = 12;

// The hard floor since the last strategy_proposed row. No proposal inside
// this window for any reason (Pitfall 3, the nagging-loop fence).
const STRATEGY_MIN_INTERVAL_REACHES = 20;

// Matches gate-render.cjs:57 MAX_EVIDENCE_NODE_IDS; do not raise it.
const MAX_CANDIDATES = 64;

// The two node types this repo treats as a filed artifact (opportunity-
// harvest.cjs:520-521, tri-modal-index.cjs:162). Frozen; not reversible by
// editing the WD-1 block above (this is a vocabulary fact, not a threshold).
const ARTIFACT_NODE_TYPES = Object.freeze(['memory_artifact', 'Artifact']);

// ---------------------------------------------------------------------------
// _rows / _count -- the one read primitive. Wraps navigation.findRecentChanges
// in try/catch, returning [] / 0 on any fault (never throws). Mirrors the
// gate-density-reader.cjs::_countEvent idiom.
// ---------------------------------------------------------------------------
function _rows(db, sinceEpochMs, eventType) {
  if (!db) return [];
  const since = typeof sinceEpochMs === 'number' ? sinceEpochMs : 0;
  try {
    // Lazy require (see the module-load-cycle note above this file's constant
    // block); by the time _rows actually runs, both this module and
    // navigation.cjs are fully loaded regardless of original require order.
    const navigation = require('../navigation.cjs');
    const rows = navigation.findRecentChanges(db, since, { eventType: eventType, limit: READ_LIMIT });
    return Array.isArray(rows) ? rows : [];
  } catch (_err) {
    return [];
  }
}

function _count(db, sinceEpochMs, eventType) {
  return _rows(db, sinceEpochMs, eventType).length;
}

// _isArtifactRow -- true when a node_created row's properties.node_type names
// one of the ARTIFACT_NODE_TYPES. Enum read only (Canon Part 8).
function _isArtifactRow(row) {
  const props = row && row.properties;
  const nodeType = props && props.node_type;
  return typeof nodeType === 'string' && ARTIFACT_NODE_TYPES.indexOf(nodeType) !== -1;
}

// _candidatesFromNodeCreated -- the LOCAL node-id handle list, first-wins
// de-duplicated, capped at MAX_CANDIDATES. Reads row.targetNodeId, the
// canonical properties.target_node_id extraction memory-events.cjs already
// performs (findRecentChanges:788,804); a row with no target_node_id
// contributes nothing.
function _candidatesFromNodeCreated(rows) {
  const seen = new Set();
  const candidates = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const id = row && (row.targetNodeId || (row.properties && row.properties.target_node_id));
    if (typeof id === 'string' && id.length !== 0 && !seen.has(id)) {
      seen.add(id);
      candidates.push(id);
      if (candidates.length >= MAX_CANDIDATES) break;
    }
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// readLastProposalEpochMs(db) -> the created_at of the most recent
// strategy_proposed row, or 0 when there is none. This is the `since` every
// other count in computeStrategyCounts is measured from.
// ---------------------------------------------------------------------------
function readLastProposalEpochMs(db) {
  const rows = _rows(db, 0, 'strategy_proposed');
  if (rows.length === 0) return 0;
  // findRecentChanges orders DESC by created_at, so index 0 is the most
  // recent strategy_proposed row.
  const top = rows[0];
  return (top && typeof top.createdAt === 'number') ? top.createdAt : 0;
}

// ---------------------------------------------------------------------------
// computeStrategyCounts(db, sinceEpochMs) -> the six-key scalar+candidate bag.
// Never throws; a null db reads every count as 0 and candidates as [].
// ---------------------------------------------------------------------------
function computeStrategyCounts(db, sinceEpochMs) {
  const nodeCreatedRows = _rows(db, sinceEpochMs, 'node_created');
  return {
    reaches_since: _count(db, sinceEpochMs, 'reach_presented'),
    gates_since: _count(db, sinceEpochMs, 'gate_reached'),
    claims_since: nodeCreatedRows.length,
    promotions_since: _count(db, sinceEpochMs, 'status_promoted'),
    artifacts_since: nodeCreatedRows.filter(_isArtifactRow).length,
    candidates: _candidatesFromNodeCreated(nodeCreatedRows),
  };
}

// ---------------------------------------------------------------------------
// shouldPropose(counts) -> { propose, signal }. Pure; takes the flat scalar
// bag computeStrategyCounts returns (or an equivalent hand-built one, for a
// db-free unit test).
//
// ORDER OF EVALUATION IS LOAD-BEARING (comment required by the plan; do not
// reorder without re-reading 345-RESEARCH Pitfall 3): the
// STRATEGY_MIN_INTERVAL_REACHES floor is checked FIRST and short-circuits to
// false regardless of every other count -- this is the anti-nagging fence,
// cheapest and most certain, and it wins even over a genuine stall reading.
// Then cadence (the scheduled check-in). Then stall (all three production
// signals -- claims, promotions, artifacts -- must be zero; a room producing
// any one of them is producing, not circling). A room with no goal is not
// this function's concern; the sensor refuses that case before ever calling
// in.
// ---------------------------------------------------------------------------
function shouldPropose(counts) {
  const c = (counts && typeof counts === 'object') ? counts : {};
  const reaches = typeof c.reaches_since === 'number' ? c.reaches_since : 0;
  const claims = typeof c.claims_since === 'number' ? c.claims_since : 0;
  const promotions = typeof c.promotions_since === 'number' ? c.promotions_since : 0;
  const artifacts = typeof c.artifacts_since === 'number' ? c.artifacts_since : 0;

  if (reaches < STRATEGY_MIN_INTERVAL_REACHES) {
    return { propose: false, signal: null };
  }
  if (reaches >= STRATEGY_CADENCE_REACHES) {
    return { propose: true, signal: 'goal_cadence_due' };
  }
  if (reaches >= STRATEGY_STALL_MIN_SAMPLE && claims === 0 && promotions === 0 && artifacts === 0) {
    return { propose: true, signal: 'goal_stall' };
  }
  return { propose: false, signal: null };
}

// ---------------------------------------------------------------------------
// readStallSignal(db, roomState) -> { stall_count, reaches_since, claims_since }
// The named Phase 346 input (STRAT-09). See the module header for the
// null-default contract: stall_count is null unless roomState injects
// strategyStallCount, whether or not db is present.
// ---------------------------------------------------------------------------
function readStallSignal(db, roomState) {
  const injected = (roomState
    && typeof roomState.strategyStallCount === 'number'
    && Number.isFinite(roomState.strategyStallCount))
    ? roomState.strategyStallCount
    : null;
  const since = readLastProposalEpochMs(db);
  const counts = computeStrategyCounts(db, since);
  return {
    stall_count: injected,
    reaches_since: counts.reaches_since,
    claims_since: counts.claims_since,
  };
}

module.exports = {
  computeStrategyCounts: computeStrategyCounts,
  shouldPropose: shouldPropose,
  readStallSignal: readStallSignal,
  readLastProposalEpochMs: readLastProposalEpochMs,
  STRATEGY_CADENCE_REACHES: STRATEGY_CADENCE_REACHES,
  STRATEGY_STALL_MIN_SAMPLE: STRATEGY_STALL_MIN_SAMPLE,
  STRATEGY_MIN_INTERVAL_REACHES: STRATEGY_MIN_INTERVAL_REACHES,
};
