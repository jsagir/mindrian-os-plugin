/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 03 -- Patents external-egress fetcher.
 * Phase 94 Plan 05 amendment (2026-04-28): envelope wrap only.
 * Free-tier paths (google_patents / uspto) preserved byte-identical;
 * the wrap layer adds {tier, source, results} on top of the existing
 * {patents, telemetry} return. tier='paid' annotates that a real
 * keyless API tier produced data; backward-compat patents[] key is
 * preserved for downstream consumers. Per Canon Part 4 the tier
 * annotation feeds the section-8 trace web_research_tier field; per
 * Canon Part 7 envelope wrap reuses the existing Phase 89.2 fetcher.
 *
 * Two sources covered with one Canon Part 8 chokepoint:
 *   google_patents   no API key   patents.google.com search-as-html;
 *                                  parser scrapes JSON-LD <script> tags
 *                                  (no cheerio; pure regex extraction)
 *   uspto            no API key   USPTO Open Data Portal search API;
 *                                  returns JSON
 *
 * Single chokepoint: buildPatentsQuery(query, source, opts) is the ONLY
 * function that constructs an outbound URL. Every call invokes
 * auditQueryString(query, 'patents') from rs-egress-prompts.cjs BEFORE
 * the URL is returned. ExternalEgressViolation throws pre-egress on any
 * FORBIDDEN_PATTERNS hit, so adversarial input never reaches the wire.
 *
 * Per-source rate-limit graceful degradation per Phase 88.6-03 pattern
 * (mirrors lib/core/rs-fetcher-academic.cjs byte-for-byte):
 *   429 / 503 -> recordTelemetry(status='rate_limited') + return empty
 *                for that source + continue with remaining sources
 *   timeout   -> recordTelemetry(status='timeout') + continue
 *   parse err -> recordTelemetry(status='api_error') + continue
 *   budget==0 -> skip source (synthetic 'budget_exhausted' on returned
 *                telemetry; not in v1 ALLOWED_STATUSES so not persisted)
 *
 * NEVER throws on rate-limit. ONLY throws on Canon Part 8 violation.
 *
 * Network: native Node 18+ global fetch. AbortController gives a per-request
 * 10s default timeout. NO node-fetch, NO axios, NO cheerio, NO additional
 * npm dep.
 *
 * Output shape per patent (after dedupe):
 *   { patent_id, title, abstract, inventors[], assignee, filing_date,
 *     source, fetched_at }
 *
 * Pure CJS, zero npm deps, node built-ins only beyond the three rs-egress-*
 * primitives shipped in Wave 1 (Plan 89.2-01).
 *
 * 2026 package changes (all additive; see rs/CHANGES-commands.md):
 *   - provenance on every record: source_id, source_url, retrieved_at,
 *     retrieval_query, retrieval_method, provenance{}; envelope provenance block
 *   - patent numbers are canonicalised before dedupe ("US 7,654,321 B2" and
 *     "US7654321" are one patent; kind codes are ignored for identity)
 *   - bounded retry with Retry-After, per-source pacing, body read under the
 *     timeout, per-run budget enforced per request
 *   - opts.disableScraping (or env RS_PATENTS_NO_SCRAPE=1) skips the
 *     google_patents HTML path for operators who must not scrape; default off,
 *     so behaviour is unchanged unless asked
 *   - UNVERIFIED (cannot be tested offline): the USPTO endpoint below is named
 *     "oa_actions" (Office Action records) and the legacy ds-api host has been
 *     retired by the USPTO; confirm it still serves patent search before relying
 *     on the uspto source. Failures surface as api_error telemetry, not silently.
 */
'use strict';

const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryString } = require('./rs-egress-prompts.cjs');
const {
  recordTelemetry,
  computeRemainingBudget,
  DEFAULT_BUDGETS,
} = require('./rs-egress-telemetry.cjs');

// ---------- Frozen invariants ----------

// Iteration order is deliberate: google_patents first because Google's
// canonicalized patent_id is the strongest dedupe signal. uspto second
// so its records back-fill any patents Google misses on the first sweep.
const SOURCES = Object.freeze(['google_patents', 'uspto']);

// Both sources are no-key. Object kept for parity with the academic
// fetcher pattern; consumers MUST NOT depend on its emptiness because
// future paid patents APIs (Patsnap, Derwent) may add env-gated rows.
const SOURCE_ENV_VARS = Object.freeze({});

const DEFAULT_TIMEOUT_MS = 10000;

const USER_AGENT = 'MindrianOS-Plugin/1.11.0 (https://github.com/jsagir/mindrian-os-plugin)';

// Per-source endpoint base URLs.
const ENDPOINTS = Object.freeze({
  google_patents: 'https://patents.google.com/',
  uspto: 'https://api.uspto.gov/ds-api/oa_actions/v1/records',
});

// Minimum milliseconds between consecutive requests to the same source.
const MIN_INTERVAL_MS = Object.freeze({ google_patents: 2000, uspto: 1000 });

// ---------- 2026 additions: pacing, retry, redaction (shared shape across the three fetchers) ----------
//
// Deterministic by design: no jitter, no Math.random. Callers may inject
// opts.sleep (async fn) and opts.now (fn returning ms) so tests never wait on
// real time. opts.maxRetries = 0 restores the legacy single-attempt behaviour;
// opts.minIntervalMs = 0 disables pacing.

const TOOL_ID = 'rs-fetch/2026.1';
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15000;
const RETRYABLE_STATUS = Object.freeze([429, 502, 503, 504]);

const _lastRequestAt = new Map();

function _sleepReal(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Retry-After may be delta-seconds or an HTTP date. Returns ms or null.
function parseRetryAfterMs(headers, nowMs) {
  if (!headers) return null;
  let v = null;
  if (typeof headers.get === 'function') v = headers.get('retry-after');
  else if (typeof headers === 'object') v = (headers['retry-after'] !== undefined) ? headers['retry-after'] : headers['Retry-After'];
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return Math.max(0, t - nowMs);
}

function backoffMs(attempt, retryAfterMs) {
  if (typeof retryAfterMs === 'number') return retryAfterMs;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, attempt));
}

// Honour the per-source minimum interval between consecutive requests.
async function paceSource(source, opts) {
  const o = opts || {};
  const sleep = (typeof o.sleep === 'function') ? o.sleep : _sleepReal;
  const now = (typeof o.now === 'function') ? o.now : Date.now;
  let interval = MIN_INTERVAL_MS[source] || 0;
  if (typeof o.minIntervalMs === 'number' && o.minIntervalMs >= 0) interval = o.minIntervalMs;
  const last = _lastRequestAt.get(source);
  if (interval > 0 && last !== undefined) {
    const wait = last + interval - now();
    if (wait > 0) await sleep(wait);
  }
  _lastRequestAt.set(source, now());
}

// Strip credentials from a URL before it is stored, logged or put in provenance.
function redactUrl(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/([?&](?:api[_-]?key|apikey|key|token|access_token)=)[^&#]*/gi, '$1REDACTED');
}

// One logical request with bounded retry. Never throws for network, timeout,
// HTTP or parse failures: it returns {kind, attempts, ...}.
//   kind: 'ok' (res, payload) | 'http' (res) | 'parse_error' (res)
//         | 'timeout' | 'network_error'
// The timeout covers the body read as well as the headers. The body of a
// non-2xx response is never read.
async function requestWithRetry(built, source, readAs, opts, noRetryIf) {
  const o = opts || {};
  const timeoutMs = (typeof o.timeoutMs === 'number') ? o.timeoutMs : DEFAULT_TIMEOUT_MS;
  const maxRetries = (typeof o.maxRetries === 'number' && o.maxRetries >= 0)
    ? Math.min(Math.floor(o.maxRetries), 5) : DEFAULT_MAX_RETRIES;
  const sleep = (typeof o.sleep === 'function') ? o.sleep : _sleepReal;
  const now = (typeof o.now === 'function') ? o.now : Date.now;

  for (let attempt = 0; ; attempt += 1) {
    await paceSource(source, o);
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    let outcome;
    try {
      const res = await fetchWithTimeout(built, Object.assign({}, o, { _controller: controller }));
      if (!res.ok) {
        outcome = { kind: 'http', res: res };
      } else {
        try {
          const payload = (readAs === 'text') ? await res.text() : await res.json();
          outcome = { kind: 'ok', res: res, payload: payload };
        } catch (readErr) {
          if (readErr && readErr.name === 'AbortError') throw readErr;
          outcome = { kind: 'parse_error', res: res };
        }
      }
    } catch (err) {
      outcome = { kind: (err && err.name === 'AbortError') ? 'timeout' : 'network_error' };
    } finally {
      clearTimeout(timer);
    }
    outcome.attempts = attempt + 1;

    let retry = false;
    let retryAfter = null;
    if (outcome.kind === 'timeout' || outcome.kind === 'network_error') {
      retry = true;
    } else if (outcome.kind === 'http' && RETRYABLE_STATUS.indexOf(outcome.res.status) >= 0) {
      retry = true;
      retryAfter = parseRetryAfterMs(outcome.res.headers, now());
      if (typeof noRetryIf === 'function' && noRetryIf(outcome.res)) retry = false;
    }
    if (!retry || attempt >= maxRetries) return outcome;
    const wait = backoffMs(attempt, retryAfter);
    if (wait > MAX_BACKOFF_MS) return outcome; // server asked for a longer pause than we will hold
    await sleep(wait);
  }
}

// ---------- buildPatentsQuery (THE chokepoint) ----------
//
// This is the ONLY function in the module that constructs an outbound URL.
// Every per-source dispatcher invokes it. auditQueryString runs before the
// URL is returned, so adversarial input throws ExternalEgressViolation
// pre-egress and the URL is never built (and never reaches fetch()).
//
// Returns one of:
//   { skip: true,  reason: 'api_key_missing' }   when env var absent for gated source
//   { skip: false, url, headers, method, source } when ready to fetch
//
// Throws:
//   TypeError                if query is not a non-empty string or source unknown
//   ExternalEgressViolation  if query matches FORBIDDEN_PATTERNS

function buildPatentsQuery(query, source, opts) {
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new TypeError('buildPatentsQuery: query must be a non-empty string');
  }
  if (!SOURCES.includes(source)) {
    throw new TypeError('buildPatentsQuery: unknown source: ' + String(source));
  }

  // Canon Part 8 chokepoint: throws on adversarial query BEFORE URL build.
  auditQueryString(query, 'patents');

  // Env-var gate for paid sources (none today; preserved for shape parity).
  const envVar = SOURCE_ENV_VARS[source];
  if (envVar && !process.env[envVar]) {
    return { skip: true, reason: 'api_key_missing' };
  }

  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': source === 'google_patents' ? 'text/html' : 'application/json',
  };

  const encoded = encodeURIComponent(query);
  let url;
  switch (source) {
    case 'google_patents': {
      // No-key path: HTML response carrying JSON-LD <script> tags. The
      // ?q + ?oq pair mirrors what patents.google.com search uses; the
      // parser is regex-based so the HTML/JSON-LD shape is the contract.
      url = ENDPOINTS.google_patents
        + '?q=' + encoded
        + '&oq=' + encoded;
      break;
    }
    case 'uspto': {
      // USPTO Open Data Portal. JSON response. ~50 req/day budget per
      // 89.2-CONTEXT.md. No API key for basic search.
      url = ENDPOINTS.uspto
        + '?searchText=' + encoded;
      break;
    }
    default:
      // SOURCES list is frozen; this path is unreachable but the linter
      // appreciates the explicit fallthrough.
      throw new TypeError('buildPatentsQuery: unhandled source: ' + source);
  }

  return { skip: false, url: url, safe_url: redactUrl(url), headers: headers, method: 'GET', source: source };
}

// ---------- fetchWithTimeout (the ONE native fetch call site) ----------
//
// Per the chokepoint exclusivity rule: every per-source dispatcher routes
// through this helper. This is the only place that touches global.fetch.
// Returns the raw Response on success; throws on network error or timeout.

async function fetchWithTimeout(built, opts) {
  const timeoutMs = (opts && typeof opts.timeoutMs === 'number') ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  // 2026: requestWithRetry passes its own controller so the timer also covers
  // the response body read. Standalone callers keep the legacy behaviour.
  const external = (opts && opts._controller) ? opts._controller : null;
  const controller = external || new AbortController();
  const t = external ? null : setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    const res = await fetch(built.url, {
      method: built.method,
      headers: built.headers,
      signal: controller.signal,
    });
    return res;
  } finally {
    if (t) clearTimeout(t);
  }
}

// ---------- parseRateLimit ----------
//
// Pulls a remaining-budget signal out of common HTTP headers. Returns
// undefined if absent. The shape varies per source so we probe a few names.

function parseRateLimit(headers) {
  if (!headers) return undefined;
  const probes = ['x-ratelimit-remaining', 'X-RateLimit-Remaining', 'ratelimit-remaining'];
  for (const k of probes) {
    let v;
    if (typeof headers.get === 'function') {
      v = headers.get(k);
    } else if (Object.prototype.hasOwnProperty.call(headers, k)) {
      v = headers[k];
    }
    if (v !== undefined && v !== null) {
      const n = parseInt(String(v), 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

// ---------- Dedup key + dedupe ----------
//
// patent_id is canonical (USPTO + Google Patents both emit the same
// patent_id for the same patent). First-seen wins so SOURCES iteration
// order determines tie-breaking; google_patents iterates first.

// Canonical patent identity: uppercase, no spaces/commas/slashes/hyphens/dots.
// "US 7,654,321 B2" -> "US7654321B2".
function normalizePatentId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/[\s,./\\-]+/g, '');
}

// Identity ignores the kind code (A1, B2, ...) because the same patent family
// member is published under several of them: "US7654321B2" -> "US7654321".
function patentIdentity(raw) {
  const id = normalizePatentId(raw);
  if (!id) return '';
  const m = id.match(/^([A-Z]{2}\d{5,})[A-Z]\d?$/);
  return m ? m[1] : id;
}

function dedupKey(p) {
  const ident = patentIdentity(p && p.patent_id);
  if (ident) {
    return 'patent:' + ident;
  }
  // Defensive fallback: title + first-inventor lastname. Should never
  // be needed for real responses but keeps dedupe deterministic on
  // malformed inputs.
  const titleNorm = (p && typeof p.title === 'string')
    ? p.title.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
  let firstInventor = '';
  if (p && Array.isArray(p.inventors) && p.inventors.length > 0) {
    const a = String(p.inventors[0] || '');
    const parts = a.split(/[\s,]+/);
    firstInventor = parts.length > 0 ? parts[0].toLowerCase() : '';
  }
  if (titleNorm) {
    return 'title:' + titleNorm + '|' + firstInventor;
  }
  return 'unknown:' + JSON.stringify(p || {});
}

// First-seen wins. A later duplicate contributes its source to also_found_in[]
// and back-fills empty abstract/assignee/filing_date on the survivor.
function dedupe(patents) {
  const seen = new Map();
  const out = [];
  for (const p of patents) {
    const key = dedupKey(p);
    if (seen.has(key)) {
      const keep = out[seen.get(key)];
      if (keep && p && typeof p === 'object') {
        if (p.source && p.source !== keep.source) {
          if (!Array.isArray(keep.also_found_in)) keep.also_found_in = [];
          if (keep.also_found_in.indexOf(p.source) < 0) keep.also_found_in.push(p.source);
        }
        for (const f of ['abstract', 'assignee', 'filing_date']) {
          if (!keep[f] && p[f]) keep[f] = p[f];
        }
      }
      continue;
    }
    seen.set(key, out.length);
    out.push(p);
  }
  return out;
}

// ---------- Per-source response parsers ----------

// Google Patents: HTML with embedded JSON-LD <script type="application/ld+json">
// blocks carrying patent metadata. Pure regex extraction; no cheerio.
//
// Throws on a completely empty body (treated as api_error upstream); returns
// [] when no JSON-LD blocks are found (graceful: the page rendered but had
// no @type=Patent records).

function parseGooglePatentsResponse(htmlText) {
  const out = [];
  if (typeof htmlText !== 'string' || htmlText.length === 0) {
    throw new Error('google_patents: empty body');
  }
  // 2026: tolerate extra attributes on the script tag and JSON-LD arrays or
  // @graph wrappers (the original matched only the bare tag and a single object).
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(htmlText)) !== null) {
    let parsedJson = null;
    try {
      parsedJson = JSON.parse(m[1]);
    } catch (_e) {
      continue;
    }
    const candidates = [];
    if (Array.isArray(parsedJson)) candidates.push.apply(candidates, parsedJson);
    else if (parsedJson && Array.isArray(parsedJson['@graph'])) candidates.push.apply(candidates, parsedJson['@graph']);
    else candidates.push(parsedJson);
    for (const obj of candidates) {
      if (!obj || typeof obj !== 'object') continue;
      if (obj['@type'] !== 'Patent' && obj['@type'] !== 'Product') continue;
      const inventors = [];
      if (Array.isArray(obj.inventor)) {
        for (const inv of obj.inventor.slice(0, 10)) {
          if (inv && typeof inv === 'object' && typeof inv.name === 'string') {
            inventors.push(inv.name);
          } else if (typeof inv === 'string') {
            inventors.push(inv);
          }
        }
      }
      let assignee = '';
      if (obj.assignee && typeof obj.assignee === 'object' && typeof obj.assignee.name === 'string') {
        assignee = obj.assignee.name;
      } else if (typeof obj.assignee === 'string') {
        assignee = obj.assignee;
      }
      out.push({
        patent_id: typeof obj.patentNumber === 'string' ? obj.patentNumber : '',
        title: typeof obj.name === 'string' ? obj.name : '',
        abstract: typeof obj.description === 'string' ? obj.description : '',
        inventors: inventors,
        assignee: assignee,
        filing_date: typeof obj.filingDate === 'string' ? obj.filingDate : '',
        source: 'google_patents',
        fetched_at: new Date().toISOString(),
        source_id: typeof obj.patentNumber === 'string' ? obj.patentNumber : '',
        source_url: (typeof obj.url === 'string' && obj.url) ? obj.url
          : (typeof obj.patentNumber === 'string' && obj.patentNumber
            ? 'https://patents.google.com/patent/' + encodeURIComponent(normalizePatentId(obj.patentNumber)) : ''),
        retrieval_method: 'html_jsonld',
      });
    }
  }
  return out;
}

// USPTO: JSON response with results[] (or records[] in legacy variants).
// Each record carries patentNumber + patentTitle + patentAbstract +
// inventorName[] + assigneeEntityName + filingDate.

function parseUsptoResponse(json) {
  const out = [];
  if (!json || typeof json !== 'object') return out;
  // Accept either results[] (modern) or records[] (legacy) array shape.
  const records = Array.isArray(json.results) ? json.results
    : (Array.isArray(json.records) ? json.records : []);
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    let inventors = [];
    if (Array.isArray(r.inventorName)) {
      inventors = r.inventorName.slice(0, 10).map(String);
    } else if (typeof r.inventorName === 'string') {
      inventors = [r.inventorName];
    }
    out.push({
      patent_id: typeof r.patentNumber === 'string' ? r.patentNumber : '',
      title: typeof r.patentTitle === 'string' ? r.patentTitle : '',
      abstract: typeof r.patentAbstract === 'string' ? r.patentAbstract : '',
      inventors: inventors,
      assignee: typeof r.assigneeEntityName === 'string' ? r.assigneeEntityName : '',
      filing_date: typeof r.filingDate === 'string' ? r.filingDate : '',
      source: 'uspto',
      fetched_at: new Date().toISOString(),
      source_id: typeof r.patentNumber === 'string' ? r.patentNumber : '',
      source_url: typeof r.patentNumber === 'string' && r.patentNumber
        ? 'https://patents.google.com/patent/' + encodeURIComponent(normalizePatentId(r.patentNumber)) : '',
      retrieval_method: 'api_json',
    });
  }
  return out;
}

function parseSourceResponse(payload, source) {
  switch (source) {
    case 'google_patents': return parseGooglePatentsResponse(payload);
    case 'uspto': return parseUsptoResponse(payload);
    default: return [];
  }
}

// ---------- normalizePatent ----------
//
// Final shape guarantee. Per-source parsers already produce this shape
// but normalizePatent is exposed so future call sites can canonicalize
// hand-constructed records.

const ADDITIVE_PATENT_FIELDS = Object.freeze([
  'source_id', 'source_url', 'retrieved_at', 'retrieval_query', 'retrieval_method',
  'provenance', 'also_found_in',
]);

function normalizePatent(raw) {
  const base = {
    patent_id: raw && raw.patent_id ? String(raw.patent_id) : '',
    title: raw && raw.title ? String(raw.title) : '',
    abstract: raw && raw.abstract ? String(raw.abstract) : '',
    inventors: raw && Array.isArray(raw.inventors) ? raw.inventors.slice(0, 10).map(String) : [],
    assignee: raw && raw.assignee ? String(raw.assignee) : '',
    filing_date: raw && raw.filing_date ? String(raw.filing_date) : '',
    source: raw && raw.source ? String(raw.source) : '',
    fetched_at: raw && raw.fetched_at ? String(raw.fetched_at) : new Date().toISOString(),
  };
  if (raw && typeof raw === 'object') {
    for (const f of ADDITIVE_PATENT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(raw, f)) base[f] = raw[f];
    }
  }
  return base;
}

// ---------- fetchPatents ----------
//
// Top-level orchestrator. Iterates SOURCES in frozen order; per source
// iterates the input queries. Per (source, query) tuple:
//   1. Check budget. budget==0 -> skip source for this run.
//   2. Build query via chokepoint (throws ExternalEgressViolation on adversarial).
//   3. If skip (api_key_missing) -> recordTelemetry + continue.
//   4. fetchWithTimeout -> on timeout: recordTelemetry + continue.
//   5. status 429/503 -> recordTelemetry(rate_limited) + continue.
//   6. parse response. parse error -> recordTelemetry(api_error) + continue.
//   7. recordTelemetry(ok) + accumulate patents.
// After all sources, dedupe and return.

async function fetchPatents(queries, opts) {
  if (!Array.isArray(queries)) {
    throw new TypeError('fetchPatents: queries must be an array of non-empty strings');
  }
  for (const q of queries) {
    if (typeof q !== 'string' || q.trim().length === 0) {
      throw new TypeError('fetchPatents: each query must be a non-empty string');
    }
  }
  opts = opts || {};
  const budgetOverrides = opts.budget || {};

  // Pre-flight Canon Part 8 audit: scan ALL queries before iterating sources.
  // Without this, an adversarial query in position N would run sources for
  // queries 0..N-1 first (issuing real fetch() calls), then throw on N. The
  // tests assert ZERO captured URLs on adversarial input, so the audit must
  // happen before any source loop runs.
  for (const q of queries) {
    auditQueryString(q, 'patents');
  }
  const queryList = queries.filter(function (q, i) { return queries.indexOf(q) === i; });
  const noScrape = opts.disableScraping === true || process.env.RS_PATENTS_NO_SCRAPE === '1';

  const out = { patents: [], telemetry: [] };
  const sourcesAttempted = [];
  let rawCount = 0;

  for (const source of SOURCES) {
    if (source === 'google_patents' && noScrape) {
      out.telemetry.push({ source: source, status: 'disabled' });
      continue;
    }
    const budgetCap = (typeof budgetOverrides[source] === 'number')
      ? budgetOverrides[source]
      : DEFAULT_BUDGETS[source];
    const remaining = computeRemainingBudget(source, budgetCap);
    if (remaining <= 0) {
      // Skip source for this run; budget itself is the trace. We do NOT
      // call recordTelemetry here (status 'budget_exhausted' is not in
      // ALLOWED_STATUSES for the v1 telemetry primitive).
      out.telemetry.push({ source: source, status: 'budget_exhausted' });
      continue;
    }

    let used = 0;
    for (const query of queryList) {
      if (used >= remaining) {
        out.telemetry.push({ source: source, status: 'budget_exhausted' });
        break;
      }
      const built = buildPatentsQuery(query, source, opts);

      if (built.skip) {
        recordTelemetry({ source: source, query_text: query, status: built.reason });
        out.telemetry.push({ source: source, status: built.reason });
        break;
      }

      if (sourcesAttempted.indexOf(source) < 0) sourcesAttempted.push(source);
      used += 1;

      const r = await requestWithRetry(built, source, (source === 'google_patents') ? 'text' : 'json', opts);

      if (r.kind === 'timeout' || r.kind === 'network_error') {
        recordTelemetry({ source: source, query_text: query, status: r.kind });
        out.telemetry.push({ source: source, status: r.kind, attempts: r.attempts });
        continue;
      }

      if (r.kind === 'http') {
        const httpStatus = r.res.status || 0;
        if (httpStatus === 429 || httpStatus === 503) {
          recordTelemetry({ source: source, query_text: query, status: 'rate_limited', http_status: httpStatus });
          out.telemetry.push({ source: source, status: 'rate_limited', http_status: httpStatus, attempts: r.attempts });
          continue;
        }
        recordTelemetry({ source: source, query_text: query, status: 'api_error', http_status: httpStatus });
        out.telemetry.push({ source: source, status: 'api_error', http_status: httpStatus, attempts: r.attempts });
        continue;
      }

      let parsed = null;
      if (r.kind === 'ok') {
        try {
          parsed = parseSourceResponse(r.payload, source);
        } catch (_err) {
          parsed = null;
        }
      }
      if (parsed === null) {
        const st = (r.res && r.res.status) || 0;
        recordTelemetry({ source: source, query_text: query, status: 'api_error', http_status: st });
        out.telemetry.push({ source: source, status: 'api_error', http_status: st, attempts: r.attempts });
        continue;
      }

      const res = r.res;
      const rateRemaining = parseRateLimit(res.headers);
      const recOpts = {
        source: source,
        query_text: query,
        status: 'ok',
        http_status: res.status || 200,
      };
      if (typeof rateRemaining === 'number') {
        recOpts.rate_limit_remaining = rateRemaining;
      }
      recordTelemetry(recOpts);
      out.telemetry.push({ source: source, status: 'ok', http_status: res.status || 200, attempts: r.attempts, records: parsed.length });

      for (const p of parsed) {
        p.retrieved_at = p.fetched_at;
        p.retrieval_query = query;
        p.provenance = {
          source: source,
          source_id: p.source_id || '',
          source_url: p.source_url || '',
          retrieved_at: p.fetched_at,
          query: query,
          endpoint: ENDPOINTS[source],
          method: p.retrieval_method || '',
          tool: TOOL_ID,
        };
        out.patents.push(p);
        rawCount += 1;
      }
    }
  }

  // First-seen wins on dedupe; google_patents ran first so it wins
  // patent_id ties.
  out.patents = dedupe(out.patents);

  // ---- Phase 94 Plan 05 amendment: envelope wrap ----
  let source = SOURCES[0];
  for (const t of out.telemetry) {
    if (t && t.status === 'ok' && typeof t.source === 'string') {
      source = t.source;
      break;
    }
  }
  return {
    tier: 'paid',
    source: source,
    results: out.patents.slice(),
    patents: out.patents,
    telemetry: out.telemetry,
    provenance: {
      tool: TOOL_ID,
      retrieved_at: new Date().toISOString(),
      queries: queryList.slice(),
      sources_attempted: sourcesAttempted,
      params: {
        timeout_ms: (typeof opts.timeoutMs === 'number') ? opts.timeoutMs : DEFAULT_TIMEOUT_MS,
        max_retries: (typeof opts.maxRetries === 'number') ? opts.maxRetries : DEFAULT_MAX_RETRIES,
        min_interval_ms: MIN_INTERVAL_MS,
        scraping_disabled: noScrape,
      },
      dedupe: {
        input_count: rawCount,
        output_count: out.patents.length,
        merged_count: rawCount - out.patents.length,
      },
    },
  };
}

// ---------- Per-source dispatchers ----------
//
// Convenience entry points for callers that want one source. Both
// route through fetchPatents internally (limiting SOURCES to the one
// requested) so the chokepoint exclusivity rule is preserved.

async function fetchOneSource(source, queries, opts) {
  const orig = SOURCES.slice();
  // Build a one-source orchestrator by delegating to fetchPatents with
  // a budget map that zeroes out every other source. This keeps the
  // chokepoint exclusivity invariant intact (no new fetch sites).
  opts = opts || {};
  const budget = Object.assign({}, opts.budget || {});
  for (const s of orig) {
    if (s !== source) budget[s] = 0;
  }
  const merged = Object.assign({}, opts, { budget: budget });
  return fetchPatents(queries, merged);
}

async function fetchGooglePatents(queries, opts) { return fetchOneSource('google_patents', queries, opts); }
async function fetchUspto(queries, opts) { return fetchOneSource('uspto', queries, opts); }

// ---------- Exports ----------

module.exports = {
  fetchPatents,
  buildPatentsQuery,
  fetchGooglePatents,
  fetchUspto,
  // Test surface (private; do NOT consume in production).
  _test: {
    dedupe,
    dedupKey,
    normalizePatent,
    fetchWithTimeout,
    parseSourceResponse,
    parseGooglePatentsResponse,
    parseUsptoResponse,
    parseRateLimit,
    normalizePatentId,
    patentIdentity,
    requestWithRetry,
    parseRetryAfterMs,
    redactUrl,
    MIN_INTERVAL_MS,
    SOURCES,
    SOURCE_ENV_VARS,
    ENDPOINTS,
    DEFAULT_TIMEOUT_MS,
    USER_AGENT,
  },
};
