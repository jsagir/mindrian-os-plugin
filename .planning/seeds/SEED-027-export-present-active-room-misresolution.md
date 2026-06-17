---
kind: seed
status: open
created: 2026-06-17
canon_parts: [1, 9]
severity: high
surfaces: [desktop, cowork]
proving_case: ~/MindrianRooms/aion-eureka-synergy (AION Eureka demo build, 2026-06-16)
qa_ref: .planning/debug/aion-eureka-demo-build-qa-session.md (F2)
source: dogfood (AION C08 demo build)
---

# SEED: export/present MCP tool resolves the WRONG active room

## Defect (observed)
Calling the `export` MCP tool with `command: present` returned room state for a
DIFFERENT room than the active one. During the AION session (active room
`aion-eureka-synergy`) the tool returned a stale room: 35 entries, personas,
meetings, `pdac-investor-red-team.md`, Milken/FIL team roles. It also returned
command-doc guidance text rather than actually invoking the generator.

Workaround used: run `scripts/generate-presentation.cjs` directly against the
explicit room path, which produced correct output (46 artifacts, the room's real
edge types, 67 nodes / 100 edges).

## Why it matters
Silent wrong-room output is high blast radius: every MCP-surface export, dashboard,
wiki, and present call is the Desktop/Cowork path (MCP IS the Desktop surface per
Tri-Polar). A user on Desktop would get another room's data with no error. This
also undermines Canon Part 1 (the room is the navigator's working memory made
legible) and Part 9 (room.db is the local mind) - the wrong mind was read.

## Root cause (hypothesis - needs source reverify against origin/main)
The MCP server's active-room resolution diverges from the CLI registry active
pointer (`.rooms/registry.json` active / `.room-root` sentinel). It likely reads a
cached/global/example room context, or never resolves the active room at all and
echoes a fixture. The session ran on install-cache beta.30; reconcile against
origin/main (beta.31) before fixing.

## Required capability (acceptance)
1. The `export`/`present`/`dashboard`/`wiki` MCP tool MUST resolve the active room
   through the SAME chokepoint as the CLI (the registry `active` pointer /
   `resolveActiveRoom`), never a cached or fixture room.
2. The tool MUST actually invoke `generate-presentation.cjs` (or the shared core)
   against the resolved room path, not return command-doc guidance text.
3. The output MUST echo the resolved room slug, and an internal assertion MUST fail
   loudly if the resolved slug != registry active slug.

## Test
- In a 2-room workspace with room B active, call the export MCP tool and assert the
  rendered room slug == B (registry active), not A.

## Suggested approach (reuse-first, Part 7)
Route the MCP export tool through `lib/core/active-plugin-root.cjs` /
`resolveActiveRoom` (the same resolver the CLI uses), then call the existing
`generate-presentation.cjs`. Add the slug-match assertion. No new resolver.
