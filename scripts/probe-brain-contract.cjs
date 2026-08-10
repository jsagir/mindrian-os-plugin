#!/usr/bin/env node
'use strict';

/*
 * scripts/probe-brain-contract.cjs
 * =================================
 * Phase 247-02 (CONTRACT-01), conformance leg 3: the LIVE drift probe.
 * Diffs the DEPLOYED Brain surface against data/brain-surface-contract.json.
 * This is a RELEASE GATE, not a commit gate -- it makes real network calls
 * to pws-brain-mcp.onrender.com (or MINDRIAN_BRAIN_URL) using a READ key
 * only. Per the 247-02 plan this script is authored and parse-checked here;
 * it runs as part of the required live gate in 247-03 Task 3, and again at
 * every future release before a claim of "the contract holds" is made.
 *
 * Reuses the brainCall/_initializeOnce wire pattern from
 * scripts/build-brain-census.cjs VERBATIM (headers, jsonrpc 2.0 body shape,
 * SSE "data: " line parse, status-honest {ok, httpStatus, bodyText} return
 * shape -- NEVER null on a non-OK response). Generalized here to also cover
 * `tools/list` (brainCall is tools/call-only). Canon Part 7: no new HTTP
 * client invented, the wire shape is copied, not reinvented.
 *
 * Key loading: identical to build-brain-census.cjs -- MINDRIAN_BRAIN_KEY env
 * or ~/.mindrian.env via lib/core/resolve-brain-key.cjs (SEC-02 permission
 * check included). The key is NEVER written to a tracked file and NEVER
 * printed in full -- only presence/absence and a length, never the value.
 *
 * Five legs, each printing PASS/FAIL with verbatim httpStatus + body
 * evidence. Any leg failure sets the process exit code to 1.
 *
 *   a. tools/list on a read key -- every loop_tools name present.
 *   b. each retired_remote tool called with a trivial arg -- require
 *      httpStatus 403 with a MoatViolation body (registration may
 *      legitimately keep them listed in tools/list -- REACHABILITY on a
 *      read key is what "retired" means here).
 *   c. brain_query on a read key -- require 403 MoatViolation (the known
 *      admin-gated tool; live proof of the tier_denied error semantics).
 *   d. search + brain_search for "jobs to be done framework" -- assert no
 *      string value in any served hit matches the local-path regex
 *      (CONTRACT-03 live check).
 *   e. brain_stats -- assert every contract.indexes.dropped name is ABSENT
 *      and every keep / keep_retired name is PRESENT (CONTRACT-04 live
 *      check).
 *
 * Usage: node scripts/probe-brain-contract.cjs
 * Requires a read-tier Brain key (MINDRIAN_BRAIN_KEY env or ~/.mindrian.env).
 * No admin key is used or required -- every leg above is a read-tier call,
 * including the ones that expect (and require) a 403.
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(REPO_ROOT, 'data', 'brain-surface-contract.json');

// Mirrors lib/core/brain-client.cjs line ~24 (the single source of the
// default URL for the deployed Render edge).
const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://pws-brain-mcp.onrender.com';
const BRAIN_REQUEST_TIMEOUT_MS = Number(process.env.MINDRIAN_BRAIN_TIMEOUT_MS) || 20000;

const ABS_PATH_RE = /^(?:[/~]|[A-Za-z]:[\\/]|\\\\)/;

// ---------------------------------------------------------------------------
// mcpCall(method, params, key, idNum) -- raw JSON-RPC over the Brain's
// Streamable HTTP transport. Generalizes build-brain-census.cjs's brainCall()
// (tools/call-only) to also cover `initialize` and `tools/list`, keeping the
// wire shape verbatim (headers, body, SSE "data: " line parse). Never
// returns null on a non-OK response -- { ok:false, httpStatus, bodyText }
// surfaces the status and body verbatim, the status-honest precedent this
// probe exists to prove out live.
// ---------------------------------------------------------------------------
function _looksSessionRequired(bodyText) {
  return typeof bodyText === 'string' && /session/i.test(bodyText) && /required|missing|invalid/i.test(bodyText);
}

async function mcpCall(method, params, key, idNum) {
  const doCall = async () =>
    fetch(BRAIN_URL + '/mcp', {
      method: 'POST',
      signal: AbortSignal.timeout(BRAIN_REQUEST_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer ' + key,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: idNum || 1,
        method: method,
        params: params || {},
      }),
    });

  let res;
  try {
    res = await doCall();
  } catch (e) {
    return { ok: false, httpStatus: 0, bodyText: 'fetch failed: ' + (e && e.message ? e.message : String(e)) };
  }

  let bodyText;
  try {
    bodyText = await res.text();
  } catch (e) {
    return {
      ok: false,
      httpStatus: res.status,
      bodyText: 'body read failed: ' + (e && e.message ? e.message : String(e)),
    };
  }

  if (!res.ok) {
    if (method !== 'initialize' && _looksSessionRequired(bodyText)) {
      const initRes = await mcpCall('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mindrian-contract-probe', version: '1.0.0' },
      }, key, 1).catch(() => ({ ok: false }));
      if (initRes.ok) {
        return mcpCall(method, params, key, idNum);
      }
    }
    return { ok: false, httpStatus: res.status, bodyText: bodyText };
  }

  // Two valid success-body shapes on this transport: plain JSON, or an SSE
  // "data: " line (tools/call, initialize commonly use SSE).
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch (_e) {
    const dataLine = bodyText.split('\n').find((l) => l.startsWith('data: '));
    if (!dataLine) {
      return {
        ok: false,
        httpStatus: res.status,
        bodyText: 'no JSON body and no SSE data line: ' + bodyText.slice(0, 500),
      };
    }
    try {
      parsed = JSON.parse(dataLine.slice(6));
    } catch (_e2) {
      return { ok: false, httpStatus: res.status, bodyText: 'unparsable SSE payload: ' + bodyText.slice(0, 500) };
    }
  }

  if (parsed.error) {
    return { ok: false, httpStatus: res.status, bodyText: JSON.stringify(parsed.error) };
  }
  return { ok: true, httpStatus: res.status, result: parsed.result };
}

async function callTool(toolName, args, key) {
  const r = await mcpCall('tools/call', { name: toolName, arguments: args || {} }, key, 2);
  if (!r.ok) return r;
  const result = r.result;
  if (result && Array.isArray(result.content)) {
    const textContent = result.content.find((c) => c && c.type === 'text');
    if (textContent) {
      try {
        return { ok: true, httpStatus: r.httpStatus, result: JSON.parse(textContent.text) };
      } catch (_e) {
        return { ok: true, httpStatus: r.httpStatus, result: { text: textContent.text } };
      }
    }
  }
  return { ok: true, httpStatus: r.httpStatus, result: result || null };
}

// ---------------------------------------------------------------------------
// Recursively walk a value for any string matching ABS_PATH_RE. Returns the
// first offending [path, value] pair found, or null. Bounded depth (10) so a
// pathological/circular payload cannot hang the probe.
// ---------------------------------------------------------------------------
function findAbsPathLeak(value, keyPath, depth) {
  if (depth > 10 || value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return ABS_PATH_RE.test(value) ? [keyPath, value] : null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findAbsPathLeak(value[i], keyPath + '[' + i + ']', depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const k of Object.keys(value)) {
      const hit = findAbsPathLeak(value[k], keyPath + '.' + k, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Leg runner -- prints PASS/FAIL with verbatim evidence, tracks overall exit.
// ---------------------------------------------------------------------------
let overallOk = true;

function reportLeg(name, ok, evidence) {
  const tag = ok ? 'PASS' : 'FAIL';
  console.log('[' + tag + '] ' + name);
  if (evidence !== undefined) {
    const text = typeof evidence === 'string' ? evidence : JSON.stringify(evidence);
    console.log('    evidence: ' + text.slice(0, 600));
  }
  if (!ok) overallOk = false;
}

async function main() {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));

  const { resolveBrainKey } = require('../lib/core/resolve-brain-key.cjs');
  const keyInfo = resolveBrainKey();
  if (!keyInfo.available) {
    console.error('Brain key unavailable: ' + keyInfo.reason);
    console.error('This probe needs a READ-tier key (MINDRIAN_BRAIN_KEY env or ~/.mindrian.env). No admin key is used.');
    process.exit(1);
  }
  const key = keyInfo.key;
  console.log('Brain URL: ' + BRAIN_URL);
  console.log('Key loaded from: ' + keyInfo.source + ' (length ' + key.length + ', value never printed)');
  console.log('');

  // --- Leg a: tools/list -- every loop_tools name present ---------------
  const listRes = await mcpCall('tools/list', {}, key, 3);
  if (!listRes.ok) {
    reportLeg('Leg a: tools/list reachable on a read key', false, {
      httpStatus: listRes.httpStatus,
      bodyText: listRes.bodyText,
    });
  } else {
    const names = Array.isArray(listRes.result && listRes.result.tools)
      ? listRes.result.tools.map((t) => t.name)
      : [];
    const missing = Object.keys(contract.loop_tools).filter((n) => !names.includes(n));
    reportLeg('Leg a: every loop_tools name present in tools/list', missing.length === 0, {
      total_tools_listed: names.length,
      missing_loop_tools: missing,
    });
  }
  console.log('');

  // --- Leg b: each retired_remote tool -- 403 MoatViolation --------------
  for (const toolName of contract.retired_remote) {
    const r = await callTool(toolName, { raw: 'probe', question: 'probe' }, key);
    const is403Moat = !r.ok && r.httpStatus === 403 && /MoatViolation/i.test(r.bodyText || '');
    reportLeg('Leg b: retired tool "' + toolName + '" refuses with 403 MoatViolation on a read key', is403Moat, {
      httpStatus: r.httpStatus,
      bodyText: r.ok ? '(unexpectedly succeeded)' : r.bodyText,
    });
  }
  console.log('');

  // --- Leg c: brain_query -- 403 MoatViolation (admin-gated) -------------
  const queryRes = await callTool('brain_query', { cypher: 'RETURN 1 AS n' }, key);
  const queryIs403Moat = !queryRes.ok && queryRes.httpStatus === 403 && /MoatViolation/i.test(queryRes.bodyText || '');
  reportLeg('Leg c: brain_query refuses with 403 MoatViolation on a read key (tier_denied live proof)', queryIs403Moat, {
    httpStatus: queryRes.httpStatus,
    bodyText: queryRes.ok ? '(unexpectedly succeeded)' : queryRes.bodyText,
  });
  console.log('');

  // --- Leg d: search + brain_search -- no local-path leak -----------------
  const probeQuestion = 'jobs to be done framework';
  const searchRes = await callTool('search', { query: probeQuestion, topK: 5 }, key);
  const brainSearchRes = await callTool('brain_search', { query: probeQuestion, topK: 5 }, key);

  const searchLeak = searchRes.ok ? findAbsPathLeak(searchRes.result, 'search', 0) : null;
  const searchOk = searchRes.ok ? !searchLeak : false;
  reportLeg('Leg d: search("' + probeQuestion + '") serves no local-path leak', searchOk, {
    httpStatus: searchRes.httpStatus,
    bodyText: searchRes.ok ? (searchLeak ? 'LEAK at ' + searchLeak[0] + ': ' + searchLeak[1] : '(clean)') : searchRes.bodyText,
  });

  const brainSearchLeak = brainSearchRes.ok ? findAbsPathLeak(brainSearchRes.result, 'brain_search', 0) : null;
  const brainSearchOk = brainSearchRes.ok ? !brainSearchLeak : false;
  reportLeg('Leg d: brain_search("' + probeQuestion + '") serves no local-path leak', brainSearchOk, {
    httpStatus: brainSearchRes.httpStatus,
    bodyText: brainSearchRes.ok
      ? brainSearchLeak
        ? 'LEAK at ' + brainSearchLeak[0] + ': ' + brainSearchLeak[1]
        : '(clean)'
      : brainSearchRes.bodyText,
  });
  console.log('');

  // --- Leg e: brain_stats -- index dispositions match the contract -------
  const statsRes = await callTool('brain_stats', {}, key);
  if (!statsRes.ok) {
    reportLeg('Leg e: brain_stats reachable on a read key', false, {
      httpStatus: statsRes.httpStatus,
      bodyText: statsRes.bodyText,
    });
  } else {
    const indexNames = _extractIndexNames(statsRes.result);
    const shouldBeAbsent = contract.indexes.dropped.filter((n) => indexNames.includes(n));
    const shouldBePresent = [].concat(contract.indexes.keep, contract.indexes.keep_retired).filter((n) => !indexNames.includes(n));
    const ok = shouldBeAbsent.length === 0 && shouldBePresent.length === 0;
    reportLeg('Leg e: brain_stats index dispositions match the contract', ok, {
      indexes_seen: indexNames,
      dropped_but_still_present: shouldBeAbsent,
      keep_but_missing: shouldBePresent,
    });
  }
  console.log('');

  console.log(overallOk ? '=== ALL LEGS PASSED ===' : '=== ONE OR MORE LEGS FAILED ===');
  process.exit(overallOk ? 0 : 1);
}

/**
 * brain_stats result shapes have varied across the repo's history (a plain
 * array of index rows, or an object keyed by section). Handle both without
 * guessing at an undocumented shape: look for an array of objects carrying a
 * `name` (or `index`) key anywhere at the top level or one level deep.
 */
function _extractIndexNames(stats) {
  if (!stats || typeof stats !== 'object') return [];
  const names = [];
  const rows = Array.isArray(stats) ? stats : Array.isArray(stats.vectorIndexes) ? stats.vectorIndexes : Array.isArray(stats.indexes) ? stats.indexes : null;
  if (rows) {
    for (const row of rows) {
      if (row && typeof row === 'object') {
        const n = row.name || row.index || row.index_name;
        if (typeof n === 'string') names.push(n);
      } else if (typeof row === 'string') {
        names.push(row);
      }
    }
    return names;
  }
  // Fallback: scan one level deep for anything array-shaped with name-ish rows.
  for (const key of Object.keys(stats)) {
    const v = stats[key];
    if (Array.isArray(v)) {
      for (const row of v) {
        if (row && typeof row === 'object' && typeof row.name === 'string') names.push(row.name);
      }
    }
  }
  return names;
}

module.exports = { mcpCall, callTool, findAbsPathLeak, _extractIndexNames, BRAIN_URL };

if (require.main === module) {
  main().catch((e) => {
    console.error('FAIL: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
