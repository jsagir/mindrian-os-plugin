---
phase: 35-interactive-onboarding
plan: 01
title: "First-Install Detection and Session-Start Wiring"
subsystem: onboarding
tags: [onboarding, detection, session-start, cold-start]
dependency_graph:
  requires: []
  provides: [check-onboard-script, session-start-onboarding-wiring]
  affects: [session-start, cold-start-flow]
tech_stack:
  added: []
  patterns: [marker-file-detection, sort-V-comparison, 3-way-context-injection]
key_files:
  created:
    - scripts/check-onboard
  modified:
    - scripts/session-start
decisions:
  - "Marker file at ~/.mindrian-onboarded with version line 1, date line 2"
  - "COLD_START_MENU extracted as shared variable for all 3 branches"
  - "FIRST_INSTALL context includes deep onboarding with 3 input approaches and USER.md building"
  - "UPDATE context checks for structured onboard_steps before falling back to raw CHANGELOG diff"
metrics:
  duration: "5min"
  completed: "2026-03-31"
  tasks_completed: 2
  tasks_total: 2
  files_touched: 2
---

# Phase 35 Plan 01: First-Install Detection and Session-Start Wiring Summary

Bash detection script distinguishing FIRST_INSTALL/UPDATE/CURRENT via marker file comparison, wired into session-start cold-start branch with 3-way context injection for onboarding, whats-new, and normal flow.

## What Was Built

### scripts/check-onboard (42 lines)
- Detects onboarding status by reading `~/.mindrian-onboarded` marker file
- No marker = FIRST_INSTALL, stale version = UPDATE, matching version = CURRENT
- `--write` flag creates marker with current version + UTC date
- Follows check-update pattern: `set -euo pipefail`, `sort -V` comparison, python3 version read
- No network calls, pure file I/O, under 100ms execution

### scripts/session-start (cold-start branch modification)
- After banner fires (unchanged), calls check-onboard to determine status
- FIRST_INSTALL: injects Larry-voiced onboarding context with signature openers, deep context building (Q&A / document paste / skip), USER.md creation, natural-language-first capability presentation (D-NEW-2)
- UPDATE: extracts previous version, parses CHANGELOG for structured onboard_steps (D-NEW-1) or falls back to raw diff, frames changes as capabilities
- CURRENT: preserves exact existing cold-start menu (zero behavior change for current users)
- All branches end with the standard cold-start command menu
- Banner logic completely preserved
- No emoji in any injected context string

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a9a7433 | Create check-onboard detection script |
| 2 | 5c2e103 | Wire check-onboard into session-start cold-start branch |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is wired and operational.

## Verification Results

- FIRST_INSTALL detection: PASS (no marker outputs FIRST_INSTALL)
- Marker write: PASS (--write creates file with version + date)
- CURRENT detection: PASS (matching marker outputs CURRENT)
- UPDATE detection: PASS (stale marker outputs UPDATE)
- Session-start integration: PASS (3+ check-onboard references, FIRST_INSTALL/UPDATE branches)
- Banner preservation: PASS (lines 139-140 unchanged)
- Bash syntax: PASS (bash -n validates)

## Self-Check: PASSED
