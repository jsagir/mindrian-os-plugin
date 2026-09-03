#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 06 Task 1 -- Pinecone bridge fixture suite.
 *
 * 4 standalone scenarios for the CJS->Python bridge that wraps
 * rs_cache.py::fetch_all_from_namespace to retrieve 1024-dim
 * Pinecone-direct vectors for the differential scorer's BERT cosine.
 *
 *   Test 1  no room scope (Plan 296-05, was PINECONE_API_KEY absent) ->
 *           graceful degradation returns
 *           {success: false, error: 'room_scope_missing'}
 *           does NOT throw. The never-throw property this test asserts is
 *           unchanged by the repoint; only the trigger condition and the
 *           expected error tag changed (no key required any more -- what
 *           IS required is a room to scope the local signal cache to).
 *   Test 2  python3 absent -> graceful degradation
 *           mock spawnSync returns {error: {code: 'ENOENT'}};
 *           returns {success: false, error: 'python_unavailable'}.
 *   Test 3  happy path -> mock spawnSync returns 1024-dim values;
 *           assert success === true AND hits[0].values.length === 1024.
 *   Test 4  cosineSimilarity identity -- pure JS dot product /
 *           norm(a)*norm(b); identity 1.0 within 1e-9 tolerance;
 *           anti-parallel -1.0 within 1e-9 tolerance.
 *
 * Suite-end audit:
 *   A1  walk every captured bridge input/output;
 *       JSON.stringify + FORBIDDEN_PATTERNS scan;
 *       assert ZERO hits across all 4 scenarios.
 *
 * Mocks via require.cache override (Phase 89.1a-03 / 90-08 pattern).
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, path).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const SCENARIO_RESULTS = [];

// ---------- Mock spawnSync via require.cache override of child_process ----------
//
// We replace child_process.spawnSync per-scenario so the bridge invokes our
// mock instead of forking python3. resetRequireCache restores between
// scenarios.

let mockSpawnSyncImpl = null;

function installMockSpawnSync(impl) {
  mockSpawnSyncImpl = impl;
  const cpPath = require.resolve('child_process');
  delete require.cache[cpPath];
  const realCP = require('child_process');
  const fakeCP = Object.assign({}, realCP, {
    spawnSync: function (cmd, args, opts) {
      if (mockSpawnSyncImpl) {
        return mockSpawnSyncImpl(cmd, args, opts);
      }
      return realCP.spawnSync(cmd, args, opts);
    },
  });
  require.cache[cpPath] = {
    id: cpPath,
    filename: cpPath,
    loaded: true,
    exports: fakeCP,
  };
}

function resetRequireCache() {
  mockSpawnSyncImpl = null;
  const targets = [
    'child_process',
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/rs-pinecone-bridge.cjs',
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

function captureResult(name, result) {
  SCENARIO_RESULTS.push({ scenario: name, result: result });
}

// ---------- Scenarios ----------

async function scenario1RoomScopeAbsent() {
  // Ensure no room scope reaches the bridge: no roomDir argument, and
  // neither env fallback set. PINECONE_API_KEY is irrelevant after the
  // repoint (Plan 296-05); we no longer touch it here.
  const prevRsRoom = process.env.MINDRIAN_RS_ROOM;
  const prevRoom = process.env.MINDRIAN_ROOM;
  delete process.env.MINDRIAN_RS_ROOM;
  delete process.env.MINDRIAN_ROOM;
  try {
    const m = require('../core/rs-pinecone-bridge.cjs');
    let result = null;
    let threw = null;
    try {
      result = await m.queryPineconeWithVectors('external:test-ns', 'cancer query', 10);
    } catch (err) {
      threw = err;
    }
    assert.equal(threw, null, 'queryPineconeWithVectors must NEVER throw on missing room scope; got ' + (threw && threw.message));
    assert.ok(result, 'result returned');
    assert.equal(result.success, false, 'success false on missing room scope');
    assert.equal(result.error, 'room_scope_missing', 'error tag matches; got ' + result.error);
    captureResult('1-room-scope-absent', result);
  } finally {
    if (prevRsRoom !== undefined) process.env.MINDRIAN_RS_ROOM = prevRsRoom;
    if (prevRoom !== undefined) process.env.MINDRIAN_ROOM = prevRoom;
  }
}

async function scenario2PythonAbsent() {
  // Pass an explicit roomDir so we get past the room-scope gate (Plan
  // 296-05; was the PINECONE_API_KEY env-var gate).
  installMockSpawnSync(function (_cmd, _args, _opts) {
    return { error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) };
  });
  try {
    const m = require('../core/rs-pinecone-bridge.cjs');
    let result = null;
    let threw = null;
    try {
      result = await m.queryPineconeWithVectors('external:test-ns', 'cancer query', 10, '/tmp/mindrian-test-room');
    } catch (err) {
      threw = err;
    }
    assert.equal(threw, null, 'queryPineconeWithVectors must NEVER throw on python3 ENOENT; got ' + (threw && threw.message));
    assert.ok(result, 'result returned');
    assert.equal(result.success, false, 'success false on python3 ENOENT');
    assert.equal(result.error, 'python_unavailable', 'error tag matches; got ' + result.error);
    captureResult('2-python-absent', result);
  } finally {
    /* no env mutation to restore */
  }
}

async function scenario3HappyPath() {
  // Build deterministic 1024-dim values.
  const values = new Array(1024).fill(0.001);
  values[0] = 1.0;
  const mockHits = [
    { id: 'doc-a', score: 0.85, values: values, metadata: { title: 'cancer biology paper', source: 'arxiv' } },
    { id: 'doc-b', score: 0.71, values: new Array(1024).fill(0.0005), metadata: { title: 'immunotherapy review', source: 'openalex' } },
  ];
  installMockSpawnSync(function (_cmd, _args, _opts) {
    return {
      status: 0,
      stdout: JSON.stringify({ success: true, hits: mockHits }),
      stderr: '',
    };
  });
  try {
    const m = require('../core/rs-pinecone-bridge.cjs');
    // roomDir (4th arg) gets us past the room-scope gate (Plan 296-05).
    const result = await m.queryPineconeWithVectors('external:test-ns', 'cancer biology', 10, '/tmp/mindrian-test-room');
    assert.ok(result, 'result returned');
    assert.equal(result.success, true, 'success true on happy path');
    assert.ok(Array.isArray(result.hits), 'hits is array');
    assert.equal(result.hits.length, 2, 'two hits');
    assert.equal(result.hits[0].id, 'doc-a', 'first hit id matches');
    assert.equal(result.hits[0].values.length, 1024, 'values is 1024-dim');
    assert.equal(result.hits[1].values.length, 1024, 'second hit also 1024-dim');
    captureResult('3-happy-path', result);
  } finally {
    /* no env mutation to restore */
  }
}

async function scenario4CosineSimilarityIdentity() {
  const m = require('../core/rs-pinecone-bridge.cjs');
  // Identity vector.
  const v1 = new Array(1024).fill(0);
  v1[0] = 1;
  const v2 = new Array(1024).fill(0);
  v2[0] = 1;
  const c1 = m.cosineSimilarity(v1, v2);
  assert.ok(Math.abs(c1 - 1.0) < 1e-9, 'identity cosine == 1.0; got ' + c1);
  // Anti-parallel.
  const v3 = new Array(1024).fill(0);
  v3[0] = -1;
  const c2 = m.cosineSimilarity(v1, v3);
  assert.ok(Math.abs(c2 + 1.0) < 1e-9, 'anti-parallel cosine == -1.0; got ' + c2);
  // Orthogonal.
  const v4 = new Array(1024).fill(0);
  v4[1] = 1;
  const c3 = m.cosineSimilarity(v1, v4);
  assert.ok(Math.abs(c3) < 1e-9, 'orthogonal cosine == 0.0; got ' + c3);
  captureResult('4-cosine-identity', { c1: c1, c2: c2, c3: c3 });
}

// ---------- A1 sweep ----------

function a1Sweep() {
  // Re-import FORBIDDEN_PATTERNS fresh.
  const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
  const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;
  let hits = 0;
  for (const rec of SCENARIO_RESULTS) {
    const json = JSON.stringify(rec.result);
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
  process.stdout.write('=== 89.2-06-pinecone-bridge suite (REPO_ROOT=' + REPO_ROOT + ') ===\n');

  await runScenario('1-room-scope-absent', scenario1RoomScopeAbsent);
  await runScenario('2-python-absent', scenario2PythonAbsent);
  await runScenario('3-happy-path', scenario3HappyPath);
  await runScenario('4-cosine-identity', scenario4CosineSimilarityIdentity);

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
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.stdout.write('=== 89.2-06-pinecone-bridge suite: ' + passed + '/4 passed (' + failed + ' failed) ===\n');
    process.exit(1);
  }
  process.stdout.write('=== 89.2-06-pinecone-bridge suite: 4/4 passed ===\n');
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
