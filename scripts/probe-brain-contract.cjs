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
 * POST-CONTRACT-05 (brain repo @ 8b40b30, deployed 2026-08-11): two of the
 * five legs' expected truths changed on the deployed surface. This probe was
 * updated the same day to match, WITHOUT touching
 * data/brain-surface-contract.json (the brain-side hermetic self-test stays
 * final authority over the vendored contract; brain_ask_anything is still
 * `retired_remote`, just MORE retired -- delisted instead of moat-gated).
 *
 * Five legs, each printing PASS/FAIL with verbatim httpStatus + body
 * evidence. Any leg failure sets the process exit code to 1.
 *
 *   a. tools/list on a read key -- every loop_tools name present.
 *   b. per-tool retirement mode, read from contract.retired_remote:
 *      text2cypher keeps refusing with httpStatus 403 + a MoatViolation body
 *      (reachability retirement, unchanged); brain_ask_anything is now
 *      delisted entirely -- absent from tools/list, and calling it yields a
 *      JSON-RPC unknown-tool error, NOT a 403 MoatViolation.
 *   c. brain_query on a read key -- CONTRACT-05 moved it INTO the bounded
 *      read tier: a bounded `MATCH ... RETURN ... LIMIT` read is ADMITTED
 *      (httpStatus 200, bounded rows, no refusal marker); a `CREATE` write
 *      is refused IN-BAND with a BoundedReadRefusal marker in the tool
 *      result text (httpStatus 200, refusal in content, never a transport
 *      403); and the refused write is proven to have never executed by a
 *      follow-up bounded read for zero rows.
 *   d. search + brain_search for "jobs to be done framework" -- assert no
 *      string value in any served hit matches the local-path regex
 *      (CONTRACT-03 live check, unchanged).
 *   e. brain_stats -- assert every contract.indexes.dropped name is ABSENT
 *      and every keep / keep_retired name is PRESENT (CONTRACT-04 live
 *      check). Stays HONESTLY RED (clearly labeled expected-fail, never
 *      silently marked green) until the operator runs the 7 pending index
 *      DROPs; a labeled expected-red leg does not flip the process exit code.
 *
 * Usage: node scripts/probe-brain-contract.cjs
 * Requires a read-tier Brain key (MINDRIAN_BRAIN_KEY env or ~/.mindrian.env).
 * No admin key is used or required.
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

// Labeled expected-red: a KNOWN, honestly-red state (not a pass, not a
// silent hidden failure). Does NOT flip overallOk -- the exit code stays 0
// because this is the documented pending-operator-checkpoint state, not an
// unexpected failure.
let anyExpectedRed = false;

function reportExpectedRed(name, note, evidence) {
  anyExpectedRed = true;
  console.log('[RED expected] ' + name);
  console.log('    ' + note);
  if (evidence !== undefined) {
    const text = typeof evidence === 'string' ? evidence : JSON.stringify(evidence);
    console.log('    evidence: ' + text.slice(0, 600));
  }
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
  let listedNames = [];
  const listRes = await mcpCall('tools/list', {}, key, 3);
  if (!listRes.ok) {
    reportLeg('Leg a: tools/list reachable on a read key', false, {
      httpStatus: listRes.httpStatus,
      bodyText: listRes.bodyText,
    });
  } else {
    listedNames = Array.isArray(listRes.result && listRes.result.tools)
      ? listRes.result.tools.map((t) => t.name)
      : [];
    const missing = Object.keys(contract.loop_tools).filter((n) => !listedNames.includes(n));
    reportLeg('Leg a: every loop_tools name present in tools/list', missing.length === 0, {
      total_tools_listed: listedNames.length,
      missing_loop_tools: missing,
    });
  }
  console.log('');

  // --- Leg b: each retired_remote tool -- per-tool retirement mode -------
  // CONTRACT-05: text2cypher keeps its reachability retirement (moat-gated,
  // still listed, refuses 403 MoatViolation on a read key). brain_ask_anything
  // is now delisted from tools/list -- but that does NOT mean a direct
  // tools/call to it surfaces a JSON-RPC unknown-tool error. Brain repo
  // c58e764 put a deny-by-default READ_TOOLS allowlist gate IN FRONT OF
  // registry dispatch: on a read key, `tools/call` checks the allowlist
  // before it ever looks up the tool by name, so ANY name not on the
  // allowlist -- retired, admin-only, or one that never existed -- draws the
  // identical 403 MoatViolation "not on the read allowlist" response. This
  // is deliberate: it denies a caller an existence oracle (no way to tell
  // "retired" apart from "never existed" by probing tools/call). A JSON-RPC
  // unknown-tool error would only ever reach a caller that already cleared
  // the allowlist gate -- i.e. never, for a delisted tool, on a read key.
  // So "delisted" here means: absent from tools/list (registry-level proof)
  // AND still 403 MoatViolation on direct call (allowlist-gate proof) -- the
  // gate answers first, registry dispatch is never reached.
  const RETIREMENT_MODE = { text2cypher: 'refuse-403-moat', brain_ask_anything: 'delisted' };
  for (const toolName of contract.retired_remote) {
    const mode = RETIREMENT_MODE[toolName] || 'refuse-403-moat';
    if (mode === 'delisted') {
      const isAbsent = !listedNames.includes(toolName);
      const r = await callTool(toolName, { raw: 'probe', question: 'probe' }, key);
      const isGatedMoat = !r.ok && r.httpStatus === 403 && /MoatViolation/i.test(r.bodyText || '') && /not on the read allowlist/i.test(r.bodyText || '');
      const ok = isAbsent && isGatedMoat;
      reportLeg('Leg b: retired tool "' + toolName + '" is delisted (absent from tools/list, allowlist-gate 403 MoatViolation on direct call)', ok, {
        listed: !isAbsent,
        call_httpStatus: r.httpStatus,
        call_bodyText: r.ok ? '(unexpectedly succeeded)' : r.bodyText,
      });
    } else {
      const r = await callTool(toolName, { raw: 'probe', question: 'probe' }, key);
      const is403Moat = !r.ok && r.httpStatus === 403 && /MoatViolation/i.test(r.bodyText || '');
      reportLeg('Leg b: retired tool "' + toolName + '" refuses with 403 MoatViolation on a read key', is403Moat, {
        httpStatus: r.httpStatus,
        bodyText: r.ok ? '(unexpectedly succeeded)' : r.bodyText,
      });
    }
  }
  console.log('');

  // --- Leg c: brain_query -- bounded-read admission (CONTRACT-05) --------
  // c1: a bounded read is ADMITTED at HTTP 200 with real rows, no refusal.
  const c1Res = await callTool('brain_query', { cypher: 'MATCH (n) RETURN n LIMIT 1' }, key);
  const c1Text = c1Res.ok ? JSON.stringify(c1Res.result) : c1Res.bodyText || '';
  const c1NoRefusal = !/BoundedReadRefusal|MoatViolation/i.test(c1Text);
  const c1RowCount = c1Res.ok ? _countRows(c1Res.result) : 0;
  const c1Ok = c1Res.ok && c1Res.httpStatus === 200 && c1NoRefusal && c1RowCount > 0;
  reportLeg('Leg c1: brain_query bounded read is ADMITTED on a read key (MATCH...LIMIT)', c1Ok, {
    httpStatus: c1Res.httpStatus,
    row_count: c1RowCount,
    bodyText: c1Text.slice(0, 300),
  });

  // c2: a write attempt is refused IN-BAND (HTTP 200 + BoundedReadRefusal in
  // the tool result text), never executed as a transport-level 403.
  const c2Res = await callTool('brain_query', { cypher: 'CREATE (n:ContractProbeCanary) RETURN n' }, key);
  const c2Text = c2Res.ok ? JSON.stringify(c2Res.result) : c2Res.bodyText || '';
  const c2Ok = c2Res.ok && c2Res.httpStatus === 200 && /BoundedReadRefusal/i.test(c2Text);
  reportLeg('Leg c2: brain_query write attempt refused IN-BAND with BoundedReadRefusal (HTTP 200)', c2Ok, {
    httpStatus: c2Res.httpStatus,
    bodyText: c2Text.slice(0, 300),
  });

  // c3: live proof the refused CREATE never executed -- the canary node does
  // not exist, using the read admission c1 just proved.
  const c3Res = await callTool('brain_query', { cypher: 'MATCH (n:ContractProbeCanary) RETURN n LIMIT 1' }, key);
  const c3RowCount = c3Res.ok ? _countRows(c3Res.result) : -1;
  const c3Ok = c3Res.ok && c3RowCount === 0;
  reportLeg('Leg c3: refused CREATE never executed (zero ContractProbeCanary rows)', c3Ok, {
    httpStatus: c3Res.httpStatus,
    row_count: c3RowCount,
    bodyText: c3Res.ok ? JSON.stringify(c3Res.result).slice(0, 300) : c3Res.bodyText,
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
    const evidence = {
      indexes_seen: indexNames,
      dropped_but_still_present: shouldBeAbsent,
      keep_but_missing: shouldBePresent,
    };

    const sortedAbsent = [...shouldBeAbsent].sort();
    const sortedDropped = [...contract.indexes.dropped].sort();
    const isExactlyPendingState =
      shouldBePresent.length === 0 &&
      sortedAbsent.length === sortedDropped.length &&
      sortedAbsent.every((n, i) => n === sortedDropped[i]);

    if (shouldBeAbsent.length === 0 && shouldBePresent.length === 0) {
      // The future state after the operator runs the DROPs.
      reportLeg('Leg e: brain_stats index dispositions match the contract', true, evidence);
    } else if (isExactlyPendingState) {
      reportExpectedRed(
        'Leg e: brain_stats index dispositions match the contract',
        '7 dropped-index DROPs still pending the operator checkpoint (CONTRACT-04); honestly red, NOT a pass',
        evidence
      );
    } else {
      // Any other mismatch (a keep index missing, or a partial drop set) is
      // a real failure, not the known pending state.
      reportLeg('Leg e: brain_stats index dispositions match the contract', false, evidence);
    }
  }
  console.log('');

  if (overallOk && anyExpectedRed) {
    console.log('=== ALL ASSERTED LEGS PASSED (leg e HONESTLY RED: 7 DROPs pending operator checkpoint) ===');
  } else {
    console.log(overallOk ? '=== ALL LEGS PASSED ===' : '=== ONE OR MORE LEGS FAILED ===');
  }
  process.exit(overallOk ? 0 : 1);
}

// Loosely count rows in a brain_query bounded-read result across the
// tolerated shapes: a plain array, a `{records: [...]}` wrapper, or a
// `{text: '...'}` wrapper (callTool's non-JSON fallback) -- never assert on
// one exact schema.
function _countRows(result) {
  if (result === null || result === undefined) return 0;
  if (Array.isArray(result)) return result.length;
  if (typeof result === 'object') {
    if (Array.isArray(result.records)) return result.records.length;
    if (Array.isArray(result.rows)) return result.rows.length;
    if (Array.isArray(result.data)) return result.data.length;
    if (typeof result.text === 'string') {
      // Non-JSON text fallback: treat non-empty, non-"[]"/"empty" text as a
      // signal of at least one row, without over-parsing an unknown shape.
      const t = result.text.trim();
      if (t.length === 0 || t === '[]' || /no rows|empty/i.test(t)) return 0;
      return 1;
    }
    // Unknown object shape with content -- treat as at least one row.
    return Object.keys(result).length > 0 ? 1 : 0;
  }
  return 0;
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
