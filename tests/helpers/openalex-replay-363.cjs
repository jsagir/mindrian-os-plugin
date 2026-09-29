'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 02 Task 2 -- OpenAlex replay fetch. Test infrastructure only;
 * no test ever needs the network.
 *
 * makeReplayFetch({ route, bodies?, onCall?, budgetUsd? }) -> async fetch(url, init)
 *   with `.calls` (the recorder) and `.violations`.
 *   route(q, url) returns a response id: one of the keys of
 *   tests/fixtures/363-openalex/bodies.json, or a SENTINEL below.
 *   The `search` query parameter is decoded to q.
 *
 * SENTINELS:
 *   SENTINEL_429_BUDGET -> status 429, header x-ratelimit-remaining-usd 0
 *   SENTINEL_500        -> status 500
 *   SENTINEL_TIMEOUT    -> rejects with an error named AbortError
 *   SENTINEL_NETWORK    -> rejects with TypeError "fetch failed"
 *
 * Recorder: every call is stored as { url, q, has_auth, headers_seen,
 * key_in_url }. It stores header NAMES and a has_auth boolean only; an
 * Authorization value is never stored, and an api_key= value inside the URL is
 * redacted before the URL is recorded. A URL carrying api_key= is flagged
 * key_in_url: true and pushed onto `.violations`.
 *
 * writeReplayPreload(dir, { routeModulePath }) writes a preload file (for
 * `node -r`) that installs the replay fetch as globalThis.fetch in a spawned
 * child. The default route maps unknown q to gap_primary_zero.
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const BODIES_PATH = path.join(__dirname, '..', 'fixtures', '363-openalex', 'bodies.json');

const SENTINELS = Object.freeze({
  SENTINEL_429_BUDGET: 'SENTINEL_429_BUDGET',
  SENTINEL_500: 'SENTINEL_500',
  SENTINEL_TIMEOUT: 'SENTINEL_TIMEOUT',
  SENTINEL_NETWORK: 'SENTINEL_NETWORK',
});

const LIMIT_USD = 0.1;
const COST_USD = 0.001;

function loadBodies() {
  return JSON.parse(fs.readFileSync(BODIES_PATH, 'utf8'));
}

function headerNames(init) {
  const h = init && init.headers;
  if (!h) return [];
  if (typeof h.forEach === 'function' && typeof h.get === 'function') {
    const out = [];
    h.forEach(function (_v, k) { out.push(String(k).toLowerCase()); });
    return out.sort();
  }
  return Object.keys(h).map(function (k) { return String(k).toLowerCase(); }).sort();
}

function makeHeaders(map) {
  const lower = {};
  Object.keys(map).forEach(function (k) { lower[k.toLowerCase()] = String(map[k]); });
  return {
    get: function (name) {
      const v = lower[String(name).toLowerCase()];
      return v === undefined ? null : v;
    },
  };
}

function makeResponse(status, headers, bodyObj) {
  const text = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
  return {
    ok: status >= 200 && status < 300,
    status: status,
    headers: makeHeaders(headers),
    json: async function () {
      if (bodyObj === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return JSON.parse(text);
    },
    text: async function () { return text; },
  };
}

function makeReplayFetch(opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const route = typeof options.route === 'function' ? options.route : function () { return 'gap_primary_zero'; };
  const bodies = options.bodies && typeof options.bodies === 'object' ? options.bodies : loadBodies();
  const onCall = typeof options.onCall === 'function' ? options.onCall : null;
  let remaining = typeof options.budgetUsd === 'number' ? options.budgetUsd : LIMIT_USD;

  const calls = [];
  const violations = [];

  async function replayFetch(url, init) {
    const urlStr = String(url);
    let q = null;
    try { q = new URL(urlStr).searchParams.get('search'); } catch (_e) { q = null; }
    const keyInUrl = /[?&]api_key=/i.test(urlStr);
    const names = headerNames(init);
    const rec = {
      url: urlStr.replace(/([?&]api_key=)[^&]*/ig, '$1[REDACTED]'),
      q: q,
      has_auth: names.indexOf('authorization') !== -1,
      headers_seen: names,
      key_in_url: keyInUrl,
    };
    calls.push(rec);
    if (keyInUrl) violations.push({ kind: 'key_in_url', q: q });
    if (onCall) onCall(rec);

    const id = route(q, urlStr);

    if (id === SENTINELS.SENTINEL_TIMEOUT) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }
    if (id === SENTINELS.SENTINEL_NETWORK) {
      throw new TypeError('fetch failed');
    }
    if (id === SENTINELS.SENTINEL_429_BUDGET) {
      return makeResponse(429, {
        'x-ratelimit-limit-usd': LIMIT_USD,
        'x-ratelimit-cost-usd': COST_USD,
        'x-ratelimit-remaining-usd': 0,
        'retry-after': 3600,
      }, { error: 'rate limit exceeded', message: 'daily budget exhausted' });
    }
    if (id === SENTINELS.SENTINEL_500) {
      return makeResponse(500, {}, { error: 'internal server error' });
    }
    if (!Object.prototype.hasOwnProperty.call(bodies, id)) {
      throw new Error('openalex-replay-363: no recorded body for response id ' + JSON.stringify(id));
    }
    remaining = Math.max(0, Number((remaining - COST_USD).toFixed(6)));
    return makeResponse(200, {
      'x-ratelimit-limit-usd': LIMIT_USD,
      'x-ratelimit-cost-usd': COST_USD,
      'x-ratelimit-remaining-usd': remaining,
    }, bodies[id]);
  }

  replayFetch.calls = calls;
  replayFetch.violations = violations;
  return replayFetch;
}

/*
 * writeReplayPreload(dir, { routeModulePath }) -> absolute preload file path.
 * A spawned `node -r <preload> ...` sees globalThis.fetch as the replay. The
 * optional routeModulePath is a CJS module exporting route(q, url) -> id.
 */
function writeReplayPreload(dir, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'openalex-replay-preload-363.cjs');
  const helperPath = JSON.stringify(path.join(__dirname, 'openalex-replay-363.cjs'));
  const routeLine = typeof options.routeModulePath === 'string' && options.routeModulePath.length > 0
    ? 'const route = require(' + JSON.stringify(options.routeModulePath) + ');\n'
    : 'const route = function () { return \'gap_primary_zero\'; };\n';
  const body = '\'use strict\';\n'
    + 'const { makeReplayFetch } = require(' + helperPath + ');\n'
    + routeLine
    + 'globalThis.fetch = makeReplayFetch({ route: typeof route === \'function\' ? route : route.route });\n';
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

module.exports = {
  makeReplayFetch: makeReplayFetch,
  writeReplayPreload: writeReplayPreload,
  SENTINELS: SENTINELS,
  BODIES_PATH: BODIES_PATH,
};
