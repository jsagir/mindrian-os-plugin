# Deferred Items - quick task 260911-juq

## Pre-existing test-198-adapter-budget.test.cjs line-budget failure (out of scope)

**Found during:** Task 1 verify (`node tests/test-198-adapter-budget.test.cjs`)

**Symptom:** Subtest "checkAdapterBudget() passes against the real committed tree today"
fails: `scripts/on-stop` measures 618 lines (via `src.split('\n').length`) against its
recorded `LINE_BUDGETS['scripts/on-stop']` ceiling of 570.

**Root cause:** `scripts/on-stop` grew past its Phase 198-09 measured budget through later,
unrelated commits (confirmed via `git log --oneline -- scripts/on-stop`: `01c3ca19`
fix(240.1-03), `c7fb00db` feat(241-05), `0d02e112` fix(241-02)). This is a pre-existing
drift, not something introduced by quick task 260911-juq.

**Proof it predates this task:** `git show HEAD:scripts/on-stop | wc -l` (HEAD fe45ad98,
before any edit in this task) already returns 617 lines (618 by the test's
`split('\n').length` measure). Quick task 260911-juq never touches `scripts/on-stop`, and
the marker-relocation change does not alter which files `lineCountBudget()` reads from
disk (still `scripts/statusline-mos-dispatch`, `scripts/sessionstart-coordinator.cjs`,
`scripts/on-stop`, whether the surface list is enumerated from `hooks/hooks.json` or from
the new `data/hooks-markers.json` sidecar).

**Scope decision:** Not fixed. Per the executor's scope-boundary rule, only issues
directly caused by this task's changes are auto-fixed; this is a pre-existing,
unrelated-file budget drift. Bumping `LINE_BUDGETS['scripts/on-stop']` is a judgment call
about how much re-fattening margin Phase 198's D-06 gate should tolerate going forward,
which belongs to whoever owns that budget, not to a hooks.json-warning quick task.

**Recommendation:** Open a follow-up quick task or `/gsd:debug` slug to re-measure
`scripts/on-stop`'s current legitimate line count and set a new budget with margin, the
same way the original 198-09-PLAN.md set 570 (547 measured + 23 margin).

**Commit:** none (deferred, not fixed)

## Two more pre-existing run-all-198.sh failures, also out of scope

**Found during:** Task 2 verify (`bash tests/run-all-198.sh`)

1. `198 Part 8 local-only floor (zero Brain/network token in new lib/mcp modules)`
   fails: `lib/mcp/tools/sensors.cjs: forbidden token 'brain-client.cjs'`. Last commit
   touching `lib/mcp/tools/sensors.cjs` is `78ae0e53`, unrelated to and predating this
   quick task; `git diff HEAD~1 HEAD -- lib/mcp/tools/sensors.cjs` (this task's own
   Task 1 commit) is empty.
2. `SPEC-2 contract-version + per-tool schema validity` fails:
   `context_assemble schema PARSES a synthesized sample input` assertion fails in
   `tests/test-198-contract-schema.test.cjs`. `lib/mcp/contract-version.cjs` is also
   untouched by this task's commits.

Neither file is in this quick task's `files_modified` list, neither was edited by
Task 1 or Task 2, and both failures reproduce identically on a tree where only this
task's own commits are present. Not fixed, per the same scope-boundary rule as the
`scripts/on-stop` item above. `bash tests/run-all-198.sh` before this task's edits
already reported these as red; documented here rather than silently re-run hoping
they resolve themselves.
