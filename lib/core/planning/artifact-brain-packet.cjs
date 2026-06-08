'use strict';
/*
 * Phase 149-03 Task 2 (GAM-06) -- artifact-brain-packet: the typed-packet
 * projection for any Brain query about planning artifacts. THE constitutional
 * seal of Phase 149.
 *
 * buildArtifactBrainPacket(db, {phase, artifactType}) returns a FLAT object of
 * GENERIC HANDLES ONLY:
 *   - phase            a generic phase id handle (the input handle echoed)
 *   - artifact_types   the artifact_type enum set present for the phase (a
 *                      subset of the 7 frozen ARTIFACT_TYPES)
 *   - requirement_ids  the requirement id handles (e.g. GAM-04, GAM-06) the
 *                      phase declares, parsed from the stable requirement node id
 *   - status           the status enum for the anchor artifact (a review_status
 *                      enum from the closed Canon Part 9 set)
 *   - node_count       a scalar count of the planning_artifact + requirement
 *                      nodes in the phase neighborhood (a generic scalar)
 *   - phase_hash       an OPTIONAL sha256 hash of the phase id handle, reusing
 *                      the packet.cjs sha256 projection, for dedup keying. This
 *                      is a hash of a GENERIC handle (the phase id), never prose.
 *
 * It MUST NOT include: the artifact body, the raw file path, filenames-as-
 * content, source_path/source_section, or ANY node properties prose. The packet
 * is built from node IDS + TYPE + REVIEW_STATUS only -- the stable handle space
 * the Plan 01 writers mint (planning_artifact:<phase>:<TYPE> and
 * requirement:<reqId>). It NEVER reads a node's `properties` JSON, so no prose
 * field can ever reach the wire even if a writer regression let prose onto a node.
 *
 * Canon Part 8 (zero Brain egress): this module builds a packet; it does NOT
 *   send it. It requires ONLY ../navigation.cjs (the Phase 109 chokepoint) plus
 *   the packet.cjs sha256 helper + node:path. NO brain-client, NO node:http /
 *   node:https, NO fetch. Sending stays the existing Brain-client path, which
 *   already passes the sanitizer; this module's output is structurally safe.
 *
 * Canon Part 9 (navigation chokepoint): reads room DATA ONLY via navigation.cjs
 *   getNeighborhood. NEVER opens room.db; NEVER requires node:sqlite.
 *
 * Canon Part 9 v1.5 (audit-node carve-out): planning_artifact + requirement are
 *   system-bookkeeping nodes; their handles are not truth-claims.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 *
 * Exports: buildArtifactBrainPacket
 */

const path = require('node:path');

const navigation = require('../navigation.cjs');
// Reuse the packet.cjs sha256-by-default projection helper (the leak-safe wire
// hasher). hashText('sha256:' + hex) hashes a GENERIC handle here (the phase id),
// never prose.
const packet = require('../navigation/packet.cjs');

// The closed set of GSD artifact types (mirror of the Plan 01 frozen set,
// re-exported on navigation.cjs). Used to keep artifact_types a closed enum set.
function artifactTypeSet() {
  const types = navigation.ARTIFACT_TYPES;
  return Array.isArray(types) && types.length > 0
    ? new Set(types)
    : new Set(['SPEC', 'CONTEXT', 'RESEARCH', 'VALIDATION', 'PLAN', 'VERIFICATION', 'DISCUSSION-LOG']);
}

// Parse the artifact_type enum out of a stable planning_artifact node id.
// Node id shape: planning_artifact:<phase>:<TYPE>. We take the LAST segment so
// a phase containing ':' still resolves the type correctly, then validate it
// against the closed enum set (anything unknown is dropped, never echoed).
function artifactTypeFromNodeId(nodeId, typeSet) {
  if (typeof nodeId !== 'string') return null;
  const prefix = 'planning_artifact:';
  if (nodeId.indexOf(prefix) !== 0) return null;
  const idx = nodeId.lastIndexOf(':');
  if (idx <= prefix.length - 1) return null;
  const candidate = nodeId.slice(idx + 1);
  return typeSet.has(candidate) ? candidate : null;
}

// Parse the requirement id handle out of a stable requirement node id.
// Node id shape: requirement:<reqId>. The reqId is a generic handle (e.g.
// GAM-06). We validate the shape so only well-formed requirement-id handles
// survive (defense against a malformed node id carrying prose after the colon).
const REQ_ID_RE = /^[A-Z]{2,}-\d{1,3}(?:\.\d+)?$/;
function requirementIdFromNodeId(nodeId) {
  if (typeof nodeId !== 'string') return null;
  const prefix = 'requirement:';
  if (nodeId.indexOf(prefix) !== 0) return null;
  const candidate = nodeId.slice(prefix.length);
  return REQ_ID_RE.test(candidate) ? candidate : null;
}

// Read the anchor node's review_status (a closed Canon Part 9 enum) directly off
// the neighborhood-base row WITHOUT touching its properties. getNeighborhood
// returns depth>0 rows only, so to get the anchor's own status we resolve it
// from the neighborhood traversal's edge_type_in==null base is unavailable;
// instead we accept the status from the first connected node carrying it, and
// fall back to a generic 'present'. The status is an enum scalar, never prose.
function anchorStatusEnum(neighborhood) {
  // review_status is a closed enum: proposed|confirmed|rejected|stale|superseded|
  // needs_evidence|validated|invalidated. Pick the anchor-artifact-adjacent
  // status if present; default to 'present' (the writer's bookkeeping default).
  for (const n of neighborhood) {
    if (n && typeof n.reviewStatus === 'string' && n.reviewStatus.length > 0) {
      return n.reviewStatus;
    }
    if (n && typeof n.review_status === 'string' && n.review_status.length > 0) {
      return n.review_status;
    }
  }
  return 'present';
}

// buildArtifactBrainPacket(db, {phase, artifactType}) -- the generic-handles-only
// projection. Anchors on the requested artifact node (default SPEC), traverses
// the phase lineage via navigation.getNeighborhood, and projects ONLY ids ->
// handles. Defensive: never throws on caller input; returns a minimal packet
// (generic handles, empty arrays) when the db is absent or the anchor is unknown.
function buildArtifactBrainPacket(db, params) {
  const opts = (params && typeof params === 'object') ? params : {};
  const phase = (typeof opts.phase === 'string' && opts.phase.length > 0) ? opts.phase : '';
  const requestedType = (typeof opts.artifactType === 'string' && opts.artifactType.length > 0)
    ? opts.artifactType
    : 'SPEC';

  const typeSet = artifactTypeSet();
  // The packet skeleton -- every field a generic scalar or array of handles.
  const out = {
    packet_version: '1.0',
    job: 'planning_artifact_query',
    phase: phase,
    artifact_types: [],
    requirement_ids: [],
    status: 'present',
    node_count: 0,
    // sha256 of the GENERIC phase id handle (never prose). Stable dedup key.
    phase_hash: packet.hashText(phase),
    origin: 'navigation_api',
    constraints: { privacy: 'no_raw_artifact_text' },
  };

  if (!db || !phase) return out;

  // The requested artifact type is the status anchor (a generic handle). If it is
  // not the closed enum, fall back to SPEC.
  const anchorType = typeSet.has(requestedType) ? requestedType : 'SPEC';

  // getNeighborhood traverses OUTBOUND only (e.source = focus). The Plan 02
  // lineage mixes orientations: SPEC/CONTEXT FEEDS_INTO downstream artifacts
  // (artifact-as-source), requirement INFORMS SPEC/PLAN (requirement-as-source),
  // and VERIFICATION VALIDATES requirement (verification-as-source). So no single
  // outbound anchor reaches every handle: from SPEC we reach CONTEXT/PLAN; from
  // VERIFICATION we reach the requirement nodes. To cover the whole phase surface
  // WITHOUT adding an inbound-neighborhood reader (which would be net-new
  // navigation surface, against Canon Part 7), we traverse outbound from EVERY
  // artifact-type anchor for the phase and UNION the neighborhoods. Each anchor
  // is a generic handle (planning_artifact:<phase>:<TYPE>); unknown anchors simply
  // return [] from getNeighborhood. Pure navigation.cjs reads, no new surface.
  const typeSeen = new Set();
  const reqSeen = new Set();
  let anchorStatusRows = [];

  if (typeSet.has(anchorType)) typeSeen.add(anchorType);

  for (const t of (navigation.ARTIFACT_TYPES || [])) {
    let anchorId;
    try {
      anchorId = navigation.ARTIFACT_NODE_ID(phase, t);
    } catch (_e) {
      anchorId = 'planning_artifact:' + phase + ':' + t;
    }
    let neighborhood = [];
    try {
      neighborhood = navigation.getNeighborhood(db, anchorId, { maxDepth: 3, topK: 200 }) || [];
    } catch (_e) {
      neighborhood = [];
    }
    if (neighborhood.length > 0) {
      // The anchor node exists (getNeighborhood returns [] for a missing focus),
      // so its OWN type is part of the phase surface.
      if (typeSet.has(t)) typeSeen.add(t);
    }
    // Capture the status-bearing rows from the requested anchor's traversal.
    if (t === anchorType) anchorStatusRows = neighborhood;
    for (const n of neighborhood) {
      if (!n || typeof n.id !== 'string') continue;
      const at = artifactTypeFromNodeId(n.id, typeSet);
      if (at) { typeSeen.add(at); continue; }
      const rid = requirementIdFromNodeId(n.id);
      if (rid) { reqSeen.add(rid); continue; }
    }
  }

  // Order the artifact_types per the canonical frozen order for a stable packet.
  const ordered = [];
  for (const t of (navigation.ARTIFACT_TYPES || [])) {
    if (typeSeen.has(t)) ordered.push(t);
  }
  // Any seen type not in the frozen list (should be impossible -- typeSet gates
  // it) is appended last; kept defensive.
  for (const t of typeSeen) {
    if (ordered.indexOf(t) === -1) ordered.push(t);
  }

  out.artifact_types = ordered;
  out.requirement_ids = Array.from(reqSeen).sort();
  out.status = anchorStatusEnum(anchorStatusRows);
  out.node_count = typeSeen.size + reqSeen.size;

  return out;
}

module.exports = {
  buildArtifactBrainPacket,
};
