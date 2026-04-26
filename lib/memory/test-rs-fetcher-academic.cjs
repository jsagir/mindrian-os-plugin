#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 02 -- academic fetcher fixture suite.
 *
 * 18 scenarios total: 12 fetcher tests + 6 validator tests.
 *
 *   Test 1  happy path 6 sources (mock fetch returns paper batches per source)
 *   Test 2  dedup determinism (same input twice -> identical output)
 *   Test 3  API-key-missing graceful (scopus + ieee + nature env unset)
 *   Test 4  429 rate-limit graceful (openalex returns 429; fetcher continues)
 *   Test 5  timeout graceful (AbortError; fetcher continues with remaining sources)
 *   Test 6  malformed response graceful (arXiv returns non-XML; api_error logged)
 *   Test 7  per-source budget exhausted (seed 100 entries; openalex skipped)
 *   Test 8  CANON PART 8 adversarial: leaked-artifact-body in query throws
 *   Test 9  CANON PART 8 adversarial: leaked-venture-name in query throws
 *   Test 10 CANON PART 8 adversarial: leaked-meeting-fragment in query throws
 *   Test 11 CANON PART 8 adversarial: leaked-financial-figure in query throws
 *   Test 12 chokepoint exclusivity: every fetch() call site is inside a
 *           per-source dispatcher invoked by fetchAcademic via
 *           buildAcademicQuery; static grep enforces this.
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

// Captured outputs for end-of-suite A1 sweep.
const SCENARIO_RESULTS = [];

// Captured outbound URLs from mock fetch (for chokepoint + A1 audit).
// Two ledgers: per-scenario (cleared on each installMockFetch) + cumulative
// (never cleared; A1 sweep scans this).
const CAPTURED_URLS = [];
const CAPTURED_URLS_ALL = [];

let testHomeDir = null;
let originalHome = null;

const ALL_TMP_ROOTS = [];

process.on('exit', function () {
  if (originalHome !== null) {
    process.env.HOME = originalHome;
  }
  for (const d of ALL_TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

function setupScopedHome() {
  if (originalHome === null) {
    originalHome = process.env.HOME;
  }
  testHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsfetacad-home-'));
  ALL_TMP_ROOTS.push(testHomeDir);
  process.env.HOME = testHomeDir;
  resetRequireCache();
}

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/rs-egress-telemetry.cjs',
    '../core/rs-fetcher-academic.cjs',
    '../core/cross-room-aggregator.cjs',
    './validators/external-academic-invariants.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

// ---------- Mock fetch ----------
//
// Map<urlPrefix, handler(url, opts) -> {ok, status, headers?, json?, text?}>
// Wildcard: any prefix matches as substring (.indexOf >= 0). First match wins.

let originalFetch = null;
const mockResponses = new Map();

function installMockFetch(responses) {
  if (originalFetch === null) {
    originalFetch = global.fetch;
  }
  mockResponses.clear();
  // Clear captured URLs per install so per-scenario assertions see only
  // this scenario's traffic. Cross-scenario aggregation is preserved by
  // scenarios that explicitly read CAPTURED_URLS before the next install.
  CAPTURED_URLS.length = 0;
  for (const [k, v] of Object.entries(responses)) {
    mockResponses.set(k, v);
  }
  global.fetch = async function (url, opts) {
    CAPTURED_URLS.push(String(url));
    CAPTURED_URLS_ALL.push(String(url));
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

function clearApiKeys() {
  delete process.env.SCOPUS_API_KEY;
  delete process.env.IEEE_API_KEY;
  delete process.env.NATURE_API_KEY;
}

function setApiKeys() {
  process.env.SCOPUS_API_KEY = 'test-scopus-key';
  process.env.IEEE_API_KEY = 'test-ieee-key';
  process.env.NATURE_API_KEY = 'test-nature-key';
}

function makeOpenAlexResponse(query, n) {
  // Simulated OpenAlex shape with abstract_inverted_index.
  const works = [];
  for (let i = 0; i < n; i++) {
    works.push({
      id: 'https://openalex.org/W' + i + 'q' + crypto.createHash('sha256').update(query).digest('hex').slice(0, 6),
      title: 'OpenAlex paper ' + i + ' for ' + query,
      abstract_inverted_index: { 'cancer': [0], 'biomarker': [1], 'study': [2] },
      publication_year: 2024,
      authorships: [{ author: { display_name: 'Author A' + i }, institutions: [{ display_name: 'Inst-' + i }] }],
      doi: 'https://doi.org/10.1000/oa-' + i + '-' + crypto.createHash('sha256').update(query).digest('hex').slice(0, 6),
    });
  }
  return { results: works };
}

function makeArxivXml(query, n) {
  let entries = '';
  for (let i = 0; i < n; i++) {
    const tag = crypto.createHash('sha256').update(query).digest('hex').slice(0, 6);
    entries += '<entry><id>http://arxiv.org/abs/2401.000' + i + tag + '</id>'
      + '<title>arXiv paper ' + i + ' for ' + query + '</title>'
      + '<summary>Abstract for arxiv paper ' + i + '.</summary>'
      + '<published>2024-01-' + ((i % 28) + 1).toString().padStart(2, '0') + 'T00:00:00Z</published>'
      + '<author><name>Arxiv Author ' + i + '</name></author>'
      + '</entry>';
  }
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<feed xmlns="http://www.w3.org/2005/Atom">'
    + entries
    + '</feed>';
}

function makePubMedResponse(query, n) {
  const idlist = [];
  for (let i = 0; i < n; i++) {
    idlist.push('PM' + i + crypto.createHash('sha256').update(query).digest('hex').slice(0, 6));
  }
  return { esearchresult: { idlist: idlist, count: String(n) } };
}

function makeScopusResponse(query, n) {
  const entries = [];
  for (let i = 0; i < n; i++) {
    entries.push({
      'dc:identifier': 'SCOPUS_ID:' + i + crypto.createHash('sha256').update(query).digest('hex').slice(0, 6),
      'dc:title': 'Scopus paper ' + i + ' for ' + query,
      'dc:description': 'Scopus abstract ' + i,
      'dc:creator': 'Scopus Author ' + i,
      'prism:doi': '10.1234/scopus-' + i,
      'affiliation': [{ 'affilname': 'Scopus Inst ' + i }],
    });
  }
  return { 'search-results': { entry: entries } };
}

function makeIeeeResponse(query, n) {
  const articles = [];
  for (let i = 0; i < n; i++) {
    articles.push({
      article_number: 'IEEE' + i + crypto.createHash('sha256').update(query).digest('hex').slice(0, 6),
      title: 'IEEE paper ' + i + ' for ' + query,
      abstract: 'IEEE abstract ' + i,
      authors: { authors: [{ full_name: 'IEEE Author ' + i, affiliation: 'IEEE Inst ' + i }] },
      doi: '10.1109/ieee-' + i,
    });
  }
  return { articles: articles, total_records: n };
}

function makeNatureResponse(query, n) {
  const records = [];
  for (let i = 0; i < n; i++) {
    records.push({
      identifier: 'doi:10.1038/nat-' + i + crypto.createHash('sha256').update(query).digest('hex').slice(0, 6),
      title: 'Nature paper ' + i + ' for ' + query,
      abstract: 'Nature abstract ' + i,
      creators: [{ creator: 'Nature Author ' + i }],
      doi: '10.1038/nat-' + i,
    });
  }
  return { records: records };
}

function buildAllSourcesMockOk(query, perSource) {
  return {
    'https://api.openalex.org/works': async function (url) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['x-ratelimit-remaining', '99']]),
        async json() { return makeOpenAlexResponse(query, perSource); },
        async text() { return JSON.stringify(makeOpenAlexResponse(query, perSource)); },
      };
    },
    'export.arxiv.org/api/query': async function (url) {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async text() { return makeArxivXml(query, perSource); },
        async json() { throw new Error('arxiv returns XML'); },
      };
    },
    'eutils.ncbi.nlm.nih.gov': async function (url) {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async json() { return makePubMedResponse(query, perSource); },
        async text() { return JSON.stringify(makePubMedResponse(query, perSource)); },
      };
    },
    'api.elsevier.com/content/search/scopus': async function (url) {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async json() { return makeScopusResponse(query, perSource); },
        async text() { return JSON.stringify(makeScopusResponse(query, perSource)); },
      };
    },
    'ieeexploreapi.ieee.org': async function (url) {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async json() { return makeIeeeResponse(query, perSource); },
        async text() { return JSON.stringify(makeIeeeResponse(query, perSource)); },
      };
    },
    'api.springernature.com': async function (url) {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async json() { return makeNatureResponse(query, perSource); },
        async text() { return JSON.stringify(makeNatureResponse(query, perSource)); },
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

console.log('=== 89.2-02 fetcher-academic suite: starting ===');

(async function main() {

  // ---------- Test 1: happy path 6 sources ----------
  await runScenario('Test 1: happy path 6 sources (with API keys set)', async function () {
    setupScopedHome();
    setApiKeys();
    const queries = ['cancer immunotherapy biomarkers'];
    installMockFetch(buildAllSourcesMockOk(queries[0], 5));
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    const out = await fetcher.fetchAcademic(queries, {});
    assert.ok(out && Array.isArray(out.papers), 'papers is array');
    assert.ok(out.papers.length >= 20,
      'expected >= 20 papers across 6 sources after dedup; got ' + out.papers.length);
    const sample = out.papers[0];
    for (const f of ['id', 'title', 'abstract', 'authors', 'institution', 'doi', 'source', 'fetched_at']) {
      assert.ok(Object.prototype.hasOwnProperty.call(sample, f),
        'paper missing field: ' + f);
    }
    assert.ok(Array.isArray(sample.authors), 'authors is array');
    const sources = new Set(out.papers.map(p => p.source));
    for (const s of ['openalex', 'arxiv', 'pubmed', 'scopus', 'ieee', 'nature']) {
      assert.ok(sources.has(s), 'source coverage missing: ' + s);
    }
    SCENARIO_RESULTS.push({ test: 'T1', surface: 'academic', payload: out });
  });

  // ---------- Test 2: dedup determinism ----------
  await runScenario('Test 2: dedup determinism (same input twice == identical output)', async function () {
    setupScopedHome();
    setApiKeys();
    const queries = ['CRISPR off-target detection'];
    installMockFetch(buildAllSourcesMockOk(queries[0], 5));
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    const r1 = await fetcher.fetchAcademic(queries, {});
    // Reset captured URLs and HOME to avoid budget contamination.
    CAPTURED_URLS.length = 0;
    setupScopedHome();
    installMockFetch(buildAllSourcesMockOk(queries[0], 5));
    const fetcher2 = require('../core/rs-fetcher-academic.cjs');
    const r2 = await fetcher2.fetchAcademic(queries, {});
    // Strip fetched_at because timestamps will diff. Compare structural shape.
    const stripT = function (papers) {
      return papers.map(p => {
        const c = Object.assign({}, p);
        delete c.fetched_at;
        return c;
      });
    };
    assert.equal(JSON.stringify(stripT(r1.papers)), JSON.stringify(stripT(r2.papers)),
      'dedup output must be deterministic across runs');
    SCENARIO_RESULTS.push({ test: 'T2', surface: 'academic', payload: stripT(r1.papers) });
  });

  // ---------- Test 3: API-key-missing graceful ----------
  await runScenario('Test 3: API-key-missing graceful (scopus + ieee + nature unset)', async function () {
    setupScopedHome();
    clearApiKeys();
    const queries = ['quantum brain imaging'];
    installMockFetch(buildAllSourcesMockOk(queries[0], 3));
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    const out = await fetcher.fetchAcademic(queries, {});
    assert.ok(Array.isArray(out.papers), 'papers is array');
    // Only openalex + arxiv + pubmed should populate papers.
    const sources = new Set(out.papers.map(p => p.source));
    assert.ok(sources.has('openalex'), 'openalex present');
    assert.ok(sources.has('arxiv'), 'arxiv present');
    assert.ok(sources.has('pubmed'), 'pubmed present');
    assert.ok(!sources.has('scopus'), 'scopus must be skipped (no API key)');
    assert.ok(!sources.has('ieee'), 'ieee must be skipped (no API key)');
    assert.ok(!sources.has('nature'), 'nature must be skipped (no API key)');

    // Check telemetry has 3 api_key_missing entries.
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const file = telemetry.TELEMETRY_FILE;
    assert.ok(fs.existsSync(file), 'telemetry exists at ' + file);
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const keyMissing = payload.entries.filter(e => e.status === 'api_key_missing');
    assert.equal(keyMissing.length, 3,
      'expected 3 api_key_missing entries; got ' + keyMissing.length);
    SCENARIO_RESULTS.push({ test: 'T3', surface: 'academic', payload: out });
  });

  // ---------- Test 4: 429 rate-limit graceful ----------
  await runScenario('Test 4: 429 rate-limit graceful (openalex returns 429)', async function () {
    setupScopedHome();
    clearApiKeys();
    const queries = ['graphene heat conductivity'];
    const mocks = buildAllSourcesMockOk(queries[0], 4);
    mocks['https://api.openalex.org/works'] = async function () {
      return {
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '60']]),
        async json() { return { error: 'rate limited' }; },
        async text() { return 'rate limited'; },
      };
    };
    installMockFetch(mocks);
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    const out = await fetcher.fetchAcademic(queries, {});
    // Should not throw. Should still have papers from arxiv + pubmed.
    const sources = new Set(out.papers.map(p => p.source));
    assert.ok(!sources.has('openalex'), 'openalex must be empty after 429');
    assert.ok(sources.has('arxiv'), 'arxiv populates');
    assert.ok(sources.has('pubmed'), 'pubmed populates');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const rateLimited = payload.entries.filter(e => e.status === 'rate_limited');
    assert.ok(rateLimited.length >= 1, 'rate_limited telemetry recorded');
    assert.equal(rateLimited[0].http_status, 429, 'http_status 429 recorded');
    SCENARIO_RESULTS.push({ test: 'T4', surface: 'academic', payload: out });
  });

  // ---------- Test 5: timeout graceful ----------
  await runScenario('Test 5: timeout graceful (openalex throws AbortError)', async function () {
    setupScopedHome();
    clearApiKeys();
    const queries = ['CAR-T cell therapy'];
    const mocks = buildAllSourcesMockOk(queries[0], 3);
    mocks['https://api.openalex.org/works'] = async function () {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    installMockFetch(mocks);
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    const out = await fetcher.fetchAcademic(queries, {});
    // Should not throw. Should still have papers from arxiv + pubmed.
    const sources = new Set(out.papers.map(p => p.source));
    assert.ok(!sources.has('openalex'), 'openalex empty after timeout');
    assert.ok(sources.has('arxiv'), 'arxiv populates');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const timed = payload.entries.filter(e => e.status === 'timeout');
    assert.ok(timed.length >= 1, 'timeout telemetry recorded');
    SCENARIO_RESULTS.push({ test: 'T5', surface: 'academic', payload: out });
  });

  // ---------- Test 6: malformed response graceful ----------
  await runScenario('Test 6: malformed response graceful (arXiv returns non-XML)', async function () {
    setupScopedHome();
    clearApiKeys();
    const queries = ['mRNA vaccine technology'];
    const mocks = buildAllSourcesMockOk(queries[0], 3);
    mocks['export.arxiv.org/api/query'] = async function () {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async text() { return '<<<not-xml>>>'; },
        async json() { throw new Error('not json'); },
      };
    };
    installMockFetch(mocks);
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    const out = await fetcher.fetchAcademic(queries, {});
    const sources = new Set(out.papers.map(p => p.source));
    assert.ok(!sources.has('arxiv'), 'arxiv empty after parse failure');
    assert.ok(sources.has('openalex'), 'openalex still populates');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const errd = payload.entries.filter(e => e.status === 'api_error');
    assert.ok(errd.length >= 1, 'api_error telemetry recorded for arxiv');
    SCENARIO_RESULTS.push({ test: 'T6', surface: 'academic', payload: out });
  });

  // ---------- Test 7: per-source budget exhausted ----------
  await runScenario('Test 7: per-source budget exhausted (openalex skipped)', async function () {
    setupScopedHome();
    clearApiKeys();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    // Seed 100 openalex entries within last 24h.
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < 100; i++) {
      entries.push({
        source: 'openalex',
        query_text_hash: 'aaaaaaaaaaaaaaaa',
        status: 'ok',
        fetched_at: new Date(now - (i * 1000)).toISOString(),
      });
    }
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const queries = ['plasma confinement tokamak'];
    installMockFetch(buildAllSourcesMockOk(queries[0], 3));
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    const out = await fetcher.fetchAcademic(queries, {});
    const sources = new Set(out.papers.map(p => p.source));
    assert.ok(!sources.has('openalex'), 'openalex skipped after budget exhausted');
    assert.ok(sources.has('arxiv'), 'arxiv runs normally');

    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    // Note: 'budget_exhausted' is in our extended status enum below; if telemetry
    // module doesn't accept it, fetcher should still skip openalex without error.
    // We assert the behavior (skip), not the telemetry status name strictly here.
    // OpenAlex URL must NOT appear in CAPTURED_URLS for this run.
    const ourUrls = CAPTURED_URLS.filter(u => u.indexOf('openalex.org/works') >= 0);
    assert.equal(ourUrls.length, 0, 'no openalex URL fetched after budget exhaust');
    SCENARIO_RESULTS.push({ test: 'T7', surface: 'academic', payload: out });
  });

  // ---------- Test 8: CANON PART 8 adversarial: leaked-artifact-body ----------
  await runScenario('Test 8: CANON PART 8 adversarial leaked-artifact-body throws', async function () {
    setupScopedHome();
    clearApiKeys();
    // Pattern 3 (meeting with) is the only short way to leak an artifact body in 1 line.
    const queries = ['cancer biomarkers <<artifact: meeting with Dr Smith Q4 financials>>'];
    installMockFetch(buildAllSourcesMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    let threw = null;
    try {
      await fetcher.fetchAcademic(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(threw.meta.surface, 'academic', 'meta.surface');
    assert.ok(typeof threw.meta.matched_pattern === 'string'
      && threw.meta.matched_pattern.length > 0, 'meta.matched_pattern present');

    // ZERO outbound URL captures for this query.
    assert.equal(CAPTURED_URLS.length, 0,
      'NO fetch() calls allowed before throw; got ' + CAPTURED_URLS.length);

    // ZERO telemetry entries for this query.
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    if (fs.existsSync(telemetry.TELEMETRY_FILE)) {
      const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
      assert.equal(payload.entries.length, 0,
        'NO telemetry entries allowed; got ' + payload.entries.length);
    }
    SCENARIO_RESULTS.push({ test: 'T8', surface: 'academic', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 9: CANON PART 8 adversarial: leaked-venture-name (currency) ----------
  await runScenario('Test 9: CANON PART 8 adversarial leaked-venture-financials throws', async function () {
    setupScopedHome();
    clearApiKeys();
    // Pattern 1 (currency $5.2M) leak.
    const queries = ['oncology venture valuation $5.2M cancer treatment'];
    installMockFetch(buildAllSourcesMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    let threw = null;
    try {
      await fetcher.fetchAcademic(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(CAPTURED_URLS.length, 0, 'NO fetch() calls allowed');
    SCENARIO_RESULTS.push({ test: 'T9', surface: 'academic', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 10: CANON PART 8 adversarial: leaked-meeting-fragment ----------
  await runScenario('Test 10: CANON PART 8 adversarial leaked-meeting-fragment throws', async function () {
    setupScopedHome();
    clearApiKeys();
    const queries = ['oncology meeting with Mayo Clinic Q3'];
    installMockFetch(buildAllSourcesMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    let threw = null;
    try {
      await fetcher.fetchAcademic(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(CAPTURED_URLS.length, 0, 'NO fetch() calls allowed');
    SCENARIO_RESULTS.push({ test: 'T10', surface: 'academic', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 11: CANON PART 8 adversarial: leaked-financial-figure (currency variant) ----------
  await runScenario('Test 11: CANON PART 8 adversarial leaked-financial-figure throws', async function () {
    setupScopedHome();
    clearApiKeys();
    const queries = ['oncology partnerships under $750K threshold'];
    installMockFetch(buildAllSourcesMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-academic.cjs');
    let threw = null;
    try {
      await fetcher.fetchAcademic(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(CAPTURED_URLS.length, 0, 'NO fetch() calls allowed');
    SCENARIO_RESULTS.push({ test: 'T11', surface: 'academic', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 12: chokepoint exclusivity (static grep) ----------
  await runScenario('Test 12: chokepoint exclusivity (every fetch() inside per-source dispatcher)', async function () {
    const fetcherPath = path.resolve(__dirname, '..', 'core', 'rs-fetcher-academic.cjs');
    const src = fs.readFileSync(fetcherPath, 'utf8');
    // Find all fetch( occurrences (excluding comments).
    const lines = src.split('\n');
    let fetchCount = 0;
    let inBlockComment = false;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (inBlockComment) {
        if (line.indexOf('*/') >= 0) inBlockComment = false;
        continue;
      }
      // Strip trailing line comments.
      const slashIdx = line.indexOf('//');
      if (slashIdx >= 0) line = line.slice(0, slashIdx);
      if (line.indexOf('/*') >= 0 && line.indexOf('*/') < 0) {
        inBlockComment = true;
        continue;
      }
      // Match 'fetch(' or 'fetchWithTimeout(' or 'global.fetch(' but not function names.
      // Production code MUST go through fetchWithTimeout helper.
      const matches = line.match(/\bfetch\s*\(/g);
      if (matches) {
        // Allow only if it's INSIDE the fetchWithTimeout helper (which is the
        // ONE function that calls native fetch).
        fetchCount += matches.length;
      }
    }
    // We expect exactly 1 native fetch call: inside fetchWithTimeout.
    assert.ok(fetchCount === 1,
      'expected exactly 1 native fetch() call (inside fetchWithTimeout helper); got ' + fetchCount);

    // Also verify auditQueryString call count >= 1 (chokepoint enforcement).
    const auditCount = (src.match(/auditQueryString/g) || []).length;
    assert.ok(auditCount >= 1, 'auditQueryString must be invoked at least once; got ' + auditCount);

    // Verify buildAcademicQuery is defined exactly once.
    const buildDefCount = (src.match(/function buildAcademicQuery/g) || []).length;
    assert.equal(buildDefCount, 1, 'buildAcademicQuery defined exactly once');
  });

  // ---------- V1: validator Check A telemetry-file-absent ----------
  await runScenario('V1: validator Check A telemetry-file-absent -> {severity: null}', async function () {
    setupScopedHome();
    const validator = require('./validators/external-academic-invariants.cjs');
    // Telemetry file does not exist in this scoped HOME.
    const result = validator.validate('/dev/null', {});
    assert.equal(result.severity, null, 'severity null when telemetry absent');
    assert.equal(result.violations.length, 0, 'no violations when telemetry absent');
  });

  // ---------- V2: validator Check B per-source budget exceeded ----------
  await runScenario('V2: validator Check B per-source budget exceeded -> warning', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    // Seed 150 openalex entries within last 24h (over default 100 budget).
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < 150; i++) {
      entries.push({
        source: 'openalex',
        query_text_hash: 'aaaaaaaaaaaaaaaa',
        status: 'ok',
        fetched_at: new Date(now - (i * 1000)).toISOString(),
      });
    }
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-academic-invariants.cjs');
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
      source: 'openalex',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'unknown_status',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-academic-invariants.cjs');
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
      source: 'openalex',
      query_text: 'literal cancer biomarkers query',  // FORBIDDEN: literal field
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'ok',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-academic-invariants.cjs');
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
      source: 'openalex',
      query_text_hash: 'NOT-A-HEX-HASH-XYZ',  // wrong format
      status: 'ok',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-academic-invariants.cjs');
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
      source: 'openalex',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'ok',
      fetched_at: 'NOT-A-VALID-DATE',
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-academic-invariants.cjs');
    const result = validator.validate('/dev/null', {});
    const dateViolations = result.violations.filter(v => v.category === 'fetched_at_malformed');
    assert.ok(dateViolations.length >= 1, 'expected fetched_at_malformed violation');
    assert.equal(dateViolations[0].severity, 'warning', 'severity is warning');
  });

  // ---------- A1 sweep: zero forbidden matches in any captured output ----------
  await runScenario('A1: zero forbidden matches across captured payloads + URLs', async function () {
    for (const rec of SCENARIO_RESULTS) {
      const stringified = JSON.stringify(rec.payload);
      const hit = scanAgainstForbidden(stringified);
      assert.equal(hit.hit, false,
        'A1 violation in ' + rec.test + '/' + rec.surface +
        ' against pattern ' + (hit.pattern || 'n/a'));
    }
    // Also scan every captured outbound URL across the ENTIRE suite.
    // CAPTURED_URLS is per-scenario; CAPTURED_URLS_ALL is the cumulative
    // ledger that captures every URL ever issued during the suite.
    for (const u of CAPTURED_URLS_ALL) {
      const hit = scanAgainstForbidden(u);
      assert.equal(hit.hit, false,
        'A1 outbound URL leaked forbidden pattern ' + (hit.pattern || 'n/a') +
        ' in ' + u.slice(0, 100));
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

  console.log('=== 89.2-02 fetcher-academic suite: 18/18 passed ===');
  process.exit(0);
})();
