#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-03 -- measured differential offline contract tests (SEED-049 D-200-1).
 *
 * Every guard runs OFFLINE (Canon Part 8: no Brain, no live model, no network,
 * no model download). The semantic leg is a deterministic stub encodeFn; the
 * lexical leg is the pure-CJS jaccard-v1 metric. No @huggingface/transformers
 * import ever happens in this suite.
 *
 *   Tests 1-4  lexical-overlap.cjs (the no-Python lexical leg)
 *   Tests 5-10 scoreMeasured in rs-differential-scorer.cjs (the D-200-1 swap)
 */
'use strict';

const assert = require('node:assert');

const lex = require('../lib/core/eureka/lexical-overlap.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

async function run() {
  // ======================================================================
  // Task 1: lexical-overlap.cjs (jaccard-v1)
  // ======================================================================

  // ---------- Test 1: identity 1.0, disjoint 0.0 ----------
  {
    assert.strictEqual(
      lex.lexicalOverlap('circadian rhythm optimization', 'circadian rhythm optimization'),
      1.0,
      'Test 1: identical strings overlap 1.0'
    );
    assert.strictEqual(
      lex.lexicalOverlap('alpha beta gamma', 'delta epsilon zeta'),
      0.0,
      'Test 1: token-disjoint strings overlap 0.0'
    );
    ok('Test 1: identity 1.0, disjoint 0.0');
  }

  // ---------- Test 2: the canonical eureka pair shares NO content vocab ----------
  {
    const s = lex.lexicalOverlap(
      'circadian rhythm optimization in sleep science',
      'manufacturing shift scheduling around worker fatigue'
    );
    assert.strictEqual(s, 0.0, 'Test 2: cross-domain eureka pair overlap 0.0 after stopword removal');
    ok('Test 2: canonical eureka pair shares no content vocabulary (0.0)');
  }

  // ---------- Test 3: tokenize lowercases, strips punctuation, drops stopwords, deterministic ----------
  {
    const t1 = lex.tokenize('The Circadian, RHYTHM! optimization in the sleep.');
    // lowercased, punctuation stripped, stopwords ('the', 'in') dropped
    assert.deepStrictEqual(
      t1,
      ['circadian', 'rhythm', 'optimization', 'sleep'],
      'Test 3: tokenize lowercases + strips punctuation + drops stopwords'
    );
    // deterministic: same input, same token list, every run
    const t2 = lex.tokenize('The Circadian, RHYTHM! optimization in the sleep.');
    assert.deepStrictEqual(t2, t1, 'Test 3: tokenize is deterministic');
    // sub-2-char tokens dropped
    assert.deepStrictEqual(lex.tokenize('a b c circadian'), ['circadian'], 'Test 3: sub-2-char tokens dropped');
    ok('Test 3: tokenize normalizes and is deterministic');
  }

  // ---------- Test 4: empty / stopword-only -> 0.0, never NaN, never throw ----------
  {
    let threw = false;
    let vEmpty; let vStop; let vOneEmpty;
    try {
      vEmpty = lex.lexicalOverlap('', '');
      vStop = lex.lexicalOverlap('the a of in around', 'of the by a');
      vOneEmpty = lex.lexicalOverlap('circadian rhythm', '');
    } catch (_e) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Test 4: never throws');
    assert.strictEqual(vEmpty, 0.0, 'Test 4: both-empty overlap 0.0');
    assert.ok(!Number.isNaN(vEmpty), 'Test 4: both-empty not NaN');
    assert.strictEqual(vStop, 0.0, 'Test 4: stopword-only overlap 0.0');
    assert.ok(!Number.isNaN(vStop), 'Test 4: stopword-only not NaN');
    assert.strictEqual(vOneEmpty, 0.0, 'Test 4: one-empty overlap 0.0');
    ok('Test 4: empty / stopword-only yields 0.0, never NaN, never throws');
  }

  console.log('\n' + passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
