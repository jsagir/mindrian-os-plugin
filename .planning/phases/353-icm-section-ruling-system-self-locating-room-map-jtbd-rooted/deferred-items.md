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

## 2026-09-17 - Task 10 (353-02) - pre-existing failure, out of scope

`bash tests/run-all-310.sh` leg 7 ("Step 5.5 real-block wiring suite", driven
by `tests/test-310-release-step55-wiring.cjs`) fails with
`driver.sh: line 98: DRY_RUN: unbound variable` in Case 1 (and two further
cases in the same run), leaving that suite at 5/8 rather than 8/8.
Reproduced against `scripts/release.sh` checked out at HEAD (commit
3279defbe, before Task 10's own two-block edit): the failure is
byte-identical with and without Task 10's changes applied, confirming it
predates this task and is not caused by the offline ledger-check addition or
the `--no-ledger-check` flag. The driver harness this test extracts and
re-executes a slice of `release.sh` into apparently expects `DRY_RUN` to be
exported by the harness itself before sourcing the extracted Step 5.5/5.6
slice under `set -u`; that is a defect in the test's own driver
(`test-310-release-step55-wiring.cjs`), a file this task's own `<files>`
list does not name and Task 10 does not touch. Out of scope per the SCOPE
BOUNDARY rule. Logged here rather than fixed. `bash tests/run-all-310.sh`
therefore exits 1 (not the 0 the plan's own `<verification>` section
names), solely due to this one pre-existing leg; leg 3 (the exhaustive
step-block hash tripwire, the leg Task 10 actually re-pins) passes, along
with every other leg.
