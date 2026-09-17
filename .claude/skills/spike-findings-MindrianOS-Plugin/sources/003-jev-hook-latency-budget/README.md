---
spike: 003
name: jev-hook-latency-budget
type: standard
validates: "Given the 2000 ms per-turn hook budgets in hooks.json, when Jev is called cold (fresh process), warm (sequential), and in a 20-wide burst, then cold start, p50/p95, 429/529 behavior and the share of calls over budget are known"
verdict: VALIDATED
related: [001, 002]
tags: [typesafe, jev, latency, hooks, budget]
---

# Spike 003: jev-hook-latency-budget

## What This Validates

Given the hook budgets in `hooks/hooks.json` (UserPromptSubmit 2000 ms, PreToolUse egress
guard 2000 ms, Stop 3000 ms), when a minimal Jev choice call runs (a) in five fresh node
processes, (b) 20 times sequentially on one process, (c) 20 times concurrently, then the
cold-start cost, the warm distribution, rate-limit behavior and the over-budget share are
measured, plus one race of a call against the budget as the async best-effort wrapper
shape.

## Research

No new external reading: the contract and backoff codes come from Spike 001 (docs list
429/529 for backoff; the live service returned 400 not 422 on validation). Hook budgets
read from `hooks/hooks.json` on 2026-09-17.

## How to Run

```bash
node budget.cjs
```

## What to Expect

Five cold runs near 750-800 ms; warm p50 near 300 ms with an occasional 1 s tail; a
burst of 20 returning all 200; zero calls over 2000 ms; the race won by Jev.

## Observability

`results.json`: per-run cold results, warm and burst stats (min/p50/p95/max), status
counts, the budget tally, and the race outcome.

## Investigation Trail

1. Cold start, fresh process each: 741 / 784 / 800 ms (min / p50 / max), all 200. A hook
   is a fresh process, so this is the floor a hook would pay every time.
2. Warm sequential x20: min 260, p50 303, p95 1241, max 1241 ms. One call in twenty hit
   a 1.2 s tail; the rest sat under 400 ms.
3. Burst x20 concurrent: all 200, no 429 or 529; wall 1375 ms; per-call p50 757 ms,
   max 1373 ms -- queueing, not throttling, at this width.
4. Budget: 45 successful calls, 0 over 2000 ms, 2 over 1000 ms.
5. Race against a 2000 ms budget: Jev at 278 ms.

## Results

**Verdict: VALIDATED** as a measurement. On latency alone a Jev call fits inside a 2000
ms hook with margin (cold ~800 ms, i.e. about 40 percent of the budget; 0 of 45 over).
The MANIFEST rule that Jev never runs in a hook on a user machine stands for the
dependency reason (a second vendor in every user's turn loop), not for latency. For the
Theo-side and dev-side batch paths, the numbers are comfortable: Spike 002 scored 410
frameworks per scenario in 2.2-3.7 s at concurrency 4 with zero failures.

Surprise: no rate limiting at 20 concurrent; the docs' 429/529 backoff never triggered
in any spike (384 + 45 + 128 calls). Tail latency is the only variable: p95 ranged
713-1241 ms across spikes while p50 stayed at 285-320 ms.
