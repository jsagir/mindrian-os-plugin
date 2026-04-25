#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1 Plan 03 -- rs-query-matrix adversarial fixture suite.
 *
 * 11 scenarios covering:
 *   Happy path (T1):                 1 scenario producing 60 queries
 *   Edge cases (T2-T5):              4 scenarios (null primary, empty
 *                                    adjacent, empty concepts, malformed)
 *   Determinism (T6, T7):            2 scenarios (deep-equal, 5-run identity)
 *   Adversarial (T8-T11):            4 scenarios (currency in primary,
 *                                    email in adjacent, person in concepts,
 *                                    SSN in terminology)
 *
 * End-of-suite A1 sweep:
 *   Walk every successful output's queries, JSON.stringify, scan against
 *   FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS. Any hit hard-fails the suite.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, path).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------- Frozen invariants ----------

const QUERIES_PER_CATEGORY = 15;
const CATEGORY_NAMES = Object.freeze([
  'a_intersect_b',
  'a_leads_to_b',
  'b_leads_to_a',
  'adjacent',
]);

// Hard substrings that must never appear in any successful output's queries.
// Mirrors Phase 89.1a-03 / Phase 90-08 DANGEROUS_SUBSTRINGS so the A1 sweep
// matches the reference suite byte-for-byte.
const DANGEROUS_SUBSTRINGS = Object.freeze([
  'Lawrence',
  '5.2M',
  'meeting with',
  'jonathan@mindrian.com',
  '123-45-6789',
]);

// Source of truth for the parity gate. Importing from the authoritative
// module (cross-room-aggregator) means any canon amendment there is felt
// here with zero code change.
const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');

// Every successful output's full categories object is captured here so the
// A1 sweep at suite end can scan every produced query string against
// FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS.
const successfulOutputs = [];

// ---------- Scenario bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];

async function runScenario(name, fn) {
  const start = Date.now();
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '  (' + (Date.now() - start) + 'ms)\n');
  } catch (err) {
    failed += 1;
    failures.push({ name: name, err: err });
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  }
}

// ---------- Fixture helpers ----------

function makeHappyAnalysis(overrides) {
  const base = {
    primary_domain: 'reverse-salient-framework',
    concepts: ['lag', 'expansion', 'bottleneck', 'disruption'],
    terminology: ['reverse salient', 'momentum'],
    methods: ['lsa', 'bert'],
    breakthroughs: ['differential analysis'],
    boundary_flag: false,
    adjacent_domains: ['systems-thinking', 'jtbd'],
  };
  return Object.assign({}, base, overrides || {});
}

function assertCategoryShape(out, label) {
  assert.ok(out && typeof out === 'object', label + ': output is not an object');
  assert.ok(out.categories && typeof out.categories === 'object',
    label + ': output.categories is missing');
  for (const cat of CATEGORY_NAMES) {
    assert.ok(Array.isArray(out.categories[cat]),
      label + ': categories.' + cat + ' is not an array');
    assert.equal(out.categories[cat].length, QUERIES_PER_CATEGORY,
      label + ': categories.' + cat + ' length mismatch (got ' +
      (out.categories[cat] && out.categories[cat].length) + ')');
    for (let i = 0; i < out.categories[cat].length; i += 1) {
      const q = out.categories[cat][i];
      assert.equal(typeof q, 'string',
        label + ': categories.' + cat + '[' + i + '] is not a string');
      assert.ok(q.length > 0,
        label + ': categories.' + cat + '[' + i + '] is empty');
    }
  }
}

function totalQueries(out) {
  let n = 0;
  for (const cat of CATEGORY_NAMES) n += out.categories[cat].length;
  return n;
}

// ---------- Main ----------

async function main() {
  process.stdout.write('\n=== Phase 89.1 Plan 03: rs-query-matrix fixture suite ===\n\n');

  // ----- Parity gate -----
  // The matrix module consumes FORBIDDEN_PATTERNS via rs-brain-substrate-
  // prompts.cjs which re-exports byte-for-byte from cross-room-aggregator.
  // Asserting parity here catches drift at every index.
  const prompts = require('../core/rs-brain-substrate-prompts.cjs');
  assert.equal(
    prompts.FORBIDDEN_PATTERNS.length,
    crossRoomAggregator.FORBIDDEN_PATTERNS.length,
    'FORBIDDEN_PATTERNS parity: length mismatch with cross-room-aggregator'
  );
  for (let i = 0; i < prompts.FORBIDDEN_PATTERNS.length; i += 1) {
    assert.equal(
      prompts.FORBIDDEN_PATTERNS[i].source,
      crossRoomAggregator.FORBIDDEN_PATTERNS[i].source,
      'FORBIDDEN_PATTERNS parity: regex[' + i + '].source mismatch'
    );
  }
  process.stdout.write('  ok  Parity gate: FORBIDDEN_PATTERNS[' +
    prompts.FORBIDDEN_PATTERNS.length + '] byte-for-byte with cross-room-aggregator\n');

  // Load module-under-test ONCE. The matrix module is pure (no Brain client,
  // no fs side effects) so no require.cache reset is needed between
  // scenarios; mirrors test-rs-domain-analyzer.cjs pattern.
  const matrixMod = require('../core/rs-query-matrix.cjs');
  const generateQueryMatrix = matrixMod.generateQueryMatrix;
  const ExternalEgressViolation = matrixMod.ExternalEgressViolation;

  // ========== Test 1: Happy path ==========

  await runScenario("T1: Happy path -- 60 queries from 7-field analysis", async () => {
    const da = makeHappyAnalysis();
    const out = generateQueryMatrix(da);
    assertCategoryShape(out, 'T1');
    assert.equal(totalQueries(out), 60, 'T1: total query count must equal 60');
    // Canonical guarantee: every query must mention A OR B (most mention
    // both). Templates that use pick(c|t|m|br, idx, a) substitute one of
    // the analysis arrays which themselves anchor to the domain, but the
    // load-bearing invariant is that NO query is generic prose with
    // neither A nor B present.
    const A = 'reverse-salient-framework';
    const B = 'systems-thinking';
    let aOrBCount = 0;
    for (const cat of CATEGORY_NAMES) {
      for (const q of out.categories[cat]) {
        if (q.indexOf(A) !== -1 || q.indexOf(B) !== -1) aOrBCount += 1;
      }
    }
    assert.equal(aOrBCount, 60,
      'T1: every query must mention A or B; got ' + aOrBCount + '/60');
    successfulOutputs.push({ label: 'T1', out: out });
  });

  // ========== Tests 2-5: Edge cases ==========

  await runScenario("T2: Edge -- null primary_domain returns invalid_analysis", async () => {
    const da = makeHappyAnalysis({ primary_domain: null });
    const out = generateQueryMatrix(da);
    assert.equal(out.error, 'invalid_analysis',
      'T2: expected error envelope, got: ' + JSON.stringify(out));
    assert.equal(out.reason, 'no_primary_domain',
      'T2: expected reason no_primary_domain, got: ' + out.reason);
  });

  await runScenario("T3: Edge -- empty adjacent_domains returns invalid_analysis", async () => {
    const da = makeHappyAnalysis({ adjacent_domains: [] });
    const out = generateQueryMatrix(da);
    assert.equal(out.error, 'invalid_analysis',
      'T3: expected error envelope, got: ' + JSON.stringify(out));
    assert.equal(out.reason, 'no_adjacent_domain',
      'T3: expected reason no_adjacent_domain, got: ' + out.reason);
  });

  await runScenario("T4: Edge -- empty concepts returns invalid_analysis", async () => {
    const da = makeHappyAnalysis({ concepts: [] });
    const out = generateQueryMatrix(da);
    assert.equal(out.error, 'invalid_analysis',
      'T4: expected error envelope, got: ' + JSON.stringify(out));
    assert.equal(out.reason, 'no_concepts',
      'T4: expected reason no_concepts, got: ' + out.reason);
  });

  await runScenario("T5: Edge -- malformed input ({}) returns invalid_analysis", async () => {
    const out = generateQueryMatrix({});
    assert.equal(out.error, 'invalid_analysis',
      'T5: expected error envelope, got: ' + JSON.stringify(out));
    // {} fails primary_domain check first per validateAnalysis order.
    assert.ok(typeof out.reason === 'string' && out.reason.length > 0,
      'T5: expected reason string, got: ' + out.reason);
  });

  // ========== Tests 6-7: Determinism ==========

  await runScenario("T6: Determinism -- two invocations yield deep-equal output", async () => {
    const da = makeHappyAnalysis();
    const out1 = generateQueryMatrix(da);
    const out2 = generateQueryMatrix(da);
    assertCategoryShape(out1, 'T6/out1');
    assertCategoryShape(out2, 'T6/out2');
    assert.equal(JSON.stringify(out1), JSON.stringify(out2),
      'T6: deep-equal failed; outputs differ across calls');
    successfulOutputs.push({ label: 'T6', out: out1 });
  });

  await runScenario("T7: Determinism -- 5 invocations yield identical JSON", async () => {
    const da = makeHappyAnalysis();
    const baseline = JSON.stringify(generateQueryMatrix(da));
    for (let i = 0; i < 4; i += 1) {
      const next = JSON.stringify(generateQueryMatrix(da));
      assert.equal(next, baseline,
        'T7: run ' + (i + 2) + ' differs from baseline; non-deterministic');
    }
    successfulOutputs.push({ label: 'T7', out: JSON.parse(baseline) });
  });

  // ========== Tests 8-11: Adversarial ==========
  //
  // Each adversarial scenario asserts that the matrix EITHER throws
  // ExternalEgressViolation OR returns the {error:'invalid_analysis',
  // reason:'forbidden_input'} envelope. Both satisfy Canon Part 8: no
  // forbidden bytes are inserted into the output array. The crucial
  // load-bearing fact is that NO out.categories is returned with leaked
  // strings.

  await runScenario("T8: Adversarial -- leaked currency in primary_domain", async () => {
    const da = makeHappyAnalysis({ primary_domain: '$5.2M-strategy' });
    let threw = null;
    let out = null;
    try {
      out = generateQueryMatrix(da);
    } catch (err) {
      threw = err;
    }
    if (threw !== null) {
      assert.equal(threw.name, 'ExternalEgressViolation',
        'T8: expected ExternalEgressViolation, got: ' + (threw && threw.name));
      // Throw path: nothing returned at all.
    } else {
      assert.equal(out.error, 'invalid_analysis',
        'T8: expected error envelope or throw, got: ' + JSON.stringify(out));
      assert.equal(out.reason, 'forbidden_input',
        'T8: expected reason forbidden_input, got: ' + out.reason);
      // Ensure no categories were leaked.
      assert.ok(!out.categories,
        'T8: forbidden input must not produce categories');
    }
  });

  await runScenario("T9: Adversarial -- leaked email in adjacent_domains[0]", async () => {
    const da = makeHappyAnalysis({ adjacent_domains: ['jonathan@mindrian.com'] });
    let threw = null;
    let out = null;
    try {
      out = generateQueryMatrix(da);
    } catch (err) {
      threw = err;
    }
    if (threw !== null) {
      assert.equal(threw.name, 'ExternalEgressViolation',
        'T9: expected ExternalEgressViolation, got: ' + (threw && threw.name));
    } else {
      assert.equal(out.error, 'invalid_analysis',
        'T9: expected error envelope or throw, got: ' + JSON.stringify(out));
      assert.equal(out.reason, 'forbidden_input',
        'T9: expected reason forbidden_input, got: ' + out.reason);
      assert.ok(!out.categories,
        'T9: forbidden input must not produce categories');
    }
  });

  await runScenario("T10: Adversarial -- leaked person in concepts[0]", async () => {
    const da = makeHappyAnalysis({ concepts: ['Lawrence said it', 'jtbd'] });
    let threw = null;
    let out = null;
    try {
      out = generateQueryMatrix(da);
    } catch (err) {
      threw = err;
    }
    if (threw !== null) {
      assert.equal(threw.name, 'ExternalEgressViolation',
        'T10: expected ExternalEgressViolation, got: ' + (threw && threw.name));
    } else {
      assert.equal(out.error, 'invalid_analysis',
        'T10: expected error envelope or throw, got: ' + JSON.stringify(out));
      assert.equal(out.reason, 'forbidden_input',
        'T10: expected reason forbidden_input, got: ' + out.reason);
      assert.ok(!out.categories,
        'T10: forbidden input must not produce categories');
    }
  });

  await runScenario("T11: Adversarial -- SSN-like in terminology", async () => {
    const da = makeHappyAnalysis({ terminology: ['key concept 123-45-6789'] });
    let threw = null;
    let out = null;
    try {
      out = generateQueryMatrix(da);
    } catch (err) {
      threw = err;
    }
    if (threw !== null) {
      assert.equal(threw.name, 'ExternalEgressViolation',
        'T11: expected ExternalEgressViolation, got: ' + (threw && threw.name));
    } else {
      assert.equal(out.error, 'invalid_analysis',
        'T11: expected error envelope or throw, got: ' + JSON.stringify(out));
      assert.equal(out.reason, 'forbidden_input',
        'T11: expected reason forbidden_input, got: ' + out.reason);
      assert.ok(!out.categories,
        'T11: forbidden input must not produce categories');
    }
  });

  // ========== A1 sweep: cross-scenario forbidden-pattern audit ==========
  //
  // Walk every captured successful output's queries, JSON.stringify, scan
  // against FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS. This is the same
  // load-bearing invariant the rs-domain-analyzer suite enforces (A1
  // sweep): forbidden bytes must NEVER appear in a successful output, no
  // matter which template path produced them.

  process.stdout.write('\n  --- A1 sweep: cross-scenario forbidden-pattern audit ---\n');
  let sweepHits = 0;
  for (const entry of successfulOutputs) {
    const blob = JSON.stringify(entry.out);
    for (const re of prompts.FORBIDDEN_PATTERNS) {
      if (re.test(blob)) {
        process.stderr.write('  A1 FAIL: ' + entry.label + ' matched FORBIDDEN_PATTERN ' + re.source + '\n');
        sweepHits += 1;
      }
    }
    for (const dang of DANGEROUS_SUBSTRINGS) {
      if (blob.indexOf(dang) !== -1) {
        process.stderr.write('  A1 FAIL: ' + entry.label + ' contains DANGEROUS_SUBSTRING "' + dang + '"\n');
        sweepHits += 1;
      }
    }
  }
  if (sweepHits === 0) {
    process.stdout.write('  ok  A1 sweep: ' + successfulOutputs.length +
      ' outputs scanned, 0 forbidden hits\n');
  } else {
    failed += 1;
    failures.push({ name: 'A1 sweep', err: new Error('A1 sweep had ' + sweepHits + ' forbidden hits') });
  }

  // ========== Final report ==========

  process.stdout.write('\n=== 89.1-03 query-matrix suite: ' + passed + '/11 passed ===\n');
  if (failed > 0) {
    process.stderr.write('\n=== ' + failed + ' FAILURES ===\n');
    for (const f of failures) {
      process.stderr.write('  ' + f.name + ': ' + (f.err && f.err.message) + '\n');
    }
    process.exit(1);
  }

  // Defensive: silence unused-locals if future refactor drops them.
  void REPO_ROOT;
  void ExternalEgressViolation;
}

main().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
