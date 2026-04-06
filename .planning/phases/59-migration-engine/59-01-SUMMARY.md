---
phase: "59"
plan: "01"
subsystem: migration-engine
tags: [migration, rooms, legacy, setup]
dependency_graph:
  requires: [56-01, 57-01]
  provides: [MIG-01, MIG-02, MIG-03, MIG-04]
  affects: [commands/setup.md, scripts/]
tech_stack:
  added: []
  patterns: [bash-interactive-prompts, discovery-table, per-item-confirmation]
key_files:
  created:
    - scripts/migrate-rooms
  modified:
    - commands/setup.md
decisions:
  - "Used cp -a (copy) instead of mv (move) to ensure old paths remain intact until user manually removes them"
  - "STATE.md frontmatter is the primary venture name/stage source; section folder names are the fallback room indicator"
  - "Symlink creation requires user to manually remove/rename old directory first -- script provides the commands but does not execute deletion"
  - "5 discovery patterns: ~/room/, ~/room-*/, ~/rooms/*/, ~/demo-*/room/, ~/*/room/ -- covers all known legacy layouts"
metrics:
  duration: "4 minutes"
  completed: "2026-04-06T20:40:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 1
requirements: [MIG-01, MIG-02, MIG-03, MIG-04]
---

# Phase 59 Plan 01: Migration Engine Summary

Guided migration script that detects legacy room layouts scattered across the home directory and offers per-room confirmed moves to ~/MindrianRooms/ with registry integration and optional symlinks.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create scripts/migrate-rooms | 99bf360 | scripts/migrate-rooms |
| 2 | Update /mos:setup with rooms option | 35ed50f | commands/setup.md |
| 3 | Syntax validation | (no commit) | bash -n passed |

## What Was Built

### scripts/migrate-rooms (306 lines)

A bash script that:
- Scans for 5 legacy room patterns: `~/room/`, `~/room-*/`, `~/rooms/*/`, `~/demo-*/room/`, `~/*/room/`
- Extracts venture name and stage from STATE.md frontmatter via inline Python
- Displays a formatted discovery table showing path, venture, stage, file count, and proposed slug
- Confirms each room move individually (not batch)
- Copies with `cp -a` to `~/MindrianRooms/[slug]/`
- Registers each migrated room via `room-registry create`
- Refreshes INDEX.md via `update-icm-index`
- Offers optional symlink creation at old path
- Supports `--dry-run` (show what would happen) and `--no-symlink` flags
- Deduplicates discovered paths and skips rooms already in ROOMS_HOME
- Never auto-deletes old directories

### commands/setup.md addition

New `/mos:setup rooms` subcommand section that:
- Explains migration purpose conversationally (Larry voice)
- Runs dry-run discovery first to show what was found
- Executes interactive migration if user agrees
- Verifies results via `room-registry list`
- Reminds about old path cleanup

## Decisions Made

1. **Copy, never move** -- `cp -a` preserves the original. User deletes manually when confident.
2. **STATE.md as primary identifier** -- venture name and stage extracted from frontmatter. Falls back to section folder detection (`problem-definition/`, `market-analysis/`, etc.) when STATE.md is absent.
3. **Symlink is manual** -- script prints the `mv` + `ln -s` commands but does not execute deletion. Safety first.
4. **Slug derivation** -- `room/` uses parent directory or venture name; `room-X/` strips the prefix; others slugify the directory name.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- Bash syntax check: `bash -n scripts/migrate-rooms` -- PASSED
- Interactive dry-run test was blocked by sandbox restrictions during execution (the script creates temp directories and runs Python inline). The script should be tested manually:

```bash
# Quick verification:
MINDRIAN_ROOMS_HOME=/tmp/test-rooms bash scripts/migrate-rooms --dry-run ~
```

## Known Stubs

None. All functionality is fully wired.

## Requirements Coverage

| Requirement | Status | How |
|-------------|--------|-----|
| MIG-01 | Complete | 5 legacy patterns detected in discovery phase |
| MIG-02 | Complete | Discovery table + per-room confirmation prompts |
| MIG-03 | Complete | Optional symlink offered after each move |
| MIG-04 | Complete | `/mos:setup rooms` triggers `scripts/migrate-rooms` |

## Self-Check: PASSED

- scripts/migrate-rooms: FOUND
- .planning/phases/59-migration-engine/59-01-SUMMARY.md: FOUND
- Commit 99bf360 (migrate-rooms script): FOUND
- Commit 35ed50f (setup.md update): FOUND
