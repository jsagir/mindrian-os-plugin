---
status: investigating
kind: rca
trigger: "last-session-md-rewritten-every-turn"
issue_id: "B13"
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

target: PRESENT

hypothesis: scripts/on-stop writes .context/last-session.md at every Stop and counts "new/modified since last session" with find -newer against that same file. The reference time moves every turn, so the count means "since the last turn".
test: Run scripts/on-stop twice on a fixture room with the same session_id and no change between the runs.
expecting: second run reports a smaller count than the first, although nothing was undone.
next_action: Failing test (L1 to L4), then a session-keyed baseline stamp file.

## Source-of-Truth Preamble

- CODE claims read against: branch main @ e7d7e3ca8 (worktree /home/jsagi/dev/MindrianOS-Plugin-release)
- WIRE claims probe against: none (local only)
- Date of audit: 2026-11-06
- Re-verification rule: claims below were run on a fixture room with HOME and the rooms home set to temp directories.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: current main
- Reported by: auditor finding B13 (H2-08), reproduced here
- Date first observed: 2026-11-06
- Related debug sessions: none

## Problem Statement

The "Artifacts Filed" count in .context/last-session.md says "new/modified since last session" but measures since the previous Stop. A session with many turns shows a count that falls to 0 after the second turn.

## Symptoms

expected: The count holds the artifacts changed since the end of the previous session, and stays the same across the Stops of one session unless more files change.
actual: Each Stop rewrites last-session.md, so the next Stop counts only what changed since that rewrite.
errors: none.
reproduction:
  1. Make a fixture room (room/.context, STATE.md, ROOM.md, 2 markdown files). Set last-session.md mtime 1000 s ago, file a 900 s ago, file b 2000 s ago.
  2. Run scripts/on-stop with stdin {"session_id":"s1"} from the workspace directory. Read the Count line: 1.
  3. Run it again with the same session_id and no change. Read the Count line: 0.
started: the KAIROS Prep block was added with the last-session.md writer.

## Scope and Impact

- Affected surfaces: cli (Stop hook), the same script serves the other surfaces that run the hook.
- Affected commands: none directly. The file is a human-readable session log.
- Affected users: all rooms with a .context directory.
- Version range: KAIROS Prep block to present.
- Severity: low (wrong number in a log).
- Blast radius: the artifact count and the methodology guess, both counted with find -newer against last-session.md.

## Eliminated

- hypothesis: lib/mcp/stop-gate-handler.cjs writes .context/last-session.md with the same logic.
  evidence: grep for last-session in lib/mcp/stop-gate-handler.cjs returns no match.
  timestamp: 2026-11-06T00:00:00Z
- hypothesis: Other code reads the Count line.
  evidence: The only reader of .context/last-session.md is lib/core/user-archetype.cjs, which checks that the file exists. lib/core/session-state.cjs writes a different file, .mindrian/last-session.md.
  timestamp: 2026-11-06T00:00:00Z

## Evidence

- timestamp: 2026-11-06T00:00:00Z
  checked: KAIROS Prep block of scripts/on-stop
  found: ARTIFACT_COUNT and LAST_METHODOLOGY both use find -newer against ${CONTEXT_DIR}/last-session.md. The block then overwrites that file with cat. The Stop payload session_id is already parsed in the thin-adapter branch, not in the legacy body.
  implication: The reference file is replaced at the end of every Stop.
- timestamp: 2026-11-06T00:00:00Z
  checked: fixture run, 2 Stops with the same session_id
  found: Count 1 on the first Stop, Count 0 on the second Stop with no change.
  implication: Reproduced. The baseline moved by turn.
- timestamp: 2026-11-06T00:00:00Z
  checked: first Stop when last-session.md does not exist
  found: find -newer against a missing file fails; the count then prints 0.
  implication: A stamp file that always exists removes this odd path for payloads with a session id.

## Technical Root Cause

- Site: scripts/on-stop, KAIROS Prep block (comment marker "KAIROS Prep"), the two find -newer references to last-session.md.
- Cause: the reference time for "since last session" is the mtime of the file the same block rewrites at every Stop.
- Why it surfaces now: the hook fires every turn, so the file is rewritten every turn.

## Required Code Changes

- Change 1:
  - Location: scripts/on-stop, KAIROS Prep block
  - Current behavior: find -newer last-session.md, file rewritten each Stop.
  - Required behavior: keep a stamp file .context/.session-baseline. Line 1 holds the Stop session_id, the mtime holds the baseline time. When the Stop session_id equals the stored one, keep the stamp. When it differs, or no stamp exists, write the new id and set the stamp mtime to the mtime of the previous last-session.md (now when none exists). Count and detect methodology with find -newer against the stamp.
  - Fallback: when the payload has no session_id, or it fails the safe-character check (A-Z a-z 0-9 . _ -, 1 to 128 characters), keep the old behavior (find -newer against last-session.md).
  - Security: the session id is written as file content only. No path or shell command is built from it.
- Change 2: none for lib/mcp/stop-gate-handler.cjs (it does not write the file).

## Tests to Add or Update

- Test 1:
  - Type: integration (runs scripts/on-stop on a fixture room)
  - Location: tests/test-386-last-session-baseline.cjs
  - Given: a fixture room, last-session.md from a previous session, one file changed after it
  - When: 2 Stops with the same session_id, then 2 Stops with a new session_id after another file changed
  - Then: L1 counts equal across the 2 Stops; L2 a new session id moves the baseline (first file no longer counted); L3 no session_id keeps the old behavior and does not throw; L4 the 3 sections stay.
  - Runner registration: automatic, tests/run-all-386.sh globs tests/test-386-*.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md, knowledge-base.md: owned by plan 386-21.

## Resolution

root_cause: the reference time for "since last session" is the mtime of the file that on-stop rewrites at every Stop.
fix: pending
verification: pending
files_changed: []
commits: pending
