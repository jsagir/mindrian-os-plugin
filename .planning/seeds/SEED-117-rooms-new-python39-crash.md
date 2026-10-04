---
id: SEED-117
title: "/mos:rooms new crashes on Python 3.9 (datetime.UTC is 3.11+): a tester on macOS default Python cannot create a room; the recovery bypassed the room-creation chokepoint"
status: seeded
priority: critical
filed: 2026-10-04
source: live session 2026-10-04 (navigator paste): "bash scripts/room-registry create <slug> exited with AttributeError: module 'datetime' has no attribute 'UTC'"; this machine runs Python 3.9.6
promotes_to: a quick, immediately after 369.2 is planned (or inside its first wave); one-line fix plus a floor test
---

# SEED-117: room creation fails on Python 3.9

## The defect

`scripts/room-registry` (the registry create step of `/mos:rooms new`) calls `datetime.UTC`, which exists only from Python 3.11. macOS ships 3.9.x by default, so a tester following the install path cannot create a room. The fix is `datetime.timezone.utc` (works on every supported Python), plus a floor test that imports every shipped Python entry point under the oldest Python the install path allows, and a doctor point that names the Python version when it is below the floor.

## The second defect, worse than the first

Larry recovered by writing the registry entry directly and initialising room.db by hand. The room was then used for a research run and filings. The sub-room wiring contract (creation atomically wires its side effects or fails closed) was bypassed: the room exists without the chokepoint ever having run. The agent must never hand-build a room; on a creation failure it reports the failure, files the bug and stops. Add that line to the Larry agent body and to the rooms command doctrine, and a test that a failed `room-registry create` leaves no directory behind.

## Also seen

On the CLI the MCP `rooms-new` returns instructions only, so the agent fell back to 31 shell commands and 12 tool calls for one room creation (9 minutes). The CLI path should be one command (`/mos:rooms new <slug>`), which the agent should call rather than reconstruct.

## Addendum 2026-10-04: the earlier bug report (mindrian-bug-room-switch-datetime-utc.md, found 2026-09-18 on beta.43, macOS, Python 3.9.6)

Not only creation. `scripts/room-registry set-active` carries the same `datetime.UTC` call, so
`/mos:rooms switch` fails with `set_active_failed`, and the PreToolUse write-scope guard then
blocks filing to every room except whichever one happens to be active. On stock macOS no room can
be switched and nothing can be filed outside the first room. Four sites in beta.43, still shipped
in beta.57: `scripts/room-registry:296`, `scripts/room-registry:515`, `scripts/resolve-room:157`,
`scripts/on-cwd-changed:97`. `get-active`, `list` and `read` work because they stamp no timestamp,
so the room list looks healthy while every write path is stuck. `lib/core/room-open.cjs`
`runRegistry()` (lines ~109-123) swallows the child's stderr in a bare catch, so the tester sees
only `set_active_failed`. Fix: `datetime.timezone.utc` at all four sites; surface the child stderr
in the failure path; a Python 3.9 floor check (grep for 3.11-only APIs across scripts/, a doctor
point naming the Python version). This report sat unfixed for 16 days: a tester report in
Downloads is not a filing; the next phase adds a doctor point that reads
`~/Downloads/mindrian-bug-*.md` is NOT the answer, a /mos:bug command that files to the plugin
repo's seeds is.
