#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-01 -- embedding-spine offline contract tests (SEED-049 D-200-1).
 *
 * All five guards run OFFLINE (Canon Part 8: no Brain, no live model, no
 * network egress, no model download). The heavy dep (@huggingface/transformers)
 * is NEVER imported by this suite: the stub encodeFn injection seam and the
 * _forceUnavailable test hook exercise every code path without a model load.
 *
 *   Test 1: encodeFn injection returns stub vectors + provenance.model 'stub';
 *           no model load is attempted.
 *   Test 2: encoderProvenance() resolves the model/dtype from env at call time
 *           (default Xenova/all-MiniLM-L6-v2 / q8; overridable).
 *   Test 3: the _forceUnavailable hook makes embedTexts degrade with
 *           {success:false, error:'encoder_unavailable'} and NEVER throw.
 *   Test 4: cosineSimilarity is reference-equal to the rs-pinecone-bridge
 *           export (Canon Part 7 reuse, no fork).
 *   Test 5: injected stub vectors pass through UNCHANGED (no re-normalization).
 */
'use strict';

const assert = require('node:assert');

const spine = require('../lib/core/eureka/embedding-spine.cjs');
const bridge = require('../lib/core/rs-pinecone-bridge.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// Deterministic, dumb, pure stub encoder. No I/O, no model. Returns a fixed
// 3-dim vector per text so the suite is fully reproducible and offline.
function stubEncode(texts) {
  return texts.map(function vec(t) {
    const s = String(t || '');
    return [s.length, (s.match(/[aeiou]/gi) || []).length, s.split(/\s+/).length];
  });
}

async function run() {
  // ---------- Test 1: encodeFn injection bypasses the model ----------
  {
    const r = await spine.embedTexts(['alpha', 'beta gamma'], { encodeFn: stubEncode });
    assert.strictEqual(r.success, true, 'Test 1: success true');
    assert.deepStrictEqual(r.vectors, stubEncode(['alpha', 'beta gamma']), 'Test 1: vectors from stub');
    assert.ok(r.provenance && typeof r.provenance === 'object', 'Test 1: provenance present');
    assert.strictEqual(r.provenance.model, 'stub', 'Test 1: provenance.model is stub');
    ok('Test 1: encodeFn injection returns stub vectors + stub provenance');
  }

  // ---------- Test 2: encoderProvenance resolves from env at call time ----------
  {
    const savedModel = process.env.MINDRIAN_EMBED_MODEL;
    const savedDtype = process.env.MINDRIAN_EMBED_DTYPE;
    try {
      delete process.env.MINDRIAN_EMBED_MODEL;
      delete process.env.MINDRIAN_EMBED_DTYPE;
      const def = spine.encoderProvenance();
      assert.strictEqual(def.model, 'Xenova/all-MiniLM-L6-v2', 'Test 2: default model');
      assert.strictEqual(def.dtype, 'q8', 'Test 2: default dtype');
      assert.strictEqual(def.dim, 384, 'Test 2: default dim');
      assert.strictEqual(def.method, 'transformers.js-feature-extraction', 'Test 2: method');

      process.env.MINDRIAN_EMBED_MODEL = 'Xenova/bge-small-en-v1.5';
      const alt = spine.encoderProvenance();
      assert.strictEqual(alt.model, 'Xenova/bge-small-en-v1.5', 'Test 2: overridden model');
    } finally {
      if (savedModel === undefined) delete process.env.MINDRIAN_EMBED_MODEL;
      else process.env.MINDRIAN_EMBED_MODEL = savedModel;
      if (savedDtype === undefined) delete process.env.MINDRIAN_EMBED_DTYPE;
      else process.env.MINDRIAN_EMBED_DTYPE = savedDtype;
    }
    ok('Test 2: encoderProvenance reflects env defaults and overrides');
  }

  // ---------- Test 3: _forceUnavailable degrades, never throws ----------
  {
    let threw = false;
    let r;
    try {
      r = await spine.embedTexts(['anything'], { _forceUnavailable: true });
    } catch (_e) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Test 3: embedTexts never throws');
    assert.strictEqual(r.success, false, 'Test 3: success false');
    assert.strictEqual(r.error, 'encoder_unavailable', 'Test 3: encoder_unavailable');
    ok('Test 3: _forceUnavailable degrades to encoder_unavailable without throwing');
  }

  // ---------- Test 4: cosineSimilarity is the reused bridge export ----------
  {
    assert.strictEqual(spine.cosineSimilarity, bridge.cosineSimilarity, 'Test 4: reference-equal');
    ok('Test 4: cosineSimilarity is the rs-pinecone-bridge export (no fork)');
  }

  // ---------- Test 5: injected vectors pass through unchanged ----------
  {
    // Deliberately un-normalized vectors. If the spine re-normalized injected
    // vectors, [3,4] would become [0.6,0.8]; the assertion below would fail.
    const raw = [[3, 4], [0, 5]];
    const r = await spine.embedTexts(['x', 'y'], { encodeFn: function () { return raw; } });
    assert.strictEqual(r.success, true, 'Test 5: success true');
    assert.deepStrictEqual(r.vectors, [[3, 4], [0, 5]], 'Test 5: no re-normalization of injected vectors');
    ok('Test 5: injected stub vectors pass through unchanged');
  }

  console.log('\n' + passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
