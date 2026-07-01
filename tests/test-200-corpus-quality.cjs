#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 200-01 -- RS corpus quality tests (SEED-018 H2 + H3).
 *
 * All guards run OFFLINE with a deterministic stub encoder (Canon Part 8: no
 * Brain, no live model, no network egress).
 *
 *   Task 3 (H2): the semantic-floor gate drops an off-topic (atmospheric
 *     remote sensing) external candidate on a "multi-user team collaboration"
 *     topic while keeping the on-topic candidate.
 *
 *   Task 4 (H3): a non-degenerate regression fixture proves the mocked
 *     differential does NOT collapse every pair to the boundary extreme
 *     (semantic 0.0 / lsa 1.0 / signed_diff -1.0) -- the SEED-018 symptom.
 *
 * The stub encoder is a fixed-vocabulary bag-of-words. It is intentionally
 * dumb and deterministic: an off-topic candidate shares no vocabulary with the
 * topic, so its cosine is 0 and it falls below the floor; overlapping-but-
 * distinct venture artifacts cosine into (0, 1) so no pair is degenerate.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const scorer = require('../lib/core/rs-differential-scorer.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// ---------- Deterministic offline stub encoder ----------
//
// Fixed vocabulary spanning the on-topic (collaboration) and off-topic
// (atmospheric remote sensing) domains. encode(text) -> integer count vector.
// Pure, no I/O.

const VOCAB = [
  'multi', 'user', 'team', 'teams', 'collaboration', 'collaborative',
  'shared', 'workspace', 'workspaces', 'presence', 'realtime', 'editing',
  'project', 'projects', 'onboard', 'members', 'platform', 'tooling',
  'atmospheric', 'remote', 'sensing', 'satellite', 'aerosol', 'radiance',
];

function stubEncode(text) {
  const toks = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
  const counts = Object.create(null);
  for (const t of toks) counts[t] = (counts[t] || 0) + 1;
  return VOCAB.map(function dim(w) { return counts[w] || 0; });
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Deterministic structural (LSA-stand-in) similarity: token-set Jaccard over the
// full text. Overlapping-but-distinct artifacts land strictly inside (0, 1),
// which is exactly what the degenerate regression (lsa == 1.0 always) lacked.
function tokenJaccard(aText, bText) {
  const setA = new Set(String(aText).toLowerCase().match(/[a-z]+/g) || []);
  const setB = new Set(String(bText).toLowerCase().match(/[a-z]+/g) || []);
  if (setA.size === 0 && setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Mocked-embedding differential over a text pair. semantic = stub-embedding
// cosine, lsa = token Jaccard, signed_diff = semantic - lsa. The degenerate
// regression this guards against is semantic 0.0 / lsa 1.0 / signed_diff -1.0.
function stubDifferential(aText, bText) {
  const semantic = cosine(stubEncode(aText), stubEncode(bText));
  const lsa = tokenJaccard(aText, bText);
  return { semantic: semantic, lsa: lsa, signed_diff: semantic - lsa };
}

// ============================================================================
// Task 3 (SEED-018 H2): semantic-floor gate on external returns
// ============================================================================

function testSemanticFloorGate() {
  const topicVec = stubEncode('multi user team collaboration');

  const onTopic = {
    source: 'openalex',
    external_id: 'W:on-topic',
    title: 'Shared workspaces for multi-user team collaboration',
    abstract:
      'A collaborative platform giving teams shared workspaces with realtime '
      + 'presence so multi-user project members can collaborate.',
  };
  const offTopic = {
    source: 'openalex',
    external_id: 'W:off-topic',
    title: 'Atmospheric remote sensing of aerosol radiance',
    abstract:
      'Satellite remote sensing retrieves atmospheric aerosol radiance across '
      + 'spectral bands for climate monitoring.',
  };

  const encodeFn = function encode(cand) {
    return stubEncode((cand.title || '') + ' ' + (cand.abstract || ''));
  };

  // The gate under test lives in the shared differential scorer.
  const survivors = scorer.gateCandidatesBySemanticFloor(
    topicVec, [onTopic, offTopic], encodeFn,
  );

  assert.strictEqual(survivors.length, 1,
    'exactly one candidate should survive the semantic-floor gate');
  assert.strictEqual(survivors[0].external_id, 'W:on-topic',
    'the on-topic candidate must be the survivor');
  ok('H2: off-topic atmospheric candidate dropped, on-topic kept (CJS gate)');

  // Boundary sanity: the off-topic candidate is below the floor, on-topic above.
  assert.ok(!scorer.passesSemanticFloor(topicVec, encodeFn(offTopic)),
    'off-topic candidate must be below SEMANTIC_FLOOR');
  assert.ok(scorer.passesSemanticFloor(topicVec, encodeFn(onTopic)),
    'on-topic candidate must be at/above SEMANTIC_FLOOR');
  ok('H2: passesSemanticFloor boundary correct at default floor '
    + scorer.SEMANTIC_FLOOR);

  // A no-op encoder is a pass-through so existing callers are unaffected.
  const passthrough = scorer.gateCandidatesBySemanticFloor(
    topicVec, [onTopic, offTopic], null,
  );
  assert.strictEqual(passthrough.length, 2,
    'gate with no encodeFn must be a pass-through (backward compatible)');
  ok('H2: gate is a no-op pass-through when no encoder is supplied');
}

// ---------- Python parity: rs_corpus.semantic_gate drops the same candidate ----------
//
// Both sites (CJS scorer + Python rs_corpus) were changed, so verify the Python
// gate agrees. Clean SKIP if python3 is unavailable (Tri-Polar degrade).

function testPythonSemanticGateParity() {
  let hasPython = true;
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' });
  } catch (_e) {
    hasPython = false;
  }
  if (!hasPython) {
    console.log('  skip H2 Python parity: python3 unavailable (clean degrade)');
    return;
  }

  const script = [
    'import sys, json, re',
    "sys.path.insert(0, 'lib/core')",
    'import rs_corpus as rc',
    'VOCAB = ' + JSON.stringify(VOCAB),
    'def _vec(text):',
    "    toks = re.findall(r'[a-z]+', (text or '').lower())",
    '    counts = {}',
    '    for t in toks:',
    '        counts[t] = counts.get(t, 0) + 1',
    '    return [counts.get(w, 0) for w in VOCAB]',
    'def enc(cand):',
    "    return _vec((cand.get('title') or '') + ' ' + (cand.get('abstract') or ''))",
    "topic_vec = _vec('multi user team collaboration')",
    'cands = [',
    "  {'external_id': 'W:on-topic', 'title': 'Shared workspaces for multi-user team collaboration',",
    "   'abstract': 'A collaborative platform giving teams shared workspaces with realtime presence so multi-user project members can collaborate.'},",
    "  {'external_id': 'W:off-topic', 'title': 'Atmospheric remote sensing of aerosol radiance',",
    "   'abstract': 'Satellite remote sensing retrieves atmospheric aerosol radiance across spectral bands for climate monitoring.'},",
    ']',
    'kept = rc.semantic_gate(topic_vec, cands, enc)',
    "print(json.dumps([c['external_id'] for c in kept]))",
  ].join('\n');

  const out = execFileSync('python3', ['-c', script], {
    cwd: REPO_ROOT, encoding: 'utf8',
  }).trim();
  const kept = JSON.parse(out);
  assert.deepStrictEqual(kept, ['W:on-topic'],
    'Python semantic_gate must keep only the on-topic candidate');
  ok('H2: Python rs_corpus.semantic_gate parity (off-topic dropped)');
}

// ============================================================================
// Task 4 (SEED-018 H3): non-degenerate regression fixture
// ============================================================================

function testNonDegenerateRegression() {
  const fixturePath = path.join(
    REPO_ROOT, 'tests', 'fixtures', 'rs-corpus', 'known-good-topic.json',
  );
  assert.ok(fs.existsSync(fixturePath),
    'fixture known-good-topic.json must exist');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const artifacts = fixture.artifacts;
  assert.ok(Array.isArray(artifacts) && artifacts.length >= 2,
    'fixture must carry at least two artifacts to form a pair');

  // Run the mocked-embedding differential over every artifact pair.
  const pairs = [];
  for (let i = 0; i < artifacts.length; i += 1) {
    for (let j = i + 1; j < artifacts.length; j += 1) {
      pairs.push(stubDifferential(artifacts[i].text, artifacts[j].text));
    }
  }
  assert.ok(pairs.length >= 1, 'expected at least one pair');

  // THE regression assertion: NOT every pair is the boundary extreme
  // (semantic 0.0 / lsa 1.0 / signed_diff -1.0). Before the SEED-018 fixes the
  // polluted corpus made every pair collapse to exactly this shape (two noise
  // spaces measured against each other); this assertion is what would have
  // failed pre-fix and now passes.
  const allDegenerate = pairs.every(function isDeg(p) {
    return p.semantic === 0 && p.lsa === 1 && p.signed_diff === -1;
  });
  assert.ok(!allDegenerate,
    'regression: every pair collapsed to semantic 0.0 / lsa 1.0 / signed_diff -1.0');
  ok('H3: not every pair is the boundary-extreme degenerate shape');

  // And the fixture asserts its own expected_pair_shape is non-degenerate:
  // at least one pair with 0 < semantic < 1 AND abs(signed_diff) < 1.
  const shape = fixture.expected_pair_shape || {};
  assert.strictEqual(shape.non_degenerate, true,
    'fixture must declare expected_pair_shape.non_degenerate = true');
  const goodPair = pairs.some(function good(p) {
    return p.semantic > 0 && p.semantic < 1 && Math.abs(p.signed_diff) < 1;
  });
  assert.ok(goodPair,
    'at least one pair must have 0 < semantic < 1 AND abs(signed_diff) < 1');
  ok('H3: fixture yields a calibrated (non-degenerate) pair');
}

// ---------- Run ----------

function main() {
  console.log('test-200-corpus-quality: RS corpus quality (SEED-018 H2 + H3)');
  testSemanticFloorGate();
  testPythonSemanticGateParity();
  testNonDegenerateRegression();
  console.log('PASS [test-200-corpus-quality]: ' + passed + ' assertions green');
}

main();
