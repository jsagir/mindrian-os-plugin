'use strict';
// Phase 109-04 neighborhood retrieval. The recursive CTE per RESEARCH section 2.1.
// Frozen edge weights per CONTEXT D-02 lines 113-118.
//
// Canon Part 1: getNeighborhood IS the answer to "what is near my focus?"; the
// navigator never folder-scans again.
// Canon Part 4: typed edges drive ranking; the edge_path field carries the
// graph paths that later plans render as explanation strings.
// Canon Part 7: lives under lib/core/navigation/ subdirectory established by
// Plan 109-02; the chokepoint module navigation.cjs re-exports.
// Canon Part 9: SELECT supersedes folder scanning; this is the load-bearing
// query for the acceptance test.

const NEIGHBORHOOD_SQL = "WITH RECURSIVE neighborhood(id, type, edge_path, depth, edge_type_in, last_seen_at, confidence, source_section, review_status, created_by, source_path) AS ( "
  + "SELECT n.id, n.type, json_array(n.id) AS edge_path, 0 AS depth, NULL AS edge_type_in, "
  + "n.last_seen_at, n.confidence, n.source_section, n.review_status, n.created_by, n.source_path "
  + "FROM nodes n WHERE n.id = :focus_node_id "
  + "UNION ALL "
  + "SELECT next_n.id, next_n.type, json_insert(nh.edge_path, '$[#]', next_n.id) AS edge_path, "
  + "nh.depth + 1 AS depth, e.type AS edge_type_in, "
  + "next_n.last_seen_at, next_n.confidence, next_n.source_section, next_n.review_status, next_n.created_by, next_n.source_path "
  + "FROM neighborhood nh JOIN edges e ON e.source = nh.id JOIN nodes next_n ON next_n.id = e.target "
  + "WHERE nh.depth < :max_depth "
  + "AND json_array_length(nh.edge_path) < (:max_depth + 1) "
  + "AND nh.id != next_n.id "
  + ") "
  + "SELECT id, type, edge_path, depth, edge_type_in, source_path, review_status, created_by, confidence, last_seen_at, "
  + "( "
  + "CASE edge_type_in "
  + "WHEN 'CONTRADICTS' THEN 1.0 "
  + "WHEN 'INVALIDATES' THEN 1.0 "
  + "WHEN 'DEPENDS_ON'  THEN 0.9 "
  + "WHEN 'ASSUMES'     THEN 0.9 "
  + "WHEN 'SUPPORTS'    THEN 0.8 "
  + "WHEN 'EVIDENCES'   THEN 0.8 "
  + "WHEN 'INFORMS'     THEN 0.6 "
  + "WHEN 'ENABLES'     THEN 0.6 "
  + "WHEN 'CONVERGES'   THEN 0.4 "
  + "WHEN 'MENTIONS_ENTITY' THEN 0.4 "
  + "ELSE 0.3 "
  + "END * 0.4 "
  + "+ MAX(0.0, MIN(1.0, 1.0 - (CAST(strftime('%s','now') AS REAL) * 1000 - last_seen_at) / (1000.0 * 60 * 60 * 24 * 90))) * 0.2 "
  + "+ COALESCE(confidence, 0.5) * 0.2 "
  + "+ CASE WHEN source_section = (SELECT source_section FROM nodes WHERE id = :focus_node_id) THEN 1.0 ELSE 0.0 END * 0.2 "
  + ") AS score "
  + "FROM neighborhood WHERE depth > 0 ORDER BY score DESC LIMIT :top_k";

function getNeighborhood(db, focusNodeId, opts) {
  const options = opts || {};
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth >= 1 ? options.maxDepth : 2;
  const topK = Number.isInteger(options.topK) && options.topK > 0 ? options.topK : 20;

  // Politely return [] if focus does not exist (avoids letting the CTE return base-case row with no recursion).
  const exists = db.prepare("SELECT 1 AS x FROM nodes WHERE id = ?").get(focusNodeId);
  if (!exists) return [];

  const rows = db.prepare(NEIGHBORHOOD_SQL).all({
    focus_node_id: focusNodeId,
    max_depth: maxDepth,
    top_k: topK,
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    edgePath: typeof r.edge_path === 'string' ? JSON.parse(r.edge_path) : r.edge_path,
    depth: r.depth,
    edgeTypeIn: r.edge_type_in,
    score: r.score,
    sourcePath: r.source_path,
    reviewStatus: r.review_status,
    createdBy: r.created_by,
    confidence: r.confidence,
    lastSeenAt: r.last_seen_at,
  }));
}

module.exports = { getNeighborhood, NEIGHBORHOOD_SQL };
