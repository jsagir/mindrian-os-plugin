---
phase: 238-decision-gates
plan: 01
subsystem: testing
tags: [node-assert, bash-aggregator, child-process-fork, hermetic-isolation, card-fire, gate-ledger]

# Dependency graph
requires: []
provides:
  - "tests/run-all-238.sh: the Phase 238 gate, all nine legs pre-declared via run_if, so no later-wave plan edits this runner"
  - "tests/helpers/cardfire-hermetic-238.cjs: makeHermeticCardFireEnv(label), the shared MINDRIAN_HOME + CARD_FIRE_SIDECHANNEL_PATH isolation helper every later 238 leg calls"
  - "tests/test-238-retry-counter-fence.worker.cjs: the forked-child worker 238-05's concurrency test drives to prove the GATE-03 retry-counter fence"
affects: [238-02, 238-03, 238-04, 238-05, 238-06, 238-07, 238-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "run_if aggregator pattern (tests/run-all-209.sh precedent): every leg guarded on a file that must exist, so a partially-landed phase SKIPs instead of FAILs"
    - "Forked-child worker pattern (lib/memory/write-lock-atomic.worker.cjs precedent): a standalone .worker.cjs file, MINDRIAN_HOME set before the require, exit codes 0/1/3, never an inline -e string"
    - "Hermetic side-file isolation helper: one function returns { dir, retryFile, sideFile, restore }, save-then-restore of both env vars including the undefined case"

key-files:
  created:
    - tests/run-all-238.sh
    - tests/helpers/cardfire-hermetic-238.cjs
    - tests/test-238-retry-counter-fence.worker.cjs
  modified: []

key-decisions:
  - "D-01 (aggregator ownership) applied: all nine Phase 238 legs pre-declared in tests/run-all-238.sh by this plan; no later-wave plan will edit this runner."
  - "D-07 (no unverifiable instance count) applied: no artifact in this plan asserts an over-enforcement instance count; N/A here since this plan writes zero fixture data."

requirements-completed: [GATE-01, GATE-03, GATE-04]

# Metrics
duration: ~20min
completed: 2026-07-29
---

# Phase 238 Plan 01: Validation Scaffolding Summary

**Phase 238 test aggregator (nine legs, run_if-guarded), the hermetic MINDRIAN_HOME/CARD_FIRE_SIDECHANNEL_PATH isolation helper, and the forked-child bumpRetryCount worker for the GATE-03 concurrency proof - zero production code touched.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-29
- **Tasks:** 3/3 completed
- **Files modified:** 3 (all new files, all under tests/)

## Accomplishments
- `tests/run-all-238.sh` runs today and reports `PASS=2 FAIL=0 SKIP=7` (the two regression legs - 209 backstop tuning and 198 chain-run-halt - pass; the seven 238 legs SKIP cleanly because their files have not landed yet).
- `makeHermeticCardFireEnv(label)` gives every later Phase 238 test a one-call way to isolate both `MINDRIAN_HOME` and `CARD_FIRE_SIDECHANNEL_PATH`, restoring the exact prior process-env state (including the "was never set" case) and deleting its own temp dir.
- `tests/test-238-retry-counter-fence.worker.cjs` drives the REAL exported `bumpRetryCount` from a forked child against an isolated `MINDRIAN_HOME`, lands exactly N increments when uncontended, and exits 3 (never a silent 0) on bad argv or a require/bump-loop fault. This is the concrete GATE-03 concurrency proof harness 238-05 will fork 20 of in parallel.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the hermetic card-fire isolation helper** - `67981eaf` (test)
2. **Task 2: Create the forked-child worker for the GATE-03 concurrency proof** - `10e59e80` (test)
3. **Task 3: Create the Phase 238 aggregator with every leg pre-declared** - `f1684a14` (test)

_No plan-metadata commit per this plan's explicit brief: STATE.md/ROADMAP.md are NOT touched by this executor; the orchestrator owns those writes centrally after all 8 plans in this phase complete._

## Files Created/Modified
- `tests/helpers/cardfire-hermetic-238.cjs` - `makeHermeticCardFireEnv(label)`: mkdtemp + set MINDRIAN_HOME/CARD_FIRE_SIDECHANNEL_PATH + save-restore + rmSync cleanup
- `tests/test-238-retry-counter-fence.worker.cjs` - standalone forked-child worker; argv[2]=MINDRIAN_HOME, argv[3]=key, argv[4]=bump count; calls real `bumpRetryCount` from `scripts/check-card-fire.cjs` in a loop
- `tests/run-all-238.sh` - bash aggregator, nine `run_if`-guarded legs (seven 238 legs + `tests/test-209-backstop-tuning.cjs` + `tests/test-198-chain-run-halt.test.cjs`), executable

## Decisions Made
- Followed the plan's explicit read-first precedents byte-for-byte: `tests/run-all-209.sh`'s structure for the aggregator, `lib/memory/write-lock-atomic.worker.cjs`'s shape for the forked-child worker, and `tests/test-209-incident-replay.cjs`'s hermetic-isolation rationale (documented verbatim in the new helper's header comment) for why both env vars are mandatory together.
- No architectural decisions required; this plan is pure scaffolding with zero production-code edits, exactly as scoped.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria were verified command-by-command and passed on the first attempt; no auto-fixes were needed.

## Issues Encountered

None. One environment note (not a deviation): the acceptance criterion for Task 2 used `find ... -newermt '-1 minute'`, which failed under this environment's `bfs`-backed `find` alias (it does not accept GNU findutils' relative `-newermt` syntax). Verified the equivalent intent instead with `find ... -mmin -1` (empty result) plus an `ls -la` mtime check on the real `~/.mindrian/card-fire-retries.json`, confirming the probe's forked child never touched the navigator's live retry store. This is a local shell-alias quirk, not a defect in the worker or the plan's acceptance criterion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The three scaffolding artifacts this plan promised are on disk, committed, and verified:
- `bash tests/run-all-238.sh` exits 0 today with `FAIL=0 SKIP=7` (all nine legs pre-declared; missing files SKIP, not FAIL).
- `node tests/test-209-backstop-tuning.cjs` still passes as a leg of this runner (13/13 assertions).
- `git diff --stat lib/ scripts/` across this plan's three commits is empty - zero production files touched, as required.

Plans 238-02 through 238-08 can now build against this scaffolding: every later test file simply requires `tests/helpers/cardfire-hermetic-238.cjs` for isolation and (for 238-05) forks `tests/test-238-retry-counter-fence.worker.cjs`. No later-wave plan needs to touch `tests/run-all-238.sh` - its nine legs are already pre-declared and will flip from SKIP to PASS/FAIL as each leg's file lands.

---
*Phase: 238-decision-gates*
*Completed: 2026-07-29*

## Self-Check: PASSED

All created files found on disk; all three task commits found in git log. No missing items.
