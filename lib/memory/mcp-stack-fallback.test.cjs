#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Phase 94 Plan 05 -- mcp-stack fallback chain RED -> GREEN fixture suite.
 *
 * Per the user-approved plan amendment dated 2026-04-28 (commit 66a1a34),
 * the original "4 fetchers all currently call Tavily/Firecrawl/Exa via
 * mcp__* prefixes" framing was rewritten to match the actual module
 * landscape:
 *
 *   - rs-fetcher-academic.cjs:   6 sources, 3 free + 3 keyed. Free tier
 *                                already works. Envelope wrap only.
 *   - rs-fetcher-patents.cjs:    2 sources, both keyless. Free tier
 *                                already works. Envelope wrap only.
 *   - rs-fetcher-industry.cjs:   1 source, TAVILY_API_KEY required. THIS
 *                                IS THE TRUE Tavily-only gap. Gets opts.
 *                                tavily / opts.webSearch / opts.cacheReader
 *                                injection seams.
 *   - rs-fetcher-experts.cjs:    Post-processor over academic papers[].
 *                                Already works without keys. Envelope
 *                                wrap only with tier='derived'.
 *
 *   - commands/research.md:      frontmatter ALREADY declares WebSearch +
 *                                WebFetch in allowed-tools (lines 6-7).
 *                                What's missing: body has a hard-stop
 *                                "Requires Brain MCP. Then stop." which
 *                                blocks fresh installs.
 *
 * Test map (7 cases, one-to-one with the amendment <action> block):
 *
 *   T1 Industry happy paid:         opts.tavily mock returns results,
 *                                   envelope shape is
 *                                   {tier:'paid', source:'tavily',
 *                                    results:[...], signals:[...],
 *                                    telemetry:[...]}.
 *   T2 Industry native fallback:    no TAVILY_API_KEY, opts.webSearch
 *                                   mock returns; envelope is
 *                                   {tier:'native', source:'websearch',
 *                                    results:[...], signals:[...]}.
 *   T3 Industry cache fallback:     no TAVILY_API_KEY, no opts.webSearch,
 *                                   opts.cacheReader returns cached;
 *                                   envelope is {tier:'cache',
 *                                   source:'cache', results:[...]}.
 *   T4 Industry all-tiers-down:     no source; returns empty results,
 *                                   never throws. tier='cache' source='cache'
 *                                   results=[]. signals preserved (empty).
 *   T5 Envelope shape uniformity:   academic / patents / experts each
 *                                   return {tier, source, results} with
 *                                   tier in valid set + source in valid
 *                                   set, AND domain-specific keys
 *                                   preserved (papers / patents / experts)
 *                                   for backward compat with rs-discovery-
 *                                   engine line 380 industry.signals
 *                                   consumer pattern.
 *   T6 Section-8 schema field:      lib/core/section-8-trace-schema.cjs
 *                                   exports a schema literal containing
 *                                   web_research_tier somewhere reachable.
 *   T7 commands/research.md body:   frontmatter already declares both
 *                                   WebSearch AND WebFetch (verified once);
 *                                   body must NO LONGER contain the
 *                                   "Requires Brain MCP" + "Then stop."
 *                                   hard-stop directive.
 *
 * Pure CJS, zero npm deps. Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

const PATH_INDUSTRY = path.join(REPO, 'lib/core/rs-fetcher-industry.cjs');
const PATH_ACADEMIC = path.join(REPO, 'lib/core/rs-fetcher-academic.cjs');
const PATH_PATENTS = path.join(REPO, 'lib/core/rs-fetcher-patents.cjs');
const PATH_EXPERTS = path.join(REPO, 'lib/core/rs-fetcher-experts.cjs');
const PATH_SCHEMA = path.join(REPO, 'lib/core/section-8-trace-schema.cjs');
const PATH_RESEARCH_MD = path.join(REPO, 'commands/research.md');

// ---------- Frozen invariants ----------

const VALID_TIERS = Object.freeze(['paid', 'native', 'cache', 'derived']);
const VALID_SOURCES = Object.freeze([
  'tavily',
  'firecrawl',
  'exa',
  'websearch',
  'cache',
  'openalex',
  'arxiv',
  'pubmed',
  'scopus',
  'ieee',
  'nature',
  'google_patents',
  'uspto',
  'derived',
]);

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', function () {
  for (const d of TMP_ROOTS) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
});

// Reload a module from disk (drops require.cache so per-test env-var
// mutations are honored on next require).
function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

// ---------- Mock factories ----------

function makeTavilyMock(results) {
  return async function tavilyMock(query, opts) {
    return {
      results: results.map(function (r) { return Object.assign({}, r); }),
    };
  };
}

function makeWebSearchMock(results) {
  return async function webSearchMock(query) {
    return {
      results: results.map(function (r) { return Object.assign({}, r); }),
    };
  };
}

function makeCacheReader(payload) {
  return function cacheReaderMock(roomDir) {
    return payload;
  };
}

// ---------- Helpers to assert envelope shape ----------

function assertEnvelope(env, expectedTier, expectedSource, label) {
  assert.ok(env && typeof env === 'object', label + ': envelope is object');
  assert.ok(VALID_TIERS.indexOf(env.tier) >= 0,
    label + ': tier "' + env.tier + '" must be in ' + JSON.stringify(VALID_TIERS));
  assert.ok(VALID_SOURCES.indexOf(env.source) >= 0,
    label + ': source "' + env.source + '" must be in valid set');
  assert.ok(Array.isArray(env.results),
    label + ': results must be an array');
  if (expectedTier !== null) {
    assert.strictEqual(env.tier, expectedTier, label + ': tier matches expected');
  }
  if (expectedSource !== null) {
    assert.strictEqual(env.source, expectedSource, label + ': source matches expected');
  }
}

// ---------- Tests ----------

async function test_1_industry_happy_paid() {
  // T1: opts.tavily injected; happy path returns paid envelope.
  // Backward-compat: signals[] preserved alongside results[].
  const mod = freshRequire(PATH_INDUSTRY);
  if (typeof mod.fetchIndustry !== 'function') {
    throw new Error('T1: fetchIndustry export missing');
  }
  // Set TAVILY_API_KEY so the chokepoint won't short-circuit on
  // api_key_missing; opts.tavily will short-circuit before any real fetch.
  const prev = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = 'test-key';
  let env;
  try {
    env = await mod.fetchIndustry(['quantum biotech'], {
      tavily: makeTavilyMock([
        {
          company: 'AcmeQuantum',
          signal: 'Series A funding for quantum imaging',
          url: 'https://acmequantum.com/news',
          source: 'tavily',
          fetched_at: new Date().toISOString(),
        },
      ]),
    });
  } finally {
    if (prev === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = prev;
  }
  assertEnvelope(env, 'paid', 'tavily', 'T1');
  assert.ok(env.results.length >= 1, 'T1: results non-empty');
  // Backward-compat: rs-discovery-engine line 380 reads industry.signals.
  assert.ok(Array.isArray(env.signals), 'T1: signals[] preserved for backward compat');
  assert.ok(env.signals.length >= 1, 'T1: signals[] non-empty');
}

async function test_2_industry_native_fallback() {
  // T2: no TAVILY_API_KEY; opts.webSearch returns native results.
  const mod = freshRequire(PATH_INDUSTRY);
  const prev = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  let env;
  try {
    env = await mod.fetchIndustry(['quantum biotech'], {
      webSearch: makeWebSearchMock([
        {
          url: 'https://example.com/quantum',
          title: 'Quantum Imaging Startup',
          snippet: 'Series A round closed Q1 2026.',
        },
      ]),
    });
  } finally {
    if (prev !== undefined) process.env.TAVILY_API_KEY = prev;
  }
  assertEnvelope(env, 'native', 'websearch', 'T2');
  assert.ok(env.results.length >= 1, 'T2: native results non-empty');
  assert.ok(Array.isArray(env.signals), 'T2: signals[] preserved');
}

async function test_3_industry_cache_fallback() {
  // T3: no TAVILY_API_KEY, no webSearch; cacheReader returns cached envelope.
  const mod = freshRequire(PATH_INDUSTRY);
  const prev = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  let env;
  try {
    env = await mod.fetchIndustry(['quantum biotech'], {
      cacheReader: makeCacheReader({
        results: [
          { company: 'CachedCorp', signal: 'cached signal', url: 'https://cached.example/' },
        ],
        signals: [
          { company: 'CachedCorp', signal: 'cached signal', url: 'https://cached.example/' },
        ],
      }),
    });
  } finally {
    if (prev !== undefined) process.env.TAVILY_API_KEY = prev;
  }
  assertEnvelope(env, 'cache', 'cache', 'T3');
  assert.ok(env.results.length >= 1, 'T3: cache results non-empty');
}

async function test_4_industry_all_tiers_down() {
  // T4: no TAVILY_API_KEY, no webSearch, no cacheReader -> empty results,
  // tier='cache' source='cache', never throws, signals[] still present.
  const mod = freshRequire(PATH_INDUSTRY);
  const prev = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  let env;
  try {
    env = await mod.fetchIndustry(['quantum biotech']);
  } catch (err) {
    throw new Error('T4: fetchIndustry threw on all-tiers-down: ' + err.message);
  } finally {
    if (prev !== undefined) process.env.TAVILY_API_KEY = prev;
  }
  assertEnvelope(env, 'cache', 'cache', 'T4');
  assert.deepStrictEqual(env.results, [], 'T4: results is empty array');
  assert.ok(Array.isArray(env.signals), 'T4: signals preserved as array');
  assert.strictEqual(env.signals.length, 0, 'T4: signals empty');
}

async function test_5_envelope_shape_uniformity() {
  // T5: academic / patents / experts must return {tier, source, results}
  // with backward-compat domain-specific keys preserved (papers, patents,
  // experts).
  //
  // These three modules already work without keys for free-tier paths.
  // Plan amendment scope: envelope wrap only -- no new injection seams
  // required (the modules already exist with their own logic). The wrap
  // adds tier+source+results on top of existing shape.

  // Academic: free tier (openalex / arxiv / pubmed) returns papers[]
  // even with no env vars. We don't actually fetch the network here;
  // we mock by setting all source budgets to 0 and asserting the
  // module's wrap layer still emits an envelope.
  {
    const mod = freshRequire(PATH_ACADEMIC);
    if (typeof mod.fetchAcademic !== 'function') {
      throw new Error('T5: fetchAcademic export missing');
    }
    const env = await mod.fetchAcademic(['NV diamond'], {
      // Zero every source budget so no real fetch fires; the wrap
      // layer still must emit the envelope shape.
      budget: {
        openalex: 0,
        arxiv: 0,
        pubmed: 0,
        scopus: 0,
        ieee: 0,
        nature: 0,
      },
    });
    assertEnvelope(env, null, null, 'T5/academic');
    assert.ok(Array.isArray(env.papers), 'T5/academic: papers[] preserved for backward compat');
  }

  // Patents: free tier (google_patents / uspto). Same pattern.
  {
    const mod = freshRequire(PATH_PATENTS);
    if (typeof mod.fetchPatents !== 'function') {
      throw new Error('T5: fetchPatents export missing');
    }
    const env = await mod.fetchPatents(['NV diamond'], {
      budget: { google_patents: 0, uspto: 0 },
    });
    assertEnvelope(env, null, null, 'T5/patents');
    assert.ok(Array.isArray(env.patents), 'T5/patents: patents[] preserved for backward compat');
  }

  // Experts: post-processor over papers[]. Pass empty papers; should
  // return Array-with-envelope-properties hybrid (tier='derived',
  // source='derived', experts[] preserved). The hybrid pattern means
  // existing consumers (.length, .find, indexing) keep working AND the
  // envelope contract holds.
  {
    const mod = freshRequire(PATH_EXPERTS);
    if (typeof mod.mapExperts !== 'function') {
      throw new Error('T5: mapExperts export missing');
    }
    const env = mod.mapExperts([]);
    // Hybrid: must be an Array AND carry envelope properties.
    if (!Array.isArray(env)) {
      throw new Error('T5/experts: mapExperts must still return an Array (backward compat)');
    }
    if (typeof env.tier === 'undefined') {
      throw new Error('T5/experts: mapExperts return missing tier envelope property');
    }
    assertEnvelope(env, 'derived', 'derived', 'T5/experts');
    assert.ok(Array.isArray(env.experts), 'T5/experts: experts[] preserved for backward compat');
  }
}

function test_6_section8_schema_field() {
  // T6: lib/core/section-8-trace-schema.cjs exports a schema literal
  // containing 'web_research_tier' somewhere reachable.
  if (!fs.existsSync(PATH_SCHEMA)) {
    throw new Error('T6: lib/core/section-8-trace-schema.cjs does not exist (RED)');
  }
  let mod;
  try {
    mod = freshRequire(PATH_SCHEMA);
  } catch (err) {
    throw new Error('T6: failed to require schema module: ' + err.message);
  }
  // Walk the export and look for the field anywhere reachable.
  const seen = new Set();
  function walk(node) {
    if (node === null || node === undefined) return false;
    if (typeof node === 'string') return node === 'web_research_tier';
    if (typeof node !== 'object') return false;
    if (seen.has(node)) return false;
    seen.add(node);
    for (const key of Object.keys(node)) {
      if (key === 'web_research_tier') return true;
      if (walk(node[key])) return true;
    }
    return false;
  }
  if (!walk(mod)) {
    // Also search the source text as a fallback (the schema may
    // expose the field via a JSON Schema that doesn't surface as a key).
    const src = fs.readFileSync(PATH_SCHEMA, 'utf8');
    if (src.indexOf('web_research_tier') < 0) {
      throw new Error('T6: web_research_tier not found in schema export or source');
    }
  }
}

function test_7_research_md_body() {
  // T7: commands/research.md frontmatter declares both WebSearch and
  // WebFetch (verified) AND the body MUST NO LONGER contain the
  // "Requires Brain MCP. Then stop." hard-stop that blocks fresh installs.
  const src = fs.readFileSync(PATH_RESEARCH_MD, 'utf8');
  // Frontmatter declarations (already correct pre-94-05; verified here).
  assert.ok(/^\s*-\s+WebSearch\s*$/m.test(src),
    'T7: allowed-tools must list WebSearch');
  assert.ok(/^\s*-\s+WebFetch\s*$/m.test(src),
    'T7: allowed-tools must list WebFetch');
  // The hard-stop must be removed from the body.
  if (/Requires Brain MCP/.test(src)) {
    throw new Error('T7: body still contains "Requires Brain MCP" hard-stop');
  }
  if (/Then stop\./.test(src)) {
    throw new Error('T7: body still contains "Then stop." directive');
  }
}

// ---------- Test runner ----------

const TESTS = [
  ['T1 industry happy paid', test_1_industry_happy_paid],
  ['T2 industry native fallback', test_2_industry_native_fallback],
  ['T3 industry cache fallback', test_3_industry_cache_fallback],
  ['T4 industry all-tiers-down', test_4_industry_all_tiers_down],
  ['T5 envelope shape uniformity', test_5_envelope_shape_uniformity],
  ['T6 section-8 schema web_research_tier', test_6_section8_schema_field],
  ['T7 research.md body hard-stop removed', test_7_research_md_body],
];

(async function main() {
  let passed = 0;
  let failed = 0;
  for (const entry of TESTS) {
    const name = entry[0];
    const fn = entry[1];
    try {
      const r = fn();
      if (r && typeof r.then === 'function') {
        await r;
      }
      process.stdout.write('PASS ' + name + '\n');
      passed += 1;
    } catch (err) {
      process.stderr.write('FAIL ' + name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
      failed += 1;
    }
  }
  process.stdout.write('\nmcp-stack-fallback: ' + passed + '/' + (passed + failed) + ' passed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
