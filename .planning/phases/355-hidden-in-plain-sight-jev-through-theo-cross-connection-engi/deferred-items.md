# Phase 355 deferred items (out-of-scope discoveries)

Findings the executor is NOT fixing because they are pre-existing, peer-owned,
or environmental, and were not caused by any 355 task's own changes (Scope
Boundary rule). Logged here rather than silently fixed or silently ignored.

## 355-01 Task 1: three pre-existing `tests/run-all-355.sh` no-regression-leg failures

Found running `bash tests/run-all-355.sh` for the first time (BASE_355 =
`9458bf802`, 2026-09-23). All three sit in leg (8) no-regression tests the
plan's own action text names verbatim; none of the three files below was
touched by 355-01. Not fixed here.

1. **`bash tests/run-all-356.sh` FAILS** - its own internal "356: em-dash
   guard" leg finds an em-dash in
   `.planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-VERIFICATION.md`.
   That file is Phase 356's own artifact (peer jsagi-a7, executing
   concurrently in this tree). Not a 355 file; left untouched per the
   collision rules.

2. **`bash tests/run-all-272.sh` FAILS** - its own internal
   `272-cache-probe.test.cjs` leg asserts `the installed @huggingface/transformers
   dep must expose ModelRegistry.is_pipeline_cached (RESEARCH.md Finding F-11)`
   and gets `null`. This is an installed-dependency-version gap (an
   `@huggingface/transformers` API surface mismatch), not something any 355
   file change could cause or fix. Environmental, pre-existing at BASE_355.

3. **`node lib/core/part8-egress-guard.test.cjs` FAILS** - `PB8-03: generic
   framework question must ALLOW` gets `'ambiguous'` instead of `'allow'`.
   `lib/core/part8-egress-guard.cjs` is one of the six D-57 shared files;
   Task 1's own gate confirmed it carries zero uncommitted diff this session
   or any peer made (`git status --short` empty). The failure therefore
   already existed in the last commit that touched this file, before Phase
   355 started. Fixing Part 8 guard classification logic is out of scope for
   a plan whose only job is the D-57 gate and the direction-convention
   module; flagging it here so a later phase (or the navigator) can decide
   whether to root-cause it.

**Consequence for `tests/run-all-355.sh`:** the aggregator currently reports
`PASS=13 FAIL=3 SKIP=17` (exit 1) because it correctly surfaces these three
pre-existing failures rather than masking them. The script itself is
correct; the tree it is running against currently carries these three
external defects. Re-run once Phase 356 closes its own em-dash guard, the
`@huggingface/transformers` version gap is resolved, and PB8-03 is
root-caused, to confirm the aggregator goes green on those three legs.
