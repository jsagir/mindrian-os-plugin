/**
 * MindrianOS Plugin -- Room Ops (shared pure logic)
 * ==================================================
 * Pure helpers with NO child_process I/O. Both room-ops-sync.cjs and
 * room-ops-async.cjs import from this file. If you need to add a helper
 * that calls execSync or execFile, put it in the sync or async entry
 * point, not here.
 *
 * Phase 87-04 sync/async split (CASCADE-06). Eliminates the env-branching
 * footgun (R4) by making the sync/async contract a require-time choice.
 *
 * License: BSL 1.1 (Business Source License 1.1) -- see LICENSE.
 */

'use strict';

const path = require('path');
const fs = require('fs');
// Phase 128.1-03b: the canonical session-scoped active-room resolver. The
// inline `reg.active` lookup below is a Bucket B-reader of the racing global
// `active` string; routing it through resolveActiveRoom closes the
// cross-session race (D-03 -- a partial caller fix re-creates the race).
const sessionBinding = require('./session-binding.cjs');

/**
 * Trivial path helper kept here for symmetry with future shared utilities.
 * Pure string/fs-path math; no I/O.
 * @param {string} roomDir
 * @returns {string}
 */
function resolveRoomPath(roomDir) {
  return path.resolve(roomDir);
}

/**
 * Resolve the active room directory path.
 *
 * Strategy 1: Resolve the session-scoped active-room binding via
 *             session-binding.resolveActiveRoom. The resolver internally does
 *             the session-keyed lookup plus the last_active/active fallback,
 *             so a caller with no session id still degrades gracefully.
 * Strategy 2: Fall back to the legacy `room/` directory.
 *
 * Pure fs + JSON logic, no child_process. Shared between sync and async
 * entry points (both re-export this function under its original name).
 *
 * Phase 128.1-03b: the prior inline `reg.active && reg.rooms[reg.active]`
 * lookup was a Bucket B-reader of the racing global `active` string. It now
 * routes through the canonical resolver so concurrent sessions resolve their
 * own room (D-03). The `tripwire` signal is destructured but not acted on
 * here -- Plan 05 owns the tripwire surface.
 *
 * @param {string} workDir - Workspace root directory
 * @returns {string|null} Absolute room path, or null if no room found
 */
function resolveRoom(workDir) {
  const resolved = path.resolve(workDir);

  // Strategy 1: session-scoped active-room binding.
  try {
    const sid = sessionBinding.resolveSessionId();
    const { path: roomPath /* room, tripwire -- Plan 05 owns tripwire */ } =
      sessionBinding.resolveActiveRoom(sid);
    if (roomPath && fs.existsSync(roomPath)) return roomPath;
  } catch (_e) { /* fall through to legacy */ }

  // Strategy 2: Legacy
  const legacy = path.join(resolved, 'room');
  if (fs.existsSync(legacy)) return legacy;

  return null;
}

module.exports = { resolveRoomPath, resolveRoom };
