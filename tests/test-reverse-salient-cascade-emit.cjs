/*
 * Phase 89-07-01 Wave 1 -- Cascade-edge emission test suite.
 *
 * Asserts the graph-native HARD RULE invariant 1 (89-07-VALIDATION.md):
 *   "Agent emits >=1 typed cascade edge per finding on user APPROVE."
 *
 * Mocks lib/core/lazygraph-ops.cjs at the require.cache slot so the agent's
 * lazy require sees a fake `upsertEdge` and the test can capture call-shape
 * + edgeType per the RESEARCH SCOPE B Section 2 mapping table.
 *
 * REJECT and DEFER paths are verified to NOT call the typed-edge writer
 * (Wave 2's F.0 dispatcher owns REJECTED_BECAUSE / DEFERRED edges).
 *
 * Style: node:test scaffolding mirrored from tests/test-shape-f0.cjs;
 * pure CJS; node built-ins only; zero new runtime deps.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AGENT_PATH = path.resolve(__dirname, '..', 'lib', 'agents', 'reverse-salient-agent.cjs');
const LAZYGRAPH_PATH = require.resolve('../lib/core/lazygraph-ops.cjs');

// ---------- helpers ----------

function freshAgentWithLazygraphMock(mockExports) {
  // Inject mock at lazygraph-ops require slot so the agent's lazy require
  // returns the fake. The agent's emitFindingEdge calls require() inside
  // the function body (not at module load), so we don't need to clear the
  // agent module from cache for the mock to take effect; we clear anyway
  // to make the tests order-independent.
  require.cache[LAZYGRAPH_PATH] = {
    exports: mockExports,
    id: LAZYGRAPH_PATH,
    filename: LAZYGRAPH_PATH,
    loaded: true,
    children: [],
    paths: [],
  };
  delete require.cache[AGENT_PATH];
  return require(AGENT_PATH);
}

function restoreCache() {
  delete require.cache[LAZYGRAPH_PATH];
  delete require.cache[AGENT_PATH];
}

function makeFinding(direction, signed_diff, abs_diff) {
  return {
    id: 'test-finding-' + direction + '-' + signed_diff,
    source_artifact_id: 'art:source',
    target_artifact_id: 'art:target',
    direction,
    signed_diff,
    abs_diff: (typeof abs_diff === 'number') ? abs_diff : Math.abs(signed_diff),
    body_text: 'mock body text',
    brain_chain_text: '',
  };
}

function makeMock() {
  const calls = [];
  const mock = {
    upsertEdge: (db, edge) => { calls.push({ db, edge }); return { ok: true }; },
    EDGE_TYPES: ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'INVALIDATES', 'ENABLES'],
  };
  return { calls, mock };
}

// ---------- Mapping table tests (RESEARCH SCOPE B Section 2) ----------

test('cascade-emit: structural_transfer + 0.5 -> INFORMS', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('structural_transfer', 0.5), 'APPROVE');
  assert.equal(result.ok, true);
  assert.equal(result.edgeType, 'INFORMS');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].edge.type, 'INFORMS');
  assert.equal(calls[0].edge.source, 'art:source');
  assert.equal(calls[0].edge.target, 'art:target');
  assert.equal(calls[0].edge.properties.source, 'rs-engine');
  assert.equal(calls[0].edge.properties.agent, 'reverse-salient');
  assert.equal(calls[0].edge.properties.signed_diff, 0.5);
  restoreCache();
});

test('cascade-emit: structural_transfer + 0.8 -> ENABLES', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('structural_transfer', 0.8), 'APPROVE');
  assert.equal(result.edgeType, 'ENABLES');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].edge.type, 'ENABLES');
  restoreCache();
});

test('cascade-emit: semantic_implementation + -0.5 -> CONVERGES', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('semantic_implementation', -0.5), 'APPROVE');
  assert.equal(result.edgeType, 'CONVERGES');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].edge.type, 'CONVERGES');
  restoreCache();
});

test('cascade-emit: semantic_implementation + -0.8 -> INVALIDATES', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('semantic_implementation', -0.8), 'APPROVE');
  assert.equal(result.edgeType, 'INVALIDATES');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].edge.type, 'INVALIDATES');
  restoreCache();
});

test('cascade-emit: whitespace -> CONTRADICTS', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('whitespace', 0, 0.0), 'APPROVE');
  assert.equal(result.edgeType, 'CONTRADICTS');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].edge.type, 'CONTRADICTS');
  restoreCache();
});

test('cascade-emit: blindspot -> CONTRADICTS', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('blindspot', 0, 0.0), 'APPROVE');
  assert.equal(result.edgeType, 'CONTRADICTS');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].edge.type, 'CONTRADICTS');
  restoreCache();
});

test('cascade-emit: unknown direction -> INFORMS (Pitfall 1 default)', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('forward_compat_new_direction', 0.5), 'APPROVE');
  assert.equal(result.edgeType, 'INFORMS');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].edge.type, 'INFORMS');
  restoreCache();
});

// ---------- Skip-path tests (REJECT + DEFER handled by Wave 2 F.0 dispatcher) ----------

test('cascade-emit: REJECT skips edge write (F.0 dispatcher handles)', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('structural_transfer', 0.5), 'REJECT');
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'rejected_handled_by_f0_dispatcher');
  assert.equal(calls.length, 0);
  restoreCache();
});

test('cascade-emit: DEFER skips edge write (F.0 dispatcher handles)', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('structural_transfer', 0.5), 'DEFER');
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'deferred_handled_by_f0_dispatcher');
  assert.equal(calls.length, 0);
  restoreCache();
});

test('cascade-emit: unknown response is skipped without crashing', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const result = agent.emitFindingEdge({}, makeFinding('structural_transfer', 0.5), 'WAT');
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'unknown_response_skipped');
  assert.equal(calls.length, 0);
  restoreCache();
});

// ---------- Idempotency: double-fire APPROVE writes twice with same finding_id ----------

test('cascade-emit: double-APPROVE invokes upsertEdge twice (idempotency owned by writer UPSERT)', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const finding = makeFinding('structural_transfer', 0.5);
  agent.emitFindingEdge({}, finding, 'APPROVE');
  agent.emitFindingEdge({}, finding, 'APPROVE');
  assert.equal(calls.length, 2, 'agent fires every APPROVE -- writer UPSERT semantics handle idempotency');
  assert.equal(calls[0].edge.properties.finding_id, calls[1].edge.properties.finding_id);
  restoreCache();
});

// ---------- GRAPH-NATIVE INVARIANT 1: at least 1 cascade edge per APPROVE finding ----------

test('GRAPH-NATIVE INVARIANT 1: every APPROVE produces exactly 1 cascade-edge call', () => {
  const { calls, mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const directions = [
    ['structural_transfer', 0.5],     // -> INFORMS
    ['structural_transfer', 0.8],     // -> ENABLES
    ['semantic_implementation', -0.5],// -> CONVERGES
    ['semantic_implementation', -0.8],// -> INVALIDATES
    ['whitespace', 0],                 // -> CONTRADICTS
    ['unknown_string', 0.5],           // -> INFORMS (Pitfall 1)
  ];
  directions.forEach(([d, sd]) => agent.emitFindingEdge({}, makeFinding(d, sd), 'APPROVE'));
  assert.equal(calls.length, directions.length, 'every APPROVE must produce exactly 1 edge call');
  // All 5 cascade types must appear at least once across the test set.
  const types = new Set(calls.map((c) => c.edge.type));
  for (const t of ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'INVALIDATES', 'ENABLES']) {
    assert.ok(types.has(t), 'cascade type missing from emission set: ' + t);
  }
  restoreCache();
});

// ---------- ANTI-PATTERN: agent prints findings without writing typed edges is impossible ----------

test('ANTI-PATTERN GUARD: emitFindingEdge always returns either ok:true+edgeType or skipped:true', () => {
  const { mock } = makeMock();
  const agent = freshAgentWithLazygraphMock(mock);
  const cases = [
    ['structural_transfer', 0.5, 'APPROVE'],
    ['structural_transfer', 0.5, 'REJECT'],
    ['structural_transfer', 0.5, 'DEFER'],
    ['semantic_implementation', -0.8, 'APPROVE'],
    ['whitespace', 0, 'APPROVE'],
  ];
  for (const [d, sd, resp] of cases) {
    const result = agent.emitFindingEdge({}, makeFinding(d, sd), resp);
    if (resp === 'APPROVE') {
      assert.equal(result.ok, true);
      assert.ok(typeof result.edgeType === 'string');
    } else {
      assert.equal(result.skipped, true);
      assert.ok(typeof result.reason === 'string');
    }
  }
  restoreCache();
});

// ---------- 0 em-dashes (CLAUDE.md hard rule) ----------

test('cascade-emit test source contains 0 em-dashes (no_emdashes hard rule)', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__filename, 'utf8');
  const EMDASH = String.fromCharCode(0x2014);
  assert.equal(src.includes(EMDASH), false, 'em-dash forbidden (memory feedback_no_emdashes)');
});
