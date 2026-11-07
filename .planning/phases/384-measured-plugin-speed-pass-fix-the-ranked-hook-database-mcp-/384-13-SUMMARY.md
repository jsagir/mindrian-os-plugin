---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 13
subsystem: mcp
tags: [perf, stop-gate, event-loop, spawn, ab-verdict, reverted]
requires:
  - phase: 384-12
    provides: ab-verdict, pin-tree, tree-b modes
provides:
  - parity group and golden for the stop-gate close-out (stays)
  - measured before and after of the async close-out with verdict NO-GAIN (fix reverted)
key-files:
  created:
    - tests/test-384-s8-stop-gate-async.cjs
    - tests/fixtures/384-s8-stop-gate-golden.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s8-set1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s8-set2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s8-readings.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s8-readings.md
  modified: []
key-decisions:
  - "Keep rule applied as written: verdict NO-GAIN, so the fix commit and the mechanism test commit are reverted; the parity commit stays."
requirements-completed: []
completed: 2026-11-07
---

# Phase 384 Plan 13: stop_gate_check close-out off the event loop Summary

STATUS PARTIAL. The async close-out was built and tested, then measured. `ab-verdict` printed `VERDICT NO-GAIN d1=172.3 d2=210.6 noise=174.3 floor=50`, so the fix is reverted by the keep rule. `ab-verdict outcome` exits 0.

START_SHA: 5942ad69e22b325712dc8b21015dc60258151dd6.

## Commits

| Sha | Subject | State |
|-----|---------|-------|
| 6ce9afbdf | test(384-13): parity group for the stop-gate close-out (golden from the code before the change) | stays |
| 4ec4efdfc | test(384-13): failing mechanism group | reverted by fed522aea |
| ff8ecf2e5 | perf(384-13): stop_gate_check close-out waits for its child steps without holding the event loop (S8) | reverted by 463fc892f |
| 463fc892f, fed522aea | git revert --no-edit of the two commits above | no agent trailer (revert message is generated) |

The commit before the fix (FIX^) was 0866337bf, a Phase 388 planning commit; the product files in it equal those of 4ec4efdfc.

## RED and GREEN checks

- Parity group (P1 golden of result and files, P2 handleStopEvent on a non-material turn, M2 step order): passed before the change, passed after, stable over repeated runs. Volatile values normalized: timestamps, session id, paths, delta_hash, epoch created_at values.
- Mechanism group before the change: M1 failed (largest event-loop gap 1061 ms against a limit of 400 ms), M3 and M4 passed.
- Mechanism group after the change: ALL PASS (M1 to M4).

## Test updates (reverted together with the fix)

17 closeOutRoom calls in 6 files became `await` calls: test-3551-part8-egress (2), test-3551-concurrency (1), test-3551-tri-polar (4), test-241-guardian-tripolar-parity (3, with the mutation needle and its three async tests), test-381-stop-gate-persist (2, with a sequential leg runner), test-3551-mcp-fire-once (5). All are restored by the revert, because the sync handler is back.

## Suites on the fix tree

Green: run-all-198, run-all-196 (egress, 7 of 7), test-3551-mcp-fire-once, test-241-guardian-tripolar-parity, test-198-stop-gate-retry-ceiling, test-359-mcp-declared, test-381, test-209, test-248, test-h27, `build-connector-registry --check`. Red and also red in an export of START_SHA: run-all-241, run-all-359, run-all-3551, test-3551-tri-polar (hooks.json leg; the other 20 checks passed in a temporary copy without that leg), test-362 D6. After the revert, the parity group, test-381 and test-241-guardian-tripolar-parity pass.

## Measurement (copied from measurements/fix-s8-readings.md)

Primary id `mcp:block:stop_gate_check:warm:ping` against `mcp:block-b:...`, metric wall_ms.median, n of 15 per set, two interleaved sets, pinned exports, fixture room, taskset 0-3.

| label | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| warm ping during the call | 310.65 (257.5 / 363.8) | 119.2 (85.2 / 153.2) | 546 | 475.9 | 172.3 | 210.6 | 174.3 | 50 | 34.2 | 57.0 | NO-GAIN |

Guards: warm tool reply NO-GAIN (d1 -5.8, d2 -12.6, noise 222), cold ping NO-GAIN (d1 184.4, d2 197.7, noise 196.1). No guard printed WORSE.

Both set differences are above the 50 ms floor and equal in sign. The rule needs each above twice the noise (about 349 ms). The noise term is large because the median of one tree moved by 68 to 106 ms between set 1 and set 2. The rule gives no retake for NO-GAIN, so the revert follows.

## Deviations from Plan

1. [Rule 1 - Bug in test data] The first mechanism run showed M1 passing on the sync code (the interval was cleared before a tick could record the gap) and the stub node being called twice per close-out (scripts/compute-state calls node). I added one timer tick before clearing and made the stub node act only for memory-lifecycle.cjs. This was before the RED commit.
2. [Process] Golden normalization needed two more rules than the plan lists (delta_hash value, epoch `_created_at` values); both are random per run.
3. [Process] The fix commit subject carried the phase tag with a product path, which phase-guard rule b rejected at the time. The coordinator changed phase-guard (commit 12065a6da); no history was rewritten. phase-guard prints OK at the end.
4. [Process] The timed run exited 75 twice because two hung suites of other sessions (run-all-150, run-all-245) were alive. The coordinator stopped them with owner approval; I did not touch them. The gate then cleared and the sets ran.
5. [Process] The revert commits carry no agent trailer line (generated messages; no history rewrite).

## Follow-up for the owner

The warm ping after the change was 119.2 ms, below 200 ms, so the in-process steps (recompile, folder-memory snapshot) are not the main hold on the loop. A new attempt needs a lower noise term: a quiet host and more runs per set. No code change is made here.

## NOT MEASURED, UNVERIFIED

Desktop and Cowork surfaces (the tooling measures the Linux CLI path). The first-call (cold) tool reply.

## Self-Check: PASSED

Files exist: the parity test, the golden, four measurement files. Commits 6ce9afbdf, 4ec4efdfc, ff8ecf2e5, 463fc892f, fed522aea are in the log. `ab-verdict outcome` exits 0. phase-guard prints OK.
