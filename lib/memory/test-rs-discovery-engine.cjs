#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 04 -- rs-discovery-engine fixture suite.
 *
 * Tests the top-level orchestrator at scripts/rs-discovery-engine.cjs.
 * The orchestrator chains every RS phase end-to-end:
 *   Phase 1 (Domain Analysis 89.1) -> Phase 1.5 (Fetchers 89.2) ->
 *   Phase 2 (Preprocessor 89.2) -> Phase 3 (Differential Scorer +
 *   Classifier + Breakthrough Scorer 89.2) -> Phase 4 (Thesis 89.2 +
 *   Commercial Assessor 89.5-01 + Expert Mapper 89.3) -> Output Layer
 *   (89.3 Aura/SQLite writer + Mind Map) -> Chain Downstream (89.4
 *   Chain Feeder).
 *
 * 9 scenarios total (>=8 mandated by plan):
 *   T1 -- happy path: full pipeline with mocked 89.1-89.5 modules; bundle
 *         shape verified ({topic, domain_analysis, query_matrix,
 *         fetched_results, preprocessed, scored, classified, breakthroughs,
 *         theses, commercial, output: {written, mind_map, experts},
 *         chain_metadata}); chain_metadata array of >=1 entry per
 *         discovery; each entry has {recommended_verb, feeds_into,
 *         spawn_skill, confidence, reasoning}.
 *   T2 -- Tier 0 fallback: rs-neo4j-writer.writeDiscovery throws
 *         AuraUnreachableError -> orchestrator catches; bundle.output.written.tier
 *         === 'tier0' (dispatched to rs-sqlite-mirror).
 *   T3 -- Mode B graceful: chain-feeder.lookupUpstream returns
 *         {state: 'ready'} (Brain-unreachable graceful path); bundle still
 *         populates chain_metadata; emitChainMetadata still works locally.
 *   T4 -- chain composition: every chain_metadata.recommended_verb is in
 *         CANONICAL_VERBS; spawn_skill is null OR matches a SKILL_SPAWN_RULES
 *         rule; feeds_into is one of {'PWS VP', 'Causal Loop',
 *         'Navigation Engine', 'JTBD'}.
 *   T5 -- Canon Part 8 input audit: opts contains forbidden bytes ->
 *         auditQueryObject throws ExternalEgressViolation BEFORE any module
 *         is invoked; err.meta.surface === 'rs-discovery-engine-input'.
 *   T6 -- Brain chokepoint exclusivity: read scripts/rs-discovery-engine.cjs
 *         source; assert grep 'fetch(' === 0; grep 'require.*brain-client'
 *         === 0 (orchestrator never directly imports brain-client; ALL
 *         Brain queries go through chain-feeder.lookupUpstream).
 *   T7 -- pause-state bubble: chain-feeder.lookupUpstream returns
 *         {state: 'pause', missing_upstream, suggested_action}; orchestrator
 *         returns the pause envelope verbatim; NO further phase modules
 *         invoked (mocks track invocation count; assert all === 0 after
 *         pause).
 *   T8 -- A1 sweep: every positive-path bundle JSON.stringify contains ZERO
 *         FORBIDDEN_PATTERNS hits.
 *   T9 -- runDiscovery is AsyncFunction (Module exports surface check).
 *
 * Pure CJS, zero npm deps, node built-ins only (assert + fs).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const tests = [];

function record(name, fn) {
  tests.push({ name, fn });
}

async function runAll() {
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      failed++;
      failures.push({ name: t.name, message: err && err.message ? err.message : String(err) });
      process.stdout.write('FAIL ' + t.name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
    }
  }
}

// ---------- Module under test ----------

const ENGINE_PATH = path.resolve(__dirname, '..', '..', 'scripts', 'rs-discovery-engine.cjs');
const orchestrator = require(ENGINE_PATH);
const { runDiscovery } = orchestrator;

// ---------- Reference imports for invariants ----------

const { CANONICAL_VERBS, SKILL_SPAWN_RULES } = require('../core/rs-chain-feeder.cjs');
const { FORBIDDEN_PATTERNS } = require('../core/rs-egress-prompts.cjs');

const FEEDS_INTO_CANONICAL = new Set(['PWS VP', 'Causal Loop', 'Navigation Engine', 'JTBD']);

// ---------- Helper: build deterministic mocks ----------
//
// Every mock returns a deterministic fixture so the orchestrator can be
// tested without external infrastructure (Brain, Aura, filesystem). The
// orchestrator's _test_mocks option substitutes these for the real
// require'd modules.

function makeInvocationCounters() {
  return {
    domainAnalyzer: 0,
    queryMatrix: 0,
    fetcherAcademic: 0,
    fetcherPatents: 0,
    fetcherIndustry: 0,
    fetcherExperts: 0,
    preprocessor: 0,
    differentialScorer: 0,
    innovationClassifier: 0,
    breakthroughScorer: 0,
    thesisGenerator: 0,
    commercialAssessor: 0,
    expertMapper: 0,
    neo4jWriter: 0,
    sqliteMirror: 0,
    mindMap: 0,
    chainFeederLookup: 0,
    chainFeederEmit: 0,
  };
}

function buildMockSet(opts) {
  opts = opts || {};
  const counts = opts.counts || makeInvocationCounters();

  const mocks = {
    domainAnalyzer: {
      analyzeDomain: async function (topic) {
        counts.domainAnalyzer += 1;
        return {
          primary_domain: 'biotech',
          concepts: ['quantum', 'imaging', 'brain'],
          terminology: ['MRI', 'qubit', 'fMRI'],
          methods: ['superconducting', 'tomography'],
          breakthroughs: ['NV-center diamond sensing'],
          boundary_flag: false,
          adjacent_domains: ['neurology', 'condensed matter physics'],
        };
      },
    },
    queryMatrix: {
      generateQueryMatrix: function (analysis) {
        counts.queryMatrix += 1;
        return {
          a_intersect_b: ['quantum AND imaging'],
          a_leads_to_b: ['quantum -> imaging'],
          b_leads_to_a: ['imaging -> quantum'],
          adjacent: ['NV-center'],
        };
      },
    },
    fetcherAcademic: {
      fetchAcademic: async function (queries) {
        counts.fetcherAcademic += 1;
        return {
          papers: [
            {
              id: 'oa:123',
              title: 'NV-center diamond magnetometry',
              abstract: 'Superconducting qubit imaging.',
              authors: [{ name: 'Dr. A', orcid: '0000-0001', institution: 'MIT' }],
              source: 'openalex',
            },
          ],
          telemetry: [{ source: 'openalex', status: 'ok' }],
        };
      },
    },
    fetcherPatents: {
      fetchPatents: async function (queries) {
        counts.fetcherPatents += 1;
        return {
          patents: [{ id: 'us:9876543', title: 'Method for NV-center imaging', abstract: 'patent abstract' }],
          telemetry: [],
        };
      },
    },
    fetcherIndustry: {
      fetchIndustry: async function (queries) {
        counts.fetcherIndustry += 1;
        return {
          signals: [{ id: 'cb:co1', title: 'StartupCo NV imaging', signal: 'industry signal' }],
          telemetry: [],
        };
      },
    },
    fetcherExperts: {
      mapExperts: function (papers) {
        counts.fetcherExperts += 1;
        return [
          {
            name: 'Dr. A',
            orcid: '0000-0001',
            institution: 'MIT',
            paper_count: 1,
            h_index_estimate: 5,
          },
        ];
      },
    },
    preprocessor: {
      preprocess: function (documents) {
        counts.preprocessor += 1;
        return [
          {
            document_id: 'oa:123',
            technical_terms: ['NV', 'magnetometry'],
            concepts: ['quantum imaging'],
            methods: ['superconducting'],
            relevance_score: 0.8,
            boundary_flag: false,
          },
        ];
      },
    },
    differentialScorer: {
      score: async function (queryConcept, docConcept, opts) {
        counts.differentialScorer += 1;
        return { diff: 0.3, lsa: 0.6, bert: 0.3, passes: true };
      },
    },
    innovationClassifier: {
      classify: function (scoredPair) {
        counts.innovationClassifier += 1;
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
        counts.breakthroughScorer += 1;
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
      generateThesis: function (classifiedPair, breakthrough) {
        counts.thesisGenerator += 1;
        return 'By applying quantum imaging to transformer attention, achieve novelty because graph attention.';
      },
    },
    commercialAssessor: {
      assess: function (rsDiscovery) {
        counts.commercialAssessor += 1;
        return {
          market_size_estimate: 'addressable market in the high single-digit billions',
          value_proposition: 'translate quantum imaging into transformer attention',
          partnership_targets: [{ name: 'MIT', type: 'academic', score: 0.9 }],
        };
      },
    },
    expertMapper: {
      mapAuthorsToAura: async function (experts, opts) {
        counts.expertMapper += 1;
        return {
          resolved_authors: [{
            name: 'Dr. A', orcid: '0000-0001', institution: 'MIT',
            h_index_estimate: 5, paper_count: 1, aura_node_id: null,
          }],
          resolved_institutions: [{ name: 'MIT', author_count: 1 }],
          citation_edges: [],
          missed_count: 0,
          resolution_quality: 'degraded',
          tier: 'sqlite',
          schema_version: 1,
          note: 'tier-0 degraded',
        };
      },
    },
    neo4jWriter: {
      writeDiscovery: async function (pair, opts) {
        counts.neo4jWriter += 1;
        return {
          wrote_node_count: 3,
          wrote_edge_count: 2,
          rollback_cypher: 'MATCH ... DETACH DELETE',
          aura_op_id: 'op-aura-1',
          schema_version: 1,
        };
      },
      AuraUnreachableError: class AuraUnreachableError extends Error {
        constructor(msg, meta) { super(msg); this.name = 'AuraUnreachableError'; this.meta = meta || {}; }
      },
    },
    sqliteMirror: {
      writeDiscovery: async function (pair, opts) {
        counts.sqliteMirror += 1;
        return {
          wrote_node_count: 3,
          wrote_edge_count: 2,
          rollback_cypher: 'DELETE FROM ...',
          aura_op_id: 'op-sqlite-1',
          schema_version: 1,
        };
      },
    },
    mindMap: {
      renderMindMap: async function (queryFilter, opts) {
        counts.mindMap += 1;
        return {
          branches: {},
          elements: [],
          branch_colors: {},
          metadata: { tier: 'sqlite', branch_counts: {}, total_nodes: 0, total_edges: 0, schema_version: 1 },
          html_wrapper: '<html></html>',
        };
      },
    },
    chainFeeder: {
      lookupUpstream: async function (problemType, stage, opts) {
        counts.chainFeederLookup += 1;
        return { state: 'ready' };
      },
      emitChainMetadata: function (rsType, score, activeContext) {
        counts.chainFeederEmit += 1;
        // Mirror the real chain-feeder logic for these scalars so T4
        // chain composition checks (CANONICAL_VERBS membership +
        // SKILL_SPAWN_RULES alignment + feeds_into canonical set) hold.
        let feedsInto = 'JTBD';
        if (rsType === 'structural_transfer') feedsInto = 'PWS VP';
        else if (rsType === 'semantic_implementation') feedsInto = 'Causal Loop';
        else if (rsType === 'hybrid') feedsInto = 'Navigation Engine';
        const safeScore = Number.isFinite(score) ? score : 0;
        let verb = 'Reformulate';
        if (safeScore >= 7) verb = 'Bank Opportunity';
        else if (safeScore >= 5) verb = 'Synthesize';
        let spawnSkill = null;
        let confidence = 0;
        let reasoning = 'no rule matched';
        // Mirror the first SKILL_SPAWN_RULES rule for happy-path mocks
        // (score>=7 + structural_transfer -> /mos:find-analogies @ 0.85).
        if (safeScore >= 7 && rsType === 'structural_transfer') {
          spawnSkill = '/mos:find-analogies';
          confidence = 0.85;
          reasoning = 'high breakthrough + structural transfer -> SAPPhIRE/TRIZ deepening';
        }
        return {
          recommended_verb: verb,
          feeds_into: feedsInto,
          spawn_skill: spawnSkill,
          confidence: confidence,
          reasoning: reasoning,
        };
      },
    },
  };

  return { mocks, counts };
}

// Capture box for A1 sweep.
const positiveBundles = [];

// ---------- Tests ----------

record('T1 happy path: full pipeline with mocked 89.1-89.5 modules; bundle shape verified', async function () {
  const { mocks, counts } = buildMockSet();
  const bundle = await runDiscovery('quantum brain imaging', {
    room_dir: '/tmp/test-room',
    _test_mocks: mocks,
  });

  // Bundle shape.
  assert.equal(typeof bundle, 'object', 'bundle must be object');
  assert.equal(bundle.topic, 'quantum brain imaging', 'bundle.topic must match input');
  assert.ok(bundle.domain_analysis && typeof bundle.domain_analysis === 'object', 'domain_analysis required');
  assert.ok(bundle.query_matrix && typeof bundle.query_matrix === 'object', 'query_matrix required');
  assert.ok(bundle.fetched_results && typeof bundle.fetched_results === 'object', 'fetched_results required');
  assert.ok(Array.isArray(bundle.preprocessed), 'preprocessed must be array');
  assert.ok(Array.isArray(bundle.scored), 'scored must be array');
  assert.ok(Array.isArray(bundle.classified), 'classified must be array');
  assert.ok(Array.isArray(bundle.breakthroughs), 'breakthroughs must be array');
  assert.ok(Array.isArray(bundle.theses), 'theses must be array');
  assert.ok(Array.isArray(bundle.commercial), 'commercial must be array');
  assert.ok(bundle.output && typeof bundle.output === 'object', 'output required');
  assert.ok(bundle.output.written && typeof bundle.output.written === 'object', 'output.written required');
  assert.ok(bundle.output.mind_map && typeof bundle.output.mind_map === 'object', 'output.mind_map required');
  assert.ok(bundle.output.experts && typeof bundle.output.experts === 'object', 'output.experts required');
  assert.ok(Array.isArray(bundle.chain_metadata), 'chain_metadata must be array');

  // Chain metadata contract: >=1 entry; each has the 5 canonical fields.
  assert.ok(bundle.chain_metadata.length >= 1, 'chain_metadata must have >=1 entry');
  for (const e of bundle.chain_metadata) {
    assert.equal(typeof e.recommended_verb, 'string', 'recommended_verb must be string');
    assert.equal(typeof e.feeds_into, 'string', 'feeds_into must be string');
    assert.ok(e.spawn_skill === null || typeof e.spawn_skill === 'string',
      'spawn_skill must be null or string');
    assert.equal(typeof e.confidence, 'number', 'confidence must be number');
    assert.equal(typeof e.reasoning, 'string', 'reasoning must be string');
  }

  // Sanity: every mocked phase invoked at least once.
  assert.ok(counts.domainAnalyzer >= 1, 'domainAnalyzer must be invoked');
  assert.ok(counts.queryMatrix >= 1, 'queryMatrix must be invoked');
  assert.ok(counts.fetcherAcademic >= 1, 'fetcherAcademic must be invoked');
  assert.ok(counts.preprocessor >= 1, 'preprocessor must be invoked');
  assert.ok(counts.chainFeederEmit >= 1, 'chainFeederEmit must be invoked');

  positiveBundles.push(bundle);
});

record('T2 Tier 0 fallback: writeDiscovery throws AuraUnreachableError -> dispatched to sqlite', async function () {
  const { mocks, counts } = buildMockSet();
  // Force tier1 dispatch (simulate Aura url present) but make Aura write throw.
  mocks.neo4jWriter.writeDiscovery = async function () {
    counts.neo4jWriter += 1;
    const E = mocks.neo4jWriter.AuraUnreachableError;
    throw new E('Aura backend unreachable: simulated', { original: 'simulated' });
  };

  const bundle = await runDiscovery('quantum brain imaging', {
    room_dir: '/tmp/test-room',
    aura_url: 'neo4j+s://fake.aura.io',  // forces tier1 detection
    _test_mocks: mocks,
  });

  // Orchestrator must catch AuraUnreachableError and dispatch to sqlite.
  assert.equal(bundle.output.written.tier, 'tier0',
    'output.written.tier must === tier0 after Aura-unreachable graceful fallback');
  assert.ok(counts.sqliteMirror >= 1, 'sqliteMirror must be invoked on Tier 0 fallback');
  assert.ok(counts.neo4jWriter >= 1, 'neo4jWriter must have been attempted before fallback');

  positiveBundles.push(bundle);
});

record('T3 Mode B graceful: lookupUpstream ready (Brain unreachable) -> chain_metadata populated', async function () {
  const { mocks, counts } = buildMockSet();
  mocks.chainFeeder.lookupUpstream = async function () {
    counts.chainFeederLookup += 1;
    // Brain-unreachable graceful path per 89.4-02.
    return { state: 'ready' };
  };

  const bundle = await runDiscovery('quantum brain imaging', {
    room_dir: '/tmp/test-room',
    _test_mocks: mocks,
  });

  // chain_metadata still populated locally (emitChainMetadata works without Brain).
  assert.ok(Array.isArray(bundle.chain_metadata), 'chain_metadata must be array');
  assert.ok(bundle.chain_metadata.length >= 1, 'chain_metadata must populate even in Mode B');
  assert.ok(counts.chainFeederEmit >= 1, 'emitChainMetadata must run locally even when Brain is unreachable');

  positiveBundles.push(bundle);
});

record('T4 chain composition: every recommended_verb in CANONICAL_VERBS; spawn_skill aligned; feeds_into canonical', async function () {
  const { mocks } = buildMockSet();
  const bundle = await runDiscovery('quantum brain imaging', {
    room_dir: '/tmp/test-room',
    _test_mocks: mocks,
  });

  const validSpawnSkills = new Set(SKILL_SPAWN_RULES.map(function (r) { return r.spawn; }));
  for (const e of bundle.chain_metadata) {
    assert.ok(CANONICAL_VERBS.includes(e.recommended_verb),
      'recommended_verb must be in CANONICAL_VERBS; got ' + JSON.stringify(e.recommended_verb));
    if (e.spawn_skill !== null) {
      assert.ok(validSpawnSkills.has(e.spawn_skill),
        'spawn_skill must match SKILL_SPAWN_RULES rule; got ' + JSON.stringify(e.spawn_skill));
    }
    assert.ok(FEEDS_INTO_CANONICAL.has(e.feeds_into),
      'feeds_into must be in canonical set; got ' + JSON.stringify(e.feeds_into));
  }

  positiveBundles.push(bundle);
});

record('T5 Canon Part 8 input audit: forbidden bytes in opts -> ExternalEgressViolation BEFORE any module invoked', async function () {
  const counts = makeInvocationCounters();
  const { mocks } = buildMockSet({ counts: counts });

  let caught = null;
  try {
    await runDiscovery('topic', {
      meeting_transcript: 'meeting with Lawrence said the deal is $5M',
      _test_mocks: mocks,
    });
  } catch (err) {
    caught = err;
  }

  assert.ok(caught !== null, 'expected ExternalEgressViolation throw, got none');
  assert.equal(caught.name, 'ExternalEgressViolation',
    'expected err.name=ExternalEgressViolation; got ' + (caught && caught.name));
  assert.ok(caught.meta && typeof caught.meta === 'object', 'err.meta must be object');
  assert.equal(caught.meta.surface, 'rs-discovery-engine-input',
    'expected err.meta.surface=rs-discovery-engine-input; got ' + JSON.stringify(caught.meta.surface));

  // Defense-in-depth: NO module invoked because audit ran at the gate.
  assert.equal(counts.domainAnalyzer, 0, 'domainAnalyzer must NOT be invoked after audit throw');
  assert.equal(counts.queryMatrix, 0, 'queryMatrix must NOT be invoked after audit throw');
  assert.equal(counts.fetcherAcademic, 0, 'fetcherAcademic must NOT be invoked after audit throw');
  assert.equal(counts.chainFeederLookup, 0, 'chainFeederLookup must NOT be invoked after audit throw');
});

record('T6 Brain chokepoint exclusivity: source has zero fetch( and zero direct brain-client require', function () {
  const src = fs.readFileSync(ENGINE_PATH, 'utf8');
  // No code path may invoke fetch( from the orchestrator. The 89.2 fetchers
  // each have their OWN audit chokepoint; the orchestrator never reaches
  // the network directly.
  // Strip line comments and block comments before scanning.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert.ok(stripped.indexOf('fetch(') === -1,
    'orchestrator source must NOT contain fetch( in code (defense-in-depth: zero new fetch surface)');

  // The orchestrator never directly imports brain-client. ALL Brain queries
  // go through chain-feeder.lookupUpstream which wraps brainClient.query
  // per 89.4-02 chokepoint reuse.
  const brainRequireRegex = /require\([^)]*brain-client[^)]*\)/;
  assert.equal(brainRequireRegex.test(stripped), false,
    'orchestrator must NOT directly require brain-client.cjs; reuse 89.4-02 chain-feeder.lookupUpstream chokepoint');
});

record('T7 pause-state bubble: lookupUpstream pause -> pause envelope returned; NO further phase modules invoked', async function () {
  const counts = makeInvocationCounters();
  const { mocks } = buildMockSet({ counts: counts });
  mocks.chainFeeder.lookupUpstream = async function () {
    counts.chainFeederLookup += 1;
    return {
      state: 'pause',
      missing_upstream: ['systems-thinking'],
      suggested_action: 'Run Methodology',
    };
  };

  const result = await runDiscovery('quantum brain imaging', {
    room_dir: '/tmp/test-room',
    _test_mocks: mocks,
  });

  // Pause envelope bubbles up verbatim.
  assert.equal(result.state, 'pause', 'pause-state result.state must === pause');
  assert.ok(Array.isArray(result.missing_upstream), 'pause result.missing_upstream must be array');
  assert.equal(result.missing_upstream[0], 'systems-thinking', 'missing_upstream[0] preserved');
  assert.equal(result.suggested_action, 'Run Methodology', 'suggested_action preserved');

  // No phase modules beyond the chain-feeder gate were invoked.
  assert.equal(counts.domainAnalyzer, 0, 'domainAnalyzer must NOT run after pause');
  assert.equal(counts.queryMatrix, 0, 'queryMatrix must NOT run after pause');
  assert.equal(counts.fetcherAcademic, 0, 'fetcherAcademic must NOT run after pause');
  assert.equal(counts.preprocessor, 0, 'preprocessor must NOT run after pause');
  assert.equal(counts.differentialScorer, 0, 'differentialScorer must NOT run after pause');
  assert.equal(counts.chainFeederEmit, 0, 'chainFeederEmit must NOT run after pause');
  assert.equal(counts.neo4jWriter, 0, 'neo4jWriter must NOT run after pause');
  assert.equal(counts.sqliteMirror, 0, 'sqliteMirror must NOT run after pause');
});

record('T8 A1 sweep: every positive-path bundle JSON contains ZERO FORBIDDEN_PATTERNS hits', function () {
  assert.ok(Array.isArray(FORBIDDEN_PATTERNS) && FORBIDDEN_PATTERNS.length >= 6,
    'FORBIDDEN_PATTERNS must be re-exported (>= 6 patterns)');
  assert.ok(positiveBundles.length >= 4,
    'A1 sweep requires at least 4 captured positive bundles; got ' + positiveBundles.length);
  for (let i = 0; i < positiveBundles.length; i += 1) {
    const json = JSON.stringify(positiveBundles[i]);
    for (const re of FORBIDDEN_PATTERNS) {
      assert.equal(re.test(json), false,
        'positive bundle ' + i + ' contains FORBIDDEN_PATTERNS hit ' + re.source
          + ' in JSON: ' + json.slice(0, 200));
    }
  }
});

record('T9 runDiscovery is AsyncFunction; Module exports surface verified', function () {
  assert.equal(typeof runDiscovery, 'function', 'runDiscovery must be a function');
  assert.equal(runDiscovery.constructor.name, 'AsyncFunction',
    'runDiscovery must be AsyncFunction; got ' + runDiscovery.constructor.name);
  assert.ok(orchestrator._test && typeof orchestrator._test === 'object',
    '_test export surface must be present for whitebox introspection');
});

// ---------- Suite report ----------

(async function () {
  await runAll();
  const total = passed + failed;
  process.stdout.write('\n');
  if (failed === 0) {
    process.stdout.write('=== 89.5-04 rs-discovery-engine suite: ' + passed + '/' + total + ' passed ===\n');
    process.exit(0);
  } else {
    process.stdout.write('=== 89.5-04 rs-discovery-engine suite: ' + passed + '/' + total + ' passed (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stdout.write('  FAIL ' + f.name + ': ' + f.message + '\n');
    }
    process.exit(1);
  }
})();
