#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.4 Plan 02 -- rs-chain-feeder core fixture suite.
 *
 * 8 scenarios + A1 sweep covering the Wave-2 core module:
 *   lib/core/rs-chain-feeder.cjs
 *
 * Test 1 (Brain unreachable graceful degradation): mock brainClient
 *        with isAvailable() returning false; lookupUpstream returns
 *        {state: ready}; stderr captures warning containing chain-feeder
 *        + Brain unreachable.
 *
 * Test 2 (Pause-state with missing upstream): mock brainClient.query()
 *        to return records with fresh:false flags; opts.upstreamFreshness
 *        Map keyed false; lookupUpstream returns {state: pause,
 *        missing_upstream: [...], suggested_action: Run Methodology}.
 *
 * Test 3 (Ready-state with all upstream present): mock brainClient.query()
 *        to return records; default freshness map -> all upstream fresh;
 *        lookupUpstream returns {state: ready}.
 *
 * Test 4 (emitChainMetadata happy-path shape): structural_transfer + 8 +
 *        empty active_context produces recommended_verb in CANONICAL_VERBS,
 *        feeds_into === PWS VP, spawn_skill === null.
 *
 * Test 5 (emitChainMetadata feeds_into branch coverage):
 *        structural_transfer -> PWS VP, semantic_implementation ->
 *        Causal Loop, hybrid -> Navigation Engine.
 *
 * Test 6 (Canon Part 8 adversarial -- lookupUpstream input):
 *        problem_type containing 'meeting with' throws
 *        ExternalEgressViolation with err.meta.surface ===
 *        rs-chain-feeder-lookup-upstream.
 *
 * Test 7 (Canon Part 8 adversarial -- emitChainMetadata active_context):
 *        active_context.meta.contact === 'john@acme.com' throws
 *        ExternalEgressViolation with err.meta.surface ===
 *        rs-chain-feeder-emit-metadata.
 *
 * Test 8 (chokepoint exclusivity): brainClient.query is invoked at least
 *        once via injected spy; ZERO direct global.fetch() calls.
 *
 * Test 9 (recommendSkillSpawn STUB shape).
 *
 * A1 sweep: 5 happy-path emitChainMetadata calls produce zero
 *           forbidden-pattern hits in the JSON.stringify of returned blocks.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert).
 */

const assert = require('node:assert/strict');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const tests = [];

// Register an async or sync test under a name. The runner awaits each
// in series so stderr captures and brainClient spies do not interleave.
function record(name, fn) {
  tests.push({ name, fn });
}

async function runAll() {
  for (const t of tests) {
    try {
      const maybe = t.fn();
      if (maybe && typeof maybe.then === 'function') await maybe;
      passed++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      failed++;
      failures.push({ name: t.name, message: err && err.message ? err.message : String(err) });
      process.stdout.write('FAIL ' + t.name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
    }
  }
}

// Stderr capture helper. Returns a thunk that, after fn settles, returns
// what was written to process.stderr. Restores original write at the end.
async function captureStderrAsync(fn) {
  const chunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function (chunk) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };
  try {
    const value = await fn();
    return { value, stderr: chunks.join('') };
  } finally {
    process.stderr.write = origWrite;
  }
}

// Build a Brain client stub with a configurable query() return + spy.
function makeBrainClientStub(opts) {
  opts = opts || {};
  const queryReturn = opts.queryReturn !== undefined ? opts.queryReturn : { records: [] };
  const isAvailableValue = opts.isAvailable !== undefined ? opts.isAvailable : true;
  const queryThrows = opts.queryThrows || null;
  const callLog = [];
  const stub = {
    isAvailable: function () { return isAvailableValue; },
    query: async function (cypher) {
      callLog.push({ method: 'query', cypher });
      if (queryThrows) throw queryThrows;
      return queryReturn;
    },
    search: async function () { callLog.push({ method: 'search' }); return null; },
    _callLog: callLog,
  };
  return stub;
}

// ---------- Module under test ----------

const mod = require('../core/rs-chain-feeder.cjs');
const {
  lookupUpstream,
  emitChainMetadata,
  recommendSkillSpawn,
  CANONICAL_VERBS,
} = mod;

// ---------- Tests ----------

// Test 1: Brain unreachable graceful degradation
record('T1 Brain unreachable -> lookupUpstream returns {state: ready} + stderr warning', async function () {
  const brainClient = makeBrainClientStub({ isAvailable: false });
  const captured = await captureStderrAsync(function () {
    return lookupUpstream('IDP', 'opportunity_identified', { brainClient: brainClient });
  });
  assert.deepEqual(captured.value, { state: 'ready' },
    'expected {state: ready}, got ' + JSON.stringify(captured.value));
  assert.ok(captured.stderr.indexOf('chain-feeder') !== -1,
    'expected stderr to contain chain-feeder, got ' + JSON.stringify(captured.stderr));
  assert.ok(captured.stderr.indexOf('Brain unreachable') !== -1,
    'expected stderr to contain Brain unreachable, got ' + JSON.stringify(captured.stderr));
});

// Test 2: Pause-state with missing upstream
record('T2 Brain reachable + missing upstream -> {state: pause, missing_upstream, suggested_action}', async function () {
  const brainClient = makeBrainClientStub({
    queryReturn: {
      records: [
        { name: 'systems-thinking' },
        { name: 'hsi_semantic_surprise_analysis' },
      ],
    },
  });
  const freshness = new Map();
  freshness.set('systems-thinking', false);
  freshness.set('hsi_semantic_surprise_analysis', false);
  const result = await lookupUpstream('IDP', 'opportunity_identified', {
    brainClient: brainClient,
    upstreamFreshness: freshness,
  });
  assert.equal(result.state, 'pause', 'expected state: pause, got ' + result.state);
  assert.ok(Array.isArray(result.missing_upstream), 'missing_upstream must be array');
  assert.equal(result.missing_upstream.length, 2, 'expected 2 missing_upstream entries');
  assert.ok(result.missing_upstream.indexOf('systems-thinking') !== -1,
    'expected systems-thinking in missing_upstream');
  assert.ok(result.missing_upstream.indexOf('hsi_semantic_surprise_analysis') !== -1,
    'expected hsi_semantic_surprise_analysis in missing_upstream');
  assert.equal(result.suggested_action, 'Run Methodology',
    'expected suggested_action: Run Methodology, got ' + result.suggested_action);
});

// Test 3: Ready-state with all upstream present
record('T3 Brain reachable + all upstream fresh (no freshness Map) -> {state: ready}', async function () {
  const brainClient = makeBrainClientStub({
    queryReturn: {
      records: [
        { name: 'systems-thinking' },
        { name: 'Cynefin' },
      ],
    },
  });
  const result = await lookupUpstream('IDP', 'opportunity_identified', { brainClient: brainClient });
  assert.deepEqual(result, { state: 'ready' },
    'expected {state: ready}, got ' + JSON.stringify(result));
});

// Test 4: emitChainMetadata happy-path shape
record('T4 emitChainMetadata structural_transfer + 8 -> shape with verb in CANONICAL_VERBS + PWS VP + null spawn', function () {
  const block = emitChainMetadata('structural_transfer', 8, {});
  assert.ok(block && typeof block === 'object', 'expected object return');
  assert.ok(typeof block.recommended_verb === 'string', 'recommended_verb must be string');
  assert.ok(CANONICAL_VERBS.indexOf(block.recommended_verb) !== -1,
    'recommended_verb must be in CANONICAL_VERBS, got ' + JSON.stringify(block.recommended_verb));
  assert.equal(block.feeds_into, 'PWS VP',
    'feeds_into must be PWS VP for structural_transfer, got ' + JSON.stringify(block.feeds_into));
  assert.equal(block.spawn_skill, null,
    'spawn_skill must be null in 89.4-02, got ' + JSON.stringify(block.spawn_skill));
});

// Test 5: feeds_into branch coverage
record('T5 emitChainMetadata feeds_into branches: structural_transfer -> PWS VP, semantic_implementation -> Causal Loop, hybrid -> Navigation Engine', function () {
  const a = emitChainMetadata('structural_transfer', 8, {});
  assert.equal(a.feeds_into, 'PWS VP', 'structural_transfer -> PWS VP');
  const b = emitChainMetadata('semantic_implementation', 8, {});
  assert.equal(b.feeds_into, 'Causal Loop', 'semantic_implementation -> Causal Loop');
  const c = emitChainMetadata('hybrid', 8, {});
  assert.equal(c.feeds_into, 'Navigation Engine', 'hybrid -> Navigation Engine');
});

// Test 6: Canon Part 8 adversarial -- forbidden pattern in lookupUpstream input
record('T6 Canon Part 8 adversarial -- forbidden pattern in problem_type throws ExternalEgressViolation', async function () {
  const brainClient = makeBrainClientStub({});
  let caught = null;
  try {
    await lookupUpstream('IDP-meeting with john', 'opportunity_identified', { brainClient: brainClient });
  } catch (e) {
    caught = e;
  }
  assert.ok(caught !== null, 'expected throw');
  assert.equal(caught.name, 'ExternalEgressViolation',
    'expected ExternalEgressViolation, got ' + caught.name);
  assert.equal(caught.meta.surface, 'rs-chain-feeder-lookup-upstream',
    'expected meta.surface rs-chain-feeder-lookup-upstream, got ' + caught.meta.surface);
  assert.equal(brainClient._callLog.length, 0,
    'brain query must NOT be invoked when audit trips (got ' + brainClient._callLog.length + ' calls)');
});

// Test 7: Canon Part 8 adversarial -- forbidden pattern nested in active_context
record('T7 Canon Part 8 adversarial -- email nested in active_context.meta throws ExternalEgressViolation', function () {
  let caught = null;
  try {
    emitChainMetadata('structural_transfer', 8, { meta: { contact: 'john@acme.com' } });
  } catch (e) {
    caught = e;
  }
  assert.ok(caught !== null, 'expected throw');
  assert.equal(caught.name, 'ExternalEgressViolation',
    'expected ExternalEgressViolation, got ' + caught.name);
  assert.equal(caught.meta.surface, 'rs-chain-feeder-emit-metadata',
    'expected meta.surface rs-chain-feeder-emit-metadata, got ' + caught.meta.surface);
});

// Test 8: chokepoint exclusivity -- brainClient.query invoked, no direct fetch
record('T8 chokepoint exclusivity -- brainClient.query called >=1 time + zero direct global.fetch calls', async function () {
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = function () {
    fetchCalls.push(Array.prototype.slice.call(arguments));
    return Promise.resolve(null);
  };
  try {
    const brainClient = makeBrainClientStub({
      queryReturn: { records: [{ name: 'systems-thinking' }] },
    });
    await lookupUpstream('IDP', 'opportunity_identified', { brainClient: brainClient });
    assert.ok(brainClient._callLog.length >= 1,
      'expected brainClient.query called >=1 time, got ' + brainClient._callLog.length);
    assert.equal(brainClient._callLog[0].method, 'query',
      'expected first method call to be query, got ' + brainClient._callLog[0].method);
    assert.equal(fetchCalls.length, 0,
      'expected ZERO direct fetch() calls; got ' + fetchCalls.length);
  } finally {
    if (originalFetch === undefined) delete global.fetch;
    else global.fetch = originalFetch;
  }
});

// Test 9: recommendSkillSpawn STUB shape
record('T9 recommendSkillSpawn STUB returns {spawn_skill: null, confidence: 0, reasoning: ...}', function () {
  const result = recommendSkillSpawn('structural_transfer', 8, {});
  assert.ok(result && typeof result === 'object', 'expected object');
  assert.equal(result.spawn_skill, null, 'spawn_skill must be null in 89.4-02 stub');
  assert.equal(result.confidence, 0, 'confidence must be 0 in 89.4-02 stub');
  assert.ok(typeof result.reasoning === 'string' && result.reasoning.length > 0,
    'reasoning must be non-empty string');
  assert.ok(result.reasoning.indexOf('89.4-02') !== -1 || result.reasoning.indexOf('stub') !== -1,
    'reasoning should reference 89.4-02 stub status, got ' + JSON.stringify(result.reasoning));
});

// A1 sweep: 5 happy-path emitChainMetadata calls produce zero
// forbidden-pattern hits in JSON.stringify of returned blocks.
record('A1 sweep: 5 happy-path emitChainMetadata calls produce zero forbidden-pattern hits in returned blocks', function () {
  const calls = [
    ['structural_transfer', 9, {}],
    ['semantic_implementation', 7, { industry_signals_count: 3 }],
    ['hybrid', 5, { cross_methodology_substrates: ['SAPPhIRE', 'TRIZ'] }],
    ['structural_transfer', 4, {}],
    ['semantic_implementation', 6, { resolved_experts_count: 8 }],
  ];
  const { FORBIDDEN_PATTERNS } = require('../core/rs-egress-prompts.cjs');
  for (const [rs_type, score, ctx] of calls) {
    const block = emitChainMetadata(rs_type, score, ctx);
    const json = JSON.stringify(block);
    for (const re of FORBIDDEN_PATTERNS) {
      assert.ok(!re.test(json),
        'A1 sweep: emitChainMetadata output for (' + rs_type + ', ' + score + ') matched forbidden pattern '
        + re.source + '; output was ' + json);
    }
    assert.ok(CANONICAL_VERBS.indexOf(block.recommended_verb) !== -1,
      'A1 sweep: recommended_verb ' + JSON.stringify(block.recommended_verb)
      + ' not in CANONICAL_VERBS for (' + rs_type + ', ' + score + ')');
  }
});

// ---------- Suite report ----------

(async function main() {
  await runAll();
  const total = passed + failed;
  process.stdout.write('\n');
  if (failed === 0) {
    process.stdout.write('=== 89.4-02 rs-chain-feeder-core suite: ' + passed + '/' + total + ' passed ===\n');
    process.exit(0);
  } else {
    process.stdout.write('=== 89.4-02 rs-chain-feeder-core suite: ' + passed + '/' + total + ' passed (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stdout.write('  FAIL ' + f.name + ': ' + f.message + '\n');
    }
    process.exit(1);
  }
})();
