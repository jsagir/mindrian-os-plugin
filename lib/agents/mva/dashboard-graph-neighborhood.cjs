/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-02 Plan 02 Task 3 -- dashboard-graph-neighborhood agent (Agent 6
 * of 6 in B1; agent_id 'dashboard_graph' in lib/agents/mva/index.cjs).
 *
 * Reads the active room's graph via lib/core/navigation.cjs (the Phase 109
 * single chokepoint; Canon Part 9 D-06 invariant) and returns a 1-2 hop
 * neighborhood snapshot of recent decision nodes.
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require lib/core/room-db.cjs directly (the Phase 109 D-06
 *      chokepoint allow-list does NOT include MVA agents).
 *   2. NEVER require better-sqlite3 / node:sqlite directly.
 *   3. NEVER write to stdout / stderr (telemetry side-channel rule).
 *   4. NEVER call out over the network (the dashboard is purely LOCAL graph).
 *
 * Canon Part 8 hard invariant (MVA-118-12):
 *   The room graph read is LOCAL only. Zero outbound. The summary line + deck
 *   data carry only structural identifiers + counts, never raw artifact text.
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const nav = require('../../core/navigation.cjs');

/**
 * @param {{ sentence_sha256: string, remaining_budget_ms: number }} _context
 * @param {AbortSignal} signal
 * @returns {Promise<{ status:'ok'|'empty', payload:any } | null>}
 */
async function run(_context, signal) {
  if (signal && signal.aborted) return null;

  let active;
  try {
    active = nav.detectActiveRoom();
  } catch (_e) {
    return { status: 'empty', payload: { reason: 'no_active_room' } };
  }
  if (!active || !active.hasRoomDb) {
    return { status: 'empty', payload: { reason: 'no_active_room' } };
  }
  if (signal && signal.aborted) return null;

  let neighborhood;
  try {
    neighborhood = nav.getRecentDecisionNeighborhood(active.roomDir, { hops: 1, limit: 5 });
  } catch (_e) {
    return { status: 'empty', payload: { reason: 'graph_error' } };
  }
  if (signal && signal.aborted) return null;

  const nodes = (neighborhood && Array.isArray(neighborhood.nodes)) ? neighborhood.nodes : [];
  const edges = (neighborhood && Array.isArray(neighborhood.edges)) ? neighborhood.edges : [];
  if (nodes.length === 0) {
    return { status: 'empty', payload: { reason: 'empty_room' } };
  }
  const count = nodes.length;
  const suffix = count === 1 ? '' : 's';
  const summary = 'Your room already has ' + count + ' related decision node' + suffix + '. Quick preview:';
  return {
    status: 'ok',
    payload: {
      summary_line: summary,
      deck_data: { nodes: nodes, edges: edges },
    },
  };
}

module.exports = { run };
