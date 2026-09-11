#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 260911-ddd (DDD-02) -- a content-free Brain pre-warm fired at MCP
 * shim startup so the Brain is already warm by the time the first question
 * arrives, instead of leaving every cold Render wake to silently degrade
 * /mos:act's Tier 3 race to the local heuristic (see
 * lib/mcp/brain-route-bound.cjs for the measured cold-wake numbers this
 * exists to cover).
 *
 * WHY THE TIMEOUT DOES NOT BOUND THE WAKE ITSELF: the request reaching
 * Render is what wakes the instance; aborting our own wait does not cancel
 * that in-flight wake on Render's side. The timeout here only bounds how
 * long THIS PROCESS holds the marker write open waiting for a verdict --
 * which is why 15000 ms is generous without costing anyone anything: even
 * if we give up waiting, the wake we triggered keeps running on Render and
 * the NEXT real call benefits from it.
 *
 * CANON PART 8 (D-02): the probe sends theo_health with NO ARGUMENTS
 * (`callTool('theo_health', {})`, the exact shape class-m-brain-smoke.cjs:225
 * already ships) and the marker persists ONLY {at, ok, origin_host} --
 * never a response body, never a header value, never a question. Every fs
 * and network failure is swallowed; this function NEVER throws and NEVER
 * rejects.
 *
 * MCP STDIO SAFETY: this file writes NOTHING to stdout, ever, because it
 * can run inside an MCP stdio process where a stray stdout byte corrupts
 * the JSON-RPC transport. A single stderr line only when MINDRIAN_DEBUG is
 * set.
 *
 * The deps seam ({ probe, originHost, now, homeDir, timeoutMs }, all
 * optional) mirrors the same injectable-probe discipline
 * lib/core/doctor/class-m-brain-smoke.cjs already uses for its own
 * theoHealthFn seam, so a test drives every arm through deps and never
 * touches a real Brain.
 *
 * No em-dashes. CJS only.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_PREWARM_TIMEOUT_MS = 15000;

const debugLog = (msg) => {
  if (!process.env.MINDRIAN_DEBUG) return;
  try {
    process.stderr.write('[brain-prewarm] ' + msg + '\n');
  } catch (_e) {
    // swallow -- this function must never throw
  }
};

/**
 * Derive the timeout (ms) for the probe race. Reads
 * MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS when it parses to a finite positive
 * integer; otherwise DEFAULT_PREWARM_TIMEOUT_MS.
 * @returns {number}
 */
function _resolveTimeoutMs() {
  const raw = process.env.MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS;
  if (typeof raw !== 'string' || raw.trim().length === 0) return DEFAULT_PREWARM_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return DEFAULT_PREWARM_TIMEOUT_MS;
  return parsed;
}

/**
 * Reduce a Brain origin URL to its host only (never the full URL, never a
 * path, never a query string -- the marker holds origin_host, not the URL).
 * @param {string} url
 * @returns {string|null}
 */
function _hostOnly(url) {
  if (typeof url !== 'string' || url.length === 0) return null;
  try {
    return new URL(url).host || null;
  } catch (_e) {
    return null;
  }
}

/**
 * markerPath(homeDir) -- the on-disk location of the pre-warm marker.
 * @param {string} [homeDir] defaults to MINDRIAN_HOME or ~/.mindrian
 * @returns {string}
 */
function markerPath(homeDir) {
  const home = homeDir || process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  return path.join(home, 'brain-prewarm.json');
}

/**
 * prewarm(deps) -- fires one content-free theo_health probe and persists a
 * minimal marker. NEVER throws, NEVER rejects, NEVER writes to stdout.
 *
 * @param {object} [deps]
 * @param {() => Promise<any>} [deps.probe] defaults to
 *   `() => require('./brain-client.cjs').callTool('theo_health', {})`,
 *   required LAZILY so importing this module costs nothing.
 * @param {string} [deps.originHost] defaults to the host of
 *   `require('./brain-client.cjs').getBrainUrl()`.
 * @param {() => Date} [deps.now] defaults to `() => new Date()`.
 * @param {string} [deps.homeDir] defaults to MINDRIAN_HOME or ~/.mindrian.
 * @param {number} [deps.timeoutMs] defaults to
 *   MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS or 15000.
 * @returns {Promise<{ at: string, ok: boolean, origin_host: string|null }>}
 */
async function prewarm(deps) {
  deps = deps || {};
  const probe = deps.probe || (() => require('./brain-client.cjs').callTool('theo_health', {}));
  const originHost = (typeof deps.originHost === 'string')
    ? deps.originHost
    : _hostOnly((() => {
        try {
          return require('./brain-client.cjs').getBrainUrl();
        } catch (_e) {
          return null;
        }
      })());
  const now = deps.now || (() => new Date());
  const homeDir = deps.homeDir;
  const timeoutMs = Number.isFinite(deps.timeoutMs) && deps.timeoutMs > 0 ? deps.timeoutMs : _resolveTimeoutMs();

  let ok = false;
  try {
    const TIMEOUT_SENTINEL = Symbol('brain-prewarm-timeout');
    const result = await Promise.race([
      Promise.resolve()
        .then(() => probe())
        .catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs)),
    ]);
    ok = !!(result && result !== TIMEOUT_SENTINEL && typeof result === 'object');
  } catch (_e) {
    ok = false;
  }

  // Canon Part 8 (D-02): EXACTLY three keys, nothing else. Never any part
  // of the probe response body, never a key, never a question.
  const marker = { at: now().toISOString(), ok: ok, origin_host: originHost || null };

  try {
    const filePath = markerPath(homeDir);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(marker), 'utf8');
    debugLog('marker written: ' + JSON.stringify(marker));
  } catch (e) {
    debugLog('marker write failed: ' + (e && e.message ? e.message : String(e)));
  }

  return marker;
}

// Directly spawnable: `node lib/core/brain-prewarm.cjs`.
if (require.main === module) {
  prewarm().catch(() => {});
}

module.exports = { prewarm, markerPath };
