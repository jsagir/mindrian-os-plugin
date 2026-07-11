'use strict';
/*
 * lib/core/doctor/cascade-rooms-module.cjs -- Phase 217 Plan 04 (D-01/D-02/D-04).
 *
 * The class-B "cascade-rooms" doctor check, migrated out of the doctor CLI
 * inline main() block into a registry-driven cadence:always runner -- AND the
 * headline of this phase: its --fix, which commands/doctor.md has advertised
 * since Phase 95.1 but which was NEVER wired (RCA
 * .planning/debug/doctor-fix-class-b-unwired.md), is implemented for real here
 * as fix(ctx). This makes the doc claim TRUE in code (D-04's preferred
 * resolution) instead of deleting it.
 *
 * WHAT check() DOES: reads ~/MindrianRooms/.rooms/registry.json (MINDRIAN_ROOMS_HOME
 * override honored via shared.readRegistry) and, for every registered room, verifies
 * a `.room-root` sentinel exists at the room's resolved path. Rooms whose dir is
 * missing OR whose sentinel is missing land in missingSentinels[].
 *
 * WHAT fix() DOES (THE NEW WIRING): for each name the just-run check surfaced in
 * check_result.missingSentinels, resolves the room path exactly as check does
 * (registry relPath joined against roomsHome). Two cases:
 *   (a) room dir EXISTS but .room-root missing -> CREATE the sentinel, mirroring
 *       the canonical room-creation writer (lib/core/room-auto-create.cjs:198 --
 *       an empty file, mode 0o644). Honors ctx.dryRun (counts, writes nothing).
 *   (b) room dir itself MISSING -> do NOT create directories (that is room
 *       restoration, not sentinel repair). Push onto suggested[] with a note.
 *
 * Contract: check(ctx) -> { status:'ok'|'warn'|'skip', detail, missingSentinels,
 *   okCount }. fix(ctx) -> { status, projected, suggested, errors, detail } per
 *   the umbilical fix(ctx) contract (dryRun honored, per-item counters, detail on
 *   every path).
 *
 * Canon Part 8: pure LOCAL scan + local sentinel writes -- zero network, zero
 * Brain, zero telemetry. Never back-requires the doctor CLI (circular). Requires
 * only node built-ins + ./shared.cjs (readRegistry).
 *
 * Threat register (Phase 217 Plan 04): T-217-03 (path tampering) -- fix resolves
 * room paths exactly as check does (roomsHome join + existsSync), never creates
 * directories, honors dryRun, and writes ONLY the literal '.room-root' filename,
 * never a caller-supplied path. T-217-01 (self-DoS) -- per-room try/catch so one
 * bad room soft-fails without aborting the sweep.
 */

const fs = require('node:fs');
const path = require('node:path');

const { readRegistry } = require('./shared.cjs');

// resolveRoomPath(roomsHome, info) -> absolute room dir path, mirroring the
// pre-migration check resolution EXACTLY: an absolute registry `path` is used
// verbatim, else it is joined against roomsHome. Returns null when info/path is
// absent so callers can skip the entry identically to the old walk.
function resolveRoomPath(roomsHome, info) {
  const relPath = info && info.path;
  if (!relPath) return null;
  return path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
}

// check(ctx) -- read-only sentinel scan. NEVER mutates.
function check(_ctx) {
  const reg = readRegistry();
  if (!reg) {
    return {
      status: 'skip',
      detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)',
      missingSentinels: [],
      okCount: 0,
    };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  const missingSentinels = [];
  let okCount = 0;
  for (const name of Object.keys(rooms)) {
    const roomPath = resolveRoomPath(roomsHome, rooms[name]);
    if (!roomPath) continue;
    if (!fs.existsSync(roomPath)) {
      // Room directory itself missing -- treat as missing sentinel for class B.
      missingSentinels.push(name);
      continue;
    }
    if (fs.existsSync(path.join(roomPath, '.room-root'))) {
      okCount += 1;
    } else {
      missingSentinels.push(name);
    }
  }
  if (missingSentinels.length === 0) {
    // D-03 rule 9: every path carries a non-empty detail (the pre-migration ok
    // return had none). Report how many rooms carry their sentinel.
    return {
      status: 'ok',
      detail: okCount + ' room(s) carry .room-root',
      missingSentinels: [],
      okCount,
    };
  }
  return {
    status: 'warn',
    missingSentinels,
    okCount,
    detail: missingSentinels.length + ' room(s) missing .room-root sentinel',
  };
}

// fix(ctx) -- THE NEW CLASS-B WIRING. Reads ctx.check_result (the just-run check
// result the engine passes) and repairs missing sentinels for rooms whose dir
// exists; suggests rooms whose dir is missing. Honors ctx.dryRun. Soft-fail per
// room.
function fix(ctx) {
  const c = ctx || {};
  const dryRun = !!c.dryRun;
  const checkResult = c.check_result || {};
  const names = Array.isArray(checkResult.missingSentinels) ? checkResult.missingSentinels : [];

  let projected = 0;
  const suggested = [];
  const errors = [];

  // Resolve room paths from the SAME registry the check read, exactly as check
  // resolves them (roomsHome join). No registry -> nothing to repair.
  const reg = readRegistry();
  if (!reg) {
    return {
      status: 'skip',
      projected: 0,
      suggested: [],
      errors: [],
      detail: 'cascade-rooms fix: no registry to resolve room paths against',
    };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};

  for (const name of names) {
    const roomPath = resolveRoomPath(roomsHome, rooms[name]);
    if (!roomPath) {
      // Registry no longer carries a path for this name -- cannot resolve.
      suggested.push({ room: name, reason: 'no registry path, not resolvable' });
      continue;
    }
    try {
      if (!fs.existsSync(roomPath)) {
        // Case (b): room dir itself missing. Do NOT create directories -- that is
        // room restoration, not sentinel repair (T-217-03).
        suggested.push({ room: name, reason: 'room dir missing, not auto-created' });
        continue;
      }
      // Case (a): dir exists, sentinel missing.
      const sentinelPath = path.join(roomPath, '.room-root');
      if (fs.existsSync(sentinelPath)) {
        // Already present (a concurrent creator, or check/fix skew) -- nothing to do.
        continue;
      }
      if (dryRun) {
        // Report-only: would create the sentinel, write nothing.
        projected += 1;
        continue;
      }
      // Mirror the canonical room-creation writer (room-auto-create.cjs:198): an
      // empty sentinel file, mode 0o644. Writes ONLY the literal filename.
      fs.writeFileSync(sentinelPath, '', { mode: 0o644 });
      projected += 1;
    } catch (e) {
      errors.push({ room: name, reason: String((e && e.message) || e).slice(0, 80) });
    }
  }

  const status = errors.length > 0 ? 'warn' : 'ok';
  return {
    status,
    projected,
    suggested,
    errors,
    detail: 'cascade-rooms fix: '
      + projected + ' sentinel(s) ' + (dryRun ? 'would be created' : 'created') + '; '
      + suggested.length + ' suggested; '
      + errors.length + ' error(s)' + (dryRun ? ' (dry-run)' : ''),
  };
}

module.exports = {
  check,
  fix,
};
