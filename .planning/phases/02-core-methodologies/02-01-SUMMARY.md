---
phase: 02-core-methodologies
plan: 01
subsystem: methodology
tags: [pws, commands, references, larry-voice, frameworks, lean-canvas, systems-thinking, red-team, leadership, nested-hierarchies]

requires:
  - phase: 01-install-and-larry-talks
    provides: Plugin skeleton, command pattern, voice-dna reference, room structure
provides:
  - 7 methodology command files (thin, disable-model-invocation)
  - 7 methodology reference files (detailed frameworks, voice, artifacts)
  - Problem type classification reference (2D matrix)
  - Updated routing index (all 26 commands, no Phase 4 split)
  - Updated pws-methodology skill (26 commands)
  - Validated three-file pattern (command + reference + routing entry)
affects: [02-core-methodologies remaining plans, methodology commands Tier 3-5]

tech-stack:
  added: []
  patterns: [three-file-methodology-pattern, thin-command-thick-reference, disable-model-invocation]

key-files:
  created:
    - commands/beautiful-question.md
    - commands/map-unknowns.md
    - commands/challenge-assumptions.md
    - commands/analyze-systems.md
    - commands/leadership.md
    - commands/lean-canvas.md
    - commands/systems-thinking.md
    - references/methodology/beautiful-question.md
    - references/methodology/map-unknowns.md
    - references/methodology/challenge-assumptions.md
    - references/methodology/analyze-systems.md
    - references/methodology/leadership.md
    - references/methodology/lean-canvas.md
    - references/methodology/systems-thinking.md
    - references/methodology/problem-types.md
  modified:
    - references/methodology/index.md
    - skills/pws-methodology/SKILL.md

key-decisions:
  - "Three-file pattern validated: thin command (<500 tokens) + thick reference (2000-5000 tokens) + routing index entry"
  - "All 26 commands listed as Phase 2 in routing index (no Phase 4 split)"
  - "lean-canvas built from scratch with Larry voice (no V2 source existed)"
  - "V2 content ported by stripping File Search tiers, structured JSON, temperature settings while preserving phase structure, voice, anti-patterns"

patterns-established:
  - "Three-file methodology pattern: command file (thin, setup + flow + artifact) + reference file (overview + voice + phases + artifact template + room + cross-refs + calibration) + routing index entry"
  - "Command files use disable-model-invocation: true and delegate all framework detail to reference files"
  - "Each methodology has a default room section for artifact filing"

requirements-completed: [METH-05, METH-08, METH-09, METH-10, ALLM-01, ALLM-02]

duration: 4min
completed: 2026-03-20
---

# Phase 2 Plan 01: Tier 1-2 Methodology Commands Summary

**7 methodology commands with three-file pattern (command + reference + routing index) -- beautiful-question, map-unknowns, challenge-assumptions, analyze-systems, leadership, lean-canvas, systems-thinking -- plus problem type classification and updated 26-command routing index**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T16:11:23Z
- **Completed:** 2026-03-20T16:15:24Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Validated three-file methodology pattern on Tier 1 (beautiful-question, map-unknowns) and applied it to all 5 Tier 2 commands
- Created problem type 2D classification reference (definition axis x complexity axis) with methodology routing per quadrant
- Updated routing index to list all 26 commands as Phase 2 (removed Phase 4 split and "Coming Soon" markers)
- Ported V2 content (redteam.py, nested_hierarchies.py, leadership.py, pws_systems_thinker.py) stripping platform artifacts, keeping teaching content
- Built lean-canvas from scratch with Larry's challenging investor voice

## Task Commits

Each task was committed atomically:

1. **Task 1: Infrastructure files and Tier 1 pattern validation** - `2b477a1` (feat)
2. **Task 2: Tier 2 methodology batch (5 commands)** - `d7869c2` (feat)

## Files Created/Modified
- `commands/beautiful-question.md` - Tier 1 command: Beautiful Question (WHY/WHAT IF/HOW)
- `commands/map-unknowns.md` - Tier 1 command: Known/Unknown Matrix
- `commands/challenge-assumptions.md` - Tier 2 command: Devil's Advocate red-teaming
- `commands/analyze-systems.md` - Tier 2 command: Nested Hierarchies analysis
- `commands/leadership.md` - Tier 2 command: Socratic leadership coaching
- `commands/lean-canvas.md` - Tier 2 command: 9-box Lean Canvas
- `commands/systems-thinking.md` - Tier 2 command: Feedback loops and leverage
- `references/methodology/beautiful-question.md` - Reference: WHY/WHAT IF/HOW phases, Berger framework
- `references/methodology/map-unknowns.md` - Reference: 4-quadrant matrix with Camera Test
- `references/methodology/challenge-assumptions.md` - Reference: 4 killing questions + pre-mortem
- `references/methodology/analyze-systems.md` - Reference: 5-phase system decomposition
- `references/methodology/leadership.md` - Reference: 4-phase Socratic coaching
- `references/methodology/lean-canvas.md` - Reference: 9-box canvas with Larry voice
- `references/methodology/systems-thinking.md` - Reference: Loops, stocks/flows, archetypes, Meadows leverage
- `references/methodology/problem-types.md` - 2D classification matrix (definition x complexity)
- `references/methodology/index.md` - Updated routing index, all 26 commands
- `skills/pws-methodology/SKILL.md` - Updated to reflect 26 commands

## Decisions Made
- Three-file pattern validated: thin command + thick reference + routing entry. Subsequent plans can batch-produce remaining 19 commands using identical structure.
- All 26 commands listed as Phase 2 in routing index (no Phase 4 split). The Phase 2/4 distinction was artificial -- all methodology commands are core.
- lean-canvas built from scratch (no V2 source) with Larry's challenging investor voice applied to standard 9-box framework.
- V2 porting rules: strip File Search tiers, structured JSON, temperature settings, CopilotKit patterns. Keep phase structure, Larry voice, anti-patterns, homework.

## Deviations from Plan

None - plan executed exactly as written. Task 1 files pre-existed from a previous execution attempt and were verified correct. Task 2 reference files for lean-canvas and systems-thinking were the only new files needed; the other 3 command+reference pairs (challenge-assumptions, analyze-systems, leadership) had been created in the previous attempt and matched the pattern.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Three-file pattern validated and ready for batch production of remaining 19 methodology commands (Tiers 3-5)
- Routing index and problem-types reference ready for /mindrian-os:diagnose (Plan 02-04)
- All 7 commands invocable as /mindrian-os:* slash commands

---
*Phase: 02-core-methodologies*
*Completed: 2026-03-20*
