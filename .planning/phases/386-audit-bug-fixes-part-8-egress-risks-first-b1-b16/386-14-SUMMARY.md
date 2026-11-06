---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "14"
type: execute
subsystem: stop-hook
tags: [B13, on-stop, last-session, baseline]
requires: [386-01]
provides: [B13 fixed]
key-files:
  created: [.planning/debug/last-session-md-rewritten-every-turn.md, tests/test-386-last-session-baseline.cjs]
  modified: [scripts/on-stop]
requirements-completed: [B13]
completed: 2026-11-06
---

# Phase 386 Plan 14: B13 last-session baseline Summary

The "new/modified since last session" count in .context/last-session.md now counts from the end of the previous session, through a baseline stamp that moves only when the Stop session_id changes.

## Verdict

target: PRESENT (the KAIROS Prep block still exists as the plan describes). Reproduced on a fixture room: Count 1 on the first Stop, Count 0 on the second Stop of the same session with no change.

## Root cause

The reference time was the mtime of last-session.md, which the same block rewrites at every Stop.

## Fix

scripts/on-stop keeps .context/.session-baseline (line 1 = session id, mtime = end of the previous session). When the id changes, the stamp takes the mtime of the previous last-session.md. The artifact count and methodology guess use find -newer against the stamp. A missing or unsafe session id (not A-Z a-z 0-9 . _ -, 1 to 128 characters) keeps the old behavior. The id is file content only. lib/mcp/stop-gate-handler.cjs does not write last-session.md, so it is unchanged.

## Commits

- RCA commit docs(386-14) target PRESENT
- test(386-14) RED
- fix(386-14) baseline stamp in scripts/on-stop
- docs(386-14) RCA resolution

## Deviations from Plan

None in scope. The block was written compactly (655 to 674 lines) because tests/test-261030-8vd-onstop-wait.cjs enforces a 680 line budget for scripts/on-stop. A first version at 681 lines failed that budget and was shortened.

## Verification

- tests/test-386-last-session-baseline.cjs: RED (L1 and L2 second-Stop arms fail), then GREEN (L1 to L4 ok).
- bash -n scripts/on-stop ok. test-381-onstop-failure, test-261029-kqv-stop-skip-recompute, test-240.1-state-version-preserved, test-compute-state-persists, test-198-adapter-budget exit 0.
- test-261030-8vd-onstop-wait: B1 speed arm (median over 600 ms) fails before and after the change. Pre-existing timing failure on this machine, so the arm is UNVERIFIED as a regression gate.
- Baseline: `bash tests/run-all-386.sh` had a pre-existing FAIL from the plan 386-02 RED test.

## Known Stubs

None.

## Self-Check: PASSED
