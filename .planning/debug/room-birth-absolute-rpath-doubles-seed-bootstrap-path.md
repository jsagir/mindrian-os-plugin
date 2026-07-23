---
status: investigating
kind: rca
trigger: "room-birth-absolute-rpath-doubles-seed-bootstrap-path"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: local-only
canon_parts: []
created: 2026-07-23T04:45:00Z
updated: 2026-07-23T04:45:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: `lib/core/navigation/room-birth.cjs` STEP 4 passes the room's ABSOLUTE `roomDir` as the `RPATH` positional argument into `scripts/room-registry create`, but that script's `_seed_room_bootstrap` helper (and the `create` stanza's own `mkdir -p "${ROOMS_HOME}/${RPATH}"` / `ROOMDIR="${ROOMS_HOME}/${RPATH}"` lines) assume `RPATH` is relative and unconditionally prefix it with `ROOMS_HOME`, producing a doubled, nonexistent path (e.g. `/home/x/MindrianRooms//home/x/MindrianRooms/room`) for every room created via `birthRoom()` (the real, gated room-creation path -- not the legacy markdown-prose adoption path).
test: create a real room via the `/mos:ignite` -> `birthRoom()` path and inspect whether `USER.md`/`ROOM.md` (the files `_seed_room_bootstrap` is supposed to write) land at the correct room directory or at a doubled/garbage path; separately confirm whether the room still functions despite this (e.g. because some other code path re-derives the correct directory and silently tolerates the seed miss).
expecting: either (a) USER.md/ROOM.md are genuinely missing/misplaced for `birthRoom`-created rooms today, a real user-facing gap, or (b) some other guard already no-ops the seed step gracefully when the doubled path does not exist, meaning the bug is real but currently silent/low-impact rather than corrupting.
next_action: read `lib/core/navigation/room-birth.cjs` STEP 4's exact call signature into `scripts/room-registry create`, and `scripts/room-registry`'s `create` stanza's RPATH handling (including `_seed_room_bootstrap`), to confirm the doubled-path claim precisely and classify actual impact.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.37
- Reported by: gsd-plan-checker, found as a side effect while verifying the 260723-ad9 current_room-writer quick task plan (not the task's own subject -- explicitly scoped out of that fix)
- Date first observed: 2026-07-23
- Related debug sessions: `.planning/quick/260723-ad9-wire-current-room-writer-into-room-creat/` (the plan that surfaced this while verifying `scripts/room-registry`'s `create` stanza and `room-birth.cjs` STEP 4 in detail); `.planning/debug/statusline-active-room-leah-gap.md` (sibling finding in the same investigation arc, unrelated bug, same files)

## Problem Statement

`lib/core/navigation/room-birth.cjs`'s room-creation path (`birthRoom()`, the real gated creator) may hand `scripts/room-registry create` an absolute path where the script's own `RPATH` handling assumes relative, doubling the path prefix and potentially misplacing (or entirely skipping) the room's seeded `USER.md`/`ROOM.md` identity files.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: every room created via `birthRoom()` gets its `USER.md`/`ROOM.md` correctly seeded at `<ROOMS_HOME>/<slug>/`.
actual: not yet directly observed against a real created room -- this finding originates from a plan-checker's static read of the two files' path-handling logic (see `.planning/quick/260723-ad9-.../260723-ad9-PLAN.md`'s own noted key_links warning), not yet confirmed against a live repro.
errors: none yet captured live; static-analysis finding only so far.
reproduction:
  1. Run `/mos:ignite` (or the equivalent flow) to create a genuinely new room through `birthRoom()`.
  2. Inspect whether `USER.md` and `ROOM.md` exist at the room's real directory.
  3. If missing, check whether `scripts/room-registry`'s registry.json entry for that room shows a doubled/garbage path.
started: unknown -- `birthRoom()` and `_seed_room_bootstrap` are both pre-existing; not yet dated to a specific phase/commit.

## Scope and Impact

- Affected surfaces: cli (room creation is a CLI/MCP-driven flow)
- Affected commands: `/mos:ignite`'s B2 approve gate (the only path that calls `birthRoom()`)
- Affected users: potentially every user who creates a room via the real gated `birthRoom()` path (not the legacy adoption path, which uses a different, unaffected route)
- Version range: unknown, likely long-standing (not introduced by anything this session touched)
- Severity: medium -- if confirmed, new rooms may silently lack their ICM Layer 0 identity files (USER.md/ROOM.md), which several other systems assume exist
- Blast radius: unknown until confirmed live; `scripts/room-registry`'s `create` stanza and `_seed_room_bootstrap` helper are shared by every room-creation path

## Eliminated

(none yet -- static finding only, live reproduction not yet run)

## Evidence

- timestamp: 2026-07-23T04:44:00Z
  checked: `gsd-plan-checker`'s independent verification of the 260723-ad9 plan (current_room writer), which read `lib/core/navigation/room-birth.cjs` STEP 4 (line ~1015) and `scripts/room-registry`'s `create` stanza (lines ~171/177) in full while confirming a DIFFERENT, already-fixed-in-that-plan path bug.
  found: "`room-birth.cjs` STEP 4 (line 1015) passes the ABSOLUTE `roomDir` as RPATH, with `roomsHome` as the leading positional arg. The existing create stanza then does `mkdir -p \"${ROOMS_HOME}/${RPATH}\"` and `ROOMDIR=\"${ROOMS_HOME}/${RPATH}\"` (lines 171/177), which for an absolute RPATH produces a doubled garbage path." The 260723-ad9 plan's own `_write_current_room` helper works around this correctly for its own narrow purpose (resolving `REAL_ROOMDIR` conditionally on whether RPATH is absolute), but that workaround does not touch `_seed_room_bootstrap`, which the checker separately flagged: "the plan deliberately leaves the `_seed_room_bootstrap` doubled-path bug for the absolute-RPATH (birthRoom) case in place (explicitly out of scope) ... for birthRoom-created rooms the writer's case-1 mints a fresh minimal STATE.md at the correct dir rather than upserting into a seeded one ... the underlying seed bug (USER.md/ROOM.md landing at a garbage path for absolute RPATH) is a real latent defect worth its own follow-up."
  implication: this is a real, independently-discovered, unconfirmed-live bug, distinct from the current_room writer work. Worth its own investigation session before any fix is attempted.

## Technical Root Cause

Not yet confirmed live -- static-analysis hypothesis only (see Current Focus). The next session picking this up should start with the reproduction steps above before writing any fix.

## Required Code Changes

Not yet determined -- root cause not yet confirmed live.

## Tests to Add or Update

Not yet determined.

## Non-Code Follow-ups

- Do NOT fold this into the 260723-ad9 current_room-writer quick task -- navigator explicitly chose "log it, keep going" over folding it in, to keep that fix's scope clean.
- Once reproduced live, file the concrete root cause and fix as a proper follow-up quick task or debug session.
