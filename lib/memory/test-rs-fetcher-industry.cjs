#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 04 -- industry fetcher fixture suite.
 *
 * 17 scenarios total: 11 fetcher tests + 6 validator tests.
 *
 *   Test 1  happy path Tavily orchestration (3 refined sub-queries per query)
 *   Test 2  dedup determinism (same input twice -> identical output)
 *   Test 3  TAVILY_API_KEY absent graceful (api_key_missing telemetry)
 *   Test 4  Tavily 429 rate-limit graceful (no throw; rate_limited telemetry)
 *   Test 5  Tavily timeout graceful (timeout telemetry; empty signals)
 *   Test 6  Tavily malformed JSON graceful (api_error telemetry)
 *   Test 7  per-source budget exhausted (Tavily skipped; budget_exhausted)
 *   Test 8  CANON PART 8 adversarial #1 -- leaked-meeting in user query
 *   Test 9  CANON PART 8 adversarial #2 -- leaked-quoted-person in user query
 *   Test 10 CANON PART 8 adversarial #3 -- meeting pattern via refined sub-query
 *           opts.refinement_template_override = 'meeting with {query}'
 *           Audits the refined sub-query layer (TWO-LAYER defense).
 *   Test 11 CANON PART 8 adversarial #4 -- phone-like pattern via refined sub-query
 *           opts.refinement_template_override = '{query} contact 555-867-5309 sales'
 *           Audits second layer with FORBIDDEN_PATTERNS phone regex.
 *
 *   V1     validator Check A: telemetry file absent -> {severity: null}
 *   V2     validator Check B: per-source budget exceeded -> warning
 *   V3     validator Check C: status enum violation -> warning
 *   V4     validator Check D: query_text literal present -> CRITICAL canon_boundary
 *   V5     validator Check E: query_text_hash format violation -> warning
 *   V6     validator Check F: fetched_at malformed ISO-8601 -> warning
 *
 * Suite-end audits:
 *   A1  every captured outbound URL + every captured telemetry record
 *       JSON.stringify scanned against FORBIDDEN_PATTERNS; ZERO hits
 *   A2  parity gate: rs-egress-prompts FORBIDDEN_PATTERNS byte-for-byte
 *       === cross-room-aggregator FORBIDDEN_PATTERNS at every regex.source
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, fs, os, path, crypto).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];

const SCENARIO_RESULTS = [];

const CAPTURED_URLS = [];
const CAPTURED_URLS_ALL = [];
const CAPTURED_BODIES = [];
const CAPTURED_BODIES_ALL = [];

let testHomeDir = null;
let originalHome = null;
let originalApiKey = null;

const ALL_TMP_ROOTS = [];

process.on('exit', function () {
  if (originalHome !== null) {
    process.env.HOME = originalHome;
  }
  if (originalApiKey === null) {
    delete process.env.TAVILY_API_KEY;
  } else {
    process.env.TAVILY_API_KEY = originalApiKey;
  }
  for (const d of ALL_TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

function setupScopedHome() {
  if (originalHome === null) {
    originalHome = process.env.HOME;
  }
  if (originalApiKey === null && process.env.TAVILY_API_KEY !== undefined) {
    originalApiKey = process.env.TAVILY_API_KEY;
  }
  testHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsfetind-home-'));
  ALL_TMP_ROOTS.push(testHomeDir);
  process.env.HOME = testHomeDir;
  // Default for most tests: a key is present. Tests that require absence
  // explicitly delete process.env.TAVILY_API_KEY after this call.
  process.env.TAVILY_API_KEY = 'test-tavily-key-' + Date.now();
  resetRequireCache();
}

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/rs-egress-telemetry.cjs',
    '../core/rs-fetcher-industry.cjs',
    '../core/cross-room-aggregator.cjs',
    './validators/external-industry-invariants.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

// ---------- Mock fetch ----------

let originalFetch = null;
const mockResponses = new Map();

function installMockFetch(responses) {
  if (originalFetch === null) {
    originalFetch = global.fetch;
  }
  mockResponses.clear();
  CAPTURED_URLS.length = 0;
  CAPTURED_BODIES.length = 0;
  for (const [k, v] of Object.entries(responses)) {
    mockResponses.set(k, v);
  }
  global.fetch = async function (url, opts) {
    CAPTURED_URLS.push(String(url));
    CAPTURED_URLS_ALL.push(String(url));
    if (opts && typeof opts.body === 'string') {
      CAPTURED_BODIES.push(opts.body);
      CAPTURED_BODIES_ALL.push(opts.body);
    }
    for (const [prefix, handler] of mockResponses.entries()) {
      if (String(url).indexOf(prefix) >= 0) {
        return handler(url, opts);
      }
    }
    return { ok: false, status: 404, headers: new Map(), async json() { return {}; }, async text() { return ''; } };
  };
}

function restoreFetch() {
  if (originalFetch !== null) {
    global.fetch = originalFetch;
  }
  mockResponses.clear();
}

// ---------- Scenario runner ----------

async function runScenario(name, fn) {
  const start = Date.now();
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '  (' + (Date.now() - start) + 'ms)\n');
  } catch (err) {
    failed += 1;
    failures.push({ name: name, err: err });
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  } finally {
    restoreFetch();
    resetRequireCache();
  }
}

// ---------- Helpers ----------

function makeTavilyResponse(query, n) {
  // Simulated api.tavily.com/search JSON payload. Real Tavily returns
  // { results: [{ title, url, content, score, ... }, ... ], ... }.
  const results = [];
  for (let i = 0; i < n; i++) {
    const tag = crypto.createHash('sha256').update(query + ':' + i).digest('hex').slice(0, 6);
    results.push({
      title: 'Tavily result ' + i + ' for ' + query.slice(0, 30),
      url: 'https://example-' + tag + '.com/article-' + i,
      content: 'Company NewCo' + i + ' raised seed funding for project related to '
        + query.slice(0, 40) + ' according to public reports.',
      score: 0.9 - (i * 0.05),
    });
  }
  return { results: results, query: query, response_time: 0.5 };
}

function buildTavilyMockOk(query, perSubquery) {
  return {
    'api.tavily.com': async function (url, opts) {
      // Inspect body to derive which refined sub-query we received so the
      // response can echo a variant set per template.
      let q = query;
      try {
        if (opts && typeof opts.body === 'string') {
          const parsed = JSON.parse(opts.body);
          if (parsed && typeof parsed.query === 'string') q = parsed.query;
        }
      } catch (_e) { /* fall back to user-query echo */ }
      return {
        ok: true,
        status: 200,
        headers: new Map([['x-ratelimit-remaining', '29']]),
        async json() { return makeTavilyResponse(q, perSubquery); },
        async text() { return JSON.stringify(makeTavilyResponse(q, perSubquery)); },
      };
    },
  };
}

// ---------- A1/A2 sweep helpers ----------

function getForbiddenPatternsFromAggregator() {
  const aggregator = require('../core/cross-room-aggregator.cjs');
  return aggregator.FORBIDDEN_PATTERNS;
}

function scanAgainstForbidden(stringified) {
  const patterns = getForbiddenPatternsFromAggregator();
  for (const re of patterns) {
    if (re.test(stringified)) {
      return { hit: true, pattern: re.source };
    }
  }
  return { hit: false };
}

// ---------- Begin scenarios ----------

console.log('=== 89.2-04 fetcher-industry suite: starting ===');

(async function main() {

  // ---------- Test 1: happy path Tavily orchestration ----------
  await runScenario('Test 1: happy path Tavily orchestration (3 refined sub-queries)', async function () {
    setupScopedHome();
    const queries = ['cancer immunotherapy startups', 'CRISPR funding rounds 2024'];
    installMockFetch(buildTavilyMockOk('any', 5));
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    const out = await fetcher.fetchIndustry(queries, {});
    assert.ok(out && Array.isArray(out.signals), 'signals is array');
    assert.ok(out.signals.length >= 10,
      'expected >= 10 signals after dedup across 2 user queries x 3 sub-queries x 5 results; got ' + out.signals.length);
    const sample = out.signals[0];
    for (const f of ['company', 'signal', 'source', 'url', 'fetched_at']) {
      assert.ok(Object.prototype.hasOwnProperty.call(sample, f),
        'signal missing field: ' + f);
    }
    assert.equal(sample.source, 'tavily', 'source is tavily');
    assert.ok(typeof sample.company === 'string' && sample.company.length > 0,
      'company non-empty: ' + JSON.stringify(sample.company));
    assert.ok(typeof sample.signal === 'string' && sample.signal.length >= 1 && sample.signal.length <= 200,
      'signal length 1..200; got ' + sample.signal.length);
    assert.ok(/^https?:\/\//.test(sample.url), 'url is HTTP(S); got ' + sample.url);
    assert.ok(!Number.isNaN(Date.parse(sample.fetched_at)),
      'fetched_at is parseable ISO-8601; got ' + sample.fetched_at);
    // Verify the orchestration: 2 queries x 3 templates = 6 fetch calls
    assert.equal(CAPTURED_URLS.length, 6,
      'expected 6 fetch calls (2 queries x 3 refined templates); got ' + CAPTURED_URLS.length);
    SCENARIO_RESULTS.push({ test: 'T1', surface: 'industry', payload: out });
  });

  // ---------- Test 2: dedup determinism ----------
  await runScenario('Test 2: dedup determinism (same input twice == identical output)', async function () {
    setupScopedHome();
    const queries = ['biotech series A 2024'];
    installMockFetch(buildTavilyMockOk('any', 5));
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    const r1 = await fetcher.fetchIndustry(queries, {});
    CAPTURED_URLS.length = 0;
    setupScopedHome();
    installMockFetch(buildTavilyMockOk('any', 5));
    const fetcher2 = require('../core/rs-fetcher-industry.cjs');
    const r2 = await fetcher2.fetchIndustry(queries, {});
    const stripT = function (signals) {
      return signals.map(s => {
        const c = Object.assign({}, s);
        delete c.fetched_at;
        return c;
      });
    };
    assert.equal(JSON.stringify(stripT(r1.signals)), JSON.stringify(stripT(r2.signals)),
      'dedup output must be deterministic across runs');
    SCENARIO_RESULTS.push({ test: 'T2', surface: 'industry', payload: stripT(r1.signals) });
  });

  // ---------- Test 3: TAVILY_API_KEY missing graceful ----------
  await runScenario('Test 3: TAVILY_API_KEY missing -> graceful empty + api_key_missing telemetry', async function () {
    setupScopedHome();
    delete process.env.TAVILY_API_KEY;
    const queries = ['quantum computing startups'];
    installMockFetch(buildTavilyMockOk('any', 5));
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    const out = await fetcher.fetchIndustry(queries, {});
    assert.ok(Array.isArray(out.signals), 'signals is array');
    assert.equal(out.signals.length, 0, 'signals empty when TAVILY_API_KEY absent');
    assert.equal(CAPTURED_URLS.length, 0, 'NO fetch() calls when API key absent');
    // Telemetry must record api_key_missing.
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    if (fs.existsSync(telemetry.TELEMETRY_FILE)) {
      const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
      const missing = payload.entries.filter(e => e.status === 'api_key_missing');
      assert.ok(missing.length >= 1, 'api_key_missing telemetry recorded');
    }
    const out2Tel = out.telemetry || [];
    const inMem = out2Tel.filter(e => e.status === 'api_key_missing');
    assert.ok(inMem.length >= 1, 'in-memory telemetry has api_key_missing');
    SCENARIO_RESULTS.push({ test: 'T3', surface: 'industry', payload: out });
  });

  // ---------- Test 4: Tavily 429 rate-limit graceful ----------
  await runScenario('Test 4: Tavily 429 rate-limit graceful (no throw; rate_limited telemetry)', async function () {
    setupScopedHome();
    const queries = ['SaaS funding rounds Q1 2024'];
    installMockFetch({
      'api.tavily.com': async function () {
        return {
          ok: false,
          status: 429,
          headers: new Map([['retry-after', '60']]),
          async text() { return 'rate limited'; },
          async json() { return { error: 'rate limited' }; },
        };
      },
    });
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    const out = await fetcher.fetchIndustry(queries, {});
    assert.equal(out.signals.length, 0, 'signals empty after 429');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const rateLimited = payload.entries.filter(e => e.status === 'rate_limited');
    assert.ok(rateLimited.length >= 1, 'rate_limited telemetry recorded');
    assert.equal(rateLimited[0].http_status, 429, 'http_status 429 recorded');
    SCENARIO_RESULTS.push({ test: 'T4', surface: 'industry', payload: out });
  });

  // ---------- Test 5: Tavily timeout graceful ----------
  await runScenario('Test 5: Tavily timeout graceful (no throw; timeout telemetry)', async function () {
    setupScopedHome();
    const queries = ['edtech AI tutors'];
    installMockFetch({
      'api.tavily.com': async function () {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
    });
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    const out = await fetcher.fetchIndustry(queries, {});
    assert.equal(out.signals.length, 0, 'signals empty after timeout');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const timed = payload.entries.filter(e => e.status === 'timeout');
    assert.ok(timed.length >= 1, 'timeout telemetry recorded');
    SCENARIO_RESULTS.push({ test: 'T5', surface: 'industry', payload: out });
  });

  // ---------- Test 6: Tavily malformed JSON graceful ----------
  await runScenario('Test 6: Tavily malformed JSON graceful (api_error telemetry)', async function () {
    setupScopedHome();
    const queries = ['climate tech startups'];
    installMockFetch({
      'api.tavily.com': async function () {
        return {
          ok: true,
          status: 200,
          headers: new Map(),
          async json() { throw new SyntaxError('invalid JSON'); },
          async text() { return '<<<not-json>>>'; },
        };
      },
    });
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    const out = await fetcher.fetchIndustry(queries, {});
    assert.equal(out.signals.length, 0, 'signals empty after parse failure');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const errd = payload.entries.filter(e => e.status === 'api_error');
    assert.ok(errd.length >= 1, 'api_error telemetry recorded');
    SCENARIO_RESULTS.push({ test: 'T6', surface: 'industry', payload: out });
  });

  // ---------- Test 7: per-source budget exhausted ----------
  await runScenario('Test 7: per-source budget exhausted (Tavily skipped)', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    // Seed 30 tavily entries within last 24h (default budget = 30).
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < 30; i++) {
      entries.push({
        source: 'tavily',
        query_text_hash: 'aaaaaaaaaaaaaaaa',
        status: 'ok',
        fetched_at: new Date(now - (i * 1000)).toISOString(),
      });
    }
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const queries = ['fintech series B'];
    installMockFetch(buildTavilyMockOk('any', 3));
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    const out = await fetcher.fetchIndustry(queries, {});
    assert.equal(out.signals.length, 0, 'signals empty after budget exhausted');
    assert.equal(CAPTURED_URLS.length, 0, 'no fetch when budget exhausted');

    const inMem = (out.telemetry || []).filter(e => e.status === 'budget_exhausted');
    assert.ok(inMem.length >= 1, 'in-memory telemetry has budget_exhausted');
    SCENARIO_RESULTS.push({ test: 'T7', surface: 'industry', payload: out });
  });

  // ---------- Test 8: CANON PART 8 adversarial #1 leaked-meeting in user query ----------
  await runScenario('Test 8: CANON PART 8 adversarial #1 leaked-meeting throws (ZERO fetch)', async function () {
    setupScopedHome();
    const queries = ['CRISPR <<artifact: meeting with Genentech Q4 financials>>'];
    installMockFetch(buildTavilyMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    let threw = null;
    try {
      await fetcher.fetchIndustry(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(threw.meta.surface, 'industry', 'meta.surface');
    assert.ok(typeof threw.meta.matched_pattern === 'string'
      && threw.meta.matched_pattern.length > 0, 'meta.matched_pattern present');

    assert.equal(CAPTURED_URLS.length, 0,
      'NO fetch() calls allowed before throw; got ' + CAPTURED_URLS.length);

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    if (fs.existsSync(telemetry.TELEMETRY_FILE)) {
      const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
      assert.equal(payload.entries.length, 0,
        'NO telemetry entries allowed; got ' + payload.entries.length);
    }
    SCENARIO_RESULTS.push({ test: 'T8', surface: 'industry', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 9: CANON PART 8 adversarial #2 leaked-quoted-person ----------
  await runScenario('Test 9: CANON PART 8 adversarial #2 leaked-quoted-person throws', async function () {
    setupScopedHome();
    const queries = ['Lawrence said our competition raised funding'];
    installMockFetch(buildTavilyMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    let threw = null;
    try {
      await fetcher.fetchIndustry(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(threw.meta.surface, 'industry', 'meta.surface');
    assert.equal(CAPTURED_URLS.length, 0, 'NO fetch() calls allowed');
    SCENARIO_RESULTS.push({ test: 'T9', surface: 'industry', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 10: CANON PART 8 adversarial #3 forbidden via REFINED sub-query ----------
  await runScenario('Test 10: CANON PART 8 adversarial #3 meeting-via-refined-sub-query throws', async function () {
    setupScopedHome();
    // User query is clean. Adversarial template smuggles a forbidden
    // pattern. The TWO-LAYER audit must throw on the second layer
    // (refined sub-query), proving defense-in-depth.
    const queries = ['biotech startups'];
    installMockFetch(buildTavilyMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    let threw = null;
    try {
      await fetcher.fetchIndustry(queries, {
        refinement_template_override: 'meeting with {query}',
      });
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial refined sub-query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(threw.meta.surface, 'industry', 'meta.surface');
    assert.ok(typeof threw.meta.matched_pattern === 'string'
      && threw.meta.matched_pattern.length > 0, 'meta.matched_pattern present');
    assert.equal(CAPTURED_URLS.length, 0,
      'NO fetch() calls allowed; second-layer audit fires before fetch; got ' + CAPTURED_URLS.length);
    SCENARIO_RESULTS.push({ test: 'T10', surface: 'industry', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 11: CANON PART 8 adversarial #4 phone-via-refined-sub-query ----------
  await runScenario('Test 11: CANON PART 8 adversarial #4 phone-via-refined-sub-query throws', async function () {
    setupScopedHome();
    // User query is clean. Template injects a phone-like pattern that
    // would only surface in the refined sub-query. This proves the
    // second-layer audit catches forbidden patterns ACROSS THE FULL
    // FAMILY of FORBIDDEN_PATTERNS (Tests 8 + 9 covered meeting +
    // quoted-person; Test 10 covered meeting via override; Test 11
    // covers phone-like via override).
    const queries = ['biotech startups'];
    installMockFetch(buildTavilyMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-industry.cjs');
    let threw = null;
    try {
      await fetcher.fetchIndustry(queries, {
        refinement_template_override: '{query} contact 555-867-5309 sales',
      });
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on phone-pattern adversarial');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(threw.meta.surface, 'industry', 'meta.surface');
    assert.ok(typeof threw.meta.matched_pattern === 'string'
      && threw.meta.matched_pattern.indexOf('d{3}') >= 0,
      'matched_pattern is the phone regex source containing d{3}; got ' + threw.meta.matched_pattern);
    assert.equal(CAPTURED_URLS.length, 0,
      'NO fetch() calls allowed; got ' + CAPTURED_URLS.length);

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    if (fs.existsSync(telemetry.TELEMETRY_FILE)) {
      const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
      assert.equal(payload.entries.length, 0,
        'NO telemetry entries allowed; got ' + payload.entries.length);
    }
    SCENARIO_RESULTS.push({ test: 'T11', surface: 'industry', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- V1: validator Check A telemetry-file-absent ----------
  await runScenario('V1: validator Check A telemetry-file-absent -> {severity: null}', async function () {
    setupScopedHome();
    const validator = require('./validators/external-industry-invariants.cjs');
    const result = validator.validate('/dev/null', {});
    assert.equal(result.severity, null, 'severity null when telemetry absent');
    assert.equal(result.violations.length, 0, 'no violations when telemetry absent');
  });

  // ---------- V2: validator Check B per-source budget exceeded ----------
  await runScenario('V2: validator Check B per-source budget exceeded -> warning', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    // Seed 50 tavily entries within last 24h (over default 30 budget).
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < 50; i++) {
      entries.push({
        source: 'tavily',
        query_text_hash: 'aaaaaaaaaaaaaaaa',
        status: 'ok',
        fetched_at: new Date(now - (i * 1000)).toISOString(),
      });
    }
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-industry-invariants.cjs');
    const result = validator.validate('/dev/null', {});
    assert.ok(result.violations.length >= 1, 'expected at least one violation');
    const budgetViolations = result.violations.filter(v => v.category === 'budget_exceeded');
    assert.ok(budgetViolations.length >= 1, 'expected budget_exceeded violation');
    assert.equal(budgetViolations[0].severity, 'warning', 'budget_exceeded severity is warning');
  });

  // ---------- V3: validator Check C status enum violation ----------
  await runScenario('V3: validator Check C status enum violation -> warning', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const entries = [{
      source: 'tavily',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'unknown_status',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-industry-invariants.cjs');
    const result = validator.validate('/dev/null', {});
    const statusViolations = result.violations.filter(v => v.category === 'status_enum_violation');
    assert.ok(statusViolations.length >= 1, 'expected status_enum_violation');
    assert.equal(statusViolations[0].severity, 'warning', 'status_enum severity is warning');
  });

  // ---------- V4: validator Check D query_text literal -> CRITICAL ----------
  await runScenario('V4: validator Check D query_text literal present -> CRITICAL canon_boundary', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const entries = [{
      source: 'tavily',
      query_text: 'literal industry-signal query',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'ok',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-industry-invariants.cjs');
    const result = validator.validate('/dev/null', {});
    const canonViolations = result.violations.filter(v => v.category === 'canon_boundary');
    assert.ok(canonViolations.length >= 1, 'expected canon_boundary violation');
    assert.equal(canonViolations[0].severity, 'critical',
      'canon_boundary severity is critical');
  });

  // ---------- V5: validator Check E query_text_hash format ----------
  await runScenario('V5: validator Check E query_text_hash format violation -> warning', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const entries = [{
      source: 'tavily',
      query_text_hash: 'NOT-A-HEX-HASH-XYZ',
      status: 'ok',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-industry-invariants.cjs');
    const result = validator.validate('/dev/null', {});
    const hashViolations = result.violations.filter(v => v.category === 'hash_format_invalid');
    assert.ok(hashViolations.length >= 1, 'expected hash_format_invalid violation');
    assert.equal(hashViolations[0].severity, 'warning', 'severity is warning');
  });

  // ---------- V6: validator Check F fetched_at malformed ISO-8601 ----------
  await runScenario('V6: validator Check F fetched_at malformed -> warning', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const entries = [{
      source: 'tavily',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'ok',
      fetched_at: 'NOT-A-VALID-DATE',
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-industry-invariants.cjs');
    const result = validator.validate('/dev/null', {});
    const dateViolations = result.violations.filter(v => v.category === 'fetched_at_malformed');
    assert.ok(dateViolations.length >= 1, 'expected fetched_at_malformed violation');
    assert.equal(dateViolations[0].severity, 'warning', 'severity is warning');
  });

  // ---------- A1 sweep: zero forbidden matches in any captured output ----------
  await runScenario('A1: zero forbidden matches across captured payloads + URLs + bodies', async function () {
    for (const rec of SCENARIO_RESULTS) {
      const stringified = JSON.stringify(rec.payload);
      const hit = scanAgainstForbidden(stringified);
      assert.equal(hit.hit, false,
        'A1 violation in ' + rec.test + '/' + rec.surface +
        ' against pattern ' + (hit.pattern || 'n/a'));
    }
    for (const u of CAPTURED_URLS_ALL) {
      const hit = scanAgainstForbidden(u);
      assert.equal(hit.hit, false,
        'A1 outbound URL leaked forbidden pattern ' + (hit.pattern || 'n/a') +
        ' in ' + u.slice(0, 100));
    }
    for (const b of CAPTURED_BODIES_ALL) {
      const hit = scanAgainstForbidden(b);
      assert.equal(hit.hit, false,
        'A1 outbound body leaked forbidden pattern ' + (hit.pattern || 'n/a') +
        ' in ' + b.slice(0, 100));
    }
  });

  // ---------- A2 sweep: parity gate ----------
  await runScenario('A2: FORBIDDEN_PATTERNS parity (rs-egress-prompts === cross-room-aggregator)', async function () {
    const promptsModule = require('../core/rs-egress-prompts.cjs');
    const aggregator = require('../core/cross-room-aggregator.cjs');
    const ours = promptsModule.FORBIDDEN_PATTERNS;
    const truth = aggregator.FORBIDDEN_PATTERNS;
    assert.equal(ours.length, truth.length, 'lengths match');
    for (let i = 0; i < truth.length; i++) {
      assert.equal(ours[i].source, truth[i].source, 'pattern source mismatch at index ' + i);
      assert.equal(ours[i].flags, truth[i].flags, 'pattern flags mismatch at index ' + i);
    }
  });

  // ---------- Final report ----------
  if (failed > 0) {
    console.error('\n=== ' + failed + ' FAILURES ===');
    for (const f of failures) {
      console.error('  ' + f.name);
    }
    process.exit(1);
  }

  console.log('=== 89.2-04 fetcher-industry suite: 17/17 passed ===');
  process.exit(0);
})();
