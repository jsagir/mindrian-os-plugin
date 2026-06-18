'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 166-03 -- chain-retry.cjs (EXEC-05 / D-166-01)
 * ====================================================
 * A thin, reusable retry substrate the runChain onStep dispatch wraps. Two
 * exports:
 *
 *   isTransient(err) -> boolean
 *     true ONLY for the four named transient remote codes 500 / 502 / 503 / 529
 *     (Bad Gateway / Internal / Service Unavailable / Overloaded). The code is
 *     read from err.status, err.statusCode, or a regex over err.message.
 *     Everything else -- 4xx, validation, type errors, null -- is non-transient
 *     and fails fast. This is a CLOSED allow-list (T-166-11): a non-transient
 *     error is never retried as transient.
 *
 *   withBackoff(fn, { retries, baseDelayMs, maxDelayMs, sleep, returnMarkerOnExhaust })
 *     calls fn; on a TRANSIENT throw, waits an exponential-with-cap delay
 *     (baseDelayMs * 2^attempt, capped at maxDelayMs) via an INJECTABLE sleep
 *     and retries up to `retries` times; on a NON-transient throw, rethrows
 *     immediately (fail fast); on exhaustion returns OR throws an exhaustion
 *     marker carrying the last transient code so runChain can branch to a
 *     graceful partial (SEED-028 / the AION failure mode). The retry count is
 *     BOUNDED (T-166-09): attempts never exceed retries+1, and the delay never
 *     exceeds maxDelayMs.
 *
 * Pure node built-ins. Zero new packages. No Math.random (delays are
 * deterministic: baseDelayMs * 2^attempt capped). No real network.
 *
 * Canon Part 8 (Graph Boundary): this file opens NO Brain wire and makes no raw
 * fetch. It is a pure timing/error-inspection helper -- it inspects an error
 * object and schedules a delay, nothing more.
 *
 * Canon Part 7 (Reuse Before Build): net-new but minimal -- the runChain loop,
 * the gate, the trace, the journal all pre-exist; this is the one wrapper the
 * onStep dispatch needed to stop a transient hiccup from discarding the chain.
 *
 * House rule: hyphens only, no em-dashes.
 */

// The CLOSED set of transient remote codes (EXEC-05 / D-166-01). 501 / 504 are
// deliberately OUT: a Not-Implemented or a Gateway-Timeout is not the
// transient-overload class SEED-028 targets. Frozen so no caller can widen it.
const TRANSIENT_CODES = Object.freeze([500, 502, 503, 529]);

// Default bounded-retry knobs. The terminal synthesis step (the SEED-028
// failure surface) defaults to a small bounded retry; callers may tune.
const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 4000;

// ---------------------------------------------------------------------------
// _extractCode: pull a numeric status from an error object via the three
// recognized channels (.status, .statusCode, a parseable .message). Returns a
// number or null. No throw on a malformed input.
// ---------------------------------------------------------------------------
function _extractCode(err) {
  if (!err || typeof err !== 'object') return null;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  // Some clients stash the status as a string; coerce a clean integer string.
  if (typeof err.status === 'string' && /^\d{3}$/.test(err.status.trim())) {
    return parseInt(err.status.trim(), 10);
  }
  if (typeof err.statusCode === 'string' && /^\d{3}$/.test(err.statusCode.trim())) {
    return parseInt(err.statusCode.trim(), 10);
  }
  // Fall back to a regex over the message: a standalone 3-digit token. We scan
  // only for the known transient codes so an unrelated "404" in prose elsewhere
  // does not accidentally classify a different error as one of the four.
  if (typeof err.message === 'string') {
    for (const code of TRANSIENT_CODES) {
      // word-boundary match so "5000" does not match "500"
      const re = new RegExp('(^|[^0-9])' + code + '([^0-9]|$)');
      if (re.test(err.message)) return code;
    }
  }
  return null;
}

/**
 * isTransient(err) -> boolean
 * true ONLY for the four named transient codes 500 / 502 / 503 / 529.
 * @param {*} err
 * @returns {boolean}
 */
function isTransient(err) {
  const code = _extractCode(err);
  if (code === null) return false;
  return TRANSIENT_CODES.indexOf(code) !== -1;
}

// ---------------------------------------------------------------------------
// _computeDelay: exponential-with-cap. attempt is 0-based (the delay BEFORE the
// (attempt+1)-th retry). baseDelayMs * 2^attempt, capped at maxDelayMs. Pure and
// deterministic -- NO Math.random jitter (the tests assert exact values, and the
// bound is what T-166-09 needs).
// ---------------------------------------------------------------------------
function _computeDelay(attempt, baseDelayMs, maxDelayMs) {
  const grown = baseDelayMs * Math.pow(2, attempt);
  return grown > maxDelayMs ? maxDelayMs : grown;
}

// The default real-timer sleep. Tests inject a no-op recorder instead.
function _defaultSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Build the exhaustion marker carrying the LAST transient code so the caller
// (runChain) can name the code in its graceful-partial failure marker.
function _exhaustionMarker(lastCode, attempts, lastError) {
  return {
    exhausted: true,
    code: lastCode,
    attempts: attempts,
    reason: 'transient_retry_exhausted',
    lastError: (lastError && lastError.message) ? String(lastError.message) : null,
  };
}

/**
 * withBackoff(fn, opts) -> Promise<result | marker>
 *
 * opts:
 *   retries                number of RETRIES after the first attempt (default 3)
 *   baseDelayMs            base delay (default 250)
 *   maxDelayMs             cap on the exponential delay (default 4000)
 *   sleep                  injectable (ms) -> void|Promise (default real timer)
 *   returnMarkerOnExhaust  when true, RESOLVES with the exhaustion marker on
 *                          exhaustion instead of throwing it. Default false
 *                          (throws the marker, so an unaware caller still sees a
 *                          failure rather than a silent success).
 *
 * Behavior:
 *   - fn succeeds            -> resolve with fn's return value.
 *   - fn throws transient    -> sleep an exponential-with-cap delay and retry,
 *                               up to `retries` times.
 *   - fn throws non-transient-> rethrow IMMEDIATELY (fail fast; no retry).
 *   - exhaustion             -> return (returnMarkerOnExhaust) or throw an
 *                               exhaustion marker naming the last code.
 *
 * @param {Function} fn
 * @param {object} [opts]
 * @returns {Promise<*>}
 */
async function withBackoff(fn, opts) {
  const o = opts || {};
  const retries = (typeof o.retries === 'number' && o.retries >= 0)
    ? Math.floor(o.retries)
    : DEFAULT_RETRIES;
  const baseDelayMs = (typeof o.baseDelayMs === 'number' && o.baseDelayMs >= 0)
    ? o.baseDelayMs
    : DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = (typeof o.maxDelayMs === 'number' && o.maxDelayMs >= 0)
    ? o.maxDelayMs
    : DEFAULT_MAX_DELAY_MS;
  const sleep = (typeof o.sleep === 'function') ? o.sleep : _defaultSleep;
  const returnMarkerOnExhaust = o.returnMarkerOnExhaust === true;

  let attempts = 0;
  let lastError = null;
  let lastCode = null;

  // The loop runs at most retries+1 times (BOUNDED, T-166-09): the initial
  // attempt plus `retries` retries.
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    attempts += 1;
    try {
      // fn may be sync or async; awaiting a non-promise is a no-op.
      const value = await fn();
      return value;
    } catch (err) {
      lastError = err;
      if (!isTransient(err)) {
        // FAIL FAST: a non-transient error is rethrown on the first sight
        // (no retry, no sleep). T-166-11.
        throw err;
      }
      lastCode = _extractCode(err);
      // If we have retries left, sleep an exponential-with-cap delay then loop.
      if (attempt < retries) {
        const delay = _computeDelay(attempt, baseDelayMs, maxDelayMs);
        await sleep(delay);
        continue;
      }
      // No retries left -- exhausted.
    }
  }

  // Exhaustion: build the marker naming the last transient code.
  const marker = _exhaustionMarker(lastCode, attempts, lastError);
  if (returnMarkerOnExhaust) return marker;

  // Default: throw the marker (an Error decorated with the marker fields) so an
  // unaware caller sees a failure rather than a silent success.
  const e = new Error('transient retry exhausted after ' + attempts + ' attempts (last code ' + lastCode + ')');
  e.exhausted = true;
  e.code = lastCode;
  e.attempts = attempts;
  e.reason = 'transient_retry_exhausted';
  e.marker = marker;
  throw e;
}

module.exports = {
  isTransient: isTransient,
  withBackoff: withBackoff,
  TRANSIENT_CODES: TRANSIENT_CODES,
  DEFAULT_RETRIES: DEFAULT_RETRIES,
  DEFAULT_BASE_DELAY_MS: DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_DELAY_MS: DEFAULT_MAX_DELAY_MS,
};
