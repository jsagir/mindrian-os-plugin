'use strict';
// Phase 88.2-00 Wave-0 stub. Real implementation lands in 88.2-05.
//
// API contract (per CONTEXT.md F.0 spec + RESEARCH.md DISCRETION-AMEND-03):
//   renderShapeF0({ tier, header, claimNodeId, decisionNodeId, actorId? })
//     -> { zones: { header, body, footer }, contract: { shape: 'F.0', verbs: ['Approve', 'Reject', 'Defer'], freeTextOffered: false, keyboard: 'askuserquestion' } }
//
// F.0 invariants:
//   - Exactly 3 verbs: Approve / Reject (with reason) / Defer
//   - NO Free-Text slot (the reason field on Reject IS the free-text path)
//   - NO RECOMMENDED marker (sub-decision shape; thin single-line ASCII border)
//   - Reject path produces a REJECTED_BECAUSE typed edge with properties
//     { reason, rejected_at, parent_decision_id, actor_id?, confidence_self_report? }
//   - Edge target: decision_node -> claim_node
//   - Phase 109 emit: recordEvent({ type: 'selector_rejection_captured', source_node_id, target_node_id, properties })
//
// Cold-start: F.0 is persona-AGNOSTIC visually (no personaContext param). Telemetry captures
// persona-blend at presentation time.
//
// Canon Part 8: REJECTED_BECAUSE writes to LOCAL room.db only via Phase 109 navigation.cjs.

function renderShapeF0(_opts) {
  throw new Error('shape-f0-renderer.cjs is a Phase 88.2-00 Wave-0 stub. Real implementation ships in Plan 88.2-05.');
}

function buildRejectedBecauseEdge(_opts) {
  throw new Error('buildRejectedBecauseEdge is a Phase 88.2-00 Wave-0 stub. Real implementation ships in Plan 88.2-05.');
}

module.exports = { renderShapeF0, buildRejectedBecauseEdge };
