---
created: 2026-06-28T11:31:00.000Z
title: ROOM.md and artifact frontmatter schema drift vs scaffold and existing rooms
area: room
version_found: v1.15.0-beta.9
files:
  - lib/core/room-skeleton-scaffold.cjs (scaffold ROOM.md template)
  - PostToolUse write cascade / schema validator hook
  - data/room-blueprints.json
---

## Problem

Found while filing artifacts during /mos:ignite testing in v1.15.0-beta.9. The PostToolUse
schema validator flags frontmatter that the scaffold itself (and existing rooms) do not write,
so almost every hand-filed artifact and ROOM.md trips a "schema violation" warning:

1. **Section artifacts** - the validator wants `title:` and `status:`. Files written with the
   new-project documented frontmatter (source/date/section) flagged: "schema violation: title,
   status". Adding title + status cleared it.
2. **ROOM.md identity files** - the validator wants `name:`, `type:`, `section:`. But the live
   scaffold + existing rooms write `room_id / venture_name / venture_stage / created`
   (verified against iris2026/sub-rooms/cohort-testers/ROOM.md). A freshly written ROOM.md
   with section/purpose flagged: "schema violation: name, type, section". Adding name + type +
   section cleared it.

So three different frontmatter shapes are in play (validator-required, scaffold-written,
historically-written) and they disagree. The validator warns but does not block, and the
cascade still auto-commits - so the warnings are pure noise today, but they signal real drift:
the scaffold produces ROOM.md files that fail the room's own validator.

## Impact

- Every birth produces ROOM.md files that immediately fail the validator (the scaffold and
  validator disagree).
- Larry-filed artifacts warn unless Larry happens to add title/status, which is undocumented.
- The warning message lists keys without saying whether they are required-and-missing or
  unexpected - ambiguous to act on.

## Solution

TBD. Candidate directions:
- Pick ONE canonical schema per file type (ROOM.md identity vs section artifact) and
  reconcile: scaffold writer, validator, and docs (new-project.md ROOM.md template) all to it.
- Make the scaffold emit the validator-required keys at birth so newborn rooms pass clean.
- Improve the violation message to name required-missing vs unexpected keys.
- Add a test: scaffold a room, run the validator over every generated ROOM.md / STATE.md, and
  assert zero violations (scaffold output must satisfy the room's own schema).
