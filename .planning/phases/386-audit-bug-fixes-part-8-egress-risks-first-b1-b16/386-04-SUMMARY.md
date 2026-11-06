---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "04"
subsystem: part8-egress-guard
tags: [part8, egress, brain_write, B2]
requires: ["386-01", "386-02"]
provides:
  - "classify() blocks every brain_write payload (class write_blocked), no allow rule"
  - "whitespace-to-brain sends no hypothesis text and reports a blocked write as blocked"
affects: [lib/core/part8-egress-guard.cjs, scripts/part8-egress-guard-hook.cjs, scripts/whitespace-to-brain.cjs, scripts/discovery-cycle.cjs]
key-files:
  created: [tests/test-386-b2-brain-write-blocked.cjs]
  modified:
    - lib/core/part8-egress-guard.cjs
    - scripts/part8-egress-guard-hook.cjs
    - scripts/whitespace-to-brain.cjs
    - scripts/discovery-cycle.cjs
    - tests/run-all-196.sh
    - tests/test-brain-client-params.cjs
    - .planning/debug/whitespace-to-brain-brain-write-room-derived-text-ambiguous-proceeds.md
decisions:
  - "Option A (owner, 2026-11-06): block every brain_write by tool name after the content scan; add no allow arm."
  - "The shim brain_write description text is left for a later plan (outside the file list)."
metrics:
  completed: 2026-11-06
  tasks: 3
---

# Phase 386 Plan 04: B2 brain_write blocked at the guard Summary

classify() now blocks every brain_write payload on every scope name with class write_blocked, so the hook exits 2 and callTool returns egress_blocked with 0 fetch calls. whitespace-to-brain sends no hypothesis text and reports a blocked write as blocked.

## What changed

- Guard: private predicate `_isBrainWriteTool` and one arm in `classify()` after step 1 (content scan, unchanged) and step 1b (empty payload), before the packet check. Constant reason, no payload bytes. No allow rule. Docblock updated. Predicate exported on the underscore test seam.
- Hook: distinct message for `write_blocked` ("Brain writes from this client are blocked").
- whitespace-to-brain: `wz.hypothesis` removed from the zone Cypher. `brainWriteOutcome()` returns ok, blocked or failed. A result that is null or has an own `error` is never a success. New summary field `blocked`. The literal `brain.write(` call is kept, so the h32 and 252 census allowlists stay valid. Exit stays 0.
- discovery-cycle step 8: captures the script stdout (stderr still shows in verbose mode) and logs one line when `blocked` is above 0.
- run-all-196: new leg for the 386-04 test.

## TDD gate

RED commit 38df8b772 (A1, A3, A4, A5, A6 failed, A2 and A7 passed). GREEN commit 4cb862239. RCA close-out commit c0e9b2563.

## Verification (fixture room, fake key, fetch counter, 0 network calls)

| Check | Result |
|---|---|
| tests/test-386-b2-brain-write-blocked.cjs | 7 arms pass |
| tests/run-all-196.sh | 7 passed, 0 failed (baseline 6 passed) |
| tests/run-all-245.sh | PASS=19 FAIL=0 (baseline same) |
| tests/run-all-3692.sh | 70 passed, 3 failed, all 3 unrelated (see below); corpus DELTA lines identical before and after; guard-survey-baseline.json has an empty diff |
| tests/run-all-252.sh | census.1 and census.5b fail, same as baseline; no whitespace-to-brain arm fails |
| tests/run-all-386.sh | 12 passed, 1 failed (386-19 RED test of a peer plan) |
| h32 census, 257 invariant, 257 honest-refusal | pass |
| scripts/check-pending-breakthrough.test.cjs | Test 12 fails, same as baseline |

The 3 run-all-3692 failures: mux card before answer S3 (gateLedger.mintGate renderer census, peer area), muy real-room rule (receipt tied to the moving HEAD sha), no-new-dependency (flexsearch removed by 385-02). None of those test files mentions brain_write.

## Deviations from Plan

**1. [Rule 1 - Bug] tests/test-brain-client-params.cjs pinned the wire shape of brain.write**
- **Found during:** Task 2 collateral run.
- **Issue:** the case needed a request on the capture server. The guard now refuses before the wire.
- **Fix:** the case now asserts the egress_blocked sentinel and 0 requests. The schema map entry stays.
- **Commit:** 4cb862239

**2. Baseline method.** The shared tree moved while the baseline ran, so the baseline was re-run on a `git archive` copy of the RED commit. That copy has no .git, so the 3692 baseline shows 12 failures that come from the missing git data. Post-run failures were compared by cause instead.

## Known Stubs

None.

## Threat Flags

None. The change removes an egress path and adds no surface.

## Deferred

- Shim `brain_write` tool description (scripts/mindrian-brain-mcp-client.cjs) still says "Generic methodology framework writes only". It is always refused now.
- tests/test-257-strict-input-shapes.cjs Arm B fails at baseline (a theo_health call is captured). Pre-existing, not touched.
- The 260917-dgf hook test showed one transient room_check_unavailable while peers ran in the shared tree. The rerun was green. Root cause UNVERIFIED.

## Self-Check: PASSED

Files exist: the test, the 4 code files, the RCA. Commits 38df8b772, 4cb862239, c0e9b2563 are in git log.
