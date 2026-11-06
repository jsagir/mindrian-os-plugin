---
status: fixing
kind: rca
trigger: "room-db-reported-unreadable-on-a-windows-drive-from-wsl"
issue_id: "B18"
severity: high
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T13:30:00Z
updated: 2026-11-06T13:40:00Z
---

## Current Focus

hypothesis: the message is a false report for a lock-class failure. A Windows process that holds the file makes the WSL open fail with SQLITE_CANTOPEN (code 14), which no code classifies, and the identity reader drops the error before the readiness line is chosen.
test: synthetic room.db copied to a new scratch folder on /mnt/c (9p drvfs mount); open it in WAL mode, with a second WSL holder, and with a Windows process that holds the file with no sharing.
expecting: WAL opens and reads fine on the drive; a Windows hold reproduces the fixed "damaged" line on a healthy file.
next_action: add a typed cause (Task 2); record the open-mode decision (Task 3).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (branch main)
- Source-of-Truth Preamble: CODE claims read against branch main at HEAD 93df525bb (2026-11-06). WIRE claims: none, no network. Date: 2026-11-06. Every runtime claim below was measured on a synthetic room.db in a new empty scratch folder under /mnt/c/Windows/Temp (removed at the end). The owner's real room and room.db were never read, opened, copied or listed.
- Related debug sessions: room-section-table-lists-the-room-own-windows-path (B17, same room, same drive)
- Owner facts relayed by the parallel session (hypotheses, read-only): the real room.db is not damaged (25 tables, 12 MB, WAL updated a minute earlier); the open failure at session start was most likely a lock difference between WSL and the Windows drive at that moment.

## Problem Statement

At session start the room opens with the line "room.db cannot be opened (it is damaged or is not a database)" for a healthy room.db on a Windows drive read from WSL. Every error class gets that one line, so the person cannot tell a lock from damage.

## Symptoms

expected: a lock, a drive limit or a path problem is named as such; "damaged" only for a file that is not a SQLite database.
actual: one fixed line for every failure.
errors: detail kept in the result but never shown: "read-only open returned no handle".
reproduction:
  1. Copy a synthetic room.db into a new folder on /mnt/c.
  2. Let a Windows process open that file with no sharing (FileShare None).
  3. From WSL run readinessFor(<room>, 'research') or the session-start readiness step.
  4. The requirement line says damaged. The file is a valid SQLite file.
started: not bisected.

## Scope and Impact

- Affected surfaces: cli (session-start), desktop and cowork through the same readiness answer.
- Affected commands: every governed write and research job that reads readiness; the session-start heal line.
- Affected users: a room.db on a Windows drive used from WSL while a Windows program holds the file (editor, sync client, scanner, a Windows Claude session).
- Severity: high (a false damage report makes the owner doubt a healthy local mind).
- Blast radius: graph-backfill _readinessStep, scripts/session-start, readinessFor, room-identity (the detail is dropped there), repairRoomIdentity (see Risk below).

## Eliminated

- hypothesis: WAL mode cannot work on a Windows drive mounted in WSL (9p drvfs).
  evidence: on a 9p drvfs mount (cache=0x5), a synthetic room.db opened in WAL mode through openRoomDb in 80 ms, journal_mode read back wal, and a read-only identity read worked. A copy converted to DELETE journal behaved the same for reads.
  timestamp: 2026-11-06T13:20:00Z
- hypothesis: the busy timeout or node:sqlite cannot lock on the drive.
  evidence: with a second WSL process holding BEGIN IMMEDIATE, a write open waited 5154 ms and threw RoomDbBusyError (the typed busy class works on the drive). A read-only identity read during the hold succeeded in 41 ms.
  timestamp: 2026-11-06T13:20:30Z
- hypothesis: a path or encoding difference.
  evidence: not the cause in this repro (same path form for all runs); not excluded for the real room (UNVERIFIED, real path not read).
  timestamp: 2026-11-06T13:21:00Z

## Evidence

- timestamp: 2026-11-06T13:19:00Z
  checked: static read of lib/core/room-readiness.cjs, lib/core/navigation/room-identity.cjs, lib/core/navigation/spine-events.cjs, lib/core/room-db.cjs, lib/core/graph-backfill.cjs, scripts/session-start.
  found: REQUIREMENT_LINES.room_db_unreadable is the one fixed line. It is reached from (a) the catch of readIdentity in room-readiness.cjs, (b) readRoomIdentity returning notReady('room_db_unreadable') with a detail, after openRoomDbReadOnlyForCaller swallowed the SQLite error and returned null ("read-only open returned no handle"), (c) the catch in graph-backfill _readinessStep. scripts/session-start prints rr.REQUIREMENT_LINES[r.reason] from that result. openRoomDb opens DatabaseSync(dbPath, {timeout: 5000}) then PRAGMA journal_mode = WAL, foreign_keys = ON, synchronous = NORMAL, then the migration chain; classifyOpenFailure types only SQLITE_BUSY (RoomDbBusyError) and SQLITE_NOTADB or SQLITE_CORRUPT (RoomDbBrokenError). Any other errcode (IOERR, CANTOPEN) is thrown raw.
  implication: five error classes become one line today: busy, io, cannot_open, not_a_database, other. The person can tell none apart.
- timestamp: 2026-11-06T13:20:00Z
  checked: /mnt/c mount type and the scratch folder.
  found: C:\ on /mnt/c type 9p (drvfs). A new empty folder was made under /mnt/c/Windows/Temp (name mos-386-45-<random>), used, and removed.
  implication: the repro ran on the real Windows-drive mount type, with synthetic data.
- timestamp: 2026-11-06T13:20:10Z
  checked: synthetic room.db (225280 bytes, header "SQLite format 3") copied into the scratch folder; openRoomDb, then readRoomIdentity in place.
  found: openRoomDb ok, journal wal, 80 ms. Identity read ok (the synthetic db has no identity rows, so it reports identity_missing, not unreadable).
  implication: WAL and the read-only open work on the drive. PROVEN.
- timestamp: 2026-11-06T13:20:30Z
  checked: a Windows process (powershell, File.Open with FileShare None) holds the synthetic room.db; from WSL run openRoomDb, readRoomIdentity and readinessFor.
  found: openRoomDb threw a raw Error, errcode 14, "unable to open database file", in 18 ms (not typed). readRoomIdentity returned reason room_db_unreadable, detail "read-only open returned no handle". readinessFor returned requirement "room.db cannot be opened (it is damaged or is not a database)".
  implication: the exact reported line is reproduced on a healthy file by a Windows-side lock. This is a false damage report. PROVEN.
- timestamp: 2026-11-06T13:21:00Z
  checked: grep for callers that act on room_db_unreadable.
  found: lib/core/navigation/room-identity.cjs repairRoomIdentity renames room.db to room.db.unreadable-<stamp> when the open throws and moveAsideUnreadable is true; graph-backfill sets it on an approved recovery.
  implication: RISK, not changed by this plan: after a person approves the recovery card, a false unreadable (a lock that lets the rename succeed) could move a healthy room.db aside. The typed cause makes this visible; guarding the rename by cause is a separate change.

## Technical Root Cause

- Site: lib/core/room-readiness.cjs function `readIdentity` (the catch) and `REQUIREMENT_LINES.room_db_unreadable`; lib/core/navigation/spine-events.cjs function `openRoomDbReadOnlyForCaller` (swallows the error); lib/core/graph-backfill.cjs function `_readinessStep` (catch).
- Cause: every failure to read the room.db identity is mapped to the one reason room_db_unreadable with one fixed line that says damaged. The real error is discarded (the read-only open returns null) or truncated into a detail the person never sees. classifyOpenFailure knows only busy and broken, so a Windows-side hold (SQLITE_CANTOPEN) is not classified.
- Why it surfaces now: a room on a Windows drive is read from WSL while a Windows program holds the file.

emitter: lib/core/room-readiness.cjs::readIdentity
open_mode: DatabaseSync(dbPath, { timeout: 5000 }), PRAGMA journal_mode = WAL, foreign_keys = ON, synchronous = NORMAL, then the migration chain; the read-only reader opens file:<path>?mode=ro
drvfs_repro: ran
wal_on_drvfs: ok
lock_on_drvfs: ok (WSL locks give the busy class; a Windows exclusive hold gives SQLITE_CANTOPEN, code 14)
mode_change_needed: no
files_to_touch: lib/core/room-readiness.cjs, lib/core/graph-backfill.cjs, scripts/session-start, tests/test-386-room-db-unreadable-message.cjs, .planning/debug/room-db-reported-unreadable-on-a-windows-drive-from-wsl.md

## Required Code Changes

- Change 1 (part 1, no mode change):
  - Location: lib/core/room-readiness.cjs, new `unreadableCause`, `requirementFor`, `CAUSE_LINES`; `readinessFor` and `readIdentity`
  - Required behavior: classify the cause (busy, io, cannot_open, not_a_database, other) from the thrown error (SQLite code, typed room-db errors, message) or, for a returned result with no error, from a local probe of room.db (file header, then one read-only open); keep reason room_db_unreadable; add field cause; requirement is the plain line for the cause.
- Change 2:
  - Location: lib/core/graph-backfill.cjs `_readinessStep` and scripts/session-start (the readiness line)
  - Required behavior: carry the cause in result.readiness and print the cause line, so the session-start line is honest.
- Part 2: not needed. WAL works on the drive (wal_on_drvfs ok), so no journal or open mode change is made. See the Owner decision block.
- Not changed: lib/core/room-db.cjs, the journal mode, the timeout, the migration chain.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-386-room-db-unreadable-message.cjs
  - Given: error doubles for busy, io, cannot_open, a TypeError, and a fixture room with a text file named room.db.
  - When: readinessFor reads the room.
  - Then: RM1 to RM6 (a cause field and a plain line per cause) and RM7 (open mode unchanged in the room-db.cjs source).
  - Runner registration: tests/run-all-386.sh by glob.

## Non-Code Follow-ups

- Risk to decide later: repairRoomIdentity moves room.db aside on any open failure after an approved recovery. Guard it by cause (only not_a_database) in a separate plan.
- CHANGELOG.md and knowledge-base.md: plan 386-21 owns them.
- Cross-platform: measured on WSL2 only. macOS and native Windows only get the plain lines by construction.

## Resolution

root_cause: every room.db read failure maps to one fixed "damaged" line; the real error is dropped, and a Windows-side hold (SQLITE_CANTOPEN) is not classified at all.
fix: filled in Task 2.
verification: filled in Task 2.
files_changed:
  - filled in Task 2
commits: filled in Task 2
