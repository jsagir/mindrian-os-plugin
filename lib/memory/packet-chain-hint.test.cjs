/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 125-03 -- buildBrainPacket framework_chain_hint stitch test suite.
 *
 * Covers the 10 behaviors from 125-03-PLAN.md Task 1:
 *   Test 1  active set non-empty -> hint present (all 5 fields)
 *   Test 2  active set empty -> hint ABSENT (Object.prototype.hasOwnProperty.call false)
 *   Test 3  existing 6 fields preserved in BOTH paths
 *   Test 4  slice_scope is integer 1|2|3 (matches resolveHopDepth output)
 *   Test 5  slice_rationale is non-empty string
 *   Test 6  Brain unreachable -> hint still present (degraded shape; rationale carries marker)
 *   Test 7  no roomState -> hint ABSENT
 *   Test 8  mocked fetcher invoked exactly once per buildBrainPacket call
 *   Test 9  packet.packet_version remains '1.0' (Phase 110 invariant)
 *   Test 10 no regression -- existing buildBrainPacket fields still present + populated
 *
 * Three-surface compatibility: pure CJS + node built-ins + node:test. The
 * fixture uses fs.mkdtempSync + openRoomDb (no Brain network, no Cypher,
 * just a hermetic local SQLite room). The framework-chain-slice fetcher is
 * mocked via opts._mocks.fetchFrameworkChainSlice -- no live brain-client
 * calls happen during this test.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const packet = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'packet.cjs'));

// ---------------------------------------------------------------------------
// Hermetic fixture: a local SQLite room with the focus + a couple neighbors.
// Mirrors the makeRoom() shape in tests/test-navigation-packet-builder.cjs,
// pared down to the minimum needed to exercise local_graph_summary stitching.
// ---------------------------------------------------------------------------
function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-125-03-pkt-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const insN = db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)"
  );
  insN.run('room:test', 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  insN.run('decision:focus', 'decision', JSON.stringify({ summary: 'pick a framework' }),
    'fixture/d.md', 0.7, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:c1', 'claim', JSON.stringify({ summary: 'claim 1' }),
    'fixture/c1.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('assumption:a1', 'assumption', JSON.stringify({ claim: 'risky' }),
    'fixture/a1.md', 0.4, 'proposed', nowMs, nowMs, 'design');
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  insE.run('decision:focus', 'claim:c1', 'INFORMS');
  insE.run('decision:focus', 'assumption:a1', 'ASSUMES');
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function defaultMocks() {
  return {
    jtbd: { getCurrent: () => ({ current: null }) },
    operator: { getCurrent: () => ({ current: null }) },
  };
}

// A mock fetcher that returns a well-formed hint envelope. Matches the
// contract from lib/brain/framework-chain-slice.cjs::fetchFrameworkChainSlice
// (Plan 02 shipped).
function makeMockFetcher(opts) {
  const o = opts || {};
  const calls = [];
  const slice_scope = (o.slice_scope === 1 || o.slice_scope === 2 || o.slice_scope === 3) ? o.slice_scope : 2;
  const fetcher = async function (args) {
    calls.push(args);
    if (o.degraded) {
      return {
        edges: [],
        slice_scope: slice_scope,
        slice_rationale: 'brain_unreachable',
        brain_snapshot_id: null,
        fetched_at: new Date().toISOString(),
      };
    }
    return {
      edges: [
        { from: 'SWOT', to: 'Porter Five Forces', confidence: 0.8, transform_description: 'natural follow-on', hop_distance: 1 },
        { from: 'SWOT', to: 'Lean Canvas', confidence: 0.65, transform_description: null, hop_distance: 1 },
      ],
      slice_scope: slice_scope,
      slice_rationale: 'brain_reachable; 2 edges fetched; 1 active_frameworks; max_hops=' + slice_scope,
      brain_snapshot_id: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd01',
      fetched_at: new Date().toISOString(),
    };
  };
  fetcher.calls = calls;
  return fetcher;
}

// roomState that resolves a single governing_thought-driven active framework
// (matches Plan 01's KNOWN_FRAMEWORK_HINTS list -- "SWOT" is one of the 16).
function activeRoomState() {
  return {
    problemType: 'WDP',
    governing_thought: 'Run SWOT first to map the position',
    framework_invocations: 3,
    activeJtbd: null,
    brainAnchors: [],
    recentFrameworks: [],
  };
}

// ---------------------------------------------------------------------------
// Test 1 -- active set non-empty -> hint present (all 5 fields)
// ---------------------------------------------------------------------------
test('Test 1: hint present with all 5 fields when active set non-empty', async () => {
  const { tmp, db } = makeRoom();
  try {
    const fetcher = makeMockFetcher();
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: activeRoomState(),
    });
    assert.ok(Object.prototype.hasOwnProperty.call(p.local_graph_summary, 'framework_chain_hint'),
      'framework_chain_hint key is present');
    const hint = p.local_graph_summary.framework_chain_hint;
    assert.ok(hint && typeof hint === 'object', 'hint is a non-null object');
    for (const k of ['edges', 'slice_scope', 'slice_rationale', 'brain_snapshot_id', 'fetched_at']) {
      assert.ok(Object.prototype.hasOwnProperty.call(hint, k), 'hint has key: ' + k);
    }
    assert.ok(Array.isArray(hint.edges), 'edges is an array');
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 2 -- active set empty -> hint ABSENT (verified via hasOwnProperty)
// ---------------------------------------------------------------------------
test('Test 2: hint ABSENT when active set empty (no governing_thought, no anchors, no JTBD)', async () => {
  const { tmp, db } = makeRoom();
  try {
    const fetcher = makeMockFetcher();
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: {
        problemType: 'WDP',
        governing_thought: '',
        activeJtbd: null,
        brainAnchors: [],
        recentFrameworks: [],
        framework_invocations: 0,
      },
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(p.local_graph_summary, 'framework_chain_hint'),
      false,
      'framework_chain_hint key must be ABSENT when active set is empty'
    );
    // Fetcher must NOT have been called (no active set means short-circuit).
    assert.strictEqual(fetcher.calls.length, 0, 'fetcher not called when active set empty');
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 3 -- existing 6 fields preserved in BOTH paths
// ---------------------------------------------------------------------------
test('Test 3: existing 6 local_graph_summary fields preserved (active set non-empty)', async () => {
  const { tmp, db } = makeRoom();
  try {
    const fetcher = makeMockFetcher();
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: activeRoomState(),
    });
    const lgs = p.local_graph_summary;
    for (const k of ['nearest_claims', 'nearest_assumptions', 'contradictions',
      'unsupported_claims', 'recent_changes', 'banked_opportunities']) {
      assert.ok(Object.prototype.hasOwnProperty.call(lgs, k), 'existing field still present: ' + k);
    }
    assert.ok(Array.isArray(lgs.nearest_claims), 'nearest_claims is an array');
    assert.ok(Array.isArray(lgs.nearest_assumptions), 'nearest_assumptions is an array');
    assert.ok(Array.isArray(lgs.contradictions), 'contradictions is an array');
    assert.ok(Array.isArray(lgs.unsupported_claims), 'unsupported_claims is an array');
    assert.ok(Array.isArray(lgs.recent_changes), 'recent_changes is an array');
    assert.ok(typeof lgs.banked_opportunities === 'object', 'banked_opportunities is an object');
    db.close();
  } finally { cleanup(tmp); }
});

test('Test 3b: existing 6 local_graph_summary fields preserved (active set empty)', async () => {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: defaultMocks(),
      roomId: 'test',
    });
    const lgs = p.local_graph_summary;
    for (const k of ['nearest_claims', 'nearest_assumptions', 'contradictions',
      'unsupported_claims', 'recent_changes', 'banked_opportunities']) {
      assert.ok(Object.prototype.hasOwnProperty.call(lgs, k), 'existing field still present: ' + k);
    }
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 4 -- slice_scope is integer 1|2|3 (matches resolveHopDepth)
// ---------------------------------------------------------------------------
test('Test 4: slice_scope is an integer in {1, 2, 3} and matches resolveHopDepth', async () => {
  const { tmp, db } = makeRoom();
  try {
    // WDP + governing_thought -> depth 1 per resolveHopDepth (Plan 01).
    const fetcher = makeMockFetcher({ slice_scope: 1 });
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: activeRoomState(),
    });
    const hint = p.local_graph_summary.framework_chain_hint;
    assert.strictEqual(typeof hint.slice_scope, 'number', 'slice_scope is a number');
    assert.ok([1, 2, 3].includes(hint.slice_scope), 'slice_scope in {1,2,3}; got ' + hint.slice_scope);
    // The mock returned 1 only because the fetcher honors the max_hops arg
    // it received from the helper. Verify the helper called fetcher with the
    // depth the projection resolved (WDP + governing_thought -> 1).
    assert.strictEqual(fetcher.calls.length, 1, 'fetcher invoked exactly once');
    assert.strictEqual(fetcher.calls[0].max_hops, 1,
      'fetcher received max_hops=1 (WDP + governing_thought -> depth 1)');
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 5 -- slice_rationale is non-empty string
// ---------------------------------------------------------------------------
test('Test 5: slice_rationale is a non-empty string when hint present', async () => {
  const { tmp, db } = makeRoom();
  try {
    const fetcher = makeMockFetcher();
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: activeRoomState(),
    });
    const hint = p.local_graph_summary.framework_chain_hint;
    assert.strictEqual(typeof hint.slice_rationale, 'string', 'slice_rationale is a string');
    assert.ok(hint.slice_rationale.length > 0, 'slice_rationale is non-empty');
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 6 -- Brain unreachable -> hint STILL PRESENT (degraded shape;
// distinguishes "active set non-empty but Brain failed" from "active set empty")
// ---------------------------------------------------------------------------
test('Test 6: Brain unreachable -> hint still attached with degraded shape (rationale carries marker)', async () => {
  const { tmp, db } = makeRoom();
  try {
    const fetcher = makeMockFetcher({ degraded: true });
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: activeRoomState(),
    });
    assert.ok(Object.prototype.hasOwnProperty.call(p.local_graph_summary, 'framework_chain_hint'),
      'hint still attached even when Brain returned degraded envelope');
    const hint = p.local_graph_summary.framework_chain_hint;
    assert.ok(Array.isArray(hint.edges), 'edges is still an array');
    assert.strictEqual(hint.edges.length, 0, 'degraded edges is empty array');
    assert.strictEqual(hint.brain_snapshot_id, null, 'degraded brain_snapshot_id is null');
    assert.ok(typeof hint.slice_rationale === 'string' && hint.slice_rationale.indexOf('brain_unreachable') !== -1,
      'slice_rationale carries brain_unreachable marker: got "' + hint.slice_rationale + '"');
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 7 -- no roomState -> hint ABSENT
// ---------------------------------------------------------------------------
test('Test 7: no roomState in opts -> hint ABSENT', async () => {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: defaultMocks(),
      roomId: 'test',
      // No roomState key at all.
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(p.local_graph_summary, 'framework_chain_hint'),
      false,
      'hint absent when opts.roomState is undefined'
    );
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 8 -- mocked fetcher invoked exactly once per buildBrainPacket call
// ---------------------------------------------------------------------------
test('Test 8: opts._mocks.fetchFrameworkChainSlice is invoked exactly once', async () => {
  const { tmp, db } = makeRoom();
  try {
    const fetcher = makeMockFetcher();
    await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: activeRoomState(),
    });
    assert.strictEqual(fetcher.calls.length, 1, 'fetcher invoked exactly once (not 0, not 2)');
    // Verify the fetcher receives the active framework names + max_hops.
    const args = fetcher.calls[0];
    assert.ok(Array.isArray(args.active_frameworks), 'fetcher.active_frameworks is an array');
    assert.ok(args.active_frameworks.length > 0, 'fetcher.active_frameworks non-empty');
    assert.ok([1, 2, 3].includes(args.max_hops), 'fetcher.max_hops in {1,2,3}; got ' + args.max_hops);
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 9 -- packet.packet_version remains '1.0' (Phase 110 invariant)
// ---------------------------------------------------------------------------
test('Test 9: packet_version remains "1.0" with and without hint', async () => {
  const { tmp, db } = makeRoom();
  try {
    const fetcher = makeMockFetcher();
    const pWithHint = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: activeRoomState(),
    });
    assert.strictEqual(pWithHint.packet_version, '1.0', 'packet_version is "1.0" with hint');
    const pNoHint = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: defaultMocks(),
      roomId: 'test',
    });
    assert.strictEqual(pNoHint.packet_version, '1.0', 'packet_version is "1.0" without hint');
    db.close();
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Test 10 -- _surfaceFrameworkChainHint test seam is exported + behaves as
// the helper invariant requires (no roomState -> undefined; empty active ->
// undefined; non-empty active -> hint object).
// ---------------------------------------------------------------------------
test('Test 10: _surfaceFrameworkChainHint test seam -- no roomState returns undefined', async () => {
  assert.ok(packet._test && typeof packet._test._surfaceFrameworkChainHint === 'function',
    'packet._test._surfaceFrameworkChainHint is exported');
  const out = await packet._test._surfaceFrameworkChainHint(null, null, {});
  assert.strictEqual(out, undefined, 'undefined when roomState is null');
});

test('Test 10b: _surfaceFrameworkChainHint -- empty active set returns undefined', async () => {
  const out = await packet._test._surfaceFrameworkChainHint(null, {
    problemType: 'WDP',
    governing_thought: '',
    activeJtbd: null,
    brainAnchors: [],
    recentFrameworks: [],
  }, { _mocks: { fetchFrameworkChainSlice: makeMockFetcher() } });
  assert.strictEqual(out, undefined, 'undefined when active set resolves empty');
});

test('Test 10c: _surfaceFrameworkChainHint -- non-empty active set returns hint object', async () => {
  const fetcher = makeMockFetcher();
  const out = await packet._test._surfaceFrameworkChainHint(null, activeRoomState(), {
    _mocks: { fetchFrameworkChainSlice: fetcher },
  });
  assert.ok(out && typeof out === 'object', 'returns a hint object');
  for (const k of ['edges', 'slice_scope', 'slice_rationale', 'brain_snapshot_id', 'fetched_at']) {
    assert.ok(Object.prototype.hasOwnProperty.call(out, k), 'hint has key: ' + k);
  }
  assert.strictEqual(fetcher.calls.length, 1, 'fetcher invoked exactly once by the helper');
});

// ---------------------------------------------------------------------------
// Test 11 -- regression floor: a hint-bearing packet retains all 6 existing
// fields with non-empty arrays where the fixture seeds them (nearest_claims,
// nearest_assumptions, banked_opportunities.count >= 0).
// ---------------------------------------------------------------------------
test('Test 11: regression -- nearest_claims and assumptions populated even with hint present', async () => {
  const { tmp, db } = makeRoom();
  try {
    const fetcher = makeMockFetcher();
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
      _mocks: Object.assign({}, defaultMocks(), { fetchFrameworkChainSlice: fetcher }),
      roomId: 'test',
      roomState: activeRoomState(),
    });
    const lgs = p.local_graph_summary;
    assert.ok(lgs.nearest_claims.length >= 1, 'nearest_claims populated (got ' + lgs.nearest_claims.length + ')');
    assert.ok(lgs.nearest_assumptions.length >= 1, 'nearest_assumptions populated (got ' + lgs.nearest_assumptions.length + ')');
    assert.strictEqual(typeof lgs.banked_opportunities.count, 'number', 'banked_opportunities.count is a number');
    db.close();
  } finally { cleanup(tmp); }
});
