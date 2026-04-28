#!/usr/bin/env node
'use strict';

/*
 * Phase 94-02 -- rs-discovery-engine thesis-merge handoff fence.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Why this fixture exists.
 *
 *   v1.11.0 QA harness (Lawrence's Dr. Miriam Kaplan run, 2026-04-28) hit a
 *   P0 ship-blocker in /mos:rs-fetch end-to-end. The producer
 *   scripts/rs-discovery-engine.cjs Phase 4 Synthesis loop emits theses[]
 *   parallel to breakthroughs[] but never folds them. The consumer
 *   lib/core/rs-sqlite-mirror.cjs declares thesis as REQUIRED_FIELDS at
 *   line 61. The handoff at lines 429-435 drops thesis on the floor on
 *   BOTH the success branch (breakthroughs.length > 0) and the empty-
 *   fallback branch (breakthroughs.length === 0).
 *
 * Plan 94-02 deviation note (locked-decision adapt).
 *
 *   The plan's locked-decision empty-fallback shape was
 *     { summary: '', confidence: 0, evidence_refs: [] }
 *   but the consumer validateRequiredFields at lib/core/rs-sqlite-mirror.cjs
 *   line 121-130 requires every REQUIRED_FIELD to be a NON-EMPTY STRING
 *   (typeof string check + length > 0 check). An object stub fails the
 *   typeof check. The producer rs-thesis-generator.generateThesis ALSO
 *   returns a string on the success path (line 167-176 in lib/core/rs-
 *   thesis-generator.cjs), not the {summary, confidence, evidence_refs}
 *   envelope the plan's <interfaces> block claims. The locked-decision
 *   shape was speculative; ground truth shows producer + consumer agree
 *   on string. We use a sentinel string 'no_thesis' for the empty-fallback
 *   branch (the only path that has no real classified pair to thesis-fill).
 *
 * Test map (3 cases, one-to-one with the PLAN <behavior> block).
 *
 *   T1  Success path: runDiscovery with mocks producing >=1 classified
 *       pair. Stub the writer; assert writerPayload.thesis is defined,
 *       is a non-empty string, equals the mocked thesisGenerator return.
 *
 *   T2  Empty path: runDiscovery with mocks producing 0 preprocessed
 *       items (so classified.length === 0 and breakthroughs.length === 0).
 *       Stub the writer; assert writerPayload.thesis === 'no_thesis'
 *       and the other REQUIRED_FIELDS are also non-empty strings.
 *
 *   T3  E2E tier 0 sqlite write: runDiscovery with mocks for the network
 *       phases + REAL thesisGenerator + REAL sqliteMirror against a
 *       mkdtempSync room. Assert no throw, no TypeError, sqlite row
 *       count > 0 in <room>/.mindrian/room.db nodes table.
 *
 *       Plan deviation: the plan's <action> Step 4 prescribed a
 *       child_process.execFileSync against the CLI entry. That hits real
 *       Tavily / Semantic Scholar / patents fetchers and is environment-
 *       dependent (network + rate limits). We exercise the same write
 *       path programmatically via runDiscovery() with deterministic
 *       upstream mocks; the writer code path under test (sqliteMirror
 *       .writeDiscovery + lazygraph.openGraph + INSERT OR REPLACE) is
 *       identical. Spirit of the verify (writerPayload reaches sqlite,
 *       row gets written, no TypeError) is preserved.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO = path.resolve(__dirname, '..', '..');
const ENGINE_PATH = path.join(REPO, 'scripts', 'rs-discovery-engine.cjs');

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}

function cleanupTmp() {
  for (const d of TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  TMP_ROOTS.length = 0;
}

// ---------- Mock factories ----------
//
// Keys mirror the applyTestMocks contract in scripts/rs-discovery-engine.cjs
// (lines 266-284). Any key omitted falls through to the real require().
// The returned object is passed as opts._test_mocks.

function buildSuccessPathMocks(capturedWriterPayload) {
  // Upstream mocks shape one preprocessed item -> one scored -> one
  // classified -> one breakthrough -> one thesis. Mocked thesisGenerator
  // returns a known sentinel string so T1 can assert merge-loop fidelity.
  return {
    chainFeeder: {
      lookupUpstream: async () => ({ state: 'ready' }),
      emitChainMetadata: () => ({ verb: 'Run Methodology', spawn_skill: null }),
    },
    domainAnalyzer: {
      analyzeDomain: async () => ({
        primary_domains: ['quantum'],
        adjacent_domains: ['biomedical'],
      }),
    },
    queryMatrix: {
      generateQueryMatrix: () => ({
        a_intersect_b: ['q1'],
        a_leads_to_b: [],
        b_leads_to_a: [],
        adjacent: [],
      }),
    },
    fetcherAcademic: {
      fetchAcademic: async () => ({ papers: [{ id: 'p1', title: 't1', abstract: 'a1' }] }),
    },
    fetcherPatents: {
      fetchPatents: async () => ({ patents: [] }),
    },
    fetcherIndustry: {
      fetchIndustry: async () => ({ signals: [] }),
    },
    fetcherExperts: {
      // The producer calls fetcherExperts.mapExperts (sync) at line 330.
      mapExperts: () => [],
    },
    preprocessor: {
      preprocess: () => ([{ id: 'p1', title: 't1', abstract: 'a1', source: 'academic' }]),
    },
    differentialScorer: {
      score: async () => ({ novelty_score: 0.7, novelty_breakdown: {} }),
    },
    innovationClassifier: {
      classify: (scoredPair) => ({
        query_concept: scoredPair.query_concept || 'qc',
        doc_concept: scoredPair.doc_concept || 'dc',
        classification: 'structural_transfer',
        bridge_concept: 'bridge1',
      }),
    },
    breakthroughScorer: {
      scoreBreakthrough: (classifiedPair) => ({
        query_concept: classifiedPair.query_concept,
        doc_concept: classifiedPair.doc_concept,
        classification: classifiedPair.classification,
        bridge_concept: classifiedPair.bridge_concept,
        breakthrough: { score: 0.5, dominant_dimension: 'feasibility' },
      }),
    },
    thesisGenerator: {
      generateThesis: () => 'mocked-thesis-string-94-02',
    },
    commercialAssessor: {
      assess: () => ({ score: 0.5 }),
    },
    expertMapper: {
      mapAuthorsToAura: async () => [],
    },
    neo4jWriter: {
      writeDiscovery: async () => { throw new Error('T1 should not reach neo4jWriter (tier0 forced)'); },
    },
    sqliteMirror: {
      writeDiscovery: async (pair) => {
        // Capture the writerPayload exactly as the producer hands it off.
        // Test asserts against this shape.
        capturedWriterPayload.value = pair;
        return {
          wrote_node_count: 1,
          wrote_edge_count: 0,
          rollback_cypher: '',
          aura_op_id: 'op-test',
          schema_version: '1.0',
        };
      },
    },
    mindMap: {
      renderMindMap: async () => ({ nodes: [], edges: [] }),
    },
  };
}

function buildEmptyPathMocks(capturedWriterPayload) {
  // Empty path: preprocess returns []; classified + breakthroughs both
  // empty arrays; runDiscovery falls through to the empty-fallback
  // envelope branch at lines 429-435.
  const m = buildSuccessPathMocks(capturedWriterPayload);
  m.preprocessor = { preprocess: () => ([]) };
  return m;
}

// ---------- Test cases ----------

async function test_1_successPathThesisMerged(rsEngine) {
  const captured = { value: null };
  const mocks = buildSuccessPathMocks(captured);

  await rsEngine.runDiscovery('test-topic-success', {
    tier: 'tier0',
    room_dir: mkTmp('rs-94-02-t1-'),
    _test_mocks: mocks,
  });

  assert.ok(captured.value, 't1: writerPayload was passed to sqliteMirror');
  assert.strictEqual(typeof captured.value.thesis, 'string', 't1: thesis is a string');
  assert.ok(captured.value.thesis.length > 0, 't1: thesis is non-empty');
  assert.strictEqual(
    captured.value.thesis,
    'mocked-thesis-string-94-02',
    't1: thesis is the value the producer pushed into theses[i] for this pair'
  );
  // Other REQUIRED_FIELDS still present (defensive; not the bug under test
  // but a regression fence so the merge loop does not strip them).
  assert.strictEqual(typeof captured.value.query_concept, 'string', 't1: query_concept preserved');
  assert.strictEqual(typeof captured.value.doc_concept, 'string', 't1: doc_concept preserved');
  assert.strictEqual(typeof captured.value.classification, 'string', 't1: classification preserved');
}

async function test_2_emptyPathThesisStub(rsEngine) {
  const captured = { value: null };
  const mocks = buildEmptyPathMocks(captured);

  await rsEngine.runDiscovery('test-topic-empty', {
    tier: 'tier0',
    room_dir: mkTmp('rs-94-02-t2-'),
    _test_mocks: mocks,
  });

  assert.ok(captured.value, 't2: writerPayload was passed to sqliteMirror in empty branch');
  assert.strictEqual(typeof captured.value.thesis, 'string', 't2: empty-fallback thesis is a string');
  assert.ok(captured.value.thesis.length > 0, 't2: empty-fallback thesis is non-empty (passes validateRequiredFields)');
  assert.strictEqual(
    captured.value.thesis,
    'no_thesis',
    't2: empty-fallback thesis is the sentinel string per 94-02 deviation'
  );
  // Empty-fallback envelope must still carry the other 3 REQUIRED_FIELDS.
  assert.strictEqual(typeof captured.value.query_concept, 'string', 't2: query_concept in empty-fallback');
  assert.ok(captured.value.query_concept.length > 0, 't2: query_concept non-empty');
  assert.strictEqual(captured.value.doc_concept, 'no_results', 't2: doc_concept literal');
  assert.strictEqual(captured.value.classification, 'structural_transfer', 't2: classification literal');
}

async function test_3_e2eTier0RowWritten(rsEngine) {
  // E2E test: REAL sqliteMirror, REAL thesisGenerator. Mocks only the
  // network-dependent upstream phases + neo4jWriter + mindMap so the
  // test is deterministic. The write path under test
  // (sqliteMirror.writeDiscovery -> lazygraph.openGraph -> INSERT OR
  // REPLACE) runs identically to /mos:rs-fetch tier 0 production.
  const roomDir = mkTmp('rs-94-02-t3-');

  const mocks = buildSuccessPathMocks({ value: null });
  // Real thesisGenerator for deterministic string output.
  delete mocks.thesisGenerator;
  // Real sqliteMirror so the row actually lands in room.db.
  delete mocks.sqliteMirror;

  // classifiedPair must carry inputs valid for the REAL thesisGenerator:
  //   classification in MECHANISM_BY_CLASSIFICATION,
  //   query_concept + doc_concept non-empty strings,
  //   bridge_concept optional but cleaner if provided.
  // Already satisfied by buildSuccessPathMocks.innovationClassifier.

  let threw = null;
  try {
    await rsEngine.runDiscovery('test-topic-e2e', {
      tier: 'tier0',
      room_dir: roomDir,
      _test_mocks: mocks,
    });
  } catch (err) {
    threw = err;
  }

  assert.strictEqual(threw, null, 't3: runDiscovery did not throw (no missing-thesis TypeError)');

  // Verify a row landed in the nodes table (sqliteMirror writes node rows
  // for query_concept, doc_concept, and the discovery-level node).
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  assert.ok(fs.existsSync(dbPath), 't3: room.db exists at ' + dbPath);

  const db = new DatabaseSync(dbPath);
  let nodeCount = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM nodes').get();
    nodeCount = row && typeof row.n === 'number' ? row.n : 0;
  } finally {
    try { db.close(); } catch (_e) { /* best effort */ }
  }
  assert.ok(nodeCount > 0, 't3: at least one node row written (got ' + nodeCount + ')');
}

// ---------- Runner ----------

async function run() {
  // Sanity: producer file present.
  assert.ok(fs.existsSync(ENGINE_PATH), 'rs-discovery-engine.cjs missing at ' + ENGINE_PATH);

  // eslint-disable-next-line global-require
  const rsEngine = require(ENGINE_PATH);

  try {
    await test_1_successPathThesisMerged(rsEngine);
    await test_2_emptyPathThesisStub(rsEngine);
    await test_3_e2eTier0RowWritten(rsEngine);
  } finally {
    cleanupTmp();
  }

  process.stdout.write('rs-discovery-engine: 3/3 tests passed\n');
  process.exit(0);
}

run().catch((e) => {
  process.stderr.write((e && e.stack) || String(e));
  process.stderr.write('\n');
  cleanupTmp();
  process.exit(1);
});
