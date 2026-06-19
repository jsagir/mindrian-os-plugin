'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-corpus-adapter (D-165-03).
 *
 * GREEN assertion (Wave 2 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 3):
 *   findConfidentClaims(db) over the seeded fixture room.db returns EXACTLY the
 *   graded-confirmed Academic/Operational set (the 5 corpus claims) -- the UNION
 *   over (EvidenceClaim, claim, CausalClaim) WHERE review_status='confirmed' AND
 *   json_extract(properties,'$.evidence_tier') IN ('Academic','Operational').
 *   It must EXCLUDE the None/Practitioner-tier confirmed rows, the
 *   ungraded-confirmed claims (no evidence_tier), and the proposed Academic row.
 *   Each returned instance carries { id, type, confidence, evidenceTier,
 *   knowledgeType, section, domain, lastModifiedAt } (enum handles only, Part 8).
 *
 * The module lib/core/unknowns/corpus-adapter.cjs does not exist yet. This stub
 * REQUIRES it inside a try/catch and exits 1 RED until Wave 2 ships it. The fixture
 * (tests/fixtures/unknowns/build-fixture-room.cjs) already seeds both sides of the
 * filter, so the GREEN test has its data.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/corpus-adapter.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/corpus-adapter.cjs not yet implemented (plan 02)');
  process.exit(1);
}
console.error('RED: corpus-adapter loaded but the GREEN assertions are not wired yet (plan 02)');
process.exit(1);
