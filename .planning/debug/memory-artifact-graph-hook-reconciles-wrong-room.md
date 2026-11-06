---
status: investigating
kind: rca
trigger: "memory-artifact-graph-hook-reconciles-wrong-room"
issue_id: "B14"
severity: low
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

target: PRESENT

hypothesis: scripts/memory-artifact-graph-hook.cjs gates only on the basename of the written file (one of 6 names), then resolves the active room from the environment or the registry and reconciles it. It never checks that the written file lies inside that room.
test: Fixture rooms A (active) and B, and an unrelated directory with a ROOM.md. Run the hook as a child process with a PostToolUse JSON on stdin. Count memory_artifact nodes in room A before and after.
expecting: a write in room B changes room A's node count.
next_action: Failing test (M1 to M5), then an inside-room check before the reconcile.

## Source-of-Truth Preamble

- CODE claims read against: branch main @ the worktree HEAD at plan time (/home/jsagi/dev/MindrianOS-Plugin-release)
- WIRE claims probe against: none (the hook has no network surface)
- Date of audit: 2026-11-06
- Re-verification rule: claims below were run on fixture rooms in a temp directory; HOME is a temp directory.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: current main
- Reported by: auditor finding B14 (H3-11), reproduced here
- Date first observed: 2026-11-06
- Related debug sessions: none

## Problem Statement

A Write, Edit or MultiEdit of any file named ROOM.md, STATE.md, MINTO.md, BRAIN.md, FEYNMAN.md or USER.md, anywhere on disk, makes the hook reconcile the active room. A file in another room or another repository triggers a full reconcile of the wrong room.

## Symptoms

expected: A write reconciles only the room that owns the written file. A file outside the active room causes no room work.
actual: room A (active) goes from 0 to 2 memory_artifact nodes after a hook run for a MINTO.md path in room B.
errors: none.
reproduction:
  1. Make fixture room A with room.db and a section MINTO.md, fixture room B the same, and an unrelated directory with ROOM.md.
  2. Set CLAUDE_ROOM_DIR to room A.
  3. Run node scripts/memory-artifact-graph-hook.cjs with stdin {"tool_name":"Write","tool_input":{"file_path":"<room B>/sec/MINTO.md"}}.
  4. Count memory_artifact nodes in room A: 0 before, 2 after.
started: Phase 150-03 (the hook was written as a twin of the planning hook with a basename gate only).

## Scope and Impact

- Affected surfaces: cli (PostToolUse hook; Desktop and Cowork have no PostToolUse hook).
- Affected commands: none directly.
- Affected users: anyone who edits a memory-named file outside the active room (other rooms, other repositories).
- Version range: Phase 150-03 to present.
- Severity: low (extra idempotent local work in a wrong room; no egress; no data loss).
- Blast radius: only this hook. The twin scripts/gsd-artifact-graph-hook.cjs gates on a .planning path and resolves the room from the written file first (Phase 169-02, .room-root), so it does not have this defect. It is unchanged.

## Eliminated

- hypothesis: The twin hook scripts/gsd-artifact-graph-hook.cjs has the same defect.
  evidence: Its gate is isPlanningMarkdown on the path, and resolveRoomDir(filePath) resolves the room from the file's own .room-root before the environment and registry.
  timestamp: 2026-11-06T00:00:00Z
- hypothesis: The reconcile itself restricts work to the written file.
  evidence: reconcileMemoryArtifacts(roomDir, opts) walks the whole room. It takes no file argument. The scope has to be decided before the call.
  timestamp: 2026-11-06T00:00:00Z

## Evidence

- timestamp: 2026-11-06T00:00:00Z
  checked: runHook in scripts/memory-artifact-graph-hook.cjs
  found: Gate order is tool name, file_path present, isMemoryMarkdown (basename in the 6 names), resolveRoomDir (CLAUDE_ROOM_DIR, CLAUDE_ACTIVE_ROOM, ROOM_DIR, then the registry active room), open room.db, reconcile. No step compares file_path with the room directory.
  implication: The only scope check is the basename.
- timestamp: 2026-11-06T00:00:00Z
  checked: fixture run, 3 outcomes (counts only), each on a shared room A
  found: path in room B: room A nodes 0 to 2 (reconcile ran). Path in the unrelated directory: no change in this sequential run because room A was already reconciled (run order hides it; the test uses a fresh room A per arm). Path in room A: no change after the earlier reconcile (idempotent).
  implication: The first outcome proves the defect. The test must use a fresh room A for every arm.

## Technical Root Cause

- Site: scripts/memory-artifact-graph-hook.cjs function `runHook`, between the basename gate and the reconcile call.
- Cause: the gate trusts the basename of an attacker-influenceable path and the room comes from a different source (environment or registry). No check ties the two together.
- Why it surfaces now: any edit of a file with a memory name outside the active room.

## Required Code Changes

- Change 1:
  - Location: scripts/memory-artifact-graph-hook.cjs, function `runHook`, after `resolveRoomDir()` and before the room.db open
  - Current behavior: reconcile the active room for any memory-named path.
  - Required behavior: resolve both the written path and the room directory with fs.realpathSync (the written file may not exist yet, so resolve its nearest existing parent and append the rest; fall back to path.resolve on error). Reconcile only when path.relative(room, file) is not empty, does not start with "..", and is not absolute. Otherwise return with no room work.
  - Add a helper `isInsideRoom(filePath, roomDir)` and export it.
  - Keep the basename gate, exit 0 always, the finally block that closes the handle, and the no-network rule.
- Change 2: none for scripts/gsd-artifact-graph-hook.cjs.

## Tests to Add or Update

- Test 1:
  - Type: integration (child process on fixture rooms)
  - Location: tests/test-386-memory-artifact-hook-room-scope.cjs
  - Given: a fresh active room A per arm, a second room B, an unrelated directory
  - When: the hook runs for a path in B, in the unrelated directory, in A, with another file name, and through a symlink that resolves inside A
  - Then: M1 and M2 leave room A's memory_artifact count unchanged; M3 reconciles room A; M4 is a no-op; M5 reconciles room A
  - Runner registration: automatic, tests/run-all-386.sh globs tests/test-386-*.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md, knowledge-base.md: owned by plan 386-21.

## Resolution

root_cause: the hook gates on the basename only, then reconciles the room chosen by environment or registry, with no check that the written file lies inside it.
fix: pending
verification: pending
files_changed: []
commits: pending
