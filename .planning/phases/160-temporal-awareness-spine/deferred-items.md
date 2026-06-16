# Phase 160 Deferred Items

Out-of-scope discoveries logged during plan execution. NOT fixed here.

## DI-160-04-01: pre-existing fs-instrument leak in test-129.5-truth-machine.cjs

- **Found during:** Plan 160-04 Task 1 regression sweep.
- **Symptom:** `tests/test-129.5-truth-machine.cjs` -> `test_truthMachine_instrumented`
  FAILS the fs-instrument gate (zero non-SQLite reads during the confirm flow);
  leaked reads: `lib/core/persona-override.cjs` + `~/.mindrian/persona-override.json`.
- **Cause:** `persona-override.cjs` (introduced by commit `dcf9450c`, unrelated to
  Phase 160) is pulled into the confirm flow and reads the filesystem outside the
  USER.md allow-list. Proven pre-existing: the test fails IDENTICALLY with
  origin/main's `transitions.cjs` (Plan 160-04 changes reverted), so it is not
  caused by the Phase 160-04 last_modified_at write-discipline edit.
- **Scope:** Belongs to the persona-override / truth-machine owners (the t2k track),
  not Plan 160-04. Logged, not fixed. The companion test
  `test-129.5-confirm-node.cjs` passes (its source-grep audit was extended to
  exclude co-located `*.test.*` files - a Plan 160-04 deviation, see SUMMARY).

## DI-160-02-01: brain-orchestration-projection.json STALE (pre-existing, out of scope)

- **Found during:** Plan 160-02 Task 2, while running the Phase 157 projection `--check`.
- **Observation:** `node scripts/build-orchestration-projection.cjs --check` reports
  STALE. Verified the staleness is **pre-existing** and **NOT caused by Plan 160-02**:
  the `--check` reports STALE even with `skills/context-engine/SKILL.md` restored to
  its committed HEAD state (the 160-02 edit touched only the SKILL body, not the
  `name:`/tier frontmatter the generator keys on). The divergence predates this
  session and/or belongs to a concurrent plan (160-03/160-04 modify spine/sensor/
  migration surfaces enumerated by the projection generator).
- **Why not fixed here:** `data/brain-orchestration-projection.json` is NOT in Plan
  160-02's `files_modified`. Regenerating it would be out of scope (executor SCOPE
  BOUNDARY) and risks a collision with the concurrently-running 160-03 / 160-04. The
  pre-commit hook does NOT gate on this projection, so it does not block the 160-02
  commits.
- **Action:** the next projection-regeneration owner runs
  `node scripts/build-orchestration-projection.cjs` and re-stages
  `data/brain-orchestration-projection.json`.
