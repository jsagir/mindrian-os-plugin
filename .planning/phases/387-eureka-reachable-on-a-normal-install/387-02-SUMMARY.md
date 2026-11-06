---
phase: 387-eureka-reachable-on-a-normal-install
plan: "02"
subsystem: eureka-engine-decision
tags: [decision-gate, owner-decision, licence, network-terms]
requires: ["387-01"]
provides:
  - 387-DECISION-CARD.md (facts, 5 parts, recommendation, effect of each answer)
  - 387-DECISION-RECORD.md (owner answer in machine-readable lines)
affects: [387-03, 387-04, 387-05, 387-06, 387-07, 387-08, 387-09, 387-10, 387-11]
key-files:
  created:
    - .planning/phases/387-eureka-reachable-on-a-normal-install/387-DECISION-CARD.md
    - .planning/phases/387-eureka-reachable-on-a-normal-install/387-DECISION-RECORD.md
key-decisions:
  - "Owner approved option A for all 5 parts on 2026-11-06 (user-side-dir, fetch none, check-and-explain, sync-on-grant-then-offline, keep-registered-typed-refusal)."
metrics:
  completed: 2026-11-06
---

# Phase 387 Plan 02: Engine decision gate Summary

The owner approved option A (all five recommended parts). Plans 387-03 to 387-11 proceed.

## What was done

- Task 1 (commit b2472ca6e): read-only engine facts and the decision card. The card holds PART 0 facts with PROVEN, UNVERIFIED or ASSUMED labels, PART 1 to PART 5 options, the recommendation, the effect of a change, and one NEEDS_HUMAN line.
- Task 2: checkpoint. The executor returned NEEDS_HUMAN with the card question. No default was written.
- Task 3: the record, written after the main session relayed the owner answer "Approve all five parts (Recommended)" (commit: docs(387-02) record the owner decision).

## Findings worth carrying forward

- The engine release record (`docs/rs-release-gate.md` in the engine repo) says no-go for public distribution; the repo has no licence file. This supports fetch none.
- Audit point (c) is not supported by the lock: pomegranate 1.1.2 lists a universal wheel beside its sdist. The card does not claim a compiler need.
- gh was not run (no network allowed), so repo visibility stays ASSUMED.

## Deviations from Plan

None - plan executed as written. The `gh repo view` read in task 1 was skipped on purpose (run rules forbid network) and labeled UNVERIFIED.

## Known Stubs

None.

## Self-Check: PASSED

- Card and record files exist; the record verify command passed (six keys, plan_option A, the five values equal the planned set).
- Commits exist: b2472ca6e (card), the record commit (see git log).
