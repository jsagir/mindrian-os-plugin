# Deferred Items - Phase 248-01

## scripts/on-stop line-budget overage (pre-existing, out of scope)

`tests/test-198-adapter-budget.test.cjs` fails on `checkAdapterBudget()`:
`scripts/on-stop` is 618 lines against a budget of 570. `scripts/on-stop` was
never touched by any 248-01 task (confirmed via `git log --oneline -- scripts/on-stop`,
last modified by 241-05/240.1-03/241-02 commits, all pre-dating this phase).
Per the executor scope boundary (fix only what the current task's changes
directly cause), this is logged here rather than fixed. Not blocking Phase
248-01's success criteria: none of CTX-01/CTX-02's must_haves or verification
commands reference this test.
