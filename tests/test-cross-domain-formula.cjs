'use strict';
/**
 * Phase 117-02 Wave 1 -- AUTOEXPLORE-117-14 (Brain Section 8.3 cross-domain formula).
 *
 * Per RESEARCH Section 8.3:
 *   surprise_score = similarity * domain_distance
 *   detection_method = "cosine_similarity > threshold AND different_domains"
 *   default threshold = 0.85 (matches Phase 89-07 dedup gate)
 *
 * Replaces the Wave-0 stub. 8 real assertions covering:
 *   1. crossDomainSurprise(0.9, 0.5) === 0.45 exactly
 *   2. crossDomainGate(0.86, 'biology', 'physics') === true
 *   3. crossDomainGate(0.86, 'biology', 'biology') === false (same domain)
 *   4. crossDomainGate(0.84, 'biology', 'physics') === false (below threshold)
 *   5. CROSS_DOMAIN_THRESHOLD === 0.85
 *   6. Zero similarity returns 0 surprise (not null)
 *   7. Commutative: surprise(a,b) === surprise(b,a)
 *   8. Canonical-formula citation comment "similarity * domain_distance" present in source
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const agent = require('../lib/agents/auto-explore-agent.cjs');

test('117-14 cross-domain 1: surprise(0.9, 0.5) === 0.45 (exact arithmetic)', () => {
  // 0.9 * 0.5 = 0.45 in IEEE 754; this is exact.
  assert.equal(agent.crossDomainSurprise(0.9, 0.5), 0.45);
});

test('117-14 cross-domain 2: gate(0.86, biology, physics) === true', () => {
  assert.equal(agent.crossDomainGate(0.86, 'biology', 'physics'), true);
});

test('117-14 cross-domain 3: gate(0.86, biology, biology) === false (same domain)', () => {
  assert.equal(agent.crossDomainGate(0.86, 'biology', 'biology'), false);
});

test('117-14 cross-domain 4: gate(0.84, biology, physics) === false (below threshold)', () => {
  assert.equal(agent.crossDomainGate(0.84, 'biology', 'physics'), false);
});

test('117-14 cross-domain 5: default threshold === 0.85 (Phase 89-07 dedup gate parity)', () => {
  assert.equal(agent.CROSS_DOMAIN_THRESHOLD, 0.85);
});

test('117-14 cross-domain 6: zero similarity returns 0 surprise (not null)', () => {
  // The null path is "no candidate produced"; zero similarity is "candidate
  // produced with score 0". Distinct concepts.
  assert.equal(agent.crossDomainSurprise(0, 1.0), 0);
});

test('117-14 cross-domain 7: commutative -- surprise(a,b) === surprise(b,a)', () => {
  // Multiplication is commutative; this is a property of the formula.
  const cases = [
    [0.7, 0.3],
    [0.95, 1.0],
    [0.42, 0.58],
    [0.0001, 0.9999],
  ];
  for (const [a, b] of cases) {
    assert.equal(agent.crossDomainSurprise(a, b), agent.crossDomainSurprise(b, a));
  }
});

test('117-14 cross-domain 8: canonical-formula citation present in source', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'agents', 'auto-explore-agent.cjs'), 'utf8');
  // Per AUTOEXPLORE-117-14 verification step 8:
  //   grep -E "similarity\s*\*\s*domain_distance" lib/agents/auto-explore-agent.cjs >= 1
  const re = /similarity\s*\*\s*domain_distance/;
  assert.ok(re.test(src), 'cross-domain formula citation must be present in source');
});

// ---------- Bonus: integration check that gate behaviour gates the compose pipeline ----------

test('117-14 cross-domain 9 (integration): below-threshold cosine excluded from cross-domain bucket', () => {
  // Belt-and-suspenders coverage that the gate is wired into composeAutoExploreFinding.
  const f = agent.composeAutoExploreFinding({
    material_id: 'aabb1122334455667788990011223344',
    whitespace: { gaps: [] },
    rs: { pairs: [] },
    analogy: {
      zones: [
        // Below threshold: should be filtered out by gate.
        { source_node_id: 'lo-1', target_node_id: 'lo-2', relevance: 0.5, source_domain: 'biology', target_domain: 'physics' },
      ],
    },
  });
  // No candidates survive -> null per Section 5 spec.
  assert.equal(f, null);
});

test('117-14 cross-domain 10 (integration): same-domain pair excluded from cross-domain bucket', () => {
  const f = agent.composeAutoExploreFinding({
    material_id: 'bbbb1122334455667788990011223344',
    whitespace: { gaps: [] },
    rs: { pairs: [] },
    analogy: {
      zones: [
        // Above threshold but same domain: should be filtered out.
        { source_node_id: 'sd-1', target_node_id: 'sd-2', relevance: 0.95, source_domain: 'biology', target_domain: 'biology' },
      ],
    },
  });
  assert.equal(f, null);
});
