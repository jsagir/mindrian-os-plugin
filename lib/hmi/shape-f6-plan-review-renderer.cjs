'use strict';
// Phase 88.2-00 Wave-0 stub. Real implementation lands in 88.2-06.
//
// COLLISION-SAFE PATH per RESEARCH.md R1: this module is `shape-f6-plan-review-renderer.cjs`,
// NOT `shape-f6-renderer.cjs`. The latter is Phase 101-01's JTBD-aware Next Move shape and
// MUST remain byte-equal pre/post Phase 88.2 work. sha256 baseline asserted in 88.2-05/-06 plans.
//
// API contract (per CONTEXT.md F.6 spec):
//   renderShapeF6PlanReview({ artifactPath, roundSize=20, realCount=16, roundId, position, totalRounds, personaContext?, tier, decoys, currentEntry })
//     -> { zones: { header, body, footer }, contract: { shape: 'F.6', verbs: ['Confirm', 'Reject', 'Discuss'], freeTextOffered: false (per-round), keyboard: 'askuserquestion' } }
//
// F.6 invariants:
//   - Round size: 15-30 questions (default 20). Real:decoy ratio 4:1 (16 real + 4 decoys at 20)
//   - Real questions sourced from the artifact's structural decomposition (tasks, gates, deps, ACs, success metrics)
//   - Decoys NOT disclosed during round; debrief Shape A action report at round-end discloses
//   - Each response writes one REVIEWED typed edge with properties
//     { round_id, position, latency_ms, was_decoy, response, confidence_self_report }
//   - Position-aware so debrief identifies decoys-caught vs decoys-missed
//   - Cowork: parallel actor responses captured per actor_id; divergence triggers F.5 Branch Resolution
//   - Round can be paused via 'q' keystroke; resumes from same position; persists across session restarts
//   - Decoy generation tiers via lib/hmi/decoy-tier.cjs (Tier 0/1/2)
//   - Phase 109 emit: recordEvent({ type: 'f6_round_completed', ... }) at round end
//
// personaContext (optional, per D-AMEND-04): F.6 accepts personaContext for header annotation
// (e.g., "ROUND N of M -- PLAN REVIEW (founder lens)"). Cold-start: omit suffix entirely.
//
// Canon Part 8: REVIEWED edges + round-state node + comprehension profile all LOCAL.
// Tier 1 Brain-driven decoys are DESIGN substitutions (framework chaining rules from
// Brain methodology graph), not user-content queries. Tier 2 reads role_blend + comprehension
// profile from LOCAL only.

function renderShapeF6PlanReview(_opts) {
  throw new Error('shape-f6-plan-review-renderer.cjs is a Phase 88.2-00 Wave-0 stub. Real implementation ships in Plan 88.2-06.');
}

module.exports = { renderShapeF6PlanReview };
