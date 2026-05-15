/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-01 Plan 01 Task 1 -- mva-agent-contract.
 *
 * The AgentResult shape + the runAgent wrapper used by mva-dispatcher.cjs
 * (Task 3 of this plan). Plan 118-02 implements 6 specific agents against
 * the Agent contract documented below.
 *
 * AgentContext interface
 * ----------------------
 *   {
 *     sentence_sha256: string,        // dispatcher-provided -- ONLY identifier passed to agents
 *     remaining_budget_ms: number,    // dispatcher-provided
 *   }
 *
 *   raw_sentence is NEVER exposed to agents (Canon Part 8 hard invariant).
 *   Agents that need linguistic features must derive them from neighborhood-graph
 *   queries against room.db (sentence-sha8 only), NOT from the raw sentence string.
 *
 *   process.env.MVA_SENTENCE is NEVER set. There is no escape hatch.
 *
 * Agent function signature
 * ------------------------
 *   async function agent(context, signal) -> { status: 'ok'|'empty', payload } | null
 *
 *   If the agent throws, runAgent wraps with status='error'.
 *   If the AbortSignal fires before resolve, runAgent wraps with status='timeout'.
 *   If the agent returns null, runAgent wraps with status='empty'.
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 * Canon Part 8 invariants:
 *   - NEVER serialize stack traces (stack traces can contain user content).
 *   - Error messages capped at 200 chars (sliced to prevent user-content blow-through).
 *   - The AgentContext object passed to the agent contains ONLY documented keys.
 */
'use strict';

const ALLOWED_STATUSES = new Set(['ok', 'empty', 'error', 'timeout']);

/**
 * AGENT_RESULT_SHAPE -- a frozen object documenting the AgentResult shape.
 *
 * AgentResult = {
 *   agent_id: string,                                 // 'brain_similar' | ... | 'dashboard_graph'
 *   status: 'ok' | 'empty' | 'error' | 'timeout',
 *   duration_ms: number,                              // wall-clock from runAgent invocation
 *   payload?: any,                                    // agent-specific; opaque to dispatcher
 *   error?: string,                                   // sanitized message (<= 200 chars)
 * };
 */
const AGENT_RESULT_SHAPE = Object.freeze({
  agent_id: 'string',
  status: "'ok' | 'empty' | 'error' | 'timeout'",
  duration_ms: 'number >= 0',
  payload: 'optional any',
  error: 'optional string'
});

/**
 * validateAgentResult -- returns true if the result conforms to AgentResult shape.
 *
 * @param {unknown} result
 * @returns {boolean}
 */
function validateAgentResult(result) {
  if (!result || typeof result !== 'object') return false;
  if (typeof result.agent_id !== 'string' || result.agent_id.length === 0) return false;
  if (typeof result.status !== 'string' || !ALLOWED_STATUSES.has(result.status)) return false;
  if (typeof result.duration_ms !== 'number' || result.duration_ms < 0) return false;
  return true;
}

/**
 * Sanitize an error into a short message. Drops stack traces, drops object
 * properties, slices to 200 chars to prevent any user-content blow-through.
 *
 * @param {unknown} err
 * @returns {string}
 */
function sanitizeError(err) {
  let msg;
  if (err && typeof err === 'object' && typeof err.message === 'string') {
    msg = err.message;
  } else {
    msg = String(err);
  }
  return msg.slice(0, 200);
}

/**
 * runAgent -- invoke an agent function under an AbortController timeout. Catches
 * any throw and converts to a structured AgentResult.
 *
 * @param {{ id: string, fn: Function }} agentDef
 * @param {{ sentence_sha256: string }} context
 * @param {{ timeoutMs?: number }} opts
 * @returns {Promise<{ agent_id: string, status: string, duration_ms: number, payload?: any, error?: string }>}
 */
async function runAgent(agentDef, context, opts) {
  const timeoutMs = (opts && typeof opts.timeoutMs === 'number') ? opts.timeoutMs : 35000;
  const t0 = Date.now();
  const controller = new AbortController();

  // Build an AgentContext containing ONLY documented keys. We do not spread
  // arbitrary caller props (defense-in-depth against accidental raw_sentence
  // leakage). Canon Part 8 invariant.
  const agentContext = {
    sentence_sha256: context && context.sentence_sha256,
    remaining_budget_ms: timeoutMs
  };

  let timer;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('__mva_dispatcher_timeout__'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      Promise.resolve().then(() => agentDef.fn(agentContext, controller.signal)),
      timeoutPromise
    ]);

    if (timer) clearTimeout(timer);

    const duration_ms = Date.now() - t0;

    if (result === null || result === undefined) {
      return { agent_id: agentDef.id, status: 'empty', duration_ms };
    }

    // Result is { status: 'ok' | 'empty', payload }.
    if (result && typeof result === 'object' && typeof result.status === 'string') {
      if (result.status === 'ok' || result.status === 'empty') {
        return {
          agent_id: agentDef.id,
          status: result.status,
          duration_ms,
          payload: result.payload
        };
      }
    }

    // Unknown shape -- treat as empty (defense-in-depth; agent contract violation).
    return { agent_id: agentDef.id, status: 'empty', duration_ms };
  } catch (err) {
    if (timer) clearTimeout(timer);
    const duration_ms = Date.now() - t0;

    if (controller.signal.aborted) {
      return { agent_id: agentDef.id, status: 'timeout', duration_ms };
    }

    return {
      agent_id: agentDef.id,
      status: 'error',
      duration_ms,
      error: sanitizeError(err)
    };
  }
}

module.exports = {
  runAgent,
  validateAgentResult,
  AGENT_RESULT_SHAPE
};
