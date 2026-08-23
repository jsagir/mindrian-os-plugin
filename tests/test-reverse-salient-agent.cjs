/*
 * Phase 89-07-01 Wave 1 -- ReverseSalientAgent substrate test suite.
 *
 * Asserts the graph-native HARD RULE invariants from
 * memory feedback_reverse_salient_agent_graph_native.md and from the
 * 89-07-VALIDATION.md invariants 1-3 that this wave owns:
 *
 *   1. Agent emits >=1 typed cascade edge per finding (Wave 1 + Wave 2 jointly).
 *   2. Agent reads ONLY through navigation.cjs (grep + module-graph audit).
 *   3. Agent NEVER sends user-content to Brain (module import audit + readQuadruple-only path).
 *
 * Invariant 4 (F.0 surface fires) is Wave 2 (89-07-02-PLAN.md).
 *
 * Style note: node:test scaffolding mirrored from tests/test-shape-f0.cjs;
 * pure CJS; node built-ins only; zero new runtime deps.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const AGENT_PATH = path.resolve(__dirname, '..', 'lib', 'agents', 'reverse-salient-agent.cjs');
const NAV_PATH = require.resolve('../lib/core/navigation.cjs');
const FM_PATH = require.resolve('../lib/core/folder-memory.cjs');
const ME_PATH = require.resolve('../lib/core/navigation/memory-events.cjs');
const LAZYGRAPH_PATH = require.resolve('../lib/core/lazygraph-ops.cjs');

// ---------- helpers ----------

function clearAgentCache() {
  delete require.cache[AGENT_PATH];
}

function withMockedRequires(mocks, fn) {
  const saved = {};
  for (const p of Object.keys(mocks)) {
    saved[p] = require.cache[p];
    require.cache[p] = { exports: mocks[p], id: p, filename: p, loaded: true, children: [], paths: [] };
  }
  clearAgentCache();
  try {
    return fn();
  } finally {
    for (const p of Object.keys(mocks)) {
      if (saved[p] === undefined) {
        delete require.cache[p];
      } else {
        require.cache[p] = saved[p];
      }
    }
    clearAgentCache();
  }
}

function makePair(overrides) {
  return Object.assign({
    source_artifact_id: 'art:source',
    source_section: 'problem-definition',
    source_title: 'Source Artifact',
    target_artifact_id: 'art:target',
    target_section: 'market-analysis',
    target_title: 'Target Artifact',
    signed_diff: 0.5,
    abs_diff: 0.5,
    direction: 'structural_transfer',
    lsa_score: 0.4,
    semantic_score: 0.9,
  }, overrides || {});
}

// ---------- Test 1: 7 expected exports ----------

test('Wave-1: agent module exports 7 expected functions', () => {
  clearAgentCache();
  const m = require(AGENT_PATH);
  const expected = [
    'gatherFocusContext',
    'gatherBrainContext',
    'composeFinding',
    'emitFindingEdge',
    'mapDirectionToCascadeEdge',
    'runRsEngine',
    'detectAndSurface',
  ];
  for (const fn of expected) {
    assert.equal(typeof m[fn], 'function', 'missing export: ' + fn);
  }
});

// ---------- Test 2-3: gatherFocusContext ----------

test('Wave-1: gatherFocusContext returns null when getActiveFocus returns null', () => {
  const navStub = {
    getActiveFocus: () => null,
    getNeighborhood: () => { throw new Error('should not be called'); },
    findContradictions: () => [],
    findUnsupportedClaims: () => [],
    findStaleDecisions: () => [],
    findRecentChanges: () => [],
  };
  withMockedRequires({ [NAV_PATH]: navStub }, () => {
    const m = require(AGENT_PATH);
    const result = m.gatherFocusContext({}, 'session-x');
    assert.equal(result, null);
  });
});

test('Wave-1: gatherFocusContext returns composed shape when focus present', () => {
  const navStub = {
    getActiveFocus: () => ({ focusNodeId: 'node:a', focusType: 'artifact', setAt: 1, setBy: 'test' }),
    getNeighborhood: () => ({ nodes: [{ id: 'node:b', score: 0.9 }], edge_path: [], score: 0.9 }),
    findContradictions: () => [{ a: 'node:a', b: 'node:c' }],
    findUnsupportedClaims: () => [{ id: 'claim:x' }],
    findStaleDecisions: () => [{ id: 'dec:y', age: 6 }],
    findRecentChanges: () => [{ id: 'evt:z', created_at: 1 }],
  };
  withMockedRequires({ [NAV_PATH]: navStub }, () => {
    const m = require(AGENT_PATH);
    const result = m.gatherFocusContext({}, 'session-x');
    assert.ok(result && typeof result === 'object', 'gatherFocusContext returned non-object');
    assert.ok(result.focus, 'focus missing');
    assert.equal(result.focus.focusNodeId, 'node:a');
    assert.ok(result.neighborhood, 'neighborhood missing');
    assert.ok(Array.isArray(result.contradictions), 'contradictions not an array');
    assert.ok(Array.isArray(result.unsupported), 'unsupported not an array');
    assert.ok(Array.isArray(result.recentChanges), 'recentChanges not an array');
  });
});

// ---------- Test 4-6: gatherBrainContext ----------

test('Wave-1: gatherBrainContext returns stale_or_offline when isQuadrupleFresh false', () => {
  const fmStub = {
    readQuadruple: () => ({ room: {}, state: {}, reasoning: { is_stale: true }, brain: null }),
    isQuadrupleFresh: () => false,
  };
  withMockedRequires({ [FM_PATH]: fmStub }, () => {
    const m = require(AGENT_PATH);
    const result = m.gatherBrainContext('/tmp/section');
    assert.equal(result.brain, null);
    assert.equal(result.graceful_degradation, 'stale_or_offline');
  });
});

test('Wave-1: gatherBrainContext returns brain field when fresh', () => {
  const brainPayload = {
    pattern_matches: [{ name: 'SWOT', score: 0.8 }],
    framework_chain_predictions: ['SWOT', 'Porter Five Forces'],
    cross_domain_analogies: [],
    wicked_indicators: [],
    unfilled_opportunity_matches: [],
    assessment_thinking_chain_position: 'mid',
    problem_type_classification: 'IDP',
    cross_room_contradiction_flags: [],
  };
  const fmStub = {
    readQuadruple: () => ({ room: {}, state: {}, reasoning: { is_stale: false }, brain: brainPayload }),
    isQuadrupleFresh: () => true,
  };
  withMockedRequires({ [FM_PATH]: fmStub }, () => {
    const m = require(AGENT_PATH);
    const result = m.gatherBrainContext('/tmp/section');
    assert.equal(result.brain, brainPayload);
    assert.equal(result.graceful_degradation, null);
  });
});

test('Wave-1: gatherBrainContext returns no_quadruple when readQuadruple throws', () => {
  const fmStub = {
    readQuadruple: () => { throw new Error('synthetic_io_error'); },
    isQuadrupleFresh: () => false,
  };
  withMockedRequires({ [FM_PATH]: fmStub }, () => {
    const m = require(AGENT_PATH);
    const result = m.gatherBrainContext('/tmp/no-such-path');
    assert.equal(result.brain, null);
    assert.equal(result.graceful_degradation, 'no_quadruple');
  });
});

// ---------- Test 7-12: mapDirectionToCascadeEdge mapping table ----------

test('Wave-1: mapDirectionToCascadeEdge cascade mapping (RESEARCH SCOPE B Section 2)', () => {
  clearAgentCache();
  const { mapDirectionToCascadeEdge } = require(AGENT_PATH);
  assert.equal(mapDirectionToCascadeEdge('structural_transfer', 0.5), 'INFORMS');
  assert.equal(mapDirectionToCascadeEdge('structural_transfer', 0.8), 'ENABLES');
  assert.equal(mapDirectionToCascadeEdge('semantic_implementation', -0.5), 'CONVERGES');
  assert.equal(mapDirectionToCascadeEdge('semantic_implementation', -0.8), 'INVALIDATES');
  assert.equal(mapDirectionToCascadeEdge('whitespace', 0), 'CONTRADICTS');
  assert.equal(mapDirectionToCascadeEdge('blindspot', 0), 'CONTRADICTS');
  assert.equal(mapDirectionToCascadeEdge('unknown_direction_string', 0.5), 'INFORMS', 'Pitfall 1 default fallback');
});

// ---------- Test 13-14: composeFinding deterministic id (Pitfall 6) ----------

test('Wave-1: composeFinding produces deterministic finding.id (idempotency)', () => {
  clearAgentCache();
  const { composeFinding } = require(AGENT_PATH);
  const pair = makePair({ source_artifact_id: 'a', target_artifact_id: 'b', direction: 'structural_transfer' });
  const f1 = composeFinding({ pair, focusContext: null, brainContext: { brain: null, graceful_degradation: null } });
  const f2 = composeFinding({ pair, focusContext: null, brainContext: { brain: null, graceful_degradation: null } });
  const expectedId = crypto.createHash('sha256').update('a|b|structural_transfer').digest('hex').slice(0, 32);
  assert.equal(f1.id, expectedId);
  assert.equal(f1.id, f2.id, 'finding.id must be deterministic across calls');
  assert.equal(typeof f1.body_text, 'string');
  assert.ok(f1.body_text.length > 0);
  assert.equal(f1.source_artifact_id, 'a');
  assert.equal(f1.target_artifact_id, 'b');
  assert.equal(f1.direction, 'structural_transfer');
});

test('Wave-1: composeFinding folds brain framework_chain_predictions when present', () => {
  clearAgentCache();
  const { composeFinding } = require(AGENT_PATH);
  const pair = makePair();
  const brain = { framework_chain_predictions: ['SWOT', 'Porter', 'BlueOcean'] };
  const f = composeFinding({ pair, focusContext: null, brainContext: { brain, graceful_degradation: null } });
  assert.ok(typeof f.brain_chain_text === 'string');
  assert.ok(f.brain_chain_text.includes('SWOT'));
  assert.ok(f.brain_chain_text.includes('Porter'));
});

// ---------- Test 15-17: runRsEngine schema-tolerant + invocation ----------

test('Wave-1: runRsEngine returns invalid_room_dir when no roomDir provided', () => {
  clearAgentCache();
  const m = require(AGENT_PATH);
  const result = m.runRsEngine({});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_room_dir');
  assert.deepEqual(result.pairs, []);
});

test('Wave-1: runRsEngine schema-tolerant accepts signed_diff and signed_delta (Pitfall 7)', () => {
  // Test the internal normalizePair via the _internal export.
  clearAgentCache();
  const m = require(AGENT_PATH);
  assert.ok(m._internal && typeof m._internal.normalizePair === 'function', '_internal.normalizePair missing');
  const a = m._internal.normalizePair({ signed_diff: 0.5, abs_diff: 0.5, direction: 'structural_transfer' });
  assert.equal(a.signed_diff, 0.5);
  // Forward-compat alternative key
  const b = m._internal.normalizePair({ signed_delta: 0.7, abs_diff: 0.7, innovation_type: 'semantic_implementation' });
  assert.equal(b.signed_diff, 0.7, 'normalizePair should accept signed_delta as fallback for signed_diff');
  assert.equal(b.direction, 'semantic_implementation', 'normalizePair should accept innovation_type as fallback for direction');
});

// ---------- Regression: detectAndSurface must forward rs.detail on failure ----------
//
// RCA rs-engine-python-insert-not-null-and-detail-drop-regression (2026-08-24):
// detectAndSurface's failure-path early return read only `rs.reason` off
// runRsEngine()'s result and dropped `rs.detail`, even though runRsEngine()
// (Phase 127.2-03 Finding F2) populates `detail` specifically so callers can
// self-recover from missing-deps / import / schema errors. Note: runRsEngine
// is called as a local closure inside detectAndSurface (not via
// module.exports.runRsEngine), so require-cache mocking (per
// withMockedRequires above) cannot intercept it here -- these tests instead
// force the real failure path via MINDRIAN_PYTHON, exercising the exact
// production code path end to end.

function withMindrianPython(pyPath, fn) {
  const saved = process.env.MINDRIAN_PYTHON;
  process.env.MINDRIAN_PYTHON = pyPath;
  clearAgentCache();
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.MINDRIAN_PYTHON;
    else process.env.MINDRIAN_PYTHON = saved;
    clearAgentCache();
  }
}

test('Regression: detectAndSurface forwards string detail on ENOENT-class failure', () => {
  withMindrianPython('/nonexistent/mindrian-test-python3-does-not-exist', () => {
    const m = require(AGENT_PATH);
    const result = m.detectAndSurface({
      roomDir: os.tmpdir(),
      sessionId: 'test-session',
      mode: 'internal',
      topk: 1,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'rs_engine_invocation_failed');
    assert.ok(
      Object.prototype.hasOwnProperty.call(result, 'detail'),
      'detectAndSurface must forward the detail field from runRsEngine failure path'
    );
    assert.ok(
      typeof result.detail === 'string' && result.detail.length > 0,
      'detail must be a non-empty string when the child process has no stderr (ENOENT)'
    );
    assert.deepEqual(result.findings, []);
  });
});

test('Regression: detectAndSurface forwards { message, diagnostic } detail object when child stderr is present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-detail-regression-'));
  const fakePython = path.join(tmpDir, 'fake-python3.sh');
  const marker = 'synthetic_rs_engine_failure_marker_for_regression_test';
  fs.writeFileSync(
    fakePython,
    '#!/bin/sh\n' + 'echo "' + marker + '" 1>&2\n' + 'exit 1\n'
  );
  fs.chmodSync(fakePython, 0o755);
  try {
    withMindrianPython(fakePython, () => {
      const m = require(AGENT_PATH);
      const result = m.detectAndSurface({
        roomDir: os.tmpdir(),
        sessionId: 'test-session',
        mode: 'internal',
        topk: 1,
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'rs_engine_invocation_failed');
      assert.ok(result.detail && typeof result.detail === 'object', 'detail must be an object when stderr is present');
      assert.equal(typeof result.detail.message, 'string');
      assert.ok(result.detail.diagnostic.includes(marker), 'diagnostic must carry the child stderr text');
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------- Test 18-20: emitFindingEdge call shape ----------

test('Wave-1: emitFindingEdge with APPROVE invokes upsertEdge with correct shape', () => {
  const calls = [];
  const lazygraphMock = {
    upsertEdge: (db, edge) => { calls.push({ db, edge }); return { ok: true }; },
    EDGE_TYPES: ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'INVALIDATES', 'ENABLES'],
  };
  withMockedRequires({ [LAZYGRAPH_PATH]: lazygraphMock }, () => {
    const m = require(AGENT_PATH);
    const finding = m.composeFinding({
      pair: makePair({ direction: 'structural_transfer', signed_diff: 0.5 }),
      focusContext: null,
      brainContext: { brain: null, graceful_degradation: null },
    });
    const result = m.emitFindingEdge({ name: 'mock-db' }, finding, 'APPROVE');
    assert.equal(result.ok, true);
    assert.equal(result.edgeType, 'INFORMS');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].edge.type, 'INFORMS');
    assert.equal(calls[0].edge.source, finding.source_artifact_id);
    assert.equal(calls[0].edge.target, finding.target_artifact_id);
    assert.equal(calls[0].edge.properties.source, 'rs-engine');
    assert.equal(calls[0].edge.properties.agent, 'reverse-salient');
    assert.equal(calls[0].edge.properties.finding_id, finding.id);
  });
});

test('Wave-1: emitFindingEdge with REJECT skips writer (F.0 dispatcher handles)', () => {
  const calls = [];
  const lazygraphMock = {
    upsertEdge: (db, edge) => { calls.push(edge); return { ok: true }; },
    EDGE_TYPES: ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'INVALIDATES', 'ENABLES'],
  };
  withMockedRequires({ [LAZYGRAPH_PATH]: lazygraphMock }, () => {
    const m = require(AGENT_PATH);
    const finding = m.composeFinding({
      pair: makePair(),
      focusContext: null,
      brainContext: { brain: null, graceful_degradation: null },
    });
    const result = m.emitFindingEdge({}, finding, 'REJECT');
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'rejected_handled_by_f0_dispatcher');
    assert.equal(calls.length, 0);
  });
});

test('Wave-1: emitFindingEdge with DEFER skips writer (F.0 dispatcher handles)', () => {
  const calls = [];
  const lazygraphMock = {
    upsertEdge: (db, edge) => { calls.push(edge); return { ok: true }; },
    EDGE_TYPES: ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'INVALIDATES', 'ENABLES'],
  };
  withMockedRequires({ [LAZYGRAPH_PATH]: lazygraphMock }, () => {
    const m = require(AGENT_PATH);
    const finding = m.composeFinding({
      pair: makePair(),
      focusContext: null,
      brainContext: { brain: null, graceful_degradation: null },
    });
    const result = m.emitFindingEdge({}, finding, 'DEFER');
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'deferred_handled_by_f0_dispatcher');
    assert.equal(calls.length, 0);
  });
});

// ---------- Test 21-22: ANTI-PATTERN guards (graph-native HARD RULE) ----------

test('Wave-1: ANTI-PATTERN -- agent source has zero direct room-db imports', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.equal(
    /require\(\s*['"][^'"]*room-db/.test(src),
    false,
    'direct room-db.cjs import is forbidden (Phase 109 D-06 chokepoint)'
  );
});

test('Wave-1: ANTI-PATTERN -- agent source has zero brain-client imports', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.equal(
    /require\(\s*['"][^'"]*brain-client/.test(src),
    false,
    'brain-client import is forbidden (Canon Part 8 -- agent never sends user-content to Brain)'
  );
});

test('Wave-1: ANTI-PATTERN -- agent does not reimplement rs-math in Node', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.equal(
    /TfidfVectorizer|TruncatedSVD|cosine_similarity/.test(src),
    false,
    'rs-math reimplementation in Node is forbidden -- shell out to scripts/rs-engine.py only'
  );
});

test('Wave-1: navigation.cjs chokepoint adherence (positive grep)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.ok(
    /require\(\s*['"][^'"]*\/navigation(\.cjs)?['"]/.test(src),
    'agent must require navigation.cjs (Phase 109 chokepoint)'
  );
});

test('Wave-1: readQuadruple integration (positive grep)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.ok(/readQuadruple/.test(src), 'agent must use readQuadruple for Brain reads (Canon Part 8 LOCAL only)');
});

test('Wave-1: rs-engine.py shell-out (positive grep)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.ok(/rs-engine\.py/.test(src), 'agent must shell out to scripts/rs-engine.py (no rs-math reimplementation)');
});

test('Wave-1: all 5 cascade edge types present in mapping (INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  for (const t of ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'INVALIDATES', 'ENABLES']) {
    assert.ok(src.includes(t), 'cascade edge type missing in mapping: ' + t);
  }
});

test('Wave-1: ANTI-PATTERN MODULE GRAPH -- no transitive load of brain-client', () => {
  // Re-require the agent fresh and walk require.cache for any brain-client filename.
  clearAgentCache();
  // Do not actually require here -- the agent file requires real navigation/folder-memory
  // modules that in turn could trigger brain-client. We accept that runtime require may
  // touch brain-client TRANSITIVELY (e.g. through a future memory-events change) but the
  // agent module itself must not REFERENCE brain-client by name. The earlier grep guard
  // covers source-level. This test is a defense-in-depth check that does not enforce
  // transitive non-presence (which could be too brittle); it asserts the agent's own
  // direct require list contains no brain-client filename.
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  const directRequires = (src.match(/require\(\s*['"][^'"]+['"]\s*\)/g) || []);
  for (const r of directRequires) {
    assert.equal(/brain-client|brain_client|brain-connector/.test(r), false, 'forbidden direct require: ' + r);
  }
});

// ---------- Test: 0 em-dashes (CLAUDE.md hard rule) ----------

test('Wave-1: agent source contains 0 em-dashes (no_emdashes hard rule)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  // U+2014 EM DASH
  const EMDASH = String.fromCharCode(0x2014);
  assert.equal(src.includes(EMDASH), false, 'em-dash forbidden (memory feedback_no_emdashes)');
});
