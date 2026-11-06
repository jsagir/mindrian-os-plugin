---
status: resolved
kind: rca
trigger: "approved-recovery-moves-a-healthy-room-db-aside-on-a-false-unreadable"
issue_id: "B19"
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T14:00:00Z
updated: 2026-11-06T14:10:00Z
---

## Current Focus

hypothesis: once a person approves the recovery card, repairRoomIdentity renames room.db, room.db-wal and room.db-shm aside on ANY failure of openRoomDb. A false unreadable (busy, input or output error, cannot open, an unrelated script error) therefore moves a healthy file aside.
test: a synthetic healthy room.db in a temporary folder, an openRoomDb double that throws the simulated error, then repairRoomIdentity with approvedBy and moveAsideUnreadable.
expecting: the file moves for every error class today.
next_action: write the failing test (Task 2), then guard the move by cause and header (Task 3).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (branch main)
- Source-of-Truth Preamble: CODE claims read against branch main at HEAD d2e096b67 (2026-11-06). WIRE claims: none, no network. Date: 2026-11-06. Every runtime claim below was measured on a synthetic room.db built by tests/helpers/synthetic-room-db.cjs in a temporary folder, with HOME and the rooms home pointed at a temporary folder. No real room was read, copied, opened or touched.
- Related debug sessions: room-db-reported-unreadable-on-a-windows-drive-from-wsl (B18, plan 386-45; its Resolution names this risk)

## Problem Statement

After plan 386-45 the person sees an honest cause line for a room.db that cannot be opened. But the recovery card is still offered for every cause. When the person approves it, the recovery renames the room.db file aside. If the unreadable report was false (a lock held by a Windows program, a drive hiccup), the healthy local mind is moved aside and a new empty room.db takes its place.

## Symptoms

expected: only a file that is really not a SQLite database is moved aside. A busy, drive or unknown failure leaves the file where it is and tells the person what to do.
actual: any open failure moves room.db, room.db-wal and room.db-shm to room.db.unreadable-<stamp>, and a new empty room.db is created.
errors: none. The move is silent apart from the moved_aside list in the card result.
reproduction:
  1. Build a synthetic healthy room.db in a temporary folder (tests/helpers/synthetic-room-db.cjs buildRoom, name gate-empty); add a fake -wal and -shm file.
  2. Replace openRoomDb in lib/core/room-db.cjs with a double that throws the error on its first call.
  3. Call repairRoomIdentity(dir, { approvedBy: 'gate:x', createDb: true, moveAsideUnreadable: true }).
  4. Read the result and the .mindrian folder.
started: plan 369.25 (the recovery card). Made visible by plan 386-45.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the recovery card is one gate on all three).
- Affected commands: every governed write that meets a room whose room.db reads as unreadable; the session-start heal; the context brief that mints the card.
- Affected users: anyone who approves the recovery card after a false unreadable. Likely on a Windows drive read from WSL.
- Severity: high (data safety of the local mind; Part 9).
- Blast radius: lib/core/navigation/room-identity.cjs repairRoomIdentity, lib/core/graph-backfill.cjs _recoverIdentity, lib/core/room-readiness.cjs remediation, lib/mcp/session-room.cjs card minting, lib/mcp/room-readiness-gate.cjs card text, lib/mcp/tools/context.cjs.

## Eliminated

- hypothesis: the move needs a second condition today (for example an explicit not-a-database check).
  evidence: the catch in repairRoomIdentity tests only created_db and moveAsideUnreadable, never the error. The repro moves the file for all four non-damage classes.
  timestamp: 2026-11-06T14:05:00Z

## Evidence

- timestamp: 2026-11-06T14:02:00Z
  checked: static read of the path. readinessFor (lib/core/room-readiness.cjs) gives remediation recover_room_record for every reason except room_db_not_writable; resolveMcpWriteRoom (lib/mcp/session-room.cjs) mints the card through mintRecoveryGate (lib/mcp/room-readiness-gate.cjs) for recover_room_record; gate_answer approve calls _answerRecoveryGate, which runs runDeriveBackfill with approvedBy gate:<id>; _recoverIdentity (lib/core/graph-backfill.cjs) calls repairRoomIdentity with createDb true and moveAsideUnreadable true; repairRoomIdentity catches the openRoomDb failure and calls moveAsideDb (renames room.db, -wal, -shm to room.db.unreadable-<stamp>) whatever the error.
  found: the move-aside guard is the open error alone, with no check of the cause.
  implication: a false unreadable can rename a healthy file.
- timestamp: 2026-11-06T14:04:00Z
  checked: the card text as the person sees it, from resolveMcpWriteRoom on a synthetic room (source boot-fallback, session sess-r47).
  found: header "Recover this room's record so work can continue". Why-line is the readiness requirement, then "FeyMinto keeps this room's reasoning per folder; its record lives in room.db, and this recovery rebuilds it from ROOM.md and the registry. Recovering also indexes the files already here. Nothing is deleted." Options: "Recover the record" and "Not now". The card is offered for a healthy file whose requirement says "room.db is in use by another process, so it could not be read just now (try again)". The refusal message reads "Answer the recovery card to rebuild the room record, then retry."
  implication: the card says "Nothing is deleted" and "rebuilds the record", while the code moves the healthy file aside. PROVEN.
- timestamp: 2026-11-06T14:06:00Z
  checked: repro script on synthetic healthy rooms (scratchpad repro-386-47.cjs).
  found: a cannot-open error (SQLite code 14), RoomDbBusyError, an input or output error (code 10) and an unrelated TypeError each gave ok true with moved_aside of 3 files (room.db, -wal, -shm), and a new room.db at the old path (hash changed). A real garbage text file named room.db was moved aside (the legitimate recovery). A not-a-database error on a file that starts with the SQLite header was moved. A SQLITE_CORRUPT (code 11) error on a valid-header file was moved.
  implication: every class moves the file today. PROVEN.
- timestamp: 2026-11-06T14:07:00Z
  checked: readinessFor(dir, 'governed_write') for each cause, and resolveMcpWriteRoom.
  found: busy, io, cannot_open and other all give remediation recover_room_record and a minted card (recovery_gate_id present). For a forced unreadable on a healthy file, the cause comes from the file probe (busy) and the card is minted. For a garbage file the cause is not_a_database and the card is minted.
  implication: the card is offered for every cause. PROVEN.

moved_on_cannot_open: yes
moved_on_busy: yes
moved_on_io: yes
moved_on_other: yes
moved_on_not_a_database_garbage: yes
moved_on_not_a_database_valid_header: yes
corrupt_cause: not_a_database
card_offered_for_non_damage_causes: yes

## Technical Root Cause

- Site: lib/core/navigation/room-identity.cjs function `repairRoomIdentity` (the catch around `roomDbMod.openRoomDb`, calling `moveAsideDb`); lib/core/room-readiness.cjs function `answer` (remediation recover_room_record for every cause); lib/core/graph-backfill.cjs function `_recoverIdentity` (drops the cause).
- Cause: the move-aside guard is the open error alone, and the readiness answer offers the same recovery for every cause. A false unreadable (busy, drive error, cannot open, an unrelated script error) therefore reaches the rename and moves a healthy room.db aside.
- Why it surfaces now: plan 386-45 added the typed cause (busy, io, cannot_open, not_a_database, other). Before it, the cause was not known at the guard.
- Cause mapping: causeOfError returns not_a_database for SQLite codes 26 and 11 (corrupt). So SQLITE_CORRUPT maps to not_a_database. A malformed file that still starts with the SQLite header is NOT moved by this plan (the header belt). The plain line for that file tells the person to copy the file aside by hand and ask for help. A file that does not start with the header (a text file, a torn file) is moved as today.

emitter: lib/core/navigation/room-identity.cjs::repairRoomIdentity
card_options_change_for_not_a_database: no
files_to_touch: lib/core/navigation/room-identity.cjs, lib/core/room-readiness.cjs, lib/core/graph-backfill.cjs, lib/mcp/room-readiness-gate.cjs, lib/mcp/session-room.cjs, tests/test-386-no-move-aside-on-false-unreadable.cjs, .planning/debug/approved-recovery-moves-a-healthy-room-db-aside-on-a-false-unreadable.md

## Required Code Changes

- Change 1:
  - Location: lib/core/navigation/room-identity.cjs `repairRoomIdentity`
  - Required behavior: in the catch of openRoomDb, get the cause with causeOfError of lib/core/room-readiness.cjs (required lazily inside the catch, so there is no load cycle and no node:sqlite require). Call moveAsideDb only when the cause is not_a_database AND the first 16 bytes of room.db are not the SQLite header (an unreadable read counts as a valid header). In every other case return { ok: false, reason: 'room_db_unreadable', cause, detail } and move nothing. Keep created_db and the missing-file path as they are.
- Change 2:
  - Location: lib/core/room-readiness.cjs `answer`, `CAUSE_LINES`, `requirementFor`
  - Required behavior: for room_db_unreadable with a cause other than not_a_database, set the remediation to retry_or_check_drive (a person's action) and make the plain line say what to do (busy: close the program that holds the file and try again; io and cannot_open: check the drive is connected and available, close other programs that use the file, try again; other: name the error class and say nothing was changed). The not_a_database line, remediation and card are unchanged.
- Change 3:
  - Location: lib/mcp/session-room.cjs `resolveMcpWriteRoom` (refusal message for the new remediation; the card is not minted because the remediation is not recover_room_record); lib/mcp/tools/context.cjs already mints only for recover_room_record, so it needs no edit.
- Change 4:
  - Location: lib/core/graph-backfill.cjs `_recoverIdentity`; lib/mcp/room-readiness-gate.cjs `notRecoveredMessage`
  - Required behavior: carry the cause from the refusal to readiness (repair_reason room_db_unreadable, cause); name the person action in the not-recovered message.
- Not changed: lib/core/room-db.cjs (open mode, WAL, timeout 5000, migration chain), the card text and options for not_a_database.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-386-no-move-aside-on-false-unreadable.cjs
  - Given: synthetic healthy room.db files, openRoomDb doubles (cannot_open, busy, io, TypeError, a not-a-database error on a valid header), a real garbage file.
  - When: repairRoomIdentity, readinessFor, resolveMcpWriteRoom and runDeriveBackfill run with approval.
  - Then: MA1 to MA9 (the file stays for the four non-damage causes and for the valid header; a garbage file is still recovered; no card for the non-damage causes; the open path is unchanged).
  - Runner registration: tests/run-all-386.sh by glob.
- Test 2: tests/test-386-room-db-unreadable-message.cjs keeps its arms; the new plain lines keep the words it checks (another process, locks or shared memory, path or the drive).

## Non-Code Follow-ups

- CHANGELOG.md and knowledge-base.md: plan 386-21 owns them.
- Cross-platform: measured on WSL2 with synthetic files and error doubles only. macOS and native Windows get the same rule by construction (the guard reads the error and the file header).
- A malformed file with a valid SQLite header is left in place. The person copies it aside by hand and asks for help.

## Resolution

root_cause: the move-aside guard in repairRoomIdentity was the open error alone, and the readiness answer offered the same recovery card for every cause, so a false unreadable (busy, drive error, cannot open, script error) could rename a healthy room.db, -wal and -shm aside.
fix: repairRoomIdentity gets the cause with causeOfError (required lazily) and moves the file only for not_a_database on a file that does not start with the 16 byte SQLite header (an unreadable header read counts as valid, so nothing moves). Every other case returns { ok: false, reason: room_db_unreadable, cause, detail } and moves nothing. readinessFor gives the remediation retry_or_check_drive for busy, io, cannot_open and other, with a plain line that says what the person does; resolveMcpWriteRoom mints no card for it and says "Do what the line above says, then retry. Nothing was moved." graph-backfill carries the cause into readiness; notRecoveredMessage (now exported) names the person action, or tells the person to copy a valid-header file aside by hand and ask for help. The card text and options for not_a_database are unchanged. lib/core/room-db.cjs is not edited.
verification: node tests/test-386-no-move-aside-on-false-unreadable.cjs RED at the test commit (MA1 to MA4, MA6, MA7a, MA8 fail; MA5, MA7b, MA9 pass), GREEN after the fix (14 ok lines, all arms pass). Related tests equal their baseline: test-36925-readiness-gate, test-36925-rid-repair, test-386-room-db-unreadable-message, test-36925-never-ready, test-36925-negative-leg, test-36925-naming, test-36925-rid-binding, test-36925-feyminto-identity, test-36925-rft-binding, test-derive-backfill-acceptance, test-224-backfill-idempotent, test-248-room-bind-honest-return pass before and after; test-233-graph-heal-pipeline (G3 control) and test-237-approve-executes (mutation arm 7) fail before and after with identical lines. tests/run-all-196.sh 7 of 7.
files_changed:
  - lib/core/navigation/room-identity.cjs (cause and header guard)
  - lib/core/room-readiness.cjs (retry_or_check_drive, plain lines with the person action)
  - lib/core/graph-backfill.cjs (cause in readiness)
  - lib/mcp/room-readiness-gate.cjs (not-recovered message by cause, export)
  - lib/mcp/session-room.cjs (refusal message for the new remediation)
  - tests/test-386-no-move-aside-on-false-unreadable.cjs (new)
commits: RCA c11f3533e, RED 0744227d9, fix 545d5fe83
unverified: no real Windows lock was used here (plan 386-45 proved the SQLite code 14 on a synthetic file); this plan uses error doubles. A malformed file with a valid SQLite header is left in place by design.
risk_left: a real not-a-database file whose bytes start with the SQLite header (a partly torn file) is not recovered by the card any more; the person copies it aside by hand and asks for help.
