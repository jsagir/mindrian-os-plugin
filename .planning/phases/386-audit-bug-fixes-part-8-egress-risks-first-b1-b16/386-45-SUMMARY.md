---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "45"
subsystem: room-readiness
tags: [B18, room-db, wsl, drvfs, honest-message]
requires: [386-01, 386-33]
provides:
  - a typed cause for room_db_unreadable (busy, io, cannot_open, not_a_database, other) with a plain line per cause
key-files:
  created:
    - .planning/debug/room-db-reported-unreadable-on-a-windows-drive-from-wsl.md
    - tests/test-386-room-db-unreadable-message.cjs
  modified:
    - lib/core/room-readiness.cjs
    - lib/core/navigation/spine-events.cjs
    - lib/core/graph-backfill.cjs
    - scripts/session-start
decisions:
  - "Owner decision on a journal or open mode change: not-needed. WAL works on the 9p Windows drive."
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 45: Honest cause for an unreadable room.db (B18) Summary

The refusal for an unreadable room.db now names the real cause class. The reason stays `room_db_unreadable`; a new `cause` field and a plain requirement line say busy, io, cannot_open, not_a_database or other. The open mode, journal mode, timeout and migrations are unchanged.

## Lock cause tested first (PROVEN, synthetic file, new scratch folder under /mnt/c, 9p drvfs mount)

- WAL works on the drive: openRoomDb opened a synthetic room.db in 80 ms with journal_mode wal; the read-only identity read worked. A DELETE-journal copy read the same.
- A second WSL process holding a write lock: the write open waited 5154 ms and threw RoomDbBusyError (typed busy works on the drive); the read-only read still succeeded.
- A Windows process holding the file with no sharing (FileShare None): openRoomDb threw a raw error with SQLite code 14 (cannot open), which classifyOpenFailure does not type; readRoomIdentity returned "read-only open returned no handle"; the requirement line said damaged. This reproduces the reported message on a healthy file. After the fix the line reads: "room.db could not be opened: the path or the drive refused access, or another program holds the file (a Windows drive read from WSL)".
- The scratch folders (two runs) were deleted; no file of the owner was read, opened, copied or listed.

## What changed

- `lib/core/room-readiness.cjs`: `causeOfError`, `unreadableCause`, `requirementFor`, `CAUSE_LINES`; `readinessFor` adds `cause`. `readIdentity` keeps the thrown error (hidden property).
- `lib/core/navigation/spine-events.cjs`: `probeRoomDbReadOnly`, the one local read-only probe for a result that has no error (room-identity drops it).
- `lib/core/graph-backfill.cjs` and `scripts/session-start`: the session-start readiness line prints the cause line.

## Owner decision (Task 3)

`mode_change_needed: no`, so `decision: not-needed` was recorded in the RCA without asking. Options B and C are not needed.

## Deviations from Plan

**1. [Rule 3 - blocking] The probe moved to spine-events.cjs**
- The pre-commit chokepoint check refused `require('node:sqlite')` in room-readiness.cjs. A first move to room-identity.cjs broke tests/test-36925-rid-repair.cjs M1 (that module may not require node:sqlite). It now sits beside `openRoomDbReadOnlyForCaller` in spine-events.cjs. `lib/core/navigation/spine-events.cjs`, `lib/core/graph-backfill.cjs` and `scripts/session-start` were added to the RCA files_to_touch line.
- Commits: 575616b8b, 4b1f33a20.

## Verification

- RED 2d4c3947b: RM1, RM2, RM3, RM5, RM6, RM8, RM9 fail, RM4 and RM7 pass. GREEN: 9 of 9 ok.
- `bash tests/run-all-196.sh` 7 of 7; `TEST_386_PREFIX=tests/test-386-room-db-unreadable bash tests/run-all-386.sh` PASS.
- About 45 tests naming room-readiness, graph-backfill, room-identity or spine-events equal their baseline. Red before and after: test-233-graph-heal-pipeline, run-all-383, run-all-224 (same failing lines). run-all-233 and run-all-379.1 were red or timed out in the baseline and were not rerun (long). test-muy-real-room-rule was red once in the baseline, green on later runs, and red once under load (flaky).

## Risk left (not changed)

`repairRoomIdentity` moves room.db aside on any open failure after an approved recovery (`moveAsideUnreadable`). With a false unreadable this could move a healthy file aside. Guard it by cause (only not_a_database) in a separate plan.

## Unverified

The owner's real session-start failure was not reproduced (real file never opened). The Windows-hold cause is proven for a synthetic file only.

## Self-Check: PASSED

Commits 9fe6a0c9a, 2d4c3947b, 575616b8b, 4b1f33a20 exist; both new files exist.
