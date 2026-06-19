'use strict';
/*
 * Phase 165 Wave-0 RED stub -- test-unknowns-bandit (D-165-02 + D-165-09).
 *
 * GREEN assertion (Wave 3 turns this on; sourced from 165-VALIDATION.md +
 * 165-RESEARCH section 1.1 UUB / Algorithm 2, section 1.5):
 *   initialize(partitions) seeds one arm per partition; selectNextInstance(oracleFn,
 *   budget) produces pull records { time, arm, instance, utility, isUnknownUnknown,
 *   cumulativeUtility } and RESPECTS the bounded budget = floor(N * config.budget).
 *   First K pulls try each arm once in stable HSI-priority order (ties by partition
 *   id); thereafter UCB-with-custom-discount arm selection (Eq.3
 *   currentArmSize/sizeAtPull). Within-arm instance pick is index-deterministic
 *   over a stable-sorted cursor (ascending claimId) -- ZERO Math.random
 *   (`grep -c "Math.random" lib/core/unknowns/` returns 0).
 *
 * The module lib/core/unknowns/bandit.cjs does not exist yet. RED until Wave 3.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const MODULE = '../lib/core/unknowns/bandit.cjs';
try {
  require(MODULE);
} catch (_e) {
  console.error('RED: lib/core/unknowns/bandit.cjs not yet implemented (plan 03)');
  process.exit(1);
}
console.error('RED: bandit loaded but the budget + pull-record + no-random assertions are not wired yet (plan 03)');
process.exit(1);
