---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "10"
subsystem: compaction-path
tags: [rca, b5, b9, post-compact, session-rows, side-channel]
status: complete
requires: ["386-09"]
provides:
  - one compaction opens one session row
  - scripts/post-compact prints only PostCompact-valid keys
  - restore-post-compact-context contribute() returns the side-channel fragment for the active room
affects: []
key-files:
  created:
    - .planning/debug/post-compact-two-session-rows-and-sessionstart-envelope-fallback.md
    - .planning/debug/restore-post-compact-context-contribute-always-empty.md
    - tests/test-386-post-compact-session-rows.cjs
    - tests/test-386-restore-post-compact-context.cjs
  modified:
    - scripts/memory-lifecycle.cjs
    - scripts/post-compact
    - scripts/restore-post-compact-context.cjs
requirements: [B5, B9]
decisions:
  - "B5 keeps the SessionStart row writer (runs on startup, clear and compact). cmdPostCompact reuses the pointer session and writes only the marker fragment; it opens a row only without a usable pointer. Safe in either hook order."
  - "B9 has 3 faults, not 1: readSideChannel() without roomDir, getActiveRoom() without workDir, and validateRoomMatch given the file record instead of the parsed stamp. Fixing only the first would consume the file as stale and still return empty."
  - "scripts/session-start was not edited."
metrics:
  tasks_done: 3
  tasks_total: 3
  completed: 2026-11-06
---

# Phase 386 Plan 10: B5 and B9 post-compact group Summary

## Skip rule

Both targets PRESENT (`target: PRESENT` in each RCA). Phase 385 did not remove or narrow either. No skip.

## Commits

- d099bcd92 docs(386-10): RCA for both defects
- e05745b94 test(386-10): RED (C1, C2, C4 fail; C3, C5, C6 pass)
- f5dfe4645 fix(386-10): GREEN
- c44e8aef0 docs(386-10): RCA resolution blocks

## B5

Root cause: two hooks in one compaction each own a row writer. SessionStart (matcher includes compact) runs memory-lifecycle session-start. PostCompact runs memory-lifecycle post-compact. Both call startSession. PROVEN on a fixture: 0 rows, then 1, then 2. The no-state fallback in scripts/post-compact exec'd session-start and printed a hookSpecificOutput envelope with hookEventName SessionStart (PROVEN, top-level keys `hookSpecificOutput,systemMessage`).

Fix: cmdPostCompact reuses the session that the pointer names. scripts/post-compact prints `{"continue":true}` on the no-state and stale-state paths. The snapshot restore, the side-channel writer and the systemMessage count are unchanged.

## B9

Root cause: contribute() copied main() without its arguments. See the RCA for the 3 faults. Fix: resolveContributeRoom (built on lib/core/resolve-active-room.cjs) then readSideChannel(room), parseStamp, validateRoomMatch(stamp, room). Cross-room files are set aside as cross-room-skip.

## Verification (PROVEN)

Baseline taken first; all green before the change.
- node tests/test-386-post-compact-session-rows.cjs: C1 (both hook orders), C2 (no state and stale state), C3 all ok. RED: C1 and C2 failed.
- node tests/test-386-restore-post-compact-context.cjs: C4, C5, C6 all ok. RED: C4 failed.
- tests/test-post-compact-nav04-closure.cjs, lib/memory/post-compact-reinjection.test.cjs, tests/test-341-session-start-tier.cjs, tests/test-k1u-session-start-envelope.cjs, tests/test-memory-lifecycle-stop-repeated.cjs, lib/memory/sessionstart-coordinator.test.cjs: exit 0.
- bash -n scripts/post-compact and scripts/session-start: ok.
- bash tests/run-all-386.sh: PASS=18 FAIL=0 (peer test files present at run time).
- scripts/on-stop stays at 674 lines.

## Deviations from Plan

- [Rule 1 - Bug] The plan described B9 as one fault. The code has 3. All 3 fixed (see Decisions).
- The C1 test opens an original session first so the reverse hook order is realistic (a pointer exists after startup).

## UNVERIFIED

- Whether the host fires SessionStart with source compact in the same compaction as PostCompact. No documentation tool was available. The repo assumes it (hooks.json matcher, scripts/session-start comment). The fix is correct in either order of the 2 hooks, but if SessionStart(compact) never fired, a compaction would add 0 rows (same conversation, marker in the existing session).

## Known Stubs

None.

## Self-Check: PASSED

Files and commits above exist (git log --grep 386-10 shows 4 commits).
