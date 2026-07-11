'use strict';
/*
 * lib/core/doctor/cascade-rooms-active-module.cjs -- Phase 217 Plan 04 (D-01/D-02).
 *
 * The class-C "cascade-rooms-active" doctor check, migrated out of the doctor CLI
 * inline main() block into a registry-driven cadence:always runner. Check-only
 * (fix_supported:false -- class C --fix was deferred at Phase 95.1 and stays so).
 *
 * WHAT IT DOES: the active-room guard silence detector. Reads the registry for the
 * active room; when --simulate-write=<path> is provided (ctx.flags.simulateWrite),
 * walks up from that path for a `.room-root` sentinel; when it is not, routes the
 * cwd through the SINGLE umbilical/room target resolver. If the resolved write room
 * differs from the registry's active room, reports the mismatch -- writes there
 * would be SILENCED by scripts/post-write's active-room guard before the cascade
 * side-channel runs.
 *
 * PITFALL-5 SIGNATURE REFACTOR: the pre-migration checkCascadeRoomsActive took a
 * POSITIONAL simulateWritePath argument. The registry runner contract is check(ctx),
 * so the positional arg is remapped off ctx: the flag is read from
 * ctx.flags.simulateWrite (the parseArgs seam) with a bare ctx.simulateWrite
 * fallback for direct/hermetic callers.
 *
 * Contract: check(ctx) -> { status:'ok'|'warn'|'skip'|'error', detail, activeRoom,
 *   writeRoom, activeMismatch? }. Every path carries a non-empty detail (D-03 rule 9).
 *   NO fix export (fix_supported:false; the contract-parity gate enforces the
 *   two-way declaration parity).
 *
 * Canon Part 8: pure LOCAL read -- zero network, zero Brain. Never back-requires the
 * doctor CLI (circular). Requires node built-ins + ./shared.cjs (readRegistry,
 * findRoomRoot) + ../resolve-umbilical-target.cjs (the ONE cwd->room resolver).
 */

const path = require('node:path');

const { readRegistry, findRoomRoot } = require('./shared.cjs');
const { resolveUmbilicalTarget } = require('../resolve-umbilical-target.cjs');

function check(ctx) {
  const c = ctx || {};
  // Pitfall-5: the old positional simulateWritePath arg, remapped off ctx.
  const simulateWrite = (c.flags && c.flags.simulateWrite) || c.simulateWrite || null;

  const reg = readRegistry();
  if (!reg) {
    return { status: 'skip', detail: 'no registry; class C scoped to active room', activeRoom: null, writeRoom: null };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  const activeName = (reg.registry && reg.registry.active) || null;
  // Decide which path to inspect for the "current write" room.
  //   --simulate-write branch (UNCHANGED -- tests rely on it): walk up from the
  //   simulated path for a .room-root sentinel. findRoomRoot expects a FILE path,
  //   so append a dummy basename.
  //   cwd branch (Phase 139 Plan-01 S1 WHERE fix): route through the SINGLE
  //   umbilical/room target resolver instead of a bare process.cwd() probe. If the
  //   resolver returns null (cwd is not a room), SKIP -- doctor must NOT walk up
  //   from a raw cwd and must NOT scaffold into a plain code repo.
  let writeRoomDir = null;
  if (simulateWrite) {
    const probePath = path.join(simulateWrite, '__doctor_probe__');
    try { writeRoomDir = findRoomRoot(probePath); }
    catch (err) { return { status: 'error', detail: err.message, activeRoom: activeName, writeRoom: null }; }
  } else {
    let resolved = null;
    try { resolved = resolveUmbilicalTarget(); }
    catch (err) { return { status: 'error', detail: err.message, activeRoom: activeName, writeRoom: null }; }
    if (!resolved) {
      return {
        status: 'skip',
        detail: 'no umbilical/sentinel/registry target from cwd',
        activeRoom: activeName,
        writeRoom: null,
      };
    }
    writeRoomDir = resolved.abs_path;
  }
  if (!writeRoomDir) {
    // No room sentinel found above the probe path -- write is outside any Data
    // Room, so the active-room guard does not apply.
    return {
      status: 'ok',
      detail: 'write path is outside any Data Room; active-room guard does not apply',
      activeRoom: activeName,
      writeRoom: null,
      activeMismatch: false,
    };
  }
  // Resolve the active-room absolute path.
  let activePath = null;
  if (activeName && rooms[activeName] && rooms[activeName].path) {
    const relPath = rooms[activeName].path;
    activePath = path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
  }
  // Map writeRoomDir back to a known room name when possible.
  let writeRoomName = null;
  for (const name of Object.keys(rooms)) {
    const info = rooms[name];
    const relPath = info && info.path;
    if (!relPath) continue;
    const roomPath = path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
    try {
      if (path.resolve(roomPath) === path.resolve(writeRoomDir)) { writeRoomName = name; break; }
    } catch (_) { /* fall through */ }
  }
  if (!writeRoomName) writeRoomName = path.basename(writeRoomDir);
  // Compare write room against active room.
  if (activePath && path.resolve(activePath) === path.resolve(writeRoomDir)) {
    return {
      status: 'ok',
      detail: 'write room ' + writeRoomName + ' matches active room; no silence',
      activeRoom: activeName,
      writeRoom: writeRoomName,
      activeMismatch: false,
    };
  }
  return {
    status: 'warn',
    activeRoom: activeName,
    writeRoom: writeRoomName,
    activeMismatch: true,
    detail: 'writes to ' + writeRoomName + ' would be silenced (active=' + (activeName || 'none') + ')',
  };
}

module.exports = {
  check,
};
