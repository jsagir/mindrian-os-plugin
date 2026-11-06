---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "20"
subsystem: temporal-supersession
tags: [rca, supersession-gate, part-9, part-11, owner-decision]
requires:
  - phase: 386-01
    provides: RCA conventions for this phase
provides:
  - RCA with the caller search by class, the Phase 348 deferral record and the Phase 350 card state
  - Owner decision block with the anchored line decision: option-a
affects: [385-12, 350]
tech-stack:
  added: []
  patterns: [caller search classified as runtime, test, documentation]
key-files:
  created:
    - .planning/debug/supersession-gate-no-runtime-caller.md
  modified: []
key-decisions:
  - "Owner decision 2026-11-06: option A. Keep lib/core/temporal/supersession-gate.cjs as a documented, tested planned contract."
requirements-completed: [B12]
duration: 35min
completed: 2026-11-06
---

# Phase 386 Plan 20: supersession gate Summary

The RCA proves supersedeOnGateAnswer has 0 runtime callers because Phase 348 deferred the trigger on purpose, and the owner chose `decision: option-a` (keep as a planned contract).

## Accomplishments

- Searched lib, scripts, hooks, bin, commands, skills, agents, pipelines, data and tests. Runtime callers: 0. The function is called by tests/test-348-supersession-e2e.cjs and tests/test-348-traceability.cjs only. The e2e test passes with 12 assertions.
- Read the module header (WD-348-3), the Phase 348 close-out and the ROADMAP card. Phase 350 was meant to register the trigger. It is a card with 0 plans and no phases/350 directory.
- Read lib/mcp/tools/gate.cjs. `gate_answer` has no contradiction branch. A wire needs a new card kind and a new branch, and it falls under Part 9 (human only) and Part 11 R16.
- The born-wired registry check prints OK and the module is in no data/*.json file.
- Found that the only live CONTRADICTS writer on the research path is no-oped by `void wirer;` in lib/core/intel-pipeline.cjs, so a wire would have no input edge.
- Noted the separate live door scripts/close-loop.cjs, which calls supersession.supersede directly for BONO conclusions with a human identity.
- Recorded the owner decision. Recorded an OPEN OWNER ITEM: Phase 350 has no owner and no date, and none was invented.

## Task Commits

1. Task 1 (RCA): 846bfa48e
2. Task 2 (owner decision block): see the commit that follows this summary in git log of the RCA file

## Files Created/Modified

- .planning/debug/supersession-gate-no-runtime-caller.md (created)

## Decisions Made

- option-a. No wire, no removal. Plan 385-12 item R9 records the same ruling for this module.

## Deviations from Plan

None. No product file was edited.

## Issues Encountered

None.

## Known Stubs

None.

## Next Phase Readiness

Open owner item: Phase 350 needs an owner and a date. The CONTRADICTS writers in lib/workflow adapters were not traced for liveness (UNVERIFIED).
