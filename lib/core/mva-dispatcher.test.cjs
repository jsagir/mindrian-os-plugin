/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-01 Plan 01 Task 3 -- mva-dispatcher tests.
 *
 * Verifies parallel fan-out with streaming-as-settled order, per-agent
 * timeouts, global timeout, all-fail handling, dispatchToArray collector,
 * and the Canon Part 8 invariant that the AgentContext contains ONLY
 * sentence_sha256 (no raw_sentence, no MVA_SENTENCE env var).
 *
 * Pure CJS, node built-ins only. Run via `node --test`.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { dispatch, dispatchToArray } = require('./mva-dispatcher.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkAgent(id, fn) {
  return { id, fn };
}

test('mva-dispatcher: Test 1 -- 6 fast agents fan out in parallel', async () => {
  const agents = Array.from({ length: 6 }, (_, i) =>
    mkAgent(`agent_${i}`, async () => ({ status: 'ok', payload: { i } }))
  );
  const t0 = Date.now();
  const results = await dispatchToArray(agents, 'sha_abc');
  const elapsed = Date.now() - t0;
  assert.strictEqual(results.length, 6);
  for (const r of results) {
    assert.strictEqual(r.status, 'ok');
  }
  assert.ok(elapsed < 300, `wall-clock ${elapsed}ms should be < 300ms (fast fan-out)`);
});

test('mva-dispatcher: Test 2 -- 6 slow agents all timeout independently', async () => {
  const agents = Array.from({ length: 6 }, (_, i) =>
    mkAgent(`agent_${i}`, async (_ctx, signal) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 1000);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        });
      });
      return { status: 'ok', payload: {} };
    })
  );
  const t0 = Date.now();
  const results = await dispatchToArray(agents, 'sha_abc', {
    globalBudgetMs: 5000,
    perAgentCapMs: 50
  });
  const elapsed = Date.now() - t0;
  assert.strictEqual(results.length, 6);
  for (const r of results) {
    assert.strictEqual(r.status, 'timeout', `agent ${r.agent_id} should be timeout`);
  }
  assert.ok(elapsed < 400, `wall-clock ${elapsed}ms should be < 400ms (parallel timeouts)`);
});

test('mva-dispatcher: Test 3 -- mixed fast/slow stream in arrival order', async () => {
  const agents = [
    mkAgent('fast_1', async () => { await sleep(10); return { status: 'ok', payload: 'f1' }; }),
    mkAgent('slow_1', async (_c, s) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 1000);
        s.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
      });
      return { status: 'ok', payload: 's1' };
    }),
    mkAgent('fast_2', async () => { await sleep(10); return { status: 'ok', payload: 'f2' }; }),
    mkAgent('slow_2', async (_c, s) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 1000);
        s.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
      });
      return { status: 'ok', payload: 's2' };
    }),
    mkAgent('fast_3', async () => { await sleep(10); return { status: 'ok', payload: 'f3' }; }),
    mkAgent('slow_3', async (_c, s) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 1000);
        s.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
      });
      return { status: 'ok', payload: 's3' };
    })
  ];
  const t0 = Date.now();
  const order = [];
  const stamps = [];
  for await (const r of dispatch(agents, 'sha_abc', {
    globalBudgetMs: 5000,
    perAgentCapMs: 100
  })) {
    order.push({ id: r.agent_id, status: r.status });
    stamps.push(Date.now() - t0);
  }
  assert.strictEqual(order.length, 6);
  // First 3 yielded are fast (status=ok); next 3 are slow (status=timeout).
  const fastOnes = order.slice(0, 3);
  const slowOnes = order.slice(3);
  for (const r of fastOnes) {
    assert.strictEqual(r.status, 'ok', `expected fast ok, got ${JSON.stringify(r)}`);
    assert.ok(['fast_1', 'fast_2', 'fast_3'].includes(r.id));
  }
  for (const r of slowOnes) {
    assert.strictEqual(r.status, 'timeout');
    assert.ok(['slow_1', 'slow_2', 'slow_3'].includes(r.id));
  }
  // Last fast yields well before first slow yields.
  assert.ok(stamps[2] < 80, `fast results should yield by ~50ms; got ${stamps[2]}`);
  assert.ok(stamps[3] >= 90, `first slow result should yield around ~100ms; got ${stamps[3]}`);
});

test('mva-dispatcher: Test 4 -- global budget short truncates remaining agents', async () => {
  const agents = Array.from({ length: 6 }, (_, i) =>
    mkAgent(`agent_${i}`, async (_c, s) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 1000);
        s.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
      });
      return { status: 'ok', payload: {} };
    })
  );
  const t0 = Date.now();
  const results = await dispatchToArray(agents, 'sha_abc', {
    globalBudgetMs: 100,
    perAgentCapMs: 35000
  });
  const elapsed = Date.now() - t0;
  assert.strictEqual(results.length, 6);
  for (const r of results) {
    assert.strictEqual(r.status, 'timeout');
  }
  assert.ok(elapsed < 250, `global budget should clamp wall-clock; got ${elapsed}ms`);
});

test('mva-dispatcher: Test 5 -- dispatchToArray equivalent to for-await', async () => {
  const agents = Array.from({ length: 3 }, (_, i) =>
    mkAgent(`agent_${i}`, async () => ({ status: 'ok', payload: { i } }))
  );
  const a = await dispatchToArray(agents, 'sha_abc');
  const b = [];
  for await (const r of dispatch(agents, 'sha_abc')) b.push(r);
  assert.strictEqual(a.length, b.length);
  // Order may differ since both run in parallel; compare by id set.
  const idsA = new Set(a.map((r) => r.agent_id));
  const idsB = new Set(b.map((r) => r.agent_id));
  assert.deepStrictEqual([...idsA].sort(), [...idsB].sort());
});

test('mva-dispatcher: Test 6 -- AgentContext carries sentence_sha256 ONLY', async () => {
  // Pre-condition: env var must be unset before dispatch.
  delete process.env.MVA_SENTENCE;
  assert.strictEqual(process.env.MVA_SENTENCE, undefined);

  let observedCtx = null;
  let envAtCall = null;
  const agentDef = mkAgent('inspector', async (ctx, _signal) => {
    observedCtx = ctx;
    envAtCall = process.env.MVA_SENTENCE;
    return { status: 'ok', payload: { sha: ctx.sentence_sha256 } };
  });
  const results = await dispatchToArray([agentDef], 'sha_xyz_789');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].status, 'ok');
  assert.strictEqual(results[0].payload.sha, 'sha_xyz_789');

  // Forbidden keys: must NOT be present.
  assert.ok(observedCtx, 'agent must have observed ctx');
  assert.strictEqual(observedCtx.sentence_sha256, 'sha_xyz_789');
  assert.strictEqual(observedCtx.sentence, undefined);
  assert.strictEqual(observedCtx.prompt, undefined);
  assert.strictEqual(observedCtx.raw_sentence, undefined);
  assert.strictEqual(observedCtx.raw_text, undefined);

  // Env escape hatch must NOT exist during dispatch.
  assert.strictEqual(envAtCall, undefined);

  // Post-condition: env still clean.
  assert.strictEqual(process.env.MVA_SENTENCE, undefined);
});

test('mva-dispatcher: Test 7 -- all-fail returns N error/timeout results (B7 fallback path)', async () => {
  const agents = Array.from({ length: 6 }, (_, i) =>
    mkAgent(`agent_${i}`, async () => { throw new Error('forced fail'); })
  );
  const results = await dispatchToArray(agents, 'sha_abc');
  assert.strictEqual(results.length, 6);
  for (const r of results) {
    assert.strictEqual(r.status, 'error');
    assert.strictEqual(r.error, 'forced fail');
  }
  // The dispatcher MUST NOT throw on all-fail. Plan 118-03 renderer reads
  // the results array and decides the sharp-question fallback when every
  // status is non-ok.
});

test('mva-dispatcher: Test 8 -- per-agent throw does not crash sibling agents', async () => {
  const agents = [
    mkAgent('thrower', async () => { throw new Error('boom'); }),
    mkAgent('happy_1', async () => ({ status: 'ok', payload: 'h1' })),
    mkAgent('happy_2', async () => ({ status: 'ok', payload: 'h2' }))
  ];
  const results = await dispatchToArray(agents, 'sha_abc');
  assert.strictEqual(results.length, 3);
  const byId = Object.fromEntries(results.map((r) => [r.agent_id, r]));
  assert.strictEqual(byId.thrower.status, 'error');
  assert.strictEqual(byId.happy_1.status, 'ok');
  assert.strictEqual(byId.happy_2.status, 'ok');
});
