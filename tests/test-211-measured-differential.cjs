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
const scorer = require('../lib/core/rs-differential-scorer.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// Deterministic offline stub encoders. No model, no I/O.
function identicalVecs() { return [[1, 2, 3], [1, 2, 3]]; }          // cosine 1.0
function orthogonalVecs() { return [[1, 0], [0, 1]]; }               // cosine 0.0
function near(a, b, tol) { return Math.abs(a - b) <= (tol || 0.02); }

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

  // ======================================================================
  // Task 2: scoreMeasured in rs-differential-scorer.cjs (the D-200-1 swap)
  // ======================================================================

  // ---------- Test 5: semantic_implementation, breakthrough ----------
  {
    const r = await scorer.scoreMeasured('sleep science', 'shift work', {
      encodeFn: identicalVecs,
      lexicalFn: function () { return 0.05; },
    });
    assert.strictEqual(r.semantic, 1.0, 'Test 5: semantic cosine 1.0');
    assert.strictEqual(r.lexical, 0.05, 'Test 5: lexical 0.05');
    assert.ok(near(r.signed_diff, 0.95), 'Test 5: signed_diff near +0.95');
    assert.strictEqual(r.direction, 'semantic_implementation', 'Test 5: direction');
    assert.strictEqual(r.passes, true, 'Test 5: passes true');
    assert.strictEqual(r.band, 'breakthrough', 'Test 5: band breakthrough');
    ok('Test 5: near-identical semantic + low lexical -> semantic_implementation, breakthrough');
  }

  // ---------- Test 6: structural_transfer, high leg is lexical ----------
  {
    const r = await scorer.scoreMeasured('circadian', 'manufacturing', {
      encodeFn: orthogonalVecs,
      lexicalFn: function () { return 0.8; },
    });
    assert.strictEqual(r.semantic, 0, 'Test 6: semantic cosine 0');
    assert.ok(near(r.signed_diff, -0.8), 'Test 6: signed_diff near -0.8');
    assert.strictEqual(r.direction, 'structural_transfer', 'Test 6: direction');
    assert.strictEqual(r.passes, true, 'Test 6: passes true (high leg lexical 0.8 > 0.2)');
    ok('Test 6: orthogonal semantic + high lexical -> structural_transfer, passes');
  }

  // ---------- Test 7: provenance stamped + env floor resolution ----------
  {
    const r = await scorer.scoreMeasured('a topic', 'b topic', {
      encodeFn: identicalVecs,
      lexicalFn: function () { return 0.1; },
    });
    assert.ok(r.provenance && typeof r.provenance === 'object', 'Test 7: provenance present');
    assert.strictEqual(r.provenance.semantic_model, 'stub', 'Test 7: semantic_model stub under encodeFn');
    assert.strictEqual(r.provenance.semantic_dtype, 'stub', 'Test 7: semantic_dtype stub under encodeFn');
    assert.strictEqual(r.provenance.lexical_method, 'jaccard-v1', 'Test 7: lexical_method jaccard-v1');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.provenance.measured_at), 'Test 7: measured_at ISO date');

    const saved = process.env.EUREKA_DIFF_FLOOR;
    try {
      process.env.EUREKA_DIFF_FLOOR = 'not-a-number';
      assert.strictEqual(scorer._test.resolveEurekaDiffFloor(), 0.3, 'Test 7: invalid env falls back to 0.3');
      process.env.EUREKA_DIFF_FLOOR = '0.42';
      assert.strictEqual(scorer._test.resolveEurekaDiffFloor(), 0.42, 'Test 7: valid env honored');
    } finally {
      if (saved === undefined) delete process.env.EUREKA_DIFF_FLOOR;
      else process.env.EUREKA_DIFF_FLOOR = saved;
    }
    ok('Test 7: provenance stamped (model/dtype/method/date) + EUREKA_DIFF_FLOOR resolution');
  }

  // ---------- Test 8: Part 8 throws BEFORE encodeFn is ever invoked ----------
  {
    let calls = 0;
    function countingEncode() { calls += 1; return identicalVecs(); }
    let threw = false;
    let errName = '';
    try {
      await scorer.scoreMeasured('please contact foo@bar.com now', 'clean text', {
        encodeFn: countingEncode,
        lexicalFn: function () { return 0.1; },
      });
    } catch (e) {
      threw = true;
      errName = e && e.name;
    }
    assert.strictEqual(threw, true, 'Test 8: throws on forbidden input');
    assert.strictEqual(errName, 'ExternalEgressViolation', 'Test 8: ExternalEgressViolation');
    assert.strictEqual(calls, 0, 'Test 8: encodeFn NEVER invoked (call-count 0)');
    ok('Test 8: forbidden input throws ExternalEgressViolation, encodeFn call-count 0');
  }

  // ---------- Test 9: encoder unavailable degrades, never throws ----------
  {
    let threw = false;
    let r;
    try {
      r = await scorer.scoreMeasured('alpha', 'beta', { _forceUnavailable: true });
    } catch (_e) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Test 9: never throws on encoder unavailable');
    assert.strictEqual(r.semantic, null, 'Test 9: semantic null');
    assert.strictEqual(r.passes, false, 'Test 9: passes false');
    assert.strictEqual(r.warning, 'encoder_unavailable', 'Test 9: warning encoder_unavailable');
    ok('Test 9: encoder unavailable yields {semantic:null, passes:false, warning} without throwing');
  }

  // ---------- Test 10: legacy contract regression pin ----------
  {
    assert.strictEqual(typeof scorer.score, 'function', 'Test 10: score still exported');
    assert.strictEqual(typeof scorer.SEMANTIC_FLOOR, 'number', 'Test 10: SEMANTIC_FLOOR still exported');
    assert.strictEqual(typeof scorer.passesSemanticFloor, 'function', 'Test 10: passesSemanticFloor still exported');
    assert.strictEqual(typeof scorer.gateCandidatesBySemanticFloor, 'function', 'Test 10: gateCandidatesBySemanticFloor still exported');
    assert.strictEqual(scorer._test.DIFF_FLOOR, 0.3, 'Test 10: DIFF_FLOOR 0.3');
    assert.strictEqual(scorer._test.LSA_FLOOR, 0.2, 'Test 10: LSA_FLOOR 0.2');
    assert.strictEqual(scorer._test.BERT_FLOOR, 0.2, 'Test 10: BERT_FLOOR 0.2');
    ok('Test 10: legacy score() contract surface unchanged');
  }

  console.log('\n' + passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
