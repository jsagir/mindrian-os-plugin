---
status: fixing
kind: rca
trigger: "check-pending-breakthrough-creates-room-db"
issue_id: "B6b"
severity: low
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T08:32:00Z
updated: 2026-11-06T08:32:00Z
---

## Current Focus

hypothesis: scripts/check-pending-breakthrough.cjs calls scanner.scanForBreakthroughs on a room that has no .mindrian/room.db. The scanner calls openRoomDb, and openRoomDb creates the database. A read-only SessionStart hook therefore creates a file.
test: Run the hook against a fixture room with a registry entry and no room.db, then check that the file exists.
expecting: room.db is absent before and present after.
next_action: Write the failing test, then add the same existence guard that check-pending-ambiguous uses.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (main)
- Source-of-Truth Preamble: CODE claims read against branch main @ aec3a86cb (working tree, hooks/hooks.json carries a peer edit). WIRE claims: none. Date 2026-11-06.
- Reported by: auditor finding B6 (.planning/audits/AUDITOR-FINDINGS-source.md), confirmed by reproduction.
- Related debug sessions: check-pending-ambiguous-three-strikes-count-compactions (the other half of B6).

## Skip Rule Check

target: PRESENT

scripts/check-pending-breakthrough.cjs exists and hooks/hooks.json still carries its SessionStart entry (matcher startup|clear|compact, timeout 3).

## Problem Statement

The breakthrough SessionStart hook creates .mindrian/room.db in a room that has none.

## Symptoms

expected: A hook that only scans does not create files. A room with no room.db gets D-16 silence.
actual: After the hook runs, .mindrian/room.db exists.
errors: none.
reproduction:
  1. Make a fixture room directory with a registry entry and no .mindrian/room.db.
  2. Run the hook with MINDRIAN_ROOMS_HOME set and a SessionStart stdin.
  3. Check whether .mindrian/room.db exists.
started: Phase 120-02.

## Scope and Impact

- Affected surfaces: cli (SessionStart hook).
- Affected commands: SessionStart hook only.
- Affected users: any user whose active room has no room.db yet (a new room, or a room whose database was deleted).
- Version range: Phase 120-02 through current main.
- Severity: low.
- Blast radius: openRoomDb on an absent file also runs the schema setup. A deleted database comes back silently empty, which the release real-room gate treats as a defect class (the silent-recreate negative leg).

## Reproduction Result (fixture room, scratch script)

| Step | Result |
|------|--------|
| room.db exists before the hook | false |
| hook stdout | {"continue":true} |
| room.db exists after the hook | true |

Which call creates it: scanner.scanForBreakthroughs. It opens the room through openRoomDb (lib/core/breakthrough/scanner.cjs, top of scanForBreakthroughs) before any detector runs. The later openRoomDb in the hook is only reached when a top candidate exists, which is not the case on a database that was just created empty. check-pending-ambiguous guards on the file existing (fs.existsSync of .mindrian/room.db) before it opens the database. The breakthrough hook has no such guard.

## Eliminated

- hypothesis: The later openRoomDb call in the hook creates the file.
  evidence: The hook returns {"continue":true} before that call on an empty result, and the file already exists at that point.
  timestamp: 2026-11-06T08:32:00Z

## Evidence

- timestamp: 2026-11-06T08:32:00Z
  checked: scripts/check-pending-breakthrough.cjs main
  found: After room resolution it requires the scanner and calls scanForBreakthroughs(activeRoomDir) with no existence check.
  implication: Any active room directory triggers openRoomDb.
- timestamp: 2026-11-06T08:32:00Z
  checked: the reproduction table above
  found: room.db absent before, present after.
  implication: Root cause confirmed.
- timestamp: 2026-11-06T08:33:00Z
  checked: scripts/check-pending-breakthrough.test.cjs Test 12 (the existing hook happy path)
  found: Not run in this RCA. The plan names it as failing at an earlier HEAD. Task 3 records its status before and after the fix.
  implication: Relation to B6 is decided by that run, recorded in the plan summary.

## Technical Root Cause

- Site: scripts/check-pending-breakthrough.cjs function `main`, the call to scanner.scanForBreakthroughs(activeRoomDir).
- Cause: No guard for a missing .mindrian/room.db before the scanner opens the database. openRoomDb creates the file when it is absent.
- Why it surfaces now: Phase 120-02 mirrored a sibling hook before check-pending-ambiguous added the guard.

## Required Code Changes

- Change 1:
  - Location: scripts/check-pending-breakthrough.cjs, function `main`, before the scanner call
  - Current behavior: scans and so creates the database.
  - Required behavior: return emitContinue() when <activeRoomDir>/.mindrian/room.db does not exist, the same guard check-pending-ambiguous uses. Keep the rest unchanged.

## Tests to Add or Update

- Test 1:
  - Type: integration (child process on a fixture room)
  - Location: tests/test-386-check-pending-hooks.cjs
  - Given: P4 a fixture room with no room.db. P5 a fixture room with a room.db and no candidates.
  - When: the hook runs with a SessionStart stdin.
  - Then: P4 emits {continue:true} and leaves no room.db. P5 emits {continue:true} (pin, unchanged).
  - Runner registration: tests/run-all-386.sh discovers it by glob.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md are owned by plan 386-21. Do not edit them here.
- Follow-up (not fixed here): readActiveRoomDir builds path.join(roomsHome, reg.active), which misses nested sub-rooms (same class as finding B3).

## Resolution

root_cause: see Technical Root Cause.
fix: pending (set in Task 3).
verification: pending (set in Task 3).
files_changed:
  - scripts/check-pending-breakthrough.cjs
commits: pending
