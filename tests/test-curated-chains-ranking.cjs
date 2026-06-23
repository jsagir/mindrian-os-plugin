#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 172-10 Task 3 -- lib/workflow/local-chain-recommender.cjs tests.
 *
 * Run: node tests/test-curated-chains-ranking.cjs
 *
 * The LOCAL chain recommender ranks chain candidates off the LOCAL orchestration
 * projection (data/brain-orchestration-projection.json) joined to the curated
 * per-edge FEEDS_INTO confidence in data/command-registry.json curated_chains.
 * It is Local-Only (INV-12): it reads the committed projection + registry files
 * (or an in-memory fixture) and makes ZERO Brain/network calls at rank time. Per
 * Canon Part 11 R6 the recommender SUPPLIES confidence; the final surfaced
 * ORDERING defers to the Part-3 MAX_K ranker (lib/workflow/f-selector-ranker.cjs)
 * -- the recommender does NOT duplicate the ranker.
 *
 * Four behaviors (per 172-10-PLAN.md Task 3 <behavior>):
 *   1. reads the LOCAL projection + returns chain candidates ranked by curated
 *      confidence.
 *   2. a higher-confidence FEEDS_INTO edge ranks above a lower-confidence one.
 *   3. zero Brain/network calls at rank time (source-grep + no-require assertion).
 *   4. ORDERING of the final surfaced set defers to the Part-3 MAX_K ranker
 *      (R6: CIRS supplies confidence, Part 3 orders -- the recommender exposes
 *      MAX_K and never re-implements rankForSelector).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECOMMENDER_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'local-chain-recommender.cjs');

const rec = require('../lib/workflow/local-chain-recommender.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// An in-memory projection fixture: 3 FEEDS_INTO edges + 1 CHAINS edge + a couple
// of OPERATES edges (which must be IGNORED -- only chain-kind edges are
// candidates). Mirrors the real projection shape ({ nodes, edges }).
function fixtureProjection() {
  return {
    nodes: [
      { id: 'framework:A', kind: 'framework', methodology_tier: 'pws', name: 'A' },
      { id: 'framework:B', kind: 'framework', methodology_tier: 'pws', name: 'B' },
      { id: 'framework:C', kind: 'framework', methodology_tier: 'pws', name: 'C' },
      { id: 'framework:D', kind: 'framework', methodology_tier: 'pws', name: 'D' },
      { id: 'command:/mos:x', kind: 'command', methodology_tier: 'mindrian-operation', name: '/mos:x' },
    ],
    edges: [
      { type: 'FEEDS_INTO', from: 'framework:A', to: 'framework:B' },
      { type: 'FEEDS_INTO', from: 'framework:A', to: 'framework:C' },
      { type: 'FEEDS_INTO', from: 'framework:C', to: 'framework:D' },
      { type: 'CHAINS', from: 'framework:B', to: 'framework:D' },
      { type: 'OPERATES', from: 'command:/mos:x', to: 'framework:A' },
    ],
  };
}

// The curated_chains source fixture carrying the per-edge confidence the edges
// above join to (by from/to framework name + kind).
function fixtureCuratedChains() {
  return [
    { kind: 'feeds_into', from: 'A', to: 'B', confidence: 0.9 },
    { kind: 'feeds_into', from: 'A', to: 'C', confidence: 0.5 },
    { kind: 'feeds_into', from: 'C', to: 'D', confidence: 0.7 },
    { kind: 'chain', from: 'B', to: 'D', confidence: 0.6 },
  ];
}

// ---------------------------------------------------------------------------
// 1. reads the LOCAL projection + returns chain candidates ranked by confidence
// ---------------------------------------------------------------------------
test('reads the LOCAL projection and returns chain candidates ranked by curated confidence', function () {
  const out = rec.recommendChainCandidates({
    projection: fixtureProjection(),
    curatedChains: fixtureCuratedChains(),
  });
  assert.ok(Array.isArray(out), 'returns an array of candidates');
  assert.ok(out.length >= 1, 'returns at least one chain candidate');

  // Every candidate carries from/to/kind/confidence (the chain-candidate shape).
  for (const c of out) {
    assert.strictEqual(typeof c.from, 'string', 'candidate has a from');
    assert.strictEqual(typeof c.to, 'string', 'candidate has a to');
    assert.strictEqual(typeof c.kind, 'string', 'candidate has a kind');
    assert.strictEqual(typeof c.confidence, 'number', 'candidate carries a confidence');
  }

  // OPERATES edges are NOT chain candidates (only chain-kind edges count).
  const operates = out.filter((c) => c.kind === 'operates' || c.type === 'OPERATES');
  assert.strictEqual(operates.length, 0, 'OPERATES edges are not chain candidates');

  // Ranked by confidence descending.
  for (let i = 1; i < out.length; i += 1) {
    assert.ok(out[i - 1].confidence >= out[i].confidence, 'sorted by confidence desc');
  }
});

// ---------------------------------------------------------------------------
// 2. higher-confidence edge ranks above a lower-confidence edge
// ---------------------------------------------------------------------------
test('a higher-confidence FEEDS_INTO edge ranks above a lower-confidence one', function () {
  const out = rec.recommendChainCandidates({
    projection: fixtureProjection(),
    curatedChains: fixtureCuratedChains(),
  });
  // A->B (0.9) must rank above A->C (0.5).
  const idxAB = out.findIndex((c) => c.from === 'A' && c.to === 'B');
  const idxAC = out.findIndex((c) => c.from === 'A' && c.to === 'C');
  assert.ok(idxAB >= 0 && idxAC >= 0, 'both A->B and A->C are present');
  assert.ok(idxAB < idxAC, 'A->B (0.9) ranks above A->C (0.5)');

  // The top candidate overall is the global max confidence (A->B at 0.9).
  assert.strictEqual(out[0].from, 'A');
  assert.strictEqual(out[0].to, 'B');
  assert.strictEqual(out[0].confidence, 0.9);
});

// ---------------------------------------------------------------------------
// 3. zero Brain/network calls at rank time (INV-12 Local-Only)
// ---------------------------------------------------------------------------
test('makes zero Brain/network calls at rank time (Local-Only, INV-12)', function () {
  // Source-grep: the recommender never requires the Brain client or any network
  // primitive, and never references a live Brain call surface.
  const src = fs.readFileSync(RECOMMENDER_PATH, 'utf8');
  assert.ok(!/require\(\s*['"][^'"]*brain-client['"]\s*\)/.test(src), 'no brain-client require');
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch() call');
  assert.ok(!/require\(\s*['"](?:node:https?|https?|node-fetch|axios)['"]\s*\)/.test(src), 'no http/network require');
  assert.ok(!/mcp__brain|brain\.query|brain\.write|brainQuery/.test(src), 'no live Brain invocation');

  // Runtime: monkeypatch global.fetch to throw -- a rank call must not touch it.
  const origFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = function () { fetchCalled = true; throw new Error('network not allowed at rank time'); };
  try {
    const out = rec.recommendChainCandidates({
      projection: fixtureProjection(),
      curatedChains: fixtureCuratedChains(),
    });
    assert.ok(Array.isArray(out), 'ranks without touching the network');
    assert.strictEqual(fetchCalled, false, 'fetch was never called at rank time');
  } finally {
    global.fetch = origFetch;
  }
});

// ---------------------------------------------------------------------------
// 4. ORDERING of the final surfaced set defers to the Part-3 MAX_K ranker
// ---------------------------------------------------------------------------
test('final surfaced ordering defers to the Part-3 MAX_K ranker (R6: CIRS supplies confidence, Part 3 orders)', function () {
  const ranker = require('../lib/workflow/f-selector-ranker.cjs');
  // The recommender re-exports the Part-3 MAX_K cap rather than minting its own,
  // proving it defers to the ranker for the surfaced-set budget.
  assert.strictEqual(rec.MAX_K, ranker.MAX_K, 'recommender MAX_K == Part-3 ranker MAX_K');

  // The recommender does NOT re-implement rankForSelector -- it has no such
  // export; ordering of the FINAL surfaced set is the ranker's job.
  assert.strictEqual(typeof rec.rankForSelector, 'undefined', 'recommender does not duplicate rankForSelector');

  // The confidence-ranked candidate set respects the MAX_K surfaced budget when
  // a budget is requested (the recommender supplies a clamped surfaced view).
  const out = rec.recommendChainCandidates({
    projection: fixtureProjection(),
    curatedChains: fixtureCuratedChains(),
    k: 2,
  });
  assert.ok(out.length <= ranker.MAX_K, 'surfaced set never exceeds MAX_K');
  assert.ok(out.length <= 2, 'honors the requested k when below MAX_K');
});

process.stdout.write('\ntest-curated-chains-ranking.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
