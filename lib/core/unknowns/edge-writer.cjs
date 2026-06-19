'use strict';
// ========================================
// MINDRIAN UNKNOWN-UNKNOWNS PROPOSED-FINDING WRITER (Phase 165 Wave 4)
// The proposed-node + frozen-edge writer for the unknown-unknowns blind-spot
// engine: clones the SHIPPED Phase-169 graph-derivation candidateToFinding /
// _candidateHash idiom + the issue-tree.cjs writeIssueTreeEdges chokepoint
// discipline, so a proxy-labeled UU instance lands as a PROPOSED truth-claim NODE
// (review_status on the NODE, Part 9) plus a frozen cascade EDGE via the
// navigation chokepoint. It does NOT roll its own raw SQL.
//
// Two clones, fused:
//   (1) graph-derivation.candidateToFinding (lib/core/graph-derivation.cjs:95) --
//       a {source, target, edge_type, reason} producer tuple -> the finding shape
//       the writer consumes (knowledge_type + text + a STABLE node_seed +
//       enum/scalar edge properties). We re-export the shipped adapter (Part 7
//       reuse: do not fork the writer); _candidateHash gives the stable id so a
//       re-run does NOT re-mint (idempotent, Pitfall 3 / GDH-07).
//   (2) issue-tree.cjs writeIssueTreeEdges (lib/core/issue-tree.cjs:242) -- route
//       EVERY edge through navigation.writeEdge, count written/rejected, NEVER
//       swallow a rejection. Cloned as writeFindings below.
//
// THE MODULE-LOAD FROZEN-EDGE SELF-CHECK (clone issue-tree.cjs:67, D-165-08): the
// only edge types this engine emits are the four frozen FROZEN_ENGINE_EDGES
// (INVALIDATES / ROOT_CAUSES / ENABLES / FEEDS_INTO). At require time we assert
// every emittable type is a frozen member of the LIVE ALLOWED_EDGE_TYPES
// (lib/core/navigation/edges.cjs); a remap that DRIFTS out of the frozen set
// throws BEFORE any finding is written. 165 mints NO new edge type and makes ZERO
// edges.cjs change (remap-only).
//
// PROPOSED only (Part 9 role 5): a proxy-labeled finding lands review_status
// 'proposed'. The writer NEVER calls confirmNode and NEVER auto-confirms a blind
// spot; only a human byUser promotes at the F.1 Decision Gate (the orchestrator
// HALTS there). A confirmed node is NEVER downgraded (writeClaimNode's ON CONFLICT
// EXCLUDES review_status; we record the pre-state truthfully so a re-run is a
// verifiable no-op).
//
// Canon Part 8 / D-165-10: zero Brain require; all writes via navigation.cjs; the
// claim BODY lives on the NODE, the edge carries enum/scalar properties only (the
// candidateToFinding reason.slice(0,64) idiom). NO em-dashes (CLAUDE.md HARD RULE);
// CJS; no new deps.
//
// Sources: lib/core/graph-derivation.cjs (candidateToFinding:95, _candidateHash:79,
// runDerivation write step:222-286), lib/core/issue-tree.cjs (the module-load
// self-check:67, writeIssueTreeEdges:242), lib/core/navigation.cjs (writeClaimNode,
// writeEdge, CLAIM_NODE_ID), the shared iface (FROZEN_ENGINE_EDGES), 165-RESEARCH
// section 5 (the frozen-edge contract).
// ========================================

const navigation = require('../navigation.cjs');
const { ALLOWED_EDGE_TYPES } = require('../navigation/edges.cjs');
const { candidateToFinding } = require('../graph-derivation.cjs');
const { FROZEN_ENGINE_EDGES } = require('./iface.cjs');

// Module-load self-check (fail-fast; clone issue-tree.cjs:67). Every edge type the
// engine can emit MUST be a frozen member of the LIVE ALLOWED_EDGE_TYPES. A remap
// that drifted out of the frozen set throws at require time so the regression
// surfaces before any finding is written (D-165-08; threat T-165-10).
(function assertEmittableEdgesAreFrozen() {
  for (const t of Object.values(FROZEN_ENGINE_EDGES)) {
    if (!ALLOWED_EDGE_TYPES.has(t)) {
      throw new Error(
        'unknowns/edge-writer: emittable edge type ' + t
        + ' is not in the frozen ALLOWED_EDGE_TYPES set (D-165-08 remap-only; 165 mints no new edge type)'
      );
    }
  }
})();

/**
 * writeFinding(db, candidate, opts?) -> { node_id, review_status, minted, edge }
 *
 * Clone of the graph-derivation runDerivation write step (lib/core/graph-derivation
 * .cjs:207-286): turn a producer candidate {source, target, edge_type, reason} into
 * the finding shape via the SHIPPED candidateToFinding adapter, write the PROPOSED
 * truth-claim NODE via navigation.writeClaimNode, and write the frozen cascade EDGE
 * via navigation.writeEdge. Idempotent: the stable node_seed (_candidateHash) keeps
 * a re-run an UPSERT (minted=false); a confirmed node is NEVER downgraded. Routes
 * EVERY write through the navigation chokepoint (no raw SQL). Returns null when the
 * candidate is unusable. Defensive: never throws on caller input.
 *
 * @param {object} db          a caller-owned room.db handle (navigation chokepoint).
 * @param {object} candidate   { source, target, edge_type, reason } producer tuple.
 * @param {object} [opts]      { sessionId } -- the stable id namespace (default 'uu-scan').
 */
function writeFinding(db, candidate, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const sessionId = (typeof o.sessionId === 'string' && o.sessionId.length > 0)
    ? o.sessionId : 'uu-scan';

  // Frozen-subset guard (defense in depth -- the orchestrator already filters):
  // only the four frozen engine edges are emittable.
  if (!candidate || typeof candidate !== 'object') return null;
  if (Object.values(FROZEN_ENGINE_EDGES).indexOf(candidate.edge_type) === -1) {
    return null;
  }

  // (1) clone candidateToFinding: producer tuple -> finding intent (PROPOSED node
  //     intent + the stable node_seed + enum/scalar edge properties).
  const finding = candidateToFinding(candidate);
  if (!finding) return null;

  // The stable proposed-node id (Pitfall 3 / GDH-07): the same candidate re-derives
  // the same node id, so a re-run UPSERTs rather than re-mints.
  const stableId = (typeof navigation.CLAIM_NODE_ID === 'function')
    ? navigation.CLAIM_NODE_ID(sessionId, finding.node_seed)
    : ('claim:' + sessionId + ':' + finding.node_seed);

  // The idempotence guard: probe the pre-state so minted/preConfirmed is truthful
  // and a 'confirmed' node is never downgraded.
  let preState = '';
  if (db && typeof db.prepare === 'function') {
    try {
      const existing = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(stableId);
      if (existing && typeof existing.review_status === 'string') {
        preState = existing.review_status;
      }
    } catch (_e) { preState = ''; }
  }
  const preProposed = (preState === 'proposed');
  const preConfirmed = (preState === 'confirmed');
  const minted = !(preProposed || preConfirmed);
  // The engine writes PROPOSED only; only confirmNode (human byUser) promotes.
  const reviewStatus = preConfirmed ? 'confirmed' : 'proposed';

  let nodeId = stableId;
  // (2a) write the PROPOSED truth-claim NODE through the navigation chokepoint.
  if (db && typeof db.prepare === 'function') {
    const claim = navigation.writeClaimNode(db, {
      knowledge_type: finding.knowledge_type,
      text: finding.text,
      sessionId: sessionId,
      sourceSegment: finding.node_seed,
    });
    if (claim && claim.ok && typeof claim.node_id === 'string') {
      nodeId = claim.node_id;
    }
  }

  // (2b) write the frozen cascade EDGE through navigation.writeEdge (the chokepoint;
  //      no raw edge SQL). The edge carries enum/scalar properties ONLY -- NEVER
  //      review_status (Pitfall 1). Never swallow a rejection (clone
  //      writeIssueTreeEdges discipline).
  let edgeOk = true;
  let edgeReason = '';
  if (db && typeof db.prepare === 'function') {
    const res = navigation.writeEdge(db, {
      source_id: finding.edge.source_id,
      target_id: finding.edge.target_id,
      edge_type: finding.edge.edge_type,
      properties: finding.edge.properties,
    });
    edgeOk = !!(res && res.ok);
    edgeReason = (res && res.reason) ? res.reason : '';
  }

  return {
    node_id: nodeId,
    review_status: reviewStatus,
    knowledge_type: finding.knowledge_type,
    minted: minted,
    preConfirmed: preConfirmed,
    edge: {
      source: finding.edge.source_id,
      target: finding.edge.target_id,
      type: finding.edge.edge_type,
      edge_type: finding.edge.edge_type,
      properties: finding.edge.properties,
      ok: edgeOk,
      reason: edgeReason,
    },
  };
}

/**
 * writeFindings(db, candidates, opts?) -> { nodes, edges, written, rejected }
 *
 * Clone of issue-tree.cjs writeIssueTreeEdges: route EVERY candidate through
 * writeFinding, COUNT written vs rejected, NEVER swallow a rejection. Returns the
 * proposed nodes + the typed edges + the written/rejected tallies so the
 * orchestrator can surface the count. All writes via the navigation chokepoint.
 */
function writeFindings(db, candidates, opts) {
  const list = Array.isArray(candidates) ? candidates : [];
  const nodes = [];
  const edges = [];
  let written = 0;
  let rejected = 0;
  for (const candidate of list) {
    const r = writeFinding(db, candidate, opts);
    if (!r) { rejected += 1; continue; }
    nodes.push({
      id: r.node_id,
      review_status: r.review_status,
      knowledge_type: r.knowledge_type,
      minted: r.minted,
      preConfirmed: r.preConfirmed,
    });
    edges.push(r.edge);
    if (r.edge.ok) { written += 1; } else { rejected += 1; }
  }
  return { nodes: nodes, edges: edges, written: written, rejected: rejected };
}

module.exports = {
  writeFinding,
  writeFindings,
  // Re-export the SHIPPED adapter (Part 7 reuse) + the frozen bank so a consumer
  // (the orchestrator, the frozen-edges test) reads them from one place.
  candidateToFinding,
  FROZEN_ENGINE_EDGES,
};
