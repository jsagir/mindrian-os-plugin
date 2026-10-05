#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 130.5 Plan 03 -- corpus-migration regression.
 *
 * Proves the rs-discovery-engine corpus migration (the academic fetch repointed
 * off the private fetcherAcademic.fetchAcademic path onto the unified fetchCorpus
 * + the shared research-cache) is BEHAVIOR-PRESERVING and that the shared cache
 * eliminates the duplicate fetch on a repeat (source, query). Network-free: a
 * stub fetchCorpus returns a deterministic frozen fixture
 * (tests/fixtures/phase-130.5/sample-room/seed.json) so the run is reproducible
 * with zero external calls. Mirrors the lib/memory/test-rs-discovery-engine.cjs
 * mock-module idiom (the engine's _test_mocks `m` indirection lets the test
 * inject deterministic deps without monkey-patching require's cache).
 *
 * Three assertions (C expanded to C, C2, C3 by 369.2-06):
 *   A (byte-identical): run the pipeline twice over the fixture -- once on the
 *     OLD-equivalent path (direct fetchCorpus, no cache: roomDir absent) and once
 *     on the migrated cache-wrapped path (roomDir present) -- and assert the FULL
 *     downstream bundle slices stringify-equal (fetched_results.academic.papers,
 *     preprocessed, scored, classified, breakthroughs, theses). The fixture's
 *     fetched_at is a FIXED stamp so the compare is stable.
 *   B (cache hit on repeat): with both runs pointed at a tmp roomDir and the stub
 *     fetchCorpus carrying a call counter, the SECOND run over the same query set
 *     issues FEWER external fetchCorpus calls than the first (the shared cache
 *     served the repeat) -- count_run2 < count_run1, ideally 0.
 *   C (moved 369.2-06, ruling 2026-10-05): the fixture's planted room string on a
 *     WEB source dispatches exactly once with its words unchanged (C2), and a
 *     credential-shaped variant is refused pre-dispatch under A4=keep (C3), both
 *     through the REAL fetchCorpus and the OpenAlex replay. The old pre-egress
 *     reject of a room string is retired: the CONTENT-SET fence binds the Brain line.
 *
 * Pure CJS, node:assert/strict + node:fs/path/os only. No network. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// 369.2-06 (2026-10-05): the web-line legs below dispatch through the REAL
// fetchCorpus, which records telemetry under os.homedir(); point HOME, USERPROFILE
// and MINDRIAN_ROOMS_HOME at mkdtemp dirs BEFORE any repo module loads.
const real3692 = require('./helpers/real-corpus-3692.cjs');
const hermetic3692 = real3692.hermeticEnv();
['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL'].forEach(function (k) {
  process.env[k] = hermetic3692[k];
});
real3692.VENDOR_KEYS.forEach(function (k) { delete process.env[k]; });

const ENGINE_PATH = path.resolve(__dirname, '..', 'scripts', 'rs-discovery-engine.cjs');
const { runDiscovery } = require(ENGINE_PATH);

const realCorpus = require('../lib/core/research-corpus.cjs');
const realCache = require('../lib/core/research-cache.cjs');

const FIXTURE_PATH = path.resolve(
  __dirname, 'fixtures', 'phase-130.5', 'sample-room', 'seed.json'
);
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const tests = [];

function record(name, fn) { tests.push({ name, fn }); }

async function runAll() {
  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      failed += 1;
      failures.push({ name: t.name, message: err && err.message ? err.message : String(err) });
      process.stdout.write('FAIL ' + t.name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
    }
  }
}

// ---------- Deterministic downstream mocks ----------
//
// Every phase below the academic fetch is mocked deterministically so the only
// variable across the two runs in Assertion A is whether the academic corpus
// flows through the cache wrap or not. The downstream mocks are PURE functions of
// their inputs (no clock, no randomness, no network) so a byte-compare is stable.

function makeStubFetchCorpus(counter) {
  // The migrated engine calls fetchCorpus({ source:'openalex', query, limit }) per
  // query and expects the normalized RESULTS ARRAY back (Plan 01 contract). We
  // serve the frozen fixture corpus keyed by query, deep-cloned so a cache write
  // (which serializes) cannot alias the fixture object.
  return async function (args) {
    counter.calls += 1;
    const q = args && args.query;
    const byQuery = FIXTURE.corpus_by_query[q];
    const arr = Array.isArray(byQuery) ? byQuery : [];
    return JSON.parse(JSON.stringify(arr));
  };
}

function buildDownstreamMocks() {
  return {
    domainAnalyzer: {
      analyzeDomain: async function () {
        return {
          primary_domain: 'biotech',
          concepts: ['quantum', 'imaging', 'brain'],
          terminology: ['MRI', 'qubit'],
          methods: ['superconducting', 'tomography'],
          breakthroughs: ['NV-center diamond sensing'],
          boundary_flag: false,
          adjacent_domains: ['neurology'],
        };
      },
    },
    queryMatrix: {
      generateQueryMatrix: function () {
        // The fixture matrix drives flat_queries deterministically.
        return JSON.parse(JSON.stringify(FIXTURE.query_matrix));
      },
    },
    fetcherPatents: {
      fetchPatents: async function () { return { patents: [], telemetry: [] }; },
    },
    fetcherIndustry: {
      fetchIndustry: async function () { return { signals: [], telemetry: [] }; },
    },
    fetcherExperts: {
      mapExperts: function (papers) {
        // Deterministic: derive expert stubs from paper authors.
        const out = [];
        const seen = {};
        for (const p of (Array.isArray(papers) ? papers : [])) {
          const authors = Array.isArray(p.authors) ? p.authors : [];
          for (const a of authors) {
            if (a && a.name && !seen[a.name]) {
              seen[a.name] = true;
              out.push({
                name: a.name,
                orcid: a.orcid || '',
                institution: a.institution || '',
                paper_count: 1,
                h_index_estimate: 5,
              });
            }
          }
        }
        return out;
      },
    },
    preprocessor: {
      preprocess: function (documents) {
        // Deterministic transform of the aggregated documents.
        return (Array.isArray(documents) ? documents : []).map(function (d, idx) {
          return {
            document_id: d.id || ('doc-' + idx),
            technical_terms: ['NV', 'magnetometry'],
            concepts: ['quantum imaging'],
            methods: ['superconducting'],
            relevance_score: 0.8,
            boundary_flag: false,
          };
        });
      },
    },
    differentialScorer: {
      score: async function () { return { diff: 0.3, lsa: 0.6, bert: 0.3, passes: true }; },
    },
    innovationClassifier: {
      classify: function (scoredPair) {
        return Object.assign({}, scoredPair, {
          query_concept: scoredPair.query_concept || 'quantum imaging',
          doc_concept: scoredPair.doc_concept || 'transformer attention',
          classification: 'structural_transfer',
          bridge_concept: 'graph attention',
        });
      },
    },
    breakthroughScorer: {
      scoreBreakthrough: function (classifiedPair) {
        return Object.assign({}, classifiedPair, {
          breakthrough: {
            score: 8,
            breakdown: { feasibility: 1.5, market: 1.6, magnitude: 1.7, advantage: 1.5, impact: 1.7 },
            dominant_dimension: 'magnitude',
          },
        });
      },
    },
    thesisGenerator: {
      generateThesis: function () {
        return 'By applying quantum imaging to transformer attention, achieve novelty because graph attention.';
      },
    },
    commercialAssessor: {
      assess: function () {
        return {
          market_size_estimate: 'addressable market in the high single-digit billions',
          value_proposition: 'translate quantum imaging into transformer attention',
          partnership_targets: [],
        };
      },
    },
    expertMapper: {
      mapAuthorsToAura: async function () {
        return {
          resolved_authors: [], resolved_institutions: [], citation_edges: [],
          missed_count: 0, resolution_quality: 'degraded', tier: 'sqlite',
          schema_version: 1, note: 'tier-0 degraded',
        };
      },
    },
    neo4jWriter: {
      writeDiscovery: async function () { return { wrote_node_count: 0, wrote_edge_count: 0, schema_version: 1 }; },
      AuraUnreachableError: class AuraUnreachableError extends Error {
        constructor(msg) { super(msg); this.name = 'AuraUnreachableError'; }
      },
    },
    sqliteMirror: {
      writeDiscovery: async function () { return { wrote_node_count: 0, wrote_edge_count: 0, schema_version: 1 }; },
    },
    mindMap: {
      renderMindMap: async function () {
        return {
          branches: {}, elements: [], branch_colors: {},
          metadata: { tier: 'sqlite', branch_counts: {}, total_nodes: 0, total_edges: 0, schema_version: 1 },
          html_wrapper: '<html></html>',
        };
      },
    },
    chainFeeder: {
      lookupUpstream: async function () { return { state: 'ready' }; },
      emitChainMetadata: function () {
        return {
          recommended_verb: 'Bank Opportunity', feeds_into: 'PWS VP',
          spawn_skill: '/mos:find-analogies', confidence: 0.85,
          reasoning: 'fixture deterministic',
        };
      },
    },
  };
}

// Slices of the bundle that must be byte-identical old-vs-new (the FULL downstream
// chain, not just the paper list).
function downstreamSlices(bundle) {
  return JSON.stringify({
    academic_papers: bundle.fetched_results.academic.papers,
    preprocessed: bundle.preprocessed,
    scored: bundle.scored,
    classified: bundle.classified,
    breakthroughs: bundle.breakthroughs,
    theses: bundle.theses,
  });
}

function mkTmpRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rs-130.5-mig-'));
}

// ---------- Assertion A: byte-identical pre/post migration ----------

record('A byte-identical: old-path (no cache) vs migrated cache-wrapped path produce identical downstream bundles', async function () {
  // OLD-equivalent: direct fetchCorpus, NO cache wrap (room_dir absent -> the
  // engine's fetchAcademicViaCorpus degrades to a direct fetchCorpus call).
  const oldMocks = buildDownstreamMocks();
  oldMocks.fetchCorpus = makeStubFetchCorpus({ calls: 0 });
  const oldBundle = await runDiscovery(FIXTURE.topic, { _test_mocks: oldMocks });

  // MIGRATED: same stub fetchCorpus, but room_dir present so the cache wrap
  // engages (getCached/putCached through the REAL research-cache).
  const room = mkTmpRoom();
  const newMocks = buildDownstreamMocks();
  newMocks.fetchCorpus = makeStubFetchCorpus({ calls: 0 });
  newMocks.researchCache = realCache; // the real shared cache
  const newBundle = await runDiscovery(FIXTURE.topic, { room_dir: room, _test_mocks: newMocks });

  const oldStr = downstreamSlices(oldBundle);
  const newStr = downstreamSlices(newBundle);
  assert.equal(newStr, oldStr,
    'migrated cache-wrapped bundle must be byte-identical to the old-path bundle across the full downstream chain');

  // And the paper list specifically, called out by the plan.
  assert.equal(
    JSON.stringify(newBundle.fetched_results.academic.papers),
    JSON.stringify(oldBundle.fetched_results.academic.papers),
    'academic.papers must stringify-equal old vs new');

  // Cleanup.
  fs.rmSync(room, { recursive: true, force: true });
});

// ---------- Assertion B: cache hit on repeat ----------

record('B cache hit on repeat: second run over the same query set issues fewer fetchCorpus calls than the first', async function () {
  const room = mkTmpRoom();
  const counter = { calls: 0 };

  const mocks1 = buildDownstreamMocks();
  mocks1.fetchCorpus = makeStubFetchCorpus(counter);
  mocks1.researchCache = realCache;
  await runDiscovery(FIXTURE.topic, { room_dir: room, _test_mocks: mocks1 });
  const countRun1 = counter.calls;

  // Reset the shared counter; run 2 over the SAME query set + SAME roomDir.
  counter.calls = 0;
  const mocks2 = buildDownstreamMocks();
  mocks2.fetchCorpus = makeStubFetchCorpus(counter);
  mocks2.researchCache = realCache;
  await runDiscovery(FIXTURE.topic, { room_dir: room, _test_mocks: mocks2 });
  const countRun2 = counter.calls;

  assert.ok(countRun1 > 0, 'first run must issue at least one external fetchCorpus call; got ' + countRun1);
  assert.ok(countRun2 < countRun1,
    'second run must issue FEWER external fetchCorpus calls than the first (shared cache served the repeat); '
      + 'run1=' + countRun1 + ' run2=' + countRun2);
  assert.equal(countRun2, 0,
    'the repeat over an identical query set should hit the cache for every query (zero external fetches); got ' + countRun2);

  fs.rmSync(room, { recursive: true, force: true });
});

// ---------- Assertion C (moved 369.2-06, 2026-10-05) ----------
// 369.2-06: the CONTENT-SET fence binds the Theo/Brain line only (ruling 2026-10-05); see the web-line and credential legs below.
// The Brain-line fence is pinned in test-221-envelopes B6d, research-corpus.test 2d and
// test-363-corpus-honesty L14d; here C2 and C3 pin the web-line ruling and A4.

// ---------- 369.2 ruling 2026-10-05: web lines send the room's words; A4 pins credentials ----------
//
// Added beside Assertion C. The fixture's planted string is a room-content
// string (a money figure). On a WEB source it now dispatches exactly once with
// its words unchanged; a credential-shaped variant is refused before dispatch
// under A4=keep and dispatches under A4=drop. Driven through the REAL
// fetchCorpus and the OpenAlex replay at globalThis.fetch (no new mock layer).

const A4_3692 = process.env.MOS_369_2_A4 === 'drop' ? 'drop' : 'keep';

async function runMatrixThroughRealCorpus(q) {
  const room = mkTmpRoom();
  const mocks = buildDownstreamMocks();
  mocks.fetchCorpus = realCorpus.fetchCorpus;
  mocks.researchCache = realCache;
  mocks.queryMatrix = {
    generateQueryMatrix: function () {
      return { a_intersect_b: [q], a_leads_to_b: [], b_leads_to_a: [], adjacent: [] };
    },
  };
  const out = await real3692.withReplay(function () { return 'gap_primary_zero'; }, function () {
    return runDiscovery(FIXTURE.topic, { room_dir: room, _test_mocks: mocks });
  });
  fs.rmSync(room, { recursive: true, force: true });
  return out;
}

record('C2 web line: the planted room string dispatches once, words unchanged (369.2 ruling 2026-10-05)', async function () {
  const planted = FIXTURE.forbidden_query_matrix.a_intersect_b[0];
  const out = await runMatrixThroughRealCorpus(planted);
  assert.equal(out.error, null,
    'a web line must not throw on a room string; got ' + (out.error && out.error.name + ': ' + out.error.message));
  const hits = out.calls.filter(function (c) { return typeof c.q === 'string' && c.q.indexOf(planted) !== -1; });
  assert.equal(hits.length, 1,
    'the planted string must reach the wire exactly once, q unchanged; hits=' + hits.length + ' total calls=' + out.calls.length);
});

record('C3 A4=' + A4_3692 + ' credential-shaped string ' + (A4_3692 === 'keep'
  ? 'is refused pre-dispatch: zero calls, no echo (369.2 ruling 2026-10-05)'
  : 'dispatches like any other string (369.2 ruling 2026-10-05)'), async function () {
  const secret = 'abc123secretvalue';
  const q = 'our quantum imaging runway api_key=' + secret;
  const out = await runMatrixThroughRealCorpus(q);
  if (A4_3692 === 'keep') {
    assert.ok(out.error, 'expected ExternalEgressViolation on a credential-shaped web query');
    assert.equal(out.error.name, 'ExternalEgressViolation', 'got ' + out.error.name);
    assert.equal(out.error.meta && out.error.meta.matched_pattern, 'credential');
    assert.equal(out.error.meta && out.error.meta.sample, '', 'the violation carries no echo of the string');
    assert.equal(String(out.error.message).indexOf(secret), -1, 'the message does not echo the secret');
    assert.equal(out.calls.length, 0, 'zero provider calls; got ' + out.calls.length);
  } else {
    assert.equal(out.error, null, 'drop: no throw');
    assert.equal(out.calls.filter(function (c) { return c.q.indexOf(q) !== -1; }).length, 1, 'drop: one call, q unchanged');
  }
});

// ---------- Report ----------

(async function () {
  await runAll();
  const total = passed + failed;
  process.stdout.write('\n');
  if (failed === 0) {
    process.stdout.write('=== 130.5-03 corpus-migration suite: ' + passed + '/' + total + ' passed ===\n');
    process.exit(0);
  } else {
    process.stdout.write('=== 130.5-03 corpus-migration suite: ' + passed + '/' + total + ' passed (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stdout.write('  FAIL ' + f.name + ': ' + f.message + '\n');
    }
    process.exit(1);
  }
})();
