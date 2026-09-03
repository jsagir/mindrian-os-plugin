'use strict';
/*
 * Phase 149-01 -- planning-artifacts: the typed planning_artifact + requirement
 * node-write chokepoint, plus the typed-lineage-edge writer, for the GSD-doc to
 * local-graph bridge. This is the net-new substrate the reconcile (Plan 02) and
 * the writer hook (Plan 03) ride on. GAM-01 / GAM-03 / GAM-04.
 *
 * This module is an allow-listed navigation submodule (scripts/check-substrate.cjs
 * regex /^lib\/core\/navigation\// covers it). It takes a db handle owned by the
 * caller (via lib/core/room-db.cjs openRoomDb) EXACTLY like
 * lib/core/navigation/lens-nodes.cjs and lib/core/navigation/edges.cjs: it NEVER
 * requires node:sqlite and NEVER opens room.db itself, so it stays inside the
 * navigation allow-list with ZERO substrate bypass (GAM-01 substrate-guard floor;
 * threat T-149-03). The only sibling it requires is ./edges.cjs.
 *
 * Exports:
 *   writePlanningArtifactNode(db, {phase, artifactType, path, status})
 *                                  -> { ok, node_id } | { ok:false, reason }
 *   writeRequirementNode(db, {reqId, phase})
 *                                  -> { ok, node_id } | { ok:false, reason }
 *   writeLineageEdge(db, {source_id, target_id, edge_type, properties})
 *                                  -> { ok, ... } | { ok:false, reason }
 *   ARTIFACT_TYPES                 -> frozen array of the 7 GSD artifact types
 *   ARTIFACT_NODE_ID(phase, artifactType) -> stable node id
 *   REQUIREMENT_NODE_ID(reqId)            -> stable node id
 *
 * Canon Part 9 v1.5 (AUDIT-NODE CARVE-OUT): planning_artifact + requirement are
 *   SYSTEM-BOOKKEEPING nodes -- they record what the system DID about the GSD
 *   planning surface (which artifacts exist, which requirements were declared),
 *   NOT a truth-claim about the venture. They are NOT in the truth-claim set
 *   {claim, CausalClaim, assumption, decision, opportunity}. So they MAY carry
 *   created_by='system' review_status='confirmed' WITHOUT a human byUser; the
 *   carve-out makes that confirmed-status write canon-legal, not a Part 9 role-5
 *   violation. Here review_status='confirmed' means write-completed (the artifact
 *   exists), not human-attributed truth. They never reach the confirmNode
 *   human-byUser truth-claim path. Mirrors lib/core/navigation/focus.cjs writing
 *   a focus_changed audit node with created_by='system' review_status='confirmed'
 *   and lib/core/navigation/lens-nodes.cjs writing a HatState node the same way.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; the artifact BODY never leaves the room. The lineage
 *   edge properties are ENUM/scalar only (a phase id + an artifact-type enum);
 *   the artifact prose never lands on a node or edge here.
 *
 * Canon Part 7 (reuse before build): writeLineageEdge is a thin pass-through to
 *   edges.writeEdge -- the existing edge-write primitive gated on the shipped
 *   ALLOWED_EDGE_TYPES Set. This module adds NO new taxonomy member of its own;
 *   it CONSTRAINS to the existing LINEAGE subset {FEEDS_INTO, VALIDATES,
 *   INFORMS} (all members of ALLOWED_EDGE_TYPES), so edges.cjs stays the single
 *   source of truth for the predicate vocabulary (threat T-149-01).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const edges = require('./edges.cjs');
const { insertNode } = require('../node-insert.cjs');

// The 7 GSD planning-artifact types (SPEC / CONTEXT / RESEARCH / VALIDATION /
// PLAN / VERIFICATION / DISCUSSION-LOG). Frozen so callers cannot mutate the
// closed set; writePlanningArtifactNode validates artifactType against the Set.
const ARTIFACT_TYPES = Object.freeze([
  'SPEC',
  'CONTEXT',
  'RESEARCH',
  'VALIDATION',
  'PLAN',
  'VERIFICATION',
  'DISCUSSION-LOG',
]);
const ARTIFACT_TYPE_SET = Object.freeze(new Set(ARTIFACT_TYPES));

// The LINEAGE subset writeLineageEdge accepts. Each member is ALSO a member of
// edges.cjs ALLOWED_EDGE_TYPES (FEEDS_INTO + VALIDATES added at Phase 149-01;
// INFORMS shipped at Phase 130-01). This is a SUBSET-constraint, not a new
// taxonomy: a non-lineage-but-real edge type (e.g. DEFERRED) is rejected here
// even though edges.writeEdge would accept it, and a non-taxonomy type
// (BOGUS_LINK) is rejected at BOTH layers.
const LINEAGE_EDGE_TYPES = Object.freeze(['FEEDS_INTO', 'VALIDATES', 'INFORMS']);
const LINEAGE_EDGE_TYPE_SET = Object.freeze(new Set(LINEAGE_EDGE_TYPES));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ARTIFACT_NODE_ID(phase, artifactType) -- the stable id that makes the
// ON CONFLICT(id) DO UPDATE upsert deduplicate per the GAM-04 idempotence
// contract. Re-running over the same artifact updates the SAME row, never adds
// a duplicate.
function ARTIFACT_NODE_ID(phase, artifactType) {
  return 'planning_artifact:' + phase + ':' + artifactType;
}

// REQUIREMENT_NODE_ID(reqId) -- the stable id for a per-requirement node.
function REQUIREMENT_NODE_ID(reqId) {
  return 'requirement:' + reqId;
}

// writePlanningArtifactNode(db, {phase, artifactType, path, status}) -- UPSERT a
// typed planning_artifact node. Validates artifactType against ARTIFACT_TYPE_SET;
// JSON.stringify the properties {phase, artifact_type, path, status}; runs the
// INSERT ... ON CONFLICT(id) DO UPDATE upsert (mirrors lens-nodes.cjs writeHatState
// verbatim). created_by='system', confidence 1.0, review_status='confirmed' (the
// Canon Part 9 v1.5 audit-node carve-out). source_path is a LOCAL handle
// 'planning:'+phase+':'+artifactType, never user prose. Defensive: never throws
// on caller input; returns { ok:false, reason } on failure.
function writePlanningArtifactNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { phase, artifactType, path: artifactPath, status } = params;
  if (typeof phase !== 'string' || phase.length === 0) {
    return { ok: false, reason: 'invalid_phase' };
  }
  if (typeof artifactType !== 'string' || !ARTIFACT_TYPE_SET.has(artifactType)) {
    return { ok: false, reason: 'invalid_artifact_type', detail: String(artifactType).slice(0, 40) };
  }
  if (typeof artifactPath !== 'string' || artifactPath.length === 0) {
    return { ok: false, reason: 'invalid_path' };
  }
  const props = {
    phase: phase,
    artifact_type: artifactType,
    path: artifactPath,
    status: typeof status === 'string' ? status : '',
  };
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = ARTIFACT_NODE_ID(phase, artifactType);
  const sourcePath = 'planning:' + phase + ':' + artifactType;
  try {
    insertNode(db, nodeId, 'planning_artifact', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'confirmed',
    });
  } catch (e) {
    return { ok: false, reason: 'planning_artifact_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId };
}

// writeRequirementNode(db, {reqId, phase}) -- UPSERT a typed requirement node.
// Same shape as writePlanningArtifactNode: stable id REQUIREMENT_NODE_ID(reqId),
// type 'requirement', system-bookkeeping carve-out (created_by='system',
// review_status='confirmed'), properties {req_id, phase}. Defensive; never throws.
function writeRequirementNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { reqId, phase } = params;
  if (typeof reqId !== 'string' || reqId.length === 0) {
    return { ok: false, reason: 'invalid_req_id' };
  }
  if (typeof phase !== 'string' || phase.length === 0) {
    return { ok: false, reason: 'invalid_phase' };
  }
  const props = { req_id: reqId, phase: phase };
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = REQUIREMENT_NODE_ID(reqId);
  const sourcePath = 'requirement:' + phase + ':' + reqId;
  try {
    insertNode(db, nodeId, 'requirement', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'confirmed',
    });
  } catch (e) {
    return { ok: false, reason: 'requirement_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId };
}

// writeLineageEdge(db, {source_id, target_id, edge_type, properties}) -- a thin
// pass-through to edges.writeEdge that FIRST constrains edge_type to the LINEAGE
// subset {FEEDS_INTO, VALIDATES, INFORMS}. The constraint means:
//   - a non-taxonomy type (BOGUS_LINK) is rejected here (and would also be
//     rejected by writeEdge);
//   - a real-but-non-lineage type (DEFERRED) is rejected HERE even though
//     writeEdge would accept it -- the lineage writer does not widen the
//     taxonomy, it narrows the accepted set.
// edges.writeEdge stays the single source of truth for the predicate vocabulary
// (its ALLOWED_EDGE_TYPES gate); this writer never adds a new member.
// Defensive; never throws on caller input.
function writeLineageEdge(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { edge_type } = params;
  if (typeof edge_type !== 'string' || !LINEAGE_EDGE_TYPE_SET.has(edge_type)) {
    return { ok: false, reason: 'invalid_lineage_edge_type', detail: String(edge_type).slice(0, 40) };
  }
  return edges.writeEdge(db, params);
}

module.exports = {
  ARTIFACT_TYPES,
  ARTIFACT_TYPE_SET,
  LINEAGE_EDGE_TYPES,
  ARTIFACT_NODE_ID,
  REQUIREMENT_NODE_ID,
  writePlanningArtifactNode,
  writeRequirementNode,
  writeLineageEdge,
};
