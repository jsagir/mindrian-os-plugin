---
phase: 23-multi-room-management
plan: 02
subsystem: commands
tags: [multi-room, rooms-command, new-project, registry]
dependency_graph:
  requires: [23-01]
  provides: ["/mos:rooms command", "registry-aware new-project"]
  affects: [commands/rooms.md, commands/new-project.md]
tech_stack:
  added: []
  patterns: [registry-aware commands, 3-case workspace detection, slug normalization]
key_files:
  created: [commands/rooms.md]
  modified: [commands/new-project.md]
decisions:
  - "/mos:rooms new creates structure only - deep conversation deferred to /mos:new-project"
  - "new-project Step 1 detects 3 workspace states: registry, legacy room/, empty"
  - "Legacy room/ path preserved for backward compatibility when no registry"
metrics:
  duration: 2min
  completed: "2026-03-29T17:05:00Z"
---

# Phase 23 Plan 02: /mos:rooms Command and new-project Registry Support Summary

/mos:rooms command with 6 subcommands (list, new, open, close, archive, where) plus registry-aware new-project updates

## What Was Built

### commands/rooms.md (Task 1)
Full `/mos:rooms` command specification with 6 subcommands following Body Shape B (Semantic Tree) and 4-zone anatomy per the UI Ruling System:

- **list**: Shows all rooms with status indicators (active/parked/archived), entry counts, and switch suggestions
- **new**: Creates room directory structure at rooms/<slug>/, registers in registry, sets as active
- **open**: Switches active room with archive reopening confirmation
- **close**: Parks the active room, clears active field
- **archive**: Archives a room with active-room safety check
- **where**: Shows current active room details (path, venture, stage, last opened)

Includes natural language mapping for Desktop surface, 3-line error format, cross-surface notes for CLI/Desktop/Cowork.

### commands/new-project.md (Task 2)
Updated Step 1 to handle three workspace states:
1. Registry exists - multi-room mode, creates at rooms/<slug>/
2. No registry but room/ exists - offers adoption into registry
3. No registry, no room/ - first project, uses legacy room/ path

Step 4 branches on workspace mode for room directory creation and registration. Step 7 uses resolved room path for compute-state. Steps 2, 3, 5, 6, 8, 9 unchanged.

## Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| 1 | f7cdc15 | commands/rooms.md | /mos:rooms command with 6 subcommands |
| 2 | 26a65d8 | commands/new-project.md | Registry-aware new-project |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - both files are command specifications (markdown instruction files) that reference scripts from Plan 23-01. The scripts (resolve-room, room-registry) must exist for runtime execution but are not stubs in these files.

## Self-Check: PASSED
