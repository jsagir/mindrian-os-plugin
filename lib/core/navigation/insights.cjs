'use strict';
// Phase 109-05 insight query primitives. 6 of the 7; findRecentChanges lives in memory-events.cjs.
//
// Per RESEARCH section 2.5: each query is a single SELECT (with one CTE for findBlockingAssumptions)
// plus templated explanation rendering. ZERO LLM in the loop. Pure SQL on the local room.db.
//
// Per RESEARCH section 11.1 SUPPORTS vs ENABLES: shipped as SEPARATE edge types. findUnsupportedClaims
// uses a single edge-type filter (NOT EXISTS edge of type 'SUPPORTS'); ENABLES does not satisfy it.
// Per RESEARCH section 11.2 CausalClaim subsumption: findUnsupportedClaims accepts BOTH type='claim'
// AND type='CausalClaim' rows via UNION across types (forward-compat with future single-type fold).
//
// Canon Part 5: findUnsupportedClaims surfaces missing SUPPORTS edges; findStaleDecisions surfaces
// decisions older than 30 days; the queries make the evidence bar legible.
// Canon Part 7: lives under lib/core/navigation/ subdirectory; the chokepoint module navigation.cjs
// re-exports.
// Canon Part 8: zero Brain queries; pure SQL on the local room.db.
// Canon Part 9: SELECT supersedes folder scanning; templated explanation renders the typed edge
// labels as the explanation substrate.

const path = require('node:path');
const { getNeighborhood } = require('./neighborhood.cjs');
const { renderExplanation } = require('./explanation.cjs');

function loadJtbd(roomDir, mocks) {
  if (mocks && mocks.jtbd) return mocks.jtbd;
  try {
    return require(path.resolve(__dirname, '..', '..', 'hmi', 'jtbd-state.cjs'));
  } catch (_) {
    return null;
  }
}

function jaccard(a, b) {
  const setA = new Set(Array.isArray(a) ? a : []);
  const setB = new Set(Array.isArray(b) ? b : []);
  if (setA.size === 0 && setB.size === 0) return 0;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function findContradictions(db, focusNodeId) {
  const exists = db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(focusNodeId);
  if (!exists) return [];
  // Walk the neighborhood; collect node ids reachable from focus.
  const neighbors = getNeighborhood(db, focusNodeId, { maxDepth: 2, topK: 200 });
  const reachable = new Set([focusNodeId]);
  for (const n of neighbors) reachable.add(n.id);
  // Find edges of type CONTRADICTS where both endpoints are in the reachable set.
  const ids = Array.from(reachable);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    "SELECT e.source AS s, e.target AS t, n_a.type AS s_type, n_b.type AS t_type "
    + "FROM edges e "
    + "JOIN nodes n_a ON n_a.id = e.source "
    + "JOIN nodes n_b ON n_b.id = e.target "
    + "WHERE e.type = 'CONTRADICTS' AND e.source IN (" + placeholders + ") AND e.target IN (" + placeholders + ")"
  ).all(...ids, ...ids);
  return rows.map((row) => ({
    claimA: { id: row.s, type: row.s_type },
    claimB: { id: row.t, type: row.t_type },
    edgePath: [row.s, row.t],
    explanation: renderExplanation('contradiction', { claimA: row.s, claimB: row.t, depth: 1 }),
  }));
}

function findUnsupportedClaims(db, roomId) {
  // Per RESEARCH section 11.2 CausalClaim subsumption: UNION across both types.
  // Per RESEARCH section 11.1 SUPPORTS-only filter: NOT EXISTS edge of type SUPPORTS.
  const rows = db.prepare(
    "SELECT n.id, n.type, n.source_path, n.review_status, n.last_seen_at "
    + "FROM nodes n "
    + "WHERE n.type IN ('claim','CausalClaim') "
    + "AND n.review_status IN ('confirmed','needs_evidence') "
    + "AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.target = n.id AND e.type = 'SUPPORTS')"
  ).all();
  return rows.map((r) => ({
    claim: { id: r.id, type: r.type, sourcePath: r.source_path, reviewStatus: r.review_status, lastSeenAt: r.last_seen_at },
    missingEvidenceFor: r.id,
    explanation: renderExplanation('unsupported', { claim: r.id, reviewStatus: r.review_status, lastSeenAt: r.last_seen_at }),
  }));
}

function findBlockingAssumptions(db, goalNodeId) {
  const exists = db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(goalNodeId);
  if (!exists) return [];
  // Recursive cascade: walk DEPENDS_ON + ASSUMES edges from goal upstream.
  // Cascade direction: goal node has outgoing DEPENDS_ON / ASSUMES edges to assumptions.
  // Walk source -> target where current cascade member is the source.
  const rows = db.prepare(
    "WITH RECURSIVE cascade(id, depth) AS ( "
    + "SELECT ? AS id, 0 AS depth "
    + "UNION ALL "
    + "SELECT e.target, c.depth + 1 FROM edges e JOIN cascade c ON e.source = c.id "
    + "WHERE e.type IN ('DEPENDS_ON', 'ASSUMES') AND c.depth < 5 "
    + ") "
    + "SELECT DISTINCT n.id, n.type, n.source_path, n.confidence, n.review_status, c.depth "
    + "FROM nodes n JOIN cascade c ON c.id = n.id "
    + "WHERE n.type = 'assumption' AND n.review_status IN ('proposed', 'needs_evidence')"
  ).all(goalNodeId);
  return rows.map((r) => ({
    assumption: { id: r.id, type: r.type, sourcePath: r.source_path, confidence: r.confidence, reviewStatus: r.review_status },
    blocksGoal: { id: goalNodeId },
    cascadePath: [r.id, goalNodeId],
    explanation: renderExplanation('blocking', { assumption: r.id, goal: goalNodeId, cascadePath: [r.id, goalNodeId] }),
  }));
}

function findStaleDecisions(db, roomId, opts) {
  // Per RESEARCH section 2.5 simplification: 30 days old AND review_status='confirmed'.
  // The opts.staleAfterSessions parameter is preserved for API compatibility but is
  // interpreted as the 30-day threshold (RESEARCH lines 540 simplification).
  const thresholdMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const rows = db.prepare(
    "SELECT n.id, n.type, n.source_path, n.last_seen_at, n.review_status "
    + "FROM nodes n "
    + "WHERE n.type = 'decision' AND n.review_status = 'confirmed' AND n.last_seen_at < ?"
  ).all(thresholdMs);
  return rows.map((r) => ({
    decision: { id: r.id, type: r.type, sourcePath: r.source_path, reviewStatus: r.review_status },
    lastSeenAt: r.last_seen_at,
    explanation: renderExplanation('stale', { decision: r.id, lastSeenAt: r.last_seen_at }),
  }));
}

function findOpenQuestions(db, roomId) {
  const rows = db.prepare(
    "SELECT n.id, n.source_path, n.created_at "
    + "FROM nodes n "
    + "WHERE n.type = 'open_question' "
    + "AND n.review_status IN ('proposed', 'confirmed') "
    + "AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.target = n.id AND e.type IN ('SUPPORTS', 'EVIDENCES'))"
  ).all();
  return rows.map((r) => ({
    question: { id: r.id, sourcePath: r.source_path, createdAt: r.created_at },
    createdAt: r.created_at,
    explanation: renderExplanation('open', { question: r.id, createdAt: r.created_at }),
  }));
}

function hsiBand(score) {
  const s = Number(score) || 0;
  if (s >= 70) return 'high';
  if (s >= 40) return 'medium';
  return 'low';
}

function findRelevantOpportunities(db, focusNodeId, opts) {
  const options = opts || {};
  const topK = Number.isInteger(options.topK) && options.topK > 0 ? options.topK : 5;
  const wHsi = typeof options.weightHsi === 'number' ? options.weightHsi : 0.5;
  const wDist = typeof options.weightDistance === 'number' ? options.weightDistance : 0.3;
  const wJtbd = typeof options.weightJtbd === 'number' ? options.weightJtbd : 0.2;
  const exists = db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(focusNodeId);
  if (!exists) return [];

  const neighbors = getNeighborhood(db, focusNodeId, { maxDepth: 3, topK: 200 });
  const distMap = new Map();
  for (const n of neighbors) {
    if (n.type === 'opportunity') distMap.set(n.id, n.depth);
  }

  // Also include any opportunity nodes room-wide; the Opportunity Bank is "always ambient"
  // per Canon Part 2 so we score every opportunity, not just neighborhood-reachable ones.
  // Distance falls back to a high depth penalty when the opportunity is not in the neighborhood.
  const allOpps = db.prepare(
    "SELECT id, "
    + "json_extract(properties, '$.hsi_score') AS hsi_score, "
    + "json_extract(properties, '$.tags') AS tags_json, "
    + "source_path, review_status "
    + "FROM nodes WHERE type = 'opportunity' AND review_status IN ('proposed','confirmed','validated')"
  ).all();

  // Per Plan 109-02 focus.cjs precedent: jtbd is read via getCurrent and the test mock returns
  // { current: { id, tags } }. The real jtbd-state.cjs requires a roomDir; when no _mocks seam
  // is provided AND no roomDir is configured (the common navigation API call shape), we treat
  // active JTBD as absent (jtbdScore = 0 across the board) rather than crash on path.join(null).
  const roomDir = typeof options.roomDir === 'string' ? options.roomDir : null;
  const jtbdMod = loadJtbd(roomDir, options._mocks);
  let jtbd = null;
  if (jtbdMod && (options._mocks && options._mocks.jtbd || roomDir)) {
    try {
      jtbd = jtbdMod.getCurrent(roomDir);
    } catch (_) {
      jtbd = null;
    }
  }
  const activeTags = jtbd && jtbd.current && Array.isArray(jtbd.current.tags) ? jtbd.current.tags : [];

  const ranked = allOpps.map((row) => {
    const tags = row.tags_json ? JSON.parse(row.tags_json) : [];
    const hsi = (Number(row.hsi_score) || 0) / 100;
    const depth = distMap.has(row.id) ? distMap.get(row.id) : 99;
    const distScore = 1.0 / (1 + depth);
    const jtbdScore = activeTags.length > 0 ? jaccard(activeTags, tags) : 0;
    const composite = wHsi * hsi + wDist * distScore + wJtbd * jtbdScore;
    return {
      opportunityId: row.id,
      hsiScore: Number(row.hsi_score) || 0,
      graphDistance: depth,
      jtbdMatch: jtbdScore,
      compositeScore: Math.round(composite * 1000) / 1000,
      tags,
      sourcePath: row.source_path,
      explanation: renderExplanation('opportunity', { opportunityId: row.id, hsiBand: hsiBand(row.hsi_score), jtbdMatch: jtbdScore, depth }),
    };
  });
  ranked.sort((a, b) => b.compositeScore - a.compositeScore);
  return ranked.slice(0, topK);
}

module.exports = {
  findContradictions,
  findUnsupportedClaims,
  findBlockingAssumptions,
  findStaleDecisions,
  findOpenQuestions,
  findRelevantOpportunities,
};
