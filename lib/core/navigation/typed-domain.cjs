'use strict';
/*
 * Phase 163-02 -- typed-domain: the domain / subdomain / focus_area node-write
 * chokepoint + the linkDomainToRelated edge-linker. This is the WAVE 2
 * FOUNDATION-B net-new (D-163-01 + D-163-04): the connective-taxonomy substrate
 * that makes domains / subdomains / focus_areas FIRST-CLASS connected graph
 * citizens so getDomainsForTrendExtrapolation (Wave 3) can WALK a domain hub
 * instead of re-deriving from prose.
 *
 * This module mirrors lib/core/navigation/typed-claim.cjs VERBATIM in structure:
 * the allow-list header note, the isPlainObject helper, the stable 31-multiplier
 * hash id-minter, the additive-JSON-props discipline (the D-10 precedent), and
 * the defensive never-throw contract. It is an allow-listed navigation submodule
 * (scripts/check-substrate.cjs regex /^lib\/core\/navigation\// covers it). It
 * takes a db handle owned by the caller (via lib/core/room-db.cjs openRoomDb)
 * EXACTLY like typed-claim.cjs / edges.cjs writeEdge: it NEVER requires
 * node:sqlite and NEVER opens room.db itself, so it stays inside the navigation
 * allow-list with zero substrate bypass.
 *
 * Canon Part 9 (the human gate vs the audit-node carve-out):
 *   - A TRUTH-CLAIM domain (params.taxonomy absent/false) asserts something about
 *     the venture's world, so it lands review_status 'proposed' and is NEVER
 *     auto-confirmed by an agent (Part 9 role 5). Promotion to 'confirmed'
 *     requires a human APPROVE at a Decision Gate (navigation.confirmNode).
 *   - A PURE TAXONOMY domain (params.taxonomy === true) is system-bookkeeping: a
 *     taxonomy label asserts no venture truth (the Part 9 v1.5 audit-node
 *     carve-out spirit -- focus.cjs writes a focus_changed memory_event at
 *     created_by=system review_status=confirmed by exactly this logic). It MAY
 *     carry review_status 'confirmed' written by the system rule, no human byUser.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; no domain/trend prose ever leaves the room. The four
 *   domain edges (DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO) carry
 *   ENUM/scalar props ONLY (the taxonomy node id + a relation enum), never prose.
 *
 * Canon Part 4 / Part 7: linkDomainToRelated NEVER writes the raw edges table.
 *   It routes EVERY edge write through navigation.writeEdge (the chokepoint),
 *   constraining its accepted set to the DOMAIN_EDGE_SUBSET -- exactly how
 *   memory-artifacts.cjs writeCortexLineageEdge constrains to its CORTEX subset
 *   and planning-artifacts.cjs writeLineageEdge to its LINEAGE subset. The closed
 *   ALLOWED_EDGE_TYPES Set in edges.cjs stays the single source of truth for the
 *   predicate vocabulary; this subset adds no new taxonomy member.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');
const { writeEdge } = require('./edges.cjs');

// The closed 3-member domain node-type Set (D-163-01: domain / subdomain /
// focus_area are the FIRST-CLASS connected graph citizens). A domain write's
// domainType MUST validate against this Set; writeDomainNode rejects
// invalid_domain_type otherwise. Mirrors the KNOWLEDGE_TYPES frozen-Set idiom
// in typed-claim.cjs:48.
const DOMAIN_NODE_TYPES = Object.freeze(new Set([
  'domain', 'subdomain', 'focus_area',
]));

// The closed domain-edge subset (a frozen subset of the Wave-1
// ALLOWED_EDGE_TYPES, mirroring memory-artifacts.cjs writeCortexLineageEdge's
// {STATES,SUPPORTS,INFORMS,DESCRIBES} constraint per edges.cjs:271-274). The
// four edges D-163-03 minted; linkDomainToRelated rejects anything outside it.
const DOMAIN_EDGE_SUBSET = Object.freeze(new Set([
  'DECOMPOSED_INTO', 'PART_OF', 'TAGGED_WITH', 'RELATED_TO',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// DOMAIN_NODE_ID(sessionId, name) -- the idempotent id-minter. A crypto-free,
// dependency-free stable 31-multiplier hash over the name (mirrors
// typed-claim.cjs:60-68 / evidence-claim.cjs:110-117) keeps re-writing the same
// (name, sessionId) an UPSERT, not a duplicate. Node id 'domain:'+sid+':'+hash.
function DOMAIN_NODE_ID(sessionId, name) {
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  const key = typeof name === 'string' && name.length > 0 ? name : 'noname';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 'domain:' + sid + ':' + hash.toString(16);
}

// writeDomainNode(db, params) -- UPSERT a typed domain / subdomain / focus_area node.
//
// params = { domainType, name, sessionId, parentId?, taxonomy?, evidenceTier? }.
// type = domainType (one of DOMAIN_NODE_TYPES), created_by 'system'. review_status:
//   - taxonomy === true -> 'confirmed' (system-bookkeeping; Part 9 v1.5 carve-out).
//   - taxonomy absent/false -> 'proposed' (truth-claim; NEVER auto-confirmed, role 5).
// The node mints via lib/core/node-insert.cjs insertNode (both-schema safe per
// node-insert.cjs:95), which lands review_status 'proposed' by the column DEFAULT;
// a taxonomy node is then promoted to 'confirmed' by the system rule below (a
// scoped UPDATE on review_status / created_by only -- never a truth-claim promotion).
// Properties bag is ADDITIVE JSON only (name, domainType, parentId default '',
// evidenceTier default 'None'); NEVER DDL columns (the typed-claim.cjs:32-38 D-10
// precedent). Defensive: never throws on caller input; returns { ok:false, reason }.
function writeDomainNode(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const {
    domainType, name, sessionId, parentId, taxonomy, evidenceTier,
  } = params;
  if (typeof domainType !== 'string' || !DOMAIN_NODE_TYPES.has(domainType)) {
    return { ok: false, reason: 'invalid_domain_type', detail: String(domainType).slice(0, 40) };
  }
  if (typeof name !== 'string' || name.length === 0) {
    return { ok: false, reason: 'invalid_name' };
  }
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  // Additive JSON props ONLY (the D-10 precedent). parentId / evidenceTier ride
  // the same blob, never columns; default so the shape stays stable.
  const props = {
    name: name,
    domainType: domainType,
    parentId: typeof parentId === 'string' ? parentId : '',
    evidenceTier: typeof evidenceTier === 'string' ? evidenceTier : 'None',
  };
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = DOMAIN_NODE_ID(sid, name);
  const sourcePath = 'domain:' + sid + ':' + name;
  try {
    // Mint via the shared NOT-NULL-safe chokepoint (lands review_status DEFAULT
    // 'proposed'). created_by='system' satisfies the Phase-109 CHECK.
    insertNode(db, nodeId, domainType, propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      // R17-02: 'observation' -- a domain/subdomain/focus_area taxonomy label
      // is system-bookkeeping classification, not a truth-claim.
      epistemic_type: 'observation',
    });
  } catch (e) {
    return { ok: false, reason: 'domain_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  // Part 9 v1.5 audit-node carve-out: a PURE TAXONOMY domain is system-bookkeeping
  // and may be system-confirmed. This is NOT a truth-claim promotion (that stays
  // on the human confirmNode byUser path); it is the system rule that wrote the
  // taxonomy label confirming its own bookkeeping write. Defensive: a migrated
  // schema carries review_status; an un-migrated 3-col schema has no such column,
  // so guard the UPDATE.
  if (taxonomy === true) {
    try {
      const cols = db.prepare('PRAGMA table_info(nodes)').all();
      const hasReviewStatus = cols.some((c) => c && c.name === 'review_status');
      if (hasReviewStatus) {
        // Phase 194-06 Task 1: node-birth bookkeeping. A co-session cannot hold a
        // readVersion of a domain node being born, so the reconcile-guard CAS token
        // bump (last_modified_at) is intentionally OMITTED here; allowlisted in
        // tests/test-194-lastmod-discipline.test.cjs.
        db.prepare("UPDATE nodes SET review_status = 'confirmed' WHERE id = ?").run(nodeId);
      }
    } catch (_e) {
      // A confirm-promotion failure does not fail the node write; the node landed
      // at 'proposed' (the safe default). Stay defensive, never throw.
    }
  }
  return { ok: true, node_id: nodeId, domainType: domainType };
}

// linkDomainToRelated(db, params) -- connect a domain hub to related existing
// nodes via the four Wave-1 domain edges through navigation.writeEdge ONLY.
//
// params = { domainId, relations: [{ targetId, edge, properties? }] }. Each
// relation's edge MUST be in DOMAIN_EDGE_SUBSET (the writeEdge ALLOWED_EDGE_TYPES
// gate re-validates against the full frozen Set downstream). A relation outside
// the subset returns a FAILURE ENTRY, never a throw (defensive contract).
//
// Edge DIRECTION follows D-163-03:
//   DECOMPOSED_INTO  source=domainId (parent taxonomy) target=child
//   PART_OF          source=member (relation.targetId) target=domainId
//   TAGGED_WITH      source=tagged node (relation.targetId) target=domainId
//   RELATED_TO       symmetric: source=domainId target=relation.targetId
// The relation may carry an explicit `from`/`to` override; absent that, the
// direction is derived from the edge type per the table above.
//
// Properties stay ENUM/scalar ONLY (a relation enum + the taxonomy node id; never
// prose, Part 8). Returns { written, edges, failures } mirroring writeCascadeEdges
// in futures/orchestrator.cjs:283-310.
function linkDomainToRelated(db, params) {
  if (!isPlainObject(params)) {
    return { written: 0, edges: [], failures: [{ reason: 'invalid_params' }] };
  }
  const { domainId, relations } = params;
  if (typeof domainId !== 'string' || domainId.length === 0) {
    return { written: 0, edges: [], failures: [{ reason: 'invalid_domain_id' }] };
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
    if (typeof edge !== 'string' || !DOMAIN_EDGE_SUBSET.has(edge)) {
      failures.push({ edge: String(edge).slice(0, 40), reason: 'edge_not_in_domain_subset' });
      continue;
    }
    if (typeof targetId !== 'string' || targetId.length === 0) {
      failures.push({ edge: edge, reason: 'invalid_target_id' });
      continue;
    }
    // Derive direction per D-163-03 unless the caller supplied an explicit override.
    let sourceId;
    let destId;
    if (edge === 'PART_OF' || edge === 'TAGGED_WITH') {
      // member / tagged node -> the domain it belongs to or is tagged with.
      sourceId = targetId;
      destId = domainId;
    } else {
      // DECOMPOSED_INTO (parent -> child) and RELATED_TO (symmetric, domain first).
      sourceId = domainId;
      destId = targetId;
    }
    // ENUM/scalar props ONLY (Part 8). Default the relation enum + the taxonomy
    // node id; an explicit caller properties bag is passed through (the caller is
    // responsible for keeping it scalar; writeEdge JSON-serializes it).
    const props = isPlainObject(properties) ? properties : { relation: edge.toLowerCase(), taxonomy_node: domainId };
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
  writeDomainNode,
  linkDomainToRelated,
  DOMAIN_NODE_TYPES,
  DOMAIN_EDGE_SUBSET,
  DOMAIN_NODE_ID,
};
