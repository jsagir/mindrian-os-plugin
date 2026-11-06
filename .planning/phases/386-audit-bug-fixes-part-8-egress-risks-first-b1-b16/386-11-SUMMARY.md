---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "11"
subsystem: sessionstart-hooks
tags: [rca, b6, check-pending, strikes, room-db]
status: complete
requires: ["386-01"]
provides:
  - check-pending-ambiguous counts one strike per distinct session_id
  - check-pending-breakthrough creates no room.db
affects: []
key-files:
  created:
    - .planning/debug/check-pending-ambiguous-three-strikes-count-compactions.md
    - .planning/debug/check-pending-breakthrough-creates-room-db.md
    - tests/test-386-check-pending-hooks.cjs
  modified:
    - scripts/check-pending-ambiguous.cjs
    - scripts/check-pending-breakthrough.cjs
requirements: [B6]
decisions:
  - "Strike rule: one per distinct session_id, stored as the scalar last_strike_session_id (max 128 characters). No session_id keeps the per-run count."
metrics:
  tasks_done: 3
  tasks_total: 3
  completed: 2026-11-06
---

# Phase 386 Plan 11: B6 check-pending hooks Summary

Two defects, both confirmed on fixture rooms with synthetic claims.

- Strikes: check-pending-ambiguous added a strike on every run (startup, clear and compact). Three compact runs with one session_id dismissed both claims. It now adds one strike per distinct session_id and stores the id as a scalar.
- room.db: check-pending-breakthrough called the scanner on a room with no database. The scanner opens the room through openRoomDb, which creates the file. The hook now returns {continue:true} first when .mindrian/room.db is absent.

## Skip rule

Both targets PRESENT (hooks and hooks.json entries exist, matcher startup|clear|compact). No skip.

## Commits

- 1f313d2ce docs(386-11): both RCA files
- f1d26593c test(386-11): RED, P1 and P4 fail, P2 P3 P5 pass
- 83dfc010b fix(386-11): GREEN, both hooks
- cd7dabfe6 docs(386-11): RCA resolution blocks

## Verification (PROVEN)

- `node tests/test-386-check-pending-hooks.cjs`: P1 to P5 ok.
- `node tests/test-check-pending-ambiguous.cjs`: 10 checks passed (also passed before).
- `node tests/test-ambiguous-queue.cjs`, `tests/test-120-02-scaffold.sh`, `tests/test-369-change-log-cross-process.cjs`, `tests/test-261029-qef-hook-timeouts.cjs`: exit 0.
- `node tests/test-breakthrough-*.cjs` (5 files): exit 0.
- `node scripts/check-pending-breakthrough.test.cjs`: 4 pass, 1 fail. Baseline before the change was the same single failure (Test 12).
- `bash tests/run-all-386.sh`: PASS=11 FAIL=0 (includes peer 386 test files present at run time).

## Test 12 note

Test 12 of scripts/check-pending-breakthrough.test.cjs expects shape F.7 but the hook emits F.1 (Phase 188-01 made the F.1 next-move the surface home). It is a stale test expectation, not related to B6. The failure list did not grow. It was not fixed here.

## Deviations from Plan

None. Notes:

- The Claude Code SessionStart input fields (session_id, source) are UNVERIFIED against the live docs: no Context7 or web tool was available to the executor. The rule does not depend on them. Missing or unreadable input keeps the old per-run count (test P3). Whether a clear issues a new session_id is also UNVERIFIED.
- Follow-up recorded in both RCAs: readActiveRoomDir in both hooks uses path.join(roomsHome, reg.active), which misses a nested sub-room (same class as B3).
- The tension store (lib/memory/pending-tension-store.cjs evaluateAndDecay) also counts per surfacing, not per session. Out of scope.

## Known Stubs

None.

## Self-Check: PASSED
