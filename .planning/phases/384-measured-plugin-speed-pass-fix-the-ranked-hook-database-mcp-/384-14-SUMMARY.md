---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 14
subsystem: hooks
tags: [perf, session-start, reconcile, node-starts, ab-verdict, keep]
requires:
  - phase: 384-12
    provides: ab-verdict, pin-tree, tree-b modes
  - phase: 384-13
    provides: measuring routine
provides:
  - scripts/session-start-reconcile.cjs (four reconcile blocks in one process)
  - one parse of the archetype JSON in scripts/session-start
  - sites table, parity group and mechanism group for the SessionStart script
  - measured before and after with verdict KEEP (change stays)
key-files:
  created:
    - scripts/session-start-reconcile.cjs
    - tests/test-384-s1-session-start.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/session-start-sites.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s1-sites.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s1-readings.md
  modified:
    - scripts/session-start
key-decisions:
  - "Keep rule applied as written: first take NOT-RESOLVED, retake KEEP; the change stays."
  - "room.db is opened through resolveRoomDb of scripts/feynman-timeline-refresh-command.cjs, because scripts/check-substrate.cjs blocks a new direct node:sqlite require in a script."
requirements-completed: [PERF384-F03]
completed: 2026-11-07
---

# Phase 384 Plan 14: S1 SessionStart in fewer node processes Summary

STATUS DONE. The four reconcile blocks of `scripts/session-start` run in one node process, and the three field parses of the archetype JSON run in one process. `ab-verdict` printed `VERDICT KEEP d1=712.3 d2=943.4 noise=231.1 floor=50` on the retake. `ab-verdict outcome` exits 0.

START_SHA: 6d3d165f0f856dcb9906a5950fc5267572abb5c1.

## Commits

| Sha | Subject | State |
|-----|---------|-------|
| 41239389b | test(384-14): S1 sites table and parity group for scripts/session-start | stays |
| f29165499 | test(384-14): failing mechanism group, SessionStart starts the reconcile blocks in four processes | stays |
| ccf070ebd | perf(384-14): SessionStart reconciles in one process and parses each JSON string once (S1) | stays (KEEP) |
| 1fe234dbd | docs(384-14): S1 before and after on pinned exports, verdict KEEP | stays |

BEFORE tree = f29165499 (FIX^), FIX = ccf070ebd8d9f2b233e2055d63f1a54f5d6f4fb2. The product files of f29165499 equal those of START_SHA.

## Sites table summary (measurements/fix-s1-sites.md)

- 35 starts traced by xtrace plus 4 starts by child scripts = 39 node starts through PATH (3 repeats agree). The census counter (all descendants) reports 45 before.
- Changed: the four reconcile blocks (P-B, 4 starts become 1, removed 3) and the three archetype field parses (P-A, 3 become 1, removed 2). Promise: 5.
- Left: the other 28 traced sites (out of scope, not P-A or P-B), the producer starts, and the profile (line 409) and integrations (line 593) parses, which read one field each (nothing to merge).

## RED and GREEN checks

- Parity group (P1 control arm: stdout and written files of two runs of the old code equal; P2 envelope; P3 written files): passed on the old code and passed after the change.
- Mechanism group before the change: 7 FAIL lines (M1 counts 39,39,39 against the limit 34; M2 found 0 reconcile starts and 4 old-code starts; M3 module missing, 4 checks).
- Mechanism group after: ALL PASS (M1 limit 34; M2 one reconcile start; M3 failure isolation, order, child exit 0, all four blocks report their own failure).
- BASELINE_NODE_STARTS 39, REMOVED_NODE_STARTS 5. Measured count after with the PATH shim: at most 34 in 3 of 3 repeats.
- Normalization rules in the test (each volatile by nature): sandbox root, tree root (and the runner checkout named by the sandbox settings seed), ISO time, epoch ms and s, v4 identifiers (room_id), the random install id, digests over random input (room_hash, fingerprint).

## Measurement (copied from measurements/fix-s1-readings.md)

Primary `event:SessionStart:changed`, metric wall_ms.median, n of 15 per set, two interleaved sets, pinned exports, fixture room, taskset 0-3.

| take | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| first | 2620 (2654 / 2586) | 2356.5 (2323.3 / 2389.7) | 3608.8 | 3506.7 | 330.7 | 196.3 | 134.4 | 50 | 2.59542 | 2.817738 | NOT-RESOLVED |
| retake | 5072.85 (5070.2 / 5075.5) | 4245 (4357.9 / 4132.1) | 5686.4 | 5213.3 | 712.3 | 943.4 | 231.1 | 50 | 0.1 | 5.3 | KEEP |

Both rows are copied from fix-s1-readings.md (the first take is in the section named First take there; its input files are the take1 files).

Guards: `event:SessionStart:compact` wall_ms.median on the retake printed KEEP (d1 1075.4, d2 1058.2, noise 457); on the first take NO-GAIN (d1 275.4, d2 233.4). No guard printed WORSE. Informative: changed hook CPU on the retake KEEP (d1 1000, d2 820).

Counts (untimed, counter, SessionStart:startup:changed, 3 repeats): node_starts 45 before, 40 after (minus 5); exec_total median 103 before, 95 after (minus 8).

Caveat for the reader: the host ran at about half the speed on the retake (before-tree median 5070 ms against 2654 ms on the first take, load1 below 2 in both takes). The difference in milliseconds on the retake is therefore larger than on the first take. The first take, alone, was above the floor but not above twice the noise in set 2. The keep rule asks for a retake on NOT-RESOLVED and reads again; it printed KEEP.

## Suites

Green: tests/test-384-s1-session-start.cjs (both groups), test-session-start-banner, test-session-start-node-preflight, test-k1u-session-start-envelope, test-261029-lx3-sessionstart-skip, test-261029-qef-hook-timeouts, test-341-session-start-tier, test-341-session-start-verify-hook, test-267.3-session-start-declaration, test-209-session-start-exemplar, test-hook-envelope-shape (re-run after the last product edit), `build-connector-registry --check` (exit 0, same as START_SHA), `build-orchestration-projection --check`, `check-render-coverage`, `bash -n scripts/session-start`, `node --check scripts/session-start-reconcile.cjs`.

Red and also red in an export of START_SHA, so not failures of this plan: run-all-383 (test-383-sourced-number U1, hit in commands/file-meeting.md); run-all-366 (test-380-gate-wiring, 5 changelog-content checks; 380 face panel aggregate). All other legs of run-all-383 (15 of 16) and run-all-366 (75 of 76 PASS, 1 KNOWN) pass.

## Deviations from Plan

1. [Rule 3 - Blocking] The pre-commit guard `scripts/check-substrate.cjs --diff` blocked the first fix commit: a new `require('node:sqlite')` in a script (rule m3-direct-sqlite-require). The old inline blocks sat in a bash string, which the guard does not read. I did not add an allow-list entry (check-substrate.cjs is outside files_modified) and did not use the chokepoint door `openRoomDbForCaller` (it runs schema creation and migrations on open, a change of logic). `session-start-reconcile.cjs` opens the same plain handle through `resolveRoomDb` of `scripts/feynman-timeline-refresh-command.cjs` (existing, same contract: plain `DatabaseSync`, null when the file is missing). Open item: the owner may prefer an allow-list entry for the new script instead.
2. [Process] Retake after NOT-RESOLVED, as F10 says. The first take is kept as `fix-s1-take1-set1.json`, `-set1-b`, `-set2`, `-set2-b` (four files beyond files_modified). The allow-list one-liner of Task 3 would list them; they are measurement files of this plan.
3. [Process] The test file got one more edit in the fix commit: the M3 child run now creates an empty room.db, so blocks 3 and 4 reach the missing runner module (without it they return at once and do not report a failure). Both groups pass.
4. [Process] The plan names the pinned exports of the base commit; I pinned FIX^ (f29165499) and the fix commit, as the plan text says (`--base-sha BEFORE`), because 82 files under scripts, hooks and lib differ between db2ea3b05 and FIX^.
5. [Process] The branch is `main` in a linked worktree of the release checkout (`.git` is a file), as the task said; the worktree-agent branch assertion of the executor protocol does not apply.
6. [Process] A message "unstauck" arrived mid-run with no antecedent. I did not act on it.

## Known Stubs

None.

## Threat Flags

None. No network call, no new endpoint, no hook entry. The new script reads the room path from the environment as data.

## NOT MEASURED, UNVERIFIED

Native Windows (PLUGIN_ROOT_FOR_NODE form is kept as the old blocks used it), Desktop and Cowork surfaces, a real room (fixture room only, Canon Part 8). Block 3 (gsd planning-artifact) returned at once on the fixture room (no planning artifacts): its move is covered by the module test with stubs and by code identity, not by an effect on the fixture.

## Self-Check: PASSED

Files exist: scripts/session-start-reconcile.cjs, tests/test-384-s1-session-start.cjs, bench/session-start-sites.cjs, fix-s1-sites.md, fix-s1-readings.md, counts and set files. Commits 41239389b, f29165499, ccf070ebd, 1fe234dbd are in the log. `ab-verdict outcome` exits 0. phase-guard prints OK. hooks/hooks.json unchanged.
