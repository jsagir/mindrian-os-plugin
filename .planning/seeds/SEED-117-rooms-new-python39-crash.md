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
