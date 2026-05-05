'use strict';
// Phase 109-09 Room Home Driver. Per CONTEXT D-08 + RESEARCH section 6.
// Composition NOT duplication. ZERO new SQL queries; 8 reads via existing helpers + 3 raw SELECTs.
//
// Canon Part 1: getRoomHomeView IS the wicked navigator's working memory made legible.
// Canon Part 4: every payload is composed from typed graph queries; the navigator never
// re-derives; the same node id never appears twice across confirmedFacts and riskyAssumptions
// (composition-not-duplication invariant asserted in tests/test-room-home-vs-brain-derivation-regression.cjs).
// Canon Part 7: composes Plan 109-04 getNeighborhood + Plan 109-05 findContradictions /
// findOpenQuestions / findRelevantOpportunities + Plan 109-03 findRecentChanges; ZERO
// new SQL queries beyond the 3 thin raw SELECTs that scope confirmed-facts / risky-assumptions /
// evidence-by-tier (each a single SELECT against nodes; cheaper than a CTE for small N).
// Canon Part 9: SELECT supersedes folder scanning; this is the user-facing payoff of Phase 109.

const { findContradictions, findOpenQuestions, findRelevantOpportunities } = require('./insights.cjs');
const { findRecentChanges } = require('./memory-events.cjs');

const TIERS = ['academic', 'operational', 'practitioner', 'none'];

function getCurrentThesis(db) {
  try {
    const row = db.prepare("SELECT value FROM identity WHERE key = 'thesis'").get();
    return row && typeof row.value === 'string' ? row.value : '';
  } catch (_) {
    return '';
  }
}

function safeShape(row) {
  let summary = '';
  try {
    const props = JSON.parse(row.properties || '{}');
    summary = props.summary || props.claim || props.title || '';
  } catch (_) { /* ignore */ }
  return {
    id: row.id,
    type: row.type,
    summary: summary.length > 120 ? summary.slice(0, 117) + '...' : summary,
    reviewStatus: row.review_status,
    confidence: row.confidence,
    lastSeenAt: row.last_seen_at,
  };
}

function getConfirmedFacts(db) {
  // Per CONTEXT D-08 + Plan 108 TRUTH-STATES: validated state is the strict
  // confirmed-fact tier (claim / CausalClaim / assumption that cleared review).
  const rows = db.prepare(
    "SELECT id, type, properties, review_status, confidence, last_seen_at FROM nodes "
    + "WHERE type IN ('claim','CausalClaim','assumption') AND review_status = 'validated' "
    + "ORDER BY last_seen_at DESC LIMIT 50"
  ).all();
  return rows.map(safeShape);
}

function getRiskyAssumptions(db) {
  // Per CONTEXT D-08: risky = assumption nodes still in active review_status
  // (confirmed = filed but not yet validated; needs_evidence = explicitly flagged).
  // Composition-not-duplication: this set is disjoint from confirmedFacts because the
  // 'validated' state is excluded by the IN-clause filter.
  const rows = db.prepare(
    "SELECT id, type, properties, review_status, confidence, last_seen_at FROM nodes "
    + "WHERE type = 'assumption' AND review_status IN ('confirmed','needs_evidence') "
    + "ORDER BY confidence ASC, last_seen_at DESC LIMIT 50"
  ).all();
  return rows.map(safeShape);
}

function getEvidenceByTier(db) {
  // Per CONTEXT D-08 evidence shape: { academic, operational, practitioner, none }
  // grouped from evidence nodes by properties.tier. JS-side grouping is cheaper than
  // GROUP BY for typical evidence counts (< 200) and preserves ordering by confidence.
  const rows = db.prepare(
    "SELECT id, type, properties, review_status, confidence, last_seen_at, "
    + "json_extract(properties, '$.tier') AS tier "
    + "FROM nodes WHERE type = 'evidence' "
    + "ORDER BY confidence DESC LIMIT 200"
  ).all();
  const out = { academic: [], operational: [], practitioner: [], none: [] };
  for (const r of rows) {
    const tier = TIERS.includes(r.tier) ? r.tier : 'none';
    out[tier].push(safeShape(r));
  }
  return out;
}

function getRoomHomeView(db, roomId, opts) {
  const options = opts || {};
  const roomRootId = 'room:' + roomId;
  const since24h = Date.now() - 24 * 60 * 60 * 1000;

  // 8 reads total: 1 identity + 3 raw SELECTs + 4 helper calls.
  const currentThesis = getCurrentThesis(db);
  const confirmedFacts = getConfirmedFacts(db);
  const riskyAssumptions = getRiskyAssumptions(db);
  const evidence = getEvidenceByTier(db);
  const contradictions = findContradictions(db, roomRootId);
  const openQuestions = findOpenQuestions(db, roomId);
  const recentChanges = findRecentChanges(db, since24h, { limit: 20 });
  const bankedOpportunities = findRelevantOpportunities(
    db,
    roomRootId,
    { topK: 5, _mocks: options._mocks, roomDir: options.roomDir }
  );

  // Per RESEARCH section 6.1 line 882: nextMove ships a templated default in Phase 109;
  // Phase 110 wires the live Brain advisory. The opts.brainAvailable + opts.getBrainAdvisory
  // seam is forward-compat; until Phase 110 is shipped, the templated string is the
  // canonical answer.
  const nextMove = options.brainAvailable === true && typeof options.getBrainAdvisory === 'function'
    ? options.getBrainAdvisory(roomRootId)
    : 'See open questions and contradictions to decide next focus.';

  return {
    currentThesis,
    confirmedFacts,
    riskyAssumptions,
    evidence,
    contradictions,
    openQuestions,
    recentChanges,
    bankedOpportunities,
    nextMove,
  };
}

module.exports = { getRoomHomeView };
