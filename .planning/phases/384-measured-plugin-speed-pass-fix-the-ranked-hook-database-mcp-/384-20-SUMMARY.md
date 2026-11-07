---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 20
status: PARTIAL-REVERTED
subsystem: perf
tags: [perf, post-write, cascade, s2, write-path, measurement-pending]
requirements: [PERF384-F09]
key-files:
  modified:
    - scripts/post-write
    - tests/test-384-s2-post-write-skip.cjs
---

# Phase 384 Plan 20: post-write skip of the cascade node start (S2, Write path) Summary

STATUS: PARTIAL. The verdict is NO-GAIN. Per keep rule F10 the fix commit ab09ac612 and the mechanism-test commit 94ab074c0 were reverted (a312ac9f7, bb2470900). The parity group stays. scripts/post-write is back to its state before the change.

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

## Measurement (done on the resume, after the stale wait loop was killed)

Two sets, n of 15, interleaved, pinned exports of BEFORE 94ab074c0 and FIX ab09ac612, under the lock. Files: measurements/fix-s2-set1.json, fix-s2-set2.json, fix-s2-readings.json, fix-s2-readings.md (copied from ab-verdict output).

Primary, `q7:write:default:artifact`, metric wall_ms.median:

| median A (set1 / set2) | median B (set1 / set2) | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 291.1 (272.2 / 310) | 215 (196.1 / 233.9) | 688.7 | 722.8 | 76.1 | 76.1 | 75.6 | 50 | 12.99 | 17.58 | NO-GAIN |

NO-GAIN: both differences are above the 50 ms floor, but they are not above twice the noise (75.6). The p95 of B is not lower than the p95 of A. This is the high-spread target already seen in plan 384-11.

Guards:
- `q7:write:rooms:identity` : NO-GAIN (d1 127.7, d2 33.6, noise 134.3). It is not WORSE.
- `q7:write:rooms:artifact` : ab-verdict refused (timed-out runs on the target). Not computed, so the guard is UNVERIFIED. Raw medians in the set files show A 4779.7 / 4729.5 ms and B 4881.6 / 5131.7 ms, but these are mixed with timed-out runs and are not a verdict.

Informative only (not gating): `cpu_ms.median` on the default artifact gives KEEP (585 before, 425 after, d 160 and 160, noise 60). It does not change the wall verdict.

Gate fault: `perf-harness verify-results` exits 1 on the measurements folder. The cause is timed-out runs on the cascade-layout targets (q7 and q7b `rooms:artifact` and `rooms:artifact-changed`) in both sets and both trees (the cascade takes about 4.7 s against the harness cut-off). The A tree times out too, so the cause is not the change. The primary target has no timed-out runs.

Keep rule F10: NO-GAIN is not NOT-RESOLVED, so no re-take. The fix commit and the mechanism-test commit were reverted with `git revert --no-edit`. `ab-verdict outcome --readings fix-s2-readings.json --fix-sha ab09ac612` exits 0 (`verdict NO-GAIN and a revert commit of the fix exists`).

After the revert: `node tests/test-384-s2-post-write-skip.cjs` prints `s2-post-write: ALL PASS` (parity group only, since the mechanism group was reverted with its commit), and `bash -n scripts/post-write` passes. The scratch exports were removed.

Commits after the fix: fe7cf1ad8 (measurements, verdict NO-GAIN), a312ac9f7 (revert of ab09ac612), bb2470900 (revert of 94ab074c0).

## Deviations from Plan

1. [Process] Task 2 was not a stop: the coordinator brief chose option-c (see above).
2. [Process] The first measurement attempt was blocked by a stale wait loop of this run that matched the suite guard. The navigator killed it and the run resumed. The first retry used a short sha and was refused by q7-write-bench (needs 40 hex); the second run used the full sha.
3. [Gate] verify-results exits 1 (timed-out runs on cascade targets in both trees). The rooms:artifact guard is UNVERIFIED. The word NO-GAIN rests on the primary only.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

The commits fe7cf1ad8, a312ac9f7 and bb2470900 exist. The four measurement files exist. verify-results is NOT passed (see Deviations).
