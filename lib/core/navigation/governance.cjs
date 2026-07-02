'use strict';
// Phase 189-02 (HITL Memory Governance; SEED-040 / HMG-01) -- the closed
// truth-claim governance CANDIDATE query. This is the SELECT that feeds the F.8
// governance basket (the WHAT decision): which pending memory candidates does the
// navigator see.
//
// Clones findBlockingAssumptions's join/select style (insights.cjs ~85-108): a
// single defensive SELECT on the local room.db, ZERO LLM in the loop. It filters
// nodes whose review_status = 'proposed' and whose type is a member of the closed
// TRUTH_CLAIM_TYPES Set (required from transitions.cjs and spread into the SQL
// IN-list at runtime -- NEVER a hand-typed second copy of the list), and which do
// NOT already carry an outgoing REMEMBERED_AS / NOT_REMEMBERED_BECAUSE edge (an
// already-decided candidate NEVER resurfaces).
//
// n.confidence IS the brain_consult-derived ranking signal (SENS-09 precedent):
// the SAME column findBlockingAssumptions / findRelevantOpportunities already read.
// This module reads it, it does NOT re-derive or re-call Brain for a parallel
// score (mint no 7th reach).
//
// Canon Part 8: pure SQL read of room.db scalars; zero Brain queries, zero egress.
// Canon Part 9 audit-node carve-out: system-bookkeeping nodes (memory_event /
// audit / focus) are NEVER truth-claim types, so the TRUTH_CLAIM_TYPES filter
// structurally excludes them -- a memory_event NEVER surfaces as a candidate even
// when its review_status reads 'confirmed'.
//
// House rule: CJS only, hyphens only (no em-dashes).

const transitions = require('./transitions.cjs');

// The already-decided edge types: an outgoing edge of either kind means the
// navigator has already ruled on this candidate (confirmed -> REMEMBERED_AS,
// declined -> NOT_REMEMBERED_BECAUSE). Either one retires the candidate.
const DECIDED_EDGE_TYPES = Object.freeze(['REMEMBERED_AS', 'NOT_REMEMBERED_BECAUSE']);

// findGovernanceCandidates(db, roomId, opts) -> Array<candidate>
//
// Returns [{ candidate_id, kind, confidence, source_path }, ...] -- the exact
// shape governance-candidate.validateCandidate expects minus the
// target_section / affected_sections / layer the raiser fills in (Phase 189-02
// Task 2). roomId is preserved for API symmetry (unused in v1; the room.db handle
// is already scoped to one room). Defensive: NEVER throws; returns [] on any
// query failure or missing handle.
function findGovernanceCandidates(db, roomId, opts) {
  if (!db || typeof db.prepare !== 'function') return [];

  // Spread the CLOSED truth-claim Set into the SQL IN-list at runtime. Never a
  // second hand-typed copy of the type list (single source of truth).
  const truthTypes = Array.from(transitions.TRUTH_CLAIM_TYPES);
  if (truthTypes.length === 0) return [];
  const typePlaceholders = truthTypes.map(() => '?').join(',');
  const decidedPlaceholders = DECIDED_EDGE_TYPES.map(() => '?').join(',');

  try {
    const rows = db.prepare(
      "SELECT n.id, n.type, n.confidence, n.source_path "
      + "FROM nodes n "
      + "WHERE n.review_status = 'proposed' "
      + "AND n.type IN (" + typePlaceholders + ") "
      + "AND NOT EXISTS ("
      + "  SELECT 1 FROM edges e "
      + "  WHERE e.source = n.id "
      + "  AND e.type IN (" + decidedPlaceholders + ")"
      + ")"
    ).all(...truthTypes, ...DECIDED_EDGE_TYPES);

    return rows.map((r) => ({
      candidate_id: r.id,
      kind: r.type,
      confidence: (typeof r.confidence === 'number' && Number.isFinite(r.confidence)) ? r.confidence : null,
      source_path: (typeof r.source_path === 'string') ? r.source_path : null,
    }));
  } catch (_e) {
    return [];
  }
}

module.exports = { findGovernanceCandidates, DECIDED_EDGE_TYPES };
