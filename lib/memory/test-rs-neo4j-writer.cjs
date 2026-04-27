#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 01 -- Aura Cypher writer fixture suite.
 *
 * writeDiscovery(pair, opts) is the Tier 1 (Aura-connected) writer in the
 * dual-tier output layer. The writer takes a scored+classified+thesis-bearing
 * pair (from Plan 89.2-07's generateThesis output) and persists it into the
 * user's own LazyGraph Aura via idempotent MERGE Cypher with deterministic
 * sha256-derived ids (REAL Aura idempotency, not mock-state tracking).
 *
 * 12 scenarios + A1 sweep:
 *   1  Happy path (minimal pair, no opts.context)
 *   2  REAL idempotency via deterministic ids (byte-identical ids on repeat)
 *   3  Full happy path with opts.context (papers + experts)
 *   4  All 5 edge types created (DISCOVERED + DERIVED_FROM + ENABLES + AUTHORED_BY + AFFILIATED_WITH)
 *   5  Rollback Cypher captured + valid
 *   6  Missing classification throws TypeError
 *   7  Missing thesis throws TypeError
 *   8  Aura unreachable throws AuraUnreachableError
 *   9  CANON PART 8 adversarial -- forbidden in pair.thesis
 *   10 CANON PART 8 adversarial -- forbidden in pair.bridge_concept
 *   11 CANON PART 8 adversarial -- forbidden in pair.query_concept
 *   12 CANON PART 8 adversarial -- forbidden smuggled via opts.context.experts[0].name (UNWIND input vector)
 *
 * End-of-suite sweep:
 *   A1: re-scan every captured Cypher op log + input fixture (JSON.stringify)
 *       against FORBIDDEN_PATTERNS as cross-scenario Canon Part 8 guarantee.
 *       For throw-scenarios, op log is empty by design (audit fires before
 *       driver call); A1 sweeps op-log captures from non-throw scenarios.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, path).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Source of truth for parity gate.
const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;

// Every Cypher op captured for end-of-suite A1 sweep.
const capturedOpLogs = [];

let passed = 0;
let failed = 0;
const failures = [];

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/lazygraph-ops.cjs',
    '../core/rs-neo4j-writer.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

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
    resetRequireCache();
  }
}

function captureOpLog(name, opLog) {
  capturedOpLogs.push({ scenario: name, opLog: opLog });
}

// ---------- Mock driver factory ----------
//
// Mirrors the neo4j-driver session/run/close API surface that
// rs-neo4j-writer.cjs invokes. Each call to session.run(cypher, params)
// pushes {cypher, params} onto driver.opLog and returns a Promise that
// resolves with a result object whose summary.counters reflects the
// configured behavior (firstRunCounters vs subsequentRunCounters).
//
// opts.simulateConnectionError: throw on session.run (Test 8)
// opts.firstRunCounters: counters for the first session.run call
// opts.subsequentRunCounters: counters for subsequent calls (idempotency proof)

function makeMockDriver(opts) {
  opts = opts || {};
  const driver = {
    opLog: [],
    runCount: 0,
    sessionsClosed: 0,
    session: function () {
      const drv = this;
      return {
        run: async function (cypher, params) {
          drv.opLog.push({ cypher: cypher, params: params });
          drv.runCount += 1;
          if (opts.simulateConnectionError) {
            throw new Error('connect ECONNREFUSED 127.0.0.1:7687');
          }
          const counters = (drv.runCount === 1)
            ? (opts.firstRunCounters || { nodesCreated: 3, relationshipsCreated: 3 })
            : (opts.subsequentRunCounters || { nodesCreated: 0, relationshipsCreated: 0 });
          return {
            records: [],
            summary: { counters: counters },
          };
        },
        close: async function () {
          drv.sessionsClosed += 1;
        },
      };
    },
  };
  return driver;
}

// ---------- Fixture builders ----------

function makeCleanPair(overrides) {
  const base = {
    query_concept: 'CRISPR delivery',
    doc_concept: 'liposome targeting',
    diff: 0.4,
    lsa: 0.5,
    bert: 0.1,
    passes: true,
    classification: 'structural_transfer',
    bridge_concept: 'cross-domain isomorphism',
    breakthrough: {
      score: 5.9,
      breakdown: { feasibility: 2, market: 1.5, magnitude: 1, advantage: 1.4, impact: 0 },
      dominant_dimension: 'feasibility',
    },
    thesis: 'By applying CRISPR delivery to liposome targeting, achieve feasible novel transfer because isomorphic structure transfers under cross-domain isomorphism.',
  };
  if (overrides) {
    for (const k of Object.keys(overrides)) {
      base[k] = overrides[k];
    }
  }
  return base;
}

function makeFullContext() {
  return {
    papers: [
      {
        id: 'openalex:W123',
        title: 'CRISPR delivery via liposomes',
        authors: [{ name: 'Smith, Jane', orcid: '0000-0001-2345-6789', institution: 'Stanford' }],
        doi: '10.1038/sample.2026',
        source: 'openalex',
      },
    ],
    experts: [
      {
        name: 'Smith, Jane',
        orcid: '0000-0001-2345-6789',
        institution: 'Stanford',
        paper_count: 1,
        h_index_estimate: 1,
        public_email_or_null: null,
      },
    ],
    room_id: 'test-room',
    domain: 'biotech',
  };
}

// ---------- Scenarios ----------

async function scenario1HappyPathMinimal() {
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair();
  const driver = makeMockDriver({ firstRunCounters: { nodesCreated: 3, relationshipsCreated: 3 } });
  const result = await m.writeDiscovery(pair, { driver: driver });
  captureOpLog('1-happy-minimal', driver.opLog);

  assert.equal(result.wrote_node_count, 3, 'wrote_node_count must be 3, got ' + result.wrote_node_count);
  assert.equal(result.wrote_edge_count, 3, 'wrote_edge_count must be 3, got ' + result.wrote_edge_count);
  assert.equal(result.schema_version, '1.0', 'schema_version must be 1.0');
  assert.ok(typeof result.aura_op_id === 'string' && result.aura_op_id.length > 0, 'aura_op_id must be non-empty string');
  assert.ok(typeof result.rollback_cypher === 'string' && result.rollback_cypher.length > 0, 'rollback_cypher must be non-empty string');
  // Three DETACH DELETE statements (one per core node).
  const detachCount = (result.rollback_cypher.match(/DETACH DELETE/g) || []).length;
  assert.equal(detachCount, 3, 'rollback_cypher must contain 3 DETACH DELETE statements, got ' + detachCount);
  assert.equal(driver.runCount, 1, 'driver.session.run must be called exactly once');
  assert.ok(driver.sessionsClosed >= 1, 'driver session must be closed');
}

async function scenario2RealIdempotencyViaDeterministicIds() {
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair();

  // Part A: buildDeterministicIds returns byte-identical ids on repeat calls.
  assert.ok(m._test && m._test.buildDeterministicIds, '_test.buildDeterministicIds must be exposed');
  const ids1 = m._test.buildDeterministicIds(pair);
  const ids2 = m._test.buildDeterministicIds(pair);
  assert.equal(ids1.discovery_id, ids2.discovery_id, 'discovery_id must be byte-identical across calls');
  assert.equal(ids1.rs_id, ids2.rs_id, 'rs_id must be byte-identical across calls');
  assert.equal(ids1.innovation_id, ids2.innovation_id, 'innovation_id must be byte-identical across calls');
  // Sanity: ids should have the prefix scheme from buildDeterministicIds.
  assert.ok(/^rsd-[0-9a-f]{16}$/.test(ids1.discovery_id), 'discovery_id format must be rsd-<16-hex>, got ' + ids1.discovery_id);
  assert.ok(/^rs-[0-9a-f]{16}$/.test(ids1.rs_id), 'rs_id format must be rs-<16-hex>, got ' + ids1.rs_id);
  assert.ok(/^inn-[0-9a-f]{16}$/.test(ids1.innovation_id), 'innovation_id format must be inn-<16-hex>, got ' + ids1.innovation_id);

  // Part B: writeDiscovery invoked twice with same pair; second call inspects
  // params on driver.opLog -- discovery_id, rs_id, innovation_id MUST be identical.
  // Mock driver simulates MERGE-matched on second call (zero new nodes/edges).
  const driver = makeMockDriver({
    firstRunCounters: { nodesCreated: 3, relationshipsCreated: 3 },
    subsequentRunCounters: { nodesCreated: 0, relationshipsCreated: 0 },
  });
  const result1 = await m.writeDiscovery(pair, { driver: driver });
  const result2 = await m.writeDiscovery(pair, { driver: driver });
  captureOpLog('2-idempotency', driver.opLog);

  assert.equal(driver.opLog.length, 2, 'driver must have logged 2 ops, got ' + driver.opLog.length);
  const params1 = driver.opLog[0].params;
  const params2 = driver.opLog[1].params;
  assert.equal(params1.discovery_id, params2.discovery_id, 'discovery_id MUST be identical across calls (real Aura MERGE matches by PRIMARY KEY)');
  assert.equal(params1.rs_id, params2.rs_id, 'rs_id MUST be identical across calls');
  assert.equal(params1.innovation_id, params2.innovation_id, 'innovation_id MUST be identical across calls');
  // Confirm ids match the deterministic helper output.
  assert.equal(params1.discovery_id, ids1.discovery_id, 'params.discovery_id must equal buildDeterministicIds output');

  // Counters reflect MERGE semantics: second call records 0 new nodes/edges.
  assert.equal(result2.wrote_node_count, 0, 'second call wrote_node_count must be 0 (MERGE matched), got ' + result2.wrote_node_count);
  assert.equal(result2.wrote_edge_count, 0, 'second call wrote_edge_count must be 0 (MERGE matched), got ' + result2.wrote_edge_count);

  // aura_op_id is per-op telemetry: random and DIFFERENT across calls.
  assert.notEqual(result1.aura_op_id, result2.aura_op_id, 'aura_op_id must differ across calls (random per-op telemetry, NOT a node id)');
}

async function scenario3FullHappyPathWithContext() {
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair();
  const ctx = makeFullContext();
  const driver = makeMockDriver({ firstRunCounters: { nodesCreated: 6, relationshipsCreated: 6 } });
  const result = await m.writeDiscovery(pair, { driver: driver, context: ctx });
  captureOpLog('3-full-context', driver.opLog);

  assert.equal(result.wrote_node_count, 6, 'wrote_node_count must be 6 (3 core + Paper + Author + Institution), got ' + result.wrote_node_count);
  assert.equal(result.wrote_edge_count, 6, 'wrote_edge_count must be 6, got ' + result.wrote_edge_count);

  // params.paper_author_pairs MUST be constructed from ctx.papers
  const params = driver.opLog[0].params;
  assert.ok(Array.isArray(params.paper_author_pairs), 'paper_author_pairs must be array');
  assert.equal(params.paper_author_pairs.length, 1, 'paper_author_pairs must have 1 entry from 1 paper x 1 author');
  assert.equal(params.paper_author_pairs[0].paper_id, 'openalex:W123');
  assert.equal(params.paper_author_pairs[0].author_key, 'Smith, Jane|0000-0001-2345-6789');
}

async function scenario4AllFiveEdgeTypesIncludingAuthoredByUnwind() {
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair();
  const ctx = makeFullContext();
  const driver = makeMockDriver({ firstRunCounters: { nodesCreated: 6, relationshipsCreated: 6 } });
  await m.writeDiscovery(pair, { driver: driver, context: ctx });
  captureOpLog('4-all-edges', driver.opLog);

  // Walk Cypher op string; assert each edge type present.
  const allCypher = driver.opLog.map(function (op) { return op.cypher; }).join('\n');
  const requiredEdges = ['DISCOVERED', 'DERIVED_FROM', 'ENABLES', 'AUTHORED_BY', 'AFFILIATED_WITH'];
  for (const edge of requiredEdges) {
    assert.ok(allCypher.indexOf(edge) !== -1, 'Cypher must contain edge type ' + edge);
  }
  // AUTHORED_BY must appear in an UNWIND $paper_author_pairs context.
  assert.ok(/UNWIND\s+\$paper_author_pairs/i.test(allCypher), 'Cypher must include UNWIND $paper_author_pairs for AUTHORED_BY edges');
  // paper_author_pairs construction validation (as in Test 3, but cross-checked for path).
  const params = driver.opLog[0].params;
  assert.equal(params.paper_author_pairs[0].author_key, 'Smith, Jane|0000-0001-2345-6789');
}

async function scenario5RollbackCypherCaptured() {
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair();
  const driver = makeMockDriver({ firstRunCounters: { nodesCreated: 3, relationshipsCreated: 3 } });
  const result = await m.writeDiscovery(pair, { driver: driver });
  captureOpLog('5-rollback', driver.opLog);

  assert.ok(typeof result.rollback_cypher === 'string', 'rollback_cypher must be a string');
  assert.ok(result.rollback_cypher.length > 0, 'rollback_cypher must be non-empty');
  // Exactly 3 DETACH DELETE statements (one per core node).
  const detachCount = (result.rollback_cypher.match(/DETACH DELETE/g) || []).length;
  assert.equal(detachCount, 3, 'rollback_cypher must have exactly 3 DETACH DELETE, got ' + detachCount);
  // RSDiscovery + ReverseSalient + Innovation must be the targets.
  assert.ok(/RSDiscovery/.test(result.rollback_cypher), 'rollback must target RSDiscovery');
  assert.ok(/ReverseSalient/.test(result.rollback_cypher), 'rollback must target ReverseSalient');
  assert.ok(/Innovation/.test(result.rollback_cypher), 'rollback must target Innovation');
  // Paper / Author / Institution NOT in rollback (they may be shared).
  assert.ok(!/DETACH DELETE.*Paper/.test(result.rollback_cypher), 'rollback must NOT delete Paper (may be shared)');
  assert.ok(!/DETACH DELETE.*Author/.test(result.rollback_cypher), 'rollback must NOT delete Author (may be shared)');
  assert.ok(!/DETACH DELETE.*Institution/.test(result.rollback_cypher), 'rollback must NOT delete Institution (may be shared)');
}

async function scenario6MissingClassificationThrows() {
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair({ classification: undefined });
  const driver = makeMockDriver({});
  let threw = null;
  try {
    await m.writeDiscovery(pair, { driver: driver });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on missing classification');
  assert.ok(threw instanceof TypeError, 'must throw TypeError, got ' + (threw && threw.name));
  assert.ok(/classification/.test(threw.message), 'error must mention classification, got: ' + threw.message);
  assert.equal(driver.opLog.length, 0, 'mock driver must record ZERO ops on shape error');
}

async function scenario7MissingThesisThrows() {
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair({ thesis: undefined });
  const driver = makeMockDriver({});
  let threw = null;
  try {
    await m.writeDiscovery(pair, { driver: driver });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on missing thesis');
  assert.ok(threw instanceof TypeError, 'must throw TypeError, got ' + (threw && threw.name));
  assert.ok(/thesis/.test(threw.message), 'error must mention thesis, got: ' + threw.message);
  assert.equal(driver.opLog.length, 0, 'mock driver must record ZERO ops on shape error');
}

async function scenario8AuraUnreachableThrows() {
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair();
  const driver = makeMockDriver({ simulateConnectionError: true });
  let threw = null;
  try {
    await m.writeDiscovery(pair, { driver: driver });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on Aura unreachable');
  assert.equal(threw.name, 'AuraUnreachableError', 'must throw AuraUnreachableError, got ' + (threw && threw.name));
  // Must NOT be ExternalEgressViolation -- this is a tier-dispatch signal, not a security violation.
  assert.notEqual(threw.name, 'ExternalEgressViolation', 'must NOT confuse with ExternalEgressViolation');
  assert.ok(threw.meta, 'AuraUnreachableError must carry meta');
  // No captureOpLog -- driver opLog still records the failed run attempt; we don't sweep it.
}

async function scenario9AdvForbiddenInThesis() {
  const m = require('../core/rs-neo4j-writer.cjs');
  // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i.
  const pair = makeCleanPair({
    thesis: 'By applying X to Y, achieve Z because mechanism. Decided in meeting with Genentech.',
  });
  const driver = makeMockDriver({});
  let threw = null;
  try {
    await m.writeDiscovery(pair, { driver: driver });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on forbidden in thesis');
  assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + (threw && threw.name));
  assert.equal(threw.meta.surface, 'rs-neo4j-writer', 'meta.surface must be rs-neo4j-writer');
  assert.ok(threw.meta.matched_pattern, 'meta.matched_pattern must be present');
  assert.equal(driver.opLog.length, 0, 'driver opLog must be empty (audit fires before driver call)');
}

async function scenario10AdvForbiddenInBridgeConcept() {
  const m = require('../core/rs-neo4j-writer.cjs');
  // FORBIDDEN_PATTERNS[2] matches /\b(Lawrence|Jonathan|...)\s+(said|...)\b/i.
  const pair = makeCleanPair({
    bridge_concept: 'Lawrence said this is a cross-domain isomorphism',
  });
  const driver = makeMockDriver({});
  let threw = null;
  try {
    await m.writeDiscovery(pair, { driver: driver });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on forbidden in bridge_concept');
  assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + (threw && threw.name));
  assert.equal(threw.meta.surface, 'rs-neo4j-writer');
  assert.equal(driver.opLog.length, 0, 'driver opLog must be empty');
}

async function scenario11AdvForbiddenInQueryConcept() {
  const m = require('../core/rs-neo4j-writer.cjs');
  // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i.
  const pair = makeCleanPair({
    query_concept: 'shared during meeting with the team',
  });
  const driver = makeMockDriver({});
  let threw = null;
  try {
    await m.writeDiscovery(pair, { driver: driver });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on forbidden in query_concept');
  assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + (threw && threw.name));
  assert.equal(driver.opLog.length, 0, 'driver opLog must be empty');
}

async function scenario12AdvForbiddenInExpertsUnwindInput() {
  // CANON PART 8 strongest UNWIND-input vector: forbidden bytes inside
  // opts.context.experts[0].name. The audit covers JSON.stringify of the
  // entire Cypher params object, including UNWIND $experts input arrays.
  const m = require('../core/rs-neo4j-writer.cjs');
  const pair = makeCleanPair();
  const ctx = {
    papers: [],
    experts: [{
      name: 'Prof Lawrence said this',
      orcid: null,
      institution: 'X University',
      paper_count: 1,
      h_index_estimate: 1,
      public_email_or_null: null,
    }],
    room_id: 'test',
    domain: 'biotech',
  };
  const driver = makeMockDriver({});
  let threw = null;
  try {
    await m.writeDiscovery(pair, { driver: driver, context: ctx });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on forbidden in experts UNWIND input');
  assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + (threw && threw.name));
  assert.equal(threw.meta.surface, 'rs-neo4j-writer');
  assert.equal(driver.opLog.length, 0, 'driver opLog must be empty');
}

// ---------- A1 end-of-suite sweep ----------

function a1Sweep() {
  let hits = 0;
  for (const rec of capturedOpLogs) {
    const json = JSON.stringify(rec.opLog);
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(json)) {
        hits += 1;
        process.stderr.write(
          '  A1 HIT  scenario=' + rec.scenario +
          '  pattern=' + re.source + '\n'
        );
      }
    }
  }
  return hits;
}

// ---------- Main ----------

(async function main() {
  process.stdout.write('=== 89.3-01 rs-neo4j-writer suite (REPO_ROOT=' +
    REPO_ROOT + ') ===\n');

  await runScenario('1-happy-minimal', scenario1HappyPathMinimal);
  await runScenario('2-real-idempotency-deterministic-ids', scenario2RealIdempotencyViaDeterministicIds);
  await runScenario('3-full-happy-with-context', scenario3FullHappyPathWithContext);
  await runScenario('4-all-five-edge-types-AUTHORED_BY-UNWIND', scenario4AllFiveEdgeTypesIncludingAuthoredByUnwind);
  await runScenario('5-rollback-cypher-captured', scenario5RollbackCypherCaptured);
  await runScenario('6-missing-classification-throws', scenario6MissingClassificationThrows);
  await runScenario('7-missing-thesis-throws', scenario7MissingThesisThrows);
  await runScenario('8-aura-unreachable-throws', scenario8AuraUnreachableThrows);
  await runScenario('9-adv-CANON-PART-8-thesis', scenario9AdvForbiddenInThesis);
  await runScenario('10-adv-CANON-PART-8-bridge_concept', scenario10AdvForbiddenInBridgeConcept);
  await runScenario('11-adv-CANON-PART-8-query_concept', scenario11AdvForbiddenInQueryConcept);
  await runScenario('12-adv-CANON-PART-8-experts-UNWIND-input', scenario12AdvForbiddenInExpertsUnwindInput);

  const sweepHits = a1Sweep();
  if (sweepHits > 0) {
    failed += 1;
    failures.push({
      name: 'A1-sweep',
      err: new Error('A1 sweep found ' + sweepHits + ' forbidden-pattern hits'),
    });
    process.stderr.write('  FAIL  A1-sweep (' + sweepHits + ' hits)\n');
  } else {
    process.stdout.write('  ok  A1-sweep (zero forbidden-pattern hits)\n');
  }

  if (failed > 0) {
    process.stdout.write('=== 89.3-01 rs-neo4j-writer suite: ' +
      passed + '/12 passed' +
      ' (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.exit(1);
  }

  process.stdout.write('=== 89.3-01 rs-neo4j-writer suite: 12/12 passed ===\n');
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
