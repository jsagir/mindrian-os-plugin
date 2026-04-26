#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 07 Task 2 -- breakthrough scorer fixture suite.
 *
 * 10 scenarios for the Phase 3 deterministic 5-dimension 0-10 rubric:
 *
 *   feasibility   0-2 from substrate.tier (core=2, applied=1.5, theoretical=1)
 *   market        0-2 from industry signal count (0=0, 1-3=0.5, 4-9=1.0,
 *                                                  10-19=1.5, 20+=2.0)
 *   magnitude     0-2 from diff value (>=0.7=2, >=0.5=1.5, >=0.3=1.0, else 0)
 *   advantage     0-2 from cross-domain pair rarity (2 * (1 - density), clamped)
 *   impact        0-2 from BERT score (>=0.8=2, >=0.6=1.5, >=0.4=1.0,
 *                                       >=0.2=0.5, else 0)
 *
 *   Test 1  full rubric all-max -- score=10, dominant='feasibility' (frozen-order tie)
 *   Test 2  full rubric all-min (theoretical) -- score=1, dominant='feasibility' (only non-zero)
 *   Test 3  substrate tier 'applied' -- feasibility=1.5
 *   Test 4  industry signals 1-3 -- market=0.5
 *   Test 5  industry signals 4-9 -- market=1.0
 *   Test 6  industry signals 10-19 -- market=1.5
 *   Test 7  industry signals 20+ -- market=2.0
 *   Test 8  determinism (two invocations -> JSON.stringify identical)
 *   Test 9  CANON PART 8 adversarial: forbidden in classified_pair.query_concept
 *   Test 10 CANON PART 8 adversarial: forbidden in opts.substrate_metadata.title
 *
 * Suite-end audit:
 *   A1  walk every captured scoreBreakthrough output; JSON.stringify scan
 *       against FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS; ZERO hits.
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
    '../core/rs-breakthrough-scorer.cjs',
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

// ---------- Helper: build a baseline classified_pair (post-classifier shape) ----------

function baselineClassifiedPair(overrides) {
  const base = {
    query_concept: 'cancer immunotherapy',
    doc_concept: 'checkpoint inhibitor PD-1',
    diff: 0.4, lsa: 0.5, bert: 0.1, passes: true,
    classification: 'structural_transfer',
    bridge_concept: 'cross-domain isomorphism',
  };
  if (overrides) {
    for (const k of Object.keys(overrides)) base[k] = overrides[k];
  }
  return base;
}

// ---------- Scenarios ----------

function scenario1AllMax() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair({ diff: 0.8, bert: 0.9 });
  const opts = {
    substrate_metadata: { tier: 'core' },
    industry_signal_count: 20,
    pair_density: 0,
  };
  const out = m.scoreBreakthrough(cp, opts);
  captureOutput('1-all-max', out);
  assert.ok(out.breakthrough, 'has breakthrough field');
  assert.equal(out.breakthrough.score, 10, 'all-max score should be 10; got ' + out.breakthrough.score);
  assert.equal(out.breakthrough.breakdown.feasibility, 2.0);
  assert.equal(out.breakthrough.breakdown.market, 2.0);
  assert.equal(out.breakthrough.breakdown.magnitude, 2.0);
  assert.equal(out.breakthrough.breakdown.advantage, 2.0);
  assert.equal(out.breakthrough.breakdown.impact, 2.0);
  // Frozen-order tie-break: feasibility first.
  assert.equal(out.breakthrough.dominant_dimension, 'feasibility',
    'all-tied dominant should be feasibility (frozen-order tie-break first); got ' +
    out.breakthrough.dominant_dimension);
}

function scenario2AllMin() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair({ diff: 0.1, bert: 0.1 });
  const opts = {
    substrate_metadata: { tier: 'theoretical' },
    industry_signal_count: 0,
    pair_density: 1.0,
  };
  const out = m.scoreBreakthrough(cp, opts);
  captureOutput('2-all-min', out);
  // theoretical -> feasibility=1; signals=0 -> market=0; diff=0.1 -> magnitude=0;
  // density=1 -> advantage=0; bert=0.1 -> impact=0. Total = 1.
  assert.equal(out.breakthrough.score, 1, 'all-min score should be 1; got ' + out.breakthrough.score);
  assert.equal(out.breakthrough.breakdown.feasibility, 1.0);
  assert.equal(out.breakthrough.breakdown.market, 0.0);
  assert.equal(out.breakthrough.breakdown.magnitude, 0.0);
  assert.equal(out.breakthrough.breakdown.advantage, 0.0);
  assert.equal(out.breakthrough.breakdown.impact, 0.0);
  assert.equal(out.breakthrough.dominant_dimension, 'feasibility',
    'only non-zero dim is feasibility; got ' + out.breakthrough.dominant_dimension);
}

function scenario3SubstrateTierApplied() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair({ diff: 0.1, bert: 0.1 });
  const opts = {
    substrate_metadata: { tier: 'applied' },
    industry_signal_count: 0,
    pair_density: 1.0,
  };
  const out = m.scoreBreakthrough(cp, opts);
  captureOutput('3-substrate-applied', out);
  assert.equal(out.breakthrough.breakdown.feasibility, 1.5,
    'applied tier -> feasibility 1.5; got ' + out.breakthrough.breakdown.feasibility);
  assert.equal(out.breakthrough.score, 1.5, 'total = 1.5');
}

function scenario4IndustrySignals1to3() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair({ diff: 0.1, bert: 0.1 });
  const opts = {
    substrate_metadata: { tier: 'theoretical' },
    industry_signal_count: 2,
    pair_density: 1.0,
  };
  const out = m.scoreBreakthrough(cp, opts);
  captureOutput('4-signals-1to3', out);
  assert.equal(out.breakthrough.breakdown.market, 0.5,
    '1-3 signals -> market 0.5; got ' + out.breakthrough.breakdown.market);
}

function scenario5IndustrySignals4to9() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair({ diff: 0.1, bert: 0.1 });
  const opts = {
    substrate_metadata: { tier: 'theoretical' },
    industry_signal_count: 7,
    pair_density: 1.0,
  };
  const out = m.scoreBreakthrough(cp, opts);
  captureOutput('5-signals-4to9', out);
  assert.equal(out.breakthrough.breakdown.market, 1.0,
    '4-9 signals -> market 1.0; got ' + out.breakthrough.breakdown.market);
}

function scenario6IndustrySignals10to19() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair({ diff: 0.1, bert: 0.1 });
  const opts = {
    substrate_metadata: { tier: 'theoretical' },
    industry_signal_count: 15,
    pair_density: 1.0,
  };
  const out = m.scoreBreakthrough(cp, opts);
  captureOutput('6-signals-10to19', out);
  assert.equal(out.breakthrough.breakdown.market, 1.5,
    '10-19 signals -> market 1.5; got ' + out.breakthrough.breakdown.market);
}

function scenario7IndustrySignals20Plus() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair({ diff: 0.1, bert: 0.1 });
  const opts = {
    substrate_metadata: { tier: 'theoretical' },
    industry_signal_count: 35,
    pair_density: 1.0,
  };
  const out = m.scoreBreakthrough(cp, opts);
  captureOutput('7-signals-20plus', out);
  assert.equal(out.breakthrough.breakdown.market, 2.0,
    '20+ signals -> market 2.0; got ' + out.breakthrough.breakdown.market);
}

function scenario8Determinism() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair({ diff: 0.45, bert: 0.55 });
  const opts = {
    substrate_metadata: { tier: 'applied' },
    industry_signal_count: 8,
    pair_density: 0.4,
  };
  const out1 = m.scoreBreakthrough(cp, opts);
  const out2 = m.scoreBreakthrough(cp, opts);
  captureOutput('8-determinism-1', out1);
  captureOutput('8-determinism-2', out2);
  assert.equal(JSON.stringify(out1), JSON.stringify(out2),
    'determinism: same input must produce byte-identical output');
  // Score in [0, 10].
  assert.ok(out1.breakthrough.score >= 0 && out1.breakthrough.score <= 10,
    'score in [0,10]; got ' + out1.breakthrough.score);
}

function scenario9AdversarialQueryConcept() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  // FORBIDDEN_PATTERNS[2]: "Lawrence said" / "Jonathan said" etc.
  const cp = baselineClassifiedPair({
    query_concept: 'Lawrence said cancer immunotherapy is the future',
  });
  const opts = {
    substrate_metadata: { tier: 'core' },
    industry_signal_count: 10,
    pair_density: 0.5,
  };
  let threw = null;
  try {
    m.scoreBreakthrough(cp, opts);
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on forbidden in query_concept');
  assert.equal(threw.name, 'ExternalEgressViolation',
    'must throw ExternalEgressViolation; got ' + (threw && threw.name));
  captureOutput('9-adv-query-throw', { thrown: threw.name });
}

function scenario10AdversarialSubstrateTitle() {
  const m = require('../core/rs-breakthrough-scorer.cjs');
  const cp = baselineClassifiedPair();
  // FORBIDDEN_PATTERNS[0]: email regex.
  const opts = {
    substrate_metadata: {
      tier: 'core',
      title: 'Strategy paper from jonathan@mindrian.com archive',
    },
    industry_signal_count: 10,
    pair_density: 0.5,
  };
  let threw = null;
  let out = null;
  try {
    out = m.scoreBreakthrough(cp, opts);
  } catch (err) {
    threw = err;
  }
  // Either the scorer threw on the smuggled email, OR the output does
  // not contain it (Layer 2 audit catches via auditQueryObject; for the
  // scorer to embed substrate_metadata.title in its output is a design
  // choice -- if the field is not propagated, no leak; if it is
  // propagated, Layer 2 must catch). Both satisfy Canon Part 8.
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation; got ' + (threw && threw.name));
    captureOutput('10-adv-substrate-throw', { thrown: threw.name });
  } else {
    captureOutput('10-adv-substrate-scrubbed', out);
    const json = JSON.stringify(out);
    assert.ok(!/jonathan@mindrian\.com/i.test(json),
      'output must not contain leaked email; got: ' + json);
  }
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
  process.stdout.write('=== 89.2-07-breakthrough suite (REPO_ROOT=' +
    REPO_ROOT + ') ===\n');

  runScenario('1-all-max', scenario1AllMax);
  runScenario('2-all-min', scenario2AllMin);
  runScenario('3-substrate-applied', scenario3SubstrateTierApplied);
  runScenario('4-signals-1to3', scenario4IndustrySignals1to3);
  runScenario('5-signals-4to9', scenario5IndustrySignals4to9);
  runScenario('6-signals-10to19', scenario6IndustrySignals10to19);
  runScenario('7-signals-20plus', scenario7IndustrySignals20Plus);
  runScenario('8-determinism', scenario8Determinism);
  runScenario('9-adversarial-query-concept', scenario9AdversarialQueryConcept);
  runScenario('10-adversarial-substrate-title', scenario10AdversarialSubstrateTitle);

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

  process.stdout.write('=== 89.2-07-breakthrough suite: ' +
    passed + '/10 passed' +
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
