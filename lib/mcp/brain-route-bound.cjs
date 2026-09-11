'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 260911-ddd (DDD-02) -- the single source of truth for
 * brain-router.cjs's Tier 3 race bound. A pure-data leaf: requires nothing,
 * opens no wire. lib/mcp/brain-router.cjs reads BRAIN_ROUTE_TIMEOUT_MS /
 * resolveBrainRouteTimeoutMs() to build its Promise.race; brain-composition-
 * census.cjs's bound_ms entry reads BRAIN_ROUTE_TIMEOUT_MS so the census
 * DECLARATION depends on a constant instead of on the router's own
 * implementation -- that direction (census -> leaf, never census -> router)
 * is what keeps the census honest: a router edit can never silently move the
 * bound the census reports without also moving this leaf.
 *
 * WHY 6000, MEASURED GROUND (not intuition):
 *
 * The raced call is brainClient.ask(), which since quick 260910-hni makes
 * THREE sequential Theo calls (brain_ask, then recommend_chain, then
 * brain_query). A Render instance waking from spin-down was measured at
 * 2.034 s on the FIRST call alone, and Theo redeploys on every push to its
 * main, opening a fresh cold window each time. So the old 2000 ms bound
 * could not cover even a WARM three-call composition on a slow link, let
 * alone a cold one -- every cold window silently degraded /mos:act to the
 * local heuristic with no disclosure of why.
 *
 * 6000 is the measured 2.034 s cold wake plus two warm follow-on calls
 * (roughly 1 s total) with roughly 2x headroom on top of that sum.
 *
 * THE ACCEPTED COST: when Theo is genuinely down, the race now rejects at
 * 6 s instead of 2 s. This is a real cost, not hand-waved away -- but
 * localRec (lib/mcp/brain-router.cjs's Tier 2 local heuristic) is already
 * computed BEFORE the race starts, so the Tier 2 answer is instant once the
 * race loses and /mos:act still resolves either way. The trade is a rarer
 * 6 s worst case against a silently degraded recommendation on every cold
 * window -- accepted (see the threat register, T-ddd-04).
 *
 * No em-dashes. CJS only.
 */

/**
 * The default Tier 3 race bound in milliseconds. See the file header for
 * the measured justification.
 * @type {number}
 */
const BRAIN_ROUTE_TIMEOUT_MS = 6000;

/**
 * resolveBrainRouteTimeoutMs(env) -- honors MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS
 * only when it parses to a finite integer strictly greater than 0;
 * otherwise returns BRAIN_ROUTE_TIMEOUT_MS unchanged. A malformed operator
 * env can never zero out or invert the bound.
 *
 * @param {object} [env] defaults to process.env
 * @returns {number}
 */
function resolveBrainRouteTimeoutMs(env) {
  const source = env || process.env;
  const raw = source && source.MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS;
  if (typeof raw !== 'string' || raw.trim().length === 0) return BRAIN_ROUTE_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return BRAIN_ROUTE_TIMEOUT_MS;
  return parsed;
}

module.exports = { BRAIN_ROUTE_TIMEOUT_MS, resolveBrainRouteTimeoutMs };
