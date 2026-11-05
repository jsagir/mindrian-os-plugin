BASE_SHA_384=db2ea3b05bb70b55741bdeb40b545801b0c37cbe

# Phase 384 plan 01: harness review

Reviewer: second reader (plan 384-01 executor). Source: commit 5850f067e of branch workspace/perf-optimize, copied byte for byte. The branch was not checked out, merged or cherry-picked.

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

## Defect table

Status values: CONFIRMED (a test that failed first is now green; plan 384-02 writes the final status for X6 to X10) or DROPPED (with evidence). Statuses below are the review status before the fix tests exist.

| X1 | Constants of phase 382 | BASE_SHA_382 constant, schemas mos.perf-382/1, mos.perf-382-counts/1, mos.perf-382-spread/1, mos.perf-382-isolation/1, lock mos-perf-382.lock (README), bench folder mos-382-bench (benchDir and cmdCleanBench), variable MOS_REAL_ROOM_382, session id sess-382-measure, client name perf-382, sandbox prefix mos-382-run- | Plan 384-01, tests B1 | CONFIRMED by reading |
| X2 | Gate placement (cmdRun, measureTarget) | load1_start is read before prepareRoom; a room copy over a slow mount can take minutes and load the host. No gate runs between targets, so a peer suite that starts mid-run is not seen. verify-results reads only the machine-level load1_start, not the load1 of each target | Plan 384-01, tests B2, B3, B5 | CONFIRMED by reading |
| X3 | Failed runs look fast (runEventOnce, runCommandOnce, measureTarget) | A hook that exits 127 or 126, or dies by a signal, still adds a wall sample to the median. Only the set of exit codes is recorded and nothing rejects it. A timed-out run adds its timeout value as a sample | Plan 384-01, tests B4, B5 | CONFIRMED by reading |
| X4 | Test-only flags (cmdRun) | --allow-short skips the run minimum and the host gates and works with any room kind, so a real run can use it | Plan 384-01, test B6 | CONFIRMED by reading |
| X5 | No lock check (cmdRun) | The README rule R1 needs the flock and the harness does not check that it is held | Plan 384-01, test B7 | CONFIRMED by reading |
| X6 | Hidden background work (settle) | settle follows only the process group. A hook that detaches (setsid, double fork) is not seen, so background_ms is too low and a leftover can overlap the next run. A survivor after the limit is not killed when it left the group | Plan 384-02 | CONFIRMED by reading, test in plan 384-02 |
| X7 | Count pass loses stopped processes (count-modules-preload) | The preload writes its line on the exit event. A process stopped by SIGKILL (both MCP servers after the reply, any hook at its timeout) writes nothing, so node_starts can be 0 | Plan 384-02 | CONFIRMED by reading, test in plan 384-02 |
| X8 | State drift (prepareRoom, restoreCopy, measureTarget) | The working copy is restored only at the start of a set, but the hooks write into it during 20 or more targets. Late targets run on a changed room | Plan 384-02 | CONFIRMED by reading, test in plan 384-02 |
| X9 | Snapshot reuse (prepareRoom) | prepareRoom reuses room-snapshot whenever the folder exists, whatever the source is. A second source room silently measures the first | Plan 384-02 | CONFIRMED by reading, test in plan 384-02 |
| X10 | Unproven touch (runEventOnce, findTouchTarget, IGNORED_ARTIFACTS) | The :changed targets assume that touching one artifact makes the room CHANGED. IGNORED_ARTIFACTS is a copy of a Phase 381 rule. Nothing proves it at run time. On a mount with whole-second mtimes the touch can land in the same second as the last write | Plan 384-02 | CONFIRMED by reading, test in plan 384-02 |
| X11 | Sandbox leak on error (cmdRun) | If prepareRoom, makeCtx or a measureTarget call throws, the sandbox cleanup is never called: the try/finally block is empty. The scratch folder keeps the sandbox and the room copy | Plan 384-02 | CONFIRMED by reading |
| X12 | Old result files pass silently (cmdVerify) | verify-results ignores every file whose schema is not exactly the current timing or counts schema. After the rename, a file with the old schema mos.perf-382/1 is skipped and verify-results prints OK. The spread and isolation files carry 382 schema names | Plan 384-01, test B5 | CONFIRMED by reading |
| X13 | Suite guard blind to its own ancestors (suiteGuard, listCmdlines) | The guard excludes only its own pid. It matches the text tests/run-all- anywhere in any command line, so an unrelated process that merely names the path (a shell that wraps a command) also reads as busy; and it reads the guard once per run | Plan 384-01, test B2 (the per-target gate reuses the same match) | DROPPED as a separate fix: the broad match errs on the safe side (a false busy only delays a run). Evidence: the first smoke attempt exited 75 for a real peer suite. Kept as a known limit |
| X14 | Timed-out MCP start (runCommandOnce) | For an MCP target that never replied, wall_ms is the elapsed time at the kill and is added to the median like a real reply | Plan 384-01, test B4 (classifyRun marks it timeout) | CONFIRMED by reading |
| X15 | Gate timeout is silent (waitQuiet) | When load1 stays high for 900 s the harness exits 75 for the whole run. A per-target gate must mark the target noisy instead of aborting a long run | Plan 384-01, tests B2, B3 | CONFIRMED by reading |

## Features for plans 384-02 and 384-03

These are missing items, not defects. No feature is added in plan 384-01.

- An empty transcript in the sandbox (the Stop path never reads a transcript tail, so finding S9 is invisible).
- No SessionStart source compact.
- No isolation counts by file class.
- No per-hook wall and CPU in an event result.
- No exported library surface for the phase bench scripts.
- No quiet-room preflight.
- No room picker.

## Fix status after plan 384-01 (commit 40efc6aad)

Plan 384-02 copies these statuses into the table above. RED run of the new self-test on the unchanged harness: 6 FAILED (the later checks never ran because H.defaultLockFile was missing). GREEN run: ALL PASS, 90 checks.

| id | status | proving tests (self-test names) |
|----|--------|---------------------------------|
| X1 | CONFIRMED, fixed | B1 schema constants, B1 no 382 name in a result, B1 default lock file, B1 lock override, B1 bench folder name, B1 --base-sha |
| X2 | CONFIRMED, fixed | B2 four gate cases, B3 per-target fields, B5 target load1_start |
| X3 | CONFIRMED, fixed | B4 classifyRun cases, B4 exit 127 three times (failed_runs 3, n 0), B4 exit 2 legitimate, B5 failed_runs and timed_out |
| X4 | CONFIRMED, fixed | B6 both flags exit 2 without MOS_PERF_SELFTEST, B6 --skip-gates keeps the run minimum |
| X5 | CONFIRMED, fixed | B7 seven requireLock unit cases, B7 run without the lock exits 1, B7 run under flock exits 0 |
| X12 | CONFIRMED, fixed | B5 old 382 schema file exits 1 |
| X14 | CONFIRMED, fixed | B4 timed-out run is timeout; an MCP start that never replies is failed |
| X15 | CONFIRMED, fixed | B2 gate returns ok false with a reason; the target is marked noisy and runs; B5 noisy exits 1 |
| X6 to X11 | open | plan 384-02 |
| X13 | DROPPED | see table |
