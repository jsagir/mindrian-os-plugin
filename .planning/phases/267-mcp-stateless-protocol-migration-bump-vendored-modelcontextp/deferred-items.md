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
