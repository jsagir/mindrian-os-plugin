---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 04
subsystem: infra
tags: [write-lock, concurrency, canon-part-9, trust-integrity, tier-1]

# Dependency graph
requires:
  - phase: 354-01
    provides: "docs/reviews/phase-354-disposition-ledger.md (SYS-02 row), tests/run-all-354.sh, tests/helpers/fixture-room-354.cjs"
provides:
  - "tests/test-354-write-lock-ownership.cjs: real forked-process regression (7 cases A-G: live-holder age immunity, real long write past the stale threshold, crashed-owner recovery, N-way recovery race, old/non-owner release no-ops, same-process nesting, legacy no-handle floor)"
  - "tests/helpers/write-lock-holder-354.cjs: forked child (hold/crash/release-without-acquire/graph-ops modes) giving each case real OS-level process identity"
  - "lib/core/write-lock.cjs: owner-token lock (acquireLock returns { roomDir, token }, owner-aware releaseLock, liveness-only dead-owner recovery under a .recover mutex, explicit breakLock)"
  - "lib/core/write-lock.cjs::breakLock(roomDir, { expectedToken, reason }): new operator-only compare-and-unlink escape hatch, no automatic caller"
affects: [354-16, 354-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-process ownership registry (_held: Map<resolvedRoomPath, { token, depth }>) makes every existing legacy no-handle acquireLock(roomDir)/releaseLock(roomDir) call site keep working unedited, while a handle-aware caller (graph-ops.cjs) gets exact-token release"
    - "Liveness (process.kill(pid, 0)) replaces age as the sole takeover truth; a short-lived '.recover' mutex file (same atomic 'wx' primitive as the lock itself) guarantees exactly one winner recovers a confirmed-dead owner's lock"

key-files:
  created:
    - tests/test-354-write-lock-ownership.cjs
    - tests/helpers/write-lock-holder-354.cjs
  modified:
    - lib/core/write-lock.cjs
    - lib/core/graph-ops.cjs
    - .planning/phases/354-system-integrity-and-theo-integration-independent-research-a/deferred-items.md

key-decisions:
  - "Kept the exact legacy call shape (acquireLock(roomDir)/releaseLock(roomDir), no handle) working for every existing caller (decision-capture.cjs, minto-debouncer.cjs, stamp-artifact-write.cjs, vault-section-minto-generator.cjs, recompile-room-references.cjs) via the in-process _held registry, per the plan's Don't-Hand-Roll instruction -- none of those five files needed an edit"
  - "A live process contending for the .recover mutex against another live recoverer is surfaced as the ORIGINAL dead-owner pid's held error (not the mutex holder's pid), so 9-of-10 racing contenders in the recovery-race case fail with the same predictable message shape acquireLock always uses for contention"
  - "STALE_THRESHOLD_MS is retained only as a documented constant (isServerRunning also now ignores age); no code path compares an age value to it for a takeover or 'running' decision"

requirements-completed: [SYS-02]

# Metrics
duration: 32min
completed: 2026-09-23
---

# Phase 354 Plan 04: Write-Lock Ownership Summary

**Replaced the P1 seam where `lib/core/write-lock.cjs` let a contender steal any lock older than 5 seconds regardless of whether its owner was still alive, and let any non-owner unlink a lock with no token check at all -- an owner-token lock now makes liveness (never age) the sole takeover truth, recovers a confirmed-dead owner's lock through exactly one winner of a `.recover` mutex race, and lets only the current token holder release, verified across 7 cases run through real forked OS processes.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-09-23T09:52:00Z (approx, session read start)
- **Completed:** 2026-09-23T10:24:00Z (Task 2 commit)
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified; 1 append-only deferred-items.md edit)

## Accomplishments

- Wrote `tests/test-354-write-lock-ownership.cjs` (RED-first, commit `d245912b2`): 7 cases
  (A-G) run via `child_process.fork` against a real forked helper
  (`tests/helpers/write-lock-holder-354.cjs`, modes `hold`/`crash`/`release-without-acquire`/
  `graph-ops`) so PID liveness is an OS-level fact, never an in-process fake. Case B holds
  a lock for 5600ms (past the 5000ms `STALE_THRESHOLD_MS`) through a real
  `lib/core/graph-ops.cjs` `enqueueWrite` call. Run against the unfixed `write-lock.cjs`:
  exit 1, cases A, B and E failed exactly as the plan predicted (age takeover, non-owner
  unlink); C and F also failed pre-fix (no dead-owner recovery message or nesting-depth
  concept existed yet, documented in the test's own header); D and G already passed
  (the pre-existing atomic `'wx'` create and same-pid re-acquire already held).
- Rewrote `lib/core/write-lock.cjs` (GREEN, commit `baa5f6b74`): owner-token payload
  (`{ pid, token, host, timestamp, schema: 'owner-token' }`), an in-process `_held` registry
  (`Map<resolvedRoomPath, { token, depth }>`) for nesting and legacy no-handle callers,
  liveness-only takeover decisions (`process.kill(pid, 0)`, age never compared), a
  `_recoverDeadLock` module-private function guarded by a `.recover` mutex file (same
  atomic `'wx'` primitive) so exactly one of any number of racing contenders recovers a
  confirmed-dead owner's lock, an owner-aware `releaseLock` that is a silent no-op for any
  non-owner or stale token, and a new `breakLock(roomDir, { expectedToken, reason })`
  export as the one explicit, operator-only compare-and-unlink escape hatch (no automatic
  caller anywhere in the repo).
- Updated `lib/core/graph-ops.cjs`'s `enqueueWrite` to thread `acquireLock`'s returned
  handle through to `releaseLock(roomDir, handle)`, so its hold-across-await pattern
  releases its own specific token.
- Left all five legacy no-handle callers (`decision-capture.cjs`, `minto-debouncer.cjs`,
  `stamp-artifact-write.cjs`, `vault-section-minto-generator.cjs`,
  `recompile-room-references.cjs`) completely unedited, per the plan's explicit
  instruction; their own test suites (minto-debouncer, recompile-room-references,
  stamp-artifact-write, vault-section-minto-generator-atomic, index-artifact-transaction,
  and 13/14 of decision-capture -- see Deferred Issues) all stayed green.
- Re-ran `docs/reviews/phase-354-probes/persistence.cjs`: the `locks()` section now
  throws `Error: SQLite write lock held by PID <foreign pid>` instead of printing a
  `replacementPid` equal to its own pid -- direct evidence the live-lock-takeover finding
  no longer reproduces.
- All required verify commands green: `tests/test-354-write-lock-ownership.cjs` (18/18
  checks across cases A-G), `lib/memory/write-lock-atomic.test.cjs` (20 forked workers,
  exactly 1 winner, same-PID re-acquire, post-release re-acquire via the new dead-owner
  recovery path), `minto-debouncer.test.cjs` (12/12), `recompile-room-references.test.cjs`
  (10/10), `stamp-artifact-write.test.cjs` (6/6), `vault-section-minto-generator-atomic.test.cjs`
  (7/7), `index-artifact-transaction.test.cjs`, `scripts/check-substrate.cjs --diff` (clean),
  `bash tests/run-all-354.sh` (`PASSED=4 FAILED=0 SKIPPED=14`).

## Task Commits

1. **Task 1: Failing multi-process regression for lock ownership** - `d245912b2` (test)
2. **Task 2: Owner-token lock with liveness-only recovery, owner-aware release and graph-ops handle** - `baa5f6b74` (feat)

**Plan metadata:** pending (this commit, docs: complete plan)

## Files Created/Modified

- `tests/test-354-write-lock-ownership.cjs` - 7-case real-forked-process regression
  pinning the ownership rules (live-holder age immunity, real long write past the stale
  threshold, crashed-owner recovery, N-way recovery race, old/non-owner release no-ops,
  same-process nesting, legacy no-handle floor)
- `tests/helpers/write-lock-holder-354.cjs` - forked child (`hold`/`crash`/
  `release-without-acquire`/`graph-ops` modes) giving each case real OS-level process
  identity
- `lib/core/write-lock.cjs` - owner-token payload, `_held` registry, liveness-only
  takeover, `_recoverDeadLock` + `.recover` mutex, owner-aware `releaseLock`, new
  `breakLock` export
- `lib/core/graph-ops.cjs` - `enqueueWrite` threads the acquired handle through to
  `releaseLock`
- `.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/deferred-items.md` -
  appended the pre-existing `decision-capture.test.cjs` Test 12 archive-overflow finding
  (354-02's and 354-03's entries preserved, not overwritten)

## Decisions Made

- Followed the plan's exact ownership-rule order (corrupt -> recover; same-pid same-host
  -> adopt; different host -> fail closed; same host alive -> held; same host dead ->
  recover) rather than inventing an alternative liveness model.
- Kept the legacy no-handle call shape working for all five existing callers via the
  in-process `_held` registry instead of editing any of them, per the plan's Don't-Hand-
  Roll instruction.
- A live process losing the `.recover` mutex race is surfaced with the ORIGINAL dead
  owner's pid in its held error (not the mutex winner's pid) -- keeps the error message
  shape consistent with every other contention path in `acquireLock`.

## Deviations from Plan

None - plan executed exactly as written. Task 1 was authored and run RED before any fix
code was written (exit 1, cases A/B/E failing as predicted). Task 2 implemented exactly
the payload shape, registry design, recovery-mutex protocol, release semantics and
`breakLock` contract the plan specified.

## Issues Encountered

- `lib/memory/decision-capture.test.cjs` Test 12 ("special-char section name handled via
  path.join + safe escape") failed at line 618 (`archive partition should exist`) during
  Task 2 verification, one of the plan's own required `<verify>` commands. Root-caused
  before treating it as a regression: temporarily reverted both files this task modified
  (`git checkout -- lib/core/write-lock.cjs lib/core/graph-ops.cjs`, the same sanctioned
  targeted-file-discard idiom 354-02/354-03 used, not a blanket reset), re-ran the same
  test, and got the byte-identical failure and stack trace. Restored the Task 2 edits from
  a saved copy, confirmed `tests/test-354-write-lock-ownership.cjs` still green (18/18)
  and `write-lock-atomic.test.cjs` still green, then logged the finding to
  `deferred-items.md` per the executor's scope-boundary discipline rather than fixing an
  out-of-scope archive-overflow bug in `decision-capture.cjs`'s own partitioning logic.
- One benign peer-session collision during Task 1's commit: staging `git add` for this
  task's two new files landed cleanly, but before this session's own `git commit` ran, a
  concurrent peer session's `git commit` (an unrelated `docs(355)` change) swept up this
  session's already-staged files into its own commit (the index is shared across
  concurrent sessions in one working tree; staging happens before the peer's commit, so
  naming exact paths on `git add` alone does not fully prevent this). Caught immediately
  via `git show --stat` on the resulting commit. Corrected via `git reset HEAD~1` (mixed,
  index-only -- the same recovery idiom this plan's own instructions and the 354-03
  precedent both document), which restored the peer's file to its pre-commit
  unstaged-modified state without altering its content, then re-committed the peer's file
  alone with its own original message (byte-identical diff, new hash since the parent
  commit differs), then committed this task's two files separately with an explicit
  `git commit -- <path> <path>` pathspec (an extra safeguard beyond staging alone). No
  peer content was lost or altered at any point; both commits are clean and correctly
  attributed.

## Known Stubs

None - this plan touches only lock/concurrency logic and test files, no UI or
data-rendering surface.

## Threat Flags

None - both mitigations named in the plan's threat model (T-354-05 age never displaces a
live owner; T-354-06 compare-token-then-unlink; T-354-07 `.recover` mutex race safety)
are implemented exactly as scoped. T-354-08 (accept: a live owner is never displaced
automatically) and T-354-08b (accept: a forged cross-host lock can only block writes,
never cause two writers) hold as designed -- `acquireLock` fails closed on a
cross-host claim rather than attempting to prove liveness it cannot verify. No new
network endpoint, auth path, or schema change was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SYS-02 fully closed: this is its sole owning plan per REQUIREMENTS.md's SYS-02 row
  ("Plan 354-04"), confirmed before running `requirements mark-complete SYS-02`.
- Wave 2 is now fully closed (354-02 gate subject promotion, 354-03 chain resume
  identity, 354-04 write-lock ownership all landed independently, none touching a
  shared file).
- The pre-existing `decision-capture.test.cjs` Test 12 archive-overflow failure (see
  Issues Encountered and `deferred-items.md`) is NOT gating this plan's close, but
  should be picked up by whichever future session next touches
  `lib/core/decision-capture.cjs`'s archive-partitioning logic or a dedicated
  `/gsd-debug` session if it blocks a release gate before then.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files verified present on disk (tests/test-354-write-lock-ownership.cjs,
tests/helpers/write-lock-holder-354.cjs, lib/core/write-lock.cjs, lib/core/graph-ops.cjs,
deferred-items.md, this SUMMARY.md). Both task commits (`d245912b2`, `baa5f6b74`) verified
present in `git log --oneline --all`.
