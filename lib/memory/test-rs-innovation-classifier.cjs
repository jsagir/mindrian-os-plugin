#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 07 Task 1 -- innovation classifier fixture suite.
 *
 * 8 scenarios for the Phase 3 deterministic 3-enum classifier on the
 * {diff, lsa, bert, passes} output of rs-differential-scorer.cjs:
 *
 *   classification IS one of:
 *     'structural_transfer'      -- lsa > 0.3 AND bert <= 0.3
 *     'semantic_implementation'  -- bert > 0.3 AND lsa <= 0.3
 *     'hybrid'                   -- both lsa > 0.3 AND bert > 0.3
 *     default fallback           -- 'structural_transfer'
 *
 *   Test 1  structural_transfer enum branch (lsa=0.5 bert=0.1)
 *   Test 2  semantic_implementation enum branch (lsa=0.1 bert=0.5)
 *   Test 3  hybrid enum branch (lsa=0.5 bert=0.5; classification independent of passes)
 *   Test 4  default fallback (lsa=0.1 bert=0.1) -- structural_transfer
 *   Test 5  boundary lsa exactly 0.3 -- strict > so falls to default fallback
 *   Test 6  determinism (two invocations -> JSON.stringify identical)
 *   Test 7  CANON PART 8 adversarial: forbidden in query_concept -> ExternalEgressViolation
 *   Test 8  CANON PART 8 adversarial: forbidden in doc_concept -> ExternalEgressViolation
 *
 * Suite-end audit:
 *   A1  walk every captured classifier output; JSON.stringify scan against
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

function captureOutput(name, output) {
  SCENARIO_RESULTS.push({ scenario: name, output: output });
}

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/rs-innovation-classifier.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

function runScenario(name, fn) {
  const start = Date.now();
  try {
    fn();
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

// ---------- Scenarios ----------

function scenario1StructuralTransfer() {
  const m = require('../core/rs-innovation-classifier.cjs');
  const scoredPair = {
    query_concept: 'cancer immunotherapy',
    doc_concept: 'checkpoint inhibitor PD-1',
    diff: 0.4, lsa: 0.5, bert: 0.1, passes: true,
  };
  const out = m.classify(scoredPair);
  captureOutput('1-structural-transfer', out);
  assert.equal(out.classification, 'structural_transfer',
    'lsa=0.5 bert=0.1 should be structural_transfer; got ' + out.classification);
  assert.equal(out.query_concept, 'cancer immunotherapy', 'pass-through query_concept');
  assert.equal(out.doc_concept, 'checkpoint inhibitor PD-1', 'pass-through doc_concept');
  assert.equal(out.lsa, 0.5, 'pass-through lsa');
  assert.equal(out.bert, 0.1, 'pass-through bert');
  assert.equal(out.passes, true, 'pass-through passes');
  assert.ok('bridge_concept' in out, 'has bridge_concept field');
}

function scenario2SemanticImplementation() {
  const m = require('../core/rs-innovation-classifier.cjs');
  const scoredPair = {
    query_concept: 'CRISPR delivery',
    doc_concept: 'liposome nanoparticle',
    diff: 0.4, lsa: 0.1, bert: 0.5, passes: true,
  };
  const out = m.classify(scoredPair);
  captureOutput('2-semantic-implementation', out);
  assert.equal(out.classification, 'semantic_implementation',
    'lsa=0.1 bert=0.5 should be semantic_implementation; got ' + out.classification);
  assert.equal(out.bridge_concept, 'semantic bridge', 'bridge_concept matches mapping');
}

function scenario3Hybrid() {
  const m = require('../core/rs-innovation-classifier.cjs');
  const scoredPair = {
    query_concept: 'quantum sensing',
    doc_concept: 'biomarker imaging',
    diff: 0.0, lsa: 0.5, bert: 0.5, passes: false,
  };
  const out = m.classify(scoredPair);
  captureOutput('3-hybrid', out);
  // classification is independent of dual-floor passes flag.
  assert.equal(out.classification, 'hybrid',
    'lsa=0.5 bert=0.5 should be hybrid; got ' + out.classification);
  assert.equal(out.passes, false, 'pass-through preserves passes=false');
  assert.equal(out.bridge_concept, 'cross-domain isomorphism + semantic bridge',
    'hybrid bridge_concept; got ' + out.bridge_concept);
}

function scenario4DefaultFallback() {
  const m = require('../core/rs-innovation-classifier.cjs');
  const scoredPair = {
    query_concept: 'noise floor',
    doc_concept: 'unrelated topic',
    diff: 0.0, lsa: 0.1, bert: 0.1, passes: false,
  };
  const out = m.classify(scoredPair);
  captureOutput('4-default-fallback', out);
  assert.equal(out.classification, 'structural_transfer',
    'lsa=0.1 bert=0.1 (both below threshold) should default to structural_transfer; got ' +
    out.classification);
}

function scenario5BoundaryLsaExact() {
  const m = require('../core/rs-innovation-classifier.cjs');
  const scoredPair = {
    query_concept: 'edge case',
    doc_concept: 'threshold boundary',
    diff: 0.2, lsa: 0.3, bert: 0.1, passes: false,
  };
  const out = m.classify(scoredPair);
  captureOutput('5-boundary-lsa-exact', out);
  // 0.3 is NOT > 0.3 (strict comparison), so falls to default fallback
  // structural_transfer (NOT promoted to structural_transfer via lsa-high path).
  assert.equal(out.classification, 'structural_transfer',
    'lsa=0.3 exactly should fall to default fallback; got ' + out.classification);
  // bridge_concept should be the default-fallback variant. We allow either
  // 'cross-domain isomorphism' (treating fallback identically to lsa-high
  // structural) or null. Explicit default-fallback bridge concept reflects
  // the canonical mapping in computeBridgeConcept.
  assert.ok(out.bridge_concept === 'cross-domain isomorphism' ||
    out.bridge_concept === null,
    'default-fallback bridge_concept; got ' + out.bridge_concept);
}

function scenario6Determinism() {
  const m = require('../core/rs-innovation-classifier.cjs');
  const scoredPair = {
    query_concept: 'reverse salient',
    doc_concept: 'lagging component',
    diff: 0.35, lsa: 0.55, bert: 0.20, passes: true,
  };
  const out1 = m.classify(scoredPair);
  const out2 = m.classify(scoredPair);
  captureOutput('6-determinism-1', out1);
  captureOutput('6-determinism-2', out2);
  assert.equal(JSON.stringify(out1), JSON.stringify(out2),
    'determinism: same input must produce byte-identical output');
}

function scenario7AdversarialQueryConcept() {
  const m = require('../core/rs-innovation-classifier.cjs');
  // FORBIDDEN_PATTERNS[2] matches "Lawrence said".
  const scoredPair = {
    query_concept: 'Lawrence said cancer immunotherapy',
    doc_concept: 'checkpoint inhibitor',
    diff: 0.4, lsa: 0.5, bert: 0.1, passes: true,
  };
  let threw = null;
  try {
    m.classify(scoredPair);
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on forbidden in query_concept');
  assert.equal(threw.name, 'ExternalEgressViolation',
    'must throw ExternalEgressViolation; got ' + (threw && threw.name));
  captureOutput('7-adv-query-throw', { thrown: threw.name });
}

function scenario8AdversarialDocConcept() {
  const m = require('../core/rs-innovation-classifier.cjs');
  // FORBIDDEN_PATTERNS[0] matches /@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/.
  const scoredPair = {
    query_concept: 'cancer immunotherapy',
    doc_concept: 'contact jonathan@mindrian.com for details',
    diff: 0.4, lsa: 0.5, bert: 0.1, passes: true,
  };
  let threw = null;
  try {
    m.classify(scoredPair);
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on forbidden in doc_concept');
  assert.equal(threw.name, 'ExternalEgressViolation',
    'must throw ExternalEgressViolation; got ' + (threw && threw.name));
  captureOutput('8-adv-doc-throw', { thrown: threw.name });
}

// ---------- A1 end-of-suite sweep ----------

function a1Sweep() {
  let hits = 0;
  for (const rec of SCENARIO_RESULTS) {
    const json = JSON.stringify(rec.output);
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

(function main() {
  process.stdout.write('=== 89.2-07-classifier suite (REPO_ROOT=' +
    REPO_ROOT + ') ===\n');

  runScenario('1-structural-transfer', scenario1StructuralTransfer);
  runScenario('2-semantic-implementation', scenario2SemanticImplementation);
  runScenario('3-hybrid', scenario3Hybrid);
  runScenario('4-default-fallback', scenario4DefaultFallback);
  runScenario('5-boundary-lsa-exact', scenario5BoundaryLsaExact);
  runScenario('6-determinism', scenario6Determinism);
  runScenario('7-adversarial-query-concept', scenario7AdversarialQueryConcept);
  runScenario('8-adversarial-doc-concept', scenario8AdversarialDocConcept);

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

  process.stdout.write('=== 89.2-07-classifier suite: ' +
    passed + '/8 passed' +
    (failed > 0 ? '  (' + failed + ' failed)' : '') +
    ' ===\n');

  if (failed > 0) {
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.exit(1);
  }
  process.exit(0);
})();
