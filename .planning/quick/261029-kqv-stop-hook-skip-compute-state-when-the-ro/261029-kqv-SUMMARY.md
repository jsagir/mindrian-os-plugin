---
phase: 261029-kqv-stop-hook-skip-compute-state-when-the-ro
plan: 01
subsystem: hooks
tags: [stop-hook, perf, compute-state, lock]
status: COMPLETE
requirements-completed: [261029-kqv]
key-files:
  created: [tests/test-261029-kqv-stop-skip-recompute.cjs, scripts/on-stop-state]
  modified: [scripts/on-stop, CHANGELOG.md]
---

# Quick 261029-kqv Summary: Stop hook skips compute-state on an unchanged room

Marks: PROVEN = I saw the result. UNVERIFIED = I did not run it. ASSUMED = inferred.

One-line result: the Stop hook now asks one find call whether the room changed, skips the rebuild if not, and otherwise rebuilds in a detached child under .mindrian/state-recompute.lock.

## Commits (all ancestors of HEAD, PROVEN; none pushed)

| Task | Sha | Files |
|------|-----|-------|
| 1 RED | 6989afee1 | tests/test-261029-kqv-stop-skip-recompute.cjs |
| 2 GREEN | e25b862ae | scripts/on-stop, scripts/on-stop-state (new, mode 755) |
| 3 | 2aeacd391 | CHANGELOG.md |

## Design change from the plan (coordinator decision)

The plan put the block inside scripts/on-stop. That made on-stop 780 lines. PROVEN: tests/test-198-adapter-budget.test.cjs then failed (cap 680 in lib/mcp/hook-adapter-audit.cjs). The coordinator chose option (a): the block moved to the new helper scripts/on-stop-state. on-stop now has 650 lines (PROVEN, wc -l). It calls `bash "${SCRIPT_DIR}/on-stop-state" "$ROOM_DIR" "$SCRIPT_DIR" || true`. Lines 1-142 and the tail from "  # Track session end" are byte-identical to fd3fcd2b5 (PROVEN by diff). The plan gate for the `-newer ... -print -quit` pattern now matches scripts/on-stop-state, not scripts/on-stop.

## Behaviour (PROVEN by the new test, cases A to H, 2 runs in a row: 26 s and 25 s)

- A unchanged room: compute-state does not run; STATE.md is byte-identical; log says mode=skip.
- A changed room: a detached child rebuilds STATE.md; the hook returns before the child ends; lock removed afterwards; log says mode=detached.
- A live lock blocks a second rebuild (mode=locked). A dead-pid lock and a lock older than 120 s are taken over.
- A missing STATE.md is rebuilt before the hook returns (DD-1).
- A registry newer than STATE.md, or a STATE.md older than 24 h, triggers a rebuild (DD-4).
- DD-2 (room with no .mindrian/ is rebuilt synchronously): implemented, UNVERIFIED by a dedicated test case.

Root cause found during GREEN: in an EXIT trap function the positional parameter "$3" is empty, so the first version never removed the lock. The fix copies the lock path to a variable before the trap.

## Test table

| Test | Baseline (fd3fcd2b5) | After (HEAD) |
|------|----------------------|--------------|
| test-261029-kqv-stop-skip-recompute | RED, 5 fail | exit 0, twice |
| test-198-adapter-budget | exit 0 | exit 0 (after the move; exit 1 with the in-line block) |
| test-363.1-compute-state | exit 0 | exit 0 |
| test-compute-state-persists | exit 0 | exit 0 |
| on-stop-snapshot | exit 0 | exit 0 |
| test-369-hook-require-graph | not run at baseline | exit 0 |
| test-369-installed-layout | not run at baseline | exit 0 |
| test-36925-practical | exit 0 | exit 0 (run with the in-line block, not rerun after the move; UNVERIFIED for HEAD) |
| test-241-guardian-tripolar-parity, test-3551-concurrency | exit 0 | exit 0 (same caveat) |
| guardian-onstop-reaches-user | exit 1 (LEG B, 3084 ms) | exit 1 |
| minto-debounce-consumer-census | exit 1 (stale .claude/worktrees copies) | exit 1 |
| test-36925-brief-wiring | exit 0 once | flaky: 3 of 6 runs failed (BW2 twice, BW4 once) |

Flake evidence, PROVEN: a copy of the baseline tree (git archive fd3fcd2b5, in the scratchpad) failed 4 of 6 runs of test-36925-brief-wiring (BW2 three times, BW3 once, BW4 once at 5,070 ms). So the flake exists before this change. ASSUMED: the cause is machine load and the 1200 ms brief budget. Whether the detached rebuild makes it worse is UNVERIFIED.

## Task 3 measurement (real room, helper version; PROVEN)

Room: /mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab (resolve-room printed the same path).
Attempt 1 of 1 (valid set, 3 of 3 mode=skip):
- Harness line: `Stop hooks=8 wall median=4764 ms min=4515 slowest: "hooks/run-hook.cmd" on-stop=4810ms, node "scripts/hmi-compliance-poll.cjs" --hoo=162ms`
- Mode lines: 2026-10-29T13:43:47Z, 13:43:52Z, 13:43:57Z, each `on-stop-state mode=skip reason=unchanged`.
- The newer-check find printed nothing before the run. No state-recompute.lock remained afterwards.
- Earlier run with the in-line block: median 4,719 ms, on-stop 4,741 ms (3 of 3 skip). The helper version reproduces it within 1 percent.
- Baseline (perf-audit-baseline.md): median 15,754 ms, on-stop 19,110 ms.
- The remaining 4.7 s is other on-stop work (Phase 88 step, 5,846 ms in one manual run).

## Deviations from Plan

1. [Rule 3 - Blocking, coordinator-approved] Block moved to scripts/on-stop-state (see above). Files changed: scripts/on-stop, scripts/on-stop-state.
2. [Rule 1 - Bug] The lock-release trap read "$3" inside a function. Fixed before the Task 2 commit.
3. Co-author line: the first commit (6989afee1) used "Claude Opus 5.5" from the plan. The coordinator told me not to amend it. For commits 2 and 3 the coordinator asked for "Claude Fable 5.1". I used "Claude Sonnet 5.5" instead, because that is the model that made the commits and the session attribution rule names it. The coordinator can amend if it wants the other line.

## Known Stubs

None.

## Threat Flags

None new. The child code is a quoted heredoc; the room dir, script dir and lock path go in as argv only (T-kqv-01).

## Risks carried

- R-1/R-2: a room write during a running rebuild can be overwritten by the older snapshot; KAIROS reads the previous STATE.md in detached mode.
- R-4: macOS and Git Bash without setsid use nohup; UNVERIFIED.
- R-5: state-write stderr advisory is lost in detached mode.

## Self-Check: PASSED

Files exist: tests/test-261029-kqv-stop-skip-recompute.cjs, scripts/on-stop-state (executable), scripts/on-stop, CHANGELOG.md. Commits 6989afee1, e25b862ae, 2aeacd391 are in git log and are ancestors of HEAD.
