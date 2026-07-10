#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 212-01 Task 2 -- Eureka Critic Stage A offline contract tests.
 *
 * Every guard runs OFFLINE (Canon Part 8: no Brain, no live model, no network,
 * no model download). The heavy dep (@huggingface/transformers) is NEVER
 * imported: every embedding goes through an injected stub encodeFn (the 211
 * embedding-spine test-seam precedent), and the nearest-neighbor backend is a
 * stub knnFn (never the real vector-store; the vec0 fix is a parallel task).
 *
 *   Test 1: an unsourced K/M/B or dollar figure routes pseudoscience /
 *           unsourced_quantity and the encoder is NEVER called (call-count 0).
 *   Test 2: opts.sourcedQuantities true lets a catalog-sourced figure through
 *           the quantity gate (the JHU Opportunity Statement escape hatch).
 *   Test 3: a mechanism whose noun-swapped variants embed identically routes
 *           general_shallow / domain_swap_invariant.
 *   Test 4: a very-near graph neighbor routes restatement / low_novelty_delta.
 *   Test 5: with no knnFn the novelty gate degrades (gate_skipped) not throws.
 *   Test 6: a specific, entity-rich mechanism passing all gates returns
 *           pass:true with quantized shift, nn_delta, entity_count, embedder.
 *   Test 7: EUREKA_SWAP_INVARIANCE_FLOOR is read at call time (env override).
 */
'use strict';

const assert = require('node:assert');
const critic = require('../lib/core/eureka-critic.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// ---------- stub encoders (no model, fully deterministic) ----------

// Constant encoder: same vector for every text. Original and every noun-swapped
// variant collapse onto one point, so the swap shift is exactly 0.
function constantEncode(texts) {
  return texts.map(function () { return [1, 0, 0, 0]; });
}

// Distinct encoder: a centered FNV-1a hash vector per unique string. Different
// strings map to near-orthogonal vectors, so noun-swapped variants move far
// from the original and the swap shift is large (well above the floor).
function distinctEncode(texts) {
  return texts.map(function (t) {
    let h = 2166136261 >>> 0;
    const s = String(t == null ? '' : t);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return [
      (h & 255) - 128,
      ((h >>> 8) & 255) - 128,
      ((h >>> 16) & 255) - 128,
      ((h >>> 24) & 255) - 128,
    ];
  });
}

async function run() {
  // ---------- Test 1: fabricated-quantity gate runs before any embedding ----------
  {
    let calls = 0;
    function countingEncode(texts) { calls += 1; return distinctEncode(texts); }
    const r = await critic.stageA(
      { text: 'A $2 billion market with 5B users by 2030.', mechanismText: 'A generic scalable synergy play.', sourceDomainTag: 'finance', targetDomainTag: 'computing' },
      { encodeFn: countingEncode }
    );
    assert.strictEqual(r.pass, false, 'Test 1: pass false');
    assert.strictEqual(r.route, 'pseudoscience', 'Test 1: route pseudoscience');
    assert.strictEqual(r.tag, 'unsourced_quantity', 'Test 1: tag unsourced_quantity');
    assert.strictEqual(calls, 0, 'Test 1: encoder never called (gate 1 precedes embedding)');
    ok('Test 1: unsourced K/M/B or $ figure routes pseudoscience, encoder call-count 0');
  }

  // ---------- Test 2: sourced-quantities escape hatch ----------
  {
    const r = await critic.stageA(
      { text: 'Catalog technology C16796 lists a $2 billion addressable market.', mechanismText: 'The Helmholtz resonator couples 40kHz ultrasound into a Titanium microchannel array.', sourceDomainTag: 'medicine', targetDomainTag: 'engineering' },
      { encodeFn: distinctEncode, knnFn: function () { return [{ similarity: 0.30 }]; }, sourcedQuantities: true }
    );
    assert.notStrictEqual(r.tag, 'unsourced_quantity', 'Test 2: quantity gate not tripped');
    assert.notStrictEqual(r.route, 'pseudoscience', 'Test 2: not routed to pseudoscience by the quantity gate');
    ok('Test 2: opts.sourcedQuantities true clears the quantity gate');
  }

  // ---------- Test 3: domain-swap invariance ----------
  {
    const r = await critic.stageA(
      { text: 'A holistic adaptive paradigm.', mechanismText: 'A general adaptive framework leverages synergistic holistic dynamics across the whole.', sourceDomainTag: 'social', targetDomainTag: 'computing' },
      { encodeFn: constantEncode, knnFn: function () { return [{ similarity: 0.10 }]; } }
    );
    assert.strictEqual(r.pass, false, 'Test 3: pass false');
    assert.strictEqual(r.route, 'general_shallow', 'Test 3: route general_shallow');
    assert.strictEqual(r.tag, 'domain_swap_invariant', 'Test 3: tag domain_swap_invariant');
    ok('Test 3: swap-invariant filler routes general_shallow / domain_swap_invariant');
  }

  // ---------- Test 4: nearest-neighbor novelty delta (restatement) ----------
  {
    const r = await critic.stageA(
      { text: 'A photonic filter restated.', mechanismText: 'The Bragg grating filters photons in a Silicon waveguide at 1550nm.', sourceDomainTag: 'materials', targetDomainTag: 'computing' },
      { encodeFn: distinctEncode, knnFn: function () { return [{ similarity: 0.97 }, { similarity: 0.40 }]; } }
    );
    assert.strictEqual(r.pass, false, 'Test 4: pass false');
    assert.strictEqual(r.route, 'restatement', 'Test 4: route restatement');
    assert.strictEqual(r.tag, 'low_novelty_delta', 'Test 4: tag low_novelty_delta');
    ok('Test 4: a very-near graph neighbor routes restatement / low_novelty_delta');
  }

  // ---------- Test 5: missing knnFn degrades, never throws ----------
  {
    const r = await critic.stageA(
      { text: 'A thermoelectric heat pump.', mechanismText: 'The Peltier junction pumps heat through a Bismuth Telluride couple at 5A.', sourceDomainTag: 'energy', targetDomainTag: 'materials' },
      { encodeFn: distinctEncode }
    );
    assert.strictEqual(r.pass, true, 'Test 5: pass true (other gates cleared)');
    assert.ok(r.features && r.features.gate_skipped === 'nn_unavailable', 'Test 5: novelty gate recorded gate_skipped');
    ok('Test 5: absent knnFn records gate_skipped nn_unavailable and does not throw');
  }

  // ---------- Test 6: a specific mechanism passes all gates ----------
  {
    const r = await critic.stageA(
      { text: 'A superconducting quantum junction.', mechanismText: 'The Josephson junction couples Niobium electrodes across a 2nm oxide barrier.', sourceDomainTag: 'materials', targetDomainTag: 'computing' },
      { encodeFn: distinctEncode, knnFn: function () { return [{ similarity: 0.40 }]; } }
    );
    assert.strictEqual(r.pass, true, 'Test 6: pass true');
    assert.ok(r.features, 'Test 6: features present');
    assert.strictEqual(r.features.shift, critic.quantize(r.features.shift), 'Test 6: shift is quantized (2dp)');
    assert.strictEqual(r.features.nn_delta, critic.quantize(r.features.nn_delta), 'Test 6: nn_delta is quantized (2dp)');
    assert.ok(typeof r.features.entity_count === 'number' && r.features.entity_count >= 2, 'Test 6: entity_count >= 2');
    assert.ok(typeof r.features.embedder === 'string' && r.features.embedder.length > 0, 'Test 6: embedder provenance recorded');
    ok('Test 6: entity-rich mechanism passes all gates with quantized provenance-carrying features');
  }

  // ---------- Test 7: env override read at call time ----------
  {
    const saved = process.env.EUREKA_SWAP_INVARIANCE_FLOOR;
    try {
      delete process.env.EUREKA_SWAP_INVARIANCE_FLOOR;
      const base = await critic.stageA(
        { text: 'A quantum junction.', mechanismText: 'The Josephson junction couples Niobium electrodes across a 2nm oxide barrier.', sourceDomainTag: 'materials', targetDomainTag: 'computing' },
        { encodeFn: distinctEncode, knnFn: function () { return [{ similarity: 0.40 }]; } }
      );
      assert.strictEqual(base.pass, true, 'Test 7: default floor lets a high-shift mechanism through');

      process.env.EUREKA_SWAP_INVARIANCE_FLOOR = '2.0';
      const raised = await critic.stageA(
        { text: 'A quantum junction.', mechanismText: 'The Josephson junction couples Niobium electrodes across a 2nm oxide barrier.', sourceDomainTag: 'materials', targetDomainTag: 'computing' },
        { encodeFn: distinctEncode, knnFn: function () { return [{ similarity: 0.40 }]; } }
      );
      assert.strictEqual(raised.pass, false, 'Test 7: raised floor now trips the swap gate');
      assert.strictEqual(raised.tag, 'domain_swap_invariant', 'Test 7: raised floor tags domain_swap_invariant');
      ok('Test 7: EUREKA_SWAP_INVARIANCE_FLOOR is read at call time');
    } finally {
      if (saved === undefined) delete process.env.EUREKA_SWAP_INVARIANCE_FLOOR;
      else process.env.EUREKA_SWAP_INVARIANCE_FLOOR = saved;
    }
  }

  console.log('\n' + passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
