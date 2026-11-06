---
status: fixing
kind: rca
trigger: "restore-post-compact-context-contribute-always-empty"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T13:00:00Z
updated: 2026-11-06T13:00:00Z
---

target: PRESENT

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ b7323cdc1 in the dev workspace copy /home/jsagi/dev/MindrianOS-Plugin-release (Phase 386 plan 10).
- **WIRE claims probe against:** none. No network. Fixture room in a temporary folder and a temporary HOME.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding.

## Current Focus

hypothesis: contribute() in scripts/restore-post-compact-context.cjs calls readSideChannel() with no roomDir, so path.join(undefined) throws a TypeError, and the catch returns the empty fragment. Reading further, contribute() has 2 more faults on the same path.
test: Call contribute() against a fixture room that holds a synthetic last-post-compact.md.
expecting: empty fragment, side-channel file untouched.
next_action: Fix all 3 faults in contribute().

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.x on main
- Reported by: auditor finding B9
- Date first observed: 2026-11-05
- Related debug sessions: post-compact-two-session-rows-and-sessionstart-envelope-fallback

## Problem Statement

The SessionStart coordinator loads contribute() from the post-compact consumer. contribute() never returns the side-channel fragment, so context saved at compaction never reaches the next turn through the coordinator.

## Symptoms

expected: contribute() returns a non-empty fragment when the active room holds a fresh, stamped last-post-compact.md.
actual: returns `{has_payload:false}`.
errors: `readSideChannel()` with no argument throws TypeError (path.join argument undefined); the catch hides it.
reproduction:
  1. Fixture room with .mindrian/last-post-compact.md carrying the 4-key stamp.
  2. Registry in the temporary HOME that names the room as active.
  3. require the consumer and call contribute().
started: Phase 121.5-00 added the contributor surface.

## Evidence

- Anchor 1: scripts/restore-post-compact-context.cjs, function `contribute`, line `sc = readSideChannel();` (no roomDir).
- Anchor 2: same function, line `activeRoom = getActiveRoom();` (no workDir; the folder-memory fallback of getActiveRoom needs it).
- Anchor 3: same function, line `validateRoomMatch(sc, activeRoom)`. `sc` is the file record `{path,mtimeMs,content}`. validateRoomMatch reads `stamp.source_room_slug` and `stamp.source_room_path`, which exist only on the parsed stamp (parseStamp). The comparison is always false, so the file is renamed to a "stale" forensic copy and consumed.
- Anchor 4: main() in the same file orders the steps correctly: getActiveRoom, readSideChannel(activeRoom.path), parseStamp, validateRoomMatch(stamp, activeRoom), isFresh, build block, forensic rename.
- PROVEN (fixture run): `readSideChannel()` with no argument throws TypeError.
- PROVEN (fixture run): contribute() returns the key set `has_payload` only, `has_payload` false, with the side-channel file present.
- PROVEN (fixture run): getActiveRoom() and getActiveRoom(workDir) both return null in a fixture with no registry. The coordinator can reach the room through lib/core/resolve-active-room.cjs (honors MINDRIAN_ROOMS_HOME and CLAUDE_ACTIVE_ROOM); the fixed behavior is proven in Task 3.
- Elsewhere in the file: main() resolves the room with getActiveRoom(process.cwd()) (registry first, then folder-memory STATE.md anchor).

## Technical Root Cause

contribute() was written as a copy of main() but the steps were not carried over with their arguments. It reads the side channel without a room directory (throws, caught, empty), it never parses the stamp, and it validates the file record instead of the stamp. So the fragment is empty today, and the first fault masks the other 2. Fixing only the first fault would consume the file as "stale" and still return empty.

## Required Code Changes

- contribute(): resolve the room through lib/core/resolve-active-room.cjs resolveActiveRoom (shared derivation), map to `{slug, path, last_opened}`, then follow main() order: readSideChannel(room.path), parseStamp, validateRoomMatch(stamp, room), isFreshComparedToRegistry, buildTripleContextBlock, forensicRename consumed.
- No active room, no file, no stamp: empty fragment. Never throw. Keep the cross-room check (the file stamped for another room is renamed with the cross-room-skip kind and not returned).

## Tests to Add

- tests/test-386-restore-post-compact-context.cjs: C4 non-empty fragment; C5 empty without a file and without a room, no throw; C6 a file stamped for another room is not returned.

## Resolution

PENDING until Task 3 commit.
