/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 02 -- SQLite mirror writer for canonical RS schema.
 *
 * writeDiscovery(pair, opts) is the Tier 0 (Aura-unavailable) writer in the
 * dual-tier output layer. Mirrors the rs-neo4j-writer.cjs (Plan 89.3-01)
 * public API surface byte-for-byte so callers swap backends transparently.
 *
 * Schema (per kickoff section 5):
 *   Nodes: RSDiscovery + ReverseSalient + Innovation + Paper + Author + Institution
 *   Edges: DISCOVERED + DERIVED_FROM + ENABLES + AUTHORED_BY + AFFILIATED_WITH
 *
 * Stored in room.db's existing nodes + edges tables (the lazygraph-ops
 * schema). node.type and edge.type discriminate the kind. INSERT OR REPLACE
 * provides MERGE-equivalent idempotency: the id PRIMARY KEY on nodes and the
 * (source, target, type) composite PRIMARY KEY on edges are the dedup
 * mechanism. Re-running writeDiscovery with the same input pair yields zero
 * NEW rows (verified via SELECT COUNT before vs after).
 *
 * Deterministic id generation: the 3 core node ids (discovery_id, rs_id,
 * innovation_id) are sha256-derived from {query_concept, doc_concept,
 * classification}. This implementation is byte-identical to the
 * buildDeterministicIds in rs-neo4j-writer.cjs so the dual-tier dedup
 * contract is consistent across writers.
 *
 * Canon Part 7 (Reuse Before Build):
 *   - Opens room.db via room-db.cjs::openRoomDb (Phase 200-02): the canonical
 *     MIGRATED opener, so the node insert has the Phase-109 provenance columns.
 *     The prior lazygraph.openGraph path created a 3-column nodes table whose
 *     INSERT violated NOT NULL on any established (migrated) room.
 *   - Routes edge writes through navigation.writeEdge (Canon Part 9 chokepoint)
 *     and emits a reverse_salient_detected memory_event -- mirrors breakthrough/schema.cjs.
 *   - Consumes EDGE_TYPES from lazygraph-ops.cjs (extended in Plan 89.3-01)
 *   - Shares ExternalEgressViolation + auditQueryObject with 89.2 fetchers
 *
 * Canon Part 8 (Graph Boundary -- defense-in-depth): even though writes go
 * to the user's OWN room.db (not Brain), auditQueryObject runs over the SQL
 * params object BEFORE every INSERT. Catches forbidden patterns smuggled
 * through node properties OR opts.context.experts/papers arrays. Throws
 * ExternalEgressViolation on hit. Conservative because the data lineage
 * flows downstream into rs-mind-map (rendered HTML) and rs-expert-mapper
 * (Aura when available).
 *
 * Tier dispatch is NOT this module's responsibility. The writer assumes
 * Aura is unavailable (the dispatch surface in Plan 89.3-05 picks this
 * writer when isAuraConnected returns false). If room.db is missing or
 * unwritable, throws SQLiteUnreachableError -- a clean signal for the
 * dispatch layer to surface a user-facing 'room.db unavailable' message.
 *
 * rollback_cypher field name (despite carrying SQL DELETE statements
 * instead of Cypher DETACH DELETE) is intentional for cross-tier API
 * consistency. The dispatch layer (Plan 89.3-05) reads this field
 * uniformly across both writers.
 *
 * Pure CJS, zero npm deps, node built-ins only (crypto).
 */
'use strict';

const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryObject } = require('./rs-egress-prompts.cjs');
const lazygraph = require('./lazygraph-ops.cjs');
// Phase 200-02: route edge writes + the write-tracking event through the Part-9
// chokepoint (navigation.cjs), and open room.db via the canonical migrated opener
// (room-db.cjs openRoomDb) so the node insert has the Phase-109 provenance columns
// (source_path / created_by / review_status ...). The prior lazygraph.openGraph +
// 3-column node insert violated NOT NULL on any established (migrated) room.
const navigation = require('./navigation.cjs');
const { openRoomDb, closeRoomDb } = require('./room-db.cjs');

const SURFACE = 'rs-sqlite-mirror';
const SCHEMA_VERSION = '1.0';
const REQUIRED_FIELDS = Object.freeze(['query_concept', 'doc_concept', 'classification', 'thesis']);

// ---------- SQLiteUnreachableError ----------
//
// Tier-dispatch signal (NOT a security violation). Caller catches this and
// surfaces a user-facing 'room.db unavailable' message OR (if a deeper
// fallback exists) routes to an in-memory shim. Distinct from
// ExternalEgressViolation so the two error classes never get conflated in
// stack traces or audit logs.

class SQLiteUnreachableError extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'SQLiteUnreachableError';
    this.meta = meta || {};
  }
}

// ---------- buildDeterministicIds ----------
//
// The dedup contract shared with Plan 89.3-01 (rs-neo4j-writer). The
// implementation is byte-identical across both writers so the same pair
// produces the same 3 core ids regardless of which tier is active.
//
// stableKey is JSON.stringify of {q, d, c} (in fixed key order so the
// resulting bytes are stable across Node versions). sha256 then hex-slice
// the first 16 chars gives a 64-bit collision space (sufficient for
// per-room discovery counts; collision probability negligible).

function buildDeterministicIds(pair) {
  const stableKey = JSON.stringify({
    q: pair.query_concept,
    d: pair.doc_concept,
    c: pair.classification,
  });
  const hash = crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 16);
  return {
    discovery_id: 'rsd-' + hash,
    rs_id: 'rs-' + hash,
    innovation_id: 'inn-' + hash,
  };
}

// ---------- generateOpId ----------
//
// Random per-op telemetry id (NOT a node id). Caller may journal this for
// rollback bookkeeping. The id is intentionally non-deterministic so two
// re-runs of the same pair produce DIFFERENT op ids (proving the call
// happened twice even though the underlying rows were INSERT OR REPLACE
// matched).

function generateOpId() {
  return 'op-' + new Date().toISOString().slice(0, 10) + '-' + crypto.randomUUID();
}

// ---------- validateRequiredFields ----------
//
// Shape gate. Runs BEFORE audit + SQLite open. Throws TypeError naming the
// missing field so callers can surface a precise error to the user.

function validateRequiredFields(pair) {
  if (!pair || typeof pair !== 'object') {
    throw new TypeError(SURFACE + ': pair must be an object');
  }
  for (const f of REQUIRED_FIELDS) {
    if (typeof pair[f] !== 'string' || pair[f].length === 0) {
      throw new TypeError(SURFACE + ': missing required field: ' + f);
    }
  }
}

// ---------- validateEdgeType ----------
//
// Defense-in-depth: refuse to write any edge whose type is NOT in EDGE_TYPES
// (consumes the same constant rs-neo4j-writer uses, proving the dual-tier
// writers share the schema registry).

function validateEdgeType(edgeType) {
  if (!lazygraph.EDGE_TYPES.includes(edgeType)) {
    throw new TypeError(SURFACE + ': edge type not in EDGE_TYPES: ' + edgeType);
  }
}

// ---------- buildSqlParams ----------
//
// Assemble the rows to insert. Returns {nodeRows: [...], edgeRows: [...]}
// where each row's properties is the JSON-serialized property bag.
//
// Core nodes (always present):
//   - RSDiscovery (id = discovery_id)
//   - ReverseSalient (id = rs_id)
//   - Innovation (id = innovation_id)
//
// Conditional nodes (when opts.context provides them):
//   - Paper (id = paper.id from opts.context.papers)
//   - Author (id = name + '|' + (orcid || '__no_orcid__') -- mirrors the
//     name_orcid_key composite key in Aura schema)
//   - Institution (id = institution.name)
//
// Core edges (always present):
//   - (RSDiscovery)-[DISCOVERED]->(ReverseSalient)
//   - (ReverseSalient)-[DERIVED_FROM]->(Innovation)
//   - (RSDiscovery)-[ENABLES]->(Innovation)
//
// Conditional edges (when opts.context provides them):
//   - (RSDiscovery)-[DERIVED_FROM]->(Paper) for each paper
//   - (Author)-[AFFILIATED_WITH]->(Institution) when expert.institution present
//   - (Paper)-[AUTHORED_BY]->(Author) for each (paper, author) pair

function buildSqlParams(pair, ctx, ids) {
  const breakthrough = pair.breakthrough || {};
  const breakdown = breakthrough.breakdown || {};
  const created_at = new Date().toISOString();

  const papers = Array.isArray(ctx.papers) ? ctx.papers : [];
  const experts = Array.isArray(ctx.experts) ? ctx.experts : [];

  const nodeRows = [];
  const edgeRows = [];

  // RSDiscovery
  nodeRows.push({
    id: ids.discovery_id,
    type: 'RSDiscovery',
    properties: JSON.stringify({
      classification: pair.classification,
      breakthrough_score: typeof breakthrough.score === 'number' ? breakthrough.score : 0,
      dominant_dimension: typeof breakthrough.dominant_dimension === 'string' ? breakthrough.dominant_dimension : '',
      thesis: pair.thesis,
      bridge_concept: typeof pair.bridge_concept === 'string' ? pair.bridge_concept : '',
      diff: typeof pair.diff === 'number' ? pair.diff : 0,
      lsa: typeof pair.lsa === 'number' ? pair.lsa : 0,
      bert: typeof pair.bert === 'number' ? pair.bert : 0,
      feasibility: typeof breakdown.feasibility === 'number' ? breakdown.feasibility : 0,
      market: typeof breakdown.market === 'number' ? breakdown.market : 0,
      magnitude: typeof breakdown.magnitude === 'number' ? breakdown.magnitude : 0,
      advantage: typeof breakdown.advantage === 'number' ? breakdown.advantage : 0,
      impact: typeof breakdown.impact === 'number' ? breakdown.impact : 0,
      created_at: created_at,
      room_id: typeof ctx.room_id === 'string' ? ctx.room_id : '',
      domain: typeof ctx.domain === 'string' ? ctx.domain : '',
    }),
  });

  // ReverseSalient
  nodeRows.push({
    id: ids.rs_id,
    type: 'ReverseSalient',
    properties: JSON.stringify({
      query_concept: pair.query_concept,
      doc_concept: pair.doc_concept,
      classification: pair.classification,
    }),
  });

  // Innovation
  nodeRows.push({
    id: ids.innovation_id,
    type: 'Innovation',
    properties: JSON.stringify({
      thesis: pair.thesis,
      breakthrough_score: typeof breakthrough.score === 'number' ? breakthrough.score : 0,
    }),
  });

  // Core edges (3)
  edgeRows.push({
    source: ids.discovery_id,
    target: ids.rs_id,
    type: 'DISCOVERED',
    properties: JSON.stringify({}),
  });
  edgeRows.push({
    source: ids.rs_id,
    target: ids.innovation_id,
    type: 'DERIVED_FROM',
    properties: JSON.stringify({}),
  });
  edgeRows.push({
    source: ids.discovery_id,
    target: ids.innovation_id,
    type: 'ENABLES',
    properties: JSON.stringify({}),
  });

  // Paper nodes + DERIVED_FROM edges
  for (const p of papers) {
    if (!p || typeof p.id !== 'string') continue;
    nodeRows.push({
      id: p.id,
      type: 'Paper',
      properties: JSON.stringify({
        title: typeof p.title === 'string' ? p.title : '',
        doi: typeof p.doi === 'string' ? p.doi : '',
        source: typeof p.source === 'string' ? p.source : '',
      }),
    });
    edgeRows.push({
      source: ids.discovery_id,
      target: p.id,
      type: 'DERIVED_FROM',
      properties: JSON.stringify({}),
    });
  }

  // Author + Institution nodes + AFFILIATED_WITH edges (from experts)
  for (const e of experts) {
    if (!e || typeof e.name !== 'string') continue;
    const authorKey = e.name + '|' + (typeof e.orcid === 'string' && e.orcid.length > 0 ? e.orcid : '__no_orcid__');
    nodeRows.push({
      id: authorKey,
      type: 'Author',
      properties: JSON.stringify({
        name: e.name,
        orcid: typeof e.orcid === 'string' ? e.orcid : '',
        h_index_estimate: typeof e.h_index_estimate === 'number' ? e.h_index_estimate : 0,
      }),
    });
    if (typeof e.institution === 'string' && e.institution.length > 0) {
      nodeRows.push({
        id: e.institution,
        type: 'Institution',
        properties: JSON.stringify({ name: e.institution }),
      });
      edgeRows.push({
        source: authorKey,
        target: e.institution,
        type: 'AFFILIATED_WITH',
        properties: JSON.stringify({}),
      });
    }
  }

  // AUTHORED_BY edges from (paper, author) pairs derived from papers[].authors
  for (const p of papers) {
    if (!p || typeof p.id !== 'string') continue;
    const authors = Array.isArray(p.authors) ? p.authors : [];
    for (const a of authors) {
      if (!a || typeof a.name !== 'string') continue;
      const authorKey = a.name + '|' + (typeof a.orcid === 'string' && a.orcid.length > 0 ? a.orcid : '__no_orcid__');
      edgeRows.push({
        source: p.id,
        target: authorKey,
        type: 'AUTHORED_BY',
        properties: JSON.stringify({}),
      });
    }
  }

  return { nodeRows: nodeRows, edgeRows: edgeRows };
}

// ---------- buildRollbackSql ----------
//
// Returns multi-statement SQL string. Edges DELETEs FIRST (FK safety),
// then 3 core nodes DELETE. Shared Paper/Author/Institution NOT deleted
// (may be referenced by other RSDiscoveries; rolling them back would
// corrupt the graph for unrelated discoveries).

function buildRollbackSql(ids) {
  return [
    'DELETE FROM edges WHERE source = \'' + ids.discovery_id + '\' OR target = \'' + ids.discovery_id + '\';',
    'DELETE FROM edges WHERE source = \'' + ids.rs_id + '\' OR target = \'' + ids.rs_id + '\';',
    'DELETE FROM edges WHERE source = \'' + ids.innovation_id + '\' OR target = \'' + ids.innovation_id + '\';',
    'DELETE FROM nodes WHERE id = \'' + ids.discovery_id + '\';',
    'DELETE FROM nodes WHERE id = \'' + ids.rs_id + '\';',
    'DELETE FROM nodes WHERE id = \'' + ids.innovation_id + '\';',
  ].join('\n');
}

// ---------- writeDiscovery ----------
//
// The public entry point. Orchestration:
//   1. Validate pair shape (throws TypeError on missing required field)
//   2. Build deterministic ids (sha256-derived)
//   3. Build SQL params (nodeRows + edgeRows arrays)
//   4. Run auditQueryObject pre-write (Canon Part 8 defense-in-depth;
//      throws ExternalEgressViolation on FORBIDDEN_PATTERNS hit)
//   5. Validate every edge type against EDGE_TYPES (defensive)
//   6. Open room.db via lazygraph.openGraph (throws SQLiteUnreachableError
//      on backend failure -- clean tier-dispatch signal)
//   7. Count nodes + edges BEFORE; INSERT OR REPLACE every row; count AFTER
//   8. Return {wrote_node_count, wrote_edge_count, rollback_cypher,
//      aura_op_id, schema_version}
//   9. Always close room.db in finally

async function writeDiscovery(pair, opts) {
  opts = opts || {};
  validateRequiredFields(pair);

  const roomDir = (typeof opts.roomDir === 'string' && opts.roomDir.length > 0) ? opts.roomDir : process.cwd();
  const ids = buildDeterministicIds(pair);
  const ctx = (opts.context && typeof opts.context === 'object') ? opts.context : {};
  const params = buildSqlParams(pair, ctx, ids);

  // Canon Part 8 defense-in-depth: audit BEFORE SQLite write. Covers the
  // entire SQL params object (nodeRows + edgeRows) via JSON.stringify walk
  // in auditQueryObject. Forbidden bytes anywhere in the property JSON
  // throw before any INSERT executes.
  auditQueryObject(params, SURFACE);

  // Validate every edge type before writing (defensive; Canon Part 7 reuse
  // of EDGE_TYPES schema registry).
  for (const e of params.edgeRows) validateEdgeType(e.type);

  let conn;
  try {
    // Ensure .mindrian exists so openRoomDb can create + migrate room.db to the
    // Phase-109 provenance schema (the node insert below needs its columns).
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    conn = openRoomDb(roomDir);
  } catch (err) {
    throw new SQLiteUnreachableError(
      'room.db unavailable: ' + (err && err.message ? err.message : String(err)),
      { original: err && err.message ? err.message : String(err), roomDir: roomDir }
    );
  }
  if (!conn) {
    throw new SQLiteUnreachableError('room.db unavailable (openRoomDb returned null)', { roomDir: roomDir });
  }

  try {
    const beforeNodeCount = conn.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    const beforeEdgeCount = conn.prepare('SELECT COUNT(*) AS n FROM edges').get().n;

    // Nodes: written directly into the nodes table with the Phase-109 provenance
    // columns (created_by='system', review_status='proposed'). ON CONFLICT(id)
    // preserves created_at on re-run while refreshing properties + last_seen_at, so
    // a re-run of the same pair writes zero NEW node rows (idempotency contract).
    // Mirrors lib/core/breakthrough/schema.cjs: nodes direct, edges via the chokepoint.
    const nowMs = Date.now();
    const insertNode = conn.prepare(
      'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) ' +
      "VALUES (?, ?, ?, 'system:rs-sqlite-mirror', 'system', NULL, 'proposed', ?, ?) " +
      'ON CONFLICT(id) DO UPDATE SET properties = excluded.properties, last_seen_at = excluded.last_seen_at'
    );
    for (const n of params.nodeRows) insertNode.run(n.id, n.type, n.properties, nowMs, nowMs);

    // Edges: Canon Part 9 -- route every edge through the navigation.writeEdge
    // chokepoint (idempotent ON CONFLICT(source,target,type) DO UPDATE), never a
    // direct edges INSERT. The five RS edge types are members of the frozen
    // ALLOWED_EDGE_TYPES set (DISCOVERED + AUTHORED_BY minted in 200-02 Wave 1).
    for (const e of params.edgeRows) {
      let props = {};
      try { props = JSON.parse(e.properties); } catch (_pe) { props = {}; }
      const r = navigation.writeEdge(conn, {
        source_id: e.source, target_id: e.target, edge_type: e.type, properties: props,
      });
      if (!r.ok) throw new Error('rs_writeEdge_failed:' + r.reason);
    }

    const afterNodeCount = conn.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    const afterEdgeCount = conn.prepare('SELECT COUNT(*) AS n FROM edges').get().n;

    // Canon Part 9: record the discovery write as a tracked memory_event through the
    // chokepoint. Best-effort -- a schema/insert failure here NEVER fails the write
    // (nodes + edges already landed). Part 8: payload is enum/scalar handles only
    // (deterministic id + classification enum + counts), never a paper/abstract body.
    try {
      navigation.logMemoryEvent(conn, 'reverse_salient_detected', {
        discovery_id: ids.discovery_id,
        classification: pair.classification,
        wrote_node_count: afterNodeCount - beforeNodeCount,
        wrote_edge_count: afterEdgeCount - beforeEdgeCount,
        schema_version: SCHEMA_VERSION,
        source_path: 'system:rs-sqlite-mirror',
        created_by: 'system',
      });
    } catch (_evErr) { /* best-effort tracking; the write itself already succeeded */ }

    return {
      wrote_node_count: afterNodeCount - beforeNodeCount,
      wrote_edge_count: afterEdgeCount - beforeEdgeCount,
      rollback_cypher: buildRollbackSql(ids),
      aura_op_id: generateOpId(),
      schema_version: SCHEMA_VERSION,
    };
  } catch (err) {
    if (err instanceof ExternalEgressViolation) throw err;
    if (err instanceof TypeError) throw err;
    throw new SQLiteUnreachableError(
      'SQLite write failed: ' + (err && err.message ? err.message : String(err)),
      { original: err && err.message ? err.message : String(err) }
    );
  } finally {
    if (conn) {
      try { closeRoomDb(conn); } catch (_e) { /* best effort */ }
    }
  }
}

// ---------- Edge type registry consumption ----------
//
// Defensive guard: refuse to load if the EDGE_TYPES extension Plan 89.3-01
// shipped is missing. Non-throwing in production (warn on stderr) so the
// writer remains usable while the upstream is fixed; downstream callers
// will hit validateEdgeType which throws TypeError instead.

const REQUIRED_EDGE_TYPES = ['DISCOVERED', 'DERIVED_FROM', 'ENABLES', 'AUTHORED_BY', 'AFFILIATED_WITH'];
for (const t of REQUIRED_EDGE_TYPES) {
  if (!lazygraph.EDGE_TYPES.includes(t)) {
    process.stderr.write(SURFACE + ': WARNING -- EDGE_TYPES missing required type: ' + t + '\n');
  }
}

// ---------- Exports ----------

module.exports = {
  writeDiscovery,
  SQLiteUnreachableError,
  SCHEMA_VERSION,
  REQUIRED_FIELDS,
  _test: {
    buildDeterministicIds,
    generateOpId,
    buildSqlParams,
    buildRollbackSql,
    validateRequiredFields,
    validateEdgeType,
  },
};
