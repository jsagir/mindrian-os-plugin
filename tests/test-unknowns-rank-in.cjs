'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-rank-in (D-165-06).
 *
 * GREEN assertion (Wave 5 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 4.1 / 7.4):
 *   Engine output becomes a CANDIDATE that the Phase 125 f-selector-ranker scores
 *   into the F.1 Next-Move set: the top-N proxy-ranked blind-spot candidates
 *   surface at the F.1 Decision Gate (Larry reacts unprompted, D-165-06; Part 10
 *   variable reward, freshness-gated). The engine RANKS the consumer surfaces (it
 *   does not invoke them) via FEEDS_INTO chain edges; map-unknowns is the front
 *   door. The candidate carries the generic handles the ranker scores on (no
 *   prose, Part 8).
 *
 * The module lib/core/unknowns/orchestrator.cjs (the rank-in producer) does not
 * exist yet. RED until Wave 5.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/orchestrator.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/orchestrator.cjs rank-in not yet implemented (plan 05)');
  process.exit(1);
}
console.error('RED: orchestrator loaded but the f-selector-ranker rank-in assertion is not wired yet (plan 05)');
process.exit(1);
