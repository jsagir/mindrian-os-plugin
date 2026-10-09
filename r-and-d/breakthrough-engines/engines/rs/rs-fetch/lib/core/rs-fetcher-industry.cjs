/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 04 -- Industry external-egress fetcher.
 * Phase 94 Plan 05 amendment (2026-04-28): paid -> native -> cache
 * fallback chain via opts.tavily / opts.webSearch / opts.cacheReader
 * injection seams. Envelope return shape is now
 *   {tier, source, results, signals, telemetry}
 * with `signals` preserved for backward compat with rs-discovery-
 * engine line 380 industry.signals consumer. tier is one of
 *   'paid' | 'native' | 'cache'
 * source is one of
 *   'tavily' | 'websearch' | 'cache'
 * Per Canon Part 4 each tier transition becomes graph data; per
 * Canon Part 7 the fallback reuses Anthropic native WebSearch
 * instead of building a new client; per Canon Part 8 WebSearch
 * carries user-typed query bytes only (public SIGNAL channel) and
 * the existing brain-client chokepoint is untouched.
 *
 * Single source: Tavily orchestration. Per CONTEXT.md: "Crunchbase +
 * corporate R&D + startup trackers (Tavily-orchestrated)". Tavily is
 * the search-orchestration tier; we do NOT re-implement Crunchbase
 * direct. Each user query expands to 3 refined sub-queries that target
 * startup-database content via Tavily's general web crawl.
 *
 * Single chokepoint: buildIndustryQuery(query, opts) is the ONLY function
 * that constructs an outbound URL + body. Two layers of Canon Part 8 audit
 * fire BEFORE the request is built:
 *   Layer 1: auditQueryString(query, 'industry')          on the user query
 *   Layer 2: auditQueryString(refined, 'industry')        on each refined sub-query
 *
 * The two-layer audit is load-bearing: a clean user query can still be
 * combined with an opts.refinement_template_override that smuggles a
 * forbidden pattern into the refined sub-query. Layer 2 catches that.
 * Both Test 10 (meeting-via-override) and Test 11 (phone-via-override)
 * exercise the second layer.
 *
 * If TAVILY_API_KEY env var is absent: graceful degradation. fetchIndustry
 * returns {signals: [], telemetry: [{source:'tavily', status:'api_key_missing'}]};
 * never throws. Mirrors the api-key-missing pattern from rs-fetcher-academic.
 *
 * Per-source rate-limit graceful degradation per Phase 88.6-03 pattern
 * (mirrors lib/core/rs-fetcher-patents.cjs byte-for-byte):
 *   429 / 503 -> recordTelemetry(status='rate_limited') + return empty
 *   timeout   -> recordTelemetry(status='timeout') + continue
 *   parse err -> recordTelemetry(status='api_error') + continue
 *   budget==0 -> skip Tavily (synthetic 'budget_exhausted' on returned
 *                telemetry; not in v1 ALLOWED_STATUSES so not persisted)
 *
 * NEVER throws on rate-limit. ONLY throws on Canon Part 8 violation.
 *
 * Network: native Node 18+ global fetch. AbortController gives a per-request
 * 10s default timeout. NO node-fetch, NO axios, NO additional npm dep.
 *
 * Output shape per signal (after dedupe):
 *   { company, signal, source, url, fetched_at }
 *
 * Pure CJS, zero npm deps, node built-ins only beyond the three rs-egress-*
 * primitives shipped in Wave 1 (Plan 89.2-01).
 *
 * 2026 package changes (all additive; see rs/CHANGES-commands.md):
 *   - provenance on every signal: source_id, retrieved_at, retrieval_query,
 *     company_basis, verification_status ('unverified': a web snippet is a lead,
 *     never evidence of a company fact), provenance{}; envelope provenance block
 *   - extractCompany no longer reports aggregator hosts (github, medium,
 *     techcrunch, linkedin, ...) as the company, and handles co.uk style
 *     suffixes; the original returned "Github" or "Co" for those
 *   - dedupe by normalised URL as well as company+snippet hash
 *   - the opts.tavily / opts.webSearch seams no longer swallow a Canon Part 8
 *     violation, and adapter failures are reported in telemetry instead of
 *     being silent
 *   - cache-tier records are marked stale and keep their original fetched_at
 *   - bounded retry with Retry-After, pacing, body read under the timeout,
 *     per-run budget enforced per sub-query request
 *   - the Tavily key is also sent as an Authorization Bearer header; the JSON
 *     body still carries api_key for backward compatibility
 */
'use strict';

const crypto = require('node:crypto');

const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryString } = require('./rs-egress-prompts.cjs');
const {
  recordTelemetry,
  computeRemainingBudget,
  DEFAULT_BUDGETS,
} = require('./rs-egress-telemetry.cjs');

// ---------- Frozen invariants ----------

const SOURCES = Object.freeze(['tavily']);

// Tavily is env-key-gated. If TAVILY_API_KEY absent: graceful degradation.
const SOURCE_ENV_VARS = Object.freeze({
  tavily: 'TAVILY_API_KEY',
});

const DEFAULT_TIMEOUT_MS = 10000;

const USER_AGENT = 'MindrianOS-Plugin/1.11.0 (https://github.com/jsagir/mindrian-os-plugin)';

// Tavily Search API endpoint. POST with JSON body carrying api_key + query
// + max_results + search_depth.
const ENDPOINT_TAVILY = 'https://api.tavily.com/search';

// Frozen-order refinement templates. Three sub-queries per user query so
// Tavily's web crawl gets variation while staying anchored on the user's
// intent. Order is deterministic so same input -> byte-identical fetch
// sequence (Test 2 dedup determinism fence).
const REFINEMENT_TEMPLATES = Object.freeze([
  '{query} startup OR company OR venture site:crunchbase.com OR site:pitchbook.com',
  '{query} corporate research lab OR R&D announcement',
  '{query} early stage funding OR seed round OR series A OR series B',
]);

const MAX_RESULTS_PER_SUBQUERY = 5;

// Minimum milliseconds between consecutive requests to the same source.
const MIN_INTERVAL_MS = Object.freeze({ tavily: 250 });

// Hosts whose second-level domain names a publisher or platform, not the
// company a result is about. For these the title is used instead.
const AGGREGATOR_SLDS = Object.freeze(new Set([
  'github', 'gitlab', 'medium', 'substack', 'linkedin', 'twitter', 'x', 'facebook',
  'youtube', 'reddit', 'wikipedia', 'quora', 'techcrunch', 'crunchbase', 'pitchbook',
  'forbes', 'bloomberg', 'reuters', 'wsj', 'ft', 'cnbc', 'businesswire', 'prnewswire',
  'globenewswire', 'sec', 'arxiv', 'researchgate', 'google', 'apple', 'ycombinator',
  'producthunt', 'angel', 'wellfound', 'dealroom', 'cbinsights', 'owler', 'zoominfo',
  'venturebeat', 'theverge', 'wired', 'nytimes', 'bbc', 'cnn', 'yahoo', 'msn',
]));
const COMPOUND_SLDS = Object.freeze(new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']));
const TITLE_STOPWORDS = Object.freeze(new Set([
  'The', 'A', 'An', 'How', 'Why', 'What', 'When', 'Where', 'Who', 'Top', 'Best', 'New',
  'This', 'These', 'Our', 'Your', 'We', 'It', 'In', 'On', 'For', 'Of', 'And', 'To',
]));

// signal.signal field is capped at 200 chars per CONTEXT.md spec.
const SIGNAL_MAX_CHARS = 200;

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

// ---------- buildIndustryQuery (THE chokepoint) ----------
//
// This is the ONLY function in the module that constructs an outbound URL.
// Every dispatcher invokes it. auditQueryString runs at TWO layers:
//   Layer 1: on the user query (clean? no forbidden pattern in the input?)
//   Layer 2: on each refined sub-query (clean? no forbidden pattern after
//            template substitution? defends against opts-override smuggling)
//
// Returns one of:
//   { skip: true,  reason: 'api_key_missing' }   when TAVILY_API_KEY absent
//   { skip: false, url, method, headers, refined_subqueries[] } when ready to fetch
//
// Throws:
//   TypeError                if query is not a non-empty string
//   ExternalEgressViolation  if user query OR any refined sub-query matches
//                            FORBIDDEN_PATTERNS

function buildIndustryQuery(query, opts) {
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new TypeError('buildIndustryQuery: query must be a non-empty string');
  }

  // Canon Part 8 layer 1: throws on adversarial USER QUERY before any
  // refined sub-query is computed. Test 8 + Test 9 fences.
  auditQueryString(query, 'industry');

  // Env-var gate. TAVILY_API_KEY absent -> graceful skip.
  const envVar = SOURCE_ENV_VARS.tavily;
  if (envVar && !process.env[envVar]) {
    return { skip: true, reason: 'api_key_missing' };
  }

  opts = opts || {};
  // The opts.refinement_template_override is allowed for testing the
  // second-layer audit; in prod always REFINEMENT_TEMPLATES. The override
  // path is what makes the two-layer defense necessary -- a clean user
  // query can still produce a refined sub-query that contains a forbidden
  // pattern when combined with an adversarial template.
  const templates = (typeof opts.refinement_template_override === 'string'
    && opts.refinement_template_override.length > 0)
    ? [opts.refinement_template_override]
    : REFINEMENT_TEMPLATES;

  const refined = [];
  for (const tmpl of templates) {
    if (typeof tmpl !== 'string') {
      throw new TypeError('buildIndustryQuery: refinement template must be a string');
    }
    const sub = tmpl.replace('{query}', query);

    // Canon Part 8 layer 2: throws on adversarial REFINED SUB-QUERY before
    // the URL/body is constructed. Test 10 (meeting-via-override) + Test 11
    // (phone-via-override) fences.
    auditQueryString(sub, 'industry');

    refined.push(sub);
  }

  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  return {
    skip: false,
    url: ENDPOINT_TAVILY,
    method: 'POST',
    headers: headers,
    source: 'tavily',
    refined_subqueries: refined,
    max_results_per_subquery: (typeof opts.maxResultsPerSubquery === 'number'
      && opts.maxResultsPerSubquery > 0)
      ? opts.maxResultsPerSubquery
      : MAX_RESULTS_PER_SUBQUERY,
  };
}

// ---------- buildTavilyBody ----------
//
// Helper for the per-sub-query POST body. The API key is read from env at
// call time so the test suite's setupScopedHome can mutate it between
// scenarios without restarting the module.

function buildTavilyBody(refinedSubquery, maxResults) {
  return JSON.stringify({
    api_key: process.env.TAVILY_API_KEY,
    query: refinedSubquery,
    max_results: maxResults,
    search_depth: 'advanced',
  });
}

// ---------- fetchWithTimeout (the ONE native fetch call site) ----------
//
// Per the chokepoint exclusivity rule: every dispatcher routes through
// this helper. This is the only place that touches global.fetch.
// Returns the raw Response on success; throws on network error or timeout.

async function fetchWithTimeout(req, opts) {
  const timeoutMs = (opts && typeof opts.timeoutMs === 'number') ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  // 2026: requestWithRetry passes its own controller so the timer also covers
  // the response body read. Standalone callers keep the legacy behaviour.
  const external = (opts && opts._controller) ? opts._controller : null;
  const controller = external || new AbortController();
  const t = external ? null : setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    const init = {
      method: req.method,
      headers: req.headers,
      signal: controller.signal,
    };
    if (typeof req.body === 'string') {
      init.body = req.body;
    }
    const res = await fetch(req.url, init);
    return res;
  } finally {
    if (t) clearTimeout(t);
  }
}

// ---------- parseRateLimit ----------
//
// Pulls a remaining-budget signal out of common HTTP headers. Returns
// undefined if absent.

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

// ---------- extractCompany ----------
//
// Deterministic company-name extraction from Tavily result. Strategy:
//   1. If url has a non-trivial second-level domain, derive a Title-Cased
//      company-like token from it (e.g. example-corp.com -> Example-Corp).
//   2. Else fall back to the first capitalized token from the title.
//   3. Else return 'Unknown' so the field is never empty (Test 1 fence).
//
// NO LLM, NO heuristics that depend on global state. Pure function.

function extractCompanyDetailed(url, title) {
  // Strategy 1: domain-based
  if (typeof url === 'string' && url.length > 0) {
    let host = '';
    try {
      const parsed = new URL(url);
      host = parsed.hostname || '';
    } catch (_e) { /* fall through */ }
    if (host) {
      // Strip leading www. then take the SLD (e.g. 'foo.example.com' -> 'example').
      const stripped = host.replace(/^www\./, '');
      const parts = stripped.split('.');
      // 'example.com' -> ['example','com']; 'sub.example.com' -> ['sub','example','com']
      let sld = '';
      if (parts.length >= 3 && COMPOUND_SLDS.has(parts[parts.length - 2]) && parts[parts.length - 1].length === 2) {
        // 'acme.co.uk' -> 'acme' (the original returned 'co')
        sld = parts[parts.length - 3];
      } else if (parts.length >= 2) {
        sld = parts[parts.length - 2];
      } else if (parts.length === 1) {
        sld = parts[0];
      }
      const aggregator = AGGREGATOR_SLDS.has(sld.toLowerCase());
      if (sld && sld.length > 0 && sld !== 'example' && !aggregator) {
        // Title-case the SLD; preserve dashes.
        const cased = sld.split('-').map(function (seg) {
          return seg.length > 0 ? (seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()) : seg;
        }).join('-');
        if (cased.length > 0) return { company: cased, basis: 'domain' };
      }
      if (sld === 'example') {
        // Distinguish example-foo subdomains from generic example.com.
        // For test fixtures: example-abc1234.com -> Example-Abc1234.
        const cased = sld.charAt(0).toUpperCase() + sld.slice(1);
        return { company: cased, basis: 'domain' };
      }
    }
  }
  // Strategy 2: first capitalized token from title (skipping function words)
  if (typeof title === 'string' && title.length > 0) {
    const tokens = title.split(/\s+/);
    for (const tok of tokens) {
      if (tok.length === 0) continue;
      const c0 = tok.charAt(0);
      if (c0 >= 'A' && c0 <= 'Z') {
        const bare = tok.replace(/[^A-Za-z0-9\-&.]+$/, '');
        if (TITLE_STOPWORDS.has(bare)) continue;
        return { company: tok, basis: 'title' };
      }
    }
  }
  return { company: 'Unknown', basis: 'none' };
}

function extractCompany(url, title) {
  return extractCompanyDetailed(url, title).company;
}

// Canonical URL for dedupe: lowercase host without www, no fragment, no
// tracking parameters, no trailing slash. Returns '' when unparseable.
function normalizeUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  try {
    const u = new URL(raw);
    const keep = [];
    u.searchParams.forEach(function (v, k) {
      if (!/^(utm_|fbclid$|gclid$|ref$|ref_src$|mc_)/i.test(k)) keep.push([k, v]);
    });
    keep.sort(function (a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); });
    const qs = keep.map(function (kv) { return kv[0] + '=' + kv[1]; }).join('&');
    const p = u.pathname.replace(/\/+$/, '');
    return (u.protocol + '//' + u.hostname.toLowerCase().replace(/^www\./, '') + p + (qs ? '?' + qs : ''));
  } catch (_e) {
    return '';
  }
}

// ---------- parseTavilyResponse ----------
//
// Tavily JSON shape: { results: [{ title, url, content, score }, ... ], ... }.
// Throws on completely empty body (treated as api_error upstream); returns
// [] when results is absent or empty (graceful: API responded but had no
// matches).

function parseTavilyResponse(json) {
  const out = [];
  if (!json || typeof json !== 'object') {
    throw new Error('tavily: empty or non-object body');
  }
  if (!Array.isArray(json.results)) return out;
  for (const r of json.results) {
    if (!r || typeof r !== 'object') continue;
    const url = (typeof r.url === 'string' && r.url.length > 0) ? r.url : '';
    const title = typeof r.title === 'string' ? r.title : '';
    const content = typeof r.content === 'string' ? r.content : '';
    if (!url) continue;
    const det = extractCompanyDetailed(url, title);
    const company = det.company;
    let signalText = (content || title || '').slice(0, SIGNAL_MAX_CHARS);
    if (signalText.length === 0) signalText = title.slice(0, SIGNAL_MAX_CHARS);
    if (signalText.length === 0) continue;
    const nowIso = new Date().toISOString();
    out.push({
      company: company,
      signal: signalText,
      source: 'tavily',
      url: url,
      fetched_at: nowIso,
      // 2026 provenance. A web snippet is a lead, not verified evidence.
      source_id: url,
      retrieved_at: nowIso,
      company_basis: det.basis,
      verification_status: 'unverified',
      relevance_score: (typeof r.score === 'number' && Number.isFinite(r.score)) ? r.score : null,
      published_date: (typeof r.published_date === 'string') ? r.published_date : null,
    });
  }
  return out;
}

// ---------- normalizeSignal ----------
//
// Final shape guarantee. parseTavilyResponse already produces this shape
// but normalizeSignal is exposed so future call sites can canonicalize
// hand-constructed records.

const ADDITIVE_SIGNAL_FIELDS = Object.freeze([
  'source_id', 'retrieved_at', 'retrieval_query', 'company_basis', 'verification_status',
  'relevance_score', 'published_date', 'provenance', 'stale', 'served_from_cache', 'also_found_in',
]);

function normalizeSignal(raw) {
  const base = {
    company: raw && raw.company ? String(raw.company) : 'Unknown',
    signal: raw && raw.signal ? String(raw.signal).slice(0, SIGNAL_MAX_CHARS) : '',
    source: raw && raw.source ? String(raw.source) : '',
    url: raw && raw.url ? String(raw.url) : '',
    fetched_at: raw && raw.fetched_at ? String(raw.fetched_at) : new Date().toISOString(),
  };
  if (raw && typeof raw === 'object') {
    for (const f of ADDITIVE_SIGNAL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(raw, f)) base[f] = raw[f];
    }
  }
  return base;
}

// ---------- Dedup key + dedupe ----------
//
// dedup key per CONTEXT.md: hash of (company_normalized + signal_text_first_50_chars_hash).
// First-seen wins so refined-template iteration order determines tie-breaking.

function dedupKey(s) {
  if (!s || typeof s !== 'object') return 'unknown:' + JSON.stringify(s || {});
  const company = (typeof s.company === 'string') ? s.company.toLowerCase().trim() : '';
  const signalHead = (typeof s.signal === 'string') ? s.signal.slice(0, 50) : '';
  const sha = crypto.createHash('sha256').update(company + '|' + signalHead).digest('hex').slice(0, 16);
  return 'industry:' + sha;
}

function dedupe(signals) {
  const seen = new Map();
  const out = [];
  for (const s of signals) {
    const keys = [dedupKey(s)];
    const nu = normalizeUrl(s && s.url);
    if (nu) keys.push('url:' + nu);
    let hit = -1;
    for (const k of keys) { if (seen.has(k)) { hit = seen.get(k); break; } }
    if (hit >= 0) {
      const keep = out[hit];
      if (keep && s && typeof s === 'object' && s.source && s.source !== keep.source) {
        if (!Array.isArray(keep.also_found_in)) keep.also_found_in = [];
        if (keep.also_found_in.indexOf(s.source) < 0) keep.also_found_in.push(s.source);
      }
      for (const k of keys) { if (!seen.has(k)) seen.set(k, hit); }
      continue;
    }
    for (const k of keys) seen.set(k, out.length);
    out.push(s);
  }
  return out;
}

// ---------- normalizeIncoming (Phase 94 Plan 05 envelope helper) ----------
//
// Accepts either Tavily-shape {url, title, content/snippet} or canonical
// signal shape {company, signal, url} and returns the canonical signal
// shape. Used by the opts.tavily / opts.webSearch / opts.cacheReader
// injection seams so the envelope's results[] is always the same shape.

function normalizeIncoming(r, sourceTag) {
  if (!r || typeof r !== 'object') {
    return {
      company: 'Unknown',
      signal: '',
      source: sourceTag || '',
      url: '',
      fetched_at: new Date().toISOString(),
    };
  }
  const nowIso = new Date().toISOString();
  // Already canonical signal shape?
  if (typeof r.company === 'string' && typeof r.signal === 'string') {
    const url0 = typeof r.url === 'string' ? r.url : '';
    const fetchedAt = typeof r.fetched_at === 'string' ? r.fetched_at : nowIso;
    return {
      company: r.company,
      signal: r.signal.slice(0, SIGNAL_MAX_CHARS),
      source: typeof r.source === 'string' && r.source.length > 0 ? r.source : (sourceTag || ''),
      url: url0,
      fetched_at: fetchedAt,
      source_id: typeof r.source_id === 'string' ? r.source_id : url0,
      retrieved_at: typeof r.retrieved_at === 'string' ? r.retrieved_at : fetchedAt,
      company_basis: typeof r.company_basis === 'string' ? r.company_basis : 'supplied',
      verification_status: typeof r.verification_status === 'string' ? r.verification_status : 'unverified',
    };
  }
  // Tavily / WebSearch shape: derive company + signal.
  const url = typeof r.url === 'string' ? r.url : '';
  const title = typeof r.title === 'string' ? r.title : '';
  const body = typeof r.content === 'string' ? r.content
    : (typeof r.snippet === 'string' ? r.snippet : '');
  const det = extractCompanyDetailed(url, title);
  let signal = (body || title || '').slice(0, SIGNAL_MAX_CHARS);
  if (signal.length === 0) signal = title.slice(0, SIGNAL_MAX_CHARS);
  return {
    company: det.company,
    signal: signal,
    source: sourceTag || 'websearch',
    url: url,
    fetched_at: nowIso,
    source_id: url,
    retrieved_at: nowIso,
    company_basis: det.basis,
    verification_status: 'unverified',
  };
}

// ---------- fetchIndustry ----------
//
// Top-level orchestrator. Tavily is the only source. For each user query:
//   1. Pre-flight Canon Part 8 audit on the raw user query (Layer 1).
//      Mirrors Plan 89.2-03 Pattern 6: scan ALL queries BEFORE the source
//      loop runs so adversarial input throws BEFORE any fetch() call.
//   2. Build via chokepoint (throws if api-key absent OR adversarial).
//      The chokepoint also runs Layer 2 audit on each refined sub-query.
//   3. If skip (api_key_missing) -> recordTelemetry + record in-memory + return.
//   4. Check budget. budget==0 -> skip Tavily for this run.
//   5. For each refined sub-query: fetchWithTimeout -> parse -> accumulate.
// After all queries, dedupe and return {signals, telemetry}.
//
// fetchIndustry NEVER throws on rate-limit, timeout, parse error, or
// budget exhaustion. It ONLY throws on Canon Part 8 violation
// (ExternalEgressViolation propagated from buildIndustryQuery).

async function fetchIndustry(queries, opts) {
  if (!Array.isArray(queries)) {
    throw new TypeError('fetchIndustry: queries must be an array of non-empty strings');
  }
  for (const q of queries) {
    if (typeof q !== 'string' || q.trim().length === 0) {
      throw new TypeError('fetchIndustry: each query must be a non-empty string');
    }
  }
  opts = opts || {};
  const budgetOverrides = opts.budget || {};
  const runStartedAt = new Date().toISOString();
  const adapterTelemetry = [];

  // ---- Phase 94 Plan 05 amendment: Tier 1 PAID injection seam ----
  // If the caller injected an opts.tavily callable (typically the
  // /mos:research command wiring; never null in production agent
  // context), short-circuit the network path entirely and use the
  // injected adapter. The adapter must return {results: [...]} where
  // each entry has at least {url, title, snippet|content} OR the
  // canonical signal shape {company, signal, url}. We accept both
  // and normalize.
  if (opts.tavily && typeof opts.tavily === 'function') {
    // Pre-flight Canon Part 8 audit on the user query so adversarial
    // input still throws even when the network is bypassed. 2026: this
    // runs OUTSIDE the adapter try/catch, so a violation is no longer
    // swallowed and re-discovered later.
    for (const q of queries) {
      auditQueryString(q, 'industry');
    }
    let injected = null;
    try {
      injected = await opts.tavily(queries, opts);
    } catch (err) {
      // Adapter failed -> fall through to native + cache, but say so.
      adapterTelemetry.push({
        source: 'tavily', status: 'adapter_error', tier: 'paid',
        detail: String(err && err.message ? err.message : err).slice(0, 200),
      });
      injected = null;
    }
    if (injected && Array.isArray(injected.results) && injected.results.length > 0) {
      const signals = dedupe(injected.results.map(function (r) {
        const s = normalizeIncoming(r, 'tavily');
        s.provenance = { source: 'tavily', via: 'injected_adapter', retrieved_at: s.retrieved_at, tool: TOOL_ID };
        return s;
      }));
      return {
        tier: 'paid',
        source: 'tavily',
        results: signals,
        signals: signals,
        telemetry: [{ source: 'tavily', status: 'ok', tier: 'paid' }],
        provenance: { tool: TOOL_ID, retrieved_at: runStartedAt, queries: queries.slice(), path: 'injected_tavily' },
      };
    }
    // Fall through.
  }

  // Pre-flight Canon Part 8 audit (Pattern 6 from Plan 89.2-03):
  // walk every query through the chokepoint BEFORE iterating sources.
  // Without this, an adversarial query in position N would run for queries
  // 0..N-1 first (issuing real fetch() calls), then throw on N. The tests
  // assert ZERO captured URLs on adversarial input, so the audit must
  // happen before any fetch loop runs. The chokepoint also runs Layer 2
  // on each refined sub-query, so adversarial template overrides throw
  // here too (Test 10 + Test 11 fences).
  for (const q of queries) {
    buildIndustryQuery(q, opts);
  }
  const queryList = queries.filter(function (q, i) { return queries.indexOf(q) === i; });

  const out = { signals: [], telemetry: [] };
  let rawCount = 0;

  // Single source: tavily. Loop preserved for parity with academic +
  // patents fetchers; future expansion (Crunchbase direct, AngelList, etc.)
  // would slot in here.
  for (const source of SOURCES) {
    const budgetCap = (typeof budgetOverrides[source] === 'number')
      ? budgetOverrides[source]
      : DEFAULT_BUDGETS[source];
    const remaining = computeRemainingBudget(source, budgetCap);
    if (remaining <= 0) {
      // Skip source for this run; budget itself is the trace. We do NOT
      // call recordTelemetry here ('budget_exhausted' is not in
      // ALLOWED_STATUSES for the v1 telemetry primitive).
      out.telemetry.push({ source: source, status: 'budget_exhausted' });
      continue;
    }

    let used = 0;
    let stop = false;
    for (const query of queryList) {
      if (stop) break;
      // Build (chokepoint). Defense-in-depth re-run of both audit layers.
      const built = buildIndustryQuery(query, opts);

      if (built.skip) {
        // TAVILY_API_KEY missing.
        recordTelemetry({
          source: source,
          query_text: query,
          status: built.reason,
        });
        out.telemetry.push({ source: source, status: built.reason });
        // Every query will hit the same gate; break early.
        break;
      }

      // Per-refined-sub-query fetch loop.
      for (const refined of built.refined_subqueries) {
        if (used >= remaining) {
          out.telemetry.push({ source: source, status: 'budget_exhausted' });
          stop = true;
          break;
        }
        used += 1;
        const body = buildTavilyBody(refined, built.max_results_per_subquery);
        const req = {
          url: built.url,
          method: built.method,
          headers: Object.assign({}, built.headers, process.env.TAVILY_API_KEY
            ? { Authorization: 'Bearer ' + process.env.TAVILY_API_KEY } : {}),
          body: body,
        };

        const r = await requestWithRetry(req, source, 'json', opts);

        if (r.kind === 'timeout' || r.kind === 'network_error') {
          recordTelemetry({ source: source, query_text: refined, status: r.kind });
          out.telemetry.push({ source: source, status: r.kind, attempts: r.attempts });
          continue;
        }

        if (r.kind === 'http') {
          const httpStatus = r.res.status || 0;
          if (httpStatus === 429 || httpStatus === 503) {
            recordTelemetry({ source: source, query_text: refined, status: 'rate_limited', http_status: httpStatus });
            out.telemetry.push({ source: source, status: 'rate_limited', http_status: httpStatus, attempts: r.attempts });
            continue;
          }
          recordTelemetry({ source: source, query_text: refined, status: 'api_error', http_status: httpStatus });
          out.telemetry.push({ source: source, status: 'api_error', http_status: httpStatus, attempts: r.attempts });
          continue;
        }

        let parsed = null;
        if (r.kind === 'ok') {
          try {
            parsed = parseTavilyResponse(r.payload);
          } catch (_err) {
            parsed = null;
          }
        }
        if (parsed === null) {
          const st = (r.res && r.res.status) || 0;
          recordTelemetry({ source: source, query_text: refined, status: 'api_error', http_status: st });
          out.telemetry.push({ source: source, status: 'api_error', http_status: st, attempts: r.attempts });
          continue;
        }

        const res = r.res;
        const rateRemaining = parseRateLimit(res.headers);
        const recOpts = {
          source: source,
          query_text: refined,
          status: 'ok',
          http_status: res.status || 200,
        };
        if (typeof rateRemaining === 'number') {
          recOpts.rate_limit_remaining = rateRemaining;
        }
        recordTelemetry(recOpts);
        out.telemetry.push({ source: source, status: 'ok', http_status: res.status || 200, attempts: r.attempts, records: parsed.length });

        for (const sig of parsed) {
          sig.retrieval_query = query;
          sig.provenance = {
            source: source,
            source_id: sig.source_id,
            source_url: sig.url,
            retrieved_at: sig.retrieved_at,
            query: query,
            subquery: refined,
            endpoint: ENDPOINT_TAVILY,
            tool: TOOL_ID,
          };
          out.signals.push(sig);
          rawCount += 1;
        }
      }
    }
  }

  // First-seen wins on dedupe.
  out.signals = dedupe(out.signals);

  const provenanceBlock = function (path) {
    return {
      tool: TOOL_ID,
      retrieved_at: runStartedAt,
      queries: queryList.slice(),
      path: path,
      params: {
        timeout_ms: (typeof opts.timeoutMs === 'number') ? opts.timeoutMs : DEFAULT_TIMEOUT_MS,
        max_retries: (typeof opts.maxRetries === 'number') ? opts.maxRetries : DEFAULT_MAX_RETRIES,
        min_interval_ms: MIN_INTERVAL_MS,
        templates: REFINEMENT_TEMPLATES.length,
      },
      dedupe: { input_count: rawCount, output_count: out.signals.length, merged_count: rawCount - out.signals.length },
    };
  };

  // ---- Phase 94 Plan 05 amendment: envelope wrap + tier annotation ----
  // If Tavily produced results, this is the paid tier. Otherwise probe
  // Tier 0 NATIVE (opts.webSearch) then Tier -1 CACHE (opts.cacheReader)
  // before returning the empty-cache floor.
  if (out.signals.length > 0) {
    return {
      tier: 'paid',
      source: 'tavily',
      results: out.signals.slice(),
      signals: out.signals,
      telemetry: out.telemetry,
      provenance: provenanceBlock('tavily_http'),
    };
  }

  // Tier 0 NATIVE: Anthropic native WebSearch via injection seam.
  if (opts.webSearch && typeof opts.webSearch === 'function') {
    const adapted = queryList.map(function (q) {
      return q + ' industry analysis OR market report';
    });
    const merged = [];
    for (const adq of adapted) {
      // Canon Part 8 audit on the adapted query before egress. 2026: outside
      // the adapter try/catch so a violation propagates.
      auditQueryString(adq, 'industry');
      let res;
      try {
        res = await opts.webSearch(adq, opts);
      } catch (err) {
        adapterTelemetry.push({
          source: 'websearch', status: 'adapter_error', tier: 'native',
          detail: String(err && err.message ? err.message : err).slice(0, 200),
        });
        res = null;
      }
      if (res && Array.isArray(res.results)) {
        for (const r of res.results) {
          const s = normalizeIncoming(r, 'websearch');
          s.retrieval_query = adq;
          s.provenance = { source: 'websearch', via: 'injected_adapter', query: adq, retrieved_at: s.retrieved_at, tool: TOOL_ID };
          merged.push(s);
        }
      }
    }
    if (merged.length > 0) {
      const deduped = dedupe(merged);
      return {
        tier: 'native',
        source: 'websearch',
        results: deduped,
        signals: deduped,
        telemetry: out.telemetry.concat(adapterTelemetry, [{ source: 'websearch', status: 'ok', tier: 'native' }]),
        provenance: provenanceBlock('injected_websearch'),
      };
    }
  }

  // Tier -1 CACHE: read most-recent fetched_results.json from
  // <room>/.mindrian/ via injected cacheReader. The injection seam
  // keeps the fetcher stateless about room layout.
  if (opts.cacheReader && typeof opts.cacheReader === 'function') {
    let cached = null;
    try {
      cached = opts.cacheReader(opts.roomDir || null);
    } catch (err) {
      adapterTelemetry.push({
        source: 'cache', status: 'adapter_error', tier: 'cache',
        detail: String(err && err.message ? err.message : err).slice(0, 200),
      });
      cached = null;
    }
    if (cached && Array.isArray(cached.results) && cached.results.length > 0) {
      const cachedSignals = cached.results.map(function (r) {
        const s = normalizeIncoming(r, 'cache');
        // The original fetched_at is kept: it is the real retrieval date. The
        // record is flagged so callers never mistake it for a fresh fetch.
        s.stale = true;
        s.served_from_cache = true;
        return s;
      });
      return {
        tier: 'cache',
        source: 'cache',
        results: cachedSignals,
        signals: cachedSignals,
        telemetry: out.telemetry.concat(adapterTelemetry, [{ source: 'cache', status: 'ok', tier: 'cache' }]),
        provenance: provenanceBlock('cache'),
      };
    }
  }

  // Floor: empty-cache. NEVER throw; envelope shape preserved.
  return {
    tier: 'cache',
    source: 'cache',
    results: [],
    signals: [],
    telemetry: out.telemetry.concat(adapterTelemetry, [{ source: 'cache', status: 'empty', tier: 'cache' }]),
    provenance: provenanceBlock('empty'),
  };
}

// ---------- Exports ----------

module.exports = {
  fetchIndustry,
  buildIndustryQuery,
  // Test surface (private; do NOT consume in production).
  _test: {
    dedupe,
    dedupKey,
    normalizeSignal,
    extractCompany,
    extractCompanyDetailed,
    normalizeUrl,
    normalizeIncoming,
    requestWithRetry,
    redactUrl,
    MIN_INTERVAL_MS,
    parseTavilyResponse,
    fetchWithTimeout,
    buildTavilyBody,
    parseRateLimit,
    REFINEMENT_TEMPLATES,
    SOURCES,
    SOURCE_ENV_VARS,
    ENDPOINT_TAVILY,
    DEFAULT_TIMEOUT_MS,
    USER_AGENT,
    SIGNAL_MAX_CHARS,
    MAX_RESULTS_PER_SUBQUERY,
  },
};
