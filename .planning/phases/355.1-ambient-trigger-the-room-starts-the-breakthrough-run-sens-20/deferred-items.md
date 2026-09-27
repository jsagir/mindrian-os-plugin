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

## 2. tests/test-3551-hooked-audit.cjs trips the em-dash leg (plan 355.1-08 file, surfaced during plan 355.1-09)

**Surfaced:** plan 355.1-09, Task 3's own `bash tests/run-all-3551.sh` full
run (the first full-aggregator run since plan 355.1-08 landed
`tests/test-3551-hooked-audit.cjs`, commit `55a10b272`).

**Finding:** `run-all-3551.sh`'s em-dash leg (section 9, `emdash_scan`)
globs every `tests/test-3551-*.cjs` file as "new 355.1 content" and greps
it whole for a literal U+2014. `tests/test-3551-hooked-audit.cjs` lines 90
and 116 contain the literal em-dash character INSIDE a string literal
(`auditText.indexOf('—') === -1`) used to assert the audited
markdown carries none -- the check needs the literal character to compare
against. This is a false positive in the em-dash leg's own whole-file scan
against a test file that legitimately carries the character as a
comparison literal, not as prose. Zero em-dashes exist in any of this
plan's own three files (`tests/test-3551-child.cjs`,
`lib/core/ambient-run.cjs`, `scripts/auto-explore-fire.cjs`, confirmed via
`grep -cP '\x{2014}'` against each, all 0).

**Scope:** out of plan 355.1-09's `<files>` list (`tests/test-3551-child.cjs`,
`lib/core/ambient-run.cjs`, `scripts/auto-explore-fire.cjs`); the file that
trips the leg was authored by plan 355.1-08 and neither read nor modified by
this plan. Per the executor's scope-boundary discipline, logged here rather
than fixed in place.

**Follow-up:** a future plan (or the phase's own close-out) should either
narrow `emdash_scan`'s `NEW_FILES` glob to exclude a legitimate comparison
literal, or have `tests/test-3551-hooked-audit.cjs` construct the character
via `String.fromCharCode(0x2014)` instead of a literal, so the leg's own
intent (catch em-dash PROSE, not a comparison literal) is preserved without
a false positive.
