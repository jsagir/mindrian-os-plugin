'use strict';
/*
 * Phase 169-07 -- lib/core/graph-self-heal.cjs
 *
 * THE CONSTITUTIONAL CORE (GDH-08 + GDH-09 + the D-169-11 fractal joint).
 *
 * detectUnsentineledArtifactFolder(roomDir) -> [{folder, artifactCount}]
 *   GDH-08. Finds artifact-bearing folders UNDER a room that lack their OWN
 *   `.room-root` sentinel, so the GDH-01 walk-up would otherwise silently roll
 *   their artifacts up into the parent's db (the live b2-journey case). Reuses
 *   the scripts/heal-command.cjs:889-928 sub-rooms-container precedent (the
 *   `.room-root` existsSync check) -- it does NOT re-invent the sentinel test.
 *
 * healRoom({folder, parentRoomDir, slug, approvedBy, runTimeline}) ->
 *   {ok, roomDir, slug, parentSlug, lineageEdge, ...}
 *   GDH-09. The full-citizen self-heal that makes a hand-built, sentinel-less
 *   artifact folder into a FIRST-CLASS room byte-indistinguishable from a born
 *   room, joined to its parent BOTH operationally (registry parent + sentinel
 *   parent, via room-birth.cjs opts.parent, Plan 07 Task 1) AND graph-navigably
 *   (the NESTED_WITHIN typed lineage edge from Plan 00). The ordered sequence:
 *     (0) approvedBy gate. Without it, REFUSE with {ok:false, reason:'no_approval'}
 *         and write NOTHING (Part 3 Decision Gate; the room-birth.cjs:316 gate).
 *     (1) birthRoom full SEED-001 wiring (ROOM.md + STATE.md + MINTO.md +
 *         per-section FEYNMAN.md + BRAIN enqueue + room_created memory_event +
 *         own .mindrian/room.db). REUSE -- never hand-roll the scaffold (Part 7,
 *         D-169-10). approvedBy + parent are threaded into birthRoom.
 *     (2) the OPERATIONAL joint (registry parent + sentinel parent) is now done
 *         BY birthRoom via opts.parent (Task 1).
 *     (3) the GRAPH-NAVIGABLE joint: a NESTED_WITHIN typed edge
 *         room:<child> -> room:<parent> via navigation.writeEdge, written into the
 *         child's OWN room.db (the canonical lineage edge) AND a discovery copy
 *         into the parent's room.db so the shipped rollupSubRooms walk
 *         (graph-derivation.cjs::_directChildSlugs reads NESTED_WITHIN from the
 *         PARENT db) can traverse DOWN to children. PART_OF is NOT used (illegal
 *         for a room target); BELONGS_TO is NOT used (absent from the frozen set);
 *         the edge properties are enum/scalar only.
 *     (4) the FEYNMAN temporal joint: timeline-runner.refreshAll(folder) so the
 *         healed room's per-section FEYNMAN.md gains its `## Timeline (auto)`
 *         section, regenerated from the room_created memory_event. REUSE the
 *         Phase 124 runner; never hand-roll the timeline.
 *     (5) RETURN. The heal NEVER indexes or derives (clean separation; Plan 05
 *         owns the index+derive AFTER the heal -- the heal-first sequence).
 *   Arbitrary depth (D-169-11): healRoom on a folder whose parent is itself a
 *   healed/born sub-room writes the NESTED_WITHIN edge to THAT sub-room, so a
 *   3-level chain links each level UP one hop. Idempotent (GDH-07): a re-run on
 *   an already-healed room is a no-op (it already has a `.room-root`; the
 *   NESTED_WITHIN edge ON CONFLICT(source,target,type) no-ops).
 *
 * Canon Part 8: detect + the sentinel-write + the edge are LOCAL fs +
 *   navigation.cjs only -- ZERO Brain wire. BRAIN.md is enqueued (by birthRoom),
 *   derived locally per Phase 90; the heal makes no Brain call.
 * Canon Part 3/9: nothing auto-confirms. The heal lands the room + the
 *   proposed-graph state, and the human confirmed the heal itself at the gate
 *   (approvedBy). NO em-dashes anywhere (CLAUDE.md HARD RULE). CJS only.
 *
 * Allow-list rationale: this module requires lib/core/room-db.cjs openRoomDb ONLY
 *   to open the caller-owned write handle for the NESTED_WITHIN edge writes; the
 *   edge WRITE itself routes through the navigation chokepoint
 *   (lib/core/navigation/edges.cjs::writeEdge). Allow-listed in
 *   scripts/check-substrate.cjs alongside graph-derivation.cjs (Plan 07).
 */

const fs = require('node:fs');
const path = require('node:path');

const { resolveRoomRoot } = require('./room-root.cjs');
const { birthRoom } = require('./navigation/room-birth.cjs');
const { writeEdge } = require('./navigation/edges.cjs');
const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
const { blendFromCanonicalRole } = require('./shallow-doc-parser.cjs');

// Artifact extensions that mark a folder as artifact-bearing. Mirrors the
// extractor surface (Plan 03): .md / .docx / .html.
const ARTIFACT_EXT = Object.freeze(['.md', '.docx', '.html']);

const SENTINEL = '.room-root';

function _isArtifact(name) {
  const ext = path.extname(String(name)).toLowerCase();
  return ARTIFACT_EXT.includes(ext);
}

/**
 * detectUnsentineledArtifactFolder(roomDir) -> [{folder, artifactCount}]
 *
 * Reads the DIRECT child directories of roomDir; for each non-dot child that
 * holds at least one .md/.docx/.html artifact but has NO `.room-root` of its own,
 * include {folder, artifactCount}. Never throws (returns [] on any error) so a
 * detect pass never blocks the caller.
 */
function detectUnsentineledArtifactFolder(roomDir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const folder = path.join(roomDir, entry.name);
    // Reuse the heal-command.cjs sub-rooms-container precedent: a folder that
    // already carries a `.room-root` sentinel is its OWN room, not an
    // unsentineled artifact folder.
    try {
      if (fs.existsSync(path.join(folder, SENTINEL))) continue;
    } catch (_e) {
      continue;
    }
    let artifactCount = 0;
    try {
      for (const child of fs.readdirSync(folder, { withFileTypes: true })) {
        if (child.isFile() && _isArtifact(child.name)) artifactCount += 1;
      }
    } catch (_e) {
      artifactCount = 0;
    }
    if (artifactCount >= 1) out.push({ folder: folder, artifactCount: artifactCount });
  }
  return out;
}

/**
 * _resolveParentSlug(parentRoomDir) -> slug|''
 * Reads the parent's `.room-root` sentinel for its slug (the heal-written sub-room
 * carries {slug}; a born room carries {room}; the live registry case carries
 * {slug}). Falls back to the basename of the resolved room root, then '' on
 * failure. Never throws.
 */
function _resolveParentSlug(parentRoomDir) {
  try {
    const root = resolveRoomRoot(parentRoomDir) || parentRoomDir;
    const sentinelPath = path.join(root, SENTINEL);
    if (fs.existsSync(sentinelPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(sentinelPath, 'utf8'));
        if (meta && typeof meta.slug === 'string' && meta.slug.length > 0) return meta.slug;
        if (meta && typeof meta.room === 'string' && meta.room.length > 0) return meta.room;
      } catch (_e) { /* fall through to basename */ }
    }
    return path.basename(root);
  } catch (_e) {
    return '';
  }
}

/**
 * healRoom({folder, parentRoomDir, slug, approvedBy, runTimeline}) -> {ok, ...}
 * See the file header for the full ordered contract.
 */
function healRoom(opts) {
  const options = opts || {};
  const folder = options.folder;
  const parentRoomDir = options.parentRoomDir;
  const slug = options.slug;
  const approvedBy = options.approvedBy;
  const runTimeline = options.runTimeline !== false; // default true
  // Phase 177-03 (BCH-18): the canonical_role scalar in hand at the heal caller
  // (from the dual-path / shallow-doc parse upstream), when present. Used ONLY to
  // compute the single-axis blend threaded to birthRoom opts.roleBlend below.
  const canonicalRole = typeof options.canonicalRole === 'string' ? options.canonicalRole : '';

  // (0) Part 3 Decision Gate: REFUSE without approvedBy. No fs write, no room.
  if (!approvedBy) {
    return { ok: false, reason: 'no_approval', detail: 'approvedBy is required (the Part 3 Decision Gate)' };
  }
  if (typeof folder !== 'string' || folder.length === 0) {
    return { ok: false, reason: 'invalid_folder' };
  }
  if (typeof parentRoomDir !== 'string' || parentRoomDir.length === 0) {
    return { ok: false, reason: 'invalid_parent_room_dir' };
  }
  if (typeof slug !== 'string' || slug.length === 0) {
    return { ok: false, reason: 'invalid_slug' };
  }

  // (1) Resolve the parent slug, then INVOKE birthRoom for the FULL SEED-001
  // wiring (REUSE -- do not hand-roll the scaffold). The registry create + update
  // inside birthRoom keys on MINDRIAN_ROOMS_HOME; point it at the parent room dir
  // so the operational registry joint lands under the parent (the live nested
  // case: each room carries its own .rooms/registry.json). Restore the prior env
  // value after birth so the heal has no global side-effect.
  const parentSlug = _resolveParentSlug(parentRoomDir);
  if (!parentSlug) {
    return { ok: false, reason: 'unresolved_parent_slug' };
  }

  // Phase 177-03 (BCH-18): compute the single-axis blend from the canonical_role in
  // hand and thread it to birthRoom opts.roleBlend (the EXISTING producer at
  // room-birth.cjs:426-430 writes role_blend to USER.md). blendFromCanonicalRole
  // returns null when the scalar is absent / unmappable -- in that case we thread NO
  // roleBlend so birthRoom's default ({}, room-birth.cjs:350) takes the cold-start
  // neutral path. NEVER invent a blend (Part 9: never fabricate). When canonicalRole
  // is present we also thread it so USER.md carries the matching scalar.
  const computedBlend = blendFromCanonicalRole(canonicalRole);

  const prevRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = parentRoomDir;
  let birth;
  try {
    const birthOpts = {
      roomDir: folder,
      slug: slug,
      approvedBy: approvedBy,
      parent: parentSlug,
      ventureText: 'Self-healed sub-room ' + slug,
      vname: slug,
      vstage: 'Pre-Opportunity',
    };
    if (canonicalRole) birthOpts.canonicalRole = canonicalRole;
    if (computedBlend) birthOpts.roleBlend = computedBlend;
    birth = birthRoom(birthOpts);
  } finally {
    if (typeof prevRoomsHome === 'string') process.env.MINDRIAN_ROOMS_HOME = prevRoomsHome;
    else delete process.env.MINDRIAN_ROOMS_HOME;
  }

  if (!birth || !birth.ok) {
    return { ok: false, reason: 'birth_failed', detail: birth ? birth.reason : 'no_result' };
  }

  // (3) The GRAPH-NAVIGABLE joint: the NESTED_WITHIN edge room:<child> ->
  // room:<parent>. Written into the child's OWN room.db (the canonical lineage
  // edge) AND a discovery copy into the parent's room.db so the shipped
  // rollupSubRooms walk (graph-derivation.cjs::_directChildSlugs reads
  // NESTED_WITHIN from the PARENT db) can traverse DOWN to children. Properties
  // are enum/scalar only (relation enum + the parent slug handle). ON
  // CONFLICT(source,target,type) makes the edge write idempotent (GDH-07).
  const sourceId = 'room:' + slug;
  const targetId = 'room:' + parentSlug;
  const edgeParams = {
    source_id: sourceId,
    target_id: targetId,
    edge_type: 'NESTED_WITHIN',
    properties: { relation: 'nested', parent: parentSlug },
  };

  let lineageEdge = null;
  let childDb = null;
  try {
    childDb = openRoomDb(folder);
    lineageEdge = writeEdge(childDb, edgeParams);
  } catch (_e) {
    lineageEdge = { ok: false, reason: 'child_edge_write_failed' };
  } finally {
    if (childDb) { try { closeRoomDb(childDb); } catch (_e2) { /* ignore */ } }
  }

  // The parent-db discovery copy (read-side rollup down). A failure here does not
  // fail the heal (the canonical child-db edge already landed).
  let parentDb = null;
  try {
    parentDb = openRoomDb(parentRoomDir);
    writeEdge(parentDb, edgeParams);
  } catch (_e) {
    // Tolerate: the rollup degrades to whatever it can read.
  } finally {
    if (parentDb) { try { closeRoomDb(parentDb); } catch (_e2) { /* ignore */ } }
  }

  // (4) The FEYNMAN temporal joint: refresh the healed room's per-section
  // FEYNMAN.md so each gains its `## Timeline (auto)` section from the
  // room_created memory_event. REUSE the Phase 124 runner. force:true so the
  // section gains the sentinel-bounded section even when the watermark would
  // otherwise skip. A timeline-runner db handle is opened for the render.
  if (runTimeline) {
    let timelineDb = null;
    try {
      const timelineRunner = require('./feynman/timeline-runner.cjs');
      timelineDb = openRoomDb(folder);
      timelineRunner.refreshAll(folder, { db: timelineDb, force: true });
    } catch (_e) {
      // Tolerate: a timeline refresh failure does not fail the heal.
    } finally {
      if (timelineDb) { try { closeRoomDb(timelineDb); } catch (_e2) { /* ignore */ } }
    }
  }

  // (5) RETURN. The heal NEVER indexes or derives (Plan 05 owns index+derive).
  return {
    ok: true,
    roomDir: folder,
    slug: slug,
    parentSlug: parentSlug,
    lineageEdge: lineageEdge,
  };
}

module.exports = { detectUnsentineledArtifactFolder, healRoom };
