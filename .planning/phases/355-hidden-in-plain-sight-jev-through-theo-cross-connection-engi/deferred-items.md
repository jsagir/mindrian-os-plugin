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

## 355-10 Task 2: `tests/test-218-cohort-stratification.cjs` pre-existing failure, unrelated to the D-47 flip

While cross-checking for regressions beyond Task 2's own required verify
list, `node tests/test-218-cohort-stratification.cjs` fails with
`test-218-cohort-stratification FAILED: insertNode: invalid epistemic_type
"undefined"`. Confirmed PRE-EXISTING and unrelated to the D-47 flip: with
`lib/core/rs-differential-scorer.cjs` and
`lib/core/eureka/portfolio-dimensions.cjs` temporarily restored to their
pre-Task-2 (`HEAD`) content, the SAME failure reproduces identically before
any 355-10 edit lands. The test file itself contains zero references to
`direction`, `structural_transfer`, `semantic_implementation`, or
`epistemic_type`; the failure originates in a navigation/insertNode call
this plan's files_modified list does not touch. Not fixed here (Scope
Boundary rule). Flagged for the navigator/a future phase to root-cause.

## 355-11 Task 1: leg H's last two unresolved hits are outside this plan's `files_modified` scope

`tests/test-355-direction-agreement.cjs` leg H (the "one rule" repo sweep)
still fails after this plan, with exactly two unresolved hits:
`lib/core/rs-chain-feeder.cjs` and `lib/memory/test-rs-discovery-engine.cjs`.
Neither file is in 355-11's `files_modified` list (`lib/core/intelligence-cascade.cjs`,
`scripts/scout-cadence-runner.cjs`, `tests/test-scout-cadence-fires.cjs`,
`commands/scout.md`, `skills/scout/SKILL.md`, `scripts/detect-reverse-salients.py`,
`scripts/compute-hsi.py`), and this plan's own `must_haves` and success
criteria name only leg G ("RED-to-GREEN: leg G ... passes"), never leg H --
confirmed by re-reading 355-11-PLAN.md's frontmatter and objective before
treating this as in scope. **Correcting a forward-looking claim from
355-10-SUMMARY.md's "Next Phase Readiness"**, which said leg H's remaining
duplication "remain[s] for 355-11" to close: that is not this plan's stated
scope, so leg H is carried forward, not fixed here (Scope Boundary rule /
Rule 4 territory -- editing `rs-chain-feeder.cjs`'s own rule duplication is
an architectural change to a file outside this plan's declared surface).
Flagged for 355-12 (whose own stated scope is exactly "stored-label readers
re-derive direction through the module") or a later plan to close.

## 355-11 Task 1: five unfiltered `REVERSE_SALIENT` edge readers found (for 355-12)

Per the plan's must_haves ("the SUMMARY records every unfiltered
REVERSE_SALIENT reader found (assumption A2) for plan 355-12"), a full
`grep -rn "REVERSE_SALIENT" lib scripts --include=*.cjs` sweep plus a
per-hit read found five call sites that query `edges WHERE type =
'REVERSE_SALIENT'` (or scan already-loaded edges by `type` alone) with NO
filter on `properties.source === 'rs-engine'`. Not fixed here -- reading and
filtering these is 355-12's stated job, not 355-11's. Listed for that
plan's own read_first:

1. `lib/core/nl-graph-queries.cjs:77` (the `reverse_salients` NL query
   builder) -- selects `differential_score` / `innovation_type` /
   `innovation_thesis`, property names that only ever existed on the
   Section-level, Python/`hsi-to-graph.cjs`-sourced edge shape (never on an
   rs-engine-sourced, Artifact-level edge). No source filter in SQL.
2. `lib/chat/fabric-chat.cjs:49` (the "Which sections have bottlenecks?"
   canned fabric-chat query) -- same unfiltered `WHERE e.type =
   'REVERSE_SALIENT'`, same Section-level property names.
3. `lib/core/futures/orchestrator.cjs:1166` (`runRSReverseSalient`'s
   post-invocation `SELECT COUNT(*) ... WHERE type = 'REVERSE_SALIENT'`) --
   the comment above it says this counts "the REVERSE_SALIENT edges the
   rs-engine raw path wrote", but the query counts ALL edges of that type
   regardless of source; if a room already carries Python/hsi-to-graph-
   sourced edges, this count is inflated relative to what the doc comment
   claims it measures.
4. `scripts/generate-snapshot.cjs:277` (`bottleneckCount` tally in the
   `.snapshots` state generator) -- counts every edge of type
   `REVERSE_SALIENT` toward the user-facing bottleneck count, no source
   split.
5. `scripts/extract-room-intelligence.cjs:263` (the Top-5-signals
   `signalPriority` extraction in `ROOM-INTELLIGENCE.md` generation) --
   groups edges by `type` only; a `REVERSE_SALIENT`-typed edge from either
   source surfaces identically as a top signal.

**Confirmed NOT an issue** (checked and ruled out, not listed above):
`lib/core/leverage-scan.cjs:126`'s `SELECT ... WHERE type = 'REVERSE_SALIENT'`
looks unfiltered in SQL but is filtered immediately after, in JS
(`if (props.source !== 'rs-engine') continue;`) -- already correctly scoped.

**A sixth, adjacent finding (a WRITER, not a reader, so distinct from the
must-have's reader inventory, but flagged for the same 355-12 read since it
bears on the "rs-engine-sourced edges are unaffected" claim):**
`scripts/hsi-to-graph.cjs`'s own cleanup (`DELETE FROM edges WHERE type =
'REVERSE_SALIENT'`, unconditional, no source filter) runs on every
hsi-to-graph pass and would delete rs-engine-sourced (Artifact-level) edges
too, not only the Section-level Python-origin edges it rewrites from
`.hsi-results.json`. This plan's own must_haves state rs-engine-sourced
edges are "unaffected" by an hsi-to-graph run; that assumption does not
hold against the literal DELETE scope in `hsi-to-graph.cjs` today. Pre-
existing behavior (this plan did not introduce or touch it -- `hsi-to-
graph.cjs` is not in 355-11's `files_modified`), not fixed here.

## 355-12 Task 1/2: leg H's last two unresolved hits remain out of this
## plan's `files_modified` scope; the REVERSE_SALIENT DELETE finding above
## is carried forward unresolved (plan text says "change nothing else")

`tests/test-355-direction-agreement.cjs` leg H still fails after this plan,
with the SAME two unresolved hits 355-11 left: `lib/core/rs-chain-feeder.cjs`
(`score >= 7 && rs === 'structural_transfer'`, a downstream ROUTING gate that
consumes an already-computed classification, not the comparison-to-label
rule itself, but it trips leg H's comparison-adjacent-to-literal pattern) and
`lib/memory/test-rs-discovery-engine.cjs` (a pinned test fixture's
`rsType === 'structural_transfer'` / `'semantic_implementation'` branches in
its own `feeds_into` mapping, mirroring `rs-chain-feeder.cjs`'s logic for
test coverage). Neither file is in 355-12's `files_modified`
(`tests/test-355-direction-readers.cjs`, `lib/core/eureka-critic.cjs`,
`lib/core/eureka/eureka-offer.cjs`, `lib/core/grill-engine.cjs`,
`lib/mcp/tool-router.cjs`, `scripts/hsi-to-graph.cjs`,
`lib/core/nl-graph-queries.cjs`, `lib/chat/fabric-chat.cjs`,
`scripts/generate-chat-embed.cjs`); 355-12-PLAN.md's own must_haves name only
"Leg H of tests/test-355-direction-agreement.cjs gains no new hits" (a
no-new-regression bar), never full leg H closure. Confirmed via
`node tests/test-355-direction-agreement.cjs 2>&1 | grep -E "^FAIL: H "` --
still exactly the same two files, zero new ones (187 PASS / 1 FAIL after
this plan; the single FAIL is leg H, unchanged in count from the pre-plan
baseline). Not fixed here (Scope Boundary rule) -- editing either file's own
`feeds_into` rule is a real code change to a file this plan was never asked
to touch. `scripts/hsi-to-graph.cjs`'s unconditional REVERSE_SALIENT DELETE
(the sixth finding immediately above) is likewise still open: Task 2's own
action text says "change nothing else" about `hsi-to-graph.cjs` beyond the
HSI_CONNECTION `surprise_type` write, so the DELETE's missing source filter
was left exactly as 355-11 found it, not touched here. Flagged for a later
355 plan (or the navigator) to close both.

## 355-18: three more pre-existing `insertNode: invalid epistemic_type
## "undefined"` failures found (same class 355-10 already logged)

Running the full `tests/test-215-*.cjs`/`tests/test-219-*.cjs`/`tests/test-226-*.cjs`
regression sweep after this plan's own changes found three MORE failures in
the same pre-existing class 355-10-SUMMARY.md already logged for
`tests/test-218-cohort-stratification.cjs`:

1. `tests/test-219-banking.cjs` -- `insertNode: invalid epistemic_type
   "undefined"` at its own line 415.
2. `tests/test-219-low-confidence-disclosure.cjs` -- same error.
3. `tests/test-219-metadata.cjs` -- same error.

Confirmed unrelated to this plan: `git status --short` on all three test
files, `lib/core/node-insert.cjs`, and `tests/helpers/fixture-room-219.cjs`
(the shared fixture builder none of the three's own failing line touches
directly) shows zero diff -- every one of them is byte-identical to the
last commit that touched it, which predates this session. None requires
(directly or transitively) `scripts/eureka-portfolio-report.cjs`,
`lib/core/eureka/report-html.cjs`, or `lib/core/eureka/qualify-opportunity.cjs`
(grep-confirmed). Not fixed here (Scope Boundary rule); flagged for the
navigator/a future phase to root-cause the `epistemic_type` contract these
tests' shared fixture-room builder violates.

## 355-19: `tests/test-237-session-scope.cjs` Leg 4 (MUTATION) pre-existing
## failure, unrelated to the eureka side-channel v2 bump

Running the regression sweep for files that `require` either
`lib/core/eureka/eureka-reach-runner.cjs` or `lib/core/sensors/sensor-eureka.cjs`
found `node tests/test-237-session-scope.cjs` fails Leg 4 (MUTATION) with
`Cannot find module './sensors/sensor-content-relevance.cjs'` inside its own
tmp-dir mutated copy of `lib/core/insight-sensors.cjs` (Legs 1-3 pass).

Confirmed pre-existing and unrelated to this plan: the test's own
`loadMutatedInsightSensors` helper copies `lib/core/insight-sensors.cjs` to
a tmp dir and rewrites ONLY the relative `require('./sensors/...')` calls
named in its hardcoded `SENSOR_REQUIRE_FILES` list (16 entries) to absolute
repo paths, then `require()`s the tmp copy. `sensor-eureka.cjs` IS in that
list (confirming this plan's own file is not the gap). `insight-sensors.cjs`
requires 20 sensor files today, including `sensor-content-relevance.cjs`
(landed in Phase 244-05, commit `dc34fc886`, AFTER `tests/test-237-session-scope.cjs`
was authored in Phase 237-04, commit `37b2aa662`) plus three more
(`sensor-perspective-lock.cjs`, `sensor-roadmap-type.cjs`,
`sensor-graph-integrity.cjs`, `sensor-strategy-reach.cjs`) -- none of these
four post-237 sensors were ever added to `SENSOR_REQUIRE_FILES`, so their
relative requires stay unpinned in the tmp copy and fail to resolve from
outside the repo tree. `git status --short` on `tests/test-237-session-scope.cjs`
and `lib/core/insight-sensors.cjs` shows zero diff from this plan. Not fixed
here (Scope Boundary rule -- `tests/test-237-session-scope.cjs` is not in
355-19's `files_modified`); flagged for the navigator/a future phase to add
the four missing entries to `SENSOR_REQUIRE_FILES`.
