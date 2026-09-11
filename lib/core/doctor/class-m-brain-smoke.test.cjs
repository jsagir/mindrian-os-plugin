#!/usr/bin/env node
'use strict';

/*
 * Phase 127-02 Task 2 (TDD RED -> GREEN) -- Class M Brain smoke probe tests.
 * Extended by quick task 260819-c9b (WS-E1) for the L6 store_identity layer.
 * Extended by quick task 260911-axz (AXZ-01) for the L0 origin-and-shadow
 * layer prepended ahead of the original 6, making this a 7-layer probe.
 *
 * Covers BRAIN-MCP-127-08 acceptance (CONTEXT Deliverable 4), plus AXZ-01:
 *   Test 1:  LAYERS constant -- exactly 7 entries with stable ids, origin_shadow first
 *   Test 2:  checkBrainSmoke() returns { ok, layers: [7 x {id,name,ok,reason,ms}], overall_ms }
 *   Test 3:  L1 broken topology -> L2-L6 SKIPPED with reason "skipped-prior-layer-failed"
 *            (L0 still runs and passes; it never blinds nor is blinded by L1)
 *   Test 4:  L1 OK + L2 no-key -> L3-L6 SKIPPED
 *   Test 5:  L1 + L2 OK + L3 unreachable -> L4-L6 SKIPPED
 *   Test 6:  L1 + L2 + L3 OK + L4 timeout -> L5-L6 SKIPPED
 *   Test 7:  All 7 layers pass when all mocks succeed; overall_ms < 30000
 *   Test 8:  Each layer.ms >= 0 (sanity); ms fields are numbers
 *   Test 9:  fixBrainSmoke is a no-op (diagnostic-only invariant)
 *   Test 10: opts injection seams (mockResolveRoot/mockResolveKey/mockSchema/mockSpawn
 *            /mockBrainUrl/mockStats/mockQuery)
 *   Test 11: L6 store_identity contract -- stale-replica signature, below-floor
 *            (non-signature) failure, canon pass with payload, null-stats fail
 *            closed, and the GraphRagMeta stamp present/absent cases
 *
 *   Test A:  shadow present (user scope) -- not-ok, names scope, host, fix line,
 *            plugin-provides sentence, and no secret of any kind leaks
 *   Test B:  shadow present (local scope) -- not-ok, scope local, fix line -s local
 *   Test C:  no shadow -- ok true, reason says none found
 *   Test D:  the plugin's own .mcp.json shim is never consulted by this layer
 *            (reader called exactly once, with the Claude Code config path)
 *   Test E:  resolved-origin row -- resolved_origin/is_theo/override/theo_health
 *            all carried in payload, reason names the origin
 *   Test F:  theo_health rejection degrades honestly, never changes ok, never throws
 *   Test G:  non-Theo origin with MINDRIAN_BRAIN_URL override -- is_theo false,
 *            override true, verdict follows the shadow half only
 *   Test H:  shadow present AND every L1-L6 mock passing -> all 7 layers run,
 *            L0 not-ok, L1-L6 all ok, zero "skipped-prior-layer-failed" anywhere
 *            (this is the arm that proves L0 is information-bearing, never a
 *            short circuit)
 *   Test I:  THEO_NODE_FLOOR exported and === 27000; CANON_NODE_FLOOR unchanged
 *            at 29000; a Theo-origin count 1 below the floor fails naming both
 *            the count and the floor, a count at the measured 27951 passes
 *
 * Hermetic via the opts injection seams -- NO real network IO, NO real spawn,
 * and Test A/B/C/D use a temp fixture file path for the L0 config reader,
 * NEVER the real ~/.claude.json. Every all-pass option bag carries the L0 and
 * L6 seams so neither layer ever reaches a real filesystem read of
 * ~/.claude.json nor lib/core/brain-client.cjs (and therefore never the
 * network) from this suite, with the sole deliberate exception of Tests
 * A/B/C, which point the REAL lib/core/integration-registry.cjs reader at a
 * temp fixture file to prove the projection itself (not a stand-in) strips
 * secrets. The shell harness in tests/test-127-02-doctor-class-m.sh
 * exercises real spawn against the actual shim binary.
 *
 * Canon parts:
 *   - Part 7 (reuse): LAYERS L1/L2/L3 import the existing resolver chokepoints
 *                     (active-plugin-root, resolve-brain-key, brain-client.schema);
 *                     L6 reuses the brain-client stats/query chokepoints; L0
 *                     reuses lib/core/integration-registry.cjs's
 *                     readScopedMcpServers (no third reader minted).
 *   - Part 8 (graph boundary): the smoke probe queries brain_schema and store
 *                              metadata only (generic methodology handles);
 *                              zero user content egress in the smoke surface.
 *                              L0's projection never carries headers, the
 *                              full url, or env -- only name/scope/url_host.
 *
 * HARD RULE: no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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

function mkTmpConfigDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'axz-claude-json-'));
}

// Shared hermetic seam bag covering EVERY layer (L0 through L6), so every
// test below -- including the ones that only care about L0's behavior --
// stays fully hermetic: L0 never blinds L1-L6 (Test H proves this), which
// means L1-L6 keep running even in a test that is only trying to exercise
// L0, and if they are not mocked they fall through to the REAL resolvers
// (active-plugin-root, resolve-brain-key, brain-client schema/spawn/stats),
// which means real filesystem/network calls. Every test below therefore
// spreads ALL_PASS_SEAMS FIRST and its own overrides LAST (Object.assign
// applies later sources over earlier ones), so a test can narrow its focus
// to one layer while every other layer stays mocked-and-passing.
//
// mockScopedServers here returns an empty array (no shadow) by default;
// Tests A/B/C/D override it (to `undefined` for A/B/C, forcing the REAL
// integration-registry.cjs reader against a temp fixture, or to a spy
// function for D) to exercise the actual reader rather than a stand-in.
const ALL_PASS_SEAMS = {
  mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
  mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
  mockSchema: async () => ({ labels: ['Framework'] }),
  mockSpawn: async () => ({ ok: true, reason: 'ok' }),
  mockScopedServers: () => [],
  mockBrainUrl: () => CANON_BRAIN_URL,
  mockTheoHealth: async () => null,
  mockStats: async () => ({ totalRecordCount: 30000 }),
  mockQuery: async () => null,
};

// The L0-only subset, for cascade tests (3-6) that deliberately override one
// specific L1-L4 mock to fail and need L0 (and, ahead of the failure point,
// the earlier L1-L4 layers) to pass cleanly. These tests spread
// Object.assign({}, ALL_PASS_SEAMS, L0_PASS_SEAMS_OVERRIDE_NOTE, { the one
// broken mock }) -- see each test body.
const L0_PASS_SEAMS = {
  mockScopedServers: ALL_PASS_SEAMS.mockScopedServers,
  mockBrainUrl: ALL_PASS_SEAMS.mockBrainUrl,
  mockTheoHealth: ALL_PASS_SEAMS.mockTheoHealth,
};

// ---------------------------------------------------------------------------
// Test 1: LAYERS constant shape.
// ---------------------------------------------------------------------------
(async function test1_layers_constant() {
  const label = 'LAYERS constant: 7 frozen entries with stable ids, origin_shadow first';
  try {
    const mod = freshLoad();
    assert.ok(Array.isArray(mod.LAYERS), 'LAYERS must be an array');
    assert.equal(mod.LAYERS.length, 7, 'LAYERS must have exactly 7 entries');
    const ids = mod.LAYERS.map(l => l.id);
    assert.deepEqual(ids, [
      'origin_shadow',
      'plugin_root',
      'key_resolver',
      'https_schema',
      'stdio_handshake',
      'e2e_brain_schema',
      'store_identity',
    ], 'LAYERS ids must match the canonical 7-layer probe order, L0 first');
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
  const label = 'checkBrainSmoke() returns { ok, layers:[7], overall_ms }';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({
      // All-pass mock chain for shape assertion
      mockResolveRoot: () => ({ root: '/tmp/fake-root', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'], rel_types: [] }),
      mockSpawn: async (_shimPath, opts) => ({ ok: true, reason: 'mocked ' + opts.intent }),
    }, ALL_PASS_SEAMS));
    assert.equal(typeof result.ok, 'boolean', 'ok must be boolean');
    assert.ok(Array.isArray(result.layers), 'layers must be an array');
    assert.equal(result.layers.length, 7, 'layers must have 7 entries');
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
// Test 3: L1 broken -> L2..L6 skipped. L0 still runs and passes (index 0);
// L1 is now at index 1.
// ---------------------------------------------------------------------------
(async function test3_l1_broken_cascade() {
  const label = 'L1 broken -> L2-L6 cascade to skipped-prior-layer-failed (L0 unaffected, passes)';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: null, source: 'not-found', topology: 'not-found' }),
    }, L0_PASS_SEAMS));
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[0].id, 'origin_shadow', 'L0 id');
    assert.equal(result.layers[0].ok, true, 'L0 must pass (no shadow injected, L1 failure does not blind it)');
    assert.equal(result.layers[1].id, 'plugin_root', 'L1 id');
    assert.equal(result.layers[1].ok, false, 'L1 must be false');
    assert.match(result.layers[1].reason, /plugin root not resolved/i, 'L1 reason matches');
    for (let i = 2; i < 7; i++) {
      assert.equal(result.layers[i].ok, false, 'layer index ' + i + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'layer index ' + i + ' reason must be skipped-prior-layer-failed');
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
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: null, source: 'not-found', available: false, reason: 'MINDRIAN_BRAIN_KEY not set (env) ...' }),
    }, L0_PASS_SEAMS));
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[0].ok, true, 'L0 must pass');
    assert.equal(result.layers[1].ok, true, 'L1 must be true');
    assert.equal(result.layers[2].ok, false, 'L2 must be false');
    assert.match(result.layers[2].reason, /MINDRIAN_BRAIN_KEY not set/, 'L2 reason carries the resolver reason');
    for (let i = 3; i < 7; i++) {
      assert.equal(result.layers[i].ok, false, 'layer index ' + i + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'layer index ' + i + ' reason must be skipped-prior-layer-failed');
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
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => null,
    }, L0_PASS_SEAMS));
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[0].ok, true, 'L0 ok');
    assert.equal(result.layers[1].ok, true, 'L1 ok');
    assert.equal(result.layers[2].ok, true, 'L2 ok');
    assert.equal(result.layers[3].ok, false, 'L3 must be false');
    assert.match(result.layers[3].reason, /HTTPS|schema|unreachable/i, 'L3 reason matches');
    for (let i = 4; i < 7; i++) {
      assert.equal(result.layers[i].ok, false, 'layer index ' + i + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'layer index ' + i + ' reason must be skipped-prior-layer-failed');
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
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, opts) => {
        if (opts.intent === 'handshake') return { ok: false, reason: 'handshake timed out after 10000ms' };
        return { ok: true, reason: 'should-not-be-called' };
      },
    }, L0_PASS_SEAMS));
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[4].ok, false, 'L4 must be false');
    assert.match(result.layers[4].reason, /handshake|timeout/i, 'L4 reason matches');
    assert.equal(result.layers[5].ok, false, 'L5 must be false (skipped)');
    assert.equal(result.layers[5].reason, 'skipped-prior-layer-failed', 'L5 reason skipped');
    assert.equal(result.layers[6].ok, false, 'L6 must be false (skipped)');
    assert.equal(result.layers[6].reason, 'skipped-prior-layer-failed', 'L6 reason skipped');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 7: All 7 layers pass; overall_ms < 30000.
// ---------------------------------------------------------------------------
(async function test7_all_pass() {
  const label = 'All 7 layers PASS via mocks; overall_ms < 30000 (30s budget)';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, _opts) => ({ ok: true, reason: 'mocked-success' }),
    }, ALL_PASS_SEAMS));
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
    }, ALL_PASS_SEAMS));
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
    const result = await mod.checkBrainSmoke(Object.assign({}, ALL_PASS_SEAMS, {
      mockResolveRoot: () => ({ root: '/tmp/seam', source: 'opts-mock', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'seam-key', source: 'opts-mock', available: true, reason: null }),
      mockSchema: async () => { mockSchemaCalled = true; return { labels: [], rel_types: [] }; },
      mockSpawn: async (_shimPath, _opts) => { mockSpawnCalled = true; return { ok: true, reason: 'seam-mock' }; },
    }));
    assert.equal(result.ok, true, 'all seams provided -> overall true');
    assert.equal(mockSchemaCalled, true, 'mockSchema seam invoked for L3');
    assert.equal(mockSpawnCalled, true, 'mockSpawn seam invoked for L4 and L5');
    assert.equal(result.layers[1].reason, 'resolved (source=opts-mock, topology=dev-clone)', 'L1 reason carries source');
    // Source-level class letter check (CRITICAL: plan uses Class M, not K).
    const src = fs.readFileSync(SMOKE_PATH, 'utf8');
    assert.match(src, /Class[- ]?M/, 'source must reference Class M (not Class K -- K is taken by --stale-first-touch)');
    assert.equal(src.indexOf('Class K'), -1, 'source MUST NOT reference Class K (collides with existing --stale-first-touch)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 11: L6 store_identity contract (quick task 260819-c9b, WS-E1).
// Now at layers[6] (L0 prepended at index 0).
// ---------------------------------------------------------------------------
(async function test11_store_identity_contract() {
  const label = 'L6 store_identity: stale-replica signature, below-floor, canon pass, null fail-closed, stamp present/absent';
  try {
    const mod = freshLoad();
    const passBase = Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, _opts) => ({ ok: true, reason: 'ok' }),
      mockBrainUrl: () => CANON_BRAIN_URL,
    }, L0_PASS_SEAMS, {
      mockBrainUrl: () => CANON_BRAIN_URL, // shared by L0 and L6; kept explicit here
    });

    // Case A: the stale-replica count 28325 fails and names stale_replica_signature.
    const staleResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ totalRecordCount: 28325 }),
      mockQuery: async () => null,
    }));
    const L6stale = staleResult.layers[6];
    assert.equal(L6stale.id, 'store_identity', 'L6 id');
    assert.equal(L6stale.ok, false, '28325 must FAIL');
    assert.match(L6stale.reason, /stale_replica_signature/, 'reason names stale_replica_signature');

    // Case B: below the floor but NOT the stale signature -> a DIFFERENT
    // failure reason, without the stale_replica_signature token. 500 sits
    // below BOTH the incumbent floor (29000) and the Theo floor (27000), and
    // it is not STALE_REPLICA_NODE_COUNT (28325), so this arm keeps testing
    // the generic floor, not the named signature.
    const belowFloorResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ totalRecordCount: 500 }),
      mockQuery: async () => null,
    }));
    const L6belowFloor = belowFloorResult.layers[6];
    assert.equal(L6belowFloor.ok, false, 'below-floor count must FAIL');
    assert.equal(/stale_replica_signature/.test(L6belowFloor.reason), false,
      'below-floor failure must NOT carry the stale_replica_signature token');

    // Case C: a count above the floor passes and carries payload
    // (incumbent shape: totalRecordCount).
    const passResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ totalRecordCount: 30000 }),
      mockQuery: async () => null,
    }));
    const L6pass = passResult.layers[6];
    assert.equal(L6pass.ok, true, '30000 must PASS');
    assert.ok(L6pass.payload, 'passing layer carries a payload');
    assert.equal(L6pass.payload.endpoint, CANON_BRAIN_URL, 'payload.endpoint');
    assert.equal(L6pass.payload.node_count, 30000, 'payload.node_count');
    assert.equal(L6pass.payload.canon, true, 'payload.canon');
    assert.equal('stamp' in L6pass.payload, false, 'null mockQuery leaves NO stamp key');

    // Case C2 (Phase 339, FLIP-11 prep): a Theo-SHAPED stats payload
    // ({ nodes, relationships, labels }, no totalRecordCount at all) also
    // passes and reports the same node_count, proving the `nodes` half of
    // the dual read. 30000 clears both floors (29000 and 27000).
    const theoShapeResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ nodes: 30000, relationships: 40000, labels: 14 }),
      mockQuery: async () => null,
    }));
    const L6theoShape = theoShapeResult.layers[6];
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
    const L6neitherField = neitherFieldResult.layers[6];
    assert.equal(L6neitherField.ok, false, 'a payload with neither field must FAIL');
    assert.match(L6neitherField.reason, /totalRecordCount/, 'reason names totalRecordCount');
    assert.match(L6neitherField.reason, /nodes/, 'reason names nodes');
    ok('L6 store_identity: neither totalRecordCount nor nodes -- honest FAIL naming both fields (added, not retargeted)');

    // Case D: mockStats returning null fails closed.
    const nullStatsResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => null,
      mockQuery: async () => null,
    }));
    assert.equal(nullStatsResult.layers[6].ok, false, 'null stats must FAIL closed');

    // Case E: a mockQuery returning a records array carrying a non-null
    // schema_version puts a stamp on the payload.
    const stampResult = await mod.checkBrainSmoke(Object.assign({}, passBase, {
      mockStats: async () => ({ totalRecordCount: 30000 }),
      mockQuery: async () => ({ records: [{ schema_version: '1.0', last_reconciled: null, refreshed_at: '2026-08-19' }] }),
    }));
    const L6stamp = stampResult.layers[6];
    assert.equal(L6stamp.ok, true, 'stamp case still passes on count');
    assert.ok(L6stamp.payload.stamp, 'payload carries a stamp key');
    assert.equal(L6stamp.payload.stamp.schema_version, '1.0', 'stamp.schema_version present');
    assert.equal(L6stamp.payload.stamp.refreshed_at, '2026-08-19', 'stamp.refreshed_at present');
    assert.equal('last_reconciled' in L6stamp.payload.stamp, false, 'null stamp fields are omitted, not fabricated');

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test A (AXZ-01): shadow present, user scope. Uses the REAL
// integration-registry.cjs reader against a temp fixture path -- never the
// real ~/.claude.json.
// ---------------------------------------------------------------------------
(async function testA_shadow_user_scope() {
  const label = 'Test A: shadow present (user scope) -- not-ok, names scope/host, exact fix line, plugin-provides sentence, zero secret leak';
  let tmpDir;
  try {
    const mod = freshLoad();
    tmpDir = mkTmpConfigDir();
    const fixturePath = path.join(tmpDir, 'claude.json');
    fs.writeFileSync(fixturePath, JSON.stringify({
      mcpServers: {
        'mindrian-brain': {
          type: 'http',
          url: 'https://mindrian-brain.onrender.com/mcp',
          headers: { Authorization: 'Bearer sk-SHOULD-NEVER-APPEAR' },
        },
      },
    }));
    const result = await mod.checkBrainSmoke(Object.assign({}, ALL_PASS_SEAMS, {
      mockScopedServers: undefined, // force the REAL reader for this arm
      claudeConfigPath: fixturePath,
      projectDir: '/nonexistent-project-dir',
    }));
    const L0 = result.layers[0];
    assert.equal(L0.id, 'origin_shadow', 'L0 id');
    assert.equal(L0.ok, false, 'L0 must be not-ok when a shadow is present');
    assert.match(L0.reason, /\buser\b/, 'reason names scope user');
    assert.match(L0.reason, /mindrian-brain\.onrender\.com/, 'reason contains the host');
    assert.ok(
      L0.reason.indexOf('claude mcp remove mindrian-brain -s user') !== -1,
      'reason contains the exact removal command'
    );
    assert.match(L0.reason, /the plugin provides this server/, 'reason states the plugin provides this server');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.indexOf('sk-SHOULD-NEVER-APPEAR'), -1, 'must not leak the planted secret');
    assert.equal(serialized.indexOf('Bearer'), -1, 'must not leak the word Bearer');
    assert.equal(serialized.indexOf('Authorization'), -1, 'must not leak the word Authorization');
    assert.equal(serialized.indexOf('/mcp'), -1, 'must not leak the full /mcp URL path');
    ok(label);
  } catch (e) { fail(label, e); } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();

// ---------------------------------------------------------------------------
// Test B (AXZ-01): shadow present, local scope (projects[dir].mcpServers).
// ---------------------------------------------------------------------------
(async function testB_shadow_local_scope() {
  const label = 'Test B: shadow present (local scope) -- scope local, fix line -s local';
  let tmpDir;
  try {
    const mod = freshLoad();
    tmpDir = mkTmpConfigDir();
    const fixturePath = path.join(tmpDir, 'claude.json');
    const projectDir = '/some/dir';
    fs.writeFileSync(fixturePath, JSON.stringify({
      projects: {
        [projectDir]: {
          mcpServers: {
            'mindrian-brain': {
              type: 'http',
              url: 'https://mindrian-brain.onrender.com/mcp',
              headers: { Authorization: 'Bearer sk-SHOULD-NEVER-APPEAR-2' },
            },
          },
        },
      },
    }));
    const result = await mod.checkBrainSmoke(Object.assign({}, ALL_PASS_SEAMS, {
      mockScopedServers: undefined,
      claudeConfigPath: fixturePath,
      projectDir: projectDir,
    }));
    const L0 = result.layers[0];
    assert.equal(L0.ok, false, 'must be not-ok for a local-scope shadow');
    assert.match(L0.reason, /\blocal\b/, 'reason names scope local');
    assert.ok(
      L0.reason.indexOf('claude mcp remove mindrian-brain -s local') !== -1,
      'reason contains the exact local-scope removal command'
    );
    ok(label);
  } catch (e) { fail(label, e); } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();

// ---------------------------------------------------------------------------
// Test C (AXZ-01): no shadow -- unrelated servers only.
// ---------------------------------------------------------------------------
(async function testC_no_shadow() {
  const label = 'Test C: no shadow -- ok true, reason says none found';
  let tmpDir;
  try {
    const mod = freshLoad();
    tmpDir = mkTmpConfigDir();
    const fixturePath = path.join(tmpDir, 'claude.json');
    fs.writeFileSync(fixturePath, JSON.stringify({
      mcpServers: {
        theo: { command: 'node', args: ['theo.cjs'] },
        pinecone: { type: 'http', url: 'https://pinecone.example.com/mcp' },
      },
    }));
    const result = await mod.checkBrainSmoke(Object.assign({}, ALL_PASS_SEAMS, {
      mockScopedServers: undefined,
      claudeConfigPath: fixturePath,
      projectDir: '/nonexistent-project-dir',
    }));
    const L0 = result.layers[0];
    assert.equal(L0.ok, true, 'no shadow -> ok true');
    assert.match(L0.reason, /no shadowing/i, 'reason says no shadowing entry found');
    ok(label);
  } catch (e) { fail(label, e); } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();

// ---------------------------------------------------------------------------
// Test D (AXZ-01): the plugin's own .mcp.json shim is never consulted by
// this layer -- the reader is called exactly once, and always with the
// Claude Code config path, never a .mcp.json path.
// ---------------------------------------------------------------------------
(async function testD_shim_never_shadow() {
  const label = "Test D: the plugin's own .mcp.json shim is never consulted; reader called once with the Claude Code path";
  let tmpDir;
  try {
    const mod = freshLoad();
    tmpDir = mkTmpConfigDir();
    const mcpJsonPath = path.join(tmpDir, '.mcp.json');
    fs.writeFileSync(mcpJsonPath, JSON.stringify({ mcpServers: { 'mindrian-brain': { command: 'node' } } }));
    const claudeCodePath = path.join(tmpDir, 'claude.json');
    fs.writeFileSync(claudeCodePath, JSON.stringify({ mcpServers: {} }));

    let callCount = 0;
    const calls = [];
    const result = await mod.checkBrainSmoke(Object.assign({}, ALL_PASS_SEAMS, {
      mockScopedServers: function (readerOpts) {
        callCount += 1;
        calls.push(readerOpts);
        return [];
      },
      claudeConfigPath: claudeCodePath,
      projectDir: tmpDir,
    }));
    assert.ok(result, 'result present');
    assert.equal(callCount, 1, 'the reader is called exactly once');
    assert.equal(calls[0].configPath, claudeCodePath, 'reader called with the Claude Code config path');
    assert.notEqual(calls[0].configPath, mcpJsonPath, 'reader is never called with the .mcp.json path');
    ok(label);
  } catch (e) { fail(label, e); } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();

// ---------------------------------------------------------------------------
// Test E (AXZ-01): resolved-origin row, always reported.
// ---------------------------------------------------------------------------
(async function testE_resolved_origin_row() {
  const label = 'Test E: resolved-origin row -- resolved_origin/is_theo/override/theo_health carried, reason names origin';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({}, ALL_PASS_SEAMS, {
      mockScopedServers: () => [],
      mockBrainUrl: () => CANON_BRAIN_URL,
      mockTheoHealth: async () => ({ mode: 'ok', build_stamp: { sha: 'abc1234' } }),
    }));
    const L0 = result.layers[0];
    assert.equal(L0.payload.resolved_origin, CANON_BRAIN_URL, 'payload.resolved_origin');
    assert.equal(L0.payload.is_theo, true, 'payload.is_theo true for a Theo origin');
    assert.equal(L0.payload.override, false, 'payload.override false when MINDRIAN_BRAIN_URL is unset');
    assert.ok(L0.payload.theo_health, 'payload.theo_health present');
    assert.equal(L0.payload.theo_health.mode, 'ok', 'theo_health.mode');
    assert.equal(L0.payload.theo_health.build_sha, 'abc1234', 'theo_health.build_sha');
    assert.ok(L0.reason.indexOf(CANON_BRAIN_URL) !== -1, 'reason names the resolved origin');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test F (AXZ-01): theo_health rejection degrades honestly.
// ---------------------------------------------------------------------------
(async function testF_origin_degrades_honestly() {
  const label = 'Test F: theo_health rejection degrades honestly -- no throw, no theo_health key, ok unaffected';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({}, ALL_PASS_SEAMS, {
      mockScopedServers: () => [],
      mockBrainUrl: () => CANON_BRAIN_URL,
      mockTheoHealth: async () => { throw new Error('boom'); },
    }));
    const L0 = result.layers[0];
    assert.equal(L0.ok, true, 'ok unaffected by a theo_health rejection (no shadow present)');
    assert.equal('theo_health' in L0.payload, false, 'theo_health key absent on rejection');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test G (AXZ-01): non-Theo origin with MINDRIAN_BRAIN_URL override.
// ---------------------------------------------------------------------------
(async function testG_non_theo_origin() {
  const label = 'Test G: non-Theo origin, MINDRIAN_BRAIN_URL override -- is_theo false, override true, ok follows shadow only';
  // A non-Theo origin literal, deliberately NOT a real onrender.com host:
  // tests/test-339-origin-single-source.cjs scans lib/ for exactly those
  // origin literals and this file is not on its two-entry allowlist. Any
  // fixture host outside THEO_ORIGINS exercises the is_theo=false branch
  // just as well.
  const NON_THEO_ORIGIN = 'https://not-theo-origin.example.test';
  const prevEnv = process.env.MINDRIAN_BRAIN_URL;
  try {
    process.env.MINDRIAN_BRAIN_URL = NON_THEO_ORIGIN;
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({}, ALL_PASS_SEAMS, {
      mockScopedServers: () => [],
      mockBrainUrl: () => NON_THEO_ORIGIN,
      mockTheoHealth: async () => null,
    }));
    const L0 = result.layers[0];
    assert.equal(L0.payload.is_theo, false, 'is_theo false for a non-Theo origin');
    assert.equal(L0.payload.override, true, 'override true when MINDRIAN_BRAIN_URL is set');
    assert.equal(L0.ok, true, 'ok reflects the shadow verdict only (no shadow present here)');
    ok(label);
  } catch (e) { fail(label, e); } finally {
    if (prevEnv === undefined) delete process.env.MINDRIAN_BRAIN_URL;
    else process.env.MINDRIAN_BRAIN_URL = prevEnv;
  }
})();

// ---------------------------------------------------------------------------
// Test H (AXZ-01): no short circuit -- shadow present AND every L1-L6 mock
// passing must still run and report L1-L6 truthfully.
// ---------------------------------------------------------------------------
(async function testH_no_short_circuit() {
  const label = 'Test H: shadow present does not blind L1-L6 -- all 7 layers run, zero skipped-prior-layer-failed';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke(Object.assign({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, _opts) => ({ ok: true, reason: 'mocked-success' }),
    }, ALL_PASS_SEAMS, {
      mockScopedServers: () => [{ name: 'mindrian-brain', scope: 'user', url_host: 'mindrian-brain.onrender.com', type: 'http' }],
    }));
    assert.equal(result.layers.length, 7, 'layers.length === 7');
    assert.equal(result.layers[0].id, 'origin_shadow', 'layers[0].id');
    assert.equal(result.layers[0].ok, false, 'layers[0].ok false (shadow present)');
    for (let i = 1; i < 7; i++) {
      assert.equal(result.layers[i].ok, true, 'layer index ' + i + ' must PASS, not be blinded by L0');
      assert.notEqual(result.layers[i].reason, 'skipped-prior-layer-failed', 'layer index ' + i + ' must never be skipped');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test I (AXZ-01): THEO_NODE_FLOOR moved to 27000; CANON_NODE_FLOOR unchanged.
// ---------------------------------------------------------------------------
(async function testI_floor() {
  const label = 'Test I: THEO_NODE_FLOOR === 27000 (exported), CANON_NODE_FLOOR unchanged at 29000';
  try {
    const mod = freshLoad();
    assert.equal(mod.THEO_NODE_FLOOR, 27000, 'THEO_NODE_FLOOR must be 27000');
    assert.equal(mod.CANON_NODE_FLOOR, 29000, 'CANON_NODE_FLOOR must stay 29000');

    const commonMocks = {
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async () => ({ ok: true, reason: 'ok' }),
    };

    const belowResult = await mod.checkBrainSmoke(Object.assign({}, commonMocks, ALL_PASS_SEAMS, {
      mockStats: async () => ({ nodes: 26999 }),
    }));
    const L6below = belowResult.layers[6];
    assert.equal(L6below.ok, false, '26999 must fail the 27000 floor');
    assert.match(L6below.reason, /26999/, 'reason names the count');
    assert.match(L6below.reason, /27000/, 'reason names the floor');

    const aboveResult = await mod.checkBrainSmoke(Object.assign({}, commonMocks, ALL_PASS_SEAMS, {
      mockStats: async () => ({ nodes: 27951 }),
    }));
    const L6above = aboveResult.layers[6];
    assert.equal(L6above.ok, true, '27951 (the 2026-09-11 measured count) must pass the 27000 floor');

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
