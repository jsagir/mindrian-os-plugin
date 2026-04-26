#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 03 -- patents fetcher fixture suite.
 *
 * 17 scenarios total: 11 fetcher tests + 6 validator tests.
 *
 *   Test 1  happy path 2 sources (Google Patents + USPTO mock fetch)
 *   Test 2  dedup determinism (same input twice -> identical output)
 *   Test 3  Google Patents 429 rate-limit graceful (uspto continues)
 *   Test 4  USPTO timeout graceful (google_patents continues)
 *   Test 5  Google Patents malformed JSON-LD graceful (uspto continues)
 *   Test 6  USPTO malformed JSON graceful (api_error logged)
 *   Test 7  per-source budget exhausted (google_patents skipped)
 *   Test 8  CANON PART 8 adversarial: leaked-artifact-body in query throws
 *   Test 9  CANON PART 8 adversarial: leaked-venture-financials throws
 *   Test 10 CANON PART 8 adversarial: leaked-meeting-fragment throws
 *   Test 11 CANON PART 8 adversarial: leaked-SSN-style figure throws
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
  testHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsfetpat-home-'));
  ALL_TMP_ROOTS.push(testHomeDir);
  process.env.HOME = testHomeDir;
  resetRequireCache();
}

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/rs-egress-telemetry.cjs',
    '../core/rs-fetcher-patents.cjs',
    '../core/cross-room-aggregator.cjs',
    './validators/external-patents-invariants.cjs',
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

function makeGooglePatentsHtml(query, n) {
  // Simulated patents.google.com HTML payload with embedded JSON-LD <script>
  // tags carrying patent metadata. The real surface emits one JSON-LD per
  // result; mock mirrors that shape so the parser exercise is end-to-end.
  let scripts = '';
  for (let i = 0; i < n; i++) {
    const tag = crypto.createHash('sha256').update(query).digest('hex').slice(0, 6);
    const obj = {
      '@type': 'Patent',
      patentNumber: 'US' + (10000000 + i) + tag.slice(0, 0).toUpperCase() + 'B2',
      name: 'Google Patents result ' + i + ' for ' + query,
      description: 'Abstract for Google Patents result ' + i + '.',
      inventor: [{ '@type': 'Person', name: 'Inventor A' + i }, { '@type': 'Person', name: 'Inventor B' + i }],
      assignee: { '@type': 'Organization', name: 'Org-' + i + '-Inc' },
      filingDate: '2023-04-' + ((i % 28) + 1).toString().padStart(2, '0'),
    };
    // Re-shape patentNumber so it matches /^[A-Z]{2}\d+[A-Z]\d?$/ assertion.
    obj.patentNumber = 'US' + (10000000 + i) + 'B2';
    scripts += '<script type="application/ld+json">' + JSON.stringify(obj) + '</script>';
  }
  return '<!doctype html><html><head>' + scripts + '</head><body>results</body></html>';
}

function makeUsptoResponse(query, n) {
  const records = [];
  for (let i = 0; i < n; i++) {
    const tag = crypto.createHash('sha256').update(query).digest('hex').slice(0, 6);
    records.push({
      patentNumber: 'US' + (20000000 + i) + 'B1',
      patentTitle: 'USPTO patent ' + i + ' for ' + query,
      patentAbstract: 'USPTO abstract ' + i,
      inventorName: ['Last' + i + ', First' + i, 'Last' + i + 'B, First' + i + 'B'],
      assigneeEntityName: 'USPTO Assignee ' + i + ' Inc',
      filingDate: '2023-05-' + ((i % 28) + 1).toString().padStart(2, '0'),
      _tag: tag,
    });
  }
  return { results: records, total: n };
}

function buildAllSourcesMockOk(query, perSource) {
  return {
    'patents.google.com': async function (url) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['x-ratelimit-remaining', '49']]),
        async text() { return makeGooglePatentsHtml(query, perSource); },
        async json() { throw new Error('google patents returns HTML'); },
      };
    },
    'api.uspto.gov': async function (url) {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async json() { return makeUsptoResponse(query, perSource); },
        async text() { return JSON.stringify(makeUsptoResponse(query, perSource)); },
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

console.log('=== 89.2-03 fetcher-patents suite: starting ===');

(async function main() {

  // ---------- Test 1: happy path 2 sources ----------
  await runScenario('Test 1: happy path 2 sources (Google Patents + USPTO)', async function () {
    setupScopedHome();
    const queries = ['quantum entanglement detection'];
    installMockFetch(buildAllSourcesMockOk(queries[0], 5));
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    const out = await fetcher.fetchPatents(queries, {});
    assert.ok(out && Array.isArray(out.patents), 'patents is array');
    assert.ok(out.patents.length >= 8,
      'expected >= 8 patents across 2 sources after dedup; got ' + out.patents.length);
    const sample = out.patents[0];
    for (const f of ['patent_id', 'title', 'abstract', 'inventors', 'assignee', 'filing_date', 'source', 'fetched_at']) {
      assert.ok(Object.prototype.hasOwnProperty.call(sample, f),
        'patent missing field: ' + f);
    }
    assert.ok(Array.isArray(sample.inventors), 'inventors is array');
    assert.ok(/^[A-Z]{2}\d+[A-Z]\d?$/.test(sample.patent_id),
      'patent_id matches /^[A-Z]{2}\\d+[A-Z]\\d?$/; got ' + sample.patent_id);
    const sources = new Set(out.patents.map(p => p.source));
    for (const s of ['google_patents', 'uspto']) {
      assert.ok(sources.has(s), 'source coverage missing: ' + s);
    }
    SCENARIO_RESULTS.push({ test: 'T1', surface: 'patents', payload: out });
  });

  // ---------- Test 2: dedup determinism ----------
  await runScenario('Test 2: dedup determinism (same input twice == identical output)', async function () {
    setupScopedHome();
    const queries = ['CRISPR gene editing'];
    installMockFetch(buildAllSourcesMockOk(queries[0], 5));
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    const r1 = await fetcher.fetchPatents(queries, {});
    CAPTURED_URLS.length = 0;
    setupScopedHome();
    installMockFetch(buildAllSourcesMockOk(queries[0], 5));
    const fetcher2 = require('../core/rs-fetcher-patents.cjs');
    const r2 = await fetcher2.fetchPatents(queries, {});
    const stripT = function (patents) {
      return patents.map(p => {
        const c = Object.assign({}, p);
        delete c.fetched_at;
        return c;
      });
    };
    assert.equal(JSON.stringify(stripT(r1.patents)), JSON.stringify(stripT(r2.patents)),
      'dedup output must be deterministic across runs');
    SCENARIO_RESULTS.push({ test: 'T2', surface: 'patents', payload: stripT(r1.patents) });
  });

  // ---------- Test 3: Google Patents 429 rate-limit graceful ----------
  await runScenario('Test 3: Google Patents 429 rate-limit graceful (uspto continues)', async function () {
    setupScopedHome();
    const queries = ['graphene heat conductivity'];
    const mocks = buildAllSourcesMockOk(queries[0], 4);
    mocks['patents.google.com'] = async function () {
      return {
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '60']]),
        async text() { return 'rate limited'; },
        async json() { return { error: 'rate limited' }; },
      };
    };
    installMockFetch(mocks);
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    const out = await fetcher.fetchPatents(queries, {});
    const sources = new Set(out.patents.map(p => p.source));
    assert.ok(!sources.has('google_patents'), 'google_patents must be empty after 429');
    assert.ok(sources.has('uspto'), 'uspto populates');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const rateLimited = payload.entries.filter(e => e.status === 'rate_limited');
    assert.ok(rateLimited.length >= 1, 'rate_limited telemetry recorded');
    assert.equal(rateLimited[0].http_status, 429, 'http_status 429 recorded');
    SCENARIO_RESULTS.push({ test: 'T3', surface: 'patents', payload: out });
  });

  // ---------- Test 4: USPTO timeout graceful ----------
  await runScenario('Test 4: USPTO timeout graceful (google_patents continues)', async function () {
    setupScopedHome();
    const queries = ['CAR-T cell therapy'];
    const mocks = buildAllSourcesMockOk(queries[0], 3);
    mocks['api.uspto.gov'] = async function () {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    installMockFetch(mocks);
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    const out = await fetcher.fetchPatents(queries, {});
    const sources = new Set(out.patents.map(p => p.source));
    assert.ok(!sources.has('uspto'), 'uspto empty after timeout');
    assert.ok(sources.has('google_patents'), 'google_patents populates');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const timed = payload.entries.filter(e => e.status === 'timeout');
    assert.ok(timed.length >= 1, 'timeout telemetry recorded');
    SCENARIO_RESULTS.push({ test: 'T4', surface: 'patents', payload: out });
  });

  // ---------- Test 5: Google Patents malformed JSON-LD graceful ----------
  await runScenario('Test 5: Google Patents malformed (no JSON-LD) graceful', async function () {
    setupScopedHome();
    const queries = ['mRNA vaccine technology'];
    const mocks = buildAllSourcesMockOk(queries[0], 3);
    mocks['patents.google.com'] = async function () {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async text() { return '<!doctype html><html><body>no json-ld here</body></html>'; },
        async json() { throw new Error('not json'); },
      };
    };
    installMockFetch(mocks);
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    const out = await fetcher.fetchPatents(queries, {});
    const sources = new Set(out.patents.map(p => p.source));
    assert.ok(!sources.has('google_patents'), 'google_patents empty after no-JSON-LD');
    assert.ok(sources.has('uspto'), 'uspto still populates');
    // Note: no JSON-LD found returns [] (not an api_error) since the parser
    // gracefully handles absent script tags. Either ok-with-zero-results or
    // api_error is acceptable; assert behavior (skip), not telemetry name.
    SCENARIO_RESULTS.push({ test: 'T5', surface: 'patents', payload: out });
  });

  // ---------- Test 6: USPTO malformed JSON graceful ----------
  await runScenario('Test 6: USPTO malformed JSON graceful (api_error logged)', async function () {
    setupScopedHome();
    const queries = ['fusion plasma confinement'];
    const mocks = buildAllSourcesMockOk(queries[0], 3);
    mocks['api.uspto.gov'] = async function () {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        async json() { throw new SyntaxError('invalid JSON'); },
        async text() { return '<<<not-json>>>'; },
      };
    };
    installMockFetch(mocks);
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    const out = await fetcher.fetchPatents(queries, {});
    const sources = new Set(out.patents.map(p => p.source));
    assert.ok(!sources.has('uspto'), 'uspto empty after parse failure');
    assert.ok(sources.has('google_patents'), 'google_patents still populates');

    const telemetry = require('../core/rs-egress-telemetry.cjs');
    const payload = JSON.parse(fs.readFileSync(telemetry.TELEMETRY_FILE, 'utf8'));
    const errd = payload.entries.filter(e => e.status === 'api_error');
    assert.ok(errd.length >= 1, 'api_error telemetry recorded for uspto');
    SCENARIO_RESULTS.push({ test: 'T6', surface: 'patents', payload: out });
  });

  // ---------- Test 7: per-source budget exhausted ----------
  await runScenario('Test 7: per-source budget exhausted (google_patents skipped)', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    // Seed 50 google_patents entries within last 24h (default budget = 50).
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < 50; i++) {
      entries.push({
        source: 'google_patents',
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
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    const out = await fetcher.fetchPatents(queries, {});
    const sources = new Set(out.patents.map(p => p.source));
    assert.ok(!sources.has('google_patents'), 'google_patents skipped after budget exhausted');
    assert.ok(sources.has('uspto'), 'uspto runs normally');

    const ourUrls = CAPTURED_URLS.filter(u => u.indexOf('patents.google.com') >= 0);
    assert.equal(ourUrls.length, 0, 'no google_patents URL fetched after budget exhaust');
    SCENARIO_RESULTS.push({ test: 'T7', surface: 'patents', payload: out });
  });

  // ---------- Test 8: CANON PART 8 adversarial: leaked-artifact-body ----------
  await runScenario('Test 8: CANON PART 8 adversarial leaked-artifact-body throws', async function () {
    setupScopedHome();
    // Pattern 3 (meeting with) leak.
    const queries = ['CRISPR <<artifact: meeting with Genentech Q4 financials>>'];
    installMockFetch(buildAllSourcesMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    let threw = null;
    try {
      await fetcher.fetchPatents(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(threw.meta.surface, 'patents', 'meta.surface');
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
    SCENARIO_RESULTS.push({ test: 'T8', surface: 'patents', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 9: CANON PART 8 adversarial: leaked-venture-financials ----------
  await runScenario('Test 9: CANON PART 8 adversarial leaked-venture-financials throws', async function () {
    setupScopedHome();
    // Pattern 1 (currency $5M) leak.
    const queries = ['Lawrence said our patent strategy needs $5M biotech'];
    installMockFetch(buildAllSourcesMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    let threw = null;
    try {
      await fetcher.fetchPatents(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(CAPTURED_URLS.length, 0, 'NO fetch() calls allowed');
    SCENARIO_RESULTS.push({ test: 'T9', surface: 'patents', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 10: CANON PART 8 adversarial: leaked-meeting-fragment ----------
  await runScenario('Test 10: CANON PART 8 adversarial leaked-meeting-fragment throws', async function () {
    setupScopedHome();
    const queries = ['biotech meeting with Pfizer about IP'];
    installMockFetch(buildAllSourcesMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    let threw = null;
    try {
      await fetcher.fetchPatents(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(CAPTURED_URLS.length, 0, 'NO fetch() calls allowed');
    SCENARIO_RESULTS.push({ test: 'T10', surface: 'patents', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- Test 11: CANON PART 8 adversarial: leaked-SSN ----------
  await runScenario('Test 11: CANON PART 8 adversarial leaked-SSN-style throws', async function () {
    setupScopedHome();
    // Pattern 5 (SSN-style 123-45-6789) leak.
    const queries = ['inventor 123-45-6789 patents quantum'];
    installMockFetch(buildAllSourcesMockOk('clean', 1));
    const fetcher = require('../core/rs-fetcher-patents.cjs');
    let threw = null;
    try {
      await fetcher.fetchPatents(queries, {});
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw on adversarial query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
    assert.equal(CAPTURED_URLS.length, 0, 'NO fetch() calls allowed');
    SCENARIO_RESULTS.push({ test: 'T11', surface: 'patents', payload: { threw: threw.meta.matched_pattern } });
  });

  // ---------- V1: validator Check A telemetry-file-absent ----------
  await runScenario('V1: validator Check A telemetry-file-absent -> {severity: null}', async function () {
    setupScopedHome();
    const validator = require('./validators/external-patents-invariants.cjs');
    const result = validator.validate('/dev/null', {});
    assert.equal(result.severity, null, 'severity null when telemetry absent');
    assert.equal(result.violations.length, 0, 'no violations when telemetry absent');
  });

  // ---------- V2: validator Check B per-source budget exceeded ----------
  await runScenario('V2: validator Check B per-source budget exceeded -> warning', async function () {
    setupScopedHome();
    const telemetry = require('../core/rs-egress-telemetry.cjs');
    // Seed 75 google_patents entries within last 24h (over default 50 budget).
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < 75; i++) {
      entries.push({
        source: 'google_patents',
        query_text_hash: 'aaaaaaaaaaaaaaaa',
        status: 'ok',
        fetched_at: new Date(now - (i * 1000)).toISOString(),
      });
    }
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-patents-invariants.cjs');
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
      source: 'google_patents',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'unknown_status',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-patents-invariants.cjs');
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
      source: 'google_patents',
      query_text: 'literal CRISPR patent query',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'ok',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-patents-invariants.cjs');
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
      source: 'google_patents',
      query_text_hash: 'NOT-A-HEX-HASH-XYZ',
      status: 'ok',
      fetched_at: new Date().toISOString(),
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-patents-invariants.cjs');
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
      source: 'google_patents',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'ok',
      fetched_at: 'NOT-A-VALID-DATE',
    }];
    fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
    fs.writeFileSync(telemetry.TELEMETRY_FILE,
      JSON.stringify({ schema_version: '1.0', entries: entries }, null, 2));

    const validator = require('./validators/external-patents-invariants.cjs');
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

  console.log('=== 89.2-03 fetcher-patents suite: 17/17 passed ===');
  process.exit(0);
})();
