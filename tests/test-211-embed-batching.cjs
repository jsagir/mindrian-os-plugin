#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-01 -- embedding-spine batching offline tests.
 * quick(260706-4yl) -- the large-N OOM fix: embedTexts now loops enc.encoder
 * over resolveBatchSize()-sized slices instead of one forward pass over the
 * whole list (2117 claim nodes padded to [2128, 512] attempted a ~26.7GB Expand
 * allocation on the real jhtv-oliver-kuntz room). These guards run OFFLINE
 * (Canon Part 8: no Brain, no live model, no network, no model download); the
 * heavy dep @huggingface/transformers is NEVER imported by this suite.
 *
 *   Test 1: batchSlices splits into order-preserving consecutive slices; empty
 *           input returns []; a short list returns one slice.
 *   Test 2: resolveBatchSize defaults to 32 (=== DEFAULT_BATCH) unset, honors a
 *           valid positive int, and falls back to 32 on '0'/'-5'/'abc'/''.
 *   Test 3: the encodeFn injection seam stays UNBATCHED -- even with
 *           MINDRIAN_EMBED_BATCH=4 set, 70 texts reach the stub in ONE call.
 */
'use strict';

const assert = require('node:assert');

const spine = require('../lib/core/eureka/embedding-spine.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

async function run() {
  // ---------- Test 1: batchSlices is order-preserving and bounded ----------
  {
    const src = Array.from({ length: 70 }, function fill(_v, i) { return i; });
    const slices = spine._test.batchSlices(src, 32);
    assert.deepStrictEqual(
      slices.map(function len(s) { return s.length; }),
      [32, 32, 6],
      'Test 1: slice lengths [32, 32, 6]'
    );
    const flat = [].concat.apply([], slices);
    assert.deepStrictEqual(flat, src, 'Test 1: flattening preserves order');

    assert.deepStrictEqual(spine._test.batchSlices([], 32), [], 'Test 1: empty input -> []');

    const short = spine._test.batchSlices([0, 1, 2, 3, 4], 32);
    assert.strictEqual(short.length, 1, 'Test 1: short list -> one slice');
    assert.strictEqual(short[0].length, 5, 'Test 1: short slice keeps all 5');
    ok('Test 1: batchSlices order-preserving, bounded, empty + short edge cases');
  }

  // ---------- Test 2: resolveBatchSize env fallback ----------
  {
    const savedBatch = process.env.MINDRIAN_EMBED_BATCH;
    try {
      delete process.env.MINDRIAN_EMBED_BATCH;
      assert.strictEqual(spine._test.resolveBatchSize(), 32, 'Test 2: default is 32');
      assert.strictEqual(
        spine._test.resolveBatchSize(),
        spine._test.DEFAULT_BATCH,
        'Test 2: default === DEFAULT_BATCH'
      );

      process.env.MINDRIAN_EMBED_BATCH = '8';
      assert.strictEqual(spine._test.resolveBatchSize(), 8, 'Test 2: valid int resolves to 8');

      ['0', '-5', 'abc', ''].forEach(function each(bad) {
        process.env.MINDRIAN_EMBED_BATCH = bad;
        assert.strictEqual(
          spine._test.resolveBatchSize(),
          32,
          'Test 2: invalid value ' + JSON.stringify(bad) + ' falls back to 32'
        );
      });
    } finally {
      if (savedBatch === undefined) delete process.env.MINDRIAN_EMBED_BATCH;
      else process.env.MINDRIAN_EMBED_BATCH = savedBatch;
    }
    ok('Test 2: resolveBatchSize defaults to 32, honors valid int, rejects invalid');
  }

  // ---------- Test 3: encodeFn seam is UNBATCHED ----------
  {
    const savedBatch = process.env.MINDRIAN_EMBED_BATCH;
    try {
      // A small batch size proves batching does NOT leak into the stub path.
      process.env.MINDRIAN_EMBED_BATCH = '4';
      let calls = 0;
      let receivedLength = -1;
      function stubEncode(texts) {
        calls += 1;
        receivedLength = texts.length;
        return texts.map(function vec() { return [1, 2, 3]; });
      }
      const inputs = Array.from({ length: 70 }, function fill(_v, i) { return 'text-' + i; });
      const r = await spine.embedTexts(inputs, { encodeFn: stubEncode });
      assert.strictEqual(calls, 1, 'Test 3: stub received exactly one call (unbatched)');
      assert.strictEqual(receivedLength, 70, 'Test 3: stub received the full 70-text list');
      assert.strictEqual(r.success, true, 'Test 3: success true');
      assert.strictEqual(r.vectors.length, 70, 'Test 3: 70 vectors returned');
      assert.strictEqual(r.provenance.model, 'stub', 'Test 3: provenance.model is stub');
    } finally {
      if (savedBatch === undefined) delete process.env.MINDRIAN_EMBED_BATCH;
      else process.env.MINDRIAN_EMBED_BATCH = savedBatch;
    }
    ok('Test 3: encodeFn seam stays unbatched (one call for 70 texts, batch=4 set)');
  }

  console.log('\n' + passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
