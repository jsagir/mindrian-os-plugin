#!/usr/bin/env node
'use strict';

/*
 * Phase 127-02 Task 2 (TDD RED -> GREEN) -- Class M Brain smoke probe tests.
 *
 * Covers BRAIN-MCP-127-08 acceptance (CONTEXT Deliverable 4):
 *   Test 1:  LAYERS constant -- exactly 5 entries with stable ids
 *   Test 2:  checkBrainSmoke() returns { ok, layers: [5 x {id,name,ok,reason,ms}], overall_ms }
 *   Test 3:  L1 broken topology -> L2-L5 SKIPPED with reason "skipped-prior-layer-failed"
 *   Test 4:  L1 OK + L2 no-key -> L3-L5 SKIPPED
 *   Test 5:  L1 + L2 OK + L3 unreachable -> L4-L5 SKIPPED
 *   Test 6:  L1 + L2 + L3 OK + L4 timeout -> L5 SKIPPED
 *   Test 7:  All 5 layers pass when all mocks succeed; overall_ms < 30000
 *   Test 8:  Each layer.ms >= 0 (sanity); ms fields are numbers
 *   Test 9:  fixBrainSmoke is a no-op (diagnostic-only invariant)
 *   Test 10: opts injection seams (mockResolveRoot/mockResolveKey/mockSchema/mockSpawn)
 *
 * Hermetic via the opts injection seams -- NO real network IO, NO real spawn.
 * The shell harness in tests/test-127-02-doctor-class-m.sh exercises real spawn
 * against the actual shim binary.
 *
 * Canon parts:
 *   - Part 7 (reuse): LAYERS L1/L2/L3 import the existing resolver chokepoints
 *                     (active-plugin-root, resolve-brain-key, brain-client.schema)
 *   - Part 8 (graph boundary): the smoke probe queries brain_schema only (a
 *                              generic methodology handle); zero user content
 *                              egress in the smoke surface.
 *
 * HARD RULE: no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SMOKE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'class-m-brain-smoke.cjs');

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

// ---------------------------------------------------------------------------
// Test 1: LAYERS constant shape.
// ---------------------------------------------------------------------------
(async function test1_layers_constant() {
  const label = 'LAYERS constant: 5 frozen entries with stable ids';
  try {
    const mod = freshLoad();
    assert.ok(Array.isArray(mod.LAYERS), 'LAYERS must be an array');
    assert.equal(mod.LAYERS.length, 5, 'LAYERS must have exactly 5 entries');
    const ids = mod.LAYERS.map(l => l.id);
    assert.deepEqual(ids, [
      'plugin_root',
      'key_resolver',
      'https_schema',
      'stdio_handshake',
      'e2e_brain_schema',
    ], 'LAYERS ids must match the canonical 5-layer probe order');
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
  const label = 'checkBrainSmoke() returns { ok, layers:[5], overall_ms }';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke({
      // All-pass mock chain for shape assertion
      mockResolveRoot: () => ({ root: '/tmp/fake-root', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'], rel_types: [] }),
      mockSpawn: async (_shimPath, opts) => ({ ok: true, reason: 'mocked ' + opts.intent }),
    });
    assert.equal(typeof result.ok, 'boolean', 'ok must be boolean');
    assert.ok(Array.isArray(result.layers), 'layers must be an array');
    assert.equal(result.layers.length, 5, 'layers must have 5 entries');
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
// Test 3: L1 broken -> L2..L5 skipped.
// ---------------------------------------------------------------------------
(async function test3_l1_broken_cascade() {
  const label = 'L1 broken -> L2-L5 cascade to skipped-prior-layer-failed';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke({
      mockResolveRoot: () => ({ root: null, source: 'not-found', topology: 'not-found' }),
    });
    assert.equal(result.ok, false, 'overall must be false');
    assert.equal(result.layers[0].id, 'plugin_root', 'L1 id');
    assert.equal(result.layers[0].ok, false, 'L1 must be false');
    assert.match(result.layers[0].reason, /plugin root not resolved/i, 'L1 reason matches');
    for (let i = 1; i < 5; i++) {
      assert.equal(result.layers[i].ok, false, 'L' + (i + 1) + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'L' + (i + 1) + ' reason must be skipped-prior-layer-failed');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 4: L1 OK + L2 no key -> L3-L5 skipped.
// ---------------------------------------------------------------------------
(async function test4_l2_no_key_cascade() {
  const label = 'L1 OK + L2 no key -> L3-L5 cascade to skipped';
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
    for (let i = 2; i < 5; i++) {
      assert.equal(result.layers[i].ok, false, 'L' + (i + 1) + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'L' + (i + 1) + ' reason must be skipped-prior-layer-failed');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 5: L1+L2 OK + L3 unreachable -> L4-L5 skipped.
// ---------------------------------------------------------------------------
(async function test5_l3_unreachable_cascade() {
  const label = 'L1+L2 OK + L3 returns null -> L4-L5 cascade to skipped';
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
    for (let i = 3; i < 5; i++) {
      assert.equal(result.layers[i].ok, false, 'L' + (i + 1) + ' must be false (skipped)');
      assert.equal(result.layers[i].reason, 'skipped-prior-layer-failed',
        'L' + (i + 1) + ' reason must be skipped-prior-layer-failed');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 6: L1+L2+L3 OK + L4 handshake timeout -> L5 skipped.
// ---------------------------------------------------------------------------
(async function test6_l4_handshake_timeout() {
  const label = 'L1+L2+L3 OK + L4 timeout -> L5 cascade to skipped';
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
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 7: All 5 layers pass; overall_ms < 30000.
// ---------------------------------------------------------------------------
(async function test7_all_pass() {
  const label = 'All 5 layers PASS via mocks; overall_ms < 30000 (30s budget)';
  try {
    const mod = freshLoad();
    const result = await mod.checkBrainSmoke({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, _opts) => ({ ok: true, reason: 'mocked-success' }),
    });
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
    const result = await mod.checkBrainSmoke({
      mockResolveRoot: () => ({ root: '/tmp/fake', source: 'env', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'k', source: 'env', available: true, reason: null }),
      mockSchema: async () => ({ labels: ['Framework'] }),
      mockSpawn: async (_shimPath, _opts) => ({ ok: true, reason: 'ok' }),
    });
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
    const result = await mod.checkBrainSmoke({
      mockResolveRoot: () => ({ root: '/tmp/seam', source: 'opts-mock', topology: 'dev-clone' }),
      mockResolveKey: () => ({ key: 'seam-key', source: 'opts-mock', available: true, reason: null }),
      mockSchema: async () => { mockSchemaCalled = true; return { labels: [], rel_types: [] }; },
      mockSpawn: async (_shimPath, _opts) => { mockSpawnCalled = true; return { ok: true, reason: 'seam-mock' }; },
    });
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
