'use strict';
/*
 * Phase 118 Plan 02 -- dashboard-helpers: thin wrappers used by the Plan
 * 118-02 dashboard-graph-neighborhood MVA agent (Agent 6 of 6 in B1).
 *
 * Two wrappers, both kept under lib/core/navigation/ so the chokepoint module
 * (lib/core/navigation.cjs) re-exports them as the navigator-facing API. The
 * dashboard MVA agent goes through navigation.cjs only -- the Phase 109 D-06
 * chokepoint invariant (Canon Part 9).
 *
 * Wrappers:
 *   detectActiveRoom() -> { roomDir, hasRoomDb } | null
 *     Resolves the active room via MindrianRooms/.rooms/registry.json (the
 *     scripts/brain-derive-command.cjs precedent at line 142). Returns null if
 *     no registry, no active slug, or the resolved path is not a directory.
 *
 *   getRecentDecisionNeighborhood(roomDir, opts) -> { nodes:[], edges:[] }
 *     Opens room.db via lib/core/room-db.cjs (the SOLE owner of better-sqlite3
 *     instantiation), picks the most recent 'decision' node, calls the
 *     existing getNeighborhood() chokepoint, returns the typed neighborhood.
 *     Returns { nodes:[], edges:[] } when room.db has no decisions yet.
 *
 * Canon Part 9 (Memory Locality + Interpretation): this helper IS a navigation
 * surface; agents that need room-graph reads go through here.
 *
 * Canon Part 8: zero network surface. Pure LOCAL filesystem + SQLite reads.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const roomDbMod = require('../room-db.cjs');
const neighborhoodMod = require('./neighborhood.cjs');

function _safeIsFile(p) {
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}
function _safeIsDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
}

/**
 * Resolve the active room via the MindrianRooms registry. Mirrors
 * scripts/brain-derive-command.cjs::resolveActiveRoom verbatim so the same
 * detection rules apply across CLI commands and MVA agents.
 *
 * @returns {{ roomDir: string, hasRoomDb: boolean } | null}
 */
function detectActiveRoom() {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const roomsRoot = process.env.MINDRIAN_ROOMS_ROOT
    || process.env.MINDRIAN_ROOMS_HOME
    || path.join(home, 'MindrianRooms');
  const registryPath = path.join(roomsRoot, '.rooms', 'registry.json');
  if (!_safeIsFile(registryPath)) return null;
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (_e) {
    return null;
  }
  if (!reg || typeof reg !== 'object') return null;
  const activeSlug = reg.active;
  if (!activeSlug || typeof activeSlug !== 'string') return null;
  const entry = reg.rooms && reg.rooms[activeSlug];
  if (!entry || typeof entry !== 'object') return null;
  const relPath = entry.path || activeSlug;
  const absPath = path.resolve(roomsRoot, relPath);
  if (!_safeIsDir(absPath)) return null;
  const roomDbPath = path.join(absPath, '.mindrian', 'room.db');
  const hasRoomDb = _safeIsFile(roomDbPath);
  return { roomDir: absPath, hasRoomDb: hasRoomDb };
}

/**
 * Return a 1-2 hop neighborhood snapshot of the most-recent Decision node in
 * the room graph. The dashboard MVA agent renders this as the "your room
 * already has N related decision nodes" surface.
 *
 * @param {string} roomDir   absolute path to the active room
 * @param {{ hops?: number, limit?: number }} [opts]
 * @returns {{ nodes: Array, edges: Array }}
 */
function getRecentDecisionNeighborhood(roomDir, opts) {
  const options = opts || {};
  const hops = Number.isInteger(options.hops) && options.hops >= 1 ? options.hops : 1;
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 5;

  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
  } catch (_e) {
    return { nodes: [], edges: [] };
  }

  let nodes = [];
  let edges = [];
  try {
    // Pick the most recent decision node (or any node if no decisions) as focus.
    const focusRow = db.prepare(
      "SELECT id FROM nodes WHERE type = 'decision' ORDER BY created_at DESC LIMIT 1"
    ).get();
    if (!focusRow) {
      return { nodes: [], edges: [] };
    }
    const focusNodeId = focusRow.id;
    // Use the existing chokepoint to get the neighborhood. The depth + topK
    // map onto Plan 118-02's "1-2 hop / 5-node snapshot" contract.
    const neighborhood = neighborhoodMod.getNeighborhood(db, focusNodeId, {
      maxDepth: hops,
      topK: limit,
    });
    // Always include the focus node itself as the first node in the returned set.
    nodes = [{ id: focusNodeId, type: 'decision' }].concat(neighborhood.map((n) => ({
      id: n.id,
      type: n.type,
      score: n.score,
      edgeTypeIn: n.edgeTypeIn,
      depth: n.depth,
    })));
    // The closed neighborhood query also returns edge_path; surface a flat
    // edges array of (source, target, type) tuples derived from the path
    // metadata so the deck renderer (Plan 118-03) can draw the graph.
    for (const n of neighborhood) {
      if (n.edgePath && n.edgePath.length >= 2) {
        const pathArr = n.edgePath;
        for (let i = 0; i + 1 < pathArr.length; i++) {
          edges.push({
            source: pathArr[i],
            target: pathArr[i + 1],
            type: i + 1 === pathArr.length - 1 ? (n.edgeTypeIn || 'unknown') : 'path',
          });
        }
      }
    }
  } catch (_e) {
    nodes = [];
    edges = [];
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
  }
  return { nodes, edges };
}

module.exports = { detectActiveRoom, getRecentDecisionNeighborhood };
