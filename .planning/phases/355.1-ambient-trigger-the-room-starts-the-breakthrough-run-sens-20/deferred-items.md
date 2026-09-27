# Phase 355.1 Deferred Items

Out-of-scope or accepted-with-follow-up findings surfaced during 355.1 plan
execution, logged here rather than fixed in place. Each entry names the
plan that surfaced it, the accepting decision, and the concrete follow-up.

## 1. Ambient eureka adapter ranks by raw abs_diff only (plan 355.1-07)

**Surfaced:** plan 355.1-07 (ambient composition), documented in
`355.1-07-SUMMARY.md` tech-stack pattern "the eureka adapter's own ranking
is a deliberate simplification".

**Finding:** `lib/core/ambient-run.cjs`'s eureka adapter scores pairs with
the real `scoreMeasured`, sorted by `abs_diff`, top `AMBIENT_TOP_N`, then
stamped via the real `stampRankedPairs` / `eurekaEndpoints`. It does not run
`scripts/eureka-portfolio-report.cjs`'s full AHP-weighted /
tail-quadrant-ranking portfolio-dimensions pipeline. That file exposes no
isolated "rank only, never bank" export to compose against instead;
replicating its full ~2000-line `main()` pipeline inline was out of plan
355.1-07's reasonable scope.

**Accepted at:** the 355.1 checkpoint, 2026-09-27 (navigator ruling item 11,
`355.1-CHECKPOINT.md` `## Navigator ruling`). Accepted for Phase 355.1 as
filed; not overturned; not blocking plans 355.1-09 through 355.1-14.

**Follow-up:** extract a rank-only export from
`scripts/eureka-portfolio-report.cjs` in the upcoming MCP
intelligence-layer phase, so the ambient composition (and any other
in-process caller) can reuse the full AHP-weighted / tail-quadrant ranking
instead of the raw `abs_diff` simplification.
