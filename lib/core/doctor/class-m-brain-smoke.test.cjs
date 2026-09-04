#!/usr/bin/env node
'use strict';

/*
 * Phase 127-02 Task 2 (TDD RED -> GREEN) -- Class M Brain smoke probe tests.
 * Extended by quick task 260819-c9b (WS-E1) for the L6 store_identity layer.
 *
 * Covers BRAIN-MCP-127-08 acceptance (CONTEXT Deliverable 4):
 *   Test 1:  LAYERS constant -- exactly 6 entries with stable ids
 *   Test 2:  checkBrainSmoke() returns { ok, layers: [6 x {id,name,ok,reason,ms}], overall_ms }
 *   Test 3:  L1 broken topology -> L2-L6 SKIPPED with reason "skipped-prior-layer-failed"
 *   Test 4:  L1 OK + L2 no-key -> L3-L6 SKIPPED
 *   Test 5:  L1 + L2 OK + L3 unreachable -> L4-L6 SKIPPED
 *   Test 6:  L1 + L2 + L3 OK + L4 timeout -> L5-L6 SKIPPED
 *   Test 7:  All 6 layers pass when all mocks succeed; overall_ms < 30000
 *   Test 8:  Each layer.ms >= 0 (sanity); ms fields are numbers
 *   Test 9:  fixBrainSmoke is a no-op (diagnostic-only invariant)
 *   Test 10: opts injection seams (mockResolveRoot/mockResolveKey/mockSchema/mockSpawn
 *            /mockBrainUrl/mockStats/mockQuery)
 *   Test 11: L6 store_identity contract -- stale-replica signature, below-floor
 *            (non-signature) failure, canon pass with payload, null-stats fail
 *            closed, and the GraphRagMeta stamp present/absent cases
 *
 * Hermetic via the opts injection seams -- NO real network IO, NO real spawn.
 * Every all-pass option bag carries mockBrainUrl/mockStats/mockQuery so L6
 * never reaches lib/core/brain-client.cjs (and therefore never the network)
 * from this suite. The shell harness in tests/test-127-02-doctor-class-m.sh
 * exercises real spawn against the actual shim binary.
 *
 * Canon parts:
 *   - Part 7 (reuse): LAYERS L1/L2/L3 import the existing resolver chokepoints
 *                     (active-plugin-root, resolve-brain-key, brain-client.schema);
 *                     L6 reuses the brain-client stats/query chokepoints.
 *   - Part 8 (graph boundary): the smoke probe queries brain_schema and store
 *                              metadata only (generic methodology handles);
 *                              zero user content egress in the smoke surface.
 *
 * HARD RULE: no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SMOKE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'class-m-brain-smoke.cjs');

// Phase 339, 2026-09-03: every mock origin in this file derives from the
// module's own exported CANON_BRAIN_URL rather than typing a host, so the
// FLIP cut (which moves this constant's VALUE, not this test) moves one
// constant and this suite follows with no edit here. Deriving it once, at
// require time, keeps every mock bag below in sync automatically.
const { CANON_BRAIN_URL } = require(SMOKE_PATH);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// Helper: clean require cache so each test gets a fresh module instance with
// fresh closure state for the opts seams.
function freshLoad() {
  delete require.cache[SMOKE_PATH];
  return require(SMOKE_PATH);
}

// Shared L6-hermetic seam trio for all-pass option bags: canon endpoint, a
// count safely above the floor, and a null stamp query (stamp simply
// absent). Every all-pass bag below spreads this in so L6 never reaches
// lib/core/brain-client.cjs.
const L6_PASS_SEAMS = {
  mockBrainUrl: () => CANON_BRAIN_URL,
  mockStats: async () => ({ totalRecordCount: 30000 }),
  mockQuery: async () => null,
};

// ---------------------------------------------------------------------------
// Test 1: LAYERS constant shape.
// ---------------------------------------------------------------------------
(async function test1_layers_constant() {
  const label = 'LAYERS constant: 6 frozen entries with stable ids';
  try {
    const mod = freshLoad();
    assert.ok(Array.isArray(mod.LAYERS), 'LAYERS must be an array');
    assert.equal(mod.LAYERS.length, 6, 'LAYERS must have exactly 6 entries');
    const ids = mod.LAYERS.map(l => l.id);
    assert.deepEqual(ids, [
      'plugin_root',
      'key_resolver',
      'https_schema',
      'stdio_handshake',
      'e2e_brain_schema',
      'store_identity',
    ], 'LAYERS ids must match the canonical 6-layer probe order');
    for (const l of mod.LAYERS) {
      assert.equal(typeof l.id, 'string', 'each layer has string id');
      assert.equal(typeof l.name, 'string', 'each layer has string name');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 2: checkBrainSmoke() return shape.
// ---------------------------------------------------------------------------
(async function test2_return_shape() {
  const label = 'checkBrainSmoke() returns { ok, layers:[6], overall_ms }';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({
      // All-pass mock chain for shape assertion
      mockResolveRoot: () => ({ root: '/tmp/fake-root', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'], rel_types: [] }),
      mockSpawn: async (_shimPath, opts) => ({ ok: true, reason: 'mocked ' + opts.intent }),
    }, L6_PASS_SEAMS));
    assert.equal(typeof result.ok, 'boolean', 'ok must be boolean');
    assert.ok(Array.isArray(result.layers), 'layers must be an array');
    assert.equal(result.layers.length, 6, 'layers must have 6 entries');
    assert.equal(typeof result.overall_ms, 'number', 'overall_ms must be number');
    assert.ok(result.overall_ms >= 0, 'overall_ms must be >= 0');
    for (const l of result.layers) {
      assert.equal(typeof l.id, 'string', 'layer.id is string');
      assert.equal(typeof l.name, 'string', 'layer.name is string');
      assert.equal(typeof l.ok, 'boolean', 'layer.ok is boolean');
      assert.equal(typeof l.reason, 'string', 'layer.reason is string');
      assert.equal(typeof l.ms, 'number', 'layer.ms is number');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 3: L1 broken -> L2..L6 skipped.
// ---------------------------------------------------------------------------
(async function test3_l1_broken_cascade() {
  const label = 'L1 broken -> L2-L6 cascade to skipped-prior-layer-failed';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke({
      mockResolveRoot: () => ({ root: null, source: 'not-found', topology: 'not-found' }),
    });
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[0].id, 'plugin_root', 'L1 id');
    assert.equal(result.layers[0].ok, false, 'L1 must be false');
    assert.match(result.layers[0].reason, /plugin root not resolved/i, 'L1 reason matches');
    for (let i = 1; i < 6; i++) {
      assert.equal(result.layers[i].ok, false, 'L' + (i + 1) + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'L' + (i + 1) + ' reason must be skipped-prior-layer-failed');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 4: L1 OK + L2 no key -> L3-L6 skipped.
// ---------------------------------------------------------------------------
(async function test4_l2_no_key_cascade() {
  const label = 'L1 OK + L2 no key -> L3-L6 cascade to skipped';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: null, source: 'not-found', available: false, reason: 'MINDRIAN_BRAIN_KEY not set (env) ...' }),
    });
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[0].ok, true, 'L1 must be true');
    assert.equal(result.layers[1].ok, false, 'L2 must be false');
    assert.match(result.layers[1].reason, /MINDRIAN_BRAIN_KEY not set/, 'L2 reason carries the resolver reason');
    for (let i = 2; i < 6; i++) {
      assert.equal(result.layers[i].ok, false, 'L' + (i + 1) + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'L' + (i + 1) + ' reason must be skipped-prior-layer-failed');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 5: L1+L2 OK + L3 unreachable -> L4-L6 skipped.
// ---------------------------------------------------------------------------
(async function test5_l3_unreachable_cascade() {
  const label = 'L1+L2 OK + L3 returns null -> L4-L6 cascade to skipped';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => null,
    });
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[0].ok, true, 'L1 ok');
    assert.equal(result.layers[1].ok, true, 'L2 ok');
    assert.equal(result.layers[2].ok, false, 'L3 must be false');
    assert.match(result.layers[2].reason, /HTTPS|schema|unreachable/i, 'L3 reason matches');
    for (let i = 3; i < 6; i++) {
      assert.equal(result.layers[i].ok, false, 'L' + (i + 1) + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'L' + (i + 1) + ' reason must be skipped-prior-layer-failed');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 6: L1+L2+L3 OK + L4 handshake timeout -> L5-L6 skipped.
// ---------------------------------------------------------------------------
(async function test6_l4_handshake_timeout() {
  const label = 'L1+L2+L3 OK + L4 timeout -> L5-L6 cascade to skipped';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, opts) => {
        if (opts.intent === 'handshake') return { ok: false, reason: 'handshake timed out after 10000ms' };
        return { ok: true, reason: 'should-not-be-called' };
      },
    });
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[3].ok, false, 'L4 must be false');
    assert.match(result.layers[3].reason, /handshake|timeout/i, 'L4 reason matches');
    assert.equal(result.layers[4].ok, false, 'L5 must be false (skipped)');
    assert.equal(result.layers[4].reason, 'skipped-prior-layer-failed', 'L5 reason skipped');
    assert.equal(result.layers[5].ok, false, 'L6 must be false (skipped)');
    assert.equal(result.layers[5].reason, 'skipped-prior-layer-failed', 'L6 reason skipped');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 7: All 6 layers pass; overall_ms < 30000.
// ---------------------------------------------------------------------------
(async function test7_all_pass() {
  const label = 'All 6 layers PASS via mocks; overall_ms < 30000 (30s budget)';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, _opts) => ({ ok: true, reason: 'mocked-success' }),
    }, L6_PASS_SEAMS));
    assert.equal(result.ok, true, 'overall must be true');
    for (const l of result.layers) {
      assert.equal(l.ok, true, 'layer ' + l.id + ' must be true');
    }
    assert.ok(result.overall_ms < 30000, 'overall_ms must be under 30s budget (got ' + result.overall_ms + ')');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 8: ms-field sanity.
// ---------------------------------------------------------------------------
(async function test8_ms_sanity() {
  const label = 'Each layer.ms is non-negative number';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, _opts) => ({ ok: true, reason: 'ok' }),
    }, L6_PASS_SEAMS));
    for (const l of result.layers) {
      assert.equal(typeof l.ms, 'number', 'layer.ms is number');
      assert.ok(l.ms >= 0, 'layer.ms must be >= 0 (got ' + l.ms + ')');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 9: fixBrainSmoke is a no-op (diagnostic-only).
// ---------------------------------------------------------------------------
(async function test9_fix_is_noop() {
  const label = 'fixBrainSmoke(result) is a no-op (diagnostic-only invariant)';
  try {
    const mod = freshLoad();
    const fakeResult = { ok: false, layers: [], overall_ms: 0 };
    const r = mod.fixBrainSmoke(fakeResult);
    assert.equal(r.fixed, false, 'fixed must be false');
    assert.match(r.reason, /diagnostic-only/, 'reason must indicate diagnostic-only nature');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 10: opts injection seams + Class M letter consistency.
// ---------------------------------------------------------------------------
(async function test10_opts_seams_and_class_m() {
  const label = 'opts injection seams enable hermetic testing + Class M referenced in source';
  try {
    const mod = freshLoad();
    // Verify all four seams individually substitute their layer.
    let mockSchemaCalled = false;
    let mockSpawnCalled = false;
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/seam', source: 'opts-mock', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'seam-key', source: 'opts-mock', available: true, reason: null }),
      mockSchema: async () => { mockSchemaCalled = true; return { labels: [], rel_types: [] }; },
      mockSpawn: async (_shimPath, _opts) => { mockSpawnCalled = true; return { ok: true, reason: 'seam-mock' }; },
    }, L6_PASS_SEAMS));
    assert.equal(result.ok, true, 'all seams provided -> overall true');
    assert.equal(mockSchemaCalled, true, 'mockSchema seam invoked for L3');
    assert.equal(mockSpawnCalled, true, 'mockSpawn seam invoked for L4 and L5');
    assert.equal(result.layers[0].reason, 'resolved (source=opts-mock, topology=dev-clone)', 'L1 reason carries source');
    // Source-level class letter check (CRITICAL: plan uses Class M, not K).
    const src = fs.readFileSync(SMOKE_PATH, 'utf8');
    assert.match(src, /Class[- ]?M/, 'source must reference Class M (not Class K -- K is taken by --stale-first-touch)');
    assert.equal(src.indexOf('Class K'), -1, 'source MUST NOT reference Class K (collides with existing --stale-first-touch)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 11: L6 store_identity contract (quick task 260819-c9b, WS-E1).
// ---------------------------------------------------------------------------
(async function test11_store_identity_contract() {
  const label = 'L6 store_identity: stale-replica signature, below-floor, canon pass, null fail-closed, stamp present/absent';
  try {
    const mod = freshLoad();
    const passBase = {
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, _opts) => ({ ok: true, reason: 'ok' }),
      mockBrainUrl: () => CANON_BRAIN_URL,
    };

    // Case A: the stale-replica count 28325 fails and names stale_replica_signature.
    const staleResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ totalRecordCount: 28325 }),
      mockQuery: async () => null,
    }));
    const L6stale = staleResult.layers[5];
    assert.equal(L6stale.id, 'store_identity', 'L6 id');
    assert.equal(L6stale.ok, false, '28325 must FAIL');
    assert.match(L6stale.reason, /stale_replica_signature/, 'reason names stale_replica_signature');

    // Case B: below the floor but NOT the stale signature -> a DIFFERENT
    // failure reason, without the stale_replica_signature token. 500, not
    // 1000: 1000 is the exact Theo floor plan 339-12 will introduce, so a
    // below-floor arm sitting at 1000 would stop failing the moment the
    // flip lands and silently invert from proving a failure to proving a
    // pass. 500 sits below BOTH the incumbent floor (29000) and the coming
    // Theo floor (1000), and it is not STALE_REPLICA_NODE_COUNT (28325),
    // so this arm keeps testing the generic floor, not the named signature.
    const belowFloorResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ totalRecordCount: 500 }),
      mockQuery: async () => null,
    }));
    const L6belowFloor = belowFloorResult.layers[5];
    assert.equal(L6belowFloor.ok, false, 'below-floor count must FAIL');
    assert.equal(/stale_replica_signature/.test(L6belowFloor.reason), false,
      'below-floor failure must NOT carry the stale_replica_signature token');

    // Case C: a count above the floor passes and carries payload
    // (incumbent shape: totalRecordCount).
    const passResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ totalRecordCount: 30000 }),
      mockQuery: async () => null,
    }));
    const L6pass = passResult.layers[5];
    assert.equal(L6pass.ok, true, '30000 must PASS');
    assert.ok(L6pass.payload, 'passing layer carries a payload');
    assert.equal(L6pass.payload.endpoint, CANON_BRAIN_URL, 'payload.endpoint');
    assert.equal(L6pass.payload.node_count, 30000, 'payload.node_count');
    assert.equal(L6pass.payload.canon, true, 'payload.canon');
    assert.equal('stamp' in L6pass.payload, false, 'null mockQuery leaves NO stamp key');

    // Case C2 (Phase 339, FLIP-11 prep): a Theo-SHAPED stats payload
    // ({ nodes, relationships, labels }, no totalRecordCount at all) also
    // passes and reports the same node_count, proving the `nodes` half of
    // the dual read. 30000 is used here rather than Theo's real 1253,
    // deliberately: it clears BOTH the incumbent floor (29000) and the
    // coming Theo floor (1000), so this arm tests the SHAPE READ alone and
    // cannot be knocked over by a floor change on either side of the flip.
    const theoShapeResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ nodes: 30000, relationships: 40000, labels: 14 }),
      mockQuery: async () => null,
    }));
    const L6theoShape = theoShapeResult.layers[5];
    assert.equal(L6theoShape.ok, true, 'Theo-shaped stats (nodes) must PASS');
    assert.equal(L6theoShape.payload.node_count, 30000, 'payload.node_count reads the nodes field');
    ok('L6 store_identity: Theo-shaped stats ({nodes,relationships,labels}) dual-read PASS (added, not retargeted)');

    // Case C3 (Phase 339, FLIP-11 prep): a payload carrying NEITHER
    // totalRecordCount NOR nodes still fails honestly, and the reason
    // names BOTH field names, proving the fallback stays honest rather
    // than silently defaulting.
    const neitherFieldResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ labels: 14 }),
      mockQuery: async () => null,
    }));
    const L6neitherField = neitherFieldResult.layers[5];
    assert.equal(L6neitherField.ok, false, 'a payload with neither field must FAIL');
    assert.match(L6neitherField.reason, /totalRecordCount/, 'reason names totalRecordCount');
    assert.match(L6neitherField.reason, /nodes/, 'reason names nodes');
    ok('L6 store_identity: neither totalRecordCount nor nodes -- honest FAIL naming both fields (added, not retargeted)');

    // Case D: mockStats returning null fails closed.
    const nullStatsResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => null,
      mockQuery: async () => null,
    }));
    assert.equal(nullStatsResult.layers[5].ok, false, 'null stats must FAIL closed');

    // Case E: a mockQuery returning a records array carrying a non-null
    // schema_version puts a stamp on the payload.
    const stampResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ totalRecordCount: 30000 }),
      mockQuery: async () => ({ records: [{ schema_version: '1.0', last_reconciled: null, refreshed_at: '2026-08-19' }] }),
    }));
    const L6stamp = stampResult.layers[5];
    assert.equal(L6stamp.ok, true, 'stamp case still passes on count');
    assert.ok(L6stamp.payload.stamp, 'payload carries a stamp key');
    assert.equal(L6stamp.payload.stamp.schema_version, '1.0', 'stamp.schema_version present');
    assert.equal(L6stamp.payload.stamp.refreshed_at, '2026-08-19', 'stamp.refreshed_at present');
    assert.equal('last_reconciled' in L6stamp.payload.stamp, false, 'null stamp fields are omitted, not fabricated');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Summary -- IIFEs above are async; collect results after a microtask drain.
// ---------------------------------------------------------------------------
setImmediate(function summarize() {
  // Allow any straggling async test to settle. Two passes of setImmediate is
  // enough for the trivial test bodies above.
  setImmediate(function () {
    process.stdout.write('\nPASSED: ' + passed + '\nFAILED: ' + failed + '\n');
    process.exit(failed === 0 ? 0 : 1);
  });
});
