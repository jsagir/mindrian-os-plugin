---
phase: 75-onboarding-redesign
plan: 01
subsystem: onboarding
tags: [onboarding, modes, knight, opportunity-bank, persona]
dependency_graph:
  requires: [session-start mode menu, opportunity-ops schema, conversation-mode personas]
  provides: [mode-first onboarding, Knight framing for new users, opportunity bank explanation]
  affects: [commands/onboard.md]
tech_stack:
  added: []
  patterns: [mode-first teaching, persona-specific examples, Knight uncertainty/risk distinction]
key_files:
  modified: [commands/onboard.md]
decisions:
  - Modes taught before features -- Step 1 is three entry paths, not Who Are You
  - Deep context building moved to Step 4 after modes and opportunity bank are understood
  - Knight framing is practical with persona examples, not academic theory
  - Opportunity bank shown with full schema example including knight_position and confidence
metrics:
  duration: 3min
  completed: 2026-04-09
---

# Phase 75 Plan 01: Onboarding Mode-First Rewrite Summary

Rewrote /mos:onboard around three entry modes (Just Talk, Explore+Capture, Build a Room) with persona-specific examples, opportunity bank explanation with full schema, and Knight uncertainty-to-risk framing tied to TTO/Researcher/Business personas.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite onboard.md with mode-first structure | bb5b363 | commands/onboard.md |
| 2 | Validate structure and mode consistency | bb5b363 | commands/onboard.md (verified, no fixes needed) |

## Changes Made

### commands/onboard.md (rewritten)
- **Step 1** (new): Three Ways to Work -- presents mode menu matching session-start exactly, then walks through each mode with persona-specific examples
- **Step 2** (new): The Opportunity Bank -- explains universal output with concrete schema example showing problem, mirror_solution, domain, evidence, knight_position, confidence
- **Step 3** (new): Why This Exists -- Knight framing with practical persona-tied examples (TTO knows tech/not market, Researcher knows problem/not business model, Business sees opportunity/not technical feasibility)
- **Step 4** (moved): Who Are You? deep context building -- formerly Step 1, now after modes are taught
- **Step 4b** (merged): Domain intelligence + tailored tool tour combined into post-context flow
- **Steps 5-6**: Preserved (What's New, Wrap + Suggested First Action)
- All infrastructure preserved: voice rules (LOCKED), reset mode, mode detection, USER.md generation, marker writing, error handling

## Decisions Made

1. **Modes before identity**: Teaching the three ways to work comes before asking "who are you" -- users need to understand HOW before sharing context
2. **Step consolidation**: Old Steps 2 (Domain Intelligence) and 4 (Tailored Tool Tour) merged into Step 4b since both depend on user context
3. **Opportunity bank as Step 2**: The universal output concept placed immediately after modes so users understand what Mode 2 captures
4. **Knight framing as Step 3**: The "why" comes after "how" (modes) and "what" (opportunity bank)

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- Mode 1/2/3 references: 11 occurrences (minimum 6 required) -- PASS
- All three persona types present (TTO: 4, Researcher: 3, Business: 3) -- PASS
- Opportunity schema fields (problem, mirror_solution, domain, knight_position, confidence) -- PASS
- Knight terminology (uncertainty: 7, risk: 7) -- PASS
- Marker writing (check-onboard --write) -- PASS
- Voice rules LOCKED section -- PASS
- No emoji -- PASS
- No em-dashes -- PASS

## Known Stubs

None -- all content is complete and functional.

## Self-Check: PASSED

- commands/onboard.md: FOUND
- 75-01-SUMMARY.md: FOUND
- Commit bb5b363: FOUND
