'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-06 Task 3 -- R12 temporal-blindness sentinel (D-04 scheduled backstop).
 * ===============================================================================
 *
 * sensorTemporalBlindness(ctx) is the SCHEDULED backstop: it scans the room's
 * OWN room.db (LOCAL only) for real-world-event nodes (type 'meeting' OR
 * has_event_date===true on the properties JSON) where valid_at IS NULL, and
 * RETURNS exactly those nodes for dating. When it surfaces any (>= 1) it emits a
 * single temporal_blindness_surfaced memory_event via navigation.logMemoryEvent
 * (the Part 9 chokepoint). When zero surface, it returns empty and emits NOTHING
 * (silent on a clean run).
 *
 * Front line vs backstop (D-04): the R11 date+sync gate (date-sync-gate.cjs) is
 * the FRONT LINE catching undated real-world artifacts at the filing source; this
 * sentinel is the standing BACKSTOP, composed into the Phase 145 scout cadence,
 * not fired per-turn (temporal blindness is slow-accumulating debt, not an urgent
 * turn-to-turn signal). has_event_date is set EXPLICITLY at write time by node
 * type; the sentinel only READS it (never infers), so the scan is deterministic.
 *
 * Canon Part 8 (LOCAL -> BRAIN: NO). PURE LOCAL: reads room.db scalars (type,
 * the valid_at / has_event_date keys off the properties JSON) and emits an
 * enum/count event. ZERO network, ZERO Brain. The undated node IDS ride the
 * RETURN value (for the surface layer to date); the event payload carries ONLY a
 * count scalar + a source_path -- never a node body, never user prose. The
 * lib/core/sensors Part-8 5-tripwire sweep spans this file: no packet /
 * brain-client require, no egress-projection helpers, no hashing call sites.
 *
 * Phase 144 routing fence: this file PRODUCES a surfacing result; it never
 * assigns routing_source and never requires navigation-engine.cjs nor defines
 * the routing function. The routing fence over lib/core/sensors/ asserts this.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const navigation = require('../navigation.cjs');

/*
 * scanUndatedRealWorldNodes(db) -> array of { id, type } for every node that is
 * a real-world event (type 'meeting' OR has_event_date===true) AND has no
 * valid_at on its properties JSON. memory_event nodes are EXCLUDED (they carry
 * their own valid_at semantics under Wave 2 dual-stamp and are not artifacts to
 * date). Returns [] on any query fault (never throws).
 *
 * valid_at and has_event_date live on the properties JSON (the additive idiom --
 * no DDL column), so the filter uses json_extract. "valid_at IS NULL" means the
 * json_extract returns SQL NULL (key absent or explicitly null).
 */
function scanUndatedRealWorldNodes(db) {
  try {
    const rows = db.prepare(
      "SELECT id, type FROM nodes " +
      "WHERE type != 'memory_event' " +
      "AND (type = 'meeting' OR json_extract(properties, '$.has_event_date') = 1 " +
      "     OR json_extract(properties, '$.has_event_date') = 'true') " +
      "AND json_extract(properties, '$.valid_at') IS NULL " +
      "ORDER BY id"
    ).all();
    return Array.isArray(rows) ? rows : [];
  } catch (_err) {
    // A query fault must never crash a scheduled sweep; degrade to empty.
    return [];
  }
}

/*
 * sensorTemporalBlindness(ctx) -> { nodes, count, surfaced, eventEmitted }.
 *
 * ctx:
 *   db   a caller-owned room.db handle (via openRoomDb), exactly like writeEdge.
 *        Absent / non-object -> degrades to an empty result (no throw).
 *   now  injectable clock closure forwarded to logMemoryEvent (options.now seam).
 *
 * Returns:
 *   nodes        the undated real-world-event nodes ({id, type}) to surface.
 *   count        nodes.length (scalar).
 *   surfaced     boolean -- true iff count > 0.
 *   eventEmitted boolean -- true iff a temporal_blindness_surfaced event landed.
 */
function sensorTemporalBlindness(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  const db = c.db;

  if (!db) {
    return { nodes: [], count: 0, surfaced: false, eventEmitted: false };
  }

  const nodes = scanUndatedRealWorldNodes(db);
  const count = nodes.length;

  // Silent on a clean run: zero undated nodes -> emit NOTHING (R12 acceptance).
  if (count === 0) {
    return { nodes: [], count: 0, surfaced: false, eventEmitted: false };
  }

  // Surface >= 1: emit ONE temporal_blindness_surfaced event (count scalar only;
  // the node IDS ride the RETURN value, never the event payload -- Part 8).
  const chokeOpts = {};
  if (typeof c.now === 'function') chokeOpts.now = c.now;
  let eventEmitted = false;
  try {
    const ev = navigation.logMemoryEvent(db, 'temporal_blindness_surfaced', {
      count,
      source_path: 'sentinel:temporal-blindness',
      created_by: 'system',
    }, chokeOpts);
    eventEmitted = !!(ev && ev.ok);
  } catch (_err) {
    // The emit is best-effort; the surfacing result is the load-bearing output.
    eventEmitted = false;
  }

  return { nodes, count, surfaced: true, eventEmitted };
}

module.exports = {
  sensorTemporalBlindness,
  // Exported for targeted tests + the cadence composition.
  scanUndatedRealWorldNodes,
};
