---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 10
subsystem: mcp
tags: [eureka, job-record, recovery, restart, part-8, part-9, user-dir]
requires: ["374-02", "374-06", "374-07", "374-08"]
provides:
  - "lib/mcp/eureka-job-record.cjs: allow-listed, owner-only, room-bound, atomically written job pointer record under ~/.mindrian/eureka-jobs/<room>/ (USER-DIR)"
  - "recovery of status and result by asking the engine through ONE short child when the session table has no session; cancel of a recovered job refused"
  - "tests/test-374-live-restart.cjs: owner-run live restart test (T12), exits 77 here"
affects: [374-11, 374-13, 374-14]
key-files:
  created:
    - lib/mcp/eureka-job-record.cjs
    - tests/test-374-job-record.cjs
    - tests/test-374-recovery.cjs
    - tests/test-374-live-restart.cjs
  modified:
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - tests/test-341-eureka-no-brain-reach.cjs
    - tests/test-387-eureka-egress.cjs
key-decisions:
  - "Gate lines read: ACT OD-4 USER-DIR go, READ OD-5A F6, PLAN-GO 374-10. Only the USER-DIR location is implemented. BASE = 18be8feb00108ea86ca614f5924629b640b261ec."
  - "An explicit env object without HOME or USERPROFILE gives no record folder (reason no_home). The os.homedir() step is used only for the process environment. So a test or host with a bare env never writes to the real home."
  - "A caller with no bound room gets no record and no recovery. The job still runs; the start answer says record_persisted false with a fixed note."
  - "The sibling-room lookup (findInOtherRooms) exists only so a caller from another room gets job_session_wrong_owner instead of job_session_not_found."
requirements-completed: [PLG374-07, ADAPT374-02]
requirements-open: [ADAPT374-06]
canon_parts: [8, 9]
---

# Phase 374 Plan 10: Plugin job record and recovery of a lost job by asking the engine

After a host restart, a finished Eureka job can be read again. The plugin keeps one small pointer record for each started job. When the in-process session table has no session for a job id, status and result read the record, check the room, check the engine is present, open ONE short child, ask the engine, update the record and close the child. A job still running when the host stopped is reported as the engine reports it, with the limit stated. No run is promised to resume. ADAPT374-06 (live proof) stays open: T12 is written and not run.

## Gate

`node 374-gate.cjs plan 374-10` printed `ACT OD-4 USER-DIR go`, `READ OD-5A F6`, `PLAN-GO 374-10`, exit 0. Location implemented: `<home>/.mindrian/eureka-jobs/<safe room id>/<job id>.json`. No ROOM-DIR branch exists in the module (R6 greps the source for it).

## RED output (before the code)

Task 1 (scan lists edited first, test written, module absent):

```
FAIL - R1 ... R9   (all 9: lib/mcp/eureka-job-record.cjs does not load yet)
eureka-no-brain-reach: PASS=23 FAIL=2
FAIL - P1 static: ... lib/mcp/eureka-job-record.cjs: guarded module is missing
test-387-eureka-egress: 21 passed, 1 failed
```

Task 2 (recovery test written, jobs file unchanged):

```
FAIL - K1 ... K10   (all 10: job_session_not_found, or no record_persisted, or no record file)
SKIPPED (ENV GAP) - L1 MOS_374_LIVE is not 1 ...   exit 77
```

## GREEN output

```
ok - R1 .. R9                                  (9 ok)  test-374-job-record exit 0
ok - K1 .. K10                                 (10 ok) test-374-recovery exit 0
eureka-no-brain-reach: PASS=25 FAIL=0
test-387-eureka-egress: 22 passed, 0 failed
SKIPPED (ENV GAP) - L1 ...                     exit 77 (not run live)
```

## What the record holds

Closed key list: job_id, capability_id, route, scope_id, snapshot_id, room_id, session_key_hash, request_sha256, artifact_count, top_k, plan_digest, approval_ref, idempotency_key, started_at, engine_expires_at (start plus 30 days), last_status, last_status_at, terminal, manifest_sha256. A deny list (text, title, source_ref, request, result, objective, node_ids, artifacts) and any other key throw a TypeError with a fixed message that repeats no value. The request is hashed (sha256 of its canonical JSON without the approval block), never copied. Directories 0700, files 0600, write through a temp file in the same folder then rename, job id pattern `^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$` with no `..` and a resolved-path-stays-inside check (a colon in an id is stored as %3A in the file name). Sweep removes records past engine_expires_at at job start.

## What changed in eureka-capability-jobs.cjs

- `launchJob`: after the session is kept, `persistRecord` runs inside a try block. Answer gets `record_persisted: true`, or `record_persisted: false` plus a fixed `record_note`. A failure never fails the job. The existing start `note` text is unchanged (plan 374-13 owns wording).
- `getSession` miss now goes to `recover(operation, ...)` in `jobStatus`, `jobResult` and `cancelJob`. Existing answers for a live session are unchanged.
- The result checks (state-only branch, capability and scope lineage, pair-screen verifier) moved into `shapeResult`, used by both the live path and the recovery path, so both run the same checks.
- Live status and result also update the record (best effort) so a later recovery can answer a finished job from the record.
- `recover`: record read for the caller's room; a record of another room gives job_session_wrong_owner; expired record is removed and gives job_session_not_found; cancel gives cancel_unavailable_after_restart with no child; status of a terminal record answers from the record (source plugin_record); otherwise `engineRefusal(env)` then ONE child, same client options, `scout_status` or `scout_result`, record updated, child closed in a finally block. Recovered answers carry `recovered: true`, `started_by_this_session`, and the fixed `recovery_note`. The session key is not compared (it changes on a host restart).

## Owner-run live test (T12)

Command (idle host, local model):

```
MOS_374_LIVE=1 MINDRIAN_EUREKA_ROOT=<engine folder> MINDRIAN_EUREKA_RS_MODEL_PATH=<model folder> node tests/test-374-live-restart.cjs
```

It uses a scratch HOME and a scratch MINDRIAN_EUREKA_DATA_DIR, starts a job in host process A, records the engine child pids, kills A with SIGKILL, starts host process B and asks status twice through the recovery path, and prints a report. The owner should record:
1. `child_of_A_lingers_after_kill` and `child_of_A_lingers_after_recovery`: does the first engine child (eureka-mcp) keep running after its host dies? (A1, UNVERIFIED here.)
2. The `recovered_answers` state: a job still running at the kill is expected to read failed with failure_code server_restarted.
3. Whether a job that finished before the kill reads completed after the restart.

Without the switch, a model path or an engine it prints the reason and exits 77. It was run only without the switch.

## Limits (stated, not hidden)

- EXT-02: the engine marks every running row failed with server_restarted when any child opens its store. Recovery itself can therefore end a run that was still alive in another process (threat T-374-48, accepted; plan 374-11 busy guard reduces it for one host process).
- EXT-03: the engine cannot cancel across processes. Cancel of a recovered job is refused with a fixed sentence.
- A1: whether the first engine child exits when its host dies is UNVERIFIED until the owner runs T12.
- ADAPT374-06 (live proof of restart recovery) stays OPEN.
- Windows: the file-mode arm R3 is skipped on win32 and permissions there are UNVERIFIED.
- The start answer `note` and the tool descriptions still say a job cannot resume after a restart. That wording is now partly stale; plan 374-13 owns the description rewrite and no description was changed here.

## Pins

The 384 golden, the 267 snapshots and the test-270 constants did not change and none turned red: test-270 5 passed 0 failed with 75 tools; `test-384-s7-mcp-start.cjs parity` ALL PASS; connector registry --check OK; `data/` unchanged. No description or input schema changed, so plan 374-13 has nothing to refresh from this plan.

## Other verification (PROVEN, run in this tree)

- `bash tests/run-all-374.sh`: PASS=14 FAIL=0 SKIPPED=1 (the skip is T12).
- `bash tests/run-all-374.sh --neighbors`: PASS=42 FAIL=0 SKIPPED=1.
- test-eureka-capability-run, test-387-eureka-engine-states, test-387-eureka-installed-layout, test-289-review-fixes: exit 0.
- `~/.mindrian/eureka-jobs` does not exist in the real home after all runs (no test wrote outside its scratch HOME).
- Non-ASCII byte grep over all written and edited files: clean.
- Pre-existing, not caused here: tests/test-267-mcpv2-cirs-gates.cjs Check (c) (expected 35 connector descriptors, got 62) and tests/test-267-mcpv2-cli-probe.cjs exit 77.

## Deviations from Plan

None that change scope. Two small choices inside the plan:
1. [Rule 2 - safety] An explicit env without a home gives no record folder instead of falling back to os.homedir(), so existing tests that pass a bare env cannot write to the real home. Pinned in R6.
2. `resolveBase` takes `{ room_id, env }` only (no room_dir or write-scope argument) because only USER-DIR is implemented.

## Known Stubs

None.

## UNVERIFIED

- No real engine was started and no local model was used (D-02). The fake child follows the status and result shapes used by plans 374-02 and 374-08.
- Multi-host behavior (Claude Desktop, Cowork) of the room id from `callerIdentity` during recovery was exercised only through the injected seam.
- The real `scout_status` answer is assumed to carry `failure_code` at the top level (taken from the fake and the engine job store reading); if it does not, the status answer shows state and progress without the code.

## Threat Flags

None. The only new file access is the owner-only folder under the user's home, covered by T-374-42 to T-374-47.
