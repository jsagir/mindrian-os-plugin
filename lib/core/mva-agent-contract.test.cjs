/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-01 Plan 01 Task 1 -- mva-agent-contract tests.
 *
 * Tests the AgentResult shape, validateAgentResult, and runAgent wrapper.
 * Per Canon Part 8 (Graph Boundary): AgentContext NEVER carries raw sentence;
 * the only sentence-derived field is sentence_sha256. There is no escape hatch
 * via process.env.MVA_SENTENCE.
 *
 * Pure CJS, node built-ins only. Run via `node --test`.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  runAgent,
  validateAgentResult,
  AGENT_RESULT_SHAPE
} = require('./mva-agent-contract.cjs');

test('mva-agent-contract: Test 1 -- agent returns ok wraps result', async () => {
  const agentDef = {
    id: 'test',
    fn: async (_ctx, _signal) => ({ status: 'ok', payload: { x: 1 } })
  };
  const result = await runAgent(
    agentDef,
    { sentence_sha256: 'abc123' },
    { timeoutMs: 1000 }
  );
  assert.strictEqual(result.agent_id, 'test');
  assert.strictEqual(result.status, 'ok');
  assert.deepStrictEqual(result.payload, { x: 1 });
  assert.strictEqual(typeof result.duration_ms, 'number');
  assert.ok(result.duration_ms >= 0);
});

test('mva-agent-contract: Test 2 -- agent throws becomes error result', async () => {
  const agentDef = {
    id: 'test',
    fn: async (_ctx, _signal) => { throw new Error('boom'); }
  };
  const result = await runAgent(
    agentDef,
    { sentence_sha256: 'abc123' },
    { timeoutMs: 1000 }
  );
  assert.strictEqual(result.agent_id, 'test');
  assert.strictEqual(result.status, 'error');
  assert.strictEqual(result.error, 'boom');
  assert.ok(!('stack' in result), 'result must never carry stack');
  assert.strictEqual(typeof result.duration_ms, 'number');
});

test('mva-agent-contract: Test 3 -- agent returns null becomes empty', async () => {
  const agentDef = {
    id: 'test',
    fn: async (_ctx, _signal) => null
  };
  const result = await runAgent(
    agentDef,
    { sentence_sha256: 'abc123' },
    { timeoutMs: 1000 }
  );
  assert.strictEqual(result.agent_id, 'test');
  assert.strictEqual(result.status, 'empty');
  assert.strictEqual(typeof result.duration_ms, 'number');
});

test('mva-agent-contract: Test 4 -- agent exceeds timeout returns timeout', async () => {
  const agentDef = {
    id: 'test',
    fn: async (_ctx, signal) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 500);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        });
      });
      return { status: 'ok', payload: {} };
    }
  };
  const t0 = Date.now();
  const result = await runAgent(
    agentDef,
    { sentence_sha256: 'abc123' },
    { timeoutMs: 100 }
  );
  const elapsed = Date.now() - t0;
  assert.strictEqual(result.agent_id, 'test');
  assert.strictEqual(result.status, 'timeout');
  assert.ok(elapsed < 300, `elapsed ${elapsed} must be under 300ms`);
  assert.ok(result.duration_ms >= 90, `duration_ms ${result.duration_ms} should be ~100`);
});

test('mva-agent-contract: Test 5 -- agent receives both args, signal observed', async () => {
  let observedSignalAbortedAtStart = null;
  let observedSignalAbortedAtEnd = null;
  let observedSha = null;
  let observedRemaining = null;
  const agentDef = {
    id: 'test',
    fn: async (ctx, signal) => {
      observedSignalAbortedAtStart = signal.aborted;
      observedSha = ctx.sentence_sha256;
      observedRemaining = ctx.remaining_budget_ms;
      // Wait long enough to be cancelled
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 500);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          observedSignalAbortedAtEnd = signal.aborted;
          reject(new Error('aborted'));
        });
      });
      return { status: 'ok', payload: {} };
    }
  };
  const result = await runAgent(
    agentDef,
    { sentence_sha256: 'def456' },
    { timeoutMs: 100 }
  );
  assert.strictEqual(observedSignalAbortedAtStart, false, 'signal must start non-aborted');
  assert.strictEqual(observedSignalAbortedAtEnd, true, 'signal must be aborted on timeout');
  assert.strictEqual(observedSha, 'def456');
  assert.strictEqual(observedRemaining, 100);
  assert.strictEqual(result.status, 'timeout');
});

test('mva-agent-contract: Test 6 -- validateAgentResult', () => {
  assert.strictEqual(
    validateAgentResult({ agent_id: 'x', status: 'ok', duration_ms: 10 }),
    true
  );
  assert.strictEqual(
    validateAgentResult({ agent_id: 'x', status: 'empty', duration_ms: 10 }),
    true
  );
  assert.strictEqual(
    validateAgentResult({ agent_id: 'x', status: 'error', duration_ms: 10, error: 'e' }),
    true
  );
  assert.strictEqual(
    validateAgentResult({ agent_id: 'x', status: 'timeout', duration_ms: 10 }),
    true
  );
  assert.strictEqual(validateAgentResult(null), false);
  assert.strictEqual(validateAgentResult({}), false);
  assert.strictEqual(validateAgentResult({ status: 'ok', duration_ms: 10 }), false);
  assert.strictEqual(validateAgentResult({ agent_id: 'x', duration_ms: 10 }), false);
  assert.strictEqual(
    validateAgentResult({ agent_id: 'x', status: 'invalid', duration_ms: 10 }),
    false
  );
  assert.strictEqual(
    validateAgentResult({ agent_id: 'x', status: 'ok', duration_ms: -1 }),
    false
  );
  assert.strictEqual(
    validateAgentResult({ agent_id: 'x', status: 'ok' }),
    false
  );
  assert.ok(AGENT_RESULT_SHAPE, 'shape doc must be exported');
});
