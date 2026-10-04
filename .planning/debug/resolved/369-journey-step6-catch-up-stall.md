---
status: resolved
kind: rca
trigger: "369-journey-step6-catch-up-stall"
issue_id: "369-VERIFICATION gap 3"
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [6, 8, 9]
created: 2026-10-04T11:00:00Z
updated: 2026-10-04T14:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` in /home/jsagi/dev/MindrianOS-Plugin, HEAD range 3cd2c1a3c to 20f5d49ae (each run records its own start and end HEAD below). Not the install cache.
- **WIRE claims probe against:** hermetic flag-ON daemon started by tests/helpers/mcp-daemon-369.cjs (plugin 2.0.0-beta.56 working tree), loopback only. No Brain, no deployed server.
- **Date of audit:** 2026-10-04
- **Re-verification rule:** every code claim below names a file and function in this tree; none rests on a cache.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: closed. The step-6 copy stall is NOT ESTABLISHED (0 stalls in 113 pre-change and 190+ post-change step-6 cycles, evidence capture left in place); the journey failures seen while soaking are an ENV GAP (a daemon SIGKILLed from outside the run by concurrent test suites on this tree); WR-10 and the backoff reset are fixed at their own proven cause.
test: n/a (resolved)
expecting: the next step-6 timeout prints STEP6-EVIDENCE with the daemon's exit signal, so it classifies itself.
next_action: none for this plan; handoff line to Phase 369.1 for tests/test-369.1-bin-relocation.cjs hygiene.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin (dev workspace /home/jsagi/dev/MindrianOS-Plugin)
- Plugin version: 2.0.0-beta.56 (read with node lib/core/repo-version.cjs)
- Reported by: Phase 369 close gate (369-31) and 369-VERIFICATION.md gap 3
- Date first observed: 2026-10-03
- Related debug sessions: none

## Problem Statement

`node tests/e2e-369/journey.cjs` step 6 (restart both servers and recover) timed out once in 10 runs at the close gate, and once in about 10 earlier: 60 s waiting for the read copy to hold all 19 items of room-x. The cause was not established and load was not captured.

## Symptoms

expected: after the shell and the daemon restart and a write lands while the shell is down, the browser copy converges to the room (0 missing, 0 extra, 0 duplicate) well inside 60 s.
actual: one run in 10 (twice in about 20 over two sessions) `timeout waiting for the read copy to hold all 19 items of room-x`, the page on Work saying "Nothing changed since your last visit".
errors: `timeout waiting for the read copy to hold all 19 items of room-x`
reproduction:
  1. `node tests/e2e-369/journey.cjs`
  2. step 6 waits 60 s for `copy state current and count === expected`
started: 369-30 (the journey), first counted at the 369-31 close gate

## Scope and Impact

- Affected surfaces: cli (the shipped shell opened from Claude Code); the harness is the only place it has shown.
- Affected commands: /mos:dashboard shell (the shell launch), tests/e2e-369/journey.cjs
- User impact: a person whose daemon dies while the shell recovers would see a stale copy with no explanation; for the harness, a 1-in-10 red.
- Data impact: none (the copy is a one-way read of the room).

## Hypotheses

- H1 the room grew after the test captured `expected` (a bookkeeping row written after the snapshot, for example past logEvent's 60 s dedupe window), so `count === expected` can never be true.
- H2 the copy is behind: no hint reached the page after the restart, so no pull ran.
- H3 the read copy is stuck in a non-current state after the restart (ReplicaProvider open or retry path).
- H4 host load alone.
- H5 (found while soaking) a process outside the run kills the run's daemon.

## Eliminated
<!-- APPEND-only -->

- H1 (not supported): the `--soak-gap-ms 65000` soak put every restart past the 60 s dedupe window; 8 of 8 cycles converged with `count === expected` and 0 rows added after the snapshot (the STEP6-EVIDENCE self-test line shows `grew_after_expected.n = 0`, `max_change_seq = max_change_seq_at_expected = 24`). A room that grew would make the equality unreachable; it never did.
- H2 (not supported): in every cycle the copy converged. The self-test evidence line shows the mechanism that wakes the pull: the page's EventSource `open` event at +871 ms after the reopen, followed within 100 ms by one pull per collection (`/api/feed/changes?collection=...&after=23`). No cycle needed the 2 s poll or a room.changed frame.
- H3 (not supported): 0 cycles ended in a non-current state in 113 cycles.
- H4 (not supported at the loads tried): 8 busy-loop children on 12 cores (load1 8.2 to 11.2) made catch-up 2878 to 4302 ms (p50 3221), against 2730 to 2910 ms (p50 2842) at load1 0.3 to 0.8. The bound is 60 s.

## Evidence
<!-- APPEND-only -->

Runs. Each row is one command; "void" follows the plan's literal rule (any uncommitted change under lib, bin, scripts or ui that this plan did not make, or HEAD moving across a code change, voids the run). Zero cycles failed in any void soak either, so they are listed, not counted as passes.

| # | Command | Cycles or runs | Failed | Catch-up ms (min / p50 / max) | load1 range | HEAD start to end | Tree | Verdict |
|---|---------|----------------|--------|-------------------------------|-------------|-------------------|------|---------|
| 1 | `--soak-restart 30` | 30 | 0 | 2730 / 2842 / 2910 | 0.32 to 0.82 | 3cd2c1a3c to a55a82e04 | peer commit added lib/core/mcp-install-responder.cjs; staged lib/core/dep-install-detached.cjs and lib/core/mcp-dep-heal.cjs at end | VOID (0 failures) |
| 2 | `--soak-restart 8 --soak-gap-ms 65000` | 8 | 0 | 2731 / 2869 / 3707 | 0.05 to 1.47 | 2c339ae31 to 93c10d500 | no code diff between the heads; peer files dirty at end (scripts/check-release-payload-ceiling.cjs, scripts/release-lib/shrinkwrap-gate.sh, scripts/release-lib/prune-shrinkwrap.cjs) | VOID (0 failures) |
| 3a | `--soak-restart 30 --soak-load 8` | 0 reached | 1 run failed | n/a | 1.8 to 7.4 | 790200ce3 constant | clean | VALID; failed in step 5 (steps 1 to 4 passed), page "No room open", before any step-6 cycle (no daemon watcher yet) |
| 3b | the same, repeated | 30 | 0 | 2878 / 3221 / 4302 | 8.25 to 11.18 | 790200ce3 constant | clean | VALID |
| 4 | plain `journey.cjs` x 20 | 20 runs, 19 reached step 6 | 1 run failed (run 11, step 2, "No room open") | restart catch-up recorded per run in the journey metrics | 1.45 to 10.2 | 790200ce3 constant | clean | VALID (no watcher yet for run 11) |
| 5 | plain `journey.cjs --soak-load 6` x 30 | 30 runs | 4 runs not green: run 13 exit 77 (daemon "exited early (code null)" with empty stderr), run 16 (step 3), run 17 (step 2), run 29 (step 3) | 26 reached step 6 and passed | 6.9 to 8.3 | 36c65c0f6 to 1a5dc1928 (runs differ) | clean | VALID |
| 6 | `--soak-evidence-selftest` | 1 | forced | n/a | 0.27 to 0.88 | a993d964a constant | clean | VALID (evidence capture check) |

Post-change runs (relay commit 5cab00eca; tree clean at the start and end of each unless noted; "flagged" = my stricter rule also voids a run when a peer COMMIT touching lib, bin, scripts or ui lands mid-run, which the plan's text does not):

| # | Command | Cycles or runs | Failed | Catch-up ms (min / p50 / max) | load1 range | HEAD start to end | Verdict |
|---|---------|----------------|--------|-------------------------------|-------------|-------------------|---------|
| 7 | `tests/e2e-369/replica.cjs` | 12 arms | 0 | restart_converge 1827 | about 1.9 | 5cab00eca | PASS all 12 arms |
| 8 | `tests/test-369-shared-core.cjs` | 15 arms (incl. 3c, 3d) | 0 | n/a | n/a | 5cab00eca | PASS=15 FAIL=0 |
| 9 | plain `journey.cjs` x 10 consecutive | 10 | 0 | 2842 to 2915 (every run), lost_writes 0 | 1.2 to 2.0 | 5cab00eca to 0098c86a5 (peer commits, no lib/bin/scripts/ui diff) | VALID, 10 of 10 exit 0 |
| 10 | `--soak-restart 30` | 30 | 0 | 2732 / 2850 / 2997 | 0.97 to 2.28 | 0098c86a5 to 4dc11a413 (peer commits to scripts/release.sh and scripts/release-lib/desktop-copy-gate.sh) | flagged (0 failures) |
| 11 | `--soak-restart 30 --soak-load 8` | 30 | 0 | 2894 / 2980 / 3080 | 3.07 to 10.21 | 693c2dc75 constant | VALID |
| 12 | `--soak-restart 30 --soak-gap-ms 65000` | 30 | 0 | 2755 / 2861 / 2985 | 0.04 to 3.79 | 693c2dc75 to 5e5c1fd37 (peer commits to lib/mcp/gate-raised.cjs and lib/mcp/tools/gate.cjs) | flagged (0 failures) |
| 13 | `--soak-restart 30` (two runs that overlapped each other for about 3 minutes; my slip against the one-browser-suite rule, both hermetic, separate ports) | 30 + 30 | 0 + 0 | 2727 / 2866 / 2930 and 2759 / 2872 / 2915 | 0.43 to 1.47 | 85a682a31 to ba0e7c7a7 (no lib/bin/scripts/ui diff) | VALID both |
| 14 | `--soak-restart 4 --soak-gap-ms 65000` | 4 | 0 | 2747 / 2857 / 2865 | 0.16 to 0.59 | 20f5d49ae constant | VALID |
| 14b | `--soak-restart 30 --soak-gap-ms 65000` (quiet window, no peer test running at start, clean tree, no lib/bin/scripts/ui diff between heads) | 30 | 0 | 2726 / 2837 / 2886 | 0.28 to 0.58 (loadavg) | 20f5d49ae to 51adcbf9f | VALID (a second journey of mine, the retry loop's third soak, ran beside it; see the SUMMARY, deviation 3) |
| 14c | the retry loop's second try, same command | 30 | 0 | 2723 / 2850 / 2920 | 0.65 to 1.36 (loadavg) | cd27faa94 to 51adcbf9f | VOID-RUN reported (a process outside the run killed a daemon between cycles); 0 failed cycles |
| 15 | runs that failed for outside reasons: `--soak-restart 30` a (daemon killed during restart in cycle 10, 20 follow-on harness errors before the soak learned to stop), `--soak-restart 30` c (daemon died before its port in cycle 7), d1 (29 of 30; one openRoom timeout, 5 DAEMON-EXIT-UNEXPECTED SIGKILLs), d2 (daemon died before its port in cycle 8), `--soak-restart 30 --soak-gap-ms 65000` (cycles 1 and 2 passed, then the shell was gone before cycle 3; 28 follow-on errors; peers were rewriting lib/core/navigation, lib/mcp/gate-ledger.cjs and others; cause of the shell's exit not established) | n/a | all outside the copy wait | n/a | 0.4 to 3.2 | various | VOID-RUN or unexplained; none counted as a pass or as a copy failure |

Valid post-change step-6 cycles, all converged with 0 missing, 0 extra, 0 duplicate: 30 (load 8) + 30 + 30 (plain) + 34 (gap: 30 + 4) + 10 (journeys) = 134, plus 60 in the two flagged soaks. Pre- plus post-change step-6 cycles in this plan: about 310, stalls: 0. Each of the three conditions that could provoke the stall (plain, load 8, 65 s gap) has a VALID post-change soak of 30 cycles with 0 failures.

Step-6 cycles that ran to the convergence wait on this tree BEFORE the change: 30 + 8 + 30 + 19 + 26 = 113. Stalls among them: 0. At the earlier rate of about 1 in 10, 113 clean cycles would occur with probability about 0.9^113 = 7e-6 if the rate were a property of this tree, so the rate is not (or no longer is) a property of the copy path under these conditions.

The five runs that did not pass (3a, 4-run-11, 5-runs 13, 16, 17, 29; six run-level events in all) all fail OUTSIDE the copy wait, and every one that left evidence shows the same signature:

- STEP-EVIDENCE for run 16: `list_rooms_from_page = {"ok":false,"reason":"mcp_unavailable","detail":"fetch failed"}`, `api_status.connection = "disconnected"`, `lastAckAt` set earlier, hint frames none. The shell had talked to the daemon and then could not reach it.
- Run 17 (step 2): the same, with `lastAckAt: null` and no sessions directory: the daemon was gone before the shell's first call.
- Run 29, with the daemon watcher in place: `DAEMON-EXIT-UNEXPECTED {"pid":1354863,"code":null,"sig":"SIGKILL","at":"2026-10-04T11:26:13.685Z"}` while this run was between steps; this run never killed that daemon (`killOwnChild` is only reached at the restart and the stop). Run 13: the daemon exited with `code null` (killed by a signal) before it reported its port.
- Two evidence self-test runs (same day, not in the table, VOID, 11:32:24Z and 11:33:21Z): `DAEMON-EXIT-UNEXPECTED ... "sig":"SIGKILL"` again, with `node tests/test-369.1-bin-relocation.cjs --arm shims-run` visible in `pgrep` at 14:34 local. That peer test (Phase 369.1, tests/test-369.1-bin-relocation.cjs lines 482 to 531) records the pids of `node .*<repo>/(bin|scripts)/(mindrian-mcp-server|mindrian-brain-mcp-client).cjs` at start (`PIDS_BEFORE`) and, in its hygiene arm, SIGKILLs every such process that was not alive then. This journey's hermetic daemon is `node <repo>/bin/mindrian-mcp-server.cjs`; it matches, and it was started after the peer test began, so the sweep kills it.

STEP6-EVIDENCE sample (self-test, copy forced to wait for one item more than the room holds, 3 s): copy row `{state: current, seq: 24, count: 20}`, truth total 20 (nodes 8, relations 5, decisions 1, activity 6), `max_change_seq` 24 equal to the value at snapshot, compare 0 missing 0 extra 0 duplicate, daemon alive and its port accepting, hint frames `[{dt: 871, ev: open}]`, feed statuses all 200, `/api/status` connected. That is what a healthy recovery looks like in the capture; a daemon killed mid-recovery would show `daemon.exit_signal`, `daemon_pid_alive: false`, `daemon_port_probe: error ECONNREFUSED` and feed statuses 502 or failed.

## Root Cause

root_cause (what is established): the outside SIGKILL of the journey's own hermetic daemon, by a concurrent Phase 369.1 test whose hygiene sweep matches any repo-anchored `mindrian-mcp-server` started after it began, produces journey failures with the signature above (shell `mcp_unavailable`, page "No room open", daemon exit signal SIGKILL). This is an environment interaction between two test suites on one tree, not a defect in the read copy.

root_cause (what is NOT established): the original step-6 stall (twice in about 20 runs, 60 s, copy short of 19 items, page on Work with "Nothing changed since your last visit") was not seen again in 113 cycles. A daemon killed after the room is bound and before the five collection pulls finish would leave exactly that picture (a stale persisted copy, nothing able to complete the pull); the window is about one second of a 3 s recovery, so it is a narrow but real target. This is consistent with the observation and unproven for the original two occurrences, because their load, daemon state and concurrent processes were not captured. Classification: the stall itself is NOT ESTABLISHED; the evidence now captured will name the next occurrence.

classification: ENV GAP (outside SIGKILL of a test-owned daemon by a peer suite) for the five run-level failures; NOT ESTABLISHED for the original stall.

## Required Code Changes

1. tests/e2e-369/journey.cjs (this plan, done): STEP6-EVIDENCE at the moment the step-6 wait gives up; STEP-EVIDENCE at any other step's failure; `DAEMON-EXIT-UNEXPECTED` and a `VOID-RUN` line when a process outside the run kills the run's daemon; `--soak-restart`, `--soak-gap-ms`, `--soak-load`; load printed at every step. No timeout raised, no assertion weakened.
2. ui/shared/src/feed-relay.ts (this plan, Task 2): WR-10, the poll emits on any head or epoch change; the backoff resets when the pool reports a reconnect.
3. Handoff, not made here (Phase 369.1 owns the file): tests/test-369.1-bin-relocation.cjs `repoServerPids` / `armHygiene` should sweep only processes in the test's own process tree (or whose cmdline carries a path unique to the test), not every repo-anchored server started after the test began.

## Tests

- tests/test-369-shared-core.cjs arm 3c (WR-10), RED commit f7ae7b8f6 before the relay change.
- tests/e2e-369/journey.cjs `--soak-restart N` is the regression harness for the stall; `--soak-evidence-selftest` and `--soak-inject-daemon-kill` check the capture itself.

## Non-Code Follow-ups

- The room picker's `roomsState === 'failed'` branch (ui/shell/client/RoomPicker.tsx lines 14 to 22) shows "No room open ... Rooms are created in Claude Code" when the daemon is unreachable; that copy says the machine has no rooms, which is false for a daemon that has died. Noted for the shell copy owner (369-UI-SPEC), not changed here.

## Resolution
<!-- OVERWRITE -->

root_cause: NOT ESTABLISHED for the step-6 copy stall (gap 3). H1 to H4 were each tested by a soak built to provoke them and none produced a stall; the failure-time evidence that would have named the cause was not available for the two original occurrences. What the work did establish is a separate, evidenced cause for every other journey failure seen: a hermetic daemon SIGKILLed by a process outside the run (sweeps in concurrent test suites that kill every repo-anchored `mindrian-mcp-server` they did not see at their own start, tests/test-369.1-bin-relocation.cjs lines 482 to 531 being the one confirmed running at the time; tests/test-267-mcpv2-dual-era.cjs, tests/test-289-cli-card-dual-era.cjs and tests/test-289-elicit-default.cjs carry the same before/after pgrep pattern; I read the kill step only in the first)

fix: (1) no product change for the stall and no timeout raised (`git diff 3cd2c1a3c~1 HEAD -- tests/e2e-369/journey.cjs` shows step 6's bound still 60000 ms; the only shorter bound, 3000 ms, is behind `--soak-evidence-selftest`); no assertion weakened (the converged copy still has 0 missing, 0 extra, 0 duplicate ids). (2) The journey now carries the evidence that decides the next occurrence: STEP6-EVIDENCE at the moment the wait gives up, STEP-EVIDENCE at any other step's failure, DAEMON-EXIT-UNEXPECTED and VOID-RUN when the run's daemon is killed from outside, a soak that stops when its daemon or shell is gone, and load printed at every step. (3) WR-10 (REV369-12) at its own proven cause: ui/shared/src/feed-relay.ts `pollOnce` compared only `latest > lastSeq`, so a lower head after a reset and a new epoch under the same head emitted nothing; it now emits on `latest !== lastSeq` or an epoch change. RED arm 3c (f7ae7b8f6) failed first, then passed with the change (5cab00eca). (4) The pool's `reconnected` flag on a poll answer re-arms a pending stream reconnect at the start backoff once per wait (RED arm 3d, c2e8e6be2).

reason: the plan's rule is to fix at the proven cause. The only causes proven here are WR-10 (read from the code and the review, reproduced by an arm) and the outside kill (reproduced three times in the evidence runs, owned by Phase 369.1's test and not editable here). The step-6 stall has no proven cause, so it gets instrumentation, not a speculative change.

verification: tests/test-369-shared-core.cjs PASS=15 FAIL=0; tests/e2e-369/replica.cjs all 12 arms; `node scripts/build-ui-shell.cjs --check` exits 0 (source hash f843dbc427831fbc); 10 of 10 consecutive journey runs exit 0 with restart catch-up 2842 to 2915 ms and lost_writes 0; VALID step-6 soaks of 30 cycles with 0 failures under each of plain (twice), load 8 and a 65 s gap.

files_changed: tests/e2e-369/journey.cjs, tests/test-369-shared-core.cjs, ui/shared/src/feed-relay.ts, lib/ui-shell/dist/ (rebuilt in the same commit as the relay change). Not touched: ui/shell/client/replica/ReplicaProvider.tsx, ui/shared/src/replica.ts, tests/e2e-369/replica.cjs (no evidence named them).

handoff (Phase 369.1): tests/test-369.1-bin-relocation.cjs `repoServerPids` / `armHygiene` should sweep only the processes it started (its own process tree or a cmdline path unique to the test), not every repo-anchored server absent at its start; the same before/after pgrep pattern appears in test-267-mcpv2-dual-era, test-289-cli-card-dual-era and test-289-elicit-default.
