'use strict';
/*
 * lib/core/doctor/eureka-fts-health-module.cjs -- Phase 244 Plan 06 (closing
 * ROADMAP SC1: "a presence/freshness check added to `node scripts/doctor.cjs
 * --acceptance`, so an unbuilt index is visible rather than silently
 * producing zero fires").
 *
 * WHAT check() DOES: reads ~/MindrianRooms/.rooms/registry.json
 * (MINDRIAN_ROOMS_HOME override honored via shared.cjs::readRegistry) and,
 * for every registered room, classifies that room's `eureka_fts` lexical
 * index through lib/core/eureka/fts-index-lifecycle.cjs::ftsIndexState.
 * Returns the per-room classification plus a system-wide total. This is the
 * visibility 244-RESEARCH.md's BLOCKER B-2 named: the index does not exist
 * in real rooms today (verified live against the 8.4 MB `rethinking-mindrianos`
 * room.db, zero eureka_fts rows), its only callers before Plan 02 were manual
 * report scripts, and without a doctor check TRIG-01 could ship green and
 * fire zero times in production -- the exact symptom that opened this phase.
 *
 * FOUR THINGS this header must state (mirroring room-graph-density-module.cjs's
 * own contract-header discipline, `:12-27`):
 *
 * (1) Contract: check(ctx) -> { status, detail, rooms, totals }. Check-only.
 *     There is NO fix(ctx) and no `fix` export of any kind: an unbuilt or
 *     stale index is repaired by Plan 02's lazy build-on-first-miss
 *     (requestFtsBuild + spawnFtsBuildDrain), never by the doctor, and
 *     contract-parity rule 8 (tests/test-doctor-module-contract-parity.cjs)
 *     fails the suite if a fix_supported:false module exports one anyway.
 *
 * (2) Canon Part 9: room.db is reached ONLY through the navigation
 *     chokepoint. This module uses openRoomDbReadOnlyForCaller and NEVER the
 *     writable sibling door (the one room-graph-density-module.cjs's own
 *     header names as forbidden here), because that older door delegates to
 *     room-db.cjs::openRoomDb, which mkdirSync's `.mindrian/` and runs
 *     CREATE-TABLE-IF-NOT-EXISTS clauses and migrations on EVERY open.
 *
 * (3) Why the read-only door matters MORE here than anywhere else in this
 *     directory: a check that measures "does eureka_fts exist" must not be
 *     the thing that creates it. If opening a room for measurement also
 *     created the table, every room would read "present" on the very next
 *     doctor run regardless of whether a real build ever happened -- the
 *     measurement would be self-fulfilling and would hide the exact defect
 *     (BLOCKER B-2) this check exists to surface. A doctor that creates what
 *     it measures is worse than no doctor.
 *
 * (4) Status-vocabulary difference from the 232.1 D-06 rule: room-graph-
 *     density-module.cjs `:174-176` says status is NEVER 'warn' (D-06),
 *     because a pure row count has nothing to warn about. THIS module is a
 *     HEALTH check, not a census -- graph-derive-health-module.cjs (which
 *     legitimately warns on "BELONGS_TO present with zero cascade edges") is
 *     the right analog, not room-graph-density. A STALE index (rows pointing
 *     at deleted nodes, the ghost-trigger condition) is a real defect and
 *     warrants 'warn'. An ABSENT index does NOT warrant 'warn': absent is the
 *     correct pre-lazy-build default state of every room today. D-06 is not
 *     a universal rule; it applies to a pure census, and this module is not
 *     one.
 *
 * Canon Part 7 (reuse before build): resolveRoomPath is copied verbatim from
 * room-graph-density-module.cjs -- this directory's established convention
 * (stated explicitly at graph-derive-health-module.cjs `:110`, since neither
 * module exports it for a sibling to import). ftsIndexState itself is NOT
 * re-implemented here: it is required directly from
 * lib/core/eureka/fts-index-lifecycle.cjs (Plan 02), so classification has
 * exactly one owner and this module can never drift from it.
 *
 * Threat register (Phase 244): T-244-23 (tampering) -- the read-only door
 * above is the mitigation, source-gated and fenced by a permanent
 * before/after sqlite_master comparison in
 * tests/test-244-doctor-fts-health.cjs. T-244-24 (denial of service) -- the
 * per-room try wraps resolveRoomPath itself, so one malformed registry entry
 * soft-fails that ONE room and never aborts the sweep (the T-217-01 self-DoS
 * pattern). T-244-25 (repudiation / false success) -- the per-room census is
 * emitted in `detail` and `rooms` on the PASSING path too, so an absent
 * index is reported rather than merely not-failed. T-244-27 (information
 * disclosure) -- rooms[] carries room NAMES, row counts and closed state
 * enums only; no node text, no artifact bodies, no turn prose.
 *
 * No em-dashes anywhere (CLAUDE.md hard rule).
 */

const fs = require('node:fs');
const path = require('node:path');

const { readRegistry } = require('./shared.cjs');
const { ftsIndexState } = require('../eureka/fts-index-lifecycle.cjs');

// The allow-list-safe substrate reach from inside lib/core/doctor/: this
// directory is NOT on check-substrate.cjs's ALLOWED_DIRECT_IMPORT, so it may
// never require node:sqlite or room-db.cjs directly. lib/core/navigation/ is,
// and the read-only door lives there. Same reach room-graph-density-module.cjs
// and graph-derive-health-module.cjs already make.
const {
  openRoomDbReadOnlyForCaller,
  closeRoomDbForCaller,
} = require('../navigation/spine-events.cjs');

// The largest failure log this module will even attempt to parse. Mirrors
// graph-derive-health-module.cjs's MAX_FAILURE_LOG_BYTES guard for the same
// reason: a diagnostic must not spend its budget parsing a corrupt or hostile
// file, and a broken read must never fail the sweep (soft-fails to 0).
const MAX_FAILURE_LOG_BYTES = 1024 * 1024;

// resolveRoomPath(roomsHome, info) -> absolute room dir path. Copied verbatim
// from room-graph-density-module.cjs (this directory's established
// convention; neither module exports it for a sibling to import). Precedence:
// abs_path (used as-is) -> path (absolute as-is, else joined against
// roomsHome) -> null when neither is present, so callers skip the entry
// identically either way.
function resolveRoomPath(roomsHome, info) {
  if (info && typeof info.abs_path === 'string' && info.abs_path.length > 0) {
    return info.abs_path;
  }
  const relPath = info && info.path;
  if (!relPath) return null;
  return path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
}

// readFailureCount(roomPath) -> number of recorded permanent build failures
// in <roomPath>/.mindrian/fts-index-failures.json, 0 on any absence / oversize
// / parse error. Written by scripts/fts-index-drain.cjs when a build has
// exhausted FTS_BUILD_MAX_ATTEMPTS; this is the "stuck in permanent build
// failure" visibility the plan's action block calls for.
function readFailureCount(roomPath) {
  try {
    const p = path.join(roomPath, '.mindrian', 'fts-index-failures.json');
    if (!fs.existsSync(p)) return 0;
    const stat = fs.statSync(p);
    if (!stat.isFile() || stat.size > MAX_FAILURE_LOG_BYTES) return 0;
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && Array.isArray(parsed.failures)) return parsed.failures.length;
    return 0;
  } catch (_e) {
    return 0;
  }
}

// check(ctx) -- read-only per-room eureka_fts census + health classification.
// NEVER mutates a room.db. NEVER throws.
function check(_ctx) {
  const reg = readRegistry();
  if (!reg) {
    return {
      status: 'skip',
      detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)',
      rooms: [],
      totals: { rooms: 0, with_index: 0, absent: 0, empty: 0, stale: 0 },
    };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  const out = [];
  let withIndex = 0;
  let absent = 0;
  let empty = 0;
  let stale = 0;

  for (const name of Object.keys(rooms)) {
    let db = null;
    try {
      // Inside the try on purpose (T-244-24): a malformed registry entry must
      // soft-fail this room, not throw out of the sweep.
      const roomPath = resolveRoomPath(roomsHome, rooms[name]);
      if (!roomPath) continue;
      db = openRoomDbReadOnlyForCaller(roomPath);
      if (!db) {
        // D-05 convention: no room.db yet is the NORMAL Tier 0 case, not an
        // error, and classifies the same as index_absent (there is no index
        // to speak of yet either way).
        out.push({
          room: name,
          has_db: false,
          present: false,
          fts_rows: 0,
          node_rows: 0,
          orphan_rows: 0,
          state: 'index_absent',
          failure_count: readFailureCount(roomPath),
        });
        absent += 1;
        continue;
      }
      const s = ftsIndexState(db);
      out.push({
        room: name,
        has_db: true,
        present: s.present,
        fts_rows: s.fts_rows,
        node_rows: s.node_rows,
        orphan_rows: s.orphan_rows,
        state: s.reason,
        failure_count: readFailureCount(roomPath),
      });
      if (s.reason === 'index_stale') stale += 1;
      else if (s.reason === 'index_empty') empty += 1;
      else if (s.reason === 'index_absent') absent += 1;
      else if (s.reason === 'ok') withIndex += 1;
      // 'unavailable' (a closed/invalid handle) counts toward none of the
      // four buckets above; openRoomDbReadOnlyForCaller already returned a
      // real handle here, so this leg is defensive rather than expected.
    } catch (_e) {
      // T-244-24 / T-217-01 self-DoS guard: one bad room never aborts the
      // sweep.
      out.push({
        room: name,
        has_db: false,
        present: false,
        fts_rows: 0,
        node_rows: 0,
        orphan_rows: 0,
        state: 'unavailable',
        unreadable: true,
      });
    } finally {
      closeRoomDbForCaller(db);
    }
  }

  const anyStale = stale > 0;
  const staleNames = out.filter((r) => r.state === 'index_stale').map((r) => r.room);
  const totals = { rooms: out.length, with_index: withIndex, absent: absent, empty: empty, stale: stale };
  const detail = out.length + ' room(s) measured: ' + withIndex + ' with a built index, '
    + absent + ' absent (Tier 0 default, not a defect), ' + empty + ' empty, ' + stale + ' stale'
    + (anyStale ? ('; stale room(s): ' + staleNames.join(', ')) : '');

  return {
    // 'warn' on a genuine defect (a stale index carrying ghost rows for
    // deleted nodes). NEVER 'warn' on absence alone: absent is the correct
    // default state of every room today, per the fourth header point above.
    status: anyStale ? 'warn' : 'ok',
    detail: detail,
    rooms: out,
    totals: totals,
  };
}

module.exports = { check };
