'use strict';
/*
 * lib/core/doctor/room-graph-density-module.cjs -- Phase 232.1 Plan 01
 * (D-01/D-02/D-03/D-05/D-06/D-08).
 *
 * WHAT check() DOES: reads ~/MindrianRooms/.rooms/registry.json
 * (MINDRIAN_ROOMS_HOME override honored via shared.readRegistry) and, for every
 * registered room, counts the rows in that room.db's `nodes` and `edges` tables.
 * Returns the per-room counts plus a system-wide total. This is the census
 * SEED-074 gates on: the number it needs becomes self-reported instead of
 * something a human has to go measure by hand.
 *
 * Contract: check(ctx) -> { status:'ok'|'skip', detail, rooms, totals }. There is
 * NO fix(ctx) and no `fix` export of any kind -- a count is check-only, there is
 * nothing to repair about a measurement, and contract-parity rule 8 fails the
 * suite if a fix_supported:false module exports one.
 *
 * Canon Part 9: room.db is reached ONLY through the navigation chokepoint. This
 * module uses openRoomDbReadOnlyForCaller (Phase 232.1's new read-only sibling
 * door), NEVER openRoomDbForCaller. That is D-04's central correction: the older
 * door delegates to room-db.cjs::openRoomDb, which mkdirSync's .mindrian/, runs
 * 13 CREATE TABLE IF NOT EXISTS statements and 5 migrations on EVERY open
 * (reproduced empirically in 232.1-RESEARCH.md Pitfall 1, with a before/after
 * schema diff on a copy of a real room). A census through it would silently
 * migrate every registered room the first time doctor ran. This module must
 * never mutate what it measures, so it opens read-only and lets SQLite reject
 * writes mechanically.
 *
 * Canon Part 7 (reuse before build): lib/core/lazygraph-ops.cjs::graphStats
 * already computes this same underlying truth, and the reuse question was asked
 * and answered rather than missed. It cannot be called directly here for four
 * reasons (232.1-RESEARCH.md "Don't Hand-Roll"): (1) wrong reach -- graphStats is
 * single-room, this needs a census across every registered room; (2) wrong door
 * -- it reaches room.db via lazygraph.openGraph, which check-substrate.cjs flags
 * as an opengraph-bypass and which trips the same mutation problem as D-04;
 * (3) wrong shape -- it is async, and the doctor accumulative engine calls
 * checkFn(ctx) synchronously, so an async runner cannot join the registry
 * without an engine change D-02 forbids; (4) wrong grain -- it returns a
 * per-node-type and per-edge-type breakdown, which is the shape of a salience
 * report and edges toward exactly the framing D-06 forbids. What is reused is
 * the truth graphStats itself computes: two count(*) statements over the two
 * generic tables lazygraph-ops.cjs::initSchema creates. Registry enumeration is
 * reused wholesale from shared.cjs::readRegistry; resolveRoomPath is copied
 * verbatim from cascade-rooms-module.cjs (which does not export it).
 *
 * ctx.home is deliberately NOT consulted. shared.cjs::readRegistry takes zero
 * arguments and honors only MINDRIAN_ROOMS_HOME, which means the contract-parity
 * test's scratch ctx.home is ignored and the sweep reads the real registry. That
 * is exactly what cascade-rooms-module.cjs already does today and is accepted
 * behavior. 232.1-RESEARCH.md's Pitfall 2 flagged it because, combined with the
 * mutating door, it would have migrated the developer's real rooms on every
 * npm test; with the read-only door that risk is gone and the residual gap is
 * cosmetic. Closing it would introduce an unproven roomsHome-vs-home path-join
 * ambiguity across every module that shares readRegistry, so it is left as a
 * documented follow-up rather than attempted here.
 *
 * Canon Part 8: pure LOCAL SQLite reads. Zero network, zero Brain, zero
 * telemetry. Never back-requires the doctor CLI (circular).
 *
 * Threat register (Phase 232.1): T-232.1-01 (tampering) -- the read-only door
 * above is the mitigation, pinned by the byte-identical sqlite_master + mtimeMs
 * regression in tests/test-232.1-room-graph-density.cjs. T-232.1-02 (tampering)
 * -- the per-room try wraps the resolveRoomPath call ITSELF, so a corrupt
 * registry entry (e.g. a non-string path) soft-fails that one room instead of
 * throwing out of the loop. T-232.1-03 (self-DoS, the Phase 217 T-217-01 guard)
 * -- one bad room never aborts the sweep. T-232.1-04 (information disclosure) --
 * rooms[] carries room NAMES and counts only; filesystem paths are deliberately
 * never put in the payload. T-232.1-05 (SQL tampering) -- not reachable: both
 * statements concatenate only the two hardcoded literals 'nodes' and 'edges',
 * never a registry-, room- or user-derived value.
 *
 * D-06: status is NEVER 'warn', no matter what the counts are, and no rendered
 * string carries a health or size adjective (dense, sparse, density, risk,
 * healthy, low, high). A count is a measurement, not a drift signal. There is no
 * threshold in this phase; the threshold IS SEED-074's gate, which this phase
 * deliberately does not open. A 'warn' would also inflate the drift tally and
 * print the "run /mos:doctor --fix" next-move block for a module with no fix.
 */

const path = require('node:path');

const { readRegistry } = require('./shared.cjs');

// The allow-list-safe substrate reach from inside lib/core/doctor/: this
// directory is NOT on check-substrate.cjs's ALLOWED_DIRECT_IMPORT, so it may
// never require node:sqlite or room-db.cjs. lib/core/navigation/ is, and the
// read-only door lives there. Same reach umbilical-module.cjs already makes.
const {
  openRoomDbReadOnlyForCaller,
  closeRoomDbForCaller,
} = require('../navigation/spine-events.cjs');

// resolveRoomPath(roomsHome, info) -> absolute room dir path. Copied verbatim
// from cascade-rooms-module.cjs:52-56, which does NOT export it: an absolute
// registry `path` is used as-is, else joined against roomsHome; null when
// info/path is absent so callers skip the entry identically.
function resolveRoomPath(roomsHome, info) {
  const relPath = info && info.path;
  if (!relPath) return null;
  return path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
}

// countTable(db, table) -> row count, or 0 on any throw. The repo's own idiom
// for treating a failed query as "no rows" (umbilical-module.cjs:302-309); here
// it is also D-05's schema-less case, since a room.db opened read-only may have
// no `nodes`/`edges` tables at all and node:sqlite throws "no such table".
// `table` is only ever one of the two fixed literals below, never any input, so
// the string concatenation carries no injection surface.
function countTable(db, table) {
  try {
    return db.prepare('SELECT count(*) AS c FROM ' + table).get().c;
  } catch (_e) {
    return 0;
  }
}

// check(ctx) -- read-only per-room row census. NEVER mutates.
function check(_ctx) {
  const reg = readRegistry();
  if (!reg) {
    return {
      status: 'skip',
      detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)',
      rooms: [],
      totals: { rooms: 0, nodes: 0, edges: 0 },
    };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  const out = [];
  let totalNodes = 0;
  let totalEdges = 0;

  for (const name of Object.keys(rooms)) {
    let db = null;
    try {
      // Inside the try on purpose (T-232.1-02): a malformed registry entry must
      // soft-fail this room, not throw out of the sweep.
      const roomPath = resolveRoomPath(roomsHome, rooms[name]);
      if (!roomPath) continue;
      db = openRoomDbReadOnlyForCaller(roomPath);
      if (!db) {
        // D-05: no room.db yet is the NORMAL Tier 0 case, not an error.
        out.push({ room: name, node_count: 0, edge_count: 0, has_db: false });
        continue;
      }
      const n = countTable(db, 'nodes');
      const e = countTable(db, 'edges');
      totalNodes += n;
      totalEdges += e;
      out.push({ room: name, node_count: n, edge_count: e, has_db: true });
    } catch (_e) {
      // T-232.1-03 / T-217-01 self-DoS guard: one bad room never aborts the sweep.
      out.push({ room: name, node_count: 0, edge_count: 0, has_db: false, unreadable: true });
    } finally {
      closeRoomDbForCaller(db);
    }
  }

  return {
    // NEVER 'warn' (D-06). The sweep completed; the numbers are the report.
    status: 'ok',
    detail: out.length + ' room(s) measured: ' + totalNodes + ' node row(s), '
      + totalEdges + ' edge row(s)',
    rooms: out,
    totals: { rooms: out.length, nodes: totalNodes, edges: totalEdges },
  };
}

module.exports = { check };
