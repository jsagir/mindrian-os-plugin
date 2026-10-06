/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 130.5 Plan 01 Task 2 -- research-corpus.cjs
 *
 * The ONE CJS-native unified external-corpus fetcher. Single interface:
 *
 *   fetchCorpus({ source, query, limit }) -> normalized result list | envelope
 *
 * Sources (registry: data/research-sources.json):
 *   openalex / arxiv / pubmed   academic   delegate to rs-fetcher-academic.cjs
 *   tavily                      web        native-fetch POST (snippet-only)
 *   brain-cypher                graph      generic handles ONLY via brain-client
 *   sci-bot                     web        DISABLED gated stub (no scraper shipped)
 *
 * REUSE-BEFORE-BUILD (Canon Part 7): the native-fetch academic fetching already
 * exists as lib/core/rs-fetcher-academic.cjs (openalex/arxiv/pubmed via global
 * fetch, the buildAcademicQuery Part 8 chokepoint, dedup, telemetry). fetchCorpus
 * does NOT re-implement HTTP per academic source -- it delegates to the exported
 * fetchOpenAlex / fetchArxiv / fetchPubMed. This module REPLACES the legacy
 * lib/core/rs_corpus.py corpus path (which silent-fails); Phase 134 deletes the
 * .py rather than re-porting it.
 *
 * Canon Part 8 is the Brain line (ruling 2026-10-05, Phase 369.2): fetchCorpus
 * runs the CONTENT-SET fence auditQueryString (surface 'research-corpus', from
 * rs-egress-prompts.cjs) BEFORE dispatch for the brain-cypher source only, so a
 * planted user-content Cypher string attempts ZERO Brain call. The web sources
 * (openalex, arxiv, pubmed, tavily, tavily-extract) send the string the navigator
 * approved on the grant card; they run auditWebCredential only, which refuses a
 * Bearer token, an api_key= parameter or a live vendor key value.
 *
 * Network: native Node 18+ global fetch only. AbortController gives a 10s
 * default per-request timeout (mirrors rs-fetcher-academic). No third-party
 * HTTP client dependency, no interpreter spawn, no subprocess. Zero new npm deps.
 *
 * Normalized paper shape (shared with rs-fetcher-academic):
 *   { id, title, abstract, authors[], institution, doi, source, fetched_at }
 *
 * Pure CJS, 'use strict', node built-ins + the existing rs-egress-* + academic
 * fetcher + brain-client only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { auditQueryString, auditWebCredential } = require('./rs-egress-prompts.cjs');
const academic = require('./rs-fetcher-academic.cjs');
const patentsFetcher = require('./rs-fetcher-patents.cjs');
const brainClient = require('./brain-client.cjs');
// Phase 221 Plan 01 (REQ-1, D-02): the common typed stage-envelope contract +
// the deterministic failure-injection harness. Every adapter failure path now
// returns a DISTINCT typed envelope instead of collapsing to a bare []; the
// legacy fetchCorpus return contract is preserved via a thin delegate.
const stageEnvelope = require('./recovery/stage-envelope.cjs');

// ---------- Source registry (data/research-sources.json) ----------

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'research-sources.json');

function loadRegistry() {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.sources)) {
    throw new Error('research-corpus: data/research-sources.json missing sources array');
  }
  return parsed;
}

const REGISTRY = loadRegistry();

// Frozen id list, in registry order.
const SOURCES = Object.freeze(REGISTRY.sources.map(function (s) { return s.id; }));

// id -> registry entry, for gating lookups.
const SOURCE_BY_ID = Object.freeze(REGISTRY.sources.reduce(function (acc, s) {
  acc[s.id] = s;
  return acc;
}, {}));

// ---------- Constants ----------

const DEFAULT_LIMIT = 20;
// Hard cap mirroring rs_corpus MAX-target posture so a misconfigured limit
// cannot balloon external API usage. The academic fetcher pages internally;
// here we bound the per-call request size at the adapter level.
const MAX_LIMIT = 200;

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const TAVILY_MAX_RESULTS = 20; // Tavily caps at 20 per call.
const DEFAULT_TIMEOUT_MS = 10000;

// Phase 220 Plan 01 -- Tavily Extract (URL -> full-page markdown, NOT snippets).
// extract_depth 'advanced' handles JS-rendered SPAs; costs 2 credits / 5 URLs
// (verified docs.tavily.com 2026-07-13). The API caps at 20 URLs per request;
// this adapter sends ONE url per call (the ingest pipeline is single-URL in v1;
// do not batch). MAX_EXTRACT_BYTES is the D-02 size bound: a raw response body
// above it returns a typed 'size_exceeded' status without materializing the
// oversize content downstream. EXTRACT_TIMEOUT_MS is longer than the default
// because advanced-depth extraction is slower than /search.
const TAVILY_EXTRACT_ENDPOINT = 'https://api.tavily.com/extract';
const MAX_EXTRACT_BYTES = 5_000_000;
const EXTRACT_TIMEOUT_MS = 30_000;

const USER_AGENT = 'MindrianOS-Plugin/1.13.1 (https://github.com/jsagir/mindrian-os-plugin)';

function normalizeLimit(limit) {
  const n = (typeof limit === 'number' && Number.isFinite(limit)) ? Math.floor(limit) : DEFAULT_LIMIT;
  if (n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// ---------- fetchWithTimeout (the ONE native fetch call site for net-new adapters) ----------
//
// The academic sources route through rs-fetcher-academic's own fetch site;
// only the Tavily adapter touches global.fetch here, via this helper, with the
// same AbortController posture (10s default).

async function fetchWithTimeout(url, init, opts) {
  const timeoutMs = (opts && typeof opts.timeoutMs === 'number') ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const t = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    const res = await fetch(url, Object.assign({}, init, { signal: controller.signal }));
    return res;
  } finally {
    clearTimeout(t);
  }
}

// ---------- Stage-envelope helpers (Phase 221 Plan 01) ----------
//
// retrievalEnvelope: every adapter emits stage 'retrieval' with engine = the
// source id. forcedEnvelope: the injection-harness short-circuit each adapter
// runs at its top BEFORE any network attempt (zero fetch on a forced path,
// silent). unwrapResults: the legacy array contract for the fetchCorpus
// delegate (a failure envelope unwraps to [], exactly the old degrade).

function retrievalEnvelope(engine, fields) {
  return stageEnvelope.makeStageEnvelope(
    Object.assign({ stage: 'retrieval', engine: engine }, fields)
  );
}

function forcedEnvelope(engine, query, opts) {
  const forced = stageEnvelope.forcedFailure('retrieval', opts);
  if (!forced) return null;
  return retrievalEnvelope(engine, {
    status: forced.status,
    failure_class: forced.failure_class,
    retryable: forced.retryable,
    error: forced.error,
    input: query,
  });
}

function unwrapResults(env) {
  if (env && (env.status === 'ok' || env.status === 'empty_valid')
    && env.payload && Array.isArray(env.payload.results)) {
    return env.payload.results;
  }
  return [];
}

// ---------- Academic adapter (delegates -- no re-ported HTTP) ----------
//
// openalex / arxiv / pubmed delegate to the existing native-fetch fetcher.
// We pass [query] (the academic fetcher takes a query array) and read the
// normalized results array off its envelope. 221 collapse-site conversion:
// a delegate throw is failed/engine_unavailable; an envelope without a
// results array is failed/contract_violation (the old silent-[] site); a
// LIVE fetch with zero results is empty_valid (a finding, never an error).

const ACADEMIC_DELEGATES = Object.freeze({
  openalex: academic.fetchOpenAlex,
  arxiv: academic.fetchArxiv,
  pubmed: academic.fetchPubMed,
});

async function adapterAcademicEnvelope(source, query, limit, opts) {
  const forced = forcedEnvelope(source, query, opts);
  if (forced) return forced;
  const delegate = ACADEMIC_DELEGATES[source];
  let envelope;
  try {
    envelope = await delegate([query], Object.assign({}, opts || {}, { limit: limit }));
  } catch (err) {
    return retrievalEnvelope(source, {
      status: 'failed',
      failure_class: 'engine_unavailable',
      retryable: false,
      error: 'academic_delegate_threw: ' + String(err && err.message ? err.message : err),
      input: query,
    });
  }
  // The academic envelope is { tier, source, results, papers, telemetry }.
  if (!envelope || !Array.isArray(envelope.results)) {
    return retrievalEnvelope(source, {
      status: 'failed',
      failure_class: 'contract_violation',
      retryable: false,
      error: 'academic_envelope_missing_results',
      input: query,
    });
  }
  // D-16 honesty: the delegate never throws on a provider failure, it records
  // telemetry and returns an empty result. Read that telemetry BEFORE calling
  // a zero-hit response a valid empty finding, or a provider outage would read
  // as "nothing exists in the literature".
  const telemetry = Array.isArray(envelope.telemetry) ? envelope.telemetry : [];
  const own = telemetry.filter(function (t) { return t && t.source === source; });
  const bad = own.find(function (t) { return t.status !== 'ok'; });
  if (bad) return academicFailureEnvelope(source, query, bad);

  const okRecord = own.find(function (t) { return t.status === 'ok'; });
  let meta = null;
  if (okRecord && okRecord.meta && typeof okRecord.meta === 'object') {
    meta = Object.assign({ count: null }, okRecord.meta);
    if (typeof meta.count !== 'number') meta.count = null;
  }

  const results = envelope.results.slice(0, limit);
  let env;
  if (results.length === 0) {
    env = retrievalEnvelope(source, {
      status: 'empty_valid',
      input: query,
      payload: meta ? { results: [], meta: meta } : { results: [] },
    });
  } else {
    env = retrievalEnvelope(source, {
      status: 'ok',
      input: query,
      output: results,
      payload: meta ? { results: results, meta: meta } : { results: results },
    });
  }
  // Additive: the envelope constructor drops unknown keys, so meta is attached
  // after construction (also mirrored in payload.meta above).
  if (meta) env.meta = meta;
  return env;
}

// Maps one non-ok academic telemetry record to a typed failure envelope.
// timeout and network_error -> network_timeout; api_key_missing ->
// missing_credential; rate_limited and api_error -> http_error. A local or
// provider budget that is spent carries budget_exhausted (error string and
// payload.reason). The error string is academic_<status>[_<http_status>]; it
// never contains a header, a URL or a key.
function academicFailureEnvelope(source, query, rec) {
  const status = String(rec.status || 'unknown_error');
  const httpStatus = (typeof rec.http_status === 'number' && rec.http_status > 0) ? rec.http_status : null;
  let failureClass;
  let envStatus = 'failed';
  let retryable = true;
  switch (status) {
    case 'timeout':
    case 'network_error':
      failureClass = 'network_timeout';
      break;
    case 'api_key_missing':
      failureClass = 'missing_credential';
      envStatus = 'blocked';
      retryable = false;
      break;
    case 'rate_limited':
    case 'api_error':
      failureClass = 'http_error';
      break;
    case 'budget_exhausted':
      // The local per-source rolling budget is spent: a spend limit, never retried.
      failureClass = 'spend_limit_exceeded';
      envStatus = 'blocked';
      retryable = false;
      break;
    default:
      failureClass = 'unknown_error';
  }
  const budgetExhausted = status === 'budget_exhausted' || rec.budget_exhausted === true;
  let error = 'academic_' + status + (httpStatus ? '_' + httpStatus : '');
  if (budgetExhausted && error.indexOf('budget_exhausted') === -1) error += '_budget_exhausted';
  const fields = {
    status: envStatus,
    failure_class: failureClass,
    retryable: retryable,
    error: error,
    input: query,
  };
  if (budgetExhausted) fields.payload = { results: [], reason: 'budget_exhausted' };
  return retrievalEnvelope(source, fields);
}

// Legacy array contract (byte-compatible for every existing caller).
async function adapterAcademic(source, query, limit, opts) {
  return unwrapResults(await adapterAcademicEnvelope(source, query, limit, opts));
}

// ---------- Tavily adapter (net-new; native fetch; snippet-only) ----------
//
// Ports the legacy rs_corpus.fetch_tavily parse logic. Gated by the existing
// TAVILY_API_KEY env var. 221 collapse-site conversion (the five verified
// bare-[] sites become five DISTINCT typed events): missing key ->
// blocked/missing_credential; network/timeout catch -> failed/network_timeout
// retryable:true; HTTP non-ok -> failed/http_error (drain preserved);
// res.json() catch -> failed/parse_error; a LIVE zero-hit response ->
// empty_valid. The legacy adapterTavily wrapper still degrades to [].

async function adapterTavilyEnvelope(query, limit, opts) {
  const forced = forcedEnvelope('tavily', query, opts);
  if (forced) return forced;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    // The registry gate (env:TAVILY_API_KEY) is unmet: a credential block,
    // not an empty finding.
    return retrievalEnvelope('tavily', {
      status: 'blocked',
      failure_class: 'missing_credential',
      retryable: false,
      error: 'TAVILY_API_KEY not set',
      input: query,
    });
  }
  const body = {
    api_key: apiKey,
    query: query,
    max_results: Math.min(limit, TAVILY_MAX_RESULTS),
    search_depth: 'advanced',
  };
  // Phase 369.2 Plan 25: an optional domain restriction (the patent lens's opt-in Tavily fallback sends
  // ['patents.google.com']). Only a non-empty array of non-empty strings is sent; anything else is ignored.
  if (opts && Array.isArray(opts.include_domains)) {
    const doms = opts.include_domains.filter(function (d) { return typeof d === 'string' && d.length > 0; });
    if (doms.length > 0) body.include_domains = doms;
  }
  let res;
  try {
    res = await fetchWithTimeout(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    }, opts);
  } catch (err) {
    // Network error / timeout: a typed retryable failure, never a silent [].
    return retrievalEnvelope('tavily', {
      status: 'failed',
      failure_class: 'network_timeout',
      retryable: true,
      error: 'tavily_fetch_failed: ' + String(err && err.name === 'AbortError' ? 'timeout' : (err && err.message ? err.message : err)),
      input: query,
    });
  }
  if (!res || !res.ok) {
    try { if (res && typeof res.arrayBuffer === 'function') { await res.arrayBuffer(); } } catch (_e) { /* drain */ }
    return retrievalEnvelope('tavily', {
      status: 'failed',
      failure_class: 'http_error',
      retryable: true,
      error: 'tavily_http_' + String(res && typeof res.status === 'number' ? res.status : 'no_response'),
      input: query,
    });
  }
  let data;
  try {
    data = await res.json();
  } catch (_err) {
    return retrievalEnvelope('tavily', {
      status: 'failed',
      failure_class: 'parse_error',
      retryable: false,
      error: 'tavily_response_json_parse_failed',
      input: query,
    });
  }
  const hits = (data && Array.isArray(data.results)) ? data.results : [];
  const out = [];
  for (const item of hits) {
    if (!item || typeof item !== 'object') continue;
    const url = (item.url || '').trim ? String(item.url || '').trim() : '';
    if (!url) continue;
    const content = (item.content ? String(item.content) : '').trim();
    if (!content) continue;
    out.push({
      id: url,
      title: item.title ? String(item.title) : '',
      abstract: content,            // snippet-only per the legacy parity contract
      authors: [],
      institution: '',
      doi: null,
      source: 'tavily',
      fetched_at: new Date().toISOString(),
    });
    if (out.length >= limit) break;
  }
  if (out.length === 0) {
    // A LIVE fetch with zero usable hits is a FINDING (empty_valid), fully
    // distinct from every failure class above.
    return retrievalEnvelope('tavily', {
      status: 'empty_valid',
      input: query,
      payload: { results: [] },
    });
  }
  return retrievalEnvelope('tavily', {
    status: 'ok',
    input: query,
    output: out,
    payload: { results: out },
  });
}

// Legacy array contract (byte-compatible for every existing caller).
async function adapterTavily(query, limit, opts) {
  return unwrapResults(await adapterTavilyEnvelope(query, limit, opts));
}

// ---------- Patents adapter (Phase 369.2 Plan 25; PatentsView PatentSearch, keyed) ----------
//
// The real patent source behind the patent lens (CODE-02). Gated by env PATENTSVIEW_API_KEY (registry gate).
// Delegates the HTTP and the parse to rs-fetcher-patents.cjs fetchPatentSearch (the key is read there at call
// time and sent as a header only). A missing key is a credential block, never an empty finding; a rejected key,
// a timeout, a rate limit or a bad body is a typed failure; a completed call that reports zero patents is
// empty_valid. Rows are the corpus item shape with source 'patents'.

function patentToItem(p) {
  const id = p.patent_id;
  return {
    id: id,
    patent_id: id,
    number: id,
    title: p.title || '',
    abstract: p.abstract || '',
    authors: Array.isArray(p.inventors) ? p.inventors : [],
    institution: p.assignee || '',
    assignee: p.assignee || '',
    grant_date: p.grant_date || '',
    doi: null,
    url: 'https://patents.google.com/patent/' + id,
    source: 'patents',
    fetched_at: p.fetched_at || new Date().toISOString(),
  };
}

async function adapterPatentsEnvelope(query, limit, opts) {
  const forced = forcedEnvelope('patents', query, opts);
  if (forced) return forced;
  if (!process.env.PATENTSVIEW_API_KEY) {
    return retrievalEnvelope('patents', {
      status: 'blocked',
      failure_class: 'missing_credential',
      retryable: false,
      error: 'PATENTSVIEW_API_KEY not set',
      input: query,
    });
  }
  let res;
  try {
    res = await patentsFetcher.fetchPatentSearch(query, { limit: limit, timeoutMs: opts && opts.timeoutMs });
  } catch (err) {
    return retrievalEnvelope('patents', {
      status: 'failed',
      failure_class: 'engine_unavailable',
      retryable: false,
      error: 'patents_delegate_threw: ' + String(err && err.name ? err.name : 'error'),
      input: query,
    });
  }
  const tel = (res && Array.isArray(res.telemetry)) ? res.telemetry : [];
  const row = tel.find(function (t) { return t && t.source === 'patents'; }) || { status: 'api_error' };
  if (row.status !== 'ok') {
    let failureClass = 'http_error';
    let envStatus = 'failed';
    let retryable = true;
    if (row.status === 'timeout' || row.status === 'network_error') failureClass = 'network_timeout';
    else if (row.status === 'api_key_missing' || row.status === 'api_key_rejected') {
      failureClass = 'missing_credential';
      envStatus = 'blocked';
      retryable = false;
    }
    const http = (typeof row.http_status === 'number' && row.http_status > 0) ? '_' + row.http_status : '';
    return retrievalEnvelope('patents', {
      status: envStatus,
      failure_class: failureClass,
      retryable: retryable,
      error: 'patents_' + String(row.status) + http,
      input: query,
    });
  }
  const meta = { count: (res.meta && typeof res.meta.count === 'number') ? res.meta.count : null };
  const items = (Array.isArray(res.patents) ? res.patents : []).slice(0, limit).map(patentToItem);
  let env;
  if (items.length === 0) {
    env = retrievalEnvelope('patents', { status: 'empty_valid', input: query, payload: { results: [], meta: meta } });
  } else {
    env = retrievalEnvelope('patents', { status: 'ok', input: query, output: items, payload: { results: items, meta: meta } });
  }
  env.meta = meta;
  return env;
}

// The unmet env gates of a registered source (369.2 Plan 25). Only 'env:NAME' gates are evaluated here; the
// other gate kinds (brain:isAvailable, opt_in, token, legal_review) have their own checks at their adapters.
// Returns { known, met, unmet:[gate strings] }. Reads process.env at call time; never returns a value.
function sourceGateStatus(source) {
  const entry = SOURCE_BY_ID[source];
  if (!entry) return { known: false, met: false, unmet: ['unknown_source'] };
  const gates = Array.isArray(entry.gates) ? entry.gates : [];
  const unmet = gates.filter(function (g) {
    if (typeof g !== 'string' || g.indexOf('env:') !== 0) return false;
    return !process.env[g.slice(4)];
  });
  return { known: true, met: unmet.length === 0, unmet: unmet };
}

// ---------- Tavily Extract adapter (Phase 220; URL -> full-page markdown) ----------
//
// The ONE net-new adapter of Phase 220 (D-01). Clones adapterTavily's degrade
// posture but returns the TYPED provider envelope (D-01/D-19) instead of a bare
// array: missing key / 429 / timeout / HTTP error / oversize each yield a named
// provider.status -- never a crash, never a silent bare empty. The ONLY throw
// path is upstream in fetchCorpus (the pre-dispatch audit, fail-closed +
// TypeErrors for bad args, unknown source, and the tavily-extract scheme fence).
//
// Part 8: the outbound body carries the URL + generic extract config handles
// ONLY (urls / extract_depth / format + the api_key auth field the sibling
// adapter uses). No room prose field can reach the wire.
//
// NEVER call this directly from product code -- always via
// fetchCorpus({ source: 'tavily-extract', query: url, ... }) so the audit
// chokepoint runs first (__testables export is for tests only).

function extractEnvelope(status, reason, results) {
  const list = Array.isArray(results) ? results : [];
  return {
    ok: status === 'ok',
    provider: {
      id: 'tavily-extract',
      status: status,
      reason: reason,
      counts: { urls_requested: 1, urls_succeeded: list.length },
    },
    results: list,
  };
}

async function adapterTavilyExtract(url, opts) {
  const o = opts || {};
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    // Degraded typed envelope -- the registry gate (env:TAVILY_API_KEY) is unmet.
    return extractEnvelope('provider_unavailable', 'missing_key', []);
  }
  const body = {
    api_key: apiKey,
    urls: url,
    extract_depth: o.extractDepth === 'basic' ? 'basic' : 'advanced',
    format: 'markdown',
  };
  let res;
  try {
    res = await fetchWithTimeout(TAVILY_EXTRACT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    }, { timeoutMs: (typeof o.timeoutMs === 'number') ? o.timeoutMs : EXTRACT_TIMEOUT_MS });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return extractEnvelope('timeout', 'timeout', []);
    }
    return extractEnvelope('error', 'fetch_failed', []);
  }
  if (!res) {
    return extractEnvelope('error', 'no_response', []);
  }
  if (res.status === 429) {
    try { if (typeof res.arrayBuffer === 'function') { await res.arrayBuffer(); } } catch (_e) { /* drain */ }
    return extractEnvelope('rate_limited', 'http_429', []);
  }
  if (!res.ok) {
    try { if (typeof res.arrayBuffer === 'function') { await res.arrayBuffer(); } } catch (_e) { /* drain */ }
    return extractEnvelope('error', 'http_' + res.status, []);
  }
  // D-02 size bound, header-first so an announced oversize body is never read.
  const lenHeader = (res.headers && typeof res.headers.get === 'function')
    ? res.headers.get('content-length')
    : null;
  if (lenHeader && Number(lenHeader) > MAX_EXTRACT_BYTES) {
    try { if (typeof res.arrayBuffer === 'function') { await res.arrayBuffer(); } } catch (_e) { /* drain */ }
    return extractEnvelope('size_exceeded', 'oversize', []);
  }
  let raw;
  try {
    raw = await res.text();
  } catch (_err) {
    return extractEnvelope('error', 'body_read_failed', []);
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_EXTRACT_BYTES) {
    // Oversize content stops here -- it never materializes downstream.
    return extractEnvelope('size_exceeded', 'oversize', []);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_err) {
    return extractEnvelope('error', 'bad_json', []);
  }
  // Tavily extract response shape: { results: [{ url, raw_content, ... }],
  // failed_results: [...] }. Map into the typed results contract.
  const hits = (data && Array.isArray(data.results)) ? data.results : [];
  const out = [];
  for (const item of hits) {
    if (!item || typeof item !== 'object') continue;
    const itemUrl = item.url ? String(item.url).trim() : '';
    const markdown = item.raw_content ? String(item.raw_content) : '';
    if (!itemUrl || !markdown) continue;
    out.push({
      url: itemUrl,
      markdown: markdown,           // full-page markdown, never a snippet (Pitfall 1)
      title: item.title ? String(item.title) : '',
    });
  }
  if (out.length === 0) {
    // D-19: a provider failure never masquerades as success (no ok:true + empty).
    return extractEnvelope('error', 'extract_failed', []);
  }
  return extractEnvelope('ok', null, out);
}

// ---------- Brain-Cypher adapter (Phase 110 packet path; generic handles ONLY) ----------
//
// Canon Part 8: `query` is treated as a GENERIC framework/topic handle ONLY.
// The fetchCorpus-level audit already rejected any user-content query before
// this path runs (defense-in-depth: a forbidden query never reaches here). We
// bind the handle through brain-client.sanitizeCypherInput (never interpolate
// raw), run a read-only methodology query, and return the framework handles.
// NEVER send artifact bodies; honor the Phase 110 packet contract (generic
// handles + enums only). Unavailable Brain degrades to an empty array (no throw).

async function adapterBrainCypherEnvelope(query, limit, opts) {
  const forced = forcedEnvelope('brain-cypher', query, opts);
  if (forced) return forced;
  if (!brainClient.isAvailable()) {
    // Brain unreachable: a typed availability block (221 conversion
    // of the old silent-[] degrade), never a throw. Phase 252-01 (SWEEP-01,
    // CONFORM): align with the refusal-kind vocabulary via an ADDITIVE
    // payload.refusal field. `failure_class`/`error` stay byte-locked
    // literal values (asserted by tests/test-221-envelopes.cjs,
    // tests/test-221-matrix.cjs, tests/test-221-vantage.cjs, none of which
    // are in this task's file scope); makeStageEnvelope's fixed key-set
    // already drops any unrecognized top-level field, so the disclosure
    // rides inside `payload` (a free-form object it DOES pass through).
    let refusal;
    try {
      refusal = require('./refusal-messaging.cjs').refusalResponse('unreachable', { tool: 'brain-cypher' });
    } catch (_e) { refusal = null; }
    return retrievalEnvelope('brain-cypher', {
      status: 'blocked',
      failure_class: 'engine_unavailable',
      retryable: false,
      error: 'brain_unavailable',
      input: query,
      payload: refusal ? { refusal: refusal } : {},
    });
  }
  // Bind the generic handle. sanitizeCypherInput strips every non
  // [a-zA-Z0-9 ._-] character so the handle cannot smuggle Cypher. The helper
  // is exposed on brain-client._test (it is a small pure sanitizer; not part of
  // the public surface but the canonical binder per Canon Part 8).
  const sanitize = (brainClient._test && brainClient._test.sanitizeCypherInput)
    ? brainClient._test.sanitizeCypherInput
    : function (v) { return String(v == null ? '' : v).replace(/[^a-zA-Z0-9 ._-]/g, ''); };
  const handle = sanitize(query);
  if (!handle) {
    return retrievalEnvelope('brain-cypher', {
      status: 'failed',
      failure_class: 'query_error',
      retryable: false,
      error: 'handle_sanitized_empty',
      input: query,
    });
  }

  // Read-only methodology query: frameworks whose name carries the handle.
  // The handle is bound as a $seed parameter (never string-interpolated) so the
  // Brain side receives only a generic framework/topic handle.
  const cypher = 'MATCH (f:Framework) WHERE f.name CONTAINS $seed '
    + 'RETURN f.name AS name, f.description AS description LIMIT ' + Number(limit);
  let result;
  try {
    result = await brainClient.query(cypher, { seed: handle });
  } catch (err) {
    return retrievalEnvelope('brain-cypher', {
      status: 'failed',
      failure_class: 'query_error',
      retryable: false,
      error: 'brain_query_threw: ' + String(err && err.message ? err.message : err),
      input: query,
    });
  }
  const records = (result && Array.isArray(result.records)) ? result.records : [];
  const out = [];
  for (const rec of records) {
    const name = rec && (rec.name || rec[0]);
    if (!name) continue;
    out.push({
      id: 'brain:framework:' + String(name),
      title: String(name),
      abstract: rec && (rec.description || rec[1]) ? String(rec.description || rec[1]) : '',
      authors: [],
      institution: '',
      doi: null,
      source: 'brain-cypher',
      fetched_at: new Date().toISOString(),
    });
    if (out.length >= limit) break;
  }
  if (out.length === 0) {
    return retrievalEnvelope('brain-cypher', {
      status: 'empty_valid',
      input: query,
      payload: { results: [] },
    });
  }
  return retrievalEnvelope('brain-cypher', {
    status: 'ok',
    input: query,
    output: out,
    payload: { results: out },
  });
}

// Legacy array contract (byte-compatible for every existing caller).
async function adapterBrainCypher(query, limit, opts) {
  return unwrapResults(await adapterBrainCypherEnvelope(query, limit, opts));
}

// ---------- Sci-Bot adapter (DISABLED gated stub; no scraper) ----------
//
// Sci-Bot (https://sci-bot.ru) is an AI research assistant POWERED BY Sci-Hub.
// Per the 130.5 CONTEXT decision it ships enabled:false behind three gates,
// none default-true:
//   (1) opt_in:user            -- opts.optIn === true
//   (2) token:user_supplied    -- a user token present (process.env.SCIBOT_TOKEN)
//   (3) legal_review:signed_off -- opts.legalReviewSignedOff === true
// (the registry encodes these gate enum strings in data/research-sources.json).
//
// Sci-Hub bypasses paywalls and is legally contested; the plugin is a commercial
// product shipping to academic testers, so routing research through it MUST clear
// separate legal review before it can be enabled by default. There is no
// documented public API: it is a login + token + queue web UI (alpha). NO
// headless browser. Unless ALL three gates are satisfied, this returns a
// disabled no-op envelope and performs ZERO fetch. Even when the gates ARE all
// satisfied, the enabled branch is an explicit throw (NOT a scraper) so enabling
// without an official token-authenticated endpoint cannot silently scrape.
// When ever enabled, Sci-Bot output is a Practitioner/None-tier lead that MUST
// be re-grounded against an Academic-tier primary source (Canon Part 5).

function adapterSciBot(query, limit, opts) {
  const o = opts || {};
  const optIn = o.optIn === true;
  const tokenPresent = typeof process.env.SCIBOT_TOKEN === 'string' && process.env.SCIBOT_TOKEN.length > 0;
  const legalSignedOff = o.legalReviewSignedOff === true;

  if (!(optIn && tokenPresent && legalSignedOff)) {
    return {
      disabled: true,
      reason: 'sci-bot disabled (opt-in + token + legal-review required)',
    };
  }
  // All three gates satisfied -- but there is no official token-authenticated
  // endpoint to call, and NO headless browser is permitted (stack rule). Refuse
  // loudly rather than silently scrape.
  throw new Error('sci-bot adapter not implemented: requires official token-authenticated endpoint');
}

// ---------- Envelope wrappers for the 220-owned adapters (additive) ----------
//
// adapterSciBot and adapterTavilyExtract keep their shipped shapes UNTOUCHED
// (the 220-02 typed degrade contract). These wrappers ride the stage-envelope
// contract ADDITIVELY: payload.legacy carries the exact legacy value so the
// fetchCorpus delegate returns it byte-identically.

function adapterSciBotEnvelope(query, limit, opts) {
  // The enabled-branch throw (no official endpoint) propagates unchanged --
  // a loud refusal is not an envelope.
  const legacy = adapterSciBot(query, limit, opts);
  return retrievalEnvelope('sci-bot', {
    status: 'blocked',
    failure_class: 'policy_blocked',
    retryable: false,
    error: legacy.reason,
    input: query,
    payload: { legacy: legacy },
  });
}

// Map the 220 extract provider statuses onto the 221 failure taxonomy. The
// legacy envelope rides in payload.legacy so 220-02 consumers see the exact
// shipped shape.
function mapExtractStatus(legacy) {
  const p = (legacy && legacy.provider) ? legacy.provider : {};
  const status = p.status;
  const reason = typeof p.reason === 'string' ? p.reason : null;
  if (status === 'ok') {
    return { status: 'ok', failure_class: null, retryable: false, error: null };
  }
  if (status === 'provider_unavailable') {
    return { status: 'blocked', failure_class: 'missing_credential', retryable: false, error: reason || 'missing_key' };
  }
  if (status === 'timeout') {
    return { status: 'failed', failure_class: 'network_timeout', retryable: true, error: reason || 'timeout' };
  }
  if (status === 'rate_limited') {
    return { status: 'failed', failure_class: 'http_error', retryable: true, error: reason || 'http_429' };
  }
  if (status === 'size_exceeded') {
    return { status: 'failed', failure_class: 'size_exceeded', retryable: false, error: reason || 'oversize' };
  }
  // status === 'error' (or anything unexpected): pick the class off the reason.
  if (reason === 'bad_json') {
    return { status: 'failed', failure_class: 'parse_error', retryable: false, error: reason };
  }
  if (reason === 'fetch_failed' || reason === 'no_response') {
    return { status: 'failed', failure_class: 'network_timeout', retryable: true, error: reason };
  }
  if (reason && reason.indexOf('http_') === 0) {
    return { status: 'failed', failure_class: 'http_error', retryable: true, error: reason };
  }
  if (reason === 'body_read_failed') {
    return { status: 'failed', failure_class: 'http_error', retryable: false, error: reason };
  }
  return { status: 'failed', failure_class: 'unknown_error', retryable: false, error: reason || 'extract_error' };
}

async function adapterTavilyExtractEnvelope(url, opts) {
  const forced = stageEnvelope.forcedFailure('retrieval', opts);
  if (forced) {
    return retrievalEnvelope('tavily-extract', {
      status: forced.status,
      failure_class: forced.failure_class,
      retryable: forced.retryable,
      error: forced.error,
      input: url,
      payload: { legacy: extractEnvelope('error', forced.error, []), results: [] },
    });
  }
  const legacy = await adapterTavilyExtract(url, opts);
  const mapped = mapExtractStatus(legacy);
  return retrievalEnvelope('tavily-extract', {
    status: mapped.status,
    failure_class: mapped.failure_class,
    retryable: mapped.retryable,
    error: mapped.error,
    input: url,
    output: mapped.status === 'ok' ? legacy.results : undefined,
    payload: { legacy: legacy, results: Array.isArray(legacy.results) ? legacy.results : [] },
  });
}

// ---------- fetchCorpusEnvelope (the typed entry point) + fetchCorpus ----------
//
// fetchCorpusEnvelope: identical validation + the audit chokepoint (for
// brain-cypher auditQueryString still THROWS ExternalEgressViolation
// pre-dispatch; the envelope work never catches or softens it -- a Part 8
// violation is typed blocked/policy_blocked ONLY at the Plan 02 dispatcher
// boundary where it is TERMINAL; web sources run the credential check only)
// + dispatch, returning the full stage envelope.
//
// fetchCorpus: a thin delegate that unwraps to the EXACT legacy return
// (payload.results arrays; payload.legacy for sci-bot + tavily-extract;
// rethrow behavior identical), so every existing caller is byte-unaffected
// (D-02: additive, no breaking change).

async function fetchCorpusEnvelope(args) {
  const opts = (args && typeof args === 'object') ? args : {};
  const source = opts.source;
  const query = opts.query;

  // Validate query first (a non-empty string) so the audit always runs on a
  // real string.
  if (typeof query !== 'string' || query.length === 0) {
    throw new TypeError('fetchCorpus: query must be a non-empty string');
  }

  // Validate source against the frozen SOURCES enum (TypeError on unknown).
  if (typeof source !== 'string' || !SOURCES.includes(source)) {
    throw new TypeError('fetchCorpus: unknown source: ' + String(source));
  }

  // Part 8 is the Brain line, so the CONTENT-SET fence runs for brain-cypher
  // only (fail-closed, zero Brain call, never caught or softened here); web
  // sources send the string the navigator approved on the grant card (ruling
  // 2026-10-05) and only a credential in the string is refused.
  if (source === 'brain-cypher') {
    auditQueryString(query, 'research-corpus');
  } else {
    auditWebCredential(query, 'research-corpus');
  }

  // Phase 220 D-02 scheme fence for the URL-extract source: the query must
  // parse as an absolute http(s) URL. Non-http(s) schemes reject with a
  // TypeError BEFORE any dispatch. Runs AFTER the audit for chokepoint
  // uniformity.
  if (source === 'tavily-extract') {
    let parsed;
    try {
      parsed = new URL(query);
    } catch (_err) {
      throw new TypeError('fetchCorpus: tavily-extract query must be a valid absolute URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new TypeError('fetchCorpus: tavily-extract scheme not allowed: ' + parsed.protocol);
    }
  }

  const limit = normalizeLimit(opts.limit);

  switch (source) {
    case 'openalex':
    case 'arxiv':
    case 'pubmed':
      return adapterAcademicEnvelope(source, query, limit, opts);
    case 'tavily':
      return adapterTavilyEnvelope(query, limit, opts);
    case 'patents':
      return adapterPatentsEnvelope(query, limit, opts);
    case 'tavily-extract':
      return adapterTavilyExtractEnvelope(query, opts);
    case 'brain-cypher':
      return adapterBrainCypherEnvelope(query, limit, opts);
    case 'sci-bot':
      return adapterSciBotEnvelope(query, limit, opts);
    default:
      // Unreachable: SOURCES is frozen and validated above. Defensive.
      throw new TypeError('fetchCorpus: unhandled source: ' + source);
  }
}

// The legacy unwrap: sci-bot + tavily-extract return their shipped legacy
// values (payload.legacy); every array source returns payload.results on
// ok/empty_valid and [] on any failure (the exact old degrade posture).
function unwrapLegacy(env) {
  const p = (env && env.payload && typeof env.payload === 'object') ? env.payload : {};
  if (Object.prototype.hasOwnProperty.call(p, 'legacy')) return p.legacy;
  return unwrapResults(env);
}

async function fetchCorpus(args) {
  return unwrapLegacy(await fetchCorpusEnvelope(args));
}

// ---------- Exports ----------

module.exports = {
  fetchCorpus,
  // Phase 221 Plan 01 additive export: the full typed stage envelope (the
  // Plan 02 dispatcher's input). fetchCorpus stays the legacy array contract.
  fetchCorpusEnvelope,
  SOURCES,
  // Phase 369.2 Plan 25: the registry's unmet env gates for one source, read before any dispatch.
  sourceGateStatus,
  // Adapters exposed for tests (private; do NOT consume in production).
  _adapters: {
    adapterAcademic,
    adapterTavily,
    adapterBrainCypher,
    adapterSciBot,
    adapterTavilyExtract,
    // Phase 221 envelope helpers (same private-export idiom).
    adapterAcademicEnvelope,
    adapterTavilyEnvelope,
    adapterPatentsEnvelope,
    adapterBrainCypherEnvelope,
    adapterSciBotEnvelope,
    adapterTavilyExtractEnvelope,
    retrievalEnvelope,
    unwrapResults,
    unwrapLegacy,
    mapExtractStatus,
    normalizeLimit,
    fetchWithTimeout,
    SOURCE_BY_ID,
    REGISTRY: REGISTRY,
    DEFAULT_LIMIT: DEFAULT_LIMIT,
    MAX_LIMIT: MAX_LIMIT,
  },
  // Phase 220 test seam (tests ONLY; product code always rides fetchCorpus so
  // the Part 8 audit chokepoint runs first).
  __testables: {
    adapterTavily,
    adapterTavilyExtract,
    TAVILY_EXTRACT_ENDPOINT: TAVILY_EXTRACT_ENDPOINT,
    MAX_EXTRACT_BYTES: MAX_EXTRACT_BYTES,
    EXTRACT_TIMEOUT_MS: EXTRACT_TIMEOUT_MS,
  },
};
