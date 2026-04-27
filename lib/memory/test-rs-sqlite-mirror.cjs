#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 02 -- SQLite mirror writer fixture suite.
 *
 * writeDiscovery(pair, opts) is the Tier 0 (Aura-unavailable) writer in the
 * dual-tier output layer. Mirrors the rs-neo4j-writer.cjs (Plan 89.3-01)
 * public API surface byte-for-byte so callers swap backends transparently.
 *
 * Schema parity (per kickoff section 5):
 *   Nodes: RSDiscovery + ReverseSalient + Innovation + Paper + Author + Institution
 *   Edges: DISCOVERED + DERIVED_FROM + ENABLES + AUTHORED_BY + AFFILIATED_WITH
 *
 * REAL idempotency in SQLite via INSERT OR REPLACE on the id PRIMARY KEY:
 * the 3 core node ids (discovery_id, rs_id, innovation_id) are derived
 * sha256 over {query_concept, doc_concept, classification}. Same pair
 * always produces same ids; INSERT OR REPLACE matches existing rows;
 * SELECT COUNT before vs after re-run = same number.
 *
 * 12 scenarios + A1 sweep:
 *   1  Happy path (minimal pair, no opts.context)
 *   2  REAL idempotency via INSERT OR REPLACE (re-run yields zero new rows)
 *   3  Full happy path with opts.context (papers + experts)
 *   4  All 5 edge types written (DISCOVERED + DERIVED_FROM + ENABLES + AUTHORED_BY + AFFILIATED_WITH)
 *   5  Rollback SQL captured + valid (3 DELETE FROM nodes + edges-first DELETE)
 *   6  Missing classification throws TypeError
 *   7  Missing thesis throws TypeError
 *   8  room.db missing or unwritable throws SQLiteUnreachableError
 *   9  CANON PART 8 adversarial -- forbidden in pair.thesis
 *   10 CANON PART 8 adversarial -- forbidden in pair.bridge_concept
 *   11 CANON PART 8 adversarial -- forbidden in pair.query_concept
 *   12 CANON PART 8 adversarial -- forbidden smuggled via opts.context.experts[0].institution
 *
 * End-of-suite sweep:
 *   A1: SELECT every row from the test room.db (nodes + edges) JSON.stringify
 *       and scan against FORBIDDEN_PATTERNS. Asserts zero hits across the
 *       FINAL state of the database after all 12 scenarios. (Throw scenarios
 *       verify zero rows added at the time; A1 verifies no smuggled bytes
 *       anywhere in final state.)
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, fs, path, os, crypto).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Source of truth for parity gate.
const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;

// Lazy-required (so RED commit can prove module-not-found).
const lazygraph = require('../core/lazygraph-ops.cjs');

// Track every tmp room dir for cleanup + final A1 sweep target.
const tmpRooms = [];

let passed = 0;
let failed = 0;
const failures = [];

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/rs-sqlite-mirror.cjs',
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

// ---------- Tmp room helper ----------
//
// Creates a fresh tmp room dir at os.tmpdir() with a UUID suffix. The
// rs-sqlite-mirror writer calls lazygraph.openGraph(roomDir), which
// creates room/.mindrian/room.db on demand and runs initSchema. We do
// NOT pre-create room.db here; the writer must handle the creation.
//
// Returns {roomDir, cleanup} where cleanup() removes the entire tmp
// subtree. Caller MUST call cleanup() in finally even on assertion error.

function makeTmpRoom() {
  const slug = crypto.randomUUID();
  const roomDir = path.join(os.tmpdir(), 'mos-89-3-02-' + slug);
  fs.mkdirSync(roomDir, { recursive: true });
  tmpRooms.push(roomDir);
  return {
    roomDir: roomDir,
    cleanup: function () {
      try {
        fs.rmSync(roomDir, { recursive: true, force: true });
      } catch (_e) { /* best effort */ }
    },
  };
}

// SELECT helpers run against an open connection. Caller responsible for
// open/close.

async function countNodes(roomDir) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    const row = handle.conn.prepare('SELECT COUNT(*) AS n FROM nodes').get();
    return row.n;
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
}

async function countEdges(roomDir) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    const row = handle.conn.prepare('SELECT COUNT(*) AS n FROM edges').get();
    return row.n;
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
}

async function selectAllNodes(roomDir) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    return handle.conn.prepare('SELECT id, type, properties FROM nodes').all();
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
}

async function selectAllEdges(roomDir) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    return handle.conn.prepare('SELECT source, target, type, properties FROM edges').all();
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
}

async function selectDistinctEdgeTypes(roomDir) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    return handle.conn.prepare('SELECT DISTINCT type FROM edges').all().map(function (r) { return r.type; });
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
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

// Final-state sweep target. The single shared room used by Tests 1, 2, 3,
// 4, 5 (happy paths). Throw scenarios use their own fresh tmp rooms so
// the assertion zero-rows-added is unambiguous.
let SHARED_ROOM = null;

// ---------- Scenarios ----------

async function scenario1HappyPathMinimal() {
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  SHARED_ROOM = tmp;
  try {
    const pair = makeCleanPair();
    const result = await m.writeDiscovery(pair, { roomDir: tmp.roomDir });

    assert.equal(result.wrote_node_count, 3, 'wrote_node_count must be 3, got ' + result.wrote_node_count);
    assert.equal(result.wrote_edge_count, 3, 'wrote_edge_count must be 3, got ' + result.wrote_edge_count);
    assert.equal(result.schema_version, '1.0', 'schema_version must be 1.0');
    assert.ok(typeof result.aura_op_id === 'string' && result.aura_op_id.length > 0, 'aura_op_id must be non-empty string');
    assert.ok(typeof result.rollback_cypher === 'string' && result.rollback_cypher.length > 0, 'rollback_cypher must be non-empty string');
    // Verify SQL DELETE statements (NOT Cypher DETACH DELETE).
    assert.ok(/DELETE FROM nodes/.test(result.rollback_cypher), 'rollback_cypher must contain DELETE FROM nodes');
    assert.ok(/DELETE FROM edges/.test(result.rollback_cypher), 'rollback_cypher must contain DELETE FROM edges');
    // SELECT verification: 3 nodes + 3 edges in the room.
    assert.equal(await countNodes(tmp.roomDir), 3, 'room.db must have 3 nodes after happy path');
    assert.equal(await countEdges(tmp.roomDir), 3, 'room.db must have 3 edges after happy path');
  } catch (err) {
    tmp.cleanup();
    SHARED_ROOM = null;
    throw err;
  }
  // Do NOT cleanup the SHARED_ROOM here -- Tests 2, 3, 4, 5 reuse it.
  // Cleanup happens in main() after A1 sweep.
}

async function scenario2RealIdempotencyViaInsertOrReplace() {
  // Reuses SHARED_ROOM from Test 1 (3 nodes + 3 edges already present).
  assert.ok(SHARED_ROOM, 'SHARED_ROOM must be initialized by Test 1');
  const m = require('../core/rs-sqlite-mirror.cjs');

  // Part A: buildDeterministicIds returns byte-identical ids on repeat calls
  // AND matches the format from Plan 89.3-01 (rsd-/rs-/inn- + 16-hex).
  assert.ok(m._test && m._test.buildDeterministicIds, '_test.buildDeterministicIds must be exposed');
  const pair = makeCleanPair();
  const ids1 = m._test.buildDeterministicIds(pair);
  const ids2 = m._test.buildDeterministicIds(pair);
  assert.equal(ids1.discovery_id, ids2.discovery_id, 'discovery_id must be byte-identical across calls');
  assert.equal(ids1.rs_id, ids2.rs_id, 'rs_id must be byte-identical across calls');
  assert.equal(ids1.innovation_id, ids2.innovation_id, 'innovation_id must be byte-identical across calls');
  assert.ok(/^rsd-[0-9a-f]{16}$/.test(ids1.discovery_id), 'discovery_id format must be rsd-<16-hex>, got ' + ids1.discovery_id);
  assert.ok(/^rs-[0-9a-f]{16}$/.test(ids1.rs_id), 'rs_id format must be rs-<16-hex>, got ' + ids1.rs_id);
  assert.ok(/^inn-[0-9a-f]{16}$/.test(ids1.innovation_id), 'innovation_id format must be inn-<16-hex>, got ' + ids1.innovation_id);

  // Part B: REAL SQLite idempotency via INSERT OR REPLACE on PRIMARY KEY.
  // Re-run writeDiscovery with same pair on SHARED_ROOM (already has 3 nodes
  // + 3 edges). After re-run: still 3 nodes + 3 edges. wrote_node_count = 0.
  const beforeNodes = await countNodes(SHARED_ROOM.roomDir);
  const beforeEdges = await countEdges(SHARED_ROOM.roomDir);
  assert.equal(beforeNodes, 3, 'before re-run: room.db must have 3 nodes');
  assert.equal(beforeEdges, 3, 'before re-run: room.db must have 3 edges');

  const result = await m.writeDiscovery(pair, { roomDir: SHARED_ROOM.roomDir });

  const afterNodes = await countNodes(SHARED_ROOM.roomDir);
  const afterEdges = await countEdges(SHARED_ROOM.roomDir);
  assert.equal(afterNodes, 3, 'AFTER re-run: room.db must STILL have 3 nodes (INSERT OR REPLACE matched on PRIMARY KEY)');
  assert.equal(afterEdges, 3, 'AFTER re-run: room.db must STILL have 3 edges');
  assert.equal(result.wrote_node_count, 0, 'second call wrote_node_count must be 0 (zero new rows), got ' + result.wrote_node_count);
  assert.equal(result.wrote_edge_count, 0, 'second call wrote_edge_count must be 0, got ' + result.wrote_edge_count);
  // aura_op_id is per-op telemetry: random and DIFFERENT across calls.
  // (Compare against fresh writeDiscovery call to prove non-determinism.)
  const result2 = await m.writeDiscovery(pair, { roomDir: SHARED_ROOM.roomDir });
  assert.notEqual(result.aura_op_id, result2.aura_op_id, 'aura_op_id must differ across calls (random per-op telemetry)');
}

async function scenario3FullHappyPathWithContext() {
  // Use a FRESH room so the count assertions are unambiguous (Test 1's
  // SHARED_ROOM has minimal pair already; mixing would muddy the count).
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    const pair = makeCleanPair();
    const ctx = makeFullContext();
    const result = await m.writeDiscovery(pair, { roomDir: tmp.roomDir, context: ctx });

    assert.equal(result.wrote_node_count, 6, 'wrote_node_count must be 6 (3 core + Paper + Author + Institution), got ' + result.wrote_node_count);
    assert.equal(result.wrote_edge_count, 6, 'wrote_edge_count must be 6, got ' + result.wrote_edge_count);

    // Verify the 6 nodes via SELECT.
    const nodes = await selectAllNodes(tmp.roomDir);
    assert.equal(nodes.length, 6, 'SELECT must return 6 nodes');
    const types = nodes.map(function (n) { return n.type; }).sort();
    // Expected types (sorted): Author, Innovation, Institution, Paper, RSDiscovery, ReverseSalient
    const expectedTypes = ['Author', 'Innovation', 'Institution', 'Paper', 'RSDiscovery', 'ReverseSalient'];
    assert.deepEqual(types, expectedTypes, 'node types must include all 6 expected: ' + JSON.stringify(types));
  } finally {
    // Do NOT cleanup yet -- Test 4 reuses this assertion pattern but on its own room.
    // Final cleanup in main().
  }
}

async function scenario4AllFiveEdgeTypesWritten() {
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    const pair = makeCleanPair();
    const ctx = makeFullContext();
    await m.writeDiscovery(pair, { roomDir: tmp.roomDir, context: ctx });

    const distinctTypes = await selectDistinctEdgeTypes(tmp.roomDir);
    const expected = ['DISCOVERED', 'DERIVED_FROM', 'ENABLES', 'AUTHORED_BY', 'AFFILIATED_WITH'];
    for (const e of expected) {
      assert.ok(distinctTypes.indexOf(e) !== -1, 'distinct edge types must include ' + e + '; got: ' + JSON.stringify(distinctTypes));
    }
    // Strict: 5 of 5 expected types present.
    let hits = 0;
    for (const e of expected) if (distinctTypes.indexOf(e) !== -1) hits += 1;
    assert.equal(hits, 5, 'all 5 edge types must be present, got ' + hits);
  } finally {
    // No cleanup -- final A1 sweep covers all tmp rooms.
  }
}

async function scenario5RollbackSqlCaptured() {
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    const pair = makeCleanPair();
    const result = await m.writeDiscovery(pair, { roomDir: tmp.roomDir });

    assert.ok(typeof result.rollback_cypher === 'string', 'rollback_cypher must be a string');
    assert.ok(result.rollback_cypher.length > 0, 'rollback_cypher must be non-empty');
    // Exactly 3 'DELETE FROM nodes WHERE id =' statements.
    const nodeDeleteCount = (result.rollback_cypher.match(/DELETE FROM nodes WHERE id =/g) || []).length;
    assert.equal(nodeDeleteCount, 3, 'rollback_cypher must have exactly 3 DELETE FROM nodes WHERE id = statements, got ' + nodeDeleteCount);
    // At least 3 'DELETE FROM edges WHERE source =' statements.
    const edgeDeleteCount = (result.rollback_cypher.match(/DELETE FROM edges WHERE source =/g) || []).length;
    assert.ok(edgeDeleteCount >= 3, 'rollback_cypher must have >= 3 DELETE FROM edges statements, got ' + edgeDeleteCount);
    // Edges-first ordering: first DELETE FROM edges position must be < first DELETE FROM nodes position.
    const firstEdgeDel = result.rollback_cypher.indexOf('DELETE FROM edges');
    const firstNodeDel = result.rollback_cypher.indexOf('DELETE FROM nodes');
    assert.ok(firstEdgeDel !== -1 && firstNodeDel !== -1, 'both DELETE positions must exist');
    assert.ok(firstEdgeDel < firstNodeDel, 'edges DELETEs must come BEFORE nodes DELETEs (FK safety)');
  } finally {
    // No cleanup -- final A1 sweep.
  }
}

async function scenario6MissingClassificationThrows() {
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    const pair = makeCleanPair({ classification: undefined });
    const beforeN = await countNodes(tmp.roomDir);
    const beforeE = await countEdges(tmp.roomDir);
    let threw = null;
    try {
      await m.writeDiscovery(pair, { roomDir: tmp.roomDir });
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, 'must throw on missing classification');
    assert.ok(threw instanceof TypeError, 'must throw TypeError, got ' + (threw && threw.name));
    assert.ok(/classification/.test(threw.message), 'error must mention classification, got: ' + threw.message);
    const afterN = await countNodes(tmp.roomDir);
    const afterE = await countEdges(tmp.roomDir);
    assert.equal(afterN, beforeN, 'no new nodes added on shape error');
    assert.equal(afterE, beforeE, 'no new edges added on shape error');
  } finally {
    tmp.cleanup();
  }
}

async function scenario7MissingThesisThrows() {
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    const pair = makeCleanPair({ thesis: undefined });
    const beforeN = await countNodes(tmp.roomDir);
    let threw = null;
    try {
      await m.writeDiscovery(pair, { roomDir: tmp.roomDir });
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, 'must throw on missing thesis');
    assert.ok(threw instanceof TypeError, 'must throw TypeError, got ' + (threw && threw.name));
    assert.ok(/thesis/.test(threw.message), 'error must mention thesis, got: ' + threw.message);
    const afterN = await countNodes(tmp.roomDir);
    assert.equal(afterN, beforeN, 'no new nodes added on shape error');
  } finally {
    tmp.cleanup();
  }
}

async function scenario8RoomDbUnreachableThrows() {
  // CANON: opts.roomDir = path that cannot be created (parent is a file,
  // not a directory). On Linux, creating /dev/null/anything fails because
  // /dev/null is not a directory.
  const m = require('../core/rs-sqlite-mirror.cjs');
  const unwritable = path.join('/dev/null', 'mos-89-3-02-impossible-' + crypto.randomUUID());
  const pair = makeCleanPair();
  let threw = null;
  try {
    await m.writeDiscovery(pair, { roomDir: unwritable });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on room.db unreachable');
  assert.equal(threw.name, 'SQLiteUnreachableError', 'must throw SQLiteUnreachableError, got ' + (threw && threw.name));
  // Must NOT be ExternalEgressViolation -- this is a tier-dispatch signal.
  assert.notEqual(threw.name, 'ExternalEgressViolation', 'must NOT confuse with ExternalEgressViolation');
  assert.ok(threw.meta, 'SQLiteUnreachableError must carry meta');
}

async function scenario9AdvForbiddenInThesis() {
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i.
    const pair = makeCleanPair({
      thesis: 'By applying X to Y, achieve Z because mechanism. Decided in meeting with Genentech.',
    });
    const beforeN = await countNodes(tmp.roomDir);
    let threw = null;
    try {
      await m.writeDiscovery(pair, { roomDir: tmp.roomDir });
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, 'must throw on forbidden in thesis');
    assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + (threw && threw.name));
    assert.equal(threw.meta.surface, 'rs-sqlite-mirror', 'meta.surface must be rs-sqlite-mirror');
    assert.ok(threw.meta.matched_pattern, 'meta.matched_pattern must be present');
    const afterN = await countNodes(tmp.roomDir);
    assert.equal(afterN, beforeN, 'no rows added (audit fires before SQLite write)');
  } finally {
    tmp.cleanup();
  }
}

async function scenario10AdvForbiddenInBridgeConcept() {
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    // FORBIDDEN_PATTERNS[2] matches /\b(Lawrence|Jonathan|...)\s+(said|...)\b/i.
    const pair = makeCleanPair({
      bridge_concept: 'Lawrence said this is a cross-domain isomorphism',
    });
    const beforeN = await countNodes(tmp.roomDir);
    let threw = null;
    try {
      await m.writeDiscovery(pair, { roomDir: tmp.roomDir });
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, 'must throw on forbidden in bridge_concept');
    assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + (threw && threw.name));
    assert.equal(threw.meta.surface, 'rs-sqlite-mirror');
    const afterN = await countNodes(tmp.roomDir);
    assert.equal(afterN, beforeN, 'no rows added on adversarial input');
  } finally {
    tmp.cleanup();
  }
}

async function scenario11AdvForbiddenInQueryConcept() {
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i.
    const pair = makeCleanPair({
      query_concept: 'shared during meeting with the team',
    });
    const beforeN = await countNodes(tmp.roomDir);
    let threw = null;
    try {
      await m.writeDiscovery(pair, { roomDir: tmp.roomDir });
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, 'must throw on forbidden in query_concept');
    assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + (threw && threw.name));
    assert.equal(threw.meta.surface, 'rs-sqlite-mirror');
    const afterN = await countNodes(tmp.roomDir);
    assert.equal(afterN, beforeN, 'no rows added on adversarial input');
  } finally {
    tmp.cleanup();
  }
}

async function scenario12AdvForbiddenSmuggledViaExpertsInstitution() {
  // CANON PART 8 strongest smuggling vector: forbidden bytes inside
  // opts.context.experts[0].institution. The audit covers JSON.stringify
  // of the entire SQL params object, including UNWIND $experts arrays.
  const m = require('../core/rs-sqlite-mirror.cjs');
  const tmp = makeTmpRoom();
  try {
    const pair = makeCleanPair();
    const ctx = {
      papers: [],
      experts: [{
        name: 'Smith, Jane',
        orcid: '0000-0001-2345-6789',
        // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i.
        institution: 'noted during meeting with X University',
        paper_count: 1,
        h_index_estimate: 1,
        public_email_or_null: null,
      }],
      room_id: 'test',
      domain: 'biotech',
    };
    const beforeN = await countNodes(tmp.roomDir);
    let threw = null;
    try {
      await m.writeDiscovery(pair, { roomDir: tmp.roomDir, context: ctx });
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, 'must throw on forbidden in experts[].institution');
    assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + (threw && threw.name));
    assert.equal(threw.meta.surface, 'rs-sqlite-mirror');
    const afterN = await countNodes(tmp.roomDir);
    assert.equal(afterN, beforeN, 'no rows added on adversarial UNWIND input');
  } finally {
    tmp.cleanup();
  }
}

// ---------- A1 end-of-suite sweep ----------
//
// SELECT every row from every tmp room.db; JSON.stringify the rows; scan
// against FORBIDDEN_PATTERNS. Asserts ZERO hits across the FINAL state of
// every database after all 12 scenarios.

async function a1Sweep() {
  let hits = 0;
  for (const roomDir of tmpRooms) {
    if (!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db'))) continue;
    let nodes, edges;
    try {
      nodes = await selectAllNodes(roomDir);
      edges = await selectAllEdges(roomDir);
    } catch (_e) {
      // Room may have been cleaned up; skip.
      continue;
    }
    const json = JSON.stringify({ nodes: nodes, edges: edges });
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(json)) {
        hits += 1;
        process.stderr.write(
          '  A1 HIT  roomDir=' + roomDir +
          '  pattern=' + re.source + '\n'
        );
      }
    }
  }
  return hits;
}

// ---------- Cleanup all tmp rooms ----------

function cleanupAllTmpRooms() {
  for (const roomDir of tmpRooms) {
    try {
      fs.rmSync(roomDir, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
}

// ---------- Main ----------

(async function main() {
  process.stdout.write('=== 89.3-02 rs-sqlite-mirror suite (REPO_ROOT=' +
    REPO_ROOT + ') ===\n');

  await runScenario('1-happy-minimal', scenario1HappyPathMinimal);
  await runScenario('2-real-idempotency-INSERT-OR-REPLACE', scenario2RealIdempotencyViaInsertOrReplace);
  await runScenario('3-full-happy-with-context', scenario3FullHappyPathWithContext);
  await runScenario('4-all-five-edge-types', scenario4AllFiveEdgeTypesWritten);
  await runScenario('5-rollback-sql-captured', scenario5RollbackSqlCaptured);
  await runScenario('6-missing-classification-throws', scenario6MissingClassificationThrows);
  await runScenario('7-missing-thesis-throws', scenario7MissingThesisThrows);
  await runScenario('8-room-db-unreachable-throws', scenario8RoomDbUnreachableThrows);
  await runScenario('9-adv-CANON-PART-8-thesis', scenario9AdvForbiddenInThesis);
  await runScenario('10-adv-CANON-PART-8-bridge_concept', scenario10AdvForbiddenInBridgeConcept);
  await runScenario('11-adv-CANON-PART-8-query_concept', scenario11AdvForbiddenInQueryConcept);
  await runScenario('12-adv-CANON-PART-8-experts-institution-smuggling', scenario12AdvForbiddenSmuggledViaExpertsInstitution);

  const sweepHits = await a1Sweep();
  if (sweepHits > 0) {
    failed += 1;
    failures.push({
      name: 'A1-sweep',
      err: new Error('A1 sweep found ' + sweepHits + ' forbidden-pattern hits in room.db final state'),
    });
    process.stderr.write('  FAIL  A1-sweep (' + sweepHits + ' hits)\n');
  } else {
    process.stdout.write('  ok  A1-sweep (zero forbidden-pattern hits in room.db final state)\n');
  }

  cleanupAllTmpRooms();

  if (failed > 0) {
    process.stdout.write('=== 89.3-02 rs-sqlite-mirror suite: ' +
      passed + '/12 passed' +
      ' (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.exit(1);
  }

  process.stdout.write('=== 89.3-02 rs-sqlite-mirror suite: 12/12 passed ===\n');
  process.exit(0);
})().catch(function (err) {
  cleanupAllTmpRooms();
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
