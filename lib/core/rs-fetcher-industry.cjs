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

// signal.signal field is capped at 200 chars per CONTEXT.md spec.
const SIGNAL_MAX_CHARS = 200;

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
  if (typeof query !== 'string' || query.length === 0) {
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
  const controller = new AbortController();
  const t = setTimeout(function () { controller.abort(); }, timeoutMs);
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
    clearTimeout(t);
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

function extractCompany(url, title) {
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
      if (parts.length >= 2) {
        sld = parts[parts.length - 2];
      } else if (parts.length === 1) {
        sld = parts[0];
      }
      if (sld && sld.length > 0 && sld !== 'example') {
        // Title-case the SLD; preserve dashes.
        const cased = sld.split('-').map(function (seg) {
          return seg.length > 0 ? (seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()) : seg;
        }).join('-');
        if (cased.length > 0) return cased;
      }
      if (sld === 'example') {
        // Distinguish example-foo subdomains from generic example.com.
        // For test fixtures: example-abc1234.com -> Example-Abc1234.
        const cased = sld.charAt(0).toUpperCase() + sld.slice(1);
        return cased;
      }
    }
  }
  // Strategy 2: first capitalized token from title
  if (typeof title === 'string' && title.length > 0) {
    const tokens = title.split(/\s+/);
    for (const tok of tokens) {
      if (tok.length === 0) continue;
      const c0 = tok.charAt(0);
      if (c0 >= 'A' && c0 <= 'Z') return tok;
    }
  }
  return 'Unknown';
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
    const company = extractCompany(url, title);
    let signalText = (content || title || '').slice(0, SIGNAL_MAX_CHARS);
    if (signalText.length === 0) signalText = title.slice(0, SIGNAL_MAX_CHARS);
    if (signalText.length === 0) continue;
    out.push({
      company: company,
      signal: signalText,
      source: 'tavily',
      url: url,
      fetched_at: new Date().toISOString(),
    });
  }
  return out;
}

// ---------- normalizeSignal ----------
//
// Final shape guarantee. parseTavilyResponse already produces this shape
// but normalizeSignal is exposed so future call sites can canonicalize
// hand-constructed records.

function normalizeSignal(raw) {
  return {
    company: raw && raw.company ? String(raw.company) : 'Unknown',
    signal: raw && raw.signal ? String(raw.signal).slice(0, SIGNAL_MAX_CHARS) : '',
    source: raw && raw.source ? String(raw.source) : '',
    url: raw && raw.url ? String(raw.url) : '',
    fetched_at: raw && raw.fetched_at ? String(raw.fetched_at) : new Date().toISOString(),
  };
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
  const seen = new Set();
  const out = [];
  for (const s of signals) {
    const key = dedupKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
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
  // Already canonical signal shape?
  if (typeof r.company === 'string' && typeof r.signal === 'string') {
    return {
      company: r.company,
      signal: r.signal.slice(0, SIGNAL_MAX_CHARS),
      source: typeof r.source === 'string' && r.source.length > 0 ? r.source : (sourceTag || ''),
      url: typeof r.url === 'string' ? r.url : '',
      fetched_at: typeof r.fetched_at === 'string' ? r.fetched_at : new Date().toISOString(),
    };
  }
  // Tavily / WebSearch shape: derive company + signal.
  const url = typeof r.url === 'string' ? r.url : '';
  const title = typeof r.title === 'string' ? r.title : '';
  const body = typeof r.content === 'string' ? r.content
    : (typeof r.snippet === 'string' ? r.snippet : '');
  const company = extractCompany(url, title);
  let signal = (body || title || '').slice(0, SIGNAL_MAX_CHARS);
  if (signal.length === 0) signal = title.slice(0, SIGNAL_MAX_CHARS);
  return {
    company: company,
    signal: signal,
    source: sourceTag || 'websearch',
    url: url,
    fetched_at: new Date().toISOString(),
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
    if (typeof q !== 'string' || q.length === 0) {
      throw new TypeError('fetchIndustry: each query must be a non-empty string');
    }
  }
  opts = opts || {};
  const budgetOverrides = opts.budget || {};

  // ---- Phase 94 Plan 05 amendment: Tier 1 PAID injection seam ----
  // If the caller injected an opts.tavily callable (typically the
  // /mos:research command wiring; never null in production agent
  // context), short-circuit the network path entirely and use the
  // injected adapter. The adapter must return {results: [...]} where
  // each entry has at least {url, title, snippet|content} OR the
  // canonical signal shape {company, signal, url}. We accept both
  // and normalize.
  if (opts.tavily && typeof opts.tavily === 'function') {
    let injected;
    try {
      // Pre-flight Canon Part 8 audit on the user query so adversarial
      // input still throws even when the network is bypassed.
      for (const q of queries) {
        auditQueryString(q, 'industry');
      }
      injected = await opts.tavily(queries, opts);
    } catch (err) {
      // Adapter failed -> fall through to native + cache.
      injected = null;
    }
    if (injected && Array.isArray(injected.results) && injected.results.length > 0) {
      const signals = injected.results.map(function (r) { return normalizeIncoming(r, 'tavily'); });
      return {
        tier: 'paid',
        source: 'tavily',
        results: signals,
        signals: signals,
        telemetry: [{ source: 'tavily', status: 'ok', tier: 'paid' }],
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
    // Surfacing the chokepoint here gives BOTH layers of audit pre-flight
    // (so Test 10 + Test 11 throw before fetch).
    buildIndustryQuery(q, opts);
  }

  const out = { signals: [], telemetry: [] };

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

    for (const query of queries) {
      // Build (chokepoint). Throws ExternalEgressViolation on adversarial
      // input, but the pre-flight loop above has already cleared every
      // query. Re-running here is defense-in-depth.
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
        const body = buildTavilyBody(refined, built.max_results_per_subquery);
        const req = {
          url: built.url,
          method: built.method,
          headers: built.headers,
          body: body,
        };

        let res = null;
        try {
          res = await fetchWithTimeout(req, opts);
        } catch (err) {
          if (err && err.name === 'AbortError') {
            recordTelemetry({
              source: source,
              query_text: refined,
              status: 'timeout',
            });
            out.telemetry.push({ source: source, status: 'timeout' });
            continue;
          }
          recordTelemetry({
            source: source,
            query_text: refined,
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
              query_text: refined,
              status: 'rate_limited',
              http_status: httpStatus,
            });
            out.telemetry.push({ source: source, status: 'rate_limited', http_status: httpStatus });
            continue;
          }
          recordTelemetry({
            source: source,
            query_text: refined,
            status: 'api_error',
            http_status: httpStatus,
          });
          out.telemetry.push({ source: source, status: 'api_error', http_status: httpStatus });
          continue;
        }

        let parsed = null;
        try {
          const payload = await res.json();
          parsed = parseTavilyResponse(payload);
        } catch (_err) {
          recordTelemetry({
            source: source,
            query_text: refined,
            status: 'api_error',
            http_status: res.status || 0,
          });
          out.telemetry.push({ source: source, status: 'api_error', http_status: res.status || 0 });
          continue;
        }

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
        out.telemetry.push({ source: source, status: 'ok', http_status: res.status || 200 });

        for (const sig of parsed) {
          out.signals.push(sig);
        }
      }
    }
  }

  // First-seen wins on dedupe.
  out.signals = dedupe(out.signals);

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
    };
  }

  // Tier 0 NATIVE: Anthropic native WebSearch via injection seam.
  if (opts.webSearch && typeof opts.webSearch === 'function') {
    const adapted = queries.map(function (q) {
      return q + ' industry analysis OR market report';
    });
    const merged = [];
    for (const adq of adapted) {
      let res;
      try {
        // Canon Part 8 audit on the adapted query before egress.
        auditQueryString(adq, 'industry');
        res = await opts.webSearch(adq, opts);
      } catch (_e) {
        res = null;
      }
      if (res && Array.isArray(res.results)) {
        for (const r of res.results) {
          merged.push(normalizeIncoming(r, 'websearch'));
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
        telemetry: out.telemetry.concat([{ source: 'websearch', status: 'ok', tier: 'native' }]),
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
    } catch (_e) {
      cached = null;
    }
    if (cached && Array.isArray(cached.results) && cached.results.length > 0) {
      const cachedSignals = cached.results.map(function (r) {
        return normalizeIncoming(r, 'cache');
      });
      return {
        tier: 'cache',
        source: 'cache',
        results: cachedSignals,
        signals: cachedSignals,
        telemetry: out.telemetry.concat([{ source: 'cache', status: 'ok', tier: 'cache' }]),
      };
    }
  }

  // Floor: empty-cache. NEVER throw; envelope shape preserved.
  return {
    tier: 'cache',
    source: 'cache',
    results: [],
    signals: [],
    telemetry: out.telemetry.concat([{ source: 'cache', status: 'empty', tier: 'cache' }]),
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
