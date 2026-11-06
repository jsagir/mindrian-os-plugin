---
status: fixing
kind: rca
trigger: "post-compact-two-session-rows-and-sessionstart-envelope-fallback"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T13:00:00Z
updated: 2026-11-06T13:00:00Z
---

target: PRESENT

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ b7323cdc1 in the dev workspace copy /home/jsagi/dev/MindrianOS-Plugin-release (Phase 386 plan 10). Peers edit other files in the same tree.
- **WIRE claims probe against:** none. No network. Fixture room in a temporary folder and a temporary HOME.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding.

## Current Focus

hypothesis: One compaction fires two hooks that each open a session row. SessionStart (matcher includes compact) runs scripts/session-start, which runs memory-lifecycle session-start. PostCompact runs scripts/post-compact, which runs memory-lifecycle post-compact. Both call startSession.
test: Run both subcommands once against a fixture room and count the rows.
expecting: 2 rows for 1 compaction.
next_action: Apply the fix in memory-lifecycle cmdPostCompact and scripts/post-compact.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.x on main
- Reported by: auditor finding B5 (AUDITOR-FINDINGS-source.md)
- Date first observed: 2026-11-05
- Related debug sessions: restore-post-compact-context-contribute-always-empty

## Problem Statement

A compaction creates 2 session rows. The post-compact fallback path runs scripts/session-start, which prints a SessionStart-shaped envelope into the PostCompact event, where that shape is not allowed.

## Symptoms

expected: 1 compaction adds 1 session row. scripts/post-compact prints only the keys that PostCompact allows (continue, stopReason, suppressOutput, systemMessage).
actual: 2 rows. With no saved pre-compact state, stdout holds a hookSpecificOutput key whose hookEventName is SessionStart.
errors: none (silent over-count, and a schema violation that the host may reject)
reproduction:
  1. Build a temporary HOME and a fixture room with room.db (.room-root and .mindrian).
  2. Run `node scripts/memory-lifecycle.cjs session-start <room>` then `post-compact <room>`.
  3. Count rows in the sessions table.
  4. Run `bash scripts/post-compact` with no HOME/.mindrian/bridge/pre-compact-state.json. Read the stdout key names.
started: Phase 84-03 added the post-compact subcommand; the SessionStart compact matcher came with the later reseed work.

## Evidence

- Anchor 1: scripts/session-start, call `memory_block=$(node ... memory-lifecycle.cjs session-start ...)` (symbol: memory_block). It runs on every source in the matcher `startup|clear|compact` (hooks/hooks.json, SessionStart entry).
- Anchor 2: scripts/post-compact, call `memory-lifecycle.cjs post-compact` after the section "Phase 84-03: memory-lifecycle post-compact hook". Its own comment says the no-save-file branch execs session-start "which has its own memory wiring".
- Anchor 3: scripts/post-compact, `exec bash "${SCRIPT_DIR}/session-start"` in the no-state branch and in the stale branch.
- Anchor 4: scripts/memory-lifecycle.cjs, `cmdPostCompact` calls `memory.startSession` and `writePointer`. `cmdSessionStart` does the same.
- PROVEN (fixture run): rows before 0, after memory-lifecycle session-start 1, after post-compact 2. So each subcommand adds exactly 1 row.
- PROVEN (fixture run): scripts/post-compact with no saved state exits 0 and prints top-level keys `hookSpecificOutput,systemMessage`. The nested key hookEventName is `SessionStart`.
- NOTE (fixture run): the fixture has no registry, so the fallback session-start did not add a row there (rows stayed 2). In a real install the fallback also reaches memory-lifecycle session-start with the active room, so a third row is possible on that path. It is the same defect: the fallback exec duplicates what the SessionStart hook already did.
- UNVERIFIED: whether the host fires SessionStart with source compact in the same compaction as PostCompact. I had no documentation tool in this run. The repo assumes it: hooks/hooks.json matcher includes `compact`, and scripts/session-start (section about re-seeding doctrine after every compaction) says the compact re-seed rides SessionStart(compact). The fix is safe in either order of the 2 hooks (see Decision).

## Decision: which row writer is redundant

Keep the memory-lifecycle session-start writer. It runs on startup, clear and compact, so it covers every fresh start of a session. The post-compact writer runs only on compaction and only when a pre-compact state file exists.

Change cmdPostCompact so it does not open a row. It writes the `post-compact` marker fragment into the session that the pointer file names, so the boundary stays discoverable. It opens a row only when no usable pointer exists (no session was ever opened), so the marker never has nowhere to go.

Order check: if PostCompact runs first, the marker lands in the old session and SessionStart(compact) then opens the single new row: 1 row. If SessionStart runs first, it opens the single new row and the marker lands in it: 1 row.

Replace both `exec bash session-start` fallbacks in scripts/post-compact with a PostCompact-valid envelope: `{"continue":true}`. SessionStart(compact) already does the reseed on that path.

## Technical Root Cause

Two hooks in 1 compaction each own a session-row writer, and nothing makes one defer to the other. The PostCompact fallback also reuses the SessionStart script, so it prints the SessionStart envelope shape on an event that rejects that shape.

## Required Code Changes

- scripts/memory-lifecycle.cjs `cmdPostCompact`: reuse the pointer session when it exists in the sessions table; fall back to startSession only without one.
- scripts/post-compact: replace the 2 `exec bash session-start` calls with `emit_post_compact_continue` (prints `{"continue":true}`) and exit 0. Rewrite the comment that says the fallback execs session-start. Keep the side-channel writer, the snapshot restore and the systemMessage count.
- scripts/session-start is not edited (no need; Phase 384/385 peers also edit it).

## Tests to Add

- tests/test-386-post-compact-session-rows.cjs: C1 one compaction adds 1 row; C2 no-state stdout keys are a subset of the allowed set; C3 saved-state envelope keeps its valid shape.

## Resolution

PENDING until Task 3 commit.
