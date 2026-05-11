# Phase 88.2 deferred-items

Out-of-scope discoveries logged during 88.2-03 execution. Not fixed in this plan.

## tests/test-navigation-memory-events.cjs test1_enumCount stale baseline

- **Discovered during:** Plan 88.2-03 (2026-05-06).
- **Symptom:** `test1_enumCount` asserts `events.EVENT_TYPES.size === 15`. Wave 0 (commit 95cc3a8 -- 88.2-00 Plan 02) extended EVENT_TYPES with 4 new strings, bringing the size to 19.
- **Effect:** `node tests/test-navigation-memory-events.cjs` exits 1 with `8/9 passed` (only test1 fails; tests 2-9 pass). Phase 109 functional behavior is intact -- the failure is an arithmetic baseline mismatch, not a regression.
- **Why deferred:** This is a Wave-0 oversight (88.2-00) and lives in a Phase 109 test owned by that phase. Plan 88.2-03 owns selector-telemetry + F.1/F.2/F.5 personaContext extensions; updating Phase 109's baseline test is out-of-scope per the plan's `<files>` declarations.
- **Recommended fix:** A follow-up Phase 88.2-00 amendment commit OR a one-line update to `test1_enumCount` to assert `>= 19` (or the 4 new types' presence). Trivial.


---

## RESOLVED 2026-05-11

The `test1_enumCount` brittle exact-count assertion was changed from `equal(size, 19)` to `ok(size >= 19)` -- a monotonic floor that survives future event-type additions (EVENT_TYPES had grown to 32 by 2026-05-11 via Phases 116 tension_*, 117 auto_explore_*, 89-07 reverse_salient_*, plus brain_canon_drift_observed). The required-types membership loop still pins the Phase 109 + 88.2-00 baseline. `node tests/test-navigation-memory-events.cjs` is 9/9 GREEN. Fixed during the post-95.6 "next" sweep (the deferred item flagged in STATE.md Blockers as "One-line fix outstanding").
