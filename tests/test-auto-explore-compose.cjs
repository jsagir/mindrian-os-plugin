'use strict';
/**
 * Phase 117-02 Wave 1 -- AUTOEXPLORE-117-05 (triple-filter compose).
 *
 * Replaces the Wave-0 stub. 12 real assertions covering:
 *   1. 3-source candidate union (whitespace + RS + analogy = 7 candidates)
 *   2. Dedup by (source_node_id, target_node_id) tuple -- pick max score
 *   3. Empty input (all 3 pipelines zero candidates) returns null
 *   4. Score normalization: each pipeline contributes its native score
 *   5. Deterministic id: same inputs -> same finding.id 32-char hex
 *   6. Source-pipeline tag preservation: top.source_pipeline in CANONICAL_CHAIN_ORDER
 *   7. candidate_count accurate: sum of pre-dedup candidate counts
 *   8. Single-source fallback: only RS pipeline non-empty -> source_pipeline 'reverse-salients'
 *   9. candidates_per_pipeline keys exactly match CANONICAL_CHAIN_ORDER
 *  10. Body-text scrub: returned finding has zero keys in USER_CONTENT_KEY_DENYLIST
 *  11. Backward-compat with Section 5 finding shape
 *  12. HSIAnalysis schema extension fields (Brain Section 8.4) all present
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const agent = require('../lib/agents/auto-explore-agent.cjs');
const store = require('../lib/memory/explored-materials-store.cjs');

// ---------- Fixtures ----------

function makeMaterialId() {
  return store.computeMaterialId('/tmp/room', 'problem-definition/cv.md', 1746543200000);
}

function fixtureWhitespace() {
  return {
    gaps: [
      {
        zone_id: 'ws-gap-001',
        density_score: 0.12,
        validated: true,
        framework_chain: ['JTBD', 'Beautiful Questions'],
        nearest_room_artifacts: [{ id: 'wsA-1', title: 'WS-A1 (TITLE NOT KEPT)', section: 'problem-definition' }],
        hypothesis: 'Hypothesis text (NOT KEPT in finding)',
      },
      {
        zone_id: 'ws-gap-002',
        density_score: 0.45,
        validated: false,
        framework_chain: ['Cynefin'],
        nearest_room_artifacts: [{ id: 'wsA-2', title: 'WS-A2', section: 'market-analysis' }],
      },
    ],
  };
}

function fixtureRs() {
  return {
    pairs: [
      {
        source_artifact_id: 'rs-src-1',
        source_section: 'problem-definition',
        target_artifact_id: 'rs-tgt-1',
        target_section: 'solution-design',
        signed_diff: -0.7092,
        abs_diff: 0.7092,
        direction: 'structural_transfer',
        lsa_score: 0.85,
        semantic_score: 0.92,
      },
      {
        source_artifact_id: 'rs-src-2',
        source_section: 'business-model',
        target_artifact_id: 'rs-tgt-2',
        target_section: 'competitive-analysis',
        signed_diff: 0.5,
        abs_diff: 0.5,
        direction: 'semantic_implementation',
      },
      {
        source_artifact_id: 'rs-src-3',
        source_section: 'team-execution',
        target_artifact_id: 'rs-tgt-3',
        target_section: 'financial-model',
        signed_diff: -0.3,
        abs_diff: 0.3,
        direction: 'whitespace',
      },
    ],
  };
}

function fixtureAnalogy() {
  return {
    zones: [
      {
        zone_id: 'an-1',
        source_node_id: 'an-src-1',
        target_node_id: 'an-tgt-1',
        relevance: 0.92,
        source_domain: 'biology',
        target_domain: 'physics',
      },
      {
        zone_id: 'an-2',
        source_node_id: 'an-src-2',
        target_node_id: 'an-tgt-2',
        relevance: 0.88,
        source_domain: 'chemistry',
        target_domain: 'engineering',
      },
    ],
  };
}

// ---------- Tests ----------

test('117-02 compose 1: 3-source candidate union -> 7 pre-dedup candidates', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: fixtureWhitespace(),
    rs: fixtureRs(),
    analogy: fixtureAnalogy(),
  });
  assert.ok(f, 'finding must be produced');
  // 2 whitespace + 3 RS + 2 analogy = 7 candidates pre-dedup.
  assert.equal(f.candidate_count, 7);
});

test('117-02 compose 2: dedup by (src, tgt) tuple -- pick max score', () => {
  // Same (src, tgt) appears in RS (score 0.5) and analogy (would be ~0.88).
  // Need to construct overlap with same source_node_id + target_node_id values
  // across pipelines so the dedup actually fires.
  const rs = {
    pairs: [
      {
        source_artifact_id: 'shared-src',
        target_artifact_id: 'shared-tgt',
        signed_diff: 0.5, // abs 0.5
        source_section: 'a',
        target_section: 'b',
        direction: 'whitespace',
      },
    ],
  };
  const analogy = {
    zones: [
      {
        source_node_id: 'shared-src',
        target_node_id: 'shared-tgt',
        relevance: 0.92,
        source_domain: 'bio',
        target_domain: 'physics',
      },
    ],
  };
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: { gaps: [] },
    rs: rs,
    analogy: analogy,
  });
  assert.ok(f);
  // Dedup keeps the higher-score entry. Analogy surprise = 0.92 * 1.0 = 0.92 > 0.5
  assert.equal(f.score, 0.92);
  // Cross-domain wins on score axis but per canonical-order, the cross-domain
  // tier comes AFTER reverse-salients in the primary axis. However, dedup
  // collapses the (src,tgt) tuple to ONE entry (the higher-score one), and
  // that entry retains its origin tag. So the surviving candidate carries
  // 'cross-domain' tag.
  assert.equal(f.source_pipeline, 'cross-domain');
});

test('117-02 compose 3: empty input -> null', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: { gaps: [] },
    rs: { pairs: [] },
    analogy: { zones: [] },
  });
  assert.equal(f, null);
});

test('117-02 compose 4: score normalization -- pipelines contribute native score', () => {
  // Whitespace score = 1 - density_score. Density 0.12 -> score 0.88.
  // RS score = abs(signed_diff). signed_diff -0.7092 -> 0.7092.
  // Analogy score = similarity * 1.0 = relevance.
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: fixtureWhitespace(),
    rs: { pairs: [] },
    analogy: { zones: [] },
  });
  assert.ok(f);
  // Top whitespace gap = density 0.12 -> score 0.88.
  assert.equal(Math.round(f.score * 100) / 100, 0.88);
});

test('117-02 compose 5: deterministic id -- same inputs -> same id', () => {
  const args = {
    material_id: makeMaterialId(),
    whitespace: fixtureWhitespace(),
    rs: fixtureRs(),
    analogy: fixtureAnalogy(),
  };
  const f1 = agent.composeAutoExploreFinding(args);
  const f2 = agent.composeAutoExploreFinding(args);
  assert.ok(f1 && f2);
  assert.equal(f1.id, f2.id);
  assert.match(f1.id, /^[0-9a-f]{32}$/);
});

test('117-02 compose 6: source_pipeline tag in CANONICAL_CHAIN_ORDER set', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: fixtureWhitespace(),
    rs: fixtureRs(),
    analogy: fixtureAnalogy(),
  });
  assert.ok(f);
  assert.ok(agent.CANONICAL_CHAIN_ORDER.includes(f.source_pipeline));
});

test('117-02 compose 7: candidate_count == sum of pre-dedup', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: fixtureWhitespace(),  // 2
    rs: fixtureRs(),                  // 3
    analogy: fixtureAnalogy(),        // 2
  });
  assert.ok(f);
  assert.equal(f.candidate_count, 7);
});

test('117-02 compose 8: single-source fallback -- RS only', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: { gaps: [] },
    rs: fixtureRs(),
    analogy: { zones: [] },
  });
  assert.ok(f);
  assert.equal(f.source_pipeline, 'reverse-salients');
  // Top RS pair = abs(-0.7092) = 0.7092
  assert.equal(Math.round(f.score * 10000) / 10000, 0.7092);
});

test('117-02 compose 9: candidates_per_pipeline keys match CANONICAL_CHAIN_ORDER', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: { gaps: [] },
    rs: fixtureRs(),
    analogy: { zones: [] },
  });
  assert.ok(f);
  const keys = Object.keys(f.candidates_per_pipeline);
  assert.deepEqual(keys, agent.CANONICAL_CHAIN_ORDER.slice());
  // Trends bucket EMPTY but key present (placeholder).
  assert.equal(f.candidates_per_pipeline.trends, 0);
});

test('117-02 compose 10: zero USER_CONTENT_KEY_DENYLIST keys in finding', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: fixtureWhitespace(),
    rs: fixtureRs(),
    analogy: fixtureAnalogy(),
  });
  assert.ok(f);
  for (const banned of store.USER_CONTENT_KEY_DENYLIST) {
    assert.equal(banned in f, false, 'finding leaks denylist key: ' + banned);
  }
});

test('117-02 compose 11: backward-compat shape (id, material_id, source_pipeline, etc.)', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: fixtureWhitespace(),
    rs: fixtureRs(),
    analogy: fixtureAnalogy(),
  });
  assert.ok(f);
  for (const k of ['id', 'material_id', 'source_pipeline', 'source_node_id', 'target_node_id', 'score', 'candidate_count']) {
    assert.ok(k in f, 'missing required field ' + k);
  }
});

test('117-02 compose 12: HSIAnalysis schema extension fields all present (Brain Section 8.4)', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: makeMaterialId(),
    whitespace: fixtureWhitespace(),
    rs: fixtureRs(),
    analogy: fixtureAnalogy(),
  });
  assert.ok(f);
  // Wave 1 ships SHAPE CONTRACT only; population in 117-03.
  assert.ok('top_differential' in f);
  assert.equal(f.top_differential, null);
  assert.ok('semantic_surprise' in f);
  assert.equal(f.semantic_surprise, null);
  assert.ok('category_errors_identified' in f);
  assert.deepEqual(f.category_errors_identified, []);
  assert.ok('top_differential_score' in f);
  assert.equal(f.top_differential_score, null);
});
