/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 02 -- Academic external-egress fetcher.
 *
 * Six sources covered with one Canon Part 8 chokepoint:
 *   openalex   no API key       polite pool via OPENALEX_EMAIL env
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
  if (typeof query !== 'string' || query.length === 0) {
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

  const encoded = encodeURIComponent(query);
  let url;
  switch (source) {
    case 'openalex': {
      const email = process.env.OPENALEX_EMAIL || 'noreply@mindrian.ai';
      url = ENDPOINTS.openalex
        + '?search=' + encoded
        + '&per-page=200'
        + '&select=' + encodeURIComponent('id,title,abstract_inverted_index,publication_year,authorships,doi')
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
      url = ENDPOINTS.pubmed
        + '?db=pubmed&term=' + encoded
        + '&retmax=200&retmode=json';
      break;
    }
    case 'scopus': {
      url = ENDPOINTS.scopus
        + '?query=' + encoded
        + '&apiKey=' + encodeURIComponent(process.env.SCOPUS_API_KEY);
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

function dedupKey(doc) {
  if (doc && typeof doc.doi === 'string' && doc.doi.trim().length > 0) {
    let norm = doc.doi.trim().toLowerCase();
    norm = norm.replace('https://doi.org/', '').replace('http://doi.org/', '');
    return 'doi:' + norm;
  }
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

function dedupe(docs) {
  const seen = new Set();
  const out = [];
  for (const doc of docs) {
    const key = dedupKey(doc);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
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
    });
  }
  return out;
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
    const authorMatches = [];
    const authorRe = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
    let m;
    while ((m = authorRe.exec(e)) !== null) {
      authorMatches.push(m[1].trim());
      if (authorMatches.length >= 5) break;
    }
    const id = (idMatch && idMatch[1] || '').trim();
    const title = (titleMatch && titleMatch[1] || '').trim();
    const abstract = (summaryMatch && summaryMatch[1] || '').trim();
    if (!abstract) continue;
    out.push({
      id: id,
      title: title,
      abstract: abstract,
      authors: authorMatches,
      institution: '',
      doi: '',
      source: 'arxiv',
      fetched_at: new Date().toISOString(),
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
    });
  }
  return out;
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

function normalizePaper(raw) {
  return {
    id: raw && raw.id ? String(raw.id) : '',
    title: raw && raw.title ? String(raw.title) : '',
    abstract: raw && raw.abstract ? String(raw.abstract) : '',
    authors: raw && Array.isArray(raw.authors) ? raw.authors.slice(0, 5).map(String) : [],
    institution: raw && raw.institution ? String(raw.institution) : '',
    doi: raw && raw.doi ? String(raw.doi) : '',
    source: raw && raw.source ? String(raw.source) : '',
    fetched_at: raw && raw.fetched_at ? String(raw.fetched_at) : new Date().toISOString(),
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
    if (typeof q !== 'string' || q.length === 0) {
      throw new TypeError('fetchAcademic: each query must be a non-empty string');
    }
  }
  opts = opts || {};
  const budgetOverrides = opts.budget || {};

  const out = { papers: [], telemetry: [] };

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
      // Build first. Throws ExternalEgressViolation if adversarial.
      // We intentionally do NOT catch here so the adversarial query
      // surfaces immediately and ZERO telemetry is recorded for it.
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
        // arxiv returns Atom XML; everyone else returns JSON.
        const payload = (source === 'arxiv') ? await res.text() : await res.json();
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
        out.papers.push(p);
      }
    }
  }

  // First-seen wins on dedupe; openalex ran first so it wins doi ties.
  out.papers = dedupe(out.papers);
  return out;
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
    SOURCES,
    SOURCE_ENV_VARS,
    ENDPOINTS,
    DEFAULT_TIMEOUT_MS,
    USER_AGENT,
  },
};
