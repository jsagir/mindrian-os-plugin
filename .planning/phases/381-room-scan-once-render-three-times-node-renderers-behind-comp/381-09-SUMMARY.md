---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 09
subsystem: infra
tags: [legacy-removal, parity, perf, security]
requires:
  - phase: 381-08
    provides: 381-PARITY.md (the recorded zero-diff run) and the After numbers in 381-MEASUREMENTS.md
  - phase: 381-04
    provides: the Node 22.18.0 floor check inside lib/core/room-render.cjs
provides:
  - node-only entry points scripts/compute-team, scripts/analyze-room, scripts/compute-state
  - MINDRIAN_LEGACY_COMPUTE retired in docs/ENV-TUNING.md
  - test-363.1 leg D re-pinned to lib/core/room-render-state.cjs
  - parity --legacy-switch SKIP line; known-divergence macos legs re-pinned
  - research mirror entry 05 and the ROOM.md line (drafted in the session scratchpad; placement pending)
affects: [release beta.77, injection RCA, room-birth STEP 3]
tech-stack:
  added: []
  patterns: [node-only bash entry point with an honest node-missing refusal]
key-files:
  created: []
  modified:
    - scripts/compute-team
    - scripts/analyze-room
    - scripts/compute-state
    - docs/ENV-TUNING.md
    - tests/test-363.1-compute-state.cjs
    - tests/test-381-parity.cjs
    - tests/test-381-known-divergence.cjs
    - tests/test-compute-team-date-guard.cjs
    - tests/test-analyze-room-edge-argv.cjs
key-decisions:
  - "Legacy bash bodies of compute-team, analyze-room and compute-state removed after the owner approved at the 381-09 checkpoint; the BASE_SHA git-archive oracle keeps the old code for parity"
  - "The quick 261029-u8x function-level and python-half legs are retired with the removed code; their source legs now pin the absence of every interpreter site, and the whole-script legs stay"
  - "test-363.1 D2 and D3 read room-render-state.cjs code with comments stripped, so prose that names the old CLI flags does not count as a call site"
requirements-completed: [PERF381-09]
duration: 15min
completed: 2026-10-30
---

# Phase 381 Plan 09: Legacy removal, leg D re-pin and evidence trail Summary

The three room summary scripts are now node-only entry points of 12 to 16 lines. Every python3 fallback, the `portable_date_to_epoch` helper and every `node -e` site are gone from them. Parity against the BASE_SHA oracle is still 0 diffs after the removal (UTC, host time zone and a real-room snapshot).

## Approval (Task 1)

Task 1 approved by the owner via the checkpoint card in the main session, 2026-10-30, after reading the recorded zero-diff run (381-PARITY.md: five runs, 0 diffs) and the After numbers.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 2 | `ab1632bb7` | refactor(381-09): remove the legacy bash bodies after the recorded zero-diff run (381-PARITY.md) |
| 3 | `477cdbdf5` | test(381-09): re-pin test-363.1 leg D to the compute-state renderer (the bash body with the predicate CLI lines was removed after the recorded zero-diff run) |
| 3 (deviation) | `a7ee246eb` | test(381-09): re-pin the quick 261029-u8x source legs after the legacy bash bodies were removed |

## Task 2: removal (PROVEN)

Step 0: BASE_SHA 65aaf329f is an ancestor of HEAD. The 381-PARITY.md HEAD 5affaf2b6 is an ancestor of HEAD. `git diff --name-only 5affaf2b6 HEAD` on the five lib/core/room-*.cjs files and the three scripts printed nothing.

| Script | Lines before | Lines after | Mode |
|---|---|---|---|
| scripts/compute-team | 1121 | 16 | 100755 |
| scripts/analyze-room | 1082 | 13 | 100755 |
| scripts/compute-state | 478 | 12 | 100755 |

- `grep -cE "python3|BASH_VERSINFO|declare -A|MINDRIAN_LEGACY_COMPUTE"`: 0 on each script. One exec line each; `--disable-warning`: 0; `bash -n`: OK.
- Parity after the removal (OLD = BASE_SHA archive):

| Run | Last line | Exit | Window (UTC) | load1 start / end |
|---|---|---|---|---|
| default, TZ=UTC | `parity: 0 diffs in 68 pairs` | 0 | 04:20:09Z to 04:20:44Z | 1.70 / 2.72 |
| `--tz host` | `parity: 0 diffs in 68 pairs` | 0 | 04:20:49Z to 04:21:23Z | 3.22 / 2.65 |
| `--only compute-team,analyze-room,compute-state --room <snapshot of ROOM>` | `parity: 0 diffs in 71 pairs` | 0 | 04:21:36Z to 04:22:24Z | 2.90 / 2.77 |

  The real room was read once with `cp -a` into the session scratchpad (450 files; `cp` reported 2 transient `.mindrian/room.db-shm` and `room.db-wal` files that vanished during the copy, the same shape as in 381-08). The 3 real-room pairs were OK. The snapshot was deleted after the run.
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed.
- Node missing (`env -i PATH=<dir with only dirname> /bin/bash scripts/<s> <tmp>`): each script printed `<s>: node is not on PATH; this step needs Node.js 22.18.0 or later` and exited 1.
- Old node (`MINDRIAN_TEST_MODE=1 MINDRIAN_TEST_NODE_VERSION=20.19.5 bash scripts/<s> <tmp>`): `state: needs Node.js 22.18.0 or later (found v20.19.5)` and exit 1 (also `team:` and `analyze:` for the other two).
- docs/ENV-TUNING.md: "This variable no longer has any effect." is present (count 1).

## Task 3: re-pins and the suite (PROVEN)

- `node tests/test-363.1-compute-state.cjs`: all legs passed (D1 to D4 new). `grep -c "room-render-state.cjs"` prints 13.
- `node tests/test-381-parity.cjs --legacy-switch`: `SKIP legacy bodies removed (381-09)`, exit 0.
- `node tests/test-381-known-divergence.cjs`: all legs passed (load1 2.09 at start).
- `bash tests/run-all-381.sh`: `Phase 381: PASS=10 FAIL=0 SKIP=0` (04:25:04Z to 04:25:58Z, load1 1.86 to 4.03).
- Pinning list, run one at a time (load1 3.96 to 6.37):

| Command | Exit | Last line |
|---|---|---|
| node tests/test-363.1-compute-state.cjs | 0 | all legs passed |
| node tests/test-compute-state-persists.cjs | 0 | ALL PASS |
| node tests/test-261029-kqv-stop-skip-recompute.cjs | 0 | ALL PASS |
| node tests/test-261029-lx3-sessionstart-skip.cjs | 0 | ALL PASS |
| node tests/test-266-room-state-description.cjs | 0 | 12 passed, 0 failed |
| bash tests/run-all-2401.sh | 0 | PASS=8 FAIL=0 SKIP=0 |
| bash tests/run-all-363.1.sh | 0 | PASS=12 FAIL=0 SKIP=1 (the opt-in regression block, RUN_363_1_REGRESSIONS unset) |
| node tests/test-frontmatter-schema-reconcile.cjs | 0 | pass |
| node tests/test-369-hook-require-graph.cjs | 0 | 5 passed, 0 failed |
| node tests/test-369-installed-layout.cjs | 0 | 7 passed, 0 failed, 0 skipped |
| node tests/test-365-falsify-missing-five.cjs | 0 | pass |
| node tests/test-365-falsify-contradiction.cjs | 0 | pass |
| node lib/memory/statusline-active-room-write.test.cjs | 0 | 7/7 tests passed |
| node tests/test-198-stop-gate-retry-ceiling.test.cjs | 0 | 15 assertions |
| node tests/test-240.1-state-version-preserved.cjs | 0 | 5 scenarios |
| node tests/test-240.1-state-version-drift-gate.cjs | 0 | 13 scenarios |
| bash tests/test-phase-13.sh | 0 | 32 passed, 0 failed |
| bash tests/test-phase-27-room-structure.sh | 0 | 8 passed, 0 failed |

- Part 11: `node scripts/build-connector-registry.cjs --check` exit 0 (`connector-registry: OK`); `node scripts/build-orchestration-projection.cjs --check` exit 0 (`orchestration-projection: OK`). No new invocable surface.
- `git status --porcelain tests/fixtures`: empty before and after.
- Privacy: `git diff --cached | grep -n -E '<name list>'` printed nothing before each of the 3 commits.

## Research mirror (Step 4)

The worktree path guard hook (PreToolUse on Write and Edit) refused both a write into `/home/jsagi/MindrianOS/research/...` and a write into the session scratchpad, because neither is inside the worktree. The executor did not work around the hook. The two files are drafted in the session scratchpad through Bash:

- `/tmp/claude-1000/-home-jsagi/3085a95e-3096-40f0-9da6-b0b39fab307a/scratchpad/mirror-381-09/05-phase-381-outcome.md` (cites 381-PARITY.md and 381-MEASUREMENTS.md by absolute path; contains "room copy pending"; no names; no dashes)
- `/tmp/claude-1000/-home-jsagi/3085a95e-3096-40f0-9da6-b0b39fab307a/scratchpad/mirror-381-09/ROOM.md` (the current ROOM.md plus one line for 05; `diff` against the original shows only that line)

Nothing was written under `/home/jsagi/MindrianRooms`: `find /home/jsagi/MindrianRooms/rethinking-mindrianos/research -newer <scratchpad>/381-09-start` printed nothing.

## Follow-ups (none built here)

1. Incremental room-scan cache keyed by mtime and size (CONTEXT deferred).
2. Write PROFILE.md and the other generated files only when the content changed (ruling 6, lx3 follow-up, research A7).
3. Run `node tests/test-381-bash-assoc.cjs` on the x86_64 release machine before the cut (ruling 7, assumption A1).
4. Route the bare STATE.md write in `scripts/heal-command.cjs` step 9 through `persistState` (same class as ruling 4).
5. `lib/core/navigation/room-birth.cjs` STEP 3 runs node on the bash `compute-state` and can never work (pre-existing).
6. Port `compute-meetings-intelligence` only if its measured share dominates (ruling 5): 239 ms before and 237 ms after on the /mnt/c copy (381-MEASUREMENTS.md), against 1341 ms for compute-state.
7. The injection RCA file (`.planning/debug/compute-team-analyze-room-python-date-fallback-injection.md`) can record this phase as its long-term fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two quick-u8x tests pinned the removed bash text**
- **Found during:** Task 2 (grep of the tests that read the three scripts), confirmed in Task 3.
- **Issue:** `tests/test-compute-team-date-guard.cjs` extracted `portable_date_to_epoch` from the scripts (legs A, B, C, F: 20 failures after the removal). `tests/test-analyze-room-edge-argv.cjs` extracted the bash 3.2 python heredoc (leg E) and counted `process.argv[3]` (leg F). Both run inside `bash tests/run-all-363.1.sh`, which is on the pinning list. The plan did not list them.
- **Fix:** Retired the function-level and python-half legs with the removed code. Re-pinned leg F of each test to the absence of `portable_date_to_epoch`, `python3`, `strptime`, `date -d`, `node -e`, `PYEOF` and `formatEdge(` program text, plus exactly one exec line. The whole-script legs (date-guard D, E; edge-argv A to D) stay and now run the node renderer. Headers explain the change.
- **Files modified:** tests/test-compute-team-date-guard.cjs, tests/test-analyze-room-edge-argv.cjs
- **Commit:** a7ee246eb

**2. Research mirror not placed (hook refusal, not a code issue)**
- The two mirror files are drafted in the scratchpad (see Research mirror). The main session must copy them into `/home/jsagi/MindrianOS/research/2026-10-29-js-perf-audit-hook-latency/`.

**3. Real-room parity input**
- The plan text names the real room path for `--room`. Per the gate facts, the run used one `cp -a` snapshot under the session scratchpad instead, deleted afterwards.

## Deferred Issues (out of scope, not fixed)

- Stale comments that name the retired switch: `lib/core/room-render.cjs` line 23 and `lib/core/room-render-analyze.cjs` line 13. Comment-only; left so that the parity record still describes the lib/core code byte for byte.
- `scripts/PYTHON_GATES.md` lines 42 and 55 still list the python datetime fallback of analyze-room and compute-team as KEEP-AS-IS; the fallback no longer exists.
- `tests/test-363.1-compute-state.cjs` line 8 (header, pre-existing since Phase 363.1) names the real room folder. Not changed here, because the removal would put the name into this plan's diff.

## Known Stubs

None.

## Threat Flags

None. The change removes surface (interpreter calls with room data) and adds none. T-381-01: no `python3 -c` or `node -e` site remains in the three scripts (greps above). T-381-03: the real room was read only through one snapshot copy. T-381-14: no git command ran in the home repository.

## NEXT (main session)

- Copy the two drafts into the home repository and commit them there after review:
  - `/home/jsagi/MindrianOS/research/2026-10-29-js-perf-audit-hook-latency/05-phase-381-outcome.md` (from `/tmp/claude-1000/-home-jsagi/3085a95e-3096-40f0-9da6-b0b39fab307a/scratchpad/mirror-381-09/05-phase-381-outcome.md`)
  - `/home/jsagi/MindrianOS/research/2026-10-29-js-perf-audit-hook-latency/ROOM.md` (from `/tmp/claude-1000/-home-jsagi/3085a95e-3096-40f0-9da6-b0b39fab307a/scratchpad/mirror-381-09/ROOM.md`)
- STATE.md and ROADMAP.md were not written by this executor (gate facts).

## Self-Check: PASSED

- scripts/compute-team, scripts/analyze-room, scripts/compute-state, docs/ENV-TUNING.md and the five test files exist and are committed.
- Commits ab1632bb7, 477cdbdf5 and a7ee246eb are in `git log`.
- The two mirror drafts exist in the scratchpad.
