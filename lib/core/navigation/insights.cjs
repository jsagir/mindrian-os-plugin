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
const { ALLOWED_EDGE_TYPES } = require('./edges.cjs');

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

// Phase 270-10 (MEMOP-07) -- the transitive closure findUnsupportedClaims (:68-83)
// cannot express: findUnsupportedClaims asks only "is there a DIRECT SUPPORTS
// edge into this claim." This asks "is the claim supported TRANSITIVELY through
// intermediate nodes, or supported only via a different support-ish edge type."
//
// SUPPORT_EDGE_TYPES is the support-ish subset of the frozen ALLOWED_EDGE_TYPES
// (lib/core/navigation/edges.cjs), derived (not hand-typed) by reading the Set's
// own member documentation rather than assuming RESEARCH.md's speculative
// 'EVIDENCES' name is a real member -- it is not (grep confirms 'EVIDENCES' is
// referenced only as a future-facing scoring branch in neighborhood.cjs's edge
// weight CASE, never added to edges.cjs's ALLOWED_EDGE_TYPES):
//   - SUPPORTS: the literal evidentiary edge (edges.cjs's own MEM-01 comment,
//     and the exact type findUnsupportedClaims already checks).
//   - INSTANTIATES: edges.cjs's own DIKW-04 comment names it "the
//     example-EVIDENCES-abstraction edge" verbatim -- a concrete instance
//     backing an abstract claim is support-ish even though the type is not
//     named SUPPORTS.
// The validation loop below makes this a DERIVED list rather than a second
// vocabulary: if a future phase renames or retires one of these two edge
// types, this file fails LOUDLY at require time instead of silently returning
// empty results forever. Canon Part 7: additive read of the existing frozen
// Set, no new edge type minted, edges.cjs is byte-unchanged by this phase.
const SUPPORT_EDGE_TYPES = Object.freeze(['SUPPORTS', 'INSTANTIATES']);
for (const _supportEdgeType of SUPPORT_EDGE_TYPES) {
  if (!ALLOWED_EDGE_TYPES.has(_supportEdgeType)) {
    throw new Error(
      'lib/core/navigation/insights.cjs SUPPORT_EDGE_TYPES references "' + _supportEdgeType
      + '", which is not a member of ALLOWED_EDGE_TYPES (lib/core/navigation/edges.cjs). '
      + 'SUPPORT_EDGE_TYPES must stay a DERIVED subset of the frozen edge vocabulary.'
    );
  }
}

// The SAME cascade-depth bound findBlockingAssumptions uses (:98, `c.depth < 5`).
// Deliberately the same axis and the same value, inlined there and here rather
// than shared via import, because it is NOT the frozen forest-walk depth cap
// the ICM forest module owns -- that governs a different axis entirely (how
// deep the ICM directory tree is walked), and importing that module here
// would conflate two unrelated bounds into one accidental third depth
// notion. This file imports no forest-walk module for that reason.
const TRANSITIVE_SUPPORT_DEFAULT_MAX_DEPTH = 5;

/**
 * findTransitiveSupport(db, nodeId, opts) -- the genuinely graph-native upgrade
 * to findUnsupportedClaims's single-hop NOT EXISTS check (RESEARCH.md 3.3
 * candidate 2). Walks INCOMING support-ish edges toward `nodeId` via a
 * recursive CTE, modelled line for line on findBlockingAssumptions (:85-108)
 * with ONE deliberate difference: the join direction is the MIRROR of
 * findBlockingAssumptions. findBlockingAssumptions walks OUTGOING edges
 * (`e.source = c.id`) downstream from a goal to its assumptions.
 * findTransitiveSupport walks INCOMING edges (`e.target = s.id`) upstream from
 * a claim to whatever supports it, because "A supports B" is stored as
 * edge(source=A, target=B) (the same direction findUnsupportedClaims's own
 * `e.target = n.id` check already assumes). Getting this backwards would
 * silently walk the wrong side of the graph and return plausible-looking
 * wrong answers -- the mirror is deliberate, not a typo.
 *
 * Returns { nodeId, directlySupported, supporters }. `directlySupported` is
 * computed the same way findUnsupportedClaims computes its own NOT EXISTS (an
 * edge of a support-ish type landing directly on nodeId), so a caller can
 * distinguish three states: supported directly, supported only transitively
 * (a non-empty `supporters` list with no direct edge), or unsupported (both
 * false/empty). That three-way distinction, not a bare ancestor list, is the
 * actual capability upgrade over findUnsupportedClaims.
 *
 * Canon Part 8: pure SQL over the caller-owned room.db handle; zero Brain
 * calls, zero network calls.
 */
function findTransitiveSupport(db, nodeId, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const exists = db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(nodeId);
  if (!exists) return { nodeId: nodeId, directlySupported: false, supporters: [] };

  const maxDepth = (Number.isInteger(options.maxDepth) && options.maxDepth > 0)
    ? options.maxDepth
    : TRANSITIVE_SUPPORT_DEFAULT_MAX_DEPTH;
  const placeholders = SUPPORT_EDGE_TYPES.map(() => '?').join(',');

  // directlySupported is computed the SAME WAY findUnsupportedClaims computes
  // its own NOT EXISTS (:76): type = 'SUPPORTS' specifically, nothing broader.
  // This is deliberately NARROWER than the recursive walk two blocks below,
  // which follows the full SUPPORT_EDGE_TYPES set (SUPPORTS + INSTANTIATES).
  // That gap is what makes the three-way distinction real: a claim whose only
  // direct edge is INSTANTIATES (support-ish, but not literally SUPPORTS)
  // reports directlySupported:false while still showing up as a depth-1
  // `supporters` entry -- exactly RESEARCH.md 3.3's "supported only via a
  // different edge type" case, alongside the multi-hop case.
  const directRow = db.prepare(
    "SELECT 1 AS x FROM edges e WHERE e.target = ? AND e.type = 'SUPPORTS' LIMIT 1"
  ).get(nodeId);
  const directlySupported = !!directRow;

  const rows = db.prepare(
    "WITH RECURSIVE support(id, depth, via) AS ( "
    + "SELECT ? AS id, 0 AS depth, NULL AS via "
    + "UNION ALL "
    + "SELECT e.source, s.depth + 1, e.type FROM edges e JOIN support s ON e.target = s.id "
    + "WHERE e.type IN (" + placeholders + ") AND s.depth < ? "
    + ") "
    + "SELECT DISTINCT n.id, n.type, n.source_path, n.confidence, n.review_status, sp.depth, sp.via "
    + "FROM nodes n JOIN support sp ON sp.id = n.id "
    + "WHERE sp.depth > 0"
  ).all(nodeId, ...SUPPORT_EDGE_TYPES, maxDepth);

  const supporters = rows.map((r) => {
    const cascadePath = [r.id, nodeId];
    return {
      id: r.id,
      type: r.type,
      sourcePath: r.source_path,
      confidence: r.confidence,
      reviewStatus: r.review_status,
      depth: r.depth,
      viaEdgeType: r.via,
      cascadePath: cascadePath,
      explanation: renderExplanation('transitive_support', {
        claim: nodeId, supporter: r.id, viaEdgeType: r.via, depth: r.depth, cascadePath: cascadePath,
      }),
    };
  });

  return { nodeId: nodeId, directlySupported: directlySupported, supporters: supporters };
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

// Phase 160-05 Task 2 (R10): generalized stale detection beyond decisions.
//
// findStaleClaims generalizes findStaleDecisions (above) to the truth-claim node
// types {claim, assumption, opportunity, decision} with a configurable window
// (opts.windowDays, default 30). It flags settled nodes (review_status in
// {confirmed, validated}) whose last_modified_at -- the Phase 160-04 WRITE-TIME
// stamp, NOT last_seen_at which conflates read + write (threat T-160-14) -- is
// older than the window measured against getReferenceNow() via the opts.now seam
// (the supersession.cjs idiom, so tests inject a fixed reference).
//
// findStaleDecisions stays intact above for back-compat. This is the Part 7 reuse
// of that pattern (the ONLY relative-time computation in the system, insights.cjs
// :110-125), generalized rather than duplicated.
//
// Canon Part 8: pure SQL read of room.db scalars; zero Brain queries, zero egress.
const STALE_NODE_TYPES = ['claim', 'assumption', 'opportunity', 'decision'];
const STALE_SETTLED_STATUSES = ['confirmed', 'validated'];
const DEFAULT_STALE_WINDOW_DAYS = 30;

function findStaleClaims(db, roomId, opts) {
  if (!db || typeof db.prepare !== 'function') return [];
  const options = (opts && typeof opts === 'object') ? opts : {};

  // Reference now via the opts.now seam (getReferenceNow). Mirrors supersession.cjs.
  const nowFn = typeof options.now === 'function' ? options.now : Date.now;
  let referenceNow;
  try { referenceNow = nowFn(); } catch (_e) { referenceNow = Date.now(); }
  if (typeof referenceNow !== 'number' || !Number.isFinite(referenceNow)) {
    referenceNow = Date.now();
  }

  const windowDays = (typeof options.windowDays === 'number' && options.windowDays > 0)
    ? options.windowDays
    : DEFAULT_STALE_WINDOW_DAYS;
  const thresholdMs = referenceNow - windowDays * 24 * 60 * 60 * 1000;

  const typePlaceholders = STALE_NODE_TYPES.map(() => '?').join(',');
  const statusPlaceholders = STALE_SETTLED_STATUSES.map(() => '?').join(',');

  // Key on last_modified_at (write-time, Phase 160-04). A row whose
  // last_modified_at is NULL has never been written-since-migration; treat it as
  // NOT stale (no write-time signal) rather than guessing from read time.
  const rows = db.prepare(
    "SELECT n.id, n.type, n.source_path, n.last_modified_at, n.review_status "
    + "FROM nodes n "
    + "WHERE n.type IN (" + typePlaceholders + ") "
    + "AND n.review_status IN (" + statusPlaceholders + ") "
    + "AND n.last_modified_at IS NOT NULL "
    + "AND n.last_modified_at < ?"
  ).all(...STALE_NODE_TYPES, ...STALE_SETTLED_STATUSES, thresholdMs);

  return rows.map((r) => ({
    node: { id: r.id, type: r.type, sourcePath: r.source_path, reviewStatus: r.review_status },
    lastModifiedAt: r.last_modified_at,
    windowDays,
    explanation: renderExplanation('stale', { decision: r.id, lastSeenAt: r.last_modified_at }),
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

/**
 * Phase 116-01 Wave 1 -- room-wide tension candidate query joining JSONL decay state.
 *
 * Returns deterministic-id candidates derived from CONTRADICTS edges (priority 1)
 * with fallback to CONVERGES edges (priority 2) per CONTEXT D-03b. Filters out
 * tension_ids whose JSONL state shows surfacing_count >= 3 OR state IN
 * ('resolved','dropped') so a resolved or decayed tension never re-surfaces.
 *
 * Sync. Defensive. Returns [] on empty / missing graph or missing roomSlug.
 * Reads JSONL state via lib/memory/pending-tension-store.cjs (lazy require so a
 * test substituting that module in require.cache wins).
 *
 * Per RESEARCH OQ-1: this function lives ON the closed navigation surface
 * (re-exported by lib/core/navigation.cjs) so the SessionStart hook reads
 * tensions through the Phase 109 D-06 chokepoint, NOT around it.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} roomId  preserved for API symmetry; unused in v1
 * @param {object} opts
 * @param {string}  opts.roomSlug              required for JSONL state filter
 * @param {number}  [opts.limit=10]            max candidates returned
 * @param {boolean} [opts.includeConvergence]  default true (D-03b priority 2)
 * @returns {Array<object>}
 */
function findSurfaceableTensions(db, roomId, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const roomSlug = (typeof options.roomSlug === 'string' && options.roomSlug.length > 0)
    ? options.roomSlug
    : null;
  const limit = (Number.isInteger(options.limit) && options.limit > 0) ? options.limit : 10;
  const includeConvergence = (options.includeConvergence !== false); // default true

  if (!db || !roomSlug) return [];

  // Lazy require so tests can mock pending-tension-store via require.cache.
  let pendingStore = null;
  try {
    pendingStore = require('../../memory/pending-tension-store.cjs');
  } catch (_e) {
    pendingStore = null;
  }

  // Build excluded-id Set from JSONL state (D-03b filter).
  const excluded = new Set();
  if (pendingStore && typeof pendingStore.readTensions === 'function') {
    try {
      const entries = pendingStore.readTensions(roomSlug);
      for (const e of entries) {
        if (!e || typeof e.tension_id !== 'string') continue;
        if (e.surfacing_count >= 3 || e.state === 'resolved' || e.state === 'dropped') {
          excluded.add(e.tension_id);
        }
      }
    } catch (_e) {
      // graceful: empty exclusion set on JSONL read failure
    }
  }

  // Deterministic id helper (re-uses pending-tension-store.computeTensionId
  // when available; falls back to inline sha256 if module load failed).
  const computeId = (pendingStore && typeof pendingStore.computeTensionId === 'function')
    ? pendingStore.computeTensionId
    : function (s, t, ty) {
        return require('node:crypto')
          .createHash('sha256')
          .update(String(s) + '|' + String(t) + '|' + String(ty))
          .digest('hex')
          .slice(0, 32);
      };

  // SELECT helper: returns rows for a given edge type, sorted by created_at DESC.
  // edges.created_at lives inside properties JSON (lazygraph schema convention);
  // we use json_extract for the ORDER BY and a LEFT JOIN on nodes to fetch
  // section names (source_section / source_path) for the candidate context.
  function selectEdges(edgeType) {
    try {
      return db.prepare(
        "SELECT e.rowid AS edge_id, e.source AS source_node_id, e.target AS target_node_id, " +
        "e.type AS edge_type, " +
        "COALESCE(json_extract(e.properties, '$.created_at'), 0) AS created_at, " +
        "ns.source_path AS source_section, " +
        "nt.source_path AS target_section " +
        "FROM edges e " +
        "LEFT JOIN nodes ns ON ns.id = e.source " +
        "LEFT JOIN nodes nt ON nt.id = e.target " +
        "WHERE e.type = ? " +
        "ORDER BY COALESCE(json_extract(e.properties, '$.created_at'), 0) DESC " +
        "LIMIT ?"
      ).all(edgeType, limit * 3); // overfetch then filter
    } catch (_e) {
      return [];
    }
  }

  function pushCandidates(rows, tensionType, candidates, seen) {
    for (const r of rows) {
      const tid = computeId(r.source_node_id, r.target_node_id, tensionType);
      if (excluded.has(tid) || seen.has(tid)) continue;
      seen.add(tid);
      candidates.push({
        tension_id: tid,
        tension_type: tensionType,
        source_node_id: r.source_node_id,
        target_node_id: r.target_node_id,
        source_section: r.source_section || '',
        target_section: r.target_section || '',
        edge_id: r.edge_id,
        created_at: r.created_at,
      });
      if (candidates.length >= limit) return true;
    }
    return false;
  }

  const candidates = [];
  const seen = new Set();

  // Priority 1: CONTRADICTS edges DESC.
  pushCandidates(selectEdges('CONTRADICTS'), 'contradiction', candidates, seen);

  // Priority 2: CONVERGES edges DESC (only when CONTRADICTS yielded nothing AND
  // includeConvergence is true). Per D-03b, the fallback fires only on empty.
  if (candidates.length === 0 && includeConvergence) {
    pushCandidates(selectEdges('CONVERGES'), 'convergence', candidates, seen);
  }

  return candidates;
}

/**
 * Phase 124-01 Plan: firstCapturedLastTouchedBySection
 * ----------------------------------------------------
 * For a given section slug (the source_section identity for a folder), return
 * { first_captured_ms, last_touched_ms, total_events } across all memory_event
 * rows scoped to that section (source_path === slug OR source_path LIKE slug/%).
 *
 * Used by lib/core/feynman/timeline-renderer.cjs for the D-05 summary line
 * ("first captured {first_iso}, last touched {last_iso}"). Returns nulls + 0
 * count when the section has zero memory_event rows -- the empty-state cue.
 *
 * Canon Part 9: pure SQL read against the local room.db; zero Brain surface;
 * zero filesystem reads. Canon Part 8-safe by construction.
 */
function firstCapturedLastTouchedBySection(db, sectionSlug) {
  if (!db || typeof db.prepare !== 'function' || typeof sectionSlug !== 'string' || sectionSlug.length === 0) {
    return { first_captured_ms: null, last_touched_ms: null, total_events: 0 };
  }
  try {
    const row = db.prepare(
      "SELECT MIN(created_at) AS first_ms, MAX(created_at) AS last_ms, COUNT(*) AS n " +
      "FROM nodes " +
      "WHERE type = 'memory_event' " +
      "AND (source_path = ? OR source_path LIKE ?)"
    ).get(sectionSlug, sectionSlug + '/%');
    const total = (row && Number.isFinite(row.n)) ? row.n : 0;
    return {
      first_captured_ms: total > 0 && Number.isFinite(row.first_ms) ? row.first_ms : null,
      last_touched_ms: total > 0 && Number.isFinite(row.last_ms) ? row.last_ms : null,
      total_events: total,
    };
  } catch (_) {
    return { first_captured_ms: null, last_touched_ms: null, total_events: 0 };
  }
}

module.exports = {
  findContradictions,
  findUnsupportedClaims,
  findBlockingAssumptions,
  findTransitiveSupport,
  SUPPORT_EDGE_TYPES,
  findStaleDecisions,
  findStaleClaims,
  findOpenQuestions,
  findRelevantOpportunities,
  findSurfaceableTensions,
  firstCapturedLastTouchedBySection,
};
