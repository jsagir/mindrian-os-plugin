#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 06 Task 3 -- differential scorer fixture suite.
 *
 * 10 scenarios for the dual-floor differential scorer:
 *   passes === (diff > 0.3 AND lsa > 0.2 AND bert > 0.2)
 *
 *   Test 1  happy path -- pair passes dual-floor (lsa=0.6 bert=0.25 -> diff=0.35)
 *   Test 2  dual-floor fail: diff <= 0.3 (lsa=0.5 bert=0.4 -> diff=0.1)
 *   Test 3  dual-floor fail: lsa <= 0.2 (lsa=0.15 bert=0.5)
 *   Test 4  dual-floor fail: bert <= 0.2 (lsa=0.5 bert=0.15)
 *   Test 5  boundary at exact threshold (lsa=0.2 bert=0.2 -> diff=0; passes=false)
 *   Test 6  graceful degradation when bridge fails -> bert=null, warning='bert_unavailable'
 *   Test 7  graceful degradation when LSA bridge fails -> diff=null, warning='lsa_unavailable'
 *   Test 8  determinism: same inputs invoked twice -> identical output
 *   Test 9  CANON PART 8 adversarial: forbidden in query_concept -> rejected at gate
 *   Test 10 CANON PART 8 adversarial: forbidden in doc_concept -> rejected at gate
 *
 * Mocks the LSA Python bridge (spawnSync) AND the rs-pinecone-bridge
 * (require.cache override), so all branches are deterministic.
 *
 * Suite-end audit:
 *   A1  walk every captured score result; JSON.stringify scan against
 *       FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS; ZERO hits.
 *
 * Pure CJS, zero npm deps, node built-ins only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;

const DANGEROUS_SUBSTRINGS = Object.freeze([
  'Lawrence',
  '5.2M',
  'meeting with',
  'jonathan@mindrian.com',
  '123-45-6789',
]);

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const SCENARIO_RESULTS = [];

// ---------- Mock plumbing ----------
//
// Two mocks are needed:
//   1. spawnSync (for the LSA Python bridge)
//   2. rs-pinecone-bridge.cjs (for the BERT cosine path)

let mockSpawnSyncImpl = null;
let mockPineconeImpl = null;

function installMockSpawnSync(impl) {
  mockSpawnSyncImpl = impl;
  const cpPath = require.resolve('child_process');
  delete require.cache[cpPath];
  const realCP = require('child_process');
  const fakeCP = Object.assign({}, realCP, {
    spawnSync: function (cmd, args, opts) {
      if (mockSpawnSyncImpl) return mockSpawnSyncImpl(cmd, args, opts);
      return realCP.spawnSync(cmd, args, opts);
    },
  });
  require.cache[cpPath] = {
    id: cpPath, filename: cpPath, loaded: true, exports: fakeCP,
  };
}

function installMockPinecone(impl) {
  mockPineconeImpl = impl;
  const pPath = require.resolve('../core/rs-pinecone-bridge.cjs');
  delete require.cache[pPath];
  const realP = require('../core/rs-pinecone-bridge.cjs');
  const fakeP = Object.assign({}, realP, {
    queryPineconeWithVectors: async function (ns, query, topK) {
      if (mockPineconeImpl) return mockPineconeImpl(ns, query, topK);
      return realP.queryPineconeWithVectors(ns, query, topK);
    },
    cosineSimilarity: realP.cosineSimilarity,
  });
  require.cache[pPath] = {
    id: pPath, filename: pPath, loaded: true, exports: fakeP,
  };
}

function resetRequireCache() {
  mockSpawnSyncImpl = null;
  mockPineconeImpl = null;
  const targets = [
    'child_process',
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/rs-pinecone-bridge.cjs',
    '../core/rs-differential-scorer.cjs',
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

// ---------- Helpers for mock spawnSync (LSA bridge) ----------

function mockLsaSuccess(cosine) {
  return function (_cmd, _args, _opts) {
    return {
      status: 0,
      stdout: JSON.stringify({ success: true, cosine: cosine }),
      stderr: '',
    };
  };
}

function mockLsaFailure() {
  return function (_cmd, _args, _opts) {
    return {
      status: 1,
      stdout: JSON.stringify({ success: false, error: 'simulated_lsa_failure' }),
      stderr: 'simulated stderr',
    };
  };
}

function makeMockHits(values) {
  return [{ id: 'q', score: 0.99, values: values, metadata: {} }];
}

function vec1024At(idx, mag) {
  const v = new Array(1024).fill(0);
  v[idx] = mag;
  return v;
}

// ---------- Scenarios ----------

async function scenario1HappyPathPasses() {
  // Reverse case from plan: lsa=0.6, bert=0.25 -> diff=0.35; passes=true (strict > thresholds).
  installMockSpawnSync(mockLsaSuccess(0.6));
  // Build two unit vectors with cosine 0.25.
  // Use cos(angle) = 0.25 -> a=[1,0,...], b=[0.25, sqrt(1-0.0625), 0,...]
  const va = vec1024At(0, 1);
  const vb = new Array(1024).fill(0);
  vb[0] = 0.25;
  vb[1] = Math.sqrt(1 - 0.0625);
  let pineconeCallCount = 0;
  installMockPinecone(async function (_ns, _q, _t) {
    pineconeCallCount += 1;
    if (pineconeCallCount === 1) return { success: true, hits: makeMockHits(va) };
    return { success: true, hits: makeMockHits(vb) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  const out = await m.score('cancer immunotherapy', 'checkpoint inhibitor', { namespace: 'external:test' });
  captureResult('1-happy-path-passes', out);
  assert.equal(typeof out.lsa, 'number', 'lsa is number');
  assert.ok(Math.abs(out.lsa - 0.6) < 1e-6, 'lsa == 0.6');
  assert.equal(typeof out.bert, 'number', 'bert is number');
  assert.ok(Math.abs(out.bert - 0.25) < 1e-6, 'bert == 0.25; got ' + out.bert);
  assert.ok(Math.abs(out.diff - 0.35) < 1e-6, 'diff == 0.35; got ' + out.diff);
  assert.equal(out.passes, true, 'passes should be true (diff=0.35>0.3, lsa=0.6>0.2, bert=0.25>0.2)');
}

async function scenario2DualFloorFailDiff() {
  // lsa=0.5, bert=0.4 -> diff=0.1; passes=false (diff <= 0.3 fails).
  installMockSpawnSync(mockLsaSuccess(0.5));
  const va = vec1024At(0, 1);
  const vb = new Array(1024).fill(0);
  vb[0] = 0.4;
  vb[1] = Math.sqrt(1 - 0.16);
  let cnt = 0;
  installMockPinecone(async function () {
    cnt += 1;
    return { success: true, hits: makeMockHits(cnt === 1 ? va : vb) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  const out = await m.score('q', 'd', { namespace: 'external:test' });
  captureResult('2-fail-diff', out);
  assert.ok(Math.abs(out.lsa - 0.5) < 1e-6, 'lsa == 0.5');
  assert.ok(Math.abs(out.bert - 0.4) < 1e-6, 'bert == 0.4');
  assert.ok(out.diff <= 0.3, 'diff <= 0.3');
  assert.equal(out.passes, false, 'passes should be false (diff floor)');
}

async function scenario3DualFloorFailLsa() {
  // lsa=0.15, bert=0.5 -> diff=0.35; passes=false (lsa floor failed).
  installMockSpawnSync(mockLsaSuccess(0.15));
  const va = vec1024At(0, 1);
  const vb = new Array(1024).fill(0);
  vb[0] = 0.5;
  vb[1] = Math.sqrt(1 - 0.25);
  let cnt = 0;
  installMockPinecone(async function () {
    cnt += 1;
    return { success: true, hits: makeMockHits(cnt === 1 ? va : vb) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  const out = await m.score('q', 'd', { namespace: 'external:test' });
  captureResult('3-fail-lsa', out);
  assert.ok(Math.abs(out.lsa - 0.15) < 1e-6, 'lsa == 0.15');
  assert.ok(out.lsa <= 0.2, 'lsa <= 0.2');
  assert.equal(out.passes, false, 'passes should be false (lsa floor)');
}

async function scenario4DualFloorFailBert() {
  // lsa=0.5, bert=0.15 -> diff=0.35; passes=false (bert floor failed).
  installMockSpawnSync(mockLsaSuccess(0.5));
  const va = vec1024At(0, 1);
  const vb = new Array(1024).fill(0);
  vb[0] = 0.15;
  vb[1] = Math.sqrt(1 - 0.0225);
  let cnt = 0;
  installMockPinecone(async function () {
    cnt += 1;
    return { success: true, hits: makeMockHits(cnt === 1 ? va : vb) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  const out = await m.score('q', 'd', { namespace: 'external:test' });
  captureResult('4-fail-bert', out);
  assert.ok(Math.abs(out.bert - 0.15) < 1e-6, 'bert == 0.15');
  assert.ok(out.bert <= 0.2, 'bert <= 0.2');
  assert.equal(out.passes, false, 'passes should be false (bert floor)');
}

async function scenario5BoundaryAtExactThreshold() {
  // lsa=0.2, bert=0.2 -> diff=0; passes=false (strict > comparison).
  installMockSpawnSync(mockLsaSuccess(0.2));
  const va = vec1024At(0, 1);
  const vb = new Array(1024).fill(0);
  vb[0] = 0.2;
  vb[1] = Math.sqrt(1 - 0.04);
  let cnt = 0;
  installMockPinecone(async function () {
    cnt += 1;
    return { success: true, hits: makeMockHits(cnt === 1 ? va : vb) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  const out = await m.score('q', 'd', { namespace: 'external:test' });
  captureResult('5-boundary', out);
  assert.ok(Math.abs(out.lsa - 0.2) < 1e-6, 'lsa == 0.2');
  assert.ok(Math.abs(out.bert - 0.2) < 1e-6, 'bert == 0.2');
  assert.equal(out.passes, false, 'passes false at exact threshold (strict > comparison)');
}

async function scenario6BridgeFailsBertUnavailable() {
  // LSA succeeds; Pinecone bridge returns success:false.
  installMockSpawnSync(mockLsaSuccess(0.45));
  installMockPinecone(async function () {
    return { success: false, error: 'pinecone_api_key_missing' };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  const out = await m.score('q', 'd', { namespace: 'external:test' });
  captureResult('6-bert-unavailable', out);
  assert.equal(out.bert, null, 'bert is null on bridge failure');
  assert.equal(out.warning, 'bert_unavailable', 'warning emitted');
  assert.ok(Math.abs(out.lsa - 0.45) < 1e-6, 'lsa preserved');
  // Per plan: passes=lsa>0.2 only since bert unavailable.
  assert.equal(out.passes, true, 'passes=true since lsa(0.45) > 0.2 and bert unavailable');
}

async function scenario7LsaBridgeFails() {
  // LSA fails; whole pair pessimistic.
  installMockSpawnSync(mockLsaFailure());
  const va = vec1024At(0, 1);
  const vb = new Array(1024).fill(0);
  vb[0] = 0.5;
  vb[1] = Math.sqrt(1 - 0.25);
  let cnt = 0;
  installMockPinecone(async function () {
    cnt += 1;
    return { success: true, hits: makeMockHits(cnt === 1 ? va : vb) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  const out = await m.score('q', 'd', { namespace: 'external:test' });
  captureResult('7-lsa-unavailable', out);
  assert.equal(out.lsa, null, 'lsa is null on LSA failure');
  assert.equal(out.diff, null, 'diff is null when lsa absent');
  assert.equal(out.warning, 'lsa_unavailable', 'warning lsa_unavailable emitted');
  assert.equal(out.passes, false, 'passes=false (pessimistic when LSA absent)');
}

async function scenario8Determinism() {
  installMockSpawnSync(mockLsaSuccess(0.55));
  const va = vec1024At(0, 1);
  const vb = new Array(1024).fill(0);
  vb[0] = 0.4;
  vb[1] = Math.sqrt(1 - 0.16);
  // Recreate the mock state so each .score() call sees the same sequence.
  installMockPinecone(async function (_ns, q, _t) {
    if (q === 'qq') return { success: true, hits: makeMockHits(va) };
    return { success: true, hits: makeMockHits(vb) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  const out1 = await m.score('qq', 'dd', { namespace: 'external:test' });
  const out2 = await m.score('qq', 'dd', { namespace: 'external:test' });
  captureResult('8-determinism-1', out1);
  captureResult('8-determinism-2', out2);
  assert.equal(JSON.stringify(out1), JSON.stringify(out2),
    'determinism: same inputs must produce byte-identical output');
}

async function scenario9AdversarialQueryConcept() {
  // Forbidden in query_concept -> rejected at gate; bridges NOT called.
  let lsaCalled = false;
  let pineconeCalled = false;
  installMockSpawnSync(function () {
    lsaCalled = true;
    return mockLsaSuccess(0.5)();
  });
  installMockPinecone(async function () {
    pineconeCalled = true;
    return { success: true, hits: makeMockHits(vec1024At(0, 1)) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  let out = null;
  let threw = null;
  try {
    out = await m.score('meeting with Genentech yesterday', 'doc concept', { namespace: 'external:test' });
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation; got ' + (threw && threw.name));
    captureResult('9-adv-query-throw', { thrown: threw.name });
  } else if (out && out.error === 'invalid_input') {
    captureResult('9-adv-query-rejected', out);
    assert.equal(out.reason, 'forbidden_input', 'rejection reason matches');
  } else {
    throw new Error('Adversarial input must be rejected at gate; got out=' + JSON.stringify(out));
  }
  assert.equal(lsaCalled, false, 'LSA bridge MUST NOT be called on adversarial input');
  assert.equal(pineconeCalled, false, 'Pinecone bridge MUST NOT be called on adversarial input');
}

async function scenario10AdversarialDocConcept() {
  let lsaCalled = false;
  let pineconeCalled = false;
  installMockSpawnSync(function () {
    lsaCalled = true;
    return mockLsaSuccess(0.5)();
  });
  installMockPinecone(async function () {
    pineconeCalled = true;
    return { success: true, hits: makeMockHits(vec1024At(0, 1)) };
  });
  process.env.PINECONE_API_KEY = 'test-key';
  const m = require('../core/rs-differential-scorer.cjs');
  let out = null;
  let threw = null;
  try {
    out = await m.score('cancer biology', 'Lawrence said breakthrough', { namespace: 'external:test' });
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation; got ' + (threw && threw.name));
    captureResult('10-adv-doc-throw', { thrown: threw.name });
  } else if (out && out.error === 'invalid_input') {
    captureResult('10-adv-doc-rejected', out);
    assert.equal(out.reason, 'forbidden_input', 'rejection reason matches');
  } else {
    throw new Error('Adversarial doc_concept must be rejected; got out=' + JSON.stringify(out));
  }
  assert.equal(lsaCalled, false, 'LSA bridge MUST NOT be called');
  assert.equal(pineconeCalled, false, 'Pinecone bridge MUST NOT be called');
}

// ---------- A1 sweep ----------

function a1Sweep() {
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
    for (const sub of DANGEROUS_SUBSTRINGS) {
      if (json.indexOf(sub) !== -1) {
        hits += 1;
        process.stderr.write(
          '  A1 HIT  scenario=' + rec.scenario +
          '  substring=' + sub + '\n'
        );
      }
    }
  }
  return hits;
}

// ---------- Main ----------

(async function main() {
  process.stdout.write('=== 89.2-06-differential-scorer suite (REPO_ROOT=' + REPO_ROOT + ') ===\n');

  await runScenario('1-happy-path-passes', scenario1HappyPathPasses);
  await runScenario('2-dual-floor-fail-diff', scenario2DualFloorFailDiff);
  await runScenario('3-dual-floor-fail-lsa', scenario3DualFloorFailLsa);
  await runScenario('4-dual-floor-fail-bert', scenario4DualFloorFailBert);
  await runScenario('5-boundary-exact-threshold', scenario5BoundaryAtExactThreshold);
  await runScenario('6-bridge-fails-bert-unavailable', scenario6BridgeFailsBertUnavailable);
  await runScenario('7-lsa-bridge-fails', scenario7LsaBridgeFails);
  await runScenario('8-determinism', scenario8Determinism);
  await runScenario('9-adversarial-query-concept', scenario9AdversarialQueryConcept);
  await runScenario('10-adversarial-doc-concept', scenario10AdversarialDocConcept);

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
    process.stdout.write('=== 89.2-06-differential-scorer suite: ' + passed + '/10 passed (' + failed + ' failed) ===\n');
    process.exit(1);
  }
  process.stdout.write('=== 89.2-06-differential-scorer suite: 10/10 passed ===\n');
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
