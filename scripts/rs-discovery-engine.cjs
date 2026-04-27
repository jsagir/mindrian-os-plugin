#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 04 -- rs-discovery-engine top-level orchestrator.
 *
 * The v1.11.0 capstone: a single runDiscovery(topic, opts) entry point
 * that chains every Reverse Salient phase end-to-end and returns the
 * full RSDiscovery bundle with chain metadata + persisted graph nodes.
 *
 * Pipeline (sequential, deterministic):
 *
 *   runDiscovery(topic, opts)
 *     |
 *     +-- Canon Part 8 input audit (auditQueryObject)
 *     |
 *     +-- Phase 0: Upstream chain awareness
 *     |     chain-feeder.lookupUpstream(problem_type, stage)
 *     |       (Mode A: Brain reachable; Mode B: Brain unreachable -> ready)
 *     |     if state === 'pause' -> bubble verbatim; NO further phases run
 *     |
 *     +-- Phase 1: Domain Analysis (89.1)
 *     |     rs-domain-analyzer.analyzeDomain(topic)
 *     |     rs-query-matrix.generateQueryMatrix(domain_analysis)
 *     |
 *     +-- Phase 1.5: External Research Fetching (89.2)
 *     |     rs-fetcher-academic.fetchAcademic(query_array)
 *     |     rs-fetcher-patents.fetchPatents(query_array)
 *     |     rs-fetcher-industry.fetchIndustry(query_array)
 *     |     rs-fetcher-experts.mapExperts(academic.papers)
 *     |
 *     +-- Phase 2: Preprocessing (89.2)
 *     |     rs-preprocessor.preprocess(documents, {domain_analysis})
 *     |
 *     +-- Phase 3: Detection + Classification + Scoring (89.2)
 *     |     rs-differential-scorer.score(query_concept, doc_concept) per pair
 *     |     rs-innovation-classifier.classify(scored_pair)
 *     |     rs-breakthrough-scorer.scoreBreakthrough(classified_pair)
 *     |
 *     +-- Phase 4: Synthesis (89.2 + 89.5-01 + 89.3)
 *     |     rs-thesis-generator.generateThesis(classified_pair, breakthrough)
 *     |     rs-commercial-assessor.assess(rs_discovery)         (89.5-01)
 *     |     rs-expert-mapper.mapAuthorsToAura(experts, opts)    (89.3)
 *     |
 *     +-- Output Layer (89.3)
 *     |     detectTier(opts) -> 'tier1' (Aura) | 'tier0' (SQLite)
 *     |     if tier1: try rs-neo4j-writer.writeDiscovery; on
 *     |       AuraUnreachableError -> fallback to rs-sqlite-mirror
 *     |     if tier0: rs-sqlite-mirror.writeDiscovery
 *     |     rs-mind-map.renderMindMap
 *     |
 *     +-- Chain Downstream (89.4)
 *           rs-chain-feeder.emitChainMetadata per discovery
 *
 * Returns the full bundle:
 *   {topic, domain_analysis, query_matrix, fetched_results, preprocessed,
 *    scored, classified, breakthroughs, theses, commercial,
 *    output: {written, mind_map, experts}, chain_metadata}
 *
 * Tier 0 / Tier 1 + Mode A / Mode B graceful degradation: orchestrator
 * never crashes when Aura or Brain are unreachable. Mirrors 89.3
 * detectTier + 89.4-02 lookupUpstream graceful patterns.
 *
 * CANON PART 8 INVARIANTS (load-bearing):
 *   - auditQueryObject runs at orchestrator entry on (topic, opts).
 *   - The orchestrator NEVER directly imports brain-client.cjs. ALL Brain
 *     queries route through chain-feeder.lookupUpstream which already
 *     wraps brainClient.query per the 89.4-02 chokepoint reuse pattern.
 *   - The orchestrator NEVER calls fetch() directly. The 89.2 fetchers
 *     each have their own audit chokepoint per rs-egress-prompts.cjs.
 *
 * CANON PART 7 (Reuse Before Build): every phase module is consumed via
 * require(); the orchestrator is composition, NOT duplication.
 *
 * Pure CJS, zero runtime deps, no Node built-ins beyond core require.
 *
 * License: BSL-1.1.
 */

// ---------- Defense-in-depth chokepoints ----------

const { auditQueryObject } = require('../lib/core/rs-egress-prompts.cjs');
const { ExternalEgressViolation } = require('../lib/core/rs-egress-violations.cjs');

// ---------- Phase modules (Canon Part 7 reuse) ----------
//
// All 89.1 + 89.2 + 89.3 + 89.4 + 89.5-01 modules are required EAGERLY
// at module load. Lazy require would save startup latency on the
// no-args path but the tradeoff is worse: lazy paths obscure the
// dependency graph at audit time, and v1.11.0-beta.1 needs the
// dependency surface to be mechanically grep-able.

const domainAnalyzer = require('../lib/core/rs-domain-analyzer.cjs');
const queryMatrix = require('../lib/core/rs-query-matrix.cjs');
const fetcherAcademic = require('../lib/core/rs-fetcher-academic.cjs');
const fetcherPatents = require('../lib/core/rs-fetcher-patents.cjs');
const fetcherIndustry = require('../lib/core/rs-fetcher-industry.cjs');
const fetcherExperts = require('../lib/core/rs-fetcher-experts.cjs');
const preprocessor = require('../lib/core/rs-preprocessor.cjs');
const differentialScorer = require('../lib/core/rs-differential-scorer.cjs');
const innovationClassifier = require('../lib/core/rs-innovation-classifier.cjs');
const breakthroughScorer = require('../lib/core/rs-breakthrough-scorer.cjs');
const thesisGenerator = require('../lib/core/rs-thesis-generator.cjs');
const commercialAssessor = require('../lib/core/rs-commercial-assessor.cjs');
const neo4jWriter = require('../lib/core/rs-neo4j-writer.cjs');
const sqliteMirror = require('../lib/core/rs-sqlite-mirror.cjs');
const mindMap = require('../lib/core/rs-mind-map.cjs');
const expertMapper = require('../lib/core/rs-expert-mapper.cjs');
const chainFeeder = require('../lib/core/rs-chain-feeder.cjs');

// ---------- Tier dispatch ----------
//
// Determines whether the output layer writes to Tier 1 (Aura via
// rs-neo4j-writer) or Tier 0 (SQLite via rs-sqlite-mirror). Mirrors the
// 89.3 detectTier convention: explicit opts.tier wins; otherwise infer
// from opts.aura_url / opts.driver / NEO4J_URI env. Fallback is Tier 0
// (the safe default; SQLite always works given a writable room_dir).

function detectTier(opts) {
  opts = opts || {};
  if (opts.tier === 'tier0' || opts.tier === 'tier1') return opts.tier;
  if (opts.driver && typeof opts.driver.session === 'function') return 'tier1';
  if (typeof opts.aura_url === 'string' && opts.aura_url.length > 0) return 'tier1';
  if (typeof process.env.NEO4J_URI === 'string' && process.env.NEO4J_URI.length > 0) return 'tier1';
  return 'tier0';
}

// ---------- Test-mock surface ----------
//
// applyTestMocks lets the test suite substitute deterministic mocks for
// any phase module without monkey-patching require's cache. Production
// callers MUST NOT pass _test_mocks; the option is gated behind the
// underscore prefix to mark it as a test-only surface.

function applyTestMocks(opts, modules) {
  if (!opts || !opts._test_mocks || typeof opts._test_mocks !== 'object') {
    return modules;
  }
  // Shallow merge: any key present in _test_mocks overrides the
  // production module. Missing keys fall through to the real require.
  const merged = {};
  const keys = Object.keys(modules);
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    merged[k] = (opts._test_mocks[k] !== undefined) ? opts._test_mocks[k] : modules[k];
  }
  return merged;
}

// ---------- Helpers ----------

function flattenQueryMatrix(matrix) {
  if (!matrix || typeof matrix !== 'object') return [];
  const buckets = ['a_intersect_b', 'a_leads_to_b', 'b_leads_to_a', 'adjacent'];
  const out = [];
  for (let i = 0; i < buckets.length; i += 1) {
    const arr = matrix[buckets[i]];
    if (Array.isArray(arr)) {
      for (let j = 0; j < arr.length; j += 1) {
        if (typeof arr[j] === 'string' && arr[j].length > 0) {
          out.push(arr[j]);
        }
      }
    }
  }
  return out;
}

function aggregateDocuments(fetched_results) {
  // Combine the 3 fetcher outputs into a single document stream for the
  // preprocessor. Each fetcher returns a different shape; we normalize
  // to the {id, title, abstract, signal, source} contract preprocessor
  // already understands.
  const out = [];
  if (fetched_results && fetched_results.academic && Array.isArray(fetched_results.academic.papers)) {
    for (const p of fetched_results.academic.papers) out.push(p);
  }
  if (fetched_results && fetched_results.patents && Array.isArray(fetched_results.patents.patents)) {
    for (const p of fetched_results.patents.patents) out.push(p);
  }
  if (fetched_results && fetched_results.industry && Array.isArray(fetched_results.industry.signals)) {
    for (const s of fetched_results.industry.signals) out.push(s);
  }
  return out;
}

function pickQueryConcept(domainAnalysis, preprocessedItem) {
  // Pick a representative query_concept for the differential scorer.
  // Prefer the first concept on the preprocessed item; fall back to
  // domain analysis primary_domain. Both are scrub-validated by their
  // own modules, so concatenating here cannot leak.
  if (preprocessedItem && Array.isArray(preprocessedItem.concepts) && preprocessedItem.concepts.length > 0) {
    return preprocessedItem.concepts[0];
  }
  if (domainAnalysis && typeof domainAnalysis.primary_domain === 'string') {
    return domainAnalysis.primary_domain;
  }
  return 'topic';
}

function pickDocConcept(preprocessedItem) {
  // Pick a representative doc_concept for the differential scorer.
  // Prefer the first method on the preprocessed item; fall back to a
  // technical term. Per 89.2 scorer contract, both arguments must be
  // non-empty strings.
  if (preprocessedItem && Array.isArray(preprocessedItem.methods) && preprocessedItem.methods.length > 0) {
    return preprocessedItem.methods[0];
  }
  if (preprocessedItem && Array.isArray(preprocessedItem.technical_terms) && preprocessedItem.technical_terms.length > 0) {
    return preprocessedItem.technical_terms[0];
  }
  return 'document';
}

// ---------- runDiscovery (the public entry point) ----------
//
// Inputs:
//   topic  string  the discovery topic; user-controlled. Audited at
//                  the gate (rs-domain-analyzer also audits internally).
//   opts   optional object:
//     room_dir         string   path to the room directory (Tier 0 dispatch)
//     aura_url         string   Aura connection URL (Tier 1 dispatch hint)
//     driver           object   pre-built Aura driver (Tier 1 dispatch)
//     problem_type     string   for chain-feeder.lookupUpstream
//     stage            string   for chain-feeder.lookupUpstream
//     active_context   object   for chain-feeder.emitChainMetadata
//     _test_mocks      object   PRIVATE; per-module mock map for tests
//
// Output (happy path):
//   {topic, domain_analysis, query_matrix, fetched_results, preprocessed,
//    scored, classified, breakthroughs, theses, commercial,
//    output: {written, mind_map, experts}, chain_metadata}
//
// Output (pause):
//   {state: 'pause', missing_upstream, suggested_action}  // bubbled verbatim
//
// Throws:
//   ExternalEgressViolation  if (topic, opts) contain FORBIDDEN_PATTERNS
//                            (audit at the gate; NO module is invoked)
//   propagates ExternalEgressViolation from any downstream module
//                            (per-module audit chokepoints; defense-in-depth)

async function runDiscovery(topic, opts) {
  opts = opts || {};

  // SEAM A: Canon Part 8 input audit. Throws ExternalEgressViolation
  // BEFORE any module is touched. Adversarial bytes nested in opts
  // (e.g., opts.meeting_transcript) are caught by the JSON.stringify
  // walk inside auditQueryObject. T5 covers this contract.
  //
  // We sanitize opts to omit the _test_mocks reference because mock
  // function instances are not JSON-serializable and would cause
  // auditQueryObject to throw a TypeError instead of the precise
  // ExternalEgressViolation that callers expect.
  const auditOpts = {};
  const optKeys = Object.keys(opts);
  for (let i = 0; i < optKeys.length; i += 1) {
    if (optKeys[i] !== '_test_mocks' && optKeys[i] !== 'driver') {
      auditOpts[optKeys[i]] = opts[optKeys[i]];
    }
  }
  auditQueryObject({ topic: topic, opts: auditOpts }, 'rs-discovery-engine-input');

  // Apply test mocks if present (test surface; production passes through).
  const m = applyTestMocks(opts, {
    domainAnalyzer: domainAnalyzer,
    queryMatrix: queryMatrix,
    fetcherAcademic: fetcherAcademic,
    fetcherPatents: fetcherPatents,
    fetcherIndustry: fetcherIndustry,
    fetcherExperts: fetcherExperts,
    preprocessor: preprocessor,
    differentialScorer: differentialScorer,
    innovationClassifier: innovationClassifier,
    breakthroughScorer: breakthroughScorer,
    thesisGenerator: thesisGenerator,
    commercialAssessor: commercialAssessor,
    expertMapper: expertMapper,
    neo4jWriter: neo4jWriter,
    sqliteMirror: sqliteMirror,
    mindMap: mindMap,
    chainFeeder: chainFeeder,
  });

  // ---------- Phase 0: Upstream chain awareness ----------
  //
  // chain-feeder.lookupUpstream is the ONLY Brain touch in the
  // orchestrator. It wraps brainClient.query per 89.4-02 chokepoint
  // reuse and degrades gracefully (returns {state: 'ready'}) when Brain
  // is unreachable. T3 + T7 cover this contract.

  const upstream = await m.chainFeeder.lookupUpstream(
    opts.problem_type,
    opts.stage,
    opts.upstreamLookupOpts || {}
  );

  if (upstream && upstream.state === 'pause') {
    // Pause envelope bubbled verbatim. Caller (Decision Gate UI in
    // 89.5-05 / 91) renders the missing_upstream + suggested_action
    // for user review. NO further phase modules run. T7 verifies.
    return {
      state: 'pause',
      missing_upstream: upstream.missing_upstream || [],
      suggested_action: upstream.suggested_action || 'Run Methodology',
    };
  }

  // ---------- Phase 1: Domain Analysis (89.1) ----------

  const domain_analysis = await m.domainAnalyzer.analyzeDomain(topic);
  const query_matrix = m.queryMatrix.generateQueryMatrix(domain_analysis);

  // ---------- Phase 1.5: External Research Fetching (89.2) ----------
  //
  // Sequential invocation for v1.11.0-beta.1. Promise.all parallelization
  // is deferred to v1.11.0-stable per kickoff guidance: per-fetcher
  // rate-limit budgets are stored as module-private state (academic.cjs
  // computeRemainingBudget), so the parallel-async win is small and the
  // sequential trace is easier to debug for the beta cohort.

  const flat_queries = flattenQueryMatrix(query_matrix);

  const academic = await m.fetcherAcademic.fetchAcademic(flat_queries, opts.fetcherOpts || {});
  const patents = await m.fetcherPatents.fetchPatents(flat_queries, opts.fetcherOpts || {});
  const industry = await m.fetcherIndustry.fetchIndustry(flat_queries, opts.fetcherOpts || {});

  // mapExperts is sync; experts are derived from academic papers.
  const expertsRaw = m.fetcherExperts.mapExperts(
    (academic && Array.isArray(academic.papers)) ? academic.papers : []
  );

  const fetched_results = {
    academic: academic,
    patents: patents,
    industry: industry,
    experts: expertsRaw,
  };

  // ---------- Phase 2: Preprocessing (89.2) ----------

  const documents = aggregateDocuments(fetched_results);
  const preprocessed = m.preprocessor.preprocess(documents, { domain_analysis: domain_analysis });

  // Defensive: preprocess may return an envelope on Canon Part 8 input
  // rejection ({error, reason}); treat as empty for downstream phases.
  const preprocessedArr = Array.isArray(preprocessed) ? preprocessed : [];

  // ---------- Phase 3: Detection + Classification + Scoring (89.2) ----------

  const scored = [];
  const classified = [];
  const breakthroughs = [];

  for (let i = 0; i < preprocessedArr.length; i += 1) {
    const item = preprocessedArr[i];
    const queryConcept = pickQueryConcept(domain_analysis, item);
    const docConcept = pickDocConcept(item);

    const scoredEntry = await m.differentialScorer.score(
      queryConcept,
      docConcept,
      opts.scorerOpts || {}
    );
    // Tag the scored entry with the originating concepts so the
    // classifier and downstream layers can read them.
    const scoredPair = Object.assign({}, scoredEntry, {
      query_concept: queryConcept,
      doc_concept: docConcept,
    });
    scored.push(scoredPair);

    const classifiedPair = m.innovationClassifier.classify(scoredPair);
    classified.push(classifiedPair);

    // Breakthrough scorer expects a classified_pair with passes-through
    // concept fields; the classifier already builds that shape.
    const breakthroughPair = m.breakthroughScorer.scoreBreakthrough(classifiedPair, {
      industry_signal_count: (industry && Array.isArray(industry.signals)) ? industry.signals.length : 0,
      pair_density: 1.0,
    });
    breakthroughs.push(breakthroughPair);
  }

  // ---------- Phase 4: Synthesis (89.2 + 89.5-01 + 89.3) ----------

  const theses = [];
  const commercial = [];

  for (let i = 0; i < classified.length; i += 1) {
    const classifiedPair = classified[i];
    const breakthroughPair = breakthroughs[i] || {};

    const thesis = m.thesisGenerator.generateThesis(
      classifiedPair,
      (breakthroughPair && breakthroughPair.breakthrough) ? breakthroughPair.breakthrough : null
    );
    theses.push(thesis);

    // Commercial assessor consumes the breakthrough envelope (which
    // already carries classification + bridge_concept pass-throughs).
    const commercialEntry = m.commercialAssessor.assess(breakthroughPair, {
      industry_signals_count: (industry && Array.isArray(industry.signals)) ? industry.signals.length : 0,
    });
    commercial.push(commercialEntry);
  }

  // Expert mapper resolves authors to Aura nodes (Tier 1) or SQLite
  // (Tier 0). Pass tier hints through opts.
  const expertMapperOpts = {};
  if (opts.driver) expertMapperOpts.driver = opts.driver;
  if (typeof opts.room_dir === 'string') expertMapperOpts.roomDir = opts.room_dir;
  // Force tier='sqlite' if neither driver nor room_dir is present so
  // mapAuthorsToAura's detectTier does not throw.
  if (!opts.driver && typeof opts.room_dir !== 'string') {
    expertMapperOpts.tier = 'sqlite';
    expertMapperOpts.roomDir = process.cwd();
  }
  const experts = await m.expertMapper.mapAuthorsToAura(
    Array.isArray(expertsRaw) ? expertsRaw : [],
    expertMapperOpts
  );

  // ---------- Output Layer (89.3) ----------

  const tier = detectTier(opts);

  const writerPayload = (breakthroughs.length > 0)
    ? breakthroughs[0]   // first discovery is the canonical write target
    : {                  // empty discovery -> minimal valid envelope
        query_concept: (typeof topic === 'string' && topic.length > 0) ? topic : 'topic',
        doc_concept: 'no_results',
        classification: 'structural_transfer',
      };

  let written = null;
  if (tier === 'tier1') {
    // Try Aura first; on AuraUnreachableError fall back to SQLite.
    // Mirrors 89.3 graceful degradation pattern. T2 verifies.
    try {
      const result = await m.neo4jWriter.writeDiscovery(writerPayload, {
        driver: opts.driver,
        context: opts.writer_context || {},
      });
      written = Object.assign({}, result, { tier: 'tier1' });
    } catch (err) {
      const isAuraUnreachable =
        (err && err.name === 'AuraUnreachableError') ||
        (m.neo4jWriter.AuraUnreachableError && err instanceof m.neo4jWriter.AuraUnreachableError) ||
        (neo4jWriter.AuraUnreachableError && err instanceof neo4jWriter.AuraUnreachableError);
      if (!isAuraUnreachable) {
        // Other errors (TypeError, ExternalEgressViolation) bubble up.
        throw err;
      }
      // Aura unreachable -> Tier 0 fallback.
      const fallback = await m.sqliteMirror.writeDiscovery(writerPayload, {
        roomDir: opts.room_dir || process.cwd(),
        context: opts.writer_context || {},
      });
      written = Object.assign({}, fallback, { tier: 'tier0', fallback_reason: 'aura_unreachable' });
    }
  } else {
    const result = await m.sqliteMirror.writeDiscovery(writerPayload, {
      roomDir: opts.room_dir || process.cwd(),
      context: opts.writer_context || {},
    });
    written = Object.assign({}, result, { tier: 'tier0' });
  }

  // Mind map render. Pass tier hint so detectTier inside rs-mind-map
  // does not throw on missing driver/roomDir.
  const mindMapOpts = {};
  if (opts.driver) mindMapOpts.driver = opts.driver;
  if (typeof opts.room_dir === 'string') mindMapOpts.roomDir = opts.room_dir;
  if (!opts.driver && typeof opts.room_dir !== 'string') {
    mindMapOpts.tier = 'sqlite';
    mindMapOpts.roomDir = process.cwd();
  }
  const mind_map = await m.mindMap.renderMindMap({}, mindMapOpts);

  // ---------- Chain Downstream (89.4) ----------
  //
  // Per-discovery emitChainMetadata. The verb is selected
  // deterministically per breakthrough_score; the spawn_skill is
  // selected per SKILL_SPAWN_RULES. Mode B (Brain unreachable) does
  // not affect emitChainMetadata; the function is fully local.
  // T1 + T3 + T4 verify.

  const active_context = opts.active_context || {};
  const chain_metadata = [];
  for (let i = 0; i < breakthroughs.length; i += 1) {
    const b = breakthroughs[i];
    const c = classified[i] || {};
    const rsType = (typeof c.classification === 'string') ? c.classification : 'structural_transfer';
    const score = (b && b.breakthrough && typeof b.breakthrough.score === 'number')
      ? b.breakthrough.score
      : 0;
    const entry = m.chainFeeder.emitChainMetadata(rsType, score, active_context);
    chain_metadata.push(entry);
  }

  // If breakthroughs is empty, still emit one chain_metadata entry so
  // downstream consumers always have a non-empty array. The plan T1
  // requires >=1 entry per discovery; we treat the topic itself as
  // the implicit discovery in the empty path.
  if (chain_metadata.length === 0) {
    const entry = m.chainFeeder.emitChainMetadata('structural_transfer', 0, active_context);
    chain_metadata.push(entry);
  }

  // ---------- Assemble bundle ----------

  return {
    topic: topic,
    domain_analysis: domain_analysis,
    query_matrix: query_matrix,
    fetched_results: fetched_results,
    preprocessed: preprocessedArr,
    scored: scored,
    classified: classified,
    breakthroughs: breakthroughs,
    theses: theses,
    commercial: commercial,
    output: {
      written: written,
      mind_map: mind_map,
      experts: experts,
    },
    chain_metadata: chain_metadata,
  };
}

// ---------- Exports ----------

module.exports = {
  runDiscovery: runDiscovery,
  // Test surface (private; do NOT consume in production).
  _test: {
    detectTier: detectTier,
    applyTestMocks: applyTestMocks,
    flattenQueryMatrix: flattenQueryMatrix,
    aggregateDocuments: aggregateDocuments,
    pickQueryConcept: pickQueryConcept,
    pickDocConcept: pickDocConcept,
  },
};

// ---------- Optional CLI entry ----------
//
// Allows manual invocation for smoke testing:
//   node scripts/rs-discovery-engine.cjs "quantum brain imaging"

if (require.main === module) {
  const cliTopic = process.argv[2];
  if (typeof cliTopic !== 'string' || cliTopic.length === 0) {
    process.stderr.write('Usage: node scripts/rs-discovery-engine.cjs <topic>\n');
    process.exit(1);
  }
  runDiscovery(cliTopic, {
    room_dir: process.env.RS_ROOM_DIR || process.cwd(),
  })
    .then(function (bundle) {
      process.stdout.write(JSON.stringify(bundle, null, 2) + '\n');
      process.exit(0);
    })
    .catch(function (err) {
      process.stderr.write('rs-discovery-engine error: ' + (err && err.message ? err.message : String(err)) + '\n');
      process.exit(1);
    });
}
