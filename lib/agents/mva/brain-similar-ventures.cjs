/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-02 Plan 02 Task 1 -- brain-similar-ventures agent (Agent 1 of 6
 * in B1; agent_id 'brain_similar' in lib/agents/mva/index.cjs).
 *
 * Calls Brain via lib/core/brain-client.cjs::search() with a GENERIC handle
 * from data/mva-agent-prompts.json. Returns the top-3 venture matches with a
 * one-line human-readable summary + structured deck_data.
 *
 * Mirrors lib/agents/auto-explore-agent.cjs structure verbatim per the plan.
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
 *   2. NEVER require any Brain-MCP client module DIRECTLY for raw queries;
 *      use lib/core/brain-client.cjs which enforces the wire-schema sanitization
 *      AND only with framework-name/phase-id/enum args, never user content.
 *   3. NEVER write to stdout / stderr (telemetry side-channel rule).
 *
 * Canon Part 8 hard invariant (MVA-118-08):
 *   The Brain query carries ONLY generic handles loaded from
 *   data/mva-agent-prompts.json. NEVER the user's raw sentence. NEVER the
 *   sentence_sha256 as a free-text query body. NEVER any user-content env
 *   var (which is never set; see Plan 118-01's AgentContext invariant -- the
 *   sentence-bearing env var name is elided here so the grep regression in
 *   test-all-six-agents.cjs Test 6 returns zero matches on this file).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const path = require('node:path');
const brainClient = require('../../core/brain-client.cjs');

const PROMPTS_PATH = path.resolve(__dirname, '..', '..', '..', 'data', 'mva-agent-prompts.json');

/**
 * Agent run function. Conforms to the Plan 118-01 Agent contract:
 *   async function agent(context, signal) -> { status:'ok'|'empty', payload } | null
 *
 * @param {{ sentence_sha256: string, remaining_budget_ms: number }} _context
 * @param {AbortSignal} signal
 * @returns {Promise<{ status:'ok'|'empty', payload:any } | null>}
 */
async function run(_context, signal) {
  // Fast-fail when Brain is unreachable (no key configured). Per the plan's
  // done-criteria: this must return status='empty' in <100ms.
  if (!brainClient.isAvailable()) {
    return { status: 'empty', payload: { reason: 'brain_unavailable' } };
  }
  if (signal && signal.aborted) return null;

  // Load the generic prompt template. Per Canon Part 8 this file is the SOLE
  // source of Brain query bodies for this agent -- audited in one place.
  let prompts;
  try {
    // require() caches; that is desirable here (the JSON is static config).
    prompts = require(PROMPTS_PATH).brain_similar_ventures;
  } catch (_e) {
    return { status: 'empty', payload: { reason: 'prompts_unavailable' } };
  }

  let result;
  try {
    result = await brainClient.search(prompts.query, {
      filters: prompts.filters,
      limit: prompts.limit,
    });
  } catch (_e) {
    return { status: 'empty', payload: { reason: 'brain_error' } };
  }

  if (signal && signal.aborted) return null;

  // brain-client may return { results: [...] } or null on quota-exhaustion + fallback.
  const ventures = (result && Array.isArray(result.results)) ? result.results.slice(0, 3) : [];
  if (ventures.length === 0) {
    return { status: 'empty', payload: { reason: 'no_matches' } };
  }

  const summary = 'Found ' + ventures.length + ' ventures in this space: ' +
    ventures.map((v) => (v.name || 'unnamed') + ' (' + (v.status || 'active') + ')').join(', ');

  return {
    status: 'ok',
    payload: {
      summary_line: summary,
      deck_data: { ventures: ventures },
    },
  };
}

module.exports = { run };
