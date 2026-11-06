---
status: fixing
kind: rca
trigger: "registry-readers-legacy-shape-never-resolve"
issue_id: "B3"
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [7, 9]
created: 2026-11-06T07:45:00Z
updated: 2026-11-06T07:45:00Z
---

## Current Focus

hypothesis: Three readers keep a private copy of the legacy registry shape (an active_room slug plus a rooms array). scripts/room-registry writes an active slug plus a rooms object keyed by slug, so these readers never resolve a room.
test: Build a fixture registry with scripts/room-registry create, call each reader, record the result.
expecting: hmi-status-command returns null, across-session-memory resolveRoomDirForSlug returns null, memory-completion-detector falls back to the folder basename.
next_action: Write the failing test, then route the 3 readers through lib/core/resolve-active-room.cjs.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (main)
- Source-of-Truth Preamble: CODE claims read against branch main @ e155a9bfd. WIRE claims: none (local files only). Date 2026-11-06.
- Reported by: auditor finding B3 (.planning/audits/AUDITOR-FINDINGS-source.md), confirmed here by reproduction.
- Related debug sessions: none. scripts/operator-update.cjs is a fifth reader with its own plans 386-07 and 386-08.

## Skip Rule Check

target hmi-status-command: PRESENT
target across-session-memory: PRESENT
target memory-completion-detector: PRESENT
target: PRESENT

Phase 385 did not remove or narrow any of the 3 files. Each file exists on main and still holds the private registry parse.

## Problem Statement

Three readers cannot find a room on the registry shape that scripts/room-registry writes. The JTBD promote graph events and the room opt-out check are silently off.

## Symptoms

expected: With an active room in the registry, each reader resolves that room (slug and directory).
actual: hmi-status-command resolveActiveRoom returns null. across-session-memory resolveRoomDirForSlug returns null, and isRoomOptOut falls back to the folder named by the slug. memory-completion-detector resolveRoomSlug returns the folder basename instead of the registry slug.
errors: none (every path degrades silently).
reproduction:
  1. Make a temporary MINDRIAN_ROOMS_HOME and HOME.
  2. Run scripts/room-registry create fx-room fx fixture-venture seed. The registry now holds {"active": "fx-room", "rooms": {"fx-room": {"path": "fx", ...}}}.
  3. Call hmi-status-command.resolveActiveRoom(), across-session-memory._internal.resolveRoomDirForSlug("fx-room"), memory-completion-detector.resolveRoomSlug(<abs fx dir>).
  4. Observe null, null, "fx".
started: Phase 127.3 made lib/core/resolve-active-room.cjs the one resolver. These three readers kept private copies.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (hook and command paths share these scripts).
- Affected commands: /mos:hmi-status (always reports no active room), the memory completion hook, the across-session promote path.
- Affected users: every install that created a room with scripts/room-registry (all of them).
- Version range: since the keyed shape became the writer's shape (Phase 83 substrate) through current main.
- Severity: medium.
- Blast radius: logGraphTransition (writes a jtbd_transitioned memory event) never runs for the keyed shape, so those events are missing. The opt-out check ignores a room whose directory differs from its slug.

## Reader Table

Result on the keyed shape produced by scripts/room-registry create (reproduced on 2026-11-06).

| Reader | Function | Shape it expects | Result on keyed shape | Class |
|--------|----------|------------------|-----------------------|-------|
| scripts/hmi-status-command.cjs | resolveActiveRoom | active_room plus rooms array | null | legacy-only (fix here) |
| lib/hmi/across-session-memory.cjs | resolveRoomDirForSlug | rooms array | null | legacy-only (fix here) |
| lib/hmi/across-session-memory.cjs | isRoomOptOut | rooms array | falls back to the slug as folder name, so a nested or renamed room is missed | legacy-only (fix here) |
| scripts/memory-completion-detector.cjs | resolveRoomSlug | rooms array | basename fallback ("fx", not "fx-room") | legacy-only (fix here) |
| scripts/memory-resume-nudge.cjs | backfillFromWithinSession | rooms array | zero rooms, so the backfill loop never runs | legacy-only, NOT in this plan, follow-up |
| scripts/memory-resume-nudge.cjs | getCurrentRoomSlug | reads active then active_room | resolves the slug | tolerant |
| scripts/operator-update.cjs | registry read near line 106 | active_room plus rooms array | null | out of scope (plans 386-07 and 386-08) |
| scripts/check-onboard-statusline.cjs | active slug read | active then active_room | resolves | tolerant |
| scripts/intent-classifier.cjs | registry read near line 134 | both shapes | resolves | tolerant |
| scripts/memory-command.cjs | registry read near line 140 | both shapes | resolves | tolerant |
| lib/core/resolve-umbilical-target.cjs | registry read near line 192 | both shapes | resolves | tolerant |
| scripts/intent-classifier.cjs | bindingGateAlreadyOffered, markBindingGateOffered | marker file with a rooms array | not a registry reader | not applicable |

Follow-up (not fixed here): scripts/memory-resume-nudge.cjs backfillFromWithinSession walks Array rooms only. It is a legacy-only reader outside this plan files_modified. Route it through the canonical resolver in a later plan.

## Eliminated

- hypothesis: scripts/room-registry writes the legacy array shape.
  evidence: The create stanza sets reg['active'] and reg['rooms'][name] (an object keyed by slug). Reproduced output above.
  timestamp: 2026-11-06T07:41:33Z

## Evidence

- timestamp: 2026-11-06T07:41:33Z
  checked: scripts/room-registry create on a temporary MINDRIAN_ROOMS_HOME
  found: registry.json is {"version":1,"active":"fx-room","rooms":{"fx-room":{"path":"fx",...}}}. The entry has a relative path and no abs_path.
  implication: Readers that need abs_path or an array cannot resolve it.
- timestamp: 2026-11-06T07:42:00Z
  checked: the 3 readers called against that registry
  found: hmi-status-command.resolveActiveRoom -> null. across-session-memory resolveRoomDirForSlug -> null. memory-completion-detector resolveRoomSlug -> "fx".
  implication: Root cause confirmed for all 3.

## Technical Root Cause

- Site: scripts/hmi-status-command.cjs function `resolveActiveRoom`; lib/hmi/across-session-memory.cjs functions `isRoomOptOut` and `resolveRoomDirForSlug`; scripts/memory-completion-detector.cjs function `resolveRoomSlug`.
- Cause: Each function parses registry.json itself and tests Array.isArray(reg.rooms) (hmi-status-command also requires reg.active_room). The writer produces an object keyed by slug and an active field. The array test fails, so the lookup finds nothing.
- Why it surfaces now: Phase 127.3 (SEED-034, four guessers) added lib/core/resolve-active-room.cjs with resolveActiveRoom and registryRoomPath, which handle both shapes. These three readers were not moved to it, and their comments say the local copy avoids a require.
- What turns on after the fix: logGraphTransition (promote, park, complete) writes a jtbd_transitioned memory event into the room graph. The room opt-out marker is honored for a nested room. /mos:hmi-status finds the active room. All of it is local only, with no Brain call (Canon Part 8 holds).

## Required Code Changes

- Change 1:
  - Location: scripts/hmi-status-command.cjs, function `resolveActiveRoom`
  - Current behavior: parses the registry for active_room plus an array.
  - Required behavior: call the canonical resolveActiveRoom, return an object with slug and abs_path, keep the sealed check (the canonical resolver already returns null for a sealed room).
- Change 2:
  - Location: lib/hmi/across-session-memory.cjs, functions `isRoomOptOut` and `resolveRoomDirForSlug`
  - Current behavior: array walk over reg.rooms.
  - Required behavior: use registryRoomPath(home, slug, reg). Keep null-on-failure. Keep the isRoomOptOut fallback of slug-as-folder for an unknown slug (registryRoomPath already does this). resolveRoomDirForSlug returns null for a slug the registry does not know, as before.
- Change 3:
  - Location: scripts/memory-completion-detector.cjs, function `resolveRoomSlug`
  - Current behavior: array walk matching the room directory.
  - Required behavior: match the directory against entries of both shapes using registryRoomPath per slug. Keep the basename fallback only when nothing matches.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-386-registry-readers.cjs
  - Given: a temporary registry in the keyed shape (made by scripts/room-registry create) and one in the legacy array shape
  - When: each reader runs
  - Then: R1, R2, R3 resolve the fixture room on the keyed shape and R4 resolves on the legacy shape
  - Runner registration: tests/run-all-386.sh discovers it by glob.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md are owned by plan 386-21. Do not edit them here.
- Follow-up: scripts/memory-resume-nudge.cjs backfillFromWithinSession (see the reader table).

## Resolution

root_cause: Three readers kept private copies of the legacy registry shape after Phase 127.3 made lib/core/resolve-active-room.cjs the one resolver.
fix: Route them through the canonical resolver.
verification: see the plan summary.
files_changed:
  - scripts/hmi-status-command.cjs
  - lib/hmi/across-session-memory.cjs
  - scripts/memory-completion-detector.cjs
commits: see the plan summary
