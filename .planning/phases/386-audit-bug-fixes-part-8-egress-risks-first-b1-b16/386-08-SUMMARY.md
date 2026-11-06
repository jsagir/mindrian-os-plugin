---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "08"
subsystem: hooks
tags: [operator-update, registry-shape, recorded-skip, owner-decision]
requires:
  - phase: 386-07
    provides: RCA and Owner decision block (decision: unwire)
provides:
  - Plan 386-08 gate block in the plan 386-07 RCA (decision: unwire, target: PRESENT)
affects: [385-08, 385-12]
key-files:
  created: []
  modified:
    - .planning/debug/operator-update-registry-read-dormant-feature.md
key-decisions:
  - "Plan 386-08 is a recorded skip: the owner chose unwire on 2026-11-06."
requirements-completed: [B3]
duration: 5min
completed: 2026-11-06
---

# Phase 386 Plan 08: operator-update repair (recorded skip) Summary

Plan 386-08 ended as a recorded skip. The Owner decision block in the plan 386-07 RCA says `decision: unwire`, so the repair did not run.

## What was done

- Appended the `## Plan 386-08 gate` block to the RCA with the lines `decision: unwire` and `target: PRESENT`.
- The target scripts/operator-update.cjs exists and still has its private legacy-shape `resolveActiveRoom`. The unwire decision alone triggers the skip.

## Skipped

- Task 1 (RED test): skipped. No test file tests/test-386-operator-update-registry.cjs was created.
- Task 2 (canonical resolver, GREEN): skipped. No product file changed. The script scripts/operator-update.cjs and hooks/hooks.json are untouched.

## Hand-off

The Stop entry unwire stays with Phase 385 plan 08. The PostToolUse and UserPromptSubmit entries stay as item R2 of plan 385-12. A later plan may repair the read and must add a keyed-shape fixture test.

## Deviations from Plan

None. The plan skip rule was applied as written.

## Self-Check: PASSED
