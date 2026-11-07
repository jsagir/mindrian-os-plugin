---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 19
subsystem: doctor acceptance gate
tags: [doctor, acceptance, doctor-all, correctness]
requires: ["384-12", "384-18"]
provides: ["doctor-all point names a timeout and fails on an unreadable result"]
affects: [scripts/doctor.cjs]
key-files:
  created:
    - tests/test-384-cd-doctor-all-gate.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-cd-baseline.txt
  modified:
    - scripts/doctor.cjs
requirements-completed: [PERF384-F08]
completed: 2026-11-07
---

# Phase 384 Plan 19: split the doctor-all gate Summary

STATUS DONE. The doctor-all acceptance point names a timeout with its limit and fails on an unreadable child result. The 60000 ms limit is unchanged. The drift count is not taken. This is a correctness change. No speed claim is made and no timing run was taken.

START_SHA: 7c4257658eb2f132e05be1d46d1caa24ed318192.

## Commits

| Sha | Subject |
|-----|---------|
| 9226680df | docs(384-19): baseline of the acceptance gate commands at START_SHA (exit codes) |
| 8bf338f0b | test(384-19): parity group for the doctor-all acceptance point |
| 44ea9043c | test(384-19): failing mechanism group |
| eea66166b | fix(384-19): name a doctor-all timeout and fail the doctor-all point on an unreadable result |

## Hunks taken and left (read-only reading of the Phase 382 workspace diff)

Taken, written by hand: the limit function (doctorAllLimitMs, constant 60000, seam only in test mode); the two test-mode seams (DOCTOR_TEST_DOCTOR_ALL_LIMIT_MS, DOCTOR_TEST_DOCTOR_ALL_SCRIPT) and their comment entries; the runBoundedChild call; the pass rule (not timed out, exit 0, readable, drift 0); the findings for timeout, exit and unreadable; the detail.child record; the additive export of doctorAllLimitMs.

Left: the drift helper, the drift key in the detail, the drift pass rule change and the drift export. The drift line and the drift finding text stay as on main.

The drift count of the Phase 382 diff is deferred until the registry has been cleaned up behind a gate card. The entries with a missing folder in the registry of this machine are the reason (the registry was not read by this plan; the owner stated it).

## Test names

Baseline (before any change): all six gate commands exit 0 (acceptance-selfcov, preflight, acceptance, t139, selector, registry). File: measurements/fix-cd-baseline.txt.

RED (on the unchanged scripts/doctor.cjs, mechanism group): M1, M2, M3, M5 FAIL; M4 ok. Exit 1, no hang.
GREEN (after the fix, both groups): P1, P2 (premise and arm), M1 to M6 all ok. Output: `cd-doctor-gate: ALL PASS`.
The parity group passed before and after the port.

Suites after the fix: acceptance-selfcov 0, preflight 0, acceptance 0, t139 0, selector 0, registry 0 (same as baseline; no exit 124).

## Deviations from Plan

**1. [Rule 3 - Blocking] The child writes its report to a file, not a pipe.**
- Found during: Task 2, first run of the six gate commands (acceptance-selfcov and preflight went from 0 to 1).
- Cause (PROVEN): `doctor --all --json` ends with process.exit right after console.log. On a pipe, a report above 64 KiB is cut at exit. On the live workspace the report is 314827 bytes; a shell pipe received 65536 bytes and spawnSync received 143876 bytes; a file received all of it. With the new "unreadable fails" rule the live gate failed, where main passed it only because it did not check readability.
- Fix: inside the doctor-all point only, the child stdout goes to a temp file in a private temp folder under the system temp directory; the file is read and removed. If the temp file cannot be made, the pipe is used. Arm M6 (a 300000 byte report plus process.exit) covers it.
- Scope: stays inside the doctor-all point (F1 respected). The root defect in the finalizer of doctor.cjs (exit before the pipe flush) is NOT fixed here. It also affects any operator who pipes `doctor --all --json`.
- Commit: eea66166b.

**2. Test order.** The no-argument run of the new test file is red at the mechanism commit 44ea9043c by design (RED commit). The parity group, run by name, stays green on any revert of the fix.

## Deferred

- Root defect: doctor.cjs `_finalizeAndExit` calls process.exit after a large console.log; a pipe reader gets a cut report above 64 KiB. Needs an owner or a separate plan (the finalizer is shared by every doctor mode, outside the F1 scope of this plan).
- Drift count: waits for the registry clean-up behind a gate card.

## Known Stubs

None.

## Threat Flags

None. The temp file holds the doctor JSON report only; it is created in a private temp folder and removed after the read.

## Self-Check: PASSED

Commits 9226680df, 8bf338f0b, 44ea9043c, eea66166b exist in the log. The test file and the baseline file exist. The allow-list diff since START_SHA lists only scripts/doctor.cjs, tests/test-384-cd-doctor-all-gate.cjs and the baseline file. No added line of scripts/doctor.cjs names the drift helper, the cascade-rooms check or the missing-sentinel list. hooks/hooks.json is unchanged. No dash characters in the two code files.
