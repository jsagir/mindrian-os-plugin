---
phase: 387-eureka-reachable-on-a-normal-install
plan: "09"
subsystem: eureka-engine-enable
tags: [enable-command, uv-sync, grant, tdd]
requires: ["387-03"]
provides:
  - "lib/core/eureka/eureka-engine-enable.cjs (check, save, forget, data, grant-gated sync, deep check)"
affects: [387-04, 387-11]
key-files:
  created:
    - lib/core/eureka/eureka-engine-enable.cjs
    - tests/test-387-eureka-engine-enable.cjs
metrics:
  completed: 2026-11-06
---

# Phase 387 Plan 09: Engine enable module Summary

A new module implements the `enable engine` operations on the resolver and requirements core of Plan 387-03. It exports run, main, runEngineSync and runEngineDoctor. The tests pin the check, the save and forget of the setting, the data list, the grant-gated sync and the deep check.

## What was done (TDD)

- RED (a6777ae61): `tests/test-387-eureka-engine-enable.cjs`, 410 lines, arms E1 to E15.
- GREEN (16b4bf2f8): `lib/core/eureka/eureka-engine-enable.cjs`, 557 lines, plus a 4-line change to the test file in the same commit.

## Verification (run in this session)

- `node tests/test-387-eureka-engine-enable.cjs`: exit 0, 15 passed, 0 failed.
- `bash tests/run-all-387.sh`: exit 0, PASS=13 FAIL=0 SKIPPED=1 (the live leak test, MINDRIAN_EUREKA_LIVE_LEAK is not 1).
- The arms cover: E1 absent engine, no spawn; E2 save with mode 0600 and the 3 probes only; E3 and E4 refusals that write nothing; E5 and E6 uv and Python causes; E7 environment not synced and forget; E8 data list that deletes nothing; E9 sync without approval prints the grant card and exits 2; E10 approved sync with a locked argv and an allowlist environment, reported from the disk; E11 sync refusals; E12 deep check runs only with `--deep`; E13 static check (no network module, no Brain path, spawns only in runEngineSync and runEngineDoctor); E14 help; E15 the encoder installer test still passes.

## Deviations from Plan

**1. [Rule 3] The two GREEN commits of the plan are one commit (16b4bf2f8).** The earlier agent merged them. The commit also holds a 4-line edit to the test file made during GREEN. The content of that edit was not reviewed for this summary.

## Known Stubs

None found.

## UNVERIFIED

- No real engine run, no `uv sync`, no network call. The sync and deep check are proven only through the test doubles in E10 to E12.
- Behavior on a real Desktop or Cowork host.

## Risks

- The real `uv sync` argv and its effect on a real engine folder are pinned by the test only, not by a live run (owner-run step).

## Self-Check: PASSED (as run above)

- Commits a6777ae61 and 16b4bf2f8 exist. Both named files exist.
