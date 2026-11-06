---
status: fixing
kind: rca
trigger: "memory-completion-detector-duplicate-completions"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T14:00:00Z
updated: 2026-11-06T14:00:00Z
---

target: PRESENT

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ c44e8aef0 plus peers' working tree, in the dev workspace copy /home/jsagi/dev/MindrianOS-Plugin-release (Phase 386 plan 15). Plan 386-06 already edited resolveRoomSlug in the same file.
- **WIRE claims probe against:** none. No network. Fixture room, temporary rooms home.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding.

## Current Focus

hypothesis: detectAndFire reads last-cascade.json on every PostToolUse Write/Edit/MultiEdit and calls completeJtbd on every match. It keeps no memory of the cascade record it already counted, so the same record counts again on every later write.
test: Run the detector 3 times on one record, then once on a new record, on a fixture room.
expecting: completion count grows by 1 on every run.
next_action: Add a per-cascade identity and a stored last-counted identity.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.x on main
- Reported by: auditor finding B7
- Date first observed: 2026-11-05
- Related debug sessions: post-write-reports-cascade-complete-when-skipped

## Problem Statement

memory-completion-detector records the same JTBD completion more than once for one cascade record, and it trusts a status that post-write writes as complete even for a skip.

## Symptoms

expected: 1 completion per cascade record. No completion for a skipped or failed record.
actual: +1 completion on every detector run, whether or not last-cascade.json changed.
errors: none
reproduction:
  1. Fixture rooms home with a registry, an empty jtbd-history.json, and a room with jtbd-state current `understand-market` (confidence 0.9).
  2. Write last-cascade.json with status complete and file_path `<room>/market-analysis/x/a.md`.
  3. Run `node scripts/memory-completion-detector.cjs` with CLAUDE_ROOM_DIR set, 3 times. Count rows in rooms[slug].completed.
started: Phase 103-05.

## Evidence

- Anchor 1: scripts/memory-completion-detector.cjs, function `detectAndFire`. Gate (a) reads `cascade.cascade_status`; no check of which record it is.
- Anchor 2: lib/hmi/across-session-memory.cjs `completeJtbd` pushes a new `completed` row on every call. It has no dedupe.
- Anchor 3: lib/hmi/jtbd-state.cjs current stays set after a completion, so the gate (b) JTBD check passes again on every later run.
- Anchor 4: hooks/hooks.json, PostToolUse. Entries for post-write and for memory-completion-detector share the matcher `Write|Edit|MultiEdit`, so the detector runs on every write, including writes that leave last-cascade.json unchanged (non-room paths, ROOM.md, STATE.md, a skipped cascade).
- PROVEN (fixture run), completion count: run 1 gives 1, run 2 (same record) gives 2, run 3 (file unchanged) gives 3, a new record on the same path gives 4.
- UNVERIFIED: the host order of the 2 PostToolUse hooks. If they run in parallel, the detector can read the previous write's record. The identity check makes that safe (a record counts once), but a record can be counted one write late. Not changed here.

## Technical Root Cause

The detector is stateless between runs, and last-cascade.json is a single overwritten file that persists across writes. Each run re-counts the surviving record. Together with the literal complete status from post-write (see the sibling RCA), a skipped record also counts.

## Required Code Changes

- scripts/post-write: write a `cascade_id` into each record (done in the sibling fix).
- scripts/memory-completion-detector.cjs: identity = `cascade.cascade_id` else `timestamp|file_path`. Skip when it equals the scalar stored in `<room>/.mindrian/last-cascade-counted`. Write the scalar after a completion is recorded. Keep status gate, never-throw, exports.

## Tests to Add

- tests/test-386-cascade-status-and-completion.cjs: W4 skipped or failed record counts nothing; W5 same record twice gives 1; W6 new record gives a new completion.

## Resolution

Fixed in plan 386-15. detectAndFire skips a record whose identity (timestamp|file_path) equals the scalar in <room>/.mindrian/last-cascade-counted, and writes that scalar after a completion. A skipped or failed record already fails the status gate. Limit: a second write of the same file in the same second shares the identity and counts once (the 8-key contract has no id key). Proof: tests W4 to W6. Not moved to resolved; plan 386-21 does that.
