'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-proxy-oracle (D-165-01).
 *
 * GREEN assertion (Wave 2/3 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 2):
 *   proxyOracle(db, claimId, cfg, nowFn) blends the THREE LOCAL scalars with the
 *   default weights w_contra 0.5 / w_mismatch 0.3 / w_stale 0.2 and thresholds at
 *   proxyThreshold 0.5:
 *     contradictionDensity (incident CONTRADICTS/INVALIDATES edges),
 *     tierMismatch = max(0, confidence - TIER_FLOOR[evidenceTier]),
 *     staleness = clamp01((nowRef - last_modified_at)/STALE_WINDOW_MS).
 *   Over the seeded fixture, the contradicted+stale corpus claim labels
 *   isUnknownUnknown = 1, and a clean (uncontested, fresh, well-tiered) claim
 *   labels 0. All three scalars are LOCAL room.db reads (NONE touch Brain,
 *   D-165-10); staleness uses the injected nowFn seam (no raw Date.now in the math
 *   path). humanConfirmBudget defaults to 3 and the human tier promotes only via
 *   navigation.confirmNode (Part 9 role 5), Pitfall 5 guarded.
 *
 * The module lib/core/unknowns/corpus-adapter.cjs (proxyOracle) does not exist
 * yet. RED until Wave 2.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/corpus-adapter.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/corpus-adapter.cjs proxyOracle not yet implemented (plan 02)');
  process.exit(1);
}
console.error('RED: proxy-oracle loaded but the 3-scalar-blend label assertions are not wired yet (plan 02)');
process.exit(1);
