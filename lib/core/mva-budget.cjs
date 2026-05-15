/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-01 Plan 01 Task 2 -- mva-budget.
 *
 * Global wall-clock budget tracker used by mva-dispatcher.cjs. Per binding
 * decision B2 (HARD):
 *   GLOBAL_BUDGET_MS = 45000   (the hard 30-Second-MVA cap; named for the
 *                               sharp-question fallback window per source spec
 *                               line 113 -- "Hard budget: 45 seconds maximum")
 *   PER_AGENT_CAP_MS = 35000   (each agent gets at most 35s OR remaining
 *                               global, whichever is less -- source spec
 *                               line 123 -- "Agents return structured JSON
 *                               within 35s budget each")
 *
 * The dispatcher creates ONE budget per dispatch call. Each agent's per-agent
 * abort signal feeds from this budget via perAgentMs(): min(35000, remainingMs()).
 *
 * Pure CJS, leaf module -- no dependencies on any other lib/core file.
 * Canon Part 8: this module touches NO user content; it is wall-clock math only.
 */
'use strict';

const GLOBAL_BUDGET_MS = 45000;
const PER_AGENT_CAP_MS = 35000;

/**
 * Create a wall-clock budget tracker.
 *
 * @param {number} [globalBudgetMs=45000]
 * @returns {{
 *   startedAt: number,
 *   globalBudgetMs: number,
 *   remainingMs: () => number,
 *   perAgentMs: (cap?: number) => number,
 *   isExpired: () => boolean,
 *   elapsedMs: () => number,
 * }}
 */
function createBudget(globalBudgetMs) {
  const cap = (typeof globalBudgetMs === 'number') ? globalBudgetMs : GLOBAL_BUDGET_MS;
  const startedAt = Date.now();

  function remainingMs() {
    return Math.max(0, cap - (Date.now() - startedAt));
  }

  function perAgentMs(perAgentCapMs) {
    const requested = (typeof perAgentCapMs === 'number') ? perAgentCapMs : PER_AGENT_CAP_MS;
    return Math.max(0, Math.min(requested, remainingMs()));
  }

  function isExpired() {
    return remainingMs() === 0;
  }

  function elapsedMs() {
    return Date.now() - startedAt;
  }

  return {
    startedAt,
    globalBudgetMs: cap,
    remainingMs,
    perAgentMs,
    isExpired,
    elapsedMs
  };
}

module.exports = {
  createBudget,
  GLOBAL_BUDGET_MS,
  PER_AGENT_CAP_MS
};
