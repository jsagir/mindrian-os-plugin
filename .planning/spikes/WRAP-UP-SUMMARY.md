# Spike Wrap-Up Summary

**Date:** 2026-09-17
**Spikes processed:** 4
**Feature areas:** Jev typed decisions API; Section framework ledger; Policy execution parity
**Skill output:** `./.claude/skills/spike-findings-MindrianOS-Plugin/`

## Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | jev-liveness-cost | standard | VALIDATED | Jev typed decisions API |
| 002 | jev-section-framework-ranker | standard | PARTIAL | Section framework ledger |
| 003 | jev-hook-latency-budget | standard | VALIDATED | Jev typed decisions API |
| 004 | jev-eureka-critic-parity | standard | VALIDATED | Policy execution parity |

## Key Findings

- Jev answers typed methodology questions over generic handles at p50 ~300 ms warm,
  ~800 ms cold, with stable probabilities (drift 0.01) and decisive abstention (0.95 on
  `no-match` for a no-fit state). Validation errors are 400, not the documented 422. No
  rate limiting observed, including a 20-wide burst.
- As a section framework ranker over Theo's 410 canonical frameworks, Jev beats graph
  degree by a wide margin (Spearman 0.59 / 0.63 / 0.82 / 0.19 vs 0.06-0.13) and
  surfaces frameworks the 27-name index cannot offer (9-10 of every top 12). It is weak
  exactly where Theo's descriptions are stubs: 305 of 410 nodes.
- On latency alone a Jev call fits inside a 2000 ms hook (0 of 45 over); the no-hook rule
  stands for the dependency reason.
- Jev executes a stated closed-enum policy with code-like reliability (64/64, confidence
  0.90) and cannot infer an unstated priority order (40/64).
- Theo's read contract has three traps a ledger builder must design around: ROW_CAP
  returns zero rows with a message claiming 100; SKIP and range seeks are rejected;
  function-wrapped parameterized predicates pass.
- Rulings recorded: users never carry a Jev key; finite spaces ship as data; per-user
  payloads route via Theo; only name + JTBD statement + glossary line cross to the vendor.
