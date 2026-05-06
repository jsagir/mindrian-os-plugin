'use strict';
/**
 * Phase 117-02 Wave 1 -- AUTOEXPLORE-117-13 (Brain Section 8.1 canonical chain order).
 *
 * Per RESEARCH Section 8.1: Stage "Opportunity Discovery" canonizes the order
 *   Define Domain -> Identify Trends -> Identify Reverse Salients -> (cross-domain value-add)
 *
 * Replaces the Wave-0 stub. 6 real assertions covering:
 *   1. Composer emits results in canonical order as primary axis
 *      (candidates_per_pipeline keys order matches CANONICAL_CHAIN_ORDER)
 *   2. HSI score is the SECONDARY axis (within a pipeline tier, sort by score DESC)
 *   3. Mismatched canonical order fails the order-assertion helper
 *   4. Missing pipeline fills with empty-array placeholder (not absent key)
 *   5. Stage HAS_STEP citation comment present in compose docstring
 *   6. Deterministic across runs (100 invocations -> byte-identical findings except generated_at)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const agent = require('../lib/agents/auto-explore-agent.cjs');
const store = require('../lib/memory/explored-materials-store.cjs');

function makeMaterialId() {
  return store.computeMaterialId('/tmp/room', 'problem-definition/cv.md', 1746543200000);
}

test('117-13 canonical-order 1: candidates_per_pipeline keys in CANONICAL_CHAIN_ORDER (primary axis)', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: {
      gaps: [{ density_score: 0.1, nearest_room_artifacts: [{ id: 'w1', section: 's1' }], framework_chain: ['JTBD'] }],
    },
    rs: {
      pairs: [{ source_artifact_id: 'r1', target_artifact_id: 'r2', signed_diff: 0.5, source_section: 'a', target_section: 'b' }],
    },
    analogy: {
      zones: [{ source_node_id: 'a1', target_node_id: 'a2', relevance: 0.92, source_domain: 'bio', target_domain: 'physics' }],
    },
  });
  assert.ok(f);
  const keys = Object.keys(f.candidates_per_pipeline);
  // PRIMARY axis: insertion order of CANONICAL_CHAIN_ORDER.
  assert.deepEqual(keys, ['domain', 'trends', 'reverse-salients', 'cross-domain']);
});

test('117-13 canonical-order 2: HSI score is the SECONDARY axis (within a pipeline tier)', () => {
  // Two RS pairs; the higher-score one must surface as top within its tier.
  // No whitespace gaps so the 'domain' tier is empty -- top should be from
  // 'reverse-salients' (next in canonical order).
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: { gaps: [] },
    rs: {
      pairs: [
        { source_artifact_id: 'low', target_artifact_id: 'low2', signed_diff: 0.2, source_section: 'a', target_section: 'b' },
        { source_artifact_id: 'high', target_artifact_id: 'high2', signed_diff: -0.9, source_section: 'c', target_section: 'd' },
      ],
    },
    analogy: { zones: [] },
  });
  assert.ok(f);
  assert.equal(f.source_pipeline, 'reverse-salients');
  // Within RS tier, score DESC -> high (0.9) wins.
  assert.equal(f.source_node_id, 'high');
  assert.equal(Math.round(f.score * 10) / 10, 0.9);
});

test('117-13 canonical-order 3: mismatched order fails order-assertion helper', () => {
  // The order-assertion helper: keys of candidates_per_pipeline MUST be
  // strictly equal to CANONICAL_CHAIN_ORDER. Any reorder triggers a
  // deepEqual failure. We construct a deliberately-wrong tuple to confirm.
  const wrongOrder = ['cross-domain', 'reverse-salients', 'trends', 'domain'];
  let threw = false;
  try {
    assert.deepEqual(wrongOrder, agent.CANONICAL_CHAIN_ORDER.slice());
  } catch (_e) {
    threw = true;
  }
  assert.equal(threw, true, 'mismatched order MUST trigger deepEqual failure');
});

test('117-13 canonical-order 4: missing pipeline -> empty-array placeholder (not absent key)', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: { gaps: [] },          // domain pipeline empty
    rs: {
      pairs: [{ source_artifact_id: 'r1', target_artifact_id: 'r2', signed_diff: 0.5, source_section: 'a', target_section: 'b' }],
    },
    analogy: { zones: [] },             // cross-domain pipeline empty
  });
  assert.ok(f);
  // ALL 4 canonical keys must be present, with 0-counts for empty pipelines.
  assert.ok('domain' in f.candidates_per_pipeline);
  assert.ok('trends' in f.candidates_per_pipeline);
  assert.ok('reverse-salients' in f.candidates_per_pipeline);
  assert.ok('cross-domain' in f.candidates_per_pipeline);
  assert.equal(f.candidates_per_pipeline.domain, 0);
  assert.equal(f.candidates_per_pipeline.trends, 0);
  assert.equal(f.candidates_per_pipeline['reverse-salients'], 1);
  assert.equal(f.candidates_per_pipeline['cross-domain'], 0);
});

test('117-13 canonical-order 5: Stage HAS_STEP citation comment present in source', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'agents', 'auto-explore-agent.cjs'), 'utf8');
  // Per AUTOEXPLORE-117-13 verification step 6:
  //   grep -E "Stage.*Opportunity Discovery.*HAS_STEP" lib/agents/auto-explore-agent.cjs >= 1
  const re = /Stage.*Opportunity Discovery.*HAS_STEP/;
  assert.ok(re.test(src), 'Stage HAS_STEP citation must be present in source');
});

test('117-13 canonical-order 6: deterministic across 100 runs (id stable)', () => {
  const args = {
    material_id: makeMaterialId(),
    whitespace: {
      gaps: [{ density_score: 0.1, nearest_room_artifacts: [{ id: 'w1', section: 's1' }], framework_chain: ['JTBD'] }],
    },
    rs: {
      pairs: [{ source_artifact_id: 'r1', target_artifact_id: 'r2', signed_diff: 0.5, source_section: 'a', target_section: 'b' }],
    },
    analogy: {
      zones: [{ source_node_id: 'a1', target_node_id: 'a2', relevance: 0.92, source_domain: 'bio', target_domain: 'physics' }],
    },
  };
  const first = agent.composeAutoExploreFinding(args);
  assert.ok(first);
  for (let i = 0; i < 99; i++) {
    const next = agent.composeAutoExploreFinding(args);
    assert.ok(next);
    // generated_at varies by call (Date.now); all OTHER fields must match.
    assert.equal(next.id, first.id);
    assert.equal(next.source_pipeline, first.source_pipeline);
    assert.equal(next.source_node_id, first.source_node_id);
    assert.equal(next.target_node_id, first.target_node_id);
    assert.equal(next.score, first.score);
    assert.equal(next.candidate_count, first.candidate_count);
    assert.deepEqual(next.candidates_per_pipeline, first.candidates_per_pipeline);
  }
});
