---
phase: 129-spine-repair-memory-event
plan: 04
subsystem: workflow-execution-spine
tags: [memory-event, workflow-stage, follows-from, navigation-chokepoint, canon-part-3, canon-part-4, canon-part-9]

# Dependency graph
requires:
  - phase: 129-spine-repair-memory-event
    plan: 01
    provides: navigation.logWorkflowStage(roomDir, payload) helper + FOLLOWS_FROM 8th cascade edge + 60s logEvent dedup
provides:
  - /mos:act --chain emits workflow_stage (surface=act, phase=entered) on dispatch + (phase=completed) on return
  - /mos:pipeline emits workflow_stage (surface=pipeline) entered/completed per resolved stage
  - FOLLOWS_FROM chaining across consecutive spine events (completed FOLLOWS_FROM entered; stage N+1 entered FOLLOWS_FROM stage N completed)
  - closes the backward arc for the two WORKFLOW-EXECUTION spine surfaces (act + pipeline)
affects: [130-lens-engine-skeleton, 131-research-as-graph-aware-workflow-step]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-stdout, best-effort, navigation-routed workflow_stage emission mirroring the 129-02 / 129-03 read + state-transition pattern"
    - "eventId-threaded FOLLOWS_FROM demonstration: completed FOLLOWS_FROM its entered; each subsequent entered FOLLOWS_FROM the prior completed"
    - "Gated stop step emits entered only (no completed); the absence of the completed event IS the stop"

key-files:
  created:
    - tests/test-129-workflow-stage-events.cjs
  modified:
    - scripts/act-command.cjs
    - scripts/pipeline-command.cjs

key-decisions:
  - "Emission seam is an exported emitWorkflowStages helper on each script, callable both from main() (after stdout, before exit) and from the test (against synthetic multi-stage workflows) so the cross-stage FOLLOWS_FROM chain is exercised deterministically despite the live recommender resolving single-stage chains without Brain"
  - "act gated stop step emits a phase=entered event but NO phase=completed; the gate is reflected by the missing completed event, matching the plan's behavior contract"
  - "pipeline command-less (manual) stage is SKIPPED from emission (it never runs) rather than emitting a pair; chosen-and-asserted per the plan's pick-one-and-assert clause"

requirements-completed: [SPINE-EVENTS, FOLLOWS-FROM]

# Metrics
duration: ~20min
completed: 2026-05-30
---

# Phase 129 Plan 04: Workflow-Execution Spine Memory-Event Summary

**The 2 WORKFLOW-EXECUTION spine scripts now journal every act dispatch + completion and every pipeline stage as a workflow_stage memory_event via navigation.logWorkflowStage, with FOLLOWS_FROM cascade edges linking consecutive spine events temporally so the next /mos:status can render "what changed since last look" as a real chain.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-05-30
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- /mos:act --chain emits a workflow_stage (surface=act, phase=entered) carrying the dispatched methodology (stage), framework, and per-step autonomy enum (autonomous_safe | gated) at dispatch, and a workflow_stage (phase=completed) on return for every greenlit step. The completed event FOLLOWS_FROM its matching entered, and each subsequent entered FOLLOWS_FROM the prior completed.
- When the chain stops at a non-autonomous_safe gate, the greenlit prefix still fires entered + completed, and the gated stop step fires phase=entered only (NO completed) -- the absence of the completed event reflects the stop.
- /mos:pipeline emits a workflow_stage (surface=pipeline, phase=entered) and (phase=completed) per resolved stage that has a /mos: command. stage N+1's entered FOLLOWS_FROM stage N's completed, and each completed FOLLOWS_FROM its own entered, demonstrating the cross-stage FOLLOWS_FROM cascade (a 3-stage workflow lands 5 FOLLOWS_FROM edges: 3 within-stage + 2 cross-stage).
- A command-less (manual) pipeline stage is skipped from emission and never throws.
- Both scripts reach room.db ONLY through navigation.logWorkflowStage (roomDir-only, never a db handle): the live substrate guard scanFiles returns [] for both, and a grep proves zero direct room.db / node:sqlite / openRoomDb access (the only "room.db" string is a comment stating navigation is the only door).
- Emission is best-effort everywhere: lazy-require navigation.cjs with a graceful try/catch, runs AFTER stdout, wrapped in try/catch, degrading to a no-op on a navigation load failure or absent room.db (the gate render / run order still prints) -- mitigating threat T-129-04-03.
- Zero new dependencies; no em-dashes. 10/10 GREEN; 129-01 substrate still 15/15 (zero regression).

## Task Commits

1. **RED test suite** - `e18bf137` (test) -- 10-test RED-first behavior suite for act + pipeline workflow_stage emission + FOLLOWS_FROM linkage + substrate scan
2. **Task 1: act-command workflow_stage** - `b3360d35` (feat) -- entered + completed with framework + autonomy, gated-step entered-only, FOLLOWS_FROM threading
3. **Task 2: pipeline-command workflow_stage** - `5957e634` (feat) -- entered/completed per stage, cross-stage FOLLOWS_FROM chaining, command-less stage skip

_TDD note: the suite was committed RED first (e18bf137, 1/10 -- only the substrate scan passed because no violations existed yet), then Task 1 and Task 2 turned it GREEN. Both feat commits passed the live pre-commit substrate guard (no --no-verify)._

## Files Created/Modified

- `tests/test-129-workflow-stage-events.cjs` (created, 245 lines) - 10 behavior tests: act emitWorkflowStages export + entered/completed with framework + autonomy + FOLLOWS_FROM edge + gated-step entered-only + no-room-db no-throw; pipeline emitWorkflowStages export + entered/completed per stage + cross-stage FOLLOWS_FROM (>= 5 edges for 3 stages) + command-less stage tolerated; substrate scanFiles over both scripts returns []. Drives the emission seam directly (against synthetic multi-stage workflows) to avoid main()'s process.exit and to deterministically exercise cross-stage chaining.
- `scripts/act-command.cjs` (modified) - lazy-require navigation.cjs (tryLoadNavigation); emitWorkflowStages(roomDir, workflow, plan, autonomyReport) helper; wired into main() after stdout, before exit; exported for the test seam.
- `scripts/pipeline-command.cjs` (modified) - lazy-require navigation.cjs; emitWorkflowStages(roomDir, workflow) helper with cross-stage FOLLOWS_FROM threading; wired into main() after stdout, before exit; exported for the test seam.

## Decisions Made

- The emission entry point is an exported emitWorkflowStages helper on each script rather than inline code in main(). main() calls it after stdout; the test calls it against synthetic multi-stage workflows. This was necessary because the live recommender + resolver resolve single-stage chains for every seed in a fresh room (no FEEDS_INTO multi-hop without Brain), so a main()-only test could never exercise the cross-stage FOLLOWS_FROM chain the plan requires. The seam keeps the chaining logic under deterministic test control.
- act's gated stop step emits phase=entered only (no completed). The stop IS the absence of the completed event. Matches the plan behavior: "the phase=entered event still fires for the greenlit steps and NO phase=completed fires for the gated step."
- pipeline's command-less (manual) stage is skipped from emission entirely (it never runs unattended), the explicitly-asserted branch of the plan's "pick one and assert it" clause.
- autonomy + framework scalars come from the EXISTING validateChainAutonomy / composeWorkflow output (autonomy is the per-step autonomous_safe | gated enum derived from autonomyReport.runnable + plan.wouldRun membership), never fabricated.

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated the single-stage-chain reality by stating the cross-stage demonstration is the FOLLOWS_FROM "one memory_event clearly follows another in the proactive loop" pattern; the test exercises it against a synthetic 3-stage workflow through the same exported emission seam main() uses, which is the intended and only deterministic way to assert cross-stage chaining.

## Issues Encountered

- The scripts' main() calls process.exit(0), which would terminate the test process if main() were driven directly. Resolved by driving the exported emitWorkflowStages seam (the same code main() runs after stdout) against resolver-composed and synthetic workflows. No production code change was needed for this -- the seam was the planned test interface.

## User Setup Required

None - no external service configuration required. Zero new dependencies (node built-ins only).

## Next Phase Readiness

- All 6 spine scripts (status / memory / suggest-next / jtbd / operator / act / pipeline) now journal their surface to the canonical event log through navigation.cjs. The backward arc is closed for every spine surface; the next /mos:status spine_read can read a fully-populated workflow_stage + FOLLOWS_FROM chain to render "what changed since last look."
- Phase 130 (lens-engine-skeleton) and Phase 131 (research-as-graph-aware-workflow-step) inherit a complete spine event substrate with temporal FOLLOWS_FROM linkage across act + pipeline.

## Self-Check: PASSED

- FOUND: tests/test-129-workflow-stage-events.cjs
- FOUND: scripts/act-command.cjs (emitWorkflowStages export)
- FOUND: scripts/pipeline-command.cjs (emitWorkflowStages export)
- FOUND commit: e18bf137 (test RED)
- FOUND commit: b3360d35 (feat Task 1 act)
- FOUND commit: 5957e634 (feat Task 2 pipeline)

---
*Phase: 129-spine-repair-memory-event*
*Completed: 2026-05-30*
