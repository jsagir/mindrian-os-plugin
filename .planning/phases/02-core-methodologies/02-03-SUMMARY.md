---
phase: 02-core-methodologies
plan: 03
subsystem: methodology
tags: [scenario-planning, validation, futures, root-cause, macro-trends, dominant-designs, user-needs, tier-4]

requires:
  - phase: 02-core-methodologies-01
    provides: Three-file methodology pattern (thin command + thick reference + routing index)
provides:
  - 7 Tier 4 methodology command+reference pairs (scenario-plan, validate, explore-futures, root-cause, macro-trends, dominant-designs, user-needs)
  - Cross-framework synthesis methodology (explore-futures combines TTA + Scenario + S-Curve)
  - 5-method Root Cause Analysis toolkit (5 Whys, Fishbone, Fault Tree, Barrier, Change)
affects: [02-core-methodologies-04, routing-index]

tech-stack:
  added: []
  patterns: [thin-command-thick-reference, disable-model-invocation, cross-framework-synthesis]

key-files:
  created:
    - commands/scenario-plan.md
    - commands/validate.md
    - commands/explore-futures.md
    - commands/root-cause.md
    - commands/macro-trends.md
    - commands/dominant-designs.md
    - commands/user-needs.md
    - references/methodology/scenario-plan.md
    - references/methodology/validate.md
    - references/methodology/explore-futures.md
    - references/methodology/root-cause.md
    - references/methodology/macro-trends.md
    - references/methodology/dominant-designs.md
    - references/methodology/user-needs.md
  modified: []

key-decisions:
  - "root-cause uses 4 DACE phases (not 6) matching V2 source -- analysis depth comes from 5 methods within Phase 2"
  - "explore-futures applies three framework lenses (TTA, Scenario, S-Curve) as cross-framework synthesis, not three separate workshops"
  - "V2 porting: stripped File Search tiers, temperature settings, mode-aware behavior tables; kept phases, voice, anti-patterns, domain breadth"

patterns-established:
  - "Tier 4 commands follow same thin/thick pattern as Tiers 1-3 but with richer phase structures (6+ phases) and more detailed artifacts"
  - "Cross-framework synthesis pattern: one methodology referencing and layering multiple other methodology lenses"
  - "Multi-method pattern: root-cause offers method selection based on problem complexity classification"

requirements-completed: [METH-06, METH-09, METH-10, ALLM-01, ALLM-02]

duration: 7min
completed: 2026-03-22
---

# Phase 2 Plan 3: Tier 4 Methodology Commands Summary

**7 advanced analytical methodology commands (scenario-plan, validate, explore-futures, root-cause, macro-trends, dominant-designs, user-needs) with cross-framework synthesis and multi-method analysis**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T04:51:00Z
- **Completed:** 2026-03-22T04:57:56Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Created 7 Tier 4 methodology command+reference pairs (14 files total)
- Ported all 7 from MindrianV2 source prompts, stripping platform artifacts while preserving teaching content
- Scenario Planning includes full 2x2 matrix construction with 4 vivid narratives and cross-scenario synthesis
- Root Cause Analysis offers 5 precision methods (5 Whys, Fishbone, Fault Tree, Barrier, Change) with DACE process
- Futures Exploration implements cross-framework synthesis (TTA + Scenario + S-Curve lenses)
- Combined with Plans 02-01 and 02-02: 22 of 26 methodology commands complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Tier 4 batch A (scenario-plan, validate, explore-futures, root-cause)** - `c346a3f` (feat)
2. **Task 2: Tier 4 batch B (macro-trends, dominant-designs, user-needs)** - `76fbe56` (feat)

## Files Created/Modified
- `commands/scenario-plan.md` - Scenario Planning thin command
- `commands/validate.md` - Evidence Validation thin command
- `commands/explore-futures.md` - Futures Exploration thin command
- `commands/root-cause.md` - Root Cause Analysis thin command
- `commands/macro-trends.md` - Macro-Changes Analysis thin command
- `commands/dominant-designs.md` - Dominant Designs Analysis thin command
- `commands/user-needs.md` - Understanding User Needs thin command
- `references/methodology/scenario-plan.md` - Scenario Planning framework reference (6 phases)
- `references/methodology/validate.md` - Evidence Validation framework reference (6 phases)
- `references/methodology/explore-futures.md` - Futures Exploration framework reference (6 phases)
- `references/methodology/root-cause.md` - Root Cause Analysis framework reference (4 DACE phases + 5 methods)
- `references/methodology/macro-trends.md` - Macro-Changes framework reference (6 phases)
- `references/methodology/dominant-designs.md` - Dominant Designs framework reference (6 phases)
- `references/methodology/user-needs.md` - User Needs framework reference (6 phases)

## Decisions Made
- root-cause uses 4 DACE phases (Define, Analyze, Correct, Embed) matching the V2 source rather than forcing 6 phases -- the 5 analysis methods within Phase 2 provide equivalent depth
- explore-futures synthesizes across three existing frameworks (TTA, Scenario, S-Curve) as layered lenses rather than running three separate workshops
- V2 porting: stripped File Search tier references, temperature settings, mode-aware behavior tables, and domain breadth sections; kept phases, voice, anti-patterns, and teaching content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 22 of 26 methodology commands complete (Tiers 1-4)
- Remaining 4 commands are Tier 5 specials (Plan 02-04)
- All commands follow established thin command + thick reference pattern
- Cross-framework references verified (explore-futures references TTA, Scenario, S-Curve)

---
*Phase: 02-core-methodologies*
*Completed: 2026-03-22*
