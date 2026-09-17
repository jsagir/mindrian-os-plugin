## 2026-09-17 - Task 1 (353-01) - pre-existing failure, out of scope

`node tests/test-195-recursive-reconcile.cjs` fails at HEAD (4ec15cc31, before any
Phase 353 edit): "pass-2 must upsert nothing (idempotent); got 16" in the
"pass-1 projects N memory_artifact nodes; pass-2 returns {upserted:0}..." check.
Reproduced 3x, consistent. Not caused by this plan: no Phase 353 task touches
`lib/core/reconcile-memory-runner.cjs` or `tests/fixtures/195-nested-room-tree/`,
and `git status` showed no uncommitted changes to either at session start.
Out of scope per the SCOPE BOUNDARY rule (pre-existing failure in an unrelated
file). Logged here rather than fixed. The 353-01 plan's own acceptance
criterion ("node tests/test-195-recursive-reconcile.cjs exits 0") could not be
satisfied for this reason; the three OTHER assertions in that same test file
that Task 1 actually depends on (16-file discovery count, depth-3 recursion,
depth-4 cap) all still pass, confirming the fixture tree Task 1 must not
extend is unchanged and its exact-count invariant holds.
