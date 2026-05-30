'use strict';
// Phase 125-00 -- navigation.cjs edge-write primitive (per CONTEXT.md Pass 3 GAP-2
// resolution). Adds writeEdge to the navigation.cjs closed surface as an additive
// extension following the Phase 110-03 logMemoryEvent precedent.
//
// Canon Part 4: every choice is graph data; this is the chokepoint primitive that
// lets Plan 06 selector-decisions.cjs + future Phases 116/117/118 write typed
// cascade edges without bypassing the closed surface.
//
// Canon Part 7: reuse-before-build -- the UPSERT statement mirrors
// lib/core/lazygraph-ops.cjs::upsertEdge (lines 990-1019) so sibling agents
// emit edges via the same UPSERT shape and the navigation chokepoint stays
// the single door for write traffic.
//
// Canon Part 8 invariant: writeEdge takes (db, params) -- a db handle owned by
// the caller (via openRoomDb) -- so this module never opens room.db itself. Zero
// direct room-db.cjs require here. The navigation pre-commit hook treats this
// file as part of the navigation/* allow-list, NOT as a bypass.

const crypto = require('node:crypto');

// Closed edge-type allowlist enforced by writeEdge. Mirrors the EVENT_TYPES Set
// pattern in lib/core/navigation/memory-events.cjs. Phase 125 ships DEFERRED +
// REJECTED (D7 typed cascade edge surface for F.1 defer / F.2 reject). Future
// phases (e.g. Phase 116 tension resolution, Phase 117 auto-explore, Phase 118
// MVA) extend this Set additively without canon amendment -- same idiom as the
// EVENT_TYPES additive blocks for Phases 88.2-00 / 89-07 / 116-00 / 117-00 /
// 110-02.
//
// Tests assert a FLOOR (DEFERRED + REJECTED present) and Set-instance shape --
// not an exact size -- so additive extensions cannot regress baseline.
const ALLOWED_EDGE_TYPES = Object.freeze(new Set([
  // Phase 125 D7 -- F-selector decision edges (LOCKED LOCAL per Canon Part 8).
  'DEFERRED',
  'REJECTED',
  // Phase 120-00 Wave 1 extension (Breakthrough Scan / Category G; D-18 HARD FLOOR enforcement
  //   + D-20 Cypher-provable principle). DERIVED_FROM is the structural enforcement: a
  //   Breakthrough node CANNOT surface without at least one DERIVED_FROM edge to an
  //   Artifact node. Mirrors the Phase 125-00 DEFERRED + REJECTED additive idiom.
  //
  // Canon Part 4: every choice is graph data. The Breakthrough node + its DERIVED_FROM
  //   edges are the graph-native artifact of pattern detection.
  //
  // Canon Part 8: writeEdge takes (db, params) over a LOCAL room.db handle; DERIVED_FROM
  //   never crosses to Brain. Cross-room aggregation forbidden (Phase 8 cross-room fence).
  //
  // D-20 enforcement: lib/core/breakthrough/schema.cjs::writeBreakthrough wraps the
  //   Breakthrough node insert + N DERIVED_FROM edge inserts in a single SQLite transaction.
  //   If any step fails, the transaction rolls back -- partial Breakthrough state CANNOT
  //   land. The Cypher invariant `MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact)
  //   RETURN count(a)` is guaranteed >= 1 by construction.
  'DERIVED_FROM',
  // Phase 120-02 Wave 2 extension (Breakthrough Scan / Category G; D-09 file-as-decision
  //   bridge). FILED_AS_DECISION is the typed edge that promotes a Breakthrough node into
  //   the Phase 88 decision-log machinery when the user picks the [File as decision]
  //   verb on F.7. Mirrors the Phase 120-00 DERIVED_FROM additive idiom verbatim.
  //
  // Canon Part 4: every choice is graph data. The Breakthrough -> Decision edge is the
  //   graph-native bridge that lets future related breakthroughs reference the filed
  //   decision via ENABLES edges (per CONTEXT.md D-15 "may be referenced as ENABLES in
  //   future related breakthroughs").
  //
  // Canon Part 8: writeEdge takes (db, params) over a LOCAL room.db handle;
  //   FILED_AS_DECISION never crosses to Brain. Cross-room aggregation forbidden.
  //
  // Emitted by: lib/core/breakthrough/verb-dispatch.cjs::handleFileAsDecision.
  // The destination Decision node id is 'decision:' + breakthroughId by convention;
  // Phase 88 decision-log machinery (or a future Phase 121 housekeeping pass) is
  // responsible for materializing the Decision node body when one does not yet exist.
  'FILED_AS_DECISION',
  // Phase 129-01 extension (Spine Repair; FOLLOWS_FROM is the 8th canonical
  // cascade edge type extending the shipped vocabulary INFORMS / CONTRADICTS /
  // CONVERGES / INVALIDATES / ENABLES / REJECTED / DEFERRED per the 2026-05-16
  // dual-graph review additive-scope verdict). Emitted by the spine repair work
  // when one memory_event clearly follows another in the proactive loop (e.g.
  // spine_read FOLLOWS_FROM suggestion_surfaced). Mirrors the Phase 120-02
  // FILED_AS_DECISION additive idiom verbatim.
  //
  // Canon Part 8: properties are ENUM-ONLY (a surface scalar); no freeform
  //   user-content fields ever land on a FOLLOWS_FROM edge -- the review's hard
  //   constraint. writeEdge takes (db, params) over a LOCAL room.db handle;
  //   FOLLOWS_FROM never crosses to Brain.
  //
  // The dual-graph proposal's lens-class taxonomy (ASSOCIATION_LENS /
  //   TRANSITION_LENS) is REJECTED -- the verdict accepts a SINGLE additive
  //   cascade type that extends the shipped vocabulary, not parallel lens
  //   classes. Those strings stay OUT of the Set so writeEdge rejects them.
  'FOLLOWS_FROM',
  // Phase 129-03 extension (Spine Repair; OPERATOR_TRANSITION is the typed edge
  // that lib/conversation/operator.cjs used to write via a direct node:sqlite
  // INSERT bypass -- a baselined Phase 128 substrate violation). This is the
  // legal home for that edge: routing the write through navigation.writeEdge
  // (the chokepoint) RETIRES the bypass while preserving the edge the bypass
  // produced (the OPERATOR_TRANSITION row between two operator nodes per Canon
  // Part 4). Consumer = lib/core/navigation/spine-events.cjs::logOperatorTransition
  // (when payload.write_transition_edge is true), called by operator.cjs's
  // transition() path. Mirrors the Phase 129-01 FOLLOWS_FROM additive idiom.
  //
  // Canon Part 8: writeEdge takes (db, params) over a LOCAL room.db handle;
  //   OPERATOR_TRANSITION never crosses to Brain. The five-operator vocabulary
  //   is generic; only the generic operator names land on the edge.
  'OPERATOR_TRANSITION',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// writeEdge(db, params) -- the 15th-style additive re-export on the
// navigation.cjs closed surface (see navigation.cjs header comment for the
// canonical re-export pattern alongside logMemoryEvent + firstCapturedLastTouchedBySection).
//
// Positional db (first arg, owned by caller via openRoomDb), params object
// (second arg) with: { source_id, target_id, edge_type, properties }.
//
// Returns { ok: true, edge_id, type, source, target } on success, or
// { ok: false, reason, detail? } on validation / write failure. Defensive --
// never throws on caller input. The underlying prepare/run is sync per the
// node:sqlite contract (matches the rest of the navigation module).
function writeEdge(db, params) {
  if (!params || typeof params !== 'object') {
    return { ok: false, reason: 'invalid_params' };
  }
  const { source_id, target_id, edge_type, properties } = params;
  if (typeof source_id !== 'string' || source_id.length === 0) {
    return { ok: false, reason: 'invalid_source_id' };
  }
  if (typeof target_id !== 'string' || target_id.length === 0) {
    return { ok: false, reason: 'invalid_target_id' };
  }
  if (typeof edge_type !== 'string' || !ALLOWED_EDGE_TYPES.has(edge_type)) {
    return { ok: false, reason: 'invalid_edge_type', detail: String(edge_type).slice(0, 40) };
  }
  const props = isPlainObject(properties) ? properties : {};
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const edgeId = 'edge:' + edge_type + ':' + Date.now() + ':' + crypto.randomBytes(4).toString('hex');
  try {
    db.prepare(
      'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
    ).run(source_id, target_id, edge_type, propsJson);
  } catch (e) {
    return { ok: false, reason: 'edge_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, edge_id: edgeId, type: edge_type, source: source_id, target: target_id };
}

module.exports = { ALLOWED_EDGE_TYPES, writeEdge };
