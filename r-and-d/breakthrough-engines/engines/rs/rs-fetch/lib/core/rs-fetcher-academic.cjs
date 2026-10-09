/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 02 -- Academic external-egress fetcher.
 * Phase 94 Plan 05 amendment (2026-04-28): envelope wrap only.
 * Free-tier paths (openalex / arxiv / pubmed) preserved byte-identical;
 * the wrap layer adds {tier, source, results} on top of the existing
 * {papers, telemetry} return. tier='paid' annotates that a real keyed
 * or keyless API tier produced data; backward-compat papers[] key is
 * preserved for downstream consumers (rs-expert-mapper, rs-discovery-
 * engine). Per Canon Part 4 the tier annotation feeds the section-8
 * trace web_research_tier field; per Canon Part 7 envelope wrap reuses
 * the existing Phase 89.2 fetcher logic without rewriting it.
 *
 * Six sources covered with one Canon Part 8 chokepoint:
 *   openalex   optional key     polite pool via OPENALEX_EMAIL env; an optional
 *                               OPENALEX_API_KEY is sent ONLY as an Authorization
 *                               Bearer header (never in a URL, log or record).
 *                               Usage is metered (x-ratelimit-*-usd headers); a
 *                               keyless budget is small and can run out.
 *   arxiv      no API key       Atom XML; ~3 req/s soft limit
 *   pubmed     no API key       eutils JSON; 3 req/s
 *   scopus     SCOPUS_API_KEY   Elsevier search API
 *   ieee       IEEE_API_KEY     IEEEXplore search API
 *   nature     NATURE_API_KEY   Springer Nature meta API
 *
 * Single chokepoint: buildAcademicQuery(query, source, opts) is the ONLY
 * function that constructs an outbound URL. Every call invokes
 * auditQueryString(query, 'academic') from rs-egress-prompts.cjs BEFORE
 * the URL is returned. ExternalEgressViolation throws pre-egress on any
 * FORBIDDEN_PATTERNS hit, so adversarial input never reaches the wire.
 *
 * Per-source rate-limit graceful degradation per Phase 88.6-03 pattern:
 *   429 / 503 -> recordTelemetry(status='rate_limited') + return empty
 *                for that source + continue with remaining sources
 *   timeout   -> recordTelemetry(status='timeout') + continue
 *   parse err -> recordTelemetry(status='api_error') + continue
 *   no key    -> recordTelemetry(status='api_key_missing') + skip source
 *   budget==0 -> skip source (no telemetry record; budget itself is the trace)
 *
 * NEVER throws on rate-limit. ONLY throws on Canon Part 8 violation.
 *
 * Network: native Node 18+ global fetch. AbortController gives a per-request
 * 10s default timeout. NO node-fetch, NO axios, NO additional npm dep.
 *
 * Output shape per paper (after dedupe):
 *   { id, title, abstract, authors[], institution, doi, source, fetched_at }
 *
 * Pure CJS, zero npm deps, node built-ins only beyond the three rs-egress-*
 * primitives shipped in Wave 1 (Plan 89.2-01).
 *
 * 2026 package changes (all additive; see rs/CHANGES-commands.md):
 *   - provenance on every record: source_id, source_url, retrieved_at,
 *     retrieval_query, provenance{}; plus an envelope-level provenance block
 *   - cross-source dedupe by DOI, arXiv id and normalised title (was DOI or
 *     title+author only, so an arXiv preprint and its journal version both
 *     survived); duplicates are merged into also_found_in[]
 *   - bounded retry with Retry-After, per-source pacing (arXiv: 1 request per
 *     3 s per its API terms), body read covered by the timeout
 *   - every query is audited BEFORE the first network call (the original
 *     audited lazily, so query N could throw after queries 0..N-1 had already
 *     gone out to openalex)
 *   - per-run budget is enforced per request, not once per source
 *   - SCOPUS key moved from the URL to the X-ELS-APIKey header; URLs that still
 *     carry a key (ieee, nature) are exposed only via built.safe_url
 *   - arXiv parser decodes XML entities, collapses title whitespace, ignores the
 *     API error entry, extracts arxiv_id/doi/published
 *   - PubMed id-only records are flagged metadata_only (no title/abstract)
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

// Iteration order is deliberate: openalex first so it wins doi ties on dedupe;
// arxiv second; pubmed third (the three no-key sources); then the env-key-gated
// sources in alphabetical order for predictability.
const SOURCES = Object.freeze(['openalex', 'arxiv', 'pubmed', 'scopus', 'ieee', 'nature']);

// Sources that require an env-var API key. openalex / arxiv / pubmed are free.
const SOURCE_ENV_VARS = Object.freeze({
  scopus: 'SCOPUS_API_KEY',
  ieee: 'IEEE_API_KEY',
  nature: 'NATURE_API_KEY',
});

const DEFAULT_TIMEOUT_MS = 10000;

const USER_AGENT = 'MindrianOS-Plugin/1.11.0 (https://github.com/jsagir/mindrian-os-plugin)';

// Per-source endpoint base URLs.
const ENDPOINTS = Object.freeze({
  openalex: 'https://api.openalex.org/works',
  arxiv: 'https://export.arxiv.org/api/query',
  pubmed: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
  scopus: 'https://api.elsevier.com/content/search/scopus',
  ieee: 'https://ieeexploreapi.ieee.org/api/v1/search/articles',
  nature: 'https://api.springernature.com/meta/v2/json',
});

// The original six fields first, then the additive 363 fields (type, citation
// count, retraction flag, primary_location for venue and DOAJ status).
const OPENALEX_SELECT = 'id,title,abstract_inverted_index,publication_year,authorships,doi,'
  + 'type,cited_by_count,is_retracted,primary_location';

// Minimum milliseconds between consecutive requests to the same source.
// arXiv API terms: no more than one request every three seconds.
// NCBI E-utilities without a key: at most 3 requests per second.
const MIN_INTERVAL_MS = Object.freeze({
  openalex: 120, arxiv: 3000, pubmed: 340, scopus: 250, ieee: 250, nature: 250,
});

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

// ---------- buildAcademicQuery (THE chokepoint) ----------
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

function buildAcademicQuery(query, source, opts) {
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new TypeError('buildAcademicQuery: query must be a non-empty string');
  }
  if (!SOURCES.includes(source)) {
    throw new TypeError('buildAcademicQuery: unknown source: ' + String(source));
  }

  // Canon Part 8 chokepoint: throws on adversarial query BEFORE URL build.
  auditQueryString(query, 'academic');

  // Env-var gate for paid sources.
  const envVar = SOURCE_ENV_VARS[source];
  if (envVar && !process.env[envVar]) {
    return { skip: true, reason: 'api_key_missing' };
  }

  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': source === 'arxiv' ? 'application/atom+xml' : 'application/json',
  };

  // OpenAlex: an optional service key rides ONLY as a Bearer header. It is
  // never appended to the URL and never reaches telemetry, envelopes or errors.
  if (source === 'openalex') {
    const oaKey = process.env.OPENALEX_API_KEY;
    if (typeof oaKey === 'string' && oaKey.length > 0) {
      headers.Authorization = 'Bearer ' + oaKey;
    }
  }

  const encoded = encodeURIComponent(query);
  let url;
  switch (source) {
    case 'openalex': {
      const email = process.env.OPENALEX_EMAIL || 'noreply@mindrian-os.com';
      const wanted = (opts && typeof opts.perPage === 'number') ? (opts.perPage | 0) : 200;
      const perPage = Math.min(Math.max(1, wanted || 200), 200);
      url = ENDPOINTS.openalex
        + '?search=' + encoded
        + '&per-page=' + perPage
        + '&select=' + encodeURIComponent(OPENALEX_SELECT)
        + '&mailto=' + encodeURIComponent(email);
      break;
    }
    case 'arxiv': {
      url = ENDPOINTS.arxiv
        + '?search_query=' + encodeURIComponent('all:' + query)
        + '&start=0&max_results=200';
      break;
    }
    case 'pubmed': {
      // NCBI asks clients to identify themselves (tool, and an email when known).
      url = ENDPOINTS.pubmed
        + '?db=pubmed&term=' + encoded
        + '&retmax=200&retmode=json&tool=mindrian-os'
        + (process.env.NCBI_EMAIL ? '&email=' + encodeURIComponent(process.env.NCBI_EMAIL) : '');
      break;
    }
    case 'scopus': {
      // Elsevier accepts the key as a header, which keeps it out of every URL.
      url = ENDPOINTS.scopus
        + '?query=' + encoded;
      headers['X-ELS-APIKey'] = process.env.SCOPUS_API_KEY;
      break;
    }
    case 'ieee': {
      url = ENDPOINTS.ieee
        + '?querytext=' + encoded
        + '&apikey=' + encodeURIComponent(process.env.IEEE_API_KEY)
        + '&max_records=200';
      break;
    }
    case 'nature': {
      url = ENDPOINTS.nature
        + '?q=' + encoded
        + '&api_key=' + encodeURIComponent(process.env.NATURE_API_KEY);
      break;
    }
    default:
      // SOURCES list is frozen; this path is unreachable but the linter
      // appreciates the explicit fallthrough.
      throw new TypeError('buildAcademicQuery: unhandled source: ' + source);
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

// Reads one numeric (float) header by name; null when absent or not a number.
// Used for the OpenAlex metering headers (x-ratelimit-*-usd).
function readNumberHeader(headers, name) {
  if (!headers) return null;
  let v;
  if (typeof headers.get === 'function') {
    v = headers.get(name);
  } else if (Object.prototype.hasOwnProperty.call(headers, name)) {
    v = headers[name];
  }
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

// ---------- Abstract reconstruction (port of rs_corpus.py invert_abstract) ----------

function invertAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const pairs = [];
  for (const word of Object.keys(invertedIndex)) {
    const positions = invertedIndex[word];
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      const n = parseInt(pos, 10);
      if (Number.isNaN(n)) continue;
      pairs.push([n, word]);
    }
  }
  pairs.sort(function (a, b) { return a[0] - b[0]; });
  return pairs.map(function (p) { return p[1]; }).join(' ');
}

// ---------- Title normalization + dedup key (port of rs_corpus.py) ----------

function normalizeTitle(s) {
  if (!s || typeof s !== 'string') return '';
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// DOI normalisation: lowercase, strip resolver host and "doi:" prefix, trim
// trailing punctuation that survives copy/paste. Returns '' when not a DOI.
function normalizeDoi(raw) {
  if (typeof raw !== 'string') return '';
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
  d = d.replace(/[\s.,;]+$/, '');
  return /^10\.\d{4,9}\/\S+$/.test(d) ? d : '';
}

// arXiv id normalisation: accepts abs/pdf URLs or "arXiv:" prefixes, drops the
// version suffix so v1 and v3 of one preprint dedupe. Returns '' when absent.
function normalizeArxivId(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  s = s.replace(/^https?:\/\/(?:export\.)?arxiv\.org\/(?:abs|pdf)\//i, '').replace(/^arxiv:\s*/i, '');
  s = s.replace(/\.pdf$/i, '').replace(/v\d+$/i, '');
  return /^(?:\d{4}\.\d{4,5}|[a-z\-]+(?:\.[A-Za-z]{2})?\/\d{7})$/i.test(s) ? s.toLowerCase() : '';
}

function dedupKey(doc) {
  const doi = normalizeDoi(doc && doc.doi);
  if (doi) return 'doi:' + doi;
  const titleNorm = normalizeTitle((doc && doc.title) || '');
  let firstAuthor = '';
  if (doc && Array.isArray(doc.authors) && doc.authors.length > 0) {
    const a = String(doc.authors[0] || '');
    const parts = a.split(/\s+/);
    firstAuthor = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : '';
  }
  if (titleNorm) {
    return 'title:' + titleNorm + '|' + firstAuthor;
  }
  return 'id:' + ((doc && doc.id) || '');
}

// All keys under which a record may match another record. Order matters only
// for readability; any shared key marks a duplicate. Titles shorter than 20
// normalised characters are too generic to match on alone.
function dedupKeys(doc) {
  const keys = [];
  if (!doc || typeof doc !== 'object') return ['id:'];
  if (doc.metadata_only) {
    keys.push('id:' + (doc.id || ''));
    return keys;
  }
  const doi = normalizeDoi(doc.doi);
  if (doi) keys.push('doi:' + doi);
  const ax = normalizeArxivId(doc.arxiv_id || (doc.source === 'arxiv' ? doc.id : ''));
  if (ax) keys.push('arxiv:' + ax);
  const t = normalizeTitle(doc.title || '');
  if (t.length >= 20) keys.push('title:' + t);
  keys.push(dedupKey(doc));
  return keys.filter(function (k, i) { return keys.indexOf(k) === i; });
}

// First-seen wins (openalex runs first). A later duplicate is not emitted; its
// source is recorded on the survivor in also_found_in[] and any field the
// survivor lacks (doi, arxiv_id, abstract) is back-filled.
function dedupe(docs) {
  const index = new Map();
  const out = [];
  for (const doc of docs) {
    const keys = dedupKeys(doc);
    let hit = -1;
    for (const k of keys) {
      if (index.has(k)) { hit = index.get(k); break; }
    }
    if (hit >= 0) {
      const keep = out[hit];
      if (keep && doc && typeof doc === 'object') {
        if (doc.source && doc.source !== keep.source) {
          if (!Array.isArray(keep.also_found_in)) keep.also_found_in = [];
          if (keep.also_found_in.indexOf(doc.source) < 0) keep.also_found_in.push(doc.source);
        }
        if (!keep.doi && doc.doi) keep.doi = doc.doi;
        if (!keep.arxiv_id && doc.arxiv_id) keep.arxiv_id = doc.arxiv_id;
        if (!keep.abstract && doc.abstract) keep.abstract = doc.abstract;
      }
      for (const k of keys) { if (!index.has(k)) index.set(k, hit); }
      continue;
    }
    const at = out.length;
    out.push(doc);
    for (const k of keys) index.set(k, at);
  }
  return out;
}

// ---------- Per-source response parsers ----------

function parseOpenAlex(json) {
  const out = [];
  if (!json || !Array.isArray(json.results)) return out;
  for (const w of json.results) {
    if (!w || typeof w !== 'object') continue;
    const abstract = invertAbstract(w.abstract_inverted_index);
    const authors = [];
    let institution = '';
    if (Array.isArray(w.authorships)) {
      for (const a of w.authorships.slice(0, 5)) {
        if (a && a.author && typeof a.author.display_name === 'string') {
          authors.push(a.author.display_name);
        }
        if (!institution && a && Array.isArray(a.institutions) && a.institutions.length > 0) {
          institution = a.institutions[0].display_name || '';
        }
      }
    }
    out.push({
      id: w.id || '',
      title: w.title || '',
      abstract: abstract,
      authors: authors,
      institution: institution,
      doi: w.doi || '',
      source: 'openalex',
      fetched_at: new Date().toISOString(),
      source_id: w.id || '',
      source_url: w.id || '',
      // Additive 363 fields (D-16): retraction flag, work type, citation count,
      // venue name and DOAJ status. null means the provider did not say.
      is_retracted: typeof w.is_retracted === 'boolean' ? w.is_retracted : null,
      type: typeof w.type === 'string' ? w.type : null,
      cited_by_count: typeof w.cited_by_count === 'number' ? w.cited_by_count : null,
      venue: (w.primary_location && w.primary_location.source
        && typeof w.primary_location.source.display_name === 'string')
        ? w.primary_location.source.display_name : null,
      is_in_doaj: (w.primary_location && w.primary_location.source
        && typeof w.primary_location.source.is_in_doaj === 'boolean')
        ? w.primary_location.source.is_in_doaj : null,
    });
  }
  return out;
}

function decodeXmlEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, function (_m, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_m, d) { return String.fromCodePoint(parseInt(d, 10)); })
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function cleanXmlText(s) {
  return decodeXmlEntities(s).replace(/\s+/g, ' ').trim();
}

function parseArxivXml(xmlText) {
  const out = [];
  if (typeof xmlText !== 'string' || xmlText.length === 0) return out;
  // Minimalist regex-based Atom parser. Accepts only well-formed entries.
  // Throws on shape mismatch upstream so api_error telemetry is recorded.
  if (xmlText.indexOf('<feed') < 0 && xmlText.indexOf('<entry') < 0) {
    throw new Error('arxiv: not an atom feed');
  }
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  const entries = xmlText.match(entryRe) || [];
  for (const e of entries) {
    const idMatch = e.match(/<id>([\s\S]*?)<\/id>/);
    const titleMatch = e.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = e.match(/<summary>([\s\S]*?)<\/summary>/);
    const doiMatch = e.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/);
    const pubMatch = e.match(/<published>([\s\S]*?)<\/published>/);
    const authorMatches = [];
    const authorRe = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
    let m;
    while ((m = authorRe.exec(e)) !== null) {
      authorMatches.push(cleanXmlText(m[1]));
      if (authorMatches.length >= 5) break;
    }
    const id = (idMatch && idMatch[1] || '').trim();
    // The arXiv API reports a malformed request as a feed with one entry whose
    // id points at /api/errors. It is not a paper.
    if (id.indexOf('/api/errors') >= 0) continue;
    const title = cleanXmlText(titleMatch && titleMatch[1] || '');
    const abstract = cleanXmlText(summaryMatch && summaryMatch[1] || '');
    if (!abstract) continue;
    const arxivId = normalizeArxivId(id);
    out.push({
      id: id,
      title: title,
      abstract: abstract,
      authors: authorMatches,
      institution: '',
      doi: normalizeDoi(cleanXmlText(doiMatch && doiMatch[1] || '')),
      source: 'arxiv',
      fetched_at: new Date().toISOString(),
      arxiv_id: arxivId,
      source_id: arxivId || id,
      source_url: id,
      published: cleanXmlText(pubMatch && pubMatch[1] || '') || null,
    });
  }
  return out;
}

function parsePubMed(json) {
  const out = [];
  if (!json || !json.esearchresult || !Array.isArray(json.esearchresult.idlist)) return out;
  for (const id of json.esearchresult.idlist) {
    out.push({
      id: 'pubmed:' + id,
      title: 'PubMed record ' + id,
      abstract: '',
      authors: [],
      institution: '',
      doi: '',
      source: 'pubmed',
      fetched_at: new Date().toISOString(),
      // esearch returns ids only. Downstream scoring must not treat the
      // placeholder title as content; metadata_only marks that.
      metadata_only: true,
      source_id: String(id),
      source_url: 'https://pubmed.ncbi.nlm.nih.gov/' + encodeURIComponent(String(id)) + '/',
    });
  }
  return out;
}

function scopusLink(e) {
  if (Array.isArray(e && e.link)) {
    for (const l of e.link) {
      if (l && l['@ref'] === 'scopus' && typeof l['@href'] === 'string') return l['@href'];
    }
  }
  return '';
}

function parseScopus(json) {
  const out = [];
  if (!json || !json['search-results'] || !Array.isArray(json['search-results'].entry)) return out;
  for (const e of json['search-results'].entry) {
    if (!e || typeof e !== 'object') continue;
    let institution = '';
    if (Array.isArray(e.affiliation) && e.affiliation.length > 0) {
      institution = e.affiliation[0].affilname || '';
    }
    out.push({
      id: e['dc:identifier'] || '',
      title: e['dc:title'] || '',
      abstract: e['dc:description'] || '',
      authors: e['dc:creator'] ? [e['dc:creator']] : [],
      institution: institution,
      doi: e['prism:doi'] || '',
      source: 'scopus',
      fetched_at: new Date().toISOString(),
      source_id: e['dc:identifier'] || '',
      source_url: scopusLink(e),
    });
  }
  return out;
}

function parseIeee(json) {
  const out = [];
  if (!json || !Array.isArray(json.articles)) return out;
  for (const a of json.articles) {
    if (!a || typeof a !== 'object') continue;
    const authors = [];
    let institution = '';
    if (a.authors && Array.isArray(a.authors.authors)) {
      for (const au of a.authors.authors.slice(0, 5)) {
        if (au && au.full_name) authors.push(au.full_name);
        if (!institution && au && au.affiliation) institution = au.affiliation;
      }
    }
    out.push({
      id: 'ieee:' + (a.article_number || ''),
      title: a.title || '',
      abstract: a.abstract || '',
      authors: authors,
      institution: institution,
      doi: a.doi || '',
      source: 'ieee',
      fetched_at: new Date().toISOString(),
      source_id: a.article_number ? String(a.article_number) : '',
      source_url: a.html_url || (a.article_number ? 'https://ieeexplore.ieee.org/document/' + a.article_number : ''),
    });
  }
  return out;
}

function parseNature(json) {
  const out = [];
  if (!json || !Array.isArray(json.records)) return out;
  for (const r of json.records) {
    if (!r || typeof r !== 'object') continue;
    const authors = [];
    if (Array.isArray(r.creators)) {
      for (const c of r.creators.slice(0, 5)) {
        if (c && c.creator) authors.push(c.creator);
      }
    }
    out.push({
      id: r.identifier || '',
      title: r.title || '',
      abstract: r.abstract || '',
      authors: authors,
      institution: '',
      doi: r.doi || '',
      source: 'nature',
      fetched_at: new Date().toISOString(),
      source_id: r.identifier || r.doi || '',
      source_url: (typeof r.url === 'string') ? r.url : (Array.isArray(r.url) && r.url[0] && r.url[0].value ? r.url[0].value : ''),
    });
  }
  return out;
}

function parseSourceResponse(payload, source) {
  switch (source) {
    case 'openalex': return parseOpenAlex(payload);
    case 'arxiv': return parseArxivXml(payload);
    case 'pubmed': return parsePubMed(payload);
    case 'scopus': return parseScopus(payload);
    case 'ieee': return parseIeee(payload);
    case 'nature': return parseNature(payload);
    default: return [];
  }
}

// ---------- normalizePaper ----------
//
// Final shape guarantee. Per-source parsers already produce this shape
// but normalizePaper is exposed so future call sites can canonicalize
// hand-constructed records.

const ADDITIVE_PAPER_FIELDS = Object.freeze([
  'is_retracted', 'type', 'cited_by_count', 'venue', 'is_in_doaj',
  // 2026 provenance and merge fields
  'source_id', 'source_url', 'retrieved_at', 'retrieval_query', 'provenance',
  'arxiv_id', 'published', 'metadata_only', 'also_found_in',
]);

function normalizePaper(raw) {
  const base = {
    id: raw && raw.id ? String(raw.id) : '',
    title: raw && raw.title ? String(raw.title) : '',
    abstract: raw && raw.abstract ? String(raw.abstract) : '',
    authors: raw && Array.isArray(raw.authors) ? raw.authors.slice(0, 5).map(String) : [],
    institution: raw && raw.institution ? String(raw.institution) : '',
    doi: raw && raw.doi ? String(raw.doi) : '',
    source: raw && raw.source ? String(raw.source) : '',
    fetched_at: raw && raw.fetched_at ? String(raw.fetched_at) : new Date().toISOString(),
  };
  // Additive 363 fields survive only when the record already carries them, so
  // hand-built records keep their exact prior shape.
  if (raw && typeof raw === 'object') {
    for (const f of ADDITIVE_PAPER_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(raw, f)) base[f] = raw[f];
    }
  }
  return base;
}

// Metering and count facts for one OpenAlex response. Only numbers, the
// provider's own count and its translated query; never a header object.
function buildOpenAlexMeta(headers, body) {
  const bodyMeta = (body && typeof body === 'object' && body.meta && typeof body.meta === 'object') ? body.meta : {};
  let xq = null;
  if (typeof bodyMeta.x_query === 'string') xq = bodyMeta.x_query;
  else if (body && typeof body.x_query === 'string') xq = body.x_query;
  return {
    count: (typeof bodyMeta.count === 'number' && Number.isFinite(bodyMeta.count)) ? bodyMeta.count : null,
    cost_usd: readNumberHeader(headers, 'x-ratelimit-cost-usd'),
    remaining_usd: readNumberHeader(headers, 'x-ratelimit-remaining-usd'),
    limit_usd: readNumberHeader(headers, 'x-ratelimit-limit-usd'),
    x_query: xq,
  };
}

// ---------- fetchAcademic ----------
//
// Top-level orchestrator. Iterates SOURCES in frozen order; per source
// iterates the input queries. Per (source, query) tuple:
//   1. Check budget. budget==0 -> skip source for this run.
//   2. Build query via chokepoint (throws ExternalEgressViolation on adversarial).
//   3. If skip (api_key_missing) -> recordTelemetry + continue.
//   4. fetchWithTimeout -> on timeout: recordTelemetry + continue.
//   5. status 429/503 -> recordTelemetry(rate_limited) + continue.
//   6. parse response. parse error -> recordTelemetry(api_error) + continue.
//   7. recordTelemetry(ok) + accumulate papers.
// After all sources, dedupe and return.

async function fetchAcademic(queries, opts) {
  if (!Array.isArray(queries)) {
    throw new TypeError('fetchAcademic: queries must be an array of non-empty strings');
  }
  for (const q of queries) {
    if (typeof q !== 'string' || q.trim().length === 0) {
      throw new TypeError('fetchAcademic: each query must be a non-empty string');
    }
  }
  opts = opts || {};
  const budgetOverrides = opts.budget || {};

  // Pre-flight Canon Part 8 audit: every query is checked BEFORE the first
  // request, so an adversarial query in position N can no longer be preceded
  // by real egress for queries 0..N-1. Zero telemetry is recorded on a throw.
  for (const q of queries) {
    auditQueryString(q, 'academic');
  }
  // Identical queries would burn budget twice for the same answer.
  const queryList = queries.filter(function (q, i) { return queries.indexOf(q) === i; });

  const out = { papers: [], telemetry: [] };
  const sourcesAttempted = [];
  let rawCount = 0;

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

    let used = 0;
    for (const query of queryList) {
      // 2026: the remaining budget is spent per request, so a long query list
      // can no longer run a source past its 24h cap inside a single call.
      if (used >= remaining) {
        out.telemetry.push({ source: source, status: 'budget_exhausted' });
        break;
      }

      // Build first. Throws ExternalEgressViolation if adversarial (already
      // cleared by the pre-flight loop; kept as defence in depth).
      const built = buildAcademicQuery(query, source, opts);

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

      if (sourcesAttempted.indexOf(source) < 0) sourcesAttempted.push(source);
      used += 1;

      const r = await requestWithRetry(
        built, source, (source === 'arxiv') ? 'text' : 'json', opts,
        function (res) {
          // OpenAlex meters in USD; remaining exactly 0 means spent, not throttled.
          return source === 'openalex' && readNumberHeader(res.headers, 'x-ratelimit-remaining-usd') === 0;
        }
      );

      if (r.kind === 'timeout' || r.kind === 'network_error') {
        recordTelemetry({ source: source, query_text: query, status: r.kind });
        out.telemetry.push({ source: source, status: r.kind, attempts: r.attempts });
        continue;
      }

      if (r.kind === 'http') {
        const res = r.res;
        const httpStatus = res.status || 0;
        if (httpStatus === 429 || httpStatus === 503) {
          recordTelemetry({
            source: source,
            query_text: query,
            status: 'rate_limited',
            http_status: httpStatus,
          });
          const limRec = { source: source, status: 'rate_limited', http_status: httpStatus, attempts: r.attempts };
          if (source === 'openalex' && readNumberHeader(res.headers, 'x-ratelimit-remaining-usd') === 0) {
            limRec.budget_exhausted = true;
          }
          out.telemetry.push(limRec);
          continue;
        }
        recordTelemetry({
          source: source,
          query_text: query,
          status: 'api_error',
          http_status: httpStatus,
        });
        out.telemetry.push({ source: source, status: 'api_error', http_status: httpStatus, attempts: r.attempts });
        continue;
      }

      let parsed = null;
      let jsonBody = null;
      if (r.kind === 'parse_error') {
        parsed = null;
      } else {
        try {
          if (source !== 'arxiv') jsonBody = r.payload;
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
      const okRec = { source: source, status: 'ok', http_status: res.status || 200, attempts: r.attempts, records: parsed.length };
      if (source === 'openalex') {
        okRec.meta = buildOpenAlexMeta(res.headers, jsonBody);
      }
      out.telemetry.push(okRec);

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
          tool: TOOL_ID,
        };
        out.papers.push(p);
        rawCount += 1;
      }
    }
  }

  // First-seen wins on dedupe; openalex ran first so it wins doi ties.
  out.papers = dedupe(out.papers);

  // ---- Phase 94 Plan 05 amendment: envelope wrap ----
  // Determine source tag: prefer the first source in telemetry that
  // returned status:'ok'. Fall back to SOURCES[0] when no source
  // produced data (so the envelope still has a valid source tag and
  // the assertEnvelope T5/academic gate passes on shape uniformity).
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
    results: out.papers.slice(),
    papers: out.papers,
    telemetry: out.telemetry,
    // 2026 additive: what was run, with which parameters, and when.
    provenance: {
      tool: TOOL_ID,
      retrieved_at: new Date().toISOString(),
      queries: queryList.slice(),
      sources_attempted: sourcesAttempted,
      params: {
        timeout_ms: (typeof opts.timeoutMs === 'number') ? opts.timeoutMs : DEFAULT_TIMEOUT_MS,
        max_retries: (typeof opts.maxRetries === 'number') ? opts.maxRetries : DEFAULT_MAX_RETRIES,
        min_interval_ms: MIN_INTERVAL_MS,
      },
      dedupe: {
        input_count: rawCount,
        output_count: out.papers.length,
        merged_count: rawCount - out.papers.length,
      },
    },
  };
}

// ---------- Per-source dispatchers ----------
//
// Convenience entry points for callers that want one source. All four
// route through fetchAcademic internally (limiting SOURCES to the one
// requested) so the chokepoint exclusivity rule is preserved.

async function fetchOneSource(source, queries, opts) {
  const orig = SOURCES.slice();
  // Build a one-source orchestrator by delegating to fetchAcademic with
  // a budget map that zeroes out every other source. This keeps the
  // chokepoint exclusivity invariant intact (no new fetch sites).
  opts = opts || {};
  const budget = Object.assign({}, opts.budget || {});
  for (const s of orig) {
    if (s !== source) budget[s] = 0;
  }
  const merged = Object.assign({}, opts, { budget: budget });
  // OpenAlex honors the caller's limit as per-page (capped at 200 in the
  // chokepoint). Callers that pass neither perPage nor limit keep 200.
  if (source === 'openalex' && merged.perPage === undefined
    && typeof merged.limit === 'number' && Number.isFinite(merged.limit) && merged.limit > 0) {
    merged.perPage = Math.floor(merged.limit);
  }
  return fetchAcademic(queries, merged);
}

async function fetchOpenAlex(queries, opts) { return fetchOneSource('openalex', queries, opts); }
async function fetchArxiv(queries, opts) { return fetchOneSource('arxiv', queries, opts); }
async function fetchPubMed(queries, opts) { return fetchOneSource('pubmed', queries, opts); }
async function fetchScopus(queries, opts) { return fetchOneSource('scopus', queries, opts); }
async function fetchIeee(queries, opts) { return fetchOneSource('ieee', queries, opts); }
async function fetchNature(queries, opts) { return fetchOneSource('nature', queries, opts); }

// ---------- Exports ----------

module.exports = {
  fetchAcademic,
  buildAcademicQuery,
  fetchOpenAlex,
  fetchArxiv,
  fetchPubMed,
  fetchScopus,
  fetchIeee,
  fetchNature,
  // Test surface (private; do NOT consume in production).
  _test: {
    dedupe,
    dedupKey,
    normalizeTitle,
    normalizePaper,
    invertAbstract,
    fetchWithTimeout,
    parseSourceResponse,
    parseOpenAlex,
    parseArxivXml,
    parsePubMed,
    parseScopus,
    parseIeee,
    parseNature,
    parseRateLimit,
    readNumberHeader,
    dedupKeys,
    normalizeDoi,
    normalizeArxivId,
    decodeXmlEntities,
    requestWithRetry,
    parseRetryAfterMs,
    backoffMs,
    paceSource,
    redactUrl,
    MIN_INTERVAL_MS,
    buildOpenAlexMeta,
    OPENALEX_SELECT,
    SOURCES,
    SOURCE_ENV_VARS,
    ENDPOINTS,
    DEFAULT_TIMEOUT_MS,
    USER_AGENT,
  },
};
