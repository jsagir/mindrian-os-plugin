/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Amended Phase 355 D-03: Convention B retired; classifyDirectionB now
 * delegates to lib/core/direction-convention.cjs (semantic higher =
 * structural_transfer). The two pinned classifyDirectionB expectations
 * below are flipped accordingly; nothing else in this test changes -- the
 * similarity-algorithm assertions (diagonal, max_features parametrization)
 * are untouched, since Phase 355 D-03 only moved the label rule, not the
 * similarity computation.
 *
 * Phase 272 Wave 0 -- pins compute-hsi.py's Convention B + cosine-on-SVD LSA
 * algorithm, RED by design.
 *
 * PYPORT-03. Ports scripts/compute-hsi.py:324-348 (compute_lsa_similarity)
 * and the inline classification at scripts/compute-hsi.py:748-751. Gates
 * lib/core/hsi-lsa.cjs (272-07), which does not exist yet.
 *
 * CONVENTION B (the OPPOSITE sign bucketing from Convention A -- see
 * tests/272-direction-convention.test.cjs, rs-math.cjs's convention):
 *
 *   lsa_sim > sem_sim  -> structural_transfer
 *   otherwise          -> semantic_implementation
 *
 * (rs_math.py's classify_direction inspects sign(semantic - lsa) > 0;
 * compute-hsi.py's inline check inspects lsa_sim > sem_sim directly -- these
 * are genuinely different conventions on differently-defined quantities, per
 * RESEARCH.md Finding F-3 and PATTERNS.md Convention #8. lib/core/hsi-lsa.cjs
 * and lib/core/rs-math.cjs MUST NOT share one classification helper.)
 *
 * Algorithm distinguishing property (Pitfall 3): this file's underlying
 * similarity computation is COSINE-ON-THE-SVD-REDUCED MATRIX
 * (cosine_similarity(svd.fit_transform(tfidf))), NOT topic-keyword-membership
 * counting (rs-math.cjs's method, ported from source/lsa.py). The two
 * algorithms are both colloquially called "LSA" but must not converge.
 *
 * max_features=500 (compute-hsi.py:331) vs rs_math.py's max_features=2000
 * (RESEARCH.md Finding F-6's parameter table) -- hsi-lsa.cjs must accept
 * max_features as a parameter defaulting to 500, not hardcode rs-math.cjs's
 * 2000.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HSI_LSA_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'hsi-lsa.cjs');

let hsiLsaModule;
try {
  // eslint-disable-next-line global-require
  hsiLsaModule = require(HSI_LSA_MODULE_PATH);
} catch (_e) {
  hsiLsaModule = null;
}

// Reuses/extends the tfidf-parity fixture corpus (see
// tests/272-tfidf-parity.test.cjs), independently duplicated here per this
// task's "no cross-file require()" discipline.
const CORPUS = [
  'the cat sat on the mat',
  'the dog sat on the log',
  'cats and dogs are great pets',
  'quantum physics is hard',
];

async function main() {
  assert.ok(
    hsiLsaModule !== null,
    'lib/core/hsi-lsa.cjs does not exist yet (expected until plan 272-07 lands) -- ' +
      'this test is RED by design for Phase 272 Wave 0'
  );
  assert.ok(
    typeof hsiLsaModule.classifyDirectionB === 'function',
    'lib/core/hsi-lsa.cjs MUST export a function named classifyDirectionB(lsaSim, semSim)'
  );
  assert.ok(
    typeof hsiLsaModule.computeLsaSimilarity === 'function',
    'lib/core/hsi-lsa.cjs MUST export a function named computeLsaSimilarity(texts, opts)'
  );

  // Synthetic pair: lsa=0.8, semantic=0.3. Phase 355 D-03: classifyDirectionB
  // now delegates to lib/core/direction-convention.cjs's classify(lsa,
  // semantic), i.e. sign(semantic - lsa) = sign(0.3 - 0.8) = sign(-0.5) <= 0
  // -> semantic_implementation. This is the SAME label rs-math.cjs's
  // classifyDirection now assigns to this pair (both delegate to the one
  // module), the opposite of the old, retired Convention B label.
  const label = hsiLsaModule.classifyDirectionB(0.8, 0.3);
  assert.equal(
    label,
    'semantic_implementation',
    'Phase 355 D-03: classifyDirectionB(0.8, 0.3) delegates to direction-convention.cjs -- ' +
      'semantic (0.3) - lsa (0.8) = -0.5 <= 0 -> semantic_implementation'
  );

  // The reverse pairing (lsa=0.3, semantic=0.8): semantic - lsa = 0.5 > 0
  // -> structural_transfer under the same delegated rule.
  const reverseLabel = hsiLsaModule.classifyDirectionB(0.3, 0.8);
  assert.equal(
    reverseLabel,
    'structural_transfer',
    'Phase 355 D-03: classifyDirectionB(0.3, 0.8) delegates to direction-convention.cjs -- ' +
      'semantic (0.8) - lsa (0.3) = 0.5 > 0 -> structural_transfer'
  );

  // Underlying similarity computation must be cosine-on-the-SVD-reduced
  // matrix, not topic-keyword membership. Distinguishing property: this
  // matrix's diagonal is exactly 1.0 (self-cosine), which topic-keyword-
  // membership similarity (rs-math.cjs's method) does NOT guarantee by
  // construction (rs_math.py's normalize_and_l1_similarity rescales to
  // [0, 1] centered at 0.5, with diagonal only approximately 1.0 after
  // rescaling, not exactly by construction).
  const simMatrix = hsiLsaModule.computeLsaSimilarity(CORPUS, { maxFeatures: 500 });
  for (let i = 0; i < CORPUS.length; i += 1) {
    assert.ok(
      Math.abs(simMatrix[i][i] - 1.0) < 1e-9,
      `computeLsaSimilarity diagonal[${i}] must be exactly 1.0 (self-cosine) -- ` +
        'cosine-on-SVD guarantees this by construction; topic-keyword-membership does not'
    );
  }

  // max_features parametrization: a corpus with 600+ distinct terms must
  // produce an observably different similarity structure under
  // max_features=500 (the compute-hsi.py default) than under
  // max_features=2000 (rs_math.py's default) -- this pins that hsi-lsa.cjs
  // accepts max_features as a parameter, not a hardcoded 2000.
  const largeCorpus = [];
  for (let d = 0; d < 8; d += 1) {
    const terms = [];
    for (let t = 0; t < 100; t += 1) {
      terms.push(`uniqueterm${d}_${t}`);
    }
    largeCorpus.push(terms.join(' '));
  }
  const sim500 = hsiLsaModule.computeLsaSimilarity(largeCorpus, { maxFeatures: 500 });
  const sim2000 = hsiLsaModule.computeLsaSimilarity(largeCorpus, { maxFeatures: 2000 });
  let anyDifference = false;
  for (let i = 0; i < largeCorpus.length && !anyDifference; i += 1) {
    for (let j = 0; j < largeCorpus.length && !anyDifference; j += 1) {
      if (Math.abs(sim500[i][j] - sim2000[i][j]) > 1e-6) anyDifference = true;
    }
  }
  assert.ok(
    anyDifference,
    'max_features=500 vs max_features=2000 must produce an observably different ' +
      'similarity matrix on a corpus with 600+ distinct terms -- hsi-lsa.cjs must accept ' +
      'max_features as a real parameter, not hardcode rs-math.cjs default of 2000'
  );

  console.log('PASS 272-hsi-lsa-algorithm');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
