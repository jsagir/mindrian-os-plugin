/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-04 Plan 04 Task 1 -- mva-vercel-deploy.
 *
 * Vercel REST API direct deploy of the MVA Feynman deck HTML. Per LD2
 * (Locked Decision 2 in 118-CONTEXT.md): NO `vercel` CLI dependency, NO
 * `@vercel/client` SDK. Direct fetch() calls.
 *
 * Public surface:
 *   deployDeck(html: string, sha8: string) -> Promise<DeployResult>
 *   FALLBACK_DIR: string (~/.mindrian/mva/briefs)
 *
 * DeployResult:
 *   On success:  { url: 'https://<subdomain>.vercel.app', deploy_duration_ms }
 *   On failure:  { error: <code>, fallback_path, deploy_duration_ms,
 *                  status?, error_short? }
 *
 * Failure codes:
 *   - 'vercel_unavailable'   -- no VERCEL_TOKEN configured
 *   - 'vercel_api_error'     -- API returned non-2xx (status field carries code)
 *   - 'vercel_exception'     -- fetch threw / AbortController fired
 *
 * On any failure: writes the HTML to FALLBACK_DIR/<sha8>.html as the
 * shareable receipt (the user still gets a deck, just locally).
 *
 * LD2 wire details:
 *   POST https://api.vercel.com/v13/deployments
 *   Authorization: Bearer <VERCEL_TOKEN>
 *   Content-Type: application/json
 *   Body: { name: 'mos-brief-<sha8>', files: [{ file: 'index.html',
 *           data: base64(html), encoding: 'base64' }],
 *           projectSettings: { framework: null }, target: 'production' }
 *
 * Timeout: 5 seconds via AbortController (the source spec's <3s budget plus
 * safety headroom; the overall MVA budget is 45s and this fits with ample
 * margin).
 *
 * Canon Part 8: the function sees ONLY `html` (already sanitized at build
 * time by mva-deck-builder) and `sha8` (a hash of a hash). No raw sentence
 * fields, no MVA_SENTENCE reads, no .sentence access. The Vercel request
 * body uses base64-encoded HTML in the request payload; the URL is the bare
 * endpoint. No user content in URLs or query strings.
 *
 * Pure CJS, node built-ins only (fs, path, os) plus the resolver module.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { resolveVercelKey } = require('./resolve-vercel-key.cjs');

const VERCEL_API_URL = 'https://api.vercel.com/v13/deployments';
const DEPLOY_TIMEOUT_MS = 5000;

function _homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

/** @type {string} Resolved at call-time so HOME overrides in tests work. */
const FALLBACK_DIR = path.join(_homeDir(), '.mindrian', 'mva', 'briefs');

function _fallbackDir() {
  return path.join(_homeDir(), '.mindrian', 'mva', 'briefs');
}

/**
 * Write the rendered HTML to the local fallback path so the user still has a
 * shareable artifact even when Vercel is unreachable / unconfigured.
 *
 * @param {string} html  the rendered deck HTML
 * @param {string} sha8  the 8-char hash identifier
 * @returns {string} absolute fallback path
 */
function _writeFallback(html, sha8) {
  const dir = _fallbackDir();
  fs.mkdirSync(dir, { recursive: true });
  const fallbackPath = path.join(dir, sha8 + '.html');
  fs.writeFileSync(fallbackPath, html, 'utf8');
  return fallbackPath;
}

/**
 * deployDeck -- the one-shot Vercel deploy with local fallback.
 *
 * Best-effort by design: the rendered terminal brief is already in the user's
 * scrollback by the time we're called; a deploy failure is a degraded reward
 * (local file instead of public URL), not a fatal error.
 *
 * @param {string} html  full HTML document; will be base64-encoded for transit
 * @param {string} sha8  8-char hash identifier (first 8 chars of sentence_sha256)
 * @returns {Promise<{
 *   url?: string,
 *   error?: 'vercel_unavailable' | 'vercel_api_error' | 'vercel_exception',
 *   status?: number,
 *   error_short?: string,
 *   fallback_path?: string,
 *   deploy_duration_ms: number
 * }>}
 */
async function deployDeck(html, sha8) {
  const t0 = Date.now();
  const key = resolveVercelKey();
  if (!key) {
    const fallback_path = _writeFallback(html, sha8);
    return {
      error: 'vercel_unavailable',
      fallback_path,
      deploy_duration_ms: Date.now() - t0,
    };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DEPLOY_TIMEOUT_MS);

  try {
    const response = await fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
      },
      body: JSON.stringify({
        name: 'mos-brief-' + sha8,
        files: [{
          file: 'index.html',
          data: Buffer.from(html, 'utf8').toString('base64'),
          encoding: 'base64',
        }],
        projectSettings: { framework: null },
        target: 'production',
      }),
      signal: ctl.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const fallback_path = _writeFallback(html, sha8);
      return {
        error: 'vercel_api_error',
        status: response.status,
        fallback_path,
        deploy_duration_ms: Date.now() - t0,
      };
    }

    const data = await response.json();
    return {
      url: 'https://' + data.url,
      deploy_duration_ms: Date.now() - t0,
    };
  } catch (e) {
    clearTimeout(timer);
    const fallback_path = _writeFallback(html, sha8);
    return {
      error: 'vercel_exception',
      error_short: String((e && e.message) || e).slice(0, 60),
      fallback_path,
      deploy_duration_ms: Date.now() - t0,
    };
  }
}

module.exports = {
  deployDeck,
  FALLBACK_DIR,
};
