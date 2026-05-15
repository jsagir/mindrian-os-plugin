/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-02 Plan 02 Task 1 -- brain-cross-domain agent (Agent 2 of 6 in
 * B1; agent_id 'brain_cross_domain' in lib/agents/mva/index.cjs).
 *
 * Calls Brain via lib/core/brain-client.cjs::search() in cross-domain mode
 * (GENERIC handle from data/mva-agent-prompts.json) and returns top-1
 * analogous framework with a one-line "Cross-domain analogy:" summary.
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
 *   2. NEVER require any Brain-MCP client module DIRECTLY for raw queries;
 *      use lib/core/brain-client.cjs which enforces the wire-schema sanitization
 *      AND only with framework-name/phase-id/enum args, never user content.
 *   3. NEVER write to stdout / stderr (telemetry side-channel rule).
 *
 * Canon Part 8 hard invariant (MVA-118-09):
 *   The Brain query carries ONLY a hardcoded generic handle. NEVER the user's
 *   raw sentence. NEVER the sentence_sha256 as a free-text query body. NEVER
 *   any user-content env var (token name elided per the Test 6 grep regression).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const path = require('node:path');
const brainClient = require('../../core/brain-client.cjs');

const PROMPTS_PATH = path.resolve(__dirname, '..', '..', '..', 'data', 'mva-agent-prompts.json');

/**
 * @param {{ sentence_sha256: string, remaining_budget_ms: number }} _context
 * @param {AbortSignal} signal
 * @returns {Promise<{ status:'ok'|'empty', payload:any } | null>}
 */
async function run(_context, signal) {
  if (!brainClient.isAvailable()) {
    return { status: 'empty', payload: { reason: 'brain_unavailable' } };
  }
  if (signal && signal.aborted) return null;

  let prompts;
  try {
    prompts = require(PROMPTS_PATH).brain_cross_domain;
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

  const analogies = (result && Array.isArray(result.results)) ? result.results : [];
  if (analogies.length === 0) {
    return { status: 'empty', payload: { reason: 'no_analogy' } };
  }
  const analogy = analogies[0];
  const tail = analogy.signature || 'pattern transfer applicable';
  const summary = 'Cross-domain analogy: ' + (analogy.name || 'unnamed') + ' -- ' + tail;

  return {
    status: 'ok',
    payload: {
      summary_line: summary,
      deck_data: { analogy: analogy },
    },
  };
}

module.exports = { run };
