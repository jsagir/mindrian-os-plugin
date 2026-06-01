#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 130.5 Plan 01 Task 2 -- research-corpus.cjs behavior suite.
 *
 * The unified fetchCorpus({source, query, limit}) interface + per-source
 * adapter registry, with the single fail-closed Canon Part 8 audit chokepoint.
 *
 * 5 behaviors (mirrors the test-rs-fetcher-academic.cjs node:assert/strict +
 * global.fetch-stub-with-call-counter idiom):
 *
 *   Test 1: openalex happy path -> normalized paper shape; source === 'openalex'.
 *   Test 2: planted FORBIDDEN_PATTERN query throws ExternalEgressViolation
 *           BEFORE global.fetch is called -- fetch call-count is 0 (fail closed).
 *   Test 3: sci-bot returns the disabled no-op envelope; zero fetch.
 *   Test 4: brain-cypher with isAvailable() false returns a degraded envelope
 *           (no throw); with isAvailable() true, the only Brain call carries a
 *           sanitized generic handle (never raw user content); a forbidden
 *           brain-cypher query is rejected by the same audit before any Brain call.
 *   Test 5: unknown source throws TypeError; the module source contains ZERO
 *           child_process / python spawn references.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, fs, path).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let passed = 0;
let failed = 0;
const failures = [];

// ---------- global.fetch stub with a call counter ----------

let originalFetch = null;
let fetchCallCount = 0;
let fetchHandler = null;

function installFetchStub(handler) {
  if (originalFetch === null) {
    originalFetch = global.fetch;
  }
  fetchCallCount = 0;
  fetchHandler = handler || (async function () {
    return { ok: false, status: 404, headers: new Map(), async json() { return {}; }, async text() { return ''; } };
  });
  global.fetch = async function (url, opts) {
    fetchCallCount += 1;
    return fetchHandler(url, opts);
  };
}

function restoreFetch() {
  if (originalFetch !== null) {
    global.fetch = originalFetch;
  }
  fetchHandler = null;
}

function freshModule() {
  // Reset the corpus + academic + egress modules so global.fetch stub and any
  // env changes are seen freshly per scenario.
  const targets = [
    './research-corpus.cjs',
    './rs-fetcher-academic.cjs',
    './rs-egress-prompts.cjs',
    './rs-egress-violations.cjs',
    './rs-egress-telemetry.cjs',
    './cross-room-aggregator.cjs',
    './brain-client.cjs',
  ];
  for (const t of targets) {
    try { delete require.cache[require.resolve(t)]; } catch (_e) { /* best effort */ }
  }
  return require('./research-corpus.cjs');
}

function makeOpenAlexResponse(query, n) {
  const works = [];
  for (let i = 0; i < n; i++) {
    works.push({
      id: 'https://openalex.org/W' + i,
      title: 'OpenAlex paper ' + i + ' for ' + query,
      abstract_inverted_index: { 'quantum': [0], 'biology': [1], 'study': [2] },
      publication_year: 2024,
      authorships: [{ author: { display_name: 'Author A' + i }, institutions: [{ display_name: 'Inst-' + i }] }],
      doi: 'https://doi.org/10.1000/oa-' + i,
    });
  }
  return { results: works };
}

async function runScenario(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    failures.push({ name: name, err: err });
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  } finally {
    restoreFetch();
  }
}

console.log('=== 130.5-01 research-corpus suite: starting ===');

(async function main() {

  // ---------- Test 1: openalex happy path ----------
  await runScenario('Test 1: openalex happy path -> normalized paper shape, source===openalex', async function () {
    installFetchStub(async function (url) {
      if (String(url).indexOf('api.openalex.org/works') >= 0) {
        return {
          ok: true,
          status: 200,
          headers: new Map([['x-ratelimit-remaining', '99']]),
          async json() { return makeOpenAlexResponse('quantum biology', 5); },
          async text() { return JSON.stringify(makeOpenAlexResponse('quantum biology', 5)); },
        };
      }
      return { ok: false, status: 404, headers: new Map(), async json() { return {}; }, async text() { return ''; } };
    });
    const m = freshModule();
    const results = await m.fetchCorpus({ source: 'openalex', query: 'quantum biology', limit: 5 });
    assert.ok(Array.isArray(results), 'fetchCorpus(openalex) returns an array');
    assert.ok(results.length >= 1, 'expected at least one result; got ' + results.length);
    const p = results[0];
    for (const f of ['id', 'title', 'abstract', 'authors', 'doi', 'source', 'fetched_at']) {
      assert.ok(Object.prototype.hasOwnProperty.call(p, f), 'paper missing field: ' + f);
    }
    assert.ok(Array.isArray(p.authors), 'authors is an array');
    assert.equal(p.source, 'openalex', 'source field is openalex');
    assert.ok(fetchCallCount >= 1, 'at least one fetch issued for a clean query');
  });

  // ---------- Test 2: planted violation fails closed (zero fetch) ----------
  await runScenario('Test 2: planted FORBIDDEN_PATTERN query throws pre-egress, zero fetch (fail closed)', async function () {
    installFetchStub(async function () {
      return { ok: true, status: 200, headers: new Map(), async json() { return makeOpenAlexResponse('x', 1); }, async text() { return '{}'; } };
    });
    const m = freshModule();
    // Pattern 1 (currency $5.2M) -- a proprietary financial figure that must
    // never cross the egress boundary.
    const planted = 'oncology venture valuation $5.2M cancer treatment';
    let threw = null;
    try {
      await m.fetchCorpus({ source: 'openalex', query: planted, limit: 5 });
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected a throw on the planted user-content query');
    assert.equal(threw.name, 'ExternalEgressViolation', 'throws ExternalEgressViolation');
    assert.equal(fetchCallCount, 0, 'NO fetch() allowed before the throw; got ' + fetchCallCount);
  });

  // ---------- Test 3: sci-bot disabled no-op envelope, zero fetch ----------
  await runScenario('Test 3: sci-bot returns disabled no-op envelope, zero fetch', async function () {
    installFetchStub(async function () {
      return { ok: true, status: 200, headers: new Map(), async json() { return {}; }, async text() { return ''; } };
    });
    const m = freshModule();
    const out = await m.fetchCorpus({ source: 'sci-bot', query: 'x' });
    assert.ok(out && out.disabled === true, 'sci-bot returns { disabled:true }');
    assert.equal(out.reason, 'sci-bot disabled (opt-in + token + legal-review required)',
      'sci-bot reason carries the three-gate message');
    assert.equal(fetchCallCount, 0, 'sci-bot performs zero fetch; got ' + fetchCallCount);
    // Even with opt-in + legal flags but no token, it stays disabled.
    const out2 = await m.fetchCorpus({ source: 'sci-bot', query: 'x', optIn: true, legalReviewSignedOff: true });
    assert.ok(out2 && out2.disabled === true, 'sci-bot stays disabled without a user token');
    assert.equal(fetchCallCount, 0, 'still zero fetch after the partial-gate call');
  });

  // ---------- Test 4: brain-cypher degraded + generic-handle-only ----------
  await runScenario('Test 4: brain-cypher degrades when unavailable, generic handle when available, audit pre-rejects', async function () {
    // 4a: isAvailable() false -> degraded envelope, no throw.
    {
      const m = freshModule();
      const brain = require('./brain-client.cjs');
      brain.isAvailable = function () { return false; };
      installFetchStub(async function () {
        return { ok: true, status: 200, headers: new Map(), async json() { return {}; }, async text() { return ''; } };
      });
      const out = await m.fetchCorpus({ source: 'brain-cypher', query: 'SWOT' });
      assert.ok(out !== undefined && out !== null, 'brain-cypher returns a value when unavailable');
      // Degraded shape: an empty array OR a { degraded:true } envelope -- either
      // is acceptable so long as it does not throw and carries no results.
      const isEmptyArray = Array.isArray(out) && out.length === 0;
      const isDegradedEnvelope = out && typeof out === 'object' && (out.degraded === true || Array.isArray(out.results));
      assert.ok(isEmptyArray || isDegradedEnvelope, 'brain-cypher unavailable yields an empty/degraded envelope');
      restoreFetch();
    }

    // 4b: isAvailable() true -> the only Brain call carries the sanitized
    // generic handle, never raw user content.
    {
      const m = freshModule();
      const brain = require('./brain-client.cjs');
      let capturedCypher = null;
      let capturedParams = null;
      brain.isAvailable = function () { return true; };
      brain.query = async function (cypher, params) {
        capturedCypher = cypher;
        capturedParams = params;
        return { records: [{ name: 'SWOT' }, { name: 'Porter Five Forces' }] };
      };
      installFetchStub(async function () {
        throw new Error('brain-cypher must NOT call global.fetch');
      });
      const out = await m.fetchCorpus({ source: 'brain-cypher', query: 'SWOT' });
      assert.ok(out !== undefined && out !== null, 'brain-cypher returns when available');
      const handleSeen = JSON.stringify({ c: capturedCypher, p: capturedParams });
      assert.ok(handleSeen.indexOf('SWOT') >= 0, 'the generic handle SWOT reached the Brain call');
      assert.equal(fetchCallCount, 0, 'brain-cypher path issues zero global.fetch calls');
      restoreFetch();
    }

    // 4c: a forbidden-pattern brain-cypher query is rejected by the SAME audit
    // before any Brain call.
    {
      const m = freshModule();
      const brain = require('./brain-client.cjs');
      let brainCalled = false;
      brain.isAvailable = function () { return true; };
      brain.query = async function () { brainCalled = true; return { records: [] }; };
      let threw = null;
      try {
        await m.fetchCorpus({ source: 'brain-cypher', query: 'roadmap meeting with Mayo Clinic Q3' });
      } catch (e) {
        threw = e;
      }
      assert.ok(threw, 'forbidden brain-cypher query throws');
      assert.equal(threw.name, 'ExternalEgressViolation', 'throws ExternalEgressViolation');
      assert.equal(brainCalled, false, 'NO Brain call after a forbidden query (audit fails closed)');
    }
  });

  // ---------- Test 5: unknown source TypeError + zero python/subprocess ----------
  await runScenario('Test 5: unknown source throws TypeError; zero child_process/python in source', async function () {
    const m = freshModule();
    let threw = null;
    try {
      await m.fetchCorpus({ source: 'not-a-real-source', query: 'x' });
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'unknown source throws');
    assert.ok(threw instanceof TypeError, 'unknown source throws a TypeError');

    const src = fs.readFileSync(path.resolve(__dirname, 'research-corpus.cjs'), 'utf8');
    assert.equal(/require\(['"]node:child_process['"]\)/.test(src), false, 'no node:child_process require');
    assert.equal(/\bchild_process\b/.test(src), false, 'no child_process reference');
    assert.equal(/\bspawnSync\b|\bexecSync\b/.test(src), false, 'no spawnSync/execSync');
    assert.equal(/\bpython\b/i.test(src), false, 'no python reference');
    // Native fetch only -- no HTTP client deps.
    assert.equal(/node-fetch|axios|\bgot\b|requests/.test(src), false, 'native fetch only, no HTTP client dep');

    // SOURCES enum completeness.
    assert.ok(Array.isArray(m.SOURCES), 'SOURCES is an array');
    for (const s of ['openalex', 'arxiv', 'pubmed', 'tavily', 'brain-cypher', 'sci-bot']) {
      assert.ok(m.SOURCES.includes(s), 'SOURCES missing: ' + s);
    }
  });

  if (failed > 0) {
    console.error('\n=== ' + failed + ' FAILURES ===');
    for (const f of failures) {
      console.error('  ' + f.name);
    }
    process.exit(1);
  }

  console.log('=== 130.5-01 research-corpus suite: ' + passed + '/' + passed + ' passed ===');
  process.exit(0);
})();
