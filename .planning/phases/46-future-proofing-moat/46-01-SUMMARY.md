---
phase: 46
plan: 1
subsystem: future-proofing-moat
tags: [kairos, coordinator-mode, mwp, moat, documentation]
dependency_graph:
  requires: [model-profiles]
  provides: [kairos-context, coordinator-manifest, mwp-spec, moat-mandate]
  affects: [on-stop, new-project, CLAUDE.md]
tech_stack:
  added: []
  patterns: [kairos-context-templates, session-logging, team-manifests, protocol-specification]
key_files:
  created:
    - templates/room-context/last-session.md
    - templates/room-context/rejection-log.md
    - templates/room-context/methodology-history.md
    - templates/room-context/weekly-digest.md
    - teams/mindrian.json
    - docs/MWP-SPECIFICATION.md
    - docs/MOAT-MANDATE.md
    - .planning/templates/phase-review.md
  modified:
    - scripts/on-stop
    - commands/new-project.md
    - CLAUDE.md
decisions:
  - Team manifest placed at teams/mindrian.json with install_path field (worktree .claude/ path blocked by permissions)
  - MWP specification includes conformance section requiring all 7 layers for MWP compliance
  - On-stop session logging uses node for JSON parsing and find for artifact counting
metrics:
  duration: ~15min
  completed: 2026-03-31
---

# Phase 46 Plan 1: Future-Proofing and Moat Documentation Summary

MWP formal specification with 7 layers, 9 edge types, 13 research references, plus KAIROS-compatible session context templates, Coordinator Mode team manifest, and moat mandate for all contributors.

## Tasks Completed

### Task 1: FUTURE-01 - Room Context Templates (591bf55)

Created 4 KAIROS-compatible templates in `templates/room-context/`:
- `last-session.md` - session log with date, commands, artifacts, signals, MINTO thoughts, pending verifications
- `rejection-log.md` - user rejection tracking with pattern tags (Key Decision #13: rejection is data)
- `methodology-history.md` - framework usage history with results and grade impact
- `weekly-digest.md` - weekly health check with gaps, convergences, reverse salients, recommendations

Updated `commands/new-project.md` to create `room/.context/` directory with these templates on room initialization (Step 6.5 added between artifact creation and STATE.md computation).

### Task 2: FUTURE-02 - Enhanced Stop Hook (8c3436b)

Enhanced `scripts/on-stop` to write session summary to `room/.context/last-session.md` after existing cleanup logic. The session log captures:
- Session date and time (UTC)
- Venture stage from STATE.md
- Artifact count (new/modified since last session using find -newer)
- Signal count from .proactive-intelligence.json (node JSON parsing)
- Last methodology used (frontmatter extraction)
- MINTO governing thoughts from .reasoning/ directories
- Only writes if .context/ directory exists (graceful degradation)

### Task 3: FUTURE-03 - Coordinator Mode Team Manifest (253c2cf)

Created `teams/mindrian.json` with Larry as lead and 7 member agents. Model configurations match MODEL_PROFILES table from `lib/core/model-profiles.cjs` exactly:
- framework-runner: opus/opus/sonnet
- grading: opus/opus/sonnet
- research: opus/sonnet/haiku
- brain-query: opus/sonnet/haiku
- investor: opus/sonnet/sonnet
- opportunity-scanner: sonnet/sonnet/haiku
- persona-analyst: sonnet/sonnet/haiku

Includes agent addressing format ({agent}@mindrian) and install_path field for target .claude/teams/ location.

### Task 4: FUTURE-04 - MWP Specification (1f4e430)

Created `docs/MWP-SPECIFICATION.md` - the formal 7-layer Mindrian Workspace Protocol specification. This is the crown jewel of Phase 46. Contains:
- 7 MWP layers with full definitions, invariants, and implementation details
- 9 KuzuDB edge types with complete property schemas
- 8-step cascade pipeline definition with per-step model assignments
- 3 resolution orders (model 5-step cascade, room walk-up search, state filesystem truth)
- Token efficiency claims (2K-8K per section vs 30K-50K monolithic)
- 13 research references (Simon, Rittel-Webber, ICM, Hughes, Minto, Seabrook-Wiskott, Ashby, etc.)
- Conformance section: a system must implement ALL 7 layers simultaneously to be MWP-conformant

### Task 5: MOAT-01 - Moat Mandate Document (66bbbce)

Created `docs/MOAT-MANDATE.md` with:
- The central question: "Does this deepen the MWP moat or just add surface area?"
- Moat formula: 7 layers + 9 edges + Brain IP + teaching calibration
- What CAN be copied (prompts, structure, ICM contracts, folder hierarchy, visuals) with why it does not matter
- What CANNOT be copied with time-to-replicate estimates (30 years for Brain, 100+ projects for grading)
- PR review checklist: layer touch check, moat deepening check, surface area warning signs
- Anti-patterns: feature islands, shallow integration, commodity features, Brain bypass
- Compounding moat section describing how every week of operation deepens the advantage

### Task 6: MOAT-02 - CLAUDE.md Moat Section (c66a05a)

Appended "MWP Moat Awareness" section to CLAUDE.md (all existing content preserved). Contains:
- Brief moat summary with 7 layers listed
- The rule: every feature must deepen the MWP moat
- Links to MOAT-MANDATE.md for PR review checklist
- Links to MWP-SPECIFICATION.md for full protocol

### Task 7: MOAT-03 - Phase Review Template (744a830)

Created `.planning/templates/phase-review.md` with:
- Goal achievement, requirements coverage, quality assessment sections
- Mandatory Moat Deepening Assessment with 7-layer checklist
- Integration strengthening field (how layers now interact more deeply)
- "What became harder to replicate" field
- New edge types or properties tracking
- Compounding value checklist
- Moat score (1-5) with justification requirement

## Deviations from Plan

### [Rule 3 - Blocking] Team manifest path adjustment

- **Found during:** Task 3
- **Issue:** The .claude/teams/ directory path was blocked by permission restrictions in the worktree environment (Write tool denied for .claude/ prefix paths)
- **Fix:** Created at teams/mindrian.json with an install_path field indicating the target .claude/teams/mindrian.json location at plugin install time
- **Files modified:** teams/mindrian.json

## Known Stubs

None. All files contain complete content with template placeholders only where runtime values are expected (dates, counts, room-specific data).

## Self-Check: PASSED

All 8 created files verified via Read tool:
- templates/room-context/last-session.md - FOUND
- templates/room-context/rejection-log.md - FOUND
- templates/room-context/methodology-history.md - FOUND
- templates/room-context/weekly-digest.md - FOUND
- teams/mindrian.json - FOUND
- docs/MWP-SPECIFICATION.md - FOUND
- docs/MOAT-MANDATE.md - FOUND
- .planning/templates/phase-review.md - FOUND

All 3 modified files verified:
- commands/new-project.md (Step 6.5 added) - CONFIRMED
- scripts/on-stop (KAIROS session logging added) - CONFIRMED
- CLAUDE.md (MWP Moat Awareness section appended) - CONFIRMED

All 7 commits verified via git log:
- 591bf55, 8c3436b, 253c2cf, 1f4e430, 66bbbce, c66a05a, 744a830
