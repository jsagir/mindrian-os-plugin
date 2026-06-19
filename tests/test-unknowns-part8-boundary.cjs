'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-part8-boundary (D-165-10).
 *
 * GREEN assertion (Wave 4/5 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 8):
 *   A forbidden-substring sweep over EVERY lib/core/unknowns/*.cjs surface proves
 *   the Part-8 LOCAL-only boundary: NO Brain require / Brain-host URL / brain-client
 *   (zero Brain egress), NO raw INSERT INTO nodes|edges (all writes route through
 *   the navigation.cjs chokepoint -- writeClaimNode / writeEdge / candidateToFinding
 *   clone), and NO Math.random anywhere (D-165-09; index-deterministic). The proxy
 *   scalars + HSI arm-priority are LOCAL reads only; pattern-mining is LOCAL-only.
 *
 * At Wave 0 only iface.cjs exists (clean by construction). This stub stays RED
 * until the full engine surface lands (the orchestrator is the last module), so
 * the sweep runs against the complete lib/core/unknowns/* tree the GREEN test
 * asserts over. RED until Wave 5.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/orchestrator.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/* engine surface incomplete (orchestrator.cjs not yet implemented, plan 05)');
  process.exit(1);
}
console.error('RED: orchestrator loaded but the full lib/core/unknowns/* forbidden-substring sweep is not wired yet (plan 05)');
process.exit(1);
