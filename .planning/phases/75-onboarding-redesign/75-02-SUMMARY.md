---
phase: 75-onboarding-redesign
plan: 02
subsystem: session-greeting
tags: [opportunity-bank, returning-user, session-start, context-engine]
dependency_graph:
  requires: [opportunity-ops.cjs, listOpportunities]
  provides: [OPP_BANK_SUMMARY context injection, opportunity greeting rules]
  affects: [session-start, context-engine skill]
tech_stack:
  added: []
  patterns: [non-blocking node inline eval, fault-tolerant || echo fallback]
key_files:
  created: []
  modified: [scripts/session-start, skills/context-engine/SKILL.md]
decisions:
  - OPP_BANK_SUMMARY computed via inline node calling opportunity-ops.cjs listOpportunities
  - Sort by confidence descending, surface strongest opportunity in greeting
  - Injected into all three context tiers (minimal, balanced, rich) after RETURNING_USER_HINT
  - Empty bank or missing module produces empty string, never breaks session-start
metrics:
  duration: 2min
  completed: 2026-04-09
  tasks: 2
  files: 2
---

# Phase 75 Plan 02: Opportunity Bank in Session Greeting Summary

Returning users with banked opportunities now see a summary (count, risk/uncertainty split, strongest opportunity with confidence) in their session greeting, with context-engine skill rules telling Larry how to present it naturally.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add opportunity bank summary to session-start | bf7fd5d | scripts/session-start |
| 2 | Update context-engine SKILL.md with greeting rules | 89c7952 | skills/context-engine/SKILL.md |

## What Changed

### scripts/session-start
- Added ONBD-04 block: computes OPP_BANK_SUMMARY from opportunity-ops.cjs listOpportunities
- Sorts opportunities by confidence, extracts top problem, count, risk/uncertainty split
- Injected into all three context tiers (minimal, balanced, rich) after RETURNING_USER_HINT
- Fully fault-tolerant: missing opportunity-ops module or empty bank produces empty string

### skills/context-engine/SKILL.md
- New section "Opportunity Bank in Session Greeting" with Larry behavior rules
- Updated return greeting template to include opportunity count and strongest lead
- Clear rule: only mention when [Opportunity Bank] context is present, never mention empty bank

## Decisions Made

1. Inline node eval for opportunity bank computation -- consistent with existing session-start patterns (SCRATCHPAD_SUMMARY, ARCHETYPE_JSON)
2. Sort by confidence descending to surface the strongest opportunity first
3. Include risk/uncertainty split so Larry can coach on converting uncertainty to risk

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all data paths are wired to live opportunity-ops.cjs functions.

## Self-Check: PASSED

- scripts/session-start: exists, OPP_BANK_SUMMARY x8 occurrences, ONBD-04 present, bash -n passes
- skills/context-engine/SKILL.md: exists, "Opportunity Bank" section present, "banked opportunities" in greeting
- Commit bf7fd5d: confirmed in git log
- Commit 89c7952: confirmed in git log
