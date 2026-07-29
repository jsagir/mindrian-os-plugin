---
phase: 238-decision-gates
plan: 05
subsystem: infra
tags: [concurrency, file-locking, toctou, atomic-write, fork-testing, card-fire]

# Dependency graph
requires:
  - phase: 238-01
    provides: "tests/helpers/cardfire-hermetic-238.cjs, tests/test-238-retry-counter-fence.worker.cjs, tests/run-all-238.sh (leg pre-declared)"
provides:
  - "scripts/check-card-fire.cjs writeRetryStore: tmp-and-rename atomic write (torn-read fix)"
  - "scripts/check-card-fire.cjs withRetryStoreLock: bounded-wait fence around the retry-store read-modify-write (lost-update fix), backed by a LOCAL purpose-built lock, not lib/core/write-lock.cjs"
  - "tests/test-238-retry-counter-fence.cjs: 20-process exact-count proof (leg A), concurrent-reader torn-read proof (leg B), session-counter sibling proof (leg C), anti-vacuity control (leg D)"
affects: [238-06, 238-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic lock creation via write-then-link (fs.writeFileSync to a unique temp path, then fs.linkSync onto the final name) instead of open('wx')-then-separately-write, closing a TOCTOU window where a concurrent reader can observe empty/partial lock content"
    - "Inode-verified lock cleanup: before removing a lock judged corrupt/stale/dead-PID, open it, fstat it, and only unlink if the inode still matches what was read -- prevents a slow contender from destroying a fresher, valid lock a faster contender already created"
    - "D-12 degrade-on-exhaustion: a bounded-wait fence that falls through to an unfenced read-modify-write rather than dropping an increment, so the change can never be worse than pre-fix behavior on any path"

key-files:
  created:
    - tests/test-238-retry-counter-fence.cjs
  modified:
    - scripts/check-card-fire.cjs

key-decisions:
  - "DEVIATION from D-05: D-05 called for reusing lib/core/write-lock.cjs's acquireLock/releaseLock UNCHANGED. Adversarial testing (20 forked processes x 10 sequential acquire/release cycles each, not the single simultaneous-storm shape Phase 87-02's own precedent test exercises) found a real TOCTOU race in that shared primitive: its create step is open-then-SEPARATELY-write (empty-content window), and its corrupt/stale/dead-PID cleanup branches unconditionally unlink whatever is currently at the lock path without verifying it is still the file that was read. Measured: repeated 20x10 runs against the unmodified primitive landed 148-197 of 200, never a reliable 200, with zero fence-exhaustion events (a true double-hold, not a wait-budget problem). lib/core/write-lock.cjs is NOT modified -- it is shared by other subsystems (SQLite write-safety) and correctly fixing its cleanup protocol is real distributed-systems work belonging to a dedicated follow-up. The retry-store fence instead uses a LOCAL, purpose-built lock (write-then-link create + inode-verified cleanup), confined entirely to scripts/check-card-fire.cjs, empirically verified exact across 24+ consecutive 20x10 runs."
  - "Tuned RETRY_LOCK_MAX_ATTEMPTS from the plan's example 50 (~1s) to 300 (~6s): the smaller budget produced occasional D-12 degrade-to-unfenced exhaustions under real 20-way contention (safe but not exact); 300 attempts eliminated exhaustion across every trial run while staying ~100x inside the real 600s Stop-hook budget verified by Phase 241."

requirements-completed: [GATE-03]

# Metrics
duration: ~90min
completed: 2026-07-29
---

# Phase 238 Plan 05: Retry-Counter Torn-Read + Lost-Update Fence Summary

**Atomic tmp-and-rename write plus a self-contained (not lib/core/write-lock.cjs) bounded-wait fence around scripts/check-card-fire.cjs's shared retry counter, closing a measured 197-of-200 lost-update defect and a torn-read defect, proven by a 20-forked-process exact-count test.**

## Performance

- **Duration:** ~90 min (includes root-causing and empirically fixing a second, deeper concurrency defect discovered mid-task in a shared dependency)
- **Completed:** 2026-07-29
- **Tasks:** 3/3 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `writeRetryStore` now writes via a temp file plus `renameSync` in the same directory as the target (mirrors `lib/core/card-fire-sidechannel.cjs::writeStoreAtomic`), so a concurrent reader can never observe a partial/half-written `card-fire-retries.json`.
- `bumpRetryCount`, `clearRetryCount`, `bumpSessionCount`, `clearSessionCount` are routed through `withRetryStoreLock`, a bounded-wait fence with the store read moved INSIDE the lock.
- `tests/test-238-retry-counter-fence.cjs` proves, via `child_process.fork` (true OS-level concurrency): leg A -- 20 processes x 10 bumps land exactly 200; leg B -- a concurrent reader loop (tens of thousands of reads per run) sees zero torn/unparseable reads; leg C -- the `__session__:` key space survives the same concurrency (8 x 5 = 40 exact); leg D -- a single uncontended child lands exactly 10.
- Mutation gate performed by hand: removing the fence wrapper from `bumpRetryCount` reproduced the defect live (observed count **19 of 200**), then the file was restored byte-identically (verified via `diff`) before committing.
- **Root-caused and fixed a second, deeper concurrency defect** discovered while implementing Task 2: the plan's D-05-mandated `lib/core/write-lock.cjs::acquireLock/releaseLock` primitive has a genuine TOCTOU race under this file's high-frequency reacquire pattern (not the single-storm pattern its own Phase 87-02 test proves). See Deviations below for the full root-cause chain and fix.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the retry-store write atomic** - `4d26ff76` (fix)
2. **Task 2: Fence the read-modify-write with a bounded wait** (initial version, using `lib/core/write-lock.cjs`) - `a9a9c064` (fix)
3. **Task 2 (revised, after discovering the shared-primitive race) + Task 3: local lock design + the 20-process proof test** - `3cfe3c0c` (fix)

_No plan-metadata commit per this plan's explicit brief: STATE.md/ROADMAP.md are NOT touched by this executor; the orchestrator owns those writes centrally after all 8 plans in this phase complete._

## Files Created/Modified
- `scripts/check-card-fire.cjs` - `writeRetryStore` converted to tmp-and-rename; `withRetryStoreLock` (bounded-wait fence, D-12 degrade-on-exhaustion) added and wired through `bumpRetryCount`/`clearRetryCount`/`bumpSessionCount`/`clearSessionCount`; the fence uses a local `acquireRetryLock`/`releaseRetryLock` pair (write-then-link atomic create + inode-verified cleanup), not `lib/core/write-lock.cjs`
- `tests/test-238-retry-counter-fence.cjs` - the 20-process exact-count proof (legs A-D), forking 238-01's `tests/test-238-retry-counter-fence.worker.cjs`

## Decisions Made

**D-05 deviation (the significant one -- read this in full).** The plan's D-05 mandated reusing `lib/core/write-lock.cjs`'s `acquireLock`/`releaseLock` unchanged, on the stated rationale that Phase 87-02 "already closed the TOCTOU race." That rationale is true for the specific shape Phase 87-02's own precedent test proves (20 processes racing to acquire ONCE, simultaneously) but does not hold for this plan's actual usage shape (20 processes each doing 10 SEQUENTIAL acquire/release cycles -- 200 total lock transitions under sustained contention).

Root-cause chain, established with a custom nanosecond-precision trace (`process.hrtime.bigint()` on every ACQUIRE/RELEASE boundary across all 20 children, correlated against the actual counter writes):
1. Wired the plan's own bounded-wait design (Task 2 as originally written) around the unmodified `acquireLock`/`releaseLock`. Result: 148-197 of 200, never reliably 200, with **zero** fence-exhaustion events logged -- proving the loss was a true double-hold, not a wait-budget problem.
2. Traced two children's ACQUIRE/RELEASE windows and found them genuinely overlapping (process B's critical-section start fell strictly inside process A's still-open critical-section window), with nanosecond timestamps captured independently in two different log streams agreeing on the overlap.
3. Isolated the mechanism: `acquireLock`'s create step is `fs.openSync(lockPath, 'wx')` followed by a SEPARATE `fs.writeSync` -- a reader hitting `EEXIST` in between can observe an empty file and misclassify it as corrupt. Its corrupt/stale/dead-PID cleanup branches then call `fs.unlinkSync(lockPath)` unconditionally, based on a snapshot read, with no re-verification that the file at that path is still the one that was read. A slow contender's cleanup can therefore destroy a DIFFERENT, already-valid lock a faster contender just created, letting both proceed believing they hold exclusive access.
4. Built and discarded two intermediate fixes that each introduced a new problem of their own (a naive write-then-link on every attempt added so much I/O overhead under contention it made results worse; a rename-then-delete cleanup without inode verification still raced on content it never re-checked) before landing on the design that ships here: atomic write-then-link creation (no empty-content window, ever) plus inode-verified cleanup (open the file, `fstat` it, unlink only if the inode still matches what was read).
5. Verified the final design across 24+ consecutive 20-process x 10-bump runs: exact 200 every time, zero exceptions.

`lib/core/write-lock.cjs` itself is **not modified**. It is shared by other subsystems (SQLite write-safety) outside this plan's declared file scope (`files_modified: scripts/check-card-fire.cjs, tests/test-238-retry-counter-fence.cjs`), and correctly hardening its cleanup protocol for high-frequency reacquire patterns is real, careful distributed-systems work that deserves its own dedicated review rather than a fix folded into this plan under time pressure. The retry-store fence instead uses a local, purpose-built lock confined entirely to `scripts/check-card-fire.cjs`.

**Bounded-wait sizing tuned.** The plan's own example sizing (50 attempts x 20ms, ~1s) produced occasional D-12 degrade-to-unfenced exhaustions under the measured 20-way contention (2-3 per run when it happened) -- safe (never worse than pre-fix) but not exact, so it failed the plan's own hard exact-count acceptance bar. Widened to 300 attempts (~6s worst case), verified exhaustion-free and exact across every trial. 6s is still roughly 100x inside the real 600-second Stop-hook timeout Phase 241 verified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, escalated via Rule 4 reasoning documented above] Real TOCTOU race in `lib/core/write-lock.cjs` under high-frequency reacquire, worked around locally rather than patched in place**
- **Found during:** Task 2/3 (implementing and testing the bounded-wait fence)
- **Issue:** The plan's D-05-mandated shared lock primitive loses mutual exclusion under 20-process x 10-cycle real contention (148-197 of 200 landed, no exhaustion), due to a create-step empty-content window plus unconditional (non-verified) cleanup unlinks in the shared module.
- **Fix:** Did NOT modify `lib/core/write-lock.cjs` (out of file scope, shared by other subsystems). Instead implemented a local, purpose-built lock (`acquireRetryLock`/`releaseRetryLock`) inside `scripts/check-card-fire.cjs` using write-then-link atomic creation and inode-verified cleanup, wired into the same `withRetryStoreLock` bounded-wait shape the plan specified.
- **Files modified:** `scripts/check-card-fire.cjs`
- **Verification:** 24+ consecutive 20-process x 10-bump runs, exact 200 every time; `tests/test-238-retry-counter-fence.cjs` leg A passes reliably (also re-run 10 additional times standalone, 10/10 green); mutation gate reproduces the pre-fix defect (observed 19/200) and restores cleanly.
- **Committed in:** `3cfe3c0c`

**2. [Rule 3 - Blocking, tuning] Widened `RETRY_LOCK_MAX_ATTEMPTS` from 50 to 300**
- **Found during:** Task 3 verification (running the new test repeatedly)
- **Issue:** The plan's example sizing (50 x 20ms) occasionally exhausted under real 20-way contention, degrading to an unfenced write (D-12, safe) but breaking the exact-count acceptance criterion.
- **Fix:** Widened to 300 attempts (~6s worst case, still ~100x inside the real 600s Stop-hook budget).
- **Files modified:** `scripts/check-card-fire.cjs`
- **Verification:** Zero exhaustions and exact 200 across every trial run after the change.
- **Committed in:** `3cfe3c0c`

---

**Total deviations:** 2 auto-fixed (1 significant shared-dependency bug worked around locally, 1 tuning adjustment). Both were necessary to meet this plan's own hard exact-count acceptance criteria; neither expands scope beyond `scripts/check-card-fire.cjs` and `tests/test-238-retry-counter-fence.cjs`.

## Mutation Gate Transcript (required by acceptance criteria)

- Removed the `withRetryStoreLock(...)` wrapper from `bumpRetryCount` (reverted the function to call its inner logic directly, unfenced).
- Ran `node tests/test-238-retry-counter-fence.cjs`: leg A failed red. **Observed count: 19** (expected 200). Verbatim assertion message: `leg A: expected EXACTLY 200 (WORKERS=20 * BUMPS_PER_WORKER=10), got 19`.
- Restored `scripts/check-card-fire.cjs` from a pre-mutation backup copy; confirmed byte-identical via `diff` (no output, i.e. identical) before re-running.
- Re-ran `node tests/test-238-retry-counter-fence.cjs`: all 6 assertions pass, `PASS test-238-retry-counter-fence`.
- `git diff --stat scripts/check-card-fire.cjs` immediately before the Task 2/3 commit showed only the intended, committed changes (the mutation was never staged or committed).

## Issues Encountered

- **`tests/test-209-room-pick-sensor.cjs` fails pre-existing, out of scope.** `bash tests/run-all-209.sh` reports `PASS=8 FAIL=1`; the failing leg is `209-05 room-pick sensor (E5)`, unrelated to card-fire or the retry store. Confirmed the test file is byte-identical to its state before this plan's commits and contains zero references to `check-card-fire` or `write-lock`. Not fixed here (Scope Boundary rule); logged to `.planning/phases/238-decision-gates/deferred-items.md`.
- Root-causing the shared `write-lock.cjs` race (see Decisions above) took the majority of this plan's time. This was necessary, not optional: without it, the plan's own hard acceptance criterion (exact 200, not "close to 200") could not be met using the D-05-mandated approach, and the honest alternative (leaving the fence exhaustively lossy) would have shipped GATE-03 half B unresolved under real contention.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/check-card-fire.cjs`'s retry-store half is left in a clean, mergeable state for **238-08**, which layers its own GATE-04 backstop-tuning change onto the SAME file later in this wave sequence -- nothing outside the lost-update/torn-read scope (counter accessors, `writeRetryStore`, the new lock helpers) was touched, and none of the classifier functions (`ASCII_BOX_UNCONDITIONAL_RE`, `computeBackstopHit`, `classifyCardFire`, `deriveTurnSignals`) were modified.
- `lib/mcp/stop-gate-handler.cjs` (the second production writer) inherits this fix with zero edits, as designed -- it drives the same exported `bumpRetryCount`/`bumpSessionCount`/`readRetryCount`/`readSessionCount` accessors.
- `bash tests/run-all-238.sh` shows this plan's leg (`238-05 retry counter fence (GATE-03 B)`) PASSED; `238-07/08` stays RED by design until 238-08 lands; `238-06`'s two legs stay SKIPPED until that plan lands.
- **Flag for whoever picks up `lib/core/write-lock.cjs` next:** this plan found and worked around (without patching) a real correctness bug in that shared primitive under high-frequency reacquire patterns. The root-cause chain and a verified-correct design (write-then-link create + inode-verified cleanup) are fully documented in this file and inline in `scripts/check-card-fire.cjs`'s `withRetryStoreLock` comment block, and should transfer directly if `write-lock.cjs` itself is ever hardened for this usage class.

---
*Phase: 238-decision-gates*
*Completed: 2026-07-29*
