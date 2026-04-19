'use strict';

/**
 * bearer-token.cjs -- In-memory Bearer token + CSRF token session store for
 * the live dashboard's BYO-API chat panel (Phase 87-09).
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Purpose
 *   Browser POSTs its Anthropic api_key to /api/auth/session ONCE. Server
 *   generates a 64-hex Bearer token + 32-hex CSRF token, binds both to the
 *   request's Origin, holds the api_key in memory keyed by the token for a
 *   30-minute TTL, returns {token, expires_in, csrf_token} to the browser,
 *   and sets a Set-Cookie: mos_csrf=<csrf> for the OWASP double-submit
 *   cookie pattern. Subsequent /api/room/chat calls send
 *   `Authorization: Bearer <token>` + `X-CSRF-Token: <csrf>` (echoed from
 *   the mos_csrf cookie). The api_key NEVER flows through a request body
 *   after auth.
 *
 * Security model (R-87-09-CSRF):
 *   Gap 3 -- tokens are bound to their creating Origin. lookupToken(token,
 *   origin) returns the api_key only if record.origin === origin.
 *   Gap 6 -- every Bearer token has an associated csrfToken that the caller
 *   (serve-dashboard-live) compares against both the mos_csrf cookie AND the
 *   X-CSRF-Token header.
 *   The api_key is never logged, never written to disk, and is cleared on
 *   server shutdown via clearAll().
 *
 * Dependencies
 *   Node built-in `crypto` only. Zero new runtime deps.
 */

const crypto = require('node:crypto');

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Internal token registry.
 * Map<tokenHex, { apiKey, origin, csrfToken, expiresAt }>
 */
const tokens = new Map();

let sweepTimer = null;

/**
 * Create a new Bearer + CSRF token pair bound to the calling Origin.
 * Returns { token, expiresIn, csrfToken }; does NOT log the api_key.
 * @param {string} apiKey Anthropic api_key string (sk-...).
 * @param {string} origin The request's Origin header value at creation time.
 *   Stored verbatim; lookupToken() later compares strict-equal.
 * @param {number} [ttlMs=DEFAULT_TTL_MS]
 * @returns {{token:string, expiresIn:number, csrfToken:string}}
 */
function createToken(apiKey, origin, ttlMs = DEFAULT_TTL_MS) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('createToken: apiKey must be a non-empty string');
  }
  if (typeof origin !== 'string') {
    throw new Error('createToken: origin must be a string');
  }
  const token = crypto.randomBytes(32).toString('hex');      // 64 hex chars
  const csrfToken = crypto.randomBytes(16).toString('hex');  // 32 hex chars
  tokens.set(token, {
    apiKey,
    origin,
    csrfToken,
    expiresAt: Date.now() + ttlMs,
  });
  return { token, expiresIn: Math.floor(ttlMs / 1000), csrfToken };
}

/**
 * Look up the api_key bound to a token, enforcing Origin binding.
 * Returns the api_key only if the token exists, is unexpired, AND the
 * requestOrigin matches the origin recorded at creation time
 * (R-87-09-CSRF gap 3). Returns null otherwise. Expired entries are
 * purged as a side effect.
 * @param {string} token
 * @param {string} requestOrigin
 * @returns {string|null}
 */
function lookupToken(token, requestOrigin) {
  if (!token || typeof token !== 'string') return null;
  const entry = tokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    tokens.delete(token);
    return null;
  }
  if (entry.origin !== requestOrigin) {
    // R-87-09-CSRF gap 3: a token created for Origin A must not work from
    // Origin B, even if both origins are in the server's allowlist.
    return null;
  }
  return entry.apiKey;
}

/**
 * Return the CSRF token bound to this Bearer token, for server-side
 * double-submit verification (R-87-09-CSRF gap 6). Returns null if the
 * token is unknown or expired.
 * @param {string} token
 * @returns {string|null}
 */
function lookupCsrfForToken(token) {
  if (!token || typeof token !== 'string') return null;
  const entry = tokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    tokens.delete(token);
    return null;
  }
  return entry.csrfToken;
}

/**
 * Explicitly revoke a token (e.g. on user logout). Returns true if the
 * entry existed, false otherwise.
 * @param {string} token
 * @returns {boolean}
 */
function revokeToken(token) {
  return tokens.delete(token);
}

/**
 * Iterate the registry and delete every entry whose expiresAt <= now.
 * Returns the number of entries removed.
 * @returns {number}
 */
function sweepExpired() {
  const now = Date.now();
  let removed = 0;
  for (const [t, entry] of tokens.entries()) {
    if (entry.expiresAt <= now) {
      tokens.delete(t);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Start a background interval timer that calls sweepExpired() every
 * `intervalMs` milliseconds (default 60s). The timer is `unref()`ed so it
 * never keeps the process alive on its own. Idempotent: a second call
 * returns the existing handle.
 * @param {number} [intervalMs=60000]
 * @returns {NodeJS.Timeout}
 */
function startSweepInterval(intervalMs = 60000) {
  if (sweepTimer) return sweepTimer;
  sweepTimer = setInterval(sweepExpired, intervalMs);
  if (sweepTimer && typeof sweepTimer.unref === 'function') sweepTimer.unref();
  return sweepTimer;
}

/**
 * Stop the background sweep timer. Safe to call when none is running.
 */
function stopSweepInterval() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

/**
 * Nuke every token entry and stop the sweep timer. Called on SIGINT /
 * SIGTERM by serve-dashboard-live so no api_key survives a restart.
 */
function clearAll() {
  tokens.clear();
  stopSweepInterval();
}

/**
 * Test-only introspection hook. Returns the current number of live
 * entries. NOT part of the public contract; do not rely on it from
 * production code paths.
 * @returns {number}
 */
function _size() {
  return tokens.size;
}

module.exports = {
  createToken,
  lookupToken,
  lookupCsrfForToken,
  revokeToken,
  sweepExpired,
  startSweepInterval,
  stopSweepInterval,
  clearAll,
  _size,
  DEFAULT_TTL_MS,
};
