'use strict';
// Phase 120-00 Wave 1 Task 3 -- Breakthrough node schema + writeBreakthrough atomic-transaction
// writer. Per CONTEXT.md D-18 HARD FLOOR + D-20 Cypher-provable principle: every
// Breakthrough node that lands in room.db MUST have at least one DERIVED_FROM edge to an
// Artifact node. The Cypher invariant
//   MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact) WHERE b.id = $id RETURN count(a)
// is guaranteed >= 1 BY CONSTRUCTION (this function refuses to land a breakthrough without
// provenance) AND BY TRANSACTION (the node insert + N edge inserts are wrapped in a single
// SQLite transaction; partial state cannot land; node:sqlite does not expose better-sqlite3
// style db.transaction(fn) so we use BEGIN / COMMIT / ROLLBACK explicitly, matching the
// Phase 119-01 lib/core/room-discard-cascade.cjs pattern + Phase 109 nodes-provenance
// migration pattern).
//
// Canon Part 4: every choice is graph data. The Breakthrough node is the typed graph
//   artifact of pattern detection.
// Canon Part 8: writes are LOCAL only; no Brain coupling. The HARD RULE source-grep
//   tripwire fires in tests/test-120-00-scaffold.sh Gate 8 + schema.test.cjs Test 11.
// Canon Part 9: ALL edge writes route through navigation.cjs::writeEdge chokepoint.
//   The node insert is direct INSERT into the `nodes` table (the same pattern as
//   memory-events.cjs::logEvent which IS the chokepoint helper for memory_event nodes;
//   schema.cjs mirrors this precedent as the per-type insert helper for breakthrough
//   nodes).
//
// CONSTITUTIONAL: this function is the ONLY way breakthroughs land in room.db. Plan 120-02
// session-start scanner MUST route through this function. Bypassing it = Canon Part 4 + D-20
// violation. The Cypher-provable invariant is not a procedural promise -- it is a structural
// property of the SQL transaction wrapper.
//
// Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): zero U+2014 in source.

const crypto = require('node:crypto');
const navigation = require('../navigation.cjs');
const { insertNode } = require('../node-insert.cjs');

const BREAKTHROUGH_NODE_TYPE = 'breakthrough';

// The 4 D-01 detector kinds. Must stay aligned with lib/core/breakthrough/detectors.cjs
// DETECTOR_TYPES (frozen array). Duplication is intentional -- this module does NOT
// require detectors.cjs (Canon Part 7 reuse-before-build does not apply when the
// inverse dependency would couple the schema layer to detector internals).
const BREAKTHROUGH_KIND = Object.freeze({
  CONVERGENCE: 'convergence',
  CONTRADICTION_RESOLVED: 'contradiction_resolved',
  CROSS_DOMAIN_ANALOGY: 'cross_domain_analogy',
  REVERSE_SALIENT_CLOSED: 'reverse_salient_closed',
});

// validateProvenance is the D-20 HARD FLOOR entry guard. Refuses any breakthrough
// without at least one non-empty artifact_id. Returns sanitized_artifact_ids on ok
// so writeBreakthrough can rely on a clean array (filtered for empty strings +
// non-string entries upstream of the SQLite write).
function validateProvenance(breakthrough) {
  if (!breakthrough || typeof breakthrough !== 'object') {
    return { ok: false, reason: 'invalid_input' };
  }
  if (typeof breakthrough.id !== 'string' || breakthrough.id.length === 0) {
    return { ok: false, reason: 'breakthrough_id_required' };
  }
  const ids = Array.isArray(breakthrough.artifact_ids)
    ? breakthrough.artifact_ids.filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  if (ids.length === 0) {
    // D-20 HARD FLOOR: every breakthrough must be Cypher-provable. Provenance-less
    // breakthroughs are a CONSTITUTIONAL VIOLATION; the write is refused at the gate.
    return { ok: false, reason: 'provenance_required' };
  }
  return { ok: true, sanitized_artifact_ids: ids };
}

// writeBreakthrough(db, breakthrough) -> {ok:true, breakthroughId, edgeIds:[...]} |
//                                        {ok:false, reason:string}
// Atomic transaction wrapper. node:sqlite has no db.transaction(fn) -- we use BEGIN /
// COMMIT / ROLLBACK explicitly. If any step fails, the entire transaction rolls back --
// partial Breakthrough state cannot land.
//
// Inserts a row into `nodes` with type='breakthrough'. The properties JSON carries:
//   kind, confidence, theme, differential, cross_section_linked,
//   detected_at, window_start, window_end, surfaced (initially false).
// Plan 120-02 scanner flips properties.surfaced -> true at F.7 surface time.
//
// For each artifact_id, writes a DERIVED_FROM edge via navigation.writeEdge. The
// edge properties carry {detected_at, detector_kind}. If any writeEdge call fails,
// throws to trigger ROLLBACK.
function writeBreakthrough(db, breakthrough) {
  const validation = validateProvenance(breakthrough);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
    return { ok: false, reason: 'invalid_db' };
  }
  const artifactIds = validation.sanitized_artifact_ids;
  const nowMs = Date.now();
  const breakthroughId = breakthrough.id;
  const detectorKind = typeof breakthrough.kind === 'string' ? breakthrough.kind : 'unknown';
  const confidence = typeof breakthrough.confidence === 'number' ? breakthrough.confidence : 0;

  // Build the properties payload for the breakthrough node. Theme sliced to 200 chars
  // per the Phase 90-06 sanitizeDetailScalar precedent (Canon Part 8 boundary).
  const props = {
    kind: detectorKind,
    confidence: confidence,
    theme: typeof breakthrough.theme === 'string' ? breakthrough.theme.slice(0, 200) : '',
    differential: typeof breakthrough.differential === 'number' ? breakthrough.differential : 0,
    cross_section_linked: !!breakthrough.cross_section_linked,
    detected_at: typeof breakthrough.detected_at === 'number' ? breakthrough.detected_at : nowMs,
    window_start: typeof breakthrough.window_start === 'number' ? breakthrough.window_start : (nowMs - 14 * 24 * 3600 * 1000),
    window_end: typeof breakthrough.window_end === 'number' ? breakthrough.window_end : nowMs,
    surfaced: false,
  };
  const propsJson = JSON.stringify(props);

  // Atomic transaction (node:sqlite BEGIN / COMMIT / ROLLBACK). Mirror the Phase 119-01
  // room-discard-cascade.cjs pattern + the Phase 109 nodes-provenance migration pattern.
  let edgeIds = [];
  try {
    db.exec('BEGIN');
  } catch (err) {
    return { ok: false, reason: 'transaction_begin_failed:' + (err.message || '').slice(0, 80) };
  }

  try {
    // Step 1: insert the Breakthrough node through the R17-01 node-write
    // chokepoint (lib/core/node-insert.cjs). source_path + created_by +
    // review_status per Phase 109 schema CHECK constraints (created_by IN
    // ('user','larry','import','brain','system')). insertNode THROWS on
    // failure, which this try/catch already converts into the existing
    // ROLLBACK path below -- unchanged control flow.
    //
    // R17-01 delta (260903-gdm, navigator-confirmed Task 4): this write
    // previously had NO ON CONFLICT clause and threw on a duplicate id,
    // rolling back the whole transaction. insertNode's default ON CONFLICT
    // DO UPDATE makes a re-detected breakthrough with the same caller-supplied
    // id a silent upsert instead. Confirmed as a correctness improvement, not
    // an assumption.
    insertNode(db, breakthroughId, 'breakthrough', propsJson, {
      source_path: 'system:breakthrough-schema',
      created_by: 'system',
      confidence: confidence,
      review_status: 'proposed',
    });

    // Step 2: insert N DERIVED_FROM edges via navigation.writeEdge.
    for (const artifactId of artifactIds) {
      const result = navigation.writeEdge(db, {
        source_id: breakthroughId,
        target_id: artifactId,
        edge_type: 'DERIVED_FROM',
        properties: { detected_at: nowMs, detector_kind: detectorKind },
      });
      if (!result.ok) {
        throw new Error('writeEdge_failed:' + result.reason);
      }
      // The navigation.cjs writeEdge returns edge_id (snake_case per Phase 125-00).
      edgeIds.push(result.edge_id);
    }

    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_e2) { /* swallow */ }
    const reason = err && err.message ? err.message : 'transaction_failed';
    return { ok: false, reason: reason };
  }

  return {
    ok: true,
    breakthroughId: breakthroughId,
    edgeIds: edgeIds,
  };
}

module.exports = {
  writeBreakthrough,
  validateProvenance,
  BREAKTHROUGH_NODE_TYPE,
  BREAKTHROUGH_KIND,
};
