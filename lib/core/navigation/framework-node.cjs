'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/navigation/framework-node.cjs - the one writer for canon framework
 * nodes and USES_FRAMEWORK edges (Phase 366-05; D-11, D-16, Pitfall 7).
 *
 * Node before edge, always: mintFrameworkNode upserts the payload-light
 * `framework:<slug>` node through insertNode (on_conflict nothing, so a
 * re-mint never rewrites it), and only then does linkThingToFramework write
 * the USES_FRAMEWORK edge through edges.writeEdge. An edge therefore never
 * lacks its framework endpoint (SENS-19 edge_rows_missing_endpoint stays 0),
 * and writeEdge's ON CONFLICT(source, target, type) upsert means a thing never
 * gets a second edge to the same framework.
 *
 * The canon name is validated against data/framework-names.json (or the
 * caller's own names Set) before anything is written; a non-canon name writes
 * nothing. The thing node must already exist, so the source endpoint is never
 * dangling either.
 *
 * Transactions: the CALLER owns them. This module issues no BEGIN/COMMIT so
 * that a batch caller (the 366-09 indexer, the 366-10 backfill) can wrap the
 * node mint plus the edge for many things in one BEGIN/COMMIT of its own.
 *
 * Never throws: every failure is { ok: false, reason }. Local only (Canon
 * Part 8): nothing here touches the network, Theo or the Brain.
 */
const { insertNode } = require('../node-insert.cjs');
const edges = require('./edges.cjs');
const { FRAMEWORK_NODE_ID } = require('./reasoning-write.cjs');

const FRAMEWORK_NODE_TYPE = 'framework';
const FRAMEWORK_SOURCE_PATH = 'system:canon-framework';

function _loadNames() {
  // Lazy and fresh per call (no module cache), same as loadFrameworkNames.
  return require('../verification-stamp.cjs').loadFrameworkNames();
}

/*
 * mintFrameworkNode(db, canonName) -> { ok, node_id, reason }. Idempotent
 * upsert of `framework:<slug>`; does NOT validate canon membership (callers
 * that accept outside input go through linkThingToFramework).
 */
function mintFrameworkNode(db, canonName) {
  const nodeId = FRAMEWORK_NODE_ID(canonName);
  if (nodeId === null) return { ok: false, node_id: null, reason: 'invalid_framework_name' };
  try {
    insertNode(db, nodeId, FRAMEWORK_NODE_TYPE, JSON.stringify({ name: canonName }), { epistemic_type: 'observation', source_path: FRAMEWORK_SOURCE_PATH, on_conflict: 'nothing' });
    return { ok: true, node_id: nodeId, reason: null };
  } catch (_e) {
    return { ok: false, node_id: nodeId, reason: 'write_failed' };
  }
}

/*
 * linkThingToFramework(db, thingId, canonName, origin, opts) ->
 *   { ok, node_id, edge, reason }
 * opts.names: optional Set of canon names (defaults to the snapshot).
 * Order: validate -> thing exists -> mint framework node -> write edge.
 */
function linkThingToFramework(db, thingId, canonName, origin, opts) {
  try {
    if (typeof thingId !== 'string' || thingId.length === 0) {
      return { ok: false, node_id: null, edge: null, reason: 'invalid_thing_id' };
    }
    const names = (opts && opts.names instanceof Set) ? opts.names : _loadNames();
    if (typeof canonName !== 'string' || !names.has(canonName)) {
      return { ok: false, node_id: null, edge: null, reason: 'not_canon' };
    }
    const nodeId = FRAMEWORK_NODE_ID(canonName);
    if (nodeId === null) return { ok: false, node_id: null, edge: null, reason: 'invalid_framework_name' };

    const thing = db.prepare('SELECT 1 AS present FROM nodes WHERE id = ?').get(thingId);
    if (!thing) return { ok: false, node_id: nodeId, edge: null, reason: 'thing_missing' };

    // Node FIRST: the edge below must never exist without its endpoint.
    const minted = mintFrameworkNode(db, canonName);
    if (!minted.ok) return { ok: false, node_id: nodeId, edge: null, reason: minted.reason };

    const edge = edges.writeEdge(db, {
      source_id: thingId,
      target_id: nodeId,
      edge_type: 'USES_FRAMEWORK',
      properties: {
        relation: 'uses_framework',
        framework: nodeId.slice('framework:'.length),
        origin: typeof origin === 'string' ? origin : '',
      },
    });
    if (!edge || edge.ok !== true) {
      return { ok: false, node_id: nodeId, edge: edge || null, reason: (edge && edge.reason) || 'write_failed' };
    }
    return { ok: true, node_id: nodeId, edge, reason: null };
  } catch (_e) {
    return { ok: false, node_id: null, edge: null, reason: 'write_failed' };
  }
}

module.exports = {
  FRAMEWORK_NODE_TYPE,
  FRAMEWORK_SOURCE_PATH,
  mintFrameworkNode,
  linkThingToFramework,
};
