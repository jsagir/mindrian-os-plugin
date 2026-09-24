# Phase 267 Deferred Items

Out-of-scope, pre-existing findings discovered while executing Phase 267
plans. Logged here per the executor's scope-boundary rule (only auto-fix
issues directly caused by the current task's own changes); nothing on this
list was fixed by the plan that found it.

## 267-01: two NEW pre-existing test failures under the Part 8 egress boundary

Found while capturing the Wave 0 baseline (267-BASELINE.md step 5). Neither
is named in 267-RESEARCH.md's known-pre-existing list (which only names
`test-257-strict-input-shapes.cjs` Arms B and F, plus `test-198-contract-schema.test.cjs`).
Both reproduced twice, consecutively, with no flakiness observed. Both sit
under `lib/core/part8-egress-guard.cjs`'s test coverage -- a file this
phase's own context (267-CONTEXT.md "Never edit" list) forbids touching, so
267-01 could not have caused either regardless of scope, and did not
introduce them (this plan changed zero production files before the baseline
was captured).

1. **`tests/test-257-brain-tool-egress-invariant.cjs` Arm 2** ("zero egress
   on a canary, per canary-carrying tool") fails. Exit 1, 1 failure.
   Reproduced 2x. Root cause not investigated (out of scope for 267-01).
2. **`tests/test-257-shim-honest-refusal.cjs` Arm 4** ("G3 on the wire --
   ambiguous proceeds and egress_disclosure reaches the model") fails: the
   rendered `DirectiveEnvelope` for the ambiguous-disclosure canary
   (`banana pancake recipe probe`) is missing its own `egress_disclosure`
   key. Exit 1, 1 failure. Reproduced 2x.

Classification: **NEW FAILURE**, not ENV GAP (both reproduce deterministically
on an otherwise-idle-for-this-file tree) and not WORKING. Per `CLAUDE.md`'s
QA/RCA standard, a NEW FAILURE should get its own `.planning/debug/<slug>.md`
per `docs/RCA-TEMPLATE.md` when a session has budget to investigate root
cause -- not attempted here, since it sits outside Phase 267's locked scope
(Canon Part 8 egress-guard internals) and this plan's own objective (test
scaffolding and measurement only, zero production edits). Recorded here so a
later Phase 267 plan (or a dedicated debug session) does not have to
rediscover it, and so no later Phase 267 plan mistakes it for a migration
-caused regression when it re-runs `test-257-*` suites.

**Do not fix as part of any Phase 267 plan** unless a plan explicitly says
so; a fix here belongs to `lib/core/part8-egress-guard.cjs`'s own owning
surface, which is out of scope for this phase per 267-CONTEXT.md.

## 267-06: pre-existing `safeResolveSection` occurrence-count mismatch in test-347

Found while checking whether tool-router.cjs's registration rewrite (11
sites, `server.tool` -> `server.registerTool`) broke any test outside this
plan's declared `files_modified`. `tests/test-347-visualize-real-chain.cjs`
Task 2 Test 7 asserts `(TOOL_ROUTER_SOURCE.match(/safeResolveSection/g) ||
[]).length === 6` with a comment naming the expected 6 sites (two comments,
the function definition, the one call site, a JSDoc reference, and the
`module.exports._test` entry). `grep -c safeResolveSection
lib/mcp/tool-router.cjs` returns **7** both before and after 267-06's
diff (confirmed via `git show HEAD:lib/mcp/tool-router.cjs | grep -c
safeResolveSection`, and `git diff` for 267-06's own tool-router.cjs
commit contains zero lines matching `safeResolveSection`) -- this plan's
registration rewrite touched none of those lines. The 7th occurrence
(line ~2326, a comment: "... those modules require this file back for
SECTION_RE/safeResolveSection reuse) ever runs...") already existed at
267-06's PLAN_BASE.

Classification: pre-existing, unrelated to Phase 267. Not part of this
plan's own gate set (`tests/test-347-visualize-real-chain.cjs` is not
referenced by `tests/run-all-198.sh` or `tests/run-all-267.sh`, and is not
named in this plan's `<verify>` block). 267-06 DID fix this file's
`makeFakeServer()` (added a `registerTool` capture sibling, a genuine
Rule-1 bug this plan's own tool-router.cjs change caused -- see the
267-06 SUMMARY), which resolved 5 of that file's 6 originally-failing
checks; only Task 2 Test 7's occurrence-count assertion remains red, for
the reason above.

**Do not fix as part of any Phase 267 plan** unless a plan explicitly says
so; the fix belongs to whoever owns test-347's own baseline count (either
correct the comment/assertion to 7, or find and remove the stray 7th
mention) -- out of scope for a registration-API migration phase.

## 267-07: two pre-existing gate_answer-approve test failures, confirmed unrelated to the registerTool migration

Found while sweeping every test file that requires `lib/mcp/tools/gate.cjs`
and drives its own fake `McpServer`, to check whether gate.cjs's Task 2
registration rewrite broke anything outside this plan's own declared verify
list (the same proactive sweep discipline 267-06 used for its 10-fixture
Rule-1 fix). Six fixtures genuinely needed a `registerTool` capture sibling
(a real regression this plan's own gate.cjs commit caused -- see its own
SUMMARY.md for the fix). Two more, `tests/test-238-chosen-validation.cjs`
and `tests/test-345-gate-ratify.cjs`, failed differently: once given the
same `registerTool` sibling, they no longer crash on the missing method, but
each fails a genuine assertion on `gate_answer`'s approve-verdict response.

1. **`tests/test-238-chosen-validation.cjs`** ("case 1 (anti-vacuity
   control): a valid chosen ratifies and writes exactly one memory_event
   row") fails: `afterCase1 !== beforeCase1 + 1` (2 memory_event rows
   written for one approve, not 1). Line 156-159.
2. **`tests/test-345-gate-ratify.cjs`** ("gate_answer (approve leg):
   strategy_ratification.ok is true, anchor_confirmed is true") fails at
   line 433: `strategy_ratification.ok` or `.anchor_confirmed` reads false
   for a strategy-card approve.

**Confirmed NOT caused by this plan's registerTool rewrite**: both failures
were reproduced identically against `gate.cjs` as of THIS plan's own Task 1
comment-fix commit (`aafa47ce7`, still the pre-migration `server.tool()`
form) with the same fixed fixtures swapped in temporarily, then the current
`server.registerTool()` form restored -- byte-identical failure output
either way. The likely cause is later-phase growth of `gate_answer`'s
approve branch (Phase 345-07 STRAT-13's `goalGate.ratifyGoalProposal`, and/
or Phase 354/355's `_promoteCardSubject` / `_maybeLogGateOutcome` additive
writes) outpacing these two older tests' fixed expectations (one
memory_event row, or a specific strategy-ratification shape) -- not
investigated further, since root-causing gate_answer's write count is a
different task than a registration-API migration.

Classification: pre-existing, unrelated to Phase 267. Neither file is
referenced by `tests/run-all-198.sh` or `tests/run-all-267.sh`, and neither
is named in 267-07-PLAN.md's `<verify>` block.

**Do not fix as part of any Phase 267 plan** unless a plan explicitly says
so; the fix belongs to whoever owns `gate_answer`'s approve-branch write
count / strategy-ratification contract (Phase 345/354/355's own owners) --
out of scope for a registration-API migration phase.

## 267-07: pre-existing stale mutation-test needle in test-237-approve-executes.cjs Leg 7

Found while checking whether chain.cjs's registration rewrite broke
`tests/test-237-approve-executes.cjs` (a mutation-testing harness that
writes a tmp mutated copy of `lib/mcp/tools/chain.cjs` with its dispatcher
call swapped for a fabricated-success stub, to prove the real approve path
is genuinely exercised). Leg 7 fails: `buildMutatedChainCjs`'s
`DISPATCHER_CALL_NEEDLE` string search
(`makeChainStepDispatcher(roomDir, { sessionId: o.sessionId, targetSection:
... : null })`) no longer matches chain.cjs's live source, which reads
`makeChainStepDispatcher(roomDir, { sessionId: o.sessionId, targetSection:
..., runId: runId })` -- Phase 347's CR-01 `runId` wiring (see
`lib/mcp/tools/chain.cjs`'s own module-header note on `runId`) added a
`, runId: runId` field to this call sometime after this harness's needle
was last updated, and nobody rebaselined the needle.

Confirmed NOT caused by this plan's registerTool migration: reproduced
identically with `lib/mcp/tools/chain.cjs` swapped back to its committed
pre-migration (`server.tool()`) form and the migrated form restored
afterward -- byte-identical failure either way (the needle lives inside
`chainRun`'s function body, which this plan's registration-only rewrite
never touches).

Classification: pre-existing, unrelated to Phase 267. Not referenced by
`tests/run-all-198.sh` or `tests/run-all-267.sh`, not named in
267-07-PLAN.md's `<verify>` block.

**Do not fix as part of any Phase 267 plan** unless a plan explicitly says
so; the fix belongs to whoever rebaselines `DISPATCHER_CALL_NEEDLE` against
chain.cjs's current dispatcher-call text (Phase 347's own owner) -- out of
scope for a registration-API migration phase.
