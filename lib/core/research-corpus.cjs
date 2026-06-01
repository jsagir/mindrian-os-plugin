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
 * THE single fail-closed Canon Part 8 audit chokepoint: fetchCorpus calls
 * auditQueryString(query, 'research-corpus') (from rs-egress-prompts.cjs) BEFORE
 * any dispatch, so a forbidden query throws ExternalEgressViolation pre-egress
 * for EVERY source uniformly. The per-source academic fetchers ALSO audit
 * (defense-in-depth), but fetchCorpus does not rely on that -- it itself fails
 * closed: a planted user-content query attempts ZERO fetch and ZERO Brain call.
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

const { auditQueryString } = require('./rs-egress-prompts.cjs');
const academic = require('./rs-fetcher-academic.cjs');
const brainClient = require('./brain-client.cjs');

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

// ---------- Academic adapter (delegates -- no re-ported HTTP) ----------
//
// openalex / arxiv / pubmed delegate to the existing native-fetch fetcher.
// We pass [query] (the academic fetcher takes a query array) and read the
// normalized results array off its envelope.

const ACADEMIC_DELEGATES = Object.freeze({
  openalex: academic.fetchOpenAlex,
  arxiv: academic.fetchArxiv,
  pubmed: academic.fetchPubMed,
});

async function adapterAcademic(source, query, limit, opts) {
  const delegate = ACADEMIC_DELEGATES[source];
  const envelope = await delegate([query], Object.assign({}, opts || {}, { limit: limit }));
  // The academic envelope is { tier, source, results, papers, telemetry }.
  const results = (envelope && Array.isArray(envelope.results)) ? envelope.results : [];
  return results.slice(0, limit);
}

// ---------- Tavily adapter (net-new; native fetch; snippet-only) ----------
//
// Ports the legacy rs_corpus.fetch_tavily parse logic. Gated by the existing
// TAVILY_API_KEY env var. Missing key degrades to an empty array (no throw).

async function adapterTavily(query, limit, opts) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    // Degraded empty envelope -- the registry gate (env:TAVILY_API_KEY) is unmet.
    return [];
  }
  const body = {
    api_key: apiKey,
    query: query,
    max_results: Math.min(limit, TAVILY_MAX_RESULTS),
    search_depth: 'advanced',
  };
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
  } catch (_err) {
    // Network error / timeout -> graceful empty (no throw), mirroring the
    // academic fetcher's degrade posture.
    return [];
  }
  if (!res || !res.ok) {
    try { if (res && typeof res.arrayBuffer === 'function') { await res.arrayBuffer(); } } catch (_e) { /* drain */ }
    return [];
  }
  let data;
  try {
    data = await res.json();
  } catch (_err) {
    return [];
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
  return out;
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

async function adapterBrainCypher(query, limit, opts) {
  if (!brainClient.isAvailable()) {
    // Degraded: Brain unreachable / no key. Empty array, never throws.
    return [];
  }
  // Bind the generic handle. sanitizeCypherInput strips every non
  // [a-zA-Z0-9 ._-] character so the handle cannot smuggle Cypher. The helper
  // is exposed on brain-client._test (it is a small pure sanitizer; not part of
  // the public surface but the canonical binder per Canon Part 8).
  const sanitize = (brainClient._test && brainClient._test.sanitizeCypherInput)
    ? brainClient._test.sanitizeCypherInput
    : function (v) { return String(v == null ? '' : v).replace(/[^a-zA-Z0-9 ._-]/g, ''); };
  const handle = sanitize(query);
  if (!handle) return [];

  // Read-only methodology query: frameworks whose name carries the handle.
  // The handle is bound as a $seed parameter (never string-interpolated) so the
  // Brain side receives only a generic framework/topic handle.
  const cypher = 'MATCH (f:Framework) WHERE f.name CONTAINS $seed '
    + 'RETURN f.name AS name, f.description AS description LIMIT ' + Number(limit);
  let result;
  try {
    result = await brainClient.query(cypher, { seed: handle });
  } catch (_err) {
    return [];
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
  return out;
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

// ---------- fetchCorpus (the single entry point + THE audit chokepoint) ----------

async function fetchCorpus(args) {
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

  // THE Canon Part 8 chokepoint. Runs BEFORE any dispatch so a forbidden query
  // throws ExternalEgressViolation pre-egress for EVERY source uniformly --
  // fetchCorpus itself fails closed (zero fetch, zero Brain call). We do NOT
  // rely on per-fetcher audits alone.
  auditQueryString(query, 'research-corpus');

  const limit = normalizeLimit(opts.limit);

  switch (source) {
    case 'openalex':
    case 'arxiv':
    case 'pubmed':
      return adapterAcademic(source, query, limit, opts);
    case 'tavily':
      return adapterTavily(query, limit, opts);
    case 'brain-cypher':
      return adapterBrainCypher(query, limit, opts);
    case 'sci-bot':
      return adapterSciBot(query, limit, opts);
    default:
      // Unreachable: SOURCES is frozen and validated above. Defensive.
      throw new TypeError('fetchCorpus: unhandled source: ' + source);
  }
}

// ---------- Exports ----------

module.exports = {
  fetchCorpus,
  SOURCES,
  // Adapters exposed for tests (private; do NOT consume in production).
  _adapters: {
    adapterAcademic,
    adapterTavily,
    adapterBrainCypher,
    adapterSciBot,
    normalizeLimit,
    fetchWithTimeout,
    SOURCE_BY_ID,
    REGISTRY: REGISTRY,
    DEFAULT_LIMIT: DEFAULT_LIMIT,
    MAX_LIMIT: MAX_LIMIT,
  },
};
