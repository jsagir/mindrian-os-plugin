BASE_SHA_384=db2ea3b05bb70b55741bdeb40b545801b0c37cbe

# Phase 384 plan 01 and 02: harness review

Reviewer: second reader (plan 384-01 executor). Source: commit 5850f067e of branch workspace/perf-optimize, copied byte for byte. The branch was not checked out, merged or cherry-picked. Plan 384-02 wrote the final statuses below.

## Provenance hashes (sha256 of the copy, equal to sha256 of the git show output)

| file | sha256 |
|------|--------|
| tools/perf/perf-harness.cjs | 13d80af8bb70aaf7f7b27421b33106f0f1916134820c4e4b099ccf2088fb2aa7 |
| tools/perf/count-modules-preload.cjs | b1a83b24abd274e810c45a06395a7ada0bc8aa34a0fb3f14aaeb7ffb5f90ba3a |
| tools/perf/README.md | 795b38be06fd5d3c2ae6a5452dc90d46e6f9e62552fac560cb8dae0e9ad19e1f |
| tests/test-384-perf-harness.cjs (from tests/test-382-perf-harness.cjs) | a171b98dce8fb2b80d44ebfe062d8d44fbf69f1cc17ad6b305d46cd8cb641f7d |

## Unchanged runs on main (under the 384 flock, quiet host)

pristine-selftest: exit=0
Failing checks: ALL PASS (the carry-over self-test passes on main as it stands).

pristine-smoke: exit=0
Command: run on the fixture room, 7 runs, targets floor:node and event:SessionEnd. Medians: floor:node 24 ms, event:SessionEnd 23.7 ms (n 7 each).

Note on the first smoke attempt: it exited 75 (host busy) because a peer session ran a tests/run-all- suite. The harness refused to run, as designed. The exit code of the recorded run is 0, taken after the peer suite ended. A smoke exit of 75 means a peer suite was running at that moment; it is a host state, not a harness result.

## Defect table (final status)

Status values: CONFIRMED (a test that failed first is now green, with the test name and the commit) or DROPPED (with evidence). Self-test names are the check labels in tests/test-384-perf-harness.cjs.

| id | area | defect | final status |
|----|------|--------|--------------|
| X1 | Constants of phase 382 (BASE_SHA_382, schemas, lock, bench folder, MOS_REAL_ROOM_382, session id, client name, sandbox prefix) | The carried-over names still said 382 | CONFIRMED, fixed. Tests: B1 schema constants, B1 no 382 name in a result, B1 default lock file, B1 lock override, B1 bench folder name, B1 --base-sha. Fixed in commit 40efc6aad |
| X2 | Gate placement (cmdRun, measureTarget) | load1_start was read before the room copy; no gate ran between targets; verify-results did not read the load1 of each target | CONFIRMED, fixed. Tests: B2 four gate cases, B3 per-target fields, B5 target load1_start. Fixed in commit 40efc6aad |
| X3 | Failed runs look fast (runEventOnce, runCommandOnce, measureTarget) | A hook that exits 126 or 127, or dies by a signal, added a wall sample; a timed-out run added its limit as a sample | CONFIRMED, fixed. Tests: B4 classifyRun cases, B4 exit 127 three times (failed_runs 3, n 0), B4 exit 2 legitimate, B5 failed_runs and timed_out. Fixed in commit 40efc6aad |
| X4 | Test-only flags (cmdRun) | --allow-short skipped the run minimum and the host gates for any room kind | CONFIRMED, fixed. Tests: B6 both flags exit 2 without MOS_PERF_SELFTEST, B6 --skip-gates keeps the run minimum. Fixed in commit 40efc6aad |
| X5 | No lock check (cmdRun) | The README rule R1 needs the flock and the harness did not check that it is held | CONFIRMED, fixed. Tests: B7 seven requireLock unit cases, B7 run without the lock exits 1, B7 run under flock exits 0. Fixed in commit 40efc6aad |
| X6 | Hidden background work (settle) | settle followed only the process group. A hook that detaches (setsid, double fork) was not seen, so background_ms was too low and a leftover could overlap the next run. A survivor after the limit was not killed when it left the group | CONFIRMED, fixed. Tests: A1 non-empty and distinct MOS_PERF_RUN_ID, A1 setsid sleep gives background_ms of 1000 or more, A1 escaped_max of 1 or more, A1 no background gives escaped_max 0, A1 survivor gives a failed run with survivors_left 1, A1 no marked process left, A1 marked survivor dead, A1 bystander still alive. Fixed in commit FIX384_02_T1 |
| X7 | Count pass loses stopped processes (count-modules-preload) | The preload wrote its line on the exit event only. A process stopped by SIGKILL (an MCP server after the reply) wrote nothing, so node_starts could be 0 | CONFIRMED, fixed. Tests: A2 count pass of a stopped MCP server reports node_starts of 1 or more, A2 fake server not left running. Fixed in commit FIX384_02_T1 |
| X8 | State drift (prepareRoom, restoreCopy, measureTarget) | The working copy was restored only at the start of a set, but the hooks write into it during 20 or more targets | CONFIRMED, fixed. Tests: A3 per-target counts 2,2, A3 restore time printed, A3 per-set counts 2,3, A3 bad --restore exits 2. Fixed in commit FIX384_02_T1 |
| X9 | Snapshot reuse (prepareRoom) | prepareRoom reused room-snapshot whenever the folder existed, whatever the source was | CONFIRMED, fixed. Tests: A4 second run holds the file count of source B, A4 one key folder per source, A4 clean-bench --source, A4 clean-bench needs --source or --all, A4 clean-bench --all. Fixed in commit FIX384_02_T1 |
| X10 | Unproven touch (runEventOnce, findTouchTarget, IGNORED_ARTIFACTS) | The :changed targets assumed that the touch makes the room CHANGED; nothing proved it at run time | CONFIRMED, fixed. Tests: A5 Stop mode=sync, A5 Stop mode=skip, A5 SessionStart state mode=compute, A5 no state line gives unknown runs, A5 no state-log text in the result, A5 six verify-results rules. Fixed in commit FIX384_02_T1 |
| X11 | Sandbox leak on error (cmdRun) | If prepareRoom, makeCtx or a measureTarget call threw, the sandbox cleanup was never called | CONFIRMED, fixed. Test: X11 a run that throws leaves no mos-384-run- sandbox. Fixed in commit FIX384_02_T1 |
| X12 | Old result files pass silently (cmdVerify) | verify-results ignored every file whose schema was not the current timing or counts schema | CONFIRMED, fixed. Test: B5 old 382 schema file exits 1. Fixed in commit 40efc6aad |
| X13 | Suite guard blind to its own ancestors (suiteGuard, listCmdlines) | The guard excludes only its own pid and matches the text tests/run-all- anywhere in any command line | DROPPED as a separate fix: the broad match errs on the safe side (a false busy only delays a run). Evidence: the first smoke attempt exited 75 for a real peer suite. Kept as a known limit |
| X14 | Timed-out MCP start (runCommandOnce) | For an MCP target that never replied, wall_ms was the elapsed time at the kill and entered the median | CONFIRMED, fixed. Test: B4 timed-out run is timeout; an MCP start that never replies is failed. Fixed in commit 40efc6aad |
| X15 | Gate timeout is silent (waitQuiet) | When load1 stayed high for 900 s the harness exited 75 for the whole run | CONFIRMED, fixed. Tests: B2 gate returns ok false with a reason, B5 noisy exits 1. Fixed in commit 40efc6aad |

## Features for plans 384-02 and 384-03

These are missing items, not defects.

- An empty transcript in the sandbox (the Stop path never reads a transcript tail, so finding S9 is invisible). Plan 384-02 Task 2.
- No SessionStart source compact. Plan 384-02 Task 2.
- No isolation counts by file class. Plan 384-02 Task 2.
- No per-hook wall and CPU in an event result. Plan 384-02 Task 2.
- No exported library surface for the phase bench scripts. Plan 384-02 Task 2.
- No quiet-room preflight. Later plan.
- No room picker. Later plan.
