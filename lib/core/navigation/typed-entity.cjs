'use strict';
/*
 * Phase 218-01 -- typed-entity: the company / technology / market entity-node
 * write chokepoint + the linkEntityRelations edge-linker. This is the WAVE 1
 * central slice (D-01): the typed entity-node writer this phase's extractor uses
 * to give the graph real domain-entity node types (company / technology /
 * market) so the shipped Eureka engine (211-216) and the shared room.db readers
 * reason over content, not one-node-per-file scaffolding.
 *
 * This module mirrors lib/core/navigation/typed-domain.cjs VERBATIM in structure:
 * the allow-list header note, the isPlainObject helper, the stable 31-multiplier
 * hash id-minter, the additive-JSON-props discipline (the D-10 precedent), and
 * the defensive never-throw contract. It is an allow-listed navigation submodule
 * (scripts/check-substrate.cjs regex /^lib\/core\/navigation\// covers it). It
 * takes a db handle owned by the caller (via lib/core/room-db.cjs openRoomDb)
 * EXACTLY like typed-domain.cjs / edges.cjs writeEdge: it NEVER requires
 * node:sqlite and NEVER opens room.db itself, so it stays inside the navigation
 * allow-list with zero substrate bypass.
 *
 * Canon Part 9 (the human gate, NO carve-out here):
 *   - An entity node (company / technology / market) is a PURE TRUTH-CLAIM: it
 *     asserts something about the venture's world, so it ALWAYS lands
 *     review_status 'proposed' and is NEVER auto-confirmed by an agent (Part 9
 *     role 5). Promotion to 'confirmed' requires a human APPROVE at a Decision
 *     Gate (navigation.confirmNode). CRITICAL CONTRAST WITH typed-domain: the
 *     taxonomy === true -> 'confirmed' promotion branch that typed-domain carries
 *     for pure-taxonomy labels is DELIBERATELY OMITTED here. An entity is never a
 *     taxonomy label; it is always a claim, so it stays 'proposed' forever
 *     (REQ-1 + the 218-CONTEXT HITL constraint). A `taxonomy` param, if passed,
 *     is ignored -- there is no promotion path.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; no entity/artifact prose ever leaves the room. The
 *   three entity edges (COMPETES_WITH / USES_COMPONENT / SUPPLIES_TO) plus the
 *   existing DESCRIBES artifact-link edge carry ENUM/scalar props ONLY (a
 *   relation enum + scalar node-id handles), never prose.
 *
 * Canon Part 4 / Part 7: linkEntityRelations NEVER writes the raw edges table.
 *   It routes EVERY edge write through navigation.writeEdge (the chokepoint),
 *   constraining its accepted set to the ENTITY_EDGE_SUBSET plus DESCRIBES --
 *   exactly how typed-domain.cjs linkDomainToRelated constrains to its
 *   DOMAIN_EDGE_SUBSET and memory-artifacts.cjs writeCortexLineageEdge to its
 *   CORTEX subset. The closed ALLOWED_EDGE_TYPES Set in edges.cjs stays the
 *   single source of truth for the predicate vocabulary; this subset adds no new
 *   taxonomy member.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');
const { writeEdge } = require('./edges.cjs');

// The closed 3-member entity node-type Set (D-01: company / technology / market
// are the FIRST-CLASS domain-entity node types). An entity write's entityType
// MUST validate against this Set; writeEntityNode rejects invalid_entity_type
// otherwise. Mirrors the DOMAIN_NODE_TYPES frozen-Set idiom in typed-domain.cjs:55.
const ENTITY_NODE_TYPES = Object.freeze(new Set([
  'company', 'technology', 'market',
]));

// The closed entity-edge subset (a frozen subset of the Wave-1 ALLOWED_EDGE_TYPES,
// mirroring typed-domain.cjs DOMAIN_EDGE_SUBSET per edges.cjs). The three
// domain-relationship edges D-02 minted; linkEntityRelations accepts these plus
// the already-existing DESCRIBES artifact-link type, rejecting anything else.
const ENTITY_EDGE_SUBSET = Object.freeze(new Set([
  'COMPETES_WITH', 'USES_COMPONENT', 'SUPPLIES_TO',
]));

// The artifact-link edge type an entity node uses to point at its source
// memory_artifact node. Already a member of ALLOWED_EDGE_TYPES (edges.cjs:277),
// so it is a legal writeEdge type; kept OUT of ENTITY_EDGE_SUBSET (which names
// only the three net-new domain-relationship edges) but accepted by
// linkEntityRelations alongside them.
const ENTITY_ARTIFACT_LINK_EDGE = 'DESCRIBES';

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ENTITY_NODE_ID(sessionId, name) -- the idempotent id-minter. A crypto-free,
// dependency-free stable 31-multiplier hash over the name (mirrors
// typed-domain.cjs:75-83) keeps re-writing the same (name, sessionId) an UPSERT,
// not a duplicate. Node id 'entity:'+sid+':'+hash.
function ENTITY_NODE_ID(sessionId, name) {
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const key = typeof name === 'string' && name.length > 0 ? name : 'noname';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 'entity:' + sid + ':' + hash.toString(16);
}

// writeEntityNode(db, params) -- UPSERT a typed company / technology / market node.
//
// params = { entityType, name, sessionId, evidenceTier? }. type = entityType (one
// of ENTITY_NODE_TYPES), created_by 'system'. review_status is ALWAYS 'proposed'
// (the column DEFAULT): an entity is a truth-claim and is NEVER auto-confirmed
// (Part 9 role 5). Unlike typed-domain.writeDomainNode there is NO taxonomy ->
// 'confirmed' promotion branch (REQ-1); a `taxonomy` param, if passed, is ignored.
// The node mints via lib/core/node-insert.cjs insertNode (both-schema safe per
// node-insert.cjs:95), which lands review_status 'proposed' by the column DEFAULT
// because no review_status arg is passed. Properties bag is ADDITIVE JSON only
// (name, entityType, evidenceTier default 'None'); NEVER DDL columns (the
// typed-domain.cjs D-10 precedent). Defensive: never throws on caller input;
// returns { ok:false, reason }.
function writeEntityNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    entityType, name, sessionId, evidenceTier,
  } = params;
  if (typeof entityType !== 'string' || !ENTITY_NODE_TYPES.has(entityType)) {
    return { ok: false, reason: 'invalid_entity_type', detail: String(entityType).slice(0, 40) };
  }
  if (typeof name !== 'string' || name.length === 0) {
    return { ok: false, reason: 'invalid_name' };
  }
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  // Additive JSON props ONLY (the D-10 precedent). evidenceTier rides the same
  // blob, never a column; default so the shape stays stable.
  const props = {
    name: name,
    entityType: entityType,
    evidenceTier: typeof evidenceTier === 'string' ? evidenceTier : 'None',
  };
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = ENTITY_NODE_ID(sid, name);
  const sourcePath = 'entity:' + sid + ':' + name;
  try {
    // Mint via the shared NOT-NULL-safe chokepoint (lands review_status DEFAULT
    // 'proposed' -- NO review_status arg is passed, so the entity is born
    // 'proposed' and stays there). created_by='system' satisfies the Phase-109
    // CHECK. There is DELIBERATELY no taxonomy-promotion follow-up UPDATE: an
    // entity node is never auto-confirmed (REQ-1, Part 9 role 5).
    insertNode(db, nodeId, entityType, propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      // R17-02: 'extracted_fact' -- a company/technology/market entity is
      // extracted from source content, same class as claim/EvidenceClaim.
      epistemic_type: 'extracted_fact',
    });
  } catch (e) {
    return { ok: false, reason: 'entity_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId, entityType: entityType };
}

// linkEntityRelations(db, params) -- connect an entity node to related existing
// nodes via the three Wave-1 domain-relationship edges (plus the DESCRIBES
// artifact-link edge) through navigation.writeEdge ONLY.
//
// params = { entityId, relations: [{ targetId, edge, properties? }] }. Each
// relation's edge MUST be in ENTITY_EDGE_SUBSET or equal ENTITY_ARTIFACT_LINK_EDGE
// (the writeEdge ALLOWED_EDGE_TYPES gate re-validates against the full frozen Set
// downstream). A relation outside the accepted set returns a FAILURE ENTRY, never
// a throw (defensive contract, mirroring linkDomainToRelated).
//
// Edge DIRECTION:
//   COMPETES_WITH  source=entityId target=rival (this entity competes with it)
//   USES_COMPONENT source=entityId target=component (this entity uses it)
//   SUPPLIES_TO    source=entityId target=customer (this supplier feeds it)
//   DESCRIBES      source=entityId target=memory_artifact (this entity is
//                    described by / sourced from that artifact)
// The relation may carry an explicit `from`/`to` override; absent that, the
// direction is source=entityId target=relation.targetId for every accepted type.
//
// Properties stay ENUM/scalar ONLY (a relation enum + the node-id handle; never
// prose, Part 8). Returns { written, edges, failures } mirroring
// linkDomainToRelated in typed-domain.cjs.
function linkEntityRelations(db, params) {
  if (!isPlainObject(params)) {
    return { written: 0, edges: [], failures: [{ reason: 'invalid_params' }] };
  }
  const { entityId, relations } = params;
  if (typeof entityId !== 'string' || entityId.length === 0) {
    return { written: 0, edges: [], failures: [{ reason: 'invalid_entity_id' }] };
  }
  if (!Array.isArray(relations)) {
    return { written: 0, edges: [], failures: [{ reason: 'invalid_relations' }] };
  }
  const edges = [];
  const failures = [];
  for (const rel of relations) {
    if (!isPlainObject(rel)) {
      failures.push({ reason: 'invalid_relation' });
      continue;
    }
    const { targetId, edge, properties } = rel;
    const isAccepted = (typeof edge === 'string')
      && (ENTITY_EDGE_SUBSET.has(edge) || edge === ENTITY_ARTIFACT_LINK_EDGE);
    if (!isAccepted) {
      failures.push({ edge: String(edge).slice(0, 40), reason: 'edge_not_in_entity_subset' });
      continue;
    }
    if (typeof targetId !== 'string' || targetId.length === 0) {
      failures.push({ edge: edge, reason: 'invalid_target_id' });
      continue;
    }
    // Direction is source=entityId target=targetId for every accepted type.
    const sourceId = entityId;
    const destId = targetId;
    // ENUM/scalar props ONLY (Part 8). Default the relation enum + the entity node
    // id; an explicit caller properties bag is passed through (the caller keeps it
    // scalar; writeEdge JSON-serializes it).
    const props = isPlainObject(properties)
      ? properties
      : { relation: edge.toLowerCase(), entity_node: entityId };
    const r = writeEdge(db, {
      source_id: sourceId,
      target_id: destId,
      edge_type: edge,
      properties: props,
    });
    if (r && r.ok) {
      edges.push({ edge: edge, source: sourceId, target: destId, edge_id: r.edge_id });
    } else {
      failures.push({ edge: edge, reason: (r && r.reason) ? r.reason : 'edge_write_failed' });
    }
  }
  return { written: edges.length, edges: edges, failures: failures };
}

module.exports = {
  writeEntityNode,
  linkEntityRelations,
  ENTITY_NODE_TYPES,
  ENTITY_EDGE_SUBSET,
  ENTITY_NODE_ID,
};
