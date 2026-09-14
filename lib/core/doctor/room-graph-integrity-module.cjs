'use strict';
/*
 * lib/core/doctor/room-graph-integrity-module.cjs -- Phase 343 Plan 02, Task 2.
 *
 * WHAT check() DOES: measures the bound room by default (every registered
 * room plus fleet totals under ctx.flags.cascadeRooms) against the four
 * measurable defect statements plus the unresolved-CONTRADICTS and
 * self-referencing-edge counts this phase ships (see
 * lib/core/navigation/graph-integrity-counts.cjs for every statement's SQL
 * and the two ghosted not-measurable records). Reports raw counts only.
 *
 * Contract: check(ctx) -> { status:'ok'|'skip', detail, scope, rooms, ... }.
 * `status` is NEVER 'warn', no matter how large a count is. There is NO
 * fix(ctx) and no `fix` export of any kind -- a count is check-only, there
 * is nothing to repair about a measurement, and
 * tests/test-doctor-module-contract-parity.cjs rule 8 fails the suite if a
 * fix_supported:false module (the registry row this plan adds to
 * data/doctor-modules.json) exports one.
 *
 * The nine counts-only rules (five copied verbatim from this file's own
 * sibling Phase 232.1 per-room row-count organ's docblock, four added by
 * this organ's own shape; the test enforces all nine): see the header of
 * lib/core/navigation/graph-integrity-counts.cjs, which states them in full.
 * This file adds nothing to that list; it only assembles the per-room sweep,
 * the scope rule, and the totals.
 *
 * Canon Part 9: room.db is reached ONLY through the navigation chokepoint's
 * READ-ONLY door, openRoomDbReadOnlyForCaller, NEVER
 * openRoomDbForCaller. The mutating door delegates to room-db.cjs::openRoomDb,
 * which mkdirSync's .mindrian/, runs 13 table-creation statements (each an
 * IF-NOT-EXISTS guard) and 5 migrations on EVERY open (232.1-RESEARCH.md
 * Pitfall 1, reproduced empirically with a before/after schema diff). A
 * sweep through it would
 * silently migrate every registered room the first time doctor ran. This
 * module must never mutate what it measures, so it opens read-only and lets
 * SQLite reject writes mechanically.
 *
 * lib/core/doctor/ is NOT on scripts/check-substrate.cjs's
 * ALLOWED_DIRECT_IMPORT list, so this file may never require node:sqlite or
 * room-db.cjs directly. lib/core/navigation/ IS allow-listed by path regex,
 * so the read-only door and the statement home both live there and need zero
 * allow-list edit.
 *
 * WD-3: this organ reuses the shipped ctx.flags.cascadeRooms flag rather than
 * minting a doctor flag of its own (the graph-derive-health-module.cjs
 * precedent). No scripts/doctor.cjs parseArgs edit.
 *
 * Threat register (T-343-01, T-343-02, T-343-04, T-343-10, T-343-23,
 * T-343-24, T-343-11 -- see this plan's own PLAN.md threat_model table for
 * the full disposition and mitigation text):
 *   T-343-01 (tampering, the fleet sweep) -- openRoomDbReadOnlyForCaller
 *     only, which opens file:<path>?mode=ro so SQLite rejects writes
 *     mechanically; pinned by the byte-identical sqlite_master plus mtimeMs
 *     regression in tests/test-343-room-graph-integrity.cjs.
 *   T-343-02 (information disclosure, the payload) -- room NAMES and
 *     integers only. No node id, no filesystem path, no claim text; pinned
 *     by a test that walks every string value in the payload.
 *   T-343-04 (self-DoS) -- the per-room try wraps resolveRoomPath itself, so
 *     a non-string registry path soft-fails that room only; pinned by a
 *     malformed-entry fixture.
 *   T-343-10 (SQL tampering) -- every table/column name in the statement
 *     home is a fixed literal and every window is a bound `?` parameter.
 *   T-343-23 (information disclosure, edge_types_outside_allowlist) -- the
 *     one payload field carrying a string read out of a room database is
 *     shape-filtered and capped in the statement home.
 *   T-343-24 (tampering of meaning) -- the statement home requires
 *     ALLOWED_EDGE_TYPES rather than copying it, so the measurement can
 *     never drift from the rule it measures.
 *   T-343-11 (false clean result) -- a column-dependent statement on a
 *     legacy schema reports null plus schema_variant, never 0.
 */

const path = require('node:path');

const { readRegistry } = require('./shared.cjs');

// The allow-list-safe substrate reach from inside lib/core/doctor/: this
// directory may never require node:sqlite or room-db.cjs. lib/core/navigation/
// is allow-listed and the read-only door lives there. Same reach
// the Phase 232.1 sibling organ and umbilical-module.cjs already make.
const {
  openRoomDbReadOnlyForCaller,
  closeRoomDbForCaller,
} = require('../navigation/spine-events.cjs');

const {
  countGraphIntegrity,
  schemaVariant,
  NOT_MEASURABLE,
  WRITER_NOTE,
} = require('../navigation/graph-integrity-counts.cjs');

// resolveRoomPath(roomsHome, info) -> absolute room dir path. NOT copied
// verbatim from cascade-rooms-module.cjs:52-56, which reads only `info.path`
// and silently under-counts any room registered with `abs_path` alone --
// that incorrect copy is still live there and is a separate quick task, not
// this phase's job. `abs_path` is the canonical, actively-used registry
// precedence field elsewhere in this codebase (lib/core/resolve-active-room.cjs's
// own doc comment; lib/mcp/tool-router.cjs honors it too). Precedence:
// abs_path (used as-is) -> path (absolute as-is, else joined against
// roomsHome) -> null when neither is present, so callers skip the entry
// identically either way.
function resolveRoomPath(roomsHome, info) {
  if (info && typeof info.abs_path === 'string' && info.abs_path.length > 0) {
    return info.abs_path;
  }
  const relPath = info && info.path;
  if (typeof relPath !== 'string' || relPath.length === 0) return null;
  return path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
}

// The integer count fields this organ sums into fleet totals. Deliberately a
// fixed literal list (never derived from a room's own keys), so a stray key
// from a future statement never silently rides the totals unreviewed.
const INTEGER_FIELDS = [
  'edge_rows_missing_endpoint',
  'claim_nodes_no_anchor_total',
  'claim_nodes_no_anchor_legacy',
  'claim_nodes_no_anchor_new',
  'claim_nodes_within_grace_window',
  'proposed_nodes_past_window',
  'contradicts_edges',
  'self_referencing_edges',
  'edge_rows_type_outside_allowlist',
];

// measureRoom(roomPath) -> the per-room payload, or { has_db:false } when
// <roomPath>/.mindrian/room.db does not exist (Tier 0, the normal cold-start
// case, never an error). Opens read-only; closes in a finally.
function measureRoom(roomPath) {
  let db = null;
  try {
    db = openRoomDbReadOnlyForCaller(roomPath);
    if (!db) {
      return { has_db: false };
    }
    // schemaVariant is read once here (not only inferred from
    // countGraphIntegrity's own schema_variant field) so this organ's
    // per-room record is self-evidently consistent with the statement
    // home's own variant probe.
    const variant = schemaVariant(db);
    const counts = countGraphIntegrity(db);
    return Object.assign({ has_db: true, schema_variant: variant }, counts);
  } finally {
    closeRoomDbForCaller(db);
  }
}

// sumField(rooms, field) -> { sum, notMeasurableCount }. A null value for a
// field is EXCLUDED from the sum (never coerced to 0) and increments the
// parallel not-measurable counter, so a schema that cannot answer never
// silently reads as a zero contribution.
function sumField(rooms, field) {
  let sum = 0;
  let notMeasurableCount = 0;
  for (const room of rooms) {
    const v = room[field];
    if (v === null || v === undefined) {
      if (Object.prototype.hasOwnProperty.call(room, field)) notMeasurableCount += 1;
      continue;
    }
    if (typeof v === 'number') sum += v;
  }
  return { sum, notMeasurableCount };
}

// unionEdgeTypeNames(rooms) -> the deduplicated, sorted, shape-filtered,
// capped union of every room's edge_types_outside_allowlist, re-filtered and
// re-capped after the union (never a per-room concatenation: the same
// offending type present in ten rooms is one name, not ten).
const EDGE_TYPE_NAME_SHAPE = /^[A-Z][A-Z0-9_]*$/;
const EDGE_TYPE_NAME_CAP = 20;

function unionEdgeTypeNames(rooms) {
  const names = new Set();
  let perRoomUnnameable = 0;
  for (const room of rooms) {
    const list = room.edge_types_outside_allowlist;
    if (Array.isArray(list)) {
      for (const n of list) {
        if (typeof n === 'string' && EDGE_TYPE_NAME_SHAPE.test(n)) names.add(n);
      }
    }
    if (typeof room.edge_types_outside_allowlist_unnameable === 'number') {
      perRoomUnnameable += room.edge_types_outside_allowlist_unnameable;
    }
  }
  const sorted = Array.from(names).sort();
  const capped = sorted.slice(0, EDGE_TYPE_NAME_CAP);
  const overflow = Math.max(0, sorted.length - EDGE_TYPE_NAME_CAP);
  return {
    names: capped,
    // The union's own overflow plus every room's already-excluded distinct
    // count (malformed-shape names never entered the union at all).
    unnameable: overflow + perRoomUnnameable,
  };
}

function buildTotals(rooms) {
  const totals = {};
  for (const field of INTEGER_FIELDS) {
    const { sum, notMeasurableCount } = sumField(rooms, field);
    totals[field] = sum;
    if (notMeasurableCount > 0) totals[field + '_not_measurable_rooms'] = notMeasurableCount;
  }
  const edgeTypes = unionEdgeTypeNames(rooms);
  totals.edge_types_outside_allowlist = edgeTypes.names;
  totals.edge_types_outside_allowlist_unnameable = edgeTypes.unnameable;
  return totals;
}

function buildDetail(scope, rooms, totals) {
  const measured = rooms.filter((r) => r.has_db !== false);
  if (measured.length === 0) {
    return scope + ' scope: no room.db measured (Tier 0 or no rooms in scope)';
  }
  return measured.length + ' room(s) measured (' + scope + '): '
    + totals.edge_rows_missing_endpoint + ' edge row(s) with a missing endpoint, '
    + totals.claim_nodes_no_anchor_total + ' claim node(s) with no provenance out-edge, '
    + totals.proposed_nodes_past_window + ' proposed node(s) past the review window';
}

/**
 * check(ctx) -- read-only room-graph integrity measurement. NEVER mutates,
 * NEVER returns 'warn'.
 *
 * @param {object} ctx - { flags: { cascadeRooms?: boolean } }
 * @returns {object} { status, detail, scope, rooms, totals, not_measurable, writer_note }
 */
function check(ctx) {
  const c = ctx || {};
  const cascade = !!(c.flags && c.flags.cascadeRooms);
  const scope = cascade ? 'fleet' : 'active-room';

  const reg = readRegistry();
  if (!reg) {
    return {
      status: 'skip',
      detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)',
      scope,
      rooms: [],
      not_measurable: NOT_MEASURABLE,
      writer_note: WRITER_NOTE,
    };
  }

  const roomsHome = reg.roomsHome;
  const registeredRooms = (reg.registry && reg.registry.rooms) || {};
  const activeName = (reg.registry && reg.registry.active) || null;

  let names;
  if (cascade) {
    names = Object.keys(registeredRooms);
  } else if (activeName && registeredRooms[activeName]) {
    names = [activeName];
  } else {
    return {
      status: 'skip',
      detail: 'no active room in the registry; nothing in scope for room-graph-integrity',
      scope: 'active-room',
      rooms: [],
      not_measurable: NOT_MEASURABLE,
      writer_note: WRITER_NOTE,
    };
  }

  const rooms = [];
  for (const name of names) {
    try {
      // Inside the try on purpose (T-343-04): a malformed registry entry
      // must soft-fail this room, not throw out of the sweep.
      const roomPath = resolveRoomPath(roomsHome, registeredRooms[name]);
      if (!roomPath) continue;
      const measured = measureRoom(roomPath);
      rooms.push(Object.assign({ room: name }, measured));
    } catch (_e) {
      // T-343-04 / T-217-01 self-DoS guard: one bad room never aborts the sweep.
      rooms.push({ room: name, has_db: false, unreadable: true });
    }
  }

  const totals = buildTotals(rooms.filter((r) => r.has_db !== false));
  const detail = buildDetail(scope, rooms, totals);

  return {
    // NEVER 'warn'. The sweep completed; the numbers are the report.
    status: 'ok',
    detail,
    scope,
    rooms,
    totals,
    schema_variants: rooms
      .filter((r) => r.has_db !== false)
      .map((r) => ({ room: r.room, schema_variant: r.schema_variant })),
    not_measurable: NOT_MEASURABLE,
    writer_note: WRITER_NOTE,
  };
}

module.exports = { check };
