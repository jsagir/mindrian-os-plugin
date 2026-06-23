#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 172-15 Task 2 -- multiplicative multi-hop chain-confidence composition
 * in lib/workflow/local-chain-recommender.cjs (Canon Part 11 R6 / INV-08 / INV-12).
 *
 * Run: node tests/test-chain-transform-composition.cjs
 *
 * The SPFO v2.1 verified Brain model (research/172-SPFO-CHAIN-MODEL-REFERENCE.md)
 * composes multi-hop chain confidence MULTIPLICATIVELY along the path:
 *   reduce(c = 1.0, r IN rels | c * coalesce(r.confidence, 0.5))
 * ordered by hops then composed-confidence DESC. The LOCAL recommender mirrors
 * this so the Brain-off ranker matches the Brain-on model. The composed candidate
 * carries the per-hop `transform` descriptors where present. Local-Only (INV-12):
 * zero Brain/network at rank time; the final surfaced ordering still defers to the
 * Part-3 MAX_K ranker (no duplicate ranker).
 *
 * Four behaviors (per 172-15-PLAN.md Task 2 <behavior>):
 *   1. a 2-hop FEEDS_INTO chain composes confidence multiplicatively (c = c1 * c2,
 *      coalesce default 0.5 for a missing confidence).
 *   2. multi-hop candidates are ordered by hops then composed-confidence DESC.
 *   3. a surfaced candidate carries its per-hop transform chain where present.
 *   4. zero Brain/network calls at rank time (Local-Only, INV-12); the final
 *      surfaced ordering still defers to the Part-3 MAX_K ranker.
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

// Round to avoid float-noise in equality assertions.
function r6(n) { return Math.round(n * 1e6) / 1e6; }

// An in-memory projection fixture with multi-hop FEEDS_INTO paths:
//   A -> B (0.9, "ab") -> D (0.8, "bd")          2-hop: 0.72
//   A -> C (0.5, "ac") -> D (0.7, missing transform)  2-hop: 0.35
//   C -> D (0.7) on its own                       1-hop
//   E -> F (no curated confidence -> coalesce 0.5) 1-hop, default confidence
// Only chain-kind edges (FEEDS_INTO / CHAINS / PREREQUISITE) are candidates;
// OPERATES is IGNORED.
function fixtureProjection() {
  return {
    nodes: [
      { id: 'framework:A', kind: 'framework', methodology_tier: 'pws', name: 'A' },
      { id: 'framework:B', kind: 'framework', methodology_tier: 'pws', name: 'B' },
      { id: 'framework:C', kind: 'framework', methodology_tier: 'pws', name: 'C' },
      { id: 'framework:D', kind: 'framework', methodology_tier: 'pws', name: 'D' },
      { id: 'framework:E', kind: 'framework', methodology_tier: 'pws', name: 'E' },
      { id: 'framework:F', kind: 'framework', methodology_tier: 'pws', name: 'F' },
      { id: 'command:/mos:x', kind: 'command', methodology_tier: 'mindrian-operation', name: '/mos:x' },
    ],
    edges: [
      { type: 'FEEDS_INTO', from: 'framework:A', to: 'framework:B', confidence: 0.9, transform: 'ab' },
      { type: 'FEEDS_INTO', from: 'framework:B', to: 'framework:D', confidence: 0.8, transform: 'bd' },
      { type: 'FEEDS_INTO', from: 'framework:A', to: 'framework:C', confidence: 0.5, transform: 'ac' },
      { type: 'FEEDS_INTO', from: 'framework:C', to: 'framework:D', confidence: 0.7 },
      { type: 'FEEDS_INTO', from: 'framework:E', to: 'framework:F' },
      { type: 'OPERATES', from: 'command:/mos:x', to: 'framework:A' },
    ],
  };
}

// ---------------------------------------------------------------------------
// 1. a 2-hop FEEDS_INTO chain composes confidence multiplicatively
// ---------------------------------------------------------------------------
test('a 2-hop FEEDS_INTO chain composes confidence multiplicatively (c1 * c2, coalesce 0.5)', function () {
  assert.strictEqual(typeof rec.recommendMultiHopChains, 'function',
    'recommendMultiHopChains is exported');

  const out = rec.recommendMultiHopChains({
    projection: fixtureProjection(),
    from: 'A',
    maxHops: 2,
  });
  assert.ok(Array.isArray(out), 'returns an array of multi-hop candidates');

  // A->B->D composes 0.9 * 0.8 = 0.72.
  const abd = out.find((c) => Array.isArray(c.path) && c.path.join('>') === 'A>B>D');
  assert.ok(abd, 'A->B->D 2-hop candidate is present');
  assert.strictEqual(r6(abd.confidence), 0.72, 'A->B->D composes to 0.9 * 0.8 = 0.72');
  assert.strictEqual(abd.hops, 2, 'A->B->D is a 2-hop chain');

  // A->C->D composes 0.5 * 0.7 = 0.35.
  const acd = out.find((c) => Array.isArray(c.path) && c.path.join('>') === 'A>C>D');
  assert.ok(acd, 'A->C->D 2-hop candidate is present');
  assert.strictEqual(r6(acd.confidence), 0.35, 'A->C->D composes to 0.5 * 0.7 = 0.35');

  // The coalesce default: a 1-hop E->F edge with NO confidence composes to 0.5.
  const ef = rec.recommendMultiHopChains({
    projection: fixtureProjection(),
    from: 'E',
    maxHops: 2,
  }).find((c) => Array.isArray(c.path) && c.path.join('>') === 'E>F');
  assert.ok(ef, 'E->F candidate present');
  assert.strictEqual(r6(ef.confidence), 0.5, 'a missing confidence coalesces to the 0.5 default');
});

// ---------------------------------------------------------------------------
// 2. multi-hop candidates ordered by hops then composed-confidence DESC
// ---------------------------------------------------------------------------
test('multi-hop candidates are ordered by hops then composed-confidence DESC', function () {
  const out = rec.recommendMultiHopChains({
    projection: fixtureProjection(),
    from: 'A',
    maxHops: 2,
  });
  assert.ok(out.length >= 2, 'at least two candidates to order');

  // Ordered by hops ASC first, then composed-confidence DESC within the same
  // hop-count (the SPFO ordering: hops then confidence DESC).
  for (let i = 1; i < out.length; i += 1) {
    const prev = out[i - 1];
    const cur = out[i];
    if (prev.hops === cur.hops) {
      assert.ok(prev.confidence >= cur.confidence,
        'within a hop-count, ordered by composed-confidence DESC');
    } else {
      assert.ok(prev.hops < cur.hops, 'ordered by hops ascending');
    }
  }

  // Within the 2-hop set, A->B->D (0.72) ranks above A->C->D (0.35).
  const twoHop = out.filter((c) => c.hops === 2).map((c) => c.path.join('>'));
  const idxABD = twoHop.indexOf('A>B>D');
  const idxACD = twoHop.indexOf('A>C>D');
  assert.ok(idxABD >= 0 && idxACD >= 0, 'both 2-hop chains present');
  assert.ok(idxABD < idxACD, 'A->B->D (0.72) ranks above A->C->D (0.35)');
});

// ---------------------------------------------------------------------------
// 3. a surfaced candidate carries its per-hop transform chain where present
// ---------------------------------------------------------------------------
test('a surfaced multi-hop candidate carries its per-hop transform descriptors where present', function () {
  const out = rec.recommendMultiHopChains({
    projection: fixtureProjection(),
    from: 'A',
    maxHops: 2,
  });

  // A->B->D: both hops carry transforms -> ['ab', 'bd'].
  const abd = out.find((c) => Array.isArray(c.path) && c.path.join('>') === 'A>B>D');
  assert.ok(abd, 'A->B->D present');
  assert.ok(Array.isArray(abd.transforms), 'candidate carries a transforms array');
  assert.deepStrictEqual(abd.transforms, ['ab', 'bd'], 'per-hop transforms in path order');

  // A->C->D: first hop has a transform ("ac"), second hop has NONE -> the missing
  // hop transform is null (the chain is preserved positionally, not dropped).
  const acd = out.find((c) => Array.isArray(c.path) && c.path.join('>') === 'A>C>D');
  assert.ok(acd, 'A->C->D present');
  assert.deepStrictEqual(acd.transforms, ['ac', null],
    'a missing hop transform is positionally null, never silently dropped');
});

// ---------------------------------------------------------------------------
// 4. zero Brain/network at rank time + final ordering defers to Part-3 ranker
// ---------------------------------------------------------------------------
test('zero Brain/network at rank time (INV-12); final ordering defers to the Part-3 MAX_K ranker', function () {
  // Source-grep: no Brain client require, no network primitive, no live Brain call.
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
    const out = rec.recommendMultiHopChains({
      projection: fixtureProjection(),
      from: 'A',
      maxHops: 3,
    });
    assert.ok(Array.isArray(out), 'composes without touching the network');
    assert.strictEqual(fetchCalled, false, 'fetch was never called at rank time');
  } finally {
    global.fetch = origFetch;
  }

  // The recommender re-exports the Part-3 MAX_K cap and does NOT duplicate
  // rankForSelector -- ordering of the FINAL surfaced set is the ranker's job.
  const ranker = require('../lib/workflow/f-selector-ranker.cjs');
  assert.strictEqual(rec.MAX_K, ranker.MAX_K, 'recommender MAX_K == Part-3 ranker MAX_K');
  assert.strictEqual(typeof rec.rankForSelector, 'undefined', 'recommender does not duplicate rankForSelector');

  // The composed candidate set respects the MAX_K surfaced budget when requested.
  const capped = rec.recommendMultiHopChains({
    projection: fixtureProjection(),
    from: 'A',
    maxHops: 3,
    k: 1,
  });
  assert.ok(capped.length <= ranker.MAX_K, 'surfaced set never exceeds MAX_K');
  assert.ok(capped.length <= 1, 'honors the requested k when below MAX_K');
});

process.stdout.write('\ntest-chain-transform-composition.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
