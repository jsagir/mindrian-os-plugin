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
 * auditWebCredential(query, 'patents') from rs-egress-prompts.cjs BEFORE
 * the URL is returned: a credential check (ruling 2026-10-05), not a room-text
 * fence. ExternalEgressViolation throws pre-egress on a Bearer token, an
 * api_key= parameter or a live vendor key value in the query.
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
 */
'use strict';

const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditWebCredential } = require('./rs-egress-prompts.cjs');
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

// ---------- buildPatentsQuery (THE chokepoint) ----------
//
// This is the ONLY function in the module that constructs an outbound URL.
// Every per-source dispatcher invokes it. auditWebCredential runs before the
// URL is returned, so a credential in the query throws ExternalEgressViolation
// pre-egress and the URL is never built (and never reaches fetch()).
//
// Returns one of:
//   { skip: true,  reason: 'api_key_missing' }   when env var absent for gated source
//   { skip: false, url, headers, method, source } when ready to fetch
//
// Throws:
//   TypeError                if query is not a non-empty string or source unknown
//   ExternalEgressViolation  if the query carries a credential (A4 keep)

function buildPatentsQuery(query, source, opts) {
  if (typeof query !== 'string' || query.length === 0) {
    throw new TypeError('buildPatentsQuery: query must be a non-empty string');
  }
  if (!SOURCES.includes(source)) {
    throw new TypeError('buildPatentsQuery: unknown source: ' + String(source));
  }

  // Credential check (ruling 2026-10-05): throws on a key in the query BEFORE
  // URL build. The room's own words are sent as written.
  auditWebCredential(query, 'patents');

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

  return { skip: false, url: url, headers: headers, method: 'GET', source: source };
}

// ---------- fetchWithTimeout (the ONE native fetch call site) ----------
//
// Per the chokepoint exclusivity rule: every per-source dispatcher routes
// through this helper. This is the only place that touches global.fetch.
// Returns the raw Response on success; throws on network error or timeout.

async function fetchWithTimeout(built, opts) {
  const timeoutMs = (opts && typeof opts.timeoutMs === 'number') ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const t = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    const res = await fetch(built.url, {
      method: built.method,
      headers: built.headers,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(t);
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

function dedupKey(p) {
  if (p && typeof p.patent_id === 'string' && p.patent_id.trim().length > 0) {
    return 'patent:' + p.patent_id.trim().toUpperCase();
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

function dedupe(patents) {
  const seen = new Set();
  const out = [];
  for (const p of patents) {
    const key = dedupKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
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
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(htmlText)) !== null) {
    let obj = null;
    try {
      obj = JSON.parse(m[1]);
    } catch (_e) {
      continue;
    }
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
    });
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

function normalizePatent(raw) {
  return {
    patent_id: raw && raw.patent_id ? String(raw.patent_id) : '',
    title: raw && raw.title ? String(raw.title) : '',
    abstract: raw && raw.abstract ? String(raw.abstract) : '',
    inventors: raw && Array.isArray(raw.inventors) ? raw.inventors.slice(0, 10).map(String) : [],
    assignee: raw && raw.assignee ? String(raw.assignee) : '',
    filing_date: raw && raw.filing_date ? String(raw.filing_date) : '',
    source: raw && raw.source ? String(raw.source) : '',
    fetched_at: raw && raw.fetched_at ? String(raw.fetched_at) : new Date().toISOString(),
  };
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
    if (typeof q !== 'string' || q.length === 0) {
      throw new TypeError('fetchPatents: each query must be a non-empty string');
    }
  }
  opts = opts || {};
  const budgetOverrides = opts.budget || {};

  // Pre-flight credential check (ruling 2026-10-05): scan ALL queries before iterating sources.
  // Without this, an adversarial query in position N would run sources for
  // queries 0..N-1 first (issuing real fetch() calls), then throw on N. The
  // tests assert ZERO captured URLs on adversarial input, so the audit must
  // happen before any source loop runs. SOURCES[0] is used as the surface
  // anchor; the throw still carries meta.surface='patents' from the
  // chokepoint helper.
  for (const q of queries) {
    auditWebCredential(q, 'patents');
  }

  const out = { patents: [], telemetry: [] };

  for (const source of SOURCES) {
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

    for (const query of queries) {
      // Build (chokepoint). Throws ExternalEgressViolation if adversarial,
      // but the pre-flight audit above has already cleared every query.
      // Re-running here is defense-in-depth: if a future code path mutates
      // queries between the pre-flight and the loop, this still throws.
      const built = buildPatentsQuery(query, source, opts);

      if (built.skip) {
        // env var missing for gated source.
        recordTelemetry({
          source: source,
          query_text: query,
          status: built.reason,
        });
        out.telemetry.push({ source: source, status: built.reason });
        // No need to keep iterating queries for a source with no key:
        // every query will hit the same gate. Break early to save work.
        break;
      }

      let res = null;
      try {
        res = await fetchWithTimeout(built, opts);
      } catch (err) {
        if (err && err.name === 'AbortError') {
          recordTelemetry({
            source: source,
            query_text: query,
            status: 'timeout',
          });
          out.telemetry.push({ source: source, status: 'timeout' });
          continue;
        }
        recordTelemetry({
          source: source,
          query_text: query,
          status: 'network_error',
        });
        out.telemetry.push({ source: source, status: 'network_error' });
        continue;
      }

      if (!res.ok) {
        const httpStatus = res.status || 0;
        if (httpStatus === 429 || httpStatus === 503) {
          recordTelemetry({
            source: source,
            query_text: query,
            status: 'rate_limited',
            http_status: httpStatus,
          });
          out.telemetry.push({ source: source, status: 'rate_limited', http_status: httpStatus });
          continue;
        }
        recordTelemetry({
          source: source,
          query_text: query,
          status: 'api_error',
          http_status: httpStatus,
        });
        out.telemetry.push({ source: source, status: 'api_error', http_status: httpStatus });
        continue;
      }

      let parsed = null;
      try {
        // google_patents returns HTML; uspto returns JSON.
        const payload = (source === 'google_patents') ? await res.text() : await res.json();
        parsed = parseSourceResponse(payload, source);
      } catch (_err) {
        recordTelemetry({
          source: source,
          query_text: query,
          status: 'api_error',
          http_status: res.status || 0,
        });
        out.telemetry.push({ source: source, status: 'api_error', http_status: res.status || 0 });
        continue;
      }

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
      out.telemetry.push({ source: source, status: 'ok', http_status: res.status || 200 });

      for (const p of parsed) {
        out.patents.push(p);
      }
    }
  }

  // First-seen wins on dedupe; google_patents ran first so it wins
  // patent_id ties.
  out.patents = dedupe(out.patents);

  // ---- Phase 94 Plan 05 amendment: envelope wrap ----
  // Determine source tag from first telemetry row with status:'ok';
  // fall back to SOURCES[0] when no source produced data so the
  // envelope still has a valid source tag.
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
  };
}

// ---------- fetchPatentSearch (Phase 369.2 Plan 25: the keyed real patent source) ----------
//
// PatentsView PatentSearch API (the legacy PatentsView API shut down on 2025-05-01; the new one needs a key).
// Request shape used (from the PatentsView PatentSearch API reference, search.patentsview.org/docs and the
// rOpenSci patentsview "api-changes" page; neither could be fetched on the build machine, see the 369.2-25
// SUMMARY for what was and was not verified):
//   GET https://search.patentsview.org/api/v1/patent/?q=<json>&f=<json array>&o=<json>
//   header X-Api-Key: <key>
//   q  {"_or":[{"_text_any":{"patent_title":"<query>"}},{"_text_any":{"patent_abstract":"<query>"}}]}
//   f  ["patent_id","patent_title","patent_abstract","patent_date","assignees.assignee_organization"]
//   o  {"size": <limit, at most 100>}
//   response {"error":false,"count":N,"total_hits":M,"patents":[{"patent_id":"4902126","patent_title":...,
//             "patent_abstract":...,"patent_date":...,"assignees":[{"assignee_organization":...}]}]}
// Inventor fields are not requested. The key is read from process.env at call time, travels in the header
// only, and is never put in a URL, a telemetry row, a thrown message or a return value. This function does
// not write egress telemetry to disk: it returns its own telemetry rows (status, http_status only).
//
// This is the ONLY patent source the patent lens may reach. google_patents (an HTML scrape) and uspto stay
// exported for their old callers but are not defaults (369.2 A1).

const PATENTSEARCH_ENDPOINT = 'https://search.patentsview.org/api/v1/patent/';
const PATENTSEARCH_FIELDS = Object.freeze([
  'patent_id', 'patent_title', 'patent_abstract', 'patent_date', 'assignees.assignee_organization',
]);
const PATENTSEARCH_MAX_SIZE = 100;

function patentSearchKey() {
  const k = process.env.PATENTSVIEW_API_KEY;
  return (typeof k === 'string' && k.length > 0) ? k : '';
}

// Build the request. Throws TypeError on a bad query and ExternalEgressViolation when the query carries a
// credential (same chokepoint rule as buildPatentsQuery). Returns {skip:true, reason} when no key is set.
function buildPatentSearchRequest(query, opts) {
  if (typeof query !== 'string' || query.length === 0) {
    throw new TypeError('buildPatentSearchRequest: query must be a non-empty string');
  }
  auditWebCredential(query, 'patents');
  const key = patentSearchKey();
  if (!key) return { skip: true, reason: 'api_key_missing' };
  let size = (opts && typeof opts.limit === 'number' && Number.isFinite(opts.limit)) ? Math.floor(opts.limit) : 25;
  if (size < 1) size = 25;
  if (size > PATENTSEARCH_MAX_SIZE) size = PATENTSEARCH_MAX_SIZE;
  const q = {
    _or: [
      { _text_any: { patent_title: query } },
      { _text_any: { patent_abstract: query } },
    ],
  };
  const url = PATENTSEARCH_ENDPOINT
    + '?q=' + encodeURIComponent(JSON.stringify(q))
    + '&f=' + encodeURIComponent(JSON.stringify(PATENTSEARCH_FIELDS))
    + '&o=' + encodeURIComponent(JSON.stringify({ size: size }));
  return {
    skip: false,
    url: url,
    method: 'GET',
    source: 'patents',
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json', 'X-Api-Key': key },
  };
}

// A PatentSearch patent_id is the bare number ("4902126"); the id a reader and a citation use is the
// country-prefixed form ("US4902126").
function patentSearchId(raw) {
  const id = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!id) return '';
  return /^US/i.test(id) ? id.toUpperCase() : 'US' + id;
}

function parsePatentSearchResponse(json) {
  if (!json || typeof json !== 'object' || json.error === true || !Array.isArray(json.patents)) {
    throw new Error('patentsearch_bad_shape');
  }
  const out = [];
  for (const r of json.patents) {
    if (!r || typeof r !== 'object') continue;
    const assignees = Array.isArray(r.assignees) ? r.assignees : [];
    const first = assignees.find(function (a) { return a && typeof a.assignee_organization === 'string' && a.assignee_organization.length > 0; });
    const p = normalizePatent({
      patent_id: patentSearchId(r.patent_id),
      title: typeof r.patent_title === 'string' ? r.patent_title : '',
      abstract: typeof r.patent_abstract === 'string' ? r.patent_abstract : '',
      inventors: [],
      assignee: first ? first.assignee_organization : '',
      filing_date: '',
      source: 'patents',
    });
    p.grant_date = typeof r.patent_date === 'string' ? r.patent_date : '';
    if (p.patent_id) out.push(p);
  }
  return out;
}

// fetchPatentSearch(query, opts) -> { tier, source, results, patents, telemetry, meta }
// telemetry rows: { source:'patents', status, http_status? } with status one of
//   ok | api_key_missing | timeout | network_error | rate_limited | api_key_rejected | api_error
// meta.count is the count the provider reported for a completed call (the proof of a real empty result);
// it is null when no call completed.
async function fetchPatentSearch(query, opts) {
  const built = buildPatentSearchRequest(query, opts);
  const out = { tier: 'paid', source: 'patents', results: [], patents: [], telemetry: [], meta: { count: null } };
  if (built.skip) {
    out.telemetry.push({ source: 'patents', status: built.reason });
    return out;
  }
  let res = null;
  try {
    res = await fetchWithTimeout(built, opts);
  } catch (err) {
    out.telemetry.push({ source: 'patents', status: (err && err.name === 'AbortError') ? 'timeout' : 'network_error' });
    return out;
  }
  if (!res || !res.ok) {
    const httpStatus = (res && res.status) || 0;
    try { if (res && typeof res.arrayBuffer === 'function') { await res.arrayBuffer(); } } catch (_e) { /* drain */ }
    let status = 'api_error';
    if (httpStatus === 429 || httpStatus === 503) status = 'rate_limited';
    else if (httpStatus === 401 || httpStatus === 403) status = 'api_key_rejected';
    out.telemetry.push({ source: 'patents', status: status, http_status: httpStatus });
    return out;
  }
  let parsed = null;
  let count = null;
  try {
    const json = await res.json();
    parsed = parsePatentSearchResponse(json);
    count = (typeof json.count === 'number' && Number.isFinite(json.count)) ? json.count : parsed.length;
  } catch (_err) {
    out.telemetry.push({ source: 'patents', status: 'api_error', http_status: res.status || 0 });
    return out;
  }
  out.telemetry.push({ source: 'patents', status: 'ok', http_status: res.status || 200 });
  out.patents = dedupe(parsed);
  out.results = out.patents.slice();
  out.meta = { count: count };
  return out;
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
  // Phase 369.2 Plan 25: the keyed PatentSearch source behind the patent lens.
  fetchPatentSearch,
  buildPatentsQuery,
  fetchGooglePatents,
  fetchUspto,
  // Test surface (private; do NOT consume in production).
  _test: {
    dedupe,
    dedupKey,
    normalizePatent,
    buildPatentSearchRequest,
    parsePatentSearchResponse,
    PATENTSEARCH_ENDPOINT,
    fetchWithTimeout,
    parseSourceResponse,
    parseGooglePatentsResponse,
    parseUsptoResponse,
    parseRateLimit,
    SOURCES,
    SOURCE_ENV_VARS,
    ENDPOINTS,
    DEFAULT_TIMEOUT_MS,
    USER_AGENT,
  },
};
