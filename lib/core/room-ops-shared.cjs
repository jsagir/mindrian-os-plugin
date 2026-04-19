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
 * Strategy 1: Read .rooms/registry.json and follow `active` -> rooms[active].path
 * Strategy 2: Fall back to the legacy `room/` directory
 *
 * Pure fs + JSON logic, no child_process. Shared between sync and async
 * entry points (both re-export this function under its original name).
 *
 * @param {string} workDir - Workspace root directory
 * @returns {string|null} Absolute room path, or null if no room found
 */
function resolveRoom(workDir) {
  const resolved = path.resolve(workDir);
  const registryPath = path.join(resolved, '.rooms', 'registry.json');

  // Strategy 1: Registry
  if (fs.existsSync(registryPath)) {
    try {
      const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      if (reg.active && reg.rooms && reg.rooms[reg.active]) {
        const roomPath = path.resolve(resolved, reg.rooms[reg.active].path);
        if (fs.existsSync(roomPath)) return roomPath;
      }
    } catch (_e) { /* fall through to legacy */ }
  }

  // Strategy 2: Legacy
  const legacy = path.join(resolved, 'room');
  if (fs.existsSync(legacy)) return legacy;

  return null;
}

module.exports = { resolveRoomPath, resolveRoom };
