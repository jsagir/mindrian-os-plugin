'use strict';
// Phase 172-11 -- the scale-invariant fractal coverage rollup operator
// (CIRS R11 / INV-16). ONE rollup(room) operator applied recursively UP the
// NESTED_WITHIN room-lineage hierarchy, precomputing a per-room aggregate
// coverage summary per level, normalized by subtree size, depth-3 capped (the
// SEED-022 memory contract / Simon out-of-memory cutoff), with cross-room
// boundary signals travelling ONLY as aggregate SCALARS.
//
// Canon Part 11 R11 (DECLARED-but-DEFERRED-ENFORCEMENT): "coverage + chain
//   monitoring rolls up across nested rooms via one scale-invariant operator over
//   NESTED_WITHIN, depth-bounded, aggregate-SCALAR-only; reads child coverage
//   scalars, NEVER child lineage edges across room.db boundaries (entry 23)."
//
// Appendix D entry 23: cross-room aggregation of the NESTED_WITHIN EDGE is
//   forbidden. So this operator reuses the Phase 169 NESTED_WITHIN child-DISCOVERY
//   walk (the slug + dir resolution idiom from lib/core/graph-derivation.cjs), but
//   it does NOT ride rollupSubRooms -- that helper ATTACHes child EDGES across the
//   boundary, which is exactly what entry 23 forbids for AGGREGATION. Here only
//   each room's LOCAL coverage SCALARS (counts) cross the boundary; no child edge
//   row is ever read into the parent rollup.
//
// Canon Part 8: the operator carries NO user content -- counts/scalars only. It
//   reads each room's LOCAL .mindrian/coverage.json scalar file (or derives the
//   scalars from the room's own connector-coverage-ledger equivalent). Zero Brain
//   wire, zero network. Cross-room aggregation of NESTED_WITHIN edges forbidden.
//
// Canon Part 7 (reuse-before-build): the NESTED_WITHIN child-walk mirrors the
//   Phase 169 _directChildSlugs + _childDirForSlug helpers in graph-derivation.cjs
//   verbatim in shape; we do not rebuild the lineage walk, we ride its idiom while
//   substituting a SCALAR read for the edge ATTACH at the boundary.
//
// No em-dashes (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// The frozen depth cap (SEED-022 memory contract / Simon out-of-memory cutoff /
// GraphRAG hierarchical-Leiden aggregate-vertex / LCA query-routing depth). Root
// is depth 0; the rollup walks children to depth DEPTH_CAP inclusive and STOPS.
const DEPTH_CAP = 3;

function _roomDbPath(roomDir) {
  return path.join(path.resolve(roomDir), '.mindrian', 'room.db');
}

function _coverageScalarPath(roomDir) {
  return path.join(path.resolve(roomDir), '.mindrian', 'coverage.json');
}

// Read a room's LOCAL coverage SCALARS. Source of truth is the per-room
// .mindrian/coverage.json { counts: { wired, excluded, gap } }. A missing /
// unreadable file degrades to a zero-scalar room (it contributes nothing but is
// still a node in the subtree). SCALARS ONLY -- never any surface names, never any
// edge rows, never any user content (Part 8).
function _readLocalCoverageScalars(roomDir) {
  let raw;
  try {
    raw = fs.readFileSync(_coverageScalarPath(roomDir), 'utf8');
  } catch (_e) {
    return { wired: 0, excluded: 0, gap: 0 };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    return { wired: 0, excluded: 0, gap: 0 };
  }
  const counts = (parsed && typeof parsed === 'object' && parsed.counts && typeof parsed.counts === 'object')
    ? parsed.counts
    : (parsed && typeof parsed === 'object' ? parsed : {});
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    wired: num(counts.wired),
    excluded: num(counts.excluded),
    gap: num(counts.gap),
  };
}

// Read the direct NESTED_WITHIN child slugs from a room db, READ ONLY. A child
// link is source 'room:<child>' -> target 'room:<parent>' (the Phase 169 / Plan 00
// lineage edge). This is the Phase 169 _directChildSlugs idiom (reuse, Part 7).
// CRITICAL Part 8 / entry-23 boundary: we read ONLY the NESTED_WITHIN child SLUGS
// to DISCOVER the subtree shape -- we never read the child's OTHER edges, and we
// never aggregate the NESTED_WITHIN edges themselves across the boundary. The
// child slug is a structural discovery handle, not aggregated content.
function _directChildSlugs(roomDir) {
  const dbPath = _roomDbPath(roomDir);
  if (!fs.existsSync(dbPath)) return [];
  let conn = null;
  const slugs = [];
  try {
    conn = new DatabaseSync('file:' + dbPath + '?mode=ro');
    let rows = [];
    try {
      rows = conn.prepare("SELECT source FROM edges WHERE type = 'NESTED_WITHIN'").all();
    } catch (_e) {
      rows = [];
    }
    for (const r of rows) {
      const src = (r && typeof r.source === 'string') ? r.source : '';
      if (src.indexOf('room:') === 0) slugs.push(src.slice('room:'.length));
    }
  } catch (_e) {
    return [];
  } finally {
    if (conn) { try { conn.close(); } catch (_ce) { /* ignore */ } }
  }
  return slugs;
}

// Resolve a child room directory for a NESTED_WITHIN child slug. Mirrors the
// Phase 169 _childDirForSlug idiom (reuse, Part 7): the child is an immediate
// subdirectory whose .room-root slug matches, with a same-named-dir fallback.
function _childDirForSlug(parentRoomDir, childSlug) {
  let entries;
  try {
    entries = fs.readdirSync(parentRoomDir, { withFileTypes: true });
  } catch (_e) {
    return '';
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const childDir = path.join(parentRoomDir, entry.name);
    const sentinel = path.join(childDir, '.room-root');
    if (!fs.existsSync(sentinel)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(sentinel, 'utf8'));
      if (meta && meta.slug === childSlug) return childDir;
    } catch (_e) { /* keep scanning */ }
  }
  const direct = path.join(parentRoomDir, childSlug);
  if (fs.existsSync(path.join(direct, '.room-root'))) return direct;
  return '';
}

/**
 * rollupCoverage(room, opts) -> aggregate coverage summary
 *
 * The ONE scale-invariant operator. Reads the room's LOCAL coverage scalars,
 * walks DOWN its NESTED_WITHIN children to DEPTH_CAP (root depth 0; a 4th-level
 * descendant beyond the cap is NOT aggregated), and aggregates every in-cap room's
 * scalars by SUM, normalized by subtree size into a coverage ratio. The SAME
 * function applies at every level (scale-invariant): call it on a leaf and it
 * rolls up only the leaf; call it on the root and it rolls up the whole capped
 * subtree.
 *
 * Cross-room boundary contract (entry 23 / Part 11 R11): only aggregate SCALARS
 * cross a room boundary. Each room contributes its { wired, excluded, gap } counts;
 * no child lineage edge row is ever read into the parent rollup.
 *
 * Returns:
 *   {
 *     room: <resolved room dir>,
 *     aggregate: { wired, excluded, gap, total },
 *     subtree_size: <number of rooms aggregated within the cap>,
 *     coverage_ratio: <wired / total, normalized to [0,1]>,
 *     depth_cap: DEPTH_CAP,
 *     depth_capped: <true iff the walk hit the cap with deeper rooms present>
 *   }
 *
 * Defensive: never throws on caller input; a missing room degrades to a
 * zero-scalar single-room rollup.
 */
function rollupCoverage(room, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const depthCap = (typeof options.depthCap === 'number' && options.depthCap >= 0)
    ? options.depthCap
    : DEPTH_CAP;

  const rootDir = path.resolve(typeof room === 'string' ? room : '');

  const agg = { wired: 0, excluded: 0, gap: 0 };
  let subtreeSize = 0;
  let depthCapped = false;

  // Cycle guard: a NESTED_WITHIN cycle (should not happen, but defend) must not
  // loop forever. Keyed on resolved room dir.
  const visited = new Set();

  // Iterative DFS over the NESTED_WITHIN subtree, depth-bounded. Each frame
  // carries { dir, depth }. Root is depth 0; we aggregate while depth <= depthCap.
  const stack = [{ dir: rootDir, depth: 0 }];

  while (stack.length) {
    const { dir, depth } = stack.pop();
    const resolved = path.resolve(dir);
    if (visited.has(resolved)) continue;
    visited.add(resolved);

    // Aggregate THIS room's LOCAL scalars (scalars cross the boundary, edges do not).
    const scalars = _readLocalCoverageScalars(resolved);
    agg.wired += scalars.wired;
    agg.excluded += scalars.excluded;
    agg.gap += scalars.gap;
    subtreeSize += 1;

    // Discover this room's NESTED_WITHIN children. If we are AT the cap, we do not
    // descend further -- but we note depth_capped if deeper rooms actually exist.
    if (depth >= depthCap) {
      const deeperSlugs = _directChildSlugs(resolved);
      for (const slug of deeperSlugs) {
        const childDir = _childDirForSlug(resolved, slug);
        if (childDir) { depthCapped = true; break; }
      }
      continue;
    }

    const childSlugs = _directChildSlugs(resolved);
    for (const slug of childSlugs) {
      const childDir = _childDirForSlug(resolved, slug);
      if (!childDir) continue;
      const childResolved = path.resolve(childDir);
      if (visited.has(childResolved)) continue;
      stack.push({ dir: childResolved, depth: depth + 1 });
    }
  }

  const total = agg.wired + agg.excluded + agg.gap;
  const coverageRatio = total > 0 ? agg.wired / total : 0;

  return {
    room: rootDir,
    aggregate: { wired: agg.wired, excluded: agg.excluded, gap: agg.gap, total },
    subtree_size: subtreeSize,
    coverage_ratio: coverageRatio,
    depth_cap: depthCap,
    depth_capped: depthCapped,
  };
}

module.exports = { rollupCoverage, DEPTH_CAP };
