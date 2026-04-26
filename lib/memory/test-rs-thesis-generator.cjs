#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 07 Task 3 -- thesis generator fixture suite.
 *
 * 9 scenarios for the Phase 4 deterministic pure-template-fill thesis
 * generator. Template:
 *
 *   "By applying ${X} to ${Y}, achieve ${Z} because ${mechanism} ${bridge_concept}."
 *
 *   X = classified_pair.query_concept
 *   Y = classified_pair.doc_concept
 *   Z = DOMINANT_TO_LABEL[breakthrough.dominant_dimension] OR 'novel insight'
 *   mechanism = MECHANISM_BY_CLASSIFICATION[classification]:
 *     structural_transfer      -> 'isomorphic structure transfers under'
 *     semantic_implementation  -> 'semantic embedding bridges'
 *     hybrid                   -> 'both structural and semantic alignment supports'
 *   bridge_concept = classified_pair.bridge_concept OR 'domain analogy'
 *
 *   Test 1  structural_transfer thesis -- mechanism = 'isomorphic structure transfers under'
 *   Test 2  semantic_implementation thesis -- mechanism = 'semantic embedding bridges'
 *   Test 3  hybrid thesis -- mechanism = 'both structural and semantic alignment supports'
 *   Test 4  missing dominant_dimension -- Z = 'novel insight'
 *   Test 5  missing bridge_concept -- bridge_concept fallback = 'domain analogy'
 *   Test 6  missing both -- Z = 'novel insight' AND bridge = 'domain analogy'
 *   Test 7  determinism -- byte-identical strings
 *   Test 8  CANON PART 8 adversarial: forbidden in classified_pair.query_concept
 *   Test 9  CANON PART 8 adversarial: forbidden in classified_pair.bridge_concept
 *
 * Suite-end audit:
 *   A1  walk every captured thesis output; scan against
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
    '../core/rs-thesis-generator.cjs',
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

function scenario1StructuralTransferThesis() {
  const m = require('../core/rs-thesis-generator.cjs');
  const cp = {
    query_concept: 'CRISPR delivery',
    doc_concept: 'liposome targeting',
    classification: 'structural_transfer',
    bridge_concept: 'cross-domain isomorphism',
  };
  const bt = {
    breakdown: { magnitude: 2 },
    dominant_dimension: 'magnitude',
  };
  const out = m.generateThesis(cp, bt);
  captureOutput('1-structural-transfer', out);
  assert.equal(typeof out, 'string', 'thesis must be a string; got ' + typeof out);
  assert.equal(out,
    'By applying CRISPR delivery to liposome targeting, achieve high-magnitude breakthrough because isomorphic structure transfers under cross-domain isomorphism.',
    'structural_transfer thesis exact match; got: ' + out);
}

function scenario2SemanticImplementationThesis() {
  const m = require('../core/rs-thesis-generator.cjs');
  const cp = {
    query_concept: 'CRISPR delivery',
    doc_concept: 'liposome targeting',
    classification: 'semantic_implementation',
    bridge_concept: 'semantic bridge',
  };
  const bt = {
    breakdown: { magnitude: 2 },
    dominant_dimension: 'magnitude',
  };
  const out = m.generateThesis(cp, bt);
  captureOutput('2-semantic-implementation', out);
  assert.equal(out,
    'By applying CRISPR delivery to liposome targeting, achieve high-magnitude breakthrough because semantic embedding bridges semantic bridge.',
    'semantic_implementation thesis exact match; got: ' + out);
}

function scenario3HybridThesis() {
  const m = require('../core/rs-thesis-generator.cjs');
  const cp = {
    query_concept: 'CRISPR delivery',
    doc_concept: 'liposome targeting',
    classification: 'hybrid',
    bridge_concept: 'cross-domain isomorphism + semantic bridge',
  };
  const bt = {
    breakdown: { feasibility: 2 },
    dominant_dimension: 'feasibility',
  };
  const out = m.generateThesis(cp, bt);
  captureOutput('3-hybrid', out);
  assert.equal(out,
    'By applying CRISPR delivery to liposome targeting, achieve feasible novel transfer because both structural and semantic alignment supports cross-domain isomorphism + semantic bridge.',
    'hybrid thesis exact match; got: ' + out);
}

function scenario4MissingDominantDimension() {
  const m = require('../core/rs-thesis-generator.cjs');
  const cp = {
    query_concept: 'topic alpha',
    doc_concept: 'topic beta',
    classification: 'structural_transfer',
    bridge_concept: 'cross-domain isomorphism',
  };
  const bt = {
    breakdown: {},
    // dominant_dimension intentionally omitted
  };
  const out = m.generateThesis(cp, bt);
  captureOutput('4-missing-dominant', out);
  assert.ok(typeof out === 'string', 'thesis must still be emitted');
  assert.ok(out.indexOf('achieve novel insight because') !== -1,
    'must contain "achieve novel insight because"; got: ' + out);
}

function scenario5MissingBridgeConcept() {
  const m = require('../core/rs-thesis-generator.cjs');
  const cp = {
    query_concept: 'topic alpha',
    doc_concept: 'topic beta',
    classification: 'structural_transfer',
    bridge_concept: null,
  };
  const bt = {
    breakdown: { impact: 2 },
    dominant_dimension: 'impact',
  };
  const out = m.generateThesis(cp, bt);
  captureOutput('5-missing-bridge', out);
  assert.ok(typeof out === 'string', 'thesis must be emitted');
  assert.ok(out.indexOf('domain analogy') !== -1,
    'must contain bridge_concept fallback "domain analogy"; got: ' + out);
}

function scenario6MissingBoth() {
  const m = require('../core/rs-thesis-generator.cjs');
  const cp = {
    query_concept: 'topic alpha',
    doc_concept: 'topic beta',
    classification: 'structural_transfer',
    bridge_concept: null,
  };
  const bt = { breakdown: {} };
  const out = m.generateThesis(cp, bt);
  captureOutput('6-missing-both', out);
  assert.ok(typeof out === 'string', 'thesis must be emitted');
  assert.ok(out.indexOf('achieve novel insight') !== -1,
    'must contain Z fallback "novel insight"; got: ' + out);
  assert.ok(out.indexOf('domain analogy') !== -1,
    'must contain bridge fallback "domain analogy"; got: ' + out);
}

function scenario7Determinism() {
  const m = require('../core/rs-thesis-generator.cjs');
  const cp = {
    query_concept: 'reverse salient',
    doc_concept: 'lagging component',
    classification: 'hybrid',
    bridge_concept: 'cross-domain isomorphism + semantic bridge',
  };
  const bt = {
    breakdown: { advantage: 2 },
    dominant_dimension: 'advantage',
  };
  const out1 = m.generateThesis(cp, bt);
  const out2 = m.generateThesis(cp, bt);
  captureOutput('7-determinism-1', out1);
  captureOutput('7-determinism-2', out2);
  assert.equal(out1, out2, 'determinism: same input must produce identical strings');
}

function scenario8AdversarialQueryConcept() {
  const m = require('../core/rs-thesis-generator.cjs');
  // FORBIDDEN_PATTERNS[2] matches "Lawrence said".
  const cp = {
    query_concept: 'Lawrence said CRISPR delivery is best',
    doc_concept: 'liposome targeting',
    classification: 'structural_transfer',
    bridge_concept: 'cross-domain isomorphism',
  };
  const bt = {
    breakdown: { magnitude: 2 },
    dominant_dimension: 'magnitude',
  };
  let threw = null;
  try {
    m.generateThesis(cp, bt);
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on forbidden in query_concept');
  assert.equal(threw.name, 'ExternalEgressViolation',
    'must throw ExternalEgressViolation; got ' + (threw && threw.name));
  captureOutput('8-adv-query-throw', { thrown: threw.name });
}

function scenario9AdversarialBridgeConcept() {
  const m = require('../core/rs-thesis-generator.cjs');
  // FORBIDDEN_PATTERNS[0] (email regex) smuggled into bridge_concept.
  const cp = {
    query_concept: 'CRISPR delivery',
    doc_concept: 'liposome targeting',
    classification: 'structural_transfer',
    bridge_concept: 'see jonathan@mindrian.com for details',
  };
  const bt = {
    breakdown: { magnitude: 2 },
    dominant_dimension: 'magnitude',
  };
  let threw = null;
  let out = null;
  try {
    out = m.generateThesis(cp, bt);
  } catch (err) {
    threw = err;
  }
  // Either throws on bridge_concept OR thesis output does NOT contain the
  // forbidden bytes. Both satisfy Canon Part 8.
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation; got ' + (threw && threw.name));
    captureOutput('9-adv-bridge-throw', { thrown: threw.name });
  } else {
    captureOutput('9-adv-bridge-scrubbed', out);
    assert.ok(!/jonathan@mindrian\.com/i.test(out),
      'thesis must not contain leaked email; got: ' + out);
  }
}

// ---------- A1 end-of-suite sweep ----------

function a1Sweep() {
  let hits = 0;
  for (const rec of SCENARIO_RESULTS) {
    const json = (typeof rec.output === 'string')
      ? rec.output
      : JSON.stringify(rec.output);
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
  process.stdout.write('=== 89.2-07-thesis suite (REPO_ROOT=' +
    REPO_ROOT + ') ===\n');

  runScenario('1-structural-transfer-thesis', scenario1StructuralTransferThesis);
  runScenario('2-semantic-implementation-thesis', scenario2SemanticImplementationThesis);
  runScenario('3-hybrid-thesis', scenario3HybridThesis);
  runScenario('4-missing-dominant-dimension', scenario4MissingDominantDimension);
  runScenario('5-missing-bridge-concept', scenario5MissingBridgeConcept);
  runScenario('6-missing-both', scenario6MissingBoth);
  runScenario('7-determinism', scenario7Determinism);
  runScenario('8-adversarial-query-concept', scenario8AdversarialQueryConcept);
  runScenario('9-adversarial-bridge-concept', scenario9AdversarialBridgeConcept);

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

  process.stdout.write('=== 89.2-07-thesis suite: ' +
    passed + '/9 passed' +
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
