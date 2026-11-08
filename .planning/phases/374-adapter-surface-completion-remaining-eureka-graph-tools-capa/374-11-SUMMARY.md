---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 11
subsystem: mcp
tags: [eureka, engine-busy, guard, owner-lock, ext-01, ext-02]
requires: ["374-06", "374-07", "374-08", "374-10"]
provides:
  - "setBusyProbe and engineBusyRefusal in lib/mcp/eureka-tool-contract.cjs, applied in registerEurekaTool"
  - "per-session last_status and observed tracking in lib/mcp/tools/eureka-capability-jobs.cjs, and the probe registered at module load"
  - "tests/test-374-engine-busy.cjs (T11, arms B1 to B9)"
affects: [374-13, 374-14]
key-files:
  created:
    - tests/test-374-engine-busy.cjs
  modified:
    - lib/mcp/eureka-tool-contract.cjs
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - tests/test-374-catalog-cache.cjs
    - tests/test-374-recovery.cjs
key-decisions:
  - "Gate lines read: ACT OD-6 ENGINE-BUSY-GUARD go, READ OD-4 USER-DIR, PLAN-GO 374-11, exit 0. BASE = baea19a8f199442cfd86fa769a8485a509cd9211."
  - "The guard is interim and covers ONE host process. It is not described as a fix."
  - "In launchJob the guard runs after the session-limit check, so the older job_session_limit answer stays first."
  - "Recovery (plan 374-10) opens its one child only when no job of this process runs. Cancel and a terminal-record status never open a child, so they are not guarded."
requirements-completed: [PLG374-08]
requirements-open: [ADAPT374-02 (still open: multi-host and live proof, see Limits)]
canon_parts: [8]
---

# Phase 374 Plan 11: Interim engine_busy guard

Inside one host process, a pair-screen (or any catalogued) job that this process started is no longer ended by another Eureka call. A call that would open a second engine child gets a typed `engine_busy` refusal and no child starts.

## Why

Every new `eureka-mcp` process marks all running job rows failed when it opens the job store (Eureka jobs.py, read only). The plugin opens a child for every job and every graph call. So a graph question during a run could end that run. The real fix is the Eureka owner lock (EXT-01). It does not exist yet (Eureka session answer 2026-11-08). This guard is the interim measure.

## Gate

`node 374-gate.cjs plan 374-11` printed `ACT OD-6 ENGINE-BUSY-GUARD go`, `READ OD-4 USER-DIR`, `PLAN-GO 374-11`, exit 0. OD-4 is USER-DIR, so the recovery path exists and is guarded (arm B8 ran, not skipped). Plan 374-08 did build the pair-screen branch, so B6 ran, not skipped. Result: 9 ok, 0 skip.

## How it works

- `eureka-tool-contract.cjs`: a module-level `busyProbe` (default: never busy), `setBusyProbe(fn)` (no argument restores the default), `engineBusyRefusal()`. In `registerEurekaTool` the check runs after `routeGate`, in the one wrapper that every engine-using tool already passes through. No spawn site is edited.
- `eureka-capability-jobs.cjs`: each session gets `last_status` (the start status) and `observed` (false until a status or result answer is read). The probe registered at load returns the first session that is not expired, not `unreachable`, and not (observed and terminal). If no session qualifies but `activeStarts` is above zero (a start still connecting), it returns a busy answer with no job id.
- Extra check points, all before any child: the top of `launchJob` (after the session-limit answer; covers the generic start, the second start and the resolve function of a pair-screen approval), `startPairScreen` (before the plan child), and `recover` (before the recovery child).
- The resolve function of an approval turns an `engine_busy` into `executed: false` and adds: `Nothing was started. Plan again after that job ends.`
- Unreachable: a throw from the engine client on status, result or cancel sets `last_status = unreachable`, and the guard clears for that session.

## The exact refusal sentence

```
Eureka is running a job (<job id>). A second Eureka call now could end that job. Read its status, retrieve its result or cancel it first, then repeat this call. This guard covers one MindrianOS host process only.
```

When the job's status has not been read yet, this is inserted before the last sentence: `If it has finished, read its status first: the guard clears only after a terminal status is read.` A start that is still connecting uses `Eureka is starting a job.` and no job id. The answer holds `ok false`, `reason engine_busy`, `job_id` (only when it matches the plugin's job id pattern), `message` and `fix` (`Read the job status, retrieve the result or cancel the job, then repeat the call.`). No path and no engine text (B1 checks this with a planted marker, a fake engine path and the scratch HOME).

## Exempt tools

- `eureka_graph_project` (calls no engine).
- `eureka_capability_job_status`, `eureka_capability_job_result`, `eureka_capability_job_cancel` for a job this process owns (they use the session client, no new child).
- Cancel and a terminal-record status of a recovered job (no child opens).

## RED output (before the code)

All nine arms failed (`engineBusyRefusal is not exported yet`; B9 failed only because the fingerprint constant was still unset, then I set it to the measured BEFORE value `aa07438b...` and B9 passed on the unchanged tree). The first RED run proves the arms exist and fail without the code. A mutation run then proved the arms bite: with the wrapper check removed, 7 of 9 arms failed; restored, 9 of 9 ok.

```
FAIL - B1 ... B8   (engineBusyRefusal is not exported yet)
FAIL - B9 ... job tool fingerprint changed: aa07438b7a42135ba998888c82f282c4b230363b8d35a2989c3bf7635ee79db4
```

## GREEN output

```
ok - B1 ... ok - B9      (9 ok, 0 skip, 0 FAIL)   exit 0
bash tests/run-all-374.sh:               PASS=15 FAIL=0 SKIPPED=1   (the skip is T12, owner-run)
bash tests/run-all-374.sh --neighbors:   PASS=43 FAIL=0 SKIPPED=1
```

## Verification (PROVEN, run in this tree)

- test-387-eureka-egress, test-eureka-capability-run, test-eureka-mcp-tools, test-341-eureka-no-brain-reach, test-eureka-graph-algorithm-services, test-eureka-graph-discovery-signals, test-387-eureka-engine-states, test-387-eureka-installed-layout, test-289-review-fixes: exit 0.
- `node tests/test-384-s7-mcp-start.cjs parity`: ALL PASS. `node scripts/build-connector-registry.cjs --check`: OK.
- test-270: 5 passed, 0 failed, `budget: 75 tools, 36269 desc bytes, 47531 schema bytes, 83800 total, ~20950 approx tokens`, identical before and after (B9 pins this line and a fingerprint of the four job tool descriptions and schemas).
- test-267-mcpv2 files: 14 exit 0. Two are pre-existing and not caused here (same as plan 374-10): `test-267-mcpv2-cirs-gates.cjs` (exit 1) and `test-267-mcpv2-cli-probe.cjs` (exit 77).
- Non-ASCII byte grep over every written or edited file: clean.

## Pins

The 384 golden, the 267 snapshots and the test-270 constants did not change, and none turned red. No tool description or input schema changed, so plan 374-13 has nothing to refresh from this plan. Plan 374-13 should state the new behavior in the tool descriptions (a graph question during a run answers engine_busy).

## Deviations from Plan

**1. [Rule 1 - Bug in older tests] Three earlier tests started two jobs in one process.** The guard now refuses a second start while a job runs, so these arms failed: `tests/test-374-catalog-cache.cjs` C1 and C5 (two `startAsync` in a row), `tests/test-374-recovery.cjs` K9 and K10 (several starts in one host). I changed only the set-up: C1 and C5 call `closeAllSessions()` between starts; K9 and K10 call `restartHost()` (which clears the session table) between starts. No assertion of any K or C arm changed, so the 374-10 K arms still prove recovery as before. These two test files are outside the plan `files_modified` list; I added them to the commit.
**2. [Order] The guard sits after the session-limit check in `launchJob`.** `tests/test-eureka-capability-run.cjs` plants 8 sessions and expects `job_session_limit`. Putting the busy check first changed that answer to `engine_busy` and broke an unrelated older test. With the limit first, that test passes unchanged. The same planted sessions would now make the probe busy, but the limit answer comes first.
**3. [Interpretation of B4] Cancel.** The plan text says closing the session by cancel clears the guard. In the code `cancelJob` does not close the session (cancel is cooperative; the job runs until the engine reports a terminal state). So cancel keeps the guard until a status read shows a terminal state. Result and expiry close the session and clear it. B4 tests exactly that, including a session past its lifetime that the timer has not closed yet.

## Limits (stated, not hidden)

1. **One host process only.** Two host processes at once (CLI and Desktop) are not covered until the Eureka owner lock lands (EXT-01). UNVERIFIED: no run with two real host processes was made.
2. A graph question during a run now answers `engine_busy`. This changes what a person sees while a job runs. Plan 374-13 states this in the tool descriptions; no description was changed here.
3. A status-only child after a restart can still fail a still-running row (EXT-02). Plan 374-10 recovery accepts that risk. The guard only keeps recovery from opening that child while a job of THIS process runs.
4. The engine side of the lock, the terminal-state guard and a distinct `budget_exceeded` status are not in the engine tree that was read (EXT-05).
5. A plan step (`scout_plan_pair_screen`) and a graph call from another tool path that starts at the same instant as another plan can still overlap, because the plan step does not hold `activeStarts`. The window is the length of one short plan call. UNVERIFIED in a live run; no job row exists at that time, so no job can end.
6. A completed job whose status nobody reads keeps the guard until the session lifetime (30 minutes) passes or a person reads its status. The refusal says to read the status first. This is the intended behavior of the plan and also a cost.
7. No live engine was started (D-02). Every claim above rests on in-process fakes.

## Known Stubs

None.

## Threat Flags

None. The refusal text is fixed. The only value in it is the plugin-made job id, checked against the id pattern (T-374-52).

## Self-Check

PASSED. Commit f3ca1e674 lists exactly the 6 paths of this plan (checked with git show --name-only). The 5 code and test files exist. After the commit `node tests/test-374-engine-busy.cjs` prints 9 ok. Nothing was pushed, tagged or released. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.
