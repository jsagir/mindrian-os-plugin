---
phase: 02-core-methodologies
plan: 02
subsystem: methodology
tags: [pws, commands, references, larry-voice, frameworks, domain-explorer, minto-pyramid, six-hats, jtbd, reverse-salient, tta, s-curve, ackoff]

requires:
  - phase: 02-core-methodologies
    provides: Three-file methodology pattern (command + reference + routing entry), voice-dna, routing index
provides:
  - 8 Tier 3 methodology command files (thin, disable-model-invocation)
  - 8 Tier 3 methodology reference files (detailed frameworks, voice, artifact templates)
  - Domain Explorer with IKA scoring and intersectional collisions
  - Minto Pyramid with SCQA + MECE issue trees + 80/20 + root cause workplan
  - Six Thinking Hats with default hat diagnosis + tension map + synthesis
  - JTBD with job steps matrix + importance/satisfaction scoring + opportunity clusters
  - Reverse Salient with system mapping + attack vector design
  - Trending to the Absurd with 20-problem inventory + opportunity extraction
  - S-Curve Analysis with era assessment + dominant design + timing verdict
  - Ackoff's Pyramid with Camera Test + climb up/down + grounding verdict
affects: [02-core-methodologies remaining plans, methodology routing, pipeline chaining]

tech-stack:
  added: []
  patterns: [three-file-methodology-pattern, v2-content-porting]

key-files:
  created:
    - commands/explore-domains.md
    - commands/structure-argument.md
    - commands/think-hats.md
    - commands/analyze-needs.md
    - commands/find-bottlenecks.md
    - commands/explore-trends.md
    - commands/analyze-timing.md
    - commands/build-knowledge.md
    - references/methodology/explore-domains.md
    - references/methodology/structure-argument.md
    - references/methodology/think-hats.md
    - references/methodology/analyze-needs.md
    - references/methodology/find-bottlenecks.md
    - references/methodology/explore-trends.md
    - references/methodology/analyze-timing.md
    - references/methodology/build-knowledge.md
  modified: []

key-decisions:
  - "All 8 V2 prompts ported with same strip/keep rules: removed File Search tiers, structured JSON output, temperature settings, mode-aware progression ranges; kept phase structure, Larry voice, anti-patterns, homework, cross-framework connections"
  - "Ackoff's Pyramid supports two directions (climb up / climb down) matching V2's dual-mode design"
  - "S-Curve includes 6 phases (not 5) to separate discontinuity detection from timing decision"
  - "Reverse Salient includes honest failure protocol from V2 -- never fabricate bottlenecks"

patterns-established:
  - "V2 porting at scale: 8 prompts ported in batch using validated three-file pattern"
  - "Each methodology has unique artifact template matching RESEARCH.md specifications"

requirements-completed: [METH-01, METH-02, METH-03, METH-04, METH-09, METH-10]

duration: 7min
completed: 2026-03-22
---

# Phase 2 Plan 02: Tier 3 Core Methodology Commands Summary

**8 Tier 3 PWS methodology commands (Domain Explorer, Minto Pyramid, Six Thinking Hats, JTBD, Reverse Salient, TTA, S-Curve, Ackoff) ported from V2 with rich artifact templates, Larry voice, and framework-specific scoring/analysis tools**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T04:50:59Z
- **Completed:** 2026-03-22T04:58:28Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Ported all 8 core PWS methodology prompts from V2 (domain.py, minto.py, bono.py, jtbd.py, reverse_salient.py, tta.py, scurve.py, ackoff.py) with platform artifacts stripped and teaching content preserved
- Created framework-specific artifact templates: IKA scoring tables, SCQA+MECE trees, 6-hat tension maps, job steps matrices, system maps, 20-problem inventories, S-curve era assessments, DIKW pyramids with Camera Test
- Combined with Plan 02-01, 15 of 26 methodology commands are now complete and invocable

## Task Commits

Each task was committed atomically:

1. **Task 1: Tier 3 batch A (explore-domains, structure-argument, think-hats, analyze-needs)** - `5c0a799` (feat)
2. **Task 2: Tier 3 batch B (find-bottlenecks, explore-trends, analyze-timing, build-knowledge)** - `93123ec` (feat)

## Files Created/Modified
- `commands/explore-domains.md` - Domain Explorer command (intersectional collisions + IKA)
- `commands/structure-argument.md` - Minto Pyramid command (SCQA + MECE)
- `commands/think-hats.md` - Six Thinking Hats command (hat rotation + tension map)
- `commands/analyze-needs.md` - JTBD command (job steps + opportunity scoring)
- `commands/find-bottlenecks.md` - Reverse Salient command (system mapping + attack vectors)
- `commands/explore-trends.md` - TTA command (trend extrapolation + problem inventory)
- `commands/analyze-timing.md` - S-Curve command (era assessment + timing verdict)
- `commands/build-knowledge.md` - Ackoff command (DIKW pyramid + Camera Test)
- `references/methodology/explore-domains.md` - Domain Explorer framework reference
- `references/methodology/structure-argument.md` - Minto Pyramid framework reference
- `references/methodology/think-hats.md` - Six Thinking Hats framework reference
- `references/methodology/analyze-needs.md` - JTBD framework reference
- `references/methodology/find-bottlenecks.md` - Reverse Salient framework reference
- `references/methodology/explore-trends.md` - TTA framework reference
- `references/methodology/analyze-timing.md` - S-Curve framework reference
- `references/methodology/build-knowledge.md` - Ackoff framework reference

## Decisions Made
- All 8 V2 prompts ported with same strip/keep rules validated in Plan 02-01: removed File Search tiers, structured JSON output, temperature settings, mode-aware progression ranges; kept phase structure, Larry voice, anti-patterns, homework
- Ackoff's Pyramid supports two directions (climb up / climb down) matching V2's dual-mode design
- S-Curve includes 6 phases to separate discontinuity detection from timing decision
- Reverse Salient includes honest failure protocol -- never fabricate bottlenecks to seem insightful

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 15 of 26 methodology commands now complete (7 from Plan 02-01 + 8 from this plan)
- Remaining 11 commands (Tiers 4-5) ready for Plan 02-03
- All commands follow validated three-file pattern and are invocable as /mindrian-os:* slash commands

---
*Phase: 02-core-methodologies*
*Completed: 2026-03-22*
