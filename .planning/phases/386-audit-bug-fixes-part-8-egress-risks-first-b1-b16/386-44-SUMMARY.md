---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "44"
subsystem: room-state
tags: [B17, windows-path, wsl, section-table]
requires: [386-01, 386-33]
provides:
  - a Windows drive path is mapped or refused where it is read; a section row is never a path
key-files:
  created:
    - .planning/debug/room-section-table-lists-the-room-own-windows-path.md
    - tests/test-386-section-table-no-path-rows.cjs
  modified:
    - lib/core/platform.cjs
    - lib/core/room-db.cjs
    - lib/core/resolve-active-room.cjs
    - lib/core/section-registry.cjs
    - lib/core/room-render-state.cjs
    - lib/core/room-render-analyze.cjs
decisions:
  - "Fix both ends: the writer and readers of the drive path string, and the row list (a defence for a stray folder that already exists)"
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 44: Section table never lists a path (B17) Summary

The room state table no longer lists a Windows-style path as a section. Root cause (PROVEN on synthetic fixtures): a Windows drive path string reaches `openRoomDb` on a POSIX system; `path.resolve` reads it as a relative name, so a folder with that literal name and a blank `room.db` is created inside the working folder; `renderState` then lists every non-dot folder as a section, with 0 entries.

## What changed

- `lib/core/platform.cjs`: `isWindowsDrivePath` and `windowsDrivePathToPosix` (maps `C:\a` to `/mnt/c/a` only when that folder exists; otherwise null; win32 unchanged). No such helper existed (`toBashPath` only swaps slashes).
- `openRoomDb`: maps the string or throws `EROOMPATH` before anything is created. The open mode, journal mode, timeout and migrations are unchanged.
- `registryRoomPath`, `resolveActiveRoom`, `resolveActiveOwnership`: map or ignore the drive string. This also stops the stray folder from being taken as the room.
- `renderState`: maps the room argument (unreachable gives "No room directory found."); skips path-like folder names.
- `discoverSections` (section-registry and room-render-analyze): skip path-like folder names via `isPathLikeSectionName`.

## Deviations from Plan

**1. [Plan assumption wrong] renderState does not use discoverSections**
- The plan key link said section rows come from `discoverSections`. The code globs the room folder directly. The RCA records both; the row filter was added to both lists.

**2. [Rule 3 - scope] Files beyond the plan frontmatter**
- Named in the RCA line `files_to_touch` before any edit: `lib/core/platform.cjs`, `lib/core/room-db.cjs`, `lib/core/resolve-active-room.cjs`, `lib/core/room-render-analyze.cjs`.

## Verification

- RED c6c364eb3: BR1 to BR4 (incl. BR3a to BR3e) fail, BRP1 and BRP2 pass. GREEN 2e37f4068: all 10 arms ok.
- `bash tests/run-all-196.sh`: 7 passed, 0 failed. `TEST_386_PREFIX=tests/test-386-section-table- bash tests/run-all-386.sh`: the new test PASSED.
- 27 related tests compared with the baseline: no new failure. Red before and after: test-vi3-icm-walk (I8c), test-270-resource-session-room, test-tool-router-active-room-misroute (the last two also red at HEAD in a clean archive copy).

## Owner action (no real path)

A stray folder in a real room whose name looks like a Windows path (`C:\Users\...`) and that holds only a `.mindrian` folder with a blank `room.db` can be removed after checking it holds nothing of value. This plan did not touch any real room.

## Unverified

The real source of the Windows-style string in the owner's session (registry entry or environment value) was not read by rule. The macOS and win32 paths are unchanged by construction; only Linux (WSL) was run.

## Self-Check: PASSED

Files and commits c6c364eb3, 2e37f4068 exist.
