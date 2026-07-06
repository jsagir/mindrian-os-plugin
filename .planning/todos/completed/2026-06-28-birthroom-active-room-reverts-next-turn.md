---
created: 2026-06-28T11:30:30.000Z
title: birthRoom active-room reverts next turn and blocks writes to the new room
area: navigation
version_found: v1.15.0-beta.9
files:
  - lib/core/navigation/room-birth.cjs (STEP 4 room-registry create / active flip)
  - scripts/write-scope-check.cjs
  - lib/core/resolve-active-room.cjs
  - scripts/room-registry (set-active / get-active)
---

## Problem

Found while live-testing /mos:ignite in v1.15.0-beta.9. After birthRoom() created a new room
and (per STEP 4) flipped the registry active pointer to it, the new room became UN-WRITABLE
one turn later:

1. birthRoom returned ok:true; an immediate read of registry.json showed active = the new
   room (haim-battlefield-intake), and the first 4 Write calls to it SUCCEEDED (auto-committed).
2. On the NEXT user turn, the write-scope-check PreToolUse hook BLOCKED a write to that same
   room: "Blocked: write to haim-battlefield-intake denied. Active room is iia-deeptech-centers."
3. `room-registry get-active` then returned iia-deeptech-centers - i.e. the active pointer had
   reverted between turns. Manual `room-registry set-active haim-battlefield-intake` fixed it
   and writes resumed.

So the freshly-birthed room's active status does not survive across turns. Likely a
session-level active-room source (strict-mode pin / session state / a session-start or
UserPromptSubmit hook) re-asserts the prior active room and overrides the registry flip that
birthRoom performed. The registry and the session/write-guard notion of "active" have
diverged.

## Impact

The canonical front door (/mos:ignite -> birthRoom) produces a room you cannot write to on
the very next turn without a manual set-active. Breaks the B3 first-win flow and any
post-birth filing.

## Solution

TBD. Candidate directions:
- Make birthRoom set the SAME active-room source the write-scope guard reads (not only the
  registry pointer) - one source of truth.
- Identify what re-pins the prior active room between turns (strict-mode override? session
  pin?) and have it honor a just-born room.
- Add a regression test: birth a room, simulate a turn boundary, assert get-active == new
  room AND a write to the new room passes write-scope-check.
