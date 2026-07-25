---
status: resolved
kind: rca
trigger: "intern-w1-room-state-false-empty"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: []
created: 2026-07-11T00:00:00Z
updated: 2026-07-23T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

status: RESOLVED for the reported symptom (find_and_fix re-verification 2026-07-23). The fix was already applied and committed the same day the diagnose-only file was written - it landed AFTER the 00:20Z RCA snapshot (commit 986c279f5, 2026-07-11 20:21; signature-fix 95382a945, 2026-07-12 07:07). Re-verified GREEN against current code.

what the fix did (CONFIRMED committed): `room_state`'s five read branches (`status`/`analyze`/`compute-state`/`get-state`/`suggest-next`) in `lib/mcp/tool-router.cjs::registerRouterTools` now re-resolve the live active room per call via `resolveWriteTargetDir(sessionId, roomDir, surface)` (the exact same per-call resolver already proven for `room_content` WRITES), instead of reading the boot-time closure `roomDir`. `sessionId` is pulled from the tool `extra` (per-connection, undefined on stdio/legacy); `roomDir` becomes the miss-fallback only. The tool-name collision the RCA feared was resolved NOT by the `room_state_bound` rename but by fixing the original `room_state` handler in place - no rename, no second registration, no SDK "already registered" crash.

regression tests (CONFIRMED committed + passing):
  - `tests/test-room-state-active-room-misroute.cjs` - proves `status`/`get-state` read the mid-session active room B, never the false-empty boot room A. ALL PASS.
  - `tests/test-room-state-no-registry-regression.cjs` - covers the Tier-0 no-registry fallback + the merge-time signature bug (positional roomDir landing in sessionId). ALL PASS.

evidence_grade: DIRECT - re-read the fixed handler (lines 587-641), git blame of the fix commits, and executed both regression suites GREEN on 2026-07-23.
next_action: NONE for the reported symptom. Sibling frozen-`roomDir` READ sites remain OPEN (see Open Siblings / Seed below) - the RCA's own audit follow-up #2/#3, logged here so they are not a silent "#7".

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.10
- Target version: v1.15.3-beta.13 (current in-progress cut)
- Reported by: Intern-1 (pseudonym), JHU intern QA program, via Larry's own Part B self-QA
- Date first observed: 2026-07-11 (report date)
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (Row B), CHANGELOG beta.12 fix to `lib/mcp/tool-router.cjs` (same bug CLASS - stale active-room resolution), `.planning/debug/intern-w1-rooms-new-silent-fail.md` and `.planning/debug/intern-w1-state-not-recomputed.md` (siblings - all three touch room/state integrity)

## Problem Statement

The room-initialization status check reports "No room initialized" against a room directory that has real, verifiable content on disk, forcing Larry to work around the tool by reading files directly instead of trusting the room_state report.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: room_state (or the equivalent status command) reports the active room as initialized when its directory contains real content.
actual: "room_state status returned 'No room initialized' even though the room directory has files. I worked around it by reading files directly."
errors: no thrown error - a false status value, silently wrong, not a crash.
reproduction:
  1. Start a session in a room with existing content (files already present in the room directory).
  2. Query room_state / status.
  3. Observe whether it correctly reports initialized, or falsely reports "No room initialized".
started: observed 2026-07-11 report; version at time of observation v1.15.3-beta.10.

## Scope and Impact

- Affected surfaces: cli (confirmed)
- Affected commands: room_state / status check; anything downstream that trusts its output (statusline, per Larry's own note: "The statusline may have been showing stale or incorrect state the whole session")
- Affected users: any user whose active room was set/switched via a path this resolver doesn't cover
- Version range: at least beta.10; unconfirmed if beta.12's `resolve-active-room.cjs` migration (tool-router.cjs) also covered this call site
- Severity: high - false state reported to the user as fact, undermines trust in the statusline itself
- Blast radius: statusline accuracy, anything gating on "is a room initialized"

## Eliminated
<!-- APPEND only - prevents re-investigating -->

(none yet)

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-1's Part B self-QA (verbatim) and CHANGELOG.md v1.15.3-beta.12 Fixed entry for `lib/mcp/tool-router.cjs`
  found: intern quote above; CHANGELOG: "The MCP server froze its write target at boot-time cwd... this was a fifth active-room guesser never migrated onto [resolve-active-room.cjs], the exact stale-closure class Phase 212 D5 warns against."
  implication: strong prior that this is the same bug class recurring at a different call site (a status-read guesser instead of a write-target guesser), not a novel failure mode.

- timestamp: 2026-07-11T00:10:00Z
  checked: "No room initialized" string literal call sites (`lib/mcp/resources.cjs:43`, `lib/mcp/tool-router.cjs:456`, `lib/mcp/prompts.cjs:70,280`)
  found: `lib/mcp/tool-router.cjs` case `'status'` (inside `room_state`'s `registerRouterTools` handler, ~line 452-457): `const state = stateOps.getState(roomDir); const response = state || 'No room initialized...'`. `roomDir` here is the function PARAMETER passed into `registerRouterTools(server, roomDir, pluginRoot, larryContext, surface)` - i.e. the outer closure variable, not re-resolved inside the handler. Same pattern confirmed for `analyze`, `compute-state`, `get-state`, `suggest-next` (all read `roomDir` directly, lines ~455-475).
  implication: `room_state`'s entire read surface depends on whatever `roomDir` value was closed over at tool-registration time, not on any per-call resolver.

- timestamp: 2026-07-11T00:12:00Z
  checked: `bin/mindrian-mcp-server.cjs` lines 77-132 (where `roomDir` is computed and threaded)
  found: `const roomDir = path.resolve(process.env.MINDRIAN_ROOM || './room');` computed ONCE at module load (server boot), BEFORE `createServer()` even runs; passed unchanged into `registerRouterTools(s, roomDir, ...)`, `registerResources(s, roomDir)`, `registerPrompts(s, roomDir, pluginRoot)`, `registerCapabilities(s, ..., roomDir, pluginRoot)`. The file's own comment at line 82-88: "roomDir is now the MISS-FALLBACK only, never the write authority... registerRouterTools below still receives this as its fallback argument." Confirms design intent that reads should ALSO eventually move off this frozen fallback, but only the 3 WRITE branches (file-opportunity, funding create/update, via `resolveWriteTargetDir`) were actually migrated - `room_state`'s reads were left on the miss-fallback permanently, not just until session-bind.
  implication: any MCP daemon that persists across a room switch or a new-room creation (Phase 198-03 D-01 explicitly designs the daemon to be durable and serve CLI+Desktop+Cowork across multiple sessions) will report `room_state status` against the room that was active/present AT BOOT, never a room switched-to or created afterward - even though `stateOps.getState()` itself is correct and would happily read STATE.md from the RIGHT directory if only it were given one.

- timestamp: 2026-07-11T00:15:00Z
  checked: `lib/mcp/tools/room.cjs` (Phase 198-04, SPEC-2, Task 2) lines 1-25, 133-175, 143-155 comment
  found: SMOKING GUN. This module was explicitly written to make `room_state` session-aware (`resolveSessionRoomDir()` calls `resolveWriteRoom()`/`resolveActiveRoom()` per call, no frozen `roomDir`) - but its own comment (lines 143-155) states the fix could NOT be applied to the tool literally named `room_state` because that name is ALREADY registered by `lib/mcp/tool-router.cjs`'s `registerRouterTools()` (the Phase 52 grouped-router tool, same file/handler identified above), and the MCP SDK throws "Tool <name> is already registered" on a duplicate name. Rather than migrate/replace the original `room_state` handler's `status` case to call the new resolver, the fix was shipped under a DIFFERENT, less-discoverable tool name: `room_state_bound`. Both tools are registered unconditionally and coexist today (`room_state_bound` wired via `registerCoreTools()` -> `lib/mcp/tools/*.cjs` auto-discovery seam, called from inside `registerRouterTools()` itself at tool-router.cjs:1339-1340).
  implication: this is not merely an overlooked call site - it is a KNOWN, documented, deliberately-parked gap. The correct/fixed behavior exists in the codebase (`room_state_bound`) but under a name callers (Larry, the intern, any skill/command referencing "room_state" by its well-known name) would not naturally reach, since `room_state` is the long-established, documented, and most-referenced tool name across the plugin's skills/commands. The bug is real, reproducible, and its exact mechanism and even its previously-attempted (incomplete) remediation are on record in-repo.

## Technical Root Cause

CONFIRMED. `room_state`'s `status` command (and its sibling `analyze`/`compute-state`/`get-state`/`suggest-next` commands) in `lib/mcp/tool-router.cjs::registerRouterTools()` read room state via `stateOps.getState(roomDir)`, where `roomDir` is the boot-time closure variable computed once in `bin/mindrian-mcp-server.cjs` (`path.resolve(process.env.MINDRIAN_ROOM || './room')`) and never re-resolved per call. This is the exact stale-closure "active-room guesser" class the beta.12 CHANGELOG fixed for `room_content`'s 3 write branches (`resolveWriteTargetDir()` -> `resolve-active-room.cjs`) - but that fix's scope was writes only. `room_state`'s reads (and `resources.cjs`'s `room://state` resource, and `prompts.cjs`'s room-state interpolation, both of which also take the same frozen `roomDir` parameter and never re-resolve) were never migrated.

Phase 198-04 (SPEC-2) DID attempt to fix exactly this for `room_state`, but a tool-name collision with the pre-existing `registerRouterTools()`-registered `room_state` tool forced the fix to ship under an alternate name, `room_state_bound` (`lib/mcp/tools/room.cjs`), rather than replacing the original handler. Both tools are live on the server today; the original (buggy, frozen-roomDir) `room_state` remains the well-known, widely-referenced name that callers actually invoke, so the false "No room initialized" persists in practice even though a correct, session-aware implementation already exists in the codebase under a different name.

Mechanism producing the reported symptom: the MCP daemon is designed to be durable and long-lived across sessions/surfaces (Phase 198-03 D-01). It resolves `roomDir` once at its own boot/spawn time. Any room created or made active AFTER that boot (mid-session `room-registry set-active`, or a new room via `/mos:rooms new` - see sibling `intern-w1-rooms-new-silent-fail.md`) is invisible to `room_state status`, which keeps reading the boot-time directory (which may lack STATE.md or not exist at all), yielding a false "No room initialized" even though the session's real active room has real, verifiable content on disk.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

OUT OF SCOPE for this diagnose-only run (goal: find_root_cause_only). Not applied; noted for the follow-up fix session:
- Migrate `room_state`'s `status`/`analyze`/`compute-state`/`get-state`/`suggest-next` branches in `lib/mcp/tool-router.cjs` onto session-aware per-call resolution (reuse `resolveSessionRoomDir()` pattern from `lib/mcp/tools/room.cjs`, or fold `room_state` itself into the `tools/` auto-discovery seam), rather than leaving `room_state_bound` as a parallel, less-discoverable tool.
- Audit `lib/mcp/resources.cjs` (`room://state` and others) and `lib/mcp/prompts.cjs` for the same frozen-`roomDir`-parameter pattern - both were passed the same boot-time `roomDir` and never re-resolve.
- Decide product-level: deprecate/alias `room_state` -> `room_state_bound` semantics, or retire `room_state_bound` once `room_state` itself is fixed, so only ONE tool of this name/purpose exists (Canon Part 7 reuse-before-build; two tools with overlapping purpose and diverging correctness is itself a hazard).

## Tests to Add or Update

PENDING (deferred to fix session). Candidate: an integration test that switches active room mid-process (matching the beta.12 test pattern for `room_content` writes) and asserts `room_state status` reports initialized=true against the switched-to room's real content - this test would currently FAIL against `room_state` (proving the bug) while passing against `room_state_bound` (proving the fix pattern already exists and is provably applicable).

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: Fixed entry under v1.15.3-beta.13.
- knowledge-base.md: summary block on resolve, cross-referencing the beta.12 `tool-router.cjs` fix as the same bug class if confirmed.
- If confirmed as "guesser #6", consider a repo-wide audit for any remaining call sites not yet migrated onto `resolve-active-room.cjs` (Phase 212 D5 pattern) - flag as a seed if found, do not silently leave a #7.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  room_state's status/analyze/compute-state/get-state/suggest-next commands
  (lib/mcp/tool-router.cjs::registerRouterTools) read stateOps.getState(roomDir)
  using the roomDir closure variable captured ONCE at MCP server boot
  (bin/mindrian-mcp-server.cjs:88, path.resolve(process.env.MINDRIAN_ROOM ||
  './room')), never re-resolved per call. This is the same stale-closure
  active-room-guesser class fixed once already in beta.12 for room_content's
  3 WRITE branches via resolveWriteTargetDir()->resolve-active-room.cjs - that
  fix was scoped to writes only and never touched room_state's reads.
  Phase 198-04 (SPEC-2) DID build the correct session-aware fix
  (resolveSessionRoomDir() in lib/mcp/tools/room.cjs), but a tool-name
  collision with the pre-existing room_state tool forced it to ship under a
  different, less-discoverable name (room_state_bound) instead of replacing
  the buggy handler. Both tools coexist; callers invoking the well-known
  room_state name still hit the frozen-roomDir bug. A long-lived MCP daemon
  (Phase 198-03 D-01) that boots once and then a room is switched/created
  mid-session reproduces the reported false "No room initialized".
fix: APPLIED + COMMITTED (2026-07-11/12, verified 2026-07-23). The five
  room_state read branches in lib/mcp/tool-router.cjs::registerRouterTools now
  re-resolve the live active room per call via
  resolveWriteTargetDir(sessionId, roomDir, surface) - the same per-call
  resolver already used for room_content WRITES - instead of the boot-time
  closure roomDir. sessionId comes from the tool `extra`; roomDir is the
  miss-fallback only. The tool-name collision was resolved by fixing the
  original room_state handler IN PLACE (no rename to room_state_bound, no
  duplicate registration). Two regression tests added and passing.
verification: GREEN. `node tests/test-room-state-active-room-misroute.cjs`
  (status/get-state read mid-session active room B, not false-empty boot room A)
  and `node tests/test-room-state-no-registry-regression.cjs` (Tier-0 no-registry
  fallback + merge-time signature guard) both ALL PASS on 2026-07-23. Write-side
  sibling test-tool-router-active-room-misroute.cjs also PASS.
files_changed:
  - lib/mcp/tool-router.cjs (room_state read branches -> resolveWriteTargetDir)
  - tests/test-room-state-active-room-misroute.cjs (new regression)
  - tests/test-room-state-no-registry-regression.cjs (new merge-time regression)
commits:
  - 986c279f5 (2026-07-11 20:21) room_state read branches onto resolveWriteTargetDir
  - 95382a945 (2026-07-12 07:07) signature fix: pass sessionId+surface, roomDir as fallback

## Open Siblings / Seed
<!-- The reported symptom is closed. The SAME frozen-roomDir READ pattern still
     lives at these sites (RCA audit follow-up #2/#3). Logged so it is not a
     silent "#7". Recommend a dedicated follow-up debug/plan session. -->

STILL FROZEN on the boot-time roomDir (re-confirmed 2026-07-23, NOT migrated):
  - lib/mcp/resources.cjs:42 - `room://state` resource reads getState(roomDir);
    the other room:// resources (sections, section/{name}, meetings, intelligence,
    reasoning://*) also use the frozen registerResources(server, roomDir) param.
    This is the Desktop resource-browsing surface - same false-empty class.
  - lib/mcp/prompts.cjs - 8 getState(roomDir)/computeState(roomDir) sites, no
    per-call resolver at all. The room-state prompt interpolation surface.
  - lib/mcp/tool-router.cjs:868/934/937/964 - `graph-stats`, `visualize-room`,
    `visualize-graph` still read frozen roomDir (room_graph router, not room_state).

Note: resources/prompts handlers have DIFFERENT SDK signatures than a tool
(no guaranteed per-session `extra.sessionId`), so the cheap correct migration is
`resolveActiveRoom()` per call (registry leg) with the boot roomDir as miss-
fallback - NOT a mechanical copy of the tool fix. This is a design-touching
change to Desktop resource/prompt semantics and warrants its own session.

Product-level dedup still OPEN: room_state_bound (lib/mcp/tools/room.cjs) now
coexists REDUNDANTLY with the fixed room_state. Two live tools of overlapping
purpose (Canon Part 7 hazard). Decide: retire room_state_bound, or alias it, so
exactly one tool of this name/purpose exists.
