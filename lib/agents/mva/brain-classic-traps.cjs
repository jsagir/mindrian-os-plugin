/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-02 Plan 02 Task 1 -- brain-classic-traps agent (Agent 3 of 6 in
 * B1; agent_id 'brain_classic_traps' in lib/agents/mva/index.cjs).
 *
 * BUG 2 FIX: the former implementation called brain_query (admin-gated,
 * D-MOAT-1) with a Cypher template targeting FailureMode + Venture nodes.
 * Both node types have ZERO instances in the live Brain graph (verified
 * 2026-05-22 -- see .planning/brain-curated-ops-contract.md Graph facts).
 * That means every query silently returned 0 records, making the agent
 * functionally dead. Calling admin-gated brain_query for a guaranteed-empty
 * result is also a wasted auth round-trip for non-admin users.
 *
 * This version short-circuits to the existing graceful-degradation path
 * ({status:'empty'}) without touching Brain at all. The agent will return
 * useful data only when FailureMode and Venture nodes are seeded into the
 * Brain AND a curated op for them is added to the brain_ask surface.
 *
 * TODO (for the integrator): when FailureMode/Venture nodes are seeded
 * into the Brain, add a 'classic_traps' curated op to brain_ask and
 * repoint this agent to brain.askOp('classic_traps', { stages }) instead
 * of restoring the raw brain_query call. The admin-gated brain_query path
 * must NOT be restored.
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
 *   2. NEVER call the admin-gated brain_query with raw Cypher.
 *   3. NEVER write to stdout / stderr (telemetry side-channel rule).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

/**
 * @param {{ sentence_sha256: string, remaining_budget_ms: number }} _context
 * @param {AbortSignal} signal
 * @returns {Promise<{ status:'ok'|'empty', payload:any } | null>}
 */
async function run(_context, signal) {
  if (signal && signal.aborted) return null;

  // FailureMode and Venture nodes do not yet exist in the Brain graph
  // (zero instances as of 2026-05-22). Any call to brain_query or a
  // curated op for them will return empty. Return the graceful-degradation
  // envelope immediately so the MVA pipeline keeps moving.
  //
  // When the Brain is seeded with FailureMode/Venture nodes, add a curated
  // op 'classic_traps' to brain_ask and replace this stub with:
  //   const result = await brainClient.askOp('classic_traps', { stages: ['pre-seed','seed'] });
  //   ... process result.rows ...
  return { status: 'empty', payload: { reason: 'failuremode_nodes_not_yet_seeded' } };
}

module.exports = { run };
