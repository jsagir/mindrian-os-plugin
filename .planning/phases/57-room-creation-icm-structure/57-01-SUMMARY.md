---
phase: "57"
plan: "01"
subsystem: room-management
tags: [icm, rooms, templates, indexing]
dependency_graph:
  requires: [resolve-room, room-registry]
  provides: [update-icm-index, icm-templates]
  affects: [new-project, rooms]
tech_stack:
  added: []
  patterns: [bash-with-inline-python, atomic-write, idempotent-scripts]
key_files:
  created:
    - templates/icm/CLAUDE.md
    - templates/icm/INDEX.md
    - scripts/update-icm-index
  modified:
    - commands/new-project.md
    - commands/rooms.md
decisions:
  - ICM Layer 0 template is concise (identity + structure rules + navigation)
  - ICM Layer 1 template is a skeleton with empty table populated by update-icm-index
  - update-icm-index is bash + inline Python matching resolve-room and room-registry patterns
  - INDEX.md counts .md entries per room excluding STATE/ROOM/USER/INDEX/CLAUDE
  - Archive detection handles both registry archived rooms and _archive/ directory
metrics:
  duration: "5 minutes"
  completed: "2026-04-06T20:34:00Z"
requirements:
  - CREATE-01
  - CREATE-02
  - CREATE-03
  - CREATE-04
  - ICM-01
  - ICM-02
  - ICM-03
  - ICM-04
---

# Phase 57 Plan 01: Room Creation & ICM Structure Summary

ICM-compliant room creation under ~/MindrianRooms/ with auto-generated Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md), plus idempotent INDEX.md refresh on every room lifecycle event.

## What Was Built

### 1. ICM Templates (templates/icm/)

**CLAUDE.md (Layer 0 -- Identity):** Answers "Where am I?" with ICM layer explanation, structure rules (no nesting, _archive/ for retired rooms, registry is machine-readable index), and navigation instructions.

**INDEX.md (Layer 1 -- Routing):** Skeleton template with empty Active Rooms and Archive tables. Populated dynamically by update-icm-index from registry.json.

### 2. update-icm-index Script (scripts/update-icm-index)

Bash script with inline Python that reads `$ROOMS_HOME/.rooms/registry.json` and regenerates `$ROOMS_HOME/INDEX.md`:

- Counts .md entries per room (walks directory tree, excludes STATE/ROOM/USER/INDEX/CLAUDE.md)
- Formats dates from registry timestamps
- Separates active vs archived rooms into distinct tables
- Detects `_archive/` subdirectories independently of registry
- Atomic write (tmp + mv)
- Idempotent -- safe to call after any room operation
- Tested against real ~/MindrianRooms with 6 rooms: produced correct table with entry counts

### 3. Updated /mos:new-project Command

- Room path resolves via `$ROOMS_HOME` (was workspace-relative `rooms/` or `room/`)
- ICM Layer 0/1 auto-generated from templates before first room creation (CREATE-03)
- Calls `update-icm-index` after room registration (ICM-03)
- All path references updated: USER.md, .context/, compute-state, git setup

### 4. Updated /mos:rooms Command

- Create subcommand resolves ROOMS_HOME, adds Step 2.5 for ICM auto-generation
- Create, archive, and close subcommands all call `update-icm-index` after state changes (ICM-03)
- Close subcommand references central registry at `$ROOMS_HOME/.rooms/registry.json`

## Requirements Fulfilled

| Requirement | Status | Evidence |
|-------------|--------|----------|
| CREATE-01 | Complete | new-project creates rooms at $ROOMS_HOME/<slug>/ |
| CREATE-02 | Complete | rooms create targets $ROOMS_HOME/<slug>/ |
| CREATE-03 | Complete | ICM files auto-generated from templates/icm/ if missing |
| CREATE-04 | Complete | room-registry writes to $ROOMS_HOME/.rooms/registry.json (Phase 56) |
| ICM-01 | Complete | CLAUDE.md template declares identity with ICM layers |
| ICM-02 | Complete | INDEX.md provides routing table with room/stage/entries |
| ICM-03 | Complete | update-icm-index called after create, archive, close, stage change |
| ICM-04 | Complete | No change to per-room STATE.md -- compute-state still generates it |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- update-icm-index tested against real ~/MindrianRooms (6 active rooms, 2 archive dirs)
- room-registry create tested in isolated temp directory -- creates room dir and registry
- All 8 requirements mapped and verified

## Commits

| Hash | Message |
|------|---------|
| b7da403 | feat(57-01): add ICM Layer 0 and Layer 1 templates |
| 1edee8c | feat(57-01): add update-icm-index script for INDEX.md auto-refresh |
| 7f34886 | feat(57-01): update new-project command to use ROOMS_HOME and ICM auto-generation |
| 29b8fd3 | feat(57-01): update rooms command for ROOMS_HOME, ICM auto-gen, and INDEX.md refresh |

## Self-Check: PASSED

- templates/icm/CLAUDE.md: FOUND
- templates/icm/INDEX.md: FOUND
- scripts/update-icm-index: FOUND
- commands/new-project.md: FOUND (modified)
- commands/rooms.md: FOUND (modified)
- 57-01-SUMMARY.md: FOUND
- Commits b7da403, 1edee8c, 7f34886, 29b8fd3: ALL FOUND
