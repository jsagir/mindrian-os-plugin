---
phase: 87-security-hardening-cascade-refactor
plan: 02
subsystem: infra
tags: [write-lock, sqlite, atomicity, toctou, concurrency, security]

# Dependency graph
requires:
  - phase: 87-00
    provides: Feynman runner exit-77 SKIP convention + cascade-e2e acceptance gate (baseline 18/18 must stay green)
provides:
  - Atomic SQLite write-lock acquire via fs.openSync(lockPath, 'wx')
  - 20-worker concurrency regression fence proving single-winner semantics
  - Feynman runner extension wiring the new test
  - Distinct error path for pathological retry exhaustion (roomDir=... "could not be acquired after retry")
affects:
  - 87-06 (indexArtifact transaction, v1.10.12 -- depends on atomic lock)
  - 87-10 (v1.10.11 release gate -- this plan is in Stream A)
  - All future plans that BEGIN/COMMIT wrap SQLite writes on room.db

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fs.openSync(path, 'wx') as create-if-not-exists primitive; catch EEXIST + staleness/liveness check + single retry"
    - "Concurrency proof via child_process.fork (true OS-level race, not mocked promises); winner sleeps briefly so PID liveness check rejects all losers"

key-files:
  created:
    - lib/memory/write-lock-atomic.test.cjs
    - lib/memory/write-lock-atomic.worker.cjs
  modified:
    - lib/core/write-lock.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "Atomic primitive: fs.openSync(lockPath, 'wx') is the correct create-if-not-exists. Pre-patch existsSync->writeFileSync was TOCTOU-racy -- two processes could both see 'no lock' then both write."
  - "Same-PID re-acquire keeps writeFileSync (m11 rationale): same PID is single-threaded by definition, no race possible within one process. Atomicity only matters for cross-process contention."
  - "Retry budget = 1: after one EEXIST + staleness cleanup, we retry openSync once. If that ALSO fails with EEXIST, surface as a distinct error ('could not be acquired after retry') so ops can tell pathological churn apart from normal contention."
  - "Standalone worker script (not inline template): avoids Windows/Linux path-escape ambiguity that inline workerCode template-string generation would introduce."
  - "Winner sleeps 500ms before exit: without this, workers that acquired-then-exited leave stale PIDs that the dead-PID cleanup path unlinks, letting multiple workers 'win' in sequence. The sleep keeps the winner PID alive past every loser's liveness check, proving the openSync primitive specifically (not the broader lock system)."

patterns-established:
  - "Atomic file creation via openSync + wx flag + EEXIST catch: the canonical Node pattern for 'create-if-not-exists' without TOCTOU"
  - "Concurrency fence pattern: fork N workers in parallel, winner sleeps briefly, assert exactly-one on exit codes"

requirements-completed:
  - SEC-04
  - CASCADE-04

# Metrics
duration: 17min
completed: 2026-04-19
---

# Phase 87 Plan 02: Write Lock Atomic Creation Summary

**Replaced TOCTOU-racy `existsSync` + `writeFileSync` pair with `fs.openSync(lockPath, 'wx')` atomic primitive; proven by 20-worker concurrency fence (1 winner / 19 losers, non-flaky across 3 runs).**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-04-19T10:36:00Z (approx, post-87-00 completion)
- **Completed:** 2026-04-19T10:52:45Z
- **Tasks:** 2 completed
- **Files modified:** 2 (write-lock.cjs, run-feynman-tests.cjs)
- **Files created:** 2 (write-lock-atomic.test.cjs, write-lock-atomic.worker.cjs)
- **Feynman suite:** 18/18 (pre) -> 19/19 (post, new test added and green)

## Accomplishments

- **Atomic create primitive in place.** `acquireLock` now uses `fs.openSync(lockPath, 'wx')` which fails EEXIST if the file exists. This is the canonical Node pattern for "only one caller wins" create-if-not-exists.
- **All pre-patch paths preserved:** staleness cleanup (age > STALE_THRESHOLD_MS), PID liveness via `process.kill(pid, 0)`, corrupt-file cleanup, same-PID re-acquire.
- **Same-PID re-acquire retains `writeFileSync`** with inline rationale comment explaining why atomicity is NOT required on this path (m11 decision).
- **Retry budget = 1:** one EEXIST + cleanup + one retry. Second EEXIST throws a distinct error `"SQLite write lock could not be acquired after retry (roomDir=...)"` so pathological churn is distinguishable from normal contention.
- **Concurrency fence:** 20 forked workers race on acquire, exactly 1 wins / 19 see "SQLite write lock held by PID", 3 consecutive runs all green.
- **Feynman runner extended:** `write-lock-atomic.test.cjs` added to the discovery list. Count grew from 18 to 19 as required.

## Task Commits

1. **Task 2-1: Atomic acquire via openSync 'wx' + retry-on-EEXIST** -- `237f790` (fix)
2. **Task 2-2: Concurrency test, 20 forked workers, single winner** -- `a0c59c4` (test)

## Files Created/Modified

- `lib/core/write-lock.cjs` -- `acquireLock` body rewritten around `fs.openSync(lockPath, 'wx')`; EEXIST branch runs staleness/ownership/liveness logic; same-PID path keeps `writeFileSync` with m11 comment; retry budget = 1; distinct error on retry exhaustion. `releaseLock` and `isServerRunning` unchanged.
- `lib/memory/write-lock-atomic.test.cjs` (NEW, BSL 1.1) -- 20-worker fork test, release-then-reacquire test, same-PID re-acquire test, stderr diagnostic on unexpected exit codes.
- `lib/memory/write-lock-atomic.worker.cjs` (NEW, BSL 1.1) -- standalone worker; acquires the lock then sleeps 500ms so PID liveness check rejects all losers.
- `lib/memory/run-feynman-tests.cjs` -- one-line discovery extension with comment tagging Phase 87-02.

## Test Evidence

**Baseline (pre-patch):** `node lib/memory/run-feynman-tests.cjs` -> 18/18 passed.

**Post-Task-2-1 (write-lock.cjs only):** 18/18 passed.

**Post-Task-2-2 (runner extended):** 19/19 passed.

**Standalone concurrency test, 3 consecutive runs:**
```
=== run 1 === write-lock-atomic: all tests passed (winners=1, losers=19, re-acquire green)
=== run 2 === write-lock-atomic: all tests passed (winners=1, losers=19, re-acquire green)
=== run 3 === write-lock-atomic: all tests passed (winners=1, losers=19, re-acquire green)
```

**Grep acceptance checks (Task 2-1):**
- `openSync.*'wx'` -> 3 (1 actual call + 2 docstring references explaining atomicity contract; plan expected "1" but the floor is 1+, which is met)
- `fs.existsSync(lockPath)` -> 1 (only `isServerRunning`; acquireLock existsSync removed as required)
- `STALE_THRESHOLD_MS` -> 3 (pre/post identical: 1 const, 1 acquireLock check, 1 isServerRunning check)
- `process.kill(data.pid, 0)` -> 2 (pre/post identical: acquireLock + isServerRunning)
- `SQLite write lock held by PID` -> 1 (pre-patch baseline was also 1; see Deviation below)

**Grep acceptance checks (Task 2-2):**
- `fork|child_process` in test -> 9 (>= 1 required)
- `strictEqual(winners, 1)` in test -> 1 (>= 1 required)
- Line count -> 137 (>= 70 required)

## Decisions Made

See `key-decisions` frontmatter. In summary:

1. Atomic primitive = `fs.openSync(lockPath, 'wx')` per CONTEXT.md line 139 prescription.
2. Same-PID path keeps `writeFileSync` with documented m11 rationale.
3. Retry budget = 1; pathological churn surfaces as a distinct error message.
4. Standalone worker file instead of inline template string (cross-platform path safety).
5. Winner sleeps 500ms post-acquire so PID liveness path rejects all losers (proves the atomic primitive, not the broader stale-cleanup system).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical test realism] Winner must stay alive for losers to see "live PID" on EEXIST**

- **Found during:** Task 2-2 first test run (all 20 workers exited immediately)
- **Issue:** Plan's worker script calls `process.exit(0)` immediately after `acquireLock`. When a worker exits, its PID becomes dead/reused. Subsequent losers that see EEXIST then run `process.kill(deadPid, 0)` which throws, triggering the dead-PID cleanup path. Result: 5 "winners" in a staggered cascade instead of 1. The test would have been GREEN against the atomic primitive but FAILED assertion, masking the actual semantic we want to prove.
- **Fix:** Winner calls `setTimeout(() => process.exit(0), 500)` so it stays alive through all 20 liveness checks. This is realistic for production (real callers hold the lock for the duration of their SQLite transaction) and proves the atomic primitive specifically, not the dead-PID cleanup fallback.
- **Files modified:** `lib/memory/write-lock-atomic.worker.cjs` (added setTimeout + detailed comment explaining the why)
- **Verification:** 3 consecutive runs, 1 winner / 19 losers each time; Feynman suite 19/19 green.
- **Committed in:** `a0c59c4` (Task 2-2 commit)

**2. [Rule 3 - Spec correction] `SQLite write lock held by PID` acceptance criterion was "2 or more", actual pre/post count is 1**

- **Found during:** Task 2-1 acceptance check
- **Issue:** Plan stated `grep -c "SQLite write lock held by PID"` should return "2 or more (error message preserved)". The pre-patch codebase has only 1 occurrence (in `acquireLock`). `isServerRunning` does NOT throw this error -- it returns a status object `{ running: true, pid: data.pid }`. The "2 or more" was over-specified against the actual pre-existing code.
- **Fix:** Preserved the single error message occurrence (exact byte-for-byte equivalence with pre-patch). Documented the plan's over-specification here so future 87-06 / 87-10 can reference the actual invariant, which is "error message byte-for-byte preserved", not a count >= 2.
- **Files modified:** none (the fix is to the acceptance criterion, not the code)
- **Verification:** `git show HEAD~2:lib/core/write-lock.cjs | grep -c "SQLite write lock held by PID"` = 1 (pre), current = 1 (post). Semantic preserved.
- **Committed in:** N/A (spec clarification, no code change)

**3. [Rule 3 - Minor] Standalone worker file instead of inline template-string workerCode generation**

- **Found during:** Task 2-2 planning review (before writing code)
- **Issue:** Plan's `action` block contains inline `workerCode = \`...require('${path.resolve(...).replace(/\\\\/g, '\\\\\\\\')}')...\`` template-string construction with escaped backslashes. This is a Windows path-escape hazard: the nested `replace` levels compound, and a broken regex on one platform would silently produce a worker that `require`s a path that doesn't exist. Debug would be painful (fork error on Windows CI).
- **Fix:** Created `lib/memory/write-lock-atomic.worker.cjs` as a sibling file. The test `fork()`s it directly. Worker uses `path.resolve(__dirname, '..', 'core', 'write-lock.cjs')` which handles platform path separators natively. Plan's min_lines / concurrency / acceptance criteria all still met.
- **Files modified:** `lib/memory/write-lock-atomic.worker.cjs` (new file)
- **Verification:** Test file grep for `fork|child_process` returns 9 (>= 1 required). Concurrency semantics unchanged. Three-surface tri-polar consideration: CLI/Desktop/Cowork all run Node, all fork equivalently, standalone worker is the most portable path.
- **Committed in:** `a0c59c4` (Task 2-2 commit)

---

**Total deviations:** 3 auto-fixed (1 test-realism, 1 spec-correction, 1 minor cross-platform safety)
**Impact on plan:** All three deviations protect the invariant the plan actually wanted ("atomic acquire proven under concurrency"). No scope creep. Zero new runtime dependencies. CJS only. Feynman suite count grew from 18 -> 19 as required.

## Issues Encountered

None beyond the deviations above. Build/test infrastructure was stable throughout.

## User Setup Required

None. This is a pure internal correctness fix -- no environment variables, no external services, no user-facing configuration.

## Known Stubs

None. `acquireLock`, `releaseLock`, `isServerRunning` all fully wired to real filesystem primitives. No placeholder values, no TODO comments, no mock data.

## CHANGELOG Entry (for v1.10.11)

Recommended entry under `## [1.10.11]` -> `### Fixed`:

```
- Write-lock acquire is now atomic via fs.openSync(lockPath, 'wx') (closes SEC-04, CASCADE-04). Prior existsSync + writeFileSync sequence had a theoretical TOCTOU race that 87-06's indexArtifact transaction would have amplified. The 20-worker concurrency regression fence (lib/memory/write-lock-atomic.test.cjs) wires into the Feynman runner and must stay green across every future release.
```

## Next Plan Readiness

- **87-01 (Cypher sanitization + API key perms + HSI timeout):** Independent, can run in parallel.
- **87-01a (ROOM.md + MINTO.md git hook):** Independent, can run in parallel.
- **87-08 (Localhost live dashboard):** Independent, can run in parallel.
- **87-06 (indexArtifact transaction, v1.10.12 Wave 2):** Now SAFE to run. This plan was its prerequisite -- the BEGIN/COMMIT wrap piggybacks on the atomic lock primitive.

**Wave 1 progress:** 1/4 Stream A plans complete after 87-00 + 87-02.

## Self-Check: PASSED

All artifacts verified on disk:
- FOUND: lib/core/write-lock.cjs
- FOUND: lib/memory/write-lock-atomic.test.cjs
- FOUND: lib/memory/write-lock-atomic.worker.cjs
- FOUND: lib/memory/run-feynman-tests.cjs
- FOUND: .planning/phases/87-security-hardening-cascade-refactor/87-02-SUMMARY.md

All commits verified in git log:
- FOUND: 237f790 (Task 2-1: write-lock.cjs atomic patch)
- FOUND: a0c59c4 (Task 2-2: concurrency test + runner wiring)

All tests verified green:
- node lib/memory/run-feynman-tests.cjs -> 19/19 passed
- node lib/memory/write-lock-atomic.test.cjs (standalone, 3 consecutive runs) -> all 0 exit

---
*Phase: 87-security-hardening-cascade-refactor*
*Plan: 02*
*Completed: 2026-04-19*
