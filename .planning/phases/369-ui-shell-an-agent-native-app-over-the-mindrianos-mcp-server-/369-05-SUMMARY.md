---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 05
subsystem: database
tags: [change-log, sqlite-triggers, room-db, d-18, node-sqlite]

requires:
  - phase: 369-04
    provides: run-all-369.sh aggregator leg, fixture-room-369 builder, writer inventory
provides:
  - room_change_log append-only feed written by six triggers in the same transaction as every nodes/edges mutation
  - room_tx_context one-row stamp table and withRoomTx helper (transaction_id)
  - change_log_epoch and change_log_floor identity keys with rebuild re-mint
  - readChangeLogMeta (read-only safe) and navigation re-exports
  - Phase 108 alias registration for both tables
affects: [369 change feed plans (room_changes tool, SSE wake-up, compaction, cross-process, writer-coverage)]

tech-stack:
  added: []
  patterns:
    - "Capture at the table with triggers, not at call sites, so every writer in every process and language logs"
    - "Aliases registered and committed before any file carrying DDL (Pitfall 15)"
    - "Installer runs after the last migration on every write-door open; missing trigger means re-mint epoch and raise floor"

key-files:
  created:
    - lib/core/navigation/room-change-log.cjs
    - tests/test-369-change-log-ddl.cjs
  modified:
    - .planning/phases/108-graph-memory-schema-reconciliation/aliases.yml
    - lib/core/room-db.cjs
    - lib/core/navigation.cjs

key-decisions:
  - "entity_revision uses COALESCE(sqlite_sequence seq, 0) + 1, which equals the row's change_seq under AUTOINCREMENT (A7); proven in tests"
  - "readChangeLogMeta latest_seq is max(MAX(change_seq), sqlite_sequence seq) so an emptied tail still reports the true high-water mark"
  - "withRoomTx skips the stamp without failing when room_tx_context is absent on the handle"
  - "installChangeLog is not re-exported from navigation; only the room-db write door installs"

patterns-established:
  - "Raw-statement tests against a migrated wide schema must supply source_path, created_by, created_at and last_seen_at (NOT NULL)"

requirements-completed: [CHG369-01, CHG369-02]

duration: 25min
completed: 2026-10-03
---

# Phase 369 Plan 05: Change Log Storage Summary

**Append-only room_change_log written by six AFTER INSERT/UPDATE/DELETE triggers on nodes and edges (same transaction, no JSON functions), with an epoch and floor in identity, a rebuild-safe installer wired after the last migration, and a withRoomTx helper that stamps a transaction id.**

## Accomplishments

- Registered `room_change_log` and `room_tx_context` as NEW in the Phase 108 alias file and committed it alone first; the guard's literal-SQL probes (two tables, one index) all exit 0.
- `lib/core/navigation/room-change-log.cjs` (leaf module, `node:crypto` only): `installChangeLog`, `withRoomTx`, `readChangeLogMeta`, `CHANGE_LOG_TABLES`, `CHANGE_LOG_TRIGGERS`. Table uses AUTOINCREMENT so a seq is never reused; entity ids for edges are `source` char(31) `type` char(31) `target`; changed_at is ISO with milliseconds.
- `room-db.cjs` calls `installChangeLog(db)` immediately after `runPhase224EdgeReviewStatus(db)` inside the migration try, so a rebuilt table regains its triggers. A missing trigger on an existing log re-mints the epoch and sets the floor to previous max seq plus one.
- `navigation.cjs` re-exports `withRoomTx`, `readChangeLogMeta`, `CHANGE_LOG_TRIGGERS` (not the installer).
- `tests/test-369-change-log-ddl.cjs`: nine scenarios, the install scenario run once per variant (wide, mid, legacy), 11 ok lines.

## Task Commits

1. **Task 1: alias registration** - `1aba220cd` (chore)
2. **Task 2: installer, withRoomTx, meta reader, wiring** - `8f00b3238` (feat)
3. **Task 3: DDL, epoch, rebuild and transaction tests** - `880578c66` (test)

## Test Results

- `node tests/test-369-change-log-ddl.cjs`: PASS=11 FAIL=0 (nine scenarios, scenario 1 x3 variants)
- `bash tests/run-all-369.sh`: leg "369: change log DDL (CHG369-01, CHG369-02)" PASSED
- `node tests/test-236-engines-floor.cjs`: 5 passed, 0 failed
- `node scripts/check-substrate.cjs --baseline`: exit 0; pre-commit hooks (schema alias guard, substrate guard) passed on every commit, no `--no-verify`
- Full aggregator at the time of the run: PASS=26 FAIL=2 SKIP=28; both reds are outside this plan (below)

## Deviations from Plan

None in behavior. One test-side detail: scenario 4's raw INSERT statements on the migrated wide schema needed the NOT NULL provenance columns (`source_path`, `created_by`, `created_at`, `last_seen_at`); fixed in the test only.

## Findings (not caused by this plan)

1. Regression leg `198 local only` is RED on the tree (pre-existing, reported in 369-04).
2. `369: long-dash guard` is RED on a peer file: `tests/test-369-indicator-note.cjs` (plan 369-10) holds a literal U+2014 or U+2013 character. Not edited here (shared-tree rule); fix is the backslash-u escape form.

## Known Stubs

None.

## Threat Flags

None. All five register mitigations hold: capture at the table (T-01), no JSON functions in trigger bodies (T-02), epoch re-mint plus floor raise on a missing trigger, scenario 7 (T-03), owns idiom with ROLLBACK and rethrow inside room-db's closing try (T-04), aliases committed first and no hook skipped (T-05). Cross-process and Python-writer coverage is proven in the later plan 11 leg, as planned.

## Self-Check: PASSED

- Files present: lib/core/navigation/room-change-log.cjs, tests/test-369-change-log-ddl.cjs, aliases.yml entries (grep count 1 each)
- Commits present: 1aba220cd, 8f00b3238, 880578c66
