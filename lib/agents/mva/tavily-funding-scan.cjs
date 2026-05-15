/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-02 Plan 02 Task 2 -- tavily-funding-scan agent (Agent 4 of 6 in
 * B1; agent_id 'tavily_funding' in lib/agents/mva/index.cjs).
 *
 * Calls Tavily public-funding search via native fetch with a HARDCODED generic
 * query. Returns top-1 funding match with summary line + structured deck_data.
 *
 * Graph-native HARD RULES:
 *   1. NEVER require room-db.cjs directly (Phase 109 D-06 chokepoint).
 *   2. NEVER write to stdout / stderr (telemetry side-channel rule).
 *   3. NEVER include the user's raw sentence in the fetch body; only the
 *      hardcoded generic query string + a fixed search profile.
 *
 * Canon Part 8 hard invariant (MVA-118-11):
 *   The Tavily query is a HARDCODED STRING LITERAL. NEVER context-derived.
 *   NEVER the sentence_sha256 (a hash of a hash is still derived from user
 *   content). NEVER any user-content env var (token name elided so the
 *   test-all-six-agents.cjs Test 10 grep regression returns zero matches).
 *
 * OQ9: Tavily fallback when TAVILY_API_KEY is missing.
 *   Returns { status:'empty', payload: { reason:'tavily_unavailable' } } in <50ms.
 *   The brief still renders 5 of 6 surfaces; Plan 118-03's renderer will show
 *   "Live funding scan: not configured -- add TAVILY_API_KEY to ~/.mindrian.env".
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Resolve the Tavily API key with the standard env -> ~/.mindrian.env precedence
 * pattern mirrored from lib/core/resolve-brain-key.cjs (Phase 123 Plan-07).
 *
 * Precedence (first hit wins):
 *   1. process.env.TAVILY_API_KEY
 *   2. <home>/.mindrian.env line `TAVILY_API_KEY=...`
 *   3. <cwd>/.env line `TAVILY_API_KEY=...`
 *   4. null
 *
 * Returns the trimmed key or null. Quotes around the value are stripped to
 * match the feedback_gmail_qp_env_var_corruption memory rule (values starting
 * with a hex digit get QP-decoded if not quoted; users wrap in double quotes).
 *
 * @returns {string|null}
 */
function resolveTavilyKey() {
  // 1. env var
  const envKey = process.env.TAVILY_API_KEY;
  if (typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  // 2. ~/.mindrian.env
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const mindrianEnv = path.join(home, '.mindrian.env');
  if (fs.existsSync(mindrianEnv)) {
    try {
      const body = fs.readFileSync(mindrianEnv, 'utf8');
      const m = body.match(/^TAVILY_API_KEY\s*=\s*"?([^"\n]+?)"?\s*$/m);
      if (m && m[1] && m[1].trim().length > 0) return m[1].trim();
    } catch (_e) { /* fall through */ }
  }
  // 3. <cwd>/.env
  const cwdEnv = path.join(process.cwd(), '.env');
  if (fs.existsSync(cwdEnv)) {
    try {
      const body = fs.readFileSync(cwdEnv, 'utf8');
      const m = body.match(/^TAVILY_API_KEY\s*=\s*"?([^"\n]+?)"?\s*$/m);
      if (m && m[1] && m[1].trim().length > 0) return m[1].trim();
    } catch (_e) { /* fall through */ }
  }
  return null;
}

/**
 * @param {{ sentence_sha256: string, remaining_budget_ms: number }} _context
 * @param {AbortSignal} signal
 * @returns {Promise<{ status:'ok'|'empty', payload:any } | null>}
 */
async function run(_context, signal) {
  const key = resolveTavilyKey();
  if (!key) {
    return { status: 'empty', payload: { reason: 'tavily_unavailable' } };
  }
  if (signal && signal.aborted) return null;

  // Canon Part 8: HARDCODED generic query. NEVER context-derived.
  // The intelligence comes from Tavily indexing public funding sources, not
  // from tailoring the query to THIS user's venture.
  const query = "early-stage venture grants pre-seed funding tracks open deadline";

  let response;
  try {
    response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
      },
      body: JSON.stringify({
        query: query,
        max_results: 3,
        search_depth: 'basic',
        topic: 'news',
      }),
      signal: signal,
    });
  } catch (_e) {
    if (signal && signal.aborted) return null;
    return { status: 'empty', payload: { reason: 'tavily_error' } };
  }

  if (signal && signal.aborted) return null;
  if (!response || !response.ok) {
    return { status: 'empty', payload: { reason: 'tavily_error' } };
  }

  let data;
  try {
    data = await response.json();
  } catch (_e) {
    return { status: 'empty', payload: { reason: 'tavily_parse_error' } };
  }

  const results = (data && Array.isArray(data.results)) ? data.results : [];
  if (results.length === 0) {
    return { status: 'empty', payload: { reason: 'no_funding_matches' } };
  }
  const top = results[0];
  const titleStr = top.title || 'opportunity';
  const snippetStr = String(top.snippet || '').slice(0, 80);
  const summary = 'Live funding match: ' + titleStr + ' -- ' + snippetStr;

  return {
    status: 'ok',
    payload: {
      summary_line: summary,
      deck_data: { funding: results.slice(0, 3) },
    },
  };
}

module.exports = { run, _test: { resolveTavilyKey } };
