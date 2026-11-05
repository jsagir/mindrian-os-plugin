---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 02
subsystem: testing
tags: [perf, harness, run-marker, kill-hygiene, restore, transcript-fixture]
requires:
  - phase: 384-01
    provides: reviewed harness, per-target gates, lock check, failed-run rule, phase-guard
provides:
  - run mechanics fixed (escaped background work, count pass, restore per target, source-keyed snapshot, changed-path proof, sandbox cleanup)
  - 4 MiB synthetic transcript, SessionStart compact target, class counts, per-hook results, library exports
  - final statuses X1 to X15 in harness-review.md
affects: [384-03, 384-04, 384-05, 384-06, 384-07, 384-08, 384-09]
tech-stack:
  added: []
  patterns: [MOS_PERF_RUN_ID marker scan of /proc environ, state-log offset proof, key-by-source bench folder]
key-files:
  created: []
  modified:
    - tools/perf/perf-harness.cjs
    - tools/perf/count-modules-preload.cjs
    - tests/test-384-perf-harness.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/harness-review.md
key-decisions:
  - "The isolation exit rule stays strict (owner question Q1 open). Class counts only describe a breach."
  - "Hook ids in a result are the hooks.json command text, so a test hook must not name a path: tests pass paths through environment variables."
  - "X11 (sandbox leak on error) was left open by plan 01 and is fixed here (cleanup in a wrapper finally, and in prepareRoom on error)."
requirements-completed: [PERF384-01]
duration: not recorded
completed: 2026-11-05
---

# Phase 384 Plan 02: Harness run mechanics and Wave 1 features Summary

The harness now waits for hidden background work by a per-run marker, kills only marked survivors, flushes the count pass, restores the room copy per target, proves the changed path from the room state log, and offers the transcript fixture, the compact target, class counts, per-hook results and a library surface.

## Commits

| Sha | Subject |
|-----|---------|
| a0ed98771 | fix(384-02): harness settles escaped background work, kills only marked survivors, flushes the count pass, restores per target, proves the changed path |
| a462fcb18 | feat(384-02): harness transcript fixture, SessionStart compact target, class counts, per-hook results, library exports |
| (this docs commit) | docs(384-02): plan summary and final review statuses |

## TDD record

Task 1 RED (self-test on the unchanged harness, 23 FAILED): A1 (run id, background_ms, escaped_max twice, survivor failed run), A2 (node_starts 0), A3 (three checks, unknown flag --restore), A4 (second run reused the first snapshot, key folders, three clean-bench checks), A5 (four log proofs and three verify-results rules), X11 (one sandbox left). Task 1 GREEN: ALL PASS, 122 checks.

Task 2 RED (11 FAILED): W1 makeTranscript missing, W2 targets and tx4m and compact runs, W3 buildEventPayload missing, W4 class counts (three checks) and classOfPath, W5 export surface (two checks), W6 per_hook. Task 2 GREEN: ALL PASS, 161 checks (39 of them W1 to W6).

## Defect statuses (harness-review.md)

X1 to X12, X14, X15 CONFIRMED and fixed (X1 to X5, X12, X14, X15 in 40efc6aad; X6 to X11 in a0ed98771). X13 DROPPED with evidence (plan 01). The five features of the review list are done in a462fcb18.

## Notes on behavior

- Settle waits for hook groups, the state lock and every live process that carries this run's marker. At the limit it kills hook groups it spawned and marked processes only. The run then counts as failed (failed_runs, survivors_left); verify-results also fails on survivors_left above 0.
- A bystander test proves that a process without the marker survives.
- Restore per target skips the first target and reuses one snapshot manifest. The paths that restore fixes join the isolation union, so earlier targets stay visible to the isolation check.
- changed_taken_runs and changed_unknown_runs are booleans counted from new state-log lines; no log text is stored.
- The count pass preload exits 0 on SIGTERM only in count mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] X11 sandbox cleanup on error**
- **Found during:** Task 1 (the review table listed X11 as open for this plan, no task named it)
- **Fix:** cmdRun wrapper cleans the sandbox in a finally; prepareRoom cleans on error and removes a half-made snapshot so it is never reused. Test: X11 check.
- **Commit:** a0ed98771

**2. [Rule 3 - Blocking] Hook ids carried test paths into the result**
- **Found during:** Task 2 (Part 8 scan failed on a scratch path inside a per_hook id)
- **Fix:** the tests pass log and source paths through environment variables (MOS_T_LOG, MOS_T_SRC, MOS_T_MARK). No harness change; the Part 8 scan stays as it is.
- **Commit:** a462fcb18

**3. [Process] Final commit shas in the review file**
- A commit cannot hold its own sha, so the review file in a0ed98771 carried a placeholder for the sha. This docs commit fills in a0ed98771 and a462fcb18.

### Added test-only flag

- `--settle-ms` (needs MOS_PERF_SELFTEST=1) sets the settle limit for the survivor test, like --allow-short and --skip-gates.

## Not changed on purpose

- tools/perf/README.md is outside the files of this plan. It still describes clean-bench with `--source` only and does not list --restore, --settle-ms or the new targets. A later plan should update it.
- No real room was used. All runs used synthetic folders and the fixture-free synthetic room.

## C10 check (product dirty files)

- At the start: 0 dirty entries in hooks, scripts, lib, bin, package.json, npm-shrinkwrap.json, data.
- At the end: 0 dirty entries. diff of the two lists is empty. Peer commits for Phase 383 landed during the plan (fa2d95e97, 0ab62b211, d5b9f117e, 7eebf9979, cd093704e); this plan did not touch them.
- phase-guard from BASE_SHA_384: OK (note: 2 peer commits touching product paths).

## Known Stubs

None.

## Threat Flags

None. T-384-06 to T-384-09 are mitigated by tests (bystander survives, environ text not stored, filler-word transcript, integer class counts).

## Self-Check: PASSED

- Files exist: tools/perf/perf-harness.cjs, tools/perf/count-modules-preload.cjs, tests/test-384-perf-harness.cjs, measurements/harness-review.md.
- Commits a0ed98771 and a462fcb18 exist on main.
- Self-test: perf-harness: ALL PASS (161 checks) under the 384 lock.
