/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-02 Plan 02 Task 1 -- brain-classic-traps agent (Agent 3 of 6 in
 * B1; agent_id 'brain_classic_traps' in lib/agents/mva/index.cjs).
 *
 * Calls Brain via lib/core/brain-client.cjs::query() with a GENERIC Cypher
 * template from data/mva-agent-prompts.json. Returns top-1 FailureMode pattern
 * with a "Classic trap:" summary line.
 *
 * Graph-native HARD RULES (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
 *   2. NEVER require any Brain-MCP client module DIRECTLY for raw queries;
 *      use lib/core/brain-client.cjs which enforces the wire-schema sanitization
 *      AND only with framework-name/phase-id/enum args, never user content.
 *   3. NEVER write to stdout / stderr (telemetry side-channel rule).
 *
 * Canon Part 8 hard invariant (MVA-118-10):
 *   The Cypher carries ONLY $-bound parameters with hardcoded stage labels.
 *   NEVER the user's raw sentence. NEVER the sentence_sha256 as a Cypher
 *   string interpolation. NEVER any user-content env var (token name elided
 *   per the Test 6 grep regression).
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
    prompts = require(PROMPTS_PATH).brain_classic_traps;
  } catch (_e) {
    return { status: 'empty', payload: { reason: 'prompts_unavailable' } };
  }

  let result;
  try {
    result = await brainClient.query(prompts.cypher, prompts.params);
  } catch (_e) {
    return { status: 'empty', payload: { reason: 'brain_error' } };
  }

  if (signal && signal.aborted) return null;

  const records = (result && Array.isArray(result.records)) ? result.records : [];
  if (records.length === 0) {
    return { status: 'empty', payload: { reason: 'no_trap' } };
  }
  const trap = records[0];
  const tail = trap.signature || 'classic failure pattern';
  const summary = 'Classic trap: ' + (trap.name || 'unnamed') + ' -- ' + tail;

  return {
    status: 'ok',
    payload: {
      summary_line: summary,
      deck_data: { trap: trap },
    },
  };
}

module.exports = { run };
