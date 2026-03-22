---
phase: 02-core-methodologies
plan: 04
subsystem: methodology
tags: [grading, investment-thesis, hsi, diagnosis, scoring, classification, routing]

# Dependency graph
requires:
  - phase: 02-core-methodologies-01
    provides: Three-file methodology pattern, problem-types.md classification matrix
provides:
  - Grade command with 6-component weighted scoring formula and P0 mandatory scoring table
  - Investment Thesis command with Ten Questions binary gate and GO/NO-GO verdict
  - Score-innovation (HSI) conversational cross-domain assessment
  - Diagnose command for problem type classification and methodology routing
  - All 30 commands (4 Phase 1 + 26 Phase 2) complete with command + reference pairs
affects: [03-passive-intelligence, 04-brain-mcp]

# Tech tracking
tech-stack:
  added: []
  patterns: [P0-constraint-enforcement, binary-gate-logic, weighted-scoring-formula, classification-routing]

key-files:
  created:
    - commands/grade.md
    - commands/build-thesis.md
    - commands/score-innovation.md
    - commands/diagnose.md
    - references/methodology/grade.md
    - references/methodology/build-thesis.md
    - references/methodology/score-innovation.md
    - references/methodology/diagnose.md
  modified: []

key-decisions:
  - "Gate threshold 6/10 for Investment Thesis (V2 used 8/10 -- lowered for educational context where exploration matters more than filtering)"
  - "HSI is conversational only for Tier 0 -- Brain MCP upgrade path documented for quantitative BERT/LSA"
  - "Diagnose never announces classification labels -- describes problem type in plain language"

patterns-established:
  - "P0 constraint enforcement: critical output elements (scoring table, disclaimer) are marked non-negotiable in both command and reference files"
  - "Binary gate pattern: Ten Questions scores 0/1 per question with explicit pass/fail threshold"
  - "Classification routing: diagnose loads problem-types.md and maps 2D matrix to methodology recommendations"
  - "Brain-ready interface: every Tier 5 reference documents what Brain MCP will enhance"

requirements-completed: [METH-06, METH-07, ALLM-01, ALLM-02]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 2 Plan 04: Tier 5 Special Methodology Commands Summary

**4 Tier 5 commands with P0 constraints: weighted grading formula, Ten Questions investment gate, conversational HSI, and problem type diagnosis routing -- completing all 30 plugin commands**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T05:02:59Z
- **Completed:** 2026-03-22T05:07:54Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Grade command with exact 6-component formula (0.35*PR + 0.25*PD + 0.20*FI + 0.10*MT + 0.05*CW + 0.05*IW) and P0 mandatory scoring table
- Investment Thesis with Ten Questions binary gate (6/10 threshold), 6-category adversarial deep dive, GO/NO-GO/CONDITIONAL verdict, and P0 investment disclaimer
- Score-innovation as conversational HSI (no BERT/LSA) with Brain MCP quantitative upgrade path documented
- Diagnose classifies problem type via 2D matrix (definition level x complexity) and recommends 3-5 methodology commands
- All 30 commands now complete (4 Phase 1 + 26 Phase 2), satisfying ALLM-01 and ALLM-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Create grade and build-thesis commands (P0 constraints)** - `f1398e6` (feat)
2. **Task 2: Create score-innovation (HSI) and diagnose commands** - `84c2dcc` (feat)

## Files Created/Modified
- `commands/grade.md` - PWS Grading command (thin skill, reads reference for scoring logic)
- `references/methodology/grade.md` - Full grading framework with 6-component formula, letter grade scale, Reality Check, artifact template
- `commands/build-thesis.md` - Investment Thesis command (thin skill, reads reference for gate logic)
- `references/methodology/build-thesis.md` - Full thesis framework with Ten Questions gate, 6-category Deep Dive, verdict template, disclaimer
- `commands/score-innovation.md` - Cross-domain HSI command (thin skill)
- `references/methodology/score-innovation.md` - Conversational HSI framework with domain pair scoring, bottleneck identification
- `commands/diagnose.md` - Problem diagnosis routing command (thin skill)
- `references/methodology/diagnose.md` - Classification logic with 2D matrix routing, methodology recommendation table

## Decisions Made
- Gate threshold set to 6/10 (V2 source used 8/10) -- lowered because PWS educational context benefits from exploration, and users can override the gate anyway
- HSI kept strictly conversational for Tier 0 -- no attempt to replicate BERT/LSA computation in markdown. Brain MCP upgrade path clearly documented
- Diagnose never announces academic classification labels to users -- describes problem characteristics in plain language per V2 source pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 30 commands complete with command + reference file pairs
- ALLM-01 (all 25 methodology bots + diagnose as slash commands) fully satisfied
- ALLM-02 (thin skill + on-demand reference pattern) fully satisfied
- Phase 2 complete -- ready for Phase 3 (Passive Intelligence) or Phase 4 (Brain MCP)
- Brain-ready interfaces documented in all 4 Tier 5 reference files

---
*Phase: 02-core-methodologies*
*Completed: 2026-03-22*
