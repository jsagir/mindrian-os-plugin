'use strict';
// Phase 169-02 (GDH-01) -- lib/core/room-root.cjs: the ONE `.room-root` walk-up
// resolver.
//
// This is a Part 7 CONSOLIDATION, not a net-new invention. The `.room-root`
// FILE sentinel is already written at room birth, and the walk-up that finds it
// was duplicated in three scripts (query-efficiency-telemetry.cjs,
// auto-explore-fingerprint.cjs, async-artifact-auto-commit.cjs). This module
// extracts that idiom into ONE resolver so there is a single source of truth and
// no drift (D-169-05). The gsd-artifact-graph-hook write-index path is repointed
// at it so a sub-room write indexes into THAT sub-room's db regardless of the
// registry active room (root cause #1).
//
// IFACE (169-01 shared_iface_contract):
//   resolveRoomRoot(filePath) -> roomDir|''   walk up from filePath to the
//     nearest ancestor dir containing the `.room-root` FILE sentinel; '' when
//     none is found.
//   findRoomRootSentinels() -> ['.room-root']  the canonical PRIMARY sentinel.
//
// Canon Part 8: a pure LOCAL filesystem walk. Zero network, zero Brain.
// Fail-safe: a missing/relative path resolves against process.cwd and returns
// '' when nothing is found; the resolver never throws (so the hook keeps its
// exit-0-always degrade and a Write is never blocked). No em-dashes.

const fs = require('node:fs');
const path = require('node:path');

// MAX_DEPTH bounds the walk-up so a pathological path never spins. 12 mirrors
// the value the three consolidated scripts used verbatim.
const MAX_DEPTH = 12;

// The PRIMARY sentinel is the `.room-root` FILE (Q4 CLOSED). The heal-command
// uses a broader belt-and-suspenders set (['.room-root', 'STATE.md', 'ROOM.md'])
// for "is this dir a room at all" detection, but the write-index resolution this
// module powers keys on the `.room-root` FILE only -- it is the single sentinel
// written at room birth and the only one that uniquely marks a room ROOT.
const PRIMARY_SENTINELS = Object.freeze(['.room-root']);

/**
 * findRoomRootSentinels() -> ['.room-root']
 * The canonical primary sentinel set the resolver walks for.
 */
function findRoomRootSentinels() {
  return PRIMARY_SENTINELS.slice();
}

/**
 * resolveRoomRoot(filePath) -> roomDir|''
 *
 * Walk up parent-by-parent from filePath (or its dirname when filePath is a
 * file) to the nearest ancestor dir containing the `.room-root` FILE sentinel,
 * and return that dir. Returns '' when no sentinel is found anywhere up the
 * tree, or on any error. Never throws.
 *
 * A relative or missing filePath is resolved against process.cwd() first, so a
 * path-less / relative caller still gets a deterministic walk (and '' when there
 * is nothing to find).
 */
function resolveRoomRoot(filePath) {
  try {
    const start = (typeof filePath === 'string' && filePath.length > 0)
      ? path.resolve(filePath)
      : process.cwd();

    // If the start path is a file, begin the walk from its dirname. If it does
    // not exist (or stat fails), start from the path itself -- the existsSync
    // sentinel check below still gates correctly, and a non-existent leaf simply
    // walks up toward real ancestors.
    let dir = start;
    try {
      if (fs.existsSync(start) && fs.statSync(start).isFile()) {
        dir = path.dirname(start);
      }
    } catch (_e) {
      // stat failed -- treat start as a directory-ish anchor and walk from it.
      dir = start;
    }

    for (let hops = 0; hops < MAX_DEPTH; hops += 1) {
      try {
        if (fs.existsSync(path.join(dir, '.room-root'))) return dir;
      } catch (_e) { /* keep walking past an unreadable dir */ }
      const parent = path.dirname(dir);
      if (parent === dir) break; // hit the filesystem root
      dir = parent;
    }
    return '';
  } catch (_e) {
    return '';
  }
}

module.exports = { resolveRoomRoot, findRoomRootSentinels };
