/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-01 Plan 01 Task 3 -- mva-dispatcher.
 *
 * The parallel fan-out primitive used by Plan 118-03 (progressive streaming)
 * and Plan 118-04 (deck generation). Plan 118-02 supplies the 6 specific
 * agents (brain_similar, brain_cross_domain, brain_classic_traps,
 * tavily_funding, six_hats_red_black, dashboard_graph); this module knows
 * NOTHING about which agents are which -- it accepts any { id, fn } tuple
 * conforming to the Agent contract in lib/core/mva-agent-contract.cjs.
 *
 * Per binding decision B2 (HARD):
 *   - 45-second global wall-clock budget
 *   - 35-second per-agent budget
 *   - Per-agent abort signal feeds from global deadline:
 *       perAgentTimeout = min(35000, remainingGlobalMs)
 *
 * Per binding decision B7:
 *   - Per-agent failure (throw, timeout, empty) does NOT abort sibling agents
 *   - All-fail does NOT throw; it returns N error/timeout results so the
 *     caller (Plan 118-03) can render the sharp-question fallback
 *
 * Streaming-as-settled pattern: results yield in arrival order. Fast agents
 * yield before slow agents finish. Implemented via a settlement queue with
 * a deferred-resolve "ready" promise.
 *
 * Canon Part 8 hard invariants (zero user-content egress):
 *   - The dispatcher passes ONLY sentence_sha256 to agents (NOT the raw sentence)
 *   - process.env.MVA_SENTENCE is NEVER read or written by this module
 *   - No stdout / stderr writes (telemetry side-channel rule)
 *   - No Brain MCP client require (agents own their own I/O)
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const { runAgent } = require('./mva-agent-contract.cjs');
const { createBudget } = require('./mva-budget.cjs');

/**
 * dispatch -- parallel fan-out over agents, yielding each AgentResult as it
 * settles (streaming-as-settled). Compatible with `for await (...)` consumers.
 *
 * @param {Array<{ id: string, fn: Function }>} agents - 6 agents from Plan 118-02
 * @param {string} sentence_sha256 - the ONLY sentence-derived identifier
 * @param {{ globalBudgetMs?: number, perAgentCapMs?: number }} [opts]
 * @returns {AsyncGenerator<{ agent_id: string, status: string, duration_ms: number, payload?: any, error?: string }>}
 */
async function* dispatch(agents, sentence_sha256, opts) {
  const options = opts || {};
  const budget = createBudget(options.globalBudgetMs);
  const perAgentCap = (typeof options.perAgentCapMs === 'number') ? options.perAgentCapMs : undefined;

  // Settlement queue. Each entry is a promise that resolves with an AgentResult.
  // We use a deferred "ready" notification so the async generator can yield
  // results in arrival order without busy-waiting.
  const queue = [];
  let pendingCount = agents.length;
  let notify;
  let ready = new Promise((r) => { notify = r; });

  // Kick off every agent in parallel. Each agent runs under its own per-agent
  // budget = min(perAgentCap, budget.remainingMs()) computed at start.
  for (const agent of agents) {
    const timeoutMs = budget.perAgentMs(perAgentCap);
    const context = { sentence_sha256: sentence_sha256 };

    // Fire-and-forget; result lands in the queue. runAgent never throws.
    runAgent(agent, context, { timeoutMs }).then((result) => {
      queue.push(result);
      const fire = notify;
      ready = new Promise((r) => { notify = r; });
      fire();
    });
  }

  while (pendingCount > 0) {
    if (queue.length === 0) {
      await ready;
    }
    while (queue.length > 0) {
      pendingCount -= 1;
      yield queue.shift();
    }
  }
}

/**
 * dispatchToArray -- convenience wrapper that collects the AsyncIterable into
 * a Promise<Array>. Plan 118-04 (deck generator) uses this; Plan 118-03
 * (progressive streaming) uses the streaming dispatch directly.
 *
 * @param {Array<{ id: string, fn: Function }>} agents
 * @param {string} sentence_sha256
 * @param {{ globalBudgetMs?: number, perAgentCapMs?: number }} [opts]
 * @returns {Promise<Array<{ agent_id: string, status: string, duration_ms: number, payload?: any, error?: string }>>}
 */
async function dispatchToArray(agents, sentence_sha256, opts) {
  const results = [];
  for await (const r of dispatch(agents, sentence_sha256, opts)) {
    results.push(r);
  }
  return results;
}

module.exports = {
  dispatch,
  dispatchToArray
};
