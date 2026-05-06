'use strict';
// Phase 88.2-00 Wave-0 stub. Real implementation lands in 88.2-06.
//
// API contract (per RESEARCH.md DISCRETION-AMEND-02):
//   selectDecoys({ artifactPath, roundSize=20, realCount, profile, roleBlend, brainAvailable, tierOverride })
//     -> { decoys: [{ position, content, was_decoy: true, perturbation_axis }, ...], tier, tier_reason, distribution_seed }
//
// Tier auto-detection (88.2-06 will implement):
//   - profile rounds_total < 100 OR profile absent -> Tier 1 (Brain-driven if reachable, else Tier 0)
//   - profile rounds_total >= 100 AND (weak_spots + strong_spots) >= 3 AND roleBlend present -> Tier 2
//   - Brain unreachable AND profile not mature -> Tier 0 (pattern-based perturbation)
//
// Tier 0 perturbation axes (5):
//   wrong_owner, wrong_dependency, wrong_metric, wrong_scope, wrong_invariant
//
// Comprehension profile path: <roomDir>/.mindrian/comprehension-profile-<sha256(user_id):16>.json
// Schema: { rounds_total, weak_spots: [topic, ...], strong_spots: [topic, ...], last_calibration_round: timestamp }
//
// Canon Part 8: reads role_blend + comprehension profile from LOCAL only. Never sends to Brain.

function selectDecoys(_opts) {
  throw new Error('decoy-tier.cjs is a Phase 88.2-00 Wave-0 stub. Real implementation ships in Plan 88.2-06.');
}

module.exports = { selectDecoys };
