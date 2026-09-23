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

## 355-09 Task 2: four pre-existing `lib/memory/test-rs-*.cjs` failures, unrelated to this plan's files

Task 2's own verify step runs every `lib/memory/test-rs-*.cjs` file. Four of
them fail; none requires (directly or transitively) any file this plan
touched (`lib/core/rs-innovation-classifier.cjs`,
`lib/core/rs-thesis-generator.cjs`, `scripts/rs-discovery-engine.cjs`,
`lib/memory/test-rs-innovation-classifier.cjs`) -- confirmed by grepping
each failing test's `require(` lines. `lib/memory/test-rs-discovery-engine.cjs`
(the one test that DOES require `scripts/rs-discovery-engine.cjs` directly)
passes cleanly (9/9), as does `lib/memory/test-rs-thesis-generator.cjs`. Not
fixed here (Scope Boundary rule); re-run stable on a second pass (not
concurrency flake).

1. **`lib/memory/test-rs-chain-feeder-core.cjs` FAILS (2/10)** - T2 expects
   `{state: pause}` on "Brain reachable + missing upstream", gets `ready`;
   T8 expects `brainClient.query` called >=1 time, gets 0. Both look like a
   Brain-client call-shape drift in `lib/core/rs-chain-feeder.cjs`'s
   `lookupUpstream`, unrelated to direction/classification.
2. **`lib/memory/test-rs-fetcher-industry.cjs` FAILS (6 of ~17)** - Tests
   1/2/4/5/6/7 all throw `ExternalEgressViolation: forbidden pattern in
   query string for surface industry` from `buildIndustryQuery`
   (`lib/core/rs-fetcher-industry.cjs:128`), a Canon Part 8 audit rejecting
   the test's own fixture query text. Unrelated to this plan.
3. **`lib/memory/test-rs-nl-to-query.cjs` FAILS (2/16)** - T1
   (`feeds_into_query` intent must produce non-null `brain_query`) and T4
   (`methodology_chain` must emit a Brain template) both get `null`. Looks
   like `lib/core/rs-nl-to-query.cjs`'s allow-list intent handling changed
   underneath this test. Unrelated to this plan.
4. **`lib/memory/test-rs-sqlite-mirror.cjs` FAILS (3/12)** - Test 1 asserts
   `room.db must have 3 nodes after happy path`, gets 4 (an extra node is
   being written by `lib/core/rs-sqlite-mirror.cjs::writeDiscovery` on a
   freshly created, randomly-named tmp room -- not a shared-tree
   concurrency artifact, confirmed stable across two consecutive runs);
   Tests 2 and 3 cascade-fail because they depend on Test 1's `SHARED_ROOM`.
   Unrelated to this plan (no file this plan touched is in
   `writeDiscovery`'s call path).

None of the four is caused by, or fixable within, this plan's stated scope
(D-03/D-04, four flipped producers + two amended consumers + two amended
tests). Flagged here for the navigator/a future phase to root-cause.
