---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "47"
subsystem: room-recovery
tags: [B19, room-db, recovery-card, move-aside, data-safety]
requires: [386-45]
provides:
  - room.db moves aside only for cause not_a_database on a file without the SQLite header
  - remediation retry_or_check_drive (a person action, no recovery card) for busy, io, cannot_open and other
key-files:
  created:
    - .planning/debug/approved-recovery-moves-a-healthy-room-db-aside-on-a-false-unreadable.md
    - tests/test-386-no-move-aside-on-false-unreadable.cjs
  modified:
    - lib/core/navigation/room-identity.cjs
    - lib/core/room-readiness.cjs
    - lib/core/graph-backfill.cjs
    - lib/mcp/room-readiness-gate.cjs
    - lib/mcp/session-room.cjs
decisions:
  - "No owner decision needed: the card options for a real not-a-database file are unchanged (card_options_change_for_not_a_database: no)."
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 47: No move-aside of room.db for a false unreadable (B19) Summary

An approved recovery moved room.db, room.db-wal and room.db-shm aside on ANY open failure. A false unreadable (busy, drive error, cannot open, script error) could therefore move a healthy file. Now only a failure with cause not_a_database on a file that does not start with the SQLite header moves the file. All other causes return the typed refusal (reason room_db_unreadable, plus the cause) and nothing moves.

## Reproduction (PROVEN, synthetic healthy room.db, error doubles)

- Before the fix, cannot_open, busy, io and a TypeError each moved the file and its -wal and -shm aside and a new room.db was created. A not-a-database error on a file with a valid SQLite header also moved it. A real garbage file moved (the legitimate case).
- The recovery card was offered for every cause. SQLITE_CORRUPT maps to not_a_database (causeOfError), so a malformed file with a valid header is now left in place; the plain message tells the person to copy it aside by hand and ask for help.

## What changed

- `lib/core/navigation/room-identity.cjs`: `openFailureCause` (lazy require of causeOfError) and `hasSqliteHeader`; the catch in `repairRoomIdentity` guards `moveAsideDb`.
- `lib/core/room-readiness.cjs`: remediation `retry_or_check_drive` for non-damage causes; plain lines say what the person does. The existing words checked by test-386-room-db-unreadable-message are kept.
- `lib/core/graph-backfill.cjs`: carries `cause` into readiness.
- `lib/mcp/room-readiness-gate.cjs`: `notRecoveredMessage` names the person action by cause and is exported; the summary keeps `cause`.
- `lib/mcp/session-room.cjs`: refusal message for the new remediation. No card is minted (card minting needs recover_room_record).
- Not changed: `lib/core/room-db.cjs` (WAL, timeout 5000, migration chain), the card text and options for not_a_database. `lib/mcp/tools/context.cjs` needs no edit (it mints only for recover_room_record).

## Deviations from Plan

**1. [Rule 3 - blocking] lib/mcp/session-room.cjs added to files_to_touch**
- The refusal message in resolveMcpWriteRoom had only two branches (restore permission or the card); the new remediation needed its own line. Added to the RCA files_to_touch line before the edit.

**2. Test MA8 checks room.db bytes and no moved file, not the fake -wal and -shm**
- The backfill goes on after a failed recovery and a real open rewrote the fake -wal. MA1 to MA4 and MA6 check all three files byte for byte.

## Verification

- RED 0744227d9: MA1 to MA4, MA6, MA7a, MA8 fail; MA5, MA7b, MA9 pass. GREEN 545d5fe83: all arms pass.
- Related tests equal their baseline: 12 pass before and after (test-36925-readiness-gate, rid-repair, never-ready, negative-leg, naming, rid-binding, feyminto-identity, rft-binding, test-386-room-db-unreadable-message, test-derive-backfill-acceptance, test-224-backfill-idempotent, test-248-room-bind-honest-return); test-233-graph-heal-pipeline (G3) and test-237-approve-executes (arm 7) fail before and after with identical lines.
- `TEST_386_PREFIX=tests/test-386-no-move-aside bash tests/run-all-386.sh` PASSED; `bash tests/run-all-196.sh` 7 of 7.

## Known Stubs

None.

## Threat Flags

None.
