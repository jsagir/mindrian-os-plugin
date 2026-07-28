# Phase 237 - Deferred Items (out of scope for the executing plan)

## 1. Pre-existing FAIL in `tests/test-act-on-runchain.cjs` (found during 237-01)

**Found during:** Plan 237-01, Task 1 (wiring the three regression legs into `tests/run-all-237.sh`).

**Observation:** `node tests/test-act-on-runchain.cjs` fails on a clean tree with zero Phase 237
changes applied (reproduced against a stashed working tree at commit `045bf132`, before this
plan touched anything). The assertion at line 122-124 compares the rendered gated-halt card
against a hardcoded baseline string; the baseline predates the `FIRE-IF-FORK` block that
`lib/hmi/selector-dispatcher.cjs` (SEED-021, Phase 210 era) now injects into every rendered
gate card. The actual render is correct and current; the test's expected baseline is stale.

**Scope decision:** `lib/hmi/selector-dispatcher.cjs` and `tests/test-act-on-runchain.cjs` are
NOT in 237-01-PLAN.md's `files_modified` list (`tests/run-all-237.sh`,
`tests/test-198-local-only.test.cjs` only) and are unrelated to REACH-01/02/03. Per the
executor SCOPE BOUNDARY rule, this is a pre-existing, out-of-scope failure and is NOT
auto-fixed here.

**Effect on 237-01:** `tests/run-all-237.sh` wires this file as a plain `run` regression leg
per 237-01-PLAN.md Task 1 (the file already exists today, so `run_if` would be dishonest). The
leg genuinely FAILS, so the aggregator's observed Wave-0 output is `Passed: 2 Failed: 1
Skipped: 9` (Task 1) / `Passed: 5 Failed: 1 Skipped: 9` (Task 2), not the `Failed: 0` the plan
assumed. This is documented as a deviation in `237-01-SUMMARY.md` rather than silently patched:
the aggregator reporting a real, previously-invisible failure honestly is the entire point of
this phase (per 237-01-PLAN.md's own objective: "the whole v1.16.0 milestone exists because
gates that could not fail were reading green").

**Recommended follow-up:** a future plan (or a `/gsd-quick` fix) should update
`tests/test-act-on-runchain.cjs`'s expected baseline string to include the current
`FIRE-IF-FORK` block, or make the assertion tolerant of that block, so the regression leg
returns to a real PASS. Not claimed as fixed here.
