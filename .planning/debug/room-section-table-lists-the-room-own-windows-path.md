---
status: fixing
kind: rca
trigger: "room-section-table-lists-the-room-own-windows-path"
issue_id: "B17"
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T13:00:00Z
updated: 2026-11-06T13:20:00Z
---

## Current Focus

hypothesis: H2 (a Windows drive path string is read under POSIX rules) plus H1 (the literal folder it creates is then listed). H3 is eliminated.
test: synthetic fixture rooms in a temporary folder; Windows-style strings are only strings passed to the code.
expecting: openRoomDb creates a folder with the literal Windows name; renderState lists every non-dot folder as a section row.
next_action: write the failing test (Task 2), then fix at the origin (Task 3).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (branch main)
- Source-of-Truth Preamble: CODE claims read against branch main at HEAD 834b83fb2 (2026-11-06). WIRE claims: none, no network used. Date of audit: 2026-11-06. Re-verification: the claims below were each run on a synthetic fixture on this checkout.
- Reported by: auditor finding B17, seen in a real session-start context for a room under /mnt/c read from WSL. The real room was NOT read, copied or listed for this RCA.
- Related debug sessions: plan 386-45 (B18, room.db on a Windows drive)

## Problem Statement

The computed room state (STATE.md text, also inserted at session start) lists the room's own full Windows-style path as a section with 0 entries. A section row must be a section, never a path.

## Symptoms

expected: the Sections table lists only real section folders (problem-definition, market-analysis and so on).
actual: one row whose name is a Windows path, for example C:\Users\...\MindrianRooms\<parent>\<room>, with 0 entries, status Empty, and a matching "No entries" line in the Gaps block.
errors: none (the renderer succeeds).
reproduction:
  1. Make a fixture room with one real section.
  2. Make a folder inside the room whose literal name is a Windows-style path (backslashes and a colon), with a .mindrian folder inside it.
  3. Run `node lib/core/room-render.cjs state <fixture room>`.
  4. The Sections table has a row with the Windows-style name.
started: unknown. The writer below has existed since openRoomDb was added.

## Scope and Impact

- Affected surfaces: cli (compute-state, session-start); desktop and cowork read the same renderer output.
- Affected commands: scripts/compute-state, scripts/session-start-state, scripts/session-start.
- Affected users: a room reached through a Windows drive path string while the process runs under POSIX (WSL, Linux, macOS). Windows itself is not affected.
- Version range: not bisected.
- Severity: medium.
- Blast radius: the stray folder also holds a fresh empty room.db, so the room has a second blank local mind under the wrong name. Every other writer that joins a path onto a room string can make the same kind of folder.

## Eliminated

- hypothesis: H3, a registry or sub-room listing adds the room itself.
  evidence: renderState does not read the registry for rows. Rows come from a glob of the room folder only. readCurrentRoomSlug reads the registry only to print current_room. The sub-room code is not on the path.
  timestamp: 2026-11-06T13:10:00Z
- hypothesis: discoverSections of lib/core/section-registry.cjs builds the state table.
  evidence: renderState (lib/core/room-render-state.cjs) never calls it. The plan expected so; the code does not. discoverSections is a separate list used by other callers. It has the same flaw (see BR2).
  timestamp: 2026-11-06T13:10:00Z

## Evidence

- timestamp: 2026-11-06T13:09:00Z
  checked: fixture room with a literal folder named like C:\Users\test\MindrianRooms\synthetic-ventures\synthetic-room (holding only .mindrian), rendered with room-render.cjs state.
  found: the Sections table prints that name as a row with 0 entries, status Empty. The Gaps block prints "- <name>: No entries." (H1 reproduced).
  implication: renderState lists every non-dot folder with no check on the name. This is where the path-like name enters the list.
- timestamp: 2026-11-06T13:09:30Z
  checked: discoverSections on the same fixture, once with the folder empty and once with a STATE.md inside.
  found: empty folder is not listed; a folder with STATE.md or one .md file is listed as an extended section.
  implication: discoverSections has the same missing name check, so a stray folder that gains a file becomes a section for the graph and wiki too.
- timestamp: 2026-11-06T13:11:00Z
  checked: process with the working folder set to the fixture room, call openRoomDb with the synthetic string C:\Users\synthetic-386-44\MindrianRooms\synthetic-ventures\synthetic-room (the /mnt/c form of it does not exist on this machine).
  found: openRoomDb returns a handle and creates the literal folder `<cwd>/C:\Users\synthetic-386-44\...\synthetic-room/.mindrian/room.db`. Rendering the room then shows the bad row.
  implication: this is the stray folder writer, and it reproduces the whole symptom, including 0 entries.
- timestamp: 2026-11-06T13:12:00Z
  checked: static read of lib/core/room-db.cjs openRoomDb, lib/core/resolve-active-room.cjs registryRoomPath and resolveActiveRoom, lib/core/platform.cjs.
  found: openRoomDb does path.resolve(roomDir); on POSIX that joins a Windows drive string to the working folder. registryRoomPath returns entry.abs_path unchanged when fs.existsSync is true, and existsSync is true for the stray folder (relative to the working folder), so the stray folder is then taken as the room (self-reinforcing). The CLAUDE_ACTIVE_ROOM branch of resolveActiveRoom does the same and sets slug to path.basename of the whole Windows string (backslash is not a separator on POSIX). lib/core/platform.cjs has toBashPath (only swaps slashes, no drive mapping). No drive to /mnt mapping helper exists in lib/, scripts/ or hooks/.
  implication: no helper to reuse; one must be added in platform.cjs, the module that owns path forms.
- timestamp: 2026-11-06T13:12:30Z
  checked: grep for mkdirSync with a room directory argument in lib/core.
  found: room-db.cjs, room-auto-create.cjs, rs-sqlite-mirror.cjs, room-constraints.cjs, hat-persistence.cjs, room-birth.cjs and others join onto a room string the same way.
  implication: the shared chokepoint is openRoomDb (every graph write) and the string readers (registry, env). The other writers receive their room string from those readers.

## Technical Root Cause

- Site: lib/core/room-db.cjs function `openRoomDb` (the writer), lib/core/resolve-active-room.cjs functions `registryRoomPath` and `resolveActiveRoom` (where the string is read), lib/core/room-render-state.cjs function `renderState` (the row list), lib/core/section-registry.cjs function `discoverSections`.
- Cause: a Windows drive path string (C:\...) is accepted as a room path on a POSIX system. path.resolve treats it as a relative name, so openRoomDb creates a folder with that literal name inside the working folder (the room). renderState then lists every non-dot folder as a section with no check that the name is a folder name and not a path. The stray folder also makes later existence checks pass, so the string keeps resolving to the stray folder.
- Why it surfaces now: a room under /mnt/c is read from WSL while a Windows-form room path reaches the code (assumed source: a registry entry or an environment value written on the Windows side; UNVERIFIED because the real registry and room were not read).

origin: lib/core/room-render-state.cjs::renderState
hypothesis: H2
reproduced_on_fixture: yes
stray_folder_writer: lib/core/room-db.cjs::openRoomDb
files_to_touch: lib/core/platform.cjs, lib/core/room-db.cjs, lib/core/resolve-active-room.cjs, lib/core/section-registry.cjs, lib/core/room-render-state.cjs, lib/core/room-render-analyze.cjs, tests/test-386-section-table-no-path-rows.cjs, .planning/debug/room-section-table-lists-the-room-own-windows-path.md
red_arms: BR1,BR2,BR3,BR4

## Required Code Changes

- Change 1:
  - Location: lib/core/platform.cjs, new functions `isWindowsDrivePath` and `windowsDrivePathToPosix`
  - Current behavior: no helper maps a Windows drive path to the WSL form.
  - Required behavior: on a non-win32 system, map C:\a\b to /mnt/c/a/b when that folder exists; return null when it does not exist (never create). On win32, and for any non-drive path, return the input unchanged.
- Change 2:
  - Location: lib/core/room-db.cjs, function `openRoomDb`
  - Current behavior: a Windows drive string creates a literal folder and a blank room.db.
  - Required behavior: map the string with the helper; when it is unreachable throw an error with code EROOMPATH and create nothing. The open mode, journal mode, timeout and migration chain stay unchanged.
- Change 3:
  - Location: lib/core/resolve-active-room.cjs, functions `registryRoomPath` and `resolveActiveRoom` (CLAUDE_ACTIVE_ROOM branches)
  - Required behavior: map the string with the helper; unreachable gives null, so the stray folder can no longer be taken as the room.
- Change 4:
  - Location: lib/core/section-registry.cjs `discoverSections` (plus a new exported predicate `isPathLikeSectionName`), lib/core/room-render-state.cjs `renderState` Phase A and the scan fallback, lib/core/room-render-analyze.cjs `discoverSections`
  - Required behavior: refuse a folder name that holds a backslash, a path separator or a drive prefix. A room argument that is a Windows drive string is mapped with the helper; unreachable gives the "No room directory found." state.
  - Note: a stray folder that already exists in a real room is not touched by this plan.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-386-section-table-no-path-rows.cjs
  - Given: synthetic fixture rooms in a temporary folder.
  - When: BR1 renderState table, BR2 discoverSections, BR3 Windows string as room argument, as CLAUDE_ACTIVE_ROOM, as a registry path and as the openRoomDb argument, BR4 the whole state text.
  - Then: no row or line holds a path-like name and no literal folder is created. BRP1 and BRP2 keep normal sections and the .room-root sentinel rule.
  - Runner registration: picked up by tests/run-all-386.sh by glob.

## Non-Code Follow-ups

- CHANGELOG.md and knowledge-base.md: owned by plan 386-21.
- Cross-platform: verified on Linux (WSL) with fixtures only; macOS and win32 are unchanged by construction (the helper returns the input on win32).
- Canon Part 8: no Brain wire touched. Part 9: room.db open mode and migrations unchanged.
- Owner action (no real path here): a stray folder whose name looks like a Windows path, holding only a .mindrian folder with a blank room.db, can be removed by the owner after checking it holds nothing of value.

## Resolution

root_cause: a Windows drive path string is treated as a relative name on POSIX, so openRoomDb creates a literal folder with that name in the working folder, and renderState and discoverSections list every folder without checking the name.
fix: filled in Task 3.
verification: filled in Task 3.
files_changed:
  - filled in Task 3
commits: filled in Task 3
