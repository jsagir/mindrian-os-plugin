/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-01 Plan 01 Task 2 -- mva-budget tests.
 *
 * Per binding decision B2 (HARD):
 *   45-second global wall-clock budget + 35-second per-agent budget.
 *   Per-agent abort signal feeds from the global deadline: each agent gets
 *   min(35s, remaining_global_budget).
 *
 * Pure CJS, node built-ins only. Run via `node --test`.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  createBudget,
  GLOBAL_BUDGET_MS,
  PER_AGENT_CAP_MS
} = require('./mva-budget.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('mva-budget: Test 1 -- remaining decreases over time', async () => {
  const budget = createBudget(45000);
  const r0 = budget.remainingMs();
  assert.ok(r0 >= 44990 && r0 <= 45000, `expected ~45000, got ${r0}`);
  await sleep(100);
  const r1 = budget.remainingMs();
  // Allow generous slop for slow CI / GC pauses.
  assert.ok(r1 >= 44800 && r1 <= 44910, `expected ~44900, got ${r1}`);
});

test('mva-budget: Test 2 -- default globalBudgetMs is 45000', () => {
  const budget = createBudget();
  const r = budget.remainingMs();
  assert.ok(r >= 44990 && r <= 45000, `expected ~45000, got ${r}`);
  assert.strictEqual(budget.globalBudgetMs, 45000);
});

test('mva-budget: Test 3 -- perAgentMs returns 35000 when remaining is 45000', () => {
  const budget = createBudget(45000);
  assert.strictEqual(budget.perAgentMs(35000), 35000);
});

test('mva-budget: Test 4 -- perAgentMs caps at remaining', async () => {
  const budget = createBudget(200);
  await sleep(150);
  const cap = budget.perAgentMs(180);
  // remaining is ~50; perAgentCap 180 -> min(180, 50) = ~50
  assert.ok(cap >= 0 && cap <= 80, `expected ~50, got ${cap}`);
  assert.ok(cap < 180, 'must NOT return 180 when remaining is lower');
});

test('mva-budget: Test 5 -- isExpired flips true after globalBudgetMs', async () => {
  const budget = createBudget(80);
  assert.strictEqual(budget.isExpired(), false);
  await sleep(120);
  assert.strictEqual(budget.isExpired(), true);
  assert.strictEqual(budget.remainingMs(), 0);
});

test('mva-budget: Test 6 -- exported constants', () => {
  assert.strictEqual(GLOBAL_BUDGET_MS, 45000);
  assert.strictEqual(PER_AGENT_CAP_MS, 35000);
});
