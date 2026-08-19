'use strict';

/**
 * Brain HTTP Client -- calls the Brain HTTP server. Default is
 * `https://pws-brain-mcp.onrender.com` (Memgraph-backed, step 4 of the
 * 2026-07-22 Memgraph migration); override via the MINDRIAN_BRAIN_URL env
 * var for staging / self-hosted.
 *
 * Replaces direct MCP tool calls (mcp__neo4j-brain__*, mcp__pinecone-brain__*)
 * with a single HTTP API that handles Neo4j + Pinecone behind one key.
 *
 * Falls back gracefully:
 *   1. If MINDRIAN_BRAIN_KEY is set → calls Brain API
 *   2. If Brain API returns Pinecone quota error → retries with Neo4j-only
 *   3. If no key → returns null (Tier 0, no Brain)
 *
 * Usage in commands/skills:
 *   const brain = require('./brain-client.cjs');
 *   const result = await brain.query('MATCH (f:Framework) RETURN f.name LIMIT 5');
 *   const result = await brain.search('innovation framework');
 *   const schema = await brain.schema();
 */

const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://pws-brain-mcp.onrender.com';

// Per-request hard timeout for every Brain HTTP call (init handshake + tool
// calls). Node's global fetch() has NO default timeout, so without this a
// slow/wedged Brain hangs the calling /mos: command indefinitely. The Render
// service answers in ~1-2s normally; 20s is a generous-but-bounded ceiling.
// Override via MINDRIAN_BRAIN_TIMEOUT_MS (brain-router wants ~2000 for Tier 3).
const BRAIN_REQUEST_TIMEOUT_MS = Number(process.env.MINDRIAN_BRAIN_TIMEOUT_MS) || 20000;

// Phase 250-01 (AVAIL-02, navigator ruling 2026-08-10): bounded transport
// retry budget around the single HTTP dispatch seam every Brain tool flows
// through (callTool()'s tools/call POST below). Retries ONLY transport-class
// outcomes -- network errors and 5xx responses -- BEFORE a blip ever becomes
// an unreachable refusal. NEVER retries 401/403 (validation-class, mapped to
// their own sentinels) or any other status; those are zero-retry by design
// (retrying an auth failure hammers auth, taxonomy-wrong per the data4sci
// four-class error taxonomy). Defensive numeric-env convention (repo-wide,
// e.g. BRAIN_REQUEST_TIMEOUT_MS above): an invalid override falls back to
// the default rather than throwing or disabling the feature silently.
const RETRY_MAX_DEFAULT = 2; // 2 retries = 3 attempts total.
const RETRY_BASE_MS_DEFAULT = 300; // 300ms, then 900ms (base * 3^attempt).

function _envNonNegativeInt(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  return (Number.isFinite(n) && n >= 0) ? Math.floor(n) : def;
}

function _retryMax() {
  return _envNonNegativeInt('MINDRIAN_BRAIN_RETRY_MAX', RETRY_MAX_DEFAULT);
}

function _retryBaseMs() {
  return _envNonNegativeInt('MINDRIAN_BRAIN_RETRY_BASE_MS', RETRY_BASE_MS_DEFAULT);
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Phase 87-07 (CASCADE-06): Brain session cache with 5-minute TTL.
// Every callTool() previously re-ran the `initialize` handshake (~1 network
// round-trip). With a long-lived MCP server this is wasted work -- sessions
// live longer than the ~60s transport timeout. Cache the initialized
// sessionId (keyed by api-key-hash) for 5 minutes.
//
// R-87-07-RACE (audit): two concurrent callTool() invocations with the same
// api_key previously both saw a cache miss, both initialized, and the second
// overwrote the first -- one of the two initialize handshakes was wasted.
// Fix: cache the init *Promise*, not the resolved session. The first caller
// stores { promise: initSession(apiKey), expiresAt }; concurrent callers
// within the TTL `await entry.promise`. On rejection we remove the entry so
// the next caller re-initializes fresh.
//
// Hash: sha256 truncated to 16 hex chars (64 bits of key space, zero realistic
// collision). A cheaper non-crypto hash was considered but its narrower int
// space has non-zero collision probability once the design extends across
// users; sha256 is effectively free at these volumes and eliminates the
// concern entirely (R-87-07-RACE).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
// Phase 123 Plan-07: getApiKey() delegates to the single Brain-key resolver.
// The legacy inline 3-path lookup (env -> CWD .env -> ~/.mindrian.env) is gone;
// the resolver does env -> ~/.mindrian.env -> CWD .env (D-31 order) + SEC-02
// POSIX permission check + explicit reason strings. See HARNESS-123-15.
const { resolveBrainKey } = require('./resolve-brain-key.cjs');
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
/** @type {Map<string, {promise: Promise<string>, expiresAt: number}>} */
const sessionCache = new Map();

function _hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 16);
}

/**
 * SEC-01: Sanitize any user-origin string before interpolation into a
 * Cypher query. Whitelist from 87-CONTEXT.md lines 121-127:
 *   [a-zA-Z0-9 ._-]
 * Every other char (including `"`, `'`, backtick, newline, `{`, `}`, `$`,
 * `\`, `;`, `/`, `*`) is stripped. Null/undefined return ''. Non-strings
 * are coerced via String() defensively so the caller never crashes.
 *
 * This replaces the legacy single-quote-escape pattern that only
 * escaped one metacharacter (double-quote) and was trivially bypassable
 * via backticks, newlines, `${...}` expansions, or Cypher comments.
 *
 * @param {*} value
 * @returns {string}
 */
function sanitizeCypherInput(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    try { value = String(value); } catch (_e) { return ''; }
  }
  return value.replace(/[^a-zA-Z0-9 ._-]/g, '');
}

/**
 * SEC-02: Refuse to load a Brain API key from a .env file whose permissions
 * expose it to group or world readers. Unix semantics only -- on Windows
 * POSIX mode bits are not meaningful for NTFS ACLs, so we return true and
 * warn once per process.
 *
 *   mode & 0o077 !== 0  =>  any group/world bit is set  =>  reject
 *   mode 0o600 (-rw-------) and 0o400 (-r--------) pass; 0o644, 0o664 fail.
 *
 * On stat failure we return false (no key beats a key we cannot verify).
 *
 * @param {string} envPath
 * @returns {boolean}
 */
function checkFilePermissions(envPath) {
  try {
    const fs = require('fs');
    if (process.platform === 'win32') {
      if (!checkFilePermissions._warned) {
        process.stderr.write(
          '[mindrian-os] Note: API key file permission check is Linux/macOS only; '
          + 'on Windows rely on NTFS ACLs.\n'
        );
        checkFilePermissions._warned = true;
      }
      return true;
    }
    const stat = fs.statSync(envPath);
    if ((stat.mode & 0o077) !== 0) {
      process.stderr.write(
        `[mindrian-os] Refusing to load API key from ${envPath}: `
        + `permissions too open (must be 0600). chmod 600 ${envPath}\n`
      );
      return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
}
checkFilePermissions._warned = false;

// Phase 123 Plan-07: getApiKey() delegates to lib/core/resolve-brain-key.cjs.
//
// Order: MINDRIAN_BRAIN_KEY env -> ~/.mindrian.env -> CWD .env -> not-found.
// NOTE: this REVERSES the previous CWD-first-then-~/.mindrian.env order.
// Rationale: the global backup (~/.mindrian.env, mode 0600 per SEC-02) is more
// trustworthy than a project's potentially-stale .env file. Cited: Phase 123
// D-31. The resolver returns { key, source, available, reason }; we surface
// the key (or null) here and log a non-null reason ONCE per process via
// console.error -- SEC-02 group/world-bit rejection routes through this
// channel, never as a silent null.
//
// The legacy inline 3-path lookup and the per-file checkFilePermissions gate
// previously inlined here are gone -- the resolver owns both responsibilities
// now. checkFilePermissions remains exported on _test for backward-compat
// with security-trifecta.test.cjs (the helper itself still works locally;
// it's just not called by getApiKey anymore).
let _memoizedKey = null;
let _memoizedAt = 0;
let _reasonLoggedThisProcess = false;
const _GETKEY_MEMO_MS = 60 * 1000;
function getApiKey() {
  if (_memoizedAt && (Date.now() - _memoizedAt) < _GETKEY_MEMO_MS) {
    return _memoizedKey;
  }
  const r = resolveBrainKey();
  if (r && r.available) {
    _memoizedKey = r.key;
    _memoizedAt = Date.now();
    return _memoizedKey;
  }
  if (r && r.reason && !_reasonLoggedThisProcess) {
    // SEC-02 reject + not-found-with-reason both route through stderr ONCE
    // per process -- never a silent null. The session-start status line is
    // the user-visible surface; this is the in-process diagnostic.
    process.stderr.write('[mindrian-os] Brain key not loaded: ' + r.reason + '\n');
    _reasonLoggedThisProcess = true;
  }
  _memoizedKey = null;
  _memoizedAt = Date.now();
  return null;
}

/**
 * Check if Brain is available (key exists).
 */
function isAvailable() {
  return !!getApiKey();
}

// ---------------------------------------------------------------------------
// Phase 250-04 (HONEST-03, SEED-011 Option A) -- per-install silent
// registration. Design doc: docs/BRAIN-IDENTITY-DESIGN.md.
//
// The ladder's fourth leg (resolve-brain-key.cjs, read-only) resolves an
// existing cached install token; THIS module owns the minting side. When the
// ladder resolves nothing at the first Brain consult, mint a fresh UUID,
// POST it to the Brain's /register endpoint, cache the returned token at
// mode 0600, and let the SAME process's next getApiKey() call pick it up.
//
// Once-per-process cap: exactly ONE registration attempt per process,
// success or failure. A failed attempt is the failure edge (registration
// failed / Brain offline) -- it is NEVER retried within the process (the
// AVAIL-02 bounded-retry budget explicitly does not apply here; a fresh
// process retries fresh on its own next launch). NEVER thrown into the
// caller; NEVER blocks a non-methodology path (this only runs from the
// Brain-consult chokepoint below, never from session-start or a hot path).
let _autoRegisterAttemptedThisProcess = false;
let _autoRegisterFailureReason = null;

function _installTokenPath(home) {
  const h = home || process.env.HOME || process.env.USERPROFILE || require('node:os').homedir();
  return path.join(h, '.mindrian-install.json');
}

/**
 * Attempt the one-shot silent registration. Returns the minted key string on
 * success, or null (opt-out, already-attempted, or any failure). On success,
 * updates the module's own memoized key so the CALLER's next getApiKey()
 * returns it immediately (no redundant resolver re-read needed, though a
 * fresh resolveBrainKey() call would ALSO see the cache file now).
 *
 * @returns {Promise<string|null>}
 */
async function _tryAutoRegister() {
  if (_autoRegisterAttemptedThisProcess) return null;
  _autoRegisterAttemptedThisProcess = true;

  if (process.env.MINDRIAN_DISABLE_AUTO_REGISTER) {
    _autoRegisterFailureReason = 'auto-registration disabled (MINDRIAN_DISABLE_AUTO_REGISTER set)';
    return null;
  }

  try {
    const installId = crypto.randomUUID();
    const res = await fetch(`${BRAIN_URL}/register`, {
      method: 'POST',
      signal: AbortSignal.timeout(BRAIN_REQUEST_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json' },
      // Part 8 posture (T-250-13): install_id ONLY ever crosses in this body.
      body: JSON.stringify({ install_id: installId }),
    });
    if (!res.ok) {
      try { await res.arrayBuffer(); } catch (_e) { /* drain, see _ensureSession's precedent */ }
      _autoRegisterFailureReason = 'registration failed (HTTP ' + res.status + ', offline or unreachable)';
      return null;
    }
    const body = await res.json();
    if (!body || typeof body.token !== 'string' || body.token.length === 0) {
      _autoRegisterFailureReason = 'registration returned a malformed response (offline or unreachable)';
      return null;
    }

    const cachePath = _installTokenPath();
    const payload = { install_id: installId, token: body.token, minted_at: new Date().toISOString() };
    fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2) + '\n', { mode: 0o600 });
    // writeFileSync's mode option only applies on file CREATION; force it
    // explicitly so a pre-existing looser-permission file is corrected too
    // (SEC-02 posture, mirrors resolve-brain-key.cjs's own gate on this file).
    try { fs.chmodSync(cachePath, 0o600); } catch (_e) { /* best-effort on platforms without chmod semantics */ }

    _memoizedKey = body.token;
    _memoizedAt = Date.now();
    return body.token;
  } catch (e) {
    _autoRegisterFailureReason = 'registration failed: ' + (e && e.message || String(e)) + ' (offline or unreachable)';
    return null;
  }
}

/**
 * Async-aware availability gate: the "first Brain consult" seam every
 * MCP-surface entry point passes through before dispatching a tool
 * (bin/mindrian-brain-mcp-client.cjs's per-tool gates use this INSTEAD of
 * the synchronous isAvailable(), so silent registration actually fires on
 * that path -- isAvailable() alone cannot attempt an async network mint).
 * Direct brain-client consumers (query/ask/schema/... via callTool) do not
 * need to call this explicitly -- callTool() below performs the identical
 * fallback internally, so BOTH surfaces share the SAME once-per-process cap.
 *
 * @returns {Promise<boolean>}
 */
async function ensureAvailable() {
  if (isAvailable()) return true;
  await _tryAutoRegister();
  return isAvailable();
}

/**
 * The honest reason the last auto-registration attempt failed (or the
 * opt-out reason), or null if no attempt has failed this process (either
 * none was attempted yet, or the last attempt succeeded). Consumed by the
 * no_key failure-edge refusal copy (refusal-messaging.cjs) so the reason names
 * "registration" / "offline" rather than a generic "no key" framing.
 *
 * @returns {string|null}
 */
function getAutoRegisterFailureReason() {
  return _autoRegisterFailureReason;
}

/**
 * Phase 87-07: ensure we have a valid initialized Brain session for the given
 * api key, reusing the cached one if non-expired. Uses the pending-promise
 * pattern so concurrent callers share a single in-flight init (R-87-07-RACE).
 *
 * Returns the resolved session marker (an opaque string -- the Brain Streamable
 * HTTP transport does not require us to echo a sessionId on subsequent requests
 * inside the same cache window, but awaiting this promise proves the key is
 * valid against the Brain endpoint exactly once per TTL window).
 *
 * On any init rejection (network error, 401, etc.) the cache entry is removed
 * in the .catch() tail so the next caller retries fresh rather than inheriting
 * a poisoned promise.
 *
 * Sentinel `{ error: 'invalid_key' }` is returned *through* the promise (not
 * thrown) so callers treat 401 identically to the pre-cache flow.
 *
 * @param {string} apiKey
 * @returns {Promise<string|{error:string,message:string}|null>}
 */
async function _ensureSession(apiKey) {
  const keyHash = _hashKey(apiKey);
  const cached = sessionCache.get(keyHash);
  if (cached && cached.expiresAt > Date.now()) {
    // Cache hit. Works whether the promise is still pending (concurrent init
    // in flight) or already resolved (TTL reuse). Awaiting a resolved promise
    // is a microtask no-op, so the fast path stays fast.
    return cached.promise;
  }
  // Cache miss. Build the promise FIRST, install it in the cache BEFORE the
  // first real await, so concurrent callers within the same event-loop tick
  // see the same in-flight promise (R-87-07-RACE pending-promise pattern).
  const promise = (async () => {
    const initRes = await fetch(`${BRAIN_URL}/mcp`, {
      method: 'POST',
      signal: AbortSignal.timeout(BRAIN_REQUEST_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'mindrian-cli', version: '1.0.0' },
        },
      }),
    });
    if (!initRes.ok) {
      // Debug session doctor-brain-smoke-win-crash (2026-05-30): drain the
      // response body on the non-OK path. Node global fetch (undici) keeps the
      // underlying TLS socket in a keep-alive, not-yet-released state until its
      // body is consumed. An un-drained socket is a live libuv handle at exit;
      // a synchronous process.exit() in a caller tears it down mid-close and
      // asserts on Windows (src/win/async.c UV_HANDLE_CLOSING). Consuming the
      // body lets undici release/recycle the socket cleanly. Cross-platform.
      try { await initRes.arrayBuffer(); } catch (_) { /* body already gone */ }
      if (initRes.status === 401) {
        return { error: 'invalid_key', message: 'Brain API key is invalid.' };
      }
      // Any other non-OK status becomes a throw so the cache entry is purged
      // by the .catch() below and the next caller retries.
      throw new Error(`Brain init HTTP ${initRes.status}`);
    }
    // Opaque session marker. Subsequent tools/call requests don't need to
    // echo this back -- the transport is stateless at the HTTP level. What
    // matters is that we validated the key is live within this TTL window.
    return 'validated-' + Date.now();
  })();
  sessionCache.set(keyHash, { promise, expiresAt: Date.now() + SESSION_TTL_MS });
  // On reject, purge the entry so the next caller initializes fresh. Swallow
  // here (we re-throw in the awaiter below) so Node doesn't see an
  // unhandledRejection on the cache handle itself.
  promise.catch(() => { sessionCache.delete(keyHash); });
  return promise;
}

/**
 * Call a Brain MCP tool via HTTP.
 * @param {string} toolName - e.g., 'brain_query', 'brain_search', 'brain_schema'
 * @param {object} args - tool arguments
 * @returns {object|null} - result or null if unavailable
 */
async function callTool(toolName, args) {
  let key = getApiKey();
  if (!key) {
    // Phase 250-04: the ladder resolved nothing -- this IS the first Brain
    // consult. Attempt the one-shot silent registration before giving up;
    // shares the same _autoRegisterAttemptedThisProcess cap as
    // ensureAvailable() (the shim's gate), so whichever surface consults
    // first performs the real network attempt and the other reuses it.
    key = await _tryAutoRegister();
  }
  if (!key) return null;

  try {
    // Phase 87-07: reuse cached Brain session (5-min TTL) instead of
    // re-running initialize on every callTool. Concurrent callers share
    // the in-flight promise via the pending-promise pattern.
    const session = await _ensureSession(key);
    if (session && typeof session === 'object' && session.error === 'invalid_key') {
      return session;
    }
    if (!session) return null;

    // Phase 250-01 (AVAIL-02): bounded retry loop around the tools/call
    // dispatch -- the single HTTP seam every Brain tool flows through after
    // session establishment. NULL CONTRACT PRESERVED: the retry changes WHEN
    // null returns (after the budget instead of after one attempt), never
    // WHAT returns null, and never which statuses map to which sentinels
    // (247-02 do-not-widen note; 82 degradation tests key on this).
    const retryMax = _retryMax();
    const baseMs = _retryBaseMs();
    for (let attempt = 0; ; attempt += 1) {
      let toolRes;
      try {
        toolRes = await fetch(`${BRAIN_URL}/mcp`, {
          method: 'POST',
          signal: AbortSignal.timeout(BRAIN_REQUEST_TIMEOUT_MS),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: toolName, arguments: args },
          }),
        });
      } catch (fetchErr) {
        // Network error / timeout at the tools/call seam -- transport-class,
        // retryable. Every other thrown error (outside this inner try) still
        // falls through to the outer catch below, unchanged.
        if (attempt < retryMax) {
          await _sleep(baseMs * Math.pow(3, attempt));
          continue;
        }
        return null;
      }

      if (!toolRes.ok) {
        // Phase 247-02 (CONTRACT-01 error semantics): HTTP 403 means the Brain's
        // tier gate refused this tool on this key (a MoatViolation), NOT that the
        // Brain is unreachable. Mirrors the invalid_key sentinel precedent in
        // _ensureSession above -- a plain object returned through the promise,
        // never thrown, so callers that already understand sentinel passthrough
        // (query()'s {error:...} passthrough is the existing example) keep
        // working unchanged. 401/403 are validation-class -- ZERO retry, ever
        // (AVAIL-02: retrying an auth failure hammers auth, taxonomy-wrong).
        if (toolRes.status === 403) {
          let rawText = '';
          try { rawText = await toolRes.text(); } catch (_e) { rawText = ''; }
          let message = null;
          try {
            const parsedBody = JSON.parse(rawText);
            if (parsedBody && parsedBody.error && typeof parsedBody.error.message === 'string') {
              message = parsedBody.error.message;
            }
          } catch (_e) {
            // Unparseable body -- fall through to the raw-text fallback below.
          }
          if (!message) {
            message = rawText
              ? rawText.slice(0, 300)
              : 'Brain denied tier access (403, no body).';
          }
          return { error: 'tier_denied', tool: toolName, message: message };
        }
        // Drain the body before bailing so undici releases the keep-alive socket
        // (see _ensureSession non-OK note: an un-drained socket is a live libuv
        // handle that asserts on Windows when a caller force-exits).
        try { await toolRes.arrayBuffer(); } catch (_) { /* body already gone */ }
        // 5xx is transport-class (transient) -- retryable within budget.
        // Every OTHER non-OK, non-retried status still returns null -- that
        // remains the sole transport-failure signal (research Pitfall 4: 82
        // degradation tests key on it; do not widen this branch).
        if (toolRes.status >= 500 && toolRes.status < 600 && attempt < retryMax) {
          await _sleep(baseMs * Math.pow(3, attempt));
          continue;
        }
        return null;
      }

      const text = await toolRes.text();
      // Parse SSE response
      const dataLine = text.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) return null;

      const parsed = JSON.parse(dataLine.slice(6));
      if (parsed.result && parsed.result.content) {
        const textContent = parsed.result.content.find(c => c.type === 'text');
        if (textContent) {
          try {
            return JSON.parse(textContent.text);
          } catch (e) {
            return { text: textContent.text };
          }
        }
      }
      return parsed.result || null;
    }
  } catch (err) {
    // Network error, timeout, etc. (outside the retry loop -- e.g. during
    // _ensureSession).
    return null;
  }
}

/**
 * Query Neo4j via Brain (Cypher query).
 * This does NOT use Pinecone, no embedding quota consumed.
 *
 * NOTE (Finding I, v1.10.9 hotfix 2026-04-15): the Brain MCP brain_query
 * tool expects the parameter name `cypher`, not `query`. Previously this
 * function sent { query: cypher } which tripped an MCP input validation
 * error (code -32602, path ["cypher"], "Required"). Downstream scripts
 * like fetch-brain-baseline.cjs and compute-whitespace-gaps.py then
 * silently fell through to empty-baseline mode even though Brain was
 * fully reachable and the key was valid. Witnessed against the live
 * iia-deeptech-centers room on 2026-04-15. brain_search uses `query`
 * which is why Pinecone semantic search kept working and masked this.
 *
 * NOTE (2026-05-11, graph-on-graph P0): `query` now accepts an optional
 * second argument `params` and forwards it to the `brain_query` MCP tool
 * as { cypher, params }. The Brain tool declares `params:
 * z.record(z.any()).optional()`, so a parameterized Cypher gets its
 * bindings through cleanly. `params` MUST be a generic-handles-only object
 * -- framework names, phase identifiers, problem types per Canon Part 8 --
 * NEVER user content (artifact bodies, meeting text, personal identifiers,
 * proprietary numbers). Previously the second arg was silently dropped, so
 * callers (rs-explain-command.cjs, rs-thesis-command.cjs, rs-nl-to-query)
 * that generated parameterized Cypher had their bindings disappear or were
 * pushed toward unsafe string interpolation. A param-less call still sends
 * only { cypher } and behaves exactly as before.
 *
 * NOTE (2026-05-11, graph-on-graph P0 cont.): RESULT-SHAPE NORMALIZATION.
 * The Brain MCP `brain_query` tool serializes its result as
 * `JSON.stringify(records)` where `records` is a BARE ARRAY of row objects.
 * `callTool` returns that array directly (or `{ text: 'Error: ...' }` on a
 * Cypher error, or `null` when the Brain is unreachable / no API key).
 * Consumers across the codebase -- brain-router.cjs, brain-derivation.cjs's
 * `renderRecords`, rs-chain-feeder.cjs, rs-experts-command.cjs,
 * rs-explain-command.cjs, rs-thesis-command.cjs -- all read `result.records`,
 * so the bare-array shape silently dropped every row. `query` therefore now
 * ALWAYS returns `{ records: [...] }` on a successful brain_query; an
 * unreachable Brain / missing key still returns `null`; a Cypher-error
 * response (`{ text: 'Error: ...' }` or `{ error: ... }`) passes through
 * unchanged so callers that inspect the failure can still see it; any other
 * unexpected shape collapses to `{ records: [] }` so callers never crash.
 * `search`, `smartSearch`, `schema`, `stats`, `write`, `callTool` are
 * deliberately untouched -- only `query` is normalized.
 */
async function query(cypher, params) {
  // Part 8 BACKSTOP (Phase 239 / BRAIN-02). This is a BACKSTOP ONLY and is
  // PROVABLY INSUFFICIENT ALONE: MEASURED, the template's own vocabulary word
  // "Framework" satisfies the classifier's positive methodology recognizer
  // and launders an embedded canary from ambiguous to allow -- classifying
  // the payload {cypher:"CANARY7F3A2B"} on its own yields verdict ambiguous,
  // but classifying {cypher:'MATCH (f:Framework) WHERE x="CANARY7F3A2B"'}
  // yields verdict allow. The REAL coverage is the raw-field guard added in
  // hatAwareRecommend and suggestValidationSteps (classify-before-sanitize,
  // classify-before-interpolate). Anyone tempted to delete those raw-field
  // guards because "query() already checks" must read this comment first:
  // it does not.
  // An 'ambiguous' verdict on an assembled template is EXPECTED policy here
  // (every legitimate methodology query looks ambiguous at this tier) and is
  // deliberately NOT blocked; only a proven 'block' (a CONTENT-SET hit) stops
  // the call.
  try {
    const queryEgressGuard = require('./part8-egress-guard.cjs');
    const queryEgressVerdict = queryEgressGuard.classify(
      { cypher: String(cypher || '') },
      { toolName: 'brain_query' }
    );
    if (queryEgressVerdict && queryEgressVerdict.verdict === 'block') {
      _logEventBestEffort(undefined, 'brain_egress_blocked', {
        egress_class: queryEgressVerdict.class || 'content_set',
        verdict: 'block',
        count: 1,
        created_by: 'system',
        source_path: 'system:brain-query',
      });
      return null;
    }
  } catch (_e) {
    // Belt-internal error (guard module missing/throws): degrade to existing
    // behavior. This backstop is a belt, not the primary control.
  }

  const args = { cypher: cypher };
  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    args.params = params;
  }
  const result = await callTool('brain_query', args);
  if (result == null) return null;                              // unreachable / no API key
  if (Array.isArray(result)) return { records: result };        // the normal brain_query shape
  if (result && Array.isArray(result.records)) return result;   // already normalized (defensive)
  if (result && (result.error || result.text)) return result;   // error / message passthrough
  return { records: [] };                                       // unexpected shape -> empty, never crash
}

/**
 * Search Pinecone via Brain (semantic search).
 * If quota exhausted, returns error with fallback suggestion.
 */
async function search(queryText, options = {}) {
  const result = await callTool('brain_search', {
    query: queryText,
    namespace: options.namespace || undefined,
    topK: options.topK || 5,
  });

  // Check for Pinecone quota exhaustion
  if (result && result.text && result.text.includes('RESOURCE_EXHAUSTED')) {
    return {
      error: 'pinecone_quota_exhausted',
      message: 'Pinecone embedding quota exhausted for this month. Using Neo4j Cypher fallback.',
      fallback: 'neo4j',
    };
  }

  return result;
}

/**
 * Search with automatic fallback: Pinecone first, Neo4j Cypher if quota exhausted.
 */
async function smartSearch(queryText, options = {}) {
  // Try Pinecone first
  const pineconeResult = await search(queryText, options);

  if (pineconeResult && pineconeResult.error === 'pinecone_quota_exhausted') {
    // Fallback to Neo4j full-text search
    const cypher = `
      CALL db.index.fulltext.queryNodes("framework_search", $query)
      YIELD node, score
      RETURN node.name AS name, node.description AS description, score
      LIMIT ${options.topK || 5}
    `;
    const neo4jResult = await query(cypher.replace('$query', `"${sanitizeCypherInput(queryText)}"`));
    if (neo4jResult) {
      neo4jResult._source = 'neo4j_fallback';
      neo4jResult._note = 'Pinecone quota exhausted. Results from Neo4j Cypher fulltext search.';
    }
    return neo4jResult;
  }

  return pineconeResult;
}

// brain_schema is near-static (the teaching graph's label/relationship/property
// taxonomy changes ~never) and is hit by several modules. Memoize it
// process-wide for 30 minutes.
let _schemaCache = null;
let _schemaCacheAt = 0;
const SCHEMA_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Get the Brain Neo4j schema (node labels, relationship types, property keys).
 * Memoized for 30 minutes (process-wide).
 */
async function schema() {
  if (_schemaCache && (Date.now() - _schemaCacheAt) < SCHEMA_CACHE_TTL_MS) {
    return _schemaCache;
  }
  const result = await callTool('brain_schema', {});
  // Phase 247-02 audit fix (Rule 1): a sentinel object (tier_denied /
  // invalid_key -- anything carrying .error) is NOT valid schema data. Caching
  // it would serve a stale denial for up to 30 minutes even after the Brain
  // recovers or the key is fixed. Only cache a genuine, error-free result.
  if (result != null && !(typeof result === 'object' && result.error)) {
    _schemaCache = result;
    _schemaCacheAt = Date.now();
  }
  return result;
}

/**
 * Natural-language methodology question against the Brain (wraps brain_ask).
 *
 * brain_ask auto-routes Pinecone/Neo4j server-side and handles its own
 * fallback -- it is the highest-level Brain entry point. Prefer it over a
 * hand-rolled Cypher query when the caller has a natural-language methodology
 * question. Canon Part 8: the question string carries only generic methodology
 * language -- never user artifacts, meeting text, or personal identifiers.
 *
 * Returns the parsed brain_ask payload ({ question, keyword, source, count,
 * results: [...] }) on success; a { text: 'Error: ...' } / { error: ... }
 * passthrough on a server-side error; null when the Brain is unreachable or no
 * API key is configured (graceful degradation -- mirrors query()).
 *
 * @param {string} question
 * @returns {Promise<object|null>}
 */
async function ask(question) {
  if (typeof question !== 'string' || !question.trim()) return null;
  return callTool('brain_ask', { question: question });
}

/**
 * Curated-op call against the Brain (the `op` MODE of brain_ask).
 *
 * brain_ask gained an optional curated-op surface (BUG 2 fix). Where ask()
 * runs the natural-language directive path, askOp() runs one of a closed set
 * of named, parameterized operations the Brain resolves to a FROZEN
 * server-side Cypher string. The three ops:
 *
 *   - 'list_frameworks'       params { limit? }            -> rows { name, description, category }
 *   - 'framework_edges'       params { edge_type, limit? } -> rows { from, to, confidence, transform }
 *                                                            or { framework, problem_type }
 *   - 'framework_chain_slice' params { seeds, max_hops?, limit? } -> rows { from, to, hop_distance }
 *
 * Canon Part 8: every param is a generic methodology handle (framework name,
 * closed enum, integer) -- never user content. No caller Cypher is ever sent;
 * the Brain owns the query text. This path is ungated -- any valid key may
 * call it (only query()/write() touch the admin-gated tools).
 *
 * Consumers that only need a framework chain for ONE anchor keep using
 * ask(question) and read next_gate.options[].framework (the directive path).
 *
 * Returns the parsed curated-op payload { op, source, count, rows, degraded? }
 * on success. On any transport / parse failure (Brain unreachable, no API key,
 * bad payload) returns a graceful { op, count: 0, rows: [], degraded: true } so
 * the caller never crashes -- mirrors query()'s graceful-degradation contract.
 *
 * @param {string} operation - one of the three curated op names
 * @param {object} [params]  - generic-handles-only params object
 * @returns {Promise<{op: string, source?: string, count: number, rows: Array, degraded?: boolean}>}
 */
async function askOp(operation, params = {}) {
  try {
    const result = await callTool('brain_ask', { op: operation, params: params || {} });
    // callTool already parses the JSON text payload of the MCP content item,
    // so a well-formed curated-op response arrives as the payload object.
    if (result && typeof result === 'object'
        && typeof result.count === 'number' && Array.isArray(result.rows)) {
      return {
        op: result.op || operation,
        source: result.source,
        count: result.count,
        rows: result.rows,
        ...(result.degraded ? { degraded: true } : {}),
      };
    }
    // Unreachable Brain (null), an error/text passthrough, or any unexpected
    // shape -> graceful degraded sentinel.
    return { op: operation, count: 0, rows: [], degraded: true };
  } catch (_err) {
    return { op: operation, count: 0, rows: [], degraded: true };
  }
}

/**
 * Get Pinecone stats.
 */
async function stats() {
  return callTool('brain_stats', {});
}

/**
 * Return the resolved Brain endpoint (BRAIN_URL above, the module-level
 * single source of truth). The doctor store-identity sense (class-m-brain-
 * smoke.cjs layer 6) needs to report which endpoint the wire actually
 * resolved to, so it must read that value from the one place that decides
 * it rather than duplicating the canon literal as a second source of truth.
 *
 * @returns {string}
 */
function getBrainUrl() {
  return BRAIN_URL;
}

/**
 * Enrich local graph with causal edges from Brain's teaching graph.
 *
 * Queries the Brain Neo4j for causal framework chains relevant to the
 * given problem type or section keywords. Returns structured causal data
 * suitable for writing to local SQLite graph as CAUSES/ROOT_CAUSE_OF edges.
 *
 * @param {string} problemType - Room problem type (e.g., 'market-validation')
 * @param {string[]} sectionKeywords - Keywords from room sections for context
 * @param {object} [options] - Optional config
 * @param {number} [options.maxChainDepth=3] - Maximum causal chain depth
 * @param {number} [options.minConfidence=0.5] - Minimum confidence threshold
 * @returns {Promise<{ causes: Array, rootCauses: Array } | null>}
 *   causes: [{ from, to, mechanism, confidence, framework }]
 *   rootCauses: [{ from, to, chainLength, intermediateCauses, confidence }]
 */
async function enrichCausalEdges(problemType, sectionKeywords, options = {}) {
  if (!isAvailable()) return null;

  // SEC-01 defence-in-depth: coerce + bound numeric interpolants so a hostile
  // non-number (e.g. an object with .toString() side-effects) cannot reach
  // the Cypher string.
  const maxDepth = Math.max(1, Math.min(10, Number(options.maxChainDepth) || 3));
  const minConf = Math.max(0, Math.min(1, Number(options.minConfidence) || 0.5));
  const keywordFilter = sectionKeywords && sectionKeywords.length > 0
    ? sectionKeywords.map(k => `"${sanitizeCypherInput(k)}"`).join(', ')
    : '';

  // Query 1: Direct causal relationships from framework chains
  const causesCypher = `
    MATCH (f1:Framework)-[r:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${sanitizeCypherInput(problemType || '')}"
    WITH f1
    MATCH (f1)-[co:CO_OCCURS]->(f2:Framework)
    WHERE co.weight >= ${minConf}
    RETURN f1.name AS cause_framework,
           f2.name AS effect_framework,
           co.weight AS confidence,
           f1.description AS mechanism
    LIMIT 20
  `;

  // Query 2: Root cause chains (multi-hop framework dependencies)
  const rootCauseCypher = `
    MATCH path = (root:Framework)-[:CO_OCCURS*1..${maxDepth}]->(leaf:Framework)
    WHERE root <> leaf
    ${keywordFilter ? `AND ANY(k IN [${keywordFilter}] WHERE root.name CONTAINS k OR root.description CONTAINS k)` : ''}
    WITH root, leaf, path, length(path) AS depth
    WHERE depth >= 2
    RETURN root.name AS root_cause,
           leaf.name AS symptom,
           depth AS chain_length,
           [n IN nodes(path) | n.name] AS chain_nodes
    LIMIT 10
  `;

  try {
    const [causesResult, rootCausesResult] = await Promise.all([
      query(causesCypher),
      query(rootCauseCypher),
    ]);

    const causes = [];
    const rootCauses = [];

    // Parse causes
    if (causesResult && Array.isArray(causesResult.records)) {
      for (const rec of causesResult.records) {
        causes.push({
          from: rec.cause_framework || rec[0],
          to: rec.effect_framework || rec[1],
          mechanism: rec.mechanism || rec[3] || '',
          confidence: parseFloat(rec.confidence || rec[2] || 0),
          framework: rec.cause_framework || rec[0] || '',
        });
      }
    }

    // Parse root causes
    if (rootCausesResult && Array.isArray(rootCausesResult.records)) {
      for (const rec of rootCausesResult.records) {
        rootCauses.push({
          from: rec.root_cause || rec[0],
          to: rec.symptom || rec[1],
          chainLength: parseInt(rec.chain_length || rec[2] || 1, 10),
          intermediateCauses: rec.chain_nodes || rec[3] || [],
          confidence: 1.0 / (parseInt(rec.chain_length || rec[2] || 1, 10) + 1),
        });
      }
    }

    return { causes, rootCauses };
  } catch (err) {
    // Brain query failed -- return null for graceful degradation
    return null;
  }
}

/**
 * Hat-aware framework recommendation.
 *
 * Reads persistent hat states and adjusts Brain framework queries:
 * - Black Hat concerns boost risk-related frameworks (Risk Matrix, SWOT threats)
 * - Yellow Hat opportunities boost HSI scoring and opportunity frameworks
 * - Blue Hat methodology notes avoid repeating ineffective frameworks
 *
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} problemType - Room problem type
 * @param {object} [options] - Optional config
 * @param {number} [options.topK=5] - Number of frameworks to return
 * @returns {Promise<{ frameworks: Array, hat_influence: object } | null>}
 */
async function hatAwareRecommend(roomDir, problemType, options = {}) {
  if (!isAvailable()) return null;

  // Lazy-require to avoid circular dependency at module load time
  const { loadAllHatStates } = require('./hat-persistence.cjs');
  const hatStates = loadAllHatStates(roomDir);
  // SEC-01 defence-in-depth: bound topK numeric interpolation.
  const topK = Math.max(1, Math.min(100, Number(options.topK) || 5));

  const hatInfluence = {
    risk_boost: false,
    opportunity_boost: false,
    avoid_frameworks: [],
  };

  // Black Hat: if concerns exist, boost risk-related frameworks
  const blackConcerns = hatStates.black.top_concerns || [];
  const riskBoost = blackConcerns.length > 0;
  hatInfluence.risk_boost = riskBoost;

  // Yellow Hat: if opportunities exist, boost HSI/opportunity frameworks
  const yellowOpps = hatStates.yellow.top_opportunities || [];
  const oppBoost = yellowOpps.length > 0;
  hatInfluence.opportunity_boost = oppBoost;

  // Blue Hat: methodology notes may flag ineffective frameworks to avoid
  const blueNotes = hatStates.blue.methodology_notes || [];

  // Part 8 raw-field egress guard (Phase 239 / BRAIN-02, threats T2, T4, T5).
  // Classifies the RAW problemType and each RAW blueNotes entry BEFORE
  // sanitizeCypherInput and BEFORE any Cypher interpolation below -- the raw
  // field is the only place the content signal is still intact. MEASURED:
  // classifying the ASSEMBLED cypher string instead would let the template's
  // own vocabulary word "Framework" launder an embedded canary from ambiguous
  // to allow, and sanitizeCypherInput strips the char the Part-8 PII pattern
  // keys on. Fail-closed: any missing or non-allow verdict skips the Brain leg.
  for (const rawField of [problemType].concat(blueNotes)) {
    let hatEgressVerdict = null;
    try {
      const hatEgressGuard = require('./part8-egress-guard.cjs');
      hatEgressVerdict = hatEgressGuard.classify(
        { question: String(rawField || '') },
        { toolName: 'brain_ask' }
      );
    } catch (_e) {
      hatEgressVerdict = null;
    }
    if (!hatEgressVerdict || hatEgressVerdict.verdict !== 'allow') {
      _logEventBestEffort(options.db, 'brain_egress_blocked', {
        egress_class: (hatEgressVerdict && hatEgressVerdict.class) || 'unknown',
        verdict: (hatEgressVerdict && hatEgressVerdict.verdict) || 'unverified',
        count: 1,
        created_by: 'system',
        source_path: 'system:brain-hat-recommend',
      });
      return null;
    }
  }

  const avoidPatterns = blueNotes
    .filter(n => /ineffective|didn't work|not useful|skip|avoid/i.test(n))
    .map(n => {
      // Extract framework name from notes like "SWOT was ineffective for this stage"
      const match = n.match(/^(\w[\w\s]+?)\s+(?:was|is|were|proved)\s/i);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);
  hatInfluence.avoid_frameworks = avoidPatterns;

  // Build Cypher query with hat-influenced scoring
  const safeProblemType = sanitizeCypherInput(problemType || '');
  const avoidClause = avoidPatterns.length > 0
    ? `AND NOT ANY(avoid IN [${avoidPatterns.map(a => `"${sanitizeCypherInput(a)}"`).join(', ')}] WHERE f.name CONTAINS avoid)`
    : '';

  // Query: frameworks for problem type, with hat-influenced ordering
  const cypher = `
    MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${safeProblemType}"
    ${avoidClause}
    WITH f
    OPTIONAL MATCH (f)-[co:CO_OCCURS]->(f2:Framework)
    WITH f, count(co) AS connections
    RETURN f.name AS name,
           f.description AS description,
           connections,
           CASE
             WHEN ${riskBoost ? 'true' : 'false'} AND (f.name CONTAINS 'Risk' OR f.name CONTAINS 'SWOT' OR f.name CONTAINS 'Failure') THEN connections + 10
             WHEN ${oppBoost ? 'true' : 'false'} AND (f.name CONTAINS 'HSI' OR f.name CONTAINS 'Opportunity' OR f.name CONTAINS 'Innovation') THEN connections + 10
             ELSE connections
           END AS hat_score
    ORDER BY hat_score DESC
    LIMIT ${topK}
  `;

  try {
    const result = await query(cypher);
    const frameworks = [];

    if (result && Array.isArray(result.records)) {
      for (const rec of result.records) {
        frameworks.push({
          name: rec.name || rec[0],
          description: rec.description || rec[1],
          connections: parseInt(rec.connections || rec[2] || 0, 10),
          hat_score: parseInt(rec.hat_score || rec[3] || 0, 10),
        });
      }
    }

    return {
      frameworks,
      hat_influence: hatInfluence,
      black_concerns: blackConcerns.slice(0, 3),
      yellow_opportunities: yellowOpps.slice(0, 3),
      blue_avoid: avoidPatterns,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Suggest validation steps for a banked opportunity using Brain framework chains.
 *
 * Queries Brain Neo4j for frameworks that ADDRESSES_PROBLEM_TYPE matching the
 * opportunity's domain/problem, then follows FEEDS_INTO chains to build a
 * suggested validation sequence.
 *
 * @param {Object} opportunity - Opportunity object with at minimum: problem, domain, knight_position
 * @param {Object} [options] - Optional config
 * @param {number} [options.maxSteps=5] - Maximum validation steps to return
 * @param {number} [options.chainDepth=3] - Maximum FEEDS_INTO chain depth
 * @returns {Promise<{ steps: Array<{framework: string, reason: string, order: number}>, chain_source: string } | null>}
 *   Returns null if Brain unavailable (Tier 0 graceful degradation)
 */
async function suggestValidationSteps(opportunity, options = {}) {
  if (!isAvailable()) return null;
  if (!opportunity || !opportunity.problem) return null;

  // Part 8 raw-field egress guard (Phase 239 / BRAIN-02, threats T2, T4, T5).
  // Classifies the RAW opportunity.domain and the RAW opportunity.problem
  // BEFORE sanitizeCypherInput and BEFORE any Cypher interpolation below --
  // strictly upstream of sanitizeCypherInput, which is the entire point.
  // MEASURED: sanitizeCypherInput strips the '@' the Part-8 email pattern
  // keys on (jane@startup.com -> janestartup.com), flipping a block verdict
  // into an allow. Classifying the ASSEMBLED cypher string instead would also
  // let the template's own vocabulary word "Framework" launder an embedded
  // canary from ambiguous to allow. Fail-closed: any missing or non-allow
  // verdict skips the Brain leg entirely.
  for (const rawField of [opportunity.domain, opportunity.problem]) {
    let validationEgressVerdict = null;
    try {
      const validationEgressGuard = require('./part8-egress-guard.cjs');
      validationEgressVerdict = validationEgressGuard.classify(
        { question: String(rawField || '') },
        { toolName: 'brain_ask' }
      );
    } catch (_e) {
      validationEgressVerdict = null;
    }
    if (!validationEgressVerdict || validationEgressVerdict.verdict !== 'allow') {
      _logEventBestEffort(options.db, 'brain_egress_blocked', {
        egress_class: (validationEgressVerdict && validationEgressVerdict.class) || 'unknown',
        verdict: (validationEgressVerdict && validationEgressVerdict.verdict) || 'unverified',
        count: 1,
        created_by: 'system',
        source_path: 'system:brain-validation-steps',
      });
      return null;
    }
  }

  const maxSteps = options.maxSteps || 5;
  const chainDepth = options.chainDepth || 3;
  const safeProblem = sanitizeCypherInput(opportunity.problem || '').substring(0, 200);
  const safeDomain = sanitizeCypherInput(opportunity.domain || '').substring(0, 100);
  const safeKnight = opportunity.knight_position || 'uncertainty';

  // Query 1: Find frameworks that address this problem type / domain
  const matchCypher = `
    MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${safeDomain}"
       OR pt.description CONTAINS "${safeDomain}"
    RETURN f.name AS name, f.description AS description
    LIMIT 10
  `;

  // Query 2: Follow FEEDS_INTO chains from matched frameworks
  const chainCypher = `
    MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${safeDomain}"
       OR pt.description CONTAINS "${safeDomain}"
    WITH f LIMIT 3
    MATCH path = (f)-[:FEEDS_INTO*1..${chainDepth}]->(next:Framework)
    RETURN f.name AS start_framework,
           next.name AS next_framework,
           next.description AS next_description,
           length(path) AS depth
    ORDER BY depth ASC
    LIMIT ${maxSteps * 2}
  `;

  try {
    const [matchResult, chainResult] = await Promise.all([
      query(matchCypher),
      query(chainCypher),
    ]);

    const steps = [];
    const seen = new Set();

    // First: add the entry-point frameworks
    if (matchResult && Array.isArray(matchResult.records)) {
      for (const rec of matchResult.records) {
        const name = rec.name || rec[0];
        if (name && !seen.has(name) && steps.length < maxSteps) {
          seen.add(name);
          steps.push({
            framework: name,
            reason: safeKnight === 'uncertainty'
              ? `Explore this ${safeDomain} uncertainty with ${name}`
              : `Validate this ${safeDomain} risk using ${name}`,
            order: steps.length + 1,
          });
        }
      }
    }

    // Then: add FEEDS_INTO chain steps
    if (chainResult && Array.isArray(chainResult.records)) {
      for (const rec of chainResult.records) {
        const name = rec.next_framework || rec[1];
        const desc = rec.next_description || rec[2] || '';
        if (name && !seen.has(name) && steps.length < maxSteps) {
          seen.add(name);
          steps.push({
            framework: name,
            reason: desc ? `Then apply ${name}: ${desc.substring(0, 120)}` : `Then apply ${name} (follows from chain)`,
            order: steps.length + 1,
          });
        }
      }
    }

    if (steps.length === 0) return null;

    return {
      steps,
      chain_source: 'brain_feeds_into',
    };
  } catch (err) {
    // Brain query failed -- graceful degradation
    return null;
  }
}

/**
 * Write Cypher to Neo4j via Brain (write operations).
 * Used by sync-rooms-brain for creating Room/RoomGroup nodes and edges.
 * Returns null if Brain is unavailable -- never throws.
 *
 * NOTE (Finding I sibling, v1.10.9 hotfix 2026-04-15): same param-name
 * mismatch as brain_query had. Brain MCP brain_write expects `cypher`,
 * not `query`. This function had the mirror bug since inception but
 * never fired in production because sync-rooms-brain is rarely invoked
 * against the live Brain. Caught by the plan-checker audit for Phase 85.
 *
 * @param {string} cypher - Cypher write query
 * @returns {Promise<object|null>}
 */
async function write(cypher) {
  return callTool('brain_write', { cypher: cypher });
}

// ============================================================================
// Loop-contract read wrappers (Phase 247-02, CONTRACT-01).
// ============================================================================
//
// Thin pass-through wrappers over callTool for the five loop-contract tools
// that had NO client wrapper before this phase (data/brain-surface-contract.json
// is the source of truth for the tool name + arg-key shape each wrapper below
// must emit; tests/test-247-contract-client.cjs derives its expectations from
// that file, not from this comment). brain_stats is the sixth loop-contract
// tool and already has a wrapper: stats() above.
//
// Every wrapper is a straight callTool(name, args) call with NO result
// reshaping -- the tier_denied / invalid_key sentinels and the transport-null
// pass through unchanged, exactly like write() and stats() already do.
// Part 7 (extend, never a fourth brain skill): these live in this file.
//
// loopSearch() is named to avoid colliding with the existing search() export
// above, which wraps the DIFFERENT brain_search tool (Pinecone semantic
// search with quota-fallback handling). The loop-contract `search` tool is a
// distinct, simpler read tool -- same English word, different Brain tool,
// different client function, deliberately renamed so callers cannot conflate
// them.

/**
 * Loop-contract `normalize_framework_name` tool.
 * @param {string} raw
 * @returns {Promise<object|null>}
 */
async function normalizeFrameworkName(raw) {
  return callTool('normalize_framework_name', { raw: raw });
}

/**
 * Loop-contract `search` tool (NOT brain_search -- see module-level note above).
 * @param {string} queryText
 * @param {number} [topK]
 * @returns {Promise<object|null>}
 */
async function loopSearch(queryText, topK) {
  return callTool('search', { query: queryText, topK: topK });
}

// ----------------------------------------------------------------------------
// Phase 249-01 (ENRICH-01) -- capture-on-miss for the two readiness-shaped
// loop wrappers below. NEITHER wrapper reshapes its return value (247-02's
// "zero result reshaping so sentinels propagate unchanged" is preserved
// here); capture happens in a try/catch side branch AFTER resolution, and
// the raw callTool result is returned unchanged in every case, including
// when the capture branch itself fails. opts is OPTIONAL and backward
// compatible: no opts / no opts.roomDir means zero capture, zero throw,
// identical behavior to the pre-249 wrapper.
//
// Sentinel discipline: a result carrying .error (tier_denied, invalid_key)
// or a null (transport failure) is NEVER a capture trigger -- failure
// visibility is Phase 250's refusal territory, not an enrichment miss
// (research "Where the readiness probe should run").
//
// Each successful capture logs a scalar enrichment_queue_captured
// memory_event (framework handle + score only), mirroring the existing
// brain_packet_rejected precedent's _logEventBestEffort mechanism above --
// best-effort, silently skipped when opts.db is absent.
// ----------------------------------------------------------------------------

function _isCapturableResult(result) {
  return result !== null && typeof result === 'object' && !result.error;
}

function _maybeCaptureEnrichmentMiss(frameworkName, result, opts) {
  try {
    if (!opts || typeof opts !== 'object') return;
    if (typeof opts.roomDir !== 'string' || opts.roomDir.length === 0) return;
    if (!_isCapturableResult(result)) return;
    // eslint-disable-next-line global-require
    const enrichmentQueue = require('./enrichment-queue.cjs');
    const captureResult = enrichmentQueue.captureReadinessMiss(
      opts.roomDir, frameworkName, result, opts.contextClass || {}
    );
    if (captureResult && captureResult.queued) {
      _logEventBestEffort(opts.db, 'enrichment_queue_captured', {
        framework: frameworkName,
        readiness_score: (typeof result.readiness_score === 'number') ? result.readiness_score : null,
        source_path: 'system:enrichment-queue',
      });
    }
  } catch (_e) {
    // Best-effort capture side branch: NEVER surfaces to the wrapper caller.
  }
}

/**
 * Loop-contract `discover_structure` tool.
 *
 * @param {string} frameworkName
 * @param {object} [opts] - { roomDir?, contextClass?, db? }. Phase 249-01:
 *   when opts.roomDir is set and the resolved payload carries
 *   grounded === false, best-effort captures an enrichment-queue entry.
 *   Absent opts / opts.roomDir: zero capture, zero throw, unchanged
 *   backward-compatible behavior.
 * @returns {Promise<object|null>}
 */
async function discoverStructure(frameworkName, opts) {
  const result = await callTool('discover_structure', { framework_name: frameworkName });
  _maybeCaptureEnrichmentMiss(frameworkName, result, opts);
  return result;
}

/**
 * Loop-contract `orchestration_readiness` tool.
 *
 * @param {string} frameworkName
 * @param {object} [opts] - { roomDir?, contextClass?, db? }. Phase 249-01:
 *   when opts.roomDir is set and the resolved payload carries
 *   readiness_score <= 2, best-effort captures an enrichment-queue entry.
 *   Absent opts / opts.roomDir: zero capture, zero throw, unchanged
 *   backward-compatible behavior.
 * @returns {Promise<object|null>}
 */
async function orchestrationReadiness(frameworkName, opts) {
  const result = await callTool('orchestration_readiness', { framework_name: frameworkName });
  _maybeCaptureEnrichmentMiss(frameworkName, result, opts);
  return result;
}

/**
 * Loop-contract `feeds_into_chains` tool.
 * @param {string[]} seeds
 * @param {number} [maxHops]
 * @returns {Promise<object|null>}
 */
async function feedsIntoChains(seeds, maxHops) {
  return callTool('feeds_into_chains', { seeds: seeds, max_hops: maxHops });
}

// Phase 252-01 (SWEEP-01, guard sweep) -- getTier0Chain() / getFrameworkChain()
// DELETED here. They served hardcoded, non-graph-grounded persona chains
// with `source: 'tier0'` -- the counterfeit core the 250-01 doctrine kill
// list (site #11) marked but deferred flipping. Live grep at 252 execution
// time confirmed zero CJS consumers outside this file; their only consumer
// was the conversation-mode SKILL instruction (skills/conversation-mode/
// SKILL.md), rewritten in this same task to follow the refusal rail instead
// of calling either function. The 247-02 do-not-widen note on the null
// branch (`callTool()`'s transport-failure contract) is untouched -- this
// deletion removes a local fallback CHAIN, not the null contract.

// ============================================================================
// Phase 110-03: Brain Context Packet wire enforcement (Canon Part 8 + Part 9).
// ============================================================================
//
// sendPacket(packet, opts) is the SOLE typed-packet wire path. It runs:
//   (1) D-08 layer-3 origin allowlist (the belt to the schema's suspenders --
//       a caller who bypassed ajv still gets caught here).
//   (2) Unknown-job guard against the closed D-02 vocabulary (12 jobs).
//   (3) ajv in-validation (reject hard: throw + log brain_packet_rejected).
//   (4) POST tools/call name:'brain_packet' via the existing callTool transport
//       (degrade soft when the tool is absent: { advice:null, reason:
//       'brain_packet_tool_absent' }; on transport error: { advice:null,
//       reason: 'brain_unreachable' }). Never throws on Brain-side problems.
//   (5) ajv out-validation (reject hard, degrade soft: log
//       brain_response_rejected + return { advice:null, reason:
//       'response_schema_invalid' }). Never throws, never partial-ingests.
//   (6) Returns the validated out payload on success.
//
// ajv@8.18.0 is transitive via @modelcontextprotocol/sdk -- do NOT add it to
// package.json (CLAUDE.md "What NOT to Use"). strict:false at runtime; the
// strict:true build gate lives in scripts/build-brain-packet-schema.cjs. The
// schema is draft 2020-12, so Ajv2020 is required (ajv/dist/2020).
//
// SHIPPED_JOBS is the D-02 closed vocabulary (locked in 110-CONTEXT D-02).

const Ajv2020 = require('ajv/dist/2020').default || require('ajv/dist/2020');

const _BRAIN_PACKET_SCHEMA_PATH = process.env.MINDRIAN_BRAIN_PACKET_SCHEMA
  || path.join(__dirname, '..', '..', 'data', 'brain-packet-schema.json');

const SHIPPED_JOBS = new Set([
  'select_methodology',
  'suggest_next_move',
  'detect_contradiction',
  'summarize_neighborhood',
  'classify_room_budding',
  'rank_assumptions',
  'generate_feynman_explanation',
  'strengthen_minto',
  'prepare_investor_brief',
  'opportunity_react',
  'opportunity_reflect',
  'opportunity_rank',
]);

let _ajv = null;
let _schemaRaw = null;
const _jobValidators = new Map(); // job -> { in: fn, out: fn }

/**
 * Lazily compile the brain-packet schema. Reads data/brain-packet-schema.json
 * (or process.env.MINDRIAN_BRAIN_PACKET_SCHEMA, the test seam set up by 110-01)
 * once at first use; subsequent calls reuse the in-memory Ajv instance.
 *
 * NOTE on the schema's pointer shape: the 110-01 schema's per-job $defs are
 * { in: {...}, out: {...} } -- NOT { properties: { in, out } }. So the JSON
 * pointer for a job half is #/$defs/<job>/<half>, not the planner's interfaces
 * sketch shape #/$defs/<job>/properties/<half>. Compiled wrappers carry the
 * root's $defs inline because ajv 8.x cannot resolve a deep JSON pointer into
 * a schema indexed only by its absolute $id (a known ajv@8 quirk -- the build
 * script in scripts/build-brain-packet-schema.cjs validates the root by
 * compiling it directly with the same Ajv2020 class).
 */
function _ensureSchema() {
  if (_ajv) return;
  _schemaRaw = JSON.parse(fs.readFileSync(_BRAIN_PACKET_SCHEMA_PATH, 'utf8'));
  _ajv = new Ajv2020({ allErrors: true, strict: false });
  // Pre-add the root so cross-refs (FocusNode, Origin, BankedOpportunities,
  // BrainResponse, etc.) resolve when sub-schemas reference them. Wrapper
  // schemas below carry $defs inline as a defensive duplicate.
  _ajv.addSchema(_schemaRaw);
}

/**
 * Return the memoized in/out validator for a given (job, half). Half is
 * 'in' or 'out'. Compiles on first use.
 *
 * @param {string} job  - D-02 jobname (must be in SHIPPED_JOBS).
 * @param {'in'|'out'} half
 * @returns {Function} a compiled ajv validator function.
 */
function _validatorFor(job, half) {
  _ensureSchema();
  let pair = _jobValidators.get(job);
  if (!pair) { pair = {}; _jobValidators.set(job, pair); }
  if (!pair[half]) {
    pair[half] = _ajv.compile({
      $id: 'urn:mindrian:brain-packet:' + job + ':' + half,
      $ref: '#/$defs/' + job + '/' + half,
      $defs: _schemaRaw.$defs,
    });
  }
  return pair[half];
}

/**
 * Reset the lazy schema state. Test hook only -- NOT part of the public API.
 * Used by 110-05 (the per-job validation suite) and 110-04 (the pre-commit
 * tripwire) to swap the schema seam (MINDRIAN_BRAIN_PACKET_SCHEMA) and re-run.
 */
function _resetSchema() {
  _ajv = null;
  _schemaRaw = null;
  _jobValidators.clear();
}

/**
 * Best-effort memory_event log. Skips silently if opts.db is absent OR if the
 * navigation re-export throws (Brain telemetry should never break a Brain call).
 *
 * @param {object} db        - SQLite db handle from openRoomDb (or undefined).
 * @param {string} eventType - one of 'brain_packet_rejected' /
 *                             'brain_response_rejected' / 'brain_legacy_path_used'
 *                             (Phase 110-02 added these to EVENT_TYPES).
 * @param {object} payload   - { job, errors, source_path, ... } scalars only.
 */
function _logEventBestEffort(db, eventType, payload) {
  if (!db) return;
  try {
    // Lazy-require to avoid a circular load between brain-client.cjs and
    // navigation.cjs (navigation.cjs does NOT require brain-client.cjs today,
    // but this stays robust if a future closure of the loop ever happens).
    require('./navigation.cjs').logMemoryEvent(db, eventType, payload || {});
  } catch (_e) { /* best-effort */ }
}

/**
 * Detect a "Brain doesn't recognize this tool" error in the callTool result.
 * Per the callTool JSDoc around line ~329, the result on a server-side error
 * is shaped { text: 'Error: ...' } (Cypher errors pass through the same way).
 * A missing brain_packet tool will show up as -32602 / 'unknown tool' / 'No
 * such tool' / a 404-ish marker. Be liberal: D-04 says "degrade gracefully
 * when the Brain doesn't recognize the contract."
 *
 * @param {*} result
 * @returns {boolean}
 */
function _looksLikeUnknownToolError(result) {
  if (!result) return false;
  let t = '';
  if (typeof result === 'string') t = result;
  else if (typeof result === 'object') t = result.text || result.error || JSON.stringify(result);
  const s = String(t).toLowerCase();
  return s.includes('unknown tool')
    || s.includes('no such tool')
    || s.includes('method not found')
    || s.includes('-32602')
    || (s.includes('brain_packet') && (s.includes('not') || s.includes('unknown')))
    || s.includes('tool not found');
}

/**
 * Unwrap the callTool result to the Brain response object the schema wants to
 * validate. callTool returns:
 *   - an array (the tools/call content array on a successful brain_query-style
 *     parsed result),
 *   - or a parsed object (when content[0] is text and parses as JSON),
 *   - or { text: '...' } (text content that did not parse as JSON, or an error
 *     string),
 *   - or null (unreachable / no API key -- handled before this is called).
 *
 * For brain_packet specifically, the Brain side (when implemented) will return
 * a BrainResponse-shaped JSON object: { job_id, suggestions: [...] }. Older
 * test transports inject [{ type:'text', text: JSON.stringify(...) }] (the raw
 * MCP content array shape). Both shapes are unwrapped to the response object.
 *
 * @param {*} result
 * @returns {object}
 */
function _parseBrainResult(result) {
  if (Array.isArray(result)) {
    for (const item of result) {
      if (item && item.type === 'text' && typeof item.text === 'string') {
        try { return JSON.parse(item.text); } catch (_) { /* fall through */ }
      }
    }
    return { suggestions: [] };
  }
  if (result && typeof result === 'object') {
    // text-only error/string shape -- try to parse, else return { suggestions: [] }
    if (typeof result.text === 'string' && !result.job_id && !result.suggestions) {
      try { return JSON.parse(result.text); } catch (_) { return { suggestions: [] }; }
    }
    return result;
  }
  if (typeof result === 'string') {
    try { return JSON.parse(result); } catch (_) { return { suggestions: [] }; }
  }
  return { suggestions: [] };
}

// ----------------------------------------------------------------------------
// _warnLegacyOnce -- the D-10 dual-path deprecation guard.
//
// As of v1.13.0-beta.3 there is NO legacy free-form Brain *job* call site --
// new job-style work goes through sendPacket(). The guard ships now as a
// forward-looking contract: if a free-form job helper is ever added before
// v1.14.0, it MUST call _warnLegacyOnce() first; in v1.14.0 both the helper
// and this guard are deleted.
//
// query() / write() / search() / schema() / callTool() / ask() / stats() are
// NOT "legacy" -- raw-Cypher methodology lookups carry only generic handles
// (framework names, phase identifiers, problem-type enums) and are Part-8
// clean by construction; they are PERMANENT.
//
// Module-level flag idiom mirrors checkFilePermissions._warned (the existing
// once-per-process warning pattern in this file).
// ----------------------------------------------------------------------------

let _legacyPathWarned = false;

function _warnLegacyOnce(db) {
  if (_legacyPathWarned) return;
  _legacyPathWarned = true;
  // eslint-disable-next-line no-console
  console.warn('[mindrian-os] legacy free-form Brain job call detected. '
    + 'Migrate to brain-client.sendPacket() -- the legacy job path is removed in v1.14.0.');
  _logEventBestEffort(db, 'brain_legacy_path_used', {
    source_path: 'system:brain-legacy',
  });
}

/**
 * Validate-then-route a Brain Context Packet. The ONLY door for typed Brain
 * job calls.
 *
 * Per CONTEXT D-07 "reject hard, degrade soft":
 *   - Bad in-packet (a programmer error in OUR code) -> throw.
 *   - Bad origin (D-08 layer 3) -> throw.
 *   - Unknown job -> throw.
 *   - Brain unreachable -> { advice: null, reason: 'brain_unreachable' } (no throw).
 *   - brain_packet tool absent on the Brain -> { advice: null, reason:
 *     'brain_packet_tool_absent' } (no throw, no log -- D-04 graceful degrade
 *     is NOT a bad-response situation; a half-trusted response IS one).
 *   - Bad out-response -> { advice: null, reason: 'response_schema_invalid' }
 *     + log brain_response_rejected. NEVER throws, NEVER partial-ingests.
 *
 * @param {object} packet - MUST come from lib/core/navigation.cjs::buildBrainPacket
 *                          (D-01 chokepoint; D-08 layer 2 enforces lexically;
 *                          D-08 layer 3 is the origin check below).
 * @param {object} [opts] - { db?, roomDir?, __transport? }
 *                          db        -> the SQLite handle for the memory_event log
 *                          roomDir   -> reserved for future use; not read today
 *                          __transport -> optional test seam: a function
 *                                         (toolName, args) => Promise<result> that
 *                                         replaces callTool (lets tests inject a
 *                                         fake without require.cache surgery)
 * @returns {Promise<object>} the validated Brain out on success; a no-advice
 *                            sentinel on a soft-degrade.
 * @throws on a bad in-packet, a bad origin (D-08 layer 3), or an unknown job.
 */
// PARKED (2026-07-30, Phase 239, BRAIN-03): ZERO production sendPacket(
// consumers. Census across lib/, scripts/, bin/, pipelines/: the only
// definition is this one; non-definition references are this file's own
// export/comments, tests/test-brain-packet-validation-per-job.cjs, and the
// D-08 layer-2 guard (scripts/check-schema-aliases.cjs --check-sendpacket).
// This reconciles two prior contradictory claims: navigation/packet.cjs:105
// ("zero production consumers today") was TRUE; test-150-brain-egress.cjs:12
// ("FIRST real sendPacket consumer") was FALSE and is corrected in this
// change. RULING: PARKED, not wired -- wiring it to a real job is net-new
// feature work, forbidden inside this remediation-only milestone (RESEARCH.md
// A3, a navigator-equivalent ruling, cheap to overturn). CONSEQUENCE: the
// PB8-10 belt below (step 3.5) is correct code on an unreached path -- do NOT
// count it as live Part 8 coverage; the live in-process coverage is sibling
// plan 239-05's raw-field guard in hatAwareRecommend()/suggestValidationSteps().
// RE-OPEN CONDITION: the first real caller. Caught by the D-08 layer-2
// pre-commit guard (requires a preceding buildBrainPacket() call) and by
// tests/test-239-sendpacket-parked.cjs LEG 1's census. See also the matching
// ADR amendment in docs/architecture/SUBSTRATE-CONTRACT.md (Phase 239-06).
async function sendPacket(packet, opts) {
  const o = opts || {};

  // (1) D-08 layer 3 -- the belt to the schema's suspenders. Runs FIRST so a
  //     caller who bypassed ajv still gets caught.
  if (!packet || typeof packet.origin !== 'string') {
    throw new Error('brain packet missing origin (D-08): packets must come from buildBrainPacket');
  }
  if (packet.origin === 'test_fixture' && process.env.MINDRIAN_TEST_MODE !== '1') {
    throw new Error('brain packet origin "test_fixture" only valid when MINDRIAN_TEST_MODE=1');
  }
  if (packet.origin !== 'navigation_api' && packet.origin !== 'test_fixture') {
    throw new Error('brain packet origin "' + packet.origin
      + '" not in the closed allowlist (D-08): navigation_api | test_fixture');
  }

  // (2) Unknown-job guard.
  if (!SHIPPED_JOBS.has(packet.job)) {
    throw new Error('brain packet: unknown job "' + packet.job
      + '" (not in the D-02 closed vocabulary)');
  }

  // (3) in-validation -- reject hard.
  const inFn = _validatorFor(packet.job, 'in');
  if (!inFn(packet)) {
    // Pitfall 1: snapshot errors immediately -- validate.errors is overwritten
    // on every subsequent validate() call.
    const errsSnapshot = (inFn.errors || []).slice();
    const errStr = errsSnapshot
      .map(function (e) { return (e.instancePath || '(root)') + ' ' + (e.message || ''); })
      .join('; ');
    _logEventBestEffort(o.db, 'brain_packet_rejected', {
      job: packet.job,
      errors: errsSnapshot.length,
      source_path: 'system:brain-packet',
    });
    throw new Error('brain packet rejected for job "' + packet.job + '": ' + errStr);
  }

  // (3.5) PB8-10 -- the in-sendPacket defense-in-depth belt. sendPacket is the
  //       SOLE typed-packet wire path; this is the last LOCAL check before the
  //       packet goes on the wire. It COMPLEMENTS the required PreToolUse hook
  //       (D-02, the primary), never replaces it. Runs the pure LOCAL classifier
  //       (zero network, zero judge wire, D-01):
  //         - 'block' verdict -> refuse the send, returning the same soft-degrade
  //           sentinel the unreachable path uses; best-effort log brain_egress_blocked.
  //         - 'ambiguous' verdict -> belt posture: the hook is the gate, so do NOT
  //           double-prompt; best-effort log brain_egress_ambiguous and allow through.
  //       The whole belt is wrapped so a belt-INTERNAL error degrades to the
  //       existing behavior (the hook remains the primary). It NEVER throws and
  //       NEVER opens a Brain wire to judge.
  try {
    const _guard = require('./part8-egress-guard.cjs');
    const _verdict = _guard.classify(packet, { toolName: 'brain_packet' });
    if (_verdict && _verdict.verdict === 'block') {
      _logEventBestEffort(o.db, 'brain_egress_blocked', {
        egress_class: _verdict.class || 'content_set',
        verdict: 'block',
        count: 1,
        created_by: 'system',
        source_path: 'system:brain-packet',
      });
      return { advice: null, reason: 'egress_blocked' };
    }
    if (_verdict && _verdict.verdict === 'ambiguous') {
      _logEventBestEffort(o.db, 'brain_egress_ambiguous', {
        egress_class: _verdict.class || 'unknown',
        verdict: 'ambiguous',
        count: 1,
        created_by: 'system',
        source_path: 'system:brain-packet',
      });
      // belt posture: allow the hook to have been the gate; do not double-prompt.
    }
  } catch (_e) {
    // belt-internal error degrades to existing behavior (the hook is the primary, D-02).
  }

  // (4) Build the wire envelope + POST. Reuse callTool's transport (it does
  //     tools/call over Streamable HTTP + SSE-parse). Tests can inject a fake
  //     via opts.__transport.
  const transport = (typeof o.__transport === 'function') ? o.__transport : callTool;
  let result;
  try {
    result = await transport('brain_packet', { packet: packet });
  } catch (_e) {
    // Network / transport error: treat like the Brain being unreachable.
    // No log -- it is not a leak, and not a contract violation either.
    return { advice: null, reason: 'brain_unreachable' };
  }
  if (result == null) {
    // callTool returns null when there is no API key or when the HTTP layer
    // returned a non-ok status -- functionally the same as "Brain unreachable".
    return { advice: null, reason: 'brain_unreachable' };
  }
  if (_looksLikeUnknownToolError(result)) {
    // The live Brain has no brain_packet tool yet (D-04 generalized).
    // Degrade soft, NO brain_response_rejected log -- this is NOT a bad
    // response; it is the absence of a contract handler.
    return { advice: null, reason: 'brain_packet_tool_absent' };
  }

  // (5) out-validation -- reject hard but degrade soft.
  const parsed = _parseBrainResult(result);
  const outFn = _validatorFor(packet.job, 'out');
  if (!outFn(parsed)) {
    const errsSnapshot = (outFn.errors || []).slice();
    _logEventBestEffort(o.db, 'brain_response_rejected', {
      job: packet.job,
      errors: errsSnapshot.length,
      source_path: 'system:brain-packet',
    });
    // NEVER throw on a bad response; NEVER partial-ingest.
    return { advice: null, reason: 'response_schema_invalid' };
  }

  // (6) Success -- the caller gets a known-good shape (typically then calls
  //     navigation.storeBrainSuggestions).
  return parsed;
}

module.exports = {
  isAvailable,
  ensureAvailable,
  getAutoRegisterFailureReason,
  getApiKey,
  callTool,
  query,
  write,
  search,
  smartSearch,
  ask,
  askOp,
  schema,
  stats,
  getBrainUrl,
  enrichCausalEdges,
  hatAwareRecommend,
  suggestValidationSteps,
  // getFrameworkChain: DELETED (Phase 252-01, SWEEP-01) -- the counterfeit
  // Tier-0 hardcoded-chain fallback. Zero CJS consumers at deletion time.
  // Phase 247-02 (CONTRACT-01): loop-contract read wrappers. brain_stats is
  // the sixth loop tool and is already exported above as stats().
  normalizeFrameworkName,
  loopSearch,
  discoverStructure,
  orchestrationReadiness,
  feedsIntoChains,
  // Phase 110-03 (Brain Context Packet Contract wire-level enforcement):
  // sendPacket is the SOLE typed-packet wire path; _warnLegacyOnce is the
  // forward-looking D-10 deprecation guard with no current call site.
  sendPacket,
  _warnLegacyOnce,
  // SEC-01/SEC-02 + CASCADE-06 test surface: not part of the public API.
  // See lib/memory/security-trifecta.test.cjs + brain-cache-lru.test.cjs.
  // Helpers are small and pure. sessionCache + _ensureSession + _hashKey +
  // SESSION_TTL_MS are exposed for Phase 87-07 cache-behavior tests.
  // Phase 110-03: ajv middleware test seam (_resetSchema clears the lazy
  //   ajv state so a test can swap MINDRIAN_BRAIN_PACKET_SCHEMA and re-run;
  //   _setLegacyWarned resets the once-per-session deprecation flag;
  //   _validatorFor / _parseBrainResult / _looksLikeUnknownToolError are
  //   the helpers Plan 110-05 covers in its per-job round-trip suite).
  _test: {
    sanitizeCypherInput,
    checkFilePermissions,
    sessionCache,
    SESSION_TTL_MS,
    _hashKey,
    _ensureSession,
    _resetSchema,
    _validatorFor,
    _parseBrainResult,
    _looksLikeUnknownToolError,
    _ensureSchema,
    SHIPPED_JOBS,
    _setLegacyWarned: function (v) { _legacyPathWarned = !!v; },
    // Phase 250-04 test surface: silent registration internals.
    _tryAutoRegister,
    _installTokenPath,
  },
};
