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
// Phase 365-12 (D-19): the ONE standing reader and the ONE words map. This
// module names a claim's standing in words from STANDING_WORDS and never holds a
// label string of its own (tests/test-365-b5-renders.cjs B4 scans for that).
const { claimStanding, STANDING_WORDS } = require('./verification.cjs');

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

// Phase 365-12 (B1): a claim-type row names what it was checked against, in the
// words of the one shared map. Other types are returned untouched (no new keys).
function withStanding(db, shaped) {
  if (!shaped || shaped.type !== 'claim') return shaped;
  const st = claimStanding(db, shaped.id);
  const words = STANDING_WORDS[st.standing];
  return Object.assign({}, shaped, {
    standing: st.standing,
    standing_words: words ? words.label : '',
  });
}

function getConfirmedFacts(db) {
  // Phase 129.5-03 (TRUTH-CONFIRMED-FACTS): a human APPROVE at a Decision Gate
  // promotes a PROPOSED truth-claim node to 'confirmed' (Canon Part 9 role 5).
  // confirmedFacts must surface that freshly human-confirmed node, so the
  // review_status filter is WIDENED from the 109 'validated'-only contract to
  // IN ('confirmed','validated') and the type set is WIDENED to the full
  // truth-claim set {claim, CausalClaim, assumption, decision, opportunity}.
  // A confirmed decision / claim / opportunity is unambiguously a confirmed fact;
  // a validated node still surfaces (109 back-compat). The disjointness invariant
  // with getRiskyAssumptions is preserved by narrowing riskyAssumptions to the
  // 'needs_evidence' state only (see getRiskyAssumptions below): a confirmed
  // assumption cleared human review, so it belongs in confirmedFacts, not in the
  // risky set.
  const rows = db.prepare(
    "SELECT id, type, properties, review_status, confidence, last_seen_at FROM nodes "
    + "WHERE type IN ('claim','CausalClaim','assumption','decision','opportunity') "
    + "AND review_status IN ('confirmed','validated') "
    + "ORDER BY last_seen_at DESC LIMIT 50"
  ).all();
  return rows.map((r) => withStanding(db, safeShape(r)));
}

// Phase 365-12 (B2, Pitfall 8): a claim a person held at needs_evidence is neither
// a confirmed fact nor a risky assumption (that set is assumption-typed), so it
// used to vanish from room home. It is listed here with its standing in words and
// the move that would release it. Held is a state with a next step, never a failure
// (Canon Part 12). Claim text is read from properties.text, where claim nodes keep it.
function getHeldClaims(db) {
  const rows = db.prepare(
    "SELECT id, type, properties, review_status, confidence, last_seen_at FROM nodes "
    + "WHERE type = 'claim' AND review_status = 'needs_evidence' "
    + "ORDER BY last_seen_at DESC LIMIT 50"
  ).all();
  return rows.map((row) => {
    const shaped = safeShape(row);
    if (!shaped.summary) {
      try {
        const props = JSON.parse(row.properties || '{}');
        const text = typeof props.text === 'string' ? props.text : '';
        shaped.summary = text.length > 120 ? text.slice(0, 117) + '...' : text;
      } catch (_) { /* ignore */ }
    }
    const st = claimStanding(db, row.id);
    const words = STANDING_WORDS[st.standing] || STANDING_WORDS.none;
    return {
      id: shaped.id,
      text: shaped.summary,
      standing: st.standing,
      standing_words: words.label,
      moves_when: words.moves_when,
    };
  });
}

function getRiskyAssumptions(db) {
  // Per CONTEXT D-08: risky = assumption nodes still awaiting evidence.
  // Phase 129.5-03: NARROWED from ('confirmed','needs_evidence') to
  // ('needs_evidence') only, because getConfirmedFacts now claims confirmed
  // truth-claim nodes (including a confirmed assumption that cleared human
  // review). Composition-not-duplication: this set is disjoint from
  // confirmedFacts by review_status -- confirmedFacts is the {confirmed,
  // validated} truth-claim set; riskyAssumptions is the needs_evidence
  // assumption set, and the two state sets do not overlap.
  const rows = db.prepare(
    "SELECT id, type, properties, review_status, confidence, last_seen_at FROM nodes "
    + "WHERE type = 'assumption' AND review_status IN ('needs_evidence') "
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
  const heldClaims = getHeldClaims(db);
  const evidence = getEvidenceByTier(db);
  // Phase 348 (SUPER-05): DEFAULT (superseded excluded). The room-home read
  // answers what is contested here now; a contradiction against a claim
  // nobody believes any more is noise.
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
    held_claims: heldClaims,
    evidence,
    contradictions,
    openQuestions,
    recentChanges,
    bankedOpportunities,
    nextMove,
  };
}

module.exports = { getRoomHomeView };
