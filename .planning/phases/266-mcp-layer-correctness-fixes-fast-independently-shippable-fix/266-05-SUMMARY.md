---
phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
plan: 05
subsystem: mcp-transport
tags: [mcp, connect-timeout, npm-install-lock, dependency-heal, process-budget]

# Dependency graph
requires:
  - phase: 266-03
    provides: "CONNECT_PATH_BUDGET_MS (15000ms) enforced per-call via a connectPath option threaded through ensureDepsPresent/requireWithHeal/runGuardedInstall/waitForUnlock"
provides:
  - "One process-wide, monotonically-shrinking connect-path deadline (beginConnectPathBudget/connectPathRemainingMs) consulted by every connect-path heal call in a single MCP process"
  - "A hard short-circuit (CONNECT_PATH_MIN_ATTEMPT_MS = 250ms floor) that propagates the original MODULE_NOT_FOUND / returns budgetExhausted:true instead of starting a new install once the budget is spent"
  - "A cumulative wall-clock test (tests/test-266-connect-path-process-budget.cjs) that replays the real multi-call module-scope heal sequence with the sequence length derived from the live bin/*.cjs files"
affects: [mcp-first-daemon, mcp-connect-reliability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scoped shrinking deadline (armed once per process, auto-arming on first read) instead of threading a timeoutMs closure through a factory function that is re-invoked per session"
    - "Subprocess-guarded wall-clock tests with env sanitation (deleting CLAUDE_PLUGIN_ROOT/MINDRIAN_OS_ROOT) so a test can never accidentally aim a real npm install at the ambient plugin root"

key-files:
  created:
    - tests/test-266-connect-path-process-budget.cjs
  modified:
    - lib/core/mcp-dep-heal.cjs
    - bin/mindrian-mcp-server.cjs
    - bin/mindrian-brain-mcp-client.cjs
    - tests/test-266-dep-heal-connect-budget.cjs
    - lib/core/npm-install-lock.cjs
    - lib/core/npm-install-lock.test.cjs
    - tests/run-all-266.sh

key-decisions:
  - "Module-scoped connectPathDeadlineAt, not a call-site-threaded timeoutMs closure: the fourth connect-path call site (the lazy zod require inside bin/mindrian-mcp-server.cjs's createServer()) is not at module scope and is re-invoked per session by the flag-ON multi-session HTTP branch, where a stale zero-remaining timeoutMs would hit runGuardedInstall's > 0 guard and silently restore the full 120s hook-path default mid-session."
  - "The budget-exhaustion check runs BEFORE the 'self-healing npm install' / 'missing dependency' log line in both requireWithHeal and ensureDepsPresent, so a short-circuited call never falsely announces a heal attempt it did not make (this also keeps the new test's 'exactly one self-healing npm install log line' assertion true)."
  - "CONNECT_PATH_MIN_ATTEMPT_MS = 250, grounded in npm-install-lock.cjs's POLL_INTERVAL_MS (200ms): a wait shorter than one poll cycle cannot observe anything, and a spawnSync install killed under 250ms guarantees a partial node_modules tree (266-REVIEW.md WR-03)."

requirements-completed: [MCPFIX-03]

# Metrics
duration: 25min
completed: 2026-08-27
---

# Phase 266 Plan 05: Process-Wide Connect-Path Budget Summary

**One shrinking process-wide connect-path deadline replaces four independently-budgeted heal calls, closing 266-VERIFICATION.md Truth #5's measured 60296ms cumulative regression against a ~30000ms host connect timeout.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-27T05:05Z (approx, session start)
- **Completed:** 2026-08-27T05:21:44Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- Closed the ONE verified gap in Phase 266 (266-VERIFICATION.md Truth #5): `CONNECT_PATH_BUDGET_MS` was enforced per-call, so both MCP entry points' four sequential module-scope heal calls could each burn a fresh 15000ms budget, for a measured worst case of 60296ms cumulative, double the host's ~30000ms MCP connect timeout.
- Added `beginConnectPathBudget()` / `connectPathRemainingMs()` / `CONNECT_PATH_MIN_ATTEMPT_MS` to `lib/core/mcp-dep-heal.cjs`: one process-wide deadline armed once per process, consulted by every connect-path heal call (including the nested `zod` require inside `createServer()`, which is not at module scope).
- Wired both `bin/mindrian-mcp-server.cjs` and `bin/mindrian-brain-mcp-client.cjs` to arm the budget at the earliest possible moment and to log `ensureDepsPresent`'s `{ok:false}` outcome instead of silently discarding it.
- Added `tests/test-266-connect-path-process-budget.cjs`: a hermetic, subprocess-guarded cumulative wall-clock proof that replays the real multi-call heal sequence with the sequence length (`SEQUENCE_LEN`) derived from the live `bin/*.cjs` files, so a future fifth connect-path call site automatically lengthens the proof.
- Retired the stale "per-call" mental model everywhere it was described in doc comments, and closed 266-REVIEW.md WR-01 by adding the two `bin/*.cjs` entry points (plus the two lock/heal test files) to `tests/run-all-266.sh`'s `EMDASH_TARGETS` fence.

## Task Commits

1. **Task 1: Pin the cumulative multi-call bound before changing behavior (RED)** - `0f2f3a98` (test)
2. **Task 2: One shrinking process-wide connect deadline, short-circuit on exhaustion, both entry points armed (GREEN)** - `a99c0c95` (feat)
3. **Task 3: Retire the per-call phrasing everywhere it still lives, close the fence gap** - `07e5d9d0` (docs)

_Note: this plan carries an explicit RED/GREEN task structure (Task 1 pins a failing cumulative test before any production code changes, Task 2 makes it pass) even though the plan frontmatter is `type: execute`, not `type: tdd`; the plan text itself mandates the sequencing and this executor honored it (RED confirmed non-zero exit with 3 passed/4 failed before Task 2 began)._

**Plan metadata:** pending (this SUMMARY.md + STATE.md + ROADMAP.md commit, made after this summary)

## Files Created/Modified

- `tests/test-266-connect-path-process-budget.cjs` - New. Cumulative wall-clock proof: export shape, invariant chain, call-site census (derives `SEQUENCE_LEN`), arming census, parametric fast bound, real-number bound (the verifier's exact scenario), hook-path-untouched check.
- `lib/core/mcp-dep-heal.cjs` - Adds `beginConnectPathBudget`/`connectPathRemainingMs`/`CONNECT_PATH_MIN_ATTEMPT_MS`; `requireWithHeal` and `ensureDepsPresent` now consult the shared deadline and short-circuit below the floor; corrected module header (BUDGET ARITHMETIC table, new Phase 266 Plan 05 block).
- `bin/mindrian-mcp-server.cjs` - Arms the budget via `beginConnectPathBudget()` before its first heal call; logs `ensureDepsPresent`'s outcome.
- `bin/mindrian-brain-mcp-client.cjs` - Identical arming + outcome-inspection treatment.
- `tests/test-266-dep-heal-connect-budget.cjs` - Header only: states this file owns the per-call contract, points to the new process-level test, corrects the per-call phrasing.
- `lib/core/npm-install-lock.cjs` - `waitForUnlock` JSDoc only: the connect-path caller now passes the remaining slice of a process-wide budget, not a fixed constant.
- `lib/core/npm-install-lock.test.cjs` - Header only: notes the Plan 05 semantic change; all four invariant assertions unchanged.
- `tests/run-all-266.sh` - `EMDASH_TARGETS` gains both `bin/*.cjs` entry points and the two lock/heal test files (266-REVIEW.md WR-01).

## Decisions Made

- Module-scoped deadline over call-site-threaded `timeoutMs`, because the fourth connect-path call site is nested inside a per-session-re-invoked factory (`createServer()`) -- see key-decisions above for the full reasoning.
- Budget-exhaustion check moved to run BEFORE the "self-healing" log line in both heal functions, so a short-circuited call never logs a heal attempt it didn't make.
- `CONNECT_PATH_MIN_ATTEMPT_MS = 250`, grounded in `POLL_INTERVAL_MS` (200ms) and the partial-`node_modules` risk from a `spawnSync` kill under 250ms (266-REVIEW.md WR-03).

## Deviations from Plan

None - plan executed exactly as written. All identifiers, constants, and file touch-lists match the plan's frontmatter (`beginConnectPathBudget`, `connectPathRemainingMs`, `CONNECT_PATH_MIN_ATTEMPT_MS`, `budgetExhausted`) and its "fix shape" reference sketch.

## Issues Encountered

None. Task 1's RED phase confirmed exactly the expected failure signature (3 passed / 4 failed: checks 1, 4, 5, 6 fail because the new exports do not exist yet; checks 2, 3, 7 already pass since they only exercise pre-existing constants/files). Task 2's GREEN phase turned all 7 checks green on the first implementation pass, with no additional debugging needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MCPFIX-03 (and all four MCPFIX requirements from Phase 266) are now genuinely satisfied at the process level, not just the per-call level. Phase 266's own gap-closure loop is complete: 266-VERIFICATION.md Truth #5 is closed by construction (the new test proves a future fifth connect-path call site cannot silently reopen the gap, since `SEQUENCE_LEN` is derived from the live files).
- No blockers for downstream phases. The connect-path budget mechanism is a pure additive change to `lib/core/mcp-dep-heal.cjs`'s existing exports; nothing in its public shape was removed.

## Verification (plan's own 7-item block, all run for real)

1. `node tests/test-266-connect-path-process-budget.cjs` - exit 0, 7/7 passed, 17.2s wall clock (under 45s).
2. `node tests/test-266-dep-heal-connect-budget.cjs` - exit 0, 9/9 passed.
3. `node lib/core/mcp-dep-heal.test.cjs` (9/9) and `node lib/core/npm-install-lock.test.cjs` (20/20) - both exit 0, same counts as before this plan.
4. `bash tests/run-all-266.sh` - exit 0, `PASS=9 FAIL=0 SKIP=0`; `TEST_266_PREFIX=tests/test-266-nonexistent- bash tests/run-all-266.sh` - exit 1 (guard intact).
5. `git diff --quiet HEAD -- scripts/sessionstart-npm-reconcile.cjs` - exit 0 (byte-identical); `DEFAULT_INSTALL_TIMEOUT_MS` still `120000`.
6. `node tests/test-234-tool-description-floor.cjs` (156/156, 36/36 coverage) and `node lib/mcp/no-instructions.test.cjs` (9/9) - both exit 0.
7. `LC_ALL=C.UTF-8 grep -lP '\x{2014}'` across all 8 `files_modified` - zero matches.

---
*Phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix*
*Completed: 2026-08-27*

## Self-Check: PASSED

All 8 files_modified paths and this SUMMARY.md confirmed present on disk. All 3 task commit hashes (`0f2f3a98`, `a99c0c95`, `07e5d9d0`) confirmed present in `git log --oneline --all`.
