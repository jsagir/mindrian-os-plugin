---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 20
status: PARTIAL
subsystem: perf
tags: [perf, post-write, cascade, s2, write-path, measurement-pending]
requirements: [PERF384-F09]
key-files:
  modified:
    - scripts/post-write
    - tests/test-384-s2-post-write-skip.cjs
---

# Phase 384 Plan 20: post-write skip of the cascade node start (S2, Write path) Summary

STATUS: PARTIAL. The code change is committed and tested. The before and after measurement did not run, so the keep rule (F10) is not applied and no verdict word exists.

START_SHA of this run: 94ab074c0be51b3a6209b1868ca5f2154a174b9c (the commit with the failing mechanism group).

## Commits

| Commit | Subject |
|--------|---------|
| 153f2df2a | docs(384-20): RCA of the post-write cascade path rule, verdict NEVER-RUNS-ON-DEFAULT-ROOMS-HOME |
| 1ea8f80b4 | test(384-20): parity group for post-write |
| 94ab074c0 | test(384-20): failing mechanism group (RED) |
| ab09ac612 | perf(384-20): post-write skips the cascade node start when the path is not a room file (GREEN) |

## Owner decision (Task 2)

The coordinator brief for this run asked to make the failing mechanism group pass. That is option-c. No separate owner answer and date is recorded in this plan; the brief is the authority used. PROVEN as a statement about this run, ASSUMED as an owner ruling.

## What changed

scripts/post-write: inside `if [ -n "$room_dir" ]`, the node call to `mindrian-tools.cjs cascade` runs only when `FILE_PATH` matches `*/room/*` or `*/rooms/*`. Otherwise `CASCADE_OUTPUT` is the constant `{"skipped":true,"skipReason":"filePath not inside a room directory"}`. The glob equals `isRoomFile` in lib/core/intelligence-cascade.cjs (`includes('/room/') || includes('/rooms/')`). lib/core/intelligence-cascade.cjs and hooks/hooks.json are unchanged.

CASCADE_OUTPUT confirmation (read from the script): it is used by `cascade_status_of` (reads `error` and `skipped`) and by `write_cascade_side_channel` (reads classification, gitCommit, graphIndex, proactiveIntelligence). For the real skipped call these four fields are null or absent, so the record is equal. The parity group P1 proves it by bytes.

Note: the plan text says a skipped call is recorded as `complete`. Plan 386-15 (B7) changed that: the record says `skipped` and the envelope text says `cascade skipped for <name>`. P1 checks the `skipped` status. PROVEN by the test.

## Checks (PROVEN, run in this tree)

- `node tests/test-384-s2-post-write-skip.cjs` : `s2-post-write: ALL PASS` (P1, P2, P3 each with control, premise and parity checks; M1 and M2). RED state was recorded by commit 94ab074c0 (M1 failed before the edit).
- `bash -n scripts/post-write`: OK. `node scripts/build-connector-registry.cjs --check`: exit 0.
- Passed: test-cascade-side-channel (5), test-cascade-surface-e2e (3), test-cascade-surface-loop-fires (1), test-237-post-write-session-stamp (7 legs), test-acpt-04-filing-cascade-surfaces (5), test-sens06-artifact-filed-fires (4), test-nav01-populated-room-engine-fires (3), test-trigger-invariant (4), test-hook-envelope-shape (16), test-doctor-class-c (3).
- `bash tests/run-all-237.sh`: 12 passed, 3 failed (REACH-02 autonomy parity mutation leg, REACH-01 approve-to-execute mutation leg, REACH-03 two-process session scope mutation leg). The same 3 fail in an export of START_SHA. They are pre-existing and unrelated to post-write.
- `bash tests/run-all-366.sh`: PASSED=75 FAILED=1 KNOWN=1 in this tree (380 gate wiring and 380 face panel report FAILED in the log). In the START_SHA export the same two fail, plus 366 spike substrate prepare, 380 typecheck and 380 build (export has no installed packages). Pre-existing; the 380 failures are not caused by this change.
- No em dash or en dash in scripts/post-write. No changed line touches room-scan or room-render-analyze.

## Measurement (NOT DONE)

The two timing sets (`q7-write-bench.cjs q7 --mode time`, n of 15, two sets) refused to start with exit 75 and the text `host busy: a suite process is running`. Cause: the perf harness scans /proc for any command line that holds `tests/run-all-`. A background wait loop that this run started earlier (PID 108961, a `while pgrep -f 'tests/run-all-366.sh'` loop) holds that text in its own command line and never exits. The permission system denied the `kill` of that PID, so the host stayed busy. No set file was written (fix-s2-set1.json and fix-s2-set2.json do not exist). No number in this summary is a timing.

Not done: Steps 5 to 7 of Task 3 (the two sets, ab-verdict compare, the guard verdicts on `q7:write:rooms:artifact` and `q7:write:rooms:identity`, ab-verdict outcome, allow-list check, measurement commit). The keep rule is open: until a verdict exists, ab09ac612 is a candidate and not a kept change.

Pinned exports for the resume are left at /tmp/mos-384-scratch/s2-a (BEFORE = ab09ac612^ = 94ab074c0) and /tmp/mos-384-scratch/s2-b (FIX = ab09ac612).

## Deviations from Plan

1. [Process] Task 2 was not a stop: the coordinator brief chose option-c (see above).
2. [Blocked] Measurement blocked by a self-inflicted stale wait loop that matches the suite guard; the kill was denied.

## Resume

1. End PID 108961 (or let the owner do it). Check `for p in /proc/[0-9]*; do tr '\0' ' ' < $p/cmdline | grep -q 'tests/run-all-' && echo ${p#/proc/}; done` prints nothing but the checker.
2. Run Steps 5 to 7 of Task 3 with the commands in the plan, with FIX=ab09ac612 and BEFORE=94ab074c0.
3. Apply the keep rule F10. If the word is not KEEP, `git revert --no-edit ab09ac612` and the mechanism-test commit 94ab074c0.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED for the code and tests listed above. Measurement items are not claimed.
